// ==========================================================================
// E-RAB SEKOLAH - CLIENT LOGIC & MOBILE-FIRST INTERACTION
// FASE 1 & FASE 2: Plafon Anggaran, Dynamic Line Items, & Proposal Submission
// ==========================================================================

let currentUser = null;
let currentPosList = [];
let currentProposals = [];
let activeViewName = 'home';
let homeSnpChart = null;
let homeSerapanChart = null;
let latestSummaryData = null;
let currentProposalFilterTab = 'ALL';
let selectedSnpFilter = 'ALL';
let searchKeyword = '';
let selectedTrafficFilter = 'ALL';
let collapsedGroups = new Set();

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Format Rupiah Helper (Menggunakan Non-Breaking Space \u00A0 agar 'Rp' dan nominal tidak pernah terpisah baris)
function formatRupiah(val) {
  const num = Number(val) || 0;
  return 'Rp\u00A0' + num.toLocaleString('id-ID');
}

// Auto-Format Input Nominal dengan Pemisah Titik Tiap 3 Angka
function formatCurrencyInput(input) {
  if (!input) return;
  const cursorPos = input.selectionStart || 0;
  const originalLength = input.value.length;
  const rawValue = input.value.replace(/\D/g, '');

  if (!rawValue) {
    input.value = '';
    return;
  }

  // Format angka ribuan dengan titik (Standar Indonesia)
  const formatted = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  input.value = formatted;

  // Pertahankan posisi kursor pengguna agar nyaman saat mengetik/menghapus
  const newLength = formatted.length;
  const newPos = Math.max(0, cursorPos + (newLength - originalLength));
  if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(newPos, newPos);
  }
}

// Helper untuk membaca nilai numerik murni dari input yang berformat titik
function parseRupiahInput(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  return Number(String(val).replace(/\D/g, '')) || 0;
}

// Otorisasi Penghapusan Khusus: Hanya Analisis SDM, Kepala Sekolah, dan Administrator
function canUserDelete() {
  return currentUser && ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(currentUser.role);
}

// Otorisasi Pengelolaan Pagu RKAS: Hanya Analisis SDM, Kepala Sekolah, dan Administrator
function canUserManagePagu() {
  return currentUser && ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(currentUser.role);
}

// SweetAlert2 Toast Notifikasi Pojok
function getSwalToast() {
  if (typeof Swal === 'undefined') return null;
  return Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
}

// Dialog Konfirmasi Keamanan Tingkat Tinggi dengan Centang Wajib (Mandatory Checkbox)
async function confirmDeleteWithSecurityCheckbox({ title, itemName, itemType, warningNotes, checkboxLabel }) {
  if (typeof Swal === 'undefined') {
    return { isConfirmed: confirm(`PERINGATAN:\n\nApakah Anda yakin ingin menghapus ${itemType}: "${itemName}"?\n${warningNotes}`) };
  }

  const checkboxId = 'swalSecurityCheckbox_' + Math.floor(Math.random() * 10000);
  const htmlContent = `
    <div style="text-align: left; font-size: 0.88rem; color: #334155; line-height: 1.5;">
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
        <div style="font-weight: 800; color: #991b1b; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          PERINGATAN OTORISASI KHUSUS
        </div>
        <div style="font-size: 0.8rem; color: #7f1d1d; line-height: 1.45;">
          ${warningNotes}
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px;">
        <span style="color: #64748b; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${itemType}:</span>
        <div style="font-weight: 800; color: #0f172a; font-size: 0.95rem; margin-top: 3px;">
          ${escapeHtml(itemName)}
        </div>
      </div>

      <!-- Kotak Centang Pengaman Wajib -->
      <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; user-select: none; transition: border-color 0.2s;" id="wrap_${checkboxId}">
        <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; margin-bottom: 0;">
          <input type="checkbox" id="${checkboxId}" style="width: 19px; height: 19px; margin-top: 2px; accent-color: #dc2626; cursor: pointer;">
          <span style="font-size: 0.82rem; font-weight: 700; color: #0f172a; line-height: 1.4;">
            ${checkboxLabel || 'Saya memahami konsekuensi penghapusan ini dan menyatakan data ini benar-benar akan dihapus permanen dari sistem.'}
          </span>
        </label>
      </div>
    </div>
  `;

  return await Swal.fire({
    title: `<span style="font-weight: 800; font-size: 1.18rem; color: #0f172a;">${title}</span>`,
    html: htmlContent,
    icon: 'warning',
    iconColor: '#dc2626',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="ti ti-trash"></i> Ya, Hapus Sekarang',
    cancelButtonText: 'Batal',
    focusCancel: true,
    buttonsStyling: true,
    didOpen: () => {
      const confirmBtn = Swal.getConfirmButton();
      const checkbox = document.getElementById(checkboxId);
      const wrap = document.getElementById('wrap_' + checkboxId);
      
      // Awalnya tombol konfirmasi DISABLED (terkunci)
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.4';
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.style.filter = 'grayscale(80%)';

      // Ketika pengguna mencentang, tombol konfirmasi AKTIF
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
          confirmBtn.style.filter = 'none';
          if (wrap) wrap.style.borderColor = '#dc2626';
        } else {
          confirmBtn.disabled = true;
          confirmBtn.style.opacity = '0.4';
          confirmBtn.style.cursor = 'not-allowed';
          confirmBtn.style.filter = 'grayscale(80%)';
          if (wrap) wrap.style.borderColor = '#cbd5e1';
        }
      });
    }
  });
}

// Handler Hapus Usulan Pengajuan Kegiatan (Hanya Otoritas Khusus)
async function handleDeleteProposal(id, nama) {
  if (!canUserDelete()) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya akun Analisis SDM, Kepala Sekolah, dan Administrator yang memiliki hak otorisasi untuk menghapus usulan kegiatan.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Akses Ditolak: Hanya akun Analisis SDM, Kepala Sekolah, dan Administrator yang memiliki hak otorisasi untuk menghapus usulan kegiatan.');
    }
    return;
  }

  const namaDisplay = nama || 'usulan ini';
  const confirmation = await confirmDeleteWithSecurityCheckbox({
    title: 'Konfirmasi Hapus Usulan Kegiatan',
    itemType: 'Nama Usulan Kegiatan',
    itemName: namaDisplay,
    warningNotes: 'Seluruh rincian belanja, riwayat telaah pengesahan, dan berkas nota LPJ akan dihapus permanen. Alokasi pagu anggaran yang sebelumnya tercadangkan atau terserap akan dipulihkan otomatis ke kas sekolah.',
    checkboxLabel: 'Saya memahami risiko ini dan menyatakan usulan kegiatan ini benar-benar akan dihapus secara permanen.'
  });

  if (!confirmation || !confirmation.isConfirmed) return;

  // Tampilkan loading saat proses penghapusan
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Menghapus Usulan...',
      text: 'Memulihkan pagu anggaran & membersihkan berkas terkait',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
  }

  try {
    const res = await fetch(`/api/pengajuan/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      closeDetailModal();
      await loadProposals();
      await loadPosAnggaran();
      await loadSummary();

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil Dihapus',
          text: result.message,
          confirmButtonColor: '#059669',
          timer: 3000
        });
      } else {
        alert(`✅ ${result.message}`);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menghapus',
          text: result.message,
          confirmButtonColor: '#059669'
        });
      } else {
        alert(`❌ Gagal menghapus usulan: ${result.message}`);
      }
    }
  } catch (err) {
    console.error('Error saat menghapus proposal:', err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Sistem',
        text: 'Terjadi kesalahan jaringan atau server saat menghapus usulan.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Terjadi kesalahan jaringan atau server saat menghapus usulan.');
    }
  }
}

// Handler Hapus Pos Anggaran RKAS (Hanya Otoritas Khusus)
async function handleDeletePosAnggaran(id, nama) {
  if (!canUserDelete()) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya akun Analisis SDM, Kepala Sekolah, dan Administrator yang berhak menghapus pos anggaran.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Akses Ditolak: Hanya akun Analisis SDM, Kepala Sekolah, dan Administrator yang berhak menghapus pos anggaran.');
    }
    return;
  }

  const namaDisplay = nama || 'pos anggaran ini';
  const confirmation = await confirmDeleteWithSecurityCheckbox({
    title: 'Konfirmasi Hapus Pos Anggaran',
    itemType: 'Nama Pos RKAS',
    itemName: namaDisplay,
    warningNotes: 'Menghapus pos anggaran akan menghilangkannya dari buku besar RKAS sekolah. Pos ini hanya dapat dihapus jika tidak ada usulan kegiatan aktif yang sedang berjalan di dalamnya.',
    checkboxLabel: 'Saya telah memeriksa dan menyetujui penghapusan pos anggaran ini secara permanen dari buku besar RKAS.'
  });

  if (!confirmation || !confirmation.isConfirmed) return;

  // Tampilkan loading saat proses penghapusan
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Menghapus Pos Anggaran...',
      text: 'Memverifikasi relasi kegiatan & memperbarui buku besar',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
  }

  try {
    const res = await fetch(`/api/pos-anggaran/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      closePosModal();
      await loadPosAnggaran();
      await loadSummary();

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil Dihapus',
          text: result.message,
          confirmButtonColor: '#059669',
          timer: 3000
        });
      } else {
        alert(`✅ ${result.message}`);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Tidak Dapat Dihapus',
          text: result.message,
          confirmButtonColor: '#059669'
        });
      } else {
        alert(`❌ Gagal menghapus pos anggaran: ${result.message}`);
      }
    }
  } catch (err) {
    console.error('Error saat menghapus pos anggaran:', err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Sistem',
        text: 'Terjadi kesalahan jaringan atau server saat menghapus pos anggaran.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Terjadi kesalahan jaringan atau server saat menghapus pos anggaran.');
    }
  }
}

window.canUserDelete = canUserDelete;
window.canUserManagePagu = canUserManagePagu;
window.handleDeleteProposal = handleDeleteProposal;
window.handleDeletePosAnggaran = handleDeletePosAnggaran;
window.confirmDeleteWithSecurityCheckbox = confirmDeleteWithSecurityCheckbox;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  enableDragToScroll();
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

/**
 * Memungkinkan pengguna menggeser tabel horizontal secara bebas dengan klik & drag mouse atau sentuhan jari dari mana saja
 */
function enableDragToScroll() {
  const containers = document.querySelectorAll('.table-responsive, .draggable-table-container');
  containers.forEach(slider => {
    if (slider._hasDragScrollAttached) return;
    slider._hasDragScrollAttached = true;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    slider.addEventListener('mousedown', (e) => {
      // Jangan menginterupsi klik tombol aksi, link, input, atau select
      if (e.target.closest('button, a, input, select, textarea, .btn, .dropdown, [onclick]')) return;
      isDown = true;
      slider.classList.add('is-dragging');
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
      isDown = false;
      slider.classList.remove('is-dragging');
    });

    slider.addEventListener('mouseup', () => {
      isDown = false;
      slider.classList.remove('is-dragging');
    });

    slider.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.6; // multiplier kecepatan geser mulus
      slider.scrollLeft = scrollLeft - walk;
    });
  });
}
window.enableDragToScroll = enableDragToScroll;

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

  // Form Submit LPJ (Fase 5: Halaman Editor & Modal Fallback)
  const formEditorLpj = document.getElementById('formEditorLpj');
  if (formEditorLpj) {
    formEditorLpj.addEventListener('submit', submitLpjFromEditor);
  }
  const formLpj = document.getElementById('formSubmitLpj');
  if (formLpj) {
    formLpj.addEventListener('submit', (e) => {
      e.preventDefault();
      submitLpjFromEditor(e);
    });
  }

  // Close modals on overlay click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
}

// --- Sub-Tab Switcher Pengajuan RAB (Form Baru vs Riwayat Proposal) ---
function switchRabSubTab(tabName) {
  const btnForm = document.getElementById('btnSubnavFormRab');
  const btnRiwayat = document.getElementById('btnSubnavRiwayatRab');
  const paneForm = document.getElementById('subTabRabForm');
  const paneRiwayat = document.getElementById('subTabRabRiwayat');

  if (tabName === 'riwayat') {
    if (btnForm) btnForm.classList.remove('active');
    if (btnRiwayat) btnRiwayat.classList.add('active');
    if (paneForm) paneForm.style.display = 'none';
    if (paneRiwayat) paneRiwayat.style.display = 'block';
    loadProposalsList();
  } else {
    if (btnForm) btnForm.classList.add('active');
    if (btnRiwayat) btnRiwayat.classList.remove('active');
    if (paneForm) paneForm.style.display = 'block';
    if (paneRiwayat) paneRiwayat.style.display = 'none';
    populatePosDropdown();
    calculateGrandTotal();
  }
}
window.switchRabSubTab = switchRabSubTab;

// --- 1. View Switching Logic (Mobile & Desktop) ---
function switchView(viewName) {
  activeViewName = viewName;

  // Sembunyikan semua tampilan
  document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));

  // Update status tab desktop
  document.querySelectorAll('.desktop-tab-btn').forEach(btn => btn.classList.remove('active'));
  // Update status navbar mobile
  document.querySelectorAll('.mobile-nav-bar .nav-item').forEach(btn => btn.classList.remove('active'));

  if (viewName === 'home') {
    const vHome = document.getElementById('viewHome');
    if (vHome) vHome.classList.add('active');
    loadSummaryStats();
    if (!currentPosList || currentPosList.length === 0) {
      loadPosAnggaran();
    } else {
      initOrUpdateHomeCharts();
    }
    updateHomeGreeting();
  } else if (viewName === 'dashboard') {
    const vDash = document.getElementById('viewDashboard');
    if (vDash) vDash.classList.add('active');
    const tabDesk = document.getElementById('tabDeskDashboard');
    if (tabDesk) tabDesk.classList.add('active');
    const navH = document.getElementById('navHome');
    if (navH) navH.classList.add('active');
    loadSummaryStats();
    loadPosAnggaran();
  } else if (viewName === 'ajukan') {
    const vAjukan = document.getElementById('viewAjukan');
    if (vAjukan) vAjukan.classList.add('active');
    const tabDesk = document.getElementById('tabDeskAjukan');
    if (tabDesk) tabDesk.classList.add('active');
    const navAjukan = document.getElementById('navAjukan');
    if (navAjukan) navAjukan.classList.add('active');
    // Default tampilkan form
    switchRabSubTab('form');
  } else if (viewName === 'riwayat') {
    const vAjukan = document.getElementById('viewAjukan');
    if (vAjukan) vAjukan.classList.add('active');
    const tabDesk = document.getElementById('tabDeskAjukan');
    if (tabDesk) tabDesk.classList.add('active');
    const navAjukan = document.getElementById('navAjukan');
    if (navAjukan) navAjukan.classList.add('active');
    // Beralih ke sub-tab riwayat usulan & fokuskan pada antrean telaah
    switchRabSubTab('riwayat');
    filterProposalTab('MENUNGGU_REVIEW');
  } else if (viewName === 'verifikasi') {
    const vAjukan = document.getElementById('viewAjukan');
    if (vAjukan) vAjukan.classList.add('active');
    const tabVerif = document.getElementById('tabDeskVerifikasi');
    if (tabVerif) tabVerif.classList.add('active');
    const navVerif = document.getElementById('navVerifikasi');
    if (navVerif) navVerif.classList.add('active');
    // Beralih ke sub-tab riwayat usulan & fokuskan pada antrean telaah
    switchRabSubTab('riwayat');
    filterProposalTab('MENUNGGU_REVIEW');
  } else if (viewName === 'laporan') {
    const vLap = document.getElementById('viewLaporan');
    if (vLap) vLap.classList.add('active');
    const tabDesk = document.getElementById('tabDeskLaporan');
    if (tabDesk) tabDesk.classList.add('active');
    const navLaporan = document.getElementById('navLaporan');
    if (navLaporan) navLaporan.classList.add('active');
    loadProposalsList().then(() => renderLpjView());
  } else if (viewName === 'formLpj') {
    const viewLpj = document.getElementById('viewFormLpj');
    if (viewLpj) viewLpj.classList.add('active');
  } else if (viewName === 'auditlog') {
    if (!currentUser || !['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(currentUser.role)) {
      showToast('Akses Ditolak: Halaman log audit hanya dapat diakses oleh Analisis SDM, Kepala Sekolah, dan Administrator.', 'warning');
      switchView('dashboard');
      return;
    }
    const vAudit = document.getElementById('viewAuditLog');
    if (vAudit) vAudit.classList.add('active');
    loadAuditLogsList();
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
  switchView('home');
  loadSummaryStats();
  loadPosAnggaran();
  if (activeViewName === 'riwayat') {
    loadProposalsList();
  }
}

function updateRolePermissionsUI(user) {
  const canManagePagu = user && ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(user.role);
  const btnAddPos = document.getElementById('btnAddPos');
  if (btnAddPos) {
    btnAddPos.style.display = canManagePagu ? 'inline-flex' : 'none';
  }
  const btnSyncRkas = document.getElementById('btnSyncRkas');
  if (btnSyncRkas) {
    btnSyncRkas.style.display = canManagePagu ? 'inline-flex' : 'none';
  }

  // Hak Akses Manajemen Akun Guru & Kontrol Sandi (Khusus Analisis SDM & Kepsek & Admin)
  const canManageGuru = user && ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(user.role);
  const pillCountAkunGuru = document.getElementById('pillCountAkunGuru');
  if (pillCountAkunGuru) {
    pillCountAkunGuru.style.display = canManageGuru ? 'inline-flex' : 'none';
  }
  const containerActionsSdm = document.getElementById('containerActionsSdm');
  if (containerActionsSdm) {
    containerActionsSdm.style.display = canManageGuru ? 'flex' : 'none';
  }
  const btnTambahAkunGuru = document.getElementById('btnTambahAkunGuru');
  if (btnTambahAkunGuru) {
    btnTambahAkunGuru.style.display = canManageGuru ? 'inline-flex' : 'none';
  }
  const btnKelolaAkunGuru = document.getElementById('btnKelolaAkunGuru');
  if (btnKelolaAkunGuru) {
    btnKelolaAkunGuru.style.display = canManageGuru ? 'inline-flex' : 'none';
  }

  // Hak Akses Log Aktivitas & Audit Pengawasan (Khusus Analisis SDM & Kepsek & Admin)
  const canViewAudit = user && ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(user.role);
  const btnDashboardAudit = document.getElementById('btnDashboardAuditLog');
  if (btnDashboardAudit) {
    btnDashboardAudit.style.display = canViewAudit ? 'inline-flex' : 'none';
  }
  const btnHeroAudit = document.getElementById('btnHeroAuditLog');
  if (btnHeroAudit) {
    btnHeroAudit.style.display = canViewAudit ? 'inline-flex' : 'none';
  }

  if (canManageGuru) {
    loadGuruStats();
  }
}

// --- Manajemen Akun Guru, Reset Kata Sandi, & Ganti Sandi Mandiri ---

async function loadGuruStats() {
  try {
    const res = await fetch('/api/users/stats');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.stats) {
      const elText = document.getElementById('textCountAkunGuru');
      if (elText) elText.textContent = `${data.stats.totalGuru} Terdaftar`;
      const elModalTotal = document.getElementById('modalTotalGuruText');
      if (elModalTotal) elModalTotal.textContent = `${data.stats.totalGuru} Guru Terdaftar`;
    }
  } catch (err) {
    console.error('Error loading guru stats:', err);
  }
}

function openModalTambahGuru() {
  const form = document.getElementById('formTambahGuru');
  if (form) form.reset();
  const inputPass = document.getElementById('inputGuruPassword');
  if (inputPass) inputPass.value = 'Dosman2026';
  const modal = document.getElementById('modalTambahGuru');
  if (modal) modal.classList.add('active');
}
window.openModalTambahGuru = openModalTambahGuru;

function closeModalTambahGuru() {
  const modal = document.getElementById('modalTambahGuru');
  if (modal) modal.classList.remove('active');
}
window.closeModalTambahGuru = closeModalTambahGuru;

function isiPasswordDefaultGuru() {
  const inputPass = document.getElementById('inputGuruPassword');
  if (inputPass) inputPass.value = 'Dosman2026';
}
window.isiPasswordDefaultGuru = isiPasswordDefaultGuru;

async function handleSimpanGuruBaru(e) {
  if (e) e.preventDefault();
  const nama = document.getElementById('inputGuruNama').value.trim();
  const nip = document.getElementById('inputGuruNip').value.trim();
  const unit = document.getElementById('inputGuruUnit').value.trim();
  const email = document.getElementById('inputGuruEmail').value.trim();
  const password = document.getElementById('inputGuruPassword').value.trim() || 'Dosman2026';

  const btnSubmit = document.getElementById('btnSubmitGuru');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="ti ti-loader spin-icon"></i> Menyimpan...';
  }

  try {
    const res = await fetch('/api/users/guru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama_lengkap: nama,
        nip,
        unit_bagian: unit,
        email,
        password
      })
    });
    const data = await res.json();
    if (data.success) {
      closeModalTambahGuru();
      loadGuruStats();

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Akun Guru Berhasil Didaftarkan!',
          html: `
            <div style="text-align: left; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1.5px solid #e2e8f0; font-size: 0.85rem; line-height: 1.6;">
              <div style="margin-bottom: 5px;"><strong>Nama Lengkap:</strong> ${escapeHtml(data.user.nama_lengkap)}</div>
              <div style="margin-bottom: 5px;"><strong>Unit / Mapel:</strong> ${escapeHtml(data.user.unit_bagian)}</div>
              ${data.user.nip ? `<div style="margin-bottom: 5px;"><strong>NIP:</strong> ${escapeHtml(data.user.nip)}</div>` : ''}
              <div style="margin-bottom: 5px;"><strong>Email (Username Login):</strong> <code style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px;">${escapeHtml(data.user.email)}</code></div>
              <div><strong>Kata Sandi Login:</strong> <code style="background:#ecfdf5; color:#047857; padding:2px 6px; border-radius:4px; font-weight:bold;">${escapeHtml(password)}</code></div>
            </div>
            <p style="font-size: 0.78rem; color: #64748b; margin-top: 10px;">
              Akun telah aktif. Bagikan email dan kata sandi di atas kepada guru bersangkutan. Guru dapat mengubah kata sandi mereka secara mandiri setelah login.
            </p>
          `,
          confirmButtonText: 'Selesai &amp; Salin Informasi',
          confirmButtonColor: '#059669'
        });
      } else {
        alert(data.message);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'error', title: 'Gagal Mendaftarkan Akun', text: data.message });
      } else {
        alert(data.message);
      }
    }
  } catch (err) {
    console.error('Error create guru:', err);
    alert('Terjadi kesalahan koneksi saat mendaftarkan akun guru.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="ti ti-check"></i> Simpan &amp; Aktifkan Akun';
    }
  }
}
window.handleSimpanGuruBaru = handleSimpanGuruBaru;

function openModalDaftarGuru() {
  const modal = document.getElementById('modalKelolaGuru');
  if (modal) modal.classList.add('active');
  loadDaftarGuru();
}
window.openModalDaftarGuru = openModalDaftarGuru;

function closeModalDaftarGuru() {
  const modal = document.getElementById('modalKelolaGuru');
  if (modal) modal.classList.remove('active');
}
window.closeModalDaftarGuru = closeModalDaftarGuru;

async function loadDaftarGuru() {
  const container = document.getElementById('daftarGuruContainer');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding: 25px; color: var(--text-muted);"><i class="ti ti-loader spin-icon" style="font-size: 1.4rem;"></i> Memuat daftar guru...</div>';

  try {
    const res = await fetch('/api/users/guru');
    const data = await res.json();
    if (data.success && data.users) {
      const elModalTotal = document.getElementById('modalTotalGuruText');
      if (elModalTotal) elModalTotal.textContent = `${data.users.length} Guru Terdaftar`;

      if (data.users.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-muted);">Belum ada akun guru terdaftar. Klik tombol Tambah Guru Baru di atas.</div>';
        return;
      }

      container.innerHTML = '';
      data.users.forEach(u => {
        const card = document.createElement('div');
        card.className = 'guru-item-card';
        card.innerHTML = `
          <div class="guru-item-left">
            <div class="guru-avatar-circle">${escapeHtml(u.nama_lengkap.charAt(0))}</div>
            <div class="guru-info-wrap">
              <div class="guru-name-title">${escapeHtml(u.nama_lengkap)}</div>
              <div class="guru-meta-sub">
                <span>📧 <code>${escapeHtml(u.email)}</code></span>
                ${u.nip ? `<span>• NIP: ${escapeHtml(u.nip)}</span>` : ''}
                <span>• ${escapeHtml(u.unit_bagian)}</span>
              </div>
            </div>
          </div>
          <button type="button" class="btn-reset-sandi" onclick="handleResetPasswordGuru(${u.id}, '${escapeHtml(u.nama_lengkap).replace(/'/g, "\\'")}', '${escapeHtml(u.email).replace(/'/g, "\\'")}')" title="Reset kata sandi akun guru ke default (Dosman2026)">
            <i class="ti ti-key"></i> Reset Sandi
          </button>
        `;
        container.appendChild(card);
      });
    } else {
      container.innerHTML = `<div style="color:var(--rose); padding: 15px;">${data.message || 'Gagal memuat data guru.'}</div>`;
    }
  } catch (err) {
    console.error('Error fetching guru list:', err);
    container.innerHTML = '<div style="color:var(--rose); padding: 15px;">Terjadi kesalahan jaringan saat memuat data guru.</div>';
  }
}
window.loadDaftarGuru = loadDaftarGuru;

async function handleResetPasswordGuru(id, nama, email) {
  if (typeof Swal === 'undefined') {
    const ok = confirm(`Reset kata sandi ${nama} ke "Dosman2026"?`);
    if (ok) {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: 'Dosman2026' })
      });
      const data = await res.json();
      alert(data.message);
      loadDaftarGuru();
    }
    return;
  }

  Swal.fire({
    title: 'Reset Kata Sandi Guru?',
    html: `
      <div style="font-size: 0.85rem; color: #475569; text-align: left; line-height: 1.5; margin-bottom: 12px;">
        Anda akan mereset kata sandi akun untuk:
        <div style="font-weight: 700; color: #0f172a; margin-top: 4px;">${escapeHtml(nama)}</div>
        <div style="color: #64748b;">${escapeHtml(email)}</div>
      </div>
      <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 6px; text-align: left;">
        Kata sandi akan otomatis direset kembali ke standar default sekolah:
      </p>
      <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; font-weight: 800; font-family: monospace; font-size: 1.15rem; color: #0f172a; border: 1px solid #cbd5e1; margin-bottom: 8px;">
        Dosman2026
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: '<i class="ti ti-check"></i> Ya, Reset ke Dosman2026',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/users/${id}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: 'Dosman2026' })
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Kata Sandi Direset!',
            html: `
              <p style="font-size: 0.85rem; color: #334155;">Kata sandi akun <strong>${escapeHtml(nama)}</strong> berhasil direset ke:</p>
              <div style="background: #ecfdf5; color: #047857; padding: 10px; border-radius: 6px; font-weight: bold; font-family: monospace; font-size: 1.1rem; border: 1px solid #a7f3d0; margin: 8px 0;">
                Dosman2026
              </div>
              <p style="font-size: 0.75rem; color: #64748b;">Silakan sampaikan kepada guru bersangkutan.</p>
            `,
            confirmButtonColor: '#059669'
          });
          loadDaftarGuru();
        } else {
          Swal.fire({ icon: 'error', title: 'Gagal Mereset', text: data.message });
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Kesalahan Sistem', text: 'Terjadi gangguan saat mereset kata sandi.' });
      }
    }
  });
}
window.handleResetPasswordGuru = handleResetPasswordGuru;

// --- Ganti Kata Sandi Pribadi (Semua Akun) ---

function openModalGantiPassword() {
  const form = document.getElementById('formGantiPassword');
  if (form) form.reset();
  const modal = document.getElementById('modalGantiPassword');
  if (modal) modal.classList.add('active');
}
window.openModalGantiPassword = openModalGantiPassword;

function closeModalGantiPassword() {
  const modal = document.getElementById('modalGantiPassword');
  if (modal) modal.classList.remove('active');
}
window.closeModalGantiPassword = closeModalGantiPassword;

async function handleGantiPasswordSubmit(e) {
  if (e) e.preventDefault();
  const oldPass = document.getElementById('inputPassOld').value;
  const newPass = document.getElementById('inputPassNew').value;
  const confirmPass = document.getElementById('inputPassConfirm').value;

  if (newPass !== confirmPass) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'error', title: 'Konfirmasi Sandi Tidak Cocok', text: 'Kata sandi baru dan ulangi kata sandi harus sama persis.' });
    } else {
      alert('Kata sandi baru dan ulangi kata sandi tidak cocok!');
    }
    return;
  }

  if (newPass.length < 6) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'warning', title: 'Sandi Terlalu Pendek', text: 'Kata sandi baru minimal harus 6 karakter demi keamanan akun Anda.' });
    } else {
      alert('Kata sandi baru minimal 6 karakter!');
    }
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitGantiPass');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="ti ti-loader spin-icon"></i> Memperbarui...';
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldPassword: oldPass,
        newPassword: newPass
      })
    });
    const data = await res.json();
    if (data.success) {
      closeModalGantiPassword();
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Kata Sandi Berhasil Diperbarui!',
          text: 'Kerahasiaan akun Anda kini terlindungi. Silakan gunakan kata sandi baru Anda untuk login berikutnya.',
          confirmButtonColor: '#059669'
        });
      } else {
        alert('Kata sandi berhasil diperbarui!');
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'error', title: 'Gagal Mengubah Sandi', text: data.message });
      } else {
        alert(data.message);
      }
    }
  } catch (err) {
    console.error('Error changing password:', err);
    alert('Terjadi kesalahan jaringan saat memperbarui kata sandi.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="ti ti-check"></i> Perbarui Kata Sandi';
    }
  }
}
window.handleGantiPasswordSubmit = handleGantiPasswordSubmit;

function togglePasswordInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const isPass = el.type === 'password';
  el.type = isPass ? 'text' : 'password';

  const btn = el.parentElement ? el.parentElement.querySelector('.btn-toggle-password i') : null;
  if (btn) {
    btn.className = isPass ? 'ti ti-eye-off' : 'ti ti-eye';
  }
}
window.togglePasswordInput = togglePasswordInput;

function renderUserHeader(user) {
  document.getElementById('userNameDisplay').textContent = user.nama_lengkap;
  document.getElementById('userRoleDisplay').textContent = user.role.replace('_', ' ');
  document.getElementById('userAvatarInitial').textContent = user.nama_lengkap.charAt(0);
  updateRolePermissionsUI(user);
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
        <i class="ti ti-login" style="font-size: 1.15rem; margin-right: 6px;"></i>
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
  if (typeof Swal !== 'undefined') {
    const result = await Swal.fire({
      title: 'Keluar dari Sistem?',
      text: 'Apakah Anda yakin ingin mengakhiri sesi SI-ARTHA DOSMAN?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="ti ti-logout"></i> Ya, Keluar',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
  } else {
    if (!confirm('Apakah Anda yakin ingin keluar dari sistem SI-ARTHA DOSMAN?')) {
      return;
    }
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

  // Akun Admin disembunyikan dari semua daftar pengguna
  users.filter(u => u.role !== 'ADMIN').forEach(u => {
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
      // Metrik Dashboard Pagu
      const elPagu = document.getElementById('statTotalPagu');
      if (elPagu) elPagu.textContent = formatRupiah(s.total_pagu);
      const elTerserap = document.getElementById('statTerserap');
      if (elTerserap) elTerserap.textContent = formatRupiah(s.total_terserap);
      const elTercadangkan = document.getElementById('statTercadangkan');
      if (elTercadangkan) elTercadangkan.textContent = formatRupiah(s.total_tercadangkan);
      const elSisa = document.getElementById('statSisaAktif');
      if (elSisa) elSisa.textContent = formatRupiah(s.sisa_pagu_aktif);

      // Metrik Dashboard Utama Sambutan (View Home)
      const elHomePagu = document.getElementById('homeTotalPagu');
      if (elHomePagu) elHomePagu.textContent = formatRupiah(s.total_pagu);
      const elHomeTerserap = document.getElementById('homeTotalTerserap');
      if (elHomeTerserap) elHomeTerserap.textContent = formatRupiah(s.total_terserap);
      const elHomeTercadangkan = document.getElementById('homeTercadangkan');
      if (elHomeTercadangkan) elHomeTercadangkan.textContent = formatRupiah(s.total_tercadangkan);
      const elHomeSisa = document.getElementById('homeSisaAktif');
      if (elHomeSisa) elHomeSisa.textContent = formatRupiah(s.sisa_pagu_aktif);

      const elHomePersen = document.getElementById('homePersenTerserap');
      if (elHomePersen) elHomePersen.textContent = `${s.persentase_terserap || 0}%`;

      const elHomePendingCount = document.getElementById('homeCountPending');
      if (elHomePendingCount) {
        elHomePendingCount.textContent = s.count_pending > 0 
          ? `${s.count_pending} usulan menunggu persetujuan` 
          : 'Tidak ada usulan pending';
      }

      latestSummaryData = s;
      initOrUpdateHomeCharts();
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

/**
 * Inisialisasi & pembaruan diagram visual analitik di Dashboard Beranda Utama
 */
function initOrUpdateHomeCharts() {
  if (typeof Chart === 'undefined') {
    return;
  }

  // 1. Chart Distribusi SNP (Bar Chart Horizontal)
  const canvasSnp = document.getElementById('chartSnpDistribution');
  if (canvasSnp && currentPosList && currentPosList.length > 0) {
    const snpData = {
      'Standar Proses': { pagu: 0, realisasi: 0 },
      'Standar Sarana & Prasarana': { pagu: 0, realisasi: 0 },
      'Standar Pengelolaan': { pagu: 0, realisasi: 0 },
      'Standar Pembiayaan': { pagu: 0, realisasi: 0 }
    };

    currentPosList.forEach(pos => {
      const snpKey = pos.snp || 'Lainnya';
      if (!snpData[snpKey]) {
        snpData[snpKey] = { pagu: 0, realisasi: 0 };
      }
      snpData[snpKey].pagu += (pos.pagu_awal || 0);
      snpData[snpKey].realisasi += (pos.total_terserap || 0);
    });

    const labels = Object.keys(snpData);
    const paguValues = labels.map(l => snpData[l].pagu);
    const realisasiValues = labels.map(l => snpData[l].realisasi);

    if (homeSnpChart) {
      homeSnpChart.destroy();
    }

    const ctxSnp = canvasSnp.getContext('2d');
    homeSnpChart = new Chart(ctxSnp, {
      type: 'bar',
      data: {
        labels: labels.map(l => l.replace('Standar ', '').replace('Sarana & Prasarana', 'Sarpras')),
        datasets: [
          {
            label: 'Pagu Alokasi',
            data: paguValues,
            backgroundColor: 'rgba(5, 150, 105, 0.88)',
            borderColor: '#059669',
            borderWidth: 1,
            borderRadius: 6,
            barPercentage: 0.65,
            categoryPercentage: 0.75
          },
          {
            label: 'Realisasi Belanja Riil',
            data: realisasiValues,
            backgroundColor: 'rgba(217, 119, 6, 0.92)',
            borderColor: '#b45309',
            borderWidth: 1,
            borderRadius: 6,
            barPercentage: 0.65,
            categoryPercentage: 0.75
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 50,
        indexAxis: 'y',
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                weight: '600',
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleFont: { size: 12, weight: '700' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const val = context.parsed.x || 0;
                return ` ${label}: ${formatRupiah(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(226, 232, 240, 0.7)'
            },
            ticks: {
              maxTicksLimit: 5,
              font: { size: 10 },
              callback: function(value) {
                if (value >= 1000000000) return (value / 1000000000).toFixed(1) + ' M';
                if (value >= 1000000) return (value / 1000000).toFixed(0) + ' Jt';
                return value;
              }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 10, weight: '600' }
            }
          }
        }
      }
    });
  }

  // 2. Chart Komposisi Serapan & Sisa Pagu (Doughnut Chart)
  const canvasSerapan = document.getElementById('chartStatusSerapan');
  if (canvasSerapan && latestSummaryData) {
    const sisa = latestSummaryData.sisa_pagu_aktif || 0;
    const terserap = latestSummaryData.total_terserap || 0;
    const tercadangkan = latestSummaryData.total_tercadangkan || 0;

    if (homeSerapanChart) {
      homeSerapanChart.destroy();
    }

    const ctxSerapan = canvasSerapan.getContext('2d');
    homeSerapanChart = new Chart(ctxSerapan, {
      type: 'doughnut',
      data: {
        labels: ['Sisa Kuota Kas', 'Realisasi Terserap', 'Pagu Tercadangkan'],
        datasets: [{
          data: [sisa, terserap, tercadangkan],
          backgroundColor: ['#10b981', '#f59e0b', '#06b6d4'],
          hoverBackgroundColor: ['#059669', '#d97706', '#0891b2'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 50,
        cutout: '66%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                weight: '600',
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleFont: { size: 12, weight: '700' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const val = context.parsed || 0;
                const total = sisa + terserap + tercadangkan;
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : '0';
                return ` ${label}: ${formatRupiah(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}
window.initOrUpdateHomeCharts = initOrUpdateHomeCharts;

function updateHomeGreeting() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = 'Selamat Datang';
  if (hour >= 4 && hour < 11) greeting = 'Selamat Pagi';
  else if (hour >= 11 && hour < 15) greeting = 'Selamat Siang';
  else if (hour >= 15 && hour < 18) greeting = 'Selamat Sore';
  else greeting = 'Selamat Malam';

  const elGreeting = document.getElementById('homeGreetingTime');
  if (elGreeting) elGreeting.textContent = greeting;

  if (currentUser) {
    const elName = document.getElementById('homeGreetingName');
    if (elName) elName.textContent = currentUser.nama_lengkap || currentUser.username;

    const elRole = document.getElementById('homeUserRole');
    if (elRole) {
      if (currentUser.role === 'GURU') elRole.textContent = 'GURU PEMBINA / UNIT';
      else if (currentUser.role === 'BENDAHARA') elRole.textContent = 'BENDAHARA SEKOLAH';
      else if (currentUser.role === 'KEPALA_SEKOLAH') elRole.textContent = 'KEPALA SEKOLAH';
      else if (currentUser.role === 'ANALISIS_SDM') elRole.textContent = 'ANALISIS SDM APARATUR';
      else elRole.textContent = currentUser.role;
    }
  }
}
window.updateHomeGreeting = updateHomeGreeting;

async function loadPosAnggaran() {
  const tbody = document.getElementById('posTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="ti ti-loader spin-icon" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i>Memuat data pagu RKAS...</td></tr>';
  }

  try {
    const res = await fetch('/api/pos-anggaran');
    const data = await res.json();
    if (data.success && data.data) {
      currentPosList = data.data;

      // Update counters
      const countAll = currentPosList.length;
      const countProses = currentPosList.filter(p => (p.snp || '').includes('Proses')).length;
      const countSarpras = currentPosList.filter(p => (p.snp || '').includes('Sarana')).length;
      const countPengelolaan = currentPosList.filter(p => (p.snp || '').includes('Pengelolaan')).length;
      const countPembiayaan = currentPosList.filter(p => (p.snp || '').includes('Pembiayaan')).length;

      if (document.getElementById('posCountBadge')) document.getElementById('posCountBadge').textContent = `${countAll} Pos`;
      if (document.getElementById('countSnpAll')) document.getElementById('countSnpAll').textContent = countAll;
      if (document.getElementById('countSnpProses')) document.getElementById('countSnpProses').textContent = countProses;
      if (document.getElementById('countSnpSarpras')) document.getElementById('countSnpSarpras').textContent = countSarpras;
      if (document.getElementById('countSnpPengelolaan')) document.getElementById('countSnpPengelolaan').textContent = countPengelolaan;
      if (document.getElementById('countSnpPembiayaan')) document.getElementById('countSnpPembiayaan').textContent = countPembiayaan;

      const optAll = document.getElementById('optSnpAll');
      if (optAll) optAll.textContent = `Semua Standar (${countAll})`;
      const optProses = document.getElementById('optSnpProses');
      if (optProses) optProses.textContent = `Standar Proses (${countProses})`;
      const optSarpras = document.getElementById('optSnpSarpras');
      if (optSarpras) optSarpras.textContent = `Standar Sarpras (${countSarpras})`;
      const optPengelolaan = document.getElementById('optSnpPengelolaan');
      if (optPengelolaan) optPengelolaan.textContent = `Standar Pengelolaan (${countPengelolaan})`;
      const optPembiayaan = document.getElementById('optSnpPembiayaan');
      if (optPembiayaan) optPembiayaan.textContent = `Standar Pembiayaan (${countPembiayaan})`;

      renderPosAnggaranTable();
      populatePosDropdown();
      initOrUpdateHomeCharts();
    }
  } catch (err) {
    console.error('Error loading pos anggaran:', err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--rose); padding: 30px; text-align: center;">Gagal memuat pos anggaran dari server.</td></tr>';
    }
  }
}

function toggleGroup(noKelompok) {
  if (collapsedGroups.has(noKelompok)) {
    collapsedGroups.delete(noKelompok);
  } else {
    collapsedGroups.add(noKelompok);
  }
  renderPosAnggaranTable();
}

function toggleAllGroups(expand) {
  if (expand) {
    collapsedGroups.clear();
  } else {
    currentPosList.forEach(p => {
      if (p.no_kelompok) collapsedGroups.add(p.no_kelompok);
    });
  }
  renderPosAnggaranTable();
}

function renderPosAnggaranTable() {
  const tbody = document.getElementById('posTableBody');
  const tfoot = document.getElementById('posTableFoot');
  if (!tbody) return;

  tbody.innerHTML = '';

  const isGuru = currentUser && currentUser.role === 'GURU';

  // Apply filters
  let filtered = currentPosList.filter(item => {
    // 1. SNP Filter
    if (selectedSnpFilter !== 'ALL' && item.snp !== selectedSnpFilter) {
      return false;
    }

    // 2. Traffic Filter
    if (selectedTrafficFilter !== 'ALL' && item.trafficLight !== selectedTrafficFilter) {
      return false;
    }

    // 3. Search Keyword
    if (searchKeyword) {
      const matchNama = (item.nama_pos || '').toLowerCase().includes(searchKeyword);
      const matchKode = (item.kode_rekening || '').toLowerCase().includes(searchKeyword);
      const matchProg = (item.program_induk || '').toLowerCase().includes(searchKeyword);
      const matchKelompok = (item.nama_kelompok || '').toLowerCase().includes(searchKeyword);
      const matchKodeKel = (item.kode_kelompok || '').toLowerCase().includes(searchKeyword);
      const matchSnp = (item.snp || '').toLowerCase().includes(searchKeyword);
      if (!matchNama && !matchKode && !matchProg && !matchKelompok && !matchKodeKel && !matchSnp) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 45px 20px; color: var(--text-muted);">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-main);">Tidak ada pos anggaran yang sesuai kriteria</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Coba ubah kata kunci pencarian atau ganti filter Standar SNP.</div>
        </td>
      </tr>
    `;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  // Group items by no_kelompok (1 to 35)
  const groupMap = new Map();
  filtered.forEach(item => {
    const gNo = item.no_kelompok || 999;
    if (!groupMap.has(gNo)) {
      groupMap.set(gNo, {
        no: gNo,
        kode: item.kode_kelompok || item.kode_rekening,
        nama: item.nama_kelompok || item.nama_pos,
        program_induk: item.program_induk,
        snp: item.snp,
        items: []
      });
    }
    groupMap.get(gNo).items.push(item);
  });

  // Render Groups & Sub-Items
  groupMap.forEach(g => {
    let snpBadgeClass = 'proses';
    let snpShort = 'Proses';
    const snpStr = g.snp || '';
    if (snpStr.includes('Sarana')) {
      snpBadgeClass = 'sarpras';
      snpShort = 'Sarpras';
    } else if (snpStr.includes('Pengelolaan')) {
      snpBadgeClass = 'pengelolaan';
      snpShort = 'Pengelolaan';
    } else if (snpStr.includes('Pembiayaan')) {
      snpBadgeClass = 'pembiayaan';
      snpShort = 'Pembiayaan';
    }

    const gTotalPagu = g.items.reduce((s, it) => s + (it.pagu_awal || 0), 0);
    const gTotalTerserap = g.items.reduce((s, it) => s + (it.total_terserap || 0), 0);
    const gTotalPending = g.items.reduce((s, it) => s + (it.pagu_tercadangkan || 0), 0);
    const gTotalSisa = g.items.reduce((s, it) => s + (it.sisa_pagu || 0), 0);
    const gPersen = gTotalPagu > 0 ? ((gTotalTerserap + gTotalPending) / gTotalPagu) * 100 : 0;
    const gTraffic = gPersen >= 90 ? 'red' : (gPersen >= 70 ? 'yellow' : 'green');
    let gTrafficLabel = 'AMAN';
    if (gTraffic === 'yellow') gTrafficLabel = 'WASPADA';
    if (gTraffic === 'red') gTrafficLabel = 'KRITIS';

    // Single item check: Home Visit (1), Honor Guru (33), Honor Pegawai (34), Jasa Kebersihan (35)
    // or when the group has only 1 item and item name is identical to group name
    const isSingle = g.items.length === 1 && (
      [1, 33, 34, 35].includes(g.no) ||
      g.items[0].nama_pos.trim().toLowerCase() === g.nama.trim().toLowerCase() ||
      g.items[0].kode_rekening === g.kode
    );

    if (isSingle) {
      // Direct Single Row (8 Kolom)
      const item = g.items[0];
      let itemTrafficLabel = 'AMAN';
      if (item.trafficLight === 'yellow') itemTrafficLabel = 'WASPADA';
      if (item.trafficLight === 'red') itemTrafficLabel = 'KRITIS';

      const tr = document.createElement('tr');
      tr.className = 'rkas-single-row';
      tr.innerHTML = `
        <td style="text-align: center; color: var(--text-main); font-size: 0.88rem; font-weight: 800;">
          ${g.no}
        </td>
        <td>
          <span class="kode-badge group" title="Kode Rekening RKAS">${escapeHtml(item.kode_rekening || '-')}</span>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span class="snp-tag-badge ${snpBadgeClass}">${snpShort}</span>
            <span class="program-induk-cell" title="${escapeHtml(item.program_induk || '')}">${escapeHtml(item.program_induk || '-')}</span>
          </div>
        </td>
        <td>
          <div class="pos-title-wrap">
            <span class="pos-nama-main">${escapeHtml(item.nama_pos)}</span>
            <span class="vol-satuan-badge">${item.volume || 1} ${escapeHtml(item.satuan || 'kegiatan')}</span>
          </div>
          ${item.keterangan ? `<div class="pos-keterangan-sub">${escapeHtml(item.keterangan)}</div>` : ''}
        </td>
        <td style="text-align: right; font-weight: 700; color: var(--text-main); font-size: 0.88rem; white-space: nowrap;">
          ${formatRupiah(item.pagu_awal)}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="font-weight: 600; color: var(--amber); font-size: 0.85rem; white-space: nowrap;">${formatRupiah(item.total_terserap)}</div>
          ${item.pagu_tercadangkan > 0 ? `<div class="pending-cell-sub" title="Pending Review" style="white-space: nowrap;">⏳ ${formatRupiah(item.pagu_tercadangkan)}</div>` : ''}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="font-weight: 800; font-size: 0.88rem; white-space: nowrap; color: ${item.sisa_pagu <= 0 ? 'var(--rose)' : 'var(--emerald)'};">
            ${formatRupiah(item.sisa_pagu)}
          </div>
          <div class="status-cell-sub" style="white-space: nowrap;">
            <span class="traffic-mini-pill ${item.trafficLight}">
              <span class="traffic-dot"></span> ${itemTrafficLabel} (${item.persentaseTerserap}%)
            </span>
          </div>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          ${canUserManagePagu() ? `
            <div class="table-action-stack">
              <button class="btn btn-secondary btn-xs" onclick="openEditPosModal(${item.id})" title="Ubah Plafon Pos">
                <i class="ti ti-edit"></i> Edit
              </button>
              ${canUserDelete() ? `
                <button class="btn btn-outline-danger btn-xs" onclick="handleDeletePosAnggaran(${item.id}, '${escapeHtml(item.nama_pos)}')" title="Hapus Pos Anggaran">
                  <i class="ti ti-trash"></i> Hapus
                </button>
              ` : ''}
            </div>
          ` : `
            <button class="btn-ajukan-pos" onclick="ajukanPosSpesifik(${item.id})" title="Ajukan Usulan RAB untuk Kegiatan Ini">
              <i class="ti ti-plus"></i> Ajukan
            </button>
          `}
        </td>
      `;
      tbody.appendChild(tr);
    } else {
      // Multi-Item Group Row (Tingkat Induk / Header Kelompok - 8 Kolom)
      const isCollapsed = searchKeyword ? false : collapsedGroups.has(g.no);

      const trGroup = document.createElement('tr');
      trGroup.className = `rkas-group-header ${isCollapsed ? 'collapsed' : ''}`;
      trGroup.onclick = () => toggleGroup(g.no);
      trGroup.title = 'Klik untuk melipat / membuka rincian sub-kegiatan';
      trGroup.innerHTML = `
        <td style="text-align: center; color: var(--text-main); font-size: 0.88rem; font-weight: 800;">
          ${g.no}
        </td>
        <td>
          <span class="kode-badge group" title="Kode Kelompok">${escapeHtml(g.kode || '-')}</span>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span class="snp-tag-badge ${snpBadgeClass}">${snpShort}</span>
            <span class="program-induk-cell" title="${escapeHtml(g.program_induk || '')}">${escapeHtml(g.program_induk || '-')}</span>
          </div>
        </td>
        <td>
          <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
            <button type="button" class="group-toggle-btn" onclick="event.stopPropagation(); toggleGroup(${g.no})">
              <i class="ti ti-chevron-${isCollapsed ? 'right' : 'down'}"></i>
            </button>
            <span>📁 ${escapeHtml(g.nama)}</span>
            <span class="badge-child-count">
              <span class="badge-count-num">${g.items.length}</span>
              <span class="badge-count-text">Rincian</span>
            </span>
          </div>
        </td>
        <td style="text-align: right; font-weight: 800; color: var(--text-main); font-size: 0.9rem; white-space: nowrap;">
          ${formatRupiah(gTotalPagu)}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="font-weight: 700; color: var(--amber); font-size: 0.86rem; white-space: nowrap;">${formatRupiah(gTotalTerserap)}</div>
          ${gTotalPending > 0 ? `<div class="pending-cell-sub" title="Total Pending Review" style="white-space: nowrap;">⏳ ${formatRupiah(gTotalPending)}</div>` : ''}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="font-weight: 800; font-size: 0.9rem; white-space: nowrap; color: ${gTotalSisa <= 0 ? 'var(--rose)' : 'var(--emerald)'};">
            ${formatRupiah(gTotalSisa)}
          </div>
          <div class="status-cell-sub" style="white-space: nowrap;">
            <span class="traffic-mini-pill ${gTraffic}">
              <span class="traffic-dot"></span> ${gTrafficLabel} (${Math.round(gPersen)}%)
            </span>
          </div>
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-toggle-text" onclick="event.stopPropagation(); toggleGroup(${g.no})">
            ${isCollapsed ? '▶ Buka' : '▼ Tutup'}
          </button>
        </td>
      `;
      tbody.appendChild(trGroup);

      // Render Sub-Rows (Rincian Kegiatan Tingkat 2 - 8 Kolom)
      if (!isCollapsed) {
        g.items.forEach((item, cIdx) => {
          let itemTrafficLabel = 'AMAN';
          if (item.trafficLight === 'yellow') itemTrafficLabel = 'WASPADA';
          if (item.trafficLight === 'red') itemTrafficLabel = 'KRITIS';

          const trChild = document.createElement('tr');
          trChild.className = 'rkas-child-row';
          trChild.innerHTML = `
            <td style="text-align: center;"></td>
            <td>
              <span class="kode-badge sub" title="Kode Sub-Kegiatan">${escapeHtml(item.kode_rekening || '-')}</span>
            </td>
            <td>
              <span class="snp-tag-badge dim ${snpBadgeClass}" title="${escapeHtml(item.program_induk || '')}">${snpShort}</span>
            </td>
            <td>
              <div class="child-indent-wrap">
                <span class="child-bullet">•</span>
                <div style="flex: 1;">
                  <div class="pos-title-wrap">
                    <span class="child-item-title">${escapeHtml(item.nama_pos)}</span>
                    <span class="vol-satuan-badge">${item.volume || 1} ${escapeHtml(item.satuan || 'kegiatan')}</span>
                  </div>
                  ${item.keterangan ? `<div class="child-item-sub">${escapeHtml(item.keterangan)}</div>` : ''}
                </div>
              </div>
            </td>
            <td style="text-align: right; font-weight: 600; color: var(--text-main); font-size: 0.86rem; white-space: nowrap;">
              ${formatRupiah(item.pagu_awal)}
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="font-weight: 600; color: var(--amber); font-size: 0.84rem; white-space: nowrap;">${formatRupiah(item.total_terserap)}</div>
              ${item.pagu_tercadangkan > 0 ? `<div class="pending-cell-sub" title="Pending Review" style="white-space: nowrap;">⏳ ${formatRupiah(item.pagu_tercadangkan)}</div>` : ''}
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="font-weight: 700; font-size: 0.86rem; white-space: nowrap; color: ${item.sisa_pagu <= 0 ? 'var(--rose)' : 'var(--emerald)'};">
                ${formatRupiah(item.sisa_pagu)}
              </div>
              <div class="status-cell-sub" style="white-space: nowrap;">
                <span class="traffic-mini-pill ${item.trafficLight}">
                  <span class="traffic-dot"></span> ${itemTrafficLabel} (${item.persentaseTerserap}%)
                </span>
              </div>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              ${canUserManagePagu() ? `
                <div class="table-action-stack">
                  <button class="btn btn-secondary btn-xs" onclick="openEditPosModal(${item.id})" title="Ubah Plafon Pos">
                    <i class="ti ti-edit"></i> Edit
                  </button>
                  ${canUserDelete() ? `
                    <button class="btn btn-outline-danger btn-xs" onclick="handleDeletePosAnggaran(${item.id}, '${escapeHtml(item.nama_pos)}')" title="Hapus Pos Anggaran">
                      <i class="ti ti-trash"></i> Hapus
                    </button>
                  ` : ''}
                </div>
              ` : `
                <button class="btn-ajukan-pos" onclick="ajukanPosSpesifik(${item.id})" title="Ajukan Usulan RAB untuk Kegiatan Ini">
                  <i class="ti ti-plus"></i> Ajukan
                </button>
              `}
            </td>
          `;
          tbody.appendChild(trChild);
        });
      }
    }
  });

  // Calculate & Render Footer Totals (8 Kolom)
  if (tfoot) {
    const totalPagu = filtered.reduce((s, it) => s + (it.pagu_awal || 0), 0);
    const totalTerserap = filtered.reduce((s, it) => s + (it.total_terserap || 0), 0);
    const totalPending = filtered.reduce((s, it) => s + (it.pagu_tercadangkan || 0), 0);
    const totalSisa = filtered.reduce((s, it) => s + (it.sisa_pagu || 0), 0);
    const totalPersen = totalPagu > 0 ? Math.round(((totalTerserap + totalPending) / totalPagu) * 100) : 0;

    tfoot.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: right; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.5px; text-transform: uppercase;">
          Sub-Total (${groupMap.size} Kelompok / ${filtered.length} Rincian) :
        </td>
        <td style="text-align: right; font-weight: 800; color: var(--primary); font-size: 0.9rem; white-space: nowrap;">
          ${formatRupiah(totalPagu)}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="font-weight: 700; color: var(--amber); font-size: 0.88rem; white-space: nowrap;">${formatRupiah(totalTerserap)}</div>
          ${totalPending > 0 ? `<div class="pending-cell-sub" title="Total Pending Review" style="white-space: nowrap;">⏳ ${formatRupiah(totalPending)}</div>` : ''}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="font-weight: 800; color: var(--emerald); font-size: 0.9rem; white-space: nowrap;">${formatRupiah(totalSisa)}</div>
          <div class="status-cell-sub" style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); white-space: nowrap;">
            Serapan: ${totalPersen}%
          </div>
        </td>
        <td></td>
      </tr>
    `;
  }

  // Aktifkan drag-to-scroll di mana saja pada tabel
  if (typeof enableDragToScroll === 'function') {
    enableDragToScroll();
  }
}

function filterBySnp(snp) {
  selectedSnpFilter = snp;
  const select = document.getElementById('filterSnpSelect');
  if (select && select.value !== snp) {
    select.value = snp;
  }
  document.querySelectorAll('.snp-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.snp === snp);
  });
  renderPosAnggaranTable();
}

function handlePosSearch(val) {
  searchKeyword = (val || '').trim().toLowerCase();
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) {
    btnClear.style.display = searchKeyword ? 'inline-block' : 'none';
  }
  renderPosAnggaranTable();
}

function clearPosSearch() {
  const input = document.getElementById('searchPosInput');
  if (input) input.value = '';
  handlePosSearch('');
}

function handleTrafficFilter(val) {
  selectedTrafficFilter = val || 'ALL';
  renderPosAnggaranTable();
}

function ajukanPosSpesifik(id) {
  switchView('ajukan');
  const filterInput = document.getElementById('filterPosDropdownInput');
  if (filterInput) filterInput.value = '';
  populatePosDropdown('');
  const select = document.getElementById('selectPosAnggaran');
  if (select) {
    select.value = String(id);
    handlePosSelected();
  }
}

async function handleSyncRkasExcel() {
  if (!canUserManagePagu()) {
    alert('Akses Ditolak: Hanya Analisis SDM Aparatur dan Kepala Sekolah yang berhak menyinkronkan data RKAS.');
    return;
  }
  if (!confirm('Apakah Anda yakin ingin menyinkronkan ulang data pagu dari file Excel data_luar/rkas.xlsx?')) {
    return;
  }
  const btn = document.getElementById('btnSyncRkas');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader spin-icon"></i> Menyinkronkan...';
  }
  try {
    const res = await fetch('/api/pos-anggaran/sync-rkas', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showNotification(`✓ ${data.message} (${data.count} pos diimpor)`);
      await loadSummaryStats();
      await loadPosAnggaran();
    } else {
      alert(`Gagal sinkronisasi: ${data.message}`);
    }
  } catch (err) {
    console.error('Error syncing RKAS:', err);
    alert('Terjadi kesalahan koneksi saat sinkronisasi.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-refresh" style="font-size: 1rem;"></i> Sync Excel RKAS';
    }
  }
}

// Populate Pos Anggaran Dropdown in Proposal Form (Grouped by Tingkat Kelompok)
function populatePosDropdown(filterText = '') {
  const select = document.getElementById('selectPosAnggaran');
  if (!select) return;
  const selectedVal = select.value;
  select.innerHTML = '<option value="">-- Pilih Pos Anggaran RKAS --</option>';

  const kw = (filterText || '').trim().toLowerCase();
  const list = kw
    ? currentPosList.filter(p =>
        (p.nama_pos || '').toLowerCase().includes(kw) ||
        (p.kode_rekening || '').toLowerCase().includes(kw) ||
        (p.nama_kelompok || '').toLowerCase().includes(kw) ||
        (p.kode_kelompok || '').toLowerCase().includes(kw) ||
        (p.program_induk || '').toLowerCase().includes(kw) ||
        (p.snp || '').toLowerCase().includes(kw)
      )
    : currentPosList;

  // Group by no_kelompok
  const groups = new Map();
  list.forEach(pos => {
    const gKey = pos.no_kelompok || 999;
    if (!groups.has(gKey)) {
      const gKode = pos.kode_kelompok ? `[${pos.kode_kelompok}] ` : '';
      const gNama = pos.nama_kelompok || pos.program_induk || 'Kelompok Umum';
      groups.set(gKey, {
        label: `${gKode}${gNama}`,
        items: []
      });
    }
    groups.get(gKey).items.push(pos);
  });

  groups.forEach(grp => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = grp.label;
    grp.items.forEach(pos => {
      const opt = document.createElement('option');
      opt.value = pos.id;
      const kodePrefix = pos.kode_rekening ? `[${pos.kode_rekening}] ` : '';
      opt.textContent = `${kodePrefix}${pos.nama_pos} (Sisa: ${formatRupiah(pos.sisa_pagu)})`;
      if (selectedVal && Number(selectedVal) === pos.id) {
        opt.selected = true;
      }
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
}

function handleFilterPosDropdown(keyword) {
  populatePosDropdown(keyword);
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
        <input type="text" inputmode="numeric" class="form-input item-harga rupiah-input" placeholder="15.000" value="${defaults.harga_satuan ? Number(defaults.harga_satuan).toLocaleString('id-ID') : '0'}" required oninput="formatCurrencyInput(this); handleRowInput(this)">
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
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Minimal 1 Item',
        text: 'Minimal harus ada 1 baris rincian belanja dalam proposal usulan kegiatan.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Minimal harus ada 1 baris rincian belanja dalam proposal.');
    }
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
  const harga = parseRupiahInput(card.querySelector('.item-harga').value);
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
    const harga = parseRupiahInput(card.querySelector('.item-harga').value);
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
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Pilih Pos Anggaran',
        text: 'Harap pilih Pos Anggaran yang dibebani terlebih dahulu sebelum mengirim usulan.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Harap pilih Pos Anggaran yang dibebani.');
    }
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
    const harga_satuan = parseRupiahInput(card.querySelector('.item-harga').value);

    if (!deskripsi) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: 'Deskripsi Item Kosong',
          text: 'Deskripsi item belanja tidak boleh kosong. Harap lengkapi uraian seluruh rincian barang/jasa.',
          confirmButtonColor: '#059669'
        });
      } else {
        alert('Deskripsi item belanja tidak boleh kosong.');
      }
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

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Mengirim Usulan RAB...',
      text: 'Mendaftarkan usulan ke sistem dan mencadangkan pagu anggaran...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
  }

  try {
    const res = await fetch('/api/pengajuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      if (typeof Swal !== 'undefined') {
        await Swal.fire({
          icon: 'success',
          title: 'Usulan Berhasil Dikirim!',
          text: data.message,
          confirmButtonColor: '#059669',
          confirmButtonText: 'Buka Riwayat Proposal'
        });
      } else {
        showNotification(`🎉 ${data.message}`);
      }
      document.getElementById('formPengajuanRab').reset();
      // Reset items ke 1 baris
      container.innerHTML = '';
      addItemRow();
      // Refresh data pagu & buka tab riwayat
      await loadSummaryStats();
      await loadPosAnggaran();
      switchView('riwayat');
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Mengajukan Proposal',
          text: data.message || 'Gagal mengajukan proposal.',
          confirmButtonColor: '#059669'
        });
      } else {
        alert(data.message || 'Gagal mengajukan proposal.');
      }
    }
  } catch (err) {
    console.error('Error submitting proposal:', err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Jaringan',
        text: 'Terjadi kesalahan jaringan atau server saat mengirimkan usulan.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Terjadi kesalahan koneksi.');
    }
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

      const badge = document.getElementById('proposalCountBadge');
      if (badge) {
        badge.textContent = `${currentProposals.length}`;
        badge.title = `${currentProposals.length} Usulan Terdaftar`;
      }
      renderProposalsList(currentProposals);
      if (activeViewName === 'laporan') {
        renderLpjView();
      }
    }
  } catch (err) {
    container.innerHTML = '<div style="color:var(--rose); padding: 20px;">Gagal memuat usulan kegiatan.</div>';
  }
}

function filterProposalTab(tabKey) {
  currentProposalFilterTab = tabKey;
  document.querySelectorAll('.proposal-status-tabs .status-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === tabKey);
  });
  renderProposalsList(currentProposals);
}
window.filterProposalTab = filterProposalTab;

function updateProposalTabCounters(proposals) {
  if (!proposals) return;
  const countAll = proposals.length;
  const countReview = proposals.filter(p => ['MENUNGGU_REVIEW', 'MENUNGGU_PERSETUJUAN_KEPSEK', 'PERLU_REVISI'].includes(p.status)).length;
  const countSiapCair = proposals.filter(p => p.status === 'DISETUJUI').length;
  const countDicairkan = proposals.filter(p => ['DICAIRKAN', 'MENUNGGU_VERIFIKASI_LPJ'].includes(p.status)).length;
  const countSelesai = proposals.filter(p => p.status === 'SELESAI').length;

  const elAll = document.getElementById('badgeCountAll');
  if (elAll) elAll.textContent = countAll;
  const elReview = document.getElementById('badgeCountReview');
  if (elReview) {
    elReview.textContent = countReview;
  }
  const elSiapCair = document.getElementById('badgeCountSiapCair');
  if (elSiapCair) {
    elSiapCair.textContent = countSiapCair;
  }
  const elDicairkan = document.getElementById('badgeCountDicairkan');
  if (elDicairkan) elDicairkan.textContent = countDicairkan;
  const elSelesai = document.getElementById('badgeCountSelesai');
  if (elSelesai) elSelesai.textContent = countSelesai;
}

function renderProposalsList(proposals) {
  const container = document.getElementById('proposalsListContainer');
  if (!container) return;
  container.innerHTML = '';

  updateProposalTabCounters(proposals);

  let filtered = proposals;
  if (currentProposalFilterTab === 'MENUNGGU_REVIEW') {
    filtered = proposals.filter(p => ['MENUNGGU_REVIEW', 'MENUNGGU_PERSETUJUAN_KEPSEK', 'PERLU_REVISI'].includes(p.status));
  } else if (currentProposalFilterTab === 'SIAP_CAIR') {
    filtered = proposals.filter(p => p.status === 'DISETUJUI');
  } else if (currentProposalFilterTab === 'DICAIRKAN') {
    filtered = proposals.filter(p => ['DICAIRKAN', 'MENUNGGU_VERIFIKASI_LPJ'].includes(p.status));
  } else if (currentProposalFilterTab === 'SELESAI') {
    filtered = proposals.filter(p => p.status === 'SELESAI');
  } else if (currentProposalFilterTab === 'ALL') {
    // Pada tab 'Semua Usulan', kelompokkan berdasarkan fase alur kerja agar tertib dan rapi
    const statusPriority = {
      'MENUNGGU_REVIEW': 1,
      'PERLU_REVISI': 1,
      'MENUNGGU_PERSETUJUAN_KEPSEK': 2,
      'DISETUJUI': 3,
      'MENUNGGU_VERIFIKASI_LPJ': 4,
      'DICAIRKAN': 5,
      'SELESAI': 6,
      'DITOLAK': 7
    };
    filtered = [...proposals].sort((a, b) => {
      const pA = statusPriority[a.status] || 99;
      const pB = statusPriority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return b.id - a.id;
    });
  }

  if (filtered.length === 0) {
    let emptyTitle = 'Tidak Ada Usulan dalam Kategori Ini';
    let emptyDesc = 'Saat ini tidak ada usulan kegiatan pada status ini.';
    if (currentProposalFilterTab === 'MENUNGGU_REVIEW') {
      emptyTitle = 'Antrean Bersih: Tidak Ada Usulan Menunggu Review';
      emptyDesc = 'Semua usulan kegiatan yang masuk telah ditelaah atau belum ada pengajuan baru.';
    } else if (currentProposalFilterTab === 'SIAP_CAIR') {
      emptyTitle = 'Tidak Ada Usulan Menunggu Pencairan Kas';
      emptyDesc = 'Tidak ada usulan berstatus disetujui yang belum diserahkan dananya oleh Bendahara.';
    } else if (currentProposalFilterTab === 'DICAIRKAN') {
      emptyTitle = 'Belum Ada Usulan yang Dicairkan';
      emptyDesc = 'Usulan yang telah dicairkan kasnya akan muncul di sini untuk penyusunan LPJ.';
    } else if (currentProposalFilterTab === 'SELESAI') {
      emptyTitle = 'Belum Ada LPJ Selesai';
      emptyDesc = 'Kegiatan yang LPJ-nya telah diverifikasi sah oleh bendahara akan diarsipkan di sini.';
    } else if (proposals.length === 0) {
      const isGuru = currentUser && currentUser.role === 'GURU';
      emptyTitle = isGuru ? 'Anda Belum Memiliki Usulan RAB' : 'Belum Ada Usulan Masuk dari Guru';
      emptyDesc = isGuru 
        ? 'Anda belum mengajukan rencana anggaran kegiatan. Tekan tombol di bawah untuk membuat usulan baru.'
        : 'Saat ini belum ada proposal kegiatan yang diajukan oleh guru pembina sekolah.';
    }

    container.innerHTML = `
      <div style="text-align: center; padding: 45px 20px; background: #ffffff; border-radius: var(--radius-lg); border: 1.5px dashed var(--border-subtle); margin-top: 4px;">
        <i class="ti ti-folder-off" style="font-size: 2.5rem; color: #94a3b8; display: block; margin-bottom: 12px;"></i>
        <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${emptyTitle}</div>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin: 6px 0 16px; max-width: 480px; margin-inline: auto;">
          ${emptyDesc}
        </p>
        ${currentProposalFilterTab !== 'ALL' ? `
          <button class="btn btn-outline-success btn-sm" onclick="filterProposalTab('ALL')">
            <i class="ti ti-folders"></i> Lihat Semua Usulan (${proposals.length})
          </button>
        ` : `
          <button class="btn btn-primary btn-sm" onclick="switchRabSubTab('form')">
            + Buat Usulan RAB Sekarang
          </button>
        `}
      </div>
    `;
    return;
  }

  let lastGroupKey = '';
  filtered.forEach(p => {
    let groupKey = '';
    let groupTitle = '';
    let groupClass = '';
    let groupIcon = '';

    if (['MENUNGGU_REVIEW', 'MENUNGGU_PERSETUJUAN_KEPSEK', 'PERLU_REVISI'].includes(p.status)) {
      groupKey = 'REVIEW';
      groupTitle = 'Menunggu Telaah & Persetujuan (Perlu Ditindaklanjuti)';
      groupClass = 'warning';
      groupIcon = 'ti-clock-hour-4';
    } else if (p.status === 'DISETUJUI') {
      groupKey = 'SIAP_CAIR';
      groupTitle = 'Disetujui — Siap Pencairan Kas oleh Bendahara';
      groupClass = 'success';
      groupIcon = 'ti-cash';
    } else if (['DICAIRKAN', 'MENUNGGU_VERIFIKASI_LPJ'].includes(p.status)) {
      groupKey = 'DICAIRKAN';
      groupTitle = 'Dana Telah Dicairkan — Dalam Pelaksanaan & LPJ';
      groupClass = 'info';
      groupIcon = 'ti-check-double';
    } else if (p.status === 'SELESAI') {
      groupKey = 'SELESAI';
      groupTitle = 'Arsip Kegiatan & LPJ Selesai';
      groupClass = 'done';
      groupIcon = 'ti-circle-check';
    }

    if (currentProposalFilterTab === 'ALL' && groupKey && groupKey !== lastGroupKey) {
      lastGroupKey = groupKey;
      const countInGroup = proposals.filter(item => {
        if (groupKey === 'REVIEW') return ['MENUNGGU_REVIEW', 'MENUNGGU_PERSETUJUAN_KEPSEK', 'PERLU_REVISI'].includes(item.status);
        if (groupKey === 'SIAP_CAIR') return item.status === 'DISETUJUI';
        if (groupKey === 'DICAIRKAN') return ['DICAIRKAN', 'MENUNGGU_VERIFIKASI_LPJ'].includes(item.status);
        if (groupKey === 'SELESAI') return item.status === 'SELESAI';
        return false;
      }).length;

      const heading = document.createElement('div');
      heading.className = `proposal-group-heading ${groupClass}`;
      heading.innerHTML = `
        <span><i class="ti ${groupIcon}" style="margin-right: 6px;"></i> ${groupTitle}</span>
        <span class="tab-badge-pill badge-${groupClass}">${countInGroup} Usulan</span>
      `;
      container.appendChild(heading);
    }

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
    const isKepsek = currentUser && (currentUser.role === 'KEPALA_SEKOLAH' || currentUser.role === 'ANALISIS_SDM' || currentUser.role === 'ADMIN');
    const isOwnerGuru = currentUser && (currentUser.id === p.user_id || currentUser.role === 'ADMIN');
    const canManageLpj = currentUser && (currentUser.id === p.user_id || currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');

    if (isBendahara && (p.status === 'MENUNGGU_REVIEW' || p.status === 'PERLU_REVISI')) {
      roleActionBtn = `
        <button class="btn btn-warning btn-sm" style="background: #d97706; border-color: #d97706; color: #fff;" onclick="event.stopPropagation(); openReviewModal(${p.id})">
          <i class="ti ti-edit"></i> Telaah & Koreksi
        </button>
      `;
    } else if (isKepsek && p.status === 'MENUNGGU_PERSETUJUAN_KEPSEK') {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openKepsekModal(${p.id})">
          <i class="ti ti-shield-check"></i> Beri Otorisasi Final
        </button>
      `;
    } else if (isBendahara && p.status === 'DISETUJUI') {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openCairkanModal(${p.id})">
          <i class="ti ti-cash"></i> Cairkan Kas
        </button>
      `;
    } else if (canManageLpj && p.status === 'DICAIRKAN') {
      roleActionBtn = `
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); navigateToLpjEditor(${p.id})" title="Buka formulir lengkap penyusunan LPJ &amp; unggah bukti">
          <i class="ti ti-file-certificate"></i> Buat LPJ
        </button>
      `;
    } else if (p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
      let btns = '';
      if (isBendahara) {
        btns += `
          <button class="btn btn-warning btn-sm" style="background: #d97706; border-color: #d97706; color: #fff; margin-right: 4px;" onclick="event.stopPropagation(); openVerifikasiLpjModal(${p.id})" title="Periksa berkas nota &amp; sahkan LPJ">
            <i class="ti ti-clipboard-check"></i> Verifikasi LPJ
          </button>
        `;
      }
      if (canManageLpj) {
        btns += `
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); navigateToLpjEditor(${p.id})" title="Ubah atau lengkapi laporan LPJ &amp; berkas nota">
            <i class="ti ti-edit"></i> Edit LPJ
          </button>
        `;
      }
      roleActionBtn = btns;
    } else if (p.status === 'SELESAI' && canManageLpj) {
      roleActionBtn = `
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); navigateToLpjEditor(${p.id})" title="Buka dan tinjau berkas LPJ yang telah disahkan">
          <i class="ti ti-file-check"></i> Rincian LPJ
        </button>
      `;
    }

    let printActionBtn = '';
    if (p.status === 'DISETUJUI' || p.status === 'DICAIRKAN' || p.status === 'MENUNGGU_VERIFIKASI_LPJ' || p.status === 'SELESAI') {
      printActionBtn = `
        <a href="/cetak/${p.id}" target="_blank" class="btn-print-action" onclick="event.stopPropagation()" title="Cetak Lembar Disposisi &amp; RAB">
          <i class="ti ti-printer"></i> Disposisi
        </a>
      `;
      if (p.status === 'MENUNGGU_VERIFIKASI_LPJ' || p.status === 'SELESAI') {
        printActionBtn += `
          <a href="/cetak-lpj/${p.id}" target="_blank" class="btn-print-action" onclick="event.stopPropagation()" style="color:#047857; border-color:#a7f3d0; background:#ecfdf5; margin-left:4px;" title="Cetak Laporan Pertanggungjawaban (LPJ)">
            <i class="ti ti-file-certificate"></i> LPJ
          </a>
          <a href="/cetak-lpj-bundel/${p.id}" target="_blank" class="btn-print-action" onclick="event.stopPropagation()" style="color:#1d4ed8; border-color:#bfdbfe; background:#eff6ff; margin-left:4px;" title="Cetak Bundel Lengkap LPJ (Cover, Kwitansi, LPJ, Slip, Daftar Hadir, Foto, Nota)">
            <i class="ti ti-printer"></i> Bundel LPJ
          </a>
        `;
      } else if (p.status === 'DICAIRKAN') {
        printActionBtn += `
          <a href="/cetak-lpj-bundel/${p.id}" target="_blank" class="btn-print-action" onclick="event.stopPropagation()" style="color:#1d4ed8; border-color:#bfdbfe; background:#eff6ff; margin-left:4px;" title="Cetak Bundel Berkas Kwitansi Komite &amp; Pencairan Kas">
            <i class="ti ti-printer"></i> Kwitansi / Bundel
          </a>
        `;
      }
    }

    let deleteProposalBtn = '';
    if (canUserDelete()) {
      deleteProposalBtn = `
        <button class="btn btn-outline-danger btn-sm" onclick="event.stopPropagation(); handleDeleteProposal(${p.id}, '${escapeHtml(p.nama_kegiatan)}')" title="Hapus Usulan Kegiatan">
          <i class="ti ti-trash"></i> Hapus
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

    let statusThemeClass = '';
    if (['MENUNGGU_REVIEW', 'MENUNGGU_PERSETUJUAN_KEPSEK', 'PERLU_REVISI'].includes(p.status)) {
      statusThemeClass = 'status-review';
    } else if (p.status === 'DISETUJUI') {
      statusThemeClass = 'status-siap-cair';
    } else if (['DICAIRKAN', 'MENUNGGU_VERIFIKASI_LPJ'].includes(p.status)) {
      statusThemeClass = 'status-dicairkan';
    } else if (p.status === 'SELESAI') {
      statusThemeClass = 'status-selesai';
    }

    const card = document.createElement('div');
    card.className = `proposal-item-card ${statusThemeClass}`;
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
        <div style="font-size: 0.75rem; color: var(--text-subtle); display: flex; align-items: center; gap: 4px;">
          <i class="ti ti-calendar" style="font-size: 0.85rem;"></i> Diajukan: ${p.created_at}
        </div>
        <div>
          <span style="font-size: 0.72rem; color: var(--text-muted); margin-right: 4px;">Nominal Usulan:</span>
          <span class="proposal-cost-val">${formatRupiah(p.total_dana_disetujui || p.total_dana_diajukan)}</span>
        </div>
      </div>

      <div class="proposal-actions-row">
        ${roleActionBtn}
        ${printActionBtn}
        ${deleteProposalBtn}
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
        if (p.status === 'DICAIRKAN' || p.status === 'MENUNGGU_VERIFIKASI_LPJ' || p.status === 'SELESAI') {
          const metodeStr = p.metode_pencairan === 'TRANSFER_BANK'
            ? `Transfer Bank ${p.bank_tujuan || ''} (No. Rek: ${p.nomor_rekening || '-'}, Ref: ${p.nomor_referensi_transfer || '-'})`
            : 'Kas Tunai Langsung';

          const buktiTfHtml = p.file_bukti_transfer_url
            ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #a7f3d0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                 <div style="display: flex; align-items: center; gap: 6px;">
                   <span style="font-weight: 700; color: #065f46;">📄 Berkas Bukti Transfer:</span>
                   <a href="${p.file_bukti_transfer_url}" target="_blank" class="btn btn-outline-success btn-xs" style="text-decoration: none; font-weight: 700;">
                     <i class="ti ti-eye"></i> Lihat Slip Bank
                   </a>
                 </div>
                 ${(isBendahara) ? `<button type="button" class="btn btn-secondary btn-xs" onclick="triggerUploadBuktiTransfer(${p.id})"><i class="ti ti-upload"></i> Ganti File Slip</button>` : ''}
               </div>`
            : `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #fca5a5; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; background: #fff1f2; padding: 6px 10px; border-radius: 6px;">
                 <div style="font-size: 0.78rem; color: #991b1b;">
                   <strong>⚠️ Slip Bukti Transfer Bank:</strong> Belum ada scan slip yang dilampirkan.
                 </div>
                 ${(isBendahara) ? `<button type="button" class="btn btn-primary btn-xs" style="background:#059669; border-color:#059669; font-weight:700;" onclick="triggerUploadBuktiTransfer(${p.id})"><i class="ti ti-upload"></i> Unggah Bukti Transfer Sekarang</button>` : ''}
               </div>`;

          bannerCair.style.display = 'block';
          bannerCair.innerHTML = `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 12px 16px; font-size: 0.82rem; color: #065f46;">
              <div style="font-weight: 800; font-size: 0.88rem; margin-bottom: 4px;">💵 REALISASI KAS: TELAH DICAIRKAN RESMI</div>
              <div>Dicairkan pada <strong>${p.tanggal_pencairan || '-'}</strong> via <strong>${metodeStr}</strong> kepada <strong>${p.penerima_dana || p.pemohon_nama}</strong>.</div>
              ${p.catatan_pencairan ? `<div style="font-size: 0.75rem; margin-top: 4px; font-style: italic; color: #047857;">Catatan: "${p.catatan_pencairan}"</div>` : ''}
              ${buktiTfHtml}
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

      if (canUserDelete()) {
        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'btn btn-danger btn-sm';
        btnDelete.style.marginRight = 'auto';
        btnDelete.innerHTML = '<i class="ti ti-trash"></i> Hapus Usulan Ini';
        btnDelete.onclick = () => handleDeleteProposal(p.id, p.nama_kegiatan);
        footer.prepend(btnDelete);
      }

      const isBendahara = currentUser && (currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');
      const isKepsek = currentUser && (currentUser.role === 'KEPALA_SEKOLAH' || currentUser.role === 'ANALISIS_SDM' || currentUser.role === 'ADMIN');
      const isOwnerGuru = currentUser && (currentUser.id === p.user_id || currentUser.role === 'ADMIN');
      const canManageLpj = currentUser && (currentUser.id === p.user_id || currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');

      // Tombol Cetak Dokumen Resmi untuk status yang sudah disahkan / dicairkan
      if (p.status === 'DISETUJUI' || p.status === 'DICAIRKAN' || p.status === 'MENUNGGU_VERIFIKASI_LPJ' || p.status === 'SELESAI') {
        const btnPrint = document.createElement('a');
        btnPrint.className = 'btn btn-secondary btn-sm';
        btnPrint.href = `/cetak/${p.id}`;
        btnPrint.target = '_blank';
        btnPrint.innerHTML = '<i class="ti ti-printer"></i> Cetak Lembar Disposisi (PDF)';
        footer.appendChild(btnPrint);
      }

      if (isBendahara && (p.status === 'MENUNGGU_REVIEW' || p.status === 'PERLU_REVISI')) {
        const btnReview = document.createElement('button');
        btnReview.className = 'btn btn-warning btn-sm';
        btnReview.style.background = '#d97706';
        btnReview.style.borderColor = '#d97706';
        btnReview.style.color = '#fff';
        btnReview.innerHTML = '<i class="ti ti-edit"></i> Buka Modul Telaah & Koreksi';
        btnReview.onclick = () => {
          closeDetailModal();
          openReviewModal(p.id);
        };
        footer.appendChild(btnReview);
      } else if (isKepsek && p.status === 'MENUNGGU_PERSETUJUAN_KEPSEK') {
        const btnKepsek = document.createElement('button');
        btnKepsek.className = 'btn btn-primary btn-sm';
        btnKepsek.innerHTML = '<i class="ti ti-shield-check"></i> Berikan Otorisasi Pengesahan';
        btnKepsek.onclick = () => {
          closeDetailModal();
          openKepsekModal(p.id);
        };
        footer.appendChild(btnKepsek);
      } else if (isBendahara && p.status === 'DISETUJUI') {
        const btnCairkan = document.createElement('button');
        btnCairkan.className = 'btn btn-primary btn-sm';
        btnCairkan.innerHTML = '<i class="ti ti-cash"></i> Cairkan Kas Sekarang';
        btnCairkan.onclick = () => {
          closeDetailModal();
          openCairkanModal(p.id);
        };
        footer.appendChild(btnCairkan);
      } else if (canManageLpj && p.status === 'DICAIRKAN') {
        const btnLpj = document.createElement('button');
        btnLpj.className = 'btn btn-primary btn-sm';
        btnLpj.innerHTML = '<i class="ti ti-file-certificate"></i> Buat Laporan LPJ';
        btnLpj.onclick = () => {
          closeDetailModal();
          navigateToLpjEditor(p.id);
        };
        footer.appendChild(btnLpj);
      } else if (p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
        if (isBendahara) {
          const btnVerifLpj = document.createElement('button');
          btnVerifLpj.className = 'btn btn-warning btn-sm';
          btnVerifLpj.style.background = '#d97706';
          btnVerifLpj.style.borderColor = '#d97706';
          btnVerifLpj.style.color = '#fff';
          btnVerifLpj.innerHTML = '<i class="ti ti-clipboard-check"></i> Verifikasi LPJ Bendahara';
          btnVerifLpj.onclick = () => {
            closeDetailModal();
            openVerifikasiLpjModal(p.id);
          };
          footer.appendChild(btnVerifLpj);
        }
        if (canManageLpj) {
          const btnEditLpj = document.createElement('button');
          btnEditLpj.className = 'btn btn-secondary btn-sm';
          btnEditLpj.innerHTML = '<i class="ti ti-edit"></i> Edit Laporan LPJ';
          btnEditLpj.onclick = () => {
            closeDetailModal();
            navigateToLpjEditor(p.id);
          };
          footer.appendChild(btnEditLpj);
        }
      } else if (p.status === 'SELESAI' && p.lpj) {
        const btnViewLpj = document.createElement('button');
        btnViewLpj.className = 'btn btn-outline-success btn-sm';
        btnViewLpj.innerHTML = '<i class="ti ti-file-check"></i> Lihat Berkas LPJ &amp; Nota';
        btnViewLpj.onclick = () => {
          closeDetailModal();
          openVerifikasiLpjModal(p.id);
        };
        footer.appendChild(btnViewLpj);

        const btnCetakLpj = document.createElement('a');
        btnCetakLpj.className = 'btn btn-outline-success btn-sm';
        btnCetakLpj.href = `/cetak-lpj/${p.id}`;
        btnCetakLpj.target = '_blank';
        btnCetakLpj.innerHTML = '<i class="ti ti-printer"></i> Cetak LPJ Saja';
        footer.appendChild(btnCetakLpj);

        const btnCetakBundel = document.createElement('a');
        btnCetakBundel.className = 'btn btn-primary btn-sm';
        btnCetakBundel.href = `/cetak-lpj-bundel/${p.id}`;
        btnCetakBundel.target = '_blank';
        btnCetakBundel.innerHTML = '<i class="ti ti-book"></i> Cetak Bundel Lengkap LPJ';
        footer.appendChild(btnCetakBundel);
      } else if (p.status === 'DICAIRKAN') {
        const btnCetakBundel = document.createElement('a');
        btnCetakBundel.className = 'btn btn-outline-primary btn-sm';
        btnCetakBundel.href = `/cetak-lpj-bundel/${p.id}`;
        btnCetakBundel.target = '_blank';
        btnCetakBundel.innerHTML = '<i class="ti ti-book"></i> Pratinjau Kwitansi / Bundel';
        footer.appendChild(btnCetakBundel);
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
          <input type="text" inputmode="numeric" class="form-input review-harga rupiah-input" value="${hargaDefault ? Number(hargaDefault).toLocaleString('id-ID') : '0'}" oninput="formatCurrencyInput(this); recalculateReviewTotal()">
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
    const harga = parseRupiahInput(card.querySelector('.review-harga').value);
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
    const harga_satuan_disetujui = parseRupiahInput(card.querySelector('.review-harga').value);
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
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Telaah Disimpan!',
          text: data.message,
          confirmButtonColor: '#059669',
          timer: 3000
        });
      } else {
        showNotification(`✨ ${data.message}`);
      }
      await loadSummaryStats();
      await loadPosAnggaran();
      await loadProposalsList();
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memproses Telaah',
          text: data.message || 'Gagal memproses review bendahara.',
          confirmButtonColor: '#059669'
        });
      } else {
        alert(data.message || 'Gagal memproses review bendahara.');
      }
    }
  } catch (err) {
    console.error('Error submitting review:', err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Koneksi',
        text: 'Terjadi kesalahan koneksi atau server.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Terjadi kesalahan koneksi.');
    }
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
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Keputusan Disimpan!',
          text: data.message,
          confirmButtonColor: '#059669',
          timer: 3000
        });
      } else {
        showNotification(`🏛️ ${data.message}`);
      }
      await loadSummaryStats();
      await loadPosAnggaran();
      await loadProposalsList();
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Otorisasi',
          text: data.message || 'Gagal memproses otorisasi Kepala Sekolah.',
          confirmButtonColor: '#059669'
        });
      } else {
        alert(data.message || 'Gagal memproses otorisasi Kepala Sekolah.');
      }
    }
  } catch (err) {
    console.error('Error submitting kepsek decision:', err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Jaringan',
        text: 'Terjadi kesalahan jaringan atau server saat memproses otorisasi.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Terjadi kesalahan koneksi.');
    }
  }
}

function closeKepsekModal() {
  document.getElementById('modalApprovalKepsek').classList.remove('active');
  activeKepsekProposal = null;
}

// --- 6. Add / Edit Pos Anggaran Modal (From Phase 1) ---

function populateParentGroupDropdown() {
  const select = document.getElementById('selectParentGroup');
  if (!select) return;
  select.innerHTML = '';

  const groupsMap = new Map();
  currentPosList.forEach(item => {
    const kKode = item.kode_kelompok || (item.kode_rekening ? item.kode_rekening.split('.').slice(0, 3).join('.') : null);
    if (kKode && !groupsMap.has(kKode)) {
      groupsMap.set(kKode, {
        no: item.no_kelompok || 999,
        kode: kKode,
        nama: item.nama_kelompok || item.nama_pos,
        snp: item.snp || 'Standar Proses',
        program_induk: item.program_induk || '',
        existingCodes: []
      });
    }
    if (kKode && item.kode_rekening) {
      groupsMap.get(kKode).existingCodes.push(item.kode_rekening.trim());
    }
  });

  // Urutkan berdasarkan no_kelompok
  const sorted = Array.from(groupsMap.values()).sort((a, b) => a.no - b.no);
  sorted.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.kode;
    opt.textContent = `[${g.kode}] ${g.nama}`;
    opt.dataset.no = g.no;
    opt.dataset.nama = g.nama;
    opt.dataset.snp = g.snp;
    opt.dataset.program = g.program_induk;
    opt.dataset.codes = JSON.stringify(g.existingCodes);
    select.appendChild(opt);
  });
}

function handleParentGroupSelected() {
  const select = document.getElementById('selectParentGroup');
  if (!select || !select.selectedOptions || select.selectedOptions.length === 0) return;
  const opt = select.selectedOptions[0];

  const snp = opt.dataset.snp || 'Standar Proses';
  const program = opt.dataset.program || '';
  const baseCode = opt.value; // e.g. "03.03.04"

  const snpSelect = document.getElementById('selectSnp');
  if (snpSelect) snpSelect.value = snp;

  const progInput = document.getElementById('inputProgramInduk');
  if (progInput) progInput.value = program;

  // Hitung nomor rincian sub-kegiatan berikutnya (.01, .02, dst.)
  let existingCodes = [];
  try {
    existingCodes = JSON.parse(opt.dataset.codes || '[]');
  } catch (e) {
    existingCodes = [];
  }

  let maxSubNum = 0;
  existingCodes.forEach(c => {
    if (c.startsWith(baseCode + '.')) {
      const subPart = c.substring(baseCode.length + 1);
      const num = parseInt(subPart, 10);
      if (!isNaN(num) && num > maxSubNum) {
        maxSubNum = num;
      }
    }
  });

  const nextSubNum = String(maxSubNum + 1).padStart(2, '0');
  const suggestedCode = `${baseCode}.${nextSubNum}`;

  const kodeInput = document.getElementById('inputKodeRekening');
  if (kodeInput) kodeInput.value = suggestedCode;
}

function handlePosStructureTypeChange() {
  const isSub = document.getElementById('typeSub').checked;
  const groupSelectWrapper = document.getElementById('groupSelectWrapper');
  const newParentFieldsWrap = document.getElementById('newParentFieldsWrap');
  const labelSub = document.getElementById('labelTypeSub');
  const labelParent = document.getElementById('labelTypeParent');
  const hint = document.getElementById('posTypeHint');

  if (labelSub) labelSub.classList.toggle('active', isSub);
  if (labelParent) labelParent.classList.toggle('active', !isSub);

  if (isSub) {
    if (groupSelectWrapper) groupSelectWrapper.style.display = 'block';
    if (newParentFieldsWrap) newParentFieldsWrap.style.display = 'none';
    if (hint) hint.innerHTML = '💡 <strong>Sub-Kegiatan:</strong> Kode rekening anak otomatis menginduk ke folder kelompok yang Anda pilih.';
    handleParentGroupSelected();
  } else {
    if (groupSelectWrapper) groupSelectWrapper.style.display = 'none';
    if (newParentFieldsWrap) newParentFieldsWrap.style.display = 'block';
    if (hint) hint.innerHTML = '✨ <strong>Kelompok Induk Baru:</strong> Masukkan nama folder induk dan kode 3 blok (misal: <code>03.03.36</code>).';

    // Cari no_kelompok tertinggi + 1 untuk saran kode baru
    let maxNo = 0;
    currentPosList.forEach(p => {
      if (p.no_kelompok && p.no_kelompok > maxNo) maxNo = p.no_kelompok;
    });
    const nextGroupNo = String(maxNo + 1).padStart(2, '0');
    const inputKodeKel = document.getElementById('inputKodeKelompokBaru');
    if (inputKodeKel && !inputKodeKel.value) {
      inputKodeKel.value = `03.03.${nextGroupNo}`;
    }
    const inputKodeRek = document.getElementById('inputKodeRekening');
    if (inputKodeRek && inputKodeKel) {
      inputKodeRek.value = `${inputKodeKel.value}.01`;
    }
  }
}

function openAddPosModal() {
  if (currentUser && currentUser.role === 'GURU') {
    alert('Akses Ditolak: Akun Guru tidak memiliki wewenang untuk menambahkan pos anggaran. Hanya Bendahara, Kepala Sekolah, dan Analisis SDM yang berhak mengatur pagu anggaran sekolah.');
    return;
  }
  document.getElementById('modalPosTitle').textContent = 'Tambah Pos Anggaran Baru';
  document.getElementById('formPosAnggaran').reset();
  document.getElementById('posIdInput').value = '';

  const deleteBtnWrap = document.getElementById('modalPosDeleteBtnWrap');
  if (deleteBtnWrap) deleteBtnWrap.innerHTML = '';

  const selectorWrap = document.getElementById('posTypeSelectorWrap');
  if (selectorWrap) selectorWrap.style.display = 'block';

  document.getElementById('typeSub').checked = true;
  document.getElementById('inputVolume').value = '1';
  document.getElementById('inputSatuan').value = 'kegiatan';
  document.getElementById('inputTahunAjaran').value = '2026/2027';

  populateParentGroupDropdown();
  handlePosStructureTypeChange();

  document.getElementById('modalPos').classList.add('active');
}

function openEditPosModal(id) {
  if (!canUserManagePagu()) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Perubahan pagu anggaran hanya dapat dilakukan oleh Analisis SDM Aparatur dan Kepala Sekolah.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Akses Ditolak: Perubahan pagu anggaran hanya dapat dilakukan oleh Analisis SDM Aparatur dan Kepala Sekolah.');
    }
    return;
  }
  const item = currentPosList.find(p => p.id === id);
  if (!item) return;

  document.getElementById('modalPosTitle').textContent = 'Ubah Plafon Pos Anggaran';
  document.getElementById('posIdInput').value = item.id;

  const deleteBtnWrap = document.getElementById('modalPosDeleteBtnWrap');
  if (deleteBtnWrap) {
    if (canUserDelete()) {
      deleteBtnWrap.innerHTML = `
        <button type="button" class="btn btn-danger btn-sm" onclick="handleDeletePosAnggaran(${item.id}, '${escapeHtml(item.nama_pos)}')">
          <i class="ti ti-trash"></i> Hapus Pos Ini
        </button>
      `;
    } else {
      deleteBtnWrap.innerHTML = '';
    }
  }

  // Sembunyikan toggle tipe saat edit pos yang sudah ada
  const selectorWrap = document.getElementById('posTypeSelectorWrap');
  if (selectorWrap) selectorWrap.style.display = 'none';
  const groupSelectWrapper = document.getElementById('groupSelectWrapper');
  if (groupSelectWrapper) groupSelectWrapper.style.display = 'none';
  const newParentFieldsWrap = document.getElementById('newParentFieldsWrap');
  if (newParentFieldsWrap) newParentFieldsWrap.style.display = 'none';

  document.getElementById('inputKodeRekening').value = item.kode_rekening || '';
  document.getElementById('selectSnp').value = item.snp || 'Standar Proses';
  document.getElementById('inputProgramInduk').value = item.program_induk || '';
  document.getElementById('inputNamaPos').value = item.nama_pos;
  document.getElementById('inputVolume').value = item.volume || 1;
  document.getElementById('inputSatuan').value = item.satuan || 'kegiatan';
  document.getElementById('inputTahunAjaran').value = item.tahun_ajaran;
  document.getElementById('inputPaguAwal').value = item.pagu_awal ? Number(item.pagu_awal).toLocaleString('id-ID') : '0';
  document.getElementById('inputKeterangan').value = item.keterangan || '';

  document.getElementById('modalPos').classList.add('active');
}

function closePosModal() {
  document.getElementById('modalPos').classList.remove('active');
}

async function handleSavePosAnggaran(e) {
  e.preventDefault();
  if (currentUser && currentUser.role === 'GURU') {
    alert('Akses Ditolak: Akun Guru tidak memiliki wewenang untuk menyimpan pos anggaran.');
    return;
  }

  const id = document.getElementById('posIdInput').value;
  let payload = {
    kode_rekening: document.getElementById('inputKodeRekening').value.trim(),
    snp: document.getElementById('selectSnp').value,
    program_induk: document.getElementById('inputProgramInduk').value.trim(),
    nama_pos: document.getElementById('inputNamaPos').value.trim(),
    volume: Number(document.getElementById('inputVolume').value) || 1,
    satuan: document.getElementById('inputSatuan').value.trim() || 'kegiatan',
    pagu_awal: parseRupiahInput(document.getElementById('inputPaguAwal').value),
    tahun_ajaran: document.getElementById('inputTahunAjaran').value.trim(),
    keterangan: document.getElementById('inputKeterangan').value.trim()
  };

  if (!id) {
    const isSub = document.getElementById('typeSub').checked;
    if (isSub) {
      const selectGroup = document.getElementById('selectParentGroup');
      if (selectGroup && selectGroup.selectedOptions && selectGroup.selectedOptions.length > 0) {
        const opt = selectGroup.selectedOptions[0];
        payload.no_kelompok = Number(opt.dataset.no);
        payload.kode_kelompok = opt.value;
        payload.nama_kelompok = opt.dataset.nama;
      }
    } else {
      const namaKelBaru = (document.getElementById('inputNamaKelompokBaru').value || '').trim();
      const kodeKelBaru = (document.getElementById('inputKodeKelompokBaru').value || '').trim();
      if (namaKelBaru) payload.nama_kelompok = namaKelBaru;
      if (kodeKelBaru) payload.kode_kelompok = kodeKelBaru;
    }
  }

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
      await loadSummaryStats();
      await loadPosAnggaran();
    } else {
      alert(data.message || 'Gagal menyimpan');
    }
  } catch (err) {
    console.error('Error saving pos anggaran:', err);
  }
}

// Toast Notification (SweetAlert2 dengan Fallback Native)
function showNotification(msg, icon = 'success') {
  const toast = getSwalToast();
  if (toast) {
    const cleanMsg = String(msg).replace(/^[✓✨🏛️🎉✅]\s*/, '');
    toast.fire({
      icon: icon,
      title: cleanMsg
    });
    return;
  }

  const toastEl = document.createElement('div');
  toastEl.style.cssText = `
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
  toastEl.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
    <span>${msg}</span>
  `;
  document.body.appendChild(toastEl);
  setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toastEl.remove(), 400);
  }, 3000);
}

// ==========================================================================
// FASE 4: LOGIKA MODUL PENCAIRAN KAS (CASH DISBURSEMENT)
// ==========================================================================

let activeCairkanProposal = null;
let selectedCairkanTransferFile = null;

function handleCairkanFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedCairkanTransferFile = file;
  const wrap = document.getElementById('cairkanBuktiTransferPreviewWrap');
  const nameSpan = document.getElementById('cairkanBuktiTransferFileName');
  if (wrap && nameSpan) {
    wrap.style.display = 'flex';
    nameSpan.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }
}

function clearCairkanFile(event) {
  if (event) event.stopPropagation();
  selectedCairkanTransferFile = null;
  const input = document.getElementById('cairkanBuktiTransferFile');
  if (input) input.value = '';
  const wrap = document.getElementById('cairkanBuktiTransferPreviewWrap');
  if (wrap) wrap.style.display = 'none';
}

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

      // Kode Kwitansi & Bukti Transfer
      const elKode = document.getElementById('cairkanNomorKodeKwitansi');
      if (elKode) elKode.value = p.nomor_kode_kwitansi || '7';
      selectedCairkanTransferFile = null;
      const wrapTf = document.getElementById('cairkanBuktiTransferPreviewWrap');
      const nameTf = document.getElementById('cairkanBuktiTransferFileName');
      if (p.file_bukti_transfer_url && wrapTf && nameTf) {
        wrapTf.style.display = 'flex';
        nameTf.textContent = p.file_bukti_transfer_url.split('/').pop();
      } else if (wrapTf) {
        wrapTf.style.display = 'none';
      }

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
  selectedCairkanTransferFile = null;
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
  const nomor_kode_kwitansi = document.getElementById('cairkanNomorKodeKwitansi')?.value.trim() || '7';

  const formData = new FormData();
  formData.append('metode_pencairan', metode_pencairan);
  formData.append('bank_tujuan', bank_tujuan);
  formData.append('nomor_rekening', nomor_rekening);
  formData.append('nomor_referensi_transfer', nomor_referensi_transfer);
  formData.append('penerima_dana', penerima_dana);
  formData.append('tanggal_pencairan', tanggal_pencairan);
  formData.append('catatan_pencairan', catatan_pencairan);
  formData.append('nomor_kode_kwitansi', nomor_kode_kwitansi);

  if (selectedCairkanTransferFile) {
    formData.append('file_bukti_transfer', selectedCairkanTransferFile);
  }

  try {
    const res = await fetch(`/api/pengajuan/${id}/cairkan`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      closeCairkanModal();
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Kas Berhasil Dicairkan!',
          html: `
            <p>${data.message}</p>
            <div style="margin-top: 14px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <a href="/cetak-lpj-bundel/${id}" target="_blank" class="btn btn-outline-primary" style="font-size: 0.85rem; padding: 6px 12px; text-decoration: none;">
                📑 Cetak Bundel Kwitansi &amp; Dokumen
              </a>
            </div>
          `,
          confirmButtonColor: '#059669',
          confirmButtonText: 'Tutup'
        });
      } else {
        showNotification(`✓ ${data.message}`);
      }
      loadSummaryStats();
      loadPosAnggaran();
      loadProposalsList();
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Mencairkan Kas',
          text: data.message,
          confirmButtonColor: '#059669'
        });
      } else {
        alert(`Gagal mencairkan kas: ${data.message}`);
      }
    }
  } catch (err) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Jaringan',
        text: `Terjadi kesalahan saat mencairkan kas: ${err.message}`,
        confirmButtonColor: '#059669'
      });
    } else {
      alert(`Terjadi kesalahan jaringan saat mencairkan kas: ${err.message}`);
    }
  }
}

// Upload / Perbarui Bukti Transfer Kas Langsung (Untuk Usulan yang Sudah Dicairkan)
let activeUploadTransferProposalId = null;

function triggerUploadBuktiTransfer(proposalId) {
  activeUploadTransferProposalId = proposalId;
  let fileInput = document.getElementById('hiddenUploadTransferInput');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'hiddenUploadTransferInput';
    fileInput.accept = 'image/*,application/pdf';
    fileInput.style.display = 'none';
    fileInput.onchange = handleUploadTransferFileDirect;
    document.body.appendChild(fileInput);
  }
  fileInput.click();
}

async function handleUploadTransferFileDirect(e) {
  const file = e.target.files[0];
  if (!file || !activeUploadTransferProposalId) return;

  const id = activeUploadTransferProposalId;
  const formData = new FormData();
  formData.append('file_bukti_transfer', file);

  try {
    showNotification('Mengunggah bukti transfer kas...');
    const res = await fetch(`/api/pengajuan/${id}/bukti-transfer`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Bukti Transfer Berhasil Disimpan!',
          html: `<p>${data.message}</p><p style="font-size:0.8rem; color:#64748b; margin-top:8px;">Halaman Lampiran Bukti Transfer di Bundel LPJ kini telah terlampir resmi.</p>`,
          confirmButtonColor: '#059669'
        });
      } else {
        showNotification(`✓ ${data.message}`);
      }
      loadProposalsList();
      openProposalDetail(id);
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Mengunggah',
          text: data.message,
          confirmButtonColor: '#ef4444'
        });
      } else {
        alert(data.message || 'Gagal mengunggah bukti transfer.');
      }
    }
  } catch (err) {
    console.error('Error uploading transfer proof:', err);
    alert('Terjadi kesalahan saat mengunggah bukti transfer.');
  } finally {
    e.target.value = '';
    activeUploadTransferProposalId = null;
  }
}

// ==========================================================================
// FASE 5: MODUL LPJ (LAPORAN PERTANGGUNGJAWABAN) & REKONSILIASI KAS
// ==========================================================================

// State Editor Halaman Penuh LPJ
let activeLpjProposal = null;
let selectedEditorMasterFile = null;
let selectedEditorDaftarHadirFile = null;
let editorReceiptRows = [];
let nextEditorReceiptId = 1;
let editorFotoRows = [];
let nextEditorFotoId = 1;

// Kompatibilitas mundur modal
function openSubmitLpjModal(proposalId) {
  navigateToLpjEditor(proposalId);
}
function closeSubmitLpjModal() {
  goBackFromLpjEditor();
}

/**
 * Navigasi ke Halaman Editor LPJ Terpisah
 */
async function navigateToLpjEditor(proposalId) {
  if (typeof switchView === 'function') {
    switchView('formLpj');
  } else {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('viewFormLpj');
    if (v) v.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const res = await fetch(`/api/pengajuan/${proposalId}`);
    const data = await res.json();
    if (!data.success || !data.data) {
      showNotification('Gagal memuat rincian usulan untuk LPJ');
      return;
    }

    const p = data.data;
    activeLpjProposal = p;

    // Reset Form
    const elId = document.getElementById('editorLpjProposalId');
    if (elId) elId.value = p.id;
    const elNomor = document.getElementById('editorLpjNomorSurat');
    if (elNomor) elNomor.textContent = p.nomor_surat_ajuan;
    const elNama = document.getElementById('editorLpjNamaKegiatan');
    if (elNama) elNama.textContent = p.nama_kegiatan;
    const elSub = document.getElementById('editorLpjSubHeader');
    if (elSub) elSub.textContent = `Pemohon: ${p.pemohon_nama} (${p.pemohon_unit}) • Pos Anggaran: ${p.nama_pos}`;
    const elCair = document.getElementById('editorLpjTotalDanaCairDisplay');
    if (elCair) elCair.textContent = formatRupiah(p.total_dana_disetujui);

    // Setup tombol cetak langsung
    const btnCetakTop = document.getElementById('btnEditorCetakLpj');
    const btnCetakBottom = document.getElementById('btnEditorCetakLpjBottom');
    [btnCetakTop, btnCetakBottom].forEach(btn => {
      if (btn) {
        btn.href = `/cetak-lpj/${p.id}`;
        btn.style.display = p.lpj ? 'inline-flex' : 'none';
      }
    });

    const btnBundelTop = document.getElementById('btnEditorCetakLpjBundel');
    const btnBundelBottom = document.getElementById('btnEditorCetakLpjBundelBottom');
    [btnBundelTop, btnBundelBottom].forEach(btn => {
      if (btn) {
        btn.href = `/cetak-lpj-bundel/${p.id}`;
        btn.style.display = p.lpj ? 'inline-flex' : 'none';
      }
    });

    // Tampilkan Referensi Rincian Item RAB Disetujui
    const refBox = document.getElementById('editorLpjApprovedItemsRefBox');
    const refList = document.getElementById('editorLpjApprovedItemsList');
    if (refBox && refList) {
      if (p.items && p.items.length > 0) {
        refBox.style.display = 'block';
        refList.innerHTML = p.items.map(it => {
          const vol = it.volume_disetujui || it.volume_diajukan;
          const sat = it.satuan_disetujui || it.satuan_diajukan;
          const sub = it.subtotal_disetujui || it.subtotal_diajukan;
          return `
            <div class="lpj-ref-badge-item" title="${escapeHtml(it.spesifikasi || '')}">
              <span>${escapeHtml(it.nama_item)}</span>
              <span style="color:var(--text-muted);">(${vol} ${sat})</span>
              <strong>${formatRupiah(sub)}</strong>
            </div>
          `;
        }).join('');
      } else {
        refBox.style.display = 'none';
      }
    }

    // Reset Data Repeater
    editorReceiptRows = [];
    nextEditorReceiptId = 1;
    editorFotoRows = [];
    nextEditorFotoId = 1;
    selectedEditorMasterFile = null;
    selectedEditorDaftarHadirFile = null;
    clearEditorDaftarHadir();

    const receiptStack = document.getElementById('editorLpjNotaStack');
    if (receiptStack) receiptStack.innerHTML = '';
    const fotoStack = document.getElementById('editorLpjFotoStack');
    if (fotoStack) fotoStack.innerHTML = '';

    // Isi Nilai Deskripsi & Resume jika sudah ada LPJ
    if (p.lpj) {
      const elLat = document.getElementById('editorLpjLatarBelakang');
      if (elLat) elLat.value = p.lpj.catatan_lpj || p.latar_belakang || '';
      const elTuj = document.getElementById('editorLpjTujuan');
      if (elTuj) elTuj.value = p.lpj.tujuan_kegiatan || p.tujuan_kegiatan || '';
      const elTem = document.getElementById('editorLpjTempat');
      if (elTem) elTem.value = p.lpj.tempat_pelaksanaan || '';
      const elPes = document.getElementById('editorLpjPeserta');
      if (elPes) elPes.value = p.lpj.jumlah_peserta || '';

      const elRes = document.getElementById('editorLpjResumeHasil');
      if (elRes) elRes.value = p.lpj.resume_hasil || '';
      const elKen = document.getElementById('editorLpjKendala');
      if (elKen) elKen.value = p.lpj.kendala || '';
      const elSol = document.getElementById('editorLpjSolusi');
      if (elSol) elSol.value = p.lpj.solusi_tindak_lanjut || '';
      const elCat = document.getElementById('editorLpjCatatanTambahan');
      if (elCat) elCat.value = p.lpj.catatan_lpj || '';

      // Master PDF file
      if (p.lpj.file_nota_url) {
        const wrap = document.getElementById('editorLpjMasterPreviewWrap');
        const nameSpan = document.getElementById('editorLpjMasterFileName');
        if (wrap && nameSpan) {
          wrap.style.display = 'flex';
          nameSpan.textContent = p.lpj.file_nota_url.split('/').pop();
        }
      } else {
        clearEditorMasterFile();
      }

      // Berkas Daftar Hadir PDF
      if (p.lpj.file_daftar_hadir_url) {
        const wrapDh = document.getElementById('editorLpjDaftarHadirPreviewWrap');
        const nameDh = document.getElementById('editorLpjDaftarHadirFileName');
        if (wrapDh && nameDh) {
          wrapDh.style.display = 'flex';
          nameDh.textContent = p.lpj.file_daftar_hadir_url.split('/').pop();
        }
      } else {
        clearEditorDaftarHadir();
      }

      // Nota Items
      if (p.lpj && p.lpj.nota_items && p.lpj.nota_items.length > 0) {
        p.lpj.nota_items.forEach(it => addEditorReceiptRow(it));
      } else {
        // Otomatis populasi dari rincian RAB usulan
        populateReceiptsFromRab(p);
      }

      // Foto Dokumentasi
      if (p.lpj.foto_dokumentasi && p.lpj.foto_dokumentasi.length > 0) {
        p.lpj.foto_dokumentasi.forEach(ft => addEditorFotoRow(ft));
      } else {
        addEditorFotoRow();
      }
    } else {
      // Usulan Baru Belum Ada LPJ
      const elLat = document.getElementById('editorLpjLatarBelakang');
      if (elLat) elLat.value = p.latar_belakang || '';
      const elTuj = document.getElementById('editorLpjTujuan');
      if (elTuj) elTuj.value = p.tujuan_kegiatan || '';
      const elTem = document.getElementById('editorLpjTempat');
      if (elTem) elTem.value = '';
      const elPes = document.getElementById('editorLpjPeserta');
      if (elPes) elPes.value = '';

      const elRes = document.getElementById('editorLpjResumeHasil');
      if (elRes) elRes.value = '';
      const elKen = document.getElementById('editorLpjKendala');
      if (elKen) elKen.value = '';
      const elSol = document.getElementById('editorLpjSolusi');
      if (elSol) elSol.value = '';
      const elCat = document.getElementById('editorLpjCatatanTambahan');
      if (elCat) elCat.value = '';

      clearEditorMasterFile();

      // Otomatis populasi daftar nota persis sesuai rincian item RAB usulan
      populateReceiptsFromRab(p);

      // Tambahkan default 1 baris foto dokumentasi
      addEditorFotoRow();
    }

    recalculateEditorMultiTotals();
  } catch (err) {
    console.error('Error navigateToLpjEditor:', err);
    showNotification('Terjadi kesalahan memuat data usulan.');
  }
}

function goBackFromLpjEditor() {
  if (typeof switchView === 'function') {
    switchView('riwayat');
  } else {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('viewRiwayat');
    if (v) v.classList.add('active');
  }
}

// --------------------------------------------------------------------------
// Multi-Nota Repeater di Halaman Editor LPJ
// --------------------------------------------------------------------------

function populateReceiptsFromRab(proposal) {
  if (!proposal) return false;
  const items = Array.isArray(proposal.items) ? proposal.items : [];

  const receiptStack = document.getElementById('editorLpjNotaStack');
  if (receiptStack) receiptStack.innerHTML = '';
  editorReceiptRows = [];
  nextEditorReceiptId = 1;

  if (items.length > 0) {
    items.forEach(it => {
      const vol = it.volume_disetujui !== null && it.volume_disetujui !== undefined ? it.volume_disetujui : it.volume_ajuan;
      const sat = it.satuan_disetujui || it.satuan || '';
      const harga = it.harga_satuan_disetujui !== null && it.harga_satuan_disetujui !== undefined ? it.harga_satuan_disetujui : it.harga_satuan_ajuan;
      const sub = it.subtotal_disetujui !== null && it.subtotal_disetujui !== undefined ? it.subtotal_disetujui : (it.subtotal_ajuan || (vol * harga));

      let defaultToko = 'Toko / Rekanan Penyedia';
      const kat = (it.kategori_belanja || '').toLowerCase();
      const nama = (it.deskripsi_item || it.nama_item || '').toLowerCase();
      if (kat.includes('konsumsi') || nama.includes('snack') || nama.includes('makan') || nama.includes('nasi') || nama.includes('minum')) {
        defaultToko = 'Warung Konsumsi & Katering';
      } else if (kat.includes('perlengkapan') || kat.includes('alat') || nama.includes('spanduk') || nama.includes('banner') || nama.includes('cetak')) {
        defaultToko = 'Toko Perlengkapan & Olahraga';
      } else if (kat.includes('jasa') || kat.includes('honor') || nama.includes('honor') || nama.includes('juri') || nama.includes('narasumber')) {
        defaultToko = 'Penerima Honor & Jasa';
      } else if (kat.includes('atk') || nama.includes('kertas') || nama.includes('buku') || nama.includes('alat tulis')) {
        defaultToko = 'Toko ATK & Fotokopi';
      }

      addEditorReceiptRow({
        nama_toko: defaultToko,
        uraian: `${it.deskripsi_item || it.nama_item} (${vol} ${sat})`,
        nominal: sub || 0,
        file_url: null
      });
    });
  } else {
    addEditorReceiptRow({
      nama_toko: 'Nota Pembelian / Rekanan',
      uraian: `Belanja riil kegiatan: ${proposal.nama_kegiatan}`,
      nominal: proposal.total_dana_disetujui || 0,
      file_url: null
    });
  }

  recalculateEditorMultiTotals();
  return true;
}

function confirmResetReceiptsFromRab() {
  if (!activeLpjProposal) return;
  const rabCount = (activeLpjProposal.items || []).length;
  const msg = rabCount > 0
    ? `Muat ulang daftar nota belanja sesuai ${rabCount} item rincian RAB usulan? Uraian dan nominal akan diset persis seperti anggaran RAB (Anda tetap bisa mengedit manual jika nota fisik berbeda).`
    : 'Muat ulang nota belanja sesuai total anggaran usulan?';

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: 'question',
      title: 'Sesuaikan dengan Rincian RAB?',
      text: msg,
      showCancelButton: true,
      confirmButtonText: 'Ya, Sesuaikan dengan RAB',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb'
    }).then(res => {
      if (res.isConfirmed) {
        populateReceiptsFromRab(activeLpjProposal);
        showNotification('Daftar nota belanja berhasil disesuaikan dengan rincian RAB.');
      }
    });
  } else {
    if (confirm(msg)) {
      populateReceiptsFromRab(activeLpjProposal);
      showNotification('Daftar nota belanja berhasil disesuaikan dengan rincian RAB.');
    }
  }
}

function addEditorReceiptRow(data = null) {
  const rowId = nextEditorReceiptId++;
  const rowItem = {
    id: rowId,
    nama_toko: data ? (data.nama_toko || '') : '',
    uraian: data ? (data.uraian || '') : '',
    nominal: data ? (Number(data.nominal) || 0) : 0,
    file: null,
    existing_file_url: data ? (data.file_url || null) : null
  };
  editorReceiptRows.push(rowItem);

  const container = document.getElementById('editorLpjNotaStack');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'lpj-receipt-card';
  card.id = `editorReceiptCard_${rowId}`;

  const rowNum = editorReceiptRows.length;
  const initialNominal = rowItem.nominal ? Number(rowItem.nominal).toLocaleString('id-ID') : '';

  let fileStatusHtml = '';
  if (rowItem.existing_file_url) {
    const filename = rowItem.existing_file_url.split('/').pop();
    fileStatusHtml = `
      <div class="lpj-receipt-preview-chip" id="editorReceiptPreviewChip_${rowId}">
        <span style="font-size: 1rem;">📎</span>
        <span class="file-name" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
        <a href="${rowItem.existing_file_url}" target="_blank" class="btn btn-secondary btn-xs" style="padding: 2px 6px; font-size: 0.68rem;" onclick="event.stopPropagation()">Lihat</a>
        <button type="button" class="btn btn-secondary btn-xs" style="padding: 2px 6px; font-size: 0.68rem; color: var(--rose);" onclick="clearEditorReceiptFile(event, ${rowId})">Ganti</button>
      </div>
    `;
  } else {
    fileStatusHtml = `
      <div class="lpj-receipt-file-picker" id="editorReceiptFilePicker_${rowId}" onclick="document.getElementById('editorReceiptFileInput_${rowId}').click()">
        <span style="font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
          <i class="ti ti-camera" style="font-size: 0.95rem; color: var(--primary);"></i> Foto / PDF Nota
        </span>
        <span class="btn btn-outline-success btn-xs" style="padding: 2px 8px; font-size: 0.7rem; pointer-events: none;">Pilih File</span>
      </div>
      <div class="lpj-receipt-preview-chip" id="editorReceiptPreviewChip_${rowId}" style="display: none;"></div>
    `;
  }

  card.innerHTML = `
    <div class="lpj-receipt-card-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="lpj-receipt-badge" id="editorReceiptBadgeNum_${rowId}">
          <i class="ti ti-receipt"></i> Bukti Nota #${rowNum}
        </span>
        <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-main);" id="editorReceiptSubtitle_${rowId}">
          ${rowItem.nama_toko ? escapeHtml(rowItem.nama_toko) : 'Nota Pembelian / Jasa'}
        </span>
      </div>
      <button type="button" class="btn btn-outline-danger btn-xs" onclick="removeEditorReceiptRow(${rowId})" title="Hapus nota ini" ${editorReceiptRows.length <= 1 ? 'style="display:none;"' : ''} id="btnRemoveEditorReceipt_${rowId}">
        <i class="ti ti-trash"></i> Hapus Nota
      </button>
    </div>

    <div class="lpj-receipt-grid">
      <div>
        <label class="form-label" style="font-size: 0.75rem; font-weight: 700; margin-bottom: 4px;">Nama Toko / Rekanan / Penyedia *</label>
        <input type="text" class="form-input form-input-sm" id="editorReceiptToko_${rowId}" placeholder="Cth: Toko ATK Sahabat, RM Sederhana" value="${escapeHtml(rowItem.nama_toko)}" oninput="updateEditorReceiptMeta(${rowId})">
      </div>
      <div>
        <label class="form-label" style="font-size: 0.75rem; font-weight: 700; margin-bottom: 4px;">Uraian Barang / Jasa pada Nota Ini</label>
        <input type="text" class="form-input form-input-sm" id="editorReceiptUraian_${rowId}" placeholder="Cth: 5 Rim Kertas A4 + 2 Lusin Spidol Snowman" value="${escapeHtml(rowItem.uraian)}" oninput="updateEditorReceiptMeta(${rowId})">
      </div>
    </div>

    <div class="lpj-receipt-grid-bottom">
      <div>
        <label class="form-label" style="font-size: 0.75rem; font-weight: 700; margin-bottom: 4px;">Nominal Realisasi Fisik (Rp) *</label>
        <input type="text" inputmode="numeric" class="form-input form-input-sm rupiah-input" id="editorReceiptNominal_${rowId}" placeholder="Cth: 250.000" value="${initialNominal}" oninput="formatCurrencyInput(this); updateEditorReceiptNominal(${rowId})">
      </div>
      <div>
        <label class="form-label" style="font-size: 0.75rem; font-weight: 700; margin-bottom: 4px;">Unggah Foto / Scan Nota Fisik</label>
        <input type="file" id="editorReceiptFileInput_${rowId}" accept="image/*,application/pdf" style="display: none;" onchange="handleEditorReceiptFileSelect(event, ${rowId})">
        <div id="editorReceiptFileArea_${rowId}">
          ${fileStatusHtml}
        </div>
      </div>
    </div>
  `;

  container.appendChild(card);
  updateEditorReceiptRemoveButtons();
  recalculateEditorMultiTotals();
}

function removeEditorReceiptRow(rowId) {
  if (editorReceiptRows.length <= 1) return;
  editorReceiptRows = editorReceiptRows.filter(r => r.id !== rowId);
  const card = document.getElementById(`editorReceiptCard_${rowId}`);
  if (card) card.remove();

  editorReceiptRows.forEach((r, idx) => {
    const badge = document.getElementById(`editorReceiptBadgeNum_${r.id}`);
    if (badge) badge.innerHTML = `<i class="ti ti-receipt"></i> Bukti Nota #${idx + 1}`;
  });

  updateEditorReceiptRemoveButtons();
  recalculateEditorMultiTotals();
}

function updateEditorReceiptRemoveButtons() {
  const show = editorReceiptRows.length > 1;
  editorReceiptRows.forEach(r => {
    const btn = document.getElementById(`btnRemoveEditorReceipt_${r.id}`);
    if (btn) btn.style.display = show ? 'inline-flex' : 'none';
  });
}

function updateEditorReceiptMeta(rowId) {
  const row = editorReceiptRows.find(r => r.id === rowId);
  if (!row) return;
  const tokoInput = document.getElementById(`editorReceiptToko_${rowId}`);
  const uraianInput = document.getElementById(`editorReceiptUraian_${rowId}`);
  if (tokoInput) {
    row.nama_toko = tokoInput.value.trim();
    const sub = document.getElementById(`editorReceiptSubtitle_${rowId}`);
    if (sub) sub.textContent = row.nama_toko || 'Nota Pembelian / Jasa';
  }
  if (uraianInput) row.uraian = uraianInput.value.trim();
}

function updateEditorReceiptNominal(rowId) {
  const row = editorReceiptRows.find(r => r.id === rowId);
  if (!row) return;
  const nominalInput = document.getElementById(`editorReceiptNominal_${rowId}`);
  row.nominal = nominalInput ? parseRupiahInput(nominalInput.value) : 0;
  recalculateEditorMultiTotals();
}

function handleEditorReceiptFileSelect(event, rowId) {
  const file = event.target.files[0];
  if (!file) return;

  const row = editorReceiptRows.find(r => r.id === rowId);
  if (!row) return;
  row.file = file;

  const area = document.getElementById(`editorReceiptFileArea_${rowId}`);
  if (area) {
    area.innerHTML = `
      <div class="lpj-receipt-preview-chip" id="editorReceiptPreviewChip_${rowId}">
        <span style="font-size: 1rem;">📎</span>
        <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span style="font-size:0.68rem; color:var(--text-muted);">(${Math.round(file.size / 1024)} KB)</span>
        <button type="button" class="btn btn-secondary btn-xs" style="padding: 2px 6px; font-size: 0.68rem; color: var(--rose); margin-left:auto;" onclick="clearEditorReceiptFile(event, ${rowId})">✕ Hapus</button>
      </div>
    `;
  }
}

function clearEditorReceiptFile(event, rowId) {
  if (event) event.stopPropagation();
  const row = editorReceiptRows.find(r => r.id === rowId);
  if (!row) return;
  row.file = null;
  row.existing_file_url = null;

  const input = document.getElementById(`editorReceiptFileInput_${rowId}`);
  if (input) input.value = '';

  const area = document.getElementById(`editorReceiptFileArea_${rowId}`);
  if (area) {
    area.innerHTML = `
      <div class="lpj-receipt-file-picker" id="editorReceiptFilePicker_${rowId}" onclick="document.getElementById('editorReceiptFileInput_${rowId}').click()">
        <span style="font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
          <i class="ti ti-camera" style="font-size: 0.95rem; color: var(--primary);"></i> Foto / PDF Nota
        </span>
        <span class="btn btn-outline-success btn-xs" style="padding: 2px 8px; font-size: 0.7rem; pointer-events: none;">Pilih File</span>
      </div>
      <div class="lpj-receipt-preview-chip" id="editorReceiptPreviewChip_${rowId}" style="display: none;"></div>
    `;
  }
}

function recalculateEditorMultiTotals() {
  const totalBelanja = editorReceiptRows.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  const display = document.getElementById('editorLpjTotalBelanjaDisplay');
  const hiddenInput = document.getElementById('editorLpjTotalBelanja');
  if (display) display.textContent = formatRupiah(totalBelanja);
  if (hiddenInput) hiddenInput.value = totalBelanja;
  recalculateEditorCashback();
}

function recalculateEditorCashback() {
  if (!activeLpjProposal) return;

  const danaCair = activeLpjProposal.total_dana_disetujui || 0;
  const inputEl = document.getElementById('editorLpjTotalBelanja');
  const belanjaRiil = inputEl ? Number(inputEl.value) || 0 : 0;
  const selisih = danaCair - belanjaRiil;

  const box = document.getElementById('editorLpjCashbackBox');
  const title = document.getElementById('editorLpjCashbackTitle');
  const val = document.getElementById('editorLpjCashbackVal');
  const desc = document.getElementById('editorLpjCashbackDesc');

  if (!box || !title || !val || !desc) return;

  box.className = 'lpj-calc-box';

  if (selisih > 0) {
    box.classList.add('refund');
    title.textContent = '💵 Sisa Kas yang Wajib Disetor Kembali ke Bendahara Sekolah';
    val.textContent = formatRupiah(selisih);
    desc.textContent = `Terdapat kelebihan kas sebesar ${formatRupiah(selisih)}. Dana sisa ini wajib disetor tunai/transfer ke Bendahara dan akan otomatis mengembalikan saldo kuota pos anggaran sekolah.`;
  } else if (selisih === 0) {
    box.classList.add('exact');
    title.textContent = '✓ Realisasi Belanja Tepat 100%';
    val.textContent = 'Rp 0';
    desc.textContent = 'Total pengeluaran riil sesuai persis dengan nominal pencairan dana. Tidak ada sisa kas pengembalian.';
  } else {
    box.classList.add('over');
    title.textContent = '⚠️ Realisasi Melebihi Kas Dicairkan (Talangan Mandiri)';
    val.textContent = formatRupiah(Math.abs(selisih));
    desc.textContent = `Belanja riil melebihi dana kas yang dicairkan sebesar ${formatRupiah(Math.abs(selisih))}. Kelebihan belanja ini ditanggung secara mandiri sesuai kesepakatan sekolah.`;
  }
}

// Master File (Bundel PDF)
function handleEditorMasterFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedEditorMasterFile = file;

  const wrap = document.getElementById('editorLpjMasterPreviewWrap');
  const nameSpan = document.getElementById('editorLpjMasterFileName');

  if (wrap && nameSpan) {
    wrap.style.display = 'flex';
    nameSpan.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }
}

function clearEditorMasterFile(event) {
  if (event) event.stopPropagation();
  selectedEditorMasterFile = null;

  const input = document.getElementById('editorLpjMasterFileInput');
  if (input) input.value = '';

  const wrap = document.getElementById('editorLpjMasterPreviewWrap');
  if (wrap) {
    wrap.style.display = 'none';
  }
}

// Berkas Daftar Hadir (PDF)
function handleEditorDaftarHadirSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedEditorDaftarHadirFile = file;

  const wrap = document.getElementById('editorLpjDaftarHadirPreviewWrap');
  const nameSpan = document.getElementById('editorLpjDaftarHadirFileName');

  if (wrap && nameSpan) {
    wrap.style.display = 'flex';
    nameSpan.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }
}

function clearEditorDaftarHadir(event) {
  if (event) event.stopPropagation();
  selectedEditorDaftarHadirFile = null;

  const input = document.getElementById('editorLpjDaftarHadirInput');
  if (input) input.value = '';

  const wrap = document.getElementById('editorLpjDaftarHadirPreviewWrap');
  if (wrap) {
    wrap.style.display = 'none';
  }
}

// --------------------------------------------------------------------------
// Dokumentasi Foto Kegiatan di Halaman Editor LPJ
// --------------------------------------------------------------------------

function addEditorFotoRow(data = null) {
  const fotoId = nextEditorFotoId++;
  const fotoItem = {
    id: fotoId,
    keterangan: data ? (data.keterangan || '') : '',
    file: null,
    existing_file_url: data ? (data.file_url || null) : null
  };
  editorFotoRows.push(fotoItem);

  const container = document.getElementById('editorLpjFotoStack');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'lpj-foto-card';
  card.id = `editorFotoCard_${fotoId}`;

  const initialPreview = fotoItem.existing_file_url
    ? `<img src="${fotoItem.existing_file_url}" alt="Dokumentasi" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`
    : `<div style="text-align:center; color:var(--text-muted); padding:10px;"><i class="ti ti-camera" style="font-size:1.8rem; display:block; margin-bottom:4px; color:var(--primary);"></i><span style="font-size:0.75rem;">Pilih / Ambil Foto</span></div>`;

  card.innerHTML = `
    <div style="position: relative;">
      <div class="lpj-foto-preview-box" id="editorFotoPreviewBox_${fotoId}" onclick="document.getElementById('editorFotoInput_${fotoId}').click()">
        ${initialPreview}
      </div>
      <input type="file" id="editorFotoInput_${fotoId}" accept="image/*" style="display:none;" onchange="handleEditorFotoSelect(event, ${fotoId})">
      <button type="button" class="btn btn-danger btn-xs" style="position:absolute; top:6px; right:6px; border-radius:50%; width:24px; height:24px; padding:0; display:flex; align-items:center; justify-content:center;" onclick="removeEditorFotoRow(${fotoId})" title="Hapus foto">
        ✕
      </button>
    </div>
    <div style="padding: 10px;">
      <label class="form-label" style="font-size: 0.72rem; font-weight: 700; margin-bottom: 4px;">Keterangan / Caption Foto</label>
      <input type="text" class="form-input form-input-sm" id="editorFotoCaption_${fotoId}" placeholder="Cth: Pembukaan kegiatan oleh Kepala Sekolah" value="${escapeHtml(fotoItem.keterangan)}" oninput="updateEditorFotoCaption(${fotoId})">
    </div>
  `;

  container.appendChild(card);
}

function removeEditorFotoRow(fotoId) {
  editorFotoRows = editorFotoRows.filter(f => f.id !== fotoId);
  const card = document.getElementById(`editorFotoCard_${fotoId}`);
  if (card) card.remove();
}

function updateEditorFotoCaption(fotoId) {
  const item = editorFotoRows.find(f => f.id === fotoId);
  if (!item) return;
  const input = document.getElementById(`editorFotoCaption_${fotoId}`);
  if (input) item.keterangan = input.value.trim();
}

function handleEditorFotoSelect(event, fotoId) {
  const file = event.target.files[0];
  if (!file) return;

  const item = editorFotoRows.find(f => f.id === fotoId);
  if (!item) return;
  item.file = file;

  const box = document.getElementById(`editorFotoPreviewBox_${fotoId}`);
  if (box) {
    const reader = new FileReader();
    reader.onload = (e) => {
      box.innerHTML = `<img src="${e.target.result}" alt="Preview" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
    };
    reader.readAsDataURL(file);
  }
}

// --------------------------------------------------------------------------
// Submit LPJ dari Halaman Editor
// --------------------------------------------------------------------------

async function submitLpjFromEditor(event) {
  if (event) event.preventDefault();
  if (!activeLpjProposal) return;

  const id = activeLpjProposal.id;

  // Sinkronisasi data nota terkini
  editorReceiptRows.forEach(r => {
    const tokoInput = document.getElementById(`editorReceiptToko_${r.id}`);
    const uraianInput = document.getElementById(`editorReceiptUraian_${r.id}`);
    const nominalInput = document.getElementById(`editorReceiptNominal_${r.id}`);
    if (tokoInput) r.nama_toko = tokoInput.value.trim();
    if (uraianInput) r.uraian = uraianInput.value.trim();
    if (nominalInput) r.nominal = parseRupiahInput(nominalInput.value);
  });

  const totalBelanja = editorReceiptRows.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  if (totalBelanja <= 0) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Nominal Belanja Kosong',
        text: 'Harap masukkan nominal belanja riil pada minimal satu bukti nota.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Harap masukkan nominal belanja riil pada minimal satu bukti nota.');
    }
    return;
  }

  // Sinkronisasi foto caption
  editorFotoRows.forEach(f => {
    const capInput = document.getElementById(`editorFotoCaption_${f.id}`);
    if (capInput) f.keterangan = capInput.value.trim();
  });

  const formData = new FormData();
  formData.append('total_belanja_riil', totalBelanja);

  // Field Laporan Deskripsi & Pelaksanaan
  const latarBelakang = document.getElementById('editorLpjLatarBelakang').value.trim();
  const tujuan = document.getElementById('editorLpjTujuan').value.trim();
  const tempat = document.getElementById('editorLpjTempat').value.trim();
  const peserta = document.getElementById('editorLpjPeserta').value.trim();

  const resumeHasil = document.getElementById('editorLpjResumeHasil').value.trim();
  const kendala = document.getElementById('editorLpjKendala').value.trim();
  const solusi = document.getElementById('editorLpjSolusi').value.trim();
  const catatanTambahan = document.getElementById('editorLpjCatatanTambahan').value.trim();

  formData.append('catatan_lpj', latarBelakang || catatanTambahan);
  formData.append('tujuan_kegiatan', tujuan);
  formData.append('tempat_pelaksanaan', tempat);
  formData.append('jumlah_peserta', peserta);

  formData.append('resume_hasil', resumeHasil);
  formData.append('kendala', kendala);
  formData.append('solusi_tindak_lanjut', solusi);

  // Multi-nota items
  const itemsPayload = editorReceiptRows.map((r, idx) => {
    const fileKey = `nota_file_${idx}`;
    if (r.file) {
      formData.append(fileKey, r.file);
    }
    return {
      nama_toko: r.nama_toko || 'Toko / Rekanan',
      uraian: r.uraian || '',
      nominal: r.nominal || 0,
      file_key: fileKey,
      existing_file_url: r.existing_file_url || null
    };
  });
  formData.append('nota_items', JSON.stringify(itemsPayload));

  // Master bundel file (opsional)
  if (selectedEditorMasterFile) {
    formData.append('file_nota', selectedEditorMasterFile);
  }

  // Berkas Daftar Hadir PDF (opsional)
  if (selectedEditorDaftarHadirFile) {
    formData.append('file_daftar_hadir', selectedEditorDaftarHadirFile);
  }

  // Foto dokumentasi
  const fotoPayload = [];
  editorFotoRows.forEach((f, idx) => {
    if (f.file || f.existing_file_url) {
      const fotoKey = `foto_kegiatan_${idx}`;
      if (f.file) {
        formData.append(fotoKey, f.file);
      }
      fotoPayload.push({
        keterangan: f.keterangan || 'Dokumentasi Kegiatan',
        file_key: fotoKey,
        existing_file_url: f.existing_file_url || null
      });
    }
  });
  formData.append('foto_dokumentasi', JSON.stringify(fotoPayload));

  const submitBtns = [
    document.getElementById('btnEditorSubmitLpjBottom'),
    document.getElementById('btnEditorSubmitLpjTop')
  ].filter(Boolean);

  submitBtns.forEach(b => {
    b.disabled = true;
    b.innerHTML = '<i class="ti ti-loader rotate"></i> Menyimpan Laporan...';
  });

  try {
    const res = await fetch(`/api/pengajuan/${id}/lpj`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Laporan LPJ Berhasil Disimpan!',
          html: `
            <p>${data.message}</p>
            <div style="margin-top: 15px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <a href="/cetak-lpj/${id}" target="_blank" class="btn btn-outline-success" style="font-size: 0.82rem; padding: 6px 12px; text-decoration: none;">
                🖨️ Cetak Lembar LPJ Saja
              </a>
              <a href="/cetak-lpj-bundel/${id}" target="_blank" class="btn btn-primary" style="font-size: 0.82rem; padding: 6px 12px; text-decoration: none;">
                📑 Cetak Bundel Lengkap LPJ
              </a>
            </div>
          `,
          confirmButtonColor: '#059669',
          confirmButtonText: 'Kembali ke Riwayat Proposal'
        }).then(() => {
          goBackFromLpjEditor();
        });
      } else {
        alert(data.message);
        goBackFromLpjEditor();
      }

      loadSummaryStats();
      loadPosAnggaran();
      loadProposalsList();
      if (typeof renderLpjView === 'function') {
        const viewLap = document.getElementById('viewLaporan');
        if (viewLap && viewLap.classList.contains('active')) {
          renderLpjView();
        }
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menyimpan LPJ',
          text: data.message,
          confirmButtonColor: '#059669'
        });
      } else {
        alert(`Gagal: ${data.message}`);
      }
    }
  } catch (err) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Jaringan',
        text: `Terjadi kesalahan saat menyimpan LPJ: ${err.message}`,
        confirmButtonColor: '#059669'
      });
    } else {
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
    }
  } finally {
    submitBtns.forEach(b => {
      b.disabled = false;
      b.innerHTML = '<i class="ti ti-check"></i> Simpan & Serahkan LPJ';
    });
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

      // Tampilkan tabel rincian multi-nota
      const tableContainer = document.getElementById('verifLpjNotaItemsTableContainer');
      const notaItems = (lpj && lpj.nota_items && lpj.nota_items.length > 0) ? lpj.nota_items : [];

      if (tableContainer) {
        if (notaItems.length > 0) {
          let rowsHtml = '';
          notaItems.forEach((it, idx) => {
            let fileAction = '';
            if (it.file_url) {
              const ext = it.file_url.split('.').pop().toLowerCase();
              const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
              fileAction = `
                <a href="${it.file_url}" target="_blank" class="btn btn-outline-success btn-xs" style="display:inline-flex; align-items:center; gap:4px; font-weight:700;">
                  <i class="ti ti-${isImg ? 'photo' : 'file-text'}"></i> Buka Nota
                </a>
              `;
            } else {
              fileAction = `<span style="color:#94a3b8; font-size:0.72rem;">Nota Fisik</span>`;
            }

            rowsHtml += `
              <tr>
                <td style="text-align:center; font-size:0.75rem; color:var(--text-muted);">${idx + 1}</td>
                <td>
                  <strong style="color:var(--text-main); font-size:0.82rem;">${escapeHtml(it.nama_toko || 'Toko / Rekanan')}</strong>
                </td>
                <td style="font-size:0.8rem; color:var(--text-body);">${escapeHtml(it.uraian || '-')}</td>
                <td style="text-align:right; font-weight:800; color:#047857; font-size:0.85rem; white-space:nowrap;">
                  ${formatRupiah(it.nominal)}
                </td>
                <td style="text-align:center;">${fileAction}</td>
              </tr>
            `;
          });

          tableContainer.innerHTML = `
            <div class="table-responsive" style="border:1px solid var(--border-card); border-radius:var(--radius-sm); overflow:hidden; margin-bottom:8px;">
              <table class="table-compact" style="margin-bottom:0; font-size:0.82rem;">
                <thead style="background:#f8fafc;">
                  <tr>
                    <th style="width:36px; text-align:center;">No</th>
                    <th>Nama Toko / Rekanan</th>
                    <th>Uraian Belanja</th>
                    <th style="text-align:right; width:130px;">Nominal (Rp)</th>
                    <th style="text-align:center; width:110px;">Bukti Berkas</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
                <tfoot style="background:#f1f5f9; font-weight:800;">
                  <tr>
                    <td colspan="3" style="text-align:right; font-size:0.82rem;">Total Belanja Terverifikasi:</td>
                    <td style="text-align:right; color:#047857; font-size:0.9rem;">${formatRupiah(lpj ? lpj.total_belanja_riil : 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `;
        } else {
          tableContainer.innerHTML = `
            <div style="padding:14px; background:#f8fafc; border:1px dashed var(--border-card); border-radius:var(--radius-sm); text-align:center; color:var(--text-muted); font-size:0.82rem;">
              Belum ada rincian nota digital yang dilampirkan.
            </div>
          `;
        }
      }

      // Berkas bundel dokumen PDF
      const masterContainer = document.getElementById('verifLpjMasterBundleContainer');
      const fileBox = document.getElementById('verifLpjFilePreviewBox');
      if (lpj && lpj.file_nota_url) {
        if (masterContainer) masterContainer.style.display = 'block';
        if (fileBox) {
          fileBox.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">📄</span>
              <div>
                <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">Berkas Kolektif / PDF Bundel Lengkap</div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(lpj.file_nota_url.split('/').pop())}</div>
              </div>
            </div>
            <a href="${lpj.file_nota_url}" target="_blank" class="btn btn-secondary btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
              👁️ Buka / Unduh Berkas
            </a>
          `;
        }
      } else {
        if (masterContainer) masterContainer.style.display = 'none';
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
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Catatan Wajib Diisi',
        text: 'Harap isi catatan pemeriksaan alasan pengembalian/perbaikan LPJ.',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('Harap isi catatan pemeriksaan alasan pengembalian/perbaikan LPJ.');
    }
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
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'success',
          title: 'Verifikasi Berhasil!',
          text: data.message,
          confirmButtonColor: '#059669',
          timer: 3000
        });
      } else {
        showNotification(`✓ ${data.message}`);
      }
      loadSummaryStats();
      loadPosAnggaran();
      loadProposalsList();
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Verifikasi LPJ',
          text: data.message,
          confirmButtonColor: '#059669'
        });
      } else {
        alert(`Gagal memverifikasi LPJ: ${data.message}`);
      }
    }
  } catch (err) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Jaringan',
        text: `Terjadi kesalahan jaringan: ${err.message}`,
        confirmButtonColor: '#059669'
      });
    } else {
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
    }
  }
}

// ==========================================================================
// FASE 5: HALAMAN LAPORAN REALISASI & ARSIP LPJ TERPADU
// ==========================================================================

function handleLpjFilterChange() {
  renderLpjView();
}

function renderLpjView() {
  const tbody = document.getElementById('lpjTableBody');
  if (!tbody) return;

  // Filter proposal yang relevan dengan laporan pertanggungjawaban
  // (Minimal DICAIRKAN, MENUNGGU_VERIFIKASI_LPJ, SELESAI, atau yang memiliki data LPJ)
  const allLpjEligible = currentProposals.filter(p => 
    p.status === 'DICAIRKAN' || 
    p.status === 'MENUNGGU_VERIFIKASI_LPJ' || 
    p.status === 'SELESAI' || 
    p.lpj_id
  );

  // Hitung 4 Metrik Keuangan LPJ
  let totalKasCair = 0;
  let totalBelanjaRiil = 0;
  let totalSisaSetor = 0;
  let countNotaAda = 0;

  allLpjEligible.forEach(p => {
    const cair = p.lpj_total_cair !== null && p.lpj_total_cair !== undefined ? Number(p.lpj_total_cair) : Number(p.total_dana_disetujui || 0);
    const riil = p.lpj_total_belanja_riil !== null && p.lpj_total_belanja_riil !== undefined ? Number(p.lpj_total_belanja_riil) : 0;
    const sisa = p.lpj_sisa_pengembalian !== null && p.lpj_sisa_pengembalian !== undefined ? Number(p.lpj_sisa_pengembalian) : (cair - riil);

    totalKasCair += cair;
    totalBelanjaRiil += riil;
    totalSisaSetor += sisa;
    if (p.lpj_file_nota_url) countNotaAda++;
  });

  const statKasCair = document.getElementById('statLpjKasCair');
  const statBelanjaRiil = document.getElementById('statLpjBelanjaRiil');
  const statSisaSetor = document.getElementById('statLpjSisaSetor');
  const statNotaCount = document.getElementById('statLpjNotaCount');
  const badgeLpjCount = document.getElementById('lpjCountBadge');

  if (statKasCair) statKasCair.textContent = formatRupiah(totalKasCair);
  if (statBelanjaRiil) statBelanjaRiil.textContent = formatRupiah(totalBelanjaRiil);
  if (statSisaSetor) statSisaSetor.textContent = formatRupiah(totalSisaSetor);
  if (statNotaCount) statNotaCount.textContent = `${countNotaAda} / ${allLpjEligible.length} Berkas`;
  if (badgeLpjCount) badgeLpjCount.textContent = `${allLpjEligible.length} Kegiatan`;

  // Search & Filter Status
  const searchInput = document.getElementById('inputSearchLpj');
  const statusSelect = document.getElementById('selectStatusLpjFilter');
  const kw = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const filterStatus = statusSelect ? statusSelect.value : 'ALL';

  let filtered = allLpjEligible;

  if (filterStatus === 'NEED_NOTA') {
    filtered = filtered.filter(p => p.status === 'DICAIRKAN' && !p.lpj_file_nota_url);
  } else if (filterStatus === 'MENUNGGU_VERIFIKASI_LPJ') {
    filtered = filtered.filter(p => p.status === 'MENUNGGU_VERIFIKASI_LPJ');
  } else if (filterStatus === 'SELESAI') {
    filtered = filtered.filter(p => p.status === 'SELESAI');
  }

  if (kw) {
    filtered = filtered.filter(p => 
      (p.nama_kegiatan || '').toLowerCase().includes(kw) ||
      (p.nomor_surat_ajuan || '').toLowerCase().includes(kw) ||
      (p.pemohon_nama || '').toLowerCase().includes(kw) ||
      (p.nama_pos || '').toLowerCase().includes(kw)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 1.75rem; margin-bottom: 6px;">📂</div>
          <div style="font-weight: 700; color: var(--text-main);">Tidak ada data laporan kegiatan.</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">
            ${allLpjEligible.length === 0 ? 'Belum ada kegiatan yang kasnya dicairkan atau memiliki berkas pertanggungjawaban.' : 'Tidak ada hasil yang sesuai dengan kriteria pencarian / filter Anda.'}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const isBendahara = currentUser && (currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');
  const isKepsek = currentUser && (currentUser.role === 'KEPALA_SEKOLAH' || currentUser.role === 'ANALISIS_SDM' || currentUser.role === 'ADMIN');

  let rowsHtml = '';
  filtered.forEach((p, idx) => {
    const isOwnerGuru = currentUser && (currentUser.id === p.user_id || currentUser.role === 'ADMIN');
    const danaCair = p.lpj_total_cair !== null && p.lpj_total_cair !== undefined ? Number(p.lpj_total_cair) : Number(p.total_dana_disetujui || 0);
    const belanjaRiil = p.lpj_total_belanja_riil !== null && p.lpj_total_belanja_riil !== undefined ? Number(p.lpj_total_belanja_riil) : 0;
    const sisaKas = p.lpj_sisa_pengembalian !== null && p.lpj_sisa_pengembalian !== undefined ? Number(p.lpj_sisa_pengembalian) : (danaCair - belanjaRiil);

    // Bukti Nota Cell
    let notaCell = '';
    const notaCount = p.lpj_nota_count || (p.lpj_file_nota_url ? 1 : 0);
    if (notaCount > 1) {
      notaCell = `
        <button type="button" class="btn btn-outline-success btn-xs" style="color:#047857; border-color:#a7f3d0; background:#ecfdf5; font-weight:700; display:inline-flex; align-items:center; gap:4px;" onclick="openVerifikasiLpjModal(${p.id})" title="Periksa ${notaCount} berkas nota fisik">
          <i class="ti ti-files"></i> ${notaCount} Nota
        </button>
      `;
    } else if (p.lpj_file_nota_url) {
      notaCell = `
        <a href="${p.lpj_file_nota_url}" target="_blank" class="btn btn-outline-success btn-xs" style="color:#047857; border-color:#a7f3d0; background:#ecfdf5; font-weight:700; display:inline-flex; align-items:center; gap:4px;" title="Buka berkas bukti nota kuitansi">
          <i class="ti ti-file-check"></i> 1 Nota
        </a>
      `;
    } else {
      notaCell = `
        <span style="color:#94a3b8; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
          <i class="ti ti-alert-circle"></i> Belum Ada
        </span>
      `;
    }

    // Status Pill
    let statusBadge = '';
    if (p.status === 'DICAIRKAN') {
      statusBadge = `<span class="status-pill DICAIRKAN" style="font-size:0.68rem;">Siap Upload LPJ</span>`;
    } else if (p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
      statusBadge = `<span class="status-pill MENUNGGU_VERIFIKASI_LPJ" style="font-size:0.68rem;">Verifikasi Bendahara</span>`;
    } else if (p.status === 'SELESAI') {
      statusBadge = `<span class="status-pill SELESAI" style="font-size:0.68rem;">✅ Sah &amp; Selesai</span>`;
    } else {
      statusBadge = `<span class="status-pill" style="font-size:0.68rem;">${p.status.replace(/_/g, ' ')}</span>`;
    }

    // Action Buttons
    const canManageLpj = currentUser && (currentUser.id === p.user_id || currentUser.role === 'BENDAHARA' || currentUser.role === 'ADMIN');
    let actionsHtml = `
      <div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap; align-items:center;">
        <button class="btn btn-secondary btn-xs" onclick="openProposalDetail(${p.id})" title="Lihat Rincian Kegiatan">
          <i class="ti ti-eye"></i> Detail
        </button>
    `;

    if (p.status === 'DICAIRKAN') {
      if (canManageLpj) {
        actionsHtml += `
          <button class="btn btn-primary btn-xs" onclick="navigateToLpjEditor(${p.id})" title="Susun Laporan Pertanggungjawaban (LPJ)">
            <i class="ti ti-file-certificate"></i> Buat LPJ
          </button>
        `;
      }
    } else if (p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
      if (isBendahara) {
        actionsHtml += `
          <button class="btn btn-warning btn-xs" style="background:#d97706; border-color:#d97706; color:#fff;" onclick="openVerifikasiLpjModal(${p.id})" title="Periksa berkas nota &amp; sahkan LPJ">
            <i class="ti ti-clipboard-check"></i> Verifikasi
          </button>
        `;
      }
      if (canManageLpj) {
        actionsHtml += `
          <button class="btn btn-secondary btn-xs" onclick="navigateToLpjEditor(${p.id})" title="Ubah atau lengkapi laporan LPJ &amp; berkas nota">
            <i class="ti ti-edit"></i> Edit LPJ
          </button>
        `;
      }
    } else if (p.status === 'SELESAI' && canManageLpj) {
      actionsHtml += `
        <button class="btn btn-secondary btn-xs" onclick="navigateToLpjEditor(${p.id})" title="Lihat berkas LPJ yang telah disahkan">
          <i class="ti ti-file-check"></i> LPJ
        </button>
      `;
    }

    actionsHtml += `
        <a href="/cetak-lpj-bundel/${p.id}" target="_blank" class="btn btn-secondary btn-xs" title="Cetak Bundel Lengkap LPJ Resmi (Cover, Kwitansi, LPJ, Lampiran)">
          <i class="ti ti-printer"></i>
        </a>
      </div>
    `;

    rowsHtml += `
      <tr>
        <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
        <td>
          <div style="font-weight: 800; font-family: monospace; font-size: 0.78rem; color: var(--primary);">${escapeHtml(p.nomor_surat_ajuan)}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">📅 ${p.created_at || '-'}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.86rem; line-height: 1.35;">${escapeHtml(p.nama_kegiatan)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
            👤 ${escapeHtml(p.pemohon_nama)} <span style="color:var(--text-light);">(${escapeHtml(p.pemohon_unit)})</span>
          </div>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-body); line-height: 1.3;">${escapeHtml(p.nama_pos)}</div>
        </td>
        <td style="text-align: right; font-weight: 700; color: #0f172a; font-size: 0.86rem; white-space: nowrap;">
          ${formatRupiah(danaCair)}
        </td>
        <td style="text-align: right; font-weight: 800; color: #047857; font-size: 0.86rem; white-space: nowrap;">
          ${belanjaRiil > 0 ? formatRupiah(belanjaRiil) : '<span style="color:#94a3b8; font-weight:500;">-</span>'}
        </td>
        <td style="text-align: right; font-weight: 700; font-size: 0.86rem; white-space: nowrap; color: ${sisaKas > 0 ? '#059669' : 'var(--text-muted)'};">
          ${sisaKas > 0 ? formatRupiah(sisaKas) : 'Rp 0'}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          ${notaCell}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          ${statusBadge}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          ${actionsHtml}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
}

window.renderLpjView = renderLpjView;
window.handleLpjFilterChange = handleLpjFilterChange;

// =============================================================================
// MODUL LOG AKTIVITAS & AUDIT PENGAWASAN SISTEM (SDM, KEPSEK, ADMIN)
// =============================================================================

let currentAuditCategory = 'ALL';
let auditSearchQuery = '';
let auditSearchTimer = null;

async function loadAuditLogsList() {
  const tbody = document.getElementById('tbodyAuditLogs');
  if (!tbody) return;

  try {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div class="spinner-border spinner-border-sm" role="status" style="margin-right: 8px;"></div>
          Memuat riwayat log aktivitas...
        </td>
      </tr>
    `;

    const url = `/api/audit-logs?kategori=${encodeURIComponent(currentAuditCategory)}&search=${encodeURIComponent(auditSearchQuery)}&limit=250`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
            <i class="ti ti-alert-triangle" style="font-size: 1.5rem; display: block; margin-bottom: 6px;"></i>
            ${escapeHtml(err.message || 'Gagal memuat log aktivitas sistem.')}
          </td>
        </tr>
      `;
      return;
    }

    const data = await res.json();
    if (!data.success) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
            ${escapeHtml(data.message || 'Gagal memuat data.')}
          </td>
        </tr>
      `;
      return;
    }

    // Update KPI Card Numbers
    const c = data.counts || { total: 0, login: 0, pagu: 0, usulan: 0, lpj: 0, akun: 0 };
    const elTotal = document.getElementById('statAuditTotal');
    if (elTotal) elTotal.textContent = Number(c.total || 0).toLocaleString('id-ID');
    const elLogin = document.getElementById('statAuditLogin');
    if (elLogin) elLogin.textContent = Number(c.login || 0).toLocaleString('id-ID');
    const elPagu = document.getElementById('statAuditPagu');
    if (elPagu) elPagu.textContent = Number(c.pagu || 0).toLocaleString('id-ID');
    const elLainnya = document.getElementById('statAuditLainnya');
    if (elLainnya) {
      const others = Number(c.usulan || 0) + Number(c.lpj || 0) + Number(c.akun || 0);
      elLainnya.textContent = others.toLocaleString('id-ID');
    }

    // Update Filter Badges
    const badgeAll = document.getElementById('badgeCatAll');
    if (badgeAll) badgeAll.textContent = c.total || 0;
    const badgeLogin = document.getElementById('badgeCatLogin');
    if (badgeLogin) badgeLogin.textContent = c.login || 0;
    const badgePagu = document.getElementById('badgeCatPagu');
    if (badgePagu) badgePagu.textContent = c.pagu || 0;
    const badgeUsulan = document.getElementById('badgeCatUsulan');
    if (badgeUsulan) badgeUsulan.textContent = c.usulan || 0;
    const badgeLpj = document.getElementById('badgeCatLpj');
    if (badgeLpj) badgeLpj.textContent = c.lpj || 0;
    const badgeAkun = document.getElementById('badgeCatAkun');
    if (badgeAkun) badgeAkun.textContent = c.akun || 0;

    // Render Table Rows
    renderAuditLogsTable(data.logs || []);
  } catch (err) {
    console.error('Error loadAuditLogsList:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
          Terjadi kesalahan saat menghubungi server: ${escapeHtml(err.message)}
        </td>
      </tr>
    `;
  }
}

function filterAuditCategory(cat) {
  currentAuditCategory = cat;
  document.querySelectorAll('.audit-cat-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cat') === cat);
  });
  loadAuditLogsList();
}

function handleSearchAuditInput() {
  const input = document.getElementById('inputSearchAudit');
  const btnClear = document.getElementById('btnAuditClearSearch');
  if (!input) return;

  auditSearchQuery = input.value.trim();
  if (btnClear) {
    btnClear.style.display = auditSearchQuery.length > 0 ? 'flex' : 'none';
  }

  clearTimeout(auditSearchTimer);
  auditSearchTimer = setTimeout(() => {
    loadAuditLogsList();
  }, 350);
}

function clearAuditSearch() {
  const input = document.getElementById('inputSearchAudit');
  const btnClear = document.getElementById('btnAuditClearSearch');
  if (input) input.value = '';
  if (btnClear) btnClear.style.display = 'none';
  auditSearchQuery = '';
  loadAuditLogsList();
}

function renderAuditLogsTable(logs) {
  const tbody = document.getElementById('tbodyAuditLogs');
  const showingInfo = document.getElementById('auditShowingInfo');
  if (!tbody) return;

  if (showingInfo) {
    showingInfo.textContent = `Menampilkan ${logs.length} catatan aktivitas terkini.`;
  }

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📋</div>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">Tidak Ada Log Aktivitas Ditemukan</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">
            ${auditSearchQuery ? `Tidak ada catatan yang cocok dengan kata kunci "${escapeHtml(auditSearchQuery)}".` : 'Belum ada rekaman aktivitas untuk kategori ini.'}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = logs.map(log => {
    // 1. Format Waktu
    let dateStr = '-';
    let timeStr = '';
    if (log.waktu_dibuat) {
      try {
        const d = new Date(log.waktu_dibuat.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
          timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';
        } else {
          dateStr = log.waktu_dibuat;
        }
      } catch (e) {
        dateStr = log.waktu_dibuat;
      }
    }

    // 2. Format Pelaku
    const actorName = log.user_nama || (log.user_id ? `Pengguna #${log.user_id}` : 'Sistem Otomatis');
    const actorRole = log.user_role ? log.user_role.replace(/_/g, ' ') : 'SISTEM';
    const actorEmail = log.user_email ? `<span style="font-size: 0.72rem; color: #64748b;">(${escapeHtml(log.user_email)})</span>` : '';

    // 3. Category Badge & Icon
    const cat = (log.tipe_aksi || 'SISTEM').toUpperCase();
    let catClass = 'sistem';
    let catLabel = 'SISTEM';
    let catIcon = 'ti-settings';

    if (cat === 'LOGIN' || cat === 'AUTH') {
      catClass = 'login';
      catLabel = 'SESI / LOGIN';
      catIcon = 'ti-login';
    } else if (cat === 'PAGU') {
      catClass = 'pagu';
      catLabel = 'PAGU RKAS';
      catIcon = 'ti-coin';
    } else if (cat === 'USULAN') {
      catClass = 'usulan';
      catLabel = 'USULAN KAS';
      catIcon = 'ti-file-text';
    } else if (cat === 'LPJ') {
      catClass = 'lpj';
      catLabel = 'LAPORAN LPJ';
      catIcon = 'ti-receipt';
    } else if (cat === 'AKUN') {
      catClass = 'akun';
      catLabel = 'AKUN PENGGUNA';
      catIcon = 'ti-user-cog';
    }

    // 4. Perangkat & IP
    const ip = log.ip_address || '127.0.0.1';
    let shortUa = 'Browser Web';
    const rawUa = log.user_agent || '';
    if (rawUa.includes('Chrome')) shortUa = 'Google Chrome';
    else if (rawUa.includes('Firefox')) shortUa = 'Mozilla Firefox';
    else if (rawUa.includes('Safari')) shortUa = 'Apple Safari';
    else if (rawUa.includes('Edge')) shortUa = 'Microsoft Edge';
    else if (rawUa.includes('node') || rawUa.includes('Postman')) shortUa = 'API Client';

    return `
      <tr>
        <td style="white-space: nowrap;">
          <div class="audit-time-main">${escapeHtml(dateStr)}</div>
          <div class="audit-time-sub"><i class="ti ti-clock" style="font-size: 0.85rem;"></i> ${escapeHtml(timeStr)}</div>
        </td>
        <td>
          <div class="audit-actor-name">${escapeHtml(actorName)}</div>
          <div class="audit-actor-sub">
            <span class="role-badge role-${(log.user_role || 'sistem').toLowerCase()}" style="font-size: 0.7rem; padding: 2px 7px;">
              ${escapeHtml(actorRole)}
            </span>
            ${actorEmail}
          </div>
        </td>
        <td style="text-align: center;">
          <span class="badge-audit-cat ${catClass}">
            <i class="ti ${catIcon}"></i> ${catLabel}
          </span>
        </td>
        <td>
          <div class="audit-text-desc">${escapeHtml(log.aktivitas)}</div>
          ${log.nama_kegiatan ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; background: #eff6ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #dbeafe;">📌 Usulan: ${escapeHtml(log.nama_kegiatan)} ${log.nomor_surat_ajuan ? `(${escapeHtml(log.nomor_surat_ajuan)})` : ''}</div>` : ''}
        </td>
        <td style="white-space: nowrap;">
          <span class="audit-device-ip">🌐 ${escapeHtml(ip)}</span>
          <div class="audit-device-ua" title="${escapeHtml(rawUa)}"><i class="ti ti-device-laptop" style="font-size: 0.85rem;"></i> ${escapeHtml(shortUa)}</div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

window.loadAuditLogsList = loadAuditLogsList;
window.filterAuditCategory = filterAuditCategory;
window.handleSearchAuditInput = handleSearchAuditInput;
window.clearAuditSearch = clearAuditSearch;
