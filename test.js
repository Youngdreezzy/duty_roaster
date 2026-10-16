// End-to-end check against the local dev server (in-memory store). Run: node test.js
const { spawn } = require('child_process');
const PORT = 3123, BASE = 'http://localhost:' + PORT;
const srv = spawn('node', ['dev.js'], { env: { ...process.env, PORT } });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (action, { method = 'GET', body, query, token, ip } = {}) => {
  const qs = query ? '?' + new URLSearchParams(query) : '';
  const r = await fetch(`${BASE}/api/${action}${qs}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};
(async () => {
  await new Promise((r) => setTimeout(r, 800));
  const meta = await call('meta');
  ok(meta.data.outlets[0].departments.length === 3, 'meta lists 3 departments');
  ok(!JSON.stringify(meta.data).includes('Feyikemi'), 'meta does not leak staff names');

  let r = await call('login', { method: 'POST', body: { role: 'staff', outlet: 'vibes', dept: 'waitress', password: 'x' } });
  ok(r.status === 403, 'staff login blocked until a password is set');
  r = await call('login', { method: 'POST', body: { role: 'admin', password: 'wrong' }, ip: '1.1.1.1' });
  ok(r.status === 401, 'wrong admin password rejected');
  r = await call('login', { method: 'POST', body: { role: 'admin', password: 'admin123' } });
  ok(r.status === 200 && r.data.token, 'admin login works');
  const admin = r.data.token;

  r = await call('config', { token: admin });
  ok(r.data.outlets[0].departments[0].staff.length === 14, 'config has 14 waitresses');
  r = await call('setPassword', { method: 'POST', token: admin, body: { outlet: 'vibes', dept: 'waitress', password: 'garden1' } });
  ok(r.status === 200, 'department password set');
  await call('setPassword', { method: 'POST', token: admin, body: { outlet: 'vibes', dept: 'kitchen', password: 'kitchen1' } });

  r = await call('login', { method: 'POST', body: { role: 'staff', outlet: 'vibes', dept: 'waitress', password: 'nope' }, ip: '2.2.2.2' });
  ok(r.status === 401, 'wrong staff password rejected');
  r = await call('login', { method: 'POST', body: { role: 'staff', outlet: 'vibes', dept: 'waitress', password: 'garden1' } });
  ok(r.status === 200, 'staff login works');
  const staff = r.data.token;
  r = await call('login', { method: 'POST', body: { role: 'staff', outlet: 'vibes', dept: 'kitchen', password: 'kitchen1' } });
  const kitchen = r.data.token;

  r = await call('seedSample', { method: 'POST', token: admin });
  ok(r.data.added === 3, 'sample week loaded as drafts');
  r = await call('roster', { token: staff, query: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12' } });
  ok(r.status === 200 && r.data.roster === null, 'staff cannot see a draft');
  r = await call('roster', { token: admin, query: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12' } });
  ok(r.data.roster && r.data.roster.status === 'draft' && r.data.roster.rows.w1[0] === 'Apt', 'admin sees the draft');

  const rows = r.data.roster.rows;
  r = await call('saveRoster', { method: 'POST', token: admin, body: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12', status: 'published', rows } });
  ok(r.status === 200 && r.data.roster.status === 'published', 'publish works');
  r = await call('roster', { token: staff, query: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12' } });
  ok(r.data.roster && r.data.roster.rows.w6[0] === 'VIP', 'staff see the published roster');
  r = await call('roster', { token: kitchen, query: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12' } });
  ok(r.status === 403, 'kitchen password cannot open waitress roster');
  r = await call('roster', { query: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12' } });
  ok(r.status === 401, 'no token is rejected');
  r = await call('saveRoster', { method: 'POST', token: staff, body: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12', status: 'published', rows } });
  ok(r.status === 401, 'staff token cannot edit the roster');
  r = await call('config', { token: staff });
  ok(r.status === 401, 'staff token cannot read settings');

  rows.w1[0] = 'Hacker';
  r = await call('saveRoster', { method: 'POST', token: admin, body: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12', status: 'draft', rows } });
  ok(r.status === 400, 'unknown duty post rejected');
  r = await call('saveRoster', { method: 'POST', token: admin, body: { outlet: 'vibes', dept: 'waitress', week: '2026-10-13', status: 'draft', rows: {} } });
  ok(r.status === 400, 'non-Monday week rejected');

  r = await call('saveConfig', { method: 'POST', token: admin, body: { outlet: 'vibes', departments: [{ id: 'kitchen', posts: ['ON', 'OFF', 'Split'], staff: [{ id: 'k1', name: 'Esther' }, { id: 'nabc', name: '  New   Cook ' }] }] } });
  ok(r.status === 200, 'staff and posts can be edited');
  r = await call('config', { token: admin });
  const k = r.data.outlets[0].departments.find((d) => d.id === 'kitchen');
  ok(k.staff.length === 2 && k.staff[1].name === 'New Cook' && k.posts.includes('Split'), 'edits were stored and cleaned');

  for (let i = 0; i < 10; i++) await call('login', { method: 'POST', body: { role: 'admin', password: 'bad' }, ip: '9.9.9.9' });
  r = await call('login', { method: 'POST', body: { role: 'admin', password: 'admin123' }, ip: '9.9.9.9' });
  ok(r.status === 429, 'login locked after 10 wrong tries from one address');

  srv.kill();
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
