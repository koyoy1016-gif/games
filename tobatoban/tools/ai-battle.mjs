// AIだけで1戦を走らせ、進行が詰まらないかを確認する
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date });
vm.runInContext(src + ';globalThis.__={DATA,SIMLIB}', ctx);
const { DATA, SIMLIB } = ctx.__;
const diff = process.argv[2] || 'normal', seed = +(process.argv[3] || 1);
const party = (process.argv[4] || 'kogemaru,hoshisuzume,burikidon,momiji').split(',').map(c => ({ ch: c }));
const s = new SIMLIB.Sim({ party, diff, seed });
s.allies.forEach((a, i) => a.ctrlAI = i > 0);
const inputs = s.allies.map(() => SIMLIB.Sim.emptyInput());
const moves = {}; let lastStage = '';
for (let i = 0; i < 60 * 60 * 20; i++) {
  s.allies.forEach((a, k) => { const inp = s.aiInput(a, inputs[k]); if (k === 0 && s.stage === 'street' && s.barrier === 'none') { inp.mx = 0; inp.mz = 1; } s.setInput(k, inp); });
  s.step();
  for (const e of s.events) if (e.type === 'bossmove' && !e._c) { e._c = 1; moves[e.mv] = (moves[e.mv] || 0) + 1; }
  if (s.stage !== lastStage) { console.log(`t=${s.t.toFixed(1)} stage=${s.stage}`); lastStage = s.stage; }
  if (s.stage === 'won' || s.stage === 'lost') break;
}
console.log('result', s.result, 'bossHP%', s.boss ? Math.round(s.boss.hp / s.boss.maxHp * 100) : '-');
console.log('moves', moves);
for (const a of s.allies) console.log(a.c.nm, 'dmg', a.stats.dmg, 'downs', a.stats.downs, 'revives', a.stats.revives, 'sp', a.stats.specials, a.st);
