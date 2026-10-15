/* =====================================================================
   render_train.js — ステージ2「常磐線」の見た目
   ・青い帯の常磐線（2号車・3号車で戦う。前の1号車には入れない）
   ・走る車窓（建物・架線柱・線路が流れる）、駅のホーム（北千住・南千住・三河島・日暮里・上野）
   ・ヨシノシの部下（＝ヨシノシと同じ見た目。猫背・気味の悪い目・知的な眼鏡と角帽。手の武器だけ違う）
   座標は sim と同じ：x＝左右、z＝前後（+zが上野方面）。車内の床が y=0。
   ===================================================================== */
(() => {
  const P = GFX.parts, S = P.S, B = P.B, C = P.C, K = P.K, G = P.G;
  const L = GFX.lam, BAS = GFX.bas;

  /* ---------- ヨシノシ（部下も同じ見た目） ---------- */
  let YM = null;
  const ymats = () => YM || (YM = {
    coat: L(0x2b2552), trim: L(0x7a68c8), collar: L(0xebe6d8), skin: L(0xc6bfd4), skinD: L(0x8f86a6), hair: L(0x3a3550),
    eyeW: L(0xf6f2d6, { emissive: 0x3a3a10, emissiveIntensity: 0.35 }), iris: BAS(0xc8ff3a), pupil: BAS(0x0c0a10), lid: L(0x6d6488),
    gold: L(0xe0b84e, { emissive: 0x4a3200, emissiveIntensity: 0.5 }), cap: L(0x17151f), mouth: BAS(0x3a1830),
    blade: L(0xe4ebf2, { emissive: 0x404a58, emissiveIntensity: 0.6 }), hilt: L(0x3a1f1a), guard: L(0xc9a23a),
    iron: L(0x59606c), ironD: L(0x2e323a), brass: L(0xb98a3c, { emissive: 0x2a1800 }), glow: new THREE.MeshBasicMaterial({ color: 0xb6ff6a, transparent: true, opacity: 0.9, depthWrite: false }),
    boot: L(0x1d1a26),
  });
  const buildYoshi = (wpn) => {
    const M = ymats(), root = G(null), body = G(root, 0, 0.56, 0);
    const legL = G(body, -0.1, 0, 0), legR = G(body, 0.1, 0, 0); body.name = 'body'; legL.name = 'legL'; legR.name = 'legR';
    for (const lg of [legL, legR]) { C(lg, 0.05, 0.045, 0.5, M.coat, 0, -0.25, 0); B(lg, 0.1, 0.07, 0.2, M.boot, 0, -0.52, 0.04); }
    // 猫背：背骨ごと前に曲げ、首はさらに前へ突き出す
    const spine = G(body, 0, 0.02, 0); spine.rotation.x = 0.55; spine.name = 'spine';
    C(spine, 0.17, 0.3, 0.74, M.coat, 0, 0.33, 0);
    C(spine, 0.305, 0.31, 0.05, M.trim, 0, 0.0, 0);
    B(spine, 0.03, 0.62, 0.02, M.trim, 0, 0.36, 0.235);
    for (const y of [0.22, 0.38, 0.54]) S(spine, 0.022, M.gold, 0, y, 0.24 - y * 0.12);
    C(spine, 0.15, 0.19, 0.13, M.collar, 0, 0.7, 0.01);
    const neck = G(spine, 0, 0.74, 0.05); neck.rotation.x = -0.3; neck.name = 'neck'; // 首は前へ突き出し、顔はこちらを向く
    const head = G(neck, 0, 0.17, 0.05); head.name = 'head';
    S(head, 0.2, M.skin, 0, 0.06, 0, 1, 1.3, 1.05); // 大きなおでこ（知的）
    B(head, 0.28, 0.045, 0.07, M.skinD, 0, 0.07, 0.16);
    for (const s of [-1, 1]) B(head, 0.04, 0.14, 0.06, M.hair, s * 0.19, -0.02, -0.02);
    // 気味の悪い目：左は大きく見開き、右は小さい。どちらも小さな瞳
    const eyeL = G(head, -0.085, 0.0, 0.15), eyeR = G(head, 0.085, 0.025, 0.155);
    S(eyeL, 0.092, M.eyeW, 0, 0, 0); S(eyeL, 0.055, M.iris, 0, 0, 0.055); S(eyeL, 0.02, M.pupil, 0, 0, 0.1);
    S(eyeR, 0.056, M.eyeW, 0, 0, 0); S(eyeR, 0.032, M.iris, 0, 0, 0.034); S(eyeR, 0.012, M.pupil, 0, 0, 0.062);
    B(eyeR, 0.13, 0.03, 0.05, M.lid, 0, 0.045, 0.03).rotation.z = -0.25; // 半分閉じたまぶた
    // 丸眼鏡（金縁）と、片方だけの鎖
    const ring = (r, x, y) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 6, 20), M.gold); m.position.set(x, y, 0.225); head.add(m); return m; };
    ring(0.105, -0.085, 0.0); ring(0.075, 0.085, 0.025); B(head, 0.05, 0.012, 0.012, M.gold, 0, 0.02, 0.23);
    C(head, 0.004, 0.004, 0.22, M.gold, -0.19, -0.1, 0.17).rotation.x = 0.3;
    B(head, 0.09, 0.014, 0.01, M.mouth, 0.02, -0.15, 0.185).rotation.z = 0.18; // 薄い口（少しゆがむ）
    // 角帽（学者の帽子）と房
    C(head, 0.16, 0.18, 0.09, M.cap, 0, 0.27, -0.01);
    const board = B(head, 0.3, 0.025, 0.3, M.cap, 0, 0.33, -0.03); board.rotation.y = 0.75;
    C(head, 0.006, 0.006, 0.2, M.gold, 0.2, 0.24, 0.1); S(head, 0.022, M.gold, 0.2, 0.13, 0.1);
    // 腕（細長い）
    const armL = G(spine, -0.22, 0.62, 0.02), armR = G(spine, 0.22, 0.62, 0.02); armL.name = 'armL'; armR.name = 'armR';
    for (const a of [armL, armR]) { C(a, 0.05, 0.042, 0.56, M.coat, 0, -0.28, 0); C(a, 0.055, 0.055, 0.06, M.trim, 0, -0.54, 0); S(a, 0.055, M.skin, 0, -0.6, 0, 1, 1.2, 1); }
    // 手の武器（ここだけ違う）
    const hand = G(armR, 0, -0.6, 0), w = G(hand); let glow = null;
    if (wpn === 'sword') {
      w.rotation.x = -1.35;
      C(w, 0.025, 0.025, 0.18, M.hilt, 0, -0.02, 0); B(w, 0.16, 0.03, 0.05, M.guard, 0, -0.12, 0);
      B(w, 0.045, 0.85, 0.012, M.blade, 0, -0.56, 0);
      K(w, 0.032, 0.08, M.blade, 0, -1.02, 0).rotation.z = Math.PI;
    } else if (wpn === 'fist') {
      B(w, 0.2, 0.2, 0.22, M.iron, 0, -0.03, 0.02);
      C(w, 0.09, 0.1, 0.14, M.ironD, 0, 0.11, 0);
      for (const x of [-0.06, 0, 0.06]) K(w, 0.025, 0.07, M.iron, x, -0.08, 0.15).rotation.x = Math.PI / 2;
    } else {
      w.rotation.x = -1.45;
      C(w, 0.065, 0.085, 0.6, M.brass, 0, -0.26, 0);
      const mz = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 16), M.iron); mz.position.set(0, -0.56, 0); mz.rotation.x = Math.PI / 2; w.add(mz);
      C(w, 0.09, 0.09, 0.08, M.ironD, 0, 0.02, 0);
      glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.glow); glow.position.set(0, -0.6, 0); w.add(glow); glow.name = 'glow'; glow.userData.keep = true;
    }
    return root;
  };
  /** 動く部分（脚・背中・頭・腕）ごとに、色を頂点に焼き込んで1つにまとめる（1体＝6〜7回の描画） */
  const colOf = (m) => { const c = m.color.clone(); if (m.emissive) c.add(m.emissive.clone().multiplyScalar(m.emissiveIntensity == null ? 1 : m.emissiveIntensity)); if (m.isMeshBasicMaterial) c.multiplyScalar(1.15); return c; };
  function mergeVC(items) {
    const pos = [], nor = [], col = [], m3 = new THREE.Matrix3(), v = new THREE.Vector3();
    for (const { geo, m, c } of items) {
      const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, n = g.attributes.normal; m3.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); v.fromBufferAttribute(n, i).applyMatrix3(m3).normalize(); nor.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }
  const YT = {}; // 武器ごとのひな形
  function yoshiTemplate(wpn) {
    if (YT[wpn]) return YT[wpn];
    const root = buildYoshi(wpn); root.updateMatrixWorld(true);
    const anchors = ['legL', 'legR', 'spine', 'head', 'armL', 'armR'].map(n => root.getObjectByName(n)), buckets = new Map(anchors.map(a => [a, []]));
    const inv = new THREE.Matrix4(), meshes = [];
    root.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      if (o.userData.keep) continue;
      let p = o.parent; while (p && !buckets.has(p)) p = p.parent; if (!p) continue;
      inv.copy(p.matrixWorld).invert(); buckets.get(p).push({ geo: o.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), c: colOf(o.material) });
      o.parent.remove(o); o.geometry.dispose();
    }
    const vc = ymats().vc || (ymats().vc = new THREE.MeshLambertMaterial({ vertexColors: true }));
    for (const [a, items] of buckets) if (items.length) { const mm = new THREE.Mesh(mergeVC(items), vc); mm.name = a.name + 'Mesh'; a.add(mm); }
    return (YT[wpn] = root);
  }
  GFX.makeYoshi = (wpn, scale) => {
    const root = yoshiTemplate(wpn).clone(true), g = n => root.getObjectByName(n), vc = ymats().vc, parts = [];
    root.traverse(o => { if (o.isMesh && o.material === vc) parts.push(o); });
    root.scale.setScalar(scale || 1);
    const shadow = GFX.blob(0.42);
    return { parts, fade: false, root, body: g('body'), spine: g('spine'), neck: g('neck'), head: g('head'), armL: g('armL'), armR: g('armR'), legL: g('legL'), legR: g('legR'), glow: g('glow'), shadow, wpn, ph: Math.random() * 10, die: 0 };
  };
  /** 自分とカメラの間に立つ部下は半透明にする（見た目だけ） */
  GFX.fadeYoshi = (m, on) => {
    if (m.fade === on) return; m.fade = on; const M = ymats();
    const fm = M.vcFade || (M.vcFade = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false }));
    for (const p of m.parts) p.material = on ? fm : M.vc;
  };
  GFX.animYoshi = (m, e, T, dt) => {
    m.root.position.set(e.x, 0, e.z); m.root.rotation.set(0, e.yaw, 0); m.shadow.position.set(e.x, 0.02, e.z);
    const ph = m.ph, mv = e.moving && !e.dying ? 1 : 0, wk = T * 9 + ph;
    m.legL.rotation.x = Math.sin(wk) * 0.55 * mv; m.legR.rotation.x = -Math.sin(wk) * 0.55 * mv;
    m.body.position.y = 0.56 + Math.abs(Math.sin(wk)) * 0.04 * mv;
    m.spine.rotation.x = 0.55 + Math.sin(T * 2.1 + ph) * 0.05; m.spine.rotation.z = Math.sin(T * 1.6 + ph) * 0.07;
    // ときどき首をかくっと傾ける（気味が悪い）
    const tw = Math.sin(T * 0.9 + ph * 3); m.neck.rotation.z = tw > 0.9 ? 0.4 : Math.sin(T * 1.3 + ph) * 0.08;
    m.head.rotation.y = Math.sin(T * 0.7 + ph * 2) * 0.22;
    let aR = -0.3 + Math.sin(wk) * 0.25 * mv, aL = -0.4 - Math.sin(wk) * 0.25 * mv, lunge = 0;
    if (e.wind || e.ph === 2) {
      const wind = e.ph === 1, k = wind ? 1 : 0;
      if (m.wpn === 'sword') { aR = wind ? -2.7 : 0.5; lunge = wind ? -0.1 : 0.25; }
      else if (m.wpn === 'fist') { aR = wind ? 0.7 : -1.55; lunge = wind ? -0.15 : 0.3; }
      else { aR = wind ? -1.2 : -0.9; lunge = wind ? 0 : -0.12; }
      aL = -0.6 - k * 0.2;
    } else if (m.wpn === 'beam') aR = -1.1 + Math.sin(T * 2 + ph) * 0.05;
    m.armR.rotation.x = aR; m.armL.rotation.x = aL; m.spine.rotation.x += lunge;
    if (m.glow) { const on = e.ph === 1 ? 0.7 + Math.sin(T * 30) * 0.3 : e.ph === 2 ? 1.8 : 0.35; m.glow.scale.setScalar(on); }
    if (e.para) m.root.rotation.z = Math.sin(T * 40) * 0.08;
    if (e.enter) { m.root.scale.setScalar(Math.min(1, (m.root.scale.x || 0.4) + dt * 2.5)); } else if (!e.dying) m.root.scale.setScalar(1);
    if (e.dying) { m.die += dt; const k = Math.min(1, m.die / 0.55); m.root.rotation.x = k * 1.3; m.root.position.y = -k * 0.5; m.root.scale.setScalar(Math.max(0.01, 1 - k * 0.6)); m.shadow.visible = k < 0.8; }
  };

  /* ---------- 常磐線（車内・車外・車窓・ホーム） ---------- */
  GFX.buildTrain = function (scene) {
    const J = DATA.JOBAN, rnd = GFX.rnd;
    const T = { root: new THREE.Group(), train: new THREE.Group(), scen: new THREE.Group(), doors: [], dist: 0, lcd: null, platSt: -1 };
    scene.add(T.root); T.root.add(T.train); T.root.add(T.scen); T.root.visible = false;
    T.root.add(new THREE.HemisphereLight(0xf6f4ff, 0x5a5466, 1.25));
    const dl = new THREE.DirectionalLight(0xfff6e8, 0.55); dl.position.set(3, 10, 6); T.root.add(dl);
    const IN = 1.95, CEIL = 2.35, WIN0 = 0.95, WIN1 = 1.95;
    const cars = [{ c: -11, nm: '3号車' }, { c: 11, nm: '2号車' }];
    const DOORS = [-7.5, -2.5, 2.5, 7.5];
    /* 材質 */
    const floorT = GFX.tex(256, 256, (g, w, h) => { g.fillStyle = '#7b7f88'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 100 + rnd() * 40 | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 8})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); } }, [2, 10]);
    const floorM = L(0xffffff, { map: floorT }), wallIn = L(0xe9e6de), seatM = L(0x2c58a8), seatD = L(0x23468a), ceilM = L(0xf3f3f0);
    const lightM = BAS(0xfffbf0), poleM = L(0xd0d5dc), strapM = L(0xf5f5f5), metalD = L(0x6a6f78), yellowM = L(0xffd23a);
    const glassM = new THREE.MeshLambertMaterial({ color: 0xa8d0e0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const outerT = (top) => GFX.tex(64, 128, (g, w, h) => { g.fillStyle = '#c4c9cf'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 6) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 2, h); } if (top) { g.fillStyle = '#1d56b8'; g.fillRect(0, 0, w, 26); g.fillStyle = '#19a596'; g.fillRect(0, 26, w, 8); } else { g.fillStyle = '#1d56b8'; g.fillRect(0, h - 20, w, 20); } });
    const outLowM = L(0xffffff, { map: outerT(true) }), outUpM = L(0xffffff, { map: outerT(false) }), roofM = L(0x8d939b), underM = L(0x2a2c32);
    const doorT = GFX.tex(64, 160, (g, w, h) => { g.fillStyle = '#b9bfc7'; g.fillRect(0, 0, w, h); g.fillStyle = '#3d4a58'; g.fillRect(10, 18, w - 20, 64); g.fillStyle = '#ffd23a'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h); });
    const doorM = L(0xffffff, { map: doorT });
    const fadeM = L(0x34363e, { transparent: true }); T.fade = [fadeM];
    /* 車内（2両分） */
    const items = { floor: [], wallIn: [], outLow: [], outUp: [], glass: [], frame: [], seat: [], seatD: [], ceil: [], light: [], pole: [], strap: [], yellow: [], roof: [], under: [], doorR: [], doorA: [], doorB: [], fade: [], mid: [], dark: [], wheel: [], lcd: [], blue: [], lamp: [] };
    const plane = (w, h) => new THREE.PlaneGeometry(w, h), box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    for (const car of cars) {
      const z0 = car.c - 10, z1 = car.c + 10;
      items.floor.push({ geo: plane(IN * 2, 20), m: GFX.M(0, 0, car.c, 0, -Math.PI / 2) });
      items.ceil.push({ geo: plane(IN * 2, 20), m: GFX.M(0, CEIL, car.c, 0, Math.PI / 2) });
      items.roof.push({ geo: box(IN * 2 + 0.2, 0.3, 20), m: GFX.M(0, CEIL + 0.16, car.c) });
      items.under.push({ geo: box(IN * 2 + 0.1, 1.05, 19.6), m: GFX.M(0, -0.55, car.c) });
      for (const s of [-1, 1]) {
        // 壁：ドアのところは開け、窓の上下に壁を張る
        const cuts = [z0]; for (const d of DOORS) cuts.push(car.c + d - 0.65, car.c + d + 0.65); cuts.push(z1);
        for (let i = 0; i < cuts.length; i += 2) {
          const a = cuts[i], b = cuts[i + 1], len = b - a, mz = (a + b) / 2;
          if (len < 0.1) continue;
          items.wallIn.push({ geo: plane(len, WIN0), m: GFX.M(s * IN, WIN0 / 2, mz, -s * Math.PI / 2) });
          items.wallIn.push({ geo: plane(len, CEIL - WIN1), m: GFX.M(s * IN, (CEIL + WIN1) / 2, mz, -s * Math.PI / 2) });
          items.outLow.push({ geo: plane(len, WIN0 + 1.05), m: GFX.M(s * (IN + 0.08), (WIN0 - 1.05) / 2, mz, s * Math.PI / 2) });
          items.outUp.push({ geo: plane(len, CEIL + 0.3 - WIN1), m: GFX.M(s * (IN + 0.08), (CEIL + 0.3 + WIN1) / 2, mz, s * Math.PI / 2) });
          items.glass.push({ geo: plane(len, WIN1 - WIN0), m: GFX.M(s * (IN + 0.04), (WIN0 + WIN1) / 2, mz, s * Math.PI / 2) });
          for (let k = 0; k <= Math.floor(len / 1.6); k++) items.frame.push({ geo: box(0.1, WIN1 - WIN0, 0.07), m: GFX.M(s * (IN + 0.03), (WIN0 + WIN1) / 2, a + Math.min(len, k * 1.6)) });
          items.frame.push({ geo: box(0.12, 0.05, len), m: GFX.M(s * (IN + 0.02), WIN0, mz) }); items.frame.push({ geo: box(0.12, 0.05, len), m: GFX.M(s * (IN + 0.02), WIN1, mz) });
          // ロングシート
          const sa = a + 0.08, sb = b - 0.08;
          if (sb - sa > 0.6) {
            items.seat.push({ geo: box(0.5, 0.12, sb - sa), m: GFX.M(s * (IN - 0.27), 0.44, (sa + sb) / 2) });
            items.seat.push({ geo: box(0.1, 0.5, sb - sa), m: GFX.M(s * (IN - 0.06), 0.72, (sa + sb) / 2) });
            items.seatD.push({ geo: box(0.46, 0.38, sb - sa - 0.1), m: GFX.M(s * (IN - 0.28), 0.19, (sa + sb) / 2) });
            items.pole.push({ geo: new THREE.CylinderGeometry(0.025, 0.025, CEIL, 8), m: GFX.M(s * (IN - 0.55), CEIL / 2, sa + 0.05) });
            items.pole.push({ geo: new THREE.CylinderGeometry(0.025, 0.025, CEIL, 8), m: GFX.M(s * (IN - 0.55), CEIL / 2, sb - 0.05) });
            // つり革
            items.pole.push({ geo: new THREE.CylinderGeometry(0.018, 0.018, sb - sa, 6), m: GFX.M(s * (IN - 0.6), CEIL - 0.25, (sa + sb) / 2, 0, Math.PI / 2) });
            for (let z = sa + 0.3; z < sb - 0.2; z += 0.45) { items.strap.push({ geo: box(0.03, 0.22, 0.012), m: GFX.M(s * (IN - 0.6), CEIL - 0.37, z) }); items.strap.push({ geo: new THREE.TorusGeometry(0.06, 0.012, 5, 12), m: GFX.M(s * (IN - 0.6), CEIL - 0.53, z, Math.PI / 2) }); }
          }
          // 荷物棚
          items.frame.push({ geo: box(0.32, 0.03, len), m: GFX.M(s * (IN - 0.17), WIN1 + 0.05, mz) });
        }
        // 天井の照明
        items.light.push({ geo: box(0.16, 0.03, 19), m: GFX.M(s * 0.7, CEIL - 0.02, car.c) });
        // ドア（左右）
        for (const d of DOORS) {
          const zc = car.c + d;
          for (const k of [-1, 1]) (s > 0 ? items.doorR : k < 0 ? items.doorA : items.doorB).push({ geo: box(0.05, 1.95, 0.65), m: GFX.M(s * (IN + 0.03), 0.98, zc + k * 0.325) }); // 開くのは左側（ホーム側）だけ
          items.frame.push({ geo: box(0.14, CEIL + 0.3 - 1.95, 1.3), m: GFX.M(s * (IN + 0.03), (CEIL + 0.3 + 1.95) / 2, zc) });
          items.yellow.push({ geo: plane(1.2, 0.12), m: GFX.M(s * (IN - 0.08), 0.004, zc, 0, -Math.PI / 2) });
        }
      }
    }
    // 連結部（細い通路・ほろ）と、車両の端の壁
    const gw = J.gwHalfW + 0.05;
    for (const s of [-1, 1]) {
      items.fade.push({ geo: box(0.08, CEIL, 2.0), m: GFX.M(s * gw, CEIL / 2, 0) });
      for (const z of [-1, 1]) items.fade.push({ geo: box(IN - gw, CEIL, 0.1), m: GFX.M(s * (gw + (IN - gw) / 2), CEIL / 2, z) });
    }
    items.floor.push({ geo: plane(gw * 2, 2), m: GFX.M(0, 0.001, 0, 0, -Math.PI / 2) });
    // 外から見た連結部：車体の端を少し伸ばし、すき間（ほろ）は細く見せる
    for (const s of [-1, 1]) for (const [a, b] of [[-1, -0.32], [0.32, 1]]) {
      const len = b - a, mz = (a + b) / 2;
      items.outLow.push({ geo: plane(len, WIN0 + 1.05), m: GFX.M(s * (IN + 0.08), (WIN0 - 1.05) / 2, mz, s * Math.PI / 2) });
      items.outUp.push({ geo: plane(len, CEIL + 0.3 - WIN1), m: GFX.M(s * (IN + 0.08), (CEIL + 0.3 + WIN1) / 2, mz, s * Math.PI / 2) });
      items.mid.push({ geo: plane(len, WIN1 - WIN0), m: GFX.M(s * (IN + 0.08), (WIN0 + WIN1) / 2, mz, s * Math.PI / 2) });
      if (s > 0) items.roof.push({ geo: box(IN * 2 + 0.2, 0.3, len), m: GFX.M(0, CEIL + 0.16, mz) });
    }
    // 3号車の後ろの壁（4号車へは行けない）
    const endT = GFX.tex(128, 160, (g, w, h) => { g.fillStyle = '#e9e6de'; g.fillRect(0, 0, w, h); g.fillStyle = '#b9bfc7'; g.fillRect(34, 20, 60, 140); g.fillStyle = '#3d4a58'; g.fillRect(44, 34, 40, 50); g.fillStyle = '#c03a2a'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('4号車', w / 2, 112); });
    GFX.mesh(T.train, plane(IN * 2, CEIL), L(0xffffff, { map: endT }), 0, CEIL / 2, -21);
    // 2号車の前：1号車への入口（開いている。ここから部下が入ってくる）
    for (const s of [-1, 1]) GFX.mesh(T.train, box(IN - 0.6, CEIL, 0.12), wallIn, s * (0.6 + (IN - 0.6) / 2), CEIL / 2, 21);
    GFX.mesh(T.train, box(1.2, CEIL - 1.95, 0.12), wallIn, 0, (CEIL + 1.95) / 2, 21);
    const signT = GFX.tex(256, 64, (g, w, h) => { g.fillStyle = '#16244a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23a'; g.font = `bold 30px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('← 1号車', w / 2, h / 2); });
    GFX.mesh(T.train, plane(0.9, 0.22), BAS(0xffffff, { map: signT }), 0, 2.12, 20.93, Math.PI);
    // 1号車（入れない・少し暗い）
    const dim = L(0x8a8a98);
    GFX.mesh(T.train, plane(IN * 2, 12), L(0x55585f), 0, 0, 27, 0).rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) { GFX.mesh(T.train, box(0.5, 0.5, 10), L(0x1f3d78), s * (IN - 0.27), 0.25, 27.5); GFX.mesh(T.train, box(0.06, CEIL, 12), dim, s * IN, CEIL / 2, 27); }
    GFX.mesh(T.train, plane(IN * 2, CEIL), L(0x40424a), 0, CEIL / 2, 33, Math.PI);
    // 中づり広告（架空）
    const ads = ['北千住 宵町まつり', '常磐線で上野へ', 'ヨシノシ研究所 生徒募集', 'よいまち湯 本日あつ湯'].map((t, i) => GFX.tex(256, 128, (g, w, h) => { g.fillStyle = ['#fff4d6', '#e3f1ff', '#efe6ff', '#ffe8e0'][i]; g.fillRect(0, 0, w, h); g.fillStyle = ['#c0392b', '#1d56b8', '#4a2a8a', '#b8402a'][i]; g.font = `bold 28px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2, w - 16); g.strokeStyle = g.fillStyle; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); }));
    let ai = 0;
    const adIt = ads.map(() => []);
    for (const car of cars) for (const dz of [-6, -1, 4, 8.5]) { const a = adIt[ai++ % ads.length]; a.push({ geo: plane(0.8, 0.4), m: GFX.M(0, CEIL - 0.32, car.c + dz) }, { geo: plane(0.8, 0.4), m: GFX.M(0, CEIL - 0.32, car.c + dz, Math.PI) }); } // 表と裏（裏返しの文字にならない）
    ads.forEach((t, i) => T.train.add(new THREE.Mesh(GFX.merge(adIt[i]), L(0xffffff, { map: t }))));
    // ドアの上の案内表示（次の駅）
    const lc = document.createElement('canvas'); lc.width = 256; lc.height = 64; T.lcdCtx = lc.getContext('2d'); T.lcd = new THREE.CanvasTexture(lc); T.lcd.colorSpace = THREE.SRGBColorSpace;
    const lcdM = BAS(0xffffff, { map: T.lcd });
    for (const car of cars) for (const d of DOORS) for (const s of [-1, 1]) items.lcd.push({ geo: plane(0.62, 0.16), m: GFX.M(s * (IN - 0.02), 2.12, car.c + d, -s * Math.PI / 2) });
    T.train.add(new THREE.Mesh(GFX.merge(items.lcd), lcdM));
    T.setLcd = (top, main, sub) => { const g = T.lcdCtx, w = 256, h = 64; g.fillStyle = '#0a0d14'; g.fillRect(0, 0, w, h); g.fillStyle = '#7fd7ff'; g.font = `16px ${GFX.FONT_UI}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(top, 8, 4); g.fillStyle = '#ffb030'; g.font = `bold 30px ${GFX.FONT_UI}`; g.fillText(main, 8, 24); g.fillStyle = '#e6eef8'; g.font = `14px ${GFX.FONT_UI}`; g.textAlign = 'right'; g.fillText(sub, w - 8, 42); T.lcd.needsUpdate = true; };
    // まとめて描く
    const addM = (arr, mat) => { if (arr.length) T.train.add(new THREE.Mesh(GFX.merge(arr), mat)); };
    addM(items.floor, floorM); addM(items.wallIn, wallIn); addM(items.outLow, outLowM); addM(items.outUp, outUpM);
    const gl = new THREE.Mesh(GFX.merge(items.glass), glassM); gl.renderOrder = 2; T.train.add(gl);
    addM(items.frame, metalD); addM(items.seat, seatM); addM(items.seatD, seatD); addM(items.ceil, ceilM); addM(items.light, lightM); addM(items.pole, poleM); addM(items.strap, strapM); addM(items.yellow, yellowM); addM(items.roof, roofM); addM(items.under, underM);
    addM(items.doorR, doorM); addM(items.fade, fadeM); addM(items.mid, L(0xb3b8c0));
    T.leafA = new THREE.Mesh(GFX.merge(items.doorA), doorM); T.leafB = new THREE.Mesh(GFX.merge(items.doorB), doorM); T.train.add(T.leafA, T.leafB); T.doorOpen = 0;
    // 外から見える前後の車両（1号車の先頭・4〜5号車）
    const sh = { outLow: [], outUp: [], roof: [], under: [] };
    const shell = (z0, z1, front) => { const len = z1 - z0, zc = (z0 + z1) / 2;
      for (const s of [-1, 1]) { sh.outLow.push({ geo: plane(len, WIN0 + 1.05), m: GFX.M(s * (IN + 0.08), (WIN0 - 1.05) / 2, zc, s * Math.PI / 2) }); sh.outUp.push({ geo: plane(len, CEIL + 0.3 - WIN1), m: GFX.M(s * (IN + 0.08), (CEIL + 0.3 + WIN1) / 2, zc, s * Math.PI / 2) }); items.dark.push({ geo: plane(len, WIN1 - WIN0), m: GFX.M(s * (IN + 0.07), (WIN0 + WIN1) / 2, zc, s * Math.PI / 2) }); }
      sh.roof.push({ geo: box(IN * 2 + 0.2, 0.3, len), m: GFX.M(0, CEIL + 0.16, zc) }); sh.under.push({ geo: box(IN * 2, 1.05, len - 0.4), m: GFX.M(0, -0.55, zc) });
      if (front) { items.blue.push({ geo: box(IN * 2 + 0.16, 3.4, 0.4), m: GFX.M(0, 0.6, z1 + 0.2) }); items.dark.push({ geo: plane(3.2, 1.1), m: GFX.M(0, 1.6, z1 + 0.41) }); for (const s of [-1, 1]) items.lamp.push({ geo: plane(0.4, 0.2), m: GFX.M(s * 1.3, 0.6, z1 + 0.41) }); }
    };
    shell(21, 41, true); shell(-41, -21.05, false); shell(-61, -41.05, false);
    // 床下の台車
    for (const z of [-58, -44, -38, -24, -18, -4, 4, 18, 24, 38]) for (const s of [-1, 1]) items.wheel.push({ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.12, 14), m: GFX.M(s * 0.75, -0.75, z, 0, 0, Math.PI / 2) });
    addM(sh.outLow, outLowM); addM(sh.outUp, outUpM); addM(sh.roof, roofM); addM(sh.under, underM);
    addM(items.dark, L(0x1c2430)); addM(items.blue, L(0x1d56b8)); addM(items.lamp, BAS(0xfff6d0)); addM(items.wheel, L(0x1a1a1e));

    /* 車窓：地面・線路・架線柱・建物（電車の進みに合わせて後ろへ流れる） */
    const groundT = GFX.tex(128, 128, (g, w, h) => { g.fillStyle = '#3a3a42'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { const v = 60 + rnd() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(rnd() * w, rnd() * h, 3, 3); } g.fillStyle = '#5a4030'; for (let y = 0; y < h; y += 16) g.fillRect(16, y, w - 32, 6); g.fillStyle = '#b8bcc4'; g.fillRect(34, 0, 5, h); g.fillRect(w - 39, 0, 5, h); }, [1, 60]);
    T.trackT = groundT;
    T.scen.add(new THREE.Mesh(GFX.merge([0, -4.6, 4.6, 9.2].map(x => ({ geo: plane(3.2, 480), m: GFX.M(x, -1.12, 0, 0, -Math.PI / 2) }))), L(0xffffff, { map: groundT })));
    const far = GFX.mesh(T.scen, plane(600, 600), L(0x24232c), 0, -1.2, 0); far.rotation.x = -Math.PI / 2;
    // 夜の空
    const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 24, 12), new THREE.MeshBasicMaterial({ color: 0x2a2a58, side: THREE.BackSide, fog: false })); T.root.add(sky);
    // 架線柱（インスタンス）
    const NP = 20; T.poles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 7.5, 0.25), L(0x8a8f96), NP * 2); T.scen.add(T.poles);
    T.beams = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 0.2, 0.2), L(0x8a8f96), NP); T.scen.add(T.beams);
    // 建物（インスタンス・色違い）
    const facade = GFX.tex(128, 256, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let y = 10; y < h; y += 22) for (let x = 8; x < w; x += 20) { const lit = rnd() < 0.45; g.fillStyle = lit ? '#ffe7a8' : '#3a3f58'; g.fillRect(x, y, 12, 12); } }, [2, 3]);
    const NB = 70; T.blds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: facade, emissive: 0xffffff, emissiveMap: facade, emissiveIntensity: 0.35 }), NB); T.scen.add(T.blds);
    T.bld = []; let zz = -220;
    for (let i = 0; i < NB; i++) { const s = i % 2 ? 1 : -1, w = 7 + rnd() * 12, h = 6 + rnd() * 26, d = 8 + rnd() * 10; T.bld.push({ s, x: s * (16 + rnd() * 30 + d / 2), z: zz, w, h, d }); if (i % 2) zz += 6 + rnd() * 8; const c = new THREE.Color().setHSL(0.6 + rnd() * 0.15, 0.08 + rnd() * 0.1, 0.45 + rnd() * 0.3); T.blds.setColorAt(i, c); }
    T.bldSpan = zz + 220;
    /* ホーム（駅に止まるとき・左側） */
    const plat = new THREE.Group(); T.scen.add(plat); T.plat = plat;
    const pf = GFX.mesh(plat, box(6, 1.1, 150), L(0x9c9a94), -(IN + 0.12 + 3), -0.56, 0);
    GFX.mesh(plat, plane(0.35, 150), L(0xf2c400), -(IN + 0.45), 0.005, 0).rotation.x = -Math.PI / 2;
    { const pil = []; for (let z = -70; z <= 70; z += 10) pil.push({ geo: box(0.3, 3.4, 0.3), m: GFX.M(-(IN + 4), 1.7, z) }); plat.add(new THREE.Mesh(GFX.merge(pil), L(0x6c6f78))); }
    GFX.mesh(plat, box(5.2, 0.2, 150), L(0x5a5e68), -(IN + 3.2), 3.45, 0);
    { const bn = []; for (let z = -60; z <= 60; z += 20) bn.push({ geo: box(0.5, 0.42, 1.8), m: GFX.M(-(IN + 4.6), 0.21, z + 5) }); plat.add(new THREE.Mesh(GFX.merge(bn), L(0x7a5a3a))); }
    // 駅名標（3枚・駅ごとに書きかえる）
    const nc = document.createElement('canvas'); nc.width = 512; nc.height = 192; T.nameCtx = nc.getContext('2d'); T.nameTex = new THREE.CanvasTexture(nc); T.nameTex.colorSpace = THREE.SRGBColorSpace;
    { const fr = [], fc = []; for (const z of [-14, 16, 46]) { fr.push({ geo: box(0.06, 1.0, 2.66), m: GFX.M(-(IN + 3.6), 2.3, z) }); for (const s of [-1, 1]) fc.push({ geo: plane(2.6, 0.95), m: GFX.M(-(IN + 3.6) + s * 0.035, 2.3, z, s * Math.PI / 2) }); }
      plat.add(new THREE.Mesh(GFX.merge(fr), L(0x444444))); plat.add(new THREE.Mesh(GFX.merge(fc), BAS(0xffffff, { map: T.nameTex }))); }
    T.setStation = (i) => {
      if (T.platSt === i) return; T.platSt = i;
      const g = T.nameCtx, w = 512, h = 192, st = J.stations, en = J.stationsEn;
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d56b8'; g.fillRect(0, 120, w, 18);
      g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold 66px ${GFX.FONT_UI}`; g.fillText(st[i], w / 2, 56); g.font = `22px ${GFX.FONT_UI}`; g.fillText(en[i], w / 2, 104);
      g.font = `18px ${GFX.FONT_UI}`; g.textAlign = 'left'; if (i > 0) g.fillText('← ' + st[i - 1], 12, 166); g.textAlign = 'right'; if (i < 4) g.fillText(st[i + 1] + ' →', w - 12, 166);
      g.fillStyle = '#19a596'; g.fillRect(0, 0, w, 8); T.nameTex.needsUpdate = true;
    };
    T.setStation(0); T.setLcd('常磐線 上野行', '北千住', 'Kita-Senju');
    const tmp = new THREE.Object3D();
    /** 車窓を動かす。dist＝進んだ距離（m）、platZ＝ホームの位置（null なら表示しない） */
    T.update = (dist, platZ, doorsOpen, T0, dt) => {
      T.dist = dist;
      groundT.offset.y = -dist / 8;
      for (let i = 0; i < NP; i++) {
        const z = ((i * 25 - dist) % 500 + 500) % 500 - 250;
        for (const s of [0, 1]) { tmp.position.set((s ? 1 : -1) * 7.2, 2.6, z); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); T.poles.setMatrixAt(i * 2 + s, tmp.matrix); }
        tmp.position.set(0, 6.3, z); tmp.updateMatrix(); T.beams.setMatrixAt(i, tmp.matrix);
      }
      T.poles.instanceMatrix.needsUpdate = T.beams.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < NB; i++) { const b = T.bld[i]; const z = ((b.z + 220 - dist) % T.bldSpan + T.bldSpan) % T.bldSpan - 220; tmp.position.set(b.x, b.h / 2 - 1.1, z); tmp.scale.set(b.d, b.h, b.w); tmp.updateMatrix(); T.blds.setMatrixAt(i, tmp.matrix); }
      T.blds.instanceMatrix.needsUpdate = true;
      plat.visible = platZ != null && Math.abs(platZ) < 260; if (plat.visible) plat.position.z = platZ;
      // 左側のドアの開け閉め
      T.doorOpen += Math.max(-dt * 2.2, Math.min(dt * 2.2, (doorsOpen ? 1 : 0) - T.doorOpen)); T.leafA.position.z = -T.doorOpen * 0.62; T.leafB.position.z = T.doorOpen * 0.62;
    };
    return T;
  };
})();
