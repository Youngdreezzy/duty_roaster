const crypto = require("crypto");
const { Redis } = require("@upstash/redis");
const config = require("./_config");

// Works with Upstash's own variable names and the ones Vercel's integration adds.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function getBody(req) {
  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch (e) {
      b = {};
    }
  }
  return b && typeof b === "object" ? b : {};
}

function getIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (fwd ? String(fwd).split(",")[0].trim() : "") || "unknown";
}

const isStr = (x, max) => typeof x === "string" && x.length > 0 && x.length <= max;

// Slow down password guessing: 10 wrong tries per IP per 10 minutes.
async function isBlocked(ip) {
  const n = await redis.get("fail:" + ip);
  return Number(n || 0) >= 10;
}
async function recordFail(ip) {
  const key = "fail:" + ip;
  const c = await redis.incr(key);
  if (c === 1) await redis.expire(key, 600);
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 32).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(pw, stored) {
  if (typeof stored !== "string" || stored.indexOf(":") < 0) return false;
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(String(pw), salt, 32);
  const real = Buffer.from(hash, "hex");
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

function validOutletDept(outlet, dept) {
  return (
    typeof outlet === "string" &&
    typeof dept === "string" &&
    has(config.outlets, outlet) &&
    has(config.outlets[outlet], dept)
  );
}

// A roster week is identified by its Monday, written YYYY-MM-DD.
function validWeek(w) {
  if (typeof w !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(w)) return false;
  const d = new Date(w + "T00:00:00Z");
  return !isNaN(d) && d.getUTCDay() === 1;
}

const keys = {
  staff: (o, d) => `staff:${o}:${d}`,
  roster: (o, d, w) => `roster:${o}:${d}:${w}`,
  pass: (o, d) => `deptpass:${o}:${d}`,
};

async function getStaff(outlet, dept) {
  const stored = await redis.get(keys.staff(outlet, dept));
  return Array.isArray(stored) ? stored : config.outlets[outlet][dept].staff;
}

module.exports = {
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
  verifyPassword,
  validOutletDept,
  validWeek,
  keys,
  getStaff,
};
