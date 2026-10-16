/* Staff page: log in with the department password, then view the roster (read-only) */
const S = { meta: null, session: null, week: mondayOf(todayStr()), data: null, me: '' };
const SESSION_KEY = 'roster.session';

function fillSelect(sel, items, selected) {
  sel.innerHTML = items.map((i) => `<option value="${esc(i.id)}"${i.id === selected ? ' selected' : ''}>${esc(i.name)}</option>`).join('');
}

function showLogin(message) {
  $('#rosterView').hidden = true;
  $('#loginView').hidden = false;
  $('#logout').hidden = true;
  $('#adminlink').hidden = false;
  $('#subtitle').textContent = 'Staff schedule';
  $('#loginErr').textContent = message || '';
}

function fillDepts() {
  const outlet = S.meta.outlets.find((o) => o.id === $('#outlet').value) || S.meta.outlets[0];
  fillSelect($('#dept'), outlet.departments);
}

async function init() {
  try {
    S.meta = await api('meta');
  } catch (e) {
    $('#loginErr').textContent = 'Could not load. Check your internet connection and refresh.';
    return;
  }
  fillSelect($('#outlet'), S.meta.outlets);
  $('#outletField').hidden = S.meta.outlets.length < 2;
  fillDepts();
  $('#outlet').addEventListener('change', fillDepts);

  const saved = store.get(SESSION_KEY);
  if (saved) {
    try { S.session = JSON.parse(saved); } catch { S.session = null; }
    if (S.session && S.session.token) {
      try { await loadRoster(); return; } catch { /* fall through to login */ }
    }
    store.del(SESSION_KEY);
    S.session = null;
  }
  showLogin();
}

$('#loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  $('#loginErr').textContent = '';
  try {
    const r = await api('login', {
      method: 'POST',
      body: { role: 'staff', outlet: $('#outlet').value, dept: $('#dept').value, password: $('#password').value },
    });
    S.session = { token: r.token, outlet: r.outlet, dept: r.dept };
    store.set(SESSION_KEY, JSON.stringify(S.session));
    $('#password').value = '';
    S.week = mondayOf(todayStr());
    await loadRoster();
  } catch (e) {
    $('#loginErr').textContent = e.message;
  } finally {
    btn.disabled = false;
  }
});

async function loadRoster() {
  const { token, outlet, dept } = S.session;
  let r;
  try {
    r = await api('roster', { token, query: { outlet, dept, week: S.week } });
  } catch (e) {
    if (e.status === 401 || e.status === 403) { store.del(SESSION_KEY); S.session = null; showLogin('Please log in again.'); }
    throw e;
  }
  S.data = r;
  S.me = store.get(`roster.me.${outlet}.${dept}`) || '';
  if (!r.dept.staff.some((s) => s.id === S.me)) S.me = '';
  render();
}

function render() {
  const { outlet: outletName, dept, roster } = S.data;
  $('#loginView').hidden = true;
  $('#rosterView').hidden = false;
  $('#logout').hidden = false;
  $('#adminlink').hidden = true;
  $('#subtitle').textContent = outletName;
  $('#weekLabel').textContent = weekLabel(S.week);
  $('#deptName').textContent = `${outletName} · ${dept.name}`;
  $('#printTitle').textContent = `${outletName} · ${dept.name} · ${weekLabel(S.week)}`;
  $('#updated').textContent = roster ? `Updated ${stamp(roster.publishedAt || roster.updatedAt)}` : '';

  const me = $('#me');
  me.innerHTML = '<option value="">– pick your name –</option>' +
    dept.staff.map((s) => `<option value="${esc(s.id)}"${s.id === S.me ? ' selected' : ''}>${esc(s.name)}</option>`).join('');

  renderMyWeek();
  renderTable();
}

function renderMyWeek() {
  const box = $('#myweek');
  const { dept, roster } = S.data;
  const person = dept.staff.find((s) => s.id === S.me);
  if (!person || !roster) { box.hidden = true; return; }
  box.hidden = false;
  $('#myweekTitle').textContent = `${person.name}'s week`;
  const row = roster.rows[person.id] || [];
  const today = todayStr();
  $('#myDays').innerHTML = DAYS.map((d, i) => {
    const date = addDays(S.week, i);
    return `<div class="day${date === today ? ' today' : ''}"><div class="d">${d} ${dayNum(date)}</div>${chipHtml(row[i], dept.posts)}</div>`;
  }).join('');
}

function renderTable() {
  const { dept, roster } = S.data;
  const area = $('#tableArea');
  if (!roster) {
    area.innerHTML = `<div class="card empty-state"><b>No roster yet for this week</b>Your supervisor has not published it. Check back later, or look at another week.</div>`;
    return;
  }
  const today = todayStr();
  const head = DAYS.map((d, i) => {
    const date = addDays(S.week, i);
    return `<th class="${date === today ? 'today' : ''}">${d}<small>${dayNum(date)}</small></th>`;
  }).join('');
  const rows = dept.staff.map((s) => {
    const r = roster.rows[s.id] || [];
    const cells = DAYS.map((_, i) => `<td class="${addDays(S.week, i) === today ? 'today' : ''}">${chipHtml(r[i], dept.posts)}</td>`).join('');
    return `<tr class="${s.id === S.me ? 'me' : ''}"><td class="name">${esc(s.name)}</td>${cells}</tr>`;
  }).join('');
  area.innerHTML = `<div class="table-wrap"><table class="roster"><thead><tr><th class="name">Name</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function go(weeks) {
  S.week = weeks === 0 ? mondayOf(todayStr()) : addDays(S.week, weeks * 7);
  try { await loadRoster(); } catch (e) { toast(e.message, true); }
}
$('#prev').addEventListener('click', () => go(-1));
$('#next').addEventListener('click', () => go(1));
$('#thisWeek').addEventListener('click', () => go(0));
$('#print').addEventListener('click', () => window.print());
$('#me').addEventListener('change', (ev) => {
  S.me = ev.target.value;
  store.set(`roster.me.${S.session.outlet}.${S.session.dept}`, S.me);
  renderMyWeek();
  renderTable();
});
$('#logout').addEventListener('click', () => {
  store.del(SESSION_KEY);
  S.session = null;
  showLogin();
});

init();
