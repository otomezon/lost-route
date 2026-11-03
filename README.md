# LOST ROUTE — Hardcore RPG PWA v0.3

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
- In Masara Town, move to the top-centre gate to enter １ばんどうろ; continue north to Viridian City, Route 2, Viridian Forest and Pewter City.
- Move through the grass to trigger recurring wild encounters.
- In battle, choose a move, use a potion, throw a Poké Ball, switch party member, or attempt to run.
- The town's `PC` tile opens living-box organization. Only transfer living creatures here.
- The `宿` tile in town and `C` campsite on Route 1 are designated rest spots.
- Tabs provide party, living box, graveyard, Pokédex, lifetime records, and backup/export/restore.

## Included in this slice

- Starter selection: フシギダネ / ヒトカゲ / ゼニガメ.
- Sample roster: ポッポ, コラッタ, キャタピー, ビードル, ピカチュウ, コイル, ビリリダマ, マルマイン, サンダー plus the three starters.
- マサラタウン、１ばんどうろ、むじんはつでんしょの3エリア。草むらの通常遭遇に加え、道路の発電所のマルマイン固定シンボルとサンダー伝説遭遇を実装。
- 固定／伝説遭遇はマップ接触時に消費し、撃破・逃走・捕獲・全滅などの結果を記録。捕獲失敗回数も残し、再出現は許可しない。
- ターン制戦闘、追加技、捕獲とニックネーム入力を実装。
- Shared HP-damage/death path for battle and field poison. HP 0 immediately marks an individual dead and transfers it to the permanent graveyard.
- Party/living box/graveyard separation, individual IDs, join/death metadata, lifetime event list, Pokédex seen/caught flags.
- One-time encounter state primitive and map integration: fixed encounters are consumed when they begin, and their terminal outcomes/capture failures are persisted.
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

This is a playable core slice, not the complete game. The sample roster is not the complete 151-species roster. The remaining Kanto map, gyms, rivals, story and key items, complete Generation I move/type/status and battle edge cases, full evolution system, additional encounter sites, and endgame survivor bookkeeping remain follow-on work. The initial combat formulas are first-generation-style approximations and are not certified bit-for-bit compatible with Red/Green.

## Fixed and legendary encounters (v0.2)

- Route 1 entrance near the upper-right path leads to the Power Plant. The Power Plant has recurring Magnemite / Voltorb / Pikachu encounters, a one-time Electrode fixed symbol at x=3, y=4, and one Zapdos legendary symbol at x=6, y=2.
- A fixed or legendary encounter is consumed on contact. Capture may be attempted within that single active battle; failed capture attempts are counted. After battle termination by defeat, escape, capture, or wipe, the location cannot be retriggered.
- Map positions and demo levels are AI-decided prototype content, not final story canon.

## Tests

From this directory:

```sh
node --test tests/game-core.test.js
```

See `../../TESTS/P-001_CORE_ACCEPTANCE.md`, `../../TESTS/P-001_TEST_RESULTS.md`, and `../../TESTS/P-002_ACCEPTANCE.md` / `P-002_TEST_RESULTS.md` for evidence and known verification limitations.

## Kanto opening region (v0.3)

- Added the playable connection Masara Town → Route 1 → Viridian City → Route 2 → Viridian Forest → Pewter City.
- Added regional wild encounters: Nidoran♂, Nidoran♀, Oddish, Metapod and Kakuna.
- Added persistent area-discovery flags and one-time story events: the Viridian guide message and a Potion pickup in Viridian Forest.
- Added designated rest and storage-terminal tiles in Viridian City and Pewter City. As in the original rules, box members retain their HP/status and party rebuild remains manual.
- Corrected wipe recovery to return to the last town where the player rested, not always Masara Town. A full restart with no living box members still begins at Masara Town.
- Story event flags, discovered areas, inventory rewards, Pokédex, badges and lifetime records are kept in the same adventure save snapshot and are not cleared on wipe/restart.

Pewter Gym is currently represented as a map landmark only; trainer battles, gym leader, badge award and story gate sequencing are follow-on work. Map positions, encounter levels/probabilities and demo event rewards are provisional implementation defaults.
