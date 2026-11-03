// Versioned save in localStorage. Updates only ever add fields (migrate), so votes never wipe a farm.
import CFG from './data/config.json';

const KEY = 'gamebyvote.save';
export const SAVE_VERSION = 2;

export function fresh(now) {
  return {
    v: SAVE_VERSION,
    epoch: now,                    // game clock start (real ms); day n starts at epoch + n * dayLength
    offset: 0,                     // ms added by sleeping (skips to morning; crops grow too)
    coins: CFG.startCoins,
    seeds: CFG.startSeeds,
    basket: [],                    // harvested monsters: {crop, rarity, mutation, value}
    plots: {},                     // "x,y" -> {plantedAt}
    workers: [],                   // {name, frame}
    nightsDone: -1,                // last day index whose night Kelvin already worked
    pendingBill: [],               // lines for the next morning's bill
    dayLoss: 0,                    // coin value Kelvin took since the last bill (refunded with interest)
    billNo: 0,
    seen: {},                      // tutorial steps shown
    stats: { harvested: 0, sold: 0, fines: 0 },
  };
}

function migrate(s) {
  if (s.v < 2) {                   // v0.1 -> v0.2: new one-screen farm layout; keep money, seeds and basket
    const f = fresh(Date.now());
    s = { ...f, coins: s.coins, seeds: s.seeds, basket: (s.basket || []).filter(c => CFG.crops[c.crop]), seen: {}, stats: { ...f.stats, ...(s.stats || {}) } };
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
