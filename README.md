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
- Dial sound: every step ticks. Turning in the required direction, the true tooth clicks duller. The heavy safe hides one false tooth per number and the royal safe two; by ear they sound the same as the true one. With a stethoscope, the true tooth is a deep thunk, false teeth a hollow clack, and the listening meter lights (false teeth peak at 70%).
- Electronic: digits 0–9, ember readout, then Enter digit. Worn keys show the digits in the code; the treasury adds one falsely worn key and the bank vault two. Their alarms arm at the first key press (treasury 90 s, bank vault 75 s) and seize the door when they run out. The signal probe reads each key as cold, warm, or locked on; warm reaches two digits on the keypad safe and one on the treasury and bank vault.
- Tools are single-use: a stethoscope or probe is spent on one door attempt, and handed back if you leave the attempt before setting a number or missing. Stethoscope 35 brass, probe 30. The practice safe lends its tools free.
- Three misses seize a real door. Successful opens also use one owned door. Practice is unlimited, can show its answer on request, and pays nothing.
- Seven safes, each with its own photographed cabinet, rise in difficulty, price, and gold chance:

  | Tier | Lock | Door cost | Brass payout | Gold chance |
  |---|---|---|---|---|
  | Practice safe | 3-number dial | free | none | none |
  | Street safe | 3-number dial (twin dials) | 70 | 100 | 20% |
  | Keypad safe | 4 digits | 90 | 125 | 20% |
  | Heavy safe | 4-number dial | 180 | 250 | 27% |
  | Treasury safe | 5 digits | 260 | 350 | 32% |
  | Bank vault | 6 digits (round door) | 360 | 480 | 35% |
  | Royal safe | 5-number dial | 480 | 650 | 38% |

- Most real opens pay brass. A gold payout contains one bar and no brass coins. A brass payout contains coins and no gold bar.
- Brass buys doors and single-use tools in the Shop. Every purchase asks for confirmation and shows the balance before and after. Clicking a safe you do not own shows it in the workshop with its price and a buy button, instead of switching pages. Cash packs are listed and not for sale.
- New games start with 240 brass, one street door, one keypad door, and one stethoscope. Saves from before the bank vault and royal safe load with zero doors for those tiers, and saves from when tools were permanent get one use of each tool they owned. This is a standalone browser prototype; in-game gold is a local reward, with no on-chain transaction.

Prices and common payouts are prototype choices because no prior game repository or economy was supplied. See `src/game.mjs` for the complete definitions.

## Drop-in safe

`src/components/vault/safe-stage.tsx` keeps the requested `SafeStage` export and props, plus an optional `model` prop (`practice`, `street`, `keypad`, `heavy`, `treasury`, `vault`, `royal`). Without it, dial safes use `heavy` and keypads use `keypad`. Copy that file, `safe-models.json`, its CSS, and `public/assets/safe/` to the original project. Public assets are served from `/assets/safe/`. Existing DOM controls can call the component with controlled values; dial dragging invokes `onDial(value, direction)`.

`See all safes` shows every tier closed and open, without changing inventory or awarding rewards.

## Image assets

Each tier is a different photographed safe, shot straight on:

- Practice safe: a small cream enamel box with a dial and a bail handle, on a workbench.
- Street safe: an antique riveted iron safe with twin dials and a spoked wheel.
- Keypad safe: a green Victorian safe with gilt lining, a keypad, and a brass spoke handle.
- Heavy safe: a modern charcoal fire safe with a single dial and a lever handle.
- Treasury safe: a tall black steel safe with a brass keypad and a chrome spoke handle.
- Bank vault: a round brushed-steel vault door with a keypad and a three-spoke wheel.
- Royal safe: a red lacquered cabinet with gilt scrollwork and a gilt dial, on claw feet.

Every model has one master closed shot. The interior, the gold and brass shelves, and the inside face of the door were made as edits of that master, so the room and cabinet stay registered. The prompts are in [docs/asset-prompts.json](docs/asset-prompts.json).

- Source photographs: `assets/source/<model>/` (1152 × 864; street is 1536 × 1024)
- Optimized runtime plates: `public/assets/safe/<model>-*.webp`
- Plate registration and WebP encoding: `scripts/prepare-assets.mjs` (requires sharp, already bundled in this workspace). It holds each model's band, door crop, dial or readout position, and per-variant drift, and writes `src/components/vault/safe-models.json` for the component.
- `scripts/measure-plates.mjs [model...]` re-measures door edges, dial circles, and each variant's pixel drift against the master, and writes overlay images to the temp folder.

The room and cabinet do not move. Each door rotates on its own hinge as one photographed layer, with its photographed inside face on the reverse. The bank vault door is clipped to a circle. Loot photographs are only selected after a successful open. Dial safes print 0–40 graduations in a style that matches each bezel over the rotating disc, and the current value is bold under the fixed index. Keypad safes show the current digit in their own readout window.

## Checks

`npm test` covers alternating directions, seizures, free practice, separate gold/brass rewards, 20% and higher-tier gold thresholds, keypad rules, single-use tools and refunds, dial teeth and false teeth, worn keys, coarse probe readings, the alarm, affordability, value wrapping, damaged saves, the seven-tier progression, and migration of older saves. Browser verification checks the visible plate states and playable practice sequence.

Browser QA also verified a mobile rightward drag from 0 to 10 (positive 87.8° rotation), no horizontal overflow at 390px, a probe purchase (240 → 140 brass), and a complete four-digit keypad open (140 → 265 brass, one door consumed). For the seven-tier set, it verified every closed and open plate, the six-slot bank vault combination and readout, and a rightward royal dial drag from 0 to 10. Inspection screenshots are saved in `docs/verification/`.

## Hosted build

The Sites manifest is `.openai/hosting.json`. `dist/` contains the static application. A private Site was registered. Source upload and publication await explicit user approval because automatic approval review blocked sending the source to the external Sites repository. The local game is complete.
