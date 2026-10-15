/* =====================================================================
   render_roster.js — 追加50体の立体モデル（日用品・動物が小さな妖怪になったオリジナル）
   丸い頭・表情の分かる顔・短い胴と足・大きな小道具。全員接地（浮かない）。
   高さ1の単位で作り、身長（c.h）で拡大する。頭身は c.hr（足裏〜頭頂÷頭の高さ）。
   ===================================================================== */
(() => {
  const { S, B, C, K, CAP, G } = GFX.parts, { limbs, eyes } = GFX.bipedParts;
  const L = (c, o) => GFX.lam(c, o), E = (c, k) => L(c, { emissive: c, emissiveIntensity: k == null ? 0.8 : k });
  const TOR = (p, r, tube, c, x, y, z, rx, arc) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 22, arc || Math.PI * 2), c.isMaterial ? c : L(c)); m.position.set(x, y, z); m.rotation.x = rx || 0; p.add(m); return m; };
  const PL = (p, w, h, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), c.isMaterial ? c : L(c, Object.assign({ side: THREE.DoubleSide }, o || {}))); m.position.set(x, y, z); p.add(m); return m; };
  const OCT = (p, r, c, x, y, z) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(r), c.isMaterial ? c : L(c)); m.position.set(x, y, z); p.add(m); return m; };
  /** 頭身から骨格を決める（高さ1の単位） */
  GFX.newDims = (c) => {
    const hr = c.hr || 2.2, R = 0.5 / hr * 0.96, top = 1 - 2 * R, legH = Math.max(0.06, top * 0.32);
    return { legH, headY: 1 - R, shX: 0.15 + R * 0.38, shY: top - 0.02, hipX: 0.075, R, T: Math.max(0.12, top - 0.02 - legH) };
  };
  /** 顔：目・口（R＝頭の半径） */
  function face(h, R, o) {
    o = o || {}; const y = (o.y || 0.05) * R, z = R * (o.z || 0.86);
    if (o.sleepy) { for (const s of [-1, 1]) { const m = TOR(h, R * 0.12, R * 0.025, 0x1a1620, s * R * 0.36, y, z, 0, Math.PI); m.rotation.z = Math.PI; } }
    else eyes(h, y, z, R * 0.36, R * (o.er || 0.13), o.ec);
    if (o.mouth !== false) B(h, R * 0.16, R * 0.035, R * 0.04, o.mc || 0x6a2a2a, 0, y - R * 0.32, z * 0.97);
    if (o.cheek) for (const s of [-1, 1]) S(h, R * 0.1, o.cheek, s * R * 0.55, y - R * 0.2, z * 0.85, 1, 0.6, 0.4);
  }
  const std = (m, d, col, o) => limbs(m, Object.assign({ armR: 0.045, armL: Math.max(0.08, d.T * 0.55), armC: col, hand: 0.045, legR: 0.05, legLen: Math.max(0.05, d.legH - 0.02), legC: col }, o || {}));
  const NB = GFX.NEW_BUILDERS;
  NB._default = (m, c, d) => { S(m.torso, d.T * 0.6, c.col, 0, d.T * 0.5, 0); S(m.head, d.R, c.col, 0, 0, 0); face(m.head, d.R); std(m, d, c.col); };

  /* ===== D ===== */
  NB.new_d_01 = (m, c, d) => { // ほうきコロ：箒の穂の胴・柄の帽子・木の足
    const straw = 0xd8b45a; C(m.torso, d.T * 0.28, d.T * 0.62, d.T * 1.05, straw, 0, d.T * 0.5, 0, null, 14);
    for (const y of [0.25, 0.55, 0.85]) TOR(m.torso, d.T * (0.6 - y * 0.32), 0.012, 0xa0302a, 0, d.T * y, 0, Math.PI / 2);
    S(m.head, d.R, 0xf2dcb0, 0, 0, 0); face(m.head, d.R, { cheek: 0xf0a090 });
    C(m.head, 0.035, 0.035, d.R * 1.6, 0x7a4a2a, 0, d.R * 1.5, 0); C(m.head, d.R * 0.75, d.R * 0.8, 0.03, 0x7a4a2a, 0, d.R * 0.85, 0);
    std(m, d, 0x8a5a32, { legC: 0x7a4a2a });
  };
  NB.new_d_02 = (m, c, d) => { // わらピョン：草鞋の耳・縄のしっぽ
    S(m.torso, d.T * 0.62, 0xf2e6c8, 0, d.T * 0.5, 0, 1, 1.05, 0.95); S(m.head, d.R, 0xf2e6c8, 0, 0, 0); face(m.head, d.R, { cheek: 0xf0a0a0 });
    for (const s of [-1, 1]) { const e = B(m.head, d.R * 0.42, d.R * 1.5, 0.05, 0xe8d39a, s * d.R * 0.45, d.R * 1.35, -0.02); e.rotation.z = -s * 0.18; for (let i = 0; i < 4; i++) B(e, d.R * 0.44, 0.012, 0.06, 0x8a5a2a, 0, (i - 1.5) * d.R * 0.32, 0); }
    TOR(m.body, 0.07, 0.02, 0x8a5a2a, 0, d.T * 0.35, -d.T * 0.6, 0);
    std(m, d, 0xf2e6c8, { foot: [0.08, 0.04, 0.12], footC: 0xe8d39a });
    const bow = G(m.armR, 0, -0.14, 0.05); C(bow, 0.015, 0.015, 0.22, 0x8a5a2a, 0, 0, 0).rotation.x = Math.PI / 2; m.extra.prop = bow;
  };
  NB.new_d_03 = (m, c, d) => { // くるり独楽：一本足の木独楽・渦の頬・小さな扇
    const wood = 0xc8843a; K(m.torso, d.T * 0.75, d.T * 0.7, wood, 0, d.T * 0.35, 0).rotation.x = Math.PI; C(m.torso, d.T * 0.76, d.T * 0.76, 0.06, 0x2f8f6a, 0, d.T * 0.72, 0, null, 18);
    S(m.head, d.R, 0xe8b070, 0, 0, 0, 1, 0.95, 1); face(m.head, d.R);
    for (const s of [-1, 1]) TOR(m.head, d.R * 0.14, 0.012, 0x2f8f6a, s * d.R * 0.58, -d.R * 0.15, d.R * 0.72, 0);
    C(m.head, 0.03, 0.04, d.R * 0.5, 0x7a4a2a, 0, d.R * 1.15, 0);
    limbs(m, { armR: 0.04, armL: d.T * 0.5, armC: wood, hand: 0.04, legR: 0.001, legLen: 0.01, legC: wood });
    C(m.body, 0.035, 0.015, d.legH + 0.02, 0x5a3a20, 0, -d.legH / 2, 0); // 一本足
    const fan = G(m.armR, 0, -0.16, 0.06); const f = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12, 0, Math.PI), L(0xf2e6c8, { side: THREE.DoubleSide })); f.rotation.x = -0.3; fan.add(f); m.extra.prop = fan;
  };
  NB.new_d_04 = (m, c, d) => { // コロ石丸：丸く積んだ敷石の地蔵・苔の眉
    const st = 0x9a9a92; S(m.torso, d.T * 0.62, st, 0, d.T * 0.35, 0, 1.05, 0.7, 1); S(m.torso, d.T * 0.5, 0xa8a8a0, 0, d.T * 0.8, 0, 1, 0.6, 1);
    K(m.torso, d.T * 0.55, d.T * 0.5, 0xc0302a, 0, d.T * 0.82, d.T * 0.14).rotation.x = Math.PI; // よだれかけ
    S(m.head, d.R, 0xb0b0a8, 0, 0, 0); face(m.head, d.R, { mc: 0x4a4a4a });
    for (const s of [-1, 1]) B(m.head, d.R * 0.32, d.R * 0.1, d.R * 0.1, 0x5a8a3a, s * d.R * 0.36, d.R * 0.32, d.R * 0.82);
    std(m, d, st, { legR: 0.06 });
  };
  NB.new_d_05 = (m, c, d) => { // かえし豆：豆の莢の両腕・丸い豆弾
    CAP(m.torso, d.T * 0.4, d.T * 0.5, 0x7ab040, 0, d.T * 0.55, 0); S(m.head, d.R, 0x9acc5a, 0, 0, 0); face(m.head, d.R);
    C(m.head, 0.02, 0.01, d.R * 0.6, 0x4a7a2a, 0, d.R * 1.2, 0);
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const p = CAP(arm, 0.06, d.T * 0.6, 0x7ab040, 0, -d.T * 0.35, 0.02); p.scale.set(1, 1, 0.7); for (let i = 0; i < 3; i++) S(arm, 0.035, 0xd8c060, s * 0.01, -0.08 - i * 0.07, 0.05); }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x7ab040, legR: 0.045, legLen: d.legH - 0.02, legC: 0x4a7a2a });
    S(m.armR, 0.07, 0xd8c060, 0, -d.T * 0.75, 0.1); m.extra.prop = m.armR.children[m.armR.children.length - 1];
  };
  NB.new_d_06 = (m, c, d) => { // チビ灯籠：石灯籠に四本足・灯室の火薬玉
    const st = 0xa8a49a; B(m.torso, d.T * 1.1, d.T * 0.35, d.T * 1.1, st, 0, d.T * 0.2, 0); B(m.torso, d.T * 0.9, d.T * 0.55, d.T * 0.9, st, 0, d.T * 0.65, 0);
    S(m.torso, d.T * 0.22, E(0xff8a2a, 1.1), 0, d.T * 0.65, d.T * 0.38);
    S(m.head, d.R, 0xbab6aa, 0, 0, 0); face(m.head, d.R, { ec: 0x2a2018 });
    const roof = K(m.head, d.R * 1.35, d.R * 0.8, 0x6a6a64, 0, d.R * 0.95, 0); roof.rotation.y = Math.PI / 4;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(m.body, 0.035, 0.035, d.legH, 0x8a867c, x * d.T * 0.38, -d.legH / 2, z * d.T * 0.3);
    limbs(m, { armR: 0.035, armL: d.T * 0.4, armC: st, hand: 0.04, legR: 0.001, legLen: 0.01, legC: st });
  };
  NB.new_d_07 = (m, c, d) => { // しおり羽：折り目の付いた栞の鳥・紙のリュック
    const pap = 0xf0e6d0; B(m.torso, d.T * 0.75, d.T * 1.05, 0.08, pap, 0, d.T * 0.52, 0); B(m.torso, 0.05, d.T * 1.2, 0.09, 0xc84a3a, 0, d.T * 0.5, 0.01);
    B(m.torso, d.T * 0.5, d.T * 0.6, d.T * 0.35, 0xd8c8a0, 0, d.T * 0.55, -d.T * 0.25); // リュック
    S(m.head, d.R, pap, 0, 0, 0); face(m.head, d.R, { mouth: false }); K(m.head, d.R * 0.18, d.R * 0.4, 0xe0a030, 0, -d.R * 0.12, d.R * 1.05).rotation.x = Math.PI / 2;
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const w = B(arm, 0.04, d.T * 0.8, d.T * 0.5, pap, s * 0.02, -d.T * 0.38, -0.04); w.rotation.z = s * 0.25; }
    limbs(m, { armR: 0.001, armL: 0.001, armC: pap, legR: 0.02, legLen: d.legH - 0.02, legC: 0xe0a030, foot: [0.07, 0.02, 0.08] });
  };
  NB.new_d_08 = (m, c, d) => { // ふたつ鈴：赤い糸で結ばれた大小の鈴
    const gold = L(0xe0b040, { emissive: 0x4a3000, emissiveIntensity: 0.4 }); S(m.torso, d.T * 0.62, gold, 0, d.T * 0.5, 0); B(m.torso, d.T * 1.0, 0.03, 0.03, 0x3a2a10, 0, d.T * 0.3, d.T * 0.58);
    S(m.head, d.R, gold, 0, 0, 0); face(m.head, d.R, { ec: 0x2a1a08 }); TOR(m.head, d.R * 0.2, 0.025, 0xc8302a, 0, d.R * 1.05, 0, 0);
    TOR(m.torso, d.T * 0.64, 0.025, 0xc8302a, 0, d.T * 0.62, 0, Math.PI / 2);
    for (const s of [-1, 1]) { const st = C(m.torso, 0.012, 0.012, d.T * 0.6, 0xc8302a, s * d.T * 0.4, d.T * 1.0, 0); st.rotation.z = s * 0.5; }
    std(m, d, 0xc8302a, { legC: 0x8a2a1a });
  };
  NB.new_d_09 = (m, c, d) => { // ちりとり小僧：磁石の口のちりとり・ほこりの前髪
    const bl = 0x4a7ab8; B(m.torso, d.T * 1.0, d.T * 0.9, d.T * 0.35, bl, 0, d.T * 0.45, 0).rotation.x = -0.25;
    C(m.torso, 0.025, 0.025, d.T * 0.9, 0x6a6a6a, 0, d.T * 0.9, -d.T * 0.25).rotation.x = -0.6;
    S(m.head, d.R, 0x8ab0e0, 0, 0, 0); face(m.head, d.R); B(m.head, d.R * 0.5, d.R * 0.12, d.R * 0.1, 0xc0c4c8, 0, -d.R * 0.38, d.R * 0.84);
    for (let i = 0; i < 5; i++) S(m.head, d.R * 0.2, 0xb8b8b0, (i - 2) * d.R * 0.3, d.R * 0.62, d.R * 0.62); // ほこりの前髪
    std(m, d, bl);
  };
  NB.new_d_10 = (m, c, d) => { // ねむり綿：綿雲の小さな羊・氷砂糖の角
    for (const [x, y, z, r] of [[0, 0.5, 0, 0.6], [-0.35, 0.45, 0.1, 0.38], [0.35, 0.45, 0.1, 0.38], [0, 0.8, -0.1, 0.4], [0, 0.3, 0.3, 0.35]]) S(m.torso, d.T * r, 0xf4f2ee, x * d.T, y * d.T, z * d.T);
    S(m.head, d.R, 0xf6e8e0, 0, 0, 0); face(m.head, d.R, { sleepy: true, cheek: 0xf0b0c0 });
    for (const s of [-1, 1]) { const h = K(m.head, d.R * 0.18, d.R * 0.55, L(0x9ad0f0, { transparent: true, opacity: 0.85, emissive: 0x204060, emissiveIntensity: 0.4 }), s * d.R * 0.5, d.R * 0.8, 0); h.rotation.z = -s * 0.4; }
    std(m, d, 0xf4f2ee, { legC: 0x4a4a5a });
  };

  /* ===== C ===== */
  NB.new_c_01 = (m, c, d) => { // おふだろう：札束が耳と袖の提灯小僧・青い印
    C(m.torso, d.T * 0.5, d.T * 0.5, d.T * 1.0, 0xf2ead6, 0, d.T * 0.5, 0, null, 16); for (const y of [0.1, 0.35, 0.6, 0.85]) TOR(m.torso, d.T * 0.5, 0.012, 0xc8b890, 0, d.T * y, 0, Math.PI / 2);
    S(m.torso, d.T * 0.16, E(0x3a6ac8, 0.5), 0, d.T * 0.5, d.T * 0.5, 1, 1, 0.3);
    S(m.head, d.R, 0xf6eedc, 0, 0, 0); face(m.head, d.R, { cheek: 0xf0a090 });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const f = B(m.head, d.R * 0.32, d.R * 0.7, 0.01, 0xfaf4e4, s * (d.R * 0.95 + i * 0.015), d.R * 0.1, -i * 0.02); f.rotation.z = s * (0.3 + i * 0.15); B(f, d.R * 0.08, d.R * 0.5, 0.012, 0xc0302a, 0, 0, 0.002); }
    std(m, d, 0xfaf4e4);
  };
  NB.new_c_02 = (m, c, d) => { // 風呂敷ハヤテ：風呂敷を帆にした小狸・結び目の鼻
    S(m.torso, d.T * 0.6, 0x8a6a4a, 0, d.T * 0.5, 0); S(m.head, d.R, 0x8a6a4a, 0, 0, 0); S(m.head, d.R * 0.5, 0xe8d0b0, 0, -d.R * 0.2, d.R * 0.7, 1, 0.8, 0.6); face(m.head, d.R);
    S(m.head, d.R * 0.14, 0x3aa07a, 0, -d.R * 0.12, d.R * 1.02); for (const s of [-1, 1]) S(m.head, d.R * 0.25, 0x6a4a2a, s * d.R * 0.6, d.R * 0.75, 0);
    const sail = G(m.torso, 0, d.T * 0.8, -d.T * 0.3); const p = PL(sail, d.T * 1.6, d.T * 1.3, 0x3aa07a, 0, d.T * 0.2, -0.1); p.rotation.x = 0.25; m.extra.panels = sail;
    for (let i = 0; i < 4; i++) S(p, 0.04, 0xf2f0e0, (i - 1.5) * 0.12, (i % 2 ? 0.1 : -0.1), 0.01, 1, 1, 0.3);
    std(m, d, 0x8a6a4a); TOR(m.body, 0.08, 0.04, 0x6a4a2a, 0, d.T * 0.2, -d.T * 0.55, 0);
  };
  NB.new_c_03 = (m, c, d) => { // うずまき貝助：渦巻貝を背負う二足の蟹・紙扇のはさみ
    S(m.torso, d.T * 0.62, 0xe07a5a, 0, d.T * 0.42, 0, 1.15, 0.8, 1); const sh = K(m.torso, d.T * 0.55, d.T * 1.0, 0xf0d8b0, 0, d.T * 0.9, -d.T * 0.4); sh.rotation.x = -0.6;
    for (let i = 0; i < 3; i++) TOR(sh, d.T * (0.45 - i * 0.12), 0.015, 0xc89a6a, 0, -d.T * (0.25 - i * 0.18), 0, Math.PI / 2);
    S(m.head, d.R, 0xe88a6a, 0, 0, 0); for (const s of [-1, 1]) { C(m.head, 0.015, 0.015, d.R * 0.6, 0xe07a5a, s * d.R * 0.35, d.R * 0.8, 0.02); S(m.head, d.R * 0.15, 0x1a1418, s * d.R * 0.35, d.R * 1.1, 0.02); }
    face(m.head, d.R, { er: 0.001 });
    for (const arm of [m.armL, m.armR]) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10, 0, Math.PI), L(0xf6f0e0, { side: THREE.DoubleSide })); f.position.set(0, -d.T * 0.6, 0.06); f.rotation.x = -0.4; arm.add(f); }
    std(m, d, 0xe07a5a, { hand: 0.001 });
  };
  NB.new_c_04 = (m, c, d) => { // 屏風イタチ：折り畳み屏風の背びれ・細身
    CAP(m.torso, d.T * 0.32, d.T * 0.7, 0xb07a4a, 0, d.T * 0.55, 0); S(m.torso, d.T * 0.25, 0xf2e6d0, 0, d.T * 0.6, d.T * 0.2, 1, 1.4, 0.6);
    S(m.head, d.R, 0xb07a4a, 0, 0, 0, 1, 0.9, 1.1); S(m.head, d.R * 0.45, 0xf2e6d0, 0, -d.R * 0.25, d.R * 0.7, 1, 0.7, 0.6); face(m.head, d.R);
    for (const s of [-1, 1]) S(m.head, d.R * 0.22, 0x8a5a32, s * d.R * 0.62, d.R * 0.72, 0);
    const scr = G(m.torso, 0, d.T * 0.7, -d.T * 0.38); for (let i = 0; i < 4; i++) { const p = B(scr, 0.13, d.T * 0.9, 0.015, 0xd8b040, 0, 0, -i * 0.1); p.rotation.y = (i % 2 ? 0.5 : -0.5); B(p, 0.1, d.T * 0.6, 0.017, 0xf2e6c8, 0, 0, 0); }
    std(m, d, 0xb07a4a); const tl = CAP(m.body, 0.05, 0.3, 0x8a5a32, 0, d.T * 0.2, -d.T * 0.5); tl.rotation.x = -1.0; m.extra.tail = tl;
  };
  NB.new_c_05 = (m, c, d) => { // こだま竹：竹筒が手足の緑の鳥・音穴の目
    for (let i = 0; i < 3; i++) C(m.torso, d.T * 0.38, d.T * 0.38, d.T * 0.32, 0x6ab04a, 0, d.T * (0.18 + i * 0.33), 0, null, 14);
    for (let i = 1; i < 3; i++) TOR(m.torso, d.T * 0.39, 0.015, 0x4a8a2a, 0, d.T * (0.02 + i * 0.33), 0, Math.PI / 2);
    S(m.head, d.R, 0x8ac860, 0, 0, 0); for (const s of [-1, 1]) { S(m.head, d.R * 0.17, 0x1a2a10, s * d.R * 0.36, d.R * 0.05, d.R * 0.86); S(m.head, d.R * 0.06, 0xe8e0a0, s * d.R * 0.36 + 0.01, d.R * 0.1, d.R * 0.97); }
    K(m.head, d.R * 0.18, d.R * 0.4, 0xe8c060, 0, -d.R * 0.2, d.R * 1.05).rotation.x = Math.PI / 2;
    std(m, d, 0x6ab04a, { armR: 0.04 }); const tube = G(m.armR, 0, -d.T * 0.5, 0.08); C(tube, 0.035, 0.035, 0.28, 0x4a8a2a, 0, 0, 0).rotation.x = Math.PI / 2; m.extra.prop = tube;
  };
  NB.new_c_06 = (m, c, d) => { // 灯台ポン：白黒の縞の小さな灯台・短いアザラシの体
    S(m.torso, d.T * 0.6, 0x8a9aa8, 0, d.T * 0.35, 0, 1.1, 0.75, 1.1);
    C(m.torso, d.T * 0.35, d.T * 0.45, d.T * 0.7, 0xf4f4f4, 0, d.T * 0.8, 0, null, 14); for (const y of [0.62, 0.9]) C(m.torso, d.T * 0.43 - (y - 0.62) * 0.2, d.T * 0.44 - (y - 0.62) * 0.2, d.T * 0.12, 0xd0302a, 0, d.T * y, 0, null, 14);
    S(m.head, d.R, 0xf4f4f4, 0, 0, 0); face(m.head, d.R);
    C(m.head, d.R * 0.45, d.R * 0.45, d.R * 0.5, E(0xfff0a0, 1.0), 0, d.R * 1.1, 0); K(m.head, d.R * 0.55, d.R * 0.45, 0xd0302a, 0, d.R * 1.55, 0);
    for (const arm of [m.armL, m.armR]) { const f = B(arm, 0.06, d.T * 0.55, 0.12, 0x8a9aa8, 0, -d.T * 0.3, 0); f.rotation.x = 0.3; }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x8a9aa8, legR: 0.05, legLen: d.legH - 0.02, legC: 0x6a7a88, foot: [0.1, 0.03, 0.14] });
  };
  NB.new_c_07 = (m, c, d) => { // 水筒トット：水筒の胴・コルクの帽子・水滴の足
    const cy = C(m.torso, d.T * 0.55, d.T * 0.55, d.T * 0.4, 0x4a8ab0, 0, d.T * 0.55, 0, null, 18); cy.rotation.x = Math.PI / 2; cy.scale.set(1, 1, 1.6);
    TOR(m.torso, d.T * 0.6, 0.02, 0xb08a5a, 0, d.T * 0.55, 0, 0).rotation.y = 0.3;
    S(m.head, d.R, 0x9ac8e8, 0, 0, 0); face(m.head, d.R); C(m.head, d.R * 0.42, d.R * 0.5, d.R * 0.55, 0xb08a5a, 0, d.R * 1.05, 0);
    limbs(m, { armR: 0.04, armL: d.T * 0.5, armC: 0x4a8ab0, hand: 0.045, legR: 0.045, legLen: d.legH - 0.04, legC: 0x4a8ab0 });
    for (const leg of [m.legL, m.legR]) S(leg, 0.07, L(0x9ad8ff, { transparent: true, opacity: 0.85 }), 0, -d.legH + 0.06, 0.02, 1, 1.2, 1);
  };
  NB.new_c_08 = (m, c, d) => { // 紐まもり：お守り袋の中に二つの目・長い組紐の腕
    const tx = GFX.tex(64, 96, (g, w, h) => { g.fillStyle = '#c83a5a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c040'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10); for (let y = 14; y < h; y += 14) for (let x = 12; x < w; x += 14) { g.fillStyle = '#e8c040'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } });
    B(m.torso, d.T * 0.95, d.T * 1.15, d.T * 0.45, L(0xffffff, { map: tx }), 0, d.T * 0.55, 0);
    S(m.head, d.R, 0xc83a5a, 0, -d.R * 0.2, 0, 1, 0.75, 0.75); face(m.head, d.R, { y: -0.1 }); TOR(m.head, d.R * 0.35, 0.03, 0xe8c040, 0, d.R * 0.5, 0, 0);
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { for (let i = 0; i < 6; i++) S(arm, 0.03, i % 2 ? 0xe8c040 : 0x6a2a8a, s * 0.01, -0.03 - i * 0.055, 0); }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0xc83a5a, legR: 0.04, legLen: d.legH - 0.02, legC: 0x8a2a3a });
  };
  NB.new_c_09 = (m, c, d) => { // 磁石ヤモリ：U字磁石の尾・錆色のヤモリ
    CAP(m.torso, d.T * 0.35, d.T * 0.55, 0xa85a3a, 0, d.T * 0.5, 0); S(m.head, d.R, 0xb86a4a, 0, 0, 0, 1.1, 0.85, 1.1); face(m.head, d.R, { er: 0.16 });
    for (let i = 0; i < 5; i++) S(m.torso, 0.02, 0x7a3a22, (i % 2 ? 0.05 : -0.05), d.T * (0.2 + i * 0.15), d.T * 0.33);
    const tail = G(m.body, 0, d.T * 0.2, -d.T * 0.45); const u = TOR(tail, 0.12, 0.04, 0xc0302a, 0, 0, -0.1, 0, Math.PI); u.rotation.z = Math.PI; for (const s of [-1, 1]) C(tail, 0.04, 0.04, 0.06, 0xc0c4c8, s * 0.12, 0.02, -0.1); m.extra.tail = tail;
    std(m, d, 0xa85a3a, { foot: [0.09, 0.02, 0.1] });
  };
  NB.new_c_10 = (m, c, d) => { // まくらモチ：餅のような枕の精・ふとんのマント
    S(m.torso, d.T * 0.72, 0xf6efe4, 0, d.T * 0.42, 0, 1.2, 0.7, 1); S(m.head, d.R, 0xfaf4ea, 0, 0, 0, 1.1, 0.9, 1); face(m.head, d.R, { sleepy: true, cheek: 0xf0b0b0 });
    const cape = PL(m.torso, d.T * 1.5, d.T * 1.2, 0x7a6ac0, 0, d.T * 0.55, -d.T * 0.55); cape.rotation.x = 0.15; for (let i = 0; i < 3; i++) PL(cape, d.T * 1.5, 0.03, 0xf0e8ff, 0, (i - 1) * d.T * 0.35, 0.002);
    std(m, d, 0xf6efe4, { legR: 0.06, legC: 0xe8e0d0 });
  };

  /* ===== B ===== */
  NB.new_b_01 = (m, c, d) => { // 清め茶釜：青銅の茶釜の亀・湯気の紋
    const br = L(0x5a7a6a, { emissive: 0x102018, emissiveIntensity: 0.4 }); S(m.torso, d.T * 0.7, br, 0, d.T * 0.45, 0, 1.15, 0.8, 1.15); C(m.torso, d.T * 0.4, d.T * 0.5, d.T * 0.12, 0x3a5a4a, 0, d.T * 0.88, 0);
    TOR(m.torso, d.T * 0.5, 0.02, 0xc8a04a, 0, d.T * 1.0, 0, 0); const sp = C(m.torso, 0.03, 0.05, d.T * 0.5, br, d.T * 0.75, d.T * 0.5, 0); sp.rotation.z = -1.0;
    S(m.head, d.R, 0x9ab89a, 0, 0, 0); face(m.head, d.R);
    for (let i = 0; i < 3; i++) S(m.head, d.R * (0.25 - i * 0.05), L(0xffffff, { transparent: true, opacity: 0.6 }), Math.sin(i) * 0.05, d.R * (1.2 + i * 0.35), 0);
    std(m, d, 0x9ab89a, { legR: 0.06 });
  };
  NB.new_b_02 = (m, c, d) => { // 凧走りテン：大きな和凧の尾・風見の耳
    CAP(m.torso, d.T * 0.32, d.T * 0.6, 0xd8a040, 0, d.T * 0.55, 0); S(m.head, d.R, 0xd8a040, 0, 0, 0, 1, 0.9, 1.1); S(m.head, d.R * 0.45, 0xf2e6c8, 0, -d.R * 0.25, d.R * 0.72, 1, 0.7, 0.6); face(m.head, d.R);
    for (const s of [-1, 1]) { const e = K(m.head, d.R * 0.22, d.R * 0.5, 0xd8a040, s * d.R * 0.5, d.R * 0.9, 0); e.rotation.z = -s * 0.2; PL(m.head, d.R * 0.2, d.R * 0.12, 0xc83a3a, s * d.R * 0.5, d.R * 1.25, 0.02); }
    const kite = G(m.body, 0, d.T * 0.9, -d.T * 0.7); const k = B(kite, d.T * 1.1, d.T * 1.1, 0.02, 0xf2e6c8, 0, 0, 0); k.rotation.z = Math.PI / 4; S(kite, d.T * 0.22, 0xc83a3a, 0, 0, 0.02, 1, 1, 0.2); m.extra.tail = kite;
    std(m, d, 0xd8a040);
  };
  NB.new_b_03 = (m, c, d) => { // 渦巻き獅子：螺旋のたてがみ・陶器の獅子
    const por = L(0xf2f0ea, { emissive: 0x202020, emissiveIntensity: 0.2 }); S(m.torso, d.T * 0.62, por, 0, d.T * 0.5, 0); for (const y of [0.3, 0.6]) TOR(m.torso, d.T * 0.6, 0.02, 0x3a8ac8, 0, d.T * y, 0, Math.PI / 2);
    S(m.head, d.R, por, 0, 0, 0); face(m.head, d.R, { ec: 0x1a2a6a });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; TOR(m.head, d.R * 0.2, 0.03, 0x3a8ac8, Math.sin(a) * d.R * 0.95, Math.cos(a) * d.R * 0.95, -d.R * 0.15, 0); }
    std(m, d, por, { legR: 0.06, foot: [0.1, 0.05, 0.12], footC: 0x3a8ac8 });
  };
  NB.new_b_04 = (m, c, d) => { // 瓦ヨロイ：屋根瓦の鎧・棟瓦の兜
    for (let i = 0; i < 4; i++) { const t = C(m.torso, d.T * (0.55 - i * 0.04), d.T * (0.62 - i * 0.04), d.T * 0.28, 0x5a6070, 0, d.T * (0.15 + i * 0.24), 0, null, 10); t.rotation.y = i * 0.3; }
    S(m.head, d.R, 0xe8d8c0, 0, 0, 0); face(m.head, d.R);
    const hel = C(m.head, d.R * 1.05, d.R * 1.1, d.R * 0.45, 0x4a5060, 0, d.R * 0.55, 0, null, 10); C(m.head, d.R * 0.18, d.R * 0.18, d.R * 1.6, 0x9a6a3a, 0, d.R * 0.85, 0).rotation.z = Math.PI / 2;
    std(m, d, 0x5a6070, { legR: 0.065 }); B(m.armL, 0.2, 0.26, 0.04, 0x4a5060, 0, -d.T * 0.4, 0.1);
  };
  NB.new_b_05 = (m, c, d) => { // 反響カワセミ：瑠璃の羽・銅鏡のくちばし
    S(m.torso, d.T * 0.6, 0x2a8ac8, 0, d.T * 0.5, 0); S(m.torso, d.T * 0.45, 0xe07a2a, 0, d.T * 0.4, d.T * 0.2, 1, 1, 0.6);
    S(m.head, d.R, 0x2a8ac8, 0, 0, 0); face(m.head, d.R, { mouth: false });
    const bk = K(m.head, d.R * 0.2, d.R * 0.9, L(0xc87a4a, { emissive: 0x401a00, emissiveIntensity: 0.4 }), 0, -d.R * 0.1, d.R * 1.25); bk.rotation.x = Math.PI / 2;
    C(m.head, d.R * 0.3, d.R * 0.3, 0.02, L(0xe0b080, { emissive: 0x604020, emissiveIntensity: 0.6 }), 0, -d.R * 0.1, d.R * 1.65).rotation.x = Math.PI / 2;
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const w = S(arm, 0.14, 0x1a6aa8, s * 0.03, -0.12, -0.02, 0.4, 1, 0.8); }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x2a8ac8, legR: 0.02, legLen: d.legH - 0.02, legC: 0xe07a2a, foot: [0.07, 0.02, 0.08] });
  };
  NB.new_b_06 = (m, c, d) => { // 見張りドグウ：灯る大きな目の土偶・背中の観測器
    const clay = 0xb0784a; S(m.torso, d.T * 0.6, clay, 0, d.T * 0.5, 0, 1.1, 1, 0.9); for (const y of [0.3, 0.55, 0.8]) TOR(m.torso, d.T * 0.52, 0.015, 0x8a5a32, 0, d.T * y, 0, Math.PI / 2);
    S(m.head, d.R, clay, 0, 0, 0, 1.15, 1, 1); for (const s of [-1, 1]) { const g = S(m.head, d.R * 0.32, E(0x6ad0ff, 1.0), s * d.R * 0.42, d.R * 0.05, d.R * 0.75, 1, 0.45, 0.5); }
    B(m.head, d.R * 0.4, 0.02, 0.02, 0x6a4a2a, 0, -d.R * 0.4, d.R * 0.88);
    const ring = G(m.torso, 0, d.T * 0.8, -d.T * 0.5); TOR(ring, d.T * 0.4, 0.02, 0xc8a04a, 0, 0, 0, 0); TOR(ring, d.T * 0.4, 0.02, 0xc8a04a, 0, 0, 0, Math.PI / 2); m.extra.charms = ring;
    std(m, d, clay, { legR: 0.07, armR: 0.06 });
  };
  NB.new_b_07 = (m, c, d) => { // 星配りラッコ：星形の貝・腰に巾着
    S(m.torso, d.T * 0.62, 0x8a6a4a, 0, d.T * 0.5, 0, 1, 1.1, 0.95); S(m.torso, d.T * 0.42, 0xd8c0a0, 0, d.T * 0.55, d.T * 0.22, 1, 1.2, 0.6);
    S(m.head, d.R, 0x9a7a5a, 0, 0, 0); S(m.head, d.R * 0.55, 0xe8d8c0, 0, -d.R * 0.15, d.R * 0.6, 1, 0.8, 0.6); face(m.head, d.R); for (const s of [-1, 1]) S(m.head, d.R * 0.16, 0x7a5a3a, s * d.R * 0.8, d.R * 0.5, 0);
    S(m.torso, d.T * 0.2, 0x6a3a8a, d.T * 0.4, d.T * 0.25, d.T * 0.35, 1, 1.2, 1);
    std(m, d, 0x8a6a4a); const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), E(0xf2d050, 0.9)); star.position.set(0, -d.T * 0.6, 0.1); m.armR.add(star); m.extra.star = star;
  };
  NB.new_b_08 = (m, c, d) => { // 結びヤナギ：柳の枝の腕・枝先に二重の輪
    CAP(m.torso, d.T * 0.25, d.T * 0.8, 0x7ab06a, 0, d.T * 0.5, 0); for (let i = 0; i < 6; i++) { const l = CAP(m.torso, 0.025, d.T * 0.6, 0x9ad08a, Math.sin(i) * d.T * 0.28, d.T * 0.7, Math.cos(i) * d.T * 0.28); l.rotation.z = Math.sin(i) * 0.3; }
    S(m.head, d.R, 0xd8e8b0, 0, 0, 0); face(m.head, d.R); for (let i = 0; i < 7; i++) { const l = CAP(m.head, 0.03, d.R * 1.2, 0x7ab06a, Math.cos(i * 0.9) * d.R * 0.8, -d.R * 0.1, Math.sin(i * 0.9) * d.R * 0.5 - d.R * 0.2); }
    for (const arm of [m.armL, m.armR]) { C(arm, 0.02, 0.012, d.T * 0.8, 0x6a5a3a, 0, -d.T * 0.4, 0); TOR(arm, 0.06, 0.012, 0xd8e8b0, 0, -d.T * 0.82, 0, 0); TOR(arm, 0.04, 0.012, 0xe8c060, 0, -d.T * 0.82, 0.01, 0); }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x7ab06a, legR: 0.03, legLen: d.legH - 0.02, legC: 0x6a5a3a });
  };
  NB.new_b_09 = (m, c, d) => { // 鉄砂タヌキ：砂鉄の毛・磁極模様の腹
    S(m.torso, d.T * 0.65, 0x4a4a52, 0, d.T * 0.5, 0); S(m.torso, d.T * 0.3, 0xc84a3a, -d.T * 0.12, d.T * 0.45, d.T * 0.45, 0.5, 1, 0.4); S(m.torso, d.T * 0.3, 0x3a6ac8, d.T * 0.12, d.T * 0.45, d.T * 0.45, 0.5, 1, 0.4);
    for (let i = 0; i < 14; i++) { const a = i * 2.4; K(m.torso, 0.025, 0.08, 0x2a2a30, Math.sin(a) * d.T * 0.6, d.T * (0.3 + (i % 5) * 0.12), Math.cos(a) * d.T * 0.6); }
    S(m.head, d.R, 0x5a5a62, 0, 0, 0); S(m.head, d.R * 0.45, 0xb8b8c0, 0, -d.R * 0.2, d.R * 0.72, 1, 0.75, 0.6); face(m.head, d.R); for (const s of [-1, 1]) { S(m.head, d.R * 0.28, 0x2a2a30, s * d.R * 0.38, d.R * 0.05, d.R * 0.75, 1, 0.8, 0.3); S(m.head, d.R * 0.22, 0x3a3a42, s * d.R * 0.6, d.R * 0.75, 0); }
    std(m, d, 0x4a4a52);
  };
  NB.new_b_10 = (m, c, d) => { // 夢織りバク：布の鼻・背に糸巻き
    S(m.torso, d.T * 0.65, 0x6a6a9a, 0, d.T * 0.45, 0, 1.1, 0.9, 1.1); S(m.head, d.R, 0x7a7aaa, 0, 0, 0); face(m.head, d.R, { sleepy: true });
    const n = CAP(m.head, d.R * 0.18, d.R * 0.7, 0xf0e0f0, 0, -d.R * 0.4, d.R * 1.0); n.rotation.x = 1.2;
    const sp = G(m.torso, 0, d.T * 0.75, -d.T * 0.6); C(sp, d.T * 0.25, d.T * 0.25, d.T * 0.6, 0xf0e0f0, 0, 0, 0).rotation.z = Math.PI / 2; for (const s of [-1, 1]) C(sp, d.T * 0.32, d.T * 0.32, 0.03, 0x8a6a4a, s * d.T * 0.3, 0, 0).rotation.z = Math.PI / 2; m.extra.charms = sp;
    std(m, d, 0x6a6a9a, { legR: 0.06 });
  };

  /* ===== A ===== */
  NB.new_a_01 = (m, c, d) => { // 白露ミコ：白い朝露の鳥の巫者・雫の冠
    K(m.torso, d.T * 0.6, d.T * 1.1, 0xf6f8fa, 0, d.T * 0.5, 0); K(m.torso, d.T * 0.62, d.T * 0.4, 0xd04a5a, 0, d.T * 0.12, 0);
    S(m.head, d.R, 0xf6f8fa, 0, 0, 0); face(m.head, d.R, { mouth: false }); K(m.head, d.R * 0.14, d.R * 0.35, 0xe0a030, 0, -d.R * 0.1, d.R * 1.05).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.45; const dr = S(m.head, d.R * 0.13, L(0x8ac8f0, { transparent: true, opacity: 0.9, emissive: 0x2a6a9a, emissiveIntensity: 0.6 }), Math.sin(a) * d.R * 0.7, d.R * (0.9 + Math.cos(a) * 0.15), 0, 1, 1.4, 1); }
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const w = B(arm, 0.04, d.T * 0.7, d.T * 0.4, 0xf6f8fa, s * 0.02, -d.T * 0.33, -0.02); w.rotation.z = s * 0.2; }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0xf6f8fa, legR: 0.02, legLen: d.legH - 0.02, legC: 0xe0a030, foot: [0.07, 0.02, 0.08] });
  };
  NB.new_a_02 = (m, c, d) => { // 疾風ムササビ：風車の耳・青い滑空膜
    S(m.torso, d.T * 0.55, 0x9a7a5a, 0, d.T * 0.5, 0, 1, 1.1, 0.9); S(m.torso, d.T * 0.38, 0xf0e0c8, 0, d.T * 0.5, d.T * 0.2, 1, 1.2, 0.5);
    S(m.head, d.R, 0x9a7a5a, 0, 0, 0); face(m.head, d.R, { er: 0.16 });
    for (const s of [-1, 1]) { const w = G(m.head, s * d.R * 0.6, d.R * 0.85, 0); for (let i = 0; i < 4; i++) { const b = B(w, d.R * 0.08, d.R * 0.45, 0.01, i % 2 ? 0x3a8ad8 : 0xf2f0ea, 0, d.R * 0.2, 0); b.rotation.z = i * Math.PI / 2; b.position.set(Math.sin(i * Math.PI / 2) * d.R * 0.2, Math.cos(i * Math.PI / 2) * d.R * 0.2, 0); } }
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) PL(arm, d.T * 0.5, d.T * 0.9, L(0x3a8ad8, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), s * d.T * 0.25, -d.T * 0.45, -0.03);
    std(m, d, 0x9a7a5a); const tl = CAP(m.body, 0.07, 0.3, 0x8a6a4a, 0, d.T * 0.3, -d.T * 0.5); tl.rotation.x = -0.9; m.extra.tail = tl;
  };
  NB.new_a_03 = (m, c, d) => { // 嵐笠オウル：大きな編み笠のフクロウ
    S(m.torso, d.T * 0.65, 0x7a6a5a, 0, d.T * 0.5, 0); S(m.torso, d.T * 0.45, 0xd8c8a8, 0, d.T * 0.45, d.T * 0.25, 1, 1.2, 0.5);
    S(m.head, d.R, 0x8a7a6a, 0, 0, 0); for (const s of [-1, 1]) { S(m.head, d.R * 0.32, 0xf2e8d0, s * d.R * 0.38, 0, d.R * 0.72, 1, 1, 0.4); } face(m.head, d.R, { er: 0.17, mouth: false }); K(m.head, d.R * 0.12, d.R * 0.3, 0xd8a040, 0, -d.R * 0.3, d.R * 0.95).rotation.x = Math.PI;
    const hat = K(m.head, d.R * 1.9, d.R * 0.8, 0xd8c08a, 0, d.R * 1.05, 0); for (let i = 0; i < 3; i++) TOR(m.head, d.R * (0.6 + i * 0.4), 0.015, 0xa88a5a, 0, d.R * (1.25 - i * 0.18), 0, Math.PI / 2);
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) S(arm, 0.16, 0x6a5a4a, s * 0.03, -0.13, -0.02, 0.42, 1, 0.8);
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x7a6a5a, legR: 0.025, legLen: d.legH - 0.02, legC: 0xd8a040, foot: [0.08, 0.02, 0.08] });
  };
  NB.new_a_04 = (m, c, d) => { // 城門ガメ：背中が二枚扉の城門
    S(m.torso, d.T * 0.6, 0x9ac08a, 0, d.T * 0.4, d.T * 0.1, 1, 0.9, 0.8);
    const g = G(m.torso, 0, d.T * 0.55, -d.T * 0.35); B(g, d.T * 1.3, d.T * 1.1, d.T * 0.4, 0x6a8a5a, 0, 0, 0); for (const s of [-1, 1]) { B(g, d.T * 0.5, d.T * 0.8, 0.03, 0x8a4a2a, s * d.T * 0.27, -d.T * 0.1, -d.T * 0.21); S(g, 0.02, 0xd8b040, s * d.T * 0.06, -d.T * 0.1, -d.T * 0.23); }
    const roof = B(g, d.T * 1.5, 0.06, d.T * 0.6, 0x3a3a3a, 0, d.T * 0.6, 0); K(g, d.T * 0.12, 0.08, 0xd8b040, 0, d.T * 0.68, 0);
    S(m.head, d.R, 0x9ac08a, 0, 0, d.R * 0.2); face(m.head, d.R);
    std(m, d, 0x9ac08a, { legR: 0.08, armR: 0.06 });
  };
  NB.new_a_05 = (m, c, d) => { // 鏡羽ハヤブサ：磨いた鏡の翼が重なる
    S(m.torso, d.T * 0.58, 0x3a4a6a, 0, d.T * 0.5, 0); S(m.torso, d.T * 0.4, 0xd8dce4, 0, d.T * 0.45, d.T * 0.22, 1, 1.2, 0.5);
    S(m.head, d.R, 0x3a4a6a, 0, 0, 0); S(m.head, d.R * 0.5, 0xf2f2f2, 0, -d.R * 0.15, d.R * 0.6, 1, 0.9, 0.6); face(m.head, d.R, { mouth: false, ec: 0x101820 }); K(m.head, d.R * 0.15, d.R * 0.35, 0xe0b040, 0, -d.R * 0.2, d.R * 1.0).rotation.x = Math.PI / 2 + 0.3;
    const mir = L(0xb8c4d0, { emissive: 0x506070, emissiveIntensity: 0.5 });
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) for (let i = 0; i < 4; i++) { const p = B(arm, 0.02, d.T * (0.5 - i * 0.06), 0.1, mir, s * 0.02, -d.T * (0.2 + i * 0.12), -0.04 + i * 0.02); p.rotation.z = s * (0.2 + i * 0.1); }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x3a4a6a, legR: 0.025, legLen: d.legH - 0.02, legC: 0xe0b040, foot: [0.08, 0.02, 0.09] });
  };
  NB.new_a_06 = (m, c, d) => { // 天文灯匠：天球儀と灯籠を背負う職人・真鍮の手
    const brass = L(0xd8a83a, { emissive: 0x3a2a00, emissiveIntensity: 0.5 });
    CAP(m.torso, d.T * 0.35, d.T * 0.55, 0x3a4a8a, 0, d.T * 0.5, 0); B(m.torso, d.T * 0.75, 0.05, d.T * 0.6, 0x8a5a2a, 0, d.T * 0.35, 0);
    S(m.head, d.R, 0xf2d8b8, 0, 0, 0); face(m.head, d.R); C(m.head, d.R * 0.85, d.R * 0.95, d.R * 0.35, 0x2a3a6a, 0, d.R * 0.65, 0);
    const sph = G(m.torso, 0, d.T * 1.05, -d.T * 0.45); for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2]]) { const t = TOR(sph, d.T * 0.35, 0.015, brass, 0, 0, 0, rx); t.rotation.y = ry; } S(sph, d.T * 0.1, E(0x7ad0ff, 1.0), 0, 0, 0); m.extra.charms = sph;
    B(m.torso, d.T * 0.25, d.T * 0.35, d.T * 0.25, 0x6a6a64, d.T * 0.35, d.T * 0.7, -d.T * 0.4); S(m.torso, d.T * 0.08, E(0xffb040, 1.0), d.T * 0.35, d.T * 0.7, -d.T * 0.27);
    std(m, d, 0x3a4a8a, { handC: 0xd8a83a, hand: 0.05 });
  };
  NB.new_a_07 = (m, c, d) => { // 星継ぎ鹿：枝角に星の珠を掛けた青い鹿・郵便鞄
    CAP(m.torso, d.T * 0.33, d.T * 0.55, 0x4a7ac8, 0, d.T * 0.55, 0); S(m.torso, d.T * 0.24, 0xf2f0e8, 0, d.T * 0.6, d.T * 0.2, 1, 1.2, 0.5);
    S(m.head, d.R, 0x5a8ad8, 0, 0, 0, 1, 0.95, 1.05); S(m.head, d.R * 0.4, 0xf2f0e8, 0, -d.R * 0.3, d.R * 0.75, 1, 0.8, 0.6); face(m.head, d.R);
    for (const s of [-1, 1]) { const an = G(m.head, s * d.R * 0.45, d.R * 0.8, 0); C(an, 0.02, 0.025, d.R * 0.9, 0xe8d8b0, 0, d.R * 0.4, 0).rotation.z = -s * 0.3; for (let i = 0; i < 2; i++) { C(an, 0.015, 0.015, d.R * 0.4, 0xe8d8b0, s * d.R * (0.1 + i * 0.12), d.R * (0.45 + i * 0.25), 0).rotation.z = -s * 1.0; S(an, d.R * 0.1, E(0xf2d050, 0.9), s * d.R * (0.25 + i * 0.12), d.R * (0.55 + i * 0.25), 0); } }
    B(m.torso, d.T * 0.4, d.T * 0.35, d.T * 0.2, 0x8a5a2a, d.T * 0.35, d.T * 0.35, 0.02); std(m, d, 0x4a7ac8, { legR: 0.035 });
  };
  NB.new_a_08 = (m, c, d) => { // 契り鶴：二羽の影を持つ一羽の折鶴・組紐の長い尾
    const pap = L(0xf6f2ea, { flatShading: true }); const b = OCT(m.torso, d.T * 0.6, pap, 0, d.T * 0.55, 0); b.scale.set(1, 0.9, 1.3);
    const nk = C(m.torso, 0.03, 0.05, d.T * 0.7, pap, 0, d.T * 0.95, d.T * 0.3); nk.rotation.x = 0.5;
    S(m.head, d.R, 0xf6f2ea, 0, 0, 0); face(m.head, d.R, { mouth: false }); K(m.head, d.R * 0.12, d.R * 0.4, 0xd04a5a, 0, -d.R * 0.1, d.R * 1.05).rotation.x = Math.PI / 2; S(m.head, d.R * 0.2, 0xd04a5a, 0, d.R * 0.85, 0, 1, 0.5, 1);
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const w = OCT(arm, 0.14, pap, s * 0.08, -0.1, -0.02); w.scale.set(1.6, 0.3, 1); }
    const tail = G(m.body, 0, d.T * 0.5, -d.T * 0.5); for (let i = 0; i < 7; i++) S(tail, 0.03, i % 2 ? 0xd04a5a : 0xe0b040, 0, -i * 0.03, -i * 0.06); m.extra.tail = tail;
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0xf6f2ea, legR: 0.02, legLen: d.legH - 0.02, legC: 0xd04a5a });
  };
  NB.new_a_09 = (m, c, d) => { // 極磁ビャッコ：鉄の縞と磁石の肉球の白い虎の子
    S(m.torso, d.T * 0.6, 0xf2f0ea, 0, d.T * 0.5, 0, 1, 1, 1.05); for (let i = 0; i < 4; i++) B(m.torso, 0.04, d.T * 0.5, d.T * 0.1, 0x3a3a42, (i - 1.5) * d.T * 0.25, d.T * 0.6, -d.T * 0.5);
    S(m.head, d.R, 0xf2f0ea, 0, 0, 0); face(m.head, d.R, { ec: 0x2a6ac8 }); for (const s of [-1, 1]) { B(m.head, d.R * 0.08, d.R * 0.4, d.R * 0.05, 0x3a3a42, s * d.R * 0.75, d.R * 0.3, d.R * 0.4); S(m.head, d.R * 0.24, 0xf2f0ea, s * d.R * 0.62, d.R * 0.75, 0); }
    B(m.head, d.R * 0.06, d.R * 0.35, d.R * 0.05, 0x3a3a42, 0, d.R * 0.62, d.R * 0.72);
    std(m, d, 0xf2f0ea, { hand: 0.055, handC: 0xc03a3a });
  };
  NB.new_a_10 = (m, c, d) => { // 夢見フクロウ：半月の眠そうな目・紺の掛け布団の羽根
    S(m.torso, d.T * 0.68, 0x3a3a6a, 0, d.T * 0.5, 0); S(m.torso, d.T * 0.45, 0xe8d090, 0, d.T * 0.45, d.T * 0.25, 1, 1.2, 0.5);
    S(m.head, d.R, 0x4a4a7a, 0, 0, 0); for (const s of [-1, 1]) S(m.head, d.R * 0.32, 0xe8d090, s * d.R * 0.38, 0, d.R * 0.72, 1, 1, 0.4); face(m.head, d.R, { sleepy: true, mouth: false });
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const q = B(arm, 0.04, d.T * 0.8, d.T * 0.5, 0x2a2a5a, s * 0.02, -d.T * 0.36, -0.02); q.rotation.z = s * 0.2; for (let i = 0; i < 3; i++) B(q, 0.045, 0.02, d.T * 0.5, 0xe8d090, 0, (i - 1) * d.T * 0.22, 0); }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x3a3a6a, legR: 0.025, legLen: d.legH - 0.02, legC: 0xd8a040 });
  };

  /* ===== S ===== */
  NB.new_s_01 = (m, c, d) => { // 月白カグラ：白磁の狐面と月形の袖の舞手
    K(m.torso, d.T * 0.55, d.T * 1.1, 0xf6f6f2, 0, d.T * 0.5, 0); K(m.torso, d.T * 0.58, d.T * 0.35, 0xd04a3a, 0, d.T * 0.1, 0);
    S(m.head, d.R, 0x2a2228, 0, 0, -d.R * 0.1); const mask = S(m.head, d.R * 0.95, L(0xfafaf6, { emissive: 0x303030, emissiveIntensity: 0.3 }), 0, 0, d.R * 0.12, 0.95, 1, 0.8);
    K(m.head, d.R * 0.35, d.R * 0.6, 0xfafaf6, 0, -d.R * 0.15, d.R * 0.85).rotation.x = Math.PI / 2; for (const s of [-1, 1]) { K(m.head, d.R * 0.25, d.R * 0.6, 0xfafaf6, s * d.R * 0.55, d.R * 0.9, 0); B(m.head, d.R * 0.28, d.R * 0.06, 0.02, 0xd04a3a, s * d.R * 0.35, d.R * 0.15, d.R * 0.9).rotation.z = s * 0.4; }
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const sl = TOR(arm, d.T * 0.3, d.T * 0.08, L(0xf6f6f2, { emissive: 0x404040, emissiveIntensity: 0.3 }), s * 0.05, -d.T * 0.35, 0, 0, Math.PI * 1.2); sl.rotation.z = s * 0.6; }
    limbs(m, { armR: 0.035, armL: d.T * 0.4, armC: 0xf6f6f2, hand: 0.035, handC: 0xf2d8c8, legR: 0.035, legLen: d.legH - 0.02, legC: 0xd04a3a });
  };
  NB.new_s_02 = (m, c, d) => { // 天翔カゼツル：風の帯・帆のように開く銀の鶴
    CAP(m.torso, d.T * 0.3, d.T * 0.6, 0xc8d0d8, 0, d.T * 0.55, 0); const nk = C(m.torso, 0.03, 0.05, d.T * 0.6, 0xc8d0d8, 0, d.T * 1.0, d.T * 0.15); nk.rotation.x = 0.3;
    S(m.head, d.R, 0xe8eef2, 0, 0, 0); face(m.head, d.R, { mouth: false }); S(m.head, d.R * 0.25, 0xd04a3a, 0, d.R * 0.85, 0, 1, 0.4, 1); K(m.head, d.R * 0.12, d.R * 0.6, 0x3a3a3a, 0, -d.R * 0.15, d.R * 1.15).rotation.x = Math.PI / 2;
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const w = PL(arm, d.T * 0.6, d.T * 1.1, L(0xe8eef2, { side: THREE.DoubleSide, emissive: 0x304050, emissiveIntensity: 0.3 }), s * d.T * 0.3, -d.T * 0.4, -0.03); w.rotation.y = s * 0.3; }
    const band = G(m.torso, 0, d.T * 0.5, 0); for (let i = 0; i < 2; i++) TOR(band, d.T * (0.5 + i * 0.12), 0.012, L(0x5ab0c8, { emissive: 0x2a6a8a, emissiveIntensity: 0.8 }), 0, i * 0.08, 0, Math.PI / 2 + 0.3); m.extra.charms = band;
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0xc8d0d8, legR: 0.02, legLen: d.legH - 0.02, legC: 0x3a3a3a });
  };
  NB.new_s_03 = (m, c, d) => { // 天渦リュウセン：短い胴に渦巻く透明なひれの龍の子
    CAP(m.torso, d.T * 0.38, d.T * 0.45, 0x5ac0b0, 0, d.T * 0.5, 0); S(m.torso, d.T * 0.28, 0xe8f8f0, 0, d.T * 0.45, d.T * 0.22, 1, 1.3, 0.5);
    S(m.head, d.R, 0x6ad0c0, 0, 0, 0, 1, 0.95, 1.1); S(m.head, d.R * 0.45, 0xe8f8f0, 0, -d.R * 0.25, d.R * 0.75, 1, 0.75, 0.6); face(m.head, d.R, { ec: 0x1a3a6a });
    for (const s of [-1, 1]) { const h = K(m.head, d.R * 0.1, d.R * 0.6, 0xf2e8c0, s * d.R * 0.4, d.R * 0.95, -d.R * 0.1); h.rotation.z = -s * 0.3; C(m.head, 0.01, 0.01, d.R * 0.8, 0xe8f8f0, s * d.R * 0.7, -d.R * 0.3, d.R * 0.7).rotation.z = s * 1.2; }
    const fin = L(0xc8fff8, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: 0x3ab0a0, emissiveIntensity: 0.6 });
    const fins = G(m.torso, 0, d.T * 0.6, -d.T * 0.35); for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CircleGeometry(d.T * (0.35 - i * 0.06), 10, 0, Math.PI), fin); f.position.set(0, -i * d.T * 0.2, -i * 0.04); f.rotation.y = Math.PI / 2; fins.add(f); } m.extra.panels = fins;
    std(m, d, 0x5ac0b0); const tl = CAP(m.body, 0.06, 0.35, 0x5ac0b0, 0, d.T * 0.2, -d.T * 0.55); tl.rotation.x = -1.1; m.extra.tail = tl;
  };
  NB.new_s_04 = (m, c, d) => { // 不動コウラオウ：岩窟の門の甲羅・光る縄の眉
    S(m.torso, d.T * 0.55, 0x8a8478, 0, d.T * 0.38, d.T * 0.15, 1, 0.85, 0.8);
    const sh = S(m.torso, d.T * 0.8, 0x6a6458, 0, d.T * 0.6, -d.T * 0.2, 1.1, 0.85, 1); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; S(sh, 0.08, 0x5a544a, Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5, 1, 0.5, 1); }
    B(m.torso, d.T * 0.5, d.T * 0.55, 0.05, 0x2a2420, 0, d.T * 0.65, -d.T * 0.98); C(m.torso, 0.02, 0.02, d.T * 0.7, E(0xffd040, 0.9), 0, d.T * 0.95, -d.T * 0.95).rotation.z = Math.PI / 2;
    S(m.head, d.R, 0x9a9488, 0, 0, d.R * 0.3); face(m.head, d.R, { ec: 0x2a2018 }); for (const s of [-1, 1]) { const br = C(m.head, d.R * 0.06, d.R * 0.06, d.R * 0.5, E(0xffd040, 1.0), s * d.R * 0.38, d.R * 0.4, d.R * 1.1); br.rotation.z = Math.PI / 2 + s * 0.2; }
    std(m, d, 0x8a8478, { legR: 0.09, armR: 0.07, foot: [0.14, 0.05, 0.16] });
  };
  NB.new_s_05 = (m, c, d) => { // 星鏡オオワシ：星座模様の鏡羽・黒曜石のくちばし
    S(m.torso, d.T * 0.6, 0x2a2a3a, 0, d.T * 0.5, 0); S(m.torso, d.T * 0.4, 0xf2f2f2, 0, d.T * 0.7, d.T * 0.2, 1.1, 0.7, 0.5);
    S(m.head, d.R, 0xf2f2f2, 0, 0, 0); face(m.head, d.R, { mouth: false, ec: 0x101018 }); const bk = K(m.head, d.R * 0.2, d.R * 0.5, 0x101018, 0, -d.R * 0.15, d.R * 1.05); bk.rotation.x = Math.PI / 2 + 0.4;
    const mir = L(0x3a4a6a, { emissive: 0x2a3a5a, emissiveIntensity: 0.5 });
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { for (let i = 0; i < 5; i++) { const p = B(arm, 0.02, d.T * (0.6 - i * 0.07), 0.11, mir, s * 0.02, -d.T * (0.2 + i * 0.12), -0.05 + i * 0.02); p.rotation.z = s * (0.2 + i * 0.12); S(p, 0.012, E(0xa8c8f0, 1.2), s * 0.012, 0, 0.03); } }
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0x2a2a3a, legR: 0.03, legLen: d.legH - 0.02, legC: 0xe0b040, foot: [0.1, 0.02, 0.1] });
  };
  NB.new_s_06 = (m, c, d) => { // 銀河灯楼：短い脚で歩く小さな灯楼の付喪神・飾り灯
    C(m.torso, d.T * 0.38, d.T * 0.5, d.T * 1.0, 0xc8c0b0, 0, d.T * 0.5, 0, null, 8); for (const y of [0.3, 0.65]) C(m.torso, d.T * 0.48 - y * 0.1, d.T * 0.5 - y * 0.1, 0.04, 0x7a6ad8, 0, d.T * y, 0, null, 8);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; S(m.torso, 0.03, E(i % 2 ? 0x7a6ad8 : 0xffd070, 1.2), Math.cos(a) * d.T * 0.45, d.T * 0.48, Math.sin(a) * d.T * 0.45); }
    S(m.head, d.R, 0xd8d0c0, 0, 0, 0); face(m.head, d.R); C(m.head, d.R * 0.6, d.R * 0.6, d.R * 0.6, E(0xb0a0ff, 0.9), 0, d.R * 1.1, 0, null, 8); K(m.head, d.R * 0.8, d.R * 0.5, 0x5a4aa8, 0, d.R * 1.65, 0);
    std(m, d, 0xc8c0b0, { legR: 0.06 });
  };
  NB.new_s_07 = (m, c, d) => { // 暁星シカガミ：朝焼けの角の鹿の精・星の小包
    CAP(m.torso, d.T * 0.3, d.T * 0.6, 0xe89a6a, 0, d.T * 0.55, 0); S(m.torso, d.T * 0.22, 0xf8e0a0, 0, d.T * 0.6, d.T * 0.2, 1, 1.3, 0.5);
    S(m.head, d.R, 0xf0aa7a, 0, 0, 0, 1, 0.95, 1.05); S(m.head, d.R * 0.38, 0xf8e8d0, 0, -d.R * 0.3, d.R * 0.75, 1, 0.8, 0.6); face(m.head, d.R);
    const ant = L(0xffb070, { emissive: 0xff7030, emissiveIntensity: 0.7 });
    for (const s of [-1, 1]) { const an = G(m.head, s * d.R * 0.4, d.R * 0.8, 0); for (let i = 0; i < 3; i++) { const b = C(an, 0.02, 0.025, d.R * (0.6 - i * 0.12), ant, s * d.R * i * 0.15, d.R * (0.3 + i * 0.25), 0); b.rotation.z = -s * (0.3 + i * 0.35); } }
    const pk = B(m.torso, d.T * 0.5, d.T * 0.4, d.T * 0.35, 0xf8e0a0, 0, d.T * 0.75, -d.T * 0.4); S(pk, 0.05, E(0xffe070, 1.2), 0, 0, -d.T * 0.19); TOR(pk, d.T * 0.22, 0.012, 0xc84a3a, 0, 0, 0, 0);
    std(m, d, 0xe89a6a, { legR: 0.035 });
  };
  NB.new_s_08 = (m, c, d) => { // 縁紡ぎクジャク：金糸の結び目の尾羽・胸の二重輪
    S(m.torso, d.T * 0.5, 0x2a8a8a, 0, d.T * 0.5, 0, 1, 1.2, 0.95); TOR(m.torso, d.T * 0.18, 0.015, 0xe0b040, 0, d.T * 0.62, d.T * 0.45, 0); TOR(m.torso, d.T * 0.12, 0.015, 0xe0b040, 0, d.T * 0.62, d.T * 0.47, 0);
    S(m.head, d.R, 0x2a9a9a, 0, 0, 0); face(m.head, d.R, { mouth: false }); K(m.head, d.R * 0.12, d.R * 0.3, 0xe0b040, 0, -d.R * 0.15, d.R * 1.0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { C(m.head, 0.008, 0.008, d.R * 0.5, 0x2a8a8a, (i - 1) * d.R * 0.15, d.R * 1.15, 0); S(m.head, d.R * 0.08, E(0xe0b040, 0.6), (i - 1) * d.R * 0.15, d.R * 1.42, 0); }
    const tail = G(m.body, 0, d.T * 0.7, -d.T * 0.4); for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.3; const f = G(tail, 0, 0, 0); f.rotation.z = a; C(f, 0.01, 0.01, d.T * 1.0, 0x1a6a6a, 0, d.T * 0.5, 0); TOR(f, 0.05, 0.015, E(0xe0b040, 0.7), 0, d.T * 0.98, 0, 0); } m.extra.tail = tail;
    limbs(m, { armR: 0.03, armL: d.T * 0.4, armC: 0x2a8a8a, legR: 0.02, legLen: d.legH - 0.02, legC: 0x8a8a8a });
  };
  NB.new_s_09 = (m, c, d) => { // 極星クロガネ：砂鉄のたてがみ・星形の磁石の角の小獅子
    S(m.torso, d.T * 0.6, 0x3a3a42, 0, d.T * 0.5, 0, 1, 1, 1.05); S(m.torso, d.T * 0.32, 0x5a5a62, 0, d.T * 0.45, d.T * 0.35, 1, 1, 0.5);
    S(m.head, d.R, 0x4a4a52, 0, 0, 0); face(m.head, d.R, { ec: 0xe0c040 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const sp = K(m.head, d.R * 0.12, d.R * 0.5, 0x22222a, Math.sin(a) * d.R * 1.0, Math.cos(a) * d.R * 1.0, -d.R * 0.3); sp.rotation.z = -a; }
    const st = OCT(m.head, d.R * 0.25, E(0xe0c040, 1.0), 0, d.R * 1.15, d.R * 0.2); st.scale.set(1, 1.4, 0.5);
    std(m, d, 0x3a3a42, { hand: 0.05, handC: 0xc03a3a });
  };
  NB.new_s_10 = (m, c, d) => { // 夢月ホウオウ：月光の布の羽根・閉じた目の模様の鳳凰の幼鳥
    S(m.torso, d.T * 0.55, 0xd8d0f0, 0, d.T * 0.5, 0, 1, 1.15, 0.95);
    S(m.head, d.R, 0xe8e0ff, 0, 0, 0); face(m.head, d.R, { sleepy: true, mouth: false }); K(m.head, d.R * 0.12, d.R * 0.3, 0xe0b040, 0, -d.R * 0.15, d.R * 1.0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const cr = C(m.head, 0.01, 0.01, d.R * 0.6, 0x8a6ad8, (i - 1) * d.R * 0.2, d.R * 1.2, 0); cr.rotation.z = (i - 1) * 0.3; S(m.head, d.R * 0.09, E(0xd0c0ff, 1.0), (i - 1) * d.R * 0.38, d.R * 1.5, 0); }
    const cloth = L(0xd0c8ff, { transparent: true, opacity: 0.6, side: THREE.DoubleSide, emissive: 0x6a5ac8, emissiveIntensity: 0.6 });
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) for (let i = 0; i < 3; i++) { const w = PL(arm, d.T * 0.35, d.T * (0.9 - i * 0.15), cloth, s * (0.08 + i * 0.08), -d.T * 0.4, -0.03 - i * 0.02); w.rotation.z = s * (0.2 + i * 0.25); }
    const tail = G(m.body, 0, d.T * 0.4, -d.T * 0.45); for (let i = 0; i < 3; i++) { const f = PL(tail, d.T * 0.25, d.T * 0.9, cloth, (i - 1) * 0.08, -d.T * 0.2, -0.05); f.rotation.x = -0.9; f.rotation.z = (i - 1) * 0.3; } m.extra.tail = tail;
    limbs(m, { armR: 0.001, armL: 0.001, armC: 0xd8d0f0, legR: 0.02, legLen: d.legH - 0.02, legC: 0xe0b040, foot: [0.07, 0.02, 0.08] });
  };
})();
