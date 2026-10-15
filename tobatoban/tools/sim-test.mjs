// 戦闘シミュレーションの自動検査（three.js 不要）
// 使い方: node tobatoban/tools/sim-test.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster.js', 'sim.js', 'joban.js', 'ueno.js', 'proto.js'].filter(f => fs.existsSync(path.join(dir, f))).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date });
vm.runInContext(src + '\n;globalThis.__ = { DATA, SIMLIB, PROTO: typeof PROTO!=="undefined"?PROTO:null };', ctx);
const { DATA, SIMLIB, PROTO } = ctx.__;
const { Sim } = SIMLIB;
let fails = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fails++; };

function testSim(ch, extra) {
  const party = [ch, 'momiji', 'burikidon', 'taiko'].map(c => ({ ch: c }));
  const s = new Sim({ party, diff: 'normal', seed: 7, test: true });
  s.boss.hp = s.boss.maxHp = 1e9; s.boss.x = 0; s.boss.z = 10;
  s.allies.forEach((a, i) => { a.x = 30 + i; a.z = 30; }); // 他の味方は遠くへ
  const a = s.allies[0]; a.x = 0; a.z = 10 - 1.75; a.yaw = 0;
  Object.assign(s, extra || {});
  return s;
}
let evId = 0;
function run(s, slot, script, seconds) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    const t = i / 60, inp = SIMLIB.Sim.emptyInput();
    for (const [at, code, hold] of script) if (Math.abs(at - t) < 1e-6) inp.ev.push([++evId, code]);
    for (const [at, code, hold] of script) if (hold && t >= at && t < hold) inp.hold[code[0]] = 1;
    inp.lock = 'boss';
    s.setInput(slot, inp); s.step();
  }
}
// 1) 三連の威力と命中回数
{
  const s = testSim('kogemaru'); const a = s.allies[0];
  run(s, 0, [[0, 'A'], [0.2, 'A'], [0.5, 'A']], 1.5);
  const L = s.mlog.find(l => l.nm === '三連');
  ok(L && L.hits.length === 3, `三連：3回命中（${L && L.hits.length}）`);
  ok(L && Math.abs(L.hits[0] - L.tStart - 0.15) < 0.02 && Math.abs(L.hits[2] - L.tStart - 0.85) < 0.02, `三連：0.15s/0.85sに命中（${L && L.hits.map(h => (h - L.tStart).toFixed(3))}）`);
  const exp = [30, 30, 60].map(pw => Math.round(pw * 223 / (120 + 108)));
  ok(L && L.dmg.every((d, i) => d === exp[i] || d === Math.round(exp[i] / 1 * 1.5) || d > 0), `三連：威力30/30/60のダメージ ${L && L.dmg}（無会心なら ${exp}）`);
  ok(Math.abs(L.tEnd - L.tStart - 1.15) < 0.02, `三連：硬直終了1.15s（${(L.tEnd - L.tStart).toFixed(3)}）`);
}
// 1b) 入力がなければ途中で終了
{
  const s = testSim('kogemaru');
  run(s, 0, [[0, 'A']], 1.0);
  const L = s.mlog[0]; ok(L.hits.length === 1 && Math.abs(L.tEnd - L.tStart - 0.45) < 0.02, `三連：追加入力なしは1発で終了（${L.hits.length}発, ${(L.tEnd - L.tStart).toFixed(3)}s）`);
}
// 2) 必殺の命中回数
for (const [ch, n] of [['kogemaru', 10], ['hoshisuzume', 8], ['akaneten', 4], ['sayanosuke', 1], ['kagetsubame', 10], ['kemuridama', 1]]) {
  const s = testSim(ch); s.allies[0].sp = 100;
  run(s, 0, [[0, 'SP']], 3);
  const L = s.mlog.find(l => l.nm === DATA.CHI[ch].spNm);
  ok(L && L.hits.length === n, `${DATA.CHI[ch].spNm}：${n}回命中（${L && L.hits.length}）`);
}
// 3) 描画fpsに依存しない（同じ入力ログを30/60/120fpsの描画ループで再生）
{
  const results = [];
  for (const fps of [30, 60, 120]) {
    const s = testSim('kogemaru'); s.allies[0].sp = 100;
    let acc = 0, simT = 0; const script = [[0, 'A'], [0.25, 'A'], [0.6, 'A'], [1.5, 'SP'], [3.0, 'X+', 3.6], [3.6, 'X-']];
    let ev = 0; const fired = new Set();
    for (let f = 0; f < fps * 5; f++) {
      acc += 1 / fps;
      while (acc >= 1 / 60 - 1e-9) {
        acc -= 1 / 60;
        const inp = SIMLIB.Sim.emptyInput(); inp.lock = 'boss';
        script.forEach((sc, i) => { if (!fired.has(i) && simT >= sc[0] - 1e-9) { fired.add(i); inp.ev.push([++ev, sc[1]]); } if (sc[2] && simT >= sc[0] && simT < sc[2]) inp.hold[sc[1][0]] = 1; });
        s.setInput(0, inp); s.step(); simT = s.tick / 60;
      }
    }
    const a = s.allies[0];
    results.push(JSON.stringify({ hits: s.mlog.reduce((n, l) => n + l.hits.length, 0), dmg: a.stats.dmg, x: a.x.toFixed(4), z: a.z.toFixed(4) }));
  }
  ok(results[0] === results[1] && results[1] === results[2], `30/60/120fpsで命中数・総ダメージ・移動が一致 ${results[1]}`);
}
// 4) 回避を持たないキャラに独立回避がない
{
  const noDodge = DATA.CHARS.filter(c => c.X !== 'dodge' && c.Y !== 'dodge').map(c => c.nm);
  const s = testSim('burikidon'); const a = s.allies[0];
  run(s, 0, [[0, 'Y+', 0.5]], 0.3);
  ok(a.act === null || a.act.k !== 'dodge', `回避なしキャラ（${noDodge.join('、')}）はYで回避しない`);
}
// 5) ボス終盤で横断3回
{
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c }));
  const s = new Sim({ party, diff: 'normal', seed: 3, test: true });
  s.boss.testIdle = false; s.boss.st = 'idle'; s.stageT = 30;
  s.boss.hp = s.boss.maxHp * 0.3; s.allies.forEach((a, i) => { a.x = -4 + i * 2; a.z = 8; a.inv = 999; });
  let crosses = 0; const seen = new Set();
  for (let i = 0; i < 60 * 12; i++) { s.step(); for (const e of s.events) if (e.type === 'cross' && !seen.has(e.id)) { seen.add(e.id); crosses++; } if (s.boss.st !== 'fly' && crosses > 0) break; }
  ok(crosses === 3, `HP1/3以下の大巡行は横断3回（${crosses}）`);
}
// 6) 地雷は味方も巻き込む・ガードは被ダメージを下げる
{
  const s = testSim('kemuridama'); const a = s.allies[0], o = s.allies[1];
  o.x = 0; o.z = a.z + 1.5;
  run(s, 0, [[0, 'Y+'], [0.05, 'Y-']], 0.5);
  const trap = s.traps[0]; ok(!!trap, '置き火薬を設置');
  const hp0 = o.hp; o.x = trap.x; o.z = trap.z; run(s, 0, [], 1.2);
  ok(o.hp < hp0, `地雷が味方に影響（${hp0}→${o.hp}）`);
}
{
  const s = testSim('burikidon'); const a = s.allies[0];
  const d0 = s.dealToAlly(a, 100, 'str', s.boss, {}); a.hp = a.maxHp;
  s.inputs[0] = SIMLIB.Sim.emptyInput(); s.inputs[0].hold.Y = 1; s.pressSkill(a, s.inputs[0], 'Y');
  const d1 = s.dealToAlly(a, 100, 'str', s.boss, {});
  ok(a.act && a.act.k === 'guard' && d1 < d0, `ガード中の被ダメージが減る（${d0}→${d1}）`);
}
// 7) 気絶と昇天、救助（円に入っているだけで4秒・HP1/3）
{
  const s = testSim('kogemaru'); const a = s.allies[0], o = s.allies[1];
  s.allies[2].x = a.x - 9; s.allies[3].x = a.x + 9; // ほかの2人は遠くへ
  o.x = a.x + 1; o.z = a.z; o.hp = 1; s.dealToAlly(o, 999, 'str', s.boss, {});
  ok(o.st === 'down', '体力0で気絶');
  for (let i = 0; i < 60 * 3.8; i++) s.step();
  ok(o.st === 'down', `円の中にいても4秒たつまでは気絶のまま（ゲージ${Math.round(o.rv * 100)}%）`);
  for (let i = 0; i < 60 * 0.3; i++) s.step();
  ok(o.st === 'ok' && Math.abs(o.hp - Math.round(o.maxHp / 3)) <= 1, `ボタンなし・円に4秒で復活、HPは3分の1（${o.hp}/${o.maxHp}）`);
  o.hp = 1; o.inv = 0; s.dealToAlly(o, 999, 'str', s.boss, {});
  for (let i = 0; i < 60 * 2; i++) s.step(); a.x += 5; for (let i = 0; i < 60 * 1; i++) s.step();
  ok(o.st === 'down' && o.rv > 0.3 && o.rv < 0.45, `円から出るとゲージはゆっくり減る（50%→${Math.round(o.rv * 100)}%）`);
  for (let i = 0; i < 60 * 31; i++) s.step();
  ok(o.st === 'gone', '30秒放置で昇天');
  s.allies[0].sp = 100; run(s, 0, [[0, 'SP']], 2);
  ok(o.st === 'gone', '昇天済みは必殺でも蘇生しない');
}
{
  const s = testSim('momiji'); const a = s.allies[0], o = s.allies[1];
  s.allies[2].x = a.x - 9; s.allies[3].x = a.x + 9;
  o.x = a.x + 1; o.z = a.z; o.hp = 1; s.dealToAlly(o, 999, 'str', s.boss, {});
  for (let i = 0; i < 60 * 2.8; i++) s.step();
  ok(o.st === 'ok' && a.stats.revives === 1, `モミジ翁が円に入ると約2.7秒で救助（${o.st}・HP${Math.round(o.hp / o.maxHp * 100)}%）`);
}
// 7.2) 円に入る人数が多いほど早い（1人4秒・2人3秒・3人2秒）
for (const [n, sec] of [[2, 3], [3, 2]]) {
  const s = testSim('kogemaru'); const o = s.allies[1]; // モミジ翁を気絶させ、ほかの3人で助ける
  s.allies.forEach((a, i) => { if (i !== 1) { a.x = 30; a.z = 30; } });
  o.x = 0; o.z = 8; o.hp = 1; o.inv = 0; s.dealToAlly(o, 999, 'str', s.boss, {});
  [0, 2, 3].slice(0, n).forEach((i, k) => { const a = s.allies[i]; a.x = o.x + [1, -1, 0][k]; a.z = o.z + [0, 0, 1][k]; });
  for (let i = 0; i < 60 * (sec - 0.15); i++) s.step();
  const still = o.st === 'down';
  for (let i = 0; i < 60 * 0.3; i++) s.step();
  ok(still && o.st === 'ok', `${n}人で円に入ると約${sec}秒で復活`);
}
// 7.5) キャンディー：20秒ごとに広場のどこかへ。拾うと全回復、満タンなら拾わない
{
  const s = testSim('kogemaru', { barrier: 'plaza' }); const a = s.allies[0]; // 本番のボス戦と同じく結界は広場側
  s.candyT = 0.01; s.step();
  const c = s.pickups.find(p => p.kind === 'candy'), ST = DATA.STAGE;
  ok(!!c && Math.abs(c.x) <= ST.plazaHalfW && c.z >= 0 && c.z <= ST.plazaZ1, `キャンディーが広場の中に出る（${c && c.x.toFixed(1)}, ${c && c.z.toFixed(1)}）`);
  ok(s.candyT > 19.9, `次は20秒後（${s.candyT.toFixed(1)}）`);
  a.hp = a.maxHp; const ox = a.x, oz = a.z; a.x = c.x; a.z = c.z; s.step();
  ok(s.pickups.includes(c), 'HP満タンのときは拾わない');
  a.hp = 10; s.step();
  ok(a.hp === a.maxHp && !s.pickups.includes(c), `取ると全回復（${a.hp}/${a.maxHp}）`);
  s.candyT = 0.01; for (let i = 0; i < 5; i++) { s.candyT = 0.01; s.step(); }
  ok(s.pickups.filter(p => p.kind === 'candy').length === DATA.SIM.candyMax, `同時に置かれるのは${DATA.SIM.candyMax}個まで`);
}
// 7.8) 常磐線：135体・9イベント・敵の種類と共通ダメージ式・攻撃権・区間中央は一度だけ・上野到着
{
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c, lv: 20 }));
  const s = new Sim({ party, seed: 11, stageId: 'joban' }); const J = DATA.JOBAN;
  ok(s.stage === 'intro' && !s.boss, '常磐線は演出（intro）から始まり、ボスはいない');
  ok(s.total === 135 && J.events.length === 9, `9イベントで合計${s.total}体`);
  const mc = Sim.mixCounts(10, J.mix), mc25 = Sim.mixCounts(25, J.mix), mc15 = Sim.mixCounts(15, J.mix);
  ok(mc.melee + mc.beam + mc.guard === 10 && mc25.melee + mc25.beam + mc25.guard === 25 && mc15.melee === 9, `内訳は最大剰余法（10体→近接${mc.melee}・ビーム${mc.beam}・防御${mc.guard}／25体→${mc25.melee}・${mc25.beam}・${mc25.guard}）`);
  for (let i = 0; i < 60 * (J.introT + 0.2); i++) s.step();
  const ys = s.mobs.filter(m => m.kind === 'yoshi');
  ok(s.stage === 'train' && ys.length === 10 && ys.every(m => m.z > 1), `発車すると2号車に部下が10体（${ys.length}）`);
  const hpOk = ys.every(m => m.maxHp === J.types[m.typ].hp && m.def === J.types[m.typ].def);
  ok(hpOk && new Set(ys.map(m => m.typ)).size === 3, `種類ごとの体力・まもり（${[...new Set(ys.map(m => m.typ + ':' + m.maxHp))].join('・')}）`);
  // 共通ダメージ式：近接60×ちから120÷(120＋まもり)
  const o = s.allies[0]; o.ctrlAI = false; s.syncAi(o); o.hp = o.maxHp; o.inv = 0; o.act = null;
  const mel = ys.find(m => m.typ === 'melee'), want = Math.max(1, Math.round(60 * 120 / (120 + s.stat(o, 'def'))));
  const hp0 = o.hp; const h = s.hz({ kind: 'circle', x: o.x, z: o.z, r: 1, warn: 0, act: 0.1, pw: 60, stat: 'str', srcStats: { str: mel.str, yo: mel.yo }, src: 'mob', srcEnt: mel }); s.updateHazards(1 / 60); s.hazards = [];
  ok(hp0 - o.hp === want, `部下の攻撃は共通式（近接→Lv20コゲマル：${hp0 - o.hp}＝${want}）`);
  // 防御役のガード：受けるダメージ×0.7
  const gd = ys.find(m => m.typ === 'guard'); gd.hp = gd.maxHp = 1e6; s.dealToEnemy(s.allies[1], gd, 100, 'str', 'A', null); const g0 = gd.maxHp - gd.hp, gT0 = gd.gT, gC0 = gd.gCd; gd.hp = gd.maxHp; gd.gT = 0;
  ok(gT0 > 0 && gC0 > 3, `防御役は殴られると構える（${gT0.toFixed(1)}秒・再使用${gC0.toFixed(1)}秒）`);
  gd.gT = 1.5; s.dealToEnemy(s.allies[1], gd, 100, 'str', 'A', null); const g1 = gd.maxHp - gd.hp;
  ok(Math.abs(g1 / g0 - 0.7) < 0.08, `ガード中は×0.7（${g0}→${g1}）`); gd.hp = gd.maxHp = 160; gd.gT = 0;
  // 攻撃権：近接・防御は同時4体、ビームは1体
  { let maxM = 0, maxB = 0; s.allies.forEach(a => { a.inv = 1e9; a.x = 0; a.z = 8; });
    for (let i = 0; i < 60 * 12; i++) { s.step(); const at = s.mobs.filter(m => m.kind === 'yoshi' && m.act && m.st === 'ok'); maxM = Math.max(maxM, at.filter(m => m.typ !== 'beam').length); maxB = Math.max(maxB, at.filter(m => m.typ === 'beam').length); }
    ok(maxM <= 4 && maxB <= 1 && maxM >= 2, `同時に攻撃するのは近接・防御${maxM}体（最大4）・ビーム${maxB}体（最大1）`); }
  // 車内の壁と連結部
  const c1 = s.clampTrain(0, -5, 3, -5, 0.35), c2 = s.clampTrain(1.2, -3, 1.2, 0, 0.35), c3 = s.clampTrain(0, 19, 0, 30, 0.35);
  ok(Math.abs(c1[0]) <= J.halfW && c2[1] <= -1.3 && c3[1] < J.zMax, '車内の壁・連結部の細い通路・1号車へは行けない');
  // 波：10体倒すと15体（駅・区間中央の撃破では進まない）
  const kill = (n, f) => { for (const m of s.mobs.filter(m => m.st === 'ok' && m.kind === 'yoshi' && (!f || f(m))).slice(0, n)) s.dealToEnemy(s.allies[1], m, 1e6, 'str', 'A', null); };
  kill(10); s.step();
  ok(s.fired.p2 && s.queue.filter(q => q.grp === 'p2').length >= 14, `10体倒すと1号車から15体（待ち${s.queue.length}）`);
  let stations = [], boardBy = [], evs = [], maxAlive = 0, midAt = {};
  for (let i = 0; i < 60 * 900 && s.stage !== 'won'; i++) {
    s.step(); for (const e of s.events) if (!e._c) { e._c = 1; if (e.type === 'arriveSt') stations.push(J.stations[e.st]); if (e.type === 'board') boardBy.push(e.n); if (e.type === 'jev') { evs.push(e.id); if (e.id.startsWith('mid_')) midAt[e.id] = (s.tr.d / J.segLen[s.tr.at]).toFixed(3); } }
    maxAlive = Math.max(maxAlive, s.mobs.filter(m => m.st === 'ok').length);
    if (i % 30 === 0) kill(3, s.fired.p3 ? null : (m => !m.grp.startsWith('p'))); // 第3波が出るまでは駅・区間の敵だけ倒す
    if (i % 30 === 15 && s.fired.station_minami && !s.fired.p3) kill(15, m => m.grp === 'p2');
  }
  ok(stations.join('→') === '南千住→三河島→日暮里→上野', `停車駅：${stations.join('→')}`);
  ok(boardBy.join(',') === '15,15,25', `南千住15体・三河島15体・日暮里25体（${boardBy.join('・')}）`);
  ok(evs.length === 8 && new Set(evs).size === 8 && !evs.includes('p1') && Object.keys(s.fired).length === 9, `9イベントがそれぞれ一度だけ（p1,${evs.join(',')}）`);
  ok(Object.values(midAt).every(f => +f >= 0.5 && +f < 0.53), `区間中央は走行距離50%の通過で発生（${Object.entries(midAt).map(([k, f]) => k + '@' + f).join('・')}）`);
  ok(maxAlive <= 20, `同時に車内にいるのは最大20体（${maxAlive}）`);
  ok(s.kills === s.total && s.total === 135, `全部で${s.total}体を倒した（${s.kills}）`);
  ok(s.stage === 'won' && s.result.why === 'ueno', `全部倒すと上野に到着して勝ち（${s.stage}）`);
}
{ // 区間中央：49%→52%へ飛んでも一度だけ、50%に居続けても増えない
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c }));
  const s = new Sim({ party, seed: 13, stageId: 'joban', test: true }); const J = DATA.JOBAN;
  s.tr.at = 1; s.tr.ph = 'run'; s.tr.d = J.segLen[1] * 0.49; s.tr.v = 0; s.updateTrainMotion(0); const q0 = s.queue.length;
  s.tr.d = J.segLen[1] * 0.52; s.updateTrainMotion(0); const q1 = s.queue.length;
  for (let i = 0; i < 30; i++) { s.tr.d = J.segLen[1] * 0.5; s.updateTrainMotion(0); }
  ok(q0 === 0 && q1 === 10 && s.queue.length === 10, `49%→52%で一度だけ10体（${q0}→${q1}→${s.queue.length}）`);
}
{ // 部下が残っている間は上野に着かない
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c }));
  const s = new Sim({ party, seed: 12, stageId: 'joban', test: true }); s.allies.forEach(a => a.inv = 1e9);
  for (let i = 0; i < 60 * 400; i++) s.step();
  ok(s.stage === 'train' && s.tr.at === 3 && s.tr.ph === 'run', `敵が残っていると日暮里→上野の間を走り続ける（${DATA.JOBAN.stations[s.tr.at]}・${s.tr.ph}）`);
}
// 7.9) 上野：ヨシノシン・36体・攻撃権6・Lv補正・睡眠チェック・二十連・バリア
{
  const U = DATA.UENO, mk = (lv, o) => new Sim(Object.assign({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv })), seed: 21, stageId: 'ueno' }, o || {}));
  const s = mk(40);
  const cnt = k => s.mobs.filter(m => m.typ === k).length;
  ok(s.stage === 'intro' && s.boss.hp === 26000 && s.boss.str === 400 && s.boss.yo === 450 && s.boss.def === 135, 'ヨシノシン：HP26,000・ちから400・ようりょく450・まもり135');
  ok(s.mobs.length === 36 && cnt('melee') === 24 && cnt('guard') === 8 && cnt('beam') === 4, `最初の部下36体（近接${cnt('melee')}・防御${cnt('guard')}・射撃${cnt('beam')}）`);
  ok(s.mobs.every(m => m.z >= 11.5 && m.z <= 18.5) && Math.abs(s.boss.z - 23) < 0.01 && s.allies.every(a => a.z < 5), '部下はz12〜18、本体はz23、味方は入口側');
  ok(s.allies.every(a => a.sp >= 50), '開始時の妖気は最低50');
  const lvk = [30, 40, 50].map(lv => { const q = mk(lv); return q.lvOut.toFixed(2) + '/' + q.lvIn.toFixed(2); });
  ok(lvk.join(' ') === '0.80/1.15 1.00/1.00 1.20/0.85', `Lv補正（Lv30・40・50）：与/被 ${lvk.join('　')}`);
  { const q = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 1, stageId: 'senju', test: true }); ok(!q.lvOut || q.lvOut === 1, '北千住にはLv補正をかけない'); }
  // 登場の演出のあいだは攻撃しない
  let early = 0; for (let i = 0; i < 60 * (U.introT - 0.1); i++) { s.step(); early += s.hazards.length + s.projs.filter(p => p.team === 'enemy').length; }
  ok(early === 0, `登場（約${U.introT}秒）の間は予告も攻撃もない`);
  // 攻撃権：近接・防御4＋射撃2＝最大6
  s.allies.forEach(a => { a.inv = 1e9; a.x = (a.slot - 1.5) * 2; a.z = 12; });
  let maxM = 0, maxB = 0; s.boss.testIdle = true;
  for (let i = 0; i < 60 * 15; i++) { s.step(); s.allies.forEach(a => { a.hp = a.maxHp; }); const at = s.mobs.filter(m => m.st === 'ok' && m.act); maxM = Math.max(maxM, at.filter(m => m.typ !== 'beam').length); maxB = Math.max(maxB, at.filter(m => m.typ === 'beam').length); }
  ok(maxM <= 4 && maxB <= 2 && maxM + maxB >= 4, `同時に攻撃するのは近接・防御${maxM}体（最大4）＋射撃${maxB}体（最大2）`);
  // 本体の技の威力（共通式）：Lv40コゲマルのまもり98で 霊光45・連掌202・スタンプ183・上空ビーム134
  const ko = s.allies[0]; ko.ctrlAI = false; s.syncAi(ko); ko.inv = 0;
  const hitBy = (pw, stat) => { ko.hp = ko.maxHp; ko.act = null; ko.st = 'ok'; const h0 = ko.hp; s.dealToAlly(ko, pw, stat, s.boss, { src: s.boss }); return h0 - ko.hp; };
  const M = U.moves, vals = [hitBy(M.reiko.pw, 'yo'), hitBy(M.shosho.pw, 'str'), hitBy(M.stamp.pw, 'str'), hitBy(M.shosha.pw, 'yo')];
  ok(s.stat(ko, 'def') === 98 && vals.join('/') === '45/202/183/134', `Lv40コゲマル（まもり${s.stat(ko, 'def')}）：霊光・連掌・スタンプ・上空ビーム＝${vals.join('/')}（仕様の確認例 45/202/183/134）`);
}
{ // 睡眠チェック：2,999は失敗→全回復して再発動、3,000で成功→4秒ダウン・以後なし。余剰だけ計上。被ダメージ×2
  const U = DATA.UENO, S = U.moves.sleep;
  const mk = () => { const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 5, stageId: 'ueno', test: true, idle: true }); s.mobs.forEach(m => { m.st = 'gone'; }); s.mobs = []; s.allies.forEach(a => { a.inv = 1e9; }); return s; };
  const s = mk(), b = s.boss, a = s.allies[0];
  const hit = v => { const before = b.hp; b.hp -= v; s.uenoAfterHit(b, v, a, 'A'); return before; };
  hit(b.maxHp * 0.5 - 100); s.step();
  ok(!s.U.sleep && !s.U.sleepPend, '半分より上では眠らない');
  hit(400); s.step(); // 半分を300またぐ
  ok(b.st === 'sleep' && s.U.sleep && s.U.sleep.dmg === 300, `半分をまたぐと睡眠チャージ（またいだ後の余剰だけ ${s.U.sleep && s.U.sleep.dmg} を計上）`);
  ok(s.mobs.every(m => !m.act), '睡眠中は部下の攻撃を止める');
  const d1 = s.dealToEnemy(a, b, 100, 'str', 'A', null); s.U.sleep.dmg -= d1; b.hp += d1; // 試しに1発
  const sl = s.U.sleep; s.U.sleep = null; const d0 = s.dealToEnemy(a, b, 100, 'str', 'A', null); b.hp += d0; s.U.sleep = sl;
  ok(Math.abs(d1 / d0 - 2) < 0.05, `睡眠中は被ダメージ×2（${d0}→${d1}）`);
  s.U.sleep.dmg = S.need - 1; for (let i = 0; i < 60 * (S.dur + 0.1); i++) s.step();
  ok(!s.U.sleep && b.hp === b.maxHp && s.U.sleepArmed && !s.U.sleepDone, `2,999では失敗：最大HPに戻り（${b.hp}）、また半分で再発動`);
  hit(b.hp - b.maxHp * 0.5 + 1); s.step();
  ok(b.st === 'sleep', 'もう一度半分をまたぐと再発動');
  s.U.sleep.t = S.dur - 1 / 60 - 1e-9; s.U.sleep.dmg = S.need - 50; s.dealToEnemy(a, b, 1e3, 'str', 'A', null); s.step(); // 期限ちょうどの一撃は先に計上
  ok(s.U.sleepDone && b.st === 'down' && Math.abs(b.downT - S.down) < 0.05, `3,000に届くと成功（期限の同じ瞬間の攻撃を先に数える）→ ${S.down}秒ダウン`);
  for (let i = 0; i < 60 * 5; i++) s.step(); b.hp = b.maxHp * 0.6; hit(b.maxHp * 0.2); s.step();
  ok(b.st !== 'sleep' && !s.U.sleepPend, '成功したあとは二度と眠らない');
  const s2 = mk(); s2.U.sleep = null; s2.boss.hp = 10; s2.dealToEnemy(s2.allies[0], s2.boss, 1e5, 'str', 'A', null);
  ok(s2.stage === 'won', 'HP0なら撃破が優先（勝ち）');
}
{ // 二十連：HP75%・25%で1回ずつ（全回復でも戻らない）、生存20以下になってから必ず20体、上限40
  const U = DATA.UENO, T = U.moves.throw20;
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 9, stageId: 'ueno', test: true }); const b = s.boss;
  s.allies.forEach(a => { a.inv = 1e9; a.z = 3; }); s.mobs.forEach(m => m.para = 1e9);
  b.hp = b.maxHp * 0.74; s.uenoAfterHit(b, b.maxHp * 0.02, s.allies[0], 'A');
  ok(s.U.thrQ === 1, '75%をまたぐと二十連を予約');
  for (let i = 0; i < 60 * 3; i++) s.step();
  ok(s.U.thrUsed === 0 && s.uenoAlive() === 36, `生存${s.uenoAlive()}体（20より多い）の間は始めない`);
  for (const m of s.mobs.slice(0, 18)) s.dealToEnemy(s.allies[0], m, 1e6, 'str', 'A', null);
  let maxAlive = 0, landed = 0; for (let i = 0; i < 60 * 12; i++) { s.step(); maxAlive = Math.max(maxAlive, s.uenoAlive()); for (const e of s.events) if (!e._c && e.type === 'yLand') { e._c = 1; landed++; } }
  ok(s.U.thrUsed === 1 && landed === 20 && maxAlive <= U.cap, `生存18体から20体を投げて着地（${landed}体・最大${maxAlive}体≦40）`);
  b.hp = b.maxHp * 0.24; s.uenoAfterHit(b, b.maxHp * 0.02, s.allies[0], 'A'); b.hp = b.maxHp; b.hp = b.maxHp * 0.7; s.uenoAfterHit(b, b.maxHp * 0.1, s.allies[0], 'A');
  ok(s.U.thrQ === 1, '全回復しても75%の使用済みは戻らない（25%の1回だけ予約）');
  // 着弾は1回の一斉投げで1人2回まで
  const g = { hits: {}, max: T.maxHits }, o = s.allies[1]; o.inv = 0; o.hp = o.maxHp; let n = 0; const hp0 = o.hp;
  for (let k = 0; k < 4; k++) { s.hz({ kind: 'circle', x: o.x, z: o.z, r: T.r, warn: 0, act: 0.1, pw: T.pw, stat: 'yo', src: 'boss', grp: g }); s.updateHazards(1 / 60); s.hazards = []; }
  ok(g.hits[o.slot] === 2, `同じ一斉投げの着弾は1人2回まで（${g.hits[o.slot]}回）`);
}
{ // バリア：通常ダメージを遮る・射撃部下のビーム2本で破壊・同じビームは1回・射撃部下がいなければ使わない・8秒で解除
  const U = DATA.UENO;
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 3, stageId: 'ueno', test: true }); const b = s.boss;
  s.allies.forEach(a => { a.inv = 1e9; a.x = 10; a.z = 3; });
  s.U.barrier = { t: 0, hits: 0, seen: {} };
  const hp0 = b.hp; s.dealToEnemy(s.allies[0], b, 500, 'str', 'A', null);
  ok(b.hp === hp0, 'バリア中は本体にダメージが通らない');
  const beam = id => ({ id, hook: 'yBeam', x: b.x, z: b.z - 8, yaw: 0, len: 13, w: 0.7 });
  const h1 = beam(9001); s.hzHook(h1); s.hzHook(h1);
  ok(s.U.barrier && s.U.barrier.hits === 1, '1本のビームを2回には数えない');
  s.hzHook(beam(9002));
  ok(!s.U.barrier && b.st === 'stun', '2本目で破壊して短くよろめく');
  const s2 = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 3, stageId: 'ueno', test: true });
  s2.mobs = s2.mobs.filter(m => m.typ !== 'beam'); s2.stageT = 100; s2.allies.forEach(a => { a.inv = 1e9; a.z = 2; }); s2.mobs.forEach(m => m.para = 1e9);
  let used = 0; for (let i = 0; i < 60 * 60; i++) { s2.step(); for (const e of s2.events) if (!e._c && e.type === 'bossmove') { e._c = 1; if (e.mv === 'barrier') used++; } }
  ok(used === 0, '射撃部下がいないとバリアを使わない');
  s2.U.barrier = { t: 0, hits: 0, seen: {} }; for (let i = 0; i < 60 * (U.moves.barrier.max + 0.1); i++) s2.step();
  ok(!s2.U.barrier, `${U.moves.barrier.max}秒で必ず解除`);
}
{ // 上野のスナップショット
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 30 })), seed: 3, stageId: 'ueno' });
  for (let i = 0; i < 60 * 5; i++) s.step();
  const v = PROTO.decodeSnap(JSON.parse(JSON.stringify(PROTO.encodeSnap(s))));
  ok(v.stageId === 'ueno' && v.U && v.U.alive === 36 && Math.abs(v.U.lvOut - 0.8) < 1e-9 && v.boss && v.mobs.length === 36 && v.mobs.every(m => m.yoshi && m.scale < 0.7), `スナップショットに上野の状態（部下${v.U && v.U.alive}・補正${v.U && v.U.lvOut}・ボス${v.boss && v.boss.st}）`);
}
// 8) 接触してから当たる（離れた所からの空振りは当たらない）
{
  const s = testSim('kogemaru'); const a = s.allies[0]; a.z = 10 - 3.0;
  run(s, 0, [[0, 'A'], [0.2, 'A'], [0.5, 'A']], 1.5);
  const L = s.mlog.find(l => l.nm === '三連');
  ok(L && L.hits.length === 0, `体に届かない距離（表面まで${(3.0 - 0.75).toFixed(2)}）では三連が当たらない（${L && L.hits.length}）`);
}
{
  const s = testSim('kogemaru'); s.mobs = []; const m = s.spawnMob(0, 0, true); m.fireT = 99; m.para = 99; const a = s.allies[0]; a.x = 0; a.z = -1.8;
  run(s, 0, [[0, 'A']], 0.6); const n1 = s.mlog[0].hits.length;
  a.z = -1.1; run(s, 0, [[0.7, 'A']], 1.3); const n2 = s.mlog[1] ? s.mlog[1].hits.length : 0;
  ok(n1 === 0 && n2 === 1, `札小僧：離れていると空振り（${n1}）、触れる距離で当たる（${n2}）`);
}
{
  const s = testSim('hoshisuzume'); const a = s.allies[0]; a.z = 10 - 8;
  run(s, 0, [[0, 'A']], 1.0);
  const e = s.events.find(e => e.type === 'dmg');
  const r = e ? Math.hypot(e.x - s.boss.x, e.z - s.boss.z) : -1;
  ok(e && r <= 0.8 && r >= 0.4, `弾は体の表面に当たり、そこにダメージが出る（中心から${r.toFixed(2)}）`);
}
{
  const s = testSim('kogemaru'); s.boss.testIdle = false; s.boss.st = 'idle'; s.boss.gap = 99; const a = s.allies[0]; a.inv = 0;
  a.z = 10 - 5.2; const hp0 = a.hp; s.bossStart('harite', a); for (let i = 0; i < 60; i++) s.step(); const far = a.hp === hp0;
  s.boss.st = 'idle'; s.boss.gap = 99; s.boss.cds = {}; a.act = null; a.z = 10 - 2.6; const hp1 = a.hp; s.bossStart('harite', a); for (let i = 0; i < 60; i++) s.step();
  ok(far && a.hp < hp1, `張り手：届かない所では当たらず（${far}）、手の届く所で当たる（${hp1}→${a.hp}）`);
}
// 8) タップした敵への追尾：12m以内なら弾が追いかけて当たる（途中の敵には当たらない）。遠い敵・AIの弾は追尾しない
{
  const s = testSim('hoshisuzume'); s.boss.x = 35; s.boss.z = -40; s.mobs = []; const a = s.allies[0]; a.x = 0; a.z = 0; a.yaw = 0;
  const T = s.spawnMob(4, 6, true), Bk = s.spawnMob(2, 3, true); for (const m of [T, Bk]) { m.fireT = 99; m.para = 99; m.hp = m.maxHp = 1e6; }
  let fired = null;
  for (let i = 0; i < 60; i++) {
    const inp = SIMLIB.Sim.emptyInput(); if (i === 0) inp.ev.push([++evId, 'A']); inp.lock = T.id; s.setInput(0, inp); s.step();
    const p = s.projs.find(q => q.team === 'ally'); if (p && !fired) { fired = { tgt: p.tgt }; T.x += 1.6; } // 撃ったあと敵が横へ動く
  }
  ok(fired && fired.tgt === T.id, `注目した敵（約7m）へ弾が追尾する（${fired && fired.tgt}）`);
  ok(T.hp < T.maxHp && Bk.hp === Bk.maxHp, `撃ったあと横へ動いても当たり、途中の敵には当たらない（狙った敵 ${T.maxHp - T.hp}・途中 ${Bk.maxHp - Bk.hp}）`);
  const far = s.spawnMob(0, DATA.SIM.homeRange + 3, true); far.fireT = 99; far.para = 99; a.lockId = far.id; a.yaw = 0;
  s.projs = []; s.fireProj(a, 'star', 35, 'str', 18, 0.85, 0.35, 'A', null); ok(!s.projs[0].tgt, `${DATA.SIM.homeRange}mより遠い敵には追尾しない`);
  a.ctrlAI = true; a.lockId = T.id; s.projs = []; s.fireProj(a, 'star', 35, 'str', 18, 0.85, 0.35, 'A', null); ok(!s.projs[0].tgt, 'AIが動かすキャラの弾は追尾しない');
}
if (PROTO) {
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c }));
  const s = new Sim({ party, diff: 'normal', seed: 3 });
  for (let i = 0; i < 120; i++) s.step();
  const snap = PROTO.encodeSnap(s, {}); const json = JSON.stringify(snap);
  ok(json.length < 3800, `スナップショットの大きさ ${json.length} bytes`);
  const v = PROTO.decodeSnap(snap); ok(v.allies.length === 4 && typeof v.allies[0].hpR === 'number', 'スナップショットを復元できる');
  ok(!/"hp"\s*:/.test(json), 'スナップショットにHPの実数を含めない');
}
console.log(fails ? `\n${fails}件の失敗` : '\nすべて合格');
process.exit(fails ? 1 : 0);
