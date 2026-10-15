// セーブ（ID＋パスワード・引き継ぎコード）の検査
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'save.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const mem = new Map([['tb.acct.1001', '{"id":1001}'], ['tb.lastId', '"1001"']]); // 以前の形式のセーブ
const localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Date, localStorage, parseInt, isNaN });
vm.runInContext(src + ';globalThis.__={DATA,SAVE}', ctx);
const { DATA, SAVE } = ctx.__;
let fail = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };
ok(!mem.has('tb.acct.1001') && !mem.has('tb.lastId') && mem.get('tb.saveVer') === '2', '以前のアカウント（1001〜の形式）は消える');
ok(!SAVE.register('abc', 'abc').ok, '3文字のパスワードは短すぎる');
ok(!SAVE.register('abcd', 'abce').ok, '確認のパスワードがちがうと作れない');
const r = SAVE.register('neko22', 'neko22'); ok(r.ok && r.id === 1, `1人目のIDは自動で1（${r.id}）`);
const r2 = SAVE.register('inu333', 'inu333'); ok(r2.ok && r2.id === 2, `2人目のIDは自動で2（${r2.id}）`);
ok(!JSON.stringify(r.save).includes('neko22'), 'パスワードそのものは保存しない');
ok(DATA.CHARS.every(c => r.save.chars[c.id].lv === 1), '全員Lv.1で始まる');
ok(!SAVE.login(1, 'inu333').ok, '他の人のパスワードでは1に入れない');
ok(!SAVE.login(1, 'neko23').ok, 'ちがうパスワードではログインできない');
ok(SAVE.login(1, 'neko22').ok && SAVE.login(2, 'inu333').ok, '自分のIDとパスワードでログインできる');
ok(SAVE.login(3, 'neko22').none, 'まだ作られていないIDは「この端末にありません」');
ok(!SAVE.login(0, 'neko22').ok && !SAVE.login(10001, 'neko22').ok, '範囲外のID（0・10001）ははじく');
const r3 = SAVE.register('tori44', 'tori44'); ok(r3.ok && r3.id === 3, `3人目は3（${r3.id}）`);
// 戦いの記録
const s = SAVE.login(1, 'neko22').save;
SAVE.apply(s, { kills: { kogemaru: 3, hoshisuzume: 2 }, fin: null });
SAVE.apply(s, { kills: { kogemaru: 1 }, fin: { ids: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'], win: true, time: 201.4 } });
ok(s.rec.b === 1 && s.rec.w === 1 && s.rec.mobs === 6 && s.rec.best === 201 && s.chars.kogemaru.k === 4 && s.chars.momiji.b === 1, '戦いの記録が足される（出撃1・勝利1・撃破6）');
ok(s.clear.senju === 1 && s.clear.joban === 0, `トバトーバン戦のクリアが記録される（${JSON.stringify(s.clear)}）`);
SAVE.apply(s, { kills: {}, fin: { ids: ['kogemaru'], win: false, time: 50, stage: 'joban' } });
ok(s.clear.joban === 0 && s.rec.b === 2, '常磐線で負けてもクリアにならない');
SAVE.apply(s, { kills: {}, fin: { ids: ['kogemaru'], win: true, time: 230, stage: 'joban' } });
ok(s.clear.joban === 1 && s.rec.best === 201, '常磐線のクリアは別に数える（最速記録はトバトーバン戦だけ）');
ok(SAVE.normalize({ id: 9, pw: '', rec: { b: 3, w: 2 } }).clear.senju === 2, 'ステージが1つだった頃の勝ちはトバトーバン戦のクリアとして数える');
ok(SAVE.write(s), '書き込める');
const s2 = SAVE.login(1, 'neko22').save; ok(s2.clear.joban === 1, 'クリアの記録も残る'); ok(s2.rec.mobs === 6 && s2.chars.kogemaru.k === 4, '閉じて開き直しても（読み直しても）続きが残る');
// 引き継ぎコード
const code = SAVE.encode(s2); console.log('   code', code, code.length);
const d = SAVE.decode(code); ok(d.ok && d.save.clear.senju === 1 && d.save.clear.joban === 1, '引き継ぎコードにステージのクリアも入る');
ok(d.ok && d.save.id === 1 && d.save.rec.mobs === 6 && d.save.chars.kogemaru.k === 4 && d.save.chars.burikidon.b === 1, '引き継ぎコードを読み戻せる');
ok(SAVE.decode(code.toLowerCase().replace(/-/g, ' ')).ok, '小文字・区切りなしでも読める');
const bad = code.slice(0, 5) + (code[5] === 'A' ? 'B' : 'A') + code.slice(6); ok(!SAVE.decode(bad).ok, '1文字まちがえるとはじく');
mem.clear();
ok(!SAVE.restore(1, 'wrongpw', code).ok, '別の端末：パスワードがちがうと引き継げない');
ok(!SAVE.restore(2, 'neko22', code).ok, '別の端末：IDがちがうと引き継げない');
const rs = SAVE.restore(1, 'neko22', code); ok(rs.ok && SAVE.login(1, 'neko22').save.rec.w === 2, '別の端末：コード＋ID＋パスワードで続きから');
const r4 = SAVE.register('kame55', 'kame55'); ok(r4.ok && r4.id === 2, `引き継いだIDとかぶらない番号になる（${r4.id}）`);
// 1つ前の版（VER 1）の引き継ぎコードも読める
const OLD = '056Q-NND7-E82G-6A00-1800-1ZR4'; // ID 77・出撃5・勝利3・撃破40
const od = SAVE.decode(OLD); ok(od.ok && od.save.id === 77 && od.save.rec.mobs === 40 && od.save.clear.senju === 3 && od.save.clear.joban === 0, `前の版のコードも読める（勝ち3＝トバトーバン戦クリア${od.ok && od.save.clear.senju}）`);
const fresh = SAVE.fresh(10000, SAVE.pwHash(10000, 'abcd')); console.log('   新規のコード', SAVE.encode(fresh));
console.log(fail ? `\n${fail}件 失敗` : '\nすべて合格'); process.exit(fail ? 1 : 0);
