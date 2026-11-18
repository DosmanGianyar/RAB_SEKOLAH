const { getPenandatanganMap, formatNipCetak, getPengaturanSekolahMap } = require('../db');
const { terbilang } = require('../utils/terbilang');
const { renderKopSurat, getKopSuratCss } = require('./kop-surat');

function formatRupiahPlain(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('id-ID');
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
  if (!dateStr) return 'SEPTEMBER';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'SEPTEMBER';
    return d.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  } catch (e) {
    return 'SEPTEMBER';
  }
}

function formatHariTanggalIndo(dateStr) {
  if (!dateStr) return 'Jumat, Sepuluh September, Tahun Dua Ribu Dua Puluh Enam';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const hari = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const tgl = terbilang(d.getDate());
    const bln = d.toLocaleDateString('id-ID', { month: 'long' });
    const thn = terbilang(d.getFullYear());
    return `${hari}, ${tgl} ${bln}, Tahun ${thn}`;
  } catch (e) {
    return dateStr;
  }
}

function renderCetakPengadaanBarang({ proposal }) {
  const lpj = proposal.lpj || {};
  const notaItems = Array.isArray(lpj.nota_items) ? lpj.nota_items : [];
  const fotoItems = Array.isArray(lpj.foto_dokumentasi) ? lpj.foto_dokumentasi : [];

  let meta = {};
  if (lpj.barang_meta) {
    try {
      meta = typeof lpj.barang_meta === 'string' ? JSON.parse(lpj.barang_meta) : lpj.barang_meta;
    } catch (e) {
      meta = {};
    }
  }

  const itemsBarang = Array.isArray(meta.items_barang) && meta.items_barang.length > 0
    ? meta.items_barang
    : (Array.isArray(proposal.items) ? proposal.items.map(it => ({
        nama_barang: it.deskripsi_item || it.nama_item || '-',
        spesifikasi: it.deskripsi_item || '-',
        volume: `${it.volume_disetujui ?? it.volume_ajuan ?? 1} ${it.satuan || 'Unit'}`,
        harga_satuan: Number(it.harga_satuan_disetujui ?? it.harga_satuan_ajuan ?? 0),
        jumlah: Number(it.subtotal_disetujui ?? it.subtotal_ajuan ?? 0)
      })) : []);

  const subtotalBarang = itemsBarang.reduce((acc, it) => acc + (Number(it.jumlah) || 0), 0);
  const ppnPersen = Number(meta.ppn_persen || 0);
  const nominalPpn = ppnPersen > 0 ? Math.round(subtotalBarang * (ppnPersen / 100)) : 0;
  const totalBarang = subtotalBarang + nominalPpn;
  const nominalFinal = totalBarang > 0 ? totalBarang : Number(lpj.total_belanja_riil || proposal.total_dana_disetujui || 0);
  const terbilangTotal = terbilang(nominalFinal);

  const rawTgl = lpj.tanggal_laporan || proposal.tanggal_pencairan || new Date().toISOString().split('T')[0];
  const tglCetak = formatDateIndo(rawTgl);
  const bulanLaporan = getMonthNameIndo(rawTgl);
  const tahunAnggaran = proposal.tahun_ajaran ? proposal.tahun_ajaran.split('/')[0] : '2026';
  const hariTanggalTeks = formatHariTanggalIndo(rawTgl);

  const SCH = typeof getPengaturanSekolahMap === 'function' ? getPengaturanSekolahMap() : {};
  const pembayarKwitansi = SCH.pembayar_kuitansi || 'Pembantu Bendahara Dana Pungutan Masyarakat SMA Negeri 1 Gianyar';
  const kotaSurat = SCH.kota_surat || 'Gianyar';

  const SG = getPenandatanganMap();
  const sg = (k) => SG[k] || { jabatan: '', nama: '-', nip: '' };
  const kepsekNama = sg('KEPSEK').nama;
  const kepsekNip = formatNipCetak(sg('KEPSEK').nip);
  const analisSdmNama = sg('ANALIS_SDM').nama;
  const analisSdmNip = formatNipCetak(sg('ANALIS_SDM').nip);
  const bendaharaNama = sg('BENDAHARA_PUNGUTAN').nama;
  const bendaharaNip = formatNipCetak(sg('BENDAHARA_PUNGUTAN').nip);
  const bendaharaPembantuNama = sg('BENDAHARA_PEMBANTU').nama;
  const bendaharaPembantuNip = formatNipCetak(sg('BENDAHARA_PEMBANTU').nip);
  const ketuaKomiteNama = sg('KETUA_KOMITE').nama;
  const wakaSarana = sg('WAKA_SARPRAS');
  const wakaSaranaNama = wakaSarana.nama;
  const wakaSaranaNip = formatNipCetak(wakaSarana.nip);

  const nomorSurat = meta.nomor_surat || '/SMA N 1 GIANYAR/DIKPORA';
  const untukPembayaran = meta.untuk_pembayaran || `Dibayar Belanja Barang dan Jasa ${proposal.nama_kegiatan}`;
  const namaToko = meta.nama_toko || 'Penyedia Barang';
  const namaPenyedia = meta.nama_penyedia || '-';
  const jabatanPenyedia = meta.jabatan_penyedia || 'Pemilik';
  const alamatPenyedia = meta.alamat_penyedia || '-';
  const pemesanNama = meta.pemesan_nama || proposal.pemohon_nama || '-';
  const pemesanNip = meta.pemesan_nip ? `NIP: ${meta.pemesan_nip}` : (proposal.pemohon_nip ? `NIP: ${proposal.pemohon_nip}` : '');

  const isDraftLpj = lpj.status_lpj === 'DRAFT';
  const draftWatermarkHtml = isDraftLpj ? `
    <div style="position: fixed; top: 38%; left: 8%; right: 8%; text-align: center; font-size: 48pt; font-weight: 900; color: rgba(220, 38, 38, 0.18); transform: rotate(-28deg); pointer-events: none; z-index: 99999; border: 5px dashed rgba(220, 38, 38, 0.28); padding: 18px 25px; border-radius: 12px; letter-spacing: 5px; font-family: sans-serif;">
      DRAFT — BELUM DISAHKAN
    </div>
  ` : '';

  // Bangun baris tabel barang (minimum 7 baris agar persis format surat pesanan/BAST)
  const minRows = Math.max(7, itemsBarang.length);
  let tableBarangRowsHtml = '';
  for (let i = 0; i < minRows; i++) {
    const it = itemsBarang[i];
    if (it) {
      tableBarangRowsHtml += `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${escapeHtml(it.nama_barang)}</td>
          <td>${escapeHtml(it.spesifikasi || it.nama_barang)}</td>
          <td class="text-center">${escapeHtml(it.volume)}</td>
          <td class="text-right">Rp. ${formatRupiahPlain(it.harga_satuan)}</td>
          <td class="text-right">Rp. ${formatRupiahPlain(it.jumlah)}</td>
        </tr>
      `;
    } else {
      tableBarangRowsHtml += `
        <tr>
          <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      `;
    }
  }

  // Halaman 6: Dokumentasi Foto Barang (grid 2 kolom, maks 6 foto per lembar)
  let fotoPagesHtml = '';
  if (fotoItems.length > 0) {
    for (let i = 0; i < fotoItems.length; i += 6) {
      const chunk = fotoItems.slice(i, i + 6);
      fotoPagesHtml += `
        <div class="sheet page-break">
          <div class="foto-grid-2col">
            ${chunk.map(f => `
              <div class="foto-cell">
                <img src="${f.file_url}" alt="Foto Barang" onerror="this.src='/img/logo-dosman-hd.png';">
                ${f.caption ? `<div class="foto-cap">${escapeHtml(f.caption)}</div>` : ''}
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
          <div style="font-weight: 700; font-size: 11pt; color: #334155;">Belum Ada Dokumentasi Foto Barang</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Unggah foto-foto barang pada Bagian Dokumentasi Foto di form LPJ.</div>
        </div>
      </div>
    `;
  }

  // Halaman 7: Lampiran Nota / Faktur Toko Fisik
  let notaPagesHtml = '';
  const validNotas = notaItems.filter(n => n.file_url);
  if (lpj.file_nota_url && validNotas.length === 0) {
    if (lpj.file_nota_url.toLowerCase().endsWith('.pdf')) {
      notaPagesHtml = `<div class="pdf-multipage-container" data-pdf-url="${lpj.file_nota_url}"><div class="sheet page-break"><div class="empty-doc-box">Memproses Nota PDF...</div></div></div>`;
    } else {
      notaPagesHtml = `<div class="sheet page-break"><div class="full-scan-wrap"><img src="${lpj.file_nota_url}" alt="Nota Toko"></div></div>`;
    }
  } else if (validNotas.length > 0) {
    validNotas.forEach(n => {
      if (n.file_url.toLowerCase().endsWith('.pdf')) {
        notaPagesHtml += `<div class="pdf-multipage-container" data-pdf-url="${n.file_url}"><div class="sheet page-break"><div class="empty-doc-box">Memproses Nota PDF...</div></div></div>`;
      } else {
        notaPagesHtml += `<div class="sheet page-break"><div class="full-scan-wrap"><img src="${n.file_url}" alt="Nota Toko"></div></div>`;
      }
    });
  } else {
    notaPagesHtml = `
      <div class="sheet page-break">
        <div class="empty-doc-box">
          <div style="font-weight: 700; font-size: 11pt; color: #334155;">Belum Ada Scan Nota / Faktur Toko</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Unggah foto/PDF nota toko pada formulir Pengadaan Barang.</div>
        </div>
      </div>
    `;
  }

  // Halaman 8: Lampiran Bukti Transfer / Setoran Bank
  let transferPageHtml = '';
  if (proposal.file_bukti_transfer_url) {
    if (proposal.file_bukti_transfer_url.toLowerCase().endsWith('.pdf')) {
      transferPageHtml = `<div class="pdf-multipage-container" data-pdf-url="${proposal.file_bukti_transfer_url}"><div class="sheet"><div class="empty-doc-box">Memproses Bukti Transfer PDF...</div></div></div>`;
    } else {
      transferPageHtml = `<div class="sheet"><div class="full-scan-wrap"><img src="${proposal.file_bukti_transfer_url}" alt="Bukti Transfer Bank"></div></div>`;
    }
  } else {
    transferPageHtml = `
      <div class="sheet">
        <div class="empty-doc-box">
          <div style="font-weight: 700; font-size: 11pt; color: #334155;">Belum Ada Lampiran Bukti Transfer Bank</div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 4px;">Unggah slip transfer bank melalui form LPJ atau Pencairan Kas Bendahara.</div>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Pengadaan Barang - ${escapeHtml(proposal.nama_kegiatan)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10.5pt;
      color: #000000;
      background: #e2e8f0;
      line-height: 1.4;
    }
    .no-print-toolbar {
      position: sticky; top: 0; z-index: 1000; background: #ffffff;
      border-bottom: 1px solid #cbd5e1; padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .btn-toolbar {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
      border-radius: 8px; font-weight: 700; font-size: 0.85rem; text-decoration: none; cursor: pointer; border: 1px solid transparent;
    }
    .btn-secondary { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
    .btn-primary { background: #059669; color: #ffffff; }
    .sheet-wrapper { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px 0 40px; }
    .sheet {
      width: 210mm; min-height: 297mm; background: #ffffff;
      padding: 12mm 16mm; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14); position: relative;
    }
    .page-break { page-break-after: always; }

    ${getKopSuratCss('portrait')}

    /* Cover Halaman 1 */
    .cover-box-frame {
      border: 1.5px solid #000000;
      min-height: 270mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 36mm 18mm;
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
    }
    .cover-title-lg { font-size: 16pt; font-weight: 500; letter-spacing: 0.5px; line-height: 1.7; }
    .cover-logo-mid img { width: 175px; height: auto; }
    .cover-footer-lg { font-size: 15pt; font-weight: 500; line-height: 1.8; }

    /* Kwitansi Halaman 2 */
    .kwitansi-bar {
      background: #94a3b8; color: #000; font-weight: 700; font-size: 13pt;
      letter-spacing: 2px; text-align: center; padding: 3px 0; border: 1.5px solid #000; margin-bottom: 10px;
    }
    .kwitansi-tbl { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 10px; }
    .kwitansi-tbl td { padding: 4px 2px; vertical-align: top; }
    .kwitansi-tbl td.lbl { width: 145px; font-style: italic; }
    .kwitansi-tbl td.col { width: 14px; text-align: center; }
    .box-shaded { background: #cbd5e1; border: 1px solid #000; padding: 3px 10px; font-weight: 700; font-style: italic; display: inline-block; min-width: 180px; }
    .box-terbilang { background: #cbd5e1; border: 1px solid #000; padding: 4px 10px; font-weight: 600; }

    .penerima-wrap { display: flex; justify-content: flex-end; margin: 12px 10px 14px 0; }
    .penerima-inner { width: 225px; font-size: 10pt; }
    .sig-6-tbl { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 6px; }
    .sig-6-tbl td { width: 50%; vertical-align: top; padding: 6px 8px 10px 4px; }
    .sig-space { height: 48px; }
    .sig-under { font-weight: 700; text-decoration: underline; }

    /* Tabel Barang (Halaman 3 & 5) */
    .doc-heading-center { text-align: center; font-weight: 700; font-size: 11.5pt; text-decoration: underline; margin-bottom: 4px; }
    .doc-nomor-row { text-align: center; font-size: 10pt; margin-bottom: 12px; }
    .barang-tbl { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 10px; }
    .barang-tbl th, .barang-tbl td { border: 1px solid #000000; padding: 4px 6px; vertical-align: middle; }
    .barang-tbl th { text-align: center; font-weight: 700; background: #f8fafc; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }

    /* Tanda Tangan 2 + 1 (Halaman 3, 4, 5) */
    .sig-2col { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 10pt; }
    .sig-2col td { width: 50%; vertical-align: top; padding: 4px 10px; }
    .sig-mid-center { text-align: center; margin-top: 18px; font-size: 10pt; }

    /* BAST Halaman 4 */
    .bast-table-pihak { width: 100%; border-collapse: collapse; margin: 8px 0 8px 16px; font-size: 10pt; }
    .bast-table-pihak td { padding: 2px 4px; vertical-align: top; }

    /* Foto Grid Halaman 6 */
    .foto-grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
    .foto-cell { border: 1px solid #cbd5e1; padding: 4px; text-align: center; }
    .foto-cell img { width: 100%; height: 75mm; object-fit: cover; display: block; }
    .foto-cap { font-size: 8.5pt; margin-top: 4px; color: #334155; }

    /* Scan Halaman 7 & 8 */
    .full-scan-wrap { width: 100%; min-height: 260mm; display: flex; align-items: center; justify-content: center; }
    .full-scan-wrap img { max-width: 100%; max-height: 262mm; object-fit: contain; }
    .empty-doc-box {
      min-height: 240mm; display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 30px;
    }

    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .no-print-toolbar { display: none !important; }
      .sheet-wrapper { padding: 0 !important; gap: 0 !important; }
      .sheet { box-shadow: none !important; padding: 0 !important; width: 100% !important; min-height: auto !important; margin: 0 !important; }
      .cover-box-frame { min-height: 270mm !important; }
    }
  </style>
</head>
<body>
  ${draftWatermarkHtml}

  <div class="no-print-toolbar">
    <div>
      <div style="font-weight: 800; font-size: 0.98rem; color: #0f172a;">Pratinjau Laporan Pengadaan Barang (Wakasek Sarana &amp; Prasarana)</div>
      <div style="font-size: 0.78rem; color: #64748b;">Urutan: 1. Cover • 2. Kwitansi • 3. Nota Pesanan • 4. BAST • 5. Daftar Barang • 6. Foto • 7. Nota • 8. Slip Transfer</div>
    </div>
    <div style="display: flex; gap: 10px;">
      <a href="/" class="btn-toolbar btn-secondary">← Kembali ke Aplikasi</a>
      <button onclick="window.print()" class="btn-toolbar btn-primary">🖨️ Cetak Laporan (PDF)</button>
    </div>
  </div>

  <div class="sheet-wrapper">
    <!-- HALAMAN 1: COVER -->
    <div class="sheet page-break">
      <div class="cover-box-frame">
        <div class="cover-title-lg">
          LAPORAN<br>
          PENGADAAN BARANG BULAN<br>
          ${bulanLaporan}
        </div>
        <div class="cover-logo-mid">
          <img src="/img/logo_sekolah.png" alt="Logo SMAN 1 Gianyar" onerror="this.src='/img/logo-dosman-hd.png';">
        </div>
        <div class="cover-footer-lg">
          SMA NEGERI 1 GIANYAR<br>
          TAHUN ${tahunAnggaran}
        </div>
      </div>
    </div>

    <!-- HALAMAN 2: KWITANSI -->
    <div class="sheet page-break">
      ${renderKopSurat({ mode: 'portrait' })}
      <div class="kwitansi-bar">KWITANSI</div>

      <table class="kwitansi-tbl">
        <tr><td class="lbl">Nomor</td><td class="col">:</td><td style="font-style: italic;">${escapeHtml(nomorSurat)}</td></tr>
        <tr><td class="lbl">Sudah Terima Dari</td><td class="col">:</td><td>${escapeHtml(pembayarKwitansi)}</td></tr>
        <tr><td class="lbl" style="padding-top: 8px;">Banyaknya Uang</td><td class="col" style="padding-top: 8px;">:</td><td style="padding-top: 6px;"><span class="box-shaded">Rp.${formatRupiahPlain(nominalFinal)}~</span></td></tr>
        <tr><td class="lbl" style="padding-top: 8px;">Untuk Pembayaran</td><td class="col" style="padding-top: 8px;">:</td><td style="padding-top: 8px;">${escapeHtml(untukPembayaran)}</td></tr>
        <tr><td class="lbl" style="padding-top: 8px;">Terbilang Rp</td><td class="col" style="padding-top: 8px;">:</td><td style="padding-top: 6px;"><div class="box-terbilang">${escapeHtml(terbilangTotal)} Rupiah</div></td></tr>
      </table>

      <div class="penerima-wrap">
        <div class="penerima-inner">
          <div>${escapeHtml(kotaSurat)}, ${tglCetak}</div>
          <div>Yang Menerima</div>
          <div class="sig-space"></div>
          <div class="sig-under">${escapeHtml(namaPenyedia)}</div>
          <div>Penyedia</div>
        </div>
      </div>

      <table class="sig-6-tbl">
        <tr>
          <td>
            <div>Mengetahui/Menyetujui,</div>
            <div>Kepala Sekolah SMA Negeri 1 Gianyar</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(kepsekNama)}</div>
            <div>${escapeHtml(kepsekNip)}</div>
          </td>
          <td>
            <div>Analis SDM Aparatur Ahli Muda</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(analisSdmNama)}</div>
            <div>${escapeHtml(analisSdmNip)}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div>Bendahara Dana Pungutan Masyarakat</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(bendaharaNama)}</div>
            <div>${escapeHtml(bendaharaNip)}</div>
          </td>
          <td>
            <div>Lunas Dibayar Oleh:</div>
            <div>Bendahara Pemb. Dana Pungutan Masyarakat SMA Negeri 1 Gianyar</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(bendaharaPembantuNama)}</div>
            <div>${escapeHtml(bendaharaPembantuNip)}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div>Ketua Dana Pungutan Masyarakat</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(ketuaKomiteNama)}</div>
            <div>NIP: -</div>
          </td>
          <td>
            <div>Wakasek .Sarana /prasarana</div>
            <div>SMA Negeri 1 Gianyar</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(wakaSaranaNama)}</div>
            <div>${escapeHtml(wakaSaranaNip)}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- HALAMAN 3: NOTA PESANAN -->
    <div class="sheet page-break">
      <div class="doc-heading-center">NOTA PESANAN</div>
      <div class="doc-nomor-row"><em>Nomor :</em> &nbsp;&nbsp; <em>${escapeHtml(nomorSurat)}</em></div>

      <table class="barang-tbl">
        <thead>
          <tr>
            <th style="width: 34px;">No</th>
            <th>Nama Barang</th>
            <th>Spesifikasi Teknis</th>
            <th style="width: 72px;">Volume</th>
            <th style="width: 105px;">Harga Satuan</th>
            <th style="width: 110px;">Jumlah Harga</th>
          </tr>
        </thead>
        <tbody>
          ${tableBarangRowsHtml}
          <tr>
            <td colspan="4" style="border-left: none; border-bottom: none;"></td>
            <td><strong>JUMLAH</strong></td>
            <td class="text-right">${formatRupiahPlain(subtotalBarang)}</td>
          </tr>
          <tr>
            <td colspan="4" style="border-left: none; border-bottom: none;"></td>
            <td><strong>PPN ${ppnPersen > 0 ? ppnPersen : 11}%</strong></td>
            <td class="text-right">${nominalPpn > 0 ? formatRupiahPlain(nominalPpn) : '-'}</td>
          </tr>
          <tr>
            <td colspan="4" style="border-left: none; border-bottom: none;"></td>
            <td><strong>JUMLAH TOTAL</strong></td>
            <td class="text-right"><strong>${formatRupiahPlain(nominalFinal)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="margin: 10px 0 18px; font-size: 10pt;">
        Terbilang : <strong>${escapeHtml(terbilangTotal)} Rupiah</strong>
      </div>

      <table class="sig-2col">
        <tr>
          <td>
            <div>Penerima Pesanan</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(analisSdmNama)}</div>
            <div>${escapeHtml(analisSdmNip)}</div>
          </td>
          <td>
            <div>${escapeHtml(kotaSurat)}, ${tglCetak}</div>
            <div>Yang Memesan</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(pemesanNama)}</div>
            <div>${escapeHtml(pemesanNip)}</div>
          </td>
        </tr>
      </table>

      <div class="sig-mid-center">
        <div>Mengetahui/Menyetujui,</div>
        <div>Kepala Sekolah SMA Negeri 1 Gianyar</div>
        <div class="sig-space"></div>
        <div class="sig-under">${escapeHtml(kepsekNama)}</div>
        <div>${escapeHtml(kepsekNip)}</div>
      </div>
    </div>

    <!-- HALAMAN 4: BERITA ACARA SERAH TERIMA BARANG -->
    <div class="sheet page-break">
      ${renderKopSurat({ mode: 'portrait' })}
      <div class="doc-heading-center">BERITA ACARA SERAH TERIMA BARANG</div>
      <div class="doc-nomor-row">NOMOR : ${escapeHtml(nomorSurat)}</div>

      <p style="text-indent: 28px; text-align: justify; margin-bottom: 10px;">
        Pada hari ${escapeHtml(hariTanggalTeks)}, kami yang bertanda tangan dibawah ini :
      </p>

      <table class="bast-table-pihak">
        <tr><td style="width: 24px;">I.</td><td style="width: 90px;">Nama</td><td style="width: 14px;">:</td><td>${escapeHtml(analisSdmNama)}</td></tr>
        <tr><td></td><td>Jabatan</td><td>:</td><td>Analis SMAN 1 Gianyar</td></tr>
        <tr><td></td><td>Alamat</td><td>:</td><td>Jl. Ratna No 1 Kab. Gianyar</td></tr>
      </table>
      <div style="margin: 4px 0 10px 44px;">Selanjutnya disebut <strong>Pihak Pertama</strong></div>

      <table class="bast-table-pihak">
        <tr><td style="width: 24px;">2.</td><td style="width: 90px;">Nama</td><td style="width: 14px;">:</td><td>${escapeHtml(namaPenyedia)}</td></tr>
        <tr><td></td><td>Jabatan</td><td>:</td><td>${escapeHtml(jabatanPenyedia)}</td></tr>
        <tr><td></td><td>Alamat</td><td>:</td><td>${escapeHtml(alamatPenyedia)}</td></tr>
      </table>
      <div style="margin: 4px 0 14px 44px;">Selanjutnya disebut sebagai <strong>Pihak Kedua</strong></div>

      <p style="text-align: justify; margin-bottom: 8px;">
        PIHAK PERTAMA telah menerima barang dari PIHAK KEDUA, dalam keadaan baik/ baru sebagaimana mestinya sesuai dengan yang tercantum dalam surat pesanan.
      </p>
      <p style="text-indent: 28px; text-align: justify; margin-bottom: 18px;">
        Demikianlah berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.
      </p>

      <table class="sig-2col">
        <tr>
          <td>
            <div>PIHAK KEDUA</div>
            <div>${escapeHtml(namaToko)}</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(namaPenyedia)}</div>
            <div>NIP. -</div>
          </td>
          <td>
            <div>PIHAK PERTAMA</div>
            <div>ANALIS SMAN 1 GIANYAR</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(analisSdmNama)}</div>
            <div>${escapeHtml(analisSdmNip)}</div>
          </td>
        </tr>
      </table>

      <div class="sig-mid-center">
        <div>Mengetahui/Menyetujui,</div>
        <div>Kepala Sekolah SMA Negeri 1 Gianyar</div>
        <div class="sig-space"></div>
        <div class="sig-under">${escapeHtml(kepsekNama)}</div>
        <div>${escapeHtml(kepsekNip)}</div>
      </div>
    </div>

    <!-- HALAMAN 5: SERAH TERIMA PEKERJAAN / DAFTAR BARANG -->
    <div class="sheet page-break">
      ${renderKopSurat({ mode: 'portrait' })}
      <div class="doc-heading-center">SERAH TERIMA PEKERJAAN</div>
      <div class="doc-heading-center" style="margin-bottom: 8px;">DAFTAR BARANG</div>
      <div class="doc-nomor-row"><em>Nomor :</em> &nbsp;&nbsp; <em>${escapeHtml(nomorSurat)}</em></div>

      <table class="barang-tbl">
        <thead>
          <tr>
            <th style="width: 34px;">No</th>
            <th>Nama Barang</th>
            <th>Spesifikasi Teknis</th>
            <th style="width: 72px;">Volume</th>
            <th style="width: 105px;">Harga Satuan</th>
            <th style="width: 110px;">Jumlah Harga</th>
          </tr>
        </thead>
        <tbody>
          ${tableBarangRowsHtml}
          <tr>
            <td colspan="4" style="border-left: none; border-bottom: none;"></td>
            <td><strong>JUMLAH</strong></td>
            <td class="text-right">${formatRupiahPlain(subtotalBarang)}</td>
          </tr>
          <tr>
            <td colspan="4" style="border-left: none; border-bottom: none;"></td>
            <td><strong>PPN ${ppnPersen > 0 ? ppnPersen : 11}%</strong></td>
            <td class="text-right">${nominalPpn > 0 ? formatRupiahPlain(nominalPpn) : '-'}</td>
          </tr>
          <tr>
            <td colspan="4" style="border-left: none; border-bottom: none;"></td>
            <td><strong>JUMLAH TOTAL</strong></td>
            <td class="text-right"><strong>${formatRupiahPlain(nominalFinal)}</strong></td>
          </tr>
        </tbody>
      </table>

      <table class="sig-2col">
        <tr>
          <td>
            <div>PIHAK KEDUA</div>
            <div>${escapeHtml(namaToko)}</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(namaPenyedia)}</div>
            <div>NIP. -</div>
          </td>
          <td>
            <div>PIHAK PERTAMA</div>
            <div>ANALIS SMAN 1 GIANYAR</div>
            <div class="sig-space"></div>
            <div class="sig-under">${escapeHtml(analisSdmNama)}</div>
            <div>${escapeHtml(analisSdmNip)}</div>
          </td>
        </tr>
      </table>

      <div class="sig-mid-center">
        <div>Mengetahui/Menyetujui,</div>
        <div>Kepala Sekolah SMA Negeri 1 Gianyar</div>
        <div class="sig-space"></div>
        <div class="sig-under">${escapeHtml(kepsekNama)}</div>
        <div>${escapeHtml(kepsekNip)}</div>
      </div>
    </div>

    <!-- HALAMAN 6: DOKUMENTASI FOTO BARANG -->
    ${fotoPagesHtml}

    <!-- HALAMAN 7: LAMPIRAN NOTA / FAKTUR TOKO -->
    ${notaPagesHtml}

    <!-- HALAMAN 8: LAMPIRAN BUKTI TRANSFER BANK -->
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

module.exports = { renderCetakPengadaanBarang };
