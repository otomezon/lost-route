/* Hardcore RPG domain engine. No third-party runtime dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HardcoreGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SAVE_SCHEMA_VERSION = 1;
  const PARTY_LIMIT = 6;
  const STARTER_IDS = ['bulbasaur', 'charmander', 'squirtle'];

  const MOVES = {
    tackle: { id: 'tackle', name: 'たいあたり', type: 'normal', power: 40, accuracy: 0.95 },
    vine_whip: { id: 'vine_whip', name: 'つるのムチ', type: 'grass', power: 45, accuracy: 0.95 },
    razor_leaf: { id: 'razor_leaf', name: 'はっぱカッター', type: 'grass', power: 55, accuracy: 0.95 },
    ember: { id: 'ember', name: 'ひのこ', type: 'fire', power: 40, accuracy: 1 },
    water_gun: { id: 'water_gun', name: 'みずでっぽう', type: 'water', power: 40, accuracy: 1 },
    bubble: { id: 'bubble', name: 'あわ', type: 'water', power: 35, accuracy: 1 },
    gust: { id: 'gust', name: 'かぜおこし', type: 'flying', power: 40, accuracy: 1 },
    quick_attack: { id: 'quick_attack', name: 'でんこうせっか', type: 'normal', power: 40, accuracy: 1, priority: 1 },
    poison_sting: { id: 'poison_sting', name: 'どくばり', type: 'poison', power: 15, accuracy: 1, poisonChance: 0.25 },
    string_shot: { id: 'string_shot', name: 'いとをはく', type: 'bug', power: 0, accuracy: 0.95, debuff: 'speed' },
    growl: { id: 'growl', name: 'なきごえ', type: 'normal', power: 0, accuracy: 1, debuff: 'attack' },
    thunder_shock: { id: 'thunder_shock', name: 'でんきショック', type: 'electric', power: 40, accuracy: 1, poisonChance: 0 }
  };

  // The first slice uses a small, data-driven sample roster. Expand the data table for the full game.
  const SPECIES = {
    bulbasaur: { id: 'bulbasaur', name: 'フシギダネ', type: 'grass', secondaryType: 'poison', color: '#71a86b', baseHP: 45, baseAttack: 49, baseDefense: 49, baseSpeed: 45, catchRate: 0.35, moves: ['tackle', 'growl', 'vine_whip', 'razor_leaf'] },
    charmander: { id: 'charmander', name: 'ヒトカゲ', type: 'fire', color: '#dc865b', baseHP: 39, baseAttack: 52, baseDefense: 43, baseSpeed: 65, catchRate: 0.35, moves: ['scratch', 'growl', 'ember', 'quick_attack'] },
    squirtle: { id: 'squirtle', name: 'ゼニガメ', type: 'water', color: '#70a7c8', baseHP: 44, baseAttack: 48, baseDefense: 65, baseSpeed: 43, catchRate: 0.35, moves: ['tackle', 'bubble', 'water_gun', 'growl'] },
    pidgey: { id: 'pidgey', name: 'ポッポ', type: 'normal', secondaryType: 'flying', color: '#b8a17a', baseHP: 40, baseAttack: 45, baseDefense: 40, baseSpeed: 56, catchRate: 0.7, moves: ['tackle', 'gust', 'quick_attack'] },
    rattata: { id: 'rattata', name: 'コラッタ', type: 'normal', color: '#9a7b9d', baseHP: 30, baseAttack: 56, baseDefense: 35, baseSpeed: 72, catchRate: 0.72, moves: ['tackle', 'quick_attack', 'growl'] },
    caterpie: { id: 'caterpie', name: 'キャタピー', type: 'bug', color: '#82a94a', baseHP: 45, baseAttack: 30, baseDefense: 35, baseSpeed: 45, catchRate: 0.8, moves: ['tackle', 'string_shot'] },
    weedle: { id: 'weedle', name: 'ビードル', type: 'bug', secondaryType: 'poison', color: '#c69b54', baseHP: 40, baseAttack: 35, baseDefense: 30, baseSpeed: 50, catchRate: 0.8, moves: ['poison_sting', 'string_shot', 'tackle'] },
    pikachu: { id: 'pikachu', name: 'ピカチュウ', type: 'electric', color: '#d9bd50', baseHP: 35, baseAttack: 55, baseDefense: 30, baseSpeed: 90, catchRate: 0.35, moves: ['thunder_shock', 'quick_attack', 'growl'] }
  };
  // Alias for a move used by Charmander's early move set.
  MOVES.scratch = { id: 'scratch', name: 'ひっかく', type: 'normal', power: 40, accuracy: 1 };

  const TYPE_EFFECT = {
    fire: { grass: 2, bug: 2, water: 0.5, fire: 0.5 },
    water: { fire: 2, ground: 2, grass: 0.5, water: 0.5 },
    grass: { water: 2, ground: 2, fire: 0.5, grass: 0.5, bug: 0.5 },
    electric: { water: 2, flying: 2, grass: 0.5, electric: 0.5 },
    bug: { grass: 2, poison: 0.5, fire: 0.5 },
    flying: { bug: 2, grass: 2, electric: 0.5 },
    poison: { grass: 2, poison: 0.5 },
    normal: { rock: 0.5 },
    ground: { electric: 2, fire: 2, poison: 2 }
  };

  function uid(prefix) {
    let id;
    try {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    } catch (_) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return `${prefix}-${id}`;
  }

  function isoNow(now) { return (now instanceof Date ? now : new Date(now || Date.now())).toISOString(); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function getSpecies(speciesId) { return SPECIES[speciesId] || null; }
  function getMove(moveId) { return MOVES[moveId] || MOVES.tackle; }

  function statsAtLevel(species, level) {
    const lv = Math.max(1, Math.floor(level));
    return {
      maxHP: Math.floor((species.baseHP * 2 * lv) / 100) + lv + 10,
      attack: Math.floor((species.baseAttack * 2 * lv) / 100) + 5,
      defense: Math.floor((species.baseDefense * 2 * lv) / 100) + 5,
      speed: Math.floor((species.baseSpeed * 2 * lv) / 100) + 5
    };
  }

  function createCreature(speciesId, level, options) {
    const species = getSpecies(speciesId);
    if (!species) throw new Error(`Unknown species: ${speciesId}`);
    const opts = options || {};
    const stats = statsAtLevel(species, level);
    return {
      id: opts.id || uid('mon'),
      speciesId,
      nickname: opts.nickname || species.name,
      level: Math.max(1, Math.floor(level)),
      experience: opts.experience || 0,
      currentHP: opts.currentHP === undefined ? stats.maxHP : clamp(opts.currentHP, 0, stats.maxHP),
      maxHP: stats.maxHP,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      moves: (opts.moves || species.moves.slice(0, 4)).filter(id => MOVES[id]),
      status: opts.status || null,
      joinedAt: opts.joinedAt || isoNow(),
      joinedAtLevel: opts.joinedAtLevel || Math.max(1, Math.floor(level)),
      highestLevel: opts.highestLevel || Math.max(1, Math.floor(level)),
      evolutionHistory: Array.isArray(opts.evolutionHistory) ? opts.evolutionHistory.slice() : [],
      membership: opts.membership || 'party',
      alive: opts.alive !== false,
      death: opts.death || null,
      lifetimeEvents: Array.isArray(opts.lifetimeEvents) ? opts.lifetimeEvents.slice() : [{ at: opts.joinedAt || isoNow(), type: 'joined', text: '冒険の仲間になった' }]
    };
  }

  function createAdventure(playerName, starterId, now) {
    if (!STARTER_IDS.includes(starterId)) throw new Error('Starter must be one of the three available starters.');
    const startedAt = isoNow(now);
    const adventure = {
      id: uid('adv'),
      playerName: String(playerName || 'トレーナー').trim().slice(0, 20) || 'トレーナー',
      startedAt,
      playTimeMs: 0,
      money: 3000,
      location: { mapId: 'town', x: 5, y: 5 },
      lastRestTownId: 'town',
      wipeCount: 0,
      badges: [],
      inventory: { potion: 3, pokeball: 5 },
      storyFlags: { firstDeparture: false },
      pokemonRecords: {},
      party: [],
      box: [],
      graveyard: [],
      pokedex: {},
      encounterFlags: {},
      activeBattle: null,
      recoveryState: 'none',
      lastWipeId: null,
      historyEvents: [],
      pendingNicknameId: null,
      stepsSincePoisonTick: 0
    };
    const starter = createCreature(starterId, 5, { membership: 'party', joinedAt: startedAt });
    adventure.pokemonRecords[starter.id] = starter;
    adventure.party.push(starter.id);
    adventure.pokedex[starterId] = { seen: true, caught: true, firstSeenAt: startedAt, caughtAt: startedAt };
    addHistory(adventure, 'starter', `${starter.nickname}と冒険を始めた`, startedAt);
    return { schemaVersion: SAVE_SCHEMA_VERSION, revision: 0, createdAt: startedAt, lastSavedAt: startedAt, adventure };
  }

  function addHistory(adventure, type, text, at) {
    adventure.historyEvents.unshift({ id: uid('evt'), at: at || isoNow(), type, text });
    if (adventure.historyEvents.length > 250) adventure.historyEvents.length = 250;
  }

  function recordSeen(state, speciesId, at) {
    const a = state.adventure;
    if (!a.pokedex[speciesId]) a.pokedex[speciesId] = { seen: true, caught: false, firstSeenAt: at || isoNow(), caughtAt: null };
    else a.pokedex[speciesId].seen = true;
  }

  function registerCreature(state, creature, target) {
    const a = state.adventure;
    const membership = target || (a.party.length < PARTY_LIMIT ? 'party' : 'box');
    if (membership === 'party' && a.party.length >= PARTY_LIMIT) throw new Error('Party is full.');
    creature.membership = membership;
    creature.alive = true;
    creature.death = null;
    a.pokemonRecords[creature.id] = creature;
    if (membership === 'party') a.party.push(creature.id); else a.box.push(creature.id);
    const now = creature.joinedAt || isoNow();
    const speciesId = creature.speciesId;
    if (!a.pokedex[speciesId]) a.pokedex[speciesId] = { seen: true, caught: true, firstSeenAt: now, caughtAt: now };
    else { a.pokedex[speciesId].seen = true; a.pokedex[speciesId].caught = true; a.pokedex[speciesId].caughtAt = now; }
    addHistory(a, 'caught', `${creature.nickname}（${getSpecies(speciesId).name}）を仲間にした`, now);
    return creature;
  }

  function healCreature(creature, amount) {
    if (!creature || !creature.alive) return 0;
    const before = creature.currentHP;
    creature.currentHP = clamp(creature.currentHP + Math.max(0, amount), 0, creature.maxHP);
    return creature.currentHP - before;
  }

  function removeId(array, id) {
    const index = array.indexOf(id);
    if (index >= 0) array.splice(index, 1);
  }

  function killCreature(state, creature, context) {
    const a = state.adventure;
    if (!creature || !creature.alive) return false;
    const ctx = context || {};
    creature.currentHP = 0;
    creature.alive = false;
    creature.membership = 'graveyard';
    const diedAt = ctx.at || isoNow();
    const location = ctx.location || (a.location.mapId === 'route' ? '１ばんどうろ' : 'マサラタウン');
    const cause = ctx.cause || '戦闘ダメージ';
    creature.death = {
      at: diedAt,
      location,
      cause,
      level: creature.level,
      elapsedPlayTimeMs: a.playTimeMs,
      wipeCount: a.wipeCount
    };
    creature.lifetimeEvents.push({ at: diedAt, type: 'death', text: `${cause}により死亡（${location}）` });
    removeId(a.party, creature.id);
    removeId(a.box, creature.id);
    if (!a.graveyard.includes(creature.id)) a.graveyard.unshift(creature.id);
    addHistory(a, 'death', `${creature.nickname}が${location}で死亡した`, diedAt);
    return true;
  }

  // All sources of HP loss must call this function. HP 0 immediately causes permanent death.
  function applyDamage(state, creatureId, amount, context) {
    const creature = state.adventure.pokemonRecords[creatureId];
    if (!creature || !creature.alive) return { applied: 0, died: false };
    const damage = Math.max(0, Math.floor(amount));
    const applied = Math.min(creature.currentHP, damage);
    creature.currentHP = Math.max(0, creature.currentHP - damage);
    const died = creature.currentHP <= 0 ? killCreature(state, creature, context) : false;
    return { applied, died };
  }

  function finishFixedEncounter(adventure, outcome, at) {
    const battle = adventure.activeBattle;
    const id = battle && battle.fixedEncounterId;
    if (!id || !adventure.encounterFlags[id]) return;
    const flag = adventure.encounterFlags[id];
    flag.outcome = outcome;
    flag.resolvedAt = at || isoNow();
    flag.noRespawn = true;
  }

  function processWipe(state, at) {
    const a = state.adventure;
    if (a.party.length > 0 || a.recoveryState !== 'none') return false;
    finishFixedEncounter(a, 'lost_in_wipe', at);
    a.wipeCount += 1;
    a.money = Math.floor(a.money / 2);
    a.activeBattle = null;
    a.pendingNicknameId = null;
    a.location = { mapId: 'town', x: 5, y: 5 };
    a.lastWipeId = uid('wipe');
    a.recoveryState = a.box.length > 0 ? 'box_rebuild' : 'starter_select';
    addHistory(a, 'wipe', `全滅した。所持金が半分になり（${a.money}円）、${a.recoveryState === 'box_rebuild' ? 'ボックスから再編成' : '新しい最初のポケモン選択'}が必要`, at || isoNow());
    return true;
  }

  function selectNewStarter(state, starterId, at) {
    const a = state.adventure;
    if (a.recoveryState !== 'starter_select') throw new Error('Starter selection is not pending.');
    if (!STARTER_IDS.includes(starterId)) throw new Error('Invalid starter.');
    const creature = createCreature(starterId, 5, { membership: 'party', joinedAt: at || isoNow() });
    registerCreature(state, creature, 'party');
    a.recoveryState = 'none';
    a.location = { mapId: 'town', x: 5, y: 5 };
    addHistory(a, 'restart', `${creature.nickname}と再出発した`, at || isoNow());
    return creature;
  }

  function moveToParty(state, creatureId, atTown) {
    const a = state.adventure;
    if (!atTown || a.location.mapId !== 'town') return { ok: false, reason: 'ボックスの整理は街の施設でのみ行えます。' };
    if (a.party.length >= PARTY_LIMIT) return { ok: false, reason: '手持ちは6匹までです。' };
    const creature = a.pokemonRecords[creatureId];
    if (!creature || !creature.alive || creature.membership !== 'box' || !a.box.includes(creatureId)) return { ok: false, reason: '編成できる生存個体ではありません。' };
    removeId(a.box, creatureId);
    a.party.push(creatureId);
    creature.membership = 'party';
    if (a.recoveryState === 'box_rebuild') a.recoveryState = 'none';
    addHistory(a, 'party', `${creature.nickname}を手持ちに加えた`, isoNow());
    return { ok: true };
  }

  function moveToBox(state, creatureId, atTown) {
    const a = state.adventure;
    if (!atTown || a.location.mapId !== 'town') return { ok: false, reason: 'ボックスの整理は街の施設でのみ行えます。' };
    if (a.party.length <= 1) return { ok: false, reason: '最後の1匹は手持ちに残してください。' };
    const creature = a.pokemonRecords[creatureId];
    if (!creature || !creature.alive || creature.membership !== 'party' || !a.party.includes(creatureId)) return { ok: false, reason: '預けられる生存個体ではありません。' };
    removeId(a.party, creatureId);
    a.box.push(creatureId);
    creature.membership = 'box';
    addHistory(a, 'box', `${creature.nickname}をボックスに預けた`, isoNow());
    return { ok: true };
  }

  function rest(state, locationKind, at) {
    const a = state.adventure;
    const isTown = locationKind === 'town' && a.location.mapId === 'town' && a.location.x === 3 && a.location.y === 2;
    const isCamp = locationKind === 'camp' && a.location.mapId === 'route' && a.location.x === 10 && a.location.y === 6;
    if (!isTown && !isCamp) return { ok: false, reason: 'ここでは休憩できません。' };
    for (const id of a.party) {
      const creature = a.pokemonRecords[id];
      if (creature && creature.alive) {
        creature.currentHP = creature.maxHP;
        creature.status = null;
      }
    }
    if (isTown) a.lastRestTownId = 'town';
    addHistory(a, 'rest', isTown ? '街で休憩した' : 'キャンプで休憩した', at || isoNow());
    return { ok: true, healedCount: a.party.length };
  }

  function applyPotion(state, creatureId) {
    const a = state.adventure;
    if ((a.inventory.potion || 0) <= 0) return { ok: false, reason: 'キズぐすりがありません。' };
    const creature = a.pokemonRecords[creatureId];
    if (!creature || !creature.alive) return { ok: false, reason: '使えるポケモンがいません。' };
    if (creature.currentHP >= creature.maxHP) return { ok: false, reason: 'HPは満タンです。' };
    a.inventory.potion -= 1;
    const healed = healCreature(creature, 20);
    addHistory(a, 'item', `${creature.nickname}にキズぐすりを使った（HP +${healed}）`);
    return { ok: true, healed };
  }

  function applyTypeEffect(moveType, defender) {
    const species = getSpecies(defender.speciesId);
    if (!species) return 1;
    const first = (TYPE_EFFECT[moveType] && TYPE_EFFECT[moveType][species.type]) || 1;
    const second = species.secondaryType ? ((TYPE_EFFECT[moveType] && TYPE_EFFECT[moveType][species.secondaryType]) || 1) : 1;
    return first * second;
  }

  function calculateDamage(attacker, defender, move, rng) {
    const random = rng || Math.random;
    if (random() > move.accuracy) return { damage: 0, missed: true, effectiveness: 1 };
    if (move.power <= 0) return { damage: 0, missed: false, effectiveness: 1 };
    const level = attacker.level || 5;
    const attack = Math.max(1, attacker.attack || 10);
    const defense = Math.max(1, defender.defense || 10);
    const effectiveness = applyTypeEffect(move.type, defender);
    const stab = (() => {
      const s = getSpecies(attacker.speciesId);
      return s && (s.type === move.type || s.secondaryType === move.type) ? 1.5 : 1;
    })();
    const base = Math.floor(((((2 * level / 5 + 2) * move.power * attack / defense) / 50) + 2) * stab * effectiveness);
    const factor = 0.85 + random() * 0.15;
    return { damage: Math.max(1, Math.floor(base * factor)), missed: false, effectiveness };
  }

  function levelUp(creature) {
    const species = getSpecies(creature.speciesId);
    const oldStats = { maxHP: creature.maxHP };
    creature.level += 1;
    const stats = statsAtLevel(species, creature.level);
    creature.maxHP = stats.maxHP;
    creature.currentHP = Math.min(creature.maxHP, creature.currentHP + (stats.maxHP - oldStats.maxHP));
    creature.attack = stats.attack;
    creature.defense = stats.defense;
    creature.speed = stats.speed;
    creature.highestLevel = Math.max(creature.highestLevel, creature.level);
    creature.lifetimeEvents.push({ at: isoNow(), type: 'level', text: `レベル${creature.level}になった` });
  }

  function awardExperience(creature, defeated) {
    const gained = Math.max(5, defeated.level * 7);
    creature.experience += gained;
    let levels = 0;
    while (creature.level < 100 && creature.experience >= creature.level * 20) {
      creature.experience -= creature.level * 20;
      levelUp(creature);
      levels += 1;
    }
    return { gained, levels };
  }

  function makeWild(speciesId, level) {
    const wild = createCreature(speciesId, level, { membership: 'wild' });
    wild.id = uid('wild');
    return wild;
  }

  function startEncounter(state, speciesId, level, at) {
    const a = state.adventure;
    if (!a.party.length || a.recoveryState !== 'none') return false;
    const creature = a.pokemonRecords[a.party[0]];
    if (!creature || !creature.alive) return false;
    const enemy = makeWild(speciesId, level);
    recordSeen(state, speciesId, at || isoNow());
    a.activeBattle = {
      id: uid('battle'),
      fixedEncounterId: null,
      enemy,
      activePokemonId: a.party[0],
      enemyAttackDown: 0,
      enemySpeedDown: 0,
      turns: 0,
      log: [`野生の${getSpecies(speciesId).name}が現れた！`]
    };
    return true;
  }

  function canTriggerFixedEncounter(state, encounterId) {
    const flag = state.adventure.encounterFlags[encounterId];
    return !flag || flag.noRespawn !== true;
  }

  function startFixedEncounter(state, encounterId, speciesId, level, at) {
    const a = state.adventure;
    if (!encounterId || !canTriggerFixedEncounter(state, encounterId)) return false;
    if (!startEncounter(state, speciesId, level, at)) return false;
    a.activeBattle.fixedEncounterId = encounterId;
    a.encounterFlags[encounterId] = { encountered: true, consumed: true, noRespawn: true, outcome: 'in_progress', startedAt: at || isoNow(), resolvedAt: null };
    addHistory(a, 'fixed_encounter', `一度きりの遭遇：${getSpecies(speciesId).name}`, at || isoNow());
    return true;
  }

  function battleLog(adventure, text) {
    if (!adventure.activeBattle) return;
    adventure.activeBattle.log.push(text);
    if (adventure.activeBattle.log.length > 8) adventure.activeBattle.log.shift();
  }

  function endBattleWithDefeat(state, creature) {
    const a = state.adventure;
    const xp = awardExperience(creature, a.activeBattle.enemy);
    battleLog(a, `${a.activeBattle.enemy.nickname}を倒した。${creature.nickname}は${xp.gained}EXPを得た。`);
    if (xp.levels) battleLog(a, `${creature.nickname}はレベル${creature.level}になった！`);
    finishFixedEncounter(a, 'defeated');
    a.activeBattle = null;
    addHistory(a, 'battle', `${creature.nickname}が野生ポケモンに勝利した`);
  }

  function enemyTurn(state, rng) {
    const a = state.adventure;
    const battle = a.activeBattle;
    if (!battle) return;
    const playerId = battle.activePokemonId && a.party.includes(battle.activePokemonId) ? battle.activePokemonId : a.party[0];
    const player = a.pokemonRecords[playerId];
    if (!player || !player.alive) {
      battle.activePokemonId = a.party[0] || null;
      if (!battle.activePokemonId) { processWipe(state); return; }
    }
    const target = a.pokemonRecords[battle.activePokemonId];
    const enemy = battle.enemy;
    const possible = enemy.moves.map(getMove).filter(m => m.power > 0);
    const move = possible[Math.floor((rng || Math.random)() * possible.length)] || getMove('tackle');
    const result = calculateDamage(enemy, target, move, rng);
    if (result.missed) battleLog(a, `野生の${enemy.nickname}の${move.name}は当たらなかった！`);
    else {
      const damage = Math.max(1, result.damage - battle.enemyAttackDown);
      const outcome = applyDamage(state, target.id, damage, { cause: `${move.name}（野生戦闘）`, location: a.location.mapId === 'route' ? '１ばんどうろ' : 'マサラタウン' });
      battleLog(a, `${enemy.nickname}の${move.name}！ ${target.nickname}に${outcome.applied}ダメージ。`);
      if (outcome.died) battleLog(a, `${target.nickname}は死亡した……`);
      else if (move.poisonChance && !target.status && rng() < move.poisonChance) { target.status = 'poison'; battleLog(a, `${target.nickname}は毒を受けた！`); }
    }
    if (a.activeBattle && target.alive && target.status === 'poison') {
      const tick = Math.max(1, Math.floor(target.maxHP / 8));
      const outcome = applyDamage(state, target.id, tick, { cause: '毒の継続ダメージ', location: a.location.mapId === 'route' ? '１ばんどうろ' : 'マサラタウン' });
      if (outcome.died) battleLog(a, `${target.nickname}は毒で死亡した……`);
      else battleLog(a, `${target.nickname}は毒で${outcome.applied}ダメージを受けた。`);
    }
    if (a.activeBattle) {
      battle.turns += 1;
      if (a.party.length === 0) processWipe(state);
      else if (!a.party.includes(battle.activePokemonId)) battle.activePokemonId = a.party[0];
    }
  }

  function enemyPoisonTick(state) {
    const a = state.adventure;
    const battle = a.activeBattle;
    if (!battle || battle.enemy.status !== 'poison' || battle.enemy.currentHP <= 0) return false;
    const damage = Math.max(1, Math.floor(battle.enemy.maxHP / 8));
    battle.enemy.currentHP = Math.max(0, battle.enemy.currentHP - damage);
    battleLog(a, `野生の${battle.enemy.nickname}は毒で${damage}ダメージを受けた。`);
    if (battle.enemy.currentHP <= 0) {
      const activeId = battle.activePokemonId && a.party.includes(battle.activePokemonId) ? battle.activePokemonId : a.party[0];
      const player = a.pokemonRecords[activeId];
      if (player) endBattleWithDefeat(state, player);
      else a.activeBattle = null;
      return true;
    }
    return false;
  }

  function resolveBattleAction(state, action, options) {
    const a = state.adventure;
    const battle = a.activeBattle;
    if (!battle) return { ok: false, reason: '戦闘中ではありません。' };
    const opts = options || {};
    const rng = opts.rng || Math.random;
    let playerId = battle.activePokemonId && a.party.includes(battle.activePokemonId) ? battle.activePokemonId : a.party[0];
    let player = a.pokemonRecords[playerId];
    if (!player || !player.alive) return { ok: false, reason: '戦えるポケモンがいません。' };

    if (action.type === 'switch') {
      const next = a.pokemonRecords[action.creatureId];
      if (!next || !next.alive || !a.party.includes(next.id) || next.id === player.id) return { ok: false, reason: '交代できません。' };
      battle.activePokemonId = next.id;
      battleLog(a, `${player.nickname}は戻り、${next.nickname}に交代した。`);
      enemyTurn(state, rng);
      return { ok: true, switched: true };
    }

    if (action.type === 'attack') {
      const move = getMove(action.moveId || player.moves[0] || 'tackle');
      if (move.power === 0) {
        if (rng() <= move.accuracy) {
          if (move.debuff === 'attack') battle.enemyAttackDown = Math.min(12, battle.enemyAttackDown + 2);
          if (move.debuff === 'speed') battle.enemySpeedDown = Math.min(12, battle.enemySpeedDown + 2);
          battleLog(a, `${player.nickname}の${move.name}！ 野生の${battle.enemy.nickname}の能力が下がった。`);
        } else battleLog(a, `${player.nickname}の${move.name}は失敗した。`);
      } else {
        const result = calculateDamage(player, battle.enemy, move, rng);
        if (result.missed) battleLog(a, `${player.nickname}の${move.name}は外れた！`);
        else {
          battle.enemy.currentHP = Math.max(0, battle.enemy.currentHP - result.damage);
          battleLog(a, `${player.nickname}の${move.name}！ 野生の${battle.enemy.nickname}に${result.damage}ダメージ。`);
          if (result.effectiveness > 1) battleLog(a, '効果はばつぐんだ！');
          if (result.effectiveness < 1) battleLog(a, '効果はいまひとつのようだ。');
          if (move.poisonChance && battle.enemy.currentHP > 0 && rng() < move.poisonChance) battle.enemy.status = 'poison';
        }
      }
      if (battle.enemy.currentHP <= 0) {
        endBattleWithDefeat(state, player);
        return { ok: true, defeated: true };
      }
    } else if (action.type === 'potion') {
      const targetId = action.creatureId || player.id;
      const result = applyPotion(state, targetId);
      if (!result.ok) return result;
      battleLog(a, `${a.pokemonRecords[targetId].nickname}のHPが${result.healed}回復した。`);
    } else if (action.type === 'throw') {
      if ((a.inventory.pokeball || 0) <= 0) return { ok: false, reason: 'モンスターボールがありません。' };
      a.inventory.pokeball -= 1;
      const enemy = battle.enemy;
      const hpFactor = 1 - enemy.currentHP / enemy.maxHP;
      const chance = clamp(getSpecies(enemy.speciesId).catchRate * (0.3 + hpFactor * 0.9), 0.05, 0.95);
      if (rng() < chance) {
        const caught = createCreature(enemy.speciesId, enemy.level, { membership: 'party' });
        registerCreature(state, caught);
        battleLog(a, `やった！ ${enemy.nickname}を捕まえた！`);
        finishFixedEncounter(a, 'caught');
        a.activeBattle = null;
        a.pendingNicknameId = caught.id;
        return { ok: true, caughtId: caught.id };
      }
      battleLog(a, `ボールから出てしまった！`);
    } else if (action.type === 'run') {
      const chance = clamp(0.5 + (player.speed / Math.max(1, battle.enemy.speed)) * 0.2, 0.1, 0.95);
      if (rng() < chance) {
        battleLog(a, 'うまく逃げ切れた！');
        finishFixedEncounter(a, 'escaped');
        a.activeBattle = null;
        addHistory(a, 'escape', '野生ポケモンから逃げた');
        return { ok: true, escaped: true };
      }
      battleLog(a, '逃げられない！');
    } else {
      return { ok: false, reason: '不明な戦闘コマンドです。' };
    }

    if (a.activeBattle) enemyPoisonTick(state);
    if (a.activeBattle) enemyTurn(state, rng);
    return { ok: true };
  }

  function renameCreature(state, creatureId, nickname) {
    const creature = state.adventure.pokemonRecords[creatureId];
    if (!creature || !creature.alive) return false;
    const clean = String(nickname || '').trim().slice(0, 14);
    if (clean) creature.nickname = clean;
    creature.lifetimeEvents.push({ at: isoNow(), type: 'nickname', text: `名前を「${creature.nickname}」にした` });
    state.adventure.pendingNicknameId = null;
    return true;
  }

  function movePlayer(state, dx, dy, rng, at) {
    const a = state.adventure;
    if (a.activeBattle || a.recoveryState === 'starter_select') return { ok: false, reason: '今は移動できません。' };
    if (!a.party.length && a.recoveryState !== 'box_rebuild') return { ok: false, reason: '手持ちを編成してください。' };
    const x = a.location.x + dx;
    const y = a.location.y + dy;
    if (x < 0 || x > 11 || y < 0 || y > 7) return { ok: false, reason: 'これ以上進めません。' };
    if (a.location.mapId === 'town') {
      if (y === 0 && x === 5) {
        a.location = { mapId: 'route', x: 5, y: 6 };
        a.storyFlags.firstDeparture = true;
        addHistory(a, 'travel', '１ばんどうろへ出発した', at || isoNow());
        return { ok: true, areaChanged: true };
      }
      if (y === 0 || (x >= 0 && x <= 11 && y === 7)) return { ok: false, reason: '建物や柵に阻まれている。' };
    } else if (a.location.mapId === 'route') {
      if (y === 7 && x === 5) {
        a.location = { mapId: 'town', x: 5, y: 1 };
        return { ok: true, areaChanged: true };
      }
      if (y === 7 || y === 0) return { ok: false, reason: '道が続いていない。' };
    }
    a.location.x = x;
    a.location.y = y;
    const random = rng || Math.random;
    if (a.recoveryState === 'none' && a.party.length > 0 && a.location.mapId === 'route' && x >= 2 && x <= 8 && y >= 2 && y <= 5 && random() < 0.22) {
      const options = [
        ['pidgey', 2, 4], ['rattata', 2, 4], ['caterpie', 2, 3], ['weedle', 2, 3], ['pikachu', 3, 5]
      ];
      const picked = options[Math.floor(random() * options.length)];
      startEncounter(state, picked[0], picked[1] + Math.floor(random() * (picked[2] - picked[1] + 1)), at);
    }
    if (a.recoveryState === 'none' && a.party.length > 0) a.stepsSincePoisonTick += 1;
    if (a.stepsSincePoisonTick >= 3 && a.recoveryState === 'none') {
      a.stepsSincePoisonTick = 0;
      const poisoned = a.party.slice().filter(id => a.pokemonRecords[id] && a.pokemonRecords[id].status === 'poison');
      for (const id of poisoned) {
        const creature = a.pokemonRecords[id];
        const outcome = applyDamage(state, id, Math.max(1, Math.floor(creature.maxHP / 8)), { cause: 'フィールド上の毒ダメージ', location: a.location.mapId === 'route' ? '１ばんどうろ' : 'マサラタウン', at: at || isoNow() });
        if (outcome.died) addHistory(a, 'death', `${creature.nickname}はフィールド上の毒で死亡した`);
      }
      if (a.party.length === 0) processWipe(state, at);
    }
    return { ok: true, encounter: !!a.activeBattle };
  }

  function getCurrentMapName(state) { return state.adventure.location.mapId === 'route' ? '１ばんどうろ' : 'マサラタウン'; }

  function isAtTownFacility(state) { return state.adventure.location.mapId === 'town'; }
  function isAtRestSpot(state) {
    const p = state.adventure.location;
    return (p.mapId === 'town' && p.x === 3 && p.y === 2) || (p.mapId === 'route' && p.x === 10 && p.y === 6);
  }
  function currentRestKind(state) {
    const p = state.adventure.location;
    if (p.mapId === 'town' && p.x === 3 && p.y === 2) return 'town';
    if (p.mapId === 'route' && p.x === 10 && p.y === 6) return 'camp';
    return null;
  }
  function isAtBoxFacility(state) { return state.adventure.location.mapId === 'town' && state.adventure.location.x === 8 && state.adventure.location.y === 2; }

  function makeBackup(state, exportedAt) {
    assertValidSave(state);
    return {
      format: 'hardcore-rpg-backup',
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportedAt: isoNow(exportedAt),
      state: JSON.parse(JSON.stringify(state))
    };
  }

  function parseBackup(input) {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    if (!data || data.format !== 'hardcore-rpg-backup' || data.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error('バックアップ形式またはバージョンが対応していません。');
    assertValidSave(data.state);
    return data;
  }

  function assertValidSave(state) {
    if (!state || state.schemaVersion !== SAVE_SCHEMA_VERSION || !state.adventure) throw new Error('セーブデータの形式が不正です。');
    const a = state.adventure;
    if (!a.pokemonRecords || !Array.isArray(a.party) || !Array.isArray(a.box) || !Array.isArray(a.graveyard)) throw new Error('個体データの構造が不正です。');
    if (!Array.isArray(a.historyEvents) || !a.pokedex || !a.storyFlags || !a.inventory || !a.encounterFlags) throw new Error('冒険データの構造が不正です。');
    if (!Number.isInteger(a.money) || a.money < 0 || !Number.isInteger(a.wipeCount) || a.wipeCount < 0) throw new Error('所持金または全滅回数が不正です。');
    if (!Number.isInteger(a.inventory.potion || 0) || (a.inventory.potion || 0) < 0 || !Number.isInteger(a.inventory.pokeball || 0) || (a.inventory.pokeball || 0) < 0) throw new Error('道具の個数が不正です。');
    if (!a.location || !['town', 'route'].includes(a.location.mapId) || !Number.isInteger(a.location.x) || !Number.isInteger(a.location.y) || a.location.x < 0 || a.location.x > 11 || a.location.y < 0 || a.location.y > 7) throw new Error('現在地が不正です。');
    if (a.party.length > PARTY_LIMIT) throw new Error('手持ちが上限を超えています。');
    const collections = [a.party, a.box, a.graveyard];
    const ids = collections.flat();
    if (new Set(ids).size !== ids.length) throw new Error('同じ個体が複数の所属先に登録されています。');
    for (const id of ids) if (!a.pokemonRecords[id]) throw new Error(`個体データがありません: ${id}`);
    for (const [id, mon] of Object.entries(a.pokemonRecords)) {
      const inParty = a.party.includes(id), inBox = a.box.includes(id), inGrave = a.graveyard.includes(id);
      const sp = mon && getSpecies(mon.speciesId);
      if (!sp || !Number.isInteger(mon.level) || mon.level < 1 || mon.level > 100 || !Number.isInteger(mon.currentHP) || !Number.isInteger(mon.maxHP) || mon.maxHP < 1 || mon.currentHP < 0 || mon.currentHP > mon.maxHP) throw new Error(`${mon && mon.nickname ? mon.nickname : id}の個体データが不正です。`);
      if (!Array.isArray(mon.moves) || mon.moves.some(moveId => !MOVES[moveId])) throw new Error(`${mon.nickname}の技データが不正です。`);
      if (mon.alive && (mon.currentHP <= 0 || inGrave || (!inParty && !inBox) || mon.death)) throw new Error(`${mon.nickname}の生存状態と所属が一致しません。`);
      if (!mon.alive && (!inGrave || inParty || inBox || mon.currentHP !== 0 || !mon.death)) throw new Error(`${mon.nickname}の死亡状態と所属が一致しません。`);
      if (mon.membership !== (inParty ? 'party' : inBox ? 'box' : inGrave ? 'graveyard' : mon.membership)) throw new Error(`${mon.nickname}の所属フィールドが一致しません。`);
    }
    if (!['none', 'box_rebuild', 'starter_select'].includes(a.recoveryState)) throw new Error('再起状態が不正です。');
    if (a.recoveryState === 'none' && a.party.length === 0) throw new Error('手持ちが空のまま通常状態になっています。');
    if (a.recoveryState === 'box_rebuild' && (a.party.length !== 0 || a.box.length === 0)) throw new Error('ボックス再編成状態が不正です。');
    if (a.recoveryState === 'starter_select' && (a.party.length !== 0 || a.box.length !== 0)) throw new Error('再出発状態が不正です。');
    if (a.activeBattle) {
      const enemy = a.activeBattle.enemy;
      if (a.recoveryState !== 'none' || !a.party.length || !enemy || !getSpecies(enemy.speciesId) || enemy.currentHP <= 0 || !a.party.includes(a.activeBattle.activePokemonId)) throw new Error('戦闘状態が不正です。');
      if (a.activeBattle.fixedEncounterId && !a.encounterFlags[a.activeBattle.fixedEncounterId]) throw new Error('固定遭遇フラグがありません。');
    }
    return true;
  }

  return {
    SAVE_SCHEMA_VERSION, PARTY_LIMIT, STARTER_IDS, MOVES, SPECIES,
    getSpecies, getMove, statsAtLevel, createCreature, createAdventure,
    addHistory, recordSeen, registerCreature, healCreature, applyDamage,
    processWipe, selectNewStarter, moveToParty, moveToBox, rest, applyPotion,
    calculateDamage, awardExperience, startEncounter, startFixedEncounter, canTriggerFixedEncounter, resolveBattleAction,
    renameCreature, movePlayer, getCurrentMapName, isAtTownFacility,
    isAtRestSpot, currentRestKind, isAtBoxFacility, makeBackup, parseBackup,
    assertValidSave, killCreature
  };
});
