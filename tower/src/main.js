// FLING KELVIN: 渡劫 TOWER (concept prototype).
// Pull back and fling Kelvin up the office tower. He smashes through ceilings (one floor = one cultivation realm),
// sprays the office, and racks up a damage bill. After each fling, pick a trait that changes his physics.
// 5 flings per run, then the death card. ?bot=1 plays a scripted run (for Reels).
import Matter from 'matter-js';
import { sfx, unlock } from './sfx.js';

const { Engine, Bodies, Composite, Body, Events } = Matter;
const q = new URLSearchParams(location.search), BOT = q.has('bot');
const W = 390, FH = 430, FLINGS = BOT ? 3 : 5, KR = 66;
const REALMS = [[1, '练气', 'Intern'], [3, '筑基', 'Executive'], [5, '金丹', 'Manager'], [7, '元婴', 'Director'], [9, '渡劫', 'Performance Review']];
const ROOMS = ['Lobby', 'Pantry', 'Finance', 'HR', 'Server Room', 'Meeting Room', 'Sales', 'Boss Tan', 'Rooftop', 'Cloud'];
const PROPS = ['☕', '🪴', '🖨️', '🗂️', '🧋', '📎', '💻', '🍱', '🧾', '📠'];
const DEATHS = ['died of KPI', 'died of a CPF statement', 'died of reply-all', 'died of a 9am meeting', 'died of "per my last email"', 'died of team bonding'];
const TRAITS = { bouncy: { ic: '🟢', n: 'Bouncy' }, heavy: { ic: '🧱', n: 'Heavy' }, kopi: { ic: '☕', n: 'Kopi Rush' } };
const realm = fl => REALMS.filter(r => fl >= r[0]).at(-1);

let seed = BOT ? 5 : (Date.now() % 1e6) + 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];

// ---------- canvas ----------
const cv = document.getElementById('c'), cx = cv.getContext('2d');
let H = 700, S = 1, DPR = 1;
const kimg = new Image(); kimg.src = new URL('sprites/kelvin.png', document.baseURI).href;
function resize() {
  DPR = Math.min(3, devicePixelRatio || 1);
  const vw = innerWidth, vh = innerHeight, cw = BOT ? vw : Math.min(vw, vh * 0.62, 520);
  S = cw / W; H = vh / S;
  cv.width = Math.round(cw * DPR); cv.height = Math.round(vh * DPR); cv.style.width = cw + 'px'; cv.style.height = vh + 'px';
}

// ---------- world ----------
let engine, kel, tiles = [], props = [], parts = [], pops = [];
const st = {};
function newRun() {
  engine = Engine.create(); engine.gravity.y = 1.1;
  tiles = []; props = []; parts = []; pops = [];
  Object.assign(st, { flings: FLINGS, damage: 0, floor: 1, best: 1, traits: [], mode: 'aim', anchor: { x: W / 2, y: -KR - 30 }, pull: { x: 0, y: 0 }, dragging: false,
    rest: 0, shake: 0, hit: 0, cam: -H * 0.62, say: 'Fling him.', over: false, slot: null, flown: false });
  const wallH = FH * 14;
  Composite.add(engine.world, [Bodies.rectangle(W / 2, 30, W * 2, 60, { isStatic: true }),
    Bodies.rectangle(-30, -wallH / 2, 60, wallH, { isStatic: true }), Bodies.rectangle(W + 30, -wallH / 2, 60, wallH, { isStatic: true })]);
  for (let f = 1; f <= 12; f++) {                      // ceiling of floor f = floor of floor f+1, made of breakable tiles
    const y = -f * FH;
    for (let i = 0; i < 6; i++) { const t = Bodies.rectangle(32.5 + i * 65, y, 65, 22, { isStatic: true, label: 'tile' }); t.floor = f; tiles.push(t); }
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) addProp(40 + rnd() * (W - 80), y - 45);            // props stand on this ceiling = next floor's floor
  }
  for (let i = 0; i < 4; i++) addProp(40 + rnd() * (W - 80), -40);   // ground floor props
  Composite.add(engine.world, tiles);
  kel = Bodies.circle(st.anchor.x, st.anchor.y, KR, { restitution: 0.4, friction: 0.15, frictionAir: 0.004, density: 0.002, label: 'kelvin' });
  Body.setStatic(kel, true);
  Composite.add(engine.world, kel);
  Events.on(engine, 'collisionStart', ev => { for (const p of ev.pairs) collide(p.bodyA, p.bodyB, p); });
  document.getElementById('over').classList.remove('on');
}
function addProp(x, y) {
  const e = pick(PROPS), r = 13 + rnd() * 9, b = Bodies.circle(x, y, r, { restitution: 0.5, friction: 0.3, density: 0.0006, label: 'prop' });
  b.e = e; b.r = r; props.push(b); Composite.add(engine.world, b);
}
const hasT = t => st.traits.includes(t);
function collide(a, b, pair) {
  const k = a === kel ? a : b === kel ? b : null; if (!k || st.mode !== 'fly') return;
  const o = k === a ? b : a, sp = Math.hypot(kel.velocity.x, kel.velocity.y);
  if (o.label === 'tile' && !o.isSensor && kel.velocity.y < -2 && kel.position.y > o.position.y && sp * (hasT('heavy') ? 1.7 : 1) > 6.5) {
    // smash up through the ceiling: the tile lets him pass, then becomes the (cracked) floor of the next storey
    pair.isActive = false; pair.isSensor = true; o.isSensor = true; o.cracked = true;
    burst(o.position.x, o.position.y, ['#e8dcc0', '#c9b896', '#ffcf5c'], 26, 6); chunks(o.position.x, o.position.y);
    addDamage(o.position.x, o.position.y, 40 + Math.round(rnd() * 60));
    const first = !st.smashed; st.smashed = true;
    st.hit = first ? 9 : 4; st.shake = first ? 16 : 10; st.flash = first ? 1 : .45; sfx.stamp(); navigator.vibrate?.(25);
    if (first) burst(o.position.x, o.position.y, ['#ffffff', '#efe6cf', '#ffcf5c'], 30, 9);
    Body.setVelocity(kel, { x: kel.velocity.x, y: kel.velocity.y * (hasT('heavy') ? 0.95 : 0.86) });
  } else if (o.label === 'prop' && sp > 3) {
    burst(o.position.x, o.position.y, ['#ffcf5c', '#fff'], 8, 4); addDamage(o.position.x, o.position.y - 10, 5 + Math.round(rnd() * 20));
    Body.setVelocity(o, { x: (o.position.x - kel.position.x) * 0.25, y: -6 - rnd() * 6 }); sfx.tap();
  } else if (sp > 6) { st.shake = 5; sfx.step(); }
}
function addDamage(x, y, v) { st.damage += v; if (v >= 30 && !pops.length) pops.push({ x, y, t: `+S$${v}`, s: 16 + Math.min(10, v / 10), life: .8 }); }
function chunks(x, y) { for (let i = 0; i < 4; i++) parts.push({ x: x + (rnd() - .5) * 40, y, vx: (rnd() - .5) * 8, vy: -3 - rnd() * 5, life: 1.4, c: '#efe6cf', s: 14 + rnd() * 10, rot: rnd() * 6, edge: 1 }); }
function burst(x, y, cols, n, sp) { for (let i = 0; i < n; i++) { const a = rnd() * 6.28, v = 1 + rnd() * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, c: pick(cols), s: 3 + rnd() * 5, rot: rnd() * 6 }); } }

// ---------- fling ----------
function release() {
  if (st.mode !== 'aim') return;
  const p = st.pull, len = Math.hypot(p.x, p.y); st.dragging = false;
  if (len < 25) { st.pull = { x: 0, y: 0 }; Body.setPosition(kel, st.anchor); return; }
  const pow = 0.2 * (hasT('kopi') ? 1.35 : 1);
  Body.setStatic(kel, false);
  Body.setVelocity(kel, { x: -p.x * pow, y: -p.y * pow });
  Body.setAngularVelocity(kel, (rnd() - .5) * 0.3);
  kel.restitution = hasT('bouncy') ? 0.88 : 0.4; Body.setDensity(kel, hasT('heavy') ? 0.005 : 0.002);
  st.mode = 'fly'; st.flings--; st.rest = 0; st.flown = true; st.say = pick(['WAAAH', 'PER MY LAST EMAIL', 'NOT THE FACE', 'I AM SENIOR']);
  sfx.swish(); setTimeout(() => sfx.beepClick(), 120);
}
function landed() {
  st.mode = st.flings > 0 ? 'slot' : 'dead';
  Body.setVelocity(kel, { x: 0, y: 0 }); Body.setAngularVelocity(kel, 0);
  if (st.mode === 'dead') return die();
  st.slot = { opts: Object.keys(TRAITS), spin: 36, chosen: null };
  sfx.harvest(1);
}
function chooseTrait(i) {
  if (!st.slot || st.slot.spin > 0) return;
  const t = st.slot.opts[i]; st.traits.push(t); st.slot = null; sfx.harvest(3);
  pops.push({ x: kel.position.x, y: kel.position.y - KR - 20, t: `${TRAITS[t].ic} ${TRAITS[t].n.toUpperCase()}!`, s: 16, life: 1.2 });
  Body.setStatic(kel, true); st.anchor = { x: Math.max(KR + 8, Math.min(W - KR - 8, kel.position.x)), y: kel.position.y }; Body.setPosition(kel, st.anchor); Body.setAngle(kel, 0);
  st.mode = 'aim'; st.pull = { x: 0, y: 0 }; st.say = pick(['Again?!', 'Do not.', 'I will invoice this.']);
}
function die() {
  const r = realm(st.best), cause = pick(DEATHS);
  sfx.stamp(); sfx.buzz(); st.over = true;
  st.card = { r, cause };
  if (BOT) return;
  setTimeout(() => {
    const c = document.getElementById('card');
    c.innerHTML = `<div style="font-size:8px;color:#6b5a7a">KELVIN · ${r[1]} REALM</div><h1>FLOOR ${st.best}</h1>
      <div class="big">S$${st.damage.toLocaleString()}</div><div>damage · ${cause}</div>
      <div class="em" style="margin-top:6px">${st.traits.map(t => TRAITS[t].ic).join(' ') || '—'}</div>
      <button id="again">FLING AGAIN 🚀</button><button class="alt" id="share">SHARE</button>`;
    document.getElementById('over').classList.add('on');
    document.getElementById('again').onclick = () => { unlock(); newRun(); };
    document.getElementById('share').onclick = async () => {
      const text = `Kelvin reached ${r[1]} realm, floor ${st.best}. S$${st.damage} damage. He ${cause}.\nheeloo123.github.io/gamebyvote`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); document.getElementById('share').textContent = 'COPIED ✔'; } } catch (e) {}
    };
  }, 900);
}

// ---------- input ----------
const toWorld = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S + st.cam }; };
if (!BOT) {
  cv.addEventListener('pointerdown', e => {
    unlock(); const p = toWorld(e);
    if (st.slot && st.slot.spin <= 0) { const i = Math.floor((p.x - 15) / 120); if (i >= 0 && i < 3) chooseTrait(i); return; }
    if (st.mode === 'aim') { st.dragging = true; st.d0 = p; }
  });
  cv.addEventListener('pointermove', e => { if (!st.dragging) return; const p = toWorld(e); setPull(p.x - st.d0.x, p.y - st.d0.y); });
  cv.addEventListener('pointerup', release);
}
function setPull(x, y) {
  const len = Math.hypot(x, y), m = Math.min(len, 150) / (len || 1);
  st.pull = { x: x * m, y: y * m }; Body.setPosition(kel, { x: st.anchor.x + st.pull.x * .5, y: st.anchor.y + st.pull.y * .5 });
}

// ---------- the bot (a scripted run for Reels) ----------
const BOTRUN = [{ x: 4, y: 150, t: 'heavy' }, { x: -30, y: 150, t: 'bouncy' }, { x: 26, y: 150, t: 'kopi' }, { x: -10, y: 150, t: 'heavy' }, { x: 15, y: 150 }];
let botI = 0, botT = 0;
let botGo = !q.has('wait');                          // ?wait=1: start when the Reel composer sends {beat:'go'}
addEventListener('message', e => { if (e.data && e.data.beat === 'go') botGo = true; });
function botStep() {
  if (!botGo) return;
  botT++;
  const w0 = st.flown ? 30 : 0, w1 = st.flown ? 30 : 10, w2 = st.flown ? 72 : 16;   // first fling: pulled back from frame 1, released at 0.25 s
  if (st.mode === 'aim' && botT > w0) {
    const g = BOTRUN[Math.min(botI, BOTRUN.length - 1)], k = Math.min(1, (botT - w0) / w1);
    setPull(g.x * k, g.y * k);
    if (botT > w2) { release(); botT = 0; }
  } else if (st.slot && st.slot.spin <= 0 && botT > 20) {
    const g = BOTRUN[Math.min(botI, BOTRUN.length - 1)], i = Math.max(0, st.slot.opts.indexOf(g.t));
    if (g.t && !st.slot.opts.includes(g.t)) st.slot.opts[1] = g.t;
    chooseTrait(g.t ? st.slot.opts.indexOf(g.t) : i); botI++; botT = 0;
  } else if (st.mode === 'fly') botT = 0;
}

// ---------- loop (fixed 60 Hz physics, any display rate) ----------
let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last); last = now; acc += dt;
  while (acc >= 1000 / 60) { acc -= 1000 / 60; step(); }
  draw(now); requestAnimationFrame(frame);
}
function step() {
  if (BOT) botStep();
  if (st.hit > 0) { st.hit--; return; }               // hit-stop
  Engine.update(engine, 1000 / 60);
  if (st.slot && st.slot.spin > 0) { st.slot.spin--; if (st.slot.spin % 4 === 0) { st.slot.opts = [...st.slot.opts.slice(1), st.slot.opts[0]]; sfx.tap(); } }
  for (const t of tiles) if (t.isSensor && (kel.position.y + KR < t.position.y - 12 || Math.abs(kel.position.x - t.position.x) > KR + 40)) t.isSensor = false;   // closes behind him
  if (st.mode === 'fly') {
    const sp = Math.hypot(kel.velocity.x, kel.velocity.y);
    st.rest = sp < 1.4 ? st.rest + 1 : 0; st.flyT = (st.flyT || 0) + 1;
    const fl = Math.max(1, Math.floor(-(kel.position.y - KR) / FH) + 1);
    if (fl > st.best) {
      const nr = realm(fl), or = realm(st.best); st.best = fl;
      if (nr !== or) { pops = [{ x: W / 2, y: kel.position.y - 150, t: `${nr[1]} ${nr[2].toUpperCase()}!`, s: 28, life: 1.8, col: '#ff9ee0' }]; sfx.morning(); st.shake = 14; }
      else if (!BOT) pops.push({ x: W / 2, y: kel.position.y - 100, t: `${fl}F · ${ROOMS[(fl - 1) % ROOMS.length]}`, s: 18, life: 1.4 });
    }
    if (st.rest > 18 || st.flyT > 170) { st.flyT = 0; landed(); }
  }
  const target = kel.position.y - H * 0.58;
  st.cam += (Math.min(-H + 60, target) - st.cam) * 0.08;
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .25; p.life -= .02; p.rot += .2; }
  parts = parts.filter(p => p.life > 0);
  for (const t of pops) { t.y -= .7; t.life -= .012; }
  pops = pops.filter(t => t.life > 0);
  if (st.shake > 0) st.shake *= 0.88;
}

// ---------- draw ----------
function px(text, x, y, size, col = '#fff', align = 'center') {
  cx.font = `${size}px P,monospace`; cx.textAlign = align; cx.textBaseline = 'middle';
  cx.lineWidth = Math.max(3, size / 3); cx.strokeStyle = '#2b1d3a'; cx.strokeText(text, x, y); cx.fillStyle = col; cx.fillText(text, x, y);
}
const WALLS = ['#f5b94e', '#4fc59a', '#8f7be8', '#f2766a', '#4ea8e8', '#e8d24e'];
function draw(now) {
  cx.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
  const sh = st.shake > .5 ? st.shake : 0;
  cx.save(); cx.translate((rnd() - .5) * sh, (rnd() - .5) * sh - st.cam);
  // floors (only those on screen)
  const top = st.cam, bot = st.cam + H, f0 = Math.max(0, Math.floor(-bot / FH)), f1 = Math.floor(-top / FH) + 1;
  for (let f = f0; f <= f1; f++) {
    const yb = -f * FH, yt = yb - FH;
    cx.fillStyle = WALLS[f % WALLS.length]; cx.fillRect(0, yt, W, FH);
    cx.fillStyle = '#00000022'; for (let i = 0; i < 3; i++) cx.fillRect(30 + i * 120, yt + 70, 80, 110);   // windows
    cx.fillStyle = '#ffffff55'; for (let i = 0; i < 3; i++) cx.fillRect(36 + i * 120, yt + 76, 30, 98);
    cx.fillStyle = '#8a6a4a'; cx.fillRect(0, yb - 8, W, 8);
    if (!BOT) { const r = realm(f + 1); px(`${f + 1}F ${r[1]} · ${ROOMS[f % ROOMS.length]}`, 12, yt + 36, 10, '#2b1d3a55', 'left'); }
  }
  cx.fillStyle = '#5a4670'; cx.fillRect(0, 0, W, 60);
  // ceiling tiles
  for (const t of tiles) { if (t.position.y < top - 30 || t.position.y > bot + 30) continue;
    cx.fillStyle = t.cracked ? '#c9b896' : '#efe6cf'; cx.strokeStyle = '#2b1d3a'; cx.lineWidth = 4; cx.fillRect(t.position.x - 32, t.position.y - 11, 64, 22); cx.strokeRect(t.position.x - 32, t.position.y - 11, 64, 22);
    if (t.cracked) { cx.beginPath(); cx.moveTo(t.position.x - 20, t.position.y - 11); cx.lineTo(t.position.x - 4, t.position.y + 2); cx.lineTo(t.position.x + 8, t.position.y - 6); cx.lineTo(t.position.x + 22, t.position.y + 11); cx.stroke(); } }
  // props
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  for (const b of props) { if (b.position.y < top - 40 || b.position.y > bot + 40) continue;
    cx.save(); cx.translate(b.position.x, b.position.y); cx.rotate(b.angle); cx.font = `${Math.round(b.r * 2)}px system-ui,"Noto Color Emoji",sans-serif`; cx.fillText(b.e, 0, 2); cx.restore(); }
  // slingshot (a lanyard between two posts)
  if (st.mode === 'aim') {
    const a = st.anchor, l = { x: a.x - KR - 10, y: a.y + KR * .3 }, r = { x: a.x + KR + 10, y: a.y + KR * .3 };
    cx.strokeStyle = '#2b1d3a'; cx.lineWidth = 8; cx.beginPath(); cx.moveTo(l.x, l.y + 60); cx.lineTo(l.x, l.y); cx.moveTo(r.x, r.y + 60); cx.lineTo(r.x, r.y); cx.stroke();
    cx.strokeStyle = '#d9443a'; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(l.x, l.y); cx.lineTo(kel.position.x, kel.position.y + KR * .5); cx.lineTo(r.x, r.y); cx.stroke();
    if (Math.hypot(st.pull.x, st.pull.y) > 20) {                        // aim dots
      const pow = 0.2 * (hasT('kopi') ? 1.35 : 1); let x = kel.position.x, y = kel.position.y, vx = -st.pull.x * pow, vy = -st.pull.y * pow;
      cx.fillStyle = '#ffffffcc'; for (let i = 0; i < 14; i++) { for (let j = 0; j < 3; j++) { x += vx; y += vy; vy += 1.1 * 0.36; } cx.beginPath(); cx.arc(x, y, 5 - i * .25, 0, 6.28); cx.fill(); }
    } else if (!st.flown || BOT) {
      const bob = Math.sin(now / 160) * 8; px('▼ PULL', a.x, a.y + KR + 52 + bob, 14, '#ffcf5c');
    }
  }
  // Kelvin, big, squashing along his velocity
  const v = kel.velocity, sp = Math.min(20, Math.hypot(v.x, v.y)), ang = Math.atan2(v.y, v.x), str = 1 + sp * 0.018;
  cx.save(); cx.translate(kel.position.x, kel.position.y);
  if (st.mode === 'fly' && sp > 2) { cx.rotate(ang); cx.scale(str, 1 / str); cx.rotate(-ang); }
  cx.rotate(st.mode === 'fly' ? kel.angle : 0); cx.imageSmoothingEnabled = false;
  const sz = KR * 2.3; if (kimg.complete) cx.drawImage(kimg, -sz / 2, -sz / 2 - 6, sz, sz);
  cx.restore();
  if (st.mode === 'fly' && sp > 4) px(st.say, kel.position.x, kel.position.y - KR - 26, 12, '#fff');
  // particles + pops
  for (const p of parts) { cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, p.life)); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); if (p.edge) { cx.strokeStyle = '#2b1d3a'; cx.lineWidth = 3; cx.strokeRect(-p.s / 2, -p.s / 2, p.s, p.s); } cx.restore(); }
  for (const t of pops) { cx.globalAlpha = Math.max(0, Math.min(1, t.life * 2)); px(t.t, t.x, t.y, t.s, t.col || '#ffcf5c'); }
  cx.globalAlpha = 1;
  cx.restore();
  if (st.flash > 0) { cx.fillStyle = `rgba(255,255,255,${st.flash * .8})`; cx.fillRect(0, 0, W, H); st.flash -= .08; }
  // HUD
  px(`S$${st.damage.toLocaleString()}`, 14, 34, BOT ? 30 : 20, '#ffcf5c', 'left');
  const r = realm(st.best); if (!BOT) px(`${st.best}F · ${r[1]} ${r[2]}`, 14, 58, 10, '#fff', 'left');
  for (let i = 0; i < FLINGS; i++) { cx.globalAlpha = i < st.flings ? 1 : .25; cx.imageSmoothingEnabled = false; if (kimg.complete) cx.drawImage(kimg, W - 30 - i * 26, 18, 24, 24); }
  cx.globalAlpha = 1;
  if (st.traits.length) { cx.font = '18px system-ui,"Noto Color Emoji",sans-serif'; cx.textAlign = 'right'; cx.fillText(st.traits.map(t => TRAITS[t].ic).join(''), W - 14, 58); }
  // trait slot
  if (st.slot) {
    cx.fillStyle = '#120c1ccc'; cx.fillRect(0, H * .3, W, 220);
    px('PICK A TRAIT', W / 2, H * .3 + 28, 16, '#fff');
    st.slot.opts.forEach((t, i) => {
      const x = 75 + i * 120, y = H * .3 + 120;
      cx.fillStyle = '#f6f3e8'; cx.strokeStyle = '#2b1d3a'; cx.lineWidth = 5; cx.beginPath(); cx.roundRect(x - 54, y - 64, 108, 128, 14); cx.fill(); cx.stroke();
      cx.font = '58px system-ui,"Noto Color Emoji",sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(TRAITS[t].ic, x, y - 14);
      cx.font = '9px P,monospace'; cx.fillStyle = '#2b1d3a'; cx.fillText(TRAITS[t].n.toUpperCase(), x, y + 42);
    });
  }
  // death card (bot / clip version drawn on canvas)
  if (st.over && st.card && BOT) {
    cx.fillStyle = '#120c1ccc'; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(W / 2, H * .42); cx.rotate(-.05);
    cx.fillStyle = '#f6f3e8'; cx.strokeStyle = '#2b1d3a'; cx.lineWidth = 4; cx.beginPath(); cx.roundRect(-160, -150, 320, 300, 10); cx.fill(); cx.stroke();
    cx.imageSmoothingEnabled = false; if (kimg.complete) cx.drawImage(kimg, -50, -140, 100, 100);
    px(`${st.card.r[1]} REALM · FLOOR ${st.best}`, 0, -20, 13, '#d9443a');
    px(`S$${st.damage.toLocaleString()}`, 0, 22, 26, '#ffcf5c');
    px(st.card.cause.toUpperCase(), 0, 66, 10, '#fff');
    px('🪦', 0, 110, 30);
    cx.restore();
  }
}

addEventListener('resize', resize);
(async () => { try { await document.fonts.load('10px P'); } catch (e) {} resize(); newRun(); requestAnimationFrame(frame); })();
window.GBV = { st, get kel() { return kel; } };
