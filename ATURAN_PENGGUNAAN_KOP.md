# 📜 PEDOMAN & ATURAN RESMI PENGGUNAAN KOP SURAT
## SMAN 1 GIANYAR (DOSMAN)
*Sesuai Standar Tata Naskah Dinas & Pergub Bali No. 80 Tahun 2018*

---

## 1. Landasan Hukum & Filosofi Desain

1. **Pergub Bali No. 80 Tahun 2018**:
   - Mewajibkan penempatan **Aksara Bali di atas huruf Latin** pada papan nama instansi, kop naskah dinas, dan identitas resmi pemerintah daerah di wilayah Provinsi Bali.
   - Penulisan Aksara Bali menggunakan font **Bali Simbar** dengan kaidah *Pasang Aksara Bali* resmi.
2. **Kerapatan Vertikal (Kompak & Efisien)**:
   - KOP surat dirancang ramping (*compact*) agar tidak memakan ruang halaman dokumen/laporan (*tidak terlalu tinggi/lebar*), sehingga ruang untuk isi surat, tabel data, atau keputusan resmi tetap maksimal.
3. **Proporsi Simetris & Berwibawa**:
   - Diapit oleh dua lambang resmi: **Lambang Daerah Provinsi Bali** di sisi kiri dan **Lambang SMAN 1 Gianyar (Widya Wahana Bhakti)** di sisi kanan.

---

## 2. Aturan Batasan Lebar & Tata Letak Logo (Portrait vs Landscape)

### ⚠️ Aturan Kritis Mode Landscape:
> **PANTANGAN UTAMA:** Pada dokumen berorientasi **Landscape (Mendatar / A4 297×210 mm)**, KOP **TIDAK BOLEH melebar 100% mengikuti lebar kertas** (misal 1120px). Jika melebar 100%, kedua logo akan terbuang jauh ke ujung kertas dan meninggalkan ruang kosong (*blank whitespace*) yang sangat mengganggu estetika naskah resmi.

### Standar Tata Letak:
| Parameter | A4 Portrait (Tegak / 210×297 mm) | A4 Landscape (Mendatar / 297×210 mm) |
|---|---|---|
| **Lebar Maksimal KOP** | `740px` (atau 100% area cetak margin 1.5 cm) | **Maksimal `820px` (Wajib Centered / `margin: 0 auto`)** |
| **Grid Proporsi Kolom** | `82px` (Logo Kiri) - `1fr` (Teks) - `82px` (Logo Kanan) | `88px` (Logo Kiri) - `1fr` (Teks) - `88px` (Logo Kanan) |
| **Jarak Kolom Logo ke Teks** | `12px` | `16px` |
| **Tinggi Maksimal Logo** | `85px` (lebar maks `78px`) | `88px` (lebar maks `82px`) |
| **Tinggi Total KOP** | ~`88px` s/d `95px` | ~`90px` s/d `98px` |

---

## 3. Aturan Jarak Antar-Font Vertikal (Sangat Rapat / Mepet)

Untuk menjaga KOP tetap ramping dan huruf Bali tetap terbaca besar tanpa membuat KOP terlalu tinggi:

1. **Aksara Bali**:
   - Memiliki `line-height: 0.68 - 0.72`.
   - Menggunakan `margin-bottom: -5px` s/d `-6px` untuk memangkas *bounding-box descent* bawaan font, sehingga huruf Aksara menempel padat tepat di atas teks Latin padanannya.
2. **Teks Latin (Instansi & Sekolah)**:
   - `line-height: 0.88 - 0.92`.
   - `margin-top: 0px` dan `margin-bottom: 1px`.
3. **Alamat, Kontak, & NPSN**:
   - `line-height: 0.95`.
   - `margin: 0px` (bebas jeda kosong vertikal).
4. **Garis Pembatas Ganda**:
   - Celah pemisah dari baris NPSN hanya `3px`.

---

## 4. Hierarki Tipografi & Ukuran Huruf

| Baris | Konten Teks | Ukuran (Portrait) | Ukuran (Landscape) | Ukuran PDF (DomPDF) | Gaya Huruf |
|:---:|---|:---:|:---:|:---:|:---:|
| **1a** | Aksara Bali Pemprov Bali | `31px` | `34px` | `height: 30px` | Normal, Bali Simbar |
| **1b** | **PEMERINTAH PROVINSI BALI** | `18px` | `19.5px` | `14pt` | Bold, All-Caps, Tracking 0.5px |
| **2a** | Aksara Bali Dinas Dikpora | `31px` | `34px` | `height: 29px` | Normal, Bali Simbar |
| **2b** | **DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA** | `16px` | `17.5px` | `12.5pt` | Bold, All-Caps, Tracking 0.4px |
| **3a** | Aksara Bali SMAN 1 Gianyar | `31px` | `34px` | `height: 32px` | Normal, Bali Simbar |
| **3b** | **SMA NEGERI 1 GIANYAR** | `23px` | `25px` | `17.5pt` | Bold, All-Caps, Tracking 0.8px (Paling Dominan) |
| **4a** | Aksara Bali Alamat & Telp | `22px` | `24px` | `height: 22px` | Normal, Bali Simbar |
| **4b** | **Jln. Ratna, Tegal Tugu Gianyar, Telp : (0361) 943034** | `13px` | `14px` | `10pt` | Bold, Regular Case |
| **5** | Website : https://sman1-gianyar.sch.id, E-mail : ... | `12px` | `12.5px` | `9pt` | Regular |
| **6** | **NPSN : 50102079** | `12px` | `12.5px` | `9pt` | Bold, Tracking 0.5px |

---

## 5. Standar Aset Visual

### A. Logo Kiri: Pemerintah Provinsi Bali
- **Format File**: `public/img/logo-provinsi.png` (PNG-24 Transparan).
- **Karakteristik**: Berwarna penuh, ketajaman tinggi (Ultra-HD), tepi bersih tanpa halo putih.

### B. Logo Kanan: SMAN 1 Gianyar (DOSMAN)
- **Format File**: `public/img/logo-dosman-hd.png` & `logo-dosman.png` (PNG-24 Transparan, 300 DPI).
- **Karakteristik**:
  - Kontur terluar presisi mengikuti garis hitam perisai & pita semboyan *"WIDYA WAHANA BHAKTI"*.
  - Warna dalam perisai, pita semboyan, buku terbuka, dan 3 figur wajib **putih solid (`#FFFFFF`) murni 100% opacity**.
  - Background luar logo 100% transparan tanpa *fringe* abu-abu/putih.

### C. Garis Ganda Pembatas (Double Border)
- **Garis Atas**: Tebal `2.5px` (solid `#000000`).
- **Celah Jeda**: Tinggi `1.5px` (kosong/putih).
- **Garis Bawah**: Tipis `0.8px` (solid `#000000`).

---

## 6. Panduan Pemanggilan di Kode Program

### 1. Di Template Blade Web (HTML Screen):
```blade
<x-kop-surat />
```

### 2. Di Seluruh Ekspor Laporan PDF (DomPDF):
```blade
@include('partials.kop-surat-pdf')
```

### 3. File Referensi Standalone:
- Halaman pratinjau interaktif A4 Portrait & Landscape: `templates/kop/kop-surat.html` (atau `index.html`).

---
*Ditetapkan untuk seluruh dokumen resmi SIMAK DOSMAN SMAN 1 Gianyar.*

