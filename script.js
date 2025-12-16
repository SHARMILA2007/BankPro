/* script.js - Frontend-only banking demo
   - Stores data in localStorage so it persists between reloads
   - Demo users seeded automatically
   - Provides: login/logout, transfer, card apply/block, statements & CSV export
*/

const APP_KEY = 'bankpro_v1';

// ---------- seed / storage helpers ----------
function loadState() {
  const s = localStorage.getItem(APP_KEY);
  if (s) return JSON.parse(s);
  // seed data
  const seed = {
    users: [
      { id: 1, username: 'sharmila', password: 'password123', fullName: 'Sharmila R' },
      { id: 2, username: 'john', password: 'johnpwd', fullName: 'John Doe' }
    ],
    accounts: [
      { id: 1, accountNumber: 'SBIN0001001', bankName: 'SameBank', balance: 50000, ownerId: 1 },
      { id: 2, accountNumber: 'SBIN0001002', bankName: 'SameBank', balance: 15000, ownerId: 1 },
      { id: 3, accountNumber: 'HDFC0002001', bankName: 'OtherBank', balance: 20000, ownerId: 2 }
    ],
    cards: [
      { id: 1, cardNumber: '4123456789012345', cardType: 'VISA', blocked: false, ownerId: 1 },
      { id: 2, cardNumber: '5123456789012346', cardType: 'MasterCard', blocked: false, ownerId: 2 }
    ],
    transactions: [],
    nextId: { user: 3, account: 4, card: 3, tx: 1 },
    session: { userId: null } // current logged in user
  };
  localStorage.setItem(APP_KEY, JSON.stringify(seed));
  return seed;
}
function saveState(state) { localStorage.setItem(APP_KEY, JSON.stringify(state)); }
let state = loadState();

// ---------- auth ----------
function currentUser() {
  return state.users.find(u => u.id === state.session.userId) || null;
}
function openLogin() {
  document.getElementById('loginModal').classList.remove('hidden');
}
function closeLogin() {
  document.getElementById('loginModal').classList.add('hidden');
}
function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const user = state.users.find(u => u.username === username && u.password === password);
  if (!user) { alert('Invalid credentials'); return; }
  state.session.userId = user.id;
  saveState(state);
  closeLogin();
  alert('Welcome, ' + user.fullName);
  refreshUI();
}
function logout() {
  state.session.userId = null;
  saveState(state);
  refreshUI();
}

// attach auth button(s) on pages
function attachAuthButtons() {
  const btns = document.querySelectorAll('#authBtn, #authBtn2');
  btns.forEach(b => {
    const cu = currentUser();
    if (cu) {
      b.textContent = 'Logout';
      b.onclick = logout;
    } else {
      b.textContent = 'Login';
      b.onclick = openLogin;
    }
  });
}

// ---------- UI helpers ----------
function openPage(path) { location.href = path; }
function formatCurrency(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function nowISO() { return new Date().toISOString(); }

// ---------- account / list render ----------
function renderAccountsOverview() {
  const el = document.getElementById('accountList');
  if (!el) return;
  const cu = currentUser();
  if (!cu) {
    el.innerHTML = '<p class="muted">Please login to view accounts</p>';
    return;
  }
  const accs = state.accounts.filter(a => a.ownerId === cu.id);
  if (!accs.length) el.innerHTML = '<p>No accounts</p>';
  else {
    el.innerHTML = accs.map(a => `<div class="acc-row"><div class="acc-num">${a.accountNumber}</div><div class="acc-bal">${formatCurrency(a.balance)}</div></div>`).join('');
  }
}

// ---------- Transfer logic ----------
function populateFromAccounts() {
  const sel = document.getElementById('fromAccount');
  if (!sel) return;
  sel.innerHTML = '';
  const cu = currentUser();
  if (!cu) { sel.innerHTML = '<option value="">-- Login required --</option>'; return; }
  const accs = state.accounts.filter(a => a.ownerId === cu.id);
  accs.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.accountNumber;
    opt.textContent = `${a.accountNumber} — ${formatCurrency(a.balance)}`;
    sel.appendChild(opt);
  });
}
function clearTransferForm(){
  const f = ['toAccount','amount','desc'];
  f.forEach(id => document.getElementById(id).value = '');
  document.getElementById('transferResult').textContent = '';
}
function handleTransfer() {
  const cu = currentUser();
  if (!cu) { alert('Please login to transfer'); return; }
  const from = document.getElementById('fromAccount').value;
  const to = document.getElementById('toAccount').value.trim();
  const amount = Number(document.getElementById('amount').value);
  const type = document.querySelector('input[name="ttype"]:checked').value;
  const desc = document.getElementById('desc').value.trim();

  const elRes = document.getElementById('transferResult');

  if (!from || !to || !amount || amount <= 0) {
    elRes.textContent = 'Please fill valid details';
    elRes.style.color = 'var(--danger)';
    return;
  }
  const fromAcc = state.accounts.find(a => a.accountNumber === from);
  const toAcc = state.accounts.find(a => a.accountNumber === to);

  // simple validations
  if (!fromAcc) { elRes.textContent = 'From account not found'; elRes.style.color = 'var(--danger)'; return; }
  if (!toAcc) { elRes.textContent = 'Receiver account not found (for demo, use seeded accounts)'; elRes.style.color = 'var(--danger)'; return; }
  if (fromAcc.balance < amount) { elRes.textContent = 'Insufficient balance'; elRes.style.color = 'var(--danger)'; return; }

  // process transfer
  fromAcc.balance -= amount;
  toAcc.balance += amount;

  const tx = {
    id: state.nextId.tx++,
    fromAccount: from,
    toAccount: to,
    amount: amount,
    timestamp: nowISO(),
    description: desc || (type === 'SAME' ? 'Same-bank transfer' : 'Different-bank transfer'),
    status: 'SUCCESS'
  };
  state.transactions.push(tx);
  saveState(state);

  elRes.textContent = `Transfer of ${formatCurrency(amount)} successful`;
  elRes.style.color = 'green';
  // update UI
  populateFromAccounts();
  renderAccountsOverview();
}

// ---------- Cards ----------
function renderCards() {
  const el = document.getElementById('cardsList');
  if (!el) return;
  const cu = currentUser();
  if (!cu) { el.innerHTML = '<p class="muted">Login to view cards</p>'; return; }
  const cards = state.cards.filter(c => c.ownerId === cu.id);
  if (!cards.length) el.innerHTML = '<p>No cards</p>';
  else {
    el.innerHTML = cards.map(c => `
      <div class="card-item">
        <div>
          <div class="meta">${c.cardType} • ${c.cardNumber}</div>
          <div class="status">${c.blocked ? '<span style="color:var(--danger)">Blocked</span>' : 'Active'}</div>
        </div>
        <div>
          ${c.blocked ? '' : `<button class="btn ghost" onclick="blockCard('${c.cardNumber}')">Block</button>`}
        </div>
      </div>
    `).join('');
  }
}
function applyNewCard(){
  const cu = currentUser();
  if (!cu) { alert('Please login to apply'); return; }
  const type = document.getElementById('newCardType').value || 'VISA';
  const cardNumber = generateCardNumber();
  const card = { id: state.nextId.card++, cardNumber, cardType: type, blocked: false, ownerId: cu.id };
  state.cards.push(card);
  saveState(state);
  document.getElementById('applyResult').textContent = `Applied successfully: ${cardNumber}`;
  renderCards();
}
function blockCard(cardNumber){
  if (!confirm('Block card ' + cardNumber + '?')) return;
  const c = state.cards.find(x => x.cardNumber === cardNumber);
  if (c) { c.blocked = true; saveState(state); renderCards(); alert('Card blocked'); }
}
function generateCardNumber(){
  // simple generator (not real card rules)
  const prefix = '4'; // visa-like
  const rnd = Math.random().toString().slice(2,17).slice(0,15);
  return prefix + rnd;
}

// ---------- Statements ----------
function renderStatements(){
  const el = document.getElementById('statementsTable');
  if (!el) return;
  const account = document.getElementById('stmtAccount') ? document.getElementById('stmtAccount').value : null;
  const fromD = document.getElementById('fromDate') ? document.getElementById('fromDate').value : null;
  const toD = document.getElementById('toDate') ? document.getElementById('toDate').value : null;
  let txs = state.transactions.slice().sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
  if (account) txs = txs.filter(t => t.fromAccount === account || t.toAccount === account);
  if (fromD) txs = txs.filter(t => new Date(t.timestamp) >= new Date(fromD));
  if (toD) txs = txs.filter(t => new Date(t.timestamp) <= new Date(toD + 'T23:59:59'));
  if (!txs.length) { el.innerHTML = '<p>No transactions</p>'; return; }
  const rows = txs.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.timestamp.split('T')[0]}</td>
      <td>${t.fromAccount}</td>
      <td>${t.toAccount}</td>
      <td>${formatCurrency(t.amount)}</td>
      <td>${t.description || ''}</td>
      <td>${t.status}</td>
    </tr>
  `).join('');
  el.innerHTML = `<table class="table"><thead><tr><th>ID</th><th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Description</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function populateStatementAccounts(){
  const sel = document.getElementById('stmtAccount');
  if (!sel) return;
  sel.innerHTML = '<option value="">All accounts</option>';
  const cu = currentUser();
  if (!cu) { sel.innerHTML = '<option>Login required</option>'; return; }
  const accs = state.accounts.filter(a => a.ownerId === cu.id);
  accs.forEach(a => sel.appendChild(Object.assign(document.createElement('option'), { value: a.accountNumber, innerText: a.accountNumber })));
}
function exportCSV(){
  const account = document.getElementById('stmtAccount') ? document.getElementById('stmtAccount').value : '';
  let txs = state.transactions.slice().sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  if (account) txs = txs.filter(t => t.fromAccount === account || t.toAccount === account);
  if (!txs.length) { alert('No transactions to export'); return; }
  const header = ['ID','Date','From','To','Amount','Description','Status'];
  const csv = [header.join(',')].concat(txs.map(t => [
    t.id, `"${t.timestamp}"`, `"${t.fromAccount}"`, `"${t.toAccount}"`, t.amount, `"${(t.description||'').replace(/"/g,'""')}"`, t.status
  ].join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `statements_${account||'all'}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ---------- init / refresh ----------
function refreshUI(){
  state = loadState();
  attachAuthButtons();
  renderAccountsOverview();
  populateFromAccounts();
  renderCards();
  populateStatementAccounts();
  renderStatements();
  // remember auth button (some pages may not have it yet)
  const authBtn = document.getElementById('authBtn');
  if (authBtn) {
    const cu = currentUser();
    if (cu) { authBtn.textContent = 'Logout'; authBtn.onclick = logout; }
    else { authBtn.textContent = 'Login'; authBtn.onclick = openLogin; }
  }
}

// run on load
document.addEventListener('DOMContentLoaded', () => {
  refreshUI();
  // close modal if clicked outside
  const modal = document.getElementById('loginModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeLogin(); });
});

// expose some functions to HTML
window.openPage = openPage;
window.openLogin = openLogin;
window.closeLogin = closeLogin;
window.doLogin = doLogin;
window.handleTransfer = handleTransfer;
window.clearTransferForm = clearTransferForm;
window.applyNewCard = applyNewCard;
window.blockCard = blockCard;
window.renderStatements = renderStatements;
window.exportCSV = exportCSV;
