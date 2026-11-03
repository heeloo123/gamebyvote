// Versioned save in localStorage. Updates only ever add fields (migrate), so votes never wipe a career.
import CFG from './data/config.json';

const KEY = 'gamebyvote.save';
export const SAVE_VERSION = 4;

export function fresh() {
  return {
    v: SAVE_VERSION,
    day: 1,                        // career day: decides which rules are active
    shift: null,                   // {date, day, ids, i, results:[{ok, kelvin}], caught, fooled}
    budget: CFG.budget.start,
    morale: CFG.morale.start,
    grudge: 0,                     // how often you've caught Kelvin (he gets pettier)
    yesterday: null,               // {caught, wrong, right}
    streak: 0,                     // perfect shifts in a row
    seenClaims: {},
    intro: false,
    stats: { shifts: 0, right: 0, wrong: 0, caught: 0, fooled: 0, fired: 0, overtime: 0 },
  };
}

function migrate(s) {
  if (s.v < 4) return fresh();     // the farm (v0.1–v0.4) became Claim Rejected: new career
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = migrate(JSON.parse(raw)); if (s && s.v) return s; }
  } catch (e) {}
  return fresh();
}

export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }
