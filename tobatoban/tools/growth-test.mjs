// 育成・名簿の検査：60体×99レベルの能力とEXPが設定データ（JSON）と一致するか、報酬の計算例
// 使い方: node tobatoban/tools/growth-test.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = ['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Error });
vm.runInContext(src + '\n;globalThis.__ = DATA; globalThis.__v7 = ROSTER_V7;', ctx);
const V7 = ctx.__v7, D = ctx.__, J = JSON.parse(fs.readFileSync(path.join(root, 'data', 'nightwatch-v2-game-data.json'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };
ok(D.CHARS.length === 60 && new Set(D.CHARS.map(c => c.id)).size === 60, `キャラは60体（${D.CHARS.length}）`);
let rows = 0, bad = 0, badExp = 0;
for (const jc of J.characters) {
  const c = D.CHI[jc.id]; if (!c) { bad++; continue; }
  for (const row of jc.levels) {
    rows++;
    if (D.GROWTH.cum(c.rank, row.level) !== row.cumulative_exp || D.GROWTH.toNext(c.rank, row.level) !== row.exp_to_next) badExp++;
    if (D.GROWTH.levelOf(c.rank, row.cumulative_exp) !== row.level) badExp++;
  }
}
// v7：Lv1＝設定表の値、旧式と同じ伸び率（旧式「そのLvの値÷Lv1の値」×新しいLv1）と比べる
let lv1bad = 0, mono = 0, devPt = 0, devAt = '';
const old = (cap, L, isHp) => { const st = Math.floor((cap * (isHp ? 60 : 65) + 50) / 100); return st + Math.floor((cap - st) * (L - 1) / 98); };
for (const c of D.CHARS) {
  const B = V7[c.id].base, s1 = D.GROWTH.stats(c, 1);
  if (s1.hp !== B[0] || s1.str !== B[1] || s1.yo !== B[2] || s1.def !== B[3]) { lv1bad++; console.log('  Lv1ずれ', c.id, s1, B); }
  let prev = s1;
  for (let L = 2; L <= 99; L++) {
    const s = D.GROWTH.stats(c, L); for (const k of ['hp', 'str', 'yo', 'def']) if (s[k] < prev[k]) mono++; prev = s;
    ['hp', 'str', 'yo', 'def'].forEach((k, i) => { const exp = B[i] * old(c.cap[i], L, i === 0) / old(c.cap[i], 1, i === 0), d = Math.abs(s[k] - exp) / exp; if (d > devPt) { devPt = d; devAt = `${c.id} Lv${L} ${k} ${s[k]}／旧式の比率なら${exp.toFixed(1)}`; } });
  }
}
ok(lv1bad === 0, `60体のLv1の4能力（240項目）が確定仕様と一致（ずれ ${lv1bad}）`);
{ let bad = []; for (const c of D.CHARS) { const v = V7[c.id]; if (c.nm !== v.nm || c.Anm !== v.A[0] || D.SKILLS[c.X].nm !== v.X[0] || D.SKILLS[c.Y].nm !== v.Y[0] || c.roleId !== v.role || (v.get === '初期') === !!c.isNew) bad.push(c.id); }
  ok(!bad.length && Object.keys(V7).length === 60, `60体の名前・役職・A/X/Y の技名（180枠）・初期/ガチャの区分が確定仕様どおり（ずれ ${bad.join(',') || 'なし'}）`);
  const init = D.CHARS.filter(c => !c.isNew).map(c => c.id), gacha = D.GACHA_IDS; ok(init.length === 10 && gacha.length === 50 && !init.some(i => gacha.includes(i)) && new Set(init.concat(gacha)).size === 60, `初期10件・ガチャ50件・重複なし・合わせて60件`); }
ok(mono === 0, `Lv1→99で能力が下がらない（下がった箇所 ${mono}）`);
ok(devPt < 0.025, `旧式の伸び率（整数丸めあり）との差は最大 ${(devPt * 100).toFixed(2)}%（${devAt}。旧式は小さい値の丸めで伸び率が少しぶれる）`);
ok(badExp === 0, `累積EXP・次までの必要量・EXPからのレベルが一致（ずれ ${badExp}）`);
for (const [r, T] of Object.entries(J.growth.rank_total_exp)) { let s = 0; for (let L = 1; L < 99; L++) s += D.GROWTH.toNext(r, L); ok(s === T && D.GROWTH.toNext(r, 99) === null, `ランク${r}：98区間の合計 ${s} = ${T}、Lv99の次は上限`); }
const k = D.CHI.kogemaru, k1 = D.GROWTH.stats(k, 1), k50 = D.GROWTH.stats(k, 50), k99 = D.GROWTH.stats(k, 99);
ok(k1.hp === 372 && k1.str === 223 && k1.yo === 61 && k1.def === 124 && k50.hp === 496 && k50.str === 283 && k99.hp === 620 && k99.str === 343, `地縛霊 Lv1 ${JSON.stringify(k1)} / Lv50 ${k50.hp}・${k50.str} / Lv99 ${k99.hp}・${k99.str}`);
const ai = D.GROWTH.aiStats(k1); ok(ai.hp === 353 && ai.str === 211 && ai.def === 117 && D.SIM.aiMul === 0.95, `AIは各能力×0.95の切り捨て・移動も95%（${JSON.stringify(ai)}）`);
const R = D.REWARD;
ok(R.exp('senju', true, 1, 1) === 10000 && R.exp('senju', true, 1, 0.8) === 8000, 'ソロでトバトーバ勝利：操作10,000・AI 8,000');
ok(R.exp('senju', true, 4, 1) === 10000 && R.exp('ueno', true, 4, 1) === 50000, '4人で勝利しても人間は100%（トバトーバ10,000・ヨシノシン50,000。人数の上乗せなし）');
ok(R.exp('ueno', true, 2, 1) === 50000 && R.exp('ueno', true, 2, 0.8) === 40000 && R.exp('joban', true, 1, 0.8) === 16000, '2人＋AI2体：人間50,000・AI 40,000／電車のAI枠16,000');
ok(R.exp('senju', false, 1, 1) === 2500 && R.exp('joban', true, 1, 1) === 20000 && R.exp('joban', false, 1, 1) === 5000 && R.exp('ueno', false, 1, 1) === 7000, '敗北・電車の報酬');
ok(R.rate(false) === 0.8 && R.rate(true) === 1 && R.exp('ueno_street', true, 1, 1) === 12000 && R.exp('ueno_street', false, 1, 0.8) === 2400 && R.exp('akiba_platform', true, 1, 1) === 20000 && R.exp('akiba_plaza', true, 1, 1) === 70000 && R.exp('akiba_plaza', false, 1, 1) === 10000, '固定率（メイン100%・ほか80%）と、通り・秋葉原の報酬');
ok(D.GROWTH.levelOf('D', 10000) === 11 && D.GROWTH.levelOf('B', 10000) === 10 && D.GROWTH.levelOf('A', 10000) === 9 && D.GROWTH.levelOf('S', 10000) === 8, '初勝利10,000でD/C Lv11・B Lv10・A Lv9・S Lv8');
ok(D.GROWTH.addExp('S', D.GROWTH.cum('S', 99) - 5, 999999) === D.GROWTH.cum('S', 99), 'Lv99を超えた分は上限に止める');
ok(D.GACHA_IDS.length === 50 && D.NEW_D_IDS.every(id => D.GACHA_IDS.includes(id)) && D.GACHA.weight.D > 0, 'v7：ガチャ対象は追加50体（Dも含む・Dの重みは0でない）');
ok(D.CHARS.every(c => D.SKILLS[c.X] && D.SKILLS[c.Y] && D.SPECIALS[c.sp] && D.MOVES[c.A]), '全員の通常攻撃・X・Y・必殺がそろっている');
console.log(fail ? `\n${fail}件 失敗` : '\nすべて合格'); process.exit(fail ? 1 : 0);
