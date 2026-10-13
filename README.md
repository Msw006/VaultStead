# Vaultstead

A playable, photographic safe opening game built with React 19. The safe uses registered photographic plates, a CSS door hinge, and a rotating photographic dial. It imports no Three.js or server-only code.

## Play without installation

Open `Vaultstead.html` in a browser. It contains the complete game, CSS, and all photographic assets in one file. Gameplay needs no server or internet connection; the optional Google web fonts fall back to system fonts offline. The source build also creates `dist/play.html` for testing the standalone edition.

## Play locally

```sh
npm install
npm run build
npm run dev
```

Open `http://127.0.0.1:4178`. In the current NomStead workspace, the build also reuses installed React and esbuild packages offline. Browser-local progress is saved automatically. Sound is synthesized locally after interaction.

## Mechanics

- Dial: 0–40, drag right for clockwise, Lower / Higher, then Set number. Direction alternates after each successful number. The current value moves beneath the fixed upper index.
- Electronic: digits 0–9, ember readout, then Lock digit. The signal probe adds a live signal meter.
- Three misses seize a real door. Successful opens also use one owned door. Practice is unlimited, reveals its training combination, and pays nothing.
- Most real opens pay brass. Street locker and keypad safe have a 20% gold chance. Counting-house vault: 27%; treasury safe: 32%. A gold payout contains one bar and no brass coins. A brass payout contains coins and no gold bar.
- Brass buys doors and permanent tools. Cash packs are listed and not for sale.
- New games start with 240 brass, one street door, one keypad door, and an equipped stethoscope. This is a standalone browser prototype; in-game gold is a local reward, with no on-chain transaction.

Prices and common payouts are prototype choices because no prior game repository or economy was supplied. See `src/game.mjs` for the complete definitions.

## Drop-in safe

`src/components/vault/safe-stage.tsx` keeps the requested `SafeStage` export and props. Copy that file, its CSS, and `public/assets/safe/` to the original project. Public assets are served from `/assets/safe/`. Existing DOM controls can call the component with controlled values; dial dragging invokes `onDial(value, direction)`.

The same cabinet appears in all states. `Inspect the safe` shows the closed dial door, open empty shelf, open gold shelf, keypad safe, and brass shelf, without changing inventory or awarding rewards.

## Image assets

The safe is a hybrid of the user's reference photo and written brief: a modern matte charcoal steel fire safe (single combination dial in a white bezel, lever handle, key lock, right hinge, chrome locking bolts on the door's inner left edge, no branding), photographed straight on in the brief's plaster-and-oak room on a faded red rug. All six source images were generated from one master shot, with the other five made as edits of it so the room and cabinet stay registered. The prompts are in [docs/asset-prompts.json](docs/asset-prompts.json).

- Source photographs: `assets/source/` (1152 × 864)
- Optimized runtime plates: `public/assets/safe/`
- Plate registration and WebP encoding: `scripts/prepare-assets.mjs` (requires sharp, already bundled in this workspace). `scripts/measure-plates.mjs` re-measures the door gap and each variant's pixel drift against the master.
- Room plate: the 1152 × 768 band starting at y 40.
- Door crop: x 340, y 108, width 475, height 621, shifted per source by its measured drift.
- Live dial: the black number disc, centre (592, 330), radius 53, cropped at 108 × 108 and upscaled to 256.

The room and cabinet do not move. The right-hinged door rotates as one photographed layer, with photographed locking bolts on its reverse. Loot photographs are only selected after a successful open. SVG prints white 0–40 graduations over the rotating black disc; the current value is bold under the bezel's fixed index.

## Checks

`npm test` covers alternating directions, seizures, free practice, separate gold/brass rewards, 20% and higher-tier gold thresholds, keypad rules, permanent tool purchases, affordability, value wrapping, and damaged saves. Browser verification checks the visible plate states and playable practice sequence.

Browser QA also verified a mobile rightward drag from 0 to 10 (positive 87.8° rotation), no horizontal overflow at 390px, a probe purchase (240 → 140 brass), and a complete four-digit keypad open (140 → 265 brass, one door consumed). Inspection screenshots are saved in `docs/verification/`.

## Hosted build

The Sites manifest is `.openai/hosting.json`. `dist/` contains the static application. A private Site was registered. Source upload and publication await explicit user approval because automatic approval review blocked sending the source to the external Sites repository. The local game is complete.
