/* =============================================================
   eHisaab – app.js
   Vanilla JS | localStorage auth + data | No dependencies
   ============================================================= */

// ─── AUTH STATE ──────────────────────────────────────────────
const AUTH_KEY   = 'splitease_users_v1';
const SESSION_KEY = 'splitease_session_v1';
const DATA_KEY     = 'splitease_data_v2';
const CONTACTS_KEY = 'splitease_contacts_v1';

let currentUser = null;   // { name, email }

// ─── UTILS ───────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmt(n) {
  return '\u20b9' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() {
  return new Date().toISOString().split('T')[0];
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function avatarColor(name) {
  const colors = ['#6c63ff','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6','#8b5cf6'];
  let h = 0;
  for (const c of (name || 'X')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[h % colors.length];
}
function expenseIcon(desc) {
  const d = (desc || '').toLowerCase();
  if (/food|eat|restaurant|lunch|dinner|breakfast|snack/.test(d)) return '\ud83c\udf7d\ufe0f';
  if (/hotel|stay|hostel|room|resort|airbnb/.test(d)) return '\ud83c\udfe8';
  if (/cab|taxi|uber|ola|travel|bus|train|flight|auto/.test(d)) return '\ud83d\ude97';
  if (/petrol|fuel|gas/.test(d)) return '\u26fd';
  if (/drink|beer|alcohol|bar|pub/.test(d)) return '\ud83c\udf7a';
  if (/shopping|shop|buy|market/.test(d)) return '\ud83d\uded2\ufe0f';
  if (/ticket|entry|movie|cinema/.test(d)) return '\ud83c\udf9f\ufe0f';
  if (/medicine|medical|pharmacy|doctor/.test(d)) return '\ud83d\udc8a';
  if (/rent|house|flat|apartment/.test(d)) return '\ud83c\udfe0';
  if (/gym|fitness|sport/.test(d)) return '\ud83c\udfcb\ufe0f';
  return '\ud83d\udcb0';
}
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast';
  if (type === 'error') t.style.background = '#ef4444';
  else t.style.background = '#18163a';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), 2400);
}

// ─── AUTH STORAGE ─────────────────────────────────────────────
function getUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || {}; } catch { return {}; }
}
function saveUsers(users) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ─── DATA STORAGE (per user) ─────────────────────────────────
function dataKey() {
  return DATA_KEY + '_' + (currentUser ? currentUser.email : '');
}
function loadGroups() {
  try { return JSON.parse(localStorage.getItem(dataKey())) || []; } catch { return []; }
}
function saveGroups() {
  localStorage.setItem(dataKey(), JSON.stringify(state.groups));
}

// ─── CONTACTS STORAGE ────────────────────────────────────────
function contactsStoreKey() {
  return CONTACTS_KEY + '_' + (currentUser ? currentUser.email : '');
}
function getContacts() {
  try { return JSON.parse(localStorage.getItem(contactsStoreKey())) || []; } catch { return []; }
}
function saveContacts(contacts) {
  localStorage.setItem(contactsStoreKey(), JSON.stringify(contacts));
}

// ─── APP STATE ────────────────────────────────────────────────
let state = {
  groups: [],
  currentGroupId: null,
  pendingSettle: null
};

// ─── FEATURE FLAGS ───────────────────────────────────────────
let _pendingBootAfterPIN = false; // PIN entered at boot before app is loaded
let _expBulkMode   = false;       // Expense bulk-select mode
let _memberBulkMode = false;      // Member bulk-select mode
let _groupBulkMode  = false;      // Group bulk-select mode

// Returns the actual member-name string in group g that corresponds to the
// logged-in user (case-insensitive). Falls back to currentUser.name.
function getMeInGroup(g) {
  if (!g || !currentUser) return currentUser ? currentUser.name : '';
  return g.members.find(m => m.toLowerCase() === currentUser.name.toLowerCase()) || currentUser.name;
}

// ─── AUTH SCREEN ──────────────────────────────────────────────
function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}
function showAppShell() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabSignup').classList.toggle('active', !isLogin);
  document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
  document.getElementById('formSignup').classList.toggle('hidden', isLogin);
  const ind = document.getElementById('authTabIndicator');
  if (isLogin) ind.classList.remove('right');
  else ind.classList.add('right');
  clearAuthErrors();
}

function clearAuthErrors() {
  ['loginError','signupError'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.add('hidden');
  });
}
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '\ud83d\ude48'; }
  else { inp.type = 'password'; btn.textContent = '\ud83d\udc41'; }
}

function handleLogin(e) {
  e.preventDefault();
  clearAuthErrors();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pw    = document.getElementById('loginPassword').value;
  const users = getUsers();
  if (!users[email]) { showAuthError('loginError', 'No account found with this email.'); return; }
  if (users[email].hash !== simpleHash(pw)) { showAuthError('loginError', 'Incorrect password. Please try again.'); return; }
  currentUser = { name: users[email].name, email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  bootApp();
}

function handleSignup(e) {
  e.preventDefault();
  clearAuthErrors();
  const name    = document.getElementById('signupName').value.trim();
  const email   = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pw      = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  if (!name) { showAuthError('signupError', 'Please enter your full name.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAuthError('signupError', 'Please enter a valid email address.'); return; }
  if (pw.length < 6) { showAuthError('signupError', 'Password must be at least 6 characters.'); return; }
  if (pw !== confirm) { showAuthError('signupError', 'Passwords do not match.'); return; }
  const users = getUsers();
  if (users[email]) { showAuthError('signupError', 'An account already exists with this email.'); return; }
  users[email] = { name, hash: simpleHash(pw) };
  saveUsers(users);
  currentUser = { name, email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  bootApp();
  showToast('\u2728 Welcome to eHisaab, ' + name + '!');
}

function logout() {
  currentUser = null;
  state.groups = [];
  state.currentGroupId = null;
  localStorage.removeItem(SESSION_KEY);
  document.getElementById('userDropdown').classList.add('hidden');
  showAuthScreen();
  switchAuthTab('login');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────
function openForgotPwModal() {
  ['fpEmail', 'fpNewPw', 'fpConfirm'].forEach(function(id) { document.getElementById(id).value = ''; });
  var errEl = document.getElementById('fpError');
  errEl.textContent = '';
  errEl.classList.add('hidden');
  openModal('modalForgotPw');
}
function handleForgotPw(e) {
  e.preventDefault();
  var email   = document.getElementById('fpEmail').value.trim().toLowerCase();
  var newPw   = document.getElementById('fpNewPw').value;
  var confirm = document.getElementById('fpConfirm').value;
  var errEl   = document.getElementById('fpError');
  errEl.classList.add('hidden');
  var users = getUsers();
  if (!users[email]) { errEl.textContent = 'No account found with this email.'; errEl.classList.remove('hidden'); return; }
  if (newPw.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
  if (newPw !== confirm) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); return; }
  users[email].hash = simpleHash(newPw);
  saveUsers(users);
  closeModal('modalForgotPw');
  showToast('\u2705 Password reset! Sign in with your new password.');
  switchAuthTab('login');
}

// ─── CONTACTS MODAL ──────────────────────────────────────────
function openContactsModal() {
  document.getElementById('userDropdown').classList.add('hidden');
  document.getElementById('ctNewName').value = '';
  document.getElementById('ctNewPhone').value = '';
  renderContactsList();
  openModal('modalContacts');
}
function renderContactsList() {
  var contacts = getContacts();
  var list = document.getElementById('ctList');
  if (contacts.length === 0) {
    list.innerHTML = '<div class="ct-empty">No contacts yet. Add people you split with often \u2014 they\'ll be auto-added to new groups.</div>';
    return;
  }
  list.innerHTML = contacts.map(function(c) {
    var ph = c.phone ? '\ud83d\udcf1 +91 ' + c.phone.replace(/\D/g, '').slice(-10) : '<em style="color:#9491b0">No phone \u2014 add for WhatsApp</em>';
    return '<div class="ct-item">'
      + '<div class="ct-av" style="background:' + avatarColor(c.name) + '">' + c.name.charAt(0).toUpperCase() + '</div>'
      + '<div class="ct-info"><div class="ct-name">' + escHtml(c.name) + '</div><div class="ct-phone">' + ph + '</div></div>'
      + '<button class="ct-del" onclick="deleteContact(\'' + c.id + '\')" title="Remove">\ud83d\uddd1</button>'
      + '</div>';
  }).join('');
}
function addContact() {
  var name  = document.getElementById('ctNewName').value.trim();
  var phone = document.getElementById('ctNewPhone').value.trim().replace(/\D/g, '').slice(-10);
  if (!name) { showToast('\u26a0\ufe0f Enter a contact name', 'error'); return; }
  var contacts = getContacts();
  if (contacts.some(function(c) { return c.name.toLowerCase() === name.toLowerCase(); })) {
    showToast('\u26a0\ufe0f Contact already exists', 'error'); return;
  }
  contacts.push({ id: uid(), name: name, phone: phone });
  saveContacts(contacts);
  document.getElementById('ctNewName').value = '';
  document.getElementById('ctNewPhone').value = '';
  renderContactsList();
  showToast('\u2705 Contact added');
}
function deleteContact(contactId) {
  saveContacts(getContacts().filter(function(c) { return c.id !== contactId; }));
  renderContactsList();
  showToast('\ud83d\uddd1 Contact removed');
}
async function importFromPhone() {
  if (!('contacts' in navigator) || !('ContactsManager' in window)) {
    showToast('\u26a0\ufe0f Contact import requires Chrome on Android.', 'error');
    return;
  }
  try {
    const selected = await navigator.contacts.select(['name', 'tel'], { multiple: true });
    if (!selected || selected.length === 0) return;
    const existing = getContacts();
    let added = 0;
    selected.forEach(function(c) {
      const name  = (c.name && c.name[0] ? c.name[0] : '').trim();
      const phone = (c.tel  && c.tel[0]  ? c.tel[0]  : '').replace(/\D/g, '').slice(-10);
      if (!name) return;
      if (existing.some(function(e) { return e.name.toLowerCase() === name.toLowerCase(); })) return;
      existing.push({ id: uid(), name: name, phone: phone });
      added++;
    });
    if (added === 0) { showToast('\u26a0\ufe0f No new contacts to add', 'error'); return; }
    saveContacts(existing);
    renderContactsList();
    showToast('\u2705 ' + added + ' contact' + (added !== 1 ? 's' : '') + ' imported');
  } catch (err) {
    showToast('\u26a0\ufe0f Could not access contacts: ' + (err.message || err), 'error');
  }
}
function getContactPhone(name) {
  var c = getContacts().find(function(c) { return c.name.toLowerCase() === name.toLowerCase(); });
  return c ? c.phone.replace(/\D/g, '').slice(-10) : '';
}

function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('hidden');
}

function bootApp(skipPin) {
  state.groups = loadGroups();
  // Populate user UI
  document.getElementById('userAvatarInitial').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('userAvatarBtn').style.background =
    'linear-gradient(135deg,' + avatarColor(currentUser.name) + ',' + avatarColor(currentUser.email) + ')';
  document.getElementById('userDropdownName').textContent  = currentUser.name;
  document.getElementById('userDropdownEmail').textContent = currentUser.email;
  showAppShell();
  applyDarkMode(getSettings().darkMode);
  if (getSettings().pin && !skipPin) showPINLock();
  renderHome();
  checkImportLink();
}

// ─── VIEWS ───────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === name);
    v.classList.toggle('hidden', v.id !== name);
  });
}

// ─── HOME ─────────────────────────────────────────────────────
function renderHome() {
  showView('viewHome');
  state.currentGroupId = null;
  // Reset bulk modes when returning home
  _expBulkMode = false;
  _memberBulkMode = false;

  const list  = document.getElementById('groupList');
  const empty = document.getElementById('emptyGroups');
  list.innerHTML = '';

  // Update group bulk-select UI
  const groupBulkToggle = document.getElementById('groupBulkToggleBtn');
  if (groupBulkToggle) groupBulkToggle.textContent = _groupBulkMode ? '\u2715 Cancel' : '\u2610 Select';
  const groupBulkBar = document.getElementById('groupBulkBar');
  if (groupBulkBar) groupBulkBar.classList.toggle('hidden', !_groupBulkMode);

  const activeGroups   = state.groups.filter(g => !g.archived);
  const archivedGroups = state.groups.filter(g =>  g.archived);
  if (state.groups.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.classList.remove('hidden');
  function makeCard(g, isArchived) {
    const totalSpent = g.expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
    const card = document.createElement('div');
    card.className = 'group-card' + (isArchived ? ' group-card-archived' : '') + (_groupBulkMode ? ' group-card-bulk' : '');
    card.innerHTML = `
      ${_groupBulkMode
        ? `<label class="group-card-bulk-check-wrap" onclick="event.stopPropagation()"><input type="checkbox" class="group-bulk-check" value="${g.id}" onchange="updateGroupBulkCount()" /></label>`
        : `<button class="group-card-delete" title="Delete group" onclick="deleteGroup('${g.id}', event)">\ud83d\uddd1</button>
           <button class="group-card-archive" title="${isArchived ? 'Restore group' : 'Archive group'}" onclick="archiveGroup('${g.id}', event)">${isArchived ? '\u267b\ufe0f' : '\ud83d\udce6'}</button>`
      }
      <span class="group-card-emoji">${g.emoji}</span>
      <div class="group-card-name">${escHtml(g.name)}</div>
      <div class="group-card-meta">
        <span>\ud83d\udc65 ${g.members.length} member${g.members.length !== 1 ? 's' : ''}</span>
        <span>\ud83e\uddfe ${g.expenses.length} expense${g.expenses.length !== 1 ? 's' : ''}</span>
      </div>
      ${totalSpent > 0 ? `<div style="font-size:.8rem;color:#9491b0;margin-bottom:.4rem;">Total: <strong style="color:#6c63ff">${fmt(totalSpent)}</strong></div>` : ''}
      <span class="group-card-badge">${g.emoji} ${escHtml(g.type)}</span>
    `;
    if (!_groupBulkMode) {
      card.addEventListener('click', () => openGroup(g.id));
    }
    return card;
  }
  activeGroups.forEach(g => list.appendChild(makeCard(g, false)));
  if (archivedGroups.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'archive-section-header';
    sep.innerHTML = '<span>\ud83d\udce6 Archived (' + archivedGroups.length + ')</span>';
    list.appendChild(sep);
    archivedGroups.forEach(g => list.appendChild(makeCard(g, true)));
  }
}

// ─── GROUP BULK SELECT ────────────────────────────────────────
function toggleGroupBulkMode() {
  _groupBulkMode = !_groupBulkMode;
  renderHome();
}
function updateGroupBulkCount() {
  const n = document.querySelectorAll('.group-bulk-check:checked').length;
  const el = document.getElementById('groupBulkCount');
  if (el) el.textContent = n + ' selected';
}
function bulkDeleteGroups() {
  const ids = [...document.querySelectorAll('.group-bulk-check:checked')].map(c => c.value);
  if (ids.length === 0) { showToast('\u26a0\ufe0f Select at least one group', 'error'); return; }
  if (!confirm('Delete ' + ids.length + ' group(s)? All expenses inside will be permanently lost.')) return;
  state.groups = state.groups.filter(g => !ids.includes(g.id));
  saveGroups();
  _groupBulkMode = false;
  renderHome();
  showToast('\ud83d\uddd1 ' + ids.length + ' group' + (ids.length !== 1 ? 's' : '') + ' deleted');
}

// ─── GROUP DETAIL ─────────────────────────────────────────────
function openGroup(id) {
  state.currentGroupId = id;
  showView('viewGroup');
  const g = getGroup();
  document.getElementById('detailEmoji').textContent = g.emoji;
  document.getElementById('detailGroupName').textContent = g.name;
  document.getElementById('detailGroupType').textContent = g.emoji + ' ' + g.type;
  renderPartyStrip(g);
  renderStatsBar();
  switchTab('expenses');
}

function getGroup(id = state.currentGroupId) {
  return state.groups.find(g => g.id === id);
}

function renderPartyStrip(g) {
  // Remove any existing strip
  const old = document.getElementById('partyInfoStrip');
  if (old) old.remove();
  if (!g.partyDetails || g.type !== 'Party') return;
  const pd = g.partyDetails;
  if (!pd.drinks || pd.drinks.length === 0) return;

  const strip = document.createElement('div');
  strip.className = 'party-info-strip';
  strip.id = 'partyInfoStrip';

  const typeLabel = pd.partyType === 'alcohol' ? '🍻 Alcohol Party' : '🥤 Non-Alcohol Party';
  let html = `<span class="pi-label">${typeLabel}</span>`;
  pd.drinks.forEach(d => {
    if (pd.partyType === 'alcohol' && pd.glasses[d] && Object.keys(pd.glasses[d]).length > 0) {
      html += `<div class="pi-drink-block"><span class="pi-drink-name">${escHtml(d)}</span>`;
      // Bottle info badge
      if (BOTTLE_DRINKS.includes(d) && pd.bottleSize?.[d] && pd.bottlePrice?.[d]) {
        const sz  = pd.bottleSize[d];
        const cnt = pd.bottleCount?.[d] || 1;
        const totalCost = cnt * pd.bottlePrice[d];
        html += `<span class="pi-tag pi-bottle">${cnt > 1 ? cnt + ' × ' : ''}${sz < 1000 ? sz + 'ml' : '1L'} · ${fmt(totalCost)}</span>`;
      }
      Object.entries(pd.glasses[d]).forEach(([member, count]) => {
        html += `<span class="pi-tag">${escHtml(member)}: ${count} glass${count !== 1 ? 'es' : ''}</span>`;
      });
      html += '</div>';
    } else {
      html += `<span class="pi-tag">${escHtml(d)}</span>`;
    }
  });
  strip.innerHTML = html;

  // Insert after group-hero
  const groupHero = document.querySelector('.group-hero');
  groupHero.insertAdjacentElement('afterend', strip);
}

function renderStatsBar() {
  const g = getGroup();
  if (!g) return;

  // Include virtual drink expenses (from bottle calculator) in totals
  let total    = g.expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  let expCount = g.expenses.length;
  const pd = g.partyDetails;
  if (pd?.partyType === 'alcohol') {
    BOTTLE_DRINKS.forEach(d => {
      if (!pd.drinks?.includes(d)) return;
      if (!pd.bottlePaidBy?.[d] || !pd.bottlePrice?.[d]) return;
      total    += (pd.bottleCount?.[d] || 1) * pd.bottlePrice[d];
      expCount += 1;
    });
  }

  const { balances, settlements } = calculateBalances(g);
  // Use getMeInGroup so we match the exact stored member name
  const myName    = getMeInGroup(g);
  const myBal     = balances[myName] || 0;
  const myRounded = Math.round(myBal * 100) / 100;
  let myBalHtml;
  if (myRounded > 0.005)       myBalHtml = `<span class="stat-chip-value green">+${fmt(myRounded)}</span>`;
  else if (myRounded < -0.005) myBalHtml = `<span class="stat-chip-value red">-${fmt(-myRounded)}</span>`;
  else                         myBalHtml = `<span class="stat-chip-value" style="color:#9491b0">Settled \u2713</span>`;

  // Build mini debt rows using the same myName key
  const debtLines = settlements.map(s => {
    const fromMe = s.from === myName;
    const toMe   = s.to   === myName;
    if (fromMe) return `<span class="ds-row ds-owe">You \u2192 <strong>${escHtml(s.to)}</strong>: ${fmt(s.amount)}</span>`;
    if (toMe)   return `<span class="ds-row ds-get"><strong>${escHtml(s.from)}</strong> \u2192 You: ${fmt(s.amount)}</span>`;
    return `<span class="ds-row ds-other">${escHtml(s.from)} \u2192 ${escHtml(s.to)}: ${fmt(s.amount)}</span>`;
  }).join('');
  const debtSummary = settlements.length === 0
    ? `<span class="ds-row ds-clear">\ud83c\udf89 All settled up!</span>`
    : debtLines;

  document.getElementById('groupStatsBar').innerHTML = `
    <div class="stat-chip">
      <div class="stat-chip-label">Total Spent</div>
      <div class="stat-chip-value">${fmt(total)}</div>
    </div>
    <div class="stat-chip">
      <div class="stat-chip-label">Expenses</div>
      <div class="stat-chip-value">${expCount}</div>
    </div>
    <div class="stat-chip">
      <div class="stat-chip-label">Members</div>
      <div class="stat-chip-value">${g.members.length}</div>
    </div>
    <div class="stat-chip">
      <div class="stat-chip-label">Your Balance</div>
      ${myBalHtml}
    </div>
    <div class="stat-debt-summary">${debtSummary}</div>
  `;
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(tc => {
    const match = tc.id === 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1);
    tc.classList.toggle('active', match);
    tc.classList.toggle('hidden', !match);
  });
  if (tab === 'expenses')  renderExpenses();
  if (tab === 'balances')  renderBalances();
  if (tab === 'members')   renderMembers();
  if (tab === 'analytics') { renderSpendingChart(); renderActivityFeed(); }
}

// ─── EXPENSES ─────────────────────────────────────────────────
function renderExpenses() {
  const g = getGroup();
  if (!g) return;
  const list  = document.getElementById('expenseList');
  const empty = document.getElementById('emptyExpenses');

  // Update bulk-select UI
  const expBulkToggle = document.getElementById('expBulkToggleBtn');
  if (expBulkToggle) expBulkToggle.textContent = _expBulkMode ? '\u2715 Cancel' : '\u2610 Select';
  const expBulkBar = document.getElementById('expBulkBar');
  if (expBulkBar) expBulkBar.classList.toggle('hidden', !_expBulkMode);

  // Collect virtual drink expenses (auto-computed from bottle calculator)
  const pd = g.partyDetails;
  const virtualItems = [];
  if (pd?.partyType === 'alcohol') {
    BOTTLE_DRINKS.forEach(d => {
      if (!pd.drinks?.includes(d)) return;
      const paidBy = pd.bottlePaidBy?.[d];
      if (!paidBy || !pd.bottlePrice?.[d]) return;
      const numBottles = pd.bottleCount?.[d] || 1;
      const totalCost  = numBottles * pd.bottlePrice[d];
      virtualItems.push({ description: d + ' (bottles)', amount: totalCost, paidBy, isVirtual: true, bottleInfo: numBottles + '\u00d7' + (pd.bottleSize?.[d] || 750) + 'ml @ ' + fmt(pd.bottlePrice[d]) });
    });
  }

  // Apply search filter
  const manualExpenses = [...g.expenses]
    .filter(e => !_expSearch || e.description.toLowerCase().includes(_expSearch) || e.paidBy.toLowerCase().includes(_expSearch))
    .sort((a, b) => b.date.localeCompare(a.date));
  const hasAny = virtualItems.length > 0 || manualExpenses.length > 0;

  if (!hasAny) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.classList.remove('hidden');
  list.innerHTML = '';

  // Virtual drink expense items (read-only, no bulk select)
  virtualItems.forEach(exp => {
    const item = document.createElement('div');
    item.className = 'expense-item expense-item-auto';
    item.innerHTML = `
      <div class="expense-icon">\ud83c\udf76</div>
      <div class="expense-info">
        <div class="expense-desc">${escHtml(exp.description)} <span class="exp-auto-tag">auto</span></div>
        <div class="expense-meta">Paid by <strong>${escHtml(exp.paidBy)}</strong> &middot; ${escHtml(exp.bottleInfo)}</div>
      </div>
      <div class="expense-right">
        <div class="expense-amount">${fmt(exp.amount)}</div>
        <div class="expense-date">Bottle calc</div>
      </div>
    `;
    list.appendChild(item);
  });

  // Manual expense items
  manualExpenses.forEach(exp => {
    const item = document.createElement('div');
    item.className = 'expense-item' + (_expBulkMode ? ' expense-item-bulk' : '');
    item.innerHTML = `
      ${_expBulkMode ? `<input type="checkbox" class="exp-bulk-check" data-id="${exp.id}" onchange="updateExpBulkCount()" />` : ''}
      <div class="expense-icon">${expenseIcon(exp.description)}</div>
      <div class="expense-info">
        <div class="expense-desc">${escHtml(exp.description)}</div>
        <div class="expense-meta">Paid by <strong>${escHtml(exp.paidBy)}</strong> &middot; ${escHtml(splitLabel(exp))}</div>
      </div>
      <div class="expense-right">
        <div class="expense-amount">${fmt(exp.amount)}</div>
        <div class="expense-date">${formatDate(exp.date)}</div>
        ${!_expBulkMode ? `<button class="expense-delete" onclick="deleteExpense('${exp.id}')" title="Delete">\ud83d\uddd1</button>` : ''}
      </div>
    `;
    list.appendChild(item);
  });
}

// ─── EXPENSE BULK SELECT ──────────────────────────────────────
function toggleExpBulkMode() {
  _expBulkMode = !_expBulkMode;
  renderExpenses();
}
function updateExpBulkCount() {
  const n = document.querySelectorAll('.exp-bulk-check:checked').length;
  const el = document.getElementById('expBulkCount');
  if (el) el.textContent = n + ' selected';
}
function bulkDeleteExpenses() {
  const ids = [...document.querySelectorAll('.exp-bulk-check:checked')].map(c => c.dataset.id);
  if (ids.length === 0) { showToast('\u26a0\ufe0f Select at least one expense', 'error'); return; }
  if (!confirm('Delete ' + ids.length + ' expense(s)?')) return;
  const g = getGroup();
  g.expenses = g.expenses.filter(e => !ids.includes(e.id));
  saveGroups();
  _expBulkMode = false;
  renderExpenses();
  renderBalances();
  renderStatsBar();
  showToast('\ud83d\uddd1 ' + ids.length + ' expense' + (ids.length !== 1 ? 's' : '') + ' deleted');
}

function splitLabel(exp) {
  if (exp.splitType === 'equal') return `Split equally \u00d7${exp.splits.length}`;
  if (exp.splitType === 'custom') return 'Custom % split';
  return 'Exact split';
}

// ─── BALANCE CALCULATION ──────────────────────────────────────
function calculateBalances(g) {
  const balances = {};
  g.members.forEach(m => { balances[m] = 0; });
  g.expenses.forEach(exp => {
    if (balances[exp.paidBy] !== undefined) balances[exp.paidBy] += parseFloat(exp.amount);
    exp.splits.forEach(s => {
      if (balances[s.name] !== undefined) balances[s.name] -= parseFloat(s.amount);
    });
  });
  g.settlements.forEach(s => {
    if (balances[s.from] !== undefined) balances[s.from] += parseFloat(s.amount);
    if (balances[s.to]   !== undefined) balances[s.to]   -= parseFloat(s.amount);
  });
  // Virtual drink expenses (when Paid-by is set in bottle calculator)
  const pd = g.partyDetails;
  if (pd?.partyType === 'alcohol') {
    BOTTLE_DRINKS.forEach(d => {
      if (!pd.drinks?.includes(d)) return;
      const paidBy = pd.bottlePaidBy?.[d];
      if (!paidBy || balances[paidBy] === undefined) return;
      const price = pd.bottlePrice?.[d];
      if (!price) return;
      const numBottles = pd.bottleCount?.[d] || 1;
      const totalCost  = numBottles * price;
      const totalMl    = g.members.reduce((s, m) => s + ((pd.glasses[d] || {})[m] || 0) * effectiveGlassML(pd, d, m), 0);
      if (totalMl === 0) return;
      balances[paidBy] += totalCost;
      let running = 0, topM = g.members[0], topMl = 0;
      g.members.forEach(m => {
        const ml    = ((pd.glasses[d] || {})[m] || 0) * effectiveGlassML(pd, d, m);
        const share = Math.round((ml / totalMl) * totalCost * 100) / 100;
        if (balances[m] !== undefined) balances[m] -= share;
        running += share;
        if (ml > topMl) { topMl = ml; topM = m; }
      });
      const diff = Math.round((totalCost - running) * 100) / 100;
      if (Math.abs(diff) >= 0.01 && balances[topM] !== undefined) balances[topM] -= diff;
    });
  }
  return { balances, settlements: simplifyDebts(balances) };
}

function simplifyDebts(balances) {
  const cred = [], debt = [];
  Object.entries(balances).forEach(([n, a]) => {
    const r = Math.round(a * 100) / 100;
    if (r > 0.005)  cred.push({ name: n, amt: r });
    if (r < -0.005) debt.push({ name: n, amt: -r });
  });
  cred.sort((a, b) => b.amt - a.amt);
  debt.sort((a, b) => b.amt - a.amt);
  const result = [];
  let i = 0, j = 0;
  while (i < cred.length && j < debt.length) {
    const t = Math.min(cred[i].amt, debt[j].amt);
    if (t > 0.005) result.push({ from: debt[j].name, to: cred[i].name, amount: Math.round(t * 100) / 100 });
    cred[i].amt -= t; debt[j].amt -= t;
    if (cred[i].amt < 0.005) i++;
    if (debt[j].amt < 0.005) j++;
  }
  return result;
}

function renderBalances() {
  const g = getGroup();
  if (!g) return;
  const { balances, settlements } = calculateBalances(g);

  // ── Drink cost panel (Party + alcohol groups with bottle data) ──
  const drinkPanel = document.getElementById('drinkCostPanel');
  if (drinkPanel) {
    const pd = g.partyDetails;
    const bottleDrinks = pd?.partyType === 'alcohol'
      ? (pd.drinks || []).filter(d => BOTTLE_DRINKS.includes(d) && pd.bottlePrice?.[d] > 0)
      : [];
    if (bottleDrinks.length === 0) {
      drinkPanel.innerHTML = '';
    } else {
      let drinkRows = '';
      bottleDrinks.forEach(drink => {
        const price      = pd.bottlePrice[drink];
        const numBottles = pd.bottleCount?.[drink] || 1;
        const totalCost  = numBottles * price;
        const totalMl    = g.members.reduce((s, m) => s + ((pd.glasses[drink] || {})[m] || 0) * effectiveGlassML(pd, drink, m), 0);
        if (totalMl === 0) return;
        // per-member proportional cost
        let running = 0, topM = g.members[0], topMl = 0;
        const memberCosts = {};
        g.members.forEach(m => {
          const ml   = ((pd.glasses[drink] || {})[m] || 0) * effectiveGlassML(pd, drink, m);
          const cost = Math.round((ml / totalMl) * totalCost * 100) / 100;
          memberCosts[m] = cost;
          running += cost;
          if (ml > topMl) { topMl = ml; topM = m; }
        });
        const diff = Math.round((totalCost - running) * 100) / 100;
        if (Math.abs(diff) >= 0.01) memberCosts[topM] = Math.round((memberCosts[topM] + diff) * 100) / 100;

        const paidBy     = pd.bottlePaidBy?.[drink];
        const memberRows = g.members.map(m => `
          <div class="dc-row">
            <div class="dc-av" style="background:${avatarColor(m)}">${m.charAt(0).toUpperCase()}</div>
            <span class="dc-name">${escHtml(m)}</span>
            <span class="dc-cost">${fmt(memberCosts[m])}</span>
          </div>`).join('');
        const paidByNote = paidBy
          ? `<div class="dc-paidby-note">\u2705 Paid by <strong>${escHtml(paidBy)}</strong> \u2014 auto-included in Settlement Plan.<br><span style="color:#b45309;font-size:.72rem">\u26a0\ufe0f If you also recorded a drink expense manually, delete it from Expenses tab to avoid double-counting.</span></div>`
          : `<div class="dc-paidby-note dc-paidby-warn">\u26a0\ufe0f Set &ldquo;Paid by&rdquo; in Members tab to auto-include in Settlement Plan</div>`;
        drinkRows += `
          <div class="dc-drink-block">
            <div class="dc-drink-name">${escHtml(drink)} <span class="dc-drink-meta">${numBottles}\u00d7${pd.bottleSize?.[drink] || 750}ml @ ${fmt(price)}</span></div>
            ${memberRows}
            <div class="dc-row dc-total-row">
              <span class="dc-name" style="flex:1;font-weight:700">Total</span>
              <span class="dc-cost">${fmt(totalCost)}</span>
            </div>
            ${paidByNote}
          </div>`;
      });
      drinkPanel.innerHTML = drinkRows ? `
        <div class="gc-panel dc-panel" style="margin-bottom:.75rem">
          <div class="gc-panel-header" style="justify-content:flex-start">\ud83c\udf76 Drink Costs per Person</div>
          <div class="dc-body">${drinkRows}</div>
        </div>` : '';
      if (drinkRows) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-outline dc-add-exp-btn';
        addBtn.textContent = '\u2795 Add Other Expense';
        addBtn.onclick = () => openAddExpenseModal();
        drinkPanel.appendChild(addBtn);
      }
    }
  }

  // ── All Expenses panel ──
  const expListPanel = document.getElementById('expListPanel');
  if (expListPanel) {
    const pd2 = g.partyDetails;
    let rows = '';
    // Virtual drink expenses (auto-computed from bottle calculator when paidBy is set)
    if (pd2?.partyType === 'alcohol') {
      BOTTLE_DRINKS.forEach(d => {
        if (!pd2.drinks?.includes(d)) return;
        const paidBy = pd2.bottlePaidBy?.[d];
        if (!paidBy || !pd2.bottlePrice?.[d]) return;
        const numBottles = pd2.bottleCount?.[d] || 1;
        const totalCost  = numBottles * pd2.bottlePrice[d];
        rows += `<div class="ell-row">
          <div class="ell-icon">\ud83c\udf76</div>
          <div class="ell-info">
            <div class="ell-desc">${escHtml(d)} <span class="ell-vtag">auto</span></div>
            <div class="ell-meta">Paid by <strong>${escHtml(paidBy)}</strong> &middot; ${numBottles}&times; bottle @ ${fmt(pd2.bottlePrice[d])}</div>
          </div>
          <div class="ell-amount">${fmt(totalCost)}</div>
        </div>`;
      });
    }
    // Manually added expenses (sorted newest first)
    [...g.expenses].sort((a, b) => b.date.localeCompare(a.date)).forEach(exp => {
      rows += `<div class="ell-row">
        <div class="ell-icon">${expenseIcon(exp.description)}</div>
        <div class="ell-info">
          <div class="ell-desc">${escHtml(exp.description)}</div>
          <div class="ell-meta">Paid by <strong>${escHtml(exp.paidBy)}</strong> &middot; ${splitLabel(exp)}</div>
        </div>
        <div class="ell-amount">${fmt(exp.amount)}</div>
      </div>`;
    });
    expListPanel.innerHTML = rows
      ? `<div class="gc-panel ell-panel" style="margin-bottom:.75rem">
          <div class="gc-panel-header" style="justify-content:flex-start">\ud83e\udde7 All Expenses</div>
          <div class="ell-body">${rows}</div>
        </div>`
      : '';
  }

  const summary = document.getElementById('balanceSummary');
  summary.innerHTML = '';

  // Calculate total actually paid by each member (for the "paid" column)
  const totalPaidByMember = {};
  g.members.forEach(m => { totalPaidByMember[m] = 0; });
  g.expenses.forEach(exp => {
    if (totalPaidByMember[exp.paidBy] !== undefined) totalPaidByMember[exp.paidBy] += parseFloat(exp.amount);
  });
  // Include virtual bottle expenses in paid totals
  const pdBal = g.partyDetails;
  if (pdBal?.partyType === 'alcohol') {
    BOTTLE_DRINKS.forEach(d => {
      if (!pdBal.drinks?.includes(d)) return;
      const paidBy = pdBal.bottlePaidBy?.[d];
      if (!paidBy || !pdBal.bottlePrice?.[d]) return;
      if (totalPaidByMember[paidBy] !== undefined)
        totalPaidByMember[paidBy] += (pdBal.bottleCount?.[d] || 1) * pdBal.bottlePrice[d];
    });
  }

  // Section header
  const hdr = document.createElement('div');
  hdr.className = 'bal-summary-hdr';
  hdr.innerHTML = `
    <span class="bal-col-name">Member</span>
    <span class="bal-col-paid">Total Paid</span>
    <span class="bal-col-status">Net Balance</span>
  `;
  summary.appendChild(hdr);

  // Show all members sorted: payers first (positive balance), then others
  Object.entries(balances).sort((a, b) => b[1] - a[1]).forEach(([name, amt]) => {
    const r    = Math.round(amt * 100) / 100;
    const paid = totalPaidByMember[name] || 0;
    let pillClass, label;
    if (r > 0.005)       { pillClass = 'pill-green';   label = `+${fmt(r)} (gets back)`; }
    else if (r < -0.005) { pillClass = 'pill-red';     label = `\u2212${fmt(-r)} (owes)`; }
    else                 { pillClass = 'pill-neutral';  label = 'settled \u2713'; }
    const item = document.createElement('div');
    item.className = 'balance-item bal-item-detailed';
    item.innerHTML = `
      <div class="balance-person">
        <div class="b-avatar" style="background:${avatarColor(name)}">${name.charAt(0).toUpperCase()}</div>
        <span class="b-name">${escHtml(name)}</span>
      </div>
      <span class="bal-paid-amt">${paid > 0 ? fmt(paid) : '<span style="color:var(--text-3)">—</span>'}</span>
      <span class="balance-pill ${pillClass}">${label}</span>
    `;
    summary.appendChild(item);
  });

  const slist = document.getElementById('settlementList');
  slist.innerHTML = '';
  if (settlements.length === 0) {
    slist.innerHTML = '<div class="all-clear"><div class="all-clear-icon">\ud83c\udf89</div>All settled up! No payments needed.</div>';
    return;
  }
  settlements.forEach(s => {
    const item = document.createElement('div');
    item.className = 'settlement-item';
    item.innerHTML = `
      <div class="settlement-flow">
        <span class="s-from">${escHtml(s.from)}</span>
        <div class="s-arrow"></div>
        <span class="s-to">${escHtml(s.to)}</span>
      </div>
      <div class="settlement-right">
        <span class="settlement-amount">${fmt(s.amount)}</span>
        <button class="btn btn-settle" onclick='openSettleModal(${JSON.stringify(s)})'>Settle</button>
        <button class="btn btn-whatsapp" onclick='sendWhatsApp(${JSON.stringify(s.from)},${JSON.stringify(s.to)},${s.amount})' title="Send WhatsApp reminder">\ud83d\udcf2</button>
      </div>
    `;
    slist.appendChild(item);
  });
}

// ─── MEMBERS ──────────────────────────────────────────────────
function renderMembers() {
  const g = getGroup();
  if (!g) return;
  const list = document.getElementById('memberList');
  list.innerHTML = '';
  // Update bulk-select UI
  const memberBulkToggle = document.getElementById('memberBulkToggleBtn');
  if (memberBulkToggle) memberBulkToggle.textContent = _memberBulkMode ? '\u2715 Cancel' : '\u2610 Select';
  const memberBulkBar = document.getElementById('memberBulkBar');
  if (memberBulkBar) memberBulkBar.classList.toggle('hidden', !_memberBulkMode);

  if (g.members.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:1rem 0"><div class="empty-illustration">\ud83d\udc65</div><h3>No members yet</h3><p>Add members using the box above.</p></div>';
  } else {
    const { balances } = calculateBalances(g);
    g.members.forEach(m => {
      // Manual expenses
      let inv  = g.expenses.filter(e => e.paidBy === m || e.splits.some(s => s.name === m)).length;
      let paid = g.expenses.filter(e => e.paidBy === m).reduce((s, e) => s + parseFloat(e.amount), 0);
      // Virtual drink expenses
      const pd = g.partyDetails;
      if (pd?.partyType === 'alcohol') {
        BOTTLE_DRINKS.forEach(d => {
          if (!pd.drinks?.includes(d)) return;
          if (pd.bottlePaidBy?.[d] === m && pd.bottlePrice?.[d]) {
            inv++;
            paid += (pd.bottleCount?.[d] || 1) * pd.bottlePrice[d];
          }
        });
      }
      // Balance pill
      const bal = Math.round((balances[m] || 0) * 100) / 100;
      let balHtml = '';
      if (bal > 0.005)       balHtml = `<span class="balance-pill pill-green member-bal">gets back ${fmt(bal)}</span>`;
      else if (bal < -0.005) balHtml = `<span class="balance-pill pill-red member-bal">owes ${fmt(-bal)}</span>`;
      else if (inv > 0)      balHtml = `<span class="balance-pill pill-neutral member-bal">settled \u2713</span>`;
      // WhatsApp button
      const phone = getMemberPhone(m);
      const waBtn = phone
        ? `<button class="btn-wa-send" onclick="sendWhatsAppToMember('${escHtml(m)}')" title="Send WhatsApp to ${escHtml(m)}">\ud83d\udcf2</button>`
        : `<button class="btn-wa-add" onclick="openAddMemberWAModal('${escHtml(m)}')" title="Add WhatsApp number">+\ud83d\udcf1</button>`;
      const item = document.createElement('div');
      item.className = 'member-item' + (_memberBulkMode ? ' member-item-bulk' : '');
      item.innerHTML = `
        ${_memberBulkMode ? `<input type="checkbox" class="member-bulk-check" value="${escHtml(m)}" onchange="updateMemberBulkCount()" />` : ''}
        <div class="member-avatar" style="background:${avatarColor(m)}">${m.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${escHtml(m)}</div>
          <div class="member-meta">${inv} expense${inv !== 1 ? 's' : ''} \u00b7 paid ${fmt(paid)}</div>
        </div>
        ${balHtml}
        ${waBtn}
        ${!_memberBulkMode ? `<button class="member-remove" onclick="deleteMember('${escHtml(m)}')" title="Remove">\ud83d\uddd1</button>` : ''}
      `;
      list.appendChild(item);
    });
  }
  renderPartySetupInGroup();
}

// ─── MEMBER BULK SELECT ────────────────────────────────────────
function toggleMemberBulkMode() {
  _memberBulkMode = !_memberBulkMode;
  renderMembers();
}
function updateMemberBulkCount() {
  const n = document.querySelectorAll('.member-bulk-check:checked').length;
  const el = document.getElementById('memberBulkCount');
  if (el) el.textContent = n + ' selected';
}
function bulkDeleteMembers() {
  const checked = [...document.querySelectorAll('.member-bulk-check:checked')].map(c => c.value);
  if (checked.length === 0) { showToast('\u26a0\ufe0f Select at least one member', 'error'); return; }
  if (!confirm('Remove ' + checked.length + ' member(s)? This will not delete their expenses.')) return;
  const g = getGroup();
  checked.forEach(name => { g.members = g.members.filter(m => m !== name); });
  logActivity(g, '\ud83d\uddd1 ' + checked.length + ' member(s) removed (bulk)');
  saveGroups();
  _memberBulkMode = false;
  renderMembers();
  renderStatsBar();
  renderPartySetupInGroup();
  showToast('\ud83d\uddd1 ' + checked.length + ' member' + (checked.length !== 1 ? 's' : '') + ' removed');
}

function bulkAddMembers() {
  const input = document.getElementById('bulkMembersInput');
  if (!input) return;
  const g = getGroup();
  const names = input.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
  let added = 0;
  names.forEach(name => {
    if (!g.members.map(m => m.toLowerCase()).includes(name.toLowerCase())) {
      g.members.push(name);
      added++;
    }
  });
  if (added === 0) { showToast('\u26a0\ufe0f No new members to add', 'error'); return; }
  saveGroups();
  input.value = '';
  renderMembers();
  renderStatsBar();
  showToast('\u2705 ' + added + ' member' + (added > 1 ? 's' : '') + ' added');
}

// ─── PARTY SETUP IN GROUP DETAIL ──────────────────────────────
function renderPartySetupInGroup() {
  const setupSection = document.getElementById('partySetupSection');
  if (!setupSection) return;
  const g = getGroup();
  if (!g || !g.partyDetails || g.partyDetails.partyType !== 'alcohol' || !g.partyDetails.drinks?.length) {
    setupSection.innerHTML = '';
    return;
  }
  const pd      = g.partyDetails;
  const members = g.members;

  // Init maps for current members / drinks
  if (!pd.bottleSize)       pd.bottleSize       = {};
  if (!pd.bottlePrice)      pd.bottlePrice      = {};
  if (!pd.bottleCount)      pd.bottleCount      = {};
  if (!pd.bottlePaidBy)     pd.bottlePaidBy     = {};
  if (!pd.memberGlassSize)  pd.memberGlassSize  = {};
  members.forEach(m => { if (!pd.memberGlassSize[m]) pd.memberGlassSize[m] = ML_PER_GLASS; });
  pd.drinks.forEach(drink => {
    if (!pd.glasses[drink]) pd.glasses[drink] = {};
    members.forEach(m => { if (pd.glasses[drink][m] === undefined) pd.glasses[drink][m] = 1; });
    // Remove members no longer in group
    Object.keys(pd.glasses[drink]).forEach(m => { if (!members.includes(m)) delete pd.glasses[drink][m]; });
  });
  saveGroups();

  if (members.length === 0) {
    setupSection.innerHTML = `
      <div class="gc-panel" style="margin-top:1rem">
        <div class="gc-panel-header">\ud83e\udd43 Glasses per Person per Drink</div>
        <div class="glass-no-members">\u26a0\ufe0f Add members above to assign glasses</div>
      </div>`;
    return;
  }

  // ── Glass assignment panel ────────────────────────────────────
  let glassRows = '';
  pd.drinks.forEach(drink => {
    let memberRows = '';
    const isBotUnit = BOTTLE_UNIT_DRINKS.includes(drink);
    members.forEach(member => {
      const count  = pd.glasses[drink][member] ?? 1;
      const mgs    = pd.memberGlassSize?.[member] || ML_PER_GLASS;
      const safeId = 'gd_' + drink.replace(/[^a-zA-Z0-9]/g,'_') + '__' + member.replace(/[^a-zA-Z0-9]/g,'_');
      const sizePart = isBotUnit
        ? '<span class="gc-unit-label">\ud83c\udf7a bottles</span>'
        : `<div class="glass-size-btns">
          <button type="button" class="glass-size-btn${mgs===30?' active':''}" onclick="gdSetMemberGlassSize('${escHtml(member)}',30)">30ml</button>
          <button type="button" class="glass-size-btn${mgs===60?' active':''}" onclick="gdSetMemberGlassSize('${escHtml(member)}',60)">60ml</button>
          <button type="button" class="glass-size-btn${mgs===90?' active':''}" onclick="gdSetMemberGlassSize('${escHtml(member)}',90)">90ml</button>
        </div>`;
      memberRows += `<div class="glass-count-row">
        <div class="glass-member-avatar" style="background:${avatarColor(member)}">${member.charAt(0).toUpperCase()}</div>
        <span class="glass-count-label">${escHtml(member)}</span>
        ${sizePart}
        <div class="glass-counter">
          <button type="button" class="glass-btn" onclick="gdChangeGlass('${escHtml(drink)}','${escHtml(member)}',-1)">\u2212</button>
          <span class="glass-num" id="${safeId}">${count}</span>
          <button type="button" class="glass-btn" onclick="gdChangeGlass('${escHtml(drink)}','${escHtml(member)}',1)">+</button>
        </div>
      </div>`;
    });
    glassRows += `<div class="glass-drink-section"><div class="glass-drink-header">${escHtml(drink)}</div>${memberRows}</div>`;
  });

  const totals = {};
  members.forEach(m => { totals[m] = pd.drinks.reduce((s, d) => s + ((pd.glasses[d] || {})[m] || 0), 0); });
  const totalCells = members.map(m =>
    `<span class="glass-total-cell"><span class="glass-total-name">${escHtml(m)}</span><strong>${totals[m]}</strong></span>`
  ).join('');
  const totalRow = `<div class="glass-total-row gd-total-row"><span style="font-weight:600;">\ud83e\udd43 Total per person</span><div class="glass-total-cells">${totalCells}</div></div>`;

  // ── Bottle calculator panel ───────────────────────────────────
  const bottleDrinks = pd.drinks.filter(d => BOTTLE_DRINKS.includes(d));
  let bottleHtml = '';
  bottleDrinks.forEach(drink => {
    const SIZES    = BOTTLE_UNIT_DRINKS.includes(drink) ? [330, 500, 650, 1000] : [375, 500, 750, 1000];
    const curSize  = pd.bottleSize[drink]  || (BOTTLE_UNIT_DRINKS.includes(drink) ? 330 : 750);
    const curCount = pd.bottleCount[drink] || 1;
    const curPrice = pd.bottlePrice[drink] || 0;
    pd.bottleSize[drink]  = curSize;
    pd.bottleCount[drink] = curCount;
    const sd = drink.replace(/[^a-zA-Z0-9]/g, '_');
    const sizeHtml = SIZES.map(s =>
      `<button type="button" class="bottle-size-btn${s === curSize ? ' active' : ''}" data-sz="${s}" onclick="gdSetBottleSize('${escHtml(drink)}',${s})">${s < 1000 ? s + 'ml' : '1L'}</button>`
    ).join('');
    bottleHtml += `<div class="bottle-calc-section">
      <div class="bc-drink-name">${escHtml(drink)}</div>
      <div class="bc-row"><span class="bc-label">Size</span><div class="bc-size-btns">${sizeHtml}</div></div>
      <div class="bc-row">
        <span class="bc-label">No. of Bottles</span>
        <div class="bc-count-wrap">
          <button type="button" class="bc-count-btn" onclick="gdSetBottleCount('${escHtml(drink)}', Math.max(1,(getGroup().partyDetails.bottleCount?.['${escHtml(drink)}']||1)-1))">\u2212</button>
          <input type="number" id="gdbccount_${sd}" class="bc-count-input" value="${curCount}" min="1" max="50" step="1" oninput="gdSetBottleCount('${escHtml(drink)}', this.value)" />
          <button type="button" class="bc-count-btn" onclick="gdSetBottleCount('${escHtml(drink)}', (getGroup().partyDetails.bottleCount?.['${escHtml(drink)}']||1)+1)">+</button>
        </div>
      </div>
      <div class="bc-row">
        <span class="bc-label">Price / bottle</span>
        <div class="bc-price-wrap">
          <span class="bc-rupee">\u20b9</span>
          <input type="number" id="gdbcprice_${sd}" class="bc-price-input" placeholder="0" min="0" step="1" value="${curPrice || ''}" oninput="gdSetBottlePrice('${escHtml(drink)}', this.value)" />
        </div>
      </div>
      <div class="bc-total-line${curPrice ? '' : ' hidden'}" id="gdbctotal_${sd}"></div>
      <div class="bc-row">
        <span class="bc-label">Paid by</span>
        <select class="bc-paidby" onchange="gdSetBottlePaidBy('${escHtml(drink)}',this.value)">
          <option value="">\u2014 select \u2014</option>
          ${members.map(m => `<option value="${escHtml(m)}"${pd.bottlePaidBy[drink]===m?' selected':''}>${escHtml(m)}</option>`).join('')}
        </select>
      </div>
      <div class="bc-preview" id="gdbcpreview_${sd}"></div>
    </div>`;
  });

  setupSection.innerHTML = `
    <div class="gc-panel" style="margin-top:1rem">
      <div class="gc-panel-header">\ud83e\udd43 Glasses per Person per Drink</div>
      <div class="glass-count-grid">${glassRows}</div>
      ${totalRow}
    </div>
    ${bottleDrinks.length ? `
    <div class="gc-panel gc-panel-bottle" style="margin-top:.75rem">
      <div class="gc-panel-header">\ud83c\udf76 Bottle Calculator <span class="gc-panel-sub">cost split by glasses consumed</span></div>
      ${bottleHtml}
    </div>` : ''}
  `;

  // Populate bottle total lines + previews after render
  bottleDrinks.forEach(d => gdUpdateBottlePreview(d));
}

function gdChangeGlass(drink, member, delta) {
  const g  = getGroup();
  const pd = g.partyDetails;
  if (!pd) return;
  if (!pd.glasses[drink]) pd.glasses[drink] = {};
  pd.glasses[drink][member] = Math.max(0, (pd.glasses[drink][member] ?? 1) + delta);
  saveGroups();
  const safeId = 'gd_' + drink.replace(/[^a-zA-Z0-9]/g,'_') + '__' + member.replace(/[^a-zA-Z0-9]/g,'_');
  const span = document.getElementById(safeId);
  if (span) span.textContent = pd.glasses[drink][member];
  // Refresh total row
  const totals = {};
  g.members.forEach(m => { totals[m] = pd.drinks.reduce((s, d) => s + ((pd.glasses[d] || {})[m] || 0), 0); });
  const totalRow = document.querySelector('.gd-total-row .glass-total-cells');
  if (totalRow) totalRow.innerHTML = g.members.map(m =>
    `<span class="glass-total-cell"><span class="glass-total-name">${escHtml(m)}</span><strong>${totals[m]}</strong></span>`
  ).join('');
  if (BOTTLE_DRINKS.includes(drink)) gdUpdateBottlePreview(drink);
}

function gdSetBottleSize(drink, size) {
  const g = getGroup();
  if (!g.partyDetails) return;
  g.partyDetails.bottleSize[drink] = size;
  saveGroups();
  const sd = drink.replace(/[^a-zA-Z0-9]/g, '_');
  document.getElementById('gdbcpreview_' + sd)?.closest('.bottle-calc-section')
    ?.querySelectorAll('.bottle-size-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.sz) === size));
  gdUpdateBottlePreview(drink);
}
function gdSetBottleCount(drink, val) {
  const g = getGroup();
  if (!g.partyDetails) return;
  const n = Math.max(1, parseInt(val) || 1);
  g.partyDetails.bottleCount[drink] = n;
  saveGroups();
  const inp = document.getElementById('gdbccount_' + drink.replace(/[^a-zA-Z0-9]/g,'_'));
  if (inp) inp.value = n;
  gdUpdateBottlePreview(drink);
}
function gdSetBottlePrice(drink, val) {
  const g = getGroup();
  if (!g.partyDetails) return;
  g.partyDetails.bottlePrice[drink] = parseFloat(val) || 0;
  saveGroups();
  gdUpdateBottlePreview(drink);
}
function gdSetBottlePaidBy(drink, member) {
  const g = getGroup();
  if (!g?.partyDetails) return;
  if (!g.partyDetails.bottlePaidBy) g.partyDetails.bottlePaidBy = {};
  g.partyDetails.bottlePaidBy[drink] = member || '';
  saveGroups();
  // Refresh balance tab if it's active
  const balTab = document.getElementById('tabBalances');
  if (balTab && !balTab.classList.contains('hidden')) renderBalances();
}
function gdSetMemberGlassSize(member, size) {
  const g = getGroup();
  if (!g?.partyDetails) return;
  if (!g.partyDetails.memberGlassSize) g.partyDetails.memberGlassSize = {};
  g.partyDetails.memberGlassSize[member] = size;
  saveGroups();
  renderPartySetupInGroup();
}
function gdSetGlassSize(size) {
  const g = getGroup();
  if (!g?.partyDetails) return;
  g.partyDetails.glassSize = size;
  saveGroups();
  renderPartySetupInGroup();
}
function gdUpdateBottlePreview(drink) {
  const g = getGroup();
  if (!g?.partyDetails) return;
  const pd = g.partyDetails;
  const sd = drink.replace(/[^a-zA-Z0-9]/g, '_');
  const preview = document.getElementById('gdbcpreview_' + sd);
  const totalEl = document.getElementById('gdbctotal_' + sd);
  if (!preview) return;
  const size       = pd.bottleSize?.[drink]  || 750;
  const price      = pd.bottlePrice?.[drink] || 0;
  const numBottles = pd.bottleCount?.[drink] || 1;
  const totalCost  = numBottles * price;
  if (totalEl) {
    totalEl.textContent = price ? `${numBottles} \u00d7 ${size < 1000 ? size + 'ml' : '1L'} @ ${fmt(price)} = ${fmt(totalCost)}` : '';
    totalEl.classList.toggle('hidden', !price);
  }
  const glassSize  = pd.glassSize || ML_PER_GLASS;
  if (!price || !g.members.length) { preview.innerHTML = ''; return; }
  const totalMl = g.members.reduce((s, m) => s + (pd.glasses[drink]?.[m] || 0) * effectiveGlassML(pd, drink, m), 0);
  if (totalMl === 0) { preview.innerHTML = '<div class="bc-preview-title" style="color:#b45309">Assign glasses above to see cost split</div>'; return; }
  // Proportional: (member_ml / total_consumed_ml) × totalCost — total always equals bottle price
  const rows = g.members.map(m => {
    const glasses  = (pd.glasses[drink] || {})[m] || 0;
    const memberGs = effectiveGlassML(pd, drink, m);
    const ml   = glasses * memberGs;
    const cost = Math.round((ml / totalMl) * totalCost * 100) / 100;
    const mlLabel = BOTTLE_UNIT_DRINKS.includes(drink)
      ? `${glasses} bottle${glasses !== 1 ? 's' : ''} = ${ml}ml`
      : `${glasses}g \u00d7 ${memberGs}ml = ${ml}ml`;
    return `<div class="bsp-row"><div class="bsp-av" style="background:${avatarColor(m)}">${m.charAt(0).toUpperCase()}</div><span class="bsp-name">${escHtml(m)}</span><span class="bsp-ml">${mlLabel}</span><span class="bsp-cost">${fmt(cost)}</span></div>`;
  }).join('');
  preview.innerHTML = `<div class="bc-preview-title">Cost per person</div>${rows}
    <div class="bsp-row bsp-total"><span class="bsp-name" style="flex:1;font-weight:700">Total</span><span class="bsp-cost">${fmt(totalCost)}</span></div>`;
}

// ─── MODALS ───────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ─── NEW GROUP ────────────────────────────────────────────────
// ─── PARTY OPTIONS ───────────────────────────────────────────
const BOTTLE_DRINKS      = ['Whiskey', 'Rum', 'Beer'];
const BOTTLE_UNIT_DRINKS = ['Beer']; // counted by whole bottle — no per-person ml size needed
const ML_PER_GLASS       = 60;
function effectiveGlassML(pd, drink, member) {
  // For bottle-unit drinks (Beer), ml per unit = the bottle size; for spirits use per-person sip size
  return BOTTLE_UNIT_DRINKS.includes(drink) ? (pd.bottleSize?.[drink] || 330) : (pd.memberGlassSize?.[member] || ML_PER_GLASS);
}
let partyState = { type: 'non-alcohol', drinks: [], glasses: {}, bottleSize: {}, bottlePrice: {}, bottleCount: {} };

function selectPartyType(ptype) {
  partyState.type = ptype;
  partyState.drinks = [];
  partyState.glasses = {};
  partyState.bottleSize  = {};
  partyState.bottlePrice = {};
  partyState.bottleCount = {};
  document.querySelectorAll('.party-type-btn').forEach(b => b.classList.toggle('active', b.dataset.ptype === ptype));
  document.getElementById('partyNonAlcohol').classList.toggle('hidden', ptype !== 'non-alcohol');
  document.getElementById('partyAlcohol').classList.toggle('hidden', ptype !== 'alcohol');
  // Reset checkboxes
  const grid = ptype === 'alcohol' ? 'alcoholGrid' : 'nonAlcoholGrid';
  document.querySelectorAll('#' + grid + ' .drink-chip').forEach(c => {
    c.classList.remove('checked');
    const cb = c.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = false;
  });
  // glass/bottle panels were moved to group detail — no DOM refs here
}

function initDrinkChips() {
  document.querySelectorAll('.drink-chip').forEach(chip => {
    const cb = chip.querySelector('input[type="checkbox"]');
    cb.addEventListener('change', () => {
      chip.classList.toggle('checked', cb.checked);
      const isAlcohol = chip.closest('#alcoholGrid') !== null;
      if (isAlcohol) refreshGlassCount();
    });
  });
}

function getPartyMembers() {
  return (document.getElementById('inputMembers')?.value || '')
    .split('\n').map(m => m.trim()).filter(m => m.length > 0);
}

function refreshGlassCount() {
  // Glass assignment now lives in the group detail (Members tab)
  // Nothing to do in the create modal
}

function renderGlassCount(drinks) {
  const grid    = document.getElementById('glassCountGrid');
  const bcGrid  = document.getElementById('bottleCalcGrid');
  const members = getPartyMembers();
  grid.innerHTML   = '';
  bcGrid.innerHTML = '';

  if (members.length === 0) {
    grid.innerHTML = '<div class="glass-no-members">⚠️ Add members above to assign glasses</div>';
    document.getElementById('bottleCalcSection').classList.add('hidden');
    renderGlassTotal(drinks, members);
    return;
  }

  // ── Panel A: glass assignment per drink ──────────────────────
  drinks.forEach(drink => {
    if (!partyState.glasses[drink]) partyState.glasses[drink] = {};
    members.forEach(m => { if (partyState.glasses[drink][m] === undefined) partyState.glasses[drink][m] = 1; });
    Object.keys(partyState.glasses[drink]).forEach(m => { if (!members.includes(m)) delete partyState.glasses[drink][m]; });

    const section = document.createElement('div');
    section.className = 'glass-drink-section';
    section.innerHTML = `<div class="glass-drink-header">${escHtml(drink)}</div>`;

    members.forEach(member => {
      const count  = partyState.glasses[drink][member] ?? 1;
      const safeId = 'glass_' + drink.replace(/[^a-zA-Z0-9]/g,'_') + '__' + member.replace(/[^a-zA-Z0-9]/g,'_');
      const row = document.createElement('div');
      row.className = 'glass-count-row';
      row.innerHTML = `
        <div class="glass-member-avatar" style="background:${avatarColor(member)}">${member.charAt(0).toUpperCase()}</div>
        <span class="glass-count-label">${escHtml(member)}</span>
        <div class="glass-counter">
          <button type="button" class="glass-btn" onclick="changeGlass('${escHtml(drink)}','${escHtml(member)}',-1)">−</button>
          <span class="glass-num" id="${safeId}">${count}</span>
          <button type="button" class="glass-btn" onclick="changeGlass('${escHtml(drink)}','${escHtml(member)}',1)">+</button>
        </div>
      `;
      section.appendChild(row);
    });
    grid.appendChild(section);
  });

  renderGlassTotal(drinks, members);

  // ── Panel B: bottle calculator (Whiskey / Rum only) ──────────
  const bottleDrinks = drinks.filter(d => BOTTLE_DRINKS.includes(d));
  const bcSection = document.getElementById('bottleCalcSection');
  if (bottleDrinks.length === 0) {
    bcSection.classList.add('hidden');
    return;
  }
  bcSection.classList.remove('hidden');
  bottleDrinks.forEach(drink => bcGrid.appendChild(buildBottleCalcRow(drink, members)));
}

function changeGlass(drink, member, delta) {
  if (!partyState.glasses[drink]) partyState.glasses[drink] = {};
  partyState.glasses[drink][member] = Math.max(0, (partyState.glasses[drink][member] ?? 1) + delta);
  const safeId = 'glass_' + drink.replace(/[^a-zA-Z0-9]/g,'_') + '__' + member.replace(/[^a-zA-Z0-9]/g,'_');
  const span = document.getElementById(safeId);
  if (span) span.textContent = partyState.glasses[drink][member];
  const drinks = [...document.querySelectorAll('#alcoholGrid .drink-chip.checked')].map(c => c.querySelector('input').value);
  renderGlassTotal(drinks, getPartyMembers());
  // Refresh bottle cost preview when glass count changes
  if (BOTTLE_DRINKS.includes(drink)) updateBottleCalcPreview(drink, getPartyMembers());
}

function renderGlassTotal(drinks, members) {
  document.querySelector('.glass-total-row')?.remove();
  if (!members || members.length === 0 || drinks.length === 0) return;
  // Per-member total across all drinks
  const totals = {};
  members.forEach(m => {
    totals[m] = drinks.reduce((s, d) => s + ((partyState.glasses[d] || {})[m] || 0), 0);
  });
  const grid = document.getElementById('glassCountGrid');
  const div  = document.createElement('div');
  div.className = 'glass-total-row';
  const cells = members.map(m =>
    `<span class="glass-total-cell"><span class="glass-total-name">${escHtml(m)}</span><strong>${totals[m]}</strong></span>`
  ).join('');
  div.innerHTML = `<span style="font-weight:600;">🥃 Total per person</span><div class="glass-total-cells">${cells}</div>`;
  grid.after(div);
}

// ─── BOTTLE CALCULATOR (Whiskey / Rum) ───────────────────────
function buildBottleCalcRow(drink, members) {
  const SIZES    = [375, 500, 750, 1000];
  const curSize  = partyState.bottleSize[drink]  || 750;
  const curCount = partyState.bottleCount[drink] || 1;
  const curPrice = partyState.bottlePrice[drink] || 0;
  partyState.bottleSize[drink]  = curSize;
  partyState.bottleCount[drink] = curCount;
  const sd = drink.replace(/[^a-zA-Z0-9]/g, '_');

  const sizeHtml = SIZES.map(s =>
    `<button type="button" class="bottle-size-btn${s === curSize ? ' active' : ''}" data-sz="${s}" onclick="setBottleSize('${escHtml(drink)}',${s})">${s < 1000 ? s + 'ml' : '1L'}</button>`
  ).join('');

  const wrap = document.createElement('div');
  wrap.className = 'bottle-calc-section';
  wrap.innerHTML = `
    <div class="bc-drink-name">${escHtml(drink)}</div>
    <div class="bc-row">
      <span class="bc-label">Size</span>
      <div class="bc-size-btns">${sizeHtml}</div>
    </div>
    <div class="bc-row">
      <span class="bc-label">No. of Bottles</span>
      <div class="bc-count-wrap">
        <button type="button" class="bc-count-btn" onclick="setBottleCount('${escHtml(drink)}', Math.max(1,(partyState.bottleCount['${escHtml(drink)}']||1)-1))">−</button>
        <input type="number" id="bccount_${sd}" class="bc-count-input" value="${curCount}" min="1" max="50" step="1"
          oninput="setBottleCount('${escHtml(drink)}', this.value)" />
        <button type="button" class="bc-count-btn" onclick="setBottleCount('${escHtml(drink)}', (partyState.bottleCount['${escHtml(drink)}']||1)+1)">+</button>
      </div>
    </div>
    <div class="bc-row">
      <span class="bc-label">Price / bottle</span>
      <div class="bc-price-wrap">
        <span class="bc-rupee">₹</span>
        <input type="number" id="bcprice_${sd}" class="bc-price-input" placeholder="0" min="0" step="1"
          value="${curPrice || ''}" oninput="setBottlePrice('${escHtml(drink)}', this.value)" />
      </div>
    </div>
    <div class="bc-total-line" id="bctotal_${sd}"></div>
    <div class="bc-preview" id="bcpreview_${sd}"></div>
  `;
  if (curPrice > 0) setTimeout(() => updateBottleCalcPreview(drink, members), 0);
  return wrap;
}

function setBottleSize(drink, size) {
  partyState.bottleSize[drink] = size;
  const sd = drink.replace(/[^a-zA-Z0-9]/g, '_');
  const preview = document.getElementById('bcpreview_' + sd);
  preview?.closest('.bottle-calc-section')
         ?.querySelectorAll('.bottle-size-btn')
         .forEach(b => b.classList.toggle('active', parseInt(b.dataset.sz) === size));
  updateBottleCalcPreview(drink, getPartyMembers());
}

function setBottleCount(drink, val) {
  const n = Math.max(1, parseInt(val) || 1);
  partyState.bottleCount[drink] = n;
  const sd  = drink.replace(/[^a-zA-Z0-9]/g, '_');
  const inp = document.getElementById('bccount_' + sd);
  if (inp) inp.value = n;
  updateBottleCalcPreview(drink, getPartyMembers());
}

function setBottlePrice(drink, val) {
  partyState.bottlePrice[drink] = parseFloat(val) || 0;
  updateBottleCalcPreview(drink, getPartyMembers());
}

function updateBottleCalcPreview(drink, members) {
  const sd      = drink.replace(/[^a-zA-Z0-9]/g, '_');
  const preview = document.getElementById('bcpreview_' + sd);
  const totalEl = document.getElementById('bctotal_' + sd);
  if (!preview) return;
  const size     = partyState.bottleSize[drink]  || 750;
  const price    = partyState.bottlePrice[drink] || 0;
  const numBottles = partyState.bottleCount[drink] || 1;
  const totalCost  = numBottles * price;

  // Show / hide total-cost summary line
  if (totalEl) {
    totalEl.textContent = price
      ? `${numBottles} × ${size < 1000 ? size + 'ml' : '1L'} @ ${fmt(price)} = ${fmt(totalCost)}`
      : '';
    totalEl.classList.toggle('hidden', !price);
  }

  if (!price || !members || members.length === 0) { preview.innerHTML = ''; return; }

  const hasGlasses = members.some(m => (partyState.glasses[drink]?.[m] || 0) > 0);
  if (!hasGlasses) {
    preview.innerHTML = `<div class="bc-preview-title" style="color:#b45309">Assign glasses above to see cost split</div>`;
    return;
  }

  // (price / size) × glasses × ML_PER_GLASS
  const pricePerMl = price / size;
  const rows = members.map(m => {
    const glasses = (partyState.glasses[drink] || {})[m] || 0;
    const ml      = glasses * ML_PER_GLASS;
    const cost    = Math.round(pricePerMl * ml * 100) / 100;
    return `<div class="bsp-row">
      <div class="bsp-av" style="background:${avatarColor(m)}">${m.charAt(0).toUpperCase()}</div>
      <span class="bsp-name">${escHtml(m)}</span>
      <span class="bsp-ml">${glasses}g × ${ML_PER_GLASS}ml = ${ml}ml</span>
      <span class="bsp-cost">${fmt(cost)}</span>
    </div>`;
  }).join('');
  const shownTotal = Math.round(pricePerMl * members.reduce((s, m) => s + (partyState.glasses[drink]?.[m] || 0) * ML_PER_GLASS, 0) * 100) / 100;

  preview.innerHTML = `
    <div class="bc-preview-title">Cost per person</div>
    ${rows}
    <div class="bsp-row bsp-total">
      <span class="bsp-name" style="flex:1;font-weight:700">Total consumed</span>
      <span class="bsp-cost">${fmt(shownTotal)}</span>
    </div>
  `;
}

function openNewGroupModal() {
  document.getElementById('inputGroupName').value = '';
  document.querySelectorAll('.type-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  // Reset party options
  document.getElementById('partyOptions').classList.add('hidden');
  partyState = { type: 'non-alcohol', drinks: [], glasses: {}, bottleSize: {}, bottlePrice: {}, bottleCount: {} };
  document.getElementById('partyNonAlcohol').classList.add('hidden');
  document.getElementById('partyAlcohol').classList.add('hidden');
  document.querySelectorAll('.drink-chip').forEach(c => {
    c.classList.remove('checked');
    const cb = c.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = false;
  });
  document.querySelectorAll('.party-type-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  // Reset currency selector
  _selectedCurrency = '\u20b9';
  document.querySelectorAll('.currency-btn').forEach(b => b.classList.toggle('active', b.dataset.currency === '\u20b9'));
  // Show contacts with checkboxes for member selection
  const contacts = getContacts();
  const ctSection = document.getElementById('newGroupContactsSection');
  if (ctSection) {
    ctSection.className = 'new-group-contacts-section';
    // Current user row (always shown, always checked, can't be deselected)
    const youRow = '<div class="ct-select-item ct-you-row">' +
      '<input type="checkbox" class="ct-select-check ct-you-check" value="' + escHtml(currentUser.name) + '" checked disabled />' +
      '<div class="ct-sel-av" style="background:' + avatarColor(currentUser.name) + '">' + currentUser.name.charAt(0).toUpperCase() + '</div>' +
      '<div class="ct-sel-info">' +
        '<span class="ct-sel-name">' + escHtml(currentUser.name) + ' <span class="ct-you-tag">You</span></span>' +
      '</div>' +
    '</div>';
    // Filter out current user from contacts to avoid duplicate
    const otherContacts = contacts.filter(function(c) { return c.name.toLowerCase() !== currentUser.name.toLowerCase(); });
    if (otherContacts.length > 0) {
      ctSection.innerHTML =
        '<div class="ct-select-hdr">' +
          '<span>\ud83d\udccc Members:</span>' +
          '<button type="button" class="link-btn ct-toggle-all" onclick="toggleAllContactChecks(this)">Deselect All</button>' +
        '</div>' +
        '<div class="ct-select-list">' +
        youRow +
        otherContacts.map(function(c) {
          return '<label class="ct-select-item">' +
            '<input type="checkbox" class="ct-select-check" value="' + escHtml(c.name) + '" checked />' +
            '<div class="ct-sel-av" style="background:' + avatarColor(c.name) + '">' + c.name.charAt(0).toUpperCase() + '</div>' +
            '<div class="ct-sel-info">' +
              '<span class="ct-sel-name">' + escHtml(c.name) + '</span>' +
              (c.phone ? '<span class="ct-sel-phone">\ud83d\udcf1 +91 ' + c.phone.replace(/\D/g,'').slice(-10) + '</span>' : '') +
            '</div>' +
          '</label>';
        }).join('') +
        '</div>';
    } else {
      // No contacts other than self — still show the You row
      ctSection.innerHTML =
        '<div class="ct-select-hdr"><span>\ud83d\udccc Members:</span></div>' +
        '<div class="ct-select-list">' + youRow + '</div>';
    }
  }
  openModal('modalNewGroup');
  setTimeout(() => document.getElementById('inputGroupName').focus(), 60);
}
function toggleAllContactChecks(btn) {
  const checks = document.querySelectorAll('#newGroupContactsSection .ct-select-check');
  const allChecked = [...checks].every(c => c.checked);
  checks.forEach(c => { c.checked = !allChecked; });
  btn.textContent = allChecked ? 'Select All' : 'Deselect All';
}

function createGroup() {
  const name = document.getElementById('inputGroupName').value.trim();
  if (!name) { showToast('\u26a0\ufe0f Enter a group name', 'error'); return; }
  const activeType = document.querySelector('.type-btn.active');
  const type  = activeType?.dataset.type  || 'Other';
  const emoji = activeType?.dataset.emoji || '\ud83d\udce6';

  // Collect party details (glasses/bottle data filled in group detail later)
  let partyDetails = null;
  if (type === 'Party') {
    const isAlcohol = partyState.type === 'alcohol';
    const grid = isAlcohol ? '#alcoholGrid' : '#nonAlcoholGrid';
    const drinks = [...document.querySelectorAll(grid + ' .drink-chip.checked')]
      .map(c => c.querySelector('input').value);
    partyDetails = {
      partyType: partyState.type,
      drinks,
      glasses: {}, bottleSize: {}, bottlePrice: {}, bottleCount: {}
    };
  }

  const contactMembers = [];
  document.querySelectorAll('#newGroupContactsSection .ct-select-check:checked').forEach(function(cb) {
    contactMembers.push(cb.value);
  });
  // Always include the group creator as the first member
  const allMembers = [currentUser.name];
  contactMembers.forEach(function(m) {
    if (m.toLowerCase() !== currentUser.name.toLowerCase()) allMembers.push(m);
  });
  const group = { id: uid(), name, type, emoji, currency: _selectedCurrency || '\u20b9', members: allMembers, expenses: [], settlements: [], partyDetails, activity: [] };
  state.groups.unshift(group);
  saveGroups();
  closeModal('modalNewGroup');
  // Navigate directly into the new group so user can add members & party setup
  openGroup(group.id);
  // Open the Members tab so they can start adding members right away
  switchTab('members');
  showToast('\u2705 "' + name + '" created! Add members below.');
}
function deleteGroup(id, e) {
  e.stopPropagation();
  const g = getGroup(id);
  if (!confirm('Delete group "' + g.name + '"? All expenses will be lost.')) return;
  state.groups = state.groups.filter(x => x.id !== id);
  saveGroups();
  renderHome();
  showToast('\ud83d\uddd1 Group deleted');
}

// ─── MEMBER PHONE HELPERS ─────────────────────────────────────
function getMemberPhone(memberName) {
  // 1. Check contacts
  const cp = getContactPhone(memberName);
  if (cp) return cp;
  // 2. Check current group's memberPhones map
  if (state.currentGroupId) {
    const g = getGroup();
    if (g && g.memberPhones && g.memberPhones[memberName]) return g.memberPhones[memberName];
  }
  return '';
}

let _memberWATarget = '';
function openAddMemberWAModal(memberName) {
  _memberWATarget = memberName;
  document.getElementById('memberWAName').textContent = memberName;
  document.getElementById('memberWAInput').value = '';
  openModal('modalMemberWA');
  setTimeout(() => document.getElementById('memberWAInput').focus(), 60);
}
function saveMemberWA() {
  const phone = document.getElementById('memberWAInput').value.trim().replace(/\D/g, '').slice(-10);
  if (!phone || phone.length < 10) { showToast('\u26a0\ufe0f Enter a valid 10-digit number', 'error'); return; }
  const g = getGroup();
  if (!g) return;
  if (!g.memberPhones) g.memberPhones = {};
  g.memberPhones[_memberWATarget] = phone;
  saveGroups();
  closeModal('modalMemberWA');
  renderMembers();
  showToast('\u2705 WhatsApp number saved for ' + _memberWATarget);
}
function sendWhatsAppToMember(memberName) {
  const phone = getMemberPhone(memberName);
  if (!phone) { showToast('\u26a0\ufe0f No number saved for ' + memberName, 'error'); return; }
  const g = getGroup();
  const { balances } = calculateBalances(g);
  const bal = Math.round((balances[memberName] || 0) * 100) / 100;
  let msg;
  if (bal < -0.005) {
    msg = 'Hi ' + memberName + '! \ud83d\udc4b\n\neHisaab \ud83d\udcb8 Reminder\n\n\ud83d\udccb Group: ' + (g ? g.name : '') + '\n\ud83d\udcb3 You owe ' + fmt(-bal) + '\n\nPlease transfer at your earliest convenience. \ud83d\ude4f';
  } else if (bal > 0.005) {
    msg = 'Hi ' + memberName + '! \ud83d\udc4b\n\neHisaab \ud83d\udcb8 Update\n\n\ud83d\udccb Group: ' + (g ? g.name : '') + '\n\u2705 You are owed ' + fmt(bal);
  } else {
    msg = 'Hi ' + memberName + '! \ud83d\udc4b\n\neHisaab \ud83d\udcb8\n\n\ud83d\udccb Group: ' + (g ? g.name : '') + '\n\u2714\ufe0f All settled up!';
  }
  window.open('https://wa.me/91' + phone + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
}

// ─── MEMBER ───────────────────────────────────────────────────
function openAddMemberModal() {
  document.getElementById('inputNewMember').value = '';
  const phoneInput = document.getElementById('inputNewMemberPhone');
  if (phoneInput) phoneInput.value = '';
  openModal('modalAddMember');
  setTimeout(() => document.getElementById('inputNewMember').focus(), 60);
}
function addMember() {
  const name = document.getElementById('inputNewMember').value.trim();
  if (!name) { showToast('\u26a0\ufe0f Enter a name', 'error'); return; }
  const g = getGroup();
  if (g.members.map(m => m.toLowerCase()).includes(name.toLowerCase())) {
    showToast('\u26a0\ufe0f Member already exists', 'error'); return;
  }
  g.members.push(name);
  // Save optional WhatsApp number entered during add
  const phoneRaw = (document.getElementById('inputNewMemberPhone')?.value || '').trim().replace(/\D/g,'').slice(-10);
  if (phoneRaw && phoneRaw.length >= 10) {
    if (!g.memberPhones) g.memberPhones = {};
    g.memberPhones[name] = phoneRaw;
  }
  logActivity(g, '\ud83d\udc64 ' + name + ' added as member');
  saveGroups();
  closeModal('modalAddMember');
  renderMembers();
  renderStatsBar();
  renderPartySetupInGroup();
  showToast('\u2705 ' + name + ' added');
}
function deleteMember(name) {
  const g = getGroup();
  const inv = g.expenses.some(e => e.paidBy === name || e.splits.some(s => s.name === name));
  if (inv && !confirm(name + ' is part of some expenses. Remove anyway?')) return;
  g.members = g.members.filter(m => m !== name);
  logActivity(g, '🗑 ' + name + ' removed from group');
  saveGroups();
  renderMembers();
  renderStatsBar();
  renderPartySetupInGroup();
  showToast('\ud83d\uddd1 ' + name + ' removed');
}

// ─── EXPENSE ──────────────────────────────────────────────────
let currentSplitType = 'equal';

function openAddExpenseModal() {
  const g = getGroup();
  if (g.members.length < 2) { showToast('\u26a0\ufe0f Add at least 2 members first', 'error'); return; }
  document.getElementById('inputExpenseDesc').value   = '';
  document.getElementById('inputExpenseAmount').value = '';
  document.getElementById('inputExpenseDate').value   = today();
  const sel = document.getElementById('selectPaidBy');
  // Build options: "Me" first (pre-selected), then all other members
  // Use getMeInGroup so the value matches the exact stored member name
  const myName = getMeInGroup(g);
  const meOption = `<option value="__me__" selected>Me (${escHtml(myName)})</option>`;
  const otherOptions = g.members
    .filter(m => m !== myName)
    .map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
  sel.innerHTML = meOption + otherOptions;

  // Check for bottle calculator data
  const pd = g.partyDetails;
  const bottlePaidBySet = pd?.partyType === 'alcohol' &&
    BOTTLE_DRINKS.some(d => pd.bottlePaidBy?.[d] && pd.bottlePrice?.[d]);
  const hasBottleData = !bottlePaidBySet && pd?.partyType === 'alcohol' &&
    BOTTLE_DRINKS.some(d => pd.bottleSize?.[d] && pd.bottlePrice?.[d]);
  const autoWrap = document.getElementById('autoBottleSplitWrap');
  if (autoWrap) {
    if (bottlePaidBySet) {
      autoWrap.classList.remove('hidden');
      autoWrap.innerHTML = '<div class="auto-bottle-note">🍶 Drink costs are auto-included via bottle calculator. Add only <strong>other</strong> expenses here.</div>';
    } else {
      autoWrap.classList.toggle('hidden', !hasBottleData);
    }
  }

  if (hasBottleData) {
    currentSplitType = 'exact';
    document.querySelectorAll('.split-btn').forEach(b => b.classList.toggle('active', b.dataset.split === 'exact'));
    autoSplitFromBottles(true);
  } else {
    currentSplitType = 'equal';
    document.querySelectorAll('.split-btn').forEach(b => b.classList.toggle('active', b.dataset.split === 'equal'));
    renderSplitMembers();
  }

  // Reset category
  _currentCategory = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
  const rc = document.getElementById('chkRecurring'); if (rc) rc.checked = false;

  openModal('modalAddExpense');
  setTimeout(() => document.getElementById('inputExpenseDesc').focus(), 60);
}

function renderSplitMembers() {
  const g = getGroup();
  const container = document.getElementById('splitMembersContainer');
  container.innerHTML = '';
  const amount = parseFloat(document.getElementById('inputExpenseAmount').value) || 0;
  const cnt    = g.members.length;
  const share  = cnt > 0 ? amount / cnt : 0;

  g.members.forEach(m => {
    const row = document.createElement('div');
    row.className = 'split-member-row selected';
    row.dataset.member = m;

    let right = '';
    if (currentSplitType === 'custom') {
      right = `<input type="number" class="split-member-input" placeholder="%" min="0" max="100" step="0.01" value="${(100 / cnt).toFixed(1)}" />`;
    } else if (currentSplitType === 'exact') {
      right = `<input type="number" class="split-member-input" placeholder="\u20b9" min="0" step="0.01" value="${share.toFixed(2)}" />`;
    } else {
      right = `<span class="split-member-share">${amount > 0 ? fmt(share) : 'equal share'}</span>`;
    }

    row.innerHTML = `
      <input type="checkbox" class="split-member-check" checked />
      <div class="sm-avatar" style="background:${avatarColor(m)}">${m.charAt(0).toUpperCase()}</div>
      <span class="split-member-name">${escHtml(m)}</span>
      <div class="split-member-right">${right}</div>
    `;
    const cb  = row.querySelector('.split-member-check');
    const rgt = row.querySelector('.split-member-right');
    cb.addEventListener('change', () => {
      const on = cb.checked;
      row.classList.toggle('selected', on);
      if (!on) {
        rgt.innerHTML = '<span class="sme-tag">excluded</span>';
      } else {
        const a2  = parseFloat(document.getElementById('inputExpenseAmount').value) || 0;
        const n2  = document.querySelectorAll('#splitMembersContainer .split-member-check:checked').length;
        const s2  = n2 > 0 ? a2 / n2 : 0;
        if (currentSplitType === 'custom') {
          rgt.innerHTML = `<input type="number" class="split-member-input" placeholder="%" min="0" max="100" step="0.01" value="${(n2 > 0 ? 100 / n2 : 0).toFixed(1)}" />`;
        } else if (currentSplitType === 'exact') {
          rgt.innerHTML = `<input type="number" class="split-member-input" placeholder="\u20b9" min="0" step="0.01" value="${s2.toFixed(2)}" />`;
        } else {
          rgt.innerHTML = `<span class="split-member-share">${a2 > 0 ? fmt(s2) : 'equal share'}</span>`;
        }
      }
      if (currentSplitType === 'equal') refreshEqualShares();
    });
    container.appendChild(row);
  });
}

function autoSplitFromBottles(silent = false) {
  const g  = getGroup();
  const pd = g.partyDetails;
  if (!pd || pd.partyType !== 'alcohol') return;

  const memberAmounts = {};
  g.members.forEach(m => { memberAmounts[m] = 0; });

  BOTTLE_DRINKS.forEach(d => {
    if (!pd.drinks.includes(d)) return;
    const bPrice = pd.bottlePrice?.[d];
    const bCount = pd.bottleCount?.[d] || 1;
    if (!bPrice) return;
    const totalCost = bCount * bPrice;

    // Proportional: (member_ml / total_consumed_ml) × totalCost — total always equals bottle price
    const totalMl = g.members.reduce((s, m) => s + ((pd.glasses[d] || {})[m] || 0) * effectiveGlassML(pd, d, m), 0);
    if (totalMl === 0) return; // nobody drank — skip

    let running = 0, topMember = g.members[0], topMl = 0;
    g.members.forEach(m => {
      const memberGs = effectiveGlassML(pd, d, m);
      const ml    = ((pd.glasses[d] || {})[m] || 0) * memberGs;
      const share = Math.round((ml / totalMl) * totalCost * 100) / 100;
      memberAmounts[m] += share;
      running += share;
      if (ml > topMl) { topMl = ml; topMember = m; }
    });
    // Correct floating-point rounding so sum === totalCost exactly
    const diff = Math.round((totalCost - running) * 100) / 100;
    if (Math.abs(diff) >= 0.01) memberAmounts[topMember] += diff;
  });

  // Switch to exact split, render members, fill in amounts
  currentSplitType = 'exact';
  document.querySelectorAll('.split-btn').forEach(b => b.classList.toggle('active', b.dataset.split === 'exact'));
  renderSplitMembers();

  const total = Object.values(memberAmounts).reduce((s, v) => s + v, 0);
  document.getElementById('inputExpenseAmount').value = total.toFixed(2);

  document.querySelectorAll('#splitMembersContainer .split-member-row').forEach(row => {
    const m   = row.dataset.member;
    const cb  = row.querySelector('.split-member-check');
    const rgt = row.querySelector('.split-member-right');
    const inp = row.querySelector('.split-member-input');
    const amt = memberAmounts[m] || 0;

    if (amt === 0) {
      // Auto-exclude members who have no glasses (non-drinkers)
      if (cb)  cb.checked = false;
      row.classList.remove('selected');
      if (rgt) rgt.innerHTML = '<span class="sme-tag">excluded</span>';
    } else {
      if (inp) inp.value = amt.toFixed(2);
    }
  });

  if (!silent) showToast('\ud83c\udf76 Auto-split from bottle calculator applied!');
}

function refreshEqualShares() {
  const amount  = parseFloat(document.getElementById('inputExpenseAmount').value) || 0;
  const checked = document.querySelectorAll('#splitMembersContainer .split-member-check:checked').length;
  const share   = checked > 0 ? amount / checked : 0;
  document.querySelectorAll('#splitMembersContainer .split-member-row.selected').forEach(row => {
    const sp = row.querySelector('.split-member-share');
    if (sp) sp.textContent = amount > 0 ? fmt(share) : 'equal share';
  });
}

function addExpense() {
  const g      = getGroup();
  const desc   = document.getElementById('inputExpenseDesc').value.trim();
  const amount = parseFloat(document.getElementById('inputExpenseAmount').value);
  const date   = document.getElementById('inputExpenseDate').value || today();
  // Resolve "__me__" to the actual member name stored in the group
  let paidBy = document.getElementById('selectPaidBy').value;
  if (paidBy === '__me__') paidBy = getMeInGroup(g);

  if (!desc)             { showToast('\u26a0\ufe0f Enter a description', 'error'); return; }
  if (!amount || amount <= 0) { showToast('\u26a0\ufe0f Enter a valid amount', 'error'); return; }

  const rows     = [...document.querySelectorAll('#splitMembersContainer .split-member-row')];
  const selected = rows.filter(r => r.querySelector('.split-member-check')?.checked);
  if (selected.length === 0) { showToast('\u26a0\ufe0f Select at least one person', 'error'); return; }

  const splits = [];
  if (currentSplitType === 'equal') {
    const s = amount / selected.length;
    selected.forEach(r => splits.push({ name: r.dataset.member, amount: Math.round(s * 100) / 100 }));
  } else if (currentSplitType === 'custom') {
    let tot = 0;
    selected.forEach(r => {
      const pct = parseFloat(r.querySelector('.split-member-input')?.value) || 0;
      tot += pct;
      splits.push({ name: r.dataset.member, amount: Math.round((amount * pct / 100) * 100) / 100 });
    });
    if (Math.abs(tot - 100) > 0.5) { showToast('\u26a0\ufe0f Percentages must add up to 100%', 'error'); return; }
  } else {
    let tot = 0;
    selected.forEach(r => {
      const v = parseFloat(r.querySelector('.split-member-input')?.value) || 0;
      tot += v;
      splits.push({ name: r.dataset.member, amount: Math.round(v * 100) / 100 });
    });
    if (Math.abs(tot - amount) > 0.5) { showToast('\u26a0\ufe0f Amounts must add up to ' + fmt(amount), 'error'); return; }
  }

  g.expenses.push({ id: uid(), description: desc, amount, date, paidBy, splitType: currentSplitType, splits, category: _currentCategory || '', recurring: !!(document.getElementById('chkRecurring')?.checked) });
  logActivity(g, '\ud83d\udcb0 "' + desc + '" added \u2014 ' + fmt(amount) + ' paid by ' + paidBy);
  saveGroups();
  closeModal('modalAddExpense');
  renderExpenses();
  renderBalances();
  renderStatsBar();
  showToast('\u2705 "' + desc + '" added \u2014 ' + fmt(amount));
}

function deleteExpense(id) {
  const g = getGroup();
  g.expenses = g.expenses.filter(e => e.id !== id);
  saveGroups();
  renderExpenses();
  renderBalances();
  renderStatsBar();
  showToast('\ud83d\uddd1 Expense deleted');
}

// ─── SETTLEMENTS ──────────────────────────────────────────────
function openSettleModal(s) {
  state.pendingSettle = s;
  document.getElementById('settleDescription').innerHTML =
    `<strong style="color:#ef4444">${escHtml(s.from)}</strong> pays <strong style="color:#22c55e">${escHtml(s.to)}</strong>`;
  document.getElementById('inputSettleAmount').value = s.amount.toFixed(2);
  openModal('modalSettle');
}
function recordSettlement() {
  const s      = state.pendingSettle;
  const amount = parseFloat(document.getElementById('inputSettleAmount').value);
  if (!amount || amount <= 0) { showToast('\u26a0\ufe0f Enter a valid amount', 'error'); return; }
  const g = getGroup();
  g.settlements.push({ id: uid(), from: s.from, to: s.to, amount, date: today() });
  saveGroups();
  closeModal('modalSettle');
  renderBalances();
  renderStatsBar();
  showToast('\u2705 Settlement recorded \u2014 ' + fmt(amount));
}

// ─── WHATSAPP BILL SENDER ─────────────────────────────────────
function sendWhatsApp(fromName, toName, amount) {
  const g = getGroup();
  // Check contacts first, then group's memberPhones
  let phone = getContactPhone(fromName);
  if (!phone && g && g.memberPhones) phone = g.memberPhones[fromName] || '';
  if (!phone) {
    showToast('\u26a0\ufe0f No phone saved for ' + fromName + '. Use the +\ud83d\udcf1 button in Members tab to add.', 'error');
    return;
  }
  const intlPhone = '91' + phone;
  const msg = 'Hi ' + fromName + '! \ud83d\udc4b\n\nReminder from eHisaab \ud83d\udcb8\n\n\ud83d\udccb Group: ' + (g ? g.name : '') + '\n\ud83d\udcb3 You owe ' + toName + ' ' + fmt(amount) + '\n\nPlease transfer at your earliest convenience. \ud83d\ude4f';
  window.open('https://wa.me/' + intlPhone + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
}

// ─── SETTINGS ────────────────────────────────────────────────
const SETTINGS_KEY = 'splitease_settings_v1';
function getSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } }
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// ─── DARK MODE ───────────────────────────────────────────────
function toggleDarkMode() {
  const s = getSettings(); s.darkMode = !s.darkMode; saveSettings(s); applyDarkMode(s.darkMode);
}
function applyDarkMode(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  const btn = document.getElementById('darkModeBtn');
  if (btn) btn.textContent = dark ? '\u2600\ufe0f' : '\ud83c\udf19';
}

// ─── CHANGE PASSWORD ─────────────────────────────────────────
function openChangePwModal() {
  document.getElementById('userDropdown').classList.add('hidden');
  ['cpCurPw','cpNewPw','cpConfirm'].forEach(id => document.getElementById(id).value = '');
  const e = document.getElementById('cpError'); e.textContent = ''; e.classList.add('hidden');
  openModal('modalChangePw');
}
function handleChangePw(e) {
  e.preventDefault();
  const cur = document.getElementById('cpCurPw').value;
  const nw  = document.getElementById('cpNewPw').value;
  const cf  = document.getElementById('cpConfirm').value;
  const errEl = document.getElementById('cpError'); errEl.classList.add('hidden');
  const users = getUsers();
  if (users[currentUser.email].hash !== simpleHash(cur)) { errEl.textContent = 'Current password is incorrect.'; errEl.classList.remove('hidden'); return; }
  if (nw.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
  if (nw !== cf) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); return; }
  users[currentUser.email].hash = simpleHash(nw); saveUsers(users);
  closeModal('modalChangePw'); showToast('\u2705 Password changed!');
}

// ─── HELP / TUTORIAL ──────────────────────────────────────────
function openHelpModal() {
  document.getElementById('userDropdown').classList.add('hidden');
  switchHelpTab(0);
  openModal('modalHelp');
}
function switchHelpTab(idx) {
  document.querySelectorAll('.help-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  document.querySelectorAll('.help-section').forEach((s, i) => s.classList.toggle('active', i === idx));
}

// ─── PIN LOCK ────────────────────────────────────────────────
function openSetPINModal() {
  document.getElementById('userDropdown').classList.add('hidden');
  document.getElementById('setPinInput').value = '';
  document.getElementById('setPinConfirm').value = '';
  const e = document.getElementById('setPinError'); e.textContent = ''; e.classList.add('hidden');
  openModal('modalSetPIN');
}
function handleSetPIN(e) {
  e.preventDefault();
  const pin  = String(document.getElementById('setPinInput').value).trim();
  const conf = String(document.getElementById('setPinConfirm').value).trim();
  const errEl = document.getElementById('setPinError'); errEl.classList.add('hidden');
  if (!/^\d{4,6}$/.test(pin)) { errEl.textContent = 'PIN must be 4\u20136 digits.'; errEl.classList.remove('hidden'); return; }
  if (pin !== conf) { errEl.textContent = 'PINs do not match.'; errEl.classList.remove('hidden'); return; }
  const s = getSettings(); s.pin = simpleHash(pin); saveSettings(s);
  closeModal('modalSetPIN'); showToast('\ud83d\udd12 PIN lock enabled!');
}
function removePIN() {
  const s = getSettings();
  if (!s.pin) { showToast('\u26a0\ufe0f No PIN is currently set', 'error'); return; }
  if (!confirm('Remove PIN lock?')) return;
  delete s.pin; saveSettings(s);
  document.getElementById('userDropdown').classList.add('hidden');
  showToast('\ud83d\udd13 PIN removed');
}
function showPINLock() {
  const overlay = document.getElementById('pinLockOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    document.getElementById('pinLockInput').value = '';
    document.getElementById('pinLockError').classList.add('hidden');
    setTimeout(() => document.getElementById('pinLockInput').focus(), 100);
  }
}
function validatePINLock(e) {
  if (e && e.key && e.key !== 'Enter') return;
  const pin = String(document.getElementById('pinLockInput').value).trim();
  const s   = getSettings();
  if (!s.pin || s.pin === simpleHash(pin)) {
    document.getElementById('pinLockOverlay').classList.add('hidden');
    if (_pendingBootAfterPIN) {
      _pendingBootAfterPIN = false;
      bootApp(true); // skip showing PIN again
    }
  } else {
    const errEl = document.getElementById('pinLockError');
    errEl.textContent = '\u274c Wrong PIN. Try again.'; errEl.classList.remove('hidden');
    document.getElementById('pinLockInput').value = '';
  }
}

// ─── ARCHIVE GROUP ───────────────────────────────────────────
function archiveGroup(id, e) {
  e.stopPropagation();
  const g = getGroup(id); g.archived = !g.archived; saveGroups();
  renderHome(); showToast(g.archived ? '\ud83d\udce6 Group archived' : '\u267b\ufe0f Group restored');
}

// ─── UNDO DELETE ─────────────────────────────────────────────
let _undoData = null;
function undoDeleteExp() {
  if (!_undoData) return;
  const g = getGroup(_undoData.groupId);
  if (g) {
    g.expenses.push(_undoData.exp);
    logActivity(g, '\u21a9 "' + _undoData.exp.description + '" restored');
    saveGroups();
    if (state.currentGroupId === _undoData.groupId) { renderExpenses(); renderBalances(); renderStatsBar(); }
  }
  _undoData = null;
  clearTimeout(showToast._t);
  document.getElementById('toast').classList.add('hidden');
  showToast('\u2705 Expense restored!');
}

// ─── EXPENSE SEARCH ──────────────────────────────────────────
let _expSearch = '';
function filterExpenses(q) { _expSearch = (q || '').toLowerCase(); renderExpenses(); }

// ─── EXPENSE CATEGORIES ──────────────────────────────────────
let _currentCategory = '';
const CAT_ICONS = { '': '\ud83c\udff7\ufe0f', food: '\ud83c\udf55', travel: '\u2708\ufe0f', stay: '\ud83c\udfe8', fun: '\ud83c\udf89', drinks: '\ud83c\udf7a', shopping: '\ud83d\uded2\ufe0f', medical: '\ud83d\udc8a' };
function selectCategory(cat) {
  _currentCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
}
function getCategoryIcon(cat) { return CAT_ICONS[cat] || CAT_ICONS['']; }

// ─── MULTI-CURRENCY ──────────────────────────────────────────
let _selectedCurrency = '\u20b9';
function selectCurrency(sym) {
  _selectedCurrency = sym;
  document.querySelectorAll('.currency-btn').forEach(b => b.classList.toggle('active', b.dataset.currency === sym));
}

// ─── ACTIVITY LOG ────────────────────────────────────────────
function logActivity(g, text) {
  if (!g.activity) g.activity = [];
  g.activity.unshift({ id: uid(), text, date: today() });
  if (g.activity.length > 40) g.activity = g.activity.slice(0, 40);
}
function renderActivityFeed() {
  const g = getGroup(); if (!g) return;
  const el = document.getElementById('activityFeed'); if (!el) return;
  const acts = g.activity || [];
  if (acts.length === 0) {
    el.innerHTML = '<div class="act-empty">No activity yet. Expenses and settlements appear here.</div>';
    return;
  }
  el.innerHTML = '<div class="act-title">\ud83d\udcdc Recent Activity</div>' +
    acts.map(a => '<div class="act-row"><span class="act-dot"></span><span class="act-text">' + escHtml(a.text) + '</span><span class="act-date">' + formatDate(a.date) + '</span></div>').join('');
}

// ─── RECURRING EXPENSES ──────────────────────────────────────
function addRecurringExpenses() {
  const g = getGroup();
  const recurring = g.expenses.filter(e => e.recurring);
  if (recurring.length === 0) { showToast('\u26a0\ufe0f No recurring expenses found', 'error'); return; }
  recurring.forEach(e => {
    const copy = Object.assign({}, e, { id: uid(), date: today() });
    g.expenses.push(copy);
    logActivity(g, '\ud83d\udd01 Recurring "' + e.description + '" re-added \u2014 ' + fmt(e.amount));
  });
  saveGroups(); renderExpenses(); renderStatsBar();
  showToast('\u2705 ' + recurring.length + ' recurring expense' + (recurring.length !== 1 ? 's' : '') + ' re-added!');
}

// ─── SPENDING CHART ──────────────────────────────────────────
function renderSpendingChart() {
  const canvas = document.getElementById('spendingChart'); if (!canvas) return;
  const g   = getGroup();
  const ctx = canvas.getContext('2d');
  const W   = canvas.width  = canvas.offsetWidth  || 320;
  const H   = canvas.height = 220;
  ctx.clearRect(0, 0, W, H);
  const paid = {}; g.members.forEach(m => { paid[m] = 0; });
  g.expenses.forEach(e => { if (paid[e.paidBy] !== undefined) paid[e.paidBy] += parseFloat(e.amount); });
  const entries = Object.entries(paid).filter(([, v]) => v > 0.01);
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  if (total < 0.01) {
    ctx.fillStyle = '#9491b0'; ctx.font = '14px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No expenses yet', W / 2, H / 2); return;
  }
  const cx = W * 0.32, cy = H / 2, r = Math.min(cy - 14, W * 0.28);
  let angle = -Math.PI / 2;
  entries.forEach(([name, val]) => {
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath();
    ctx.fillStyle = avatarColor(name); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    angle += slice;
  });
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lx = W * 0.63, lstart = Math.max(16, H / 2 - entries.length * 13);
  entries.forEach(([name, val], i) => {
    const ly = lstart + i * 26;
    ctx.fillStyle = avatarColor(name); ctx.fillRect(lx, ly, 12, 12);
    ctx.fillStyle = isDark ? '#e2e0f0' : '#18163a';
    ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(name + ' \u2014 ' + fmt(val), lx + 16, ly + 10);
  });
}

// ─── DATA BACKUP / RESTORE ───────────────────────────────────
function exportData() {
  const data = { version: 1, exported: new Date().toISOString(), user: currentUser.email, groups: state.groups, contacts: getContacts() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'ehisaab-backup-' + today() + '.json'; a.click(); URL.revokeObjectURL(a.href);
  document.getElementById('userDropdown').classList.add('hidden');
  showToast('\u2705 Backup downloaded!');
}
function triggerImport() {
  document.getElementById('userDropdown').classList.add('hidden');
  document.getElementById('importFileInput').click();
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.groups) { showToast('\u26a0\ufe0f Invalid backup file', 'error'); return; }
      if (!confirm('This will replace all your current groups. Continue?')) return;
      state.groups = data.groups; saveGroups();
      if (data.contacts) saveContacts(data.contacts);
      renderHome(); showToast('\u2705 ' + data.groups.length + ' groups restored!');
    } catch { showToast('\u26a0\ufe0f Could not read file', 'error'); }
  };
  reader.readAsText(file); e.target.value = '';
}

// ─── PRINT SUMMARY ───────────────────────────────────────────
function printGroup() {
  const g = getGroup();
  if (!g) return;

  const { balances, settlements } = calculateBalances(g);
  const sym        = g.currency || '\u20b9';
  const fmtP       = n => sym + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Collect virtual bottle expenses (alcohol party calculator)
  const pdV = g.partyDetails;
  const virtualExps = [];
  if (pdV?.partyType === 'alcohol') {
    BOTTLE_DRINKS.forEach(d => {
      if (!pdV.drinks?.includes(d)) return;
      const paidBy = pdV.bottlePaidBy?.[d];
      if (!paidBy || !pdV.bottlePrice?.[d]) return;
      const cnt  = pdV.bottleCount?.[d] || 1;
      const sz   = pdV.bottleSize?.[d] || 750;
      const tot  = cnt * pdV.bottlePrice[d];
      virtualExps.push({ description: d + ' (bottles)', amount: tot, paidBy, date: new Date().toISOString().slice(0,10),
        bottleInfo: cnt + '\u00d7' + (sz < 1000 ? sz + 'ml' : '1L') + ' @ ' + fmtP(pdV.bottlePrice[d]) });
    });
  }
  const allExps    = [...g.expenses, ...virtualExps];
  const totalSpent = allExps.reduce((s, e) => s + parseFloat(e.amount), 0);
  const avgPerPerson = g.members.length > 0 ? totalSpent / g.members.length : 0;
  const printDate  = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Date range of expenses
  const dates = g.expenses.map(e => e.date).sort();
  const dateRange = dates.length === 0 ? 'No expenses'
    : dates.length === 1 ? formatDate(dates[0])
    : formatDate(dates[0]) + ' \u2013 ' + formatDate(dates[dates.length - 1]);

  // How much each member actually paid (includes bottle payers)
  const paidByMember = {};
  g.members.forEach(m => { paidByMember[m] = 0; });
  allExps.forEach(e => { if (paidByMember[e.paidBy] !== undefined) paidByMember[e.paidBy] += parseFloat(e.amount); });

  // Category totals
  const catTotals = {};
  g.expenses.forEach(e => {
    const cat = e.category || 'general';
    catTotals[cat] = (catTotals[cat] || 0) + parseFloat(e.amount);
  });
  if (virtualExps.length > 0) catTotals['drinks'] = (catTotals['drinks'] || 0) + virtualExps.reduce((s, e) => s + e.amount, 0);
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // ── 1. Members & Balances ──────────────────────────────────
  const membersHtml = g.members.map(m => {
    const bal  = Math.round((balances[m] || 0) * 100) / 100;
    const paid = paidByMember[m] || 0;
    const tag  = bal > 0.005
      ? '<span class="tag-gets">&#x2191; Gets back ' + fmtP(bal) + '</span>'
      : bal < -0.005
        ? '<span class="tag-owes">&#x2193; Owes ' + fmtP(-bal) + '</span>'
        : '<span class="tag-even">&#x2714; Settled</span>';
    return `<tr>
      <td style="width:36px"><span class="av" style="background:${avatarColor(m)}">${m.charAt(0).toUpperCase()}</span></td>
      <td><div class="m-name">${escHtml(m)}</div><div class="m-sub">Paid: <strong>${fmtP(paid)}</strong></div></td>
      <td style="text-align:right">${tag}</td>
    </tr>`;
  }).join('');

  // ── 2. Category breakdown ──────────────────────────────────
  const catHtml = catEntries.length === 0
    ? '<div style="color:#9ca3af;font-size:.8rem;padding:.5rem 0">No categories</div>'
    : catEntries.map(([cat, amt]) => {
        const pct  = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;
        const icon = getCategoryIcon(cat);
        const name = cat.charAt(0).toUpperCase() + cat.slice(1);
        return `<div class="cat-row">
          <span class="cat-icon">${icon}</span>
          <span class="cat-name">${name}</span>
          <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%"></div></div>
          <span class="cat-pct">${pct}%</span>
          <span class="cat-amt">${fmtP(amt)}</span>
        </div>`;
      }).join('');

  // ── 3. Expense rows ────────────────────────────────────────
  const sortedExp = [...g.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const allRows   = [
    ...sortedExp,
    ...virtualExps.map(e => ({ ...e, isVirtual: true }))
  ];
  const expRowsHtml = allRows.length === 0
    ? '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:20px">No expenses recorded</td></tr>'
    : allRows.map((e, i) => {
        if (e.isVirtual) {
          return `<tr style="background:#fef9c3">
            <td class="exp-num">${i + 1}</td>
            <td style="min-width:180px">
              <div class="exp-desc">\ud83c\udf7e ${escHtml(e.description)}</div>
              <div class="exp-desc-sub">${e.bottleInfo}</div>
            </td>
            <td><span class="exp-cat">\ud83c\udf7a Drinks</span></td>
            <td>
              <div class="exp-payer">
                <span class="av av-sm" style="background:${avatarColor(e.paidBy)}">${e.paidBy.charAt(0).toUpperCase()}</span>
                ${escHtml(e.paidBy)}
              </div>
            </td>
            <td style="color:#6b7280;font-size:.75rem">Split by consumption</td>
            <td class="exp-amt">${fmtP(e.amount)}</td>
          </tr>`;
        }
        const catIcon = getCategoryIcon(e.category || '');
        const catBadge = e.category
          ? `<span class="exp-cat">${catIcon} ${e.category}</span>`
          : `<span class="exp-cat" style="background:#f3f4f6;color:#6b7280">${catIcon} General</span>`;
        const recBadge = e.recurring ? '<span class="rec-badge">\ud83d\udd01 Recurring</span>' : '';
        const splitInfo = e.splits && e.splits.length > 0
          ? splitLabel(e) + ' (' + e.splits.length + ' people)'
          : splitLabel(e);
        return `<tr>
          <td class="exp-num">${i + 1}</td>
          <td style="min-width:180px">
            <div class="exp-desc">${escHtml(e.description)} ${recBadge}</div>
            <div class="exp-desc-sub">${formatDate(e.date)}</div>
          </td>
          <td>${catBadge}</td>
          <td>
            <div class="exp-payer">
              <span class="av av-sm" style="background:${avatarColor(e.paidBy)}">${e.paidBy.charAt(0).toUpperCase()}</span>
              ${escHtml(e.paidBy)}
            </div>
          </td>
          <td style="color:#6b7280;font-size:.75rem">${splitInfo}</td>
          <td class="exp-amt">${fmtP(e.amount)}</td>
        </tr>`;
      }).join('');

  // ── 4. Settlement plan ────────────────────────────────────
  const settleCardsHtml = settlements.length === 0
    ? '<div class="all-settled">&#x2714;&#xFE0F; All members are fully settled &mdash; no payments needed!</div>'
    : settlements.map(s => `
        <div class="settle-card">
          <div class="sc-person">
            <span class="av av-lg" style="background:${avatarColor(s.from)}">${s.from.charAt(0).toUpperCase()}</span>
            <span class="sc-name">${escHtml(s.from)}</span>
          </div>
          <div class="sc-mid">
            <div class="sc-amt">${fmtP(s.amount)}</div>
            <div class="sc-arrow-row"><span class="sc-arrow-line"></span><span class="sc-arrow-head">&#x25B6;</span></div>
            <div class="sc-lbl">pays</div>
          </div>
          <div class="sc-person">
            <span class="av av-lg" style="background:${avatarColor(s.to)}">${s.to.charAt(0).toUpperCase()}</span>
            <span class="sc-name">${escHtml(s.to)}</span>
          </div>
        </div>`).join('');

  // ── 5. Recorded settlements ───────────────────────────────
  const recordedHtml = g.settlements.length === 0 ? '' : `
    <hr class="divider"/>
    <div class="sec-title">Recorded Payments <span>${g.settlements.length} payment${g.settlements.length !== 1 ? 's' : ''}</span></div>
    <table class="rec-table">
      <thead><tr><th>Date</th><th>From</th><th>To</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${g.settlements.map(s => `<tr>
          <td>${formatDate(s.date)}</td>
          <td><span class="av av-sm" style="background:${avatarColor(s.from)}">${s.from.charAt(0).toUpperCase()}</span> ${escHtml(s.from)}</td>
          <td><span class="av av-sm" style="background:${avatarColor(s.to)}">${s.to.charAt(0).toUpperCase()}</span> ${escHtml(s.to)}</td>
          <td style="text-align:right;font-weight:700">${fmtP(s.amount)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  // ── 6. Alcohol / Party section ──────────────────────────────
  let partyHtml = '';
  const pd2 = g.partyDetails;
  if (pd2 && g.type === 'Party') {
    const isAlcohol = pd2.partyType === 'alcohol' && pd2.drinks && pd2.drinks.length > 0;
    const isNonAlc  = pd2.partyType === 'non-alcohol' && pd2.drinks && pd2.drinks.length > 0;
    if (isAlcohol) {
      const bottleDrinks = pd2.drinks.filter(d => BOTTLE_DRINKS.includes(d) && pd2.bottlePrice?.[d] > 0);
      // ── Bottle summary table ──
      let bottleTbl = '';
      if (bottleDrinks.length > 0) {
        const totBC = bottleDrinks.reduce((s, d) => s + (pd2.bottleCount?.[d] || 1) * (pd2.bottlePrice?.[d] || 0), 0);
        const bRows = bottleDrinks.map(d => {
          const cnt = pd2.bottleCount?.[d] || 1;
          const sz  = pd2.bottleSize?.[d] || 750;
          const prc = pd2.bottlePrice?.[d] || 0;
          const pby = pd2.bottlePaidBy?.[d] || '\u2014';
          const avBg = pby !== '\u2014' ? ' style="background:' + avatarColor(pby) + '"' : '';
          const avLt = pby !== '\u2014' ? pby.charAt(0).toUpperCase() : '?';
          return '<tr><td><strong>' + escHtml(d) + '</strong></td>'
            + '<td class="pc">' + cnt + '</td>'
            + '<td class="pc">' + (sz < 1000 ? sz + 'ml' : (sz / 1000).toFixed(sz % 1000 === 0 ? 0 : 1) + 'L') + '</td>'
            + '<td class="pr">' + fmtP(prc) + '</td>'
            + '<td class="pr fw">' + fmtP(cnt * prc) + '</td>'
            + '<td><span class="av av-sm"' + avBg + '>' + avLt + '</span> ' + escHtml(pby) + '</td></tr>';
        }).join('');
        bottleTbl = '<div class="sec-title" style="margin-top:0">\ud83c\udf7e Bottles Purchased'
          + ' <span>' + bottleDrinks.length + ' drink' + (bottleDrinks.length !== 1 ? 's' : '') + '</span></div>'
          + '<table class="party-table"><thead><tr>'
          + '<th>Drink</th><th class="pc">Qty</th><th class="pc">Size</th>'
          + '<th class="pr">Price / Bottle</th><th class="pr">Total Cost</th><th>Paid By</th>'
          + '</tr></thead><tbody>' + bRows + '</tbody>'
          + '<tfoot><tr><td colspan="4" class="pr fw">Total Bottle Cost</td>'
          + '<td class="pr fw pur">' + fmtP(totBC) + '</td><td></td></tr></tfoot></table>';
      }
      // ── Consumption matrix (bottle drinks with glass data) ──
      const drinkCols = pd2.drinks.filter(d =>
        BOTTLE_DRINKS.includes(d) && pd2.glasses?.[d] &&
        Object.keys(pd2.glasses[d]).some(m => (pd2.glasses[d][m] || 0) > 0)
      );
      let consTbl = '';
      if (drinkCols.length > 0 && g.members.length > 0) {
        const mCost = {};
        g.members.forEach(m => { mCost[m] = 0; });
        drinkCols.forEach(d => {
          if (!pd2.bottlePrice?.[d]) return;
          const tot   = (pd2.bottleCount?.[d] || 1) * pd2.bottlePrice[d];
          const totMl = g.members.reduce((s, m) => s + ((pd2.glasses[d] || {})[m] || 0) * effectiveGlassML(pd2, d, m), 0);
          if (totMl === 0) return;
          let running = 0, topM = g.members[0], topMl = 0;
          g.members.forEach(m => {
            const ml    = ((pd2.glasses[d] || {})[m] || 0) * effectiveGlassML(pd2, d, m);
            const share = Math.round((ml / totMl) * tot * 100) / 100;
            mCost[m]  += share;
            running   += share;
            if (ml > topMl) { topMl = ml; topM = m; }
          });
          const diff = Math.round((tot - running) * 100) / 100;
          if (Math.abs(diff) >= 0.01) mCost[topM] += diff;
        });
        const thCols  = drinkCols.map(d => '<th colspan="2" class="pc">' + escHtml(d) + '</th>').join('');
        const subCols = drinkCols.map(() => '<td class="pc sub-hd">Glasses</td><td class="pc sub-hd">ml</td>').join('');
        const bodyRows = g.members.map(m => {
          const glCols = drinkCols.map(d => {
            const gl = (pd2.glasses?.[d] || {})[m] || 0;
            const ml = gl * effectiveGlassML(pd2, d, m);
            return '<td class="pc' + (gl > 0 ? ' fw pur' : ' muted') + '">' + (gl > 0 ? gl : '\u2014') + '</td>'
                 + '<td class="pc muted">' + (ml > 0 ? ml + 'ml' : '\u2014') + '</td>';
          }).join('');
          return '<tr><td><span class="av av-sm" style="background:' + avatarColor(m) + '">' + m.charAt(0).toUpperCase() + '</span> '
            + '<strong>' + escHtml(m) + '</strong></td>' + glCols
            + '<td class="pr fw red">' + fmtP(mCost[m]) + '</td></tr>';
        }).join('');
        const totCols = drinkCols.map(d => {
          const tg = g.members.reduce((s, m) => s + ((pd2.glasses?.[d] || {})[m] || 0), 0);
          const tm = g.members.reduce((s, m) => s + ((pd2.glasses[d] || {})[m] || 0) * effectiveGlassML(pd2, d, m), 0);
          return '<td class="pc fw">' + tg + '</td><td class="pc muted">' + tm + 'ml</td>';
        }).join('');
        const totCost = g.members.reduce((s, m) => s + mCost[m], 0);
        consTbl = '<div class="sec-title" style="margin-top:20px">\ud83e\udd43 Drink Consumption'
          + ' <span>per member breakdown</span></div>'
          + '<div class="drink-scroll"><table class="party-table drink-matrix"><thead>'
          + '<tr><th>Member</th>' + thCols + '<th class="pr">Drink Cost</th></tr>'
          + '<tr><td></td>' + subCols + '<td></td></tr>'
          + '</thead><tbody>' + bodyRows + '</tbody>'
          + '<tfoot><tr><td><strong>Total</strong></td>' + totCols
          + '<td class="pr fw pur">' + fmtP(totCost) + '</td></tr></tfoot>'
          + '</table></div>';
      }
      // Other non-bottle drinks
      const nbDrinks = pd2.drinks.filter(d => !BOTTLE_DRINKS.includes(d));
      const nbNote = nbDrinks.length > 0
        ? '<p style="margin-top:10px;font-size:.78rem;color:#6b7280">Other drinks: '
          + nbDrinks.map(d => '<span class="na-chip">' + escHtml(d) + '</span>').join('') + '</p>'
        : '';
      partyHtml = '<hr class="divider"/>'
        + '<div class="sec-title" style="font-size:.82rem;margin-bottom:16px">\ud83c\udf7b Alcohol Party Details</div>'
        + bottleTbl + consTbl + nbNote;
    } else if (isNonAlc) {
      partyHtml = '<hr class="divider"/>'
        + '<div class="sec-title">\ud83e\udd64 Non-Alcohol Party</div>'
        + '<p style="font-size:.85rem;color:#374151;margin-top:8px">Drinks: '
        + pd2.drinks.map(d => '<span class="na-chip">' + escHtml(d) + '</span>').join('') + '</p>';
    }
  }

  // ── Build full HTML page ───────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>eHisaab Report \u2014 ${escHtml(g.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:13px;color:#1e1b4b;background:#f8f7ff;line-height:1.5}
.page{max-width:920px;margin:0 auto;background:#fff;box-shadow:0 0 40px rgba(108,99,255,.12)}

/* ── Header ── */
.rpt-header{background:linear-gradient(135deg,#3730a3 0%,#6c63ff 55%,#818cf8 100%);color:#fff;padding:28px 36px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.rh-left{display:flex;align-items:center;gap:16px}
.rh-emoji{font-size:3.2rem;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,.25))}
.rh-name{font-size:1.65rem;font-weight:800;letter-spacing:-.03em;text-shadow:0 1px 3px rgba(0,0,0,.2)}
.rh-sub{font-size:.82rem;opacity:.75;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap}
.rh-sub span{background:rgba(255,255,255,.15);border-radius:20px;padding:2px 10px}
.rh-right{text-align:right;flex-shrink:0}
.rh-brand{font-size:1.05rem;font-weight:800;letter-spacing:-.01em}
.rh-brand-sub{font-size:.7rem;opacity:.6;margin-top:1px}
.rh-date{font-size:.72rem;opacity:.65;margin-top:8px;border-top:1px solid rgba(255,255,255,.2);padding-top:6px}

/* ── Content ── */
.content{padding:28px 36px}

/* ── Stats grid ── */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.stat-card{background:#f5f3ff;border:1.5px solid #e0e7ff;border-radius:12px;padding:14px 16px;text-align:center}
.stat-card.hl{background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-color:#c4b5fd}
.sc-val{font-size:1.3rem;font-weight:800;color:#4c1d95;line-height:1.1}
.sc-lbl{font-size:.65rem;color:#7c3aed;text-transform:uppercase;letter-spacing:.07em;margin-top:5px;font-weight:700}
.sc-sub{font-size:.68rem;color:#9ca3af;margin-top:2px}

/* ── Two-column layout ── */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.panel{background:#fafafa;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px 18px}

/* ── Section title ── */
.sec-title{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#4c1d95;margin-bottom:12px;padding-bottom:7px;border-bottom:2px solid #e0e7ff;display:flex;align-items:center;justify-content:space-between}
.sec-title span{color:#9ca3af;font-size:.65rem;font-weight:500;text-transform:none;letter-spacing:0}

/* ── Avatars ── */
.av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:700;flex-shrink:0;vertical-align:middle}
.av-sm{width:20px;height:20px;font-size:.62rem;margin-right:4px}
.av-md{width:26px;height:26px;font-size:.72rem;margin-right:5px}
.av-lg{width:34px;height:34px;font-size:.85rem}

/* ── Member table ── */
.m-table{width:100%;border-collapse:collapse}
.m-table tr{border-bottom:1px solid #f3f4f6}
.m-table tr:last-child{border-bottom:none}
.m-table td{padding:8px 4px;vertical-align:middle}
.m-name{font-weight:600;font-size:13px}
.m-sub{font-size:.7rem;color:#6b7280;margin-top:1px}
.tag-gets{background:#d1fae5;color:#059669;border-radius:20px;padding:3px 10px;font-size:.72rem;font-weight:700;white-space:nowrap}
.tag-owes{background:#fee2e2;color:#dc2626;border-radius:20px;padding:3px 10px;font-size:.72rem;font-weight:700;white-space:nowrap}
.tag-even{background:#f3f4f6;color:#6b7280;border-radius:20px;padding:3px 10px;font-size:.72rem;font-weight:600}

/* ── Category rows ── */
.cat-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6}
.cat-row:last-child{border-bottom:none}
.cat-icon{font-size:.95rem;width:20px;text-align:center;flex-shrink:0}
.cat-name{flex:1;font-size:12.5px;color:#374151;font-weight:500;text-transform:capitalize}
.cat-bar-wrap{width:72px;height:5px;background:#e5e7eb;border-radius:3px;flex-shrink:0}
.cat-bar{height:100%;border-radius:3px;background:linear-gradient(90deg,#6c63ff,#818cf8)}
.cat-pct{font-size:.65rem;color:#9ca3af;min-width:28px;text-align:right}
.cat-amt{font-weight:700;font-size:12px;color:#1e1b4b;min-width:68px;text-align:right}

/* ── Expenses table ── */
.exp-wrap{margin-bottom:24px}
.exp-table{width:100%;border-collapse:collapse;font-size:12.5px}
.exp-table thead tr{background:linear-gradient(90deg,#3730a3,#6c63ff)}
.exp-table th{color:#fff;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:10px 11px;text-align:left;white-space:nowrap}
.exp-table th:last-child{text-align:right}
.exp-table td{padding:9px 11px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
.exp-table tbody tr:nth-child(even){background:#fafafa}
.exp-num{color:#c4b5fd;font-size:.7rem;text-align:center;width:30px;font-weight:700}
.exp-desc{font-weight:600;color:#1e1b4b}
.exp-sub{font-size:.7rem;color:#6b7280;margin-top:2px}
.exp-cat{display:inline-flex;align-items:center;gap:3px;background:#ede9fe;color:#5b21b6;border-radius:10px;padding:2px 8px;font-size:.68rem;font-weight:600;white-space:nowrap}
.exp-payer{display:flex;align-items:center;white-space:nowrap}
.exp-split{color:#6b7280;font-size:.72rem}
.exp-amt{text-align:right;font-weight:700;color:#1e1b4b;white-space:nowrap;font-size:13px}
.rec-badge{background:#dcfce7;color:#15803d;border-radius:10px;padding:1px 6px;font-size:.65rem;font-weight:600;margin-left:4px}
.exp-tfoot td{background:linear-gradient(90deg,#3730a3,#6c63ff);color:#fff;font-weight:700;padding:10px 11px}
.exp-tfoot .exp-amt{color:#fff;font-size:14px}

/* ── Settlement cards ── */
.settle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-bottom:8px}
.settle-card{background:#f5f3ff;border:2px solid #c4b5fd;border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.sc-person{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:56px}
.sc-name{font-size:.7rem;font-weight:700;color:#374151;text-align:center;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-mid{display:flex;flex-direction:column;align-items:center;flex:1;gap:2px}
.sc-amt{font-size:1.05rem;font-weight:800;color:#4c1d95}
.sc-arrow-row{display:flex;align-items:center;width:100%;justify-content:center;gap:0}
.sc-arrow-line{flex:1;height:2px;background:linear-gradient(90deg,#a78bfa,#6c63ff)}
.sc-arrow-head{color:#6c63ff;font-size:.8rem;margin-left:-1px}
.sc-lbl{font-size:.65rem;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.all-settled{background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:20px;text-align:center;color:#15803d;font-weight:700;font-size:.95rem}
.all-settled-icon{font-size:2rem;display:block;margin-bottom:6px}

/* ── Recorded payments ── */
.rec-table{width:100%;border-collapse:collapse;font-size:12px}
.rec-table th{background:#f3f4f6;color:#374151;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;border:1px solid #e5e7eb}
.rec-table td{padding:7px 10px;border:1px solid #e5e7eb;vertical-align:middle}
.rec-table tbody tr:nth-child(even){background:#fafafa}

/* ── Divider ── */
.divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0}

/* ── Footer ── */
.rpt-footer{background:#1e1b4b;color:rgba(255,255,255,.55);padding:16px 36px;display:flex;justify-content:space-between;align-items:center;font-size:.72rem;gap:10px}
.rf-brand{color:#fff;font-weight:700;font-size:.82rem;letter-spacing:-.01em}
.rf-note{text-align:center}
.rf-date{text-align:right;white-space:nowrap}

/* ── Print ── */
@media print{
  @page{margin:10mm 12mm;size:A4}
  body{background:#fff!important;font-size:11.5px}
  .page{box-shadow:none;max-width:100%}
  .stats-grid{grid-template-columns:repeat(4,1fr)!important}
  .two-col{page-break-inside:avoid}
  .exp-table tbody tr{page-break-inside:avoid}
  .settle-card{page-break-inside:avoid}
  .rpt-header,.exp-table thead tr,.exp-tfoot td,.rpt-footer{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .settle-card{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .tag-gets,.tag-owes,.tag-even,.exp-cat,.rec-badge{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .no-print{display:none!important}
  .party-table{page-break-inside:avoid}
  .drink-scroll{overflow-x:visible}
}
/* ── Party / Drink tables ── */
.party-table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:6px}
.party-table th{background:#f5f3ff;color:#4c1d95;font-weight:700;text-align:left;padding:8px 10px;border:1px solid #e0e7ff;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}
.party-table td{padding:7px 10px;border:1px solid #f3f4f6;vertical-align:middle}
.party-table tbody tr:nth-child(even){background:#fafafa}
.party-table tfoot td{background:#ede9fe;border-top:2px solid #c4b5fd;padding:8px 10px;font-weight:700}
.drink-scroll{overflow-x:auto;margin-bottom:8px}
.drink-matrix .sub-hd{background:#faf5ff;font-size:.65rem;color:#7c3aed;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.pc{text-align:center!important}.pr{text-align:right!important}
.fw{font-weight:700!important}.pur{color:#4c1d95!important}.red{color:#dc2626!important}.muted{color:#9ca3af;font-size:.72rem}
.na-chip{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:10px;padding:2px 8px;font-size:.72rem;font-weight:600;margin:2px 3px}
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="rpt-header">
    <div class="rh-left">
      <div class="rh-emoji">${g.emoji}</div>
      <div>
        <div class="rh-name">${escHtml(g.name)}</div>
        <div class="rh-sub">
          <span>${g.type}</span>
          <span>${sym} ${sym === '\u20b9' ? 'INR' : sym === '$' ? 'USD' : sym === '\u20ac' ? 'EUR' : sym === '\u00a3' ? 'GBP' : 'JPY'}</span>
          <span>${g.members.length} Members</span>
          <span>${dateRange}</span>
        </div>
      </div>
    </div>
    <div class="rh-right">
      <div class="rh-brand">&#x1F4B8; eHisaab<div class="rh-brand-sub">Expense Report</div></div>
      <div class="rh-date">Generated on ${printDate}</div>
    </div>
  </div>

  <div class="content">

    <!-- STATS -->
    <div class="stats-grid">
      <div class="stat-card hl">
        <div class="sc-val">${fmtP(totalSpent)}</div>
        <div class="sc-lbl">Total Spent</div>
        <div class="sc-sub">${dateRange}</div>
      </div>
      <div class="stat-card">
        <div class="sc-val">${fmtP(avgPerPerson)}</div>
        <div class="sc-lbl">Avg per Person</div>
        <div class="sc-sub">across ${g.members.length} members</div>
      </div>
      <div class="stat-card">
        <div class="sc-val">${allExps.length}</div>
        <div class="sc-lbl">Expenses</div>
        <div class="sc-sub">${catEntries.length} categor${catEntries.length !== 1 ? 'ies' : 'y'}</div>
      </div>
      <div class="stat-card">
        <div class="sc-val" style="color:${settlements.length === 0 ? '#059669' : '#dc2626'}">${settlements.length === 0 ? '\u2714 Settled' : settlements.length + ' Pending'}</div>
        <div class="sc-lbl">Settlements</div>
        <div class="sc-sub">${g.settlements.length} payment${g.settlements.length !== 1 ? 's' : ''} recorded</div>
      </div>
    </div>

    <!-- MEMBERS + CATEGORIES (two column) -->
    <div class="two-col">
      <div class="panel">
        <div class="sec-title">Members &amp; Balances <span>${g.members.length} members</span></div>
        <table class="m-table">
          <tbody>${membersHtml}</tbody>
        </table>
      </div>
      <div class="panel">
        <div class="sec-title">Spending by Category <span>${catEntries.length} categories</span></div>
        ${catHtml}
      </div>
    </div>

    <!-- EXPENSES TABLE -->
    <div class="exp-wrap">
      <div class="sec-title">All Expenses <span>${allExps.length} records &bull; Total ${fmtP(totalSpent)}</span></div>
      <table class="exp-table">
        <thead>
          <tr>
            <th style="width:30px">#</th>
            <th>Description</th>
            <th>Category</th>
            <th>Paid By</th>
            <th>Split</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${expRowsHtml}</tbody>
        <tfoot class="exp-tfoot">
          <tr>
            <td colspan="5" style="text-align:right;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;opacity:.8">Grand Total</td>
            <td class="exp-amt">${fmtP(totalSpent)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- SETTLEMENT PLAN -->
    <hr class="divider"/>
    <div class="sec-title">Settlement Plan <span>Minimum transactions to clear all debts</span></div>
    <div class="settle-grid">${settleCardsHtml}</div>

    ${recordedHtml}
    ${partyHtml}

  </div><!-- /content -->

  <!-- FOOTER -->
  <div class="rpt-footer">
    <div class="rf-brand">&#x1F4B8; eHisaab</div>
    <div class="rf-note">&#x1F512; All data is private and stored only on your device &bull; No data is sent to any server</div>
    <div class="rf-date">Report generated ${printDate}</div>
  </div>

</div><!-- /page -->

<script>
  // Auto-print after fonts load
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(() => window.print(), 300));
  } else {
    setTimeout(() => window.print(), 600);
  }
<\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=980,height=780,scrollbars=yes');
  if (!w) { showToast('\u26a0\ufe0f Allow pop-ups to open the print preview', 'error'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ─── SHARE GROUP LINK ────────────────────────────────────────
function shareGroup() {
  const g = getGroup();
  const data = { name: g.name, emoji: g.emoji, type: g.type, currency: g.currency, members: g.members, expenses: g.expenses };
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const url = location.href.split('#')[0] + '#import=' + encoded;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('\ud83d\udd17 Share link copied! Paste it to someone.')).catch(() => prompt('Copy this link:', url));
    } else { prompt('Copy this link:', url); }
  } catch { showToast('\u26a0\ufe0f Could not generate link', 'error'); }
}
function checkImportLink() {
  const hash = location.hash;
  if (!hash.startsWith('#import=')) return;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(hash.slice(8)))));
    if (!data.name || !data.members) return;
    if (!confirm('Import group "' + data.name + '" with ' + data.members.length + ' members?')) { location.hash = ''; return; }
    const g = { id: uid(), name: data.name, emoji: data.emoji || '\ud83d\udce6', type: data.type || 'Other', currency: data.currency || '\u20b9', members: data.members, expenses: data.expenses || [], settlements: [], partyDetails: null, activity: [] };
    state.groups.unshift(g); saveGroups(); renderHome();
    location.hash = ''; showToast('\u2705 Group "' + data.name + '" imported!');
  } catch { location.hash = ''; }
}

// ─── BROWSER NOTIFICATIONS ───────────────────────────────────
function requestNotifications() {
  document.getElementById('userDropdown').classList.add('hidden');
  if (!('Notification' in window)) { showToast('\u26a0\ufe0f Notifications not supported', 'error'); return; }
  Notification.requestPermission().then(p => {
    if (p === 'granted') showToast('\ud83d\udd14 Notifications enabled!');
    else showToast('\u26a0\ufe0f Notifications blocked in browser settings', 'error');
  });
}
function sendDebtNotification(from, to, amount) {
  if (Notification.permission === 'granted') {
    new Notification('eHisaab \ud83d\udcb8', { body: from + ' owes ' + to + ' ' + fmt(amount), icon: 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>💸</text></svg>' });
  }
}

// ─── CUSTOM DRINKS ───────────────────────────────────────────
function addCustomDrink(gridType) {
  const inputId = gridType === 'alcohol' ? 'customAlcInput' : 'customNonAlcInput';
  const gridId  = gridType === 'alcohol' ? 'alcoholGrid'    : 'nonAlcoholGrid';
  const name    = (document.getElementById(inputId)?.value || '').trim();
  if (!name) { showToast('\u26a0\ufe0f Enter a drink name', 'error'); return; }
  const grid = document.getElementById(gridId);
  const emoji = gridType === 'alcohol' ? '\ud83c\udf78' : '\ud83e\udd64';
  const chip  = document.createElement('label');
  chip.className = 'drink-chip';
  chip.innerHTML = '<input type="checkbox" value="' + escHtml(name) + '" checked /><span>' + emoji + ' ' + escHtml(name) + '</span>';
  chip.classList.add('checked');
  chip.querySelector('input').addEventListener('change', function() { chip.classList.toggle('checked', this.checked); });
  grid.appendChild(chip);
  document.getElementById(inputId).value = '';
  showToast('\u2705 "' + name + '" added!');
}

// ─── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check existing session
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (saved && saved.email && saved.name) {
      currentUser = saved;
      const _s = getSettings();
      if (_s.pin) {
        // If PIN is set, show PIN lock immediately — don't reveal app or auth screen
        _pendingBootAfterPIN = true;
        applyDarkMode(_s.darkMode);
        showPINLock();
      } else {
        bootApp();
      }
    } else {
      showAuthScreen();
    }
  } catch {
    showAuthScreen();
  }

  // Header new group button
  document.getElementById('btnNewGroup').addEventListener('click', openNewGroupModal);

  // Back button
  document.getElementById('btnBack').addEventListener('click', renderHome);

  // Add member / expense
  document.getElementById('btnAddMember').addEventListener('click', openAddMemberModal);
  document.getElementById('btnAddExpense').addEventListener('click', openAddExpenseModal);

  // Group type selector
  document.getElementById('groupTypeGrid').addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Show/hide party options
    const isParty = btn.dataset.type === 'Party';
    document.getElementById('partyOptions').classList.toggle('hidden', !isParty);
    if (isParty) {
      selectPartyType('non-alcohol');
      document.getElementById('partyNonAlcohol').classList.remove('hidden');
    }
  });

  // Init drink chip click handlers
  initDrinkChips();

  // Tab switcher
  document.querySelector('.tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (tab) switchTab(tab.dataset.tab);
  });

  // Split type selector
  document.getElementById('splitTypeRow').addEventListener('click', e => {
    const btn = e.target.closest('.split-btn');
    if (!btn) return;
    currentSplitType = btn.dataset.split;
    document.querySelectorAll('.split-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderSplitMembers();
  });

  // Amount input refreshes equal shares
  document.getElementById('inputExpenseAmount').addEventListener('input', () => {
    if (currentSplitType === 'equal') refreshEqualShares();
    else renderSplitMembers();
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  // Close user dropdown on outside click
  document.addEventListener('click', e => {
    const wrap = document.getElementById('userMenuWrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('userDropdown').classList.add('hidden');
    }
  });

  // Keyboard shortcuts
  document.getElementById('inputGroupName').addEventListener('keydown', e => { if (e.key === 'Enter') createGroup(); });
  document.getElementById('inputNewMember').addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });
  document.getElementById('inputExpenseDesc').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inputExpenseAmount').focus();
  });
});
