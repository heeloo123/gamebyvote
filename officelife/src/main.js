// OFFICE LIFE (Game By Vote mini-game, prototype). A BitLife-style career at a small Singapore company.
// Tap NEXT DAY; absurd events pop up with 2–3 choices; outcomes change your stats and write your life log.
// Kelvin from Accounting is everywhere. Each career ends somehow (fired, burnout, CEO, becoming Kelvin…).
// ?bot=1 plays by itself (for Reels).
import './style.css';
import LIFE from './data/life.json';
import { sfx, unlock } from './sfx.js';

const q = new URLSearchParams(location.search), BOT = q.has('bot');
const KEY = 'gamebyvote.officelife';
const asset = p => new URL(p, document.baseURI).href;
document.documentElement.style.setProperty('--kel', `url(${asset('sprites/kelvin.png')})`);
if (BOT) document.body.style.zoom = Math.max(1, innerWidth / 390);

const CAST = { kelvin: -1, gloop: 108, cfo: 109, bat: 120, ghost: 121, auntie: 99, intern: 85, boss: 84 };
const FACES = [85, 86, 87, 88, 96, 97, 98, 99, 100, 111, 112];
const NAMES = ['Wei Ling', 'Marcus', 'Siti', 'Arjun', 'Jia Hui', 'Darren', 'Nurul', 'Kumar', 'Bryan', 'Mei Xin', 'Hafiz', 'Shermaine'];
const RANKS = [[0, 'Intern'], [20, 'Executive'], [40, 'Senior Executive'], [60, 'Manager'], [80, 'Director'], [100, 'CEO']];
const STATS = [['money', '💰', 'MONEY', '#ffcf5c'], ['happy', '😊', 'HAPPY', '#7fd88a'], ['sanity', '🧠', 'SANITY', '#8ad4ff'], ['grudge', '🤨', 'KELVIN', '#ff7a6a'], ['career', '📈', 'CAREER', '#c9a0ff']];
const ICON = Object.fromEntries(STATS.map(s => [s[0], s[1]]));

let seed = BOT ? 11 : (Date.now() % 1e6) + 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const rank = c => RANKS.filter(r => c >= r[0]).at(-1)[1];

function sprite(frame, sc = 3) {
  if (frame === -1) return `<span class="s" style="width:${16 * sc}px;height:${16 * sc}px;background:var(--kel) 0 0/${16 * sc}px ${16 * sc}px"></span>`;
  return `<span class="s" style="width:${16 * sc}px;height:${16 * sc}px;background-image:url(${asset('sprites/dungeon.png')});background-size:${192 * sc}px ${176 * sc}px;background-position:-${(frame % 12) * 16 * sc}px -${Math.floor(frame / 12) * 16 * sc}px"></span>`;
}

// ---------- save ----------
let SAVE = { lives: 0, endings: {} };
try { if (!BOT) SAVE = { ...SAVE, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
const store = () => { if (!BOT) try { localStorage.setItem(KEY, JSON.stringify(SAVE)); } catch (e) {} };

// ---------- a life ----------
let L;
function newLife() {
  L = { name: pick(NAMES), face: pick(FACES), day: 0, money: 800, happy: 60, sanity: 70, grudge: 10, career: 5, flags: {}, used: {}, log: [], peak: 'Intern', over: false };
  SAVE.lives++; store();
  render(); $('#log').innerHTML = '';
  addLog('👶', 'First day at Kelvin & Co. Pte Ltd.', {}, 'big');
  kSay('Welcome. Here is your invoice.');
}

const app = document.getElementById('app');
app.innerHTML = `<div id="who"><span id="face"></span><div><div class="nm" id="nm"></div><div class="sub"><span id="day"></span> · <span class="rank" id="rank"></span></div></div>
  <div id="kel"><div class="k" id="k"></div><div id="kb"></div></div></div>
  <div id="stats"></div><div id="log"></div><button id="next">▶ NEXT DAY</button>`;

function render() {
  $('#face').innerHTML = sprite(L.face, 3);
  $('#nm').textContent = L.name;
  $('#day').textContent = 'DAY ' + L.day;
  $('#rank').textContent = rank(L.career);
  $('#stats').innerHTML = STATS.map(([k, ic, lab, col]) => {
    const v = L[k], w = k === 'money' ? Math.max(0, Math.min(100, v / 30)) : Math.max(0, Math.min(100, v));
    return `<div class="st" id="s_${k}"><span class="ic em">${ic}</span>${lab}<div class="bar"><b style="width:${w}%;background:${col}"></b></div><span class="v">${k === 'money' ? '$' + Math.round(v) : Math.round(v)}</span></div>`;
  }).join('');
}
function chips(fx) {
  return Object.entries(fx || {}).filter(([, v]) => v).map(([k, v]) => `<span class="chip ${(k === 'grudge' ? -v : v) > 0 ? 'up' : 'dn'}"><span class="em">${ICON[k] || ''}</span> ${v > 0 ? '+' : ''}${k === 'money' ? '$' + v : v}</span>`).join('');
}
function addLog(emoji, text, fx, cls = '') {
  const el = document.createElement('div'); el.className = 'ln new ' + cls;
  el.innerHTML = `<span class="em" style="font-size:18px">${emoji}</span><div class="t">${esc(text)}<div class="fx">${chips(fx)}</div></div><span class="d">D${L.day}</span>`;
  $('#log').prepend(el);
  while ($('#log').children.length > 12) $('#log').lastChild.remove();
}
function applyFx(fx) {
  for (const [k, v] of Object.entries(fx || {})) {
    if (!(k in L) || !v) continue;
    L[k] = k === 'money' ? L[k] + v : Math.max(0, Math.min(100, L[k] + v));
    const el = $('#s_' + k); if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
    const box = el?.getBoundingClientRect();
    if (box) { const f = document.createElement('div'); f.className = 'fly'; f.innerHTML = `${v > 0 ? '+' : ''}${k === 'money' ? '$' + v : v}`; f.style.left = box.left + 'px'; f.style.top = box.top + 'px'; f.style.color = (k === 'grudge' ? -v : v) > 0 ? '#7fd88a' : '#ff7a6a'; document.body.append(f); setTimeout(() => f.remove(), 1000); }
  }
  const r = rank(L.career); if (RANKS.findIndex(x => x[1] === r) > RANKS.findIndex(x => x[1] === L.peak)) { L.peak = r; setTimeout(() => { addLog('🎉', `Promoted to ${r}!`, {}, 'big'); sfx.morning(); }, 300); }
  render();
}
function kSay(t, shake) {
  const b = $('#kb'); b.textContent = t; b.classList.add('on'); clearTimeout(kSay.t); kSay.t = setTimeout(() => b.classList.remove('on'), 2600);
  if (shake) { const k = $('#k'); k.classList.remove('shake'); void k.offsetWidth; k.classList.add('shake'); }
}

// ---------- events ----------
function eligible() {
  return LIFE.events.filter(e => (e.once === false || !L.used[e.id]) && (e.minDay == null || L.day >= e.minDay) && (e.maxDay == null || L.day <= e.maxDay)
    && (e.requires || []).every(f => L.flags[f]) && !(e.forbids || []).some(f => L.flags[f]));
}
function weighted(list, w) { const tot = list.reduce((a, x) => a + w(x), 0); let r = rnd() * tot; for (const x of list) if ((r -= w(x)) < 0) return x; return list.at(-1); }

function sheet(html) {
  const s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = `<div class="card">${html}</div>`; app.append(s); return s;
}
async function eventCard(e) {
  L.used[e.id] = 1;
  const who = e.who && CAST[e.who] != null ? `<div class="who">${sprite(CAST[e.who], 4)}</div>` : '';
  const s = sheet(`<div class="day">DAY ${L.day}</div><div class="big em">${e.emoji}</div>${who}<div class="txt">${esc(e.text)}</div>
    ${e.choices.map((c, i) => `<button data-i="${i}">${esc(c.label)}</button>`).join('')}`);
  sfx.beepClick();
  const i = await new Promise(res => {
    s.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) { unlock(); sfx.tap(); res(+b.dataset.i); } });
    if (BOT) setTimeout(() => { const btn = s.querySelectorAll('button')[botChoice(e)]; btn.style.transform = 'scale(1.06)'; setTimeout(() => btn.click(), 450); }, 1100);
  });
  const o = weighted(e.choices[i].outcomes, x => x.p || 1);
  s.querySelector('.card').innerHTML = `<div class="big em">${e.emoji}</div><div class="res">${esc(o.text)}</div><div class="fx">${chips(o.fx)}</div>`;
  const bad = Object.entries(o.fx || {}).reduce((a, [k, v]) => a + (k === 'grudge' ? -v : k === 'money' ? v / 50 : v), 0) < 0;
  bad ? sfx.buzz() : sfx.ding();
  if (e.who === 'kelvin') kSay(pick(LIFE.kelvin_lines || ['Noted.']), bad);
  await wait(BOT ? 1300 : 1500);
  s.remove();
  if (o.flag) L.flags[o.flag] = 1; if (o.unflag) delete L.flags[o.unflag];
  addLog(e.emoji, o.text, o.fx, e.who === 'kelvin' ? 'big' : '');
  applyFx(o.fx);
  return o.end;
}
function botChoice(e) { return Math.floor(rnd() * e.choices.length); }

// ---------- a day ----------
let busy = false;
async function nextDay() {
  if (busy || L.over) return; busy = true; unlock();
  L.day++; render(); sfx.swish();
  let end = null;
  const pool = eligible();
  if (pool.length && (rnd() < 0.72 || L.day === 1)) end = await eventCard(weighted(pool, e => (e.weight || 2) * (e.requires ? 4 : 1)));
  else { const qd = pick(LIFE.quiet); addLog('📅', qd.text, qd.fx, 'quiet'); applyFx(qd.fx); if (rnd() < .25) kSay(pick(LIFE.kelvin_lines || ['Noted.'])); }
  if (!end) end = L.sanity <= 0 ? 'burnout' : L.career >= 100 ? 'ceo' : L.grudge >= 100 ? 'fired' : L.money < -2000 ? 'broke' : null;
  if (end) await ending(end);
  busy = false;
}

async function ending(id) {
  L.over = true; await wait(500);
  const E = LIFE.endings[id] || LIFE.endings.fired || { emoji: '📦', title: 'Career over', text: 'You packed your desk into a box.' };
  const first = !SAVE.endings[id]; SAVE.endings[id] = 1; store();
  const found = Object.keys(SAVE.endings).length, total = Object.keys(LIFE.endings).length;
  sfx.stamp();
  const s = sheet(`<div class="big em">${E.emoji}</div><div class="day">${esc(L.name).toUpperCase()} · DAY ${L.day}</div><h1>${esc(E.title)}</h1><div class="txt">${esc(E.text)}</div>
    <div class="sum">📈 Peak: ${esc(L.peak)}<br>💰 Money: $${Math.round(L.money)}<br>🤨 Kelvin's grudge: ${Math.round(L.grudge)}<br>🏆 Endings found: ${found}/${total}${first ? ' (NEW!)' : ''}</div>
    <button id="again">👶 NEW LIFE</button><button id="share">📤 SHARE</button>`);
  s.querySelector('.card').classList.add('end');
  s.querySelector('#again').onclick = () => { unlock(); s.remove(); newLife(); };
  s.querySelector('#share').onclick = async () => {
    const text = `My office life: ${E.emoji} ${E.title} on day ${L.day}.\nPeak: ${L.peak} · $${Math.round(L.money)}\nheeloo123.github.io/gamebyvote`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); s.querySelector('#share').textContent = '✔ COPIED'; } } catch (e) {}
  };
}

$('#next').onclick = nextDay;
window.GBV = { get life() { return L; }, nextDay };
(async () => {
  try { await document.fonts.load('10px P'); } catch (e) {}
  newLife();
  if (BOT) { await wait(800); for (let i = 0; i < 60 && !L.over; i++) { $('#next').style.transform = 'translateY(3px)'; await wait(120); $('#next').style.transform = ''; await nextDay(); await wait(500); } }
})();
