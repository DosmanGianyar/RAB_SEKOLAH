const {
  createPengajuan,
  reviewProposalByBendahara,
  decisionProposalByKepsek,
  getPengajuanById
} = require('../src/db');

try {
  console.log('--- 1. Membuat RAB Baru Diajukan (Belum Disetujui) ---');
  const proposalBaru = createPengajuan({
    user_id: 1, // I Putu Darma Putra, S.Pd
    pos_anggaran_id: 215, // Penegak Tamu (Pagu Rp 5.000.000)
    nama_kegiatan: 'Latihan Dasar Kepemimpinan Siswa (LDKS) OSIS & MPK',
    latar_belakang: 'Membangun karakter kepemimpinan, integritas, dan manajemen organisasi bagi pengurus OSIS & MPK masa bakti 2026/2027.',
    tanggal_mulai: '2026-11-20',
    tanggal_selesai: '2026-11-22',
    items: [
      {
        kategori: 'Perlengkapan',
        deskripsi: 'Spanduk Panggung & Banner Selamat Datang',
        volume: 2,
        satuan: 'Buah',
        harga_satuan: 150000
      },
      {
        kategori: 'Konsumsi',
        deskripsi: 'Snack Box Pembukaan untuk Guru & Pembina',
        volume: 30,
        satuan: 'Kotak',
        harga_satuan: 15000
      },
      {
        kategori: 'ATK & Bahan',
        deskripsi: 'Buku Panduan Materi & Lanyard ID Card Peserta',
        volume: 45,
        satuan: 'Paket',
        harga_satuan: 20000
      }
    ]
  });
  console.log(`✓ Berhasil dibuat: [${proposalBaru.nomor_surat_ajuan}] ${proposalBaru.nama_kegiatan}`);
  console.log(`  Status: ${proposalBaru.status} | Total: Rp ${proposalBaru.total_dana_diajukan.toLocaleString('id-ID')}\n`);

  console.log('--- 2. Membuat RAB yang Sudah Disetujui Pimpinan ---');
  const proposalDisetujui = createPengajuan({
    user_id: 1, // I Putu Darma Putra, S.Pd
    pos_anggaran_id: 211, // Konsumsi Pemilihan paket mapel (Pagu Rp 7.280.000)
    nama_kegiatan: 'Pembinaan Intensif Olimpiade Sains Nasional (OSN) 2026',
    latar_belakang: 'Persiapan bimbingan teknis dan bedah modul materi OSN tingkat Kabupaten Gianyar dan Provinsi Bali.',
    tanggal_mulai: '2026-11-15',
    tanggal_selesai: '2026-11-17',
    items: [
      {
        kategori: 'Jasa & Honor',
        deskripsi: 'Honor Narasumber Ahli / Dosen Pembimbing OSN',
        volume: 2,
        satuan: 'Sesi',
        harga_satuan: 500000
      },
      {
        kategori: 'Penggandaan',
        deskripsi: 'Penggandaan Modul Soal & Lembar Kerja Analisis',
        volume: 25,
        satuan: 'Eksemplar',
        harga_satuan: 30000
      },
      {
        kategori: 'Konsumsi',
        deskripsi: 'Konsumsi Siang Siswa & Guru Pendamping (3 Hari)',
        volume: 45,
        satuan: 'Kotak',
        harga_satuan: 20000
      }
    ]
  });
  console.log(`✓ Dibuat: [${proposalDisetujui.nomor_surat_ajuan}] ${proposalDisetujui.nama_kegiatan}`);
  console.log(`  Status Awal: ${proposalDisetujui.status} | Total: Rp ${proposalDisetujui.total_dana_diajukan.toLocaleString('id-ID')}`);

  // Langkah Verifikasi Bendahara (User id 2: Ni Luh Made Sari, S.E.)
  console.log('  -> Menjalankan verifikasi telaah Bendahara...');
  const reviewedByBendahara = reviewProposalByBendahara({
    proposal_id: proposalDisetujui.id,
    user_id: 2,
    tindakan: 'APPROVE',
    catatan_bendahara: 'Item belanja dan standar harga telah diverifikasi sesuai SBM 2026. Diteruskan ke Kepala Sekolah.',
    items_koreksi: proposalDisetujui.items.map(it => ({
      item_id: it.id,
      volume_disetujui: it.volume_ajuan,
      harga_satuan_disetujui: it.harga_satuan_ajuan,
      catatan_koreksi: 'Sesuai SBM'
    }))
  });
  console.log(`  -> Status setelah Bendahara: ${reviewedByBendahara.status}`);

  // Langkah Otorisasi Kepala Sekolah (User id 3: Dr. I Wayan Sudiarta, M.Pd)
  console.log('  -> Menjalankan otorisasi & disposisi Kepala Sekolah...');
  decisionProposalByKepsek({
    proposal_id: proposalDisetujui.id,
    user_id: 3,
    tindakan: 'APPROVE',
    catatan_kepsek: 'Disetujui untuk dilaksanakan dengan tertib administrasi dan penuh tanggung jawab.'
  });

  const finalProposal = getPengajuanById(proposalDisetujui.id);
  console.log(`✓ Status Akhir: ${finalProposal.status}`);
  console.log(`  Total Disetujui: Rp ${finalProposal.total_dana_disetujui.toLocaleString('id-ID')}`);
  console.log(`  QR Verifikasi: ${finalProposal.kode_verifikasi_qr}`);
  console.log('\nSEMUA DATA DUMMY BERHASIL DIBUAT DENGAN SEMPURNA!');
} catch (err) {
  console.error('Error seeding dummy proposals:', err.message);
  process.exit(1);
}

