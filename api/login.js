'use strict';
// POST /api/login
//   staff:      { role:'staff', outlet, dept, password }
//   supervisor: { role:'admin', password }
const {
  HttpError, wrap, getConfig, findDept, checkPassword, safeEqual, signToken,
  assertNotLocked, recordFailure,
} = require('../lib/store');

const HOUR = 3600 * 1000;

module.exports = wrap(['POST'], async (req, res) => {
  const { role, outlet, dept, password } = req.body || {};
  if (typeof password !== 'string' || !password) throw new HttpError(400, 'Enter the password.');
  await assertNotLocked(req);

  if (role === 'admin') {
    const real = process.env.ADMIN_PASSWORD;
    if (!real) throw new HttpError(500, 'ADMIN_PASSWORD is not set in the server environment.');
    if (!safeEqual(password, real)) {
      await recordFailure(req);
      throw new HttpError(401, 'Wrong supervisor password.');
    }
    return res.status(200).json({ token: signToken({ r: 'a', exp: Date.now() + 12 * HOUR }) });
  }

  if (role === 'staff') {
    const cfg = await getConfig();
    const d = findDept(cfg, outlet, dept);
    if (!d) throw new HttpError(400, 'Choose your outlet and department.');
    if (!d.pass) throw new HttpError(403, 'No password has been set for this department yet. Ask your supervisor.');
    if (!(await checkPassword(password, d.pass))) {
      await recordFailure(req);
      throw new HttpError(401, 'Wrong password for this department.');
    }
    const token = signToken({ r: 's', o: outlet, d: dept, pv: d.pv || 0, exp: Date.now() + 30 * 24 * HOUR });
    return res.status(200).json({ token });
  }

  throw new HttpError(400, 'Unknown login type.');
});
