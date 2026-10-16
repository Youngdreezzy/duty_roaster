/* Supervisor page: fill in the weekly grid, publish, and manage staff / posts / passwords */
const TOKEN_KEY = 'roster.admin';
const A = {
  token: null, cfg: null,
  outlet: '', dept: '',
  week: mondayOf(todayStr()),
  rows: {},        // staffId -> 7 values
  status: null,    // null | 'draft' | 'published'
  savedAt: null,
  dirty: false,
};

const curOutlet = () => A.cfg.outlets.find((o) => o.id === A.outlet);
const curDept = () => curOutlet().departments.find((d) => d.id === A.dept);

/* ---------------- login ---------------- */
function showLogin(msg) {
  $('#appView').hidden = true;
  $('#loginView').hidden = false;
  $('#logout').hidden = true;
  $('#loginErr').textContent = msg || '';
}

$('#loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('#loginBtn').disabled = true;
  $('#loginErr').textContent = '';
  try {
    const r = await api('login', { method: 'POST', body: { role: 'admin', password: $('#password').value } });
    A.token = r.token;
    store.set(TOKEN_KEY, A.token);
    $('#password').value = '';
    await boot();
  } catch (e) {
    $('#loginErr').textContent = e.message;
  } finally {
    $('#loginBtn').disabled = false;
  }
});

$('#logout').addEventListener('click', () => {
  if (A.dirty && !confirm('You have unsaved changes. Log out anyway?')) return;
  A.dirty = false;
  store.del(TOKEN_KEY);
  A.token = null;
  showLogin();
});

async function boot() {
  A.cfg = await api('config', { token: A.token });
  if (!curOutletExists()) A.outlet = A.cfg.outlets[0].id;
  if (!A.dept || !curOutlet().departments.some((d) => d.id === A.dept)) A.dept = curOutlet().departments[0].id;
  $('#loginView').hidden = true;
  $('#appView').hidden = false;
  $('#logout').hidden = false;
  fillPickers();
  await loadRoster();
  renderSettings();
}
const curOutletExists = () => A.cfg.outlets.some((o) => o.id === A.outlet);

function fillPickers() {
  $('#outlet').innerHTML = A.cfg.outlets.map((o) => `<option value="${esc(o.id)}"${o.id === A.outlet ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
  $('#outletField').hidden = A.cfg.outlets.length < 2;
  $('#dept').innerHTML = curOutlet().departments.map((d) => `<option value="${esc(d.id)}"${d.id === A.dept ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
}

/* ---------------- loading a week ---------------- */
function emptyRows(dept) {
  const rows = {};
  dept.staff.forEach((s) => { rows[s.id] = Array(7).fill(''); });
  return rows;
}

async function fetchRoster(outlet, dept, week) {
  const r = await api('roster', { token: A.token, query: { outlet, dept, week } });
  return r.roster;
}

async function loadRoster() {
  const dept = curDept();
  let roster;
  try {
    roster = await fetchRoster(A.outlet, A.dept, A.week);
  } catch (e) {
    if (e.status === 401) { store.del(TOKEN_KEY); showLogin('Please log in again.'); }
    throw e;
  }
  A.rows = emptyRows(dept);
  if (roster) dept.staff.forEach((s) => { if (roster.rows[s.id]) A.rows[s.id] = roster.rows[s.id].slice(); });
  A.status = roster ? roster.status : null;
  A.savedAt = roster ? roster.updatedAt : null;
  A.dirty = false;
  renderGrid();
}

function confirmLeave() {
  return !A.dirty || confirm('You have unsaved changes in this roster. Discard them?');
}

/* ---------------- grid ---------------- */
function cellSelect(staffId, i, dept) {
  const v = A.rows[staffId][i];
  const opts = ['<option value=""></option>'].concat(dept.posts.map((p) => `<option value="${esc(p)}"${p === v ? ' selected' : ''}>${esc(p)}</option>`));
  return `<select class="cell" data-s="${esc(staffId)}" data-d="${i}" aria-label="${DAYS[i]}">${opts.join('')}</select>`;
}

function renderGrid() {
  const dept = curDept();
  const today = todayStr();
  $('#weekLabel').textContent = weekLabel(A.week);
  $('#printTitle').textContent = `${curOutlet().name} · ${dept.name} · ${weekLabel(A.week)}`;

  if (!dept.staff.length) {
    $('#gridArea').innerHTML = '<div class="card empty-state"><b>No staff in this department yet</b>Add names in the "Staff, posts &amp; passwords" tab.</div>';
    updateDerived();
    return;
  }
  const head = DAYS.map((d, i) => {
    const date = addDays(A.week, i);
    return `<th class="${date === today ? 'today' : ''}">${d}<small>${dayNum(date)}</small></th>`;
  }).join('');
  const fillOpts = '<option value="">Fill row…</option>' + dept.posts.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  const body = dept.staff.map((s) => {
    const cells = DAYS.map((_, i) => `<td class="${addDays(A.week, i) === today ? 'today' : ''}">${cellSelect(s.id, i, dept)}</td>`).join('');
    return `<tr data-row="${esc(s.id)}"><td class="name">${esc(s.name)}<span class="warn-flag" hidden>⚠ no off day</span><select class="fill" data-fill="${esc(s.id)}" aria-label="Fill whole row for ${esc(s.name)}">${fillOpts}</select></td>${cells}</tr>`;
  }).join('');
  const foot = dept.posts.map((p) =>
    `<tr data-post="${esc(p)}"><th class="name">${esc(p)}</th>${DAYS.map((_, i) => `<td data-c="${i}">0</td>`).join('')}</tr>`).join('');
  $('#gridArea').innerHTML = `<div class="table-wrap"><table class="roster">
    <thead><tr><th class="name">Name</th>${head}</tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr class="sect"><th colspan="8">Who is on each post</th></tr>${foot}</tfoot></table></div>`;
  updateDerived();
}

function styleSelect(sel, dept) {
  const v = sel.value;
  sel.classList.toggle('empty', !v);
  sel.classList.toggle('off', !!v && isOff(v));
  if (v && !isOff(v)) sel.style.setProperty('--h', hueFor(v, dept.posts)); else sel.style.removeProperty('--h');
}

function updateDerived() {
  const dept = curDept();
  $$('select.cell').forEach((s) => styleSelect(s, dept));

  // coverage counts
  const counts = {};
  dept.posts.forEach((p) => { counts[p] = Array(7).fill(0); });
  let blanks = 0;
  const hasOff = dept.posts.some(isOff);
  dept.staff.forEach((s) => {
    const row = A.rows[s.id];
    row.forEach((v, i) => { if (!v) blanks++; else if (counts[v]) counts[v][i]++; });
    const flag = $(`tr[data-row="${CSS.escape(s.id)}"] .warn-flag`);
    if (flag) flag.hidden = !(hasOff && row.every((v) => v && !isOff(v)));
  });
  $$('tfoot tr[data-post]').forEach((tr) => {
    const c = counts[tr.dataset.post];
    $$('td', tr).forEach((td, i) => { td.textContent = c[i]; td.classList.toggle('zero', c[i] === 0); });
  });

  // status line
  const pill = $('#statusPill');
  pill.className = 'pill ' + (A.status || 'none');
  pill.textContent = A.status === 'published' ? 'Published' : A.status === 'draft' ? 'Draft (staff cannot see it)' : 'Not saved yet';
  $('#savedInfo').textContent = A.savedAt ? `Last saved ${stamp(A.savedAt)}` : '';
  $('#dirtyInfo').textContent = A.dirty ? 'Unsaved changes' : (blanks ? `${blanks} empty cell${blanks === 1 ? '' : 's'}` : '');
}

$('#gridArea').addEventListener('change', (ev) => {
  const t = ev.target;
  const dept = curDept();
  if (t.matches('select.cell')) {
    A.rows[t.dataset.s][Number(t.dataset.d)] = t.value;
  } else if (t.matches('select.fill')) {
    if (!t.value) return;
    A.rows[t.dataset.fill] = Array(7).fill(t.value);
    $$(`tr[data-row="${CSS.escape(t.dataset.fill)}"] select.cell`).forEach((s) => { s.value = t.value; });
    t.value = '';
  } else return;
  A.dirty = true;
  updateDerived();
});

/* ---------------- toolbar actions ---------------- */
$('#outlet').addEventListener('change', async (ev) => {
  if (!confirmLeave()) { ev.target.value = A.outlet; return; }
  A.outlet = ev.target.value;
  A.dept = curOutlet().departments[0].id;
  fillPickers();
  await safeLoad();
  renderSettings();
});
$('#dept').addEventListener('change', async (ev) => {
  if (!confirmLeave()) { ev.target.value = A.dept; return; }
  A.dept = ev.target.value;
  await safeLoad();
});
async function moveWeek(n) {
  if (!confirmLeave()) return;
  A.week = n === 0 ? mondayOf(todayStr()) : addDays(A.week, n * 7);
  await safeLoad();
}
$('#prev').addEventListener('click', () => moveWeek(-1));
$('#next').addEventListener('click', () => moveWeek(1));
async function safeLoad() { try { await loadRoster(); } catch (e) { toast(e.message, true); } }

$('#copyLast').addEventListener('click', async () => {
  const dept = curDept();
  const filled = Object.values(A.rows).some((r) => r.some(Boolean));
  if (filled && !confirm('This will replace what is already filled in for this week. Continue?')) return;
  try {
    const last = await fetchRoster(A.outlet, A.dept, addDays(A.week, -7));
    if (!last) { toast('There is no roster saved for last week.', true); return; }
    dept.staff.forEach((s) => { A.rows[s.id] = (last.rows[s.id] || Array(7).fill('')).map((v) => (dept.posts.includes(v) ? v : '')); });
    A.dirty = true;
    renderGrid();
    toast("Copied last week's roster. Change anything that is different, then save.");
  } catch (e) { toast(e.message, true); }
});

$('#clearAll').addEventListener('click', () => {
  if (!confirm('Clear every cell for this week?')) return;
  A.rows = emptyRows(curDept());
  A.dirty = true;
  renderGrid();
});
$('#print').addEventListener('click', () => window.print());

async function save(status) {
  const dept = curDept();
  if (!dept.staff.length) { toast('Add staff first.', true); return; }
  const blanks = Object.values(A.rows).reduce((n, r) => n + r.filter((v) => !v).length, 0);
  if (status === 'published' && blanks && !confirm(`${blanks} cell${blanks === 1 ? ' is' : 's are'} still empty. Publish anyway?`)) return;
  const buttons = [$('#saveDraft'), $('#publish')];
  buttons.forEach((b) => { b.disabled = true; });
  try {
    const r = await api('saveRoster', { method: 'POST', token: A.token, body: { outlet: A.outlet, dept: A.dept, week: A.week, status, rows: A.rows } });
    A.status = r.roster.status;
    A.savedAt = r.roster.updatedAt;
    A.dirty = false;
    updateDerived();
    toast(status === 'published' ? 'Published. Staff can see it now.' : 'Draft saved.');
  } catch (e) { toast(e.message, true); } finally { buttons.forEach((b) => { b.disabled = false; }); }
}
$('#saveDraft').addEventListener('click', () => save('draft'));
$('#publish').addEventListener('click', () => save('published'));

window.addEventListener('beforeunload', (ev) => { if (A.dirty) { ev.preventDefault(); ev.returnValue = ''; } });

/* ---------------- tabs ---------------- */
function showTab(which) {
  const roster = which === 'roster';
  $('#rosterPanel').hidden = !roster;
  $('#settingsPanel').hidden = roster;
  $('#tabRoster').setAttribute('aria-selected', roster);
  $('#tabSettings').setAttribute('aria-selected', !roster);
}
$('#tabRoster').addEventListener('click', () => showTab('roster'));
$('#tabSettings').addEventListener('click', () => showTab('settings'));

/* ---------------- settings: staff, posts, passwords ---------------- */
const newId = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function staffRowHtml(s) {
  return `<div class="staff-row" data-id="${esc(s.id)}"><input type="text" value="${esc(s.name)}" maxlength="40" aria-label="Staff name"><button type="button" class="btn secondary small" data-remove title="Remove" aria-label="Remove ${esc(s.name)}">✕</button></div>`;
}

function renderSettings() {
  const outlet = curOutlet();
  const panel = $('#settingsPanel');
  panel.innerHTML = `<p class="hint" style="margin-top:0">Settings for <b>${esc(outlet.name)}</b>. Renaming a duty post does not change weeks you already saved.</p>` +
    outlet.departments.map((d) => `
    <div class="card dept-card" data-dept="${esc(d.id)}">
      <h2>${esc(d.name)}</h2>
      <div class="grid2">
        <div>
          <label>Staff names</label>
          <div class="staff-list">${d.staff.map(staffRowHtml).join('')}</div>
          <button type="button" class="btn secondary small" data-add>+ Add staff</button>
        </div>
        <div>
          <label for="posts-${esc(d.id)}">Duty posts (one per line)</label>
          <textarea id="posts-${esc(d.id)}" data-posts>${esc(d.posts.join('\n'))}</textarea>
          <p class="hint">Include an "Off" line if people can be off. Posts named Off or OFF are shown in grey.</p>
        </div>
      </div>
      <div style="margin-top:12px"><button type="button" class="btn small" data-save>Save staff &amp; posts</button></div>
      <hr class="sep">
      <label for="pw-${esc(d.id)}">Staff password for ${esc(d.name)} <span class="${d.hasPassword ? 'status-ok' : 'status-no'}" data-pwstatus>${d.hasPassword ? '(set)' : '(not set yet, staff cannot log in)'}</span></label>
      <div class="pw-row">
        <input type="text" id="pw-${esc(d.id)}" data-pw placeholder="Type a new password" autocomplete="off" maxlength="64">
        <button type="button" class="btn small" data-setpw>${d.hasPassword ? 'Change password' : 'Set password'}</button>
      </div>
      <p class="hint">Everyone in this department uses this one password. Change it any time. Staff who are already logged in stay logged in.</p>
    </div>`).join('') + `
    <div class="card">
      <h2 style="font:600 18px var(--serif);margin:0 0 4px">Try it with sample data</h2>
      <p class="hint" style="margin-top:0">Loads the handwritten week of 12–18 Oct as <b>drafts</b> for Vibes Lounge (staff cannot see drafts). Weeks that already have data are never overwritten. A few crossed-out or unclear cells are left empty.</p>
      <button type="button" class="btn secondary small" id="seed">Load sample week</button>
    </div>`;
}

$('#settingsPanel').addEventListener('click', async (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  const card = t.closest('[data-dept]');
  if (t.id === 'seed') {
    try {
      const r = await api('seedSample', { method: 'POST', token: A.token });
      toast(r.added ? `Loaded sample week (${r.added} departments).` : 'Sample week already exists, nothing changed.');
      A.week = '2026-10-12';
      if (confirmLeave()) { await safeLoad(); }
    } catch (e) { toast(e.message, true); }
    return;
  }
  if (!card) return;
  const dept = curOutlet().departments.find((d) => d.id === card.dataset.dept);

  if (t.matches('[data-add]')) {
    const list = $('.staff-list', card);
    list.insertAdjacentHTML('beforeend', staffRowHtml({ id: newId(), name: '' }));
    list.lastElementChild.querySelector('input').focus();
  } else if (t.matches('[data-remove]')) {
    if (confirm('Remove this person from the department? Their past roster entries stop showing.')) t.closest('.staff-row').remove();
  } else if (t.matches('[data-save]')) {
    const staff = $$('.staff-row', card).map((r) => ({ id: r.dataset.id, name: $('input', r).value })).filter((s) => s.name.trim());
    const posts = $('[data-posts]', card).value.split('\n');
    if (A.dirty && !confirm('Saving changes here reloads the roster and discards unsaved roster edits. Continue?')) return;
    try {
      await api('saveConfig', { method: 'POST', token: A.token, body: { outlet: A.outlet, departments: [{ id: dept.id, staff, posts }] } });
      A.cfg = await api('config', { token: A.token });
      fillPickers();
      A.dirty = false;
      await safeLoad();
      renderSettings();
      toast('Saved.');
    } catch (e) { toast(e.message, true); }
  } else if (t.matches('[data-setpw]')) {
    const input = $('[data-pw]', card);
    try {
      await api('setPassword', { method: 'POST', token: A.token, body: { outlet: A.outlet, dept: dept.id, password: input.value } });
      input.value = '';
      dept.hasPassword = true;
      const st = $('[data-pwstatus]', card);
      st.textContent = '(set)'; st.className = 'status-ok';
      t.textContent = 'Change password';
      toast(`${dept.name} password updated.`);
    } catch (e) { toast(e.message, true); }
  }
});

/* ---------------- start ---------------- */
(async function init() {
  A.token = store.get(TOKEN_KEY);
  if (A.token) {
    try { await boot(); return; } catch { store.del(TOKEN_KEY); A.token = null; }
  }
  showLogin();
})();
