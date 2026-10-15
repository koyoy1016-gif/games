/* =====================================================================
   render_lobby.js — メニュー画面の3D（ホームの4体・キャラ詳細の1体）
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
    // 背景：鮮やかな青→紺のグラデーションの空と、光の柱
    const skyT = GFX.tex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1a4a'); gr.addColorStop(0.45, '#1d56d8'); gr.addColorStop(0.7, '#36a0ff'); gr.addColorStop(1, '#123a8a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -5; root.add(sky);
    const glowT = GFX.tex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(160,230,255,0.9)'); gr.addColorStop(0.4, 'rgba(90,180,255,0.35)'); gr.addColorStop(1, 'rgba(40,90,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); glow.scale.set(22, 12, 1); glow.position.set(0, 3.2, -9); root.add(glow);
    // 床：本作の札の模様（円と菱形）を薄く
    const floorT = GFX.tex(512, 512, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#3a7af0'); gr.addColorStop(1, '#0f2a74'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 6; for (let r = 60; r < w; r += 70) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = w / 2 + Math.cos(a) * 200, y = h / 2 + Math.sin(a) * 200; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 4); g.fillRect(-10, -10, 20, 20); g.restore(); }
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshLambertMaterial({ map: floorT })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; root.add(floor);
    // 台座（4つ）と、詳細用の大きな台座
    const peds = X4.map((x, i) => makePed(root, x, 0, 0.55, PCOLS[i]));
    const big = makePed(root, 0, 0, 0.95, 0xf2c94c); big.g.visible = false;
    return { root, peds, big, models: [null, null, null, null], ids: [], det: null, detId: null, yaw: 0, mode: null, hidden: [] };
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
    if (W.mode === 'home') {
      W.models.forEach((m, i) => {
        if (!m) return; m.root.visible = true;
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
