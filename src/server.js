const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const {
  initDatabase,
  getPosAnggaranList,
  getPosAnggaranById,
  createPosAnggaran,
  updatePosAnggaran,
  getAllUsers,
  getUserById,
  getSystemSummary,
  createPengajuan,
  getPengajuanList,
  getPengajuanById,
  reviewProposalByBendahara,
  decisionProposalByKepsek,
  getAuditLogs
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'nota');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Inisialisasi Database SQLite
initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Simulasi Active User Session (Mudah ditukar untuk demo multi-role)
let currentActiveUserId = 1; // Default: Guru OSIS

// --- API Endpoints ---

// Get current simulated user
app.get('/api/auth/active-user', (req, res) => {
  const user = getUserById(currentActiveUserId) || getUserById(1);
  res.json({ success: true, user });
});

// Switch active user (Role Switcher instan untuk demo Guru vs Bendahara vs Kepsek)
app.post('/api/auth/switch-user', (req, res) => {
  const { userId } = req.body;
  const user = getUserById(Number(userId));
  if (!user) {
    return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  }
  currentActiveUserId = user.id;
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

// Pos Anggaran List
app.get('/api/pos-anggaran', (req, res) => {
  const list = getPosAnggaranList();
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

// Add new Pos Anggaran
app.post('/api/pos-anggaran', (req, res) => {
  try {
    const { nama_pos, tahun_ajaran, pagu_awal, keterangan } = req.body;
    if (!nama_pos || !pagu_awal) {
      return res.status(400).json({ success: false, message: 'Nama pos dan pagu awal wajib diisi' });
    }
    const created = createPosAnggaran({ nama_pos, tahun_ajaran, pagu_awal, keterangan });
    res.json({ success: true, data: created, message: 'Pos anggaran berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Pos Anggaran
app.put('/api/pos-anggaran/:id', (req, res) => {
  try {
    const { nama_pos, pagu_awal, keterangan } = req.body;
    const updated = updatePosAnggaran(req.params.id, { nama_pos, pagu_awal, keterangan });
    res.json({ success: true, data: updated, message: 'Pos anggaran berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Pengajuan Kegiatan & RAB Endpoints (FASE 2) ---

// List Pengajuan (Filtered for Guru, Global for Bendahara/Kepsek)
app.get('/api/pengajuan', (req, res) => {
  try {
    const activeUser = getUserById(currentActiveUserId) || getUserById(1);
    const list = getPengajuanList(activeUser.id, activeUser.role);
    res.json({ success: true, data: list, userRole: activeUser.role });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Detail Pengajuan beserta item baris belanja
app.get('/api/pengajuan/:id', (req, res) => {
  try {
    const data = getPengajuanById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Proposal tidak ditemukan' });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Buat Usulan Proposal Kegiatan & Rincian RAB Baru
app.post('/api/pengajuan', (req, res) => {
  try {
    const { pos_anggaran_id, nama_kegiatan, latar_belakang, tanggal_mulai, tanggal_selesai, items } = req.body;
    
    if (!pos_anggaran_id || !nama_kegiatan) {
      return res.status(400).json({ success: false, message: 'Pos anggaran dan nama kegiatan wajib diisi.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Harap tambahkan minimal 1 baris item belanja.' });
    }

    const created = createPengajuan({
      user_id: currentActiveUserId,
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
app.post('/api/pengajuan/:id/review', (req, res) => {
  try {
    const { items_koreksi, catatan_bendahara, tindakan } = req.body;
    const activeUser = getUserById(currentActiveUserId);
    
    // Verifikasi peran
    if (activeUser && activeUser.role !== 'BENDAHARA' && activeUser.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara atau Admin yang berhak menelaah anggaran.' });
    }

    const updated = reviewProposalByBendahara({
      proposal_id: Number(req.params.id),
      user_id: currentActiveUserId,
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

// Keputusan Otorisasi Final oleh Kepala Sekolah
app.post('/api/pengajuan/:id/kepsek-decision', (req, res) => {
  try {
    const { tindakan, catatan_kepsek } = req.body;
    const activeUser = getUserById(currentActiveUserId);

    if (activeUser && activeUser.role !== 'KEPALA_SEKOLAH' && activeUser.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Kepala Sekolah yang berhak memberikan otorisasi final.' });
    }

    const updated = decisionProposalByKepsek({
      proposal_id: Number(req.params.id),
      user_id: currentActiveUserId,
      tindakan, // 'APPROVE' atau 'REVISI'
      catatan_kepsek
    });

    const msg = tindakan === 'APPROVE'
      ? `Usulan anggaran "${updated.nama_kegiatan}" telah DISETUJUI & DISAHKAN oleh Kepala Sekolah.`
      : `Proposal dikembalikan oleh Kepala Sekolah untuk revisi.`;

    res.json({ success: true, data: updated, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get Audit Trail Logs for Proposal
app.get('/api/pengajuan/:id/audit', (req, res) => {
  try {
    const logs = getAuditLogs(Number(req.params.id));
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
