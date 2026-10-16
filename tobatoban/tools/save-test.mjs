// セーブ（ID＋パスワード・引き継ぎコード）の検査
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js', 'save.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
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
ok(Object.keys(r.save.chars).length === 10 && Object.values(r.save.chars).every(c => c.lv === 1 && c.exp === 0), `v7：新しいセーブは既存10体だけを所持・全員Lv1（${Object.keys(r.save.chars).length}体）`);
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
ok(s.wins.story === 1 && s.tickets === 0, 'v7：ストーリー1回のクリアではチケットなし（残り1回分を保存）');
SAVE.apply(s, solo(false, 'senju', 'b2')); ok(s.wins.story === 1 && s.chars.kogemaru.exp === 12500, '敗北は2,500・チケットの進捗は進まない');
const op3 = solo(true, 'senju', 'b3'); SAVE.apply(s, op3); const op4 = solo(true, 'senju', 'b4'); SAVE.apply(s, op4);
ok(s.wins.story === 3 && s.tickets === 1 && op3.res.ticket === 1 && op4.res.ticket === 0, `同じステージの再クリアでも2回目で1枚・3回目は0枚（${s.tickets}枚）`);
ok(!SAVE.setEquip(s, 'kogemaru', 0, 'bracer_50').ok, 'v8：新しいアカウントは装備0個（持っていない装備は付けられない）');
s.eqInv = Object.assign(s.eqInv || {}, { bracer_50: 1, bracer_40: 1, charm_50: 1 }); // 検査用に所持させる
ok(SAVE.eqSlots(s) === 1 && SAVE.setEquip(s, 'kogemaru', 0, 'bracer_50').ok && !SAVE.setEquip(s, 'kogemaru', 1, 'charm_50').ok, '電車クリア前の装備は1枠');
const op5 = solo(true, 'joban', 'b5'); SAVE.apply(s, op5); ok(s.tickets === 2 && s.wins.story === 4 && op5.res.ticket === 1 && !s.uenoOpen && s.clear.joban === 1 && op5.res.unlocked === 'ueno_street', '別のステージ（電車）でも数える：4回目で2枚目。居酒屋通りが解放される（ボスはまだ）');
ok(SAVE.eqSlots(s) === 2 && SAVE.setEquip(s, 'kogemaru', 1, 'bracer_40').ok && !SAVE.setEquip(s, 'kogemaru', 1, 'bracer_50').ok, '電車クリア後は2枠（同じ系統の別段階はOK・同じIDの二重は不可）');
{ const st = DATA.GROWTH.withEquip(DATA.GROWTH.stats(DATA.CHI.kagetsubame, 60), ['bracer_50', 'charm_50']), hp2 = DATA.GROWTH.withEquip(DATA.GROWTH.stats(DATA.CHI.kagetsubame, 60), ['magatama_100']);
  ok(st.hp === 1165 && st.str === 475 && st.yo === 193 && st.def === 331 && hp2.hp === 2330, `Lv60大蛇＋ちから50%＋まもり50%＝HP${st.hp}・ちから${st.str}・ようりょく${st.yo}・まもり${st.def}、HP+100%＝${hp2.hp}`);
  const s2 = DATA.GROWTH.withEquip({ hp: 100, str: 100, yo: 100, def: 100 }, ['bracer_40', 'bracer_50']); ok(s2.str === 190, `同じ能力は足し算（+40%と+50%で×1.90＝${s2.str}）`);
  const s3 = DATA.GROWTH.withEquip({ hp: 100, str: 100, yo: 100, def: 100 }, ['bracer_60', 'bracer_50']); ok(s3.str === 210 && s3.hp === 100 && s3.yo === 100, `力60%＋50%＝×2.10（${s3.str}）・ほかの能力は上がらない`);
  ok(DATA.EQ_DROP_IDS.length === 16 && DATA.EQ_DROP_IDS.every(id => [30, 40, 50, 60].includes(DATA.EQUIP_I[id].pct)) && !DATA.EQ_DROP_IDS.includes('magatama_100'), '入手する装備は16種類（4能力×30/40/50/60%）。旧HP100%は入らない'); }
{ // v8：装備は個数で持つ。持っている数まで別のキャラにも付けられる
  const r1 = SAVE.setEquip(s, 'hoshisuzume', 0, 'bracer_50');
  ok(!r1.ok && r1.owner === 'kogemaru' && /装備中/.test(r1.msg), `1個しか持っていない装備は、ほかのキャラが付けていると付けられない（${r1.msg}）`);
  s.eqInv.bracer_50 = 2; const r1b = SAVE.setEquip(s, 'hoshisuzume', 0, 'bracer_50');
  ok(r1b.ok && s.chars.kogemaru.eq.includes('bracer_50') && s.chars.hoshisuzume.eq[0] === 'bracer_50' && SAVE.eqCount(s, 'bracer_50').used === 2 && SAVE.eqCount(s, 'bracer_50').free === 0, '2個持っていれば2体に同時に付けられる（所持2・装備中2・使える0）');
  ok(!SAVE.discardEquip(s, 'bracer_50', 1).ok, '装備中の分は捨てられない');
  s.chars.hoshisuzume.eq = []; ok(SAVE.discardEquip(s, 'bracer_50', 1).ok && s.eqInv.bracer_50 === 1 && s.chars.kogemaru.eq.includes('bracer_50'), '余りの1個だけ捨てられる（付けている分はそのまま）');
  const r2 = SAVE.setEquip(s, 'hoshisuzume', 0, 'bracer_50', { move: true });
  ok(r2.ok && r2.moved === 'kogemaru' && s.chars.hoshisuzume.eq[0] === 'bracer_50' && !s.chars.kogemaru.eq.includes('bracer_50'), '付け替え（明示）なら前のキャラから外して付ける');
  s.chars.kogemaru.eq = ['bracer_50', 'bracer_40']; s.chars.hoshisuzume.eq = []; // 元へ戻す
  const u = SAVE.uniqEq([['bracer_50'], ['bracer_50', 'bell_30'], ['bell_30']], { eqInv: { bracer_50: 1, bell_30: 2 } }); ok(u.map(x => x.join('+')).join('|') === 'bracer_50|bell_30|bell_30', `出動時は持っている数まで（${u.map(x => x.join('+') || '−').join('｜')}）`);
  // 旧セーブ（v7）の移行：付けていた旧装備はその数だけ持っている扱い・付けていない旧装備は配らない・旧HP100%は旧装備として残す・何度読んでも同じ
  const old = JSON.parse(JSON.stringify(s)); delete old.eqInv; delete old.mig.eq8; old.chars.kogemaru.eq = ['bracer_gold', 'magatama_gold']; old.chars.momiji.eq = ['bracer_gold']; old.chars.taiko.eq = ['charm_blue'];
  const m1 = SAVE.normalize(old), m2 = SAVE.normalize(JSON.parse(JSON.stringify(m1)));
  ok(m1.eqInv.bracer_50 === 2 && m1.eqInv.magatama_100 === 1 && m1.eqInv.charm_30 === 1 && !m1.eqInv.bell_30 && m1.chars.kogemaru.eq.join() === 'bracer_50,magatama_100' && m1.chars.momiji.eq.join() === 'bracer_50' && m1.bakEq8 && m1.bakEq8.kogemaru.join() === 'bracer_gold,magatama_gold' && JSON.stringify(m2.eqInv) === JSON.stringify(m1.eqInv) && JSON.stringify(m2.chars) === JSON.stringify(m1.chars), `旧セーブ：付けていた分だけ所持（腕輪金×2・旧勾玉×1・お守り青×1）、元の付け方は控えに残す。読み直しても同じ`);
  const fr = SAVE.normalize(SAVE.fresh(9, 'x')); ok(Object.keys(fr.eqInv).length === 0, '新しいアカウントは装備0個');
  // ステージ勝利の装備（開発用の確認：40%・16種類から等確率・同じ戦闘では1回だけ・上限30）
  const q = SAVE.normalize(SAVE.fresh(5, 'x')); let got = 0; const kinds = {}; for (let i = 0; i < 4000; i++) { const e = SAVE.eqDraw(q, 'bt' + i); if (e) { got++; kinds[e] = (kinds[e] || 0) + 1; } }
  const kv = Object.values(kinds); ok(Math.abs(got / 4000 - 0.4) < 0.03 && Object.keys(kinds).length === 16 && Math.min(...kv) > 60, `4,000回で${(got / 40).toFixed(1)}%・16種類すべて（最少${Math.min(...kv)}・最多${Math.max(...kv)}）`);
  ok(SAVE.eqDraw(q, 'same') === SAVE.eqDraw(q, 'same'), '同じ戦闘IDなら何度引いても同じ結果（読み直しで引き直さない）');
  const full = SAVE.normalize(SAVE.fresh(6, 'x')); for (const id of DATA.EQ_DROP_IDS) full.eqInv[id] = 30; let none = 0; for (let i = 0; i < 50; i++) if (SAVE.eqDraw(full, 'f' + i) === null) none++; ok(none === 50, '全種類が上限30個なら受け取りなし（ほかの報酬は通常どおり）');
  full.eqInv.bell_60 = 29; let only = new Set(); for (let i = 0; i < 300; i++) { const e = SAVE.eqDraw(full, 'g' + i); if (e) only.add(e); } ok(only.size === 1 && only.has('bell_60'), '上限に達した種類は候補から外す');
  const w = SAVE.normalize(SAVE.fresh(7, 'x')); let wins = 0, eqs = 0; for (let i = 0; i < 200; i++) { const op = solo(true, ['senju', 'joban', 'ueno_street', 'ueno', 'akiba_platform', 'akiba_plaza'][i % 6], 'w' + i); SAVE.apply(w, op); wins++; if (op.res.equip) eqs++; const again = solo(true, 'senju', 'w' + i); SAVE.apply(w, again); if (again.res.equip) eqs += 100; }
  const lose = solo(false, 'senju', 'l1'); SAVE.apply(w, lose); ok(eqs > 50 && eqs < 110 && !lose.res.equip && Object.values(w.eqInv).reduce((a, b) => a + b, 0) === eqs, `勝利200回で装備${eqs}個（同じ戦闘IDの二度目・敗北では手に入らない）`);
}
const op5b = solo(true, 'ueno_street', 'b5b'); SAVE.apply(s, op5b); ok(s.uenoOpen && op5b.res.unlocked === 'ueno' && s.chars.kogemaru.exp - 10000 * 3 - 2500 - 20000 === 12000, '居酒屋通りの勝利（EXP12,000）で上野のボスが解放される');
SAVE.apply(s, solo(true, 'ueno', 'b6')); SAVE.apply(s, solo(true, 'ueno', 'b7')); ok(s.wins.story === 7 && s.tickets === 3 && s.akibaOpen, `通り・上野2回で計7回＝3枚（${s.tickets}枚）・秋葉原編が解放される`);
SAVE.apply(s, solo(true, 'akiba_plaza', 'b7b')); ok(s.wins.story === 8 && s.tickets === 4, '秋葉原も数える（8回で4枚）');
const op8 = solo(true, 'senju', 'b8'); op8.fin.retreat = true; const e0 = s.chars.kogemaru.exp; SAVE.apply(s, op8); ok(s.chars.kogemaru.exp === e0 && s.wins.story === 8, '撤退は報酬なし・チケットも進まない');
const coop = { kills: {}, fin: { bid: 'c1', stage: 'senju', win: true, H: 4, slots: [{ ch: 'momiji', rate: 1 }] } }; const m0 = s.chars.momiji.exp; SAVE.apply(s, coop); ok(s.chars.momiji.exp - m0 === 10000, '4人で勝っても人間は100%＝10,000（人数ボーナスは廃止）');
// ガチャ
ok(SAVE.gachaPool(s).length === 50, 'v7：ガチャ対象は未所持の50体（Dも出る）');
const r0 = SAVE.gachaRates(s); ok(Math.abs(r0.D - 4 / 14) < 1e-9 && Math.abs(r0.C - 0.25) < 1e-9 && Math.abs(r0.B - 0.25) < 1e-9 && Math.abs(r0.A - 2.2 / 14) < 1e-9 && Math.abs(r0.S - 0.8 / 14) < 1e-9, `最初の割合 D${(r0.D * 100).toFixed(1)}・C${(r0.C * 100).toFixed(1)}・B${(r0.B * 100).toFixed(1)}・A${(r0.A * 100).toFixed(1)}・S${(r0.S * 100).toFixed(1)}%`);
const tk0 = s.tickets, g1 = SAVE.gachaDraw(s, 'q1', 0.999); ok(g1.ok && s.tickets === tk0 - 1 && s.chars[g1.res.id] && s.chars[g1.res.id].lv === 1 && s.chars[g1.res.id].exp === 0, `1枚で1体（${g1.res.id}・${g1.res.rank}・Lv1・EXP0）`);
const g1b = SAVE.gachaDraw(s, 'q1', 0.1); ok(g1b.again && g1b.res.id === g1.res.id && s.tickets === tk0 - 1, '同じ依頼IDの再送では引き直さず、二重に消費しない');
for (let i = 0; i < 49; i++) { s.tickets++; SAVE.gachaDraw(s, 'r' + i, (i * 0.37) % 1); }
ok(SAVE.gachaPool(s).length === 0 && Object.keys(s.chars).length === 60, `50体すべて重複なしで入手（所持${Object.keys(s.chars).length}体）`);
const rr = SAVE.gachaRates(s); ok(rr.D === 0 && rr.C === 0 && rr.S === 0, '全員所持のランクは0%');
const ex = SAVE.gachaExchange(s, 'kogemaru', 'x1'); ok(ex.ok && s.chars.kogemaru.exp === e0 + 10000, '全50体入手後は1枚をEXP10,000と交換');
// 移行：Lvだけの旧セーブ・追加Dの一度だけの配布
const old = { id: 5, pw: 'x', chars: { kogemaru: { lv: 12, exp: 0, b: 3, w: 2, k: 9 } }, rec: { b: 3, w: 2, mobs: 9, best: 300 } };
const n1 = SAVE.normalize(JSON.parse(JSON.stringify(old)));
ok(n1.chars.kogemaru.lv === 12 && n1.chars.kogemaru.exp === DATA.GROWTH.cum('D', 12) && DATA.NEW_D_IDS.every(id => !n1.chars[id]), `Lvだけの旧セーブはそのLvの累積EXPに（Lv${n1.chars.kogemaru.lv}）、v7では追加Dを配らない`);
ok(n1.wins.tobatoban === 2 && n1.tickets === 0 && n1.wins.story === 0, '旧セーブの勝ちは記録として残し、チケットはまとめて配らない（共通の勝利数は移行時点の0から）');
{ const v6 = JSON.parse(JSON.stringify(n1)); delete v6.mig.tk2; delete v6.wins.story; v6.wins.tobatoban = 5; v6.tickets = 3; const m1 = SAVE.normalize(v6), m2 = SAVE.normalize(JSON.parse(JSON.stringify(m1)));
  ok(m1.tickets === 3 && m1.wins.story === 0 && m1.mig.tk2 === 1 && m2.wins.story === 0 && m2.tickets === 3, 'v6セーブ：持っているチケット3枚はそのまま・旧の端数（トバトーバ5勝）は配り直さない・何度読んでも同じ'); }
n1.chars.new_d_01 = { lv: 1, exp: 5000, got: 1, seen: 1, b: 0, w: 0, k: 0, eq: [] }; const n2 = SAVE.normalize(JSON.parse(JSON.stringify(n1)));
ok(n2.chars.new_d_01.exp === 5000 && JSON.stringify(SAVE.normalize(JSON.parse(JSON.stringify(n2))).chars) === JSON.stringify(n2.chars), '2回移行しても増えも減りもしない（v6までに入手した追加Dは取り上げず、Lv1に戻さない）');
ok(SAVE.write(s), '書き込める');
const s2 = SAVE.login(1, 'neko22').save; ok(s2.tickets === s.tickets && Object.keys(s2.chars).length === 60 && s2.chars.kogemaru.exp === s.chars.kogemaru.exp && s2.chars.kogemaru.eq.join() === 'bracer_50,bracer_40' && JSON.stringify(s2.eqInv) === JSON.stringify(s.eqInv), '閉じて開き直しても続きが残る（装備と所持数も）');
// 引き継ぎコード
const code = SAVE.encode(s2); console.log('   code length', code.length);
const d = SAVE.decode(code); ok(d.ok && d.save.id === 1 && d.save.chars.kogemaru.exp === s2.chars.kogemaru.exp && Object.keys(d.save.chars).length === 60 && d.save.tickets === s2.tickets && d.save.wins.yoshinoshin === 2 && d.save.chars.kogemaru.eq.join() === 'bracer_50,bracer_40' && JSON.stringify(d.save.eqInv) === JSON.stringify(s2.eqInv) && d.save.akibaOpen && d.save.clear.ueno_street === 1, '引き継ぎコードを読み戻せる（所持・EXP・チケット・勝ち数・装備・解放）');
ok(SAVE.decode(code.toLowerCase().replace(/-/g, ' ')).ok, '小文字・区切りなしでも読める');
const bad = code.slice(0, 5) + (code[5] === 'A' ? 'B' : 'A') + code.slice(6); ok(!SAVE.decode(bad).ok, '1文字まちがえるとはじく');
const OLD = '056Q-NND7-E82G-6A00-1800-1ZR4'; // 第1版の形式（ID 77・出撃5・勝利3・撃破40）
const od = SAVE.decode(OLD); ok(od.ok && od.save.id === 77 && od.save.rec.mobs === 40 && od.save.clear.senju === 3 && Object.keys(od.save.chars).length === 10, '前の版のコードも読める（v7では追加Dを配らない）');
mem.clear();
ok(!SAVE.restore(1, 'wrongpw', code).ok, '別の端末：パスワードがちがうと引き継げない');
const rs = SAVE.restore(1, 'neko22', code); ok(rs.ok && SAVE.login(1, 'neko22').save.tickets === s2.tickets, '別の端末：コード＋ID＋パスワードで続きから');
console.log(fail ? `\n${fail}件 失敗` : '\nすべて合格'); process.exit(fail ? 1 : 0);
