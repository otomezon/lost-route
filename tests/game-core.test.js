const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game-core.js');

function fresh(starter = 'bulbasaur') {
  return G.createAdventure('テスト主人公', starter, new Date('2026-11-03T00:00:00.000Z'));
}
function active(state) { return state.adventure.pokemonRecords[state.adventure.party[0]]; }
function boxMon(state, options = {}) {
  const mon = G.createCreature(options.speciesId || 'pidgey', options.level || 6, {
    membership: 'box', currentHP: options.currentHP, status: options.status || null,
    joinedAt: '2026-11-03T00:01:00.000Z'
  });
  G.registerCreature(state, mon, 'box');
  return mon;
}

test('initial save creates one level-5 starter and valid schema', () => {
  const state = fresh();
  assert.equal(active(state).level, 5);
  assert.equal(state.adventure.party.length, 1);
  assert.equal(state.adventure.graveyard.length, 0);
  assert.equal(G.assertValidSave(state), true);
});

test('HP zero through the shared damage function permanently moves a creature to graveyard', () => {
  const state = fresh();
  const mon = active(state);
  const outcome = G.applyDamage(state, mon.id, mon.currentHP + 100, {
    cause: '自爆技による反動', location: '１ばんどうろ', at: '2026-11-03T01:00:00.000Z'
  });
  assert.equal(outcome.died, true);
  assert.equal(mon.alive, false);
  assert.equal(mon.currentHP, 0);
  assert.equal(mon.membership, 'graveyard');
  assert.deepEqual(state.adventure.party, []);
  assert.deepEqual(state.adventure.graveyard, [mon.id]);
  const second = G.applyDamage(state, mon.id, 99, { cause: '再ダメージ' });
  assert.equal(second.applied, 0);
  assert.equal(state.adventure.graveyard.length, 1);
  assert.equal(G.moveToParty(state, mon.id, true).ok, false);
});

test('field poison reaching zero uses the same permanent-death path and triggers wipe', () => {
  const state = fresh();
  const mon = active(state);
  mon.currentHP = 1;
  mon.status = 'poison';
  state.adventure.location = { mapId: 'town', x: 5, y: 5 };
  G.movePlayer(state, -1, 0, () => 0.99);
  G.movePlayer(state, 0, -1, () => 0.99);
  G.movePlayer(state, 1, 0, () => 0.99);
  assert.equal(mon.alive, false);
  assert.equal(state.adventure.graveyard.includes(mon.id), true);
  assert.equal(state.adventure.recoveryState, 'starter_select');
  assert.equal(state.adventure.wipeCount, 1);
});

test('wipe with a living box member halves money, retains items and boxed HP/status, and requires manual rebuild', () => {
  const state = fresh();
  const a = state.adventure;
  const doomed = active(state);
  const reserve = boxMon(state, { currentHP: 7, status: 'poison' });
  a.money = 3001;
  a.inventory = { potion: 4, pokeball: 8 };
  G.applyDamage(state, doomed.id, doomed.currentHP, { cause: '毒', location: '道路' });
  assert.equal(G.processWipe(state, '2026-11-03T02:00:00.000Z'), true);
  assert.equal(a.wipeCount, 1);
  assert.equal(a.money, 1500);
  assert.deepEqual(a.inventory, { potion: 4, pokeball: 8 });
  assert.equal(a.recoveryState, 'box_rebuild');
  assert.equal(a.party.length, 0);
  assert.equal(reserve.currentHP, 7);
  assert.equal(reserve.status, 'poison');
  assert.equal(G.moveToParty(state, reserve.id, false).ok, false);
  a.location = { mapId: 'town', x: 8, y: 2 };
  assert.equal(G.moveToParty(state, reserve.id, true).ok, true);
  assert.deepEqual(a.party, [reserve.id]);
  assert.equal(a.recoveryState, 'none');
  assert.equal(reserve.currentHP, 7);
  assert.equal(reserve.status, 'poison');
  assert.equal(G.assertValidSave(state), true);
});

test('box-rebuild state permits safe movement to the facility but blocks wild encounters', () => {
  const state = fresh();
  const a = state.adventure;
  const doomed = active(state);
  boxMon(state);
  G.applyDamage(state, doomed.id, doomed.currentHP);
  G.processWipe(state);
  a.location = { mapId: 'town', x: 5, y: 5 };
  const moved = G.movePlayer(state, 1, 0, () => 0);
  assert.equal(moved.ok, true);
  assert.equal(a.activeBattle, null);
  assert.equal(a.recoveryState, 'box_rebuild');
});

test('wipe with no living box member offers a new level-5 starter and preserves long-term progress', () => {
  const state = fresh('charmander');
  const a = state.adventure;
  const doomed = active(state);
  a.money = 999;
  a.inventory.potion = 2;
  a.badges.push('boulder');
  a.storyFlags.gym1Defeated = true;
  a.pokedex.pidgey = { seen: true, caught: false, firstSeenAt: '2026-11-03T00:01:00.000Z', caughtAt: null };
  a.playTimeMs = 123456;
  const oldCount = Object.keys(a.pokemonRecords).length;
  G.applyDamage(state, doomed.id, doomed.currentHP);
  G.processWipe(state);
  assert.equal(a.money, 499);
  assert.equal(a.recoveryState, 'starter_select');
  assert.equal(G.selectNewStarter(state, 'squirtle').level, 5);
  assert.equal(a.party.length, 1);
  assert.equal(a.pokemonRecords[a.party[0]].level, 5);
  assert.equal(a.wipeCount, 1);
  assert.deepEqual(a.badges, ['boulder']);
  assert.equal(a.storyFlags.gym1Defeated, true);
  assert.equal(a.pokedex.pidgey.seen, true);
  assert.equal(a.inventory.potion, 2);
  assert.equal(a.playTimeMs, 123456);
  assert.equal(a.graveyard.length, 1);
  assert.equal(Object.keys(a.pokemonRecords).length, oldCount + 1);
  assert.equal(G.assertValidSave(state), true);
});

test('rest is restricted to designated locations and heals only the party', () => {
  const state = fresh();
  const a = state.adventure;
  const starter = active(state);
  const reserve = boxMon(state, { currentHP: 4, status: 'poison' });
  starter.currentHP = 1;
  starter.status = 'poison';
  assert.equal(G.rest(state, 'town').ok, false, 'no rest on an arbitrary town tile');
  a.location = { mapId: 'town', x: 3, y: 2 };
  const result = G.rest(state, 'town');
  assert.equal(result.ok, true);
  assert.equal(starter.currentHP, starter.maxHP);
  assert.equal(starter.status, null);
  assert.equal(reserve.currentHP, 4);
  assert.equal(reserve.status, 'poison');
  assert.equal(a.lastRestTownId, 'town');
  a.location = { mapId: 'route', x: 10, y: 6 };
  G.rest(state, 'camp');
  assert.equal(a.lastRestTownId, 'town', 'camp must not update the return town');
});

test('box transfers require the facility and cannot leave a normal adventure with an empty party', () => {
  const state = fresh();
  const a = state.adventure;
  const reserve = boxMon(state);
  assert.equal(G.moveToParty(state, reserve.id, false).ok, false);
  a.location = { mapId: 'town', x: 8, y: 2 };
  assert.equal(G.moveToParty(state, reserve.id, true).ok, true);
  const first = a.party[0];
  assert.equal(G.moveToBox(state, first, true).ok, true);
  assert.equal(G.moveToBox(state, reserve.id, true).ok, false);
  assert.equal(a.party.length, 1);
});

test('successful capture adds a unique lifetime record and Pokédex entry', () => {
  const state = fresh();
  const a = state.adventure;
  a.inventory.pokeball = 1;
  assert.equal(G.startEncounter(state, 'rattata', 3), true);
  const result = G.resolveBattleAction(state, { type: 'throw' }, { rng: () => 0 });
  assert.ok(result.caughtId);
  assert.equal(a.activeBattle, null);
  assert.equal(a.pendingNicknameId, result.caughtId);
  const caught = a.pokemonRecords[result.caughtId];
  assert.equal(caught.speciesId, 'rattata');
  assert.equal(caught.alive, true);
  assert.equal(caught.lifetimeEvents[0].type, 'joined');
  assert.equal(a.pokedex.rattata.caught, true);
  assert.equal(a.inventory.pokeball, 0);
  assert.equal(G.assertValidSave(state), true);
});

test('failed escape gives the wild opponent a turn; HP zero during that turn is permanent', () => {
  const state = fresh();
  const a = state.adventure;
  const mon = active(state);
  mon.currentHP = 1;
  assert.equal(G.startEncounter(state, 'pidgey', 20), true);
  // 0.99 fails the escape roll and selects Quick Attack; following zeroes hit and maximize damage.
  const values = [0.99, 0.99, 0, 0];
  let index = 0;
  const result = G.resolveBattleAction(state, { type: 'run' }, { rng: () => values[index++] ?? 0 });
  assert.equal(result.ok, true);
  assert.equal(mon.alive, false);
  assert.equal(a.graveyard.includes(mon.id), true);
  assert.equal(a.recoveryState, 'starter_select');
  assert.equal(a.wipeCount, 1);
});


test('one-time fixed encounter is consumed at first encounter and outcome persists', () => {
  const state = fresh();
  const a = state.adventure;
  assert.equal(G.canTriggerFixedEncounter(state, 'shrine-guardian'), true);
  assert.equal(G.startFixedEncounter(state, 'shrine-guardian', 'pikachu', 8), true);
  assert.equal(G.canTriggerFixedEncounter(state, 'shrine-guardian'), false);
  // A failed capture attempt leaves the same battle active; the fixed encounter is still consumed.
  a.inventory.pokeball = 1;
  const failed = G.resolveBattleAction(state, { type: 'throw' }, { rng: () => 0.99 });
  assert.equal(failed.ok, true);
  assert.equal(a.encounterFlags['shrine-guardian'].noRespawn, true);
  assert.equal(G.startFixedEncounter(state, 'shrine-guardian', 'pikachu', 8), false);
  // Resolve the current battle by escaping; the terminal outcome is stored.
  const escaped = G.resolveBattleAction(state, { type: 'run' }, { rng: () => 0 });
  assert.equal(escaped.escaped, true);
  assert.equal(a.encounterFlags['shrine-guardian'].outcome, 'escaped');
  assert.equal(G.assertValidSave(state), true);
});

test('backup round-trips and malformed/inconsistent saves are rejected', () => {
  const state = fresh();
  const backup = G.makeBackup(state, '2026-11-03T03:00:00.000Z');
  const parsed = G.parseBackup(JSON.stringify(backup));
  assert.equal(parsed.format, 'hardcore-rpg-backup');
  assert.equal(parsed.state.adventure.playerName, 'テスト主人公');
  const bad = JSON.parse(JSON.stringify(backup));
  bad.state.adventure.graveyard.push(bad.state.adventure.party[0]);
  assert.throws(() => G.parseBackup(bad), /複数の所属先/);
  assert.throws(() => G.parseBackup({ format: 'wrong', schemaVersion: 1, state }), /対応していません/);
});

test('zero-HP living records and mismatched memberships are rejected by integrity validation', () => {
  const state = fresh();
  const mon = active(state);
  mon.currentHP = 0;
  assert.throws(() => G.assertValidSave(state), /生存状態と所属が一致/);
});
