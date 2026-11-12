// ==========================================================================
// Generator Bundel Cetak Resmi LPJ Kegiatan Siswa (A4 Print-Ready)
// Sesuai Standar Resmi SMA Negeri 1 Gianyar & Pergub Bali No. 80 Th 2018
// Merangkai: Cover, Kwitansi, Lembar LPJ & RAB, Bukti Transfer, Daftar Hadir,
//            Dokumentasi Foto, dan Bukti Nota Belanja ke dalam 1 Dokumen Utuh.
// ==========================================================================

const { terbilang } = require('../utils/terbilang');
const { renderKopSurat, getKopSuratCss } = require('./kop-surat');

function formatRupiah(val) {
  const num = Number(val) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

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

function getMonthNameIndo(dateStr) {
  if (!dateStr) return 'NOPEMBER';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'NOPEMBER';
    const m = d.toLocaleDateString('id-ID', { month: 'long' });
    return m.toUpperCase();
  } catch (e) {
    return 'NOPEMBER';
  }
}

function renderCetakLpjBundel({ proposal, hostUrl = '' }) {
  const lpj = proposal.lpj || {};
  const items = Array.isArray(proposal.items) ? proposal.items : [];
  const notaItems = Array.isArray(lpj.nota_items) ? lpj.nota_items : [];
  const fotoItems = Array.isArray(lpj.foto_dokumentasi) ? lpj.foto_dokumentasi : [];

  const danaCair = lpj.total_dana_cair !== null && lpj.total_dana_cair !== undefined
    ? Number(lpj.total_dana_cair)
    : Number(proposal.total_dana_disetujui || proposal.total_dana_diajukan || 0);

  const belanjaRiil = lpj.total_belanja_riil !== null && lpj.total_belanja_riil !== undefined
    ? Number(lpj.total_belanja_riil)
    : (items.length > 0
        ? items.reduce((acc, it) => acc + (it.subtotal_disetujui !== null ? Number(it.subtotal_disetujui) : Number(it.subtotal_ajuan || 0)), 0)
        : danaCair);

  const terbilangRupiah = terbilang(belanjaRiil);
  const terbilangDanaCair = terbilang(danaCair);
  const sisaPengembalian = lpj.sisa_pengembalian_dana !== null && lpj.sisa_pengembalian_dana !== undefined
    ? Number(lpj.sisa_pengembalian_dana)
    : Math.max(0, danaCair - belanjaRiil);

  // Tanggal cetak & pelaksanaan
  const tglCetak = formatDateIndo(proposal.tanggal_pencairan || new Date());
  const tglMulai = formatDateIndo(proposal.tanggal_mulai);
  const tglSelesai = formatDateIndo(proposal.tanggal_selesai);
  const bulanLaporan = getMonthNameIndo(proposal.tanggal_mulai || proposal.tanggal_pencairan);
  const tahunAnggaran = proposal.tahun_ajaran ? proposal.tahun_ajaran.split('/')[0] : '2026';

  // Pejabat & Penandatangan Standar SMAN 1 Gianyar
  const kepsekNama = 'I Wayan Sudra Astra, S.Pd., M.Pd.';
  const kepsekNip = '19710415 199703 1 007';
  const analisSdmNama = 'I Gusti Ngurah Nyoman Okta Ariawan S.STP';
  const analisSdmNip = '19921003 201507 1 001';
  const bendaharaNama = 'I Dewa Ayu Istri Megaswari';
  const bendaharaPembantuNama = 'I Nyoman Suwaradana';
  const bendaharaPembantuNip = '19721010 200903 1 003';
  const ketuaKomiteNama = 'Ir. Pande Nyoman Yuliana';
  const wakasekNama = 'I Putu Darma Putra, S.Pd';
  const wakasekNip = 'PPPK. 19880930 202221 1 001';

  // Guru / Pembina
  const guruNama = proposal.pemohon_nama || 'Ni Wayan Setiawati, S.Pd';
  const guruNip = proposal.pemohon_nip ? `NIP. ${proposal.pemohon_nip}` : '-';

  // Rincian Baris Belanja Tabel RAB (Hal 3)
  let rowsRabHtml = '';
  if (items.length > 0) {
    rowsRabHtml = items.map((item, idx) => {
      const vol = item.volume_disetujui !== null && item.volume_disetujui !== undefined ? item.volume_disetujui : item.volume_ajuan;
      const sat = item.satuan || '-';
      const harga = item.harga_satuan_disetujui !== null && item.harga_satuan_disetujui !== undefined ? item.harga_satuan_disetujui : item.harga_satuan_ajuan;
      const subtotal = item.subtotal_disetujui !== null && item.subtotal_disetujui !== undefined ? item.subtotal_disetujui : item.subtotal_ajuan;
      const deskripsi = item.deskripsi_item || item.nama_item || 'Belanja Kegiatan';
      const ket = item.catatan_koreksi || item.kategori_belanja || '';

      return `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>
            <div class="item-name">${escapeHtml(deskripsi)}</div>
            ${item.kategori_belanja ? `<span class="badge-sub">${escapeHtml(item.kategori_belanja)}</span>` : ''}
          </td>
          <td class="text-center">${vol}</td>
          <td class="text-center">${escapeHtml(sat)}</td>
          <td class="text-right">${formatRupiah(harga)}</td>
          <td class="text-right font-bold">${formatRupiah(subtotal)}</td>
          <td class="text-center font-sm">${escapeHtml(ket)}</td>
        </tr>
      `;
    }).join('');
  } else {
    rowsRabHtml = `
      <tr>
        <td class="text-center">1</td>
        <td>${escapeHtml(proposal.nama_kegiatan)}</td>
        <td class="text-center">1</td>
        <td class="text-center">Paket</td>
        <td class="text-right">${formatRupiah(belanjaRiil)}</td>
        <td class="text-right font-bold">${formatRupiah(belanjaRiil)}</td>
        <td class="text-center font-sm">Lunas</td>
      </tr>
    `;
  }

  // Galeri Lampiran Foto (1-2 Foto per lembar)
  let fotoPagesHtml = '';
  if (fotoItems.length > 0) {
    // Kelompokkan 2 foto per halaman
    for (let i = 0; i < fotoItems.length; i += 2) {
      const chunk = fotoItems.slice(i, i + 2);
      fotoPagesHtml += `
        <div class="sheet page-break">
          <div class="lampiran-header">
            <div class="lampiran-title">DOKUMENTASI FOTO PELAKSANAAN KEGIATAN</div>
            <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)} • Lembar ${Math.floor(i / 2) + 1}</div>
          </div>
          <div class="foto-grid-container">
            ${chunk.map((f, fIdx) => `
              <div class="foto-card">
                <div class="foto-img-wrap">
                  <img src="${f.file_url}" alt="Foto Kegiatan" onerror="this.src='/img/logo-dosman-hd.png';">
                </div>
                <div class="foto-caption">
                  <strong>Foto ${i + fIdx + 1}:</strong> ${escapeHtml(f.caption || 'Dokumentasi kegiatan siswa')}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="page-footer-note">Laporan Pertanggungjawaban Resmi — SMA Negeri 1 Gianyar</div>
        </div>
      `;
    }
  }

  // 1. Lembar Berkas Bundel Gabungan Seluruh Nota (Master PDF / Gambar jika diunggah)
  let masterNotaPagesHtml = '';
  if (lpj.file_nota_url) {
    const isMasterPdf = lpj.file_nota_url.toLowerCase().endsWith('.pdf');
    if (isMasterPdf) {
      masterNotaPagesHtml = `
        <div class="pdf-multipage-container" data-pdf-url="${lpj.file_nota_url}" data-title="BUNDEL LAMPIRAN NOTA &amp; KUITANSI BELANJA" data-sub="${escapeHtml(proposal.nama_kegiatan)} • Berkas Scan Gabungan" data-footer="Bukti sah verifikasi pembukuan bendahara — SMA Negeri 1 Gianyar">
          <div class="sheet page-break">
            <div class="lampiran-header">
              <div class="lampiran-title">BUNDEL LAMPIRAN NOTA &amp; KUITANSI BELANJA</div>
              <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)} • Berkas Scan Gabungan</div>
            </div>
            <div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: #475569;">
              <div style="font-size: 2rem; margin-bottom: 12px;">⏳</div>
              <div style="font-weight: 700; font-size: 1.1rem; color: #1e293b; margin-bottom: 6px;">Memproses Bundel Scan Nota PDF...</div>
              <div style="font-size: 0.85rem; color: #64748b;">Setiap halaman berkas bundel kuitansi sedang dikonversi otomatis menjadi lembar siap cetak.</div>
            </div>
            <div class="page-footer-note">Bukti sah verifikasi pembukuan bendahara — SMA Negeri 1 Gianyar</div>
          </div>
        </div>
      `;
    } else {
      masterNotaPagesHtml = `
        <div class="sheet page-break">
          <div class="lampiran-header">
            <div class="lampiran-title">BUNDEL LAMPIRAN NOTA &amp; KUITANSI BELANJA</div>
            <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)} • Berkas Scan Gabungan</div>
          </div>
          <div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; align-items: center; justify-content: center; padding: 4mm;">
            <img src="${lpj.file_nota_url}" alt="Bundel Nota Fisik" style="max-width: 100%; max-height: 220mm; object-fit: contain;">
          </div>
          <div class="page-footer-note">Bukti sah verifikasi pembukuan bendahara — SMA Negeri 1 Gianyar</div>
        </div>
      `;
    }
  }

  // 2. Galeri Lampiran Nota Belanja Per Toko (1-2 Nota per lembar)
  let itemNotaPagesHtml = '';
  const validNotas = notaItems.filter(n => n.file_url);
  if (validNotas.length > 0) {
    for (let i = 0; i < validNotas.length; i += 2) {
      const chunk = validNotas.slice(i, i + 2);
      itemNotaPagesHtml += `
        <div class="sheet page-break">
          <div class="lampiran-header">
            <div class="lampiran-title">LAMPIRAN BUKTI NOTA &amp; KUITANSI BELANJA</div>
            <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)} • Lembar Bukti Fisik ${Math.floor(i / 2) + 1}</div>
          </div>
          <div class="nota-grid-container">
            ${chunk.map((n, nIdx) => `
              <div class="nota-card">
                <div class="nota-meta-bar">
                  <span><strong>Toko/Penyedia:</strong> ${escapeHtml(n.nama_toko || 'Toko Rekanan')}</span>
                  <span><strong>Nominal:</strong> ${formatRupiah(n.nominal)}</span>
                </div>
                ${n.file_url.toLowerCase().endsWith('.pdf') ? `
                  <div class="nota-img-wrap pdf-render-target" data-pdf-url="${n.file_url}">
                    <div style="font-size: 0.8rem; color: #64748b; padding: 20px; text-align: center;">⏳ Memproses Gambar Nota PDF...</div>
                  </div>
                ` : `
                  <div class="nota-img-wrap">
                    <img src="${n.file_url}" alt="Bukti Nota Belanja" onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#b91c1c;\\'>⚠️ Berkas nota tidak dapat ditampilkan</div>';">
                  </div>
                `}
                ${n.uraian ? `<div class="nota-caption"><em>Uraian:</em> ${escapeHtml(n.uraian)}</div>` : ''}
              </div>
            `).join('')}
          </div>
          <div class="page-footer-note">Bukti sah verifikasi pembukuan bendahara — SMA Negeri 1 Gianyar</div>
        </div>
      `;
    }
  }

  const allNotaPagesHtml = masterNotaPagesHtml + itemNotaPagesHtml;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LPJ_${escapeHtml(proposal.nomor_surat_ajuan || '').split('/').join('_')}_BUNDEL_LENGKAP</title>
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
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
      font-size: 0.88rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    .btn-back:hover { background: #475569; }

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

    /* -------------------------------------------------------------
       KOP SURAT CSS SESUAI PERGUB BALI NO. 80 TAHUN 2018
    ------------------------------------------------------------- */
    ${getKopSuratCss('portrait')}

    /* -------------------------------------------------------------
       HALAMAN 1: COVER RESMI KEGIATAN
    ------------------------------------------------------------- */
    .cover-frame {
      border: 3px double #000000;
      min-height: 260mm;
      padding: 28mm 16mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
    }

    .cover-top-box {
      width: 100%;
    }

    .cover-heading-1 {
      font-size: 19pt;
      font-weight: 800;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }

    .cover-heading-2 {
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: 1.2px;
      margin-bottom: 14px;
      text-transform: uppercase;
    }

    .cover-heading-kegiatan {
      font-size: 15pt;
      font-weight: 700;
      color: #0f172a;
      max-width: 90%;
      margin: 0 auto;
      text-transform: uppercase;
      line-height: 1.3;
    }

    .cover-logo-center {
      margin: 40px 0;
    }

    .cover-logo-center img {
      width: 160px;
      height: 160px;
      object-fit: contain;
    }

    .cover-bottom-box {
      width: 100%;
    }

    .cover-school-name {
      font-size: 17pt;
      font-weight: 800;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }

    .cover-year {
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: 1px;
    }

    /* -------------------------------------------------------------
       HALAMAN 2: KWITANSI RESMI KOMITE (6 TANDA TANGAN)
    ------------------------------------------------------------- */
    .kwitansi-box-wrapper {
      border: 1.5px solid #000000;
      padding: 16px 20px;
      margin-bottom: 12px;
    }

    .kwitansi-header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }

    .kwitansi-header-table td {
      vertical-align: middle;
    }

    .kwitansi-logo {
      width: 68px;
      height: 68px;
      object-fit: contain;
    }

    .kwitansi-instansi-text {
      text-align: center;
      line-height: 1.2;
    }

    .kwitansi-instansi-text h4 { font-size: 11pt; font-weight: 800; text-transform: uppercase; }
    .kwitansi-instansi-text h3 { font-size: 12pt; font-weight: 800; text-transform: uppercase; }
    .kwitansi-instansi-text h2 { font-size: 14pt; font-weight: 900; text-transform: uppercase; margin: 2px 0; }
    .kwitansi-instansi-text p { font-size: 8pt; color: #1e293b; }

    .kwitansi-banner-title {
      background: #334155;
      color: #ffffff;
      text-align: center;
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: 3px;
      padding: 4px 0;
      margin-bottom: 14px;
      border: 1px solid #000000;
    }

    .kwitansi-data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
      margin-bottom: 18px;
    }

    .kwitansi-data-table td {
      padding: 4px 2px;
      vertical-align: top;
    }

    .kwitansi-data-table td.col-lbl { width: 140px; font-weight: 600; }
    .kwitansi-data-table td.col-col { width: 12px; text-align: center; }
    .kwitansi-data-table td.col-val { }

    .kwitansi-nominal-box {
      border: 2px solid #000000;
      display: inline-block;
      padding: 5px 16px;
      font-size: 13pt;
      font-weight: 800;
      font-style: italic;
      background: #e2e8f0;
      letter-spacing: 0.5px;
    }

    /* Matriks 6 Tanda Tangan Kwitansi */
    .kwitansi-sig-matrix {
      width: 100%;
      margin-top: 10px;
      font-size: 9.5pt;
      line-height: 1.25;
    }

    .sig-row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 24px;
      margin-bottom: 24px;
    }

    .sig-col { text-align: center; }
    .sig-col-right { text-align: center; }
    .sig-space-kwitansi { height: 48px; }
    .sig-name { font-weight: 800; text-decoration: underline; font-size: 10pt; }
    .sig-nip { font-size: 8.5pt; color: #1e293b; }

    /* -------------------------------------------------------------
       HALAMAN 3: LEMBAR LPJ & TABEL BELANJA SESUAI RAB (4 TANDA TANGAN)
    ------------------------------------------------------------- */
    .lpj-boxed-title {
      border: 2px solid #000000;
      text-align: center;
      padding: 7px 12px;
      font-size: 13.5pt;
      font-weight: 800;
      line-height: 1.25;
      margin: 10px 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .lpj-narasi-intro {
      font-size: 10.5pt;
      margin-bottom: 10px;
      text-align: justify;
    }

    .lpj-meta-grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      margin-bottom: 12px;
    }

    .lpj-meta-grid td {
      padding: 2.5px 0;
      vertical-align: top;
    }

    .lpj-meta-grid td.m-lbl { width: 160px; font-weight: 700; }
    .lpj-meta-grid td.m-col { width: 14px; text-align: center; }
    .lpj-meta-grid td.m-val { font-weight: 600; }

    /* Tabel Rincian Belanja Format Fisik */
    .rab-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-bottom: 14px;
    }

    .rab-table th, .rab-table td {
      border: 1px solid #000000;
      padding: 5px 6px;
    }

    .rab-table th {
      background: #f1f5f9;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      font-size: 8.5pt;
      letter-spacing: 0.3px;
    }

    .rab-table .total-row td {
      font-weight: 800;
      background: #f8fafc;
    }

    .rab-table .terbilang-row td {
      font-style: italic;
      font-weight: 700;
      padding: 6px 10px;
      background: #ffffff;
    }

    .item-name { font-weight: 700; }
    .badge-sub {
      display: inline-block;
      font-size: 7.5pt;
      padding: 1px 4px;
      background: #e2e8f0;
      border-radius: 3px;
      color: #334155;
      font-weight: 600;
    }

    /* Matriks 4 Tanda Tangan LPJ */
    .lpj-sig-matrix {
      width: 100%;
      margin-top: 14px;
      font-size: 9.5pt;
      line-height: 1.25;
    }

    /* -------------------------------------------------------------
       HALAMAN 4+: LAMPIRAN BUKTI TRANSFER, DAFTAR HADIR, FOTO, NOTA
    ------------------------------------------------------------- */
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
      letter-spacing: 1px;
    }

    .lampiran-sub {
      font-size: 9.5pt;
      color: #334155;
      margin-top: 2px;
    }

    .transfer-doc-wrap {
      border: 1px dashed #64748b;
      padding: 12px;
      text-align: center;
      background: #fafafa;
      border-radius: 6px;
      margin-bottom: 14px;
    }

    .transfer-doc-wrap img {
      max-width: 100%;
      max-height: 180mm;
      object-fit: contain;
      border: 1px solid #cbd5e1;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .transfer-info-box {
      border: 1.5px solid #0f172a;
      padding: 10px 16px;
      font-size: 9pt;
      background: #f8fafc;
      border-radius: 4px;
      margin-top: 10px;
    }

    .transfer-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 16px;
    }

    /* Galeri Foto Kegiatan */
    .foto-grid-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-top: 10px;
    }

    .foto-card {
      border: 1px solid #cbd5e1;
      padding: 10px;
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
      text-align: center;
    }

    .foto-img-wrap {
      width: 100%;
      height: 100mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
      overflow: hidden;
    }

    .foto-img-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .foto-caption {
      margin-top: 8px;
      font-size: 9.5pt;
      color: #0f172a;
    }

    /* Galeri Bukti Nota Belanja */
    .nota-grid-container {
      display: flex;
      flex-direction: column;
      gap: 22px;
      margin-top: 10px;
    }

    .nota-card {
      border: 1.5px solid #94a3b8;
      padding: 10px;
      background: #ffffff;
    }

    .nota-meta-bar {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 8px;
      font-size: 9pt;
    }

    .nota-img-wrap {
      width: 100%;
      height: 100mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
    }

    .nota-img-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .nota-caption {
      font-size: 8.5pt;
      color: #475569;
      margin-top: 6px;
    }

    .page-footer-note {
      position: absolute;
      bottom: 10mm;
      left: 18mm;
      right: 18mm;
      text-align: center;
      font-size: 8pt;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
    }

    /* Helper Utilities */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-sm { font-size: 8.5pt; }

    /* -------------------------------------------------------------
       MEDIA PRINT OVERRIDES (Hilangkan UI Layar & Kertas Full A4)
    ------------------------------------------------------------- */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
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
        padding: 0 !important;
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
      }
      .cover-frame {
        min-height: 270mm !important;
      }
    }
  </style>
</head>
<body>

  <!-- Top Toolbar (Hidden on Print) Standar Model Cetak SMAN 1 Gianyar -->
  <div class="no-print-toolbar">
    <div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: #ef4444; color: #ffffff; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.8px;">MODE DEMO</span>
        <div style="font-weight: 800; font-size: 1rem; color: #0f172a;">Pratinjau Bundel Dokumen LPJ Resmi (Standar Cetak A4)</div>
      </div>
      <div style="font-size: 0.8rem; color: #dc2626; font-weight: 600; margin-top: 2px;">Dokumen simulasi uji coba internal SMA Negeri 1 Gianyar (Belum berlaku definitif)</div>
    </div>
    <div style="display: flex; gap: 10px;">
      <a href="/" class="btn-toolbar btn-secondary">
        ← Kembali ke Aplikasi
      </a>
      <button onclick="window.print()" class="btn-toolbar btn-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Cetak Bundel LPJ (PDF)
      </button>
    </div>
  </div>

  <div class="sheet-wrapper">

    <!-- ============================================================= -->
    <!-- HALAMAN 1: COVER RESMI KEGIATAN SISWA                         -->
    <!-- ============================================================= -->
    <div class="sheet page-break">
      <div class="cover-frame">
        <div class="cover-top-box">
          <div class="cover-heading-1">LAPORAN</div>
          <div class="cover-heading-2">PELAKSANAAN KEGIATAN</div>
          <div class="cover-heading-1" style="font-size: 16pt;">BULAN ${bulanLaporan}</div>
          <div style="height: 16px;"></div>
          <div class="cover-heading-kegiatan">
            ${escapeHtml(proposal.nama_kegiatan)}
          </div>
        </div>

        <div class="cover-logo-center">
          <img src="/img/logo_sekolah.png" alt="Logo SMAN 1 Gianyar" onerror="this.src='/img/logo-dosman-hd.png';">
        </div>

        <div class="cover-bottom-box">
          <div class="cover-school-name">SMA NEGERI 1 GIANYAR</div>
          <div class="cover-year">TAHUN ${tahunAnggaran}</div>
        </div>
      </div>
    </div>

    <!-- ============================================================= -->
    <!-- HALAMAN 2: KWITANSI RESMI PEMBAYARAN KAS KOMITE               -->
    <!-- ============================================================= -->
    <div class="sheet page-break">
      <div class="kwitansi-box-wrapper">
        <!-- KOP Surat Berbingkai Kotak (Standar Kwitansi) -->
        <table class="kwitansi-header-table">
          <tr>
            <td style="width: 75px; text-align: left;">
              <img src="/img/logo-provinsi.png" alt="Logo Pemprov Bali" class="kwitansi-logo" onerror="this.src='/img/logo-pemprov-bali.png';">
            </td>
            <td>
              <div class="kwitansi-instansi-text">
                <h4>PEMERINTAH PROVINSI BALI</h4>
                <h3>DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</h3>
                <h2>SMA NEGERI 1 GIANYAR</h2>
                <p>Jl. Ratna No. 1, Telp. (0361) 943034, Fax. (0361) 944073</p>
                <p>Website: https://sman1-gianyar.sch.id &nbsp;•&nbsp; E-mail: sman1.gianyar1963@gmail.com</p>
              </div>
            </td>
            <td style="width: 75px; text-align: right;">
              <img src="/img/logo-dosman.png" alt="Logo SMAN 1 Gianyar" class="kwitansi-logo" onerror="this.src='/img/logo_sekolah.png';">
            </td>
          </tr>
        </table>

        <!-- Judul Banner KWITANSI -->
        <div class="kwitansi-banner-title">KWITANSI</div>

        <!-- Tabel Isian Kwitansi -->
        <table class="kwitansi-data-table">
          <tr>
            <td class="col-lbl">No. Kode</td>
            <td class="col-col">:</td>
            <td class="col-val font-bold" style="font-size: 13pt;">${escapeHtml(proposal.nomor_kode_kwitansi || '7')}</td>
          </tr>
          <tr>
            <td class="col-lbl">Kode. Rekening</td>
            <td class="col-col">:</td>
            <td class="col-val"></td>
          </tr>
          <tr>
            <td class="col-lbl">Sudah terima dari</td>
            <td class="col-col">:</td>
            <td class="col-val">Pembantu Bendahara Dana Pungutan Masyarakat SMA Negeri 1 Gianyar</td>
          </tr>
          <tr>
            <td class="col-lbl">Terbilang</td>
            <td class="col-col">:</td>
            <td class="col-val" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 5px 8px; font-style: italic; font-weight: 700;">
              ${terbilangDanaCair}
            </td>
          </tr>
          <tr>
            <td class="col-lbl">Untuk Pembayaran</td>
            <td class="col-col">:</td>
            <td class="col-val">
              Dibayar Belanja Pelaksanaan Kegiatan <strong>${escapeHtml(proposal.nama_kegiatan)}</strong> Pada Dana Komite SMA N 1 Gianyar
            </td>
          </tr>
          <tr>
            <td class="col-lbl" style="padding-top: 10px;">Uang Sebanyak</td>
            <td class="col-col" style="padding-top: 10px;">:</td>
            <td class="col-val" style="padding-top: 6px;">
              <div class="kwitansi-nominal-box">
                ${formatRupiahKwitansi(danaCair)}
              </div>
            </td>
          </tr>
        </table>

        <!-- Matriks 6 Tanda Tangan Kwitansi Resmi -->
        <div class="kwitansi-sig-matrix">
          <!-- Baris 1: Gianyar + Yang Menerima (Sejajar Lurus Kolom Kanan) -->
          <div class="sig-row-2col" style="margin-bottom: 18px;">
            <div class="sig-col"></div>
            <div class="sig-col-right">
              Gianyar, ${tglCetak}<br>
              Yang Menerima,
              <div class="sig-space-kwitansi"></div>
              <div class="sig-name">${escapeHtml(guruNama)}</div>
              <div class="sig-nip">${guruNip}</div>
            </div>
          </div>

          <!-- Baris 2: Kepala Sekolah & Analis SDM -->
          <div class="sig-row-2col">
            <div class="sig-col">
              Mengetahui / Menyetujui,<br>
              Kepala Sekolah SMA Negeri 1 Gianyar
              <div class="sig-space-kwitansi"></div>
              <div class="sig-name">${kepsekNama}</div>
              <div class="sig-nip">NIP. ${kepsekNip}</div>
            </div>
            <div class="sig-col-right">
              Analis SDM Aparatur Ahli Muda<br>
              SMA Negeri 1 Gianyar
              <div class="sig-space-kwitansi"></div>
              <div class="sig-name">${analisSdmNama}</div>
              <div class="sig-nip">NIP. ${analisSdmNip}</div>
            </div>
          </div>

          <!-- Baris 3: Bendahara & Bendahara Pembantu -->
          <div class="sig-row-2col">
            <div class="sig-col">
              Bendahara Dana Pungutan Masyarakat<br>
              SMA Negeri 1 Gianyar
              <div class="sig-space-kwitansi"></div>
              <div class="sig-name">${bendaharaNama}</div>
              <div class="sig-nip">&nbsp;</div>
            </div>
            <div class="sig-col-right">
              Lunas dibayar oleh :<br>
              Bendahara Pemb. Dana Pungutan Masyarakat
              <div class="sig-space-kwitansi"></div>
              <div class="sig-name">${bendaharaPembantuNama}</div>
              <div class="sig-nip">NIP. ${bendaharaPembantuNip}</div>
            </div>
          </div>

          <!-- Baris 4: Ketua Komite & Wakasek Kesiswaan -->
          <div class="sig-row-2col" style="margin-bottom: 0;">
            <div class="sig-col">
              Ketua Komite<br>
              SMA Negeri 1 Gianyar
              <div class="sig-space-kwitansi"></div>
              <div class="sig-name">${ketuaKomiteNama}</div>
            </div>
            <div class="sig-col-right">
              Wakasek Kesiswaan<br>
              SMA Negeri 1 Gianyar
              <div class="sig-space-kwitansi"></div>
              <div class="sig-name">${wakasekNama}</div>
              <div class="sig-nip">${wakasekNip}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================= -->
    <!-- HALAMAN 3: LEMBAR LPJ & TABEL RINCIAN BELANJA SESUAI RAB      -->
    <!-- ============================================================= -->
    <div class="sheet page-break">
      <!-- KOP Resmi SMAN 1 Gianyar Beraksara Bali -->
      ${renderKopSurat({ mode: 'portrait' })}

      <!-- Boxed Title LPJ Sesuai Gambar Fisik -->
      <div class="lpj-boxed-title">
        Laporan Pertanggungjawaban Dana ${escapeHtml(proposal.nama_kegiatan)}
      </div>

      <div class="lpj-narasi-intro">
        Setelah kegiatan ini berlangsung dapat kami laporkan pertanggungjawabannya, sebagai berikut :
      </div>

      <!-- Metadata Pelaksana Kegiatan -->
      <table class="lpj-meta-grid">
        <tr>
          <td class="m-lbl">Nama Kegiatan</td>
          <td class="m-col">:</td>
          <td class="m-val">${escapeHtml(proposal.nama_kegiatan)}</td>
        </tr>
        <tr>
          <td class="m-lbl">Pelaksana Kegiatan</td>
          <td class="m-col">:</td>
          <td class="m-val">${escapeHtml(proposal.pemohon_unit || proposal.pemohon_nama)}</td>
        </tr>
        <tr>
          <td class="m-lbl">Tanggal Pelaksanaan</td>
          <td class="m-col">:</td>
          <td class="m-val">${tglMulai} s/d ${tglSelesai}</td>
        </tr>
        <tr>
          <td class="m-lbl">Guru Pembina</td>
          <td class="m-col">:</td>
          <td class="m-val">${escapeHtml(guruNama)}</td>
        </tr>
      </table>

      <!-- Tabel Rincian Belanja Mengadaptasi RAB Fisik -->
      <table class="rab-table">
        <thead>
          <tr>
            <th style="width: 32px;">NO</th>
            <th>KEGIATAN / URAIAN BELANJA</th>
            <th style="width: 58px;">JUMLAH</th>
            <th style="width: 65px;">SATUAN</th>
            <th style="width: 95px;">ANGGARAN (Rp)</th>
            <th style="width: 110px;">TOTAL JUMLAH (Rp)</th>
            <th style="width: 70px;">KET</th>
          </tr>
        </thead>
        <tbody>
          ${rowsRabHtml}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5" class="text-right" style="font-weight: 800; letter-spacing: 0.5px;">JUMLAH :</td>
            <td class="text-right font-bold" style="font-size: 10.5pt;">${formatRupiah(belanjaRiil)}</td>
            <td class="text-center font-sm">Lunas</td>
          </tr>
          <tr class="terbilang-row">
            <td colspan="2" class="text-center font-bold">TERBILANG :</td>
            <td colspan="5">${terbilangRupiah}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Matriks 4 Tanda Tangan LPJ Sesuai Dokumen Fisik -->
      <div class="lpj-sig-matrix">
        <div class="sig-row-2col" style="margin-bottom: 28px;">
          <div class="sig-col">
            Waka. Kesiswaan,
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${wakasekNama}</div>
            <div class="sig-nip">${wakasekNip}</div>
          </div>
          <div class="sig-col-right">
            Gianyar, ${tglCetak}<br>
            Dibuat oleh : Pembina
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(guruNama)}</div>
            <div class="sig-nip">${guruNip}</div>
          </div>
        </div>

        <div class="sig-row-2col" style="margin-bottom: 0;">
          <div class="sig-col">
            Kepala SMA Negeri 1 Gianyar,
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${kepsekNama}</div>
            <div class="sig-nip">NIP. ${kepsekNip}</div>
          </div>
          <div class="sig-col-right">
            Mengetahui,<br>
            Analis SDM Aparatur Ahli Muda
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${analisSdmNama}</div>
            <div class="sig-nip">NIP. ${analisSdmNip}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================= -->
    <!-- HALAMAN 3B: RESUME HASIL PELAKSANAAN & EVALUASI KEGIATAN      -->
    <!-- ============================================================= -->
    <div class="sheet page-break">
      <!-- KOP Resmi SMAN 1 Gianyar Beraksara Bali -->
      ${renderKopSurat({ mode: 'portrait' })}

      <!-- Boxed Title Resume -->
      <div class="lpj-boxed-title" style="margin-top: 6px; margin-bottom: 6px; font-size: 12pt;">
        RESUME HASIL PELAKSANAAN &amp; EVALUASI KEGIATAN
      </div>
      <div style="text-align: center; font-size: 8.5pt; color: #475569; margin-bottom: 12px; font-style: italic;">
        Laporan Ketercapaian Indikator Sasaran, Realisasi Anggaran, dan Evaluasi Pelaksanaan
      </div>

      <!-- 1. Metadata Kegiatan & Sasaran -->
      <table class="lpj-meta-grid" style="margin-bottom: 12px; background: #fafafa; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px;">
        <tr>
          <td class="m-lbl" style="width: 140px;">Nama Kegiatan</td>
          <td class="m-col">:</td>
          <td class="m-val font-bold">${escapeHtml(proposal.nama_kegiatan)}</td>
        </tr>
        <tr>
          <td class="m-lbl">Tujuan Kegiatan</td>
          <td class="m-col">:</td>
          <td class="m-val">${escapeHtml(lpj.tujuan_kegiatan || proposal.latar_belakang || '-')}</td>
        </tr>
        <tr>
          <td class="m-lbl">Tempat Pelaksanaan</td>
          <td class="m-col">:</td>
          <td class="m-val">${escapeHtml(lpj.tempat_pelaksanaan || 'SMA Negeri 1 Gianyar')}</td>
        </tr>
        <tr>
          <td class="m-lbl">Waktu / Jadwal</td>
          <td class="m-col">:</td>
          <td class="m-val">${tglMulai} s/d ${tglSelesai}</td>
        </tr>
        <tr>
          <td class="m-lbl">Sasaran / Peserta</td>
          <td class="m-col">:</td>
          <td class="m-val">${escapeHtml(lpj.jumlah_peserta || 'Siswa & Pembina Delegasi')}</td>
        </tr>
        <tr>
          <td class="m-lbl">Guru Pembina / Pelaksana</td>
          <td class="m-col">:</td>
          <td class="m-val">${escapeHtml(guruNama)} (${guruNip})</td>
        </tr>
      </table>

      <!-- 2. Kotak Ringkasan Realisasi Keuangan (Card Resume Finansial) -->
      <div style="margin-bottom: 12px;">
        <div style="font-weight: 800; font-size: 9pt; text-transform: uppercase; margin-bottom: 6px; color: #1e293b; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
          I. REKAPITULASI REALISASI ANGGARAN &amp; KEUANGAN
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 6px;">
          <div style="border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; background: #f8fafc; text-align: center;">
            <div style="font-size: 7.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Dana Kas Diterima</div>
            <div style="font-size: 10.5pt; font-weight: 800; color: #0284c7; margin-top: 2px;">${formatRupiah(danaCair)}</div>
          </div>
          <div style="border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; background: #f8fafc; text-align: center;">
            <div style="font-size: 7.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Belanja Riil (Nota)</div>
            <div style="font-size: 10.5pt; font-weight: 800; color: #047857; margin-top: 2px;">${formatRupiah(belanjaRiil)}</div>
          </div>
          <div style="border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; background: ${sisaPengembalian > 0 ? '#fef3c7' : '#f0fdf4'}; text-align: center;">
            <div style="font-size: 7.5pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Sisa Kas Disetor Kembali</div>
            <div style="font-size: 10.5pt; font-weight: 800; color: ${sisaPengembalian > 0 ? '#b45309' : '#15803d'}; margin-top: 2px;">${formatRupiah(sisaPengembalian)}</div>
          </div>
        </div>
        <div style="font-size: 8pt; color: #475569; font-style: italic; background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">
          Terbilang: <strong>${terbilangRupiah}</strong>. ${sisaPengembalian > 0 ? `Sisa kas sebesar ${formatRupiah(sisaPengembalian)} telah disetorkan kembali ke Bendahara Pengeluaran Sekolah.` : 'Seluruh kas yang diterima telah terealisasi 100% dan didukung dengan bukti nota belanja sah.'}
        </div>
      </div>

      <!-- 3. Narasi Resume Capaian & Evaluasi -->
      <div style="margin-bottom: 12px;">
        <div style="font-weight: 800; font-size: 9pt; text-transform: uppercase; margin-bottom: 6px; color: #1e293b; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
          II. RESUME KETERCAPAIAN HASIL &amp; EVALUASI PELAKSANAAN
        </div>
        
        <div style="margin-bottom: 7px;">
          <div style="font-weight: 700; font-size: 8.5pt; color: #0f172a; margin-bottom: 2px;">A. Ringkasan Capaian &amp; Hasil Kegiatan:</div>
          <div style="font-size: 8.3pt; line-height: 1.4; text-align: justify; padding: 6px 8px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 4px;">
            ${escapeHtml(lpj.resume_hasil || lpj.catatan_lpj || 'Seluruh rangkaian kegiatan telah terlaksana dengan sangat baik, tertib, dan sukses sesuai rencana anggaran biaya. Peserta dan kontingen berhasil mengikuti seluruh tahapan kegiatan dengan dedikasi tinggi serta memberikan kontribusi positif bagi citra dan prestasi sekolah.')}
          </div>
        </div>

        <div style="margin-bottom: 7px;">
          <div style="font-weight: 700; font-size: 8.5pt; color: #0f172a; margin-bottom: 2px;">B. Kendala / Hambatan yang Dihadapi:</div>
          <div style="font-size: 8.3pt; line-height: 1.4; text-align: justify; padding: 6px 8px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 4px;">
            ${escapeHtml(lpj.kendala || 'Secara umum tidak terdapat kendala teknis yang signifikan selama pelaksanaan kegiatan. Seluruh kebutuhan akomodasi, transportasi, logistik, dan perlengkapan dapat terakomodasi secara optimal.')}
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <div style="font-weight: 700; font-size: 8.5pt; color: #0f172a; margin-bottom: 2px;">C. Solusi, Rekomendasi &amp; Tindak Lanjut:</div>
          <div style="font-size: 8.3pt; line-height: 1.4; text-align: justify; padding: 6px 8px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 4px;">
            ${escapeHtml(lpj.solusi_tindak_lanjut || 'Dianjurkan untuk terus mempertahankan pembinaan berkala serta memperkuat koordinasi awal dengan pihak panitia pelaksana agar kesiapan delegasi sekolah dapat lebih maksimal pada kegiatan serupa di masa mendatang.')}
          </div>
        </div>
      </div>

      <!-- 4. Lembar Pengesahan Resume (Matriks 4 Tanda Tangan) -->
      <div class="lpj-sig-matrix" style="margin-top: 10px;">
        <div class="sig-row-2col" style="margin-bottom: 20px;">
          <div class="sig-col">
            Waka. Kesiswaan,
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${wakasekNama}</div>
            <div class="sig-nip">${wakasekNip}</div>
          </div>
          <div class="sig-col-right">
            Gianyar, ${tglCetak}<br>
            Pelaksana Kegiatan / Pembina,
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(guruNama)}</div>
            <div class="sig-nip">${guruNip}</div>
          </div>
        </div>

        <div class="sig-row-2col" style="margin-bottom: 0;">
          <div class="sig-col">
            Kepala SMA Negeri 1 Gianyar,
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${kepsekNama}</div>
            <div class="sig-nip">NIP. ${kepsekNip}</div>
          </div>
          <div class="sig-col-right">
            Mengetahui,<br>
            Analis SDM Aparatur Ahli Muda
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${analisSdmNama}</div>
            <div class="sig-nip">NIP. ${analisSdmNip}</div>
          </div>
        </div>
      </div>

      <div class="page-footer-note">Laporan Resume &amp; Evaluasi Pelaksanaan — SMA Negeri 1 Gianyar</div>
    </div>

    <!-- ============================================================= -->
    <!-- HALAMAN 4: LAMPIRAN BUKTI TRANSFER KAS OLEH BENDAHARA         -->
    <!-- ============================================================= -->
    <div class="sheet page-break">
      <div class="lampiran-header">
        <div class="lampiran-title">LAMPIRAN BUKTI TRANSFER &amp; SETORAN KAS</div>
        <div class="lampiran-sub">Diserahkan resmi oleh Bendahara Pengeluaran Sekolah kepada Pemohon / Guru Pembina</div>
      </div>

      <div class="transfer-doc-wrap">
        ${proposal.file_bukti_transfer_url ? `
          ${proposal.file_bukti_transfer_url.toLowerCase().endsWith('.pdf') ? `
            <div class="pdf-render-target" data-pdf-url="${proposal.file_bukti_transfer_url}" data-title="LAMPIRAN BUKTI TRANSFER &amp; SETORAN KAS" data-sub="Diserahkan resmi oleh Bendahara Pengeluaran Sekolah kepada Pemohon / Guru Pembina" data-footer="Dokumen Pencairan Kas — SMA Negeri 1 Gianyar">
              <div style="padding: 40px 20px; text-align: center; color: #475569;">
                <div style="font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
                <div style="font-weight: 700; color: #1e293b;">Memproses Halaman Slip Transfer PDF...</div>
              </div>
            </div>
          ` : `
            <img src="${proposal.file_bukti_transfer_url}" alt="Bukti Transfer Kas">
          `}
        ` : `
          <div style="padding: 60px 20px; color: #64748b;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; display: inline-block;">
              <rect x="2" y="5" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
            <div style="font-weight: 700; font-size: 1.1rem; color: #334155; margin-bottom: 6px;">Berkas Bukti Transfer Fisik</div>
            <p style="font-size: 0.88rem; max-width: 480px; margin: 0 auto;">
              Belum ada lampiran scan slip transfer bank yang diunggah oleh Bendahara. Bukti transfer dapat diunggah melalui menu Pencairan Kas Bendahara.
            </p>
          </div>
        `}
      </div>

      <div class="transfer-info-box">
        <div style="font-weight: 800; font-size: 10pt; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
          DATA REKONSILIASI PENCAIRAN KAS SEKOLAH
        </div>
        <div class="transfer-info-grid">
          <div><strong>Nomor Surat Usulan:</strong> ${escapeHtml(proposal.nomor_surat_ajuan)}</div>
          <div><strong>Tanggal Pencairan:</strong> ${tglCetak}</div>
          <div><strong>Metode Pencairan:</strong> ${escapeHtml(proposal.metode_pencairan || 'TUNAI')}</div>
          <div><strong>Penerima Dana:</strong> ${escapeHtml(proposal.penerima_dana || guruNama)}</div>
          <div><strong>Bank Tujuan / No Rekening:</strong> ${escapeHtml(proposal.bank_tujuan || '-')} / ${escapeHtml(proposal.nomor_rekening || '-')}</div>
          <div><strong>Total Kas Dicairkan:</strong> <span style="font-weight: 800; color: #047857;">${formatRupiah(danaCair)}</span></div>
        </div>
      </div>

      <div class="page-footer-note">Sistem Informasi Anggaran SI-ARTHA — SMA Negeri 1 Gianyar</div>
    </div>

    <!-- ============================================================= -->
    <!-- HALAMAN 5: LAMPIRAN BERKAS DAFTAR HADIR (PDF/SCAN)            -->
    <!-- ============================================================= -->
    ${lpj.file_daftar_hadir_url ? `
      ${lpj.file_daftar_hadir_url.toLowerCase().endsWith('.pdf') ? `
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
      ` : `
        <div class="sheet page-break">
          <div class="lampiran-header">
            <div class="lampiran-title">LAMPIRAN DAFTAR HADIR KEGIATAN &amp; PEMBINAAN</div>
            <div class="lampiran-sub">Presensi Kehadiran Siswa, Guru Pembina, dan Panitia Pelaksana Kegiatan</div>
          </div>
          <div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <img src="${lpj.file_daftar_hadir_url}" alt="Daftar Hadir Fisik" style="max-height: 215mm; max-width: 100%; object-fit: contain;">
          </div>
          <div class="page-footer-note">Dokumen Presensi Fisik — SMA Negeri 1 Gianyar</div>
        </div>
      `}
    ` : `
      <div class="sheet page-break">
        <div class="lampiran-header">
          <div class="lampiran-title">LAMPIRAN DAFTAR HADIR KEGIATAN &amp; PEMBINAAN</div>
          <div class="lampiran-sub">Presensi Kehadiran Siswa, Guru Pembina, dan Panitia Pelaksana Kegiatan</div>
        </div>
        <div class="transfer-doc-wrap" style="min-height: 200mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; display: inline-block;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <div style="font-weight: 700; font-size: 1.1rem; color: #334155; margin-bottom: 6px;">Berkas Daftar Hadir Terlampir</div>
          <p style="font-size: 0.88rem; max-width: 480px; margin: 0 auto;">
            Belum ada berkas PDF daftar hadir yang diunggah. Guru pembina dapat melampirkan berkas scan tanda tangan daftar hadir saat mengisi formulir LPJ.
          </p>
        </div>
        <div class="page-footer-note">Dokumen Presensi Fisik — SMA Negeri 1 Gianyar</div>
      </div>
    `}

    <!-- ============================================================= -->
    <!-- HALAMAN 6+: LAMPIRAN FOTO DOKUMENTASI KEGIATAN                -->
    <!-- ============================================================= -->
    ${fotoPagesHtml || `
      <div class="sheet page-break">
        <div class="lampiran-header">
          <div class="lampiran-title">DOKUMENTASI FOTO PELAKSANAAN KEGIATAN</div>
          <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)}</div>
        </div>
        <div class="transfer-doc-wrap" style="padding: 80px 20px;">
          <div style="font-weight: 700; color: #475569; font-size: 1.1rem; margin-bottom: 6px;">Belum Ada Foto Dokumentasi</div>
          <p style="font-size: 0.88rem; color: #64748b;">Foto-foto dokumentasi kegiatan yang diunggah pada modul LPJ akan tampil secara otomatis di halaman ini.</p>
        </div>
        <div class="page-footer-note">Dokumentasi Pelaksanaan — SMA Negeri 1 Gianyar</div>
      </div>
    `}

    <!-- ============================================================= -->
    <!-- HALAMAN AKHIR: LAMPIRAN NOTA BELANJA FISIK                    -->
    <!-- ============================================================= -->
    ${allNotaPagesHtml || `
      <div class="sheet">
        <div class="lampiran-header">
          <div class="lampiran-title">LAMPIRAN BUKTI NOTA &amp; KUITANSI BELANJA</div>
          <div class="lampiran-sub">${escapeHtml(proposal.nama_kegiatan)}</div>
        </div>
        <div class="transfer-doc-wrap" style="padding: 80px 20px;">
          <div style="font-weight: 700; color: #475569; font-size: 1.1rem; margin-bottom: 6px;">Belum Ada Berkas Nota Toko</div>
          <p style="font-size: 0.88rem; color: #64748b;">Scan atau foto struk nota belanja toko yang diunggah pada formulir LPJ akan tersusun rapi di halaman ini.</p>
        </div>
        <div class="page-footer-note">Pertanggungjawaban Keuangan Resmi — SMA Negeri 1 Gianyar</div>
      </div>
    `}

  </div>

  <!-- Pustaka PDF.js untuk Mengonversi Lembar Berkas PDF Menjadi Gambar Cetak Tajam (High DPI) -->
  <script src="/js/pdf.min.js"></script>
  <script>
    (function() {
      if (!window.pdfjsLib) return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';

      async function processAllPdfTargets() {
        // 1. Target Multi-halaman (Daftar Hadir dll)
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
              // Skala 2.2 menghasilkan resolusi ~200 DPI sangat jernih saat dicetak ke kertas/PDF
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
                '<div class=\"lampiran-header\">' +
                  '<div class=\"lampiran-title\">' + title + pageTitleSuffix + '</div>' +
                  '<div class=\"lampiran-sub\">' + sub + '</div>' +
                '</div>' +
                '<div class=\"transfer-doc-wrap\" style=\"min-height: 200mm; display: flex; align-items: center; justify-content: center; padding: 4mm;\">' +
                  '<img src=\"' + imgData + '\" alt=\"' + title + ' Hal ' + pageNum + '\" style=\"max-width: 100%; max-height: 220mm; width: auto; height: auto; object-fit: contain; box-shadow: 0 1px 3px rgba(0,0,0,0.08);\">' +
                '</div>' +
                '<div class=\"page-footer-note\">' + footer + footerSuffix + '</div>';
              
              container.appendChild(sheet);
            }
          } catch (err) {
            console.error('Gagal memproses berkas PDF ke lembar cetak:', err);
            container.innerHTML = 
              '<div class=\"sheet page-break\">' +
                '<div class=\"lampiran-header\">' +
                  '<div class=\"lampiran-title\">' + title + '</div>' +
                  '<div class=\"lampiran-sub\">' + sub + '</div>' +
                '</div>' +
                '<div class=\"transfer-doc-wrap\" style=\"padding: 50px 20px; text-align: center;\">' +
                  '<div style=\"color: #b91c1c; font-weight: 700; margin-bottom: 8px;\">Gagal memproses pratinjau halaman PDF: ' + err.message + '</div>' +
                  '<a href=\"' + pdfUrl + '\" target=\"_blank\" class=\"btn-toolbar btn-primary\" style=\"display:inline-flex; text-decoration:none;\">Buka / Unduh Berkas PDF Asli</a>' +
                '</div>' +
                '<div class=\"page-footer-note\">' + footer + '</div>' +
              '</div>';
          }
        }

        // 2. Target Single-page (Slip Bukti Transfer jika PDF)
        var singleContainers = document.querySelectorAll('.pdf-render-target');
        for (var j = 0; j < singleContainers.length; j++) {
          var sContainer = singleContainers[j];
          var sPdfUrl = sContainer.getAttribute('data-pdf-url');
          if (!sPdfUrl) continue;
          try {
            var sLoadingTask = pdfjsLib.getDocument(sPdfUrl);
            var sPdf = await sLoadingTask.promise;
            var sPage = await sPdf.getPage(1);
            var sViewport = sPage.getViewport({ scale: 2.2 });

            var sCanvas = document.createElement('canvas');
            var sCtx = sCanvas.getContext('2d');
            sCanvas.width = sViewport.width;
            sCanvas.height = sViewport.height;

            await sPage.render({ canvasContext: sCtx, viewport: sViewport }).promise;
            var sImgData = sCanvas.toDataURL('image/jpeg', 0.95);

            sContainer.innerHTML = '<img src=\"' + sImgData + '\" alt=\"Berkas Lampiran PDF\" style=\"max-width: 100%; max-height: 100%; object-fit: contain;\">';
          } catch (e) {
            console.error('Gagal render berkas PDF:', e);
            sContainer.innerHTML = '<div style=\"padding: 20px; text-align: center;\"><a href=\"' + sPdfUrl + '\" target=\"_blank\">📄 Buka Berkas PDF</a></div>';
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
  renderCetakLpjBundel
};
