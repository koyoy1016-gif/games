/* =====================================================================
   render_lobby.js — メニュー画面の3D（ホームの4体・キャラ詳細の1体・ほかの画面の背景）。背景はいつも動く夜祭り（v7 P4-3/P5）
   ・戦闘と同じレンダラー（#gl）とシーンを使う（キャラ数ぶんのWebGLを作らない）
   ・表示中は戦闘用の世界を隠し、閉じたら元に戻す。非表示のときは何も動かさない
   ===================================================================== */
const LOBBY3D = (() => {
  let W = null;
  const X4 = [-2.55, -0.85, 0.85, 2.55];
  const PCOLS = [0xe4572e, 0x3c8cff, 0x2fa36b, 0xf2c94c];
  function build(scene) {
    const root = new THREE.Group(); root.visible = false; scene.add(root);
    root.add(new THREE.HemisphereLight(0xdfeaff, 0x24306a, 1.25));
    const d = new THREE.DirectionalLight(0xffffff, 1.1); d.position.set(-3, 6, 6); root.add(d);
    const rim = new THREE.DirectionalLight(0x9ad8ff, 0.6); rim.position.set(4, 3, -5); root.add(rim);
    // 背景（v7 P4-3/P5）：夜祭り。夕焼けの残る夜空・提灯の列・屋台・鳥居・花火、奥にトバトーバとヨシノシン。いつも少しずつ動く
    const fest = buildFestival(root);
    // 台座（4つ）と、詳細用の大きな台座
    const peds = X4.map((x, i) => makePed(root, x, 0, 0.55, PCOLS[i]));
    const big = makePed(root, 0, 0, 0.95, 0xf2c94c); big.g.visible = false;
    return { root, peds, big, fest, models: [null, null, null, null], ids: [], det: null, detId: null, yaw: 0, mode: null, hidden: [] };
  }

  /* ---------- 夜祭りの背景 ---------- */
  function buildFestival(root) {
    const L = (c, o) => GFX.lam(c, o), BAS = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, fog: false }, o || {}));
    const F = { lan: [], fw: [], fwT: 0.5, bosses: [], flies: null };
    const skyT = GFX.tex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a0620'); gr.addColorStop(0.38, '#26124a'); gr.addColorStop(0.52, '#7a2c5a'); gr.addColorStop(0.6, '#e0703a'); gr.addColorStop(0.66, '#3a1a2a'); gr.addColorStop(1, '#140a14'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), BAS(0xffffff, { map: skyT, side: THREE.BackSide, depthWrite: false })); sky.renderOrder = -5; root.add(sky);
    { const n = 120, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI - Math.PI, e = 0.35 + Math.random() * 0.9; pos[i * 3] = Math.cos(a) * 36 * Math.cos(e); pos[i * 3 + 1] = Math.sin(e) * 36; pos[i * 3 + 2] = Math.sin(a) * 36 * Math.cos(e); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff4d8, size: 0.12, fog: false }))); }
    // 地面：踏み固めた土と石畳の参道
    const gT = GFX.tex(512, 512, (g, w, h) => { g.fillStyle = '#4a3428'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 30},40,0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } g.fillStyle = '#6a5a50'; g.fillRect(w * 0.38, 0, w * 0.24, h); g.strokeStyle = 'rgba(30,20,20,.55)'; g.lineWidth = 3; for (let y = 0; y < h; y += 28) { g.beginPath(); g.moveTo(w * 0.38, y); g.lineTo(w * 0.62, y); g.stroke(); for (let x = w * 0.38 + ((y / 28) % 2) * 30; x < w * 0.62; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 28); g.stroke(); } } });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), L(0xffffff, { map: gT })); floor.rotation.x = -Math.PI / 2; floor.rotation.z = Math.PI / 2; floor.position.y = -0.01; root.add(floor);
    const glow = (r, col, a) => { const t = GFX.tex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); sp.scale.set(r, r, 1); return sp; };
    // 鳥居（奥の中央）
    { const tg = new THREE.Group(); tg.position.set(0, 0, -15); root.add(tg); const red = L(0xc8302a, { emissive: 0x401008, emissiveIntensity: 0.5 }), bk = L(0x1a1414);
      for (const x of [-2.6, 2.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.6, 12), red); p.position.set(x, 2.8, 0); tg.add(p); }
      const k = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.4, 0.5), bk); k.position.y = 5.75; tg.add(k); const k2 = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 0.4), red); k2.position.y = 5.3; tg.add(k2); const n = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.24, 0.35), red); n.position.y = 4.5; tg.add(n); }
    // 屋台：左右に並ぶ。紅白の日よけ・のれん・光る看板
    const awT = GFX.tex(64, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4efe6' : '#d8302a'; g.fillRect(i * 8, 0, 8, h); } });
    const signs = ['たこ焼', 'わたあめ', '金魚', 'やきそば', 'かき氷', 'お面'];
    const sgT = t => GFX.tex(128, 48, (g, w, h) => { g.fillStyle = '#fff4d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#b82a20'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + 2); });
    [[-9, -6.5, 0.6], [-12, -3, 0.95], [-3.6, -11, 0.15], [9, -6.5, -0.6], [12, -3, -0.95], [3.6, -11, -0.15]].forEach(([x, z, ry], i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.2), L(0x7a4a2a)); body.position.y = 0.5; g.add(body);
      for (const sx of [-1.2, 1.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), L(0x5a3a22)); p.position.set(sx, 1.15, 0.5); g.add(p); }
      const aw = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.6), L(0xffffff, { map: awT })); aw.position.set(0, 2.35, 0.35); aw.rotation.x = 0.18; g.add(aw);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), BAS(0xffffff, { map: sgT(signs[i]) })); sg.position.set(0, 1.85, 0.62); g.add(sg);
      const lit = glow(3.2, '255,170,80', 0.55); lit.position.set(0, 1.4, 0.9); g.add(lit); F.lan.push({ sp: lit, k: i * 1.3, base: 3.2 });
    });
    // 提灯の列：手前から奥へ3本の綱にゆれる提灯
    const lanM = [0xe8402a, 0xf4c040, 0xf4f0e0].map(c => L(c, { emissive: c, emissiveIntensity: 0.85 }));
    [[-3.6, 4.0, 13], [-7, 4.4, 15], [-10.5, 4.8, 17]].forEach(([z, y, w], row) => {
      const n = 11; for (let i = 0; i < n; i++) {
        const k = i / (n - 1), x = (k - 0.5) * w, yy = y - Math.sin(k * Math.PI) * 0.6, piv = new THREE.Group(); piv.position.set(x, yy, z); root.add(piv);
        const lm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lanM[(i + row) % 3]); lm.scale.set(1, 1.3, 1); lm.position.y = -0.3; piv.add(lm);
        for (const dy of [-0.05, -0.55]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10), L(0x1a1414)); cap.position.y = dy; piv.add(cap); }
        const gl = glow(1.1, '255,150,90', 0.5); gl.position.y = -0.3; piv.add(gl);
        F.lan.push({ piv, k: i * 0.7 + row * 2 });
      }
      const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20; pts.push(new THREE.Vector3((k - 0.5) * w, y - Math.sin(k * Math.PI) * 0.6, z)); }
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a1a14 })));
    });
    // 奥のトバトーバ（左）とヨシノシン（右）。祭りを見物している
    try { const b = GFX.makeBoss(); b.root.scale.multiplyScalar(0.55); root.add(b.root); if (b.shadow) root.add(b.shadow); F.bosses.push({ m: b, kind: 'boss', x: -7.2, z: -12.5, yaw: 0.45 }); } catch (e) { console.warn('fest boss', e); }
    try { const y = GFX.makeYoshinoshin(); y.root.scale.multiplyScalar(0.62); root.add(y.root); if (y.shadow) root.add(y.shadow); F.bosses.push({ m: y, kind: 'yoshi', x: 6.4, z: -12.5, yaw: -0.45 }); } catch (e) { console.warn('fest yoshi', e); }
    // 花火：数秒ごとに夜空で開く
    for (let i = 0; i < 3; i++) {
      const n = 60, pos = new Float32Array(n * 3), dir = []; for (let j = 0; j < n; j++) { const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 2 - 1); dir.push([Math.sin(e) * Math.cos(a), Math.cos(e), Math.sin(e) * Math.sin(a)]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }); const pt = new THREE.Points(g, pm); pt.frustumCulled = false; root.add(pt);
      F.fw.push({ pt, pm, pos, dir, t: 99, x: 0, y: 0, z: 0 });
    }
    // 蛍のような光の粒
    { const n = 40, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 18; pos[i * 3 + 1] = 0.3 + Math.random() * 3; pos[i * 3 + 2] = -2 - Math.random() * 10; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd890, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); root.add(p); F.flies = { p, pos, base: pos.slice() }; }
    return F;
  }
  const FW_COLS = [0xff5a4a, 0xffd04a, 0x6ad0ff, 0xc88aff, 0x7dff9a];
  function updateFestival(F, dt, T) {
    for (const l of F.lan) { if (l.piv) { l.piv.rotation.z = Math.sin(T * 1.3 + l.k) * 0.12; l.piv.rotation.x = Math.sin(T * 0.9 + l.k * 1.7) * 0.06; } else if (l.sp) { const s = l.base * (1 + Math.sin(T * 3 + l.k) * 0.06); l.sp.scale.set(s, s, 1); } }
    F.fwT -= dt; if (F.fwT <= 0) { const f = F.fw.find(q => q.t > 1.6); if (f) { f.t = 0; f.x = (Math.random() - 0.5) * 22; f.y = 8 + Math.random() * 5; f.z = -18 - Math.random() * 6; f.pm.color.set(FW_COLS[(Math.random() * FW_COLS.length) | 0]); } F.fwT = 1.1 + Math.random() * 1.6; }
    for (const f of F.fw) { if (f.t > 1.6) { f.pm.opacity = 0; continue; } f.t += dt; const r = 3.2 * (1 - Math.pow(1 - Math.min(1, f.t / 1.1), 3)), dy = -f.t * f.t * 0.9; for (let j = 0; j < f.dir.length; j++) { const d = f.dir[j]; f.pos[j * 3] = f.x + d[0] * r; f.pos[j * 3 + 1] = f.y + d[1] * r + dy; f.pos[j * 3 + 2] = f.z + d[2] * r; } f.pt.geometry.attributes.position.needsUpdate = true; f.pm.opacity = Math.max(0, 1 - f.t / 1.6); }
    if (F.flies) { const P = F.flies.pos, B = F.flies.base; for (let i = 0; i < P.length; i += 3) { P[i] = B[i] + Math.sin(T * 0.7 + i) * 0.4; P[i + 1] = B[i + 1] + Math.sin(T * 1.1 + i * 0.3) * 0.3; } F.flies.p.geometry.attributes.position.needsUpdate = true; }
    for (const b of F.bosses) {
      try {
        if (b.kind === 'boss') GFX.animBoss(b.m, { x: b.x, y: 0, z: b.z, yaw: b.yaw + Math.sin(T * 0.3) * 0.2, st: 'idle', t: 0, phase: 1 }, T, dt, { lan: {} });
        else GFX.animYoshinoshin(b.m, { x: b.x, y: 0, z: b.z, yaw: b.yaw + Math.sin(T * 0.25) * 0.2, st: 'idle', t: 0 }, T, dt, { U: {} });
      } catch (e) { b.m.root.position.set(b.x, 0, b.z); b.m.root.rotation.y = b.yaw; }
    }
  }
  function makePed(root, x, z, r, col) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.18, 0.22, 32), new THREE.MeshLambertMaterial({ color: 0x1a2350 })); base.position.y = 0.11; g.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 32), new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25 })); top.position.y = 0.25; g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    const sh = GFX.blob(r * 0.85); sh.position.y = 0.295; g.add(sh);
    return { g, top, ring, r };
  }
  function ensure() { if (!W) W = build(R.scene); return W; }
  function hideOthers() { const sc = R.scene; W.hidden = []; for (const o of sc.children) if (o !== W.root && o.visible) { o.visible = false; W.hidden.push(o); } }
  function setModel(slot, id) {
    const old = slot === 'det' ? W.det : W.models[slot];
    if (old && old.c.id === id) return old;
    if (old) old.root.parent && old.root.parent.remove(old.root);
    if (!id || !DATA.CHI[id]) { if (slot === 'det') W.det = null; else W.models[slot] = null; return null; }
    const m = GFX.makeChar(DATA.CHI[id]); W.root.add(m.root); m.shadow.visible = false;
    if (slot === 'det') W.det = m; else W.models[slot] = m;
    return m;
  }
  /** mode：'home'（4体）／'detail'（1体）。ids：4枠のキャラID（空き枠は null） */
  function show(mode, ids, opt) {
    ensure(); opt = opt || {};
    if (!W.root.visible) { hideOthers(); W.root.visible = true; }
    W.mode = mode;
    if (mode === 'bg') { W.peds.forEach(p => p.g.visible = false); W.models.forEach(m => m && (m.root.visible = false)); W.big.g.visible = false; if (W.det) W.det.root.visible = false; W.empty = [true, true, true, true]; return; }
    if (mode === 'home') { for (let i = 0; i < 4; i++) setModel(i, ids[i]); W.peds.forEach(p => p.g.visible = true); W.big.g.visible = false; if (W.det) W.det.root.visible = false; }
    else { const m = setModel('det', ids[0]); if (W.detId !== ids[0]) { W.yaw = -0.35; W.detId = ids[0]; } if (m) m.root.visible = true; W.peds.forEach(p => p.g.visible = false); W.models.forEach(m => m && (m.root.visible = false)); W.big.g.visible = true; W.detX = opt.x == null ? 0 : opt.x; W.big.g.position.x = W.detX; }
    W.empty = ids.map(x => !x);
  }
  function hide() {
    if (!W || !W.root.visible) return;
    W.root.visible = false; for (const o of W.hidden) o.visible = true; W.hidden = []; W.mode = null;
  }
  const active = () => !!(W && W.root.visible);
  function update(dt, T) {
    if (!active()) return;
    const cam = R.camera; cam.clearViewOffset();
    const asp = cam.aspect || 2;
    updateFestival(W.fest, dt, T);
    if (W.mode === 'bg') { // ほかのメニュー画面・ログインの後ろ：祭りだけをゆっくり見回す
      const fov = asp < 1.3 ? 52 : 34; if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = fov; cam.updateProjectionMatrix(); }
      cam.position.set(Math.sin(T * 0.07) * 2.2, 2.4 + Math.sin(T * 0.11) * 0.25, 9.5); cam.lookAt(Math.sin(T * 0.07) * 1.2, 2.2, -6);
    } else if (W.mode === 'home') {
      W.models.forEach((m, i) => {
        if (!m) return; m.root.visible = true; m.root.userData.slot = i;
        const a = { x: X4[i], z: 0, yaw: Math.sin(T * 0.5 + i) * 0.12, st: 'ok', act: '', actT: 0, slot: i, moving: false };
        GFX.animChar(m, a, T, dt, {}); m.root.position.y = 0.3; m.shadow.visible = false;
      });
      W.peds.forEach((p, i) => { p.ring.material.opacity = W.empty[i] ? 0.25 : 0.55 + Math.sin(T * 2 + i) * 0.15; });
      // 中央の4体が全身で入るように（左のメニューの分だけ右へ寄せる）
      const fov = asp < 1.3 ? 52 : 30; if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = fov; cam.updateProjectionMatrix(); }
      const dist = asp < 1.3 ? 9.5 : Math.max(8.2, 15 / asp + 1.4), sx = asp < 1.3 ? 0 : -0.75;
      cam.position.set(sx, 2.0, dist); cam.lookAt(sx, 0.95, 0);
    } else if (W.mode === 'detail') {
      const m = W.det; if (m) {
        const a = { x: W.detX, z: 0, yaw: W.yaw, st: 'ok', act: '', actT: 0, slot: 0, moving: false };
        GFX.animChar(m, a, T, dt, {}); const s = 1.55 / Math.max(0.8, m.h); m.root.scale.setScalar(m.h * s); m.root.position.y = 0.3; m.shadow.visible = false;
      }
      const fov = asp < 1.3 ? 50 : 30; if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = fov; cam.updateProjectionMatrix(); }
      cam.position.set(W.detX, 1.55, 6.4); cam.lookAt(W.detX, 1.05, 0);
    }
  }
  /** ホームの各枠の画面上の位置（足元と頭の上）。名札を重ならない位置へ置くため */
  function slotScreen(i) {
    if (!W || !active()) return null; const h = 1.3 + 0.5; // 名札の高さは一番背の高いキャラに合わせて固定（参加・交代で動かない）
    return { foot: R.project(X4[i], 0.05, 0.62), head: R.project(X4[i], 0.3 + h, 0), mid: R.project(X4[i], 0.8, 0) };
  }
  function rot(d) { if (W) W.yaw += d; }
  return { show, hide, update, active, slotScreen, rot, get mode() { return W && W.mode; } };
})();
