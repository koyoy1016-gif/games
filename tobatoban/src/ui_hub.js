/* =====================================================================
   ui_hub.js — 所持・レベル・装備・ステージ解放の共通処理、結果のEXP、ボス前の準備画面（画面本体は ui_lobby.js）
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
/** ステージの解放：電車＝トバトーバ初勝利、居酒屋通り＝電車の初クリア、ヨシノシン＝通りの初クリア（旧版で解放済みならそのまま）、秋葉原＝ヨシノシン初勝利、駅前広場＝ホーム初勝利 */
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
  { id: 'senju', ch: 0, cls: 's1', ic: '🏮', no: '北千住編', nm: '商店街と祭り広場', en: 'トバトーバ（古い大看板の付喪神）', d: '宵町のアーケード通りを抜けて、祭り広場で大看板の付喪神を鎮める。', rec: 1, lock: '' },
  { id: 'joban', ch: 1, cls: 's2', ic: '🚃', no: '上野編', nm: '常磐線 北千住→上野', en: `ヨシノシンの部下 ${DATA.JOBAN.events.reduce((s, e) => s + e.n, 0)}体`, d: '青い常磐線の2号車・3号車で戦う。1号車側と3号車側の両方から部下が来る。全員倒すと上野に着く。', rec: 20, lock: 'トバトーバを1回倒すと解放' },
  { id: 'ueno_street', ch: 1, cls: 's2', ic: '🏮', no: '上野編', nm: '上野の居酒屋通り', en: 'ヨシノシンの部下 30体（3地点×10体）', d: '改札を抜け、暖簾と提灯の並ぶ飲み屋街を進む。各地点の10体を倒すと先へ進める。', rec: 20, lock: '電車を1回クリアすると解放' },
  { id: 'ueno', ch: 1, cls: 's3', ic: '🎌', no: '上野編', nm: '上野駅前 ヨシノシン', en: 'ヨシノシン（HP22,000の指揮官）＋部下36体〜', d: '駅前の広場で、部下を人形のように操る巨大な指揮官と戦う。HP75%・50%・25%の「30分睡眠チャージ」を10秒で止めよう。', rec: DATA.LV_BASE.ueno, lock: '居酒屋通りを1回クリアすると解放' },
  { id: 'akiba_platform', ch: 2, cls: 's2', ic: '🚉', no: '秋葉原編', nm: '秋葉原駅ホーム', en: 'オガ・カエ（各HP5,000）', d: '閉鎖されたホームで2人と戦う前哨戦。前方の攻撃をよけて背後へ回ろう。', rec: DATA.LV_BASE.akiba_platform, lock: 'ヨシノシンを1回倒すと解放' },
  { id: 'akiba_plaza', ch: 2, cls: 's3', ic: '⭐', no: '秋葉原編', nm: '秋葉原駅前広場', en: '星・中（各HP10,000）＋オガ・カエ（各5,000）', d: '星と中は、片方を倒してから15秒以内にもう片方も倒さないと復活する。2〜4人で結ぶ図形の攻撃に注意。', rec: DATA.LV_BASE.akiba_plaza, lock: '秋葉原駅ホームを1回クリアすると解放' },
];
const avgLv = ids => Math.floor(ids.reduce((s, id) => s + lvOf(id), 0) / Math.max(1, ids.length));
const roleIc = id => DATA.ROLES[id] ? DATA.ROLES[id].ic + DATA.ROLES[id].short : '';
const rankBadge = (rk, cls) => { const b = el('span', cls || 'rk', DATA.RANK_INFO[rk].ic + rk); b.style.background = DATA.RANK_INFO[rk].col; return b; };

/* ---------- 上野の準備（電車クリアのあと） ---------- */
/** ボス戦の準備（上野ボス／秋葉原の駅前広場）。HP・スタミナ全回復、気絶解除、妖気は最低50、G玉の強化は0 */
function openPrep(st) {
  st = st || G.prepStage || 'ueno'; G.prepStage = st;
  fixParty(); const kv = $('#prepKv'); kv.textContent = ''; const P = avgLv(G.party), ak = st === 'akiba_plaza', k = DATA.lvAdjust(st || 'ueno', P);
  $('#prepEyebrow').textContent = ak ? '秋葉原駅前' : '上野駅前'; $('#prepTitle').textContent = ak ? '星と中が待っている' : 'ヨシノシンが待っている';
  $('#prepLead').textContent = ak ? 'ホームの報酬は確定しました。装備・アイテムを見直してから挑めます。' : '居酒屋通りの報酬は確定しました。このまま挑むか、編成・装備を見直してから挑めます。';
  $('#btnPrepGo').textContent = ak ? 'このまま駅前広場へ' : 'このままヨシノシンへ';
  for (const [kk, v] of [['推奨Lv', String(DATA.LV_BASE[st] || 40)], ['いまの平均Lv', String(P)], ['Lv補正', `与えるダメージ×${k.out.toFixed(2)}・受けるダメージ×${k.in.toFixed(2)}`], ['編成', G.party.map(id => `${DATA.CHI[id].nm} Lv${lvOf(id)}${eqOf(id).length ? '（' + eqOf(id).map(e => DATA.EQUIP_I[e].ic).join('') + '）' : ''}`).join('・')], ['回復', 'HP・スタミナ全回復、気絶は解除、必殺ゲージは50%から、G玉は0']]) { kv.appendChild(el('b', '', kk)); kv.appendChild(el('span', '', v)); }
  show('prep');
}
/** 戦闘から抜けて（結果を見たあと）メニューへ */
function leaveBattle() { if (G.session) { try { G.session.leave(); } catch (e) { } } G.session = null; G.mode = 'title'; G.v = null; R.clearEntities(); AUDIO.bgm('title'); $('#hud').hidden = true; }
function persistPrefs() { const a = ACC(); if (a) a.prefs = Object.assign(a.prefs || {}, G.prefs || {}); STORE.set('prefs', G.prefs); }

G.prefs = Object.assign({ sort: 'level' }, STORE.get('prefs', {})); if (!['level', 'rank', 'str', 'recent'].includes(G.prefs.sort)) G.prefs.sort = 'level';
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
  const a = ACC(), tx = el('div', 'res-tix', res.ticket > 0 ? `🎫 チケット＋${res.ticket}／所持${a.tickets}枚` : `🎫 チケット ${a.tickets}枚（次の1枚まで ストーリークリア ${(a.wins.story || 0) % 2}/2）`);
  box.appendChild(tx);
  if (!G.acct) box.appendChild(el('div', 'small', 'ログインしていないので、この記録は画面を閉じると消えます（ログインすればアカウントに足されます）。'));
}
function bindHub() {
  $('#btnPrepGo').onclick = () => { AUDIO.sfx('ok'); startSolo(G.prepStage || 'ueno'); };
  $('#btnPrepTeam').onclick = () => { AUDIO.sfx('ok'); G.carry = null; openRoster('prep'); };
  $('#btnPrepHub').onclick = () => { AUDIO.sfx('back'); G.carry = null; show('title'); };
  bindLobby();
}
