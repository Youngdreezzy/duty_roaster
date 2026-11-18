const getStore = require('./store');
const auth = require('./auth');
const { DEFAULT_CONFIG, SAMPLES } = require('./defaults');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

const clone = (x) => JSON.parse(JSON.stringify(x));
const isOffWord = (v) => /^off$/i.test(String(v || '').trim());
const isWeek = (w) => {
  if (typeof w !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w)) return false;
  const d = new Date(w + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === w && d.getUTCDay() === 1; // must be a Monday
};

// Loads the saved setup. Outlets that exist in defaults.js but not yet in the database (e.g. Hotel) are added once.
async function loadConfig(store) {
  const cfg = await store.get('cfg');
  if (!cfg) return clone(DEFAULT_CONFIG);
  const missing = DEFAULT_CONFIG.outlets.filter((d) => !cfg.outlets.some((o) => o.id === d.id));
  if (missing.length) {
    cfg.outlets.push(...clone(missing));
    await store.set('cfg', cfg);
  }
  return cfg;
}

function findDept(cfg, outletId, deptId) {
  const outlet = cfg.outlets.find((o) => o.id === outletId);
  const dept = outlet && outlet.departments.find((d) => d.id === deptId);
  if (!dept) fail(404, 'Unknown outlet or department.');
  return { outlet, dept };
}

const rosterKey = (o, d, w) => `roster:${o}:${d}:${w}`;
const pwKey = (o, d) => `pw:${o}:${d}`;       // staff password of one department
const supKey = (o) => `sup:${o}`;              // supervisor password of one outlet

/* ---------- who is calling ---------- */
function session(req) {
  const p = auth.verify(auth.tokenFrom(req));
  if (!p) fail(401, 'Please log in again.');
  return p;
}
// Super admin: everything. Supervisor: only their own outlet.
function requireManager(req, outletId) {
  const p = session(req);
  if (p.role === 'admin') return p;
  if (p.role === 'supervisor' && p.outlet === outletId) return p;
  fail(403, 'You do not have access to this outlet.');
}
function requireSuper(req) {
  const p = session(req);
  if (p.role !== 'admin') fail(403, 'Only the super admin can do this.');
  return p;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
}
async function checkNotLocked(store, req) {
  const n = (await store.get('rl:' + clientIp(req))) || 0;
  if (n >= 10) fail(429, 'Too many wrong passwords. Please wait 10 minutes and try again.');
}
async function recordFailure(store, req) {
  const k = 'rl:' + clientIp(req);
  const n = await store.incr(k);
  if (n === 1) await store.expire(k, 600);
}

function cleanText(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
const cleanPost = (v) => cleanText(v, 30).replace(/@/g, '');

// "M@PB" -> { base: 'M', cover: 'PB' }
function splitVal(v) {
  const i = String(v).indexOf('@');
  return i < 0 ? { base: String(v), cover: '' } : { base: String(v).slice(0, i), cover: String(v).slice(i + 1) };
}

function validateRows(dept, rows) {
  if (!rows || typeof rows !== 'object') fail(400, 'Roster data is missing.');
  const covers = (dept.covers || []).map((c) => c.code);
  const out = {};
  for (const s of dept.staff) {
    const r = rows[s.id];
    if (r === undefined) { out[s.id] = Array(7).fill(''); continue; }
    if (!Array.isArray(r) || r.length !== 7) fail(400, `Bad row for ${s.name}.`);
    out[s.id] = r.map((v) => {
      if (v === '' || v === null) return '';
      const { base, cover } = splitVal(v);
      if (!dept.posts.includes(base)) fail(400, `"${base}" is not a duty post for ${dept.name}.`);
      if (cover) {
        if (!covers.includes(cover)) fail(400, `"${cover}" is not a cover place for ${dept.name}.`);
        if (isOffWord(base)) fail(400, `${s.name}: a day off cannot have a cover place.`);
      }
      return v;
    });
  }
  return out;
}

// Lines like "PB = Pool Bar" (or just "PB") -> [{code, name}]
function parseCovers(lines, deptName) {
  const out = [];
  for (const raw of lines || []) {
    const line = cleanText(raw, 60);
    if (!line) continue;
    const [c, ...rest] = line.split('=');
    const code = c.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,6}$/.test(code)) fail(400, `${deptName}: cover code "${c.trim()}" must be 1 to 6 letters or numbers.`);
    if (out.some((x) => x.code === code)) continue;
    out.push({ code, name: cleanText(rest.join('='), 30) || code });
  }
  if (out.length > 12) fail(400, `${deptName}: too many cover places (max 12).`);
  return out;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);

const actions = {
  // Public set-up check: shows only yes/no for each setting, never the values.
  async health(req, res, store) {
    const out = {
      ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
      SESSION_SECRET: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16,
      database: store.kind,
    };
    try {
      await store.set('health:ping', Date.now());
      out.databaseWorks = (await store.get('health:ping')) !== null;
    } catch (e) {
      out.databaseWorks = false;
      out.databaseError = String(e && e.message).slice(0, 160);
    }
    out.ready = out.ADMIN_PASSWORD && out.SESSION_SECRET && out.database === 'upstash' && out.databaseWorks;
    return out;
  },

  // Public: names of outlets and departments, for the login dropdowns.
  async meta(req, res, store) {
    const cfg = await loadConfig(store);
    return {
      outlets: cfg.outlets.map((o) => ({
        id: o.id, name: o.name,
        departments: o.departments.map((d) => ({ id: d.id, name: d.name })),
      })),
    };
  },

  async login(req, res, store, body) {
    await checkNotLocked(store, req);
    if (body.role === 'admin') {
      if (!process.env.ADMIN_PASSWORD) fail(500, 'Server is not set up yet: ADMIN_PASSWORD is missing (see README).');
      if (!auth.safeEqual(body.password || '', process.env.ADMIN_PASSWORD)) {
        await recordFailure(store, req);
        fail(401, 'Wrong password.');
      }
      return { token: auth.sign({ role: 'admin' }), role: 'admin' };
    }
    const cfg = await loadConfig(store);
    if (body.role === 'supervisor') {
      const outlet = cfg.outlets.find((o) => o.id === body.outlet);
      if (!outlet) fail(404, 'Unknown outlet.');
      const stored = await store.get(supKey(outlet.id));
      if (!stored) fail(403, `The ${outlet.name} supervisor password has not been set yet. Ask the super admin to set it.`);
      if (!auth.checkPassword(body.password || '', stored)) {
        await recordFailure(store, req);
        fail(401, 'Wrong password.');
      }
      return { token: auth.sign({ role: 'supervisor', outlet: outlet.id }), role: 'supervisor', outlet: outlet.id };
    }
    const { outlet, dept } = findDept(cfg, body.outlet, body.dept);
    const stored = await store.get(pwKey(outlet.id, dept.id));
    if (!stored) fail(403, `The ${dept.name} password has not been set yet. Please ask your supervisor.`);
    if (!auth.checkPassword(body.password || '', stored)) {
      await recordFailure(store, req);
      fail(401, 'Wrong password.');
    }
    return {
      token: auth.sign({ role: 'staff', outlet: outlet.id, dept: dept.id }),
      role: 'staff', outlet: outlet.id, dept: dept.id,
    };
  },

  async roster(req, res, store) {
    const p = session(req);
    const { outlet: oid, dept: did, week } = req.query;
    if (!isWeek(week)) fail(400, 'Week must be a Monday date (YYYY-MM-DD).');
    if (p.role === 'staff' && (p.outlet !== oid || p.dept !== did)) fail(403, 'You can only view your own department.');
    if (p.role === 'supervisor' && p.outlet !== oid) fail(403, 'You do not have access to this outlet.');
    const cfg = await loadConfig(store);
    const { outlet, dept } = findDept(cfg, oid, did);
    let roster = await store.get(rosterKey(oid, did, week));
    if (p.role === 'staff' && (!roster || roster.status !== 'published')) roster = null;
    return { outlet: outlet.name, dept, roster };
  },

  // Settings data. Super admin gets every outlet; a supervisor gets only theirs.
  async config(req, res, store) {
    const p = session(req);
    if (p.role !== 'admin' && p.role !== 'supervisor') fail(403, 'Supervisor login required.');
    const cfg = await loadConfig(store);
    let outlets = cfg.outlets;
    if (p.role === 'supervisor') outlets = outlets.filter((o) => o.id === p.outlet);
    for (const o of outlets) {
      o.supervisorPasswordSet = !!(await store.get(supKey(o.id)));
      for (const d of o.departments) d.hasPassword = !!(await store.get(pwKey(o.id, d.id)));
    }
    return { role: p.role, outlets };
  },

  async saveRoster(req, res, store, body) {
    requireManager(req, body.outlet);
    if (!isWeek(body.week)) fail(400, 'Week must be a Monday date.');
    if (!['draft', 'published'].includes(body.status)) fail(400, 'Status must be draft or published.');
    const cfg = await loadConfig(store);
    const { dept } = findDept(cfg, body.outlet, body.dept);
    const rows = validateRows(dept, body.rows);
    const prev = await store.get(rosterKey(body.outlet, body.dept, body.week));
    const now = Date.now();
    const roster = {
      status: body.status,
      rows,
      updatedAt: now,
      publishedAt: body.status === 'published' ? now : (prev && prev.publishedAt) || null,
    };
    await store.set(rosterKey(body.outlet, body.dept, body.week), roster);
    return { roster };
  },

  async saveConfig(req, res, store, body) {
    requireManager(req, body.outlet);
    const cfg = await loadConfig(store);
    const outlet = cfg.outlets.find((o) => o.id === body.outlet);
    if (!outlet) fail(404, 'Unknown outlet.');
    if (!Array.isArray(body.departments)) fail(400, 'Departments are missing.');
    for (const incoming of body.departments) {
      const dept = outlet.departments.find((d) => d.id === incoming.id);
      if (!dept) fail(400, 'Unknown department.');
      const posts = [];
      for (const raw of incoming.posts || []) {
        const p = cleanPost(raw);
        if (p && !posts.some((x) => x.toLowerCase() === p.toLowerCase())) posts.push(p);
      }
      if (!posts.length || posts.length > 30) fail(400, `${dept.name}: add between 1 and 30 duty posts.`);
      const staff = [];
      const seen = new Set();
      for (const s of incoming.staff || []) {
        const name = cleanText(s.name, 40);
        if (!name) continue;
        if (typeof s.id !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(s.id) || seen.has(s.id)) fail(400, 'Bad staff id.');
        seen.add(s.id);
        staff.push({ id: s.id, name });
      }
      if (staff.length > 60) fail(400, `${dept.name}: too many staff (max 60).`);
      dept.posts = posts;
      dept.staff = staff;
      dept.covers = parseCovers(incoming.covers, dept.name);
      dept.note = cleanText(incoming.note, 120);
    }
    await store.set('cfg', cfg);
    return { ok: true };
  },

  // Super admin only: add a new department to an outlet.
  async addDepartment(req, res, store, body) {
    requireSuper(req);
    const cfg = await loadConfig(store);
    const outlet = cfg.outlets.find((o) => o.id === body.outlet);
    if (!outlet) fail(404, 'Unknown outlet.');
    const name = cleanText(body.name, 30);
    if (!name) fail(400, 'Type a name for the department.');
    if (outlet.departments.some((d) => d.name.toLowerCase() === name.toLowerCase())) fail(400, 'This outlet already has a department with that name.');
    if (outlet.departments.length >= 20) fail(400, 'Too many departments (max 20).');
    let id = slug(name) || 'dept';
    while (outlet.departments.some((d) => d.id === id)) id = id.slice(0, 16) + '-' + Math.random().toString(36).slice(2, 5);
    outlet.departments.push({ id, name, posts: ['ON', 'OFF'], staff: [] });
    await store.set('cfg', cfg);
    return { ok: true, id };
  },

  // Staff password of one department (shared by everyone in it).
  async setPassword(req, res, store, body) {
    requireManager(req, body.outlet);
    const cfg = await loadConfig(store);
    const { outlet, dept } = findDept(cfg, body.outlet, body.dept);
    const pw = typeof body.password === 'string' ? body.password.trim() : '';
    if (pw.length < 4 || pw.length > 64) fail(400, 'Password must be 4 to 64 characters.');
    await store.set(pwKey(outlet.id, dept.id), auth.hashPassword(pw));
    return { ok: true };
  },

  // Super admin only: the password the supervisors of one outlet use to log in.
  async setSupervisorPassword(req, res, store, body) {
    requireSuper(req);
    const cfg = await loadConfig(store);
    const outlet = cfg.outlets.find((o) => o.id === body.outlet);
    if (!outlet) fail(404, 'Unknown outlet.');
    const pw = typeof body.password === 'string' ? body.password.trim() : '';
    if (pw.length < 6 || pw.length > 64) fail(400, 'Supervisor password must be 6 to 64 characters.');
    await store.set(supKey(outlet.id), auth.hashPassword(pw));
    return { ok: true };
  },

  // Super admin only. Loads the transcribed sample weeks as DRAFTS. Never overwrites a week that has data.
  async seedSample(req, res, store) {
    requireSuper(req);
    const cfg = await loadConfig(store);
    let added = 0;
    for (const s of SAMPLES) {
      const outlet = cfg.outlets.find((o) => o.id === s.outlet);
      if (!outlet) continue;
      for (const dept of outlet.departments) {
        const sample = s.data[dept.id];
        if (!sample) continue;
        const key = rosterKey(outlet.id, dept.id, s.week);
        if (await store.get(key)) continue;
        const rows = {};
        const covers = (dept.covers || []).map((c) => c.code);
        for (const st of dept.staff) {
          rows[st.id] = (sample[st.id] || Array(7).fill('')).map((v) => {
            const { base, cover } = splitVal(v);
            return dept.posts.includes(base) && (!cover || covers.includes(cover)) ? v : '';
          });
        }
        await store.set(key, { status: 'draft', rows, updatedAt: Date.now(), publishedAt: null });
        added++;
      }
    }
    return { added };
  },
};

const METHODS = {
  health: 'GET', meta: 'GET', roster: 'GET', config: 'GET',
  login: 'POST', saveRoster: 'POST', saveConfig: 'POST', addDepartment: 'POST',
  setPassword: 'POST', setSupervisorPassword: 'POST', seedSample: 'POST',
};

function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { fail(400, 'Bad request body.'); } }
  return b;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
  try {
    const name = req.query && req.query.action;
    if (!Object.prototype.hasOwnProperty.call(actions, name)) fail(404, 'Not found.');
    if (req.method !== METHODS[name]) fail(405, 'Method not allowed.');
    const body = req.method === 'POST' ? parseBody(req) : {};
    const out = await actions[name](req, res, getStore(), body);
    send(200, out);
  } catch (e) {
    if (e instanceof HttpError || (e && e.status && /^Server is not set up/.test(e.message))) return send(e.status, { error: e.message });
    console.error(e);
    send(500, { error: 'Something went wrong on the server.' });
  }
};
