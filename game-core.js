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
    thunder_shock: { id: 'thunder_shock', name: 'でんきショック', type: 'electric', power: 40, accuracy: 1 },
    thunderbolt: { id: 'thunderbolt', name: '１０まんボルト', type: 'electric', power: 90, accuracy: 0.95, poisonChance: 0.1 },
    peck: { id: 'peck', name: 'つつく', type: 'flying', power: 35, accuracy: 1 },
    body_slam: { id: 'body_slam', name: 'のしかかり', type: 'normal', power: 85, accuracy: 1 },
    swift: { id: 'swift', name: 'スピードスター', type: 'normal', power: 60, accuracy: 1 },
    absorb: { id: 'absorb', name: 'すいとる', type: 'grass', power: 20, accuracy: 1 }
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
    pikachu: { id: 'pikachu', name: 'ピカチュウ', type: 'electric', color: '#d9bd50', baseHP: 35, baseAttack: 55, baseDefense: 30, baseSpeed: 90, catchRate: 0.35, moves: ['thunder_shock', 'quick_attack', 'growl'] },
    magnemite: { id: 'magnemite', name: 'コイル', type: 'electric', secondaryType: 'steel', color: '#a9b7bf', baseHP: 25, baseAttack: 35, baseDefense: 70, baseSpeed: 45, catchRate: 0.55, moves: ['thunder_shock', 'tackle', 'swift'] },
    voltorb: { id: 'voltorb', name: 'ビリリダマ', type: 'electric', color: '#d56f65', baseHP: 40, baseAttack: 30, baseDefense: 50, baseSpeed: 100, catchRate: 0.6, moves: ['tackle', 'swift', 'thunder_shock'] },
    electrode: { id: 'electrode', name: 'マルマイン', type: 'electric', color: '#d56e66', baseHP: 60, baseAttack: 50, baseDefense: 70, baseSpeed: 150, catchRate: 0.3, moves: ['thunderbolt', 'swift', 'tackle'] },
    zapdos: { id: 'zapdos', name: 'サンダー', type: 'electric', secondaryType: 'flying', color: '#d7b64f', baseHP: 90, baseAttack: 90, baseDefense: 85, baseSpeed: 100, catchRate: 0.03, moves: ['thunderbolt', 'peck', 'quick_attack', 'thunder_shock'] },
    nidoran_m: { id: 'nidoran_m', name: 'ニドラン♂', type: 'poison', color: '#7891b5', baseHP: 46, baseAttack: 57, baseDefense: 40, baseSpeed: 50, catchRate: 0.55, moves: ['tackle', 'poison_sting', 'growl'] },
    nidoran_f: { id: 'nidoran_f', name: 'ニドラン♀', type: 'poison', color: '#b57d9c', baseHP: 55, baseAttack: 47, baseDefense: 52, baseSpeed: 41, catchRate: 0.55, moves: ['tackle', 'poison_sting', 'growl'] },
    oddish: { id: 'oddish', name: 'ナゾノクサ', type: 'grass', secondaryType: 'poison', color: '#6a9e67', baseHP: 45, baseAttack: 50, baseDefense: 55, baseSpeed: 30, catchRate: 0.6, moves: ['absorb', 'poison_sting', 'tackle'] },
    metapod: { id: 'metapod', name: 'トランセル', type: 'bug', color: '#86a96b', baseHP: 50, baseAttack: 20, baseDefense: 55, baseSpeed: 30, catchRate: 0.6, moves: ['tackle', 'string_shot'] },
    kakuna: { id: 'kakuna', name: 'コクーン', type: 'bug', secondaryType: 'poison', color: '#c99d5d', baseHP: 45, baseAttack: 25, baseDefense: 50, baseSpeed: 35, catchRate: 0.6, moves: ['poison_sting', 'string_shot', 'tackle'] }
  };
  // Alias for a move used by Charmander's early move set.
  MOVES.scratch = { id: 'scratch', name: 'ひっかく', type: 'normal', power: 40, accuracy: 1 };

  const MAPS = { town: 'マサラタウン', route: '１ばんどうろ', viridian: 'トキワシティ', route2: '２ばんどうろ', forest: 'トキワのもり', pewter: 'ニビシティ', powerplant: 'むじんはつでんしょ' };
  const CITY_MAPS = ['town', 'viridian', 'pewter'];
  const TOWN_SPAWNS = { town: { x: 5, y: 5 }, viridian: { x: 5, y: 5 }, pewter: { x: 5, y: 5 } };
  const REST_TILES = { town: { x: 3, y: 2 }, viridian: { x: 3, y: 3 }, pewter: { x: 3, y: 3 } };
  const BOX_TILES = { town: { x: 8, y: 2 }, viridian: { x: 8, y: 3 }, pewter: { x: 8, y: 3 } };
  const STORY_EVENT_TILES = {
    viridian_guide: { id: 'viridian_guide', mapId: 'viridian', x: 6, y: 4, kind: 'dialogue', message: '町の案内人「草むらでは野生のポケモンに出会う。仲間のHPには気を配るんじゃぞ。」', history: 'トキワシティの案内人から冒険の助言を聞いた' },
    forest_potion: { id: 'forest_potion', mapId: 'forest', x: 8, y: 3, kind: 'item', item: 'potion', quantity: 1, message: '木陰でキズぐすりを1個見つけた。', history: 'トキワのもりでキズぐすりを見つけた' }
  };

  // Fixed symbols are consumed on first contact. Demo levels/coordinates are AI-decided content defaults.
  const FIXED_ENCOUNTERS = {
    powerplant_electrode: { id: 'powerplant_electrode', mapId: 'powerplant', x: 3, y: 4, speciesId: 'electrode', level: 24, kind: 'fixed', label: 'アイテムに擬態した固定シンボル' },
    powerplant_zapdos: { id: 'powerplant_zapdos', mapId: 'powerplant', x: 6, y: 2, speciesId: 'zapdos', level: 30, kind: 'legendary', label: '伝説のポケモン' }
  };

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
      storyFlags: { firstDeparture: false, discoveredAreas: ['town'], events: {} },
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
    const location = ctx.location || (MAPS[a.location.mapId] || '不明な場所');
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
    const returnTown = CITY_MAPS.includes(a.lastRestTownId) ? a.lastRestTownId : 'town';
    const returnSpawn = TOWN_SPAWNS[returnTown] || TOWN_SPAWNS.town;
    a.location = { mapId: returnTown, x: returnSpawn.x, y: returnSpawn.y };
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
    if (!atTown || !isAtBoxFacility(state)) return { ok: false, reason: 'ボックスの整理は街の保管端末でのみ行えます。' };
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
    if (!atTown || !isAtBoxFacility(state)) return { ok: false, reason: 'ボックスの整理は街の保管端末でのみ行えます。' };
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
    const p = a.location;
    const restTile = REST_TILES[p.mapId];
    const isTown = locationKind === 'town' && !!restTile && p.x === restTile.x && p.y === restTile.y;
    const isCamp = locationKind === 'camp' && p.mapId === 'route' && p.x === 10 && p.y === 6;
    if (!isTown && !isCamp) return { ok: false, reason: 'ここでは休憩できません。' };
    for (const id of a.party) {
      const creature = a.pokemonRecords[id];
      if (creature && creature.alive) {
        creature.currentHP = creature.maxHP;
        creature.status = null;
      }
    }
    if (isTown) a.lastRestTownId = p.mapId;
    addHistory(a, 'rest', isTown ? `${MAPS[p.mapId]}で休憩した` : 'キャンプで休憩した', at || isoNow());
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
      id: uid('battle'), fixedEncounterId: null, enemy,
      activePokemonId: a.party[0], enemyAttackDown: 0, enemySpeedDown: 0,
      turns: 0, log: [`野生の${getSpecies(speciesId).name}が現れた！`]
    };
    return true;
  }

  function ensureStoryState(adventure) {
    if (!adventure.storyFlags || typeof adventure.storyFlags !== 'object') adventure.storyFlags = {};
    if (!Array.isArray(adventure.storyFlags.discoveredAreas)) adventure.storyFlags.discoveredAreas = [adventure.location && adventure.location.mapId || 'town'];
    if (!adventure.storyFlags.events || typeof adventure.storyFlags.events !== 'object') adventure.storyFlags.events = {};
  }

  function discoverArea(adventure, mapId, at) {
    ensureStoryState(adventure);
    if (adventure.storyFlags.discoveredAreas.includes(mapId)) return false;
    adventure.storyFlags.discoveredAreas.push(mapId);
    addHistory(adventure, 'discovery', `${MAPS[mapId] || mapId}を発見した`, at || isoNow());
    return true;
  }

  function triggerStoryEvent(state, mapId, x, y, at) {
    const a = state.adventure;
    ensureStoryState(a);
    const event = Object.values(STORY_EVENT_TILES).find(item => item.mapId === mapId && item.x === x && item.y === y);
    if (!event || a.storyFlags.events[event.id]) return null;
    a.storyFlags.events[event.id] = true;
    if (event.kind === 'item' && event.item === 'potion') a.inventory.potion = (a.inventory.potion || 0) + event.quantity;
    addHistory(a, 'story_event', event.history, at || isoNow());
    return event.message;
  }

  function canTriggerFixedEncounter(state, encounterId) {
    const flag = state.adventure.encounterFlags[encounterId];
    return !flag || flag.noRespawn !== true;
  }

  function getFixedEncounterAt(state, mapId, x, y) {
    const definition = Object.values(FIXED_ENCOUNTERS).find(item => item.mapId === mapId && item.x === x && item.y === y);
    if (!definition) return null;
    const flag = state.adventure.encounterFlags[definition.id] || null;
    return { ...definition, available: canTriggerFixedEncounter(state, definition.id), outcome: flag ? flag.outcome : null };
  }

  function startFixedEncounter(state, encounterId, speciesId, level, at) {
    const a = state.adventure;
    if (!encounterId || !canTriggerFixedEncounter(state, encounterId)) return false;
    if (!startEncounter(state, speciesId, level, at)) return false;
    const definition = FIXED_ENCOUNTERS[encounterId] || {};
    a.activeBattle.fixedEncounterId = encounterId;
    a.encounterFlags[encounterId] = {
      encountered: true, consumed: true, noRespawn: true, outcome: 'in_progress',
      kind: definition.kind || 'fixed', speciesId, mapId: definition.mapId || a.location.mapId,
      x: Number.isInteger(definition.x) ? definition.x : a.location.x,
      y: Number.isInteger(definition.y) ? definition.y : a.location.y,
      captureAttempts: 0, captureFailures: 0, lastCaptureOutcome: null,
      startedAt: at || isoNow(), resolvedAt: null
    };
    const prefix = definition.kind === 'legendary' ? '伝説ポケモンとの一度きりの遭遇' : '一度きりの固定遭遇';
    addHistory(a, 'fixed_encounter', `${prefix}：${getSpecies(speciesId).name}`, at || isoNow());
    return true;
  }

  function battleLog(adventure, text) {
    if (!adventure.activeBattle) return;
    adventure.activeBattle.log.push(text);
    if (adventure.activeBattle.log.length > 8) adventure.activeBattle.log.shift();
  }

  function endBattleWithDefeat(state, creature) {
    const a = state.adventure;
    if (!creature || !creature.alive) return false;
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
      const outcome = applyDamage(state, target.id, damage, { cause: `${move.name}（野生戦闘）`, location: MAPS[a.location.mapId] || '不明な場所' });
      battleLog(a, `${enemy.nickname}の${move.name}！ ${target.nickname}に${outcome.applied}ダメージ。`);
      if (outcome.died) battleLog(a, `${target.nickname}は死亡した……`);
      else if (move.poisonChance && !target.status && rng() < move.poisonChance) { target.status = 'poison'; battleLog(a, `${target.nickname}は毒を受けた！`); }
    }
    if (a.activeBattle && target.alive && target.status === 'poison') {
      const tick = Math.max(1, Math.floor(target.maxHP / 8));
      const outcome = applyDamage(state, target.id, tick, { cause: '毒の継続ダメージ', location: MAPS[a.location.mapId] || '不明な場所' });
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
          battleLog(a, `${player.nickname}の${move.name}！ ${battle.enemy.nickname}に${result.damage}ダメージ。`);
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
      if (battle.fixedEncounterId && a.encounterFlags[battle.fixedEncounterId]) {
        const flag = a.encounterFlags[battle.fixedEncounterId];
        flag.captureAttempts = (flag.captureAttempts || 0) + 1;
        flag.lastCaptureOutcome = 'attempted';
        flag.lastCaptureAttemptAt = isoNow();
      }
      if (rng() < chance) {
        const caught = createCreature(enemy.speciesId, enemy.level, { membership: 'party' });
        registerCreature(state, caught);
        battleLog(a, `やった！ ${enemy.nickname}を捕まえた！`);
        if (battle.fixedEncounterId && a.encounterFlags[battle.fixedEncounterId]) a.encounterFlags[battle.fixedEncounterId].lastCaptureOutcome = 'caught';
        finishFixedEncounter(a, 'caught');
        a.activeBattle = null;
        a.pendingNicknameId = caught.id;
        return { ok: true, caughtId: caught.id };
      }
      if (battle.fixedEncounterId && a.encounterFlags[battle.fixedEncounterId]) {
        const flag = a.encounterFlags[battle.fixedEncounterId];
        flag.captureFailures = (flag.captureFailures || 0) + 1;
        flag.lastCaptureOutcome = 'failed';
        flag.lastCaptureAttemptAt = isoNow();
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

  function tileEventHint(adventure, mapId, x, y) {
    ensureStoryState(adventure);
    const item = Object.values(STORY_EVENT_TILES).find(event => event.mapId === mapId && event.x === x && event.y === y);
    return !!(item && !adventure.storyFlags.events[item.id]);
  }

  function movePlayer(state, dx, dy, rng, at) {
    const a = state.adventure;
    if (a.activeBattle || a.recoveryState === 'starter_select') return { ok: false, reason: '今は移動できません。' };
    if (!a.party.length && a.recoveryState !== 'box_rebuild') return { ok: false, reason: '手持ちを編成してください。' };
    const x = a.location.x + dx;
    const y = a.location.y + dy;
    if (x < 0 || x > 11 || y < 0 || y > 7) return { ok: false, reason: 'これ以上進めません。' };
    const fromMap = a.location.mapId;
    let destination = null;

    if (fromMap === 'town' && y === 0 && x === 5) destination = { mapId: 'route', x: 5, y: 6, event: '１ばんどうろへ出発した' };
    else if (fromMap === 'route' && y === 7 && x === 5) destination = { mapId: 'town', x: 5, y: 1, event: 'マサラタウンへ戻った' };
    else if (fromMap === 'route' && y === 0 && x === 5) destination = { mapId: 'viridian', x: 5, y: 6, event: 'トキワシティに到着した' };
    else if (fromMap === 'route' && x === 10 && y === 1) destination = { mapId: 'powerplant', x: 5, y: 6, event: 'むじんはつでんしょを発見した' };
    else if (fromMap === 'viridian' && y === 7 && x === 5) destination = { mapId: 'route', x: 5, y: 1, event: '１ばんどうろへ戻った' };
    else if (fromMap === 'viridian' && y === 0 && x === 5) destination = { mapId: 'route2', x: 5, y: 6, event: '２ばんどうろへ進んだ' };
    else if (fromMap === 'route2' && y === 7 && x === 5) destination = { mapId: 'viridian', x: 5, y: 1, event: 'トキワシティへ戻った' };
    else if (fromMap === 'route2' && y === 0 && x === 5) destination = { mapId: 'forest', x: 5, y: 6, event: 'トキワのもりへ入った' };
    else if (fromMap === 'forest' && y === 7 && x === 5) destination = { mapId: 'route2', x: 5, y: 1, event: '２ばんどうろへ戻った' };
    else if (fromMap === 'forest' && y === 0 && x === 5) destination = { mapId: 'pewter', x: 5, y: 6, event: 'ニビシティに到着した' };
    else if (fromMap === 'pewter' && y === 7 && x === 5) destination = { mapId: 'forest', x: 5, y: 1, event: 'トキワのもりへ戻った' };
    else if (fromMap === 'powerplant' && y === 7 && x === 5) destination = { mapId: 'route', x: 10, y: 1, event: '１ばんどうろへ戻った' };

    if (destination) {
      a.location = { mapId: destination.mapId, x: destination.x, y: destination.y };
      if (fromMap === 'town' && destination.mapId === 'route') a.storyFlags.firstDeparture = true;
      if (destination.mapId === 'powerplant') a.storyFlags.powerplantDiscovered = true;
      discoverArea(a, destination.mapId, at || isoNow());
      addHistory(a, 'travel', destination.event, at || isoNow());
      return { ok: true, areaChanged: true, areaName: MAPS[destination.mapId] };
    }

    // Keep the small demo maps bounded; north/south exits exist only at the centre gate.
    if ((fromMap === 'town' || CITY_MAPS.includes(fromMap)) && ((y === 0 && x !== 5) || (y === 7 && x !== 5) || x === 0 || x === 11)) return { ok: false, reason: '建物や柵に阻まれている。' };
    if ((fromMap === 'route' || fromMap === 'route2') && (y === 0 || y === 7 || x === 0 || x === 11)) return { ok: false, reason: '道が続いていない。' };
    if (fromMap === 'forest' && (y === 0 || y === 7 || x === 0 || x === 11)) return { ok: false, reason: '木々に阻まれている。' };
    if (fromMap === 'powerplant' && (x === 0 || x === 11 || y === 0 || (y === 7 && x !== 5))) return { ok: false, reason: '施設の壁に阻まれている。' };

    a.location.x = x;
    a.location.y = y;
    const random = rng || Math.random;

    if (a.recoveryState === 'none' && a.party.length > 0) a.stepsSincePoisonTick += 1;
    if (a.stepsSincePoisonTick >= 3 && a.recoveryState === 'none') {
      a.stepsSincePoisonTick = 0;
      const poisoned = a.party.slice().filter(id => a.pokemonRecords[id] && a.pokemonRecords[id].status === 'poison');
      for (const id of poisoned) {
        const creature = a.pokemonRecords[id];
        const outcome = applyDamage(state, id, Math.max(1, Math.floor(creature.maxHP / 8)), { cause: 'フィールド上の毒ダメージ', location: MAPS[a.location.mapId] || '不明な場所', at: at || isoNow() });
        if (outcome.died) addHistory(a, 'death', `${creature.nickname}はフィールド上の毒で死亡した`);
      }
      if (a.party.length === 0) processWipe(state, at);
    }

    let storyMessage = null;
    if (a.recoveryState === 'none' && a.party.length > 0) storyMessage = triggerStoryEvent(state, a.location.mapId, x, y, at);

    if (a.recoveryState === 'none' && a.party.length > 0 && !a.activeBattle && !storyMessage) {
      const fixed = getFixedEncounterAt(state, a.location.mapId, x, y);
      if (fixed && fixed.available) {
        startFixedEncounter(state, fixed.id, fixed.speciesId, fixed.level, at);
      } else {
        let options = null;
        let probability = 0;
        if (a.location.mapId === 'route' && x >= 2 && x <= 8 && y >= 2 && y <= 5) {
          options = [['pidgey', 2, 4], ['rattata', 2, 4], ['caterpie', 2, 3], ['weedle', 2, 3], ['pikachu', 3, 5]];
          probability = 0.22;
        } else if (a.location.mapId === 'route2' && x >= 2 && x <= 9 && y >= 2 && y <= 5) {
          options = [['nidoran_m', 3, 5], ['nidoran_f', 3, 5], ['oddish', 3, 5], ['pidgey', 3, 5], ['rattata', 3, 5]];
          probability = 0.2;
        } else if (a.location.mapId === 'forest' && x >= 2 && x <= 9 && y >= 2 && y <= 5) {
          options = [['caterpie', 4, 6], ['weedle', 4, 6], ['metapod', 5, 7], ['kakuna', 5, 7], ['pikachu', 4, 6]];
          probability = 0.2;
        } else if (a.location.mapId === 'powerplant' && x >= 2 && x <= 9 && y >= 2 && y <= 5) {
          options = [['magnemite', 18, 22], ['voltorb', 18, 22], ['pikachu', 16, 20]];
          probability = 0.18;
        }
        if (options && random() < probability) {
          const picked = options[Math.floor(random() * options.length)];
          startEncounter(state, picked[0], picked[1] + Math.floor(random() * (picked[2] - picked[1] + 1)), at);
        }
      }
    }
    return { ok: true, encounter: !!a.activeBattle, areaChanged: false, storyMessage };
  }

  function getCurrentMapName(state) { return MAPS[state.adventure.location.mapId] || '不明な場所'; }
  function getMapName(mapId) { return MAPS[mapId] || '不明な場所'; }

  function isAtTownFacility(state) { return CITY_MAPS.includes(state.adventure.location.mapId); }
  function isAtRestSpot(state) {
    const p = state.adventure.location;
    const restTile = REST_TILES[p.mapId];
    return (!!restTile && p.x === restTile.x && p.y === restTile.y) || (p.mapId === 'route' && p.x === 10 && p.y === 6);
  }
  function currentRestKind(state) {
    const p = state.adventure.location;
    const restTile = REST_TILES[p.mapId];
    if (restTile && p.x === restTile.x && p.y === restTile.y) return 'town';
    if (p.mapId === 'route' && p.x === 10 && p.y === 6) return 'camp';
    return null;
  }
  function isAtBoxFacility(state) {
    const p = state.adventure.location;
    const boxTile = BOX_TILES[p.mapId];
    return !!boxTile && p.x === boxTile.x && p.y === boxTile.y;
  }

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
    if (a.storyFlags.discoveredAreas !== undefined && (!Array.isArray(a.storyFlags.discoveredAreas) || a.storyFlags.discoveredAreas.some(mapId => !MAPS[mapId]))) throw new Error('発見エリアの記録が不正です。');
    if (a.storyFlags.events !== undefined && (!a.storyFlags.events || typeof a.storyFlags.events !== 'object' || Array.isArray(a.storyFlags.events))) throw new Error('ストーリーイベント記録が不正です。');
    if (a.lastRestTownId !== undefined && !CITY_MAPS.includes(a.lastRestTownId)) throw new Error('最後に休憩した街の記録が不正です。');
    if (!Number.isInteger(a.money) || a.money < 0 || !Number.isInteger(a.wipeCount) || a.wipeCount < 0) throw new Error('所持金または全滅回数が不正です。');
    if (!Number.isInteger(a.inventory.potion || 0) || (a.inventory.potion || 0) < 0 || !Number.isInteger(a.inventory.pokeball || 0) || (a.inventory.pokeball || 0) < 0) throw new Error('道具の個数が不正です。');
    if (!a.location || !Object.prototype.hasOwnProperty.call(MAPS, a.location.mapId) || !Number.isInteger(a.location.x) || !Number.isInteger(a.location.y) || a.location.x < 0 || a.location.x > 11 || a.location.y < 0 || a.location.y > 7) throw new Error('現在地が不正です。');
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
    for (const [encounterId, flag] of Object.entries(a.encounterFlags)) {
      if (!flag || typeof flag !== 'object' || typeof flag.noRespawn !== 'boolean' || typeof flag.encountered !== 'boolean') throw new Error(`固定遭遇フラグが不正です: ${encounterId}`);
      if (flag.noRespawn && flag.encountered !== true) throw new Error(`固定遭遇の消費状態が不正です: ${encounterId}`);
      if (flag.noRespawn && !['in_progress', 'defeated', 'escaped', 'caught', 'lost_in_wipe'].includes(flag.outcome)) throw new Error(`固定遭遇の結果が不正です: ${encounterId}`);
      if (flag.kind === 'legendary' && !flag.noRespawn) throw new Error(`伝説遭遇の再出現フラグが不正です: ${encounterId}`);
    }
    if (a.activeBattle) {
      const enemy = a.activeBattle.enemy;
      if (a.recoveryState !== 'none' || !a.party.length || !enemy || !getSpecies(enemy.speciesId) || enemy.currentHP <= 0 || !a.party.includes(a.activeBattle.activePokemonId)) throw new Error('戦闘状態が不正です。');
      if (a.activeBattle.fixedEncounterId) {
        const flag = a.encounterFlags[a.activeBattle.fixedEncounterId];
        if (!flag || flag.noRespawn !== true || flag.outcome !== 'in_progress') throw new Error('固定遭遇フラグがありません、または戦闘状態と一致しません。');
      }
    }
    return true;
  }

  return {
    SAVE_SCHEMA_VERSION, PARTY_LIMIT, STARTER_IDS, MOVES, SPECIES, MAPS, FIXED_ENCOUNTERS, STORY_EVENT_TILES,
    getSpecies, getMove, statsAtLevel, createCreature, createAdventure,
    addHistory, recordSeen, registerCreature, healCreature, applyDamage,
    processWipe, selectNewStarter, moveToParty, moveToBox, rest, applyPotion,
    calculateDamage, awardExperience, startEncounter, startFixedEncounter, canTriggerFixedEncounter, getFixedEncounterAt, resolveBattleAction,
    renameCreature, movePlayer, getCurrentMapName, getMapName, isAtTownFacility,
    isAtRestSpot, currentRestKind, isAtBoxFacility, makeBackup, parseBackup,
    assertValidSave, killCreature, tileEventHint
  };
});
