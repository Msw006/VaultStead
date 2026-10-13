export const SAVE_KEY = 'vaultstead.workshop.v1';
// reach: how far the tool reading carries. decoys: false teeth per dial number. worn: falsely worn keys. alarm: seconds after the first key press.
export const DOORS = [
  { id: 'practice', model: 'practice', name: 'Practice wheel', kind: 'dial', pins: 3, cost: 0, brass: 0, goldChance: 0, reach: 9, decoys: 0, difficulty: 'A place to begin', short: 'Practice', description: 'Learn the turn. Nothing to lose, nothing to earn.' },
  { id: 'street', model: 'street', name: 'Street locker', kind: 'dial', pins: 3, cost: 70, brass: 100, goldChance: .20, reach: 6, decoys: 0, difficulty: 'Three-number combination', short: 'Street', description: 'An old iron door. A good ear goes a long way.' },
  { id: 'keypad', model: 'keypad', name: 'Keypad safe', kind: 'pad', pins: 4, cost: 90, brass: 125, goldChance: .20, reach: 2, worn: 0, alarm: 0, difficulty: 'Four-digit combination', short: 'Keypad', description: 'Old iron. New wiring. Follow the ember.' },
  { id: 'heavy', model: 'heavy', name: 'Counting-house vault', kind: 'dial', pins: 4, cost: 180, brass: 250, goldChance: .27, reach: 4, decoys: 1, difficulty: 'Four-number combination', short: 'Heavy', description: 'A heavier door with a little more waiting inside.' },
  { id: 'treasury', model: 'treasury', name: 'Treasury safe', kind: 'pad', pins: 5, cost: 260, brass: 350, goldChance: .32, reach: 1, worn: 1, alarm: 90, difficulty: 'Five-digit combination', short: 'Treasury', description: 'Five tumblers. One quiet moment of triumph.' },
  { id: 'vault', model: 'vault', name: 'Bank vault', kind: 'pad', pins: 6, cost: 360, brass: 480, goldChance: .35, reach: 1, worn: 2, alarm: 75, difficulty: 'Six-digit combination', short: 'Vault', description: 'Round steel, six digits, and a long quiet corridor behind it.' },
  { id: 'royal', model: 'royal', name: 'Royal strongbox', kind: 'dial', pins: 5, cost: 480, brass: 650, goldChance: .38, reach: 3, decoys: 2, difficulty: 'Five-number combination', short: 'Royal', description: 'Gilt and lacquer. Five patient turns for the finest ear.' },
];
export const TOOLS = [
  { id: 'stethoscope', name: 'Stethoscope', cost: 35, description: 'One dial door. The true tumbler lands as a deep thunk, and the listening meter lights.' },
  { id: 'probe', name: 'Signal probe', cost: 30, description: 'One keypad door. Reads each key as cold, warm, or locked on.' },
];
export const toolFor = door => door.kind === 'dial' ? 'stethoscope' : 'probe';
export function freshSave() { return { version: 1, brass: 240, gold: 0, doors: { street: 1, keypad: 1, heavy: 0, treasury: 0, vault: 0, royal: 0 }, tools: { stethoscope: 1, probe: 0 }, opens: 0, seizures: 0, history: [] }; }
export function loadSave(storage) {
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY));
    if (data?.version !== 1 || !Number.isSafeInteger(data.brass) || data.brass < 0 || !Number.isSafeInteger(data.gold) || data.gold < 0) return freshSave();
    if (!data.doors || typeof data.doors !== 'object') return freshSave();
    // Saves from before a tier existed simply own none of that door.
    const doors = Object.fromEntries(DOORS.filter(d => d.cost).map(d => [d.id, data.doors[d.id] ?? 0]));
    if (Object.values(doors).some(n => !Number.isSafeInteger(n) || n < 0)) return freshSave();
    // Saves from when tools were permanent hold a list; each owned tool becomes one use.
    if (Array.isArray(data.tools) ? data.tools.some(t => !TOOLS.some(tool => tool.id === t)) : !data.tools || typeof data.tools !== 'object') return freshSave();
    const tools = Object.fromEntries(TOOLS.map(t => [t.id, Array.isArray(data.tools) ? Number(data.tools.includes(t.id)) : data.tools[t.id] ?? 0]));
    if (Object.values(tools).some(n => !Number.isSafeInteger(n) || n < 0)) return freshSave();
    return { ...freshSave(), ...data, doors, tools, history: Array.isArray(data.history) ? data.history.slice(0, 12) : [] };
  } catch { return freshSave(); }
}
export const wrap = (value, size = 41) => ((value % size) + size) % size;
export function makeRun(door, random = Math.random) {
  const targets = door.id === 'practice' ? [12, 28, 7] : Array.from({ length: door.pins }, () => Math.floor(random() * (door.kind === 'dial' ? 41 : 10)));
  const run = { doorId: door.id, targets, value: door.kind === 'dial' ? 0 : -1, locked: [], misses: 0, dir: 0, status: 'active', cause: '', loot: 'empty', reward: 0, clue: '', rounds: 0, tool: null, deadline: null };
  if (door.kind === 'dial') return { ...run, decoys: targets.map(t => Array.from({ length: door.decoys }, (_, k) => wrap(t + (k % 2 ? -1 : 1) * (3 + Math.floor(random() * 8))))) };
  const spare = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !targets.includes(n));
  const fakes = Array.from({ length: door.worn }, () => spare.splice(Math.floor(random() * spare.length), 1)[0]);
  return { ...run, worn: [...new Set([...targets, ...fakes])].sort((a, b) => a - b) };
}
export function signal(run, door) {
  if (run.status !== 'active' || run.value < 0) return 0;
  const step = n => { const diff = Math.abs(n - run.value); return door.kind === 'dial' ? Math.min(diff, 41 - diff) : diff; };
  const distance = step(run.targets[run.locked.length]);
  if (door.kind === 'pad') return distance === 0 ? 1 : distance <= door.reach ? .55 : .1;
  const falloff = d => Math.max(0, 1 - d / door.reach);
  return Math.max(falloff(distance), ...run.decoys[run.locked.length].map(n => .7 * falloff(step(n))));
}
/** What the dial makes at `value` when turned in `dir`: the true tooth, a false tooth, or nothing. */
export function contact(run, door, value, dir) {
  if (door.kind !== 'dial' || run.status !== 'active') return null;
  const i = run.locked.length;
  if (dir !== (i % 2 === 0 ? 1 : -1)) return null;
  return value === run.targets[i] ? 'gate' : run.decoys[i].includes(value) ? 'decoy' : null;
}
export function expire(run, door, now = Date.now()) {
  if (run.status !== 'active' || !run.deadline || now < run.deadline) return run;
  return { ...run, status: 'seized', cause: 'alarm', clue: '' };
}
/** A key press on a safe with an alarm arms it. */
export function press(run, door, value, now = Date.now()) {
  if (run.status !== 'active') return run;
  return { ...run, value, dir: 1, clue: '', deadline: run.deadline ?? (door.alarm ? now + door.alarm * 1000 : null) };
}
export function setNumber(run, door, random = Math.random, now = Date.now()) {
  const expired = expire(run, door, now);
  if (expired !== run) return { run: expired, outcome: 'seized' };
  if (run.status !== 'active' || run.value < 0) return { run, outcome: 'ignored' };
  const target = run.targets[run.locked.length];
  const requiredDirection = run.locked.length % 2 === 0 ? 1 : -1;
  const correctDirection = door.kind === 'pad' || run.dir === requiredDirection;
  if (run.value !== target || !correctDirection) {
    const misses = run.misses + 1;
    const seized = misses >= 3 && door.id !== 'practice';
    return { run: { ...run, misses, status: seized ? 'seized' : 'active', cause: seized ? 'misses' : '', clue: !correctDirection ? 'The direction was wrong. Follow the turn arrow.' : 'The tumbler slipped. Listen for the strongest signal.', dir: 0, rounds: run.rounds + 1 }, outcome: seized ? 'seized' : 'miss' };
  }
  const locked = [...run.locked, run.value];
  if (locked.length < door.pins) return { run: { ...run, locked, dir: 0, value: door.kind === 'pad' ? -1 : run.value, clue: 'A quiet click. The next tumbler is waiting.', rounds: run.rounds + 1 }, outcome: 'pin' };
  const loot = door.id === 'practice' ? 'empty' : random() < door.goldChance ? 'gold' : 'brass';
  return { run: { ...run, locked, status: 'open', loot, reward: loot === 'brass' ? door.brass : loot === 'gold' ? 1 : 0, clue: '', rounds: run.rounds + 1 }, outcome: 'open' };
}
/** Spends one tool on this attempt. The practice wheel lends its tools for free. */
export function spendTool(save, run, door) {
  const id = toolFor(door);
  if (run.status !== 'active' || run.tool || door.id === 'practice' || save.tools[id] < 1) return { save, run };
  return { save: { ...save, tools: { ...save.tools, [id]: save.tools[id] - 1 } }, run: { ...run, tool: id } };
}
/** Leaving an untouched attempt hands its tool back. */
export function abandon(save, run) {
  if (!run.tool || run.status !== 'active' || run.locked.length || run.misses) return save;
  return { ...save, tools: { ...save.tools, [run.tool]: save.tools[run.tool] + 1 } };
}
export function settle(save, run, door) {
  if (door.id === 'practice') return save;
  if (!['open', 'seized'].includes(run.status) || save.doors[door.id] < 1) return save;
  const won = run.status === 'open';
  return { ...save, doors: { ...save.doors, [door.id]: save.doors[door.id] - 1 }, brass: save.brass + (won && run.loot === 'brass' ? run.reward : 0), gold: save.gold + (won && run.loot === 'gold' ? 1 : 0), opens: save.opens + Number(won), seizures: save.seizures + Number(!won), history: [{ door: door.name, status: run.status, loot: run.loot, amount: run.reward, date: new Date().toISOString() }, ...save.history].slice(0, 12) };
}
export function purchase(save, id, category) {
  const item = (category === 'tool' ? TOOLS : DOORS).find(i => i.id === id);
  if (!item || !item.cost || save.brass < item.cost) return save;
  return category === 'tool' ? { ...save, brass: save.brass - item.cost, tools: { ...save.tools, [id]: save.tools[id] + 1 } } : { ...save, brass: save.brass - item.cost, doors: { ...save.doors, [id]: save.doors[id] + 1 } };
}
