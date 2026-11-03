// HTML overlay for everything with text (HUD, hint, Kelvin's lines, reveal, invoices, Monster Book).
// Text stays crisp at any phone resolution; the farm itself is pixel art on the canvas.
const css = `
#ui{position:absolute;inset:0;pointer-events:none;font-family:"Press Start 2P",monospace;color:#fff}
#hud{position:absolute;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top));display:flex;gap:6px;justify-content:space-between}
.chip{background:#2b1d3aE6;border:2px solid #2b1d3a;border-radius:8px;padding:8px 9px;font-size:12px;white-space:nowrap;box-shadow:inset 0 -2px #0005}
.chip i{font-style:normal;color:#ffcf5c}
#bar{position:absolute;left:8px;right:8px;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;gap:8px;pointer-events:auto}
#bar button{flex:1;font:inherit;font-size:12px;line-height:1.4;color:#2b1d3a;background:#ffcf5c;border:3px solid #2b1d3a;border-radius:10px;padding:12px 4px;box-shadow:0 4px 0 #2b1d3a;cursor:pointer}
#bar button:active{transform:translateY(2px);box-shadow:0 2px 0 #2b1d3a}
#bar button.pulse{animation:pulse .8s ease-in-out infinite}
@keyframes pulse{50%{transform:scale(1.05);box-shadow:0 0 0 5px #ffcf5c88,0 4px 0 #2b1d3a}}
#stamp{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) rotate(-12deg) scale(3);opacity:0;color:#d9443a;border:5px solid currentColor;border-radius:8px;padding:10px 14px;font-size:20px;background:#fffc;white-space:nowrap;z-index:5}
#stamp.on{animation:stamp 1.4s ease-out forwards}
@keyframes stamp{0%{opacity:0;transform:translate(-50%,-50%) rotate(-12deg) scale(3)}12%{opacity:1;transform:translate(-50%,-50%) rotate(-12deg) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) rotate(-12deg) scale(1)}}
#hint{position:absolute;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);width:max-content;max-width:92%;
  background:#fff;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:10px;padding:10px 12px;font-size:11px;line-height:1.6;text-align:center;transition:opacity .3s}
#hint.off{opacity:0}
#say{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top));transform:translate(-50%,-6px);width:max-content;max-width:90%;background:#f6f3e8;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:10px;
  padding:9px 11px;font-size:10px;line-height:1.7;text-align:center;opacity:0;transition:opacity .2s,transform .2s;box-shadow:0 3px 0 #0005}
#say.on{opacity:1;transform:translate(-50%,0)}
#say b{color:#8a5ad0;font-weight:normal}
.modal{position:absolute;inset:0;background:#1f1630cc;display:none;align-items:center;justify-content:center;pointer-events:auto;z-index:4}
.modal.on{display:flex}
.card{background:#f6f3e8;color:#2b1d3a;border:3px solid #2b1d3a;border-radius:6px;width:min(90%,350px);padding:16px 14px;font-size:10px;line-height:1.9;
  box-shadow:0 6px 0 #0006;transform:scale(.6);transition:transform .25s cubic-bezier(.2,1.6,.4,1);text-align:center}
.modal.on .card{transform:scale(1)}
.card h1{font-size:14px;margin:0 0 6px}
.card .sub{font-size:9px;color:#6b5a7a;margin-bottom:8px}
.card .ln{display:flex;justify-content:space-between;gap:8px;text-align:left}
.card .ln b{font-weight:normal;white-space:nowrap}
.card .plus{color:#2e8a3a}.card .minus{color:#d9443a}
.card hr{border:0;border-top:2px dashed #b8b2a0;margin:8px 0}
.card .btns{display:flex;gap:8px;margin-top:12px}
.card button{flex:1;font:inherit;font-size:11px;line-height:1.5;border:3px solid #2b1d3a;border-radius:9px;background:#ffcf5c;color:#2b1d3a;padding:12px 4px;cursor:pointer;box-shadow:0 4px 0 #2b1d3a}
.card button.alt{background:#fff}
.card button.hot{background:#ff7a6a;color:#fff}
.card .tap{font-size:9px;color:#8a7a9a;margin-top:10px}
.card canvas{image-rendering:pixelated;display:block;margin:0 auto}
.receipt{clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),94% 100%,88% calc(100% - 7px),82% 100%,76% calc(100% - 7px),70% 100%,64% calc(100% - 7px),58% 100%,52% calc(100% - 7px),46% 100%,40% calc(100% - 7px),34% 100%,28% calc(100% - 7px),22% 100%,16% calc(100% - 7px),10% 100%,4% calc(100% - 7px),0 100%);padding-bottom:24px}
.reveal{background:transparent;border:0;box-shadow:none;color:#fff;width:min(94%,360px)}
.reveal .rar{display:inline-block;font-size:13px;padding:8px 12px;border:3px solid #2b1d3a;border-radius:8px;color:#2b1d3a;margin-bottom:8px}
.reveal .nm{font-size:16px;margin:10px 0 6px;text-shadow:0 3px #2b1d3a}
.reveal .val{font-size:14px;color:#ffcf5c;text-shadow:0 3px #2b1d3a}
.reveal .new{display:inline-block;margin-top:10px;font-size:11px;background:#d9443a;color:#fff;padding:6px 9px;border-radius:6px;transform:rotate(-4deg)}
.reveal .tap{color:#cbbfe0}
.rays{position:relative}
.rays:before{content:"";position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px;border-radius:50%;
  background:repeating-conic-gradient(var(--c) 0 10deg,transparent 10deg 30deg);opacity:.35;animation:spin 6s linear infinite;z-index:-1;
  -webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);mask:radial-gradient(circle,#000 30%,transparent 70%)}
@keyframes spin{to{transform:rotate(360deg)}}
.rainbow{animation:hue 1.2s linear infinite}@keyframes hue{to{filter:hue-rotate(360deg)}}
.pop{animation:pop .5s cubic-bezier(.2,1.8,.4,1)}@keyframes pop{0%{transform:scale(.2)}100%{transform:scale(1)}}
.coin{font-size:44px;display:inline-block;animation:flip .25s linear infinite}@keyframes flip{50%{transform:scaleX(.1)}}
.book{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.book div{background:#e6e0cc;border:2px solid #2b1d3a;border-radius:6px;padding:4px 0 2px;font-size:7px;line-height:1.4}
.book div.got{background:#fff}
.book .hd{background:none;border:0;font-size:8px;padding:0}
`;

let root, hint, sayEl, sayT, stampT;
let modal;
export let modalOpen = false;
const $ = id => root.querySelector('#' + id);

export function initUI(container, onAction) {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  root = document.createElement('div'); root.id = 'ui';
  root.innerHTML = `<div id="hud"><span class="chip">● <i id="h_coins"></i></span><span class="chip" id="h_seed"></span></div>
    <div id="stamp"></div><div id="say"></div><div id="hint" class="off"></div>
    <div id="bar"><button id="b_book">📖 MONSTER BOOK <span id="h_book"></span></button></div>
    <div class="modal" id="modal"><div class="card"></div></div>`;
  container.append(root);
  hint = $('hint'); sayEl = $('say'); modal = $('modal');
  root.querySelector('#bar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) onAction(b.id.slice(2)); });
}

export function setHud({ coins, seedLabel, book, bookMax, bookPulse }) {
  $('h_coins').textContent = coins; $('h_seed').innerHTML = seedLabel;
  $('h_book').textContent = `${book}/${bookMax}`; $('b_book').classList.toggle('pulse', !!bookPulse);
}

// Kelvin (or anyone) says one line in a speech bubble under the HUD.
export function say(html, ms = 2600) {
  sayEl.innerHTML = html; sayEl.classList.add('on'); clearTimeout(sayT);
  sayT = setTimeout(() => sayEl.classList.remove('on'), ms);
}

export function stamp(text, color = '#d9443a') {
  const s = $('stamp'); s.textContent = text; s.style.color = color; s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
  clearTimeout(stampT); stampT = setTimeout(() => s.classList.remove('on'), 1500);
}

export function setHint(html) { if (!html) { hint.classList.add('off'); return; } hint.innerHTML = html; hint.classList.remove('off'); }

// A full-screen card. Resolves with the id of the button pressed, or 'close' when tapped anywhere (if tapClose).
// onShow(card) runs after the HTML is in place (to draw canvases).
export function open(html, { buttons, cls = '', tapClose = !buttons, onShow } = {}) {
  const card = modal.querySelector('.card');
  card.className = 'card ' + cls;
  card.innerHTML = html + (buttons ? `<div class="btns">${buttons.map(b => `<button data-id="${b.id}" class="${b.cls || ''}">${b.label}</button>`).join('')}</div>` : '');
  modal.classList.add('on'); modalOpen = true; if (onShow) onShow(card);
  return new Promise(res => {
    const t0 = performance.now();
    const done = v => { modal.classList.remove('on'); modal.onclick = null; modalOpen = false; res(v); };
    modal.onclick = e => {
      if (performance.now() - t0 < 350) return;            // don't let the tap that opened it close it
      const b = e.target.closest('button'); if (b) done(b.dataset.id); else if (tapClose) done('close');
    };
  });
}
export const card = () => modal.querySelector('.card');
