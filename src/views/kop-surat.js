// ==========================================================================
// Komponen KOP Surat Resmi SMA Negeri 1 Gianyar (DOSMAN)
// Sesuai Standar Tata Naskah Dinas & Pergub Bali No. 80 Tahun 2018
// Digunakan di seluruh format cetak resmi (A4 Portrait & A4 Landscape)
// ==========================================================================

/**
 * Menghasilkan markup HTML KOP Surat Resmi
 * @param {Object} options
 * @param {'portrait'|'landscape'} options.mode - Orientasi halaman cetak ('portrait' atau 'landscape')
 * @returns {string} HTML string
 */
function renderKopSurat({ mode = 'portrait' } = {}) {
  const modeClass = mode === 'landscape' ? 'landscape' : 'portrait';

  return `
    <div class="kop-container ${modeClass}">
      <div class="kop-header">
        <!-- Logo Kiri: Pemerintah Provinsi Bali (Ultra-HD Transparent PNG) -->
        <div class="logo-slot logo-kiri">
          <img src="/img/logo-provinsi.png" alt="Logo Pemprov Bali" onerror="this.onerror=null; this.src='/img/logo-pemprov-bali.png';">
        </div>

        <!-- Teks Tengah KOP Surat (Aksara Bali di atas Huruf Latin) -->
        <div class="kop-content">
          <div class="aksara-bali">p;merin\\tH p]opinsi bli</div>
          <div class="instansi-provinsi">PEMERINTAH PROVINSI BALI</div>

          <div class="aksara-bali">dinS p;n\\didikn\\ k;p;mudan\\ dn\\ aoLHrg</div>
          <div class="dinas-pendidikan">DINAS PENDIDIKAN KEPEMUDAAN DAN OLAHRAGA</div>

          <div class="aksara-bali">,es,em,a, neg]i ,1, giy/</div>
          <div class="nama-sekolah">SMA NEGERI 1 GIANYAR</div>

          <div class="aksara-bali aksara-kecil">jln\\rt\\\\n, t;gl\\tugu giy/, t;l\\p : (0361) 943034</div>
          <div class="alamat-kontak">Jln. Ratna, Tegal Tugu Gianyar, Telp : (0361) 943034</div>

          <div class="web-email">Website : https://sman1-gianyar.sch.id, E-mail : sman1.gianyar1963@gmail.com</div>
          <div class="npsn">NPSN : 50102079</div>
        </div>

        <!-- Logo Kanan: SMAN 1 Gianyar - DOSMAN (Transparent PNG) -->
        <div class="logo-slot logo-kanan">
          <img src="/img/logo-dosman.png" alt="Logo SMAN 1 Gianyar (DOSMAN)" onerror="this.onerror=null; this.src='/img/logo-dosman-hd.png';">
        </div>
      </div>

      <!-- Garis Ganda Resmi (Tebal 2.5px - Jeda 1.5px - Tipis 0.8px) -->
      <div class="kop-divider">
        <div class="line-thick"></div>
        <div class="line-gap"></div>
        <div class="line-thin"></div>
      </div>
    </div>
  `;
}

/**
 * Menghasilkan blok CSS styling resmi KOP Surat
 * @param {'portrait'|'landscape'|'all'} mode
 * @returns {string} CSS string
 */
function getKopSuratCss(mode = 'all') {
  return `
    /* -------------------------------------------------------------
       FONT RESMI BALI SIMBAR (Pergub Bali No. 80 Th 2018)
    ------------------------------------------------------------- */
    @font-face {
      font-family: 'Bali Simbar';
      src: local('Bali Simbar'),
           local('Bali Simbar Dwijendra'),
           url('/fonts/Bali%20Simbar.ttf') format('truetype'),
           url('/fonts/Bali Simbar.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }

    /* -------------------------------------------------------------
       KOP SURAT CONTAINER & GRID
    ------------------------------------------------------------- */
    .kop-container {
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 14px;
    }

    /* Portrait: Lebar maksimal 740px / area print margin 15mm */
    .kop-container.portrait {
      max-width: 740px;
      margin-left: auto;
      margin-right: auto;
    }
    .kop-container.portrait .kop-header {
      display: grid;
      align-items: center;
      grid-template-columns: 82px 1fr 82px;
      column-gap: 12px;
    }
    .kop-container.portrait .logo-slot {
      min-height: 94px;
    }
    .kop-container.portrait .logo-slot img {
      max-height: 94px;
      max-width: 86px;
    }
    .kop-container.portrait .aksara-bali { font-size: 31px; }
    .kop-container.portrait .aksara-kecil { font-size: 22px; }
    .kop-container.portrait .instansi-provinsi { font-size: 18px; }
    .kop-container.portrait .dinas-pendidikan { font-size: 16px; }
    .kop-container.portrait .nama-sekolah { font-size: 23px; }
    .kop-container.portrait .alamat-kontak { font-size: 13px; }
    .kop-container.portrait .web-email { font-size: 12px; }
    .kop-container.portrait .npsn { font-size: 12px; }

    /* Landscape: MAKSIMAL 820px (Centered) - Logo tidak boleh terlempar ke pinggir */
    .kop-container.landscape {
      max-width: 820px;
      margin-left: auto;
      margin-right: auto;
    }
    .kop-container.landscape .kop-header {
      display: grid;
      align-items: center;
      grid-template-columns: 88px 1fr 88px;
      column-gap: 16px;
    }
    .kop-container.landscape .logo-slot {
      min-height: 98px;
    }
    .kop-container.landscape .logo-slot img {
      max-height: 98px;
      max-width: 88px;
    }
    .kop-container.landscape .aksara-bali { font-size: 34px; }
    .kop-container.landscape .aksara-kecil { font-size: 24px; }
    .kop-container.landscape .instansi-provinsi { font-size: 19.5px; }
    .kop-container.landscape .dinas-pendidikan { font-size: 17.5px; }
    .kop-container.landscape .nama-sekolah { font-size: 25px; }
    .kop-container.landscape .alamat-kontak { font-size: 14px; }
    .kop-container.landscape .web-email { font-size: 12.5px; }
    .kop-container.landscape .npsn { font-size: 12.5px; }

    /* Slot Logo Kiri & Kanan */
    .kop-container .logo-slot {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    }
    .kop-container .logo-slot img {
      width: auto;
      max-width: 100%;
      object-fit: contain;
      display: block;
    }

    /* Konten Teks Tengah - Sangat Rapat, Mepet, & Ramping */
    .kop-container .kop-content {
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      line-height: 0.82;
      font-family: 'Times New Roman', Times, Georgia, serif;
      color: #000;
    }

    /* Aksara Bali: Line-height rapat dengan margin negatif untuk memotong descent */
    .kop-container .aksara-bali {
      font-family: 'Bali Simbar', 'Bali Simbar Dwijendra', serif;
      font-weight: normal;
      color: #000000;
      letter-spacing: 0.3px;
      line-height: 0.72;
      margin-top: 0px;
      margin-bottom: -5px;
      -webkit-font-smoothing: antialiased;
    }

    .kop-container .instansi-provinsi {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: bold;
      letter-spacing: 0.5px;
      line-height: 0.92;
      margin-top: 0px;
      margin-bottom: 1px;
      color: #000000;
    }

    .kop-container .dinas-pendidikan {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: bold;
      letter-spacing: 0.4px;
      line-height: 0.92;
      margin-top: 0px;
      margin-bottom: 1px;
      color: #000000;
    }

    .kop-container .nama-sekolah {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: bold;
      letter-spacing: 0.8px;
      line-height: 0.94;
      margin-top: 0px;
      margin-bottom: 1px;
      color: #000000;
    }

    .kop-container .alamat-kontak {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: bold;
      line-height: 1.0;
      margin-top: 0px;
      margin-bottom: 0px;
      color: #000000;
    }

    .kop-container .web-email {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: normal;
      line-height: 1.0;
      margin-top: 0px;
      margin-bottom: 0px;
      color: #000000;
    }

    .kop-container .npsn {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: bold;
      letter-spacing: 0.5px;
      line-height: 1.0;
      margin-top: 0px;
      margin-bottom: 0px;
      color: #000000;
    }

    /* Garis Ganda Pembatas KOP Surat */
    .kop-container .kop-divider {
      margin-top: 3px;
      width: 100%;
    }
    .kop-container .line-thick {
      border: 0;
      border-top: 2.5px solid #000000;
      margin: 0;
    }
    .kop-container .line-gap {
      height: 1.5px;
    }
    .kop-container .line-thin {
      border: 0;
      border-top: 0.8px solid #000000;
      margin: 0;
    }
  `;
}

module.exports = {
  renderKopSurat,
  getKopSuratCss
};

