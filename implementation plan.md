# Implementation Plan — Loh Jinawi

## Status: Gameplay Ready (Core Features Complete)

The game is **playable** with all core mechanics implemented. Below is the current state and remaining work.

---

## ✅ Already Implemented & Playable

### Core Mechanics (All Working)
- **Investigasi** - `actionInvestigasi()` - Costs 15 uang, can discover secret backing
- **Fitnah** - `actionFitnah()` - Create fake compromat, risk of exposure
- **Pakai Kompromat** - `actionPakaiKompromat()` - Sandera/Bongkar/Simpan
- **Deal System** - `actionAjukanDeal()`, `actionResponDeal()` - Full negotiation flow
- **Purge Institusi** - `actionPurgeInstitusi()` - Remove officials from institutions
- **Capture Kepemimpinan** - `actionCaptureKepemimpinan()` - Install new leader, sets `afiliasiTersembunyi`
- **Lemahkan Institusi** - `actionLemahkanInstitusi()` - Change reporting path or add permission requirements
- **Pensiun Aman** - `actionPensiunAman()` - Safe exit strategy with scapegoat
- **Respons Terpojok** - `actionResponTerpojok()` - Bertahan/Kabur/Berkhianat options
- **Tick Simulasi** - Reputasi decays toward 50, passive uang income
- **Backing Rahasia** - Auto-expose during investigation

### Data Structures (Complete)
- 15 Characters (11 NPCs + 4 starting player roles)
- 12 Institutions (Eksekutif, Polisi, Kejaksaan, Pertahanan, KPK, Daerah, Parlemen, Militer, Pengadilan, Media, Bisnis, Intelijen)
- 9 Slot Jabatan
- 16 Relations (4 secret)
- 4 Kompromat (pre-existing)

### World State
- Era Transisi Demokrasi with configurable rules
- Automatic save every 20 seconds to `data/state.json`
- Graceful shutdown saves state

---

## ❌ Missing Features (UI & Systems)

### 1. UI: Succession Management
**Problem:** No UI to propose candidates or decide succession  
**File:** `public/client.js`, `public/index.html`  
**Server already has:** `actionAjukanKandidat`, `actionPutuskanSuksesi`

### 2. Era Transition System
**Problem:** Era rules are static, no tick-based era changes  
**File:** `logic.js`, `server.js`  
**Need:** `tickEra(state)` function, era progression triggers

### 3. Economic/Business System
**Problem:** No business entities, profit calculation, or investment actions  
**File:** `seed.js`, `logic.js`, `server.js`  
**Need:** Business institutions, profit ticks, investment actions

### 4. Patron-Klien Onboarding UI
**Problem:** Patron assignment exists in logic but no UI  
**File:** `public/client.js`, `public/index.html`  
**Need:** Patron request/approval flow

### 5. Victory/End Game Conditions
**Problem:** No win/lose states, game runs indefinitely  
**File:** `logic.js`, `server.js`, `public/client.js`  
**Need:** `checkVictory()`, end-game modal

### 6. Kompromat Expiry System
**Problem:** No expiry tracking or cleanup  
**File:** `logic.js`  
**Need:** Kadaluarsa field checking in tick

---

## 📋 Remaining Tasks

| # | Feature | Priority | Files to Modify |
|---|---------|----------|-----------------|
| 1 | UI: Propose Kandidat | High | client.js, index.html |
| 2 | UI: Putuskan Suksesi | High | client.js, index.html |
| 3 | Era Transition | Medium | logic.js, server.js |
| 4 | Business System | Medium | seed.js, logic.js, server.js |
| 5 | Victory Conditions | Low | logic.js, server.js, client.js |
| 6 | Compromat Expiry | Low | logic.js |

---

## 🎮 How to Play (Current Build)

1. Run `npm run dev`
2. Open `http://localhost:3000`
3. Create character or pick NPC
4. Use action buttons in target modal:
   - **Investigasi** (-15 💰) - Gain compromat
   - **Buat Fitnah** (-25 💰) - Create fake compromat
   - **Ajukan Deal** - Negotiate with other characters
   - **Purge Institusi** (-30 💰) - Remove officials
   - **Capture Pimpinan** (-80 💰) - Install new leader
   - **Lemahkan Institusi** (-50 💰) - Reduce independence
   - **Pensiun Aman** (-100 💰) - Safe exit with scapegoat
   - **Lawan Balik** - Respond when under attack

5. Monitor reputasi decay (toward 50) and passive income each tick

---

## ⚠️ Known Issues

1. **Capture Kepemimpinan** - `afiliasiTersembunyi` tracking improved (fixed)
2. **Purge criteria** - Requires integritas > 55 OR loyalitas < 50
3. **Kompromat terhadap** - Not visible in UI for target character
4. **Secret backing** - Only exposed during investigation, not in deals

---

## Next Steps

To complete the game, implement:
1. Add UI for succession management (high priority for institutional gameplay)
2. Add era transition logic (medium priority for long-term gameplay)
3. Add economic system (medium priority for alternative win paths)