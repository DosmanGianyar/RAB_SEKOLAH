const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, '..', 'rab_sekolah.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// ---- Keamanan Kata Sandi (scrypt + salt acak) ----
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}

function isHashedPassword(stored) {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

function verifyPassword(plain, stored) {
  if (!isHashedPassword(stored)) {
    // Kompatibilitas data lama (teks biasa) - akan di-upgrade otomatis saat login
    const a = Buffer.from(String(plain));
    const b = Buffer.from(String(stored || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const [, saltHex, hashHex] = stored.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(plain), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

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
      no_kelompok INTEGER,
      kode_kelompok TEXT,
      nama_kelompok TEXT,
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

    CREATE TABLE IF NOT EXISTS lpj_nota_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lpj_id INTEGER NOT NULL REFERENCES lpj_pertanggungjawaban(id) ON DELETE CASCADE,
      pengajuan_id INTEGER NOT NULL REFERENCES pengajuan_kegiatan(id),
      nama_toko TEXT NOT NULL,
      uraian TEXT,
      nominal REAL NOT NULL,
      file_url TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS lpj_dokumentasi_foto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lpj_id INTEGER NOT NULL REFERENCES lpj_pertanggungjawaban(id) ON DELETE CASCADE,
      pengajuan_id INTEGER NOT NULL REFERENCES pengajuan_kegiatan(id),
      caption TEXT,
      file_url TEXT NOT NULL,
      urutan INTEGER DEFAULT 0,
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

  // Tabel pengaturan identitas & format cetak kuitansi sekolah
  db.exec(`
    CREATE TABLE IF NOT EXISTS pengaturan_sekolah (
      kunci TEXT PRIMARY KEY,
      nilai TEXT NOT NULL,
      keterangan TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
  const seedSekolah = db.prepare('INSERT OR IGNORE INTO pengaturan_sekolah (kunci, nilai, keterangan) VALUES (?, ?, ?)');
  [
    ['nama_sekolah', 'SMA NEGERI 1 GIANYAR', 'Nama resmi sekolah'],
    ['sumber_dana_kuitansi', 'Dana Komite SMA N 1 Gianyar', 'Sumber dana yang dicetak pada kuitansi'],
    ['pembayar_kuitansi', 'Pembantu Bendahara Dana Pungutan Masyarakat SMA Negeri 1 Gianyar', 'Pihak pembayar pada kuitansi'],
    ['kode_rekening_default', '03.03.09.04', 'Kode rekening belanja default'],
    ['tahun_ajaran_aktif', '2026/2027', 'Tahun ajaran aktif berjalan'],
    ['kota_surat', 'Gianyar', 'Kota pengesahan tanda tangan dokumen'],
    ['alamat_sekolah', 'Jln. Ratna, Tegal Tugu Gianyar, Telp : (0361) 943034', 'Alamat & telepon pada kop surat'],
    ['website_sekolah', 'https://sman1-gianyar.sch.id', 'Website resmi pada kop surat'],
    ['email_sekolah', 'sman1.gianyar1963@gmail.com', 'Email resmi sekolah'],
    ['npsn_sekolah', '50102079', 'Nomor Pokok Sekolah Nasional']
  ].forEach(r => seedSekolah.run(...r));

  // Migrasi kolom soft-delete pada pengajuan_kegiatan
  const pkCols = db.prepare('PRAGMA table_info(pengajuan_kegiatan)').all().map(x => x.name);
  if (!pkCols.includes('is_deleted')) {
    db.prepare('ALTER TABLE pengajuan_kegiatan ADD COLUMN is_deleted INTEGER DEFAULT 0').run();
  }
  if (!pkCols.includes('alasan_hapus')) {
    db.prepare('ALTER TABLE pengajuan_kegiatan ADD COLUMN alasan_hapus TEXT').run();
  }
  if (!pkCols.includes('deleted_at')) {
    db.prepare('ALTER TABLE pengajuan_kegiatan ADD COLUMN deleted_at TEXT').run();
  }
  if (!pkCols.includes('deleted_by')) {
    db.prepare('ALTER TABLE pengajuan_kegiatan ADD COLUMN deleted_by INTEGER').run();
  }

    // Tabel pengaturan penandatangan dokumen (dikelola Analis SDM / Kepsek lewat UI)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pengaturan_penandatangan (
      kode TEXT PRIMARY KEY,
      urutan INTEGER DEFAULT 0,
      jabatan TEXT NOT NULL,
      nama TEXT NOT NULL,
      nip TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
  const seedPenandatangan = db.prepare('INSERT OR IGNORE INTO pengaturan_penandatangan (kode, urutan, jabatan, nama, nip) VALUES (?, ?, ?, ?, ?)');
  [
    ['KEPSEK', 1, 'Kepala SMA Negeri 1 Gianyar', 'I Wayan Sudra Astra, S.Pd., M.Pd.', '19710415 199703 1 007'],
    ['ANALIS_SDM', 2, 'Analis SDM Aparatur Ahli Muda', 'I Gusti Ngurah Nyoman Okta Ariawan, S.STP', '19921003 201507 1 001'],
    ['BENDAHARA', 3, 'Bendahara Sekolah', 'I Gusti Ayu Reina Cahyanti', '19880415 201101 2 008'],
    ['BENDAHARA_PUNGUTAN', 4, 'Bendahara Dana Pungutan Masyarakat', 'I Dewa Ayu Istri Megaswari', ''],
    ['BENDAHARA_PEMBANTU', 5, 'Bendahara Pembantu Dana Pungutan Masyarakat', 'I Nyoman Suwaradana', '19721010 200903 1 003'],
    ['KETUA_KOMITE', 6, 'Ketua Komite', 'Ir. Pande Nyoman Yuliana', ''],
    ['WAKA_KESISWAAN', 7, 'Wakasek Kesiswaan', 'I Putu Darma Putra, S.Pd', 'PPPK. 19880930 202221 1 001'],
    ['WAKA_KURIKULUM', 8, 'Wakasek Kurikulum', 'I Gusti Nyoman Susanta, S.Pd', '19670627 199002 1 001'],
    ['WAKA_SARPRAS', 9, 'Wakasek Sarana & Prasarana', 'I Wayan Sumartika, S.Pd., M.Pd', '19950502 201903 1 005'],
    ['WAKA_HUMAS', 10, 'Wakasek Humas', 'Drs. I Ketut Reta, M.Pd', '19680623 199303 1 008']
  ].forEach(r => seedPenandatangan.run(...r));

  if (!colNames.includes('bidang_kegiatan')) {
    db.prepare("ALTER TABLE pengajuan_kegiatan ADD COLUMN bidang_kegiatan TEXT DEFAULT 'KESISWAAN'").run();
  }
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
  if (!colNames.includes('file_bukti_transfer_url')) {
    db.prepare(`ALTER TABLE pengajuan_kegiatan ADD COLUMN file_bukti_transfer_url TEXT`).run();
  }
  if (!colNames.includes('nomor_kode_kwitansi')) {
    db.prepare(`ALTER TABLE pengajuan_kegiatan ADD COLUMN nomor_kode_kwitansi TEXT`).run();
  }

  // Migrasi aman untuk kolom Template LPJ Lengkap pada lpj_pertanggungjawaban
  const lpjTableInfo = db.prepare(`PRAGMA table_info(lpj_pertanggungjawaban)`).all();
  const lpjColNames = lpjTableInfo.map(c => c.name);
  if (!lpjColNames.includes('tujuan_kegiatan')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN tujuan_kegiatan TEXT`).run();
  }
  if (!lpjColNames.includes('tempat_pelaksanaan')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN tempat_pelaksanaan TEXT`).run();
  }
  if (!lpjColNames.includes('jumlah_peserta')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN jumlah_peserta TEXT`).run();
  }
  if (!lpjColNames.includes('resume_hasil')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN resume_hasil TEXT`).run();
  }
  if (!lpjColNames.includes('kendala')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN kendala TEXT`).run();
  }
  if (!lpjColNames.includes('solusi_tindak_lanjut')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN solusi_tindak_lanjut TEXT`).run();
  }
  if (!lpjColNames.includes('file_daftar_hadir_url')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN file_daftar_hadir_url TEXT`).run();
  }
  if (!lpjColNames.includes('tanggal_laporan')) {
    db.prepare(`ALTER TABLE lpj_pertanggungjawaban ADD COLUMN tanggal_laporan TEXT`).run();
  }

  // Migrasi kolom password pada users jika belum ada
  const userTableInfo = db.prepare(`PRAGMA table_info(users)`).all();
  const userColNames = userTableInfo.map(c => c.name);
  if (!userColNames.includes('password')) {
    db.prepare(`ALTER TABLE users ADD COLUMN password TEXT DEFAULT 'password123'`).run();
    db.prepare(`UPDATE users SET password = 'password123' WHERE password IS NULL OR password = ''`).run();
  }

  // Migrasi kolom audit_log_koreksi (tipe_aksi, ip_address, user_agent) jika belum ada
  const auditTableInfo = db.prepare(`PRAGMA table_info(audit_log_koreksi)`).all();
  const auditColNames = auditTableInfo.map(c => c.name);
  if (!auditColNames.includes('tipe_aksi')) {
    db.prepare(`ALTER TABLE audit_log_koreksi ADD COLUMN tipe_aksi TEXT DEFAULT 'SISTEM'`).run();
  }
  if (!auditColNames.includes('ip_address')) {
    db.prepare(`ALTER TABLE audit_log_koreksi ADD COLUMN ip_address TEXT`).run();
  }
  if (!auditColNames.includes('user_agent')) {
    db.prepare(`ALTER TABLE audit_log_koreksi ADD COLUMN user_agent TEXT`).run();
  }

  // Normalisasi kategori log sistem yang sudah ada sebelumnya
  try {
    db.prepare(`
      UPDATE audit_log_koreksi SET tipe_aksi = 'AKUN'
      WHERE (tipe_aksi IS NULL OR tipe_aksi = 'SISTEM')
        AND (aktivitas LIKE 'TAMBAH AKUN GURU%' OR aktivitas LIKE 'RESET KATA SANDI%' OR aktivitas LIKE 'GANTI KATA SANDI%')
    `).run();

    db.prepare(`
      UPDATE audit_log_koreksi SET tipe_aksi = 'PAGU'
      WHERE (tipe_aksi IS NULL OR tipe_aksi = 'SISTEM')
        AND (aktivitas LIKE 'HAPUS POS ANGGARAN%' OR aktivitas LIKE 'TAMBAH POS%' OR aktivitas LIKE 'UBAH PAGU%' OR aktivitas LIKE '%RKAS%')
    `).run();

    db.prepare(`
      UPDATE audit_log_koreksi SET tipe_aksi = 'LPJ'
      WHERE (tipe_aksi IS NULL OR tipe_aksi = 'SISTEM')
        AND (aktivitas LIKE 'LPJ%')
    `).run();

    db.prepare(`
      UPDATE audit_log_koreksi SET tipe_aksi = 'USULAN'
      WHERE (tipe_aksi IS NULL OR tipe_aksi = 'SISTEM')
        AND (aktivitas LIKE 'Proposal%' OR aktivitas LIKE '%mengembalikan proposal%' OR aktivitas LIKE '%OTORISASI FINAL%' OR aktivitas LIKE 'KAS DICAIRKAN%' OR aktivitas LIKE 'HAPUS USULAN%')
    `).run();
  } catch (e) {
    // Abaikan jika tabel kosong
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

  // Akun administrator demo: nama & email saja (kata sandi tidak ditimpa lagi setiap restart)
  db.prepare(`
    UPDATE users 
    SET nama_lengkap = 'daput', email = 'daput'
    WHERE role = 'ADMIN' OR id = 5
  `).run();

  // Migrasi keamanan: enkripsi (hash) semua kata sandi yang masih teks biasa
  const legacyUsers = db.prepare("SELECT id, password FROM users WHERE password IS NULL OR password NOT LIKE 'scrypt$%'").all();
  const updPass = db.prepare('UPDATE users SET password = ? WHERE id = ?');
  legacyUsers.forEach(u => updPass.run(hashPassword(u.password || 'password123'), u.id));

  // Token akses acak untuk dokumen cetak (tidak bisa ditebak)
  const pkColsExisting = db.prepare('PRAGMA table_info(pengajuan_kegiatan)').all().map(x => x.name);
  if (!pkColsExisting.includes('akses_token')) {
    db.prepare('ALTER TABLE pengajuan_kegiatan ADD COLUMN akses_token TEXT').run();
  }
  const noToken = db.prepare("SELECT id FROM pengajuan_kegiatan WHERE akses_token IS NULL OR akses_token = ''").all();
  const updToken = db.prepare('UPDATE pengajuan_kegiatan SET akses_token = ? WHERE id = ?');
  noToken.forEach(r => updToken.run(crypto.randomBytes(16).toString('hex'), r.id));

  seedInitialData();
}

// Inisialisasi otomatis skema database saat modul dimuat
initDatabase();

// Centralized System Activity Logger
function logSystemActivity({
  user_id = null,
  pengajuan_id = null,
  tipe_aksi = 'SISTEM',
  aktivitas,
  ip_address = null,
  user_agent = null
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_log_koreksi (pengajuan_id, user_id, tipe_aksi, aktivitas, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(pengajuan_id, user_id, tipe_aksi, aktivitas, ip_address, user_agent);
  } catch (err) {
    console.error('Failed to log system activity:', err.message);
    return null;
  }
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (nama_lengkap, nip, email, password, role, unit_bagian)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('I Putu Darma Putra, S.Pd', '198507122010011008', 'darma.osis@sekolah.sch.id', hashPassword('password123'), 'GURU', 'Pembina OSIS & Kesiswaan');
    insertUser.run('I Gusti Ngurah Nyoman Okta Ariawan, SSTP', '198804252014022003', 'okta.sdm@sekolah.sch.id', hashPassword('password123'), 'ANALISIS_SDM', 'Analisis SDM & Otorisasi Pimpinan');
    insertUser.run('I Gusti Ayu Reina Cahyanti', '198203152008012015', 'reina.bendahara@sekolah.sch.id', hashPassword('password123'), 'BENDAHARA', 'Sub Bagian Keuangan & Tata Usaha');
    insertUser.run('I Wayan Sudra Astra, S.Pd., M.Pd', '196811201994121001', 'kepsek@sekolah.sch.id', hashPassword('password123'), 'KEPALA_SEKOLAH', 'Kepala SMA Negeri 1 Gianyar');
    insertUser.run('daput', '199501012022011002', 'daput', hashPassword('007007'), 'ADMIN', 'Administrator Sistem');
  }

  // Pastikan kolom baru RKAS tersedia pada tabel pos_anggaran
  const tableInfo = db.prepare("PRAGMA table_info(pos_anggaran)").all();
  const colNames = tableInfo.map(c => c.name);
  if (!colNames.includes('no_kelompok')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN no_kelompok INTEGER;");
  if (!colNames.includes('kode_kelompok')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN kode_kelompok TEXT;");
  if (!colNames.includes('nama_kelompok')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN nama_kelompok TEXT;");
  if (!colNames.includes('kode_rekening')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN kode_rekening TEXT;");
  if (!colNames.includes('snp')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN snp TEXT;");
  if (!colNames.includes('program_induk')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN program_induk TEXT;");
  if (!colNames.includes('volume')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN volume REAL DEFAULT 1;");
  if (!colNames.includes('satuan')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN satuan TEXT DEFAULT 'kegiatan';");
  if (!colNames.includes('tarif_harga')) db.exec("ALTER TABLE pos_anggaran ADD COLUMN tarif_harga REAL DEFAULT 0;");

  const posCount = db.prepare('SELECT COUNT(*) as count FROM pos_anggaran').get().count;
  const nullKelompok = db.prepare('SELECT COUNT(*) as count FROM pos_anggaran WHERE no_kelompok IS NULL').get().count;
  if (posCount === 0 || nullKelompok > 0) {
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
      const kelompokNama = g.uraian;
      const kelompokKode = g.kode;
      const kelompokNo = g.no;

      if (g.children.length === 0) {
        dbRecords.push({
          no_kelompok: kelompokNo,
          kode_kelompok: kelompokKode,
          nama_kelompok: kelompokNama,
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
            no_kelompok: kelompokNo,
            kode_kelompok: kelompokKode,
            nama_kelompok: kelompokNama,
            kode_rekening: c.kode,
            snp: snpName,
            program_induk: progName,
            nama_pos: c.uraian,
            volume: c.vol || 1,
            satuan: c.sat || 'kegiatan',
            tarif_harga: c.tarif || c.jml,
            pagu_awal: c.jml,
            tahun_ajaran: '2026/2027',
            keterangan: 'Kelompok ' + g.no + ': ' + kelompokNama
          });
        });
      }
    });

    db.exec('PRAGMA foreign_keys = OFF;');

    const existingRows = db.prepare('SELECT id, kode_rekening, nama_pos FROM pos_anggaran').all();
    const mapByComposite = new Map();
    const mapByNama = new Map();
    const mapByKode = new Map();
    existingRows.forEach(row => {
      if (row.kode_rekening && row.nama_pos) {
        mapByComposite.set(`${row.kode_rekening}:::${row.nama_pos.toLowerCase().trim()}`, row.id);
      }
      if (row.nama_pos) mapByNama.set(row.nama_pos.toLowerCase().trim(), row.id);
      if (row.kode_rekening) mapByKode.set(row.kode_rekening, row.id);
    });

    const updateStmt = db.prepare(`
      UPDATE pos_anggaran SET
        no_kelompok = ?, kode_kelompok = ?, nama_kelompok = ?,
        snp = ?, program_induk = ?, nama_pos = ?, tahun_ajaran = ?,
        volume = ?, satuan = ?, tarif_harga = ?, pagu_awal = ?, keterangan = ?
      WHERE id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO pos_anggaran (
        no_kelompok, kode_kelompok, nama_kelompok,
        kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
        volume, satuan, tarif_harga, pagu_awal, total_terserap, pagu_tercadangkan, keterangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `);

    for (const r of dbRecords) {
      const compKey = `${r.kode_rekening}:::${r.nama_pos.toLowerCase().trim()}`;
      const existingId = mapByComposite.get(compKey) ||
                         mapByNama.get(r.nama_pos.toLowerCase().trim()) ||
                         (r.kode_rekening && mapByKode.get(r.kode_rekening));

      if (existingId) {
        updateStmt.run(
          r.no_kelompok,
          r.kode_kelompok,
          r.nama_kelompok,
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
          r.no_kelompok,
          r.kode_kelompok,
          r.nama_kelompok,
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
    SELECT id, no_kelompok, kode_kelompok, nama_kelompok, kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
           volume, satuan, tarif_harga, pagu_awal, total_terserap, pagu_tercadangkan, keterangan,
           (pagu_awal - total_terserap - pagu_tercadangkan) AS sisa_pagu
    FROM pos_anggaran
  `;
  const params = [];
  if (snpFilter && snpFilter !== 'ALL') {
    query += ` WHERE snp = ?`;
    params.push(snpFilter);
  }
  query += ` ORDER BY no_kelompok ASC, id ASC`;

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
    SELECT id, no_kelompok, kode_kelompok, nama_kelompok, kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
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

function createPosAnggaran({
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
}) {
  let finalNoKelompok = no_kelompok ? Number(no_kelompok) : null;
  let finalKodeKelompok = kode_kelompok ? kode_kelompok.trim() : null;
  let finalNamaKelompok = nama_kelompok ? nama_kelompok.trim() : null;
  const cleanKodeRekening = (kode_rekening || '').trim();

  // Jika kelompok belum ditentukan, deteksi otomatis dari kode rekening
  if (!finalKodeKelompok && cleanKodeRekening) {
    const parts = cleanKodeRekening.split('.');
    if (parts.length >= 4) {
      // Format Sub (4 blok): XX.XX.XX.YY -> 3 blok pertama adalah kode kelompok induk
      finalKodeKelompok = parts.slice(0, 3).join('.');
    } else {
      // Format Single / Parent (3 blok atau kurang)
      finalKodeKelompok = cleanKodeRekening;
    }
  }

  // Jika ada kode kelompok, cari apakah sudah ada di database
  if (finalKodeKelompok) {
    const existingGroup = db.prepare(`
      SELECT no_kelompok, kode_kelompok, nama_kelompok, snp, program_induk 
      FROM pos_anggaran 
      WHERE kode_kelompok = ? AND no_kelompok IS NOT NULL 
      LIMIT 1
    `).get(finalKodeKelompok);

    if (existingGroup) {
      if (!finalNoKelompok) finalNoKelompok = existingGroup.no_kelompok;
      if (!finalNamaKelompok) finalNamaKelompok = existingGroup.nama_kelompok;
      if (!snp) snp = existingGroup.snp;
      if (!program_induk) program_induk = existingGroup.program_induk;
    }
  }

  // Jika no_kelompok masih kosong, tetapkan nomor urut kelompok baru
  if (!finalNoKelompok) {
    const maxNo = db.prepare(`SELECT MAX(no_kelompok) as maxNo FROM pos_anggaran`).get();
    finalNoKelompok = (maxNo && maxNo.maxNo) ? maxNo.maxNo + 1 : 1;
  }

  if (!finalNamaKelompok) {
    finalNamaKelompok = nama_pos;
  }

  const stmt = db.prepare(`
    INSERT INTO pos_anggaran (
      no_kelompok, kode_kelompok, nama_kelompok,
      kode_rekening, snp, program_induk, nama_pos, tahun_ajaran,
      volume, satuan, tarif_harga, pagu_awal, total_terserap, pagu_tercadangkan, keterangan
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `);

  const result = stmt.run(
    finalNoKelompok,
    finalKodeKelompok,
    finalNamaKelompok,
    cleanKodeRekening,
    snp || 'Standar Proses',
    program_induk || 'Pelaksanaan Kegiatan Pembelajaran dan ekstrakurikuler',
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

function updatePosAnggaran(id, {
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
}) {
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
        snp = COALESCE(?, snp),
        no_kelompok = COALESCE(?, no_kelompok),
        kode_kelompok = COALESCE(?, kode_kelompok),
        nama_kelompok = COALESCE(?, nama_kelompok)
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
    no_kelompok !== undefined ? Number(no_kelompok) : null,
    kode_kelompok !== undefined ? kode_kelompok : null,
    nama_kelompok !== undefined ? nama_kelompok : null,
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

  if (!verifyPassword(password, user.password || '')) {
    throw new Error('Kata sandi yang Anda masukkan salah.');
  }
  // Upgrade otomatis data lama (teks biasa) menjadi hash
  if (!isHashedPassword(user.password)) {
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(password), user.id);
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

function createGuruUser({ nama_lengkap, nip, email, password, unit_bagian }, callerUser = null) {
  if (!nama_lengkap || !nama_lengkap.trim()) {
    throw new Error('Nama lengkap guru wajib diisi.');
  }
  if (!email || !email.trim()) {
    throw new Error('Email guru wajib diisi untuk akun login.');
  }

  const cleanEmail = email.trim().toLowerCase();

  // Cek duplikasi email
  const existingEmail = db.prepare('SELECT id, nama_lengkap FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existingEmail) {
    throw new Error(`Email "${cleanEmail}" sudah terdaftar atas nama ${existingEmail.nama_lengkap}.`);
  }

  // Cek duplikasi NIP jika diisi
  const cleanNip = (nip && nip.trim()) ? nip.trim() : null;
  if (cleanNip) {
    const existingNip = db.prepare('SELECT id, nama_lengkap FROM users WHERE nip = ?').get(cleanNip);
    if (existingNip) {
      throw new Error(`NIP "${cleanNip}" sudah digunakan oleh akun ${existingNip.nama_lengkap}.`);
    }
  }

  const finalPass = (password && password.trim()) ? password.trim() : 'Dosman2026';
  const cleanUnit = (unit_bagian && unit_bagian.trim()) ? unit_bagian.trim() : 'Guru Mata Pelajaran';

  const stmt = db.prepare(`
    INSERT INTO users (nama_lengkap, nip, email, password, role, unit_bagian)
    VALUES (?, ?, ?, ?, 'GURU', ?)
  `);
  const info = stmt.run(nama_lengkap.trim(), cleanNip, cleanEmail, hashPassword(finalPass), cleanUnit);
  const newUserId = Number(info.lastInsertRowid);

  if (callerUser) {
    logSystemActivity({
      user_id: callerUser.id,
      tipe_aksi: 'AKUN',
      aktivitas: `TAMBAH AKUN GURU: Akun guru baru "${nama_lengkap.trim()}" (${cleanEmail}) dibuat oleh ${callerUser.nama_lengkap} (${callerUser.role}).`
    });
  }

  return getUserById(newUserId);
}

function resetUserPassword(targetUserId, callerUser, newPassword = 'Dosman2026') {
  if (!callerUser || !['ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(callerUser.role)) {
    throw new Error('Hanya Analisis SDM, Kepala Sekolah, dan Administrator yang memiliki hak mereset kata sandi.');
  }

  const targetUser = db.prepare('SELECT id, nama_lengkap, role, email FROM users WHERE id = ?').get(targetUserId);
  if (!targetUser) {
    throw new Error('Akun pengguna tidak ditemukan.');
  }

  if (targetUser.role === 'ADMIN' && callerUser.role !== 'ADMIN') {
    throw new Error('Dilarang mereset kata sandi Administrator Utama.');
  }

  const finalPass = (newPassword && newPassword.trim()) ? newPassword.trim() : 'Dosman2026';
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(finalPass), targetUserId);

  logSystemActivity({
    user_id: callerUser.id,
    tipe_aksi: 'AKUN',
    aktivitas: `RESET KATA SANDI: Kata sandi untuk akun "${targetUser.nama_lengkap}" (${targetUser.email}) berhasil direset oleh ${callerUser.nama_lengkap} (${callerUser.role}).`
  });

  return {
    success: true,
    user: targetUser,
    newPassword: finalPass,
    message: `Kata sandi untuk ${targetUser.nama_lengkap} berhasil direset ke "${finalPass}".`
  };
}

function changeOwnPassword(userId, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    throw new Error('Kata sandi saat ini dan kata sandi baru wajib diisi.');
  }
  if (newPassword.length < 6) {
    throw new Error('Kata sandi baru minimal 6 karakter demi keamanan akun.');
  }

  const user = db.prepare('SELECT id, nama_lengkap, password FROM users WHERE id = ?').get(userId);
  if (!user) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  if (!verifyPassword(oldPassword, user.password || '')) {
    throw new Error('Kata sandi saat ini yang Anda masukkan salah.');
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), userId);

  logSystemActivity({
    user_id: userId,
    tipe_aksi: 'AKUN',
    aktivitas: `GANTI KATA SANDI PRIBADI: Pengguna "${user.nama_lengkap}" berhasil memperbarui kata sandi mandiri.`
  });

  return { success: true, message: 'Kata sandi Anda berhasil diperbarui.' };
}

function getGuruAccountsList() {
  return db.prepare("SELECT id, nama_lengkap, nip, email, role, unit_bagian FROM users WHERE role = 'GURU' ORDER BY id ASC").all();
}

function getUserStats() {
  const totalGuru = db.prepare("SELECT count(*) as c FROM users WHERE role = 'GURU'").get().c;
  const totalAll = db.prepare("SELECT count(*) as c FROM users WHERE role != 'ADMIN'").get().c;
  return { totalGuru, totalAll };
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

function getPengajuanIdByToken(token) {
  const row = db.prepare('SELECT id FROM pengajuan_kegiatan WHERE akses_token = ?').get(String(token || ''));
  return row ? row.id : null;
}


// Pengaturan Identitas & Format Cetak Sekolah
function getPengaturanSekolahMap() {
  const map = {};
  const rows = db.prepare('SELECT kunci, nilai, keterangan FROM pengaturan_sekolah').all();
  rows.forEach(r => { map[r.kunci] = r.nilai; });
  return map;
}

function getPengaturanSekolahList() {
  return db.prepare('SELECT kunci, nilai, keterangan, updated_at FROM pengaturan_sekolah ORDER BY rowid ASC').all();
}

function updatePengaturanSekolah(kunci, nilai, user = null) {
  const row = db.prepare('SELECT * FROM pengaturan_sekolah WHERE kunci = ?').get(kunci);
  if (!row) throw new Error(`Pengaturan dengan kunci "${kunci}" tidak ditemukan.`);
  db.prepare("UPDATE pengaturan_sekolah SET nilai = ?, updated_at = datetime('now', 'localtime') WHERE kunci = ?")
    .run(String(nilai || '').trim(), kunci);
  if (user) {
    logSystemActivity({
      user_id: user.id,
      tipe_aksi: 'SISTEM',
      aktivitas: `PENGATURAN SEKOLAH DIUBAH: ${user.nama_lengkap} mengubah "${kunci}" menjadi "${nilai}".`
    });
  }
  return { kunci, nilai: String(nilai || '').trim() };
}

function getPenandatanganList() {
  return db.prepare('SELECT kode, urutan, jabatan, nama, nip FROM pengaturan_penandatangan ORDER BY urutan').all().map(r => ({ ...r }));
}

function getPenandatanganMap() {
  const map = {};
  getPenandatanganList().forEach(r => { map[r.kode] = r; });
  return map;
}

// Format NIP untuk cetak: tambahkan awalan "NIP. " kecuali sudah berawalan huruf (mis. "PPPK.")
function formatNipCetak(nip) {
  const v = String(nip || '').trim();
  if (!v) return '';
  return /^[A-Za-z]/.test(v) ? v : 'NIP. ' + v;
}

function updatePenandatangan(kode, { jabatan, nama, nip }, user) {
  const row = db.prepare('SELECT * FROM pengaturan_penandatangan WHERE kode = ?').get(kode);
  if (!row) throw new Error('Kode penandatangan tidak dikenal.');
  const nJabatan = String(jabatan || '').trim();
  const nNama = String(nama || '').trim();
  if (!nJabatan || !nNama) throw new Error('Jabatan dan nama wajib diisi.');
  db.prepare("UPDATE pengaturan_penandatangan SET jabatan = ?, nama = ?, nip = ?, updated_at = datetime('now', 'localtime') WHERE kode = ?")
    .run(nJabatan, nNama, String(nip || '').trim(), kode);
  return { kode, jabatan: nJabatan, nama: nNama, nip: String(nip || '').trim() };
}

function createPengajuan({ user_id, pos_anggaran_id, nama_kegiatan, latar_belakang, tanggal_mulai, tanggal_selesai, items, bidang_kegiatan }) {
  const bidangValid = ['KESISWAAN', 'KURIKULUM', 'SARPRAS', 'HUMAS'];
  const bidang = bidangValid.includes(String(bidang_kegiatan || '').toUpperCase()) ? String(bidang_kegiatan).toUpperCase() : 'KESISWAAN';
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
      status, kode_verifikasi_qr, bidang_kegiatan, akses_token
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU_REVIEW', ?, ?, ?)
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
    kodeVerifikasi,
    bidang,
    crypto.randomBytes(16).toString('hex')
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
  logSystemActivity({
    pengajuan_id: pengajuanId,
    user_id,
    tipe_aksi: 'USULAN',
    aktivitas: `Proposal "${nama_kegiatan}" diajukan oleh ${user ? user.nama_lengkap : 'Guru'} sebesar Rp ${totalAjuan.toLocaleString('id-ID')}`
  });

  return getPengajuanById(pengajuanId);
}

function getPengajuanList(userId = null, role = null) {
  let sql = `
    SELECT p.*, 
           u.nama_lengkap AS pemohon_nama, 
           u.unit_bagian AS pemohon_unit,
           u.role AS pemohon_role,
           pos.nama_pos,
           pos.tahun_ajaran,
           lpj.id AS lpj_id,
           lpj.total_dana_cair AS lpj_total_cair,
           lpj.total_belanja_riil AS lpj_total_belanja_riil,
           lpj.sisa_pengembalian_dana AS lpj_sisa_pengembalian,
           lpj.file_nota_url AS lpj_file_nota_url,
           lpj.status_lpj AS lpj_status,
           lpj.catatan_lpj AS lpj_catatan,
           lpj.created_at AS lpj_created_at,
           (SELECT COUNT(*) FROM lpj_nota_items WHERE lpj_id = lpj.id) AS lpj_nota_count
    FROM pengajuan_kegiatan p
    JOIN users u ON p.user_id = u.id
    JOIN pos_anggaran pos ON p.pos_anggaran_id = pos.id
    LEFT JOIN lpj_pertanggungjawaban lpj ON lpj.pengajuan_id = p.id
    WHERE (p.is_deleted = 0 OR p.is_deleted IS NULL)
  `;

  const params = [];
  // Jika Guru, hanya tampilkan usulannya sendiri
  if (role === 'GURU' && userId) {
    sql += ` AND p.user_id = ? `;
    params.push(userId);
  }

  sql += ` ORDER BY p.id DESC `;
  return db.prepare(sql).all(...params);
}


// Ambil Daftar Usulan yang Diarsip / Soft-Deleted (Khusus Analis SDM, Kepsek, Admin)
function getArchivedPengajuanList() {
  const sql = `
    SELECT p.*, 
           u.nama_lengkap AS pemohon_nama, 
           u.unit_bagian AS pemohon_unit,
           pos.nama_pos,
           pos.tahun_ajaran,
           del_u.nama_lengkap AS dihapus_oleh_nama
    FROM pengajuan_kegiatan p
    JOIN users u ON p.user_id = u.id
    JOIN pos_anggaran pos ON p.pos_anggaran_id = pos.id
    LEFT JOIN users del_u ON p.deleted_by = del_u.id
    WHERE p.is_deleted = 1
    ORDER BY p.deleted_at DESC, p.id DESC
  `;
  return db.prepare(sql).all();
}

function getPengajuanById(id) {
  const proposal = db.prepare(`
    SELECT p.*, 
           u.nama_lengkap AS pemohon_nama, 
           u.nip AS pemohon_nip,
           u.unit_bagian AS pemohon_unit,
           u.role AS pemohon_role,
           pos.nama_pos,
           pos.kode_rekening AS kode_rekening_pos,
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

  if (lpj) {
    let notaItems = db.prepare(`
      SELECT * FROM lpj_nota_items
      WHERE lpj_id = ?
      ORDER BY id ASC
    `).all(lpj.id);

    // Fallback kompatibilitas data lama jika belum ada baris di lpj_nota_items
    if (notaItems.length === 0 && (lpj.file_nota_url || lpj.total_belanja_riil > 0)) {
      notaItems = [{
        id: 0,
        lpj_id: lpj.id,
        pengajuan_id: id,
        nama_toko: 'Nota / Bukti Gabungan',
        uraian: lpj.catatan_lpj || 'Realisasi belanja kegiatan',
        nominal: lpj.total_belanja_riil,
        file_url: lpj.file_nota_url
      }];
    }
    lpj.nota_items = notaItems;

    let fotoDokumentasi = db.prepare(`
      SELECT * FROM lpj_dokumentasi_foto
      WHERE lpj_id = ?
      ORDER BY urutan ASC, id ASC
    `).all(lpj.id);
    lpj.foto_dokumentasi = fotoDokumentasi;
  }

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
    logSystemActivity({
      pengajuan_id: proposal_id,
      user_id,
      tipe_aksi: 'USULAN',
      aktivitas: `${reviewerName} mengembalikan proposal untuk revisi. Catatan: "${catatan_bendahara || '-'}"`
    });

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

  logSystemActivity({
    pengajuan_id: proposal_id,
    user_id,
    tipe_aksi: 'USULAN',
    aktivitas: auditAktivitas
  });

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

    logSystemActivity({
      pengajuan_id: proposal_id,
      user_id,
      tipe_aksi: 'USULAN',
      aktivitas: `${kepsekName} mengembalikan proposal untuk revisi: "${catatan_kepsek || '-'}"`
    });
  } else {
    // APPROVE
    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET status = 'DISETUJUI'
      WHERE id = ?
    `).run(proposal_id);

    logSystemActivity({
      pengajuan_id: proposal_id,
      user_id,
      tipe_aksi: 'USULAN',
      aktivitas: `${kepsekName} memberikan OTORISASI FINAL & MENGESAHKAN anggaran sebesar Rp ${proposal.total_dana_disetujui.toLocaleString('id-ID')}`
    });
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

// Mengambil seluruh log aktivitas sistem untuk Analisis SDM, Kepala Sekolah, dan Administrator
function getAllSystemAuditLogs({ kategori = 'ALL', search = '', limit = 150, offset = 0 } = {}) {
  let whereClauses = [];
  let params = [];

  if (kategori && kategori !== 'ALL') {
    whereClauses.push('a.tipe_aksi = ?');
    params.push(kategori);
  }

  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(a.aktivitas) LIKE ? 
      OR LOWER(COALESCE(u.nama_lengkap, '')) LIKE ? 
      OR LOWER(COALESCE(u.role, '')) LIKE ?
      OR LOWER(COALESCE(a.ip_address, '')) LIKE ?
    )`);
    params.push(s, s, s, s);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      a.id,
      a.pengajuan_id,
      a.user_id,
      COALESCE(a.tipe_aksi, 'SISTEM') AS tipe_aksi,
      a.aktivitas,
      a.ip_address,
      a.user_agent,
      a.waktu_dibuat,
      u.nama_lengkap AS user_nama,
      u.role AS user_role,
      u.email AS user_email,
      p.nama_kegiatan,
      p.nomor_surat_ajuan
    FROM audit_log_koreksi a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN pengajuan_kegiatan p ON a.pengajuan_id = p.id
    ${whereStr}
    ORDER BY a.id DESC
    LIMIT ? OFFSET ?
  `;

  const logs = db.prepare(sql).all(...params, Number(limit) || 150, Number(offset) || 0);

  // Perhitungan statistik kategori untuk badge tab & kartu informasi
  const counts = {
    total: db.prepare(`SELECT COUNT(*) as count FROM audit_log_koreksi`).get().count,
    login: db.prepare(`SELECT COUNT(*) as count FROM audit_log_koreksi WHERE tipe_aksi = 'LOGIN'`).get().count,
    pagu: db.prepare(`SELECT COUNT(*) as count FROM audit_log_koreksi WHERE tipe_aksi = 'PAGU'`).get().count,
    usulan: db.prepare(`SELECT COUNT(*) as count FROM audit_log_koreksi WHERE tipe_aksi = 'USULAN'`).get().count,
    lpj: db.prepare(`SELECT COUNT(*) as count FROM audit_log_koreksi WHERE tipe_aksi = 'LPJ'`).get().count,
    akun: db.prepare(`SELECT COUNT(*) as count FROM audit_log_koreksi WHERE tipe_aksi = 'AKUN'`).get().count
  };

  return { logs, counts };
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
  catatan_pencairan,
  file_bukti_transfer_url,
  nomor_kode_kwitansi
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
        catatan_pencairan = ?,
        file_bukti_transfer_url = COALESCE(?, file_bukti_transfer_url),
        nomor_kode_kwitansi = COALESCE(?, nomor_kode_kwitansi)
    WHERE id = ?
  `).run(
    metode_pencairan,
    bank_tujuan || null,
    nomor_rekening || null,
    penerima_dana || proposal.pemohon_nama,
    nomor_referensi_transfer || null,
    tglCair,
    catatan_pencairan || null,
    file_bukti_transfer_url || null,
    nomor_kode_kwitansi || null,
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

  logSystemActivity({
    pengajuan_id: proposal_id,
    user_id,
    tipe_aksi: 'USULAN',
    aktivitas: `KAS DICAIRKAN: ${bendaharaName} mencairkan dana sebesar Rp ${danaCair.toLocaleString('id-ID')} kepada ${penerima_dana || proposal.pemohon_nama} via ${detailMetode}. Sisa anggaran pos resmi terserap.`
  });

  return getPengajuanById(proposal_id);
}

// Upload / Update Bukti Transfer Kas Susulan
function updateBuktiTransfer({ proposal_id, user_id, file_bukti_transfer_url, nomor_kode_kwitansi }) {
  const proposal = getPengajuanById(proposal_id);
  if (!proposal) throw new Error('Proposal kegiatan tidak ditemukan.');

  db.prepare(`
    UPDATE pengajuan_kegiatan
    SET file_bukti_transfer_url = ?,
        nomor_kode_kwitansi = COALESCE(?, nomor_kode_kwitansi),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(file_bukti_transfer_url, nomor_kode_kwitansi || null, proposal_id);

  const user = getUserById(user_id);
  const operatorName = user ? user.nama_lengkap : 'Bendahara Sekolah';
  logSystemActivity({
    pengajuan_id: proposal_id,
    user_id,
    tipe_aksi: 'USULAN',
    aktivitas: `BUKTI TRANSFER DIPERBARUI: ${operatorName} mengunggah/memperbarui berkas scan bukti transfer bank & slip kas.`
  });

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

// 1. Guru Mengajukan LPJ & Mengunggah Nota (Template Komprehensif)
function submitLpjByGuru({
  pengajuan_id,
  user_id,
  total_belanja_riil,
  file_nota_url,
  file_daftar_hadir_url,
  catatan_lpj,
  nota_items = [],
  tujuan_kegiatan = '',
  tempat_pelaksanaan = '',
  jumlah_peserta = '',
  resume_hasil = '',
  kendala = '',
  solusi_tindak_lanjut = '',
  foto_dokumentasi = [],
  tanggal_laporan = null,
  is_draft = false,
  file_bukti_transfer_url = null
}) {
  const proposal = getPengajuanById(pengajuan_id);
  if (!proposal) {
    throw new Error('Proposal kegiatan tidak ditemukan.');
  }

  if (proposal.status !== 'DICAIRKAN' && proposal.status !== 'MENUNGGU_VERIFIKASI_LPJ') {
    throw new Error(`LPJ hanya dapat diproses jika dana telah dicairkan (status: DICAIRKAN). Status saat ini: "${proposal.status}".`);
  }

  const user = getUserById(user_id);
  if (user && user.role === 'GURU' && proposal.user_id !== user.id) {
    throw new Error('Akses Ditolak: Anda hanya berhak mengedit laporan dari usulan kegiatan Anda sendiri.');
  }

  // Jika Bendahara/Admin mengunggah bukti transfer kas saat edit LPJ
  if (file_bukti_transfer_url) {
    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET file_bukti_transfer_url = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(file_bukti_transfer_url, pengajuan_id);
  }

  // Hitung total belanja riil: dari rincian nota atau langsung dari form input
  let belanjaRiil = 0;
  if (Array.isArray(nota_items) && nota_items.length > 0) {
    belanjaRiil = nota_items.reduce((acc, it) => acc + (Math.max(0, Number(it.nominal) || 0)), 0);
  } else {
    belanjaRiil = Math.max(0, Number(total_belanja_riil) || 0);
  }

  const danaCair = proposal.total_dana_disetujui;
  const sisaPengembalian = Math.max(0, danaCair - belanjaRiil);

  // Periksa apakah LPJ sebelumnya sudah pernah dibuat
  const existingLpj = db.prepare(`
    SELECT id, file_nota_url, tanggal_laporan FROM lpj_pertanggungjawaban WHERE pengajuan_id = ?
  `).get(pengajuan_id);

  // Cari file URL utama (dari file_nota_url, atau nota item pertama yang memiliki file, atau data lama)
  let primaryFileUrl = file_nota_url;
  if (!primaryFileUrl && Array.isArray(nota_items)) {
    const itemWithFile = nota_items.find(it => it.file_url);
    if (itemWithFile) primaryFileUrl = itemWithFile.file_url;
  }
  const finalFileUrl = primaryFileUrl || (existingLpj ? existingLpj.file_nota_url : null);
  const finalTanggalLaporan = tanggalLaporan || (existingLpj ? existingLpj.tanggal_laporan : null) || new Date().toISOString().split('T')[0];
  const targetStatusLpj = is_draft ? 'DRAFT' : 'MENUNGGU_VERIFIKASI';

  let lpjId = null;
  if (existingLpj) {
    lpjId = existingLpj.id;
    db.prepare(`
      UPDATE lpj_pertanggungjawaban
      SET total_dana_cair = ?,
          total_belanja_riil = ?,
          sisa_pengembalian_dana = ?,
          file_nota_url = ?,
          file_daftar_hadir_url = COALESCE(?, file_daftar_hadir_url),
          catatan_lpj = ?,
          tujuan_kegiatan = ?,
          tempat_pelaksanaan = ?,
          jumlah_peserta = ?,
          resume_hasil = ?,
          kendala = ?,
          solusi_tindak_lanjut = ?,
          tanggal_laporan = ?,
          status_lpj = ?,
          created_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      danaCair, belanjaRiil, sisaPengembalian, finalFileUrl, file_daftar_hadir_url || null, catatan_lpj || '',
      tujuan_kegiatan || '', tempat_pelaksanaan || '', jumlah_peserta || '',
      resume_hasil || '', kendala || '', solusi_tindak_lanjut || '',
      finalTanggalLaporan, targetStatusLpj,
      lpjId
    );
  } else {
    const insertLpjRes = db.prepare(`
      INSERT INTO lpj_pertanggungjawaban (
        pengajuan_id, total_dana_cair, total_belanja_riil, sisa_pengembalian_dana,
        file_nota_url, file_daftar_hadir_url, catatan_lpj, tujuan_kegiatan, tempat_pelaksanaan, jumlah_peserta,
        resume_hasil, kendala, solusi_tindak_lanjut, tanggal_laporan, status_lpj
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pengajuan_id, danaCair, belanjaRiil, sisaPengembalian, finalFileUrl, file_daftar_hadir_url || null, catatan_lpj || '',
      tujuan_kegiatan || '', tempat_pelaksanaan || '', jumlah_peserta || '',
      resume_hasil || '', kendala || '', solusi_tindak_lanjut || '',
      finalTanggalLaporan, targetStatusLpj
    );
    lpjId = insertLpjRes.lastInsertRowid;
  }

  // Sinkronisasi tabel rincian multi-nota (lpj_nota_items)
  db.prepare('DELETE FROM lpj_nota_items WHERE lpj_id = ?').run(lpjId);
  const insertNotaItem = db.prepare(`
    INSERT INTO lpj_nota_items (lpj_id, pengajuan_id, nama_toko, uraian, nominal, file_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  if (Array.isArray(nota_items) && nota_items.length > 0) {
    for (const item of nota_items) {
      insertNotaItem.run(
        lpjId,
        pengajuan_id,
        item.nama_toko || 'Toko / Rekanan',
        item.uraian || '',
        Math.max(0, Number(item.nominal) || 0),
        item.file_url || null
      );
    }
  } else {
    insertNotaItem.run(
      lpjId,
      pengajuan_id,
      'Nota Bukti Belanja',
      catatan_lpj || 'Realisasi belanja kegiatan',
      belanjaRiil,
      finalFileUrl
    );
  }

  // Sinkronisasi tabel dokumentasi foto kegiatan (lpj_dokumentasi_foto)
  db.prepare('DELETE FROM lpj_dokumentasi_foto WHERE lpj_id = ?').run(lpjId);
  if (Array.isArray(foto_dokumentasi) && foto_dokumentasi.length > 0) {
    const insertFotoItem = db.prepare(`
      INSERT INTO lpj_dokumentasi_foto (lpj_id, pengajuan_id, caption, file_url, urutan)
      VALUES (?, ?, ?, ?, ?)
    `);
    foto_dokumentasi.forEach((foto, idx) => {
      if (foto.file_url) {
        insertFotoItem.run(
          lpjId,
          pengajuan_id,
          foto.caption || `Dokumentasi Foto #${idx + 1}`,
          foto.file_url,
          idx + 1
        );
      }
    });
  }

  // Update status proposal: hanya jika BUKAN draft
  if (!is_draft) {
    db.prepare(`
      UPDATE pengajuan_kegiatan
      SET status = 'MENUNGGU_VERIFIKASI_LPJ'
      WHERE id = ?
    `).run(pengajuan_id);
  }

  // Catat di Audit Trail
  const operatorName = user ? user.nama_lengkap : 'Pengguna';
  const jumlahNotaText = Array.isArray(nota_items) && nota_items.length > 0 ? ` (${nota_items.length} berkas nota fisik)` : '';
  let detailInfo = `Belanja Riil: Rp ${belanjaRiil.toLocaleString('id-ID')}${jumlahNotaText}`;
  if (sisaPengembalian > 0) {
    detailInfo += ` (Sisa kas disetor kembali: Rp ${sisaPengembalian.toLocaleString('id-ID')})`;
  } else if (belanjaRiil > danaCair) {
    detailInfo += ` (Kelebihan biaya: Rp ${(belanjaRiil - danaCair).toLocaleString('id-ID')})`;
  }

  if (is_draft) {
    logSystemActivity({
      pengajuan_id,
      user_id,
      tipe_aksi: 'LPJ',
      aktivitas: `DRAFT LPJ DISIMPAN: ${operatorName} menyimpan kemajuan draft laporan (belum diteruskan ke Bendahara). ${detailInfo}.`
    });
  } else {
    logSystemActivity({
      pengajuan_id,
      user_id,
      tipe_aksi: 'LPJ',
      aktivitas: `LPJ DIAJUKAN: ${operatorName} menyerahkan berkas laporan resmi ke Bendahara. ${detailInfo}.`
    });
  }

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
  if (user && !['BENDAHARA', 'ANALISIS_SDM', 'KEPALA_SEKOLAH', 'ADMIN'].includes(user.role)) {
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

    logSystemActivity({
      pengajuan_id,
      user_id,
      tipe_aksi: 'LPJ',
      aktivitas: `LPJ PERLU PERBAIKAN: ${bendaharaName} meminta revisi LPJ: "${catatan_verifikasi || 'Perbaiki bukti nota'}"`
    });
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

    logSystemActivity({
      pengajuan_id,
      user_id,
      tipe_aksi: 'LPJ',
      aktivitas: `LPJ DITERIMA & SELESAI: ${bendaharaName} mengesahkan LPJ & nota belanja. ${rekonsiliasiMsg}`
    });
  }

  return getPengajuanById(pengajuan_id);
}

// Rekonsiliasi Otomatis Seluruh Plafon & Serapan Pos Anggaran
// Rekonsiliasi Otomatis Seluruh Plafon & Serapan Pos Anggaran
function syncAllPosPagu() {
  db.prepare('UPDATE pos_anggaran SET total_terserap = 0, pagu_tercadangkan = 0').run();
  
  // Ambil hanya proposal aktif (bukan soft-deleted dan bukan ditolak)
  const activeProps = db.prepare(`
    SELECT p.id, p.pos_anggaran_id, p.status, p.total_dana_disetujui, p.total_dana_diajukan,
           lpj.total_belanja_riil, lpj.status_lpj
    FROM pengajuan_kegiatan p
    LEFT JOIN lpj_pertanggungjawaban lpj ON lpj.pengajuan_id = p.id
    WHERE (p.is_deleted = 0 OR p.is_deleted IS NULL) AND p.status != 'DITOLAK'
  `).all();

  const posTotals = {}; // id -> { terserap, tercadangkan }

  for (const p of activeProps) {
    if (!p.pos_anggaran_id) continue;
    if (!posTotals[p.pos_anggaran_id]) {
      posTotals[p.pos_anggaran_id] = { terserap: 0, tercadangkan: 0 };
    }

    const disetujui = Number(p.total_dana_disetujui) || 0;
    const diajukan = Number(p.total_dana_diajukan) || 0;
    const nominalCair = disetujui || diajukan;

    if (p.status === 'SELESAI') {
      // Usulan yang sudah diverifikasi tuntas menyerap dana riil belanja
      // Sisa kas yang dikembalikan otomatis tidak membebani pos
      const riil = (p.total_belanja_riil !== null && p.total_belanja_riil !== undefined) 
        ? Number(p.total_belanja_riil) 
        : nominalCair;
      posTotals[p.pos_anggaran_id].terserap += riil;
    } else if (p.status === 'DICAIRKAN' || p.status === 'MENUNGGU_VERIFIKASI_LPJ') {
      // Kas telah keluar dari rekening sekolah
      posTotals[p.pos_anggaran_id].terserap += nominalCair;
    } else {
      // Usulan aktif yang sedang berjalan / menunggu persetujuan (cadangan pagu)
      posTotals[p.pos_anggaran_id].tercadangkan += nominalCair;
    }
  }

  const stmtUpdate = db.prepare('UPDATE pos_anggaran SET total_terserap = ?, pagu_tercadangkan = ? WHERE id = ?');
  for (const posId in posTotals) {
    stmtUpdate.run(posTotals[posId].terserap, posTotals[posId].tercadangkan, Number(posId));
  }
}

// Soft-Delete (Arsipkan) Pengajuan Kegiatan
function deletePengajuan(id, user, alasan = '') {
  const proposal = db.prepare('SELECT * FROM pengajuan_kegiatan WHERE id = ?').get(id);
  if (!proposal) {
    throw new Error('Usulan pengajuan tidak ditemukan.');
  }

  const userId = user ? user.id : null;
  const userName = user ? user.nama_lengkap : 'Sistem';
  const userRole = user ? user.role : 'ADMIN';
  const cleanAlasan = String(alasan || '').trim() || 'Dihapus oleh pengguna berwenang';

  db.prepare(`
    UPDATE pengajuan_kegiatan 
    SET is_deleted = 1,
        alasan_hapus = ?,
        deleted_at = datetime('now', 'localtime'),
        deleted_by = ?
    WHERE id = ?
  `).run(cleanAlasan, userId, id);

  if (user) {
    logSystemActivity({
      user_id: user.id,
      pengajuan_id: id,
      tipe_aksi: 'USULAN',
      aktivitas: `ARSIP USULAN: Pengajuan "${proposal.nama_kegiatan}" (Nomor: ${proposal.nomor_surat_ajuan}) diarsipkan oleh ${userName} (${userRole}). Alasan: "${cleanAlasan}". Pagu otomatis dipulihkan.`
    });
  }

  // Rekonsiliasi ulang seluruh plafon & serapan pos anggaran
  syncAllPosPagu();

  return { 
    success: true, 
    message: `Usulan "${proposal.nama_kegiatan}" berhasil diarsipkan ke Kotak Sampah dan pagu anggaran telah dipulihkan.` 
  };
}

// Pulihkan (Restore) Pengajuan yang Diarsip
function restorePengajuan(id, user) {
  const proposal = db.prepare('SELECT * FROM pengajuan_kegiatan WHERE id = ?').get(id);
  if (!proposal) {
    throw new Error('Usulan tidak ditemukan.');
  }
  if (!proposal.is_deleted) {
    throw new Error('Usulan ini sedang aktif dan tidak dalam status arsip terhapus.');
  }

  // Periksa apakah sisa pagu di pos anggaran masih mencukupi untuk dipulihkan
  const pos = getPosAnggaranById(proposal.pos_anggaran_id);
  if (!pos) {
    throw new Error('Pos anggaran terkait sudah tidak tersedia.');
  }
  const nominal = Number(proposal.total_dana_disetujui) || Number(proposal.total_dana_diajukan) || 0;
  if (nominal > pos.sisa_pagu) {
    throw new Error(`Pagu tidak mencukupi untuk memulihkan usulan ini. Dibutuhkan Rp ${nominal.toLocaleString('id-ID')}, namun sisa pagu pos hanya Rp ${pos.sisa_pagu.toLocaleString('id-ID')}.`);
  }

  db.prepare(`
    UPDATE pengajuan_kegiatan 
    SET is_deleted = 0,
        alasan_hapus = NULL,
        deleted_at = NULL,
        deleted_by = NULL
    WHERE id = ?
  `).run(id);

  if (user) {
    logSystemActivity({
      user_id: user.id,
      pengajuan_id: id,
      tipe_aksi: 'USULAN',
      aktivitas: `PULIHKAN USULAN: Pengajuan "${proposal.nama_kegiatan}" dipulihkan kembali dari arsip oleh ${user.nama_lengkap} (${user.role}). Pagu kembali dicadangkan.`
    });
  }

  syncAllPosPagu();

  return {
    success: true,
    message: `Usulan "${proposal.nama_kegiatan}" berhasil dipulihkan kembali ke daftar aktif.`
  };
}

// Pindah Pos Anggaran (Jika Salah Pilih Pos Sebelum Pencairan)
function pindahPosAnggaran({ proposal_id, target_pos_id, user, alasan = '' }) {
  const proposal = getPengajuanById(proposal_id);
  if (!proposal) throw new Error('Proposal kegiatan tidak ditemukan.');

  if (['DICAIRKAN', 'MENUNGGU_VERIFIKASI_LPJ', 'SELESAI'].includes(proposal.status)) {
    throw new Error('Usulan yang sudah dicairkan atau memiliki LPJ tidak dapat dipindahkan pos anggarannya.');
  }

  if (proposal.pos_anggaran_id === Number(target_pos_id)) {
    throw new Error('Pos anggaran tujuan sama dengan pos anggaran saat ini.');
  }

  const targetPos = getPosAnggaranById(target_pos_id);
  if (!targetPos) throw new Error('Pos anggaran tujuan tidak ditemukan.');

  const nominal = Number(proposal.total_dana_disetujui) || Number(proposal.total_dana_diajukan) || 0;
  if (nominal > targetPos.sisa_pagu) {
    throw new Error(`Sisa pagu pos tujuan tidak mencukupi (Tersedia: Rp ${targetPos.sisa_pagu.toLocaleString('id-ID')}, Dibutuhkan: Rp ${nominal.toLocaleString('id-ID')}).`);
  }

  const posLamaNama = proposal.nama_pos;
  db.prepare('UPDATE pengajuan_kegiatan SET pos_anggaran_id = ? WHERE id = ?').run(target_pos_id, proposal_id);

  if (user) {
    logSystemActivity({
      user_id: user.id,
      pengajuan_id: proposal_id,
      tipe_aksi: 'KOREKSI',
      aktivitas: `PINDAH POS RKAS: Usulan "${proposal.nama_kegiatan}" dipindahkan dari "${posLamaNama}" ke "${targetPos.nama_pos}" oleh ${user.nama_lengkap}. Alasan: "${alasan || 'Penyesuaian pos kegiatan'}".`
    });
  }

  syncAllPosPagu();
  return getPengajuanById(proposal_id);
}

// Ubah Bidang Kegiatan (Kesiswaan, Kurikulum, Sarpras, Humas)
function updateBidangKegiatan({ proposal_id, bidang_kegiatan, user }) {
  const proposal = getPengajuanById(proposal_id);
  if (!proposal) throw new Error('Proposal tidak ditemukan.');
  const bidangValid = ['KESISWAAN', 'KURIKULUM', 'SARPRAS', 'HUMAS'];
  const bidang = String(bidang_kegiatan || '').toUpperCase();
  if (!bidangValid.includes(bidang)) {
    throw new Error('Bidang kegiatan tidak valid. Pilih Kesiswaan, Kurikulum, Sarpras, atau Humas.');
  }

  db.prepare('UPDATE pengajuan_kegiatan SET bidang_kegiatan = ? WHERE id = ?').run(bidang, proposal_id);

  if (user) {
    logSystemActivity({
      user_id: user.id,
      pengajuan_id: proposal_id,
      tipe_aksi: 'KOREKSI',
      aktivitas: `UBAH BIDANG: Penanggung jawab usulan "${proposal.nama_kegiatan}" diubah menjadi "${bidang}" oleh ${user.nama_lengkap}.`
    });
  }

  return getPengajuanById(proposal_id);
}

function deletePosAnggaran(id, user) {
  const pos = db.prepare('SELECT * FROM pos_anggaran WHERE id = ?').get(id);
  if (!pos) {
    throw new Error('Pos anggaran tidak ditemukan.');
  }

  const related = db.prepare('SELECT COUNT(*) as count FROM pengajuan_kegiatan WHERE pos_anggaran_id = ?').get(id).count;
  if (related > 0) {
    throw new Error(`Pos anggaran tidak dapat dihapus karena masih memiliki ${related} usulan kegiatan terkait. Hapus usulan terkait terlebih dahulu.`);
  }

  db.prepare('DELETE FROM pos_anggaran WHERE id = ?').run(id);

  if (user) {
    logSystemActivity({
      user_id: user.id,
      tipe_aksi: 'PAGU',
      aktivitas: `HAPUS POS ANGGARAN: Pos "${pos.nama_pos}" (Kode: ${pos.kode_rekening || '-'}) berhasil dihapus oleh ${user.nama_lengkap} (${user.role}).`
    });
  }

  return { success: true, message: `Pos anggaran "${pos.nama_pos}" berhasil dihapus.` };
}

module.exports = {
  db,
  initDatabase,
  getPengaturanSekolahMap,
  getPengaturanSekolahList,
  updatePengaturanSekolah,
  getArchivedPengajuanList,
  syncAllPosPagu,
  restorePengajuan,
  pindahPosAnggaran,
  updateBidangKegiatan,
  getPengajuanIdByToken,
  getPenandatanganList,
  getPenandatanganMap,
  formatNipCetak,
  updatePenandatangan,
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
};

