// ==========================================================================
// Helper Terbilang Bahasa Indonesia
// Mengonversi angka rupiah menjadi kalimat terbilang resmi akuntansi
// ==========================================================================

function terbilang(angka) {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  angka = Math.floor(Math.abs(Number(angka) || 0));
  if (angka === 0) return 'Nol Rupiah';

  function konversi(n) {
    if (n < 12) {
      return bilangan[n];
    } else if (n < 20) {
      return konversi(n - 10) + ' Belas';
    } else if (n < 100) {
      const sisa = n % 10;
      return konversi(Math.floor(n / 10)) + ' Puluh' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    } else if (n < 200) {
      const sisa = n - 100;
      return 'Seratus' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    } else if (n < 1000) {
      const sisa = n % 100;
      return konversi(Math.floor(n / 100)) + ' Ratus' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    } else if (n < 2000) {
      const sisa = n - 1000;
      return 'Seribu' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    } else if (n < 1000000) {
      const sisa = n % 1000;
      return konversi(Math.floor(n / 1000)) + ' Ribu' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    } else if (n < 1000000000) {
      const sisa = n % 1000000;
      return konversi(Math.floor(n / 1000000)) + ' Juta' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    } else if (n < 1000000000000) {
      const sisa = n % 1000000000;
      return konversi(Math.floor(n / 1000000000)) + ' Miliar' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    } else {
      const sisa = n % 1000000000000;
      return konversi(Math.floor(n / 1000000000000)) + ' Triliun' + (sisa !== 0 ? ' ' + konversi(sisa) : '');
    }
  }

  return konversi(angka).replace(/\s+/g, ' ').trim() + ' Rupiah';
}

module.exports = { terbilang };

