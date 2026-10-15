// どのステージでも AI だけで1戦を走らせ、時間・勝敗・被弾・気絶・睡眠チェック・双子の失敗回数などを測る
// 使い方: node tobatoban/tools/stage-battle.mjs <stage> [seed] [lv] [party] [--eq=bracer_purple,charm_purple] [--gun=N] [--all-ai] [--quiet]
//   stage: senju / joban / ueno_street / ueno / akiba_platform / akiba_plaza
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const src = ['data.js', 'roster_data.js', 'roster.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, Math, Set, Map, JSON, Object, Array, Number, String, Date });
vm.runInContext(src + ';globalThis.__={DATA,SIMLIB}', ctx);
const { DATA, SIMLIB } = ctx.__;
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v == null ? true : v]; }));
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const stage = args[0] || 'ueno', seed = +(args[1] || 1), lv = +(args[2] || 40);
const eq = flags.eq ? String(flags.eq).split(',') : [], guns = +(flags.gun || 0);
const party = (args[3] || 'kogemaru,hoshisuzume,burikidon,momiji').split(',').map((c, i) => ({ ch: c, lv, eq, items: i < guns ? ['starburst_gun', 'onigiri'] : ['onigiri', 'ramune'] }));
const s = new SIMLIB.Sim({ party, seed, stageId: stage });
s.allies.forEach((a, i) => a.ctrlAI = !!flags['all-ai'] || i > 0);
const inputs = s.allies.map(() => SIMLIB.Sim.emptyInput());
const dmgBy = {}; // 味方が受けたダメージの出どころ（--why）
if (flags.why) { const orig = s.dealToAlly.bind(s); s.dealToAlly = function (o, pw, stat, srcStats, opt) { const r = orig(o, pw, stat, srcStats, opt); if (r > 0) { const src = opt && opt.src; const k = src && typeof src === 'object' ? (src === s.boss ? 'boss:' + (s.boss.mv || '?') : 'mob:' + (src.typ || src.who || src.kind || '?')) : 'other:' + (opt && opt.mv || stat); dmgBy[k] = (dmgBy[k] || 0) + r; } return r; }; }
const st = { hurt: 0, downs: 0, sleep: [], twinFail: 0, orbs: 0, orbUse: 0, guns: 0, geo: [0, 0, 0, 0, 0] }, log = [];
let lastMin = -1;
for (let i = 0; i < 60 * 60 * 20; i++) {
  s.allies.forEach((a, k) => s.setInput(k, s.aiInput(a, inputs[k])));
  s.step();
  for (const e of s.events) if (!e._c) { e._c = 1;
    if (e.type === 'hurt') st.hurt++; if (e.type === 'down') st.downs++; if (e.type === 'orbGet') st.orbs++; if (e.type === 'sp' && e.heavy) st.orbUse++; if (e.type === 'gun') st.guns++;
    if (e.type === 'sleepEnd') { st.sleep.push(`${e.i + 1}:${e.ok ? 'OK' : 'NG'}${e.dmg}/${e.need}`); log.push(`t=${s.t.toFixed(0)} 睡眠${e.i + 1} ${e.ok ? '成功' : '失敗'} ${e.dmg}/${e.need}`); }
    if (e.type === 'twinRevive') { st.twinFail++; log.push(`t=${s.t.toFixed(0)} ${e.who}が復活（15秒に間に合わず）`); }
    if (e.type === 'twinDown') log.push(`t=${s.t.toFixed(0)} ${e.who}が倒れた → 15秒`);
    if (e.type === 'geo') st.geo[e.n]++;
  }
  const min = Math.floor(s.t / 60); if (min !== lastMin) { lastMin = min; const B = s.boss; log.push(`--- ${min}分 ${B ? 'ボスHP' + Math.round(B.hp) : ''} 敵${s.mobs.filter(m => m.st === 'ok').length} 撃破${s.kills} 味方HP ${s.allies.map(a => a.st === 'ok' ? Math.round(a.hp / a.maxHp * 100) : a.st).join('/')}${s.mobs.some(m => m.kind === 'akiba') ? ' 秋葉原 ' + s.mobs.filter(m => m.kind === 'akiba').map(m => m.who + ':' + Math.round(m.hp)).join(' ') : ''}`); }
  if (s.stage === 'won' || s.stage === 'lost') break;
}
if (!flags.quiet) console.log(log.join('\n'));
const intro = s.introLen ? s.introLen() : 0;
console.log(JSON.stringify({ stage, seed, lv, eq: eq.join('+') || '-', guns, win: !!(s.result && s.result.win), why: s.result && s.result.why, sec: s.result ? Math.round(s.result.time - intro) : null, bossHp: s.boss ? Math.round(s.boss.hp) : undefined, kills: s.kills, ...st }));
if (flags.why) console.log(JSON.stringify(Object.fromEntries(Object.entries(dmgBy).sort((a, b) => b[1] - a[1]))));
