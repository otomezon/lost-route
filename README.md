# LOST ROUTE — Hardcore RPG PWA (first playable slice)

This is a dependency-free browser game prototype implementing the irreversible creature lifecycle and wipe/restart loop from the supplied system design.

## Run locally

From the project root:

```sh
python3 -m http.server 8080 --directory IMPLEMENTATION/app
```

Open `http://localhost:8080` in a current browser. For PWA installation and offline caching, use `localhost` or an HTTPS origin; opening the HTML file directly is not sufficient for Service Worker registration.

No package install or build step is required. All runtime code is native HTML, CSS, and JavaScript.

## Controls and first play

- Choose the protagonist name and one of the three level-5 starters.
- Move with the on-screen arrow pad or keyboard arrows / WASD.
- In town, move to the top-centre gate to enter １ばんどうろ.
- Move through the grass to trigger recurring wild encounters.
- In battle, choose a move, use a potion, throw a Poké Ball, switch party member, or attempt to run.
- The town's `PC` tile opens living-box organization. Only transfer living creatures here.
- The `宿` tile in town and `C` campsite on Route 1 are designated rest spots.
- Tabs provide party, living box, graveyard, Pokédex, lifetime records, and backup/export/restore.

## Included in this slice

- Starter selection: フシギダネ / ヒトカゲ / ゼニガメ.
- Small sample roster: ポッポ, コラッタ, キャタピー, ビードル, ピカチュウ plus the starters.
- One town and one route, grid movement, recurring grass encounters, turn-based combat, a compact move/type table, catch flow and nickname prompt.
- Shared HP-damage/death path for battle and field poison. HP 0 immediately marks an individual dead and transfers it to the permanent graveyard.
- Party/living box/graveyard separation, individual IDs, join/death metadata, lifetime event list, Pokédex seen/caught flags.
- One-time encounter state primitive: a fixed encounter is consumed when it begins, and its terminal outcome is persisted.
- Designated town/camp rest, potions, wipe processing, floor-half money, item retention, last town return, and both recovery branches.
- IndexedDB single-record save, JSON backup/restore with integrity validation and older-backup warning.
- Web App Manifest and a versioned Service Worker app-shell cache.

## Permanent-death rules in the implementation

`applyDamage()` is the shared damage entry point. If it reduces a living individual to HP 0, `killCreature()` records death time, place, cause, level, and adventure elapsed time, removes the individual from party/box, and places the same record in graveyard. There is no revive or transfer API from graveyard.

Wipe is processed after the active party becomes empty. It is idempotent while a recovery choice is pending: wipe count increments once, money becomes `Math.floor(money / 2)`, inventory is retained, and the game returns to town. If the living box is not empty, party remains empty until the player manually transfers a creature at the PC. Otherwise, the player selects a new level-5 starter while long-term data remains.

## Save and backup notes

- Actions write the entire adventure as one IndexedDB object-store record in a read/write transaction. This prevents partial field-level updates to the record.
- The app attempts a final write on `pagehide`; irreversible game actions are also saved immediately after their handler.
- Backups use schema version 1 and are validated for party/box/graveyard membership consistency.
- Import warns when the imported record is older than the current local save. A purely local PWA cannot cryptographically stop deliberate restoration of an older exported file.

## Scope not yet implemented

This is a playable core slice, not the complete game. The sample roster is not the complete 151-species roster. The full Kanto map, gyms, rivals, story and key items, complete Generation I move/type/status and battle edge cases, full evolution system, legendary/fixed encounter map content, and endgame survivor bookkeeping remain follow-on work. The initial combat formulas are first-generation-style approximations and are not certified bit-for-bit compatible with Red/Green.

## Tests

From this directory:

```sh
node --test tests/game-core.test.js
```

See `../../TESTS/P-001_CORE_ACCEPTANCE.md` and `../../TESTS/P-001_TEST_RESULTS.md` for evidence and known verification limitations.
