import test from 'node:test';
import assert from 'node:assert/strict';
import { DOORS, freshSave, makeRun, setNumber, signal, settle, purchase, loadSave, wrap } from '../src/game.mjs';

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
test('purchases check affordability and permanent tools cannot be bought twice', () => {
  const original = freshSave(); const bought = purchase(original, 'probe', 'tool');
  assert.equal(bought.brass, 140); assert.ok(bought.tools.includes('probe'));
  assert.equal(purchase(bought, 'probe', 'tool'), bought);
  assert.equal(purchase(bought, 'treasury', 'door'), bought);
  assert.equal(purchase(bought, 'street', 'door').doors.street, 2);
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
