// 通信の自動検査：往復100ms/200ms・重複・欠落があっても二重ダメージやHP不一致が起きないか
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js', 'proto.js', 'net.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date, performance });
vm.runInContext(src + ';globalThis.__={DATA,SIMLIB,PROTO,NETLIB,Sim}', ctx);
const { DATA, SIMLIB, NETLIB, Sim } = ctx.__; DATA.SIM.aRand = 0;
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
  const n1 = s.mlog.filter(l => l.slot === cs1 && l.nm === DATA.CHI.hoshisuzume.spNm);
  const n2 = s.mlog.filter(l => l.slot === cs2 && l.nm === DATA.CHI.akaneten.spNm);
  const n0 = s.mlog.filter(l => l.slot === 0 && l.nm === DATA.CHI.kogemaru.spNm);
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
function aiPickScenario() { // v7 P4-1：協力の空きAI枠はホストが選ぶ（参加者のキャラは変えない・参加/退出で指定を保つ）
  const hub = new NETLIB.LoopHub({ lat: 0.05 }); NETLIB.setClock(() => hub.t * 1000);
  const host = new NETLIB.HostSession({ transport: hub.add('H'), code: '5555', nick: 'ホスト', ch: 'kogemaru', aiParty: ['taiko', 'momiji', 'burikidon'] });
  const dt = 1 / 60; let clis = []; const run = s => { for (let i = 0; i < s * 60; i++) { hub.advance(dt); host.update(dt); clis.forEach(c => c.update(dt)); } };
  ok(host.aiFill().join() === ',taiko,momiji,burikidon', `1人：AI3体はホストの指定（${host.aiFill().slice(1).join('・')}）`);
  ok(host.setAi(2, 'new_c_02').ok && host.aiFill()[2] === 'new_c_02', 'ホストがP3のAIを狒々に変える');
  ok(host.setAi(3, 'new_c_02').ok && host.aiFill()[3] === 'new_c_02' && host.aiFill()[2] === 'burikidon', '別のAI枠と同じキャラを選ぶと入れ替える');
  ok(!host.setAi(0, 'taiko').ok && !host.setAi(3, 'kogemaru').ok, 'ホスト自身の枠・人間が使っているキャラはAI枠に指定できない');
  const c1 = new NETLIB.ClientSession({ transport: hub.add('C') }); clis.push(c1); c1.hello({ nick: 'さんか', ch: 'taiko', items: ['onigiri', 'ramune'] }); run(1.5);
  const f2 = host.aiFill(); ok(host.lobby.slots[1] && f2[1] === null && !f2.includes('taiko') && f2.filter(Boolean).length === 2 && f2[3] === 'new_c_02', `2人：AI2体（${f2.filter(Boolean).join('・')}）。参加者と同じ鬼神はAIから外れ、残りの指定は保つ`);
  ok(!host.setAi(1, 'momiji').ok, '参加者の枠（P2）はホストでも変えられない');
  const lb = c1.lobby; ok(lb && lb.ai && lb.ai[3] === 'new_c_02' && lb.ai[1] === null, `参加者にもAI枠の指定が届く（${lb && lb.ai && lb.ai.filter(Boolean).join('・')}）`);
  c1.closed = true; clis = []; hub.remove('C'); host.onLeave('C'); run(0.3); // 参加者が本当に去る（通信も切れる）
  const f3 = host.aiFill(); ok(f3[1] === 'taiko' && f3[3] === 'new_c_02', `退出するとP2はホストの指定（鬼神）に戻る（${f3.slice(1).join('・')}）`);
  host.startGame(); ok(host.sim.allies.map(a => a.ch).join() === 'kogemaru,taiko,burikidon,new_c_02', `出動も同じ編成（${host.sim.allies.map(a => DATA.CHI[a.ch].nm).join('・')}）`);
}
aiPickScenario();
function joinAckScenario() { // v8：入室の確認応答（wel）・2人→3人→4人・再送で二重登録しない・確定しない／見つからないの区別
  const hub = new NETLIB.LoopHub({ lat: 0.12, dup: 0.3, drop: 0.1 }); NETLIB.setClock(() => hub.t * 1000);
  const host = new NETLIB.HostSession({ transport: hub.add('H'), code: '7777', nick: 'ホスト', ch: 'kogemaru' });
  const cs = []; const dt = 1 / 60; const run = s => { for (let i = 0; i < s * 60; i++) { hub.advance(dt); host.update(dt); cs.forEach(c => c.update(dt)); } };
  for (const [id, ch] of [['C1', 'hoshisuzume'], ['C2', 'akaneten'], ['C3', 'taiko']]) {
    const c = new NETLIB.ClientSession({ transport: hub.add(id), code: '7777' }); cs.push(c); c.hello({ nick: id, ch, items: ['onigiri', 'ramune'] });
    ok(!c.joined, `${id}：つないだ直後はまだ「入室中」（空のロビーを参加完了にしない）`);
    run(3); const n = cs.length + 1;
    ok(c.joined && c.mySlot >= 1, `${id}：ホストの確認で参加完了（P${c.mySlot + 1}・遅延120ms・重複30%・欠落10%）`);
    ok(cs.every(x => (x.lobby.slots || []).filter(Boolean).length === n) && host.lobby.slots.filter(Boolean).length === n, `${n}人：ホストと参加者の一覧が同じ${n}人`);
  }
  const sl = cs.map(c => c.mySlot); ok(new Set(sl).size === 3 && host.clients.size === 3, `枠が重ならない（${sl.map(x => 'P' + (x + 1)).join('・')}）`);
  for (let i = 0; i < 5; i++) { cs[0].hiAcc = 99; run(0.2); } ok(host.clients.size === 3 && host.lobby.slots.filter(Boolean).length === 4, 'あいさつを何度再送しても同じ人は1枠');
  const c5 = new NETLIB.ClientSession({ transport: hub.add('C5'), code: '7777' }); c5.hello({ nick: 'C5', ch: 'momiji' }); cs.push(c5); run(2);
  ok(c5.rejected === 'full' && !c5.joined, `5人目は「満員」（${c5.rejected}）`);
  const hub2 = new NETLIB.LoopHub({ lat: 0.05 }); NETLIB.setClock(() => hub2.t * 1000); DATA.NET.connectTimeout = 3;
  const lone = new NETLIB.ClientSession({ transport: hub2.add('L'), code: '0000' }); lone.hello({ nick: 'L', ch: 'momiji' });
  for (let i = 0; i < 4 * 60; i++) { hub2.advance(dt); lone.update(dt); } ok(lone.lost === 'no_peer', `ホストがいない：${lone.lost}`);
  const hub3 = new NETLIB.LoopHub({ lat: 0.05 }); NETLIB.setClock(() => hub3.t * 1000);
  const h3 = new NETLIB.HostSession({ transport: hub3.add('H'), code: '8888', nick: 'ホスト', ch: 'kogemaru' }); h3.onMsg = function (m, from) { if (m && m.t === 'hi') return; }; // 受け付けが返らないホスト
  const c3 = new NETLIB.ClientSession({ transport: hub3.add('C'), code: '8888' }); c3.hello({ nick: 'C', ch: 'momiji' });
  for (let i = 0; i < 4 * 60; i++) { hub3.advance(dt); h3.update(dt); c3.update(dt); } ok(c3.lost === 'no_ack' && !c3.joined, `ロビーは届くが枠が確定しない：${c3.lost}（空のロビーのまま待たせない）`);
  DATA.NET.connectTimeout = 30;
}
joinAckScenario();
connectScenario();
scenario(0.05, 0.3, 0.03);
scenario(0.10, 0.5, 0.05);
console.log(fails ? `\n${fails}件の失敗` : '\nすべて合格');
process.exit(fails ? 1 : 0);
