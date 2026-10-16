/* =====================================================================
   render_akiba.js — 秋葉原編の見た目
   ・秋葉原駅ホーム（閉鎖された安全幅18m・長さ26mの架空ホーム）と、駅前広場（28m四方・電子街の看板）
   ・敵の4人（星・中・オガ・カエ）：かわいい目と丸い手足を持つ独自の女の子の妖怪（約2.8頭身）
   ・上野→御徒町→秋葉原の徒歩演出（15秒）用の通り
   ===================================================================== */
(() => {
  const P = GFX.parts, S = P.S, B = P.B, C = P.C, K = P.K, G = P.G;
  const L = GFX.lam, BAS = GFX.bas;
  const signTex = (txt, sub, bg, fg, w, h) => GFX.tex(w || 512, h || 160, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = `bold ${Math.round(H * 0.42)}px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, sub ? H * 0.4 : H / 2, W - 20); if (sub) { g.font = `${Math.round(H * 0.18)}px ${GFX.FONT_UI}`; g.fillText(sub, W / 2, H * 0.78, W - 20); } });
  const neon = (txt, col) => GFX.tex(256, 96, (g, W, H) => { g.fillStyle = '#120c20'; g.fillRect(0, 0, W, H); g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.font = `bold 40px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, H / 2, W - 16); });
  const W0 = {};
  function lights(root, warm) { root.add(new THREE.HemisphereLight(warm ? 0xfff0e0 : 0xe8f0ff, 0x40384a, 1.1)); const d = new THREE.DirectionalLight(0xfff4e0, 0.75); d.position.set(-6, 14, 4); root.add(d); }
  function skyOf(root, cz) { const sky = new THREE.Mesh(new THREE.SphereGeometry(170, 20, 10), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: GFX.tex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#203a78'); gr.addColorStop(0.45, '#7a6ac8'); gr.addColorStop(0.62, '#f2a6b8'); gr.addColorStop(1, '#2a2440'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }), depthWrite: false })); sky.position.z = cz; root.add(sky); }

  /** 秋葉原駅ホーム：x=±9、z=0〜26。右（+x）は線路側の柵 */
  function buildPlatform(scene) {
    const D = DATA.AKIBA.platform, root = new THREE.Group(); scene.add(root); lights(root); skyOf(root, 13);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(D.halfX * 2 + 2, D.zMax + 8), L(0xb8b4ae)); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, D.zMax / 2); root.add(fl);
    const tile = L(0xf2c94c); for (let z = -2; z < D.zMax + 3; z += 0.6) B(root, 0.3, 0.02, 0.5, tile, D.halfX - 1.0, 0.012, z); // 点字ブロック
    // 線路側の柵（落ちない）と線路
    for (let z = -2; z < D.zMax + 3; z += 2) C(root, 0.05, 0.05, 1.2, L(0x8a8a90), D.halfX + 0.25, 0.6, z);
    B(root, 0.06, 0.06, D.zMax + 6, L(0xb0b0b8), D.halfX + 0.25, 1.15, D.zMax / 2); B(root, 0.06, 0.06, D.zMax + 6, L(0xb0b0b8), D.halfX + 0.25, 0.6, D.zMax / 2);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(6, D.zMax + 40), L(0x5a5048)); bed.rotation.x = -Math.PI / 2; bed.position.set(D.halfX + 3.5, -1.1, D.zMax / 2); root.add(bed);
    for (const dx of [2.3, 4.7]) B(root, 0.1, 0.1, D.zMax + 40, L(0x9a9aa2), D.halfX + dx, -1.0, D.zMax / 2);
    // 屋根と柱（戦う場所の外側）
    B(root, 2.2, 0.3, D.zMax + 6, L(0xd8dce4), -D.halfX - 0.6, 5.2, D.zMax / 2); // 屋根は壁ぎわだけ（上から見るカメラで戦う場所を隠さない）
    for (let z = 0; z <= D.zMax; z += 6.5) C(root, 0.18, 0.18, 5.2, L(0x7a8090), -D.halfX - 0.5, 2.6, z);
    // 駅名標「秋葉原」
    for (const z of [18]) { // v7：カエ・オガの登場で見える駅名標は1個に const st = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), BAS(0xffffff, { map: signTex('秋葉原', 'Akihabara　御徒町 ← → 神田', '#ffffff', '#1b2a48') })); st.position.set(-D.halfX - 0.35, 2.4, z); st.rotation.y = Math.PI / 2; root.add(st); C(root, 0.05, 0.05, 1.8, L(0x3a3a44), -D.halfX - 0.4, 0.9, z - 1.3); C(root, 0.05, 0.05, 1.8, L(0x3a3a44), -D.halfX - 0.4, 0.9, z + 1.3); }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), BAS(0xffffff, { map: signTex('秋葉原駅', 'AKIHABARA', '#1d56b8', '#ffffff') })); top.position.set(0, 4.2, D.zMax + 2.5); top.rotation.y = Math.PI; root.add(top);
    // 向かいの電子街のビル（遠景）
    for (let i = 0; i < 6; i++) { const x = D.halfX + 10 + (i % 2) * 6, z = -4 + i * 7; B(root, 5, 10 + (i % 3) * 4, 6, L([0x4a4060, 0x3a4a6a, 0x5a3a5a][i % 3]), x, 5 + (i % 3) * 2, z); const n = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.3), BAS(0xffffff, { map: neon(['ゲーム', 'でんき', 'パーツ', 'ホビー', 'カード', 'ラジオ'][i], ['#ff5ad8', '#5ad8ff', '#ffe25a', '#8aff6a', '#ff8a4a', '#b08aff'][i]) })); n.position.set(x - 2.55, 6 + (i % 2) * 2, z); n.rotation.y = -Math.PI / 2; root.add(n); }
    root.visible = false; return root;
  }
  /** 秋葉原駅前広場：中心から±13m。奥（+z）に「秋葉原駅」の駅舎 */
  function buildPlaza(scene) {
    const H = DATA.AKIBA.plaza.half, root = new THREE.Group(); scene.add(root); lights(root); skyOf(root, 0);
    const tileT = GFX.tex(128, 128, (g, w, h) => { g.fillStyle = '#8c8894'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#9894a2' : '#827e8c'; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } }, [14, 14]);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(H * 2 + 2, H * 2 + 2), L(0xffffff, { map: tileT })); fl.rotation.x = -Math.PI / 2; root.add(fl);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), L(0x55525e)); out.rotation.x = -Math.PI / 2; out.position.y = -0.02; root.add(out);
    for (const [x, z, w, d] of [[0, H + 0.15, H * 2 + 0.6, 0.3], [0, -H - 0.15, H * 2 + 0.6, 0.3], [H + 0.15, 0, 0.3, H * 2], [-H - 0.15, 0, 0.3, H * 2]]) B(root, w, 0.2, d, L(0xd8d0c4), x, 0.1, z);
    // 駅舎
    B(root, 30, 8, 5, L(0xe6e2da), 0, 4, H + 4.5); for (let i = -3; i <= 3; i++) B(root, 3, 3, 0.2, L(0x7fa8c8, { emissive: 0x223344 }), i * 4, 2, H + 1.95);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 2), BAS(0xffffff, { map: signTex('秋葉原駅', 'AKIHABARA STATION', '#1d2a48', '#ffffff') })); sg.position.set(0, 6, H + 1.9); sg.rotation.y = Math.PI; root.add(sg);
    // 高架と電車（左奥）
    B(root, 3.6, 0.6, 60, L(0x8a8690), -H - 8, 6, 0); for (let z = -26; z <= 26; z += 8) B(root, 0.8, 6, 0.8, L(0x8a8690), -H - 8, 3, z);
    for (let k = 0; k < 2; k++) { B(root, 2.8, 3, 18, L(0xe6eaee), -H - 8, 7.8, -10 + k * 18.5); B(root, 2.85, 0.35, 18, L(0xf2c94c), -H - 8, 7.1, -10 + k * 18.5); }
    // 電子街の看板（架空の店名）
    const shops = [['電気のまち', '#5ad8ff'], ['ゲームの森', '#ff5ad8'], ['パーツ堂', '#ffe25a'], ['ホビー天国', '#8aff6a'], ['無線の店', '#ff8a4a'], ['カード広場', '#b08aff']];
    shops.forEach(([t, c], i) => { const sd = i % 2 ? 1 : -1, z = -10 + Math.floor(i / 2) * 9; B(root, 4, 12, 7, L([0x4a4060, 0x3a4a6a, 0x5a3a5a][i % 3]), sd * (H + 4.5), 6, z); const n = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5), BAS(0xffffff, { map: GFX.tex(64, 256, (g, w, h) => { g.fillStyle = '#120c20'; g.fillRect(0, 0, w, h); g.shadowColor = c; g.shadowBlur = 12; g.fillStyle = c; g.font = `bold 34px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'top'; for (let j = 0; j < t.length; j++) g.fillText(t[j], w / 2, 10 + j * 46); }) })); n.position.set(sd * (H + 2.4), 6, z); n.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(n); });
    root.visible = false; return root;
  }
  GFX.syncAkibaWorld = function (scene, v, T) {
    const pl = v.stageId === 'akiba_plaza';
    if (pl) { W0.plaza = W0.plaza || buildPlaza(scene); W0.plaza.visible = true; if (W0.platform) W0.platform.visible = false; }
    else { W0.platform = W0.platform || buildPlatform(scene); W0.platform.visible = true; if (W0.plaza) W0.plaza.visible = false; }
  };
  GFX.hideAkibaWorld = function () { if (W0.plaza) W0.plaza.visible = false; if (W0.platform) W0.platform.visible = false; };

  /* ---------- 敵の4人：約2.8頭身・かわいい目と丸い手足 ---------- */
  const LOOK = {
    hoshi: { skin: 0xffe6d6, hair: 0x2a2a5a, main: 0x1d2a5a, sub: 0xf6eedc, eye: 0xf2c94c, acc: 0xf2c94c },
    naka: { skin: 0xffe8e0, hair: 0xb8c8e8, main: 0x8aa8d8, sub: 0x9ad8ff, eye: 0x7a6ad8, acc: 0xd8e0f0 },
    oga: { skin: 0xffe0d0, hair: 0x7a2a2a, main: 0xff6a3a, sub: 0xffc08a, eye: 0xff8ab0, acc: 0xff7a6a },
    kae: { skin: 0xffeedd, hair: 0x2a5a4a, main: 0x8ad8a8, sub: 0xf6d8e8, eye: 0x6ad87a, acc: 0x2ac0a0 },
  };
  GFX.makeAkiba = function (who) {
    const T = DATA.AKIBA.foes[who], c = LOOK[who], h = T.h, headH = h / 2.8, R = headH * 0.5;
    const root = G(null), body = G(root, 0, 0, 0);
    const legH = h - headH - h * 0.34, legL = G(body, -0.09, legH, 0), legR = G(body, 0.09, legH, 0);
    for (const lg of [legL, legR]) { C(lg, 0.06, 0.055, legH, L(c.sub), 0, -legH / 2, 0); S(lg, 0.085, L(c.main), 0, -legH + 0.03, 0.03, 1.1, 0.7, 1.3); }
    const torso = G(body, 0, legH, 0);
    const tH = h * 0.34; C(torso, 0.17, 0.26, tH, L(c.main), 0, tH / 2, 0, null, 14); // 丸い服
    const head = G(torso, 0, tH + R * 0.95, 0);
    S(head, R, L(c.skin), 0, 0, 0, 1, 0.96, 0.98);
    S(head, R * 1.05, L(c.hair), 0, R * 0.18, -R * 0.12, 1, 0.92, 0.95); // 髪
    for (const sd of [-1, 1]) { // 大きな目（ハイライト）・ほお
      const e = G(head, sd * R * 0.36, -R * 0.05, R * 0.86);
      S(e, R * 0.2, BAS(0x18141e), 0, 0, 0, 0.85, 1.1, 0.5); S(e, R * 0.13, BAS(c.eye), 0, -R * 0.03, R * 0.04, 0.85, 1.05, 0.5); S(e, R * 0.06, BAS(0xffffff), R * 0.05, R * 0.07, R * 0.09);
      S(head, R * 0.1, BAS(0xffa0b0), sd * R * 0.55, -R * 0.32, R * 0.78, 1, 0.6, 0.4);
    }
    B(head, R * 0.18, R * 0.04, R * 0.05, BAS(0x8a3a4a), 0, -R * 0.42, R * 0.9); // 小さな口
    const arms = [];
    for (const sd of [-1, 1]) { const a = G(torso, sd * 0.2, tH * 0.85, 0); C(a, 0.05, 0.045, tH * 0.8, L(c.sub), 0, -tH * 0.4, 0); S(a, 0.065, L(c.skin), 0, -tH * 0.82, 0); arms.push(a); }
    const prop = G(arms[1], 0, -tH * 0.82, 0.05);
    if (who === 'hoshi') { for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.18), BAS(c.acc)); st.position.set((i - 1) * R * 0.5, R * 1.05, R * 0.2); head.add(st); } C(torso, 0.3, 0.38, tH * 0.55, L(c.sub), 0, tH * 0.7, -0.04, null, 14); /* 短いケープ */ }
    if (who === 'naka') { const rb = new THREE.Mesh(new THREE.TorusGeometry(R * 0.32, R * 0.07, 6, 18, Math.PI * 1.3), BAS(c.acc)); rb.position.set(R * 0.5, R * 0.75, 0); rb.rotation.z = 0.5; head.add(rb); C(prop, 0.015, 0.015, 0.6, L(0xd8e0f0), 0, 0.1, 0.1).rotation.x = 0.6; }
    if (who === 'oga') { for (const sd of [-1, 1]) K(head, R * 0.12, R * 0.35, L(c.acc), sd * R * 0.45, R * 0.95, 0).rotation.z = -sd * 0.3; const fan = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12, 0, Math.PI), L(0xffd27a, { side: THREE.DoubleSide })); fan.position.set(0, 0.05, 0.08); prop.add(fan); }
    if (who === 'kae') { S(head, R * 0.14, BAS(c.acc), -R * 0.6, R * 0.55, R * 0.3); C(torso, 0.27, 0.42, tH * 0.45, L(0xf6d8e8), 0, tH * 0.1, 0, null, 10); /* 蓮の裾 */ C(prop, 0.018, 0.018, 0.8, L(0x6ad8c8), 0, 0.15, 0.1).rotation.x = 0.4; S(prop, 0.06, BAS(0x9af0ff), 0, 0.52, 0.28); }
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0 })); glow.rotation.x = Math.PI / 2; glow.position.y = 0.05; root.add(glow);
    const sc = T.scale || 1; root.scale.setScalar(sc); // 見た目だけ拡大（判定は data の r のまま）
    return { root, body, torso, head, legL, legR, armL: arms[0], armR: arms[1], glow, shadow: GFX.blob(0.45 * sc), who, ph: Math.random() * 10, akiba: true, sc };
  };
  GFX.animAkiba = function (m, e, T, dt) {
    m.root.position.set(e.x, e.air || 0, e.z); m.root.rotation.set(0, e.yaw, 0); m.shadow.position.set(e.x, 0.02, e.z);
    const mv = e.moving && !e.down ? 1 : 0, wk = T * 9 + m.ph;
    m.legL.rotation.x = Math.sin(wk) * 0.6 * mv; m.legR.rotation.x = -Math.sin(wk) * 0.6 * mv;
    m.torso.position.y = (m.legL.position.y) + Math.abs(Math.sin(wk)) * 0.03 * mv;
    let aR = -0.2 + Math.sin(wk) * 0.4 * mv, aL = -0.2 - Math.sin(wk) * 0.4 * mv;
    if (e.ph === 1) { aR = -2.4; aL = -0.6; } else if (e.ph === 2) { aR = -0.9; aL = -0.4; } else if (e.ph === 3) { aR = aL = -2.8; } // 3：図形の必殺（両手を上げて光を結ぶ）
    m.armR.rotation.x = aR; m.armL.rotation.x = aL; m.head.rotation.z = Math.sin(T * 1.5 + m.ph) * 0.08;
    m.glow.material.opacity = e.ph === 3 ? 0.7 + Math.sin(T * 10) * 0.3 : e.buff ? 0.5 : 0; m.glow.material.color.set(e.buff ? 0xff8ad8 : 0xffd84a);
    m.root.rotation.z = 0; m.root.visible = true;
    if (e.down) { m.root.rotation.x = -1.3; m.root.position.y = 0.15; if (e.down === 2) { m.fade = (m.fade || 0) + dt; m.root.visible = m.fade < 1.2 ? Math.floor(T * 10) % 2 === 0 : false; } } // 倒れている（退場は点滅して消える）
    else { m.root.rotation.x = 0; m.fade = 0; }
  };

  /* ---------- 上野→御徒町→秋葉原の徒歩演出（15秒） ---------- */
  GFX.buildWalk = function (scene) {
    const root = new THREE.Group(); scene.add(root); lights(root, true); skyOf(root, 60);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 160), L(0x4a4650)); road.rotation.x = -Math.PI / 2; road.position.z = 60; root.add(road);
    const sw = L(0x9a9490); for (const sd of [-1, 1]) B(root, 3, 0.15, 160, sw, sd * 5.5, 0.07, 60);
    // 上野駅（0〜20）
    const ue = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.8), BAS(0xffffff, { map: signTex('上野駅', 'UENO', '#1d2a48', '#ffffff') })); ue.position.set(-6.6, 4.2, 6); ue.rotation.y = Math.PI / 2; root.add(ue);
    B(root, 2, 6, 18, L(0xd9cbb4), -8.2, 3, 8);
    // 飲み屋街（20〜55）
    for (let z = 22; z < 56; z += 4) for (const sd of [-1, 1]) { B(root, 3, 3.6, 3.6, L([0x6a4a3a, 0x5a4a52, 0x7a5a40][(z / 4) % 3 | 0]), sd * 8.6, 1.8, z); S(root, 0.26, BAS(0xff5a3a), sd * 6.9, 2.8, z, 1, 1.3, 1); const n = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), L([0x1d3a6a, 0x7a1f2a, 0x2a4a2a][(z / 4) % 3 | 0], { side: THREE.DoubleSide })); n.position.set(sd * 7.05, 2.1, z); n.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(n); }
    // 御徒町駅（60〜72）
    B(root, 2, 6, 12, L(0xc8c4bc), 8.2, 3, 66);
    const ok = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.8), BAS(0xffffff, { map: signTex('御徒町駅', 'OKACHIMACHI', '#ffffff', '#1b2a48') })); ok.position.set(6.6, 4.4, 66); ok.rotation.y = -Math.PI / 2; root.add(ok);
    // 高架下（75〜95）と電子街の光（95〜）
    for (let z = 76; z < 95; z += 4) { B(root, 14, 0.8, 1.2, L(0x7a7680), 0, 6, z); for (const sd of [-1, 1]) B(root, 0.8, 6, 0.8, L(0x7a7680), sd * 6.6, 3, z); }
    B(root, 14, 0.5, 24, L(0x6a6670), 0, 6.8, 85);
    const cols = ['#ff5ad8', '#5ad8ff', '#ffe25a', '#8aff6a', '#ff8a4a', '#b08aff'], words = ['ゲーム', 'でんき', 'パーツ', 'ホビー', 'カード', 'ラジオ'];
    for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, z = 98 + Math.floor(i / 2) * 6; B(root, 4, 10, 5, L(0x3a3450), sd * 9, 5, z); const n = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.2), BAS(0xffffff, { map: neon(words[i % 6], cols[i % 6]) })); n.position.set(sd * 6.9, 4 + (i % 3), z); n.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(n); }
    const ak = new THREE.Mesh(new THREE.PlaneGeometry(9, 2), BAS(0xffffff, { map: signTex('秋葉原駅', 'AKIHABARA', '#1d56b8', '#ffffff') })); ak.position.set(0, 5.4, 124); ak.rotation.y = Math.PI; root.add(ak);
    B(root, 22, 9, 4, L(0xe6e2da), 0, 4.5, 127);
    root.visible = false;
    return { root };
  };
})();
