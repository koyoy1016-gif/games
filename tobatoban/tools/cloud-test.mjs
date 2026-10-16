// サーバー版セーブ（cloud.js）の検査。
// 本物の Firebase Authentication をローカルのエミュレーターで動かし、Firestore は firestore.rules と同じ決まりを守る代わりの物で確かめる。
// 使い方: FB_DIR=<firebase と firebase-tools を npm i したフォルダ> で、先に
//   (cd $FB_DIR && npx firebase emulators:start --only auth --project demo-tb) を起動しておく
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const req = createRequire(path.join(process.env.FB_DIR || '.', 'package.json'));
const fbApp = req('firebase/app'), fbAuth = req('firebase/auth');
const mem = new Map(); const localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
const ctx = vm.createContext({ console, crypto: globalThis.crypto, Uint32Array, Math, JSON, Object, Array, Number, String, Date, Promise, Error, localStorage, parseInt, isNaN, setTimeout, location: { search: '' }, window: {} });
vm.runInContext(['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js', 'save.js', 'cloud.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.__={DATA,SAVE,CLOUD}', ctx);
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
    else if (col === 'codes') {
      const old = pre(p);
      if (!(keysOnly(d, ['uid', 'nm', 'ch', 'lv']) && d.uid === uid && card(d))) return 'codes data';
      if (old ? old.uid !== uid : !/^[A-HJKMNP-Z2-9]{8}$/.test(id)) return 'codes owner';
    } else if (col === 'profiles') {
      if (id !== uid) return 'profiles other';
      if (!(keysOnly(d, ['code', 'nm', 'ch', 'lv', 'seen', 'act', 'room']) && card(d) && typeof d.code === 'string' && d.code.length <= 8 && Number.isInteger(d.seen) && ['', 'room', 'play'].includes(d.act) && typeof d.room === 'string' && d.room.length <= 8)) return 'profiles data';
    } else if (col === 'friends') {
      const old = pre(p);
      if (!old) {
        if (!(keysOnly(d, ['m', 'from', 'to', 'tc', 'st', 't', 'fnm', 'fch', 'flv', 'tnm']) && d.from === uid && typeof d.to === 'string' && d.to !== uid && Array.isArray(d.m) && d.m.length === 2 && d.m.includes(uid) && d.m.includes(d.to) && d.m[0] < d.m[1] && id === d.m[0] + '_' + d.m[1]
          && typeof d.tc === 'string' && (store.get('codes/' + d.tc) || {}).uid === d.to && d.st === 'req' && Number.isInteger(d.t) && name(d.fnm) && name(d.tnm) && typeof d.fch === 'string' && Number.isInteger(d.flv))) return 'friends create';
      } else {
        if (!(old.m.includes(uid) && JSON.stringify(d.m) === JSON.stringify(old.m) && d.from === old.from && d.to === old.to)) return 'friends update base';
        const aff = [...new Set(Object.keys(d).concat(Object.keys(old)))].filter(k => JSON.stringify(d[k]) !== JSON.stringify(old[k]));
        const acc = old.st === 'req' && uid === old.to && d.st === 'ok' && aff.every(k => ['st', 't'].includes(k)) && Number.isInteger(d.t);
        const inv = old.st === 'ok' && d.st === 'ok' && aff.every(k => k === 'inv') && d.inv && keysOnly(d.inv, ['by', 'room', 't']) && d.inv.by === uid && typeof d.inv.room === 'string' && d.inv.room.length <= 8 && Number.isInteger(d.inv.t);
        if (!acc && !inv) return 'friends update';
      }
    }
    else return 'other';
  }
  return null;
}
const name = v => typeof v === 'string' && v.length <= 12, card = d => name(d.nm) && typeof d.ch === 'string' && d.ch.length <= 20 && Number.isInteger(d.lv) && d.lv >= 0 && d.lv <= 999;
const okDoc = p => (store.get(p) || {}).st === 'ok', isFriend = (me, o) => okDoc('friends/' + me + '_' + o) || okDoc('friends/' + o + '_' + me);
function canRead(p) {
  const uid = uidNow(); const [col, id] = p.split('/'); if (!uid) return false;
  if (p === 'meta/counter') return true; if (col === 'saves') return id === uid;
  if (col === 'codes') return true;
  if (col === 'profiles') return id === uid || isFriend(uid, id);
  if (col === 'friends') { const d = store.get(p); return !!d && d.m.includes(uid); } // 無い文書は resource が null で拒否
  return false;
}
function canDelete(p) { const uid = uidNow(); const [col, id] = p.split('/'); if (!uid) return false; if (col === 'profiles') return id === uid; if (col === 'friends') { const d = store.get(p); return !!d && d.m.includes(uid); } return false; }
const perm = m => Object.assign(new Error(m), { code: 'permission-denied' });
const fakeFs = {
  doc: (db, col, id) => ({ path: col + '/' + id }),
  async getDoc(ref) { if (!canRead(ref.path)) { denied++; throw perm('read ' + ref.path); } const d = store.get(ref.path); return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) }; },
  async setDoc(ref, data) { const w = new Map([[ref.path, JSON.parse(JSON.stringify(data))]]); const e = check(w); if (e) { denied++; throw perm(e); } store.set(ref.path, w.get(ref.path)); },
  async updateDoc(ref, part) { const old = store.get(ref.path); if (!old) { denied++; throw Object.assign(new Error('not-found'), { code: 'not-found' }); } if (!canRead(ref.path) && !ref.path.startsWith('friends/')) { denied++; throw perm('update ' + ref.path); } const d = Object.assign(JSON.parse(JSON.stringify(old)), JSON.parse(JSON.stringify(part))); const w = new Map([[ref.path, d]]); const e = check(w); if (e) { denied++; throw perm(e); } store.set(ref.path, d); },
  async deleteDoc(ref) { if (!canDelete(ref.path)) { denied++; throw perm('delete ' + ref.path); } store.delete(ref.path); },
  collection: (db, col) => ({ col }), where: (f, op, v) => ({ f, op, v }), query: (c, ...w) => ({ col: c.col, w }),
  async getDocs(q) {
    const uid = uidNow(), w = q.w[0];
    // ルール「me() in resource.data.m」を満たす問い合わせだけ通る
    if (!(uid && q.col === 'friends' && q.w.length === 1 && w.f === 'm' && w.op === 'array-contains' && w.v === uid)) { denied++; throw perm('list ' + q.col); }
    const docs = [...store.entries()].filter(([p, d]) => p.startsWith('friends/') && d.m.includes(uid)).map(([p, d]) => ({ id: p.split('/')[1], data: () => JSON.parse(JSON.stringify(d)) }));
    return { docs };
  },
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

/* ---- フレンド ---- */
const FR = CLOUD.FR, lg = async (id, pw) => { await CLOUD.logout(); const r = await CLOUD.login(id, pw); return r; };
const r1 = await lg(1, 'neko22'); const code1 = r1.save.fcode;
ok(FR.valid(code1) && FR.code === code1 && store.get('codes/' + code1).uid === uid1 && store.get('saves/' + uid1).fcode === code1, `ログインでフレンドコードができる（${FR.fmt(code1)}・ログインIDとは別のランダム8文字）`);
ok(!/[01OIL]/.test(code1), '見まちがえやすい字（0 O 1 I L）は使わない');
const r1b = await lg(1, 'neko22'); ok(r1b.save.fcode === code1 && FR.code === code1, '次のログインでも同じコード');
ok(await FR.publish({ nm: 'ネコ', ch: 'kogemaru', lv: 12 }), '自分の状態（なまえ・先頭キャラ）を知らせられる');
ok(store.get('codes/' + code1).nm === 'ネコ', 'コードで引いたときの名札も新しくなる');
const r2 = await lg(2, 'inu333'); const code2 = r2.save.fcode; ok(FR.valid(code2) && code2 !== code1, '2人目にも別のコード');
await FR.publish({ nm: 'イヌ', ch: 'momiji', lv: 8 });
let e4 = null; try { await fakeFs.getDoc({ path: 'profiles/' + uid1 }); } catch (e) { e4 = e; } ok(!!e4, 'フレンドでない人の状態は読めない');
let e5 = null; try { await fakeFs.setDoc({ path: 'codes/' + code1 }, { uid: uid2, nm: 'x', ch: '', lv: 0 }); } catch (e) { e5 = e; } ok(!!e5, '他の人のフレンドコードを横取りできない');
let e6 = null; try { await fakeFs.getDocs(fakeFs.query(fakeFs.collection({}, 'friends'))); } catch (e) { e6 = e; } ok(!!e6, 'フレンドの一覧を全部取ることはできない（自分の分だけ）');
ok(/8文字/.test((await FR.request('ABC')).msg), '短いコードははじく');
ok(/あなたの/.test((await FR.request(code2)).msg), '自分のコードには申請できない');
const unk = code1 === 'ZZZZZZZZ' ? 'YYYYYYYY' : 'ZZZZZZZZ'; ok(/見つかりません/.test((await FR.request(unk)).msg), 'ないコードは「見つかりません」');
const q1 = await FR.request(FR.fmt(code1).toLowerCase(), { nm: 'イヌ', ch: 'momiji', lv: 8 }); ok(q1.ok && /ネコ/.test(q1.msg), `ハイフン・小文字でも申請できる（${q1.msg}）`);
const p12 = FR.pid(uid1, uid2); ok(store.get('friends/' + p12).st === 'req', '申請中（req）になる');
ok(/申請ずみ/.test((await FR.request(code1)).msg), '同じ人へ二重に申請しない');
let e7 = null; try { const d = store.get('friends/' + p12); await fakeFs.setDoc({ path: 'friends/' + p12 }, Object.assign({}, d, { st: 'ok' })); } catch (e) { e7 = e; } ok(!!e7, '申請した側が自分で承認にはできない');
const L2a = await FR.list(); ok(L2a.outgoing.length === 1 && L2a.outgoing[0].nm === 'ネコ' && L2a.friends.length === 0, '送った申請が一覧に出る');
// 3人目（無関係の人）
await CLOUD.logout(); const r3 = await CLOUD.register('tori44', 'tori44'); const uid3 = CLOUD.user.uid, code3 = r3.save.fcode; ok(r3.ok && FR.valid(code3), '3人目（登録したときにコードができる）');
let e8 = null; try { await fakeFs.getDoc({ path: 'friends/' + p12 }); } catch (e) { e8 = e; } ok(!!e8, '他人どうしの申請は読めない');
let e9 = null; try { const d = JSON.parse(JSON.stringify(store.get('friends/' + p12))); d.st = 'ok'; await fakeFs.setDoc({ path: 'friends/' + p12 }, d); } catch (e) { e9 = e; } ok(!!e9, '他人どうしの申請を承認できない');
let e10 = null; try { const m = [uid3, uid1].sort(); await fakeFs.setDoc({ path: 'friends/' + m.join('_') }, { m, from: uid3, to: uid1, tc: code3, st: 'req', t: Date.now(), fnm: 't', fch: '', flv: 0, tnm: 'x' }); } catch (e) { e10 = e; } ok(!!e10, '相手のコードを知らないと申請できない（uidだけでは不可）');
let e11 = null; try { const m = [uid3, uid1].sort(); await fakeFs.setDoc({ path: 'friends/' + m.join('_') }, { m, from: uid3, to: uid1, tc: code1, st: 'ok', t: Date.now(), fnm: 't', fch: '', flv: 0, tnm: 'x' }); } catch (e) { e11 = e; } ok(!!e11, 'いきなりフレンド（ok）にはできない');
// 承認
await lg(1, 'neko22'); await FR.publish({ nm: 'ネコ', ch: 'kogemaru', lv: 12 });
const L1 = await FR.list(); ok(L1.incoming.length === 1 && L1.incoming[0].nm === 'イヌ' && L1.incoming[0].ch === 'momiji', '届いた申請に相手のなまえとキャラが出る');
ok((await FR.accept(L1.incoming[0].pid)).ok && store.get('friends/' + p12).st === 'ok', '承認するとフレンドになる');
await FR.publish({ nm: 'ネコ', ch: 'kogemaru', lv: 12, act: 'room', room: '4321' });
ok((await FR.invite(p12, '4321')).ok, 'フレンドを協力プレイに招待できる');
await lg(2, 'inu333'); await FR.publish({ nm: 'イヌ', ch: 'momiji', lv: 8 });
const online = u => { const p = store.get('profiles/' + u); p.seen = Date.now(); }; // 別の端末でまだ開いている（この検査は1人ずつ切りかえるので）
ok(store.get('profiles/' + uid1).seen === 0 && store.get('profiles/' + uid1).nm === 'ネコ', 'ログアウトでオフライン（なまえはそのまま）'); online(uid1); store.get('profiles/' + uid1).act = 'room'; store.get('profiles/' + uid1).room = '4321';
const L2 = await FR.list(); const f1 = L2.friends[0];
ok(L2.friends.length === 1 && f1.nm === 'ネコ' && f1.on && f1.act === 'room' && f1.room === '4321', `フレンドの状態（オンライン・募集中のルーム）が見える（${f1 && f1.nm} ${f1 && f1.act} ${f1 && f1.room}）`);
ok(f1.inv && f1.inv.room === '4321', '招待が届く');
const L2l = await FR.list({ light: true }); ok(L2l.friends[0].inv && L2l.friends[0].light && L2l.friends[0].nm === 'ネコ', 'ホーム用の軽い読み込み（相手の状態は読まない）でも招待と申請はわかる');
let e12 = null; try { const d = JSON.parse(JSON.stringify(store.get('friends/' + p12))); d.inv = { by: uid1, room: '9999', t: Date.now() }; await fakeFs.setDoc({ path: 'friends/' + p12 }, d); } catch (e) { e12 = e; } ok(!!e12, '相手の名前で招待を書けない');
let e13 = null; try { await fakeFs.setDoc({ path: 'profiles/' + uid1 }, { code: code1, nm: 'x', ch: '', lv: 0, seen: 0, act: '', room: '' }); } catch (e) { e13 = e; } ok(!!e13, 'フレンドでも相手の状態は書きかえられない');
// 2→3 へ申請しておき、3→2 の申請で自動的にフレンドに
ok((await FR.request(code3, { nm: 'イヌ', ch: 'momiji', lv: 8 })).ok, '別の人へも申請できる');
await lg(1, 'neko22'); await FR.publish({ nm: 'ネコ', ch: 'kogemaru', lv: 12 }); await CLOUD.logout(); // ログアウトすると「オフライン」
ok(store.get('profiles/' + uid1).seen === 0, 'ログアウトでオフラインになる');
await lg(3, 'tori44'); const q3 = await FR.request(code2, { nm: 'トリ', ch: 'kogemaru', lv: 1 }); ok(q3.ok && q3.done && store.get('friends/' + FR.pid(uid2, uid3)).st === 'ok', `相手からも申請が来ていれば、そのままフレンド（${q3.msg}）`);
await FR.publish({ nm: 'トリ', ch: 'kogemaru', lv: 1 });
await lg(2, 'inu333'); online(uid3);
const L2b = await FR.list(); ok(L2b.friends.length === 2 && !L2b.friends.find(f => f.uid === uid1).on, `オフラインのフレンドは「オフライン」（${L2b.friends.map(f => f.nm + (f.on ? '○' : '×')).join(' ')}）`);
ok(L2b.friends[0].uid === uid3, 'オンラインの人が上に並ぶ');
ok((await FR.remove(p12)).ok && !store.get('friends/' + p12), 'フレンドを解除できる');
let e14 = null; try { await fakeFs.getDoc({ path: 'profiles/' + uid1 }); } catch (e) { e14 = e; } ok(!!e14, '解除したら相手の状態は読めない');
ok(!(await FR.accept(p12)).ok, '消えた申請は承認できない（メッセージを返す）');
// 招待は inv だけを部分更新する（ほかの欄は変わらない）
{ const p23 = FR.pid(uid2, uid3), before = JSON.stringify(Object.assign({}, store.get('friends/' + p23), { inv: null }));
  const r = await FR.invite(p23, '123456'); const d = store.get('friends/' + p23);
  ok(r.ok && d.inv.room === '123456' && d.inv.by === uid2 && JSON.stringify(Object.assign({}, d, { inv: null })) === before, '招待は inv だけを書きかえる（6けたの合言葉）');
  const pr = await FR.profile(uid3); ok(pr.ok && pr.v && pr.v.nm === 'トリ', 'フレンド1人の状態を確認できる（招待に応える前）'); }
await CLOUD.logout();
// 10000人でいっぱい
store.set('meta/counter', { next: 10000 });
const z = await CLOUD.register('zzzzzz', 'zzzzzz'); ok(z.ok && z.id === 10000, `最後のID 10000（${z.id}）`); await CLOUD.logout();
const f = await CLOUD.register('yyyyyy', 'yyyyyy'); ok(!f.ok && /いっぱい/.test(f.msg), `10001人目は作れない（${f.msg}）`);
console.log(fail ? `\n${fail}件 失敗` : '\nすべて合格'); process.exit(fail ? 1 : 0);
