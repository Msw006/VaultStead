import { resolve, join } from 'node:path';
import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'public/assets/safe');
const assets = {};
for (const name of await readdir(dir)) {
  if (name.endsWith('.webp')) assets[name] = 'data:image/webp;base64,' + (await readFile(join(dir, name))).toString('base64');
}
const sounds = join(root, 'public/assets/sound');
for (const name of await readdir(sounds)) {
  if (name.endsWith('.mp3')) assets['sound/' + name] = 'data:audio/mpeg;base64,' + (await readFile(join(sounds, name))).toString('base64');
}
let html = await readFile(join(root, 'index.html'), 'utf8');
const css = await readFile(join(root, 'dist/app.css'), 'utf8');
const js = await readFile(join(root, 'dist/app.js'), 'utf8');
const favicon = 'data:image/svg+xml;base64,' + (await readFile(join(root, 'public/favicon.svg'))).toString('base64');
html = html.replace('href="/favicon.svg"', `href="${favicon}"`);
html = html.replace('<link rel="stylesheet" href="/app.css" />', () => `<style>${css}</style>`);
html = html.replace('<script type="module" src="/app.js"></script>', () => `<script>globalThis.__VAULTSTEAD_ASSETS__=${JSON.stringify(assets)};</script>\n<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
await writeFile(join(root, 'Vaultstead.html'), html);
await copyFile(join(root, 'Vaultstead.html'), join(root, 'dist/play.html'));
console.log(`Standalone Vaultstead.html: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, all ${Object.keys(assets).length} image plates and sounds embedded.`);
