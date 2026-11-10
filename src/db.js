const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

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
      password TEXT DEFAULT 'password123',
      role TEXT NOT NULL, -- GURU, BENDAHARA, KEPALA_SEKOLAH, ADMIN
      unit_bagian TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pos_anggaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_rekening TEXT,
      snp TEXT,
      program_induk TEXT,
      nama_pos TEXT NOT NULL,
      tahun_ajaran TEXT NOT NULL,
      volume REAL DEFAULT 1,
      satuan TEXT DEFAULT 'kegiatan',
      tarif_harga REAL DEFAULT 0,
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

  // Migrasi aman untuk kolom Fase 4 jika belum ada
  const tableInfo = db.prepare(`PRAGMA table_info(pengajuan_kegiatan)`).all();
  const colNames = tableInfo.map(c => c.name);

  if (!colNames.includes('bank_tujuan')) {
    db.prepare(`ALTER TABLE pengajuan_kegiatan ADD COLUMN bank_tujuan TEXT`).run();
  }
  if (!colNames.includes('nomor_rekening')) {
    db.prepare(`ALTER TABLE pengajuan_kegiatan ADD COLUMN nomor_rekening TEXT`).run();
  }
  if (!colNames.includes('penerima_dana')) {
    db.prepare(`ALTER TABLE pengajuan_kegiatan ADD COLUMN penerima_dana TEXT`).run();
  }
  if (!colNames.includes('catatan_pencairan')) {
    db.prepare(`ALTER TABLE pengajuan_kegiatan ADD COLUMN catatan_pencairan TEXT`).run();
  }

  // Migrasi kolom password pada users jika belum ada
  const userTableInfo = db.prepare(`PRAGMA table_info(users)`).all();
  const userColNames = userTableInfo.map(c => c.name);
  if (!userColNames.includes('password')) {
    db.prepare(`ALTER TABLE users ADD COLUMN password TEXT DEFAULT 'password123'`).run();
    db.prepare(`UPDATE users SET password = 'password123' WHERE password IS NULL OR password = ''`).run();
  }

  // Update data detail akun resmi sekolah
  db.prepare(`
    UPDATE users 
    SET nama_lengkap = 'I Putu Darma Putra, S.Pd',
        email = 'darma.osis@sekolah.sch.id',
        unit_bagian = 'Pembina OSIS & Kesiswaan'
    WHERE id = 1
  `).run();

  db.prepare(`
    UPDATE users 
    SET nama_lengkap = 'I Gusti Ngurah Nyoman Okta Ariawan, SSTP',
        email = 'okta.sdm@sekolah.sch.id',
        role = 'ANALISIS_SDM',
        unit_bagian = 'Analisis SDM & Otorisasi Pimpinan'
    WHERE id = 2
  `).run();

  db.prepare(`
    UPDATE users 
    SET nama_lengkap = 'I Gusti Ayu Reina Cahyanti',
        email = 'reina.bendahara@sekolah.sch.id',
        unit_bagian = 'Sub Bagian Keuangan & Tata Usaha'
    WHERE id = 3
  `).run();

  db.prepare(`
    UPDATE users 
    SET nama_lengkap = 'I Wayan Sudra Astra, S.Pd., M.Pd',
        email = 'kepsek@sekolah.sch.id',
        unit_bagian = 'Kepala SMA Negeri 1 Gianyar'
    WHERE id = 4
  `).run();

  // Update akun administrator menjadi 'daput' dengan password '007007'
  db.prepare(`
    UPDATE users 
    SET nama_lengkap = 'daput', email = 'daput', password = '007007'
    WHERE role = 'ADMIN' OR id = 5
  `).run();

  seedInitialData();
}

// Inisialisasi otomatis skema database saat modul dimuat
initDatabase();

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (nama_lengkap, nip, email, password, role, unit_bagian)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('I Putu Darma Putra, S.Pd', '198507122010011008', 'darma.osis@sekolah.sch.id', 'password123', 'GURU', 'Pembina OSIS & Kesiswaan');
    insertUser.run('I Gusti Ngurah Nyoman Okta Ariawan, SSTP', '198804252014022003', 'okta.sdm@sekolah.sch.id', 'password123', 'ANALISIS_SDM', 'Analisis SDM & Otorisasi Pimpinan');
    insertUser.run('I Gusti Ayu Reina Cahyanti', '198203152008012015', 'reina.bendahara@sekolah.sch.id', 'password123', 'BENDAHARA', 'Sub Bagian Keuangan & Tata Usaha');
    insertUser.run('I Wayan Sudra Astra, S.Pd., M.Pd', '196811201994121001', 'kepsek@sekolah.sch.id', 'password123', 'KEPALA_SEKOLAH', 'Kepala SMA Negeri 1 Gianyar');
    insertUser.run('daput', '199501012022011002', 'daput', '007007', 'ADMIN', 'Administrator Sistem');
  }

  // Pastikan kolom baru RKAS tersedia pada tabel pos_anggaran
  const tableInfo = db.prepare("PRAGMA table_info(pos_anggaran)").all();
  const colNames = tableInfo.map(c => c.name);
  if (!colNames.includes('kode_rekening')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN kode_rekening TEXT;");
  if (!colNames.includes('snp')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN snp TEXT;");
  if (!colNames.includes('program_induk')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN program_induk TEXT;");
  if (!colNames.includes('volume')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN volume REAL DEFAULT 1;");
  if (!colNames.includes('satuan')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN satuan TEXT DEFAULT 'kegiatan';");
  if (!colNames.includes('tarif_harga')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN tarif_harga REAL DEFAULT 0;");

  const posCount = db.prepare('SELECT COUNT(*) as count FROM pos_anggaran').get().count;
  if (posCount < 50) {
    importRkasFromExcel();
  }
}

// Importer RKAS Resmi dari Excel (data_luar/rkas.xlsx)
function importRkasFromExcel(customFilePath = null) {
  const xlsxPath = customFilePath || path.join(__dirname, '..', 'data_luar', 'rkas.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.warn('File RKAS Excel tidak ditemukan di:', xlsxPath);
    return false;
  }

  try {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(xlsxPath);
    const sheetName = wb.SheetNames.includes('RKAS 2026 TERBARU') ? 'RKAS 2026 TERBARU' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    function excelTimeToCode(val) {
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'number') {
        const totalSeconds = Math.round(val * 86400);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const pad = (n) => String(n).padStart(2, '0');
        return pad(h) + '.' + pad(m) + '.' + pad(s);
      }
      return '';
    }

    const posList = [];
    let currentGroup = null;

    for (let i = 20; i <= 152; i++) {
      const r = data[i];
      if (!r) continue;

      const no = r[0];
      const kode = excelTimeToCode(r[1]);
      const snpRaw = r[2] ? String(r[2]).trim() : '';
      const subProgRaw = r[3] ? String(r[3]).replace(/\r?\n/g, ' ').trim() : '';
      const uraianRaw = r[4] ? String(r[4]).replace(/\r?\n/g, ' ').trim() : '';
      const vol = r[5] !== undefined ? Number(r[5]) || 0 : 0;
      const sat = r[6] ? String(r[6]).trim() : '';
      const tarif = r[7] !== undefined ? Number(r[7]) || 0 : 0;
      const jml = r[8] !== undefined ? Number(r[8]) || 0 : 0;

      if (no !== undefined && no !== '' && !isNaN(no)) {
        currentGroup = {
          no: Number(no),
          kode: kode || '',
          snp: snpRaw,
          subProg: subProgRaw,
          uraian: uraianRaw,
          vol,
          sat,
          tarif,
          jml,
          children: []
        };
        posList.push(currentGroup);
      } else if (currentGroup && (kode || uraianRaw)) {
        currentGroup.children.push({
          kode: kode || '',
          snp: snpRaw || currentGroup.snp,
          subProg: subProgRaw || currentGroup.subProg,
          uraian: uraianRaw,
          vol,
          sat,
          tarif,
          jml
        });
      }
    }

    const dbRecords = [];
    let currentSnp = 'Standar Proses';

    posList.forEach(g => {
      let snpName = g.snp;
      if (snpName.toLowerCase().includes('proses')) snpName = 'Standar Proses';
      else if (snpName.toLowerCase().includes('sarpras')) snpName = 'Standar Sarana & Prasarana';
      else if (snpName.toLowerCase().includes('pengelolaan')) snpName = 'Standar Pengelolaan';
      else if (snpName.toLowerCase().includes('pembiayaan')) snpName = 'Standar Pembiayaan';
      else snpName = currentSnp;
      currentSnp = snpName;

      const progName = g.subProg || g.uraian;

      if (g.children.length === 0) {
        dbRecords.push({
          kode_rekening: g.kode,
          snp: snpName,
          program_induk: progName,
          nama_pos: g.uraian,
          volume: g.vol || 1,
          satuan: g.sat || 'tahun',
          tarif_harga: g.tarif || g.jml,
          pagu_awal: g.jml,
          tahun_ajaran: '2026/2027',
          keterangan: 'Kelompok ' + g.no + ' • ' + snpName
        });
      } else {
        g.children.forEach(c => {
          dbRecords.push({
            kode_rekening: c.kode,
            snp: snpName,
            program_induk: progName,
            nama_pos: c.uraian,
            volume: c.vol || 1,
            satuan: c.sat || 'kegiatan',
            tarif_harga: c.tarif || c.jml,
            pagu_awal: c.jml,
            tahun_ajaran: '2026/2027',
            keterangan: 'Kelompok ' + g.no + ': ' + progName
          });
        });
      }
    });

    db.exec('PRAGMA foreign_keys = OFF;');

    const existingRows = db.prepare('SELECT id, kode_rekening, nama_pos FROM pos_anggaran').all();
    const mapByKode = new Map();
    const mapByNama = new Map();
    existingRows.forEach(row => {
      if (row.kode_rekening) mapByKode.set(row.kode_rekening, row.id);
      if (row.nama_pos) mapByNama.set(row.nama_pos.toLowerCase().trim(), row.id);
    });

    const updateStmt = db.prepare(`
      UPDATE pos_anggaran SET
        snp = ?, program_induk = ?, nama_pos = ?, tahun_ajaran = ?,
        volume = ?, satuan = ?, tarif_harga = ?, pagu_awal = ?, keterangan = ?
      WHERE id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO pos_anggaran (
        kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
        volume, satuan, tarif_harga, pagu_awal, total_terserap, pagu_tercadangkan, keterangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `);

    for (const r of dbRecords) {
      const existingId = (r.kode_rekening && mapByKode.get(r.kode_rekening)) ||
                         mapByNama.get(r.nama_pos.toLowerCase().trim());

      if (existingId) {
        updateStmt.run(
          r.snp,
          r.program_induk,
          r.nama_pos,
          r.tahun_ajaran,
          r.volume,
          r.satuan,
          r.tarif_harga,
          r.pagu_awal,
          r.keterangan,
          existingId
        );
      } else {
        insertStmt.run(
          r.kode_rekening,
          r.snp,
          r.program_induk,
          r.nama_pos,
          r.tahun_ajaran,
          r.volume,
          r.satuan,
          r.tarif_harga,
          r.pagu_awal,
          r.keterangan
        );
      }
    }

    // Auto-reconcile serapan & cadangan dari seluruh riwayat usulan kegiatan
    db.prepare('UPDATE pos_anggaran SET total_terserap = 0, pagu_tercadangkan = 0').run();
    const activeProps = db.prepare(`
      SELECT pos_anggaran_id, status, total_dana_disetujui, total_dana_diajukan
      FROM pengajuan_kegiatan
      WHERE status != 'DITOLAK'
    `).all();

    for (const p of activeProps) {
      if (!p.pos_anggaran_id) continue;
      const nominal = Number(p.total_dana_disetujui) || Number(p.total_dana_diajukan) || 0;
      if (p.status === 'DICAIRKAN' || p.status === 'MENUNGGU_VERIFIKASI_LPJ' || p.status === 'SELESAI') {
        db.prepare('UPDATE pos_anggaran SET total_terserap = total_terserap + ? WHERE id = ?').run(nominal, p.pos_anggaran_id);
      } else {
        db.prepare('UPDATE pos_anggaran SET pagu_tercadangkan = pagu_tercadangkan + ? WHERE id = ?').run(nominal, p.pos_anggaran_id);
      }
    }

    db.exec('PRAGMA foreign_keys = ON;');

    console.log(`✅ Sukses mengimpor ${dbRecords.length} pos anggaran RKAS 2026 resmi. Total: Rp ${dbRecords.reduce((s, r) => s + r.pagu_awal, 0).toLocaleString('id-ID')}`);
    return true;
  } catch (err) {
    console.error('Gagal mengimpor data RKAS dari Excel:', err);
    return false;
  }
}

// Queries & Calculations
function getPosAnggaranList(snpFilter = null) {
  let query = `
    SELECT id, kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
           volume, satuan, tarif_harga, pagu_awal, total_terserap, pagu_tercadangkan, keterangan,
           (pagu_awal - total_terserap - pagu_tercadangkan) AS sisa_pagu
    FROM pos_anggaran
  `;
  const params = [];
  if (snpFilter && snpFilter !== 'ALL') {
    query += ` WHERE snp = ?`;
    params.push(snpFilter);
  }
  query += ` ORDER BY id ASC`;

  const rows = db.prepare(query).all(...params);

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
    SELECT id, kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
           volume, satuan, tarif_harga, pagu_awal, total_terserap, pagu_tercadangkan, keterangan,
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

function createPosAnggaran({ kode_rekening, snp, program_induk, nama_pos, tahun_ajaran, volume, satuan, tarif_harga, pagu_awal, keterangan }) {
  const stmt = db.prepare(`
    INSERT INTO pos_anggaran (
      kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
      volume, satuan, tarif_harga, pagu_awal, total_terserap, pagu_tercadangkan, keterangan
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `);
  const result = stmt.run(
    kode_rekening || '',
    snp || 'Standar Proses',
    program_induk || 'Program Umum',
    nama_pos,
    tahun_ajaran || '2026/2027',
    Number(volume) || 1,
    satuan || 'kegiatan',
    Number(tarif_harga) || Number(pagu_awal) || 0,
    Number(pagu_awal) || 0,
    keterangan || ''
  );
  return getPosAnggaranById(result.lastInsertRowid);
}

function updatePosAnggaran(id, { nama_pos, pagu_awal, keterangan, volume, satuan, tarif_harga, program_induk, kode_rekening, snp }) {
  const stmt = db.prepare(`
    UPDATE pos_anggaran
    SET nama_pos = COALESCE(?, nama_pos),
        pagu_awal = COALESCE(?, pagu_awal),
        keterangan = COALESCE(?, keterangan),
        volume = COALESCE(?, volume),
        satuan = COALESCE(?, satuan),
        tarif_harga = COALESCE(?, tarif_harga),
        program_induk = COALESCE(?, program_induk),
        kode_rekening = COALESCE(?, kode_rekening),
        snp = COALESCE(?, snp)
    WHERE id = ?
  `);
  stmt.run(
    nama_pos !== undefined ? nama_pos : null,
    pagu_awal !== undefined ? Number(pagu_awal) : null,
    keterangan !== undefined ? keterangan : null,
    volume !== undefined ? Number(volume) : null,
    satuan !== undefined ? satuan : null,
    tarif_harga !== undefined ? Number(tarif_harga) : null,
    program_induk !== undefined ? program_induk : null,
    kode_rekening !== undefined ? kode_rekening : null,
    snp !== undefined ? snp : null,
    id
  );
  return getPosAnggaranById(id);
}

function getAllUsers() {
  // Sembunyikan akun Admin dari seluruh daftar pengguna tampilan
  return db.prepare("SELECT id, nama_lengkap, nip, email, role, unit_bagian FROM users WHERE role != 'ADMIN' ORDER BY id ASC").all();
}

function getUserById(id) {
  return db.prepare('SELECT id, nama_lengkap, nip, email, role, unit_bagian FROM users WHERE id = ?').get(id);
}

// Autentikasi Pengguna & Manajemen Sesi Login Resmi
function authenticateUser(identifier, password) {
  if (!identifier || !password) {
    throw new Error('Username/Email/NIP dan kata sandi wajib diisi.');
  }

  const cleanIdent = identifier.trim().toLowerCase();
  const user = db.prepare(`
    SELECT * FROM users
    WHERE LOWER(email) = ? 
       OR nip = ? 
       OR LOWER(nama_lengkap) = ?
       OR (id = 1 AND ? IN ('darma', 'darma.osis@sekolah.sch.id', 'agus.osis@sekolah.sch.id', 'osis'))
       OR (id = 2 AND ? IN ('okta', 'okta.sdm@sekolah.sch.id', 'lestari.pramuka@sekolah.sch.id', 'sdm'))
       OR (id = 3 AND ? IN ('reina', 'reina.bendahara@sekolah.sch.id', 'ratna.bendahara@sekolah.sch.id', 'bendahara'))
       OR (id = 4 AND ? IN ('sudra', 'sudra.kepsek@sekolah.sch.id', 'kepsek', 'kepsek@sekolah.sch.id'))
       OR (role = 'ADMIN' AND ? IN ('daput', 'daput@sekolah.sch.id', 'admin', 'admin@sekolah.sch.id'))
  `).get(cleanIdent, identifier.trim(), cleanIdent, cleanIdent, cleanIdent, cleanIdent, cleanIdent, cleanIdent);

  if (!user) {
    throw new Error('Akun tidak terdaftar. Periksa kembali Username, Email, atau NIP Anda.');
  }

  const userPass = user.password || 'password123';
  if (password !== userPass) {
    throw new Error('Kata sandi yang Anda masukkan salah.');
  }

  const { password: _, ...userSafe } = user;
  return userSafe;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO user_sessions (token, user_id)
    VALUES (?, ?)
  `).run(token, userId);
  return token;
}

function getUserBySessionToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.nama_lengkap, u.nip, u.email, u.role, u.unit_bagian
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);

  return row || null;
}

function deleteSession(token) {
  if (!token) return;
  db.prepare(`DELETE FROM user_sessions WHERE token = ?`).run(token);
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

  const lpj = db.prepare(`
    SELECT * FROM lpj_pertanggungjawaban
    WHERE pengajuan_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(id);

  return {
    ...proposal,
    items,
    lpj: lpj || null
  };
}

function reviewProposalByBendahara({ proposal_id, user_id, items_koreksi, catatan_bendahara, tindakan }) {
  const proposal = getPengajuanById(proposal_id);
  if (!proposal) {
    throw new Error('Proposal tidak ditemukan.');
  }

  if (proposal.status !== 'MENUNGGU_REVIEW' && proposal.status !== 'PERLU_REVISI') {
    throw new Error(`Proposal berstatus ${proposal.status} dan tidak dalam antrean review bendahara.`);
  }

  const user = getUserById(user_id);
  const reviewerName = user ? user.nama_lengkap : 'Bendahara';

  // Skenario A: Kembalikan untuk Revisi
  if (tindakan === 'REVISI') {
    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET status = 'PERLU_REVISI',
          catatan_bendahara = ?
      WHERE id = ?
    `).run(catatan_bendahara || 'Perlu penyesuaian anggaran.', proposal_id);

    // Lepaskan pagu yang sebelumnya dicadangkan
    db.prepare(`
      UPDATE pos_anggaran
      SET pagu_tercadangkan = MAX(0, pagu_tercadangkan - ?)
      WHERE id = ?
    `).run(proposal.total_dana_diajukan, proposal.pos_anggaran_id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
      VALUES (?, ?, ?)
    `).run(
      proposal_id,
      user_id,
      `${reviewerName} mengembalikan proposal untuk revisi. Catatan: "${catatan_bendahara || '-'}"`
    );

    return getPengajuanById(proposal_id);
  }

  // Skenario B: Proses Setujui / Koreksi Baris
  let totalDisetujui = 0;
  const updateItemStmt = db.prepare(`
    UPDATE rincian_rab_item
    SET volume_disetujui = ?,
        harga_satuan_disetujui = ?,
        subtotal_disetujui = ?,
        catatan_koreksi = ?,
        status_item = ?
    WHERE id = ? AND pengajuan_id = ?
  `);

  if (items_koreksi && Array.isArray(items_koreksi)) {
    for (const it of items_koreksi) {
      const vol = Number(it.volume_disetujui) || 0;
      const harga = Number(it.harga_satuan_disetujui) || 0;
      const subtotal = vol * harga;
      totalDisetujui += subtotal;

      updateItemStmt.run(
        vol,
        harga,
        subtotal,
        it.catatan_koreksi || '',
        it.status_item || 'DITERIMA',
        it.id,
        proposal_id
      );
    }
  } else {
    // Jika tidak ada koreksi spesifik, pakai angka awal
    totalDisetujui = proposal.total_dana_diajukan;
  }

  // Update penyesuaian pagu tercadangkan di pos anggaran
  const selisih = totalDisetujui - proposal.total_dana_diajukan;
  db.prepare(`
    UPDATE pos_anggaran
    SET pagu_tercadangkan = MAX(0, pagu_tercadangkan + ?)
    WHERE id = ?
  `).run(selisih, proposal.pos_anggaran_id);

  // 2-Tier Approval Threshold Check (Ambang Batas Rp 1.000.000)
  let statusBaru = 'DISETUJUI';
  let auditAktivitas = '';

  if (totalDisetujui >= 1000000) {
    statusBaru = 'MENUNGGU_PERSETUJUAN_KEPSEK';
    auditAktivitas = `${reviewerName} menelaah rincian belanja (Total Disetujui: Rp ${totalDisetujui.toLocaleString('id-ID')}). Karena nominal >= Rp 1.000.000, diteruskan ke Kepala Sekolah untuk otorisasi final.`;
  } else {
    statusBaru = 'DISETUJUI';
    auditAktivitas = `${reviewerName} menyetujui langsung usulan belanja sebesar Rp ${totalDisetujui.toLocaleString('id-ID')} (Jalur Cepat: Di bawah Rp 1.000.000).`;
  }

  db.prepare(`
    UPDATE pengajuan_kegiatan
    SET total_dana_disetujui = ?,
        status = ?,
        catatan_bendahara = ?
    WHERE id = ?
  `).run(totalDisetujui, statusBaru, catatan_bendahara || '', proposal_id);

  db.prepare(`
    INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
    VALUES (?, ?, ?)
  `).run(proposal_id, user_id, auditAktivitas);

  return getPengajuanById(proposal_id);
}

function decisionProposalByKepsek({ proposal_id, user_id, tindakan, catatan_kepsek }) {
  const proposal = getPengajuanById(proposal_id);
  if (!proposal) {
    throw new Error('Proposal tidak ditemukan.');
  }

  if (proposal.status !== 'MENUNGGU_PERSETUJUAN_KEPSEK') {
    throw new Error(`Proposal berstatus ${proposal.status} dan tidak sedang menunggu otorisasi pimpinan.`);
  }

  const user = getUserById(user_id);
  const kepsekName = user ? user.nama_lengkap : 'Kepala Sekolah';

  if (tindakan === 'REVISI') {
    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET status = 'PERLU_REVISI',
          catatan_bendahara = COALESCE(catatan_bendahara || ' | ', '') || 'Catatan Kepsek: ' || ?
      WHERE id = ?
    `).run(catatan_kepsek || 'Ditolak/Perlu Revisi oleh Kepala Sekolah', proposal_id);

    // Lepaskan pagu tercadangkan
    db.prepare(`
      UPDATE pos_anggaran
      SET pagu_tercadangkan = MAX(0, pagu_tercadangkan - ?)
      WHERE id = ?
    `).run(proposal.total_dana_disetujui, proposal.pos_anggaran_id);

    db.prepare(`
      INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
      VALUES (?, ?, ?)
    `).run(
      proposal_id,
      user_id,
      `${kepsekName} mengembalikan proposal untuk revisi: "${catatan_kepsek || '-'}"`
    );
  } else {
    // APPROVE
    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET status = 'DISETUJUI'
      WHERE id = ?
    `).run(proposal_id);

    db.prepare(`
      INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
      VALUES (?, ?, ?)
    `).run(
      proposal_id,
      user_id,
      `${kepsekName} memberikan OTORISASI FINAL & MENGESAHKAN anggaran sebesar Rp ${proposal.total_dana_disetujui.toLocaleString('id-ID')}`
    );
  }

  return getPengajuanById(proposal_id);
}

function getAuditLogs(proposal_id) {
  return db.prepare(`
    SELECT a.*, u.nama_lengkap AS user_nama, u.role AS user_role
    FROM audit_log_koreksi a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.pengajuan_id = ?
    ORDER BY a.id ASC
  `).all(proposal_id);
}

// FASE 4: Pencairan Kas (Cash Disbursement by Bendahara/Admin)
function disburseProposal({
  proposal_id,
  user_id,
  metode_pencairan,
  bank_tujuan,
  nomor_rekening,
  penerima_dana,
  nomor_referensi_transfer,
  tanggal_pencairan,
  catatan_pencairan
}) {
  const proposal = getPengajuanById(proposal_id);
  if (!proposal) {
    throw new Error('Proposal kegiatan tidak ditemukan.');
  }

  if (proposal.status !== 'DISETUJUI') {
    throw new Error(`Proposal berstatus "${proposal.status}". Hanya proposal yang telah "DISETUJUI" yang dapat dicairkan dananya.`);
  }

  const user = getUserById(user_id);
  const bendaharaName = user ? user.nama_lengkap : 'Bendahara Sekolah';
  const danaCair = proposal.total_dana_disetujui;
  const tglCair = tanggal_pencairan || new Date().toISOString().split('T')[0];

  // 1. Update status proposal & info pencairan
  db.prepare(`
    UPDATE pengajuan_kegiatan
    SET status = 'DICAIRKAN',
        metode_pencairan = ?,
        bank_tujuan = ?,
        nomor_rekening = ?,
        penerima_dana = ?,
        nomor_referensi_transfer = ?,
        tanggal_pencairan = ?,
        catatan_pencairan = ?
    WHERE id = ?
  `).run(
    metode_pencairan,
    bank_tujuan || null,
    nomor_rekening || null,
    penerima_dana || proposal.pemohon_nama,
    nomor_referensi_transfer || null,
    tglCair,
    catatan_pencairan || null,
    proposal_id
  );

  // 2. Realisasi Kas: Pindahkan pagu dari tercadangkan ke total_terserap
  db.prepare(`
    UPDATE pos_anggaran
    SET pagu_tercadangkan = MAX(0, pagu_tercadangkan - ?),
        total_terserap = total_terserap + ?
    WHERE id = ?
  `).run(danaCair, danaCair, proposal.pos_anggaran_id);

  // 3. Catat di Audit Trail
  const detailMetode = metode_pencairan === 'TRANSFER_BANK'
    ? `Transfer Bank ${bank_tujuan || ''} (No. Rek: ${nomor_rekening || '-'}, Ref: ${nomor_referensi_transfer || '-'})`
    : `Kas Tunai Langsung (Serah Terima Fisik)`;

  db.prepare(`
    INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
    VALUES (?, ?, ?)
  `).run(
    proposal_id,
    user_id,
    `KAS DICAIRKAN: ${bendaharaName} mencairkan dana sebesar Rp ${danaCair.toLocaleString('id-ID')} kepada ${penerima_dana || proposal.pemohon_nama} via ${detailMetode}. Sisa anggaran pos resmi terserap.`
  );

  return getPengajuanById(proposal_id);
}

// FASE 4: Ambil Data Proposal Berdasarkan Token QR Code untuk Verifikasi Publik
function getPengajuanByQrToken(token) {
  const proposal = db.prepare(`
    SELECT p.*, 
           u.nama_lengkap AS pemohon_nama, 
           u.nip AS pemohon_nip,
           u.unit_bagian AS pemohon_unit,
           pos.nama_pos,
           pos.tahun_ajaran
    FROM pengajuan_kegiatan p
    JOIN users u ON p.user_id = u.id
    JOIN pos_anggaran pos ON p.pos_anggaran_id = pos.id
    WHERE p.kode_verifikasi_qr = ?
  `).get(token);

  if (!proposal) return null;

  proposal.items = db.prepare(`
    SELECT * FROM rincian_rab_item
    WHERE pengajuan_id = ?
    ORDER BY id ASC
  `).all(proposal.id);

  proposal.audit_logs = db.prepare(`
    SELECT a.*, u.nama_lengkap AS user_nama, u.role AS user_role
    FROM audit_log_koreksi a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.pengajuan_id = ?
    ORDER BY a.id ASC
  `).all(proposal.id);

  proposal.lpj = db.prepare(`
    SELECT * FROM lpj_pertanggungjawaban
    WHERE pengajuan_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(proposal.id) || null;

  return proposal;
}

// ==========================================================================
// FASE 5: MODUL LPJ (LAPORAN PERTANGGUNGJAWABAN) & REKONSILIASI KAS
// ==========================================================================

// 1. Guru Mengajukan LPJ & Mengunggah Nota
function submitLpjByGuru({
  pengajuan_id,
  user_id,
  total_belanja_riil,
  file_nota_url,
  catatan_lpj
}) {
  const proposal = getPengajuanById(pengajuan_id);
  if (!proposal) {
    throw new Error('Proposal kegiatan tidak ditemukan.');
  }

  if (proposal.status !== 'DICAIRKAN' && proposal.status !== 'MENUNGGU_VERIFIKASI_LPJ') {
    throw new Error(`LPJ hanya dapat diajukan jika dana telah dicairkan (status: DICAIRKAN). Status saat ini: "${proposal.status}".`);
  }

  const user = getUserById(user_id);
  if (user && user.role === 'GURU' && proposal.user_id !== user.id) {
    throw new Error('Akses Ditolak: Anda hanya berhak membuat LPJ dari usulan kegiatan Anda sendiri.');
  }

  const danaCair = proposal.total_dana_disetujui;
  const belanjaRiil = Math.max(0, Number(total_belanja_riil) || 0);
  const sisaPengembalian = Math.max(0, danaCair - belanjaRiil);

  // Periksa apakah LPJ sebelumnya sudah pernah dibuat
  const existingLpj = db.prepare(`
    SELECT id, file_nota_url FROM lpj_pertanggungjawaban WHERE pengajuan_id = ?
  `).get(pengajuan_id);

  const finalFileUrl = file_nota_url || (existingLpj ? existingLpj.file_nota_url : null);

  if (existingLpj) {
    db.prepare(`
      UPDATE lpj_pertanggungjawaban
      SET total_dana_cair = ?,
          total_belanja_riil = ?,
          sisa_pengembalian_dana = ?,
          file_nota_url = ?,
          catatan_lpj = ?,
          status_lpj = 'MENUNGGU_VERIFIKASI',
          created_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(danaCair, belanjaRiil, sisaPengembalian, finalFileUrl, catatan_lpj || '', existingLpj.id);
  } else {
    db.prepare(`
      INSERT INTO lpj_pertanggungjawaban (
        pengajuan_id, total_dana_cair, total_belanja_riil, sisa_pengembalian_dana,
        file_nota_url, catatan_lpj, status_lpj
      ) VALUES (?, ?, ?, ?, ?, ?, 'MENUNGGU_VERIFIKASI')
    `).run(pengajuan_id, danaCair, belanjaRiil, sisaPengembalian, finalFileUrl, catatan_lpj || '');
  }

  // Update status proposal menjadi MENUNGGU_VERIFIKASI_LPJ
  db.prepare(`
    UPDATE pengajuan_kegiatan
    SET status = 'MENUNGGU_VERIFIKASI_LPJ'
    WHERE id = ?
  `).run(pengajuan_id);

  // Catat di Audit Trail
  const guruName = user ? user.nama_lengkap : 'Guru Pemohon';
  let detailInfo = `Belanja Riil: Rp ${belanjaRiil.toLocaleString('id-ID')}`;
  if (sisaPengembalian > 0) {
    detailInfo += ` (Sisa kas disetor kembali: Rp ${sisaPengembalian.toLocaleString('id-ID')})`;
  } else if (belanjaRiil > danaCair) {
    detailInfo += ` (Kelebihan biaya: Rp ${(belanjaRiil - danaCair).toLocaleString('id-ID')})`;
  }

  db.prepare(`
    INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
    VALUES (?, ?, ?)
  `).run(
    pengajuan_id,
    user_id,
    `LPJ DIAJUKAN: ${guruName} menyerahkan berkas LPJ fisik/nota. ${detailInfo}.`
  );

  return getPengajuanById(pengajuan_id);
}

// 2. Bendahara Memverifikasi LPJ & Rekonsiliasi Kas Pengembalian
function verifyLpjByBendahara({
  pengajuan_id,
  user_id,
  tindakan, // 'TERIMA' atau 'REVISI'
  catatan_verifikasi
}) {
  const proposal = getPengajuanById(pengajuan_id);
  if (!proposal) {
    throw new Error('Proposal kegiatan tidak ditemukan.');
  }

  if (proposal.status !== 'MENUNGGU_VERIFIKASI_LPJ') {
    throw new Error(`Proposal berstatus "${proposal.status}". Hanya proposal dalam antrean LPJ yang dapat diverifikasi.`);
  }

  const user = getUserById(user_id);
  if (user && user.role !== 'BENDAHARA' && user.role !== 'ADMIN') {
    throw new Error('Hanya Bendahara atau Admin yang berhak memverifikasi berkas LPJ.');
  }

  const bendaharaName = user ? user.nama_lengkap : 'Bendahara Sekolah';
  const lpj = proposal.lpj;
  if (!lpj) {
    throw new Error('Data LPJ belum ditemukan pada proposal ini.');
  }

  if (tindakan === 'REVISI') {
    // Minta perbaikan ke guru
    db.prepare(`
      UPDATE lpj_pertanggungjawaban
      SET status_lpj = 'PERLU_PERBAIKAN'
      WHERE id = ?
    `).run(lpj.id);

    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET status = 'DICAIRKAN',
          catatan_bendahara = ?
      WHERE id = ?
    `).run(`Catatan LPJ: ${catatan_verifikasi || 'Bukti nota/nominal belum sesuai'}`, pengajuan_id);

    db.prepare(`
      INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
      VALUES (?, ?, ?)
    `).run(
      pengajuan_id,
      user_id,
      `LPJ PERLU PERBAIKAN: ${bendaharaName} meminta revisi LPJ: "${catatan_verifikasi || 'Perbaiki bukti nota'}"`
    );
  } else {
    // TERIMA & SELESAI
    db.prepare(`
      UPDATE lpj_pertanggungjawaban
      SET status_lpj = 'TERVERIFIKASI'
      WHERE id = ?
    `).run(lpj.id);

    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET status = 'SELESAI'
      WHERE id = ?
    `).run(pengajuan_id);

    // Rekonsiliasi Kas: Kembalikan sisa uang kas ke pos anggaran
    if (lpj.sisa_pengembalian_dana > 0) {
      db.prepare(`
        UPDATE pos_anggaran
        SET total_terserap = MAX(0, total_terserap - ?)
        WHERE id = ?
      `).run(lpj.sisa_pengembalian_dana, proposal.pos_anggaran_id);
    }

    const rekonsiliasiMsg = lpj.sisa_pengembalian_dana > 0
      ? `Sisa dana kas sebesar Rp ${lpj.sisa_pengembalian_dana.toLocaleString('id-ID')} telah diterima kembali dan dikembalikan ke sisa pagu aktif pos anggaran.`
      : `Seluruh dana kas terealisasi penuh sesuai nota fisik.`;

    db.prepare(`
      INSERT INTO audit_log_koreksi (pengajuan_id, user_id, aktivitas)
      VALUES (?, ?, ?)
    `).run(
      pengajuan_id,
      user_id,
      `LPJ DITERIMA & SELESAI: ${bendaharaName} mengesahkan LPJ & nota belanja. ${rekonsiliasiMsg}`
    );
  }

  return getPengajuanById(pengajuan_id);
}

module.exports = {
  db,
  initDatabase,
  getPosAnggaranList,
  getPosAnggaranById,
  createPosAnggaran,
  updatePosAnggaran,
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
  reviewProposalByBendahara,
  decisionProposalByKepsek,
  disburseProposal,
  getPengajuanByQrToken,
  submitLpjByGuru,
  verifyLpjByBendahara,
  getAuditLogs
};

