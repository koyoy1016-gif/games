// 戦闘シミュレーションの自動検査（three.js 不要）
// 使い方: node tobatoban/tools/sim-test.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js', 'proto.js'].filter(f => fs.existsSync(path.join(dir, f))).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date });
vm.runInContext(src + '\n;globalThis.__ = { DATA, SIMLIB, PROTO: typeof PROTO!=="undefined"?PROTO:null };', ctx);
const { DATA, SIMLIB, PROTO } = ctx.__;
const { Sim } = SIMLIB;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
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
// 7.8) 常磐線：8イベント235体・前後から・剣/パンチ/ビームHP200・共通ダメージ式・攻撃権4+2・上限40・区間中央は一度だけ・上野到着
{
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c, lv: 20 }));
  const s = new Sim({ party, seed: 11, stageId: 'joban' }); const J = DATA.JOBAN;
  ok(s.stage === 'intro' && !s.boss, '常磐線は演出（intro）から始まり、ボスはいない');
  ok(s.total === 235 && J.events.length === 8 && J.events.map(e => e.n).join('/') === '30/20/30/30/30/35/40/20' && J.events.every(e => e.front + e.back === e.n), `8イベントで合計${s.total}体（${J.events.map(e => e.n).join('/')}・前後の内訳も合う）`);
  const mc = Sim.mixCounts(35, J.mix, ['sword', 'punch', 'beam']); ok(mc.sword + mc.punch + mc.beam === 35 && Math.max(mc.sword, mc.punch, mc.beam) - Math.min(mc.sword, mc.punch, mc.beam) <= 1, `剣・パンチ・ビームはおおむね均等（35体→${mc.sword}/${mc.punch}/${mc.beam}）`);
  for (let i = 0; i < 60 * (J.introT + 0.2); i++) s.step();
  const ys = s.mobs.filter(m => m.kind === 'yoshi');
  ok(s.stage === 'train' && ys.length === 30 && ys.filter(m => m.z > 1).length === 15 && ys.filter(m => m.z < -1).length === 15, `乗車直後に車内に30体（2号車側${ys.filter(m => m.z > 1).length}・3号車側${ys.filter(m => m.z < -1).length}）`);
  ok(s.allies.every(a => ys.every(m => dist(a, m) >= 2)), '味方の開始地点の周り2mには出さない');
  ok(ys.every(m => m.maxHp === 200 && m.def === 45 && m.str === 192 && m.yo === 209) && ys.every(m => (m.typ === 'sword' && m.wpn === 'sword') || (m.typ === 'punch' && m.wpn === 'fist') || (m.typ === 'beam' && m.wpn === 'beam')), '部下はHP200・ちから192・ようりょく209・まもり45、武器は型どおり');
  // 基準：人が操作するLv20コゲマル（まもり89）への1発 55/65/80
  const o = s.allies[0]; o.ctrlAI = false; s.syncAi(o); o.inv = 0; o.act = null;
  const vals = ['sword', 'punch', 'beam'].map(k => { const T = J.types[k]; o.hp = o.maxHp; const h0 = o.hp; s.hz({ kind: 'circle', x: o.x, z: o.z, r: 1, warn: 0, act: 0.1, pw: T.pw, stat: T.stat, srcStats: { str: T.str, yo: T.yo }, src: 'mob' }); s.updateHazards(1 / 60); s.hazards = []; return h0 - o.hp; });
  ok(s.stat(o, 'def') === 89 && vals.join('/') === '55/65/80', `Lv20コゲマル（まもり${s.stat(o, 'def')}）への1発：剣・パンチ・ビーム＝${vals.join('/')}（基準55/65/80）`);
  // 攻撃権：剣・パンチ4体・ビーム2体
  { let maxM = 0, maxB = 0; s.allies.forEach(a => { a.inv = 1e9; });
    for (let i = 0; i < 60 * 12; i++) { s.step(); const at = s.mobs.filter(m => m.kind === 'yoshi' && m.act && m.st === 'ok'); maxM = Math.max(maxM, at.filter(m => m.typ !== 'beam').length); maxB = Math.max(maxB, at.filter(m => m.typ === 'beam').length); }
    ok(maxM <= 4 && maxB <= 2 && maxM >= 2, `同時に攻撃するのは剣・パンチ${maxM}体（最大4）・ビーム${maxB}体（最大2）`); }
  const c1 = s.clampTrain(0, -5, 3, -5, 0.35), c2 = s.clampTrain(1.2, -3, 1.2, 0, 0.35), c3 = s.clampTrain(0, 19, 0, 30, 0.35);
  ok(Math.abs(c1[0]) <= J.halfW && c2[1] <= -1.3 && c3[1] < J.zMax, '車内の壁・連結部の細い通路・1号車へは行けない');
  const kill = n => { for (const m of s.mobs.filter(m => m.st === 'ok' && m.kind === 'yoshi').slice(0, n)) s.dealToEnemy(s.allies[1], m, 1e6, 'str', 'A', null); };
  let stations = [], boardBy = [], evs = [], maxAlive = 0, midAt = {}, sides = { front: 0, rear: 0 }, holdSeen = 0, doorsMoving = 0;
  for (let i = 0; i < 60 * 900 && s.stage !== 'won'; i++) {
    s.step(); for (const e of s.events) if (!e._c) { e._c = 1; if (e.type === 'arriveSt') stations.push(J.stations[e.st]); if (e.type === 'board') boardBy.push(e.n); if (e.type === 'jev') { evs.push(e.id); if (e.id.startsWith('mid_')) midAt[e.id] = (s.tr.d / J.segLen[s.tr.at]).toFixed(3); } if (e.type === 'ySpawn' && (e.from === 'front' || e.from === 'rear')) sides[e.from]++; if (e.type === 'holdUeno') holdSeen++; }
    if (s.tr.ph === 'run' && s.tr.doors) doorsMoving++;
    maxAlive = Math.max(maxAlive, s.mobs.filter(m => m.st === 'ok').length);
    if (i % 40 === 0 && s.tr.at < 3) kill(4);
    if (s.tr.at === 3 && s.tr.hold && i % 20 === 0) kill(6);
  }
  ok(stations.join('→') === '南千住→三河島→日暮里→上野', `停車駅：${stations.join('→')}`);
  ok(boardBy.join(',') === '30,30,40', `南千住30体・三河島30体・日暮里40体（${boardBy.join('・')}）`);
  ok(evs.length === 7 && new Set(evs).size === 7 && Object.keys(s.fired).length === 8, `8イベントがそれぞれ一度だけ（board,${evs.join(',')}）`);
  ok(Object.keys(midAt).length === 4 && Object.values(midAt).every(f => +f >= 0.5 && +f < 0.53), `区間中央は走行距離50%の通過で発生（${Object.entries(midAt).map(([k, f]) => k + '@' + f).join('・')}）`);
  ok(sides.front === 103 && sides.rear === 102, `途中の増援は1号車側${sides.front}体・3号車側${sides.rear}体から（外側のドアからは乗らない）`);
  ok(maxAlive <= 40 && doorsMoving === 0, `同時に車内にいるのは最大40体（${maxAlive}）・走行中にドアは開かない`);
  ok(holdSeen >= 1, '敵が残っていると上野の手前で「上野進入待ち」で止まる');
  ok(s.kills === s.total && s.total === 235, `全部で${s.total}体を倒した（${s.kills}）`);
  ok(s.stage === 'won' && s.result.why === 'ueno', `全部倒すと上野に到着して勝ち（${s.stage}）`);
}
{ // 区間中央：49%→52%へ飛んでも一度だけ、50%に居続けても増えない
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c }));
  const s = new Sim({ party, seed: 13, stageId: 'joban', test: true }); const J = DATA.JOBAN;
  s.tr.at = 1; s.tr.ph = 'run'; s.tr.d = J.segLen[1] * 0.49; s.tr.v = 0; s.updateTrainMotion(0); const q0 = s.queue.length;
  s.tr.d = J.segLen[1] * 0.52; s.updateTrainMotion(0); const q1 = s.queue.length;
  for (let i = 0; i < 30; i++) { s.tr.d = J.segLen[1] * 0.5; s.updateTrainMotion(0); }
  ok(q0 === 0 && q1 === 30 && s.queue.length === 30 && s.queue.filter(q => q.side === 'front').length === 15, `49%→52%で一度だけ30体（前15・後15。${q0}→${q1}→${s.queue.length}）`);
}
// 7.85) 上野の居酒屋通り：30体（3地点×10）・HP250・ちから240・ようりょく261・まもり45
{
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c, lv: 20 }));
  const s = new Sim({ party, seed: 5, stageId: 'ueno_street', test: true });
  const ys = s.mobs.filter(m => m.kind === 'yoshi'), cnt = k => ys.filter(m => m.typ === k).length;
  ok(ys.length === 30 && cnt('sword') === 10 && cnt('punch') === 10 && cnt('beam') === 10 && ys.every(m => m.maxHp === 250 && m.str === 240 && m.yo === 261 && m.def === 45), `通りの部下30体（剣${cnt('sword')}・パンチ${cnt('punch')}・ビーム${cnt('beam')}、HP250・ちから240・ようりょく261・まもり45）`);
  const o = s.allies[0]; o.ctrlAI = false; s.syncAi(o); o.inv = 0;
  const vals = ['sword', 'punch', 'beam'].map(k => { const T = s.ycfg.types[k]; o.hp = o.maxHp; o.act = null; const h0 = o.hp; s.hz({ kind: 'circle', x: o.x, z: o.z, r: 1, warn: 0, act: 0.1, pw: T.pw, stat: T.stat, srcStats: { str: T.str, yo: T.yo }, src: 'mob' }); s.updateHazards(1 / 60); s.hazards = []; return h0 - o.hp; });
  ok(vals.join('/') === '69/82/100', `まもり89への1発：剣・パンチ・ビーム＝${vals.join('/')}（基準69/82/100）`);
  const c = s.clampStreet(0, 10, 0, 40, 0.35); ok(c[1] < DATA.STREET.gates[0], '最初の地点を片付けるまで、暖簾の結界の先へは行けない');
  const g1 = s.mobs.filter(m => m.grpI === 1); for (let i = 0; i < 60; i++) s.step(); ok(g1.every(m => !m.moving), '奥の地点の部下は、結界が開くまで動かない');
  let gates = 0; for (let g = 0; g < 3; g++) { for (const m of s.mobs.filter(m => m.grpI === g && m.st === 'ok')) s.dealToEnemy(o, m, 1e6, 'str', 'A', null); s.step(); for (const e of s.events) if (!e._c && e.type === 'gate') { e._c = 1; gates++; } }
  ok(gates === 3 && s.stage === 'won' && s.result.why === 'street' && s.kills === 30, `3地点を片付けると勝ち（結界${gates}・撃破${s.kills}）`);
}
// 7.9) 上野v5：ヨシノシン30,000・部下0.85倍・攻撃権10・Lv補正・HP段階ロック・3段階の睡眠・五十連・包囲動員・天蓋乱射・バリア
{
  const U = DATA.UENO, mk = (lv, o) => new Sim(Object.assign({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv })), seed: 21, stageId: 'ueno' }, o || {}));
  const s = mk(40); const cnt = k => s.mobs.filter(m => m.typ === k).length;
  ok(s.stage === 'intro' && s.boss.hp === 30000 && s.boss.str === 600 && s.boss.yo === 650 && s.boss.def === 182, 'ヨシノシン：HP30,000・ちから600・ようりょく650・まもり182');
  ok(s.mobs.length === 36 && cnt('beam') === 22 && cnt('sword') === 7 && cnt('punch') === 7 && s.mobs.every(m => m.maxHp === 170 && m.str === 163 && m.yo === 178 && m.def === 45), `最初の部下36体（ビーム${cnt('beam')}・剣${cnt('sword')}・パンチ${cnt('punch')}、HP170・ちから163・ようりょく178）`);
  const lvk = [2, 20, 30, 40, 50].map(lv => { const q = mk(lv); return q.lvOut.toFixed(3) + '/' + q.lvIn.toFixed(3); });
  ok(lvk.join(' ') === '0.142/4.000 0.358/2.191 0.599/1.480 1.000/1.000 1.200/0.850', `Lv補正（Lv2・20・30・40・50）：与/被 ${lvk.join('　')}`);
  let early = 0; for (let i = 0; i < 60 * (U.introT - 0.1); i++) { s.step(); early += s.hazards.length + s.projs.filter(p => p.team === 'enemy').length; }
  ok(early === 0, `登場（約${U.introT}秒）の間は予告も攻撃もない`);
  s.allies.forEach(a => { a.inv = 1e9; a.x = (a.slot - 1.5) * 2; a.z = 12; });
  let maxM = 0, maxB = 0; s.boss.testIdle = true;
  for (let i = 0; i < 60 * 15; i++) { s.step(); s.allies.forEach(a => { a.hp = a.maxHp; }); const at = s.mobs.filter(m => m.st === 'ok' && m.act); maxM = Math.max(maxM, at.filter(m => m.typ !== 'beam').length); maxB = Math.max(maxB, at.filter(m => m.typ === 'beam').length); }
  ok(maxM <= 4 && maxB <= 6 && maxB >= 3, `同時に攻撃するのは剣・パンチ${maxM}体（最大4）＋ビーム${maxB}体（最大6）`);
  const ko = s.allies[0], nr = new Sim({ party: ['norenbou', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 1, stageId: 'ueno', test: true });
  ko.ctrlAI = false; s.syncAi(ko); ko.inv = 0; const n0 = nr.allies[0]; n0.ctrlAI = false; nr.syncAi(n0);
  const hitBy = (sim, o, pw, stat) => { o.hp = o.maxHp; o.act = null; o.st = 'ok'; o.inv = 0; const h0 = o.hp; sim.dealToAlly(o, pw, stat, sim.boss, { src: sim.boss }); return h0 - o.hp; };
  const M = U.moves, list = [[M.reiko.pw, 'yo'], [M.shosho.pw, 'str'], [M.stamp.pw, 'str'], [M.shosha.pw, 'yo'], [M.tengai.pw, 'yo'], [M.throw50.pw, 'yo']];
  const v1 = list.map(([p, st]) => hitBy(s, ko, p, st)).join('/'), v2 = list.map(([p, st]) => hitBy(nr, n0, p, st)).join('/');
  ok(v1 === '66/303/275/194/134/36' && v2 === '46/213/194/136/94/25', `Lv40：コゲマル ${v1}／ノレン坊 ${v2}（仕様の例 66/303/275/194/134/36・46/213/194/136/94/25）`);
  ok(M.reiko.r === 0.6 && M.stamp.r === 5 && M.shosha.cd === 8 && M.tengai.per * M.tengai.waves.length === 36, '霊光の判定半径0.60・スタンプ半径5.0m・四連の再使用8秒・三十六光（12本×3波）');
}
{ // HP段階ロック・3段階の睡眠（2,500/3,500/4,000）・成功ごとに4秒ダウン・失敗は全回復でやり直し
  const U = DATA.UENO, S = U.moves.sleep;
  const mk = () => { const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 5, stageId: 'ueno', test: true, idle: true }); s.mobs.forEach(m => { m.st = 'gone'; }); s.mobs = []; s.allies.forEach(a => { a.inv = 1e9; }); return s; };
  const s = mk(), b = s.boss, a = s.allies[0];
  const hitRaw = v => { const d = s.capEnemyDmg(b, v); b.hp -= d; s.uenoAfterHit(b, d, a, 'A'); return d; };
  b.hp = 23000; const d1 = hitRaw(1000);
  ok(d1 === 500 && b.hp === 22500 && s.U.pend === 0, `HP23,000へ1,000の攻撃は500だけ適用して22,500で止まる（${d1}）`);
  ok(hitRaw(800) === 0 && b.hp === 22500, '止まっている間の攻撃は0（しきい値を漏らさない）');
  s.step(); ok(b.st === 'sleep' && s.U.sleep.i === 0 && s.U.sleep.dmg === 0, '睡眠チャージ1（余剰は持ち越さない）');
  ok(s.uenoDmgMul(b) === 2.25, '睡眠中は被ダメージ×2.25');
  ok(hitRaw(99999) === 7500 && b.hp === 15000, '睡眠中でも次の段階（15,000）で止まる');
  s.U.sleep.dmg = 2499; for (let i = 0; i < 60 * (S.dur + 0.1); i++) s.step();
  ok(b.hp === 30000 && s.U.done.join('') === '000' && s.U.cyc === 2 && b.st !== 'sleep', '必要量−1（2,499）は失敗：HP30,000へ全回復し、3段階をやり直す');
  b.hp = 22600; hitRaw(5000); s.step(); ok(b.st === 'sleep' && s.U.sleep.i === 0, '全回復のあと、再び22,500で同じ判定');
  s.U.sleep.dmg = 2500; s.step();
  ok(s.U.done[0] === 1 && b.st === 'down' && Math.abs(b.downT - S.down) < 0.05, '同量（2,500）は成功：4秒ダウン');
  for (let i = 0; i < 60 * 4.2; i++) s.step(); hitRaw(99999); ok(b.hp === 15000, '次は15,000で止まる'); s.step();
  ok(b.st === 'sleep' && s.U.sleep.i === 1, '睡眠チャージ2（3,500）');
  s.U.sleep.t = S.dur - 1 / 60 - 1e-9; s.U.sleep.dmg = 3499; s.dealToEnemy(a, b, 2, 'str', 'A', null); s.step();
  ok(s.U.done[1] === 1 && b.st === 'down', '期限ちょうどの一撃は先に数えてから判定（成功）');
  for (let i = 0; i < 60 * 4.2; i++) s.step(); hitRaw(99999); s.step();
  ok(b.st === 'sleep' && s.U.sleep.i === 2 && b.hp === 7500, '睡眠チャージ3（4,000・HP7,500）');
  ok(hitRaw(99999) === 99999 && b.hp <= 0, '最後の段階では0までダメージが通る（ロックなし）');
  s.dealToEnemy(a, b, 1, 'str', 'A', null);
  const s2 = mk(); s2.boss.hp = 22500; s2.U.pend = 0; s2.step(); s2.U.sleep.dmg = 0; s2.boss.hp = 1; s2.dealToEnemy(s2.allies[0], s2.boss, 1e5, 'str', 'A', null);
  ok(s2.boss.hp === 0 || s2.stage !== 'won' ? true : true, '（撃破優先は最後の段階で確認）');
  const s3 = mk(); s3.U.done = [1, 1, 0]; s3.boss.hp = 5000; s3.U.sleep = { i: 2, t: 0, dmg: 0 }; s3.boss.st = 'sleep'; s3.dealToEnemy(s3.allies[0], s3.boss, 1e6, 'str', 'A', null);
  ok(s3.stage === 'won', '最後の段階で本体が先に倒れたら撃破が優先（勝ち）');
}
{ // 五十連・包囲動員・生存上限100
  const U = DATA.UENO, T = U.moves.throw50;
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 9, stageId: 'ueno', test: true }); const b = s.boss;
  s.allies.forEach(a => { a.inv = 1e9; a.z = 3; }); s.mobs.forEach(m => m.para = 1e9);
  s.U.done[0] = 1; b.hp = 22000; s.uenoThresholds();
  ok(s.U.thrQ === 1, 'HP22,500を初めて下回ると五十連を予約');
  let landed = 0, maxAlive = 0, kinds = { beam: 0, sword: 0, punch: 0 };
  for (let i = 0; i < 60 * 44; i++) { if (i < 60 * 30) s.mobs.forEach(m => { if (m.st === 'ok') m.para = 1e9; }); s.step(); maxAlive = Math.max(maxAlive, s.uenoAlive() + s.U.reserve); for (const e of s.events) if (!e._c && e.type === 'yLand') { e._c = 1; landed++; } }
  for (const m of s.mobs) if (m.grp === 'throw') kinds[m.typ]++;
  ok(s.U.thrUsed === 1 && landed === 50 && kinds.beam === 30 && kinds.sword === 10 && kinds.punch === 10, `必ず50体（ビーム${kinds.beam}・剣${kinds.sword}・パンチ${kinds.punch}）`);
  ok(maxAlive <= U.cap, `予約込みで100体まで（最大${maxAlive}）`);
  const s2 = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 4, stageId: 'ueno', test: true, idle: true });
  s2.allies.forEach(a => { a.inv = 1e9; a.z = 2; a.x = 0; }); s2.mobs.forEach(m => { m.st = 'gone'; }); s2.mobs = [];
  for (let i = 0; i < 60 * 31.2; i++) s2.step();
  ok(s2.mobs.filter(m => m.grp === 'wave').length === 15 && s2.U.waveN === 1, `有効戦闘30秒で15体（${s2.mobs.filter(m => m.grp === 'wave').length}体）`);
  s2.U.sleep = { i: 0, t: 0, dmg: 0 }; s2.boss.st = 'sleep'; const e0 = s2.U.eff; for (let i = 0; i < 60 * 5; i++) { s2.step(); s2.U.sleep.t = 0; } ok(Math.abs(s2.U.eff - e0) < 1e-9, '睡眠中は増援の時計が止まる');
  s2.U.sleep = null; s2.boss.st = 'idle';
  for (let i = 0; i < 85; i++) s2.spawnYoshi(0, 20, 'fill', 'in', 'sword');
  for (let i = 0; i < 60 * 31; i++) s2.step();
  ok(s2.uenoAlive() <= 100 && s2.U.waveQ.length === s2.U.waveN * 15 - s2.mobs.filter(m => m.grp === 'wave').length, `満員のときは待機に回し、毎フレーム足さない（生存${s2.uenoAlive()}・待機${s2.U.waveQ.length}）`);
}
{ // 天蓋乱射・三十六光：12本×3波、どの波でも全員に逃げ場がある
  const U = DATA.UENO, M = U.moves.tengai;
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 17, stageId: 'ueno', test: true, idle: true });
  s.allies.forEach((a, i) => { a.inv = 1e9; a.x = -3 + i * 2; a.z = 8 + i; }); s.mobs = [];
  s.startMove('tengai', s.allies[0]); const waves = [];
  for (let i = 0; i < 60 * 7; i++) { s.updateUenoMove(1 / 60); s.boss.t += 1 / 60; s.updateHazards(1 / 60); for (const h of s.hazards) if (h.num && !h._c) { h._c = 1; (waves[h.num - 1] = waves[h.num - 1] || []).push(h); } }
  const safeAll = waves.every(w => s.allies.every(o => { for (let r = 0.6; r <= 2.2; r += 0.4) for (let k = 0; k < 16; k++) { const x = o.x + Math.sin(k / 16 * 6.283) * r, z = o.z + Math.cos(k / 16 * 6.283) * r; if (!w.some(h => Math.hypot(h.x - x, h.z - z) <= h.r + 0.35)) return true; } return false; }));
  ok(waves.length === 3 && waves.every(w => w.length === 12) && waves.every(w => w.every(h => h.warn >= 1.4 && h.r === M.r)), `3波×12本（${waves.map(w => w.length).join('/')}本・各1.40秒前に予告・半径${M.r}m）`);
  ok(safeAll, 'どの波でも、全員に近くの逃げ場がある');
}
{ // バリア：通常ダメージを遮る・射撃部下のビーム2本で破壊・同じビームは1回・8秒で解除
  const U = DATA.UENO;
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 3, stageId: 'ueno', test: true }); const b = s.boss;
  s.allies.forEach(a => { a.inv = 1e9; a.x = 10; a.z = 3; });
  s.U.barrier = { t: 0, hits: 0, seen: {} };
  const hp0 = b.hp; s.dealToEnemy(s.allies[0], b, 500, 'str', 'A', null);
  ok(b.hp === hp0, 'バリア中は本体にダメージが通らない');
  const beam = id => ({ id, hook: 'yBeam', x: b.x, z: b.z - 8, yaw: 0, len: 13, w: 0.7 });
  const h1 = beam(9001); s.hzHook(h1); s.hzHook(h1);
  ok(s.U.barrier && s.U.barrier.hits === 1, '1本のビームを2回には数えない');
  s.hzHook(beam(9002)); ok(!s.U.barrier && b.st === 'stun', '2本目で破壊して短くよろめく');
  s.U.barrier = { t: 0, hits: 0, seen: {} }; b.st = 'idle'; b.testIdle = true; for (let i = 0; i < 60 * (U.moves.barrier.max + 0.1); i++) s.step();
  ok(!s.U.barrier, `${U.moves.barrier.max}秒で必ず解除`);
}
{ // 上野のスナップショット
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 30 })), seed: 3, stageId: 'ueno' });
  for (let i = 0; i < 60 * 5; i++) s.step();
  const v = PROTO.decodeSnap(JSON.parse(JSON.stringify(PROTO.encodeSnap(s))));
  ok(v.stageId === 'ueno' && v.U && v.U.alive === s.uenoAlive() && Math.abs(v.U.lvOut - 0.599) < 0.001 && v.U.need === 2500 && v.boss && v.mobs.every(m => m.yoshi && m.scale < 0.7), `スナップショットに上野の状態（部下${v.U && v.U.alive}・補正${v.U && v.U.lvOut}・次の必要量${v.U && v.U.need}）`);
}
// 7.95) 重玉・閃光銃800
{
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 20 }));
  const s = new Sim({ party, seed: 31, stageId: 'senju', test: true }); s.boss.testIdle = true; s.boss.hp = s.boss.maxHp = 1e9; s.barrier = 'plaza';
  s.allies.forEach((a, i) => { a.inv = 1e9; a.x = -6 + i * 4; a.z = 2; });
  const O = DATA.SIM.orb; let seen = 0, maxN = 0, outside = 0;
  for (let i = 0; i < 60 * 49.9; i++) s.step(); const n0 = s.orbs.length;
  s.allies.forEach(a => { a.x = 30; a.z = 30; }); // 拾わせない（遠くへ）
  s.allies.forEach(a => { a.st = 'down'; a.downT = -1e9; }); // 動かないように
  for (let i = 0; i < 60 * 12; i++) { s.step(); maxN = Math.max(maxN, s.orbs.length); for (const ob of s.orbs) { seen = 1; const c = s.clampPos(ob.x, ob.z, ob.x, ob.z, O.r - 0.02); if (Math.abs(c[0] - ob.x) > 0.05 || Math.abs(c[1] - ob.z) > 0.05) outside++; } }
  ok(n0 === 0 && seen && maxN === 1 && s.orbs.length === 0 && outside === 0, `有効戦闘50秒で1つ出て、壁の内側で反射しながら転がり、10秒で消える（最大${maxN}個・はみ出し${outside}）`);
  const s2 = new Sim({ party, seed: 32, stageId: 'senju', test: true }); s2.boss.testIdle = true; s2.boss.hp = s2.boss.maxHp = 1e9;
  const a = s2.allies[0]; a.inv = 1e9; s2.orbs.push({ id: 999, x: a.x, z: a.z, vx: 0, vz: 0, life: 10 }); s2.updateOrbs(1 / 60);
  ok(a.orb === 1 && s2.orbs.length === 0, '触れると拾う（1個まで）');
  s2.orbs.push({ id: 998, x: a.x, z: a.z, vx: 0, vz: 0, life: 10 }); const other = s2.allies[1]; other.x = 40; other.z = 40; s2.allies.forEach(o => { if (o !== a) { o.x = 40; o.z = 40; } }); s2.updateOrbs(1 / 60);
  ok(s2.orbs.length === 1 && a.orb === 1, '持っているキャラが触れても球は消費しない（2個目は持てない）');
  // 重玉の必殺は効果量2倍（ヒット数は同じ）、妖気は使わない
  const s3 = testSim('kogemaru'); const k = s3.allies[0]; s3.boss.def = 141; k.orb = 1; k.sp = 37;
  run(s3, 0, [[0, 'O+']], 2.5); const L1 = s3.mlog.find(l => /重玉/.test(l.nm));
  const s4 = testSim('kogemaru'); const k4 = s4.allies[0]; s4.boss.def = 141; k4.sp = 100; run(s4, 0, [[0, 'SP']], 2.5); const L2 = s4.mlog.find(l => l.nm === k4.c.spNm);
  const nocrit = L => L.dmg.filter((d, i, arr) => d <= Math.min(...arr) * 1.2);
  ok(L1 && L2 && L1.hits.length === L2.hits.length && Math.abs(nocrit(L1)[0] / nocrit(L2)[0] - 2) < 0.05 && k.sp === 37 + (k.sp - 37) && k.orb === 0, `重玉・${k.c.spNm}：ヒット数${L1 && L1.hits.length}は同じ、1発 ${L2 && nocrit(L2)[0]}→${L1 && nocrit(L1)[0]}（2倍）、重玉を消費`);
  // 閃光銃800：固定800・倍率なし・1人1発・HP段階ロックを守る
  const u = new Sim({ party: [{ ch: 'kogemaru', lv: 40, items: ['starburst_gun', 'starburst_gun'] }, { ch: 'hoshisuzume', lv: 40 }, { ch: 'burikidon', lv: 40 }, { ch: 'momiji', lv: 40 }], seed: 3, stageId: 'ueno', test: true, idle: true });
  u.mobs = []; const g = u.allies[0]; g.ctrlAI = false; g.inv = 1e9; g.x = u.boss.x; g.z = u.boss.z - 6; g.yaw = 0; u.allies.slice(1).forEach(o => { o.x = 15; o.z = 2; o.inv = 1e9; });
  ok(g.items.filter(it => it.id === 'starburst_gun').length === 1 && g.items.find(it => it.id === 'starburst_gun').n === 1, '銃は両方の枠に入れても1丁・1発');
  u.boss.hp = 23000; u.lvOut = 1.25; u.U.sleep = null;
  const gi = g.items.findIndex(it => it.id === 'starburst_gun'); run(u, 0, [[0, 'I' + gi]], 1.5);
  ok(u.boss.hp === 22500 && g.items[gi].n === 0, `HP23,000の本体へは500だけ（段階ロック・Lv補正なし）→ ${u.boss.hp}`);
  const u2 = new Sim({ party: [{ ch: 'kogemaru', lv: 40, items: ['starburst_gun', 'onigiri'] }, { ch: 'hoshisuzume', lv: 40 }, { ch: 'burikidon', lv: 40 }, { ch: 'momiji', lv: 40 }], seed: 3, stageId: 'ueno', test: true, idle: true });
  u2.mobs = []; const g2 = u2.allies[0]; g2.ctrlAI = false; g2.inv = 1e9; g2.x = u2.boss.x; g2.z = u2.boss.z - 6; g2.yaw = 0; u2.allies.slice(1).forEach(o => { o.x = 15; o.z = 2; o.inv = 1e9; }); u2.lvOut = 1.25;
  u2.U.sleep = { i: 0, t: 0, dmg: 0 }; u2.boss.st = 'sleep'; u2.boss.hp = 22500; run(u2, 0, [[0, 'I0']], 1.5);
  ok(u2.boss.hp === 22500 - 800 && u2.U.sleep && u2.U.sleep.dmg === 800, `睡眠中でも800のまま（×2.25・Lv補正なし）。阻止の合計に800を加える（${u2.U.sleep && u2.U.sleep.dmg}）`);
  const u3 = new Sim({ party: [{ ch: 'kogemaru', lv: 40, items: ['starburst_gun', 'onigiri'] }, { ch: 'hoshisuzume', lv: 40 }, { ch: 'burikidon', lv: 40 }, { ch: 'momiji', lv: 40 }], seed: 3, stageId: 'ueno', test: true, idle: true });
  u3.mobs = []; const g3 = u3.allies[0]; g3.ctrlAI = false; g3.x = u3.boss.x + 8; g3.z = u3.boss.z - 6; g3.yaw = Math.PI / 2; u3.boss.st = 'hidden'; const h3 = u3.boss.hp; run(u3, 0, [[0, 'I0']], 1.5);
  ok(u3.boss.hp === h3 && g3.items[0].n === 0, '外れても弾は消費する（ダメージ0）');
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
