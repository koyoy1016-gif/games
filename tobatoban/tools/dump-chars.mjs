// 全キャラ（味方10体・トバトーバン・札小僧・ヨシノシの部下）の能力と攻撃の一覧（CHARACTERS.md）を data.js から作る
// 使い方: node tobatoban/tools/dump-chars.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ Math, JSON, Object, Array, Number, String });
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'data.js'), 'utf8') + ';globalThis.__=DATA', ctx);
const D = ctx.__, S = D.SIM, B = D.DIFF.normal, MUL = B.dmgMul || 1;
const bossStr = Math.round(B.str * MUL), bossYo = Math.round(B.yo * MUL), bossDef = B.def;
// ダメージ式：威力 × 攻撃側の能力 ÷ (120 + 受ける側のまもり) × 属性 × 会心など
const dmg = (pw, atk, def, k) => Math.max(1, Math.round(pw * atk / (S.defBase + def) * (k || 1)));
const elemK = c => c.el === D.BOSS.weak ? S.elemGood : c.el === D.BOSS.strong ? S.elemBad : 1;
const skillTxt = (id) => {
  const s = D.SKILLS[id];
  const m = { charge: `${s.nm}（ためて離す・威力${s.pw}、最大${D.CHARGE.mul}倍、${s.stat === 'yo' ? 'ようりょく' : 'ちから'}）`, dodge: '回避（一瞬無敵）', dot: `${s.nm}（継続ダメージ 威力${s.pw}×${s.dur}回・ようりょく）`, retreat: `${s.nm}（下がりながら攻撃 威力${s.pw}）`, stealth: `${s.nm}（${s.dur}秒狙われにくい）`, parry: `${s.nm}（受け流して反撃 威力${s.pw}）`, heavy: `${s.nm}（ためて重い一撃 威力${s.pw}）`, trap: `${s.nm}（麻痺のワナ ${s.para}秒）`, protect: `${s.nm}（周りを一瞬無敵）`, guard: `${s.nm}（ガード：被ダメージ×${s.mul}${s.reflect ? '・3割を跳ね返す' : ''}）`, taunt: `${s.nm}（引きつけの一撃 威力${s.pw}）`, mine: `${s.nm}（地雷 威力${s.pw}・ちから＋ようりょくの平均）`, heal: `${s.nm}（回復 基礎${s.pw}、ためて最大${s.mul}倍・ようりょく）`, healRing: `${s.nm}（範囲回復 基礎${s.pw}・ようりょく）` };
  return m[s.kind] || s.nm;
};
const spTxt = c => { const s = D.SPECIALS[c.sp]; return s.type === 'multi' ? `${c.spNm}（${s.pw}×${s.n}${s.defDown ? '＋守り低下' : ''}）` : s.type === 'buff' ? `${c.spNm}（味方のちから×${s.mul}・${s.dur}秒）` : s.type === 'guardup' ? `${c.spNm}（自分のまもり×${s.mul}・${s.dur}秒＋引きつけ）` : `${c.spNm}（全員回復 ${s.pw}＋気絶した仲間を蘇生）`; };
const aTxt = c => c.A === 'combo3' ? `三連 ${c.Apw.join('/')}` : c.A === 'shot' ? `射撃 ${c.Apw[0]}` : `近接 ${c.Apw[0]}`;
const aDmg = c => c.Apw.map(pw => dmg(pw, c.str, bossDef, elemK(c))).join('/');
let md = `# キャラクターの能力と攻撃の一覧（自動生成）\n\n\`src/data.js\` から \`node tools/dump-chars.mjs\` で作っています。むずかしさは「通常」（1つだけ）。\n\n`;
md += `**ダメージの式**：威力 × 攻撃側のちから（または ようりょく）÷（120 ＋ 受ける側のまもり）× 属性 × 会心など。\n`;
md += `会心は通常5%で1.5倍。トバトーバンは土に弱く（×${S.elemGood}）、雷に強い（×${S.elemBad}）。AIが動かすキャラは、ちから・ようりょく・まもり・体力・移動速度がすべて${Math.round(S.aiMul * 100)}%になる。\n\n`;
md += `## 味方（10体・全員 Lv.1）\n\n| キャラ | 役割 | 属性 | HP | ちから | ようりょく | まもり | 通常攻撃（威力） | ボスへの通常攻撃1発 | 技1（X） | 技2（Y） | 必殺 | 特性 |\n|---|---|---|---:|---:|---:|---:|---|---|---|---|---|---|\n`;
for (const c of D.CHARS) md += `| ${c.nm} | ${c.role} | ${c.el} | ${c.hp} | ${c.str} | ${c.yo} | ${c.def} | ${aTxt(c)} | ${aDmg(c)} | ${skillTxt(c.X)} | ${skillTxt(c.Y)} | ${spTxt(c)} | ${c.psv} |\n`;
md += `\nHP ＝ 700 ＋ まもり×1.5（10の位で丸め）。\n\n`;
md += `## トバトーバン（ボス）\n\n| HP | ちから | ようりょく | まもり | 弱点 | 強い |\n|---:|---:|---:|---:|---|---|\n| ${B.hp} | ${bossStr}（${B.str}×${MUL}） | ${bossYo}（${B.yo}×${MUL}） | ${bossDef} | ${D.BOSS.weak} | ${D.BOSS.strong} |\n\n`;
const lo = D.CHARS.reduce((p, c) => c.def < p.def ? c : p), hi = D.CHARS.reduce((p, c) => c.def > p.def ? c : p);
md += `| 技 | 威力 | 使う能力 | 回数 | 1回のダメージ（${lo.nm}／${hi.nm}） | 予兆 |\n|---|---:|---|---|---|---:|\n`;
const M = D.BMOVES;
const rows = [['fubuki', '扇形2つ', `最大${M.fubuki.max}回`], ['shime', '背後の扇形', `最大${M.shime.max}回`], ['otoshi', '全員の足元', '1回'], ['kousen', '正面の直線', `最大${M.kousen.max}回`], ['harite', '正面の手のひら', '1回'], ['junkou', '飛んで横切る体当たり', '1回／横断（終盤は3横断）']];
for (const [k, shape, n] of rows) { const m = M[k]; const atk = m.stat === 'yo' ? bossYo : bossStr; md += `| ${m.nm}（${shape}） | ${m.pw} | ${m.stat === 'yo' ? 'ようりょく' : 'ちから'} | ${n} | ${dmg(m.pw, atk, lo.def)}／${dmg(m.pw, atk, hi.def)} | ${m.wind}秒 |\n`; }
md += `| 千住大巡行の落下提灯 | ${M.junkou.bombPw} | ようりょく | 落ちた所ごと | ${dmg(M.junkou.bombPw, bossYo, lo.def)}／${dmg(M.junkou.bombPw, bossYo, hi.def)} | ${M.junkou.bombFall}秒 |\n`;
md += `| 着地の衝撃 | 70 | ちから | 1回 | ${dmg(70, bossStr, lo.def)}／${dmg(70, bossStr, hi.def)} | 0.6秒 |\n`;
md += `| ${M.zouen.nm} | － | － | 札小僧を2体呼ぶ（同時に${M.zouen.max}体まで） | － | ${M.zouen.wind}秒 |\n\n`;
md += `HPが3分の1以下で「本気」になり、千住大巡行が3回横断になる（横・斜め・縦など毎回ちがう向き）。\n\n`;
const Mo = D.MOB;
md += `## 札小僧（ザコ）\n\n| HP | ちから | ようりょく | まもり | 攻撃 | 1回のダメージ（${lo.nm}／${hi.nm}） |\n|---:|---:|---:|---:|---|---|\n| ${B.mobHp} | ${Mo.str} | ${Mo.yo} | ${Mo.def} | 札を投げる（威力${Mo.shotPw}・${Mo.shotPeriod}秒ごと） | ${dmg(Mo.shotPw, Mo.str, lo.def)}／${dmg(Mo.shotPw, Mo.str, hi.def)} |\n\n`;
const J = D.JOBAN, W = J.wpn, wnm = { sword: '剣', fist: '拳', beam: '大砲（ビーム）' }, wdesc = { sword: `前方の扇（半径${W.sword.r}m）`, fist: `前方${W.fist.len}m・最初の1人だけ`, beam: `一直線${W.beam.len}m・最初の1人だけ・${W.beam.keep}mほど離れて撃つ` };
md += `## ヨシノシの部下（ステージ2・常磐線）\n\n全員同じ見た目（ヨシノシと同じ）。手の武器だけ違う。一番近い味方を集団でねらう（殴りかかるのは1人に${J.meleeTokens}体まで・ビームは同時に${J.beamTokens}体まで・車内に同時${J.maxActive}体まで）。\n\n| HP | まもり | 1回のダメージ | 歩く速さ |\n|---:|---:|---:|---:|\n| ${J.hp[0]}〜${J.hp[1]} | ${J.def} | ${J.dmg[0]}〜${J.dmg[1]}（まもりに関係なく。AIが動かすキャラは体力90%相当なので1割ほど多め） | ${J.speed[0]}〜${J.speed[1]} m/秒 |\n\n| 武器 | 届く距離 | 予兆 | 次の攻撃まで | 当たり方 |\n|---|---:|---:|---|---|\n`;
for (const k of ['sword', 'fist', 'beam']) md += `| ${wnm[k]} | ${W[k].reach}m | ${W[k].wind}秒 | ${W[k].cd[0]}〜${W[k].cd[1]}秒 | ${wdesc[k]} |\n`;
md += `\n出てくる数：最初に2号車に${J.waves[0]}体 → ${J.waves[0]}体倒すと1号車から${J.waves[1]}体 → その${J.waves[1]}体を倒すと${J.waves[2]}体。さらに${J.stations.slice(1, 4).join('・')}で${J.boardN}体ずつ乗ってくる（合計${J.waves.reduce((a, b) => a + b, 0) + J.boardN * 3}体）。全部倒すと${J.stations[4]}に着いてクリア。\n\n`;
md += `## 回復・救助\n\n| もの | 効果 |\n|---|---|\n| 救助 | 気絶した仲間のまわりの円に${S.reviveTime}秒いると復活（HP 3分の1）。2人で入ると${S.reviveFaster[2] * 100}%、3人で${S.reviveFaster[3] * 100}%早い。モミジ翁が円にいると${S.reviveTimeMomiji}秒・HP${Math.round(S.reviveHpMomiji * 100)}%。30秒放っておくと昇天 |\n| キャンディー | ${S.candyPeriod}秒ごとに1つ（最大${S.candyMax}個）。取るとHP全回復 |\n| おにぎり | HPを${Math.round(D.ITEMS.onigiri.heal * 100)}%回復 |\n| ブリキドンの食べ物 | ${S.foodPeriod}秒ごと。HPを${Math.round(S.foodHeal * 100)}%回復 |\n`;
fs.writeFileSync(path.join(root, 'CHARACTERS.md'), md);
console.log(md);
