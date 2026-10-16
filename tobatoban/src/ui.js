/* =====================================================================
   ui.js — 画面遷移・HUD・タッチ操作・メインループ
   ===================================================================== */
const $ = s => document.querySelector(s);
const STORE = { get(k, d) { try { const v = localStorage.getItem('tb.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('tb.' + k, JSON.stringify(v)); } catch (e) { } } };
const SET = Object.assign({ land: true, rotDir: 'left', ui: 100, mirror: false, stick: 'fixed', shake: true, simple: false, relock: false, vib: true, bgm: 50, sfx: 85, dev: false }, STORE.get('set', {}));
const VC = { t: 0, w: 0, h: 0 }; // 画面サイズの変化をまとめる（requestViewChange）
const PUBLIC_URL = 'https://koyoy1016-gif.github.io/games/tobatoban/';
const G = {
  mode: 'boot', session: null, v: null, T: 0, busts: {}, party: STORE.get('party', DATA.DEFAULT_PARTY.slice()), swap: STORE.get('swap', [false, false, false, false]),
  items: STORE.get('items', ['onigiri', 'ramune']), diff: 'normal', selSlot: 0, focus: null, thumbs: {}, netMode: null, roomCap: null,
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
/** 端末そのものの向き（v7 P4-2）：キーボードで表示領域の高さが減っても「縦向き」と誤判定しないよう、画面の向き（screen.orientation など）を優先する */
function devicePortrait() {
  const so = screen.orientation && screen.orientation.type; if (so) return so.indexOf('portrait') === 0;
  if (typeof window.orientation === 'number') return window.orientation % 180 === 0; // iOS Safari の古い版
  const sw = screen.width || window.innerWidth, sh = screen.height || window.innerHeight; return sh > sw * 1.05;
}
function applyRotation() {
  const app = $('#app'); const vw = window.innerWidth, vh = window.innerHeight;
  // 入力中（G.kbUp）は回さない：OSのキーボードはCSSでは回らないので、入力画面を端末の向きに合わせて立てて表示する
  const rot = SET.land && !G.kbUp && devicePortrait() && vh > vw * 0.75 ? (SET.rotDir === 'right' ? -90 : 90) : 0;
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
function onViewChange() { applyRotation(); R.resize(); layoutHud(); VC.w = window.innerWidth; VC.h = window.innerHeight; }

/* ---------- 画面 ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
  $('#hud').hidden = !(G.mode === 'play' && !id);
  // メニューの3D：ホーム（4体）とキャラ詳細（1体）だけ。ほかの画面では止めて隠す
  if (id === 'title' && typeof renderHome === 'function') { if (G.mode !== 'lobby' && G.mode !== 'walk') G.mode = 'title'; renderHome(); }
  else if (id !== 'chara' && typeof LOBBY3D !== 'undefined') LOBBY3D.hide();
}
function goTitle() {
  if (G.session) { try { G.session.leave(); } catch (e) { } }
  G.session = null; G.mode = 'title'; G.v = null; G.coop = false; R.clearEntities(); AUDIO.bgm('title');
  $('#bossCard').classList.remove('show'); $('#banner').classList.remove('show'); $('#rotateHint').hidden = true;
  show('title');
}
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { AUDIO.sfx('back'); const to = G.back; if (to === 'settings' && G.backPrev) { G.back = G.backPrev; G.backPrev = null; } show(to); });
function openSub(id, from) { G.back = from; show(id); }

/* ---------- 起動 ---------- */
async function boot() {
  try { // v8：TURN（中継）の設定。?turn=URL（iceServers を返すURL）か、保存した設定（tb.turnUrl / tb.ice）。公開ファイルに長期の秘密は書かない
    const q = new URLSearchParams(location.search), tu = q.get('turn') || localStorage.getItem('tb.turnUrl') || ''; if (q.get('turn')) localStorage.setItem('tb.turnUrl', q.get('turn'));
    if (tu) NETLIB.ICE.url = tu; const ice = JSON.parse(localStorage.getItem('tb.ice') || '[]'); if (Array.isArray(ice)) NETLIB.ICE.turn = ice;
  } catch (e) { }
  const fontsReady = Promise.race([Promise.all([document.fonts.load('40px "Yuji Syuku"', '千住'), document.fonts.load('40px "Dela Gothic One"', 'トバ'), document.fonts.load('900 16px "Zen Maru Gothic"', 'もののけ')]), new Promise(r => setTimeout(r, 2500))]).catch(() => { });
  await fontsReady;
  applyRotation();
  R.init($('#gl'));
  R.setOpts({ shake: SET.shake, simple: SET.simple });
  R.on('notice', onNotice);
  makeThumbs();
  bindMenus(); bindHud(); bindRotScroll(); applySettings();
  detectNet();
  G.guest = SAVE.fresh(0, ''); fixParty(); // ログインしていない間の所持・レベル（この画面を開いている間だけ）
  frTakeLink(); // 招待リンク（?friend=コード）
  ACCT.setup(); G.mode = 'title'; updateAcctBar(); openLogin('title', G.frPending && ACCT.mode === 'cloud' ? 'フレンドの招待リンクです。ログインすると申請できます' : ''); // 開くたびにログインをたずねる
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
      r.render(sc, cm); G.thumbs[c.id] = r.domElement.toDataURL('image/png');
      // 一覧のカード用：顔・上半身を大きく（同じモデルから作る）
      GFX.animChar(m, { x: 0, z: 0, yaw: 0.3, st: 'ok', act: '', actT: 0, slot: 0, moving: false }, 0.3, 0, {}); m.root.rotation.y = 0.3;
      cm.position.set(0, 0.8 * hh, 1.75 * hh); cm.lookAt(0, 0.66 * hh, 0); r.render(sc, cm); G.busts[c.id] = r.domElement.toDataURL('image/png');
      sc.remove(m.root);
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
  $('#btnHost').onclick = () => startHost();
  $('#btnJoin').onclick = () => startJoin();
  bindHub();
  $('#btnResume').onclick = () => resume();
  $('#btnPSet').onclick = () => openSub('settings', 'pause');
  $('#btnPHow').onclick = () => openSub('how', 'pause');
  $('#btnPSave').onclick = () => doSave('pause');
  $('#btnQuit').onclick = () => { AUDIO.sfx('back'); goTitle(); }; // 撤退は報酬なし（記録もしない）
  $('#btnSkip').onclick = () => { const s = G.session; if (s && s.sim && s.sim.stage === 'intro' && s.kind === 'solo') s.sim.stageT = s.sim.introLen(); resume(); };
  $('#btnRetry').onclick = () => {
    AUDIO.sfx('ok');
    if (G.coop) { if (G.session.kind === 'host') { G.session.backToLobby(); openLobby(); } return; }
    const nx = G.next; G.next = null;
    if (nx === 'street') { leaveBattle(); startSolo('ueno_street'); }
    else if (nx === 'prep') { leaveBattle(); openPrep('ueno'); }
    else if (nx === 'akiba') { leaveBattle(); openRoster('akiba'); }
    else if (nx === 'prepAkiba') { leaveBattle(); openPrep('akiba_plaza'); }
    else startSolo(G.stageId || 'senju');
  };
  $('#btnReteam').onclick = () => { AUDIO.sfx('ok'); if (G.coop) { if (G.session.kind === 'host') G.session.backToLobby(); openLobby(); } else { leaveBattle(); openRoster('home'); } };
  $('#btnResGacha').onclick = () => { AUDIO.sfx('ok'); if (G.coop && G.session) goTitle(); else leaveBattle(); openGacha(); };
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
  bindAccount();
}
function bindRotScroll() {
  let drag = null;
  document.querySelectorAll('.screen').forEach(el => {
    el.addEventListener('pointerdown', e => { if (!VIEW.rot) return; drag = { el: e.currentTarget, id: e.pointerId, y: toApp(e)[1] }; }, { passive: true });
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

/* ---------- 協力プレイの自分の枠 ---------- */
function myLobbySlot() { const s = G.session; if (!s) return 0; return s.kind === 'host' ? 0 : s.mySlot; }
function sendMine() {
  const S = G.session; if (!G.coop || !S) return;
  const o = { nick: G.nick || 'もののけ', ch: G.party[0], swap: !!G.swap[0], items: G.items.slice(0, 2), lv: lvOf(G.party[0]), eq: eqOf(G.party[0]) };
  if (S.kind === 'host') S.setMine(o); else S.hello(o);
}

/* ---------- セーブ（IDは作った順に自動・パスワードは本人が決める） ----------
   ACCT.mode が 'cloud' なら Firebase（全員で通しの番号・どの端末でも続きから）、'local' ならこの端末だけ。
   ログインはこの画面を開いている間だけ有効。開き直すたびにログインをたずねる。
   ログイン中は「セーブ」を押すだけで保存。戦いが終わったときに自動セーブ。 */
G.acct = null; G.pending = []; G.run = null;
/* 所持・レベル・ステージの解放・編成画面などは ui_hub.js */
const fmtDate = ts => { if (!ts) return 'まだ'; const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const cloud = () => ACCT.mode === 'cloud';
function mtoast(t, ms) { const m = $('#mtoast'); m.textContent = t; m.classList.add('show'); clearTimeout(G.mtT); G.mtT = setTimeout(() => m.classList.remove('show'), ms || 2400); }
function updateAcctBar() { if (typeof renderHome === 'function' && !$('#title').hidden) renderHome(); }
function lgMsg(t, ok) { const m = $('#lgMsg'); m.textContent = t; m.classList.toggle('ok', !!ok); }
function lgBusy(on) { G.lgBusy = on; for (const q of ['#btnLogin', '#btnRegister', '#btnRestore', '#btnDoneOk']) $(q).disabled = on; if (on) lgMsg('サーバーと通信しています…', true); }
const PW_TXT = () => `${SAVE.PW_MIN}文字以上`;
function setRegMode(on) {
  G.regMode = on; $('#lgPw2').hidden = $('#lgPw2L').hidden = !on; $('#lgId').hidden = $('#lgIdL').hidden = on;
  $('#btnRegister').hidden = !on; $('#btnLogin').hidden = on; $('#lgMove').hidden = on || cloud();
  $('#lgTitle').textContent = on ? '新しくアカウントを作る' : 'ログイン';
  $('#lgLead').textContent = on ? `パスワードを自分で決めて2回入れてください（${PW_TXT()}）。IDは作った順に自動で決まります。` : 'IDと、自分で決めたパスワードを入れてください。ログインしている間は「セーブ」を押すだけで続きを保存できます。';
  $('#lgPw').setAttribute('autocomplete', on ? 'new-password' : 'current-password'); $('#lgPw').placeholder = PW_TXT();
}
/** アカウントを作った直後：決まったIDを大きく見せる */
function showDone(on, id) {
  $('#lgDone').hidden = !on; if (on) $('#lgDoneId').textContent = String(id);
  for (const q of ['#lgGrid', '#btnLgBack']) $(q).hidden = on;
  if (on) { $('#btnLogin').hidden = true; $('#btnRegister').hidden = true; }
  $('#lgMove').hidden = on || cloud();
  $('#btnDoneOk').hidden = !on;
  if (on) { $('#lgTitle').textContent = 'アカウントができました'; $('#lgLead').textContent = 'これからはこのIDと、いま決めたパスワードでログインします。'; }
}
function openLogin(back, msg) {
  G.loginBack = back || 'title'; showDone(false); setRegMode(false); lgBusy(false);
  const last = STORE.get('lastId', ''); if (!$('#lgId').value && last) $('#lgId').value = last;
  $('#lgPw').value = ''; $('#lgPw2').value = ''; lgMsg(msg || '', false); G.restoreConfirm = null;
  $('#btnGuest').textContent = G.loginBack === 'title' ? 'ログインせずに遊ぶ' : 'もどる';
  $('#lgNote').textContent = cloud() ? 'セーブデータはサーバーに保存されます' : 'セーブデータはこの端末に保存されます';
  $('#lgPanel').hidden = !msg; // 「セーブするにはログイン」などは入力欄を最初から開く
  show('login');
}
/** ログインできた：編成などをアカウントから読み、ログイン前の記録があれば足して保存 */
async function loginOk(save, msg) {
  G.acct = save; G.lgFail = 0; STORE.set('lastId', String(save.id));
  if (Array.isArray(save.party) && save.party.length === 4 && save.party.every(id => DATA.CHI[id])) G.party = save.party.slice();
  if (Array.isArray(save.swap) && save.swap.length === 4) G.swap = save.swap.map(Boolean);
  if (Array.isArray(save.items) && save.items.length === 2 && save.items.every(i => DATA.ITEMS[i])) G.items = save.items.slice();
  if (save.nick) G.nick = save.nick;
  fixParty();
  let extra = '';
  const hadPending = G.pending.length > 0;
  if (hadPending) { for (const op of G.pending) SAVE.apply(save, op); G.pending = []; }
  updateAcctBar(); AUDIO.sfx('ok');
  // 一回限りの遷移予約を先に取り出して消す（ガチャ→ログイン→ガチャ…の循環を残さない）
  const target = G.afterLoginTarget || null, back0 = G.loginBack || 'title'; G.afterLoginTarget = null; G.loginBack = 'title';
  const back = target === 'gacha' ? 'title' : back0;
  if (target === 'gacha') openGacha(); else show(back);
  if (hadPending) { const ok = await persist(); extra = ok ? '。ログイン前の戦いの記録もセーブしました' : '。ログイン前の戦いの記録はセーブできませんでした'; if (G.run) G.lastAuto = ok ? `ID ${save.id} にセーブしました` : 'セーブできませんでした'; }
  if (back === 'result') refreshResSave();
  mtoast(msg + extra, 2800);
  frOnLogin(); // フレンド：状態を知らせ、一覧・招待を読む（招待リンクで開いたならフレンド画面へ）
}
/** いまの編成なども入れて保存する（サーバーのときは通信が終わるまで待つ） */
async function persist() {
  const s = G.acct; if (!s) return false;
  s.party = G.party.slice(); s.swap = G.swap.slice(); s.items = G.items.slice(); s.nick = G.nick || '';
  const ok = await ACCT.write(s); updateAcctBar(); return ok;
}
/** セーブボタン：ログイン中ならそのまま保存。していなければログイン画面へ */
async function doSave(from) {
  if (!G.acct) { AUDIO.sfx('ui'); openLogin(from, 'セーブするにはログインしてください'); return false; }
  if (G.saving) return false; G.saving = true;
  if (cloud()) mtoast('セーブしています…', 8000);
  const ok = await persist(); G.saving = false;
  if (ok) { AUDIO.sfx('ok'); mtoast(`セーブしました（ID ${G.acct.id}・${fmtDate(G.acct.saved)}）`); }
  else mtoast(cloud() ? 'セーブできませんでした（サーバーとつながりません。電波のよい所でもう一度）' : 'セーブできませんでした（このブラウザでは保存できません）', 3600);
  return ok;
}
/** この戦いでまだ記録していない分（倒した敵・出撃・勝敗・EXP）をまとめる。
    自分の操作キャラと、自分が編成したAI（ソロ・ホスト）だけ。操作率は人が操作していた有効時間の割合 */
function runOp(v, fin) {
  if (!G.run || !v) return null;
  const S = G.session, sim = S && S.sim, host = S && S.kind !== 'client';
  const slots = !G.coop ? [0, 1, 2, 3] : host ? v.allies.map((a, i) => i).filter(i => i === G.my || (sim && sim.allies[i] && sim.allies[i].ctrlAI && !(S.lobby && S.lobby.slots && S.lobby.slots[i]))) : [G.my];
  const op = { kills: {}, fin: null };
  for (const i of slots) { const a = v.allies[i]; if (!a) continue; const k = Math.max(0, (a.kills || 0) - G.run.applied[i]); if (k) { op.kills[a.ch] = (op.kills[a.ch] || 0) + k; G.run.applied[i] += k; } }
  if (fin) {
    const main = G.coop ? G.my : 0, rateOf = i => DATA.REWARD.rate(i === main); // 出動時に決まった枠で固定（途中の操作交代で変えない）
    op.fin = { bid: v.bid || (G.run.bid), stage: v.stageId || 'senju', win: !!(v.result && v.result.win), time: v.result ? v.result.time : 0, H: v.H || 1, slots: slots.filter(i => v.allies[i]).map(i => ({ ch: v.allies[i].ch, rate: rateOf(i) })) };
  }
  return op;
}
/** 戦いの記録を足して自動セーブ。結果（EXP・レベル・チケット）を返す */
function checkpoint(v, fin, label) {
  const op = runOp(v, fin); if (!op) return null;
  const target = G.acct || G.guest;
  if (!G.acct) G.pending.push(JSON.parse(JSON.stringify({ kills: op.kills, fin: op.fin }))); // ログインしたらアカウントに足す（同じ戦闘IDは一度だけ）
  SAVE.apply(target, op);
  if (G.acct) {
    G.lastAuto = cloud() ? '自動セーブしています…' : null; refreshResSave();
    persist().then(ok => { G.lastAuto = ok ? `${label}ので自動セーブしました（ID ${G.acct ? G.acct.id : ''}）` : (cloud() ? '自動セーブできませんでした。電波のよい所で「セーブ」を押してください' : '自動セーブできませんでした（このブラウザでは保存できません）'); if (G.mode === 'result') refreshResSave(); });
  }
  return op.res;
}
function refreshResSave() {
  const t = $('#resSave'), b = $('#btnResLogin');
  if (G.acct) { t.textContent = G.lastAuto || `ID ${G.acct.id} にセーブしました`; b.hidden = !/できません/.test(t.textContent); b.textContent = 'もう一度セーブ'; }
  else { t.textContent = 'ログインしていないので、この戦いの記録はまだセーブされていません。'; b.hidden = false; b.textContent = 'ログインしてセーブ'; }
}
function openAccount(from) { if (!G.acct) { openLogin(from || 'title'); return; } G.acBack = from || 'title'; renderAccount(); show('account'); }
function renderAccount() {
  const s = G.acct; $('#acTitle').textContent = `ID ${s.id}`;
  const kv = $('#acKv'); kv.textContent = '';
  for (const [k, v] of [['最後のセーブ', fmtDate(s.saved)], ['出撃', s.rec.b + '回'], ['勝利', s.rec.w + '回'], ['倒した敵', s.rec.mobs + '体'], ['トバトーバ戦', (s.clear && s.clear.senju ? `クリア ${s.clear.senju}回` : 'まだ') + (s.rec.best ? `（最速 ${fmt(s.rec.best)}）` : '')], ['常磐線', s.clear && s.clear.joban ? `クリア ${s.clear.joban}回` : stageOpen('joban') ? 'まだ' : '🔒 トバトーバを倒すと解放'], ['ヨシノシン', s.clear && s.clear.ueno ? `クリア ${s.clear.ueno}回` : stageOpen('ueno') ? 'まだ' : '🔒 電車をクリアすると解放'], ['チケット', `${s.tickets}枚（次の1枚まで ストーリークリア ${(s.wins.story || 0) % 2}/2）`], ['所持', `${Object.keys(s.chars).length} / ${DATA.CHARS.length}体`]]) { kv.appendChild(el('b', '', k)); kv.appendChild(el('span', '', v)); }
  const ro = $('#acRoster'); ro.textContent = '';
  for (const c of DATA.CHARS) { if (!s.chars[c.id]) continue; const d = el('div'); const im = el('img'); im.src = G.thumbs[c.id] || ''; im.alt = ''; d.append(im, el('b', '', c.nm), el('span', 'lv', 'Lv.' + s.chars[c.id].lv)); ro.appendChild(d); }
  const cl = cloud(); $('#acCodeBox').hidden = cl; $('#btnAcCopy').hidden = cl; $('#acCloud').hidden = !cl;
  if (!cl) $('#acCode').textContent = SAVE.encode(s);
}
function bindAccount() {
  $('#btnAcct').onclick = () => { AUDIO.sfx('ui'); if (G.acct) openAccount('title'); else openLogin('title'); };
  $('#btnTSave').onclick = () => doSave('title');
  $('#btnLogin').onclick = async () => {
    if (G.lgBusy) return;
    if (G.lgLock && performance.now() < G.lgLock) { lgMsg(`まちがいが続いたので、${Math.ceil((G.lgLock - performance.now()) / 1000)}秒待ってからためしてください`); return; }
    const id = SAVE.parseId($('#lgId').value), pw = $('#lgPw').value;
    lgBusy(true); const r = await ACCT.login(id, pw); lgBusy(false);
    if (!r.ok) { AUDIO.sfx('back'); lgMsg(r.msg); if (!r.none && SAVE.validId(id) && /ちがいます/.test(r.msg)) { G.lgFail = (G.lgFail || 0) + 1; if (G.lgFail >= 5) { G.lgFail = 0; G.lgLock = performance.now() + 30000; } } return; }
    lgMsg(''); loginOk(r.save, r.msg);
  };
  $('#btnRegister').onclick = async () => {
    if (G.lgBusy) return;
    lgBusy(true); const r = await ACCT.register($('#lgPw').value, $('#lgPw2').value); lgBusy(false);
    if (!r.ok) { AUDIO.sfx('back'); lgMsg(r.msg); return; }
    // ここでログイン済みにして、IDを大きく見せる（「はじめる」で元の画面へ）
    $('#lgId').value = String(r.id); $('#lgPw').value = ''; $('#lgPw2').value = ''; lgMsg('');
    G.acct = r.save; G.lgFail = 0; STORE.set('lastId', String(r.id)); updateAcctBar(); AUDIO.sfx('ok');
    showDone(true, r.id);
    persist(); // 編成などもいっしょに保存
  };
  $('#btnRestore').onclick = () => {
    const id = SAVE.parseId($('#lgId').value), code = $('#lgCode').value, key = id + '|' + code;
    const r = SAVE.restore(id, $('#lgPw').value, code, G.restoreConfirm === key);
    if (!r.ok) { AUDIO.sfx('back'); lgMsg(r.msg); G.restoreConfirm = r.confirm ? key : null; return; }
    G.restoreConfirm = null; $('#lgCode').value = ''; loginOk(r.save, r.msg);
  };
  $('#btnGuest').onclick = () => { AUDIO.sfx('back'); const t = G.afterLoginTarget, b = G.loginBack || 'title'; G.afterLoginTarget = null; G.loginBack = 'title'; if (t === 'gacha') openGacha(); else show(b === 'gacha' ? 'title' : b); }; // 取消：予約を消して戻る（ログインをもう一度開かない）
  $('#btnDoneOk').onclick = () => { const s = G.acct; showDone(false); setRegMode(false); if (s) loginOk(s, `ID ${s.id} でログインしました。全員Lv.1からスタート`); };
  for (const id of ['#lgId', '#lgPw', '#lgPw2']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); (G.regMode ? $('#btnRegister') : $('#btnLogin')).click(); } });
  $('#btnAcSave').onclick = async () => { await doSave('account'); renderAccount(); };
  $('#btnAcCopy').onclick = async () => { const t = $('#acCode').textContent; try { await navigator.clipboard.writeText(t); mtoast('引き継ぎコードをコピーしました'); } catch (e) { mtoast('コピーできませんでした。コードを長押しして選んでください', 3000); } };
  $('#btnLogout').onclick = () => { G.acct = null; ACCT.logout(); frOnLogout(); AUDIO.sfx('back'); mtoast('ログアウトしました'); openLogin('title'); };
  $('#btnAcBack').onclick = () => { AUDIO.sfx('back'); show(G.acBack || 'title'); };
  $('#btnResLogin').onclick = async () => { if (G.acct) { const ok = await doSave('result'); G.lastAuto = ok ? `ID ${G.acct.id} にセーブしました` : G.lastAuto; refreshResSave(); } else openLogin('result', 'ログインすると、この戦いの記録もセーブされます'); };
}

/* ---------- 協力プレイの開始 ---------- */
async function openTransport(code) {
  if (/[?&]net=bc/.test(location.search)) return NETLIB.BCTransport.open(code);
  if (G.netMode === 'room') return NETLIB.RoomTransport.open(G.roomCap, code);
  return NETLIB.P2PTransport.open(code);
}
/** 協力プレイの部屋を用意する（すでに自分の部屋があればそれを使う）。フレンドの「招待」からも呼ぶ。成功したら合言葉を返す */
async function startHost(opt) {
  opt = opt || {};
  if (G.coop && G.session && G.session.kind === 'host' && !G.session.closed) { if (!opt.quiet) openLobby(); return G.session.code; } // 部屋を増やさない
  if (G.netBusy) return null; // 連打でセッションを重ねない
  if (G.coop && G.session) { try { G.session.leave(); } catch (e) { } G.session = null; G.coop = false; }
  AUDIO.init(); if (!opt.quiet) AUDIO.sfx('ok');
  G.nick = (($('#nick').value || G.nick || '').trim() || 'もののけ').slice(0, 10); STORE.set('nick', G.nick);
  const code = String(100000 + Math.floor(Math.random() * 900000)); // 6けた（他の人の部屋と重なりにくく）
  const b = $('#btnHost'); b.disabled = true; b.textContent = '部屋を準備しています…'; G.netBusy = true;
  let ok = null;
  try {
    NETLIB.log('ui', `部屋を作る #${code}`);
    const tr = await openTransport(code);
    G.session = new NETLIB.HostSession({ transport: tr, code, nick: G.nick, ch: G.party[0], swap: !!G.swap[0], items: G.items.slice(0, 2), aiParty: G.party.slice(1), lv: lvOf(G.party[0]), lvs: Object.fromEntries(DATA.CHARS.map(c => [c.id, lvOf(c.id)])) });
    G.session.lobby.diff = G.diff; G.coop = true; ok = code;
    if (opt.quiet) { G.mode = 'lobby'; if (!$('#title').hidden) renderHome(); frPublish(true); } else openLobby();
  } catch (e) { console.error(e); NETLIB.log('ui', '部屋を作れない: ' + (e && e.message)); toast('部屋を作れませんでした。電波のよい所でもう一度。'); if (opt.quiet) mtoast('部屋を作れませんでした（通信の部品を読み込めません）', 2800); }
  G.netBusy = false; b.disabled = false; b.textContent = '部屋を作る';
  return ok;
}
/** 合言葉の部屋に入る（フレンドの「参加」・招待リンクからも呼ぶ） */
async function startJoin(codeArg) {
  if (G.netBusy) return false;
  AUDIO.init(); AUDIO.sfx('ok');
  const code = String(codeArg || $('#code').value).trim(); if (!/^\d{4,8}$/.test(code)) { toast('合言葉（数字）を入れてください'); mtoast('合言葉（数字）を入れてください', 2000); return false; }
  if (G.coop && G.session) { if (G.session.code === code) { openLobby(); return true; } try { G.session.leave(); } catch (e) { } G.session = null; G.coop = false; }
  G.nick = (($('#nick').value || G.nick || '').trim() || 'もののけ').slice(0, 10); STORE.set('nick', G.nick);
  const b = $('#btnJoin'); b.disabled = true; b.textContent = 'つないでいます…'; G.netBusy = true;
  let ok = false;
  try {
    NETLIB.log('ui', `部屋に入る #${code}`);
    const tr = await openTransport(code);
    G.session = new NETLIB.ClientSession({ transport: tr, code }); G.coop = true; sendMine(); G.joinT = performance.now(); joinWait(true); ok = true; // v8：ホストが枠を確定するまでは空のロビーを見せず「入室中」を出す
  } catch (e) { console.error(e); NETLIB.log('ui', 'つなげない: ' + (e && e.message)); toast('つなげませんでした。もう一度ためしてください。'); mtoast('通信の部品を読み込めませんでした。電波のよい所でもう一度', 2800); }
  G.netBusy = false; b.disabled = false; b.textContent = '部屋に入る';
  return ok;
}
function toast(s) { const n = $('#netMsg'); n.textContent = s; }
/** v8：入室待ちの表示（相手探し→接続→入室確認）。やめるボタンで部屋を片付ける */
function joinWait(on) {
  G.joinWaiting = !!on; const p = $('#joinWait'); if (!p) return; p.hidden = !on;
  if (on) { G.mode = 'joining'; $('#jwCode').textContent = G.session ? G.session.code : ''; joinWaitTick(G.session); }
}
function joinWaitTick(S) {
  if (!S) return; const st = S.state, t = Math.floor((performance.now() - (G.joinT || 0)) / 1000);
  const steps = [['部屋に入る準備', true], ['ホストを探す', S.peerSeen], ['ホストとつなぐ', !!S.lobby], ['参加の受け付け', S.joined]];
  const ul = $('#jwSteps'); ul.textContent = ''; let cur = false;
  for (const [nm, done] of steps) { const li = el('li', done ? 'done' : !cur ? 'now' : ''); if (!done) cur = true; li.textContent = (done ? '✔ ' : '・ ') + nm; ul.appendChild(li); }
  $('#jwMsg').textContent = `${t}秒（${DATA.NET.connectTimeout}秒たってもつながらないときは理由を表示します）` + (S.joinErr ? '　直接の通信に失敗しています…' : '');
}

/* ---------- ゲーム開始 ---------- */
function startSolo(stageId) {
  AUDIO.init();
  G.stageId = stageOpen(stageId) ? stageId : 'senju';
  const S = new NETLIB.HostSession({ nick: 'P1', ch: G.party[0], swap: G.swap[0], items: G.items });
  S.lobby.diff = G.diff; S.lobby.stage = G.stageId;
  const carry = G.stageId === 'ueno_street' && G.carry ? G.carry : null; G.carry = null; // 電車から続けて上野へ行くときだけ、アイテムの所持数を引き継ぐ
  markUsed(G.party);
  S.startGame({ stageId: G.stageId, bid: newBid(), carry, party: (() => { const u = SAVE.uniqEq(G.party.map(eqOf)); return G.party.map((ch, i) => ({ ch, swap: !!G.swap[i], items: i === 0 ? G.items.slice(0, 2) : ['onigiri', 'ramune'], nick: i === 0 ? 'あなた' : 'AI', lv: lvOf(ch), eq: u[i] })); })() });
  G.session = S; G.coop = false; enterGame();
}
function enterGame() {
  G.run = { applied: [0, 0, 0, 0] }; G.lastAuto = null; G.cut = {}; // この戦いでセーブ済みの記録・演出の字幕
  G.mode = 'play'; G.lock = null; G.resultShown = false; G.lagBoss = 1; G.lagMe = 1; G.spTotals = {}; G.lastStage = ''; G.hint = 0;
  R.clearEntities(); R.cam.lock = null; R.cam.yaw = 0; R.cam.introDone = false;
  show(null); $('#hud').hidden = false; layoutHud(); buildPartyCards();
  AUDIO.bgm('street');
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
  G.snapNext = true;
  const jb = G.session && G.session.sim && G.session.sim.stageId === 'joban', d0 = jb ? DATA.JOBAN.introT * 1000 + 1200 : 0; // 常磐線は演出のあとに出す
  if (!G.coop) { // 最初に：仲間アイコンをタップで操作キャラを切り替えられる
    setTimeout(() => { if (G.mode !== 'play') return; notice((curLayout && curLayout.portrait ? '上' : '左上') + 'の仲間アイコンをタップすると、そのキャラに切り替えられます', 'tip', 5200); const p = $('#party'); p.classList.add('tip'); setTimeout(() => p.classList.remove('tip'), 5200); }, 700 + d0);
  }
  if (G.firstRun && !G.coop) { setTimeout(() => notice('スティックで移動・Aで攻撃。' + (jb ? 'ヨシノシンの部下' : '札小僧') + 'をやっつけよう', 'info', 4000), 6200 + d0); setTimeout(() => notice('Xは技1、Yは技2。ためる技は長押しして離す', 'info', 4000), 10400 + d0); STORE.set('played', true); G.firstRun = false; }
}
function pause() {
  if (G.mode !== 'play') return; const S = G.session;
  $('#pauseNote').textContent = S && S.kind !== 'solo' ? '協力プレイ中はゲームは止まりません（メニュー中も戦闘は進みます）。' : 'ゲームは止まっています。';
  $('#btnSkip').hidden = !(S && S.kind === 'solo' && S.sim && S.sim.stage === 'intro');
  if (S && S.kind === 'solo') S.paused = true; if (S && S.sim && S.sim.resetAutoRun) S.sim.resetAutoRun(); G.mode = 'pause'; G.back = 'pause'; show('pause'); // ポーズで自動ダッシュを残さない
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
/* 画面サイズの変化：回転（CSS transform）とブラウザのリサイズが重ならないよう1回にまとめる。
   ・resize / visualViewport / orientationchange の連続は最後の1回だけ
   ・1〜2pxの行ったり来たり（アドレスバーの伸縮途中など）は無視
   ・入力中（キーボード表示）は、向きが変わらない限り並べ直さない（入力欄やメニューがぶれない） */
function requestViewChange(delay) {
  clearTimeout(VC.t);
  VC.t = setTimeout(() => {
    const vw = window.innerWidth, vh = window.innerHeight, swapped = VC.w && (vw > vh) !== (VC.w > VC.h);
    const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (VC.w && !swapped && Math.abs(vw - VC.w) <= 2 && Math.abs(vh - VC.h) <= 2) return;
    if (typing && !swapped && VC.w) return;
    VC.w = vw; VC.h = vh; onViewChange();
  }, delay);
}
addEventListener('resize', () => requestViewChange(80));
addEventListener('orientationchange', () => requestViewChange(260));
if (window.visualViewport) visualViewport.addEventListener('resize', () => requestViewChange(80));
document.addEventListener('focusout', () => { setTimeout(() => { const f = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName); if (G.kbUp && !f) { G.kbUp = false; $('#app').classList.remove('kbup'); onViewChange(); } }, 160); requestViewChange(200); }); // キーボードを閉じたら、まとめて1回だけ合わせる
// v7 P4-2：横向き表示（CSSで90度回している）で文字を入力するときは、入力の間だけ端末の向きに立てる（キーボードと入力欄の向きをそろえる）
document.addEventListener('focusin', e => {
  const t = e.target; if (!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || /^(checkbox|radio|range|button)$/.test(t.type || '')) return;
  if (VIEW.rot) { G.kbUp = true; $('#app').classList.add('kbup'); onViewChange(); }
  setTimeout(() => { try { t.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (er) { } }, 320); // キーボードが出たあと、入力欄と確定ボタンを見える位置へ
});
if (window.visualViewport) visualViewport.addEventListener('resize', () => { const a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) setTimeout(() => { try { a.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (er) { } }, 60); });
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
    INP.tap = { id: e.pointerId, x: ax, y: ay, t: performance.now(), moved: 0 }; // 短く押して離したら「敵をタップ」
    if (SET.stick === 'follow' && leftSide && INP.stick == null && (curLayout && (curLayout.portrait ? ay > VIEW.h * 0.55 : true))) {
      const d = parseFloat(stick.style.width); stick.style.left = (ax - d / 2) + 'px'; stick.style.top = (ay - d / 2) + 'px'; startStick(e, ax, ay); INP.touchStick = true; return;
    }
    if (INP.cam == null) { INP.cam = { id: e.pointerId, x: ax, y: ay }; }
  });
  touch.addEventListener('pointermove', e => {
    if (INP.tap && e.pointerId === INP.tap.id) { const [ax, ay] = toApp(e); INP.tap.moved = Math.max(INP.tap.moved, Math.hypot(ax - INP.tap.x, ay - INP.tap.y)); }
    if (e.pointerId === INP.stick) return moveStick(e);
    if (INP.cam && e.pointerId === INP.cam.id) { const [ax, ay] = toApp(e); const dx = ax - INP.cam.x, dy = ay - INP.cam.y; INP.cam.x = ax; INP.cam.y = ay; R.cam.yaw -= dx * 0.009; R.cam.dragT = 1.2; const C = DATA.CAM; R.cam.userPitch = Math.max(-10, Math.min(10, (R.cam.userPitch || 0) + dy * 0.12)); }
  });
  for (const t of ['pointerup', 'pointercancel']) touch.addEventListener(t, e => {
    const tp = INP.tap; if (tp && e.pointerId === tp.id) { INP.tap = null; if (t === 'pointerup' && tp.moved < 14 && performance.now() - tp.t < 350) tapTarget(tp.x, tp.y); }
    if (e.pointerId === INP.stick) endStick(); if (INP.cam && e.pointerId === INP.cam.id) INP.cam = null;
  });
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
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
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
/** 画面の敵をタップ：その敵に注目する。追尾距離（12m）の内なら、遠距離攻撃の弾はその敵へ追尾して当たる */
const LOCKABLE = ['idle', 'walk', 'wind', 'act', 'rec', 'down', 'stun'];
const hasRanged = ch => { const c = DATA.CHI[ch]; if (!c) return false; if (c.A === 'shot') return true; return ['X', 'Y'].some(k => { const s = DATA.SKILLS[c[k]]; return s && (s.kind === 'dot' || s.form === 'shot' || s.form === 'blast'); }); };
/** 単体回復の技（X・Yのどちらか）を持つキャラか。範囲回復だけのキャラは対象外 */
const singleHealer = ch => { const c = DATA.CHI[ch]; return !!c && ['X', 'Y'].some(k => { const s = DATA.SKILLS[c[k]]; return s && s.kind === 'heal'; }); };
/** v7：回復対象の指定（もう一度で解除）。回復技を使うと、射程内ならこの味方だけを回復する */
function setHealTarget(i) { const S = G.session, v = G.v; if (!S || !v) return; if (S.local.healT === i) { S.local.healT = null; notice('回復対象を解除（いちばん減っている味方を回復）', 'info', 1400); } else { S.local.healT = i; notice(`P${i + 1} ${DATA.CHI[v.allies[i].ch].nm}を回復対象にした`, 'info', 1500); } AUDIO.sfx('ui'); }
function tapTarget(ax, ay) {
  const v = G.v; if (!v || G.mode !== 'play') return;
  const me = v.allies[G.my]; if (!me || me.st !== 'ok' || v.stage === 'intro') return;
  let best = null, bd = 52 * (curLayout ? Math.max(0.8, curLayout.posS) : 1);
  const tryPt = (id, x, y, z, r, extra) => { const p = R.project(x, y, z); if (!p.front) return; const d = Math.hypot(p.x - ax, p.y - ay) - (extra || 0); if (d < bd) { bd = d; best = { id, x, z, r }; } };
  if (v.boss && v.stage === 'boss' && LOCKABLE.includes(v.boss.st)) for (const y of [0.8, 2.2, 3.6]) tryPt('boss', v.boss.x, v.boss.y + y, v.boss.z, 1.4, 30);
  if (singleHealer(me.ch)) v.allies.forEach((o, i) => { if (o.st === 'ok') for (const y of [0.4, 0.9]) tryPt('ally:' + i, o.x, y, o.z, 0.4, 6); }); // v7：味方をタップ＝回復対象
  for (const m of v.mobs) if (!m.dying) { tryPt(m.id, m.x, m.yoshi ? 0.8 : 0.45, m.z, 0.4); if (m.yoshi) tryPt(m.id, m.x, 1.35, m.z, 0.4); }
  if (!best) return;
  if (String(best.id).indexOf('ally:') === 0) { setHealTarget(+best.id.slice(5)); return; }
  if (G.lock === best.id) { G.lock = null; AUDIO.sfx('back'); return; } // もう一度タップで解除
  const dist = Math.max(0, Math.hypot(best.x - me.x, best.z - me.z) - best.r), R0 = DATA.SIM.homeRange;
  if (dist > R0) { AUDIO.sfx('back'); notice(`遠すぎて狙えません（${R0}mまで近づいてからタップ）`, 'warn', 1500); return; }
  G.lock = best.id; G.relockWanted = false; AUDIO.sfx('ok'); vib(10);
  if (hasRanged(me.ch) && !G.homeTip) { G.homeTip = 1; notice('ねらった敵に弾が追尾します', 'info', 1600); }
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
    const info = el('div', 'info'); const nm = el('div', 'nm'); const lvT = el('span', 'lv', ''); const nmT = el('span', '', ''); const ic = el('span', 'ic', ''); nm.append(lvT, nmT, ic); info.appendChild(nm);
    const hp = el('div', 'mini hp'); const hpi = el('i'); hp.appendChild(hpi); info.appendChild(hp);
    const sp = el('div', 'mini sp'); const spi = el('i'); sp.appendChild(spi); info.appendChild(sp); c.appendChild(info);
    const st = el('span', 'state', ''); st.hidden = true; c.appendChild(st); const gt = el('span', 'gtag', ''); gt.hidden = true; c.appendChild(gt);
    const ht = el('span', 'healtag', '回復対象'); ht.hidden = true; c.appendChild(ht);
    c.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); partyTap(i); });
    box.appendChild(c); G.cards.push({ c, im, nmT, lvT, ic, hp, hpi, sp, spi, st, ht, gt, ch: null });
  }
}
function partyTap(i) {
  const v = G.v, S = G.session; if (!v || !S) return;
  const me = v.allies[G.my];
  if (me && me.act === 'charge' && DATA.SKILLS[me.sk[me.actSlot]] && DATA.SKILLS[me.sk[me.actSlot]].kind === 'heal') { S.local.healT = i; AUDIO.sfx('ui'); return; }
  if (me && singleHealer(me.ch) && (S.kind !== 'solo' || i === G.my)) { setHealTarget(i); return; } // 協力中（交代できない）・自分のカードは回復対象の指定。ソロで仲間のカードは今までどおり交代（画面の味方をタップすると指定）
  if (S.kind === 'solo' && i !== G.my) { if (S.swapTo(i)) { G.my = i; AUDIO.sfx('ok'); notice(`${DATA.CHI[v.allies[i].ch].nm}に交代した`, 'info', 1500); R.cam.reset = true; } else notice('その仲間には交代できません', 'info', 1200); }
}

/* ---------- 通知 ---------- */
function notice(txt, kind, ms) {
  const n = $('#notice'); const d = el('div', 'nt ' + (kind || ''), txt); n.appendChild(d); while (n.children.length > 4) n.firstChild.remove();
  setTimeout(() => d.remove(), ms || 1600);
}
function banner(t, small, ms) { const b = $('#banner'); b.textContent = t; if (small) { const s = el('small', '', small); b.appendChild(s); } b.classList.add('show'); clearTimeout(G.bannerT); G.bannerT = setTimeout(() => b.classList.remove('show'), ms || 1800); }
/** v7 P6：敵の大技（必殺）。画面の中央に2.5秒だけ名前を出す。小技は今までどおり小さく */
const ENEMY_SP = { otoshi: 1, kousen: 1, junkou: 1, stamp: 1, shosha: 1, tengai: 1, throw50: 1, sleep: 1, barrier: 1, benibana: 1, meguri: 1, hoshirai: 1, hyoutei: 1 };
function enemySp(who, nm) { const d = $('#eSp'); d.textContent = ''; d.append(el('small', '', who + 'の必殺'), el('span', '', nm)); d.classList.remove('show'); void d.offsetWidth; d.classList.add('show'); }
/** v7 P6：仲間（自分以外）が必殺を撃った：「P2 キャラ名 必殺名」を右上に流す（3件まで） */
function spFeed(slot, nm) {
  const f = $('#spFeed'), a = G.v && G.v.allies[slot], c = a && DATA.CHI[a.ch]; while (f.children.length >= 3) f.firstChild.remove();
  { // 置き場所：右上のミニマップ・視点ボタンのすぐ下（回転前の画面の座標で測る）
    let bot = 0; for (const e of document.querySelectorAll('#hud #map, #hud button')) { if (!e.offsetParent || e.offsetWidth === 0) continue; const x = e.offsetLeft + e.offsetWidth / 2, y = e.offsetTop + e.offsetHeight / 2; if (x > VIEW.w * 0.62 && y < VIEW.h * 0.4) bot = Math.max(bot, e.offsetTop + e.offsetHeight); }
    f.style.top = Math.round((bot || VIEW.h * 0.3) + 6) + 'px'; }
  const it = el('div', 'it'), b = el('b', '', 'P' + (slot + 1)); b.style.background = pcol(slot); it.append(b, (c ? c.nm + '　' : '') + nm); f.appendChild(it); setTimeout(() => it.remove(), 2700);
}
function onNotice(o) {
  const v = G.v;
  if (o.k === 'sp') {
    if (o.me) { const c = $('#cutin'); $('#cutImg').src = G.thumbs[v.allies[o.slot].ch] || ''; $('#cutWho').textContent = 'P' + (o.slot + 1) + '　必殺技'; $('#cutNm').textContent = o.nm; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
    else spFeed(o.slot, o.nm); // v7 P6：仲間の必殺は右上に2〜3秒流す
  } else if (o.k === 'orb') { notice(o.slot === G.my ? 'G玉！ 10秒だけ ちから・ようりょく×2' : `P${o.slot + 1}がG玉（10秒 ちから・ようりょく×2）`, 'sp', 2200);
  } else if (o.k === 'boss') { const ue = G.v && G.v.stageId === 'ueno', M = (ue ? DATA.UENO.moves : DATA.BMOVES)[o.mv]; if (M && o.mv !== 'cmd') { if (ENEMY_SP[o.mv]) enemySp(ue ? 'ヨシノシン' : 'トバトーバ', M.nm); else notice(M.nm, 'boss', 1100); } }
  else if (o.k === 'phase2') { banner('トバトーバが覚醒した！', '赤いオーラ：空の巡行が6回に増える。落下提灯に注意', 2400); AUDIO.bgm('boss2'); }
  else if (o.k === 'unlock') { if (G.lock === 'boss') { G.lock = null; G.relockWanted = SET.relock; } notice('ボスが飛んだ！ 注目が外れた', 'warn', 1500); }
  else if (o.k === 'sig') { const t = { help: '助けて！', heal: '回復する！', lantern: '灯籠へ！', sp: '必殺準備OK！', left: '通信が切れたためAIが引き継ぎます' }[o.code] || ''; notice(`P${o.slot + 1}：${t}`, o.code === 'left' ? 'warn' : '', 2000); }
  else if (o.k === 'stage') {
    if (o.s === 'wave2') notice('札小僧がまた出た！', 'info', 1500);
    if (o.s === 'open') { banner('結界が解けた', '奥の祭り広場へ進もう', 2200); AUDIO.sfx('lantern'); }
    if (o.s === 'intro') { AUDIO.bgmStop(); G.lock = null; setTimeout(() => $('#bossCard').classList.add('show'), 3300); setTimeout(() => $('#bossCard').classList.remove('show'), 5400); }
    if (o.s === 'train') { AUDIO.bgm('boss'); banner('ヨシノシンの部下が現れた！', '上野に着くまでに、車内の部下をすべて倒せ', 2400); }
    if (o.s === 'arrive') { banner('上野に到着！', 'ヨシノシンは上野で待っている……', 3000); }
    if (o.s === 'fight') { AUDIO.bgm('boss'); if (v && v.stageId === 'ueno') banner('ヨシノシンを鎮めよ！', '部下の予告を見切り、本体に近づこう', 2200); else banner('鎮めよ！', '赤い縞は攻撃の予兆。灯籠4基で動きを止められる', 2000); }
    if (o.s === 'won') { AUDIO.jingle(true); if (v && v.stageId === 'joban') banner('ヨシノシンの部下を全員倒した！', '常磐線は無事に上野へ着いた', 3000); else if (v && v.stageId === 'ueno') banner('ヨシノシンを鎮めた！', '命令を失った部下たちが、ぱたりと倒れた', 3000); else banner('鎮まった！', 'トバトーバは静かな看板に戻った', 3000); }
    if (o.s === 'lost') { AUDIO.jingle(false); banner(G.v && G.v.result && G.v.result.why === 'time' ? '時間切れ' : '全滅', '', 2500); }
  }
}
function onEvent(e, v) {
  const me = G.my;
  switch (e.type) {
    case 'dmg': dmgNum(e.x, (e.y || 1) + 0.3, e.z, e.v, e.blk ? 'blk' : e.kind === 'sp' ? 'sp' : (e.crit || e.lucky) ? 'crit' : e.el > 0 ? 'weak' : e.el < 0 ? 'resist' : '', e, e.src === me || e.boss ? 2 : 1); break;
    case 'hurt': dmgNum(e.x, 1.2, e.z, e.v, 'hurt', null, e.slot === me ? 2 : 0); if (e.slot === me) vib(25); break;
    case 'wave': if (e.n >= 2) notice(`1号車から${e.cnt}体が来る！（第${e.n}波）`, 'warn', 2200); break;
    case 'board': notice(`${DATA.JOBAN.stations[e.st]}：ホームから部下が${e.n}体乗ってくる！`, 'warn', 2200); break;
    case 'jev': if (e.id && e.id.startsWith('mid_')) notice(`前の車両に潜んでいた部下${e.n}体が出てくる！`, 'warn', 2200); break;
    case 'arriveSt': if (e.st < 4) notice(`${DATA.JOBAN.stations[e.st]}に到着`, 'info', 1500); break;
    case 'sleepWarn': banner(`もうすぐ30分睡眠チャージ（${['75%', '50%', '25%'][e.i]}）`, `接近して必殺・G玉を準備しよう（10秒で${e.need.toLocaleString()}）`, 2600); break;
    case 'sleep': banner(`30分睡眠チャージ！（${e.i + 1}/3）`, `10秒以内に4体合計${e.need.toLocaleString()}ダメージを与えろ！`, 2000); break;
    case 'sleepEnd': if (e.ok) banner(`阻止成功！（${e.i + 1}/3）`, `ヨシノシンがダウン（${e.dmg.toLocaleString()} / ${e.need.toLocaleString()}）`, 2400); else banner('阻止失敗…', `ヨシノシンがHP${DATA.UENO.hp.toLocaleString()}まで全回復（${e.dmg.toLocaleString()} / ${e.need.toLocaleString()}）。3つの段階をやり直し`, 2800); break;
    case 'barrier': if (e.on) notice('完全指揮バリア！ 射撃部下のビームを本体へ2回誘導して壊そう', 'boss', 3200); else if (e.broken) notice('バリアを破壊！ ヨシノシンがよろめいた', 'sp', 1800); else notice('バリアが消えた', 'info', 1200); break;
    case 'bhit': if (e.n < 2) notice(`バリアに命中 ${e.n}/2`, 'sp', 1300); break;
    case 'waveWarn': notice(`包囲動員：部下${e.n}体が広場の入口から来る！`, 'warn', 1800); break;
    case 'tengaiWave': if (e.n === 1) notice('天蓋乱射・三十六光！ 床の光から離れよう（3回に分けて落ちる）', 'boss', 1800); break;
    case 'gate': notice(e.n >= 3 ? '居酒屋通りの部下をすべて倒した！' : `暖簾の結界が開いた（${e.n}/3）。奥へ進もう`, 'info', 2000); break;
    case 'holdUeno': notice('上野進入待ち：車内の敵を倒すと上野に到着', 'warn', 2600); break;
    case 'heal': if (e.v > 0) dmgNum(e.x, 1.2, e.z, '+' + e.v, 'heal'); break;
    case 'down': notice(`P${e.slot + 1}が気絶した${e.slot === me ? '…' : '（まわりの円に入って4秒で救助）'}`, 'warn', 2200); if (e.slot === me && G.session.kind === 'solo') setTimeout(() => notice('仲間のカードを押すと操作を交代できます', 'info', 2600), 900); break;
    case 'ascend': notice(`P${e.slot + 1}が昇天した（この戦闘では戻らない）`, 'warn', 2400); break;
    case 'revive': notice(`P${e.slot + 1}が復活した`, '', 1400); break;
    case 'lantern': { const n = v.lan.lit.filter(Boolean).length; notice(`灯籠 ${n}/4${n < 4 ? `（残り${Math.ceil(v.lan.T)}秒）` : ''}`, '', 1600); break; }
    case 'allLit': banner('灯籠がそろった', 'トバトーバの動きが止まる！', 1800); break;
    case 'lanternFail': notice('灯籠の火が消えた（30秒以内に4基）', 'warn', 1800); break;
    case 'bossdown': banner('今だ！', '必殺技を重ねよう', 1400); break;
    case 'parry': if (e.slot === me) notice('受け流し成功！', 'sp', 1000); break;
    case 'item': if (e.slot === me) notice(DATA.ITEMS[e.it].nm + 'を使った', '', 1000); break;
    case 'pick': if (e.slot === me) notice(DATA.ITEMS[e.it].nm + 'を拾った', '', 1000); break;
    case 'candy': notice('🍬 キャンディーが出た！（取ると全回復）', 'info', 1800); break;
    case 'eatCandy': notice(e.slot === me ? '🍬 キャンディーで全回復！' : `P${e.slot + 1}がキャンディーで全回復`, '', 1400); break;
    default: akibaEvent(e, v);
  }
}
/* ---------- ダメージ数字 ---------- */
const DMG = [];
/** ダメージ数値。空きがなければ（同時に60個まで）優先度の低い・古いものから使い回す。自分の攻撃とボスへの数値は優先（敵が多い上野でも消えない） */
function dmgNum(x, y, z, v, cls, e, pri) {
  pri = pri || 0;
  const box = $('#dmgs'); let d = DMG.find(o => !o.alive);
  if (!d) {
    if (DMG.length < 60) { d = { e: el('div', 'dmg') }; box.appendChild(d.e); DMG.push(d); }
    else { let best = null; for (const o of DMG) if ((o.pri || 0) <= pri && (!best || (o.pri || 0) < (best.pri || 0) || ((o.pri || 0) === (best.pri || 0) && o.t > best.t))) best = o; if (!best) return; d = best; }
  }
  d.pri = pri; d.alive = true; d.t = 0; d.x = x + (Math.random() - 0.5) * 0.6; d.y = y; d.z = z + (Math.random() - 0.5) * 0.6; d.e.className = 'dmg ' + cls; d.e.textContent = v; d.life = cls === 'sp' ? 0.6 : 0.9;
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

/* ---------- ステージ2のHUD：路線図・撃破数・暗転・字幕 ---------- */
function trainHud(v) {
  const J = DATA.JOBAN, tr = v.tr, t = v.introWait ? 0 : v.stageT;
  // 暗転（広場→北千住のホーム）
  $('#fade').style.opacity = v.stage === 'intro' ? (t < 3.0 ? 0 : t < 3.5 ? (t - 3) / 0.5 : t < 4.0 ? 1 - (t - 3.5) / 0.5 : 0) : 0;
  if (v.stage === 'intro') {
    const C = G.cut || (G.cut = {});
    if (t > 0.3 && !C.a) { C.a = 1; banner('トバトーバを鎮めた！', 'そのころ、常磐線にヨシノシンの部下が現れたという知らせが……', 2600); }
    if (t > 4.1 && !C.b) { C.b = 1; banner('北千住駅', '常磐線 上野行きに乗りこもう', 2200); }
    if (t > 9.4 && !C.c) { C.c = 1; AUDIO.sfx('trainChime'); AUDIO.sfx('doorClose'); notice('ドアが閉まります', 'info', 1400); }
  }
  if (!tr) return;
  // 路線：北千住〜上野の5駅
  const bar = $('#rtBar');
  const at = k => `calc(9px + ${k.toFixed(4)} * (100% - 18px))`;
  if (!bar.dataset.built) { bar.dataset.built = 1; J.stations.forEach((n, i) => { const s = el('span', 'rt-s' + (i === 0 ? ' first' : i === J.stations.length - 1 ? ' last' : ''), n); s.style.left = at(i / (J.stations.length - 1)); bar.insertBefore(s, $('#rtTr')); }); }
  const L = J.segLen[Math.min(3, tr.at)], frac = tr.ph === 'stop' ? 0 : Math.max(0, Math.min(1, (L - tr.rem) / L));
  const pos = Math.min(4, tr.at + frac) / 4; $('#rtFill').style.width = `calc(${pos.toFixed(4)} * (100% - 18px))`; $('#rtTr').style.left = at(pos);
  const nx = Math.min(4, tr.at + 1);
  $('#rtNext').textContent = v.stage === 'arrive' || tr.at >= 4 ? '上野 到着' : tr.ph === 'stop' ? `${J.stations[tr.at]} 停車中` : v.hold ? '上野進入待ち（車内の敵を倒すと到着）' : tr.at === 3 && tr.rem > 300 && v.kills < v.total ? `車内の敵を倒すと上野に到着` : `次は ${J.stations[nx]}`;
  const alive = v.mobs.filter(m => m.yoshi && !m.dying).length;
  $('#rtKills').textContent = `撃破 ${v.kills}/${v.total}・車内${alive}` + (v.wait ? `・待機${v.wait}` : '') + (v.inF || v.waitF ? '・⬆前から' : '') + (v.inR || v.waitR ? '・⬇後ろから' : '');
}

/* ---------- HUD更新 ---------- */
const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function setBar(i, r) { i.style.width = Math.max(0, Math.min(1, r)) * 100 + '%'; }
function updateHud(v, dt) {
  const me = v.allies[G.my]; if (!me) return;
  // ステージ2：路線と撃破数・始まりの演出
  const jb = v.stageId === 'joban';
  $('#bossbox').classList.toggle('train', jb); $('#route').hidden = !jb;
  if (jb) trainHud(v);
  else $('#fade').style.opacity = 0;
  // ボス
  const showBoss = jb ? v.stage !== 'intro' : v.boss && (v.stage === 'boss' || v.stage === 'won' || v.stage === 'lost');
  $('#bossbox').hidden = !showBoss;
  const ue = v.stageId === 'ueno', U = v.U, sr = v.stageId === 'ueno_street';
  $('#bossbox').classList.toggle('street', sr);
  if (sr) { $('#bossbox').hidden = v.stage === 'intro'; $('#bossNm').textContent = '上野の居酒屋通り'; $('#bossSt').textContent = `撃破 ${v.kills}/${v.total}・結界 ${v.X ? v.X.gate : 0}/3`; }
  $('#ueInfo').hidden = !(ue && showBoss);
  $('#bossbox').classList.toggle('ueno', ue);
  if (showBoss && !jb) {
    const b = v.boss; setBar($('#bossFill'), b.hpR); G.lagBoss = G.lagBoss > b.hpR ? Math.max(b.hpR, G.lagBoss - dt * 0.15) : b.hpR; setBar($('#bossLag'), G.lagBoss);
    $('#bossPh').hidden = b.phase !== 2 || ue;
    $('#bossNm').textContent = ue ? 'ヨシノシン' : 'トバトーバ';
    $('#bossSt').textContent = b.st === 'sleep' ? '睡眠中・被ダメージ×2.25' : ue && U && U.pend >= 0 ? '睡眠準備' : b.st === 'down' ? 'ダウン中' : b.stun ? (ue ? 'よろめき' : '麻痺') : b.st === 'fly' ? '飛行中' : ue && U && U.sleepNear ? '睡眠チャージが近い' : b.defDown ? '守り↓' : '';
    if (ue && U) {
      $('#ueMin').textContent = `部下${U.alive}/100${U.waveWait ? `(待${U.waveWait})` : ''}・増援${Math.ceil(U.waveIn)}秒`;
      const bb = $('#ueBar'); bb.hidden = !U.barrier; if (U.barrier) { bb.textContent = `バリア ${U.bhits}/2・${Math.max(0, Math.ceil(DATA.UENO.moves.barrier.max - U.barrierT))}秒`; bb.classList.toggle('hit', U.bhits >= 1); }
      $('#ueLv').textContent = '';
    }
  }
  akibaHud(v);
  // 上野：睡眠チェックの10秒と合計ダメージ
  const sb = $('#sleepBox'), sleepOn = ue && U && U.sleep && v.stage === 'boss';
  sb.hidden = !sleepOn;
  if (sleepOn) { const S = DATA.UENO.moves.sleep, need = U.need || 1, left = Math.max(0, S.dur - U.sleepT); $('#slMsg').textContent = `10秒以内に4体合計${need.toLocaleString()}ダメージを与えろ！`; $('#slNeed').textContent = need.toLocaleString(); $('#slStage').textContent = `（${U.stage + 1}/3）`; $('#slTime').textContent = left.toFixed(1); setBar($('#slTimeFill'), left / S.dur); $('#slDmg').textContent = Math.min(99999, U.sleepDmg).toLocaleString(); setBar($('#slDmgFill'), U.sleepDmg / need); sb.classList.toggle('ok', U.sleepDmg >= need); }
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
  $('#lB').textContent = me.ctx === 'lantern' ? '灯す' : '走る';
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
    C.nmT.textContent = DATA.CHI[a.ch].nm + (a.ai && G.session.kind !== 'solo' ? '·AI' : ''); C.lvT.textContent = 'Lv' + (a.lv || 1);
    setBar(C.hpi, a.hpR); C.hp.classList.toggle('low', a.hpR < 0.3); setBar(C.spi, a.sp / 100); C.sp.classList.toggle('full', a.sp >= 100);
    C.ic.textContent = (a.strBuff ? '⚔' : '') + (a.defBuff ? '🛡' : '') + (a.stealth ? '👁' : '') + (a.taunt ? '❗' : '') + (a.sp >= 100 ? '★' : '');
    C.gt.hidden = !(a.gT > 0); if (a.gT > 0) C.gt.textContent = 'G ' + Math.ceil(a.gT); C.c.classList.toggle('gbuff', a.gT > 0); // G玉の残り秒
    C.st.hidden = a.st === 'ok'; C.st.textContent = a.st === 'down' ? `気絶 ${Math.max(0, Math.ceil(DATA.SIM.ascendTime - a.downT))}` : '昇天';
    const tgt = G.session.local.healT === i && singleHealer(me.ch); // v7：指定中はいつも枠で示す
    C.ht.hidden = !tgt; C.c.classList.toggle('tgt', tgt);
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
  { const ht = G.session && G.session.local.healT, o = ht != null && v.allies[ht]; if (o && o.st === 'ok' && singleHealer(me.ch)) put('healMk', o.x, 0.05, o.z, () => ({ e: el('div', 'healmk', '✚') }), () => 0); } // v7：回復対象の足もとに緑の印
  v.allies.forEach((a, i) => {
    const h = DATA.CHI[a.ch].h;
    put('a' + i, a.x, a.st === 'ok' ? h * 1.25 + 0.2 : 0.8, a.z, () => { const e = el('div', 'label3d'); const pn = el('span', 'pn', 'P' + (i + 1)); pn.style.background = pcol(i); const hp = el('div', 'mini hp'); const hi = el('i'); hp.appendChild(hi); const dt = el('span', 'downt'); const pg = el('div', 'prog'); const pgi = el('i'); pg.appendChild(pgi); e.append(dt, pg, pn, hp); return { e, hi, hp, dt, pg, pgi }; },
      o => { setBar(o.hi, a.hpR); o.hp.style.display = i === G.my || a.st !== 'ok' ? 'none' : ''; o.dt.style.display = a.st === 'down' ? '' : 'none'; o.dt.textContent = a.st === 'down' ? '気絶 ' + Math.max(0, Math.ceil(DATA.SIM.ascendTime - a.downT)) : '';
        const rv = a.st === 'down' && a.revP > 0; o.pg.style.display = rv || a.lanHold ? '' : 'none'; if (rv) setBar(o.pgi, a.revP); else if (a.lanHold) setBar(o.pgi, a.lanP); o.e.style.opacity = a.st === 'gone' ? 0.4 : 1; });
    if (i !== G.my && a.st !== 'gone') edge('a' + i, a.x, 0.5, a.z, a.st === 'down' ? '#ff5a3a' : pcol(i), 'P' + (i + 1));
  });
  for (const mo of v.mobs) {
    if (mo.dying) continue; const d = Math.hypot(mo.x - me.x, mo.z - me.z); if (d > 16 && G.lock !== mo.id) continue;
    put('m' + mo.id, mo.x, mo.akiba && DATA.AKIBA.foes[mo.kind] ? DATA.AKIBA.foes[mo.kind].h * (DATA.AKIBA.foes[mo.kind].scale || 1) + 0.3 : 1.15, mo.z, () => { const e = el('div', 'label3d'); const hp = el('div', 'mini hp'); hp.style.width = '34px'; const hi = el('i'); hi.style.background = '#ff6a5a'; hp.appendChild(hi); e.appendChild(hp); return { e, hi }; }, o => setBar(o.hi, mo.hpR));
  }
  // 天蓋乱射の着弾順の数字はv6で表示しない（床の予兆・攻撃は同じ）
  for (const ob of v.orbs || []) if (ob.life <= 3) put('ob' + ob.id, ob.x, 0.9, ob.z, () => ({ e: el('div', 'orbt') }), o => { o.e.textContent = Math.ceil(ob.life) + '秒'; });
  if (v.boss && (v.stage === 'boss') && v.boss.st !== 'dead') edge('boss', v.boss.x, v.boss.y + 2, v.boss.z, '#cb4b46', v.boss.st === 'fly' ? '飛行' : 'ボス');
  // 注目のレティクル
  let tgt = null; if (G.lock === 'boss' && v.boss) tgt = { x: v.boss.x, y: v.boss.y + 2.6, z: v.boss.z }; else if (G.lock) { const mo = v.mobs.find(q => q.id === G.lock); if (mo) tgt = { x: mo.x, y: 0.6, z: mo.z }; else G.lock = null; }
  if (G.lock === 'boss' && v.boss && !['idle', 'walk', 'wind', 'act', 'rec', 'down', 'stun', 'sleep'].includes(v.boss.st)) { G.lock = null; tgt = null; }
  if (!G.lock && G.relockWanted && v.boss && v.boss.st !== 'fly' && v.stage === 'boss') { G.lock = 'boss'; G.relockWanted = false; }
  if (tgt) {
    const lk = G.lock === 'boss' ? v.boss : v.mobs.find(q => q.id === G.lock), rr = G.lock === 'boss' ? 1.4 : 0.4;
    const inR = lk && Math.hypot(lk.x - me.x, lk.z - me.z) - rr <= DATA.SIM.homeRange, ranged = hasRanged(me.ch);
    put('ret', tgt.x, tgt.y, tgt.z, () => { const e = el('div', 'reticle-w'), ring = el('div', 'reticle'), tag = el('span', 'tag'); e.append(ring, tag); return { e, tag }; },
      o => { const st = !ranged ? '' : inR ? 'home' : 'far'; if (o.st !== st) { o.st = st; o.e.className = 'reticle-w ' + st; o.tag.textContent = st === 'home' ? '追尾' : st === 'far' ? '遠い' : ''; o.tag.style.display = st ? '' : 'none'; } });
  }
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
  if (v.stageId === 'joban') return drawTrainMap(v, g, W, H);
  if (v.stageId === 'ueno') return drawUenoMap(v, g, W, H);
  if (v.stageId === 'ueno_street') return drawStreetMap(v, g, W, H);
  if (v.stageId && v.stageId.startsWith('akiba') && typeof drawAkibaMap === 'function') return drawAkibaMap(v, g, W, H);
  const big = $('#map').classList.contains('big');
  const me = v.allies[G.my];
  const inPlaza = v.stage !== 'street';
  const ST = DATA.STAGE, PW = ST.plazaHalfW, PZ = ST.plazaZ1, FB = DATA.BMOVES.junkou.outer;
  const view = inPlaza ? { x0: -PW - FB - 0.5, x1: PW + FB + 0.5, z0: -3, z1: PZ + FB + 0.5 } : { x0: -12, x1: 12, z0: Math.min(-36, me.z - 18), z1: Math.min(6, me.z + 22) };
  if (big) Object.assign(view, { x0: -PW - 4, x1: PW + 4, z0: -66, z1: PZ + 6 });
  const sc = Math.min(W / (view.x1 - view.x0), H / (view.z1 - view.z0));
  const ox = W / 2, oz = H / 2, cxw = (view.x0 + view.x1) / 2, czw = (view.z0 + view.z1) / 2;
  const P = (x, z) => [ox - (x - cxw) * sc, oz - (z - czw) * sc];
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#5b5d70'; let [a1, b1] = P(9.4, 0), [a2, b2] = P(-9.4, -66); g.fillRect(Math.min(a1, a2), Math.min(b1, b2), Math.abs(a2 - a1), Math.abs(b2 - b1));
  g.fillStyle = '#7b6f66'; [a1, b1] = P(PW, PZ); [a2, b2] = P(-PW, 0); g.fillRect(Math.min(a1, a2), Math.min(b1, b2), Math.abs(a2 - a1), Math.abs(b2 - b1));
  if (v.barrier !== 'none') { g.strokeStyle = v.barrier === 'plaza' ? '#d9c08a' : '#ff6a4a'; g.lineWidth = 3; [a1, b1] = P(9.4, 0); [a2, b2] = P(-9.4, 0); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
  if (v.stage === 'street' && v.barrier === 'none') { const [dx, dz] = P(0, 3); g.fillStyle = '#ffe27a'; g.fillRect(dx - 6, dz - 9, 12, 14); g.fillStyle = '#5b3a1a'; g.fillRect(dx - 3, dz - 4, 6, 9); }
  const fs = Math.max(10, Math.round(W / 9));
  g.font = `900 ${fs}px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  // 予兆
  for (const h of v.hz) { if (h.kind === 'circle') { const [x, z] = P(h.x, h.z); g.strokeStyle = 'rgba(255,110,60,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(x, z, Math.max(3, h.a * sc), 0, 7); g.stroke(); } if (h.kind === 'path') { const [x0, z0] = P(h.x, h.z), [x1, z1] = P(h.x + Math.sin(h.yaw) * h.a, h.z + Math.cos(h.yaw) * h.a); g.strokeStyle = 'rgba(255,90,200,.75)'; g.lineWidth = Math.max(4, h.b * sc); g.beginPath(); g.moveTo(x0, z0); g.lineTo(x1, z1); g.stroke(); } }
  // 灯籠
  DATA.STAGE.lanterns.forEach(([x, z], i) => { const [px, pz] = P(x, z); g.fillStyle = v.lan.lit[i] ? '#ffd070' : v.lan.cool > 0 ? '#666' : '#c9b48a'; g.fillRect(px - 7, pz - 7, 14, 14); g.fillStyle = '#1b1838'; g.fillText(v.lan.lit[i] ? '✓' : String(i + 1), px, pz + 1); });
  for (const p of v.pickups) { const [x, z] = P(p.x, p.z); if (p.kind === 'candy') { g.fillStyle = '#ff5fa8'; g.beginPath(); g.arc(x, z, 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); continue; } g.fillStyle = p.kind === 'food' ? '#fff' : '#d07aa0'; g.beginPath(); g.arc(x, z, 3.5, 0, 7); g.fill(); }
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

/** 居酒屋通りのミニマップ：細長い通り。上が奥 */
function drawStreetMap(v, g, W, H) {
  const D = DATA.STREET, me = v.allies[G.my], span = 26, z0 = Math.max(0, Math.min(D.zMax - span, me.z - 8)), sc = H / span;
  const P = (x, z) => [W / 2 - x * sc, H - (z - z0) * sc];
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
  let [a1] = P(D.halfX, 0), [a2] = P(-D.halfX, 0); g.fillStyle = '#5a5060'; g.fillRect(Math.min(a1, a2), 0, Math.abs(a2 - a1), H);
  const gate = v.X ? v.X.gate : 0; D.gates.forEach((gz, i) => { if (i < gate) return; const [, y] = P(0, gz); g.fillStyle = '#b06aff'; g.fillRect(Math.min(a1, a2), y - 2, Math.abs(a2 - a1), 4); });
  for (const m of v.mobs) { if (m.dying) continue; const [x, z] = P(m.x, m.z); if (z < -4 || z > H + 4) continue; g.fillStyle = m.kind === 'beam' ? '#c8ff6a' : '#ff5a4a'; g.beginPath(); g.arc(x, z, 3, 0, 7); g.fill(); }
  v.allies.forEach((a, i) => { if (a.st === 'gone') return; const [x, z] = P(a.x, a.z); g.fillStyle = i === G.my ? '#fff' : pcol(i); g.beginPath(); g.arc(x, z, i === G.my ? 5.5 : 4.5, 0, 7); g.fill(); });
}
/** 上野のミニマップ：広場（34m×28m）。上が奥（駅舎） */
function drawUenoMap(v, g, W, H) {
  const D = DATA.UENO, me = v.allies[G.my], sc = Math.min(W / (D.halfX * 2 + 2), H / (D.zMax + 2));
  const P = (x, z) => [W / 2 - x * sc, H / 2 - (z - D.zMax / 2) * sc];
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
  let [a1, b1] = P(D.halfX, D.zMax), [a2, b2] = P(-D.halfX, 0); g.fillStyle = '#8a4a38'; g.fillRect(Math.min(a1, a2), Math.min(b1, b2), Math.abs(a2 - a1), Math.abs(b2 - b1));
  g.fillStyle = '#d9cbb4'; g.fillRect(Math.min(a1, a2), Math.min(b1, b2) - 4, Math.abs(a2 - a1), 4);
  const fs = Math.max(10, Math.round(W / 10)); g.font = `900 ${fs}px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const h of v.hz) if (h.kind === 'circle') { const [x, z] = P(h.x, h.z); g.strokeStyle = h.fx === 'warp' ? 'rgba(190,150,255,.9)' : 'rgba(255,110,60,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(x, z, Math.max(2.5, h.a * sc), 0, 7); g.stroke(); }
  for (const p of v.pickups) { const [x, z] = P(p.x, p.z); g.fillStyle = p.kind === 'candy' ? '#ff5fa8' : '#d07aa0'; g.beginPath(); g.arc(x, z, p.kind === 'candy' ? 5 : 3, 0, 7); g.fill(); }
  for (const m of v.mobs) { if (m.dying) continue; const [x, z] = P(m.x, m.z); g.fillStyle = m.kind === 'beam' ? '#c8ff6a' : m.air ? '#ffb0e0' : '#ff5a4a'; g.beginPath(); g.arc(x, z, 2.6, 0, 7); g.fill(); }
  if (v.boss && v.boss.st !== 'hidden') { const b = v.boss, [x, z] = P(b.x, b.z); g.fillStyle = v.U && v.U.barrier ? '#6ab8ff' : '#7a4ac8'; g.beginPath(); g.arc(x, z, 8, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.fillText('ボ', x, z + 1); }
  v.allies.forEach((a, i) => {
    if (a.st === 'gone') return; const [x, z] = P(a.x, a.z);
    if (i === G.my) { g.save(); g.translate(x, z); g.rotate(-a.yaw); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.fill(); g.restore(); }
    else { g.fillStyle = pcol(i); g.beginPath(); g.arc(x, z, 6, 0, 7); g.fill(); }
    if (a.st === 'down') { g.strokeStyle = '#7dffb0'; g.lineWidth = 2; g.beginPath(); g.arc(x, z, 9, 0, 7); g.stroke(); }
  });
}

/** 車内のミニマップ：左が3号車（後ろ）、右が2号車（前・上野方面）。右端から部下が来る */
function drawTrainMap(v, g, W, H) {
  const J = DATA.JOBAN, me = v.allies[G.my];
  const zx = z => W * 0.04 + (z - (J.zMin - 0.4)) / (J.zMax - J.zMin + 0.8) * W * 0.92, xy = x => H * 0.5 + x / (J.halfW + 0.45) * H * 0.27;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
  const fs = Math.max(10, Math.round(W / 11)); g.font = `900 ${fs}px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [z0, z1, nm] of [[-21, -1, '3号車'], [1, 21, '2号車']]) { g.fillStyle = '#4a5468'; g.fillRect(zx(z0), xy(-J.halfW - 0.45), zx(z1) - zx(z0), xy(J.halfW + 0.45) - xy(-J.halfW - 0.45)); g.fillStyle = '#2c58a8'; g.fillRect(zx(z0), xy(-J.halfW - 0.45), zx(z1) - zx(z0), H * 0.04); g.fillRect(zx(z0), xy(J.halfW + 0.45) - H * 0.04, zx(z1) - zx(z0), H * 0.04); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(nm, (zx(z0) + zx(z1)) / 2, H * 0.12); }
  g.fillStyle = '#4a5468'; g.fillRect(zx(-1), xy(-J.gwHalfW), zx(1) - zx(-1), xy(J.gwHalfW) - xy(-J.gwHalfW));
  g.fillStyle = '#ff6a4a'; g.fillRect(zx(21) - 2, xy(-0.6), 5, xy(0.6) - xy(-0.6)); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('1号車', zx(21) - fs * 0.2, H * 0.9);
  if (v.tr && v.tr.doors === 1) { g.fillStyle = '#ffd23a'; for (const z of J.carDoors) g.fillRect(zx(z) - 4, xy(-J.halfW - 0.45) - 2, 8, 4); }
  for (const h of v.hz) if (h.fx === 'ybeam') { const [x0, z0] = [h.x, h.z], x1 = h.x + Math.sin(h.yaw) * h.a, z1 = h.z + Math.cos(h.yaw) * h.a; g.strokeStyle = 'rgba(200,255,120,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(zx(z0), xy(x0)); g.lineTo(zx(z1), xy(x1)); g.stroke(); }
  for (const p of v.pickups) { g.fillStyle = p.kind === 'candy' ? '#ff5fa8' : '#d07aa0'; g.beginPath(); g.arc(zx(p.z), xy(p.x), p.kind === 'candy' ? 5 : 3.5, 0, 7); g.fill(); }
  for (const m of v.mobs) { if (m.dying) continue; g.fillStyle = m.kind === 'beam' ? '#c8ff6a' : '#ff5a4a'; g.beginPath(); g.arc(zx(m.z), xy(m.x), 3.6, 0, 7); g.fill(); }
  v.allies.forEach((a, i) => { if (a.st === 'gone') return; const x = zx(a.z), y = xy(a.x); g.fillStyle = i === G.my ? '#fff' : pcol(i); g.beginPath(); g.arc(x, y, i === G.my ? 6.5 : 5.5, 0, 7); g.fill(); if (a.st === 'down') { g.strokeStyle = '#7dffb0'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); } g.fillStyle = i === G.my ? '#1b1838' : '#fff'; g.font = `900 ${Math.round(fs * 0.75)}px ${GFX.FONT_UI}`; g.fillText(String(i + 1), x, y + 1); g.font = `900 ${fs}px ${GFX.FONT_UI}`; });
}

/* ---------- 結果 ---------- */
function showResult(v) {
  if (G.resultShown) return; G.resultShown = true; G.mode = 'result';
  const S = G.session, win = v.result && v.result.win, st = v.stageId || 'senju';
  const jb = st === 'joban', ue = st === 'ueno', sr = st === 'ueno_street', ak = st.startsWith('akiba'), firstClear = win && !cleared(st);
  const res = checkpoint(v, true, '戦いが終わった');
  if (win) G.sessClear[st] = true;
  const T = { senju: ['トバトーバを鎮めた！', '北千住（トバトーバ）'], joban: ['上野に到着！', '常磐線（北千住→上野）'], ueno_street: ['居酒屋通りを突破！', '上野の居酒屋通り'], ueno: ['ヨシノシンを鎮めた！', '上野駅前（ヨシノシン）'], akiba_platform: ['ホームの2人を倒した！', '秋葉原駅ホーム（オガ・カエ）'], akiba_plaza: ['星と中を鎮めた！', '秋葉原駅前広場（星・中）'] }[st];
  $('#resEyebrow').textContent = win ? (jb ? '電車クリア' : '勝利') : '敗北'; $('#resTitle').textContent = win ? T[0] : (v.result && v.result.why === 'time' ? '時間切れ…' : '全員が戦闘不能…');
  const kv = $('#resKv'); kv.textContent = '';
  const rows = [['ステージ', T[1]], ['かかった時間', fmt(v.result ? v.result.time : 0)], ['モード', S.kind === 'solo' ? 'ソロ（AI3体）' : `協力プレイ（${v.H || 1}人）`]];
  if (jb || ue || sr) rows.splice(2, 0, ['倒した部下', ue ? `${v.kills}体` : `${v.kills} / ${v.total}`]);
  for (const [k, val] of rows) { kv.appendChild(el('b', '', k)); kv.appendChild(el('span', '', val)); }
  const grid = $('#resGrid'); grid.textContent = '';
  const stats = S.sim ? S.sim.allies.map(a => a.stats) : null;
  v.allies.forEach((a, i) => { const c = el('div', 'res-c'); const pn = el('span', 'pn', 'P' + (i + 1)); pn.style.background = pcol(i); const im = el('img'); im.src = G.thumbs[a.ch] || ''; im.alt = ''; c.append(pn, im, el('b', '', DATA.CHI[a.ch].nm), el('span', 'lv', 'Lv.' + (a.lv || 1))); if (stats) { c.appendChild(el('span', '', `与えたダメージ ${stats[i].dmg}`)); c.appendChild(el('span', '', `救助 ${stats[i].revives}・必殺 ${stats[i].specials}`)); } c.appendChild(el('span', 'small', a.st === 'ok' ? '元気' : a.st === 'down' ? '気絶' : '昇天')); grid.appendChild(c); });
  renderResExp(res);
  let msg = '';
  if (st === 'senju') msg = win ? (firstClear ? '🔓 上野編「常磐線」が解放された！（推奨Lv' + DATA.LV_BASE.joban + '）' : '') : 'もう一度挑戦できます。灯籠で動きを止めて、必殺技を重ねるのがコツ。';
  else if (jb) msg = win ? (res && res.unlocked === 'ueno_street' ? '🔓 上野の居酒屋通りと、装備の2枠目が解放された！　電車の報酬は確定しました。' : '電車の報酬は確定しました。') : 'もう一度挑戦できます。前後から来るので、救助の円とキャンディーを使おう。';
  else if (sr) msg = win ? (res && res.unlocked === 'ueno' ? '🔓 上野駅前のヨシノシン戦が解放された！（推奨Lv' + DATA.LV_BASE.ueno + '）　通りの報酬は確定しました。' : '通りの報酬は確定しました。') : 'もう一度挑戦できます。';
  else if (ue) msg = win ? (res && res.unlocked === 'akiba_platform' ? '🔓 秋葉原編が解放された！（推奨Lv' + DATA.LV_BASE.akiba_platform + '）' : 'ヨシノシンを鎮めた！') : 'ボスから再挑戦できます（電車と通りをやり直す必要はありません）。';
  else if (st === 'akiba_platform') msg = win ? '🔓 秋葉原駅前広場が解放された！　ホームの報酬は確定しました。' : 'もう一度挑戦できます。前方の攻撃をよけて背後へ回ろう。';
  else msg = win ? '星と中を鎮めた！　秋葉原編クリア！' : 'ボスから再挑戦できます（ホームをやり直す必要はありません）。星と中は、片方を倒してから15秒以内にもう片方も。';
  $('#resReward').textContent = msg;
  const host = S.kind !== 'client';
  // 次へ進むボタン：電車→居酒屋通り→ボスの準備→秋葉原（徒歩の演出）→駅前広場の準備
  G.next = G.coop ? null : !win ? null : jb ? 'street' : sr ? 'prep' : ue ? 'akiba' : st === 'akiba_platform' ? 'prepAkiba' : null;
  G.nextPrep = G.next === 'prep';
  G.carry = G.next === 'street' ? v.allies.map(a => a.items.map(i => i.n)) : null; // 電車から通りへ続けるときだけ所持数を引き継ぐ（無限に増やさない）
  $('#btnRetry').hidden = !host; $('#btnReteam').hidden = !host && G.coop;
  $('#btnRetry').textContent = G.coop ? 'ロビーへ戻る' : { street: '居酒屋通りへ進む', prep: '上野ボスの準備へ', akiba: '秋葉原へ進む', prepAkiba: '駅前広場の準備へ' }[G.next] || ((ue || st === 'akiba_plaza') && !win ? 'ボスから再挑戦' : '再出動');
  $('#btnResGacha').hidden = !(res && res.ticket > 0) && !((G.acct || G.guest).tickets > 0);
  if (!host) $('#resReward').textContent += '　ホストがロビーへ戻ると次の戦いを始められます。';
  refreshResSave();
  $('#hud').hidden = true; show('result');
}
/** 協力プレイの接続失敗・切断の表示（理由を開発用ログにも残す） */
function netFail(title, msg, code) {
  NETLIB.log('ui', `表示：${title}（${code}）`);
  if (G.session && G.session.kind !== 'solo') { try { G.session.leave(); } catch (e) { } G.session = null; G.coop = false; } // v8：失敗した部屋を片付けて、同じ合言葉でもう一度入り直せるように
  joinWait(false);
  $('#lostTitle').textContent = title; $('#lostMsg').textContent = msg; G.mode = 'lost'; show('netlost');
  if (typeof frNetFail === 'function') frNetFail(code);
}
/* 開発者向け：?debug=net で接続の経過を画面の隅に出す */
if (/[?&]debug=net/.test(location.search)) {
  const box = document.createElement('div'); box.id = 'netDbg';
  box.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99;max-width:min(96vw,520px);max-height:40vh;overflow:auto;background:rgba(0,0,0,.78);color:#9f9;font:11px/1.35 monospace;padding:4px 6px;border-radius:6px;pointer-events:auto;white-space:pre-wrap';
  document.body.appendChild(box);
  const draw = () => { const S = G.session; box.textContent = `状態: ${S ? S.kind + ' ' + (S.state || '') + (S.code ? ' #' + S.code : '') : 'なし'}\n` + NETLIB.LOG.slice(-14).map(e => `${e.t.toFixed(1)} ${e.tag} ${e.msg}`).join('\n'); };
  NETLIB.onLog(draw); setInterval(draw, 1000);
}
/* 画面を裏にしていた時間は、通信の無応答に数えない（戻った直後に切れないように） */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = performance.now(); NETLIB.log('ui', '画面が裏へ'); return; }
  if (!hiddenAt) return; const ms = performance.now() - hiddenAt; hiddenAt = 0; NETLIB.log('ui', `画面へ戻る（${(ms / 1000).toFixed(1)}秒）`);
  const S = G.session; if (S && S.resume) S.resume(ms);
});
/* ---------- メインループ ---------- */
let last = performance.now();
/* v8：画面が裏に回って描画ループが止まっても、協力のロビーの送受信（あいさつ・一覧・生存確認）は続ける。ブラウザが許す間隔（裏では約1秒）で動く。戦闘中は止めない（描画側で進める） */
let lastFrameAt = 0;
setInterval(() => { const S = G.session; if (!S || S.kind === 'solo' || G.mode === 'play' || G.mode === 'pause') return; if (performance.now() - lastFrameAt < 400) return; try { S.update(0.25); } catch (e) { console.error(e); } }, 500);
function frame(ts) {
  lastFrameAt = performance.now();
  const dtRaw = Math.min(0.25, Math.max(0, (ts - last) / 1000)), dt = Math.min(0.1, dtRaw); last = ts; G.T += dt;
  const S = G.session;
  try {
    if (S && (S.kind !== 'solo' || G.mode === 'play' || G.mode === 'pause' || G.mode === 'result' || G.mode === 'lobby')) { // v8：協力のセッションはどの画面でも更新し続ける（メニュー・フレンド画面・入室待ちの間もロビーを送受信）
      if (G.mode === 'play') applyInput();
      S.update(dtRaw);
      if (S.notices && S.notices.length) for (const n of S.notices.splice(0)) { if (G.mode === 'play') notice(n.s, 'info', 3000); else mtoast(n.s, 2400); } // 参加・通信の途切れ・復帰
      if (S.kind === 'client') {
        if (S.rejected) { const why = { version: '版が違います。両方の端末でページを再読み込みしてください。', started: 'すでに戦闘が始まっています。終わってロビーに戻ってから、もう一度招待してもらってください。', full: '部屋が満員です（4人まで）。' }[S.rejected] || '入れませんでした。'; netFail('部屋に入れませんでした', why, S.rejected); S.rejected = null; }
        else if (S.lost) {
          const L = S.lost, started = !!S.started;
          const msg = { no_peer: [`ホストが見つかりませんでした（${DATA.NET.connectTimeout}秒）`, 'ホストが部屋を閉じたか、合言葉がちがう可能性があります。招待をもう一度送ってもらうか、合言葉を確認してください。片方の端末が古い版のままだと見つかりません。両方の端末でページを再読み込みしてから、もう一度ためしてください（通信の版 ' + NETLIB.VERSION + '）。'],
            no_ack: ['入室が確定しませんでした', 'ホストとはつながりましたが、参加の受け付けが返ってきませんでした。ホストの画面を開いたまま、もう一度「参加」を押してください。'],
            no_lobby: ['ホストとつながりませんでした', 'ホストは見つかりましたが、通信がつながりませんでした。両方の電波を確認して、もう一度ためしてください。'],
            p2p_failed: ['ホストと直接つながりませんでした', '回線の組み合わせ（モバイル回線・学校や会社のWi-Fiなど）によっては直接の通信ができません。同じWi-Fiでためすか、別の回線でもう一度。'],
            timeout: ['ホストとの接続が切れました', `通信が${DATA.NET.dropT}秒以上とだえたため${started ? '戦闘を' : ''}中断しました。電波のよい所でもう一度入ってください。`],
            host_left: ['ホストが部屋を閉じました', started ? '戦闘は中断されました。' : 'もう一度招待してもらってください。'] }[L] || ['ホストとの接続が切れました', ''];
          S.lost = null; netFail(msg[0], msg[1], L);
        }
        else if (G.joinWaiting) { joinWaitTick(S); if (S.joined) { joinWait(false); openLobby(); mtoast(`P${S.mySlot + 1}で参加しました（${(S.lobby.slots || []).filter(Boolean).length}人）`, 2400); if (S.started) enterGame(); } }
        else if (G.mode === 'lobby' && S.started && S.mySlot >= 0) enterGame();
        else if ((G.mode === 'result' || G.mode === 'play') && S.lobby && S.lobby.phase === 'lobby' && G.resultShown) { openLobby(); }
      }
      if (G.mode === 'lobby') { G.lobT = (G.lobT || 0) + dt; if (G.lobT > 0.5) { G.lobT = 0; if (!$('#title').hidden) renderHome(); } }
      G.my = S.kind === 'client' ? Math.max(0, S.mySlot) : S.mySlot;
      const v = (G.mode === 'play' || G.mode === 'pause' || G.mode === 'result') ? S.view() : null;
      if (v) {
        G.v = v;
        if (G.snapNext) { R.snapCam(v, G.my); G.snapNext = false; }
        R.sync(v, dt, G.T, G.my);
        const evs = R.events(v, G.my); for (const e of evs) onEvent(e, v);
        R.updateCamera(v, G.my, dt, S.local, gameArea());
        $('#hud').classList.toggle('intro', v.stage === 'intro'); $('#hud').classList.toggle('cine', (v.stage === 'intro' && v.stageId === 'joban') || R.outroT(v) > 1.2);
        if (G.mode === 'play') { updateHud(v, dt); G.mapT = (G.mapT || 0) + dt; if (G.mapT > 0.05) { G.mapT = 0; drawMap(v); } }
        stepDmg(dt);
        if ((v.stage === 'won' || v.stage === 'lost') && v.stageT > (v.stage === 'won' ? 3.4 : 2.6) && G.mode === 'play') showResult(v);
      }
    } else if (G.mode === 'walk') { let end = true; try { end = WALK.step(dt, G.T); } catch (e) { console.error(e); } if (end) finishWalk(false); }
    else if (!LOBBY3D.active()) { if (G.mode !== 'play' && G.mode !== 'boot') LOBBY3D.show('bg', []); else titleCam(G.T); } // v7 P4-3/P5：メニュー・ログインの後ろはいつも動く夜祭り（青い止まった画面にしない）
    if (LOBBY3D.active() && G.mode !== 'play') { LOBBY3D.update(dt, G.T); lobbyTick(); }
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
