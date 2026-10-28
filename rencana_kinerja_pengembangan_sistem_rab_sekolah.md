# Rencana Kinerja & Panduan Pengembangan Sistem E-RAB Sekolah
**Sistem Informasi Pengajuan Anggaran, Otorisasi Bertingkat, Pencairan Dana, dan LPJ Internal Berbasis Web Praktis**

---

## 1. Ringkasan Eksekutif & Prinsip Desain "Finansial Praktis"

Sistem ini dirancang untuk mendigitalkan birokrasi pengajuan dana operasional dan kegiatan sekolah. Tujuannya adalah mempercepat alur penelaahan berkas fisik, mengadopsi tata kelola keuangan yang kredibel (menyerupai sistem perbankan/korporat), namun **tetap mengedepankan kesederhanaan, kemudahan operasional, dan beban komputasi yang ringan** bagi guru dan staf tata usaha.

### Prinsip Utama Sistem (Lightweight Financial Design)
* **Mirip Standar Keuangan, Bebas Kerumitan:** Menerapkan konsep otorisasi bertingkat, bukti pencairan kas, dan validasi dokumen resmi tanpa membutuhkan infrastruktur server perbankan yang rumit.
* **Ramah Guru & Staf:** Form pengisian dibuat intuitif dengan kalkulasi otomatis (bebas rumus manual).
* **Zero-Leakage Budgeting:** Pagu anggaran terpantau secara transparan melalui indikator visual langsung.

### Indikator Keberhasilan (Key Performance Indicators)
* **Efisiensi Waktu:** Memangkas durasi review proposal kegiatan dari hitungan hari ke hitungan jam.
* **Transparansi Plafon:** Guru dan bendahara mengetahui sisa pagu anggaran per pos kegiatan secara *real-time*.
* **Akurasi Anggaran:** Menghilangkan salah hitung manual pada volume dan harga satuan belanja.
* **Kesiapan Audit:** Tersedianya dokumen cetak PDF lembar pengesahan resmi ber-QR Code dan laporan pertanggungjawaban (LPJ) terstandar.

---

## 2. Rekomendasi Arsitektur & Tech Stack Praktis

Untuk menjamin kemudahan pembuatan, biaya operasional murah, dan pemeliharaan jangka panjang tanpa ketergantungan rumit:

```
[ Frontend: Web Responsif (HP & Laptop) ]
  - HTML5 Semantik + Vanilla CSS Modern (Ringan, Tanpa Build Step Rumit)
  - Vanilla JS / Alpine.js (Tabel Dinamis Tambah/Hapus Baris Belanja Instan)
       │
       ▼ (REST API / Controller Ringan)
[ Backend: Node.js (Express) ]  *Alternatif: PHP (Laravel/Native) jika cPanel
  - Logika Validasi Pagu Anggaran
  - Modul Pencairan Kas & Generator PDF + QR Code
       │
       ▼
[ Basis Data: SQLite (1 File Database) ]  *Alternatif: MySQL
  - Sangat portabel: Backup cukup copy file `.db`
  - Zero-maintenance: Tidak perlu install server database terpisah
```

### Komponen Khusus Penunjang Fitur Finansial
1. **Generator Lembar Pengesahan PDF:** Menggunakan library `pdfkit` atau `jspdf` (menghasilkan lembar disposisi rapi siap cetak).
2. **QR Code Verifikasi Dokumen:** Menggunakan library `qrcode` (membuat barcode verifikasi keabsahan dokumen via kamera HP).
3. **Penyimpanan Berkas Nota LPJ:** Disimpan di direktori lokal server `/uploads/nota/` yang terindeks rapi per nomor pengajuan.
4. **Desain Mobile-First Khusus Guru (Smartphone-Prioritized):**
   * **Layar HP:** Input baris belanja menggunakan kartu sentuh vertikal (*Item Cards*), tombol besar ramah jempol, ringkasan pagu menempel di layar (*sticky summary*), serta tombol kamera instan untuk foto nota LPJ.
   * **Layar Laptop/PC:** Tampilan otomatis bertransformasi secara mulus (*fluid responsive*) menjadi tabel spreadsheet luas berdampingan.

---

## 3. Matriks Hak Akses & Ambang Batas Otorisasi (Approval Matrix)

Menerapkan prinsip pengawasan keuangan internal (*Four-Eyes Principle*) yang disederhanakan:

| Peran (Role) | Hak Akses Utama | Tanggung Jawab Operasional |
| :--- | :--- | :--- |
| **Guru / Pembina Unit** *(Maker)* | - Membuat usulan proposal kegiatan baru<br>- Input rincian baris RAB dinamis<br>- Memantau status review & catatan perbaikan<br>- Unggah foto bukti nota/kwitansi LPJ | Mengajukan kebutuhan riil kegiatan sesuai jadwal akademik. |
| **Bendahara / Keuangan** *(Checker & Disburser)* | - Meninjau & mengoreksi volume/harga item belanja<br>- Menyetujui usulan skala kecil (< Rp 1.000.000)<br>- Meneruskan usulan skala besar ke Kepala Sekolah<br>- Memproses pencairan kas (Tunai / Transfer Bank)<br>- Memverifikasi bukti nota LPJ fisik/foto | Menjaga kepatuhan belanja terhadap standar harga dan ketersediaan kas sekolah. |
| **Kepala Sekolah / TU** *(Approver)* | - Dashboard monitoring serapan anggaran sekolah<br>- Otorisasi final 1-klik untuk nominal $\ge$ Rp 1.000.000<br>- Validasi lembar pengesahan | Pengambil keputusan strategis dan penanggung jawab anggaran institusi. |
| **Administrator IT** | - Manajemen akun guru/staf<br>- Pengaturan master tahun ajaran & pos pagu anggaran<br>- Backup file database terjadwal | Memastikan sistem berjalan stabil dan aman. |

> **Aturan Ambang Batas Praktis (*Approval Threshold*):**
> * **Nominal < Rp 1.000.000:** Cukup persetujuan dari **Bendahara**. Status langsung siap dicairkan.
> * **Nominal $\ge$ Rp 1.000.000:** Setelah diperiksa Bendahara, sistem otomatis meminta persetujuan final dari **Kepala Sekolah**.

---

## 4. Alur Kerja Aplikasi (Workflow & Financial Mechanism)

```
[Guru / Pemohon] ──(Input Draft Proposal & RAB)──► [Status: MENUNGGU_REVIEW]
                                                               │
                                                               ▼
                                                     [Bendahara / Keuangan]
                                                               │
                          ┌────────────────────────────────────┴────────────────────────────────────┐
                          ▼                                                                         ▼
                 [Ada Catatan/Koreksi]                                                      [Sesuai Standar]
                          │                                                                         │
           - Koreksi harga/volume per item                                           Pemeriksaan Ambang Batas:
           - Isi catatan di baris terkait                                            ├─ < Rp 1 Jt   ──► [Status: DISETUJUI]
           - Kembalikan ke Guru (Status: REVISI)                                     └─ >= Rp 1 Jt  ──► Teruskan ke Kepsek
                          │                                                                                   │
                          ▼                                                                                   ▼
                 [Guru Terima Notifikasi]                                                           [Kepsek 1-Klik Approve]
                 (Perbaiki & Ajukan Ulang)                                                                    │
                          │                                                                                   ▼
                          └────────────────────────────────────────────────────────────────────────► [Status: DISETUJUI]
                                                                                                              │
                                                                                                              ▼
                                                                                                 [Cetak Lembar Disposisi PDF]
                                                                                                 (Lengkap QR Code Verifikasi)
                                                                                                              │
                                                                                                              ▼
                                                                                                  [Modul Pencairan Kas]
                                                                                                  - Metode: Tunai / Transfer
                                                                                                  - No. Ref / Catatan Bukti
                                                                                                  - Status: DICAIRKAN
                                                                                                              │
                                                                                                              ▼
                                                                                                  [Guru Unggah Nota LPJ]
                                                                                                  - Foto struk/kwitansi
                                                                                                  - Sistem hitung sisa kas
                                                                                                              │
                                                                                                              ▼
                                                                                                  [Bendahara Verifikasi LPJ]
                                                                                                              │
                                                                                                              ▼
                                                                                                     [Status: SELESAI]
```

### Mekanisme Praktis Unggulan
1. **Indikator Pagu Lampu Lalu Lintas (*Traffic Light Budget Bar*):**
   * Saat guru memilih pos anggaran, tampil progres serapan pagu:
     * 🟢 **Hijau (Aman):** Serapan $< 75\%$ dari pagu pos anggaran.
     * 🟡 **Kuning (Waspada):** Serapan $75\% - 95\%$, guru diingatkan sisa dana terbatas.
     * 🔴 **Merah (Kritis / Over-Budget):** Pengajuan melebihi sisa pagu; tombol simpan dinonaktifkan otomatis dengan pesan peringatan santun.
2. **Pagu Tercadangkan (*Pending / Reserved Budget*):**
   * Saat proposal diajukan (*Status: MENUNGGU_REVIEW*), nominal otomatis masuk ke kolom `pagu_tercadangkan` sehingga sisa pagu langsung berkurang sementara. Hal ini mencegah dua guru mengajukan sisa dana yang sama pada saat bersamaan.
3. **Form Pencairan Kas & Voucher Pengeluaran:**
   * Begitu disetujui, Bendahara memiliki tombol *"Cairkan Dana"*. Bendahara cukup memilih: **Tunai** atau **Transfer Bank** (dengan no. referensi transfer). Sistem mencatat tanggal pencairan dan menghasilkan *Payment Voucher* mini.
4. **Validasi QR Code pada Lembar PDF:**
   * Di sudut lembar pengesahan PDF terdapat QR Code. Jika discan oleh pengawas/guru, browser langsung membuka tautan publik verifikasi: *"Dokumen Sah No. RAB-2026-XXX, Disetujui Kepala Sekolah pada 28 Okt 2026"*.
5. **Kalkulator Sisa Uang LPJ Otomatis:**
   * Guru mengunggah foto nota dan mengetik total belanja riil. Sistem langsung menampilkan:
     $$\text{Sisa Uang Kembali} = \text{Total Dana Cair} - \text{Total Belanja Nota}$$

---

## 5. Rincian Arsitektur Data Inti (Data Model Schema)

### A. Tabel `users`
* `id` (INTEGER / UUID, Primary Key)
* `nama_lengkap`, `nip`, `email`, `password_hash`
* `role`: `GURU`, `BENDAHARA`, `KEPALA_SEKOLAH`, `ADMIN`
* `unit_bagian`: (cth: Kesiswaan, Sarpras, Kurikulum, OSIS, Pramuka)

### B. Tabel `pos_anggaran` (Budget Category & Traffic Light)
* `id` (Primary Key)
* `nama_pos`: (cth: "Pengembangan Karakter Siswa", "Sarana Prasarana", "Ekstrakurikuler")
* `tahun_ajaran`: (cth: "2026/2027")
* `pagu_awal`: Nilai plafon awal tahun
* `total_terserap`: Akumulasi dana yang sudah disetujui/dicairkan
* `pagu_tercadangkan`: Nominal proposal yang sedang ditinjau (*reviewing*)
* `sisa_pagu`: `pagu_awal - total_terserap - pagu_tercadangkan`

### C. Tabel `pengajuan_kegiatan` (Proposal Header & Workflow)
* `id` (Primary Key)
* `user_id` (Relasi ke guru pemohon)
* `pos_anggaran_id` (Relasi ke pos anggaran yang dibebani)
* `nomor_surat_ajuan` (Format otomatis: `RAB/TAHUN/NO_URUT`)
* `nama_kegiatan` & `latar_belakang`
* `tanggal_mulai` & `tanggal_selesai`
* `total_dana_diajukan` (Otomatis dari penjumlahan item belanja)
* `total_dana_disetujui` (Hasil verifikasi akhir)
* `status`: `DRAFT`, `MENUNGGU_REVIEW`, `MENUNGGU_PERSETUJUAN_KEPSEK`, `PERLU_REVISI`, `DISETUJUI`, `DICAIRKAN`, `SELESAI`
* **Data Pencairan Dana:**
  * `metode_pencairan`: `TUNAI` / `TRANSFER_BANK`
  * `nomor_referensi_transfer`: (Opsional, cth: No. Ref m-Banking)
  * `tanggal_pencairan`: Tanggal dana diserahkan ke guru
* **Validasi Keabsahan:**
  * `kode_verifikasi_qr`: Token acak untuk scan validasi QR Code

### D. Tabel `rincian_rab_item` (Proposal Line Items Dinamis)
* `id` (Primary Key)
* `pengajuan_id` (Relasi ke `pengajuan_kegiatan`)
* `kategori_belanja`: (cth: "Konsumsi", "Honor", "Perlengkapan", "Transportasi")
* `deskripsi_item`: (cth: "Snack Rapat Panitia")
* **Data Pengajuan Guru:**
  * `volume_ajuan`: Jumlah unit
  * `satuan`: (cth: "Kotak", "Porsi", "Paket", "Orang")
  * `harga_satuan_ajuan`: Biaya per unit
  * `subtotal_ajuan`: $volume \times harga$
* **Data Koreksi Bendahara:**
  * `volume_disetujui`: Volume final
  * `harga_satuan_disetujui`: Harga standar yang disetujui
  * `subtotal_disetujui`: Nilai hasil penyesuaian
  * `catatan_koreksi`: Alasan pemangkasan (cth: "Standar snack rapat Rp 15.000")
  * `status_item`: `MENUNGGU`, `DITERIMA`, `DISESUAIKAN`, `DITOLAK`

### E. Tabel `lpj_pertanggungjawaban` (Realization & Receipts)
* `id` (Primary Key)
* `pengajuan_id` (Relasi ke `pengajuan_kegiatan`)
* `total_dana_cair`: Nilai dana yang diterima di awal
* `total_belanja_riil`: Total nominal dari nota fisik
* `sisa_pengembalian_dana`: `total_dana_cair - total_belanja_riil`
* `file_nota_url`: Lokasi foto/scan kwitansi belanja
* `catatan_lpj`: Keterangan ringkas dari guru
* `status_lpj`: `MENUNGGU_VERIFIKASI`, `TERVERIFIKASI`

### F. Tabel `audit_log_koreksi` (Audit Trail Ringan)
* `id` (Primary Key)
* `pengajuan_id` & `item_id`
* `user_id` (Staf yang melakukan perubahan)
* `aktivitas`: (cth: "Mengubah harga satuan dari Rp 25.000 menjadi Rp 20.000")
* `waktu_dibuat`: Timestamp otomatis

---

## 6. Rencana Milestone & Tahapan Kerja (Sprint Plan 6 Minggu)

```
[ Minggu 1 ] ──► Setup Lingkungan Ringan (Node.js + SQLite), Master Pagu, & Auth
[ Minggu 2 ] ──► Antarmuka Guru: Form Input Dinamis & Indikator Pagu (Traffic Light)
[ Minggu 3 ] ──► Antarmuka Bendahara: Modul Penelaahan, Koreksi Baris, & Ambang Batas
[ Minggu 4 ] ──► Generator Lembar Pengesahan PDF + QR Code & Modul Pencairan Kas
[ Minggu 5 ] ──► Modul LPJ: Upload Foto Nota & Kalkulator Pengembalian Sisa Kas
[ Minggu 6 ] ──► Uji Coba Terbatas (Pilot Project bersama 1 Unit/Ekskul) & Go-Live
```

### Sprint 1: Setup Lingkungan & Master Data (Hari 1 - 7)
* Menyiapkan project Node.js Express & inisialisasi basis data SQLite (`rab_sekolah.db`).
* Membuat autentikasi sesi aman multi-role (`Guru`, `Bendahara`, `Kepala Sekolah`, `Admin`).
* Panel pengaturan pos anggaran tahunan beserta limit pagu belanja.

### Sprint 2: Form Pengajuan Guru & Validasi Pagu (Hari 8 - 14)
* Halaman pengajuan proposal kegiatan baru.
* Tabel rincian belanja dinamis (tambah/hapus baris tanpa *reload* halaman).
* Implementasi bar visual sisa pagu anggaran (Indikator Hijau/Kuning/Merah).
* Mekanisme pencadangan pagu (*Reserved Budget*) saat proposal berstatus draft/review.

### Sprint 3: Modul Koreksi Bendahara & Persetujuan Bertingkat (Hari 15 - 21)
* Tampilan penelaahan bagi Bendahara (*Side-by-side comparison*: usulan guru vs kolom koreksi).
* Fitur penyesuaian angka per baris dan pemberian catatan alasan koreksi.
* Logika ambang batas: otomatis setujui jika $< \text{Rp } 1.000.000$, atau teruskan ke akun Kepala Sekolah jika $\ge \text{Rp } 1.000.000$.

### Sprint 4: Lembar PDF, QR Code, & Modul Pencairan Kas (Hari 22 - 28)
* Template otomatis cetak PDF Lembar Disposisi/Pengesahan resmi.
* Sematan QR Code dinamis yang dapat discan untuk memvalidasi keaslian dokumen.
* Form pencairan dana untuk Bendahara (pilihan metode Tunai / Transfer Bank + cetak kuitansi pencairan).

### Sprint 5: Modul LPJ & Penyelesaian Anggaran (Hari 29 - 35)
* Form pelaporan LPJ guru: unggah foto nota belanja dari HP/laptop.
* Kalkulator otomatis selisih dana (dana cair vs nota riil).
* Verifikasi penerimaan sisa pengembalian kas oleh Bendahara hingga status tuntas (`SELESAI`).

### Sprint 6: Simulasi Pilot & Pelatihan Staf (Hari 36 - 42)
* Simulasi alur penuh dari pengajuan hingga LPJ bersama 1 unit/pembina kegiatan.
* Perbaikan minor berdasarkan masukan kenyamanan antarmuka guru.
* Peluncuran resmi (*Go-Live*) untuk seluruh civitas sekolah.

---

## 7. Protokol Kualitas, Keamanan, & Kemudahan Pemeliharaan

1. **Backup Database 1-Langkah (Single-File Simplicity):**
   * Karena menggunakan SQLite, jadwal backup harian cukup menyalin file `rab_sekolah.db` ke folder arsip / Google Drive. Pemulihan (*restore*) data dapat dilakukan seketika tanpa keahlian teknis tingkat tinggi.
2. **Validasi Ganda Sisi Server (Server-Side Budget Check):**
   * Pengecekan limit sisa anggaran diverifikasi ulang secara ketat di sisi server saat transaksi disimpan untuk mencegah *race condition* (dua pengajuan bersamaan melebihi kuota pagu).
3. **Audit Trail Ringan:**
   * Setiap penyesuaian nominal oleh bendahara otomatis tersimpan di log audit untuk menjaga transparansi dan perlindungan kerja staf keuangan.
4. **Keamanan Dokumen Tanpa Biaya Pihak Ketiga:**
   * Penggunaan QR Code internal yang mengarah ke endpoint validasi lokal/web sekolah memastikan dokumen fisik tidak dapat dipalsukan tanpa perlu membayar lisensi sertifikat digital pihak ketiga.