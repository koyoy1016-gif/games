// サーバー版セーブ（cloud.js）の検査。
// 本物の Firebase Authentication をローカルのエミュレーターで動かし、Firestore は firestore.rules と同じ決まりを守る代わりの物で確かめる。
// 使い方: FB_DIR=<firebase と firebase-tools を npm i したフォルダ> で、先に
//   (cd $FB_DIR && npx firebase emulators:start --only auth --project demo-tb) を起動しておく
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const req = createRequire(path.join(process.env.FB_DIR || '.', 'package.json'));
const fbApp = req('firebase/app'), fbAuth = req('firebase/auth');
const mem = new Map(); const localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Date, Promise, Error, localStorage, parseInt, isNaN, setTimeout, location: { search: '' }, window: {} });
vm.runInContext(['data.js', 'roster_data.js', 'roster.js', 'save.js', 'cloud.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.__={DATA,SAVE,CLOUD}', ctx);
const { SAVE, CLOUD } = ctx.__;

/* ---- firestore.rules と同じ決まりで動く、検査用の Firestore ---- */
let authRef = null; const store = new Map(); let denied = 0;
const uidNow = () => authRef && authRef.currentUser ? authRef.currentUser.uid : null;
function check(writes) { // writes: Map(path -> data)
  const pre = p => store.get(p), post = p => writes.has(p) ? writes.get(p) : store.get(p), uid = uidNow();
  for (const [p, d] of writes) {
    const [col, id] = p.split('/'); const keysOnly = (o, ks) => Object.keys(o).every(k => ks.includes(k));
    if (!uid) return 'not signed in';
    if (p === 'meta/counter') {
      const old = pre(p);
      if (!old) { if (!(keysOnly(d, ['next']) && d.next === 2 && (post('ids/1') || {}).uid === uid)) return 'counter create'; }
      else if (!(keysOnly(d, ['next']) && Number.isInteger(old.next) && old.next <= 10000 && d.next === old.next + 1 && (post('ids/' + old.next) || {}).uid === uid)) return 'counter update';
    } else if (col === 'ids') {
      if (pre(p)) return 'ids exists';
      if (!(keysOnly(d, ['uid']) && d.uid === uid && +id >= 1 && (post('meta/counter') || {}).next === +id + 1)) return 'ids create';
    } else if (col === 'saves') { if (id !== uid) return 'saves other'; }
    else return 'other';
  }
  return null;
}
function canRead(p) { const uid = uidNow(); const [col, id] = p.split('/'); if (p === 'meta/counter') return !!uid; if (col === 'saves') return !!uid && id === uid; return false; }
const perm = m => Object.assign(new Error(m), { code: 'permission-denied' });
const fakeFs = {
  doc: (db, col, id) => ({ path: col + '/' + id }),
  async getDoc(ref) { if (!canRead(ref.path)) { denied++; throw perm('read ' + ref.path); } const d = store.get(ref.path); return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) }; },
  async setDoc(ref, data) { const w = new Map([[ref.path, JSON.parse(JSON.stringify(data))]]); const e = check(w); if (e) { denied++; throw perm(e); } store.set(ref.path, w.get(ref.path)); },
  async runTransaction(db, fn) { const w = new Map(); const tx = { async get(ref) { if (!canRead(ref.path)) { denied++; throw perm('read ' + ref.path); } const d = store.get(ref.path); return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) }; }, set(ref, data) { w.set(ref.path, JSON.parse(JSON.stringify(data))); } }; const r = await fn(tx); const e = check(w); if (e) { denied++; throw perm(e); } for (const [p, d] of w) store.set(p, d); return r; },
};
let fail = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };
const cfg = { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-tb' };
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-tb/accounts', { method: 'DELETE' }); // エミュレーターのアカウントを空にする
await CLOUD.init(cfg, { app: fbApp, au: fbAuth, fs: fakeFs }, { db: {}, authEmulator: 'http://127.0.0.1:9099' });
authRef = fbAuth.getAuth(fbApp.getApp('tobatoban'));

const a = await CLOUD.register('neko22', 'neko22'); ok(a.ok && a.id === 1, `1人目は ID 1（${a.id} ${a.msg}）`);
const uid1 = CLOUD.user && CLOUD.user.uid;
ok(!!store.get('saves/' + uid1) && store.get('meta/counter').next === 2 && store.get('ids/1').uid === uid1, 'サーバーに 番号→持ち主・次の番号・セーブ ができる');
ok(!JSON.stringify(store.get('saves/' + uid1)).includes('neko22'), 'セーブにパスワードは入らない');
await CLOUD.logout();
const b = await CLOUD.register('inu333', 'inu333'); ok(b.ok && b.id === 2, `2人目（別の人）は ID 2（${b.id}）`);
await CLOUD.logout();
const c = await CLOUD.register('abc', 'abc'); ok(!c.ok && /6文字/.test(c.msg), `短いパスワードは作れない（${c.msg}）`);
ok(store.get('meta/counter').next === 3, '作れなかったときは番号を使わない');
const l1 = await CLOUD.login(1, 'inu333'); ok(!l1.ok && /ちがいます/.test(l1.msg), `ID 1 に他の人のパスワードでは入れない（${l1.msg}）`);
const l2 = await CLOUD.login(1, 'neko22'); ok(l2.ok && l2.save.id === 1 && l2.save.chars.kogemaru.lv === 1, `ID 1 と自分のパスワードで入れる（全員Lv.1）`);
SAVE.apply(l2.save, { kills: { kogemaru: 5 }, fin: { ids: ['kogemaru', 'momiji'], win: true, time: 180 } });
ok(await CLOUD.write(l2.save), 'セーブボタン：サーバーに保存できる');
await CLOUD.logout(); mem.clear(); // 別の端末（この端末の保存は空）
const l3 = await CLOUD.login(1, 'neko22'); ok(l3.ok && l3.save.rec.w === 1 && l3.save.chars.kogemaru.k === 5, '別の端末からでも ID＋パスワードで続きから');
const l4 = await CLOUD.login(3, 'neko22'); ok(!l4.ok, `まだ無いIDには入れない（${l4.msg}）`);
// 決まりを破る書き込みははじかれる
await CLOUD.login(2, 'inu333'); const uid2 = CLOUD.user.uid;
let e1 = null; try { await fakeFs.setDoc({ path: 'saves/' + uid1 }, { hack: 1 }); } catch (e) { e1 = e; } ok(!!e1, '他の人のセーブは書きかえられない');
let e2 = null; try { await fakeFs.runTransaction({}, async tx => { tx.set({ path: 'meta/counter' }, { next: 50 }); }); } catch (e) { e2 = e; } ok(!!e2, '次の番号を飛ばして進めることはできない');
let e3 = null; try { await fakeFs.setDoc({ path: 'ids/1' }, { uid: uid2 }); } catch (e) { e3 = e; } ok(!!e3, '他の人のIDを自分のものにできない');
await CLOUD.logout();
// 10000人でいっぱい
store.set('meta/counter', { next: 10000 });
const z = await CLOUD.register('zzzzzz', 'zzzzzz'); ok(z.ok && z.id === 10000, `最後のID 10000（${z.id}）`); await CLOUD.logout();
const f = await CLOUD.register('yyyyyy', 'yyyyyy'); ok(!f.ok && /いっぱい/.test(f.msg), `10001人目は作れない（${f.msg}）`);
console.log(fail ? `\n${fail}件 失敗` : '\nすべて合格'); process.exit(fail ? 1 : 0);
