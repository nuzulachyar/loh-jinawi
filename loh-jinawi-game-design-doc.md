# Loh Jinawi — Dokumen Desain Game (Draft)

> Simulasi kehidupan & intrik politik-kekuasaan, multiplayer LAN (Node.js), berlatar fiksi sejarah penjajahan dan kemerdekaan sebuah bangsa bernama "Loh Jinawi".

---

## 1. Konsep Inti

**Genre:** Life simulation + political strategy + social deduction
**Platform:** Multiplayer LAN (Node.js + Socket.io, 1 host menjalankan `npm run dev`, pemain lain connect via browser di jaringan WiFi yang sama)
**Penyimpanan:** State utama di memori server (di-backup berkala ke file lokal), tiap client cache datanya sendiri secara lokal (localStorage/IndexedDB) untuk resiliensi koneksi.

**Fokus gameplay:** Bukan cuma simulasi hidup biasa — fokus utama ada di **intrik politik dan perebutan kekuasaan**. Pemain berjalan dari rakyat biasa hingga (berpotensi) puncak kekuasaan negara, melalui jalur ekonomi, sosial, atau bayangan, lalu terjun ke dunia penuh sandera, tukar guling kepentingan, pengkhianatan, dan manuver institusional.

### Core Loop Progresi
```
Rakyat biasa → Pedagang/Pengusaha → Tokoh berpengaruh →
Pemain politik bayangan → Politisi aktif → Lingkaran kekuasaan tinggi → Puncak kekuasaan
```

---

## 2. Latar Sejarah (Backstory Dunia)

Negara fiksi **Loh Jinawi**: kaya sumber daya alam, posisi strategis, jadi rebutan bangsa-bangsa penjelajah dari Barat yang silih berganti menjajahnya lewat kekerasan, ideologi, dan soft power — hingga akhirnya bangkit dan merdeka.

**Garis waktu kepemimpinan pasca-kemerdekaan** (dipakai sebagai struktur "era" dalam game, tiap era punya aturan main kekuasaan berbeda):

1. **Pemimpin pertama** — pahlawan kemerdekaan, penuh intrik politik, akhirnya digulingkan lewat manuver mata-mata asing yang memanfaatkan langkah politiknya sendiri; jasa tokoh-tokoh lain di baliknya sengaja dihapus agar tak ada saingan.
2. **Jenderal "polos"** — awalnya dianggap sederhana, dipakai agenda asing, menandatangani kontrak sumber daya alam jangka puluhan tahun yang minim manfaat bagi negara; lambat laun jadi diktator korup, akhirnya dijatuhkan rakyat.
3. **Wakilnya** — masa transisi singkat, lalu pemilihan oleh parlemen.
4. **Tokoh agama** — kontroversial, cepat dilengserkan secara politik.
5. **Wakilnya, anak dari pemimpin pertama** — melanjutkan hingga habis masa jabatan.
6. **Jenderal kuat** — menang pemilihan langsung, menjabat 2 periode.
7. **Pengusaha, mantan wali kota/gubernur** — menang pemilihan, menjabat 2 periode.
8. **Jenderal kontroversial** — pemimpin terbaru, wakilnya adalah anak dari pendahulunya.

*(Catatan: latar ini masih bisa disempurnakan/ditambah.)*

---

## 3. Sistem Ekonomi Kekuasaan (4 "Mata Uang")

| Sumber Daya | Fungsi |
|---|---|
| **Uang** | Modal bisnis, suap, danai kampanye |
| **Pengaruh / Reputasi publik** | Persepsi masyarakat, bisa direkayasa lewat propaganda/media |
| **Informasi / Kompromat** | Data rahasia, aib, bukti — alat sandera & tukar guling |
| **Loyalitas jaringan** | Orang-orang di bawah kendali pemain — bisa dikorbankan atau berkhianat |

---

## 4. Jalur Masuk Rakyat Biasa ke Jaringan Kekuasaan

### Tahap 0 — Rakyat Biasa
Modal minim, nol pengaruh, nol koneksi. Kerja serabutan/dagang kecil. Tiap interaksi punya kemungkinan kecil membuka relasi baru.

### Tahap 1 — Tiga Jalur Masuk (pemain pilih salah satu sebagai fokus awal)

- **Jalur Ekonomi (Pedagang/Pengusaha):** bisnis kecil → besar → butuh izin/lisensi pejabat lokal → kontak pertama dengan birokrasi.
- **Jalur Sosial (Tokoh Masyarakat):** aktif di komunitas (organisasi warga, tempat ibadah, kelompok tani/nelayan) → reputasi lokal duluan sebelum uang.
- **Jalur Bayangan (Informan/Fixer):** kerja serabutan untuk orang berpengaruh (kurir, mata-mata kecil, calo) → akses informasi cepat, tapi resiko tinggi jadi kambing hitam.

### Tahap 2 — Sistem Patron-Klien (jembatan ke institusi)
Pemain dengan modal/reputasi/informasi cukup didekati atau mendekati seorang **patron** (pejabat menengah, pengusaha besar, tokoh partai, perwira). Patron memberi pekerjaan titipan/proyek/posisi kecil; sebagai gantinya pemain terikat kewajiban loyalitas — dan otomatis mewarisi musuh-musuh patronnya.

### Tahap 3 — Independensi
Setelah cukup kuat, pemain bisa melepas diri dari patron (damai/konflik) dan mulai membangun faksi sendiri atau mencalonkan diri.

**Catatan multiplayer:** Sistem patron bisa diisi NPC kalau tidak ada pemain senior, tapi pemain senior yang ada bisa langsung jadi patron pemain baru — mendorong dinamika rekrutmen antar pemain, bukan cuma rivalitas.

---

## 5. Struktur Data Inti

### 5.1 `Institusi`
```
Institusi {
  id, nama, tipe (penegak_hukum | militer | eksekutif | legislatif | daerah)
  level_hierarki (nasional | provinsi | daerah)
  induk_institusi_id

  pool_pengaruh (0-100)
  otonomi (0-100)
  legitimasi_publik (0-100)

  jalur_pelaporan (langsung_presiden | rumpun_eksekutif | rumpun_legislatif | rumpun_yudikatif)
  butuh_izin_investigasi_dari (null | institusi_id)
  independensi              // DIHITUNG, lihat 6.5

  pemimpin_saat_ini_id
  slot_jabatan[]
}
```

### 5.2 `Karakter` (pemain atau NPC)
```
Karakter {
  id, nama, is_pemain

  jabatan_id, institusi_id

  reputasi_publik (0-100)
  kekuatan_politik           // turunan dari reputasi + jaringan + jabatan
  loyalitas_ke_atasan (0-100)
  otonomi_personal (0-100)
  integritas (0-100)         // resistensi terhadap suap/tekanan; makin tinggi = makin sulit "dibeli"

  backing[]                  // { karakter_id/institusi_id, kekuatan_dukungan, rahasia }
  relasi[]                   // { target_id, tipe, kekuatan }
  kompromat_dimiliki[]
  kompromat_terhadap[]       // mungkin tidak semuanya diketahui karakter ybs
}
```

### 5.3 `Relasi` (graph jaringan, entitas terpisah agar bisa di-query)
```
Relasi {
  id, karakter_a_id, karakter_b_id
  tipe (keluarga | besan | sahabat | patron_klien | rival | aliansi_politik)
  kekuatan (0-100)
  rahasia (true/false)
  sejak_era
}
```

### 5.4 `Kompromat`
```
Kompromat {
  id, tipe, target
  kekuatan_bukti (0-100)      // untuk kompromat palsu: kekuatan semu + skor kerapuhan tersembunyi
  kepemilikan[]                // bisa dimiliki lebih dari satu pihak
  kadaluarsa
  asli (true/false)
}
```

### 5.5 `SlotJabatan`
```
SlotJabatan {
  id, institusi_id, nama_posisi, pemegang_saat_ini_id
  proses_pengisian (penunjukan_langsung | fit_and_proper_test | pemilihan_internal)
  pihak_penentu[]

  kandidat_diajukan[] {
    karakter_id, pengaju_id
    afiliasi_tersembunyi       // institusi rival asal kandidat sebenarnya, jika ada capture
    proyeksi_dampak            // warning flag ke pengambil keputusan
  }
}
```

### 5.6 `DealNegosiasi`
```
DealNegosiasi {
  id, inisiator_id
  pihak_terlibat[]             // { karakter_id, peran: pengaju | penerima | perantara }
  syarat[], imbalan[]
  status (diajukan | disepakati | dibatalkan | dikhianati)
  efek_berjenjang[]             // pihak ketiga yang kena dampak walau tak terlibat langsung
}
```

---

## 6. Mekanik & Formula

### 6.1 Efektivitas Sandera
```
hitung_efektivitas_sandera(kompromat, target):
    kekuatan_bukti = kompromat.kekuatan_bukti
    resiko_balik = f(apakah target tahu identitas investigator)
    backing_defensif_target = total kekuatan_politik dari backing target YANG SADAR ancaman ini
                               (backing rahasia yang belum expose tidak otomatis membantu)
    → makin rendah backing_defensif_target yang sadar, makin tinggi efektivitas sandera
```

### 6.2 Biaya Pencopotan Pejabat
```
hitung_biaya_pencopotan(pelaku, target):
    kekuatan_backing_target = Σ(kekuatan Relasi backing × kekuatan_politik pemberi backing)
    resiko_balas_dendam = f(kompromat_terhadap[pelaku] yang dipegang target/backing-nya)
    dampak_opini_publik = f(legitimasi_publik institusi target, reputasi_publik target,
                             ada/tidaknya alasan formal sah)

    total_biaya = kekuatan_backing_target + resiko_balas_dendam + dampak_opini_publik

    jika total_biaya > kekuatan_politik(pelaku) → GAGAL / beresiko tinggi
    jika lebih kecil → berhasil, tapi backing target jadi rival aktif (efek residual)
```

### 6.3 Terbongkarnya Backing Rahasia
```
expose_backing_rahasia(investigator, relasi_target):
    kekuatan_investigasi = kekuatan_politik(investigator) + akses_jaringan(investigator)
    kekuatan_penyamaran = kekuatan(relasi) × (2 jika rahasia=true, else 1)
    peluang_terbongkar = kekuatan_investigasi / (kekuatan_investigasi + kekuatan_penyamaran)

    trigger: saat counter_investigasi() dijalankan, ATAU saat relasi dipakai dalam DealNegosiasi
    jika terbongkar: relasi.rahasia → false; pihak pengungkap dapat kompromat baru otomatis
```

### 6.4 Resolusi Karakter Terpojok
Ketika karakter (terutama perantara berstatus rendah) jadi sasaran serangan balik:
```
opsi 1 — BERTAHAN: pakai sisa kompromat/backing; menang → reputasi naik drastis (underdog effect)
opsi 2 — KABUR: keluar dari institusi/jaringan, kembali dekat ke titik nol, tapi bisa_kembali_nanti = true
opsi 3 — BERKHIANAT: bocorkan info soal patron sebagai tumbal → loyalitas_ke_atasan = 0,
          relasi patron_klien putus/jadi rival, dapat backing baru dari penyerang
```

### 6.5 Independensi Institusi
```
hitung_independensi(institusi):
    base = 100 jika jalur_pelaporan == langsung_presiden, else 60
    penalti = 40 jika butuh_izin_investigasi_dari != null
    return base − penalti
```
Independensi bisa dilemahkan diam-diam (mengubah jalur_pelaporan / menambah kewajiban izin) tanpa perlu membubarkan institusinya — pola pelemahan struktural yang lebih realistis daripada penghapusan terang-terangan.

### 6.6 Purge Institusi (Pembersihan Personel)
```
purge_institusi(institusi, penyerang, kriteria):
    target = karakter di institusi dengan integritas > ambang_batas
             DAN loyalitas_ke_atasan_lama > loyalitas_ke_penyerang
    aksi: mutasi | pemecatan (dalih administratif) | serangan_karakter (kompromat lama/daur ulang)

    efek: otonomi institusi turun sedikit tiap purge (kehilangan personel kompeten),
          kontrol penyerang naik (% slot_jabatan kunci yang diisi loyalisnya)

    selesai jika: >50% slot kunci diisi orang dengan loyalitas_ke_penyerang > loyalitas_ke_pimpinan_lama
```

### 6.7 Capture Kepemimpinan & Efek "Bocor Duluan"
```
modifier_investigasi(institusi_investigator, target):
    jika pemimpin institusi_investigator punya afiliasi_tersembunyi == institusi_pelindung(target):
        peluang_bocor_ke_target = tinggi (~70%)
        efek: target dapat peringatan dini sebelum investigasi resmi selesai
```
Begitu "orang dalam" duduk di kursi tertinggi sebuah institusi pengawas, setiap kasus yang menyangkut institusi asalnya otomatis bocor secara sistemik — tanpa perlu drama tambahan tiap kali.

### 6.8 Daur Ulang Kompromat & Efek Kumulatif
```
hitung_efek_kumulatif(list_kompromat, jangka_waktu):
    dampak_reputasi = Σ(kekuatan_bukti tiap kompromat) × faktor_intensitas_waktu
    // serangan yang rapat waktunya (beruntun) berefek lebih besar dibanding
    // tersebar lama, meski total kekuatan bukti sama
```
Menangkap pola serangan bertubi-tubi: gabungan kasus lama, fitnah, dan tekanan personel yang efeknya menumpuk — bukan satu skandal besar tunggal.

### 6.9 Opini Publik Otomatis (NPC), termasuk Kompromat Palsu
Dihitung otomatis oleh sistem (tanpa perlu vote pemain lain — penting untuk LAN dengan pemain terbatas), berdasarkan:
- Kekuatan bukti (asli/semu)
- Reputasi awal target (buffer lebih besar untuk tokoh lama dipercaya)
- Reputasi awal penuduh (tuduhan dari track record buruk otomatis didiskon)
- Konteks era (represif vs demokratis mengubah besar efek)
- Decay dampak seiring waktu tanpa tuduhan susulan

**Kompromat palsu** boleh dibuat pemain, dengan resiko tinggi kalau ketahuan:
- Kekuatan bukti semu di permukaan, skor kerapuhan tersembunyi di baliknya
- Peluang investigasi balik tiap kali dipakai/dibongkar
- Jika ketahuan palsu: reputasi pemfitnah hancur lebih parah dari kegagalan normal, target dapat bonus simpati publik, penyebar ikut kena getah (lebih kecil)

---

## 7. Sistem "Pensiun Aman" (Exit Strategy bagi Pihak yang Kalah)

Paket lengkap penyelamatan pejabat yang terpojok:
1. **Syarat:** lepas jabatan/kekuasaan formal (jadi rakyat biasa)
2. **Yang dipertahankan:** nama baik (reputasi dibersihkan) & harta (aset aman)
3. **Harga yang dibayar penyelamat:** mencarikan kambing hitam yang cukup meyakinkan sebagai "pemilik barang bukti"
4. **Hasil:** kasus dianggap selesai oleh publik/sistem hukum, dalang asli lolos bersih

---

## 8. Skenario Uji (Validasi Skema)

### 8.1 Kontrak Tambang & Menteri ESDM
Pemain (klien) diminta patronnya (anggota parlemen) menyelidiki menteri ESDM terkait fee dari perusahaan tambang asing. Kompromat didapat → dipakai tekan menteri mundur dari perundingan kontrak → menteri lapor diam-diam ke presiden → backing rahasia dari tambang asing diaktifkan untuk balas → sistem mengarahkan serangan balik ke pihak `kekuatan_politik` terendah dalam rantai (si pemain/perantara).

**Validasi:** backing rahasia menciptakan fog of war; perantara lemah jadi sasaran empuk secara otomatis; efektivitas kompromat bergantung kesadaran target akan ancaman, bukan cuma angka bukti mentah.

### 8.2 KPK vs Polisi (Pelemahan Institusional)
Lembaga anti-korupsi independen (`jalur_pelaporan: langsung_presiden`) mengusut kasus yang menyeret institusi kepolisian → dibalas dengan serangan bertubi (kasus lama, pembunuhan karakter, pencopotan pimpinan) → institusi penyerang menyatukan kekuatan untuk **capture kepemimpinan** (menyusupkan orang institusi lain jadi pemimpin lembaga tersebut) → lembaga direstrukturisasi masuk rumpun eksekutif dengan kewajiban lapor/izin sebelum bertindak → penyidik berintegritas tinggi di-purge.

**Validasi:** butuh lapisan tambahan di luar skema individu — perubahan `jalur_pelaporan`/`independensi`, `purge_institusi`, `capture kepemimpinan` dengan `afiliasi_tersembunyi`, dan `daur_ulang_kompromat` untuk serangan beruntun. Ini kategori gameplay terpisah: **melumpuhkan institusi dari dalam**, bukan sekadar menjatuhkan satu individu.

---

## 9. Arsitektur Teknis (Rencana Awal)

- **Server:** Node.js + Express + Socket.io — 1 host jalankan `npm run dev`, jadi source of truth state dunia
- **Client:** Browser (HTML/JS, atau framework ringan) connect via IP lokal host di jaringan WiFi yang sama
- **Penyimpanan server:** in-memory saat game berjalan, backup berkala ke file JSON lokal (opsi lanjut: SQLite/lowdb untuk persistensi lebih baik)
- **Penyimpanan client:** localStorage/IndexedDB untuk cache data pemain sendiri, agar tahan terhadap refresh/putus koneksi sesaat

---

## 10. Bagian yang Belum Dibahas / Masih Terbuka

- Struktur era & timeline secara mekanik (aturan main tiap era pemerintahan)
- Skenario tambahan dari institusi lain (militer, otonomi daerah, dll — sudah disebut, belum diuji)
- Detail UI/UX cara pemain berinteraksi dengan sistem ini (dashboard? chat-based? board-game style?)
- Kondisi kemenangan/akhir permainan
- Keseimbangan (balancing) angka-angka formula di atas — masih butuh playtesting

