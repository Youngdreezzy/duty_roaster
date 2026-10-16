const crypto = require('crypto');

const TOKEN_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    const e = new Error('Server is not set up yet: SESSION_SECRET is missing (see README).');
    e.status = 500;
    throw e;
  }
  return s;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function sign(payload) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_DAYS * 864e5 }));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function verify(token) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

function tokenFrom(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function checkPassword(pw, stored) {
  if (typeof stored !== 'string') return false;
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(pw), salt, 32);
  const want = Buffer.from(hash, 'hex');
  return want.length === test.length && crypto.timingSafeEqual(want, test);
}

// Compare against an env-var password without leaking length/timing.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { sign, verify, tokenFrom, hashPassword, checkPassword, safeEqual };
