// Extract registered plates for every safe model, encode them for the browser, and write the matching
// stage geometry to src/components/vault/safe-models.json. This makes no semantic image edits.
// Source measurements come from scripts/measure-plates.mjs.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { readdir, rm, writeFile, mkdir } from 'node:fs/promises';
const root = resolve(import.meta.dirname, '..');
let sharp;
try { sharp = createRequire(join(root, 'package.json'))('sharp'); }
catch { sharp = createRequire('C:/Users/moksh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'); }
const out = join(root, 'public/assets/safe');
const sources = join(root, 'assets/source');

/*
 * Per model, in source pixels:
 * - bandTop: first row of the 3:2 room plate (sources are 1152 × 864 unless noted).
 * - door: [left, top, width, height]. round: true clips the door to its inscribed circle.
 * - dial: [left, top, size] square crop of the rotating number disc, plus its printed ring style.
 * - idle: second, non-rotating dial [left, top, size] that only receives a static ring.
 * - readout: [left, top, width, height] of the ember display window on the closed plate.
 * - offset: per-variant drift against closed, measured on the wall and floor outside the cabinet.
 */
const MODELS = {
  practice: { kind: 'dial', bandTop: 40, door: [322, 230, 499, 433], dial: [446, 349, 184], ring: 'light', offset: { interior: [0, 3], rear: [3, 4] } },
  street: { kind: 'dial', size: [1536, 1024], bandTop: 0, door: [478, 230, 560, 542], dial: [535, 335, 128], idle: [535, 545, 128], ring: 'engraved', offset: { gold: [0, -1], brass: [0, -1] } },
  keypad: { kind: 'pad', bandTop: 48, door: [373, 192, 417, 479], readout: [440, 327, 108, 42], offset: { interior: [-2, 0], gold: [-2, 3], brass: [-2, 4], rear: [0, 3] } },
  heavy: { kind: 'dial', bandTop: 40, door: [340, 108, 475, 621], dial: [538, 276, 108], ring: 'modern', offset: { interior: [1, 1], gold: [3, 0], brass: [6, 3], rear: [-1, -1] } },
  treasury: { kind: 'pad', bandTop: 44, door: [346, 103, 459, 647], readout: [419, 242, 96, 45], offset: { interior: [2, 2], gold: [4, 4], brass: [4, 3], rear: [5, 4] } },
  vault: { kind: 'pad', bandTop: 36, door: [243, 88, 668, 668], round: true, readout: [402, 210, 145, 47], offset: { interior: [1, 4], gold: [-1, 2], brass: [4, 10], rear: [-3, 2] } },
  royal: { kind: 'dial', bandTop: 40, door: [390, 157, 376, 473], dial: [514, 238, 124], ring: 'gilt', offset: { interior: [-2, 2], gold: [-4, 3], brass: [-4, 5], rear: [-1, 2] } },
};

const pct = (n, of) => +(n / of * 100).toFixed(3);
await mkdir(out, { recursive: true });
for (const name of await readdir(out)) if (name.endsWith('.webp')) await rm(join(out, name));

const geometry = {};
for (const [model, m] of Object.entries(MODELS)) {
  const [W, H] = m.size ?? [1152, 864];
  const bandH = Math.round(W * 2 / 3);
  const src = variant => ['jpg', 'png'].map(e => join(sources, model, `${variant}.${e}`)).find(existsSync);
  const at = (variant, [l, t, w, h]) => { const [dx, dy] = m.offset[variant] ?? [0, 0]; return { left: l + dx, top: t + dy, width: w, height: h }; };
  const enc = (variant, rect, file, q = 93) => sharp(src(variant)).extract(at(variant, rect)).webp({ quality: q }).toFile(join(out, file));

  await sharp(src('closed')).extract({ left: 0, top: m.bandTop, width: W, height: bandH }).webp({ quality: 88 }).toFile(join(out, `${model}-room.webp`));
  await enc('closed', m.door, `${model}-door.webp`, 94);
  await enc('rear', m.door, `${model}-back.webp`, 92);
  for (const loot of ['interior', 'gold', 'brass']) if (src(loot)) await enc(loot, m.door, `${model}-${loot === 'interior' ? 'empty' : loot}.webp`);
  if (m.dial) await sharp(src('closed')).extract({ left: m.dial[0], top: m.dial[1], width: m.dial[2], height: m.dial[2] }).resize(256, 256, { kernel: 'lanczos3' }).webp({ quality: 95 }).toFile(join(out, `${model}-dial.webp`));
  const [dl, dt, dw, dh] = m.door;
  const side = Math.min(bandH, W);
  const thumbLeft = Math.max(0, Math.min(W - side, Math.round(dl + dw / 2 - side / 2)));
  await sharp(src('closed')).extract({ left: thumbLeft, top: m.bandTop, width: side, height: side }).resize(560, 564).webp({ quality: 84 }).toFile(join(out, `${model}-thumb.webp`));

  const rel = ([l, t, w, h]) => [pct(l - dl, dw), pct(t - dt, dh), pct(w, dw), pct(h, dh)];
  geometry[model] = {
    kind: m.kind,
    door: [pct(dl, W), pct(dt - m.bandTop, bandH), pct(dw, W), pct(dh, bandH)],
    round: !!m.round,
    hinge: [pct(dl + dw, W), pct(dt - m.bandTop + dh / 2, bandH)],
    ...(m.dial && { dial: rel([m.dial[0], m.dial[1], m.dial[2], m.dial[2]]).slice(0, 3), ring: m.ring, dialHit: [pct(m.dial[0], W), pct(m.dial[1] - m.bandTop, bandH), pct(m.dial[2], W)] }),
    ...(m.idle && { idle: rel([m.idle[0], m.idle[1], m.idle[2], m.idle[2]]).slice(0, 3) }),
    ...(m.readout && { readout: rel(m.readout) }),
    loot: ['interior', 'gold', 'brass'].filter(v => src(v)).map(v => v === 'interior' ? 'empty' : v),
  };
}
await writeFile(join(root, 'src/components/vault/safe-models.json'), JSON.stringify(geometry, null, 2) + '\n');
console.log(`Prepared plates for ${Object.keys(MODELS).length} safe models.`);
