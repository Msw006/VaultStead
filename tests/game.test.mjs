import test from 'node:test';
import assert from 'node:assert/strict';
import { DOORS, freshSave, makeRun, setNumber, signal, settle, purchase, loadSave, wrap, spendTool, abandon, contact, press, expire, exchange, stuck, rescue, GOLD_RATE, RESCUE_BRASS, CHEAPEST_DOOR } from '../src/game.mjs';

function finish(door, lootRoll) {
  let run = makeRun(door, () => .3);
  for (let i = 0; i < door.pins; i++) {
    run = setNumber({ ...run, value: run.targets[i], dir: i % 2 === 0 ? 1 : -1 }, door, () => lootRoll).run;
  }
  return run;
}
test('dial direction alternates, wrong direction counts as a miss', () => {
  const door = DOORS[1]; let run = makeRun(door, () => .3);
  run = setNumber({ ...run, value: run.targets[0], dir: 1 }, door).run;
  assert.equal(run.locked.length, 1);
  let failed = setNumber({ ...run, value: run.targets[1], dir: 1 }, door).run;
  assert.equal(failed.misses, 1); assert.equal(failed.locked.length, 1);
  const next = setNumber({ ...failed, value: failed.targets[1], dir: -1 }, door).run;
  assert.equal(next.locked.length, 2);
});
test('three misses seize a real door and consume exactly one owned door', () => {
  const door = DOORS[1]; let run = makeRun(door, () => .3);
  for (let i = 0; i < 3; i++) run = setNumber({ ...run, value: 0, dir: 1 }, door).run;
  assert.equal(run.status, 'seized');
  const save = settle(freshSave(), run, door);
  assert.equal(save.doors.street, 0); assert.equal(save.brass, 240); assert.equal(save.gold, 0);
  assert.equal(setNumber(run, door).outcome, 'ignored');
});
test('practice never seizes and never pays', () => {
  let run = makeRun(DOORS[0]);
  for (let i = 0; i < 10; i++) run = setNumber({ ...run, value: 0, dir: 1 }, DOORS[0]).run;
  assert.equal(run.status, 'active');
  const won = finish(DOORS[0], 0); assert.equal(won.status, 'open'); assert.equal(won.loot, 'empty');
  const save = freshSave(); assert.equal(settle(save, won, DOORS[0]), save);
});
test('street and keypad pay gold for rolls below .20; otherwise only brass', () => {
  for (const door of [DOORS[1], DOORS[2]]) {
    const gold = finish(door, .199); const brass = finish(door, .20);
    assert.equal(gold.loot, 'gold'); assert.equal(gold.reward, 1);
    assert.equal(brass.loot, 'brass'); assert.equal(brass.reward, door.brass);
    const goldSave = settle(freshSave(), gold, door);
    assert.equal(goldSave.gold, 1); assert.equal(goldSave.brass, 240);
    const brassSave = settle(freshSave(), brass, door);
    assert.equal(brassSave.gold, 0); assert.equal(brassSave.brass, 240 + door.brass);
  }
});
test('heavier doors have higher gold odds; keypad ignores turn direction', () => {
  assert.equal(finish(DOORS[3], .26).loot, 'gold'); assert.equal(finish(DOORS[4], .31).loot, 'gold');
  const run = makeRun(DOORS[2], () => .3);
  assert.equal(setNumber({ ...run, value: 3, dir: 0 }, DOORS[2]).outcome, 'pin');
});
test('purchases check affordability, and each tool bought adds one use', () => {
  const original = freshSave(); const bought = purchase(original, 'probe', 'tool');
  assert.equal(bought.brass, 210); assert.equal(bought.tools.probe, 1);
  assert.equal(purchase(bought, 'probe', 'tool').tools.probe, 2);
  assert.equal(purchase({ ...bought, brass: 20 }, 'probe', 'tool').tools.probe, 1);
  assert.equal(purchase({ ...bought, brass: 100 }, 'treasury', 'door').doors.treasury, 0);
  assert.equal(purchase(bought, 'street', 'door').doors.street, 2);
});
test('a tool is spent on one door, returned only if the attempt is left untouched, and free on practice', () => {
  const door = DOORS[1]; const save = freshSave(); const run = makeRun(door, () => .3);
  const used = spendTool(save, run, door);
  assert.equal(used.save.tools.stethoscope, 0); assert.equal(used.run.tool, 'stethoscope');
  assert.deepEqual(spendTool(used.save, used.run, door), used);
  assert.equal(abandon(used.save, used.run).tools.stethoscope, 1);
  const touched = setNumber({ ...used.run, value: 0, dir: 1 }, door).run;
  assert.equal(abandon(used.save, touched), used.save);
  const keypad = DOORS[2]; assert.equal(spendTool(save, makeRun(keypad), keypad).run.tool, null);
  const practice = spendTool(save, makeRun(DOORS[0]), DOORS[0]); assert.equal(practice.save, save);
});
test('saves from when tools were permanent turn each owned tool into one use', () => {
  const old = { ...freshSave(), tools: ['stethoscope', 'probe'] };
  assert.deepEqual(loadSave({ getItem: () => JSON.stringify(old) }).tools, { stethoscope: 1, probe: 1 });
  assert.deepEqual(loadSave({ getItem: () => JSON.stringify({ ...old, tools: { stethoscope: -1 } }) }), freshSave());
});
test('the dial tooth only sounds in the required direction, and heavier dials hide false teeth', () => {
  const street = DOORS[1], heavy = DOORS[3], royal = DOORS[6];
  const run = makeRun(street, () => .3), t = run.targets[0];
  assert.equal(contact(run, street, t, 1), 'gate'); assert.equal(contact(run, street, t, -1), null);
  assert.equal(contact(run, street, wrap(t + 1), 1), null);
  assert.equal(makeRun(heavy, () => .3).decoys[0].length, 1);
  const royalRun = makeRun(royal, () => .3);
  for (const [i, decoys] of royalRun.decoys.entries()) {
    assert.equal(decoys.length, 2); assert.ok(!decoys.includes(royalRun.targets[i]));
    const atPin = { ...royalRun, locked: royalRun.targets.slice(0, i) };
    for (const n of decoys) assert.equal(contact(atPin, royal, n, i % 2 ? -1 : 1), 'decoy');
  }
});
test('keypads show worn digits, harder keypads add false wear, and the probe reads coarsely', () => {
  for (const door of DOORS.filter(d => d.kind === 'pad')) {
    const run = makeRun(door, Math.random);
    for (const t of run.targets) assert.ok(run.worn.includes(t));
    assert.equal(run.worn.length, new Set(run.targets).size + door.worn);
  }
  const keypad = DOORS[2]; const run = { ...makeRun(keypad, () => .5), value: 5 };
  assert.equal(signal(run, keypad), 1);
  assert.equal(signal({ ...run, value: 7 }, keypad), .55);
  assert.equal(signal({ ...run, value: 8 }, keypad), .1);
});
test('gold bars exchange for brass at a fixed rate and never below zero', () => {
  const rich = { ...freshSave(), gold: 3, brass: 10 };
  const one = exchange(rich, 1); assert.equal(one.gold, 2); assert.equal(one.brass, 10 + GOLD_RATE);
  assert.equal(exchange(rich, 3).brass, 10 + 3 * GOLD_RATE);
  for (const bars of [0, -1, 4, 1.5]) assert.equal(exchange(rich, bars), rich);
});
test('free brass is offered only when the player has no door, no gold, and too little brass', () => {
  const broke = { ...freshSave(), brass: 20, doors: { street: 0, keypad: 0, heavy: 0, treasury: 0, vault: 0, royal: 0 } };
  assert.ok(stuck(broke)); assert.equal(rescue(broke).brass, 20 + RESCUE_BRASS);
  assert.ok(!stuck(rescue(broke)));
  for (const save of [{ ...broke, gold: 1 }, { ...broke, brass: CHEAPEST_DOOR }, { ...broke, doors: { ...broke.doors, keypad: 1 } }]) {
    assert.ok(!stuck(save)); assert.equal(rescue(save), save);
  }
});
test('the treasury alarm arms at the first key and seizes the door when it runs out', () => {
  const door = DOORS.find(d => d.id === 'treasury');
  let run = press(makeRun(door, () => .3), door, 3, 1000);
  assert.equal(run.deadline, 1000 + door.alarm * 1000);
  assert.equal(press(run, door, 4, 5000).deadline, run.deadline);
  assert.equal(expire(run, door, run.deadline - 1), run);
  const late = setNumber(run, door, Math.random, run.deadline);
  assert.equal(late.outcome, 'seized'); assert.equal(late.run.cause, 'alarm');
  const owned = { ...freshSave(), doors: { ...freshSave().doors, treasury: 1 } };
  const after = settle(owned, late.run, door); assert.equal(after.doors.treasury, 0); assert.equal(after.seizures, 1);
  assert.equal(press(makeRun(DOORS[2]), DOORS[2], 3, 1000).deadline, null);
});
test('0–40 values wrap in both directions and meter peaks at correct value', () => {
  assert.equal(wrap(41), 0); assert.equal(wrap(-1), 40);
  const run = { ...makeRun(DOORS[1], () => .99), value: 0 };
  assert.ok(signal(run, DOORS[1]) > .8);
  assert.equal(signal({ ...run, value: 40 }, DOORS[1]), 1);
});
test('seven tiers, each with its own safe model, get harder, pricier, and slightly richer in gold', () => {
  assert.equal(DOORS.length, 7);
  assert.equal(new Set(DOORS.map(d => d.model)).size, 7);
  const paid = DOORS.filter(d => d.cost);
  for (let i = 1; i < paid.length; i++) {
    assert.ok(paid[i].cost > paid[i - 1].cost); assert.ok(paid[i].brass > paid[i - 1].brass);
    assert.ok(paid[i].goldChance >= paid[i - 1].goldChance); assert.ok(paid[i].goldChance < .5);
  }
  const vault = DOORS.find(d => d.id === 'vault'), royal = DOORS.find(d => d.id === 'royal');
  assert.equal(finish(vault, .349).loot, 'gold'); assert.equal(finish(vault, .35).loot, 'brass');
  assert.equal(finish(royal, .379).loot, 'gold'); assert.equal(finish(royal, .38).loot, 'brass');
  assert.equal(finish(vault, .9).reward, 480); assert.equal(finish(royal, .9).reward, 650);
});
test('saves from before the vault and royal tiers keep their progress', () => {
  const old = { ...freshSave(), brass: 512, gold: 3, doors: { street: 2, keypad: 0, heavy: 1, treasury: 4 } };
  const loaded = loadSave({ getItem: () => JSON.stringify(old) });
  assert.equal(loaded.brass, 512); assert.equal(loaded.gold, 3);
  assert.deepEqual(loaded.doors, { street: 2, keypad: 0, heavy: 1, treasury: 4, vault: 0, royal: 0 });
  assert.deepEqual(loadSave({ getItem: () => JSON.stringify({ ...old, doors: { ...old.doors, royal: -2 } }) }), freshSave());
});
test('invalid saved balances, inventory, and tool data recover a fresh game', () => {
  for (const data of [{}, { ...freshSave(), brass: -1 }, { ...freshSave(), doors: null }, { ...freshSave(), tools: ['unknown'] }]) {
    assert.deepEqual(loadSave({ getItem: () => JSON.stringify(data) }), freshSave());
  }
});
