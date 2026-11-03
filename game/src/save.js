// Versioned save in localStorage. Updates only ever add fields (migrate), so votes never wipe a farm.
import CFG from './data/config.json';

const KEY = 'gamebyvote.save';
export const SAVE_VERSION = 3;

export function fresh(now) {
  return {
    v: SAVE_VERSION,
    coins: CFG.startCoins,
    plots: {},                     // index 0..8 -> {crop, plantedAt, growMs, sealed}
    planted: 0,                    // seeds planted so far (sets the early grow times)
    harvests: 0,
    book: {},                      // "crop:form" -> count (form = normal | gold | rainbow | giant)
    billNo: 0,
    sealedGiven: false, sealedReady: false,
    lastSeen: now,
    seen: {},                      // tutorial steps shown
    stats: { disputesWon: 0, disputesLost: 0, paid: 0 },
  };
}

function migrate(s) {
  if (s.v < 3) {                   // v0.3 -> v0.4: new monster patch; keep coins
    const f = fresh(Date.now());
    s = { ...f, coins: Math.max(f.coins, s.coins | 0) };
  }
  return s;
}

export function load(now) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = migrate(JSON.parse(raw)); if (s && s.v) return s; }
  } catch (e) {}
  return fresh(now);
}

export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }
