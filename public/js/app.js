// ==========================================================================
// E-RAB SEKOLAH - CLIENT LOGIC & MOBILE-FIRST INTERACTION
// FASE 1 & FASE 2: Plafon Anggaran, Dynamic Line Items, & Proposal Submission
// ==========================================================================

let currentUser = null;
let currentPosList = [];
let currentProposals = [];
let activeViewName = 'dashboard';

// Format Rupiah Helper
function formatRupiah(val) {
  const num = Number(val) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadActiveUser();

  // Inisialisasi baris belanja pertama pada form RAB
  addItemRow({
    kategori: 'Perlengkapan',
    deskripsi: 'Spanduk & Banner Kegiatan',
    volume: 1,
    satuan: 'Paket',
    harga_satuan: 250000
  });
});

function setupEventListeners() {
  // Autentikasi: Form Login & Tombol Logout
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', handleLoginSubmit);
  }

  const btnTogglePassword = document.getElementById('btnTogglePassword');
  if (btnTogglePassword) {
    btnTogglePassword.addEventListener('click', togglePasswordVisibility);
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }

  const btnModalLogout = document.getElementById('btnModalLogout');
  if (btnModalLogout) {
    btnModalLogout.addEventListener('click', () => {
      closeRoleModal();
      handleLogout();
    });
  }

  // Modal Switch User
  document.getElementById('btnRoleSwitcher').addEventListener('click', openRoleModal);
  document.getElementById('btnCloseRoleModal').addEventListener('click', closeRoleModal);

  // Modal Add Pos Anggaran
  const btnAddPos = document.getElementById('btnAddPos');
  if (btnAddPos) {
    btnAddPos.addEventListener('click', openAddPosModal);
  }
  document.getElementById('btnClosePosModal').addEventListener('click', closePosModal);
  document.getElementById('formPosAnggaran').addEventListener('submit', handleSavePosAnggaran);

  // Form Pengajuan RAB
  document.getElementById('formPengajuanRab').addEventListener('submit', handleSubmitProposal);

  // Form Pencairan Kas (Fase 4)
  const formCairkan = document.getElementById('formPencairanKas');
  if (formCairkan) {
    formCairkan.addEventListener('submit', handlePencairanSubmit);
  }

  // Form Submit LPJ (Fase 5)
  const formLpj = document.getElementById('formSubmitLpj');
  if (formLpj) {
    formLpj.addEventListener('submit', handleSubmitLpj);
  }

  // Close modals on overlay click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
}

// --- 1. View Switching Logic (Mobile & Desktop) ---
function switchView(viewName) {
  activeViewName = viewName;

  // Sembunyikan semua tampilan
  document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));

  // Update status tab desktop
  document.querySelectorAll('.desktop-tab-btn').forEach(btn => btn.classList.remove('active'));
  // Update status navbar mobile
  document.querySelectorAll('.mobile-nav-bar .nav-item').forEach(btn => btn.classList.remove('active'));

  if (viewName === 'dashboard') {
    document.getElementById('viewDashboard').classList.add('active');
    const tabDesk = document.getElementById('tabDeskDashboard');
    if (tabDesk) tabDesk.classList.add('active');
    document.getElementById('navHome').classList.add('active');
    loadSummaryStats();
    loadPosAnggaran();
  } else if (viewName === 'ajukan') {
    document.getElementById('viewAjukan').classList.add('active');
    const tabDesk = document.getElementById('tabDeskAjukan');
    if (tabDesk) tabDesk.classList.add('active');
    document.getElementById('navAjukan').classList.add('active');
    populatePosDropdown();
    calculateGrandTotal();
  } else if (viewName === 'riwayat') {
    document.getElementById('viewRiwayat').classList.add('active');
    const tabDesk = document.getElementById('tabDeskRiwayat');
    if (tabDesk) tabDesk.classList.add('active');
    document.getElementById('navRiwayat').classList.add('active');
    loadProposalsList();
  }

  // Scroll to top saat berpindah tampilan
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 2. User & Authentication Management ---

async function loadActiveUser() {
  try {
    const res = await fetch('/api/auth/active-user');
    if (!res.ok) {
      showLoginScreen();
      return;
    }
    const data = await res.json();
    if (data.success && data.user) {
      showAuthenticatedApp(data.user);
    } else {
      showLoginScreen();
    }
  } catch (err) {
    console.error('Error fetching active user:', err);
    showLoginScreen();
  }
}

function showLoginScreen() {
  currentUser = null;
  const loginScreen = document.getElementById('appLoginScreen');
  const appShell = document.getElementById('appAuthenticatedShell');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appShell) appShell.style.display = 'none';

  // Sembunyikan alert saat membuka login
  const alertBox = document.getElementById('loginAlertBox');
  if (alertBox) alertBox.style.display = 'none';
}

function showAuthenticatedApp(user) {
  currentUser = user;
  const loginScreen = document.getElementById('appLoginScreen');
  const appShell = document.getElementById('appAuthenticatedShell');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appShell) appShell.style.display = 'block';

  renderUserHeader(currentUser);
  loadSummaryStats();
  loadPosAnggaran();
  if (activeViewName === 'riwayat') {
    loadProposalsList();
  }
}

function renderUserHeader(user) {
  document.getElementById('userNameDisplay').textContent = user.nama_lengkap;
  document.getElementById('userRoleDisplay').textContent = user.role.replace('_', ' ');
  document.getElementById('userAvatarInitial').textContent = user.nama_lengkap.charAt(0);
}

// Handler Submit Form Login Resmi
async function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const ident = document.getElementById('loginIdentifier').value.trim();
  const pass = document.getElementById('loginPassword').value;
  await performLogin(ident, pass);
}

async function performLogin(identifier, password) {
  const alertBox = document.getElementById('loginAlertBox');
  const alertMsg = document.getElementById('loginAlertMessage');
  const submitBtn = document.getElementById('btnLoginSubmit');

  if (alertBox) alertBox.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10"></path>
      </svg>
      <span>Memverifikasi Akun...</span>
    `;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (alertBox && alertMsg) {
        alertMsg.textContent = data.message || 'Gagal masuk. Periksa kembali NIP/Email dan password Anda.';
        alertBox.style.display = 'flex';
      }
      return;
    }

    // Login Berhasil
    document.getElementById('loginIdentifier').value = '';
    document.getElementById('loginPassword').value = '';
    showAuthenticatedApp(data.user);
    showNotification(`Selamat datang kembali, ${data.user.nama_lengkap}!`);
  } catch (err) {
    if (alertBox && alertMsg) {
      alertMsg.textContent = 'Terjadi gangguan jaringan atau server tidak merespons.';
      alertBox.style.display = 'flex';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        <span>Masuk ke Akun Saya</span>
      `;
    }
  }
}

// 1-Click Quick Demo Login
async function quickFillAndLogin(ident, pass) {
  const inputIdent = document.getElementById('loginIdentifier');
  const inputPass = document.getElementById('loginPassword');
  if (inputIdent) inputIdent.value = ident;
  if (inputPass) inputPass.value = pass;
  await performLogin(ident, pass);
}
window.quickFillAndLogin = quickFillAndLogin;

// Toggle Password Visibility
function togglePasswordVisibility() {
  const input = document.getElementById('loginPassword');
  const icon = document.getElementById('eyeIcon');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `;
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
    }
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

// Logout Handler Resmi
async function handleLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari sistem E-RAB?')) {
    return;
  }

  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout network error:', err);
  }

  showLoginScreen();
  showNotification('Anda telah berhasil keluar dari akun.');
}
window.handleLogout = handleLogout;

async function openRoleModal() {
  const modal = document.getElementById('modalRole');
  const roleListEl = document.getElementById('roleOptionsList');
  roleListEl.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Memuat daftar pengguna...</div>';
  modal.classList.add('active');

  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.success) {
      renderRoleOptions(data.users);
    }
  } catch (err) {
    roleListEl.innerHTML = '<div style="color:var(--rose);">Gagal memuat pengguna.</div>';
  }
}

function closeRoleModal() {
  document.getElementById('modalRole').classList.remove('active');
}

function renderRoleOptions(users) {
  const roleListEl = document.getElementById('roleOptionsList');
  roleListEl.innerHTML = '';

  users.forEach(u => {
    const isCurrent = currentUser && currentUser.id === u.id;
    const card = document.createElement('div');
    card.className = `role-option-card ${isCurrent ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="user-avatar" style="width: 36px; height: 36px; font-size: 0.9rem;">
        ${u.nama_lengkap.charAt(0)}
      </div>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${u.nama_lengkap}</span>
          <span class="role-badge-tag ${u.role}">${u.role.replace('_', ' ')}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
          ${u.unit_bagian} ${u.nip ? '• NIP: ' + u.nip : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => switchUserRole(u.id));
    roleListEl.appendChild(card);
  });
}

async function switchUserRole(userId) {
  try {
    const res = await fetch('/api/auth/switch-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      renderUserHeader(currentUser);
      closeRoleModal();
      showNotification(`Beralih ke akun: ${currentUser.nama_lengkap} (${currentUser.role})`);
      loadProposalsList();
      loadSummaryStats();
      loadPosAnggaran();
    }
  } catch (err) {
    console.error('Error switching user:', err);
  }
}

// --- 3. Financial Summary Stats & Pos Anggaran ---
async function loadSummaryStats() {
  try {
    const res = await fetch('/api/summary');
    const data = await res.json();
    if (data.success && data.summary) {
      const s = data.summary;
      document.getElementById('statTotalPagu').textContent = formatRupiah(s.total_pagu);
      document.getElementById('statTerserap').textContent = formatRupiah(s.total_terserap);
      document.getElementById('statTercadangkan').textContent = formatRupiah(s.total_tercadangkan);
      document.getElementById('statSisaAktif').textContent = formatRupiah(s.sisa_pagu_aktif);
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

async function loadPosAnggaran() {
  const container = document.getElementById('budgetCardsList');
  container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Memuat data pos anggaran...</div>';

  try {
    const res = await fetch('/api/pos-anggaran');
    const data = await res.json();
    if (data.success && data.data) {
      currentPosList = data.data;
      document.getElementById('posCountBadge').textContent = `${currentPosList.length} Pos Aktif`;
      renderPosAnggaranCards(currentPosList);
    }
  } catch (err) {
    container.innerHTML = '<div style="color:var(--rose); padding: 20px;">Gagal memuat pos anggaran.</div>';
  }
}

function renderPosAnggaranCards(list) {
  const container = document.getElementById('budgetCardsList');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Belum ada pos anggaran terdaftar.</div>';
    return;
  }

  list.forEach(item => {
    let trafficLabel = 'AMAN';
    if (item.trafficLight === 'yellow') trafficLabel = 'WASPADA';
    if (item.trafficLight === 'red') trafficLabel = 'KRITIS / PENUH';

    const card = document.createElement('div');
    card.className = 'budget-card';
    card.innerHTML = `
      <div class="budget-card-top">
        <div>
          <h3 class="budget-name">${item.nama_pos}</h3>
          <div class="budget-year">T.A. ${item.tahun_ajaran} ${item.keterangan ? '• ' + item.keterangan : ''}</div>
        </div>
        <span class="traffic-badge ${item.trafficLight}">
          <span class="traffic-dot"></span>
          ${trafficLabel}
        </span>
      </div>

      <div class="budget-progress-wrap">
        <div class="progress-info">
          <span>Serapan (${item.persentaseTerserap}%)</span>
          <span>Tersedia: <strong>${formatRupiah(item.sisa_pagu)}</strong></span>
        </div>
        <div class="progress-track">
          <div class="progress-bar ${item.trafficLight}" style="width: ${item.persentaseTerserap}%"></div>
        </div>
      </div>

      <div class="budget-stats-breakdown">
        <div class="breakdown-item">
          <div class="breakdown-label">Pagu Plafon</div>
          <div class="breakdown-val">${formatRupiah(item.pagu_awal)}</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-label">Realisasi Kas</div>
          <div class="breakdown-val" style="color: var(--amber);">${formatRupiah(item.total_terserap)}</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-label">Sisa Aktif</div>
          <div class="breakdown-val active-sisa">${formatRupiah(item.sisa_pagu)}</div>
        </div>
      </div>

      <div style="margin-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="font-size: 0.72rem; color: var(--text-subtle);">
          Pending Review: <strong>${formatRupiah(item.pagu_tercadangkan)}</strong>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openEditPosModal(${item.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          Edit Pagu
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Populate Pos Anggaran Dropdown in Proposal Form
function populatePosDropdown() {
  const select = document.getElementById('selectPosAnggaran');
  const selectedVal = select.value;
  select.innerHTML = '<option value="">-- Pilih Pos Anggaran yang Dibebani --</option>';

  currentPosList.forEach(pos => {
    const opt = document.createElement('option');
    opt.value = pos.id;
    opt.textContent = `${pos.nama_pos} (Sisa Pagu: ${formatRupiah(pos.sisa_pagu)})`;
    if (selectedVal && Number(selectedVal) === pos.id) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

// --- 4. FASE 2: DYNAMIC RAB LINE ITEMS & BUDGET VALIDATION ---

function addItemRow(defaults = {}) {
  const container = document.getElementById('rabItemsContainer');
  const rowCount = container.children.length + 1;

  const card = document.createElement('div');
  card.className = 'item-row-card';
  card.innerHTML = `
    <div class="item-card-header">
      <span class="item-index-badge">Item #${rowCount}</span>
      <button type="button" class="btn-remove-row" onclick="removeItemRow(this)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Hapus
      </button>
    </div>

    <div class="item-card-body-grid">
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Kategori Belanja</label>
        <select class="form-select item-kategori">
          <option value="Perlengkapan" ${defaults.kategori === 'Perlengkapan' ? 'selected' : ''}>Perlengkapan</option>
          <option value="Konsumsi" ${defaults.kategori === 'Konsumsi' ? 'selected' : ''}>Konsumsi (Snack/Makan)</option>
          <option value="Honorarium" ${defaults.kategori === 'Honorarium' ? 'selected' : ''}>Honorarium / Juri / Pemateri</option>
          <option value="Transportasi" ${defaults.kategori === 'Transportasi' ? 'selected' : ''}>Transportasi / Sewa Kendaraan</option>
          <option value="Administrasi" ${defaults.kategori === 'Administrasi' ? 'selected' : ''}>Administrasi & Cetak</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Deskripsi Item Belanja *</label>
        <input type="text" class="form-input item-deskripsi" placeholder="Cth: Snack Rapat Panitia (20 Orang)" value="${defaults.deskripsi || ''}" required>
      </div>
    </div>

    <div class="item-card-calc-grid">
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Volume</label>
        <input type="number" class="form-input item-volume" min="1" step="1" value="${defaults.volume || 1}" required oninput="handleRowInput(this)">
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Satuan</label>
        <input type="text" class="form-input item-satuan" placeholder="Porsi/Kotak" value="${defaults.satuan || 'Porsi'}" required>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Harga Satuan (Rp)</label>
        <input type="number" class="form-input item-harga" min="0" step="500" placeholder="15000" value="${defaults.harga_satuan || 0}" required oninput="handleRowInput(this)">
      </div>
    </div>

    <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
      <div class="subtotal-display-box">
        <span class="subtotal-label">Subtotal Item</span>
        <span class="subtotal-value item-subtotal-display">Rp 0</span>
      </div>
    </div>
  `;

  container.appendChild(card);
  updateItemRowIndices();
  calculateRowSubtotal(card);
  calculateGrandTotal();
}

function removeItemRow(btn) {
  const container = document.getElementById('rabItemsContainer');
  if (container.children.length <= 1) {
    alert('Minimal harus ada 1 baris rincian belanja dalam proposal.');
    return;
  }
  const card = btn.closest('.item-row-card');
  card.remove();
  updateItemRowIndices();
  calculateGrandTotal();
}

function updateItemRowIndices() {
  const container = document.getElementById('rabItemsContainer');
  const cards = container.querySelectorAll('.item-row-card');
  document.getElementById('itemCountBadge').textContent = `${cards.length} Item`;
  cards.forEach((card, idx) => {
    const badge = card.querySelector('.item-index-badge');
    if (badge) badge.textContent = `Item #${idx + 1}`;
  });
}

function handleRowInput(input) {
  const card = input.closest('.item-row-card');
  calculateRowSubtotal(card);
  calculateGrandTotal();
}

function calculateRowSubtotal(card) {
  const vol = Number(card.querySelector('.item-volume').value) || 0;
  const harga = Number(card.querySelector('.item-harga').value) || 0;
  const subtotal = vol * harga;
  card.querySelector('.item-subtotal-display').textContent = formatRupiah(subtotal);
  card.dataset.subtotal = subtotal;
}

function handlePosSelected() {
  calculateGrandTotal();
}

function calculateGrandTotal() {
  const container = document.getElementById('rabItemsContainer');
  const cards = container.querySelectorAll('.item-row-card');
  let grandTotal = 0;

  cards.forEach(card => {
    const vol = Number(card.querySelector('.item-volume').value) || 0;
    const harga = Number(card.querySelector('.item-harga').value) || 0;
    grandTotal += (vol * harga);
  });

  document.getElementById('displayGrandTotal').textContent = formatRupiah(grandTotal);

  // Validasi Traffic Light terhadap Pos Anggaran Terpilih
  const selectPos = document.getElementById('selectPosAnggaran');
  const posId = Number(selectPos.value);
  const alertBox = document.getElementById('liveBudgetAlertBox');
  const alertText = document.getElementById('liveBudgetAlertText');
  const btnSubmit = document.getElementById('btnSubmitProposal');

  if (!posId) {
    alertBox.style.display = 'flex';
    alertBox.className = 'live-budget-alert';
    alertBox.style.background = 'rgba(255,255,255,0.05)';
    alertBox.style.borderColor = 'var(--border-subtle)';
    alertText.innerHTML = 'Silakan pilih <strong>Pos Anggaran</strong> di atas untuk memantau sisa pagu belanja.';
    btnSubmit.disabled = false;
    return;
  }

  const pos = currentPosList.find(p => p.id === posId);
  if (!pos) return;

  alertBox.style.display = 'flex';

  if (grandTotal <= 0) {
    alertBox.className = 'live-budget-alert safe';
    alertText.innerHTML = `Sisa pagu aktif pada <strong>${pos.nama_pos}</strong> adalah <strong>${formatRupiah(pos.sisa_pagu)}</strong>. Masukkan rincian belanja.`;
    btnSubmit.disabled = false;
  } else if (grandTotal <= pos.sisa_pagu) {
    const sisaSetelah = pos.sisa_pagu - grandTotal;
    alertBox.className = 'live-budget-alert safe';
    alertText.innerHTML = `
      🟢 <strong>Usulan Anggaran Aman:</strong> Total ajuan <strong>${formatRupiah(grandTotal)}</strong> masih dalam batas sisa pagu.
      <br><span style="font-size:0.75rem; color: #065f46; font-weight:600;">Estimasi sisa pagu setelah usulan ini disetujui: ${formatRupiah(sisaSetelah)}</span>
    `;
    btnSubmit.disabled = false;
  } else {
    const overBudget = grandTotal - pos.sisa_pagu;
    alertBox.className = 'live-budget-alert overbudget';
    alertText.innerHTML = `
      🔴 <strong>PERINGATAN OVER-BUDGET:</strong> Total ajuan <strong>${formatRupiah(grandTotal)}</strong> melebihi sisa pagu aktif (<strong>${formatRupiah(pos.sisa_pagu)}</strong>).
      <br><span style="font-weight:700;">Kelebihan dana: ${formatRupiah(overBudget)}</span>. Mohon sesuaikan volume atau harga satuan sebelum mengirim usulan.
    `;
    btnSubmit.disabled = true; // Kunci tombol simpan (Zero-Leakage Budgeting)
  }
}

// Submit Proposal Form
async function handleSubmitProposal(e) {
  e.preventDefault();

  const selectPos = document.getElementById('selectPosAnggaran');
  const posId = selectPos.value;
  if (!posId) {
    alert('Harap pilih Pos Anggaran yang dibebani.');
    return;
  }

  const container = document.getElementById('rabItemsContainer');
  const cards = container.querySelectorAll('.item-row-card');
  const items = [];

  for (const card of cards) {
    const kategori = card.querySelector('.item-kategori').value;
    const deskripsi = card.querySelector('.item-deskripsi').value.trim();
    const volume = Number(card.querySelector('.item-volume').value) || 0;
    const satuan = card.querySelector('.item-satuan').value.trim();
    const harga_satuan = Number(card.querySelector('.item-harga').value) || 0;

    if (!deskripsi) {
      alert('Deskripsi item belanja tidak boleh kosong.');
      return;
    }

    items.push({ kategori, deskripsi, volume, satuan, harga_satuan });
  }

  const payload = {
    pos_anggaran_id: Number(posId),
    nama_kegiatan: document.getElementById('inputNamaKegiatan').value.trim(),
    latar_belakang: document.getElementById('inputLatarBelakang').value.trim(),
    tanggal_mulai: document.getElementById('inputTglMulai').value,
    tanggal_selesai: document.getElementById('inputTglSelesai').value,
    items
  };

  const btnSubmit = document.getElementById('btnSubmitProposal');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Mengirim Usulan...';

  try {
    const res = await fetch('/api/pengajuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showNotification(`🎉 ${data.message}`);
      document.getElementById('formPengajuanRab').reset();
      // Reset items ke 1 baris
      container.innerHTML = '';
      addItemRow();
      // Refresh data pagu & buka tab riwayat
      await loadSummaryStats();
      await loadPosAnggaran();
      switchView('riwayat');
    } else {
      alert(data.message || 'Gagal mengajukan proposal.');
    }
  } catch (err) {
    console.error('Error submitting proposal:', err);
    alert('Terjadi kesalahan koneksi.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
      </svg>
      Kirim Usulan RAB
    `;
  }
}

// --- 5. FASE 2: PROPOSAL HISTORY & DETAIL MODAL ---

async function loadProposalsList() {
  const container = document.getElementById('proposalsListContainer');
  container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Memuat riwayat usulan...</div>';

  try {
    const res = await fetch('/api/pengajuan');
    if (res.status === 401) {
      showLoginScreen();
      return;
    }
    const data = await res.json();
    if (data.success && data.data) {
      currentProposals = data.data;

      const isGuru = currentUser && currentUser.role === 'GURU';
      const titleEl = document.getElementById('riwayatViewTitle');
      const subtitleEl = document.getElementById('riwayatViewSubtitle');
      
      if (titleEl && subtitleEl) {
        if (isGuru) {
          titleEl.textContent = 'Riwayat Usulan Saya';
          subtitleEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; color:#059669; font-weight:700;">🔒 Area Usulan Pribadi:</span> Menampilkan khusus usulan dari akun Anda (<strong>${currentUser.nama_lengkap}</strong>). Berkas usulan guru/unit lain terisolasi & tidak dapat diakses.`;
        } else {
          titleEl.textContent = 'Daftar Seluruh Usulan Sekolah';
          subtitleEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; color:#2563eb; font-weight:700;">🌐 Mode Pengawasan Institusi (${currentUser.role}):</span> Memantau seluruh usulan kegiatan dari semua guru dan unit pembina sekolah.`;
        }
      }

      document.getElementById('proposalCountBadge').textContent = `${currentProposals.length} Proposal`;
      renderProposalsList(currentProposals);
    }
  } catch (err) {
    container.innerHTML = '<div style="color:var(--rose); padding: 20px;">Gagal memuat usulan kegiatan.</div>';
  }
}

function renderProposalsList(proposals) {
  const container = document.getElementById('proposalsListContainer');
  container.innerHTML = '';

  if (proposals.length === 0) {
    const isGuru = currentUser && currentUser.role === 'GURU';
    const emptyTitle = isGuru ? 'Anda Belum Memiliki Usulan RAB' : 'Belum Ada Usulan Masuk dari Guru';
    const emptyDesc = isGuru 
      ? 'Anda belum mengajukan rencana anggaran kegiatan. Tekan tombol di bawah untuk membuat usulan baru.'
      : 'Saat ini belum ada proposal kegiatan yang diajukan oleh guru pembina sekolah.';

    container.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-subtle); margin-bottom: 12px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main);">${emptyTitle}</div>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin: 6px 0 16px;">
          ${emptyDesc}
        </p>
        <button class="btn btn-primary btn-sm" onclick="switchView('ajukan')">
          + Buat Usulan RAB Sekarang
        </button>
      </div>
    `;
    return;
  }

  proposals.forEach(p => {
    let statusLabel = p.status.replace(/_/g, ' ');
    if (p.status === 'MENUNGGU_REVIEW') statusLabel = 'Menunggu Review Bendahara';
    if (p.status === 'MENUNGGU_PERSETUJUAN_KEPSEK') statusLabel = 'Menunggu Persetujuan Kepsek';
    if (p.status === 'DISETUJUI') statusLabel = 'Disetujui (Siap Dicairkan)';
    if (p.status === 'PERLU_REVISI') statusLabel = 'Perlu Revisi';
    if (p.status === 'DICAIRKAN') statusLabel = 'Dana Dicairkan (Siap LPJ)';
    if (p.status === 'MENUNGGU_VERIFIKASI_LPJ') statusLabel = 'Menunggu Verifikasi LPJ';
    if (p.status === 'SELESAI') statusLabel = 'Selesai & LPJ Terverifikasi';

    // Role-based quick action button on card
    let roleActionBtn = '';
    const isBendahara = currentUser && (currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');
    const isKepsek = currentUser && (currentUser.role === 'KEPALA_SEKOLAH' || currentUser.role === 'ADMIN');
    const isOwnerGuru = currentUser && (currentUser.id === p.user_id || currentUser.role === 'ADMIN');

    if (isBendahara && (p.status === 'MENUNGGU_REVIEW' || p.status === 'PERLU_REVISI')) {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #d97706, #f59e0b); color: #fff;" onclick="event.stopPropagation(); openReviewModal(${p.id})">
          ✏️ Telaah & Koreksi
        </button>
      `;
    } else if (isKepsek && p.status === 'MENUNGGU_PERSETUJUAN_KEPSEK') {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #059669, #10b981);" onclick="event.stopPropagation(); openKepsekModal(${p.id})">
          🛡️ Beri Otorisasi Final
        </button>
      `;
    } else if (isBendahara && p.status === 'DISETUJUI') {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #059669, #10b981);" onclick="event.stopPropagation(); openCairkanModal(${p.id})">
          💵 Cairkan Kas
        </button>
      `;
    } else if (isOwnerGuru && p.status === 'DICAIRKAN') {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: #fff;" onclick="event.stopPropagation(); openSubmitLpjModal(${p.id})">
          📋 Buat LPJ
        </button>
      `;
    } else if (isBendahara && p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #d97706, #f59e0b); color: #fff;" onclick="event.stopPropagation(); openVerifikasiLpjModal(${p.id})">
          🔍 Verifikasi LPJ
        </button>
      `;
    } else if (isOwnerGuru && p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
      roleActionBtn = `
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openSubmitLpjModal(${p.id})">
          ✏️ Edit LPJ
        </button>
      `;
    }

    let printActionBtn = '';
    if (p.status === 'DISETUJUI' || p.status === 'DICAIRKAN' || p.status === 'MENUNGGU_VERIFIKASI_LPJ' || p.status === 'SELESAI') {
      printActionBtn = `
        <a href="/cetak/${p.id}" target="_blank" class="btn-print-action" onclick="event.stopPropagation()">
          🖨️ Disposisi
        </a>
      `;
    }

    let revisionNoteHtml = '';
    if (p.status === 'PERLU_REVISI' && p.catatan_bendahara) {
      revisionNoteHtml = `
        <div style="background: var(--rose-bg); border: 1px solid var(--rose-border); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 0.78rem; color: #9f1239; margin-top: 8px;">
          <strong>Catatan Revisi:</strong> ${p.catatan_bendahara}
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = 'proposal-item-card';
    card.onclick = () => openProposalDetail(p.id);
    card.innerHTML = `
      <div class="proposal-top-row">
        <div>
          <span class="proposal-number-tag">${p.nomor_surat_ajuan}</span>
          <h3 class="proposal-title">${p.nama_kegiatan}</h3>
        </div>
        <span class="status-pill ${p.status}">
          ${statusLabel}
        </span>
      </div>

      <div class="proposal-meta-row">
        <span class="proposal-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
          ${p.nama_pos}
        </span>
        <span class="proposal-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          ${p.pemohon_nama} (${p.pemohon_unit})
        </span>
        <span class="proposal-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${p.tanggal_mulai || '-'} s/d ${p.tanggal_selesai || '-'}
        </span>
      </div>

      ${revisionNoteHtml}

      <div class="proposal-bottom-row" style="margin-top: 10px;">
        <div style="font-size: 0.75rem; color: var(--text-subtle);">
          Diajukan: ${p.created_at}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-right: 4px;">Nominal:</span>
            <span class="proposal-cost-val">${formatRupiah(p.total_dana_disetujui || p.total_dana_diajukan)}</span>
          </div>
          ${printActionBtn}
          ${roleActionBtn}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

async function openProposalDetail(id) {
  const modal = document.getElementById('modalDetailProposal');
  modal.classList.add('active');

  document.getElementById('detailNomorSurat').textContent = 'Memuat...';
  document.getElementById('detailNamaKegiatan').textContent = 'Mengambil rincian RAB...';
  document.getElementById('detailItemsTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Memuat item belanja...</td></tr>';
  document.getElementById('detailAuditTimeline').innerHTML = '<div style="color:var(--text-subtle); font-size:0.8rem;">Memuat riwayat pemeriksaan...</div>';

  try {
    const res = await fetch(`/api/pengajuan/${id}`);
    const data = await res.json();
    if (data.success && data.data) {
      const p = data.data;
      document.getElementById('detailNomorSurat').textContent = p.nomor_surat_ajuan;
      document.getElementById('detailNamaKegiatan').textContent = p.nama_kegiatan;
      document.getElementById('detailPemohon').textContent = `${p.pemohon_nama} (${p.pemohon_unit})`;
      document.getElementById('detailPosAnggaran').textContent = `${p.nama_pos} (T.A. ${p.tahun_ajaran})`;
      document.getElementById('detailTanggal').textContent = `${p.tanggal_mulai || '-'} s/d ${p.tanggal_selesai || '-'}`;
      document.getElementById('detailLatarBelakang').textContent = p.latar_belakang || '-';
      document.getElementById('detailTotalBiaya').textContent = formatRupiah(p.total_dana_disetujui || p.total_dana_diajukan);

      document.getElementById('detailStatusBadge').innerHTML = `
        <span class="status-pill ${p.status}">${p.status.replace(/_/g, ' ')}</span>
      `;

      // Banner Info Realisasi Pencairan Kas (Fase 4)
      const bannerCair = document.getElementById('detailPencairanInfoBanner');
      if (bannerCair) {
        if (p.status === 'DICAIRKAN' || p.status === 'SELESAI') {
          const metodeStr = p.metode_pencairan === 'TRANSFER_BANK'
            ? `Transfer Bank ${p.bank_tujuan || ''} (No. Rek: ${p.nomor_rekening || '-'}, Ref: ${p.nomor_referensi_transfer || '-'})`
            : 'Kas Tunai Langsung';
          bannerCair.style.display = 'block';
          bannerCair.innerHTML = `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 12px 16px; font-size: 0.82rem; color: #065f46;">
              <div style="font-weight: 800; font-size: 0.88rem; margin-bottom: 4px;">💵 REALISASI KAS: TELAH DICAIRKAN RESMI</div>
              <div>Dicairkan pada <strong>${p.tanggal_pencairan || '-'}</strong> via <strong>${metodeStr}</strong> kepada <strong>${p.penerima_dana || p.pemohon_nama}</strong>.</div>
              ${p.catatan_pencairan ? `<div style="font-size: 0.75rem; margin-top: 4px; font-style: italic; color: #047857;">Catatan: "${p.catatan_pencairan}"</div>` : ''}
            </div>
          `;
        } else {
          bannerCair.style.display = 'none';
          bannerCair.innerHTML = '';
        }
      }

      // Banner Info LPJ & Bukti Nota (Fase 5)
      const bannerLpj = document.getElementById('detailLpjInfoBanner');
      if (bannerLpj) {
        if (p.lpj) {
          const l = p.lpj;
          const fileNotaLink = l.file_nota_url
            ? `<a href="${l.file_nota_url}" target="_blank" style="color:var(--primary); font-weight:700; text-decoration:underline;">📎 Lihat Berkas Bukti Nota</a>`
            : '<span style="color:var(--text-muted); font-size:0.75rem;">Nota fisik diserahkan langsung</span>';

          bannerLpj.style.display = 'block';
          bannerLpj.innerHTML = `
            <div style="background: #f8fafc; border: 1.5px solid var(--border-card); border-radius: var(--radius-md); padding: 12px 16px; font-size: 0.82rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight: 800; color: var(--text-main);">📋 PERTANGGUNGJAWABAN BIAYA (LPJ)</span>
                <span class="status-pill ${p.status}">${l.status_lpj.replace(/_/g, ' ')}</span>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 8px;">
                <div><span style="color:var(--text-muted); font-size:0.72rem;">Belanja Riil:</span><br><strong>${formatRupiah(l.total_belanja_riil)}</strong></div>
                <div><span style="color:var(--text-muted); font-size:0.72rem;">Sisa Pengembalian:</span><br><strong style="color:#059669;">${formatRupiah(l.sisa_pengembalian_dana)}</strong></div>
                <div><span style="color:var(--text-muted); font-size:0.72rem;">Bukti Nota:</span><br>${fileNotaLink}</div>
              </div>
              ${l.catatan_lpj ? `<div style="color:var(--text-body); font-style:italic; font-size:0.76rem; border-top:1px dashed var(--border-subtle); padding-top:6px;">Catatan: "${l.catatan_lpj}"</div>` : ''}
            </div>
          `;
        } else {
          bannerLpj.style.display = 'none';
          bannerLpj.innerHTML = '';
        }
      }

      // Render Baris Belanja
      const tbody = document.getElementById('detailItemsTableBody');
      tbody.innerHTML = '';
      if (!p.items || p.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Tidak ada rincian belanja.</td></tr>';
      } else {
        p.items.forEach((item, idx) => {
          const subtotalFinal = item.subtotal_disetujui !== null ? item.subtotal_disetujui : item.subtotal_ajuan;
          const hargaFinal = item.harga_satuan_disetujui !== null ? item.harga_satuan_disetujui : item.harga_satuan_ajuan;
          const volFinal = item.volume_disetujui !== null ? item.volume_disetujui : item.volume_ajuan;

          let koreksiNote = '';
          if (item.catatan_koreksi) {
            koreksiNote = `<div style="font-size:0.7rem; color:var(--amber); margin-top:2px;">⚠️ ${item.catatan_koreksi}</div>`;
          }

          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid var(--border-subtle)';
          tr.innerHTML = `
            <td style="padding: 10px 6px; color: var(--text-muted);">${idx + 1}</td>
            <td style="padding: 10px 6px;"><span class="badge-counter" style="font-size:0.68rem;">${item.kategori_belanja}</span></td>
            <td style="padding: 10px 6px; font-weight: 600; color: var(--text-main);">
              ${item.deskripsi_item}
              ${koreksiNote}
            </td>
            <td style="padding: 10px 6px; text-align: center;">${volFinal} ${item.satuan}</td>
            <td style="padding: 10px 6px; text-align: right;">${formatRupiah(hargaFinal)}</td>
            <td style="padding: 10px 6px; text-align: right; font-weight: 700; color: var(--primary);">${formatRupiah(subtotalFinal)}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Load Audit Trail Timeline
      loadAuditTimeline(id);

      // Render Footer Action Buttons based on User Role
      const footer = document.getElementById('detailModalFooter');
      footer.innerHTML = `<button type="button" class="btn btn-secondary btn-sm" onclick="closeDetailModal()">Tutup</button>`;

      const isBendahara = currentUser && (currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');
      const isKepsek = currentUser && (currentUser.role === 'KEPALA_SEKOLAH' || currentUser.role === 'ADMIN');
      const isOwnerGuru = currentUser && (currentUser.id === p.user_id || currentUser.role === 'ADMIN');

      // Tombol Cetak Dokumen Resmi untuk status yang sudah disahkan / dicairkan
      if (p.status === 'DISETUJUI' || p.status === 'DICAIRKAN' || p.status === 'MENUNGGU_VERIFIKASI_LPJ' || p.status === 'SELESAI') {
        const btnPrint = document.createElement('a');
        btnPrint.className = 'btn btn-secondary btn-sm';
        btnPrint.href = `/cetak/${p.id}`;
        btnPrint.target = '_blank';
        btnPrint.innerHTML = '🖨️ Cetak Lembar Disposisi (PDF)';
        footer.appendChild(btnPrint);
      }

      if (isBendahara && (p.status === 'MENUNGGU_REVIEW' || p.status === 'PERLU_REVISI')) {
        const btnReview = document.createElement('button');
        btnReview.className = 'btn btn-primary btn-sm';
        btnReview.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
        btnReview.innerHTML = '✏️ Buka Modul Telaah & Koreksi';
        btnReview.onclick = () => {
          closeDetailModal();
          openReviewModal(p.id);
        };
        footer.appendChild(btnReview);
      } else if (isKepsek && p.status === 'MENUNGGU_PERSETUJUAN_KEPSEK') {
        const btnKepsek = document.createElement('button');
        btnKepsek.className = 'btn btn-primary btn-sm';
        btnKepsek.style.background = 'linear-gradient(135deg, #059669, #10b981)';
        btnKepsek.innerHTML = '🛡️ Berikan Otorisasi Pengesahan';
        btnKepsek.onclick = () => {
          closeDetailModal();
          openKepsekModal(p.id);
        };
        footer.appendChild(btnKepsek);
      } else if (isBendahara && p.status === 'DISETUJUI') {
        const btnCairkan = document.createElement('button');
        btnCairkan.className = 'btn btn-primary btn-sm';
        btnCairkan.style.background = 'linear-gradient(135deg, #059669, #10b981)';
        btnCairkan.innerHTML = '💵 Cairkan Kas Sekarang';
        btnCairkan.onclick = () => {
          closeDetailModal();
          openCairkanModal(p.id);
        };
        footer.appendChild(btnCairkan);
      } else if (isOwnerGuru && p.status === 'DICAIRKAN') {
        const btnLpj = document.createElement('button');
        btnLpj.className = 'btn btn-primary btn-sm';
        btnLpj.style.background = 'linear-gradient(135deg, #2563eb, #3b82f6)';
        btnLpj.innerHTML = '📋 Buat LPJ Realisasi';
        btnLpj.onclick = () => {
          closeDetailModal();
          openSubmitLpjModal(p.id);
        };
        footer.appendChild(btnLpj);
      } else if (isBendahara && p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
        const btnVerifLpj = document.createElement('button');
        btnVerifLpj.className = 'btn btn-primary btn-sm';
        btnVerifLpj.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
        btnVerifLpj.innerHTML = '🔍 Verifikasi LPJ Bendahara';
        btnVerifLpj.onclick = () => {
          closeDetailModal();
          openVerifikasiLpjModal(p.id);
        };
        footer.appendChild(btnVerifLpj);
      } else if (isOwnerGuru && p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
        const btnEditLpj = document.createElement('button');
        btnEditLpj.className = 'btn btn-secondary btn-sm';
        btnEditLpj.innerHTML = '✏️ Edit Berkas LPJ';
        btnEditLpj.onclick = () => {
          closeDetailModal();
          openSubmitLpjModal(p.id);
        };
        footer.appendChild(btnEditLpj);
      }
    }
  } catch (err) {
    console.error('Error fetching proposal detail:', err);
  }
}

async function loadAuditTimeline(proposalId) {
  const container = document.getElementById('detailAuditTimeline');
  try {
    const res = await fetch(`/api/pengajuan/${proposalId}/audit`);
    const data = await res.json();
    if (data.success && data.data && data.data.length > 0) {
      container.innerHTML = '';
      data.data.forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'audit-entry';
        entry.innerHTML = `
          <div class="audit-dot"></div>
          <div class="audit-time">${log.waktu_dibuat}</div>
          <div class="audit-text">
            <span class="audit-author">${log.user_nama || 'Sistem'}:</span>
            ${log.aktivitas}
          </div>
        `;
        container.appendChild(entry);
      });
    } else {
      container.innerHTML = '<div style="color:var(--text-subtle); font-size:0.78rem;">Belum ada catatan aktivitas.</div>';
    }
  } catch (err) {
    container.innerHTML = '<div style="color:var(--text-subtle); font-size:0.78rem;">-</div>';
  }
}

function closeDetailModal() {
  document.getElementById('modalDetailProposal').classList.remove('active');
}

// --- FASE 3: MODAL REVIEW BENDAHARA & 2-TIER AMBANG BATAS ---
let activeReviewProposal = null;

async function openReviewModal(id) {
  const modal = document.getElementById('modalReviewBendahara');
  modal.classList.add('active');

  const container = document.getElementById('reviewItemsListContainer');
  container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Memuat berkas usulan...</div>';

  try {
    const res = await fetch(`/api/pengajuan/${id}`);
    const data = await res.json();
    if (data.success && data.data) {
      activeReviewProposal = data.data;
      const p = activeReviewProposal;

      document.getElementById('reviewNomorSurat').textContent = p.nomor_surat_ajuan;
      document.getElementById('reviewNamaKegiatan').textContent = p.nama_kegiatan;
      document.getElementById('reviewSubHeader').textContent = `Diajukan oleh: ${p.pemohon_nama} • Pos: ${p.nama_pos}`;
      document.getElementById('reviewCatatanBendahara').value = p.catatan_bendahara || '';

      renderReviewItems(p.items);
      recalculateReviewTotal();
    }
  } catch (err) {
    container.innerHTML = '<div style="color:var(--rose);">Gagal memuat rincian usulan.</div>';
  }
}

function renderReviewItems(items) {
  const container = document.getElementById('reviewItemsListContainer');
  container.innerHTML = '';

  items.forEach((item, idx) => {
    const volDefault = item.volume_disetujui !== null ? item.volume_disetujui : item.volume_ajuan;
    const hargaDefault = item.harga_satuan_disetujui !== null ? item.harga_satuan_disetujui : item.harga_satuan_ajuan;

    const card = document.createElement('div');
    card.className = 'review-item-card';
    card.dataset.itemId = item.id;
    card.innerHTML = `
      <div class="review-item-original">
        <div>
          <span style="font-weight:700; color:var(--text-main);">#${idx + 1}. ${item.deskripsi_item}</span>
          <span class="badge-counter" style="font-size:0.65rem; margin-left:6px;">${item.kategori_belanja}</span>
        </div>
        <div>
          Usulan Awal: <strong>${item.volume_ajuan} ${item.satuan} × ${formatRupiah(item.harga_satuan_ajuan)}</strong> = 
          <strong style="color:var(--primary);">${formatRupiah(item.subtotal_ajuan)}</strong>
        </div>
      </div>

      <div class="review-inputs-grid">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.7rem;">Volume Disetujui</label>
          <input type="number" class="form-input review-vol" value="${volDefault}" min="0" step="1" oninput="recalculateReviewTotal()">
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.7rem;">Harga Satuan Disetujui (Rp)</label>
          <input type="number" class="form-input review-harga" value="${hargaDefault}" min="0" step="500" oninput="recalculateReviewTotal()">
        </div>

        <div class="form-group full-mobile" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.7rem;">Catatan Koreksi (Jika Diubah/Dipotong)</label>
          <input type="text" class="form-input review-note" placeholder="Cth: Disesuaikan standar rapat Rp 20.000" value="${item.catatan_koreksi || ''}">
        </div>
      </div>

      <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.72rem; color:var(--text-subtle);">Satuan: ${item.satuan}</span>
        <div>
          <span style="font-size:0.72rem; color:var(--text-muted); margin-right:4px;">Subtotal Disetujui:</span>
          <span class="review-subtotal-val" style="font-weight:700; color:var(--primary); font-family:'Outfit',sans-serif;">Rp 0</span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function recalculateReviewTotal() {
  const container = document.getElementById('reviewItemsListContainer');
  const cards = container.querySelectorAll('.review-item-card');
  let totalDisetujui = 0;

  cards.forEach(card => {
    const vol = Number(card.querySelector('.review-vol').value) || 0;
    const harga = Number(card.querySelector('.review-harga').value) || 0;
    const subtotal = vol * harga;
    totalDisetujui += subtotal;
    card.querySelector('.review-subtotal-val').textContent = formatRupiah(subtotal);
  });

  const banner = document.getElementById('reviewThresholdBanner');
  const bannerText = document.getElementById('reviewThresholdText');
  const btnSubmit = document.getElementById('btnSubmitReview');

  // 2-Tier Approval Threshold (Ambang Batas Rp 1.000.000)
  if (totalDisetujui >= 1000000) {
    banner.className = 'threshold-banner multi-tier';
    banner.querySelector('.threshold-icon').textContent = '🛡️';
    bannerText.innerHTML = `
      <strong>Otorisasi Bertingkat (Total: ${formatRupiah(totalDisetujui)} $\ge$ Rp 1.000.000):</strong>
      <br>Karena nominal anggaran berskala besar, proposal ini akan otomatis diteruskan ke portal <strong>Kepala Sekolah</strong> untuk otorisasi final.
    `;
    btnSubmit.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"></path>
      </svg>
      Teruskan ke Kepala Sekolah
    `;
  } else {
    banner.className = 'threshold-banner fast-track';
    banner.querySelector('.threshold-icon').textContent = '⚡';
    bannerText.innerHTML = `
      <strong>Jalur Cepat (Total: ${formatRupiah(totalDisetujui)} < Rp 1.000.000):</strong>
      <br>Nominal berada di bawah ambang batas Rp 1.000.000. Bendahara dapat <strong>menyetujui langsung</strong> tanpa perlu menunggu Kepala Sekolah.
    `;
    btnSubmit.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      Setujui Langsung (Bendahara)
    `;
  }
}

async function handleBendaharaAction(tindakan) {
  if (!activeReviewProposal) return;

  const catatan_bendahara = document.getElementById('reviewCatatanBendahara').value.trim();
  const cards = document.querySelectorAll('#reviewItemsListContainer .review-item-card');
  const items_koreksi = [];

  cards.forEach(card => {
    const id = Number(card.dataset.itemId);
    const volume_disetujui = Number(card.querySelector('.review-vol').value) || 0;
    const harga_satuan_disetujui = Number(card.querySelector('.review-harga').value) || 0;
    const catatan_koreksi = card.querySelector('.review-note').value.trim();
    items_koreksi.push({
      id,
      volume_disetujui,
      harga_satuan_disetujui,
      catatan_koreksi,
      status_item: (volume_disetujui <= 0 || harga_satuan_disetujui <= 0) ? 'DITOLAK' : 'DISESUAIKAN'
    });
  });

  try {
    const res = await fetch(`/api/pengajuan/${activeReviewProposal.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tindakan, // 'SETUJUI' atau 'REVISI'
        catatan_bendahara,
        items_koreksi
      })
    });

    const data = await res.json();
    if (data.success) {
      closeReviewModal();
      showNotification(`✨ ${data.message}`);
      await loadSummaryStats();
      await loadPosAnggaran();
      await loadProposalsList();
    } else {
      alert(data.message || 'Gagal memproses review bendahara.');
    }
  } catch (err) {
    console.error('Error submitting review:', err);
    alert('Terjadi kesalahan koneksi.');
  }
}

function closeReviewModal() {
  document.getElementById('modalReviewBendahara').classList.remove('active');
  activeReviewProposal = null;
}

// --- FASE 3: MODAL OTORISASI KEPALA SEKOLAH ---
let activeKepsekProposal = null;

async function openKepsekModal(id) {
  const modal = document.getElementById('modalApprovalKepsek');
  modal.classList.add('active');

  const container = document.getElementById('kepsekItemsPreviewList');
  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Memuat berkas telaah...</div>';

  try {
    const res = await fetch(`/api/pengajuan/${id}`);
    const data = await res.json();
    if (data.success && data.data) {
      activeKepsekProposal = data.data;
      const p = activeKepsekProposal;

      document.getElementById('kepsekNomorSurat').textContent = p.nomor_surat_ajuan;
      document.getElementById('kepsekNamaKegiatan').textContent = p.nama_kegiatan;
      document.getElementById('kepsekSubHeader').textContent = `Pemohon: ${p.pemohon_nama} (${p.pemohon_unit}) • Pos: ${p.nama_pos}`;
      document.getElementById('kepsekTotalDanaDisetujui').textContent = formatRupiah(p.total_dana_disetujui);
      document.getElementById('kepsekCatatan').value = '';

      container.innerHTML = '';
      p.items.forEach((item, idx) => {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = 'display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle);';
        itemRow.innerHTML = `
          <div>
            <span style="color:var(--text-main); font-weight:600;">#${idx+1}. ${item.deskripsi_item}</span>
            <span style="font-size:0.72rem; color:var(--text-muted); margin-left:6px;">(${item.volume_disetujui} ${item.satuan} × ${formatRupiah(item.harga_satuan_disetujui)})</span>
          </div>
          <span style="font-weight:700; color:var(--primary); font-family:'Outfit',sans-serif;">${formatRupiah(item.subtotal_disetujui)}</span>
        `;
        container.appendChild(itemRow);
      });
    }
  } catch (err) {
    container.innerHTML = '<div style="color:var(--rose);">Gagal memuat rincian usulan.</div>';
  }
}

async function handleKepsekAction(tindakan) {
  if (!activeKepsekProposal) return;

  const catatan_kepsek = document.getElementById('kepsekCatatan').value.trim();

  try {
    const res = await fetch(`/api/pengajuan/${activeKepsekProposal.id}/kepsek-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tindakan, // 'APPROVE' atau 'REVISI'
        catatan_kepsek
      })
    });

    const data = await res.json();
    if (data.success) {
      closeKepsekModal();
      showNotification(`🏛️ ${data.message}`);
      await loadSummaryStats();
      await loadPosAnggaran();
      await loadProposalsList();
    } else {
      alert(data.message || 'Gagal memproses otorisasi Kepala Sekolah.');
    }
  } catch (err) {
    console.error('Error submitting kepsek decision:', err);
    alert('Terjadi kesalahan koneksi.');
  }
}

function closeKepsekModal() {
  document.getElementById('modalApprovalKepsek').classList.remove('active');
  activeKepsekProposal = null;
}

// --- 6. Add / Edit Pos Anggaran Modal (From Phase 1) ---
function openAddPosModal() {
  document.getElementById('modalPosTitle').textContent = 'Tambah Pos Anggaran Baru';
  document.getElementById('formPosAnggaran').reset();
  document.getElementById('posIdInput').value = '';
  document.getElementById('modalPos').classList.add('active');
}

function openEditPosModal(id) {
  const item = currentPosList.find(p => p.id === id);
  if (!item) return;

  document.getElementById('modalPosTitle').textContent = 'Ubah Plafon Pos Anggaran';
  document.getElementById('posIdInput').value = item.id;
  document.getElementById('inputNamaPos').value = item.nama_pos;
  document.getElementById('inputTahunAjaran').value = item.tahun_ajaran;
  document.getElementById('inputPaguAwal').value = item.pagu_awal;
  document.getElementById('inputKeterangan').value = item.keterangan || '';

  document.getElementById('modalPos').classList.add('active');
}

function closePosModal() {
  document.getElementById('modalPos').classList.remove('active');
}

async function handleSavePosAnggaran(e) {
  e.preventDefault();
  const id = document.getElementById('posIdInput').value;
  const payload = {
    nama_pos: document.getElementById('inputNamaPos').value,
    tahun_ajaran: document.getElementById('inputTahunAjaran').value,
    pagu_awal: Number(document.getElementById('inputPaguAwal').value),
    keterangan: document.getElementById('inputKeterangan').value
  };

  try {
    let url = '/api/pos-anggaran';
    let method = 'POST';

    if (id) {
      url = `/api/pos-anggaran/${id}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closePosModal();
      showNotification(data.message || 'Pos anggaran berhasil disimpan!');
      loadSummaryStats();
      loadPosAnggaran();
    } else {
      alert(data.message || 'Gagal menyimpan');
    }
  } catch (err) {
    console.error('Error saving pos anggaran:', err);
  }
}

// Toast Notification
function showNotification(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #0f172a;
    border: 1px solid #334155;
    color: #ffffff;
    padding: 12px 22px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 600;
    z-index: 999;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: fadeInDown 0.3s ease;
  `;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
    <span>${msg}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ==========================================================================
// FASE 4: LOGIKA MODUL PENCAIRAN KAS (CASH DISBURSEMENT)
// ==========================================================================

let activeCairkanProposal = null;

async function openCairkanModal(proposalId) {
  const modal = document.getElementById('modalCairkanDana');
  modal.classList.add('active');

  try {
    const res = await fetch(`/api/pengajuan/${proposalId}`);
    const data = await res.json();
    if (data.success && data.data) {
      activeCairkanProposal = data.data;
      const p = activeCairkanProposal;

      document.getElementById('cairkanProposalId').value = p.id;
      document.getElementById('cairkanNomorSurat').textContent = p.nomor_surat_ajuan;
      document.getElementById('cairkanNamaKegiatan').textContent = p.nama_kegiatan;
      document.getElementById('cairkanSubHeader').textContent = `Pemohon: ${p.pemohon_nama} (${p.pemohon_unit}) • Pos: ${p.nama_pos}`;
      document.getElementById('cairkanTotalDanaDisplay').textContent = formatRupiah(p.total_dana_disetujui);

      // Default data penerima & tanggal
      document.getElementById('cairkanPenerimaDana').value = p.pemohon_nama;
      document.getElementById('cairkanTanggal').value = new Date().toISOString().split('T')[0];
      document.getElementById('cairkanCatatan').value = '';
      document.getElementById('cairkanNomorRef').value = '';
      document.getElementById('cairkanNomorRekening').value = '';

      // Reset ke mode Kas Tunai
      const radioTunai = document.querySelector('input[name="metode_pencairan"][value="TUNAI"]');
      if (radioTunai) radioTunai.checked = true;
      handlePaymentMethodChange();
    }
  } catch (err) {
    console.error('Error fetching proposal for disbursement:', err);
    showNotification('Gagal memuat data proposal untuk pencairan.');
  }
}

function closeCairkanModal() {
  document.getElementById('modalCairkanDana').classList.remove('active');
  activeCairkanProposal = null;
}

function handlePaymentMethodChange() {
  const selectedMetode = document.querySelector('input[name="metode_pencairan"]:checked')?.value || 'TUNAI';
  const sectionTransfer = document.getElementById('sectionTransferBank');
  const labelTunai = document.getElementById('labelMethodTunai');
  const labelTransfer = document.getElementById('labelMethodTransfer');

  if (selectedMetode === 'TRANSFER_BANK') {
    sectionTransfer.style.display = 'block';
    labelTransfer.classList.add('active');
    labelTunai.classList.remove('active');
  } else {
    sectionTransfer.style.display = 'none';
    labelTunai.classList.add('active');
    labelTransfer.classList.remove('active');
  }
}

async function handlePencairanSubmit(e) {
  e.preventDefault();
  if (!activeCairkanProposal) return;

  const id = activeCairkanProposal.id;
  const metode_pencairan = document.querySelector('input[name="metode_pencairan"]:checked')?.value || 'TUNAI';
  const bank_tujuan = document.getElementById('cairkanBankTujuan').value;
  const nomor_rekening = document.getElementById('cairkanNomorRekening').value.trim();
  const nomor_referensi_transfer = document.getElementById('cairkanNomorRef').value.trim();
  const penerima_dana = document.getElementById('cairkanPenerimaDana').value.trim();
  const tanggal_pencairan = document.getElementById('cairkanTanggal').value;
  const catatan_pencairan = document.getElementById('cairkanCatatan').value.trim();

  try {
    const res = await fetch(`/api/pengajuan/${id}/cairkan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metode_pencairan,
        bank_tujuan,
        nomor_rekening,
        nomor_referensi_transfer,
        penerima_dana,
        tanggal_pencairan,
        catatan_pencairan
      })
    });

    const data = await res.json();
    if (data.success) {
      closeCairkanModal();
      showNotification(`✓ ${data.message}`);
      loadSummaryStats();
      loadPosAnggaran();
      loadProposalsList();
    } else {
      alert(`Gagal mencairkan kas: ${data.message}`);
    }
  } catch (err) {
    alert(`Terjadi kesalahan jaringan saat mencairkan kas: ${err.message}`);
  }
}

// ==========================================================================
// FASE 5: MODUL LPJ (LAPORAN PERTANGGUNGJAWABAN) & REKONSILIASI KAS
// ==========================================================================

let activeLpjProposal = null;
let selectedLpjFile = null;

async function openSubmitLpjModal(proposalId) {
  const modal = document.getElementById('modalSubmitLpj');
  modal.classList.add('active');

  try {
    const res = await fetch(`/api/pengajuan/${proposalId}`);
    const data = await res.json();
    if (data.success && data.data) {
      activeLpjProposal = data.data;
      const p = activeLpjProposal;

      document.getElementById('lpjProposalId').value = p.id;
      document.getElementById('lpjNomorSurat').textContent = p.nomor_surat_ajuan;
      document.getElementById('lpjNamaKegiatan').textContent = p.nama_kegiatan;
      document.getElementById('lpjSubHeader').textContent = `Pemohon: ${p.pemohon_nama} (${p.pemohon_unit}) • Pos: ${p.nama_pos}`;
      document.getElementById('lpjTotalDanaCairDisplay').textContent = formatRupiah(p.total_dana_disetujui);

      // Pre-fill jika sudah pernah dibuat sebelumnya
      if (p.lpj) {
        document.getElementById('lpjTotalBelanjaRiil').value = p.lpj.total_belanja_riil;
        document.getElementById('lpjCatatan').value = p.lpj.catatan_lpj || '';
        if (p.lpj.file_nota_url) {
          document.getElementById('lpjFilePreviewWrap').style.display = 'flex';
          document.getElementById('lpjFileName').textContent = p.lpj.file_nota_url.split('/').pop();
        }
      } else {
        document.getElementById('lpjTotalBelanjaRiil').value = p.total_dana_disetujui;
        document.getElementById('lpjCatatan').value = '';
        clearLpjFile();
      }

      recalculateLpjCashback();
    }
  } catch (err) {
    console.error('Error fetching proposal for LPJ:', err);
    showNotification('Gagal memuat data proposal.');
  }
}

function closeSubmitLpjModal() {
  document.getElementById('modalSubmitLpj').classList.remove('active');
  activeLpjProposal = null;
  selectedLpjFile = null;
}

function recalculateLpjCashback() {
  if (!activeLpjProposal) return;

  const danaCair = activeLpjProposal.total_dana_disetujui || 0;
  const belanjaRiil = Number(document.getElementById('lpjTotalBelanjaRiil').value) || 0;
  const selisih = danaCair - belanjaRiil;

  const box = document.getElementById('lpjCashbackCalcBox');
  const title = document.getElementById('lpjCashbackCalcTitle');
  const val = document.getElementById('lpjCashbackCalcVal');
  const desc = document.getElementById('lpjCashbackCalcDesc');

  box.className = 'lpj-calc-box';

  if (selisih > 0) {
    box.classList.add('refund');
    title.textContent = '💵 Sisa Kas yang Wajib Disetor Kembali ke Sekolah';
    val.textContent = formatRupiah(selisih);
    desc.textContent = `Terdapat kelebihan kas sebesar ${formatRupiah(selisih)}. Dana ini wajib disetor tunai/transfer ke Bendahara dan akan otomatis mengembalikan kuota pagu pos anggaran.`;
  } else if (selisih === 0) {
    box.classList.add('exact');
    title.textContent = '✓ Realisasi Kas Pas 100%';
    val.textContent = 'Rp 0';
    desc.textContent = 'Total belanja riil sesuai persis dengan nominal pencairan dana. Tidak ada sisa kas pengembalian.';
  } else {
    box.classList.add('over');
    title.textContent = '⚠️ Realisasi Melebihi Dana Kas Cair (Talangan Mandiri)';
    val.textContent = formatRupiah(Math.abs(selisih));
    desc.textContent = `Belanja riil melebihi dana kas yang dicairkan sebesar ${formatRupiah(Math.abs(selisih))}. Kelebihan ini merupakan talangan mandiri sesuai ketentuan sekolah.`;
  }
}

function handleLpjFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    selectedLpjFile = file;
    document.getElementById('lpjFilePreviewWrap').style.display = 'flex';
    document.getElementById('lpjFileName').textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }
}

function clearLpjFile(event) {
  if (event) event.stopPropagation();
  selectedLpjFile = null;
  const input = document.getElementById('lpjFileInput');
  if (input) input.value = '';
  const preview = document.getElementById('lpjFilePreviewWrap');
  if (preview) preview.style.display = 'none';
}

async function handleSubmitLpj(e) {
  e.preventDefault();
  if (!activeLpjProposal) return;

  const id = activeLpjProposal.id;
  const belanjaRiil = document.getElementById('lpjTotalBelanjaRiil').value;
  const catatan = document.getElementById('lpjCatatan').value.trim();

  const formData = new FormData();
  formData.append('total_belanja_riil', belanjaRiil);
  formData.append('catatan_lpj', catatan);
  if (selectedLpjFile) {
    formData.append('file_nota', selectedLpjFile);
  }

  const btn = document.getElementById('btnSubmitLpj');
  btn.disabled = true;
  btn.textContent = 'Mengunggah & Menyerahkan...';

  try {
    const res = await fetch(`/api/pengajuan/${id}/lpj`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      closeSubmitLpjModal();
      showNotification(`✓ ${data.message}`);
      loadSummaryStats();
      loadPosAnggaran();
      loadProposalsList();
    } else {
      alert(`Gagal mengirimkan LPJ: ${data.message}`);
    }
  } catch (err) {
    alert(`Terjadi kesalahan jaringan: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '📋 Serahkan Berkas LPJ ke Bendahara';
  }
}

// Bendahara LPJ Verification Modal
let activeVerifLpjProposal = null;

async function openVerifikasiLpjModal(proposalId) {
  const modal = document.getElementById('modalVerifikasiLpj');
  modal.classList.add('active');

  try {
    const res = await fetch(`/api/pengajuan/${proposalId}`);
    const data = await res.json();
    if (data.success && data.data) {
      activeVerifLpjProposal = data.data;
      const p = activeVerifLpjProposal;
      const lpj = p.lpj;

      document.getElementById('verifLpjNomorSurat').textContent = p.nomor_surat_ajuan;
      document.getElementById('verifLpjNamaKegiatan').textContent = p.nama_kegiatan;
      document.getElementById('verifLpjSubHeader').textContent = `Pemohon: ${p.pemohon_nama} (${p.pemohon_unit}) • Pos: ${p.nama_pos}`;

      document.getElementById('verifLpjDanaCair').textContent = formatRupiah(lpj ? lpj.total_dana_cair : p.total_dana_disetujui);
      document.getElementById('verifLpjBelanjaRiil').textContent = formatRupiah(lpj ? lpj.total_belanja_riil : 0);
      document.getElementById('verifLpjSisaUang').textContent = formatRupiah(lpj ? lpj.sisa_pengembalian_dana : 0);
      document.getElementById('verifLpjCatatanGuru').textContent = (lpj && lpj.catatan_lpj) ? lpj.catatan_lpj : '-';
      document.getElementById('verifLpjCatatanBendahara').value = '';

      const fileBox = document.getElementById('verifLpjFilePreviewBox');
      if (lpj && lpj.file_nota_url) {
        fileBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">📄</span>
            <div>
              <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">Berkas Nota / Bukti Kuitansi</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">${lpj.file_nota_url.split('/').pop()}</div>
            </div>
          </div>
          <a href="${lpj.file_nota_url}" target="_blank" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
            👁️ Buka / Unduh Berkas
          </a>
        `;
      } else {
        fileBox.innerHTML = `
          <span style="color: var(--text-muted); font-size: 0.82rem;">Tidak ada berkas digital terlampir (Hanya nota fisik fisik diserahkan).</span>
        `;
      }
    }
  } catch (err) {
    console.error('Error fetching proposal for LPJ verification:', err);
    showNotification('Gagal memuat data verifikasi LPJ.');
  }
}

function closeVerifikasiLpjModal() {
  document.getElementById('modalVerifikasiLpj').classList.remove('active');
  activeVerifLpjProposal = null;
}

async function handleBendaharaLpjAction(tindakan) {
  if (!activeVerifLpjProposal) return;

  const id = activeVerifLpjProposal.id;
  const catatan_verifikasi = document.getElementById('verifLpjCatatanBendahara').value.trim();

  if (tindakan === 'REVISI' && !catatan_verifikasi) {
    alert('Harap isi catatan pemeriksaan alasan pengembalian/perbaikan LPJ.');
    return;
  }

  try {
    const res = await fetch(`/api/pengajuan/${id}/lpj/verifikasi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tindakan, catatan_verifikasi })
    });
    const data = await res.json();
    if (data.success) {
      closeVerifikasiLpjModal();
      showNotification(`✓ ${data.message}`);
      loadSummaryStats();
      loadPosAnggaran();
      loadProposalsList();
    } else {
      alert(`Gagal memverifikasi LPJ: ${data.message}`);
    }
  } catch (err) {
    alert(`Terjadi kesalahan jaringan: ${err.message}`);
  }
}
