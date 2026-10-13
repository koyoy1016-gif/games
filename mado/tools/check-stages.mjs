#!/usr/bin/env node
// ステージ自動検査：ランダム生成したフロアが「クリア可能・複雑すぎない・生成が速い」かを確認する。
// 使い方: node mado/tools/check-stages.mjs [各難易度の数=60] [--seed=開始シード]
// index.html の <script id="mado-core"> を読み込むので、src/ を編集したら先に python3 mado/src/build.py を実行すること。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="mado-core">([\s\S]*?)<\/script>/);
if (!m) { console.error('mado-core script not found'); process.exit(2); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(m[1], ctx);
const K = ctx.MadoCore;

const N = parseInt(process.argv.find(a => /^\d+$/.test(a)) || '60');
const seed0 = parseInt((process.argv.find(a => a.startsWith('--seed=')) || '--seed=1').slice(7));
let failed = 0;

// 1) 物理の基本チェック: 力60%で約48m届くこと
const d60 = K.launchDist(.6, 1);
console.log(`力60% → ${d60.toFixed(1)}m / 力100% → ${K.launchDist(1, 1).toFixed(1)}m`);
if (d60 < 44 || d60 > 52) { console.log('NG: 60%の飛距離が想定(44〜52m)外'); failed++; }

// 2) 難易度ごとに大量生成して検査
for (const diff of ['easy', 'normal', 'hard']) {
  const rule = K.DIFF_RULE[diff];
  const stars = [0, 0, 0, 0, 0, 0], themes = {};
  let ms = 0, maxMs = 0, fallback = 0, bad = 0, obs = 0;
  for (let i = 0; i < N; i++) {
    const seed = (seed0 + i * 2654435761) >>> 0;
    const t = Date.now(); const s = K.build(seed, diff); const e = Date.now() - t;
    ms += e; maxMs = Math.max(maxMs, e); obs += s.obstacles.length;
    stars[s.stars]++; themes[s.themeName] = (themes[s.themeName] || 0) + 1;
    if (s.eval.tries < 0) fallback++;
    // 細かいグリッドで再検証（生成時より厳しめ）: 本当にクリア手段があるか
    const fine = K.evaluate(s, {angStep: 2, powStep: .005});
    if (fine.hits < 3 || s.obstacles.length > 12) {
      bad++; console.log(`  NG ${diff} seed=${seed} hits=${fine.hits} obstacles=${s.obstacles.length}`);
    }
  }
  console.log(`${diff.padEnd(6)} 平均${(ms / N).toFixed(0)}ms 最大${maxMs}ms 障害物平均${(obs / N).toFixed(1)} ` +
    `★分布[${stars.slice(1).join(',')}] 予備フロア${fallback} NG${bad} テーマ${JSON.stringify(themes)}`);
  if (bad) failed += bad;
  if (maxMs > 3000) { console.log(`  NG: ${diff} の生成が遅すぎる (${maxMs}ms)`); failed++; }
}
console.log(failed ? `\n❌ ${failed}件の問題` : '\n✅ すべてのステージがクリア可能');
process.exit(failed ? 1 : 0);
