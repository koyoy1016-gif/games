// 常磐線ステージを AI だけで走らせ、駅・波・到着まで進むか、どのくらい難しいかを見る
// 使い方: node tobatoban/tools/joban-battle.mjs [seed] [party] [lv]
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster.js', 'sim.js', 'joban.js', 'ueno.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date });
vm.runInContext(src + ';globalThis.__={DATA,SIMLIB}', ctx);
const { DATA, SIMLIB } = ctx.__;
const seed = +(process.argv[2] || 1);
const party = (process.argv[3] || 'kogemaru,hoshisuzume,burikidon,momiji').split(',').map(c => ({ ch: c, lv: +(process.argv[4] || 20) }));
const s = new SIMLIB.Sim({ party, seed, stageId: 'joban' });
s.allies.forEach((a, i) => a.ctrlAI = i > 0);
const inputs = s.allies.map(() => SIMLIB.Sim.emptyInput());
const log = []; const t0 = { }; let lastStage = '', maxAlive = 0, hurt = 0, downs = 0, lastMin = -1;
for (let i = 0; i < 60 * 60 * 20; i++) {
  s.allies.forEach((a, k) => s.setInput(k, s.aiInput(a, inputs[k])));
  s.step();
  for (const e of s.events) if (!e._c) { e._c = 1;
    if (e.type === 'arriveSt' || e.type === 'jev' || e.type === 'stage') log.push(`t=${s.t.toFixed(0)} ${e.type} ${e.id || ''} ${e.st != null && e.st >= 0 ? DATA.JOBAN.stations[e.st] : ''}${e.n != null ? ' n=' + e.n : ''}${e.cnt != null ? ' 数' + e.cnt : ''}${e.k ? ' ' + e.k : ''} 撃破${s.kills}`);
    if (e.type === 'hurt') hurt++; if (e.type === 'down') downs++; }
  maxAlive = Math.max(maxAlive, s.mobs.filter(m => m.st === 'ok').length);
  const min = Math.floor(s.t / 60); if (min !== lastMin) { lastMin = min; log.push(`--- ${min}分 撃破${s.kills}/${s.total} 車内${s.mobs.filter(m => m.st === 'ok').length} 駅${DATA.JOBAN.stations[s.tr.at]} ${s.tr.ph} v=${s.tr.v.toFixed(1)} HP ${s.allies.map(a => a.st === 'ok' ? Math.round(a.hp / a.maxHp * 100) : a.st).join('/')}`); }
  if (s.stage === 'won' || s.stage === 'lost') break;
}
console.log(log.join('\n'));
console.log('result', s.result, '戦闘', (s.result ? (s.result.time - DATA.JOBAN.introT).toFixed(0) : '-') + '秒', '撃破', s.kills, '/', s.total, '同時最大', maxAlive, '被弾', hurt, '気絶', downs);
for (const a of s.allies) console.log(a.c.nm, 'dmg', a.stats.dmg, 'kills', a.stats.kills, 'downs', a.stats.downs, 'revives', a.stats.revives, a.st);
