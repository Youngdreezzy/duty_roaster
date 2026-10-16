// Storage layer. Uses Upstash Redis when its env vars are present,
// otherwise an in-memory store (for local testing only; data is lost on restart).

function redisCreds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function memoryStore() {
  const data = new Map();
  const expiry = new Map();
  const alive = (k) => {
    const e = expiry.get(k);
    if (e && e < Date.now()) { data.delete(k); expiry.delete(k); return false; }
    return data.has(k);
  };
  return {
    kind: 'memory',
    async get(k) { return alive(k) ? JSON.parse(data.get(k)) : null; },
    async set(k, v) { data.set(k, JSON.stringify(v)); },
    async del(k) { data.delete(k); expiry.delete(k); },
    async incr(k) {
      const n = (alive(k) ? JSON.parse(data.get(k)) : 0) + 1;
      data.set(k, JSON.stringify(n));
      return n;
    },
    async expire(k, sec) { expiry.set(k, Date.now() + sec * 1000); },
  };
}

function upstashStore(creds) {
  const { Redis } = require('@upstash/redis');
  const r = new Redis(creds);
  return {
    kind: 'upstash',
    get: (k) => r.get(k),
    set: (k, v) => r.set(k, v),
    del: (k) => r.del(k),
    incr: (k) => r.incr(k),
    expire: (k, sec) => r.expire(k, sec),
  };
}

let instance;
module.exports = function getStore() {
  if (!instance) {
    const creds = redisCreds();
    instance = creds ? upstashStore(creds) : memoryStore();
  }
  return instance;
};
