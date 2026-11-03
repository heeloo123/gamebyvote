// Game By Vote: the monster patch, v0.4.
// Grow weird monsters in a 3 x 3 patch and fill the Monster Book. Kelvin from Accounting bills some of
// your pulls: PAY, or DISPUTE (he flips his lucky coin: win and he pays you double, lose and he keeps the monster).
// Monsters keep growing while you're away; Kelvin's welcome-back invoice is waiting.
import Phaser from 'phaser';
import CFG from './data/config.json';
import { T, INK, makeProps, drawField } from './art.js';
import { sfx, unlock } from './sfx.js';
import { load, save, wipe } from './save.js';
import * as UI from './ui.js';

const q = new URLSearchParams(location.search);
const SPEED = q.has('debug') ? 10 : 1;                 // ?debug=1: everything grows 10x faster
const W = 16, H = 26, GX = 5, GY = 10;                 // world in tiles; the patch's top-left tile (3 x 3 plots of 2 x 2 tiles)
const plotC = i => [(GX + (i % 3) * 2) * T + T, (GY + Math.floor(i / 3) * 2) * T + T];   // plot centre, world px
const KHOME = [9.4 * T, GY * T - 7];                   // where Kelvin stands (feet), next to his desk
const RAR = CFG.rarity, MUT = CFG.mutations, CROPS = CFG.crops, K = CFG.kelvin;
const SPECIES = RAR.map(r => r.crop), FORMS = ['normal', ...MUT.map(m => m.id)];
const BOOK_MAX = SPECIES.length * FORMS.length;
const rarOf = crop => SPECIES.indexOf(crop);
const QUOTES = ["I've invoiced you for that.", 'Your tap has been logged.', 'Per my last email: no.', 'Senior Accounting. SENIOR.',
  'This farm is a cost centre.', 'Fines are non-refundable. Mostly.', 'Smile. It\'s billable.'];
const WIN_LINES = ['Fine. <i>Fine.</i> Noted.', 'The coin was faulty. I\'m auditing the coin.', 'This never happened. Paperwork says so.'];
const LOSE_LINES = ['Per policy, this is now company property.', 'Thank you for your contribution.', 'Dispute processed. You lost. Lovely.'];
const PAY_LINES = ['Pleasure doing business.', 'Paid in full. How refreshing.', 'Receipt? You can\'t afford a receipt.'];

let S, OFF = 0;
const now = () => Date.now() + OFF;
const pick = a => a[Math.floor(Math.random() * a.length)];
const bookCount = () => Object.values(S.book).filter(n => n > 0).length;
const growLeft = p => Math.max(0, p.plantedAt + p.growMs / SPEED - now());
const isRipe = p => p && growLeft(p) === 0;
const fmt = ms => { const s = Math.ceil(ms / 1000); return s < 60 ? s + 's' : s < 3600 ? Math.ceil(s / 60) + 'm' : Math.floor(s / 3600) + 'h' + String(Math.floor(s % 3600 / 60)).padStart(2, '0'); };

function rollRarity(min = 0) {
  const pool = RAR.slice(min), tot = pool.reduce((a, r) => a + r.chance, 0);
  let x = Math.random() * tot;
  for (const r of pool) { if ((x -= r.chance) < 0) return RAR.indexOf(r); }
  return RAR.length - 1;
}
function rollMutation() {
  for (const m of MUT) if (Math.random() * 100 < m.chance) return m;
  return null;
}

// draw a monster (16 px tile) on a small canvas, with its mutation look
function drawMon(cv, crop, form, known = true) {
  const x = cv.getContext('2d'), src = window.GBV.scene.textures.get('dungeon').getSourceImage(), f = CROPS[crop].frame;
  x.imageSmoothingEnabled = false; x.clearRect(0, 0, 16, 16);
  x.drawImage(src, (f % 12) * T, Math.floor(f / 12) * T, T, T, 0, 0, 16, 16);
  x.globalCompositeOperation = 'source-atop';
  if (!known) { x.fillStyle = INK; x.fillRect(0, 0, 16, 16); }
  else if (form === 'gold') { x.fillStyle = 'rgba(255,200,40,.6)'; x.fillRect(0, 0, 16, 16); }
  x.globalCompositeOperation = 'source-over';
}
function drawKelvin(cv) {
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(window.GBV.scene.textures.get('kelvin').getSourceImage(), 0, 0);
}

class Patch extends Phaser.Scene {
  constructor() { super('patch'); }

  preload() {
    for (const k of ['farm', 'town', 'dungeon']) this.load.spritesheet(k, `sprites/${k}.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.image('kelvin', 'sprites/kelvin.png');
  }

  create() {
    window.GBV = { scene: this, get state() { return S; }, skip: ms => { OFF += ms; this.refresh(); }, wipe: () => { wipe(); location.reload(); },
      plotScreen: i => this.toScreen(...plotC(i)), kelvinScreen: () => this.toScreen(this.kelvin.x, this.kelvin.y - 12) };
    makeProps(this); drawField(this, W, H);
    this.add.image(0, 0, 'fieldbg').setOrigin(0).setDepth(-1000);
    this.add.image(7.2 * T, GY * T - 8, 'desk').setOrigin(.5, 1).setDepth(10);

    // the patch: bed, monster (cropped so it pokes out of the soil), front lip, ripe "!" and timer label
    this.plots = [...Array(9)].map((_, i) => {
      const [x, y] = plotC(i), o = { i, x, y };
      o.bed = this.add.image(x, y, 'bed').setDepth(20);
      o.mon = this.add.image(x, y, 'dungeon', 108).setOrigin(.5, 1).setScale(1.5).setDepth(21).setVisible(false);
      o.lip = this.add.image(x, y + 15, 'lip').setOrigin(.5, 1).setDepth(22);
      o.bang = this.add.image(x + 9, y - 14, 'bang').setDepth(30).setVisible(false);
      o.label = this.add.text(x, y + 11, '', { fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#fff', stroke: INK, strokeThickness: 2, resolution: 8 }).setOrigin(.5).setDepth(31);
      return o;
    });

    this.kelvin = this.add.image(...KHOME, 'kelvin').setOrigin(.5, 1).setDepth(40);
    this.tweens.add({ targets: this.kelvin, scaleY: .94, scaleX: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.arrow = this.add.image(0, 0, 'arrow').setDepth(60).setVisible(false);
    this.tweens.add({ targets: this.arrow, y: '+=4', duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.dirt = this.add.particles(0, 0, 'px', { lifespan: 450, speed: { min: 20, max: 50 }, angle: { min: 220, max: 320 }, gravityY: 140, scale: { start: 1, end: .3 },
      tint: [0x7a3e2e, 0xb86542, 0xeaa56c], emitting: false }).setDepth(50);
    this.sparkle = this.add.particles(0, 0, 'px', { lifespan: 700, speed: { min: 20, max: 60 }, scale: { start: 1, end: 0 }, tint: [0xffcf5c, 0xffffff, 0xff9ee0], emitting: false }).setDepth(51);

    this.cameras.main.setRoundPixels(true);
    this.fit(); this.scale.on('resize', () => this.fit());

    // input: tap a plot, or keep your finger down and swipe across plots
    this.queue = []; this.stroke = null;
    this.input.on('pointerdown', p => { unlock(); if (UI.modalOpen) return; this.stroke = new Set(); this.touch(p, true); });
    this.input.on('pointermove', p => { if (p.isDown && this.stroke && !UI.modalOpen) this.touch(p, false); });
    this.input.on('pointerup', () => { this.stroke = null; this.flush(); });

    this.refresh();
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refresh() });
    this.time.addEvent({ delay: 4000, loop: true, callback: () => { S.lastSeen = now(); save(S); } });
    this.time.addEvent({ delay: 26000, loop: true, callback: () => { if (!UI.modalOpen && S.harvests > 2) UI.say('<b>Kelvin:</b> ' + pick(QUOTES)); } });
    this.start();
  }

  // whole-number zoom so pixels stay crisp; Kelvin's strip + the patch fill the phone screen
  fit() {
    const w = this.scale.width, h = this.scale.height, cam = this.cameras.main;
    const z = Phaser.Math.Clamp(Math.floor(Math.min(w / 120, (h - 110) / 176)), 2, 5);
    cam.setZoom(z);
    const gridMidScreen = 60 + 88 * z;                    // patch centre on screen: Kelvin's strip above it, hint below
    cam.centerOn((GX + 3) * T, (GY + 3) * T - (gridMidScreen - h / 2) / z);
  }
  toScreen(wx, wy) { const c = this.cameras.main; return [(wx - c.worldView.x) * c.zoom, (wy - c.worldView.y) * c.zoom]; }

  async start() {
    const away = now() - (S.lastSeen || now());
    if (!S.seen.intro) await this.intro();
    else if (away > K.welcomeBackAfterSec * 1000 / SPEED) await this.welcomeBack();
    S.lastSeen = now(); save(S); this.refresh();
  }

  // ---------- input ----------
  touch(p, first) {
    const wx = p.worldX, wy = p.worldY, k = this.kelvin;
    if (first && Math.abs(wx - k.x) < 14 && wy > k.y - 26 && wy < k.y + 2) { sfx.beepClick(); UI.say('<b>Kelvin:</b> ' + pick(QUOTES)); this.squash(k); return; }
    const i = this.plots.findIndex(o => Math.abs(wx - o.x) <= 15 && Math.abs(wy - o.y) <= 15);
    if (i < 0 || this.stroke.has(i)) return;
    this.stroke.add(i);
    const pl = S.plots[i];
    if (!pl) this.plant(i);
    else if (isRipe(pl)) this.harvest(i);
    else if (first) { sfx.tap(); this.popup(this.plots[i].x, this.plots[i].y - 18, fmt(growLeft(pl)), '#ffffff'); this.squash(this.plots[i].bed); }
  }

  squash(o) { this.tweens.add({ targets: o, scaleX: (o.scaleX || 1) * 1.12, scaleY: (o.scaleY || 1) * .88, duration: 70, yoyo: true }); }

  plant(i) {
    let free = S.planted < CFG.freeSeeds, sealed = false;
    if (S.sealedReady) { sealed = true; S.sealedReady = false; }
    else if (!free && S.coins >= CFG.seedPrice) S.coins -= CFG.seedPrice;
    else if (!free) {
      if (Object.keys(S.plots).length) { sfx.nope(); UI.say('<b>Kelvin:</b> Insufficient funds. Noted.'); return; }
      UI.say('<b>Kelvin:</b> Fine. One seed. On credit.');               // never soft-lock: an empty patch always gets a seed
    }
    const r = sealed ? rollRarity(CFG.overnight.minRarity) : rollRarity();
    const grow = sealed ? CFG.overnight.sec : (CFG.growSecByPlant[S.planted] ?? CFG.growSec);
    S.plots[i] = { crop: RAR[r].crop, plantedAt: now(), growMs: grow * 1000, sealed };
    S.planted++;
    const o = this.plots[i];
    sfx.plant(); this.dirt.explode(10, o.x, o.y + 4); this.squash(o.bed);
    if (!free && !sealed) this.popup(o.x, o.y - 18, '-● ' + CFG.seedPrice, '#ffcf5c');
    if (sealed) { this.sparkle.explode(16, o.x, o.y); UI.say('<b>Kelvin:</b> Sealed. Confidential. See you in ' + fmt(grow * 1000 / SPEED) + '.', 3200); }
    save(S); this.refresh();
  }

  harvest(i) {
    const pl = S.plots[i], r = rarOf(pl.crop), o = this.plots[i];
    const mut = S.harvests + 1 === CFG.guaranteedGoldAtHarvest ? MUT.find(m => m.id === 'gold') : rollMutation();
    const value = RAR[r].value * (mut ? mut.mult : 1), form = mut ? mut.id : 'normal', bk = pl.crop + ':' + form;
    const isNew = !S.book[bk];
    S.book[bk] = (S.book[bk] || 0) + 1; S.coins += value; S.harvests++;
    delete S.plots[i];
    if (isNew) S.seen.bookNew = true;
    sfx.harvest(Math.min(3, r + (mut ? 1 : 0)));
    // the monster jumps out of the soil
    const fly = this.add.image(o.x, o.mon.y, 'dungeon', CROPS[pl.crop].frame).setOrigin(.5, 1).setScale(1.5 * (form === 'giant' ? 1.4 : 1)).setDepth(55);
    if (form === 'gold') fly.setTint(0xffd84a);
    this.tweens.add({ targets: fly, y: o.y - 34, duration: 260, ease: 'Quad.out', yoyo: true, hold: 120, onComplete: () => fly.destroy() });
    this.dirt.explode(12, o.x, o.y + 4); if (r >= 1 || mut) this.sparkle.explode(18, o.x, o.y - 10);
    this.popup(o.x, o.y - 22, '+● ' + value, '#ffcf5c');
    if (r >= 2 || mut) this.cameras.main.shake(140, .006);

    const ev = { i, crop: pl.crop, r, mut, form, value, bk, isNew };
    if (isNew || r >= 2 || mut) this.queue.push({ type: 'reveal', ev });
    const billed = S.harvests === K.firstBillAtHarvest || (S.harvests > K.firstBillAtHarvest && (r >= K.minRarityBilled || Math.random() < K.billChance));
    if (billed) this.queue.push({ type: 'invoice', ev });
    if (S.harvests >= CFG.overnight.afterHarvests && !S.sealedGiven) { S.sealedGiven = true; this.queue.push({ type: 'sealed' }); }
    save(S); this.refresh();
    if (!this.stroke) this.flush();
  }

  popup(x, y, text, color) {
    const t = this.add.text(x, y, text, { fontFamily: '"Press Start 2P"', fontSize: '6px', color, stroke: INK, strokeThickness: 2, resolution: 8 }).setOrigin(.5).setDepth(70);
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  // run queued reveals / invoices one after another, once the finger is up
  async flush() {
    if (this.flushing) return; this.flushing = true;
    while (this.queue.length) {
      const e = this.queue.shift();
      if (e.type === 'reveal') await this.reveal(e.ev);
      if (e.type === 'invoice') await this.invoice(e.ev);
      if (e.type === 'sealed') await this.sealedSeed();
    }
    this.flushing = false; this.refresh();
  }

  // ---------- full-screen pull reveal ----------
  async reveal(ev) {
    const rar = RAR[ev.r], name = CROPS[ev.crop].name, big = ev.form === 'giant' ? 240 : 192;
    if (ev.r >= 2) sfx.harvest(3);
    await UI.open(`<div class="rar" style="background:${rar.color}">${rar.name.toUpperCase()}${ev.mut ? ' · ' + ev.mut.name.toUpperCase() : ''}</div>
      <div class="rays pop" style="--c:${rar.color}"><canvas width="16" height="16" style="width:${big}px;height:${big}px" class="${ev.form === 'rainbow' ? 'rainbow' : ''}"></canvas></div>
      <div class="nm">${ev.form !== 'normal' ? ev.mut.name + ' ' : ''}${name}</div><div class="val">+● ${ev.value}</div>
      ${ev.isNew ? `<div class="new">NEW! 📖 ${bookCount()}/${BOOK_MAX}</div>` : ''}<div class="tap">tap to continue</div>`,
    { cls: 'reveal', onShow: c => drawMon(c.querySelector('canvas'), ev.crop, ev.form) });
  }

  // ---------- Kelvin bills a pull: PAY or DISPUTE ----------
  async walkKelvin(x, y) {
    const k = this.kelvin; k.setFlipX(x < k.x);
    await new Promise(res => this.tweens.add({ targets: k, x, y, duration: Math.min(700, 200 + Phaser.Math.Distance.Between(k.x, k.y, x, y) * 6), ease: 'Sine.inOut', onComplete: res }));
  }

  async invoice(ev) {
    const o = this.plots[ev.i], name = (ev.form !== 'normal' ? ev.mut.name + ' ' : '') + CROPS[ev.crop].name;
    const tax = Math.max(K.minTax, Math.round(ev.value * K.taxPct));
    await this.walkKelvin(o.x + 12, o.y + 4); sfx.beepClick();
    S.billNo++;
    const res = await UI.open(`<div class="sub">INVOICE #${String(S.billNo).padStart(3, '0')} · KELVIN, SENIOR ACCOUNTING</div>
      <canvas width="24" height="24" style="width:72px;height:72px"></canvas>
      <div class="ln"><span>1× ${name}</span><b>● ${ev.value}</b></div>
      <div class="ln"><span>Monster extraction tax</span><b class="minus">-● ${tax}</b></div><hr>
      <div style="font-size:9px;line-height:1.8">DISPUTE: he flips his lucky coin.<br>Win: he pays YOU <span class="plus">● ${tax * K.winMult}</span>.<br>Lose: he keeps the ${name}.</div>`,
    { cls: 'receipt', buttons: [{ id: 'pay', label: `PAY<br>● ${tax}`, cls: 'alt' }, { id: 'dispute', label: 'DISPUTE<br>🪙 50/50', cls: 'hot' }],
      onShow: c => drawKelvin(c.querySelector('canvas')) });
    if (res === 'pay') {
      S.coins = Math.max(0, S.coins - tax); S.stats.paid++; sfx.coin(); UI.stamp('PAID', '#2e8a3a'); UI.say('<b>Kelvin:</b> ' + pick(PAY_LINES));
    } else {
      const win = await this.flip();
      if (win) { S.coins += tax * K.winMult; S.stats.disputesWon++; sfx.harvest(3); UI.stamp('DISPUTE WON', '#2e8a3a'); }
      else { S.coins = Math.max(0, S.coins - ev.value); S.book[ev.bk]--; if (S.book[ev.bk] <= 0) delete S.book[ev.bk]; S.stats.disputesLost++; sfx.nope(); UI.stamp('CONFISCATED'); }
      await UI.open(`<h1>${win ? 'YOU WON' : 'YOU LOST'}</h1><canvas width="24" height="24" style="width:96px;height:96px"></canvas>
        <div style="margin:8px 0">${win ? `Kelvin pays you <span class="plus">● ${tax * K.winMult}</span>` : `Kelvin keeps the ${name}${ev.isNew ? '<br>(it leaves your Book)' : ''}`}</div>
        <div><b>Kelvin:</b> “${win ? pick(WIN_LINES) : pick(LOSE_LINES)}”</div><div class="tap">tap to continue</div>`,
      { cls: 'receipt', onShow: c => drawKelvin(c.querySelector('canvas')) });
    }
    save(S); this.refresh();
    await this.walkKelvin(...KHOME); this.kelvin.setFlipX(false);
  }

  async flip() {
    UI.open('<div class="sub">KELVIN FLIPS HIS LUCKY COIN…</div><div class="coin">🪙</div>', { tapClose: false });
    sfx.beepClick();
    await new Promise(r => setTimeout(r, 1300));
    return Math.random() < K.disputeWinChance;
  }

  // ---------- reasons to come back ----------
  async sealedSeed() {
    await this.walkKelvin(KHOME[0] - 10, KHOME[1] + 6);
    await UI.open(`<div class="sub">INTERNAL MEMO · CONFIDENTIAL</div><canvas width="24" height="24" style="width:72px;height:72px"></canvas>
      <h1>✉️ A SEALED SEED</h1><div>Ripe in <b>${fmt(CFG.overnight.sec * 1000 / SPEED)}</b>. Rare or better.<br>I'll be billing you storage while you're gone.</div>`,
    { cls: 'receipt', buttons: [{ id: 'ok', label: 'TAKE IT' }], onShow: c => drawKelvin(c.querySelector('canvas')) });
    S.sealedReady = true; save(S);
    await this.walkKelvin(...KHOME);
  }

  async welcomeBack() {
    const ripe = Object.entries(S.plots).filter(([, p]) => isRipe(p));
    if (!ripe.length) { UI.say('<b>Kelvin:</b> Welcome back. I\'ve been counting.', 3200); return; }
    const fee = K.storageFee * ripe.length;
    sfx.beepClick(); S.billNo++;
    const res = await UI.open(`<div class="sub">INVOICE #${String(S.billNo).padStart(3, '0')} · WHILE YOU WERE AWAY</div>
      <canvas width="24" height="24" style="width:72px;height:72px"></canvas>
      <div class="ln"><span>${ripe.length}× ripe monster${ripe.length > 1 ? 's' : ''} left in my soil</span><b></b></div>
      <div class="ln"><span>Storage fee</span><b class="minus">-● ${fee}</b></div><hr>
      <div style="font-size:9px;line-height:1.8">DISPUTE: win, he pays YOU <span class="plus">● ${fee * K.winMult}</span>.<br>Lose: he takes one monster.</div>`,
    { cls: 'receipt', buttons: [{ id: 'pay', label: `PAY<br>● ${fee}`, cls: 'alt' }, { id: 'dispute', label: 'DISPUTE<br>🪙 50/50', cls: 'hot' }],
      onShow: c => drawKelvin(c.querySelector('canvas')) });
    if (res === 'pay') { S.coins = Math.max(0, S.coins - fee); sfx.coin(); UI.stamp('PAID', '#2e8a3a'); }
    else if (await this.flip()) { S.coins += fee * K.winMult; S.stats.disputesWon++; UI.stamp('DISPUTE WON', '#2e8a3a'); UI.say('<b>Kelvin:</b> ' + pick(WIN_LINES)); }
    else { const [i, p] = pick(ripe); delete S.plots[i]; S.stats.disputesLost++; UI.stamp('CONFISCATED'); UI.say(`<b>Kelvin:</b> I'll take that ${CROPS[p.crop].name}. Thank you.`, 3200); }
    save(S);
  }

  async intro() {
    sfx.beepClick();
    await UI.open(`<canvas width="24" height="24" style="width:120px;height:120px"></canvas><h1>KELVIN</h1><div class="sub">SENIOR ACCOUNTING</div>
      <div>“This farm owes me money.<br>Grow monsters. I bill what you pull.”</div>`,
    { cls: 'receipt', buttons: [{ id: 'ok', label: '…FINE' }], onShow: c => drawKelvin(c.querySelector('canvas')) });
    S.seen.intro = true; save(S);
  }

  async openBook() {
    S.seen.bookNew = false;
    const cells = SPECIES.map(c => FORMS.map(f => `<div class="${S.book[c + ':' + f] ? 'got' : ''}"><canvas width="16" height="16" data-c="${c}" data-f="${f}"
      style="width:40px;height:40px" class="${f === 'rainbow' && S.book[c + ':' + f] ? 'rainbow' : ''}"></canvas>${S.book[c + ':' + f] ? (f === 'normal' ? CROPS[c].name.split(' ').pop() : f) : '?'}</div>`).join('')).join('');
    await UI.open(`<h1>📖 MONSTER BOOK</h1><div class="sub">${bookCount()} / ${BOOK_MAX} FOUND</div>
      <div class="book">${FORMS.map(f => `<div class="hd">${f.toUpperCase()}</div>`).join('')}${cells}</div>
      <div style="font-size:8px;line-height:1.8">Next page: the Episode ${CFG.vote.episode} vote<br>(${CFG.vote.options.join(' / ')}) changes Kelvin and adds new monsters.</div>`,
    { buttons: [{ id: 'ok', label: 'CLOSE' }], onShow: c => c.querySelectorAll('canvas').forEach(cv => drawMon(cv, cv.dataset.c, cv.dataset.f, !!S.book[cv.dataset.c + ':' + cv.dataset.f])) });
    this.refresh();
  }

  // ---------- drawing state ----------
  refresh() {
    let arrowAt = null, ripeAny = false;
    this.plots.forEach((o, i) => {
      const p = S.plots[i];
      if (!p) { o.mon.setVisible(false); o.bang.setVisible(false); o.label.setText(''); o.bed.clearTint(); if (arrowAt === null && (S.planted === 0 || S.sealedReady)) arrowAt = i; return; }
      const left = growLeft(p), prog = 1 - left / (p.growMs / SPEED), ripe = left === 0, rows = ripe ? 16 : Math.round(5 + 8 * prog);
      o.mon.setFrame(CROPS[p.crop].frame).setVisible(true).setCrop(0, 0, 16, rows).setY(o.y + 8 + (16 - rows) * 1.5);
      if (ripe) { o.mon.clearTint().setAlpha(1); ripeAny = true; if (S.harvests === 0 && arrowAt === null) arrowAt = i; }
      else o.mon.setTintFill(0x2b1d3a).setAlpha(.75);
      if (ripe && !o.bob) o.bob = this.tweens.add({ targets: o.mon, scaleY: 1.62, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (!ripe && o.bob) { o.bob.stop(); o.bob = null; o.mon.setScale(1.5); }
      o.bang.setVisible(ripe);
      o.label.setText(ripe ? '' : (p.sealed ? '✉ ' : '') + fmt(left));
      if (p.sealed) o.bed.setTint(0xffe0a0); else o.bed.clearTint();
    });
    this.plots.forEach(o => { if (!S.plots[o.i] && o.bob) { o.bob.stop(); o.bob = null; o.mon.setScale(1.5); } });
    if (arrowAt !== null && !UI.modalOpen) { const [x, y] = plotC(arrowAt); this.arrow.setVisible(true).setX(x); if (!this.arrow.placed || this.arrow.placed !== arrowAt) { this.arrow.y = y - 26; this.arrow.placed = arrowAt; } }
    else { this.arrow.setVisible(false); this.arrow.placed = null; }

    const free = Math.max(0, CFG.freeSeeds - S.planted);
    UI.setHud({ coins: S.coins, book: bookCount(), bookMax: BOOK_MAX, bookPulse: S.seen.bookNew,
      seedLabel: S.sealedReady ? '✉️ <i>SEALED</i>' : free ? `SEED <i>FREE×${free}</i>` : `SEED <i>● ${CFG.seedPrice}</i>` });
    const growing = Object.values(S.plots), next = growing.length ? Math.min(...growing.map(growLeft)) : 0;
    UI.setHint(UI.modalOpen ? null
      : S.planted === 0 ? 'Tap the soil to plant a monster seed'
      : S.harvests === 0 && ripeAny ? 'It\'s ripe! Tap it to pull it out'
      : S.harvests === 0 ? `Something's growing… ${fmt(next)}`
      : S.sealedReady ? 'Plant the ✉️ sealed seed in an empty plot'
      : S.harvests < 3 ? 'Fill the patch · swipe across ripe ones'
      : S.harvests < 6 && bookCount() < 4 ? `Collect all ${BOOK_MAX} in the 📖 Monster Book`
      : null);
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
  UI.initUI(document.body, a => { unlock(); if (scene && a === 'book' && !UI.modalOpen) scene.openBook(); });
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: el, backgroundColor: '#84c669', pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: el.clientWidth, height: el.clientHeight }, scene: [Patch],
  });
  game.events.on('ready', () => { scene = game.scene.getScene('patch'); });
})();
