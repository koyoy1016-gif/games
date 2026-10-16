/* =====================================================================
   render_v7.js — 60体の立体モデル（v7 確定仕様の題材を、v8で二足歩行の「かわいい系／かっこいい系」に作り直し）
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

  /* =====================================================================
     v8 キャラデザイン（依頼 2026-10-16）：二足歩行を基本に「かわいい系」「かっこいい系」の二系統へ作り直す
     ・かわいい系：約2.4頭身。丸い頭と胴、大きな黒目（白い光）、頬の赤み、短い手足
     ・かっこいい系：約5.5頭身。肩幅と細い腰、鋭い目（光る目）、刀・杖・鎧・襟巻きなどの装備
     ・名前の題材を一目で分かる特徴にする（狐＝立った人型の狐、大蛇＝人型に蛇がまとわりつく、刀＝刀を持つ侍）
     ・海坊主・雪女・雷の化身・手長・烏天狗・山男は v7 の造形のまま（依頼で「このままでよい」）
     ・幽霊・火・煙などは脚の代わりに裾がほどけて浮く二足型（上半身は人型）
     ===================================================================== */
  const STYLE = GFX.V7_STYLE = {};
  const body0 = (hr, lf, st) => { const R = 0.5 / hr, top = 1 - 2 * R * 0.9, legH = top * lf, T = top - legH; return { legH, headY: 1 - R, shX: st === 'cute' ? 0.15 : 0.135, shY: top - (st === 'cute' ? 0.08 : 0.035), hipX: st === 'cute' ? 0.075 : 0.06, R, T, st }; };
  const CUTE = (hr, lf) => () => body0(hr || 2.4, lf == null ? 0.36 : lf, 'cute');
  const COOL = (hr, lf) => () => body0((hr || 5.5) - 0.6, lf == null ? 0.47 : lf, 'cool'); // 遠くからも顔が読めるよう、指定より少し頭を大きく
  const cute = (id, h, dims, build) => { STYLE[id] = 'cute'; def(id, h, dims, build); };
  const cool = (id, h, dims, build) => { STYLE[id] = 'cool'; def(id, h, dims, build); };
  const ez = (R, x, y, sz) => Math.sqrt(Math.max(0.05, 1 - (x / R) ** 2 - (y / R) ** 2)) * R * (sz || 1); // 頭の表面の前後位置
  const BLADE = () => L(0xdfe5ea, { emissive: 0x303a44, emissiveIntensity: 0.35 });

  /* ---------- 体：胴・腕・脚（o.cloth＝服、o.skin＝肌、o.pants＝腰から下） ---------- */
  function hero(m, d, o) {
    const ct = d.st === 'cute', R = d.R, T = d.T, k = o.bulk || 1, cl = o.cloth || o.skin, skin = o.skin, pants = o.pants || cl;
    m.extra.kit = { float: !!o.noLegs, tails: [], flut: [], sp: o.bobSp || 2.2 };
    if (ct) {
      S(m.torso, 1, cl, 0, T * 0.5, 0, 0.15 * k, T * 0.56, 0.13 * k);
      if (o.belly) S(m.torso, 1, o.belly, 0, T * 0.42, 0.045 * k, 0.105 * k, T * 0.4, 0.095 * k);
    } else {
      S(m.torso, 1, cl, 0, T * 0.7, 0, 0.14 * k, T * 0.32, 0.095 * k);
      C(m.torso, 0.1 * k, 0.085 * k, T * 0.5, o.waist || cl, 0, T * 0.33, 0, null, 12).scale.z = 0.8;
      S(m.torso, 1, pants, 0, T * 0.06, 0, 0.1 * k, 0.07, 0.08 * k);
      if (o.belly) S(m.torso, 1, o.belly, 0, T * 0.66, 0.04 * k, 0.1 * k, T * 0.26, 0.07 * k);
    }
    const fz = ct ? 0.118 * k : 0.088 * k, cy = ct ? T * 0.72 : T * 0.78;
    if (o.collar) for (const s of [-1, 1]) B(m.torso, 0.024, T * (ct ? 0.45 : 0.42), 0.012, o.collar, s * 0.03, cy, fz).rotation.z = -s * 0.55;
    if (o.sash) { const sb = C(m.torso, (ct ? 0.153 : 0.093) * k, (ct ? 0.153 : 0.093) * k, T * 0.13, o.sash, 0, T * (ct ? 0.4 : 0.2), 0, null, 16); sb.scale.z = ct ? 0.87 : 0.82; }
    if (o.skirt) { const hh = d.legH * o.skirt + T * 0.4, sk = K(m.torso, (ct ? 0.17 : 0.15) * k * (o.skirtW || 1), hh, o.skirtCol || cl, 0, -d.legH * o.skirt + hh / 2, 0); sk.geometry = new THREE.ConeGeometry((ct ? 0.17 : 0.15) * k * (o.skirtW || 1), hh, 14); m.extra.skirt = sk; }
    if (o.hakama) { const hh = d.legH * 0.92 + 0.03; K(m.torso, 0.16 * k, hh, o.hakama, 0, -d.legH * 0.92 + hh / 2, 0).geometry = new THREE.ConeGeometry(0.16 * k, hh, 14); }
    if (o.pads) for (const [g, s] of [[m.armL, -1], [m.armR, 1]]) { const p = B(g, 0.12 * k, 0.03, 0.13 * k, o.pads, s * 0.025, 0.01, 0); p.rotation.z = s * 0.35; const p2 = B(g, 0.11 * k, 0.025, 0.12 * k, o.pads2 || o.pads, s * 0.035, -0.035, 0); p2.rotation.z = s * 0.45; }
    if (o.scarf) { TOR(m.torso, (ct ? 0.1 : 0.075) * k, 0.028, o.scarf, 0, T * (ct ? 0.9 : 0.97), 0, Math.PI / 2); const sf = G(m.torso, 0.03, T * (ct ? 0.9 : 0.96), -0.07 * k); for (let i = 0; i < 2; i++) { const p = PL(sf, 0.05, 0.28, o.scarf, i * 0.05 - 0.02, -0.14, -0.01); p.rotation.y = 0.2; } m.extra.kit.flut.push(sf); }
    if (o.cape) { const cp = G(m.torso, 0, T * 0.98, -0.09 * k); const ch = T + d.legH * (o.capeLen || 0.6); PL(cp, 0.28 * k, ch, o.cape, 0, -ch / 2, 0); m.extra.kit.flut.push(cp); }
    // 腕
    const aLen = o.armLen || T * (ct ? 0.62 : 0.95), aR = o.armR || (ct ? 0.045 : 0.034) * Math.sqrt(k), hR = o.hand == null ? (ct ? 0.055 : 0.042) * Math.sqrt(k) : o.hand;
    for (const [g, s] of [[m.armL, -1], [m.armR, 1]]) {
      arm(g, aLen, aR, o.sleeve || cl, hR, o.handCol || skin);
      if (o.sleeves) B(g, (ct ? 0.11 : 0.09) * k, aLen * 0.55, (ct ? 0.13 : 0.11) * k, o.sleeves, s * 0.01, -aLen * 0.38, -0.01);
      if (o.claw) for (const c of [-1, 0, 1]) { const cw = K(g, 0.011, 0.06, o.claw, c * hR * 0.6, -aLen - hR * 1.1, hR * 0.3); cw.rotation.x = Math.PI; }
    }
    m.extra.handY = -aLen;
    // 脚（幽霊・火・煙は裾がほどけて浮く）
    if (o.noLegs) { const tl = K(m.torso, (ct ? 0.14 : 0.12) * k, d.legH * 0.95, o.tailCol || cl, 0, -d.legH * 0.45, 0); tl.rotation.x = Math.PI; m.extra.kit.ghost = tl; }
    else for (const g of [m.legL, m.legR]) {
      CAP(g, (ct ? 0.055 : 0.042) * k, Math.max(0.01, d.legH - (ct ? 0.11 : 0.084) * k), o.legCol || pants, 0, -d.legH / 2, 0);
      const fc = o.footCol || o.legCol || pants;
      if (ct) S(g, 1, fc, 0, -d.legH + 0.03, 0.025, 0.065 * k, 0.04, 0.085 * k);
      else B(g, 0.075 * k, 0.04, 0.13 * k, fc, 0, -d.legH + 0.02, 0.025);
      if (o.geta) B(g, 0.08 * k, 0.025, 0.14 * k, 0x8a6a42, 0, -d.legH + 0.0, 0.02);
    }
    m.extra.anim = kitAnim;
    return m.extra.kit;
  }
  function kitAnim(m, P, a, T, dt, act, t) {
    const K = m.extra.kit;
    if (K.float) m.body.position.y += 0.04 + Math.sin(T * K.sp + a.slot) * 0.025;
    if (K.ghost) K.ghost.rotation.z = Math.sin(T * 3 + a.slot) * 0.12;
    const mv = a.moving ? 1 : 0.4;
    K.tails.forEach((g, i) => { g.rotation.y = g.userData.y0 + Math.sin(T * 3 + i * 0.8 + a.slot) * 0.22 * mv; });
    K.flut.forEach((g, i) => { g.rotation.x = 0.15 + (a.moving ? 0.5 : 0.08) + Math.sin(T * (a.moving ? 9 : 3) + i) * 0.08; });
    if (m.extra.more) m.extra.more(m, P, a, T, dt, act, t);
  }

  /* ---------- 頭：人・狐・猫・犬・獅子・猿・鼠・狸・牛・山羊・鹿・獏・蛇など ---------- */
  function face(m, d, h) {
    const hd = m.head, R = d.R, ct = d.st === 'cute', col = h.col, sc = h.scale || [1, 1, 1];
    if (h.shape !== 'none') S(hd, R, col, 0, 0, 0, sc[0], sc[1], sc[2]);
    const fz = (x, y) => h.flatZ != null ? R * h.flatZ : ez(R, x, y, sc[2]);
    const sn = h.snout || 0, ey = h.ey != null ? R * h.ey : sn ? R * 0.14 : ct ? -R * 0.04 : R * 0.04, sep = R * (h.sep || (ct ? 0.38 : 0.34));
    // 鼻先
    if (sn) { const sl = R * sn, k = K(hd, R * (h.snW || 0.4), sl, h.muzzle || col, 0, -R * 0.22, R * 0.78 * sc[2] + sl * 0.35); k.rotation.x = Math.PI / 2; S(hd, R * 0.085, 0x161214, 0, -R * 0.2, R * 0.78 * sc[2] + sl * 0.84); }
    if (h.muzzle && !sn) { S(hd, R * 0.42, h.muzzle, 0, -R * 0.32, R * 0.68 * sc[2], 1.15 * (h.mzW || 1), 0.72, 0.75); if (h.nose !== false) S(hd, R * 0.1, h.noseCol || 0x1a1416, 0, -R * 0.2, R * 0.98 * sc[2]); }
    if (h.cheek) for (const s of [-1, 1]) S(hd, R * 0.3, h.cheek, s * R * 0.62, -R * 0.38, R * 0.45, 1, 0.75, 0.8);
    // 目
    const zz = fz(sep, ey);
    const ek = h.eye || (ct ? 'cute' : 'cool');
    if (ek === 'cute') for (const s of [-1, 1]) { S(hd, R * 0.17, h.eyeCol || 0x18121c, s * sep, ey, zz - R * 0.04, 0.82, 1.08, 0.5); S(hd, R * 0.065, 0xffffff, s * sep + R * 0.045, ey + R * 0.07, zz + R * 0.03); }
    else if (ek === 'cool') for (const s of [-1, 1]) { const e = B(hd, R * 0.3, R * 0.075, R * 0.06, h.glow ? E(h.glow, 1.3) : L(h.eyeCol || 0x141016), s * sep, ey, zz - R * 0.02); e.rotation.set(0, s * 0.35, s * 0.24); if (h.brow !== false) { const b = B(hd, R * 0.32, R * 0.06, R * 0.06, h.browCol || 0x1a1416, s * sep, ey + R * 0.16, zz - R * 0.04); b.rotation.set(0, s * 0.35, s * 0.32); } }
    else if (ek === 'glow') for (const s of [-1, 1]) glowEye(hd, R * 0.13, s * sep, ey, zz - R * 0.04, h.glow || 0xffd27a);
    else if (ek === 'closed') for (const s of [-1, 1]) TOR(hd, R * 0.12, R * 0.025, h.eyeCol || 0x18121c, s * sep, ey, zz, 0, Math.PI).rotation.z = Math.PI;
    else if (ek === 'happy') for (const s of [-1, 1]) TOR(hd, R * 0.12, R * 0.028, h.eyeCol || 0x18121c, s * sep, ey - R * 0.05, zz, 0, Math.PI);
    else if (ek === 'one') { S(hd, R * 0.42, 0xffffff, 0, ey + R * 0.05, fz(0, ey) - R * 0.22, 1, 1, 0.6); S(hd, R * 0.2, h.eyeCol || 0x2a1a10, 0, ey + R * 0.05, fz(0, ey), 1, 1, 0.5); S(hd, R * 0.07, 0xffffff, R * 0.07, ey + R * 0.13, fz(0, ey) + R * 0.06); }
    if (h.third) for (const y3 of h.third3 ? [R * 0.38, R * 0.56, R * 0.74] : [R * 0.42]) S(hd, R * 0.085, h.third, 0, y3, fz(0, y3) - R * 0.02, 0.8, 1.2, 0.5);
    if (ct && h.blush !== false && ek !== 'one') for (const s of [-1, 1]) { const by = ey - R * 0.3, bx = R * 0.58; S(hd, R * 0.11, 0xff8e8e, s * bx, by, fz(bx, by) - R * 0.03, 1, 0.55, 0.35); }
    if (h.mouth === 'smile' || (ct && h.mouth == null && !sn && !h.muzzle)) TOR(hd, R * 0.09, R * 0.022, 0x3a1a1a, 0, -R * 0.36, fz(0, R * 0.36) - R * 0.01, 0, Math.PI).rotation.z = Math.PI;
    if (h.mouth === 'fang') { B(hd, R * 0.36, R * 0.05, R * 0.04, 0x2a1414, 0, -R * 0.42, fz(0, R * 0.42) - R * 0.02); for (const s of [-1, 1]) { const f = K(hd, R * 0.05, R * 0.14, h.fangCol || 0xf4f0e6, s * R * 0.12, -R * 0.49, fz(R * 0.12, R * 0.49) - R * 0.01); f.rotation.x = Math.PI; } }
    if (h.tongue) { const tg = B(hd, R * 0.22, R * 0.04, R * h.tongue, 0xd8343a, 0, -R * 0.45, fz(0, R * 0.45) + R * h.tongue * 0.35); tg.rotation.x = 0.6; m.extra.tongue = tg; }
    // 耳
    const ec = h.earCol || col, ei = h.earIn || 0xf0c8c0, es = ct ? 1.15 : 1;
    for (const s of [-1, 1]) {
      const ears = (h.earAlt && s > 0) ? h.earAlt : h.ears, eh = (h.earCut && s > 0) ? 0.5 : 1;
      if (ears === 'fox') { const e = K(hd, R * 0.3 * es, R * 0.8 * es, ec, s * R * 0.55, R * 0.88, -R * 0.08); e.rotation.z = -s * 0.32; const i = K(hd, R * 0.17 * es, R * 0.5 * es, ei, s * R * 0.53, R * 0.84, R * 0.0); i.rotation.z = -s * 0.32; }
      else if (ears === 'cat') { const e = K(hd, R * 0.28 * es, R * 0.48 * es * eh, ec, s * R * 0.6, R * 0.78, -R * 0.05); e.rotation.z = -s * 0.42; const i = K(hd, R * 0.15 * es, R * 0.3 * es, ei, s * R * 0.58, R * 0.76, R * 0.04); i.rotation.z = -s * 0.42; }
      else if (ears === 'round') { S(hd, R * 0.3 * es, ec, s * R * 0.72, R * 0.68, -R * 0.05, 1, 1, 0.45); S(hd, R * 0.17 * es, ei, s * R * 0.72, R * 0.68, R * 0.05, 1, 1, 0.3); }
      else if (ears === 'flop') { const e = S(hd, R * 0.3 * es, ec, s * R * 0.92, R * 0.05, -R * 0.05, 0.45, 1.3, 0.85); e.rotation.z = s * 0.35; }
      else if (ears === 'side') { const e = S(hd, R * 0.22, ec, s * R * 1.05, R * 0.25, -R * 0.1, 1.5, 0.55, 0.7); e.rotation.z = s * 0.3; }
      else if (ears === 'fin') { const f = PL(hd, R * 0.6, R * 0.5, h.finCol || ec, s * R * 0.9, R * 0.1, -R * 0.3); f.rotation.y = s * 1.1; }
    }
    // 角
    if (h.horns) { const hn = h.horns; const n = hn.n || 2; for (let i = 0; i < n; i++) { const s = n === 1 ? 0 : i ? 1 : -1, x = s * R * (hn.x || 0.45), y = R * (hn.y || 0.85); const k = K(hd, R * (hn.w || 0.12), R * (hn.len || 0.5), hn.col || 0xf0e6d0, x, y + R * (hn.len || 0.5) * 0.3, hn.z || 0); k.rotation.z = -s * (hn.tilt == null ? 0.3 : hn.tilt); if (hn.fwd) k.rotation.x = hn.fwd; } }
    // 髪
    const hc = h.hairCol, hr = h.hair;
    if (hr === 'short' || hr === 'topknot' || hr === 'spiky' || hr === 'long' || hr === 'bob') S(hd, R * 1.05, hc, 0, R * 0.17, -R * 0.1, 1, 0.84, 1);
    if (hr === 'topknot') { C(hd, R * 0.1, R * 0.12, R * 0.4, hc, 0, R * 0.95, -R * 0.35).rotation.x = 0.9; }
    if (hr === 'spiky') for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.4, k = K(hd, R * 0.2, R * 0.55, hc, Math.sin(a) * R * 0.7, R * 0.7 + Math.cos(a) * R * 0.15, -R * 0.35 - Math.cos(a) * R * 0.2); k.rotation.set(-0.7, 0, -Math.sin(a) * 0.9); }
    if (hr === 'long') { B(hd, R * 1.7, R * 2.6, R * 0.5, hc, 0, -R * 1.0, -R * 0.62); for (const s of [-1, 1]) B(hd, R * 0.35, R * 1.6, R * 0.4, hc, s * R * 0.85, -R * 0.5, R * 0.05); }
    if (hr === 'bob') { S(hd, R * 1.1, hc, 0, R * 0.05, -R * 0.06, 1.06, 0.98, 1.02); B(hd, R * 1.5, R * 0.42, R * 0.45, hc, 0, R * 0.6, R * 0.62); }
    if (hr === 'mane') { const n = h.maneN || 12; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; S(hd, R * (h.maneR || 0.42), h.maneCol || hc, Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.0 + R * 0.05, -R * 0.25, 1, 1, 0.7); } }
    if (hr === 'hood') { S(hd, R * 0.95, h.hoodCol || col, 0, R * 0.62, -R * 0.05, 1.05, 0.6, 1.25); S(hd, R * 0.5, h.hoodCol || col, 0, R * 0.55, R * 0.85, 1.1, 0.55, 0.9); if (h.hoodIn) S(hd, R * 0.9, h.hoodIn, 0, R * 0.42, -R * 0.1, 1.08, 0.3, 1.2); } // 蛇の頭をかぶる
    // 帽子
    if (h.hat === 'kasa') { const k = K(hd, R * 1.7, R * 0.7, h.hatCol || 0xc8a868, 0, R * 0.95, 0); k.geometry = new THREE.ConeGeometry(R * 1.7, R * 0.7, 18); }
    if (h.hat === 'tokin') B(hd, R * 0.45, R * 0.35, R * 0.45, 0x1a1a1e, 0, R * 1.02, R * 0.25).rotation.y = Math.PI / 4;
    if (h.hat === 'ghost') { const tri = K(hd, R * 0.28, R * 0.38, 0xf6f4ee, 0, R * 0.72, fz(0, R * 0.62) - R * 0.12); tri.rotation.x = 0.35; tri.geometry = new THREE.ConeGeometry(R * 0.28, R * 0.38, 3); TOR(hd, R * 1.0, R * 0.04, 0xf6f4ee, 0, R * 0.48, 0, Math.PI / 2 - 0.25); }
    if (h.hat === 'band') TOR(hd, R * 1.02, R * 0.07, h.hatCol || 0xd8d0c0, 0, R * 0.32, 0, Math.PI / 2 - 0.12);
    return hd;
  }
  /* ---------- 尾：ふさふさ・細い・平たい帯 ---------- */
  function tails(m, o) {
    const K0 = m.extra.kit, n = o.n || 1;
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) - 0.5 : 0, g = G(m.body, k * 0.05, o.y == null ? 0.03 : o.y, -(o.z || 0.09)); g.rotation.x = o.lift == null ? 0.6 : o.lift; g.rotation.y = g.userData.y0 = k * (o.spread || 1.6); if (n > 1) g.rotation.z = k * 0.6;
      const L0 = o.len || 0.35, w = o.w || 0.07;
      if (o.kind === 'thin') { const c = CAP(g, w * 0.35, L0, o.col, 0, 0, -L0 / 2); c.rotation.x = Math.PI / 2; if (o.tip) S(g, w * 0.7, o.tip, 0, 0, -L0); }
      else if (o.kind === 'flat') { B(g, w, 0.015, L0, o.col, 0, 0, -L0 / 2); if (o.tip) B(g, w * 1.02, 0.017, L0 * 0.28, o.tip, 0, 0, -L0 * 0.88); }
      else if (o.kind === 'smoke') { for (let j = 0; j < 5; j++) S(g, w * (1 - j * 0.15), TR(o.col, { opacity: 0.6 - j * 0.1 }), 0, j * 0.02, -j * L0 / 5); }
      else for (let j = 0; j < 6; j++) { const q = j / 5, r = w * (0.55 + 0.65 * Math.sin(Math.PI * Math.min(0.92, q * 0.9 + 0.12))); S(g, r, o.tip && j >= 4 ? o.tip : o.col, 0, Math.sin(q * 1.6) * L0 * 0.35, -q * L0); }
      K0.tails.push(g);
    }
  }
  /* ---------- 持ち物（手の位置に付ける） ---------- */
  const inHand = (m, side, rx) => { const g = G(side === 'L' ? m.armL : m.armR, 0, m.extra.handY, 0.01); g.rotation.x = rx == null ? -0.35 : rx; return g; };
  function katana(m, side, len, o) { o = o || {}; const g = inHand(m, side, o.rx); const gr = C(g, 0.014, 0.014, 0.11, o.grip || 0x2a2228, 0, 0, 0); gr.rotation.x = Math.PI / 2; const ts = C(g, 0.04, 0.04, 0.012, o.tsuba || 0x8a7a4a, 0, 0, 0.06); ts.rotation.x = Math.PI / 2; const bl = B(g, 0.012, 0.03, len, o.blade || BLADE(), 0, 0.006, 0.066 + len / 2); if (o.glow) B(g, 0.016, 0.008, len * 0.9, E(o.glow, 1.2), 0, 0.022, 0.07 + len * 0.45); return g; }
  function staff(m, side, len, col, top) { const g = inHand(m, side, 0); C(g, 0.013, 0.013, len, col, 0, len * 0.28, 0.0); if (top) top(g, len * 0.78); return g; }
  function club(m, side, len, col, stud) { const g = inHand(m, side, -0.2); const c = C(g, 0.04, 0.02, len, col, 0, 0, len * 0.42); c.rotation.x = Math.PI / 2; if (stud) for (let i = 0; i < 10; i++) { const a = i * 2.2; S(g, 0.012, stud, Math.cos(a) * 0.035, Math.sin(a) * 0.035, len * (0.45 + (i % 5) * 0.09)); } return g; }
  const glowOrb = (m, side, r, col) => { const g = inHand(m, side, 0); return S(g, r, E(col, 1.4), 0, -0.02, 0.05); };
  const more = (m, f) => { m.extra.more = f; };

  /* =============================== v7 の造形のまま残す6体（海坊主・雪女・雷の化身・手長・烏天狗・山男） =============================== */
  Object.assign(STYLE, { new_d_06: 'cool', new_a_05: 'cool', new_s_06: 'cool', new_a_07: 'cool', new_c_07: 'cute', new_c_04: 'cute' });
  def('new_d_06', 1.25, () => HUM(5), (m, c, d) => { // 雪女：灰白の顔、長い黒髪、深緑の山着に霜、裾は雪煙へほどける
    const R = d.R; hum(m, d, { skin: 0xdcdcd8, cloth: 0x2e4a3a, robe: true, robeW: 0.17, robeLong: 0.95, hair: 'long', hairCol: 0x0e0e12, armLen: d.T * 0.9, armR: 0.035, sleeve: 0x2e4a3a, hand: 0.03, noLegs: true });
    spots(m.torso, 10, 0.02, 0xf4f8ff, 0.12, d.T, 0.12, -0.1, 5);
    const sm = G(m.body, 0, 0, 0); m.extra.snow = sm; for (let i = 0; i < 6; i++) S(sm, 0.07, TR(0xf4f8ff, { opacity: 0.45 }), Math.cos(i) * 0.15, -d.legH + 0.06, Math.sin(i) * 0.15);
    for (const s of [-1, 1]) dot(m.head, R * 0.1, s * R * 0.32, 0, R * 0.88, 0x2a2a30);
    for (const g of [m.armL, m.armR]) for (let i = 0; i < 3; i++) OCT(g, 0.018, L(0xc8f0ff, { emissive: 0x6ac0e0, emissiveIntensity: 0.6 }), (i - 1) * 0.03, -d.T * 0.95 - i * 0.03, 0.03);
    m.extra.anim = (m, P, a, T) => m.extra.snow.children.forEach((s, i) => { s.position.y = -d.legH + 0.06 + ((T * 0.3 + i / 6) % 1) * 0.12; s.material.opacity = 0.45 * (1 - ((T * 0.3 + i / 6) % 1)); });
  });
  def('new_a_05', 1.2, () => HUM(4), (m, c, d) => { // 烏天狗：青黒い羽毛の鳥人、短い嘴と琥珀の目、淡い灰の腹、細い縄の帯だけ。翼と腕が一体
    const R = d.R, bl = 0x1e2638; hum(m, d, { skin: bl, cloth: bl, chest: 0.12, belt: 0xb8a070, armLen: d.T * 0.95, armR: 0.03, hand: 0, legR: 0.03, legCol: 0x3a3a30, foot: [0.08, 0.02, 0.11], footCol: 0x6a6040 });
    S(m.torso, 0.1, 0x9aa0a8, 0, d.T * 0.45, 0.07, 0.9, 1.4, 0.5); K(m.head, R * 0.25, R * 0.6, 0x2a2a2a, 0, -R * 0.1, R * 1.1).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) dot(m.head, R * 0.12, s * R * 0.4, R * 0.18, R * 0.82, 0xffb030);
    for (const [g, s] of [[m.armL, -1], [m.armR, 1]]) for (let i = 0; i < 5; i++) { const f = PL(g, 0.08, 0.32 - i * 0.03, bl, s * (0.04 + i * 0.03), -0.18 - i * 0.04, -0.02); f.rotation.y = s * 0.2; }
  });
  def('new_s_06', 1.05, () => QUAD(0.22, 0.32), (m, c, d) => { // 雷の化身：雷雲が低い四足の獣の形へ固まる、灰色の雲の背に橙の稲光、目と角はなく脚先の光が点滅
    const cl = TR(0x8a8c94, { opacity: 0.85 });
    quad(m, d, { len: 0.62, bw: 0.4, col: 0x8a8c94, headR: 0.16, snout: 0.2, ears: 'none', eyes: false, legR: 0.06, tail: { n: 1, len: 0.25, w: 0.08, col: 0x7a7c84, puff: true } });
    for (let i = 0; i < 8; i++) S(m.body, 0.1, cl, Math.cos(i) * 0.14, 0.08 + (i % 3) * 0.03, (i / 8 - 0.5) * 0.55);
    const bolts = G(m.body, 0, 0.17, 0); m.extra.bolts = bolts; for (let i = 0; i < 4; i++) { const b = B(bolts, 0.015, 0.012, 0.16, E(0xff9a3a, 1.6), (i - 1.5) * 0.06, 0, (i % 2 - 0.5) * 0.15); b.rotation.y = (i % 2 ? 0.6 : -0.6); }
    const ft = []; for (const g of m.extra.qlegs) ft.push(S(g, 0.035, E(0xffe0a0, 1.6), 0, -d.legLen - 0.06, 0)); m.extra.ft = ft;
    const base = quadAnim; m.extra.anim = (m, P, a, T, dt, act, t) => { base(m, P, a, T, dt, act, t); m.extra.bolts.visible = Math.sin(T * 13) > -0.2; m.extra.ft.forEach((f, i) => f.visible = Math.sin(T * 8 + i * 1.7) > 0); };
  });
  def('new_c_07', 1.0, () => HUM(3.5), (m, c, d) => { // 手長：丸い顔と短い胴、地面へ届く二本の長い腕、黄土色の肌、灰色の腰布だけ。歩くと両腕で弓形の輪
    const R = d.R; hum(m, d, { skin: 0xc8a050, cloth: 0xc8a050, chest: 0.12, armLen: 1.15, armR: 0.03, hand: 0.045, legR: 0.045, foot: [0.08, 0.03, 0.11] });
    for (const s of [-1, 1]) dot(m.head, R * 0.09, s * R * 0.3, 0, R * 0.92); B(m.head, R * 0.4, R * 0.06, 0.02, 0x6a3a2a, 0, -R * 0.4, R * 0.92);
    C(m.torso, 0.13, 0.14, d.T * 0.35, 0x8a8a8c, 0, d.T * 0.1, 0, null, 10);
    m.extra.anim = (m, P, a, T) => { if (!a.act) { const sw = a.moving ? Math.sin(m.walkPh || 0) : 0; m.armL.rotation.z = -0.35 - Math.abs(sw) * 0.3; m.armR.rotation.z = 0.35 + Math.abs(sw) * 0.3; } };
  });
  def('new_a_07', 1.35, () => HUM(5), (m, c, d) => { // 山男：苔色の毛の大柄な山の住人、小さな目と平たい鼻、肩から伸びる枝状の硬い毛、長い腕、両手で風をすくう
    const R = d.R, mo = 0x4a6a32; hum(m, d, { skin: mo, cloth: mo, chest: 0.14, armLen: d.T * 1.2, armR: 0.05, hand: 0.06, legR: 0.06, foot: [0.1, 0.04, 0.13], footCol: 0x3a4a22, headScale: [0.9, 1, 0.9] });
    for (const s of [-1, 1]) dot(m.head, R * 0.08, s * R * 0.28, R * 0.1, R * 0.88); S(m.head, R * 0.2, 0x3a5222, 0, -R * 0.15, R * 0.85, 1.3, 0.6, 0.6);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const b = C(m.torso, 0.01, 0.006, 0.2, 0x5a4a2a, s * (0.14 + i * 0.03), d.T + 0.06, 0); b.rotation.z = -s * (0.6 + i * 0.3); }
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

  /* =============================== 初期10体 =============================== */
  // 地縛霊〈かっこいい〉：敷石に縛られた霊の武者。黒い紙片の羽織、白い細縄を拳と胸に巻く、紙片が周りを渦巻く。裾は霊気へほどける
  cool('kogemaru', 1.2, COOL(5.2), (m, c, d) => {
    hero(m, d, { skin: 0xbcc6d2, cloth: 0x1c1a20, collar: 0xe8e4da, sash: 0xe8e4da, sleeves: 0x24222a, noLegs: true, tailCol: TR(0x1c1a20, { opacity: 0.75 }) });
    face(m, d, { col: 0xbcc6d2, eye: 'cool', glow: 0xd8e8ff, hair: 'spiky', hairCol: 0x2a2830 });
    for (const g of [m.armL, m.armR]) { TOR(g, 0.048, 0.014, 0xf2f0ea, 0, m.extra.handY + 0.03, 0, Math.PI / 2); TOR(g, 0.044, 0.012, 0xe8e4da, 0, m.extra.handY + 0.07, 0, Math.PI / 2 + 0.3); }
    TOR(m.torso, 0.105, 0.012, 0xf2f0ea, 0, d.T * 0.68, 0, Math.PI / 2).rotation.y = 0.5;
    B(m.root, 0.62, 0.08, 0.62, 0x8c8a84, 0, 0.04, 0); for (const [x, z, r] of [[0.05, 0, 0.6], [-0.12, 0.08, -0.4]]) B(m.root, 0.66, 0.01, 0.015, 0x2a2826, x, 0.085, z).rotation.y = r;
    const v = G(m.torso, 0, 0, 0); m.extra.vort = v; const pm = L(0x17151a, { side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) { const k = i / 14, a = k * Math.PI * 4, p = PL(v, 0.06, 0.04, pm, Math.cos(a) * 0.26, -0.1 + k * 0.7, Math.sin(a) * 0.26); p.rotation.set(Math.sin(i), -a, Math.cos(i)); }
    more(m, (m, P, a, T) => { m.extra.vort.rotation.y = T * 1.6; });
  });
  // 提灯火〈かわいい〉：頭が灯る提灯の子。竹骨の輪と琥珀の光、上の紐が尾のように揺れる。法被姿で小さな火を持つ
  cute('hoshisuzume', 0.95, CUTE(2.3), (m, c, d) => {
    const R = d.R; hero(m, d, { skin: 0xf2d6b4, cloth: 0xb8282a, collar: 0xf2ead8, sash: 0x2a2a30, legCol: 0x2a2a30, footCol: 0x8a6a42 });
    const lp = L(0xf6e2b0, { emissive: 0xff9a30, emissiveIntensity: 0.55 });
    C(m.head, R * 0.92, R * 0.92, R * 1.7, lp, 0, 0, 0, null, 16); for (const y of [-0.6, -0.3, 0, 0.3, 0.6]) TOR(m.head, R * 0.93 * (1 - Math.abs(y) * 0.15), R * 0.035, 0x6a4a2a, 0, y * R * 1.4, 0, Math.PI / 2);
    for (const y of [-1, 1]) C(m.head, R * 0.62, R * 0.62, R * 0.18, 0x2a2228, 0, y * R * 0.9, 0, null, 14);
    face(m, d, { shape: 'none', flatZ: 0.93, eye: 'cute', mouth: 'smile', ey: 0.05 });
    const st = G(m.head, 0, R * 1.0, 0); m.extra.str = st; for (let i = 0; i < 6; i++) S(st, 0.012, 0xb8282a, 0, 0.02 + i * 0.012, -i * 0.04);
    m.extra.flame = glowOrb(m, 'R', 0.04, 0xffb340);
    more(m, (m, P, a, T) => { m.extra.str.rotation.x = Math.sin(T * 2.5) * 0.35; m.extra.flame.scale.setScalar(1 + Math.sin(T * 11) * 0.12); });
  });
  // 九尾の狐〈かっこいい〉：立った人型の狐。灰白と墨色のまだら毛、墨色の着物、背に長く平たい九本の尾、手に青い狐火
  cool('akaneten', 1.3, COOL(5.4), (m, c, d) => {
    hero(m, d, { skin: 0xe4e2dc, cloth: 0x2a2a32, collar: 0xe4e2dc, sash: 0x8a8aa0, hakama: 0x4a4a56, sleeves: 0x2a2a32, claw: 0x2a2a2e, footCol: 0x2a2a2e });
    face(m, d, { col: 0xe4e2dc, snout: 0.95, snW: 0.36, ears: 'fox', earCol: 0x2c2c32, earIn: 0xe8d8d0, eye: 'cool', glow: 0xffc860, brow: false, cheek: 0xf4f2ee });
    spots(m.head, 4, 0.025, 0x2e2e33, d.R * 0.6, d.R * 0.5, d.R * 0.6, 0, 3);
    tails(m, { n: 9, kind: 'flat', len: 0.62, w: 0.085, col: 0xe8e6e0, tip: 0x2c2c32, spread: 2.4, lift: 0.5, y: 0.05 });
    glowOrb(m, 'L', 0.045, 0x8ac8ff);
  });
  // 大蛇〈かっこいい〉：黒い岩のような鱗の人型。腹に青磁の筋、頭の後ろに二枚の鰭、太い大蛇が胴に巻きつき肩から頭を出す
  cool('kagetsubame', 1.3, COOL(5.4), (m, c, d) => {
    const sk = 0x26282e; hero(m, d, { skin: sk, cloth: sk, belly: 0x9fc8b8, pants: 0x1a1c20, sash: 0x3a4a52, claw: 0xd8e8f0, footCol: 0x1a1c20 });
    face(m, d, { col: sk, snout: 0.5, snW: 0.5, ears: 'fin', finCol: 0x3a4a52, eye: 'cool', glow: 0x9fe8c8, brow: false });
    const sn = G(m.torso, 0, 0, 0); m.extra.snake = sn; const T = d.T;
    for (let j = 0; j < 34; j++) { const a = j * 0.5, y = T * 0.05 + j * T * 0.026, r = 0.12 + Math.sin(j * 0.2) * 0.01; S(sn, 0.036 - j * 0.0003, j % 4 === 3 ? 0x9fc8b8 : 0x4a5562, Math.cos(a) * r, y, Math.sin(a) * r); }
    const hd = G(sn, 0.1, T * 0.98, 0.04); m.extra.shd = hd; S(hd, 0.065, 0x4a5562, 0, 0, 0.03, 1, 0.7, 1.4); for (const s of [-1, 1]) { glowEye(hd, 0.012, s * 0.035, 0.025, 0.1, 0x9fe8c8); const f = PL(hd, 0.05, 0.04, 0x3a4a52, s * 0.06, 0.02, -0.02); f.rotation.y = s * 1.1; }
    const tg = B(hd, 0.01, 0.003, 0.06, 0xd8343a, 0, -0.01, 0.12); m.extra.tg = tg;
    tails(m, { n: 1, kind: 'thin', len: 0.45, w: 0.08, col: sk, lift: -0.3 });
    more(m, (m, P, a, T) => { m.extra.shd.rotation.y = Math.sin(T * 1.7) * 0.5; m.extra.tg.visible = Math.sin(T * 5) > 0.3; });
  });
  // 刀の付喪神〈かっこいい〉：欠けた古刀を握る侍の霊。紺の着物に袴、腰に黒い木鞘、柄に麻縄。目は鋼色に光る
  cool('sayanosuke', 1.3, COOL(5.6), (m, c, d) => {
    hero(m, d, { skin: 0xe6d6c4, cloth: 0x23304a, collar: 0xf0ece4, sash: 0xb8a888, hakama: 0x3a3a46, sleeves: 0x23304a, footCol: 0x8a7a5a });
    face(m, d, { col: 0xe6d6c4, eye: 'cool', glow: 0xc8e0ff, hair: 'topknot', hairCol: 0x16141a });
    const k = katana(m, 'R', 0.62, { grip: 0xb8a888, tsuba: 0x3a3228, glow: 0x9ac0ff }); B(k, 0.016, 0.02, 0.04, 0x23304a, 0, 0.022, 0.5); // 刃の欠け
    const sc = B(m.torso, 0.03, 0.035, 0.5, 0x1e1a18, -0.1, d.T * 0.2, -0.02); sc.rotation.set(0.35, 0.25, 0); // 鞘
    for (let i = 0; i < 2; i++) TOR(m.root, 0.3 + i * 0.06, 0.006, TR(0xc8d8ff, { opacity: 0.3 }), 0, 0.03, 0, Math.PI / 2);
  });
  // 鬼神〈かっこいい〉：青銅の肌と短い横角の山の守り手。四角い顎、生成りの布、背に石鼓の輪を背負い素手で音の輪を打つ
  cool('taiko', 1.35, COOL(5), (m, c, d) => {
    const bz = 0x7a8a6a; hero(m, d, { skin: bz, cloth: bz, pants: 0x4a3a2a, sash: 0xe8e0c8, bulk: 1.3, hand: 0.06, footCol: 0x3a3028 });
    face(m, d, { col: bz, scale: [1.08, 1, 1], eye: 'cool', glow: 0xffd060, mouth: 'fang', hair: 'spiky', hairCol: 0x2a3020, horns: { n: 2, len: 0.55, w: 0.13, tilt: 1.2, x: 0.75, y: 0.4, col: 0xe8dcc0 } });
    B(m.torso, 0.06, d.T * 0.9, 0.2, 0xe8e0c8, 0.02, d.T * 0.55, 0.0).rotation.z = 0.6;
    const rg = G(m.torso, 0, d.T * 0.85, -0.17); m.extra.drums = rg; TOR(rg, 0.3, 0.014, 0x6a5a3a, 0, 0, 0, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const dr = C(rg, 0.06, 0.06, 0.05, 0x9a968c, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0, null, 14); dr.rotation.x = Math.PI / 2; C(rg, 0.062, 0.062, 0.012, 0xe8dcc0, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.026, null, 14).rotation.x = Math.PI / 2; }
    more(m, (m, P, a, T) => { m.extra.drums.rotation.z = Math.sin(T * 0.8) * 0.1; });
  });
  // 甲冑の付喪神〈かっこいい〉：中身のない古い鉄の鎧武者。兜の上に三枚の鉄板が浮き、面頬の奥に二つの光。大袖で守る
  cool('burikidon', 1.35, COOL(5), (m, c, d) => {
    const ir = 0x4a4c52, R = d.R; hero(m, d, { skin: 0x141416, cloth: ir, pants: 0x3a3c42, pads: 0x3a3c42, pads2: 0x5a2a2a, bulk: 1.3, sleeve: 0x6a4a2a, handCol: 0x2a2c30, hand: 0.055, footCol: 0x2a2c30, skirt: 0.45, skirtCol: 0x3a3c42 });
    for (let i = 0; i < 4; i++) TOR(m.torso, 0.135 - i * 0.004, 0.008, 0x8a2a2a, 0, d.T * (0.45 + i * 0.13), 0, Math.PI / 2).scale.y = 0.75;
    face(m, d, { col: 0x141416, eye: 'glow', glow: 0xffa040 });
    S(m.head, R * 1.12, ir, 0, R * 0.25, -R * 0.05, 1, 0.75, 1.05); C(m.head, R * 1.5, R * 1.6, R * 0.15, ir, 0, -R * 0.05, -R * 0.2, null, 16).rotation.x = -0.25;
    const pl = G(m.head, 0, R * 1.2, 0); m.extra.plates = pl; for (let i = 0; i < 3; i++) { const p = B(pl, R * 1.1, 0.02, R * 0.6, ir, 0, i * 0.05, 0); p.rotation.y = i * 0.5; }
    more(m, (m, P, a, T) => { m.extra.plates.children.forEach((p, i) => { p.position.y = i * 0.05 + Math.sin(T * 2 + i) * 0.012; }); });
  });
  // 唐傘〈かわいい〉：墨色の和傘を頭にかぶった子。傘の縁に切れた紙、ぺろりと舌を出し、一本歯の下駄。攻撃で傘を閉じて突く
  cute('norenbou', 1.0, CUTE(2.4), (m, c, d) => {
    const R = d.R; hero(m, d, { skin: 0xf2d6b4, cloth: 0x2e2e36, collar: 0xe8e0cc, sash: 0xc83a3a, legCol: 0xa8904a, footCol: 0x6a4a2a, geta: true });
    face(m, d, { col: 0xf2d6b4, eye: 'cute', tongue: 0.5, mouth: 'none' });
    const um = G(m.head, 0, R * 0.95, 0); m.extra.um = um;
    const can = K(um, R * 1.9, R * 1.1, L(0x24242a, { side: THREE.DoubleSide }), 0, R * 0.25, 0); can.geometry = new THREE.ConeGeometry(R * 1.9, R * 1.1, 16, 1, true); m.extra.can = can;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const r = B(um, 0.006, 0.006, R * 1.9, 0xc8b080, Math.cos(a) * R * 0.95, R * 0.25, Math.sin(a) * R * 0.95); r.rotation.y = -a + Math.PI / 2; r.rotation.x = 0.5; }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const p = PL(um, 0.04, 0.06 + (i % 3) * 0.02, 0xe8e0cc, Math.cos(a) * R * 1.88, -R * 0.35, Math.sin(a) * R * 1.88); p.rotation.y = -a + Math.PI / 2; }
    C(um, 0.02, 0.02, 0.06, 0x6a4a2a, 0, R * 0.85, 0); glowEye(um, 0.03, 0, R * 0.35, R * 1.0, 0xf2ead8);
    more(m, (m, P, a, T) => { const pk = Math.max(0, -P.aRx) / 1.8; m.extra.um.scale.set(1 - pk * 0.6, 1 + pk * 0.4, 1 - pk * 0.6); });
  });
  // 幽霊〈かわいい〉：白い着物に額の三角布の小さな霊。裾はほどけて浮き、袖の先で小さな光をすくう
  cute('kemuridama', 0.95, CUTE(2.4), (m, c, d) => {
    hero(m, d, { skin: 0xe8eef4, cloth: 0xe8eef4, collar: 0xa8b8c8, sash: 0xa8b8c8, sleeves: 0xdce4ec, noLegs: true, tailCol: TR(0xe8eef4, { opacity: 0.7 }) });
    face(m, d, { col: 0xe8eef4, eye: 'cute', eyeCol: 0x2a3a4a, hair: 'bob', hairCol: 0x2a2a36, hat: 'ghost' });
    glowOrb(m, 'R', 0.04, 0xd8f0ff); for (let i = 0; i < 3; i++) { const p = PL(m.torso, 0.04, 0.2, TR(0xf4f0e6, { opacity: 0.75, side: THREE.DoubleSide }), (i - 1) * 0.05, -d.legH * 0.7, 0.02); p.rotation.y = (i - 1) * 0.5; }
  });
  // 木霊〈花守〉〈かわいい〉：切り株の頭に白い野花を咲かせた木の子。葉の腰みの、足元に花びらの輪
  cute('momiji', 0.9, CUTE(2.3), (m, c, d) => {
    const R = d.R, bk = 0x8a6a48; hero(m, d, { skin: bk, cloth: 0x6a4a2e, skirt: 0.25, skirtCol: 0x6a9a4a, legCol: 0x6a4a2e, footCol: 0x5a3a22 });
    face(m, d, { col: bk, scale: [1, 0.95, 1], eye: 'cute', eyeCol: 0x2a1a0a });
    C(m.head, R * 0.86, R * 0.86, R * 0.05, 0xc8a878, 0, R * 0.62, 0, null, 16); for (const r of [0.3, 0.55, 0.78]) TOR(m.head, R * r, R * 0.02, 0x8a6a48, 0, R * 0.65, 0, Math.PI / 2);
    for (let i = 0; i < 7; i++) { const a = i * 0.9; const f = G(m.head, Math.cos(a) * R * 0.55, R * 0.7, Math.sin(a) * R * 0.5); for (let j = 0; j < 5; j++) { const b = j / 5 * Math.PI * 2; S(f, R * 0.07, 0xfaf8f0, Math.cos(b) * R * 0.07, 0, Math.sin(b) * R * 0.07, 1, 0.4, 1); } S(f, R * 0.05, 0xf0d040, 0, R * 0.02, 0); }
    const ring = G(m.root, 0, 0.02, 0); m.extra.ring = ring; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const p = PL(ring, 0.07, 0.05, 0xfff4f8, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); p.rotation.set(-Math.PI / 2, 0, a); }
    more(m, (m, P, a, T) => { m.extra.ring.rotation.y = T * 0.3; });
  });

  /* =============================== 追加50体：アタッカー =============================== */
  // 猫又〈かわいい〉：煤色の長毛のぽっちゃり老猫。琥珀の目、着物に黄色い帯、先が二つに分かれた二本の尾、背に灰色の斑点
  cute('new_d_02', 0.95, CUTE(2.4), (m, c, d) => {
    const f = 0x3a3836; hero(m, d, { skin: f, cloth: 0x6a4a6a, collar: 0xe8d8b0, sash: 0xd8b040, claw: 0xf0e8d8, legCol: f });
    face(m, d, { col: f, muzzle: 0x8a8480, noseCol: 0xd88a8a, ears: 'cat', earIn: 0xc89a9a, eye: 'cute', eyeCol: 0xd89a20 });
    for (const s of [-1, 1]) for (const y of [-0.3, -0.42]) B(m.head, d.R * 0.5, 0.004, 0.004, 0xe8e4dc, s * d.R * 0.75, y * d.R, d.R * 0.75).rotation.z = s * (y + 0.36) * 2;
    spots(m.torso, 4, 0.03, 0x6a6866, 0.1, 0.1, 0.08, 0.05, 2);
    tails(m, { n: 2, kind: 'thin', len: 0.42, w: 0.07, col: f, tip: 0x5a5856, spread: 0.6, lift: 1.0 });
  });
  // 化け猫〈かっこいい〉：細身の茶褐色の山猫の忍び。欠けた片耳、背に苔色の毛、長い爪、細い一本尾
  cool('new_d_03', 1.25, COOL(5.2), (m, c, d) => {
    const f = 0x8a5a34; hero(m, d, { skin: f, cloth: 0x2a2622, pants: 0x2a2622, scarf: 0x5a6a3a, belly: 0xc8a070, claw: 0xf0e8d8, legCol: 0x2a2622, footCol: f });
    face(m, d, { col: f, snout: 0.45, snW: 0.45, ears: 'cat', earCut: true, earIn: 0x4a2a1a, eye: 'cool', glow: 0xd8ff6a, brow: false, cheek: 0xc8a070 });
    S(m.torso, 0.08, 0x5a6a3a, 0, d.T * 0.82, -0.08, 1.4, 0.8, 0.5);
    tails(m, { n: 1, kind: 'thin', len: 0.5, w: 0.06, col: f, lift: 0.9 });
  });
  // 白蛇〈かわいい〉：白い蛇の頭巾をかぶった子。腹側は淡い銅色、肩に小さな白蛇が巻きつき、両手の間に光をためる
  cute('new_d_05', 0.95, CUTE(2.4), (m, c, d) => {
    const w = 0xf6f2ea, R = d.R; hero(m, d, { skin: w, cloth: w, collar: 0xd8a070, hakama: 0xd8a070, sash: 0xd8a070 });
    face(m, d, { col: w, eye: 'cute', eyeCol: 0xc83a4a, hair: 'hood', hoodCol: 0xf2eee4, hoodIn: 0xd8a070 });
    for (const s of [-1, 1]) dot(m.head, R * 0.08, s * R * 0.42, R * 0.78, R * 0.75, 0xc83a4a); // 頭巾（蛇の頭）の目
    const sn = G(m.torso, 0, d.T * 0.85, 0); for (let j = 0; j < 16; j++) { const a = j * 0.45; S(sn, 0.022, j % 2 ? w : 0xe8dcc8, Math.cos(a) * 0.12, Math.sin(j * 0.2) * 0.02, Math.sin(a) * 0.11); } S(sn, 0.03, w, 0.12, 0.03, 0.04, 1, 0.7, 1.3);
    const orb = S(m.torso, 0.045, E(0xfff4d0, 1.4), 0, d.T * 0.35, 0.2); m.extra.orb = orb;
    tails(m, { n: 1, kind: 'thin', len: 0.35, w: 0.06, col: w, lift: -0.2 });
    more(m, (m, P, a, T) => { m.extra.orb.scale.setScalar(1 + Math.sin(T * 4) * 0.15); });
  });
  // 狒々〈かっこいい〉：焦げ茶の長毛の大猿の戦士。灰色の顔、赤土色の前腕、肩から垂れる蓑状の毛、長い腕
  cool('new_c_02', 1.35, COOL(5), (m, c, d) => {
    const f = 0x4a3424; hero(m, d, { skin: 0x8a8a88, cloth: f, sleeve: f, handCol: 0xa8583a, bulk: 1.35, armLen: d.T * 1.2, hand: 0.06, pants: f, footCol: 0x3a2a1a });
    for (const g of [m.armL, m.armR]) CAP(g, 0.05, d.T * 0.35, 0xa8583a, 0, m.extra.handY + d.T * 0.25, 0);
    face(m, d, { col: f, muzzle: 0x8a8a88, nose: false, eye: 'cool', glow: 0xff6a3a, mouth: 'fang' });
    S(m.head, d.R * 0.75, 0x8a8a88, 0, 0, d.R * 0.4, 1, 1, 0.7);
    for (let i = 0; i < 14; i++) { const a = (i / 13 - 0.5) * Math.PI * 1.6; const k = K(m.torso, 0.03, 0.2, 0x7a6a3a, Math.sin(a) * 0.19, d.T * 0.9, Math.cos(a) * 0.12); k.rotation.set(Math.PI + Math.cos(a) * 0.4, 0, Math.sin(a) * 0.5); }
  });
  // 犬神〈かっこいい〉：二足で立つ狐のような黒犬の霊。胸の毛は藁色、尾は煙へ薄れ、足元に霜の輪
  cool('new_c_03', 1.25, COOL(5.3), (m, c, d) => {
    const f = 0x1e1e22; hero(m, d, { skin: f, cloth: f, belly: 0xc8a860, pants: 0x2a2a30, sash: 0xb8a070, claw: 0xd8d8e0, footCol: f });
    face(m, d, { col: f, snout: 0.85, snW: 0.36, muzzle: 0x3a3a46, ears: 'fox', earIn: 0x5a5a66, eye: 'cool', glow: 0xa8e0ff, brow: false, cheek: 0xc8a860 });
    tails(m, { n: 1, kind: 'smoke', len: 0.45, w: 0.07, col: 0x3a3a44, lift: 0.7 });
    const fr = TOR(m.root, 0.34, 0.012, TR(0xc8e8ff, { opacity: 0.6, emissive: 0x6ab0e0, emissiveIntensity: 0.6 }), 0, 0.02, 0, Math.PI / 2); m.extra.fr = fr;
    more(m, (m, P, a, T) => { m.extra.fr.scale.setScalar(1 + Math.sin(T * 2) * 0.05); });
  });
  // なまはげ〈かっこいい〉：黒褐色の幅広い木面、細い目の裂け目と銅色の牙、稲藁の外套（蓑）、藍の脚絆、長い木の杖
  cool('new_c_05', 1.35, COOL(5), (m, c, d) => {
    const st = 0x9a8a50; hero(m, d, { skin: 0x6a4a3a, cloth: st, pants: 0x2a3a5a, legCol: 0x2a3a5a, skirt: 0.55, skirtCol: st, bulk: 1.2, footCol: 0x8a7a5a, cape: st, capeLen: 0.5 });
    face(m, d, { col: 0x3a2a22, scale: [1.15, 1.05, 1], eye: 'cool', glow: 0xffc040, mouth: 'fang', fangCol: 0xc8884a, hair: 'spiky', hairCol: 0xa89860 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const k = K(m.torso, 0.03, 0.18, st, Math.cos(a) * 0.14, d.T * 0.8, Math.sin(a) * 0.1); k.rotation.set(Math.PI + Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); }
    staff(m, 'R', 1.0, 0x6a4a2a);
  });
  // 狛犬〈かわいい〉：青銅色の石の守り獣の子。巻き毛のたてがみ、垂れ耳、腹に銅の鈴、ふさふさの尾
  cute('new_c_06', 0.95, CUTE(2.35), (m, c, d) => {
    const f = 0x6a8a7a; hero(m, d, { skin: f, cloth: f, belly: 0x8aa89a, legCol: f, footCol: 0x4a6a5a });
    face(m, d, { col: f, scale: [1.1, 0.95, 1], muzzle: 0x8aa89a, ears: 'flop', earCol: 0x4a6a5a, eye: 'cute', hair: 'mane', maneCol: 0x4a6a5a, maneN: 11, maneR: 0.3, mouth: 'fang' });
    S(m.torso, 0.04, 0xc88a4a, 0, d.T * 0.55, 0.13); TOR(m.torso, 0.08, 0.012, 0xc83a3a, 0, d.T * 0.88, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) B(m.torso, 0.005, 0.06, 0.005, 0x3a4a44, (i - 1.5) * 0.04, d.T * 0.25, 0.13).rotation.z = i * 0.6; // ひび
    tails(m, { n: 1, len: 0.25, w: 0.06, col: 0x4a6a5a, lift: 1.2 });
  });
  // 狐火〈かわいい〉：薄紫の毛の小さな狐の子。尾の先が灯り、白い芯と灰紫の炎の狐火が三つ周りを回る
  cute('new_b_02', 0.85, CUTE(2.3), (m, c, d) => {
    const f = 0xf0eaf8; hero(m, d, { skin: f, cloth: 0x5a4a7a, collar: 0xf0eaf8, sash: 0xf0eaf8, legCol: f, footCol: 0x8a7aa8 });
    face(m, d, { col: f, snout: 0.5, snW: 0.42, ears: 'fox', earCol: 0xb8a8d8, earIn: 0xf8e8f0, eye: 'cute' });
    tails(m, { n: 1, len: 0.3, w: 0.07, col: f, tip: E(0xb08aff, 1.2), lift: 1.0 });
    const fl = G(m.root, 0, 0.55, 0); m.extra.fl = fl; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, g = G(fl, Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36); S(g, 0.04, TR(0xb08aff, { opacity: 0.5, emissive: 0x8a5aff, emissiveIntensity: 1 }), 0, 0, 0, 1, 1.4, 1); S(g, 0.02, E(0xffffff, 1.5), 0, -0.01, 0); }
    more(m, (m, P, a, T) => { m.extra.fl.rotation.y = T * 2; m.extra.fl.position.y = 0.55 + Math.sin(T * 3) * 0.04; });
  });
  // 座敷童子〈かわいい〉：おかっぱの栗色の癖毛、丸い頬、生成りの作務衣に墨色の前掛け、背に織り座布団、手に紙風車
  cute('new_b_03', 0.85, CUTE(2.4), (m, c, d) => {
    hero(m, d, { skin: 0xf6dcc0, cloth: 0xe8e0c8, belly: 0x2a2a2a, collar: 0xb8a888, legCol: 0xe8e0c8, footCol: 0xa83a3a });
    face(m, d, { col: 0xf6dcc0, eye: 'cute', hair: 'bob', hairCol: 0x7a4a2a });
    const cu = B(m.torso, 0.24, 0.2, 0.04, 0xa83a3a, 0, d.T * 0.6, -0.14); B(cu, 0.2, 0.16, 0.042, 0xd8a040, 0, 0, 0);
    const pw = staff(m, 'R', 0.32, 0x8a6a42, (g, y) => { const w = G(g, 0, y, 0.03); m.extra.pw = w; [0xd83a3a, 0x3a8ad8, 0xf0c040, 0x3ab86a].forEach((cc, i) => { const p = PL(w, 0.06, 0.06, cc, 0, 0, 0); p.rotation.z = i * Math.PI / 2 + Math.PI / 4; p.position.set(Math.cos(i * Math.PI / 2) * 0.03, Math.sin(i * Math.PI / 2) * 0.03, 0); }); });
    more(m, (m, P, a, T) => { m.extra.pw.rotation.z = T * (a.moving ? 12 : 3); });
  });
  // 火車〈かっこいい〉：灰銀の毛の猫の妖。獅子のような長い鼻先、肩の両側に燃える黒い轍の輪、足跡に短い炎
  cool('new_b_05', 1.3, COOL(5.3), (m, c, d) => {
    const f = 0xa8aab0; hero(m, d, { skin: f, cloth: 0x3a3a40, pants: 0x3a3a40, sash: 0x8a2a2a, claw: 0xf0e8d8, footCol: 0x2a2a30, belly: 0xc8cad0 });
    face(m, d, { col: f, snout: 0.7, snW: 0.45, ears: 'cat', earIn: 0x5a5a62, eye: 'cool', glow: 0xff8a2a, brow: false, mouth: 'fang' });
    const wh = []; for (const s of [-1, 1]) { const g = G(m.torso, s * 0.26, d.T * 0.85, -0.04); g.rotation.y = Math.PI / 2; TOR(g, 0.12, 0.018, 0x1a1a1a, 0, 0, 0, 0); for (let i = 0; i < 6; i++) B(g, 0.008, 0.22, 0.01, 0x2a2a2a, 0, 0, 0).rotation.z = i * Math.PI / 6; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; K(g, 0.025, 0.08, E(0xff6a1a, 1.4), Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0).rotation.z = a - Math.PI / 2; } wh.push(g); }
    m.extra.wh = wh; for (const g of [m.legL, m.legR]) K(g, 0.04, 0.1, E(0xff7a2a, 1.3), 0, -d.legH + 0.06, 0);
    tails(m, { n: 1, kind: 'thin', len: 0.45, w: 0.06, col: f, tip: E(0xff6a1a, 1.4), lift: 0.8 });
    more(m, (m, P, a, T) => { m.extra.wh.forEach((g, i) => { g.rotation.x = T * 4 * (i ? 1 : -1); }); });
  });
  // 鬼童丸〈かっこいい〉：褐色の肌の若い山の鬼。角のない獣の面、短い黒髪、肩から片側に垂らした灰色の毛皮、大きな掌
  cool('new_b_06', 1.3, COOL(5.2), (m, c, d) => {
    const sk = 0x8a5a3a; hero(m, d, { skin: sk, cloth: sk, pants: 0x3a3a3a, sash: 0x6a6a6a, hand: 0.068, bulk: 1.15, footCol: 0x2a2a2a });
    face(m, d, { col: sk, muzzle: 0x6a4a30, eye: 'cool', glow: 0xffc040, mouth: 'fang', hair: 'spiky', hairCol: 0x141214 });
    S(m.torso, 0.1, 0x8a8a8a, -0.11, d.T * 0.92, 0, 1.2, 0.7, 1.1); PL(m.torso, 0.16, d.T * 0.8, 0x7a7a7a, -0.1, d.T * 0.5, -0.1);
    for (const s of [-1, 1]) K(m.torso, 0.02, 0.06, 0xe8e0d0, -0.11 + s * 0.04, d.T * 1.0, 0.06); // 毛皮の爪
  });
  // 一つ目小僧〈かわいい〉：大きな一つ目の陶土色の小坊主。灰色の短い法衣、丸い木靴、長い袖を拳に巻く。ぺろりと舌
  cute('new_a_02', 0.85, CUTE(2.3), (m, c, d) => {
    hero(m, d, { skin: 0xd8a878, cloth: 0x8a8a8c, collar: 0x5a5a5c, sash: 0x5a5a5c, sleeves: 0x8a8a8c, legCol: 0xd8a878, footCol: 0x8a6a42, geta: true });
    face(m, d, { col: 0xd8a878, eye: 'one', tongue: 0.45 });
  });
  // 天狗〈かっこいい〉：赤い顔に長い鼻の山伏。頭に頭襟、鼠色の羽織に白い梵天、背に杉の葉の扇、木の棒、一本歯の下駄
  cool('new_a_03', 1.4, COOL(5.6), (m, c, d) => {
    const rd = 0xb8483a; hero(m, d, { skin: rd, cloth: 0x4a4a52, collar: 0xf0f0f0, hakama: 0x6a6a72, sleeves: 0x4a4a52, legCol: 0x6a4a2a, footCol: 0x6a4a2a, geta: true });
    face(m, d, { col: rd, snout: 1.3, snW: 0.13, eye: 'cool', browCol: 0xf0f0f0, hair: 'long', hairCol: 0xe8e8e8, hat: 'tokin' });
    for (let i = 0; i < 3; i++) S(m.torso, 0.025, 0xf0f0f0, (i - 1) * 0.05, d.T * 0.62, 0.095);
    const fan = G(m.torso, 0, d.T * 0.9, -0.12); m.extra.fan = fan; for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4; const p = PL(fan, 0.05, 0.36, 0x3a6a32, Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0); p.rotation.z = -a; }
    staff(m, 'R', 1.0, 0x8a6a42);
    more(m, (m, P, a, T) => { const s = a.moving ? 1.15 : 1; m.extra.fan.scale.set(s, s, 1); });
  });
  // 青鬼童子〈かわいい〉：青緑の粘土の小鬼。平たい頭の両端に小さな角、薄茶の腰布、丸い石を両手で抱える
  cute('new_a_06', 0.85, CUTE(2.35), (m, c, d) => {
    const sk = 0x4a9a8a; hero(m, d, { skin: sk, cloth: sk, pants: 0xb89a6a, legCol: sk, footCol: 0x3a7a6a });
    C(m.torso, 0.152, 0.152, d.T * 0.22, 0xb89a6a, 0, d.T * 0.12, 0, null, 16).scale.z = 0.87;
    face(m, d, { col: sk, scale: [1.12, 0.86, 1], eye: 'cute', mouth: 'fang', horns: { n: 2, len: 0.35, w: 0.13, tilt: 0.5, x: 0.8, y: 0.55, col: 0xf0e6c8 } });
    S(m.torso, 0.09, 0x8a8a84, 0, d.T * 0.45, 0.2);
  });
  // 野衾〈かわいい〉：薄茶の毛のむささびの子。腕と体の間に年輪模様の大きな皮膜、丸い顔、短い鼻先、平たい大きな尾
  cute('new_s_02', 0.9, CUTE(2.3), (m, c, d) => {
    const f = 0xc8a878; hero(m, d, { skin: f, cloth: f, belly: 0xf0e4d0, legCol: f, footCol: 0x8a6a48 });
    face(m, d, { col: f, muzzle: 0xf0e4d0, ears: 'round', earIn: 0xe8c8b0, eye: 'cute' });
    const ring = GFX.tex(64, 64, g => { g.fillStyle = '#c8a878'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#8a6a48'; g.lineWidth = 3; for (let r = 8; r < 64; r += 10) { g.beginPath(); g.arc(0, 32, r, -1.6, 1.6); g.stroke(); } });
    const mm = L(0xffffff, { map: ring, side: THREE.DoubleSide });
    for (const [g, s] of [[m.armL, -1], [m.armR, 1]]) { const p = PL(g, 0.2, d.T * 0.95, mm, s * 0.1, -d.T * 0.35, -0.02); p.rotation.y = s * 0.2; }
    tails(m, { n: 1, kind: 'flat', len: 0.3, w: 0.13, col: f, tip: 0x8a6a48, lift: 0.5 });
  });
  // 煙々羅〈かわいい〉：香炉から立ちのぼる煙の子。体は半透明の灰色で裾は煙、顔は輪の光、三本の煙が周りを回る
  cute('new_s_03', 1.0, CUTE(2.4), (m, c, d) => {
    const sm = TR(0x9a9aa4, { opacity: 0.72 }); hero(m, d, { skin: sm, cloth: sm, noLegs: true, tailCol: TR(0x9a9aa4, { opacity: 0.5 }), handCol: sm, bobSp: 1.6 });
    face(m, d, { col: sm, eye: 'glow', glow: 0xf0f0ff, mouth: 'none' });
    TOR(m.head, d.R * 0.18, d.R * 0.04, E(0xe8e8ff, 0.8), 0, -d.R * 0.35, d.R * 0.92, 0);
    const pot = G(m.root, 0, 0, 0); C(pot, 0.16, 0.12, 0.14, 0x6a5a3a, 0, 0.07, 0, null, 14); C(pot, 0.1, 0.16, 0.05, 0x5a4a2a, 0, 0.16, 0, null, 14); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; C(pot, 0.012, 0.012, 0.06, 0x5a4a2a, Math.cos(a) * 0.12, 0.0, Math.sin(a) * 0.12); }
    const wi = G(m.torso, 0, 0, 0); m.extra.wi = wi; for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) { const a = i / 3 * Math.PI * 2 + j * 0.5; S(wi, 0.045 - j * 0.005, TR(0xb8b8c0, { opacity: 0.45 }), Math.cos(a) * 0.24, -0.15 + j * 0.12, Math.sin(a) * 0.24); }
    more(m, (m, P, a, T) => { m.extra.wi.rotation.y = T * 1.4; });
  });
  // 獅子〈かっこいい〉：錆びた鉄色の獅子の武者。硬い板状のたてがみ、長方形の口、肩に苔、息に火花
  cool('new_s_05', 1.35, COOL(5.1), (m, c, d) => {
    const f = 0x7a4a32, R = d.R; hero(m, d, { skin: f, cloth: 0x3a2a24, pants: 0x3a2a24, sash: 0xc89a4a, pads: 0x5a6a3a, pads2: 0x6a4a32, claw: 0xe8dcc0, bulk: 1.2, footCol: 0x2a2018 });
    face(m, d, { col: f, scale: [1.05, 1, 1], ears: 'side', earCol: 0x5a3a28, eye: 'cool', glow: 0xffb040 });
    B(m.head, R * 0.9, R * 0.6, R * 0.5, 0x8a5a3a, 0, -R * 0.3, R * 0.7); B(m.head, R * 0.7, R * 0.12, R * 0.1, 0x1a1210, 0, -R * 0.45, R * 0.96); S(m.head, R * 0.12, 0x1a1210, 0, -R * 0.05, R * 0.97);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const p = B(m.head, R * 0.35, R * 0.9, R * 0.08, 0x5a3a28, Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05, -R * 0.25); p.rotation.z = a - Math.PI / 2; }
    const sp = G(m.head, 0, -R * 0.45, R * 1.1); m.extra.sp = sp; for (let i = 0; i < 5; i++) S(sp, 0.008, E(0xffc040, 1.6), (i - 2) * 0.012, 0, i * 0.02);
    tails(m, { n: 1, kind: 'thin', len: 0.4, w: 0.06, col: f, tip: 0x5a3a28, lift: 0.5 });
    more(m, (m, P, a, T) => { m.extra.sp.visible = Math.sin(T * 7) > 0.2; m.extra.sp.position.z = R * 1.1 + ((T * 0.8) % 1) * 0.05; });
  });

  /* =============================== ヒーラー =============================== */
  // 一角〈かわいい〉：青白い釉薬の陶器の山羊の子。銅色の一本角、細い亀裂が暖かく光る、小さなあごひげ、蹄
  cute('new_d_01', 0.9, CUTE(2.35), (m, c, d) => {
    const g0 = 0xc8dce8, R = d.R; hero(m, d, { skin: g0, cloth: g0, collar: 0x8aa8c0, sash: 0x8aa8c0, legCol: g0, footCol: 0x5a5a62 });
    face(m, d, { col: g0, muzzle: 0xe8f0f4, noseCol: 0x8a8a92, ears: 'side', earCol: 0xb8ccd8, eye: 'cute', horns: { n: 1, len: 0.6, w: 0.12, col: 0xc8884a, y: 0.85, tilt: 0 } });
    K(m.head, R * 0.1, R * 0.35, 0xe8f0f4, 0, -R * 0.85, R * 0.6).rotation.x = Math.PI;
    const ck = E(0xffb060, 1.2); for (let i = 0; i < 5; i++) B(m.torso, 0.006, 0.07, 0.006, ck, (i - 2) * 0.05, d.T * (0.3 + (i % 3) * 0.18), 0.12 - Math.abs(i - 2) * 0.012).rotation.z = (i - 2) * 0.5;
    B(m.head, 0.005, R * 0.4, 0.005, ck, R * 0.4, R * 0.35, R * 0.8).rotation.z = 0.4;
  });
  // 山姥〈かわいい〉：赤土色の肌の小さなおばあちゃん。灰色のぼさぼさ髪、苔色の厚い外套、腰に薬草の束、湯気の立つ木鉢
  cute('new_d_08', 0.9, CUTE(2.4), (m, c, d) => {
    hero(m, d, { skin: 0xc8785a, cloth: 0x5a6a3a, collar: 0x8a7a5a, skirt: 0.85, skirtCol: 0x4a5a32, sleeves: 0x5a6a3a });
    face(m, d, { col: 0xc8785a, eye: 'happy', hair: 'spiky', hairCol: 0xa8a8a8, mouth: 'smile' });
    for (let i = 0; i < 3; i++) C(m.torso, 0.015, 0.015, 0.12, 0x6a9a3a, -0.14 + i * 0.02, d.T * 0.1, 0.06).rotation.z = 0.2;
    const bw = G(m.torso, 0, d.T * 0.32, 0.17); C(bw, 0.09, 0.06, 0.07, 0x8a5a32, 0, 0, 0, null, 14); C(bw, 0.08, 0.08, 0.01, 0xd8e8f0, 0, 0.03, 0, null, 14);
    const stm = G(bw, 0, 0.05, 0); m.extra.stm = stm; for (let i = 0; i < 3; i++) S(stm, 0.03, TR(0xffffff, { opacity: 0.5 }), (i - 1) * 0.03, i * 0.05, 0);
    more(m, (m, P, a, T) => { m.extra.stm.children.forEach((s, i) => { const k = (T * 0.6 + i / 3) % 1; s.position.y = k * 0.18; s.material.opacity = 0.5 * (1 - k); }); });
  });
  // 豆腐小僧〈かわいい〉：濃紺の筒袖の小坊主。竹の笠を浅くかぶり、四角い盆に乳白色の豆腐、回復で水滴が浮く
  cute('new_c_01', 0.85, CUTE(2.35), (m, c, d) => {
    hero(m, d, { skin: 0xf6dcc0, cloth: 0x23305a, collar: 0xe8e0c8, sash: 0xd8b040, legCol: 0xf6dcc0, footCol: 0x8a6a42, geta: true });
    face(m, d, { col: 0xf6dcc0, eye: 'cute', hat: 'kasa', hatCol: 0xc8a868 });
    const tr = G(m.torso, 0, d.T * 0.4, 0.2); B(tr, 0.22, 0.015, 0.16, 0x8a3a2a, 0, 0, 0); B(tr, 0.1, 0.07, 0.08, 0xf6f4ec, 0, 0.042, 0);
    const dr = G(tr, 0, 0.12, 0); m.extra.dr = dr; for (let i = 0; i < 3; i++) S(dr, 0.016, TR(0x9ad8ff, { opacity: 0.7, emissive: 0x4a9ad8, emissiveIntensity: 0.5 }), (i - 1) * 0.04, 0, 0);
    more(m, (m, P, a, T) => { m.extra.dr.children.forEach((s, i) => { s.position.y = Math.sin(T * 3 + i * 2) * 0.03; }); });
  });
  // 麒麟〈かっこいい〉：黒檀色の細身の霊獣。青磁色の鱗、短い一本角、鹿のような鼻先、背に光る金の毛の環、長い尾、蹄
  cool('new_c_08', 1.35, COOL(5.6), (m, c, d) => {
    const eb = 0x2a2420, R = d.R; hero(m, d, { skin: eb, cloth: eb, belly: 0x8ab8a8, pants: eb, sash: 0x8ab8a8, scarf: 0x6a9a8a, footCol: 0x141210 });
    face(m, d, { col: eb, snout: 0.6, snW: 0.38, ears: 'side', earCol: 0x3a3430, eye: 'cool', glow: 0xe8f0c0, brow: false, horns: { n: 1, len: 0.6, w: 0.1, col: 0xd8c890, y: 0.85, tilt: 0, fwd: -0.3 } });
    spots(m.torso, 8, 0.018, 0x8ab8a8, 0.1, d.T * 0.6, 0.08, d.T * 0.3, 4);
    const rg = TOR(m.head, R * 1.5, R * 0.06, E(0xe8d070, 0.9), 0, R * 0.1, -R * 0.6, 0); m.extra.rg = rg;
    tails(m, { n: 1, kind: 'thin', len: 0.5, w: 0.05, col: eb, tip: 0x8ab8a8, lift: 0.3 });
    more(m, (m, P, a, T) => { m.extra.rg.rotation.z = T * 0.8; });
  });
  // 産女〈かっこいい〉：灰桃の布を重ねた背の高い女性の霊。長い黒髪、伏せた目、腕に小さな光の包み、足元に淡い水紋
  cool('new_b_01', 1.35, COOL(5.6), (m, c, d) => {
    hero(m, d, { skin: 0xe8dcd8, cloth: 0xc8a8a8, collar: 0xa88888, sash: 0x8a6a6a, sleeves: 0xb89898, skirt: 1.0, skirtCol: 0xb89898, skirtW: 1.1 });
    face(m, d, { col: 0xe8dcd8, eye: 'closed', hair: 'long', hairCol: 0x2a2228 });
    m.extra.bundle = S(m.torso, 0.06, E(0xfff0d8, 1.2), 0, d.T * 0.55, 0.13);
    const rp = G(m.root, 0, 0.015, 0); m.extra.rp = rp; for (let i = 0; i < 3; i++) TOR(rp, 0.3, 0.008, TR(0xa8d0e8, { opacity: 0.5 }), 0, 0, 0, Math.PI / 2);
    more(m, (m, P, a, T) => { m.extra.rp.children.forEach((r, i) => { const k = (T * 0.4 + i / 3) % 1; r.scale.setScalar(0.6 + k * 1.2); r.material.opacity = 0.5 * (1 - k); }); m.extra.bundle.scale.setScalar(1 + Math.sin(T * 2.5) * 0.1); });
  });
  // 白澤〈かわいい〉：淡い青灰色のずんぐりした霊獣の子。額に縦に三つの目、頬の長い毛が筆のよう、小さな角、背に藁紙の札
  cute('new_b_08', 0.95, CUTE(2.35), (m, c, d) => {
    const f = 0xa8b8c8, R = d.R; hero(m, d, { skin: f, cloth: 0x5a6a8a, collar: 0xf0ece0, sash: 0xd8c8a0, bulk: 1.15, legCol: f, footCol: 0x7a8a9a });
    face(m, d, { col: f, muzzle: 0xd8e0e8, ears: 'flop', earCol: 0x8a9aaa, eye: 'cute', third: 0xc83a4a, third3: true, horns: { n: 2, len: 0.3, w: 0.1, col: 0xe8e0c8, x: 0.55, y: 0.75, tilt: 0.4 } });
    for (const s of [-1, 1]) { const b = K(m.head, R * 0.15, R * 0.7, 0xf0f4f8, s * R * 0.75, -R * 0.6, R * 0.35); b.rotation.x = Math.PI; }
    for (let i = 0; i < 3; i++) { const st = G(m.torso, (i - 1) * 0.07, d.T * 0.9, -0.13); C(st, 0.006, 0.006, 0.3, 0x6a5a3a, 0, 0.05, 0); B(st, 0.05, 0.12, 0.004, 0xd8c8a0, 0, 0.12, 0.01); B(st, 0.02, 0.06, 0.006, E(0xffe080, 1), 0, 0.12, 0.014); }
  });
  // 龍女〈かっこいい〉：鈍い銅色の鱗の細身の水の女性。髪の代わりに額から後ろへ薄い鰭、小さな角、灰青の長い布、掌から円い水面
  cool('new_a_01', 1.35, COOL(5.6), (m, c, d) => {
    const cu = 0xb87a4a, R = d.R; hero(m, d, { skin: cu, cloth: 0x7a8a9a, collar: cu, sleeves: 0x7a8a9a, skirt: 0.95, skirtCol: 0x4a6a7a, scarf: 0x7a8a9a });
    face(m, d, { col: cu, eye: 'cool', glow: 0x8ae0ff, brow: false, horns: { n: 2, len: 0.45, w: 0.08, col: 0xe8d8b8, x: 0.35, y: 0.8, tilt: -0.2, fwd: -0.5 } });
    for (let i = 0; i < 3; i++) { const f = PL(m.head, R * 0.5, R * (1.2 - i * 0.25), L(0x6a9aa8, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, R * (0.6 - i * 0.35), -R * (0.75 + i * 0.12)); f.rotation.y = Math.PI / 2; f.rotation.z = 0.5; }
    spots(m.torso, 6, 0.015, 0x8a5a32, 0.09, d.T * 0.6, 0.07, d.T * 0.3, 9);
    const wr = G(m.armR, 0, m.extra.handY - 0.03, 0.05); m.extra.wr = wr; TOR(wr, 0.08, 0.012, TR(0x8ad0ff, { opacity: 0.7, emissive: 0x3a8ad8, emissiveIntensity: 0.8 }), 0, 0, 0, Math.PI / 2);
    more(m, (m, P, a, T) => { m.extra.wr.rotation.y = T * 2; m.extra.wr.scale.setScalar(1 + Math.sin(T * 3) * 0.1); });
  });
  // 木霊〈実守〉〈かわいい〉：胡桃の殻のような丸い木の頭の子。深い穴の目、根の脚、背の割れ目に小さな木の実をためる
  cute('new_a_08', 0.85, CUTE(2.2), (m, c, d) => {
    const wn = 0x8a6a42, R = d.R; hero(m, d, { skin: wn, cloth: 0x6a4a2e, legCol: 0x5a3a22, footCol: 0x4a2a18, skirt: 0.2, skirtCol: 0x6a8a3a });
    face(m, d, { col: wn, scale: [1, 1.05, 0.95], eye: 'cute', eyeCol: 0x1a0e06 });
    for (let i = 0; i < 6; i++) TOR(m.head, R * 1.0, R * 0.035, 0x6a4a2a, 0, 0, 0, 0).rotation.y = i * Math.PI / 6;
    for (let i = 0; i < 4; i++) S(m.torso, 0.03, 0xa8783a, (i - 1.5) * 0.04, d.T * 0.7, -0.12);
    B(m.torso, 0.16, 0.02, 0.01, 0x2a1a0a, 0, d.T * 0.62, -0.125);
  });
  // 白狐〈かわいい〉：乳白と灰茶のまだらの小さな狐の子。左右で形の違う耳、細い一本尾、周りに浮かぶ三つの石、足元の癒しの光
  cute('new_s_01', 0.9, CUTE(2.35), (m, c, d) => {
    const f = 0xf2eee4; hero(m, d, { skin: f, cloth: 0xf8f6f0, collar: 0xc83a3a, hakama: 0xc83a3a, legCol: f, footCol: 0x8a7a6a });
    face(m, d, { col: f, snout: 0.55, snW: 0.42, ears: 'fox', earAlt: 'round', earCol: 0xb8a890, earIn: 0xf8e0e0, eye: 'cute' });
    spots(m.head, 3, 0.02, 0xa89a80, d.R * 0.5, d.R * 0.4, d.R * 0.5, 0, 6);
    tails(m, { n: 1, len: 0.3, w: 0.06, col: f, tip: 0xa89a80, lift: 0.9 });
    const st = G(m.root, 0, 0.6, 0); m.extra.st = st; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; DOD(st, 0.035, 0x8a8a84, Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32); }
    TOR(m.root, 0.28, 0.01, E(0x9aff9a, 0.8), 0, 0.02, 0, Math.PI / 2);
    more(m, (m, P, a, T) => { m.extra.st.rotation.y = -T * 1.2; m.extra.st.children.forEach((s, i) => s.position.y = Math.sin(T * 2 + i * 2) * 0.03); });
  });
  // 獏〈かわいい〉：黒褐色のねむそうな獏の子。短い鼻、背にまばらな白い点、ナイトキャップ、鼻先から琥珀の泡を吸い込む
  cute('new_s_08', 0.95, CUTE(2.35), (m, c, d) => {
    const f = 0x3a2a22, R = d.R; hero(m, d, { skin: f, cloth: f, belly: 0xe8e0d0, bulk: 1.1, legCol: f, footCol: 0x2a1a12 });
    face(m, d, { col: f, ears: 'round', earIn: 0x8a6a5a, eye: 'closed', eyeCol: 0xe8e0d0, hat: 'none' });
    const tk = G(m.head, 0, -R * 0.15, R * 0.85); m.extra.tk = tk; S(tk, R * 0.3, 0x5a4a42, 0, 0, 0, 1, 0.8, 0.8); const tr = CAP(tk, R * 0.17, R * 0.55, 0x5a4a42, 0, -R * 0.2, R * 0.3); tr.rotation.x = 1.1; S(tk, R * 0.15, 0x7a6a62, 0, -R * 0.38, R * 0.62, 1, 0.6, 0.6);
    spots(m.torso, 7, 0.018, 0xf0ece4, 0.12, 0.1, 0.1, d.T * 0.6, 8);
    const cap = K(m.head, R * 0.7, R * 1.2, 0x2a3a6a, R * 0.1, R * 1.0, -R * 0.1); cap.rotation.z = -0.5; S(m.head, R * 0.15, 0xffffff, R * 0.6, R * 1.35, -R * 0.1);
    const bb = G(m.head, 0, -R * 0.3, R * 1.6); m.extra.bb = bb; for (let i = 0; i < 4; i++) S(bb, 0.018, TR(0xffc060, { opacity: 0.7, emissive: 0xd88a20, emissiveIntensity: 0.8 }), 0, 0, 0);
    more(m, (m, P, a, T) => { m.extra.bb.children.forEach((s, i) => { const k = (T * 0.5 + i / 4) % 1; s.position.set(Math.sin(i * 2) * 0.05 * (1 - k), Math.cos(i * 3) * 0.04 * (1 - k), (1 - k) * 0.25); s.scale.setScalar(1 - k * 0.6); }); m.extra.tk.rotation.x = Math.sin(T * 2) * 0.15; });
  });

  /* =============================== レンジャー =============================== */
  // 夢の精霊〈かわいい〉：紺色の寝間着のねむり顔の浮かぶ子。ナイトキャップ、周りに紺の輪が三層、枕形の石が回る
  cute('new_d_07', 0.9, CUTE(2.35), (m, c, d) => {
    const nv = 0x2a3a6a; hero(m, d, { skin: 0xd8d8f0, cloth: nv, collar: 0xc8c8e8, sleeves: nv, noLegs: true, tailCol: TR(nv, { opacity: 0.8 }), bobSp: 1.4 });
    face(m, d, { col: 0xd8d8f0, eye: 'closed', eyeCol: 0x8a8ab0 });
    const R = d.R, cap = K(m.head, R * 0.85, R * 1.4, nv, R * 0.15, R * 1.05, -R * 0.1); cap.rotation.z = -0.6; S(m.head, R * 0.18, 0xffffff, R * 0.8, R * 1.45, -R * 0.1);
    spots(m.torso, 5, 0.012, E(0xf0f0ff, 1.2), 0.12, d.T * 0.5, 0.1, d.T * 0.3, 11);
    const rs = G(m.torso, 0, d.T * 0.5, 0); m.extra.rs = rs; for (let i = 0; i < 3; i++) { const t = TOR(rs, 0.24 + i * 0.05, 0.008, TR(0x3a4a8a, { opacity: 0.7 }), 0, (i - 1) * 0.06, 0, Math.PI / 2 + (i - 1) * 0.3); }
    const pw = G(m.root, 0, 0.5, 0); m.extra.pw = pw; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; S(pw, 0.05, 0xd8d8e8, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4, 1.3, 0.5, 0.9); }
    more(m, (m, P, a, T) => { m.extra.rs.rotation.y = T * 0.8; m.extra.pw.rotation.y = T * 1.1; });
  });
  // 鬼女〈かっこいい〉：灰色の肌と短い銀髪の女鬼。片側だけ伸びた角、焦げ茶の麻衣、長い指の先に影の輪
  cool('new_d_10', 1.35, COOL(5.6), (m, c, d) => {
    const R = d.R; hero(m, d, { skin: 0x9a9aa0, cloth: 0x4a3a2a, collar: 0x6a5a4a, sleeves: 0x4a3a2a, skirt: 0.9, skirtCol: 0x4a3a2a, claw: 0x4a4a52 });
    face(m, d, { col: 0x9a9aa0, eye: 'cool', glow: 0xd84aff, hair: 'short', hairCol: 0xd8dce4 });
    for (let i = 0; i < 5; i++) { const k = K(m.head, R * 0.18, R * 0.6, 0xd8dce4, (i - 2) * R * 0.3, R * 0.55, R * 0.55); k.rotation.x = 1.8; } // 前髪
    const hn = K(m.head, R * 0.13, R * 0.7, 0xe8e0d0, R * 0.5, R * 1.05, 0); hn.rotation.z = -0.4;
    const rs = []; for (const g of [m.armL, m.armR]) { const r = TOR(g, 0.06, 0.008, E(0x6a2a8a, 1), 0, m.extra.handY - 0.08, 0, Math.PI / 2); rs.push(r); } m.extra.rs = rs;
    more(m, (m, P, a, T) => { m.extra.rs.forEach((r, i) => { r.rotation.z = T * 3 * (i ? 1 : -1); r.scale.setScalar(1 + Math.sin(T * 4 + i) * 0.15); }); });
  });
  // 青坊主〈かっこいい〉：青磁色のつるりとした頭、点のように小さい光る目、額の窪み、墨色の法衣、衣の内から雷光の糸、錫杖
  cool('new_c_10', 1.35, COOL(5.4), (m, c, d) => {
    const R = d.R; hero(m, d, { skin: 0x7ab8a8, cloth: 0x1a1a22, collar: 0x8a7a4a, sleeves: 0x1a1a22, skirt: 1.0, skirtCol: 0x1a1a22, skirtW: 1.1 });
    face(m, d, { col: 0x7ab8a8, scale: [1, 1.1, 1], eye: 'glow', glow: 0xf0f8ff, sep: 0.3 });
    S(m.head, R * 0.1, 0x4a8a7a, 0, R * 0.5, R * 0.85);
    B(m.torso, 0.05, d.T * 1.0, 0.2, 0x8a7a4a, 0, d.T * 0.55, 0.0).rotation.z = 0.55;
    const th = G(m.torso, 0, 0, 0); m.extra.th = th; for (let i = 0; i < 5; i++) { const b = B(th, 0.006, 0.18, 0.006, E(0x9ad8ff, 1.5), (i - 2) * 0.06, -d.legH * 0.4 + (i % 2) * 0.1, 0.13 - Math.abs(i - 2) * 0.02); b.rotation.z = (i % 2 ? 0.4 : -0.4); }
    staff(m, 'R', 1.0, 0x6a5a3a, (g, y) => { TOR(g, 0.06, 0.008, 0xc8a85a, 0, y + 0.05, 0, 0); for (const s of [-1, 1]) TOR(g, 0.025, 0.005, 0xc8a85a, s * 0.06, y, 0, Math.PI / 2); });
    more(m, (m, P, a, T) => { m.extra.th.visible = Math.sin(T * 9) > -0.1; });
  });
  // 赤舌〈かわいい〉：黒い雨雲の頭巾をかぶった子。大きな朱色の舌、銅色の小さな目、灰色の雨合羽、手に土の玉
  cute('new_b_07', 0.9, CUTE(2.35), (m, c, d) => {
    const R = d.R; hero(m, d, { skin: 0x3a3a46, cloth: 0x4a4a58, collar: 0x2a2a34, legCol: 0x4a4a58, footCol: 0x2a2a34 });
    face(m, d, { col: 0x3a3a46, eye: 'cute', eyeCol: 0xc8783a, tongue: 1.1, mouth: 'none', blush: false });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; S(m.head, R * 0.45, 0x22222c, Math.cos(a) * R * 0.85, R * 0.35 + Math.sin(a) * R * 0.45, -R * 0.15 - Math.abs(Math.sin(a)) * R * 0.1); }
    S(m.head, R * 0.6, 0x22222c, 0, R * 0.8, -R * 0.1, 1.4, 0.8, 1);
    S(m.armR, 0.05, 0x6a4a2a, 0, m.extra.handY - 0.04, 0.04);
    const rn = G(m.head, 0, -R * 0.2, 0); m.extra.rn = rn; for (let i = 0; i < 4; i++) S(rn, 0.012, TR(0x8ab8e8, { opacity: 0.8 }), (i - 1.5) * R * 0.45, 0, -R * 0.3);
    more(m, (m, P, a, T) => { m.extra.rn.children.forEach((s, i) => { s.position.y = -((T * 0.8 + i / 4) % 1) * 0.3; }); if (m.extra.tongue) m.extra.tongue.rotation.x = 0.6 + Math.sin(T * 4) * 0.15; });
  });
  // 人魂〈かわいい〉：琥珀色の炎の頭の小さな霊。炎の先が揺れ、黒い寝間着、裾はほどけて浮き、平たい火の欠片を残す
  cute('new_b_10', 0.8, CUTE(2.25), (m, c, d) => {
    const R = d.R, fl = E(0xffb030, 1.0); hero(m, d, { skin: fl, cloth: 0x3a2a22, collar: 0xffb030, noLegs: true, tailCol: TR(0x3a2a22, { opacity: 0.8 }), handCol: L(0xffd080, { emissive: 0xff9a30, emissiveIntensity: 0.6 }) });
    face(m, d, { col: fl, eye: 'cute', eyeCol: 0x2a1004, blush: false });
    const tip = K(m.head, R * 0.6, R * 1.4, E(0xffc040, 1.2), 0, R * 1.0, -R * 0.2); m.extra.tip = tip; K(m.head, R * 0.35, R * 0.8, E(0xff7a20, 1.3), R * 0.45, R * 0.7, -R * 0.1).rotation.z = -0.5;
    const ash = G(m.root, 0, 0.02, 0); m.extra.ash = ash; for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const p = PL(ash, 0.06, 0.04, E(0xff8a2a, 0.9), Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32); p.rotation.x = -Math.PI / 2; }
    more(m, (m, P, a, T) => { m.extra.tip.rotation.z = Math.sin(T * 6) * 0.2; m.extra.tip.scale.y = 1 + Math.sin(T * 9) * 0.1; m.extra.ash.children.forEach((p, i) => p.visible = Math.sin(T * 3 + i * 1.6) > 0); });
  });
  // 鉄鼠〈かっこいい〉：黒鉄色の硬い毛の大鼠の僧兵。半円の耳、銅色の板状の歯、背に古い釘の毛、数珠、ぼろの法衣、細長い尾
  cool('new_a_10', 1.25, COOL(5.2), (m, c, d) => {
    const f = 0x3a3c42, R = d.R; hero(m, d, { skin: f, cloth: 0x2a2a30, collar: 0x6a6a72, sash: 0xc8884a, hakama: 0x3a3a42, claw: 0xc8c0b0, footCol: f });
    face(m, d, { col: f, snout: 0.75, snW: 0.42, ears: 'round', earIn: 0xa88a8a, eye: 'cool', glow: 0xff3a3a, brow: false });
    for (const s of [-1, 1]) B(m.head, R * 0.12, R * 0.22, R * 0.05, 0xc8884a, s * R * 0.07, -R * 0.45, R * 1.1);
    for (let i = 0; i < 10; i++) { const a = (i / 9 - 0.5) * 2; const k = K(m.torso, 0.012, 0.12, 0x6a4a3a, Math.sin(a) * 0.08, d.T * (0.5 + (i % 3) * 0.15), -0.08 - Math.cos(a) * 0.01); k.rotation.x = -1.2; }
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; S(m.torso, 0.016, 0x6a3a2a, Math.cos(a) * 0.1, d.T * 0.92 - Math.sin(a) * 0.02 - (Math.sin(a) > 0 ? 0 : 0.06 * Math.abs(Math.sin(a))), Math.sin(a) * 0.08); }
    tails(m, { n: 1, kind: 'thin', len: 0.42, w: 0.04, col: 0x8a7a7a, lift: 0.35 });
  });
  // 覚〈かっこいい〉：灰白の長い毛の細身の山の怪。目は前髪の下で光り、胸の毛が渦を巻く、掌から墨の粒を広げる
  cool('new_s_07', 1.3, COOL(5.3), (m, c, d) => {
    const f = 0xd8d8d0, R = d.R; hero(m, d, { skin: 0x9a9a94, cloth: f, sleeve: f, pants: f, legCol: f, armLen: d.T * 1.1, footCol: 0x8a8a84 });
    face(m, d, { col: f, muzzle: 0x9a9a94, nose: false, eye: 'glow', glow: 0xa8d8ff });
    for (let i = 0; i < 7; i++) { const k = K(m.head, R * 0.2, R * 0.9, f, (i - 3) * R * 0.22, R * 0.35, R * 0.75); k.rotation.x = 2.3; }
    for (let i = 0; i < 3; i++) TOR(m.torso, 0.02 + i * 0.02, 0.006, 0x8a8a84, 0.0, d.T * 0.7, 0.095, 0, Math.PI * 1.5).rotation.z = i * 1.2;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const k = K(m.torso, 0.03, 0.16, f, Math.cos(a) * 0.12, d.T * 0.2, Math.sin(a) * 0.08); k.rotation.x = Math.PI; }
    const ink = G(m.armR, 0, m.extra.handY - 0.04, 0.04); m.extra.ink = ink; for (let i = 0; i < 4; i++) S(ink, 0.014, 0x0e0e12, 0, 0, 0);
    more(m, (m, P, a, T) => { m.extra.ink.children.forEach((s, i) => { const k = (T * 0.7 + i / 4) % 1; s.position.set(Math.cos(i * 1.7) * k * 0.12, -k * 0.04, Math.sin(i * 1.7) * k * 0.12); }); });
  });
  // 土蜘蛛〈かっこいい〉：岩粒の茶褐色の蜘蛛の忍び。顔に六つの小さな赤い眼、口元を覆う布、背から四本の蜘蛛の脚（先に銅の環）、背の平たい円盤
  cool('new_s_10', 1.3, COOL(5.3), (m, c, d) => {
    const f = 0x6a4a32, R = d.R; hero(m, d, { skin: f, cloth: 0x3a2a20, pants: 0x3a2a20, sash: 0xc8884a, scarf: 0x2a1a12, footCol: 0x2a1a12 });
    face(m, d, { col: f, eye: 'none', hair: 'short', hairCol: 0x2a1a12 });
    for (const [x, y] of [[-0.3, 0.12], [0.3, 0.12], [-0.15, 0.28], [0.15, 0.28], [-0.42, -0.02], [0.42, -0.02]]) glowEye(m.head, R * 0.07, x * R, y * R, ez(R, x * R, y * R) - R * 0.03, 0xff3a2a);
    B(m.head, R * 1.5, R * 0.5, R * 0.3, 0x2a1a12, 0, -R * 0.45, R * 0.75);
    S(m.torso, 0.18, 0x5a4a3a, 0, d.T * 0.55, -0.15, 1, 0.75, 0.35);
    const lg = []; for (const s of [-1, 1]) for (const k of [0, 1]) { const g = G(m.torso, s * 0.06, d.T * (0.75 - k * 0.25), -0.12); g.rotation.set(0.2, 0, s * (1.0 + k * 0.4)); const u = CAP(g, 0.018, 0.24, f, 0, 0.14, 0); const j = G(g, 0, 0.3, 0); j.rotation.z = -s * 1.8; CAP(j, 0.014, 0.26, f, 0, 0.15, 0); TOR(j, 0.02, 0.006, 0xc8884a, 0, 0.27, 0, Math.PI / 2); lg.push(j); }
    m.extra.lg = lg;
    more(m, (m, P, a, T) => { m.extra.lg.forEach((j, i) => { j.rotation.x = Math.sin(T * (a.moving ? 10 : 2) + i * 1.5) * 0.25; }); });
  });

  /* =============================== タンク =============================== */
  // 酒呑童子〈かっこいい〉：墨色の肌の大柄な鬼の頭領。銅色の短い角、赤い蓬髪、背に白木の小樽、両腕を太い縄で巻く、灰青の短い袴
  cool('new_d_04', 1.45, COOL(5), (m, c, d) => {
    const sk = 0x2a2a30, R = d.R; hero(m, d, { skin: sk, cloth: sk, pants: 0x6a7a8a, skirt: 0.45, skirtCol: 0x6a7a8a, sash: 0xb8a070, bulk: 1.45, hand: 0.07, footCol: 0x1a1a1e });
    face(m, d, { col: sk, eye: 'cool', glow: 0xffc040, mouth: 'fang', hair: 'spiky', hairCol: 0xa83a2a, horns: { n: 2, len: 0.5, w: 0.13, col: 0xc8884a, x: 0.45, y: 0.85, tilt: 0.25 } });
    const br = C(m.torso, 0.12, 0.12, 0.26, 0xe8dcc0, 0, d.T * 0.7, -0.22, null, 14); br.rotation.z = Math.PI / 2; for (const x of [-0.09, 0, 0.09]) { const b = C(m.torso, 0.125, 0.125, 0.015, 0x6a4a2a, x, d.T * 0.7, -0.22, null, 14); b.rotation.z = Math.PI / 2; }
    for (const g of [m.armL, m.armR]) for (let i = 0; i < 4; i++) TOR(g, 0.05, 0.014, 0xb8a070, 0, m.extra.handY * (0.35 + i * 0.13), 0, Math.PI / 2 + (i % 2 ? 0.25 : -0.25));
  });
  // 片輪車〈かっこいい〉：背に燃える大車輪を背負う車引きの武者。赤茶の木の輪に青銅の帯、軸に沈んだ石の顔、輪の下に炎
  cool('new_d_09', 1.35, COOL(5.2), (m, c, d) => {
    const R = d.R; hero(m, d, { skin: 0xd8b898, cloth: 0x6a3a2a, pants: 0x3a2a24, pads: 0x8a7a4a, pads2: 0x6a3a2a, sash: 0x8a7a4a, bulk: 1.25, footCol: 0x2a1a14, scarf: 0xc84a2a });
    face(m, d, { col: 0xd8b898, eye: 'cool', glow: 0xffa040, hair: 'spiky', hairCol: 0x2a1a14, hat: 'band', hatCol: 0x8a7a4a });
    const wh = G(m.torso, 0, d.T * 0.6, -0.2); m.extra.wh = wh; TOR(wh, 0.34, 0.035, 0x8a4a2a, 0, 0, 0, 0); TOR(wh, 0.36, 0.01, 0x8a7a4a, 0, 0, 0.02, 0); for (let i = 0; i < 8; i++) B(wh, 0.03, 0.66, 0.025, 0x7a3a22, 0, 0, 0).rotation.z = i * Math.PI / 8;
    const hub = S(m.torso, 0.09, 0x8a8a84, 0, d.T * 0.6, -0.17); for (const s of [-1, 1]) glowEye(m.torso, 0.012, s * 0.03, d.T * 0.62, -0.08, 0xffa040);
    const fi = G(m.torso, 0, d.T * 0.6 - 0.36, -0.2); m.extra.fi = fi; for (let i = 0; i < 5; i++) K(fi, 0.04, 0.16, E(i % 2 ? 0xff6a1a : 0xffb030, 1.4), (i - 2) * 0.05, 0, 0);
    more(m, (m, P, a, T) => { m.extra.wh.rotation.z = -T * (a.moving ? 6 : 1.5); m.extra.fi.children.forEach((k, i) => k.scale.y = 1 + Math.sin(T * 12 + i) * 0.3); });
  });
  // 牛鬼〈かっこいい〉：太い角の牛の頭の大鬼。背は青錆色の甲羅、腹側に生成りの長い毛、石の脚
  cool('new_c_09', 1.45, COOL(4.8), (m, c, d) => {
    const f = 0x3a3a40, R = d.R; hero(m, d, { skin: f, cloth: f, pants: 0x7a7a74, legCol: 0x7a7a74, belly: 0xe8e0c8, bulk: 1.45, hand: 0.07, claw: 0xe8e0c8, footCol: 0x5a5a54 });
    face(m, d, { col: f, scale: [1.1, 1, 1.05], muzzle: 0x5a5a60, noseCol: 0x1a1a1a, ears: 'side', eye: 'cool', glow: 0xff3a3a, horns: { n: 2, len: 1.1, w: 0.22, col: 0xe8e0c8, x: 0.8, y: 0.5, tilt: 0.85 } });
    TOR(m.head, R * 0.12, R * 0.03, 0xc8a85a, 0, -R * 0.45, R * 1.05, 0);
    const sh = S(m.torso, 0.2, 0x4a7a6a, 0, d.T * 0.6, -0.1, 1.05, 1.05, 0.55); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; S(m.torso, 0.05, 0x3a6a5a, Math.cos(a) * 0.1, d.T * 0.6 + Math.sin(a) * 0.1, -0.2, 1, 1, 0.3); }
    for (let i = 0; i < 6; i++) { const k = K(m.torso, 0.02, 0.18, 0xe8e0c8, (i - 2.5) * 0.04, d.T * 0.12, 0.09); k.rotation.x = Math.PI; }
  });
  // 塗壁〈かわいい〉：灰茶の土壁でできた大きな四角い子。壁の真ん中に顔、光るひびが一本、短い手足、足元に小石
  cute('new_b_04', 1.05, CUTE(2.6, 0.22), (m, c, d) => {
    const w = 0x9a8a72, R = d.R; hero(m, d, { skin: w, cloth: w, bulk: 1.2, legCol: 0x7a6a52, footCol: 0x6a5a42, armLen: d.T * 0.5 });
    const H = d.T + R * 2.2, wall = B(m.torso, 0.56, H, 0.26, w, 0, H / 2 - 0.02, 0);
    for (let i = 0; i < 5; i++) B(m.torso, 0.565, 0.006, 0.265, 0x7a6a52, 0, 0.08 + i * H / 5, 0);
    for (const s of [-1, 1]) { const p = B(m.torso, 0.2, H * 0.92, 0.22, 0x8a7a62, s * 0.34, H * 0.46, -0.04); p.rotation.y = s * 0.5; }
    B(m.torso, 0.012, H * 0.5, 0.012, E(0xffe0a0, 1.2), 0.05, H * 0.35, 0.132).rotation.z = 0.15;
    m.head.position.set(0, H * 0.7, 0); m.head.scale.setScalar(1.7); // 顔は壁の上の方。壁に合わせて大きく
    face(m, d, { shape: 'none', flatZ: 0.42, eye: 'cute', sep: 0.5, mouth: 'smile' });
    for (let i = 0; i < 5; i++) S(m.root, 0.035, 0x8a8a84, (i - 2) * 0.1, 0.03, 0.18 - (i % 2) * 0.05);
  });
  // 亡者〈かっこいい〉：麻布の細長い帯で人の形を縫い留めた霊。空洞の顔に赤い光、胸に赤銅の鈴、盾のように広い両袖
  cool('new_b_09', 1.35, COOL(5.4), (m, c, d) => {
    const hm = 0xc8b898, R = d.R; hero(m, d, { skin: hm, cloth: hm, sleeves: 0xb8a888, pants: hm, bulk: 1.2, footCol: 0xa89878 });
    face(m, d, { col: hm, eye: 'glow', glow: 0xc84a3a });
    S(m.head, R * 0.55, 0x1a1410, 0, -R * 0.05, R * 0.62, 1.1, 1, 0.5); for (const s of [-1, 1]) glowEye(m.head, R * 0.1, s * R * 0.25, 0, R * 0.9, 0xc84a3a);
    for (let i = 0; i < 4; i++) TOR(m.head, R * 1.01, R * 0.05, 0xa89878, 0, R * (0.55 - i * 0.35), 0, Math.PI / 2 + (i % 2 ? 0.2 : -0.2));
    for (let i = 0; i < 6; i++) TOR(m.torso, 0.1 - Math.abs(i - 3) * 0.004, 0.012, 0xa89878, 0, d.T * (0.1 + i * 0.16), 0, Math.PI / 2 + (i % 2 ? 0.2 : -0.2)).scale.y = 0.8;
    for (const g of [m.legL, m.legR]) for (let i = 0; i < 4; i++) TOR(g, 0.045, 0.01, 0xa89878, 0, -d.legH * (0.15 + i * 0.22), 0, Math.PI / 2 + (i % 2 ? 0.25 : -0.25));
    const bl = G(m.torso, 0, d.T * 0.62, 0.1); m.extra.bl = bl; C(bl, 0.012, 0.035, 0.05, 0xb86a3a, 0, -0.03, 0); S(bl, 0.01, 0x4a2a1a, 0, -0.06, 0);
    for (const [g, s] of [[m.armL, -1], [m.armR, 1]]) { const p = PL(g, 0.22, d.T * 0.8, L(0xb8a888, { side: THREE.DoubleSide }), s * 0.05, -d.T * 0.45, 0.06); p.rotation.y = s * 0.25; }
    more(m, (m, P, a, T) => { m.extra.bl.rotation.z = Math.sin(T * 4) * 0.3; });
  });
  // 茨木童子〈かっこいい〉：黄土色の肌と短い白角の片腕の鬼。失った左腕の代わりに浮かぶ小岩が掌を作る、深緑の短い衣
  cool('new_a_04', 1.4, COOL(5.1), (m, c, d) => {
    const sk = 0xc89a4a, R = d.R; hero(m, d, { skin: sk, cloth: 0x2a4a32, collar: 0x8a7a4a, sash: 0x8a7a4a, skirt: 0.4, skirtCol: 0x2a4a32, pants: 0x2a4a32, legCol: sk, bulk: 1.3, hand: 0.065, footCol: 0x3a2a1a });
    face(m, d, { col: sk, eye: 'cool', glow: 0xffe040, mouth: 'fang', hair: 'short', hairCol: 0x2a2a20, horns: { n: 2, len: 0.45, w: 0.11, col: 0xf6f4ee, x: 0.4, y: 0.85, tilt: 0.2 } });
    m.armL.children.slice().forEach(ch => m.armL.remove(ch)); // 左腕はない
    B(m.torso, 0.06, 0.06, 0.08, 0x2a4a32, -0.17, d.T * 0.9, 0);
    const rk = G(m.armL, -0.03, m.extra.handY * 0.85, 0.05); m.extra.rk = rk; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; DOD(rk, 0.03 + (i % 2) * 0.01, 0x7a7a74, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0); }
    more(m, (m, P, a, T) => { m.extra.rk.children.forEach((r, i) => { r.position.z = Math.sin(T * 3 + i) * 0.015; r.rotation.y = T + i; }); });
  });
  // 文福茶釜〈かわいい〉：黒銅の丸い茶釜の体の狸。目のまわりの黒い模様、丸い耳、注ぎ口から湯気、しま模様のふさふさの尾
  cute('new_a_09', 0.9, CUTE(2.35), (m, c, d) => {
    const R = d.R, tn = 0x8a6a48; hero(m, d, { skin: tn, cloth: 0x2a2a28, bulk: 1.3, legCol: tn, footCol: 0x4a3a2a });
    TOR(m.torso, 0.15, 0.015, 0x4a4a44, 0, d.T * 0.82, 0, Math.PI / 2); for (const s of [-1, 1]) TOR(m.torso, 0.03, 0.01, 0x4a4a44, s * 0.2, d.T * 0.7, 0, 0).rotation.y = Math.PI / 2;
    const sp = C(m.torso, 0.025, 0.04, 0.14, 0x2a2a28, 0.18, d.T * 0.5, 0.08); sp.rotation.z = -1.0;
    face(m, d, { col: tn, muzzle: 0xd8c0a0, ears: 'round', earCol: 0x3a2a1a, eye: 'cute' });
    for (const s of [-1, 1]) S(m.head, R * 0.24, 0x3a2a1a, s * R * 0.38, -R * 0.04, ez(R, R * 0.38, R * 0.04) - R * 0.12, 1.2, 0.95, 0.4);
    const stm = G(m.torso, 0.25, d.T * 0.58, 0.08); m.extra.stm = stm; for (let i = 0; i < 3; i++) S(stm, 0.03, TR(0xf0f0f0, { opacity: 0.5 }), 0, 0, 0);
    tails(m, { n: 1, len: 0.25, w: 0.07, col: tn, tip: 0x3a2a1a, lift: 0.6 });
    more(m, (m, P, a, T) => { m.extra.stm.children.forEach((s, i) => { const k = (T * 0.7 + i / 3) % 1; s.position.set(k * 0.06, k * 0.2, 0); s.material.opacity = 0.5 * (1 - k); s.scale.setScalar(1 + k); }); });
  });
  // 大百足〈かっこいい〉：黒い木の節をつないだ鎧の武者。節の間が銅色に光り、牙のある兜、背から両脇へ並ぶ細い脚
  cool('new_s_04', 1.4, COOL(5.2), (m, c, d) => {
    const bk = 0x1e1a18, R = d.R, cu = E(0xc8783a, 0.9); hero(m, d, { skin: bk, cloth: bk, pants: bk, pads: 0x2a2420, pads2: 0x2a2420, bulk: 1.25, footCol: 0x141210 });
    for (let i = 0; i < 5; i++) TOR(m.torso, 0.11 - Math.abs(i - 2.5) * 0.006, 0.008, cu, 0, d.T * (0.15 + i * 0.17), 0, Math.PI / 2).scale.y = 0.8;
    for (const g of [m.armL, m.armR, m.legL, m.legR]) for (let i = 1; i < 4; i++) TOR(g, 0.042, 0.007, cu, 0, -(g === m.legL || g === m.legR ? d.legH : -m.extra.handY) * i / 4, 0, Math.PI / 2);
    face(m, d, { col: bk, eye: 'glow', glow: 0xffa040 });
    S(m.head, R * 1.1, 0x2a2420, 0, R * 0.2, -R * 0.05, 1, 0.8, 1.05);
    for (const s of [-1, 1]) { const mn = TOR(m.head, R * 0.45, R * 0.07, 0x8a5a2a, s * R * 0.25, -R * 0.55, R * 0.7, Math.PI / 2, Math.PI * 0.8); mn.rotation.z = s > 0 ? Math.PI * 0.6 : -Math.PI * 0.4 + Math.PI; }
    const ls = []; for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const g = G(m.torso, s * 0.1, d.T * (0.2 + i * 0.14), -0.06); g.rotation.z = s * 1.3; g.rotation.y = s * 0.4; CAP(g, 0.01, 0.13, 0x3a2a22, 0, 0.08, 0); ls.push(g); }
    m.extra.ls = ls;
    more(m, (m, P, a, T) => { m.extra.ls.forEach((g, i) => { g.rotation.x = Math.sin(T * (a.moving ? 12 : 3) - Math.floor(i / 2) * 0.9) * 0.4; }); });
  });
  // 八岐大蛇〈かっこいい〉：河原石のような灰白の鱗の大きな蛇の武者。暗い朱色の目、背から八本の蛇の首が扇のように立ち上がる
  cool('new_s_09', 1.5, COOL(5.2), (m, c, d) => {
    const sc = 0xd8d4cc, R = d.R; hero(m, d, { skin: sc, cloth: 0x8a8680, pants: 0x6a6660, pads: 0xa8a49c, pads2: 0x8a8680, sash: 0x8a2a2a, bulk: 1.35, claw: 0x6a6660, footCol: 0x5a5650 });
    face(m, d, { col: sc, snout: 0.45, snW: 0.5, eye: 'cool', glow: 0xb81a1a, brow: false });
    spots(m.torso, 10, 0.02, 0xb8b4ac, 0.12, d.T * 0.6, 0.09, d.T * 0.3, 5);
    const nk = []; for (let i = 0; i < 8; i++) { const a = (i / 7 - 0.5) * 2.6, g = G(m.torso, Math.sin(a) * 0.06, d.T * 0.8, -0.1); g.rotation.set(-0.35, 0, -a * 0.75); for (let j = 0; j < 7; j++) S(g, 0.026 - j * 0.001, j % 2 ? sc : 0xb8b4ac, Math.sin(j * 0.5) * 0.02, j * 0.05, -Math.sin(j * 0.3) * 0.03); const h = G(g, 0, 0.36, 0.0); S(h, 0.035, sc, 0, 0, 0.02, 1, 0.75, 1.4); for (const s of [-1, 1]) glowEye(h, 0.008, s * 0.018, 0.012, 0.06, 0xb81a1a); nk.push(g); }
    m.extra.nk = nk;
    tails(m, { n: 3, kind: 'thin', len: 0.5, w: 0.06, col: sc, spread: 1.0, lift: -0.3 });
    more(m, (m, P, a, T) => { const st = Math.max(0, -Math.min(P.aRx, P.aLx)); m.extra.nk.forEach((g, i) => { g.rotation.x = -0.35 + Math.sin(T * 2 + i) * 0.12 + st * 0.3; }); });
  });

  /* ---------- 登録：makeChar から使う。身長は見た目の大きさ（当たり判定は別）。style＝かわいい系／かっこいい系 ---------- */
  const LOOK8 = {"kogemaru": "敷石に縛られた霊の武者。黒い紙片の羽織、白い細縄を拳と胸に巻く、紙片が周りを渦巻く。裾は霊気へほどける", "hoshisuzume": "頭が灯る提灯の子。竹骨の輪と琥珀の光、上の紐が尾のように揺れる。法被姿で小さな火を持つ", "akaneten": "立った人型の狐。灰白と墨色のまだら毛、墨色の着物、背に長く平たい九本の尾、手に青い狐火", "kagetsubame": "黒い岩のような鱗の人型。腹に青磁の筋、頭の後ろに二枚の鰭、太い大蛇が胴に巻きつき肩から頭を出す", "sayanosuke": "欠けた古刀を握る侍の霊。紺の着物に袴、腰に黒い木鞘、柄に麻縄。目は鋼色に光る", "taiko": "青銅の肌と短い横角の山の守り手。四角い顎、生成りの布、背に石鼓の輪を背負い素手で音の輪を打つ", "burikidon": "中身のない古い鉄の鎧武者。兜の上に三枚の鉄板が浮き、面頬の奥に二つの光。大袖で守る", "norenbou": "墨色の和傘を頭にかぶった子。傘の縁に切れた紙、ぺろりと舌を出し、一本歯の下駄。攻撃で傘を閉じて突く", "kemuridama": "白い着物に額の三角布の小さな霊。裾はほどけて浮き、袖の先で小さな光をすくう", "momiji": "切り株の頭に白い野花を咲かせた木の子。葉の腰みの、足元に花びらの輪", "new_d_02": "煤色の長毛のぽっちゃり老猫。琥珀の目、着物に黄色い帯、先が二つに分かれた二本の尾、背に灰色の斑点", "new_d_03": "細身の茶褐色の山猫の忍び。欠けた片耳、背に苔色の毛、長い爪、細い一本尾", "new_d_05": "白い蛇の頭巾をかぶった子。腹側は淡い銅色、肩に小さな白蛇が巻きつき、両手の間に光をためる", "new_c_02": "焦げ茶の長毛の大猿の戦士。灰色の顔、赤土色の前腕、肩から垂れる蓑状の毛、長い腕", "new_c_03": "二足で立つ狐のような黒犬の霊。胸の毛は藁色、尾は煙へ薄れ、足元に霜の輪", "new_c_05": "黒褐色の幅広い木面、細い目の裂け目と銅色の牙、稲藁の外套（蓑）、藍の脚絆、長い木の杖", "new_c_06": "青銅色の石の守り獣の子。巻き毛のたてがみ、垂れ耳、腹に銅の鈴、ふさふさの尾", "new_b_02": "薄紫の毛の小さな狐の子。尾の先が灯り、白い芯と灰紫の炎の狐火が三つ周りを回る", "new_b_03": "おかっぱの栗色の癖毛、丸い頬、生成りの作務衣に墨色の前掛け、背に織り座布団、手に紙風車", "new_b_05": "灰銀の毛の猫の妖。獅子のような長い鼻先、肩の両側に燃える黒い轍の輪、足跡に短い炎", "new_b_06": "褐色の肌の若い山の鬼。角のない獣の面、短い黒髪、肩から片側に垂らした灰色の毛皮、大きな掌", "new_a_02": "大きな一つ目の陶土色の小坊主。灰色の短い法衣、丸い木靴、長い袖を拳に巻く。ぺろりと舌", "new_a_03": "赤い顔に長い鼻の山伏。頭に頭襟、鼠色の羽織に白い梵天、背に杉の葉の扇、木の棒、一本歯の下駄", "new_a_06": "青緑の粘土の小鬼。平たい頭の両端に小さな角、薄茶の腰布、丸い石を両手で抱える", "new_s_02": "薄茶の毛のむささびの子。腕と体の間に年輪模様の大きな皮膜、丸い顔、短い鼻先、平たい大きな尾", "new_s_03": "香炉から立ちのぼる煙の子。体は半透明の灰色で裾は煙、顔は輪の光、三本の煙が周りを回る", "new_s_05": "錆びた鉄色の獅子の武者。硬い板状のたてがみ、長方形の口、肩に苔、息に火花", "new_d_01": "青白い釉薬の陶器の山羊の子。銅色の一本角、細い亀裂が暖かく光る、小さなあごひげ、蹄", "new_d_08": "赤土色の肌の小さなおばあちゃん。灰色のぼさぼさ髪、苔色の厚い外套、腰に薬草の束、湯気の立つ木鉢", "new_c_01": "濃紺の筒袖の小坊主。竹の笠を浅くかぶり、四角い盆に乳白色の豆腐、回復で水滴が浮く", "new_c_08": "黒檀色の細身の霊獣。青磁色の鱗、短い一本角、鹿のような鼻先、背に光る金の毛の環、長い尾、蹄", "new_b_01": "灰桃の布を重ねた背の高い女性の霊。長い黒髪、伏せた目、腕に小さな光の包み、足元に淡い水紋", "new_b_08": "淡い青灰色のずんぐりした霊獣の子。額に縦に三つの目、頬の長い毛が筆のよう、小さな角、背に藁紙の札", "new_a_01": "鈍い銅色の鱗の細身の水の女性。髪の代わりに額から後ろへ薄い鰭、小さな角、灰青の長い布、掌から円い水面", "new_a_08": "胡桃の殻のような丸い木の頭の子。深い穴の目、根の脚、背の割れ目に小さな木の実をためる", "new_s_01": "乳白と灰茶のまだらの小さな狐の子。左右で形の違う耳、細い一本尾、周りに浮かぶ三つの石、足元の癒しの光", "new_s_08": "黒褐色のねむそうな獏の子。短い鼻、背にまばらな白い点、ナイトキャップ、鼻先から琥珀の泡を吸い込む", "new_d_07": "紺色の寝間着のねむり顔の浮かぶ子。ナイトキャップ、周りに紺の輪が三層、枕形の石が回る", "new_d_10": "灰色の肌と短い銀髪の女鬼。片側だけ伸びた角、焦げ茶の麻衣、長い指の先に影の輪", "new_c_10": "青磁色のつるりとした頭、点のように小さい光る目、額の窪み、墨色の法衣、衣の内から雷光の糸、錫杖", "new_b_07": "黒い雨雲の頭巾をかぶった子。大きな朱色の舌、銅色の小さな目、灰色の雨合羽、手に土の玉", "new_b_10": "琥珀色の炎の頭の小さな霊。炎の先が揺れ、黒い寝間着、裾はほどけて浮き、平たい火の欠片を残す", "new_a_10": "黒鉄色の硬い毛の大鼠の僧兵。半円の耳、銅色の板状の歯、背に古い釘の毛、数珠、ぼろの法衣、細長い尾", "new_s_07": "灰白の長い毛の細身の山の怪。目は前髪の下で光り、胸の毛が渦を巻く、掌から墨の粒を広げる", "new_s_10": "岩粒の茶褐色の蜘蛛の忍び。顔に六つの小さな赤い眼、口元を覆う布、背から四本の蜘蛛の脚（先に銅の環）、背の平たい円盤", "new_d_04": "墨色の肌の大柄な鬼の頭領。銅色の短い角、赤い蓬髪、背に白木の小樽、両腕を太い縄で巻く、灰青の短い袴", "new_d_09": "背に燃える大車輪を背負う車引きの武者。赤茶の木の輪に青銅の帯、軸に沈んだ石の顔、輪の下に炎", "new_c_09": "太い角の牛の頭の大鬼。背は青錆色の甲羅、腹側に生成りの長い毛、石の脚", "new_b_04": "灰茶の土壁でできた大きな四角い子。壁の真ん中に顔、光るひびが一本、短い手足、足元に小石", "new_b_09": "麻布の細長い帯で人の形を縫い留めた霊。空洞の顔に赤い光、胸に赤銅の鈴、盾のように広い両袖", "new_a_04": "黄土色の肌と短い白角の片腕の鬼。失った左腕の代わりに浮かぶ小岩が掌を作る、深緑の短い衣", "new_a_09": "黒銅の丸い茶釜の体の狸。目のまわりの黒い模様、丸い耳、注ぎ口から湯気、しま模様のふさふさの尾", "new_s_04": "黒い木の節をつないだ鎧の武者。節の間が銅色に光り、牙のある兜、背から両脇へ並ぶ細い脚", "new_s_09": "河原石のような灰白の鱗の大きな蛇の武者。暗い朱色の目、背から八本の蛇の首が扇のように立ち上がる"}; // v8の見た目の説明（各モデルの注記と同じ）。キャラ詳細の説明文に使う
  for (const id in V7) if (DATA.CHI[id]) { DATA.CHI[id].h = V7[id].h; DATA.CHI[id].style = STYLE[id] || 'cool'; if (LOOK8[id]) DATA.CHI[id].blurb = LOOK8[id]; }
})();
