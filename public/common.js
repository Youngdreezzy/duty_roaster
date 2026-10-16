/* Shared helpers for the staff page and the supervisor page */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HUES = [152, 24, 212, 282, 46, 340, 180, 96, 246, 8, 316, 66];

const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---- dates (all Monday-based, strings like 2026-10-12) ---- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return ymd(d);
}
function dayNum(dateStr) { return Number(dateStr.slice(8)); }
function weekLabel(w) {
  const a = new Date(w + 'T00:00:00Z'), b = new Date(addDays(w, 6) + 'T00:00:00Z');
  const f = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${f(a)} – ${f(b)} ${b.getUTCFullYear()}`;
}
function stamp(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---- duty-post colours ---- */
const isOff = (v) => /^off$/i.test(String(v || '').trim());
function hueFor(post, posts) {
  const list = posts.filter((p) => !isOff(p));
  const i = list.indexOf(post);
  return HUES[(i < 0 ? 0 : i) % HUES.length];
}
function chipHtml(value, posts) {
  if (!value) return '<span class="chip empty">–</span>';
  if (isOff(value)) return `<span class="chip off">${esc(value)}</span>`;
  return `<span class="chip" style="--h:${hueFor(value, posts)}">${esc(value)}</span>`;
}

/* ---- safe browser storage ---- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ---- API ---- */
async function api(action, { method = 'GET', body, query, token } = {}) {
  const qs = query ? '?' + new URLSearchParams(query) : '';
  const res = await fetch(`/api/${action}${qs}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* not json */ }
  if (!res.ok) {
    const e = new Error(data.error || 'Request failed (' + res.status + ')');
    e.status = res.status;
    throw e;
  }
  return data;
}

/* ---- toast ---- */
let toastTimer;
function toast(msg, bad) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 5000 : 2600);
}
