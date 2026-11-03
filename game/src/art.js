// All art is drawn in code (pixel by pixel) so it matches Kelvin's palette and costs no SpriteCook credits.
// Sprites are pixel maps: one character = one pixel, '.' = transparent.

export const T = 16;                       // tile size in px
export const INK = '#2b1d3a';              // outline colour used everywhere

const PAL = {
  o: INK, k: '#1a1020', w: '#ffffff',
  s: '#f2c79a', S: '#d9a376',              // skin
  h: '#6b3e26',                            // hair
  y: '#f0cf6a', Y: '#c9a040', r: '#c94a3a',// straw hat + band
  b: '#4a90d9', B: '#2f6aa8',              // shirt
  p: '#3e5a8a', P: '#2c4268',              // trousers
  n: '#5a3e2a',                            // boots
};

function sprite(scene, key, rows, pal = PAL) {
  const h = rows.length, w = rows[0].length;
  const tex = scene.textures.createCanvas(key, w, h), ctx = tex.getContext();
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.' && pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
  tex.refresh();
}

// ---------- farmer (12 x 16): down / up / side, two walk frames each ----------
const HEAD_DOWN = [
  '....oooo....',
  '...oyyyyo...',
  '..oyyrryyo..',
  '.oYYYYYYYYo.',
  '..osssssso..',
  '..osksskso..',
  '..osssssso..',
  '...oossoo...',
];
const HEAD_UP = [
  '....oooo....',
  '...oyyyyo...',
  '..oyyyyyyo..',
  '.oYYYYYYYYo.',
  '..ohhhhhho..',
  '..ohhhhhho..',
  '..ohhhhhho..',
  '...oohhoo...',
];
const HEAD_SIDE = [
  '....oooo....',
  '...oyyyyo...',
  '..oyyyrryo..',
  '.oYYYYYYYYYo',
  '..ohhsssso..',
  '..ohssskso..',
  '..ohsssssSo.',
  '...oosssoo..',
];
const BODY = [
  '..obbbbbbo..',
  '.osbbbbbbso.',
  '.osBbbbbBso.',
  '..oppppppo..',
];
const LEGS_A = ['..oppoppo...', '..onnoonno..', '..ooo..ooo..', '............'];
const LEGS_B = ['...oppoppo..', '..onnoonno..', '..ooo..ooo..', '............'];
const LEGS_S1 = ['..opp.oppo..', '.onno..onno.', '.ooo....ooo.', '............'];
const LEGS_S2 = ['...oppppo...', '...onnnno...', '...oooooo...', '............'];

export function makeFarmer(scene) {
  sprite(scene, 'f_down0', [...HEAD_DOWN, ...BODY, ...LEGS_A]);
  sprite(scene, 'f_down1', [...HEAD_DOWN, ...BODY, ...LEGS_B]);
  sprite(scene, 'f_up0', [...HEAD_UP, ...BODY, ...LEGS_A]);
  sprite(scene, 'f_up1', [...HEAD_UP, ...BODY, ...LEGS_B]);
  sprite(scene, 'f_side0', [...HEAD_SIDE, ...BODY, ...LEGS_S1]);
  sprite(scene, 'f_side1', [...HEAD_SIDE, ...BODY, ...LEGS_S2]);
}

// ---------- tools (8 x 8 icons, swung next to the farmer) ----------
export function makeTools(scene) {
  sprite(scene, 'tool_hoe', ['......oo', '.....ono', '....onoo', '...ono..', '..ono...', '.ono....', 'oyo.....', 'oo......'],
    { ...PAL, n: '#9a6a3e', y: '#c0c8d0' });
  sprite(scene, 'tool_basket', ['..oooo..', '.o....o.', 'oooooooo', 'onnnnnno', 'onynynyo', 'onnnnnno', '.onnnno.', '..oooo..'],
    { ...PAL, n: '#c99a5e', y: '#9a6a3e' });
  sprite(scene, 'tool_seeds', ['..oooo..', '.oyyyyo.', 'oyynyyyo', 'oyyyynyo', 'oynyyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'],
    { ...PAL, y: '#e8d8a8', n: '#8a6a3a' });
}

// ---------- monster crops ----------
// Drawn as round critters with eyes; species differ by colour and a head feature.
const SPECIES = {
  sproutling: { body: '#7ccf5a', dark: '#4e9a3a', feat: 'leaf' },
  grumbean:   { body: '#5aa8e8', dark: '#2e6cb0', feat: 'brows' },
  puffcap:    { body: '#ff8fc8', dark: '#c45a96', feat: 'cap' },
  mopkin:     { body: '#c9a0ff', dark: '#8a5ad0', feat: 'crown' },
};
export function makeCrops(scene) {
  for (const [id, sp] of Object.entries(SPECIES)) {
    const tex = scene.textures.createCanvas('m_' + id, 14, 14), c = tex.getContext();
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
      const d = ((x - 6.5) / 5.6) ** 2 + ((y - 8.2) / 5) ** 2;
      if (d <= 1) px(x, y, y > 9 || x > 9 ? sp.dark : sp.body);
    }
    // outline
    const img = c.getImageData(0, 0, 14, 14).data, on = (x, y) => x >= 0 && y >= 0 && x < 14 && y < 14 && img[(y * 14 + x) * 4 + 3];
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++)
      if (!on(x, y) && (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1))) px(x, y, INK);
    px(4, 8, INK); px(9, 8, INK); px(4, 7, '#ffffff'); px(9, 7, '#ffffff');      // eyes
    px(6, 10, INK); px(7, 10, INK);                                              // mouth
    if (sp.feat === 'leaf') { px(6, 3, '#4e9a3a'); px(6, 2, '#4e9a3a'); px(7, 1, '#7ccf5a'); px(8, 1, '#7ccf5a'); px(8, 2, '#4e9a3a'); }
    if (sp.feat === 'brows') { px(3, 6, INK); px(4, 6, INK); px(9, 6, INK); px(10, 6, INK); px(5, 5, INK); px(8, 5, INK); }
    if (sp.feat === 'cap') { for (let x = 2; x < 12; x++) { px(x, 3, sp.dark); px(x, 4, '#ff8fc8'); } px(4, 3, '#fff'); px(9, 4, '#fff'); for (let x = 1; x < 13; x++) px(x, 2, INK); }
    if (sp.feat === 'crown') { [[4, 2], [6, 1], [8, 2], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3]].forEach(([x, y]) => px(x, y, '#ffcf5c')); }
    tex.refresh();
  }
  // growth stages, shared by every seed (you only find out what it is at harvest)
  sprite(scene, 'crop0', ['......', '..oo..', '.oyyo.', '.oyyo.', '..oo..'], { ...PAL, y: '#f0d9a0' });
  sprite(scene, 'crop1', ['..o.o...', '.olool..', '..olo...', '...o....', '...o....'], { ...PAL, l: '#7ccf5a' });
  sprite(scene, 'crop2', ['...oo...', '..olLo..', '.olLLlo.', '.oLLLLo.', '..oLLo..', '...oo...', '...ol...'], { ...PAL, l: '#7ccf5a', L: '#4e9a3a' });
  sprite(scene, 'crop3', ['...oo...', '..oyyo..', '.oyYYyo.', 'oyYwwYyo', 'oyYwwYyo', '.oyYYyo.', '..oyyo..', '...ol...'],
    { ...PAL, y: '#ffcf5c', Y: '#ff9a3c', w: '#fff3d0', l: '#4e9a3a' });
}

// ---------- props ----------
export function makeProps(scene) {
  // shipping crate 14 x 12
  sprite(scene, 'crate', [
    'oooooooooooooo', 'onnnnnnnnnnnno', 'onNNNNNNNNNNno', 'onnnnnnnnnnnno', 'onNNNNNNNNNNno',
    'onnnnnnnnnnnno', 'onNNNNNNNNNNno', 'onnnnnnnnnnnno', 'onNNNNNNNNNNno', 'onnnnnnnnnnnno', 'oooooooooooooo', '.o..........o.'],
    { ...PAL, n: '#b07a46', N: '#8a5a32' });
  // seed stall 40 x 28 (awning + counter + sacks)
  const st = scene.textures.createCanvas('stall', 40, 28), c = st.getContext();
  c.fillStyle = INK; c.fillRect(0, 0, 40, 9); c.fillRect(2, 9, 2, 19); c.fillRect(36, 9, 2, 19); c.fillRect(0, 16, 40, 12);
  for (let x = 1; x < 39; x += 1) { c.fillStyle = Math.floor((x - 1) / 5) % 2 ? '#fff3d0' : '#ffcf5c'; c.fillRect(x, 1, 1, 7); }
  for (let x = 1; x < 39; x += 5) { c.fillStyle = INK; c.fillRect(x, 8, 5, 1); }
  c.fillStyle = '#b07a46'; c.fillRect(1, 17, 38, 10); c.fillStyle = '#8a5a32'; c.fillRect(1, 21, 38, 1); c.fillRect(1, 25, 38, 1);
  [[6, '#e8d8a8'], [15, '#d0c090'], [24, '#e8d8a8']].forEach(([x, col]) => {
    c.fillStyle = INK; c.fillRect(x, 10, 9, 8); c.fillStyle = col; c.fillRect(x + 1, 11, 7, 6);
    c.fillStyle = '#7ccf5a'; c.fillRect(x + 3, 12, 3, 2);
  });
  st.refresh();
  // lamp post 6 x 20
  sprite(scene, 'lamp', ['.oooo.', 'oyyyyo', 'oyyyyo', '.oooo.', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '..oo..', '.oooo.', 'oooooo'],
    { ...PAL, y: '#fff3b0' });
  // sign 18 x 14
  sprite(scene, 'sign', ['oooooooooooooooooo', 'onnnnnnnnnnnnnnnno', 'onkkkkkkkkkkknnnno', 'onnnnnnnnnnnnnnnno', 'onkkkkkkkknnnnnnno', 'onnnnnnnnnnnnnnnno', 'oooooooooooooooooo', '........oo........', '........oo........', '........oo........', '........oo........', '........oo........', '.......oooo.......', '..................'],
    { ...PAL, n: '#c99a5e', k: '#5a3e2a' });
  // Kelvin's desk 24 x 16: a tiny office in the middle of a farm
  sprite(scene, 'desk', [
    '..........oooooo........', '.....ooooowwwwwwo.......', '....owwwwwowwwwwo..ooo..', '....owlwlwowlwlwo.oggo..',
    '....owwwwwowwwwwo.ogko..', 'oooooooooooooooooooooooo', 'oddddddddddddddddddddddo', 'oDDDDDDDDDDDDDDDDDDDDDDo',
    'oooooooooooooooooooooooo', '.oDo................oDo.', '.oDo................oDo.', '.oDo................oDo.',
    '.oDo................oDo.', '.oDo................oDo.', '.ooo................ooo.', '........................'],
    { ...PAL, w: '#f6f3e8', l: '#b8b2a0', d: '#9aa0b0', D: '#6a7080', g: '#5a6070', k: '#9ff0a0' });
  // ! marker
  sprite(scene, 'bang', ['.ooo.', 'oyyyo', 'oyyyo', 'oyyyo', '.oyo.', '.ooo.', 'oyyyo', '.ooo.'], { ...PAL, y: '#ffcf5c' });
  // 2 x 2 particle
  const pt = scene.textures.createCanvas('px', 2, 2); pt.getContext().fillStyle = '#fff'; pt.getContext().fillRect(0, 0, 2, 2); pt.refresh();
  // soft light for lamps at night (radial)
  const gl = scene.textures.createCanvas('glow', 64, 64), g = gl.getContext(), grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,220,140,0.9)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64); gl.refresh();
}

// ---------- the farm background (drawn once) ----------
// Returns the set of blocked tiles ("x,y") so the farmer walks around buildings, trees and the pond.
export function drawFarm(scene, W, H, L) {
  const tex = scene.textures.createCanvas('farm', W * T, H * T), c = tex.getContext();
  const blocked = new Set(), block = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked.add(x + ',' + y); };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // grass, checker + tufts + flowers
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    c.fillStyle = (x + y) % 2 ? '#54923a' : '#5a9a3c'; c.fillRect(x * T, y * T, T, T);
  }
  for (let i = 0; i < W * H * 1.6; i++) { const x = rnd() * W * T | 0, y = rnd() * H * T | 0; c.fillStyle = '#4a8a34'; c.fillRect(x, y, 1, 2); c.fillRect(x + 2, y - 1, 1, 3); }
  for (let i = 0; i < W * H * 0.12; i++) { const x = rnd() * W * T | 0, y = rnd() * H * T | 0; c.fillStyle = rnd() < .5 ? '#ffcf5c' : '#ff9eb5'; c.fillRect(x, y, 2, 2); c.fillStyle = '#fff3b0'; c.fillRect(x, y, 1, 1); }
  // dirt paths
  const path = (x0, y0, x1, y1) => { c.fillStyle = '#c9a46a'; c.fillRect(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T); c.fillStyle = '#b8935a';
    for (let i = 0; i < (x1 - x0 + 1) * (y1 - y0 + 1) * 6; i++) c.fillRect(x0 * T + rnd() * (x1 - x0 + 1) * T, y0 * T + rnd() * (y1 - y0 + 1) * T, 1, 1); };
  for (const p of L.paths) path(...p);
  // pond
  { const [x0, y0, x1, y1] = L.pond, cx = (x0 + x1 + 1) / 2 * T, cy = (y0 + y1 + 1) / 2 * T, rx = (x1 - x0 + 1) / 2 * T, ry = (y1 - y0 + 1) / 2 * T;
    for (let y = y0 * T; y < (y1 + 1) * T; y++) for (let x = x0 * T; x < (x1 + 1) * T; x++) {
      const d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2;
      if (d <= 1) { c.fillStyle = d > .82 ? '#2b1d3a' : d > .7 ? '#8ad4ff' : (y < cy - ry * .3 ? '#5ab4f0' : '#3a8ad0'); c.fillRect(x, y, 1, 1); }
    }
    c.fillStyle = '#c4ecff'; c.fillRect(cx - 10, cy - 6, 8, 1); c.fillRect(cx + 4, cy + 4, 6, 1);
    block(x0, y0, x1, y1); }
  // house (with the bed inside: tapping the door sleeps)
  { const [x0, y0, x1, y1] = L.house, X = x0 * T, Y = y0 * T, w = (x1 - x0 + 1) * T, h = (y1 - y0 + 1) * T;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(X + 4, Y + h, w, 5);
    c.fillStyle = INK; c.fillRect(X, Y + 18, w, h - 18);
    c.fillStyle = '#f0e2c4'; c.fillRect(X + 1, Y + 19, w - 2, h - 20);
    for (let yy = Y + 23; yy < Y + h; yy += 5) { c.fillStyle = '#d8c6a0'; c.fillRect(X + 1, yy, w - 2, 1); }
    for (let i = 0; i < 22; i++) { c.fillStyle = INK; c.fillRect(X - 3 + i, Y + 22 - i, w + 6 - i * 2, 1); c.fillStyle = i % 4 < 2 ? '#c94a3a' : '#a83a2e'; c.fillRect(X - 2 + i, Y + 22 - i, w + 4 - i * 2, 1); }
    const dx = (L.door[0]) * T + 3; c.fillStyle = INK; c.fillRect(dx - 1, Y + h - 22, 12, 22); c.fillStyle = '#8a5a32'; c.fillRect(dx, Y + h - 21, 10, 21); c.fillStyle = '#ffcf5c'; c.fillRect(dx + 7, Y + h - 11, 2, 2);
    [[X + 10, Y + 32], [X + w - 26, Y + 32]].forEach(([wx, wy]) => { c.fillStyle = INK; c.fillRect(wx, wy, 16, 14); c.fillStyle = '#8ad4ff'; c.fillRect(wx + 1, wy + 1, 14, 12); c.fillStyle = INK; c.fillRect(wx + 7, wy, 2, 14); c.fillRect(wx, wy + 6, 16, 2); });
    block(x0, y0, x1, y1); }
  // barn
  { const [x0, y0, x1, y1] = L.barn, X = x0 * T, Y = y0 * T, w = (x1 - x0 + 1) * T, h = (y1 - y0 + 1) * T;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(X + 4, Y + h, w, 5);
    c.fillStyle = INK; c.fillRect(X, Y, w, h); c.fillStyle = '#7a2e2a'; c.fillRect(X + 1, Y + 1, w - 2, 20);
    for (let x = X + 3; x < X + w - 2; x += 5) { c.fillStyle = '#5e2422'; c.fillRect(x, Y + 1, 1, 20); }
    c.fillStyle = '#c94a3a'; c.fillRect(X + 1, Y + 21, w - 2, h - 22);
    c.fillStyle = '#e8e0d0'; c.fillRect(X + w / 2 - 14, Y + h - 30, 28, 29); c.fillStyle = INK; c.fillRect(X + w / 2 - 1, Y + h - 30, 2, 29);
    c.beginPath(); c.strokeStyle = INK; c.moveTo(X + w / 2 - 13, Y + h - 29); c.lineTo(X + w / 2 + 13, Y + h - 2); c.moveTo(X + w / 2 + 13, Y + h - 29); c.lineTo(X + w / 2 - 13, Y + h - 2); c.stroke();
    block(x0, y0, x1, y1); }
  // trees (2 x 2 tiles; the trunk row blocks)
  const tree = (tx, ty) => { const X = tx * T, Y = ty * T;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(X + 4, Y + 28, 26, 4);
    c.fillStyle = INK; c.fillRect(X + 12, Y + 18, 8, 13); c.fillStyle = '#7a4a2a'; c.fillRect(X + 13, Y + 18, 6, 12);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) { const d = ((x - 15.5) / 15) ** 2 + ((y - 11) / 11.5) ** 2;
      if (d <= 1) { c.fillStyle = d > .85 ? INK : (y < 9 && x < 18 ? '#4fae4a' : y > 15 ? '#2e7a34' : '#3c9440'); c.fillRect(X + x, Y + y - 2, 1, 1); } }
    block(tx, ty + 1, tx + 1, ty + 1); };
  for (const [x, y] of L.trees) tree(x, y);
  // border: a hedge all round the farm, with the fence along the top
  for (let x = 0; x < W; x += 2) { tree(x, -1); tree(x, H - 2); }
  for (let y = 1; y < H - 2; y += 2) { tree(-1, y); tree(W - 1, y); }
  block(0, 0, W - 1, 0); block(0, H - 1, W - 1, H - 1); block(0, 0, 0, H - 1); block(W - 1, 0, W - 1, H - 1);
  // soil plots
  for (const [x, y] of [...L.plots, ...L.votePlot]) {
    c.fillStyle = INK; c.fillRect(x * T, y * T, T, T); c.fillStyle = '#7a5536'; c.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
    c.fillStyle = '#6a4a2e'; c.fillRect(x * T + 2, y * T + 5, T - 4, 1); c.fillRect(x * T + 2, y * T + 10, T - 4, 1);
  }
  tex.refresh();
  return blocked;
}
