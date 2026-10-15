// セーブ（ID＋パスワード・引き継ぎコード）の検査
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster.js', 'save.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
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
ok(Object.keys(r.save.chars).length === 20 && Object.values(r.save.chars).every(c => c.lv === 1 && c.exp === 0), `新しいセーブは既存10体＋追加Dの10体＝20体を所持・全員Lv1（${Object.keys(r.save.chars).length}体）`);
ok(!SAVE.login(1, 'inu333').ok, '他の人のパスワードでは1に入れない');
ok(!SAVE.login(1, 'neko23').ok, 'ちがうパスワードではログインできない');
ok(SAVE.login(1, 'neko22').ok && SAVE.login(2, 'inu333').ok, '自分のIDとパスワードでログインできる');
ok(SAVE.login(3, 'neko22').none, 'まだ作られていないIDは「この端末にありません」');
ok(!SAVE.login(0, 'neko22').ok && !SAVE.login(10001, 'neko22').ok, '範囲外のID（0・10001）ははじく');
const r3 = SAVE.register('tori44', 'tori44'); ok(r3.ok && r3.id === 3, `3人目は3（${r3.id}）`);
// 戦いの記録・EXP・チケット
const s = SAVE.login(1, 'neko22').save;
SAVE.apply(s, { kills: { kogemaru: 3, hoshisuzume: 2 }, fin: null });
const solo = (win, stage, bid) => ({ kills: { kogemaru: 1 }, fin: { bid, stage, win, time: 201.4, H: 1, slots: [{ ch: 'kogemaru', rate: 1 }, { ch: 'hoshisuzume', rate: 0.8 }, { ch: 'burikidon', rate: 0.8 }, { ch: 'momiji', rate: 0.8 }] } });
const op1 = solo(true, 'senju', 'b1'); SAVE.apply(s, op1);
ok(s.rec.b === 1 && s.rec.w === 1 && s.rec.mobs === 6 && s.rec.best === 201 && s.chars.kogemaru.k === 4, '戦いの記録が足される（出撃1・勝利1・撃破6）');
ok(s.chars.kogemaru.exp === 10000 && s.chars.kogemaru.lv === 11 && s.chars.hoshisuzume.exp === 8000 && s.chars.momiji.exp === 8000, `操作キャラ10,000（Lv${s.chars.kogemaru.lv}）・AI 8,000`);
ok(s.chars.akaneten.exp === 0, '控え（出動していないキャラ）は0');
const op1b = solo(true, 'senju', 'b1'); SAVE.apply(s, op1b); ok(op1b.res.dup && s.chars.kogemaru.exp === 10000 && s.rec.w === 1, '同じ戦闘IDの報酬は二度出ない');
ok(s.wins.tobatoban === 1 && s.tickets === 0, 'トバトーバン1勝ではチケットなし');
SAVE.apply(s, solo(false, 'senju', 'b2')); ok(s.wins.tobatoban === 1 && s.chars.kogemaru.exp === 12500, '敗北は2,500・チケットの進捗は進まない');
SAVE.apply(s, solo(true, 'senju', 'b3')); const op4 = solo(true, 'senju', 'b4'); SAVE.apply(s, op4);
ok(s.wins.tobatoban === 3 && s.tickets === 1 && op4.res.ticket === 1, `トバトーバン3勝でチケット1枚（${s.tickets}枚）`);
ok(SAVE.eqSlots(s) === 1 && SAVE.setEquip(s, 'kogemaru', 0, 'bracer_gold').ok && !SAVE.setEquip(s, 'kogemaru', 1, 'charm_gold').ok, '電車クリア前の装備は1枠');
const op5 = solo(true, 'joban', 'b5'); SAVE.apply(s, op5); ok(s.tickets === 1 && !s.uenoOpen && s.clear.joban === 1 && op5.res.unlocked === 'ueno_street', '電車クリアはチケットに数えず、居酒屋通りが解放される（ボスはまだ）');
ok(SAVE.eqSlots(s) === 2 && SAVE.setEquip(s, 'kogemaru', 1, 'bracer_purple').ok && !SAVE.setEquip(s, 'kogemaru', 1, 'bracer_gold').ok, '電車クリア後は2枠（同じ系統の別段階はOK・同じIDの二重は不可）');
{ const st = DATA.GROWTH.withEquip(DATA.GROWTH.stats(DATA.CHI.kagetsubame, 60), ['bracer_gold', 'charm_gold']), hp2 = DATA.GROWTH.withEquip(DATA.GROWTH.stats(DATA.CHI.kagetsubame, 60), ['magatama_gold']);
  ok(st.hp === 798 && st.str === 309 && st.yo === 125 && st.def === 214 && hp2.hp === 1596, `Lv60カゲツバメ＋ちから50%＋まもり50%＝HP${st.hp}・ちから${st.str}・ようりょく${st.yo}・まもり${st.def}、HP+100%＝${hp2.hp}`);
  const s2 = DATA.GROWTH.withEquip({ hp: 100, str: 100, yo: 100, def: 100 }, ['bracer_purple', 'bracer_gold']); ok(s2.str === 190, `同じ能力は足し算（+40%と+50%で×1.90＝${s2.str}）`); }
const op5b = solo(true, 'ueno_street', 'b5b'); SAVE.apply(s, op5b); ok(s.uenoOpen && op5b.res.unlocked === 'ueno' && s.chars.kogemaru.exp - 10000 * 3 - 2500 - 20000 === 12000, '居酒屋通りの勝利（EXP12,000）で上野のボスが解放される');
SAVE.apply(s, solo(true, 'ueno', 'b6')); SAVE.apply(s, solo(true, 'ueno', 'b7')); ok(s.wins.yoshinoshin === 2 && s.tickets === 2 && s.akibaOpen, 'ヨシノシン2勝でチケット1枚・秋葉原編が解放される');
const op8 = solo(true, 'senju', 'b8'); op8.fin.retreat = true; const e0 = s.chars.kogemaru.exp; SAVE.apply(s, op8); ok(s.chars.kogemaru.exp === e0 && s.wins.tobatoban === 3, '撤退は報酬なし');
const coop = { kills: {}, fin: { bid: 'c1', stage: 'senju', win: true, H: 4, slots: [{ ch: 'momiji', rate: 1 }] } }; const m0 = s.chars.momiji.exp; SAVE.apply(s, coop); ok(s.chars.momiji.exp - m0 === 10000, '4人で勝っても人間は100%＝10,000（人数ボーナスは廃止）');
// ガチャ
ok(SAVE.gachaPool(s).length === 40, 'ガチャ対象は未所持の40体（Dは出ない）');
const r0 = SAVE.gachaRates(s); ok(Math.abs(r0.C - 0.35) < 1e-9 && Math.abs(r0.B - 0.35) < 1e-9 && Math.abs(r0.A - 0.22) < 1e-9 && Math.abs(r0.S - 0.08) < 1e-9, `最初の割合 C${(r0.C * 100).toFixed(0)}・B${(r0.B * 100).toFixed(0)}・A${(r0.A * 100).toFixed(0)}・S${(r0.S * 100).toFixed(0)}%`);
const g1 = SAVE.gachaDraw(s, 'q1', 0.999); ok(g1.ok && s.tickets === 1 && s.chars[g1.res.id] && s.chars[g1.res.id].lv === 1 && s.chars[g1.res.id].exp === 0 && DATA.CHI[g1.res.id].rank !== 'D', `1枚で1体（${g1.res.id}・${g1.res.rank}・Lv1・EXP0）`);
const g1b = SAVE.gachaDraw(s, 'q1', 0.1); ok(g1b.again && g1b.res.id === g1.res.id && s.tickets === 1, '同じ依頼IDの再送では引き直さず、二重に消費しない');
for (let i = 0; i < 39; i++) { s.tickets++; SAVE.gachaDraw(s, 'r' + i, (i * 0.37) % 1); }
ok(SAVE.gachaPool(s).length === 0 && Object.keys(s.chars).length === 60, `40体すべて重複なしで入手（所持${Object.keys(s.chars).length}体）`);
const rr = SAVE.gachaRates(s); ok(rr.C === 0 && rr.S === 0, '全員所持のランクは0%');
const ex = SAVE.gachaExchange(s, 'kogemaru', 'x1'); ok(ex.ok && s.chars.kogemaru.exp === e0 + 10000, '全40体入手後は1枚をEXP10,000と交換');
// 移行：Lvだけの旧セーブ・追加Dの一度だけの配布
const old = { id: 5, pw: 'x', chars: { kogemaru: { lv: 12, exp: 0, b: 3, w: 2, k: 9 } }, rec: { b: 3, w: 2, mobs: 9, best: 300 } };
const n1 = SAVE.normalize(JSON.parse(JSON.stringify(old)));
ok(n1.chars.kogemaru.lv === 12 && n1.chars.kogemaru.exp === DATA.GROWTH.cum('D', 12) && DATA.NEW_D_IDS.every(id => n1.chars[id] && n1.chars[id].lv === 1), `Lvだけの旧セーブはそのLvの累積EXPに（Lv${n1.chars.kogemaru.lv}）、追加Dを配る`);
ok(n1.wins.tobatoban === 2 && n1.tickets === 0, '旧セーブの勝ちは進捗として残し、チケットはまとめて配らない');
n1.chars.new_d_01.exp = 5000; const n2 = SAVE.normalize(JSON.parse(JSON.stringify(n1)));
ok(n2.chars.new_d_01.exp === 5000 && JSON.stringify(SAVE.normalize(JSON.parse(JSON.stringify(n2))).chars) === JSON.stringify(n2.chars), '2回移行しても増えも減りもしない（育てた追加DをLv1に戻さない）');
ok(SAVE.write(s), '書き込める');
const s2 = SAVE.login(1, 'neko22').save; ok(s2.tickets === s.tickets && Object.keys(s2.chars).length === 60 && s2.chars.kogemaru.exp === s.chars.kogemaru.exp && s2.chars.kogemaru.eq.join() === 'bracer_gold,bracer_purple', '閉じて開き直しても続きが残る（装備も）');
// 引き継ぎコード
const code = SAVE.encode(s2); console.log('   code length', code.length);
const d = SAVE.decode(code); ok(d.ok && d.save.id === 1 && d.save.chars.kogemaru.exp === s2.chars.kogemaru.exp && Object.keys(d.save.chars).length === 60 && d.save.tickets === s2.tickets && d.save.wins.yoshinoshin === 2 && d.save.chars.kogemaru.eq.join() === 'bracer_gold,bracer_purple' && d.save.akibaOpen && d.save.clear.ueno_street === 1, '引き継ぎコードを読み戻せる（所持・EXP・チケット・勝ち数・装備・解放）');
ok(SAVE.decode(code.toLowerCase().replace(/-/g, ' ')).ok, '小文字・区切りなしでも読める');
const bad = code.slice(0, 5) + (code[5] === 'A' ? 'B' : 'A') + code.slice(6); ok(!SAVE.decode(bad).ok, '1文字まちがえるとはじく');
const OLD = '056Q-NND7-E82G-6A00-1800-1ZR4'; // 第1版の形式（ID 77・出撃5・勝利3・撃破40）
const od = SAVE.decode(OLD); ok(od.ok && od.save.id === 77 && od.save.rec.mobs === 40 && od.save.clear.senju === 3 && Object.keys(od.save.chars).length === 20, '前の版のコードも読める（追加Dを配る）');
mem.clear();
ok(!SAVE.restore(1, 'wrongpw', code).ok, '別の端末：パスワードがちがうと引き継げない');
const rs = SAVE.restore(1, 'neko22', code); ok(rs.ok && SAVE.login(1, 'neko22').save.tickets === s2.tickets, '別の端末：コード＋ID＋パスワードで続きから');
console.log(fail ? `\n${fail}件 失敗` : '\nすべて合格'); process.exit(fail ? 1 : 0);
