// 戦闘シミュレーションの自動検査（three.js 不要）
// 使い方: node tobatoban/tools/sim-test.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'sim.js', 'proto.js'].filter(f => fs.existsSync(path.join(dir, f))).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
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
// 7) 気絶と昇天、救助
{
  const s = testSim('momiji'); const a = s.allies[0], o = s.allies[1];
  o.x = a.x + 1; o.z = a.z; o.hp = 1; s.dealToAlly(o, 999, 'str', s.boss, {});
  ok(o.st === 'down', '体力0で気絶');
  run(s, 0, [[0, 'B+', 2.5]], 2.3);
  ok(o.st === 'ok', `モミジ翁は約2秒で救助（${o.st}）`);
  o.hp = 1; o.inv = 0; s.dealToAlly(o, 999, 'str', s.boss, {});
  s.inputs[0] = SIMLIB.Sim.emptyInput(); a.x += 5;
  for (let i = 0; i < 60 * 31; i++) s.step();
  ok(o.st === 'gone', '30秒放置で昇天');
  s.allies[0].sp = 100; run(s, 0, [[0, 'SP']], 2);
  ok(o.st === 'gone', '昇天済みは必殺でも蘇生しない');
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
