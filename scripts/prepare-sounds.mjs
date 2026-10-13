// Mix the door-opening sounds from real CC0 recordings on Freesound into public/assets/sound/.
// Needs ffmpeg on PATH, or FFMPEG=<path to ffmpeg>. Sources are cached in assets/sound-source/.
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const sources = join(root, 'assets/sound-source');
const out = join(root, 'public/assets/sound');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

const SOURCES = {
  bolt: { url: 'https://cdn.freesound.org/previews/453/453966_612689-hq.mp3', credit: '"door metal heavy push bar beep open close with security deadbolt unlock click3 +tone" by kyles — https://freesound.org/people/kyles/sounds/453966/' },
  clunk: { url: 'https://cdn.freesound.org/previews/734/734641_13973196-hq.mp3', credit: '"Lock - strong door" by Vrymaa — https://freesound.org/people/Vrymaa/sounds/734641/' },
  vault: { url: 'https://cdn.freesound.org/previews/445/445099_2023214-hq.mp3', credit: '"Vault 2" by lezaarth — https://freesound.org/people/lezaarth/sounds/445099/' },
  bunker: { url: 'https://cdn.freesound.org/previews/452/452784_9351406-hq.mp3', credit: '"Heavy Gate Metal 03 (underground bunker of civil defense)" by ALEFF-ATMOS — https://freesound.org/people/ALEFF-ATMOS/sounds/452784/' },
};
const MONO = 'aformat=sample_rates=44100:channel_layouts=mono';
/** [source, start s, end s, gain, delay ms, extra filters] — cut, level, and place each layer. */
const MIXES = {
  // A small box: one recording of a small vault unlatching and swinging open.
  light: [['vault', .06, 2.65, 1, 0, 'afade=t=out:st=2.4:d=0.19']],
  // A steel safe: the bolt throws, a lock clunks, then the same vault slowed and deepened so the door feels heavier.
  medium: [
    ['bolt', .66, 1.2, .45, 0], ['clunk', .84, 1.12, 3, 130],
    ['vault', .26, 2.65, 1, 220, 'asetrate=37485,aresample=44100,bass=g=5:f=110,afade=t=out:st=2.6:d=0.2'],
  ],
  // A bank vault: two bolts, a lock clunk, then a blast door grinding open in a concrete room.
  heavy: [
    ['bolt', .66, 1.2, .45, 0], ['clunk', .84, 1.12, 3, 120], ['clunk', .84, 1.12, 2.4, 260],
    ['bunker', 4.45, 10.6, 1, 340, 'afade=t=out:st=4.3:d=1.85'],
  ],
};

await mkdir(sources, { recursive: true }); await mkdir(out, { recursive: true });
for (const [name, { url }] of Object.entries(SOURCES)) {
  const file = join(sources, name + '.mp3');
  if (!existsSync(file)) await writeFile(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
}
for (const [name, layers] of Object.entries(MIXES)) {
  const inputs = [...new Set(layers.map(l => l[0]))];
  const graph = layers.map(([source, start, end, gain, delay, extra], i) =>
    `[${inputs.indexOf(source)}]atrim=${start}:${end},asetpts=PTS-STARTPTS,${MONO},volume=${gain}${extra ? ',' + extra : ''},adelay=${delay}[l${i}]`);
  // Each source can feed several layers, so split it first.
  const splits = inputs.map((source, i) => { const n = layers.filter(l => l[0] === source).length; return n > 1 ? `[${i}]asplit=${n}${Array.from({ length: n }, (_, k) => `[s${i}_${k}]`).join('')}` : null; }).filter(Boolean);
  const used = {};
  const wired = graph.map(chain => chain.replace(/^\[(\d+)\]/, (_, i) => {
    const n = layers.filter(l => l[0] === inputs[i]).length;
    if (n === 1) return `[${i}]`;
    used[i] = (used[i] ?? -1) + 1; return `[s${i}_${used[i]}]`;
  }));
  const mix = `${layers.map((_, i) => `[l${i}]`).join('')}amix=inputs=${layers.length}:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=14,${MONO}`;
  execFileSync(ffmpeg, ['-y', '-v', 'error', ...inputs.flatMap(s => ['-i', join(sources, s + '.mp3')]), '-filter_complex', [...splits, ...wired, mix].join(';'), '-ac', '1', '-b:a', '96k', join(out, `open-${name}.mp3`)]);
  console.log(`open-${name}.mp3`);
}
await writeFile(join(out, 'CREDITS.txt'), 'Door sounds are mixed from these CC0 (public domain) recordings on Freesound.org:\n' + Object.values(SOURCES).map(s => '- ' + s.credit).join('\n') + '\n');
