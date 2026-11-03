// Game By Vote: the farm. One farm, bigger than the screen; the camera follows the farmer (Stardew feel).
// Day: plant, harvest, sell. Night: Kelvin from Accounting acts once. Morning: his bill.
import Phaser from 'phaser';
import CFG0 from './data/config.json';
import { T, INK, makeFarmer, makeTools, makeCrops, makeProps, drawFarm } from './art.js';
import { sfx, unlock } from './sfx.js';
import { load, save, wipe } from './save.js';
import * as UI from './ui.js';

const q = new URLSearchParams(location.search);
const DEBUG = q.has('debug');                       // ?debug=1: fast days and crops, for testing
const CFG = { ...CFG0, ...(DEBUG ? { dayLengthSec: 40, growSec: 6 } : {}) };
const DAY = CFG.dayLengthSec * 1000, GROW = CFG.growSec * 1000;
const WT = CFG.world.tilesW, HT = CFG.world.tilesH;

// ---------- farm layout (tiles) ----------
const plots = [];
for (let y = 13; y <= 15; y++) for (let x = 9; x <= 13; x++) plots.push([x, y]);
const L = {
  house: [2, 2, 7, 6], door: [4, 6], barn: [21, 2, 26, 6], pond: [3, 22, 8, 26],
  paths: [[4, 7, 4, 10], [4, 10, 21, 10], [21, 10, 21, 17]],
  trees: [[11, 22], [15, 25], [19, 28], [24, 25], [6, 30], [12, 33], [20, 33], [25, 31], [2, 15], [26, 12], [9, 28], [16, 19]],
  plots, votePlot: [[17, 13], [18, 13], [19, 13]],
  crate: [11, 9], stall: [14, 8, 16, 9], desk: [23, 18], sign: [20, 12],
  lamps: [[8, 11], [17, 11], [20, 16], [9, 20]],
  kelvinArea: [19, 16, 26, 22], start: [7, 9],
};
const key = (x, y) => x + ',' + y;
const tc = v => v * T + T / 2;                      // tile -> centre px

// ---------- time ----------
let S;                                              // the save
const now = () => Date.now() + S.offset;
const dayIndex = () => Math.floor((now() - S.epoch) / DAY);
const dayFrac = () => ((now() - S.epoch) % DAY) / DAY;
const isNight = () => dayFrac() >= CFG.nightStartsAt;
const nightAt = d => S.epoch + (d + CFG.nightStartsAt) * DAY;

const RAR = CFG.rarity, MUT = CFG.mutations;
const QUOTES = ['This farm is now a cost centre.', 'Please hold. Your tap matters to me.', "I've invoiced you for that.",
  'Per my last email: no.', 'Circling back to your carrots.', 'Senior Accounting. Senior.'];

class Farm extends Phaser.Scene {
  constructor() { super('farm'); }

  preload() { this.load.image('kelvin', 'sprites/kelvin.png'); }

  create() {
    makeFarmer(this); makeTools(this); makeCrops(this); makeProps(this);
    this.blocked = drawFarm(this, WT, HT, L);
    this.add.image(0, 0, 'farm').setOrigin(0).setDepth(-1000);
    const block = (x, y) => this.blocked.add(key(x, y));

    // props
    this.crate = this.add.image(tc(L.crate[0]), L.crate[1] * T + T, 'crate').setOrigin(.5, 1); block(...L.crate);
    this.stall = this.add.image((L.stall[0] + 1.5) * T, (L.stall[3] + 1) * T, 'stall').setOrigin(.5, 1);
    for (let y = L.stall[1]; y <= L.stall[3]; y++) for (let x = L.stall[0]; x <= L.stall[2]; x++) block(x, y);
    this.add.image(tc(L.desk[0]) + T / 2, L.desk[1] * T + T, 'desk').setOrigin(.5, 1).setDepth(L.desk[1] * T + T); block(...L.desk); block(L.desk[0] + 1, L.desk[1]);
    this.add.image(tc(L.sign[0]), L.sign[1] * T + T, 'sign').setOrigin(.5, 1).setDepth(L.sign[1] * T + T); block(...L.sign);
    this.lamps = L.lamps.map(([x, y]) => { block(x, y); this.add.image(tc(x), y * T + T, 'lamp').setOrigin(.5, 1).setDepth(y * T + T);
      return this.add.image(tc(x), y * T - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(5000).setScale(1.4).setAlpha(0); });
    [this.crate, this.stall].forEach(o => o.setDepth(o.y));

    // crops on plots + the three vote seeds
    this.cropSprites = {};
    for (const [x, y] of L.plots) this.cropSprites[key(x, y)] = this.add.image(tc(x), y * T + T - 2, 'crop0').setOrigin(.5, 1).setVisible(false).setDepth(y * T + T - 3);
    this.voteSeeds = L.votePlot.map(([x, y]) => this.add.image(tc(x), y * T + T - 4, 'crop0').setOrigin(.5, 1).setDepth(y * T + T - 3));

    // characters
    const st = S.farmer || L.start;
    this.farmer = this.add.image(tc(st[0]), st[1] * T + T - 1, 'f_down0').setOrigin(.5, 1);
    this.farmer.dir = 'down'; this.farmer.path = []; this.farmer.anim = 0;
    this.tool = this.add.image(0, 0, 'tool_hoe').setVisible(false);
    this.kelvin = this.add.image(tc(23), 20 * T + T, 'kelvin').setOrigin(.5, 1);
    this.kelvin.target = null; this.kelvin.next = 0;
    this.shadow = this.add.ellipse(0, 0, 10, 3, 0x000000, .25);

    // camera: zoomed in, follows the farmer
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WT * T, HT * T); cam.setRoundPixels(true);
    cam.startFollow(this.farmer, true, .12, .12, 0, 8);
    this.fit(); this.scale.on('resize', () => this.fit());

    // day / night tint over the view
    this.tint = this.add.rectangle(0, 0, 10, 10, 0x1a2a6a, 0).setOrigin(0).setScrollFactor(0).setDepth(4000);
    this.dust = this.add.particles(0, 0, 'px', { lifespan: 380, speed: { min: 4, max: 14 }, angle: { min: 200, max: 340 }, scale: { start: 1, end: 0 },
      tint: 0xd8c6a0, alpha: { start: .8, end: 0 }, emitting: false }).setDepth(3000);
    this.dirt = this.add.particles(0, 0, 'px', { lifespan: 500, speed: { min: 20, max: 50 }, angle: { min: 220, max: 320 }, gravityY: 120, scale: { start: 1, end: .5 },
      tint: [0x7a5536, 0x5a3e2a, 0x9a6a3e], emitting: false }).setDepth(3000);
    this.sparkle = this.add.particles(0, 0, 'px', { lifespan: 700, speed: { min: 20, max: 60 }, scale: { start: 1, end: 0 }, tint: [0xffcf5c, 0xffffff, 0xff9ee0], emitting: false }).setDepth(3001);

    this.input.on('pointerdown', p => { unlock(); if (!UI.modalOpen && !this.busy) this.tap(p.worldX, p.worldY); });
    this.lastNight = isNight(); this.lastDay = dayIndex();
    this.refreshCrops(); this.hud();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.tick() });
    this.time.addEvent({ delay: 4000, loop: true, callback: () => { S.farmer = [Math.floor(this.farmer.x / T), Math.floor((this.farmer.y - 1) / T)]; save(S); } });

    // Kelvin worked while you were away? Then the bill comes first.
    this.processNights();
    if (S.pendingBill.length && !isNight()) this.time.delayedCall(600, () => this.showBill());
    else this.tutorial();
    window.GBV = { scene: this, get state() { return S; }, skip: ms => { S.offset += ms; this.tick(); }, wipe: () => { wipe(); location.reload(); } };
  }

  fit() {
    const w = this.scale.width, h = this.scale.height;
    const z = Math.max(2, Math.min(Math.floor(w / 112), Math.floor(h / 200)));   // whole-pixel zoom, ~7 tiles across a phone
    this.cameras.main.setZoom(z);
    if (this.tint) this.tint.setSize(w, h);
  }

  // ---------- taps ----------
  tap(wx, wy) {
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    this.ring(wx, wy);
    const k = this.kelvin;
    if (Math.abs(wx - k.x) < 15 && wy > k.y - 30 && wy < k.y + 4) return this.pokeKelvin();
    if (tx === L.crate[0] && ty === L.crate[1]) return this.goDo(tx, ty, () => this.openCrate());
    if (tx >= L.stall[0] && tx <= L.stall[2] && ty >= L.stall[1] && ty <= L.stall[3]) return this.goDo(15, 9, () => this.openShop(), [15, 10]);
    if ((tx === L.door[0] || tx === L.door[0] + 1) && ty >= L.door[1] - 1 && ty <= L.door[1]) return this.goDo(L.door[0], L.door[1], () => this.askSleep(), [L.door[0], L.door[1] + 1]);
    if (L.votePlot.some(([x, y]) => x === tx && y === ty) || (tx === L.sign[0] && ty === L.sign[1])) return this.goDo(tx, ty, () => this.voteInfo());
    if (L.plots.some(([x, y]) => x === tx && y === ty)) return this.goDo(tx, ty, () => this.usePlot(tx, ty));
    if (tx === L.desk[0] || tx === L.desk[0] + 1) if (ty === L.desk[1]) return UI.toast("Kelvin's desk. Everything is labelled 'MINE'.");
    this.walkTo(tx, ty);
  }

  ring(x, y) {
    const r = this.add.circle(x, y, 2, 0xffffff, 0).setStrokeStyle(1, 0xffffff, .9).setDepth(3500);
    this.tweens.add({ targets: r, radius: 7, alpha: 0, duration: 300, onComplete: () => r.destroy() });
    sfx.tap();
  }

  // walk next to a target tile, face it, then act
  goDo(tx, ty, act, stand) {
    const spots = stand ? [stand] : [[tx, ty + 1], [tx - 1, ty], [tx + 1, ty], [tx, ty - 1]];
    const here = [Math.floor(this.farmer.x / T), Math.floor((this.farmer.y - 1) / T)];
    let best = null;
    for (const s of spots) {
      if (this.blocked.has(key(...s))) continue;
      const p = s[0] === here[0] && s[1] === here[1] ? [] : this.findPath(here, s);
      if (p && (!best || p.length < best.length)) best = p;
    }
    if (!best) return UI.toast("Can't reach that.");
    this.farmer.path = best.map(([x, y]) => [tc(x), y * T + T - 1]);
    this.farmer.onArrive = () => { this.face(tx, ty); act(); };
    if (!best.length) { this.farmer.onArrive(); this.farmer.onArrive = null; }
  }

  walkTo(tx, ty) {
    if (this.blocked.has(key(tx, ty))) return;
    const here = [Math.floor(this.farmer.x / T), Math.floor((this.farmer.y - 1) / T)];
    const p = this.findPath(here, [tx, ty]); if (!p) return;
    this.farmer.path = p.map(([x, y]) => [tc(x), y * T + T - 1]); this.farmer.onArrive = null;
  }

  findPath(a, b) {                                   // breadth-first search on the tile grid
    const prev = new Map([[key(...a), null]]), queue = [a];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === b[0] && y === b[1]) { const out = []; let k = key(x, y);
        while (k && k !== key(...a)) { out.unshift(k.split(',').map(Number)); k = prev.get(k); } return out; }
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, nk = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= WT || ny >= HT || prev.has(nk) || this.blocked.has(nk)) continue;
        prev.set(nk, key(x, y)); queue.push([nx, ny]);
      }
    }
    return null;
  }

  face(tx, ty) {
    const fx = Math.floor(this.farmer.x / T), fy = Math.floor((this.farmer.y - 1) / T);
    this.farmer.dir = ty < fy ? 'up' : ty > fy ? 'down' : 'side';
    this.farmer.setFlipX(tx < fx); this.farmer.setTexture('f_' + this.farmer.dir + '0');
  }

  swing(toolKey, done) {                              // tool wind-up and swing, with squash and stretch
    const f = this.farmer, t = this.tool, left = f.flipX;
    this.busy = true;
    t.setTexture(toolKey).setVisible(true).setPosition(f.x + (left ? -7 : 7), f.y - 9).setDepth(f.depth + 1).setFlipX(left).setAngle(left ? 40 : -40);
    this.tweens.add({ targets: f, scaleY: .85, scaleX: 1.12, duration: 90, yoyo: true });
    this.tweens.add({ targets: t, angle: left ? -60 : 60, duration: 160, delay: 90, ease: 'Back.easeIn', onComplete: () => {
      t.setVisible(false); this.busy = false; done && done(); } });
  }

  // ---------- plots ----------
  usePlot(x, y) {
    const k = key(x, y), p = S.plots[k];
    if (!p) {
      if (S.seeds <= 0) { sfx.nope(); return UI.toast('No seeds left.<br>Buy some at the seed stall.'); }
      return this.swing('tool_seeds', () => {
        S.seeds--; S.plots[k] = { plantedAt: now() }; sfx.plant(); this.dirt.explode(8, tc(x), y * T + 12); this.flash(x, y);
        this.refreshCrops(); this.hud(); save(S); this.tutorial('planted');
      });
    }
    const left = GROW - (now() - p.plantedAt);
    if (left > 0) return UI.toast(`Growing… ready in ${Math.ceil(left / 1000)}s.<br>Nobody knows what it'll be.`);
    this.swing('tool_basket', () => this.harvest(x, y));
  }

  harvest(x, y) {
    const k = key(x, y); delete S.plots[k];
    const roll = list => { let r = Math.random() * 100; for (const it of list) { if ((r -= it.chance) < 0) return it; } return null; };
    const rar = roll(RAR) || RAR[0], mut = roll(MUT), tier = RAR.indexOf(rar);
    const value = Math.round(rar.value * (mut ? mut.mult : 1));
    const crop = { crop: rar.crop, rarity: rar.id, mutation: mut ? mut.id : null, value };
    S.basket.push(crop); S.stats.harvested++; save(S);
    this.refreshCrops(); this.hud(); this.dirt.explode(10, tc(x), y * T + 12);
    // the monster pops out of the ground before the card
    const m = this.add.image(tc(x), y * T + 12, 'm_' + rar.crop).setOrigin(.5, 1).setDepth(3200).setScale(mut && mut.id === 'giant' ? 1.6 : 1);
    if (mut && mut.id === 'gold') m.setTint(0xffd060);
    this.busy = true;
    if (tier >= 2 || mut) this.cameras.main.shake(120, .006);
    this.tweens.add({ targets: m, y: y * T - 6, duration: 260, ease: 'Back.easeOut', onComplete: () => {
      this.sparkle.explode(tier >= 2 || mut ? 24 : 10, m.x, m.y - 6); sfx.harvest(tier);
      this.time.delayedCall(250, () => { m.destroy(); this.busy = false; this.reveal(crop, rar, mut); });
    } });
  }

  reveal(crop, rar, mut) {
    const name = CFG.crops[crop.crop];
    UI.open('reveal', `<div class="rar" style="color:${rar.color};-webkit-text-stroke:1px #2b1d3a">${rar.name.toUpperCase()}${mut ? ' · ' + mut.name.toUpperCase() : ''}</div>
      <canvas width="14" height="14" id="rv"></canvas><h1>${mut ? mut.name + ' ' : ''}${name}</h1>
      <div class="val">● ${crop.value}</div><div class="sub">${mut ? `Mutation! Worth ×${mut.mult}` : 'Into the basket it goes.'}</div>`, [{ id: 'ok', label: 'NICE' }])
      .then(() => this.tutorial('harvested'));
    const cv = UI.card('reveal').querySelector('#rv'), c = cv.getContext('2d');
    c.drawImage(this.textures.get('m_' + crop.crop).getSourceImage(), 0, 0);
    if (mut && mut.id === 'gold') { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,200,60,.55)'; c.fillRect(0, 0, 14, 14); }
    if (mut && mut.id === 'rainbow') cv.style.animation = 'none', cv.animate([{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(360deg)' }], { duration: 1200, iterations: Infinity });
    if (mut && mut.id === 'giant') cv.style.transform = 'scale(1.25)';
  }

  flash(x, y) {
    const r = this.add.rectangle(x * T, y * T, T, T, 0xffffff, .7).setOrigin(0).setDepth(2500);
    this.tweens.add({ targets: r, alpha: 0, duration: 250, onComplete: () => r.destroy() });
  }

  refreshCrops() {
    for (const [x, y] of L.plots) {
      const k = key(x, y), s = this.cropSprites[k], p = S.plots[k];
      if (!p) { s.setVisible(false); continue; }
      const f = (now() - p.plantedAt) / GROW;
      const tex = f >= 1 ? 'crop3' : f > .66 ? 'crop2' : f > .33 ? 'crop1' : 'crop0';
      if (s.texture.key !== tex) { s.setTexture(tex); if (tex === 'crop3') this.tweens.add({ targets: s, scaleY: 1.12, duration: 420, yoyo: true, repeat: -1 }); }
      s.setVisible(true);
    }
  }

  // ---------- crate and stall ----------
  openCrate() {
    if (!S.basket.length) { sfx.nope(); return UI.toast('The crate is hungry.<br>Harvest something first.'); }
    const groups = {};
    for (const c of S.basket) { const n = (c.mutation ? MUT.find(m => m.id === c.mutation).name + ' ' : '') + CFG.crops[c.crop];
      groups[n] = groups[n] || { n: 0, v: 0 }; groups[n].n++; groups[n].v += c.value; }
    const total = S.basket.reduce((a, c) => a + c.value, 0);
    UI.open('crate', `<h1>SHIPPING CRATE</h1><div class="sub">Picked up every morning. Kelvin takes no cut. Yet.</div>
      ${Object.entries(groups).map(([n, g]) => `<div class="ln"><span>${g.n} × ${n}</span><b>● ${g.v}</b></div>`).join('')}
      <hr><div class="ln"><span>TOTAL</span><b>● ${total}</b></div>`, [{ id: 'sell', label: 'SELL ALL' }, { id: 'close', label: 'KEEP', alt: true }])
      .then(v => { if (v !== 'sell') return;
        S.coins += total; S.stats.sold += S.basket.length; S.basket = []; save(S); this.hud(); sfx.coin();
        this.popup(this.crate.x, this.crate.y - 16, '+' + total); this.sparkle.explode(16, this.crate.x, this.crate.y - 8); this.tutorial('sold'); });
  }

  openShop() {
    const P = CFG.seedPrice;
    UI.open('shop', `<h1>SEED STALL</h1><div class="sub">Mystery monster seeds. No refunds. No questions.</div>
      <div class="ln"><span>1 seed</span><b>● ${P}</b></div><div class="ln"><span>5 seeds</span><b>● ${P * 5}</b></div><hr>
      <div class="ln"><span>You have</span><b>● ${S.coins}</b></div>`,
      [{ id: '1', label: 'BUY 1', disabled: S.coins < P }, { id: '5', label: 'BUY 5', disabled: S.coins < P * 5 }, { id: 'close', label: 'BYE', alt: true }])
      .then(v => { const n = +v; if (!n) return; S.coins -= n * P; S.seeds += n; save(S); this.hud(); sfx.buy();
        this.popup(this.stall.x, this.stall.y - 30, '+' + n + ' SEED' + (n > 1 ? 'S' : '')); });
  }

  popup(x, y, text, color = '#ffcf5c') {
    const t = this.add.text(x, y, text, { fontFamily: '"Press Start 2P"', fontSize: '8px', color, stroke: INK, strokeThickness: 3, resolution: 8 })
      .setOrigin(.5).setDepth(3600);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  voteInfo() {
    UI.toast('These 3 seeds wait for <b>your vote</b>:<br>💧 water · 🥤 cola · 🌋 lava<br>Comment A, B or C on Episode 1.', 3600);
  }

  // ---------- Kelvin ----------
  pokeKelvin() {
    sfx.beepClick(); const k = this.kelvin;
    this.tweens.add({ targets: k, scaleY: .82, scaleX: 1.15, duration: 80, yoyo: true });
    UI.toast('Kelvin: “' + Phaser.Utils.Array.GetRandom(QUOTES) + '”');
  }

  moveKelvin(dt) {
    const k = this.kelvin, [x0, y0, x1, y1] = L.kelvinArea;
    if (!k.target && this.time.now > k.next) {
      for (let i = 0; i < 10; i++) { const tx = Phaser.Math.Between(x0, x1), ty = Phaser.Math.Between(y0, y1);
        if (!this.blocked.has(key(tx, ty))) { k.target = [tc(tx), ty * T + T]; break; } }
    }
    if (k.target) {
      const dx = k.target[0] - k.x, dy = k.target[1] - k.y, d = Math.hypot(dx, dy), sp = 12 * dt / 1000;
      if (d <= sp) { k.target = null; k.next = this.time.now + Phaser.Math.Between(2500, 6000); }
      else { k.x += dx / d * sp; k.y += dy / d * sp; k.setFlipX(dx > 0); }
    }
    k.y = Math.round(k.y); k.setDepth(k.y);
  }

  // Kelvin's night shift: one act per night, losses capped, always leaves something worth more.
  processNights() {
    let d = S.nightsDone + 1, count = 0;
    while (nightAt(d) <= now()) { this.kelvinNight(d); S.nightsDone = d; d++; count++; }
    if (count > 1) S.pendingBill.unshift({ text: `Nights you were away: ${count}`, amt: '', kind: '' });
    if (count) save(S);
    return count;
  }

  kelvinNight(d) {
    const B = S.pendingBill, P = CFG.seedPrice, acts = [];
    const growing = Object.entries(S.plots).filter(([, p]) => now() - p.plantedAt < GROW);
    if (S.basket.length) acts.push('eat');
    if (growing.length) acts.push('audit');
    if (S.coins >= 3) acts.push('tax');
    const act = acts.length ? acts[Math.floor(Math.random() * acts.length)] : null;
    if (act === 'eat') {                                     // eats the cheapest crop in the basket
      S.basket.sort((a, b) => a.value - b.value); const c = S.basket.shift();
      const seeds = Math.ceil(c.value / P) + 1; S.seeds += seeds;
      B.push({ text: `Snack fee: ate your ${CFG.crops[c.crop]}`, amt: `-● ${c.value}`, kind: 'minus' },
             { text: `Left ${seeds} seeds (they look cursed)`, amt: `+● ${seeds * P}`, kind: 'plus' });
    } else if (act === 'audit') {                            // resets one growing plot, pays you for the trouble
      const [k] = growing[Math.floor(Math.random() * growing.length)]; S.plots[k].plantedAt = now(); S.coins += 10;
      B.push({ text: 'Audited a plot. Timer reset', amt: '1 plot', kind: 'minus', at: k },
             { text: 'Audit refund (he miscounted)', amt: '+● 10', kind: 'plus' });
    } else if (act === 'tax') {
      S.coins -= 3; S.seeds += 2;
      B.push({ text: 'Looking-at-me tax', amt: '-● 3', kind: 'minus' }, { text: 'Change: 2 seeds, wrong currency', amt: `+● ${2 * P}`, kind: 'plus' });
    } else {
      S.seeds += 1; B.push({ text: 'Found nothing to bill. Furious.', amt: '', kind: '' }, { text: 'Left 1 seed out of spite', amt: `+● ${P}`, kind: 'plus' });
    }
    S.lastBillDay = d + 1;
    if (B.length > CFG.kelvin.maxBillLines * 2 + 1) B.splice(1, B.length - CFG.kelvin.maxBillLines * 2 - 1);
  }

  showBill() {
    if (!S.pendingBill.length) return this.tutorial();
    const lines = S.pendingBill, at = (lines.find(l => l.at) || {}).at;
    sfx.beepClick();
    UI.open('bill', `<h1>INVOICE #${String(S.lastBillDay || dayIndex() + 1).padStart(3, '0')}</h1><div class="sub">FROM: KELVIN, ACCOUNTING · NIGHT SHIFT</div>
      ${lines.map(l => `<div class="ln"><span>${l.text}</span><b class="${l.kind}">${l.amt}</b></div>`).join('')}
      <hr><div class="ln"><span>NET</span><b class="plus">YOU'RE STILL UP</b></div><div class="sub" style="margin:8px 0 0">He is furious about this.</div>`,
      [{ id: 'ok', label: 'PAY NOTHING' }]).then(() => {
        S.pendingBill = []; save(S); this.hud(); this.refreshCrops();
        if (at) { const [x, y] = at.split(',').map(Number); this.lookAt(tc(x), y * T); } else this.tutorial();
      });
  }

  lookAt(x, y) {                                            // camera visits the scene of the crime, then comes back
    const cam = this.cameras.main, b = this.add.image(x, y - 4, 'bang').setDepth(3700);
    this.tweens.add({ targets: b, y: y - 9, duration: 300, yoyo: true, repeat: 3 });
    cam.stopFollow(); cam.pan(x, y, 500, 'Sine.easeInOut');
    this.time.delayedCall(1700, () => { b.destroy(); cam.pan(this.farmer.x, this.farmer.y, 400, 'Sine.easeInOut', false, (c, p) => {
      if (p === 1) { cam.startFollow(this.farmer, true, .12, .12, 0, 8); this.tutorial(); } }); });
  }

  askSleep() {
    UI.open('shop', `<h1>BED</h1><div class="sub">Sleep until morning? Kelvin works the night shift. Crops keep growing.</div>`,
      [{ id: 'yes', label: 'SLEEP' }, { id: 'no', label: 'NOT YET', alt: true }]).then(v => {
        if (v !== 'yes') return;
        const nextMorning = S.epoch + (dayIndex() + 1) * DAY + 1000;
        this.cameras.main.fadeOut(400, 20, 16, 40);
        this.time.delayedCall(450, () => { S.offset += nextMorning - now(); this.tick(); this.cameras.main.fadeIn(500, 20, 16, 40); });
      });
  }

  // ---------- clock ----------
  tick() {
    const n = this.processNights(), night = isNight(), day = dayIndex();
    if (night && !this.lastNight) { sfx.night(); UI.toast('Night falls.<br>Kelvin is clocking in.'); }
    if ((!night && this.lastNight) || day !== this.lastDay) { if (!UI.modalOpen) { sfx.morning(); this.showBill(); } }
    else if (n && !night && !UI.modalOpen) this.showBill();
    this.lastNight = night; this.lastDay = day;
    this.refreshCrops(); this.hud();
    if (!S.seen.harvest && Object.values(S.plots).some(p => now() - p.plantedAt >= GROW)) this.tutorial('ready');
  }

  hud() { UI.setHud({ day: dayIndex() + 1, night: isNight(), coins: S.coins, seeds: S.seeds, basket: S.basket.length }); }

  tutorial(ev) {
    const s = S.seen;
    if (ev === 'planted' && !s.plant) { s.plant = 1; UI.setHint(`Crops take ${CFG.growSec} s. Nobody knows what will grow.<br>Explore, or poke Kelvin.`); this.time.delayedCall(6000, () => this.tutorial()); }
    else if (ev === 'ready' && !s.harvest) { UI.setHint('Something is ready! Tap the glowing crop.'); }
    else if (ev === 'harvested' && !s.harvest) { s.harvest = 1; UI.setHint('Sell your monsters at the crate 📦'); }
    else if (ev === 'sold' && !s.sell) { s.sell = 1; UI.setHint('Buy more seeds at the stall. Mind Kelvin at night.'); this.time.delayedCall(6000, () => UI.setHint(null)); }
    else if (!ev) {
      if (!s.plant) UI.setHint('Tap the soil to plant a seed 🌱');
      else if (s.harvest && !s.sell && S.basket.length) UI.setHint('Sell your monsters at the crate 📦');
      else UI.setHint(null);
    }
    save(S);
  }

  // ---------- frame ----------
  update(t, dt) {
    const f = this.farmer;
    if (f.path.length) {
      const [x, y] = f.path[0], dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy), sp = 52 * dt / 1000;
      if (Math.abs(dx) > Math.abs(dy)) { f.dir = 'side'; f.setFlipX(dx < 0); } else f.dir = dy < 0 ? 'up' : 'down';
      if (d <= sp) { f.x = x; f.y = y; f.path.shift(); if (!f.path.length && f.onArrive) { const a = f.onArrive; f.onArrive = null; a(); } }
      else { f.x += dx / d * sp; f.y += dy / d * sp; }
      f.anim += dt;
      const fr = Math.floor(f.anim / 140) % 2; f.setTexture('f_' + f.dir + fr);
      if (Math.floor((f.anim - dt) / 280) !== Math.floor(f.anim / 280)) { this.dust.explode(2, f.x, f.y); sfx.step(); }
    } else if (!this.busy) f.setTexture('f_' + f.dir + '0');
    f.setDepth(f.y); this.shadow.setPosition(f.x, f.y).setDepth(f.y - 1);
    this.moveKelvin(dt);

    // day / night colour
    const fr = dayFrac(), cam = this.cameras.main;
    let col = 0x000000, a = 0;
    if (fr >= CFG.nightStartsAt) { col = 0x18225a; a = .5; }
    else if (fr >= CFG.duskStartsAt) { const k = (fr - CFG.duskStartsAt) / (CFG.nightStartsAt - CFG.duskStartsAt); col = 0xff8a3c; a = .22 * k; }
    else if (fr < .04) { col = 0x18225a; a = .5 * (1 - fr / .04); }
    this.tint.setFillStyle(col, a).setSize(cam.width, cam.height);
    const lampA = fr >= CFG.nightStartsAt ? .85 : fr >= CFG.duskStartsAt ? .4 : fr < .04 ? .85 * (1 - fr / .04) : 0;
    for (const g of this.lamps) g.setAlpha(lampA * (.9 + .1 * Math.sin(t / 200)));
    this.kelvin.setTint(fr >= CFG.nightStartsAt ? 0xb0a0ff : 0xffffff);
  }
}

// ---------- boot ----------
(async () => {
  try { await document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
  S = load(Date.now());
  if (q.has('reset')) { wipe(); S = load(Date.now()); }
  const el = document.getElementById('game');
  UI.initUI(document.body);
  new Phaser.Game({
    type: Phaser.AUTO, parent: el, backgroundColor: '#2a1f33', pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: el.clientWidth, height: el.clientHeight },
    scene: [Farm],
  });
})();
