/* =====================================================================
   render_v7.js — 60体の立体モデル（v7 確定仕様：伝承・古典の題材を本作の姿で）
   ・data/spec-v7-roster.txt の「見た目」「頭身・造形」の文から、形・配色・持ち物を作る
   ・人型は頭身、非人型は全長・幅の比率で組む。体の高さはおよそ1の単位で作り、c.h で拡大する
   ・四足・蛇・百足・蜘蛛・道具・火・煙などは、それぞれの形のまま動かす（m.extra.anim）
   ・攻撃の動きは共通の骨格（armL/armR＝打つ部位）に乗せる。手がないものは本体や部品で打つ
   ===================================================================== */
(() => {
  const { S, B, C, K, CAP, G } = GFX.parts;
  const L = (c, o) => GFX.lam(c, o), E = (c, k) => L(c, { emissive: c, emissiveIntensity: k == null ? 0.8 : k });
  const TR = (c, o) => L(c, Object.assign({ transparent: true, opacity: 0.55, depthWrite: false }, o || {}));
  const TOR = (p, r, tube, c, x, y, z, rx, arc) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 22, arc || Math.PI * 2), c.isMaterial ? c : L(c)); m.position.set(x, y, z); m.rotation.x = rx || 0; p.add(m); return m; };
  const PL = (p, w, h, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), c.isMaterial ? c : L(c, Object.assign({ side: THREE.DoubleSide }, o || {}))); m.position.set(x, y, z); p.add(m); return m; };
  const OCT = (p, r, c, x, y, z) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(r), c.isMaterial ? c : L(c)); m.position.set(x, y, z); p.add(m); return m; };
  const DOD = (p, r, c, x, y, z) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r), c.isMaterial ? c : L(c)); m.position.set(x, y, z); p.add(m); return m; };
  const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const V7 = GFX.V7 = {};
  const def = (id, h, dims, build) => { V7[id] = { h, dims, build }; };
  const dot = (p, r, x, y, z, c) => S(p, r, c || 0x111014, x, y, z);
  const glowEye = (p, r, x, y, z, c) => S(p, r, E(c || 0xffd27a, 1.2), x, y, z);
  // 腕（打つ部位）：肩から下へ伸びる円柱＋先端。apply() が armL/armR を回すので攻撃の振りになる
  const arm = (g, len, r, col, tip, tipCol) => { CAP(g, r, Math.max(0.01, len - r * 2), col, 0, -len / 2, 0); if (tip) S(g, tip, tipCol == null ? col : tipCol, 0, -len, 0); };
  const leg = (g, len, r, col, foot, footCol) => { CAP(g, r, Math.max(0.01, len - r * 2), col, 0, -len / 2, 0); if (foot) B(g, foot[0], foot[1], foot[2], footCol == null ? col : footCol, 0, -len + foot[1] / 2, foot[2] * 0.2); };
  const spots = (p, n, r, col, sx, sy, sz, y0, seed) => { let s = seed || 1; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, b = rnd() * 0.9; S(p, r * (0.6 + rnd() * 0.6), col, Math.cos(a) * sx * b, y0 + sy * (0.3 + rnd() * 0.4), Math.sin(a) * sz * b, 1, 0.35, 1); } };

  /* ---------- 骨格の寸法 ---------- */
  const HUM = hr => { const R = 0.5 / hr, top = 1 - 2 * R, legH = top * 0.42; return { legH, headY: 1 - R, shX: 0.1 + R * 0.6, shY: top - 0.03, hipX: 0.06, R, T: top - legH }; };
  const FLOAT = (y) => ({ legH: y, headY: y + 0.4, shX: 0.22, shY: y + 0.25, hipX: 0.06, R: 0.15, T: 0.3 });
  const QUAD = (legLen, bh) => ({ legH: legLen + bh * 0.3, headY: legLen + bh, shX: 0.2, shY: legLen + bh * 0.4, hipX: 0.06, R: 0.15, T: bh, legLen, bh });

  /* ---------- 人型：頭身 hr から胴・脚・腕・頭を作る ---------- */
  function hum(m, d, o) {
    const R = d.R, T = d.T, skin = o.skin, cloth = o.cloth || skin;
    // 胴
    if (o.robe) { const rb = K(m.torso, o.robeW || T * 0.55, T + d.legH * (o.robeLong || 0.85), cloth, 0, (T - d.legH * (o.robeLong || 0.85)) / 2, 0); rb.material = L(cloth); m.extra.robe = rb; }
    else CAP(m.torso, (o.chest || 0.11), Math.max(0.01, T - (o.chest || 0.11) * 1.6), cloth, 0, T * 0.5, 0);
    if (o.belt) C(m.torso, (o.chest || 0.11) * 1.04, (o.chest || 0.11) * 1.04, 0.035, o.belt, 0, T * 0.12, 0, null, 14);
    // 頭
    const hs = o.headScale || [1, 1, 1];
    const hd = (o.headBox ? B(m.head, R * 1.8 * hs[0], R * 2 * hs[1], R * 1.7 * hs[2], o.headCol || skin, 0, 0, 0) : S(m.head, R, o.headCol || skin, 0, 0, 0, hs[0], hs[1], hs[2]));
    if (o.hair === 'long') { S(m.head, R * 1.04, o.hairCol, 0, R * 0.12, -R * 0.12, 1, 0.95, 1); B(m.head, R * 1.6, R * 2.6, R * 0.5, o.hairCol, 0, -R * 1.2, -R * 0.6); }
    else if (o.hair === 'short') S(m.head, R * 1.03, o.hairCol, 0, R * 0.25, -R * 0.1, 1, 0.75, 0.95);
    else if (o.hair === 'bob') { S(m.head, R * 1.06, o.hairCol, 0, R * 0.15, -R * 0.08, 1.05, 0.95, 1); B(m.head, R * 1.4, R * 0.35, R * 0.4, o.hairCol, 0, R * 0.55, R * 0.62); }
    // 腕・脚
    const aLen = o.armLen || T * 0.95, aR = o.armR || 0.045;
    for (const g of [m.armL, m.armR]) arm(g, aLen, aR, o.armCol || o.sleeve || skin, o.hand === 0 ? 0 : (o.hand || aR * 1.25), o.handCol || skin);
    if (!o.noLegs) for (const g of [m.legL, m.legR]) leg(g, d.legH, o.legR || 0.05, o.legCol || cloth, o.foot === 0 ? null : (o.foot || [0.09, 0.04, 0.13]), o.footCol);
    return hd;
  }
  /* ---------- 四足：胴・頭・4本脚・尾（歩くと対角の脚が動く。A は前脚で打ち、頭が前へ出る） ---------- */
  function quad(m, d, o) {
    const len = o.len || 0.7, bw = o.bw || 0.32, bh = d.bh, col = o.col;
    const bodyM = S(m.body, 0.5, col, 0, 0, 0, bw, bh, len);
    if (o.belly) S(m.body, 0.48, o.belly, 0, -bh * 0.18, 0, bw * 0.8, bh * 0.7, len * 0.9);
    const hd = G(m.body, 0, o.neckY == null ? bh * 0.55 : o.neckY, len * 0.5 + (o.headR || 0.14) * 0.6); m.extra.qhead = hd; m.extra.qhead0 = hd.position.clone();
    const hr = o.headR || 0.14;
    S(hd, hr, o.headCol || col, 0, 0, 0, o.headSx || 1, o.headSy || 0.95, o.headSz || 1.05);
    if (o.snout) S(hd, hr * 0.55, o.snoutCol || o.headCol || col, 0, -hr * 0.25, hr * (0.75 + o.snout * 0.35), 0.85, 0.7, 1 + o.snout);
    const ears = o.ears || 'pt';
    for (const s of [-1, 1]) {
      if (ears === 'pt') { const e = K(hd, hr * 0.35, hr * 0.8, o.earCol || o.headCol || col, s * hr * 0.55, hr * 0.85, -hr * 0.1); e.rotation.z = -s * 0.2; }
      else if (ears === 'half') S(hd, hr * 0.28, o.earCol || col, s * hr * 0.6, hr * 0.75, -hr * 0.1, 1, 0.6, 0.4);
      else if (ears === 'flop') { const e = S(hd, hr * 0.32, o.earCol || col, s * hr * 0.85, hr * 0.15, 0, 0.5, 1.5, 0.9); e.rotation.z = s * 0.4; }
      else if (ears === 'flat') { const e = B(hd, hr * 0.5, hr * 0.12, hr * 0.35, o.earCol || col, s * hr * 0.85, hr * 0.5, -hr * 0.1); e.rotation.z = s * 0.3; }
    }
    if (o.eyes !== false) for (const s of [-1, 1]) { if (o.eyeGlow) glowEye(hd, hr * 0.13, s * hr * 0.42, hr * 0.15, hr * 0.85, o.eyeGlow); else dot(hd, hr * 0.12, s * hr * 0.42, hr * 0.15, hr * 0.85, o.eyeCol); }
    const legs = [];
    const lR = o.legR || 0.045, lLen = d.legLen + bh * 0.3;
    for (const [fz, s] of [[1, -1], [1, 1], [-1, -1], [-1, 1]]) {
      const g = G(m.body, s * bw * 0.32, -bh * 0.2, fz * len * 0.33); leg(g, lLen, lR * (fz > 0 ? 1 : o.backLeg || 1), o.legCol || col, o.paw ? [o.paw, o.paw * 0.5, o.paw * 1.3] : null, o.pawCol); legs.push(g);
    }
    m.extra.qlegs = legs;
    const tails = []; const tc = o.tail;
    if (tc) for (let i = 0; i < tc.n; i++) {
      const k = tc.n > 1 ? (i / (tc.n - 1) - 0.5) : 0, g = G(m.body, k * bw * 0.4, bh * 0.15, -len * 0.48); g.rotation.set(-(tc.lift == null ? 0.6 : tc.lift), k * (tc.spread || 1.4), 0);
      if (tc.flat) { const b = B(g, tc.w || 0.06, 0.012, tc.len, tc.col || col, 0, 0, -tc.len / 2); if (tc.tip) B(g, (tc.w || 0.06) * 1.02, 0.014, tc.len * 0.25, tc.tip, 0, 0, -tc.len * 0.88); }
      else if (tc.puff) { S(g, tc.w || 0.08, tc.col || col, 0, 0, -tc.len * 0.6, 1, 1, tc.len / (tc.w || 0.08) * 0.6); }
      else { CAP(g, tc.w || 0.025, tc.len, tc.col || col, 0, 0, -tc.len / 2).rotation.x = Math.PI / 2; if (tc.tip) S(g, (tc.w || 0.025) * 2.2, tc.tip, 0, 0, -tc.len); }
      tails.push(g);
    }
    m.extra.qtails = tails; m.extra.body = bodyM;
    m.extra.anim = quadAnim;
    return hd;
  }
  function quadAnim(m, P, a, T, dt, act, t) {
    const L4 = m.extra.qlegs, ph = m.walkPh || 0, mv = a.moving ? 0.6 : 0;
    const sw = Math.sin(ph) * mv;
    L4[0].rotation.x = sw + P.aLx * 0.5; L4[3].rotation.x = sw; L4[1].rotation.x = -sw + P.aRx * 0.5; L4[2].rotation.x = -sw;
    const hd = m.extra.qhead, h0 = m.extra.qhead0, strike = Math.max(0, -Math.min(P.aRx, P.aLx)) * 0.06;
    hd.position.set(h0.x, h0.y - strike * 0.5, h0.z + strike); hd.rotation.x = strike * 2 - 0.05;
    m.extra.qtails.forEach((g, i) => { g.rotation.y += (Math.sin(T * 3 + i * 0.7 + a.slot) * 0.25 - (g._wy || 0)); g._wy = Math.sin(T * 3 + i * 0.7 + a.slot) * 0.25; });
  }
  /* ---------- 蛇・百足：体を節の列にし、波打たせる。A は頭（と前の節）を突き出す ---------- */
  function serpent(m, o) {
    const n = o.n || 14, segs = [], g = G(m.body, 0, 0, 0);
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), r = (o.r0 || 0.09) * (1 - k * (o.taper == null ? 0.65 : o.taper));
      const sg = G(g, 0, 0, -i * (o.step || 0.13)); const b = S(sg, r, (o.bandCol && i % 2) ? o.bandCol : o.col, 0, r * 0.6, 0, 1, 0.8, 1.25);
      if (o.belly) S(sg, r * 0.95, o.belly, 0, r * 0.3, 0, 0.75, 0.55, 1.2);
      if (o.legs && i > 0 && i < n - 1) for (const s of [-1, 1]) { const lg = CAP(sg, 0.012, o.legs, o.legCol || o.col, s * (r + o.legs * 0.3), r * 0.25, 0); lg.rotation.z = s * 1.1; }
      if (o.glowJoint && i > 0) S(sg, r * 0.55, E(o.glowJoint, 0.8), 0, r * 0.6, (o.step || 0.13) * 0.5);
      segs.push(sg);
    }
    const hd = G(m.body, 0, (o.r0 || 0.09) * 0.9, (o.headR || 0.11) * 0.8); m.extra.shead = hd; m.extra.shead0 = hd.position.clone();
    S(hd, o.headR || 0.11, o.headCol || o.col, 0, 0, 0, 1, 0.75, 1.3);
    m.extra.segs = segs; m.extra.anim = serpentAnim; m.extra.wave = o.wave || 0.12; m.extra.coil = o.coil || 0;
    return hd;
  }
  function serpentAnim(m, P, a, T, dt, act, t) {
    const segs = m.extra.segs, w = m.extra.wave, sp = a.moving ? 7 : 2.2, ph = T * sp;
    segs.forEach((s, i) => { s.position.x = Math.sin(ph - i * 0.55) * w * Math.min(1, i / 3 + 0.3); s.rotation.y = Math.cos(ph - i * 0.55) * 0.3; });
    const hd = m.extra.shead, h0 = m.extra.shead0, strike = Math.max(0, -Math.min(P.aRx, P.aLx)) * 0.09;
    hd.position.set(h0.x + Math.sin(ph) * w * 0.3, h0.y + strike * 0.6, h0.z + strike); hd.rotation.x = -strike * 1.5;
  }
  const bob = (amp, sp) => (m, P, a, T) => { m.body.position.y += Math.sin(T * (sp || 2.2) + a.slot) * amp; };

  /* =============================== 初期10体 =============================== */
  // 地縛霊：割れた敷石＋黒い紙片の渦＋白い細縄の拳。紙の隙間に二つの光
  def('kogemaru', 1.0, () => FLOAT(0.2), (m) => {
    B(m.root, 0.62, 0.12, 0.62, 0x8c8a84, 0, 0.06, 0); for (const [x, z, r] of [[0.05, 0, 0.6], [-0.12, 0.08, -0.4]]) { const c = B(m.root, 0.66, 0.01, 0.015, 0x2a2826, x, 0.125, z); c.rotation.y = r; }
    const vort = G(m.torso, 0, 0, 0); m.extra.vort = vort; const pm = L(0x17151a, { side: THREE.DoubleSide });
    for (let i = 0; i < 26; i++) { const k = i / 26, a = k * Math.PI * 7, r = 0.12 + 0.3 * Math.sin(k * Math.PI), p = PL(vort, 0.11, 0.07, pm, Math.cos(a) * r, 0.05 + k * 0.85, Math.sin(a) * r); p.rotation.set(Math.sin(i) * 0.6, -a, Math.cos(i) * 0.5); }
    for (const s of [-1, 1]) glowEye(m.torso, 0.03, s * 0.08, 0.55, 0.2, 0xd8e4ff);
    for (const g of [m.armL, m.armR]) { C(g, 0.012, 0.012, 0.42, 0xf2f0ea, 0, -0.21, 0); TOR(g, 0.055, 0.022, 0xf2f0ea, 0, -0.44, 0, 0.4); TOR(g, 0.045, 0.02, 0xe8e4da, 0, -0.44, 0, 1.4); }
    m.armL.position.set(-0.32, 0.55, 0.05); m.armR.position.set(0.32, 0.55, 0.05);
    m.extra.anim = (m, P, a, T) => { m.extra.vort.rotation.y = T * 1.6; m.body.position.y += Math.sin(T * 2.4 + a.slot) * 0.02; };
  });
  // 提灯火：竹骨だけの八角提灯（灰色の光膜）＋内の琥珀の火、上の紐が尾のように流れる
  def('hoshisuzume', 0.95, () => FLOAT(0.3), (m) => {
    const fr = G(m.torso, 0, -0.05, 0); fr.scale.setScalar(1.45); m.extra.lamp = fr; const bam = L(0xc8a46a);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; C(fr, 0.008, 0.008, 0.5, bam, Math.cos(a) * 0.17, 0.25, Math.sin(a) * 0.17); }
    for (const y of [0, 0.12, 0.25, 0.38, 0.5]) { const r = 0.17 * (1 - Math.abs(y - 0.25) * 0.5); const t = TOR(fr, r, 0.007, bam, 0, y, 0, Math.PI / 2); t.geometry = new THREE.TorusGeometry(r, 0.007, 4, 8); }
    C(fr, 0.16, 0.16, 0.5, TR(0x9a9ea6, { opacity: 0.35, emissive: 0x403020, emissiveIntensity: 0.4 }), 0, 0.25, 0, null, 8);
    const fl = S(fr, 0.07, E(0xffb340, 1.6), 0, 0.25, 0, 1, 1.5, 1); m.extra.flame = fl;
    C(fr, 0.07, 0.07, 0.04, 0x3a3020, 0, 0.53, 0, null, 8);
    const str = G(fr, 0, 0.56, 0); m.extra.str = str; for (let i = 0; i < 6; i++) S(str, 0.012, 0xb8282a, 0, 0.02 + i * 0.01, -i * 0.045);
    m.armR.position.set(0, 0.4, 0.1);
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 2 + a.slot) * 0.03; m.extra.flame.scale.setScalar(1 + Math.sin(T * 11) * 0.08); m.extra.str.rotation.x = Math.sin(T * 2.5) * 0.3; m.extra.lamp.rotation.z = P.lean * 0.4 + Math.sin(T * 1.6) * 0.05; };
  });
  // 九尾の狐：灰白と墨色のまだら、細身の四足、長く平たい帯状の九本尾が背後へ低く広がる
  def('akaneten', 1.0, () => QUAD(0.28, 0.24), (m, c, d) => {
    quad(m, d, { len: 0.68, bw: 0.24, col: 0xd8d6d0, headR: 0.13, snout: 0.9, ears: 'pt', earCol: 0x2a2a2e, legR: 0.03, legCol: 0xc8c6c0, eyeCol: 0x1a1a1a, tail: { n: 9, len: 0.72, w: 0.11, flat: true, col: 0xe0ded8, tip: 0x2c2c30, spread: 1.9, lift: 0.32 } });
    spots(m.body, 9, 0.06, 0x2e2e33, 0.11, 0.1, 0.3, 0.02, 7);
  });
  // 大蛇：濡れた黒岩の鱗、腹に淡い青磁の筋、頭の後ろに二枚の小さな鰭。全身で低く這う
  def('kagetsubame', 1.0, () => ({ legH: 0, headY: 0.4, shX: 0.1, shY: 0.15, hipX: 0.05, R: 0.12, T: 0.1 }), (m) => {
    const hd = serpent(m, { n: 16, r0: 0.14, step: 0.14, col: 0x26282e, belly: 0x9fc8b8, headR: 0.15, wave: 0.16 });
    for (const s of [-1, 1]) { dot(hd, 0.018, s * 0.07, 0.03, 0.1, 0xd8e8f0); const f = PL(hd, 0.08, 0.06, 0x3a4a52, s * 0.08, 0.06, -0.1); f.rotation.y = s * 1.1; }
    m.armR.position.set(0, 0.12, 0.2);
  });
  // 刀の付喪神：欠けた古刀が黒い木鞘の上に浮かぶ。柄に古い麻縄、鍔の中央に小さな丸穴。刀と鞘が交互に回る
  def('sayanosuke', 1.05, () => FLOAT(0.25), (m) => {
    const blade = G(m.armR, 0, 0, 0); m.armR.position.set(0.12, 0.62, 0);
    B(blade, 0.06, 0.66, 0.016, L(0xd8dde2, { emissive: 0x202830, emissiveIntensity: 0.3 }), 0, -0.4, 0); B(blade, 0.025, 0.06, 0.013, 0x8a9096, 0.01, -0.68, 0); // 欠け
    const ts = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 6, 14), L(0x3a3228)); ts.rotation.x = Math.PI / 2; ts.position.y = -0.08; blade.add(ts);
    C(blade, 0.024, 0.024, 0.18, 0xb8a888, 0, 0.02, 0); for (let i = 0; i < 5; i++) TOR(blade, 0.027, 0.006, 0x8a7a5a, 0, -0.05 + i * 0.035, 0, Math.PI / 2 + 0.3);
    const sh = G(m.armL, 0, 0, 0); m.armL.position.set(-0.1, 0.4, 0); const sc = B(sh, 0.06, 0.62, 0.035, 0x1e1a18, 0, -0.1, 0); sc.rotation.z = 1.35;
    for (let i = 0; i < 3; i++) TOR(m.torso, 0.22 + i * 0.03, 0.006, TR(0xc8d8ff, { opacity: 0.35 }), 0, 0.15 + i * 0.25, 0, Math.PI / 2); // 周囲の霊気
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 2 + a.slot) * 0.02; m.armL.rotation.y = Math.sin(T * 1.2) * 0.8; m.armR.rotation.y = -Math.sin(T * 1.2) * 0.6; };
  });
  // 鬼神：青銅の肌と短い横角、四角い顎と広い肩、生成りの布を一枚。背に丸い石鼓。4.5頭身
  def('taiko', 1.25, () => HUM(4.5), (m, c, d) => {
    const R = d.R, bz = 0x7a8a6a;
    hum(m, d, { skin: bz, cloth: bz, chest: 0.13, armLen: d.T * 1.0, armR: 0.055, hand: 0.07, legR: 0.06, legCol: bz, foot: [0.1, 0.04, 0.14], headBox: true, headScale: [1.05, 1, 1] });
    B(m.torso, 0.26, d.T * 0.55, 0.2, 0xe8e0c8, 0, d.T * 0.45, 0.02).rotation.z = 0.35; // 生成りの布
    for (const s of [-1, 1]) { const h = K(m.head, R * 0.18, R * 0.7, 0xe8dcc0, s * R * 1.1, R * 0.35, 0); h.rotation.z = -s * 1.4; }
    B(m.head, R * 1.5, R * 0.45, R * 0.4, 0x6a7a5a, 0, -R * 0.75, R * 0.55); for (const s of [-1, 1]) dot(m.head, R * 0.12, s * R * 0.35, R * 0.15, R * 0.86);
    const dr = C(m.torso, 0.2, 0.2, 0.14, 0x9a968c, 0, d.T * 0.6, -0.17, null, 18); dr.rotation.x = Math.PI / 2; TOR(m.torso, 0.2, 0.015, 0x6a665e, 0, d.T * 0.6, -0.1, 0);
  });
  // 甲冑の付喪神：中身のない古い鉄の胴丸、兜の代わりに三枚の鉄板、木の関節と角形の籠手、短い鉄の杭の足
  def('burikidon', 1.2, () => HUM(4), (m, c, d) => {
    const iron = 0x4a4c52, R = d.R;
    const cu = C(m.torso, 0.15, 0.13, d.T, iron, 0, d.T * 0.5, 0, null, 12); C(m.torso, 0.135, 0.135, 0.02, 0x0e0e10, 0, d.T, 0, null, 12);
    for (let i = 0; i < 4; i++) TOR(m.torso, 0.145 - i * 0.005, 0.008, 0x6a6c72, 0, d.T * (0.2 + i * 0.2), 0, Math.PI / 2);
    m.head.position.y += 0.05; const pl = G(m.head, 0, 0, 0); m.extra.plates = pl; for (let i = 0; i < 3; i++) { const p = B(pl, R * 1.1, 0.02, R * 0.7, iron, 0, i * 0.06 - 0.05, 0); p.rotation.y = i * 0.5; }
    for (const g of [m.armL, m.armR]) { S(g, 0.04, 0x8a6a42, 0, 0, 0); C(g, 0.03, 0.03, d.T * 0.4, 0x6a4a2a, 0, -d.T * 0.2, 0); S(g, 0.035, 0x8a6a42, 0, -d.T * 0.42, 0); B(g, 0.09, d.T * 0.4, 0.09, 0x3a3c42, 0, -d.T * 0.65, 0); B(g, 0.11, 0.07, 0.1, 0x2a2c30, 0, -d.T * 0.88, 0); }
    for (const g of [m.legL, m.legR]) { C(g, 0.03, 0.02, d.legH, 0x3a3c42, 0, -d.legH / 2, 0); }
    m.extra.anim = (m, P, a, T) => { m.extra.plates.children.forEach((p, i) => { p.position.y = i * 0.06 - 0.05 + Math.sin(T * 2 + i) * 0.015; }); };
  });
  // 唐傘：墨色の和傘が二本の曲がった竹脚で歩く。傘の内側に小さな目が六つ、縁から切れた紙が垂れる。閉じて突く
  def('norenbou', 1.15, () => ({ legH: 0.42, headY: 0.9, shX: 0.1, shY: 0.75, hipX: 0.07, R: 0.1, T: 0.4 }), (m) => {
    const um = G(m.torso, 0, 0.4, 0); m.extra.um = um;
    const can = K(um, 0.42, 0.34, L(0x24242a, { side: THREE.DoubleSide }), 0, 0, 0); can.geometry = new THREE.ConeGeometry(0.42, 0.34, 16, 1, true); m.extra.canopy = can;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; C(um, 0.006, 0.006, 0.5, 0xc8b080, Math.cos(a) * 0.2, -0.08, Math.sin(a) * 0.2).rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; glowEye(um, 0.022, Math.cos(a) * 0.2, -0.11, Math.sin(a) * 0.2 + 0.03, 0xf2ead8); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const p = PL(um, 0.05, 0.11 + (i % 3) * 0.03, 0xe8e0cc, Math.cos(a) * 0.4, -0.22, Math.sin(a) * 0.4); p.rotation.y = -a; }
    C(um, 0.012, 0.012, 0.4, 0x8a6a3a, 0, -0.15, 0);
    for (const [g, s] of [[m.legL, -1], [m.legR, 1]]) { const a = C(g, 0.016, 0.016, 0.26, 0xa8904a, s * 0.03, -0.12, 0); a.rotation.z = s * 0.25; const b = C(g, 0.015, 0.015, 0.24, 0xa8904a, s * 0.02, -0.34, 0.03); b.rotation.z = -s * 0.2; }
    m.armR.position.set(0, 0.6, 0.1);
    m.extra.anim = (m, P, a, T, dt, act, t) => { const poke = Math.max(0, -P.aRx) / 1.8; m.extra.canopy.scale.set(1 - poke * 0.75, 1 + poke * 0.6, 1 - poke * 0.75); m.extra.um.rotation.x = poke * 1.35; m.extra.um.position.z = poke * 0.2; };
  });
  // 幽霊：薄い灰青の布が重なって細い人の輪郭。口はなく黒い点が二つ。下は長い紙帯へ分かれ、掌で小さな光をすくう。4.5頭身
  def('kemuridama', 1.05, () => Object.assign(HUM(4.5), { legH: 0.32 }), (m, c, d) => {
    const R = d.R, cl = TR(0xa8b8c8, { opacity: 0.78 });
    for (let i = 0; i < 3; i++) { const k = K(m.torso, 0.13 - i * 0.02, d.T + 0.15, cl, 0, d.T * 0.5 - 0.07 + i * 0.02, -i * 0.012); k.material = cl; }
    S(m.head, R, cl, 0, 0, 0, 0.9, 1.08, 0.9); for (const s of [-1, 1]) dot(m.head, R * 0.12, s * R * 0.3, R * 0.05, R * 0.82);
    const st = G(m.body, 0, 0, 0); m.extra.strips = st; for (let i = 0; i < 5; i++) { const p = PL(st, 0.05, 0.36, TR(0xe8e4d8, { opacity: 0.8, side: THREE.DoubleSide }), (i - 2) * 0.04, -0.16, 0); p.rotation.y = (i - 2) * 0.4; }
    for (const g of [m.armL, m.armR]) { C(g, 0.025, 0.035, d.T * 0.85, cl, 0, -d.T * 0.42, 0); S(g, 0.03, E(0xd8f0ff, 1.2), 0, -d.T * 0.9, 0.04); }
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 1.8 + a.slot) * 0.03; m.extra.strips.children.forEach((p, i) => p.rotation.x = Math.sin(T * 3 + i) * 0.25); };
  });
  // 木霊〈花守〉：古い切り株に白い野花、顔は樹皮の二本の割れ目、四本の根で低く歩く、花びらの輪を足元に
  def('momiji', 0.9, () => ({ legH: 0.16, headY: 0.7, shX: 0.22, shY: 0.4, hipX: 0.08, R: 0.15, T: 0.45 }), (m) => {
    C(m.torso, 0.26, 0.3, 0.5, 0x6a4a2e, 0, 0.25, 0, null, 14); C(m.torso, 0.255, 0.255, 0.02, 0xc8a878, 0, 0.5, 0, null, 14); for (const r of [0.08, 0.15, 0.22]) TOR(m.torso, r, 0.006, 0x8a6a48, 0, 0.511, 0, Math.PI / 2);
    for (const s of [-1, 1]) B(m.torso, 0.012, 0.1, 0.02, 0x1a1208, s * 0.07, 0.32, 0.27);
    for (let i = 0; i < 9; i++) { const a = i * 2.3; S(m.torso, 0.025, 0xfaf8f0, Math.cos(a) * 0.27, 0.12 + (i % 4) * 0.1, Math.sin(a) * 0.27); }
    const roots = []; for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const g = G(m.body, x * 0.17, 0.02, z * 0.15); const r = CAP(g, 0.035, 0.14, 0x5a3a22, x * 0.05, -0.08, 0); r.rotation.z = x * 0.5; roots.push(g); }
    m.extra.roots = roots;
    const ring = G(m.root, 0, 0.02, 0); m.extra.ring = ring; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const p = PL(ring, 0.07, 0.05, 0xfff4f8, Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); p.rotation.set(-Math.PI / 2, 0, a); }
    for (const g of [m.armL, m.armR]) { C(g, 0.025, 0.02, 0.22, 0x6a4a2e, 0, -0.11, 0); S(g, 0.03, 0xfaf8f0, 0, -0.23, 0); }
    m.extra.anim = (m, P, a, T) => { const ph = m.walkPh || 0, mv = a.moving ? 0.5 : 0; m.extra.roots.forEach((g, i) => g.rotation.x = Math.sin(ph + i * Math.PI / 2) * mv); m.extra.ring.rotation.y = T * 0.3; };
  });

  /* =============================== 追加50体：アタッカー =============================== */
  def('new_d_02', 0.95, () => QUAD(0.24, 0.26), (m, c, d) => { // 猫又：煤色の長毛の老猫、琥珀の細い目、二本の長い尾、背に灰色の斑点
    quad(m, d, { len: 0.62, bw: 0.3, col: 0x3a3836, headR: 0.15, snout: 0.3, ears: 'pt', legR: 0.035, eyeGlow: 0xffb030, paw: 0.05, tail: { n: 2, len: 0.6, w: 0.03, col: 0x3a3836, spread: 0.5, lift: -0.4 } });
    spots(m.body, 6, 0.06, 0x6a6864, 0.1, 0.12, 0.25, 0.05, 3); for (let i = 0; i < 8; i++) S(m.body, 0.05, 0x302e2c, (i % 2 - 0.5) * 0.25, -0.1, (i / 8 - 0.5) * 0.5, 1, 1.4, 1);
  });
  def('new_d_03', 0.95, () => QUAD(0.2, 0.22), (m, c, d) => { // 化け猫：細長い胴の茶褐色の山猫、欠けた片耳、細い一本尾、背に苔状の毛。低く伏せる
    const hd = quad(m, d, { len: 0.8, bw: 0.25, col: 0x8a5a32, headR: 0.13, snout: 0.35, ears: 'none', legR: 0.032, eyeGlow: 0xd8e040, paw: 0.045, tail: { n: 1, len: 0.62, w: 0.018, col: 0x7a4a2a, lift: -0.2 } });
    const e1 = K(hd, 0.05, 0.11, 0x8a5a32, -0.08, 0.12, -0.01); e1.rotation.z = 0.25; const e2 = K(hd, 0.05, 0.05, 0x8a5a32, 0.08, 0.1, -0.01); e2.rotation.z = -0.25; // 欠けた耳
    for (let i = 0; i < 7; i++) S(m.body, 0.045, 0x5a7a3a, (i % 2 - 0.5) * 0.08, 0.1, (i / 7 - 0.5) * 0.6, 1.2, 0.5, 1.4);
  });
  def('new_d_05', 0.9, () => ({ legH: 0, headY: 0.4, shX: 0.1, shY: 0.2, hipX: 0.05, R: 0.1, T: 0.1 }), (m) => { // 白蛇：乳白色の細い蛇が三重の輪、中心に光、腹は淡い銅色
    const cg = G(m.body, 0, 0, 0); m.extra.coil = cg;
    for (let ring = 0; ring < 3; ring++) { const rr = 0.32 - ring * 0.08; const t = TOR(cg, rr, 0.045 - ring * 0.005, 0xf4f0e6, 0, 0.05 + ring * 0.075, 0, Math.PI / 2); TOR(cg, rr, 0.03 - ring * 0.004, 0xd0a070, 0, 0.03 + ring * 0.075, 0, Math.PI / 2); }
    const core = S(cg, 0.08, E(0xfff0c0, 1.4), 0, 0.12, 0); m.extra.core = core;
    const hd = G(m.body, 0, 0.32, 0.12); m.extra.shead = hd; m.extra.shead0 = hd.position.clone(); S(hd, 0.075, 0xf4f0e6, 0, 0, 0, 1, 0.75, 1.35); for (const s of [-1, 1]) dot(hd, 0.013, s * 0.045, 0.02, 0.07, 0xd04040);
    m.extra.anim = (m, P, a, T) => { const strike = Math.max(0, -Math.min(P.aRx, P.aLx)) * 0.12; m.extra.shead.position.set(0, 0.32 + Math.sin(T * 2) * 0.02, 0.12 + strike); m.extra.coil.rotation.y = Math.sin(T * 0.8) * 0.3; m.extra.core.scale.setScalar(1 + Math.sin(T * 6) * 0.15); };
  });
  def('new_d_06', 1.25, () => HUM(5), (m, c, d) => { // 雪女：灰白の顔、長い黒髪、深緑の山着に霜、裾は雪煙へほどける
    const R = d.R; hum(m, d, { skin: 0xdcdcd8, cloth: 0x2e4a3a, robe: true, robeW: 0.17, robeLong: 0.95, hair: 'long', hairCol: 0x0e0e12, armLen: d.T * 0.9, armR: 0.035, sleeve: 0x2e4a3a, hand: 0.03, noLegs: true });
    spots(m.torso, 10, 0.02, 0xf4f8ff, 0.12, d.T, 0.12, -0.1, 5);
    const sm = G(m.body, 0, 0, 0); m.extra.snow = sm; for (let i = 0; i < 6; i++) S(sm, 0.07, TR(0xf4f8ff, { opacity: 0.45 }), Math.cos(i) * 0.15, -d.legH + 0.06, Math.sin(i) * 0.15);
    for (const s of [-1, 1]) dot(m.head, R * 0.1, s * R * 0.32, 0, R * 0.88, 0x2a2a30);
    for (const g of [m.armL, m.armR]) for (let i = 0; i < 3; i++) OCT(g, 0.018, L(0xc8f0ff, { emissive: 0x6ac0e0, emissiveIntensity: 0.6 }), (i - 1) * 0.03, -d.T * 0.95 - i * 0.03, 0.03);
    m.extra.anim = (m, P, a, T) => m.extra.snow.children.forEach((s, i) => { s.position.y = -d.legH + 0.06 + ((T * 0.3 + i / 6) % 1) * 0.12; s.material.opacity = 0.45 * (1 - ((T * 0.3 + i / 6) % 1)); });
  });
  def('new_c_02', 1.25, () => Object.assign(HUM(4), { legH: 0.22 }), (m, c, d) => { // 狒々：焦げ茶の長毛の大猿、灰色の顔、赤土色の前腕、肩の毛が蓑状、長い腕
    const R = d.R, br = 0x4a3222; hum(m, d, { skin: br, cloth: br, chest: 0.15, armLen: 0.62, armR: 0.05, hand: 0.06, handCol: 0xa85a3a, legR: 0.055, foot: [0.09, 0.04, 0.12] });
    S(m.head, R * 0.7, 0x8a8a86, 0, -R * 0.1, R * 0.45, 1, 0.9, 0.6); for (const s of [-1, 1]) dot(m.head, R * 0.1, s * R * 0.28, R * 0.05, R * 0.98);
    for (const g of [m.armL, m.armR]) CAP(g, 0.052, 0.18, 0xa85a3a, 0, -0.45, 0);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const p = PL(m.torso, 0.08, 0.2, 0x3a281a, Math.cos(a) * 0.15, d.T * 0.82, Math.sin(a) * 0.15); p.rotation.y = -a + Math.PI / 2; p.rotation.x = 0.3; }
    m.extra.anim = (m, P) => { m.body.rotation.x += 0.35; };
  });
  def('new_c_03', 0.85, () => QUAD(0.24, 0.2), (m, c, d) => { // 犬神：小柄な黒犬の霊、細い四肢、大きな垂れ耳、胸の毛が藁色、尾は煙へ、足元に霜の輪
    quad(m, d, { len: 0.5, bw: 0.22, col: 0x18181c, headR: 0.13, snout: 0.6, ears: 'flop', legR: 0.025, eyeGlow: 0xc8e0ff, tail: { n: 1, len: 0.35, w: 0.04, col: 0x2a2a30, puff: true, lift: 0.2 } });
    S(m.body, 0.1, 0xc8a050, 0, -0.03, 0.22, 1, 1, 0.6);
    const fr = TOR(m.root, 0.36, 0.012, L(0xd8f0ff, { emissive: 0x7ab0d0, emissiveIntensity: 0.6 }), 0, 0.015, 0, Math.PI / 2);
  });
  def('new_c_05', 1.3, () => HUM(4.5), (m, c, d) => { // なまはげ：黒褐色の幅広い木面、細い目の裂け目、銅色の牙、稲藁の外套、藍の脚絆、長い木の杖
    const R = d.R; hum(m, d, { skin: 0x5a3a28, cloth: 0xa8955a, chest: 0.14, armLen: d.T * 0.95, armR: 0.05, sleeve: 0xa8955a, hand: 0.05, handCol: 0x7a5a3a, legCol: 0x2a3a6a, legR: 0.055, headBox: true, headCol: 0x3a2618, headScale: [1.25, 1, 0.8] });
    for (const s of [-1, 1]) { B(m.head, R * 0.45, R * 0.07, 0.02, 0x0a0806, s * R * 0.4, R * 0.25, R * 0.72); K(m.head, R * 0.1, R * 0.35, 0xb8783a, s * R * 0.3, -R * 0.7, R * 0.7).rotation.x = Math.PI; }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const p = PL(m.torso, 0.06, d.T * 0.9, 0xb8a060, Math.cos(a) * 0.17, d.T * 0.45, Math.sin(a) * 0.17); p.rotation.y = -a + Math.PI / 2; }
    const st = C(m.armR, 0.018, 0.022, 1.1, 0x7a5a32, 0, -d.T * 0.9, 0.08); st.rotation.x = 0.1;
  });
  def('new_c_06', 1.0, () => QUAD(0.24, 0.3), (m, c, d) => { // 狛犬：ひび割れた青銅色の石の守護獣、角張った鼻先、渦を巻かない短いたてがみ、太い脚、腹に銅鈴、口から火花
    const hd = quad(m, d, { len: 0.58, bw: 0.36, col: 0x5a7a6a, headR: 0.17, snout: 0.3, ears: 'half', legR: 0.06, eyeCol: 0x1a2a20, paw: 0.07, tail: { n: 1, len: 0.15, w: 0.04, col: 0x4a6a5a, lift: 1.0 } });
    B(hd, 0.2, 0.12, 0.12, 0x5a7a6a, 0, -0.04, 0.15); for (let i = 0; i < 6; i++) B(hd, 0.08, 0.07, 0.06, 0x4a6656, (i % 3 - 1) * 0.1, 0.08 + (i > 2 ? 0.06 : 0), -0.1);
    for (let i = 0; i < 5; i++) B(m.body, 0.005, 0.12, 0.004, 0x2a3a30, (i - 2) * 0.06, 0.05, 0.2 + i * 0.01).rotation.z = i;
    S(m.body, 0.05, E(0xc8803a, 0.3), 0, -0.15, 0.1);
    const sp = G(hd, 0, -0.06, 0.26); m.extra.sparks = sp; for (let i = 0; i < 4; i++) S(sp, 0.012, E(0xff7a3a, 1.5), (i - 1.5) * 0.02, 0, i * 0.02);
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.sparks.visible = Math.sin(T * 9) > 0.3 || act === 'release'; };
  });
  def('new_b_02', 0.85, () => FLOAT(0.3), (m) => { // 狐火：三つの小さな火（白い芯・灰紫の炎）が三角に回り、攻撃で一点へまとまる
    const tri = G(m.torso, 0, 0.15, 0); m.extra.tri = tri; const fl = [];
    for (let i = 0; i < 3; i++) { const g = G(tri, 0, 0, 0); S(g, 0.05, E(0xffffff, 1.5), 0, 0, 0); S(g, 0.09, TR(0xa08ac8, { opacity: 0.6, emissive: 0x6a4a9a, emissiveIntensity: 0.9 }), 0, 0.03, 0, 1, 1.4, 1); fl.push(g); }
    m.extra.fl = fl; m.armR.position.set(0, 0.45, 0.1);
    m.extra.anim = (m, P, a, T, dt, act) => { const gather = act && act !== 'dodge' ? 0.25 : 1; m.extra.fl.forEach((g, i) => { const an = T * 2.2 + i * Math.PI * 2 / 3; g.position.set(Math.cos(an) * 0.26 * gather, Math.sin(T * 3 + i) * 0.04, Math.sin(an) * 0.26 * gather); g.scale.setScalar(1 + Math.sin(T * 12 + i) * 0.1); }); };
  });
  def('new_b_03', 0.85, () => HUM(3.5), (m, c, d) => { // 座敷童子：生成りの作務衣に墨色の前掛け、栗色の癖毛、丸い頬、背に織り座布団、紙風車
    const R = d.R; hum(m, d, { skin: 0xf0d8c0, cloth: 0xe8dcc0, chest: 0.12, hair: 'short', hairCol: 0x7a4a2a, armLen: d.T * 0.85, armR: 0.035, sleeve: 0xe8dcc0, hand: 0.035, legCol: 0xe8dcc0, legR: 0.04, foot: [0.07, 0.03, 0.1], footCol: 0x8a6a4a });
    B(m.torso, 0.2, d.T * 0.7, 0.02, 0x2a2a30, 0, d.T * 0.4, 0.12);
    for (const s of [-1, 1]) { dot(m.head, R * 0.1, s * R * 0.32, 0, R * 0.9); S(m.head, R * 0.18, 0xf0a090, s * R * 0.5, -R * 0.25, R * 0.75, 1, 0.6, 0.4); }
    B(m.torso, 0.24, 0.05, 0.22, 0x9a3a4a, 0, d.T * 0.6, -0.15).rotation.x = 1.3;
    const pw = G(m.armR, 0, -d.T * 0.85, 0.05); C(pw, 0.006, 0.006, 0.18, 0x6a4a2a, 0, 0.09, 0); const wh = G(pw, 0, 0.18, 0.01); m.extra.wheel = wh; for (let i = 0; i < 4; i++) { const p = PL(wh, 0.07, 0.04, [0xd04a4a, 0x4a8ad0, 0xe0c040, 0x4ab070][i], 0.035, 0, 0); p.rotation.z = i * Math.PI / 2; p.position.set(Math.cos(i * Math.PI / 2) * 0.035, Math.sin(i * Math.PI / 2) * 0.035, 0); }
    m.extra.anim = (m, P, a, T) => { m.extra.wheel.rotation.z = T * 6; };
  });
  def('new_b_05', 1.0, () => QUAD(0.3, 0.22), (m, c, d) => { // 火車：痩せた灰銀の四足獣、獅子のような長い鼻先、肩の両側に黒い轍の輪、足跡に短い炎
    quad(m, d, { len: 0.62, bw: 0.24, col: 0xa8aab0, headR: 0.13, snout: 1.1, ears: 'pt', legR: 0.03, eyeGlow: 0xffa040, paw: 0.045, tail: { n: 1, len: 0.3, w: 0.015, col: 0x8a8c92, lift: 0.3 } });
    const wh = []; for (const s of [-1, 1]) { const w = TOR(m.body, 0.13, 0.025, 0x15151a, s * 0.24, 0.05, 0.18, 0); w.rotation.y = Math.PI / 2; for (let i = 0; i < 6; i++) { const sp = C(w, 0.008, 0.008, 0.25, 0x2a2a30, 0, 0, 0); sp.rotation.z = i * Math.PI / 6 * 2; } wh.push(w); }
    m.extra.wheels = wh; const fls = []; for (const g of m.extra.qlegs) { const f = K(g, 0.03, 0.08, E(0xff6a20, 1.3), 0, -d.legLen - 0.05, 0); fls.push(f); } m.extra.fls = fls;
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.wheels.forEach(w => w.rotation.x = T * 4); m.extra.fls.forEach((f, i) => { f.visible = a.moving; f.scale.y = 0.7 + Math.sin(T * 14 + i) * 0.3; }); };
  });
  def('new_b_06', 1.2, () => HUM(4.5), (m, c, d) => { // 鬼童丸：褐色の肌と角のない獣面、短い黒髪、灰色の毛皮を片側に垂らす、大きな掌
    const R = d.R; hum(m, d, { skin: 0x8a5a3a, cloth: 0x5a4a3a, chest: 0.13, hair: 'short', hairCol: 0x15120f, armLen: d.T * 1.0, armR: 0.055, hand: 0.08, legR: 0.055, legCol: 0x4a3a2a });
    S(m.head, R * 0.55, 0x6a4a32, 0, -R * 0.2, R * 0.6, 1.1, 0.8, 0.8); for (const s of [-1, 1]) dot(m.head, R * 0.12, s * R * 0.32, R * 0.12, R * 0.85, 0x1a0a04);
    const fur = B(m.torso, 0.14, d.T * 0.9, 0.18, 0x8a8c90, -0.12, d.T * 0.55, 0); fur.rotation.z = 0.2;
    for (const g of [m.armL, m.armR]) B(g, 0.1, 0.03, 0.12, 0x8a5a3a, 0, -d.T * 1.0 - 0.02, 0.02);
  });
  def('new_a_02', 0.95, () => HUM(3), (m, c, d) => { // 一つ目小僧：中央に大きな一眼の陶土色の小坊主、灰色の短い法衣、丸い木靴、長い袖を拳に巻く。目は半分閉じる
    const R = d.R; hum(m, d, { skin: 0xc8805a, cloth: 0x7a7a80, chest: 0.12, armLen: d.T * 0.9, armR: 0.04, sleeve: 0x8a8a90, hand: 0.05, handCol: 0x8a8a90, legR: 0.04, legCol: 0xc8805a, foot: [0.09, 0.05, 0.1], footCol: 0x7a5a3a });
    S(m.head, R * 0.45, 0xffffff, 0, R * 0.05, R * 0.8, 1.3, 0.9, 0.5); dot(m.head, R * 0.17, 0, R * 0.0, R * 1.0, 0x2a1a10);
    const lid = S(m.head, R * 0.47, 0xb8704a, 0, R * 0.2, R * 0.81, 1.32, 0.5, 0.5); m.extra.lid = lid;
    B(m.torso, 0.26, d.T * 0.6, 0.2, 0x7a7a80, 0, d.T * 0.3, 0);
    m.extra.anim = (m, P, a, T, dt, act) => { m.extra.lid.position.y = d.R * (act ? 0.45 : 0.22); };
  });
  def('new_a_03', 1.3, () => HUM(5), (m, c, d) => { // 天狗：赤茶の鳥面、濃い鼠色の羽織、杉皮のすね当て、背の杉の葉が風で開く、一本の木の棒
    const R = d.R; hum(m, d, { skin: 0xa8523a, cloth: 0x4a4a52, chest: 0.11, armLen: d.T * 1.0, armR: 0.04, sleeve: 0x4a4a52, hand: 0.035, handCol: 0xd8b090, legR: 0.04, legCol: 0x7a5a3a, foot: [0.08, 0.04, 0.14], footCol: 0x3a2a1a });
    K(m.head, R * 0.25, R * 1.0, 0x8a3a2a, 0, -R * 0.05, R * 1.25).rotation.x = Math.PI / 2; for (const s of [-1, 1]) dot(m.head, R * 0.1, s * R * 0.35, R * 0.25, R * 0.82, 0xffd04a);
    const lv = G(m.torso, 0, d.T * 0.75, -0.12); m.extra.leaves = lv; for (let i = 0; i < 7; i++) { const g = G(lv, 0, 0, 0); g.rotation.z = (i - 3) * 0.32; const l = K(g, 0.04, 0.32, 0x2a5a32, 0, 0.18, 0); }
    C(m.armR, 0.015, 0.015, 0.95, 0x8a6a3a, 0, -d.T * 0.95, 0.1).rotation.x = 1.4;
    m.extra.anim = (m, P, a, T) => { const open = a.moving || a.act ? 1 : 0.4; m.extra.leaves.children.forEach((g, i) => g.rotation.z = (i - 3) * 0.32 * open + Math.sin(T * 3 + i) * 0.04); };
  });
  def('new_a_05', 1.2, () => HUM(4), (m, c, d) => { // 烏天狗：青黒い羽毛の鳥人、短い嘴と琥珀の目、淡い灰の腹、細い縄の帯だけ。翼と腕が一体
    const R = d.R, bl = 0x1e2638; hum(m, d, { skin: bl, cloth: bl, chest: 0.12, belt: 0xb8a070, armLen: d.T * 0.95, armR: 0.03, hand: 0, legR: 0.03, legCol: 0x3a3a30, foot: [0.08, 0.02, 0.11], footCol: 0x6a6040 });
    S(m.torso, 0.1, 0x9aa0a8, 0, d.T * 0.45, 0.07, 0.9, 1.4, 0.5); K(m.head, R * 0.25, R * 0.6, 0x2a2a2a, 0, -R * 0.1, R * 1.1).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) dot(m.head, R * 0.12, s * R * 0.4, R * 0.18, R * 0.82, 0xffb030);
    for (const [g, s] of [[m.armL, -1], [m.armR, 1]]) for (let i = 0; i < 5; i++) { const f = PL(g, 0.08, 0.32 - i * 0.03, bl, s * (0.04 + i * 0.03), -0.18 - i * 0.04, -0.02); f.rotation.y = s * 0.2; }
  });
  def('new_a_06', 0.9, () => HUM(3.5), (m, c, d) => { // 青鬼童子：青緑の粘土の小鬼、平たい頭の両端に小さな突起、鼻と口だけを深く彫る、薄茶の腰布、丸い石を両手で運ぶ
    const R = d.R, cl = 0x3a8a7a; hum(m, d, { skin: cl, cloth: cl, chest: 0.13, armLen: d.T * 0.8, armR: 0.045, hand: 0.05, legR: 0.05, legCol: cl, headScale: [1.2, 0.75, 1] });
    for (const s of [-1, 1]) S(m.head, R * 0.18, cl, s * R * 1.15, R * 0.25, 0);
    B(m.head, R * 0.25, R * 0.35, R * 0.2, 0x1a4a40, 0, -R * 0.05, R * 0.82); B(m.head, R * 0.6, R * 0.12, R * 0.1, 0x0e2a24, 0, -R * 0.45, R * 0.8);
    C(m.torso, 0.14, 0.15, d.T * 0.35, 0xb89a72, 0, d.T * 0.1, 0, null, 10);
    const st = S(m.torso, 0.1, 0x8a8a84, 0, d.T * 0.35, 0.2); m.extra.stone = st;
    m.armL.rotation.x = -1; m.armR.rotation.x = -1;
  });
  def('new_s_02', 0.9, () => FLOAT(0.4), (m) => { // 野衾：薄茶の小さな飛膜の獣、年輪状の模様の大きな皮膜、丸い顔、短い鼻先。滑空して体当たり
    const tan = 0xb08a5a; S(m.torso, 0.14, tan, 0, 0.05, 0, 1, 0.8, 1.3); S(m.head, 0.1, tan, 0, -0.25, 0.14); for (const s of [-1, 1]) { dot(m.head, 0.018, s * 0.04, 0.01, 0.09); S(m.head, 0.03, tan, s * 0.07, 0.08, 0); }
    m.head.position.set(0, 0.1, 0.17);
    const ring = GFX.tex(128, 64, (g, w, h) => { g.fillStyle = '#c8a070'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6440'; g.lineWidth = 3; for (let r = 8; r < 80; r += 9) { g.beginPath(); g.arc(w / 2, h, r, Math.PI, 0); g.stroke(); } });
    const wm = L(0xffffff, { map: ring, side: THREE.DoubleSide }); const wings = [];
    for (const s of [-1, 1]) { const g = G(m.torso, s * 0.1, 0.05, 0); const w = PL(g, 0.55, 0.42, wm, s * 0.27, 0, 0); w.rotation.x = -Math.PI / 2 + 0.55; wings.push(g); }
    m.extra.wings = wings; m.armR.position.set(0, 0.55, 0.15);
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 2.5 + a.slot) * 0.04; m.extra.wings.forEach((g, i) => g.rotation.z = (i ? -1 : 1) * (Math.sin(T * (a.moving ? 6 : 2)) * 0.18)); };
  });
  def('new_s_03', 1.15, () => FLOAT(0.12), (m) => { // 煙々羅：古い香炉の周りに三本の細い灰色の煙柱、顔は一瞬だけ輪状の空洞、旋回時に一本の渦へ
    const ko = G(m.root, 0, 0, 0); C(ko, 0.15, 0.12, 0.14, 0x6a5a3a, 0, 0.1, 0, null, 14); TOR(ko, 0.15, 0.015, 0x8a7a4a, 0, 0.17, 0, Math.PI / 2); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; C(ko, 0.015, 0.02, 0.06, 0x5a4a2a, Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1); }
    const sm = G(m.torso, 0, 0, 0); m.extra.smoke = sm; const sml = TR(0x9a9a9e, { opacity: 0.5 });
    for (let c3 = 0; c3 < 3; c3++) { const col = G(sm, 0, 0, 0); for (let i = 0; i < 9; i++) S(col, 0.05 + i * 0.006, sml, 0, i * 0.1, 0); col.userData.a = c3 * Math.PI * 2 / 3; }
    const fc = TOR(m.torso, 0.07, 0.015, TR(0x2a2a2e, { opacity: 0.7 }), 0, 0.7, 0.12, 0); m.extra.face = fc;
    m.extra.anim = (m, P, a, T, dt, act) => { const merge = act ? 0.15 : 1; m.extra.smoke.children.forEach((col, k) => { const an = col.userData.a + T * 1.5; col.children.forEach((s, i) => { s.position.set(Math.cos(an + i * 0.4) * 0.14 * merge * (1 + i * 0.05), i * 0.1, Math.sin(an + i * 0.4) * 0.14 * merge * (1 + i * 0.05)); }); }); m.extra.face.visible = Math.sin(T * 1.3) > 0.6; };
  });
  def('new_s_05', 1.05, () => QUAD(0.26, 0.3), (m, c, d) => { // 獅子：錆びた鉄色の四足、長方形の口、平たい耳、硬い板状のたてがみ、肩に苔、息に火花。短い房の尾、大きな足先
    const hd = quad(m, d, { len: 0.6, bw: 0.36, col: 0x7a4a32, headR: 0.17, snout: 0.25, ears: 'flat', legR: 0.055, eyeCol: 0x2a1a10, paw: 0.085, tail: { n: 1, len: 0.18, w: 0.02, col: 0x6a3a22, tip: 0x4a7a3a, lift: 0.9 } });
    B(hd, 0.2, 0.06, 0.06, 0x2a1a10, 0, -0.08, 0.15); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const p = B(hd, 0.08, 0.12, 0.015, 0x5a3424, Math.cos(a) * 0.17, Math.sin(a) * 0.17, -0.06); p.rotation.z = a; }
    for (const s of [-1, 1]) S(m.body, 0.06, 0x4a7a3a, s * 0.15, 0.12, 0.2, 1, 0.4, 1);
    const sp = G(hd, 0, -0.08, 0.24); m.extra.sp = sp; for (let i = 0; i < 4; i++) S(sp, 0.012, E(0xffa04a, 1.5), (i - 1.5) * 0.02, 0, i * 0.02);
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.sp.visible = Math.sin(T * 7 + 1) > 0.4 || act === 'release'; };
  });
  def('new_s_06', 1.05, () => QUAD(0.22, 0.32), (m, c, d) => { // 雷の化身：雷雲が低い四足の獣の形へ固まる、灰色の雲の背に橙の稲光、目と角はなく脚先の光が点滅
    const cl = TR(0x8a8c94, { opacity: 0.85 });
    quad(m, d, { len: 0.62, bw: 0.4, col: 0x8a8c94, headR: 0.16, snout: 0.2, ears: 'none', eyes: false, legR: 0.06, tail: { n: 1, len: 0.25, w: 0.08, col: 0x7a7c84, puff: true } });
    for (let i = 0; i < 8; i++) S(m.body, 0.1, cl, Math.cos(i) * 0.14, 0.08 + (i % 3) * 0.03, (i / 8 - 0.5) * 0.55);
    const bolts = G(m.body, 0, 0.17, 0); m.extra.bolts = bolts; for (let i = 0; i < 4; i++) { const b = B(bolts, 0.015, 0.012, 0.16, E(0xff9a3a, 1.6), (i - 1.5) * 0.06, 0, (i % 2 - 0.5) * 0.15); b.rotation.y = (i % 2 ? 0.6 : -0.6); }
    const ft = []; for (const g of m.extra.qlegs) ft.push(S(g, 0.035, E(0xffe0a0, 1.6), 0, -d.legLen - 0.06, 0)); m.extra.ft = ft;
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.bolts.visible = Math.sin(T * 13) > -0.2; m.extra.ft.forEach((f, i) => f.visible = Math.sin(T * 8 + i * 1.7) > 0); };
  });

  /* =============================== ヒーラー =============================== */
  def('new_d_01', 1.05, () => QUAD(0.32, 0.26), (m, c, d) => { // 一角：短い銅角の陶器の山羊、青白い釉薬の胴に細い亀裂（割れ目だけ暖色に光る）、蹄
    const hd = quad(m, d, { len: 0.56, bw: 0.28, col: 0xb8d0dc, headR: 0.13, snout: 0.5, ears: 'flop', legR: 0.035, eyeCol: 0x2a3a48, paw: 0.04, pawCol: 0x3a3028, tail: { n: 1, len: 0.1, w: 0.03, col: 0xb8d0dc, lift: 1.1 } });
    K(hd, 0.03, 0.12, 0xb8783a, 0, 0.16, 0.06).rotation.x = -0.4;
    for (let i = 0; i < 6; i++) { const b = B(m.body, 0.006, 0.006, 0.18, E(0xffa050, 1.2), Math.sin(i * 2) * 0.13, 0.03 + (i % 3) * 0.04, (i / 6 - 0.5) * 0.4); b.rotation.set(i, i * 0.7, 0); }
  });
  def('new_d_08', 1.05, () => HUM(4), (m, c, d) => { // 山姥：赤土色の肌と灰色の短い髪、苔色の厚い外套、腰に薬草の束、丸い木鉢から湯気
    const R = d.R; hum(m, d, { skin: 0xb0603a, cloth: 0x5a6a3a, robe: true, robeW: 0.2, robeLong: 0.9, hair: 'short', hairCol: 0x9a9a98, armLen: d.T * 0.85, armR: 0.04, sleeve: 0x5a6a3a, hand: 0.04, noLegs: true });
    for (const s of [-1, 1]) dot(m.head, R * 0.09, s * R * 0.32, 0, R * 0.9);
    for (let i = 0; i < 4; i++) { const h = C(m.torso, 0.008, 0.008, 0.16, 0x4a7a2a, 0.13 + i * 0.012, d.T * 0.15, 0.05); h.rotation.z = 0.2; }
    const bowl = G(m.armR, 0, -d.T * 0.85, 0.08); const bw = S(bowl, 0.08, 0x7a5a32, 0, 0, 0, 1, 0.5, 1); m.extra.steam = []; for (let i = 0; i < 3; i++) m.extra.steam.push(S(bowl, 0.03, TR(0xf8f8f8, { opacity: 0.5 }), (i - 1) * 0.03, 0.06, 0));
    m.extra.anim = (m, P, a, T) => { m.body.rotation.x += 0.18; m.extra.steam.forEach((s, i) => { const k = (T * 0.6 + i / 3) % 1; s.position.y = 0.05 + k * 0.18; s.material.opacity = 0.5 * (1 - k); }); };
  });
  def('new_c_01', 0.95, () => HUM(3.5), (m, c, d) => { // 豆腐小僧：濃紺の筒袖の細身の小坊主、竹籠を浅く被る、四角い盆に乳白色の豆腐
    const R = d.R; hum(m, d, { skin: 0xf0d8c0, cloth: 0x1e2a4a, chest: 0.1, armLen: d.T * 0.85, armR: 0.035, sleeve: 0x1e2a4a, hand: 0.03, legR: 0.035, legCol: 0x1e2a4a, foot: [0.07, 0.03, 0.1], footCol: 0x8a6a4a });
    for (const s of [-1, 1]) dot(m.head, R * 0.09, s * R * 0.3, 0, R * 0.9);
    const kg = C(m.head, R * 1.5, R * 1.0, R * 0.45, 0xc8a868, 0, R * 0.8, 0, null, 12); for (let i = 0; i < 3; i++) TOR(m.head, R * (1.05 + i * 0.2), 0.006, 0x8a6a3a, 0, R * (0.6 + i * 0.18), 0, Math.PI / 2);
    const tray = G(m.armR, 0, -d.T * 0.85, 0.1); B(tray, 0.16, 0.015, 0.16, 0x5a3a22, 0, 0, 0); B(tray, 0.08, 0.06, 0.08, 0xf8f6ee, 0, 0.04, 0);
    m.armR.rotation.x = -1.2;
  });
  def('new_c_08', 1.15, () => QUAD(0.36, 0.22), (m, c, d) => { // 麒麟：黒檀色の細い鹿の胴、青磁色の小さな鱗、短い一本角、長く細い尾、背の金属質の毛が環になって光る
    const hd = quad(m, d, { len: 0.6, bw: 0.22, col: 0x2a1e1a, headR: 0.12, snout: 0.7, ears: 'pt', legR: 0.025, eyeGlow: 0xa8e0c8, paw: 0.035, neckY: 0.26, tail: { n: 1, len: 0.45, w: 0.012, col: 0x2a1e1a, tip: 0x8ac8b0, lift: -0.3 } });
    C(m.body, 0.04, 0.05, 0.22, 0x2a1e1a, 0, 0.14, 0.27).rotation.x = 0.5; K(hd, 0.022, 0.12, 0xd8c070, 0, 0.17, 0).rotation.x = -0.3;
    for (let i = 0; i < 10; i++) S(m.body, 0.025, 0x7ab8a8, (i % 2 - 0.5) * 0.14, -0.02 + (i % 3) * 0.03, (i / 10 - 0.5) * 0.45, 1, 0.4, 1);
    const rg = G(m.body, 0, 0.18, 0); m.extra.ring = rg; for (let i = 0; i < 3; i++) TOR(rg, 0.06 + i * 0.012, 0.006, E(0xd8c070, 0.9), 0, 0, (i - 1) * 0.15, 0);
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.ring.rotation.z = T; };
  });
  def('new_b_01', 1.25, () => HUM(5), (m, c, d) => { // 産女：灰桃の布を重ねた輪郭の曖昧な女性の霊、腕の中に小さな光の包み、足元に淡い水紋
    const R = d.R, cl = TR(0xc8a8ac, { opacity: 0.8 }); hum(m, d, { skin: 0xd8c8c8, cloth: 0xc8a8ac, robe: true, robeW: 0.17, robeLong: 1.0, armLen: d.T * 0.8, armR: 0.035, sleeve: 0xc8a8ac, hand: 0.03, noLegs: true });
    S(m.head, R * 1.08, cl, 0, R * 0.05, -R * 0.05);
    const bn = S(m.torso, 0.09, E(0xfff0d0, 1.2), 0, d.T * 0.55, 0.14); m.extra.bundle = bn;
    const rp = G(m.root, 0, 0.012, 0); m.extra.rip = rp; for (let i = 0; i < 3; i++) TOR(rp, 0.2 + i * 0.12, 0.008, TR(0xa8d0e8, { opacity: 0.5 }), 0, 0, 0, Math.PI / 2);
    m.armL.rotation.x = -0.9; m.armR.rotation.x = -0.9;
    m.extra.anim = (m, P, a, T) => { m.extra.rip.children.forEach((r, i) => { const k = (T * 0.4 + i / 3) % 1; r.scale.setScalar(0.6 + k); r.material.opacity = 0.5 * (1 - k); }); };
  });
  def('new_b_08', 1.1, () => QUAD(0.24, 0.32), (m, c, d) => { // 白澤：淡い青灰色のずんぐりした四足獣、額に縦の三つ目、頬の長い毛が筆のよう、背に藁紙の小札と光の文字
    const hd = quad(m, d, { len: 0.62, bw: 0.42, col: 0xa8b4c0, headR: 0.17, snout: 0.25, ears: 'half', legR: 0.06, eyeCol: 0x1a2a3a, paw: 0.07, tail: { n: 1, len: 0.2, w: 0.06, col: 0xa8b4c0, puff: true } });
    for (let i = 0; i < 3; i++) glowEye(hd, 0.022, 0, 0.06 + i * 0.045, 0.15, 0xffe8a0);
    for (const s of [-1, 1]) { const b = C(hd, 0.03, 0.005, 0.2, 0xd8dce0, s * 0.13, -0.12, 0.08); b.rotation.z = s * 0.15; }
    const tg = G(m.body, 0, 0.17, 0); for (let i = 0; i < 4; i++) { const p = PL(tg, 0.05, 0.12, 0xe8dcc0, (i - 1.5) * 0.07, 0.06, (i % 2 - 0.5) * 0.1); }
    const lt = G(m.body, 0, 0.32, 0); m.extra.lt = lt; for (let i = 0; i < 3; i++) B(lt, 0.03, 0.04, 0.005, E(0xffe8a0, 1.5), (i - 1) * 0.06, 0, 0);
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.lt.position.y = 0.32 + Math.sin(T * 2) * 0.03; m.extra.lt.rotation.y = T * 0.8; };
  });
  def('new_a_01', 1.25, () => HUM(5), (m, c, d) => { // 龍女：鈍い銅色の鱗の細身の水の女性、髪はなく額から後ろへ薄い鰭、灰青の長い布を腕に巻く、掌から円形の水面
    const R = d.R; hum(m, d, { skin: 0xa8784a, cloth: 0x5a6a7a, chest: 0.09, armLen: d.T * 0.9, armR: 0.03, sleeve: 0x7a8a9a, hand: 0.03, handCol: 0xa8784a, legR: 0.035, legCol: 0xa8784a, foot: [0.06, 0.025, 0.1] });
    const fn = PL(m.head, R * 0.3, R * 1.6, TR(0x8ab8c8, { opacity: 0.7, side: THREE.DoubleSide }), 0, R * 0.6, -R * 0.5); fn.rotation.set(-0.9, Math.PI / 2, 0);
    for (const s of [-1, 1]) dot(m.head, R * 0.1, s * R * 0.3, 0, R * 0.9, 0x2a3a48);
    C(m.torso, 0.1, 0.16, d.T * 0.6, 0x5a6a7a, 0, d.T * 0.05, 0, null, 12);
    const wv = TOR(m.armR, 0.08, 0.01, TR(0x8ac8e8, { opacity: 0.7 }), 0, -d.T * 0.9 - 0.02, 0.05, Math.PI / 2); m.extra.wv = wv;
    m.extra.anim = (m, P, a, T) => { m.extra.wv.scale.setScalar(1 + Math.sin(T * 3) * 0.15); };
  });
  def('new_a_08', 0.85, () => ({ legH: 0.2, headY: 0.75, shX: 0.2, shY: 0.45, hipX: 0.08, R: 0.15, T: 0.45 }), (m) => { // 木霊〈実守〉：胡桃の殻のような丸い木の体、細い根の四本脚、背中の割れ目に小さな木の実、目は深い二つの穴
    const sh = S(m.torso, 0.27, 0x8a6a42, 0, 0.27, 0, 1, 1.05, 0.95); for (let i = 0; i < 8; i++) TOR(m.torso, 0.27, 0.008, 0x6a4a2a, 0, 0.27, 0, 0).rotation.set(0, i * 0.4, Math.PI / 2);
    for (const s of [-1, 1]) dot(m.torso, 0.035, s * 0.09, 0.33, 0.25, 0x0a0604);
    B(m.torso, 0.05, 0.25, 0.04, 0x2a1a0a, 0, 0.3, -0.25); for (let i = 0; i < 4; i++) S(m.torso, 0.025, 0xc8883a, 0, 0.2 + i * 0.05, -0.25);
    const roots = []; for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const g = G(m.body, x * 0.13, 0.05, z * 0.12); const r = CAP(g, 0.022, 0.18, 0x5a3a22, x * 0.04, -0.1, 0); r.rotation.z = x * 0.4; roots.push(g); } m.extra.roots = roots;
    for (const g of [m.armL, m.armR]) { C(g, 0.018, 0.012, 0.2, 0x5a3a22, 0, -0.1, 0); }
    m.extra.anim = (m, P, a, T) => { const ph = m.walkPh || 0, mv = a.moving ? 0.6 : 0; m.extra.roots.forEach((g, i) => g.rotation.x = Math.sin(ph + i * Math.PI / 2) * mv); };
  });
  def('new_s_01', 0.9, () => QUAD(0.32, 0.2), (m, c, d) => { // 白狐：乳白と灰茶のまだらの小さな狐、長い脚、一本の細い尾、左右で形の違う耳、石の小片を三つ浮かべ、足元から癒やしの光
    const hd = quad(m, d, { len: 0.48, bw: 0.2, col: 0xf2eee4, headR: 0.12, snout: 0.9, ears: 'none', legR: 0.022, eyeCol: 0x2a2018, tail: { n: 1, len: 0.42, w: 0.02, col: 0xf2eee4, tip: 0x9a8a6a, lift: -0.1 } });
    const e1 = K(hd, 0.045, 0.14, 0xf2eee4, -0.07, 0.13, -0.01); e1.rotation.z = 0.3; const e2 = S(hd, 0.05, 0x9a8a6a, 0.08, 0.1, -0.01, 0.6, 1.2, 0.4);
    spots(m.body, 6, 0.05, 0x9a8a6a, 0.08, 0.08, 0.2, 0.03, 11);
    const orb = G(m.root, 0, 0.62, 0); m.extra.orb = orb; for (let i = 0; i < 3; i++) DOD(orb, 0.035, 0x8a8a84, Math.cos(i * 2.1) * 0.25, 0, Math.sin(i * 2.1) * 0.25);
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), L(0xd8ffe0, { emissive: 0x6ad08a, emissiveIntensity: 0.6, transparent: true, opacity: 0.4, depthWrite: false })); hl.rotation.x = -Math.PI / 2; hl.position.y = 0.012; m.root.add(hl);
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.orb.rotation.y = T * 1.4; };
  });
  def('new_s_08', 1.05, () => QUAD(0.24, 0.32), (m, c, d) => { // 獏：短い鼻と丸い背中の黒褐色の四足獣、背に白い点、鼻先から琥珀の小さな泡
    const hd = quad(m, d, { len: 0.62, bw: 0.4, col: 0x3a2a22, headR: 0.15, snout: 0.6, snoutCol: 0x3a2a22, ears: 'half', legR: 0.055, eyeCol: 0x0a0604, paw: 0.06, tail: { n: 1, len: 0.08, w: 0.02, col: 0x3a2a22, lift: 0.8 } });
    for (let i = 0; i < 9; i++) S(m.body, 0.022, 0xf2f0ea, Math.sin(i * 2.4) * 0.12, 0.13 + (i % 2) * 0.02, (i / 9 - 0.5) * 0.45);
    const bb = G(hd, 0, -0.04, 0.28); m.extra.bub = bb; for (let i = 0; i < 4; i++) S(bb, 0.02, TR(0xffc04a, { opacity: 0.7, emissive: 0xa06010, emissiveIntensity: 0.6 }), 0, 0, 0);
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.bub.children.forEach((b, i) => { const k = (T * 0.5 + i / 4) % 1; b.position.set(Math.sin(i * 3) * 0.05 * k, k * 0.12, 0.2 * (1 - k)); }); };
  });

  /* =============================== レンジャー =============================== */
  def('new_d_07', 1.0, () => FLOAT(0.35), (m) => { // 夢の精霊：紺色の薄い輪が三層、顔なし、中央に閉じた瞼のような銀の裂け目、枕形の石が回る
    const rs = G(m.torso, 0, 0.25, 0); m.extra.rings = rs; for (let i = 0; i < 3; i++) TOR(rs, 0.22 + i * 0.05, 0.022, L(0x1e2a5a, { emissive: 0x0a1030, emissiveIntensity: 0.5 }), 0, (i - 1) * 0.05, 0, 0).rotation.y = i * 0.5;
    const sl = B(m.torso, 0.14, 0.018, 0.01, E(0xd8dce8, 1.0), 0, 0.25, 0.02); m.extra.slit = sl;
    const pv = G(m.torso, 0, 0.25, 0); m.extra.pv = pv; for (let i = 0; i < 4; i++) { const p = S(pv, 0.05, 0x8a8aa0, Math.cos(i * Math.PI / 2) * 0.42, 0, Math.sin(i * Math.PI / 2) * 0.42, 1.4, 0.6, 0.9); }
    m.armR.position.set(0, 0.6, 0.1);
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 1.6 + a.slot) * 0.03; m.extra.rings.children.forEach((r, i) => r.rotation.x = T * (0.4 + i * 0.25)); m.extra.pv.rotation.y = T * 0.9; m.extra.slit.scale.y = Math.sin(T * 0.7) > 0.95 ? 3 : 1; };
  });
  def('new_d_10', 1.2, () => HUM(4.5), (m, c, d) => { // 鬼女：灰色の肌と短い銀髪の痩せた女鬼、片側だけ伸びた小さな角、焦げ茶の麻衣、長い指、指先に影の輪
    const R = d.R; hum(m, d, { skin: 0x9a9a9c, cloth: 0x4a3222, chest: 0.09, hair: 'short', hairCol: 0xd8dce4, armLen: d.T * 0.95, armR: 0.03, sleeve: 0x4a3222, hand: 0, legR: 0.035, legCol: 0x4a3222 });
    K(m.head, R * 0.12, R * 0.5, 0xe8e0d0, R * 0.55, R * 0.85, 0).rotation.z = -0.4; for (const s of [-1, 1]) dot(m.head, R * 0.09, s * R * 0.3, 0, R * 0.9, 0x2a0a0a);
    C(m.torso, 0.1, 0.16, d.T * 0.5, 0x4a3222, 0, d.T * 0.0, 0, null, 10);
    for (const g of [m.armL, m.armR]) { for (let i = 0; i < 4; i++) { const f = C(g, 0.005, 0.004, 0.12, 0x9a9a9c, (i - 1.5) * 0.012, -d.T * 0.95 - 0.06, 0); } TOR(g, 0.04, 0.008, TR(0x1a1020, { opacity: 0.7 }), 0, -d.T * 0.95 - 0.13, 0, Math.PI / 2); }
  });
  def('new_c_07', 1.0, () => HUM(3.5), (m, c, d) => { // 手長：丸い顔と短い胴、地面へ届く二本の長い腕、黄土色の肌、灰色の腰布だけ。歩くと両腕で弓形の輪
    const R = d.R; hum(m, d, { skin: 0xc8a050, cloth: 0xc8a050, chest: 0.12, armLen: 1.15, armR: 0.03, hand: 0.045, legR: 0.045, foot: [0.08, 0.03, 0.11] });
    for (const s of [-1, 1]) dot(m.head, R * 0.09, s * R * 0.3, 0, R * 0.92); B(m.head, R * 0.4, R * 0.06, 0.02, 0x6a3a2a, 0, -R * 0.4, R * 0.92);
    C(m.torso, 0.13, 0.14, d.T * 0.35, 0x8a8a8c, 0, d.T * 0.1, 0, null, 10);
    m.extra.anim = (m, P, a, T) => { if (!a.act) { const sw = a.moving ? Math.sin(m.walkPh || 0) : 0; m.armL.rotation.z = -0.35 - Math.abs(sw) * 0.3; m.armR.rotation.z = 0.35 + Math.abs(sw) * 0.3; } };
  });
  def('new_c_10', 1.2, () => HUM(4), (m, c, d) => { // 青坊主：青磁色のつるりとした頭、墨色の長い法衣、額に小さな窪み、点のように小さい目、衣の内から雷光の糸
    const R = d.R; hum(m, d, { skin: 0x7ab0a0, cloth: 0x1a1a20, robe: true, robeW: 0.2, robeLong: 0.95, armLen: d.T * 0.85, armR: 0.045, sleeve: 0x1a1a20, hand: 0.035, noLegs: true });
    S(m.head, R * 0.15, 0x5a8a7a, 0, R * 0.5, R * 0.78, 1, 0.6, 0.5); for (const s of [-1, 1]) dot(m.head, R * 0.05, s * R * 0.3, 0, R * 0.95);
    const th = G(m.torso, 0, 0, 0); m.extra.th = th; for (let i = 0; i < 4; i++) { const b = C(th, 0.004, 0.004, 0.3, E(0xa8d8ff, 1.5), Math.cos(i * 1.6) * 0.15, d.T * 0.3, Math.sin(i * 1.6) * 0.15); b.rotation.z = i; }
    m.extra.anim = (m, P, a, T) => { m.extra.th.visible = Math.sin(T * 9) > 0; };
  });
  def('new_b_07', 1.1, () => FLOAT(0.55), (m) => { // 赤舌：黒い雨雲の塊の下に大きな朱色の舌、雲の前面に二つの銅色の小眼、舌先から土の塊を落とす
    const cl = G(m.torso, 0, 0.1, 0); for (let i = 0; i < 9; i++) S(cl, 0.12 + (i % 3) * 0.03, 0x1a1a22, Math.cos(i * 0.9) * 0.22, Math.sin(i * 1.7) * 0.05, Math.sin(i * 0.9) * 0.12);
    for (const s of [-1, 1]) glowEye(cl, 0.025, s * 0.09, 0.02, 0.2, 0xc8783a);
    const tg = G(m.armR, 0, 0, 0); m.armR.position.set(0, 0.62, 0.05); const t1 = B(tg, 0.14, 0.32, 0.03, 0xd8402a, 0, -0.16, 0); S(tg, 0.07, 0xd8402a, 0, -0.32, 0, 1, 0.6, 0.4);
    const cl2 = S(m.root, 0.03, 0x6a4a2a, 0, 0.3, 0.05); m.extra.clod = cl2;
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 1.5 + a.slot) * 0.03; const k = (T * 0.7) % 1; m.extra.clod.position.y = 0.3 * (1 - k * k); m.extra.clod.visible = k < 0.95; };
  });
  def('new_b_10', 0.8, () => FLOAT(0.35), (m) => { // 人魂：内側に黒い穴のある琥珀色の浮遊火、短い尾、下端から細い灰
    const fl = S(m.torso, 0.2, E(0xffa830, 1.3), 0, 0.2, 0, 1, 1.15, 1); m.extra.fl = fl;
    for (let i = 0; i < 4; i++) S(m.torso, 0.035, 0x1a0e04, Math.cos(i * 1.6) * 0.1, 0.22 + Math.sin(i * 2.3) * 0.07, 0.17);
    K(m.torso, 0.1, 0.18, E(0xff8a20, 1.0), 0, 0.42, -0.06).rotation.x = -0.6;
    const ash = G(m.torso, 0, 0, 0); m.extra.ash = ash; for (let i = 0; i < 4; i++) S(ash, 0.01, 0x8a8a8a, (i - 1.5) * 0.03, 0, 0);
    m.armR.position.set(0, 0.5, 0.1);
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 2.6 + a.slot) * 0.03; m.extra.fl.scale.set(1 + Math.sin(T * 9) * 0.05, 1.15 + Math.sin(T * 11) * 0.07, 1); m.extra.ash.children.forEach((s, i) => { const k = (T * 0.8 + i / 4) % 1; s.position.y = -k * 0.25; }); };
  });
  def('new_a_07', 1.35, () => HUM(5), (m, c, d) => { // 山男：苔色の毛の大柄な山の住人、小さな目と平たい鼻、肩から伸びる枝状の硬い毛、長い腕、両手で風をすくう
    const R = d.R, mo = 0x4a6a32; hum(m, d, { skin: mo, cloth: mo, chest: 0.14, armLen: d.T * 1.2, armR: 0.05, hand: 0.06, legR: 0.06, foot: [0.1, 0.04, 0.13], footCol: 0x3a4a22, headScale: [0.9, 1, 0.9] });
    for (const s of [-1, 1]) dot(m.head, R * 0.08, s * R * 0.28, R * 0.1, R * 0.88); S(m.head, R * 0.2, 0x3a5222, 0, -R * 0.15, R * 0.85, 1.3, 0.6, 0.6);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const b = C(m.torso, 0.01, 0.006, 0.2, 0x5a4a2a, s * (0.14 + i * 0.03), d.T + 0.06, 0); b.rotation.z = -s * (0.6 + i * 0.3); }
  });
  def('new_a_10', 0.85, () => QUAD(0.14, 0.24), (m, c, d) => { // 鉄鼠：黒鉄色の硬い毛の低い姿勢の大鼠、半円の小さな耳、銅色の板状の歯、背に古い釘のような毛、細い尾（胴長の1.2倍）
    const hd = quad(m, d, { len: 0.62, bw: 0.32, col: 0x2a2c30, headR: 0.13, snout: 0.8, ears: 'half', legR: 0.035, eyeGlow: 0xd04030, paw: 0.05, tail: { n: 1, len: 0.75, w: 0.012, col: 0x6a5a5a, lift: -0.15 } });
    B(hd, 0.05, 0.05, 0.015, 0xc8783a, 0, -0.08, 0.22);
    for (let i = 0; i < 12; i++) { const n = C(m.body, 0.008, 0.002, 0.1, 0x6a6064, (i % 3 - 1) * 0.07, 0.14, (i / 12 - 0.5) * 0.55); n.rotation.x = -0.4; }
  });
  def('new_s_07', 1.2, () => Object.assign(HUM(4), { legH: 0.24 }), (m, c, d) => { // 覚：灰白の長い毛と細い四肢の猿に似た山の怪、目は前髪の下、胸の毛が渦状、掌から墨の粒
    const R = d.R, wh = 0xd8d6d0; hum(m, d, { skin: wh, cloth: wh, chest: 0.1, armLen: d.T * 1.15, armR: 0.03, hand: 0.035, legR: 0.03, foot: [0.07, 0.03, 0.1] });
    B(m.head, R * 1.8, R * 0.7, R * 0.4, 0xc8c6c0, 0, R * 0.25, R * 0.7); B(m.head, R * 0.6, R * 0.04, 0.02, 0x3a3a3a, 0, -R * 0.45, R * 0.9);
    const sw = TOR(m.torso, 0.06, 0.01, 0xa8a6a0, 0, d.T * 0.6, 0.1, 0); TOR(m.torso, 0.035, 0.01, 0xa8a6a0, 0, d.T * 0.6, 0.11, 0);
    const ink = G(m.armR, 0, -d.T * 1.15, 0.03); m.extra.ink = ink; for (let i = 0; i < 4; i++) S(ink, 0.012, 0x0a0a0e, 0, 0, 0);
    m.extra.anim = (m, P, a, T) => { m.body.rotation.x += 0.2; m.extra.ink.children.forEach((s, i) => { const k = (T * 0.9 + i / 4) % 1; s.position.set(Math.cos(i * 1.7) * k * 0.12, -k * 0.05, Math.sin(i * 1.7) * k * 0.12); }); };
  });
  def('new_s_10', 1.0, () => ({ legH: 0.22, headY: 0.4, shX: 0.2, shY: 0.3, hipX: 0.06, R: 0.1, T: 0.2 }), (m) => { // 土蜘蛛：岩粒の茶褐色の大蜘蛛、平たい円盤の腹、前方の小さな六眼、八本脚の先に銅色の環、環の間に薄い糸
    const rk = 0x6a4a32; C(m.body, 0.24, 0.26, 0.12, rk, 0, 0.04, -0.12, null, 16); spots(m.body, 10, 0.04, 0x4a3222, 0.2, 0.04, 0.2, 0.06, 13);
    const hd = S(m.body, 0.12, rk, 0, 0.04, 0.17, 1, 0.8, 1); for (let i = 0; i < 6; i++) glowEye(m.body, 0.016, (i % 3 - 1) * 0.04, 0.08 + (i > 2 ? 0.03 : 0), 0.28, 0xd04a3a);
    const legs = []; for (let i = 0; i < 8; i++) { const s = i < 4 ? -1 : 1, k = i % 4; const g = G(m.body, s * 0.12, 0.04, 0.12 - k * 0.1); g.rotation.y = s * (0.4 + k * 0.35) * -1 + (s > 0 ? 0 : Math.PI); const u = C(g, 0.022, 0.018, 0.3, rk, 0.15, 0.08, 0); u.rotation.z = -1.0; const lw = C(g, 0.016, 0.01, 0.32, rk, 0.33, -0.08, 0); lw.rotation.z = 0.5; TOR(g, 0.022, 0.008, 0xc8783a, 0.4, -0.22, 0, Math.PI / 2); legs.push(g); }
    m.extra.legs8 = legs; const web = PL(m.body, 0.6, 0.2, TR(0xf0f0f0, { opacity: 0.18, side: THREE.DoubleSide }), 0, -0.12, 0); web.rotation.x = -Math.PI / 2;
    for (const g of [m.armL, m.armR]) { const f = C(g, 0.02, 0.012, 0.2, rk, 0, -0.1, 0); } m.armL.position.set(-0.07, 0.3, 0.25); m.armR.position.set(0.07, 0.3, 0.25);
    m.extra.anim = (m, P, a, T) => { const ph = (m.walkPh || 0) * 1.4, mv = a.moving ? 0.25 : 0.03; m.extra.legs8.forEach((g, i) => g.rotation.x = Math.sin(ph + i * 1.3) * mv); };
  });

  /* =============================== タンク =============================== */
  def('new_d_04', 1.35, () => HUM(4), (m, c, d) => { // 酒呑童子：墨色の肌に銅色の短い角の重い鬼、白木の小樽を背負う、両腕を太い縄で巻く、灰青の短い袴
    const R = d.R, sk = 0x2a2830; hum(m, d, { skin: sk, cloth: sk, chest: 0.18, armLen: d.T * 1.0, armR: 0.07, hand: 0.08, legR: 0.07, legCol: 0x5a6a7a, foot: [0.12, 0.05, 0.15], footCol: sk, headScale: [0.95, 0.9, 0.95] });
    for (const s of [-1, 1]) { K(m.head, R * 0.15, R * 0.45, 0xc8783a, s * R * 0.45, R * 0.95, 0).rotation.z = -s * 0.2; dot(m.head, R * 0.12, s * R * 0.32, R * 0.05, R * 0.85, 0xd0a040); }
    C(m.torso, 0.18, 0.22, d.legH * 0.7, 0x5a6a7a, 0, -d.legH * 0.15, 0, null, 12);
    const br = C(m.torso, 0.11, 0.11, 0.24, 0xe8dcc0, 0, d.T * 0.6, -0.2, null, 12); TOR(m.torso, 0.112, 0.012, 0x8a6a3a, 0, d.T * 0.5, -0.2, Math.PI / 2); TOR(m.torso, 0.112, 0.012, 0x8a6a3a, 0, d.T * 0.7, -0.2, Math.PI / 2);
    for (const g of [m.armL, m.armR]) for (let i = 0; i < 5; i++) TOR(g, 0.074, 0.016, 0xb8a070, 0, -0.08 - i * 0.07, 0, Math.PI / 2);
  });
  def('new_d_09', 1.1, () => FLOAT(0.1), (m) => { // 片輪車：赤茶の木の大車輪を横向きに浮かべ、内側に一つの石面、外周に青銅の帯、接地面だけに短い火
    const wh = G(m.torso, 0, 0.4, 0); m.extra.wh = wh; const wd = 0x8a4a2a;
    TOR(wh, 0.38, 0.05, wd, 0, 0, 0, 0).rotation.y = Math.PI / 2; TOR(wh, 0.42, 0.015, 0x6a8a6a, 0, 0, 0, 0).rotation.y = Math.PI / 2;
    for (let i = 0; i < 8; i++) { const sp = C(wh, 0.016, 0.016, 0.72, wd, 0, 0, 0); sp.rotation.x = i * Math.PI / 8; }
    const fc = G(m.torso, 0, 0.4, 0); S(fc, 0.13, 0x8a8a84, 0, 0, 0, 0.6, 1, 1); for (const s of [-1, 1]) { dot(fc, 0.02, 0.07, 0.04, s * 0.05); } B(fc, 0.02, 0.02, 0.08, 0x2a2a2a, 0.075, -0.05, 0);
    const fire = K(m.root, 0.08, 0.14, E(0xff6a20, 1.4), 0, 0.06, 0); m.extra.fire = fire;
    m.armR.position.set(0, 0.5, 0.1);
    m.extra.anim = (m, P, a, T) => { m.extra.wh.rotation.x = -(m.walkPh || 0) * 0.5 - T * 0.4; m.extra.fire.scale.y = 0.6 + Math.abs(Math.sin(T * 13)) * 0.6; m.extra.fire.visible = a.moving || Math.sin(T * 4) > 0; };
  });
  def('new_c_04', 1.3, () => ({ legH: 0.05, headY: 0.85, shX: 0.22, shY: 0.6, hipX: 0.06, R: 0.15, T: 0.6 }), (m) => { // 海坊主：海水が丸い頭と長い柱状の胴へまとまる、半透明の灰緑、顔は小さな二つの穴、肩から波が垂れ、海藻の帯
    const wt = TR(0x6a8a7a, { opacity: 0.72, emissive: 0x1a2a24, emissiveIntensity: 0.3 });
    C(m.torso, 0.17, 0.22, 0.7, wt, 0, 0.32, 0, null, 16); S(m.head, 0.19, wt, 0, 0.02, 0); for (const s of [-1, 1]) dot(m.head, 0.025, s * 0.06, 0.03, 0.17, 0x0a1210);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const w = S(m.torso, 0.06, wt, Math.cos(a) * 0.18, 0.62 - (i % 2) * 0.05, Math.sin(a) * 0.18, 1, 1.6, 1); }
    TOR(m.torso, 0.2, 0.025, 0x2a4a22, 0, 0.3, 0, Math.PI / 2);
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.36, 22), TR(0x5a8a8a, { opacity: 0.5 })); pud.rotation.x = -Math.PI / 2; pud.position.y = 0.012; m.root.add(pud); m.extra.pud = pud;
    for (const g of [m.armL, m.armR]) { C(g, 0.06, 0.04, 0.4, wt, 0, -0.2, 0); S(g, 0.06, wt, 0, -0.42, 0); }
    m.extra.anim = (m, P, a, T) => { m.extra.pud.scale.setScalar(1 + Math.sin(T * 2) * 0.06); };
  });
  def('new_c_09', 1.3, () => QUAD(0.16, 0.32), (m, c, d) => { // 牛鬼：太い角の牛の頭、六本の短い石脚、青錆色の甲羅、腹側に生成りの長い毛
    const hd = quad(m, d, { len: 0.62, bw: 0.48, col: 0x3a5a52, belly: 0xe8dcc0, headR: 0.17, snout: 0.35, ears: 'flat', legR: 0.06, legCol: 0x7a7a74, eyeGlow: 0xd04a2a, paw: 0.07, tail: null });
    for (const s of [-1, 1]) { const h = CAP(hd, 0.035, 0.22, 0xe8dcc0, s * 0.2, 0.12, 0); h.rotation.z = -s * 1.1; }
    for (let i = 0; i < 6; i++) { const p = S(m.body, 0.12, 0x2a4a42, (i % 2 - 0.5) * 0.2, 0.1, (Math.floor(i / 2) - 1) * 0.18, 1, 0.4, 1); }
    for (const s of [-1, 1]) { const g = G(m.body, s * 0.16, -0.08, 0); leg(g, d.legLen + 0.12, 0.05, 0x7a7a74, [0.07, 0.035, 0.09]); m.extra.qlegs.push(g); }
    for (let i = 0; i < 8; i++) C(m.body, 0.01, 0.005, 0.16, 0xe8dcc0, (i - 3.5) * 0.05, -0.2, 0.05);
  });
  def('new_b_04', 1.25, () => ({ legH: 0.1, headY: 0.9, shX: 0.25, shY: 0.7, hipX: 0.06, R: 0.15, T: 0.75 }), (m) => { // 塗壁：灰茶の土壁が屏風のように三枚、顔や腕はなく中央に細い光のひび、足元の小石が転がって運ぶ
    const wl = 0x8a7a64, pn = [];
    for (const [x, ry] of [[-0.3, 0.5], [0, 0], [0.3, -0.5]]) { const g = G(m.torso, x, 0, 0); g.rotation.y = ry; const b = B(g, 0.3, 0.85, 0.07, wl, 0, 0.4, 0); spots(g, 4, 0.03, 0x6a5a48, 0.1, 0.8, 0.02, 0, 3); pn.push(g); }
    pn[0].position.z = -0.08; pn[2].position.z = -0.08;
    const ck = B(m.torso, 0.012, 0.6, 0.075, E(0xffe8a0, 1.4), 0.02, 0.42, 0); ck.rotation.z = 0.15;
    const pb = G(m.body, 0, -0.06, 0); m.extra.pb = pb; for (let i = 0; i < 6; i++) S(pb, 0.04, 0x9a9a92, (i - 2.5) * 0.12, 0, 0.02);
    for (const g of [m.armL, m.armR]) { } m.extra.panels3 = pn;
    m.extra.anim = (m, P, a, T, dt, act) => { m.extra.pb.children.forEach(s => s.rotation.x -= a.moving ? dt * 8 : 0); const push = Math.max(0, -P.aRx) / 1.8; m.extra.panels3[1].position.z = push * 0.15; };
  });
  def('new_b_09', 1.3, () => Object.assign(HUM(5), { legH: 0.3 }), (m, c, d) => { // 亡者：麻布の細長い帯が人の輪郭だけを空中に縫い留めた霊、顔は空洞、胸に赤銅の鈴、両袖を盾のように広げる、脚は二本の布へほどける
    const R = d.R, lin = L(0xd8cfb8, { side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = PL(m.torso, 0.05, d.T, lin, Math.cos(a) * 0.12, d.T * 0.5, Math.sin(a) * 0.1); p.rotation.y = -a + Math.PI / 2; }
    TOR(m.head, R * 0.9, 0.02, 0xd8cfb8, 0, 0, 0, 0); TOR(m.head, R * 0.9, 0.02, 0xd8cfb8, 0, 0, 0, Math.PI / 2); S(m.head, R * 0.5, 0x0a0a0c, 0, 0, R * 0.3, 1, 1.2, 0.3);
    S(m.torso, 0.035, 0xb8683a, 0, d.T * 0.7, 0.12);
    for (const g of [m.armL, m.armR]) { const sl = PL(g, 0.22, d.T * 0.9, lin, 0, -d.T * 0.45, 0.04); }
    for (const g of [m.legL, m.legR]) { const st = PL(g, 0.06, d.legH + 0.05, lin, 0, -d.legH / 2, 0); }
    m.extra.anim = (m, P, a, T) => { m.body.position.y += Math.sin(T * 1.7 + a.slot) * 0.02; m.legL.rotation.x += Math.sin(T * 3) * 0.2; m.legR.rotation.x -= Math.sin(T * 3) * 0.2; };
  });
  def('new_a_04', 1.3, () => HUM(4.5), (m, c, d) => { // 茨木童子：黄土色の肌と短い白角の片腕の鬼、失った腕の代わりに浮かぶ小岩が掌を作る、深緑の短い衣、短い髪
    const R = d.R, sk = 0xc8a050; hum(m, d, { skin: sk, cloth: 0x2a4a32, chest: 0.15, hair: 'short', hairCol: 0x2a1a10, armLen: d.T * 1.0, armR: 0.06, hand: 0.07, legR: 0.06, legCol: sk, foot: [0.11, 0.04, 0.14] });
    for (const s of [-1, 1]) { K(m.head, R * 0.12, R * 0.35, 0xf2f0ea, s * R * 0.4, R * 0.95, 0); dot(m.head, R * 0.1, s * R * 0.3, R * 0.05, R * 0.88); }
    m.armL.clear(); const rk = G(m.armL, 0, 0, 0); m.extra.rocks = rk; for (let i = 0; i < 6; i++) DOD(rk, 0.045 + (i % 2) * 0.015, 0x7a7068, (i % 3 - 1) * 0.05, -0.25 - Math.floor(i / 3) * 0.12, 0.02);
    m.extra.anim = (m, P, a, T) => { m.extra.rocks.children.forEach((r, i) => { r.position.y = -0.25 - Math.floor(i / 3) * 0.12 + Math.sin(T * 3 + i) * 0.015; r.rotation.y = T + i; }); };
  });
  def('new_a_09', 0.95, () => ({ legH: 0.14, headY: 0.6, shX: 0.25, shY: 0.4, hipX: 0.08, R: 0.15, T: 0.4 }), (m) => { // 文福茶釜：古い黒銅の丸い茶釜、短い木の脚が四本、蓋の隙間から二つの小眼、注ぎ口から湯気
    const cu = 0x2a2620; S(m.torso, 0.3, cu, 0, 0.22, 0, 1.3, 0.9, 1.3); TOR(m.torso, 0.3, 0.025, 0x4a3e30, 0, 0.3, 0, Math.PI / 2);
    C(m.torso, 0.2, 0.22, 0.05, cu, 0, 0.47, 0, null, 16); S(m.torso, 0.04, 0x4a3e30, 0, 0.52, 0);
    for (const s of [-1, 1]) glowEye(m.torso, 0.022, s * 0.06, 0.44, 0.18, 0xf2e8c8);
    const sp = C(m.torso, 0.03, 0.05, 0.18, cu, 0, 0.3, 0.38); sp.rotation.x = 1.2; const st = G(m.torso, 0, 0.36, 0.48); m.extra.steam = st; for (let i = 0; i < 3; i++) S(st, 0.04, TR(0xf2f2f0, { opacity: 0.5 }), 0, 0, 0);
    for (const g of [m.legL, m.legR]) C(g, 0.03, 0.03, 0.15, 0x7a5a32, 0, -0.07, 0); const bl = []; for (const z of [-1, 1]) for (const x of [-1, 1]) if (z < 0) { const g = G(m.body, x * 0.15, 0, -0.15); C(g, 0.03, 0.03, 0.15, 0x7a5a32, 0, -0.07, 0); bl.push(g); } m.legL.position.z = 0.15; m.legR.position.z = 0.15; m.extra.bl = bl;
    for (const g of [m.armL, m.armR]) { } m.armR.position.set(0, 0.3, 0.2);
    m.extra.anim = (m, P, a, T) => { m.extra.steam.children.forEach((s, i) => { const k = (T * 0.7 + i / 3) % 1; s.position.set(0, k * 0.2, k * 0.08); s.material.opacity = 0.5 * (1 - k); s.scale.setScalar(0.6 + k); }); m.extra.bl.forEach((g, i) => g.rotation.x = -m.legL.rotation.x * (i ? 1 : -1)); };
  });
  def('new_s_04', 1.25, () => ({ legH: 0.05, headY: 0.3, shX: 0.1, shY: 0.2, hipX: 0.05, R: 0.1, T: 0.1 }), (m) => { // 大百足：黒い木片を数珠状につないだ長い百足、節の間だけ鈍い銅色に光る、丸い頭に小眼が二つ
    const hd = serpent(m, { n: 14, r0: 0.085, step: 0.12, taper: 0.3, col: 0x1a1612, legs: 0.13, legCol: 0x2a221a, glowJoint: 0xb8783a, headR: 0.1, wave: 0.07 });
    for (const s of [-1, 1]) glowEye(hd, 0.016, s * 0.045, 0.03, 0.09, 0xd8a04a); for (const s of [-1, 1]) { const f = C(hd, 0.008, 0.004, 0.12, 0x2a221a, s * 0.05, -0.02, 0.12); f.rotation.x = 1.2; f.rotation.z = s * 0.3; }
    m.armR.position.set(0, 0.12, 0.15);
  });
  def('new_s_09', 1.35, () => ({ legH: 0.12, headY: 0.7, shX: 0.2, shY: 0.4, hipX: 0.06, R: 0.15, T: 0.3 }), (m) => { // 八岐大蛇：灰白の太い一つの胴から八本の細い蛇首が扇状、暗い朱色の目、河原石のように平たい鱗、八本の尾
    const sc = 0xb8b4ac; S(m.torso, 0.24, sc, 0, 0.1, -0.05, 1.2, 0.8, 1.3); spots(m.torso, 12, 0.045, 0x9a968e, 0.2, 0.1, 0.25, 0.05, 17);
    const necks = []; for (let i = 0; i < 8; i++) { const a = (i / 7 - 0.5) * 2.4; const g = G(m.torso, Math.sin(a) * 0.16, 0.18, Math.cos(a) * 0.12); g.rotation.set(0.5 - Math.abs(a) * 0.15, a * 0.7, 0);
      for (let k = 0; k < 4; k++) S(g, 0.045 - k * 0.004, sc, 0, k * 0.09, k * 0.04); const h = G(g, 0, 0.36, 0.17); S(h, 0.055, sc, 0, 0, 0, 1, 0.75, 1.4); for (const s of [-1, 1]) dot(h, 0.01, s * 0.03, 0.015, 0.06, 0x8a1a12); necks.push(g); }
    m.extra.necks = necks; for (let i = 0; i < 8; i++) { const a = (i / 7 - 0.5) * 1.6; const t = CAP(m.torso, 0.02, 0.3, sc, Math.sin(a) * 0.3, 0.0, -0.3 - Math.cos(a) * 0.15); t.rotation.set(Math.PI / 2, 0, a); }
    m.armR.position.set(0, 0.5, 0.2);
    m.extra.anim = (m, P, a, T) => { const strike = Math.max(0, -Math.min(P.aRx, P.aLx)); m.extra.necks.forEach((g, i) => { g.rotation.x = 0.5 - Math.abs((i / 7 - 0.5) * 2.4) * 0.15 + Math.sin(T * 2 + i) * 0.12 + strike * 0.25; }); };
  });

  /* ---------- 登録：makeChar から使う。身長は見た目の大きさ（当たり判定は別） ---------- */
  for (const id in V7) if (DATA.CHI[id]) DATA.CHI[id].h = V7[id].h;
})();
