# Loh Jinawi

Simulasi rakyat, bisnis, dan intrik kekuasaan — multiplayer LAN, dibangun dengan Node.js + Socket.io.

## Cara menjalankan (host / pemegang source code)

```bash
npm install
npm run dev
```

Terminal akan menampilkan sesuatu seperti:

```
Loh Jinawi server jalan di port 3000
Buka di komputer ini: http://localhost:3000
Pemain lain di jaringan yang sama buka: http://<IP-lokal-kamu>:3000
```

Cari IP lokal komputer host dengan:
- Windows: `ipconfig` (lihat "IPv4 Address")
- Mac/Linux: `ifconfig` atau `ip addr`

## Cara pemain lain bergabung

Pastikan semua device terhubung ke WiFi/jaringan yang sama, lalu buka browser ke:

```
http://<IP-host>:3000
```

Tidak perlu internet — cukup satu jaringan lokal.

## Cara main

1. Di layar awal, masukkan nama lalu klik **"Mulai sebagai rakyat biasa"** — atau ambil alih salah satu NPC yang tersedia di daftar (kalau mau langsung main sebagai tokoh berpengaruh).
2. Layar utama menampilkan:
   - **Panel kiri**: statusmu (uang, reputasi, kekuatan politik, integritas) dan daftar semua tokoh di dunia.
   - **Tengah**: peta jaringan relasi (graph). Node biru = kamu, pink = pemain lain, hijau = NPC. Garis merah = rival, garis putus-putus = relasi yang masih rahasia.
   - **Kanan**: log peristiwa dunia secara real-time.
3. Klik tokoh mana pun (di daftar atau di graph) untuk membuka aksi:
   - **Investigasi** — coba gali kompromat (butuh uang, ada peluang gagal)
   - **Buat fitnah** — bikin kompromat palsu (resiko lebih tinggi kalau ketahuan)
   - **Ajukan deal** — negosiasi syarat & imbalan dengan tokoh lain
   - Kalau kamu sudah punya kompromat tentang tokoh itu, muncul opsi **Sandera**, **Bongkar**, atau **Simpan**.

## Penyimpanan data

- Server menyimpan seluruh state dunia ke `data/state.json` setiap 20 detik dan saat dimatikan (Ctrl+C) — jadi progres tidak hilang kalau host restart.
- Untuk mulai dunia baru dari nol, hapus file `data/state.json` sebelum `npm run dev`.

## Yang sudah diimplementasikan

- Struktur data penuh: Karakter, Institusi, Relasi, Kompromat, SlotJabatan, DealNegosiasi
- Formula: kekuatan politik, efektivitas sandera, dampak opini publik, independensi institusi
- Aksi: investigasi, buat fitnah (kompromat palsu + resiko ketahuan), pakai kompromat (sandera/bongkar/simpan), ajukan & respon deal, ajukan & putuskan suksesi jabatan
- Dunia awal berisi 8 tokoh NPC (presiden, kapolri, jaksa agung, menhan, ketua KPK, gubernur, anggota parlemen, dan satu backing rahasia dari "konsorsium tambang asing") dengan jaringan relasi termasuk satu relasi rahasia
- Tick berkala yang meluruhkan reputasi menuju netral dan menghitung ulang kekuatan politik semua tokoh

## Yang belum diimplementasikan (lihat dokumen desain untuk detail lengkap)

- Purge institusi & capture kepemimpinan (afiliasi_tersembunyi)
- Biaya pencopotan pejabat (`hitung_biaya_pencopotan`) sebagai gate otomatis sebelum pemecatan
- Resolusi karakter terpojok (bertahan/kabur/berkhianat)
- Struktur era & timeline dengan aturan berbeda tiap era
- Sistem ekonomi/bisnis untuk jalur pedagang-pengusaha
- Sistem patron-klien sebagai onboarding formal untuk rakyat biasa
- Kondisi kemenangan/akhir permainan

Ini adalah fondasi yang sudah bisa dimainkan dan diuji end-to-end — pengembangan berikutnya tinggal menambah modul di atas kerangka `logic.js` yang sudah ada, mengikuti pola fungsi yang sudah dipakai (baca state, mutasi, `pushLog`, kembalikan `{ok, message}`).
