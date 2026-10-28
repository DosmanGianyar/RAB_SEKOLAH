// ==========================================================================
// E-RAB SEKOLAH - CLIENT LOGIC & MOBILE-FIRST INTERACTION
// ==========================================================================

let currentUser = null;
let currentPosList = [];

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

  // Close modals on overlay click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
}

// --- 1. User & Role Management ---
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
          <span style="font-weight: 700; font-size: 0.9rem; color: #fff;">${u.nama_lengkap}</span>
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
      showNotification(`Beralih ke peran: ${currentUser.nama_lengkap}`);
    }
  } catch (err) {
    console.error('Error switching user:', err);
  }
}

// --- 2. Financial Summary Stats ---
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

// --- 3. Pos Anggaran Cards (Mobile-First) ---
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

// --- 4. Add / Edit Pos Anggaran Modal ---
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
    background: rgba(17, 24, 39, 0.95);
    border: 1px solid var(--primary);
    color: #fff;
    padding: 10px 20px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 600;
    z-index: 999;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
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
  }, 2500);
}
