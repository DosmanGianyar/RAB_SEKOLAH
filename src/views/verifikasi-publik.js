// ==========================================================================
// Halaman Verifikasi Publik Keabsahan Dokumen Digital Ber-QR Code
// SMA NEGERI 1 GIANYAR (DOSMAN)
// ==========================================================================

const { terbilang } = require('../utils/terbilang');

function formatRupiah(val) {
  const num = Number(val) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

function renderVerifikasiPublik({ proposal, isValid }) {
  if (!isValid || !proposal) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Gagal - Dokumen Tidak Ditemukan</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      margin: 0;
    }
    .card {
      background: #ffffff;
      border: 1px solid #fecdd3;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px rgba(225, 29, 72, 0.08);
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #fff1f2;
      color: #e11d48;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin-bottom: 16px;
    }
    h2 { font-size: 1.25rem; font-weight: 800; color: #9f1239; margin-bottom: 8px; }
    p { font-size: 0.9rem; color: #64748b; line-height: 1.5; margin-bottom: 20px; }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h2>Dokumen Tidak Ditemukan / Tidak Valid</h2>
    <p>Kode verifikasi yang dipindai tidak terdaftar pada sistem basis data E-RAB SMA Negeri 1 Gianyar. Mohon pastikan kode QR berasal dari dokumen resmi yang sah.</p>
    <a href="/" class="btn">Kembali ke Beranda</a>
  </div>
</body>
</html>`;
  }

  const totalAngka = proposal.total_dana_disetujui || proposal.total_dana_diajukan || 0;
  const totalKalimat = terbilang(totalAngka);

  let statusBadge = `
    <span class="badge-status badge-success">
      <span class="dot"></span>
      DOKUMEN ASLI & DISETUJUI RESMI
    </span>
  `;

  if (proposal.status === 'DICAIRKAN') {
    statusBadge = `
      <span class="badge-status badge-info">
        <span class="dot"></span>
        DOKUMEN SAH • DANA TELAH DICAIRKAN
      </span>
    `;
  } else if (proposal.status === 'SELESAI') {
    statusBadge = `
      <span class="badge-status badge-purple">
        <span class="dot"></span>
        SELESAI & LPJ TERVERIFIKASI
      </span>
    `;
  }

  // Audit trail items
  const auditHtml = (proposal.audit_logs || []).map(log => `
    <div class="timeline-step">
      <div class="timeline-dot"></div>
      <div class="timeline-body">
        <div class="timeline-time">${log.waktu_dibuat}</div>
        <div class="timeline-text">${log.aktivitas}</div>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Keabsahan Dokumen - SMA Negeri 1 Gianyar</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background: #f8fafc;
      color: #334155;
      min-height: 100vh;
      padding: 24px 16px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .verify-container {
      max-width: 620px;
      width: 100%;
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }
    .header-banner {
      background: linear-gradient(135deg, #1e3a8a, #2563eb);
      color: #ffffff;
      padding: 24px 20px;
      text-align: center;
    }
    .school-title {
      font-size: 0.75rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #bfdbfe;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .main-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .subtitle {
      font-size: 0.8rem;
      color: #dbeafe;
      margin-top: 4px;
    }

    .badge-wrap {
      text-align: center;
      padding: 20px 20px 10px;
    }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge-success {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge-info {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    .badge-purple {
      background: #f5f3ff;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .content-body {
      padding: 16px 24px 24px;
    }

    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .info-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.35;
      margin-bottom: 4px;
    }

    .info-meta {
      font-size: 0.82rem;
      color: #64748b;
    }

    .grid-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      font-size: 0.82rem;
    }

    .grid-item .label {
      color: #64748b;
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .grid-item .val {
      color: #0f172a;
      font-weight: 700;
    }

    .amount-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 16px;
      text-align: center;
    }
    .amount-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
    }
    .amount-num {
      font-family: 'Outfit', sans-serif;
      font-size: 1.75rem;
      font-weight: 800;
      color: #1e3a8a;
      margin: 4px 0;
    }
    .amount-words {
      font-size: 0.82rem;
      font-style: italic;
      color: #334155;
      font-weight: 600;
    }

    .audit-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .audit-title {
      font-size: 0.85rem;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .timeline-step {
      position: relative;
      padding-left: 18px;
      padding-bottom: 14px;
      border-left: 2px solid #e2e8f0;
    }
    .timeline-step:last-child {
      border-left: 2px solid transparent;
      padding-bottom: 0;
    }
    .timeline-dot {
      position: absolute;
      left: -6px;
      top: 2px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #2563eb;
    }
    .timeline-time {
      font-size: 0.7rem;
      color: #94a3b8;
      font-weight: 600;
    }
    .timeline-text {
      font-size: 0.8rem;
      color: #1e293b;
      margin-top: 2px;
      line-height: 1.4;
    }

    .actions {
      display: flex;
      gap: 10px;
    }
    .btn {
      flex: 1;
      padding: 12px;
      border-radius: 10px;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    .btn-print {
      background: #2563eb;
      color: #fff;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .btn-home {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-home:hover {
      background: #e2e8f0;
    }

    .footer-note {
      text-align: center;
      font-size: 0.72rem;
      color: #94a3b8;
      margin-top: 16px;
    }
  </style>
</head>
<body>

  <div class="verify-container">
    <div class="header-banner">
      <div class="school-title">SMA Negeri 1 Gianyar (Dosman)</div>
      <div class="main-title">Verifikasi Dokumen Digital</div>
      <div class="subtitle">Sistem Informasi Pengelolaan Anggaran & Realisasi Kas Sekolah</div>
    </div>

    <div class="badge-wrap">
      ${statusBadge}
    </div>

    <div class="content-body">
      <div class="info-card">
        <div class="info-title">${proposal.nama_kegiatan}</div>
        <div class="info-meta">Nomor Surat: <strong>${proposal.nomor_surat_ajuan}</strong></div>

        <div class="grid-details">
          <div class="grid-item">
            <div class="label">Pemohon Usulan</div>
            <div class="val">${proposal.pemohon_nama}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${proposal.pemohon_unit}</div>
          </div>
          <div class="grid-item">
            <div class="label">Pos Anggaran Beban</div>
            <div class="val">${proposal.nama_pos}</div>
            <div style="font-size: 0.75rem; color: #64748b;">T.A. ${proposal.tahun_ajaran}</div>
          </div>
          <div class="grid-item">
            <div class="label">Waktu Pelaksanaan</div>
            <div class="val">${proposal.tanggal_mulai || '-'} s/d ${proposal.tanggal_selesai || '-'}</div>
          </div>
          <div class="grid-item">
            <div class="label">Kode QR Keabsahan</div>
            <div class="val" style="font-family: monospace; color: #2563eb;">${proposal.kode_verifikasi_qr}</div>
          </div>
        </div>
      </div>

      <div class="amount-box">
        <div class="amount-label">Total Dana Resmi Disetujui</div>
        <div class="amount-num">${formatRupiah(totalAngka)}</div>
        <div class="amount-words"># ${totalKalimat} #</div>
      </div>

      <!-- Riwayat Otorisasi -->
      <div class="audit-box">
        <div class="audit-title">Jejak Otorisasi & Pembukuan Kas</div>
        <div class="timeline-container">
          ${auditHtml || '<div style="font-size:0.8rem; color:#94a3b8;">Belum ada catatan riwayat.</div>'}
        </div>
      </div>

      <div class="actions">
        <a href="/cetak/${proposal.id}" class="btn btn-print" target="_blank">
          🖨️ Buka Lembar Disposisi Resmi
        </a>
        <a href="/" class="btn btn-home">
          Beranda E-RAB
        </a>
      </div>

      <div class="footer-note">
        Verifikasi resmi dikeluarkan oleh Unit Keuangan & TIK SMA Negeri 1 Gianyar.<br>
        Dokumen ini sah secara elektronik sesuai ketentuan administrasi sekolah.
      </div>
    </div>
  </div>

</body>
</html>`;
}

module.exports = { renderVerifikasiPublik };
