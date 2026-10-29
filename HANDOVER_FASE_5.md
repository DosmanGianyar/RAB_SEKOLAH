# Panduan Handover & Catatan Kelanjutan Pengembangan E-RAB Sekolah
**Dokumen Instruksi Transisi Sesi / Komputer Lain Menuju Pengerjaan FASE 5 (Tahap Final)**

---

## 1. Status Proyek Saat Ini (Checkpoint Terkini)

* **Repositori GitHub:** [https://github.com/DosmanGianyar/RAB_SEKOLAH](https://github.com/DosmanGianyar/RAB_SEKOLAH)
* **Branch Utama:** `main`
* **Tema Visual:** **Institutional Clean Finance Light Theme** (Elegan, Berwibawa, Kontras Tinggi, Slate 50 `#f8fafc` + Sapphire `#2563eb` + Emerald `#059669` + Violet `#7c3aed`).

### Rekapitulasi Kemajuan:
* ✅ **FASE 1 (Selesai):** SQLite Native (`node:sqlite`), Dashboard Plafon Tahun Ajaran, Traffic Light System (🟢 🟡 🔴), 1-Click Role Switcher.
* ✅ **FASE 2 (Selesai):** Modul Guru Mobile-First, Formulir Pengajuan RAB Dinamis, Live Over-Budget Guard, Pencadangan Pagu Otomatis (`pagu_tercadangkan`).
* ✅ **FASE 3 (Selesai):** Modul Telaah Bendahara, Koreksi Side-by-side, Ambang Batas 2-Tingkat (< 1 Jt vs $\ge$ 1 Jt), Otorisasi Final Kepala Sekolah, Immutable Audit Trail.
* ✅ **FASE 4 (Selesai):**
  1. **Modul Realisasi Pencairan Kas:**
     * Eksekusi oleh Bendahara / Admin (`POST /api/pengajuan/:id/cairkan`).
     * Pilihan metode: Kas Tunai Langsung vs Transfer Bank (BPD Bali, BRI, Mandiri, BCA, dll).
     * Pemindahan buku kas otomatis: pagu berpindah dari `pagu_tercadangkan` ke `total_terserap`.
  2. **Lembar Disposisi & Pengesahan RAB Resmi (A4 Print-Ready):**
     * Rute `GET /cetak/:id` ber-kop resmi Pemerintah Provinsi Bali / Dinas Pendidikan / SMA Negeri 1 Gianyar.
     * Tabel rincian belanja disetujui, nominal terbilang akuntansi bahasa Indonesia, dan 3 kolom tanda tangan (Pemohon, Bendahara, Kepsek).
     * CSS `@media print` terkonfigurasi presisi untuk cetak/simpan PDF A4 tanpa elemen UI web.
  3. **QR Code Keabsahan & Portal Verifikasi Publik:**
     * QR Code dinamis dihasilkan via library `qrcode`.
     * Rute publik `GET /verifikasi/:token` dapat diakses langsung oleh masyarakat/auditor via ponsel pintar untuk memverifikasi keaslian dokumen tanpa perlu login.
* ⏳ **FASE 5 (TARGET BERIKUTNYA):** Modul Pelaporan Pertanggungjawaban (LPJ), Unggah Nota Bukti Realisasi, dan Rekonsiliasi Sisa Pengembalian Kas.

---

## 2. Cara Menjalankan Aplikasi di Komputer Baru

```bash
git clone https://github.com/DosmanGianyar/RAB_SEKOLAH.git
cd RAB_SEKOLAH
npm install
npm start
```
Buka browser di **`http://localhost:3000`**.

---

## 3. Instruksi Spesifik Pengerjaan FASE 5 (Tahap Penutup)

Bagi pengembang atau AI Assistant pada sesi berikutnya, berikut adalah instruksi teknis pengerjaan **Fase 5: Modul LPJ & Nota Bukti**:

1. **Alur Bisnis LPJ:**
   * Hanya proposal yang berstatus `DICAIRKAN` yang dapat dibuatkan LPJ oleh Guru pemohon (`user_id`).
   * Tombol **"📋 Buat LPJ Realisasi"** muncul pada proposal yang telah dicairkan.
2. **Formulir LPJ Guru:**
   * Menampilkan total dana kas yang diterima saat pencairan (cth: Rp 3.400.000).
   * Input Total Belanja Riil yang terjadi di lapangan (cth: Rp 3.250.000).
   * Kalkulator otomatis:
     $$\text{Sisa Pengembalian Dana} = \text{Total Dana Cair} - \text{Total Belanja Riil}$$
     *(Jika Belanja Riil < Dana Cair $\rightarrow$ Tampil sisa dana yang harus disetor kembali ke kas sekolah; Jika ada kelebihan bayar $\rightarrow$ Beri peringatan/validasi)*.
   * Unggah Berkas Nota / Kuitansi / Foto Bukti Belanja (menggunakan `multer` yang sudah terpasang ke direktori `uploads/nota/`).
   * Catatan laporan pelaksanaan kegiatan.
3. **Verifikasi LPJ oleh Bendahara:**
   * Bendahara memeriksa fisik kuitansi & berkas yang diunggah.
   * Jika ada sisa pengembalian dana kas, saat Bendahara menyetujui LPJ:
     $$\text{pos\_anggaran.total\_terserap} = \text{pos\_anggaran.total\_terserap} - \text{sisa\_pengembalian\_dana}$$
     *(Dana sisa kembali ke sisa pagu aktif pos anggaran secara akurat)*.
   * Status proposal berubah menjadi `SELESAI`.
   * Dokumen LPJ dicatat pada `audit_log_koreksi`.

