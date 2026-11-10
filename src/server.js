const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const QRCode = require('qrcode');
const multer = require('multer');
const XLSX = require('xlsx');
const {
  initDatabase,
  getPosAnggaranList,
  getPosAnggaranById,
  createPosAnggaran,
  updatePosAnggaran,
  deletePosAnggaran,
  importRkasFromExcel,
  getAllUsers,
  getUserById,
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
  getPengajuanByQrToken,
  submitLpjByGuru,
  verifyLpjByBendahara,
  getAuditLogs
} = require('./db');

const { renderCetakDisposisi } = require('./views/cetak-disposisi');
const { renderCetakLpj } = require('./views/cetak-lpj');
const { renderCetakRkas } = require('./views/cetak-rkas');
const { renderVerifikasiPublik } = require('./views/verifikasi-publik');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'nota');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer untuk Unggah Berkas Nota LPJ (Fase 5)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'nota-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, safeName);
  }
});

const uploadNota = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Maksimal 10MB
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
  res.setHeader('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
  res.json({ success: true, user, message: `Beralih ke akun ${user.nama_lengkap} (${user.role})` });
});

// List all users
app.get('/api/users', (req, res) => {
  const users = getAllUsers();
  res.json({ success: true, users });
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

    const result = deletePengajuan(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Buat Usulan Proposal Kegiatan & Rincian RAB Baru
app.post('/api/pengajuan', requireAuth, (req, res) => {
  try {
    const { pos_anggaran_id, nama_kegiatan, latar_belakang, tanggal_mulai, tanggal_selesai, items } = req.body;
    
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
      items
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
    
    // Verifikasi peran
    if (req.user.role !== 'BENDAHARA' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara atau Admin yang berhak menelaah anggaran.' });
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

// 1. Eksekusi Pencairan Kas oleh Bendahara / Admin
app.post('/api/pengajuan/:id/cairkan', requireAuth, (req, res) => {
  try {
    const {
      metode_pencairan,
      bank_tujuan,
      nomor_rekening,
      penerima_dana,
      nomor_referensi_transfer,
      tanggal_pencairan,
      catatan_pencairan
    } = req.body;

    if (req.user.role !== 'BENDAHARA' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara atau Admin yang berhak mencairkan kas.' });
    }

    if (!metode_pencairan) {
      return res.status(400).json({ success: false, message: 'Pilihan metode pencairan (TUNAI/TRANSFER_BANK) wajib diisi.' });
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
      catatan_pencairan
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

// 3b. Render Lembar Cetak LPJ Lengkap Resmi (A4 Print-Ready)
app.get('/cetak-lpj/:id', async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const user = cookies.session_token ? getUserBySessionToken(cookies.session_token) : null;
    if (!user) {
      return res.status(401).send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Sesi Berakhir: Silakan login terlebih dahulu untuk mencetak LPJ.</h2>');
    }

    const proposal = getPengajuanById(Number(req.params.id));
    if (!proposal) {
      return res.status(404).send('Proposal kegiatan tidak ditemukan.');
    }

    // Proteksi: Guru hanya mencetak LPJ miliknya sendiri
    if (user.role === 'GURU' && proposal.user_id !== user.id) {
      return res.status(403).send('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#e11d48;">Akses Ditolak: Anda hanya berhak mencetak LPJ kegiatan Anda sendiri.</h2>');
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
      solusi_tindak_lanjut
    } = req.body;

    // Petakan semua berkas yang terunggah berdasarkan nama field (misal: nota_file_0, foto_kegiatan_0, file_nota)
    const fileMap = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        fileMap[f.fieldname] = `/uploads/nota/${f.filename}`;
      });
    }

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

    const updated = submitLpjByGuru({
      pengajuan_id: Number(req.params.id),
      user_id: req.user.id,
      total_belanja_riil: (total_belanja_riil !== undefined && total_belanja_riil !== '') ? Number(total_belanja_riil) : 0,
      file_nota_url: singleFileUrl,
      catatan_lpj,
      nota_items: parsedNotaItems,
      tujuan_kegiatan,
      tempat_pelaksanaan,
      jumlah_peserta,
      resume_hasil,
      kendala,
      solusi_tindak_lanjut,
      foto_dokumentasi: parsedFotoItems
    });

    res.json({
      success: true,
      data: updated,
      message: 'Laporan Pertanggungjawaban (LPJ) & berkas bukti berhasil disimpan.'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 2. Bendahara Memverifikasi LPJ & Rekonsiliasi Kas Pengembalian
app.post('/api/pengajuan/:id/lpj/verifikasi', requireAuth, (req, res) => {
  try {
    const { tindakan, catatan_verifikasi } = req.body;
    if (req.user.role !== 'BENDAHARA' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara atau Admin yang berhak memverifikasi berkas LPJ.' });
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
