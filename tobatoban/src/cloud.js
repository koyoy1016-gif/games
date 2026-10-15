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
      return { ok: true, id, save: s, msg: `アカウントを作りました。あなたのIDは ${id} です` };
    } catch (err) { console.warn('register', err); try { if (auth && auth.currentUser && auth.currentUser.isAnonymous) await L.au.signOut(auth); } catch (e2) { } user = null; return { ok: false, msg: errMsg(err) }; }
  }
  async function login(id, pw) {
    if (!SAVE.validId(id)) return { ok: false, msg: `IDは${SAVE.ID_MIN}〜${SAVE.ID_MAX}の番号です` };
    if (!pw) return { ok: false, msg: 'パスワードを入れてください' };
    try {
      await init();
      user = (await L.au.signInWithEmailAndPassword(auth, email(id), pw)).user;
      return { ok: true, save: await loadSave(id), msg: `ID ${id} でログインしました` };
    } catch (err) { console.warn('login', err); user = null; return { ok: false, msg: errMsg(err) }; }
  }
  async function write(s) {
    if (!user) return false;
    try { s.saved = Date.now(); await L.fs.setDoc(L.fs.doc(db, 'saves', user.uid), toDoc(s)); return true; } catch (err) { console.warn('save', err); return false; }
  }
  async function logout() { user = null; try { if (auth) await L.au.signOut(auth); } catch (e) { } }
  return { init, register, login, write, logout, email, errMsg, get user() { return user; } };
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
};
