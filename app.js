(function () {
  'use strict';

  const G = window.HardcoreGame;
  const root = document.getElementById('game-root');
  const saveIndicator = document.getElementById('save-indicator');
  const toastNode = document.getElementById('toast');
  const DB_NAME = 'lost-route-save';
  const DB_VERSION = 1;
  const STORE_NAME = 'saves';

  let db = null;
  let state = null;
  let tab = 'field';
  let selectedRecordId = null;
  let saveQueue = Promise.resolve();
  let toastTimer = null;
  let lastTick = Date.now();
  let pendingFileRead = false;

  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtDate = value => value ? new Date(value).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtDuration = ms => {
    const seconds = Math.max(0, Math.floor((ms || 0) / 1000));
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
    return `${h}時間 ${m}分`;
  };
  const money = value => `${Number(value || 0).toLocaleString('ja-JP')}円`;
  const currentAdventure = () => state && state.adventure;
  const getMon = id => currentAdventure() && currentAdventure().pokemonRecords[id];
  const species = id => G.getSpecies(id) || { name: '不明', color: '#888', type: 'normal' };

  function setSaveStatus(text, error) {
    saveIndicator.classList.toggle('error', !!error);
    saveIndicator.innerHTML = `<span class="save-dot"></span><span>${escapeHTML(text)}</span>`;
  }

  function notify(message) {
    toastNode.textContent = message;
    toastNode.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2600);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('このブラウザはIndexedDBに対応していません。'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('セーブ領域を開けませんでした。'));
    });
  }

  function dbReadActive() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get('active');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('セーブデータを読み込めませんでした。'));
    });
  }

  function dbWriteActive(snapshot) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, 'active');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('セーブに失敗しました。'));
      tx.onabort = () => reject(tx.error || new Error('セーブ処理が中断されました。'));
    });
  }

  function persist(shouldRender) {
    if (!state) return Promise.resolve();
    state.lastSavedAt = new Date().toISOString();
    state.revision = Number(state.revision || 0) + 1;
    const snapshot = JSON.parse(JSON.stringify(state));
    setSaveStatus('保存中…', false);
    saveQueue = saveQueue.then(() => dbWriteActive(snapshot)).then(() => {
      setSaveStatus(`保存済 ${new Date(state.lastSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`, false);
      if (shouldRender) render();
    }).catch(error => {
      console.error(error);
      setSaveStatus('保存エラー', true);
      notify('セーブに失敗しました。ブラウザの保存領域を確認してください。');
      if (shouldRender) render();
    });
    return saveQueue;
  }

  async function commit(message, shouldRender) {
    await persist(shouldRender !== false);
    if (message) notify(message);
  }

  function monOrb(mon, sizeClass) {
    const sp = species(mon.speciesId);
    const label = sp.name.slice(0, 2);
    return `<div class="mon-orb ${sizeClass || ''}" style="background:${sp.color}" aria-hidden="true">${escapeHTML(label)}</div>`;
  }

  function hpBar(mon) {
    const pct = mon.maxHP ? Math.max(0, Math.min(100, Math.round(mon.currentHP / mon.maxHP * 100))) : 0;
    const stateClass = pct <= 25 ? 'low' : pct <= 55 ? 'mid' : '';
    return `<div class="hp-track"><div class="hp-fill ${stateClass}" style="width:${pct}%"></div></div>`;
  }

  function monMini(id) {
    const mon = getMon(id);
    if (!mon) return '';
    const sp = species(mon.speciesId);
    return `<div class="mon-row">
      ${monOrb(mon)}
      <div class="mon-info"><strong>${escapeHTML(mon.nickname)}</strong><small>${escapeHTML(sp.name)} · Lv.${mon.level} · HP ${mon.currentHP}/${mon.maxHP}${mon.status ? ' · どく' : ''}</small>${hpBar(mon)}</div>
    </div>`;
  }

  function pageHeading(title, subtitle, right) {
    return `<div class="page-heading"><div><div class="eyebrow">${escapeHTML(title)}</div><h1>${escapeHTML(subtitle || '')}</h1></div>${right || ''}</div>`;
  }

  function tabsHTML() {
    const tabs = [
      ['field', '冒険'], ['party', '手持ち'], ['box', 'ボックス'], ['graveyard', '墓場'], ['pokedex', '図鑑'], ['records', '生涯記録'], ['save', 'セーブ']
    ];
    return `<nav class="tabbar" aria-label="ゲームメニュー">${tabs.map(([id, label]) => `<button class="tab ${tab === id ? 'active' : ''}" data-action="tab" data-tab="${id}" ${currentAdventure().activeBattle ? 'disabled' : ''}>${label}</button>`).join('')}</nav>`;
  }

  function tileAt(mapId, x, y, playerX, playerY) {
    let cls = 'tile', label = '·', title = '草地';
    if (mapId === 'town') {
      cls += ' path'; label = '·'; title = '街道';
      if (x >= 2 && x <= 4 && y === 1) { cls += ' house'; label = '⌂'; title = '民家'; }
      if (x === 3 && y === 2) { cls += ' rest'; label = '宿'; title = '休憩所'; }
      if (x === 8 && y === 2) { cls += ' pc'; label = 'PC'; title = '保管端末'; }
      if (x === 5 && y === 0) { cls += ' gate'; label = '↑'; title = '１ばんどうろ'; }
      if ((x === 7 || x === 8 || x === 9) && y === 1) { cls += ' house'; label = '▥'; title = '施設'; }
    } else {
      if (x >= 2 && x <= 8 && y >= 2 && y <= 5) { cls += ' grass'; label = '♧'; title = '草むら'; }
      else { cls += ' path'; label = '·'; title = '道'; }
      if (x === 10 && y === 6) { cls += ' camp'; label = 'C'; title = 'キャンプ'; }
      if (x === 5 && y === 7) { cls += ' gate'; label = '↓'; title = 'マサラタウン'; }
    }
    if (x === playerX && y === playerY) return `<div class="${cls} player" title="現在地: ${title}"><div class="player-token">YOU</div></div>`;
    return `<div class="${cls}" title="${title}"><small>${label}</small></div>`;
  }

  function renderMap() {
    const a = currentAdventure();
    const p = a.location;
    const cells = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) cells.push(tileAt(p.mapId, x, y, p.x, p.y));
    const mapName = G.getCurrentMapName(state);
    const restKind = G.currentRestKind(state);
    const atPC = G.isAtBoxFacility(state);
    return `<section class="panel map-panel">
      <div class="map-top"><div><div class="eyebrow">CURRENT AREA</div><h2>${mapName}</h2></div><span>${p.x + 1} : ${p.y + 1}</span></div>
      <div class="map-grid">${cells.join('')}</div>
      <div class="map-legend"><span><i class="legend-dot" style="background:#50745b"></i>草むら</span><span><i class="legend-dot" style="background:#b58c63"></i>休憩所</span><span><i class="legend-dot" style="background:#6f9a94"></i>保管端末</span><span><i class="legend-dot" style="background:#e2d19c"></i>主人公</span></div>
    </section>
    <div class="panel panel-pad">
      <div class="panel-title">移動 <small>矢印キー / WASD でも操作できます</small></div>
      <div class="map-controls">
        <button class="btn up" data-action="move" data-dx="0" data-dy="-1" aria-label="上へ">↑</button>
        <button class="btn left" data-action="move" data-dx="-1" data-dy="0" aria-label="左へ">←</button>
        <button class="btn down" data-action="move" data-dx="0" data-dy="1" aria-label="下へ">↓</button>
        <button class="btn right" data-action="move" data-dx="1" data-dy="0" aria-label="右へ">→</button>
      </div>
      <div class="btn-row section-gap">
        ${restKind ? `<button class="btn primary" data-action="rest" data-kind="${restKind}">ここで休憩する</button>` : ''}
        ${atPC ? `<button class="btn primary" data-action="tab" data-tab="box">保管端末を開く</button>` : ''}
      </div>
      ${a.recoveryState === 'box_rebuild' ? `<p class="warning-note section-gap">全滅から戻りました。街の保管端末（右上の PC）まで移動し、生存個体を手動で手持ちに戻してください。HP・状態異常は全滅前のままです。</p>` : ''}
      ${a.location.mapId === 'town' && !atPC ? `<p class="muted" style="font-size:10px;margin:12px 0 0">ボックスの整理は街の保管端末で行えます。</p>` : ''}
      ${a.location.mapId === 'route' && !restKind ? `<p class="muted" style="font-size:10px;margin:12px 0 0">草むらでは野生ポケモンと遭遇します。キャンプは右下（C）です。</p>` : ''}
    </div>`;
  }

  function renderField() {
    const a = currentAdventure();
    const partyRows = a.party.map(monMini).join('') || `<div class="empty-note">手持ちが空です。街の保管端末で再編成してください。</div>`;
    return `${pageHeading('FIELD / ADVENTURE', `${escapeHTML(a.playerName)}の冒険`, `<span class="pill">${money(a.money)}</span>`)}
      <div class="status-strip"><span>現在地：<strong>${G.getCurrentMapName(state)}</strong></span><span>最後の休憩：<strong>マサラタウン</strong></span><span>全滅：<strong>${a.wipeCount}回</strong></span></div>
      <div class="field-layout"><div>${renderMap()}</div><aside class="side-stack">
        <section class="panel panel-pad"><div class="panel-title">手持ち <small>${a.party.length}/6</small></div><div class="party-mini">${partyRows}</div><div class="btn-row section-gap"><button class="btn small" data-action="tab" data-tab="party">手持ちを確認</button><button class="btn small" data-action="tab" data-tab="pokedex">図鑑</button></div></section>
        <section class="panel panel-pad"><div class="panel-title">冒険の状況</div>
          <div class="info-line"><span>所持金</span><strong>${money(a.money)}</strong></div>
          <div class="info-line"><span>キズぐすり</span><strong>${a.inventory.potion || 0}個</strong></div>
          <div class="info-line"><span>モンスターボール</span><strong>${a.inventory.pokeball || 0}個</strong></div>
          <div class="info-line"><span>累計プレイ</span><strong>${fmtDuration(a.playTimeMs)}</strong></div>
        </section>
        <section class="panel panel-pad"><div class="panel-title">旅のヒント</div><p style="color:var(--muted);font-size:11px;line-height:1.85;margin:0">HPが0になった個体は、その場で死亡します。死亡した仲間は墓場から戻せません。休憩所を見つけたら、こまめに休みましょう。</p></section>
      </aside></div>`;
  }

  function renderCreatureCard(id, actions) {
    const mon = getMon(id);
    if (!mon) return '';
    const sp = species(mon.speciesId);
    const buttons = actions || '';
    return `<article class="creature-card">
      <div class="mon-row">${monOrb(mon)}<div class="mon-info"><strong>${escapeHTML(mon.nickname)}</strong><small>${escapeHTML(sp.name)} · Lv.${mon.level}</small></div><span class="pill">${mon.currentHP}/${mon.maxHP}</span></div>
      <div class="meta">タイプ：${escapeHTML(sp.type)}${sp.secondaryType ? ` / ${escapeHTML(sp.secondaryType)}` : ''}<br>状態：${mon.status === 'poison' ? 'どく' : '正常'} · 最高Lv.${mon.highestLevel}<br>仲間になった日：${fmtDate(mon.joinedAt)}</div>
      ${hpBar(mon)}
      <div class="card-actions">${buttons}<button class="btn small ghost" data-action="detail" data-id="${mon.id}">生涯記録</button></div>
    </article>`;
  }

  function renderDetail(mon) {
    if (!mon) return '';
    const sp = species(mon.speciesId);
    const timeline = (mon.lifetimeEvents || []).slice().reverse().map(event => `<div class="record-entry"><div><strong>${escapeHTML(event.text)}</strong><small>${fmtDate(event.at)}</small></div></div>`).join('');
    return `<section class="detail-panel"><div class="panel-title">${escapeHTML(mon.nickname)}の生涯記録 <button class="btn small ghost" data-action="close-detail">閉じる</button></div>
      <div class="two-col"><div class="info-line"><span>種類</span><strong>${escapeHTML(sp.name)}</strong></div><div class="info-line"><span>仲間になったLv.</span><strong>${mon.joinedAtLevel}</strong></div><div class="info-line"><span>現在 / 死亡時Lv.</span><strong>${mon.level}</strong></div><div class="info-line"><span>最高Lv.</span><strong>${mon.highestLevel}</strong></div></div>
      ${mon.death ? `<div class="warning-note section-gap">死亡：${fmtDate(mon.death.at)} / 場所：${escapeHTML(mon.death.location)} / 原因：${escapeHTML(mon.death.cause)} / 冒険経過：${fmtDuration(mon.death.elapsedPlayTimeMs)}</div>` : ''}
      <div class="record-list section-gap">${timeline || '<div class="empty-note">履歴はありません。</div>'}</div></section>`;
  }

  function renderParty() {
    const a = currentAdventure();
    const actionsFor = id => `${G.isAtBoxFacility(state) ? `<button class="btn small" data-action="party-to-box" data-id="${id}">ボックスへ</button>` : ''}${a.inventory.potion > 0 ? `<button class="btn small" data-action="use-potion" data-id="${id}">キズぐすり</button>` : ''}`;
    return `${pageHeading('YOUR PARTY', '手持ちポケモン', `<span class="pill">${a.party.length}/6</span>`)}
      <p class="hero-copy" style="margin:0 0 15px">仲間はそれぞれ一度きりの命を持ちます。HPが0になれば、戦闘中・フィールド中を問わず死亡します。</p>
      ${a.party.length ? `<div class="grid-cards">${a.party.map(id => renderCreatureCard(id, actionsFor(id))).join('')}</div>` : '<div class="empty-note">手持ちに生存ポケモンがいません。街の保管端末で再編成してください。</div>'}
      ${selectedRecordId ? renderDetail(getMon(selectedRecordId)) : ''}`;
  }

  function renderBox() {
    const a = currentAdventure();
    const atPC = G.isAtBoxFacility(state);
    const partyActions = id => atPC ? `<button class="btn small" data-action="party-to-box" data-id="${id}">預ける</button>` : '';
    const boxActions = id => atPC ? `<button class="btn small primary" data-action="box-to-party" data-id="${id}" ${a.party.length >= 6 ? 'disabled' : ''}>手持ちに加える</button>` : '';
    return `${pageHeading('LIVING STORAGE', '通常ボックス', `<span class="pill">${a.box.length}匹</span>`)}
      ${!atPC ? `<div class="warning-note">ボックスの入れ替えは街の保管端末でのみ可能です。マップ右上の「PC」タイルまで移動してください。</div>` : '<p class="hero-copy" style="margin:0 0 15px">ここでのみ手持ちとボックスを入れ替えられます。HP・状態異常はそのまま保持されます。</p>'}
      <div class="two-col section-gap"><section><div class="panel-title">手持ち <small>${a.party.length}/6</small></div><div class="grid-cards">${a.party.map(id => renderCreatureCard(id, partyActions(id))).join('') || '<div class="empty-note">手持ちは空です。</div>'}</div></section>
      <section><div class="panel-title">ボックス <small>${a.box.length}匹</small></div><div class="grid-cards">${a.box.map(id => renderCreatureCard(id, boxActions(id))).join('') || '<div class="empty-note">生存個体はいません。</div>'}</div></section></div>
      ${selectedRecordId ? renderDetail(getMon(selectedRecordId)) : ''}`;
  }

  function renderGraveyard() {
    const a = currentAdventure();
    const rows = a.graveyard.map(id => {
      const mon = getMon(id); if (!mon) return '';
      const sp = species(mon.speciesId);
      return `<article class="creature-card"><div class="mon-row">${monOrb(mon)}<div class="mon-info"><strong>${escapeHTML(mon.nickname)}</strong><small>${escapeHTML(sp.name)} · 死亡時 Lv.${mon.death.level}</small></div><span class="pill">永久記録</span></div>
        <div class="meta">死亡日時：${fmtDate(mon.death.at)}<br>死亡場所：${escapeHTML(mon.death.location)}<br>死亡原因：${escapeHTML(mon.death.cause)}<br>冒険経過：${fmtDuration(mon.death.elapsedPlayTimeMs)}</div>
        <div class="card-actions"><button class="btn small ghost" data-action="detail" data-id="${id}">生涯記録を見る</button></div></article>`;
    }).join('');
    return `${pageHeading('GRAVEYARD', '墓場ボックス', `<span class="pill">${a.graveyard.length}匹</span>`)}
      <div class="warning-note">ここに記録された個体は永久に失われています。復活・編成・通常ボックスへの移動はできません。</div>
      <div class="grid-cards section-gap">${rows || '<div class="empty-note">まだ墓場に記録はありません。<br>全員が生きて帰れる旅になりますように。</div>'}</div>
      ${selectedRecordId ? renderDetail(getMon(selectedRecordId)) : ''}`;
  }

  function renderPokedex() {
    const a = currentAdventure();
    const rows = Object.values(G.SPECIES).map(sp => {
      const record = a.pokedex[sp.id];
      return `<div class="pokedex-row ${record ? '' : 'locked'}">${record ? `<div class="mon-orb" style="background:${sp.color}">${escapeHTML(sp.name.slice(0,2))}</div>` : '<div class="mon-orb" style="background:#586467">??</div>'}<div style="flex:1"><strong>${record ? escapeHTML(sp.name) : '？？？？'}</strong><small>${record ? `発見：済 · 捕獲：${record.caught ? '済' : '未'}` : '未発見'}</small></div><span class="pill">${record && record.caught ? 'OWNED' : record ? 'SEEN' : '???'}</span></div>`;
    }).join('');
    const seen = Object.values(a.pokedex).filter(item => item.seen).length;
    const caught = Object.values(a.pokedex).filter(item => item.caught).length;
    return `${pageHeading('FIELD GUIDE', 'ポケモン図鑑', `<span class="pill">${seen}発見 / ${caught}捕獲</span>`)}
      <div class="panel panel-pad"><div class="panel-title">記録の進捗 <small>全滅・再出発後も保持</small></div><div class="info-line"><span>発見した種類</span><strong>${seen}</strong></div><div class="info-line"><span>捕まえた種類</span><strong>${caught}</strong></div></div>
      <div class="grid-cards section-gap">${rows}</div>`;
  }

  function renderRecords() {
    const a = currentAdventure();
    const events = a.historyEvents.map(event => `<div class="record-entry"><div><strong>${escapeHTML(event.text)}</strong><small>${fmtDate(event.at)} · ${escapeHTML(event.type)}</small></div></div>`).join('');
    const living = a.party.concat(a.box).map(id => getMon(id)).filter(Boolean);
    const all = Object.values(a.pokemonRecords);
    return `${pageHeading('ADVENTURE LOG', '冒険の記録', `<span class="pill">${all.length}個体</span>`)}
      <div class="two-col"><section class="panel panel-pad"><div class="panel-title">冒険データ</div>
        <div class="info-line"><span>主人公</span><strong>${escapeHTML(a.playerName)}</strong></div>
        <div class="info-line"><span>開始日時</span><strong>${fmtDate(a.startedAt)}</strong></div>
        <div class="info-line"><span>累計プレイ</span><strong>${fmtDuration(a.playTimeMs)}</strong></div>
        <div class="info-line"><span>全滅回数</span><strong>${a.wipeCount}</strong></div>
        <div class="info-line"><span>生存個体</span><strong>${living.length}匹</strong></div>
        <div class="info-line"><span>墓場の記録</span><strong>${a.graveyard.length}匹</strong></div>
        <div class="info-line"><span>バッジ</span><strong>${a.badges.length}個</strong></div>
      </section><section class="panel panel-pad"><div class="panel-title">歴代個体 <small>${all.length}匹</small></div><div class="record-list">${all.slice().reverse().map(mon => `<div class="record-entry"><div><strong>${escapeHTML(mon.nickname)}</strong><small>${escapeHTML(species(mon.speciesId).name)} · Lv.${mon.level} · ${mon.alive ? (mon.membership === 'party' ? '手持ち' : 'ボックス') : '墓場'}</small></div><button class="btn small ghost" data-action="detail" data-id="${mon.id}">記録</button></div>`).join('')}</div></section></div>
      <section class="panel panel-pad section-gap"><div class="panel-title">冒険ログ <small>最新から表示</small></div><div class="record-list">${events || '<div class="empty-note">まだ記録はありません。</div>'}</div></section>
      ${selectedRecordId ? renderDetail(getMon(selectedRecordId)) : ''}`;
  }

  function renderSave() {
    const a = currentAdventure();
    return `${pageHeading('SAVE & TRANSFER', 'セーブ / バックアップ', '<span class="pill">端末内保存</span>')}
      <div class="two-col"><section class="panel panel-pad"><div class="panel-title">通常セーブ</div>
        <p class="hero-copy" style="margin:0 0 12px">行動ごとにIndexedDBへ自動保存します。死亡・全滅などの処理は一つのセーブレコードとしてまとめて書き込みます。</p>
        <div class="info-line"><span>リビジョン</span><strong>${state.revision}</strong></div>
        <div class="info-line"><span>最終保存</span><strong>${fmtDate(state.lastSavedAt)}</strong></div>
        <button class="btn primary section-gap" data-action="save-now">今すぐ保存</button>
      </section><section class="panel panel-pad"><div class="panel-title">バックアップを書き出す</div>
        <p class="hero-copy" style="margin:0 0 12px">端末故障・機種変更に備えてJSONファイルを保存できます。安全な場所へ保管してください。</p>
        <button class="btn primary" data-action="export">バックアップをダウンロード</button>
      </section></div>
      <section class="panel panel-pad section-gap"><div class="panel-title">バックアップから復元</div>
        <p class="hero-copy" style="margin:0 0 12px">別端末への移行時に使用します。現在の記録は選択したバックアップで置き換わります。古いバックアップは死亡・全滅前の記録へ戻す可能性があります。</p>
        <label class="btn" for="backup-file">JSONバックアップを選択</label><input id="backup-file" type="file" accept="application/json,.json" hidden>
        <p class="warning-note section-gap">ローカルPWAでは、利用者が古いファイルを意図的に復元することを技術的に完全防止できません。復元前に内容と日時を確認してください。</p>
      </section>`;
  }

  function battleCreature(mon, isEnemy) {
    const sp = species(mon.speciesId);
    const label = isEnemy ? 'WILD' : 'YOU';
    const hpPct = Math.round(mon.currentHP / mon.maxHP * 100);
    return `<div class="battle-side ${isEnemy ? 'enemy' : 'player'}">
      <div class="battle-creature" style="background:${sp.color}">${escapeHTML(sp.name.slice(0,2))}</div>
      <div class="battle-meta"><strong><span>${escapeHTML(mon.nickname)}</span><span>Lv.${mon.level}</span></strong><small>${label} · HP ${mon.currentHP}/${mon.maxHP}${mon.status ? ' · どく' : ''}</small><div class="hp-track"><div class="hp-fill ${hpPct <= 25 ? 'low' : hpPct <= 55 ? 'mid' : ''}" style="width:${hpPct}%"></div></div></div>
    </div>`;
  }

  function renderBattle() {
    const a = currentAdventure();
    const battle = a.activeBattle;
    if (!battle) return '';
    const player = getMon(battle.activePokemonId) || getMon(a.party[0]);
    if (!player) return '<div class="empty-note">戦えるポケモンがいません。</div>';
    const moveButtons = player.moves.map(moveId => {
      const move = G.getMove(moveId);
      return `<button class="btn battle-move" data-action="attack" data-move="${move.id}"><strong>${escapeHTML(move.name)}</strong><small>${escapeHTML(move.type)} · 威力 ${move.power || '変化'}</small></button>`;
    }).join('');
    const switchButtons = a.party.filter(id => id !== player.id).map(id => getMon(id)).filter(Boolean).map(mon => `<button class="btn small ghost" data-action="switch" data-id="${mon.id}">${escapeHTML(mon.nickname)}に交代</button>`).join('');
    return `${pageHeading('WILD ENCOUNTER', '野生ポケモンとの戦闘', '<span class="pill">TURN BATTLE</span>')}
      <section class="panel battle-panel">
        <div class="battle-scene">${battleCreature(battle.enemy, true)}${battleCreature(player, false)}</div>
        <div class="battle-log">${battle.log.slice(-3).map(line => `<div>${escapeHTML(line)}</div>`).join('')}</div>
        <div class="battle-controls"><div><div class="panel-title">わざを選ぶ <small>攻撃</small></div><div class="move-grid">${moveButtons}</div></div>
          <div><div class="panel-title">行動 <small>道具・逃走</small></div><div class="btn-row"><button class="btn small" data-action="potion-battle" ${a.inventory.potion <= 0 || player.currentHP >= player.maxHP ? 'disabled' : ''}>キズぐすり (${a.inventory.potion || 0})</button><button class="btn small" data-action="throw" ${a.inventory.pokeball <= 0 ? 'disabled' : ''}>ボール (${a.inventory.pokeball || 0})</button><button class="btn small danger" data-action="run">逃げる</button></div>
          ${switchButtons ? `<div class="panel-title section-gap">交代</div><div class="btn-row">${switchButtons}</div>` : ''}
          </div>
        </div>
      </section>
      <p class="muted" style="font-size:10px;margin:10px 2px">戦闘中にHPが0になった仲間は即時に死亡し、墓場へ移動します。逃走失敗中も相手の行動が発生します。</p>`;
  }

  function renderStarterSelection(isRestart) {
    const title = isRestart ? '再出発する仲間を選ぶ' : '最初の仲間を選ぶ';
    const copy = isRestart ? '通常ボックスにも生存ポケモンがいません。冒険の記録・図鑑・道具・バッジはそのままに、新しいLv.5の仲間と旅を続けます。' : 'この選択が、最初の旅の始まりです。仲間の命は一度きり。';
    return `<section class="panel hero-panel">
      <div class="eyebrow">${isRestart ? 'A NEW BEGINNING' : 'NEW ADVENTURE'}</div>
      <h1 class="hero-title">${title}</h1>
      <p class="hero-copy">${copy}</p>
      <form id="starter-form">
        ${!isRestart ? `<div class="form-field"><label for="player-name">主人公の名前</label><input id="player-name" name="playerName" maxlength="20" required placeholder="名前を入力" value="トレーナー"></div>` : ''}
        <div class="starter-grid">${G.STARTER_IDS.map(id => {
          const sp = species(id);
          return `<label class="starter-choice"><input type="radio" name="starter" value="${id}" ${id === 'bulbasaur' ? 'checked' : ''}><div class="mon-orb" style="background:${sp.color}">${escapeHTML(sp.name.slice(0,2))}</div><strong>${escapeHTML(sp.name)}</strong><small>${escapeHTML(sp.type)} · Lv.5</small></label>`;
        }).join('')}</div>
        <button class="btn primary" type="submit">${isRestart ? 'この仲間と再出発' : '冒険を始める'}</button>
      </form>
    </section>`;
  }

  function renderNicknameModal() {
    const id = currentAdventure().pendingNicknameId;
    if (!id) return '';
    const mon = getMon(id);
    if (!mon) return '';
    return `<div class="modal-backdrop"><section class="modal"><div class="eyebrow">NEW COMPANION</div><h2>${escapeHTML(mon.nickname)}を仲間にした！</h2><p>この個体につけるニックネームを決めてください。あとから生涯記録で確認できます。</p><form id="nickname-form"><input class="text-input" name="nickname" maxlength="14" placeholder="ニックネーム" value="${escapeHTML(mon.nickname)}"><div class="btn-row"><button class="btn primary" type="submit">決定</button><button class="btn ghost" type="button" data-action="skip-nickname">そのままにする</button></div></form></section></div>`;
  }

  function render() {
    if (!state) {
      root.innerHTML = renderStarterSelection(false);
      return;
    }
    const a = currentAdventure();
    if (a.recoveryState === 'starter_select') {
      root.innerHTML = renderStarterSelection(true);
      return;
    }
    if (a.pendingNicknameId) {
      // Render the normal field underneath the nickname prompt so a capture result is not lost.
      tab = 'field';
    }
    let content;
    if (a.activeBattle) content = renderBattle();
    else {
      switch (tab) {
        case 'party': content = renderParty(); break;
        case 'box': content = renderBox(); break;
        case 'graveyard': content = renderGraveyard(); break;
        case 'pokedex': content = renderPokedex(); break;
        case 'records': content = renderRecords(); break;
        case 'save': content = renderSave(); break;
        default: tab = 'field'; content = renderField(); break;
      }
    }
    root.innerHTML = `${tabsHTML()}${content}${renderNicknameModal()}`;
  }

  async function startNewGame(form) {
    const fd = new FormData(form);
    const starterId = fd.get('starter');
    const playerName = fd.get('playerName');
    try {
      state = G.createAdventure(playerName || 'トレーナー', starterId);
      tab = 'field';
      selectedRecordId = null;
      await commit('冒険を開始しました。', true);
    } catch (error) { notify(error.message); }
  }

  async function pickStarter(form) {
    const fd = new FormData(form);
    try {
      G.selectNewStarter(state, fd.get('starter'));
      tab = 'field';
      await commit('新しい仲間と再出発しました。', true);
    } catch (error) { notify(error.message); }
  }

  async function performMove(dx, dy) {
    const result = G.movePlayer(state, dx, dy);
    if (!result.ok) { notify(result.reason); return; }
    await persist(true);
  }

  async function performRest(kind) {
    const result = G.rest(state, kind);
    if (!result.ok) { notify(result.reason); return; }
    await commit(kind === 'town' ? '街で休憩しました。手持ちのHPと状態異常を回復しました。' : 'キャンプで休憩しました。復帰先の街は変わりません。', true);
  }

  async function doBattleAction(action) {
    const result = G.resolveBattleAction(state, action);
    if (!result.ok) { notify(result.reason); return; }
    if (result.defeated) await commit('野生ポケモンに勝利しました。', true);
    else if (result.escaped) await commit('戦闘から離脱しました。', true);
    else if (result.caughtId) await commit('新しい仲間が加わりました。', true);
    else await persist(true);
  }

  async function transfer(action, id) {
    const result = action === 'box-to-party' ? G.moveToParty(state, id, G.isAtBoxFacility(state)) : G.moveToBox(state, id, G.isAtBoxFacility(state));
    if (!result.ok) { notify(result.reason); return; }
    selectedRecordId = null;
    await commit(action === 'box-to-party' ? '手持ちに加えました。' : 'ボックスに預けました。', true);
  }

  function downloadBackup() {
    try {
      const backup = G.makeBackup(state);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lost-route-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notify('バックアップを書き出しました。');
    } catch (error) { notify(`書き出しに失敗しました: ${error.message}`); }
  }

  async function restoreBackup(file) {
    if (!file || pendingFileRead) return;
    pendingFileRead = true;
    try {
      const content = await file.text();
      const backup = G.parseBackup(content);
      const backupSaved = new Date(backup.state.lastSavedAt || backup.exportedAt).getTime();
      const currentSaved = new Date(state.lastSavedAt || 0).getTime();
      const isOlder = currentSaved && backupSaved < currentSaved;
      const warning = isOlder
        ? '\n\n警告：このバックアップは現在の端末のセーブより古い日時です。死亡・全滅などの結果を巻き戻す可能性があります。'
        : '';
      const accepted = window.confirm(`バックアップ（最終保存：${fmtDate(backup.state.lastSavedAt)}）で現在の冒険データを置き換えます。${warning}\n\n復元を続行しますか？`);
      if (!accepted) return;
      G.assertValidSave(backup.state);
      state = backup.state;
      tab = 'field';
      selectedRecordId = null;
      await commit('バックアップを復元しました。', true);
    } catch (error) {
      console.error(error);
      notify(`復元できませんでした: ${error.message}`);
    } finally {
      pendingFileRead = false;
    }
  }

  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    try {
      if (action === 'tab') { tab = button.dataset.tab; selectedRecordId = null; render(); }
      else if (action === 'move') await performMove(Number(button.dataset.dx), Number(button.dataset.dy));
      else if (action === 'rest') await performRest(button.dataset.kind);
      else if (action === 'party-to-box' || action === 'box-to-party') await transfer(action, id);
      else if (action === 'use-potion') {
        const result = G.applyPotion(state, id);
        if (!result.ok) notify(result.reason); else await commit(`HPが${result.healed}回復しました。`, true);
      }
      else if (action === 'attack') await doBattleAction({ type: 'attack', moveId: button.dataset.move });
      else if (action === 'throw') await doBattleAction({ type: 'throw' });
      else if (action === 'run') await doBattleAction({ type: 'run' });
      else if (action === 'potion-battle') await doBattleAction({ type: 'potion' });
      else if (action === 'switch') await doBattleAction({ type: 'switch', creatureId: id });
      else if (action === 'save-now') await commit('セーブしました。', true);
      else if (action === 'export') downloadBackup();
      else if (action === 'detail') { selectedRecordId = id; render(); }
      else if (action === 'close-detail') { selectedRecordId = null; render(); }
      else if (action === 'skip-nickname') {
        G.renameCreature(state, currentAdventure().pendingNicknameId, getMon(currentAdventure().pendingNicknameId).nickname);
        await persist(true);
      }
    } catch (error) {
      console.error(error);
      notify(`処理に失敗しました: ${error.message}`);
    }
  });

  root.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.target.id === 'starter-form') {
      if (!state) await startNewGame(event.target); else await pickStarter(event.target);
    } else if (event.target.id === 'nickname-form') {
      const nickname = new FormData(event.target).get('nickname');
      const id = currentAdventure().pendingNicknameId;
      G.renameCreature(state, id, nickname);
      await commit('ニックネームを登録しました。', true);
    }
  });

  root.addEventListener('change', event => {
    if (event.target.id === 'backup-file') {
      restoreBackup(event.target.files && event.target.files[0]);
      event.target.value = '';
    }
  });

  document.addEventListener('keydown', event => {
    if (!state || currentAdventure().activeBattle || currentAdventure().recoveryState !== 'none') return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const map = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
    };
    if (map[event.key] && tab === 'field') {
      event.preventDefault();
      performMove(map[event.key][0], map[event.key][1]);
    }
  });

  window.addEventListener('pagehide', () => {
    if (state && db) {
      state.lastSavedAt = new Date().toISOString();
      state.revision = Number(state.revision || 0) + 1;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(JSON.parse(JSON.stringify(state)), 'active');
    }
  });

  async function init() {
    try {
      db = await openDatabase();
      const loaded = await dbReadActive();
      if (loaded) {
        G.assertValidSave(loaded);
        state = loaded;
        setSaveStatus(`保存済 ${new Date(state.lastSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`, false);
      } else setSaveStatus('新規冒険', false);
    } catch (error) {
      console.error(error);
      setSaveStatus('保存領域エラー', true);
      notify(`保存領域にアクセスできません: ${error.message}`);
    }
    render();
    setInterval(() => {
      if (!state) return;
      const now = Date.now();
      const delta = Math.max(0, Math.min(30000, now - lastTick));
      lastTick = now;
      currentAdventure().playTimeMs += delta;
      if (Math.floor(currentAdventure().playTimeMs / 30000) !== Math.floor((currentAdventure().playTimeMs - delta) / 30000)) persist(false);
    }, 1000);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Service worker registration failed:', error));
    }
  }

  init();
})();
