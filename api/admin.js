const {
  redis,
  config,
  send,
  getBody,
  getIp,
  isStr,
  isBlocked,
  recordFail,
  safeEqual,
  hashPassword,
  validOutletDept,
  validWeek,
  keys,
  getStaff,
} = require("./_lib");

// Supervisor actions. Every call must carry the supervisor password
// (the ADMIN_PASSWORD environment variable on Vercel).
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  const b = getBody(req);
  const ip = getIp(req);

  if (await isBlocked(ip)) {
    return send(res, 429, { error: "Too many wrong attempts. Try again in 10 minutes." });
  }
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) {
    return send(res, 500, { error: "ADMIN_PASSWORD is not set on the server." });
  }
  if (!isStr(b.adminPassword, 200) || !safeEqual(b.adminPassword, adminPw)) {
    await recordFail(ip);
    return send(res, 401, { error: "Wrong supervisor password." });
  }

  if (b.action === "login") return send(res, 200, { ok: true });

  if (!validOutletDept(b.outlet, b.dept)) {
    return send(res, 400, { error: "Unknown outlet or department." });
  }
  const { outlet, dept } = b;
  const posts = config.outlets[outlet][dept].posts;

  switch (b.action) {
    case "getRoster": {
      if (!validWeek(b.week)) return send(res, 400, { error: "Invalid week." });
      const roster = await redis.get(keys.roster(outlet, dept, b.week));
      const staff = await getStaff(outlet, dept);
      const passwordSet = !!(await redis.get(keys.pass(outlet, dept)));
      return send(res, 200, { roster: roster || null, staff, passwordSet });
    }

    case "saveRoster": {
      if (!validWeek(b.week)) return send(res, 400, { error: "Invalid week." });
      if (!Array.isArray(b.rows) || b.rows.length > 100) {
        return send(res, 400, { error: "Invalid roster rows." });
      }
      const rows = [];
      for (const r of b.rows) {
        if (!r || !isStr(r.name, 60) || !Array.isArray(r.days) || r.days.length !== 7) {
          return send(res, 400, { error: "Invalid roster row." });
        }
        for (const d of r.days) {
          if (d !== "" && !posts.includes(d)) {
            return send(res, 400, { error: `"${d}" is not a duty post for ${dept}.` });
          }
        }
        rows.push({ name: r.name, days: r.days });
      }
      const roster = { published: !!b.published, rows, updatedAt: new Date().toISOString() };
      await redis.set(keys.roster(outlet, dept, b.week), roster);
      return send(res, 200, { ok: true, updatedAt: roster.updatedAt });
    }

    case "saveStaff": {
      if (!Array.isArray(b.names) || b.names.length > 100) {
        return send(res, 400, { error: "Invalid staff list." });
      }
      const seen = new Set();
      const names = [];
      for (const n of b.names) {
        const name = typeof n === "string" ? n.trim() : "";
        if (!name) continue;
        if (name.length > 60) return send(res, 400, { error: "A name is too long." });
        const k = name.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        names.push(name);
      }
      if (!names.length) return send(res, 400, { error: "Add at least one name." });
      await redis.set(keys.staff(outlet, dept), names);
      return send(res, 200, { ok: true, staff: names });
    }

    case "setDeptPassword": {
      if (!isStr(b.newPassword, 100) || b.newPassword.length < 4) {
        return send(res, 400, { error: "The password must be at least 4 characters." });
      }
      await redis.set(keys.pass(outlet, dept), hashPassword(b.newPassword));
      return send(res, 200, { ok: true });
    }

    default:
      return send(res, 400, { error: "Unknown action." });
  }
};
