// HTML overlay for everything with text (HUD, action bar, toasts, find cards, Kelvin's bill).
// Text stays crisp at any phone resolution; the farm itself is pixel art on the canvas.
const css = `
#ui{position:absolute;inset:0;pointer-events:none;font-family:"Press Start 2P",monospace;color:#fff}
#hud{position:absolute;left:6px;right:6px;top:calc(6px + env(safe-area-inset-top));display:flex;gap:5px;justify-content:space-between}
.chip{background:#2b1d3aE6;border:2px solid #2b1d3a;border-radius:7px;padding:6px 7px;font-size:10px;white-space:nowrap;box-shadow:inset 0 -2px #0005}
.chip i{font-style:normal;color:#ffcf5c}
#bar{position:absolute;left:6px;right:6px;bottom:calc(8px + env(safe-area-inset-bottom));display:flex;gap:6px;pointer-events:auto}
#bar button{flex:1;font:inherit;font-size:8px;line-height:1.5;color:#2b1d3a;background:#ffcf5c;border:3px solid #2b1d3a;border-radius:9px;padding:8px 2px;box-shadow:0 3px 0 #2b1d3a;cursor:pointer}
#bar button.alt{background:#fff}
#bar button:active{transform:translateY(2px);box-shadow:0 1px 0 #2b1d3a}
#bar button:disabled{opacity:.45}
#bar b{display:block;font-size:10px}
#hint{position:absolute;left:50%;bottom:calc(66px + env(safe-area-inset-bottom));transform:translateX(-50%);width:max-content;max-width:92%;
  background:#fff;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:10px;padding:8px 10px;font-size:8px;line-height:1.6;text-align:center;transition:opacity .3s}
#hint.off{opacity:0}
#toast{position:absolute;left:50%;top:calc(112px + env(safe-area-inset-top));transform:translate(-50%,0);width:max-content;max-width:92%;background:#2b1d3aEE;border-radius:10px;padding:9px 11px;
  font-size:8px;line-height:1.7;text-align:center;opacity:0;transition:opacity .25s,transform .25s}
#toast.on{opacity:1;transform:translate(-50%,4px)}
#find{position:absolute;left:50%;top:calc(44px + env(safe-area-inset-top));transform:translate(-50%,-30px) scale(.8);opacity:0;transition:all .25s cubic-bezier(.2,1.5,.4,1);
  display:flex;gap:10px;align-items:center;background:#f6f3e8;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:10px;padding:8px 12px 8px 8px;box-shadow:0 4px 0 #0006;white-space:nowrap}
#find.on{opacity:1;transform:translate(-50%,0) scale(1)}
#find canvas{width:48px;height:48px;image-rendering:pixelated}
#find .t{font-size:8px;line-height:1.8}
#find .r{font-size:9px}
.modal{position:absolute;inset:0;background:#1f163099;display:none;align-items:center;justify-content:center;pointer-events:auto}
.modal.on{display:flex}
.card{background:#f6f3e8;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:4px;width:min(88%,340px);padding:16px 14px;font-size:8px;line-height:1.9;
  box-shadow:0 6px 0 #0006;transform:scale(.6);transition:transform .25s cubic-bezier(.2,1.6,.4,1)}
.modal.on .card{transform:scale(1)}
.card h1{font-size:12px;text-align:center;margin:0 0 4px}
.card .sub{font-size:7px;color:#6b5a7a;text-align:center;margin-bottom:10px}
.card .ln{display:flex;justify-content:space-between;gap:8px}
.card .ln b{font-weight:normal;white-space:nowrap}
.card .plus{color:#2e8a3a}.card .minus{color:#d9443a}
.card hr{border:0;border-top:2px dashed #b8b2a0;margin:8px 0}
.card .btns{display:flex;gap:8px;margin-top:12px}
.card button{flex:1;font:inherit;font-size:9px;border:3px solid #2b1d3a;border-radius:8px;background:#ffcf5c;color:#2b1d3a;padding:10px 4px;cursor:pointer;box-shadow:0 3px 0 #2b1d3a}
.card button.alt{background:#fff}
#bill .card{clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),94% 100%,88% calc(100% - 7px),82% 100%,76% calc(100% - 7px),70% 100%,64% calc(100% - 7px),58% 100%,52% calc(100% - 7px),46% 100%,40% calc(100% - 7px),34% 100%,28% calc(100% - 7px),22% 100%,16% calc(100% - 7px),10% 100%,4% calc(100% - 7px),0 100%);padding-bottom:22px}
`;

let root, toastEl, toastT, hint, findEl, findT;
const modals = {}, findQueue = [];
export let modalOpen = false;
const $ = id => root.querySelector('#' + id);

export function initUI(container, onAction) {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  root = document.createElement('div'); root.id = 'ui';
  root.innerHTML = `<div id="hud"><span class="chip" id="h_day"></span><span class="chip">● <i id="h_coins"></i></span><span class="chip">SEEDS <i id="h_seeds"></i></span><span class="chip">🧺 <i id="h_bask"></i></span></div>
    <div id="toast"></div><div id="find"><canvas width="16" height="16"></canvas><div class="t"></div></div><div id="hint" class="off"></div>
    <div id="bar"><button id="b_seeds"><b>+5 SEEDS</b><span id="b_seeds_p"></span></button><button id="b_sell" class="alt"><b>SELL</b><span id="b_sell_p"></span></button><button id="b_hire"><b>HIRE</b><span id="b_hire_p"></span></button></div>`;
  container.append(root);
  hint = $('hint'); toastEl = $('toast'); findEl = $('find');
  root.querySelector('#bar').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) onAction(b.id.slice(2)); });
  for (const id of ['bill', 'sheet']) {
    const m = document.createElement('div'); m.className = 'modal'; m.id = id; m.innerHTML = '<div class="card"></div>';
    root.append(m); modals[id] = m;
  }
}

export function setHud({ day, night, coins, seeds, basket, seedCost, sellValue, hireCost, canHire }) {
  $('h_day').innerHTML = `${night ? '🌙' : '☀️'} DAY <i>${day}</i>`;
  $('h_coins').textContent = coins; $('h_seeds').textContent = seeds; $('h_bask').textContent = basket;
  $('b_seeds_p').textContent = '● ' + seedCost; $('b_seeds').disabled = coins < seedCost;
  $('b_sell_p').textContent = basket ? '+● ' + sellValue : 'EMPTY'; $('b_sell').disabled = !basket;
  $('b_hire_p').textContent = canHire ? '● ' + hireCost : 'FULL'; $('b_hire').disabled = !canHire || coins < hireCost;
}

export function toast(html, ms = 2200) {
  toastEl.innerHTML = html; toastEl.classList.add('on'); clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), ms);
}

export function setHint(html) { if (!html) { hint.classList.add('off'); return; } hint.innerHTML = html; hint.classList.remove('off'); }

// A small card that slides in when a monster is found; it doesn't block play and queues if several arrive at once.
export function find(drawIcon, html, big) {
  findQueue.push({ drawIcon, html, big });
  if (findQueue.length === 1) showFind();
}
function showFind() {
  const f = findQueue[0]; if (!f) return;
  const c = findEl.querySelector('canvas'), x = c.getContext('2d'); x.clearRect(0, 0, 16, 16); f.drawIcon(x, c);
  findEl.querySelector('.t').innerHTML = f.html; findEl.classList.add('on');
  clearTimeout(findT); findT = setTimeout(() => { findEl.classList.remove('on'); setTimeout(() => { findQueue.shift(); showFind(); }, 260); }, f.big ? 2200 : 1300);
}

export function open(id, html, buttons) {
  const m = modals[id], card = m.querySelector('.card');
  card.innerHTML = html + (buttons ? `<div class="btns">${buttons.map(b => `<button data-id="${b.id}" class="${b.alt ? 'alt' : ''}">${b.label}</button>`).join('')}</div>` : '');
  m.classList.add('on'); modalOpen = true;
  return new Promise(res => {
    const done = v => { m.classList.remove('on'); m.onclick = null; modalOpen = false; res(v); };
    m.onclick = e => { const b = e.target.closest('button'); if (b) done(b.dataset.id); else if (!e.target.closest('.card')) done('close'); };
  });
}
