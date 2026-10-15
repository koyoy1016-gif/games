// 通信の自動検査：往復100ms/200ms・重複・欠落があっても二重ダメージやHP不一致が起きないか
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'sim.js', 'proto.js', 'net.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date, performance });
vm.runInContext(src + ';globalThis.__={DATA,SIMLIB,PROTO,NETLIB,Sim}', ctx);
const { DATA, SIMLIB, NETLIB, Sim } = ctx.__;
let fails = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fails++; };

function scenario(lat, dup, drop) {
  const hub = new NETLIB.LoopHub({ lat, dup, drop });
  const host = new NETLIB.HostSession({ transport: hub.add('H'), code: '1234', nick: 'ホスト', ch: 'kogemaru' });
  const cli = new NETLIB.ClientSession({ transport: hub.add('C') });
  const cli2 = new NETLIB.ClientSession({ transport: hub.add('D') });
  cli.hello({ nick: 'さんか', ch: 'hoshisuzume', items: ['onigiri', 'ramune'] });
  cli2.hello({ nick: 'さんか2', ch: 'akaneten', items: ['onigiri', 'ramune'] });
  const dt = 1 / 60; const run = s => { for (let i = 0; i < s * 60; i++) { hub.advance(dt); host.update(dt); cli.update(dt); cli2.update(dt); } };
  run(2.5);
  ok(host.lobby.slots[1] && host.lobby.slots[2], `ロビーに2人が入る（遅延${lat * 2000}ms）`);
  host.startGame();
  // 戦闘場面を作る（テスト用にボス前へ）
  const party = host.sim.allies.map(a => ({ ch: a.ch }));
  const s = new Sim({ party, diff: 'normal', seed: 5, test: true });
  s.allies.forEach((a, i) => { a.ctrlAI = host.sim.allies[i].ctrlAI; a.x = [-0.3, 0.9, 2.2, 6][i]; a.z = 19 - 1.75; });
  s.boss.hp = s.boss.maxHp = 1e6; host.sim = s;
  run(1.5);
  const cs1 = cli.mySlot, cs2 = cli2.mySlot;
  s.allies[cs1].sp = 100; s.allies[cs2].sp = 100; s.allies[0].sp = 100;
  // 3人が同時に必殺
  cli.local.lock = 'boss'; cli2.local.lock = 'boss'; host.local.lock = 'boss';
  cli.local.push('SP'); cli2.local.push('SP'); host.local.push('SP');
  run(0.05); cli.local.push('A');
  run(4);
  const n1 = s.mlog.filter(l => l.slot === cs1 && l.nm === '星灯大放射');
  const n2 = s.mlog.filter(l => l.slot === cs2 && l.nm === '紅灯四重陣');
  const n0 = s.mlog.filter(l => l.slot === 0 && l.nm === '炭火十連掌');
  ok(n1.length === 1 && n1[0].hits.length === 8, `参加者1の必殺は1回だけ・8回命中（${n1.length}回, ${n1[0] && n1[0].hits.length}hit）`);
  ok(n2.length === 1 && n2[0].hits.length === 4, `参加者2の必殺は1回だけ・4回命中（${n2.length}回, ${n2[0] && n2[0].hits.length}hit）`);
  ok(n0.length === 1 && n0[0].hits.length === 10, `ホストの必殺は1回だけ・10回命中`);
  ok(s.allies[cs1].stats.specials === 1, `ゲージ消費は承認時に1回（${s.allies[cs1].stats.specials}）`);
  const hostR = Math.round(s.boss.hp / s.boss.maxHp * 1000) / 1000;
  const v1 = cli.latest(), v2 = cli2.latest();
  ok(v1 && Math.abs(v1.boss.hpR - hostR) < 0.0015 && Math.abs(v2.boss.hpR - hostR) < 0.0015, `全員が同じボスHPを受け取る（host ${hostR} / ${v1 && v1.boss.hpR} / ${v2 && v2.boss.hpR}）`);
  // 切断：AIへ引き継ぎ
  hub.remove('D'); run(0.5);
  ok(s.allies[cs2].ctrlAI === true, '参加者が切断したらAIが引き継ぐ');
  // ホスト切断
  hub.remove('H'); run(0.3);
  ok(cli.lost === 'host_left', 'ホスト切断は参加者側で中断扱い');
}
scenario(0.05, 0.3, 0.03);
scenario(0.10, 0.5, 0.05);
console.log(fails ? `\n${fails}件の失敗` : '\nすべて合格');
process.exit(fails ? 1 : 0);
