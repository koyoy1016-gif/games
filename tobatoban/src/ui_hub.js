/* =====================================================================
   ui_hub.js — 拠点・出動（章タブ）・編成（並び替え／絞り込み）・詳細・図鑑・結果のEXP・上野の準備
   所持とレベルは「ログイン中のアカウント」、していなければ「この画面を開いている間だけの記録」（G.guest）
   ===================================================================== */
const ACC = () => G.acct || G.guest;
const lvOf = id => SAVE.lvOf(ACC(), id);
const eqOf = id => { const a = ACC(), c = a && a.chars[id]; return c && c.eq ? c.eq.slice(0, SAVE.eqSlots(a)) : []; };
const ownsCh = id => SAVE.owns(ACC(), id);
const newBid = () => 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); // 戦闘ID（報酬を一度だけにする）
const RANK_I = { S: 0, A: 1, B: 2, C: 3, D: 4 }, CH_I = Object.fromEntries(DATA.CHARS.map((c, i) => [c.id, i]));
/** 編成を、持っているキャラだけ・重なりなしに直す */
function fixParty() {
  const used = new Set(), out = [];
  for (const id of G.party) if (DATA.CHI[id] && ownsCh(id) && !used.has(id)) { out.push(id); used.add(id); }
  for (const id of DATA.DEFAULT_PARTY.concat(DATA.CHAR_IDS)) { if (out.length >= 4) break; if (ownsCh(id) && !used.has(id)) { out.push(id); used.add(id); } }
  G.party = out.slice(0, 4); STORE.set('party', G.party);
}
G.sessClear = {};
const cleared = id => !!((ACC() && ACC().clear && ACC().clear[id] > 0) || G.sessClear[id]);
/** ステージの解放：電車＝トバトーバン初勝利、居酒屋通り＝電車の初クリア、ヨシノシン＝通りの初クリア（旧版で解放済みならそのまま）、秋葉原＝ヨシノシン初勝利、駅前広場＝ホーム初勝利 */
const stageOpen = id => {
  const a = ACC() || {};
  switch (id) {
    case 'senju': return true;
    case 'joban': return cleared('senju');
    case 'ueno_street': return cleared('joban');
    case 'ueno': return cleared('ueno_street') || !!a.uenoOpen;
    case 'akiba_platform': return cleared('ueno') || !!a.akibaOpen;
    case 'akiba_plaza': return cleared('akiba_platform');
  }
  return false;
};
const STAGES = [
  { id: 'senju', ch: 0, cls: 's1', ic: '🏮', no: '北千住編', nm: '商店街と祭り広場', en: 'トバトーバン（古い大看板の付喪神）', d: '宵町のアーケード通りを抜けて、祭り広場で大看板の付喪神を鎮める。', rec: 1, lock: '' },
  { id: 'joban', ch: 1, cls: 's2', ic: '🚃', no: '上野編', nm: '常磐線 北千住→上野', en: `ヨシノシンの部下 ${DATA.JOBAN.events.reduce((s, e) => s + e.n, 0)}体`, d: '青い常磐線の2号車・3号車で戦う。1号車側と3号車側の両方から部下が来る。全員倒すと上野に着く。', rec: 20, lock: 'トバトーバンを1回倒すと解放' },
  { id: 'ueno_street', ch: 1, cls: 's2', ic: '🏮', no: '上野編', nm: '上野の居酒屋通り', en: 'ヨシノシンの部下 30体（3地点×10体）', d: '改札を抜け、暖簾と提灯の並ぶ飲み屋街を進む。各地点の10体を倒すと先へ進める。', rec: 20, lock: '電車を1回クリアすると解放' },
  { id: 'ueno', ch: 1, cls: 's3', ic: '🎌', no: '上野編', nm: '上野駅前 ヨシノシン', en: 'ヨシノシン（HP30,000の指揮官）＋部下36体〜', d: '駅前の広場で、部下を人形のように操る巨大な指揮官と戦う。HP75%・50%・25%の「30分睡眠チャージ」を10秒で止めよう。', rec: 40, lock: '居酒屋通りを1回クリアすると解放' },
  { id: 'akiba_platform', ch: 2, cls: 's2', ic: '🚉', no: '秋葉原編', nm: '秋葉原駅ホーム', en: 'オガ・カエ（各HP4,000）', d: '閉鎖されたホームで2人と戦う前哨戦。前方の攻撃をよけて背後へ回ろう。', rec: 60, lock: 'ヨシノシンを1回倒すと解放' },
  { id: 'akiba_plaza', ch: 2, cls: 's3', ic: '⭐', no: '秋葉原編', nm: '秋葉原駅前広場', en: '星・中（各HP8,000）＋オガ・カエ', d: '星と中は、片方を倒してから15秒以内にもう片方も倒さないと復活する。2〜4人で結ぶ図形の攻撃に注意。', rec: 60, lock: '秋葉原駅ホームを1回クリアすると解放' },
];
const avgLv = ids => Math.floor(ids.reduce((s, id) => s + lvOf(id), 0) / Math.max(1, ids.length));
const roleIc = id => DATA.ROLES[id] ? DATA.ROLES[id].ic + DATA.ROLES[id].short : '';
const rankBadge = (rk, cls) => { const b = el('span', cls || 'rk', DATA.RANK_INFO[rk].ic + rk); b.style.background = DATA.RANK_INFO[rk].col; return b; };

/* ---------- 出動（章タブ） ---------- */
function openSortie(ch) { if (ch != null) G.chTab = ch; else if (G.chTab == null) G.chTab = 0; fixParty(); renderSortie(); show('stage'); }
function renderSortie() {
  document.querySelectorAll('#chTabs .tab').forEach(t => t.classList.toggle('on', +t.dataset.ch === G.chTab));
  const box = $('#stages'); box.textContent = '';
  for (const s of STAGES.filter(q => q.ch === G.chTab)) {
    const open = stageOpen(s.id), b = el('button', 'stage-card ' + s.cls + (open ? '' : ' locked')); b.type = 'button';
    const top = el('div', 'sc-top'); top.append(el('span', 'ic', s.ic)); const tt = el('div'); tt.append(el('small', '', s.no), el('b', '', s.nm)); top.appendChild(tt);
    if (s.rec > 1) top.appendChild(el('span', 'rec', `推奨Lv${s.rec}`));
    const body = el('div', 'sc-body'); body.append(el('span', 'en', '敵：' + s.en), el('span', '', s.d));
    const pl = avgLv(G.party); if (s.rec > 1) body.appendChild(el('span', 'small', `いまの編成の平均Lv ${pl}${pl < s.rec ? '（低くても挑戦できます）' : ''}`));
    if (s.id === 'ueno' || s.id.startsWith('akiba')) { const k = DATA.lvAdjust(s.id === 'ueno' ? 'ueno' : 'akiba', pl); body.appendChild(el('span', 'small', `${s.id === 'ueno' ? '上野ボス' : '秋葉原'}だけのLv補正：与えるダメージ×${k.out.toFixed(2)}・受けるダメージ×${k.in.toFixed(2)}`)); }
    if (cleared(s.id)) body.appendChild(el('span', 'clr', 'クリア済み'));
    if (open) body.appendChild(el('span', 'go', '出動する ▶'));
    b.append(top, body);
    if (!open) { const lk = el('div', 'lock'); lk.append(el('span', 'lk', '🔒'), el('span', '', s.lock)); b.appendChild(lk); }
    b.onclick = () => { if (!open) { AUDIO.sfx('back'); mtoast(s.lock, 2400); return; } AUDIO.sfx('ok'); startSolo(s.id); };
    box.appendChild(b);
  }
  const sp = $('#sortieParty'); sp.textContent = ''; sp.appendChild(el('span', '', `編成（平均Lv ${avgLv(G.party)}）`));
  G.party.forEach((id, i) => { const m = el('span', 'mini'); const im = el('img'); im.src = G.thumbs[id] || ''; im.alt = ''; m.append(im, el('span', '', `${DATA.CHI[id].nm} Lv${lvOf(id)}${i ? '（AI）' : ''}`)); sp.appendChild(m); });
}
/* ---------- 上野の準備（電車クリアのあと） ---------- */
/** ボス戦の準備（上野ボス／秋葉原の駅前広場）。HP・スタミナ全回復、気絶解除、妖気は最低50、重玉は0 */
function openPrep(st) {
  st = st || G.prepStage || 'ueno'; G.prepStage = st;
  fixParty(); const kv = $('#prepKv'); kv.textContent = ''; const P = avgLv(G.party), ak = st === 'akiba_plaza', k = DATA.lvAdjust(ak ? 'akiba' : 'ueno', P);
  $('#prepEyebrow').textContent = ak ? '秋葉原駅前' : '上野駅前'; $('#prepTitle').textContent = ak ? '星と中が待っている' : 'ヨシノシンが待っている';
  $('#prepLead').textContent = ak ? 'ホームの報酬は確定しました。装備・アイテムを見直してから挑めます。' : '居酒屋通りの報酬は確定しました。このまま挑むか、編成・装備を見直してから挑めます。';
  $('#btnPrepGo').textContent = ak ? 'このまま駅前広場へ' : 'このままヨシノシンへ';
  for (const [kk, v] of [['推奨Lv', ak ? '60' : '40'], ['いまの平均Lv', String(P)], ['Lv補正', `与えるダメージ×${k.out.toFixed(2)}・受けるダメージ×${k.in.toFixed(2)}`], ['編成', G.party.map(id => `${DATA.CHI[id].nm} Lv${lvOf(id)}${eqOf(id).length ? '（' + eqOf(id).map(e => DATA.EQUIP_I[e].ic).join('') + '）' : ''}`).join('・')], ['回復', 'HP・スタミナ全回復、気絶は解除、必殺ゲージは50%から、重玉は0']]) { kv.appendChild(el('b', '', kk)); kv.appendChild(el('span', '', v)); }
  show('prep');
}
/** 戦闘から抜けて（結果を見たあと）メニューへ */
function leaveBattle() { if (G.session) { try { G.session.leave(); } catch (e) { } } G.session = null; G.mode = 'title'; G.v = null; R.clearEntities(); AUDIO.bgm('title'); $('#hud').hidden = true; }
function persistPrefs() { const a = ACC(); if (a) a.prefs = Object.assign(a.prefs || {}, G.prefs || {}); STORE.set('prefs', G.prefs); }

/* ---------- 編成・図鑑（並び替え・絞り込み） ---------- */
G.prefs = Object.assign({ sort: 'level_desc', rank: [], role: [], tags: [], q: '', newOnly: false, owned: true }, STORE.get('prefs', {}));
const ALL_TAGS = [...new Set(DATA.CHARS.flatMap(c => c.tags || []))];
function openZukan(back) { G.coop = false; G.teamMode = 'zukan'; G.teamBack = back || 'title'; $('#teamEyebrow').textContent = '図鑑'; $('#teamTitle').textContent = `もののけ ${Object.keys(ACC().chars).length} / ${DATA.CHARS.length}体`; $('#lobCode').hidden = true; $('#lobStatus').hidden = true; $('#btnRecommend').hidden = true; $('#itemsBox').hidden = true; $('#btnGo').textContent = '編成へ'; $('#btnGo').disabled = false; G.focus = G.focus || G.party[0]; renderTeam(); show('team'); }
function sortedList() {
  const a = ACC(), P = G.prefs, zk = G.teamMode === 'zukan';
  let list = DATA.CHARS.filter(c => (zk && !P.owned) || SAVE.owns(a, c.id));
  if (P.rank.length) list = list.filter(c => P.rank.includes(c.rank));
  if (P.role.length) list = list.filter(c => P.role.includes(c.roleId));
  if (P.tags.length) list = list.filter(c => (c.tags || []).some(t => P.tags.includes(t)));
  if (P.q) list = list.filter(c => c.nm.includes(P.q));
  if (P.newOnly) list = list.filter(c => a.chars[c.id] && !a.chars[c.id].seen);
  const lv = c => (a.chars[c.id] ? a.chars[c.id].lv : 0), got = c => (a.chars[c.id] ? a.chars[c.id].got || 0 : 9e15), rk = c => RANK_I[c.rank], id = c => CH_I[c.id];
  const cmp = { level_desc: (x, y) => lv(y) - lv(x) || rk(x) - rk(y) || got(x) - got(y) || id(x) - id(y), rank_desc: (x, y) => rk(x) - rk(y) || lv(y) - lv(x) || got(x) - got(y) || id(x) - id(y), level_asc: (x, y) => lv(x) - lv(y) || rk(x) - rk(y) || got(x) - got(y) || id(x) - id(y), newest: (x, y) => got(y) - got(x) || id(x) - id(y) }[P.sort] || ((x, y) => id(x) - id(y));
  return list.sort(cmp);
}
function renderFilters() {
  const P = G.prefs, mk = (box, arr, key, lab) => { box.textContent = ''; for (const v of arr) { const b = el('button', 'chip' + (P[key].includes(v) ? ' on' : ''), lab ? lab(v) : v); b.type = 'button'; b.onclick = () => { const i = P[key].indexOf(v); if (i >= 0) P[key].splice(i, 1); else P[key].push(v); AUDIO.sfx('ui'); persistPrefs(); renderTeam(); }; box.appendChild(b); } };
  mk($('#rsRank'), DATA.RANKS, 'rank'); mk($('#rsRole'), DATA.ROLE_IDS, 'role', v => DATA.ROLES[v].ic + DATA.ROLES[v].short); mk($('#rsTags'), ALL_TAGS, 'tags');
  $('#rsNew').classList.toggle('on', !!P.newOnly); $('#rsSort').value = P.sort;
  const n = P.rank.length + P.role.length + P.tags.length + (P.q ? 1 : 0) + (P.newOnly ? 1 : 0); $('#rsFilterBtn').textContent = n ? `絞り込み（${n}）` : '絞り込み';
}
function clearFilters() { Object.assign(G.prefs, { rank: [], role: [], tags: [], q: '', newOnly: false }); $('#rsQ').value = ''; persistPrefs(); renderTeam(); }
function roleSummary(ids) { const n = { attacker: 0, tank: 0, ranger: 0, healer: 0 }; for (const id of ids) n[DATA.CHI[id].roleId]++; return n; }
function renderTeam() {
  const box = $('#slots'); box.textContent = '';
  const coop = G.coop, S = G.session, zk = G.teamMode === 'zukan';
  let lob = null; if (coop && S) lob = S.kind === 'host' ? S.lobbyMsg() : S.lobby;
  box.hidden = zk; $('#partySum').hidden = zk;
  for (let i = 0; i < 4 && !zk; i++) {
    const b = el('button', 'slot'); b.type = 'button';
    let ch = G.party[i], nm = DATA.CHI[ch].nm, tag = i === 0 ? 'あなた' : 'AI', lv = lvOf(ch);
    if (coop) {
      const s = lob && lob.slots[i];
      if (s) { ch = s.ch; nm = s.nick; tag = s.peer === (S.tr && S.tr.self) ? 'あなた' : '参加者'; lv = s.peer === (S.tr && S.tr.self) ? lvOf(ch) : (s.lv || 1); }
      else if (lob && lob.ai) { ch = lob.ai[i] || 'kogemaru'; nm = DATA.CHI[ch].nm; tag = 'AI'; lv = (lob.aiLv && lob.aiLv[i]) || 1; }
      else { tag = '空き'; }
      if (i === myLobbySlot()) b.classList.add('sel');
    } else if (i === G.selSlot) b.classList.add('sel');
    const c = DATA.CHI[ch] || DATA.CHARS[0];
    const pn = el('span', 'pn', 'P' + (i + 1)); pn.style.background = pcol(i); b.appendChild(pn);
    const im = el('img'); im.src = G.thumbs[ch] || ''; im.alt = ''; b.appendChild(im);
    b.appendChild(el('span', 'nm', nm)); const mt = el('span', 'meta'); mt.append(rankBadge(c.rank), el('span', 'lv', 'Lv.' + lv), el('span', 'role', roleIc(c.roleId))); b.appendChild(mt);
    const t = el('span', tag === 'AI' ? 'tag ai' : 'tag', tag); if (tag === 'あなた') t.style.background = 'var(--shu)'; b.appendChild(t);
    if (tag === 'AI') b.appendChild(el('span', 'ai-t', 'AI：能力90%／EXP80%'));
    if (!coop) b.onclick = () => { G.selSlot = i; G.focus = G.party[i]; AUDIO.sfx('ui'); renderTeam(); };
    box.appendChild(b);
  }
  if (!zk) { // 役割の内訳と短い助言（編成を禁止しない）
    const ids = coop ? [G.party[0]] : G.party, n = roleSummary(ids), sum = $('#partySum'); sum.textContent = '';
    if (!coop) { sum.appendChild(el('span', '', `攻撃${n.attacker}・壁${n.tank}・補助${n.ranger}・回復${n.healer}`)); sum.appendChild(el('span', '', `平均Lv ${avgLv(ids)}`)); const adv = !n.healer ? '回復役がいません。キャンディーと救助の円を活用しよう' : !n.tank ? '壁役がいないので、敵の攻撃が散らばりやすい' : n.attacker === 0 ? '攻撃役がいないので時間がかかりやすい' : ''; if (adv) sum.appendChild(el('span', 'adv', '💡 ' + adv)); }
  }
  // 名簿（並び替え・絞り込み）
  renderFilters();
  const list = sortedList(), cards = $('#cards'); cards.textContent = '';
  $('#rsTitle').textContent = zk ? '図鑑' : `もののけ（所持 ${Object.keys(ACC().chars).length}体）`;
  const mySel = coop ? G.party[0] : G.party[G.selSlot];
  for (const c of list) {
    const own = ownsCh(c.id), rec = ACC().chars[c.id];
    const b = el('button', 'card' + (c.id === G.focus ? ' cur' : '') + (own ? '' : ' unowned')); b.type = 'button';
    const im = el('img'); im.src = G.thumbs[c.id] || ''; im.alt = ''; b.appendChild(im);
    b.appendChild(el('span', 'nm', own || zk ? c.nm : '？？？'));
    const mt = el('span', 'meta'); mt.appendChild(rankBadge(c.rank)); if (own) mt.appendChild(el('span', 'lv', 'Lv.' + rec.lv)); mt.appendChild(el('span', 'role', roleIc(c.roleId))); const e = el('span', 'el', c.el); e.style.background = DATA.ELEM_COL[c.el] || '#6a8ab0'; mt.appendChild(e); b.appendChild(mt);
    if (own) { const pr = DATA.GROWTH.progress(c.rank, rec.exp), xp = el('span', 'xp'); const xi = el('i'); xi.style.width = Math.round(pr.r * 100) + '%'; xp.appendChild(xi); b.appendChild(xp); if (!rec.seen) b.appendChild(el('span', 'new', 'NEW')); const eqs = eqOf(c.id); if (eqs.length) b.appendChild(el('span', 'eqi', eqs.map(e => DATA.EQUIP_I[e].ic).join(''))); }
    if (own && !zk) { const used = el('span', 'used'); (coop ? [mySel] : G.party).forEach((id, i) => { if (id === c.id) { const p = el('span', 'pn', 'P' + (coop ? myLobbySlot() + 1 : i + 1)); p.style.background = pcol(coop ? myLobbySlot() : i); used.appendChild(p); } }); b.appendChild(used); }
    const dt = el('span', 'det', '詳細'); dt.onclick = ev => { ev.stopPropagation(); AUDIO.sfx('ui'); G.focus = c.id; if (rec && !rec.seen) rec.seen = 1; renderTeam(); }; b.appendChild(dt);
    b.onclick = () => {
      AUDIO.sfx('ui'); G.focus = c.id; if (rec && !rec.seen) rec.seen = 1;
      if (!own || zk) { renderTeam(); return; } // 未所持は編成できない。図鑑は見るだけ
      if (coop) { G.party[0] = c.id; sendMine(); }
      else { const j = G.party.indexOf(c.id); if (j >= 0 && j !== G.selSlot) { G.party[j] = G.party[G.selSlot]; const sw = G.swap[j]; G.swap[j] = G.swap[G.selSlot]; G.swap[G.selSlot] = sw; } G.party[G.selSlot] = c.id; }
      STORE.set('party', G.party); renderTeam();
    };
    cards.appendChild(b);
  }
  $('#rsEmpty').hidden = list.length > 0; if (!list.length) $('#rsEmptyMsg').textContent = G.prefs.newOnly ? 'NEWのキャラはいません' : '条件に合うキャラがいません';
  renderDetail();
  // アイテム
  const it = $('#items'); it.textContent = '';
  for (const id of DATA.ITEM_IDS) {
    const I = DATA.ITEMS[id], on = G.items.includes(id);
    const b = el('button', 'item' + (on ? ' on' : '')); b.type = 'button'; b.appendChild(el('b', '', I.icon)); b.appendChild(el('span', '', I.nm)); b.appendChild(el('span', 'small', I.desc));
    b.onclick = () => { AUDIO.sfx('ui'); if (on) { if (G.items.length > 1) G.items = G.items.filter(x => x !== id); } else { G.items.push(id); if (G.items.length > 2) G.items.shift(); } if (G.items.length < 2) G.items.push(DATA.ITEM_IDS.find(x => !G.items.includes(x))); STORE.set('items', G.items); sendMine(); renderTeam(); };
    it.appendChild(b);
  }
  // 協力プレイ：ステージ（ホストが選ぶ）
  $('#stageRow').hidden = !coop;
  if (coop && S) {
    const sc = $('#stageChips'); sc.textContent = ''; const cur = (lob && lob.stage) || 'senju', host = S.kind === 'host';
    for (const st of STAGES) {
      const open = host ? stageOpen(st.id) : true, b = el('button', 'chip' + (cur === st.id ? ' on' : ''), (open ? st.ic + ' ' : '🔒 ') + st.nm); b.type = 'button'; b.disabled = !host || !open;
      if (host) b.onclick = () => { S.lobby.stage = st.id; S.dirtyLobby = true; AUDIO.sfx('ui'); renderTeam(); };
      sc.appendChild(b);
    }
  }
  if (coop && S) {
    $('#lobCode').textContent = ''; const cb = el('div', 'code-big', S.code); $('#lobCode').appendChild(cb);
    const st = $('#lobStatus');
    if (S.kind === 'host') { const n = lob.slots.filter(Boolean).length; st.textContent = `合言葉「${S.code}」を友だちに伝えてください。いま${n}人（空きはAIが入ります）。${G.netMode === 'p2p' ? '同じURL（' + PUBLIC_URL + '）を開いてもらいます。' : ''}`; $('#btnGo').disabled = false; $('#btnGo').textContent = n > 1 ? `${n}人で出撃する` : '出撃する（ひとり＋AI）'; }
    else { st.textContent = S.lobby ? (S.mySlot >= 0 ? `P${S.mySlot + 1}として参加中。ホストの出撃を待っています。` : '部屋に入っています…') : 'ホストを探しています…（合言葉が同じか確認してください）'; $('#btnGo').disabled = true; $('#btnGo').textContent = 'ホストの出撃待ち'; }
  }
}
function renderDetail() {
  const c = DATA.CHI[G.focus] || DATA.CHARS[0], d = $('#detail'); d.textContent = '';
  const own = ownsCh(c.id), rec = ACC().chars[c.id], lv = rec ? rec.lv : 1;
  const hd = el('div', 'hd'); hd.appendChild(el('b', '', own || G.teamMode === 'zukan' ? c.nm : '？？？')); hd.appendChild(rankBadge(c.rank, 'dt-rk')); if (own) hd.appendChild(el('span', 'lv', 'Lv.' + lv));
  hd.appendChild(el('span', 'chip', DATA.ROLES[c.roleId].ic + ' ' + DATA.ROLES[c.roleId].label)); const e = el('span', 'badge', c.el + '属性'); e.style.background = DATA.ELEM_COL[c.el] || '#6a8ab0'; hd.appendChild(e); d.appendChild(hd);
  d.appendChild(el('p', 'small', (c.form || c.blurb) + (c.isNew ? `（身長${c.h.toFixed(2)}m・${c.hr}頭身）` : '')));
  if (!own) d.appendChild(el('p', 'small', c.gacha ? '未所持：通常ガチャで入手できます（Lv1・EXP0で加入）' : '未所持'));
  if (c.rank === 'D' && c.isNew) d.appendChild(el('p', 'small', '通常ガチャ対象外／初期仲間'));
  // 能力（いまのLv・人が操作／AIのとき）とEXP
  const s0 = DATA.GROWTH.stats(c, lv), eq = own ? eqOf(c.id) : [], s = DATA.GROWTH.withEquip(s0, eq), ai = DATA.GROWTH.aiStats(s), st = el('div', 'dt-stats eq');
  st.append(el('span', ''), el('b', '', `Lv${lv}`), el('b', '', eq.length ? '装備後' : '装備なし'), el('span', 'ai', 'AIのとき'), el('span', 'ai', 'Lv99'));
  for (const [l, k, i] of [['HP', 'hp', 0], ['ちから', 'str', 1], ['ようりょく', 'yo', 2], ['まもり', 'def', 3]]) st.append(el('span', '', l), el('span', '', String(s0[k])), el('b', s[k] > s0[k] ? 'up' : '', String(s[k])), el('span', 'ai', String(ai[k])), el('span', 'ai', String(c.cap[i])));
  d.appendChild(st);
  if (own && G.teamMode !== 'zukan') d.appendChild(equipBox(c.id));
  if (own) { const pr = DATA.GROWTH.progress(c.rank, rec.exp); d.appendChild(el('p', 'small', pr.need == null ? '次のレベル：上限（Lv99）' : `次のLvまで ${pr.need - pr.in} EXP（${pr.in} / ${pr.need}）　累積 ${rec.exp}`)); }
  const tg = el('div', 'dt-tags'); for (const t of c.tags || []) tg.appendChild(el('span', '', t)); d.appendChild(tg);
  const slotI = G.coop ? 0 : G.selSlot, sw = G.swap[slotI] && G.party[slotI] === c.id;
  const X = DATA.SKILLS[sw ? c.Y : c.X], Y = DATA.SKILLS[sw ? c.X : c.Y], SP = DATA.SPECIALS[c.sp];
  const aTxt = c.A === 'combo3' ? `三連（威力 ${c.Apw.join('/')}）` : c.A === 'shot' ? `射撃（威力 ${c.Apw[0]}）` : c.A === 'shotn' ? `${c.Anm}：射撃（威力 ${c.Apw[0]}・射程8m・0.5秒ごと）` : c.A === 'melee1n' ? `${c.Anm}：近接（威力 ${c.Apw[0]}・0.5秒ごと）` : `近接打撃（威力 ${c.Apw[0]}）`;
  const spTxt = c.isNew ? `${c.spNm}：${c.fx.SP}` : SP.type === 'multi' ? `${c.spNm}（${SP.pw}×${SP.n}${SP.defDown ? '＋守り低下' : ''}）` : SP.type === 'buff' ? `${c.spNm}（周りの味方のちから強化）` : SP.type === 'guardup' ? `${c.spNm}（自分の守り強化＋敵を引きつける）` : `${c.spNm}（全員を回復＋気絶した仲間を蘇生）`;
  const xTxt = s0 => c.isNew ? `${s0.nm}：${s0 === DATA.SKILLS[c.X] ? c.fx.X : c.fx.Y}` : skillDesc(s0);
  const mv = el('div', 'moves');
  for (const [k, cls, t] of [['A', 'kA', aTxt], ['X', 'kX', xTxt(X)], ['Y', 'kY', xTxt(Y)], ['必殺', 'kS', spTxt], ['特性', 'kP', c.psv]]) { mv.appendChild(el('span', 'k ' + cls, k)); mv.appendChild(el('span', '', t)); }
  d.appendChild(mv);
  if (G.teamMode === 'zukan') return;
  if (own && G.party[slotI] === c.id) {
    const b = el('button', 'chip' + (sw ? ' on' : ''), sw ? 'X・Y入れ替え中' : 'X・Yを入れ替える'); b.type = 'button';
    b.onclick = () => { G.swap[slotI] = !G.swap[slotI]; STORE.set('swap', G.swap); sendMine(); AUDIO.sfx('ui'); renderTeam(); };
    d.appendChild(b);
  } else if (own) { const b = el('button', 'chip', G.coop ? 'このキャラにする' : `P${slotI + 1}の枠に入れる`); b.type = 'button'; b.onclick = () => { const card = [...document.querySelectorAll('#cards .card')].find(x => x.querySelector('.nm') && x.querySelector('.nm').textContent === c.nm); if (card) card.click(); }; d.appendChild(b); }
}
/** 装備（枠1・枠2）：変更前→変更後が見えるように。付け替えは拠点・戦闘前・次編成の画面だけ */
function equipBox(id) {
  const a = ACC(), n = SAVE.eqSlots(a), cur = (a.chars[id].eq || []).slice(0, n), box = el('div', 'eq-box');
  box.appendChild(el('b', '', '装備'));
  for (let i = 0; i < 2; i++) {
    const row = el('div', 'eq-row'); row.appendChild(el('span', 'small', `枠${i + 1}`));
    if (i >= n) { row.appendChild(el('span', 'small', '🔒 電車をクリアすると使えます')); box.appendChild(row); continue; }
    const sel = el('select'); sel.setAttribute('aria-label', `装備枠${i + 1}`);
    const none = el('option', '', '（なし）'); none.value = ''; sel.appendChild(none);
    for (const e of DATA.EQUIP) { const o = el('option', '', `${e.ic} ${e.nm}：${e.statLabel}＋${e.pct}%`); o.value = e.id; if (cur.some((x, j) => j !== i && x === e.id)) o.disabled = true; sel.appendChild(o); }
    sel.value = cur[i] || '';
    sel.onchange = () => { const r = SAVE.setEquip(a, id, i, sel.value || null); if (!r.ok) { mtoast(r.msg, 2400); sel.value = cur[i] || ''; return; } AUDIO.sfx('ui'); if (G.acct) persist(); renderTeam(); };
    row.appendChild(sel); box.appendChild(row);
  }
  box.appendChild(el('span', 'small', '同じ能力の増加は足し算（例：ちから＋40%と＋50%で1.90倍）。装備でLvの表示は変わりません。'));
  return box;
}
function skillDesc(s) {
  const m = { charge: `${s.nm}：長押しでため、離して発動（基礎威力${s.pw}）`, dodge: '回避：押した方向へすばやく移動（一瞬無敵）', dot: `${s.nm}：当てた敵に${s.dur}秒の継続ダメージ`, retreat: `${s.nm}：攻撃しながら後ろへ下がる（威力${s.pw}）`, stealth: `${s.nm}：${s.dur}秒狙われにくくなる`, parry: `${s.nm}：構えて攻撃を受けると反撃`, heavy: `${s.nm}：ためて重い一撃（威力${s.pw}）`, trap: `${s.nm}：足元に麻痺のワナ`, protect: `${s.nm}：周りの味方を一瞬無敵にする`, guard: `${s.nm}：押している間ダメージを減らす${s.reflect ? '・一部を跳ね返す' : ''}`, taunt: `${s.nm}：敵を引きつける一撃（威力${s.pw}）`, mine: `${s.nm}：足元に地雷（威力${s.pw}・味方も巻き込む・1人1個・再使用${s.cd}秒）`, heal: `${s.nm}：ためるほど回復量アップ（基礎${s.pw}）`, healRing: `${s.nm}：ためるほど範囲が広がる回復（基礎${s.pw}）` };
  return m[s.kind] || s.nm;
}
/** おすすめ編成（押したときだけ）：攻撃・壁・回復・もう1体をLvの高い順に */
function recommendParty() {
  const own = DATA.CHARS.filter(c => ownsCh(c.id)).sort((x, y) => lvOf(y.id) - lvOf(x.id) || RANK_I[x.rank] - RANK_I[y.rank]);
  const pick = [], take = f => { const c = own.find(q => f(q) && !pick.includes(q.id)); if (c) pick.push(c.id); };
  take(c => c.roleId === 'attacker'); take(c => c.roleId === 'tank'); take(c => c.roleId === 'healer'); take(c => c.roleId === 'attacker' || c.roleId === 'ranger');
  for (const c of own) if (pick.length < 4 && !pick.includes(c.id)) pick.push(c.id);
  G.party = pick.slice(0, 4); G.swap = [false, false, false, false]; STORE.set('party', G.party); STORE.set('swap', G.swap);
}
/* ---------- 結果：EXP・レベル・チケット ---------- */
function renderResExp(res) {
  const box = $('#resExp'); box.textContent = ''; if (!res) return;
  if (res.dup) { box.appendChild(el('div', 'res-tix', 'この戦いの報酬は受け取り済みです')); return; }
  for (const x of res.exp) {
    const d = el('div', 'ex'), im = el('img'); im.src = G.thumbs[x.ch] || ''; im.alt = ''; d.appendChild(im);
    const t = el('span'); t.append(el('span', '', DATA.CHI[x.ch].nm + ' '), el('b', '', `+${x.add.toLocaleString()} EXP`), el('span', 'small', x.ai ? '（AI 80%）' : G.coop ? '（人間100%）' : '（P1 100%）')); d.appendChild(t);
    if (x.lv1 > x.lv0) d.appendChild(el('span', 'up', `Lv${x.lv0}→${x.lv1}`)); else d.appendChild(el('span', 'small', `Lv${x.lv1}`));
    box.appendChild(d);
  }
  const a = ACC(), tx = el('div', 'res-tix', res.ticket > 0 ? `🎫 チケット＋${res.ticket}／所持${a.tickets}枚` : `🎫 チケット ${a.tickets}枚（トバトーバン ${a.wins.tobatoban % 3}/3・ヨシノシン ${a.wins.yoshinoshin % 2}/2）`);
  box.appendChild(tx);
  if (!G.acct) box.appendChild(el('div', 'small', 'ログインしていないので、この記録は画面を閉じると消えます（ログインすればアカウントに足されます）。'));
}
function bindHub() {
  $('#btnTeam').onclick = () => { AUDIO.sfx('ok'); openTeam('title'); };
  $('#btnZukan').onclick = () => { AUDIO.sfx('ok'); openZukan('title'); };
  $('#btnGacha').onclick = () => { AUDIO.sfx('ok'); openGacha('title'); };
  $('#btnLgGacha').onclick = () => { AUDIO.sfx('ok'); openGacha('login'); };
  $('#btnLgSet').onclick = () => openSub('settings', 'login');
  $('#btnEquip').onclick = () => { AUDIO.sfx('ok'); openTeam('title'); mtoast('キャラを選ぶと、右の詳細で装備を付け替えられます', 3000); };
  $('#btnStageHub').onclick = () => { AUDIO.sfx('back'); show('title'); };
  document.querySelectorAll('#chTabs .tab').forEach(t => t.onclick = () => { AUDIO.sfx('ui'); G.chTab = +t.dataset.ch; renderSortie(); });
  $('#btnPrepGo').onclick = () => { AUDIO.sfx('ok'); startSolo(G.prepStage || 'ueno'); };
  $('#btnPrepTeam').onclick = () => { AUDIO.sfx('ok'); G.carry = null; openTeam('prep'); };
  $('#btnPrepHub').onclick = () => { AUDIO.sfx('back'); G.carry = null; show('title'); };
  $('#btnRecommend').onclick = () => { AUDIO.sfx('ok'); recommendParty(); renderTeam(); mtoast('おすすめ編成にしました（いつでも戻せます）'); };
  $('#rsSort').onchange = () => { G.prefs.sort = $('#rsSort').value; persistPrefs(); renderTeam(); };
  $('#rsFilterBtn').onclick = () => { $('#rsFilters').hidden = !$('#rsFilters').hidden; AUDIO.sfx('ui'); };
  $('#rsNew').onclick = () => { G.prefs.newOnly = !G.prefs.newOnly; persistPrefs(); renderTeam(); };
  $('#rsClear').onclick = () => clearFilters(); $('#rsEmptyClear').onclick = () => clearFilters();
  $('#rsQ').oninput = () => { G.prefs.q = $('#rsQ').value.trim(); renderTeam(); };
  const origGo = $('#btnGo').onclick; $('#btnGo').onclick = (e) => { if (G.teamMode === 'zukan') { AUDIO.sfx('ok'); openTeam(G.teamBack); return; } origGo(e); };
}
