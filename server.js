const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { buildSeed } = require("./seed");
const logic = require("./logic");

const SAVE_PATH = path.join(__dirname, "data", "state.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 30000,
  pingInterval: 10000,
});

app.use(express.static(path.join(__dirname, "public")));

// ─── Muat / Buat State ────────────────────────────────────────────────────────
let state;
if (fs.existsSync(SAVE_PATH)) {
  try {
    state = JSON.parse(fs.readFileSync(SAVE_PATH, "utf-8"));
    if (!state.notifikasi) state.notifikasi = {};
    if (!state.eraRules) state.eraRules = { represif: false, pemilihan_langsung: true, pers_bebas: true };
    console.log("✅ State dimuat dari data/state.json");
  } catch (e) {
    console.warn("⚠️  Gagal baca state tersimpan, mulai dari awal.", e.message);
    state = buildSeed();
  }
} else {
  state = buildSeed();
  console.log("🌱 State baru dibuat dari seed.");
}

function saveState() {
  fs.mkdirSync(path.dirname(SAVE_PATH), { recursive: true });
  fs.writeFileSync(SAVE_PATH, JSON.stringify(state, null, 2));
}

function broadcastState() {
  // Kirim state tanpa notifikasi (notifikasi dikirim langsung ke socket)
  const stateForBroadcast = { ...state };
  io.emit("state:update", stateForBroadcast);
}

function sendNotifToPlayer(charId) {
  if (!state.notifikasi || !state.notifikasi[charId]) return;
  const notifs = state.notifikasi[charId].filter((n) => !n.dibaca);
  if (notifs.length === 0) return;

  // Cari socket yang memegang karakter ini
  for (const [, socket] of io.sockets.sockets) {
    if (socket.data.charId === charId) {
      socket.emit("notifikasi:baru", notifs);
      // Tandai sudah dibaca
      state.notifikasi[charId].forEach((n) => (n.dibaca = true));
      break;
    }
  }
}

// ─── Tick Simulasi ────────────────────────────────────────────────────────────
setInterval(() => {
  logic.tick(state);
  broadcastState();
  // Kirim notifikasi ke pemain yang terhubung
  Object.keys(state.notifikasi || {}).forEach((charId) => sendNotifToPlayer(charId));
}, 8000);

setInterval(saveState, 20000);

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n💾 Menyimpan state sebelum keluar...");
  saveState();
  process.exit(0);
});

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🔗 Pemain terhubung:", socket.id);
  socket.emit("state:update", state);

  // Helper
  function requireChar() {
    return socket.data.charId;
  }
  function emitResult(res) {
    socket.emit("action:result", res);
    broadcastState();
  }

  // ── Join ──
  socket.on("player:join", ({ nama, pilihKarakterId, jalurMasuk }) => {
    let charId = pilihKarakterId;

    if (charId && state.characters[charId] && !state.characters[charId].playerId) {
      state.characters[charId].playerId = socket.id;
      state.characters[charId].is_pemain = true;
    } else {
      // Tentukan stat berdasarkan jalurMasuk
      let u = 100, rep = 20, pol = 5, n = nama || "Rakyat Baru";
      let jm = jalurMasuk || "ekonomi";
      if (jm === "ekonomi") { u = 200; rep = 30; pol = 10; }
      else if (jm === "sosial") { u = 40; rep = 70; pol = 15; }
      else if (jm === "bayangan") { u = 80; rep = 20; pol = 5; }

      charId = logic.nextId("K");
      state.characters[charId] = {
        id: charId,
        nama: n,
        is_pemain: true,
        playerId: socket.id,
        jabatan_id: null,
        institusi_id: null,
        jalurMasuk: jm,
        reputasi_publik: rep,
        kekuatan_politik: pol,
        loyalitas_ke_atasan: 50,
        otonomi_personal: 10,
        integritas: 50,
        uang: u,
        kompromat_dimiliki: [],
        kompromat_terhadap: [],
        afiliasiTersembunyi: null,
        status: "aktif",
        bisaKembali: false,
        riwayatEra: [],
      };
      
      if (jm === "bayangan") {
        // Beri 1 kompromat acak
        const pejabatLain = Object.values(state.characters).filter(c => c.jabatan_id && c.id !== charId);
        if (pejabatLain.length > 0) {
          const targetKm = pejabatLain[Math.floor(Math.random() * pejabatLain.length)];
          const kmId = logic.nextId("KM");
          state.kompromat[kmId] = {
            id: kmId, tipe: "rahasia_awal", target: targetKm.id, kekuatan_bukti: 45,
            kepemilikan: [charId], asli: true, kadaluarsa: null, dibuat: Date.now(),
          };
          state.characters[charId].kompromat_dimiliki.push(kmId);
          targetKm.kompromat_terhadap.push(kmId);
        }
      }

      logic.pushLog(state, `${state.characters[charId].nama} memulai hidup baru sebagai rakyat (jalur: ${jm}).`, "normal");

      // Auto-spawn bots jika ini adalah satu-satunya pemain yang sedang aktif bermain
      const activePlayers = Object.values(state.characters).filter(c => c.playerId && c.id !== charId);
      if (activePlayers.length === 0) {
        const remainingRoles = ["ekonomi", "sosial", "bayangan"].filter(r => r !== jm);
        remainingRoles.forEach((role, i) => {
          const botId = logic.nextId("K_BOT");
          const bU = role === "ekonomi" ? 200 : role === "sosial" ? 40 : 80;
          const bRep = role === "ekonomi" ? 30 : role === "sosial" ? 70 : 20;
          const bPol = role === "ekonomi" ? 10 : role === "sosial" ? 15 : 5;
          state.characters[botId] = {
            id: botId, nama: `Bot Rival ${i+1}`, is_pemain: false, playerId: null,
            jabatan_id: null, institusi_id: null, jalurMasuk: role,
            reputasi_publik: bRep, kekuatan_politik: bPol, loyalitas_ke_atasan: 50,
            otonomi_personal: 10, integritas: 50, uang: bU,
            kompromat_dimiliki: [], kompromat_terhadap: [], afiliasiTersembunyi: null,
            status: "aktif", bisaKembali: false, riwayatEra: []
          };
          if (role === "bayangan") {
            const pejabatLain = Object.values(state.characters).filter(c => c.jabatan_id && c.id !== botId);
            if (pejabatLain.length > 0) {
              const targetKm = pejabatLain[Math.floor(Math.random() * pejabatLain.length)];
              const kmId = logic.nextId("KM");
              state.kompromat[kmId] = {
                id: kmId, tipe: "rahasia_awal", target: targetKm.id, kekuatan_bukti: 45,
                kepemilikan: [botId], asli: true, kadaluarsa: null, dibuat: Date.now()
              };
              state.characters[botId].kompromat_dimiliki.push(kmId);
              targetKm.kompromat_terhadap.push(kmId);
            }
          }
          logic.pushLog(state, `${state.characters[botId].nama} (NPC) memulai persaingan (jalur: ${role}).`, "normal");
        });
      }
    }

    socket.data.charId = charId;
    socket.emit("player:assigned", { charId });
    // Kirim notifikasi pending
    sendNotifToPlayer(charId);
    broadcastState();
    saveState();
  });

  socket.on("player:leave", () => {
    const charId = socket.data.charId;
    if (charId && state.characters[charId]) {
      state.characters[charId].playerId = null;
      socket.data.charId = null;
      broadcastState();
      saveState();
    }
  });

  // ── Aksi Dasar ──
  socket.on("action:investigasi", ({ targetId }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionInvestigasi(state, actorId, targetId));
  });

  socket.on("action:fitnah", ({ targetId }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionFitnah(state, actorId, targetId));
  });

  socket.on("action:pakaiKompromat", ({ kompromatId, mode, tuntutan }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionPakaiKompromat(state, actorId, kompromatId, mode, tuntutan));
  });

  // ── Deal ──
  socket.on("action:ajukanDeal", ({ penerimaId, syarat, imbalan }) => {
    const actorId = requireChar(); if (!actorId) return;
    const res = logic.actionAjukanDeal(state, actorId, penerimaId, syarat, imbalan);
    emitResult(res);
    if (res.ok) {
      // Kirim deal ke penerima jika sedang online
      for (const [, s] of io.sockets.sockets) {
        if (s.data.charId === penerimaId) {
          s.emit("deal:masuk", { dealId: res.dealId, deal: state.deals[res.dealId], dari: state.characters[actorId] });
          break;
        }
      }
    }
  });

  socket.on("action:responDeal", ({ dealId, respon }) => {
    emitResult(logic.actionResponDeal(state, dealId, respon));
  });

  // ── Suksesi ──
  socket.on("action:ajukanKandidat", ({ slotId, kandidatId }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionAjukanKandidat(state, slotId, kandidatId, actorId));
  });

  socket.on("action:putuskanSuksesi", ({ slotId, terpilihId }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionPutuskanSuksesi(state, slotId, terpilihId, actorId));
  });

  // ── Aksi Institusional Baru ──
  socket.on("action:purgeInstitusi", ({ institusiId, ambangIntegritas, ambangLoyalitas }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionPurgeInstitusi(state, actorId, institusiId, ambangIntegritas, ambangLoyalitas));
  });

  socket.on("action:captureKepemimpinan", ({ institusiId, kandidatId }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionCaptureKepemimpinan(state, actorId, institusiId, kandidatId));
  });

  socket.on("action:lemahkanInstitusi", ({ institusiId, cara }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionLemahkanInstitusi(state, actorId, institusiId, cara));
  });

  socket.on("action:pensiunAman", ({ targetId, kambingHitamId }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionPensiunAman(state, actorId, targetId, kambingHitamId));
  });

  socket.on("action:terpojok", ({ opsi }) => {
    const actorId = requireChar(); if (!actorId) return;
    emitResult(logic.actionResponTerpojok(state, actorId, opsi));
  });

  // ── Hapus state (reset) ──
  socket.on("admin:reset", () => {
    try {
      if (fs.existsSync(SAVE_PATH)) fs.unlinkSync(SAVE_PATH);
    } catch (e) { /* ignore */ }
    state = buildSeed();
    broadcastState();
    saveState();
    socket.emit("action:result", { ok: true, message: "State direset ke kondisi awal." });
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    const charId = socket.data.charId;
    if (charId && state.characters[charId]) {
      state.characters[charId].playerId = null;
    }
    saveState();
    console.log("🔌 Pemain terputus:", socket.id);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🏛️  Loh Jinawi server berjalan di port ${PORT}`);
  console.log(`🌐 Buka di komputer ini: http://localhost:${PORT}`);
  console.log(`📡 Pemain LAN lain: http://<IP-lokal>:${PORT}`);
  console.log(`🔍 Cek IP lokal: ifconfig atau ip addr\n`);
});
