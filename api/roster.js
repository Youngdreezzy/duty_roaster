'use strict';
// GET /api/roster?outlet=&dept=&week=YYYY-MM-DD   (staff: published only; supervisor: draft or published)
// PUT /api/roster  { outlet, dept, week, cells:{ staffId:[7 posts] }, status:'draft'|'published' }  (supervisor only)
const {
  HttpError, wrap, getConfig, findDept, getJSON, setJSON, rosterKey, validWeek,
  requireAdmin, requireStaffOrAdmin,
} = require('../lib/store');

module.exports = wrap(['GET', 'PUT'], async (req, res) => {
  const cfg = await getConfig();

  if (req.method === 'GET') {
    const { outlet, dept, week } = req.query;
    const d = findDept(cfg, outlet, dept);
    if (!d) throw new HttpError(404, 'Department not found.');
    if (!validWeek(week)) throw new HttpError(400, 'Week must be a Monday date (YYYY-MM-DD).');
    const who = requireStaffOrAdmin(req, cfg, outlet, dept);

    const saved = await getJSON(rosterKey(outlet, dept, week));
    const base = { staff: d.staff, posts: d.posts, week };
    if (!saved) return res.status(200).json({ ...base, status: 'none', cells: {} });
    if (saved.status !== 'published' && who.r !== 'a') {
      return res.status(200).json({ ...base, status: 'none', cells: {} }); // drafts stay hidden from staff
    }
    return res.status(200).json({ ...base, status: saved.status, cells: saved.cells, updatedAt: saved.updatedAt });
  }

  // PUT
  requireAdmin(req);
  const { outlet, dept, week, cells, status } = req.body || {};
  const d = findDept(cfg, outlet, dept);
  if (!d) throw new HttpError(404, 'Department not found.');
  if (!validWeek(week)) throw new HttpError(400, 'Week must be a Monday date (YYYY-MM-DD).');
  if (status !== 'draft' && status !== 'published') throw new HttpError(400, 'Status must be draft or published.');
  if (!cells || typeof cells !== 'object') throw new HttpError(400, 'Missing roster cells.');

  const clean = {};
  for (const s of d.staff) {
    const row = Array.isArray(cells[s.id]) ? cells[s.id] : [];
    clean[s.id] = Array.from({ length: 7 }, (_, i) => {
      const v = row[i];
      return typeof v === 'string' ? v.trim().slice(0, 40) : '';
    });
  }
  const record = { status, cells: clean, updatedAt: new Date().toISOString() };
  await setJSON(rosterKey(outlet, dept, week), record);
  res.status(200).json({ status, cells: clean, updatedAt: record.updatedAt });
});
