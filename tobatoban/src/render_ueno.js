/* =====================================================================
   render_ueno.js — 上野編：上野駅前の広場（架空の再構成）と指揮官ヨシノシンの見た目
   ・赤茶色のタイルの広い広場（34m×28m）、奥に駅舎と大きな庇、高架の青い常磐線、案内板、街灯、遠景の並木
   ・ヨシノシン：身長3.2m・約5頭身。背を丸め肩を前へ、頭を少し傾けた細い笑い。灰紫の長い上着、指揮札、左右で長さの違う袖
   座標は sim と同じ：x＝左右、z＝奥行き（入口 z=0 → 奥 z=28）。
   ===================================================================== */
(() => {
  const P = GFX.parts, S = P.S, B = P.B, C = P.C, K = P.K, G = P.G;
  const L = GFX.lam, BAS = GFX.bas;

  /* ---------- 広場 ---------- */
  GFX.buildUeno = function (scene) {
    const D = DATA.UENO, HX = D.halfX, ZM = D.zMax;
    const W = { root: new THREE.Group(), fade: [] }; scene.add(W.root); W.root.visible = false;
    const root = W.root;
    root.add(new THREE.HemisphereLight(0xfff2e0, 0x6a5a66, 1.15));
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.85); sun.position.set(-8, 16, 4); root.add(sun); root.add(sun.target); sun.target.position.set(0, 0, 14);
    // 空と遠景
    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: GFX.tex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a7fc4'); gr.addColorStop(0.45, '#f2b98a'); gr.addColorStop(0.6, '#f7d8b0'); gr.addColorStop(1, '#3a3450'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }), depthWrite: false }));
    sky.position.set(0, 0, 14); root.add(sky);
    // 床：赤茶色のタイル（戦闘領域）＋外側の石畳
    const tileT = GFX.tex(128, 128, (g, w, h) => { g.fillStyle = '#a5563e'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#9a4c37' : '#ad5f45'; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } g.strokeStyle = 'rgba(60,30,20,.45)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } }, [HX * 2 / 2, ZM / 2]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, ZM), L(0xffffff, { map: tileT })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, ZM / 2); root.add(floor);
    const stoneT = GFX.tex(64, 64, (g, w, h) => { g.fillStyle = '#8c8a90'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,40,50,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); g.strokeRect(1, 1, 30, 30); }, [40, 40]);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), L(0xffffff, { map: stoneT })); out.rotation.x = -Math.PI / 2; out.position.set(0, -0.02, 14); root.add(out);
    // 縁石（戦闘領域の外周・低い）と、入口の白い線
    const curb = L(0xd8d0c4);
    for (const s of [-1, 1]) B(root, 0.3, 0.18, ZM + 0.6, curb, s * (HX + 0.15), 0.09, ZM / 2);
    B(root, HX * 2 + 0.6, 0.18, 0.3, curb, 0, 0.09, ZM + 0.15);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, 0.12), BAS(0xf4f0e6)); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.01, 0.06); root.add(line);
    // 中央の到着印（スタンプの目印になる円）
    const mark = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), BAS(0xe9d6a8, { transparent: true, opacity: 0.55 })); mark.rotation.x = -Math.PI / 2; mark.position.set(D.center[0], 0.012, D.center[1]); root.add(mark);
    // 駅舎（奥）：大きな庇・時計・駅名
    const wallM = L(0xd9cbb4), darkM = L(0x3a3444), glassM = L(0x7fa8c8, { emissive: 0x223344 }), roofM = L(0x5a5a66);
    const bz = ZM + 6;
    B(root, 46, 9, 6, wallM, 0, 4.5, bz + 3);
    for (let i = -5; i <= 5; i++) B(root, 2.6, 3.4, 0.2, glassM, i * 4, 2.2, bz - 0.05);
    B(root, 50, 0.5, 7.5, roofM, 0, 9.2, bz + 3);
    const eave = B(root, 40, 0.35, 5.2, L(0xe8e2d8), 0, 4.4, ZM + 3.4); W.fade.push(eave.material); // 大きな庇
    for (const x of [-18, -9, 0, 9, 18]) C(root, 0.22, 0.22, 4.4, darkM, x, 2.2, ZM + 1.2);
    const nameT = GFX.tex(512, 128, (g, w, h) => { g.fillStyle = '#1d2a48'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `bold 64px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('上野駅', w / 2, 52); g.font = `24px ${GFX.FONT_UI}`; g.fillText('UENO  STATION', w / 2, 104); });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), BAS(0xffffff, { map: nameT })); nm.position.set(0, 6.6, bz - 0.06); nm.rotation.y = Math.PI; root.add(nm);
    const clockT = GFX.tex(128, 128, (g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 6; g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 22); g.moveTo(64, 64); g.lineTo(96, 76); g.stroke(); });
    const ck = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28), BAS(0xffffff, { map: clockT })); ck.position.set(12, 6.6, bz - 0.06); ck.rotation.y = Math.PI; root.add(ck);
    // 高架の青い常磐線（左奥）
    const via = L(0x8a8690);
    B(root, 3.6, 0.6, 70, via, -HX - 9, 5.2, 14); for (let z = -18; z <= 46; z += 8) B(root, 0.8, 5.2, 0.8, via, -HX - 9, 2.6, z);
    const carM = L(0xe6eaee), blueM = L(0x1d56b8), winM = L(0x2a3446, { emissive: 0x101820 });
    for (let k = 0; k < 3; k++) { const z = 2 + k * 20.5; B(root, 2.8, 3.0, 20, carM, -HX - 9, 7.0, z); B(root, 2.85, 0.35, 20, blueM, -HX - 9, 6.3, z); for (let w = -8; w <= 8; w += 2.6) for (const s of [-1, 1]) B(root, 0.05, 0.9, 1.6, winM, -HX - 9 + s * 1.42, 7.5, z + w); }
    // 案内板（左右の外側・視界をふさがない高さ）
    const signT = GFX.tex(256, 128, (g, w, h) => { g.fillStyle = '#1b3a6e'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23a'; g.font = `bold 32px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('← 公園口　常磐線 →', w / 2, 44); g.fillStyle = '#fff'; g.font = `22px ${GFX.FONT_UI}`; g.fillText('避難済み・立入規制中', w / 2, 92); });
    for (const [x, z, ry] of [[-HX - 2.2, 8, Math.PI / 2], [HX + 2.2, 18, -Math.PI / 2]]) { C(root, 0.08, 0.08, 2.6, darkM, x, 1.3, z); const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), BAS(0xffffff, { map: signT, side: THREE.DoubleSide })); sg.position.set(x, 2.9, z); sg.rotation.y = ry; root.add(sg); }
    // 街灯（戦闘領域の外）
    W.lamps = [];
    for (const s of [-1, 1]) for (const z of [2, 10, 18, 26]) {
      const x = s * (HX + 1.4); C(root, 0.09, 0.12, 4.2, darkM, x, 2.1, z); B(root, 0.9, 0.08, 0.12, darkM, x - s * 0.35, 4.2, z);
      const glow = S(root, 0.22, BAS(0xfff0c0), x - s * 0.75, 4.05, z); W.lamps.push(glow);
    }
    // 遠景の並木
    const leaf = L(0x4f7a3e), trunk = L(0x5a4030);
    for (let i = 0; i < 26; i++) { const s = i % 2 ? 1 : -1, x = s * (HX + 5 + (i * 7) % 9), z = -8 + (i * 13) % 44; C(root, 0.18, 0.25, 2.2, trunk, x, 1.1, z); S(root, 1.5 + (i % 3) * 0.3, leaf, x, 3.2, z, 1, 0.9, 1); }
    for (let i = 0; i < 9; i++) { const x = -16 + i * 4, z = -12 - (i % 3) * 3; C(root, 0.2, 0.25, 2.4, trunk, x, 1.2, z); S(root, 1.8, leaf, x, 3.5, z); }
    // 入口側の段差（装飾）
    for (let k = 0; k < 3; k++) B(root, HX * 2 + 4, 0.15, 1.0, L(0xb8b0a6), 0, -0.08 - k * 0.15, -0.6 - k * 1.0);
    W.update = (T) => { for (const l of W.lamps) l.material.color.setHSL(0.12, 0.8, 0.75 + Math.sin(T * 2) * 0.03); };
    return W;
  };

  /* ---------- ヨシノシン（3.2m） ---------- */
  GFX.makeYoshinoshin = function () {
    const M = {
      coat: L(0x7a6d8c), coatD: L(0x5a4e6a), trim: L(0xc9b26a, { emissive: 0x3a2a00, emissiveIntensity: 0.4 }), collar: L(0xebe6d8), skin: L(0xc9c0d6), skinD: L(0x958ba8), hair: L(0x40394f),
      eyeW: L(0xf6f2d6, { emissive: 0x3a3a10, emissiveIntensity: 0.35 }), iris: BAS(0xc8ff3a), pupil: BAS(0x0c0a10), lid: L(0x766c8e), gold: L(0xe0b84e, { emissive: 0x4a3200, emissiveIntensity: 0.5 }),
      cap: L(0x17151f), mouth: BAS(0x3a1830), boot: L(0x1d1a26), paper: L(0xf4ecd4, { emissive: 0x2a2410, emissiveIntensity: 0.3 }), seal: BAS(0xd8402a), doll: L(0x2b2552),
    };
    const root = G(null), body = G(root, 0, 1.3, 0);
    const legL = G(body, -0.2, 0, 0), legR = G(body, 0.2, 0, 0);
    for (const lg of [legL, legR]) { C(lg, 0.1, 0.085, 1.25, M.coatD, 0, -0.62, 0); B(lg, 0.2, 0.12, 0.38, M.boot, 0, -1.25, 0.08); }
    // 上着の裾（長い・前が割れる）
    const skirt = C(body, 0.36, 0.55, 0.95, M.coat, 0, -0.3, -0.02, null, 14);
    // 猫背：背骨ごと前に曲げる
    const spine = G(body, 0, 0.1, 0); spine.rotation.x = 0.5;
    C(spine, 0.3, 0.38, 1.05, M.coat, 0, 0.5, 0);
    C(spine, 0.32, 0.36, 0.08, M.trim, 0, 0.05, 0);
    B(spine, 0.05, 0.95, 0.03, M.trim, 0, 0.52, 0.33);
    for (const y of [0.25, 0.5, 0.75]) S(spine, 0.035, M.gold, 0, y, 0.34 - y * 0.08);
    C(spine, 0.27, 0.33, 0.2, M.collar, 0, 1.03, 0.02);
    // 肩を前へ（肩パッドの段差）
    for (const s of [-1, 1]) S(spine, 0.2, M.coat, s * 0.38, 0.93, 0.08, 1.1, 0.8, 1.0);
    const neck = G(spine, 0, 1.08, 0.08); neck.rotation.x = -0.35;
    const head = G(neck, 0, 0.32, 0.08); head.rotation.z = 0.16; // 頭を少し傾ける
    S(head, 0.32, M.skin, 0, 0.08, 0, 1, 1.25, 1.05);
    B(head, 0.44, 0.06, 0.1, M.skinD, 0, 0.09, 0.26);
    for (const s of [-1, 1]) B(head, 0.06, 0.22, 0.1, M.hair, s * 0.3, -0.04, -0.03);
    const eyeL = G(head, -0.13, 0.0, 0.25), eyeR = G(head, 0.13, 0.035, 0.255);
    S(eyeL, 0.14, M.eyeW, 0, 0, 0); S(eyeL, 0.085, M.iris, 0, 0, 0.085); S(eyeL, 0.03, M.pupil, 0, 0, 0.155);
    S(eyeR, 0.085, M.eyeW, 0, 0, 0); S(eyeR, 0.05, M.iris, 0, 0, 0.052); S(eyeR, 0.018, M.pupil, 0, 0, 0.095);
    const lidR = B(eyeR, 0.2, 0.05, 0.08, M.lid, 0, 0.07, 0.04); lidR.rotation.z = -0.25;
    const lidL = B(eyeL, 0.3, 0.15, 0.16, M.lid, 0, 0.12, 0.04); lidL.visible = false; // 眠るときに閉じる
    const ring = (r, x, y) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 6, 22), M.gold); m.position.set(x, y, 0.36); head.add(m); return m; };
    ring(0.16, -0.13, 0.0); ring(0.115, 0.13, 0.035); B(head, 0.08, 0.018, 0.018, M.gold, 0, 0.03, 0.37);
    // 細い笑い（三日月）
    const sm = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 4, 16, Math.PI * 0.85), M.mouth); sm.position.set(0.02, -0.17, 0.3); sm.rotation.z = Math.PI + 0.25; head.add(sm);
    // 角帽と房（部下と同じ意匠を大きく）
    C(head, 0.25, 0.28, 0.13, M.cap, 0, 0.44, -0.02);
    const board = B(head, 0.5, 0.035, 0.5, M.cap, 0, 0.52, -0.04); board.rotation.y = 0.75;
    C(head, 0.009, 0.009, 0.3, M.gold, 0.32, 0.38, 0.14); S(head, 0.035, M.gold, 0.32, 0.22, 0.14);
    // 腕（長い）：右は短い袖＋指揮札、左は床近くまで垂れる長い袖
    const armL = G(spine, -0.42, 0.95, 0.06), armR = G(spine, 0.42, 0.95, 0.06);
    C(armL, 0.1, 0.08, 1.0, M.coat, 0, -0.5, 0); const sleeveL = C(armL, 0.13, 0.24, 0.85, M.coat, 0, -1.25, 0, null, 10); // 長く垂れる袖
    C(armR, 0.1, 0.08, 0.95, M.coat, 0, -0.47, 0); C(armR, 0.12, 0.14, 0.18, M.trim, 0, -0.95, 0);
    const handR = G(armR, 0, -1.05, 0); S(handR, 0.09, M.skin, 0, 0, 0, 1, 1.2, 1);
    for (let i = 0; i < 3; i++) C(handR, 0.018, 0.015, 0.16, M.skin, -0.04 + i * 0.04, -0.1, 0.03); // 細い指
    const fuda = G(handR, 0, -0.12, 0.06); fuda.rotation.x = -0.4;
    B(fuda, 0.24, 0.48, 0.02, M.paper, 0, -0.22, 0); const seal = new THREE.Mesh(new THREE.CircleGeometry(0.07, 18), M.seal); seal.position.set(0, -0.2, 0.012); fuda.add(seal);
    for (const y of [-0.06, -0.36]) B(fuda, 0.18, 0.015, 0.025, M.seal, 0, y, 0);
    const handL = G(armL, 0, -1.62, 0); S(handL, 0.08, M.skin, 0, 0, 0);
    // 二十連のとき左腕に抱える小さな人形（部下）
    const dolls = G(armL, 0.12, -0.95, 0.25); dolls.visible = false;
    for (let i = 0; i < 4; i++) { const d = G(dolls, (i % 2) * 0.16 - 0.08, (i >> 1) * 0.16, 0); S(d, 0.08, M.doll, 0, 0, 0); S(d, 0.06, M.skin, 0, 0.1, 0.02); B(d, 0.12, 0.012, 0.12, M.cap, 0, 0.16, 0.02); }
    // 指揮札の光
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshBasicMaterial({ color: 0xc8ff7a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set(0, -0.22, 0.05); fuda.add(glow);
    // バリア（半透明の殻：青→赤）
    const barrier = new THREE.Mesh(new THREE.SphereGeometry(2.0, 28, 18), new THREE.MeshBasicMaterial({ color: 0x6ab8ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); barrier.position.y = 1.7; barrier.visible = false; root.add(barrier);
    const shadow = GFX.blob(1.1);
    return { root, body, spine, neck, head, armL, armR, legL, legR, sleeveL, handR, fuda, glow, dolls, lidL, lidR, skirt, barrier, shadow, ph: 0, kind: 'yoshinoshin', fadeT: 1 };
  };

  /** ヨシノシンの動き：e＝復元したボス、U＝上野の状態 */
  GFX.animYoshinoshin = function (m, e, T, dt, v) {
    const Us = v.U || {}, st = e.st, mv = e.mv, t = e.t || 0;
    m.root.position.set(e.x, e.y || 0, e.z); m.root.rotation.set(0, e.yaw, 0); m.shadow.position.set(e.x, 0.02, e.z);
    const walk = st === 'walk' ? 1 : 0, wk = T * 5;
    let sp = 0.5 + Math.sin(T * 1.4) * 0.04, aR = -0.25 + Math.sin(T * 1.1) * 0.06, aL = -0.15, aRz = -0.15, aLz = 0.12, lean = 0, kneeR = 0, bodyY = 1.3, headZ = 0.16 + Math.sin(T * 0.8) * 0.05, glow = 0, shrink = 1;
    m.legL.rotation.x = Math.sin(wk) * 0.4 * walk; m.legR.rotation.x = -Math.sin(wk) * 0.4 * walk;
    m.dolls.visible = false; m.lidL.visible = false;
    if (st === 'intro') { // 指を鳴らす → 椅子の背にもたれるように反る
      if (t < 1.0) { aR = -1.6; aRz = -0.6; } else if (t < 1.25) { aR = -1.8; aRz = -0.2; } else { sp = 0.2; lean = -0.15; aR = -0.4; aL = -0.3; }
      if (t > 1.0 && t < 1.15) glow = 1.5;
    } else if (st === 'wind' || st === 'act' || st === 'rec') {
      const k = st === 'wind' ? 1 : st === 'act' ? 2 : 3;
      switch (mv) {
        case 'reiko': aR = k === 1 ? -1.2 : -1.6; aRz = k === 1 ? 0.4 : -0.2; glow = k === 1 ? 0.6 + Math.sin(T * 30) * 0.3 : 0.3; break; // 札を胸元へ寄せて放つ
        case 'shosho': sp = k === 1 ? 0.35 : 0.9; aR = aL = k === 1 ? -2.6 : k === 2 ? -0.9 : -0.6; aLz = 0; aRz = 0; shrink = k === 1 ? 0.9 : 1; break; // 肩を縮めて両腕を打ち下ろす
        case 'stamp': kneeR = k === 1 ? -1.4 * Math.min(1, t / 1.2) : 0; sp = k === 1 ? 0.3 : 0.6; aR = -1.0; aL = -1.0; aRz = -0.6; aLz = 0.6; break; // 肩と右膝を上げて踏み下ろす
        case 'tengai': aR = aL = -2.9; aRz = 0.3; aLz = -0.3; glow = 1.0 + Math.sin(T * 14) * 0.3; lean = -0.25; break; // 札を空へ広げる
        case 'shosha': aR = -2.9; aRz = 0.1; glow = 0.8 + Math.sin(T * 20) * 0.3; lean = -0.15; break; // 札を空へ
        case 'warp': shrink = k === 1 ? 1 - Math.min(0.4, t / 0.7 * 0.4) : 1; glow = 0.6; break;
        case 'cmd': aR = -1.3 + Math.sin(T * 8) * 0.5; aRz = -0.5; glow = 0.4; break; // 号令
        case 'barrier': aR = aL = -1.4; aRz = -0.9; aLz = 0.9; glow = 0.8; break;
        case 'throw50': m.dolls.visible = st !== 'rec'; aL = -1.2; aLz = 0.5; aR = k === 2 ? -2.2 + Math.abs(Math.sin(T * 17)) * 2.0 : -0.8; break; // 抱えた人形をぽいぽい投げる
      }
    } else if (st === 'sleep') { sp = 0.15; lean = -0.35; headZ = 0.45; aR = 0.1; aL = 0.1; m.lidL.visible = true; bodyY = 1.1; } // もたれて眠る
    else if (st === 'down' || st === 'stun') { sp = 1.0; headZ = 0.5; aR = aL = 0.3; bodyY = st === 'down' ? 0.85 : 1.2; }
    else if (st === 'dead') { const k = Math.min(1, t / 1.4); sp = 0.5 + k * 0.8; bodyY = 1.3 - k * 0.9; m.root.rotation.z = k * 0.3; }
    m.spine.rotation.x = sp + lean; m.spine.scale.setScalar(shrink); m.body.position.y = bodyY;
    m.neck.rotation.z = Math.sin(T * 0.6) > 0.93 ? 0.35 : 0; m.head.rotation.z = headZ;
    m.armR.rotation.x = aR; m.armR.rotation.z = aRz; m.armL.rotation.x = aL; m.armL.rotation.z = aLz;
    m.legR.rotation.x += kneeR;
    m.sleeveL.rotation.x = -aL * 0.4 + Math.sin(T * 1.7) * 0.06; // 長い袖が揺れる
    m.glow.material.opacity = Math.min(1, glow * 0.6);
    // バリア
    m.barrier.visible = !!Us.barrier && st !== 'dead';
    if (m.barrier.visible) { m.barrier.material.color.set(Us.bhits >= 1 ? 0xff5a4a : 0x6ab8ff); m.barrier.material.opacity = 0.18 + Math.sin(T * 6) * 0.05; m.barrier.rotation.y = T * 0.6; }
    m.root.visible = st !== 'hidden' && !(st === 'dead' && t > 3.2);
    m.shadow.visible = m.root.visible;
  };
})();
