// ==========================================================================
// Generator Dokumen Resmi LPJ (Laporan Pertanggungjawaban) A4 Print-Ready
// SMA NEGERI 1 GIANYAR (DOSMAN)
// ==========================================================================

const { terbilang } = require('../utils/terbilang');

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

  // Rincian Nota Belanja
  const notaItems = (lpj.nota_items && lpj.nota_items.length > 0) ? lpj.nota_items : [];
  let rowsNotaHtml = '';
  if (notaItems.length > 0) {
    rowsNotaHtml = notaItems.map((item, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><strong>${escapeHtml(item.nama_toko || 'Toko / Rekanan')}</strong></td>
        <td>${escapeHtml(item.uraian || '-')}</td>
        <td class="text-right font-bold">${formatRupiah(item.nominal)}</td>
        <td class="text-center">${item.file_url ? 'Ada (Terlampir)' : 'Fisik'}</td>
      </tr>
    `).join('');
  } else {
    rowsNotaHtml = `
      <tr>
        <td class="text-center">1</td>
        <td><strong>Nota Gabungan / Kolektif</strong></td>
        <td>${escapeHtml(lpj.catatan_lpj || 'Realisasi belanja kegiatan')}</td>
        <td class="text-right font-bold">${formatRupiah(belanjaRiil)}</td>
        <td class="text-center">${lpj.file_nota_url ? 'Ada (Terlampir)' : 'Fisik'}</td>
      </tr>
    `;
  }

  // Dokumentasi Foto Kegiatan
  const fotoItems = (lpj.foto_dokumentasi && lpj.foto_dokumentasi.length > 0) ? lpj.foto_dokumentasi : [];
  let fotoSectionHtml = '';
  if (fotoItems.length > 0) {
    const fotoCards = fotoItems.map((foto, idx) => `
      <div class="foto-card">
        <div class="foto-img-wrap">
          <img src="${foto.file_url}" alt="Foto ${idx + 1}" onerror="this.parentElement.innerHTML='<div style=\\'padding:30px; text-align:center; color:#94a3b8; font-size:9pt;\\'>Foto Bukti Fisik</div>'">
        </div>
        <div class="foto-caption">${escapeHtml(foto.caption || `Foto Dokumentasi Kegiatan #${idx + 1}`)}</div>
      </div>
    `).join('');

    fotoSectionHtml = `
      <div class="report-section" style="page-break-before: auto;">
        <div class="section-title">IV. DOKUMENTASI FOTO PELAKSANAAN KEGIATAN</div>
        <div class="foto-grid">
          ${fotoCards}
        </div>
      </div>
    `;
  }

  const tanggalCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Pertanggungjawaban (LPJ) - ${escapeHtml(proposal.nomor_surat_ajuan)}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/img/logo_sekolah.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Tinos:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: #0f172a;
      background: #e2e8f0;
      padding: 24px;
    }

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

    /* A4 Paper Canvas */
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 18mm 20mm 20mm;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
      position: relative;
    }

    /* Watermark DEMO */
    .sheet::before {
      content: 'LPJ RESMI / DOSMAN';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      font-size: 46pt;
      font-weight: 900;
      color: rgba(5, 150, 105, 0.05);
      border: 4px dashed rgba(5, 150, 105, 0.10);
      padding: 14px 40px;
      border-radius: 16px;
      letter-spacing: 6px;
      text-transform: uppercase;
      pointer-events: none;
      z-index: 1;
      white-space: nowrap;
    }

    /* KOP RESMI SEKOLAH */
    .kop-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      padding-bottom: 12px;
      border-bottom: 3px double #0f172a;
      margin-bottom: 16px;
    }

    .kop-logo {
      position: absolute;
      left: 6px;
      top: 0;
      width: 68px;
      height: 68px;
      object-fit: contain;
    }

    .kop-text {
      text-align: center;
      font-family: 'Tinos', 'Times New Roman', serif;
    }

    .kop-prov {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #1e293b;
    }

    .kop-dinas {
      font-size: 13pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #0f172a;
    }

    .kop-sekolah {
      font-size: 15pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #064e3b;
      margin: 2px 0;
    }

    .kop-alamat {
      font-size: 8.5pt;
      font-style: italic;
      color: #475569;
    }

    /* Judul Laporan */
    .report-title-box {
      text-align: center;
      margin-bottom: 16px;
    }

    .report-title {
      font-size: 13pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0f172a;
      text-decoration: underline;
    }

    .report-subtitle {
      font-size: 9pt;
      font-weight: 600;
      color: #475569;
      margin-top: 4px;
    }

    /* Grid Identitas */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9pt;
    }

    .meta-table td {
      padding: 3px 6px;
      vertical-align: top;
    }

    .meta-table td.label {
      width: 160px;
      font-weight: 600;
      color: #475569;
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

    /* Section Styling */
    .report-section {
      margin-bottom: 14px;
      position: relative;
      z-index: 2;
    }

    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #064e3b;
      background: #ecfdf5;
      border-left: 4px solid #059669;
      padding: 5px 10px;
      margin-bottom: 8px;
    }

    .section-body {
      font-size: 9pt;
      color: #334155;
      text-align: justify;
      line-height: 1.5;
      margin-bottom: 8px;
    }

    /* Financial Cards Box */
    .finance-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 12px;
      text-align: center;
    }

    .finance-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
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
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }

    .finance-card.highlight .finance-val {
      color: #047857;
    }

    /* Tables */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 10px;
    }

    .report-table th,
    .report-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
    }

    .report-table th {
      background: #f1f5f9;
      font-weight: 800;
      text-transform: uppercase;
      color: #1e293b;
      font-size: 8pt;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }

    /* Foto Grid */
    .foto-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 8px;
    }

    .foto-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      background: #f8fafc;
    }

    .foto-img-wrap {
      width: 100%;
      height: 140px;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .foto-img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .foto-caption {
      padding: 6px 8px;
      font-size: 7.5pt;
      font-weight: 600;
      color: #334155;
      text-align: center;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
    }

    /* Tanda Tangan */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 20px;
      text-align: center;
      page-break-inside: avoid;
      position: relative;
      z-index: 2;
    }

    .sig-role {
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
      min-height: 34px;
    }

    .sig-space {
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sig-name {
      font-size: 9pt;
      font-weight: 800;
      color: #0f172a;
      text-decoration: underline;
    }

    .sig-nip {
      font-size: 7.5pt;
      color: #64748b;
    }

    .qr-box {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      font-size: 7.5pt;
      color: #64748b;
    }

    .qr-img {
      width: 44px;
      height: 44px;
    }

    /* Media Print */
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .sheet {
        box-shadow: none;
        padding: 10mm 15mm 15mm;
        width: 100%;
        min-height: auto;
      }
    }
  </style>
</head>
<body>

  <!-- Toolbar Aksi Non-Print -->
  <div class="no-print-toolbar">
    <div style="display: flex; align-items: center; gap: 10px;">
      <button onclick="window.history.back()" class="btn-toolbar btn-secondary">
        ← Kembali ke Halaman LPJ
      </button>
      <span style="font-size: 0.82rem; color: #64748b;">
        Format Dokumen Resmi Standar A4 Cetak LPJ Sekolah
      </span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" class="btn-toolbar btn-primary">
        🖨️ Cetak / Simpan ke PDF
      </button>
    </div>
  </div>

  <!-- Lembar Kertas A4 -->
  <div class="sheet">
    
    <!-- KOP RESMI -->
    <div class="kop-wrapper">
      <img src="/img/logo_sekolah.png" alt="Logo Sekolah" class="kop-logo" onerror="this.style.display='none'">
      <div class="kop-text">
        <div class="kop-prov">PEMERINTAH PROVINSI BALI</div>
        <div class="kop-dinas">DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</div>
        <div class="kop-sekolah">SMA NEGERI 1 GIANYAR</div>
        <div class="kop-alamat">Jalan Ratna No. 1, Tegal Tugu, Kec. Gianyar, Kab. Gianyar, Bali 80511 • Telp: (0361) 943034</div>
      </div>
    </div>

    <!-- Judul Dokumen -->
    <div class="report-title-box">
      <div class="report-title">LAPORAN PERTANGGUNGJAWABAN (LPJ) KEGIATAN</div>
      <div class="report-subtitle">Nomor Berkas: ${escapeHtml(proposal.nomor_surat_ajuan)}</div>
    </div>

    <!-- Identitas Usulan & Pelaksana -->
    <table class="meta-table">
      <tr>
        <td class="label">Nama Kegiatan</td>
        <td class="colon">:</td>
        <td class="value">${escapeHtml(proposal.nama_kegiatan)}</td>
      </tr>
      <tr>
        <td class="label">Penanggung Jawab / Pemohon</td>
        <td class="colon">:</td>
        <td class="value">${escapeHtml(proposal.pemohon_nama)} (${escapeHtml(proposal.pemohon_unit || '-')})</td>
      </tr>
      <tr>
        <td class="label">NIP Penanggung Jawab</td>
        <td class="colon">:</td>
        <td class="value">${escapeHtml(proposal.pemohon_nip || '-')}</td>
      </tr>
      <tr>
        <td class="label">Pos Anggaran RKAS</td>
        <td class="colon">:</td>
        <td class="value">${escapeHtml(proposal.nama_pos)} (Tahun Ajaran ${escapeHtml(proposal.tahun_ajaran || '-')})</td>
      </tr>
      <tr>
        <td class="label">Waktu Pelaksanaan</td>
        <td class="colon">:</td>
        <td class="value">${escapeHtml(proposal.tanggal_mulai || '-')} s/d ${escapeHtml(proposal.tanggal_selesai || '-')}</td>
      </tr>
      <tr>
        <td class="label">Tempat & Sasaran Peserta</td>
        <td class="colon">:</td>
        <td class="value">${escapeHtml(lpj.tempat_pelaksanaan || 'Lingkungan SMAN 1 Gianyar')} • ${escapeHtml(lpj.jumlah_peserta || '-')}</td>
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

    <!-- Bagian II: Rekapitulasi Realisasi Kas -->
    <div class="report-section">
      <div class="section-title">II. REKAPITULASI REALISASI DANA KAS</div>
      
      <div class="finance-summary-grid">
        <div class="finance-card">
          <div class="finance-label">Dana Kas Diterima</div>
          <div class="finance-val">${formatRupiah(danaCair)}</div>
        </div>
        <div class="finance-card">
          <div class="finance-label">Total Belanja Riil (Nota)</div>
          <div class="finance-val">${formatRupiah(belanjaRiil)}</div>
        </div>
        <div class="finance-card highlight">
          <div class="finance-label">Sisa Kas Disetor Kembali</div>
          <div class="finance-val">${formatRupiah(sisaPengembalian)}</div>
        </div>
      </div>

      <div style="font-size: 8.5pt; color: #475569; font-style: italic; margin-bottom: 8px;">
        Terbilang Realisasi Belanja: <strong>${escapeHtml(totalKalimat)} Rupiah</strong>.
        ${sisaPengembalian > 0 ? `Telah disetor kembali ke kas sekolah sebesar <strong>${formatRupiah(sisaPengembalian)}</strong>.` : 'Seluruh dana kas terealisasi tuntas sesuai bukti nota sah.'}
      </div>
    </div>

    <!-- Bagian III: Rincian Bukti Nota & Kuitansi Fisik -->
    <div class="report-section">
      <div class="section-title">III. RINCIAN BUKTI KUITANSI &amp; NOTA BELANJA FISIK</div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 30px;" class="text-center">No</th>
            <th>Nama Toko / Penyedia</th>
            <th>Uraian Barang / Jasa</th>
            <th style="width: 120px;" class="text-right">Nominal (Rp)</th>
            <th style="width: 90px;" class="text-center">Lampiran</th>
          </tr>
        </thead>
        <tbody>
          ${rowsNotaHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; font-weight: 800;">
            <td colspan="3" class="text-right">TOTAL REALISASI BELANJA:</td>
            <td class="text-right" style="color: #047857;">${formatRupiah(belanjaRiil)}</td>
            <td class="text-center">Sah</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Bagian IV: Resume Pelaksanaan & Evaluasi -->
    <div class="report-section">
      <div class="section-title">IV. RESUME HASIL PELAKSANAAN &amp; EVALUASI</div>
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

    <!-- Bagian V: Dokumentasi Foto Kegiatan -->
    ${fotoSectionHtml}

    <!-- Lembar Tanda Tangan Tiga Pihak Resmi -->
    <div class="signature-grid">
      <!-- Pihak 1: Pelaksana Kegiatan / Guru -->
      <div>
        <div class="sig-role">
          Pelaksana Kegiatan / Pemohon,<br>
          Gianyar, ${tanggalCetak}
        </div>
        <div class="sig-space">
          <!-- Tanda Tangan Pelaksana -->
        </div>
        <div class="sig-name">${escapeHtml(proposal.pemohon_nama)}</div>
        <div class="sig-nip">NIP. ${escapeHtml(proposal.pemohon_nip || '-')}</div>
      </div>

      <!-- Pihak 2: Bendahara Pengeluaran Sekolah -->
      <div>
        <div class="sig-role">
          Telah Diverifikasi &amp; Rekonsiliasi Kas:<br>
          Bendahara Sekolah,
        </div>
        <div class="sig-space">
          <!-- Tanda Tangan Bendahara -->
        </div>
        <div class="sig-name">I Gusti Ayu Reina Cahyanti</div>
        <div class="sig-nip">NIP. 19880415 201101 2 008</div>
      </div>

      <!-- Pihak 3: Kepala Sekolah -->
      <div>
        <div class="sig-role">
          Mengesahkan,<br>
          Kepala SMA Negeri 1 Gianyar
        </div>
        <div class="sig-space">
          <!-- Tanda Tangan Kepala Sekolah -->
        </div>
        <div class="sig-name">I Wayan Sudra Astra, S.Pd., M.Pd</div>
        <div class="sig-nip">NIP. 19681231 199203 1 012</div>
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

  </div>

</body>
</html>
`;
}

module.exports = {
  renderCetakLpj
};
