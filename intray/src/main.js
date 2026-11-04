// KELVIN'S IN-TRAY (Game By Vote mini-game #2, prototype).
// Drop expense claims into Kelvin's in-tray. Two of the same merge into a bigger, dodgier claim:
// kopi → bubble tea → mee pok → ang bao → durian → Grab → karaoke → Genting → goat → massage chair → BTO.
// If the pile overflows the red line, Kelvin AUDITS you. ?bot=1 plays by itself (for Reels).
import Matter from 'matter-js';
import { sfx, unlock } from './sfx.js';

const { Engine, Bodies, Composite, Events, Body } = Matter;
const q = new URLSearchParams(location.search);
const BOT = q.has('bot');
const TIERS = [
  { e: '☕', n: 'Kopi-C', r: 15, c: '#c99a5b', v: 1.4 },
  { e: '🧋', n: 'Bubble tea', r: 19, c: '#f0c8a0', v: 6.9 },
  { e: '🍜', n: 'Mee pok', r: 24, c: '#ffd27a', v: 12 },
  { e: '🧧', n: 'Ang bao', r: 29, c: '#ff8a7a', v: 28 },
  { e: '🌰', n: 'Durian', r: 35, c: '#b8d86a', v: 68 },
  { e: '🚕', n: 'Grab to JB', r: 42, c: '#ffe066', v: 92 },
  { e: '🎤', n: 'Karaoke', r: 49, c: '#c9a0ff', v: 150 },
  { e: '🎰', n: 'Genting, 1 pax', r: 57, c: '#ff7ad0', v: 480 },
  { e: '🐐', n: 'Live goat', r: 66, c: '#e8e0d0', v: 450 },
  { e: '💺', n: 'Massage chair', r: 76, c: '#8ad4ff', v: 1299 },
  { e: '🏠', n: 'BTO downpayment', r: 88, c: '#7fd88a', v: 9999 },
];
const LINES = {
  4: ['A durian. In MY tray.', 'I can smell this claim.'],
  5: ['Grab to JB. Noted.', 'Per my last email: no.'],
  6: ['"Karaoke workshop." Sure.', 'I am writing this down.'],
  7: ['Genting. ONE pax. Again.', 'This is a cry for help.'],
  8: ['A GOAT.', 'Why is there a goat.'],
  9: ['A massage chair?!', 'I need to sit down.'],
  10: ['A BTO. Explain.', 'I am calling HR.'],
};
const IDLE = ['Senior Accounting. SENIOR.', 'Every claim is logged.', "Don't overflow my tray.", 'I am watching. Closely.'];

// ---------- seeded random (the bot is repeatable) ----------
let seed = BOT ? 7 : Date.now() % 100000;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = a => a[Math.floor(rnd() * a.length)];

// ---------- canvas, logical units: 390 wide ----------
const cv = document.getElementById('c'), cx = cv.getContext('2d');
let W = 390, H = 700, S = 1, DPR = 1;
const kel = new Image(); kel.src = new URL('sprites/kelvin.png', document.baseURI).href;
function resize() {
  DPR = Math.min(3, devicePixelRatio || 1);
  const vw = innerWidth, vh = innerHeight, cw = BOT ? vw : Math.min(vw, vh * 0.62, 520);
  S = cw / 390; W = 390; H = vh / S;
  cv.width = Math.round(cw * DPR); cv.height = Math.round(vh * DPR);
  cv.style.width = cw + 'px'; cv.style.height = vh + 'px';
  layout();
}

// ---------- world ----------
let engine, tray, walls = [], dangerY, dropY, items = [], parts = [], pops = [];
const st = { total: 0, best: +(localStorage.getItem('intray.best') || 0), next: 0, cur: 0, x: 195, canDrop: true, over: false, danger: 0,
  kShake: 0, kBounce: 0, say: 'Claims go in the tray. Matching ones merge.', sayT: 0, shake: 0, maxTier: 0, drops: 0 };
function layout() {
  const top = Math.max(220, H * 0.33);
  tray = { x0: 18, x1: 372, y0: top, y1: H - 16 };
  dangerY = tray.y0 + 14; dropY = tray.y0 - 26;
  if (engine) for (const w of walls) Composite.remove(engine.world, w);
  if (!engine) return;
  const th = 60, { x0, x1, y0, y1 } = tray;
  walls = [Bodies.rectangle((x0 + x1) / 2, y1 + th / 2, x1 - x0 + 2 * th, th, { isStatic: true }),
    Bodies.rectangle(x0 - th / 2, (y0 + y1) / 2 - 200, th, y1 - y0 + 400, { isStatic: true }),
    Bodies.rectangle(x1 + th / 2, (y0 + y1) / 2 - 200, th, y1 - y0 + 400, { isStatic: true })];
  Composite.add(engine.world, walls);
}
function newGame() {
  engine = Engine.create(); engine.gravity.y = 1.15;
  items = []; parts = []; pops = [];
  Object.assign(st, { total: 0, next: Math.floor(rnd() * 3), cur: Math.floor(rnd() * 3), canDrop: true, over: false, danger: 0, maxTier: 0, drops: 0, t0: performance.now() });
  layout();
  Events.on(engine, 'collisionStart', ev => { for (const p of ev.pairs) merge(p.bodyA, p.bodyB); });
  document.getElementById('over').classList.remove('on');
  say('Claims go in the tray. Matching ones merge.');
}
function addItem(tier, x, y, vy = 0) {
  const t = TIERS[tier], b = Bodies.circle(x, y, t.r, { restitution: 0.15, friction: 0.35, frictionStatic: 0.6, density: 0.0012 * (1 + tier * 0.08) });
  b.tier = tier; b.born = performance.now(); b.pop = 0;
  if (vy) Body.setVelocity(b, { x: 0, y: vy });
  Composite.add(engine.world, b); items.push(b); return b;
}
function merge(a, b) {
  if (st.over || a.tier == null || a.tier !== b.tier || a.dead || b.dead) return;
  a.dead = b.dead = true;
  const t = a.tier, x = (a.position.x + b.position.x) / 2, y = (a.position.y + b.position.y) / 2;
  setTimeout(() => {
    Composite.remove(engine.world, a); Composite.remove(engine.world, b);
    items = items.filter(i => i !== a && i !== b);
    const nt = Math.min(TIERS.length - 1, t + 1);
    if (t === TIERS.length - 1) { st.total += TIERS[t].v * 3; burst(x, y, '#ffcf5c', 40); popText(x, y, 'CLAIM APPROVED?!', 26); st.shake = 18; return; }
    const n = addItem(nt, x, y); n.pop = 1;
    st.total += TIERS[nt].v; st.maxTier = Math.max(st.maxTier, nt);
    burst(x, y, TIERS[nt].c, 10 + nt * 3);
    popText(x, y - TIERS[nt].r, `+$${fmt(TIERS[nt].v)} ${TIERS[nt].e}`, 12 + nt * 1.6);
    if (nt >= 4) { st.shake = 4 + nt * 1.5; st.kBounce = 1; say(pick(LINES[nt] || LINES[10])); }
    sfx.harvest(Math.min(3, Math.floor(nt / 3))); if (nt >= 7) sfx.beepClick();
  }, 0);
}
function drop() {
  if (!st.canDrop || st.over) return;
  const r = TIERS[st.cur].r, x = Math.max(tray.x0 + r + 2, Math.min(tray.x1 - r - 2, st.x));
  addItem(st.cur, x, dropY, 2); st.drops++;
  st.cur = st.next; st.next = Math.floor(rnd() * (st.drops > 6 ? 5 : 3)); st.canDrop = false;
  sfx.tap(); setTimeout(() => (st.canDrop = true), BOT ? (performance.now() - st.t0 > 11000 ? 280 : 380) : 420);
}

// ---------- effects ----------
const fmt = n => n >= 1000 ? n.toLocaleString('en-SG', { maximumFractionDigits: 0 }) : (Math.round(n * 100) / 100).toString();
function burst(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, v = 1 + rnd() * 4; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1, col }); } }
function popText(x, y, text, size) { pops.push({ x, y, text, size, life: 1 }); }
function say(t) { st.say = t; st.sayT = performance.now(); }

// ---------- audit (game over) ----------
function audit() {
  st.over = true; st.kShake = 1; st.shake = 22; sfx.stamp(); sfx.buzz();
  say('AUDIT. EVERYONE. NOW.');
  for (const b of items) Body.setVelocity(b, { x: (rnd() - .5) * 14, y: -6 - rnd() * 8 });
  engine.gravity.y = 0.6;
  if (st.total > st.best) { st.best = Math.round(st.total * 100) / 100; try { localStorage.setItem('intray.best', st.best); } catch (e) {} }
  if (BOT) return;
  setTimeout(() => {
    const card = document.getElementById('card'), top = TIERS[st.maxTier];
    card.innerHTML = `<div style="font-size:8px;color:#6b5a7a">KELVIN'S IN-TRAY · OVERFLOWED</div><h1>AUDITED</h1>
      <div>You claimed</div><div class="big">$${fmt(st.total)}</div>
      <div>Biggest claim: <span class="em">${top.e}</span> ${top.n}</div><div style="font-size:8px;color:#6b5a7a">Best: $${fmt(st.best)}</div>
      <button id="again">CLAIM AGAIN 🧾</button><button class="alt" id="share">SHARE</button>`;
    document.getElementById('over').classList.add('on');
    document.getElementById('again').onclick = () => { unlock(); newGame(); };
    document.getElementById('share').onclick = async () => {
      const text = `Kelvin audited me 🧾\nI claimed $${fmt(st.total)} · biggest: ${top.e} ${top.n}\nheeloo123.github.io/gamebyvote`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); document.getElementById('share').textContent = 'COPIED ✔'; } } catch (e) {}
    };
  }, 1300);
}

// ---------- the bot: plays like a slightly greedy human ----------
function botStep(now) {
  if (st.over || !st.canDrop) return;
  const cur = st.cur, same = items.filter(b => b.tier === cur && !b.dead && now - b.born > 300);
  let x;
  const greedy = now - st.t0 > 11000;                 // ~11 s in                      // late game: the bot gets greedy and stacks the middle
  if (greedy) x = W / 2 + (rnd() - .5) * 40;
  else if (same.length && rnd() < 0.8) { const b = same.sort((a, c) => a.position.y - c.position.y)[0]; x = b.position.x + (rnd() - .5) * 8; }
  else x = tray.x0 + 30 + rnd() * (tray.x1 - tray.x0 - 60);
  if (greedy) st.cur = [3, 6, 4, 7, 5, 8][st.drops % 6];   // big mismatched claims: the tower grows
  st.x = x; drop();
}

// ---------- input ----------
const toWorld = e => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / S; };
if (!BOT) {
  cv.addEventListener('pointerdown', e => { unlock(); st.x = toWorld(e); });
  cv.addEventListener('pointermove', e => { st.x = toWorld(e); });
  cv.addEventListener('pointerup', e => { st.x = toWorld(e); drop(); });
}

// ---------- draw ----------
function circleItem(x, y, t, angle = 0, scale = 1, alpha = 1) {
  const T = TIERS[t], r = T.r * scale;
  cx.save(); cx.globalAlpha = alpha; cx.translate(x, y); cx.rotate(angle);
  cx.fillStyle = T.c; cx.strokeStyle = '#2b1d3a'; cx.lineWidth = 3;
  cx.beginPath(); cx.arc(0, 0, r, 0, 6.283); cx.fill(); cx.stroke();
  cx.fillStyle = '#ffffff55'; cx.beginPath(); cx.arc(-r * .35, -r * .35, r * .28, 0, 6.283); cx.fill();
  cx.font = `${Math.round(r * 1.15)}px system-ui,"Apple Color Emoji","Noto Color Emoji",sans-serif`;
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(T.e, 0, r * .06);
  cx.restore();
}
function px(text, x, y, size, col = '#fff', align = 'center', outline = true) {
  cx.font = `${size}px P,monospace`; cx.textAlign = align; cx.textBaseline = 'middle';
  if (outline) { cx.lineWidth = Math.max(3, size / 3); cx.strokeStyle = '#2b1d3a'; cx.strokeText(text, x, y); }
  cx.fillStyle = col; cx.fillText(text, x, y);
}
function frame(now) {
  if (BOT) botStep(now);
  if (engine) Engine.update(engine, 1000 / 60);
  // overflow check: settled items above the red line
  if (!st.over) {
    const high = items.some(b => !b.dead && now - b.born > 900 && b.position.y - TIERS[b.tier].r < dangerY);
    st.danger = high ? st.danger + 1 / 60 : Math.max(0, st.danger - 1 / 120);
    const near = items.some(b => now - b.born > 900 && b.position.y - TIERS[b.tier].r < dangerY + 60);
    if (near && now - st.sayT > 2500) say(pick(["It's overflowing. I can see it.", 'My tray. My rules. My panic.', 'Stop. STOP.']));
    if (st.danger > 1.4) audit();
  }
  if (!st.over && now - st.sayT > 7000) say(pick(IDLE));

  cx.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
  const sh = st.shake > 0 ? (st.shake -= .6, st.shake) : 0;
  cx.save(); if (sh) cx.translate((rnd() - .5) * sh, (rnd() - .5) * sh);
  // office wall + desk
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2d52'); g.addColorStop(1, '#2b1d3a');
  cx.fillStyle = g; cx.fillRect(-20, -20, W + 40, H + 40);
  cx.fillStyle = '#8a6a4a'; cx.fillRect(-20, tray.y0 - 48, W + 40, 22); cx.fillStyle = '#6a4f36'; cx.fillRect(-20, tray.y0 - 26, W + 40, 6);
  // Kelvin, big, behind the tray
  const kb = st.kBounce > 0 ? (st.kBounce -= .05, Math.sin(st.kBounce * 9) * st.kBounce) : 0, ks = st.over ? Math.sin(now / 30) * 6 : 0;
  const kw = Math.min(170, tray.y0 - 70), kx = W / 2 - kw / 2 + ks, ky = tray.y0 - 44 - kw + kb * -10;
  cx.imageSmoothingEnabled = false;
  if (kel.complete) {
    cx.save(); if (st.over) cx.filter = 'hue-rotate(120deg) saturate(2)';
    cx.drawImage(kel, kx, ky, kw * (1 + kb * .06), kw * (1 - kb * .06)); cx.restore();
  }
  if (st.danger > 0 || st.over) { cx.font = '26px system-ui,"Noto Color Emoji",sans-serif'; cx.textAlign = 'center'; cx.fillText('💦', kx + kw * .85, ky + kw * .25 + Math.sin(now / 120) * 3); }
  // speech bubble
  cx.font = '9px P,monospace'; const tw = Math.min(170, cx.measureText(st.say).width + 18), nl = wrap(st.say, 0, 0, tw - 18, 12, true);
  const bx = Math.min(W - tw - 6, kx + kw * .78), by = Math.max(70, ky + 24);
  cx.fillStyle = '#fff'; cx.strokeStyle = '#2b1d3a'; cx.lineWidth = 3;
  cx.beginPath(); cx.roundRect(bx, by, tw, 16 + nl * 12, 8); cx.fill(); cx.stroke();
  wrap(st.say, bx + 9, by + 14, tw - 18, 12);
  // claim total
  px(`CLAIM: $${fmt(st.total)}`, 14, 26, 15, '#ffcf5c', 'left');
  px(`BEST $${fmt(st.best)}`, 14, 48, 8, '#c9b8e8', 'left', false);
  // next
  px('NEXT', W - 46, 22, 8, '#c9b8e8', 'center', false); circleItem(W - 46, 50, st.next, 0, Math.min(1, 18 / TIERS[st.next].r));
  // tray glass
  const { x0, x1, y0, y1 } = tray;
  cx.fillStyle = '#ffffff14'; cx.fillRect(x0, y0, x1 - x0, y1 - y0);
  cx.strokeStyle = '#c9e8ff'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(x0, y0 - 10); cx.lineTo(x0, y1); cx.lineTo(x1, y1); cx.lineTo(x1, y0 - 10); cx.stroke();
  // danger line
  cx.save(); cx.setLineDash([10, 8]); cx.lineWidth = 3;
  cx.strokeStyle = st.danger > 0 ? (Math.floor(now / 120) % 2 ? '#ff3b3b' : '#ffffff') : '#ff7a6a88';
  cx.beginPath(); cx.moveTo(x0, dangerY); cx.lineTo(x1, dangerY); cx.stroke(); cx.restore();
  // aim + held item
  if (!st.over && st.canDrop) {
    const r = TIERS[st.cur].r, ax = Math.max(x0 + r + 2, Math.min(x1 - r - 2, st.x));
    cx.strokeStyle = '#ffffff33'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(ax, dropY); cx.lineTo(ax, y1); cx.stroke();
    circleItem(ax, dropY, st.cur);
  }
  // items
  for (const b of items) {
    if (b.pop > 0) b.pop = Math.max(0, b.pop - .06);
    circleItem(b.position.x, b.position.y, b.tier, b.angle, 1 + b.pop * .35);
  }
  // particles + pop texts
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .15; p.life -= .025; cx.fillStyle = p.col; cx.globalAlpha = Math.max(0, p.life); cx.fillRect(p.x - 3, p.y - 3, 6, 6); }
  cx.globalAlpha = 1; parts = parts.filter(p => p.life > 0);
  for (const t of pops) { t.y -= .8; t.life -= .014; cx.globalAlpha = Math.max(0, Math.min(1, t.life * 2)); px(t.text, t.x, t.y, t.size, '#ffcf5c'); }
  cx.globalAlpha = 1; pops = pops.filter(t => t.life > 0);
  if (st.over) {                                   // the AUDIT stamp
    cx.save(); cx.translate(W / 2, H * .45); cx.rotate(-.18);
    cx.strokeStyle = '#d9443a'; cx.lineWidth = 7; cx.fillStyle = '#fffd';
    cx.beginPath(); cx.roundRect(-140, -40, 280, 80, 10); cx.fill(); cx.stroke();
    px('AUDIT!', 0, 4, 40, '#d9443a', 'center', false); cx.restore();
  }
  cx.restore();
  requestAnimationFrame(frame);
}
function wrap(text, x, y, w, lh, measure) {
  cx.font = '9px P,monospace'; cx.fillStyle = '#2b1d3a'; cx.textAlign = 'left'; cx.textBaseline = 'middle';
  const words = text.split(' '); let line = '', yy = y, n = 1;
  for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (cx.measureText(t).width > w && line) { if (!measure) cx.fillText(line, x, yy); line = wd; yy += lh; n++; } else line = t; }
  if (!measure) cx.fillText(line, x, yy);
  return n;
}

addEventListener('resize', resize);
(async () => {
  try { await document.fonts.load('10px P'); } catch (e) {}
  resize(); newGame(); requestAnimationFrame(frame);
})();
window.GBV = { st, get items() { return items; } };
