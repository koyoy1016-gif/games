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
const J = D.JOBAN;
md += `## ヨシノシンの部下（常磐線・全135体・推奨Lv20）\n\n| 種類 | HP | ちから | ようりょく | まもり | 攻撃 | 予兆／最短周期 | 移動 | Lv20コゲマル（まもり${st(D.CHI.kogemaru, 20).def}）への1発 |\n|---|---:|---:|---:|---:|---|---|---:|---:|\n`;
for (const k of ['melee', 'beam', 'guard']) { const T = J.types[k]; md += `| ${T.nm} | ${T.hp} | ${T.str} | ${T.yo} | ${T.def} | ${T.stat === 'yo' ? '妖術' : '物理'}${T.pw} | ${T.warn}秒／${T.period}秒 | ${T.spd}m/秒 | ${dmg(T.pw, T.stat === 'yo' ? T.yo : T.str, st(D.CHI.kogemaru, 20).def)} |\n`; }
md += `\n防御役は最大${J.types.guard.gMax}秒だけガード（受けるダメージ×${J.types.guard.gMul}・再使用${J.types.guard.gCd}秒）。同時に攻撃を始めるのは近接・防御${J.rights.melee}体、ビーム${J.rights.beam}体まで（車内には最大${J.maxActive}体）。各イベントの内訳は近接60%・ビーム25%・防御15%（最大剰余法）。\n\n`;
md += `| イベント | 発生 | 数 | 入り方 |\n|---|---|---:|---|\n`;
const at = a => a === 'start' ? '乗車して戦闘開始' : a.startsWith('kill:') ? `${a.slice(5)}を全部倒す` : a.startsWith('st:') ? `${J.stations[+a.slice(3)]}に停車してドアが開く` : `${J.stations[+a.slice(4)]}→${J.stations[+a.slice(4) + 1]}の走行距離50%`;
for (const e of J.events) md += `| ${e.id} | ${at(e.at)} | ${e.n} | ${{ in: '2号車にいる', front: '1号車から', door: 'ホーム側のドア' }[e.from]} |\n`;
md += `\n合計 ${J.events.reduce((s, e) => s + e.n, 0)}体。全イベント発生済み・待機0・車内0で上野に着く。\n\n`;
const U = D.UENO, UM = U.moves;
md += `## ヨシノシン（上野編のボス・推奨Lv40）\n\n| HP | ちから | ようりょく | まもり | 身長 |\n|---:|---:|---:|---:|---:|\n| ${U.hp} | ${U.str} | ${U.yo} | ${U.def} | ${U.bossH}m |\n\n`;
md += `| 技 | 内容 | 威力 | 予兆 | 再使用 | Lv40コゲマル（まもり${ko40.def}）／Lv40ノレン坊（まもり${nr40.def}） |\n|---|---|---:|---:|---:|---|\n`;
const urow = (m, desc, stat) => `| ${m.nm} | ${desc} | ${m.pw || '－'} | ${m.warn}秒 | ${m.cd || '－'}秒 | ${m.pw ? dmg(m.pw, stat === 'yo' ? U.yo : U.str, ko40.def) + '／' + dmg(m.pw, stat === 'yo' ? U.yo : U.str, nr40.def) : '－'} |\n`;
md += urow(UM.reiko, `3方向の光弾（弾速${UM.reiko.speed}m/秒）`, 'yo') + urow(UM.shosho, '近づいた味方へ両腕を打ち下ろす（最後0.25秒は向きを固定）', 'str') + urow(UM.stamp, `広場中央へワープして踏み下ろす（半径${UM.stamp.r}m）`, 'str') + urow(UM.shosha, '上空ビーム：前方横並び4本／周囲4本／追跡3発（0.9秒ずつ）を交代', 'yo');
md += urow(UM.warp, '奥へワープ（到着印0.7秒）', '') + urow(UM.summon, `部下が${UM.summon.at}体以下のとき${UM.summon.n}体を奥から呼ぶ`, '') + urow(UM.barrier, `本体へのダメージを遮る。射撃部下のビームを${UM.barrier.hits}回本体に通すと破壊。最大${UM.barrier.max}秒`, '');
md += `| ${UM.throw20.nm} | HP75%・25%で各1回（1戦2回まで）。生存20体以下になってから20体を0.18秒間隔で投げる（着弾 威力${UM.throw20.pw}・半径${UM.throw20.r}m・同じ投げで1人2回まで） | ${UM.throw20.pw} | ${UM.throw20.warn}秒 | － | ${dmg(UM.throw20.pw, U.yo, ko40.def)}／${dmg(UM.throw20.pw, U.yo, nr40.def)} |\n`;
md += `| ${UM.sleep.nm} | HP50%をまたぐと10秒眠る。4体合計${UM.sleep.need.toLocaleString()}ダメージで阻止（被ダメージ×${UM.sleep.mul}）→${UM.sleep.down}秒ダウン・以後なし。失敗は全回復して再挑戦 | － | － | － | － |\n\n`;
md += `直接攻撃（霊光・連掌・スタンプ・上空ビーム）の開始は最低${U.minGap}秒あける。上野だけのLv補正：平均Lv P（切り捨て）で 与ダメージ×clamp(1+0.02(P−40), 0.75, 1.25)、被ダメージ×clamp(1−0.015(P−40), 0.80, 1.20)。\n\n`;
md += `### 上野の部下（最初36体：近接${U.init.melee}・防御${U.init.guard}・射撃${U.init.beam}／生存上限${U.cap}体／同時に攻撃するのは近接・防御${U.rights.melee}＋射撃${U.rights.beam}）\n\n| 種類 | HP | ちから | ようりょく | まもり | 攻撃 | 予兆／最短周期 | 身長 |\n|---|---:|---:|---:|---:|---|---|---:|\n`;
for (const k of ['melee', 'guard', 'beam', 'thrown']) { const T = U.minions[k]; md += `| ${T.nm} | ${T.hp} | ${T.str} | ${T.yo} | ${T.def} | ${T.stat === 'yo' ? '妖術' : '物理'}${T.pw} | ${T.warn}秒／${T.period}秒 | ${(T.scale * 1.45).toFixed(2)}m |\n`; }
md += `\n## 回復・救助\n\n| もの | 効果 |\n|---|---|\n| 救助 | 気絶した仲間のまわりの円に${S.reviveTime}秒いると復活 |\n| キャンディー | ${S.candyPeriod}秒ごとに1つ（最大${S.candyMax}個）。取るとHP全回復 |\n| おにぎり | HPを${Math.round(D.ITEMS.onigiri.heal * 100)}%回復 |\n`;
fs.writeFileSync(path.join(root, 'CHARACTERS.md'), md);
console.log('CHARACTERS.md', md.split('\n').length, 'lines');
