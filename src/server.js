const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const QRCode = require('qrcode');
const multer = require('multer');
const XLSX = require('xlsx');
const {
  initDatabase,
  logSystemActivity,
  getAllSystemAuditLogs,
  getPosAnggaranList,
  getPosAnggaranById,
  createPosAnggaran,
  updatePosAnggaran,
  deletePosAnggaran,
  importRkasFromExcel,
  getAllUsers,
  getGuruAccountsList,
  getUserStats,
  getUserById,
  createGuruUser,
  resetUserPassword,
  changeOwnPassword,
  authenticateUser,
  createSession,
  getUserBySessionToken,
  deleteSession,
  getSystemSummary,
  createPengajuan,
  getPengajuanList,
  getPengajuanById,
  deletePengajuan,
  reviewProposalByBendahara,
  decisionProposalByKepsek,
  disburseProposal,
  updateBuktiTransfer,
  getPengajuanByQrToken,
  submitLpjByGuru,
  verifyLpjByBendahara,
  getAuditLogs
} = require('./db');

const { renderCetakDisposisi } = require('./views/cetak-disposisi');
const { renderCetakLpj } = require('./views/cetak-lpj');
const { renderCetakLpjBundel } = require('./views/cetak-lpj-bundel');
const { renderCetakRkas } = require('./views/cetak-rkas');
const { renderVerifikasiPublik } = require('./views/verifikasi-publik');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '..', 'uploads');
const uploadSubdirs = ['nota', 'transfer', 'daftar_hadir', 'foto'];
uploadSubdirs.forEach(sub => {
  const p = path.join(uploadDir, sub);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Konfigurasi Multer Terpadu untuk Berkas LPJ, Transfer & Dokumentasi
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let sub = 'nota';
    if (file.fieldname === 'file_bukti_transfer') {
      sub = 'transfer';
    } else if (file.fieldname === 'file_daftar_hadir') {
      sub = 'daftar_hadir';
    } else if (file.fieldname.startsWith('foto_kegiatan')) {
      sub = 'foto';
    }
    cb(null, path.join(uploadDir, sub));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    let prefix = 'nota-';
    if (file.fieldname === 'file_bukti_transfer') prefix = 'transfer-';
    else if (file.fieldname === 'file_daftar_hadir') prefix = 'daftar-hadir-';
    else if (file.fieldname.startsWith('foto_kegiatan')) prefix = 'foto-';
    const safeName = prefix + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, safeName);
  }
});

const uploadNota = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Maksimal 15MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Format berkas tidak didukung! Harap unggah foto bukti kuitansi (JPG, PNG, WebP) atau PDF.'));
    }
  }
});

// Inisialisasi Database SQLite
initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Helper Parser Cookie Native
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const trimmed = name?.trim();
    if (!trimmed) return;
    const value = rest.join('=').trim();
    list[trimmed] = decodeURIComponent(value);
  });
  return list;
}

// Middleware Sesi Pengguna
app.use((req, res, next) => {
  const cookies = parseCookies(req);
  const token = cookies.session_token;

  if (token) {
    const user = getUserBySessionToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
});

// Helper untuk mengambil IP dan User-Agent client
function getClientMeta(req) {
  let ip = req.headers['x-forwarded-for'];
  if (ip) {
    ip = ip.split(',')[0].trim();
  } else {
    ip = req.socket?.remoteAddress || req.ip || '127.0.0.1';
  }
  if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Browser/Unknown';
  return { ip, ua };
}

// Guard Middleware: Wajib Login
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Sesi telah berakhir atau Anda belum masuk. Silakan login kembali.'
    });
  }
  next();
}

// --- Autentikasi & Manajemen Sesi ---

// 1. Login Resmi (Email / NIP + Password)
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = authenticateUser(identifier, password);
    const token = createSession(user.id);
    const { ip, ua } = getClientMeta(req);

    logSystemActivity({
      user_id: user.id,
      tipe_aksi: 'LOGIN',
      aktivitas: `LOGIN BERHASIL: Pengguna "${user.nama_lengkap}" (${user.role}) berhasil masuk ke sistem.`,
      ip_address: ip,
      user_agent: ua
    });

    res.setHeader('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
    res.json({
      success: true,
      user,
      message: `Selamat datang, ${user.nama_lengkap}!`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 2. Logout Resmi (Hapus Sesi & Cookie)
app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.session_token) {
    deleteSession(cookies.session_token);
  }
  if (req.user) {
    const { ip, ua } = getClientMeta(req);
    logSystemActivity({
      user_id: req.user.id,
      tipe_aksi: 'LOGIN',
      aktivitas: `LOGOUT: Pengguna "${req.user.nama_lengkap}" (${req.user.role}) keluar dari sesi.`,
      ip_address: ip,
      user_agent: ua
    });
  }
  res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ success: true, message: 'Berhasil keluar dari sistem.' });
});

// 3. Ambil Data Akun yang Sedang Login
app.get('/api/auth/active-user', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, user: null, message: 'Belum ada sesi aktif.' });
  }
  res.json({ success: true, user: req.user });
});

// 4. Quick Switch User (Khusus Demo / Pengujian Instan)
app.post('/api/auth/switch-user', (req, res) => {
  const { userId } = req.body;
  const user = getUserById(Number(userId));
  if (!user) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }
  const token = createSession(user.id);
  const { ip, ua } = getClientMeta(req);
  logSystemActivity({
    user_id: user.id,
    tipe_aksi: 'LOGIN',
    aktivitas: `GANTI SESI INSTAN: Beralih ke akun "${user.nama_lengkap}" (${user.role}).`,
    ip_address: ip,
    user_agent: ua
  });
  res.setHeader('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
  res.json({ success: true, user, message: `Beralih ke akun ${user.nama_lengkap} (${user.role})` });
});

// List all users
app.get('/api/users', (req, res) => {
  const users = getAllUsers();
  res.json({ success: true, users });
});

// Statistik Akun (Khusus Analisis SDM & Kepsek & Admin)
app.get('/api/users/stats', requireAuth, (req, res) => {
  try {
    if (!['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses terbatas untuk Analisis SDM dan Kepala Sekolah.' });
    }
    const stats = getUserStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const { 
  getPenandatanganList, 
  updatePenandatangan, 
  getPengajuanIdByToken,
  getPengaturanSekolahList,
  updatePengaturanSekolah,
  getArchivedPengajuanList,
  restorePengajuan,
  pindahPosAnggaran,
  updateBidangKegiatan
} = require('./db');

// Resolusi akses dokumen cetak: token acak (32 hex) boleh tanpa login; ID numerik wajib login
const LOGIN_REQUIRED_HTML = '<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Sesi Berakhir: Silakan login terlebih dahulu untuk membuka dokumen.</h2>';
function resolvePrintProposal(req) {
  const cookies = parseCookies(req);
  const user = cookies.session_token ? getUserBySessionToken(cookies.session_token) : null;
  const param = String(req.params.id || '');
  if (/^[a-f0-9]{32}$/i.test(param)) {
    const id = getPengajuanIdByToken(param.toLowerCase());
    return { user, proposal: id ? getPengajuanById(id) : null, needLogin: false };
  }
  if (!user) return { user: null, proposal: null, needLogin: true };
  return { user, proposal: getPengajuanById(Number(param)), needLogin: false };
}


// Pengaturan Identitas & Kuitansi Sekolah
app.get('/api/pengaturan-sekolah', requireAuth, (req, res) => {
  try {
    res.json({ success: true, data: getPengaturanSekolahList() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/pengaturan-sekolah/:kunci', requireAuth, (req, res) => {
  try {
    if (!['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya Analisis SDM, Kepala Sekolah, dan Administrator yang berhak mengubah identitas sekolah.' });
    }
    const result = updatePengaturanSekolah(req.params.kunci, req.body.nilai, req.user);
    res.json({ success: true, data: result, message: 'Pengaturan sekolah berhasil diperbarui.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Daftar Penandatangan Dokumen (dibaca semua user login)
app.get('/api/penandatangan', requireAuth, (req, res) => {
  try {
    res.json({ success: true, data: getPenandatanganList() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Ubah Penandatangan Dokumen (Khusus Analisis SDM & Kepsek & Admin)
app.put('/api/penandatangan/:kode', requireAuth, (req, res) => {
  try {
    if (!['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya Analisis SDM dan Kepala Sekolah yang berwenang mengubah penandatangan.' });
    }
    const data = updatePenandatangan(req.params.kode, req.body || {}, req.user);
    res.json({ success: true, data, message: 'Penandatangan berhasil diperbarui.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Daftar Akun Guru (Khusus Analisis SDM & Kepsek & Admin)
app.get('/api/users/guru', requireAuth, (req, res) => {
  try {
    if (!['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses terbatas untuk Analisis SDM dan Kepala Sekolah.' });
    }
    const list = getGuruAccountsList();
    res.json({ success: true, users: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Tambah Akun Guru Baru (Khusus Analisis SDM & Kepsek & Admin)
app.post('/api/users/guru', requireAuth, (req, res) => {
  try {
    if (!['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya Analisis SDM dan Kepala Sekolah yang berwenang menambah akun guru.' });
    }
    const { nama_lengkap, nip, email, password, unit_bagian } = req.body;
    const newUser = createGuruUser({ nama_lengkap, nip, email, password, unit_bagian }, req.user);
    res.json({
      success: true,
      user: newUser,
      message: `Akun guru "${newUser.nama_lengkap}" berhasil didaftarkan!`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Reset Password Akun Guru (Khusus Analisis SDM & Kepsek & Admin)
app.post('/api/users/:id/reset-password', requireAuth, (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { newPassword } = req.body;
    const result = resetUserPassword(targetId, req.user, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Ganti Password Pribadi (Bisa dilakukan semua pengguna untuk akunnya sendiri)
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = changeOwnPassword(req.user.id, oldPassword, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Log Aktivitas Sistem (Khusus Analisis SDM, Kepsek, Admin)
app.get('/api/audit-logs', requireAuth, (req, res) => {
  try {
    const ALLOWED_AUDIT_ROLES = ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'];
    if (!ALLOWED_AUDIT_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Halaman log pengawasan aktivitas hanya dapat diakses oleh Analisis SDM Aparatur, Kepala Sekolah, dan Administrator.'
      });
    }

    const { kategori, search, limit, offset } = req.query;
    const result = getAllSystemAuditLogs({ kategori, search, limit, offset });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Summary overview stats
app.get('/api/summary', (req, res) => {
  const summary = getSystemSummary();
  res.json({ success: true, summary });
});

// Pos Anggaran List (Mendukung filter SNP)
app.get('/api/pos-anggaran', (req, res) => {
  const list = getPosAnggaranList(req.query.snp);
  res.json({ success: true, data: list });
});

// Pos Anggaran Detail
app.get('/api/pos-anggaran/:id', (req, res) => {
  const item = getPosAnggaranById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Pos anggaran tidak ditemukan' });
  }
  res.json({ success: true, data: item });
});

// Sync / Import Ulang RKAS dari File Excel (Hanya Kepsek, Analisis SDM, Admin)
app.post('/api/pos-anggaran/sync-rkas', requireAuth, (req, res) => {
  try {
    const ALLOWED_PAGU_ROLES = ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'];
    if (!ALLOWED_PAGU_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya Analisis SDM Aparatur dan Kepala Sekolah yang berhak menyinkronkan data RKAS.' });
    }
    const success = importRkasFromExcel();
    if (success) {
      const list = getPosAnggaranList();
      const { ip, ua } = getClientMeta(req);
      logSystemActivity({
        user_id: req.user.id,
        tipe_aksi: 'PAGU',
        aktivitas: `SINKRONISASI RKAS EXCEL: Database pos anggaran (${list.length} item) disinkronkan dari file Excel RKAS oleh ${req.user.nama_lengkap} (${req.user.role}).`,
        ip_address: ip,
        user_agent: ua
      });
      res.json({ success: true, count: list.length, message: `Berhasil menyinkronkan ${list.length} item RKAS 2026 dari Excel resmi!`, data: list });
    } else {
      res.status(500).json({ success: false, message: 'Gagal menyinkronkan data RKAS dari file Excel.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new Pos Anggaran (Hanya Kepsek, Analisis SDM, atau Admin)
app.post('/api/pos-anggaran', requireAuth, (req, res) => {
  try {
    const ALLOWED_PAGU_ROLES = ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'];
    if (!ALLOWED_PAGU_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Perubahan atau penambahan pagu anggaran hanya dapat dilakukan oleh Analisis SDM Aparatur dan Kepala Sekolah. Akun Bendahara dan Guru bertugas dalam pengajuan dan pengelolaan LPJ.'
      });
    }
    const {
      no_kelompok,
      kode_kelompok,
      nama_kelompok,
      kode_rekening,
      snp,
      program_induk,
      nama_pos,
      tahun_ajaran,
      volume,
      satuan,
      tarif_harga,
      pagu_awal,
      keterangan
    } = req.body;
    if (!nama_pos || pagu_awal === undefined) {
      return res.status(400).json({ success: false, message: 'Nama pos dan pagu awal wajib diisi' });
    }
    const created = createPosAnggaran({
      no_kelompok,
      kode_kelompok,
      nama_kelompok,
      kode_rekening,
      snp,
      program_induk,
      nama_pos,
      tahun_ajaran,
      volume,
      satuan,
      tarif_harga,
      pagu_awal,
      keterangan
    });

    const { ip, ua } = getClientMeta(req);
    logSystemActivity({
      user_id: req.user.id,
      tipe_aksi: 'PAGU',
      aktivitas: `TAMBAH POS RKAS: Pos baru "${created.nama_pos}" (${created.kode_rekening || '-'}) dengan plafon Rp ${Number(created.pagu_awal || 0).toLocaleString('id-ID')} dibuat oleh ${req.user.nama_lengkap} (${req.user.role}).`,
      ip_address: ip,
      user_agent: ua
    });

    res.json({ success: true, data: created, message: 'Pos anggaran berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Pos Anggaran (Hanya Kepsek, Analisis SDM, atau Admin)
app.put('/api/pos-anggaran/:id', requireAuth, (req, res) => {
  try {
    const ALLOWED_PAGU_ROLES = ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'];
    if (!ALLOWED_PAGU_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Perubahan pagu anggaran hanya dapat dilakukan oleh Analisis SDM Aparatur dan Kepala Sekolah. Akun Bendahara dan Guru bertugas dalam pengajuan dan pengelolaan LPJ.'
      });
    }

    const oldPos = getPosAnggaranById(req.params.id);
    if (!oldPos) {
      return res.status(404).json({ success: false, message: 'Pos anggaran tidak ditemukan' });
    }

    const {
      nama_pos,
      pagu_awal,
      keterangan,
      volume,
      satuan,
      tarif_harga,
      program_induk,
      kode_rekening,
      snp,
      no_kelompok,
      kode_kelompok,
      nama_kelompok
    } = req.body;
    const updated = updatePosAnggaran(req.params.id, {
      nama_pos,
      pagu_awal,
      keterangan,
      volume,
      satuan,
      tarif_harga,
      program_induk,
      kode_rekening,
      snp,
      no_kelompok,
      kode_kelompok,
      nama_kelompok
    });

    const { ip, ua } = getClientMeta(req);
    const selisihPagu = (oldPos && Number(oldPos.pagu_awal) !== Number(updated.pagu_awal))
      ? ` Perubahan Plafon: Rp ${Number(oldPos.pagu_awal).toLocaleString('id-ID')} ➔ Rp ${Number(updated.pagu_awal).toLocaleString('id-ID')}.`
      : '';
    logSystemActivity({
      user_id: req.user.id,
      tipe_aksi: 'PAGU',
      aktivitas: `UBAH POS RKAS: Pos "${updated.nama_pos}" (${updated.kode_rekening || '-'}) diperbarui oleh ${req.user.nama_lengkap} (${req.user.role}).${selisihPagu}`,
      ip_address: ip,
      user_agent: ua
    });

    res.json({ success: true, data: updated, message: 'Pos anggaran berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Hapus Pos Anggaran (Hanya Otoritas: ANALISIS_SDM, KEPALA_SEKOLAH, ADMIN)
app.delete('/api/pos-anggaran/:id', requireAuth, (req, res) => {
  try {
    const ALLOWED_DELETE_ROLES = ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'];
    if (!ALLOWED_DELETE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Hanya akun Analisis SDM, Kepala Sekolah, dan Administrator yang berhak menghapus pos anggaran.'
      });
    }

    const result = deletePosAnggaran(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- Pengajuan Kegiatan & RAB Endpoints (FASE 2) ---

// List Pengajuan (Filtered for Guru, Global for Bendahara/Kepsek)
app.get('/api/pengajuan', requireAuth, (req, res) => {
  try {
    const list = getPengajuanList(req.user.id, req.user.role);
    res.json({ success: true, data: list, userRole: req.user.role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Daftar Usulan yang Diarsip (Kotak Sampah)
app.get('/api/pengajuan/arsip', requireAuth, (req, res) => {
  try {
    if (!['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya pimpinan yang dapat melihat arsip usulan terhapus.' });
    }
    const list = getArchivedPengajuanList();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Detail Pengajuan beserta item baris belanja
app.get('/api/pengajuan/:id', requireAuth, (req, res) => {
  try {
    const data = getPengajuanById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Proposal tidak ditemukan' });
    }

    // ISOLASI PRIVASI ANTAR-GURU:
    // Guru dilarang keras membuka data detail usulan milik guru/unit lain
    if (req.user.role === 'GURU' && data.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Berkas RAB ini bersifat privat. Anda hanya berhak mengakses usulan kegiatan yang Anda ajukan sendiri.'
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Pulihkan (Restore) Usulan dari Kotak Sampah
app.post('/api/pengajuan/:id/restore', requireAuth, (req, res) => {
  try {
    if (!['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Hanya pimpinan yang berwenang memulihkan usulan.' });
    }
    const result = restorePengajuan(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Pindahkan Usulan ke Pos RKAS Lain (Sebelum Pencairan)
app.post('/api/pengajuan/:id/pindah-pos', requireAuth, (req, res) => {
  try {
    if (!['BENDAHARA', 'ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya pimpinan dan bendahara yang berhak memindahkan pos anggaran.' });
    }
    const { target_pos_id, alasan } = req.body;
    if (!target_pos_id) {
      return res.status(400).json({ success: false, message: 'Pos anggaran tujuan wajib dipilih.' });
    }
    const updated = pindahPosAnggaran({
      proposal_id: Number(req.params.id),
      target_pos_id: Number(target_pos_id),
      user: req.user,
      alasan
    });
    res.json({
      success: true,
      data: updated,
      message: `Pos anggaran usulan "${updated.nama_kegiatan}" berhasil dipindahkan ke "${updated.nama_pos}". Pagu telah disinkronkan.`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Ubah Bidang Penanggung Jawab Kegiatan (Kesiswaan, Kurikulum, Sarpras, Humas)
app.post('/api/pengajuan/:id/bidang', requireAuth, (req, res) => {
  try {
    if (!['BENDAHARA', 'ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya pimpinan dan bendahara yang berhak mengubah bidang penanggung jawab.' });
    }
    const { bidang_kegiatan } = req.body;
    const updated = updateBidangKegiatan({
      proposal_id: Number(req.params.id),
      bidang_kegiatan,
      user: req.user
    });
    res.json({
      success: true,
      data: updated,
      message: `Bidang penanggung jawab usulan berhasil diubah menjadi "${updated.bidang_kegiatan}". Pejabat penandatangan laporan otomatis diperbarui.`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Hapus Usulan Pengajuan (Hanya Otoritas: ANALISIS_SDM, KEPALA_SEKOLAH, ADMIN)
app.delete('/api/pengajuan/:id', requireAuth, (req, res) => {
  try {
    const ALLOWED_DELETE_ROLES = ['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'];
    if (!ALLOWED_DELETE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Hanya akun Analisis SDM, Kepala Sekolah, dan Administrator yang berhak menghapus berkas usulan kegiatan.'
      });
    }

    const alasan = req.body ? req.body.alasan : '';
    const result = deletePengajuan(Number(req.params.id), req.user, alasan);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Buat Usulan Proposal Kegiatan & Rincian RAB Baru
app.post('/api/pengajuan', requireAuth, (req, res) => {
  try {
    const { pos_anggaran_id, nama_kegiatan, latar_belakang, tanggal_mulai, tanggal_selesai, items, bidang_kegiatan } = req.body;
    
    if (!pos_anggaran_id || !nama_kegiatan) {
      return res.status(400).json({ success: false, message: 'Pos anggaran dan nama kegiatan wajib diisi.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Harap tambahkan minimal 1 baris item belanja.' });
    }

    const created = createPengajuan({
      user_id: req.user.id,
      pos_anggaran_id: Number(pos_anggaran_id),
      nama_kegiatan,
      latar_belakang,
      tanggal_mulai,
      tanggal_selesai,
      items,
      bidang_kegiatan
    });

    res.status(201).json({
      success: true,
      data: created,
      message: `Proposal "${created.nama_kegiatan}" berhasil diajukan dengan nomor ${created.nomor_surat_ajuan}. Pagu otomatis dicadangkan.`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- FASE 3: Review Bendahara & Otorisasi Bertingkat Endpoints ---

// Review & Koreksi oleh Bendahara
app.post('/api/pengajuan/:id/review', requireAuth, (req, res) => {
  try {
    const { items_koreksi, catatan_bendahara, tindakan } = req.body;
    const targetProposal = getPengajuanById(Number(req.params.id));
    if (targetProposal && targetProposal.user_id === req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Anda tidak dapat menelaah atau menyetujui usulan kegiatan yang Anda ajukan sendiri. Otorisasi harus dilakukan oleh pejabat berwenang lainnya.'
      });
    }
    
    // Verifikasi peran
    if (!['BENDAHARA', 'ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara, Analis SDM, Kepala Sekolah, atau Admin yang berhak menelaah anggaran.' });
    }

    const updated = reviewProposalByBendahara({
      proposal_id: Number(req.params.id),
      user_id: req.user.id,
      items_koreksi,
      catatan_bendahara,
      tindakan // 'SETUJUI' atau 'REVISI'
    });

    let msg = 'Penelaahan anggaran berhasil diproses.';
    if (updated.status === 'MENUNGGU_PERSETUJUAN_KEPSEK') {
      msg = `Hasil koreksi (Rp ${updated.total_dana_disetujui.toLocaleString('id-ID')}) >= Rp 1.000.000. Proposal otomatis diteruskan ke Kepala Sekolah.`;
    } else if (updated.status === 'DISETUJUI') {
      msg = `Proposal disetujui langsung oleh Bendahara (Nominal Rp ${updated.total_dana_disetujui.toLocaleString('id-ID')} < Rp 1.000.000).`;
    } else if (updated.status === 'PERLU_REVISI') {
      msg = 'Proposal dikembalikan ke Guru untuk revisi.';
    }

    res.json({ success: true, data: updated, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Keputusan Otorisasi Final oleh Kepala Sekolah / Analisis SDM
app.post('/api/pengajuan/:id/kepsek-decision', requireAuth, (req, res) => {
  try {
    const { tindakan, catatan_kepsek } = req.body;
    const targetProposal = getPengajuanById(Number(req.params.id));
    if (targetProposal && targetProposal.user_id === req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Anda tidak dapat memberikan otorisasi pimpinan pada usulan kegiatan yang Anda ajukan sendiri.'
      });
    }

    // Kepala Sekolah dan Analisis SDM memiliki otoritas pengesahan yang setara
    if (req.user.role !== 'KEPALA_SEKOLAH' && req.user.role !== 'ANALISIS_SDM' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Kepala Sekolah atau Analisis SDM yang berhak memberikan otorisasi final.' });
    }

    const updated = decisionProposalByKepsek({
      proposal_id: Number(req.params.id),
      user_id: req.user.id,
      tindakan, // 'APPROVE' atau 'REVISI'
      catatan_kepsek
    });

    const roleName = req.user.role === 'ANALISIS_SDM' ? 'Analisis SDM' : 'Kepala Sekolah';
    const msg = tindakan === 'APPROVE'
      ? `Usulan anggaran "${updated.nama_kegiatan}" telah DISETUJUI & DISAHKAN oleh ${req.user.nama_lengkap} (${roleName}).`
      : `Proposal dikembalikan oleh ${req.user.nama_lengkap} (${roleName}) untuk revisi.`;

    res.json({ success: true, data: updated, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get Audit Trail Logs for Proposal
app.get('/api/pengajuan/:id/audit', requireAuth, (req, res) => {
  try {
    const proposal = getPengajuanById(Number(req.params.id));
    if (proposal && req.user.role === 'GURU' && proposal.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Jejak audit guru lain bersifat rahasia.' });
    }
    const logs = getAuditLogs(Number(req.params.id));
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================================================
// FASE 4: MODUL PENCAIRAN KAS & DISPOSISI BER-QR CODE RESMI
// ==========================================================================

// 1. Eksekusi Pencairan Kas oleh Bendahara / Admin (Mendukung Upload Bukti Transfer & No Kode Kwitansi)
app.post('/api/pengajuan/:id/cairkan', requireAuth, uploadNota.single('file_bukti_transfer'), (req, res) => {
  try {
    const {
      metode_pencairan,
      bank_tujuan,
      nomor_rekening,
      penerima_dana,
      nomor_referensi_transfer,
      tanggal_pencairan,
      catatan_pencairan,
      nomor_kode_kwitansi
    } = req.body;

    if (!['BENDAHARA', 'ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara, Analis SDM, Kepala Sekolah, atau Admin yang berhak mencairkan kas.' });
    }

    const targetProposal = getPengajuanById(Number(req.params.id));
    if (targetProposal && targetProposal.user_id === req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Anda tidak dapat mencairkan kas untuk usulan kegiatan yang Anda ajukan sendiri.'
      });
    }

    if (!metode_pencairan) {
      return res.status(400).json({ success: false, message: 'Pilihan metode pencairan (TUNAI/TRANSFER_BANK) wajib diisi.' });
    }

    let fileBuktiTransferUrl = null;
    if (req.file) {
      fileBuktiTransferUrl = `/uploads/transfer/${req.file.filename}`;
    } else if (req.body.existing_bukti_transfer_url) {
      fileBuktiTransferUrl = req.body.existing_bukti_transfer_url;
    }

    const updated = disburseProposal({
      proposal_id: Number(req.params.id),
      user_id: req.user.id,
      metode_pencairan,
      bank_tujuan,
      nomor_rekening,
      penerima_dana,
      nomor_referensi_transfer,
      tanggal_pencairan,
      catatan_pencairan,
      file_bukti_transfer_url: fileBuktiTransferUrl,
      nomor_kode_kwitansi: nomor_kode_kwitansi || null
    });

    res.json({
      success: true,
      data: updated,
      message: `Kas sebesar Rp ${updated.total_dana_disetujui.toLocaleString('id-ID')} berhasil dicairkan dan dibukukan resmi.`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 1B. Endpoint Upload / Update Bukti Transfer Kas Susulan
app.post('/api/pengajuan/:id/bukti-transfer', requireAuth, uploadNota.single('file_bukti_transfer'), (req, res) => {
  try {
    if (!['BENDAHARA', 'ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara, Analis SDM, Kepala Sekolah, atau Admin yang berhak mengunggah bukti transfer.' });
    }
    const proposalId = Number(req.params.id);
    const proposal = getPengajuanById(proposalId);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal kegiatan tidak ditemukan.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Harap pilih berkas gambar atau PDF bukti transfer bank / slip kas.' });
    }

    const fileUrl = `/uploads/transfer/${req.file.filename}`;
    const nomorKodeKwitansi = req.body.nomor_kode_kwitansi || proposal.nomor_kode_kwitansi || '7';

    const updated = updateBuktiTransfer({
      proposal_id: proposalId,
      user_id: req.user.id,
      file_bukti_transfer_url: fileUrl,
      nomor_kode_kwitansi: nomorKodeKwitansi
    });

    res.json({
      success: true,
      data: updated,
      file_url: fileUrl,
      message: 'Bukti transfer kas / slip bank berhasil disimpan dan dilampirkan.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Endpoint Data QR Code Proposal
app.get('/api/pengajuan/:id/qr', async (req, res) => {
  try {
    const proposal = getPengajuanById(Number(req.params.id));
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal tidak ditemukan.' });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const verifyUrl = `${protocol}://${host}/verifikasi/${proposal.kode_verifikasi_qr}`;

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    res.json({ success: true, qrDataUrl, verifyUrl, kode_verifikasi: proposal.kode_verifikasi_qr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Ekspor & Cetak Dokumen Buku Besar RKAS ---

// 1. Render Lembar Cetak / Ekspor PDF Buku Besar RKAS Resmi (A4 Landscape)
app.get('/cetak/rkas', (req, res) => {
  try {
    const rkasCookies = parseCookies(req);
    if (!rkasCookies.session_token || !getUserBySessionToken(rkasCookies.session_token)) {
      return res.status(401).send(LOGIN_REQUIRED_HTML);
    }
    const posList = getPosAnggaranList();
    const summary = getSystemSummary();
    const html = renderCetakRkas({ posList, summary });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering cetak rkas:', err);
    res.status(500).send('Gagal memuat format cetak RKAS: ' + err.message);
  }
});

// Pratinjau Standalone KOP Surat Resmi SMA Negeri 1 Gianyar
app.get('/kop-surat', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'kop-surat.html'));
});

// 2. Ekspor Data Buku Besar RKAS ke Format Excel (.xlsx)
app.get('/api/export/rkas/excel', (req, res) => {
  try {
    const list = getPosAnggaranList();
    const summary = getSystemSummary();

    const dataRows = list.map((item, idx) => {
      let trafficLabel = 'AMAN';
      if (item.trafficLight === 'yellow') trafficLabel = 'WASPADA';
      if (item.trafficLight === 'red') trafficLabel = 'KRITIS';

      return {
        'No': idx + 1,
        'Kode Rekening': item.kode_rekening || '-',
        'SNP': item.snp || '-',
        'Program Induk': item.program_induk || '-',
        'Kelompok': item.nama_kelompok || '-',
        'Uraian Pos Anggaran': item.nama_pos,
        'Volume': item.volume || 1,
        'Satuan': item.satuan || 'kegiatan',
        'Pagu Plafon (Rp)': item.pagu_awal || 0,
        'Realisasi Terserap (Rp)': item.total_terserap || 0,
        'Pagu Pending (Rp)': item.pagu_tercadangkan || 0,
        'Sisa Plafon (Rp)': item.sisa_pagu || 0,
        'Serapan (%)': `${item.persentaseTerserap || 0}%`,
        'Status Kontrol': trafficLabel,
        'Keterangan': item.keterangan || ''
      };
    });

    dataRows.push({
      'No': '',
      'Kode Rekening': '',
      'SNP': '',
      'Program Induk': '',
      'Kelompok': '',
      'Uraian Pos Anggaran': 'TOTAL KESELURUHAN BUKU BESAR RKAS',
      'Volume': '',
      'Satuan': '',
      'Pagu Plafon (Rp)': summary.total_pagu || 0,
      'Realisasi Terserap (Rp)': summary.total_terserap || 0,
      'Pagu Pending (Rp)': summary.total_tercadangkan || 0,
      'Sisa Plafon (Rp)': summary.sisa_pagu_aktif || 0,
      'Serapan (%)': `${summary.persentase_terserap || 0}%`,
      'Status Kontrol': '',
      'Keterangan': ''
    });

    const ws = XLSX.utils.json_to_sheet(dataRows);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 24 },
      { wch: 28 },
      { wch: 28 },
      { wch: 42 },
      { wch: 8 },
      { wch: 12 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Buku Besar RKAS 2026-2027');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="RKAS_SMAN1_GIANYAR_2026_2027.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).send('Gagal mengekspor data ke Excel: ' + err.message);
  }
});

// Export Rekapitulasi LPJ & Realisasi Kas ke Excel (.xlsx)
app.get('/api/export/lpj/excel', requireAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const role = req.user ? req.user.role : null;
    const list = getPengajuanList(userId, role);

    // Filter kegiatan yang minimal sudah dicairkan atau memiliki data LPJ
    const lpjList = list.filter(p => 
      p.status === 'DICAIRKAN' || 
      p.status === 'MENUNGGU_VERIFIKASI_LPJ' || 
      p.status === 'SELESAI' || 
      p.lpj_id
    );

    let totalCairAll = 0;
    let totalRiilAll = 0;
    let totalSisaAll = 0;

    const dataRows = lpjList.map((item, idx) => {
      const danaCair = item.lpj_total_cair !== null && item.lpj_total_cair !== undefined ? item.lpj_total_cair : (item.total_dana_disetujui || 0);
      const belanjaRiil = item.lpj_total_belanja_riil !== null && item.lpj_total_belanja_riil !== undefined ? item.lpj_total_belanja_riil : 0;
      const sisaKas = item.lpj_sisa_pengembalian !== null && item.lpj_sisa_pengembalian !== undefined ? item.lpj_sisa_pengembalian : (danaCair - belanjaRiil);
      const notaCount = item.lpj_nota_count || (item.lpj_file_nota_url ? 1 : 0);
      const adaNota = notaCount > 0 ? `${notaCount} Berkas Terlampir` : 'Belum Ada';

      totalCairAll += danaCair;
      totalRiilAll += belanjaRiil;
      totalSisaAll += sisaKas;

      let statusLpjLabel = 'Belum Ada LPJ (Kas Dicairkan)';
      if (item.status === 'MENUNGGU_VERIFIKASI_LPJ') statusLpjLabel = 'Menunggu Verifikasi Bendahara';
      if (item.status === 'SELESAI') statusLpjLabel = 'Disahkan & Selesai';

      return {
        'No': idx + 1,
        'No. Usulan': item.nomor_surat_ajuan || '-',
        'Nama Kegiatan': item.nama_kegiatan,
        'Pemohon (Guru)': `${item.pemohon_nama} (${item.pemohon_unit})`,
        'Pos Anggaran RKAS': item.nama_pos,
        'Tgl Pelaksanaan': `${item.tanggal_mulai || '-'} s/d ${item.tanggal_selesai || '-'}`,
        'Dana Kas Cair (Rp)': danaCair,
        'Belanja Riil (Rp)': belanjaRiil,
        'Sisa Kas Disetor (Rp)': sisaKas,
        'Kelengkapan Nota': adaNota,
        'Status LPJ': statusLpjLabel,
        'Catatan Guru': item.lpj_catatan || '-'
      };
    });

    dataRows.push({
      'No': '',
      'No. Usulan': '',
      'Nama Kegiatan': 'TOTAL REKAPITULASI REALISASI LPJ',
      'Pemohon (Guru)': '',
      'Pos Anggaran RKAS': '',
      'Tgl Pelaksanaan': '',
      'Dana Kas Cair (Rp)': totalCairAll,
      'Belanja Riil (Rp)': totalRiilAll,
      'Sisa Kas Disetor (Rp)': totalSisaAll,
      'Kelengkapan Nota': '',
      'Status LPJ': '',
      'Catatan Guru': ''
    });

    const ws = XLSX.utils.json_to_sheet(dataRows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 38 },
      { wch: 28 },
      { wch: 32 },
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 28 },
      { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi LPJ & Realisasi');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="REKAP_LPJ_REALISASI_SMAN1_GIANYAR.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Export LPJ Excel error:', err);
    res.status(500).send('Gagal mengekspor data LPJ ke Excel: ' + err.message);
  }
});

// 3. Render Lembar Disposisi & Pengesahan RAB Resmi (A4 Print-Ready)
app.get('/cetak/:id', async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const user = cookies.session_token ? getUserBySessionToken(cookies.session_token) : null;
    if (!user) {
      return res.status(401).send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Sesi Berakhir: Silakan login terlebih dahulu untuk mencetak lembar disposisi.</h2>');
    }

    const proposal = getPengajuanById(Number(req.params.id));
    if (!proposal) {
      return res.status(404).send('Proposal tidak ditemukan.');
    }

    // Proteksi Cetak: Guru dilarang mencetak disposisi guru lain
    if (user.role === 'GURU' && proposal.user_id !== user.id) {
      return res.status(403).send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Akses Ditolak: Anda hanya berhak mencetak lembar disposisi usulan kegiatan Anda sendiri.</h2>');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const verifyUrl = `${protocol}://${host}/verifikasi/${proposal.kode_verifikasi_qr}`;

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    const html = renderCetakDisposisi({
      proposal,
      qrDataUrl,
      hostUrl: `${protocol}://${host}`
    });

    res.send(html);
  } catch (err) {
    res.status(500).send('Terjadi kesalahan saat membuat lembar disposisi: ' + err.message);
  }
});

// 3b. Render Lembar Cetak Laporan Kegiatan Resmi (A4 Print-Ready)
app.get('/cetak-lpj/:id', async (req, res) => {
  try {
    const { user, proposal, needLogin } = resolvePrintProposal(req);
    if (needLogin) return res.status(401).send(LOGIN_REQUIRED_HTML);
    if (!proposal) {
      return res.status(404).send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Proposal kegiatan tidak ditemukan.</h2>');
    }

    // Proteksi: Jika guru login dan mencoba membuka LPJ milik orang lain
    if (user && user.role === 'GURU' && proposal.user_id !== user.id) {
      return res.status(403).send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Akses Ditolak: Anda hanya berhak mencetak Laporan Kegiatan Anda sendiri.</h2>');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const verifyUrl = `${protocol}://${host}/verifikasi/${proposal.kode_verifikasi_qr}`;

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#064e3b', light: '#ffffff' }
    });

    const html = renderCetakLpj({
      proposal,
      qrDataUrl,
      hostUrl: `${protocol}://${host}`
    });

    res.send(html);
  } catch (err) {
    res.status(500).send('Terjadi kesalahan saat membuat dokumen cetak LPJ: ' + err.message);
  }
});

// 3c. Render Bundel Cetak Lengkap LPJ Kegiatan Siswa (A4 Print-Ready)
app.get('/cetak-lpj-bundel/:id', async (req, res) => {
  try {
    const { user, proposal, needLogin } = resolvePrintProposal(req);
    if (needLogin) return res.status(401).send(LOGIN_REQUIRED_HTML);
    if (!proposal) {
      return res.status(404).send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Proposal kegiatan tidak ditemukan.</h2>');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const hostUrl = `${protocol}://${host}`;

    const html = renderCetakLpjBundel({
      proposal,
      hostUrl
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering bundel cetak LPJ:', err);
    res.status(500).send('Terjadi kesalahan saat membuat dokumen bundel cetak LPJ: ' + err.message);
  }
});

// 4. Portal Publik Verifikasi Keabsahan Dokumen Digital (Scan QR Code)
app.get('/verifikasi/:token', (req, res) => {
  try {
    const { token } = req.params;
    const proposal = getPengajuanByQrToken(token);

    if (!proposal) {
      const html = renderVerifikasiPublik({ proposal: null, isValid: false });
      return res.status(404).send(html);
    }

    const html = renderVerifikasiPublik({ proposal, isValid: true });
    res.send(html);
  } catch (err) {
    res.status(500).send('Terjadi kesalahan pada server verifikasi.');
  }
});

// ==========================================================================
// FASE 5: MODUL LPJ (LAPORAN PERTANGGUNGJAWABAN) & REKONSILIASI KAS
// ==========================================================================

// 1. Guru Mengajukan LPJ & Mengunggah Nota Fisik (Template Lengkap & Halaman Terpisah)
app.post('/api/pengajuan/:id/lpj', requireAuth, uploadNota.any(), (req, res) => {
  try {
    const {
      total_belanja_riil,
      catatan_lpj,
      tujuan_kegiatan,
      tempat_pelaksanaan,
      jumlah_peserta,
      resume_hasil,
      kendala,
      solusi_tindak_lanjut,
      tanggal_laporan,
      is_draft
    } = req.body;

    // Petakan semua berkas yang terunggah berdasarkan nama field
    const fileMap = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        let sub = 'nota';
        if (f.fieldname === 'file_bukti_transfer') sub = 'transfer';
        else if (f.fieldname === 'file_daftar_hadir') sub = 'daftar_hadir';
        else if (f.fieldname.startsWith('foto_kegiatan')) sub = 'foto';
        fileMap[f.fieldname] = `/uploads/${sub}/${f.filename}`;
      });
    }

    // Berkas Bukti Transfer Bank (jika diunggah/diperbarui oleh Bendahara)
    const fileBuktiTransferUrl = fileMap['file_bukti_transfer'] || req.body.existing_bukti_transfer_url || null;

    // Berkas Daftar Hadir (PDF/Scan)
    const fileDaftarHadirUrl = fileMap['file_daftar_hadir'] || req.body.existing_daftar_hadir_url || null;

    // 1. Parsing data item nota jika dikirim dalam bentuk JSON repeater
    let parsedNotaItems = [];
    if (req.body.nota_items) {
      try {
        parsedNotaItems = typeof req.body.nota_items === 'string' ? JSON.parse(req.body.nota_items) : req.body.nota_items;
      } catch (e) {
        parsedNotaItems = [];
      }
    }

    if (Array.isArray(parsedNotaItems) && parsedNotaItems.length > 0) {
      parsedNotaItems = parsedNotaItems.map((item, idx) => {
        const fileKey = item.file_key || `nota_file_${idx}`;
        const uploadedUrl = fileMap[fileKey];
        return {
          nama_toko: item.nama_toko || 'Toko / Rekanan',
          uraian: item.uraian || '',
          nominal: Number(item.nominal) || 0,
          file_url: uploadedUrl || item.existing_file_url || null
        };
      });
    }

    // 2. Parsing data foto dokumentasi kegiatan
    let parsedFotoItems = [];
    if (req.body.foto_dokumentasi) {
      try {
        parsedFotoItems = typeof req.body.foto_dokumentasi === 'string' ? JSON.parse(req.body.foto_dokumentasi) : req.body.foto_dokumentasi;
      } catch (e) {
        parsedFotoItems = [];
      }
    }

    if (Array.isArray(parsedFotoItems) && parsedFotoItems.length > 0) {
      parsedFotoItems = parsedFotoItems.map((item, idx) => {
        const fileKey = item.file_key || `foto_kegiatan_${idx}`;
        const uploadedUrl = fileMap[fileKey];
        return {
          caption: item.caption || '',
          file_url: uploadedUrl || item.existing_file_url || null
        };
      }).filter(it => it.file_url);
    }

    // 3. Cari URL nota berkas tunggal / gabungan
    let singleFileUrl = fileMap['file_nota'] || null;
    if (!singleFileUrl && req.files && req.files.length > 0) {
      singleFileUrl = `/uploads/nota/${req.files[0].filename}`;
    }

    const isDraft = is_draft === 'true' || is_draft === true;

    const updated = submitLpjByGuru({
      pengajuan_id: Number(req.params.id),
      user_id: req.user.id,
      total_belanja_riil: (total_belanja_riil !== undefined && total_belanja_riil !== '') ? Number(total_belanja_riil) : 0,
      file_nota_url: singleFileUrl,
      file_daftar_hadir_url: fileDaftarHadirUrl,
      catatan_lpj,
      nota_items: parsedNotaItems,
      tujuan_kegiatan,
      tempat_pelaksanaan,
      jumlah_peserta,
      resume_hasil,
      kendala,
      solusi_tindak_lanjut,
      foto_dokumentasi: parsedFotoItems,
      tanggal_laporan,
      is_draft: isDraft,
      file_bukti_transfer_url: fileBuktiTransferUrl
    });

    res.json({
      success: true,
      data: updated,
      is_draft: isDraft,
      message: isDraft
        ? 'Draft Laporan berhasil disimpan. Laporan belum diteruskan ke Bendahara.'
        : 'Laporan berhasil disimpan dan resmi diserahkan ke Bendahara.'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 2. Bendahara Memverifikasi LPJ & Rekonsiliasi Kas Pengembalian
app.post('/api/pengajuan/:id/lpj/verifikasi', requireAuth, (req, res) => {
  try {
    const { tindakan, catatan_verifikasi } = req.body;
    const targetProposal = getPengajuanById(Number(req.params.id));
    if (targetProposal && targetProposal.user_id === req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Akses Ditolak: Anda tidak dapat memverifikasi laporan kegiatan yang Anda ajukan sendiri.'
      });
    }
    if (!['BENDAHARA', 'ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara, Analis SDM, Kepala Sekolah, atau Admin yang berhak memverifikasi berkas LPJ.' });
    }

    const updated = verifyLpjByBendahara({
      pengajuan_id: Number(req.params.id),
      user_id: req.user.id,
      tindakan, // 'TERIMA' atau 'REVISI'
      catatan_verifikasi
    });

    const msg = tindakan === 'TERIMA'
      ? 'LPJ telah disahkan! Sisa dana kas telah dikembalikan ke pos anggaran dan status resmi SELESAI.'
      : 'Berkas LPJ dikembalikan ke guru pemohon untuk perbaikan nota.';

    res.json({ success: true, data: updated, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Global Error Handler Multer & Upload Berkas
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: `Gagal mengunggah berkas: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Format berkas tidak diizinkan! Hanya diperbolehkan berkas gambar (JPG, PNG) atau dokumen PDF.'
    });
  }
  next();
});

// Fallback index (Kompatibel dengan Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Sistem E-RAB Sekolah berjalan aktif di port: ${PORT}`);
  console.log(`📱 URL Lokal: http://localhost:${PORT}`);
  console.log(`🗄️  Database: rab_sekolah.db (SQLite Native)`);
  console.log(`====================================================`);
});
