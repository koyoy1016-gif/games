/* =====================================================================
   render_main.js — 描画の本体：エンティティ同期・予兆表示・弾・演出・カメラ
   描画はスナップショット（PROTO.decodeSnap の結果）だけを見る。
   ===================================================================== */
const R = (() => {
  let renderer, scene, camera, W, canvas;
  const allies = [], mobs = new Map(), projs = new Map(), hzs = new Map(), traps = new Map(), picks = new Map(), orbs = new Map();
  let boss = null;
  const seenEv = new Set(); let seenQ = [];
  const cam = { yaw: 0, pitch: 45, dist: 11.5, fx: 0, fz: -58, fy: 0.5, dragT: 0, shake: 0, reset: false, lock: null, flyPull: 0, introDone: false };
  let listeners = {};
  const opts = { shake: true, simple: false };
  let pr = 1.5, frameAvg = 16, lastFrame = 0;
  const V = new THREE.Vector3();

  /* ---------- パーティクル（1回の描画で数百個） ---------- */
  function makePoints(n, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('pcol', new THREE.BufferAttribute(col, 4)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const tex = GFX.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(additive ? 0.3 : 0.55, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 400 } },
      vertexShader: 'attribute float size; attribute vec4 pcol; varying vec4 vCol; uniform float uScale; void main(){ vCol=pcol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vCol; void main(){ vec4 t=texture2D(map,gl_PointCoord); float a=vCol.a*t.a; if(a<0.01) discard; gl_FragColor=vec4(vCol.rgb,a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5;
    const P = []; for (let i = 0; i < n; i++) P.push({ life: 0 });
    return { pts, P, n, geo, mat, next: 0 };
  }
  let PA, PN;
  const tmpC = new THREE.Color();
  function emit(sys, o) {
    const S = sys === 'add' ? PA : PN; if (opts.simple && Math.random() < 0.5) return;
    const p = S.P[S.next]; S.next = (S.next + 1) % S.n;
    p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.life = p.max = o.life || 0.6; p.s0 = o.s0 || 0.4; p.s1 = o.s1 == null ? p.s0 : o.s1;
    tmpC.set(o.c || 0xffffff); p.r = tmpC.r; p.g = tmpC.g; p.b = tmpC.b; p.a = o.a == null ? 1 : o.a; p.grav = o.grav || 0; p.drag = o.drag || 0;
  }
  function burst(sys, n, o) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * 0.5, s = (o.spd || 3) * (0.4 + Math.random() * 0.8); emit(sys, Object.assign({}, o, { x: o.x + (Math.random() - 0.5) * (o.spread || 0), z: o.z + (Math.random() - 0.5) * (o.spread || 0), vx: Math.cos(a) * Math.cos(e) * s + (o.vx || 0), vy: Math.sin(e) * s + (o.vy || 0) + (o.up || 0), vz: Math.sin(a) * Math.cos(e) * s + (o.vz || 0), life: (o.life || 0.6) * (0.6 + Math.random() * 0.6) })); } }
  function stepPoints(S, dt) {
    const pos = S.geo.attributes.position.array, col = S.geo.attributes.pcol.array, sz = S.geo.attributes.size.array;
    for (let i = 0; i < S.n; i++) {
      const p = S.P[i];
      if (p.life > 0) { p.life -= dt; p.vy -= p.grav * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.03 && p.grav) { p.y = 0.03; p.vy *= -0.3; } }
      const k = p.life > 0 ? p.life / p.max : 0;
      pos[i * 3] = p.x || 0; pos[i * 3 + 1] = p.y || -50; pos[i * 3 + 2] = p.z || 0;
      col[i * 4] = p.r || 0; col[i * 4 + 1] = p.g || 0; col[i * 4 + 2] = p.b || 0; col[i * 4 + 3] = k > 0 ? p.a * Math.min(1, k * 2.5) : 0;
      sz[i] = k > 0 ? p.s1 + (p.s0 - p.s1) * k : 0;
    }
    S.geo.attributes.position.needsUpdate = S.geo.attributes.pcol.needsUpdate = S.geo.attributes.size.needsUpdate = true;
  }

  /* ---------- 初期化 ---------- */
  function init(cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    pr = Math.min(window.devicePixelRatio || 1, 1.75); renderer.setPixelRatio(pr);
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a2650);
    camera = new THREE.PerspectiveCamera(50, 1, 0.2, 400);
    const wroot = new THREE.Group(); scene.add(wroot); W = GFX.buildWorld(wroot, scene); W.root = wroot; // 北千住（ステージ1）
    PA = makePoints(700, true); PN = makePoints(500, false); scene.add(PA.pts); scene.add(PN.pts);
    resize();
    // 自分の足元の印（ボスの体に隠れても見える）
    cam.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false })); cam.ring.rotation.x = -Math.PI / 2; cam.ring.renderOrder = 20; scene.add(cam.ring);
    cam.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 })); cam.arrow.rotation.x = Math.PI / 2; cam.arrow.renderOrder = 21; scene.add(cam.arrow);
    // 先に進むときの小さな黄色い矢印（足元）
    const sh = new THREE.Shape(); sh.moveTo(0, 0.42); sh.lineTo(0.3, 0.06); sh.lineTo(0.11, 0.06); sh.lineTo(0.11, -0.32); sh.lineTo(-0.11, -0.32); sh.lineTo(-0.11, 0.06); sh.lineTo(-0.3, 0.06); sh.closePath();
    const ag = new THREE.ShapeGeometry(sh); ag.rotateX(-Math.PI / 2); ag.rotateY(Math.PI);
    W.goArrow = new THREE.Group(); W.goArrow.visible = false; W.goArrow.renderOrder = 19; scene.add(W.goArrow);
    const back = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0x5a3a00, transparent: true, opacity: 0.85, depthTest: false })); back.scale.setScalar(1.25); back.position.y = 0.01; back.renderOrder = 19; W.goArrow.add(back);
    const front = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.98, depthTest: false })); front.position.y = 0.02; front.renderOrder = 20; W.goArrow.add(front);
    // ボスの光線（招福看板光線）
    const bm = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
    W.kousen = new THREE.Group(); scene.add(W.kousen); W.kousen.visible = false;
    const g1 = new THREE.BoxGeometry(2.6, 1.4, 1); g1.translate(0, 0.7, 0.5); W.kousenGround = new THREE.Mesh(g1, bm); W.kousen.add(W.kousenGround);
    const core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }); const g3 = new THREE.BoxGeometry(0.9, 0.6, 1); g3.translate(0, 0.6, 0.5); W.kousenCore = new THREE.Mesh(g3, core); W.kousen.add(W.kousenCore);
    const g2 = new THREE.CylinderGeometry(0.5, 1.2, 1, 12, 1, true); g2.translate(0, 0.5, 0); W.kousenDrop = new THREE.Mesh(g2, bm); W.kousen.add(W.kousenDrop);
    // 提灯火の光（8回の脈動）
    W.sbeams = [];
    return { renderer, scene, camera };
  }
  function resize() {
    const w = VIEW.w, h = VIEW.h; renderer.setSize(w, h, false); camera.aspect = w / h;
    const portrait = h > w; camera.fov = portrait ? DATA.CAM.portrait_framing.fov : DATA.CAM.vertical_fov_deg; camera.updateProjectionMatrix();
    cam.portrait = portrait;
  }
  function setOpts(o) { Object.assign(opts, o); }
  function on(k, f) { listeners[k] = f; }

  /* ---------- 予兆（危険範囲） ---------- */
  const stripeT = () => R._st || (R._st = GFX.tex(64, 64, (g) => { g.fillStyle = 'rgba(255,90,40,0.55)'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,200,150,0.55)'; g.lineWidth = 10; for (let i = -64; i < 128; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); } }, [6, 6]));
  const chevT = () => R._ch || (R._ch = GFX.tex(64, 64, (g) => { g.fillStyle = 'rgba(180,40,120,0.45)'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,170,220,0.9)'; g.lineWidth = 9; g.beginPath(); g.moveTo(10, 50); g.lineTo(32, 18); g.lineTo(54, 50); g.stroke(); }, [1, 10]));
  function outline(shape, a, b, c) {
    const m = new THREE.MeshBasicMaterial({ color: 0xffc7a0, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }), grp = new THREE.Group();
    const strip = (x0, z0, x1, z1, w) => { const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(w, len); g.rotateX(-Math.PI / 2); const mm = new THREE.Mesh(g, m); mm.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); mm.rotation.y = Math.atan2(x1 - x0, z1 - z0); grp.add(mm); };
    if (shape === 'fan') { const g = new THREE.RingGeometry(b - 0.12, b, 24, 1, -Math.PI / 2 - c, 2 * c); g.rotateX(-Math.PI / 2); grp.add(new THREE.Mesh(g, m)); for (const s of [-1, 1]) strip(Math.sin(s * c) * a, Math.cos(s * c) * a, Math.sin(s * c) * b, Math.cos(s * c) * b, 0.12); if (a > 0.2) { const g2 = new THREE.RingGeometry(a, a + 0.1, 16, 1, -Math.PI / 2 - c, 2 * c); g2.rotateX(-Math.PI / 2); grp.add(new THREE.Mesh(g2, m)); } }
    else if (shape === 'circle') { const g = new THREE.RingGeometry(a - 0.12, a, 40); g.rotateX(-Math.PI / 2); grp.add(new THREE.Mesh(g, m)); }
    else { const w = b / 2; strip(-w, 0, -w, a, 0.12); strip(w, 0, w, a, 0.12); strip(-w, 0, w, 0, 0.12); strip(-w, a, w, a, 0.12); }
    grp.userData.mat = m; return grp;
  }
  function polyOutline(pts) {
    const m = new THREE.MeshBasicMaterial({ color: 0xffc7a0, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }), grp = new THREE.Group();
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), g = new THREE.PlaneGeometry(0.14, len); g.rotateX(-Math.PI / 2); const mm = new THREE.Mesh(g, m); mm.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2); mm.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); grp.add(mm); }
    grp.userData.mat = m; return grp;
  }
  function makeHz(h) {
    const g = new THREE.Group(); g.position.set(h.x, 0.04 + (h.id % 7) * 0.003, h.z); g.rotation.y = h.yaw; g.renderOrder = 3;
    let geo, fill;
    const isPath = h.kind === 'path';
    const base = new THREE.MeshBasicMaterial({ map: isPath ? chevT() : stripeT(), transparent: true, opacity: isPath ? 0.75 : 0.42, depthWrite: false, side: THREE.DoubleSide });
    if (h.kind === 'poly' && h.pts) { const sh = new THREE.Shape(); h.pts.forEach((q, i) => i ? sh.lineTo(q[0], -q[1]) : sh.moveTo(q[0], -q[1])); sh.closePath(); geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); g.position.set(0, 0.05, 0); g.rotation.y = 0; }
    else if (h.kind === 'fan') { geo = new THREE.RingGeometry(Math.max(0.01, h.a), h.b, 28, 1, -Math.PI / 2 - h.c, 2 * h.c); geo.rotateX(-Math.PI / 2); }
    else if (h.kind === 'circle') { geo = new THREE.CircleGeometry(h.a, 36); geo.rotateX(-Math.PI / 2); }
    else { geo = new THREE.PlaneGeometry(h.b, h.a); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, h.a / 2); if (isPath) { base.map = chevT().clone(); base.map.needsUpdate = true; base.map.repeat.set(1, h.a / 3); } }
    const bm = new THREE.Mesh(geo, base); g.add(bm);
    const fm = new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    fill = new THREE.Mesh(geo, fm); fill.position.y = 0.005; g.add(fill);
    const ol = h.kind === 'poly' && h.pts ? polyOutline(h.pts) : outline(h.kind === 'fan' ? 'fan' : h.kind === 'circle' ? 'circle' : 'rect', h.a, h.b, h.c); ol.position.y = 0.01; g.add(ol);
    if (h.fx === 'quad4' || h.fx === 'tri3' || h.fx === 'link2') { base.color = new THREE.Color(h.fx === 'quad4' ? 0xff7a2a : h.fx === 'tri3' ? 0xffd84a : 0xb89aff); }
    if (h.fx === 'water') { base.map = null; base.color = new THREE.Color(0x6ac8ff); fm.color.set(0x6ac8ff); }
    if (h.fx === 'debuffMark') { base.color = new THREE.Color(0xd89aff); }
    scene.add(g);
    const o = { g, base, fill, fm, ol, kind: h.kind, fx: h.fx };
    if (h.fx === 'otoshi' || h.fx === 'bomb') { const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb060 })); l.scale.set(1, 1.3, 1); scene.add(l); o.lant = l; }
    return o;
  }
  function updHz(o, h, T) {
    if (o.kind !== 'poly') { o.g.position.x = h.x; o.g.position.z = h.z; o.g.rotation.y = h.yaw; } // 向きを追う予告（連掌・水環めぐり）
    const pre = h.t < h.warn, p = Math.min(1, h.t / Math.max(0.01, h.warn));
    const visible = !(h.brief && pre && h.warn - h.t > h.brief);
    o.g.visible = visible;
    if (o.kind === 'path') { o.base.map.offset.y -= 0.03; o.base.opacity = 0.5 + Math.sin(T * 12) * 0.2; o.fill.visible = false; o.ol.userData.mat.color.set(0xff9ad8); }
    else if (pre && o.kind === 'poly') { o.fm.opacity = 0.15 + p * 0.35; o.base.opacity = 0.32 + Math.sin(T * 14) * 0.08; o.ol.userData.mat.color.set(0xffc7a0); }
    else if (pre) { if (o.kind === 'fan' || o.kind === 'circle') o.fill.scale.set(p, 1, p); else o.fill.scale.set(1, 1, p); o.fm.opacity = 0.32; o.base.opacity = 0.32 + Math.sin(T * 14) * 0.08; o.ol.userData.mat.color.set(0xffc7a0); }
    else { o.fill.scale.set(1, 1, 1); o.fm.color.set(0xfff0c8); o.fm.opacity = 0.55 + Math.sin(T * 30) * 0.15; o.ol.userData.mat.color.set(0xffffff); }
    if (o.lant) { o.lant.visible = pre; const k = p; o.lant.position.set(h.x, 9 * (1 - k * k) + 0.3, h.z); }
  }
  function dropHz(o) { scene.remove(o.g); if (o.lant) scene.remove(o.lant); o.g.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }

  /* ---------- 弾・ワナ・拾い物 ---------- */
  const PJM = {};
  function projMesh(kind) {
    if (!PJM.star) {
      PJM.star = [new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffe27a })];
      PJM.can = [new THREE.DodecahedronGeometry(0.13), GFX.lam(0x8a8478, { emissive: 0x2a2620, flatShading: true })]; // v7：自分の部品（石片・籠手）を投げる
      PJM.focus = [new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff6c0 })];
      PJM.fire = [new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff7a2a })];
      PJM.mark = [new THREE.TorusGeometry(0.16, 0.05, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff4a2a })];
      PJM.leaf = PJM.star;
      const ft = GFX.fudaTex(); PJM.fuda = [new THREE.PlaneGeometry(0.24, 0.42), GFX.lam(0xffffff, { map: ft, side: THREE.DoubleSide, emissive: 0x552211 })];
      PJM.lantern = PJM.fire;
      PJM.reiko = [new THREE.SphereGeometry(DATA.UENO.moves.reiko.r, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd8ff8a, transparent: true, opacity: 0.85 })]; // 判定と同じ太さ（直径1.2m）
      PJM.gun = [new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6a0 })];
      PJM.hoshi = [new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xffd84a })];
      PJM.mizu = [new THREE.SphereGeometry(0.4, 12, 10), new THREE.MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: 0.8 })];
    }
    const [g, m] = PJM[kind] || PJM.star; const mesh = new THREE.Mesh(g, m); scene.add(mesh); return mesh;
  }
  function trapMesh(kind) {
    const g = new THREE.Group();
    if (kind === 'mine') { GFX.parts.S(g, 0.22, 0x1d1d22, 0, 0.2, 0); GFX.parts.C(g, 0.03, 0.03, 0.18, 0x8a6a3a, 0, 0.45, 0); g.userData.spark = true; }
    else { const d = GFX.parts.C(g, 0.35, 0.35, 0.04, GFX.lam(0xf2c94c, { emissive: 0x806010 }), 0, 0.03, 0, null, 20); }
    scene.add(g); return g;
  }
  function pickMesh(kind) {
    const g = new THREE.Group();
    if (kind === 'food') { const o = GFX.parts.K(g, 0.2, 0.3, 0xffffff, 0, 0.3, 0); o.rotation.z = Math.PI; GFX.parts.B(g, 0.22, 0.12, 0.03, 0x1d2a1d, 0, 0.22, 0.13); }
    else if (kind === 'candy') { // 包み紙のキャンディー（全回復）
      const c = GFX.parts.G(g, 0, 0.55, 0); g.userData.spin = c;
      GFX.parts.S(c, 0.2, GFX.lam(0xff5fa8, { emissive: 0xff3c8c, emissiveIntensity: 0.55 }), 0, 0, 0, 1.25, 1, 1);
      GFX.parts.S(c, 0.205, GFX.lam(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 }), 0, 0, 0, 0.35, 1.02, 1.02);
      for (const s of [-1, 1]) { const w = GFX.parts.K(c, 0.15, 0.24, GFX.lam(0xffe066, { emissive: 0xc08a00, emissiveIntensity: 0.5 }), s * 0.33, 0, 0); w.rotation.z = s * Math.PI / 2; }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28), new THREE.MeshBasicMaterial({ color: 0xff8ac4, transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring); g.userData.ring = ring;
    }
    else { GFX.parts.S(g, 0.2, 0xa04a6a, 0, 0.25, 0); GFX.parts.S(g, 0.07, 0xf2c94c, 0, 0.45, 0); }
    scene.add(g); return g;
  }

  /* ---------- 救助の円（気絶した仲間のまわり。中に入るとゲージがたまる） ---------- */
  const rings = [];
  function reviveRing(i, a, T) {
    let o = rings[i];
    if (!o) {
      const R = DATA.SIM.reviveRange, g = new THREE.Group(); g.renderOrder = 4;
      const mk = (geo, col, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; g.add(m); return m; };
      const fill = mk(new THREE.CircleGeometry(R, 40), 0x7dffb0, 0.12), edge = mk(new THREE.RingGeometry(R - 0.09, R, 48), 0xbfffd8, 0.85);
      const arc = mk(new THREE.RingGeometry(R - 0.32, R - 0.12, 48, 1, Math.PI / 2, 0.001), 0x3cff8a, 0.95); arc.position.y = 0.005;
      g.position.y = 0.05; scene.add(g); o = rings[i] = { g, fill, edge, arc, p: -1 };
    }
    const on = a.st === 'down'; o.g.visible = on; if (!on) return;
    o.g.position.x = a.x; o.g.position.z = a.z;
    const p = Math.round((a.revP || 0) * 50) / 50, someone = a.revT >= 0;
    if (p !== o.p) { o.p = p; const R = DATA.SIM.reviveRange; o.arc.geometry.dispose(); o.arc.geometry = new THREE.RingGeometry(R - 0.32, R - 0.12, 48, 1, Math.PI / 2, Math.max(0.001, -p * Math.PI * 2)); o.arc.geometry.scale(1, 1, 1); o.arc.visible = p > 0; }
    o.edge.material.opacity = someone ? 0.95 : 0.55 + Math.sin(T * 5) * 0.25; o.fill.material.opacity = someone ? 0.22 : 0.1;
  }

  /* ---------- ステージ2：常磐線（車内・車窓・始まりの演出） ---------- */
  let TW = null; const JT = { dist: 0, cutBoss: null, lcd: '', fadeK: 1 };
  const ensureTrain = () => TW || (TW = GFX.buildTrain(scene));
  const JSTART = [[-0.6, -4.2], [0.6, -4.2], [-0.6, -5.8], [0.6, -5.8]];
  /** 始まりの演出での味方の位置：広場でトバトーバが倒れる → 北千住のホームから3号車に乗る */
  function introPose(t, i) {
    if (t < 3.5) return { x: [-1.8, 1.8, -0.6, 0.6][i], z: [7.2, 7.2, 6, 6][i], yaw: 0, moving: false, act: '', st: 'ok' };
    const p0 = [-4.4 - (i % 2) * 0.9, -3.5 + (i - 1.5) * 1.1], d = [-1.7, -3.5], f = JSTART[i], t0 = 4.3 + i * 0.45;
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    if (t < t0) return { x: p0[0], z: p0[1], yaw: Math.PI / 2, moving: false, act: '', st: 'ok' };
    if (t < t0 + 1.5) { const k = (t - t0) / 1.5, q = lerp(p0, d, k); return { x: q[0], z: q[1], yaw: Math.atan2(d[0] - p0[0], d[1] - p0[1]), moving: true, act: '', st: 'ok' }; }
    if (t < t0 + 2.5) { const k = (t - t0 - 1.5) / 1.0, q = lerp(d, f, k); return { x: q[0], z: q[1], yaw: Math.atan2(f[0] - d[0], f[1] - d[1]), moving: true, act: '', st: 'ok' }; }
    return { x: f[0], z: f[1], yaw: 0, moving: false, act: '', st: 'ok' };
  }
  /** 上野に着いたあとの時間（着いてから。着く前は -1） */
  const outroT = v => v.stageId !== 'joban' ? -1 : v.stage === 'arrive' ? v.stageT : (v.stage === 'won' && v.tr && v.tr.at >= 4) ? DATA.JOBAN.arriveT + v.stageT : -1;
  /** 上野：ドアが開いて、4人がホームに降りる */
  function outroPose(t, i) {
    const s0 = [-0.9, -3.5 + (i - 1.5) * 0.7], d = [-1.9, -3.5], f = [-2.8 - i * 0.78, -4.3 + (i % 2) * 0.55], t0 = 1.9 + i * 0.4;
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    if (t < t0) return { x: s0[0], z: s0[1], yaw: -Math.PI / 2, moving: false, act: '', st: 'ok' };
    if (t < t0 + 0.7) { const q = lerp(s0, d, (t - t0) / 0.7); return { x: q[0], z: q[1], yaw: Math.atan2(d[0] - s0[0], d[1] - s0[1]), moving: true, act: '', st: 'ok' }; }
    if (t < t0 + 1.7) { const q = lerp(d, f, (t - t0 - 0.7) / 1.0); return { x: q[0], z: q[1], yaw: Math.atan2(f[0] - d[0], f[1] - d[1]), moving: true, act: '', st: 'ok' }; }
    return { x: f[0], z: f[1], yaw: Math.atan2(-4.3 - f[0], 2 - f[1]), moving: false, act: '', st: 'ok' };
  }
  /* ---------- 上野編：駅前の広場 ---------- */
  let UW = null, SW = null; const ensureUeno = () => UW || (UW = GFX.buildUeno(scene)), ensureStreet = () => SW || (SW = GFX.buildStreet(scene));
  function syncUeno(v, T) {
    const ue = v.stageId === 'ueno', st = v.stageId === 'ueno_street', ak = v.stageId && v.stageId.startsWith('akiba');
    if (ue) { ensureUeno(); UW.root.visible = true; UW.update(T); } else if (UW) UW.root.visible = false;
    if (st) { ensureStreet(); SW.root.visible = true; SW.update(T, v.X); } else if (SW) SW.root.visible = false;
    if (ak && GFX.syncAkibaWorld) GFX.syncAkibaWorld(scene, v, T); else if (GFX.hideAkibaWorld) GFX.hideAkibaWorld();
    if (ue || st || ak) { W.root.visible = false; if (TW) TW.root.visible = false; }
    return ue || st || ak;
  }
  /** 居酒屋通りの始まり：改札を抜けて通りへ歩いてくる */
  function streetPose(t, i, a0) {
    const k = Math.max(0, Math.min(1, (t - 0.6 - i * 0.25) / 3.2)), e = k * k * (3 - 2 * k);
    return { x: a0.x, z: -6.5 + (a0.z + 6.5) * e, yaw: 0, moving: k > 0 && k < 1, act: '', st: 'ok' };
  }
  function syncTrain(v, dt, T, me) {
    if (syncUeno(v, T)) return;
    const jb = v.stageId === 'joban', it = v.introWait ? 0 : v.stageT;
    const showTrain = jb && !(v.stage === 'intro' && it < 3.5);
    W.root.visible = !showTrain; if (jb) ensureTrain(); if (TW) TW.root.visible = showTrain;
    // 演出用のトバトーバ（広場で倒れる）
    const wantBoss = jb && v.stage === 'intro' && it < 3.5;
    if (wantBoss && !JT.cutBoss) { JT.cutBoss = GFX.makeBoss(); W.root.add(JT.cutBoss.root); W.root.add(JT.cutBoss.shadow); }
    if (!wantBoss && JT.cutBoss) { W.root.remove(JT.cutBoss.root); W.root.remove(JT.cutBoss.shadow); JT.cutBoss = null; }
    if (JT.cutBoss) GFX.animBoss(JT.cutBoss, { x: 0, z: DATA.STAGE.bossSpawn[1], y: 0, yaw: Math.PI, st: 'dead', t: Math.max(0, it - 0.4) * 0.8, mv: null, phase: 2, hpR: 0, fl: null }, T, dt, v);
    if (!showTrain) return;
    // 電車の進み・ホームの位置・ドア
    const Jd = DATA.JOBAN, tr = v.tr; let platZ = null, st = 0, doors = false, speed = 0, top = '常磐線 上野行', main = '北千住', sub = 'Kita-Senju';
    if (v.stage === 'intro') { platZ = 0; doors = it >= 3.6 && it < 9.4; top = '常磐線 上野行　まもなく発車'; }
    else if (tr) {
      speed = tr.v; const L = Jd.segLen[Math.min(3, tr.at)], d = L - tr.rem;
      if (tr.ph === 'stop') { platZ = 0; st = tr.at; doors = tr.doors === 1 || outroT(v) > 1.4; top = tr.at >= 4 ? '常磐線　終点' : '常磐線 上野行　ただいま'; main = Jd.stations[tr.at]; sub = Jd.stationsEn[tr.at]; }
      else { const nx = Math.min(4, tr.at + 1); top = '常磐線 上野行　次は'; main = Jd.stations[nx]; sub = Jd.stationsEn[nx]; if (tr.rem < 260) { platZ = tr.rem; st = nx; } else if (d < 260) { platZ = -d; st = tr.at; } }
    }
    JT.dist += speed * dt;
    JT.rail = (JT.rail || 0) + speed * dt; if (JT.rail > 22) { JT.rail = 0; AUDIO.sfx('rail', null, null, 0.4 + speed / Jd.vmax * 0.6); } // ガタンゴトン
    if (platZ != null) TW.setStation(Math.min(4, st));
    TW.update(JT.dist, platZ, doors, T, dt);
    const key = top + main; if (key !== JT.lcd) { JT.lcd = key; TW.setLcd(top, main, sub); }
    // 連結部の壁：カメラと自分が別の車両にいるときは薄くする
    const ma = v.allies[me];
    if (ma) { const cz = camera.position.z, across = (cz < -0.9 && ma.z > -0.3) || (cz > 0.9 && ma.z < 0.3) || Math.abs(cz) < 1.1; for (const m of TW.fade) { m.opacity += ((across ? 0.15 : 1) - m.opacity) * Math.min(1, dt * 8); m.depthWrite = m.opacity > 0.9; } }
  }

  /** カメラのすぐ前の部下は消し、自分を隠す位置の部下は半透明にする（視界をふさがない） */
  function yoshiOcclude(m, e, a) {
    const cx = camera.position.x, cz = camera.position.z, cd = Math.hypot(e.x - cx, e.z - cz);
    m.root.visible = cd > 1.4; if (!a || !m.root.visible) return;
    const dx = a.x - cx, dz = a.z - cz, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const t = (e.x - cx) * ux + (e.z - cz) * uz, side = Math.abs((e.x - cx) * uz - (e.z - cz) * ux);
    GFX.fadeYoshi(m, cd < 2.4 || (t > 0 && t < L - 0.35 && side < 0.75));
  }
  /* ---------- 同期 ---------- */
  function sync(v, dt, T, me) {
    if (!v) return;
    syncTrain(v, dt, T, me);
    const cut = v.stageId === 'joban' && v.stage === 'intro', cutT = v.introWait ? 0 : v.stageT, ot = outroT(v), outro = ot > 1.2;
    // 味方
    v.allies.forEach((a0, i) => {
      const stIn = v.stageId === 'ueno_street' && v.stage === 'intro';
      const a = cut ? Object.assign({}, a0, introPose(cutT, i), { hpR: 1 }) : stIn ? Object.assign({}, a0, streetPose(cutT, i, a0)) : outro && a0.st !== 'gone' ? Object.assign({}, a0, outroPose(ot, i)) : a0;
      let m = allies[i];
      if (!m || m.c.id !== a.ch) { if (m) { scene.remove(m.root); scene.remove(m.shadow); } m = GFX.makeChar(DATA.CHI[a.ch]); allies[i] = m; scene.add(m.root); scene.add(m.shadow); }
      GFX.animChar(m, a, T, dt, { me: i === me });
      // ため中の粒子・必殺の光
      if (a.act === 'charge' && Math.random() < 0.5) emit('add', { x: a.x + (Math.random() - 0.5) * 0.8, y: 0.2, z: a.z + (Math.random() - 0.5) * 0.8, vy: 1.5 + a.chg * 2, life: 0.4, s0: 0.12, s1: 0.02, c: a.ch === 'momiji' ? 0x8aff9a : 0xffc060 });
      if (a.ch === 'kemuridama' && Math.random() < 0.15) { const f = a.yaw; emit('norm', { x: a.x + Math.sin(f) * 0.35, y: 0.5, z: a.z + Math.cos(f) * 0.35, vy: 0.5, vx: (Math.random() - 0.5) * 0.2, life: 1.2, s0: 0.12, s1: 0.4, c: 0xe6e6ea, a: 0.5 }); }
      if (a.ch === 'kagetsubame' && a.moving && Math.random() < 0.4) emit('norm', { x: a.x, y: 0.4, z: a.z, vy: 0.2, life: 0.5, s0: 0.3, s1: 0.1, c: 0x1a1c3a, a: 0.45 });
      if (a.st === 'down' && Math.random() < 0.06) emit('add', { x: a.x, y: 0.6, z: a.z, vy: 0.6, life: 1.0, s0: 0.25, s1: 0.05, c: 0xaad0ff });
      // G玉の強化中：金色の炎のオーラ（覚醒した敵の赤とは別の色）
      if (!m.gAura) { const gm = new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.gAura = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.5, 18, 1, true), gm); m.gAura.position.y = 0.75; m.root.add(m.gAura); }
      { const on = a.gT > 0 && a.st === 'ok'; m.gAura.visible = on; if (on) { m.gAura.material.opacity = 0.28 + Math.sin(T * 9 + i) * 0.1; m.gAura.rotation.y = T * 2; m.gAura.scale.setScalar(1 / (m.h || 1)); m.gAura.position.y = 0.75 / (m.h || 1); if (Math.random() < 0.6) emit('add', { x: a.x + (Math.random() - 0.5) * 0.7, y: 0.15, z: a.z + (Math.random() - 0.5) * 0.7, vy: 2.2, life: 0.5, s0: 0.22, s1: 0.04, c: Math.random() < 0.5 ? 0xffd84a : 0xff9a2a }); } }
      reviveRing(i, a, T);
      if (a.strBuff && Math.random() < 0.12) emit('add', { x: a.x + (Math.random() - 0.5) * 0.6, y: 0.2, z: a.z + (Math.random() - 0.5) * 0.6, vy: 1.2, life: 0.5, s0: 0.14, s1: 0.03, c: 0xff5a4a });
    });
    // ボス
    if (v.boss) {
      const wantK = v.stageId === 'ueno' ? 'yoshinoshin' : 'tobatoban';
      if (boss && (boss.kind || 'tobatoban') !== wantK) { scene.remove(boss.root); scene.remove(boss.shadow); boss = null; }
      if (!boss) { boss = wantK === 'yoshinoshin' ? GFX.makeYoshinoshin() : GFX.makeBoss(); scene.add(boss.root); scene.add(boss.shadow); }
      if (wantK === 'yoshinoshin') { GFX.animYoshinoshin(boss, v.boss, T, dt, v); if (v.boss.st === 'sleep' && Math.random() < 0.05) emit('add', { x: v.boss.x + 0.4, y: 3.4, z: v.boss.z, vy: 0.6, vx: 0.3, life: 1.6, s0: 0.35, s1: 0.6, c: 0xbfd8ff }); }
      else {
      boss.root.visible = v.boss.st !== 'hidden'; boss.shadow.visible = boss.root.visible;
      GFX.animBoss(boss, v.boss, T, dt, v);
      if (v.boss.st === 'intro') { boss.root.visible = v.stageT > 0.75 && !v.introWait; }
      if (v.boss.st === 'dead' && v.boss.t > 1.6) { boss.root.visible = v.boss.t < 3.2 ? Math.floor(T * 12) % 2 === 0 : false; boss.shadow.visible = boss.root.visible; }
      if (v.boss.stun && Math.random() < 0.3) emit('add', { x: v.boss.x + (Math.random() - 0.5) * 2, y: 3 + Math.random() * 2, z: v.boss.z + (Math.random() - 0.5) * 2, life: 0.3, s0: 0.3, s1: 0.05, c: 0xfff060 });
      if (v.boss.st === 'down' && Math.random() < 0.2) emit('add', { x: v.boss.x + (Math.random() - 0.5) * 1.5, y: 4.6, z: v.boss.z + (Math.random() - 0.5) * 1.5, vy: 0.3, life: 0.8, s0: 0.25, s1: 0.1, c: 0xffe070 });
      if (v.boss.st === 'fly' && Math.random() < 0.6) emit('norm', { x: v.boss.x, y: v.boss.y + 2, z: v.boss.z, vy: -0.4, vx: (Math.random() - 0.5), life: 1.0, s0: 0.5, s1: 1.2, c: 0xd8c8b0, a: 0.4 });
      }
    } else if (boss) { scene.remove(boss.root); scene.remove(boss.shadow); boss = null; }
    // 札小僧
    const seenM = new Set();
    for (const e of v.mobs) { seenM.add(e.id); let m = mobs.get(e.id); if (e.akiba) { if (!m) { m = GFX.makeAkiba(e.kind); mobs.set(e.id, m); scene.add(m.root); scene.add(m.shadow); } GFX.animAkiba(m, e, T, dt); continue; } if (!m) { m = e.yoshi ? GFX.makeYoshi(e.kind) : GFX.makeMob(); m.yoshi = e.yoshi; if (e.yoshi) m.root.scale.setScalar(0.4); mobs.set(e.id, m); scene.add(m.root); scene.add(m.shadow); burst('norm', 10, { x: e.x, y: 0.5, z: e.z, spd: 1.5, life: 0.6, s0: 0.4, s1: 0.8, c: e.yoshi ? 0xb8a8ff : 0xf0e8d8, a: 0.6 }); } if (m.yoshi) { GFX.animYoshi(m, e, T, dt); yoshiOcclude(m, e, v.allies[me]); } else GFX.animMob(m, e, T, dt); } // カメラのすぐ前の部下は消して視界をふさがない
    for (const [id, m] of mobs) if (!seenM.has(id)) { scene.remove(m.root); scene.remove(m.shadow); mobs.delete(id); }
    // 弾
    const seenP = new Set();
    for (const p of v.projs) {
      seenP.add(p.id); let m = projs.get(p.id); if (!m) { m = projMesh(p.kind); projs.set(p.id, m); }
      m.position.set(p.x, p.kind === 'fuda' ? 0.6 : p.kind === 'reiko' ? 1.1 : 0.65, p.z); m.rotation.y = T * 12;
      if (p.kind === 'focus') m.scale.setScalar(Math.max(0.8, p.r / 0.45 * 1.2));
      if (p.kind === 'fuda') { m.rotation.set(0, p.yaw + T * 14, 0.3); }
      if (p.kind === 'gun') { m.rotation.set(0, p.yaw, 0); m.position.y = 0.8; }
      if (Math.random() < (p.kind === 'fire' ? 0.9 : 0.5)) emit('add', { x: p.x, y: 0.65, z: p.z, life: 0.25, s0: p.kind === 'fire' ? 0.5 : 0.25, s1: 0.02, c: { star: 0xffe27a, can: 0xbfd8ff, focus: 0xfff6c0, fire: 0xff7a2a, mark: 0xff4a2a, fuda: 0xff8a6a, reiko: 0xc8ff6a }[p.kind] || 0xffffff });
    }
    for (const [id, m] of projs) if (!seenP.has(id)) { scene.remove(m); projs.delete(id); }
    // G玉（紫紺の球に金の輪・残り3秒で明滅）
    const seenO = new Set();
    for (const ob of v.orbs || []) {
      seenO.add(ob.id); let m = orbs.get(ob.id);
      if (!m) { m = new THREE.Group(); const ball = new THREE.Mesh(new THREE.SphereGeometry(DATA.SIM.orb.r, 18, 14), new THREE.MeshStandardMaterial({ color: 0x2a1f6a, emissive: 0x3a2a8a, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.3 })); m.add(ball); for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(DATA.SIM.orb.r + 0.07 + i * 0.05, 0.018, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffd84a })); r.rotation.x = i ? 1.2 : 0.4; m.add(r); } m.userData.ball = ball; orbs.set(ob.id, m); scene.add(m); burst('add', 14, { x: ob.x, y: 0.4, z: ob.z, spd: 2, life: 0.5, s0: 0.3, s1: 0.05, c: 0xffd84a }); }
      m.position.set(ob.x, 0.42 + Math.sin(T * 5 + ob.id) * 0.05, ob.z); m.rotation.y = T * 2; m.children[1].rotation.z = T * 3; m.children[2].rotation.y = T * 2.4;
      m.visible = ob.life > 3 || Math.floor(T * 6) % 2 === 0;
      if (Math.random() < 0.5) emit('add', { x: ob.x, y: 0.42, z: ob.z, life: 0.35, s0: 0.22, s1: 0.03, c: 0xb89aff });
    }
    for (const [id, m] of orbs) if (!seenO.has(id)) { scene.remove(m); orbs.delete(id); }
    // 予兆
    const seenH = new Set();
    for (const h of v.hz) { seenH.add(h.id); let o = hzs.get(h.id); if (!o) { o = makeHz(h); hzs.set(h.id, o); } updHz(o, h, T); }
    for (const [id, o] of hzs) if (!seenH.has(id)) { dropHz(o); hzs.delete(id); }
    // ボスの光線
    let beamOn = false;
    if (v.boss) for (const h of v.hz) if (h.fx === 'kousen' && h.t >= h.warn && h.t <= h.warn + h.act) {
      beamOn = true; const g = W.kousen; g.position.set(h.x, 0, h.z); g.rotation.y = h.yaw;
      W.kousenGround.scale.set(1 + Math.sin(T * 40) * 0.06, 1 + Math.sin(T * 33) * 0.1, h.a); W.kousenCore.scale.set(1 + Math.sin(T * 50) * 0.2, 1, h.a); W.kousenGround.material.opacity = 0.32 + Math.sin(T * 25) * 0.1;
      W.kousenDrop.position.set(0, 0, 0); W.kousenDrop.scale.set(1, 3.4, 1);
      if (Math.random() < 0.8) { const d = Math.random() * h.a; emit('add', { x: h.x + Math.sin(h.yaw) * d, y: 0.4 + Math.random(), z: h.z + Math.cos(h.yaw) * d, vy: 1.5, life: 0.4, s0: 0.5, s1: 0.1, c: 0xfff0a0 }); }
    }
    W.kousen.visible = beamOn;
    if (v.boss && v.boss.mv === 'fubuki' && v.boss.st === 'act') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const yaw = v.boss.yaw + s * DATA.BMOVES.fubuki.fanYaw + (Math.random() - 0.5) * DATA.BMOVES.fubuki.fanHalf * 2, sp = 14; emit('norm', { x: v.boss.x + Math.sin(yaw) * 1.2 + Math.cos(v.boss.yaw) * s * 1.3, y: 3.8, z: v.boss.z + Math.cos(yaw) * 1.2 - Math.sin(v.boss.yaw) * s * 1.3, vx: Math.sin(yaw) * sp, vz: Math.cos(yaw) * sp, vy: -4.5, life: 0.65, s0: 0.28, s1: 0.22, c: Math.random() < 0.5 ? 0xfff6e0 : 0xff6a5a, a: 0.95 }); }
    if (v.boss && v.boss.mv === 'shime' && v.boss.st === 'act' && Math.random() < 0.9) { const yaw = v.boss.yaw + Math.PI + (Math.random() - 0.5) * 2.2, d = 1 + Math.random() * 6; emit('norm', { x: v.boss.x + Math.sin(yaw) * d, y: 0.4, z: v.boss.z + Math.cos(yaw) * d, vy: 2, life: 0.5, s0: 0.5, s1: 0.9, c: 0xd9c08a, a: 0.6 }); }
    // ワナ・拾い物
    const seenT = new Set();
    for (const t of v.traps) { seenT.add(t.id); let m = traps.get(t.id); if (!m) { m = trapMesh(t.kind); traps.set(t.id, m); } m.position.set(t.x, 0, t.z); if (t.kind === 'mine' && t.armed && Math.random() < 0.4) emit('add', { x: t.x, y: 0.55, z: t.z, vy: 1, life: 0.2, s0: 0.15, s1: 0.02, c: 0xffd040 }); if (t.kind === 'para') m.children[0].material.emissiveIntensity = t.armed ? 0.6 + Math.sin(T * 10) * 0.4 : 0.1; }
    for (const [id, m] of traps) if (!seenT.has(id)) { scene.remove(m); traps.delete(id); }
    const seenK = new Set();
    for (const p of v.pickups) {
      seenK.add(p.id); let m = picks.get(p.id); if (!m) { m = pickMesh(p.kind); picks.set(p.id, m); }
      if (p.kind === 'candy') { m.position.set(p.x, 0, p.z); m.userData.spin.position.y = 0.55 + Math.sin(T * 3 + p.id) * 0.1; m.userData.spin.rotation.y = T * 2; const k = 1 + Math.sin(T * 5) * 0.12; m.userData.ring.scale.set(k, k, 1); if (Math.random() < 0.12) emit('add', { x: p.x + (Math.random() - 0.5) * 0.5, y: 0.5, z: p.z + (Math.random() - 0.5) * 0.5, vy: 0.8, life: 0.7, s0: 0.16, s1: 0.02, c: 0xff9ad0 }); continue; }
      m.position.set(p.x, 0.1 + Math.sin(T * 4 + p.id) * 0.08, p.z); m.rotation.y = T * 1.5; if (Math.random() < 0.05) emit('add', { x: p.x, y: 0.6, z: p.z, vy: 0.6, life: 0.6, s0: 0.15, s1: 0.02, c: 0xfff6c0 });
    }
    for (const [id, m] of picks) if (!seenK.has(id)) { scene.remove(m); picks.delete(id); }
    // 先に進むべきとき：黄色い小さな矢印で行き先を示す
    {
      const a = v.allies[me]; let tgt = null;
      if (a && a.st === 'ok' && v.stage === 'street') {
        const ms = v.mobs.filter(q => !q.dying);
        if (!ms.length && v.barrier === 'none') tgt = [0, 4];
        else if (ms.length) { let bd = 1e9, bm = null; for (const q of ms) { const d = Math.hypot(q.x - a.x, q.z - a.z); if (d < bd) { bd = d; bm = q; } } if (bd > 13) tgt = [bm.x, bm.z]; }
      }
      W.goArrow.visible = !!tgt;
      if (tgt) { const yaw = Math.atan2(tgt[0] - a.x, tgt[1] - a.z), bob = 1.45 + Math.sin(T * 6) * 0.18; W.goArrow.position.set(a.x + Math.sin(yaw) * bob, 0.05, a.z + Math.cos(yaw) * bob); W.goArrow.rotation.y = yaw; }
    }
    // 灯籠・提灯・結界
    const bossStage = v.stage === 'boss';
    W.toro.forEach((o, i) => {
      const lit = v.lan.lit[i];
      if (lit !== o.lit) { o.lit = lit; o.fire.material.emissive.set(lit ? 0xff9a3a : 0x000000); o.glow.visible = lit; }
      o.ring.visible = bossStage && !lit;
      o.ring.material.color.set(v.lan.cool > 0 ? 0x777777 : 0xffe08a); o.ring.material.opacity = v.lan.cool > 0 ? 0.25 : 0.35 + Math.sin(T * 5) * 0.2;
    });
    W.barrierStreet.visible = v.barrier === 'street'; W.barrierPlaza.visible = v.barrier === 'plaza';
    if (W.barrierStreet.visible) W.barrierStreet.children.forEach((c, i) => c.rotation.y = Math.sin(T * 2 + i) * 0.2);
    // 提灯が一つずつ灯る（戦いが近づいたら）
    const lightUp = v.barrier !== 'street' || v.stage !== 'street';
    if (lightUp) { cam.lanT = (cam.lanT || 0) + dt; const n = Math.floor(cam.lanT / 0.12); W.lanternsStreet.forEach((L, i) => { const want = (W.lanternsStreet.length - 1 - i) < n; if (want !== L.lit) W.setStreetLantern(L, want); }); }
    W.plazaLit.visible = v.stage !== 'street'; W.plazaUnlit.visible = !W.plazaLit.visible;
    // 登場演出：紙片が転がり、店先の看板が広場を向く
    if (v.stage === 'intro') {
      const t = v.introWait ? 0 : v.stageT;
      W.papers.forEach((p, i) => { if (!p.s) { p.s = 1; p.x = (Math.random() - 0.5) * 12; p.z = 3 + Math.random() * 10; p.m.visible = true; } const a = t * 2 + i; p.x += (0 - p.x) * dt * 0.8; p.z += (DATA.STAGE.bossSpawn[1] - p.z) * dt * 0.8; p.m.position.set(p.x + Math.sin(a) * 0.5, 0.15 + Math.abs(Math.sin(a * 3)) * 0.3 + (t > 0.8 ? (t - 0.8) * 3 : 0), p.z); p.m.rotation.set(a * 3, a * 2, 0); if (t > 1.2) p.m.visible = false; });
      W.signs.forEach(s => { s.g.rotation.y += (Math.atan2(0 - s.g.position.x, DATA.STAGE.bossSpawn[1] - s.g.position.z) - s.g.rotation.y) * Math.min(1, dt * 3); });
    } else W.papers.forEach(p => { p.m.visible = false; p.s = 0; });
    // ガラス屋根：アーケードの下では薄く
    const ma = v.allies[me];
    if (ma) {
      // 遮蔽物を薄くする：アーケードの下・ゲートや鉄骨がカメラと味方の間にあるとき（判定は変えない）
      const under = Math.abs(ma.x) > 5.8 && ma.z < 0, cz = camera.position.z;
      const nearGate = (cz < 1.5 && ma.z > -9) || (v.stage === 'intro');
      const arcadeFade = (ma.z > -2 && cz > -18) || v.stage === 'intro';
      const fa = (m, t) => { m.opacity += (t - m.opacity) * Math.min(1, dt * 6); m.depthWrite = m.opacity > 0.9; };
      fa(W.fadeArcade[1], under || arcadeFade ? 0.06 : 0.26);
      fa(W.fadeArcade[0], arcadeFade ? 0.12 : 1);
      for (const g of W.fadeGate) fa(g, nearGate ? 0.1 : 1);
    }
  }

  /* ---------- 演出イベント ---------- */
  const SPC = { kogemaru: 0xff7a2a, hoshisuzume: 0xffe27a, akaneten: 0xff5a2a, kagetsubame: 0x8aa0ff, sayanosuke: 0xfff0c0, kemuridama: 0xd8d8e0 };
  function events(v, me) {
    const out = [];
    for (const e of v.ev || []) {
      if (seenEv.has(e.id)) continue; seenEv.add(e.id); seenQ.push(e.id); if (seenQ.length > 600) seenEv.delete(seenQ.shift());
      out.push(e); fx(e, v, me);
    }
    return out;
  }
  function shake(a) { if (opts.shake) cam.shake = Math.max(cam.shake, a); }
  /** ヨシノシンの部下のビーム（一瞬の光の帯） */
  const beams = [];
  function beamFlash(e) {
    const len = DATA.JOBAN.wpn.beam.len, g = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, len), new THREE.MeshBasicMaterial({ color: 0xc8ff7a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.position.set(e.x + Math.sin(e.yaw) * len / 2, 0.95, e.z + Math.cos(e.yaw) * len / 2); g.rotation.y = e.yaw; scene.add(g); beams.push({ g, t: 0.28 });
  }
  /** 上空からのビーム（号令四連照射） */
  function skyBeam(e) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(DATA.UENO.moves.shosha.r, DATA.UENO.moves.shosha.r, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xc8a8ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    g.position.set(e.x, 7, e.z); scene.add(g); beams.push({ g, t: 0.35, max: 0.35 });
    burst('add', 18, { x: e.x, y: 0.3, z: e.z, spd: 4, up: 2, life: 0.4, s0: 0.5, s1: 0.05, c: 0xe0c8ff }); shake(0.08);
  }
  function stepBeams(dt) { for (const b of beams) { b.t -= dt; const mx = b.max || 0.28; b.g.material.opacity = Math.max(0, b.t / mx) * 0.85; if (b.max) { b.g.scale.x = b.g.scale.z = 0.5 + b.t / mx * 0.6; } else b.g.scale.x = b.g.scale.y = 0.6 + b.t * 3; if (b.t <= 0) { scene.remove(b.g); b.g.geometry.dispose(); } } for (let i = beams.length - 1; i >= 0; i--) if (beams[i].t <= 0) beams.splice(i, 1); }
  function fx(e, v, me) {
    const A = AUDIO.sfx;
    switch (e.type) {
      case 'dmg': {
        const c = e.kind === 'sp' ? 0xffe6a0 : e.crit ? 0xffff80 : 0xffa060;
        burst('add', e.crit ? 10 : 5, { x: e.x, y: e.y || 1, z: e.z, spd: 4, life: 0.3, s0: 0.3, s1: 0.02, c });
        if (e.kind !== 'sp' && e.kind !== 'dot') A(e.crit ? 'crit' : 'phit', e.x, e.z, 0.6); break;
      }
      case 'swing': {
        const fxn = e.fx, f = e.yaw, x = e.x + Math.sin(f) * 0.9, z = e.z + Math.cos(f) * 0.9;
        const ch = v.allies[e.src != null ? e.src : e.slot] ? v.allies[e.slot].ch : '';
        const col = ch === 'kogemaru' ? 0xff7a2a : ch === 'sayanosuke' ? 0xfff0c0 : ch === 'kagetsubame' ? 0x8aa0ff : ch === 'kemuridama' ? 0xe0e0e0 : 0xffffff;
        for (let i = 0; i < 7; i++) { const a = f + (i - 3) * 0.18; emit('add', { x: e.x + Math.sin(a) * 1.0, y: 0.6, z: e.z + Math.cos(a) * 1.0, vx: Math.sin(a) * 1.5, vz: Math.cos(a) * 1.5, life: 0.18, s0: 0.3, s1: 0.05, c: col }); }
        if (fxn === 'smoke') burst('norm', 12, { x, y: 0.5, z, spd: 2, vx: Math.sin(f) * 3, vz: Math.cos(f) * 3, life: 0.7, s0: 0.4, s1: 1.0, c: 0xe8e8ee, a: 0.6 });
        A(e.hit ? (fxn === 'heavy' ? 'heavy' : fxn === 'hit3' ? 'hit3' : fxn === 'slash' ? 'slash' : fxn === 'palm' ? 'palm' : fxn === 'smoke' ? 'smoke' : 'hit') : (fxn === 'smoke' ? 'smoke' : 'swing'), e.x, e.z);
        if (e.hit && fxn === 'heavy') { shake(0.25); burst('norm', 14, { x, y: 0.2, z, spd: 3, life: 0.6, s0: 0.5, s1: 1, c: 0xc8b8a0, a: 0.6 }); }
        break;
      }
      case 'sp': {
        const a = v.allies[e.slot]; A('spCut', a ? a.x : null, a ? a.z : null);
        if (listeners.notice) listeners.notice({ k: 'sp', slot: e.slot, nm: e.nm, me: e.slot === me });
        if (a) burst('add', 24, { x: a.x, y: 0.6, z: a.z, spd: 3, up: 1, life: 0.6, s0: 0.35, s1: 0.03, c: SPC[e.ch] || 0xfff0c0 });
        if (a && e.heavy) { A('bossDown', a.x, a.z, 0.6); for (let i = 0; i < 36; i++) { const g = i / 36 * Math.PI * 2; emit('add', { x: a.x + Math.cos(g) * 0.9, y: 0.1, z: a.z + Math.sin(g) * 0.9, vy: 2.2, life: 0.7, s0: 0.35, s1: 0.05, c: i % 2 ? 0xffd84a : 0x8a6aff }); } }
        break;
      }
      case 'sphit': {
        const f = e.yaw, c = SPC[e.ch] || 0xffffff; A('sp_' + e.ch, e.x, e.z);
        if (e.ch === 'hoshisuzume') { for (let d = 0; d < 15; d += 0.5) emit('add', { x: e.x + Math.sin(f) * d, y: 0.65, z: e.z + Math.cos(f) * d, life: 0.16, s0: 0.9, s1: 0.4, c: 0xfff3a8 }); }
        else if (e.ch === 'akaneten') { for (let i = 0; i < 26; i++) { const a = f + (Math.random() - 0.5) * 1.9, s = 9; emit('add', { x: e.x, y: 0.5, z: e.z, vx: Math.sin(a) * s, vz: Math.cos(a) * s, vy: 0.5, life: 0.7, s0: 0.6, s1: 0.2, c: Math.random() < 0.5 ? 0xff5a2a : 0xffb040 }); } }
        else if (e.ch === 'sayanosuke') { for (let d = 0; d < 6; d += 0.25) emit('add', { x: e.x + Math.sin(f) * d, y: 0.7, z: e.z + Math.cos(f) * d, life: 0.4, s0: 0.8, s1: 0.1, c: 0xfff6d8 }); shake(0.35); }
        else if (e.ch === 'kemuridama') { for (let i = 0; i < 30; i++) { const a = f + (Math.random() - 0.5) * 1.5, s = 4 + Math.random() * 4; emit('norm', { x: e.x, y: 0.6, z: e.z, vx: Math.sin(a) * s, vz: Math.cos(a) * s, life: 0.9, s0: 0.5, s1: 1.4, c: 0xe8e8ee, a: 0.55 }); } }
        else { const n = e.n, a = f + (n % 2 ? 0.5 : -0.5); for (let i = 0; i < 8; i++) { const b = a + (i - 4) * 0.12; emit('add', { x: e.x + Math.sin(b) * 1.4, y: 0.6 + (n % 3) * 0.2, z: e.z + Math.cos(b) * 1.4, vx: Math.sin(b) * 2, vz: Math.cos(b) * 2, life: 0.22, s0: 0.45, s1: 0.05, c }); } }
        break;
      }
      case 'spfx': {
        const S = { buff: [0xff5a4a, 'sp_taiko'], guardup: [0x9ad0ff, 'sp_burikidon'], heal: [0x8aff9a, 'sp_momiji'] }[e.k];
        A(S[1], e.x, e.z);
        if (e.k === 'heal') { for (const a of v.allies) if (a.st !== 'gone') for (let i = 0; i < 14; i++) emit('norm', { x: a.x + (Math.random() - 0.5) * 1.2, y: 0.05, z: a.z + (Math.random() - 0.5) * 1.2, vy: 1.5 + Math.random() * 2, vx: (Math.random() - 0.5), life: 1.2, s0: 0.25, s1: 0.18, c: Math.random() < 0.5 ? 0xff7a2a : 0xd8402a }); }
        else if (e.k === 'buff') { for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; emit('add', { x: e.x + Math.cos(a) * 1, y: 0.3, z: e.z + Math.sin(a) * 1, vx: Math.cos(a) * 8, vz: Math.sin(a) * 8, life: 0.6, s0: 0.4, s1: 0.1, c: 0xff5a4a }); } shake(0.15); }
        else burst('add', 30, { x: e.x, y: 0.7, z: e.z, spd: 2.5, life: 0.7, s0: 0.35, s1: 0.05, c: 0x9ad0ff });
        break;
      }
      case 'hurt': { A('hurt', e.x, e.z, e.slot === me ? 1 : 0.6); burst('add', 6, { x: e.x, y: 0.6, z: e.z, spd: 3, life: 0.25, s0: 0.25, s1: 0.03, c: e.g ? 0x9ad0ff : 0xff4040 }); if (e.slot === me) shake(0.12); break; }
      case 'block': A('block', e.x, e.z); burst('add', 8, { x: e.x, y: 0.7, z: e.z, spd: 2, life: 0.25, s0: 0.25, s1: 0.03, c: 0x9ad0ff }); break;
      case 'miss': break;
      case 'parry': A('parry', e.x, e.z); burst('add', 16, { x: e.x, y: 0.8, z: e.z, spd: 5, life: 0.3, s0: 0.3, s1: 0.03, c: 0xfff6c0 }); break;
      case 'heal': if (e.v > 0) { A('heal', e.x, e.z, 0.7); burst('add', 8, { x: e.x, y: 0.3, z: e.z, spd: 1, up: 1.5, life: 0.7, s0: 0.25, s1: 0.03, c: 0x8aff9a }); } break;
      case 'ring': A('ring', e.x, e.z); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; if (i % 2) emit('add', { x: e.x + Math.cos(a) * e.r, y: 0.1, z: e.z + Math.sin(a) * e.r, vy: 1.2, life: 0.8, s0: 0.3, s1: 0.05, c: 0x7dff9a }); } break;
      case 'leaf': { const a = v.allies[e.from], b = v.allies[e.to]; if (a && b) for (let i = 0; i < 10; i++) { const k = i / 10; emit('norm', { x: a.x + (b.x - a.x) * k, y: 0.8 + Math.sin(k * Math.PI), z: a.z + (b.z - a.z) * k, vy: -0.5, life: 0.5 + k * 0.4, s0: 0.22, s1: 0.18, c: 0xff7a2a }); } break; }
      case 'protect': A('protect', e.x, e.z); for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; emit('add', { x: e.x + Math.cos(a) * e.r, y: 0.2, z: e.z + Math.sin(a) * e.r, vy: 2, life: 0.5, s0: 0.3, s1: 0.05, c: 0x9ad0ff }); } break;
      case 'taunt': A('taunt', e.x, e.z); burst('add', 10, { x: e.x, y: 1.2, z: e.z, spd: 2, life: 0.4, s0: 0.3, s1: 0.05, c: 0xffa040 }); break;
      case 'boom': A('boom', e.x, e.z); burst('add', 30, { x: e.x, y: 0.4, z: e.z, spd: 6, up: 2, life: 0.5, s0: 0.7, s1: 0.1, c: e.k === 'mine' ? 0xffa030 : 0xff6a2a }); burst('norm', 14, { x: e.x, y: 0.4, z: e.z, spd: 2, up: 1, life: 1.0, s0: 0.8, s1: 1.6, c: 0x6a6070, a: 0.5 }); shake(0.2); break;
      case 'para': A('para', e.x, e.z); burst('add', 14, { x: e.x, y: 1.5, z: e.z, spd: 3, life: 0.4, s0: 0.25, s1: 0.03, c: 0xfff060 }); break;
      case 'mark': A('mark', e.x, e.z); break;
      case 'defdown': burst('add', 10, { x: e.x, y: 2, z: e.z, spd: 2, life: 0.6, s0: 0.3, s1: 0.05, c: 0x9a9aff }); break;
      case 'down': A('down', e.x, e.z); break;
      case 'revive': A('revive', e.x, e.z); burst('add', 20, { x: e.x, y: 0.2, z: e.z, spd: 1.5, up: 2.5, life: 0.8, s0: 0.3, s1: 0.03, c: 0xfff6a0 }); break;
      case 'ascend': A('ascend'); break;
      case 'item': case 'pick': A(e.type, e.x, e.z); break;
      case 'candy': A('food', e.x, e.z); burst('add', 14, { x: e.x, y: 0.5, z: e.z, spd: 1.8, up: 2, life: 0.7, s0: 0.22, s1: 0.03, c: 0xff8ac4 }); break;
      case 'eatCandy': A('heal', e.x, e.z); burst('add', 22, { x: e.x, y: 0.4, z: e.z, spd: 2.2, up: 2.5, life: 0.8, s0: 0.25, s1: 0.03, c: 0xff9ad0 }); break;
      case 'lantern': A('lantern', e.x, e.z); burst('add', 20, { x: e.x, y: 1.6, z: e.z, spd: 2, up: 1, life: 0.6, s0: 0.3, s1: 0.03, c: 0xffd070 }); break;
      case 'allLit': A('allLit'); break;
      case 'lanternFail': A('lanternFail'); break;
      case 'bossdown': A('bossDown'); break;
      case 'phit': burst('add', 5, { x: e.x, y: 0.6, z: e.z, spd: 2.5, life: 0.2, s0: 0.25, s1: 0.03, c: 0xfff0c0 }); break;
      case 'mobdie': A('mobDie', e.x, e.z); burst('norm', 14, { x: e.x, y: 0.5, z: e.z, spd: 2, up: 1, life: 0.7, s0: 0.3, s1: 0.2, c: 0xf6efe0, grav: 4, a: 0.9 }); break;
      case 'spawnMob': A('spawnMob', e.x, e.z); break;
      case 'sfx': A(e.s, e.x, e.z); break;
      case 'bossmove': {
        A('warn');
        const B = v.boss; const bx = B ? B.x : 0, bz = B ? B.z : 0;
        ({ fubuki: () => A('roar', bx, bz, 0.5), shime: () => 0, otoshi: () => A('launch', bx, bz), kousen: () => A('beamCharge', bx, bz), harite: () => 0, junkou: () => A('flyUp', bx, bz), zouen: () => A('summon', bx, bz) }[e.mv] || (() => 0))();
        if (e.mv === 'otoshi' && B) for (let i = 0; i < 8; i++) emit('add', { x: bx + (Math.random() - 0.5), y: 2.8, z: bz + (Math.random() - 0.5), vy: 10 + Math.random() * 4, vx: (Math.random() - 0.5) * 2, life: 0.8, s0: 0.6, s1: 0.4, c: 0xffb060 });
        if (listeners.notice) listeners.notice({ k: 'boss', mv: e.mv });
        break;
      }
      case 'bossfire': {
        const B = v.boss; if (!B) break;
        ({ fubuki: () => A('fubuki', B.x, B.z), shime: () => A('shime', B.x, B.z), otoshi: () => A('fall', B.x, B.z), kousen: () => A('beam', B.x, B.z), harite: () => { A('slap', B.x, B.z); shake(0.3); }, zouen: () => 0 }[e.mv] || (() => 0))();
        break;
      }
      case 'hzfire': {
        if (e.fx === 'otoshi' || e.fx === 'bomb') { A('boom', e.x, e.z, 0.7); burst('add', 18, { x: e.x, y: 0.3, z: e.z, spd: 5, up: 1.5, life: 0.4, s0: 0.6, s1: 0.1, c: 0xff8a3a }); burst('norm', 6, { x: e.x, y: 0.3, z: e.z, spd: 1.5, life: 0.8, s0: 0.7, s1: 1.4, c: 0x5a5060, a: 0.5 }); shake(0.08); }
        if (e.fx === 'land') { A('land', e.x, e.z); for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; emit('norm', { x: e.x + Math.cos(a) * 1.5, y: 0.2, z: e.z + Math.sin(a) * 1.5, vx: Math.cos(a) * 7, vz: Math.sin(a) * 7, life: 0.8, s0: 0.6, s1: 1.4, c: 0xc8b8a0, a: 0.6 }); } shake(0.4); }
        if (e.fx === 'ybeam') { A('shot_focus', e.x, e.z, 0.8); beamFlash(e); }
        if (e.fx === 'ubeam') { A('beam', e.x, e.z, 0.6); skyBeam(e); }
        if (e.fx === 'stamp') { A('land', e.x, e.z); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; emit('norm', { x: e.x + Math.cos(a) * 1.2, y: 0.2, z: e.z + Math.sin(a) * 1.2, vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, life: 0.6, s0: 0.6, s1: 1.3, c: 0xe9d6a8, a: 0.6 }); } shake(0.45); }
        if (e.fx === 'shosho') { A('slap', e.x, e.z); burst('add', 16, { x: e.x + Math.sin(e.yaw) * 2, y: 0.4, z: e.z + Math.cos(e.yaw) * 2, spd: 4, life: 0.3, s0: 0.5, s1: 0.05, c: 0xd8c8ff }); shake(0.25); }
        if (e.fx === 'throw') { A('stomp', e.x, e.z, 0.5); burst('norm', 8, { x: e.x, y: 0.2, z: e.z, spd: 2.5, life: 0.5, s0: 0.4, s1: 0.8, c: 0xc8b8d8, a: 0.6 }); }
        if (e.fx === 'ysword') { A('slash', e.x, e.z, 0.7); for (let i = 0; i < 6; i++) { const a = e.yaw + (i - 2.5) * 0.22; emit('add', { x: e.x + Math.sin(a) * 1.3, y: 0.7, z: e.z + Math.cos(a) * 1.3, vx: Math.sin(a) * 2, vz: Math.cos(a) * 2, life: 0.2, s0: 0.3, s1: 0.02, c: 0xe4ecff }); } }
        if (e.fx === 'yfist') { A('hit', e.x, e.z, 0.7); burst('norm', 6, { x: e.x + Math.sin(e.yaw) * 1.1, y: 0.6, z: e.z + Math.cos(e.yaw) * 1.1, spd: 2, life: 0.35, s0: 0.3, s1: 0.6, c: 0xd8d0f0, a: 0.6 }); }
        if (e.fx === 'harite') { for (let d = 0.2; d < DATA.BMOVES.harite.len; d += 0.35) for (const s of [-1, 0, 1]) emit('norm', { x: e.x + Math.sin(e.yaw) * d + Math.cos(e.yaw) * s * 0.9, y: 0.25, z: e.z + Math.cos(e.yaw) * d - Math.sin(e.yaw) * s * 0.9, vx: Math.sin(e.yaw) * 3, vz: Math.cos(e.yaw) * 3, vy: 1.2, life: 0.55, s0: 0.5, s1: 1.2, c: 0xc8b8a0, a: 0.65 }); burst('add', 14, { x: e.x + Math.sin(e.yaw) * 1.2, y: 0.4, z: e.z + Math.cos(e.yaw) * 1.2, spd: 4, life: 0.3, s0: 0.5, s1: 0.05, c: 0xfff0c0 }); }
        break;
      }
      case 'cross': A('flyPass', v.boss ? v.boss.x : null, v.boss ? v.boss.z : null); break;
      case 'yAtk': A(e.w === 'beam' ? 'charge' : 'swing', e.x, e.z, 0.5); break;
      case 'bblock': if (Math.random() < 0.5) burst('add', 6, { x: e.x, y: 1.8, z: e.z, spd: 3, life: 0.25, s0: 0.3, s1: 0.03, c: 0x9ad0ff }); A('block', e.x, e.z, 0.4); break;
      case 'bhit': A('crit', e.x, e.z); burst('add', 24, { x: e.x, y: 1.8, z: e.z, spd: 5, life: 0.4, s0: 0.4, s1: 0.05, c: e.n >= 2 ? 0xffffff : 0xff6a4a }); shake(0.2); break;
      case 'barrier': A(e.on ? 'protect' : e.broken ? 'crit' : 'ui', v.boss ? v.boss.x : null, v.boss ? v.boss.z : null); if (e.broken && v.boss) burst('add', 40, { x: v.boss.x, y: 1.8, z: v.boss.z, spd: 6, life: 0.6, s0: 0.5, s1: 0.05, c: 0x9ad0ff }); break;
      case 'warpIn': burst('add', 26, { x: e.x, y: 1.5, z: e.z, spd: 3, life: 0.5, s0: 0.45, s1: 0.05, c: 0xb89aff }); A('whoosh', e.x, e.z); break;
      case 'orb': A('ready', e.x, e.z, 0.6); break;
      case 'orbGet': A('pick', e.x, e.z); burst('add', 20, { x: e.x, y: 0.6, z: e.z, spd: 2.5, up: 1.5, life: 0.6, s0: 0.3, s1: 0.04, c: 0xffd84a }); if (listeners.notice) listeners.notice({ k: 'orb', slot: e.slot }); break;
      case 'gun': A('shot_focus', e.x, e.z); burst('add', 10, { x: e.x + Math.sin(e.yaw) * 0.6, y: 0.8, z: e.z + Math.cos(e.yaw) * 0.6, spd: 3, life: 0.2, s0: 0.3, s1: 0.03, c: 0xfff6a0 }); break;
      case 'yLand': burst('norm', 6, { x: e.x, y: 0.2, z: e.z, spd: 1.5, life: 0.4, s0: 0.3, s1: 0.6, c: 0xd8d0e8, a: 0.6 }); break;
      case 'waveWarn': A('summon'); break;
      case 'sleep': A('bossDown'); break;
      case 'sleepEnd': A(e.ok ? 'allLit' : 'lanternFail'); if (!e.ok && v.boss) burst('add', 40, { x: v.boss.x, y: 1.5, z: v.boss.z, spd: 3, up: 2, life: 1.0, s0: 0.4, s1: 0.05, c: 0x8aff9a }); break;
      case 'ySpawn': burst('norm', 8, { x: e.x, y: 0.6, z: e.z, spd: 1.2, life: 0.5, s0: 0.35, s1: 0.7, c: 0xb8a8ff, a: 0.55 }); break;
      case 'doors': A(e.open ? 'doorOpen' : 'doorClose'); break;
      case 'depart': A('trainChime'); break;
      case 'arriveSt': A('trainChime'); break;
      case 'land': A('stomp'); break;
      case 'phase2': if (listeners.notice) listeners.notice({ k: 'phase2' }); A('roar'); break;
      case 'unlock': if (listeners.notice) listeners.notice({ k: 'unlock' }); break;
      case 'bossdie': A('bossDie', e.x, e.z); for (let i = 0; i < 60; i++) emit('add', { x: e.x + (Math.random() - 0.5) * 3, y: Math.random() * 5, z: e.z + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, life: 1.6, s0: 0.5, s1: 0.05, c: Math.random() < 0.5 ? 0xffd070 : 0xfff6e0 }); shake(0.5); break;
      case 'stage': if (e.k === 'intro') { A('gate'); cam.introDone = false; } if (listeners.notice) listeners.notice({ k: 'stage', s: e.k }); break;
      case 'sig': if (listeners.notice) listeners.notice({ k: 'sig', slot: e.slot, code: e.code }); break;
      case 'bossup': break;
    }
    if (listeners.event) listeners.event(e, v);
  }

  /* ---------- カメラ ---------- */
  /** 常磐線のカメラ：演出の流れ／車内では低めの三人称（天井の下・車内からはみ出さない） */
  function trainCamera(v, me, dt, input, area) {
    const a = v.allies[me], portrait = cam.portrait, it = v.introWait ? 0 : v.stageT, T = performance.now() / 1000;
    const wantFov = portrait ? 72 : 62; if (Math.abs(camera.fov - wantFov) > 0.1) { camera.fov = wantFov; camera.updateProjectionMatrix(); }
    camera.clearViewOffset();
    if (v.stage === 'intro') {
      const shots = it < 3.5 ? [{ t: 0, c: [4.6, 1.6, 4.0], l: [0, 2.8, 13.3] }, { t: 3.5, c: [3.0, 2.3, 6.2], l: [0, 1.4, 13.3] }]
        : [{ t: 3.5, c: [-5.0, 1.9, -12.5], l: [-1.8, 1.0, -3.5] }, { t: 9.0, c: [-5.2, 1.9, -7.5], l: [-1.2, 1.1, -3.5] }, { t: 10.4, c: [-4.6, 1.9, -6.0], l: [-1.0, 1.1, -3.6] }, { t: 12, c: [0, 1.95, -11], l: [0, 1.0, -3] }];
      let i = 0; while (i < shots.length - 2 && it >= shots[i + 1].t) i++;
      const s0 = shots[i], s1 = shots[i + 1], kk = Math.max(0, Math.min(1, (it - s0.t) / (s1.t - s0.t))), e = kk * kk * (3 - 2 * kk);
      const bl = (p, q) => p + (q - p) * e;
      camera.position.set(bl(s0.c[0], s1.c[0]), bl(s0.c[1], s1.c[1]), bl(s0.c[2], s1.c[2])); camera.lookAt(bl(s0.l[0], s1.l[0]), bl(s0.l[1], s1.l[1]), bl(s0.l[2], s1.l[2]));
      cam.ring.visible = cam.arrow.visible = false; cam.fx = a.x; cam.fz = a.z; cam.yaw = 0; return;
    }
    const ot = outroT(v);
    if (ot > 1.2) { // 上野：ホームから電車を見る
      const k = Math.min(1, (ot - 1.2) / 6), e = k * k * (3 - 2 * k);
      camera.position.set(-4.6 + e * 0.3, 1.7 + e * 0.2, 3.0 - e * 1.0); camera.lookAt(-2.3, 1.0, -4.0 - e * 0.4);
      cam.ring.visible = cam.arrow.visible = false; return;
    }
    let fx = a.x, fz = a.z;
    const ml = Math.hypot(input.mx, input.mz); if (ml > 0.1 && a.st === 'ok') { fx += input.mx / ml * 1.2; fz += input.mz / ml * 1.2; }
    if (cam.lock && cam.lock !== 'boss') { const m = v.mobs.find(e => e.id === cam.lock); if (m) { fx += (m.x - a.x) * 0.25; fz += (m.z - a.z) * 0.25; } }
    const k = 1 - Math.exp(-dt / DATA.CAM.follow_delay_sec); cam.fx += (fx - cam.fx) * k; cam.fz += (fz - cam.fz) * k;
    cam.dragT = Math.max(0, cam.dragT - dt);
    if (cam.reset) { cam.reset = false; cam.yaw = a.yaw; }
    if (cam.lock && !cam.dragT) { const t = v.mobs.find(e => e.id === cam.lock); if (t && Math.hypot(t.x - a.x, t.z - a.z) > 2) { const want = Math.atan2(t.x - a.x, t.z - a.z); cam.yaw += Math.max(-1.2 * dt, Math.min(1.2 * dt, SIMLIB.angDiff(cam.yaw, want))); } }
    const p = 17 * Math.PI / 180, dist = portrait ? 6.4 : 5.6;
    let cx = cam.fx - Math.sin(cam.yaw) * Math.cos(p) * dist, cz = cam.fz - Math.cos(cam.yaw) * Math.cos(p) * dist, cy = 1.0 + Math.sin(p) * dist;
    const J = DATA.JOBAN; cx = Math.max(-1.75, Math.min(1.75, cx)); cz = Math.max(J.zMin - 0.2, Math.min(J.zMax + 0.2, cz)); cy = Math.min(cy, 2.12);
    if (Math.abs(cz) < 1.1) cx = Math.max(-0.65, Math.min(0.65, cx));
    const sp = v.tr ? Math.min(1, v.tr.v / J.vmax) : 0; // 走っているときの揺れ
    cy += Math.sin(T * 9.5) * 0.008 * sp;
    if (cam.shake > 0.001) { cx += (Math.random() - 0.5) * cam.shake * 0.5; cy += (Math.random() - 0.5) * cam.shake * 0.5; cam.shake *= Math.pow(0.02, dt); }
    camera.position.set(cx, cy, cz); camera.lookAt(cam.fx, 0.85, cam.fz); camera.rotateZ(Math.sin(T * 1.25) * 0.006 * sp);
    cam.ring.position.set(a.x, 0.05, a.z); cam.ring.visible = a.st === 'ok';
    cam.arrow.position.set(a.x + Math.sin(a.yaw) * 0.75, 0.06, a.z + Math.cos(a.yaw) * 0.75); cam.arrow.rotation.set(Math.PI / 2, 0, -a.yaw + Math.PI); cam.arrow.visible = a.st === 'ok';
    AUDIO.st.listener = { x: a.x, z: a.z, yaw: cam.yaw };
  }
  function updateCamera(v, me, dt, input, area) {
    const C = DATA.CAM, a = v && v.allies[me]; if (!a) return;
    if (v.stageId === 'joban') return trainCamera(v, me, dt, input, area);
    { const wf = cam.portrait ? C.portrait_framing.fov : C.vertical_fov_deg; if (Math.abs(camera.fov - wf) > 0.1) { camera.fov = wf; camera.updateProjectionMatrix(); } }
    const portrait = cam.portrait, fr = portrait ? C.portrait_framing : C.landscape_framing;
    // ボスが遠いときは少し俯角を浅くして全身を入れる（35〜55度の範囲・新作の構図補助）
    const Bd = v.boss && v.stage === 'boss' && v.boss.st !== 'fly' ? Math.hypot(v.boss.x - a.x, v.boss.z - a.z) : 0;
    const far = Math.max(0, Math.min(1, (Bd - 6) / 12));
    const pitchT = Math.max(C.pitchMin, (portrait ? fr.pitch : C.camera_pitch_deg) - far * 8 + (cam.userPitch || 0));
    cam.pitch += (pitchT - cam.pitch) * Math.min(1, dt * 2.5);
    // 注視点：足元＋進行方向の先読み
    let fx = a.x, fz = a.z;
    const ml = Math.hypot(input.mx, input.mz); if (ml > 0.1 && a.st === 'ok') { fx += input.mx / ml * C.lookahead_units; fz += input.mz / ml * C.lookahead_units; }
    const B = v.boss, flying = B && B.st === 'fly';
    if (cam.lock && B && cam.lock === 'boss' && !flying && B.st !== 'dead') { const w = C.boss_frame_weight; let dx = (B.x - a.x) * w, dz = (B.z - a.z) * w; const l = Math.hypot(dx, dz); if (l > 3.5) { dx *= 3.5 / l; dz *= 3.5 / l; } fx += dx; fz += dz; }
    else if (cam.lock && cam.lock !== 'boss') { const m = v.mobs.find(e => e.id === cam.lock); if (m) { fx += (m.x - a.x) * 0.25; fz += (m.z - a.z) * 0.25; } }
    const k = 1 - Math.exp(-dt / C.follow_delay_sec);
    cam.fx += (fx - cam.fx) * k; cam.fz += (fz - cam.fz) * k;
    if (Math.hypot(fx - cam.fx, fz - cam.fz) > 15) { cam.fx = fx; cam.fz = fz; }
    // 向き：手動ドラッグを優先。注目中は入力していない時だけゆっくり向ける
    cam.dragT = Math.max(0, cam.dragT - dt);
    if (cam.reset) { cam.reset = false; cam.yaw = a.yaw; }
    if (cam.lock && !cam.dragT && !flying) { const t = cam.lock === 'boss' && B ? B : v.mobs.find(e => e.id === cam.lock); if (t) { const want = Math.atan2(t.x - a.x, t.z - a.z); const d = SIMLIB.angDiff(cam.yaw, want); if (Math.hypot(t.x - a.x, t.z - a.z) > 2.5) cam.yaw += Math.max(-1.0 * dt, Math.min(1.0 * dt, d)); } }
    cam.flyPull += ((flying ? 2.5 : 0) - cam.flyPull) * Math.min(1, dt * 2);
    const dist = fr.dist + cam.flyPull + (v.stageId === 'ueno' ? 2.2 : 0), p = cam.pitch * Math.PI / 180; // 上野は広いので少し引く（9〜13m）
    let cx = cam.fx - Math.sin(cam.yaw) * Math.cos(p) * dist, cz = cam.fz - Math.cos(cam.yaw) * Math.cos(p) * dist, cy = 0.5 + Math.sin(p) * dist;
    let lx = cam.fx, ly = 0.5, lz = cam.fz;
    if (v.stageId === 'ueno_street' && v.stage === 'intro') { // 改札の先から、歩いてくる4体を見る
      const t = v.introWait ? 0 : v.stageT, k = Math.min(1, t / DATA.STREET.introT), e = k * k * (3 - 2 * k);
      cx = 2.8 - e * 2.8; cy = 2.2 + e * (cy - 2.2); cz = 7 + e * (cz - 7); lx = 0; ly = 1.0; lz = -4 + e * 6; cam.yaw = 0; cam.fx = a.x; cam.fz = a.z;
    }
    // 登場演出（4.5秒・入力無効の間だけ低い視点）
    if (v.stage === 'intro' && B) {
      const t = v.introWait ? 0 : v.stageT, bx = B.x, bz = B.z;
      const shots = v.stageId === 'ueno' ? [ // 上野：部下の列の奥で指を鳴らす→通常のカメラへ
        { t: 0, c: [0, 4.2, 6], l: [0, 1.6, 17] },
        { t: 0.9, c: [4.5, 3.6, bz - 12.5], l: [bx, 4.2, bz] },
        { t: 2.0, c: [2.5, 3.4, bz - 11.5], l: [bx, 4.6, bz] },
        { t: DATA.UENO.introT, c: [cx, cy, cz], l: [lx, ly, lz] },
        { t: DATA.UENO.introT + 1, c: [cx, cy, cz], l: [lx, ly, lz] },
      ] : [
        { t: 0, c: [0, 2.2, 1.5], l: [0, 0.3, bz - 2] },
        { t: 1.0, c: [3.5, 1.0, bz - 6.5], l: [bx, 0.6, bz] },
        { t: 2.0, c: [2.5, 0.8, bz - 6], l: [bx, 2.6, bz] },
        { t: 3.5, c: [0, 2.4, bz - 11], l: [bx, 3.2, bz] },
        { t: 4.5, c: [cx, cy, cz], l: [lx, ly, lz] },
      ];
      let i = 0; while (i < shots.length - 2 && t >= shots[i + 1].t) i++;
      const s0 = shots[i], s1 = shots[i + 1], kk = Math.min(1, (t - s0.t) / (s1.t - s0.t)), e = kk * kk * (3 - 2 * kk);
      const blend = (u, w) => u + (w - u) * e;
      cx = blend(s0.c[0], s1.c[0]); cy = blend(s0.c[1], s1.c[1]); cz = blend(s0.c[2], s1.c[2]); lx = blend(s0.l[0], s1.l[0]); ly = blend(s0.l[1], s1.l[1]); lz = blend(s0.l[2], s1.l[2]);
      cam.yaw = 0;
    }
    if (cam.shake > 0.001) { cx += (Math.random() - 0.5) * cam.shake; cy += (Math.random() - 0.5) * cam.shake; cam.shake *= Math.pow(0.02, dt); }
    camera.position.set(cx, cy, cz); camera.lookAt(lx, ly, lz);
    // 足元をゲーム表示領域の決めた高さに置く
    const h = VIEW.h, w = VIEW.w;
    if (v.stage !== 'intro' && area) { const want = area.top + fr.feetY * (area.bottom - area.top); camera.setViewOffset(w, h, 0, -(want - h / 2), w, h); }
    else camera.clearViewOffset();
    // 光源
    W.fill.position.set(cx, cy + 4, cz); W.fill.target.position.set(lx, 0, lz);
    // 自分の印
    cam.ring.position.set(a.x, 0.05, a.z); cam.ring.visible = a.st === 'ok';
    cam.arrow.position.set(a.x + Math.sin(a.yaw) * 0.75, 0.06, a.z + Math.cos(a.yaw) * 0.75); cam.arrow.rotation.set(Math.PI / 2, 0, -a.yaw + Math.PI); cam.arrow.visible = a.st === 'ok';
    AUDIO.st.listener = { x: a.x, z: a.z, yaw: cam.yaw };
  }
  function render(dt) {
    stepPoints(PA, dt); stepPoints(PN, dt); stepBeams(dt);
    const projScale = VIEW.h * pr / (2 * Math.tan(camera.fov * Math.PI / 360));
    PA.mat.uniforms.uScale.value = PN.mat.uniforms.uScale.value = projScale;
    renderer.render(scene, camera);
    // 端末が重いときは解像度を下げる
    frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
    const T = performance.now();
    if (T - lastFrame > 3000) { lastFrame = T; if (frameAvg > 24 && pr > 1) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); resize(); } else if (frameAvg < 15 && pr < Math.min(window.devicePixelRatio || 1, 1.75)) { pr = Math.min(pr + 0.25, 1.75); renderer.setPixelRatio(pr); resize(); } }
  }
  function project(x, y, z) { V.set(x, y, z).project(camera); return { x: (V.x + 1) / 2 * VIEW.w, y: (1 - V.y) / 2 * VIEW.h, front: V.z < 1 && V.z > -1, ndc: { x: V.x, y: V.y, z: V.z } }; }
  function clearEntities() {
    for (const m of allies) if (m) { scene.remove(m.root); scene.remove(m.shadow); } allies.length = 0;
    if (boss) { scene.remove(boss.root); scene.remove(boss.shadow); boss = null; }
    for (const [, m] of mobs) { scene.remove(m.root); scene.remove(m.shadow); } mobs.clear();
    for (const [, m] of projs) scene.remove(m); projs.clear(); for (const [, o] of hzs) dropHz(o); hzs.clear();
    for (const [, m] of traps) scene.remove(m); traps.clear(); for (const [, m] of picks) scene.remove(m); picks.clear(); for (const [, m] of orbs) scene.remove(m); orbs.clear();
    cam.lanT = 0; if (W) for (const L of W.lanternsStreet) if (L.lit) W.setStreetLantern(L, false);
    for (const p of [PA, PN]) if (p) for (const q of p.P) q.life = 0;
    if (W && W.root) W.root.visible = true; if (TW) TW.root.visible = false; if (UW) UW.root.visible = false; if (SW) SW.root.visible = false; if (GFX.hideAkibaWorld) GFX.hideAkibaWorld(); if (JT.cutBoss) { W.root.remove(JT.cutBoss.root); W.root.remove(JT.cutBoss.shadow); JT.cutBoss = null; } JT.dist = 0; JT.rail = 0; JT.lcd = '';
    for (const b of beams) scene.remove(b.g); beams.length = 0; resize();
  }
  function snapCam(v, me) { const a = v && v.allies[me]; if (!a) return; cam.fx = a.x; cam.fz = a.z; cam.yaw = 0; }
  return { outroT, init, sync, events, updateCamera, render, project, on, cam, setOpts, clearEntities, snapCam, resize, get camera() { return camera; }, get scene() { return scene; }, get renderer() { return renderer; }, get pr() { return pr; } };
})();
