const { getPenandatanganMap, formatNipCetak, getPengaturanSekolahMap } = require('../db');
const { terbilang } = require('../utils/terbilang');
const { renderKopSurat, getKopSuratCss } = require('./kop-surat');

function formatRupiahKwitansi(val) {
  const num = Number(val) || 0;
  return 'Rp ' + num.toLocaleString('id-ID') + ',00';
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

function sanitizeRichHtml(str) {
  if (!str) return '';
  let s = String(str);
  s = s.replace(/<\s*(script|iframe|object|embed|style|link|meta)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*\/?>/gi, '');
  s = s.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/javascript\s*:/gi, '');
  return s;
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

function renderCetakPengadaanJasa({ proposal }) {
  const lpj = proposal.lpj || {};
  const fotoItems = Array.isArray(lpj.foto_dokumentasi) ? lpj.foto_dokumentasi : [];

  const danaCair = lpj.total_dana_cair !== null && lpj.total_dana_cair !== undefined
    ? Number(lpj.total_dana_cair)
    : Number(proposal.total_dana_disetujui || proposal.total_dana_diajukan || 0);

  const nominalJasa = lpj.total_belanja_riil !== null && lpj.total_belanja_riil !== undefined && Number(lpj.total_belanja_riil) > 0
    ? Number(lpj.total_belanja_riil)
    : danaCair;

  const terbilangJasa = terbilang(nominalJasa);
  const tglCetak = lpj.tanggal_laporan
    ? formatDateIndo(lpj.tanggal_laporan)
    : formatDateIndo(proposal.tanggal_pencairan || new Date());

  const SCH = typeof getPengaturanSekolahMap === 'function' ? getPengaturanSekolahMap() : {};
  const pembayarKwitansi = SCH.pembayar_kuitansi || 'Pembantu Bendahara Dana Pungutan Masyarakat SMA Negeri 1 Gianyar';
  const kodeRekeningDefault = SCH.kode_rekening_default || '';
  const kotaSurat = SCH.kota_surat || 'Gianyar';

  const SG = getPenandatanganMap();
  const sg = (k) => SG[k] || { jabatan: '', nama: '-', nip: '' };
  const kepsekNama = sg('KEPSEK').nama;
  const kepsekNip = formatNipCetak(sg('KEPSEK').nip);
  const analisSdmNama = sg('ANALIS_SDM').nama;
  const analisSdmNip = formatNipCetak(sg('ANALIS_SDM').nip);
  const bendaharaNama = sg('BENDAHARA_PUNGUTAN').nama;
  const bendaharaPembantuNama = sg('BENDAHARA_PEMBANTU').nama;
  const bendaharaPembantuNip = formatNipCetak(sg('BENDAHARA_PEMBANTU').nip);
  const ketuaKomiteNama = sg('KETUA_KOMITE').nama;
  const wakaHumas = sg('WAKA_HUMAS');
  const wakaHumasNama = wakaHumas.nama;
  const wakaHumasNip = formatNipCetak(wakaHumas.nip);

  const isDraftLpj = lpj.status_lpj === 'DRAFT';
  const draftWatermarkHtml = isDraftLpj ? `
    <div style="position: fixed; top: 38%; left: 8%; right: 8%; text-align: center; font-size: 48pt; font-weight: 900; color: rgba(220, 38, 38, 0.18); transform: rotate(-28deg); pointer-events: none; z-index: 99999; border: 5px dashed rgba(220, 38, 38, 0.28); padding: 18px 25px; border-radius: 12px; letter-spacing: 5px; font-family: sans-serif;">
      DRAFT — BELUM DISAHKAN
    </div>
  ` : '';

  // Halaman 2: Dokumentasi Foto (2 foto per halaman A4 vertikal atas-bawah)
  let fotoPagesHtml = '';
  if (fotoItems.length > 0) {
    for (let i = 0; i < fotoItems.length; i += 2) {
      const chunk = fotoItems.slice(i, i + 2);
      fotoPagesHtml += `
        <div class="sheet page-break">
          <div class="foto-stack-vertical">
            ${chunk.map(f => `
              <div class="foto-vertical-box">
                <img src="${f.file_url}" alt="Dokumentasi Pengadaan Jasa" onerror="this.src='/img/logo-dosman-hd.png';">
                ${f.caption ? `<div class="foto-vertical-caption">${escapeHtml(f.caption)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  } else {
    fotoPagesHtml = `
      <div class="sheet page-break">
        <div class="empty-doc-box">
          <div style="font-weight: 700; font-size: 11pt; color: #334155;">Belum Ada Dokumentasi Foto</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Unggah 2 foto dokumentasi pelaksanaan jasa pada formulir LPJ Pengadaan Jasa.</div>
        </div>
      </div>
    `;
  }

  // Halaman 3: Surat Perjanjian Kerja Sama (File Scan PDF/Gambar atau Teks Editor)
  let perjanjianPageHtml = '';
  if (lpj.jasa_file_perjanjian_url) {
    if (lpj.jasa_file_perjanjian_url.toLowerCase().endsWith('.pdf')) {
      perjanjianPageHtml = `
        <div class="pdf-multipage-container" data-pdf-url="${lpj.jasa_file_perjanjian_url}">
          <div class="sheet page-break">
            <div class="empty-doc-box">
              <div style="font-weight: 700; color: #1e293b;">Memproses Halaman Surat Perjanjian Kerja Sama PDF...</div>
            </div>
          </div>
        </div>
      `;
    } else {
      perjanjianPageHtml = `
        <div class="sheet page-break">
          <div class="full-scan-wrap">
            <img src="${lpj.jasa_file_perjanjian_url}" alt="Surat Perjanjian Kerja Sama">
          </div>
        </div>
      `;
    }
  } else if (lpj.jasa_teks_perjanjian) {
    perjanjianPageHtml = `
      <div class="sheet page-break">
        <div class="perjanjian-text-body rich-html-content">
          ${sanitizeRichHtml(lpj.jasa_teks_perjanjian)}
        </div>
      </div>
    `;
  } else {
    perjanjianPageHtml = `
      <div class="sheet page-break">
        <div class="empty-doc-box">
          <div style="font-weight: 700; font-size: 11pt; color: #334155;">Belum Ada Surat Perjanjian Kerja Sama</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Unggah scan/PDF Surat Perjanjian atau ketik naskah perjanjian di formulir LPJ Pengadaan Jasa.</div>
        </div>
      </div>
    `;
  }

  // Halaman 4: Lampiran Bukti Setoran / Slip Transfer Bank
  let transferPageHtml = '';
  if (proposal.file_bukti_transfer_url) {
    if (proposal.file_bukti_transfer_url.toLowerCase().endsWith('.pdf')) {
      transferPageHtml = `
        <div class="pdf-multipage-container" data-pdf-url="${proposal.file_bukti_transfer_url}">
          <div class="sheet">
            <div class="empty-doc-box">
              <div style="font-weight: 700; color: #1e293b;">Memproses Halaman Bukti Setoran / Transfer PDF...</div>
            </div>
          </div>
        </div>
      `;
    } else {
      transferPageHtml = `
        <div class="sheet">
          <div class="full-scan-wrap">
            <img src="${proposal.file_bukti_transfer_url}" alt="Bukti Setoran Bank">
          </div>
        </div>
      `;
    }
  } else {
    transferPageHtml = `
      <div class="sheet">
        <div class="empty-doc-box">
          <div style="font-weight: 700; font-size: 11pt; color: #334155;">Belum Ada Lampiran Bukti Setoran / Slip Transfer Bank</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Unggah scan/foto formulir setoran atau slip transfer bank melalui form LPJ atau Pencairan Kas Bendahara.</div>
        </div>
      </div>
    `;
  }

  const untukPembayaran = lpj.jasa_untuk_pembayaran || `Dibayar Belanja Barang dan Jasa ${proposal.nama_kegiatan} Pada Dana Komite SMAN 1 Gianyar`;
  const penerimaTeks = lpj.jasa_penerima_nama ? escapeHtml(lpj.jasa_penerima_nama) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Pengadaan Jasa - ${escapeHtml(proposal.nama_kegiatan)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 16mm 12mm 16mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10.5pt;
      color: #000000;
      background: #e2e8f0;
      line-height: 1.4;
    }
    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #ffffff;
      border-bottom: 1px solid #cbd5e1;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    }
    .btn-toolbar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-secondary { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
    .btn-primary { background: #059669; color: #ffffff; }
    .sheet-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 20px 0 40px;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      background: #ffffff;
      padding: 12mm 16mm;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
      position: relative;
    }
    .page-break {
      page-break-after: always;
    }

    ${getKopSuratCss('portrait')}

    /* Kwitansi Pengadaan Jasa */
    .kwitansi-banner {
      background: #94a3b8;
      color: #000000;
      font-weight: 700;
      font-size: 13pt;
      letter-spacing: 2px;
      text-align: center;
      padding: 3px 0;
      border: 1.5px solid #000000;
      margin-bottom: 10px;
    }
    .kwitansi-meta-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      margin-bottom: 12px;
    }
    .kwitansi-meta-table td {
      padding: 4px 2px;
      vertical-align: top;
    }
    .kwitansi-meta-table td.lbl { width: 140px; }
    .kwitansi-meta-table td.col { width: 16px; text-align: center; }
    .terbilang-box {
      border: 1.5px solid #000000;
      padding: 4px 10px;
      font-style: italic;
      font-weight: 600;
      background: #f8fafc;
    }
    .nominal-box {
      display: inline-block;
      border: 1.5px solid #000000;
      padding: 4px 14px;
      font-weight: 700;
      font-size: 11pt;
      min-width: 170px;
    }
    .penerima-row {
      display: flex;
      justify-content: flex-end;
      margin: 14px 10px 18px 0;
    }
    .penerima-box {
      width: 240px;
      text-align: left;
      font-size: 10pt;
    }
    .penerima-sign-space {
      height: 58px;
    }
    .sig-grid-6 {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 9.5pt;
    }
    .sig-grid-6 td {
      width: 50%;
      vertical-align: top;
      padding: 6px 8px 10px 4px;
    }
    .sig-space-6 {
      height: 52px;
    }
    .sig-name-6 {
      font-weight: 700;
    }

    /* Halaman 2: 2 Foto Vertikal */
    .foto-stack-vertical {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14mm;
      min-height: 255mm;
    }
    .foto-vertical-box {
      width: 100%;
      text-align: center;
    }
    .foto-vertical-box img {
      max-width: 100%;
      max-height: 112mm;
      object-fit: contain;
    }
    .foto-vertical-caption {
      margin-top: 6px;
      font-size: 9.5pt;
      color: #334155;
      font-style: italic;
    }

    /* Halaman 3 & 4: Scan Dokumen / Teks Perjanjian */
    .full-scan-wrap {
      width: 100%;
      min-height: 260mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .full-scan-wrap img {
      max-width: 100%;
      max-height: 262mm;
      object-fit: contain;
    }
    .perjanjian-text-body {
      font-size: 10.5pt;
      line-height: 1.55;
      text-align: justify;
    }
    .empty-doc-box {
      min-height: 240mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      border: 1.5px dashed #cbd5e1;
      border-radius: 8px;
      padding: 30px;
    }

    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .no-print-toolbar { display: none !important; }
      .sheet-wrapper { padding: 0 !important; gap: 0 !important; }
      .sheet { box-shadow: none !important; padding: 0 !important; width: 100% !important; min-height: auto !important; margin: 0 !important; }
    }
  </style>
</head>
<body>
  ${draftWatermarkHtml}

  <div class="no-print-toolbar">
    <div>
      <div style="font-weight: 800; font-size: 0.98rem; color: #0f172a;">Pratinjau Laporan Pengadaan Jasa (Wakasek Humas)</div>
      <div style="font-size: 0.78rem; color: #64748b;">Urutan: 1. Kwitansi • 2. Dokumentasi Foto • 3. Perjanjian Kerja Sama • 4. Bukti Setoran Bank</div>
    </div>
    <div style="display: flex; gap: 10px;">
      <a href="/" class="btn-toolbar btn-secondary">← Kembali ke Aplikasi</a>
      <button onclick="window.print()" class="btn-toolbar btn-primary">🖨️ Cetak Laporan (PDF)</button>
    </div>
  </div>

  <div class="sheet-wrapper">
    <!-- HALAMAN 1: KWITANSI RESMI (KOP BALI + 6 TANDA TANGAN) -->
    <div class="sheet page-break">
      ${renderKopSurat({ mode: 'portrait' })}

      <div class="kwitansi-banner">KWITANSI</div>

      <table class="kwitansi-meta-table">
        <tr>
          <td class="lbl">No. Kode</td>
          <td class="col">:</td>
          <td>${escapeHtml(lpj.jasa_no_kode || '')}</td>
        </tr>
        <tr>
          <td class="lbl">Kode. Rekening</td>
          <td class="col">:</td>
          <td>${escapeHtml(lpj.jasa_kode_rekening || kodeRekeningDefault)}</td>
        </tr>
        <tr>
          <td class="lbl">Sudah terima dari</td>
          <td class="col">:</td>
          <td>${escapeHtml(pembayarKwitansi)}</td>
        </tr>
        <tr>
          <td class="lbl">Terbilang</td>
          <td class="col">:</td>
          <td><div class="terbilang-box">${escapeHtml(terbilangJasa)} Rupiah</div></td>
        </tr>
        <tr>
          <td class="lbl">Untuk Pembayaran</td>
          <td class="col">:</td>
          <td style="white-space: pre-line;">${escapeHtml(untukPembayaran)}</td>
        </tr>
        <tr>
          <td class="lbl" style="padding-top: 10px;">Uang Sebanyak</td>
          <td class="col" style="padding-top: 10px;">:</td>
          <td style="padding-top: 8px;"><span class="nominal-box">${formatRupiahKwitansi(nominalJasa)}</span></td>
        </tr>
      </table>

      <div class="penerima-row">
        <div class="penerima-box">
          <div>${escapeHtml(kotaSurat)}, ${tglCetak}</div>
          <div>Yang Menerima</div>
          <div class="penerima-sign-space"></div>
          <div>(&nbsp;${penerimaTeks}&nbsp;)</div>
        </div>
      </div>

      <table class="sig-grid-6">
        <tr>
          <td>
            <div>Mengetahui / Menyetujui,</div>
            <div>Kepala Sekolah SMA Negeri 1 Gianyar</div>
            <div class="sig-space-6"></div>
            <div class="sig-name-6">${escapeHtml(kepsekNama)}</div>
            <div>${escapeHtml(kepsekNip)}</div>
          </td>
          <td>
            <div>Analis SDM Aparatur Ahli Muda</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space-6"></div>
            <div class="sig-name-6">${escapeHtml(analisSdmNama)}</div>
            <div>${escapeHtml(analisSdmNip)}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div>Bendahara Dana Pungutan Masyarakat</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space-6"></div>
            <div class="sig-name-6">${escapeHtml(bendaharaNama)}</div>
          </td>
          <td>
            <div>Lunas dibayar oleh :</div>
            <div>Bendahara Pemb. Dana Pungutan Masyarakat SMA Negeri 1 Gianyar</div>
            <div class="sig-space-6"></div>
            <div class="sig-name-6">${escapeHtml(bendaharaPembantuNama)}</div>
            <div>${escapeHtml(bendaharaPembantuNip)}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div>Ketua Komite</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space-6"></div>
            <div class="sig-name-6">${escapeHtml(ketuaKomiteNama)}</div>
          </td>
          <td>
            <div>Wakasek. Humas</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space-6"></div>
            <div class="sig-name-6">${escapeHtml(wakaHumasNama)}</div>
            <div>${escapeHtml(wakaHumasNip)}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- HALAMAN 2: DOKUMENTASI FOTO -->
    ${fotoPagesHtml}

    <!-- HALAMAN 3: SURAT PERJANJIAN KERJA SAMA -->
    ${perjanjianPageHtml}

    <!-- HALAMAN 4: LAMPIRAN BUKTI SETORAN / SLIP TRANSFER BANK -->
    ${transferPageHtml}
  </div>

  <script src="/js/pdf.min.js"></script>
  <script>
    (function() {
      if (typeof pdfjsLib === 'undefined') return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
      document.querySelectorAll('.pdf-multipage-container').forEach(async function(container) {
        var url = container.getAttribute('data-pdf-url');
        if (!url) return;
        try {
          var pdf = await pdfjsLib.getDocument(url).promise;
          container.innerHTML = '';
          for (var p = 1; p <= pdf.numPages; p++) {
            var page = await pdf.getPage(p);
            var vp = page.getViewport({ scale: 2.0 });
            var canvas = document.createElement('canvas');
            canvas.width = vp.width;
            canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
            var imgData = canvas.toDataURL('image/jpeg', 0.92);
            var sheet = document.createElement('div');
            sheet.className = 'sheet page-break';
            sheet.innerHTML = '<div class="full-scan-wrap"><img src="' + imgData + '" alt="Lampiran PDF Halaman ' + p + '"></div>';
            container.appendChild(sheet);
          }
        } catch (err) {
          console.error('PDF render error:', err);
        }
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderCetakPengadaanJasa };
