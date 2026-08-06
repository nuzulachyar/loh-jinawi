// client.js — Loh Jinawi Frontend (versi lengkap)
// ════════════════════════════════════════════════

const socket = io();

// ─── State ────────────────────────────────────────────────────────
let state = null;
let myCharId = localStorage.getItem("lj_charId") || null;
let selectedTargetId = null;
let selectedKompromatId = null;
let graphScale = 1;
let graphFilter = "all";
let logFilter = "all";
let activeTab = "log";
let activeModalTab = "stats";
let activeLeftTab = "karakter";
let notifCount = 0;
let pendingNotifs = [];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── Particle Canvas (Join Screen) ───────────────────────────────
function initParticles() {
  const canvas = $("#particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function makeParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
    };
  }

  resize();
  particles = Array.from({ length: 80 }, makeParticle);
  window.addEventListener("resize", resize);

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,168,76,${p.alpha})`;
      ctx.fill();
    });

    // Draw faint connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(201,168,76,${0.08 * (1 - d / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
}

// ─── Socket Events ────────────────────────────────────────────────

socket.on("connect", () => {
  const dot = $(".conn-dot");
  if (dot) { dot.classList.remove("disconnected"); }
});

socket.on("disconnect", () => {
  const dot = $(".conn-dot");
  if (dot) { dot.classList.add("disconnected"); }
});

socket.on("state:update", (s) => {
  state = s;
  if (myCharId && state.characters[myCharId]) {
    $("#join-screen").classList.add("hidden");
    $("#game-screen").classList.remove("hidden");
    render();
  } else if (myCharId) {
    // charId saved but not in state (server restarted)
    localStorage.removeItem("lj_charId");
    myCharId = null;
    if (state) renderNpcList();
  } else {
    if (state) renderNpcList();
  }
});

socket.on("player:assigned", ({ charId }) => {
  myCharId = charId;
  localStorage.setItem("lj_charId", charId);
  $("#join-screen").classList.add("hidden");
  $("#game-screen").classList.remove("hidden");
  if (state) render();
});

socket.on("action:result", (res) => {
  showToast(res.message, res.ok ? "ok" : "error");
  if (state) render();
});

socket.on("notifikasi:baru", (notifs) => {
  pendingNotifs.push(...notifs);
  notifCount += notifs.length;
  updateNotifBadge();
  // Jika deal masuk, refresh tab deals
  if (notifs.some((n) => n.tipe === "deal_masuk")) renderDeals();
});

socket.on("deal:masuk", ({ deal, dari }) => {
  showToast(`Tawaran deal dari ${dari.nama}! Lihat tab Deals.`, "ok");
  if (activeTab === "deals") renderDeals();
});

// ─── Join Screen ──────────────────────────────────────────────────

let selectedJalur = "ekonomi";

$$(".jalur-card").forEach((card) => {
  card.onclick = () => {
    $$(".jalur-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedJalur = card.dataset.jalur;
  };
});

$("#btn-mulai-baru").onclick = () => {
  const nama = $("#nama-input").value.trim() || "Rakyat Baru";
  socket.emit("player:join", { nama, pilihKarakterId: null, jalurMasuk: selectedJalur });
};

function renderNpcList() {
  if (!state) return;
  const list = $("#npc-list");
  if (!list) return;
  list.innerHTML = "";
  Object.values(state.characters)
    .filter((c) => !c.playerId && c.jabatan_id && c.reputasi_publik > 35)
    .sort((a, b) => b.kekuatan_politik - a.kekuatan_politik)
    .slice(0, 8)
    .forEach((c) => {
      const initials = c.nama.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const rep = Math.round(c.reputasi_publik);
      const pol = Math.round(c.kekuatan_politik);
      const div = document.createElement("div");
      div.className = "npc-item";
      div.innerHTML = `
        <div class="npc-avatar">${initials}</div>
        <div class="npc-info">
          <span class="npc-name">${c.nama}</span>
          <span class="npc-role">${jabatanLabel(c)}</span>
        </div>
        <div class="npc-stats">
          <div class="npc-stat" title="Reputasi publik">
            <span class="stat-label">Rep</span>
            <div class="stat-bar"><div class="stat-fill gold" style="width:${Math.max(4, rep)}%"></div></div>
          </div>
          <div class="npc-stat" title="Kekuatan politik">
            <span class="stat-label">Pol</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${Math.max(4, pol)}%"></div></div>
          </div>
        </div>
      `;
      div.onclick = () => socket.emit("player:join", { nama: c.nama, pilihKarakterId: c.id, jalurMasuk: null });
      list.appendChild(div);
    });
}

// ─── Render Utama ─────────────────────────────────────────────────

function render() {
  if (!state || !myCharId) return;
  renderTopbar();
  renderMyCard();
  renderCharList();
  renderInstList();
  renderGraph();
  renderLog();
  renderDeals();
  renderMyKompromat();
}

// ─── Topbar ───────────────────────────────────────────────────────

function renderTopbar() {
  const me = state.characters[myCharId];
  if (!me) return;

  const eraLabel = $("#era-label");
  if (eraLabel) eraLabel.textContent = state.eraLabel || state.era || "Era Saat Ini";

  const tbMe = $("#topbar-me");
  if (tbMe) {
    tbMe.innerHTML = `
      <div class="topbar-me-stats">
        <div class="me-stat">👤 <strong>${me.nama}</strong></div>
        <div class="me-stat">💰 <strong>${Math.round(me.uang)}</strong></div>
        <div class="me-stat">⚡ <strong>${Math.round(me.kekuatan_politik)}</strong> pol.</div>
        <div class="me-stat">📢 <strong>${Math.round(me.reputasi_publik)}</strong> rep.</div>
      </div>
    `;
  }
}

// ─── Kartu Karakter Sendiri ───────────────────────────────────────

function renderMyCard() {
  const me = state.characters[myCharId];
  if (!me) return;

  $("#my-card").innerHTML = `
    <div class="my-card-name">${me.nama}</div>
    <div class="my-card-role">${jabatanLabel(me)}</div>
    <div class="stat-bars">
      ${statBar("Reputasi Publik", me.reputasi_publik, "gold")}
      ${statBar("Kekuatan Politik", Math.min(100, me.kekuatan_politik), "blue")}
      ${statBar("Integritas", me.integritas, "green")}
      ${statBar("Loyalitas", me.loyalitas_ke_atasan, "purple")}
    </div>
    <div class="my-card-money">
      <span>Kas</span>
      <strong>💰 ${Math.round(me.uang)}</strong>
    </div>
    ${me.kompromat_dimiliki.length > 0 ? `<div style="margin-top:8px;font-size:10px;color:var(--gold)">🗂 ${me.kompromat_dimiliki.length} kompromat dipegang</div>` : ""}
    ${me.status !== "aktif" ? `<div style="margin-top:8px;font-size:10px;color:var(--crimson-light)">Status: ${me.status}</div>` : ""}
  `;
}

function statBar(label, val, color) {
  const v = Math.round(Math.min(100, Math.max(0, val)));
  return `
    <div class="stat-bar-item">
      <div class="stat-bar-header">
        <span>${label}</span>
        <strong>${v}</strong>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill ${color}" style="width:${v}%"></div>
      </div>
    </div>
  `;
}

// ─── Daftar Karakter ──────────────────────────────────────────────

function renderCharList() {
  const list = $("#char-list");
  if (!list) return;
  const q = ($("#search-char")?.value || "").toLowerCase();

  list.innerHTML = "";
  Object.values(state.characters)
    .filter((c) => {
      if (q && !c.nama.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.kekuatan_politik - a.kekuatan_politik)
    .forEach((c) => {
      const div = document.createElement("div");
      const isMe = c.id === myCharId;
      div.className = `char-item${isMe ? " me-char" : ""}${c.playerId && !isMe ? " player-char" : ""}`;
      div.innerHTML = `
        <div class="n">
          ${isMe ? "⭐ " : ""}${c.nama}
          ${c.playerId && !isMe ? `<span class="char-badge badge-player">Pemain</span>` : ""}
          ${c.status === "pensiun" ? `<span class="char-badge badge-pensiun">Pensiun</span>` : ""}
        </div>
        <div class="r">${jabatanLabel(c)} | Pol: ${Math.round(c.kekuatan_politik)}</div>
      `;
      if (!isMe) div.onclick = () => openTargetModal(c.id);
      list.appendChild(div);
    });
}

// ─── Daftar Institusi ─────────────────────────────────────────────

function renderInstList() {
  const list = $("#inst-list");
  if (!list) return;
  list.innerHTML = "";

  Object.values(state.institutions || {}).forEach((inst) => {
    const independensi = hitungIndependensi(inst);
    const pemimpin = state.characters[inst.pemimpin_saat_ini_id];
    const div = document.createElement("div");
    div.className = "inst-item";
    div.innerHTML = `
      <div class="inst-name">${inst.nama}</div>
      <div class="inst-type">${inst.tipe} · ${inst.level || "nasional"}</div>
      ${pemimpin ? `<div class="inst-type" style="color:var(--text-accent)">Pimpinan: ${pemimpin.nama}</div>` : ""}
      <div class="inst-bars">
        <div title="Pengaruh" class="inst-mini-bar"><div class="inst-mini-fill" style="width:${inst.pool_pengaruh}%"></div></div>
        <div title="Otonomi" class="inst-mini-bar"><div class="inst-mini-fill otonomi" style="width:${inst.otonomi}%"></div></div>
        <div title="Legitimasi" class="inst-mini-bar"><div class="inst-mini-fill legitimasi" style="width:${inst.legitimasi_publik}%"></div></div>
      </div>
      <div style="font-size:9px;color:var(--text-muted);margin-top:4px">
        Independensi: ${independensi}%
        ${inst.butuh_izin_investigasi_dari ? " · ⚠ Butuh Izin" : ""}
      </div>
    `;
    div.onclick = () => openInstModal(inst.id);
    list.appendChild(div);
  });
}

function hitungIndependensi(inst) {
  let base = inst.jalur_pelaporan === "langsung_presiden" ? 100 : 60;
  if (inst.butuh_izin_investigasi_dari) base -= 40;
  return Math.max(0, base);
}

// ─── Graph ────────────────────────────────────────────────────────

function renderGraph() {
  const svg = $("#graph");
  if (!svg) return;
  const vbW = 720, vbH = 500, cx = vbW / 2, cy = vbH / 2;

  const chars = Object.values(state.characters);
  const me = state.characters[myCharId];
  const others = chars.filter((c) => c.id !== myCharId);

  // Circular layout — me at center, others in orbit
  const mainR = Math.min(160, 50 + others.length * 15);
  const pos = {};
  pos[myCharId] = [cx, cy];
  others.forEach((c, i) => {
    const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2;
    pos[c.id] = [cx + mainR * Math.cos(angle), cy + mainR * Math.sin(angle)];
  });

  let svgContent = `<defs>
    <filter id="glow-gold">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-blue">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
      <path d="M0,0 L0,6 L6,3 z" fill="rgba(201,168,76,0.4)"/>
    </marker>
  </defs>`;

  // Edges
  Object.values(state.relations).forEach((r) => {
    if (!pos[r.a] || !pos[r.b]) return;
    if (graphFilter === "rahasia" && !r.rahasia) return;
    if (graphFilter === "rival" && r.tipe !== "rival") return;

    const [x1, y1] = pos[r.a];
    const [x2, y2] = pos[r.b];

    let stroke, opacity = 0.6, dash = "", width = 1.5;
    switch (r.tipe) {
      case "rival":          stroke = "#e05c5c"; width = 2; break;
      case "patron_klien":   stroke = "#c9a84c"; break;
      case "aliansi_politik":stroke = "#5b9fd4"; break;
      case "sahabat":        stroke = "#4dab7a"; break;
      case "besan":          stroke = "#a97dd1"; break;
      case "keluarga":       stroke = "#a97dd1"; width = 2; break;
      default:               stroke = "#5f5a52"; opacity = 0.4;
    }

    if (r.rahasia) { dash = "4 4"; opacity = 0.35; stroke = "#5b9fd4"; }

    // Highlight edges connected to me
    const isMyEdge = r.a === myCharId || r.b === myCharId;
    if (isMyEdge) { opacity = Math.min(1, opacity + 0.3); width += 0.5; }

    svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}"
      opacity="${opacity}" />`;
  });

  // Nodes
  chars.forEach((c) => {
    if (!pos[c.id]) return;
    const [x, y] = pos[c.id];
    const isMe = c.id === myCharId;

    let fill, r, strokeColor;
    if (isMe) {
      fill = "#c9a84c"; r = 28; strokeColor = "rgba(201,168,76,0.5)";
    } else if (c.playerId) {
      fill = "#a97dd1"; r = 20; strokeColor = "rgba(169,125,209,0.3)";
    } else if (c.status === "pensiun") {
      fill = "#3a3a3a"; r = 16; strokeColor = "transparent";
    } else {
      fill = "#1a5e3c"; r = 18; strokeColor = "rgba(77,171,122,0.2)";
    }

    // Size by kekuatan politik
    const kp = Math.min(100, c.kekuatan_politik || 20);
    r = isMe ? 28 : Math.max(14, Math.min(24, r * (kp / 60)));

    const label = c.nama.length > 12 ? c.nama.slice(0, 11) + "…" : c.nama;
    const initials = c.nama.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    svgContent += `
      <g class="graph-node" onclick="window.__openTarget('${c.id}')" style="cursor:pointer">
        <circle cx="${x}" cy="${y}" r="${r + 4}" fill="${strokeColor}" />
        <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"
          ${isMe ? 'filter="url(#glow-gold)"' : ""}
          opacity="${c.status !== "aktif" ? 0.4 : 0.9}" />
        <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="${isMe ? 11 : 9}"
          fill="white" font-weight="${isMe ? "700" : "500"}" font-family="Inter,sans-serif"
          pointer-events="none">${isMe ? label : initials}</text>
        ${!isMe ? `<text x="${x}" y="${y + r + 12}" text-anchor="middle" font-size="8"
          fill="rgba(255,255,255,0.5)" font-family="Inter,sans-serif"
          pointer-events="none">${label}</text>` : ""}
        ${c.kompromat_dimiliki?.length > 0 ? `
          <circle cx="${x + r - 4}" cy="${y - r + 4}" r="6" fill="#c9a84c"/>
          <text x="${x + r - 4}" y="${y - r + 8}" text-anchor="middle" font-size="7"
            fill="#07090f" font-weight="700" pointer-events="none">${c.kompromat_dimiliki.length}</text>
        ` : ""}
      </g>`;
  });

  svg.innerHTML = svgContent;
}

window.__openTarget = (id) => {
  if (id === myCharId) return;
  openTargetModal(id);
};

// ─── Log ──────────────────────────────────────────────────────────

function renderLog() {
  const list = $("#log-list");
  if (!list) return;
  list.innerHTML = "";

  const logs = (state.log || [])
    .filter((l) => logFilter === "all" || l.kategori === logFilter)
    .slice(0, 50);

  logs.forEach((l) => {
    const div = document.createElement("div");
    div.className = `log-item${l.kategori === "skandal" ? " skandal" : ""}`;
    const d = new Date(l.ts);
    const time = `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
    div.innerHTML = `<span class="log-time">${time}</span>${l.text}`;
    list.appendChild(div);
  });
}

// ─── Deals ────────────────────────────────────────────────────────

function renderDeals() {
  if (!state || !myCharId) return;

  const inList = $("#deals-in-list");
  const outList = $("#deals-out-list");
  if (!inList || !outList) return;

  inList.innerHTML = "";
  outList.innerHTML = "";

  const deals = Object.values(state.deals || {});

  deals.forEach((deal) => {
    const isMasuk = deal.penerima_id === myCharId;
    const isKeluar = deal.inisiator_id === myCharId;
    if (!isMasuk && !isKeluar) return;

    const pengirim = state.characters[deal.inisiator_id];
    const penerima = state.characters[deal.penerima_id];
    const div = document.createElement("div");
    const statusClass = { diajukan: isMasuk ? "masuk" : "keluar", disepakati: "disepakati", ditolak: "ditolak" }[deal.status] || "";
    div.className = `deal-card ${statusClass}`;

    const statusLabel = { diajukan: "Menunggu", disepakati: "✅ Disepakati", ditolak: "❌ Ditolak" }[deal.status] || deal.status;

    div.innerHTML = `
      <div class="deal-from">${isMasuk ? `Dari: ${pengirim?.nama}` : `Ke: ${penerima?.nama}`} — ${statusLabel}</div>
      <div class="deal-syarat">Minta: ${deal.syarat || "-"}</div>
      <div class="deal-syarat">Tawar: ${deal.imbalan || "-"}</div>
    `;

    if (isMasuk && deal.status === "diajukan") {
      const actions = document.createElement("div");
      actions.className = "deal-actions";
      actions.innerHTML = `
        <button class="deal-accept">✅ Setuju</button>
        <button class="deal-reject">❌ Tolak</button>
      `;
      actions.querySelector(".deal-accept").onclick = () => {
        socket.emit("action:responDeal", { dealId: deal.id, respon: "setuju" });
      };
      actions.querySelector(".deal-reject").onclick = () => {
        socket.emit("action:responDeal", { dealId: deal.id, respon: "tolak" });
      };
      div.appendChild(actions);
    }

    if (isMasuk) inList.appendChild(div);
    else outList.appendChild(div);
  });

  if (inList.children.length === 0) inList.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Belum ada tawaran masuk.</p>`;
  if (outList.children.length === 0) outList.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Belum ada tawaran yang dikirim.</p>`;
}

// ─── Kompromat Panel ─────────────────────────────────────────────

function renderMyKompromat() {
  if (!state || !myCharId) return;
  const me = state.characters[myCharId];
  const list = $("#my-kompromat-list");
  if (!list || !me) return;
  list.innerHTML = "";

  if (me.kompromat_dimiliki.length === 0) {
    list.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Belum ada kompromat yang dipegang.</p>`;
    return;
  }

  me.kompromat_dimiliki.forEach((kmId) => {
    const km = state.kompromat[kmId];
    if (!km) return;
    const target = state.characters[km.target];
    const div = document.createElement("div");
    div.className = `km-panel-item${km.asli ? "" : " palsu"}`;
    div.innerHTML = `
      <div class="km-target">${target?.nama || "?"}</div>
      <div class="km-tipe">${km.tipe.replace(/_/g, " ")} ${km.asli ? "" : "⚠ (palsu)"}</div>
      <div class="km-kekuatan">Kekuatan: ${km.kekuatan_bukti}</div>
    `;
    div.onclick = () => openKompromatModal(kmId);
    list.appendChild(div);
  });
}

// ─── Target Modal ─────────────────────────────────────────────────

function openTargetModal(id) {
  selectedTargetId = id;
  const t = state.characters[id];
  if (!t) return;

  $("#target-name").textContent = t.nama;
  $("#target-role").textContent = jabatanLabel(t);
  $("#target-avatar").textContent = t.is_pemain ? "🧑" : t.jabatan_id ? "🏛" : "👤";

  // Default tab: stats
  switchModalTab("stats");
  renderTargetStats(t);
  renderTargetRelasi(t);
  renderTargetAksiKompromat(t);

  $("#target-modal").classList.remove("hidden");
}

function renderTargetStats(t) {
  const container = $("#target-stats");
  if (!container) return;
  container.innerHTML = `
    <div class="stat-bars">
      ${statBar("Reputasi Publik", t.reputasi_publik, "gold")}
      ${statBar("Kekuatan Politik", Math.min(100, t.kekuatan_politik), "blue")}
      ${statBar("Integritas", t.integritas, "green")}
      ${statBar("Loyalitas ke Atasan", t.loyalitas_ke_atasan, "purple")}
      ${statBar("Otonomi Personal", t.otonomi_personal, "red")}
    </div>
    <div style="margin-top:12px;font-size:10px;color:var(--text-muted)">
      Kas: ${Math.round(t.uang)} | Kompromat terhadapnya: ${t.kompromat_terhadap.length} | Status: ${t.status || "aktif"}
    </div>
    ${t.afiliasiTersembunyi ? `<div style="margin-top:8px;font-size:11px;color:var(--crimson-light)">⚠ Afiliasi tersembunyi terdeteksi</div>` : ""}
  `;
}

function renderTargetRelasi(t) {
  const list = $("#target-relasi-list");
  if (!list) return;
  list.innerHTML = "";

  const relasinya = Object.values(state.relations).filter(
    (r) => r.a === t.id || r.b === t.id
  );

  if (relasinya.length === 0) {
    list.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Tidak ada relasi yang diketahui.</p>`;
    return;
  }

  relasinya.forEach((r) => {
    const otherId = r.a === t.id ? r.b : r.a;
    const other = state.characters[otherId];
    const div = document.createElement("div");
    div.className = "relasi-item";
    div.innerHTML = `
      <div class="relasi-target">${other?.nama || otherId}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="relasi-tipe ${r.tipe}">${r.tipe.replace(/_/g, " ")}</span>
        ${r.rahasia ? `<span class="relasi-rahasia">🔒 Rahasia</span>` : ""}
        <span style="font-size:10px;color:var(--text-muted)">${r.kekuatan}</span>
      </div>
    `;
    list.appendChild(div);
  });
}

function renderTargetAksiKompromat(t) {
  const list = $("#kompromat-list");
  if (!list) return;
  const me = state.characters[myCharId];
  if (!me) return;

  const mine = me.kompromat_dimiliki
    .map((id) => state.kompromat[id])
    .filter((k) => k && k.target === t.id);

  if (mine.length === 0) {
    list.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Belum ada kompromat tentang tokoh ini. Lakukan Investigasi untuk mendapatkannya.</p>`;
    return;
  }

  list.innerHTML = "";
  mine.forEach((k) => {
    const div = document.createElement("div");
    div.className = `km-item${k.asli ? "" : " palsu"}`;
    div.innerHTML = `
      <div class="km-item-header">
        <span class="km-item-tipe">${k.tipe.replace(/_/g, " ")}</span>
        <span class="km-item-kekuatan">⚡ ${k.kekuatan_bukti}</span>
      </div>
      ${!k.asli ? `<div class="km-item-palsu">⚠ Kompromat palsu — risiko terbongkar!</div>` : ""}
      <div style="font-size:10px;color:var(--text-muted);margin-top:4px">Klik untuk gunakan</div>
    `;
    div.onclick = () => openKompromatModal(k.id);
    list.appendChild(div);
  });
}

// ─── Modal Tab Switching ──────────────────────────────────────────

function switchModalTab(tab) {
  activeModalTab = tab;
  $$(".modal-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.modalTab === tab);
  });
  $$(".modal-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `modal-tab-${tab}`);
  });
}

$$(".modal-tab-btn").forEach((btn) => {
  btn.onclick = () => {
    switchModalTab(btn.dataset.modalTab);
    if (btn.dataset.modalTab === "aksi" && selectedTargetId) {
      renderTargetAksiKompromat(state.characters[selectedTargetId]);
    }
  };
});

// ─── Aksi Buttons (Target Modal) ─────────────────────────────────

$("#btn-investigasi").onclick = () => {
  socket.emit("action:investigasi", { targetId: selectedTargetId });
  $("#target-modal").classList.add("hidden");
};

$("#btn-fitnah").onclick = () => {
  socket.emit("action:fitnah", { targetId: selectedTargetId });
  $("#target-modal").classList.add("hidden");
};

$("#btn-deal").onclick = () => {
  const t = state.characters[selectedTargetId];
  $("#deal-target-info").innerHTML = `Tawaran kepada: <strong>${t.nama}</strong>`;
  $("#target-modal").classList.add("hidden");
  $("#deal-modal").classList.remove("hidden");
};

$("#btn-purge").onclick = () => {
  const t = state.characters[selectedTargetId];
  if (!t?.institusi_id) return showToast("Tokoh ini tidak memiliki institusi.", "error");
  if (!confirm(`Purge institusi ${state.institutions[t.institusi_id]?.nama}? Biaya: 30 💰`)) return;
  socket.emit("action:purgeInstitusi", { institusiId: t.institusi_id });
  $("#target-modal").classList.add("hidden");
};

$("#btn-capture").onclick = () => {
  const t = state.characters[selectedTargetId];
  if (!t?.institusi_id) return showToast("Tokoh ini tidak memiliki institusi.", "error");
  if (!confirm(`Capture kepemimpinan ${state.institutions[t.institusi_id]?.nama} dan pasang ${t.nama}? Biaya: 80 💰`)) return;
  socket.emit("action:captureKepemimpinan", { institusiId: t.institusi_id, kandidatId: selectedTargetId });
  $("#target-modal").classList.add("hidden");
};

$("#btn-lemahkan").onclick = () => {
  const t = state.characters[selectedTargetId];
  if (!t?.institusi_id) return showToast("Tokoh ini tidak memiliki institusi.", "error");
  const cara = prompt("Cara lemahkan:\n• ubah_jalur — ubah jalur pelaporan\n• tambah_izin — tambah kewajiban izin investigasi")?.trim();
  if (!cara) return;
  socket.emit("action:lemahkanInstitusi", { institusiId: t.institusi_id, cara });
  $("#target-modal").classList.add("hidden");
};

$("#btn-pensiun").onclick = () => {
  const t = state.characters[selectedTargetId];
  const kambingHitamId = prompt("Masukkan ID karakter sebagai kambing hitam\n(ketik ID seperti K_KAPOLRI atau nama dari char list):");
  if (!kambingHitamId) return;
  socket.emit("action:pensiunAman", { targetId: selectedTargetId, kambingHitamId });
  $("#target-modal").classList.add("hidden");
};

$("#btn-terpojok").onclick = () => {
  $("#target-modal").classList.add("hidden");
  $("#terpojok-modal").classList.remove("hidden");
};

// ─── Terpojok Modal ───────────────────────────────────────────────

$$(".terpojok-btn").forEach((btn) => {
  btn.onclick = () => {
    socket.emit("action:terpojok", { opsi: btn.dataset.opsi });
    $("#terpojok-modal").classList.add("hidden");
  };
});

// ─── Kompromat Action Modal ───────────────────────────────────────

function openKompromatModal(kmId) {
  selectedKompromatId = kmId;
  const km = state.kompromat[kmId];
  if (!km) return;
  const target = state.characters[km.target];

  const tuntutanGroup = $("#tuntutan-group");
  tuntutanGroup.style.display = "none";

  $("#km-detail").innerHTML = `
    <div><strong>Target:</strong> ${target?.nama || "?"}</div>
    <div><strong>Tipe:</strong> ${km.tipe.replace(/_/g, " ")}</div>
    <div><strong>Kekuatan Bukti:</strong> ${km.kekuatan_bukti}/100</div>
    ${!km.asli ? `<div style="color:var(--crimson-light);margin-top:4px">⚠ Palsu — risiko kerapuhan: ${km.kerapuhan}%</div>` : ""}
  `;

  // Close target modal first, open this
  $("#target-modal").classList.add("hidden");
  $("#km-action-modal").classList.remove("hidden");
}

$$(".km-mode-btn").forEach((btn) => {
  btn.onclick = () => {
    const mode = btn.dataset.mode;
    if (mode === "sandera") {
      const tuntutanGroup = $("#tuntutan-group");
      tuntutanGroup.style.display = "block";
      // Ganti semua btn ke "Kirim Sandera"
      const tuntutan = $("#km-tuntutan").value.trim();
      socket.emit("action:pakaiKompromat", {
        kompromatId: selectedKompromatId,
        mode,
        tuntutan: tuntutan || prompt("Tuntutan apa yang kamu minta?") || "",
      });
    } else {
      socket.emit("action:pakaiKompromat", { kompromatId: selectedKompromatId, mode, tuntutan: null });
    }
    $("#km-action-modal").classList.add("hidden");
  };
});

// ─── Deal Modal ───────────────────────────────────────────────────

$("#btn-kirim-deal").onclick = () => {
  const syarat = $("#deal-syarat").value.trim();
  const imbalan = $("#deal-imbalan").value.trim();
  if (!syarat && !imbalan) return showToast("Isi syarat atau imbalan terlebih dahulu.", "error");
  socket.emit("action:ajukanDeal", { penerimaId: selectedTargetId, syarat, imbalan });
  $("#deal-modal").classList.add("hidden");
  $("#deal-syarat").value = "";
  $("#deal-imbalan").value = "";
};

// ─── Notifikasi ───────────────────────────────────────────────────

function updateNotifBadge() {
  const badge = $("#notif-badge");
  if (!badge) return;
  if (notifCount > 0) {
    badge.textContent = notifCount > 9 ? "9+" : notifCount;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

$("#notif-btn").onclick = () => {
  const list = $("#notif-list");
  if (!list) return;
  list.innerHTML = "";
  if (pendingNotifs.length === 0) {
    list.innerHTML = `<p style="font-size:11px;color:var(--text-muted)">Tidak ada notifikasi.</p>`;
  } else {
    pendingNotifs.slice().reverse().forEach((n) => {
      const div = document.createElement("div");
      div.className = `notif-item ${n.tipe}`;
      div.innerHTML = `<div class="notif-tipe">${n.tipe.replace(/_/g, " ")}</div><div class="notif-pesan">${n.pesan}</div>`;
      list.appendChild(div);
    });
  }
  notifCount = 0;
  updateNotifBadge();
  $("#notif-modal").classList.remove("hidden");
};

// ─── Institusi Modal (sederhana) ──────────────────────────────────

function openInstModal(instId) {
  const inst = state.institutions[instId];
  if (!inst) return;
  const pemimpin = state.characters[inst.pemimpin_saat_ini_id];
  const ind = hitungIndependensi(inst);

  alert(`${inst.nama}\n\nTipe: ${inst.tipe}\nPemimpin: ${pemimpin?.nama || "Kosong"}\nIndependensi: ${ind}%\nOtonomi: ${inst.otonomi}%\nLegitimasi: ${inst.legitimasi_publik}%\nJalur lapor: ${inst.jalur_pelaporan}\n${inst.butuh_izin_investigasi_dari ? "⚠ Butuh izin investigasi!" : ""}`);
}

// ─── Tab Navigation (Panel Kanan) ─────────────────────────────────

$$(".tab-btn").forEach((btn) => {
  btn.onclick = () => {
    activeTab = btn.dataset.tab;
    $$(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${activeTab}`));
    $$(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== `tab-${activeTab}`));
    if (activeTab === "deals") renderDeals();
    if (activeTab === "kompromat") renderMyKompromat();
  };
});

// ─── Tab Mini (Panel Kiri: Karakter / Institusi) ──────────────────

$$(".tab-btn-mini").forEach((btn) => {
  btn.onclick = () => {
    activeLeftTab = btn.dataset.tabMini;
    $$(".tab-btn-mini").forEach((b) => b.classList.toggle("active", b === btn));
    $("#tab-karakter").classList.toggle("hidden", activeLeftTab !== "karakter");
    $("#tab-institusi").classList.toggle("hidden", activeLeftTab !== "institusi");
  };
});

// ─── Log Filter ───────────────────────────────────────────────────

$$(".log-filter-btn").forEach((btn) => {
  btn.onclick = () => {
    logFilter = btn.dataset.filter;
    $$(".log-filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderLog();
  };
});

// ─── Graph Controls ───────────────────────────────────────────────

$("#btn-filter-all").onclick = () => setGraphFilter("all");
$("#btn-filter-rahasia").onclick = () => setGraphFilter("rahasia");
$("#btn-filter-rival").onclick = () => setGraphFilter("rival");
$("#btn-graph-zoom-in").onclick = () => { graphScale = Math.min(2, graphScale + 0.2); updateGraphScale(); };
$("#btn-graph-zoom-out").onclick = () => { graphScale = Math.max(0.5, graphScale - 0.2); updateGraphScale(); };

function setGraphFilter(f) {
  graphFilter = f;
  $$(".graph-ctrl-btn").forEach((b) => b.classList.remove("active"));
  $(`#btn-filter-${f}`)?.classList.add("active");
  if (state) renderGraph();
}

function updateGraphScale() {
  const svg = $("#graph");
  if (svg) svg.style.transform = `scale(${graphScale})`;
}

// ─── Search ───────────────────────────────────────────────────────

$("#search-char").oninput = () => renderCharList();

// ─── Reset & Logout ────────────────────────────────────────────────────────

$("#btn-logout").onclick = () => {
  if (!confirm("Keluar dari karakter ini?")) return;
  socket.emit("player:leave");
  localStorage.removeItem("lj_charId");
  location.reload();
};


$("#btn-reset").onclick = () => {
  if (!confirm("Reset game ke kondisi awal? Semua progress hilang.")) return;
  localStorage.removeItem("lj_charId");
  myCharId = null;
  pendingNotifs = [];
  notifCount = 0;
  socket.emit("admin:reset");
  location.reload();
};

// ─── Modal Close (global) ─────────────────────────────────────────

$$("[data-close]").forEach((btn) => {
  btn.onclick = (e) => {
    const modal = e.target.closest(".modal");
    if (modal) modal.classList.add("hidden");
  };
});

// Klik backdrop modal
$$(".modal").forEach((m) => {
  m.onclick = (e) => {
    if (e.target === m) m.classList.add("hidden");
  };
});

// ─── Toast ────────────────────────────────────────────────────────

function showToast(msg, type = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add("hidden"), 4000);
}

// ─── Util ─────────────────────────────────────────────────────────

function jabatanLabel(c) {
  if (!c) return "?";
  if (c.status === "pensiun") return "Pensiunan";
  if (c.status === "kabur") return "Kabur / Mundur";
  if (!c.jabatan_id) return "Rakyat biasa";
  const slot = state.slotJabatan[c.jabatan_id];
  if (slot) return slot.nama_posisi;
  const inst = state.institutions[c.institusi_id];
  return inst ? `Pejabat ${inst.nama}` : "Pejabat";
}

// ─── Init ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  updateNotifBadge();
});
