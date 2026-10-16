const {
  redis,
  send,
  getBody,
  getIp,
  isBlocked,
  recordFail,
  verifyPassword,
  validOutletDept,
  validWeek,
  keys,
} = require("./_lib");

// Staff view: needs the department's shared password. Only published rosters are shown.
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  const b = getBody(req);
  const ip = getIp(req);

  if (await isBlocked(ip)) {
    return send(res, 429, { error: "Too many wrong attempts. Try again in 10 minutes." });
  }
  if (!validOutletDept(b.outlet, b.dept)) {
    return send(res, 400, { error: "Unknown outlet or department." });
  }
  if (!validWeek(b.week)) {
    return send(res, 400, { error: "Invalid week." });
  }

  const stored = await redis.get(keys.pass(b.outlet, b.dept));
  if (!stored) {
    return send(res, 403, {
      error: "The password for this department has not been set yet. Please ask your supervisor.",
    });
  }
  if (typeof b.password !== "string" || !verifyPassword(b.password, stored)) {
    await recordFail(ip);
    return send(res, 401, { error: "Wrong password." });
  }

  const roster = await redis.get(keys.roster(b.outlet, b.dept, b.week));
  if (!roster || !roster.published) return send(res, 200, { published: false });
  send(res, 200, { published: true, rows: roster.rows, updatedAt: roster.updatedAt });
};
