// data.js の登録値から「値・単位・状態」の一覧（VALUES.md）を作る
// 使い方: node tobatoban/tools/dump-values.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ Math, JSON, Object, Array, Number, String });
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'data.js'), 'utf8') + ';globalThis.__=DATA', ctx);
const D = ctx.__;
const counts = {}; for (const r of D.REG) counts[r.status] = (counts[r.status] || 0) + 1;
let md = `# 値・単位・状態の一覧（自動生成）\n\nこのファイルは \`src/data.js\` から \`node tools/dump-values.mjs\` で作っています。直接編集しないでください。\n\nプロファイル: \`${D.PROFILE}\`（\`reference_verified\` は未達。下の「新作の仮値」が残っている間は「原作完全一致」と表示しません）\n\n`;
md += '| 状態 | 件数 |\n|---|---:|\n' + Object.entries(counts).map(([k, v]) => `| ${D.STATUS_LABEL[k]}（${{ doc: 'reference_documented', approx: 'reference_approximate', meas: 'measured', proto: 'prototype', spec: 'spec_v3' }[k]}） | ${v} |`).join('\n') + '\n\n';
let grp = '';
const order = []; for (const r of D.REG) if (!order.includes(r.group)) order.push(r.group);
for (const r of order.flatMap(g0 => D.REG.filter(r => r.group === g0))) {
  if (r.group !== grp) { grp = r.group; md += `\n## ${grp}\n\n| 項目 | 値 | 単位 | 状態 | 注記 |\n|---|---|---|---|---|\n`; }
  const v = r.hidden ? '（非表示の調整値）' : (typeof r.v === 'number' ? String(Math.round(r.v * 1000) / 1000) : typeof r.v === 'object' ? JSON.stringify(r.v).replace(/"/g, '').replace(/\|/g, '／') : String(r.v));
  md += `| ${r.label} | ${v} | ${r.unit} | ${D.STATUS_LABEL[r.status]} | ${r.notes || ''} |\n`;
}
fs.writeFileSync(path.join(root, 'VALUES.md'), md);
console.log('VALUES.md', D.REG.length, 'rows', counts);
