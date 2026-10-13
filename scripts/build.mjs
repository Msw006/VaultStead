import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, copyFile, cp } from 'node:fs/promises';

const root = resolve(import.meta.dirname, '..');
// Existing workspace dependencies are used offline; a fresh checkout uses npm install.
const searchPaths = [root, resolve(root, '../../guild-dashboard'), resolve(root, '../imagegen/guild-card-poc/pack-opening-3d')];
function findPackage(name) {
  for (const dir of searchPaths) {
    try { return createRequire(join(dir, 'package.json')).resolve(name); } catch { /* try next installed package */ }
  }
  throw new Error(`Missing ${name}. Run npm install in ${root}.`);
}
const { build } = createRequire(join(root, 'package.json'))(findPackage('esbuild'));
const nodePaths = searchPaths.map(dir => join(dir, 'node_modules')).filter(existsSync);
await mkdir(join(root, 'dist'), { recursive: true });
await build({ entryPoints: [join(root, 'src/main.jsx')], bundle: true, outdir: join(root, 'dist'), entryNames: 'app', assetNames: 'assets/[name]-[hash]', format: 'esm', platform: 'browser', jsx: 'automatic', nodePaths, minify: true, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info' });
await copyFile(join(root, 'index.html'), join(root, 'dist/index.html'));
await cp(join(root, 'public'), join(root, 'dist'), { recursive: true });
console.log('Built Vaultstead in dist/');
await import('./single-file.mjs');
