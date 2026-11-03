// CLAIM REJECTED (Game By Vote v0.6).
// Day shift: claims slide onto your desk; stamp them into the SHREDDER (reject) or the PAID tray (approve),
// judged only by the rules on the board. Kelvin from Accounting adds a rule a day, sneaks in dodgy claims,
// and you can stamp his face (he files a counter-claim). End of shift: the receipt pile collapses on him.
// Unpaid overtime = SCAM MODE: pile absurd items onto your own claim and slide it into Kelvin's tray;
// he audits it overnight. Votes add rules, hazards, colleagues and scam items.
import './style.css';
import CFG from './data/config.json';
import DATA from './data/claims.json';
import SCAM from './data/scam.json';
import { sfx, unlock } from './sfx.js';
import { load, save, wipe } from './save.js';

const q = new URLSearchParams(location.search);
const DEBUG = q.has('debug');
if (q.has('reset')) wipe();
let S = load();
const RULES = DATA.rules, CLAIMS = DATA.claims, KL = DATA.kelvin, COL = DATA.colleagues || {};
const COUNTER = { id: 'counter', from: 'kelvin', item: 'Emotional damage', pic: '😭', amount: 49.9, note: 'You stamped my face', breaks: null,
  why: 'Sadly, no rule against emotional damage. Yet.', counter: true };
const BY_ID = Object.fromEntries([...CLAIMS, COUNTER].map(c => [c.id, c]));
const RULE = Object.fromEntries(RULES.map(r => [r.id, r]));
const ITEM = Object.fromEntries(SCAM.items.map(i => [i.id, i]));
const asset = p => new URL(p, document.baseURI).href;
document.documentElement.style.setProperty('--kel', `url(${asset('sprites/kelvin.png')})`);

// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const pick = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];
const money = n => '$' + Number(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const wait = ms => new Promise(r => setTimeout(r, ms));
function rng(seedStr) {                                 // mulberry32 seeded by a string
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let dayOffset = 0;                                      // ?debug=1 can jump days
const sgDate = () => new Date(Date.now() + 8 * 3600e3 + dayOffset * 86400e3).toISOString().slice(0, 10);
const msToMidnight = () => { const t = Date.now() + 8 * 3600e3 + dayOffset * 86400e3; return 86400e3 - (t % 86400e3); };

function activeRules(day) {
  const n = CFG.startRules + day - 1;
  if (n <= RULES.length) return RULES.slice(Math.max(0, n - CFG.maxRules), n);
  const r = rng('rules|' + day), pool = [...RULES];   // after every rule is out: a seeded mix of 5
  return Array.from({ length: CFG.maxRules }, () => pool.splice(Math.floor(r() * pool.length), 1)[0]);
}
const newestRule = day => (CFG.startRules + day - 1 <= RULES.length ? activeRules(day).at(-1) : null);

// today's claims: the same for everyone on the same date and career day
function dealShift(date, day) {
  const r = rng(date + '|' + day), act = new Set(activeRules(day).map(x => x.id)), newest = newestRule(day);
  const ok = c => c.breaks == null || act.has(c.breaks);
  const unseen = c => !S.seenClaims[c.id];
  const take = list => { const u = list.filter(unseen), pool = u.length ? u : list; return pool.length ? pool[Math.floor(r() * pool.length)] : null; };
  const chosen = [], add = c => { if (c && !chosen.includes(c)) chosen.push(c); };
  const notK = CLAIMS.filter(c => c.from !== 'kelvin' && ok(c));
  add(take(CLAIMS.filter(c => c.from === 'kelvin' && c.breaks && act.has(c.breaks))));
  if (newest) add(take(notK.filter(c => c.breaks === newest.id)));
  add(take(notK.filter(c => c.breaks && !chosen.includes(c))));
  while (chosen.length < CFG.claimsPerDay) { const c = take(notK.filter(c => c.breaks == null && !chosen.includes(c))) || take(notK.filter(c => !chosen.includes(c))); if (!c) break; add(c); }
  for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
  if (day === 1) {                                       // first claim ever: an obvious one (a broken first rule, from a colleague)
    const j = chosen.findIndex(c => c.from !== 'kelvin' && c.breaks === RULES[0].id);
    if (j > 0) chosen.unshift(chosen.splice(j, 1)[0]);
  }
  return chosen.map(c => c.id);
}

// ---------- screen ----------
const app = document.getElementById('app');
app.innerHTML = `
  <div id="top"><span class="chip" id="c_day"></span><span class="chip" id="c_n"></span></div>
  <div id="meters"></div>
  <div id="rules"></div>
  <div id="kel"><div id="kelvin" class="idle"></div><div id="bubble"></div></div>
  <div id="stage"></div>
  <div id="bottom"></div>
  <div id="toast"></div>`;
const stage = $('#stage'), bottom = $('#bottom');

function meters() {
  const m = (id, label, v, col) => `<div class="m" id="${id}">${label}<div class="bar"><b style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></b></div></div>`;
  $('#meters').innerHTML = m('m_b', '💰 BUDGET', S.budget, '#ffcf5c') + m('m_m', '🙂 MORALE', S.morale, '#7fd88a') + m('m_k', '🤨 KELVIN GRUDGE', S.grudge * 12, '#ff7a6a');
}
function hitMeter(id) { const el = $('#' + id); if (!el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
function rulesBoard(day, title) {
  const nw = newestRule(day);
  $('#rules').innerHTML = `<div class="t">${title || '📌 RULES (set by Kelvin)'}</div>` + (title ? '' : activeRules(day).map(r =>
    `<div class="r ${nw && r.id === nw.id ? 'new' : ''}"><span class="ic">${r.icon}</span><span>${esc(r.text)}</span>${nw && r.id === nw.id && day > 1 ? '<span class="badge">NEW</span>' : ''}</div>`).join(''));
}
function kelvinFace() {
  const k = $('#kelvin'); k.innerHTML = S.face === sgDate() ? '<span class="sticker">REJECTED</span>' : '';
}
function say(html, mood) {
  const b = $('#bubble'); b.innerHTML = html; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  const k = $('#kelvin'); if (mood) { k.className = ''; void k.offsetWidth; k.className = mood; setTimeout(() => (k.className = 'idle'), 800); }
}
const K = t => '<b>Kelvin:</b> ' + esc(t);
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1800); }
function fly(text, x, y) { const f = document.createElement('div'); f.className = 'fly'; f.textContent = text; f.style.left = x + 'px'; f.style.top = y + 'px'; app.append(f); setTimeout(() => f.remove(), 1200); }
function avatar(from, sc = 3) {
  const c = CFG.cast[from] || CFG.cast.gloop;
  if (from === 'kelvin') return `<span class="s" style="width:${16 * sc}px;height:${16 * sc}px;background:var(--kel) 0 0/${16 * sc}px ${16 * sc}px"></span>`;
  return `<span class="s" style="width:${16 * sc}px;height:${16 * sc}px;background-image:url(${asset('sprites/dungeon.png')});background-size:${192 * sc}px ${176 * sc}px;background-position:-${(c.frame % 12) * 16 * sc}px -${Math.floor(c.frame / 12) * 16 * sc}px"></span>`;
}
// a claim shows only what today's rules need: who, item, picture, amount, its note; time and date only if a rule checks them
function cardHTML(c, no) {
  const who = CFG.cast[c.from] || { name: c.from, role: '' }, checks = new Set(activeRules(S.day).map(r => r.check));
  const row = (k, label, v) => v == null || v === '' ? '' : `<div class="row" data-f="${k}"><span>${label}</span><b>${esc(v)}</b></div>`;
  return `<div class="hd"><span>EXPENSE CLAIM #${String(no).padStart(4, '0')}</span><span>${c.from === 'kelvin' ? '⚠️ KELVIN' : ''}</span></div>
    <div class="who">${avatar(c.from)}<div><b>${esc(who.name)}</b><br><small>${esc(who.role)}</small></div></div>
    <div class="item"><span class="pic">${c.pic}</span><span>${esc(c.item)}</span></div>
    ${row('amount', 'Amount', money(c.amount))}${checks.has('time') ? row('time', 'Time', c.time) : ''}${checks.has('date') ? row('date', 'Date', c.date) : ''}${row('note', 'Note', c.note && '“' + c.note + '”')}
    <div class="lab ap">PAY</div><div class="lab rj">SHRED</div>`;
}

// ---------- day shift: the stamping desk ----------
let cur = null, busy = false;

function deskBottom() {
  bottom.innerHTML = `<div id="bins"><button class="bin" id="shred">✖ SHRED<small>reject · swipe ←</small></button><button class="bin" id="tray">PAY ✔<small>approve · swipe →</small></button></div>`;
  $('#shred').onclick = () => { unlock(); decide(false); };
  $('#tray').onclick = () => { unlock(); decide(true); };
}

function showClaim() {
  stage.innerHTML = '';
  const sh = S.shift, c = BY_ID[sh.ids[sh.i]];
  if (!c) return endShift();
  cur = c;
  $('#c_n').innerHTML = `CLAIM <i>${sh.i + 1}</i>/${sh.ids.length}`;
  if (sh.i + 1 < sh.ids.length) { const back = document.createElement('div'); back.className = 'card back'; back.innerHTML = cardHTML(BY_ID[sh.ids[sh.i + 1]], 401 + S.day * 10 + sh.i); stage.append(back); }
  const el = document.createElement('div'); el.className = 'card' + (c.from === 'kelvin' ? ' kelvin' : '');
  el.innerHTML = cardHTML(c, 400 + S.day * 10 + sh.i);
  stage.append(el); drag(el);
  el.animate([{ transform: 'translateX(-120%) rotate(-14deg)' }, { transform: 'translateX(6%) rotate(2deg)', offset: .75 }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
  if (c.counter) say(K('Counter-claim. You know what you did.'), 'smug');
  else if (c.from === 'kelvin') say(K(pick(['This one is… routine. Pay it.', "Don't look too closely. Just stamp.", 'Mine. Obviously legitimate.'])), 'smug');
  sfx.swish(); $('#bins')?.classList.remove('off'); busy = false;
}

function drag(el) {
  let x0 = null, dx = 0;
  const ap = $('.lab.ap', el), rj = $('.lab.rj', el);
  el.addEventListener('pointerdown', e => { if (busy) return; unlock(); x0 = e.clientX; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
  el.addEventListener('pointermove', e => {
    if (x0 == null) return; dx = e.clientX - x0;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    ap.style.opacity = Math.max(0, Math.min(1, dx / 90)); rj.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const up = () => {
    if (x0 == null) return; x0 = null;
    if (Math.abs(dx) > 80) decide(dx > 0);
    else { el.style.transition = 'transform .2s'; el.style.transform = ''; ap.style.opacity = rj.style.opacity = 0; }
    dx = 0;
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

function shredStrips(x, y) {
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div'); s.className = 'strip';
    s.style.left = (x - 24 + i * 6) + 'px'; s.style.top = y + 'px'; s.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg'); s.style.animationDelay = (i * 25) + 'ms';
    app.append(s); setTimeout(() => s.remove(), 1100);
  }
}

async function decide(approve) {
  if (busy || !cur) return; busy = true; $('#bins')?.classList.add('off');
  const c = cur, valid = c.breaks == null, right = approve === valid, kelvin = c.from === 'kelvin';
  const el = stage.querySelector('.card:not(.back)');
  const st = document.createElement('div'); st.className = 'stampd'; st.textContent = approve ? 'APPROVED' : 'REJECTED';
  st.style.color = approve ? '#2e8a3a' : '#d9443a'; el.append(st); $('.lab.ap', el).style.opacity = $('.lab.rj', el).style.opacity = 0;
  el.style.transition = 'none'; el.style.transform = '';
  sfx.stamp(); navigator.vibrate?.(30);
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94,1.04) translateY(4px)' }, { transform: 'scale(1)' }], { duration: 160 });

  S.seenClaims[c.id] = 1;
  const sh = S.shift, r = c.breaks ? RULE[c.breaks] : null;
  sh.results.push({ id: c.id, ok: right, kelvin: kelvin && !c.counter, approved: approve });
  if (right) { S.stats.right++; S.morale = Math.min(100, S.morale + CFG.morale.correct); } else S.stats.wrong++;
  if (kelvin && !valid && !approve) { sh.caught++; S.grudge++; S.stats.caught++; }
  if (kelvin && !valid && approve) { sh.fooled++; S.stats.fooled++; S.budget -= CFG.budget.kelvinFooled; hitMeter('m_b'); }
  else if (!right && approve) { S.budget -= CFG.budget.wrongApprove; hitMeter('m_b'); }
  else if (!right && !approve) { S.morale -= CFG.morale.wrongReject; hitMeter('m_m'); }
  if (c.counter && approve) { S.budget -= 5; hitMeter('m_b'); }
  sh.i++; save(S); meters();

  // verdict: one line, no popup (the full review is on the end-of-shift report)
  const v = document.createElement('div'); v.className = 'verdict ' + (right ? 'ok' : 'no');
  v.textContent = right ? '✔ CORRECT' : r ? '✖ ' + r.icon + ' ' + r.text : '✖ It was legit!';
  stage.append(v);
  let line, mood = null;
  if (c.counter) line = approve ? 'Pleasure. Paid in full.' : 'Rejecting my damages. More damages.';
  else if (kelvin && !valid) { line = pick(approve ? KL.fooled : KL.caught); mood = approve ? 'smug' : 'shake'; }
  else if (!right && !approve && COL[c.from]) line = null;
  else line = pick(right ? KL.correct : KL.wrong);
  if (line) say(K(line), mood);
  else say(`<b>${esc(CFG.cast[c.from]?.name)}:</b> “${esc(pick(COL[c.from]))}”`);
  if (right) sfx.ding(); else sfx.buzz();
  if (kelvin && !valid && approve) { const b = $('#m_b').getBoundingClientRect(); fly('-' + CFG.budget.kelvinFooled + '%', b.left + 20, b.top + 10); }

  await wait(right ? 420 : 900);
  // the card flies into its bin
  const bin = $(approve ? '#tray' : '#shred').getBoundingClientRect(), box = el.getBoundingClientRect();
  const dx = bin.left + bin.width / 2 - (box.left + box.width / 2), dy = bin.top - (box.top + box.height / 2);
  const go = (k = 1) => el.animate([{ transform: 'none' }, { transform: `translate(${dx * k}px,${dy * k}px) scale(.25) rotate(${approve ? 20 : -20}deg)`, opacity: k === 1 ? .2 : 1 }], { duration: 380, easing: 'ease-in', fill: 'forwards' }).finished;
  await go();
  if (!approve) {
    if (kelvin && !valid) {                              // Kelvin's dodgy claims are heavy: they bounce back out of the shredder once
      sfx.buzz();
      await el.animate([{ transform: `translate(${dx}px,${dy}px) scale(.25)` }, { transform: `translate(${dx * .5}px,${dy - 120}px) scale(.5) rotate(200deg)`, opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.2) rotate(380deg)`, opacity: .2 }],
        { duration: 700, easing: 'ease-in-out', fill: 'forwards' }).finished;
    }
    shredStrips(bin.left + bin.width / 2, bin.top + 10); sfx.stamp();
  } else sfx.coin();
  el.remove(); v.remove();
  sh.i < sh.ids.length ? showClaim() : endShift();
}

// stamp Kelvin's face (once a day): he wears it all day and files a counter-claim
function stampKelvin() {
  unlock();
  const sh = S.shift, today = sgDate();
  if (!sh || sh.done || busy || mode !== 'desk') { sfx.beepClick(); say(K(pick(['Do not touch the Senior Accountant.', 'That was a billable poke.', 'Per my last email: no.']))); return; }
  if (S.face === today) { sfx.beepClick(); say(K('Once was enough. I have a receipt for it.'), 'shake'); return; }
  S.face = today; sfx.stamp(); navigator.vibrate?.(60);
  kelvinFace(); say(K('…Did you just stamp my FACE.'), 'shake');
  const k = $('#kelvin').getBoundingClientRect(); fly('REJECTED', k.left, k.top);
  if (!sh.ids.includes('counter')) sh.ids.splice(sh.i + 1, 0, 'counter');
  $('#c_n').innerHTML = `CLAIM <i>${sh.i + 1}</i>/${sh.ids.length}`;
  save(S);
  setTimeout(() => say(K('I am filing a counter-claim. It\'s next.'), 'smug'), 1400);
}
$('#kelvin').addEventListener('click', stampKelvin);

// ---------- sheets ----------
function sheet(html, buttons, onShow) {
  return new Promise(res => {
    const s = document.createElement('div'); s.className = 'sheet';
    s.innerHTML = `<div class="paper">${html}${buttons ? `<div class="btns">${buttons.map(b => `<button data-id="${b.id}" class="${b.alt ? 'alt' : ''}">${b.label}</button>`).join('')}</div>` : ''}</div>`;
    app.append(s); onShow?.(s);
    s.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; unlock(); sfx.tap(); if (b.dataset.id === 'speak') return speak(b.dataset.t); s.remove(); res(b.dataset.id); });
  });
}
function speak(text) {
  try { const u = new SpeechSynthesisUtterance(text); u.rate = .85; u.pitch = .7; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
}

async function fired() {
  S.stats.fired++; sfx.buzz();
  await sheet(`<div class="kv"></div><h1 class="bad">YOU'RE FIRED</h1><div class="say"><b>Kelvin:</b> “${esc(pick(KL.fired))}”</div>
    <div class="small">${S.budget <= 0 ? 'The budget hit zero.' : 'Office morale hit zero.'}<br>HR (Gloop) has rehired you. Same desk. Lower pay.</div>`, [{ id: 'ok', label: 'Report back to desk' }]);
  S.budget = Math.max(S.budget, 50); S.morale = Math.max(S.morale, 50); save(S); meters();
}

// ---------- day flow ----------
let mode = 'desk';
function startShift(date) {
  S.shift = { date, day: S.day, ids: dealShift(date, S.day), i: 0, results: [], caught: 0, fooled: 0 };
  save(S);
}

// last night's scam, audited by Kelvin at 9 AM sharp
async function auditScam() {
  const sc = S.scam; S.scam = null;
  if (!sc) return;
  const items = sc.items.map(id => ITEM[id]).filter(Boolean), sus = items.reduce((a, i) => a + i.sus, 0);
  const p = Math.min(.97, SCAM.catchBase + sus * SCAM.catchPerSus), caught = rng('scam|' + sc.date + '|' + sc.items.join()).call() < p;
  const lines = items.map((i, n) => `<div class="ln" style="display:flex;justify-content:space-between"><span>${n + 1}. ${i.pic} ${esc(i.name)}</span><b style="font-weight:normal">${money(i.price)}</b></div>`).join('');
  const read = 'Line by line. ' + items.map((i, n) => `Line ${n + 1}. ${i.name}. ${i.price} dollars.`).join(' ') + (caught ? ' Rejected.' : ' Fine.');
  if (caught) {
    S.shame++; const fine = Math.min(40, Math.round(SCAM.caughtFinePct * Math.min(80, sus * 4)));
    S.budget = Math.max(5, S.budget - fine); save(S); meters();
    await sheet(`<div class="sub">KELVIN'S 9 AM AUDIT · YOUR OVERTIME CLAIM</div><div class="kv"></div>
      <div class="unroll">${lines}<hr><div class="ln" style="display:flex;justify-content:space-between"><b>TOTAL</b><b>${money(sc.total)}</b></div></div>
      <h1 class="bad">CAUGHT</h1><div class="say"><b>Kelvin:</b> “${esc(fill(pick(SCAM.kelvin.caught), { n: S.shame }))}”</div>
      <div class="small">📌 Stapled to the Wall of Shame (#${S.shame}) · Budget -${fine}%</div>`,
    [{ id: 'speak', label: '🔊 Hear Kelvin read it out', alt: true }, { id: 'ok', label: 'Noted with thanks 🙏' }], s => { const b = s.querySelector('[data-id=speak]'); b.dataset.t = read; });
  } else {
    S.scamEarned = Math.round((S.scamEarned + sc.total) * 100) / 100; save(S);
    await sheet(`<div class="sub">KELVIN'S 9 AM AUDIT · YOUR OVERTIME CLAIM</div><div class="kv"></div>
      <div class="unroll">${lines}</div><h1 class="good">“${esc(pick(SCAM.kelvin.approved))}”</h1>
      <div>+${money(sc.total)} snuck through.<br>Lifetime scam savings: <b>${money(S.scamEarned)}</b></div>`,
    [{ id: 'ok', label: 'Act natural 😐' }]);
  }
}

async function morning() {
  const y = S.yesterday || { caught: 0, wrong: 0, right: 0 }, nw = newestRule(S.day);
  const intro = nw ? (KL.rule_intro?.[nw.id] || 'New rule. Effective immediately.') : 'No new rule today. Enjoy the uncertainty.';
  const n = CFG.startRules + S.day - 1, retired = n > CFG.maxRules && n <= RULES.length ? RULES[n - CFG.maxRules - 1] : null;
  await sheet(`<div class="sub">INTERNAL MEMO · DAY ${S.day}</div><div class="kv"></div>
    <div class="say"><b>Kelvin:</b> “${esc(fill(pick(KL.morning), { caught: y.caught, wrong: y.wrong, right: y.right, streak: S.streak }))}”</div>
    ${nw ? `<div class="newrule">NEW RULE<br>${nw.icon} ${esc(nw.text)}<br><span style="font-size:8px">“${esc(intro)}”</span></div>` : ''}
    ${retired ? `<div class="small">Retired: ${retired.icon} ${esc(retired.text)}</div>` : ''}`, [{ id: 'go', label: 'Start shift ☕' }]);
}

async function intro() {
  await sheet(`<div class="kv"></div><h1>KELVIN</h1><div class="sub">SENIOR ACCOUNTING. SENIOR.</div>
    <div class="say">“You're the new finance hire. Claims land on your desk. Follow the rules: <span class="good">PAY</span> the good ones, <span class="bad">SHRED</span> the rest.<br><br>I make the rules. I also… submit claims. Don't worry about those.”</div>
    <div class="small">Swipe → or tap the tray to pay · swipe ← or tap the shredder to reject<br>Psst: you can also stamp Kelvin. Once a day.</div>`, [{ id: 'ok', label: 'OK boss' }]);
  S.intro = true; save(S);
}

async function endShift() {
  stage.innerHTML = ''; cur = null; $('#bins')?.classList.add('off');
  const sh = S.shift, right = sh.results.filter(r => r.ok).length, wrong = sh.results.length - right;
  if (!sh.done) {
    sh.done = true; S.stats.shifts++;
    S.yesterday = { caught: sh.caught, wrong, right };
    S.streak = wrong === 0 ? S.streak + 1 : 0;
    S.budget = Math.min(100, S.budget + CFG.budget.dailyTopUp); save(S); meters();
  }
  if (S.budget <= 0 || S.morale <= 0) await fired();
  say(K(pick(KL.report)));
  report();
}

const gridOf = sh => sh.results.map(r => (r.kelvin ? (r.ok ? '🧾' : '💸') : r.ok ? '🟩' : '🟥')).join('');
function shareText() {
  const sh = S.shift, k = sh.results.some(r => r.kelvin);
  return `CLAIM REJECTED · Day ${sh.day}\n${gridOf(sh)}\n${k ? (sh.caught ? 'Caught Kelvin 🧾' : 'Kelvin fooled me 💸') : ''}${S.face === sh.date ? ' · Stamped his face 🫵' : ''}${S.streak > 1 ? ` · 🔥${S.streak}` : ''}\n${CFG.share.url}`;
}

async function report() {
  mode = 'report';
  const sh = S.shift, right = sh.results.filter(r => r.ok).length, today = sgDate();
  // the end-of-shift collapse: every receipt of the day lands on Kelvin
  const pile = sh.results.map((r, i) => { const c = BY_ID[r.id]; return `<div class="pp" style="left:${20 + (i % 3) * 52 + (i * 13) % 17}px;bottom:${Math.floor(i / 3) * 24 + (i % 2) * 8}px;transform:rotate(${(i * 37) % 30 - 15}deg);animation-delay:${.3 + i * .18}s">${c?.pic || '🧾'}</div>`; }).join('');
  const mistakes = sh.results.filter(r => !r.ok).map(r => { const c = BY_ID[r.id], ru = c?.breaks && RULE[c.breaks]; return `<span class="bad">✖ ${c.pic} ${esc(c.item)}: ${ru ? ru.icon + ' ' + esc(ru.text) : 'it was legit'}</span>${esc(c.why || '')}`; }).join('<br>');
  const tick = () => { const ms = msToMidnight(), h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1000); return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`; };
  const scammed = S.scam && S.scam.date === today;
  const btns = [{ id: 'share', label: 'SHARE MY SHIFT 🧾' }, scammed ? { id: 'none', label: '😴 Claim submitted. Kelvin audits at 9 AM.', alt: true } : { id: 'ot', label: 'Unpaid overtime: SCAM MODE 😈', alt: true }];
  if (DEBUG) btns.push({ id: 'next', label: '[debug] next day', alt: true });
  const p = sheet(`<div class="sub">END OF SHIFT · DAY ${sh.day}</div><h1>${right}/${sh.results.length} CORRECT</h1>
    <div class="collapse"><div class="kv"></div>${pile}</div>
    <div class="grid">${gridOf(sh)}</div>
    <div class="stats"><span><b>${sh.caught}</b>caught Kelvin</span><span><b>${S.budget}%</b>budget</span><span><b>${S.morale}%</b>morale</span><span><b>${S.streak}</b>🔥 streak</span></div>
    ${mistakes ? `<div class="review">${mistakes}</div>` : ''}
    <div class="small">Next shift in <span id="cd">${tick()}</span>${S.shame ? ` · Wall of Shame: ${S.shame}` : ''}${S.scamEarned ? ` · Scam savings ${money(S.scamEarned)}` : ''}</div>
    <div class="small">🗳️ This week's vote: Kelvin spills <b>${CFG.vote.options.join(' / ')}</b> on the receipts. Vote in the TikTok comments.</div>`, btns);
  sfx.stamp(); setTimeout(() => sfx.stamp(), 600);
  const cd = setInterval(() => { const el = document.getElementById('cd'); if (el) el.textContent = tick(); if (msToMidnight() < 1500) { clearInterval(cd); location.reload(); } }, 1000);
  const act = await p; clearInterval(cd);
  if (act === 'share') {
    const text = shareText();
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Copied! Paste it anywhere 🧾'); } } catch (e) {}
    return report();
  }
  if (act === 'next') { dayOffset++; return boot(); }
  if (act === 'ot') return scamMode();
  return report();
}

// ---------- unpaid overtime: SCAM MODE ----------
let pile = [];
async function scamMode() {
  mode = 'scam'; pile = []; S.stats.overtime++; save(S);
  $('#c_day').innerHTML = `DAY <i>${S.day}</i> · 🌙 OT`; $('#c_n').innerHTML = 'SCAM MODE';
  rulesBoard(S.day, '😈 SNEAK YOUR OWN CLAIM INTO KELVIN\'S TRAY. Bigger pile = more money = more suspicious.');
  say('<i>' + esc(pick(SCAM.kelvin.intro)) + '</i>');
  $('#kelvin').style.opacity = .35;
  stage.innerHTML = `<div class="scampaper"><div class="hd"><span>MY CLAIM (totally legit)</span><span id="tot">$0.00</span></div><div class="pile" id="pile"></div></div>`;
  bottom.innerHTML = `<div class="susbar">🤨 Kelvin will catch it: <span id="pct">5%</span><div class="bar"><b id="susb" style="width:5%"></b></div></div>
    <div id="shelf">${SCAM.items.map(i => `<button data-id="${i.id}"><b>${i.pic}</b>${esc(i.name.split(' (')[0].slice(0, 14))}<br>${money(i.price).replace('.00', '')}</button>`).join('')}</div>
    <div id="scamrow"><button class="clr">CLEAR</button><button class="go">SLIDE INTO KELVIN'S TRAY ➜</button></div>`;
  $('#shelf').onclick = e => { const b = e.target.closest('button'); if (b) addItem(b.dataset.id); };
  $('.clr', bottom).onclick = () => { pile = []; drawPile(); };
  $('.go', bottom).onclick = submitScam;
  drawPile();
}
function pileStats() {
  const items = pile.map(id => ITEM[id]), sus = items.reduce((a, i) => a + i.sus, 0), weight = items.reduce((a, i) => a + i.weight, 0);
  return { total: items.reduce((a, i) => a + i.price, 0), p: Math.min(.97, SCAM.catchBase + sus * SCAM.catchPerSus), weight };
}
function drawPile() {
  const el = $('#pile'); if (!el) return;
  const st = pileStats(), r = rng('pile' + pile.length);
  el.innerHTML = pile.map((id, n) => `<span style="left:calc(50% - 20px + ${Math.round((r() - .5) * 60)}px);bottom:${n * 26}px;transform:rotate(${Math.round((r() - .5) * 40)}deg)">${ITEM[id].pic}</span>`).join('');
  el.className = 'pile ' + (st.weight > SCAM.toppleWeight * .75 ? 'w3' : st.weight > SCAM.toppleWeight * .45 ? 'w2' : pile.length ? 'w1' : '');
  $('#tot').textContent = money(st.total); $('#pct').textContent = Math.round(st.p * 100) + '%'; $('#susb').style.width = st.p * 100 + '%';
}
async function addItem(id) {
  unlock();
  if (pile.length >= SCAM.maxItems) { sfx.nope(); toast('The claim form is full. Even you have limits.'); return; }
  pile.push(id); sfx.tap(); drawPile();
  if (pileStats().weight > SCAM.toppleWeight) {               // the pile topples: one item lands on Kelvin
    sfx.buzz(); navigator.vibrate?.(80);
    const el = $('#pile'), k = $('#kelvin').getBoundingClientRect(), box = el.getBoundingClientRect();
    el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-75deg) translateX(-40px)', opacity: 0 }], { duration: 600, easing: 'ease-in', fill: 'forwards' });
    const it = ITEM[pile[Math.floor(Math.random() * pile.length)]], f = document.createElement('div');
    f.className = 'flyitem'; f.textContent = it.pic; f.style.left = box.left + box.width / 2 + 'px'; f.style.top = box.top + 'px'; app.append(f);
    $('#kelvin').style.opacity = 1;
    await f.animate([{ transform: 'none' }, { transform: `translate(${k.left - box.left - box.width / 2 + 20}px,${k.top - box.top - 60}px) rotate(400deg)`, offset: .6 }, { transform: `translate(${k.left - box.left - box.width / 2 + 20}px,${k.top - box.top + 10}px) rotate(380deg)` }],
      { duration: 900, easing: 'ease-out', fill: 'forwards' }).finished;
    sfx.stamp(); say(K(pick(SCAM.kelvin.topple)), 'shake');
    setTimeout(() => f.remove(), 900);
    pile = []; await wait(700); el.getAnimations().forEach(a => a.cancel()); drawPile();
    toast('The pile fell over. Start again. Lighter.');
  }
}
async function submitScam() {
  if (!pile.length) { sfx.nope(); toast('An empty claim. Even Kelvin would be suspicious.'); return; }
  const st = pileStats(), el = $('.scampaper'), k = $('#kelvin').getBoundingClientRect(), box = el.getBoundingClientRect();
  sfx.swish();
  await el.animate([{ transform: 'none' }, { transform: `translate(${k.left - box.left}px,${k.top - box.top}px) scale(.15) rotate(-20deg)`, opacity: .2 }], { duration: 600, easing: 'ease-in', fill: 'forwards' }).finished;
  S.scam = { date: sgDate(), items: [...pile], total: Math.round(st.total * 100) / 100 }; save(S);
  $('#kelvin').style.opacity = 1;
  say(K(pick(SCAM.kelvin.submit)), 'smug');
  await wait(900);
  await sheet(`<div class="sub">OVERTIME CLAIM SUBMITTED</div><div class="kv"></div><h1>${money(st.total)}</h1>
    <div>${pile.map(id => ITEM[id].pic).join(' ')}</div><div class="say">Kelvin audits it at <b>9 AM</b>.<br>Chance he catches you: <b>${Math.round(st.p * 100)}%</b></div>
    <div class="small">Come back tomorrow for the verdict (and a new shift).</div>`, [{ id: 'ok', label: 'Go home, act natural 😐' }]);
  mode = 'report'; rulesBoard(S.day); deskBottom(); report();
}

async function boot() {
  mode = 'desk'; $('#kelvin').style.opacity = 1;
  const today = sgDate();
  if (S.shift && S.shift.date !== today) { if (S.shift.done || S.shift.i > 0) S.day++; S.shift = null; }   // a new day: next career day
  meters(); rulesBoard(S.day); kelvinFace(); deskBottom();
  $('#c_day').innerHTML = `DAY <i>${S.day}</i>`; $('#c_n').innerHTML = 'CLAIMS';
  say(K("Desk. Now. The claims won't shred themselves."));
  if (!S.intro) await intro();
  if (!S.shift) {
    if (S.scam && S.scam.date !== today) await auditScam();
    if (S.day > 1) await morning();
    startShift(today);
  }
  rulesBoard(S.day);
  if (S.shift.done || S.shift.i >= S.shift.ids.length) return endShift();
  if (S.shift.i === 0) say(S.day === 1 ? K('Swipe → to PAY. Swipe ← to SHRED. Read the rules.') : K(pick(["Shift starts now. I'm watching. Emotionally.", 'Five claims. Zero mistakes. No pressure.', 'Rules are on the board. Read them. Twice.'])));
  showClaim();
}

window.GBV = { get state() { return S; }, nextDay: () => { dayOffset++; boot(); }, current: () => cur, decide, stampKelvin, addItem, submitScam, wipe: () => { wipe(); location.reload(); } };
(async () => { try { await document.fonts.load('10px "P"'); } catch (e) {} boot(); })();
