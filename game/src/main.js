// CLAIM REJECTED (Game By Vote v0.5).
// You're the new finance hire. Each day: 5 expense claims. Swipe right to APPROVE, left to REJECT,
// judged only by the rules on the board. Kelvin from Accounting sets a new rule every day and sneaks in
// his own dodgy claims. He remembers what you did yesterday. Votes add rules, hazards and colleagues.
import './style.css';
import CFG from './data/config.json';
import DATA from './data/claims.json';
import { sfx, unlock } from './sfx.js';
import { load, save, wipe } from './save.js';

const q = new URLSearchParams(location.search);
const DEBUG = q.has('debug');
if (q.has('reset')) wipe();
let S = load();
const RULES = DATA.rules, CLAIMS = DATA.claims, KL = DATA.kelvin, COL = DATA.colleagues || {};
const BY_ID = Object.fromEntries(CLAIMS.map(c => [c.id, c]));
const RULE = Object.fromEntries(RULES.map(r => [r.id, r]));
const asset = p => new URL(p, document.baseURI).href;
document.documentElement.style.setProperty('--kel', `url(${asset('sprites/kelvin.png')})`);

// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const pick = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];
const money = n => '$' + Number(n).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
function rng(seedStr) {                                 // mulberry32 seeded by a string
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// the shift date in Singapore time (a new shift at midnight SGT); ?debug=1 can jump days
let dayOffset = 0;
const sgDate = (plusMs = 0) => new Date(Date.now() + plusMs + 8 * 3600e3 + dayOffset * 86400e3).toISOString().slice(0, 10);
const msToMidnight = () => { const t = Date.now() + 8 * 3600e3 + dayOffset * 86400e3; return 86400e3 - (t % 86400e3); };

function activeRules(day) {
  const n = Math.min(RULES.length, CFG.startRules + day - 1);
  if (CFG.startRules + day - 1 <= RULES.length) return RULES.slice(Math.max(0, n - CFG.maxRules), n);
  const r = rng('rules|' + day), pool = [...RULES];          // after every rule is out: a seeded mix of 5
  return Array.from({ length: CFG.maxRules }, () => pool.splice(Math.floor(r() * pool.length), 1)[0]);
}
const newestRule = day => (CFG.startRules + day - 1 <= RULES.length ? activeRules(day).at(-1) : null);

// pick today's claims: same for everyone on the same date and career day
function dealShift(date, day) {
  const r = rng(date + '|' + day), act = new Set(activeRules(day).map(x => x.id)), newest = newestRule(day);
  const ok = c => c.breaks == null || act.has(c.breaks);
  const unseen = c => !S.seenClaims[c.id];
  const take = (list) => { const pool = list.filter(unseen).length ? list.filter(unseen) : list; return pool.length ? pool[Math.floor(r() * pool.length)] : null; };
  const chosen = [];
  const add = c => { if (c && !chosen.includes(c)) chosen.push(c); };
  const notK = CLAIMS.filter(c => c.from !== 'kelvin' && ok(c));
  add(take(CLAIMS.filter(c => c.from === 'kelvin' && c.breaks && act.has(c.breaks))));           // Kelvin's dodgy claim
  if (newest) add(take(notK.filter(c => c.breaks === newest.id)));                                    // uses the new rule
  add(take(notK.filter(c => c.breaks && !chosen.includes(c))));                                       // one more break
  while (chosen.length < CFG.claimsPerDay) { const c = take(notK.filter(c => c.breaks == null && !chosen.includes(c))) || take(notK.filter(c => !chosen.includes(c))); if (!c) break; add(c); }
  for (let i = chosen.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [chosen[i], chosen[j]] = [chosen[j], chosen[i]]; }
  if (day === 1) { const j = chosen.findIndex(c => c.breaks == null && c.from !== 'kelvin'); if (j > 0) chosen.unshift(chosen.splice(j, 1)[0]); }   // first claim ever: an honest one
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
  <div id="btns"><button id="b_rej">✖ REJECT</button><button id="b_app">APPROVE ✔</button></div>
  <div id="toast"></div>`;
const stage = $('#stage');

function meters() {
  const m = (id, label, v, col) => `<div class="m" id="${id}">${label}<div class="bar"><b style="width:${Math.max(0, v)}%;background:${col}"></b></div></div>`;
  $('#meters').innerHTML = m('m_b', '💰 BUDGET', S.budget, '#ffcf5c') + m('m_m', '🙂 MORALE', S.morale, '#7fd88a') + m('m_k', '🤨 KELVIN GRUDGE', Math.min(100, S.grudge * 12), '#ff7a6a');
}
function hitMeter(id) { const el = $('#' + id); if (!el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
function rulesBoard(day) {
  const nw = newestRule(day);
  $('#rules').innerHTML = `<div class="t">📌 RULES (set by Kelvin)</div>` + activeRules(day).map(r =>
    `<div class="r ${nw && r.id === nw.id ? 'new' : ''}"><span class="ic">${r.icon}</span><span>${esc(r.text)}</span>${nw && r.id === nw.id && day > 1 ? '<span class="badge">NEW</span>' : ''}</div>`).join('');
}
function say(html, mood) {
  const b = $('#bubble'); b.innerHTML = html; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  const k = $('#kelvin'); if (mood) { k.className = ''; void k.offsetWidth; k.className = mood; setTimeout(() => (k.className = 'idle'), 800); }
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1800); }
function fly(text, x, y) { const f = document.createElement('div'); f.className = 'fly'; f.textContent = text; f.style.left = x + 'px'; f.style.top = y + 'px'; app.append(f); setTimeout(() => f.remove(), 1200); }
function avatar(from, sc = 3) {
  const c = CFG.cast[from] || CFG.cast.gloop;
  if (from === 'kelvin') return `<span class="s" style="width:${16 * sc}px;height:${16 * sc}px;background:var(--kel) 0 0/${16 * sc}px ${16 * sc}px"></span>`;
  return `<span class="s" style="width:${16 * sc}px;height:${16 * sc}px;background-image:url(${asset('sprites/dungeon.png')});background-size:${192 * sc}px ${176 * sc}px;background-position:-${(c.frame % 12) * 16 * sc}px -${Math.floor(c.frame / 12) * 16 * sc}px"></span>`;
}
function cardHTML(c, no, overtime) {
  const who = CFG.cast[c.from] || { name: c.from, role: '' };
  const row = (k, label, v) => v == null || v === '' ? '' : `<div class="row" data-f="${k}"><span>${label}</span><b>${esc(v)}</b></div>`;
  return `${overtime ? '<div class="ot">UNPAID OVERTIME</div>' : ''}
    <div class="hd"><span>EXPENSE CLAIM #${String(no).padStart(4, '0')}</span><span>${c.from === 'kelvin' ? '⚠️' : ''}</span></div>
    <div class="who" data-f="from">${avatar(c.from)}<div><b>${esc(who.name)}</b><br><small>${esc(who.role)}</small></div></div>
    <div class="item" data-f="pic"><span class="pic">${c.pic}</span><span>${esc(c.item)}</span></div>
    ${row('amount', 'Amount', money(c.amount))}${row('time', 'Time', c.time)}${row('date', 'Date', c.date)}${row('note', 'Note', c.note && '“' + c.note + '”')}
    <div class="lab ap">APPROVE</div><div class="lab rj">REJECT</div>`;
}

// ---------- the shift ----------
let cur = null, busy = false, overtime = false, otCount = 0;

function showClaim() {
  stage.innerHTML = '';
  const sh = S.shift, ids = overtime ? null : sh.ids;
  const c = overtime ? otClaim() : BY_ID[ids[sh.i]];
  if (!c) return endShift();
  cur = c;
  const n = overtime ? otCount + 1 : sh.i + 1;
  $('#c_n').innerHTML = overtime ? `OVERTIME <i>${otCount}</i>` : `CLAIM <i>${n}</i>/${ids.length}`;
  if (!overtime && sh.i + 1 < ids.length) { const back = document.createElement('div'); back.className = 'card back'; back.innerHTML = cardHTML(BY_ID[ids[sh.i + 1]], 400 + S.day * 10 + n + 1); stage.append(back); }
  const el = document.createElement('div'); el.className = 'card' + (c.from === 'kelvin' ? ' kelvin' : '');
  el.innerHTML = cardHTML(c, 400 + S.day * 10 + n, overtime);
  stage.append(el); drag(el);
  el.animate([{ transform: 'translateY(-30px) rotate(-4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
  if (c.from === 'kelvin') say(pick(['<b>Kelvin:</b> This one is… routine. Approve it.', '<b>Kelvin:</b> Don\'t look too closely. Just stamp.', '<b>Kelvin:</b> Mine. Obviously legitimate.']), 'smug');
  sfx.swish(); $('#btns').classList.remove('off'); busy = false;
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

function decide(approve) {
  if (busy || !cur) return; busy = true; $('#btns').classList.add('off');
  const c = cur, valid = c.breaks == null, right = approve === valid, kelvin = c.from === 'kelvin';
  const el = stage.querySelector('.card:not(.back)');
  const st = document.createElement('div'); st.className = 'stampd'; st.textContent = approve ? 'APPROVED' : 'REJECTED';
  st.style.color = approve ? '#2e8a3a' : '#d9443a'; el.append(st); $('.lab.ap', el).style.opacity = $('.lab.rj', el).style.opacity = 0;
  sfx.stamp(); navigator.vibrate?.(30);
  let lines = [];
  if (!overtime) {
    S.seenClaims[c.id] = 1;
    const sh = S.shift; sh.results.push({ ok: right, kelvin });
    if (right) { S.stats.right++; S.morale = Math.min(100, S.morale + CFG.morale.correct); } else S.stats.wrong++;
    if (kelvin && !valid && !approve) { sh.caught++; S.grudge++; S.stats.caught++; }
    if (kelvin && !valid && approve) { sh.fooled++; S.stats.fooled++; S.budget -= CFG.budget.kelvinFooled; hitMeter('m_b'); }
    else if (!right && approve) { S.budget -= CFG.budget.wrongApprove; hitMeter('m_b'); }
    else if (!right && !approve) { S.morale -= CFG.morale.wrongReject; hitMeter('m_m'); }
    sh.i++; save(S); meters();
  } else if (right) otCount++; else otCount = 0;
  // Kelvin reacts
  if (kelvin && !valid) lines = approve ? KL.fooled : KL.caught;
  else lines = right ? KL.correct : KL.wrong;
  const mood = kelvin && !valid ? (approve ? 'smug' : 'shake') : (right ? null : 'smug');
  say('<b>Kelvin:</b> ' + esc(pick(lines)), mood);
  if (right) sfx.ding(); else sfx.buzz();
  if (!overtime && kelvin && !valid && approve) { const r = $('#m_b').getBoundingClientRect(); fly('-' + CFG.budget.kelvinFooled + '%', r.left + 20, r.top + 10); }
  setTimeout(() => {
    el.style.transition = 'transform .35s ease-in, opacity .35s'; el.style.transform = `translateX(${approve ? 130 : -130}%) rotate(${approve ? 25 : -25}deg)`; el.style.opacity = 0;
    setTimeout(async () => {
      if (!right) await explain(c, approve);
      if (!overtime && (S.budget <= 0 || S.morale <= 0)) await fired();
      overtime || S.shift.i < S.shift.ids.length ? showClaim() : endShift();
    }, 330);
  }, 420);
}

// the "why" after a wrong stamp: which field broke which rule (or why it was fine)
function explain(c, approved) {
  const r = c.breaks ? RULE[c.breaks] : null, who = CFG.cast[c.from]?.name || c.from;
  const colLine = !approved && COL[c.from] ? `<div class="say">${esc(who)}: “${esc(pick(COL[c.from]))}”</div>` : '';
  return sheet(`<div class="sub">${approved ? 'YOU APPROVED IT' : 'YOU REJECTED IT'}</div><h1 class="bad">✖ WRONG</h1>
    <div style="margin:8px 0">${c.pic} ${esc(c.item)} · ${money(c.amount)}</div>
    ${r ? `<div class="newrule">${r.icon} ${esc(r.text)}</div>` : '<div class="newrule">✅ It broke no rule. Legit claim.</div>'}
    <div>${esc(c.why || '')}</div>${colLine}
    ${!approved ? `<div class="small">Morale -${CFG.morale.wrongReject}</div>` : `<div class="small">Budget -${c.from === 'kelvin' ? CFG.budget.kelvinFooled : CFG.budget.wrongApprove}</div>`}`,
  [{ id: 'ok', label: 'Noted with thanks 🙏' }]);
}

function sheet(html, buttons, cls = '') {
  return new Promise(res => {
    const s = document.createElement('div'); s.className = 'sheet';
    s.innerHTML = `<div class="paper ${cls}">${html}${buttons ? `<div class="btns">${buttons.map(b => `<button data-id="${b.id}" class="${b.alt ? 'alt' : ''}">${b.label}</button>`).join('')}</div>` : ''}</div>`;
    app.append(s);
    s.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; unlock(); sfx.tap(); if (b.dataset.keep) return; s.remove(); res(b.dataset.id); });
  });
}

async function fired() {
  S.stats.fired++; sfx.buzz();
  await sheet(`<div class="kv"></div><h1 class="bad">YOU'RE FIRED</h1><div class="say"><b>Kelvin:</b> “${esc(pick(KL.fired))}”</div>
    <div class="small">${S.budget <= 0 ? 'The budget hit zero.' : 'Office morale hit zero.'}<br>HR (Gloop) has rehired you. Same desk. Lower pay.</div>`, [{ id: 'ok', label: 'Report back to desk' }]);
  S.budget = Math.max(S.budget, 50); S.morale = Math.max(S.morale, 50); save(S); meters();
}

// ---------- day flow ----------
function startShift(date) {
  S.shift = { date, day: S.day, ids: dealShift(date, S.day), i: 0, results: [], caught: 0, fooled: 0 };
  save(S);
}

async function morning() {
  const y = S.yesterday || { caught: 0, wrong: 0, right: 0 }, nw = newestRule(S.day);
  const intro = nw ? (KL.rule_intro?.[nw.id] || 'New rule. Effective immediately.') : 'No new rule today. Enjoy the uncertainty.';
  const retired = S.day > 1 && CFG.startRules + S.day - 1 > CFG.maxRules && CFG.startRules + S.day - 1 <= RULES.length ? RULES[CFG.startRules + S.day - 1 - CFG.maxRules - 1] : null;
  await sheet(`<div class="sub">INTERNAL MEMO · DAY ${S.day}</div><div class="kv"></div>
    <div class="say"><b>Kelvin:</b> “${esc(fill(pick(KL.morning), { caught: y.caught, wrong: y.wrong, right: y.right, streak: S.streak }))}”</div>
    ${nw ? `<div class="newrule">NEW RULE<br>${nw.icon} ${esc(nw.text)}<br><span style="font-size:8px">“${esc(intro)}”</span></div>` : ''}
    ${retired ? `<div class="small">Retired: ${retired.icon} ${esc(retired.text)}</div>` : ''}`, [{ id: 'go', label: 'Start shift ☕' }]);
}

async function intro() {
  await sheet(`<div class="kv"></div><h1>KELVIN</h1><div class="sub">SENIOR ACCOUNTING. SENIOR.</div>
    <div class="say">“You're the new finance hire. Colleagues submit claims. You <span class="good">APPROVE</span> the ones that follow the rules and <span class="bad">REJECT</span> the rest.<br><br>I make the rules. I also… submit claims. Don't worry about those.”</div>
    <div class="small">Swipe right ✔ approve · swipe left ✖ reject<br>5 claims a day. New rule every day.</div>`, [{ id: 'ok', label: 'OK boss' }]);
  S.intro = true; save(S);
}

async function endShift() {
  stage.innerHTML = ''; cur = null; $('#btns').classList.add('off');
  const sh = S.shift, right = sh.results.filter(r => r.ok).length, wrong = sh.results.length - right;
  if (!sh.done) {
    sh.done = true; S.stats.shifts++;
    S.yesterday = { caught: sh.caught, wrong, right };
    S.streak = wrong === 0 ? S.streak + 1 : 0;
    S.budget = Math.min(100, S.budget + CFG.budget.dailyTopUp); save(S); meters();
  }
  say('<b>Kelvin:</b> ' + esc(pick(KL.report)));
  report();
}

function shareText() {
  const sh = S.shift, grid = sh.results.map(r => (r.kelvin ? (r.ok ? '🧾' : '💸') : r.ok ? '🟩' : '🟥')).join('');
  const k = sh.results.filter(r => r.kelvin).length;
  return `CLAIM REJECTED · Day ${sh.day}\n${grid}\n${k ? (sh.caught ? 'Caught Kelvin 🧾' : 'Kelvin fooled me 💸') : ''}${S.streak > 1 ? ` · 🔥${S.streak}` : ''}\n${CFG.share.url}`;
}

async function report() {
  const sh = S.shift, right = sh.results.filter(r => r.ok).length;
  const grid = sh.results.map(r => (r.kelvin ? (r.ok ? '🧾' : '💸') : r.ok ? '🟩' : '🟥')).join('');
  const tick = () => { const ms = msToMidnight(), h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1000); return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`; };
  const btns = [{ id: 'share', label: 'SHARE MY SHIFT 🧾' }, { id: 'ot', label: 'Do unpaid overtime 😩', alt: true }];
  if (DEBUG) btns.push({ id: 'next', label: '[debug] next day', alt: true });
  const p = sheet(`<div class="sub">END OF SHIFT · DAY ${sh.day}</div><h1>${right}/${sh.results.length} CORRECT</h1>
    <div class="grid">${grid}</div>
    <div class="stats"><span><b>${sh.caught}</b>caught Kelvin</span><span><b>${S.budget}%</b>budget</span><span><b>${S.morale}%</b>morale</span><span><b>${S.streak}</b>🔥 streak</span></div>
    <div class="say"><b>Kelvin:</b> “${esc(pick(KL.report))}”</div>
    <div class="small">Next shift in <span id="cd">${tick()}</span></div>
    <div class="small">🗳️ This week's vote: Kelvin spills <b>${CFG.vote.options.join(' / ')}</b> on the receipts. Vote in the TikTok comments.</div>`, btns);
  const cd = setInterval(() => { const el = document.getElementById('cd'); if (el) el.textContent = tick(); if (msToMidnight() < 1500) { clearInterval(cd); location.reload(); } }, 1000);
  const act = await p; clearInterval(cd);
  if (act === 'share') {
    const text = shareText();
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Copied! Paste it anywhere 🧾'); } } catch (e) {}
    return report();
  }
  if (act === 'next') { dayOffset++; return boot(); }
  overtime = true; otCount = 0; S.stats.overtime++; save(S);
  say('<b>Kelvin:</b> ' + esc(pick(KL.overtime)), 'smug');
  $('#c_day').innerHTML = `DAY <i>${S.day}</i> · OT`;
  showClaim();
}
function otClaim() {
  const act = new Set(activeRules(S.day).map(r => r.id));
  return pick(CLAIMS.filter(c => c.breaks == null || act.has(c.breaks)));
}

async function boot() {
  overtime = false;
  const today = sgDate();
  if (S.shift && S.shift.date !== today) { if (S.shift.done || S.shift.i > 0) S.day++; S.shift = null; }   // a new day: next career day
  meters(); rulesBoard(S.day);
  $('#c_day').innerHTML = `DAY <i>${S.day}</i>`;
  say('<b>Kelvin:</b> Desk. Now. The claims won\'t reject themselves.');
  if (!S.intro) await intro();
  if (!S.shift) { if (S.day > 1) await morning(); startShift(today); }
  rulesBoard(S.day);
  if (S.shift.done || S.shift.i >= S.shift.ids.length) return endShift();
  if (S.shift.i === 0) say(S.day === 1 ? '<b>Kelvin:</b> Swipe right to approve. Left to reject. Read the rules.' : '<b>Kelvin:</b> ' + pick(['Shift starts now. I\'m watching. Emotionally.', 'Five claims. Zero mistakes. No pressure.', 'Coffee is not a claimable expense. Mostly.', 'Rules are on the board. Read them. Twice.']));
  showClaim();
}

$('#b_app').onclick = () => { unlock(); decide(true); };
$('#b_rej').onclick = () => { unlock(); decide(false); };
window.GBV = { get state() { return S; }, nextDay: () => { dayOffset++; boot(); }, current: () => cur, decide, wipe: () => { wipe(); location.reload(); } };
(async () => { try { await document.fonts.load('10px "P"'); } catch (e) {} boot(); })();
