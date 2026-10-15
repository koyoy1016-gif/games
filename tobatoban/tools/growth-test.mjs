// 育成・名簿の検査：60体×99レベルの能力とEXPが設定データ（JSON）と一致するか、報酬の計算例
// 使い方: node tobatoban/tools/growth-test.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = ['data.js', 'roster_data.js', 'roster.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Error });
vm.runInContext(src + '\n;globalThis.__ = DATA;', ctx);
const D = ctx.__, J = JSON.parse(fs.readFileSync(path.join(root, 'data', 'nightwatch-v2-game-data.json'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };
ok(D.CHARS.length === 60 && new Set(D.CHARS.map(c => c.id)).size === 60, `キャラは60体（${D.CHARS.length}）`);
let rows = 0, bad = 0, badExp = 0;
for (const jc of J.characters) {
  const c = D.CHI[jc.id]; if (!c) { bad++; continue; }
  for (const row of jc.levels) {
    rows++; const s = D.GROWTH.stats(c, row.level), w = row.stats;
    if (s.hp !== w.hp || s.str !== w.strength || s.yo !== w.spirit || s.def !== w.defense) { if (bad < 5) console.log('  ずれ', jc.id, row.level, s, w); bad++; }
    if (D.GROWTH.cum(c.rank, row.level) !== row.cumulative_exp || D.GROWTH.toNext(c.rank, row.level) !== row.exp_to_next) badExp++;
    if (D.GROWTH.levelOf(c.rank, row.cumulative_exp) !== row.level) badExp++;
  }
}
ok(rows === 5940 && bad === 0, `60体×99レベル＝${rows}行の能力がJSONと一致（ずれ ${bad}）`);
ok(badExp === 0, `累積EXP・次までの必要量・EXPからのレベルが一致（ずれ ${badExp}）`);
for (const [r, T] of Object.entries(J.growth.rank_total_exp)) { let s = 0; for (let L = 1; L < 99; L++) s += D.GROWTH.toNext(r, L); ok(s === T && D.GROWTH.toNext(r, 99) === null, `ランク${r}：98区間の合計 ${s} = ${T}、Lv99の次は上限`); }
const k = D.CHI.kogemaru, k1 = D.GROWTH.stats(k, 1), k50 = D.GROWTH.stats(k, 50), k99 = D.GROWTH.stats(k, 99);
ok(k1.hp === 534 && k1.str === 145 && k1.yo === 40 && k1.def === 81 && k50.hp === 712 && k50.str === 184 && k99.hp === 890 && k99.str === 223, `コゲマル Lv1 ${JSON.stringify(k1)} / Lv50 ${k50.hp}・${k50.str} / Lv99 ${k99.hp}・${k99.str}`);
const ai = D.GROWTH.aiStats(k1); ok(ai.hp === 480 && ai.str === 130 && ai.def === 72, `AIは各能力×0.9の切り捨て（${JSON.stringify(ai)}）`);
const R = D.REWARD;
ok(R.exp('senju', true, 1, 1) === 10000 && R.exp('senju', true, 1, 0.8) === 8000, 'ソロでトバトーバ勝利：操作10,000・AI 8,000');
ok(R.exp('senju', true, 4, 1) === 10000 && R.exp('ueno', true, 4, 1) === 50000, '4人で勝利しても人間は100%（トバトーバ10,000・ヨシノシン50,000。人数の上乗せなし）');
ok(R.exp('ueno', true, 2, 1) === 50000 && R.exp('ueno', true, 2, 0.8) === 40000 && R.exp('joban', true, 1, 0.8) === 16000, '2人＋AI2体：人間50,000・AI 40,000／電車のAI枠16,000');
ok(R.exp('senju', false, 1, 1) === 2500 && R.exp('joban', true, 1, 1) === 20000 && R.exp('joban', false, 1, 1) === 5000 && R.exp('ueno', false, 1, 1) === 7000, '敗北・電車の報酬');
ok(R.rate(false) === 0.8 && R.rate(true) === 1 && R.exp('ueno_street', true, 1, 1) === 12000 && R.exp('ueno_street', false, 1, 0.8) === 2400 && R.exp('akiba_platform', true, 1, 1) === 20000 && R.exp('akiba_plaza', true, 1, 1) === 70000 && R.exp('akiba_plaza', false, 1, 1) === 10000, '固定率（メイン100%・ほか80%）と、通り・秋葉原の報酬');
ok(D.GROWTH.levelOf('D', 10000) === 11 && D.GROWTH.levelOf('B', 10000) === 10 && D.GROWTH.levelOf('A', 10000) === 9 && D.GROWTH.levelOf('S', 10000) === 8, '初勝利10,000でD/C Lv11・B Lv10・A Lv9・S Lv8');
ok(D.GROWTH.addExp('S', D.GROWTH.cum('S', 99) - 5, 999999) === D.GROWTH.cum('S', 99), 'Lv99を超えた分は上限に止める');
ok(D.GACHA_IDS.length === 40 && D.NEW_D_IDS.length === 10 && D.GACHA_IDS.every(id => D.CHI[id].rank !== 'D'), 'ガチャ対象はC〜Sの40体、追加Dの10体は初期仲間');
ok(D.CHARS.every(c => D.SKILLS[c.X] && D.SKILLS[c.Y] && D.SPECIALS[c.sp] && D.MOVES[c.A]), '全員の通常攻撃・X・Y・必殺がそろっている');
console.log(fail ? `\n${fail}件 失敗` : '\nすべて合格'); process.exit(fail ? 1 : 0);
