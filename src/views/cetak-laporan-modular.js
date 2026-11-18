const { getPenandatanganMap, formatNipCetak, getPengaturanSekolahMap } = require('../db');
// ==========================================================================
// Generator Bundel Cetak Modular LPJ & Pengadaan (A4 Print-Ready)
// Mendukung 12 Komponen yang Dapat Dipilih (Checklist) & Diatur Urutannya
// Standar Resmi SMA Negeri 1 Gianyar — Kop Surat Aksara Bali (Tanpa QR Code)
// ==========================================================================

const { terbilang } = require('../utils/terbilang');
const { renderKopSurat, getKopSuratCss } = require('./kop-surat');

const ALL_COMPONENT_KEYS = [
  'cover',
  'narasi',
  'kwitansi',
  'rincian_belanja',
  'nota_pesanan',
  'bast',
  'daftar_barang',
  'perjanjian',
  'transfer',
  'nota_toko',
  'daftar_hadir',
  'foto'
];

function getDefaultComponentsByBidang(bidang, templateLaporan) {
  if (templateLaporan === 'PENGADAAN_JASA' || bidang === 'HUMAS') {
    return ['cover', 'kwitansi', 'foto', 'perjanjian', 'transfer'];
  }
  if (templateLaporan === 'PENGADAAN_BARANG' || bidang === 'SARPRAS') {
    return ['cover', 'kwitansi', 'nota_pesanan', 'bast', 'daftar_barang', 'foto', 'nota_toko', 'transfer'];
  }
  return ['cover', 'narasi', 'kwitansi', 'rincian_belanja', 'transfer', 'nota_toko', 'daftar_hadir', 'foto'];
}

function resolveOrderedComponents(proposal) {
  const lpj = proposal.lpj || {};
  let raw = lpj.komponen_laporan;
  let parsed = null;
  if (Array.isArray(raw)) {
    parsed = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const tmp = JSON.parse(raw);
      if (Array.isArray(tmp)) parsed = tmp;
    } catch (_) {
      parsed = null;
    }
  }

  if (!parsed || parsed.length === 0) {
    parsed = getDefaultComponentsByBidang(proposal.bidang_kegiatan, lpj.template_laporan);
  }

  // Cover wajib selalu berada di posisi #1
  const validSet = new Set(ALL_COMPONENT_KEYS);
  const filtered = [];
  for (const key of parsed) {
    if (key !== 'cover' && validSet.has(key) && !filtered.includes(key)) {
      filtered.push(key);
    }
  }
  return ['cover', ...filtered];
}

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

function getMonthNameIndo(dateStr) {
  if (!dateStr) return 'NOPEMBER';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'NOPEMBER';
    return d.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  } catch (e) {
    return 'NOPEMBER';
  }
}

function getHariTanggalIndo(dateStr) {
  if (!dateStr) return '.............................................';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const hari = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const tgl = d.getDate();
    const bln = d.toLocaleDateString('id-ID', { month: 'long' });
    const thn = d.getFullYear();
    return `${hari}, tanggal ${tgl} bulan ${bln} tahun ${thn}`;
  } catch (e) {
    return dateStr;
  }
}

function parseBarangMeta(lpj) {
  if (!lpj || !lpj.barang_meta) return {};
  if (typeof lpj.barang_meta === 'object') return lpj.barang_meta;
  try {
    return JSON.parse(lpj.barang_meta) || {};
  } catch (_) {
    return {};
  }
}

function renderCetakLaporanModular({ proposal }) {
  const lpj = proposal.lpj || {};
  const barangMeta = parseBarangMeta(lpj);
  const items = Array.isArray(proposal.items) ? proposal.items : [];
  const notaItems = Array.isArray(lpj.nota_items) ? lpj.nota_items : [];
  const fotoItems = Array.isArray(lpj.foto_dokumentasi) ? lpj.foto_dokumentasi : [];

  const danaCair = lpj.total_dana_cair !== null && lpj.total_dana_cair !== undefined
    ? Number(lpj.total_dana_cair)
    : Number(proposal.total_dana_disetujui || proposal.total_dana_diajukan || 0);

  let belanjaRiil = 0;
  if (lpj.total_belanja_riil !== null && lpj.total_belanja_riil !== undefined && Number(lpj.total_belanja_riil) > 0) {
    belanjaRiil = Number(lpj.total_belanja_riil);
  } else if (notaItems.length > 0) {
    belanjaRiil = notaItems.reduce((acc, it) => acc + (Math.max(0, Number(it.nominal) || 0)), 0);
  } else if (items.length > 0) {
    belanjaRiil = items.reduce((acc, it) => acc + (it.subtotal_disetujui !== null ? Number(it.subtotal_disetujui) : Number(it.subtotal_ajuan || 0)), 0);
  } else {
    belanjaRiil = danaCair;
  }

  const terbilangRupiah = terbilang(belanjaRiil);
  const terbilangDanaCair = terbilang(danaCair);
  const sisaPengembalian = lpj.sisa_pengembalian_dana !== null && lpj.sisa_pengembalian_dana !== undefined
    ? Number(lpj.sisa_pengembalian_dana)
    : Math.max(0, danaCair - belanjaRiil);

  const tglCetak = lpj.tanggal_laporan
    ? formatDateIndo(lpj.tanggal_laporan)
    : formatDateIndo(proposal.tanggal_pencairan || new Date());
  const tglMulai = formatDateIndo(proposal.tanggal_mulai);
  const tglSelesai = formatDateIndo(proposal.tanggal_selesai);
  const bulanLaporan = getMonthNameIndo(lpj.tanggal_laporan || proposal.tanggal_mulai || proposal.tanggal_pencairan);
  const tahunAnggaran = proposal.tahun_ajaran ? proposal.tahun_ajaran.split('/')[0] : String(new Date().getFullYear());

  // Pengaturan Sekolah & Pejabat Penandatangan Resmi dari DB (master_penandatangan)
  const SCH = typeof getPengaturanSekolahMap === 'function' ? getPengaturanSekolahMap() : {};
  const namaSekolah = SCH.nama_sekolah || 'SMA Negeri 1 Gianyar';
  const alamatSekolah = SCH.alamat_sekolah || 'Jl. Ratna No. 1, Gianyar, Bali 80511';
  const sumberDanaKwitansi = SCH.sumber_dana_kuitansi || 'Dana Komite SMA N 1 Gianyar';
  const pembayarKwitansi = SCH.pembayar_kuitansi || 'Pembantu Bendahara Dana Pungutan Masyarakat SMA Negeri 1 Gianyar';
  const kodeRekeningDefault = SCH.kode_rekening_default || '03.03.09.04';
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

  const bidangKey = String(proposal.bidang_kegiatan || 'KESISWAAN').toUpperCase();
  const wakasek = sg('WAKA_' + (['KESISWAAN', 'KURIKULUM', 'SARPRAS', 'HUMAS'].includes(bidangKey) ? bidangKey : 'KESISWAAN'));
  const wakasekNama = wakasek.nama;
  const wakasekNip = formatNipCetak(wakasek.nip);
  const wakasekJabatan = wakasek.jabatan || `Wakasek ${bidangKey}`;

  const namaKegiatan = proposal.nama_kegiatan || proposal.judul_kegiatan || 'Kegiatan Sekolah';
  const nomorUsulan = proposal.nomor_surat_ajuan || proposal.nomor_usulan || '-';
  const namaPos = proposal.nama_pos || proposal.pos_anggaran || '-';
  const guruNama = proposal.pemohon_nama || '-';
  const guruNip = proposal.pemohon_nip ? formatNipCetak(proposal.pemohon_nip) : '';
  const namaPenerimaKwitansi = (lpj.jasa_penerima_nama && lpj.jasa_penerima_nama.trim())
    ? lpj.jasa_penerima_nama
    : ((barangMeta.nama_penyedia && barangMeta.nama_penyedia.trim()) ? barangMeta.nama_penyedia : guruNama);
  const nipPenerimaKwitansi = (lpj.jasa_penerima_nama && lpj.jasa_penerima_nama.trim()) || (barangMeta.nama_penyedia && barangMeta.nama_penyedia.trim())
    ? ''
    : guruNip;

  const isDraftLpj = proposal.lpj && proposal.lpj.status_lpj === 'DRAFT';
  const draftWatermarkHtml = isDraftLpj ? `
    <div style="position: fixed; top: 38%; left: 8%; right: 8%; text-align: center; font-size: 48pt; font-weight: 900; color: rgba(220, 38, 38, 0.16); transform: rotate(-28deg); pointer-events: none; z-index: 99999; border: 5px dashed rgba(220, 38, 38, 0.25); padding: 18px 25px; border-radius: 12px; letter-spacing: 5px; font-family: sans-serif;">
      DRAFT — BELUM DISAHKAN
    </div>
  ` : '';

  const badgeLabelMap = {
    KESISWAAN: 'LAPORAN PERTANGGUNGJAWABAN KEGIATAN KESISWAAN',
    KURIKULUM: 'LAPORAN PERTANGGUNGJAWABAN KEGIATAN KURIKULUM',
    HUMAS: 'LAPORAN PERTANGGUNGJAWABAN HUBUNGAN MASYARAKAT / JASA',
    SARPRAS: 'LAPORAN PERTANGGUNGJAWABAN SARANA & PRASARANA'
  };
  const coverSubtitle = badgeLabelMap[bidangKey] || 'LAPORAN PERTANGGUNGJAWABAN KEGIATAN';

  const komponenOrder = resolveOrderedComponents(proposal);

  // =========================================================================
  // BUILDER SETIAP KOMPONEN (12 MODUL)
  // =========================================================================

  function buildCover() {
    const sumberDana = proposal.sumber_dana || sumberDanaKwitansi;
    return `
      <div class="sheet sheet-cover">
        <div class="cover-outer-frame">
          <div class="cover-inner-frame">
            <div class="cover-top-badge">
              <span>${escapeHtml(coverSubtitle)}</span>
            </div>

            <div class="cover-header-title">
              <div class="cover-main-heading">LAPORAN PERTANGGUNGJAWABAN</div>
              <div class="cover-sub-heading">${escapeHtml(bidangKey)} &bull; BULAN ${escapeHtml(bulanLaporan)} ${escapeHtml(tahunAnggaran)}</div>
            </div>

            <div class="cover-title-box">
              <div class="cover-title-label">JUDUL KEGIATAN / PENGADAAN</div>
              <div class="cover-kegiatan-name">${escapeHtml(namaKegiatan)}</div>
              <div class="cover-pos-info">POS Anggaran: <strong>${escapeHtml(namaPos)}</strong></div>
            </div>

            <div class="cover-logo-center">
              <img src="/img/logo-dosman-hd.png" onerror="this.onerror=null;this.src='/img/logo-dosman.png';" alt="Logo ${escapeHtml(namaSekolah)}" class="cover-logo-img" />
            </div>

            <div class="cover-meta-grid">
              <div class="cover-meta-row">
                <span class="cover-meta-k">Nomor Usulan</span>
                <span class="cover-meta-v">${escapeHtml(nomorUsulan)}</span>
              </div>
              <div class="cover-meta-row">
                <span class="cover-meta-k">Penanggung Jawab</span>
                <span class="cover-meta-v">${escapeHtml(guruNama)}</span>
              </div>
              <div class="cover-meta-row">
                <span class="cover-meta-k">Sumber Dana</span>
                <span class="cover-meta-v">${escapeHtml(sumberDana)}</span>
              </div>
              <div class="cover-meta-row">
                <span class="cover-meta-k">Realisasi Belanja</span>
                <span class="cover-meta-v"><strong>${formatRupiah(belanjaRiil)}</strong></span>
              </div>
            </div>

            <div class="cover-footer-instansi">
              <div class="cover-inst-line1">PEMERINTAH PROVINSI BALI</div>
              <div class="cover-inst-line2">DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</div>
              <div class="cover-inst-line3">${escapeHtml(namaSekolah.toUpperCase())}</div>
              <div class="cover-inst-line4">${escapeHtml(alamatSekolah)}</div>
              <div class="cover-year-pill">TAHUN ANGGARAN ${escapeHtml(tahunAnggaran)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildNarasi() {
    return `
      <div class="sheet sheet-narasi">
        ${renderKopSurat({ mode: 'portrait' })}

        <div class="doc-title-center" style="margin-top: 12px; margin-bottom: 14px;">
          <div style="font-size: 12pt; font-weight: 800; text-decoration: underline;">LAPORAN PELAKSANAAN KEGIATAN</div>
          <div style="font-size: 9.5pt; margin-top: 2px;">Nomor Usulan: ${escapeHtml(nomorUsulan)}</div>
        </div>

        <table class="narasi-meta-table">
          <tr>
            <td style="width: 170px;"><strong>1. Nama Kegiatan</strong></td>
            <td style="width: 12px;">:</td>
            <td><strong>${escapeHtml(namaKegiatan)}</strong></td>
          </tr>
          <tr>
            <td><strong>2. Bidang / Seksi</strong></td>
            <td>:</td>
            <td>${escapeHtml(bidangKey)} (POS: ${escapeHtml(namaPos)})</td>
          </tr>
          <tr>
            <td><strong>3. Penanggung Jawab</strong></td>
            <td>:</td>
            <td>${escapeHtml(guruNama)} ${guruNip ? `(${escapeHtml(guruNip)})` : ''}</td>
          </tr>
          <tr>
            <td><strong>4. Waktu Pelaksanaan</strong></td>
            <td>:</td>
            <td>${tglMulai} s/d ${tglSelesai}</td>
          </tr>
          <tr>
            <td><strong>5. Tempat Pelaksanaan</strong></td>
            <td>:</td>
            <td>${escapeHtml(lpj.tempat_pelaksanaan || namaSekolah)}</td>
          </tr>
          <tr>
            <td><strong>6. Sasaran / Jumlah Peserta</strong></td>
            <td>:</td>
            <td>${escapeHtml(lpj.jumlah_peserta || '-')}</td>
          </tr>
        </table>

        <div class="narasi-section">
          <div class="narasi-heading">A. Tujuan Kegiatan</div>
          <div class="narasi-body">${lpj.tujuan_kegiatan ? sanitizeRichHtml(lpj.tujuan_kegiatan) : '<p>Melaksanakan program kerja sekolah sesuai dengan Rencana Anggaran Biaya (RAB) yang telah disetujui.</p>'}</div>
        </div>

        <div class="narasi-section">
          <div class="narasi-heading">B. Resume / Hasil Pelaksanaan Kegiatan</div>
          <div class="narasi-body">${lpj.resume_hasil ? sanitizeRichHtml(lpj.resume_hasil) : '<p>Kegiatan telah terlaksana dengan baik, tertib, dan lancar sesuai jadwal yang direncanakan.</p>'}</div>
        </div>

        <div class="narasi-section">
          <div class="narasi-heading">C. Kendala yang Dihadapi</div>
          <div class="narasi-body">${lpj.kendala ? sanitizeRichHtml(lpj.kendala) : '<p>Tidak terdapat kendala berarti selama pelaksanaan kegiatan.</p>'}</div>
        </div>

        <div class="narasi-section">
          <div class="narasi-heading">D. Solusi &amp; Tindak Lanjut</div>
          <div class="narasi-body">${lpj.solusi_tindak_lanjut ? sanitizeRichHtml(lpj.solusi_tindak_lanjut) : '<p>Evaluasi berkala dan peningkatan koordinasi pada pelaksanaan kegiatan berikutnya.</p>'}</div>
        </div>

        <div class="sig-row-2col" style="margin-top: 26px; margin-bottom: 0;">
          <div class="sig-col">
            Mengetahui,<br>
            ${escapeHtml(wakasekJabatan)}
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(wakasekNama)}</div>
            <div class="sig-nip">${escapeHtml(wakasekNip)}</div>
          </div>
          <div class="sig-col-right">
            ${escapeHtml(kotaSurat)}, ${escapeHtml(tglCetak)}<br>
            Penanggung Jawab Kegiatan
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(guruNama)}</div>
            <div class="sig-nip">${escapeHtml(guruNip || '&nbsp;')}</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildKwitansi() {
    const kodeRek = (lpj.jasa_kode_rekening && lpj.jasa_kode_rekening.trim())
      ? lpj.jasa_kode_rekening
      : (proposal.kode_rekening_pos || proposal.kode_rekening || kodeRekeningDefault);
    const untukPembayaran = (lpj.jasa_untuk_pembayaran && lpj.jasa_untuk_pembayaran.trim())
      ? lpj.jasa_untuk_pembayaran
      : ((barangMeta.untuk_pembayaran && barangMeta.untuk_pembayaran.trim())
        ? barangMeta.untuk_pembayaran
        : `Dibayar Belanja Pelaksanaan Kegiatan ${namaKegiatan} Pada ${sumberDanaKwitansi}`);

    return `
      <div class="sheet sheet-kwitansi">
        <div class="kwitansi-box-wrapper">
          <!-- KOP Surat Resmi Aksara Bali -->
          <div style="margin-bottom: 10px;">
            ${renderKopSurat({ mode: 'portrait' })}
          </div>

          <!-- Judul Banner KWITANSI (Sesuai Kesiswaan Lama) -->
          <div class="kwitansi-banner-title">KWITANSI</div>

          <!-- Tabel Isian Kwitansi -->
          <table class="kwitansi-data-table">
            <tr>
              <td class="col-lbl">Kode. Rekening</td>
              <td class="col-col">:</td>
              <td class="col-val">${escapeHtml(kodeRek)}${lpj.jasa_no_kode ? ` &nbsp;|&nbsp; <strong>No. Kode:</strong> ${escapeHtml(lpj.jasa_no_kode)}` : ''}</td>
            </tr>
            <tr>
              <td class="col-lbl">Sudah terima dari</td>
              <td class="col-col">:</td>
              <td class="col-val">${escapeHtml(pembayarKwitansi)}</td>
            </tr>
            <tr>
              <td class="col-lbl">Terbilang</td>
              <td class="col-col">:</td>
              <td class="col-val" style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 5px 8px; font-style: italic; font-weight: 700;">
                ${escapeHtml(terbilangRupiah)}
              </td>
            </tr>
            <tr>
              <td class="col-lbl">Untuk Pembayaran</td>
              <td class="col-col">:</td>
              <td class="col-val">${escapeHtml(untukPembayaran)}</td>
            </tr>
            <tr>
              <td class="col-lbl" style="padding-top: 10px;">Uang Sebanyak</td>
              <td class="col-col" style="padding-top: 10px;">:</td>
              <td class="col-val" style="padding-top: 6px;">
                <div class="kwitansi-nominal-box">
                  ${formatRupiahKwitansi(belanjaRiil)}
                </div>
              </td>
            </tr>
          </table>

          <!-- Matriks 6 Tanda Tangan Kwitansi Resmi (Sesuai Kesiswaan Lama) -->
          <div class="kwitansi-sig-matrix">
            <!-- Baris 1: Kota/Tgl + Yang Menerima -->
            <div class="sig-row-2col" style="margin-bottom: 14px;">
              <div class="sig-col"></div>
              <div class="sig-col-right">
                ${escapeHtml(kotaSurat)}, ${escapeHtml(tglCetak)}<br>
                Yang Menerima,
                <div class="sig-space-kwitansi"></div>
                <div class="sig-name">${escapeHtml(namaPenerimaKwitansi)}</div>
                <div class="sig-nip">${nipPenerimaKwitansi ? escapeHtml(nipPenerimaKwitansi) : '&nbsp;'}</div>
              </div>
            </div>

            <!-- Baris 2: Kepala Sekolah & Analis SDM -->
            <div class="sig-row-2col">
              <div class="sig-col">
                Mengetahui / Menyetujui,<br>
                Kepala Sekolah ${escapeHtml(namaSekolah)}
                <div class="sig-space-kwitansi"></div>
                <div class="sig-name">${escapeHtml(kepsekNama)}</div>
                <div class="sig-nip">${escapeHtml(kepsekNip)}</div>
              </div>
              <div class="sig-col-right">
                Analis SDM Aparatur Ahli Muda<br>
                ${escapeHtml(namaSekolah)}
                <div class="sig-space-kwitansi"></div>
                <div class="sig-name">${escapeHtml(analisSdmNama)}</div>
                <div class="sig-nip">${escapeHtml(analisSdmNip)}</div>
              </div>
            </div>

            <!-- Baris 3: Bendahara & Bendahara Pembantu -->
            <div class="sig-row-2col">
              <div class="sig-col">
                Bendahara Dana Pungutan Masyarakat<br>
                ${escapeHtml(namaSekolah)}
                <div class="sig-space-kwitansi"></div>
                <div class="sig-name">${escapeHtml(bendaharaNama)}</div>
                <div class="sig-nip">${bendaharaNip ? escapeHtml(bendaharaNip) : '&nbsp;'}</div>
              </div>
              <div class="sig-col-right">
                Lunas dibayar oleh :<br>
                Bendahara Pemb. Dana Pungutan Masyarakat
                <div class="sig-space-kwitansi"></div>
                <div class="sig-name">${escapeHtml(bendaharaPembantuNama)}</div>
                <div class="sig-nip">${escapeHtml(bendaharaPembantuNip)}</div>
              </div>
            </div>

            <!-- Baris 4: Ketua Komite & Wakasek Sesuai Bidang -->
            <div class="sig-row-2col" style="margin-bottom: 0;">
              <div class="sig-col">
                Ketua Komite<br>
                ${escapeHtml(namaSekolah)}
                <div class="sig-space-kwitansi"></div>
                <div class="sig-name">${escapeHtml(ketuaKomiteNama)}</div>
                <div class="sig-nip">&nbsp;</div>
              </div>
              <div class="sig-col-right">
                ${escapeHtml(wakasekJabatan)}<br>
                ${escapeHtml(namaSekolah)}
                <div class="sig-space-kwitansi"></div>
                <div class="sig-name">${escapeHtml(wakasekNama)}</div>
                <div class="sig-nip">${escapeHtml(wakasekNip)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildRincianBelanja() {
    const rowsHtml = notaItems.length > 0
      ? notaItems.map((it, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${escapeHtml(it.nama_toko || '-')}</td>
            <td>${escapeHtml(it.uraian || '-')}</td>
            <td class="text-right">${formatRupiah(it.nominal)}</td>
          </tr>
        `).join('')
      : (items.length > 0
          ? items.map((it, idx) => {
              const sub = it.subtotal_disetujui !== null && it.subtotal_disetujui !== undefined
                ? Number(it.subtotal_disetujui)
                : Number(it.subtotal_ajuan || 0);
              const uraian = it.deskripsi_item || it.nama_item || it.uraian_kebutuhan || '-';
              const vol = it.volume_disetujui ?? it.volume_ajuan ?? it.qty_disetujui ?? it.qty_ajuan ?? 1;
              return `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>Sesuai RAB</td>
                  <td>${escapeHtml(uraian)} (${vol} ${escapeHtml(it.satuan || 'unit')})</td>
                  <td class="text-right">${formatRupiah(sub)}</td>
                </tr>
              `;
            }).join('')
          : `<tr><td colspan="4" class="text-center">Belum ada rincian item belanja.</td></tr>`);

    return `
      <div class="sheet sheet-rincian">
        ${renderKopSurat({ mode: 'portrait' })}

        <div class="doc-title-center" style="margin-top: 10px; margin-bottom: 10px;">
          <div style="font-size: 11.5pt; font-weight: 800; text-decoration: underline;">RINCIAN REALISASI BELANJA KEGIATAN (LPJ)</div>
          <div style="font-size: 9pt;">Kegiatan: ${escapeHtml(namaKegiatan)} (${escapeHtml(nomorUsulan)})</div>
        </div>

        <table class="summary-finance-table">
          <tr>
            <td>Dana Disetujui &amp; Dicairkan (RAB)</td>
            <td class="text-right"><strong>${formatRupiah(danaCair)}</strong></td>
            <td style="width: 45%; font-style: italic; font-size: 8.5pt;">(${escapeHtml(terbilangDanaCair)})</td>
          </tr>
          <tr>
            <td>Total Realisasi Belanja Riil (LPJ)</td>
            <td class="text-right"><strong>${formatRupiah(belanjaRiil)}</strong></td>
            <td style="font-style: italic; font-size: 8.5pt;">(${escapeHtml(terbilangRupiah)})</td>
          </tr>
          <tr>
            <td>Sisa Dana / Pengembalian Kas</td>
            <td class="text-right"><strong>${formatRupiah(sisaPengembalian)}</strong></td>
            <td style="font-size: 8.5pt;">${sisaPengembalian > 0 ? 'Wajib dikembalikan ke Kas Bendahara' : 'Nihil (Sesuai Realisasi)'}</td>
          </tr>
        </table>

        <table class="formal-table" style="margin-top: 10px;">
          <thead>
            <tr>
              <th style="width: 34px;">No</th>
              <th style="width: 26%;">Nama Toko / Penyedia</th>
              <th>Uraian Pengeluaran / Barang</th>
              <th style="width: 120px;">Nominal</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="text-right"><strong>TOTAL REALISASI BELANJA</strong></td>
              <td class="text-right"><strong>${formatRupiah(belanjaRiil)}</strong></td>
            </tr>
          </tfoot>
        </table>

        ${lpj.catatan_lpj ? `<div style="margin-top: 8px; font-size: 9pt;"><strong>Catatan:</strong> ${escapeHtml(lpj.catatan_lpj)}</div>` : ''}

        <div class="sig-row-2col" style="margin-top: 22px; margin-bottom: 16px;">
          <div class="sig-col">
            ${escapeHtml(wakasekJabatan)},
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(wakasekNama)}</div>
            <div class="sig-nip">${escapeHtml(wakasekNip)}</div>
          </div>
          <div class="sig-col-right">
            ${escapeHtml(kotaSurat)}, ${escapeHtml(tglCetak)}<br>
            Dibuat oleh : Pembina
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(guruNama)}</div>
            <div class="sig-nip">${guruNip ? escapeHtml(guruNip) : '&nbsp;'}</div>
          </div>
        </div>

        <div class="sig-row-2col" style="margin-bottom: 0;">
          <div class="sig-col">
            Kepala ${escapeHtml(namaSekolah)},
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(kepsekNama)}</div>
            <div class="sig-nip">${escapeHtml(kepsekNip)}</div>
          </div>
          <div class="sig-col-right">
            Mengetahui,<br>
            Analis SDM Aparatur Ahli Muda
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(analisSdmNama)}</div>
            <div class="sig-nip">${escapeHtml(analisSdmNip)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildNotaPesanan() {
    const vendorNama = barangMeta.nama_toko || barangMeta.vendor_nama || '........................................';
    const vendorAlamat = barangMeta.alamat_penyedia || barangMeta.vendor_alamat || '........................................';
    const noPesanan = barangMeta.nomor_surat || barangMeta.no_pesanan || '....................';
    const tglPesanan = barangMeta.tgl_pesanan ? formatDateIndo(barangMeta.tgl_pesanan) : tglCetak;
    const rawItems = Array.isArray(barangMeta.items_barang) && barangMeta.items_barang.length > 0
      ? barangMeta.items_barang
      : (Array.isArray(barangMeta.items) ? barangMeta.items : []);
    const rows = rawItems.length > 0
      ? rawItems.map((it) => ({
          nama: it.nama_barang || it.nama || '-',
          vol: it.volume || `${it.qty ?? 1} ${it.satuan || 'unit'}`.trim(),
          harga: it.harga_satuan ?? it.harga ?? 0,
          jumlah: it.jumlah ?? 0
        }))
      : items.map((it) => ({
          nama: it.deskripsi_item || it.nama_item || it.uraian_kebutuhan || '-',
          vol: `${it.volume_disetujui ?? it.volume_ajuan ?? 1} ${it.satuan || 'unit'}`.trim(),
          harga: it.harga_satuan_disetujui ?? it.harga_satuan_ajuan ?? 0,
          jumlah: it.subtotal_disetujui ?? it.subtotal_ajuan ?? 0
        }));

    const rowsHtml = rows.length > 0
      ? rows.map((r, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${escapeHtml(r.nama || '-')}</td>
            <td class="text-center">${escapeHtml(r.vol)}</td>
            <td class="text-right">${formatRupiah(r.harga || 0)}</td>
            <td class="text-right">${formatRupiah(r.jumlah || 0)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="5" class="text-center">Belum ada daftar pesanan barang.</td></tr>`;

    return `
      <div class="sheet sheet-nota-pesanan">
        <div class="doc-title-center" style="border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
          <div style="font-size: 13pt; font-weight: 800;">NOTA PESANAN BARANG / JASA</div>
          <div style="font-size: 9.5pt;">${escapeHtml(namaSekolah)} &mdash; ${escapeHtml(alamatSekolah)}</div>
        </div>

        <table class="narasi-meta-table" style="margin-bottom: 10px;">
          <tr>
            <td style="width: 140px;">Nomor Pesanan</td>
            <td style="width: 12px;">:</td>
            <td>${escapeHtml(noPesanan)}</td>
          </tr>
          <tr>
            <td>Tanggal Pesanan</td>
            <td>:</td>
            <td>${escapeHtml(tglPesanan)}</td>
          </tr>
          <tr>
            <td>Kepada Yth.</td>
            <td>:</td>
            <td><strong>${escapeHtml(vendorNama)}</strong></td>
          </tr>
          <tr>
            <td>Alamat Penyedia</td>
            <td>:</td>
            <td>${escapeHtml(vendorAlamat)}</td>
          </tr>
        </table>

        <p style="font-size: 9.5pt; margin-bottom: 8px;">Dengan hormat, mohon dikirimkan barang/kebutuhan untuk keperluan <strong>${escapeHtml(namaKegiatan)}</strong> dengan rincian sebagai berikut:</p>

        <table class="formal-table">
          <thead>
            <tr>
              <th style="width: 34px;">No</th>
              <th>Nama Barang / Spesifikasi</th>
              <th style="width: 90px;">Banyaknya</th>
              <th style="width: 105px;">Harga Satuan</th>
              <th style="width: 115px;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="text-right"><strong>JUMLAH TOTAL</strong></td>
              <td class="text-right"><strong>${formatRupiah(belanjaRiil)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <div class="sig-row-2col" style="margin-top: 26px; margin-bottom: 0;">
          <div class="sig-col">
            Mengetahui,<br>
            Kepala ${escapeHtml(namaSekolah)}
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(kepsekNama)}</div>
            <div class="sig-nip">${escapeHtml(kepsekNip)}</div>
          </div>
          <div class="sig-col-right">
            ${escapeHtml(kotaSurat)}, ${escapeHtml(tglPesanan)}<br>
            Pemesan / ${escapeHtml(wakasekJabatan)}
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(wakasekNama)}</div>
            <div class="sig-nip">${escapeHtml(wakasekNip)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildBast() {
    const noBast = barangMeta.nomor_surat || barangMeta.no_bast || '....................';
    const hariTglBast = getHariTanggalIndo(barangMeta.tgl_bast || lpj.tanggal_laporan);
    const vendorNama = barangMeta.nama_toko || barangMeta.vendor_nama || 'Penyedia / Toko';
    const pihakKeduaNama = barangMeta.nama_penyedia || barangMeta.pihak_kedua_nama || vendorNama;
    const pihakKeduaJabatan = barangMeta.jabatan_penyedia || 'Pimpinan / Perwakilan';

    return `
      <div class="sheet sheet-bast">
        ${renderKopSurat({ mode: 'portrait' })}

        <div class="doc-title-center" style="margin-top: 12px; margin-bottom: 12px;">
          <div style="font-size: 12pt; font-weight: 800; text-decoration: underline;">BERITA ACARA SERAH TERIMA BARANG</div>
          <div style="font-size: 9.5pt; margin-top: 2px;">Nomor: ${escapeHtml(noBast)}</div>
        </div>

        <p style="font-size: 10pt; line-height: 1.55; text-align: justify;">
          Pada hari ini ${escapeHtml(hariTglBast)}, kami yang bertanda tangan di bawah ini:
        </p>

        <table class="narasi-meta-table" style="margin: 8px 0;">
          <tr>
            <td style="width: 140px;">1. Nama</td>
            <td style="width: 12px;">:</td>
            <td><strong>${escapeHtml(pihakKeduaNama)}</strong></td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;&nbsp;Jabatan</td>
            <td>:</td>
            <td>${escapeHtml(pihakKeduaJabatan)} ${escapeHtml(vendorNama)} (Selanjutnya disebut <strong>PIHAK PERTAMA</strong>)</td>
          </tr>
          <tr>
            <td>2. Nama</td>
            <td>:</td>
            <td><strong>${escapeHtml(analisSdmNama)}</strong></td>
          </tr>
          <tr>
            <td>&nbsp;&nbsp;&nbsp;Jabatan</td>
            <td>:</td>
            <td>Analis SDM Aparatur Ahli Muda ${escapeHtml(namaSekolah)} (Selanjutnya disebut <strong>PIHAK KEDUA</strong>)</td>
          </tr>
        </table>

        <p style="font-size: 10pt; line-height: 1.55; text-align: justify; margin-top: 8px;">
          Dengan ini menyatakan bahwa PIHAK PERTAMA telah menyerahkan barang hasil pengadaan untuk kegiatan
          <strong>${escapeHtml(namaKegiatan)}</strong> dengan nilai keseluruhan sebesar
          <strong>${formatRupiah(belanjaRiil)}</strong> (<em>${escapeHtml(terbilangRupiah)}</em>) kepada PIHAK KEDUA,
          dan PIHAK KEDUA telah menerima barang tersebut dalam keadaan baik, lengkap, serta sesuai dengan spesifikasi pesanan (daftar rincian terlampir).
        </p>

        <p style="font-size: 10pt; line-height: 1.55; text-align: justify; margin-top: 8px;">
          Demikian Berita Acara Serah Terima Barang ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
        </p>

        <div class="sig-row-2col" style="margin-top: 26px; margin-bottom: 18px;">
          <div class="sig-col">
            PIHAK PERTAMA<br>
            Yang Menyerahkan,
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(pihakKeduaNama)}</div>
            <div class="sig-nip">${escapeHtml(vendorNama)}</div>
          </div>
          <div class="sig-col-right">
            PIHAK KEDUA<br>
            Analis SDM Aparatur Ahli Muda,
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(analisSdmNama)}</div>
            <div class="sig-nip">${escapeHtml(analisSdmNip)}</div>
          </div>
        </div>

        <div style="text-align: center; font-size: 9.5pt;">
          Mengetahui,<br>
          Kepala ${escapeHtml(namaSekolah)}
          <div class="sig-space-kwitansi"></div>
          <div class="sig-name">${escapeHtml(kepsekNama)}</div>
          <div class="sig-nip">${escapeHtml(kepsekNip)}</div>
        </div>
      </div>
    `;
  }

  function buildDaftarBarang() {
    const rawItems = Array.isArray(barangMeta.items_barang) && barangMeta.items_barang.length > 0
      ? barangMeta.items_barang
      : (Array.isArray(barangMeta.items) ? barangMeta.items : []);
    const rows = rawItems.length > 0
      ? rawItems.map((it) => ({
          nama: it.nama_barang || it.nama || '-',
          vol: it.volume || `${it.qty ?? 1} ${it.satuan || 'unit'}`.trim(),
          harga: it.harga_satuan ?? it.harga ?? 0,
          jumlah: it.jumlah ?? 0,
          kondisi: it.kondisi || 'Baik / Lengkap'
        }))
      : items.map((it) => ({
          nama: it.deskripsi_item || it.nama_item || it.uraian_kebutuhan || '-',
          vol: `${it.volume_disetujui ?? it.volume_ajuan ?? 1} ${it.satuan || 'unit'}`.trim(),
          harga: it.harga_satuan_disetujui ?? it.harga_satuan_ajuan ?? 0,
          jumlah: it.subtotal_disetujui ?? it.subtotal_ajuan ?? 0,
          kondisi: 'Baik / Lengkap'
        }));

    const rowsHtml = rows.length > 0
      ? rows.map((r, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${escapeHtml(r.nama || '-')}</td>
            <td class="text-center">${escapeHtml(r.vol)}</td>
            <td class="text-right">${formatRupiah(r.harga || 0)}</td>
            <td class="text-right">${formatRupiah(r.jumlah || 0)}</td>
            <td class="text-center">${escapeHtml(r.kondisi || 'Baik')}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="6" class="text-center">Belum ada daftar barang yang diserahkan.</td></tr>`;

    return `
      <div class="sheet sheet-daftar-barang">
        ${renderKopSurat({ mode: 'portrait' })}

        <div class="doc-title-center" style="margin-top: 12px; margin-bottom: 12px;">
          <div style="font-size: 11.5pt; font-weight: 800; text-decoration: underline;">LAMPIRAN DAFTAR BARANG / SERAH TERIMA PEKERJAAN</div>
          <div style="font-size: 9.5pt; margin-top: 2px;">Pengadaan: ${escapeHtml(namaKegiatan)}</div>
        </div>

        <table class="formal-table">
          <thead>
            <tr>
              <th style="width: 34px;">No</th>
              <th>Nama Barang / Pekerjaan</th>
              <th style="width: 82px;">Volume</th>
              <th style="width: 100px;">Harga Satuan</th>
              <th style="width: 110px;">Jumlah</th>
              <th style="width: 80px;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="text-right"><strong>TOTAL NILAI PENGADAAN</strong></td>
              <td class="text-right"><strong>${formatRupiah(belanjaRiil)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="sig-row-2col" style="margin-top: 26px; margin-bottom: 0;">
          <div class="sig-col">
            ${escapeHtml(wakasekJabatan)}
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(wakasekNama)}</div>
            <div class="sig-nip">${escapeHtml(wakasekNip)}</div>
          </div>
          <div class="sig-col-right">
            ${escapeHtml(kotaSurat)}, ${escapeHtml(tglCetak)}<br>
            Analis SDM Aparatur Ahli Muda
            <div class="sig-space-kwitansi"></div>
            <div class="sig-name">${escapeHtml(analisSdmNama)}</div>
            <div class="sig-nip">${escapeHtml(analisSdmNip)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function buildPerjanjian() {
    if (lpj.jasa_file_perjanjian_url) {
      const url = escapeHtml(lpj.jasa_file_perjanjian_url);
      if (lpj.jasa_file_perjanjian_url.toLowerCase().endsWith('.pdf')) {
        return `<div class="pdf-multipage-container" data-pdf-url="${url}" data-doc-title="SURAT PERJANJIAN KERJA SAMA"></div>`;
      }
      return `
        <div class="sheet sheet-attachment">
          <div class="attachment-header">LAMPIRAN: SURAT PERJANJIAN KERJA SAMA / KONTRAK</div>
          <div class="attachment-img-wrap">
            <img src="${url}" alt="Surat Perjanjian Kerja Sama" />
          </div>
        </div>
      `;
    }

    const teksPerjanjian = lpj.jasa_teks_perjanjian && lpj.jasa_teks_perjanjian.trim()
      ? sanitizeRichHtml(lpj.jasa_teks_perjanjian)
      : `<p>Surat Perjanjian Kerja Sama / Kontrak pelaksanaan kegiatan <strong>${escapeHtml(namaKegiatan)}</strong> belum diunggah atau diisi.</p>`;

    return `
      <div class="sheet sheet-perjanjian">
        ${renderKopSurat({ mode: 'portrait' })}
        <div class="doc-title-center" style="margin-top: 12px; margin-bottom: 12px;">
          <div style="font-size: 12pt; font-weight: 800; text-decoration: underline;">SURAT PERJANJIAN KERJA SAMA</div>
        </div>
        <div class="narasi-body" style="font-size: 10pt; line-height: 1.55;">
          ${teksPerjanjian}
        </div>
      </div>
    `;
  }

  function buildTransfer() {
    const transferUrl = proposal.file_bukti_transfer_url || '';
    if (!transferUrl) {
      return `
        <div class="sheet sheet-attachment">
          <div class="attachment-header">LAMPIRAN: BUKTI TRANSFER / SETORAN BANK</div>
          <div class="empty-attachment-box">Belum ada berkas bukti transfer yang diunggah.</div>
        </div>
      `;
    }
    if (transferUrl.toLowerCase().endsWith('.pdf')) {
      return `<div class="pdf-multipage-container" data-pdf-url="${escapeHtml(transferUrl)}" data-doc-title="BUKTI TRANSFER / SETORAN BANK"></div>`;
    }
    return `
      <div class="sheet sheet-attachment">
        <div class="attachment-header">LAMPIRAN: BUKTI TRANSFER / SETORAN BANK</div>
        <div style="font-size: 9pt; margin-bottom: 8px; color: #334155;">
          Kegiatan: <strong>${escapeHtml(namaKegiatan)}</strong> &bull; Nominal Cair: <strong>${formatRupiah(danaCair)}</strong>
        </div>
        <div class="attachment-img-wrap">
          <img src="${escapeHtml(transferUrl)}" alt="Bukti Transfer" />
        </div>
      </div>
    `;
  }

  function buildNotaToko() {
    const chunks = [];
    const notaDenganFile = notaItems.filter(it => it.file_url);

    if (notaDenganFile.length > 0) {
      notaDenganFile.forEach((it, idx) => {
        const url = it.file_url;
        if (url.toLowerCase().endsWith('.pdf')) {
          chunks.push(`<div class="pdf-multipage-container" data-pdf-url="${escapeHtml(url)}" data-doc-title="BUKTI NOTA #${idx + 1} - ${escapeHtml(it.nama_toko || 'Toko')}"></div>`);
        } else {
          chunks.push(`
            <div class="sheet sheet-attachment">
              <div class="attachment-header">LAMPIRAN BUKTI NOTA / FAKTUR TOKO (#${idx + 1})</div>
              <div style="font-size: 9pt; margin-bottom: 8px; display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
                <span><strong>Toko/Penyedia:</strong> ${escapeHtml(it.nama_toko || '-')} &mdash; ${escapeHtml(it.uraian || '-')}</span>
                <span><strong>Nominal:</strong> ${formatRupiah(it.nominal || 0)}</span>
              </div>
              <div class="attachment-img-wrap">
                <img src="${escapeHtml(url)}" alt="Bukti Nota #${idx + 1}" />
              </div>
            </div>
          `);
        }
      });
      return chunks.join('');
    }

    if (lpj.file_nota_url) {
      const url = lpj.file_nota_url;
      if (url.toLowerCase().endsWith('.pdf')) {
        return `<div class="pdf-multipage-container" data-pdf-url="${escapeHtml(url)}" data-doc-title="BUKTI NOTA / FAKTUR TOKO"></div>`;
      }
      return `
        <div class="sheet sheet-attachment">
          <div class="attachment-header">LAMPIRAN BUKTI NOTA / FAKTUR TOKO</div>
          <div class="attachment-img-wrap">
            <img src="${escapeHtml(url)}" alt="Bukti Nota Toko" />
          </div>
        </div>
      `;
    }

    return `
      <div class="sheet sheet-attachment">
        <div class="attachment-header">LAMPIRAN BUKTI NOTA / FAKTUR TOKO</div>
        <div class="empty-attachment-box">Belum ada lampiran bukti nota atau faktur toko yang diunggah.</div>
      </div>
    `;
  }

  function buildDaftarHadir() {
    const url = lpj.file_daftar_hadir_url || '';
    if (!url) {
      return `
        <div class="sheet sheet-attachment">
          <div class="attachment-header">LAMPIRAN: DAFTAR HADIR / PRESENSI KEGIATAN</div>
          <div class="empty-attachment-box">Belum ada berkas daftar hadir yang diunggah.</div>
        </div>
      `;
    }
    if (url.toLowerCase().endsWith('.pdf')) {
      return `<div class="pdf-multipage-container" data-pdf-url="${escapeHtml(url)}" data-doc-title="LAMPIRAN DAFTAR HADIR / PRESENSI"></div>`;
    }
    return `
      <div class="sheet sheet-attachment">
        <div class="attachment-header">LAMPIRAN: DAFTAR HADIR / PRESENSI KEGIATAN</div>
        <div class="attachment-img-wrap">
          <img src="${escapeHtml(url)}" alt="Daftar Hadir" />
        </div>
      </div>
    `;
  }

  function buildFoto() {
    if (fotoItems.length === 0) {
      return `
        <div class="sheet sheet-attachment">
          <div class="attachment-header">LAMPIRAN: DOKUMENTASI FOTO KEGIATAN</div>
          <div class="empty-attachment-box">Belum ada foto dokumentasi yang diunggah.</div>
        </div>
      `;
    }

    const pages = [];
    for (let i = 0; i < fotoItems.length; i += 2) {
      const pair = fotoItems.slice(i, i + 2);
      const cardsHtml = pair.map((f, idx) => `
        <div class="foto-vertical-card">
          <div class="foto-vertical-img-wrap">
            <img src="${escapeHtml(f.file_url)}" alt="Dokumentasi ${i + idx + 1}" />
          </div>
          <div class="foto-vertical-caption">
            <strong>Foto ${i + idx + 1}:</strong> ${escapeHtml(f.caption || f.keterangan || namaKegiatan)}
          </div>
        </div>
      `).join('');

      pages.push(`
        <div class="sheet sheet-attachment">
          <div class="attachment-header">DOKUMENTASI FOTO (${i === 0 ? 'HALAMAN 1' : `HALAMAN ${Math.floor(i / 2) + 1}`})</div>
          <div class="foto-vertical-stack">
            ${cardsHtml}
          </div>
        </div>
      `);
    }
    return pages.join('');
  }

  const componentBuilders = {
    cover: buildCover,
    narasi: buildNarasi,
    kwitansi: buildKwitansi,
    rincian_belanja: buildRincianBelanja,
    nota_pesanan: buildNotaPesanan,
    bast: buildBast,
    daftar_barang: buildDaftarBarang,
    perjanjian: buildPerjanjian,
    transfer: buildTransfer,
    nota_toko: buildNotaToko,
    daftar_hadir: buildDaftarHadir,
    foto: buildFoto
  };

  const assembledHtml = komponenOrder
    .map((key) => (componentBuilders[key] ? componentBuilders[key]() : ''))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cetak Laporan - ${escapeHtml(namaKegiatan)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 20px 0 40px 0;
      background: #e2e8f0;
      font-family: "Times New Roman", Times, serif;
      color: #000000;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 999;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      margin-bottom: 18px;
    }

    .print-toolbar button {
      background: #10b981;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      font-size: 13px;
    }

    .print-toolbar button:hover {
      background: #059669;
    }

    .sheet-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }

    .sheet {
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
      padding: 14mm 18mm;
      background: #ffffff;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.14);
      position: relative;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }

    .sheet-wrapper > .sheet:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    ${getKopSuratCss('portrait')}

    /* ---------------- COVER RESMI (UPGRADED) ---------------- */
    .sheet-cover {
      padding: 14mm;
      display: flex;
      flex-direction: column;
    }

    .cover-outer-frame {
      flex: 1;
      border: 3px solid #1e293b;
      padding: 5px;
      display: flex;
      flex-direction: column;
    }

    .cover-inner-frame {
      flex: 1;
      border: 1px solid #475569;
      padding: 20px 26px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    }

    .cover-top-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 18px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.8px;
      border-radius: 4px;
    }

    .cover-header-title {
      margin-top: 10px;
    }

    .cover-main-heading {
      font-size: 20pt;
      font-weight: 800;
      letter-spacing: 1px;
      color: #0f172a;
    }

    .cover-sub-heading {
      font-size: 11.5pt;
      font-weight: 700;
      color: #334155;
      margin-top: 4px;
    }

    .cover-title-box {
      width: 100%;
      border-top: 2px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
      padding: 16px 14px;
      background: #ffffff;
    }

    .cover-title-label {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 8pt;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }

    .cover-kegiatan-name {
      font-size: 15.5pt;
      font-weight: 800;
      line-height: 1.35;
      color: #0f172a;
      text-transform: uppercase;
    }

    .cover-pos-info {
      margin-top: 8px;
      font-size: 10pt;
      color: #334155;
    }

    .cover-logo-center {
      margin: 10px 0;
    }

    .cover-logo-img {
      width: 120px;
      height: auto;
      object-fit: contain;
    }

    .cover-meta-grid {
      width: 88%;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 16px;
      background: #ffffff;
      text-align: left;
      font-size: 10pt;
    }

    .cover-meta-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px dashed #e2e8f0;
    }

    .cover-meta-row:last-child {
      border-bottom: none;
    }

    .cover-meta-k {
      color: #475569;
      font-weight: 600;
    }

    .cover-meta-v {
      color: #0f172a;
    }

    .cover-footer-instansi {
      width: 100%;
      padding-top: 10px;
      border-top: 2px solid #0f172a;
    }

    .cover-inst-line1 {
      font-size: 11pt;
      font-weight: 700;
    }

    .cover-inst-line2 {
      font-size: 10.5pt;
      font-weight: 700;
    }

    .cover-inst-line3 {
      font-size: 13pt;
      font-weight: 800;
      margin-top: 2px;
    }

    .cover-inst-line4 {
      font-size: 9pt;
      color: #334155;
      margin-top: 2px;
    }

    .cover-year-pill {
      display: inline-block;
      margin-top: 8px;
      background: #0f172a;
      color: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 9.5pt;
      font-weight: 700;
      padding: 4px 16px;
      border-radius: 999px;
      letter-spacing: 0.6px;
    }

    /* ---------------- TYPOGRAPHY & TABLES ---------------- */
    .doc-title-center {
      text-align: center;
    }

    .narasi-meta-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      line-height: 1.45;
    }

    .narasi-meta-table td {
      padding: 2px 4px;
      vertical-align: top;
    }

    .narasi-section {
      margin-top: 10px;
    }

    .narasi-heading {
      font-size: 10.5pt;
      font-weight: 700;
      margin-bottom: 3px;
    }

    .narasi-body,
    .narasi-body * {
      font-family: "Times New Roman", Times, serif !important;
      font-size: 10pt !important;
      line-height: 1.45 !important;
      color: #000000 !important;
      background-color: transparent !important;
    }

    .narasi-body {
      text-align: justify;
    }

    .narasi-body p,
    .narasi-body ul,
    .narasi-body ol {
      margin: 0 0 5px 0 !important;
    }

    .narasi-body ul,
    .narasi-body ol {
      padding-left: 20px !important;
    }

    .formal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }

    .formal-table th, .formal-table td {
      border: 1px solid #000000;
      padding: 5px 7px;
      vertical-align: top;
    }

    .formal-table th {
      background: #f1f5f9;
      text-align: center;
      font-weight: 700;
    }

    .summary-finance-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }

    .summary-finance-table td {
      border: 1px solid #000000;
      padding: 5px 8px;
    }

    /* ---------------- KWITANSI RESMI (SESUAI KESISWAAN LAMA) ---------------- */
    .sheet-kwitansi {
      display: flex;
      flex-direction: column;
    }

    .kwitansi-box-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1.5px solid #000000;
      padding: 16px 22px 22px 22px;
    }

    .kwitansi-banner-title {
      background: #334155;
      color: #ffffff;
      text-align: center;
      font-size: 13.5pt;
      font-weight: 800;
      letter-spacing: 3px;
      padding: 4px 0;
      margin-bottom: 12px;
      border: 1px solid #000000;
    }

    .kwitansi-data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      margin-bottom: 14px;
    }

    .kwitansi-data-table td {
      padding: 3.5px 2px;
      vertical-align: top;
    }

    .kwitansi-data-table td.col-lbl {
      width: 135px;
      font-weight: 600;
    }

    .kwitansi-data-table td.col-col {
      width: 12px;
      text-align: center;
    }

    .kwitansi-nominal-box {
      border: 2px solid #000000;
      display: inline-block;
      padding: 4px 16px;
      font-size: 12.5pt;
      font-weight: 800;
      font-style: italic;
      background: #e2e8f0;
      letter-spacing: 0.5px;
    }

    /* ---------------- MATRIKS TANDA TANGAN RESMI ---------------- */
    .kwitansi-sig-matrix {
      width: 100%;
      margin-top: auto;
      padding-top: 10px;
      font-size: 9.2pt;
      line-height: 1.25;
    }

    .sig-row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 24px;
      margin-bottom: 18px;
      font-size: 9.2pt;
      line-height: 1.25;
    }

    .sig-col,
    .sig-col-right {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .sig-space-kwitansi {
      height: 44px;
      margin-top: auto;
    }

    .sig-name {
      font-weight: 800;
      text-decoration: underline;
      font-size: 9.5pt;
    }

    .sig-nip {
      font-size: 8.5pt;
      color: #1e293b;
      min-height: 14px;
    }

    /* ---------------- ATTACHMENTS & FOTO ---------------- */
    .attachment-header {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      font-weight: 800;
      text-transform: uppercase;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
      color: #0f172a;
    }

    .attachment-img-wrap {
      width: 100%;
      height: 245mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      overflow: hidden;
    }

    .attachment-img-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .empty-attachment-box {
      border: 1.5px dashed #94a3b8;
      padding: 36px;
      text-align: center;
      color: #64748b;
      font-style: italic;
      margin-top: 24px;
    }

    .foto-vertical-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .foto-vertical-card {
      border: 1px solid #cbd5e1;
      padding: 8px;
      background: #ffffff;
    }

    .foto-vertical-img-wrap {
      width: 100%;
      height: 108mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
      overflow: hidden;
    }

    .foto-vertical-img-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .foto-vertical-caption {
      margin-top: 6px;
      font-size: 9.5pt;
      text-align: center;
    }

    .pdf-multipage-container {
      display: contents;
    }

    .pdf-page-sheet {
      display: flex;
      flex-direction: column;
    }

    .pdf-canvas-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .pdf-canvas-wrap canvas {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }

    @media screen and (max-width: 840px) {
      body {
        padding: 0 0 24px 0;
      }
      .print-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 14px;
        font-size: 12px;
      }
      .print-toolbar button {
        width: 100%;
      }
      .sheet-wrapper {
        overflow-x: auto;
        align-items: flex-start;
        padding: 0 8px;
      }
    }

    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .print-toolbar {
        display: none !important;
      }
      .sheet-wrapper {
        gap: 0 !important;
      }
      .sheet {
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
  </style>
</head>
<body>
  ${draftWatermarkHtml}
  <div class="print-toolbar">
    <div>
      <strong>Pratinjau Cetak Laporan Modular (${komponenOrder.length} Komponen)</strong> &mdash; ${escapeHtml(namaKegiatan)}
    </div>
    <div>
      <button onclick="window.print()">Cetak / Simpan PDF (A4)</button>
    </div>
  </div>

  <div class="sheet-wrapper" id="sheetWrapper">
    ${assembledHtml}
  </div>

  <script src="/js/pdf.min.js"></script>
  <script>
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
    }

    async function renderAllPdfContainers() {
      const containers = document.querySelectorAll('.pdf-multipage-container');
      if (!containers.length || !window.pdfjsLib) return;

      for (const container of containers) {
        const pdfUrl = container.getAttribute('data-pdf-url');
        const docTitle = container.getAttribute('data-doc-title') || 'LAMPIRAN PDF';
        if (!pdfUrl) continue;
        try {
          const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.75 });

            const sheet = document.createElement('div');
            sheet.className = 'sheet pdf-page-sheet';

            const hdr = document.createElement('div');
            hdr.className = 'attachment-header';
            hdr.textContent = docTitle + (pdf.numPages > 1 ? ' (Hal. ' + pageNum + '/' + pdf.numPages + ')' : '');

            const wrap = document.createElement('div');
            wrap.className = 'pdf-canvas-wrap';

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            wrap.appendChild(canvas);
            sheet.appendChild(hdr);
            sheet.appendChild(wrap);
            container.appendChild(sheet);
          }
        } catch (err) {
          const errSheet = document.createElement('div');
          errSheet.className = 'sheet sheet-attachment';
          errSheet.innerHTML = '<div class="attachment-header">' + docTitle + '</div><div class="empty-attachment-box">Gagal memuat PDF: ' + (err.message || err) + '</div>';
          container.appendChild(errSheet);
        }
      }
    }

    window.addEventListener('DOMContentLoaded', renderAllPdfContainers);
  </script>
</body>
</html>`;
}

module.exports = {
  renderCetakLaporanModular,
  ALL_COMPONENT_KEYS,
  getDefaultComponentsByBidang,
  resolveOrderedComponents
};
