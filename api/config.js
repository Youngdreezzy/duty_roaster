'use strict';
// Supervisor only.
// GET  /api/config   -> outlets, departments, posts, staff (no password hashes)
// POST /api/config   { action, ... }
//   saveDept     { outlet, dept, name, posts:[{name,min}], staff:[{id?,name}] }
//   setPassword  { outlet, dept, password }
//   addOutlet    { name }
//   addDept      { outlet, name }
//   deleteDept   { outlet, dept }
//   deleteOutlet { outlet }
const {
  HttpError, wrap, requireAdmin, getConfig, saveConfig, findOutlet, findDept,
  adminView, hashPassword, slug,
} = require('../lib/store');

const cleanName = (v, label) => {
  const s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
  if (!s) throw new HttpError(400, label + ' cannot be empty.');
  if (s.length > 40) throw new HttpError(400, label + ' is too long (max 40 characters).');
  return s;
};

function normalizePosts(list) {
  if (!Array.isArray(list) || !list.length) throw new HttpError(400, 'Add at least one duty post.');
  if (list.length > 30) throw new HttpError(400, 'Too many duty posts (max 30).');
  const seen = new Set();
  return list.map((p) => {
    const name = cleanName(p && p.name, 'Duty post name');
    if (seen.has(name.toLowerCase())) throw new HttpError(400, `Duty post "${name}" is listed twice.`);
    seen.add(name.toLowerCase());
    const min = Math.max(0, Math.min(50, parseInt(p && p.min, 10) || 0));
    return { name, min };
  });
}

function normalizeStaff(list, existing) {
  if (!Array.isArray(list)) throw new HttpError(400, 'Invalid staff list.');
  if (list.length > 80) throw new HttpError(400, 'Too many staff (max 80).');
  const known = new Set(existing.map((s) => s.id));
  const used = [];
  return list.map((s) => {
    const name = cleanName(s && s.name, 'Staff name');
    let id = s && typeof s.id === 'string' && known.has(s.id) && !used.includes(s.id) ? s.id : null;
    if (!id) id = 'p' + slug(name, used.concat([...known])) + '-' + Math.random().toString(36).slice(2, 6);
    used.push(id);
    return { id, name };
  });
}

module.exports = wrap(['GET', 'POST'], async (req, res) => {
  requireAdmin(req);
  const cfg = await getConfig();

  if (req.method === 'GET') return res.status(200).json(adminView(cfg));

  const b = req.body || {};
  switch (b.action) {
    case 'saveDept': {
      const d = findDept(cfg, b.outlet, b.dept);
      if (!d) throw new HttpError(404, 'Department not found.');
      d.name = cleanName(b.name, 'Department name');
      d.posts = normalizePosts(b.posts);
      d.staff = normalizeStaff(b.staff, d.staff);
      break;
    }
    case 'setPassword': {
      const d = findDept(cfg, b.outlet, b.dept);
      if (!d) throw new HttpError(404, 'Department not found.');
      const pw = String(b.password || '');
      if (pw.length < 4) throw new HttpError(400, 'Password must be at least 4 characters.');
      d.pass = await hashPassword(pw);
      d.pv = (d.pv || 0) + 1; // logs out everyone who used the old password
      break;
    }
    case 'addOutlet': {
      const name = cleanName(b.name, 'Outlet name');
      cfg.outlets.push({ id: slug(name, cfg.outlets.map((o) => o.id)), name, departments: [] });
      break;
    }
    case 'addDept': {
      const o = findOutlet(cfg, b.outlet);
      if (!o) throw new HttpError(404, 'Outlet not found.');
      const name = cleanName(b.name, 'Department name');
      o.departments.push({
        id: slug(name, o.departments.map((d) => d.id)), name, pass: null, pv: 0,
        posts: [{ name: 'ON', min: 0 }, { name: 'OFF', min: 0 }], staff: [],
      });
      break;
    }
    case 'deleteDept': {
      const o = findOutlet(cfg, b.outlet);
      if (!o || !findDept(cfg, b.outlet, b.dept)) throw new HttpError(404, 'Department not found.');
      o.departments = o.departments.filter((d) => d.id !== b.dept);
      break;
    }
    case 'deleteOutlet': {
      if (!findOutlet(cfg, b.outlet)) throw new HttpError(404, 'Outlet not found.');
      cfg.outlets = cfg.outlets.filter((o) => o.id !== b.outlet);
      break;
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }

  await saveConfig(cfg);
  res.status(200).json(adminView(cfg));
});
