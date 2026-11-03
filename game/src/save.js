// Versioned save in localStorage. Updates only ever add fields (migrate), so votes never wipe a farm.
import CFG from './data/config.json';

const KEY = 'gamebyvote.save';
export const SAVE_VERSION = 1;

export function fresh(now) {
  return {
    v: SAVE_VERSION,
    epoch: now,                    // game clock start (real ms); day n starts at epoch + n * dayLength
    offset: 0,                     // ms added by sleeping (skips to morning; crops grow too)
    coins: CFG.startCoins,
    seeds: CFG.startSeeds,
    basket: [],                    // harvested crops: {crop, rarity, mutation, value}
    plots: {},                     // "x,y" -> {plantedAt}
    nightsDone: -1,                // last day index whose night Kelvin already worked
    pendingBill: [],               // lines for the next morning's bill
    seen: {},                      // tutorial steps shown
    stats: { harvested: 0, sold: 0 },
    farmer: null,
  };
}

function migrate(s) {
  // v1 is the first version; future versions add fields here, e.g. if (s.v < 2) { s.newThing = ...; s.v = 2; }
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
