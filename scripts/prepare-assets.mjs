// Extract registered plates and encode them for the browser. This makes no semantic image edits.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
const root = resolve(import.meta.dirname, '..');
let sharp;
try { sharp = createRequire(join(root, 'package.json'))('sharp'); }
catch { sharp = createRequire('C:/Users/moksh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'); }
const dir = join(root, 'public/assets/safe');
const sources = join(root, 'assets/source');

// Sources are 1152 × 864. The stage is 3:2, so every plate is cut from the same 1152 × 768 band.
const band = { left: 0, top: 40, width: 1152, height: 768 };
// Door gap measured on dial-room.jpg (scripts/measure-plates.mjs).
const door = { left: 340, top: 108, width: 475, height: 621 };
// Per-source drift against dial-room.jpg, measured on the wall and rug outside the cabinet.
const offset = { 'dial-room': [0, 0], 'keypad-room': [2, 1], 'interior-room': [1, 1], 'gold-room': [3, 0], 'brass-room': [6, 3], 'rear-room': [-1, -1] };
const shifted = (source, rect) => ({ ...rect, left: rect.left + offset[source][0], top: rect.top + offset[source][1] });
const src = source => join(sources, `${source}.jpg`);

await sharp(src('dial-room')).extract(band).webp({ quality: 90 }).toFile(join(dir, 'room.webp'));
for (const [name, source] of [['dial', 'dial-room'], ['pad', 'keypad-room']]) {
  await sharp(src(source)).extract(shifted(source, door)).webp({ quality: 94 }).toFile(join(dir, `door-${name}.webp`));
  await sharp(src(source)).extract(shifted(source, { left: 286, top: 64, width: 580, height: 584 })).resize(560, 564).webp({ quality: 85 }).toFile(join(dir, `thumb-${name}.webp`));
}
for (const [name, source] of [['empty', 'interior-room'], ['gold', 'gold-room'], ['brass', 'brass-room']]) {
  if (existsSync(src(source))) await sharp(src(source)).extract(shifted(source, door)).webp({ quality: 93 }).toFile(join(dir, `interior-${name}.webp`));
}
// Live dial: the rotating black number disc, centre (592, 330), radius 53.
await sharp(src('dial-room')).extract({ left: 538, top: 276, width: 108, height: 108 }).resize(256, 256, { kernel: 'lanczos3' }).webp({ quality: 96 }).toFile(join(dir, 'dial-face.webp'));
await sharp(src('rear-room')).extract(shifted('rear-room', door)).webp({ quality: 94 }).toFile(join(dir, 'door-back.webp'));
console.log('Registered photographic WebP plates prepared.');
