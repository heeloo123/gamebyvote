// Tiny synthesized sound effects (Web Audio), so the game ships with no audio files.
let ctx = null;
const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());

export function unlock() { try { ac().resume(); } catch (e) {} }

function tone(freq, dur, { type = 'square', vol = 0.06, at = 0, slide = 0 } = {}) {
  try {
    const a = ac(), t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function noise(dur, { vol = 0.15, at = 0, decay = 0.004 } = {}) {
  try {
    const a = ac(), n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * decay));
    const s = a.createBufferSource(), g = a.createGain(); g.gain.value = vol; s.buffer = buf; s.connect(g).connect(a.destination); s.start(a.currentTime + at);
  } catch (e) {}
}

export const sfx = {
  stamp: () => { noise(0.12, { vol: 0.35, decay: 0.012 }); tone(90, 0.14, { type: 'triangle', vol: 0.12, slide: -40 }); },
  swish: () => noise(0.18, { vol: 0.06, decay: 0.05 }),
  ding: () => { tone(1319, 0.08, { vol: 0.05 }); tone(1760, 0.16, { vol: 0.05, at: 0.08 }); },
  buzz: () => { tone(110, 0.25, { type: 'sawtooth', vol: 0.05 }); tone(116, 0.25, { type: 'sawtooth', vol: 0.05 }); },
  tap: () => tone(880, 0.05, { vol: 0.03 }),
  step: () => noise(0.03, { vol: 0.03, decay: 0.006 }),
  plant: () => { noise(0.08, { vol: 0.12, decay: 0.02 }); tone(220, 0.08, { type: 'triangle', vol: 0.08, slide: -80 }); },
  harvest: (tier = 0) => { const base = [523, 587, 659, 784][tier] || 523;
    [0, 4, 7, 12].forEach((s, i) => tone(base * 2 ** (s / 12), 0.12, { type: 'triangle', vol: 0.07, at: i * 0.06 })); if (tier >= 2) tone(base * 4, 0.3, { vol: 0.04, at: 0.26 }); },
  coin: () => { tone(988, 0.06, { vol: 0.05 }); tone(1319, 0.12, { vol: 0.05, at: 0.06 }); },
  buy: () => { tone(660, 0.05, { vol: 0.04 }); tone(880, 0.07, { vol: 0.04, at: 0.05 }); },
  nope: () => tone(160, 0.15, { type: 'sawtooth', vol: 0.04, slide: -40 }),
  beepClick: () => { tone(1760, 0.06, { vol: 0.06 }); tone(1760, 0.06, { vol: 0.06, at: 0.11 }); noise(0.03, { vol: 0.25, at: 0.22 }); },
  night: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.05, at: i * 0.18 })),
  morning: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.05, at: i * 0.12 })),
};
