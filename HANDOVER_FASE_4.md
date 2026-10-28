# Panduan Handover & Catatan Kelanjutan Pengembangan E-RAB Sekolah
**Dokumen Instruksi Transisi Sesi / Komputer Lain Menuju Pengerjaan FASE 4**

---

## 1. Ringkasan Eksekutif & Status Proyek (Checkpoint)

* **Repositori GitHub:** [https://github.com/DosmanGianyar/RAB_SEKOLAH](https://github.com/DosmanGianyar/RAB_SEKOLAH)
* **Branch Utama:** `main`
* **Arsitektur Stack:**
  * **Backend:** Node.js (Express.js) + Native SQLite (`node:sqlite`)
  * **Frontend:** HTML5 Semantik, Vanilla CSS Modern (Mobile-First, Glassmorphism, Dark/Light Palette), Vanilla JavaScript
  * **Dependensi:** `express`, `qrcode`, `multer` (tercatat di `package.json`)

### Rekapitulasi Progres:
* ✅ **FASE 1 (Selesai):** Setup server, auto-seed database SQLite (`rab_sekolah.db`), dashboard ringkasan plafon tahunan, visual progress bar serapan, status lampu lalu lintas (*Traffic Light*: Hijau, Kuning, Merah), dan pengalih peran pengguna instan (*Role Switcher*).
* ✅ **FASE 2 (Selesai):** Modul Guru berbasis *Mobile-First*, formulir pengajuan kegiatan, tabel belanja dinamis (tambah/hapus baris tanpa reload), hitung otomatis subtotal & grand total, live validasi over-budget (tombol submit terkunci jika melebihi sisa pagu), pencadangan pagu (*Reserved Budget*) otomatis, dan tab riwayat proposal.
* ✅ **FASE 3 (Selesai):** Modul Penelaahan Bendahara dengan koreksi baris (volume/harga standar/catatan), logika ambang batas 2-tingkat (< Rp 1 Jt disetujui langsung oleh Bendahara vs $\ge$ Rp 1 Jt diteruskan ke Kepala Sekolah), modul otorisasi 1-klik Kepala Sekolah, serta riwayat jejak audit (*Audit Trail Timeline*) transparan.
* ⏳ **FASE 4 (SIAP DIKERJAKAN):** Modul Pencairan Kas (Tunai/Transfer) & Generator Lembar Disposisi / Pengesahan PDF Resmi Ber-QR Code.
* ⏳ **FASE 5 (MENDATANG):** Modul LPJ (Unggah Bukti Nota & Kalkulator Sisa Pengembalian Dana).

---

## 2. Cara Menjalankan Proyek di Komputer Baru

Jika Anda membuka proyek ini di komputer lain, ikuti 3 langkah mudah berikut:

1. **Clone atau Tarik Kode Terbaru:**
   ```bash
   git clone https://github.com/DosmanGianyar/RAB_SEKOLAH.git
   cd RAB_SEKOLAH
   ```
   *(Atau jika folder sudah ada, jalankan `git pull origin main`).*

2. **Pasang Dependensi:**
   ```bash
   npm install
   ```
   *(Ini akan mengunduh folder `node_modules` secara otomatis sesuai `package.json`).*

3. **Jalankan Aplikasi:**
   ```bash
   npm start
   ```
   *Buka di browser:* **`http://localhost:3000`**
   *(Database SQLite `rab_sekolah.db` akan otomatis terinisialisasi dan terisi data awal jika file belum ada).*

---

## 3. Akun Pengguna Tersedia untuk Pengujian (Mock Users)

Aplikasi memiliki fitur *Role Switcher* instan di sudut kanan atas header. Akun yang tersedia:
1. **User ID 1:** `I Putu Agus Pratama, S.Pd` (Peran: `GURU` - Pembina OSIS & Kesiswaan)
2. **User ID 2:** `Ni Luh Made Lestari, M.Pd` (Peran: `GURU` - Pembina Pramuka & Ekstrakurikuler)
3. **User ID 3:** `Ibu Ni Made Ratna Dewi, S.E` (Peran: `BENDAHARA` - Staf Keuangan & Tata Usaha)
4. **User ID 4:** `Drs. I Wayan Sudarsana, M.Pd` (Peran: `KEPALA_SEKOLAH` - Pimpinan Institusi)
5. **User ID 5:** `Administrator Sistem IT` (Peran: `ADMIN`)

---

## 4. Instruksi Kerja Spesifik untuk FASE 4 (Target Pengerjaan Berikutnya)

Bagi AI Assistant / Agen / Pengembang yang melanjutkan sesi: **Fokus pengerjaan adalah FASE 4**. Berikut rincian tugas teknisnya:

### A. Modul Pencairan Kas (*Cash Disbursement Module*)
1. **Pemicu Aksi:**
   * Pada proposal yang telah berstatus `DISETUJUI`, tampilkan tombol **"💵 Cairkan Dana"** bagi akun `BENDAHARA` atau `ADMIN`.
2. **Form Modal Pencairan Kas:**
   * Pilihan Metode Pencairan: Radio/Select `TUNAI` atau `TRANSFER_BANK`.
   * Jika Transfer Bank: input Nomor Rekening Penerima, Nama Bank, dan Nomor Referensi Transfer (m-Banking/teller).
   * Tanggal Pencairan (default tanggal hari ini).
   * Catatan bukti serah terima kas.
3. **Logika Bisnis di Backend (`src/db.js` & `src/server.js`):**
   * Endpoint: `POST /api/pengajuan/:id/cairkan`
   * Update tabel `pengajuan_kegiatan`:
     * `status = 'DICAIRKAN'`
     * `metode_pencairan = ...`
     * `nomor_referensi_transfer = ...`
     * `tanggal_pencairan = ...`
   * Update tabel `pos_anggaran`:
     * Pindahkan nominal dari `pagu_tercadangkan` secara resmi ke `total_terserap`:
       $$\text{pagu\_tercadangkan} = \text{pagu\_tercadangkan} - \text{total\_dana\_disetujui}$$
       $$\text{total\_terserap} = \text{total\_terserap} + \text{total\_dana\_disetujui}$$
   * Catat ke `audit_log_koreksi`: *"Dana sebesar Rp X telah dicairkan oleh Bendahara via [Metode] kepada [Nama Pemohon]".*

### B. Generator Lembar Disposisi / Pengesahan PDF Ber-QR Code
1. **Template Cetak Dokumen Resmi:**
   * Dapat dibuat menggunakan view cetak HTML responsif ramah print (`@media print` / CSS Paged Media) atau library generator PDF (`pdfkit` / `puppeteer`).
   * **Struktur Dokumen:**
     * Kop Resmi Sekolah: PEMERINTAH PROVINSI BALI / DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA / SMA NEGERI 1 GIANYAR.
     * Judul: *"LEMBAR DISPOSISI & PENGESAHAN RENCANA ANGGARAN BIAYA (RAB)"*.
     * Nomor Surat Disposisi (cth: `RAB/2026/001`).
     * Informasi Kegiatan, Pemohon, dan Pos Anggaran yang dibebani.
     * Tabel Rincian Belanja yang Disetujui (Kategori, Uraian Barang, Volume, Satuan, Harga Satuan, Subtotal).
     * Total Biaya Disetujui (Rupiah & Terbilang).
     * Kolom Tanda Tangan Tiga Pihak:
       1. Pemohon Usulan (Guru / Pembina Unit)
       2. Penelaah Anggaran (Bendahara Sekolah)
       3. Pengesahan Pimpinan (Kepala Sekolah)
2. **QR Code Verifikasi Dokumen:**
   * Ambil token unik dari kolom `kode_verifikasi_qr` pada proposal (cth: `VERIF-L40HDHHH`).
   * Generate QR Code gambar menggunakan library `qrcode`.
   * Tautkan ke rute validasi publik: `/verifikasi/:token`.
   * Buat halaman sederhana untuk umum jika QR Code discan via kamera HP:
     > *"DOKUMEN INI SAH & RESMI. Nomor Surat: RAB/2026/001, Kegiatan: LDKS OSIS, Total Disetujui: Rp 3.400.000, Disahkan Kepala Sekolah pada 28 Okt 2026."*

---

## 5. Peta Berkas Proyek (*File Tree Reference*)

```text
RAB_SEKOLAH/
├── package.json               # Konfigurasi dependensi dan script npm
├── package-lock.json
├── .gitignore                 # Mengabaikan node_modules, database lokal, dan log
├── README.md                  # Dokumentasi umum repositori
├── HANDOVER_FASE_4.md         # Dokumen ini (Panduan kelanjutan Fase 4)
├── rencana_kinerja_pengembangan_sistem_rab_sekolah.md # Spesifikasi arsitektur lengkap
├── rab_sekolah.db             # File basis data SQLite lokal (dibuat otomatis saat run)
├── src/
│   ├── db.js                  # Modul basis data (node:sqlite) & fungsi query
│   └── server.js              # Server Express.js & REST API endpoints
├── public/
│   ├── index.html             # Halaman antarmuka utama (3 Views: Pagu, Form RAB, Riwayat)
│   ├── css/
│   │   └── style.css          # Design system modern, responsive, mobile-first
│   └── js/
│       └── app.js             # Logika interaksi frontend, modal, dan event handler
└── uploads/
    └── nota/                  # Direktori penyimpanan foto nota LPJ
```

---
*Catatan Akhir: Dokumen ini dirancang agar agen atau pengembang baru dapat langsung melanjutkan penulisan kode Fase 4 tanpa perlu bertanya ulang alur sistem dari awal.*
