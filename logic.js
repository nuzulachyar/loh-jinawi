// logic.js — Inti mekanik game Loh Jinawi (versi lengkap)
// Semua fungsi bekerja langsung di atas `state` (mutasi in-place) dan
// mengembalikan { ok, message, log } supaya server tinggal broadcast.

let uid = 1;
function nextId(prefix) {
  return `${prefix}${(uid++).toString().padStart(4, "0")}`;
}

function pushLog(state, text, kategori = "normal") {
  state.log.unshift({ ts: Date.now(), text, kategori });
  state.log = state.log.slice(0, 200);
}

function pushNotif(state, charId, tipe, pesan) {
  if (!state.notifikasi) state.notifikasi = {};
  if (!state.notifikasi[charId]) state.notifikasi[charId] = [];
  state.notifikasi[charId].unshift({ tipe, pesan, ts: Date.now(), dibaca: false });
  state.notifikasi[charId] = state.notifikasi[charId].slice(0, 20);
}

// ─── Formula Turunan ───────────────────────────────────────────────────────────

function kekuatanPolitik(state, charId) {
  const c = state.characters[charId];
  if (!c) return 0;
  let backingTotal = 0;
  for (const rid of relasiOf(state, charId)) {
    const r = state.relations[rid];
    if (["patron_klien", "aliansi_politik", "keluarga", "besan", "sahabat"].includes(r.tipe)) {
      const otherId = r.a === charId ? r.b : r.a;
      const other = state.characters[otherId];
      if (!other) continue;
      const otherPower = other.reputasi_publik * 0.2 + (other.jabatan_bonus || 0);
      backingTotal += (r.kekuatan / 100) * otherPower;
    }
  }
  const jabatanBonus = c.jabatan_id ? 25 : 0;
  const institusiBonus = getInstitusiPowerBonus(state, charId);
  return Math.round(c.reputasi_publik * 0.3 + backingTotal * 0.5 + jabatanBonus + institusiBonus + c.integritas * 0.05);
}

function getInstitusiPowerBonus(state, charId) {
  const c = state.characters[charId];
  if (!c || !c.institusi_id) return 0;
  const inst = state.institutions[c.institusi_id];
  if (!inst) return 0;
  // Bonus dari pool_pengaruh institusi
  return Math.round(inst.pool_pengaruh * 0.15);
}

function relasiOf(state, charId) {
  return Object.values(state.relations)
    .filter((r) => r.a === charId || r.b === charId)
    .map((r) => r.id);
}

function backingDefensif(state, charId, hanyaSadar = true) {
  let total = 0;
  for (const rid of relasiOf(state, charId)) {
    const r = state.relations[rid];
    if (hanyaSadar && r.rahasia) continue;
    const otherId = r.a === charId ? r.b : r.a;
    total += (r.kekuatan / 100) * kekuatanPolitik(state, otherId);
  }
  return Math.round(total);
}

function hitungEfektivitasSandera(state, kompromatId, targetId) {
  const km = state.kompromat[kompromatId];
  if (!km) return 0;
  const defensif = backingDefensif(state, targetId, true);
  const raw = km.kekuatan_bukti - defensif * 0.4;
  return Math.max(5, Math.min(95, Math.round(50 + raw)));
}

function hitungDampakOpini(state, kompromatId, targetId, penuduhId) {
  const km = state.kompromat[kompromatId];
  const target = state.characters[targetId];
  const penuduh = state.characters[penuduhId];
  const era = state.eraRules || {};
  const bufferTarget = target.reputasi_publik * 0.3;
  const diskonPenuduh = penuduh.reputasi_publik < 30 ? 0.5 : 1;
  let dampak = (km.kekuatan_bukti - bufferTarget) * diskonPenuduh * 0.4;
  if (!km.asli) dampak *= 0.6;
  if (era.represif) dampak *= 0.6;           // rezim represif meredam efek berita
  if (era.pers_bebas) dampak *= 1.5;         // pers bebas amplifikasi efek (jauh lebih mematikan)
  return Math.round(Math.max(1, dampak));
}

function triggerSeranganBalik(state, penyerangId, targetId) {
  const target = state.characters[targetId];
  if (!target) return;
  // Cari backing yang kuat
  const listBacking = relasiOf(state, targetId).map(id => state.relations[id]).filter(r => 
    r && (r.a === targetId || r.b === targetId) && 
    (r.tipe === "patron_klien" || r.tipe === "aliansi_politik") && 
    (!r.rahasia)
  );

  for (const rel of listBacking) {
    const backerId = rel.a === targetId ? rel.b : rel.a;
    const backer = state.characters[backerId];
    if (!backer || backerId === penyerangId) continue;

    // Peluang serangan balik
    if (Math.random() < 0.3 + (rel.kekuatan / 200)) {
      const penyerang = state.characters[penyerangId];
      if (penyerang) {
        // Jika pers_bebas, serangan balik (fitnah balasan) juga diamplifikasi
        const dmg = state.eraRules?.pers_bebas ? 25 : 15;
        penyerang.reputasi_publik = Math.max(0, penyerang.reputasi_publik - dmg);
        pushLog(state, `[RETALIASI] ${backer.nama} membalas serangan yang diarahkan ke ${target.nama}, menghantam reputasi ${penyerang.nama}!`, "skandal");
        if (penyerang.playerId) {
          pushNotif(state, penyerangId, "serangan_balik", `${backer.nama} membalas dendam atas tindakanmu pada ${target.nama}! Reputasimu hancur.`);
        }
      }
      break;
    }
  }
}

// ─── Efek Kumulatif Kompromat (GDD §6.8) ─────────────────────────────────────

function hitungEfekKumulatif(listKompromat, jangkaWaktu = 86400000) {
  const now = Date.now();
  const recent = listKompromat.filter((k) => now - k.dibuat < jangkaWaktu);
  const totalKekuatan = recent.reduce((s, k) => s + k.kekuatan_bukti, 0);
  const faktorkerapatan = recent.length >= 3 ? 1.5 : recent.length === 2 ? 1.2 : 1;
  return Math.round(totalKekuatan * faktorkerapatan);
}

function hitungIndependensi(inst) {
  let base = inst.jalur_pelaporan === "langsung_presiden" ? 100 : 60;
  if (inst.butuh_izin_investigasi_dari) base -= 40;
  return Math.max(0, base);
}

// ─── Biaya Pencopotan (GDD §6.2) ─────────────────────────────────────────────

function hitungBiayaPencopotan(state, pelakuId, targetId) {
  const target = state.characters[targetId];
  const pelaku = state.characters[pelakuId];
  if (!target || !pelaku) return { biaya: 999, resikoBalas: 0, dampakOpini: 0 };

  const backingTarget = backingDefensif(state, targetId, false);
  const inst = target.institusi_id ? state.institutions[target.institusi_id] : null;
  const dampakOpini = inst ? Math.round(inst.legitimasi_publik * 0.3 + target.reputasi_publik * 0.2) : 10;

  // Resiko balas dari kompromat yang dipegang target/backing-nya terhadap pelaku
  const kompromatPelaku = target.kompromat_dimiliki
    .map((id) => state.kompromat[id])
    .filter((k) => k && k.target === pelakuId);
  const resikoBalas = kompromatPelaku.reduce((s, k) => s + k.kekuatan_bukti, 0) * 0.5;

  return {
    biaya: Math.round(backingTarget + resikoBalas + dampakOpini),
    resikoBalas: Math.round(resikoBalas),
    dampakOpini: Math.round(dampakOpini),
    kekuatanPelaku: kekuatanPolitik(state, pelakuId),
    bisa: kekuatanPolitik(state, pelakuId) > backingTarget + resikoBalas,
  };
}

// ─── Expose Backing Rahasia (GDD §6.3) ───────────────────────────────────────

function exposeBackingRahasia(state, investigatorId, targetId) {
  const investigator = state.characters[investigatorId];
  if (!investigator) return false;
  const kekuatanInvestigasi = kekuatanPolitik(state, investigatorId) + investigator.integritas * 0.2;
  let terekspose = [];

  for (const rid of relasiOf(state, targetId)) {
    const r = state.relations[rid];
    if (!r.rahasia) continue;
    const kekuatanSamaran = r.kekuatan * 2;
    const peluang = kekuatanInvestigasi / (kekuatanInvestigasi + kekuatanSamaran);
    if (Math.random() < peluang) {
      r.rahasia = false;
      terekspose.push(r);
      // Investigator dapat kompromat baru
      const kmId = nextId("KM");
      const otherId = r.a === targetId ? r.b : r.a;
      state.kompromat[kmId] = {
        id: kmId, tipe: "relasi_tersembunyi",
        target: targetId, kekuatan_bukti: Math.round(r.kekuatan * 0.8),
        kepemilikan: [investigatorId], asli: true, kadaluarsa: null, dibuat: Date.now(),
      };
      if (!investigator.kompromat_dimiliki.includes(kmId)) investigator.kompromat_dimiliki.push(kmId);
      const targetChar = state.characters[targetId];
      if (targetChar && !targetChar.kompromat_terhadap.includes(kmId)) targetChar.kompromat_terhadap.push(kmId);
      pushLog(state, `[INTEL] Relasi tersembunyi ${state.characters[targetId]?.nama} dengan ${state.characters[otherId]?.nama} terbongkar!`, "skandal");
    }
  }
  return terekspose.length > 0;
}

// ─── Aksi: Investigasi ────────────────────────────────────────────────────────

function actionInvestigasi(state, actorId, targetId) {
  const actor = state.characters[actorId];
  const target = state.characters[targetId];
  if (!actor || !target) return { ok: false, message: "Karakter tidak ditemukan" };
  if (actor.uang < 15) return { ok: false, message: "Uang tidak cukup (butuh 15)" };
  actor.uang -= 15;

  // Cek bocor duluan (GDD §6.7 — capture kepemimpinan)
  if (target.institusi_id) {
    const instTarget = state.institutions[target.institusi_id];
    if (instTarget) {
      const pimpinanInst = state.characters[instTarget.pemimpin_saat_ini_id];
      if (pimpinanInst?.afiliasiTersembunyi === target.institusi_id) {
        if (Math.random() < 0.65) {
          pushLog(state, `[BOCOR] ${target.nama} mendapat peringatan dini tentang penyelidikan terhadapnya!`, "skandal");
          pushNotif(state, targetId, "bocor", `Seseorang sedang menyelidikimu! Waspadai investigasi.`);
        }
      }
    }
  }

  const skillInvestigator = kekuatanPolitik(state, actorId) + actor.integritas * 0.2;
  const peluangSukses = Math.min(90, 30 + skillInvestigator * 0.6);
  const sukses = Math.random() * 100 < peluangSukses;

  // Peluang expose backing rahasia
  exposeBackingRahasia(state, actorId, targetId);

  if (!sukses) {
    pushLog(state, `${actor.nama} gagal menggali informasi tentang ${target.nama}.`);
    return { ok: true, message: "Investigasi gagal, tidak ditemukan bukti kali ini." };
  }

  const kekuatanBukti = Math.max(20, Math.min(90, Math.round(30 + Math.random() * 50 - target.integritas * 0.2)));
  const id = nextId("KM");
  state.kompromat[id] = {
    id, tipe: pilihAcak(["transaksi_ilegal", "penyalahgunaan_wewenang", "skandal_pribadi", "relasi_tersembunyi"]),
    target: targetId, kekuatan_bukti: kekuatanBukti,
    kepemilikan: [actorId], asli: true, kadaluarsa: null, dibuat: Date.now(),
  };
  actor.kompromat_dimiliki.push(id);
  target.kompromat_terhadap.push(id);

  pushLog(state, `${actor.nama} mengumpulkan bukti tentang ${target.nama} (kekuatan ${kekuatanBukti}).`, "normal");
  return { ok: true, message: `Investigasi berhasil! Kekuatan bukti: ${kekuatanBukti}`, kompromatId: id };
}

// ─── Aksi: Buat Kompromat Palsu ───────────────────────────────────────────────

function actionFitnah(state, actorId, targetId) {
  const actor = state.characters[actorId];
  const target = state.characters[targetId];
  if (!actor || !target) return { ok: false, message: "Karakter tidak ditemukan" };
  if (actor.uang < 25) return { ok: false, message: "Uang tidak cukup (butuh 25)" };
  actor.uang -= 25;

  const kekuatanSemu = Math.round(40 + Math.random() * 40);
  const id = nextId("KM");
  state.kompromat[id] = {
    id, tipe: "fitnah", target: targetId,
    kekuatan_bukti: kekuatanSemu, kepemilikan: [actorId],
    asli: false, kerapuhan: Math.round(30 + Math.random() * 50),
    kadaluarsa: null, dibuat: Date.now(),
  };
  actor.kompromat_dimiliki.push(id);
  target.kompromat_terhadap.push(id);
  pushLog(state, `${actor.nama} meracik tuduhan gelap terhadap ${target.nama}.`, "normal");
  return { ok: true, message: "Kompromat palsu dibuat. Ingat: risiko ketahuan tetap ada.", kompromatId: id };
}

// ─── Aksi: Pakai Kompromat ────────────────────────────────────────────────────

function actionPakaiKompromat(state, actorId, kompromatId, mode, tuntutan) {
  const km = state.kompromat[kompromatId];
  if (!km) return { ok: false, message: "Kompromat tidak ditemukan" };
  if (!km.kepemilikan.includes(actorId)) return { ok: false, message: "Kamu tidak memiliki kompromat ini" };

  const actor = state.characters[actorId];
  const target = state.characters[km.target];

  if (mode === "sandera") {
    const efektivitas = hitungEfektivitasSandera(state, kompromatId, km.target);
    const berhasil = Math.random() * 100 < efektivitas;
    hapusKompromat(state, kompromatId);
    if (berhasil) {
      pushLog(state, `${actor.nama} berhasil menyandera ${target.nama}: "${tuntutan || "tuntutan tidak disebutkan"}"`, "skandal");
      target.loyalitas_ke_atasan = Math.max(0, target.loyalitas_ke_atasan - 15);
      pushNotif(state, km.target, "sandera", `${actor.nama} mengancammu dengan bukti! Tuntutan: "${tuntutan || '-'}"`);
      return { ok: true, message: `Sandera berhasil (${efektivitas}%). ${target.nama} terpaksa tunduk.` };
    } else {
      pushLog(state, `${target.nama} melawan balik upaya sandera ${actor.nama}!`, "skandal");
      actor.reputasi_publik = Math.max(0, actor.reputasi_publik - 10);
      pushNotif(state, km.target, "serangan_balik", `Upaya sandera dari ${actor.nama} gagal — kamu berhasil melawan!`);
      triggerSeranganBalik(state, actorId, km.target);
      return { ok: true, message: `Sandera gagal (${efektivitas}%). Target melawan, reputasimu turun.` };
    }
  }

  if (mode === "bongkar") {
    const dampak = hitungDampakOpini(state, kompromatId, km.target, actorId);
    target.reputasi_publik = clamp(target.reputasi_publik - dampak, 0, 100);

    // Efek kumulatif jika ada banyak kompromat terhadap target belakangan ini
    const kmTargetRecent = target.kompromat_terhadap.map((id) => state.kompromat[id]).filter(Boolean);
    const efekKumulatif = hitungEfekKumulatif(kmTargetRecent, 3600000); // 1 jam terakhir
    if (efekKumulatif > 100) {
      target.reputasi_publik = clamp(target.reputasi_publik - 5, 0, 100);
      pushLog(state, `[GELOMBANG] Serangan bertubi terhadap ${target.nama} menciptakan efek domino opini publik!`, "skandal");
    }

    if (!km.asli) {
      const terbongkarPalsu = Math.random() * 100 < km.kerapuhan;
      if (terbongkarPalsu) {
        actor.reputasi_publik = clamp(actor.reputasi_publik - dampak * 2, 0, 100);
        target.reputasi_publik = clamp(target.reputasi_publik + dampak * 0.5, 0, 100);
        pushLog(state, `FITNAH TERBONGKAR! Tuduhan ${actor.nama} terhadap ${target.nama} terbukti rekayasa. ${actor.nama} hancur.`, "skandal");
        hapusKompromat(state, kompromatId);
        return { ok: true, message: `Fitnah terbongkar! Reputasimu jatuh drastis, ${target.nama} dapat simpati publik.` };
      }
    }

    pushLog(state, `${actor.nama} membongkar skandal ${target.nama} ke publik. Reputasi ${target.nama} turun ${dampak} poin.`, "skandal");
    hapusKompromat(state, kompromatId);
    triggerSeranganBalik(state, actorId, km.target);
    return { ok: true, message: `Skandal dibongkar. Reputasi ${target.nama} turun ${dampak} poin.` };
  }

  if (mode === "simpan") {
    return { ok: true, message: "Kompromat disimpan sebagai asuransi jangka panjang." };
  }

  return { ok: false, message: "Mode tidak dikenal" };
}

// ─── Aksi: Purge Institusi (GDD §6.6) ────────────────────────────────────────

function actionPurgeInstitusi(state, penyerangId, institusiId, ambangIntegritas = 55, ambangLoyalitas = 50) {
  const penyerang = state.characters[penyerangId];
  const inst = state.institutions[institusiId];
  if (!inst) return { ok: false, message: "Institusi tidak ditemukan" };
  if (!penyerang) return { ok: false, message: "Karakter tidak ditemukan" };

  const kekuatanPenyerang = kekuatanPolitik(state, penyerangId);
  if (kekuatanPenyerang < 40) return { ok: false, message: "Kekuatan politikmu tidak cukup untuk melakukan purge institusi." };

  // Target purge: anggota institusi dengan integritas tinggi ATAU loyalitas rendah ke penyerang
  const targetPurge = Object.values(state.characters).filter((c) =>
    c.institusi_id === institusiId &&
    c.id !== penyerangId &&
    (c.integritas > ambangIntegritas || c.loyalitas_ke_atasan < ambangLoyalitas)
  );

  if (targetPurge.length === 0) {
    return { ok: false, message: "Tidak ada target yang memenuhi kriteria purge di institusi ini." };
  }

  // Purge salah satu target (pilih yang paling lemah)
  const target = targetPurge.sort((a, b) => kekuatanPolitik(state, a.id) - kekuatanPolitik(state, b.id))[0];
  const metodePurge = pilihAcak(["mutasi", "pemecatan_administratif", "serangan_karakter"]);

  if (metodePurge === "serangan_karakter") {
    // Gunakan kompromat lama jika ada, atau buat tuduhan baru
    const kmExisting = target.kompromat_terhadap.find((id) => state.kompromat[id]);
    if (kmExisting) {
      const km = state.kompromat[kmExisting];
      target.reputasi_publik = clamp(target.reputasi_publik - km.kekuatan_bukti * 0.4, 0, 100);
      pushLog(state, `[PURGE] ${penyerang.nama} menggunakan bukti lama untuk menyerang ${target.nama}. Kompromat didaur ulang!`, "skandal");
    }
  }

  // Kurangi otonomi institusi, naikkan kendali penyerang
  inst.otonomi = Math.max(0, inst.otonomi - 8);
  target.jabatan_id = null;
  target.institusi_id = null;
  target.reputasi_publik = Math.max(0, target.reputasi_publik - 10);

  // Kurangi uang penyerang sebagai biaya operasi
  if (penyerang.uang < 30) return { ok: false, message: "Uang tidak cukup untuk operasi purge (butuh 30)" };
  penyerang.uang -= 30;

  pushLog(state, `[PURGE] ${penyerang.nama} berhasil menyingkirkan ${target.nama} dari ${inst.nama} via ${metodePurge.replace("_", " ")}.`, "skandal");
  return {
    ok: true,
    message: `${target.nama} berhasil disingkirkan dari ${inst.nama} (metode: ${metodePurge.replace(/_/g, " ")}). Otonomi institusi turun.`,
    targetId: target.id,
    metode: metodePurge,
  };
}

// ─── Aksi: Capture Kepemimpinan (GDD §6.7) ───────────────────────────────────

function actionCaptureKepemimpinan(state, penyerangId, institusiId, kandidatId) {
  const inst = state.institutions[institusiId];
  const penyerang = state.characters[penyerangId];
  const kandidat = state.characters[kandidatId];
  if (!inst || !penyerang || !kandidat) return { ok: false, message: "Data tidak ditemukan" };

  const kekuatanPenyerang = kekuatanPolitik(state, penyerangId);
  if (kekuatanPenyerang < 50) return { ok: false, message: "Kekuatan politik tidak cukup untuk capture kepemimpinan." };
  if (penyerang.uang < 80) return { ok: false, message: "Butuh dana 80 untuk operasi capture kepemimpinan." };
  penyerang.uang -= 80;

  const pemimpinLama = inst.pemimpin_saat_ini_id;
  inst.pemimpin_saat_ini_id = kandidatId;
  kandidat.jabatan_id = `J_${institusiId}`;
  const afiliasiSebelumnya = kandidat.institusi_id;
  kandidat.institusi_id = institusiId;
  kandidat.afiliasiTersembunyi = afiliasiSebelumnya || penyerang.institusi_id || null;

  if (pemimpinLama && state.characters[pemimpinLama]) {
    state.characters[pemimpinLama].jabatan_id = null;
    // Mantan pemimpin jadi rival potensial
    upsertRelasi(state, pemimpinLama, penyerangId, "rival", 50, false);
  }

  pushLog(state, `[CAPTURE] ${penyerang.nama} berhasil menempatkan ${kandidat.nama} sebagai pimpinan ${inst.nama}. Institusi kini di bawah pengaruh tersembunyi!`, "skandal");
  return {
    ok: true,
    message: `${kandidat.nama} kini memimpin ${inst.nama}. Pemimpin lama tersingkir. Institusi di bawah pengaruhmu — setiap investigasi dari sana bisa bocor ke pihak terkait.`,
  };
}

// ─── Aksi: Lemahkan Institusi (GDD §6.5) ─────────────────────────────────────

function actionLemahkanInstitusi(state, actorId, institusiId, cara) {
  const actor = state.characters[actorId];
  const inst = state.institutions[institusiId];
  if (!actor || !inst) return { ok: false, message: "Data tidak ditemukan" };

  const kekuatan = kekuatanPolitik(state, actorId);
  if (kekuatan < 35) return { ok: false, message: "Kekuatan politikmu tidak cukup untuk memanipulasi institusi." };
  if (actor.uang < 50) return { ok: false, message: "Butuh dana 50 untuk operasi pelemahan institusional." };
  actor.uang -= 50;

  if (cara === "ubah_jalur") {
    // Ubah jalur pelaporan dari langsung_presiden ke rumpun_eksekutif (kurangi independensi)
    if (inst.jalur_pelaporan === "langsung_presiden") {
      inst.jalur_pelaporan = "rumpun_eksekutif";
      inst.otonomi = Math.max(0, inst.otonomi - 20);
      pushLog(state, `[STRUKTURAL] ${actor.nama} secara diam-diam mengubah jalur pelaporan ${inst.nama} — independensinya melemah.`, "skandal");
      return { ok: true, message: `Jalur pelaporan ${inst.nama} berhasil diubah. Independensinya turun signifikan.` };
    }
    return { ok: false, message: "Institusi ini tidak memiliki jalur langsung presiden untuk diubah." };
  }

  if (cara === "tambah_izin") {
    // Tambah kewajiban izin investigasi (makin dipersulit)
    if (!inst.butuh_izin_investigasi_dari) {
      inst.butuh_izin_investigasi_dari = "I_EKSEKUTIF";
      inst.otonomi = Math.max(0, inst.otonomi - 25);
      pushLog(state, `[STRUKTURAL] ${actor.nama} berhasil menambahkan kewajiban izin untuk setiap investigasi ${inst.nama}. Geraknya kini terbatas.`, "skandal");
      return { ok: true, message: `${inst.nama} kini harus minta izin eksekutif sebelum bertindak. Otonominya terkunci.` };
    }
    return { ok: false, message: "Institusi ini sudah terikat kewajiban izin." };
  }

  return { ok: false, message: "Cara tidak dikenal. Gunakan: ubah_jalur atau tambah_izin" };
}

// ─── Aksi: Pensiun Aman (GDD §7) ─────────────────────────────────────────────

function actionPensiunAman(state, penyelamatId, targetId, kambingHitamId) {
  const penyelamat = state.characters[penyelamatId];
  const target = state.characters[targetId];
  const kambingHitam = state.characters[kambingHitamId];
  if (!penyelamat || !target) return { ok: false, message: "Karakter tidak ditemukan" };
  if (!kambingHitam) return { ok: false, message: "Kambing hitam tidak ditemukan" };
  if (penyelamat.uang < 100) return { ok: false, message: "Butuh dana 100 untuk paket pensiun aman." };
  penyelamat.uang -= 100;

  // Lepas jabatan
  const jabatanLama = target.jabatan_id;
  if (jabatanLama && state.slotJabatan[jabatanLama]) {
    state.slotJabatan[jabatanLama].pemegang_saat_ini_id = null;
  }
  target.jabatan_id = null;
  target.institusi_id = null;
  target.status = "pensiun";

  // Bersihkan reputasi — kasus dialihkan ke kambing hitam
  const bonus = Math.round(10 + Math.random() * 20);
  target.reputasi_publik = Math.min(100, target.reputasi_publik + bonus);
  kambingHitam.reputasi_publik = Math.max(0, kambingHitam.reputasi_publik - 30);

  // Hapus kompromat terhadap target (dianggap selesai)
  const kmDihapus = [...target.kompromat_terhadap];
  kmDihapus.forEach((id) => hapusKompromat(state, id));

  pushLog(state, `[PENSIUN AMAN] ${penyelamat.nama} membantu ${target.nama} mundur bersih. ${kambingHitam.nama} jadi kambing hitam skandal.`, "skandal");
  return {
    ok: true,
    message: `${target.nama} berhasil pensiun aman. Namanya dibersihkan, ${kambingHitam.nama} menanggung beban skandal. Semua pihak diam.`,
  };
}

// ─── Aksi: Respons Karakter Terpojok (GDD §6.4) ──────────────────────────────

function actionResponTerpojok(state, charId, opsi) {
  const c = state.characters[charId];
  if (!c) return { ok: false, message: "Karakter tidak ditemukan" };

  if (opsi === "bertahan") {
    const backing = backingDefensif(state, charId, false);
    if (backing > 30) {
      c.reputasi_publik = Math.min(100, c.reputasi_publik + 15);
      c.kekuatan_politik = kekuatanPolitik(state, charId);
      pushLog(state, `[UNDERDOG] ${c.nama} melawan balik dan bertahan! Backing aktif. Reputasinya naik.`, "normal");
      return { ok: true, message: `Kamu bertahan! Backing-mu membantumu. Reputasi naik 15 poin.` };
    } else {
      c.reputasi_publik = Math.max(0, c.reputasi_publik - 10);
      return { ok: true, message: `Bertahan tapi backing lemah. Reputasi turun 10 poin.` };
    }
  }

  if (opsi === "kabur") {
    const jabatanLama = c.jabatan_id;
    if (jabatanLama && state.slotJabatan[jabatanLama]) {
      state.slotJabatan[jabatanLama].pemegang_saat_ini_id = null;
    }
    c.jabatan_id = null;
    c.institusi_id = null;
    c.status = "kabur";
    c.bisaKembali = true;
    c.reputasi_publik = Math.max(0, c.reputasi_publik - 5);
    pushLog(state, `${c.nama} memilih mundur dan kabur dari situasi. Tapi bisa kembali nanti.`, "normal");
    return { ok: true, message: `Kamu mundur dan menarik diri. Kehilangan jabatan, tapi bisa bangkit kembali.` };
  }

  if (opsi === "berkhianat") {
    // Bocorkan info patron
    const patronRelasi = Object.values(state.relations).find(
      (r) => (r.a === charId || r.b === charId) && r.tipe === "patron_klien"
    );
    if (!patronRelasi) return { ok: false, message: "Tidak ada patron yang bisa dikhianati." };
    const patronId = patronRelasi.a === charId ? patronRelasi.b : patronRelasi.a;
    const patron = state.characters[patronId];

    // Buat kompromat tentang patron
    const kmId = nextId("KM");
    state.kompromat[kmId] = {
      id: kmId, tipe: "relasi_tersembunyi", target: patronId,
      kekuatan_bukti: Math.round(40 + Math.random() * 30),
      kepemilikan: [charId], asli: true, kadaluarsa: null, dibuat: Date.now(),
    };
    c.kompromat_dimiliki.push(kmId);
    patron.kompromat_terhadap.push(kmId);

    // Putus relasi patron
    delete state.relations[patronRelasi.id];
    c.loyalitas_ke_atasan = 0;
    upsertRelasi(state, charId, patronId, "rival", 60, false);

    pushLog(state, `[PENGKHIANATAN] ${c.nama} membelot dan membocorkan info tentang ${patron.nama}! Patron jadi musuh baru.`, "skandal");
    return {
      ok: true,
      message: `Kamu mengkhianati patronmu! Relasi terputus, ${patron.nama} jadi musuhmu. Tapi kamu kini punya kompromat tentangnya.`,
      kompromatId: kmId,
    };
  }

  return { ok: false, message: "Opsi tidak dikenal: bertahan | kabur | berkhianat" };
}

// ─── Aksi: Deal ───────────────────────────────────────────────────────────────

function actionAjukanDeal(state, inisiatorId, penerimaId, syarat, imbalan) {
  const inisiator = state.characters[inisiatorId];
  const penerima = state.characters[penerimaId];
  if (!inisiator || !penerima) return { ok: false, message: "Karakter tidak ditemukan" };

  const id = nextId("D");
  state.deals[id] = {
    id, inisiator_id: inisiatorId, penerima_id: penerimaId,
    syarat, imbalan, status: "diajukan", dibuat: Date.now(),
  };
  pushNotif(state, penerimaId, "deal_masuk", `${inisiator.nama} mengajukan deal: Syarat: "${syarat}" | Imbalan: "${imbalan}"`);
  pushLog(state, `${inisiator.nama} mengajukan tawaran deal kepada ${penerima.nama}.`, "normal");
  return { ok: true, message: "Deal diajukan. Menunggu respons.", dealId: id };
}

function actionResponDeal(state, dealId, respon) {
  const deal = state.deals[dealId];
  if (!deal) return { ok: false, message: "Deal tidak ditemukan" };
  if (deal.status !== "diajukan") return { ok: false, message: "Deal sudah direspons sebelumnya." };
  deal.status = respon === "setuju" ? "disepakati" : "ditolak";

  const a = state.characters[deal.inisiator_id];
  const b = state.characters[deal.penerima_id];
  if (respon === "setuju") {
    upsertRelasi(state, deal.inisiator_id, deal.penerima_id, "aliansi_politik", 40, false);
    pushNotif(state, deal.inisiator_id, "deal_disepakati", `${b.nama} menyetujui dealmu!`);
    pushLog(state, `[DEAL] Deal antara ${a.nama} dan ${b.nama} DISEPAKATI.`, "normal");
  } else {
    pushNotif(state, deal.inisiator_id, "deal_ditolak", `${b.nama} menolak dealmu.`);
    pushLog(state, `${b.nama} menolak tawaran deal dari ${a.nama}.`, "normal");
  }
  return { ok: true, message: `Deal ${deal.status}.` };
}

// ─── Aksi: Suksesi Jabatan ────────────────────────────────────────────────────

function actionAjukanKandidat(state, slotId, kandidatId, pengajuId) {
  const slot = state.slotJabatan[slotId];
  if (!slot) return { ok: false, message: "Slot tidak ditemukan" };
  const pengaju = state.characters[pengajuId];
  const kandidat = state.characters[kandidatId];
  if (!pengaju || !kandidat) return { ok: false, message: "Karakter tidak ditemukan" };

  // Cek apakah pengaju punya hak
  if (slot.pihak_penentu.length > 0 && !slot.pihak_penentu.includes(pengajuId) && !slot.pihak_penentu.includes("publik")) {
    const hasRight = slot.pihak_penentu.some((id) => {
      const r = Object.values(state.relations).find(
        (rel) => (rel.a === pengajuId && rel.b === id || rel.a === id && rel.b === pengajuId) && rel.kekuatan > 50
      );
      return r !== undefined;
    });
    if (!hasRight) return { ok: false, message: "Kamu tidak punya pengaruh cukup untuk mengajukan kandidat di slot ini." };
  }

  // Cek afiliasi tersembunyi kandidat (capture detector)
  const afilasiTersembunyi = kandidat.afiliasiTersembunyi || null;

  slot.kandidat_diajukan.push({
    karakter_id: kandidatId,
    pengaju_id: pengajuId,
    afiliasi_tersembunyi: afilasiTersembunyi,
    proyeksi_dampak: afilasiTersembunyi ? "PERINGATAN: kandidat ini mungkin memiliki afiliasi tersembunyi!" : null,
  });

  pushLog(state, `${pengaju.nama} mengajukan ${kandidat.nama} untuk posisi ${slot.nama_posisi}.`, "normal");
  return { ok: true, message: `${kandidat.nama} diajukan untuk ${slot.nama_posisi}.` };
}

function actionPutuskanSuksesi(state, slotId, terpilihId, pemutusId) {
  const slot = state.slotJabatan[slotId];
  if (!slot) return { ok: false, message: "Slot tidak ditemukan" };
  const pemegang = state.characters[terpilihId];
  if (!pemegang) return { ok: false, message: "Karakter terpilih tidak ditemukan" };

  const lama = slot.pemegang_saat_ini_id;
  if (lama && state.characters[lama]) {
    state.characters[lama].jabatan_id = null;
  }

  slot.pemegang_saat_ini_id = terpilihId;
  pemegang.jabatan_id = slot.id;
  pemegang.institusi_id = slot.institusi_id;
  slot.kandidat_diajukan = [];

  // Update pemimpin institusi
  if (state.institutions[slot.institusi_id]) {
    state.institutions[slot.institusi_id].pemimpin_saat_ini_id = terpilihId;
  }

  const pemutusan = state.characters[pemutusId];
  pushLog(state, `[SUKSESI] ${pemutusan?.nama || "Sistem"} menetapkan ${pemegang.nama} sebagai ${slot.nama_posisi}.`, "normal");
  return { ok: true, message: `${pemegang.nama} resmi menjabat sebagai ${slot.nama_posisi}.` };
}

// ─── Helper: Hapus Kompromat ──────────────────────────────────────────────────

function hapusKompromat(state, id) {
  const km = state.kompromat[id];
  if (!km) return;
  km.kepemilikan.forEach((ownerId) => {
    const owner = state.characters[ownerId];
    if (owner) owner.kompromat_dimiliki = owner.kompromat_dimiliki.filter((k) => k !== id);
  });
  const target = state.characters[km.target];
  if (target) target.kompromat_terhadap = target.kompromat_terhadap.filter((k) => k !== id);
  delete state.kompromat[id];
}

function upsertRelasi(state, aId, bId, tipe, kekuatan, rahasia) {
  let existing = Object.values(state.relations).find(
    (r) => (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId)
  );
  if (existing) {
    existing.tipe = tipe;
    existing.kekuatan = Math.min(100, existing.kekuatan + kekuatan * 0.3);
    return existing;
  }
  const id = nextId("R");
  state.relations[id] = { id, a: aId, b: bId, tipe, kekuatan, rahasia, sejakEra: state.era };
  return state.relations[id];
}

// ─── NPC AI Tick ──────────────────────────────────────────────────────────────

function npcAITick(state) {
  const npcs = Object.values(state.characters).filter((c) => !c.playerId && c.status === "aktif");

  npcs.forEach((npc) => {
    // Peluang kecil NPC bereaksi
    if (Math.random() > 0.05) return;

    // Jika reputasi sangat rendah, NPC mencoba investigasi balik
    if (npc.reputasi_publik < 30 && npc.uang >= 15) {
      const target = pilihAcak(npcs.filter((c) => c.id !== npc.id && c.reputasi_publik > 40));
      if (target) actionInvestigasi(state, npc.id, target.id);
    }

    // Jika punya kompromat, kadang NPC membongkar sendiri
    if (npc.kompromat_dimiliki.length > 0 && Math.random() < 0.1) {
      const kmId = pilihAcak(npc.kompromat_dimiliki);
      const km = state.kompromat[kmId];
      if (km) actionPakaiKompromat(state, npc.id, kmId, "bongkar", null);
    }
  });
}

// ─── Tick Berkala ─────────────────────────────────────────────────────────────

function tick(state) {
  state.eraTick = (state.eraTick || 0) + 1;

  for (const c of Object.values(state.characters)) {
    if (c.status !== "aktif") continue;
    // Reputasi meluruh perlahan menuju netral (50)
    if (c.reputasi_publik > 50) c.reputasi_publik -= 0.15;
    else if (c.reputasi_publik < 50) c.reputasi_publik += 0.1;

    // Uang bertambah sedikit tiap tick (penghasilan pasif)
    const jabatanBonus = c.jabatan_id ? 5 : 1;
    c.uang = Math.min(c.uang + jabatanBonus, 9999);

    // Update kekuatan politik
    c.kekuatan_politik = kekuatanPolitik(state, c.id);
  }

  // NPC AI
  npcAITick(state);
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pilihAcak(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  nextId,
  pushLog,
  pushNotif,
  kekuatanPolitik,
  hitungEfektivitasSandera,
  hitungDampakOpini,
  hitungEfekKumulatif,
  hitungBiayaPencopotan,
  hitungIndependensi,
  exposeBackingRahasia,
  actionInvestigasi,
  actionFitnah,
  actionPakaiKompromat,
  actionPurgeInstitusi,
  actionCaptureKepemimpinan,
  actionLemahkanInstitusi,
  actionPensiunAman,
  actionResponTerpojok,
  actionAjukanDeal,
  actionResponDeal,
  actionAjukanKandidat,
  actionPutuskanSuksesi,
  upsertRelasi,
  tick,
};
