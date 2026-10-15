/* =====================================================================
   ui.js — 画面遷移・HUD・タッチ操作・メインループ
   ===================================================================== */
const $ = s => document.querySelector(s);
const STORE = { get(k, d) { try { const v = localStorage.getItem('tb.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('tb.' + k, JSON.stringify(v)); } catch (e) { } } };
const SET = Object.assign({ land: true, rotDir: 'left', ui: 100, mirror: false, stick: 'fixed', shake: true, simple: false, relock: false, vib: true, bgm: 50, sfx: 85, dev: false }, STORE.get('set', {}));
const PUBLIC_URL = 'https://koyoy1016-gif.github.io/games/tobatoban/';
const G = {
  mode: 'boot', session: null, v: null, T: 0, party: STORE.get('party', DATA.DEFAULT_PARTY.slice()), swap: STORE.get('swap', [false, false, false, false]),
  items: STORE.get('items', ['onigiri', 'ramune']), diff: STORE.get('diff', 'normal'), selSlot: 0, focus: null, thumbs: {}, netMode: null, roomCap: null,
  lock: null, back: 'title', coop: false, nick: STORE.get('nick', ''), lagBoss: 1, lagMe: 1, spTotals: {}, resultShown: false, rotateDismissed: false, firstRun: !STORE.get('played', false),
};
if (!G.party.every(id => DATA.CHI[id])) G.party = DATA.DEFAULT_PARTY.slice();
const vib = p => { try { if (SET.vib && navigator.vibrate) navigator.vibrate(p); } catch (e) { } };
const pcol = i => DATA.PCOL[i % 4];
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* ---------- 拡大しないように画面を固定（ダブルタップ・ピンチ） ---------- */
(function lockZoom() {
  try { const m = document.querySelector('meta[name=viewport]'); if (m) m.setAttribute('content', 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'); } catch (e) { }
  const isField = t => t && t.closest && t.closest('input,textarea,select');
  let lastEnd = 0;
  document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastEnd < 350 && !isField(e.target)) { e.preventDefault(); const b = e.target.closest && e.target.closest('.screen button'); if (b && !b.disabled) b.click(); } lastEnd = now; }, { passive: false }); // 2回目のタップも押した扱いにする
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); if (typeof e.scale === 'number' && e.scale !== 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', e => { if (!isField(e.target)) e.preventDefault(); }, { passive: false });
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, e => e.preventDefault(), { passive: false });
  document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', e => { if (!isField(e.target)) e.preventDefault(); });
})();

/* ---------- 横向き固定（縦持ちの端末では画面全体を90度回す） ---------- */
function applyRotation() {
  const app = $('#app'); const vw = window.innerWidth, vh = window.innerHeight;
  const rot = SET.land && vh > vw * 1.05 ? (SET.rotDir === 'right' ? -90 : 90) : 0;
  VIEW.rot = rot; VIEW.w = rot ? vh : vw; VIEW.h = rot ? vw : vh;
  app.style.width = VIEW.w + 'px'; app.style.height = VIEW.h + 'px';
  app.style.transform = rot === 90 ? `translate(${vw}px,0) rotate(90deg)` : rot === -90 ? `translate(0,${vh}px) rotate(-90deg)` : 'translate(0,0)';
  app.classList.toggle('rot', !!rot);
  app.style.setProperty('--aw', VIEW.w / 100 + 'px'); app.style.setProperty('--ah', VIEW.h / 100 + 'px');
  readSafe();
  for (const [k, v] of [['--sat', safe.t], ['--sar', safe.r], ['--sab', safe.b], ['--sal', safe.l]]) app.style.setProperty(k, v + 'px');
  if (rot && !G.turnShown) { G.turnShown = true; const t = $('#turnHint'); t.hidden = false; setTimeout(() => t.hidden = true, 2900); }
  if (!rot) $('#turnHint').hidden = true;
}
/** 画面上の指の位置 → 回転後のゲーム画面の座標 */
function toApp(e) {
  if (VIEW.rot === 90) return [e.clientY, window.innerWidth - e.clientX];
  if (VIEW.rot === -90) return [window.innerHeight - e.clientY, e.clientX];
  return [e.clientX, e.clientY];
}
function onViewChange() { applyRotation(); R.resize(); layoutHud(); }

/* ---------- 画面 ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
  $('#hud').hidden = !(G.mode === 'play' && !id);
}
function goTitle() {
  if (G.session) { try { G.session.leave(); } catch (e) { } }
  G.session = null; G.mode = 'title'; G.v = null; G.coop = false; R.clearEntities(); AUDIO.bgm('title');
  $('#bossCard').classList.remove('show'); $('#banner').classList.remove('show'); $('#rotateHint').hidden = true;
  show('title');
}
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { AUDIO.sfx('back'); show(G.back); if (G.back === 'pause') {} });
function openSub(id, from) { G.back = from; show(id); }

/* ---------- 起動 ---------- */
async function boot() {
  const fontsReady = Promise.race([Promise.all([document.fonts.load('40px "Yuji Syuku"', '千住'), document.fonts.load('40px "Dela Gothic One"', 'トバ'), document.fonts.load('900 16px "Zen Maru Gothic"', 'もののけ')]), new Promise(r => setTimeout(r, 2500))]).catch(() => { });
  await fontsReady;
  applyRotation();
  R.init($('#gl'));
  R.setOpts({ shake: SET.shake, simple: SET.simple });
  R.on('notice', onNotice);
  makeThumbs();
  bindMenus(); bindHud(); bindRotScroll(); applySettings();
  detectNet();
  G.mode = 'title'; show('title');
  requestAnimationFrame(frame);
}
function makeThumbs() {
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(144, 144, false);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x554466, 1.7)); const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(1.5, 2, 3); sc.add(dl);
    const cm = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    for (const c of DATA.CHARS) {
      const m = GFX.makeChar(c); sc.add(m.root); m.root.rotation.y = 0.45; m.root.position.set(0, 0, 0);
      GFX.animChar(m, { x: 0, z: 0, yaw: 0.45, st: 'ok', act: '', actT: 0, slot: 0, moving: false }, 0.3, 0, {});
      const hh = c.h; cm.position.set(0, 0.62 * hh, 3.1 * hh); cm.lookAt(0, 0.52 * hh, 0);
      r.render(sc, cm); G.thumbs[c.id] = r.domElement.toDataURL('image/png'); sc.remove(m.root);
    }
    r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
  } catch (e) { console.warn('thumbs', e); }
}
async function detectNet() {
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');
  const dot = $('#netDot'), msg = $('#netMsg');
  try {
    if (inClaude) { G.roomCap = await window.claude.use('room'); G.netMode = G.roomCap ? 'room' : 'none-claude'; }
    else G.netMode = typeof RTCPeerConnection === 'function' ? 'p2p' : 'none';
  } catch (e) { G.netMode = inClaude ? 'none-claude' : 'none'; }
  msg.textContent = '';
  if (G.netMode === 'p2p') { dot.className = 'dot ok'; msg.textContent = 'ログインなしで通信できます（WebRTCの直接通信）。友だちにこのページのURLを送り、同じ合言葉を入れてもらってください。'; }
  else if (G.netMode === 'room') { dot.className = 'dot ok'; msg.textContent = 'このページを共有した同じ組織のメンバーと通信できます。ログインなしで遊ぶ人は次のURLへ：'; const a = el('a', '', PUBLIC_URL); a.href = PUBLIC_URL; a.target = '_blank'; a.rel = 'noopener'; a.style.wordBreak = 'break-all'; msg.appendChild(document.createElement('br')); msg.appendChild(a); }
  else if (G.netMode === 'none-claude') { dot.className = 'dot ng'; msg.textContent = 'ここでは協力プレイを使えません。ログインなしで友だちと遊ぶなら：'; const a = el('a', '', PUBLIC_URL); a.href = PUBLIC_URL; a.target = '_blank'; a.rel = 'noopener'; a.style.wordBreak = 'break-all'; msg.appendChild(document.createElement('br')); msg.appendChild(a); }
  else { dot.className = 'dot ng'; msg.textContent = 'このブラウザでは通信が使えません。「ひとりで遊ぶ」は遊べます。'; }
  if (/[?&]net=bc/.test(location.search)) { G.netMode = 'bc'; dot.className = 'dot ok'; msg.textContent = '開発用：同じブラウザのタブ同士で通信します（BroadcastChannel）'; }
  $('#btnHost').disabled = $('#btnJoin').disabled = !(G.netMode === 'p2p' || G.netMode === 'room' || G.netMode === 'bc');
}

/* ---------- メニュー操作 ---------- */
function bindMenus() {
  const unlock = () => { AUDIO.init(); AUDIO.setVol(SET.bgm / 100, SET.sfx / 100); if (G.mode === 'title') AUDIO.bgm('title'); };
  document.addEventListener('pointerdown', unlock, { once: false, passive: true });
  $('#btnSolo').onclick = () => { AUDIO.sfx('ok'); G.coop = false; openTeam(); };
  $('#btnCoop').onclick = () => { AUDIO.sfx('ok'); $('#nick').value = G.nick; show('coop'); };
  $('#btnCoopBack').onclick = () => { AUDIO.sfx('back'); show('title'); };
  $('#btnHow').onclick = () => openSub('how', 'title');
  $('#btnSet').onclick = () => openSub('settings', 'title');
  $('#btnData').onclick = () => { renderData(); openSub('data', 'title'); };
  $('#btnHost').onclick = () => startHost();
  $('#btnJoin').onclick = () => startJoin();
  $('#btnTeamBack').onclick = () => { AUDIO.sfx('back'); if (G.coop) goTitle(); else show('title'); };
  $('#btnGo').onclick = () => { AUDIO.sfx('ok'); if (G.coop) { if (G.session && G.session.kind === 'host') { G.session.lobby.diff = G.diff; G.session.startGame(); enterGame(); } } else startSolo(); };
  $('#btnResume').onclick = () => resume();
  $('#btnPSet').onclick = () => openSub('settings', 'pause');
  $('#btnPHow').onclick = () => openSub('how', 'pause');
  $('#btnQuit').onclick = () => { AUDIO.sfx('back'); goTitle(); };
  $('#btnSkip').onclick = () => { const s = G.session; if (s && s.sim && s.sim.stage === 'intro' && s.kind === 'solo') s.sim.stageT = DATA.BOSS.introT; resume(); };
  $('#btnRetry').onclick = () => { AUDIO.sfx('ok'); if (G.coop) { if (G.session.kind === 'host') { G.session.backToLobby(); openLobby(); } } else startSolo(); };
  $('#btnReteam').onclick = () => { AUDIO.sfx('ok'); if (G.coop) { if (G.session.kind === 'host') G.session.backToLobby(); openLobby(); } else openTeam(); };
  $('#btnResTitle').onclick = () => { AUDIO.sfx('back'); goTitle(); };
  $('#btnLostOk').onclick = () => goTitle();
  $('#rotateX').onclick = () => { G.rotateDismissed = true; $('#rotateHint').hidden = true; layoutHud(); };
  // 設定
  const tog = (id, key, labels) => { const b = $(id); const upd = () => { b.textContent = labels ? labels[SET[key] ? 1 : 0] : (SET[key] ? 'ON' : 'OFF'); b.classList.toggle('on', !!SET[key]); }; b.onclick = () => { SET[key] = !SET[key]; upd(); applySettings(); AUDIO.sfx('ui'); }; upd(); };
  tog('#sMirror', 'mirror'); tog('#sShake', 'shake'); tog('#sSimple', 'simple'); tog('#sRelock', 'relock'); tog('#sVib', 'vib'); tog('#sDev', 'dev');
  const sb = $('#sStick'); const updS = () => { sb.textContent = SET.stick === 'fixed' ? '固定' : '触れた所に出る'; }; sb.onclick = () => { SET.stick = SET.stick === 'fixed' ? 'follow' : 'fixed'; updS(); applySettings(); }; updS();
  document.querySelectorAll('.stepper').forEach(st => {
    const k = st.dataset.key, mn = +st.dataset.min, mx = +st.dataset.max, sp = +st.dataset.step, out = st.querySelector('output');
    const upd = () => { out.textContent = SET[k] + '%'; };
    const [dn, upB] = st.querySelectorAll('button');
    dn.onclick = () => { SET[k] = Math.max(mn, SET[k] - sp); upd(); applySettings(); AUDIO.sfx('ui'); };
    upB.onclick = () => { SET[k] = Math.min(mx, SET[k] + sp); upd(); applySettings(); AUDIO.sfx('ui'); };
    upd();
  });
  tog('#sLand', 'land'); $('#sLand').addEventListener('click', onViewChange);
  const rd = $('#sRotDir'); const updR = () => { rd.textContent = SET.rotDir === 'right' ? '右に倒す' : '左に倒す'; }; rd.onclick = () => { SET.rotDir = SET.rotDir === 'right' ? 'left' : 'right'; updR(); STORE.set('set', SET); onViewChange(); AUDIO.sfx('ui'); }; updR();
  const fs = $('#sFull'); const fsOk = !!(document.documentElement.requestFullscreen && document.fullscreenEnabled !== false); fs.closest('.set-row').hidden = !fsOk;
  fs.onclick = async () => { try { if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); try { await screen.orientation.lock('landscape'); } catch (e) { } fs.textContent = '全画面をやめる'; } else { await document.exitFullscreen(); fs.textContent = '全画面にする'; } } catch (e) { fs.textContent = 'この画面では使えません'; } setTimeout(onViewChange, 300); };
  $('#nick').oninput = () => { G.nick = $('#nick').value.trim().slice(0, 10); STORE.set('nick', G.nick); };
}
function bindRotScroll() {
  let drag = null;
  document.querySelectorAll('.screen, #dataTable').forEach(el => {
    el.addEventListener('pointerdown', e => { if (!VIEW.rot) return; drag = { el: e.currentTarget.id === 'dataTable' ? e.currentTarget : (e.target.closest('#dataTable') || e.currentTarget), id: e.pointerId, y: toApp(e)[1] }; }, { passive: true });
  });
  addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const y = toApp(e)[1]; drag.el.scrollTop -= y - drag.y; drag.y = y; }, { passive: true });
  addEventListener('pointerup', () => { drag = null; }); addEventListener('pointercancel', () => { drag = null; });
}
function applySettings() {
  STORE.set('set', SET);
  applyRotation(); if (R.camera) R.resize();
  document.documentElement.style.setProperty('--ui', Math.max(0.8, Math.min(1.3, SET.ui / 100)));
  R.setOpts({ shake: SET.shake, simple: SET.simple });
  AUDIO.setVol(SET.bgm / 100, SET.sfx / 100);
  $('#dev').hidden = !SET.dev;
  layoutHud();
}

/* ---------- 編成・ロビー ---------- */
function openTeam() {
  G.coop = false; $('#teamEyebrow').textContent = '編成（ソロ：1体を操作＋AI3体）'; $('#teamTitle').textContent = '4体を選ぶ';
  $('#lobCode').hidden = true; $('#lobStatus').hidden = true; $('#diffRow').hidden = false; $('#btnGo').disabled = false; $('#btnGo').textContent = '出撃する';
  G.focus = G.party[G.selSlot]; renderTeam(); show('team');
}
function openLobby() {
  G.coop = true; G.mode = 'lobby'; $('#hud').hidden = true;
  $('#teamEyebrow').textContent = '協力プレイのロビー'; $('#teamTitle').textContent = '自分のもののけを選ぶ';
  $('#lobCode').hidden = false; $('#lobStatus').hidden = false;
  G.focus = G.party[0]; renderTeam(); show('team');
}
function myLobbySlot() { const s = G.session; if (!s) return 0; return s.kind === 'host' ? 0 : s.mySlot; }
function renderTeam() {
  const box = $('#slots'); box.textContent = '';
  const coop = G.coop, S = G.session;
  let lob = null; if (coop && S) lob = S.kind === 'host' ? S.lobbyMsg() : S.lobby;
  for (let i = 0; i < 4; i++) {
    const b = el('button', 'slot'); b.type = 'button';
    let ch = G.party[i], nm = DATA.CHI[ch].nm, tag = i === 0 ? 'あなた' : 'AI';
    if (coop) {
      const s = lob && lob.slots[i];
      if (s) { ch = s.ch; nm = s.nick; tag = s.peer === (S.tr && S.tr.self) ? 'あなた' : '参加者'; }
      else if (lob && lob.ai) { ch = lob.ai[i] || 'kogemaru'; nm = DATA.CHI[ch].nm; tag = 'AI'; }
      else { tag = '空き'; }
      if (i === myLobbySlot()) b.classList.add('sel');
    } else if (i === G.selSlot) b.classList.add('sel');
    const pn = el('span', 'pn', 'P' + (i + 1)); pn.style.background = pcol(i); b.appendChild(pn);
    const im = el('img'); im.src = G.thumbs[ch] || ''; im.alt = ''; b.appendChild(im);
    b.appendChild(el('span', 'nm', nm)); const t = el('span', 'tag', tag); if (tag === 'あなた') t.style.background = 'var(--shu)'; b.appendChild(t);
    if (!coop) b.onclick = () => { G.selSlot = i; G.focus = G.party[i]; AUDIO.sfx('ui'); renderTeam(); };
    box.appendChild(b);
  }
  // 10体
  const cards = $('#cards'); cards.textContent = '';
  const mySel = coop ? G.party[0] : G.party[G.selSlot];
  for (const c of DATA.CHARS) {
    const b = el('button', 'card' + (c.id === G.focus ? ' cur' : '')); b.type = 'button';
    const im = el('img'); im.src = G.thumbs[c.id] || ''; im.alt = ''; b.appendChild(im);
    b.appendChild(el('span', 'nm', c.nm)); const e = el('span', 'el', c.el); e.style.background = DATA.ELEM_COL[c.el]; b.appendChild(e);
    const used = el('span', 'used');
    (coop ? [mySel] : G.party).forEach((id, i) => { if (id === c.id) { const p = el('span', 'pn', 'P' + (coop ? myLobbySlot() + 1 : i + 1)); p.style.background = pcol(coop ? myLobbySlot() : i); used.appendChild(p); } });
    b.appendChild(used);
    b.onclick = () => {
      AUDIO.sfx('ui'); G.focus = c.id;
      if (coop) { G.party[0] = c.id; sendMine(); }
      else { const j = G.party.indexOf(c.id); if (j >= 0 && j !== G.selSlot) { G.party[j] = G.party[G.selSlot]; const sw = G.swap[j]; G.swap[j] = G.swap[G.selSlot]; G.swap[G.selSlot] = sw; } G.party[G.selSlot] = c.id; }
      STORE.set('party', G.party); renderTeam();
    };
    cards.appendChild(b);
  }
  renderDetail();
  // アイテム
  const it = $('#items'); it.textContent = '';
  for (const id of DATA.ITEM_IDS) {
    const I = DATA.ITEMS[id], on = G.items.includes(id);
    const b = el('button', 'item' + (on ? ' on' : '')); b.type = 'button'; b.appendChild(el('b', '', I.icon)); b.appendChild(el('span', '', I.nm)); b.appendChild(el('span', 'small', I.desc));
    b.onclick = () => { AUDIO.sfx('ui'); if (on) { if (G.items.length > 1) G.items = G.items.filter(x => x !== id); } else { G.items.push(id); if (G.items.length > 2) G.items.shift(); } if (G.items.length < 2) G.items.push(DATA.ITEM_IDS.find(x => !G.items.includes(x))); STORE.set('items', G.items); sendMine(); renderTeam(); };
    it.appendChild(b);
  }
  // 難易度
  const dd = $('#diffs'); dd.textContent = '';
  const canDiff = !coop || (S && S.kind === 'host');
  const curDiff = coop && S && S.kind === 'client' && lob ? lob.diff : G.diff;
  for (const [k, nm, d] of [['normal', '通常（おすすめ）', '初めての人に'], ['hard', '超', '攻撃が重い'], ['extreme', '極', '一撃が致命的']]) {
    const b = el('button', 'chip' + (curDiff === k ? ' on' : ''), nm); b.type = 'button'; b.title = d; b.disabled = !canDiff;
    b.onclick = () => { G.diff = k; STORE.set('diff', k); if (S && S.kind === 'host') { S.lobby.diff = k; S.dirtyLobby = true; } AUDIO.sfx('ui'); renderTeam(); };
    dd.appendChild(b);
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
  const hd = el('div', 'hd'); hd.appendChild(el('b', '', c.nm)); const r = el('span', 'chip', c.role); hd.appendChild(r); const e = el('span', 'badge', c.el + '属性'); e.style.background = DATA.ELEM_COL[c.el]; hd.appendChild(e); d.appendChild(hd);
  d.appendChild(el('p', 'small', c.blurb));
  const st = el('div', 'stat');
  for (const [l, v, col] of [['ちから', c.str, '#e4572e'], ['ようりょく', c.yo, '#7446b8'], ['まもり', c.def, '#3f78d6']]) { st.appendChild(el('span', '', `${l} ${v}`)); const b = el('div', 'bar'); const i = el('i'); i.style.width = Math.round(v / 260 * 100) + '%'; i.style.background = col; b.appendChild(i); st.appendChild(b); }
  d.appendChild(st);
  const slotI = G.coop ? 0 : G.selSlot, sw = G.swap[slotI] && G.party[slotI] === c.id;
  const X = DATA.SKILLS[sw ? c.Y : c.X], Y = DATA.SKILLS[sw ? c.X : c.Y], S = DATA.SPECIALS[c.sp];
  const aTxt = c.A === 'combo3' ? `三連（威力 ${c.Apw.join('/')}）` : c.A === 'shot' ? `射撃（威力 ${c.Apw[0]}）` : `近接打撃（威力 ${c.Apw[0]}）`;
  const spTxt = S.type === 'multi' ? `${c.spNm}（${S.pw}×${S.n}${S.defDown ? '＋守り低下' : ''}）` : S.type === 'buff' ? `${c.spNm}（周りの味方のちから強化）` : S.type === 'guardup' ? `${c.spNm}（自分の守り強化＋敵を引きつける）` : `${c.spNm}（全員を回復＋気絶した仲間を蘇生）`;
  const mv = el('div', 'moves');
  for (const [k, cls, t] of [['A', 'kA', aTxt], ['X', 'kX', skillDesc(X)], ['Y', 'kY', skillDesc(Y)], ['必殺', 'kS', spTxt], ['特性', 'kP', c.psv]]) { mv.appendChild(el('span', 'k ' + cls, k)); mv.appendChild(el('span', '', t)); }
  d.appendChild(mv);
  if (G.party[slotI] === c.id) {
    const b = el('button', 'chip' + (sw ? ' on' : ''), sw ? 'X・Y入れ替え中' : 'X・Yを入れ替える'); b.type = 'button';
    b.onclick = () => { G.swap[slotI] = !G.swap[slotI]; STORE.set('swap', G.swap); sendMine(); AUDIO.sfx('ui'); renderTeam(); };
    d.appendChild(b);
  } else d.appendChild(el('p', 'small', G.coop ? 'カードを押すと自分のもののけになります。' : '選んだ枠に入れるにはカードを押してください。'));
}
function skillDesc(s) {
  const m = { charge: `${s.nm}：長押しでため、離して発動（基礎威力${s.pw}）`, dodge: '回避：押した方向へすばやく移動（一瞬無敵）', dot: `${s.nm}：当てた敵に${s.dur}秒の継続ダメージ`, retreat: `${s.nm}：攻撃しながら後ろへ下がる（威力${s.pw}）`, stealth: `${s.nm}：${s.dur}秒狙われにくくなる`, parry: `${s.nm}：構えて攻撃を受けると反撃`, heavy: `${s.nm}：ためて重い一撃（威力${s.pw}）`, trap: `${s.nm}：足元に麻痺のワナ`, protect: `${s.nm}：周りの味方を一瞬無敵にする`, guard: `${s.nm}：押している間ダメージを減らす${s.reflect ? '・一部を跳ね返す' : ''}`, taunt: `${s.nm}：敵を引きつける一撃（威力${s.pw}）`, mine: `${s.nm}：足元に地雷（威力${s.pw}・味方も巻き込む）`, heal: `${s.nm}：ためるほど回復量アップ（基礎${s.pw}）`, healRing: `${s.nm}：ためるほど範囲が広がる回復（基礎${s.pw}）` };
  return m[s.kind] || s.nm;
}
function sendMine() {
  const S = G.session; if (!G.coop || !S) return;
  const o = { nick: G.nick || 'もののけ', ch: G.party[0], swap: !!G.swap[0], items: G.items.slice(0, 2) };
  if (S.kind === 'host') S.setMine(o); else S.hello(o);
}
/** 体格比の確認：同じ奥行き・直立で並べ、正投影で描く（新作の設計値 1：5 の確認用） */
function scaleImage() {
  if (G.scaleImg) return G.scaleImg;
  try {
    const W = 520, H = 300, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(W, H, false);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x554466, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(2, 3, 4); sc.add(dl);
    const k = GFX.makeChar(DATA.CHI.kogemaru); k.root.position.set(-3.2, 0, 0); k.root.rotation.y = 0.3; sc.add(k.root);
    GFX.animChar(k, { x: -3.2, z: 0, yaw: 0.3, st: 'ok', act: '', actT: 0, slot: 0 }, 0, 0, {});
    const b = GFX.makeBoss(); b.root.position.set(1.2, 0, 0); b.root.rotation.y = -0.35; sc.add(b.root);
    GFX.animBoss(b, { x: 1.2, z: 0, y: 0, yaw: -0.35, st: 'idle', t: 0, phase: 1 }, 0, 0, { stageT: 9 });
    const cam = new THREE.OrthographicCamera(-5.2, 5.2, 5.6, -0.4, 0.1, 50); cam.position.set(0, 0, 20); cam.lookAt(0, 0, 0);
    r.render(sc, cam);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#2b2760'; g.fillRect(0, 0, W, H); g.drawImage(r.domElement, 0, 0);
    const y = u => H - (u + 0.4) / 6.0 * H; g.strokeStyle = 'rgba(255,230,140,.85)'; g.setLineDash([6, 5]); g.lineWidth = 2;
    for (const u of [0, 1, 5]) { g.beginPath(); g.moveTo(0, y(u)); g.lineTo(W, y(u)); g.stroke(); }
    g.setLineDash([]); g.fillStyle = '#fff6e6'; g.font = '900 14px ' + GFX.FONT_UI; g.fillText('基準味方 1.0', 8, y(1) - 6); g.fillText('トバトーバン 5.0（新作の設計値）', 8, y(5) - 6); g.fillText('地面', 8, y(0) - 6);
    r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
    G.scaleImg = c.toDataURL('image/png');
  } catch (e) { console.warn(e); }
  return G.scaleImg;
}
function renderData() {
  const box = $('#dataTable'); box.textContent = '';
  const fig = el('figure'); fig.style.margin = '0 0 10px'; const im = el('img'); im.src = scaleImage() || ''; im.alt = '基準味方とトバトーバンを同じ奥行きに並べた体格比の確認図'; im.style.cssText = 'width:100%;max-width:520px;border-radius:10px;display:block'; const cap = el('figcaption', 'small', '体格比の確認：同じ奥行き・直立・正投影。原作モデルの実測ではなく、この作品の設計値（基準味方1：ボス5）です。'); fig.append(im, cap); box.appendChild(fig);
  $('#dataProfile').textContent = ''; const pr = el('span', 'chip on', 'プロファイル：' + DATA.PROFILE); $('#dataProfile').appendChild(pr); $('#dataProfile').appendChild(el('span', 'chip', 'reference_verified：未達（測定項目が残っています）'));
  const t = el('table', 'dtable'); const th = el('tr'); for (const h of ['項目', '値', '単位', '状態', '出典・注記']) th.appendChild(el('th', '', h)); t.appendChild(th);
  let grp = '';
  const order = []; for (const r of DATA.REG) if (!order.includes(r.group)) order.push(r.group);
  const rows = order.flatMap(g0 => DATA.REG.filter(r => r.group === g0));
  for (const r of rows) {
    if (r.group !== grp) { grp = r.group; const tr = el('tr'); const td = el('td', 'grp', grp); td.colSpan = 5; tr.appendChild(td); t.appendChild(tr); }
    const tr = el('tr'); tr.appendChild(el('td', '', r.label)); tr.appendChild(el('td', '', r.hidden ? '（非表示の調整値）' : String(Math.round(r.v * 1000) / 1000 || r.v))); tr.appendChild(el('td', '', r.unit));
    const s = el('td'); s.appendChild(el('span', 'badge b-' + r.status, DATA.STATUS_LABEL[r.status])); tr.appendChild(s);
    const n = el('td'); if (r.src) { const a = el('a', '', `[${r.src}]`); a.href = DATA.REFS[r.src]; a.target = '_blank'; a.rel = 'noopener'; n.appendChild(a); n.appendChild(document.createTextNode(' ')); } if (r.notes) n.appendChild(document.createTextNode(r.notes)); tr.appendChild(n);
    t.appendChild(tr);
  }
  box.appendChild(t);
}

/* ---------- 協力プレイの開始 ---------- */
async function openTransport(code) {
  if (/[?&]net=bc/.test(location.search)) return NETLIB.BCTransport.open(code);
  if (G.netMode === 'room') return NETLIB.RoomTransport.open(G.roomCap, code);
  return NETLIB.P2PTransport.open(code);
}
async function startHost() {
  AUDIO.init(); AUDIO.sfx('ok');
  G.nick = ($('#nick').value.trim() || 'もののけ').slice(0, 10); STORE.set('nick', G.nick);
  const code = String(1000 + Math.floor(Math.random() * 9000));
  const b = $('#btnHost'); b.disabled = true; b.textContent = '部屋を準備しています…';
  try {
    const tr = await openTransport(code);
    G.session = new NETLIB.HostSession({ transport: tr, code, nick: G.nick, ch: G.party[0], swap: !!G.swap[0], items: G.items.slice(0, 2), aiParty: G.party.slice(1) });
    G.session.lobby.diff = G.diff; G.coop = true; openLobby();
  } catch (e) { console.error(e); toast('部屋を作れませんでした。電波のよい所でもう一度。'); }
  b.disabled = false; b.textContent = '部屋を作る';
}
async function startJoin() {
  AUDIO.init(); AUDIO.sfx('ok');
  const code = $('#code').value.trim(); if (!/^\d{4,8}$/.test(code)) { toast('4けたの合言葉を入れてください'); return; }
  G.nick = ($('#nick').value.trim() || 'もののけ').slice(0, 10); STORE.set('nick', G.nick);
  const b = $('#btnJoin'); b.disabled = true; b.textContent = 'つないでいます…';
  try {
    const tr = await openTransport(code);
    G.session = new NETLIB.ClientSession({ transport: tr, code }); G.coop = true; sendMine(); G.joinT = performance.now(); openLobby();
  } catch (e) { console.error(e); toast('つなげませんでした。もう一度ためしてください。'); }
  b.disabled = false; b.textContent = '部屋に入る';
}
function toast(s) { const n = $('#netMsg'); n.textContent = s; }

/* ---------- ゲーム開始 ---------- */
function startSolo() {
  AUDIO.init();
  const S = new NETLIB.HostSession({ nick: 'P1', ch: G.party[0], swap: G.swap[0], items: G.items });
  S.lobby.diff = G.diff;
  S.startGame({ party: G.party.map((ch, i) => ({ ch, swap: !!G.swap[i], items: i === 0 ? G.items.slice(0, 2) : ['onigiri', 'ramune'], nick: i === 0 ? 'あなた' : 'AI' })) });
  G.session = S; G.coop = false; enterGame();
}
function enterGame() {
  G.mode = 'play'; G.lock = null; G.resultShown = false; G.lagBoss = 1; G.lagMe = 1; G.spTotals = {}; G.lastStage = ''; G.hint = 0;
  R.clearEntities(); R.cam.lock = null; R.cam.yaw = 0; R.cam.introDone = false;
  show(null); $('#hud').hidden = false; layoutHud(); buildPartyCards();
  AUDIO.bgm('street');
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
  G.snapNext = true;
  if (!G.coop) { // 最初に：仲間アイコンをタップで操作キャラを切り替えられる
    setTimeout(() => { if (G.mode !== 'play') return; notice((curLayout && curLayout.portrait ? '上' : '左上') + 'の仲間アイコンをタップすると、そのキャラに切り替えられます', 'tip', 5200); const p = $('#party'); p.classList.add('tip'); setTimeout(() => p.classList.remove('tip'), 5200); }, 700);
  }
  if (G.firstRun && !G.coop) { setTimeout(() => notice('スティックで移動・Aで攻撃。札小僧をやっつけよう', 'info', 4000), 6200); setTimeout(() => notice('Xは技1、Yは技2。ためる技は長押しして離す', 'info', 4000), 10400); STORE.set('played', true); G.firstRun = false; }
}
function pause() {
  if (G.mode !== 'play') return; const S = G.session;
  $('#pauseNote').textContent = S && S.kind !== 'solo' ? '協力プレイ中はゲームは止まりません（メニュー中も戦闘は進みます）。' : 'ゲームは止まっています。';
  $('#btnSkip').hidden = !(S && S.kind === 'solo' && S.sim && S.sim.stage === 'intro');
  if (S && S.kind === 'solo') S.paused = true; G.mode = 'pause'; G.back = 'pause'; show('pause');
}
function resume() { const S = G.session; if (S && S.kind === 'solo') S.paused = false; G.mode = 'play'; show(null); $('#hud').hidden = false; layoutHud(); }
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && G.session && G.session.kind === 'solo') pause(); });

/* ---------- HUD配置（論理単位844×390／390×844を基準に端へ固定） ---------- */
const LAYOUT = {
  land: { W: 844, H: 390,
    stick: { c: [92, 294], d: 120, ax: 'L', ay: 'B' }, bA: { c: [748, 294], d: 76, ax: 'R', ay: 'B' }, bX: { c: [663, 244], d: 64, ax: 'R', ay: 'B' }, bY: { c: [746, 207], d: 64, ax: 'R', ay: 'B' },
    bSP: { c: [657, 324], d: 64, ax: 'R', ay: 'B' }, bB: { c: [184, 316], d: 52, ax: 'L', ay: 'B' }, bLock: { c: [786, 140], d: 48, ax: 'R', ay: 'T' }, bCam: { c: [728, 140], d: 48, ax: 'R', ay: 'T' },
    bI0: { c: [282, 266], d: 48, ax: 'L', ay: 'B' }, bI1: { c: [338, 266], d: 48, ax: 'L', ay: 'B' }, bSig: { c: [232, 206], d: 48, ax: 'L', ay: 'B' }, bMenu: { c: [656, 40], d: 48, ax: 'R', ay: 'T' },
    party: { r: [16, 16, 160, 204], ax: 'L', ay: 'T' }, bossbox: { r: [230, 10, 380, 40], ax: 'L', ay: 'T' }, mebox: { r: [260, 312, 260, 34], ax: 'L', ay: 'B' }, map: { r: [690, 16, 112, 92], ax: 'R', ay: 'T' }, timer: { r: [230, 54, 200, 24], ax: 'L', ay: 'T' },
    area: [0, 1] },
  port: { W: 390, H: 844,
    bossbox: { r: [16, 10, 358, 40], ax: 'L', ay: 'T' }, party: { r: [16, 56, 358, 48], ax: 'L', ay: 'T', row: true }, map: { r: [278, 116, 96, 96], ax: 'R', ay: 'T' },
    bLock: { c: [246, 140], d: 48, ax: 'R', ay: 'T' }, bCam: { c: [190, 140], d: 48, ax: 'R', ay: 'T' }, bMenu: { c: [40, 140], d: 48, ax: 'L', ay: 'T' }, timer: { r: [72, 128, 120, 24], ax: 'L', ay: 'T' },
    stick: { c: [82, 742], d: 120, ax: 'L', ay: 'B' }, bA: { c: [314, 746], d: 76, ax: 'R', ay: 'B' }, bX: { c: [228, 690], d: 64, ax: 'R', ay: 'B' }, bY: { c: [314, 654], d: 64, ax: 'R', ay: 'B' },
    bSP: { c: [230, 786], d: 64, ax: 'R', ay: 'B' }, bB: { c: [168, 742], d: 48, ax: 'L', ay: 'B' }, bI0: { c: [172, 610], d: 48, ax: 'L', ay: 'B' }, bI1: { c: [228, 610], d: 48, ax: 'L', ay: 'B' },
    bSig: { c: [44, 610], d: 48, ax: 'L', ay: 'B' }, mebox: { r: [16, 524, 220, 34], ax: 'L', ay: 'B' },
    area: [108, 604] },
};
let safe = { l: 0, r: 0, t: 0, b: 0 };
function readSafe() { const p = el('div'); p.style.cssText = 'position:fixed;inset:0;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(p); const cs = getComputedStyle(p); safe = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 }; p.remove();
  if (VIEW.rot === 90) safe = { l: safe.t, r: safe.b, t: safe.r, b: safe.l };
  else if (VIEW.rot === -90) safe = { l: safe.b, r: safe.t, t: safe.l, b: safe.r }; }
let curLayout = null;
function layoutHud() {
  readSafe();
  const w = VIEW.w, h = VIEW.h, portrait = h > w, L = portrait ? LAYOUT.port : LAYOUT.land;
  const fit = Math.max(0.82, Math.min(1.25, portrait ? w / L.W : Math.min(w / L.W, h / L.H) * 1.0));
  const s = fit * Math.max(0.8, Math.min(1.3, SET.ui / 100));
  const posS = Math.min(s, portrait ? w / L.W : Math.min(w / L.W * 1.05, h / L.H * 1.05)); // 位置は画面に収まる倍率
  curLayout = { portrait, s, posS, L };
  for (const id in L) {
    if (id === 'W' || id === 'H' || id === 'area') continue;
    const e = document.getElementById(id); if (!e) continue;
    const o = L[id]; let ax = o.ax;
    const mirror = SET.mirror && !['bossbox', 'timer', 'party', 'map', 'bMenu'].includes(id);
    if (o.c) {
      let cx = o.c[0], cy = o.c[1]; if (mirror) { cx = L.W - cx; ax = ax === 'L' ? 'R' : 'L'; }
      const d = Math.max(48, o.d * s);
      const x = ax === 'L' ? safe.l + cx * posS : w - safe.r - (L.W - cx) * posS;
      const y = o.ay === 'T' ? safe.t + cy * posS : h - safe.b - (L.H - cy) * posS;
      Object.assign(e.style, { left: (x - d / 2) + 'px', top: (y - d / 2) + 'px', width: d + 'px', height: d + 'px', right: '', bottom: '' });
      if (id === 'stick') { const k = $('#knob'); k.style.width = k.style.height = Math.max(36, 52 * s) + 'px'; G.stickR = d / 2; }
    } else {
      let [rx, ry, rw, rh] = o.r; if (mirror) { rx = L.W - rx - rw; ax = ax === 'L' ? 'R' : 'L'; }
      const ww = rw * Math.min(posS, s), hh = rh * Math.min(posS, s);
      const x = ax === 'L' ? safe.l + rx * posS : w - safe.r - (L.W - rx - rw) * posS - ww;
      const y = o.ay === 'T' ? safe.t + ry * posS : h - safe.b - (L.H - ry) * posS;
      Object.assign(e.style, { left: x + 'px', top: y + 'px', width: (id === 'timer' ? 'auto' : ww + 'px'), height: (id === 'party' || id === 'timer' || id === 'mebox' || id === 'bossbox' ? 'auto' : hh + 'px'), right: '', bottom: '' });
    }
  }
  $('#party').classList.toggle('row', portrait);
  const n = $('#notice'); const bbx = $('#bossbox'); n.style.top = (portrait ? (G.rotateDismissed ? 176 : 228) * posS + safe.t : bbx.offsetTop + Math.max(40, bbx.offsetHeight) + 34) + 'px';
  sizeMapCanvas();
  $('#rotateHint').hidden = !(portrait && G.mode === 'play' && !G.rotateDismissed);
  $('#rotateHint').style.top = (safe.t + 176 * posS) + 'px';
  buildPartyCards();
}
addEventListener('resize', () => setTimeout(onViewChange, 60));
addEventListener('orientationchange', () => setTimeout(onViewChange, 250));
if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(onViewChange, 60));
function sizeMapCanvas() { const mc = $('#mapc'), mb = $('#map'); mc.width = Math.round(mb.offsetWidth * 2); mc.height = Math.round(mb.offsetHeight * 2); }
function gameArea() { if (!curLayout) return null; const L = curLayout.L; if (!curLayout.portrait) return { top: safe.t + 30, bottom: VIEW.h - safe.b }; return { top: safe.t + L.area[0] * curLayout.posS, bottom: VIEW.h - safe.b - (L.H - L.area[1]) * curLayout.posS }; }

/* ---------- 入力（マルチタッチは指ごとに管理） ---------- */
const INP = { stick: null, sx: 0, sy: 0, cam: null, buttons: new Map(), keys: new Set(), stickC: null };
function local() { return G.session ? G.session.local : null; }
function press(code, held) {
  const L = local(); if (!L || G.mode !== 'play') return; L.push(code); vib(8);
  if (held) L.hold[held] = 1;
}
function release(code, held) { const L = local(); if (!L) return; L.push(code); if (held) L.hold[held] = 0; }
function bindHud() {
  const touch = $('#touch'), stick = $('#stick');
  const startStick = (e, cx, cy) => { INP.stick = e.pointerId; INP.stickC = [cx, cy]; moveStick(e); };
  const moveStick = e => { const [cx, cy] = INP.stickC; const [px, py] = toApp(e); let dx = px - cx, dy = py - cy; const R0 = (G.stickR || 60) * 0.85, l = Math.hypot(dx, dy); if (l > R0) { dx *= R0 / l; dy *= R0 / l; } INP.sx = dx / R0; INP.sy = -dy / R0; const k = $('#knob'); k.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  const endStick = () => { INP.stick = null; INP.sx = INP.sy = 0; $('#knob').style.transform = 'translate(-50%,-50%)'; if (SET.stick === 'follow') layoutHud(); };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); stick.setPointerCapture(e.pointerId); startStick(e, stick.offsetLeft + stick.offsetWidth / 2, stick.offsetTop + stick.offsetHeight / 2); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === INP.stick) moveStick(e); });
  for (const t of ['pointerup', 'pointercancel']) stick.addEventListener(t, e => { if (e.pointerId === INP.stick) endStick(); });
  // 何もない所：左側（追従スティック時）／右側はカメラ回転
  touch.addEventListener('pointerdown', e => {
    e.preventDefault(); touch.setPointerCapture(e.pointerId);
    const [ax, ay] = toApp(e);
    const leftSide = SET.mirror ? ax > VIEW.w * 0.55 : ax < VIEW.w * 0.45;
    if (SET.stick === 'follow' && leftSide && INP.stick == null && (curLayout && (curLayout.portrait ? ay > VIEW.h * 0.55 : true))) {
      const d = parseFloat(stick.style.width); stick.style.left = (ax - d / 2) + 'px'; stick.style.top = (ay - d / 2) + 'px'; startStick(e, ax, ay); INP.touchStick = true; return;
    }
    if (INP.cam == null) { INP.cam = { id: e.pointerId, x: ax, y: ay }; }
  });
  touch.addEventListener('pointermove', e => {
    if (e.pointerId === INP.stick) return moveStick(e);
    if (INP.cam && e.pointerId === INP.cam.id) { const [ax, ay] = toApp(e); const dx = ax - INP.cam.x, dy = ay - INP.cam.y; INP.cam.x = ax; INP.cam.y = ay; R.cam.yaw -= dx * 0.009; R.cam.dragT = 1.2; const C = DATA.CAM; R.cam.userPitch = Math.max(-10, Math.min(10, (R.cam.userPitch || 0) + dy * 0.12)); }
  });
  for (const t of ['pointerup', 'pointercancel']) touch.addEventListener(t, e => { if (e.pointerId === INP.stick) endStick(); if (INP.cam && e.pointerId === INP.cam.id) INP.cam = null; });
  // ボタン
  const btn = (id, down, up) => { const b = document.getElementById(id); b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); b.classList.add('press'); INP.buttons.set(e.pointerId, id); down && down(); }); const fin = e => { if (INP.buttons.get(e.pointerId) !== id) return; INP.buttons.delete(e.pointerId); b.classList.remove('press'); up && up(); }; b.addEventListener('pointerup', fin); b.addEventListener('pointercancel', fin); b.addEventListener('contextmenu', e => e.preventDefault()); };
  btn('bA', () => press('A'));
  btn('bX', () => press('X+', 'X'), () => release('X-', 'X'));
  btn('bY', () => press('Y+', 'Y'), () => release('Y-', 'Y'));
  btn('bSP', () => press('SP'));
  btn('bB', () => press('B+', 'B'), () => release('B-', 'B'));
  btn('bLock', () => toggleLock());
  btn('bCam', () => { R.cam.reset = true; AUDIO.sfx('ui'); });
  btn('bMenu', () => pause());
  btn('bI0', () => press('I0')); btn('bI1', () => press('I1'));
  btn('bSig', () => { const m = $('#sigmenu'); m.hidden = !m.hidden; const b = $('#bSig'); m.style.left = Math.min(VIEW.w - 220, Math.max(8, b.offsetLeft)) + 'px'; m.style.top = Math.max(8, b.offsetTop - 120) + 'px'; });
  document.querySelectorAll('#sigmenu button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press('sig', undefined); const L = local(); if (L) { L.ev[L.ev.length - 1] = [L.evId, 'sig', b.dataset.sig]; } $('#sigmenu').hidden = true; AUDIO.sfx('ok'); }));
  $('#map').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); $('#map').classList.toggle('big'); sizeMapCanvas(); });
  // キーボード（パソコンでの確認用）
  const KM = { KeyJ: ['A'], KeyK: ['X+', 'X', 'X-'], KeyL: ['Y+', 'Y', 'Y-'], KeyU: ['SP'], Space: ['B+', 'B', 'B-'], Digit1: ['I0'], Digit2: ['I1'] };
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'Escape') { if (G.mode === 'play') pause(); else if (G.mode === 'pause') resume(); return; }
    if (G.mode !== 'play') return;
    if (INP.keys.has(e.code)) return; INP.keys.add(e.code);
    const k = KM[e.code]; if (k) { press(k[0], k[1]); e.preventDefault(); }
    if (e.code === 'KeyF') toggleLock(); if (e.code === 'KeyR') R.cam.reset = true;
  });
  addEventListener('keyup', e => { INP.keys.delete(e.code); const k = KM[e.code]; if (k && k[2]) release(k[2], k[1]); });
}
function keyStick() { let x = 0, y = 0; const K = INP.keys; if (K.has('KeyW') || K.has('ArrowUp')) y += 1; if (K.has('KeyS') || K.has('ArrowDown')) y -= 1; if (K.has('KeyD') || K.has('ArrowRight')) x += 1; if (K.has('KeyA') || K.has('ArrowLeft')) x -= 1; if (K.has('KeyQ')) { R.cam.yaw += 0.03; R.cam.dragT = 1; } if (K.has('KeyE')) { R.cam.yaw -= 0.03; R.cam.dragT = 1; } const l = Math.hypot(x, y); return l > 0 ? [x / l, y / l] : null; }
function toggleLock() {
  const v = G.v; if (!v) return;
  if (G.lock) { G.lock = null; AUDIO.sfx('back'); return; }
  const me = v.allies[G.my]; if (!me) return;
  if (v.boss && v.stage === 'boss' && ['idle', 'walk', 'wind', 'act', 'rec', 'down', 'stun'].includes(v.boss.st)) G.lock = 'boss';
  else { let best = null, bd = 22; for (const m of v.mobs) if (!m.dying) { const d = Math.hypot(m.x - me.x, m.z - me.z); if (d < bd) { bd = d; best = m; } } if (best) G.lock = best.id; }
  if (G.lock) AUDIO.sfx('ok');
}
function applyInput() {
  const L = local(); if (!L) return;
  let sx = INP.sx, sy = INP.sy; const ks = keyStick(); if (ks) { sx = ks[0]; sy = ks[1]; }
  const yaw = R.cam.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
  L.mx = -sx * c + sy * s; L.mz = sx * s + sy * c;
  L.lock = G.lock; R.cam.lock = G.lock;
}

/* ---------- 仲間カード ---------- */
function buildPartyCards() {
  const box = $('#party'); if (!box) return; box.textContent = ''; G.cards = [];
  const v = G.v; const n = 4;
  for (let i = 0; i < n; i++) {
    const c = el('div', 'pcard'); const f = el('div', 'face'); const im = el('img'); im.alt = ''; f.appendChild(im); c.appendChild(f);
    const pn = el('span', 'pn', 'P' + (i + 1)); pn.style.background = pcol(i); c.appendChild(pn);
    const info = el('div', 'info'); const nm = el('div', 'nm'); const nmT = el('span', '', ''); const ic = el('span', 'ic', ''); nm.append(nmT, ic); info.appendChild(nm);
    const hp = el('div', 'mini hp'); const hpi = el('i'); hp.appendChild(hpi); info.appendChild(hp);
    const sp = el('div', 'mini sp'); const spi = el('i'); sp.appendChild(spi); info.appendChild(sp); c.appendChild(info);
    const st = el('span', 'state', ''); st.hidden = true; c.appendChild(st);
    const ht = el('span', 'healtag', '回復対象'); ht.hidden = true; c.appendChild(ht);
    c.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); partyTap(i); });
    box.appendChild(c); G.cards.push({ c, im, nmT, ic, hp, hpi, sp, spi, st, ht, ch: null });
  }
}
function partyTap(i) {
  const v = G.v, S = G.session; if (!v || !S) return;
  const me = v.allies[G.my];
  if (me && me.act === 'charge' && DATA.SKILLS[me.sk[me.actSlot]] && DATA.SKILLS[me.sk[me.actSlot]].kind === 'heal') { S.local.healT = i; AUDIO.sfx('ui'); return; }
  if (S.kind === 'solo' && i !== G.my) { if (S.swapTo(i)) { G.my = i; AUDIO.sfx('ok'); notice(`${DATA.CHI[v.allies[i].ch].nm}に交代した`, 'info', 1500); R.cam.reset = true; } else notice('その仲間には交代できません', 'info', 1200); }
}

/* ---------- 通知 ---------- */
function notice(txt, kind, ms) {
  const n = $('#notice'); const d = el('div', 'nt ' + (kind || ''), txt); n.appendChild(d); while (n.children.length > 4) n.firstChild.remove();
  setTimeout(() => d.remove(), ms || 1600);
}
function banner(t, small, ms) { const b = $('#banner'); b.textContent = t; if (small) { const s = el('small', '', small); b.appendChild(s); } b.classList.add('show'); clearTimeout(G.bannerT); G.bannerT = setTimeout(() => b.classList.remove('show'), ms || 1800); }
function onNotice(o) {
  const v = G.v;
  if (o.k === 'sp') {
    if (o.me) { const c = $('#cutin'); $('#cutImg').src = G.thumbs[v.allies[o.slot].ch] || ''; $('#cutWho').textContent = 'P' + (o.slot + 1) + '　必殺技'; $('#cutNm').textContent = o.nm; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
    else notice(`P${o.slot + 1}：${o.nm}！`, 'sp', 1300);
  } else if (o.k === 'boss') { const M = DATA.BMOVES[o.mv]; if (M) notice(M.nm, 'boss', 1100); }
  else if (o.k === 'phase2') { banner('トバトーバンが本気を出した', '空を飛ぶ巡行が3回に増える。ミニマップと矢印を見よう', 2400); AUDIO.bgm('boss2'); }
  else if (o.k === 'unlock') { if (G.lock === 'boss') { G.lock = null; G.relockWanted = SET.relock; } notice('ボスが飛んだ！ 注目が外れた', 'warn', 1500); }
  else if (o.k === 'sig') { const t = { help: '助けて！', heal: '回復する！', lantern: '灯籠へ！', sp: '必殺準備OK！', left: '通信が切れたためAIが引き継ぎます' }[o.code] || ''; notice(`P${o.slot + 1}：${t}`, o.code === 'left' ? 'warn' : '', 2000); }
  else if (o.k === 'stage') {
    if (o.s === 'wave2') notice('札小僧がまた出た！', 'info', 1500);
    if (o.s === 'open') { banner('結界が解けた', '奥の祭り広場へ進もう', 2200); AUDIO.sfx('lantern'); }
    if (o.s === 'intro') { AUDIO.bgmStop(); G.lock = null; setTimeout(() => $('#bossCard').classList.add('show'), 3300); setTimeout(() => $('#bossCard').classList.remove('show'), 5400); }
    if (o.s === 'fight') { AUDIO.bgm('boss'); banner('鎮めよ！', '赤い縞は攻撃の予兆。灯籠4基で動きを止められる', 2000); }
    if (o.s === 'won') { AUDIO.jingle(true); banner('鎮まった！', 'トバトーバンは静かな看板に戻った', 3000); }
    if (o.s === 'lost') { AUDIO.jingle(false); banner(G.v && G.v.result && G.v.result.why === 'time' ? '時間切れ' : '全滅', '', 2500); }
  }
}
function onEvent(e, v) {
  const me = G.my;
  switch (e.type) {
    case 'dmg': dmgNum(e.x, (e.y || 1) + 0.3, e.z, e.v, e.kind === 'sp' ? 'sp' : e.crit ? 'crit' : e.el > 0 ? 'weak' : e.el < 0 ? 'resist' : '', e); break;
    case 'hurt': dmgNum(e.x, 1.2, e.z, e.v, 'hurt'); if (e.slot === me) vib(25); break;
    case 'heal': if (e.v > 0) dmgNum(e.x, 1.2, e.z, '+' + e.v, 'heal'); break;
    case 'down': notice(`P${e.slot + 1}が気絶した${e.slot === me ? '…' : '（近くでBを押し続けて救助）'}`, 'warn', 2200); if (e.slot === me && G.session.kind === 'solo') setTimeout(() => notice('仲間のカードを押すと操作を交代できます', 'info', 2600), 900); break;
    case 'ascend': notice(`P${e.slot + 1}が昇天した（この戦闘では戻らない）`, 'warn', 2400); break;
    case 'revive': notice(`P${e.slot + 1}が復活した`, '', 1400); break;
    case 'lantern': { const n = v.lan.lit.filter(Boolean).length; notice(`灯籠 ${n}/4${n < 4 ? `（残り${Math.ceil(v.lan.T)}秒）` : ''}`, '', 1600); break; }
    case 'allLit': banner('灯籠がそろった', 'トバトーバンの動きが止まる！', 1800); break;
    case 'lanternFail': notice('灯籠の火が消えた（30秒以内に4基）', 'warn', 1800); break;
    case 'bossdown': banner('今だ！', '必殺技を重ねよう', 1400); break;
    case 'parry': if (e.slot === me) notice('受け流し成功！', 'sp', 1000); break;
    case 'item': if (e.slot === me) notice(DATA.ITEMS[e.it].nm + 'を使った', '', 1000); break;
    case 'pick': if (e.slot === me) notice(DATA.ITEMS[e.it].nm + 'を拾った', '', 1000); break;
  }
}
/* ---------- ダメージ数字 ---------- */
const DMG = [];
function dmgNum(x, y, z, v, cls, e) {
  const box = $('#dmgs'); let d = DMG.find(o => !o.alive); if (!d) { if (DMG.length > 40) return; d = { e: el('div', 'dmg') }; box.appendChild(d.e); DMG.push(d); }
  d.alive = true; d.t = 0; d.x = x + (Math.random() - 0.5) * 0.6; d.y = y; d.z = z + (Math.random() - 0.5) * 0.6; d.e.className = 'dmg ' + cls; d.e.textContent = v; d.life = cls === 'sp' ? 0.6 : 0.9;
  if (cls === 'sp' && e) { // 多段の合計
    const k = e.src; const T = G.spTotals[k] || (G.spTotals[k] = { sum: 0, t: 0, d: null });
    T.sum += e.v; T.t = 1.3; T.x = e.x; T.z = e.z;
    if (!T.d) { T.d = el('div', 'dmg total'); box.appendChild(T.d); }
    T.d.innerHTML = ''; T.d.appendChild(el('small', '', `P${k + 1} 合計`)); T.d.appendChild(document.createTextNode(T.sum));
  }
}
function stepDmg(dt) {
  for (const d of DMG) { if (!d.alive) continue; d.t += dt; if (d.t > d.life) { d.alive = false; d.e.style.display = 'none'; continue; } const p = R.project(d.x, d.y + d.t * 1.2, d.z); d.e.style.display = p.front ? '' : 'none'; d.e.style.left = p.x + 'px'; d.e.style.top = p.y + 'px'; d.e.style.opacity = Math.min(1, (d.life - d.t) * 4); }
  for (const k in G.spTotals) { const T = G.spTotals[k]; T.t -= dt; if (T.t <= 0) { if (T.d) T.d.remove(); delete G.spTotals[k]; continue; } const p = R.project(T.x, 4.2, T.z); T.d.style.left = p.x + 'px'; T.d.style.top = Math.max(60, p.y) + 'px'; T.d.style.opacity = Math.min(1, T.t * 3); }
}

/* ---------- HUD更新 ---------- */
const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function setBar(i, r) { i.style.width = Math.max(0, Math.min(1, r)) * 100 + '%'; }
function updateHud(v, dt) {
  const me = v.allies[G.my]; if (!me) return;
  // ボス
  const showBoss = v.boss && (v.stage === 'boss' || v.stage === 'won' || v.stage === 'lost');
  $('#bossbox').hidden = !showBoss;
  if (showBoss) {
    const b = v.boss; setBar($('#bossFill'), b.hpR); G.lagBoss = G.lagBoss > b.hpR ? Math.max(b.hpR, G.lagBoss - dt * 0.15) : b.hpR; setBar($('#bossLag'), G.lagBoss);
    $('#bossDf').textContent = DATA.DIFF[v.diff].nm; $('#bossPh').hidden = b.phase !== 2;
    $('#bossSt').textContent = b.st === 'down' ? 'ダウン中' : b.stun ? '麻痺' : b.st === 'fly' ? '飛行中' : b.defDown ? '守り↓' : '';
  }
  // 自分
  const lowHp = me.hpR < 0.3 && me.st === 'ok';
  $('#mebox').classList.toggle('low', lowHp); $('#meWarn').hidden = !lowHp;
  $('#meNm').textContent = `P${G.my + 1} ${DATA.CHI[me.ch].nm}${me.st === 'down' ? '（気絶）' : me.st === 'gone' ? '（昇天）' : ''}`;
  setBar($('#meFill'), me.hpR); G.lagMe = G.lagMe > me.hpR ? Math.max(me.hpR, G.lagMe - dt * 0.6) : me.hpR; setBar($('#meLag'), G.lagMe);
  setBar($('#meSpFill'), me.sp / 100); $('#meSp').classList.toggle('full', me.sp >= 100); setBar($('#meStam'), me.stam / 100);
  // ボタン
  const c = DATA.CHI[me.ch];
  $('#lA').textContent = c.A === 'combo3' ? '三連' : c.A === 'shot' ? '射撃' : '攻撃';
  for (const k of ['X', 'Y']) {
    const sk = DATA.SKILLS[me.sk[k]], b = $('#b' + k); $('#l' + k).textContent = sk.short;
    const circ = $('#c' + k), t = $('#t' + k);
    let ratio = 0, txt = '';
    if (sk.kind === 'guard') { const g = k === 'X' ? me.gX : me.gY, lock = k === 'X' ? me.gLockX : me.gLockY; ratio = 1 - g; b.classList.toggle('off', lock || me.st !== 'ok'); if (lock) txt = Math.ceil((1 - g) * sk.refill) + 's'; }
    else { const cd = k === 'X' ? me.cdX : me.cdY, mx = k === 'X' ? me.cdMaxX : me.cdMaxY; ratio = mx > 0 ? cd / mx : 0; b.classList.toggle('off', cd > 0 || me.st !== 'ok'); if (cd > 0) txt = cd.toFixed(cd < 3 ? 1 : 0); }
    if (me.act === 'charge' && me.actSlot === k) { ratio = 1 - me.chg; circ.setAttribute('stroke', me.chg >= 1 ? '#ffe27a' : '#fff'); } else circ.setAttribute('stroke', 'rgba(255,255,255,.9)');
    circ.setAttribute('stroke-dashoffset', String(113 * (1 - ratio)));
    t.hidden = !txt; t.textContent = txt;
  }
  const spb = $('#bSP'); spb.classList.toggle('full', me.sp >= 100); $('#lSP').textContent = me.sp >= 100 ? '満タン' : me.sp + '%';
  if (me.sp >= 100 && !G.spReadyShown) { G.spReadyShown = true; AUDIO.sfx('ready'); } if (me.sp < 100) G.spReadyShown = false;
  $('#lB').textContent = me.ctx === 'revive' ? '救助' : me.ctx === 'lantern' ? '灯す' : '走る';
  $('#bLock').classList.toggle('on', !!G.lock);
  for (const i of [0, 1]) { const it = me.items[i], b = $('#bI' + i); b.textContent = DATA.ITEMS[it.id].icon; const n = el('span', 'n', '×' + it.n); b.appendChild(n); b.classList.toggle('empty', it.n <= 0); }
  // 時間・通信
  $('#timeTxt').textContent = fmt(v.timeLeft) + (G.session.kind === 'solo' && G.session.paused ? '（停止中）' : '');
  const nt = $('#netTxt'); if (G.session.kind === 'client') { nt.hidden = false; const p = G.session.ping(); nt.textContent = `通信 ${p}ms`; nt.style.color = p > 250 ? '#ff8a6a' : p > 120 ? '#ffd27a' : '#9fffc0'; } else if (G.session.kind === 'host') { nt.hidden = false; nt.textContent = `ホスト・${G.session.clients.size + 1}人`; nt.style.color = '#9fffc0'; } else nt.hidden = true;
  // 仲間カード
  v.allies.forEach((a, i) => {
    const C = G.cards[i]; if (!C) return;
    if (C.ch !== a.ch) { C.ch = a.ch; C.im.src = G.thumbs[a.ch] || ''; }
    C.c.classList.toggle('me', i === G.my); C.c.classList.toggle('down', a.st === 'down'); C.c.classList.toggle('gone', a.st === 'gone');
    C.nmT.textContent = DATA.CHI[a.ch].nm + (a.ai && G.session.kind !== 'solo' ? '·AI' : '');
    setBar(C.hpi, a.hpR); C.hp.classList.toggle('low', a.hpR < 0.3); setBar(C.spi, a.sp / 100); C.sp.classList.toggle('full', a.sp >= 100);
    C.ic.textContent = (a.strBuff ? '⚔' : '') + (a.defBuff ? '🛡' : '') + (a.stealth ? '👁' : '') + (a.taunt ? '❗' : '') + (a.sp >= 100 ? '★' : '');
    C.st.hidden = a.st === 'ok'; C.st.textContent = a.st === 'down' ? `気絶 ${Math.max(0, Math.ceil(DATA.SIM.ascendTime - a.downT))}` : '昇天';
    const healing = me.act === 'charge' && DATA.SKILLS[me.sk[me.actSlot]] && DATA.SKILLS[me.sk[me.actSlot]].kind === 'heal';
    C.ht.hidden = !(healing && G.session.local.healT === i); C.c.classList.toggle('tgt', healing && G.session.local.healT === i);
  });
  // 頭上の表示・注目・画面外の矢印
  overlays(v, me);
  // 開発用
  if (SET.dev) devOverlay(v);
}
const LBL = new Map(), EDG = new Map();
function overlays(v, me) {
  const box = $('#labels'), eb = $('#edges'); const seen = new Set(), seenE = new Set();
  const W = VIEW.w, H = VIEW.h, m = 26;
  const put = (key, x, y, z, build, upd) => { seen.add(key); let o = LBL.get(key); if (!o) { o = build(); box.appendChild(o.e); LBL.set(key, o); } const p = R.project(x, y, z); o.e.style.display = p.front && p.x > -40 && p.x < W + 40 && p.y > -40 && p.y < H + 40 ? '' : 'none'; o.e.style.left = p.x + 'px'; o.e.style.top = p.y + 'px'; upd(o); return p; };
  const edge = (key, x, y, z, col, txt) => {
    const p = R.project(x, y, z); const inside = p.front && p.x > 0 && p.x < W && p.y > 0 && p.y < H; if (inside) return;
    seenE.add(key); let o = EDG.get(key); if (!o) { o = { e: el('div', 'edge') }; o.tri = el('div', 'tri'); o.t = el('span', 't'); o.e.append(o.tri, o.t); eb.appendChild(o.e); EDG.set(key, o); }
    let nx = p.ndc.x, ny = p.ndc.y; if (!p.front) { nx = -nx; ny = -ny; } const ang = Math.atan2(-ny, nx); const cx = W / 2, cy = H / 2;
    const k = Math.min((W / 2 - m) / Math.max(0.001, Math.abs(Math.cos(ang))), (H / 2 - m) / Math.max(0.001, Math.abs(Math.sin(ang))));
    o.e.style.left = cx + Math.cos(ang) * k + 'px'; o.e.style.top = cy + Math.sin(ang) * k + 'px'; o.tri.style.background = col; o.tri.style.transform = `rotate(${ang}rad)`; o.t.textContent = txt; o.e.style.display = '';
  };
  v.allies.forEach((a, i) => {
    const h = DATA.CHI[a.ch].h;
    put('a' + i, a.x, a.st === 'ok' ? h * 1.25 + 0.2 : 0.8, a.z, () => { const e = el('div', 'label3d'); const pn = el('span', 'pn', 'P' + (i + 1)); pn.style.background = pcol(i); const hp = el('div', 'mini hp'); const hi = el('i'); hp.appendChild(hi); const dt = el('span', 'downt'); const pg = el('div', 'prog'); const pgi = el('i'); pg.appendChild(pgi); e.append(dt, pg, pn, hp); return { e, hi, hp, dt, pg, pgi }; },
      o => { setBar(o.hi, a.hpR); o.hp.style.display = i === G.my || a.st !== 'ok' ? 'none' : ''; o.dt.style.display = a.st === 'down' ? '' : 'none'; o.dt.textContent = a.st === 'down' ? '気絶 ' + Math.max(0, Math.ceil(DATA.SIM.ascendTime - a.downT)) : '';
        const reviver = v.allies.find(q => q.revT === i); o.pg.style.display = reviver || a.lanHold ? '' : 'none'; if (reviver) setBar(o.pgi, reviver.revP); else if (a.lanHold) setBar(o.pgi, a.lanP); o.e.style.opacity = a.st === 'gone' ? 0.4 : 1; });
    if (i !== G.my && a.st !== 'gone') edge('a' + i, a.x, 0.5, a.z, a.st === 'down' ? '#ff5a3a' : pcol(i), 'P' + (i + 1));
  });
  for (const mo of v.mobs) {
    if (mo.dying) continue; const d = Math.hypot(mo.x - me.x, mo.z - me.z); if (d > 16 && G.lock !== mo.id) continue;
    put('m' + mo.id, mo.x, 1.15, mo.z, () => { const e = el('div', 'label3d'); const hp = el('div', 'mini hp'); hp.style.width = '34px'; const hi = el('i'); hi.style.background = '#ff6a5a'; hp.appendChild(hi); e.appendChild(hp); return { e, hi }; }, o => setBar(o.hi, mo.hpR));
  }
  if (v.boss && (v.stage === 'boss') && v.boss.st !== 'dead') edge('boss', v.boss.x, v.boss.y + 2, v.boss.z, '#cb4b46', v.boss.st === 'fly' ? '飛行' : 'ボス');
  // 注目のレティクル
  let tgt = null; if (G.lock === 'boss' && v.boss) tgt = { x: v.boss.x, y: v.boss.y + 2.6, z: v.boss.z }; else if (G.lock) { const mo = v.mobs.find(q => q.id === G.lock); if (mo) tgt = { x: mo.x, y: 0.6, z: mo.z }; else G.lock = null; }
  if (G.lock === 'boss' && v.boss && !['idle', 'walk', 'wind', 'act', 'rec', 'down', 'stun'].includes(v.boss.st)) { G.lock = null; tgt = null; }
  if (!G.lock && G.relockWanted && v.boss && v.boss.st !== 'fly' && v.stage === 'boss') { G.lock = 'boss'; G.relockWanted = false; }
  if (tgt) put('ret', tgt.x, tgt.y, tgt.z, () => ({ e: el('div', 'reticle') }), () => { });
  for (const [k, o] of LBL) if (!seen.has(k)) { o.e.remove(); LBL.delete(k); }
  for (const [k, o] of EDG) if (!seenE.has(k)) { o.e.style.display = 'none'; }
}
function devOverlay(v) {
  const d = $('#dev'); const S = G.session;
  if (!S || !S.sim) { d.textContent = '計測表示はソロ／ホストの端末で記録します（参加者側は描画のみ）'; return; }
  const rows = S.sim.mlog.filter(l => l.slot === G.my).slice(-6).map(l => `${(l.id + '').padEnd(8)} ${l.nm.padEnd(6, '　')} 入力${l.tIn.toFixed(2)} 発生+${l.hits.length ? (l.hits[0] - l.tStart).toFixed(3) : '-'} 命中${l.hits.length}回[${l.hits.map(h => (h - l.tStart).toFixed(2)).join(',')}] 終了+${l.tEnd ? (l.tEnd - l.tStart).toFixed(3) : '…'} 再使用${l.cdReady ? (l.cdReady).toFixed(1) : '-'} 与ダメ[${l.dmg.join(',')}] ${l.buff || ''} 守り${l.def == null ? '-' : l.def}`);
  d.textContent = `prototype_playable / 60Hz固定 / tick ${S.sim.tick}\n` + rows.join('\n');
}

/* ---------- ミニマップ（ワールド座標から描く。+zが上、カメラの向きに合わせて+xは左） ---------- */
function drawMap(v) {
  const c = $('#mapc'); const g = c.getContext('2d'); const W = c.width, H = c.height; g.clearRect(0, 0, W, H);
  const big = $('#map').classList.contains('big');
  const me = v.allies[G.my];
  const inPlaza = v.stage !== 'street';
  const view = inPlaza ? { x0: -22, x1: 22, z0: -6, z1: 34 } : { x0: -12, x1: 12, z0: Math.min(-36, me.z - 18), z1: Math.min(6, me.z + 22) };
  if (big) Object.assign(view, { x0: -22, x1: 22, z0: -66, z1: 34 });
  const sc = Math.min(W / (view.x1 - view.x0), H / (view.z1 - view.z0));
  const ox = W / 2, oz = H / 2, cxw = (view.x0 + view.x1) / 2, czw = (view.z0 + view.z1) / 2;
  const P = (x, z) => [ox - (x - cxw) * sc, oz - (z - czw) * sc];
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#5b5d70'; let [a1, b1] = P(9.4, 0), [a2, b2] = P(-9.4, -66); g.fillRect(Math.min(a1, a2), Math.min(b1, b2), Math.abs(a2 - a1), Math.abs(b2 - b1));
  g.fillStyle = '#7b6f66'; [a1, b1] = P(20, 32); [a2, b2] = P(-20, 0); g.fillRect(Math.min(a1, a2), Math.min(b1, b2), Math.abs(a2 - a1), Math.abs(b2 - b1));
  g.fillStyle = 'rgba(0,0,0,.55)'; [a1, b1] = P(30, 46); [a2, b2] = P(-30, 34); g.fillRect(Math.min(a1, a2), Math.min(b1, b2), Math.abs(a2 - a1), Math.abs(b2 - b1));
  if (v.barrier !== 'none') { g.strokeStyle = v.barrier === 'plaza' ? '#d9c08a' : '#ff6a4a'; g.lineWidth = 3; [a1, b1] = P(9.4, 0); [a2, b2] = P(-9.4, 0); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
  if (v.stage === 'street' && v.barrier === 'none') { const [dx, dz] = P(0, 3); g.fillStyle = '#ffe27a'; g.fillRect(dx - 6, dz - 9, 12, 14); g.fillStyle = '#5b3a1a'; g.fillRect(dx - 3, dz - 4, 6, 9); }
  const fs = Math.max(10, Math.round(W / 9));
  g.font = `900 ${fs}px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  // 予兆
  for (const h of v.hz) { if (h.kind === 'circle') { const [x, z] = P(h.x, h.z); g.strokeStyle = 'rgba(255,110,60,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(x, z, Math.max(3, h.a * sc), 0, 7); g.stroke(); } if (h.kind === 'path') { const [x0, z0] = P(h.x, h.z), [x1, z1] = P(h.x + Math.sin(h.yaw) * h.a, h.z + Math.cos(h.yaw) * h.a); g.strokeStyle = 'rgba(255,90,200,.75)'; g.lineWidth = Math.max(4, h.b * sc); g.beginPath(); g.moveTo(x0, z0); g.lineTo(x1, z1); g.stroke(); } }
  // 灯籠
  DATA.STAGE.lanterns.forEach(([x, z], i) => { const [px, pz] = P(x, z); g.fillStyle = v.lan.lit[i] ? '#ffd070' : v.lan.cool > 0 ? '#666' : '#c9b48a'; g.fillRect(px - 7, pz - 7, 14, 14); g.fillStyle = '#1b1838'; g.fillText(v.lan.lit[i] ? '✓' : String(i + 1), px, pz + 1); });
  for (const p of v.pickups) { const [x, z] = P(p.x, p.z); g.fillStyle = p.kind === 'food' ? '#fff' : '#d07aa0'; g.beginPath(); g.arc(x, z, 3.5, 0, 7); g.fill(); }
  for (const m of v.mobs) { if (m.dying) continue; const [x, z] = P(m.x, m.z); g.fillStyle = '#ff5a4a'; g.beginPath(); g.moveTo(x, z - 6); g.lineTo(x + 5, z); g.lineTo(x, z + 6); g.lineTo(x - 5, z); g.closePath(); g.fill(); }
  if (v.boss && v.stage !== 'street') { const b = v.boss, [x, z] = P(b.x, b.z); g.fillStyle = b.st === 'fly' ? '#ff5ac8' : '#cb4b46'; g.beginPath(); g.arc(x, z, 10, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); const fx = -Math.sin(b.yaw) * 14, fz = -Math.cos(b.yaw) * 14; g.beginPath(); g.moveTo(x, z); g.lineTo(x + fx, z + fz); g.stroke(); g.fillStyle = '#fff'; g.fillText('ボ', x, z + 1); }
  v.allies.forEach((a, i) => {
    const [x, z] = P(a.x, a.z);
    if (a.st === 'gone') { g.fillStyle = 'rgba(200,200,220,.4)'; g.beginPath(); g.arc(x, z, 6, 0, 7); g.fill(); return; }
    if (i === G.my) { g.save(); g.translate(x, z); g.rotate(Math.PI - a.yaw + Math.PI); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8); g.closePath(); g.fill(); g.restore(); }
    else { g.fillStyle = pcol(i); g.beginPath(); g.arc(x, z, 8, 0, 7); g.fill(); }
    if (a.st === 'down') { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 6, z - 6); g.lineTo(x + 6, z + 6); g.moveTo(x + 6, z - 6); g.lineTo(x - 6, z + 6); g.stroke(); }
    g.fillStyle = i === G.my ? '#1b1838' : '#fff'; g.font = `900 ${Math.round(fs * 0.8)}px ${GFX.FONT_UI}`; g.fillText(String(i + 1), x, z + (i === G.my ? 2 : 1)); g.font = `900 ${fs}px ${GFX.FONT_UI}`;
  });
  // カメラの向き
  const [mx, mz] = P(me.x, me.z), cy = R.cam.yaw; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(mx, mz); g.lineTo(mx + Math.sin(cy - 0.45) * 28, mz - Math.cos(cy - 0.45) * 28); g.moveTo(mx, mz); g.lineTo(mx + Math.sin(cy + 0.45) * 28, mz - Math.cos(cy + 0.45) * 28); g.stroke();
}

/* ---------- 結果 ---------- */
function showResult(v) {
  if (G.resultShown) return; G.resultShown = true; G.mode = 'result';
  const S = G.session, win = v.result && v.result.win;
  $('#resEyebrow').textContent = win ? '勝利' : '敗北'; $('#resTitle').textContent = win ? 'トバトーバンを鎮めた！' : (v.result && v.result.why === 'time' ? '時間切れ…' : '全員が戦闘不能…');
  const kv = $('#resKv'); kv.textContent = '';
  for (const [k, val] of [['むずかしさ', DATA.DIFF[v.diff].nm], ['かかった時間', fmt(v.result ? v.result.time : 0)], ['モード', S.kind === 'solo' ? 'ソロ（AI3体）' : '協力プレイ']]) { kv.appendChild(el('b', '', k)); kv.appendChild(el('span', '', val)); }
  const grid = $('#resGrid'); grid.textContent = '';
  const stats = S.sim ? S.sim.allies.map(a => a.stats) : null;
  v.allies.forEach((a, i) => { const c = el('div', 'res-c'); const pn = el('span', 'pn', 'P' + (i + 1)); pn.style.background = pcol(i); const im = el('img'); im.src = G.thumbs[a.ch] || ''; im.alt = ''; c.append(pn, im, el('b', '', DATA.CHI[a.ch].nm)); if (stats) { c.appendChild(el('span', '', `与えたダメージ ${stats[i].dmg}`)); c.appendChild(el('span', '', `救助 ${stats[i].revives}・必殺 ${stats[i].specials}`)); } c.appendChild(el('span', 'small', a.st === 'ok' ? '元気' : a.st === 'down' ? '気絶' : '昇天')); grid.appendChild(c); });
  const rw = { normal: '看板のかけら', hard: '金の提灯芯', extreme: '千住の大札' }[v.diff];
  $('#resReward').textContent = win ? `獲得：${rw} ×${v.result.time < 240 ? 3 : v.result.time < 480 ? 2 : 1}（育成は今後の拡張で使う予定です）` : 'もう一度挑戦できます。灯籠で動きを止めて、必殺技を重ねるのがコツ。';
  const host = S.kind !== 'client';
  $('#btnRetry').hidden = !host; $('#btnReteam').hidden = !host && G.coop;
  $('#btnRetry').textContent = G.coop ? 'ロビーへ戻る' : 'もう一度';
  if (!host) $('#resReward').textContent += '　ホストがロビーへ戻ると次の戦いを始められます。';
  $('#hud').hidden = true; show('result');
}

/* ---------- メインループ ---------- */
let last = performance.now();
function frame(ts) {
  const dtRaw = Math.min(0.25, Math.max(0, (ts - last) / 1000)), dt = Math.min(0.1, dtRaw); last = ts; G.T += dt;
  const S = G.session;
  try {
    if (S && (G.mode === 'play' || G.mode === 'pause' || G.mode === 'result' || G.mode === 'lobby')) {
      if (G.mode === 'play') applyInput();
      S.update(dtRaw);
      if (S.kind === 'client') {
        if (S.rejected) { const why = { version: '版が違います。ページを再読み込みしてください。', started: 'すでに戦闘が始まっています。', full: '部屋が満員です（4人まで）。' }[S.rejected] || '入れませんでした。'; S.rejected = null; $('#lostTitle').textContent = '部屋に入れませんでした'; $('#lostMsg').textContent = why; G.mode = 'lost'; show('netlost'); }
        else if (S.lost) { $('#lostTitle').textContent = 'ホストとの接続が切れました'; $('#lostMsg').textContent = S.lost === 'timeout' ? '通信が6秒以上とだえたため中断しました。電波のよい所でもう一度入ってください。' : 'ホストが部屋を閉じました。戦闘は中断されました。'; G.mode = 'lost'; S.lost = null; show('netlost'); }
        else if (G.mode === 'lobby' && S.started && S.mySlot >= 0) enterGame();
        else if ((G.mode === 'result' || G.mode === 'play') && S.lobby && S.lobby.phase === 'lobby' && G.resultShown) { openLobby(); }
        else if (G.mode === 'lobby' && !S.lobby && performance.now() - (G.joinT || 0) > 15000) { $('#lostTitle').textContent = '部屋が見つかりません'; $('#lostMsg').textContent = '合言葉が同じか、ホストが「部屋を作る」を押しているか確認してください。'; G.mode = 'lost'; show('netlost'); }
      }
      if (G.mode === 'lobby') { G.lobT = (G.lobT || 0) + dt; if (G.lobT > 0.5) { G.lobT = 0; renderTeam(); } }
      G.my = S.kind === 'client' ? Math.max(0, S.mySlot) : S.mySlot;
      const v = (G.mode === 'play' || G.mode === 'pause' || G.mode === 'result') ? S.view() : null;
      if (v) {
        G.v = v;
        if (G.snapNext) { R.snapCam(v, G.my); G.snapNext = false; }
        R.sync(v, dt, G.T, G.my);
        const evs = R.events(v, G.my); for (const e of evs) onEvent(e, v);
        R.updateCamera(v, G.my, dt, S.local, gameArea());
        $('#hud').classList.toggle('intro', v.stage === 'intro');
        if (G.mode === 'play') { updateHud(v, dt); G.mapT = (G.mapT || 0) + dt; if (G.mapT > 0.05) { G.mapT = 0; drawMap(v); } }
        stepDmg(dt);
        if ((v.stage === 'won' || v.stage === 'lost') && v.stageT > (v.stage === 'won' ? 3.4 : 2.6) && G.mode === 'play') showResult(v);
      }
    } else titleCam(G.T);
  } catch (e) { console.error(e); }
  R.render(dt);
  requestAnimationFrame(frame);
}
function titleCam(T) {
  const c = R.camera; const z = -40 + Math.sin(T * 0.08) * 16;
  c.clearViewOffset(); c.position.set(Math.sin(T * 0.11) * 2.5, 2.6 + Math.sin(T * 0.07) * 0.6, z); c.lookAt(0, 3.4, z + 30);
  if (R.cam && !G.titleLit) { G.titleLit = true; }
}
boot();
