/* =====================================================================
   ui_gacha.js — 通常ガチャ（カプセル販売機）：1枚で1回、C/B/A/S の4段階
   ・押して抽選が成立した時点で「チケット1枚の減算」と「入手キャラ（Lv1・EXP0）」を同じ処理で保存し、そのあと演出
   ・同じ依頼IDの再送では引き直さない。保存できなかったときは取り消して、チケットも減らさない
   ・演出：取っ手が90度回る→球が少し動く→取り出し口へ落ちる→台座へ→ランク別に開く→キャラ登場
   ・指の強さや止める位置で結果は変わらない。スキップは見た目を短くするだけ
   ===================================================================== */
const GC = { r: null, sc: null, cam: null, run: false, ph: 'idle', t: 0, res: null, sample: false, fx: [], last: 0 };
function gcAcc() { return G.acct; }
/** ガチャを開く。閉じる先はいつもタイトル（古い戻り先を残さない） */
function openGacha() {
  G.mode = G.mode === 'play' ? G.mode : 'title';
  show('gacha'); $('#gacha').scrollTop = 0; gcInit(); gcReset(); renderGachaInfo();
  // 前回、演出の途中で閉じた抽選があれば、保存済みの結果をもう一度見せる（引き直さない）
  const pend = STORE.get('gcPending', null), a = gcAcc();
  if (pend && a && pend.id === a.id) { const done = a.gacha.log.find(g => g.req === pend.req && g.id); STORE.set('gcPending', null); if (done) { mtoast('前回の結果を表示します（もう一度は引きません）', 2600); gcPlay(done, false); } }
}
/** 閉じる：描画ループとWebGLを終わらせ、キャンバスを新しくしてタイトルへ（次に開くとき新しく作れるように） */
function closeGacha(to) {
  GC.run = false; GC.ph = 'idle'; GC.busy = false;
  if (GC.r) { try { GC.r.dispose(); if (GC.r.forceContextLoss) GC.r.forceContextLoss(); } catch (e) { } GC.r = null; const old = $('#gcCanvas'), cv = old.cloneNode(false); old.replaceWith(cv); }
  GC.sc = null; GC.cap = null; GC.chr = null; GC.fx = []; GC.tx = null; GC.sparkT = null; GC.w = GC.h = 0;
  show(to || 'title'); updateAcctBar();
}
function renderGachaInfo() {
  const a = gcAcc(), sim = a || G.guest;
  $('#gcTix').textContent = a ? String(a.tickets) : '−';
  const pg = $('#gcProg'); pg.textContent = '';
  for (const [nm, w, per] of [['トバトーバン', sim.wins.tobatoban, 3], ['ヨシノシン', sim.wins.yoshinoshin, 2]]) {
    const d = el('div', 'pg'); d.append(el('span', '', nm)); const pp = el('span', 'pips'); for (let i = 0; i < per; i++) pp.appendChild(el('i', i < w % per ? 'on' : '')); d.append(pp, el('span', 'small', `${w % per}/${per}勝で1枚`)); pg.appendChild(d);
  }
  const pool = SAVE.gachaPool(a || G.guest).length, done = pool === 0;
  $('#gcNote').textContent = (a ? '' : 'ログインすると、チケットを使って引けます（いまは説明と演出見本だけ）。') + `トバトーバン3勝・ヨシノシン2勝ごとにチケット1枚。チケットは貯められます。まだ持っていない仲間から1体が出ます（未入手 ${pool} / 40体）。`;
  const dr = $('#btnGcDraw'); dr.hidden = done; dr.textContent = !a ? 'ログインして引く' : '1回まわす（1枚）'; dr.disabled = !!a && (a.tickets < 1 || GC.busy);
  const ex = $('#gcEx'); ex.hidden = !(done && a); ex.textContent = '';
  if (done && a) { // 全40体を入手したら、1枚を選んだキャラのEXP10,000と交換
    ex.appendChild(el('b', '', '全40体を入手済みです')); ex.appendChild(el('span', '', 'チケット1枚を、選んだ1体のEXP 10,000と交換できます（協力・AIの倍率は付きません）。'));
    const sel = el('select'); for (const c of DATA.CHARS) if (a.chars[c.id]) { const o = el('option', '', `${c.nm}（Lv${a.chars[c.id].lv}）`); o.value = c.id; sel.appendChild(o); } ex.appendChild(sel);
    const b = el('button', 'btn gold', '1枚と交換する'); b.type = 'button'; b.disabled = a.tickets < 1; b.onclick = async () => { const req = 'x' + Date.now().toString(36); const r = SAVE.gachaExchange(a, sel.value, req); if (!r.ok) { mtoast(r.msg); return; } const ok = await persist(); mtoast(ok ? `${DATA.CHI[sel.value].nm}に EXP 10,000（Lv${r.res.lv0}→${r.res.lv1}）` : '保存できませんでした。「セーブ」を押してください', 3000); renderGachaInfo(); }; ex.appendChild(b);
  }
}
/* ---------- 3D：販売機・カプセル ---------- */
function gcInit() {
  if (GC.r) { GC.run = true; return; }
  const cv = $('#gcCanvas');
  try { GC.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); } catch (e) { console.warn('gacha gl', e); return; }
  GC.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); GC.r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = GC.sc = new THREE.Scene(); sc.background = new THREE.Color(0x241c3a);
  sc.add(new THREE.HemisphereLight(0xfff4e8, 0x40305a, 1.5)); const dl = new THREE.DirectionalLight(0xffffff, 1.3); dl.position.set(2, 5, 4); sc.add(dl);
  GC.cam = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 60);
  const L = (c, o) => GFX.lam(c, o), { S, B, C, G: GG } = GFX.parts;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 40), L(0x3a2e52)); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  // 販売機
  const m = GC.m = GG(sc, 0, 0, -0.6);
  B(m, 1.5, 1.2, 1.1, 0xd23a3a, 0, 0.6, 0); B(m, 1.56, 0.1, 1.16, 0xf2c94c, 0, 1.22, 0);
  const sign = GFX.tex(256, 64, (g, w, h) => { g.fillStyle = '#1b1838'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2c94c'; g.font = `bold 34px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('もののけカプセル', w / 2, h / 2 + 2); });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), GFX.bas(0xffffff, { map: sign })); sp.position.set(0, 0.98, 0.56); m.add(sp);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false })); glass.position.y = 1.95; m.add(glass);
  C(m, 0.4, 0.5, 0.12, 0xf2c94c, 0, 1.32, 0, null, 24); S(m, 0.12, 0xf2c94c, 0, 2.68, 0);
  GC.balls = []; const cols = [0x3fae5a, 0x2f6fd0, 0xb03a7a, 0xe0b020];
  for (let i = 0; i < 26; i++) { const a = i * 2.39, r = 0.25 + (i % 5) * 0.08, y = 1.55 + (i % 7) * 0.08; const b = S(m, 0.11, cols[i % 4], Math.cos(a) * r, y, Math.sin(a) * r * 0.8); GC.balls.push({ m: b, y0: y, ph: i }); }
  // 取っ手（正面）と取り出し口
  const hd = GC.handle = GG(m, 0.35, 0.62, 0.58); C(hd, 0.13, 0.13, 0.06, 0xe8e0d0, 0, 0, 0).rotation.x = Math.PI / 2; B(hd, 0.36, 0.07, 0.07, 0x3a3a3a, 0, 0, 0.05);
  B(m, 0.42, 0.3, 0.06, 0x1a1428, -0.3, 0.3, 0.56); // 取り出し口
  B(m, 0.9, 0.06, 0.5, 0xb02a2a, -0.3, 0.06, 0.8); // 受け皿
  // 台座
  const ped = C(sc, 0.5, 0.6, 0.18, 0x5a4a7a, 0, 0.09, 1.25, null, 28); GC.ped = ped;
  GC.ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 40), GFX.bas(0x6ab0ff, { transparent: true, opacity: 0 })); GC.ring.rotation.x = Math.PI / 2; GC.ring.position.set(0, 0.35, 1.25); sc.add(GC.ring);
  GC.run = true; GC.last = performance.now(); requestAnimationFrame(gcLoop);
}
function gcSize() { const cv = $('#gcCanvas'), w = cv.clientWidth || 640, h = cv.clientHeight || 480; if (GC.r && (GC.w !== w || GC.h !== h)) { GC.w = w; GC.h = h; GC.r.setSize(w, h, false); GC.cam.aspect = w / h; GC.cam.updateProjectionMatrix(); } }
/** ランクの模様（C葉・B菱形・A星・S王冠）と文字 */
function capsuleTex(rk) {
  GC.tx = GC.tx || {}; if (GC.tx[rk]) return GC.tx[rk];
  const col = '#' + DATA.GACHA.col[rk].toString(16).padStart(6, '0');
  return (GC.tx[rk] = GFX.tex(256, 128, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.28)'; // 文字・王冠は印字しない（色だけ）
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(16 + i * 32, 64 + (i % 2 ? 22 : -22), 9, 0, 7); g.fill(); }
  }));
}
function makeCapsule(rk) {
  const g = new THREE.Group(), gold = rk === 'S';
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold ? new THREE.MeshStandardMaterial({ map: capsuleTex(rk), metalness: 0.85, roughness: 0.25, emissive: 0x3a2a00 }) : GFX.lam(0xffffff, { map: capsuleTex(rk) }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), GFX.lam(0xf6f2ea));
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 6, 32), GFX.bas(0xffffff, { transparent: true, opacity: 0.4 })); seam.rotation.x = Math.PI / 2;
  const tg = new THREE.Group(), bg = new THREE.Group(); tg.add(top); bg.add(bot); g.add(tg, bg, seam);
  return { g, tg, bg, seam, rk };
}
function gcReset() {
  if (!GC.sc) return;
  for (const f of GC.fx) GC.sc.remove(f.m); GC.fx = [];
  if (GC.cap) GC.sc.remove(GC.cap.g); GC.cap = null; if (GC.chr) { GC.sc.remove(GC.chr.root); GC.sc.remove(GC.chr.shadow); GC.chr = null; }
  GC.ph = 'idle'; GC.t = 0; GC.res = null; GC.handle && (GC.handle.rotation.z = 0); GC.ring.material.opacity = 0; GC.sc.background.set(0x241c3a);
  $('#gcRes').hidden = true; $('#gcSkip').hidden = true; $('#gcAfter').hidden = true; $('#gcBtns').hidden = false;
}
/** 演出を始める（res＝保存済みの結果。sample＝見本：報酬なし） */
function gcPlay(res, sample) {
  if (!GC.sc) { gcShowResult(res, sample); return; }
  gcReset(); GC.res = res; GC.sample = sample; GC.ph = 'turn'; GC.t = 0; $('#gcSkip').hidden = false; $('#gcBtns').hidden = true;
  AUDIO.sfx('gHandle');
}
const SPARK_T = () => GC.sparkT || (GC.sparkT = GFX.tex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 10 : 30; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); }));
function spark(x, y, z, col, vx, vy, vz, life, s) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPARK_T(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); m.position.set(x, y, z); m.scale.setScalar(s || 0.12); GC.sc.add(m); GC.fx.push({ m, vx, vy, vz, life, t: 0, s: s || 0.12, kind: 'sp' }); }
function confetti(x, y, z) { const cols = [0xff5a5a, 0xffd04a, 0x5ad0ff, 0x8aff7a, 0xff8ad8]; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.08), GFX.bas(cols[(Math.random() * 5) | 0], { side: THREE.DoubleSide })); m.position.set(x, y, z); GC.sc.add(m); GC.fx.push({ m, vx: (Math.random() - 0.5) * 1.6, vy: 1 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.6, life: 2.4, t: 0, kind: 'cf', rs: Math.random() * 8 }); }
function ray(col, ang, len) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len), GFX.bas(col, { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(0, 0.5, 1.0); m.rotation.z = ang; m.geometry.translate(0, len / 2, 0); GC.sc.add(m); GC.fx.push({ m, life: 1.6, t: 0, kind: 'ray' }); }
function gcLoop(ts) {
  if (!GC.run || !GC.r) return;
  const dt = Math.min(0.05, (ts - GC.last) / 1000 || 0.016); GC.last = ts; gcSize();
  const T = ts / 1000, cam = GC.cam, P = GC.ped.position;
  // 待機中の球の小さな揺れ
  const jig = GC.ph === 'turn' || GC.ph === 'roll' ? 1 : 0.15;
  for (const b of GC.balls) { b.m.position.y = b.y0 + Math.sin(T * (jig ? 14 : 1.5) + b.ph) * 0.02 * (jig ? 2 : 1); }
  GC.t += dt; const t = GC.t, rk = GC.res && (GC.res.rank || GC.res.rk);
  let camPos = [0, 1.9, 4.6], look = [0, 1.15, 0];
  if (GC.ph === 'turn') { GC.handle.rotation.z = -Math.min(1, t / 0.55) * Math.PI / 2; if (t >= 0.6) { GC.ph = 'roll'; GC.t = 0; AUDIO.sfx('gRoll'); } }
  else if (GC.ph === 'roll') { if (t >= 0.5) { GC.ph = 'drop'; GC.t = 0; GC.cap = makeCapsule(rk); GC.sc.add(GC.cap.g); AUDIO.sfx('gDrop'); } }
  else if (GC.ph === 'drop') { // 取り出し口→受け皿→台座の中央へ
    const c = GC.cap.g, k = Math.min(1, t / 1.1);
    if (k < 0.35) { const q = k / 0.35; c.position.set(-0.3, 0.3 - q * 0.08, -0.6 + 0.62 + q * 0.4); }
    else { const q = (k - 0.35) / 0.65; c.position.set(-0.3 + 0.3 * q, 0.25 + Math.sin(q * Math.PI) * 0.45 + q * 0.2, 0.42 + q * 0.83); c.rotation.x = q * 6; }
    const e = k * k * (3 - 2 * k); camPos = [0, 1.9 - e * 0.7, 4.6 - e * 1.6]; look = [0, 1.15 - e * 0.65, e * 1.2];
    if (k >= 1) { c.position.set(P.x, 0.48, P.z); c.rotation.set(0, 0, 0); GC.ph = 'open'; GC.t = 0; }
  } else if (GC.ph === 'open' || GC.ph === 'show') { camPos = [0, 1.2, 3.0]; look = [0, 0.5, 1.2]; }
  if (GC.ph === 'open') gcOpenAnim(rk, t, dt);
  if (GC.ph === 'show' && GC.chr) { GC.chr.root.rotation.y = Math.sin(T * 0.8) * 0.35; GFX.animChar(GC.chr, { x: P.x, z: P.z + 0.05, yaw: Math.sin(T * 0.8) * 0.35, st: 'ok', act: t < 0.6 ? 'release' : '', actT: t, slot: 0, moving: false }, T, dt, {}); GC.chr.root.position.y = 0.18; GC.chr.shadow.position.y = 0.19; }
  // 演出の粒
  for (const f of GC.fx) {
    f.t += dt; const k = f.t / f.life;
    if (f.kind === 'sp') { f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt; f.vy -= 0.6 * dt; f.m.material.opacity = Math.max(0, 1 - k); f.m.scale.setScalar(f.s * (1 + k)); }
    else if (f.kind === 'cf') { f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt; f.vy -= 2.2 * dt; f.m.rotation.set(T * f.rs, T * f.rs * 0.7, 0); }
    else if (f.kind === 'ray') { f.m.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.55; f.m.scale.y = 0.3 + k * 1.2; }
    else if (f.kind === 'rib') { const a = f.a0 + f.t * 3.2, r = 0.3 + f.t * 0.7; f.m.position.set(P.x + Math.cos(a) * r, 0.5 + f.t * 0.7, P.z + Math.sin(a) * r); f.m.rotation.set(0, -a, f.t * 2); f.m.material.opacity = Math.max(0, 1 - k); }
  }
  GC.fx = GC.fx.filter(f => { if (f.t >= f.life) { GC.sc.remove(f.m); return false; } return true; });
  cam.position.set(...camPos); cam.lookAt(...look);
  GC.r.render(GC.sc, cam);
  requestAnimationFrame(gcLoop);
}
/** ランク別の開封（色だけでなく文字と模様も一致。低ランクを金色に見せる偽の演出はしない） */
function gcOpenAnim(rk, t, dt) {
  const C = GC.cap, g = C.g, P = GC.ped.position, D = DATA.GACHA.anim[rk], col = DATA.GACHA.col[rk];
  const done = () => { GC.ph = 'show'; GC.t = 0; gcShowChar(); };
  if (rk === 'C') { // 小さく1回跳ねて、左右にぱかっと開く・細い葉の光
    if (t < 0.5) g.position.y = 0.48 + Math.sin(t / 0.5 * Math.PI) * 0.22;
    else { if (!C.o) { C.o = 1; AUDIO.sfx('gOpenC'); for (let i = 0; i < 10; i++) spark(P.x, 0.5, P.z, 0x8aff7a, (Math.random() - 0.5) * 1.4, 0.6 + Math.random(), (Math.random() - 0.5) * 1.4, 0.9, 0.1); } const k = Math.min(1, (t - 0.5) / 0.35); C.tg.position.x = -k * 0.5; C.tg.rotation.z = k * 1.2; C.bg.position.x = k * 0.5; C.bg.rotation.z = -k * 1.2; }
  } else if (rk === 'B') { // 台座で半回転、青い輪が一周、上下に開く・2音
    if (t < 0.7) { g.rotation.y = t / 0.7 * Math.PI; GC.ring.material.opacity = 0.9; GC.ring.scale.setScalar(0.4 + t / 0.7 * 0.8); GC.ring.rotation.z = t * 6; }
    else { if (!C.o) { C.o = 1; AUDIO.sfx('gOpenB'); for (let i = 0; i < 14; i++) spark(P.x, 0.5, P.z, 0x8ac8ff, (Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2, 1.0, 0.09); } const k = Math.min(1, (t - 0.7) / 0.4); C.tg.position.y = k * 0.55; C.bg.position.y = -k * 0.1; GC.ring.material.opacity = Math.max(0, 0.9 - k); }
  } else if (rk === 'A') { // 2回振動→継ぎ目が光る→光のリボン・背景を少し暗く・星形の光
    GC.sc.background.lerp(new THREE.Color(0x120c22), Math.min(1, dt * 3));
    if (t < 0.9) { g.position.x = P.x + (t < 0.3 || (t > 0.45 && t < 0.75) ? Math.sin(t * 70) * 0.04 : 0); C.seam.material.opacity = 0.4 + t; C.seam.material.color.set(0xff8ad8); }
    else { if (!C.o) { C.o = 1; AUDIO.sfx('gOpenA'); for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.5), GFX.bas(i % 2 ? 0xff7ad0 : 0xffd0f0, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); GC.sc.add(m); GC.fx.push({ m, kind: 'rib', a0: i * Math.PI / 3, life: 1.3, t: 0 }); } for (let i = 0; i < 16; i++) spark(P.x, 0.6, P.z, 0xffa0e8, Math.cos(i) * 1.6, Math.sin(i * 1.7) * 1.2 + 0.6, Math.sin(i) * 1.0, 1.2, 0.18); } const k = Math.min(1, (t - 0.9) / 0.4); C.tg.position.y = k * 0.6; C.tg.rotation.x = -k * 1.2; }
  } else { // S：金属光沢の球に星紋→0.4秒の間→金の扇状の光とともに開く・紙吹雪・和太鼓＋鐘
    GC.sc.background.lerp(new THREE.Color(0x0c0818), Math.min(1, dt * 2));
    if (t < 0.9) { g.rotation.y = t * 2.4; C.tg.children[0].material.emissiveIntensity = 0.3 + t; }
    else if (t < 1.3) { /* 0.4秒の間 */ }
    else { if (!C.o) { C.o = 1; AUDIO.sfx('gOpenS'); for (let i = 0; i < 12; i++) ray(0xffd04a, (i - 5.5) * 0.18, 2.4); for (let i = 0; i < 60; i++) confetti(P.x + (Math.random() - 0.5) * 1.6, 2.2 + Math.random(), P.z + (Math.random() - 0.5)); for (let i = 0; i < 18; i++) spark(P.x, 0.6, P.z, 0xffe070, Math.cos(i) * 1.8, 1 + Math.random(), Math.sin(i) * 1.2, 1.4, 0.2); } const k = Math.min(1, (t - 1.3) / 0.45); C.tg.position.y = k * 0.7; C.tg.rotation.x = -k * 1.4; C.bg.position.y = -k * 0.05; }
  }
  if (t >= D) done();
}
function gcShowChar() {
  const res = GC.res, id = res.id, c = DATA.CHI[id];
  if (GC.cap) { GC.sc.remove(GC.cap.g); GC.cap = null; }
  try { const m = GFX.makeChar(c); m.root.scale.multiplyScalar(0.85); GC.sc.add(m.root); GC.sc.add(m.shadow); GC.chr = m; } catch (e) { console.warn(e); }
  gcShowResult(res, GC.sample);
}
function gcShowResult(res, sample) {
  const c = DATA.CHI[res.id], box = $('#gcRes'); box.textContent = ''; box.hidden = false; $('#gcSkip').hidden = true;
  const hd = el('div', 'hd'); hd.append(rankBadge(c.rank, 'dt-rk'), el('b', '', c.nm), el('span', 'chip', DATA.ROLES[c.roleId].ic + ' ' + DATA.ROLES[c.roleId].label), el('span', 'small', 'Lv1')); if (!sample) hd.appendChild(el('span', 'tix', 'NEW')); box.appendChild(hd);
  box.appendChild(el('span', 'small', `得意：${(c.tags || []).join('・')}　${c.form}`));
  if (sample) box.appendChild(el('span', 'small', '演出見本です（入手・チケットの消費はありません）'));
  G.gcLast = sample ? null : res.id;
  $('#gcAfter').hidden = false; $('#btnGcTeam').hidden = !!sample; $('#btnGcLook').hidden = !!sample;
  const a = gcAcc(); $('#btnGcAgain').hidden = !a || a.tickets < 1 || SAVE.gachaPool(a).length === 0;
  $('#gcBtns').hidden = false; renderGachaInfo();
}
async function gcDraw() {
  const a = gcAcc();
  if (!a) { AUDIO.sfx('ui'); closeGacha('login'); openLogin('title', 'ログインすると、チケットを使ってガチャを引けます'); G.afterLoginTarget = 'gacha'; return; } // 一回限りの予約
  if (GC.busy) return;
  if (a.tickets < 1) { mtoast('チケットがありません（トバトーバン3勝・ヨシノシン2勝ごとに1枚）', 2600); return; }
  GC.busy = true; $('#btnGcDraw').disabled = true;
  const req = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  STORE.set('gcPending', { id: a.id, req });
  const r = SAVE.gachaDraw(a, req); // チケット1枚の減算と入手（Lv1・EXP0）を同じ処理で
  if (!r.ok) { GC.busy = false; STORE.set('gcPending', null); mtoast(r.msg); renderGachaInfo(); return; }
  if (cloud()) mtoast('結果を保存しています…', 6000);
  const ok = await persist();
  if (!ok) { // 保存できなかった：取り消して、チケットも減らさない（勝手に消費しない）
    delete a.chars[r.res.id]; a.tickets += 1; a.gacha.log = a.gacha.log.filter(g => g.req !== req); STORE.set('gcPending', null);
    GC.busy = false; mtoast('保存できなかったので取り消しました（チケットは減っていません）。電波のよい所でもう一度', 3600); renderGachaInfo(); return;
  }
  mtoast('', 1); GC.busy = false; updateAcctBar();
  gcPlay(r.res, false);
  STORE.set('gcPending', null);
}
function gcSample() { const ks = ['C', 'B', 'A', 'S'], rk = ks[(Math.random() * 4) | 0], ids = DATA.GACHA_IDS.filter(id => DATA.CHI[id].rank === rk); gcPlay({ id: ids[(Math.random() * ids.length) | 0], rank: rk }, true); }
function bindGacha() {
  $('#btnGcDraw').onclick = () => gcDraw();
  $('#btnGcAgain').onclick = () => { gcReset(); gcDraw(); };
  $('#btnGcSample').onclick = () => { AUDIO.sfx('ui'); gcSample(); };
  $('#gcSkip').onclick = () => { if (GC.ph === 'show' || GC.ph === 'idle') return; if (GC.cap) { GC.sc.remove(GC.cap.g); GC.cap = null; } GC.ph = 'show'; GC.t = 0; gcShowChar(); }; // 見た目だけ短く（結果・消費は変わらない）
  $('#btnGcBack').onclick = () => { AUDIO.sfx('back'); closeGacha(); };
  $('#btnGcTeam').onclick = () => { AUDIO.sfx('ok'); const id = G.gcLast; closeGacha(); G.selSlot = 0; G.focus = id; openTeam('title'); };
  $('#btnGcLook').onclick = () => { AUDIO.sfx('ok'); const id = G.gcLast; closeGacha(); G.focus = id; openZukan('title'); };
}
bindGacha();
