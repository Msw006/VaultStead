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
const door = { left: 478, top: 230, width: 560, height: 542 };
await sharp(join(sources, 'dial-room.png')).webp({ quality: 90 }).toFile(join(dir, 'room.webp'));
for (const [name, source] of [['dial', 'dial-room'], ['pad', 'keypad-room']]) {
  await sharp(join(sources, `${source}.png`)).extract(door).webp({ quality: 94 }).toFile(join(dir, `door-${name}.webp`));
  await sharp(join(sources, `${source}.png`)).extract({ left: 350, top: 112, width: 820, height: 825 }).resize(560, 564).webp({ quality: 85 }).toFile(join(dir, `thumb-${name}.webp`));
}
for (const [name, source] of [['empty', 'interior-room'], ['gold', 'gold-room'], ['brass', 'brass-room']]) {
  if (existsSync(join(sources, `${source}.png`))) await sharp(join(sources, `${source}.png`)).extract(door).webp({ quality: 93 }).toFile(join(dir, `interior-${name}.webp`));
}
await sharp(join(sources, 'dial-room.png')).extract({ left: 535, top: 335, width: 128, height: 128 }).webp({ quality: 98 }).toFile(join(dir, 'dial-face.webp'));
await sharp(join(sources, 'rear-room.png')).extract(door).webp({ quality: 94 }).toFile(join(dir, 'door-back.webp'));
console.log('Registered photographic WebP plates prepared.');
