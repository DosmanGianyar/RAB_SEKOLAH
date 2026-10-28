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
  getSystemSummary
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
