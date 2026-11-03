// Art: Kenney's CC0 Tiny Farm / Tiny Town / Tiny Dungeon sheets (16 px tiles, frame = row * 12 + col),
// plus a few small things drawn in code (lamp, glow, particles, Kelvin's desk).
export const T = 16;
export const INK = '#2b1d3a';

const PAL = { o: INK, k: '#5a3e2a', w: '#f6f3e8', l: '#b8b2a0', d: '#9aa0b0', D: '#6a7080', g: '#5a6070', y: '#fff3b0', K: '#9ff0a0', Y: '#ffcf5c', b: '#b07a46', B: '#8a5a32' };
function sprite(scene, key, rows) {
  const tex = scene.textures.createCanvas(key, rows[0].length, rows.length), c = tex.getContext();
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && PAL[ch]) { c.fillStyle = PAL[ch]; c.fillRect(x, y, 1, 1); } }));
  tex.refresh();
}

export function makeProps(scene) {
  // wooden lamp post in Kenney's palette (brown post, dark outline, warm lantern)
  sprite(scene, 'lamp', ['..ooo...', '.oYYYo..', '.oyyyo..', '.oYYYo..', '..ooo...', '..obo...', '..obo...', '..obo...', '..oBo...', '..obo...', '..obo...', '..oBo...', '..obo...', '..obo...', '.obbbo..', '.ooooo..']);
  // Kelvin's desk 24 x 16: a tiny office in the middle of a farm
  sprite(scene, 'desk', [
    '..........oooooo........', '.....ooooowwwwwwo.......', '....owwwwwowwwwwo..ooo..', '....owlwlwowlwlwo.oggo..',
    '....owwwwwowwwwwo.ogKo..', 'oooooooooooooooooooooooo', 'oddddddddddddddddddddddo', 'oDDDDDDDDDDDDDDDDDDDDDDo',
    'oooooooooooooooooooooooo', '.oDo................oDo.', '.oDo................oDo.', '.oDo................oDo.',
    '.oDo................oDo.', '.oDo................oDo.', '.ooo................ooo.', '........................']);
  sprite(scene, 'bang', ['.ooo.', 'oYYYo', 'oYYYo', 'oYYYo', '.oYo.', '.ooo.', 'oYYYo', '.ooo.']);
  const pt = scene.textures.createCanvas('px', 2, 2); pt.getContext().fillStyle = '#fff'; pt.getContext().fillRect(0, 0, 2, 2); pt.refresh();
  const gl = scene.textures.createCanvas('glow', 64, 64), g = gl.getContext(), grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,220,140,0.9)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64); gl.refresh();
}

// Draws the static farm into one big texture and returns the blocked tiles ("x,y").
export function drawFarm(scene, W, H, L) {
  const tex = scene.textures.createCanvas('farmbg', W * T, H * T), c = tex.getContext();
  const src = { farm: scene.textures.get('farm').getSourceImage(), town: scene.textures.get('town').getSourceImage(), dungeon: scene.textures.get('dungeon').getSourceImage() };
  const put = (sheet, f, x, y) => c.drawImage(src[sheet], (f % 12) * T, Math.floor(f / 12) * T, T, T, x * T, y * T, T, T);
  const blocked = new Set(), block = (x, y) => blocked.add(x + ',' + y);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // grass, with a few flowers
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put('town', rnd() < .1 ? 1 : rnd() < .06 ? 2 : 0, x, y);
  // a one-tile dirt path in front of the buildings
  { const [x0, x1, y] = L.path; for (let x = x0; x <= x1; x++) put('town', [39, 40, 41, 42][Math.floor(rnd() * 4)], x, y); }
  // fenced pasture for the animals (gate in the bottom middle)
  { const [x0, y0, x1, y1] = L.pasture, gate = Math.floor((x0 + x1) / 2);
    for (let x = x0; x <= x1; x++) {
      put('town', x === x0 ? 44 : x === x1 ? 46 : 45, x, y0); block(x, y0);
      put('town', x === x0 ? 68 : x === x1 ? 70 : x === gate ? 69 : 45, x, y1); block(x, y1);
    }
    for (let y = y0 + 1; y < y1; y++) { put('town', 56, x0, y); put('town', 58, x1, y); block(x0, y); block(x1, y); } }
  // farmhouse (3 x 4) and barn (3 x 4)
  { const [x0, y0] = L.house; [[52, 53, 54], [64, 65, 66], [72, 73, 75], [84, 85, 87]].forEach((r, j) => r.forEach((f, i) => { put('town', f, x0 + i, y0 + j); block(x0 + i, y0 + j); })); }
  { const [x0, y0] = L.barn; [[90, 91, 92], [102, 103, 104], [114, 115, 116], [126, 127, 128]].forEach((r, j) => r.forEach((f, i) => { put('farm', f, x0 + i, y0 + j); block(x0 + i, y0 + j); })); }
  // seed stall: sacks on a counter
  { const [x0, y0] = L.stall; put('farm', 9, x0, y0); put('farm', 33, x0 + 1, y0); put('farm', 98, x0, y0 + 1); put('farm', 99, x0 + 1, y0 + 1);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) block(x0 + i, y0 + j); }
  // decorations
  for (const [sheet, f, x, y] of L.decor) { put(sheet, f, x, y); block(x, y); }
  // soil strips for the plots (the vote plot too)
  for (const row of [...L.plotRows, L.voteRow]) { const [x0, x1, y] = row;
    for (let x = x0; x <= x1; x++) put('farm', x === x0 ? 60 : x === x1 ? 63 : (x - x0) % 2 ? 61 : 62, x, y); }
  // woods all round the farm (trees: top + trunk tiles)
  const tree = (x, y, kind) => { const [t, b] = kind ? [3, 15] : [4, 16]; put('town', t, x, y); put('town', b, x, y + 1); block(x, y); block(x, y + 1); };
  const inCore = (x, y) => x >= L.core[0] && x <= L.core[2] && y >= L.core[1] && y <= L.core[3];
  for (let y = -1; y < H; y += 2) for (let x = 0; x < W; x++) {
    const yy = y + (x % 2);
    if (!inCore(x, yy) && !inCore(x, yy + 1)) tree(x, yy, rnd() < .25);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inCore(x, y)) block(x, y);
  for (const [x, y] of L.trees) tree(x, y, 0);
  tex.refresh();
  return blocked;
}
