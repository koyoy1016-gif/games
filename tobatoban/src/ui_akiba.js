/* =====================================================================
   ui_akiba.js — 秋葉原編の画面表示
   ・上の体力：星・中（太いバー）／オガ・カエ（細いバー）の2×2。倒れた双子は「復活まで○秒」
   ・双子の15秒の残り時間、図形の必殺の名前、相方を守る・復活などのお知らせ
   ・ミニマップ（ホーム：縦長／広場：28m四方）
   ===================================================================== */
const AK_WHO = ['hoshi', 'naka', 'oga', 'kae'];
const AK_NM = { hoshi: '星', naka: '中', oga: 'オガ', kae: 'カエ' };
const AK_COL = { hoshi: '#f2c94c', naka: '#9ad0ff', oga: '#ff7a5a', kae: '#6ad8a8' };
function akibaGridInit() {
  const g = $('#akGrid'); if (g.childElementCount) return;
  for (const w of AK_WHO) {
    const d = el('div', 'ak' + (w === 'oga' || w === 'kae' ? ' thin' : '')); d.id = 'ak_' + w;
    const nm = el('div', 'nm'); nm.appendChild(el('span', 'n', AK_NM[w])); nm.appendChild(el('span', 's', '')); d.appendChild(nm);
    const bar = el('div', 'hpbar'); const f = el('i', 'fill'); f.style.background = AK_COL[w]; bar.appendChild(f); d.appendChild(bar);
    g.appendChild(d);
  }
}
/** 毎フレーム：体力2×2と双子の残り時間 */
function akibaHud(v) {
  const box = $('#bossbox'), on = v.stageId && v.stageId.startsWith('akiba');
  box.classList.toggle('akiba', !!on);
  const tm = $('#timer');
  if (!on) { $('#akTwin').hidden = true; if (tm.style.marginTop) tm.style.marginTop = ''; return; }
  akibaGridInit();
  const X = v.X || {}, plaza = v.stageId === 'akiba_plaza';
  box.hidden = v.stage === 'intro' && !plaza;
  for (const w of AK_WHO) {
    const d = $('#ak_' + w), m = v.mobs.find(o => o.akiba && o.kind === w);
    d.hidden = !m || (!plaza && (w === 'hoshi' || w === 'naka'));
    if (!m) continue;
    const hp = Math.round(m.hpR * (m.maxHp || 0)), down = m.down || (m.dying ? 1 : 0);
    setBar(d.querySelector('.fill'), m.hpR);
    let s = down ? '' : hp.toLocaleString();
    if (down) {
      if (plaza && X.twinDown === w && X.twinT > 0) s = `復活まで${X.twinT.toFixed(1)}秒`;
      else if (w === 'oga' || w === 'kae') s = plaza && v.stage === 'intro' ? '起こされる…' : '退場';
      else s = 'ダウン';
    } else if (m.buff) s += '・守り↑';
    d.querySelector('.s').textContent = s;
    d.classList.toggle('down', !!down);
    d.classList.toggle('thin', w === 'oga' || w === 'kae');
  }
  // 双子：片方が倒れてからの15秒
  const tw = $('#akTwin'), twOn = plaza && X.twinDown && X.twinT > 0 && v.stage === 'boss';
  tw.hidden = !twOn;
  if (twOn) { const other = X.twinDown === 'hoshi' ? 'naka' : 'hoshi'; tw.textContent = `${AK_NM[X.twinDown]}が倒れた！ ${X.twinT.toFixed(1)}秒以内に${AK_NM[other]}も倒せ`; tw.classList.toggle('hurry', X.twinT < 5); }
  $('#bossSt').textContent = '';
  // 時計は体力表の下へずらす（重ならない）
  const over = box.hidden ? 0 : Math.max(0, box.offsetTop + box.offsetHeight + 4 - tm.offsetTop + (parseFloat(tm.style.marginTop) || 0));
  tm.style.marginTop = over ? over + 'px' : '';
}
/** 秋葉原の出来事のお知らせ（onEvent の続き） */
function akibaEvent(e, v) {
  const N = w => AK_NM[w] || w;
  switch (e.type) {
    case 'twinDown': banner(`${N(e.who)}が倒れた！`, `15秒以内に${N(e.other)}も倒せ（間に合わないと${N(e.who)}がHP7,500で復活）`, 2200); break;
    case 'twinRevive': notice(`${N(e.who)}が復活した（HP7,500）。もう一度、2人を15秒以内に`, 'warn', 2600); break;
    case 'akDown': if (e.who === 'oga' || e.who === 'kae') notice(`${N(e.who)}を倒した！${v.stageId === 'akiba_plaza' ? '（もう起きない）' : ''}`, 'sp', 1600); break;
    case 'akRevive': notice(`星と中が光の糸で${N(e.who)}を起こした（HP7,500）`, 'boss', 2200); break;
    case 'akGuard': notice(`${N(e.who)}が相方を守る！ ようりょく↑（6秒）`, 'boss', 1800); break;
    case 'geo': {
      const whos = (e.whos || []).map(N).join('・'), nm = e.nm || (e.n === 2 ? '二点結び' : e.n === 3 ? '三角結界' : '四角結界');
      const how = { line: '光の線から横へ離れろ！', wave: '輪のすき間を通るか、輪の内側・外側へ！', tri: '三角の外か、青緑の安全地帯へ！', quad: '青緑の安全地帯（盾マーク）へ入れ！', net: '網の線を避けて、辺のまん中のすき間へ！' }[e.v] || (e.n === 3 ? '三角の外へ出ろ！' : '火床から出ろ！');
      enemySp(whos, nm); notice(how, 'warn', 2400); break; // v7 P6：連携の大技は中央に名前、逃げ方は小さく
    }
    case 'akMove': { const M = DATA.AKIBA.moves[e.mv]; if (M && ENEMY_SP[e.mv]) enemySp(N(e.who), M.nm); break; } // v7 P6：大技は中央に名前
    case 'geoCancel': notice('図形の必殺が途切れた（結ぶ相手が倒れた）', 'sp', 1500); break;
    case 'akMark': if (e.slot === G.my) notice('足もとに印！ その場から離れよう', 'warn', 1200); break;
    case 'akHeld': notice(e.slot === G.my ? '歌の中に取り込まれた！（約1秒で出られる）' : `P${e.slot + 1} ${(DATA.CHI[(v.allies[e.slot] || {}).ch] || {}).nm || ''}がナカの歌に取り込まれた`, 'warn', 1300); break; // v8
    case 'sealed': if (e.slot === G.my) notice('Xは封じられている（もう少しで戻る）', 'info', 700); break;
    case 'akFree': if (e.slot === G.my) notice('歌の中から出た（少しのあいだ無敵）', 'sp', 1000); break;
    case 'akSeal': if (e.slot === G.my) notice('星うばい！ 攻撃のXが約2秒使えない', 'warn', 1400); break;
    case 'akFmark': if (e.slot === G.my && e.n > 0) notice(`花冠のしるし：あと${e.n}回、足もとの少し前に花が咲く。動き続けよう`, 'warn', 1200); break;
    case 'akCrash': notice(`${N(e.who)}がマイクスタンドに激突！ 約2秒のチャンス`, 'sp', 1800); break;
    case 'akTired': notice(`${N(e.who)}が疲れて止まった！ 約2秒のチャンス`, 'sp', 1800); break;
    case 'akRush': notice(`${N(e.who)}が大暴走！ しばらく素早くなる`, 'warn', 1600); break;
    case 'akWarp': notice(`${N(e.who)}がワープ！ 光の輪のまん中か外へ`, 'warn', 1400); break;
  }
}
/** ミニマップ：ホーム（18m×26m）／広場（28m四方）。上が奥 */
function drawAkibaMap(v, g, W, H) {
  const D = DATA.AKIBA, plaza = v.stageId === 'akiba_plaza';
  const hx = plaza ? D.plaza.half : D.platform.halfX, z0 = plaza ? -D.plaza.half : 0, z1 = plaza ? D.plaza.half : D.platform.zMax;
  const sc = Math.min(W / (hx * 2 + 2), H / (z1 - z0 + 2)), cz = (z0 + z1) / 2;
  const P = (x, z) => [W / 2 - x * sc, H / 2 - (z - cz) * sc];
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
  const [a1, b1] = P(hx, z1), [a2, b2] = P(-hx, z0); g.fillStyle = plaza ? '#6a6676' : '#8a8680'; g.fillRect(Math.min(a1, a2), Math.min(b1, b2), Math.abs(a2 - a1), Math.abs(b2 - b1));
  if (!plaza) { const [tx] = P(D.platform.halfX, 0); g.fillStyle = '#f2c94c'; g.fillRect(tx - 1, Math.min(b1, b2), 2, Math.abs(b2 - b1)); } // 線路側
  for (const h of v.hz) { if (h.kind !== 'poly' || !h.pts) continue; g.fillStyle = 'rgba(255,90,200,.35)'; g.beginPath(); h.pts.forEach((p, i) => { const [x, z] = P(p[0], p[1]); i ? g.lineTo(x, z) : g.moveTo(x, z); }); g.closePath(); g.fill(); }
  for (const m of v.mobs) { if (!m.akiba) continue; const [x, z] = P(m.x, m.z); g.globalAlpha = m.down ? 0.35 : 1; g.fillStyle = AK_COL[m.kind] || '#ff5a4a'; g.beginPath(); g.arc(x, z, m.kind === 'hoshi' || m.kind === 'naka' ? 6 : 5, 0, 7); g.fill(); g.strokeStyle = '#1a1030'; g.lineWidth = 1.5; g.stroke(); g.globalAlpha = 1; }
  v.allies.forEach((a, i) => { if (a.st === 'gone') return; const [x, z] = P(a.x, a.z); g.fillStyle = i === G.my ? '#fff' : pcol(i); g.beginPath(); g.arc(x, z, i === G.my ? 5 : 4, 0, 7); g.fill(); });
}
