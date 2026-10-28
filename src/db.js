const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, '..', 'rab_sekolah.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_lengkap TEXT NOT NULL,
      nip TEXT,
      email TEXT,
      role TEXT NOT NULL, -- GURU, BENDAHARA, KEPALA_SEKOLAH, ADMIN
      unit_bagian TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pos_anggaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_pos TEXT NOT NULL,
      tahun_ajaran TEXT NOT NULL,
      pagu_awal REAL NOT NULL,
      total_terserap REAL DEFAULT 0,
      pagu_tercadangkan REAL DEFAULT 0,
      keterangan TEXT
    );

    CREATE TABLE IF NOT EXISTS pengajuan_kegiatan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      pos_anggaran_id INTEGER NOT NULL REFERENCES pos_anggaran(id),
      nomor_surat_ajuan TEXT UNIQUE,
      nama_kegiatan TEXT NOT NULL,
      latar_belakang TEXT,
      tanggal_mulai TEXT,
      tanggal_selesai TEXT,
      total_dana_diajukan REAL DEFAULT 0,
      total_dana_disetujui REAL DEFAULT 0,
      status TEXT DEFAULT 'MENUNGGU_REVIEW', 
      metode_pencairan TEXT, 
      nomor_referensi_transfer TEXT,
      tanggal_pencairan TEXT,
      catatan_bendahara TEXT,
      kode_verifikasi_qr TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS rincian_rab_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pengajuan_id INTEGER NOT NULL REFERENCES pengajuan_kegiatan(id) ON DELETE CASCADE,
      kategori_belanja TEXT NOT NULL,
      deskripsi_item TEXT NOT NULL,
      volume_ajuan REAL NOT NULL,
      satuan TEXT NOT NULL,
      harga_satuan_ajuan REAL NOT NULL,
      subtotal_ajuan REAL NOT NULL,
      volume_disetujui REAL,
      harga_satuan_disetujui REAL,
      subtotal_disetujui REAL,
      catatan_koreksi TEXT,
      status_item TEXT DEFAULT 'MENUNGGU'
    );

    CREATE TABLE IF NOT EXISTS lpj_pertanggungjawaban (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pengajuan_id INTEGER NOT NULL REFERENCES pengajuan_kegiatan(id),
      total_dana_cair REAL NOT NULL,
      total_belanja_riil REAL NOT NULL,
      sisa_pengembalian_dana REAL NOT NULL,
      file_nota_url TEXT,
      catatan_lpj TEXT,
      status_lpj TEXT DEFAULT 'MENUNGGU_VERIFIKASI',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS audit_log_koreksi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pengajuan_id INTEGER REFERENCES pengajuan_kegiatan(id),
      user_id INTEGER REFERENCES users(id),
      aktivitas TEXT NOT NULL,
      waktu_dibuat TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (nama_lengkap, nip, email, role, unit_bagian)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run('I Putu Agus Pratama, S.Pd', '198507122010011008', 'agus.osis@sekolah.sch.id', 'GURU', 'Pembina OSIS & Kesiswaan');
    insertUser.run('Ni Luh Made Lestari, M.Pd', '198804252014022003', 'lestari.pramuka@sekolah.sch.id', 'GURU', 'Pembina Pramuka & Ekstrakurikuler');
    insertUser.run('Ibu Ni Made Ratna Dewi, S.E', '198203152008012015', 'ratna.bendahara@sekolah.sch.id', 'BENDAHARA', 'Sub Bagian Keuangan & Tata Usaha');
    insertUser.run('Drs. I Wayan Sudarsana, M.Pd', '196811201994121001', 'kepsek@sekolah.sch.id', 'KEPALA_SEKOLAH', 'Pimpinan Institusi');
    insertUser.run('Administrator Sistem IT', '199501012022011002', 'admin@sekolah.sch.id', 'ADMIN', 'Unit Pusat Data & TIK');
  }

  const posCount = db.prepare('SELECT COUNT(*) as count FROM pos_anggaran').get().count;
  if (posCount === 0) {
    const insertPos = db.prepare(`
      INSERT INTO pos_anggaran (nama_pos, tahun_ajaran, pagu_awal, total_terserap, pagu_tercadangkan, keterangan)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertPos.run('Kegiatan Kesiswaan, LDKS & OSIS', '2026/2027', 25000000, 6500000, 1500000, 'Alokasi pembinaan kesiswaan, pemilihan pengurus OSIS, dan kepemimpinan.');
    insertPos.run('Pengembangan Kurikulum & Pelatihan Guru', '2026/2027', 20000000, 4200000, 0, 'Workshop penyusunan perangkat ajar, IKM, dan diklat peningkatan mutu.');
    insertPos.run('Pemeliharaan Sarana & Prasarana Sekolah', '2026/2027', 35000000, 12800000, 2500000, 'Perbaikan fasilitas ruang kelas, laboratorium komputer, dan sanitasi.');
    insertPos.run('Lomba Akademik, Seni & Olahraga', '2026/2027', 15000000, 3100000, 0, 'Biaya pendaftaran kejuaraan, transportasi peserta didik, dan apresiasi.');
  }
}

// Queries & Calculations
function getPosAnggaranList() {
  const rows = db.prepare(`
    SELECT id, nama_pos, tahun_ajaran, pagu_awal, total_terserap, pagu_tercadangkan, keterangan,
           (pagu_awal - total_terserap - pagu_tercadangkan) AS sisa_pagu
    FROM pos_anggaran
    ORDER BY id ASC
  `).all();

  return rows.map(item => {
    const persentaseTerserap = item.pagu_awal > 0 ? ((item.total_terserap + item.pagu_tercadangkan) / item.pagu_awal) * 100 : 0;
    let trafficLight = 'green'; // Aman
    if (persentaseTerserap >= 90) {
      trafficLight = 'red'; // Kritis
    } else if (persentaseTerserap >= 70) {
      trafficLight = 'yellow'; // Waspada
    }

    return {
      ...item,
      persentaseTerserap: Math.min(100, Math.round(persentaseTerserap * 10) / 10),
      trafficLight
    };
  });
}

function getPosAnggaranById(id) {
  const item = db.prepare(`
    SELECT id, nama_pos, tahun_ajaran, pagu_awal, total_terserap, pagu_tercadangkan, keterangan,
           (pagu_awal - total_terserap - pagu_tercadangkan) AS sisa_pagu
    FROM pos_anggaran
    WHERE id = ?
  `).get(id);

  if (!item) return null;

  const persentaseTerserap = item.pagu_awal > 0 ? ((item.total_terserap + item.pagu_tercadangkan) / item.pagu_awal) * 100 : 0;
  let trafficLight = 'green';
  if (persentaseTerserap >= 90) trafficLight = 'red';
  else if (persentaseTerserap >= 70) trafficLight = 'yellow';

  return {
    ...item,
    persentaseTerserap: Math.min(100, Math.round(persentaseTerserap * 10) / 10),
    trafficLight
  };
}

function createPosAnggaran({ nama_pos, tahun_ajaran, pagu_awal, keterangan }) {
  const stmt = db.prepare(`
    INSERT INTO pos_anggaran (nama_pos, tahun_ajaran, pagu_awal, total_terserap, pagu_tercadangkan, keterangan)
    VALUES (?, ?, ?, 0, 0, ?)
  `);
  const result = stmt.run(nama_pos, tahun_ajaran || '2026/2027', Number(pagu_awal) || 0, keterangan || '');
  return getPosAnggaranById(result.lastInsertRowid);
}

function updatePosAnggaran(id, { nama_pos, pagu_awal, keterangan }) {
  const stmt = db.prepare(`
    UPDATE pos_anggaran
    SET nama_pos = COALESCE(?, nama_pos),
        pagu_awal = COALESCE(?, pagu_awal),
        keterangan = COALESCE(?, keterangan)
    WHERE id = ?
  `);
  stmt.run(nama_pos, pagu_awal !== undefined ? Number(pagu_awal) : null, keterangan, id);
  return getPosAnggaranById(id);
}

function getAllUsers() {
  return db.prepare('SELECT id, nama_lengkap, nip, email, role, unit_bagian FROM users ORDER BY id ASC').all();
}

function getUserById(id) {
  return db.prepare('SELECT id, nama_lengkap, nip, email, role, unit_bagian FROM users WHERE id = ?').get(id);
}

function getSystemSummary() {
  const totals = db.prepare(`
    SELECT 
      SUM(pagu_awal) as total_pagu,
      SUM(total_terserap) as total_terserap,
      SUM(pagu_tercadangkan) as total_tercadangkan
    FROM pos_anggaran
  `).get();

  const total_pagu = totals.total_pagu || 0;
  const total_terserap = totals.total_terserap || 0;
  const total_tercadangkan = totals.total_tercadangkan || 0;
  const sisa_pagu_aktif = total_pagu - total_terserap - total_tercadangkan;

  const countProposal = db.prepare('SELECT COUNT(*) as count FROM pengajuan_kegiatan').get().count;
  const countPending = db.prepare("SELECT COUNT(*) as count FROM pengajuan_kegiatan WHERE status IN ('MENUNGGU_REVIEW', 'MENUNGGU_PERSETUJUAN_KEPSEK')").get().count;

  return {
    total_pagu,
    total_terserap,
    total_tercadangkan,
    sisa_pagu_aktif,
    persentase_terserap: total_pagu > 0 ? Math.round(((total_terserap + total_tercadangkan) / total_pagu) * 100) : 0,
    count_proposal: countProposal,
    count_pending: countPending
  };
}

function generateNomorSurat() {
  const currentYear = new Date().getFullYear();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM pengajuan_kegiatan').get();
  const nextNum = (countRow.count + 1).toString().padStart(3, '0');
  return `RAB/${currentYear}/${nextNum}`;
}

function createPengajuan({ user_id, pos_anggaran_id, nama_kegiatan, latar_belakang, tanggal_mulai, tanggal_selesai, items }) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Minimal harus ada 1 item belanja dalam rincian RAB.');
  }

  // 1. Verifikasi Pos Anggaran & Sisa Pagu Aktif (Server-Side Validation)
  const pos = getPosAnggaranById(pos_anggaran_id);
  if (!pos) {
    throw new Error('Pos anggaran tidak ditemukan.');
  }

  // Hitung total dana diajukan dari baris item
  let totalAjuan = 0;
  const processedItems = items.map(item => {
    const vol = Number(item.volume) || 0;
    const harga = Number(item.harga_satuan) || 0;
    const subtotal = vol * harga;
    totalAjuan += subtotal;
    return {
      kategori_belanja: item.kategori || 'Perlengkapan',
      deskripsi_item: item.deskripsi || '',
      volume_ajuan: vol,
      satuan: item.satuan || 'Unit',
      harga_satuan_ajuan: harga,
      subtotal_ajuan: subtotal
    };
  });

  if (totalAjuan <= 0) {
    throw new Error('Total dana belanja harus lebih besar dari Rp 0.');
  }

  if (totalAjuan > pos.sisa_pagu) {
    throw new Error(`Total usulan (Rp ${totalAjuan.toLocaleString('id-ID')}) melebihi sisa pagu aktif yang tersedia (Rp ${pos.sisa_pagu.toLocaleString('id-ID')}).`);
  }

  const nomorSurat = generateNomorSurat();
  const kodeVerifikasi = 'VERIF-' + Math.random().toString(36).substring(2, 10).toUpperCase();

  // 2. Simpan Header Pengajuan
  const insertPengajuan = db.prepare(`
    INSERT INTO pengajuan_kegiatan (
      user_id, pos_anggaran_id, nomor_surat_ajuan, nama_kegiatan, latar_belakang,
      tanggal_mulai, tanggal_selesai, total_dana_diajukan, total_dana_disetujui,
      status, kode_verifikasi_qr
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU_REVIEW', ?)
  `);

  const resultPengajuan = insertPengajuan.run(
    user_id,
    pos_anggaran_id,
    nomorSurat,
    nama_kegiatan,
    latar_belakang || '',
    tanggal_mulai || '',
    tanggal_selesai || '',
    totalAjuan,
    totalAjuan, // Awalnya sama dengan ajuan sebelum koreksi bendahara
    kodeVerifikasi
  );

  const pengajuanId = resultPengajuan.lastInsertRowid;

  // 3. Simpan Baris Rincian Item Belanja
  const insertItem = db.prepare(`
    INSERT INTO rincian_rab_item (
      pengajuan_id, kategori_belanja, deskripsi_item, volume_ajuan, satuan,
      harga_satuan_ajuan, subtotal_ajuan, volume_disetujui, harga_satuan_disetujui,
      subtotal_disetujui, status_item
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU')
  `);

  for (const item of processedItems) {
    insertItem.run(
      pengajuanId,
      item.kategori_belanja,
      item.deskripsi_item,
      item.volume_ajuan,
      item.satuan,
      item.harga_satuan_ajuan,
      item.subtotal_ajuan,
      item.volume_ajuan, // Disetujui awal sama sebelum koreksi
      item.harga_satuan_ajuan,
      item.subtotal_ajuan
    );
  }

  // 4. Kunci / Cadangkan Pagu (Reserved Budget) agar sisa langsung terpotong secara aman
  db.prepare(`
    UPDATE pos_anggaran
    SET pagu_tercadangkan = pagu_tercadangkan + ?
    WHERE id = ?
  `).run(totalAjuan, pos_anggaran_id);

  // 5. Audit Log
  const user = getUserById(user_id);
  db.prepare(`
    INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
    VALUES (?, ?, ?)
  `).run(
    pengajuanId,
    user_id,
    `Proposal "${nama_kegiatan}" diajukan oleh ${user ? user.nama_lengkap : 'Guru'} sebesar Rp ${totalAjuan.toLocaleString('id-ID')}`
  );

  return getPengajuanById(pengajuanId);
}

function getPengajuanList(userId = null, role = null) {
  let sql = `
    SELECT p.*, 
           u.nama_lengkap AS pemohon_nama, 
           u.unit_bagian AS pemohon_unit,
           u.role AS pemohon_role,
           pos.nama_pos,
           pos.tahun_ajaran
    FROM pengajuan_kegiatan p
    JOIN users u ON p.user_id = u.id
    JOIN pos_anggaran pos ON p.pos_anggaran_id = pos.id
  `;

  const params = [];
  // Jika Guru, hanya tampilkan usulannya sendiri
  if (role === 'GURU' && userId) {
    sql += ` WHERE p.user_id = ? `;
    params.push(userId);
  }

  sql += ` ORDER BY p.id DESC `;
  return db.prepare(sql).all(...params);
}

function getPengajuanById(id) {
  const proposal = db.prepare(`
    SELECT p.*, 
           u.nama_lengkap AS pemohon_nama, 
           u.nip AS pemohon_nip,
           u.unit_bagian AS pemohon_unit,
           u.role AS pemohon_role,
           pos.nama_pos,
           pos.tahun_ajaran,
           pos.pagu_awal,
           (pos.pagu_awal - pos.total_terserap - pos.pagu_tercadangkan) AS sisa_pagu_pos
    FROM pengajuan_kegiatan p
    JOIN users u ON p.user_id = u.id
    JOIN pos_anggaran pos ON p.pos_anggaran_id = pos.id
    WHERE p.id = ?
  `).get(id);

  if (!proposal) return null;

  const items = db.prepare(`
    SELECT * FROM rincian_rab_item
    WHERE pengajuan_id = ?
    ORDER BY id ASC
  `).all(id);

  return {
    ...proposal,
    items
  };
}

module.exports = {
  db,
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
  getPengajuanById
};
