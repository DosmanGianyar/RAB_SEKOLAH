// ==========================================================================
// Generator Lembar Cetak / Ekspor PDF Buku Besar RKAS Resmi (A4 Landscape)
// SMA NEGERI 1 GIANYAR (DOSMAN) — SISTEM SI-ARTHA DOSMAN
// ==========================================================================

function formatRupiah(val) {
  const num = Number(val) || 0;
  return 'Rp\u00A0' + num.toLocaleString('id-ID');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCetakRkas({ posList, summary }) {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Kelompokkan pos anggaran berdasarkan no_kelompok
  const groupsMap = new Map();
  posList.forEach(item => {
    const kNo = item.no_kelompok || 999;
    if (!groupsMap.has(kNo)) {
      groupsMap.set(kNo, {
        no: kNo,
        kode: item.kode_kelompok || item.kode_rekening || '',
        nama: item.nama_kelompok || item.nama_pos || 'Lain-lain',
        snp: item.snp || 'Standar Proses',
        program_induk: item.program_induk || '',
        items: []
      });
    }
    groupsMap.get(kNo).items.push(item);
  });

  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.no - b.no);

  let rowsHtml = '';
  sortedGroups.forEach(g => {
    const gTotalPagu = g.items.reduce((s, it) => s + (it.pagu_awal || 0), 0);
    const gTotalTerserap = g.items.reduce((s, it) => s + (it.total_terserap || 0), 0);
    const gTotalPending = g.items.reduce((s, it) => s + (it.pagu_tercadangkan || 0), 0);
    const gTotalSisa = g.items.reduce((s, it) => s + (it.sisa_pagu || 0), 0);
    const gPersen = gTotalPagu > 0 ? Math.round(((gTotalTerserap + gTotalPending) / gTotalPagu) * 100) : 0;
    
    let gStatusLabel = 'AMAN';
    let statusClass = 'status-green';
    if (gPersen >= 90) { gStatusLabel = 'KRITIS'; statusClass = 'status-red'; }
    else if (gPersen >= 70) { gStatusLabel = 'WASPADA'; statusClass = 'status-yellow'; }

    const isSingle = g.items.length === 1 && (
      [1, 33, 34, 35].includes(g.no) ||
      g.items[0].nama_pos.trim().toLowerCase() === g.nama.trim().toLowerCase() ||
      g.items[0].kode_rekening === g.kode
    );

    if (isSingle) {
      const item = g.items[0];
      const iPersen = item.persentaseTerserap || 0;
      let iStatusLabel = 'AMAN';
      let iStatusClass = 'status-green';
      if (iPersen >= 90) { iStatusLabel = 'KRITIS'; iStatusClass = 'status-red'; }
      else if (iPersen >= 70) { iStatusLabel = 'WASPADA'; iStatusClass = 'status-yellow'; }

      rowsHtml += `
        <tr class="row-single">
          <td class="text-center font-bold">${g.no}</td>
          <td class="font-mono text-center font-bold">${escapeHtml(item.kode_rekening || '-')}</td>
          <td>
            <div class="snp-label">${escapeHtml(item.snp || '-')}</div>
            <div class="program-sub">${escapeHtml(item.program_induk || '-')}</div>
          </td>
          <td>
            <div class="font-bold">${escapeHtml(item.nama_pos)}</div>
            <div class="vol-label">${item.volume || 1} ${escapeHtml(item.satuan || 'kegiatan')}</div>
          </td>
          <td class="text-right font-bold">${formatRupiah(item.pagu_awal)}</td>
          <td class="text-right text-amber">${formatRupiah(item.total_terserap)}</td>
          <td class="text-right text-muted">${item.pagu_tercadangkan > 0 ? formatRupiah(item.pagu_tercadangkan) : '-'}</td>
          <td class="text-right font-bold ${item.sisa_pagu <= 0 ? 'text-red' : 'text-green'}">${formatRupiah(item.sisa_pagu)}</td>
          <td class="text-center">
            <span class="status-badge ${iStatusClass}">${iStatusLabel} (${iPersen}%)</span>
          </td>
        </tr>
      `;
    } else {
      // Baris Induk / Parent Group
      rowsHtml += `
        <tr class="row-parent">
          <td class="text-center font-bold">${g.no}</td>
          <td class="font-mono text-center font-bold">${escapeHtml(g.kode || '-')}</td>
          <td>
            <div class="snp-label">${escapeHtml(g.snp || '-')}</div>
            <div class="program-sub">${escapeHtml(g.program_induk || '-')}</div>
          </td>
          <td>
            <div class="font-bold text-primary">📁 ${escapeHtml(g.nama)} (${g.items.length} Rincian)</div>
          </td>
          <td class="text-right font-bold">${formatRupiah(gTotalPagu)}</td>
          <td class="text-right font-bold text-amber">${formatRupiah(gTotalTerserap)}</td>
          <td class="text-right font-bold text-muted">${gTotalPending > 0 ? formatRupiah(gTotalPending) : '-'}</td>
          <td class="text-right font-bold ${gTotalSisa <= 0 ? 'text-red' : 'text-green'}">${formatRupiah(gTotalSisa)}</td>
          <td class="text-center">
            <span class="status-badge ${statusClass}">${gStatusLabel} (${gPersen}%)</span>
          </td>
        </tr>
      `;

      // Rincian Sub-Kegiatan (Anak)
      g.items.forEach(item => {
        const iPersen = item.persentaseTerserap || 0;
        let iStatusLabel = 'AMAN';
        let iStatusClass = 'status-green';
        if (iPersen >= 90) { iStatusLabel = 'KRITIS'; iStatusClass = 'status-red'; }
        else if (iPersen >= 70) { iStatusLabel = 'WASPADA'; iStatusClass = 'status-yellow'; }

        rowsHtml += `
          <tr class="row-child">
            <td class="text-center"></td>
            <td class="font-mono text-center text-muted" style="font-size: 8pt;">${escapeHtml(item.kode_rekening || '-')}</td>
            <td class="text-muted" style="font-size: 8pt;">${escapeHtml(item.snp || '-')}</td>
            <td style="padding-left: 20px;">
              <div>• ${escapeHtml(item.nama_pos)}</div>
              <div class="vol-label">${item.volume || 1} ${escapeHtml(item.satuan || 'kegiatan')}</div>
            </td>
            <td class="text-right">${formatRupiah(item.pagu_awal)}</td>
            <td class="text-right text-amber">${formatRupiah(item.total_terserap)}</td>
            <td class="text-right text-muted">${item.pagu_tercadangkan > 0 ? formatRupiah(item.pagu_tercadangkan) : '-'}</td>
            <td class="text-right ${item.sisa_pagu <= 0 ? 'text-red' : 'text-green'}">${formatRupiah(item.sisa_pagu)}</td>
            <td class="text-center">
              <span class="status-badge small ${iStatusClass}">${iStatusLabel} (${iPersen}%)</span>
            </td>
          </tr>
        `;
      });
    }
  });

  const totalPagu = summary ? summary.total_pagu : posList.reduce((s, it) => s + (it.pagu_awal || 0), 0);
  const totalTerserap = summary ? summary.total_terserap : posList.reduce((s, it) => s + (it.total_terserap || 0), 0);
  const totalPending = summary ? summary.total_tercadangkan : posList.reduce((s, it) => s + (it.pagu_tercadangkan || 0), 0);
  const totalSisa = summary ? summary.sisa_pagu_aktif : (totalPagu - totalTerserap - totalPending);
  const grandPersen = totalPagu > 0 ? Math.round(((totalTerserap + totalPending) / totalPagu) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Buku Besar RKAS 2026/2027 - SMA Negeri 1 Gianyar</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/img/logo_sekolah.png">
  <link rel="stylesheet" href="/libs/tabler-icons/tabler-icons.min.css">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 8.5pt;
      line-height: 1.35;
      color: #0f172a;
      background: #e2e8f0;
      padding: 16px;
    }

    .no-print-toolbar {
      max-width: 297mm;
      margin: 0 auto 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all 0.2s;
    }
    .btn-print { background: #1d4ed8; color: #ffffff; }
    .btn-print:hover { background: #1e40af; }
    .btn-excel { background: #059669; color: #ffffff; }
    .btn-excel:hover { background: #047857; }
    .btn-back { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    .btn-back:hover { background: #e2e8f0; }

    .print-sheet {
      width: 297mm;
      min-height: 210mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 12mm 15mm;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border-radius: 4px;
    }

    /* Kop Surat Resmi */
    .kop-surat {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2.5px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 12px;
      position: relative;
    }
    .kop-surat::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 1px;
      background: #000000;
    }
    .kop-logo {
      width: 65px;
      height: 65px;
      object-fit: contain;
    }
    .kop-text {
      flex: 1;
      text-align: center;
    }
    .kop-h1 { font-size: 11pt; font-weight: 800; letter-spacing: 0.5px; }
    .kop-h2 { font-size: 10pt; font-weight: 700; }
    .kop-h3 { font-size: 14pt; font-weight: 900; letter-spacing: 1px; color: #000; margin: 2px 0; }
    .kop-p { font-size: 8pt; color: #334155; }

    .doc-title {
      text-align: center;
      margin: 14px 0 10px;
    }
    .doc-title h2 {
      font-size: 12pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-title p {
      font-size: 8.5pt;
      color: #475569;
      font-weight: 600;
    }

    /* Summary Bar */
    .summary-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #f8fafc;
    }
    .summary-card-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .summary-card-val { font-size: 10pt; font-weight: 800; color: #0f172a; }

    /* Data Table */
    .rkas-print-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 16px;
    }
    .rkas-print-table th,
    .rkas-print-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      vertical-align: middle;
    }
    .rkas-print-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      text-align: center;
    }
    .rkas-print-table tfoot td {
      background: #f8fafc;
      font-weight: 800;
      border-top: 2px solid #0f172a;
    }

    .row-parent td {
      background: #edf5fe !important;
      font-weight: 700;
      border-top: 1.5px solid #bfdbfe;
      border-bottom: 1.5px solid #bfdbfe;
    }
    .row-child td {
      background: #ffffff;
      padding: 4px 6px;
    }
    .row-single td {
      background: #ffffff;
    }

    .font-bold { font-weight: 700; }
    .font-mono { font-family: monospace; }
    .text-center { text-align: center; }
    .text-right { text-align: right; white-space: nowrap; }
    .text-primary { color: #1d4ed8; }
    .text-green { color: #047857; }
    .text-amber { color: #b45309; }
    .text-red { color: #b91c1c; }
    .text-muted { color: #64748b; }

    .snp-label { font-size: 7pt; font-weight: 800; color: #1e40af; }
    .program-sub { font-size: 6.8pt; color: #64748b; }
    .vol-label { font-size: 6.8pt; color: #64748b; }

    .status-badge {
      display: inline-block;
      font-size: 6.8pt;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .status-badge.status-green { background: #ecfdf5; color: #064e3b; border: 1px solid #6ee7b7; }
    .status-badge.status-yellow { background: #fffbeb; color: #78350f; border: 1px solid #fcd34d; }
    .status-badge.status-red { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }

    /* Signature Section */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      text-align: center;
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .sign-box-title { font-size: 8pt; font-weight: 700; color: #475569; }
    .sign-space { height: 50px; }
    .sign-name { font-size: 8.5pt; font-weight: 800; text-decoration: underline; color: #0f172a; }
    .sign-nip { font-size: 7.5pt; color: #64748b; }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .print-sheet {
        width: 100%;
        min-height: auto;
        box-shadow: none;
        padding: 0;
      }
      @page {
        size: A4 landscape;
        margin: 10mm 12mm;
      }
    }
  </style>
</head>
<body>

  <!-- Toolbar Atas (Otomatis Sembunyi Saat Cetak/PDF) -->
  <div class="no-print-toolbar">
    <div style="display: flex; align-items: center; gap: 10px;">
      <a href="/" class="btn-action btn-back">
        <i class="ti ti-arrow-left"></i> Kembali ke Sistem
      </a>
      <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">
        Preview Format Cetak Resmi A4 Landscape
      </span>
    </div>
    <div style="display: flex; gap: 8px;">
      <a href="/api/export/rkas/excel" class="btn-action btn-excel">
        <i class="ti ti-file-spreadsheet"></i> Unduh Excel (.xlsx)
      </a>
      <button type="button" class="btn-action btn-print" onclick="window.print()">
        <i class="ti ti-printer"></i> Cetak / Simpan PDF
      </button>
    </div>
  </div>

  <!-- Lembar Cetak Kertas -->
  <div class="print-sheet">
    
    <!-- Kop Resmi Sekolah -->
    <div class="kop-surat">
      <img src="/img/logo_sekolah.png" alt="Logo SMAN 1 Gianyar" class="kop-logo">
      <div class="kop-text">
        <div class="kop-h1">PEMERINTAH PROVINSI BALI</div>
        <div class="kop-h2">DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</div>
        <div class="kop-h3">SMA NEGERI 1 GIANYAR</div>
        <div class="kop-p">Jalan Ratna No. 1 Gianyar, Telp. (0361) 943034 • Website: www.sman1gianyar.sch.id</div>
      </div>
    </div>

    <!-- Judul Dokumen -->
    <div class="doc-title">
      <h2>BUKU BESAR RKAS &amp; KONTROL SERAPAN ANGGARAN SEKOLAH</h2>
      <p>Tahun Ajaran 2026/2027 — Sumber Dana: Sumbangan Masyarakat / Komite Sekolah</p>
    </div>

    <!-- Ringkasan Eksekutif -->
    <div class="summary-bar">
      <div class="summary-card">
        <div class="summary-card-title">Total Plafon Anggaran</div>
        <div class="summary-card-val">${formatRupiah(totalPagu)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-title">Dana Dicairkan (Terserap)</div>
        <div class="summary-card-val text-amber">${formatRupiah(totalTerserap)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-title">Tercadangkan (Pending)</div>
        <div class="summary-card-val text-muted">${formatRupiah(totalPending)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-card-title">Sisa Plafon Anggaran</div>
        <div class="summary-card-val text-green">${formatRupiah(totalSisa)} (${100 - grandPersen}%)</div>
      </div>
    </div>

    <!-- Tabel Data Lengkap -->
    <table class="rkas-print-table">
      <thead>
        <tr>
          <th style="width: 25px;">No</th>
          <th style="width: 75px;">Kode Rekening</th>
          <th style="width: 110px;">Program / SNP</th>
          <th>Uraian Pos Anggaran &amp; Volume</th>
          <th style="width: 95px;">Pagu Plafon</th>
          <th style="width: 95px;">Realisasi Kas</th>
          <th style="width: 80px;">Pending</th>
          <th style="width: 95px;">Sisa Plafon</th>
          <th style="width: 75px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="text-right" style="text-align: right; padding-right: 12px;">TOTAL KESELURUHAN BUKU BESAR RKAS:</td>
          <td class="text-right font-bold">${formatRupiah(totalPagu)}</td>
          <td class="text-right font-bold text-amber">${formatRupiah(totalTerserap)}</td>
          <td class="text-right font-bold text-muted">${formatRupiah(totalPending)}</td>
          <td class="text-right font-bold text-green">${formatRupiah(totalSisa)}</td>
          <td class="text-center font-bold">${grandPersen}%</td>
        </tr>
      </tfoot>
    </table>

    <!-- Blok Tanda Tangan Resmi Pengesahan -->
    <div class="signature-grid">
      <div>
        <div class="sign-box-title">Diverifikasi &amp; Disahkan Oleh:</div>
        <div style="font-size: 7.8pt; font-weight: 700; color: #0f172a; margin-top: 2px;">Analisis SDM &amp; Otorisasi Pimpinan</div>
        <div class="sign-space"></div>
        <div class="sign-name">I Gusti Ngurah Nyoman Okta Ariawan, SSTP</div>
        <div class="sign-nip">NIP. 198804252014022003</div>
      </div>

      <div>
        <div class="sign-box-title">Pengelola Administrasi Keuangan:</div>
        <div style="font-size: 7.8pt; font-weight: 700; color: #0f172a; margin-top: 2px;">Bendahara Sekolah / Komite</div>
        <div class="sign-space"></div>
        <div class="sign-name">I Gusti Ayu Reina Cahyanti</div>
        <div class="sign-nip">NIP. 198203152008012015</div>
      </div>

      <div>
        <div class="sign-box-title">Gianyar, ${currentDate}</div>
        <div style="font-size: 7.8pt; font-weight: 700; color: #0f172a; margin-top: 2px;">Kepala SMA Negeri 1 Gianyar</div>
        <div class="sign-space"></div>
        <div class="sign-name">I Wayan Sudra Astra, S.Pd., M.Pd</div>
        <div class="sign-nip">NIP. 196811201994121001</div>
      </div>
    </div>

  </div>

</body>
</html>`;
}

module.exports = {
  renderCetakRkas
};

