/* =====================================================================
   ui_lobby.js — v6 のメニュー（ブロスタ風のロビー）
   ・ホーム：中央に次に出動する4体（3D）、左に「編成・協力プレイ・ガチャ」、右下にステージ欄と大きな「出動」
   ・編成：色付きのカードを横スワイプ（並べ替え4種・どの枠に入れるか）
   ・キャラ詳細：左に情報、中央に大きな3D（ドラッグで回転）、右に能力と技の要点、右上に装備2枠
   ・ステージ選択：大きなカードを横スワイプ。選ぶだけでは始まらず、ホームの「出動」で始まる
   表示はいつも同じ状態（G.party・装備・選択ステージ・協力プレイのロビー）から作る
   ===================================================================== */
G.stageSel = STORE.get('stageSel', 'senju'); G.selSlot = 0;
/** 協力中、ホストが選べるAI枠か（空いている P2〜P4） */
const coopAiSlot = i => { const S = G.session; return !!(G.coop && S && S.kind === 'host' && i >= 1 && i <= 3 && !S.lobby.slots[i]); };
const coopAiCh = i => { const lob = coopLobby(); return lob && lob.ai ? lob.ai[i] : null; };
const coopLobby = () => { const S = G.session; if (!G.coop || !S) return null; return S.kind === 'host' ? S.lobbyMsg() : S.lobby; };
const isHost = () => !G.coop || (G.session && G.session.kind === 'host');
/** いま選ばれているステージ（協力プレイ中はロビーの値） */
function curStage() { const lob = coopLobby(); if (G.coop && lob) return lob.stage || 'senju'; return stageOpen(G.stageSel) ? G.stageSel : 'senju'; }
const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
const CHAP = ['北千住編', '上野編', '秋葉原編'];

/* ---------- ステージの絵（本作オリジナルの簡単なSVG） ---------- */
function stageArt(id) {
  const A = {
    senju: ['#ff9a5a', '#7a2a5a', `<rect x="0" y="60" width="200" height="40" fill="#3a2440"/><g fill="#ff5a3a" stroke="#0b1440" stroke-width="2">${[20, 60, 100, 140, 180].map(x => `<ellipse cx="${x}" cy="28" rx="9" ry="11"/>`).join('')}</g><path d="M0 18 Q100 34 200 18" stroke="#0b1440" stroke-width="2" fill="none"/><rect x="74" y="36" width="52" height="40" rx="4" fill="#f2c94c" stroke="#0b1440" stroke-width="3"/><text x="100" y="62" font-size="16" text-anchor="middle" font-weight="900" fill="#0b1440">大看板</text>`],
    joban: ['#5ab8ff', '#1d3a8a', `<rect x="0" y="70" width="200" height="30" fill="#2a2a40"/><rect x="10" y="30" width="180" height="42" rx="8" fill="#e8eef6" stroke="#0b1440" stroke-width="3"/><rect x="10" y="56" width="180" height="7" fill="#1d56d8"/><g fill="#9ad0ff" stroke="#0b1440" stroke-width="2">${[24, 62, 100, 138].map(x => `<rect x="${x}" y="36" width="28" height="16" rx="2"/>`).join('')}</g><circle cx="40" cy="76" r="6" fill="#0b1440"/><circle cx="160" cy="76" r="6" fill="#0b1440"/>`],
    ueno_street: ['#ff7a4a', '#3a1a3a', `<rect x="0" y="66" width="200" height="34" fill="#4a3040"/><g stroke="#0b1440" stroke-width="2"><rect x="0" y="22" width="56" height="46" fill="#6a4a3a"/><rect x="144" y="22" width="56" height="46" fill="#5a4a52"/><rect x="8" y="30" width="40" height="14" fill="#7a1f2a"/><rect x="152" y="30" width="40" height="14" fill="#1d3a6a"/></g><g fill="#ff5a3a" stroke="#0b1440" stroke-width="2"><ellipse cx="70" cy="40" rx="7" ry="9"/><ellipse cx="130" cy="40" rx="7" ry="9"/><ellipse cx="100" cy="30" rx="7" ry="9"/></g>`],
    ueno: ['#b08aff', '#2a1a5a', `<rect x="0" y="72" width="200" height="28" fill="#8a4a38"/><rect x="30" y="18" width="140" height="40" fill="#d9cbb4" stroke="#0b1440" stroke-width="2"/><path d="M84 92 L100 20 L116 92 Z" fill="#7a6d8c" stroke="#0b1440" stroke-width="3"/><circle cx="100" cy="24" r="12" fill="#c9c0d6" stroke="#0b1440" stroke-width="3"/><circle cx="96" cy="23" r="3" fill="#c8ff3a"/><circle cx="104" cy="23" r="3" fill="#c8ff3a"/>${[30, 50, 150, 170].map(x => `<circle cx="${x}" cy="82" r="6" fill="#5a4e6a" stroke="#0b1440" stroke-width="2"/>`).join('')}`],
    akiba_platform: ['#8ad8ff', '#1d56b8', `<rect x="0" y="64" width="200" height="36" fill="#b8b4ae"/><rect x="0" y="62" width="200" height="4" fill="#f2c94c"/><rect x="60" y="14" width="80" height="18" rx="3" fill="#1d56b8" stroke="#0b1440" stroke-width="2"/><text x="100" y="28" font-size="12" text-anchor="middle" font-weight="900" fill="#fff">秋葉原</text><circle cx="78" cy="56" r="9" fill="#ff7a5a" stroke="#0b1440" stroke-width="2"/><circle cx="122" cy="56" r="9" fill="#6ad8a8" stroke="#0b1440" stroke-width="2"/>`],
    akiba_plaza: ['#ff5ad8', '#2a1a6a', `<rect x="0" y="70" width="200" height="30" fill="#6a6676"/><g stroke="#0b1440" stroke-width="2"><rect x="4" y="14" width="40" height="58" fill="#3a3450"/><rect x="156" y="10" width="40" height="62" fill="#3a3450"/><rect x="10" y="24" width="28" height="10" fill="#5ad8ff"/><rect x="162" y="22" width="28" height="10" fill="#ffe25a"/></g><circle cx="86" cy="50" r="13" fill="#f2c94c" stroke="#0b1440" stroke-width="3"/><circle cx="114" cy="50" r="13" fill="#9ad0ff" stroke="#0b1440" stroke-width="3"/><path d="M86 50 L114 50" stroke="#ff8ad8" stroke-width="3"/>`],
  }[id] || ['#5ab8ff', '#1d3a8a', ''];
  return `<svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A[1]}"/><stop offset="1" stop-color="${A[0]}"/></linearGradient></defs><rect width="200" height="100" fill="url(#g${id})"/>${A[2]}</svg>`;
}

/* ---------- 横スワイプ（回転表示でも指の向きで動く・慣性つき。ドラッグ後のタップは押さない） ---------- */
function makeHScroll(box) {
  let d = null, vel = 0, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  box.addEventListener('pointerdown', e => { stop(); d = { id: e.pointerId, x: toApp(e)[0], x0: toApp(e)[0], t: performance.now(), moved: false }; vel = 0; }, { passive: true });
  addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return; const x = toApp(e)[0], dx = x - d.x, now = performance.now();
    if (Math.abs(x - d.x0) > 8) d.moved = true;
    box.scrollLeft -= dx; vel = dx / Math.max(1, now - d.t); d.x = x; d.t = now;
  }, { passive: true });
  const up = e => {
    if (!d || e.pointerId !== d.id) return; box._dragged = d.moved; d = null;
    if (Math.abs(vel) > 0.05) { let v = vel * 16; const step = () => { box.scrollLeft -= v; v *= 0.93; if (Math.abs(v) > 0.4) raf = requestAnimationFrame(step); else raf = 0; }; raf = requestAnimationFrame(step); }
    setTimeout(() => { box._dragged = false; }, 60);
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  box.addEventListener('click', e => { if (box._dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
  box.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { box.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
}

/* ---------- ホーム ---------- */
/** 4枠：ソロ＝P1（あなた）＋AI3体、協力＝参加した人＋足りない分のAI。枠の位置はいつも同じ */
function homeSlots() {
  const S = G.session, lob = coopLobby(), out = [];
  for (let i = 0; i < 4; i++) {
    if (G.coop && S) {
      const s = lob && lob.slots && lob.slots[i];
      if (s) { const me = s.peer === (S.tr && S.tr.self) || (S.kind === 'host' && i === 0); out.push({ ch: s.ch, nm: me ? (G.nick || 'あなた') : s.nick, who: me ? 'あなた' : '参加者', lv: me ? lvOf(s.ch) : (s.lv || 1), me, human: true, host: i === 0 }); }
      else if (lob && lob.ai) { const ch = lob.ai[i] || 'kogemaru'; out.push({ ch, nm: DATA.CHI[ch].nm, who: 'AI', lv: (lob.aiLv && lob.aiLv[i]) || 1 }); }
      else out.push({ ch: null, nm: '空き', who: '空き', lv: 0, empty: true });
    } else { const ch = G.party[i]; out.push({ ch, nm: DATA.CHI[ch].nm, who: i === 0 ? 'あなた' : 'AI', lv: lvOf(ch), me: i === 0, human: i === 0 }); }
  }
  return out;
}
function renderHome() {
  fixParty();
  const a = ACC(), S = G.session, lob = coopLobby();
  // 上：プレイヤー名／ID・チケット
  const w = $('#acctWho'); w.textContent = '';
  if (G.acct) { w.append(G.nick ? `${G.nick}（ID ${G.acct.id}）` : `ID ${G.acct.id}`); w.appendChild(el('small', '', `最後のセーブ ${fmtDate(G.acct.saved)}`)); $('#btnAcct').textContent = 'アカウント'; $('#btnTSave').hidden = false; }
  else { w.append('ゲスト'); w.appendChild(el('small', '', 'セーブするにはログイン')); $('#btnAcct').textContent = 'ログイン'; $('#btnTSave').hidden = true; }
  $('#tTix').textContent = String(a.tickets || 0);
  const gb = $('#gTixBadge'); gb.hidden = !(a.tickets > 0); gb.textContent = String(a.tickets || 0);
  // 協力プレイの部屋
  const rm = $('#hmRoom'); rm.hidden = !G.coop;
  $('#btnRoomShare').hidden = !(G.coop && S && S.kind === 'host');
  if (G.coop && S) {
    $('#hmRoomCode').textContent = S.code || '----';
    const n = lob && lob.slots ? lob.slots.filter(Boolean).length : 0;
    const cs = S.kind === 'client' ? S.state : '';
    $('#hmRoomSt').textContent = S.kind === 'host' ? `ホスト・${n}/4人（空きはAI）` : cs === 'connecting' ? '接続準備中…（ホストを探しています）' : cs === 'handshake' ? '接続確立中…' : cs === 'reconnecting' ? '再接続中…' : !S.lobby ? '接続準備中…' : S.mySlot >= 0 ? `P${S.mySlot + 1}で参加中・${n}/4人・ホストの出動待ち` : '入っています…';
  }
  // 4体（3D）と名札
  const sl = homeSlots(); G.homeSlots = sl;
  if ($('#title').hidden === false) LOBBY3D.show('home', sl.map(x => x.ch));
  const box = $('#hmTags');
  if (!G.tags) { G.tags = []; for (let i = 0; i < 4; i++) { const t = el('div', 'hm-tag'); t.setAttribute('role', 'button'); t.addEventListener('click', () => tagTap(i)); box.appendChild(t); G.tags.push(t); } }
  sl.forEach((s, i) => {
    const t = G.tags[i]; t.textContent = '';
    const nm = el('span', 'tg-nm', s.empty ? '空き' : s.nm);
    const row = el('span', 'tg-row'); const p = el('span', 'tg-p', 'P' + (i + 1)); p.style.background = pcol(i); row.appendChild(p);
    if (!s.empty) row.appendChild(el('span', 'tg-lv', 'Lv.' + s.lv));
    row.appendChild(el('span', 'tg-who' + (s.who === 'AI' ? ' ai' : s.empty ? ' empty' : ''), s.who === 'AI' ? 'AI' : s.who));
    t.append(nm, row);
    if (!s.empty && s.who === 'AI' && G.coop && s.ch) nm.textContent = DATA.CHI[s.ch].nm;
  });
  // ステージ欄と出動
  const st = stageOf(curStage()), open = stageOpen(st.id) || (G.coop && S && S.kind !== 'host');
  $('#hmStThumb').innerHTML = stageArt(st.id); $('#hmStCh').textContent = CHAP[st.ch]; $('#hmStNm').textContent = st.nm;
  $('#hmStSub').textContent = st.rec > 1 ? `推奨Lv${st.rec}・いまの平均Lv${avgLv(G.party)}` : st.en;
  const go = $('#btnSolo');
  if (G.coop && S && S.kind !== 'host') { go.disabled = true; $('#hmGoTxt').textContent = '出動'; $('#hmGoSub').textContent = 'ホストの出動待ち'; }
  else { go.disabled = !open; $('#hmGoTxt').textContent = '出動'; const n = G.coop && lob && lob.slots ? lob.slots.filter(Boolean).length : 1; $('#hmGoSub').textContent = !open ? '🔒 未解放' : G.coop ? `${n}人＋AI${4 - n}体` : 'ひとり＋AI3体'; }
}
function tagTap(i) {
  AUDIO.sfx('ui');
  if (G.coop) { const s = G.homeSlots && G.homeSlots[i], S = G.session;
    if (s && s.me) openRoster('home', 0);
    else if (S && S.kind === 'host' && s && !s.human) openRoster('home', i); // ホストは空いているAI枠を選べる
    else mtoast(s && s.human ? 'ほかの人のキャラは、その人が選びます' : 'AI枠のキャラはホストが選びます', 2000); return; }
  openRoster('home', i);
}
/** ホームの画面上の点 (x, y) にいるモデルの枠（なければ −1）。足元〜頭の上の縦長の範囲で判定 */
function homeModelAt(x, y) {
  const P = [0, 1, 2, 3].map(i => LOBBY3D.slotScreen(i)); if (P.some(p => !p)) return -1;
  const hw = Math.abs(P[1].foot.x - P[0].foot.x) * 0.46;
  for (let i = 0; i < 4; i++) { const p = P[i]; if (G.homeSlots && G.homeSlots[i] && G.homeSlots[i].empty) continue; if (Math.abs(x - p.mid.x) < hw && y > p.head.y - 6 && y < p.foot.y + 16) return i; }
  return -1;
}
/** 毎フレーム：名札を4体の足元（重なるなら頭の上）へ。下の操作欄とは重ねない */
function lobbyTick() {
  if (!LOBBY3D.active() || LOBBY3D.mode !== 'home' || !G.tags || $('#title').hidden) return;
  const appR = $('#app').getBoundingClientRect(), bb = $('.hm-bottom'), bTop = VIEW.h - (bb ? bb.offsetHeight : 80) - 14, bLeft = VIEW.w - (bb ? bb.offsetWidth : 400) - 14;
  const P = [0, 1, 2, 3].map(i => LOBBY3D.slotScreen(i)); if (P.some(p => !p)) return;
  // 足元に置けるならそろえて足元、どれかが右下の出動欄と重なるなら全員を頭の上へ（並びをそろえる）
  const below = P.every((p, i) => { const h = G.tags[i].offsetHeight || 34; return !(p.foot.y + 4 + h > bTop && p.foot.x + 50 > bLeft) && p.foot.y + 4 + h < VIEW.h - 4; });
  const rm = $('#hmRoom'), topMin = rm && !rm.hidden && rm.offsetHeight ? rm.offsetTop + rm.offsetHeight + 4 : 52; // 協力のルーム表示とも重ねない
  P.forEach((p, i) => { const t = G.tags[i], h = t.offsetHeight || 34; const y = below ? p.foot.y + 4 : Math.max(topMin, p.head.y - h - 2); t.style.left = Math.round(p.foot.x) + 'px'; t.style.top = Math.round(y) + 'px'; });
}

/* ---------- 協力プレイ ---------- */
function openCoop() { if (G.coop) { mtoast(`ルーム ${G.session ? G.session.code : ''} に参加中です（やめるときは上の「退出」）`, 2400); return; } $('#nick').value = G.nick; show('coop'); }
function openLobby() { G.coop = true; G.mode = 'lobby'; $('#hud').hidden = true; G.selSlot = 0; show('title'); frPublish(true); } // フレンドに「募集中」をすぐ知らせる

/* ---------- 編成（キャラ一覧） ---------- */
function openRoster(back, slot) {
  G.rosterBack = back || 'home'; if (slot != null) G.selSlot = slot; if (G.coop && !coopAiSlot(G.selSlot)) G.selSlot = 0;
  show('roster'); renderRoster(true);
}
function sortedChars() {
  const a = ACC(), P = G.prefs;
  const lv = c => (a.chars[c.id] ? a.chars[c.id].lv : 0), rk = c => RANK_I[c.rank], id = c => CH_I[c.id];
  const str = c => a.chars[c.id] ? DATA.GROWTH.withEquip(DATA.GROWTH.stats(c, lv(c)), eqOf(c.id)).str : 0;
  const used = c => (a.chars[c.id] && a.chars[c.id].used) || 0;
  const cmp = { level: (x, y) => lv(y) - lv(x) || rk(x) - rk(y) || id(x) - id(y), rank: (x, y) => rk(x) - rk(y) || lv(y) - lv(x) || id(x) - id(y), str: (x, y) => str(y) - str(x) || lv(y) - lv(x) || id(x) - id(y), recent: (x, y) => used(y) - used(x) || lv(y) - lv(x) || id(x) - id(y) }[P.sort] || ((x, y) => id(x) - id(y));
  const own = DATA.CHARS.filter(c => ownsCh(c.id)).sort(cmp), not = DATA.CHARS.filter(c => !ownsCh(c.id)).sort((x, y) => rk(x) - rk(y) || id(x) - id(y));
  return own.concat(not); // 未所持はロックして最後に
}
function rosterSize() {
  const g = $('#cards'); const h = g.clientHeight || (VIEW.h - 90); const rows = h >= 430 ? 3 : 2;
  const ch = (h - 10 - (rows - 1) * 10) / rows; g.style.setProperty('--rows', rows); g.style.setProperty('--cw', Math.round(Math.min(220, Math.max(120, ch * 0.86))) + 'px');
}
/** v8：並べ替え（レベル順・ランク順・ちから順・最近使った順）。ネイティブの select は回転した画面に追従しないので、ゲーム内のパネルにした */
const RS_SORTS = [['level', 'レベル順'], ['rank', 'ランク順'], ['str', 'ちから順'], ['recent', '最近使った順']];
function rsSortLabel() { const k = RS_SORTS.find(x => x[0] === G.prefs.sort) || RS_SORTS[0]; $('#rsSort').textContent = k[1] + ' ▾'; }
function rsSortOpen(on) {
  const p = $('#rsSortPanel'), b = $('#rsSort'); p.hidden = !on; b.setAttribute('aria-expanded', on ? 'true' : 'false'); if (!on) return;
  p.textContent = ''; for (const [k, nm] of RS_SORTS) { const o = el('button', k === G.prefs.sort ? 'on' : '', (k === G.prefs.sort ? '✓ ' : '') + nm); o.type = 'button'; o.setAttribute('role', 'option'); o.setAttribute('aria-selected', k === G.prefs.sort ? 'true' : 'false'); o.onclick = e => { e.stopPropagation(); G.prefs.sort = k; persistPrefs(); AUDIO.sfx('ui'); rsSortOpen(false); renderRoster(); $('#cards').scrollLeft = 0; }; p.appendChild(o); }
  // 画面の外へはみ出さない（回転前の画面の座標で測る）
  p.style.right = '0'; p.style.left = 'auto'; const r = p.offsetLeft + p.offsetParent.offsetLeft; if (r < 4) { p.style.right = 'auto'; p.style.left = '0'; }
  const cur = p.querySelector('.on') || p.firstChild; if (cur) cur.focus();
}
function renderRoster(keepScroll) {
  const a = ACC(), coop = G.coop, g = $('#cards'), sx = g.scrollLeft;
  $('#rsTitle').textContent = `キャラクター ${Object.keys(a.chars).length}/${DATA.CHARS.length}`;
  rsSortLabel();
  const ss = $('#rsSlots'); ss.textContent = '';
  for (let i = 0; i < 4; i++) {
    if (coop && i > 0 && !coopAiSlot(i)) continue; // 協力：自分の枠＋（ホストなら）空いているAI枠
    const b = el('button', i === G.selSlot ? 'on' : '', coop ? (i === 0 ? 'あなた' : `P${i + 1} AI`) : 'P' + (i + 1)); b.type = 'button'; b.style.background = pcol(i); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === G.selSlot ? 'true' : 'false');
    b.onclick = () => { G.selSlot = i; AUDIO.sfx('ui'); renderRoster(true); };
    ss.appendChild(b);
  }
  const cur = coop ? (G.selSlot > 0 ? coopAiCh(G.selSlot) || G.party[0] : G.party[0]) : G.party[G.selSlot];
  $('#rsNote').textContent = coop ? (G.selSlot > 0 ? `P${G.selSlot + 1}のAI枠（ホストが選ぶ・能力95%）：${DATA.CHI[cur].nm}` : `あなたのキャラ：${DATA.CHI[cur].nm}（カードを押して「このキャラを選ぶ」）`) : `P${G.selSlot + 1}（${G.selSlot === 0 ? 'あなたが操作' : 'AI：能力95%・EXP80%'}）の枠：${DATA.CHI[cur].nm}　カードを押すと詳しく見て選べます`;
  const ft = $('#rsFoot'); ft.hidden = !(G.rosterBack === 'akiba' || G.rosterBack === 'prep');
  $('#btnGo').textContent = G.rosterBack === 'akiba' ? '秋葉原へ向かう ▶' : '準備へもどる ▶';
  rosterSize(); g.textContent = '';
  const party = coop ? [G.party[0]].concat(G.session && G.session.kind === 'host' ? (coopLobby().ai || []).filter(Boolean) : []) : G.party;
  for (const c of sortedChars()) {
    const own = ownsCh(c.id), rec = a.chars[c.id], rk = DATA.RANK_INFO[c.rank];
    const b = el('button', 'rs-card' + (party.includes(c.id) ? ' inparty' : '') + (own ? '' : ' unowned')); b.type = 'button';
    const bg = el('span', 'bg'); bg.style.background = `linear-gradient(160deg, ${rk.col} 0%, ${shade(rk.col)} 70%)`; b.appendChild(bg);
    const im = el('img'); im.src = G.busts[c.id] || G.thumbs[c.id] || ''; im.alt = ''; im.loading = 'lazy'; b.appendChild(im);
    const r = el('span', 'rk'); const rb = el('span', 'rkb', c.rank); rb.style.background = rk.col; r.append(rb, el('small', '', c.rank + 'ランク')); b.appendChild(r);
    b.appendChild(el('span', 'nm ol', own ? c.nm : '？？？'));
    if (own) {
      const pr = DATA.GROWTH.progress(c.rank, rec.exp), lvb = el('span', 'lvb'), xb = el('span', 'xpb'), xi = el('i');
      xi.style.width = Math.round(pr.r * 100) + '%'; xb.appendChild(xi); lvb.append(el('b', '', 'Lv.' + rec.lv), xb, el('span', 'xpt', pr.need == null ? 'MAX' : `${pr.in.toLocaleString()}/${pr.need.toLocaleString()}`)); b.appendChild(lvb);
      const ps = el('span', 'ps'); party.forEach((id, i) => { if (id === c.id) { const p = el('span', '', coop ? 'あなた' : 'P' + (i + 1)); p.style.background = pcol(coop ? 0 : i); ps.appendChild(p); } }); b.appendChild(ps);
      if (!rec.seen && !party.includes(c.id)) b.appendChild(el('span', 'new', 'NEW'));
      const eqs = eqOf(c.id); if (eqs.length) b.appendChild(el('span', 'eqi', eqs.map(e => DATA.EQUIP_I[e].ic).join('')));
    } else b.appendChild(el('span', 'lock', c.gacha ? '🔒 ガチャで入手' : '🔒 未所持'));
    b.onclick = () => { AUDIO.sfx('ui'); openChara(c.id); };
    g.appendChild(b);
  }
  if (keepScroll) g.scrollLeft = sx;
}
function shade(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) * 0.45 | 0, g2 = ((n >> 8) & 255) * 0.45 | 0, b = (n & 255) * 0.55 + 40 | 0; return `rgb(${r},${g2},${Math.min(255, b)})`; }
function rosterBack() {
  AUDIO.sfx('back'); persistPrefs();
  if (G.rosterBack === 'prep') openPrep(); else show('title');
}
function rosterGo() { AUDIO.sfx('ok'); persistPrefs(); if (G.rosterBack === 'akiba') openAkibaWalkPrep(); else if (G.rosterBack === 'prep') openPrep(); else show('title'); }
function renderItemsPop() {
  const it = $('#items'); it.textContent = '';
  for (const id of DATA.ITEM_IDS) {
    const I = DATA.ITEMS[id], on = G.items.includes(id);
    const b = el('button', 'item' + (on ? ' on' : '')); b.type = 'button'; b.appendChild(el('b', '', I.icon)); b.appendChild(el('span', '', I.nm)); b.appendChild(el('span', 'small', I.desc));
    b.onclick = () => { AUDIO.sfx('ui'); if (on) { if (G.items.length > 1) G.items = G.items.filter(x => x !== id); } else { G.items.push(id); if (G.items.length > 2) G.items.shift(); } if (G.items.length < 2) G.items.push(DATA.ITEM_IDS.find(x => !G.items.includes(x))); STORE.set('items', G.items); sendMine(); renderItemsPop(); };
    it.appendChild(b);
  }
}

/* ---------- キャラ詳細 ---------- */
function openChara(id) { G.chId = id; G.eqEdit = null; const r = ACC().chars[id]; if (r && !r.seen) r.seen = 1; show('chara'); renderChara(); }
function aShort(c) { const M = DATA.MOVES[c.A]; const tm = M && M.end ? `・${M.end}秒` : ''; return c.A === 'combo3' ? `三連 ${c.Apw.join('/')}（続けて押す）` : (c.A === 'shot' || c.A === 'shotn') ? `射撃 威力${c.Apw[0]}${tm}` : `近接 威力${c.Apw[0]}${tm}`; }
function skShort(s) {
  const cd = s.cd ? `・再使用${s.cd}秒` : '';
  switch (s.kind) {
    case 'charge': return `ため（最大${DATA.CHARGE.max}秒・×${DATA.CHARGE.mul}）威力${s.pw}${cd}`;
    case 'lunge': return `踏み込み 威力${s.pw}${cd}`;
    case 'breaker': return `威力${s.pw}＋${s.stats.includes('def') ? 'まもり' : 'ちから・ようりょく'}↓${cd}`;
    case 'zone': return `押している間の陣（最大${s.max}秒）${cd}`;
    case 'aura': return `${s.side === 'ally' ? '味方強化' : '敵弱体'} ${s.dur}秒${cd}`;
    case 'regen': return `継続回復${cd}`;
    case 'protect': return `${s.self ? '自分を' : '周りを'}無敵${cd}`;
    case 'dodge': return '押した方向へ回避（一瞬無敵）';
    case 'guard': return `押している間ガード${s.reflect ? '・反射' : ''}`;
    case 'heal': case 'healRing': return `ためて回復 基礎${s.pw}${cd}`;
    case 'mine': case 'bomb': return `${s.kind === 'mine' ? '地雷' : '火薬玉'} 威力${s.pw}${cd}`;
    case 'retreat': case 'taunt': case 'heavy': return `威力${s.pw}${cd}`;
    default: return (s.short || s.nm) + cd;
  }
}
function spShort(c) { const S = DATA.SPECIALS[c.sp]; if (!S) return ''; return S.type === 'multi' ? `${S.pw}×${S.n}${S.defDown ? '＋守り↓' : ''}` : S.type === 'buff' ? '味方のちから強化' : S.type === 'guardup' ? '守り強化＋引きつけ' : S.type === 'heal' ? '全員回復＋蘇生' : (c.fx && c.fx.SP ? c.fx.SP.split('、')[0] : ''); }
function charaMoves(c) {
  const slot = G.coop ? 0 : G.selSlot, sw = G.swap[slot] && G.party[slot] === c.id;
  const X = DATA.SKILLS[sw ? c.Y : c.X], Y = DATA.SKILLS[sw ? c.X : c.Y];
  const long = s => s.desc ? `${s.nm}：${s.desc}` : c.isNew ? `${s.nm}：${s === DATA.SKILLS[c.X] ? c.fx.X : c.fx.Y}` : skillDesc(s); // v7：設定表の技は説明（desc）を出す
  const aLong = c.Adesc ? `${c.Anm}：${c.Adesc}` : c.A === 'combo3' ? `三連：Aを続けて押すと2発目・3発目（威力 ${c.Apw.join('/')}）` : c.A === 'shotn' || c.A === 'shot' ? `${c.Anm || '射撃'}：前へ撃つ（威力 ${c.Apw[0]}）` : `${c.Anm || '近接打撃'}：前の敵を打つ（威力 ${c.Apw[0]}）`;
  const SP = DATA.SPECIALS[c.sp], spLong = c.isNew ? `${c.spNm}：${c.fx.SP}` : SP.type === 'multi' ? `${c.spNm}（${SP.pw}×${SP.n}${SP.defDown ? '＋守り低下' : ''}）` : SP.type === 'buff' ? `${c.spNm}（周りの味方のちから強化）` : SP.type === 'guardup' ? `${c.spNm}（自分の守り強化＋敵を引きつける）` : `${c.spNm}（全員を回復＋気絶した仲間を蘇生）`;
  return [['A', 'kA', c.Anm || '通常攻撃', aShort(c), aLong], ['X', 'kX', X.nm, skShort(X), long(X)], ['Y', 'kY', Y.nm, skShort(Y), long(Y)], ['必殺', 'kS', c.spNm, spShort(c), spLong]];
}
function renderChara() {
  const c = DATA.CHI[G.chId], a = ACC(), own = ownsCh(c.id), rec = a.chars[c.id], lv = rec ? rec.lv : 1;
  $('#chTitleBar').textContent = '詳細';
  // 左：名前・ランク・役割・Lv・EXP・短い説明
  const L = $('#chLeft'); L.textContent = '';
  L.appendChild(el('div', 'nm ol', own ? c.nm : '？？？'));
  const tg = el('div', 'tags'); const rb = el('span', 'rkbig', c.rank + 'ランク'); rb.style.background = DATA.RANK_INFO[c.rank].col; tg.append(rb, el('span', '', DATA.ROLES[c.roleId].ic + ' ' + DATA.ROLES[c.roleId].label)); if (c.style) tg.appendChild(el('span', 'sty ' + c.style, c.style === 'cute' ? 'かわいい系' : 'かっこいい系')); const e = el('span', '', c.el + '属性'); e.style.background = DATA.ELEM_COL[c.el] || '#6a8ab0'; tg.appendChild(e); L.appendChild(tg);
  if (own) {
    const pr = DATA.GROWTH.progress(c.rank, rec.exp), r = el('div', 'lvrow'), xb = el('span', 'xpb'), xi = el('i'); xi.style.width = Math.round(pr.r * 100) + '%'; xb.appendChild(xi); r.append(el('b', 'ol', 'Lv.' + lv), xb); L.appendChild(r);
    L.appendChild(el('div', 'xpt', pr.need == null ? 'Lv.99 MAX' : `次のLvまで あと${(pr.need - pr.in).toLocaleString()} EXP（${pr.in.toLocaleString()} / ${pr.need.toLocaleString()}）`));
  } else L.appendChild(el('div', 'xpt', c.gacha ? '未所持：通常ガチャで入手（Lv1・EXP0で加入）' : '未所持'));
  L.appendChild(el('div', 'desc', (c.blurb || c.form || '') + (c.tags && c.tags.length ? `　得意：${c.tags.join('・')}` : '')));
  const slot = G.coop ? 0 : G.selSlot;
  if (own && G.party[slot] === c.id) { const sw = !!G.swap[slot]; const b = el('button', 'hm-chip', sw ? 'X・Y入れ替え中' : 'X・Yを入れ替える'); b.type = 'button'; b.onclick = () => { G.swap[slot] = !G.swap[slot]; STORE.set('swap', G.swap); sendMine(); AUDIO.sfx('ui'); renderChara(); }; L.appendChild(b); }
  // 右上：装備スロット1・2
  const n = SAVE.eqSlots(a), cur = own ? (rec.eq || []).slice(0, n) : [], EQ = $('#chEq'); EQ.textContent = '';
  for (let i = 0; i < 2; i++) {
    const w = el('div', 'eqs'), id = cur[i], E = id && DATA.EQUIP_I[id], tier = E ? E.tier : '';
    const b = el('button', (i >= n || !own ? 'locked ' : '') + (tier ? 't-' + tier : ''), i >= n ? '🔒' : E ? E.ic : '＋'); b.type = 'button'; b.setAttribute('aria-label', `装備スロット${i + 1}`);
    b.onclick = () => { AUDIO.sfx('ui'); if (!own) { mtoast('持っていないキャラは装備できません', 2000); return; } if (i >= n) { mtoast('装備スロット2は常磐線をクリアすると使えます', 2400); return; } openEq(i); };
    w.append(b, el('small', '', i >= n ? `スロット${i + 1}：常磐線クリアで解放` : E ? `${E.statLabel}+${E.pct}%（${E.short}）` : `装備スロット${i + 1}`));
    EQ.appendChild(w);
  }
  renderCharaStats();
  // 下：このキャラを選ぶ
  const aiS = G.coop && coopAiSlot(G.selSlot) ? G.selSlot : 0, pick = $('#btnChPick'), inSlot = aiS ? coopAiCh(aiS) === c.id : G.party[slot] === c.id;
  $('#chSlot').textContent = G.coop ? (aiS ? `P${aiS + 1}のAI枠（ホストが選ぶ）` : 'あなたのキャラ') : `P${slot + 1}の枠（${slot === 0 ? 'あなた' : 'AI'}）`;
  pick.disabled = !own || inSlot; pick.textContent = !own ? '未所持' : inSlot ? '選択中' : 'このキャラを選ぶ';
  LOBBY3D.show('detail', [c.id]);
}
/** 能力バーの共通の目盛り：全60体のLv99の最高値（キャラごとに伸ばさない） */
function statScale() { if (G._stSc) return G._stSc; const o = { hp: 1, str: 1, yo: 1, def: 1 }; for (const c of DATA.CHARS) { const s = DATA.GROWTH.stats(c, 99); for (const k in o) o[k] = Math.max(o[k], s[k]); } return (G._stSc = o); }
/** 右：能力（横バー・装備の候補があれば差分を表示）と技の要点 */
function renderCharaStats() {
  const c = DATA.CHI[G.chId], a = ACC(), own = ownsCh(c.id), rec = a.chars[c.id], lv = rec ? rec.lv : 1;
  const s0 = DATA.GROWTH.stats(c, lv), eqNow = own ? eqOf(c.id) : [], now = DATA.GROWTH.withEquip(s0, eqNow);
  const pv = G.eqEdit ? DATA.GROWTH.withEquip(s0, G.eqEdit.eq) : null;
  const R = $('#chRight'); R.textContent = ''; R.appendChild(el('div', 'st-lv', `Lv.${lv}${own ? '' : '（未所持）'}の能力（バーは全60体共通の目盛り・緑＝装備）`)); const SG = el('div', 'st-grid'); R.appendChild(SG);
  const SC = statScale();
  for (const [lab, k, ic, col] of [['HP', 'hp', '♥', '#2fa36b'], ['ちから', 'str', '✊', '#e4572e'], ['ようりょく', 'yo', '✦', '#7446b8'], ['まもり', 'def', '⛨', '#3c8cff']]) {
    const r = el('div', 'st-row'), si = el('span', 'si', ic); si.style.background = col; const v = el('b', 'ol');
    if (pv && pv[k] !== now[k]) { v.append(String(now[k]) + ' → '); v.appendChild(el('span', pv[k] > now[k] ? 'up' : 'dn', String(pv[k]))); }
    else { v.textContent = String(now[k]); if (now[k] > s0[k]) { v.classList.add('equp'); v.title = `装備で+${now[k] - s0[k]}`; } }
    const pc = x => Math.min(100, x / SC[k] * 100).toFixed(1) + '%', bar = el('div', 'stb');
    const iq = el('i', 'eq'); iq.style.width = pc(now[k]); const ib = el('i'); ib.style.width = pc(s0[k]); ib.style.background = col; bar.append(iq, ib);
    if (pv && pv[k] !== now[k]) { const ip = el('i', 'pv'); ip.style.width = pc(pv[k]); bar.appendChild(ip); }
    if (now[k] > s0[k]) v.append(el('small', '', `（+${now[k] - s0[k]}）`));
    r.append(si, el('span', '', lab), v, bar); SG.appendChild(r);
  }
  for (const [k, cls, nm, sh] of charaMoves(c)) { const r = el('div', 'mv-row'), kk = el('span', 'k ' + cls, k), t = el('div'); t.append(el('b', '', nm), el('span', '', sh)); r.append(kk, t); R.appendChild(r); }
  const ib = el('button', 'hm-chip ch-info', 'ⓘ 技と特性をくわしく'); ib.type = 'button'; ib.onclick = () => { AUDIO.sfx('ui'); openInfo(); }; R.appendChild(ib);
}
function openInfo() {
  const c = DATA.CHI[G.chId], b = $('#infoBody'); b.textContent = ''; $('#infoT').textContent = ownsCh(c.id) ? c.nm : '？？？';
  for (const [k, cls, , , lg] of charaMoves(c)) { const r = el('div', 'mv-row'); r.append(el('span', 'k ' + cls, k), el('span', '', lg)); b.appendChild(r); }
  const r = el('div', 'mv-row'); r.append(el('span', 'k kP', '特性'), el('span', '', c.psv || 'なし')); b.appendChild(r);
  const s99 = DATA.GROWTH.stats(c, 99); b.appendChild(el('div', '', `Lv99の能力：HP${s99.hp}・ちから${s99.str}・ようりょく${s99.yo}・まもり${s99.def}。AIが操作するときは各95%。`));
  if (c.form) b.appendChild(el('div', '', c.form + (c.isNew ? `（身長${c.h.toFixed(2)}m・${c.hr}頭身）` : '')));
  $('#infoPop').hidden = false;
}
function openEq(slot) {
  const c = DATA.CHI[G.chId], a = ACC(), n = SAVE.eqSlots(a), cur = (a.chars[c.id].eq || []).slice(0, n);
  G.eqEdit = { slot, sel: cur[slot] || null, eq: cur.slice() };
  $('#eqPopT').textContent = `装備スロット${slot + 1}`;
  renderEq(); $('#eqPop').hidden = false; renderCharaStats();
}
function renderEq() {
  const c = DATA.CHI[G.chId], a = ACC(), n = SAVE.eqSlots(a), cur = (a.chars[c.id].eq || []).slice(0, n), E = G.eqEdit, g = $('#eqGrid'); g.textContent = '';
  let any = 0;
  for (const e of DATA.EQUIP) {
    const C = SAVE.eqCount(a, e.id, c.id), mine = cur[E.slot] === e.id; if (e.legacy && !C.own) continue; // 旧装備は持っているときだけ
    const other = cur.some((x, j) => j !== E.slot && x === e.id), who = !C.free && !mine ? SAVE.equipOwner(a, e.id, c.id) : null; if (C.own) any++;
    const b = el('button', 'eq-it t-' + e.tier + (E.sel === e.id ? ' sel' : '') + (who ? ' held' : '') + (!C.own ? ' none' : '')); b.type = 'button'; b.disabled = other || !C.own; // 持っていない装備は選べない
    b.append(el('span', 'ic', e.ic), el('b', 'ol eq-big', `${e.statLabel}+${e.pct}%`), el('span', 'ol', e.short + (e.legacy ? '（旧）' : '')));
    if (C.own) b.appendChild(el('span', 'eq-n', '×' + C.own));
    b.appendChild(el('span', 'eq-who', !C.own ? '未所持' : `装備中${C.used + (mine ? 1 : 0)}・使える${C.free}`)); if (who) b.appendChild(el('span', 'eq-who', `${DATA.CHI[who].nm}が装備中`));
    b.onclick = () => { AUDIO.sfx('ui'); E.sel = e.id; const eq = cur.slice(); while (eq.length <= E.slot) eq.push(null); eq[E.slot] = e.id; E.eq = eq.filter(Boolean); renderEq(); renderCharaStats(); };
    g.appendChild(b);
  }
  if (!any) g.appendChild(el('p', 'small eq-empty', 'まだ装備を持っていません。ステージに勝つと、ときどき装備が手に入ります。'));
  const C0 = E.sel ? SAVE.eqCount(a, E.sel, c.id) : null, who = E.sel && C0 && !C0.free && cur[E.slot] !== E.sel ? SAVE.equipOwner(a, E.sel, c.id) : null; $('#btnEqOk').textContent = who ? `付け替える（${DATA.CHI[who].nm}から外す）` : '決定';
  // 余りを捨てる（個数を選ぶ）：装備中の分は捨てない
  const dz = $('#eqDiscard'); if (dz) { const Cs = E.sel ? SAVE.eqCount(a, E.sel) : null; dz.hidden = !(Cs && Cs.free > 0); if (Cs) { E.dn = Math.max(1, Math.min(E.dn || 1, Cs.free)); $('#eqDn').textContent = E.dn + '個'; $('#eqDfree').textContent = `（余り${Cs.free}個）`; } }
}
function eqDiscard() {
  const E = G.eqEdit, a = ACC(); if (!E || !E.sel) return; const r = SAVE.discardEquip(a, E.sel, E.dn || 1); if (!r.ok) { mtoast(r.msg, 2200); return; }
  AUDIO.sfx('back'); mtoast(`${DATA.EQUIP_I[E.sel].nm}を${E.dn || 1}個捨てました（残り${r.left}個）`, 2200); if (!r.left) E.sel = null; E.dn = 1; if (G.acct) persist(); renderEq(); renderChara();
}
function eqCommit(id) {
  const c = DATA.CHI[G.chId], E = G.eqEdit; if (!E) return;
  const r = SAVE.setEquip(ACC(), c.id, E.slot, id, { move: true }); if (!r.ok) { mtoast(r.msg, 2400); return; } // 決定ボタンが「付け替える（○○から外す）」と表示しているときだけ前のキャラから外れる
  if (r.moved) mtoast(`${DATA.CHI[r.moved].nm}から外して付けました`, 2200);
  AUDIO.sfx('ok'); G.eqEdit = null; $('#eqPop').hidden = true; if (G.acct) persist(); sendMine(); renderChara();
}
function charaPick() {
  const c = DATA.CHI[G.chId]; if (!ownsCh(c.id)) return; AUDIO.sfx('ok');
  if (G.coop && coopAiSlot(G.selSlot)) { const r = G.session.setAi(G.selSlot, c.id, lvOf(c.id)); if (!r.ok) { mtoast(r.msg, 2000); return; } mtoast(`${c.nm}をP${G.selSlot + 1}のAI枠にしました`, 1800); show('roster'); renderRoster(true); return; }
  if (G.coop) { if (coopLobby() && (coopLobby().ai || []).includes(c.id) && G.session.kind === 'host') { const j = coopLobby().ai.indexOf(c.id); G.session.lobby.aiPick[j] = G.party[0]; G.session.dirtyLobby = true; } G.party[0] = c.id; G.selSlot = 0; } // 自分がAI枠のキャラを選んだら、そのAI枠は前の自分のキャラと入れ替え
  else { const j = G.party.indexOf(c.id), s = G.selSlot; if (j >= 0 && j !== s) { G.party[j] = G.party[s]; const sw = G.swap[j]; G.swap[j] = G.swap[s]; G.swap[s] = sw; } G.party[s] = c.id; }
  STORE.set('party', G.party); STORE.set('swap', G.swap); sendMine(); if (G.acct) persist();
  mtoast(`${c.nm}を${G.coop ? 'あなたのキャラ' : 'P' + (G.selSlot + 1) + 'の枠'}にしました`, 1800);
  show('roster'); renderRoster(true);
}

/* ---------- ステージ選択 ---------- */
function openStageSel() {
  if (G.coop && G.session && G.session.kind !== 'host') { mtoast('ステージはホストが選びます', 2000); return; }
  show('stagesel'); renderStageSel();
}
function renderStageSel() {
  const box = $('#stages'); box.textContent = ''; const cur = curStage(), pl = avgLv(G.party);
  $('#btnWalkReplay').hidden = !ACC().walkSeen;
  for (const s of STAGES) {
    const open = stageOpen(s.id), b = el('button', 'ss-card' + (s.id === cur ? ' sel' : '')); b.type = 'button';
    const hd = el('div', 'hd'); hd.append(el('small', 'ol', CHAP[s.ch]), el('b', 'ol', s.nm)); hd.style.background = ['linear-gradient(90deg,#e4572e,#9a2f4a)', 'linear-gradient(90deg,#1d56b8,#19a596)', 'linear-gradient(90deg,#c0306a,#5a3a8a)'][s.ch];
    const art = el('div', 'art'); art.innerHTML = stageArt(s.id);
    const ft = el('div', 'ft'); ft.append(el('span', '', '登場：' + s.en)); ft.appendChild(el('span', 'rec', s.rec > 1 ? `推奨Lv${s.rec}（いまの平均Lv${pl}）` : 'はじめのステージ'));
    if (cleared(s.id)) ft.appendChild(el('span', 'clr', '✔ クリア済み'));
    b.append(hd, art, ft);
    if (s.id === cur) b.appendChild(el('span', 'selmark', '選択中'));
    if (!open) { const lk = el('div', 'lockov'); lk.append(el('span', 'lk', '🔒'), el('span', 'ol', s.lock)); b.appendChild(lk); }
    b.onclick = () => {
      if (!open) { AUDIO.sfx('back'); mtoast(s.lock, 2400); return; }
      AUDIO.sfx('ok');
      if (G.coop && G.session && G.session.kind === 'host') { G.session.lobby.stage = s.id; G.session.dirtyLobby = true; }
      else { G.stageSel = s.id; STORE.set('stageSel', s.id); }
      show('title');
    };
    box.appendChild(b);
  }
  requestAnimationFrame(() => { const sel = box.querySelector('.ss-card.sel'); if (sel) box.scrollLeft = Math.max(0, sel.offsetLeft - 20); });
}

/* ---------- 出動（ホームの黄色いボタン） ---------- */
function homeGo() {
  const st = curStage();
  if (G.coop) {
    const S = G.session; if (!S || S.kind !== 'host') return;
    if (!stageOpen(st)) { mtoast('このステージはまだ解放されていません', 2000); return; }
    AUDIO.sfx('ok'); S.lobby.diff = G.diff; S.lobby.stage = st;
    const fill = S.aiFill(), party = S.lobby.slots.map((s, i) => i === 0 ? { eq: eqOf(G.party[0]) } : s ? { eq: (s.eq || []).filter(e => DATA.EQUIP_I[e]).slice(0, 2) } : { eq: eqOf(fill[i]) });
    { const mine = party.map((p, i) => i === 0 || !S.lobby.slots[i]), u = SAVE.uniqEq(party.map((p, i) => mine[i] ? p.eq : []), ACC()); party.forEach((p, i) => { if (mine[i]) p.eq = u[i]; }); } // ホストのアカウントの枠（自分＋AI）どうしで重ねない
    markUsed(G.party.slice(0, 1).concat(fill.filter(Boolean)));
    S.startGame({ bid: newBid(), party }); enterGame(); return;
  }
  if (!stageOpen(st)) { AUDIO.sfx('back'); mtoast(stageOf(st).lock, 2400); return; }
  AUDIO.sfx('ok'); startSolo(st);
}
/** 「最近使った順」のため、実際に出動したときだけ記録する（一覧を見ただけでは変えない） */
function markUsed(ids) { const a = ACC(), t = Date.now(); for (const id of ids) if (a && a.chars[id]) a.chars[id].used = t; }

/* ---------- ログイン前の3択 ---------- */
function openLgPanel(reg) { $('#lgPanel').hidden = false; showDone(false); setRegMode(!!reg); lgMsg(''); setTimeout(() => { try { (reg ? $('#lgPw') : ($('#lgId').value ? $('#lgPw') : $('#lgId'))).focus(); } catch (e) { } }, 50); }

function bindLobby() {
  $('#btnSolo').onclick = () => homeGo();
  $('#btnTeam').onclick = () => { AUDIO.sfx('ok'); openRoster('home'); };
  $('#btnGacha').onclick = () => { AUDIO.sfx('ok'); if (G.coop) { mtoast('協力プレイのルームにいる間はガチャを開けません', 2200); return; } openGacha(); };
  $('#btnStageSel').onclick = () => { AUDIO.sfx('ui'); openStageSel(); };
  $('#btnRoomLeave').onclick = () => { AUDIO.sfx('back'); goTitle(); mtoast('ルームから退出しました'); };
  $('#btnJwCancel').onclick = () => { AUDIO.sfx('back'); joinWait(false); goTitle(); mtoast('参加をやめました'); }; // v8：入室待ちをやめる（部屋を片付けて、もう一度入り直せる）
  $('#btnCoopBack').onclick = () => { AUDIO.sfx('back'); show('title'); };
  $('#btnRosterBack').onclick = () => rosterBack();
  $('#btnRosterHome').onclick = () => { AUDIO.sfx('back'); persistPrefs(); show('title'); };
  $('#btnGo').onclick = () => rosterGo();
  $('#rsSort').onclick = e => { e.stopPropagation(); AUDIO.sfx('ui'); rsSortOpen($('#rsSortPanel').hidden); };
  $('#rsSort').onkeydown = e => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rsSortOpen(true); } };
  $('#rsSortPanel').onkeydown = e => { const bs = [...$('#rsSortPanel').children], i = bs.indexOf(document.activeElement); if (e.key === 'Escape') { rsSortOpen(false); $('#rsSort').focus(); } else if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } };
  document.addEventListener('pointerdown', e => { const p = $('#rsSortPanel'); if (!p.hidden && !e.target.closest('.rs-sort')) rsSortOpen(false); }, true);
  $('#rsItemsBtn').onclick = () => { AUDIO.sfx('ui'); renderItemsPop(); $('#itemsPop').hidden = false; };
  $('#btnItemsX').onclick = () => { AUDIO.sfx('back'); $('#itemsPop').hidden = true; };
  $('#btnCharaBack').onclick = () => { AUDIO.sfx('back'); G.eqEdit = null; show('roster'); renderRoster(true); };
  $('#btnCharaHome').onclick = () => { AUDIO.sfx('back'); G.eqEdit = null; show('title'); };
  $('#btnChPick').onclick = () => charaPick();
  $('#btnEqX').onclick = () => { AUDIO.sfx('back'); G.eqEdit = null; $('#eqPop').hidden = true; renderCharaStats(); };
  $('#btnEqOk').onclick = () => { const E = G.eqEdit; if (E) eqCommit(E.sel); };
  $('#btnEqNone').onclick = () => eqCommit(null);
  $('#btnEqDm').onclick = () => { const E = G.eqEdit; if (E) { E.dn = Math.max(1, (E.dn || 1) - 1); renderEq(); } };
  $('#btnEqDp').onclick = () => { const E = G.eqEdit; if (E) { E.dn = (E.dn || 1) + 1; renderEq(); } };
  $('#btnEqDiscard').onclick = () => eqDiscard();
  $('#btnInfoX').onclick = () => { AUDIO.sfx('back'); $('#infoPop').hidden = true; };
  $('#btnStageBack').onclick = () => { AUDIO.sfx('back'); show('title'); };
  $('#btnStageHub').onclick = () => { AUDIO.sfx('back'); show('title'); };
  $('#btnChLogin').onclick = () => { AUDIO.sfx('ui'); openLgPanel(false); };
  $('#btnChReg').onclick = () => { AUDIO.sfx('ui'); openLgPanel(true); };
  $('#btnLgBack').onclick = () => { AUDIO.sfx('back'); $('#lgPanel').hidden = true; };
  $('#btnSet').onclick = () => openSub('settings', 'title');
  $('#btnLgSet').onclick = () => openSub('settings', 'login');
  document.querySelectorAll('[data-gear]').forEach(b => b.onclick = () => { const s = b.closest('.screen'); openSub('settings', s ? s.id : 'title'); });
  $('#btnSetHow').onclick = () => { G.backPrev = G.back; openSub('how', 'settings'); };
  bindFriend();
  makeHScroll($('#cards')); makeHScroll($('#stages'));
  // v7 P4-8：ホームの3Dモデル本体をタップ → その枠の編成へ（名札と同じ動き）。ドラッグ・長押し・ボタン上は数えない
  { let td = null;
    document.addEventListener('pointerdown', e => { td = $('#title').hidden ? null : { id: e.pointerId, p: toApp(e), t: performance.now() }; }, true);
    document.addEventListener('pointerup', e => {
      const d = td; td = null; if (!d || d.id !== e.pointerId || $('#title').hidden || !LOBBY3D.active() || LOBBY3D.mode !== 'home') return;
      if (e.target.closest && e.target.closest('button,input,textarea,select,a,.hm-tag,.hm-left,.hm-bottom,.hm-top,.hm-room,.bl-pop,.pop,#frInv,#acctPop,.toast')) return;
      const p = toApp(e); if (Math.hypot(p[0] - d.p[0], p[1] - d.p[1]) > 14 || performance.now() - d.t > 700) return;
      const i = homeModelAt(p[0], p[1]); if (i >= 0) tagTap(i);
    }, true); }
  // キャラ詳細：中央を左右にドラッグして回す（一覧の横スワイプとは別の場所）
  const rot = $('#chRot'); let rd = null;
  rot.addEventListener('pointerdown', e => { rd = { id: e.pointerId, x: toApp(e)[0] }; try { rot.setPointerCapture(e.pointerId); } catch (er) { } });
  rot.addEventListener('pointermove', e => { if (!rd || rd.id !== e.pointerId) return; const x = toApp(e)[0]; LOBBY3D.rot((x - rd.x) * 0.012); rd.x = x; });
  const end = () => { rd = null; }; rot.addEventListener('pointerup', end); rot.addEventListener('pointercancel', end);
}
