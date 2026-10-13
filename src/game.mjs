export const SAVE_KEY = 'vaultstead.workshop.v1';
export const DOORS = [
  { id: 'practice', name: 'Practice wheel', kind: 'dial', pins: 3, cost: 0, brass: 0, goldChance: 0, difficulty: 'A place to begin', short: 'Practice', description: 'Learn the turn. Nothing to lose, nothing to earn.' },
  { id: 'street', name: 'Street locker', kind: 'dial', pins: 3, cost: 70, brass: 100, goldChance: .20, difficulty: 'Three-number combination', short: 'Street', description: 'An old iron door. A good ear goes a long way.' },
  { id: 'keypad', name: 'Keypad safe', kind: 'pad', pins: 4, cost: 90, brass: 125, goldChance: .20, difficulty: 'Four-digit combination', short: 'Keypad', description: 'Old iron. New wiring. Follow the ember.' },
  { id: 'heavy', name: 'Counting-house vault', kind: 'dial', pins: 4, cost: 180, brass: 250, goldChance: .27, difficulty: 'Four-number combination', short: 'Heavy', description: 'A heavier door with a little more waiting inside.' },
  { id: 'treasury', name: 'Treasury safe', kind: 'pad', pins: 5, cost: 260, brass: 350, goldChance: .32, difficulty: 'Five-digit combination', short: 'Treasury', description: 'Five tumblers. One quiet moment of triumph.' },
];
export const TOOLS = [
  { id: 'stethoscope', name: 'Stethoscope', cost: 120, description: 'Hear a dial tumbler settle. Adds a live listening meter.' },
  { id: 'probe', name: 'Signal probe', cost: 100, description: 'Read the strength of an electronic lock’s signal.' },
];
export function freshSave() { return { version: 1, brass: 240, gold: 0, doors: { street: 1, keypad: 1, heavy: 0, treasury: 0 }, tools: ['stethoscope'], opens: 0, seizures: 0, history: [] }; }
export function loadSave(storage) {
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY));
    if (data?.version !== 1 || !Number.isSafeInteger(data.brass) || data.brass < 0 || !Number.isSafeInteger(data.gold) || data.gold < 0) return freshSave();
    if (!data.doors || DOORS.filter(d => d.cost).some(d => !Number.isSafeInteger(data.doors[d.id]) || data.doors[d.id] < 0)) return freshSave();
    if (!Array.isArray(data.tools) || data.tools.some(t => !TOOLS.some(tool => tool.id === t))) return freshSave();
    return { ...freshSave(), ...data, history: Array.isArray(data.history) ? data.history.slice(0, 12) : [] };
  } catch { return freshSave(); }
}
export const wrap = (value, size = 41) => ((value % size) + size) % size;
export function makeRun(door, random = Math.random) {
  return { doorId: door.id, targets: door.id === 'practice' ? [12, 28, 7] : Array.from({ length: door.pins }, () => Math.floor(random() * (door.kind === 'dial' ? 41 : 10))), value: door.kind === 'dial' ? 0 : -1, locked: [], misses: 0, dir: 0, status: 'active', loot: 'empty', reward: 0, clue: '', rounds: 0 };
}
export function signal(run, door) {
  if (run.status !== 'active' || run.value < 0) return 0;
  const diff = Math.abs(run.targets[run.locked.length] - run.value);
  const distance = door.kind === 'dial' ? Math.min(diff, 41 - diff) : diff;
  return Math.max(0, 1 - distance / (door.kind === 'dial' ? 9 : 5));
}
export function setNumber(run, door, random = Math.random) {
  if (run.status !== 'active' || run.value < 0) return { run, outcome: 'ignored' };
  const target = run.targets[run.locked.length];
  const requiredDirection = run.locked.length % 2 === 0 ? 1 : -1;
  const correctDirection = door.kind === 'pad' || run.dir === requiredDirection;
  if (run.value !== target || !correctDirection) {
    const misses = run.misses + 1;
    return { run: { ...run, misses, status: misses >= 3 && door.id !== 'practice' ? 'seized' : 'active', clue: !correctDirection ? 'The direction was wrong. Follow the turn arrow.' : 'The tumbler slipped. Listen for the strongest signal.', dir: 0, rounds: run.rounds + 1 }, outcome: misses >= 3 && door.id !== 'practice' ? 'seized' : 'miss' };
  }
  const locked = [...run.locked, run.value];
  if (locked.length < door.pins) return { run: { ...run, locked, dir: 0, value: door.kind === 'pad' ? -1 : run.value, clue: 'A quiet click. The next tumbler is waiting.', rounds: run.rounds + 1 }, outcome: 'pin' };
  const loot = door.id === 'practice' ? 'empty' : random() < door.goldChance ? 'gold' : 'brass';
  return { run: { ...run, locked, status: 'open', loot, reward: loot === 'brass' ? door.brass : loot === 'gold' ? 1 : 0, clue: '', rounds: run.rounds + 1 }, outcome: 'open' };
}
export function settle(save, run, door) {
  if (door.id === 'practice') return save;
  if (!['open', 'seized'].includes(run.status) || save.doors[door.id] < 1) return save;
  const won = run.status === 'open';
  return { ...save, doors: { ...save.doors, [door.id]: save.doors[door.id] - 1 }, brass: save.brass + (won && run.loot === 'brass' ? run.reward : 0), gold: save.gold + (won && run.loot === 'gold' ? 1 : 0), opens: save.opens + Number(won), seizures: save.seizures + Number(!won), history: [{ door: door.name, status: run.status, loot: run.loot, amount: run.reward, date: new Date().toISOString() }, ...save.history].slice(0, 12) };
}
export function purchase(save, id, category) {
  const item = (category === 'tool' ? TOOLS : DOORS).find(i => i.id === id);
  if (!item || !item.cost || save.brass < item.cost || (category === 'tool' && save.tools.includes(id))) return save;
  return category === 'tool' ? { ...save, brass: save.brass - item.cost, tools: [...save.tools, id] } : { ...save, brass: save.brass - item.cost, doors: { ...save.doors, [id]: save.doors[id] + 1 } };
}
