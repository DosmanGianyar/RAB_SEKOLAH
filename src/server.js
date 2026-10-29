const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const QRCode = require('qrcode');
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
  disburseProposal,
  getPengajuanByQrToken,
  getAuditLogs
} = require('./db');

const { renderCetakDisposisi } = require('./views/cetak-disposisi');
const { renderVerifikasiPublik } = require('./views/verifikasi-publik');

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
    const activeUser = getUserById(currentActiveUserId) || getUserById(1);
    const data = getPengajuanById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Proposal tidak ditemukan' });
    }

    // ISOLASI PRIVASI ANTAR-GURU:
    // Guru dilarang keras membuka data detail usulan milik guru/unit lain
    if (activeUser.role === 'GURU' && data.user_id !== activeUser.id) {
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
    const activeUser = getUserById(currentActiveUserId) || getUserById(1);
    const proposal = getPengajuanById(Number(req.params.id));
    if (proposal && activeUser.role === 'GURU' && proposal.user_id !== activeUser.id) {
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
app.post('/api/pengajuan/:id/cairkan', (req, res) => {
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

    const activeUser = getUserById(currentActiveUserId);
    if (activeUser && activeUser.role !== 'BENDAHARA' && activeUser.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Hanya Bendahara atau Admin yang berhak mencairkan kas.' });
    }

    if (!metode_pencairan) {
      return res.status(400).json({ success: false, message: 'Pilihan metode pencairan (TUNAI/TRANSFER_BANK) wajib diisi.' });
    }

    const updated = disburseProposal({
      proposal_id: Number(req.params.id),
      user_id: currentActiveUserId,
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

// 3. Render Lembar Disposisi & Pengesahan RAB Resmi (A4 Print-Ready)
app.get('/cetak/:id', async (req, res) => {
  try {
    const activeUser = getUserById(currentActiveUserId) || getUserById(1);
    const proposal = getPengajuanById(Number(req.params.id));
    if (!proposal) {
      return res.status(404).send('Proposal tidak ditemukan.');
    }

    // Proteksi Cetak: Guru dilarang mencetak disposisi guru lain
    if (activeUser.role === 'GURU' && proposal.user_id !== activeUser.id) {
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
