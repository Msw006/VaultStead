// Diagnostic: locate the door gap in the master plate and check that every variant is registered to it.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
let sharp;
try { sharp = createRequire(join(root, 'package.json'))('sharp'); }
catch { sharp = createRequire('C:/Users/moksh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'); }
const dir = join(root, 'assets/source');

async function gray(file) {
  const { data, info } = await sharp(join(dir, file)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, at: (x, y) => data[y * info.width + x] };
}
const master = await gray('dial-room.jpg');
const { w, h } = master;

// Darkest columns / rows inside the cabinet are the shadow gap around the door.
function profile(img, axis, from, to, span) {
  const out = [];
  for (let i = 0; i < (axis === 'x' ? img.w : img.h); i++) {
    let s = 0;
    for (let j = from; j < to; j++) s += axis === 'x' ? img.at(i, j) : img.at(j, i);
    out.push(s / (to - from));
  }
  return out.map((v, i) => [i, v]).filter(([i]) => i >= span[0] && i <= span[1]);
}
const minima = (p, n) => p.filter(([i, v], k) => k > 0 && k < p.length - 1 && v <= p[k - 1][1] && v <= p[k + 1][1]).sort((a, b) => a[1] - b[1]).slice(0, n).sort((a, b) => a[0] - b[0]);
console.log('size', w, h);
console.log('dark columns (y 450-650):', minima(profile(master, 'x', 450, 650, [250, 900]), 8).map(([i, v]) => `${i}:${v.toFixed(0)}`).join(' '));
console.log('dark rows (x 600-700):', minima(profile(master, 'y', 600, 700, [50, 800]), 8).map(([i, v]) => `${i}:${v.toFixed(0)}`).join(' '));

// Registration: mean absolute difference on wall/rug regions outside the cabinet.
const regions = [[20, 20, 250, 500], [880, 20, 1130, 500], [20, 720, 1130, 840]];
for (const file of ['interior-room.jpg', 'gold-room.jpg', 'brass-room.jpg', 'keypad-room.jpg', 'rear-room.jpg']) {
  const img = await gray(file);
  let best = null;
  for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) {
    let s = 0, n = 0;
    for (const [x0, y0, x1, y1] of regions) for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { s += Math.abs(master.at(x, y) - img.at(x + dx, y + dy)); n++; }
    const d = s / n;
    if (!best || d < best.d) best = { dx, dy, d };
  }
  console.log(file, img.w, img.h, 'best offset', best.dx, best.dy, 'mad', best.d.toFixed(2));
}
