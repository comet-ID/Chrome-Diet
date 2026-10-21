# Chrome Diet

Extension Chrome untuk menghemat RAM, CPU, dan baterai dengan **menidurkan tab yang lama tidak dipakai**, plus pemantau RAM realtime.

Tab yang "tidur" tidak memakai RAM dan CPU sama sekali, tetapi tetap tampil di tab bar dan otomatis dimuat ulang saat diklik.

## Fitur

- **Tidur otomatis**: tab yang idle selama N menit (5 menit sampai 1 jam) ditidurkan.
- **Pantau RAM realtime**: meter RAM komputer yang update tiap detik, grafik 60 detik terakhir, dan grafik 2 jam terakhir.
- **Perlindungan data**: tab dengan ketikan yang belum tersimpan tidak akan ditidurkan.
- **Tab paling boros**: perkiraan JS heap per tab, bisa langsung ditidurkan atau ditutup.
- **Mode Fokus**: tidurkan semua tab kecuali yang sedang dibuka.
- **Mode hemat baterai**: batas idle lebih pendek saat laptop tidak dicas.
- **Jadwal**: jeda otomatis, atau lebih agresif, pada rentang jam tertentu.
- **Tab duplikat**: deteksi dan tutup tab dengan URL yang sama.
- **Daftar tab tidur**: bangunkan satu per satu, lengkap dengan perkiraan RAM yang dihemat.
- **Whitelist**: per situs dan per grup tab.
- **Ekspor/impor pengaturan** lewat teks JSON.

## Cara pasang (mode developer)

1. Unduh repo ini: klik **Code → Download ZIP**, lalu ekstrak. Atau `git clone`.
2. Buka `chrome://extensions` di Chrome.
3. Aktifkan **Developer mode** (pojok kanan atas).
4. Klik **Load unpacked**, lalu pilih folder yang berisi `manifest.json`.
5. Klik ikon puzzle di toolbar dan **pin** Chrome Diet supaya mudah diakses.

Butuh Chrome 121 atau lebih baru (juga bisa di Edge dan Brave versi Chromium yang setara).

## Cara pakai

**Ringkasan**
- Atas: pemakaian RAM komputer secara live. Bar berubah merah di atas 85%.
- **Tidurkan tab sekarang**: menidurkan semua tab yang tidak aktif, tanpa menunggu batas waktu. Whitelist dan tab pin tetap dihormati.
- **Fokus**: menidurkan semua tab kecuali tab aktif, termasuk tab pin dan whitelist. Tab yang sedang bunyi atau berisi ketikan tetap aman.
- Baris status menunjukkan aturan yang sedang berlaku (normal, mode baterai, atau jadwal).

**Tab**
- *Paling boros*: 8 tab teratas berdasarkan perkiraan JS heap. Tanda ▶ berarti ada video yang sedang diputar.
- *Tab tidur*: klik **Bangunkan** untuk memuat ulang tab tersebut.
- *Tab duplikat*: klik tombol dua kali untuk menutup duplikat. Tab yang dipertahankan adalah tab pin, tab aktif, atau yang terakhir dibuka.

**Pengaturan**
- Batas idle, opsi tab pin dan tab bunyi.
- Mode baterai: batas idle saat tidak dicas.
- Jadwal: pilih jam mulai dan selesai, lalu **Jeda otomatis** atau **Lebih agresif**. Rentang yang melewati tengah malam (misal 22:00 sampai 06:00) didukung.
- Whitelist situs: satu domain per baris. Subdomain ikut tercakup.
- Whitelist grup tab: satu nama grup per baris.
- Cadangan: **Ekspor** mengisi kotak dan menyalin ke clipboard. Untuk **Impor**, tempel JSON lalu klik Impor.

## Privasi

Semua berjalan lokal di browser kamu. Extension ini **tidak mengirim data apa pun** ke server mana pun dan tidak melakukan permintaan jaringan.

| Izin | Alasan |
|---|---|
| `tabs` | Membaca URL, judul, dan waktu terakhir tab dibuka, serta menidurkan tab |
| `alarms` | Pengecekan berkala tiap menit |
| `storage` | Menyimpan pengaturan dan riwayat RAM |
| `system.memory` | Membaca total dan sisa RAM komputer |
| `tabGroups` | Membaca nama grup tab untuk whitelist |
| `offscreen` | Halaman tersembunyi untuk membaca status baterai |

Content script berjalan di halaman http/https hanya untuk mendeteksi apakah ada kolom teks yang terisi (isinya **tidak dibaca atau disimpan**) dan melaporkan ukuran JS heap.

## Batasan

- **RAM per tab tidak bisa dibaca** oleh extension di Chrome stabil. Grafik live adalah RAM seluruh komputer, sedangkan angka per tab hanyalah perkiraan JS heap. Angka "≈ RAM dihemat" juga perkiraan kasar.
- **CPU tidak bisa dibatasi atau dibaca** oleh extension. Menidurkan tab menghentikan penggunaan CPU tab tersebut, tapi tab aktif yang berat tetap perlu ditutup manual (Shift+Esc membuka Task Manager Chrome).
- Deteksi ketikan hanya mencakup halaman utama, bukan form di dalam iframe.
- Tab yang ditidurkan dimuat ulang dari awal. Posisi video atau state yang tidak disimpan situs bisa hilang.
- Halaman `chrome://`, halaman extension, dan Chrome Web Store tidak disentuh.

## Pemecahan masalah

- **Extension tidak muncul / error saat Load unpacked**: pastikan folder yang dipilih langsung berisi `manifest.json`, bukan folder induknya.
- **Tab tidak pernah tidur**: cek apakah situsnya ada di whitelist, tab di-pin, sedang bunyi, atau ada isian form. Cek juga bahwa toggle di pojok kanan atas aktif dan jadwal tidak sedang menjeda.
- **Mode baterai tidak bekerja**: komputer tanpa baterai (desktop) dianggap selalu dicas. Status baterai hanya tersedia di Chrome yang mendukung Battery API.
- **Ingin melihat error**: `chrome://extensions` → kartu Chrome Diet → **Errors**, atau klik **service worker** untuk membuka DevTools.
- Setelah mengedit kode, klik ikon **muat ulang** pada kartu extension.

## Struktur proyek

```
manifest.json     konfigurasi extension (Manifest V3)
shared.js         pengaturan default, dipakai background dan popup
background.js     service worker: sweep, kebijakan, riwayat RAM, baterai
content.js        deteksi form belum tersimpan, laporan JS heap
offscreen.html/js membaca status baterai
popup.html/css/js antarmuka popup
```

## Kontribusi

Issue dan pull request dipersilakan. Sertakan versi Chrome, OS, dan langkah mereproduksi masalah.

## Lisensi

[MIT](LICENSE)
