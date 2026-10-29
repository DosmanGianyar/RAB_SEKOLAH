// ==========================================================================
// Generator Lembar Disposisi & Pengesahan RAB Resmi (A4 Print-Ready)
// SMA NEGERI 1 GIANYAR (DOSMAN)
// ==========================================================================

const { terbilang } = require('../utils/terbilang');

function formatRupiah(val) {
  const num = Number(val) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

function renderCetakDisposisi({ proposal, qrDataUrl, hostUrl }) {
  const totalAngka = proposal.total_dana_disetujui || proposal.total_dana_diajukan || 0;
  const totalKalimat = terbilang(totalAngka);

  const rowsHtml = proposal.items.map((item, idx) => {
    const vol = item.volume_disetujui !== null ? item.volume_disetujui : item.volume_ajuan;
    const harga = item.harga_satuan_disetujui !== null ? item.harga_satuan_disetujui : item.harga_satuan_ajuan;
    const subtotal = item.subtotal_disetujui !== null ? item.subtotal_disetujui : item.subtotal_ajuan;
    const catatan = item.catatan_koreksi ? `<div class="item-note">Catatan: ${item.catatan_koreksi}</div>` : '';

    return `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><span class="badge-cat">${item.kategori_belanja}</span></td>
        <td>
          <div class="font-bold">${item.deskripsi_item}</div>
          ${catatan}
        </td>
        <td class="text-center">${vol} ${item.satuan}</td>
        <td class="text-right">${formatRupiah(harga)}</td>
        <td class="text-right font-bold">${formatRupiah(subtotal)}</td>
      </tr>
    `;
  }).join('');

  let infoPencairanHtml = '';
  if (proposal.status === 'DICAIRKAN' || proposal.status === 'SELESAI') {
    infoPencairanHtml = `
      <div class="disbursement-banner">
        <div class="banner-title">STATUS REALISASI KAS: TELAH DICAIRKAN RESMI</div>
        <div class="banner-grid">
          <div><strong>Metode Pencairan:</strong> ${proposal.metode_pencairan === 'TRANSFER_BANK' ? 'Transfer Bank' : 'Kas Tunai Langsung'}</div>
          <div><strong>Tanggal Pencairan:</strong> ${proposal.tanggal_pencairan || '-'}</div>
          <div><strong>Penerima Kas:</strong> ${proposal.penerima_dana || proposal.pemohon_nama}</div>
          <div><strong>No. Referensi / Bank:</strong> ${proposal.bank_tujuan ? proposal.bank_tujuan + ' (' + (proposal.nomor_rekening || '-') + ')' : (proposal.nomor_referensi_transfer || '-')}</div>
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
  <title>Lembar Disposisi & Pengesahan RAB - ${proposal.nomor_surat_ajuan}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Tinos:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    /* Reset & Base Print Setup */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      font-size: 11pt;
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

    /* A4 Paper Canvas */
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 16mm 20mm 20mm;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
      position: relative;
    }

    /* KOP RESMI SEKOLAH */
    .kop-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 3px double #0f172a;
      margin-bottom: 16px;
    }

    .kop-logo {
      width: 72px;
      height: 72px;
      object-fit: contain;
    }

    .kop-text h3 {
      font-family: 'Tinos', 'Times New Roman', serif;
      font-size: 13pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1e293b;
      margin-bottom: 1px;
    }

    .kop-text h2 {
      font-family: 'Tinos', 'Times New Roman', serif;
      font-size: 15pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .kop-text p {
      font-size: 8.5pt;
      color: #475569;
    }

    /* Document Title */
    .doc-title-box {
      text-align: center;
      margin-bottom: 18px;
    }

    .doc-title {
      font-size: 12.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-decoration: underline;
      color: #0f172a;
    }

    .doc-number {
      font-size: 9.5pt;
      color: #334155;
      font-weight: 600;
      margin-top: 3px;
    }

    /* Metadata Table */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9.5pt;
    }

    .meta-table td {
      padding: 4px 6px;
      vertical-align: top;
    }

    .meta-label {
      width: 170px;
      color: #475569;
      font-weight: 600;
    }

    .meta-colon {
      width: 15px;
      text-align: center;
    }

    .meta-val {
      font-weight: 700;
      color: #0f172a;
    }

    /* Items Table */
    .table-items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9pt;
    }

    .table-items th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      text-transform: uppercase;
      padding: 7px 8px;
      border: 1px solid #94a3b8;
      font-size: 8pt;
    }

    .table-items td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }

    .badge-cat {
      display: inline-block;
      font-size: 7pt;
      font-weight: 700;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 2px 5px;
      border-radius: 4px;
    }

    .item-note {
      font-size: 7.5pt;
      color: #b45309;
      margin-top: 2px;
      font-style: italic;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }

    /* Total Grand Box */
    .total-box {
      border: 1.5px solid #2563eb;
      background: #eff6ff;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .total-left {
      font-size: 9pt;
      color: #1e40af;
    }

    .total-left .terbilang-text {
      font-family: 'Tinos', serif;
      font-style: italic;
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }

    .total-right {
      text-align: right;
    }

    .total-num {
      font-size: 14pt;
      font-weight: 800;
      color: #1e3a8a;
    }

    /* Disbursement Info Banner */
    .disbursement-banner {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 8.5pt;
    }

    .banner-title {
      font-weight: 800;
      color: #065f46;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .banner-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 14px;
      color: #047857;
    }

    /* Verification QR & Signatures Section */
    .bottom-section {
      margin-top: 20px;
      display: flex;
      align-items: flex-start;
      gap: 20px;
    }

    .qr-verify-box {
      width: 175px;
      text-align: center;
      padding: 10px;
      background: #f8fafc;
      border: 1px dashed #94a3b8;
      border-radius: 8px;
    }

    .qr-verify-box img {
      width: 110px;
      height: 110px;
      display: block;
      margin: 0 auto 6px;
    }

    .qr-title {
      font-size: 7.5pt;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
    }

    .qr-desc {
      font-size: 6.8pt;
      color: #64748b;
      line-height: 1.25;
      margin-top: 3px;
    }

    .qr-code-val {
      font-family: monospace;
      font-size: 7pt;
      font-weight: 700;
      color: #2563eb;
      margin-top: 4px;
    }

    .signatures-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 24px;
      font-size: 9pt;
      text-align: center;
    }

    .sig-box {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 110px;
    }

    .sig-role {
      font-weight: 700;
      color: #1e293b;
    }

    .sig-name {
      font-weight: 800;
      text-decoration: underline;
      color: #0f172a;
    }

    .sig-nip {
      font-size: 8pt;
      color: #475569;
    }

    .sig-full-width {
      grid-column: span 2;
      margin-top: 8px;
    }

    /* Print Media Rules */
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .sheet {
        width: 100%;
        min-height: auto;
        box-shadow: none;
        padding: 0;
        margin: 0;
      }
      @page {
        size: A4 portrait;
        margin: 12mm 15mm;
      }
    }
  </style>
</head>
<body>

  <!-- Top Toolbar (Hidden on Print) -->
  <div class="no-print-toolbar">
    <div>
      <div style="font-weight: 800; font-size: 1rem; color: #0f172a;">Pratinjau Lembar Disposisi & Pengesahan RAB</div>
      <div style="font-size: 0.8rem; color: #64748b;">Dokumen resmi SMA Negeri 1 Gianyar ber-QR Code Keabsahan Digital</div>
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
        Cetak Lembar Disposisi (PDF)
      </button>
    </div>
  </div>

  <!-- A4 Print Sheet Canvas -->
  <div class="sheet">
    <!-- KOP RESMI SEKOLAH -->
    <div class="kop-wrapper">
      <div class="kop-text">
        <h3>Pemerintah Provinsi Bali</h3>
        <h3>Dinas Pendidikan Kepemudaan dan Olahraga</h3>
        <h2>SMA NEGERI 1 GIANYAR</h2>
        <p>Jalan Ratna No. 1 Gianyar, Bali • Kode Pos: 80511 • Telp: (0361) 943034</p>
        <p>Laman: <em>sman1gianyar.sch.id</em> • Pos-el: <em>info@sman1gianyar.sch.id</em></p>
      </div>
    </div>

    <!-- Judul Dokumen -->
    <div class="doc-title-box">
      <div class="doc-title">LEMBAR DISPOSISI & PENGESAHAN ANGGARAN (RAB)</div>
      <div class="doc-number">Nomor Surat: <strong>${proposal.nomor_surat_ajuan}</strong></div>
    </div>

    <!-- Metadata Ringkasan Kegiatan -->
    <table class="meta-table">
      <tr>
        <td class="meta-label">Nama Kegiatan</td>
        <td class="meta-colon">:</td>
        <td class="meta-val">${proposal.nama_kegiatan}</td>
      </tr>
      <tr>
        <td class="meta-label">Unit / Bidang Pengusul</td>
        <td class="meta-colon">:</td>
        <td class="meta-val">${proposal.pemohon_unit} (${proposal.pemohon_nama})</td>
      </tr>
      <tr>
        <td class="meta-label">Pos Anggaran Beban</td>
        <td class="meta-colon">:</td>
        <td class="meta-val">${proposal.nama_pos} (Tahun Ajaran ${proposal.tahun_ajaran})</td>
      </tr>
      <tr>
        <td class="meta-label">Waktu Pelaksanaan</td>
        <td class="meta-colon">:</td>
        <td class="meta-val">${proposal.tanggal_mulai || '-'} s/d ${proposal.tanggal_selesai || '-'}</td>
      </tr>
      <tr>
        <td class="meta-label">Status Otorisasi Dokumen</td>
        <td class="meta-colon">:</td>
        <td class="meta-val" style="color: #059669;">
          <strong>SAH & DISETUJUI RESMI</strong> (Tingkat Otorisasi Kepala Sekolah & Bendahara)
        </td>
      </tr>
    </table>

    <!-- Tabel Rincian Belanja yang Disetujui -->
    <table class="table-items">
      <thead>
        <tr>
          <th style="width: 30px;">No</th>
          <th style="width: 100px;">Kategori</th>
          <th>Uraian Kebutuhan Belanja</th>
          <th style="width: 75px;" class="text-center">Vol</th>
          <th style="width: 110px;" class="text-right">Harga Satuan</th>
          <th style="width: 120px;" class="text-right">Subtotal Disetujui</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Total Nominal & Terbilang -->
    <div class="total-box">
      <div class="total-left">
        <div><strong>TOTAL ANGGARAN DISETUJUI:</strong></div>
        <div class="terbilang-text"># ${totalKalimat} #</div>
      </div>
      <div class="total-right">
        <div class="total-num">${formatRupiah(totalAngka)}</div>
      </div>
    </div>

    <!-- Informasi Realisasi Pencairan (Jika Sudah Dicairkan) -->
    ${infoPencairanHtml}

    <!-- Bagian Bawah: QR Code Keabsahan & 3 Kolom Tanda Tangan Resmi -->
    <div class="bottom-section">
      <!-- QR Code Digital Verification -->
      <div class="qr-verify-box">
        <div class="qr-title">Keabsahan Digital</div>
        <img src="${qrDataUrl}" alt="QR Verifikasi Sah">
        <div class="qr-desc">
          Pindai dengan kamera ponsel untuk memverifikasi keaslian dokumen pada sistem E-RAB.
        </div>
        <div class="qr-code-val">${proposal.kode_verifikasi_qr}</div>
      </div>

      <!-- Tanda Tangan 3 Pihak -->
      <div class="signatures-grid">
        <!-- Pemohon -->
        <div class="sig-box">
          <div class="sig-role">Pemohon Usulan Kegiatan,</div>
          <div style="margin-top: 48px;">
            <div class="sig-name">${proposal.pemohon_nama}</div>
            <div class="sig-nip">${proposal.pemohon_nip ? 'NIP. ' + proposal.pemohon_nip : 'Pembina Unit Kerja'}</div>
          </div>
        </div>

        <!-- Bendahara -->
        <div class="sig-box">
          <div class="sig-role">Penelaah Anggaran (Bendahara),</div>
          <div style="margin-top: 48px;">
            <div class="sig-name">Ibu Ni Made Ratna Dewi, S.E</div>
            <div class="sig-nip">NIP. 198203152008012015</div>
          </div>
        </div>

        <!-- Kepala Sekolah -->
        <div class="sig-box sig-full-width">
          <div class="sig-role">
            Gianyar, ${proposal.tanggal_pencairan || tanggalCetak}<br>
            Mengesahkan & Menyetujui,<br>
            <strong>Kepala SMA Negeri 1 Gianyar</strong>
          </div>
          <div style="margin-top: 50px;">
            <div class="sig-name">Drs. I Wayan Sudarsana, M.Pd</div>
            <div class="sig-nip">Pembina Utama Muda / NIP. 196811201994121001</div>
          </div>
        </div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

module.exports = { renderCetakDisposisi };

