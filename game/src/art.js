// Art: Kenney's CC0 Tiny Farm / Tiny Town / Tiny Dungeon sheets (16 px tiles, frame = row * 12 + col),
// plus a few things drawn in code in Kenney's palette (soil beds, Kelvin's desk, arrow, particles).
export const T = 16;
export const INK = '#2b1d3a';
const SOIL = { hi: '#fec99c', lt: '#eaa56c', md: '#cf8254', dk: '#b86542', ol: '#7a3e2e' };

const PAL = { o: INK, w: '#f6f3e8', l: '#b8b2a0', d: '#9aa0b0', D: '#6a7080', g: '#5a6070', K: '#9ff0a0', Y: '#ffcf5c', y: '#fff3b0' };
function sprite(scene, key, rows) {
  const tex = scene.textures.createCanvas(key, rows[0].length, rows.length), c = tex.getContext();
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && PAL[ch]) { c.fillStyle = PAL[ch]; c.fillRect(x, y, 1, 1); } }));
  tex.refresh();
}

export function makeProps(scene) {
  // Kelvin's desk 24 x 16: a tiny office in the middle of a farm
  sprite(scene, 'desk', [
    '..........oooooo........', '.....ooooowwwwwwo.......', '....owwwwwowwwwwo..ooo..', '....owlwlwowlwlwo.oggo..',
    '....owwwwwowwwwwo.ogKo..', 'oooooooooooooooooooooooo', 'oddddddddddddddddddddddo', 'oDDDDDDDDDDDDDDDDDDDDDDo',
    'oooooooooooooooooooooooo', '.oDo................oDo.', '.oDo................oDo.', '.oDo................oDo.',
    '.oDo................oDo.', '.oDo................oDo.', '.ooo................ooo.', '........................']);
  sprite(scene, 'bang', ['.ooo.', 'oYYYo', 'oYYYo', 'oYYYo', '.oYo.', '.ooo.', 'oYYYo', '.ooo.']);
  sprite(scene, 'arrow', ['.ooooo.', '.oYYYo.', '.oYYYo.', 'ooYYYoo', 'oYYYYYo', '.oYYYo.', '..oYo..', '...o...']);
  const pt = scene.textures.createCanvas('px', 2, 2); pt.getContext().fillStyle = '#fff'; pt.getContext().fillRect(0, 0, 2, 2); pt.refresh();

  // soil bed 30 x 30 (a plot is 2 x 2 tiles), and its front lip drawn over the monster so it pokes out of the ground
  const bed = (key, h, lipOnly) => {
    const t = scene.textures.createCanvas(key, 30, h), c = t.getContext(), r = (x, y, w, hh, col) => { c.fillStyle = col; c.fillRect(x, y, w, hh); };
    if (!lipOnly) {
      r(1, 0, 28, 30, SOIL.ol); r(0, 1, 30, 28, SOIL.ol);
      r(2, 1, 26, 28, SOIL.md); r(1, 2, 28, 26, SOIL.md);
      r(2, 2, 26, 2, SOIL.lt);
      for (const y of [8, 14, 20]) { r(3, y, 24, 1, SOIL.dk); r(3, y + 1, 24, 1, SOIL.lt); }
      r(4, 3, 2, 1, SOIL.hi); r(20, 10, 2, 1, SOIL.hi); r(9, 22, 2, 1, SOIL.hi);
    } else {          // bottom 11 rows of the bed
      r(1, 0, 28, h - 1, SOIL.md); r(0, 0, 30, h - 2, SOIL.md); r(0, 0, 1, h - 2, SOIL.ol); r(29, 0, 1, h - 2, SOIL.ol);
      r(1, h - 2, 28, 1, SOIL.ol); r(2, h - 1, 26, 1, SOIL.ol); r(1, h - 2, 1, 1, SOIL.ol); r(28, h - 2, 1, 1, SOIL.ol);
      r(2, 0, 26, 2, SOIL.lt); r(2, 0, 26, 1, SOIL.hi); r(3, 5, 24, 1, SOIL.dk); r(3, 6, 24, 1, SOIL.lt);
    }
    t.refresh();
  };
  bed('bed', 30); bed('lip', 11, true);
}

// The field behind everything: grass, flowers, a few bushes and trees at the sides.
export function drawField(scene, W, H) {
  const tex = scene.textures.createCanvas('fieldbg', W * T, H * T), c = tex.getContext();
  const src = { farm: scene.textures.get('farm').getSourceImage(), town: scene.textures.get('town').getSourceImage() };
  const put = (sheet, f, x, y) => c.drawImage(src[sheet], (f % 12) * T, Math.floor(f / 12) * T, T, T, x * T, y * T, T, T);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put('town', rnd() < .1 ? 1 : rnd() < .05 ? 2 : 0, x, y);
  const tree = (x, y, kind) => { const [t, b] = kind ? [3, 15] : [4, 16]; put('town', t, x, y); put('town', b, x, y + 1); };
  for (let y = 0; y < H; y += 2) for (const x of [0, 1, 2, 3, 12, 13, 14, 15]) tree(x, y + (x % 2), rnd() < .3);
  for (const [sheet, f, x, y] of [['farm', 83, 4, 7], ['farm', 39, 11, 7], ['farm', 78, 4, 17], ['farm', 83, 11, 17], ['town', 29, 11, 18], ['farm', 39, 4, 18]]) put(sheet, f, x, y);
  tex.refresh();
}
