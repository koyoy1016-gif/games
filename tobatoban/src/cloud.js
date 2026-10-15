/* =====================================================================
   cloud.js — Firebase（Authentication＋Firestore）でのアカウントとセーブ
   ・IDは全員で通しの番号（1〜10000）。サーバーの「次の番号」を1つずつ進めて割り当てる
   ・パスワードの確認は Firebase Authentication が行う（ID n ↔ p{n}@tobatoban.game）
   ・セーブは saves/{uid} に本人だけが読み書きできる（firestore.rules）
   ・ログインはページを開いている間だけ（閉じたら次はまたログイン）
   FIREBASE_CONFIG が空のとき、または claude.ai の中では使わず、端末内のセーブ（save.js）になる。
   ===================================================================== */
// Firebaseコンソール「マイアプリ」の firebaseConfig（公開してよい値。守りはルールとパスワード）
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDSXGsbja8gKmLdHyiciIgO7OEDTs6jrVQ',
  authDomain: 'tobatoban-35633.firebaseapp.com',
  projectId: 'tobatoban-35633',
  storageBucket: 'tobatoban-35633.firebasestorage.app',
  messagingSenderId: '563921197497',
  appId: '1:563921197497:web:44baf8d2600afe291d3e68',
};
const CLOUD = (() => {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const email = id => `p${id}@tobatoban.game`;
  let L = null, auth = null, db = null, user = null, initP = null, ARGS = null;
  /** SDKを読み込んで準備する。2回目からは最初の設定を使う。libs・opt は検査用 */
  function init(cfg, libs, opt) {
    if (initP) return initP;
    if (cfg) ARGS = { cfg, libs, opt }; if (!ARGS) return Promise.reject(new Error('no config'));
    ({ cfg, libs, opt } = ARGS);
    initP = (async () => {
      L = libs || await (async () => { const [app, au, fs] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]); return { app, au, fs }; })();
      if (opt && opt.fs) L = Object.assign({}, L, { fs: opt.fs });
      const app = L.app.getApps().find(a => a.name === 'tobatoban') || L.app.initializeApp(cfg, 'tobatoban');
      try { auth = L.au.initializeAuth(app, { persistence: L.au.inMemoryPersistence }); } catch (e) { auth = L.au.getAuth(app); } // ページを閉じたらログアウト
      db = (opt && opt.db) || L.fs.getFirestore(app);
      if (opt && opt.authEmulator) L.au.connectAuthEmulator(auth, opt.authEmulator, { disableWarnings: true });
      return true;
    })();
    initP.catch(() => { initP = null; }); // 読み込みに失敗したら、次の操作でもう一度ためす
    return initP;
  }
  function errMsg(e) {
    const c = (e && (e.code || e.message)) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|INVALID_LOGIN/.test(c)) return 'IDかパスワードがちがいます';
    if (/too-many-requests/.test(c)) return 'まちがいが続いたので、しばらく待ってからためしてください';
    if (/network-request-failed|unavailable|Failed to fetch|failed-precondition|deadline/.test(c)) return 'サーバーとつながりませんでした。電波のよい所でもう一度ためしてください';
    if (/weak-password/.test(c)) return 'パスワードは6文字以上にしてください';
    if (/api-key-not-valid|invalid-api-key|API key not valid/.test(c)) return 'サーバーの設定（apiKey）がちがいます。管理者に知らせてください';
    if (/configuration-not-found|operation-not-allowed|admin-restricted/.test(c)) return 'サーバーの準備がまだです（Authenticationで「メール/パスワード」と「匿名」を有効にしてください）';
    if (/permission-denied|PERMISSION_DENIED/.test(c)) return 'サーバーの設定（Firestoreのルール）を確認してください';
    if (/full/.test(c)) return `アカウントがいっぱいです（${SAVE.ID_MAX}人まで）`;
    if (/import|Failed to load|dynamically imported/i.test(c)) return 'サーバーの部品を読み込めませんでした。電波のよい所でもう一度ためしてください';
    return 'うまくいきませんでした（' + String(c).slice(0, 60) + '）';
  }
  /** Firestore に入れられる形にする（パスワードのハッシュは持たない） */
  function toDoc(s) { const o = JSON.parse(JSON.stringify(s)); delete o.pw; return o; }
  async function loadSave(id) {
    const ref = L.fs.doc(db, 'saves', user.uid), snap = await L.fs.getDoc(ref);
    if (snap.exists()) { const s = SAVE.normalize(Object.assign({}, snap.data(), { id, pw: '' })); return s; }
    const s = SAVE.fresh(id, ''); await L.fs.setDoc(ref, toDoc(s)); return s; // 作る途中で止まった場合の補い
  }
  /** アカウントを作る：番号を1つ進めて自分のものにし、そのIDにパスワードを付ける */
  async function register(pw, pw2) {
    const e = SAVE.checkPw(pw); if (e) return { ok: false, msg: e };
    if (pw !== pw2) return { ok: false, msg: '2回入れたパスワードが同じではありません' };
    try {
      await init();
      if (auth.currentUser) await L.au.signOut(auth);
      const anon = (await L.au.signInAnonymously(auth)).user;
      const id = await L.fs.runTransaction(db, async tx => {
        const cRef = L.fs.doc(db, 'meta', 'counter'), c = await tx.get(cRef);
        const n = c.exists() ? c.data().next : 1;
        if (!(n >= 1) || n > SAVE.ID_MAX) throw Object.assign(new Error('full'), { code: 'full' });
        tx.set(cRef, { next: n + 1 });
        tx.set(L.fs.doc(db, 'ids', String(n)), { uid: anon.uid });
        return n;
      });
      user = (await L.au.linkWithCredential(anon, L.au.EmailAuthProvider.credential(email(id), pw))).user;
      const s = SAVE.fresh(id, ''); await L.fs.setDoc(L.fs.doc(db, 'saves', user.uid), toDoc(s));
      await FR.ensure(s); // フレンドコード（失敗してもアカウントは使える）
      return { ok: true, id, save: s, msg: `アカウントを作りました。あなたのIDは ${id} です` };
    } catch (err) { console.warn('register', err); try { if (auth && auth.currentUser && auth.currentUser.isAnonymous) await L.au.signOut(auth); } catch (e2) { } user = null; return { ok: false, msg: errMsg(err) }; }
  }
  async function login(id, pw) {
    if (!SAVE.validId(id)) return { ok: false, msg: `IDは${SAVE.ID_MIN}〜${SAVE.ID_MAX}の番号です` };
    if (!pw) return { ok: false, msg: 'パスワードを入れてください' };
    try {
      await init();
      user = (await L.au.signInWithEmailAndPassword(auth, email(id), pw)).user;
      const s = await loadSave(id); await FR.ensure(s);
      return { ok: true, save: s, msg: `ID ${id} でログインしました` };
    } catch (err) { console.warn('login', err); user = null; return { ok: false, msg: errMsg(err) }; }
  }
  async function write(s) {
    if (!user) return false;
    try { s.saved = Date.now(); await L.fs.setDoc(L.fs.doc(db, 'saves', user.uid), toDoc(s)); return true; } catch (err) { console.warn('save', err); return false; }
  }
  async function logout() { try { if (user) await Promise.race([FR.offline(), new Promise(r => setTimeout(r, 1500))]); } catch (e) { } user = null; FR.reset(); try { if (auth) await L.au.signOut(auth); } catch (e) { } }

  /* ---------- フレンド ----------
     ・フレンドコード：アカウントごとのランダムな8文字（ログインIDとは別。IDはパスワードと組のログイン情報で、連番なので推測されやすい）
       codes/{コード} → { uid, nm, ch, lv }（コードを知っている人だけが1件ずつ引ける。一覧は取れない）
     ・profiles/{uid}：なまえ・先頭キャラ・最後に見えた時刻・募集中のルーム。読めるのは本人とフレンドだけ
     ・friends/{uidA_uidB}：申請（req）→ 相手が承認（ok）。どちらからでも削除できる。招待（inv）もここに書く */
  const FR = (() => {
    const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 0/O・1/I/L のように見まちがえる字は使わない
    const MAX = 50, ONLINE = 300e3, INV = 300e3; // オンライン＝5分以内に知らせがあった。招待は5分有効
    let code = '', card = '', ok = null, last = null, closing = false;
    const norm = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fmt = c => c ? c.slice(0, 4) + '-' + c.slice(4) : '';
    const valid = c => c.length === 8 && [...c].every(ch => ABC.includes(ch));
    const gen = () => { let s = ''; const r = new Uint32Array(8); (globalThis.crypto && crypto.getRandomValues) ? crypto.getRandomValues(r) : r.forEach((_, i) => r[i] = Math.random() * 1e9); for (const x of r) s += ABC[x % ABC.length]; return s; };
    const pid = (a, b) => a < b ? a + '_' + b : b + '_' + a;
    const cardOf = o => ({ nm: String(o.nm || 'もののけ').slice(0, 10), ch: String(o.ch || '').slice(0, 20), lv: Math.max(0, Math.min(999, Math.floor(+o.lv || 0))) });
    /** ログイン直後：コードが無ければ作る（重なったら作り直す）。セーブにも書く */
    async function ensure(s, c0) {
      code = ''; card = ''; ok = null; last = null; closing = false;
      try {
        if (s.fcode && valid(s.fcode)) { code = s.fcode; ok = true; return code; }
        const c = cardOf(c0 || {});
        for (let i = 0; i < 5 && !code; i++) {
          const k = gen();
          try { await L.fs.setDoc(L.fs.doc(db, 'codes', k), Object.assign({ uid: user.uid }, c)); code = k; } catch (e) { if (!/permission/i.test(e.code || e.message)) throw e; } // 他の人のコードと重なると書けない
        }
        if (!code) throw new Error('code');
        s.fcode = code; await L.fs.setDoc(L.fs.doc(db, 'saves', user.uid), toDoc(s)); ok = true; card = JSON.stringify(c); return code;
      } catch (e) { console.warn('friend code', e); ok = false; code = ''; return ''; }
    }
    /** 自分の状態を知らせる（なまえ・先頭キャラ・いま何をしているか）。act：''／'room'（募集中）／'play' */
    async function publish(o) {
      if (!user || !code || (closing && !o.off)) return false; // ログアウト中は「オフライン」だけ
      const c = cardOf(o), ck = JSON.stringify(c); if (!o.off) last = Object.assign({}, c);
      const p = Object.assign({ code }, c, { seen: o.off ? 0 : Date.now(), act: ['room', 'play'].includes(o.act) ? o.act : '', room: o.act === 'room' ? String(o.room || '').slice(0, 8) : '' });
      try {
        await L.fs.setDoc(L.fs.doc(db, 'profiles', user.uid), p);
        if (ck !== card) { await L.fs.setDoc(L.fs.doc(db, 'codes', code), Object.assign({ uid: user.uid }, c)); card = ck; }
        return true;
      } catch (e) { console.warn('profile', e); return false; }
    }
    const offline = () => (closing = true, last) ? publish(Object.assign({}, last, { off: true, act: '' })) : Promise.resolve(false); // このページで知らせた分だけ「オフライン」に戻す
    async function lookup(c) { c = norm(c); if (!valid(c)) return null; const sn = await L.fs.getDoc(L.fs.doc(db, 'codes', c)); return sn.exists() ? Object.assign({ code: c }, sn.data()) : null; }
    /** 一覧：フレンド（相手の状態つき）・届いた申請・送った申請 */
    /** opt.light：相手の状態（profiles）は読まない（ホームでの申請・招待の確認用。読む回数を抑える） */
    async function list(opt) {
      const light = !!(opt && opt.light);
      if (!user) throw Object.assign(new Error('login'), { code: 'login' });
      const me = user.uid, q = L.fs.query(L.fs.collection(db, 'friends'), L.fs.where('m', 'array-contains', me));
      const sn = await L.fs.getDocs(q), out = { friends: [], incoming: [], outgoing: [], now: Date.now() };
      const docs = sn.docs.map(d => Object.assign({ pid: d.id }, d.data()));
      await Promise.all(docs.map(async d => {
        const other = d.m[0] === me ? d.m[1] : d.m[0];
        if (d.st === 'ok') {
          let pr = null; if (!light) try { const ps = await L.fs.getDoc(L.fs.doc(db, 'profiles', other)); pr = ps.exists() ? ps.data() : null; } catch (e) { }
          const p = pr || { nm: d.from === me ? d.tnm : d.fnm, ch: '', lv: 0, seen: 0, act: '', room: '' };
          const on = out.now - (p.seen || 0) < ONLINE;
          const inv = d.inv && d.inv.by === other && out.now - d.inv.t < INV && (light || on) ? d.inv : null;
          out.friends.push({ pid: d.pid, uid: other, nm: p.nm || '？', ch: p.ch, lv: p.lv | 0, seen: p.seen || 0, on, act: on ? p.act : '', room: on && p.act === 'room' ? p.room : '', inv, since: d.t, light });
        } else if (d.to === me) out.incoming.push({ pid: d.pid, uid: other, nm: d.fnm, ch: d.fch, lv: d.flv | 0, t: d.t });
        else out.outgoing.push({ pid: d.pid, uid: other, nm: d.tnm || '？', t: d.t });
      }));
      const ord = (a, b) => (b.act === 'room') - (a.act === 'room') || b.on - a.on || b.seen - a.seen;
      out.friends.sort(ord); out.incoming.sort((a, b) => b.t - a.t); out.outgoing.sort((a, b) => b.t - a.t);
      return out;
    }
    /** コードで申請する。相手からの申請が来ていれば、そのまま承認になる */
    async function request(c, mine) {
      c = norm(c); if (!valid(c)) return { ok: false, msg: 'フレンドコードは8文字です（例：K7Q4-2MPX）' };
      if (!user) return { ok: false, msg: 'ログインしてください' };
      if (!code) return { ok: false, msg: 'フレンド機能の準備ができていません（サーバーの設定を確認してください）' };
      if (c === code) return { ok: false, msg: 'それはあなたのフレンドコードです' };
      try {
        const t = await lookup(c); if (!t) return { ok: false, msg: `${fmt(c)} のプレイヤーは見つかりませんでした` };
        const L0 = await list({ light: true }), all = L0.friends.concat(L0.incoming, L0.outgoing), hit = all.find(x => x.uid === t.uid);
        if (hit && L0.friends.includes(hit)) return { ok: false, msg: `${hit.nm} さんとはもうフレンドです` };
        if (hit && L0.incoming.includes(hit)) { await accept(hit.pid, mine); return { ok: true, msg: `${t.nm} さんからも申請が来ていたので、フレンドになりました`, done: true }; }
        if (hit) return { ok: false, msg: `${t.nm} さんへは申請ずみです（承認を待っています）` };
        if (all.length >= MAX) return { ok: false, msg: `フレンドと申請は合わせて${MAX}人までです` };
        const m = [user.uid, t.uid].sort(), me = cardOf(mine || {});
        await L.fs.setDoc(L.fs.doc(db, 'friends', pid(user.uid, t.uid)), { m, from: user.uid, to: t.uid, tc: c, st: 'req', t: Date.now(), fnm: me.nm, fch: me.ch, flv: me.lv, tnm: String(t.nm || '').slice(0, 10) });
        return { ok: true, msg: `${t.nm} さんにフレンド申請を送りました` };
      } catch (e) { console.warn('friend req', e); return { ok: false, msg: errMsg(e) }; }
    }
    async function getF(p) { const sn = await L.fs.getDoc(L.fs.doc(db, 'friends', p)); if (!sn.exists()) throw Object.assign(new Error('gone'), { code: 'gone' }); return sn.data(); }
    async function accept(p) { const d = await getF(p); d.st = 'ok'; d.t = Date.now(); await L.fs.setDoc(L.fs.doc(db, 'friends', p), d); return true; }
    async function remove(p) { await L.fs.deleteDoc(L.fs.doc(db, 'friends', p)); return true; }
    async function invite(p, room) { const d = await getF(p); if (d.st !== 'ok') return false; d.inv = { by: user.uid, room: String(room).slice(0, 8), t: Date.now() }; await L.fs.setDoc(L.fs.doc(db, 'friends', p), d); return true; }
    const wrap = f => async (...a) => { try { return { ok: true, v: await f(...a) } } catch (e) { console.warn('friend', e); return { ok: false, msg: /gone|permission/i.test(e.code || '') ? '相手が取り消したか、すでに削除されています' : errMsg(e) }; } };
    return { ensure, publish, offline, lookup, list, request, accept: wrap(accept), remove: wrap(remove), invite: wrap(invite), norm, fmt, valid, gen, pid, ONLINE, INV, MAX,
      reset() { code = ''; card = ''; ok = null; last = null; closing = false; }, get code() { return code; }, get ready() { return ok; } };
  })();
  return { init, register, login, write, logout, email, errMsg, FR, get user() { return user; } };
})();

/** ゲームから使う窓口：サーバー（cloud）か、この端末だけ（local）か */
const ACCT = {
  mode: 'local',
  setup() {
    const inClaude = !!(window.claude && typeof window.claude.use === 'function');
    const T = window.__TB_CLOUD_TEST || null; // 画面の検査用（エミュレーターにつなぐ）。ふだんは無い
    const cfg = (T && T.cfg) || FIREBASE_CONFIG;
    this.mode = cfg && !inClaude && !/[?&]save=local/.test(location.search) ? 'cloud' : 'local';
    if (this.mode === 'cloud') CLOUD.init(cfg, null, T && T.opt).catch(e => console.warn('firebase', e)); // 先に読み込んでおく
    return this.mode;
  },
  register(pw, pw2) { return this.mode === 'cloud' ? CLOUD.register(pw, pw2) : Promise.resolve(SAVE.register(pw, pw2)); },
  login(id, pw) { return this.mode === 'cloud' ? CLOUD.login(id, pw) : Promise.resolve(SAVE.login(id, pw)); },
  write(s) { return this.mode === 'cloud' ? CLOUD.write(s) : Promise.resolve(SAVE.write(s)); },
  logout() { if (this.mode === 'cloud') CLOUD.logout(); },
  /** フレンド機能（サーバー版でログイン中だけ）。使えないときは null */
  get FR() { return this.mode === 'cloud' && CLOUD.user ? CLOUD.FR : null; },
};
