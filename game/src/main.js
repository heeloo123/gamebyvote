// Game By Vote: the farm, v0.2. EHT-style: the whole farm fits one phone screen.
// You tap to plant and harvest; workers (named after commenters) work on their own;
// Kelvin from Accounting schemes where you can see him. Tap him in time to fine him.
import Phaser from 'phaser';
import CFG0 from './data/config.json';
import { T, INK, makeProps, drawFarm } from './art.js';
import { sfx, unlock } from './sfx.js';
import { load, save, wipe } from './save.js';
import * as UI from './ui.js';

const q = new URLSearchParams(location.search);
const DEBUG = q.has('debug');                        // ?debug=1: fast days, crops and schemes, for testing
const CFG = { ...CFG0, ...(DEBUG ? { dayLengthSec: 60, growSec: 6, kelvin: { ...CFG0.kelvin, schemeEverySec: [5, 8] } } : {}) };
const DAY = CFG.dayLengthSec * 1000, GROW = CFG.growSec * 1000;
const WD = CFG.world, WT = WD.tilesW, HT = WD.tilesH;
const CX = WD.coreX, CY = WD.coreY;

// ---------- farm layout (world tiles; the core farm is x 2..13, y 5..24) ----------
const L = {
  core: [CX, CY, CX + WD.coreW - 1, CY + WD.coreH - 1],
  house: [CX, CY], barn: [CX + 9, CY], stall: [CX + 4, CY + 2], crate: [CX + 7, CY + 3],
  path: [CX, CX + 11, CY + 4],
  plotRows: [[CX + 1, CX + 7, CY + 6], [CX + 1, CX + 7, CY + 8], [CX + 1, CX + 7, CY + 10]],
  voteRow: [CX + 9, CX + 11, CY + 6], sign: [CX + 8, CY + 6],
  desk: [CX + 9, CY + 9], kelvinArea: [CX + 8, CY + 8, CX + 11, CY + 12],
  pasture: [CX + 1, CY + 13, CX + 7, CY + 17],
  lamps: [[CX + 8, CY + 5], [CX + 0, CY + 12]],
  decor: [['farm', 83, CX + 3, CY + 3], ['farm', 85, CX + 8, CY + 2], ['farm', 96, CX + 8, CY + 3], ['town', 83, CX + 8, CY + 6],
    ['town', 29, CX + 0, CY + 19], ['town', 5, CX + 11, CY + 19], ['town', 17, CX + 9, CY + 19], ['farm', 39, CX + 0, CY + 7]],
  trees: [[CX + 0, CY + 15]],
  meadow: [CX + 8, CY + 13, CX + 11, CY + 18],
};
const key = (x, y) => x + ',' + y;
const tc = v => v * T + T / 2;
const PLOTS = L.plotRows.flatMap(([x0, x1, y]) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y]));
const VOTE_PLOTS = Array.from({ length: L.voteRow[1] - L.voteRow[0] + 1 }, (_, i) => [L.voteRow[0] + i, L.voteRow[2]]);
const CROP_LINES = [4, 16, 28, 40, 52];               // Tiny Farm crop rows: sprout, small, grown

// ---------- time ----------
let S;
const now = () => Date.now() + S.offset;
const dayIndex = () => Math.floor((now() - S.epoch) / DAY);
const dayFrac = () => ((now() - S.epoch) % DAY) / DAY;
const isNight = () => dayFrac() >= CFG.nightStartsAt;
const nightAt = d => S.epoch + (d + CFG.nightStartsAt) * DAY;

const RAR = CFG.rarity, MUT = CFG.mutations, CROPS = CFG.crops;
const QUOTES = ['This farm is now a cost centre.', 'Your tap has been logged.', "I've invoiced you for that.",
  'Per my last email: no.', 'Senior Accounting. Senior.', 'Fines are non-refundable. Mostly.'];
const hireCost = () => Math.round(CFG.workers.hireBase * CFG.workers.hireMult ** S.workers.length);
const basketValue = () => S.basket.reduce((a, c) => a + c.value, 0);

class Farm extends Phaser.Scene {
  constructor() { super('farm'); }

  preload() {
    for (const k of ['farm', 'town', 'dungeon']) this.load.spritesheet(k, `sprites/${k}.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.image('kelvin', 'sprites/kelvin.png');
  }

  create() {
    makeProps(this);
    this.blocked = drawFarm(this, WT, HT, L);
    this.add.image(0, 0, 'farmbg').setOrigin(0).setDepth(-1000);
    const block = (x, y) => this.blocked.add(key(x, y));
    this.crate = this.add.image(tc(L.crate[0]), L.crate[1] * T + T, 'farm', 76).setOrigin(.5, 1); this.crate.setDepth(this.crate.y); block(...L.crate);
    this.add.image(tc(L.desk[0]) + T / 2, L.desk[1] * T + T, 'desk').setOrigin(.5, 1).setDepth(L.desk[1] * T + T); block(...L.desk); block(L.desk[0] + 1, L.desk[1]);
    this.lamps = L.lamps.map(([x, y]) => { block(x, y); this.add.image(tc(x), y * T + T, 'lamp').setOrigin(.5, 1).setDepth(y * T + T);
      return this.add.image(tc(x), y * T - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(5000).setScale(1.2).setAlpha(0); });

    this.crops = {};
    PLOTS.forEach(([x, y]) => { this.crops[key(x, y)] = this.add.image(tc(x), y * T + T - 1, 'farm', 4).setOrigin(.5, 1).setVisible(false).setDepth(y * T + 8); });
    VOTE_PLOTS.forEach(([x, y]) => this.add.image(tc(x), y * T + T - 2, 'farm', 4).setOrigin(.5, 1).setDepth(y * T + 8).setAlpha(.9));

    // animals, for life
    this.critters = [[122, CX + 2, CY + 15], [122, CX + 5, CY + 14], [121, CX + 4, CY + 16], [120, CX + 6, CY + 16]].map(([f, x, y]) => {
      const a = this.add.image(tc(x), y * T + T, 'farm', f).setOrigin(.5, 1); a.home = [x, y]; a.next = 0; a.target = null; return a; });

    // Kelvin
    this.kelvin = this.add.image(tc(CX + 10), (CY + 12) * T + T, 'kelvin').setOrigin(.5, 1);
    Object.assign(this.kelvin, { mode: 'wander', target: null, path: [], next: 0, schemeAt: this.time.now + this.nextScheme(), schemesToday: 0 });
    this.kBubble = this.add.image(0, 0, 'bang').setDepth(4500).setVisible(false);
    this.kLabel = this.add.text(0, 0, '', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffffff', backgroundColor: '#d9443a', padding: { x: 2, y: 2 }, resolution: 10 }).setOrigin(.5, 1).setDepth(4501).setVisible(false);
    this.kRing = this.add.graphics().setDepth(4500);

    // workers
    this.workers = [];
    S.workers.forEach((w, i) => this.spawnWorker(w, i));

    // camera: the whole farm on one screen
    const cam = this.cameras.main; cam.setRoundPixels(true);
    this.fit(); this.scale.on('resize', () => this.fit());

    this.tint = this.add.rectangle(0, 0, 10, 10, 0x18225a, 0).setOrigin(0).setScrollFactor(0).setDepth(4000);
    this.dirt = this.add.particles(0, 0, 'px', { lifespan: 450, speed: { min: 15, max: 40 }, angle: { min: 220, max: 320 }, gravityY: 110, scale: { start: .8, end: .3 },
      tint: [0x7a5536, 0x5a3e2a, 0xb07a46], emitting: false }).setDepth(3000);
    this.sparkle = this.add.particles(0, 0, 'px', { lifespan: 650, speed: { min: 15, max: 45 }, scale: { start: .8, end: 0 }, tint: [0xffcf5c, 0xffffff, 0xff9ee0], emitting: false }).setDepth(3001);
    this.dust = this.add.particles(0, 0, 'px', { lifespan: 300, speed: { min: 3, max: 10 }, angle: { min: 200, max: 340 }, scale: { start: .6, end: 0 }, tint: 0xd8c6a0, alpha: { start: .8, end: 0 }, emitting: false }).setDepth(2900);

    this.input.on('pointerdown', p => { unlock(); if (!UI.modalOpen) this.tap(p.worldX, p.worldY); });
    this.lastNight = isNight(); this.lastDay = dayIndex();
    this.refreshCrops(); this.hud();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.tick() });
    this.time.addEvent({ delay: 5000, loop: true, callback: () => save(S) });

    this.processNights();
    if (S.pendingBill.length && !isNight()) this.time.delayedCall(700, () => this.showBill()); else this.tutorial();
    window.GBV = { scene: this, get state() { return S; }, skip: ms => { S.offset += ms; this.tick(); }, wipe: () => { wipe(); location.reload(); },
      tileToScreen: (tx, ty) => { const c = this.cameras.main; return [(tc(tx) - c.worldView.x) * c.zoom, (ty * T + 8 - c.worldView.y) * c.zoom]; } };
  }

  fit() {
    const w = this.scale.width, h = this.scale.height, top = 44, bottom = 72;
    const coreW = WD.coreW * T, coreH = WD.coreH * T;
    const z = Math.max(1, Math.min(w / coreW, (h - top - bottom) / coreH));
    const cam = this.cameras.main; cam.setZoom(z);
    cam.centerOn((CX + WD.coreW / 2) * T, (CY + WD.coreH / 2) * T + (bottom - top) / 2 / z);
    if (this.tint) this.tint.setSize(w, h);
  }

  nextScheme() { const [a, b] = CFG.kelvin.schemeEverySec; return Phaser.Math.Between(a * 1000, b * 1000); }

  // ---------- taps ----------
  tap(wx, wy) {
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T), k = this.kelvin;
    this.ring(wx, wy);
    if (Math.abs(wx - k.x) < 15 && wy > k.y - 28 && wy < k.y + 4) return this.tapKelvin();
    const w = this.workers.find(w => Math.abs(wx - w.x) < 9 && wy > w.y - 18 && wy < w.y + 3);
    if (w) return this.tapWorker(w);
    if (PLOTS.some(([x, y]) => x === tx && y === ty)) return this.usePlot(tx, ty, null);
    if (VOTE_PLOTS.some(([x, y]) => x === tx && y === ty) || (tx === L.sign[0] && ty === L.sign[1])) return this.voteInfo();
    if (tx === L.crate[0] && ty === L.crate[1]) return this.sellAll();
    if (tx >= L.stall[0] && tx <= L.stall[0] + 1 && ty >= L.stall[1] && ty <= L.stall[1] + 1) return this.buySeeds(1);
    if (tx >= L.house[0] && tx <= L.house[0] + 2 && ty >= L.house[1] && ty <= L.house[1] + 3) return this.askSleep();
    const c = this.critters.find(c => Math.abs(wx - c.x) < 9 && wy > c.y - 14 && wy < c.y + 2);
    if (c) { sfx.tap(); this.hop(c); return UI.toast({ 122: 'Bawk.', 121: 'Moo. (Kelvin has invoiced this cow.)', 120: 'Baa. It owes Kelvin wool.' }[c.frame.name] || '…'); }
    if (tx >= L.desk[0] && tx <= L.desk[0] + 1 && ty === L.desk[1]) return UI.toast("Kelvin's desk. Everything is labelled 'MINE'.");
  }

  ring(x, y) {
    const r = this.add.circle(x, y, 2, 0xffffff, 0).setStrokeStyle(1, 0xffffff, .9).setDepth(3500);
    this.tweens.add({ targets: r, radius: 7, alpha: 0, duration: 280, onComplete: () => r.destroy() });
    sfx.tap();
  }

  hop(o) { this.tweens.add({ targets: o, scaleY: .8, scaleX: 1.15, duration: 80, yoyo: true }); }

  // ---------- plots (player and workers share these) ----------
  usePlot(x, y, worker) {
    const k = key(x, y), p = S.plots[k];
    if (!p) {
      if (S.seeds <= 0) { if (!worker) { sfx.nope(); UI.toast('No seeds left.<br>Buy some at the stall or the button below.'); } return false; }
      S.seeds--; S.plots[k] = { plantedAt: now(), line: CROP_LINES[(x * 3 + y) % CROP_LINES.length] };
      sfx.plant(); this.dirt.explode(6, tc(x), y * T + 12); this.flash(x, y);
      this.refreshCrops(); this.hud(); save(S); if (!worker) this.tutorial('planted'); return true;
    }
    const left = GROW - (now() - p.plantedAt);
    if (left > 0) { if (!worker) UI.toast(`Growing… ${Math.ceil(left / 1000)}s left.<br>Nobody knows what it'll be.`); return false; }
    this.harvest(x, y, worker); return true;
  }

  harvest(x, y, worker) {
    delete S.plots[key(x, y)];
    const roll = list => { let r = Math.random() * 100; for (const it of list) if ((r -= it.chance) < 0) return it; return null; };
    const mm = worker ? 1 : CFG.manualMutationMult;                 // your own taps find mutations more often
    const rar = roll(RAR) || RAR[0], mut = roll(MUT.map(m => ({ ...m, chance: m.chance * mm }))), tier = RAR.indexOf(rar);
    const value = Math.round(rar.value * (mut ? mut.mult : 1));
    const crop = { crop: rar.crop, rarity: rar.id, mutation: mut ? mut.id : null, value };
    S.basket.push(crop); S.stats.harvested++; save(S);
    this.refreshCrops(); this.hud(); this.dirt.explode(8, tc(x), y * T + 12);
    const m = this.add.image(tc(x), y * T + 12, 'dungeon', CROPS[rar.crop].frame).setOrigin(.5, 1).setDepth(3200).setScale(mut && mut.id === 'giant' ? 1.6 : 1);
    if (mut && mut.id === 'gold') m.setTint(0xffd060);
    if (mut && mut.id === 'rainbow') m.setTint(0xff9ee0, 0x8ad4ff, 0x9ff0a0, 0xffcf5c);
    const big = tier >= 2 || !!mut;
    if (big) this.cameras.main.shake(140, .008);
    this.tweens.add({ targets: m, y: y * T - 4, duration: 240, ease: 'Back.easeOut', onComplete: () => {
      this.sparkle.explode(big ? 22 : 8, m.x, m.y - 6); sfx.harvest(tier);
      this.tweens.add({ targets: m, alpha: 0, y: m.y - 10, delay: 350, duration: 300, onComplete: () => m.destroy() });
    } });
    const name = (mut ? mut.name + ' ' : '') + CROPS[rar.crop].name, src = this.textures.get('dungeon').getSourceImage(), f = CROPS[rar.crop].frame;
    UI.find((cx, cv) => { cx.drawImage(src, (f % 12) * 16, Math.floor(f / 12) * 16, 16, 16, 0, 0, 16, 16);
        if (mut && mut.id === 'gold') { cx.globalCompositeOperation = 'source-atop'; cx.fillStyle = 'rgba(255,200,60,.55)'; cx.fillRect(0, 0, 16, 16); cx.globalCompositeOperation = 'source-over'; }
        cv.style.filter = mut && mut.id === 'rainbow' ? 'hue-rotate(120deg) saturate(2)' : ''; },
      `<span class="r" style="color:${rar.color};-webkit-text-stroke:.5px #2b1d3a">${rar.name.toUpperCase()}</span><br>${name} · ● ${value}${worker ? `<br><span style="color:#6b5a7a">found by ${worker.info.name}</span>` : ''}`, big);
    if (!worker) this.tutorial('harvested');
  }

  flash(x, y) {
    const r = this.add.rectangle(x * T, y * T, T, T, 0xffffff, .7).setOrigin(0).setDepth(2500);
    this.tweens.add({ targets: r, alpha: 0, duration: 250, onComplete: () => r.destroy() });
  }

  refreshCrops() {
    for (const [x, y] of PLOTS) {
      const k = key(x, y), s = this.crops[k], p = S.plots[k];
      if (!p) { s.setVisible(false); if (s.pulse) { s.pulse.stop(); s.pulse = null; s.setScale(1); } continue; }
      const f = (now() - p.plantedAt) / GROW, line = p.line || 4;
      const frame = f >= 1 ? line + 2 : f > .5 ? line + 1 : line;
      if (s.frame.name !== frame) s.setFrame(frame);
      if (f >= 1 && !s.pulse) s.pulse = this.tweens.add({ targets: s, scaleY: 1.14, duration: 380, yoyo: true, repeat: -1 });
      s.setVisible(true);
    }
  }

  // ---------- economy ----------
  sellAll(by) {
    if (!S.basket.length) { if (!by) { sfx.nope(); UI.toast('Basket is empty.<br>Harvest some monsters first.'); } return; }
    const total = basketValue(); S.coins += total; this.earn(total); S.stats.sold += S.basket.length; S.basket = []; save(S); this.hud(); sfx.coin();
    this.popup(this.crate.x, this.crate.y - 16, '+' + total); this.sparkle.explode(14, this.crate.x, this.crate.y - 8);
    if (!by) this.tutorial('sold');
  }

  earn(n) {
    S.stats.earned = (S.stats.earned || 0) + n;
    if (!S.goalDone && S.stats.earned >= CFG.goal.earn) {
      S.goalDone = true; sfx.morning(); this.cameras.main.flash(400, 255, 230, 140); this.sparkle.explode(60, this.kelvin.x, this.kelvin.y - 20);
      UI.stamp('FARM BOUGHT BACK!', '#2e8a3a');
      UI.toast('You earned ● ' + CFG.goal.earn + '. The farm is yours again.<br>Kelvin has filed an appeal. Senior Accounting is involved.', 5000);
    }
  }

  buySeeds(n, by) {
    const cost = n * CFG.seedPrice;
    if (S.coins < cost) { if (!by) { sfx.nope(); UI.toast(`Seeds cost ● ${CFG.seedPrice} each.<br>Sell monsters at the crate.`); } return; }
    S.coins -= cost; S.seeds += n; save(S); this.hud(); sfx.buy();
    this.popup(tc(L.stall[0]) + 8, L.stall[1] * T, '+' + n + ' SEED' + (n > 1 ? 'S' : '') + (by ? ' (' + by.info.name + ')' : ''));
  }

  hire() {
    const n = S.workers.length, names = CFG.workers.placeholderNames, frames = CFG.workers.frames;
    if (n >= CFG.workers.max) return UI.toast('The farm is full.');
    const cost = hireCost(); if (S.coins < cost) { sfx.nope(); return UI.toast(`Hiring costs ● ${cost}.`); }
    S.coins -= cost; const w = { name: names[n % names.length], frame: frames[n % frames.length], jobs: 0 };
    S.workers.push(w); save(S); this.hud(); sfx.morning();
    const wk = this.spawnWorker(w, n); this.sparkle.explode(18, wk.x, wk.y - 8);
    UI.toast(`<b>${w.name}</b> joined the farm!<br>Soon, workers get commenters' names.`, 3000);
  }

  popup(x, y, text, color = '#ffcf5c') {
    const t = this.add.text(x, y, text, { fontFamily: '"Press Start 2P"', fontSize: '6px', color, stroke: INK, strokeThickness: 2, resolution: 10 }).setOrigin(.5).setDepth(3600);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  voteInfo() { UI.toast('These 3 seeds wait for <b>your vote</b>:<br>💧 water · 🥤 cola · 🌋 lava<br>Comment A, B or C on Episode 1.', 3600); }

  // ---------- workers ----------
  spawnWorker(data, i) {
    const [x0, y0, x1, y1] = L.meadow, tx = x0 + (i * 3) % (x1 - x0), ty = y0 + 1 + (i % 3);
    const w = this.add.image(tc(tx), ty * T + T, 'dungeon', data.frame).setOrigin(.5, 1);
    w.info = data; w.path = []; w.job = null; w.busyUntil = 0; w.next = 0;
    w.tag = this.add.text(w.x, w.y - 17, data.name, { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffffff', stroke: INK, strokeThickness: 2, resolution: 10 }).setOrigin(.5, 1);
    this.workers.push(w); return w;
  }

  tapWorker(w) {
    this.hop(w); sfx.tap();
    const paper = w.busyUntil > this.time.now ? '<br>Doing Kelvin\'s paperwork…' : '';
    UI.toast(`<b>${w.info.name}</b> · jobs done: ${w.info.jobs || 0}${paper}`);
  }

  here(o) { return [Math.floor(o.x / T), Math.floor((o.y - 1) / T)]; }

  findPath(a, b) {
    const prev = new Map([[key(...a), null]]), queue = [a];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === b[0] && y === b[1]) { const out = []; let k = key(x, y); while (k && k !== key(...a)) { out.unshift(k.split(',').map(Number)); k = prev.get(k); } return out; }
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, nk = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= WT || ny >= HT || prev.has(nk) || this.blocked.has(nk)) continue;
        prev.set(nk, key(x, y)); queue.push([nx, ny]);
      }
    }
    return null;
  }

  sendTo(o, tile, then) {
    const p = this.findPath(this.here(o), tile); if (!p) return false;
    o.path = p.map(([x, y]) => [tc(x), y * T + T - 1]); o.then = then;
    if (!p.length) { o.then = null; then && then(); }
    return true;
  }

  claimed(k) { return this.workers.some(w => w.job === k); }

  thinkWorker(w) {
    if (w.path.length || w.busyUntil > this.time.now || this.time.now < w.next) return;
    const readyK = Object.entries(S.plots).find(([k, p]) => now() - p.plantedAt >= GROW && !this.claimed(k));
    const emptyK = S.seeds > 0 && PLOTS.map(p => key(...p)).find(k => !S.plots[k] && !this.claimed(k));
    const target = readyK ? readyK[0] : emptyK;
    if (target) {
      const [x, y] = target.split(',').map(Number); w.job = target;
      if (!this.sendTo(w, [x, y + 1], () => { this.hop(w); const did = this.usePlot(x, y, w); if (did) w.info.jobs = (w.info.jobs || 0) + 1; w.job = null; w.next = this.time.now + 700; })) w.job = null;
      return;
    }
    const anyEmpty = PLOTS.some(p => !S.plots[key(...p)]);
    if (S.seeds === 0 && anyEmpty && S.coins >= CFG.seedPrice && !this.workers.some(o => o.job === 'buy')) {
      w.job = 'buy'; this.sendTo(w, [L.stall[0], L.stall[1] + 2], () => { this.hop(w);
        this.buySeeds(Math.min(5, Math.floor(S.coins / CFG.seedPrice)), w); w.info.jobs = (w.info.jobs || 0) + 1; w.job = null; });
      return;
    }
    if (S.basket.length >= 8 && !this.workers.some(o => o.job === 'sell')) {
      w.job = 'sell'; this.sendTo(w, [L.crate[0], L.crate[1] + 1], () => { this.hop(w); this.sellAll(w); w.info.jobs = (w.info.jobs || 0) + 1; w.job = null; });
      return;
    }
    const [x0, y0, x1, y1] = L.meadow;
    this.sendTo(w, [Phaser.Math.Between(x0, x1), Phaser.Math.Between(y0, y1)]);
    w.next = this.time.now + Phaser.Math.Between(1500, 4000);
  }

  stepMover(o, dt, speed) {
    if (!o.path || !o.path.length) return false;
    const [x, y] = o.path[0], dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy), sp = speed * dt / 1000;
    if (Math.abs(dx) > .5) o.setFlipX(dx < 0);
    if (d <= sp) { o.x = x; o.y = y; o.path.shift(); if (!o.path.length && o.then) { const t = o.then; o.then = null; t(); } }
    else { o.x += dx / d * sp; o.y += dy / d * sp; }
    o.bob = (o.bob || 0) + dt;
    return true;
  }

  // ---------- Kelvin ----------
  tapKelvin() {
    const k = this.kelvin; this.hop(k);
    if (k.mode === 'approach' || k.mode === 'scheme') {
      S.coins += CFG.kelvin.fine; S.stats.fines++; save(S); this.hud(); sfx.coin(); sfx.beepClick();
      // hit-stop, zoom punch, stamp
      this.tweens.timeScale = .15; this.time.delayedCall(180, () => { this.tweens.timeScale = 1; });
      const cam = this.cameras.main, z = cam.zoom; cam.zoomTo(z * 1.12, 90); this.time.delayedCall(260, () => cam.zoomTo(z, 220));
      cam.shake(180, .01);
      this.tweens.add({ targets: k, angle: { from: -14, to: 14 }, duration: 60, yoyo: true, repeat: 4, onComplete: () => k.setAngle(0) });
      this.popup(k.x, k.y - 30, '+' + CFG.kelvin.fine); this.sparkle.explode(26, k.x, k.y - 12);
      UI.stamp('FINED +' + CFG.kelvin.fine);
      UI.toast('Caught him! Kelvin pays a fine.<br>He is furious about this.');
      this.endScheme('sulk'); this.tutorial('fined'); return;
    }
    sfx.beepClick(); UI.toast('Kelvin: “' + Phaser.Utils.Array.GetRandom(QUOTES) + '”');
  }

  startScheme() {
    const k = this.kelvin, kinds = [];
    const growing = Object.entries(S.plots).filter(([, p]) => now() - p.plantedAt < GROW);
    if (growing.length) kinds.push('audit');
    if (S.basket.length) kinds.push('snack');
    const free = this.workers.filter(w => w.busyUntil < this.time.now);
    if (free.length) kinds.push('invoice');
    if (!kinds.length) return;
    const kind = Phaser.Utils.Array.GetRandom(kinds);
    let tile, label;
    if (kind === 'audit') { const [kk] = Phaser.Utils.Array.GetRandom(growing); k.victim = kk; const [x, y] = kk.split(',').map(Number); tile = [x, y + 1]; label = 'AUDIT'; }
    if (kind === 'snack') { tile = [L.crate[0], L.crate[1] + 1]; label = 'SNACK'; }
    if (kind === 'invoice') { const w = Phaser.Utils.Array.GetRandom(free); k.victim = w; tile = this.here(w); label = 'INVOICE'; }
    k.kind = kind; k.mode = 'approach'; k.label = label;
    if (!this.sendTo(k, tile, () => { k.mode = 'scheme'; k.schemeEnd = this.time.now + CFG.kelvin.schemeSec * 1000; })) return this.endScheme();
    UI.toast('Kelvin is up to something…<br><b>Tap him</b> before he finishes!'); sfx.nope();
  }

  endScheme(mode = 'wander') {
    const k = this.kelvin; k.mode = mode; k.path = []; k.then = null; k.kind = null; k.victim = null;
    k.schemeAt = this.time.now + this.nextScheme() + (mode === 'sulk' ? 3000 : 0);
    if (mode === 'sulk') this.time.delayedCall(2500, () => { if (k.mode === 'sulk') k.mode = 'wander'; });
    this.kBubble.setVisible(false); this.kLabel.setVisible(false); this.kRing.clear();
  }

  completeScheme() {
    const k = this.kelvin; let line, loss = 0;
    if (k.kind === 'audit' && S.plots[k.victim]) { S.plots[k.victim].plantedAt = now(); loss = 5; line = 'Audited a plot (timer reset)'; this.flash(...k.victim.split(',').map(Number)); }
    if (k.kind === 'snack' && S.basket.length) { S.basket.sort((a, b) => a.value - b.value); const c = S.basket.shift(); loss = c.value; line = `Snack fee: ate your ${CROPS[c.crop].name}`; }
    if (k.kind === 'invoice' && k.victim) { k.victim.busyUntil = this.time.now + 15000; loss = 4; line = `Invoiced ${k.victim.info.name} for breathing`; this.popup(k.victim.x, k.victim.y - 22, 'PAPERWORK', '#ff9a8a'); }
    if (line) { S.pendingBill.push({ text: line, amt: loss ? `-● ${loss}` : '', kind: 'minus' }); S.dayLoss += loss; save(S); this.hud(); this.refreshCrops();
      this.popup(k.x, k.y - 30, k.label + '!', '#ff9a8a'); sfx.beepClick(); UI.toast('Too late. ' + line + '.<br>It goes on his bill.'); }
    k.schemesToday++; this.endScheme();
  }

  updateKelvin(dt) {
    const k = this.kelvin;
    if (this.lastDay !== dayIndex()) k.schemesToday = 0;
    if (k.mode === 'wander') {
      if (!isNight() && this.time.now > k.schemeAt && k.schemesToday < CFG.kelvin.maxSchemesPerDay && !UI.modalOpen) this.startScheme();
      else if (!k.path.length && this.time.now > k.next) {
        const [x0, y0, x1, y1] = L.kelvinArea; this.sendTo(k, [Phaser.Math.Between(x0, x1), Phaser.Math.Between(y0, y1)]);
        k.next = this.time.now + Phaser.Math.Between(2500, 6000);
      }
    }
    this.stepMover(k, dt, k.mode === 'approach' ? 22 : 10);
    const plotting = k.mode === 'approach' || k.mode === 'scheme';
    this.kBubble.setVisible(plotting).setPosition(k.x + 12, k.y - 30 + Math.sin(this.time.now / 120) * 1.5);
    this.kLabel.setVisible(plotting).setText(k.label ? k.label + '?' : '').setPosition(k.x, k.y - 26);
    this.kRing.clear();
    if (plotting) this.kRing.lineStyle(1, 0xff5a4a, .6).strokeCircle(k.x, k.y - 11, 15 + Math.sin(this.time.now / 90));
    if (k.mode === 'scheme') {
      const f = 1 - (k.schemeEnd - this.time.now) / (CFG.kelvin.schemeSec * 1000);
      this.kRing.lineStyle(3, 0xff3a2a, 1).beginPath().arc(k.x, k.y - 11, 15, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2).strokePath();
      if (f >= 1) this.completeScheme();
    }
    k.setDepth(k.y);
  }

  // ---------- nights and bills ----------
  processNights() {
    let d = S.nightsDone + 1, count = 0;
    while (nightAt(d) <= now()) { this.kelvinNight(d); S.nightsDone = d; d++; count++; }
    if (count > 1) S.pendingBill.unshift({ text: `Nights you were away: ${count}`, amt: '', kind: '' });
    if (count) save(S);
    return count;
  }

  kelvinNight() {
    const B = S.pendingBill, acts = [];
    const growing = Object.entries(S.plots).filter(([, p]) => now() - p.plantedAt < GROW);
    if (S.basket.length) acts.push('eat');
    if (growing.length) acts.push('audit');
    if (S.coins >= 3) acts.push('tax');
    if (S.workers.length) acts.push('overtime');
    const act = acts.length ? Phaser.Utils.Array.GetRandom(acts) : null;
    if (act === 'eat') { S.basket.sort((a, b) => a.value - b.value); const c = S.basket.shift(); S.dayLoss += c.value;
      B.push({ text: `Midnight snack: your ${CROPS[c.crop].name}`, amt: `-● ${c.value}`, kind: 'minus' }); }
    else if (act === 'audit') { const [k] = Phaser.Utils.Array.GetRandom(growing); S.plots[k].plantedAt = now(); S.dayLoss += 5;
      B.push({ text: 'Night audit of a plot', amt: '-● 5', kind: 'minus' }); }
    else if (act === 'tax') { S.coins -= 3; S.dayLoss += 3; B.push({ text: 'Looking-at-me tax', amt: '-● 3', kind: 'minus' }); }
    else if (act === 'overtime') { const w = Phaser.Utils.Array.GetRandom(S.workers); S.dayLoss += 4;
      B.push({ text: `Billed ${w.name} for sleeping`, amt: '-● 4', kind: 'minus' }); }
    else B.push({ text: 'Found nothing to bill. Furious.', amt: '', kind: '' });
    if (B.length > CFG.kelvin.maxBillLines) B.splice(0, B.length - CFG.kelvin.maxBillLines);
  }

  // The morning bill slides down as a slip (it doesn't block play) and rolls itself up after a few seconds.
  showBill() {
    if (!S.pendingBill.length) return this.tutorial();
    const refund = Math.round(S.dayLoss * CFG.kelvin.refundPct);
    const lines = [...S.pendingBill];
    if (refund) lines.push({ text: 'Partial refund (he miscounted)', amt: `+● ${refund}`, kind: 'plus' });
    S.billNo = (S.billNo || 0) + 1; sfx.beepClick();
    S.coins += refund; S.pendingBill = []; S.dayLoss = 0; save(S); this.hud();
    UI.bill(`<b>INVOICE #${String(S.billNo).padStart(3, '0')}</b> · FROM KELVIN, ACCOUNTING`,
      lines.map(l => `<div class="ln"><span>${l.text}</span><b class="${l.kind}">${l.amt}</b></div>`).join('') +
      `<div class="ln" style="margin-top:4px"><span>Catch him next time: fines are ● ${CFG.kelvin.fine}</span></div>`);
    this.tutorial();
  }

  askSleep() {
    UI.open('sheet', `<h1>FARMHOUSE</h1><div class="sub">Sleep until morning? Kelvin works the night shift. Crops keep growing.</div>`,
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
    if (((!night && this.lastNight) || day !== this.lastDay) && !UI.modalOpen) { sfx.morning(); this.showBill(); }
    else if (n && !night && !UI.modalOpen) this.showBill();
    if (day !== this.lastDay) this.kelvin.schemesToday = 0;
    this.lastNight = night; this.lastDay = day;
    this.refreshCrops(); this.hud();
    if (!S.seen.ready && Object.values(S.plots).some(p => now() - p.plantedAt >= GROW)) this.tutorial('ready');
  }

  hud() {
    UI.setHud({ day: dayIndex() + 1, night: isNight(), coins: S.coins, seeds: S.seeds, basket: S.basket.length, earned: S.stats.earned || 0, goal: CFG.goal.earn, goalDone: S.goalDone,
      needSeeds: S.seeds === 0 && PLOTS.some(p => !S.plots[key(...p)]),
      seedCost: CFG.seedPrice * 5, sellValue: basketValue(), hireCost: hireCost(), canHire: S.workers.length < CFG.workers.max });
  }

  tutorial(ev) {
    const s = S.seen;
    if (ev === 'planted' && !s.plant) { s.plant = 1; UI.setHint(`Monsters grow in ${CFG.growSec}s. Plant more!`); this.time.delayedCall(5000, () => this.tutorial()); }
    else if (ev === 'ready' && !s.ready) { s.ready = 1; UI.setHint('Something is ready! Tap the bouncing crop.'); }
    else if (ev === 'harvested' && !s.harvest) { s.harvest = 1; UI.setHint('Sell monsters at the crate (or SELL below).<br>Then HIRE a worker to farm for you.'); this.time.delayedCall(6000, () => this.tutorial()); }
    else if (ev === 'fined' && !s.fined) { s.fined = 1; }
    else if (!ev) {
      if (!s.plant) UI.setHint('Tap the soil to plant a seed 🌱');
      else if (S.seeds === 0 && !Object.keys(S.plots).length && !S.workers.length) UI.setHint('Out of seeds: tap +5 SEEDS below.');
      else if (!S.workers.length && s.harvest && S.coins >= hireCost()) UI.setHint('You can afford a worker. Tap HIRE!');
      else UI.setHint(null);
    }
    save(S);
  }

  // ---------- frame ----------
  update(t, dt) {
    for (const w of this.workers) {
      this.thinkWorker(w);
      const moving = this.stepMover(w, dt, 26);
      w.setDepth(w.y);
      const bob = moving ? Math.abs(Math.sin(w.bob / 90)) * 1.5 : 0;
      const crowd = this.workers.slice(0, this.workers.indexOf(w)).filter(o => Math.abs(o.x - w.x) < 26 && Math.abs(o.y - w.y) < 12).length;
      w.tag.setPosition(w.x, w.y - 16 - bob - crowd * 8).setDepth(4400 + crowd);
      if (moving && Math.floor((w.bob - dt) / 250) !== Math.floor(w.bob / 250)) this.dust.explode(1, w.x, w.y);
      w.setAlpha(w.busyUntil > this.time.now ? .75 : 1);
    }
    for (const c of this.critters) {
      if (!c.path || !c.path.length) { if (t > c.next) { const [x0, y0, x1, y1] = L.pasture; this.sendTo(c, [Phaser.Math.Between(x0 + 1, x1 - 1), Phaser.Math.Between(y0 + 1, y1 - 1)]); c.next = t + Phaser.Math.Between(2000, 6000); } }
      this.stepMover(c, dt, 8); c.setDepth(c.y);
    }
    this.updateKelvin(dt);

    const fr = dayFrac(), cam = this.cameras.main;
    let col = 0x000000, a = 0;
    if (fr >= CFG.nightStartsAt) { col = 0x18225a; a = .45; }
    else if (fr >= CFG.duskStartsAt) { col = 0xff8a3c; a = .2 * (fr - CFG.duskStartsAt) / (CFG.nightStartsAt - CFG.duskStartsAt); }
    else if (fr < .04) { col = 0x18225a; a = .45 * (1 - fr / .04); }
    this.tint.setFillStyle(col, a).setSize(cam.width, cam.height);
    const lampA = fr >= CFG.nightStartsAt ? .85 : fr >= CFG.duskStartsAt ? .4 : fr < .04 ? .85 * (1 - fr / .04) : 0;
    for (const g of this.lamps) g.setAlpha(lampA * (.9 + .1 * Math.sin(t / 200)));
  }
}

// ---------- boot ----------
(async () => {
  try { await document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
  if (q.has('reset')) wipe();
  S = load(Date.now());
  const el = document.getElementById('game');
  while (!el.clientWidth || !el.clientHeight) await new Promise(r => setTimeout(r, 200));   // WebGL can't start at 0 x 0
  let scene = null;
  UI.initUI(document.body, a => { unlock(); if (!scene) return; if (a === 'seeds') scene.buySeeds(5); if (a === 'sell') scene.sellAll(); if (a === 'hire') scene.hire(); });
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: el, backgroundColor: '#2e6b34', pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: el.clientWidth, height: el.clientHeight }, scene: [Farm],
  });
  game.events.on('ready', () => { scene = game.scene.getScene('farm'); });
})();
