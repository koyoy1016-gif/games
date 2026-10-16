// 通信の自動検査：往復100ms/200ms・重複・欠落があっても二重ダメージやHP不一致が起きないか
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js', 'proto.js', 'net.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date, performance });
vm.runInContext(src + ';globalThis.__={DATA,SIMLIB,PROTO,NETLIB,Sim}', ctx);
const { DATA, SIMLIB, NETLIB, Sim } = ctx.__;
let fails = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fails++; };

function scenario(lat, dup, drop) {
  const hub = new NETLIB.LoopHub({ lat, dup, drop }); NETLIB.setClock(() => hub.t * 1000); // 通信の時計を検査の時間に合わせる
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
  s.allies.forEach((a, i) => { a.ctrlAI = host.sim.allies[i].ctrlAI; a.x = [-0.3, 0.9, 2.2, 6][i]; a.z = DATA.STAGE.bossSpawn[1] - 1.75; });
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
  // 一時的な途切れ（8秒）：ホストはAIで代わりに動かし、戻れば操作に戻る。参加者は「再接続中」になり、切断にはならない
  hub.mute('C', true); run(8);
  ok(s.allies[cs1].ctrlAI === true && cli.state === 'reconnecting' && !cli.lost, `8秒とだえる → ホスト側はAIが代行・参加者は再接続中（${cli.state}）`);
  hub.mute('C', false); run(1.5);
  ok(s.allies[cs1].ctrlAI === false && cli.state === 'game' && !cli.lost, `通信が戻ると操作も戻る（${cli.state}）`);
  // 切断：AIへ引き継ぎ
  hub.remove('D'); run(0.5);
  ok(s.allies[cs2].ctrlAI === true, '参加者が切断したらAIが引き継ぐ');
  // ホストが突然いなくなる：すぐには切らず、とだえたまま25秒で切断
  hub.remove('H'); hub.mute('H', true); run(10);
  ok(!cli.lost && cli.state === 'reconnecting', `ホストが突然消えても10秒は再接続中（${cli.state}）`);
  run(17);
  ok(cli.lost === 'timeout', `とだえたまま25秒で切断（${cli.lost}）`);
}
function connectScenario() {
  // 接続前：相手が見つからない／見つかったがロビー情報が来ない／ホストが部屋を閉じる
  const hub = new NETLIB.LoopHub({ lat: 0.05 }); NETLIB.setClock(() => hub.t * 1000);
  const cli = new NETLIB.ClientSession({ transport: hub.add('C') }); cli.hello({ nick: 'x', ch: 'kogemaru' });
  const dt = 1 / 60; const run = (s, ...ss) => { for (let i = 0; i < s * 60; i++) { hub.advance(dt); for (const x of ss) x.update(dt); } };
  run(10, cli); ok(!cli.lost && cli.state === 'connecting', `相手探し中の10秒は切らない（旧：6秒で切断）（${cli.state}）`);
  run(21, cli); ok(cli.lost === 'no_peer', `30秒たっても相手が見つからない → 「見つからない」（${cli.lost}）`);
  const hub2 = new NETLIB.LoopHub({ lat: 0.05 }); NETLIB.setClock(() => hub2.t * 1000);
  const mute = hub2.add('H'); mute.h = {}; // 相手はいるが何も返さない
  const c2 = new NETLIB.ClientSession({ transport: hub2.add('C') }); c2.hello({ nick: 'x', ch: 'kogemaru' });
  const run2 = s => { for (let i = 0; i < s * 60; i++) { hub2.advance(dt); c2.update(dt); } };
  run2(1); ok(c2.state === 'handshake', `相手は見つかった → 「接続確立中」（${c2.state}）`);
  run2(31); ok(c2.lost === 'no_lobby', `ロビー情報が来ない → 「接続できない」（${c2.lost}）`);
  // 遅い接続（12秒後にホストが現れる）でも入れる
  const hub3 = new NETLIB.LoopHub({ lat: 0.1 }); NETLIB.setClock(() => hub3.t * 1000);
  const c3 = new NETLIB.ClientSession({ transport: hub3.add('C') }); c3.hello({ nick: 'x', ch: 'kogemaru' });
  const run3 = (s, h) => { for (let i = 0; i < s * 60; i++) { hub3.advance(dt); c3.update(dt); if (h) h.update(dt); } };
  run3(12);
  const h3 = new NETLIB.HostSession({ transport: hub3.add('H'), code: '1234', nick: 'ホスト', ch: 'kogemaru' });
  run3(2, h3); ok(c3.state === 'lobby' && h3.lobby.slots[1], `相手が見つかるのに12秒かかっても入れる（${c3.state}）`);
  // 満員・開始済み・版違い
  h3.startGame(); const c4 = new NETLIB.ClientSession({ transport: hub3.add('E') }); c4.hello({ nick: 'y', ch: 'kogemaru' });
  for (let i = 0; i < 120; i++) { hub3.advance(dt); c3.update(dt); c4.update(dt); h3.update(dt); }
  ok(c4.rejected === 'started', `戦闘が始まった部屋には「開始済み」（${c4.rejected}）`);
  // ホストが部屋を閉じる → すぐ「ホストが閉じた」
  h3.leave(); for (let i = 0; i < 60; i++) { hub3.advance(dt); c3.update(dt); }
  ok(c3.lost === 'host_left', `ホストが部屋を閉じたらすぐ知らせる（${c3.lost}）`);
  ok(NETLIB.LOG.some(e => e.tag === 'state') && NETLIB.LOG.some(e => /ロビー情報を受信/.test(e.msg)), '接続の経過がログに残る');
}
connectScenario();
scenario(0.05, 0.3, 0.03);
scenario(0.10, 0.5, 0.05);
console.log(fails ? `\n${fails}件の失敗` : '\nすべて合格');
process.exit(fails ? 1 : 0);
