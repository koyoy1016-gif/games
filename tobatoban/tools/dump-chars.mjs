// 全キャラ（味方60体・トバトーバン・札小僧・常磐線の部下・ヨシノシンと上野の部下）の一覧（CHARACTERS.md）を作る
// 使い方: node tobatoban/tools/dump-chars.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ Math, JSON, Object, Array, Number, String });
vm.runInContext(['data.js', 'roster_data.js', 'roster.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n') + ';globalThis.__=DATA', ctx);
const D = ctx.__, S = D.SIM, B = D.DIFF.normal, MUL = B.dmgMul || 1, GR = D.GROWTH;
const bossStr = Math.round(B.str * MUL), bossYo = Math.round(B.yo * MUL), bossDef = B.def;
const dmg = (pw, atk, def, k) => Math.max(1, Math.round(pw * atk / (S.defBase + def) * (k || 1)));
const st = (c, L) => GR.stats(c, L);
const fmtS = s => `${s.hp}/${s.str}/${s.yo}/${s.def}`;
const oldSkill = id => { const s = D.SKILLS[id]; return s ? s.nm : id; };
let md = `# キャラクターの能力と攻撃の一覧（自動生成）\n\n\`src/data.js\`・\`src/roster_data.js\`・\`src/roster.js\` から \`node tools/dump-chars.mjs\` で作っています。\n\n`;
md += `**ダメージの式**（敵味方共通）：max(1, 四捨五入(威力 × 攻撃側のちから〈物理〉または ようりょく〈妖術〉 ÷ (120 ＋ 受ける側のまもり) × 属性 × 会心 × 状態 × 上野のLv補正))。\n`;
md += `会心は通常5%で1.5倍。トバトーバンは土×${S.elemGood}・雷×${S.elemBad}、ヨシノシンは全属性×1。AIが動かすキャラは HP・ちから・ようりょく・まもりが各90%（切り捨て）、移動も90%。威力・モーション・再使用時間は変えない。\n\n`;
md += `**成長**：HPの初期値＝四捨五入(Lv99値×0.60)、ほかは四捨五入(Lv99値×0.65)。能力(L)＝初期値＋floor((Lv99値−初期値)×(L−1)/98)。必要EXPはランクごとの表（D/Cが Lv99まで累計 ${GR.cum('D', 99).toLocaleString()}、Bが ${GR.cum('B', 99).toLocaleString()}、Aが ${GR.cum('A', 99).toLocaleString()}、Sが ${GR.cum('S', 99).toLocaleString()}）。\n\n`;
md += `## 味方60体（HP/ちから/ようりょく/まもり）\n\n| ランク | キャラ | 役割 | 属性 | 得意 | Lv1 | Lv40 | Lv99 | 通常攻撃（A） | 技1（X） | 技2（Y） | 必殺 | 入手 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
const order = { S: 0, A: 1, B: 2, C: 3, D: 4 };
const list = D.CHARS.slice().sort((a, b) => order[a.rank] - order[b.rank] || (a.isNew ? 1 : 0) - (b.isNew ? 1 : 0));
for (const c of list) {
  const fx = c.fx || {};
  const X = fx.X ? `${D.SKILLS[c.X].nm}：${fx.X}` : oldSkill(c.X), Y = fx.Y ? `${D.SKILLS[c.Y].nm}：${fx.Y}` : oldSkill(c.Y), SP = fx.SP ? `${c.spNm}：${fx.SP}` : c.spNm;
  const A = `${c.Anm || (c.A === 'combo3' ? '三連' : c.A.startsWith('shot') ? '射撃' : '近接')} ${c.Apw.join('/')}`;
  md += `| ${c.rank} | ${c.nm} | ${D.ROLES[c.roleId].label} | ${c.el} | ${(c.tags || []).join('・')} | ${fmtS(st(c, 1))} | ${fmtS(st(c, 40))} | ${fmtS(st(c, 99))} | ${A} | ${X} | ${Y} | ${SP} | ${c.isNew ? (c.gacha ? 'ガチャ' : '最初から（追加D）') : '最初から'} |\n`;
}
md += `\n## トバトーバン（北千住編のボス）\n\n| HP | ちから | ようりょく | まもり | 弱点 | 強い |\n|---:|---:|---:|---:|---|---|\n| ${B.hp} | ${bossStr} | ${bossYo} | ${bossDef} | ${D.BOSS.weak} | ${D.BOSS.strong} |\n\n`;
const ko40 = st(D.CHI.kogemaru, 40), nr40 = st(D.CHI.norenbou, 40);
const M = D.BMOVES;
md += `| 技 | 威力 | 使う能力 | Lv40コゲマル（まもり${ko40.def}）／Lv40ノレン坊（まもり${nr40.def}） | 予兆 |\n|---|---:|---|---|---:|\n`;
for (const k of ['fubuki', 'shime', 'otoshi', 'kousen', 'harite', 'junkou']) { const m = M[k]; const atk = m.stat === 'yo' ? bossYo : bossStr; md += `| ${m.nm} | ${m.pw} | ${m.stat === 'yo' ? 'ようりょく' : 'ちから'} | ${dmg(m.pw, atk, ko40.def)}／${dmg(m.pw, atk, nr40.def)} | ${m.wind}秒 |\n`; }
const Mo = D.MOB;
md += `\n## 札小僧（北千住のザコ）\n\n| HP | ちから | ようりょく | まもり | 攻撃 |\n|---:|---:|---:|---:|---|\n| ${B.mobHp} | ${Mo.str} | ${Mo.yo} | ${Mo.def} | 札を投げる（威力${Mo.shotPw}・${Mo.shotPeriod}秒ごと） |\n\n`;
const J = D.JOBAN, k20 = st(D.CHI.kogemaru, 20);
const typeRow = (T, def) => `| ${T.nm} | ${T.hp} | ${T.str} | ${T.yo} | ${T.def} | ${T.stat === 'yo' ? '妖術' : '物理'}${T.pw} | ${T.warn}秒／${T.period}秒 | ${T.spd}m/秒 | ${dmg(T.pw, T.stat === 'yo' ? T.yo : T.str, def)} |\n`;
md += `## ヨシノシンの部下（常磐線・全${J.events.reduce((s, e) => s + e.n, 0)}体・推奨Lv20）\n\n| 種類 | HP | ちから | ようりょく | まもり | 攻撃 | 予兆／最短周期 | 移動 | Lv20コゲマル（まもり${k20.def}）への1発 |\n|---|---:|---:|---:|---:|---|---|---:|---:|\n`;
for (const k in J.types) md += typeRow(J.types[k], k20.def);
md += `\n攻撃権：同時に攻撃権を持つのは近接${J.rights.melee}体・ビーム${J.rights.beam}体まで（権利は予兆開始から最短周期のあいだ保持して交代）。車内の生存上限${J.maxActive}体。\n\n`;
md += `| イベント | 数（前／後） |\n|---|---|\n`;
for (const e of J.events) md += `| ${e.nm || e.id} | ${e.n}${e.front != null ? `（${e.front}／${e.back}）` : ''} |\n`;
const SR = D.STREET;
if (SR) md += `\n## 上野の居酒屋通り\n\n小型の部下${SR.n || 30}体（電車の部下の値×${SR.mul || 1.25}）。暖簾の結界3つを順に開けて進む。\n\n`;
const U = D.UENO, UM = U.moves;
md += `## ヨシノシン（上野編のボス・推奨Lv40）\n\n| HP | ちから | ようりょく | まもり | 身長 |\n|---:|---:|---:|---:|---:|\n| ${U.hp} | ${U.str} | ${U.yo} | ${U.def} | ${U.bossH}m |\n\n`;
md += `| 技 | 威力 | 予兆 | 再使用 | Lv40コゲマル（まもり${ko40.def}）への1発 |\n|---|---:|---:|---:|---:|\n`;
for (const k in UM) { const m = UM[k]; md += `| ${m.nm} | ${m.pw || '－'} | ${m.warn != null ? m.warn + '秒' : '－'} | ${m.cd ? m.cd + '秒' : '－'} | ${m.pw ? dmg(m.pw, m.stat === 'yo' ? U.yo : U.str, ko40.def) : '－'} |\n`; }
md += `\n30分睡眠チャージ：${UM.sleep.stages.map(x => `HP${x.at.toLocaleString()}で10秒に${x.need.toLocaleString()}`).join('・')}（被ダメージ×${UM.sleep.mul}、失敗は全回復して1段目から）。\n\n`;
md += `### 上野の部下（最初 ビーム${U.init.beam}・剣${U.init.sword}・パンチ${U.init.punch}／生存上限${U.cap}体／同時攻撃 近接${U.rights.melee}＋ビーム${U.rights.beam}）\n\n| 種類 | HP | ちから | ようりょく | まもり | 攻撃 | 予兆／最短周期 | 移動 | Lv40コゲマルへの1発 |\n|---|---:|---:|---:|---:|---|---|---:|---:|\n`;
for (const k in U.minions) md += typeRow(U.minions[k], ko40.def);
const A = D.AKIBA, k60 = st(D.CHI.kogemaru, 60);
md += `\n## 秋葉原編（推奨Lv${A.rec}）\n\n| 敵 | HP | ちから | ようりょく | まもり | 身長（見た目） |\n|---|---:|---:|---:|---:|---:|\n`;
for (const k in A.foes) { const f = A.foes[k]; md += `| ${f.nm} | ${f.hp.toLocaleString()} | ${f.str} | ${f.yo} | ${f.def} | ${(f.h * (f.scale || 1)).toFixed(2)}m（×${f.scale || 1}） |\n`; }
md += `\n| 技 | 使う人 | 威力 | 予兆 | 再使用 | Lv60コゲマル（まもり${k60.def}）への1発 |\n|---|---|---:|---:|---:|---:|\n`;
for (const k in A.moves) { const m = A.moves[k], f = A.foes[m.who]; md += `| ${m.nm} | ${f.nm} | ${m.pw || '－'} | ${m.warn}秒 | ${m.cd}秒 | ${m.pw ? dmg(m.pw, m.stat === 'yo' ? f.yo : f.str, k60.def) : '－'} |\n`; }
md += `\n星と中：片方が倒れてから${A.twin.window}秒以内にもう片方も倒すと勝ち。間に合わなければ倒れた方だけHP${A.twin.revive.toLocaleString()}で復活。同時に通常攻撃する相手は全体で${A.rights}人。\n`;
md += `\n## 回復・救助\n\n| もの | 効果 |\n|---|---|\n| 救助 | 気絶した仲間のまわりの円に${S.reviveTime}秒いると復活 |\n| キャンディー | ${S.candyPeriod}秒ごとに1つ（最大${S.candyMax}個）。取るとHP全回復 |\n| おにぎり | HPを${Math.round(D.ITEMS.onigiri.heal * 100)}%回復 |\n`;
fs.writeFileSync(path.join(root, 'CHARACTERS.md'), md);
console.log('CHARACTERS.md', md.split('\n').length, 'lines');
