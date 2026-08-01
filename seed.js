// seed.js — Kondisi awal dunia "Loh Jinawi"


function buildSeed() {
  const state = {
    era: "era_transisi",          // era_diktator | era_transisi | era_reformasi | era_pengusaha | era_jenderal_baru
    eraLabel: "Era Transisi Demokrasi",
    eraTick: 0,                   // jumlah tick dalam era ini
    eraRules: {
      represif: false,            // jika true, dampak kompromat x1.5
      pemilihan_langsung: true,   // jika false, jabatan hanya via penunjukan
      pers_bebas: true,           // jika true, skandal menyebar lebih cepat
    },
    characters: {},
    institutions: {},
    relations: {},
    kompromat: {},
    slotJabatan: {},
    deals: {},
    log: [],
    notifikasi: {},               // charId -> [{ tipe, pesan, ts }]
  };

  const char = (id, nama, extra = {}) => {
    state.characters[id] = {
      id,
      nama,
      is_pemain: false,
      playerId: null,
      jabatan_id: null,
      institusi_id: null,
      jalurMasuk: null,           // ekonomi | sosial | bayangan
      reputasi_publik: 50,
      kekuatan_politik: 20,
      loyalitas_ke_atasan: 60,
      otonomi_personal: 30,
      integritas: 50,
      uang: 100,
      kompromat_dimiliki: [],
      kompromat_terhadap: [],
      afiliasiTersembunyi: null,  // institusi_id jika ada capture
      riwayatEra: [],
      status: "aktif",            // aktif | pensiun | kabur | dipenjara
      ...extra,
    };
  };

  // ─── NPC Inti ───────────────────────────────────────────────────────────────
  char("K_PRESIDEN",    "Presiden Sutrisno",              { reputasi_publik: 65, integritas: 52, uang: 600, kekuatan_politik: 75, institusi_id: "I_EKSEKUTIF", loyalitas_ke_atasan: 90, otonomi_personal: 80 });
  char("K_WAPRES",      "Wapres Darma Atmaja",            { reputasi_publik: 58, integritas: 48, uang: 350, kekuatan_politik: 55, institusi_id: "I_EKSEKUTIF", loyalitas_ke_atasan: 75 });
  char("K_KAPOLRI",     "Jenderal Bambang (Kapolri)",     { reputasi_publik: 46, integritas: 32, uang: 400, kekuatan_politik: 60, institusi_id: "I_POLISI",    otonomi_personal: 70 });
  char("K_JAKSA",       "Jaksa Agung Herlina",            { reputasi_publik: 52, integritas: 62, uang: 280, kekuatan_politik: 45, institusi_id: "I_KEJAKSAAN" });
  char("K_MENHAN",      "Menhan Letjen Sofyan",           { reputasi_publik: 60, integritas: 42, uang: 450, kekuatan_politik: 58, institusi_id: "I_PERTAHANAN", otonomi_personal: 65 });
  char("K_KETUA_KPK",   "Ketua KPK Yusuf",               { reputasi_publik: 72, integritas: 88, uang: 160, kekuatan_politik: 50, institusi_id: "I_KPK",       loyalitas_ke_atasan: 40, otonomi_personal: 85 });
  char("K_GUBERNUR",    "Gubernur Ratna",                 { reputasi_publik: 57, integritas: 52, uang: 380, kekuatan_politik: 42, institusi_id: "I_DAERAH" });
  char("K_PATRON",      "H. Burhan (Ketua Fraksi)",       { reputasi_publik: 50, integritas: 38, uang: 320, kekuatan_politik: 48, institusi_id: "I_PARLEMEN" });
  char("K_PANGLIMA",    "Panglima TNI Hendro",            { reputasi_publik: 62, integritas: 45, uang: 500, kekuatan_politik: 65, institusi_id: "I_MILITER",   otonomi_personal: 75 });
  char("K_HAKIM_AGUNG", "Ketua Mahkamah Agung Suhendra", { reputasi_publik: 68, integritas: 70, uang: 200, kekuatan_politik: 40, institusi_id: "I_PENGADILAN", loyalitas_ke_atasan: 55 });
  char("K_PIMRED",      "Pemimpin Redaksi Koran Merdeka", { reputasi_publik: 55, integritas: 65, uang: 180, kekuatan_politik: 35, institusi_id: "I_MEDIA" });
  char("K_TAIPAN",      "Taipan Hendra Kurniawan",        { reputasi_publik: 45, integritas: 25, uang: 1200, kekuatan_politik: 55, institusi_id: "I_BISNIS",   jalurMasuk: "ekonomi" });
  char("K_KIAI",        "Kiai Marzuki Rahmat",            { reputasi_publik: 78, integritas: 80, uang: 90,  kekuatan_politik: 45, institusi_id: null,          jalurMasuk: "sosial" });
  char("K_INDUSTRI_ASING", "Konsorsium Tambang Internasional", { reputasi_publik: 20, integritas: 15, uang: 1800, kekuatan_politik: 40 });
  char("K_INTEL",       "Kepala BIN Rahmat Haryono",     { reputasi_publik: 38, integritas: 30, uang: 350, kekuatan_politik: 55, institusi_id: "I_INTELIJEN",  otonomi_personal: 90 });

  // ─── Institusi ──────────────────────────────────────────────────────────────
  state.institutions.I_EKSEKUTIF = {
    id: "I_EKSEKUTIF", nama: "Kepresidenan", tipe: "eksekutif", level: "nasional",
    pool_pengaruh: 90, otonomi: 100, legitimasi_publik: 62,
    jalur_pelaporan: "langsung_presiden", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_PRESIDEN", induk_institusi_id: null,
  };
  state.institutions.I_POLISI = {
    id: "I_POLISI", nama: "Kepolisian Negara", tipe: "penegak_hukum", level: "nasional",
    pool_pengaruh: 72, otonomi: 55, legitimasi_publik: 44,
    jalur_pelaporan: "rumpun_eksekutif", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_KAPOLRI", induk_institusi_id: "I_EKSEKUTIF",
  };
  state.institutions.I_KEJAKSAAN = {
    id: "I_KEJAKSAAN", nama: "Kejaksaan Agung", tipe: "penegak_hukum", level: "nasional",
    pool_pengaruh: 60, otonomi: 45, legitimasi_publik: 50,
    jalur_pelaporan: "rumpun_eksekutif", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_JAKSA", induk_institusi_id: "I_EKSEKUTIF",
  };
  state.institutions.I_PERTAHANAN = {
    id: "I_PERTAHANAN", nama: "Kementerian Pertahanan", tipe: "eksekutif", level: "nasional",
    pool_pengaruh: 65, otonomi: 42, legitimasi_publik: 55,
    jalur_pelaporan: "rumpun_eksekutif", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_MENHAN", induk_institusi_id: "I_EKSEKUTIF",
  };
  state.institutions.I_KPK = {
    id: "I_KPK", nama: "Komisi Pemberantasan Korupsi", tipe: "penegak_hukum", level: "nasional",
    pool_pengaruh: 55, otonomi: 100, legitimasi_publik: 76,
    jalur_pelaporan: "langsung_presiden", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_KETUA_KPK", induk_institusi_id: null,
  };
  state.institutions.I_DAERAH = {
    id: "I_DAERAH", nama: "Pemerintah Provinsi Selatan", tipe: "daerah", level: "provinsi",
    pool_pengaruh: 50, otonomi: 62, legitimasi_publik: 55,
    jalur_pelaporan: "rumpun_eksekutif", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_GUBERNUR", induk_institusi_id: "I_EKSEKUTIF",
  };
  state.institutions.I_PARLEMEN = {
    id: "I_PARLEMEN", nama: "Dewan Perwakilan Rakyat", tipe: "legislatif", level: "nasional",
    pool_pengaruh: 62, otonomi: 88, legitimasi_publik: 40,
    jalur_pelaporan: "langsung_presiden", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: null, induk_institusi_id: null,
  };
  state.institutions.I_MILITER = {
    id: "I_MILITER", nama: "Tentara Nasional Loh Jinawi", tipe: "militer", level: "nasional",
    pool_pengaruh: 80, otonomi: 70, legitimasi_publik: 60,
    jalur_pelaporan: "rumpun_eksekutif", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_PANGLIMA", induk_institusi_id: "I_PERTAHANAN",
  };
  state.institutions.I_PENGADILAN = {
    id: "I_PENGADILAN", nama: "Mahkamah Agung", tipe: "yudikatif", level: "nasional",
    pool_pengaruh: 50, otonomi: 80, legitimasi_publik: 65,
    jalur_pelaporan: "rumpun_yudikatif", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_HAKIM_AGUNG", induk_institusi_id: null,
  };
  state.institutions.I_MEDIA = {
    id: "I_MEDIA", nama: "Konsorsium Media Nasional", tipe: "media", level: "nasional",
    pool_pengaruh: 55, otonomi: 75, legitimasi_publik: 58,
    jalur_pelaporan: "langsung_presiden", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_PIMRED", induk_institusi_id: null,
  };
  state.institutions.I_BISNIS = {
    id: "I_BISNIS", nama: "Kamar Dagang & Industri", tipe: "swasta", level: "nasional",
    pool_pengaruh: 60, otonomi: 90, legitimasi_publik: 42,
    jalur_pelaporan: "langsung_presiden", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_TAIPAN", induk_institusi_id: null,
  };
  state.institutions.I_INTELIJEN = {
    id: "I_INTELIJEN", nama: "Badan Intelijen Negara", tipe: "penegak_hukum", level: "nasional",
    pool_pengaruh: 70, otonomi: 85, legitimasi_publik: 35,
    jalur_pelaporan: "langsung_presiden", butuh_izin_investigasi_dari: null,
    pemimpin_saat_ini_id: "K_INTEL", induk_institusi_id: null,
  };

  // Assign jabatan_id berdasarkan institusi_id
  Object.values(state.characters).forEach((c) => {
    c.jabatan_id = c.institusi_id ? `J_${c.institusi_id}` : null;
  });

  // ─── Slot Jabatan ────────────────────────────────────────────────────────────
  const slot = (id, institusi_id, nama_posisi, pemegang, proses, penentu) => {
    state.slotJabatan[id] = {
      id, institusi_id, nama_posisi,
      pemegang_saat_ini_id: pemegang,
      proses_pengisian: proses,
      pihak_penentu: penentu,
      kandidat_diajukan: [],
    };
  };

  slot("J_I_EKSEKUTIF",  "I_EKSEKUTIF",  "Presiden Loh Jinawi",             "K_PRESIDEN",    "pemilihan_langsung",   ["publik"]);
  slot("J_I_POLISI",     "I_POLISI",     "Kepala Kepolisian Negara",         "K_KAPOLRI",     "penunjukan_langsung",  ["K_PRESIDEN"]);
  slot("J_I_KEJAKSAAN",  "I_KEJAKSAAN",  "Jaksa Agung",                      "K_JAKSA",       "penunjukan_langsung",  ["K_PRESIDEN"]);
  slot("J_I_PERTAHANAN", "I_PERTAHANAN", "Menteri Pertahanan",               "K_MENHAN",      "penunjukan_langsung",  ["K_PRESIDEN"]);
  slot("J_I_KPK",        "I_KPK",        "Ketua Komisi Pemberantasan Korupsi","K_KETUA_KPK",  "fit_and_proper_test",  ["K_PRESIDEN", "K_PATRON"]);
  slot("J_I_DAERAH",     "I_DAERAH",     "Gubernur Provinsi Selatan",        "K_GUBERNUR",    "pemilihan_langsung",   ["publik"]);
  slot("J_I_MILITER",    "I_MILITER",    "Panglima TNI",                     "K_PANGLIMA",    "penunjukan_langsung",  ["K_PRESIDEN"]);
  slot("J_I_PENGADILAN", "I_PENGADILAN", "Ketua Mahkamah Agung",             "K_HAKIM_AGUNG", "fit_and_proper_test",  ["K_PATRON"]);
  slot("J_I_INTELIJEN",  "I_INTELIJEN",  "Kepala BIN",                       "K_INTEL",       "penunjukan_langsung",  ["K_PRESIDEN"]);

  // ─── Relasi Awal ─────────────────────────────────────────────────────────────
  const rel = (a, b, tipe, kekuatan, rahasia = false) => {
    const id = `R_${a}_${b}`;
    state.relations[id] = { id, a, b, tipe, kekuatan, rahasia, sejakEra: "era_diktator" };
  };

  // Relasi terbuka
  rel("K_KAPOLRI",    "K_GUBERNUR",    "besan",           65);
  rel("K_JAKSA",      "K_MENHAN",      "sahabat",         58);
  rel("K_MENHAN",     "K_PRESIDEN",    "sahabat",         72);
  rel("K_KAPOLRI",    "K_PRESIDEN",    "aliansi_politik", 32);
  rel("K_PRESIDEN",   "K_WAPRES",      "patron_klien",    80);
  rel("K_PATRON",     "K_PRESIDEN",    "rival",           25);
  rel("K_PANGLIMA",   "K_PRESIDEN",    "aliansi_politik", 60);
  rel("K_PANGLIMA",   "K_MENHAN",      "patron_klien",    55);
  rel("K_KIAI",       "K_GUBERNUR",    "sahabat",         45);
  rel("K_TAIPAN",     "K_PATRON",      "patron_klien",    50);
  rel("K_HAKIM_AGUNG","K_JAKSA",       "sahabat",         40);
  rel("K_INTEL",      "K_PRESIDEN",    "patron_klien",    70);

  // Relasi rahasia
  rel("K_JAKSA",      "K_INDUSTRI_ASING", "patron_klien", 55, true);  // backing rahasia
  rel("K_KAPOLRI",    "K_TAIPAN",         "patron_klien", 45, true);  // backing rahasia
  rel("K_MENHAN",     "K_INDUSTRI_ASING", "aliansi_politik", 40, true);
  rel("K_INTEL",      "K_KAPOLRI",        "sahabat",      60, true);

  // ─── Kompromat Awal ───────────────────────────────────────────────────────────
  // Beberapa kompromat yang sudah ada di dunia tapi belum diketahui pemain
  const km = (id, tipe, target, kekuatan, kepemilikan = [], asli = true) => {
    state.kompromat[id] = {
      id, tipe, target, kekuatan_bukti: kekuatan,
      kepemilikan, asli, kadaluarsa: null, dibuat: Date.now(),
    };
    if (state.characters[target]) state.characters[target].kompromat_terhadap.push(id);
    kepemilikan.forEach((ownerId) => {
      if (state.characters[ownerId]) state.characters[ownerId].kompromat_dimiliki.push(id);
    });
  };

  km("KM_KAPOLRI_001", "transaksi_ilegal",      "K_KAPOLRI",  65, ["K_KETUA_KPK"]);
  km("KM_JAKSA_001",   "relasi_tersembunyi",    "K_JAKSA",    55, ["K_INTEL"]);
  km("KM_TAIPAN_001",  "penyalahgunaan_wewenang","K_TAIPAN",  50, ["K_PATRON"]);
  km("KM_MENHAN_001",  "transaksi_ilegal",      "K_MENHAN",   48, ["K_KETUA_KPK"]);

  // ─── Log Awal ─────────────────────────────────────────────────────────────────
  state.log.push({ ts: Date.now() - 60000, text: "Era Transisi Demokrasi dimulai. Rakyat penuh harapan." });
  state.log.push({ ts: Date.now() - 30000, text: "Ketua KPK Yusuf mengumumkan penyelidikan baru." });
  state.log.push({ ts: Date.now() - 10000, text: "Taipan Hendra terlihat menemui H. Burhan secara diam-diam." });

  return state;
}

module.exports = { buildSeed };
