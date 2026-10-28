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
  loadActiveUser();
  loadSummaryStats();
  loadPosAnggaran();
  setupEventListeners();

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

// --- 2. User & Role Management ---
async function loadActiveUser() {
  try {
    const res = await fetch('/api/auth/active-user');
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      renderUserHeader(currentUser);
    }
  } catch (err) {
    console.error('Error fetching active user:', err);
  }
}

function renderUserHeader(user) {
  document.getElementById('userNameDisplay').textContent = user.nama_lengkap;
  document.getElementById('userRoleDisplay').textContent = user.role.replace('_', ' ');
  document.getElementById('userAvatarInitial').textContent = user.nama_lengkap.charAt(0);
}

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
      if (activeViewName === 'riwayat') {
        loadProposalsList();
      }
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
    const data = await res.json();
    if (data.success && data.data) {
      currentProposals = data.data;
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
    container.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-subtle); margin-bottom: 12px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main);">Belum Ada Proposal Diajukan</div>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin: 6px 0 16px;">
          Mulai buat proposal usulan kegiatan sekolah pertama Anda sekarang.
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
    if (p.status === 'DICAIRKAN') statusLabel = 'Dana Telah Dicairkan';
    if (p.status === 'SELESAI') statusLabel = 'Selesai & LPJ Terverifikasi';

    // Role-based quick action button on card
    let roleActionBtn = '';
    const isBendahara = currentUser && (currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');
    const isKepsek = currentUser && (currentUser.role === 'KEPALA_SEKOLAH' || currentUser.role === 'ADMIN');

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
        <div style="display: flex; align-items: center; gap: 12px;">
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-right: 4px;">Nominal:</span>
            <span class="proposal-cost-val">${formatRupiah(p.total_dana_disetujui || p.total_dana_diajukan)}</span>
          </div>
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
