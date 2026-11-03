// HTML overlay for everything with text (HUD, toasts, Kelvin's bill, harvest card, shop, crate).
// Text stays crisp at any phone resolution; the farm itself is pixel art on the canvas.
const css = `
#ui{position:absolute;inset:0;pointer-events:none;font-family:"Press Start 2P",monospace;color:#fff}
#hud{position:absolute;left:6px;right:6px;top:calc(6px + env(safe-area-inset-top));display:flex;gap:5px;justify-content:space-between}
#hud span{background:#2b1d3aE0;border:2px solid #2b1d3a;border-radius:7px;padding:6px 7px;font-size:10px;white-space:nowrap;box-shadow:inset 0 -2px #0005}
#hud i{font-style:normal;color:#ffcf5c}
#hint{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);width:max-content;max-width:92%;
  background:#fff;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:10px;padding:9px 11px;font-size:9px;line-height:1.6;text-align:center;transition:opacity .3s}
#hint.off{opacity:0}
#toast{position:absolute;left:50%;top:22%;transform:translate(-50%,0);width:max-content;max-width:90%;background:#2b1d3aEE;border-radius:10px;padding:10px 12px;
  font-size:9px;line-height:1.7;text-align:center;opacity:0;transition:opacity .25s,transform .25s}
#toast.on{opacity:1;transform:translate(-50%,-6px)}
.modal{position:absolute;inset:0;background:#1f163099;display:none;align-items:center;justify-content:center;pointer-events:auto}
.modal.on{display:flex}
.card{background:#f6f3e8;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:4px;width:min(86%,340px);padding:16px 14px;font-size:9px;line-height:1.9;
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
.card button:active{transform:translateY(2px);box-shadow:0 1px 0 #2b1d3a}
.card button:disabled{opacity:.45}
#bill .card{clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),94% 100%,88% calc(100% - 7px),82% 100%,76% calc(100% - 7px),70% 100%,64% calc(100% - 7px),58% 100%,52% calc(100% - 7px),46% 100%,40% calc(100% - 7px),34% 100%,28% calc(100% - 7px),22% 100%,16% calc(100% - 7px),10% 100%,4% calc(100% - 7px),0 100%);padding-bottom:22px}
#reveal .card{text-align:center}
#reveal canvas{width:112px;height:112px;image-rendering:pixelated;margin:4px auto 8px;display:block}
#reveal .rar{font-size:11px;margin-bottom:4px}
#reveal .val{font-size:14px;margin-top:6px}
`;

let root, hud, hint, toastEl, toastT;
const modals = {};
export let modalOpen = false;

export function initUI(container) {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  root = document.createElement('div'); root.id = 'ui';
  root.innerHTML = `<div id="hud"><span id="h_day"></span><span>● <i id="h_coins"></i></span><span>SEEDS <i id="h_seeds"></i></span><span>🧺 <i id="h_bask"></i></span></div>
    <div id="toast"></div><div id="hint" class="off"></div>`;
  container.append(root);
  hud = id => root.querySelector('#' + id); hint = root.querySelector('#hint'); toastEl = root.querySelector('#toast');
  for (const id of ['bill', 'reveal', 'shop', 'crate']) {
    const m = document.createElement('div'); m.className = 'modal'; m.id = id; m.innerHTML = '<div class="card"></div>';
    root.append(m); modals[id] = m;
  }
}

export function setHud({ day, night, coins, seeds, basket }) {
  hud('h_day').innerHTML = `${night ? '🌙' : '☀️'} DAY <i>${day}</i>`;
  hud('h_coins').textContent = coins; hud('h_seeds').textContent = seeds; hud('h_bask').textContent = basket;
}

export function toast(html, ms = 2400) {
  toastEl.innerHTML = html; toastEl.classList.add('on'); clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), ms);
}

export function setHint(html) { if (!html) { hint.classList.add('off'); return; } hint.innerHTML = html; hint.classList.remove('off'); }

// Opens a modal; resolves with the id of the button pressed (or 'close' when tapping outside the card).
export function open(id, html, buttons) {
  const m = modals[id], card = m.querySelector('.card');
  card.innerHTML = html + (buttons ? `<div class="btns">${buttons.map(b => `<button data-id="${b.id}" class="${b.alt ? 'alt' : ''}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('')}</div>` : '');
  m.classList.add('on'); modalOpen = true;
  return new Promise(res => {
    const done = v => { m.classList.remove('on'); m.onclick = null; modalOpen = false; res(v); };
    m.onclick = e => { const b = e.target.closest('button'); if (b) done(b.dataset.id); else if (!e.target.closest('.card')) done('close'); };
  });
}
export const card = id => modals[id].querySelector('.card');
