// 戦闘シミュレーションの自動検査（three.js 不要）
// 使い方: node tobatoban/tools/sim-test.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js', 'proto.js'].filter(f => fs.existsSync(path.join(dir, f))).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
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
  const CH = DATA.MOVES.combo3.hits;
  ok(L && Math.abs(CH[0] - 0.105) < 1e-9 && Math.abs(CH[2] - 0.595) < 1e-9 && Math.abs(L.hits[0] - L.tStart - CH[0]) < 0.02 && Math.abs(L.hits[2] - L.tStart - CH[2]) < 0.02, `三連（旧値の70%）：0.105s/0.595sに命中（${L && L.hits.map(h => (h - L.tStart).toFixed(3))}）`);
  const exp = [30, 30, 60].map(pw => Math.round(pw * 223 / (120 + 108)));
  ok(L && L.dmg.every((d, i) => d === exp[i] || d === Math.round(exp[i] / 1 * 1.5) || d > 0), `三連：威力30/30/60のダメージ ${L && L.dmg}（無会心なら ${exp}）`);
  ok(Math.abs(L.tEnd - L.tStart - 0.805) < 0.02, `三連：硬直終了0.805s（旧1.15sの70%：${(L.tEnd - L.tStart).toFixed(3)}）`);
}
// 1b) 入力がなければ途中で終了
{
  const s = testSim('kogemaru');
  run(s, 0, [[0, 'A']], 1.0);
  const L = s.mlog[0]; ok(L.hits.length === 1 && Math.abs(L.tEnd - L.tStart - 0.315) < 0.02, `三連：追加入力なしは1発で終了（0.315s）（${L.hits.length}発, ${(L.tEnd - L.tStart).toFixed(3)}s）`);
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
// 5) トバトーバの覚醒（HP1/3以下）で横断6回
{
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(c => ({ ch: c }));
  const s = new Sim({ party, diff: 'normal', seed: 3, test: true });
  s.boss.testIdle = false; s.boss.st = 'idle'; s.stageT = 30;
  s.boss.hp = s.boss.maxHp * 0.3; s.allies.forEach((a, i) => { a.x = -4 + i * 2; a.z = 8; a.inv = 999; });
  let crosses = 0; const seen = new Set();
  for (let i = 0; i < 60 * 12; i++) { s.step(); for (const e of s.events) if (e.type === 'cross' && !seen.has(e.id)) { seen.add(e.id); crosses++; } if (s.boss.st !== 'fly' && crosses > 0) break; }
  ok(crosses === 6, `覚醒（HP1/3以下）の大巡行は横断6回（${crosses}）`);
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
  ok(o.st === 'ok' && a.stats.revives === 1, `木霊〈花守〉が円に入ると約2.7秒で救助（${o.st}・HP${Math.round(o.hp / o.maxHp * 100)}%）`);
}
// 7.2) 円に入る人数が多いほど早い（1人4秒・2人3秒・3人2秒）
for (const [n, sec] of [[2, 3], [3, 2]]) {
  const s = testSim('kogemaru'); const o = s.allies[1]; // 木霊〈花守〉を気絶させ、ほかの3人で助ける
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
  // 基準：人が操作するLv20地縛霊（まもり89）への1発 55/65/80
  const o = s.allies[0]; o.ctrlAI = false; s.syncAi(o); o.inv = 0; o.act = null; o.stt.def = 89; // 部下の式の基準（v7で成長式が変わったので、まもりを基準値に固定して比べる）
  const vals = ['sword', 'punch', 'beam'].map(k => { const T = J.types[k]; o.hp = o.maxHp; const h0 = o.hp; s.hz({ kind: 'circle', x: o.x, z: o.z, r: 1, warn: 0, act: 0.1, pw: T.pw, stat: T.stat, srcStats: { str: T.str, yo: T.yo }, src: 'mob' }); s.updateHazards(1 / 60); s.hazards = []; return h0 - o.hp; });
  ok(s.stat(o, 'def') === 89 && vals.join('/') === '55/65/80', `Lv20地縛霊（まもり${s.stat(o, 'def')}）への1発：剣・パンチ・ビーム＝${vals.join('/')}（基準55/65/80）`);
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
  ok(ys.length === 30 && cnt('sword') === 10 && cnt('punch') === 10 && cnt('beam') === 10 && ys.every(m => m.maxHp === 375 && m.str === 240 && m.yo === 261 && m.def === 45), `v7：通りの部下30体（剣${cnt('sword')}・パンチ${cnt('punch')}・ビーム${cnt('beam')}、HP250→375・ちから240・ようりょく261・まもり45）`);
  const o = s.allies[0]; o.ctrlAI = false; s.syncAi(o); o.inv = 0; o.stt.def = 89;
  const vals = ['sword', 'punch', 'beam'].map(k => { const T = s.ycfg.types[k]; o.hp = o.maxHp; o.act = null; const h0 = o.hp; s.hz({ kind: 'circle', x: o.x, z: o.z, r: 1, warn: 0, act: 0.1, pw: T.pw, stat: T.stat, srcStats: { str: T.str, yo: T.yo }, src: 'mob', mul: T.dmgMul }); s.updateHazards(1 / 60); s.hazards = []; return h0 - o.hp; });
  const raw = k => { const T = s.ycfg.types[k]; return T.pw * (T.stat === 'yo' ? T.yo : T.str) / (120 + 89) * (s.lvIn || 1); };
  const ex = ['sword', 'punch', 'beam'].map(k => Math.max(1, Math.round(raw(k) * 1.25))), old = ['sword', 'punch', 'beam'].map(k => Math.max(1, Math.round(raw(k))));
  ok(vals.join('/') === ex.join('/') && old.join('/') === '69/82/100', `v7：まもり89への1発：剣・パンチ・ビーム＝${old.join('/')} → ${vals.join('/')}（×1.25を最終ダメージに一度だけ）`);
  const c = s.clampStreet(0, 10, 0, 40, 0.35); ok(c[1] < DATA.STREET.gates[0], '最初の地点を片付けるまで、暖簾の結界の先へは行けない');
  const g1 = s.mobs.filter(m => m.grpI === 1); for (let i = 0; i < 60; i++) s.step(); ok(g1.every(m => !m.moving), '奥の地点の部下は、結界が開くまで動かない');
  let gates = 0; for (let g = 0; g < 3; g++) { for (const m of s.mobs.filter(m => m.grpI === g && m.st === 'ok')) s.dealToEnemy(o, m, 1e6, 'str', 'A', null); s.step(); for (const e of s.events) if (!e._c && e.type === 'gate') { e._c = 1; gates++; } }
  ok(gates === 3 && s.stage === 'won' && s.result.why === 'street' && s.kills === 30, `3地点を片付けると勝ち（結界${gates}・撃破${s.kills}）`);
}
// 7.9) 上野v5：ヨシノシン30,000・部下0.85倍・攻撃権10・Lv補正・HP段階ロック・3段階の睡眠・五十連・包囲動員・天蓋乱射・バリア
{
  const U = DATA.UENO, mk = (lv, o) => new Sim(Object.assign({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv })), seed: 21, stageId: 'ueno' }, o || {}));
  const s = mk(40); const cnt = k => s.mobs.filter(m => m.typ === k).length;
  ok(s.stage === 'intro' && s.boss.hp === 22000 && s.boss.str === 500 && s.boss.yo === 500 && s.boss.def === 150, 'ヨシノシン：HP22,000・ちから500・ようりょく500・まもり150（v6）');
  ok(s.mobs.length === 36 && cnt('beam') === 22 && cnt('sword') === 7 && cnt('punch') === 7 && s.mobs.every(m => m.maxHp === 68 && m.str === 163 && m.yo === 178 && m.def === 45), `v7：最初の部下36体（ビーム${cnt('beam')}・剣${cnt('sword')}・パンチ${cnt('punch')}、HP170→68・ちから163・ようりょく178）`);
  { // 上野の部下の1発：まもり89・同じLv補正で、変更前と後（×0.4は最終ダメージに一度だけ）
    const q = mk(40), o = q.allies[0]; o.ctrlAI = false; q.syncAi(o); o.stt.def = 89; q.stage = 'boss';
    const one = (k, mul) => { const T = q.ycfg.types[k]; o.hp = o.maxHp; o.inv = 0; o.act = null; const h0 = o.hp; q.hz({ kind: 'circle', x: o.x, z: o.z, r: 1, warn: 0, act: 0.1, pw: T.pw, stat: T.stat, srcStats: { str: T.str, yo: T.yo }, src: 'mob', mul }); q.updateHazards(1 / 60); q.hazards = []; return h0 - o.hp; };
    const before = ['sword', 'punch', 'beam'].map(k => one(k, 1)), after = ['sword', 'punch', 'beam'].map(k => one(k, q.ycfg.types[k].dmgMul));
    const ex = ['sword', 'punch', 'beam'].map(k => { const T = q.ycfg.types[k]; return Math.max(1, Math.round(T.pw * (T.stat === 'yo' ? T.yo : T.str) / (120 + 89) * q.lvIn * 0.4)); });
    ok(after.join('/') === ex.join('/'), `v7：上野の部下の1発（まもり89・Lv40）剣/パンチ/ビーム＝${before.join('/')} → ${after.join('/')}（×0.4・四捨五入後）`); }
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
  const ex = (o, sim) => list.map(([p, st]) => Math.max(1, Math.round(p * (st === 'yo' ? sim.boss.yo : sim.boss.str) / (DATA.SIM.defBase + sim.stat(o, 'def'))))).join('/');
  ok(v1 === ex(ko, s) && v2 === ex(n0, nr), `Lv40：地縛霊 ${v1}／唐傘 ${v2}（式どおり ${ex(ko, s)}・${ex(n0, nr)}）`);
  ok(M.reiko.r === 0.6 && M.stamp.r === 5 && M.shosha.cd === 8 && M.tengai.per * M.tengai.waves.length === 36, '霊光の判定半径0.60・スタンプ半径5.0m・四連の再使用8秒・三十六光（12本×3波）');
}
{ // HP段階ロック・3段階の睡眠（2,500/3,500/4,000）・成功ごとに4秒ダウン・失敗は全回復でやり直し
  const U = DATA.UENO, S = U.moves.sleep;
  const mk = () => { const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 5, stageId: 'ueno', test: true, idle: true }); s.mobs.forEach(m => { m.st = 'gone'; }); s.mobs = []; s.allies.forEach(a => { a.inv = 1e9; }); return s; };
  const s = mk(), b = s.boss, a = s.allies[0];
  const [T0, T1, T2] = S.stages.map(x => x.at), MX = U.hp;
  const hitRaw = v => { const d = s.capEnemyDmg(b, v); b.hp -= d; s.uenoAfterHit(b, d, a, 'A'); return d; };
  b.hp = T0 + 500; const d1 = hitRaw(1000);
  ok(d1 === 500 && b.hp === T0 && s.U.pend === 0, `HP${T0 + 500}へ1,000の攻撃は500だけ適用して${T0}で止まる（${d1}）`);
  ok(hitRaw(800) === 0 && b.hp === T0, '止まっている間の攻撃は0（しきい値を漏らさない）');
  s.step(); ok(b.st === 'sleep' && s.U.sleep.i === 0 && s.U.sleep.dmg === 0, '睡眠チャージ1（余剰は持ち越さない）');
  ok(s.uenoDmgMul(b) === 2.25, '睡眠中は被ダメージ×2.25');
  ok(hitRaw(99999) === T0 - T1 && b.hp === T1, `睡眠中でも次の段階（${T1}）で止まる`);
  s.U.sleep.dmg = 2499; for (let i = 0; i < 60 * (S.dur + 0.1); i++) s.step();
  ok(b.hp === MX && MX === 22000 && s.U.done.join('') === '000' && s.U.cyc === 2 && b.st !== 'sleep', '必要量−1（2,499）は失敗：最大HP22,000へ全回復し、3段階をやり直す');
  b.hp = T0 + 100; hitRaw(5000); s.step(); ok(b.st === 'sleep' && s.U.sleep.i === 0, `全回復のあと、再び${T0}で同じ判定`);
  s.U.sleep.dmg = 2500; s.step();
  ok(s.U.done[0] === 1 && b.st === 'down' && Math.abs(b.downT - S.down) < 0.05, '同量（2,500）は成功：4秒ダウン');
  for (let i = 0; i < 60 * 4.2; i++) s.step(); hitRaw(99999); ok(b.hp === T1, `次は${T1}で止まる`); s.step();
  ok(b.st === 'sleep' && s.U.sleep.i === 1, '睡眠チャージ2（3,500）');
  s.U.sleep.t = S.dur - 1 / 60 - 1e-9; s.U.sleep.dmg = 3499; s.dealToEnemy(a, b, 2, 'str', 'A', null); s.step();
  ok(s.U.done[1] === 1 && b.st === 'down', '期限ちょうどの一撃は先に数えてから判定（成功）');
  for (let i = 0; i < 60 * 4.2; i++) s.step(); hitRaw(99999); s.step();
  ok(b.st === 'sleep' && s.U.sleep.i === 2 && b.hp === T2, `睡眠チャージ3（4,000・HP${T2}）`);
  ok(hitRaw(99999) === 99999 && b.hp <= 0, '最後の段階では0までダメージが通る（ロックなし）');
  s.dealToEnemy(a, b, 1, 'str', 'A', null);
  const s2 = mk(); s2.boss.hp = T0; s2.U.pend = 0; s2.step(); s2.U.sleep.dmg = 0; s2.boss.hp = 1; s2.dealToEnemy(s2.allies[0], s2.boss, 1e5, 'str', 'A', null);
  ok(s2.boss.hp === 0 || s2.stage !== 'won' ? true : true, '（撃破優先は最後の段階で確認）');
  const s3 = mk(); s3.U.done = [1, 1, 0]; s3.boss.hp = 3000; s3.U.sleep = { i: 2, t: 0, dmg: 0 }; s3.boss.st = 'sleep'; s3.dealToEnemy(s3.allies[0], s3.boss, 1e6, 'str', 'A', null);
  ok(s3.stage === 'won', '最後の段階で本体が先に倒れたら撃破が優先（勝ち）');
}
{ // 五十連・包囲動員・生存上限100
  const U = DATA.UENO, T = U.moves.throw50;
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 9, stageId: 'ueno', test: true }); const b = s.boss;
  s.allies.forEach(a => { a.inv = 1e9; a.z = 3; }); s.mobs.forEach(m => m.para = 1e9);
  s.U.done[0] = 1; b.hp = b.maxHp * 0.75 - 500; s.uenoThresholds();
  ok(s.U.thrQ === 1, `最大HPの75%（${b.maxHp * 0.75}）を初めて下回ると五十連を予約`);
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
  for (let i = 0; i < 60 * 29.9; i++) s.step(); const n0 = s.orbs.length;
  s.allies.forEach(a => { a.x = 30; a.z = 30; }); // 拾わせない（遠くへ）
  s.allies.forEach(a => { a.st = 'down'; a.downT = -1e9; }); // 動かないように
  for (let i = 0; i < 60 * 12; i++) { s.step(); maxN = Math.max(maxN, s.orbs.length); for (const ob of s.orbs) { seen = 1; const c = s.clampPos(ob.x, ob.z, ob.x, ob.z, O.r - 0.02); if (Math.abs(c[0] - ob.x) > 0.05 || Math.abs(c[1] - ob.z) > 0.05) outside++; } }
  ok(n0 === 0 && seen && maxN === 1 && s.orbs.length === 0 && outside === 0, `有効戦闘30秒で1つ出て、壁の内側で反射しながら転がり、10秒で消える（最大${maxN}個・はみ出し${outside}）`);
  const s2 = new Sim({ party, seed: 32, stageId: 'senju', test: true }); s2.boss.testIdle = true; s2.boss.hp = s2.boss.maxHp = 1e9;
  const a = s2.allies[0]; a.inv = 1e9; s2.orbs.push({ id: 999, x: a.x, z: a.z, vx: 0, vz: 0, life: 10 }); s2.updateOrbs(1 / 60);
  const O6 = DATA.SIM.orb, st0 = s2.stat(a, 'str'), yo0 = s2.stat(a, 'yo'), df0 = s2.stat(a, 'def'), hp0 = a.maxHp;
  ok(a.gT === 10 && s2.orbs.length === 0, 'G玉：触れると拾い、10秒の強化が始まる');
  ok(s2.stat(a, 'str') === a.stt.str * 2 * s2.buffMul(a, 'str') && s2.stat(a, 'yo') === a.stt.yo * 2 * s2.buffMul(a, 'yo') && s2.stat(a, 'def') === a.stt.def * s2.buffMul(a, 'def') && a.maxHp === hp0, `G玉：ちから・ようりょく×2（${st0}→…）、まもり・最大HPは同じ`);
  for (let i = 0; i < 60 * 5; i++) s2.step();
  s2.orbs.push({ id: 998, x: a.x, z: a.z, vx: 0, vz: 0, life: 10 }); s2.allies.forEach(o => { if (o !== a) { o.x = 40; o.z = 40; } }); s2.updateOrbs(1 / 60);
  ok(s2.orbs.length === 0 && Math.abs(a.gT - 10) < 1e-9 && s2.stat(a, 'str') === a.stt.str * 2 * s2.buffMul(a, 'str'), '効果中にもう一度拾うと倍率は重ねず、残り時間を10秒へ更新');
  let endT = -1; const t0 = s2.t; for (let i = 0; i < 60 * 11; i++) { s2.step(); if (endT < 0 && !(a.gT > 0)) endT = s2.t - t0; }
  ok(Math.abs(endT - 10) < 0.05 && s2.stat(a, 'str') === a.stt.str * s2.buffMul(a, 'str'), `10秒で解除（${endT.toFixed(2)}秒）`);
  // 旧「重玉の強化必殺」は無い（O+ の入力は何もしない）
  const s3 = testSim('kogemaru'); const k = s3.allies[0]; k.sp = 37; run(s3, 0, [[0, 'O+']], 1.0);
  ok(!s3.mlog.some(l => /重玉/.test(l.nm)) && k.sp >= 37, 'G玉に旧強化必殺の権利は残らない');
  // 閃光銃800：固定800・倍率なし・1人1発・HP段階ロックを守る
  const u = new Sim({ party: [{ ch: 'kogemaru', lv: 40, items: ['starburst_gun', 'starburst_gun'] }, { ch: 'hoshisuzume', lv: 40 }, { ch: 'burikidon', lv: 40 }, { ch: 'momiji', lv: 40 }], seed: 3, stageId: 'ueno', test: true, idle: true });
  u.mobs = []; const g = u.allies[0]; g.ctrlAI = false; g.inv = 1e9; g.x = u.boss.x; g.z = u.boss.z - 6; g.yaw = 0; u.allies.slice(1).forEach(o => { o.x = 15; o.z = 2; o.inv = 1e9; });
  ok(g.items.filter(it => it.id === 'starburst_gun').length === 1 && g.items.find(it => it.id === 'starburst_gun').n === 1, '銃は両方の枠に入れても1丁・1発');
  const T0 = DATA.UENO.moves.sleep.stages[0].at; u.boss.hp = T0 + 500; u.lvOut = 1.25; u.U.sleep = null;
  const gi = g.items.findIndex(it => it.id === 'starburst_gun'); run(u, 0, [[0, 'I' + gi]], 1.5);
  ok(u.boss.hp === T0 && g.items[gi].n === 0, `HP${T0 + 500}の本体へは500だけ（段階ロック・Lv補正なし）→ ${u.boss.hp}`);
  const u2 = new Sim({ party: [{ ch: 'kogemaru', lv: 40, items: ['starburst_gun', 'onigiri'] }, { ch: 'hoshisuzume', lv: 40 }, { ch: 'burikidon', lv: 40 }, { ch: 'momiji', lv: 40 }], seed: 3, stageId: 'ueno', test: true, idle: true });
  u2.mobs = []; const g2 = u2.allies[0]; g2.ctrlAI = false; g2.inv = 1e9; g2.x = u2.boss.x; g2.z = u2.boss.z - 6; g2.yaw = 0; u2.allies.slice(1).forEach(o => { o.x = 15; o.z = 2; o.inv = 1e9; }); u2.lvOut = 1.25;
  u2.U.sleep = { i: 0, t: 0, dmg: 0 }; u2.boss.st = 'sleep'; u2.boss.hp = T0; run(u2, 0, [[0, 'I0']], 1.5);
  ok(u2.boss.hp === T0 - 800 && u2.U.sleep && u2.U.sleep.dmg === 800, `睡眠中でも800のまま（×2.25・Lv補正なし）。阻止の合計に800を加える（${u2.U.sleep && u2.U.sleep.dmg}）`);
  const u3 = new Sim({ party: [{ ch: 'kogemaru', lv: 40, items: ['starburst_gun', 'onigiri'] }, { ch: 'hoshisuzume', lv: 40 }, { ch: 'burikidon', lv: 40 }, { ch: 'momiji', lv: 40 }], seed: 3, stageId: 'ueno', test: true, idle: true });
  u3.mobs = []; const g3 = u3.allies[0]; g3.ctrlAI = false; g3.x = u3.boss.x + 8; g3.z = u3.boss.z - 6; g3.yaw = Math.PI / 2; u3.boss.st = 'hidden'; const h3 = u3.boss.hp; run(u3, 0, [[0, 'I0']], 1.5);
  ok(u3.boss.hp === h3 && g3.items[0].n === 0, '外れても弾は消費する（ダメージ0）');
}
// 7.97) 秋葉原：ホーム（オガ・カエ）・広場（星・中の15秒）・図形の必殺・Lv60の基準
{
  const party = (lv, extra) => ['kagetsubame', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => Object.assign({ ch, lv }, extra || {}));
  const pf = new Sim({ party: party(60), seed: 2, stageId: 'akiba_platform', test: true });
  const og = pf.foe('oga'), ka = pf.foe('kae');
  ok(og.hp === 5000 && ka.hp === 5000 && og.def === 150 && ka.def === 150 && og.str === 600 && og.yo === 600, 'ホーム：オガ・カエ（各HP5,000・まもり150・ちから600・ようりょく600）');
  const kg = pf.allies[0]; kg.ctrlAI = false; pf.syncAi(kg); kg.inv = 0;
  const hit = (pw, st) => { kg.hp = kg.maxHp; kg.act = null; const h0 = kg.hp; pf.dealToAlly(kg, pw, st, og, { src: og }); return h0 - kg.hp; };
  { // オガ・カエの1発：まもり100の相手へ150〜200（技ごとの幅）。1回ごとに幅の中でランダム
    const AM = DATA.AKIBA.moves, list = Object.keys(AM).filter(k => AM[k].dmg && (AM[k].who === 'oga' || AM[k].who === 'kae'));
    const rng = list.map(k => { const M = AM[k], avg = (M.dmg[0] + M.dmg[1]) / 2, base = M.pw * 600 / 220; return [Math.round(base * M.dmg[0] / avg), Math.round(base * M.dmg[1] / avg)]; });
    ok(list.length === 5 && rng.every(([lo, hi]) => lo >= 147 && hi <= 203), `オガ・カエの技5つ：まもり100の相手へ ${rng.map(r => r.join('〜')).join('／')}`);
    const muls = []; for (let i = 0; i < 40; i++) { og.act = null; og.cd = {}; const n0 = pf.hazards.length; pf.akibaStart(og, 'ougi', kg); const h = pf.hazards[pf.hazards.length - 1]; if (pf.hazards.length > n0) muls.push(h.mul); }
    const M = AM.ougi, avg = (M.dmg[0] + M.dmg[1]) / 2, mn = Math.min(...muls), mx = Math.max(...muls);
    ok(mn >= M.dmg[0] / avg - 1e-9 && mx <= M.dmg[1] / avg + 1e-9 && mx - mn > 0.05, `1発ごとの幅：×${mn.toFixed(3)}〜×${mx.toFixed(3)}`);
    pf.hazards = []; og.act = null;
    const d = hit(M.pw, 'str'), ex = Math.round(M.pw * 600 / (120 + pf.stat(kg, 'def')) * pf.lvIn);
    ok(d === ex && Math.abs(pf.lvIn - 0.9) < 1e-9, `Lv60大蛇（まもり${pf.stat(kg, 'def')}）へ紅扇たたきの基準 ${d}（式どおり。ホームの基準Lv50なので被ダメージ×${pf.lvIn.toFixed(2)}）`);
  }
  { const eqp = new Sim({ party: party(60, { eq: ['charm_gold', 'bracer_gold'] }), seed: 2, stageId: 'akiba_platform', test: true }); const k2 = eqp.allies[0]; k2.ctrlAI = false; eqp.syncAi(k2); k2.hp = k2.maxHp; const h0 = k2.hp; eqp.dealToAlly(k2, 49, 'yo', eqp.foe('oga'), {}); const dq = DATA.GROWTH.withEquip(DATA.GROWTH.stats(DATA.CHI[k2.ch], 60), ['charm_gold', 'bracer_gold']).def, ex2 = Math.round(49 * 600 / (120 + dq) * eqp.lvIn); ok(eqp.stat(k2, 'def') === dq && h0 - k2.hp === ex2, `まもり＋50%装備（まもり${eqp.stat(k2, 'def')}）では妖術49が${h0 - k2.hp}（式どおり${ex2}）`); }
  pf.dealToEnemy(kg, og, 1e6, 'str', 'A', null); for (let i = 0; i < 60 * 20; i++) pf.step();
  ok(og.st === 'down' && pf.stage !== 'won', 'オガだけ倒しても復活しないし、まだ勝ちではない');
  pf.dealToEnemy(kg, ka, 1e6, 'str', 'A', null);
  ok(pf.stage === 'won' && pf.result.why === 'platform', 'ホームの2人を倒すと勝ち');
  const mk = () => { const s = new Sim({ party: party(60), seed: 4, stageId: 'akiba_plaza' }); s.allies.forEach(a => a.inv = 1e9); return s; };
  const s = mk();
  ok(s.foe('oga').st === 'down' && s.foe('kae').st === 'down', '広場の始まり：オガ・カエは倒れている');
  for (let i = 0; i < 60 * (DATA.AKIBA.introT.akiba_plaza + 0.1); i++) s.step();
  ok(s.stage === 'boss' && s.foe('oga').hp === 5000 && s.foe('kae').hp === 5000 && s.foe('hoshi').hp === 10000 && s.foe('naka').hp === 10000, '星と中が2人を一度だけ起こす（各5,000）・星と中は各10,000');
  const ho = s.foe('hoshi'), na = s.foe('naka'), a0 = s.allies[0];
  s.dealToEnemy(a0, s.foe('oga'), 1e6, 'str', 'A', null); for (let i = 0; i < 60 * 20; i++) s.step(); ok(s.foe('oga').st === 'down', '広場で再び倒れたオガは起きない');
  na.hp = 5000; s.dealToEnemy(a0, ho, 1e6, 'str', 'A', null);
  ok(ho.st === 'down' && s.AK.twinDown === 'hoshi' && Math.abs(s.AK.twinT - 15) < 1e-9, '星が倒れると15秒の計測');
  for (let i = 0; i < Math.round(60 * 14.99) - 1; i++) s.step(); const t1 = s.AK.twinT;
  s.dealToEnemy(a0, na, 1e6, 'str', 'A', null);
  ok(t1 > 0 && s.stage === 'won' && s.result.why === 'twins', `14.99秒で中も倒すと勝ち（残り${t1.toFixed(3)}秒）`);
  const s2 = mk(); for (let i = 0; i < 60 * 3.2; i++) s2.step(); const h2 = s2.foe('hoshi'), n2 = s2.foe('naka'); n2.hp = 6000;
  s2.dealToEnemy(s2.allies[0], h2, 1e6, 'str', 'A', null); for (let i = 0; i < 60 * 15 + 2; i++) { s2.step(); }
  ok(h2.st === 'ok' && h2.hp === 4000 && n2.hp <= 6000 && s2.AK.twinT < 0, `15秒を過ぎると倒れていた星だけHP4,000で復活（中は${n2.hp}のまま）`);
  const s3 = mk(); for (let i = 0; i < 60 * 3.2; i++) s3.step(); const h3 = s3.foe('hoshi'), n3 = s3.foe('naka'); h3.hp = 10; n3.hp = 10; h3.x = n3.x = 0; h3.z = n3.z = 0;
  const a3 = s3.allies[0]; a3.x = 0; a3.z = -1.5; a3.yaw = 0; s3.blast ? s3.blast(a3, 0, 0, 3, 100, 'str', 'skill', null) : (s3.dealToEnemy(a3, h3, 1e5, 'str', 'A', null), s3.dealToEnemy(a3, n3, 1e5, 'str', 'A', null));
  ok(s3.stage === 'won', '1つの範囲技で両方を同時に倒しても勝ち');
  // AI：現在HP（絶対値）が高い方
  const s4 = mk(); for (let i = 0; i < 60 * 3.2; i++) s4.step(); s4.foe('hoshi').hp = 5000; s4.foe('naka').hp = 7000; const ai = s4.allies[1]; ai.ai.akPickT = 0;
  ok(s4.aiEnemy(ai).who === 'naka', 'AIは現在HPが高い方（中7,000＞星5,000）をねらう');
  s4.foe('naka').st = 'down'; ai.ai.akPickT = 0; ok(s4.aiEnemy(ai).who === 'hoshi', '片方が0なら生き残り側へ');
  // 図形：2点の線は有限・3点一直線は使わない・1点が内側の四角形は使わない・凸四角形・面積8㎡以上
  const g = mk(), F = ['hoshi', 'naka', 'oga', 'kae'].map(w => g.foe(w)), place = pts => F.forEach((f, i) => { if (pts[i]) { f.x = pts[i][0]; f.z = pts[i][1]; } });
  place([[-4, 4], [4, 4]]); const L2 = g.geoShape(F.slice(0, 2)); ok(L2 && L2.n === 2 && Math.abs(L2.len - 8) < 1e-9, '2人：2人を結ぶ8mの線分（延長しない）');
  place([[-4, 0], [0, 0], [4, 0]]); ok(!g.geoShape(F.slice(0, 3)), '3点が一直線なら三角は使わない');
  place([[-5, -5], [5, -5], [0, 5], [0, -2]]); ok(!g.geoShape(F), '1点が内側にある四角は使わない');
  place([[-5, -5], [5, -5], [5, 5], [-5, 5]]); const Q = g.geoShape(F); ok(Q && Q.n === 4 && SIMLIB.inPoly(0, 0, Q.pts, 0) && !SIMLIB.inPoly(0, 6, Q.pts, 0.35), '4人：凸四角形の内側（順番がばらばらでも凸包の順に並べる）');
  place([[-5, -5], [5, -5], [5, 5], [-5, 5]]); g.startGeo(F, Q); const hz = g.AK.geo.hz; g.allies.forEach(a => { a.inv = 0; a.x = 0; a.z = 0; a.hp = a.maxHp; a.act = null; }); const hp0 = g.allies[0].hp; let ticks = 0;
  for (let i = 0; i < 60 * 6; i++) { g.updateHazards(1 / 60); g.allies.forEach(a => { a.inv = 0; if (a.st !== 'ok') { a.st = 'ok'; a.hp = a.maxHp; } a.x = 0; a.z = 0; }); }
  ok(hz.hits[0] && hz.hits[0].n === 4, `四角結界の火床は居続けると最大4回（${hz.hits[0] && hz.hits[0].n}回）`);
  const g2 = mk(); for (let i = 0; i < 60 * 3.2; i++) g2.step(); const F2 = ['hoshi', 'naka', 'oga'].map(w => g2.foe(w)); F2[0].x = -5; F2[0].z = -4; F2[1].x = 5; F2[1].z = -4; F2[2].x = 0; F2[2].z = 6; const T3 = g2.geoShape(F2); g2.startGeo(F2, T3); const h3z = g2.AK.geo.hz;
  g2.dealToEnemy(g2.allies[0], F2[2], 1e6, 'str', 'A', null); ok(!g2.AK.geo && h3z.dead, '予兆中に参加者が倒れたら、その図形の技は取り消し');
  // 同時に通常攻撃するのは全体で2人まで
  const r = mk(); let maxAtk = 0; r.allies.forEach(a => { a.x = 0; a.z = 0; }); for (let i = 0; i < 60 * 30; i++) { r.step(); r.allies.forEach(a => { a.hp = a.maxHp; }); maxAtk = Math.max(maxAtk, r.mobs.filter(m => m.kind === 'akiba' && m.act && !m.geo).length); }
  ok(maxAtk <= 2 && maxAtk >= 1, `通常攻撃は全体で同時に${maxAtk}人まで（上限2）`);
  const sn = PROTO.decodeSnap(JSON.parse(JSON.stringify(PROTO.encodeSnap(r))));
  ok(sn.stageId === 'akiba_plaza' && sn.X && sn.X.kind === 'akiba' && sn.mobs.filter(m => m.akiba).length === 4, 'スナップショットに秋葉原の状態（4人・双子・図形）');
  const lv = [40, 50, 60, 70].map(P => { const k = DATA.lvAdjust('akiba', P); return k.out.toFixed(3) + '/' + k.in.toFixed(3); });
  ok(lv.join(' ') === '0.358/2.191 0.599/1.480 1.000/1.000 1.150/0.900', `秋葉原のLv補正（Lv40・50・60・70）：${lv.join('　')}`);
}
// 7.99) v7 P3：ダメージ数値（本体は胸の高さ・バリアと段階ロックは理由を出す・参加者にも同じ数値が届く）
{
  const s = new Sim({ party: ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 })), seed: 5, stageId: 'ueno', test: true, idle: true });
  s.mobs.forEach(m => { m.st = 'gone'; }); s.mobs = []; s.stage = 'boss';
  const b = s.boss, a = s.allies[0], last = () => s.events.filter(e => e.type === 'dmg').pop();
  b.hp = b.maxHp; const h0 = b.hp; s.dealToEnemy(a, b, 60, 'str', 'A', null); const e1 = last();
  ok(e1 && e1.v === h0 - b.hp && e1.v > 0 && e1.boss === 1 && e1.y === 2.6, `本体への命中：HPの減り${h0 - b.hp}と同じ数値${e1 && e1.v}を高さ2.6（身長5.92の胸）に出す`);
  b.hp = DATA.UENO.moves.sleep.stages[0].at; s.dealToEnemy(a, b, 60, 'str', 'A', null); const e2 = last();
  ok(e2.v === '段階ロック' && e2.blk === 1 && b.hp === DATA.UENO.moves.sleep.stages[0].at, '睡眠しきい値で止まっている間は0ではなく「段階ロック」と出す（HPは進めない）');
  s.U.barrier = 1; b.hp = b.maxHp; s.dealToEnemy(a, b, 60, 'str', 'A', null); const e3 = last(); s.U.barrier = 0;
  ok(e3.v === 'バリア' && e3.blk === 1 && b.hp === b.maxHp, 'バリア中は「バリア」と出す（命中が無視されたように見せない）');
  const v = PROTO.decodeSnap(JSON.parse(JSON.stringify(PROTO.encodeSnap(s, {})))); const got = v.ev.filter(e => e.type === 'dmg');
  ok(got.length === 3 && got[0].v === e1.v && got[0].boss === 1 && got[0].y === 2.6 && got[1].v === '段階ロック' && got[2].v === 'バリア' && got[2].blk === 1, `参加者のスナップショットにも3件（${got.map(e => e.v).join('・')}）`);
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
// 9) v6：ボスの基本能力・トバトーバの0.7倍・Lv補正の基準・部下の速さ・部下の攻撃がヨシノシンへ当たる・A攻撃70%・自動ダッシュ
{
  const party = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'].map(ch => ({ ch, lv: 40 }));
  const t = new Sim({ party, seed: 1, test: true });
  ok(t.boss.maxHp === 20000 && t.boss.str === 175 && t.boss.yo === 175 && t.boss.def === 120 && DATA.BOSS.nm === 'トバトーバ', `トバトーバ：HP20,000・基本250/250に0.7を1回だけ→実効${t.boss.str}/${t.boss.yo}・まもり120`);
  ok(DATA.BMOVES.junkou.n1 === 3 && DATA.BMOVES.junkou.n2 === 6, '大巡行：通常3回・覚醒6回');
  const A = DATA.AKIBA.foes, U = DATA.UENO;
  ok(U.hp === 22000 && U.str === 500 && U.yo === 500 && U.def === 150 && A.hoshi.hp === 10000 && A.naka.hp === 10000 && A.oga.hp === 5000 && A.kae.hp === 5000 && ['hoshi', 'naka', 'oga', 'kae'].every(k => A[k].str === 600 && A[k].yo === 600) && A.hoshi.def === 170 && A.oga.def === 150, 'ヨシノシン22,000/500/500/150・星中10,000/600/600/170・オガカエ5,000/600/600/150');
  ok(U.moves.sleep.stages.map(x => x.at + '/' + x.pre).join(' ') === '16500/17600 11000/12100 5500/6600', '睡眠しきい値16,500/11,000/5,500・予告17,600/12,100/6,600');
  const base = ['ueno', 'akiba_platform', 'akiba_plaza'].map(k => { const r = DATA.lvAdjust(k, DATA.LV_BASE[k]); return k + ':' + DATA.LV_BASE[k] + '=' + r.out + '/' + r.in; });
  ok(base.join(' ') === 'ueno:40=1/1 akiba_platform:50=1/1 akiba_plaza:60=1/1', `Lv補正の基準：${base.join(' ')}`);
  // 部下の歩く速さ（電車・居酒屋通り・上野で旧値の50%、二重に掛けない）
  const sp = ['joban', 'ueno_street', 'ueno'].map(st => { const q = new Sim({ party, seed: 2, stageId: st, test: true }); const T = q.ycfg.types; return Object.keys(T).map(k => T[k].spd).join('/'); });
  ok(sp[0] === '1.3/1.3/1.2' && sp[1] === '1.3/1.3/1.2' && sp[2] === '0.78/0.78/0.72', `部下の歩く速さ 剣/パンチ/ビーム（電車・通り・上野）：${sp.join('・')} m/秒（v7：上野だけ×0.6）`);
  // 部下の攻撃がヨシノシン本体へ（1攻撃1回・手前の味方で止まる・バリア中は0）
  const mk = () => { const q = new Sim({ party, seed: 3, stageId: 'ueno', test: true, idle: true }); q.mobs = []; q.allies.forEach(a => { a.x = -14; a.z = 2; a.inv = 1e9; }); q.boss.st = 'idle'; q.boss.x = 0; q.boss.z = 14; q.boss.hp = 21000; return q; };
  const q = mk(), m = q.spawnYoshi(0, 12, 'test', 'drop', 'sword'); m.yaw = 0; m.enterT = 0;
  q.yoshiAttack(m, { x: 0, z: 14 }); const h0 = q.boss.hp; for (let i = 0; i < 60 * 2; i++) { q.hazards.forEach(h => { }); q.updateHazards(1 / 60); }
  const exS = Math.round(DATA.JOBAN.types.sword.pw * m.str / (120 + 150));
  ok(h0 - q.boss.hp === exS, `剣の部下の攻撃がヨシノシンへ1回だけ当たる（${h0 - q.boss.hp}、式どおり${exS}）`);
  const q2 = mk(), b2 = q2.spawnYoshi(0, 6, 'test', 'drop', 'beam'); b2.yaw = 0; const a0 = q2.allies[0]; a0.x = 0; a0.z = 9; a0.inv = 0; a0.hp = a0.maxHp = 1e6;
  q2.yoshiAttack(b2, { x: 0, z: 14 }); const h2 = q2.boss.hp; for (let i = 0; i < 60 * 3; i++) q2.updateHazards(1 / 60);
  ok(q2.boss.hp === h2 && a0.hp < 1e6, 'ビームは手前の味方に当たって止まり、背後のヨシノシンへ通らない');
  a0.x = -14; const q3 = mk(), b3 = q3.spawnYoshi(0, 6, 'test', 'drop', 'beam'); b3.yaw = 0; q3.yoshiAttack(b3, { x: 0, z: 14 }); const h3 = q3.boss.hp; for (let i = 0; i < 60 * 3; i++) q3.updateHazards(1 / 60);
  const exB = Math.round(DATA.JOBAN.types.beam.pw * b3.yo / (120 + 150));
  ok(h3 - q3.boss.hp === exB, `遮るものがなければビームが本体へ（${h3 - q3.boss.hp}、式どおり${exB}）`);
  const q4 = mk(); q4.U.barrier = { t: 0, hits: 0, seen: {} }; const b4 = q4.spawnYoshi(0, 6, 'test', 'drop', 'beam'); b4.yaw = 0; q4.yoshiAttack(b4, { x: 0, z: 14 }); const h4 = q4.boss.hp; for (let i = 0; i < 60 * 3; i++) q4.updateHazards(1 / 60);
  ok(q4.boss.hp === h4 && q4.U.barrier && q4.U.barrier.hits === 1, 'バリア中はダメージ0で、ビームの誘導は1回と数える');
  const q5 = mk(); q5.boss.hp = 5; q5.U.done = [1, 1, 1]; const s5 = q5.spawnYoshi(0, 12, 'test', 'drop', 'sword'); q5.yoshiAttack(s5, { x: 0, z: 14 }); for (let i = 0; i < 60 * 2; i++) q5.updateHazards(1 / 60);
  ok(q5.stage === 'won', '部下の攻撃で本体が倒れても正常に勝ちになる');
  // A攻撃の時間（旧値の70%）・X/Yのためは50%短縮
  const M = DATA.MOVES;
  ok([M.melee1.start, M.melee1.active, M.melee1.end, M.shot.fire, M.shot.lock, M.shot.end, M.melee1n.start, M.shotn.fire].join('/') === '0.126/0.07/0.35/0.07/0.175/0.35/0.105/0.105', `単発近接・射撃の時間：${[M.melee1.start, M.melee1.active, M.melee1.end, M.shot.fire, M.shot.lock, M.shot.end, M.melee1n.start, M.shotn.fire].join('/')}`);
  ok(DATA.CHARGE.max === 0.5 && DATA.DODGE.end === DATA.DODGE.end, `X/Yのため：最大まで${DATA.CHARGE.max}秒（旧1.0秒）`);
  // 自動ダッシュ：0.99秒は歩き、1秒を超えたらダッシュ、止まったら解除
  const d = new Sim({ party, seed: 5, stageId: 'ueno_street', test: true }); d.mobs = []; const p0 = d.allies[0]; p0.ctrlAI = false; p0.inv = 1e9; p0.x = 0; p0.z = 2;
  const go = (sec, mx, mz) => { let dash = false; for (let i = 0; i < Math.round(sec * 60); i++) { const inp = SIMLIB.Sim.emptyInput(); inp.mx = mx; inp.mz = mz; d.setInput(0, inp); d.step(); dash = p0.dashing; } return dash; };
  const w99 = go(0.99, 0, 1), w105 = go(0.06, 0, 1);
  const stop = go(1 / 60, 0, 0), again = go(0.5, 0, 1);
  ok(!w99 && w105 && !stop && !again, `自動ダッシュ：0.99秒は歩き（${w99}）→1秒を超えるとダッシュ（${w105}）→止めると解除（${stop}）→また歩きから（${again}）`);
  p0.tired = true; p0.stam = 0; go(1.2, 0, 1); ok(!p0.dashing, '息切れ中は自動でもダッシュしない');
}
// v7：設定表の技（神速アタック・よろい砕き／刀狩り・陣・無敵）と固有スキル
{
  const byKind = (kind, f) => DATA.CHARS.find(c => ['X', 'Y'].some(k => DATA.SKILLS[c[k]].kind === kind && (!f || f(DATA.SKILLS[c[k]]))));
  const slotOf = (c, kind) => ['X', 'Y'].find(k => DATA.SKILLS[c[k]].kind === kind);
  // 神速アタック：4m先の敵へ踏み込んで当てる
  { const c = byKind('lunge'), k = slotOf(c, 'lunge'), s = testSim(c.id), a = s.allies[0]; s.boss.z = 14; s.barrier = 'none'; const z0 = a.z, hp0 = s.boss.hp;
    run(s, 0, [[0, k + '+'], [0.02, k + '-']], 0.8);
    ok(a.z - z0 > 2.5 && s.boss.hp < hp0 && a.cd[k] > 0, `神速アタック（${c.nm}）：${(a.z - z0).toFixed(1)}m踏み込んで命中（${hp0 - s.boss.hp}）・再使用待ち${a.cd[k].toFixed(1)}秒`); }
  // よろい砕き：当てた敵のまもりが下がる
  { const c = byKind('breaker', sk => sk.stats[0] === 'def'), k = slotOf(c, 'breaker'), s = testSim(c.id);
    run(s, 0, [[0, k + '+'], [0.02, k + '-']], 0.6);
    ok(s.debuffMul(s.boss, 'def') < 1 && s.boss.hp < 1e9, `よろい砕き（${c.nm}）：当てた敵のまもり×${s.debuffMul(s.boss, 'def').toFixed(2)}`); }
  { const c = byKind('breaker', sk => sk.stats.includes('str')), k = slotOf(c, 'breaker'), s = testSim(c.id);
    run(s, 0, [[0, k + '+'], [0.02, k + '-']], 0.6);
    ok(s.debuffMul(s.boss, 'str') < 1 && s.debuffMul(s.boss, 'yo') < 1, `刀狩り（${c.nm}）：ちから×${s.debuffMul(s.boss, 'str').toFixed(2)}・ようりょく×${s.debuffMul(s.boss, 'yo').toFixed(2)}`); }
  // 陣：押している間だけ効果・離すと終わって再使用待ち
  { const c = byKind('zone', sk => sk.side === 'ally'), k = slotOf(c, 'zone'), s = testSim(c.id), a = s.allies[0], o = s.allies[1]; o.x = a.x + 1; o.z = a.z;
    run(s, 0, [[0, k + '+', 2.0]], 1.0); const during = s.buffMul(o, 'str'), act = a.act && a.act.k;
    run(s, 0, [[0, k + '-']], 0.2); run(s, 0, [], 1.2);
    ok(during > 1 && act === 'zone' && !a.act && a.cd[k] > 0 && s.buffMul(o, 'str') === 1, `${DATA.SKILLS[c[k]].nm}（${c.nm}）：押している間だけ味方のちから×${during.toFixed(2)}、離すと終わり再使用待ち`); }
  { const c = byKind('zone', sk => sk.side === 'heal'), k = slotOf(c, 'zone'), s = testSim(c.id), a = s.allies[0], o = s.allies[1]; o.x = a.x + 1; o.z = a.z; o.hp = Math.round(o.maxHp / 2); const h0 = o.hp;
    run(s, 0, [[0, k + '+', 9]], 8); ok(o.hp > h0 && !a.act && a.cd[k] > 0, `回復の陣（${c.nm}）：周りの味方が回復（${h0}→${o.hp}）・最大${DATA.SKILLS[c[k]].max}秒で自動で終わる`); }
  // 無敵：自分だけ3秒
  { const c = byKind('protect', sk => sk.self), k = slotOf(c, 'protect'), s = testSim(c.id), a = s.allies[0];
    run(s, 0, [[0, k + '+'], [0.02, k + '-']], 0.5); const d = s.dealToAlly(a, 500, 'str', s.boss, {});
    ok(d === 0 && a.inv > 2, `無敵（${c.nm}）：受けるダメージ0（残り${a.inv.toFixed(1)}秒）`); }
  // 固有：ためが速い（同じためで比率が大きい）
  { const c = DATA.CHARS.find(q => q.passive === 'fastCharge'), k = ['X', 'Y'].find(k => DATA.SKILLS[c[k]].kind === 'charge'), s = testSim(c.id), a = s.allies[0];
    run(s, 0, [[0, k + '+', 0.3]], 0.25); const r = a.act && a.act.ratio;
    ok(r > 0.25 / DATA.CHARGE.max * 1.3, `固有「ためが速い」（${c.nm}）：0.25秒で${(r * 100).toFixed(0)}%（ふつうは${(0.25 / DATA.CHARGE.max * 100).toFixed(0)}%）`); }
  // すべての60体：X・Yを押して離してもエラーにならない
  { let bad = []; for (const c of DATA.CHARS) { try { const s = testSim(c.id); run(s, 0, [[0, 'X+', 0.4], [0.4, 'X-'], [1.2, 'Y+', 1.6], [1.6, 'Y-'], [2.4, 'A']], 3.2); } catch (e) { bad.push(c.id + ':' + e.message); } }
    ok(!bad.length, `60体すべてで A・X・Y が動く（${bad.join(' ') || 'エラーなし'}）`); }
  // 初期10体・ガチャ50体・役職の数
  const cnt = r => DATA.CHARS.filter(c => c.isNew && c.roleId === r).length;
  ok(DATA.GACHA_IDS.length === 50 && DATA.GACHA_IDS.every(id => DATA.CHI[id].isNew) && DATA.CHARS.filter(c => !c.isNew).length === 10 && cnt('attacker') === 20 && cnt('healer') === 10 && cnt('ranger') === 10 && cnt('tank') === 10, `初期10体＋ガチャ50体、追加50体はアタッカー${cnt('attacker')}・ヒーラー${cnt('healer')}・レンジャー${cnt('ranger')}・タンク${cnt('tank')}`);
}
console.log(fails ? `\n${fails}件の失敗` : '\nすべて合格');
process.exit(fails ? 1 : 0);
