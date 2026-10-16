// 上野（ヨシノシン戦）を AI だけで走らせ、時間・勝敗・被弾・睡眠チェック・二十連・バリアを測る
// 使い方: node tobatoban/tools/ueno-battle.mjs [seed] [lv] [party] [--all-ai]
//   既定は P1 を「人が操作」扱い（能力100%）・他3体はAI（能力90%）。--all-ai で4体ともAI能力
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date });
vm.runInContext(src + ';globalThis.__={DATA,SIMLIB}', ctx);
const { DATA, SIMLIB } = ctx.__;
const args = process.argv.slice(2).filter(a => !a.startsWith('--')), allAi = process.argv.includes('--all-ai'), quiet = process.argv.includes('--quiet');
const seed = +(args[0] || 1), lv = +(args[1] || 40);
const party = (args[2] || 'kogemaru,hoshisuzume,burikidon,momiji').split(',').map(c => ({ ch: c, lv }));
const s = new SIMLIB.Sim({ party, seed, stageId: 'ueno' });
s.allies.forEach((a, i) => a.ctrlAI = allAi || i > 0);
const inputs = s.allies.map(() => SIMLIB.Sim.emptyInput());
const log = []; let hurt = 0, downs = 0, lastMin = -1, maxAlive = 0, maxAtk = 0, maxBeamAtk = 0;
const st = { sleep: 0, sleepOk: 0, sleepDmg: [], throws: 0, barrier: 0, barrierBroken: 0, summon: 0, moves: {} };
for (let i = 0; i < 60 * 60 * 20; i++) {
  s.allies.forEach((a, k) => s.setInput(k, s.aiInput(a, inputs[k])));
  s.step();
  for (const e of s.events) if (!e._c) { e._c = 1;
    if (e.type === 'hurt') hurt++; if (e.type === 'down') downs++;
    if (e.type === 'bossmove') st.moves[e.mv] = (st.moves[e.mv] || 0) + 1;
    if (e.type === 'sleep') { st.sleep++; log.push(`t=${s.t.toFixed(0)} 睡眠チャージ開始（余剰${e.carry}）`); }
    if (e.type === 'sleepEnd') { if (e.ok) st.sleepOk++; st.sleepDmg.push(e.dmg); log.push(`t=${s.t.toFixed(0)} 睡眠チェック${e.i + 1} ${e.ok ? '成功' : '失敗'} ${e.dmg}/${e.need}`); }
    if (e.type === 'barrier') { if (e.on) st.barrier++; if (e.broken) st.barrierBroken++; log.push(`t=${s.t.toFixed(0)} バリア ${e.on ? '開始' : e.broken ? '破壊' : '時間切れ'}`); }
    if (e.type === 'bossmove' && e.mv === 'throw50') { st.throws++; log.push(`t=${s.t.toFixed(0)} 部下丸投げ二十連（HP${Math.round(s.boss.hp / s.boss.maxHp * 100)}%・生存${s.uenoAlive()}）`); }
    if (e.type === 'waveWarn') st.summon++;
  }
  const alive = s.uenoAlive(); maxAlive = Math.max(maxAlive, alive);
  const atk = s.mobs.filter(m => m.st === 'ok' && m.act); maxAtk = Math.max(maxAtk, atk.length); maxBeamAtk = Math.max(maxBeamAtk, atk.filter(m => m.typ === 'beam').length);
  const min = Math.floor(s.t / 60); if (min !== lastMin) { lastMin = min; log.push(`--- ${min}分 ボスHP${Math.round(s.boss.hp / s.boss.maxHp * 100)}% 部下${alive} 撃破${s.kills} 味方HP ${s.allies.map(a => a.st === 'ok' ? Math.round(a.hp / a.maxHp * 100) : a.st).join('/')}`); }
  if (s.stage === 'won' || s.stage === 'lost') break;
}
if (!quiet) console.log(log.join('\n'));
const res = { seed, lv, win: !!(s.result && s.result.win), why: s.result && s.result.why, time: s.result ? Math.round(s.result.time - DATA.UENO.introT) : null, bossHp: Math.round(s.boss.hp / s.boss.maxHp * 100), kills: s.kills, hurt, downs, maxAlive, maxAtk, maxBeamAtk, lvOut: s.lvOut, lvIn: s.lvIn, ...st };
console.log(JSON.stringify(res));
if (!quiet) for (const a of s.allies) console.log(a.c.nm, 'Lv', a.lv, 'dmg', a.stats.dmg, 'kills', a.stats.kills, 'downs', a.stats.downs, 'revives', a.stats.revives, a.st);
