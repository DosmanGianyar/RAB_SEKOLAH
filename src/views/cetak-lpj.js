// ==========================================================================
// Generator Dokumen Resmi Laporan Kegiatan Siswa A4 Print-Ready
// SMA NEGERI 1 GIANYAR (DOSMAN)
// Multi-Lembar Standar Kedinasan: Laporan Narasi, Lampiran Absen, & Foto
// ==========================================================================

const { terbilang } = require('../utils/terbilang');
const { renderKopSurat, getKopSuratCss } = require('./kop-surat');

function formatRupiah(val) {
  const num = Number(val) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderCetakLpj({ proposal, qrDataUrl, hostUrl }) {
  const lpj = proposal.lpj || {};
  const danaCair = lpj.total_dana_cair !== null && lpj.total_dana_cair !== undefined ? Number(lpj.total_dana_cair) : Number(proposal.total_dana_disetujui || 0);
  const belanjaRiil = Number(lpj.total_belanja_riil) || 0;
  const sisaPengembalian = lpj.sisa_pengembalian_dana !== null && lpj.sisa_pengembalian_dana !== undefined ? Number(lpj.sisa_pengembalian_dana) : Math.max(0, danaCair - belanjaRiil);
  const totalKalimat = terbilang(belanjaRiil);

  // Tanggal Cetak
  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Pejabat Penandatangan Resmi SMAN 1 Gianyar
  const guruNama = proposal.pemohon_nama || 'Ni Wayan Setiawati, S.Pd';
  const guruNip = proposal.pemohon_nip ? (proposal.pemohon_nip.startsWith('PPPK') || proposal.pemohon_nip.startsWith('NIP') ? proposal.pemohon_nip : `NIP. ${proposal.pemohon_nip}`) : '-';
  const bendaharaNama = 'I Gusti Ayu Reina Cahyanti';
  const bendaharaNip = 'NIP. 19880415 201101 2 008';
  const kepsekNama = 'I Wayan Sudra Astra, S.Pd., M.Pd';
  const kepsekNip = 'NIP. 19681231 199203 1 012';

  // =========================================================================
  // HALAMAN TERPISAH: FOTO DOKUMENTASI KEGIATAN (2-4 FOTO PER LEMBAR)
  // =========================================================================
  const fotoItems = Array.isArray(lpj.foto_dokumentasi) ? lpj.foto_dokumentasi : [];
  let fotoPagesHtml = '';
  if (fotoItems.length > 0) {
    // Kelompokkan 2 foto per lembar agar besar dan jelas saat dicetak
    for (let i = 0; i < fotoItems.length; i += 2) {
      const chunk = fotoItems.slice(i, i + 2);
      const lembarKe = Math.floor(i / 2) + 1;
      const totalLembarFoto = Math.ceil(fotoItems.length / 2);
      fotoPagesHtml += `
        <div class="sheet page-break">
          <div class="lampiran-header">
            <div class="lampiran-title">LAMPIRAN DOKUMENTASI FOTO PELAKSANAAN KEGIATAN</div>
            <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)}${totalLembarFoto > 1 ? ` — Lembar ${lembarKe} dari ${totalLembarFoto}` : ''}</div>
          </div>
          <div class="foto-grid-container">
            ${chunk.map((f, fIdx) => `
              <div class="foto-card">
                <div class="foto-img-wrap">
                  <img src="${f.file_url}" alt="Foto Kegiatan" onerror="this.src='/img/logo-dosman-hd.png';">
                </div>
                <div class="foto-caption">
                  <strong>Dokumentasi #${i + fIdx + 1}</strong>: ${escapeHtml(f.caption || f.keterangan || 'Dokumentasi pelaksanaan kegiatan')}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="page-footer-note">Dokumentasi Pelaksanaan Kegiatan — SMA Negeri 1 Gianyar</div>
        </div>
      `;
    }
  } else {
    fotoPagesHtml = `
      <div class="sheet page-break">
        <div class="lampiran-header">
          <div class="lampiran-title">LAMPIRAN DOKUMENTASI FOTO PELAKSANAAN KEGIATAN</div>
          <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)}</div>
        </div>
        <div class="transfer-doc-wrap" style="padding: 80px 20px; text-align: center;">
          <div style="font-weight: 700; color: #475569; font-size: 1.1rem; margin-bottom: 6px;">Belum Ada Foto Dokumentasi</div>
          <p style="font-size: 0.88rem; color: #64748b;">Foto-foto dokumentasi kegiatan yang diunggah pada formulir Laporan Kegiatan akan tampil secara otomatis di halaman ini.</p>
        </div>
        <div class="page-footer-note">Dokumentasi Pelaksanaan Kegiatan — SMA Negeri 1 Gianyar</div>
      </div>
    `;
  }

  // =========================================================================
  // HALAMAN TERPISAH: DAFTAR HADIR / PRESENSI (PDF MULTI-PAGE ATAU GAMBAR)
  // =========================================================================
  let daftarHadirSectionHtml = '';
  if (lpj.file_daftar_hadir_url) {
    if (lpj.file_daftar_hadir_url.toLowerCase().endsWith('.pdf')) {
      daftarHadirSectionHtml = `
        <div id="daftarHadirPdfContainer" class="pdf-multipage-container" data-pdf-url="${lpj.file_daftar_hadir_url}" data-title="LAMPIRAN DAFTAR HADIR KEGIATAN &amp; PEMBINAAN" data-sub="Presensi Kehadiran Siswa, Guru Pembina, dan Panitia Pelaksana Kegiatan" data-footer="Dokumen Presensi Fisik — SMA Negeri 1 Gianyar">
          <div class="sheet page-break" id="daftarHadirPdfLoading">
            <div class="lampiran-header">
              <div class="lampiran-title">LAMPIRAN DAFTAR HADIR KEGIATAN &amp; PEMBINAAN</div>
              <div class="lampiran-sub">Presensi Kehadiran Siswa, Guru Pembina, dan Panitia Pelaksana Kegiatan</div>
            </div>
            <div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: #475569;">
              <div style="font-size: 2rem; margin-bottom: 12px;">⏳</div>
              <div style="font-weight: 700; font-size: 1.1rem; color: #1e293b; margin-bottom: 6px;">Mengonversi Berkas PDF Daftar Hadir ke Lembar Cetak...</div>
              <div style="font-size: 0.85rem; color: #64748b;">Setiap halaman berkas presensi sedang diproses otomatis menjadi halaman cetak berkualitas tinggi.</div>
            </div>
            <div class="page-footer-note">Dokumen Presensi Fisik — SMA Negeri 1 Gianyar</div>
          </div>
        </div>
      `;
    } else {
      daftarHadirSectionHtml = `
        <div class="sheet page-break">
          <div class="lampiran-header">
            <div class="lampiran-title">LAMPIRAN DAFTAR HADIR KEGIATAN &amp; PEMBINAAN</div>
            <div class="lampiran-sub">Presensi Kehadiran Siswa, Guru Pembina, dan Panitia Pelaksana Kegiatan</div>
          </div>
          <div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4mm;">
            <img src="${lpj.file_daftar_hadir_url}" alt="Daftar Hadir Fisik" style="max-height: 220mm; max-width: 100%; object-fit: contain; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          </div>
          <div class="page-footer-note">Dokumen Presensi Fisik — SMA Negeri 1 Gianyar</div>
        </div>
      `;
    }
  } else {
    daftarHadirSectionHtml = `
      <div class="sheet page-break">
        <div class="lampiran-header">
          <div class="lampiran-title">LAMPIRAN DAFTAR HADIR KEGIATAN &amp; PEMBINAAN</div>
          <div class="lampiran-sub">Presensi Kehadiran Siswa, Guru Pembina, dan Panitia Pelaksana Kegiatan</div>
        </div>
        <div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b; text-align: center;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; display: inline-block;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <div style="font-weight: 700; font-size: 1.1rem; color: #334155; margin-bottom: 6px;">Berkas Daftar Hadir Belum Diunggah</div>
          <p style="font-size: 0.88rem; max-width: 480px; margin: 0 auto;">
            Guru pembina dapat melampirkan berkas scan/foto daftar hadir siswa melalui menu form Laporan Kegiatan.
          </p>
        </div>
        <div class="page-footer-note">Dokumen Presensi Fisik — SMA Negeri 1 Gianyar</div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan_Kegiatan_${escapeHtml(proposal.nomor_surat_ajuan || '').split('/').join('_')}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/img/logo_sekolah.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Tinos:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  
  <!-- PDF.js Engine untuk Rendering Berkas PDF Daftar Hadir ke Lembar Cetak Tajam -->
  <script src="/js/pdf.min.js"></script>

  <style>
    /* -------------------------------------------------------------
       PENGATURAN KERTAS & PRINT-READY A4 PORTRAIT
    ------------------------------------------------------------- */
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: #e2e8f0;
      font-family: 'Times New Roman', Times, 'Tinos', serif;
      color: #000000;
      font-size: 11pt;
      line-height: 1.35;
      padding: 24px;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* Bilah Navigasi Print Standar Layar (Disembunyikan saat dicetak) */
    .no-print-toolbar {
      max-width: 210mm;
      margin: 0 auto 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }

    .btn-toolbar {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #059669;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #047857;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }

    /* Container Kertas A4 */
    .sheet-wrapper {
      padding: 24px 0 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
    }

    .sheet {
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 18mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      position: relative;
    }

    .page-break {
      page-break-after: always;
      break-after: page;
    }

    ${getKopSuratCss('portrait')}

    /* Judul Laporan */
    .report-title-box {
      text-align: center;
      margin-bottom: 14px;
    }

    .report-title {
      font-size: 13pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #0f172a;
      text-decoration: underline;
    }

    .report-subtitle {
      font-size: 9pt;
      font-weight: 600;
      color: #475569;
      margin-top: 3px;
    }

    /* Grid Identitas Metadata */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9.5pt;
    }

    .meta-table td {
      padding: 3px 4px;
      vertical-align: top;
    }

    .meta-table td.label {
      width: 175px;
      font-weight: 600;
      color: #334155;
    }

    .meta-table td.colon {
      width: 12px;
      text-align: center;
      font-weight: 700;
    }

    .meta-table td.value {
      font-weight: 700;
      color: #0f172a;
    }

    /* Section Card */
    .report-section {
      margin-bottom: 11px;
      position: relative;
    }

    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #064e3b;
      background: #ecfdf5;
      border-left: 4px solid #059669;
      padding: 4px 8px;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    .section-body {
      font-size: 9.5pt;
      color: #1e293b;
      text-align: justify;
      line-height: 1.45;
      margin-bottom: 6px;
    }

    /* Financial Cards Box */
    .finance-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;
      text-align: center;
    }

    .finance-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 4px;
      background: #f8fafc;
    }

    .finance-card.highlight {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }

    .finance-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
    }

    .finance-val {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }

    .finance-card.highlight .finance-val {
      color: #047857;
    }

    /* Tanda Tangan */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 14px;
      text-align: center;
      page-break-inside: avoid;
    }

    .sig-role {
      font-size: 8.5pt;
      font-weight: 600;
      color: #334155;
      min-height: 32px;
      line-height: 1.25;
    }

    .sig-space {
      height: 48px;
    }

    .sig-name {
      font-size: 9pt;
      font-weight: 800;
      color: #0f172a;
      text-decoration: underline;
    }

    .sig-nip {
      font-size: 8pt;
      color: #475569;
    }

    .qr-box {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      font-size: 7.5pt;
      color: #64748b;
      page-break-inside: avoid;
    }

    .qr-img {
      width: 40px;
      height: 40px;
    }

    /* Lampiran Header & Wrapper */
    .lampiran-header {
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 16px;
      text-align: center;
    }

    .lampiran-title {
      font-size: 13pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .lampiran-sub {
      font-size: 9.5pt;
      color: #475569;
      font-style: italic;
      margin-top: 3px;
    }

    .transfer-doc-wrap {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 8px;
      min-height: 215mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fafafa;
    }

    /* Galeri Foto A4 (2 Foto Besar per lembar) */
    .foto-grid-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 220mm;
      justify-content: center;
    }

    .foto-card {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 8px;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    .foto-img-wrap {
      width: 100%;
      height: 98mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
      overflow: hidden;
      border-radius: 4px;
    }

    .foto-img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .foto-caption {
      margin-top: 8px;
      font-size: 9pt;
      text-align: center;
      color: #334155;
      font-style: italic;
    }

    .page-footer-note {
      position: absolute;
      bottom: 10mm;
      left: 18mm;
      right: 18mm;
      text-align: right;
      font-size: 8pt;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    /* Media Print */
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .sheet-wrapper {
        padding: 0 !important;
        gap: 0 !important;
      }
      .sheet {
        box-shadow: none !important;
        margin: 0 !important;
        width: 100% !important;
        min-height: 297mm !important;
        padding: 12mm 15mm 15mm 15mm !important;
      }
      .page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
    }
  </style>
</head>
<body>

  <!-- Toolbar Aksi Non-Print -->
  <div class="no-print-toolbar">
    <div style="display: flex; align-items: center; gap: 10px;">
      <a href="/" class="btn-toolbar btn-secondary">
        ← Kembali ke Aplikasi
      </a>
      <span style="font-size: 0.82rem; color: #64748b;">
        Dokumen Laporan Pelaksanaan Kegiatan — SMA Negeri 1 Gianyar
      </span>
    </div>
    <div style="display: flex; gap: 8px;">
      <a href="/cetak-lpj-bundel/${proposal.id}" target="_blank" class="btn-toolbar btn-secondary" title="Buka Dokumen Laporan Keuangan">
        📑 Buka Lap. Keuangan
      </a>
      <button onclick="window.print()" class="btn-toolbar btn-primary">
        🖨️ Cetak Laporan Kegiatan (PDF)
      </button>
    </div>
  </div>

  <div class="sheet-wrapper">

    <!-- ============================================================= -->
    <!-- LEMBAR 1: DOKUMEN UTAMA LAPORAN KEGIATAN & NARASI PELAKSANAAN -->
    <!-- ============================================================= -->
    <div class="sheet page-break">
      <!-- Kop Surat Resmi Pergub Bali No. 80 Th 2018 -->
      ${renderKopSurat({ mode: 'portrait' })}

      <!-- Judul Laporan -->
      <div class="report-title-box">
        <div class="report-title">LAPORAN KEGIATAN SISWA</div>
        <div class="report-subtitle">Nomor Berkas Usulan: ${escapeHtml(proposal.nomor_surat_ajuan)}</div>
      </div>

      <!-- Metadata Identitas Kegiatan -->
      <table class="meta-table">
        <tr>
          <td class="label">Nama Kegiatan</td>
          <td class="colon">:</td>
          <td class="value">${escapeHtml(proposal.nama_kegiatan)}</td>
        </tr>
        <tr>
          <td class="label">Penanggung Jawab / Pemohon</td>
          <td class="colon">:</td>
          <td class="value">${escapeHtml(proposal.pemohon_nama)} (${escapeHtml(proposal.pemohon_unit || 'Guru Pembina')})</td>
        </tr>
        <tr>
          <td class="label">NIP Penanggung Jawab</td>
          <td class="colon">:</td>
          <td class="value">${escapeHtml(proposal.pemohon_nip || '-')}</td>
        </tr>
        <tr>
          <td class="label">Pos Anggaran RKAS</td>
          <td class="colon">:</td>
          <td class="value">${escapeHtml(proposal.pos_nama || '-')}</td>
        </tr>
        <tr>
          <td class="label">Waktu Pelaksanaan</td>
          <td class="colon">:</td>
          <td class="value">${escapeHtml(proposal.tanggal_mulai || '-')} s/d ${escapeHtml(proposal.tanggal_selesai || '-')}</td>
        </tr>
        <tr>
          <td class="label">Tempat &amp; Sasaran Peserta</td>
          <td class="colon">:</td>
          <td class="value">${escapeHtml(lpj.tempat_pelaksanaan || 'Lingkungan SMAN 1 Gianyar')} • ${escapeHtml(lpj.jumlah_peserta || '-')} Siswa</td>
        </tr>
      </table>

      <!-- Bagian I: Deskripsi & Pelaksanaan Kegiatan -->
      <div class="report-section">
        <div class="section-title">I. DESKRIPSI &amp; LATAR BELAKANG PELAKSANAAN</div>
        <div class="section-body">
          <strong>A. Dasar &amp; Latar Belakang:</strong><br>
          ${escapeHtml(proposal.latar_belakang || 'Kegiatan dilaksanakan berdasarkan program kerja sekolah dan RKAS tahun anggaran berjalan.')}
        </div>
        <div class="section-body">
          <strong>B. Tujuan Kegiatan:</strong><br>
          ${escapeHtml(lpj.tujuan_kegiatan || 'Mendukung ketercapaian program peningkatan mutu pembelajaran dan aktivitas kesiswaan sekolah.')}
        </div>
      </div>

      <!-- Bagian II: Resume Hasil Pelaksanaan & Evaluasi -->
      <div class="report-section">
        <div class="section-title">II. RESUME HASIL PELAKSANAAN &amp; EVALUASI</div>
        <div class="section-body">
          <strong>A. Ringkasan Ketercapaian Hasil:</strong><br>
          ${escapeHtml(lpj.resume_hasil || lpj.catatan_lpj || 'Seluruh rangkaian kegiatan telah terlaksana dengan baik, tertib, dan sesuai target indikator output yang direncanakan.')}
        </div>
        ${lpj.kendala ? `
          <div class="section-body">
            <strong>B. Kendala / Hambatan yang Dihadapi:</strong><br>
            ${escapeHtml(lpj.kendala)}
          </div>
        ` : ''}
        ${lpj.solusi_tindak_lanjut ? `
          <div class="section-body">
            <strong>C. Solusi &amp; Tindak Lanjut:</strong><br>
            ${escapeHtml(lpj.solusi_tindak_lanjut)}
          </div>
        ` : ''}
      </div>

      <!-- Bagian III: Rekapitulasi Realisasi Dana Kas -->
      <div class="report-section">
        <div class="section-title">III. REKAPITULASI DANA KAS KEGIATAN</div>
        <div class="finance-summary-grid">
          <div class="finance-card">
            <div class="finance-label">Dana Kas Diterima</div>
            <div class="finance-val">${formatRupiah(danaCair)}</div>
          </div>
          <div class="finance-card">
            <div class="finance-label">Total Belanja Riil</div>
            <div class="finance-val">${formatRupiah(belanjaRiil)}</div>
          </div>
          <div class="finance-card highlight">
            <div class="finance-label">Sisa Kas Disetor</div>
            <div class="finance-val">${formatRupiah(sisaPengembalian)}</div>
          </div>
        </div>
        <div style="font-size: 8.5pt; color: #475569; font-style: italic; margin-bottom: 4px;">
          Terbilang: <strong>${escapeHtml(totalKalimat)} Rupiah</strong>.
          ${sisaPengembalian > 0 ? `Sisa dana kas disetor kembali ke bendahara sekolah sebesar <strong>${formatRupiah(sisaPengembalian)}</strong>.` : 'Seluruh dana kas terealisasi tuntas sesuai bukti nota sah.'}
        </div>
      </div>

      <!-- Lembar Tanda Tangan Tiga Pihak Resmi -->
      <div class="signature-grid">
        <!-- Pihak 1: Pelaksana Kegiatan / Guru -->
        <div>
          <div class="sig-role">
            Pelaksana Kegiatan / Pemohon,<br>
            Gianyar, ${tanggalCetak}
          </div>
          <div class="sig-space"></div>
          <div class="sig-name">${escapeHtml(proposal.pemohon_nama)}</div>
          <div class="sig-nip">${guruNip}</div>
        </div>

        <!-- Pihak 2: Bendahara Pengeluaran Sekolah -->
        <div>
          <div class="sig-role">
            Telah Diverifikasi &amp; Rekonsiliasi Kas:<br>
            Bendahara Sekolah,
          </div>
          <div class="sig-space"></div>
          <div class="sig-name">${bendaharaNama}</div>
          <div class="sig-nip">${bendaharaNip}</div>
        </div>

        <!-- Pihak 3: Kepala Sekolah -->
        <div>
          <div class="sig-role">
            Mengesahkan,<br>
            Kepala SMA Negeri 1 Gianyar
          </div>
          <div class="sig-space"></div>
          <div class="sig-name">${kepsekNama}</div>
          <div class="sig-nip">${kepsekNip}</div>
        </div>
      </div>

      <!-- QR Code Keabsahan Dokumen Digital -->
      <div class="qr-box">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Verifikasi" class="qr-img">` : ''}
        <div>
          <strong>Dokumen Sah E-RAB Sekolah (SMAN 1 Gianyar).</strong><br>
          Dapat diverifikasi keasliannya melalui scan QR Code atau portal: <code>${hostUrl}/verifikasi/${proposal.kode_verifikasi_qr}</code>
        </div>
      </div>

      <div class="page-footer-note">Laporan Pelaksanaan Kegiatan — SMA Negeri 1 Gianyar</div>
    </div>

    <!-- ============================================================= -->
    <!-- LEMBAR 2: HALAMAN TERPISAH LAMPIRAN DAFTAR HADIR (ABSENSI)    -->
    <!-- ============================================================= -->
    ${daftarHadirSectionHtml}

    <!-- ============================================================= -->
    <!-- LEMBAR 3+: HALAMAN TERPISAH LAMPIRAN DOKUMENTASI FOTO         -->
    <!-- ============================================================= -->
    ${fotoPagesHtml}

  </div>

  <!-- Script Multi-page PDF Rendering (PDF.js) untuk Berkas Daftar Hadir -->
  <script>
    (function() {
      if (typeof pdfjsLib === 'undefined') return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';

      async function processAllPdfTargets() {
        var multiContainers = document.querySelectorAll('.pdf-multipage-container');
        for (var i = 0; i < multiContainers.length; i++) {
          var container = multiContainers[i];
          var pdfUrl = container.getAttribute('data-pdf-url');
          var title = container.getAttribute('data-title') || 'LAMPIRAN DOKUMEN';
          var sub = container.getAttribute('data-sub') || '';
          var footer = container.getAttribute('data-footer') || 'SMA Negeri 1 Gianyar';
          if (!pdfUrl) continue;

          try {
            var loadingTask = pdfjsLib.getDocument(pdfUrl);
            var pdf = await loadingTask.promise;
            
            // Bersihkan placeholder loading
            container.innerHTML = '';

            for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              var page = await pdf.getPage(pageNum);
              var viewport = page.getViewport({ scale: 2.2 });

              var canvas = document.createElement('canvas');
              var ctx = canvas.getContext('2d');
              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({ canvasContext: ctx, viewport: viewport }).promise;

              var imgData = canvas.toDataURL('image/jpeg', 0.95);

              var sheet = document.createElement('div');
              sheet.className = 'sheet page-break';
              
              var pageTitleSuffix = pdf.numPages > 1 ? ' (Lembar ' + pageNum + ' dari ' + pdf.numPages + ')' : '';
              var footerSuffix = ' — Lembar ' + pageNum + ' dari ' + pdf.numPages;

              sheet.innerHTML = 
                '<div class="lampiran-header">' +
                  '<div class="lampiran-title">' + title + pageTitleSuffix + '</div>' +
                  '<div class="lampiran-sub">' + sub + '</div>' +
                '</div>' +
                '<div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; align-items: center; justify-content: center; padding: 4mm;">' +
                  '<img src="' + imgData + '" alt="' + title + ' Hal ' + pageNum + '" style="max-width: 100%; max-height: 220mm; width: auto; height: auto; object-fit: contain; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">' +
                '</div>' +
                '<div class="page-footer-note">' + footer + footerSuffix + '</div>';
              
              container.appendChild(sheet);
            }
          } catch (err) {
            console.error('Gagal memproses berkas PDF ke lembar cetak:', err);
            container.innerHTML = 
              '<div class="sheet page-break">' +
                '<div class="lampiran-header">' +
                  '<div class="lampiran-title">' + title + '</div>' +
                  '<div class="lampiran-sub">' + sub + '</div>' +
                '</div>' +
                '<div class="transfer-doc-wrap" style="padding: 50px 20px; text-align: center;">' +
                  '<div style="color: #b91c1c; font-weight: 700; margin-bottom: 8px;">Gagal memproses pratinjau halaman PDF: ' + err.message + '</div>' +
                  '<a href="' + pdfUrl + '" target="_blank" class="btn-toolbar btn-primary" style="display:inline-flex; text-decoration:none;">Buka / Unduh Berkas PDF Asli</a>' +
                '</div>' +
                '<div class="page-footer-note">' + footer + '</div>' +
              '</div>';
          }
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processAllPdfTargets);
      } else {
        processAllPdfTargets();
      }
    })();
  </script>
</body>
</html>
`;
}

module.exports = {
  renderCetakLpj
};
