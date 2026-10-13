// Diagnostic: refine each model's door, dial and readout geometry from rough guesses, measure each
// variant's pixel drift against the closed master, and write overlay previews to the OS temp folder.
// Usage: node scripts/measure-plates.mjs [model ...]
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
const root = resolve(import.meta.dirname, '..');
let sharp;
try { sharp = createRequire(join(root, 'package.json'))('sharp'); }
catch { sharp = createRequire('C:/Users/moksh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'); }

// Rough guesses in source pixels: door [left, top, right, bottom] or round door [cx, cy, r]; dial [cx, cy, r]; readout box.
const GUESS = {
  practice: { door: [323, 233, 821, 664], dial: [537, 439, 90] },
  street: { door: [478, 230, 1038, 772], dial: [599, 399, 60] },
  keypad: { door: [371, 194, 793, 672], readout: [440, 324, 531, 371] },
  heavy: { door: [340, 108, 815, 729], dial: [592, 330, 53] },
  treasury: { door: [345, 105, 806, 752], readout: [420, 243, 502, 286] },
  vault: { round: [577, 422, 334], readout: [402, 209, 549, 261] },
  royal: { door: [388, 158, 765, 624], dial: [577, 300, 64] },
};

async function gray(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, at: (x, y) => data[Math.min(info.height - 1, Math.max(0, y)) * info.width + Math.min(info.width - 1, Math.max(0, x))] };
}
const fileOf = (model, variant) => ['jpg', 'png'].map(e => join(root, 'assets/source', model, `${variant}.${e}`)).find(existsSync);

// Darkest line (the shadow gap) within ±r of a guessed edge.
function refineEdge(img, vertical, guess, from, to, r = 18) {
  let best = null;
  for (let p = guess - r; p <= guess + r; p++) {
    let s = 0, n = 0;
    for (let q = Math.round(from); q < to; q += 2) { s += vertical ? img.at(p, q) : img.at(q, p); n++; }
    if (!best || s / n < best.v) best = { p, v: s / n };
  }
  return best.p;
}
function refineRect(img, [l, t, r, b]) {
  const h = b - t, w = r - l;
  return [
    refineEdge(img, true, l, t + h * .2, b - h * .2), refineEdge(img, false, t, l + w * .2, r - w * .2),
    refineEdge(img, true, r, t + h * .2, b - h * .2), refineEdge(img, false, b, l + w * .2, r - w * .2),
  ];
}
// Circle edge: strongest radial luminance step near the guessed radius, sampled in 16 directions.
function refineCircle(img, [cx, cy, r], span = 14) {
  const hits = [];
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let best = null;
    for (let d = r - span; d <= r + span; d++) {
      const g = Math.abs(img.at(Math.round(cx + dx * (d + 2)), Math.round(cy + dy * (d + 2))) - img.at(Math.round(cx + dx * (d - 2)), Math.round(cy + dy * (d - 2))));
      if (!best || g > best.g) best = { d, g };
    }
    hits.push([cx + dx * best.d, cy + dy * best.d]);
  }
  const mx = hits.reduce((s, h) => s + h[0], 0) / hits.length, my = hits.reduce((s, h) => s + h[1], 0) / hits.length;
  const mr = hits.reduce((s, h) => s + Math.hypot(h[0] - mx, h[1] - my), 0) / hits.length;
  return [Math.round(mx), Math.round(my), Math.round(mr)];
}

const models = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GUESS);
for (const model of models) {
  const g = GUESS[model];
  const master = await gray(fileOf(model, 'closed'));
  const out = { size: [master.w, master.h] };
  if (g.door) out.door = refineRect(master, g.door);
  if (g.round) out.round = refineCircle(master, g.round, 20);
  if (g.dial) out.dial = refineCircle(master, g.dial, 8);
  if (g.readout) out.readout = refineRect(master, g.readout);
  const box = out.door ?? [out.round[0] - out.round[2], out.round[1] - out.round[2], out.round[0] + out.round[2], out.round[1] + out.round[2]];
  // Drift: compare the margins left and right of the cabinet and the strip below it.
  const regions = [[10, 10, box[0] - 50, master.h - 10], [box[2] + 80, 10, master.w - 10, master.h - 10], [box[0], Math.min(master.h - 30, box[3] + 60), box[2], master.h - 10]].filter(([a, b, c, d]) => c > a + 20 && d > b + 10);
  out.offset = {};
  for (const variant of ['interior', 'gold', 'brass', 'rear']) {
    const file = fileOf(model, variant);
    if (!file) continue;
    const img = await gray(file);
    let best = null;
    for (let dx = -10; dx <= 10; dx++) for (let dy = -10; dy <= 10; dy++) {
      let s = 0, n = 0;
      for (const [x0, y0, x1, y1] of regions) for (let y = y0; y < y1; y += 4) for (let x = x0; x < x1; x += 4) { s += Math.abs(master.at(x, y) - img.at(x + dx, y + dy)); n++; }
      if (!best || s / n < best.d) best = { dx, dy, d: s / n };
    }
    out.offset[variant] = [best.dx, best.dy, +best.d.toFixed(1)];
  }
  console.log(model, JSON.stringify(out));

  const shapes = [];
  if (out.door) shapes.push(`<rect x="${out.door[0]}" y="${out.door[1]}" width="${out.door[2] - out.door[0]}" height="${out.door[3] - out.door[1]}" fill="none" stroke="#0f0" stroke-width="2"/>`);
  if (out.round) shapes.push(`<circle cx="${out.round[0]}" cy="${out.round[1]}" r="${out.round[2]}" fill="none" stroke="#0f0" stroke-width="2"/>`);
  if (out.dial) shapes.push(`<circle cx="${out.dial[0]}" cy="${out.dial[1]}" r="${out.dial[2]}" fill="none" stroke="#f0f" stroke-width="2"/>`);
  if (out.readout) shapes.push(`<rect x="${out.readout[0]}" y="${out.readout[1]}" width="${out.readout[2] - out.readout[0]}" height="${out.readout[3] - out.readout[1]}" fill="none" stroke="#f0f" stroke-width="2"/>`);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${master.w}" height="${master.h}">${shapes.join('')}</svg>`);
  await sharp(fileOf(model, 'closed')).composite([{ input: svg }]).jpeg({ quality: 80 }).toFile(join(tmpdir(), `measure-${model}.jpg`));
}
console.log('Overlays written to', tmpdir());
