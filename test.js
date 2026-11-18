// End-to-end check against the local dev server (in-memory store). Run: node test.js
const { spawn } = require('child_process');
const PORT = 3123, BASE = 'http://localhost:' + PORT;
const srv = spawn('node', ['dev.js'], { env: { ...process.env, PORT } });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (action, { method = 'GET', body, query, token, ip } = {}) => {
  const qs = query ? '?' + new URLSearchParams(query) : '';
  const r = await fetch(`${BASE}/api/${action}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const post = (action, token, body) => call(action, { method: 'POST', token, body });

(async () => {
  await new Promise((r) => setTimeout(r, 800));

  let r = await call('health');
  ok(r.status === 200 && r.data.database === 'memory' && r.data.ready === false, 'health reports set-up state');
  r = await call('meta');
  ok(r.data.outlets.length === 2 && r.data.outlets[1].id === 'hotel', 'meta lists Vibes Lounge and Hotel');
  ok(r.data.outlets[1].departments.map((d) => d.id).join() === 'restaurant,karaoke,pool', 'hotel has Restaurant, Karaoke Bar, Pool Bar');
  ok(!JSON.stringify(r.data).includes('Mubat'), 'meta does not leak staff names');

  // --- super admin
  r = await call('login', { method: 'POST', body: { role: 'admin', password: 'wrong' }, ip: '1.1.1.1' });
  ok(r.status === 401, 'wrong super admin password rejected');
  r = await post('login', null, { role: 'admin', password: 'admin123' });
  ok(r.status === 200, 'super admin login works');
  const admin = r.data.token;
  r = await call('config', { token: admin });
  ok(r.data.role === 'admin' && r.data.outlets.length === 2, 'super admin sees both outlets');

  // --- supervisor passwords
  r = await post('login', null, { role: 'supervisor', outlet: 'hotel', password: 'x' });
  ok(r.status === 403, 'hotel supervisor cannot log in before a password is set');
  r = await post('setSupervisorPassword', admin, { outlet: 'hotel', password: 'abc' });
  ok(r.status === 400, 'short supervisor password rejected');
  ok((await post('setSupervisorPassword', admin, { outlet: 'hotel', password: 'hotel-sup-1' })).status === 200, 'hotel supervisor password set');
  ok((await post('setSupervisorPassword', admin, { outlet: 'vibes', password: 'vibes-sup-1' })).status === 200, 'vibes supervisor password set');
  r = await post('login', null, { role: 'supervisor', outlet: 'hotel', password: 'vibes-sup-1' });
  ok(r.status === 401, "Vibes supervisor password does not open Hotel");
  r = await post('login', null, { role: 'supervisor', outlet: 'hotel', password: 'hotel-sup-1' });
  ok(r.status === 200 && r.data.outlet === 'hotel', 'hotel supervisor login works');
  const hotelSup = r.data.token;
  r = await post('login', null, { role: 'supervisor', outlet: 'vibes', password: 'vibes-sup-1' });
  const vibesSup = r.data.token;

  // --- scoping
  r = await call('config', { token: hotelSup });
  ok(r.data.role === 'supervisor' && r.data.outlets.length === 1 && r.data.outlets[0].id === 'hotel', 'hotel supervisor sees only Hotel settings');
  r = await call('roster', { token: hotelSup, query: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12' } });
  ok(r.status === 403, 'hotel supervisor cannot read Vibes roster');
  r = await post('saveRoster', hotelSup, { outlet: 'vibes', dept: 'waitress', week: '2026-10-12', status: 'draft', rows: {} });
  ok(r.status === 403, 'hotel supervisor cannot save a Vibes roster');
  r = await post('setSupervisorPassword', hotelSup, { outlet: 'hotel', password: 'new-password' });
  ok(r.status === 403, 'supervisor cannot change supervisor passwords');
  r = await post('addDepartment', hotelSup, { outlet: 'hotel', name: 'Bar' });
  ok(r.status === 403, 'supervisor cannot add departments');
  r = await post('seedSample', hotelSup);
  ok(r.status === 403, 'supervisor cannot load sample data');
  r = await post('setPassword', vibesSup, { outlet: 'hotel', dept: 'pool', password: 'pool-pass' });
  ok(r.status === 403, 'Vibes supervisor cannot set a Hotel staff password');

  // --- hotel set-up by hotel supervisor
  for (const [d, pw] of [['restaurant', 'rest-pass'], ['karaoke', 'kara-pass'], ['pool', 'pool-pass']]) {
    ok((await post('setPassword', hotelSup, { outlet: 'hotel', dept: d, password: pw })).status === 200, `hotel supervisor sets ${d} staff password`);
  }
  ok((await post('setPassword', admin, { outlet: 'vibes', dept: 'waitress', password: 'garden1' })).status === 200, 'vibes waitress password set');

  // --- samples
  r = await post('seedSample', admin);
  ok(r.data.added === 6, 'sample weeks loaded for both outlets (3 + 3 drafts)');
  r = await post('seedSample', admin);
  ok(r.data.added === 0, 'sample is never loaded twice');
  r = await call('roster', { token: hotelSup, query: { outlet: 'hotel', dept: 'restaurant', week: '2026-11-16' } });
  const rows = r.data.roster.rows;
  ok(rows.r4[0] === 'M@AB' && rows.r6[2] === 'N@PB' && rows.r1[0] === 'OFF', 'hotel sample keeps the cover codes');
  ok(r.data.dept.covers.length === 4, 'restaurant has four cover places');

  // --- cover validation
  const bad = (v) => { const x = JSON.parse(JSON.stringify(rows)); x.r1[1] = v; return post('saveRoster', hotelSup, { outlet: 'hotel', dept: 'restaurant', week: '2026-11-16', status: 'draft', rows: x }); };
  ok((await bad('M@XX')).status === 400, 'unknown cover place rejected');
  ok((await bad('OFF@PB')).status === 400, 'a day off cannot have a cover place');
  ok((await bad('Z')).status === 400, 'unknown shift rejected');
  r = await post('saveRoster', hotelSup, { outlet: 'hotel', dept: 'restaurant', week: '2026-11-16', status: 'published', rows });
  ok(r.status === 200, 'hotel supervisor publishes the restaurant roster');

  // --- staff
  r = await post('login', null, { role: 'staff', outlet: 'hotel', dept: 'restaurant', password: 'garden1' });
  ok(r.status === 401, 'Vibes waitress password does not open Hotel Restaurant');
  r = await post('login', null, { role: 'staff', outlet: 'hotel', dept: 'restaurant', password: 'rest-pass' });
  ok(r.status === 200, 'hotel restaurant staff login works');
  const rest = r.data.token;
  r = await call('roster', { token: rest, query: { outlet: 'hotel', dept: 'restaurant', week: '2026-11-16' } });
  ok(r.data.roster && r.data.roster.rows.r6[0] === 'N@KB', 'staff see the published hotel roster');
  r = await call('roster', { token: rest, query: { outlet: 'hotel', dept: 'karaoke', week: '2026-11-16' } });
  ok(r.status === 403, 'restaurant staff cannot open Karaoke Bar');
  r = await call('roster', { token: rest, query: { outlet: 'vibes', dept: 'waitress', week: '2026-10-12' } });
  ok(r.status === 403, 'hotel staff cannot open Vibes Lounge');
  r = await call('config', { token: rest });
  ok(r.status === 403, 'staff cannot read settings');
  r = await post('saveRoster', rest, { outlet: 'hotel', dept: 'restaurant', week: '2026-11-16', status: 'draft', rows });
  ok(r.status === 403, 'staff cannot edit the roster');
  r = await call('roster', { token: (await post('login', null, { role: 'staff', outlet: 'hotel', dept: 'karaoke', password: 'kara-pass' })).data.token, query: { outlet: 'hotel', dept: 'karaoke', week: '2026-11-16' } });
  ok(r.data.roster === null, 'a draft is hidden from staff');

  // --- add department, edit settings
  r = await post('addDepartment', admin, { outlet: 'hotel', name: 'Room Service' });
  ok(r.status === 200 && r.data.id === 'room-service', 'super admin adds a department');
  ok((await post('addDepartment', admin, { outlet: 'hotel', name: 'room service' })).status === 400, 'duplicate department name rejected');
  r = await post('saveConfig', hotelSup, {
    outlet: 'hotel',
    departments: [{ id: 'room-service', posts: ['M', 'N', 'OFF'], covers: ['rst = Restaurant', 'PB'], note: ' Short  note ', staff: [{ id: 'nabc', name: '  New   Waiter ' }] }],
  });
  ok(r.status === 200, 'hotel supervisor edits staff, posts and covers');
  r = await call('config', { token: hotelSup });
  const rs = r.data.outlets[0].departments.find((d) => d.id === 'room-service');
  ok(rs.staff[0].name === 'New Waiter' && rs.covers[0].code === 'RST' && rs.covers[1].name === 'PB' && rs.note === 'Short note', 'edits stored and cleaned');
  ok(r.data.outlets[0].departments.length === 4, 'new department appears for the hotel supervisor');
  r = await post('saveConfig', hotelSup, { outlet: 'hotel', departments: [{ id: 'room-service', posts: ['M'], covers: ['TOOLONGCODE'], staff: [] }] });
  ok(r.status === 400, 'bad cover code rejected');

  // --- lock-out
  for (let i = 0; i < 10; i++) await call('login', { method: 'POST', body: { role: 'supervisor', outlet: 'hotel', password: 'bad' }, ip: '9.9.9.9' });
  r = await call('login', { method: 'POST', body: { role: 'admin', password: 'admin123' }, ip: '9.9.9.9' });
  ok(r.status === 429, 'login locked after 10 wrong tries from one address');

  srv.kill();
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
