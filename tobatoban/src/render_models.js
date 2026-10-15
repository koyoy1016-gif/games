/* =====================================================================
   render_models.js — もののけ10体・トバトーバン・札小僧（すべて新規の造形）
   基準味方（コゲマル）の身長=1。ボスは同じ単位で高さ5.0。
   ===================================================================== */
(() => {
  const L = (c, o) => GFX.lam(c, o);
  const S = (p, r, c, x, y, z, sx, sy, sz, o) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), c.isMaterial ? c : L(c, o)); m.position.set(x, y, z); m.scale.set(sx || 1, sy || sx || 1, sz || sx || 1); p.add(m); return m; };
  const B = (p, w, h, d, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), c.isMaterial || Array.isArray(c) ? c : L(c, o)); m.position.set(x, y, z); p.add(m); return m; };
  const C = (p, r0, r1, h, c, x, y, z, o, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 12), c.isMaterial ? c : L(c, o)); m.position.set(x, y, z); p.add(m); return m; };
  const K = (p, r, h, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), c.isMaterial ? c : L(c, o)); m.position.set(x, y, z); p.add(m); return m; };
  const CAP = (p, r, l, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), c.isMaterial ? c : L(c, o)); m.position.set(x, y, z); p.add(m); return m; };
  const G = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (p) p.add(g); return g; };
  GFX.parts = { S, B, C, K, CAP, G };
  function eyes(p, y, z, sep, r, col) { for (const s of [-1, 1]) { S(p, r, col || 0x16131a, s * sep, y, z); S(p, r * 0.38, 0xffffff, s * sep + r * 0.3, y + r * 0.35, z + r * 0.75); } }
  const shadowT = () => GFX._shT || (GFX._shT = GFX.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(8,6,20,.62)'); gr.addColorStop(0.6, 'rgba(8,6,20,.35)'); gr.addColorStop(1, 'rgba(8,6,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
  GFX.blob = (r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowT(), transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m; };

  /** 二足の基本形。hip=腰（脚の付け根）、torso=胴、head=頭、armL/armR=肩、legL/legR=股 */
  function biped(o) {
    const root = G(null), body = G(root, 0, o.legH, 0), torso = G(body), head = G(torso, 0, o.headY - o.legH, 0);
    const armL = G(torso, -o.shX, o.shY - o.legH, 0), armR = G(torso, o.shX, o.shY - o.legH, 0);
    const legL = G(body, -o.hipX, 0, 0), legR = G(body, o.hipX, 0, 0);
    return { root, body, torso, head, armL, armR, legL, legR, extra: {} };
  }
  function limbs(m, o) {
    for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { CAP(arm, o.armR, o.armL, o.armC, 0, -o.armL / 2 - o.armR * 0.3, 0); if (o.hand) S(arm, o.hand, o.handC || o.armC, 0, -o.armL - o.armR, 0, 1, 1, 1, o.handO); }
    for (const leg of [m.legL, m.legR]) { CAP(leg, o.legR, Math.max(0.01, o.legLen - o.legR * 2), o.legC, 0, -o.legLen / 2, 0); if (o.foot) B(leg, o.foot[0], o.foot[1], o.foot[2], o.footC || o.legC, 0, -o.legLen + o.foot[1] / 2, o.foot[2] * 0.2); }
  }
  const BUILDERS = {
    kogemaru(m) {
      const dark = 0x3b3a40, ember = { emissive: 0xff6a1a, emissiveIntensity: 0.9 };
      S(m.torso, 0.27, dark, 0, 0.22, 0, 1, 1.05, 0.95); S(m.torso, 0.19, 0xe9d8c0, 0, 0.2, 0.12, 1, 1.05, 0.6);
      for (const [x, y] of [[-0.07, 0.25], [0.06, 0.16], [0.02, 0.3]]) S(m.torso, 0.025, 0xff7a2a, x, y, 0.235, 1, 1, 1, ember);
      S(m.head, 0.25, 0x48464d, 0, 0, 0); S(m.head, 0.12, 0xe9d8c0, 0, -0.06, 0.19, 1.1, 0.8, 0.7);
      for (const s of [-1, 1]) { S(m.head, 0.075, 0x1d1b20, s * 0.1, 0.02, 0.18, 1.2, 0.9, 0.5); S(m.head, 0.07, dark, s * 0.17, 0.2, 0, 1, 1, 0.6); S(m.head, 0.035, 0xff7a2a, s * 0.17, 0.2, 0.03, 1, 1, 0.5, ember); }
      eyes(m.head, 0.03, 0.22, 0.095, 0.032, 0xf6e8c8); S(m.head, 0.03, 0x111111, 0, -0.03, 0.27);
      const tail = G(m.body, 0, 0.12, -0.25); m.extra.tail = tail;
      [[0.11, 0x3b3a40], [0.1, 0xff7a2a], [0.085, 0x3b3a40], [0.065, 0xff7a2a]].forEach(([r, c], i) => S(tail, r, c, 0, i * 0.04, -i * 0.11, 1, 1, 1, c === 0xff7a2a ? { emissive: 0xff5a10, emissiveIntensity: 0.5 } : null));
      limbs(m, { armR: 0.06, armL: 0.13, armC: dark, hand: 0.065, handC: 0xff8a3a, handO: ember, legR: 0.075, legLen: 0.2, legC: dark });
      m.extra.glow = [m.armL.children[1], m.armR.children[1]];
    },
    hoshisuzume(m) {
      const br = 0x9a6a3e;
      S(m.torso, 0.3, br, 0, 0.2, 0, 1, 0.95, 1); S(m.torso, 0.22, 0xf1e6cf, 0, 0.17, 0.12, 1, 1, 0.6);
      S(m.head, 0.22, 0xf1e6cf, 0, 0, 0); S(m.head, 0.225, 0x7a3b1e, 0, 0.05, -0.02, 1, 0.8, 1);
      for (const s of [-1, 1]) S(m.head, 0.045, 0x1b1b1b, s * 0.17, -0.04, 0.09, 0.6, 1, 0.6);
      eyes(m.head, 0.02, 0.18, 0.085, 0.03); K(m.head, 0.04, 0.08, 0x3a3a3a, 0, -0.03, 0.24).rotation.x = Math.PI / 2;
      for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const w = S(arm, 0.14, 0x8a5a32, s * 0.03, -0.1, -0.02, 0.45, 1, 0.8); S(arm, 0.1, 0x5a3a20, s * 0.04, -0.16, -0.05, 0.4, 0.8, 0.7); }
      B(m.body, 0.18, 0.04, 0.22, 0x5a3a20, 0, 0.12, -0.32).rotation.x = 0.5;
      for (const leg of [m.legL, m.legR]) { C(leg, 0.018, 0.018, 0.18, 0xe09a4a, 0, -0.09, 0); B(leg, 0.08, 0.02, 0.1, 0xe09a4a, 0, -0.18, 0.03); }
      const lamp = G(m.armR, 0.02, -0.28, 0.12); m.extra.prop = lamp;
      const brass = L(0xc9a03a, { emissive: 0x4a3200, emissiveIntensity: 0.4 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 20), brass); lamp.add(ring);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), L(0xffe27a, { emissive: 0xffd040, emissiveIntensity: 1.2 })); lamp.add(star); m.extra.star = star;
    },
    akaneten(m) {
      const or = 0xe8683a, cr = 0xffe0b0;
      CAP(m.torso, 0.17, 0.22, or, 0, 0.22, 0); S(m.torso, 0.13, cr, 0, 0.28, 0.09, 1, 1.2, 0.5);
      S(m.head, 0.19, or, 0, 0, 0, 1, 0.95, 1.05); S(m.head, 0.1, cr, 0, -0.05, 0.15, 1.1, 0.8, 1); S(m.head, 0.025, 0x2a1a14, 0, -0.03, 0.25);
      for (const s of [-1, 1]) { const e = K(m.head, 0.06, 0.12, or, s * 0.12, 0.19, 0); e.rotation.z = -s * 0.3; }
      eyes(m.head, 0.04, 0.16, 0.08, 0.028);
      const tail = G(m.body, 0, 0.1, -0.18); m.extra.tail = tail;
      [0.09, 0.1, 0.11, 0.1, 0.085].forEach((r, i) => S(tail, r, i === 4 ? cr : or, 0, 0.05 + i * 0.07, -0.06 - i * 0.07));
      limbs(m, { armR: 0.05, armL: 0.14, armC: or, hand: 0.05, handC: cr, legR: 0.06, legLen: 0.2, legC: or });
      const charms = G(m.root, 0, 0.75, 0); m.extra.charms = charms;
      for (let i = 0; i < 2; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), L(0xffb070, { emissive: 0xff5a20, emissiveIntensity: 1.0, side: THREE.DoubleSide })); c.position.set(Math.cos(i * Math.PI) * 0.42, 0, Math.sin(i * Math.PI) * 0.42); charms.add(c); }
    },
    kagetsubame(m) {
      const nv = 0x2a2f55;
      S(m.torso, 0.25, nv, 0, 0.22, 0, 0.95, 1.1, 1); S(m.torso, 0.18, 0xf2f0ea, 0, 0.16, 0.1, 1, 1.1, 0.6); S(m.torso, 0.09, 0xc8352e, 0, 0.36, 0.14, 1, 0.6, 0.5);
      S(m.head, 0.2, nv, 0, 0, 0); eyes(m.head, 0.02, 0.16, 0.085, 0.028, 0xdfe6ff); K(m.head, 0.035, 0.08, 0x111111, 0, -0.02, 0.22).rotation.x = Math.PI / 2;
      for (const [arm, s] of [[m.armL, -1], [m.armR, 1]]) { const w = CAP(arm, 0.06, 0.38, nv, s * 0.05, -0.18, -0.05); w.rotation.z = s * 0.35; w.scale.set(1, 1, 0.4); }
      for (const s of [-1, 1]) { const t = K(m.body, 0.04, 0.42, nv, s * 0.07, 0.1, -0.32); t.rotation.x = -1.9; t.rotation.z = s * 0.25; }
      limbs(m, { armR: 0.001, armL: 0.001, armC: nv, legR: 0.05, legLen: 0.18, legC: 0x1a1d38 });
      m.extra.wisp = true;
    },
    sayanosuke(m) {
      const lac = 0x2b1d1a, gold = L(0xd8b04a, { emissive: 0x3a2a00, emissiveIntensity: 0.4 });
      C(m.torso, 0.15, 0.17, 0.72, lac, 0, 0.3, 0);
      for (const y of [0.0, 0.32, 0.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.018, 6, 20), gold); r.rotation.x = Math.PI / 2; r.position.y = y; m.torso.add(r); }
      for (const s of [-1, 1]) S(m.torso, 0.035, 0xffc24a, s * 0.06, 0.48, 0.15, 1, 0.6, 0.4, { emissive: 0xffa020, emissiveIntensity: 1 });
      const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), gold); tsuba.position.y = 0.68; m.torso.add(tsuba);
      const wrap = GFX.tex(32, 64, (g, w, h) => { g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2420'; for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w, y + 8); g.lineTo(w / 2, y + 16); g.lineTo(0, y + 8); g.fill(); } });
      C(m.torso, 0.06, 0.07, 0.3, L(0xffffff, { map: wrap }), 0, 0.85, 0); C(m.torso, 0.075, 0.075, 0.04, gold, 0, 1.0, 0);
      limbs(m, { armR: 0.04, armL: 0.13, armC: lac, hand: 0.045, handC: 0xd8b04a, legR: 0.05, legLen: 0.12, legC: lac, foot: [0.1, 0.05, 0.14] });
      m.armL.position.y += 0.1; m.armR.position.y += 0.1;
    },
    taiko(m) {
      const brown = 0x7b4a2a;
      S(m.torso, 0.3, brown, 0, 0.24, 0, 1.05, 1, 0.95); S(m.torso, 0.2, 0xc8956a, 0, 0.22, 0.13, 1, 1.05, 0.6);
      S(m.head, 0.24, brown, 0, 0, 0); S(m.head, 0.11, 0xc8956a, 0, -0.06, 0.18, 1.2, 0.85, 0.8); S(m.head, 0.035, 0x1a1210, 0, -0.03, 0.27);
      for (const s of [-1, 1]) { S(m.head, 0.08, brown, s * 0.17, 0.18, -0.02); S(m.head, 0.045, 0xc8956a, s * 0.17, 0.18, 0.03, 1, 1, 0.5); }
      eyes(m.head, 0.04, 0.2, 0.09, 0.03);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.03, 6, 24), L(0xd23a3a)); band.rotation.x = Math.PI / 2; band.position.y = 0.08; m.head.add(band);
      for (const s of [-1, 1]) { const t = B(m.head, 0.04, 0.16, 0.02, 0xd23a3a, s * 0.05, 0.02, -0.25); t.rotation.z = s * 0.4; }
      const drum = G(m.torso, 0, 0.32, -0.28); m.extra.drum = drum;
      const tom = GFX.tex(64, 64, (g) => { g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#b8222a'; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.beginPath(); g.arc(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9, 8, 0, 7); g.fill(); } });
      const dr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 18), [L(0xa33a2a), L(0xffffff, { map: tom }), L(0xffffff, { map: tom })]); dr.rotation.z = Math.PI / 2; drum.add(dr);
      limbs(m, { armR: 0.075, armL: 0.13, armC: brown, hand: 0.07, legR: 0.08, legLen: 0.2, legC: brown });
      for (const arm of [m.armL, m.armR]) { const st = C(arm, 0.015, 0.02, 0.32, 0xe0c8a0, 0, -0.26, 0.1); st.rotation.x = 1.2; }
    },
    burikidon(m) {
      const tin = 0xb9c2c9;
      const label = GFX.tex(256, 64, (g, w, h) => { g.fillStyle = '#2f6fb5'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4); g.font = `30px ${GFX.FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ブリキ堂', w * 0.25, h / 2 + 2); g.fillText('ブリキ堂', w * 0.75, h / 2 + 2); });
      C(m.torso, 0.26, 0.26, 0.58, tin, 0, 0.28, 0, null, 20);
      const lb = C(m.torso, 0.265, 0.265, 0.22, L(0xffffff, { map: label }), 0, 0.2, 0, null, 20); lb.rotation.y = -Math.PI / 2;
      for (const y of [0.0, 0.57]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.015, 6, 22), L(0x8e979e)); r.rotation.x = Math.PI / 2; r.position.y = y; m.torso.add(r); }
      C(m.head, 0.28, 0.28, 0.04, 0x9aa3aa, 0, -0.18, 0, null, 20); C(m.head, 0.05, 0.05, 0.06, 0x9aa3aa, 0, -0.13, 0);
      for (const s of [-1, 1]) { S(m.torso, 0.065, 0xffffff, s * 0.1, 0.44, 0.22, 1, 1, 0.4); S(m.torso, 0.035, 0x16131a, s * 0.1, 0.44, 0.245, 1, 1, 0.4); }
      limbs(m, { armR: 0.05, armL: 0.12, armC: tin, hand: 0.06, handC: 0x8e979e, legR: 0.06, legLen: 0.16, legC: 0x8e979e, foot: [0.12, 0.05, 0.16] });
      m.head.position.y += 0.02;
    },
    norenbou(m) {
      const ind = 0x23407a;
      const crest = GFX.tex(64, 160, (g, w, h) => { g.fillStyle = '#23407a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f4efe2'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, 50, 18, 0, 7); g.stroke(); g.fillStyle = '#f4efe2'; g.fillRect(w / 2 - 3, 32, 6, 36); });
      const nm = L(0xffffff, { map: crest, side: THREE.DoubleSide });
      C(m.torso, 0.03, 0.03, 0.58, 0x6a4a2a, 0, 0.72, 0).rotation.z = Math.PI / 2;
      S(m.torso, 0.19, 0xf4e6cc, 0, 0.5, 0.02); eyes(m.torso, 0.52, 0.18, 0.07, 0.028); S(m.torso, 0.03, 0xd06a6a, 0, 0.44, 0.17, 1.4, 0.6, 0.5);
      const panels = G(m.torso, 0, 0.72, 0); m.extra.panels = panels;
      for (const [a, x] of [[0, -0.15], [0, 0.15], [Math.PI, -0.14], [Math.PI, 0.14], [Math.PI / 2, 0], [-Math.PI / 2, 0]]) {
        const pg = G(panels, 0, 0, 0); pg.rotation.y = a; const p = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.7), nm); p.position.set(x, -0.35, 0.21); pg.add(p);
      }
      limbs(m, { armR: 0.035, armL: 0.12, armC: 0xf4e6cc, hand: 0.04, handC: 0xf4e6cc, legR: 0.04, legLen: 0.12, legC: 0xf4e6cc, foot: [0.09, 0.04, 0.16], footC: 0x6a4a2a });
    },
    kemuridama(m) {
      const sv = 0x8f9aa3;
      S(m.torso, 0.3, sv, 0, 0.26, 0, 1, 0.78, 1); C(m.torso, 0.15, 0.17, 0.06, 0x7a848c, 0, 0.5, 0); S(m.torso, 0.04, 0x2a2a2a, 0, 0.55, 0);
      const sp = C(m.torso, 0.035, 0.06, 0.28, sv, 0, 0.28, 0.3); sp.rotation.x = 1.1; m.extra.spout = sp;
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 16, Math.PI), L(0x2a2a2a)); h.position.y = 0.48; m.torso.add(h);
      eyes(m.torso, 0.3, 0.27, 0.1, 0.035);
      m.head.position.y = 0.3;
      limbs(m, { armR: 0.035, armL: 0.1, armC: 0xeae6dc, hand: 0.045, handC: 0xeae6dc, legR: 0.04, legLen: 0.1, legC: 0x2a2a2a });
      m.extra.smoke = true;
    },
    momiji(m) {
      const robe = 0xc8452a;
      K(m.torso, 0.3, 0.6, robe, 0, 0.25, 0);
      const leaf = GFX.tex(64, 64, (g) => { g.fillStyle = '#ff8a2a'; g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; g.lineTo(32 + Math.cos(a) * 28, 34 + Math.sin(a) * 28); g.lineTo(32 + Math.cos(a + 0.27) * 12, 34 + Math.sin(a + 0.27) * 12); } g.lineTo(32, 60); g.closePath(); g.fill(); });
      const lm = L(0xffffff, { map: leaf, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, emissive: 0x401000, emissiveIntensity: 0.4 });
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), lm); p.position.set(Math.sin(a) * 0.2, 0.5, Math.cos(a) * 0.2); p.rotation.set(-0.9, a, 0); m.torso.add(p); }
      S(m.head, 0.18, 0xf2d0a8, 0, 0, 0); const beard = K(m.head, 0.13, 0.28, 0xf6f2ea, 0, -0.18, 0.08); beard.rotation.x = Math.PI;
      for (const s of [-1, 1]) B(m.head, 0.09, 0.025, 0.03, 0xf6f2ea, s * 0.07, 0.06, 0.16).rotation.z = s * 0.25;
      eyes(m.head, 0.02, 0.15, 0.07, 0.022);
      limbs(m, { armR: 0.045, armL: 0.13, armC: robe, hand: 0.045, handC: 0xf2d0a8, legR: 0.045, legLen: 0.08, legC: 0x5a2a1a });
      const staff = G(m.armR, 0, -0.18, 0.05); C(staff, 0.02, 0.025, 1.0, 0x6a4a2a, 0, 0.2, 0); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), lm); p.position.set(Math.sin(i) * 0.06, 0.72, Math.cos(i) * 0.06); p.rotation.y = i; staff.add(p); }
      m.extra.prop = staff;
    },
  };
  const DIMS = { // 1単位あたりの仮の骨格
    kogemaru: { legH: 0.2, headY: 0.72, shX: 0.25, shY: 0.5, hipX: 0.12 }, hoshisuzume: { legH: 0.18, headY: 0.7, shX: 0.27, shY: 0.48, hipX: 0.08 },
    akaneten: { legH: 0.2, headY: 0.74, shX: 0.17, shY: 0.52, hipX: 0.09 }, kagetsubame: { legH: 0.18, headY: 0.72, shX: 0.22, shY: 0.52, hipX: 0.07 },
    sayanosuke: { legH: 0.12, headY: 0.9, shX: 0.19, shY: 0.6, hipX: 0.08 }, taiko: { legH: 0.2, headY: 0.74, shX: 0.29, shY: 0.52, hipX: 0.13 },
    burikidon: { legH: 0.16, headY: 0.92, shX: 0.29, shY: 0.6, hipX: 0.12 }, norenbou: { legH: 0.12, headY: 0.8, shX: 0.17, shY: 0.6, hipX: 0.08 },
    kemuridama: { legH: 0.1, headY: 0.6, shX: 0.3, shY: 0.4, hipX: 0.12 }, momiji: { legH: 0.08, headY: 0.84, shX: 0.2, shY: 0.6, hipX: 0.08 },
  };
  GFX.makeChar = (c) => {
    const d = DIMS[c.id], m = biped(d); BUILDERS[c.id](m);
    m.root.scale.setScalar(c.h); m.c = c; m.h = c.h; m.d = d;
    m.shadow = GFX.blob(0.45 * c.h); m.shadow.position.y = 0.02;
    m.mats = []; m.root.traverse(o => { if (o.material && !Array.isArray(o.material)) { o.material = o.material.clone(); o.material.transparent = true; m.mats.push(o.material); } });
    // ため・必殺の光
    const gt = GFX._glowT || (GFX._glowT = GFX.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
    m.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); m.glow.visible = false; m.root.add(m.glow);
    m.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false })); m.shield.visible = false; m.root.add(m.shield); m.shield.position.y = 0.5;
    m.ghost = null;
    return m;
  };
  const lerp = (a, b, k) => a + (b - a) * k, sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
  /** 状態からポーズを作る（スナップショットの行動と経過時間だけで決まる） */
  GFX.animChar = (m, a, T, dt, opts) => {
    const r = m.root, d = m.d;
    r.position.set(a.x, 0, a.z); r.rotation.set(0, a.yaw, 0);
    m.shadow.position.set(a.x, 0.02, a.z);
    const P = { bodyY: d.legH, lean: 0, tw: 0, aLx: 0, aLz: 0, aRx: 0, aRz: 0, lL: 0, lR: 0, hx: 0, hz: 0, roll: 0, sc: 1 };
    const t = a.actT || 0, act = a.act;
    m.walkPh = (m.walkPh || 0) + (a.moving ? dt * (a.dash ? 15 : 10) : 0);
    if (a.st === 'down' || a.st === 'gone') {
      r.rotation.x = -Math.PI / 2 * 0.95; r.position.y = 0.12 * m.h; P.aLz = -1.2; P.aRz = 1.2;
      m.shield.visible = false; m.glow.visible = false;
      apply(m, P); setAlpha(m, a.st === 'gone' ? 0.0 : 0.85); m.shadow.visible = a.st !== 'gone';
      return;
    }
    m.shadow.visible = true;
    const sw = Math.sin(m.walkPh);
    if (a.moving && (!act || act === 'charge' || act === 'shot')) { P.lL = sw * 0.75; P.lR = -sw * 0.75; P.aLx = -sw * 0.5; P.aRx = sw * 0.5; P.bodyY += Math.abs(Math.cos(m.walkPh)) * 0.035; P.lean = a.dash ? 0.28 : 0.1; }
    else { P.bodyY += Math.sin(T * 3 + a.slot) * 0.012; P.aLz = -0.12; P.aRz = 0.12; }
    m.glow.visible = false; m.shield.visible = !!(a.guard || (a.inv && act === 'cast'));
    switch (act) {
      case 'combo': { const H = [0.15, 0.45, 0.85]; const i = t < 0.3 ? 0 : t < 0.65 ? 1 : 2; const k = sat(1 - Math.abs(t - H[i]) / 0.14); if (i === 0) P.aRx = -1.6 * k - 0.2; else if (i === 1) P.aLx = -1.6 * k - 0.2; else { P.aRx = P.aLx = -1.5 * k; P.lean = 0.25 * k; P.lR = -0.6 * k; } P.tw = (i === 1 ? 0.35 : -0.35) * k; P.lean += 0.12; break; }
      case 'melee': { const k = sat(1 - Math.abs(t - 0.2) / 0.16); P.aRx = -1.7 * k; P.tw = -0.3 * k; P.lean = 0.2 * k; break; }
      case 'shot': { const k = sat(1 - t / 0.35); P.aRx = -1.5; P.aLx = -0.4; P.lean = -0.08 * k; break; }
      case 'charge': { const c = a.chg; P.bodyY -= 0.04 + 0.03 * c; P.aRx = -1.2; P.aLx = -1.2; P.lean = 0.1; m.glow.visible = true; m.glow.material.color.set(m.c.id === 'momiji' ? 0x7dff9a : m.c.id === 'akaneten' ? 0xff7a3a : 0xffd070); const s = 0.25 + c * 0.45 + (c >= 1 ? Math.sin(T * 30) * 0.05 : 0); m.glow.scale.set(s, s, 1); m.glow.position.set(0, 0.45, 0.35); break; }
      case 'release': { const k = sat(1 - Math.abs(t - 0.15) / 0.2); P.aRx = -1.8 * k - 0.3; P.aLx = -1.4 * k; P.lean = 0.3 * k; break; }
      case 'dodge': { const k = sat(t / 0.32); P.roll = k * Math.PI * 2; P.bodyY -= 0.12 * Math.sin(k * Math.PI); P.aLx = P.aRx = -1.0; break; }
      case 'retreat': { const k = sat(1 - Math.abs(t - 0.12) / 0.12); P.aRx = -1.8 * k; P.aRz = 0.6 * k; P.lean = t > 0.15 ? -0.25 : 0.2; break; }
      case 'cast': case 'stealth': P.aLz = -1.6; P.aRz = 1.6; P.bodyY += 0.03; break;
      case 'parry': P.aLx = -1.3; P.aRx = -1.3; P.aLz = 0.6; P.aRz = -0.6; P.lean = -0.05; break;
      case 'counter': { const k = sat(1 - t / 0.3); P.aRx = -2.0 * k; P.tw = -0.6 * k; P.lean = 0.3 * k; break; }
      case 'heavy': { if (t < 1.1) { const k = sat(t / 0.6); P.aLx = P.aRx = -2.8 * k; P.lean = -0.25 * k; P.bodyY += 0.03 * k; } else { const k = sat((t - 1.1) / 0.12); P.aLx = P.aRx = lerp(-2.8, -0.6, k); P.lean = lerp(-0.25, 0.45, k); P.bodyY -= 0.06 * k; } break; }
      case 'guard': P.aLx = -1.4; P.aRx = -1.4; P.aLz = 0.5; P.aRz = -0.5; P.bodyY -= 0.03; if (m.extra.panels) m.extra.panels.scale.set(1.4, 1, 1.4); break;
      case 'taunt': { const k = sat(1 - Math.abs(t - 0.22) / 0.18); P.aRx = -1.6 * k; P.aLz = -1.0 - Math.sin(T * 14) * 0.3; break; }
      case 'item': P.aRx = -2.2; P.hx = -0.2; break;
      case 'stagger': P.lean = -0.4; P.aLz = -0.9; P.aRz = 0.9; break;
      case 'sp': GFX.spPose(m, a, P, t, T); break;
    }
    if (act !== 'guard' && m.extra.panels) m.extra.panels.scale.set(1, 1, 1);
    if (m.extra.tail) m.extra.tail.rotation.y = Math.sin(T * 4 + a.slot) * 0.35;
    if (m.extra.charms) { m.extra.charms.rotation.y = T * 2.4; }
    if (m.extra.star) m.extra.star.rotation.y = T * 2;
    if (m.extra.panels) m.extra.panels.children.forEach((p, i) => p.rotation.x = Math.sin(T * 3 + i) * 0.08 + (a.moving ? -0.25 : 0));
    if (a.hurt) P.lean -= 0.12;
    apply(m, P);
    // 透明度（隠密）・被弾の赤
    const alpha = a.stealth ? (opts && opts.me ? 0.5 : 0.32) : 1;
    setAlpha(m, alpha);
    const hurtK = a.hurt ? 0.6 : 0;
    if (m._hurtK !== hurtK) { m._hurtK = hurtK; for (const mt of m.mats) { if (!mt._e0) mt._e0 = mt.emissive ? mt.emissive.clone() : null; if (mt.emissive) { if (hurtK) mt.emissive.setRGB(0.8, 0.1, 0.1); else mt.emissive.copy(mt._e0); } } }
    if (m.extra.glow) { const on = a.sp >= 100; for (const g of m.extra.glow) if (g.material.emissive) g.material.emissiveIntensity = on ? 1.6 + Math.sin(T * 10) * 0.4 : 0.9; }
    if (a.defBuff) m.shield.visible = true;
    if (m.shield.visible) { m.shield.rotation.y = T; m.shield.material.color.set(a.reflect ? 0x9ac8ff : a.guard ? 0x7fd0ff : a.defBuff ? 0xffd27a : 0xbfffcf); }
  };
  function apply(m, P) {
    m.body.position.y = P.bodyY; m.body.rotation.set(P.lean, P.tw, 0);
    if (P.roll) m.body.rotation.x = P.roll;
    m.armL.rotation.set(P.aLx, 0, P.aLz); m.armR.rotation.set(P.aRx, 0, P.aRz);
    m.legL.rotation.x = P.lL; m.legR.rotation.x = P.lR; m.head.rotation.set(P.hx, 0, P.hz);
  }
  function setAlpha(m, a) { if (m._alpha === a) return; m._alpha = a; for (const mt of m.mats) { mt.opacity = a; mt.depthWrite = a > 0.95; } }
  /** 必殺のポーズ（見た目のみ。命中回数と時刻は sim が決める） */
  GFX.spPose = (m, a, P, t, T) => {
    const id = m.c.id, S = DATA.SPECIALS[m.c.sp];
    const prep = S.prep, k0 = sat(t / prep);
    m.glow.visible = true; m.glow.position.set(0, 0.5, 0.3);
    const gc = { kogemaru: 0xff7a2a, hoshisuzume: 0xffe27a, akaneten: 0xff5a2a, kagetsubame: 0x8aa0ff, sayanosuke: 0xfff0c0, taiko: 0xff4a4a, burikidon: 0x9ad0ff, norenbou: 0xc0d8ff, kemuridama: 0xd8d8d8, momiji: 0x9aff8a }[id];
    m.glow.material.color.set(gc); const gs = 0.4 + k0 * 0.8; m.glow.scale.set(gs, gs, 1);
    if (t < prep) { P.bodyY += 0.05 * k0; P.aLz = -1.2 * k0; P.aRz = 1.2 * k0; P.lean = -0.1 * k0; return; }
    const tt = t - prep;
    switch (S.type) {
      case 'multi': {
        const iv = S.iv || 0.2, ph = (tt % iv) / iv, n = Math.floor(tt / (iv || 1));
        if (id === 'sayanosuke') { const k = sat(tt / 0.12); P.aRx = lerp(-2.6, -0.3, k); P.tw = -0.8 * k; P.lean = 0.4 * k; break; }
        if (id === 'hoshisuzume') { P.aRx = -1.5; P.aLx = -1.5; P.lean = -0.1 + Math.sin(ph * Math.PI) * 0.05; break; }
        if (id === 'akaneten' || id === 'kemuridama') { P.aLx = P.aRx = -1.6; P.lean = 0.15 + Math.sin(ph * Math.PI) * 0.1; break; }
        const right = n % 2 === 0, k = Math.sin(ph * Math.PI);
        if (right) P.aRx = -1.8 * k - 0.2; else P.aLx = -1.8 * k - 0.2; P.tw = (right ? -0.4 : 0.4) * k; P.lean = 0.25; break;
      }
      case 'buff': P.aLx = P.aRx = -2.6 + Math.abs(Math.sin(tt * 18)) * 1.4; break;
      case 'guardup': P.aLz = -1.4; P.aRz = 1.4; m.shield.visible = true; m.shield.scale.setScalar(1 + sat(tt / 0.3) * 0.6); break;
      case 'heal': P.aLz = -2.2; P.aRz = 2.2; P.bodyY += 0.06; break;
    }
  };

  /* ---------- トバトーバン ---------- */
  GFX.makeBoss = () => {
    const wood = 0x8a5a36, woodD = 0x5c3a22, iron = 0x3a3a42, paper = 0xf3e6c8;
    const root = G(null), body = G(root, 0, 2.6, 0);
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = G(body, s * 0.62, 0, 0), knee = G(hip, 0, -1.0, 0), foot = G(knee, 0, -1.6, 0);
      B(hip, 0.62, 1.05, 0.62, woodD, 0, -0.5, 0); B(knee, 0.72, 1.6, 0.72, wood, 0, -0.8, 0);
      for (const y of [-0.3, -1.2]) B(knee, 0.76, 0.08, 0.76, iron, 0, y, 0);
      B(foot, 0.95, 0.12, 1.15, woodD, 0, 0.06, 0.08);
      const wheel = G(foot, s * 0.55, 0.26, 0.05); const wh = C(wheel, 0.3, 0.3, 0.12, wood, 0, 0, 0, null, 16); wh.rotation.z = Math.PI / 2; for (let i = 0; i < 4; i++) { const sp = B(wheel, 0.06, 0.04, 0.56, iron, 0, 0, 0); sp.rotation.x = i * Math.PI / 4; }
      legs.push({ hip, knee, foot, wheel });
    }
    const waist = G(body, 0, 0, 0);
    B(waist, 2.0, 0.35, 1.4, woodD, 0, 0.175, 0);
    const portM = L(0xffb45a, { emissive: 0xff8a20, emissiveIntensity: 0.3 });
    const ports = [];
    for (const [x, z] of [[-0.55, 0.71], [0, 0.71], [0.55, 0.71], [-1.01, 0], [1.01, 0]]) { const p = C(waist, 0.12, 0.12, 0.05, portM, x, 0.18, z, null, 14); p.rotation.x = Math.PI / 2; if (Math.abs(x) > 1) p.rotation.set(0, 0, Math.PI / 2); ports.push(p); }
    const torso = G(waist, 0, 0.35, 0);
    const chestT = GFX.tex(512, 220, (g, w, h) => {
      g.fillStyle = '#2a1a12'; g.fillRect(0, 0, w, h); g.fillStyle = '#f1e2c2'; g.fillRect(18, 18, w - 36, h - 36);
      g.strokeStyle = '#8a2b1f'; g.lineWidth = 8; g.strokeRect(34, 34, w - 68, h - 68);
      g.fillStyle = '#b8222a'; g.font = `34px ${GFX.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('大売出し', w / 2, 62);
      g.fillStyle = '#1e1a18'; g.font = `68px ${GFX.FONT_DISP}`; g.fillText('トバトーバン', w / 2, 122, w - 80);
      g.fillStyle = '#8a2b1f'; g.font = `24px ${GFX.FONT_SIGN}`; g.fillText('千住よいまち 商売繁盛', w / 2, 172);
    });
    const chestM = L(0xffffff, { map: chestT, emissive: 0xffffff, emissiveMap: chestT, emissiveIntensity: 0.0 });
    const frame = L(woodD);
    B(torso, 2.7, 1.15, 0.55, [frame, frame, frame, frame, chestM, frame], 0, 0.575, 0);
    for (const y of [0.02, 1.13]) B(torso, 2.85, 0.1, 0.62, iron, 0, y, 0);
    // しめ縄と紙垂（背中）
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 20), L(0xd9c08a)); rope.position.set(0, 0.6, -0.42); torso.add(rope);
    const back = G(torso, 0, 0.6, -0.5);
    const shide = GFX.tex(32, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 0); g.lineTo(32, 16); g.lineTo(8, 16); g.lineTo(8, 32); g.lineTo(32, 32); g.lineTo(32, 48); g.lineTo(8, 48); g.lineTo(8, 64); g.lineTo(0, 64); g.fill(); });
    const shM = L(0xffffff, { map: shide, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const streamers = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.5), shM); p.position.set(Math.cos(a) * 0.6, Math.sin(a) * 0.6 - 0.25, -0.05); back.add(p); streamers.push(p); }
    const ropeTail = G(back, 0, -0.6, 0); B(ropeTail, 0.18, 0.9, 0.18, 0xd9c08a, 0, -0.45, 0); // 振り回す縄
    // 腕（看板柱）
    const armT = (w) => GFX.tex(64, 256, (g, W, H) => { g.fillStyle = '#efe0bd'; g.fillRect(0, 0, W, H); g.strokeStyle = '#6b3a20'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6); GFX.vtext(g, w, W / 2, 50, 46, 52, GFX.FONT_SIGN, '#8a1f1a'); });
    const arms = [];
    for (const [s, w] of [[-1, '招福'], [1, '繁盛']]) {
      const sh = G(torso, s * 1.42, 0.95, 0); const el = G(sh, 0, -1.0, 0);
      const am = L(0xffffff, { map: armT(w) });
      B(sh, 0.5, 1.1, 0.42, [frame, frame, frame, frame, am, am], 0, -0.5, 0);
      B(el, 0.48, 1.0, 0.4, [frame, frame, frame, frame, am, am], 0, -0.45, 0);
      B(el, 0.62, 0.42, 0.55, woodD, 0, -1.05, 0.04);
      S(sh, 0.3, iron, 0, 0.02, 0);
      arms.push({ sh, el });
    }
    // 頭（提灯の顔）
    const head = G(torso, 0, 1.15, 0);
    const faceT = GFX.tex(512, 256, (g, w, h) => {
      g.fillStyle = '#ffe9c0'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(150,90,40,.35)'; g.lineWidth = 3; for (let y = 12; y < h; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#2a1410'; for (const x of [w * 0.44, w * 0.56]) { g.beginPath(); g.ellipse(x, h * 0.42, 18, 26, 0, 0, 7); g.fill(); g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(x + 5, h * 0.38, 6, 0, 7); g.fill(); g.fillStyle = '#2a1410'; }
      g.beginPath(); g.moveTo(w * 0.42, h * 0.62); g.quadraticCurveTo(w * 0.5, h * 0.78, w * 0.58, h * 0.62); g.lineWidth = 8; g.strokeStyle = '#2a1410'; g.stroke();
      g.fillStyle = 'rgba(210,50,40,.6)'; for (const x of [w * 0.38, w * 0.62]) { g.beginPath(); g.ellipse(x, h * 0.6, 16, 9, 0, 0, 7); g.fill(); }
    });
    const lantM = L(0xffffff, { map: faceT, emissive: 0xffb050, emissiveMap: faceT, emissiveIntensity: 0.25 });
    const lant = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), lantM); lant.scale.set(1.05, 0.82, 1.05); lant.position.y = 0.45; head.add(lant); lant.rotation.y = -Math.PI / 2;
    C(head, 0.33, 0.37, 0.08, 0x1c1814, 0, 0.04, 0); C(head, 0.37, 0.33, 0.08, 0x1c1814, 0, 0.86, 0);
    const shadow = GFX.blob(2.0); shadow.position.y = 0.025;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.x = Math.PI / 2; beam.visible = false; root.add(beam);
    const mats = []; root.traverse(o => { if (o.material && !Array.isArray(o.material)) mats.push(o.material); });
    return { root, body, waist, torso, head, legs, arms, ports, portM, chestM, lantM, rope, ropeTail, streamers, shadow, beam, back, mats };
  };
  GFX.animBoss = (m, b, T, dt, v) => {
    const r = m.root;
    r.position.set(b.x, b.y, b.z); r.rotation.set(0, b.yaw, 0);
    m.shadow.position.set(b.x, 0.025, b.z); const sh = 1 - Math.min(0.5, b.y / 6); m.shadow.scale.setScalar(sh);
    const t = b.t || 0, M = b.mv ? DATA.BMOVES[b.mv] : null;
    let lean = 0, twist = 0, bodyY = 2.6, kneeL = 0, kneeR = 0, hipL = 0, hipR = 0, aL = [0, 0, 0], aR = [0, 0, 0], headX = 0;
    let chest = 0, lant = 0.25, port = 0.3;
    const walk = b.st === 'walk'; m.walkPh = (m.walkPh || 0) + (walk ? dt * 3.2 : 0);
    if (walk) { const s = Math.sin(m.walkPh); hipL = s * 0.35; hipR = -s * 0.35; kneeL = Math.max(0, -s) * 0.4; kneeR = Math.max(0, s) * 0.4; bodyY += Math.abs(Math.cos(m.walkPh)) * 0.08; aL[0] = -s * 0.15; aR[0] = s * 0.15; }
    else { bodyY += Math.sin(T * 1.6) * 0.03; aL[2] = -0.08; aR[2] = 0.08; }
    const st = b.st, ph = st === 'wind' ? 'w' : st === 'act' ? 'a' : st === 'rec' ? 'r' : '';
    if (ph && b.mv) {
      const kw = ph === 'w' ? Math.min(1, t / M.wind) : 1;
      switch (b.mv) {
        case 'fubuki': { const k = ph === 'w' ? kw : ph === 'a' ? 1 : Math.max(0, 1 - t / 0.4); aL = [-1.2 * k, 0, -0.9 * k]; aR = [-1.2 * k, 0, 0.9 * k]; if (ph === 'a') { aL[1] = Math.sin(T * 30) * 0.08; aR[1] = -aL[1]; } break; }
        case 'shime': { const k = ph === 'w' ? kw : 0; twist = ph === 'w' ? 0.7 * k : ph === 'a' ? 0.7 - Math.min(1, t / 0.4) * 2.6 : -1.9 * Math.max(0, 1 - t / 0.6); m.ropeTail.rotation.x = ph === 'a' ? -1.2 : -0.2; break; }
        case 'otoshi': { port = ph === 'w' ? 0.3 + kw * 1.5 : 0.6; lean = -0.15 * (ph === 'w' ? kw : 1); aL[2] = -0.6; aR[2] = 0.6; break; }
        case 'kousen': { chest = ph === 'w' ? kw : ph === 'a' ? 1 : Math.max(0, 1 - t / 0.5); lean = -0.12 * chest; aL[2] = -0.5 * chest; aR[2] = 0.5 * chest; break; }
        case 'harite': { if (ph === 'w') { aR = [0.9 * kw, 0, 0.3]; twist = 0.35 * kw; lean = -0.1 * kw; } else if (ph === 'a') { aR = [-1.7, 0, 0]; twist = -0.35; lean = 0.35; } else { const k = Math.max(0, 1 - t / 0.9); aR = [-1.7 * k, 0, 0]; lean = 0.35 * k; twist = -0.35 * k; } break; }
        case 'zouen': { const k = ph === 'w' ? Math.abs(Math.sin(t * 10)) : 0; aL = [-1.4, 0, 0.5 * k]; aR = [-1.4, 0, -0.5 * k]; break; }
      }
    }
    if (st === 'fly' && b.fl) {
      const f = b.fl, k = f.ph === 'rise' ? Math.min(1, f.t / DATA.BMOVES.junkou.wind) : f.ph === 'land' ? 1 - Math.min(1, f.t / 0.6) : 1;
      lean = 1.25 * k; hipL = hipR = 1.0 * k; kneeL = kneeR = 0.6 * k; aL = [-2.6 * k, 0, 0.2]; aR = [-2.6 * k, 0, -0.2]; headX = -0.9 * k; port = 1.2;
    }
    if (st === 'down') { bodyY = 1.75 + Math.sin(T * 2) * 0.02; kneeL = kneeR = 1.3; hipL = hipR = -1.0; lean = 0.35; headX = 0.4; aL = [0, 0, -0.3]; aR = [0, 0, 0.3]; lant = 0.08; }
    if (st === 'stun') { bodyY += Math.sin(T * 40) * 0.03; twist = Math.sin(T * 25) * 0.05; lant = 0.1 + Math.random() * 0.2; }
    if (st === 'dead') { const k = Math.min(1, t / 1.6); bodyY = 2.6 - 1.7 * k; lean = 0.6 * k; headX = 0.8 * k; kneeL = kneeR = 1.4 * k; hipL = hipR = -1.0 * k; lant = 0.25 * (1 - k); aL = [0, 0, -1.2 * k]; aR = [0, 0, 1.2 * k]; }
    if (st === 'intro') { GFX.bossIntroPose(m, b, v); return; }
    m.body.position.y = bodyY; m.waist.rotation.set(lean, twist, 0); m.head.rotation.x = headX;
    m.legs[0].hip.rotation.x = hipL; m.legs[1].hip.rotation.x = hipR; m.legs[0].knee.rotation.x = kneeL; m.legs[1].knee.rotation.x = kneeR;
    m.legs[0].foot.rotation.x = -(hipL + kneeL) * (st === 'fly' ? 0 : 0.6); m.legs[1].foot.rotation.x = -(hipR + kneeR) * (st === 'fly' ? 0 : 0.6);
    for (const l of m.legs) l.wheel.rotation.x = m.walkPh * 1.5;
    m.arms[0].sh.rotation.set(aL[0], aL[1], aL[2]); m.arms[1].sh.rotation.set(aR[0], aR[1], aR[2]); m.arms[0].el.rotation.x = Math.min(0, aL[0]) * 0.3; m.arms[1].el.rotation.x = Math.min(0, aR[0]) * 0.3;
    m.chestM.emissiveIntensity = chest * 0.9; m.lantM.emissiveIntensity = lant + (b.phase === 2 ? 0.25 + Math.sin(T * 8) * 0.1 : 0); m.portM.emissiveIntensity = port;
    m.streamers.forEach((p, i) => { p.rotation.z = Math.sin(T * 3 + i) * 0.25; p.rotation.x = st === 'fly' ? -1 : 0; });
    if (st !== 'wind' || b.mv !== 'shime') m.ropeTail.rotation.x = Math.sin(T * 2) * 0.1 + (st === 'fly' ? -1.2 : 0);
  };
  /** 登場演出（4.5秒・オリジナル案）：右足→左足→手を添えて起き上がり→腕を開く→提灯点灯 */
  GFX.bossIntroPose = (m, b, v) => {
    const t = v.introWait ? 0 : v.stageT;
    const k = (a, d) => sat((t - a) / d);
    const r = m.root;
    const asm = k(0, 1.0); // 小看板が集まる
    r.visible = t > 0.75;
    const dropR = k(0.9, 0.35), dropL = k(1.4, 0.35), rise = k(2.0, 0.9), arm = k(2.4, 0.8), open = k(3.0, 0.6), light = k(3.3, 0.6);
    r.position.y = (1 - dropR) * 3.0;
    m.legs[1].hip.rotation.x = -0.6 * (1 - dropR); m.legs[0].hip.rotation.x = 0.5 * (1 - dropL) - 0.2 * dropL;
    m.legs[0].knee.rotation.x = 0.8 * (1 - rise); m.legs[1].knee.rotation.x = 0.8 * (1 - rise);
    m.body.position.y = 1.9 + 0.7 * rise; m.waist.rotation.set(0.5 * (1 - rise), 0, 0);
    m.arms[0].sh.rotation.set(-0.6 * (1 - arm), 0, -1.0 * open); m.arms[1].sh.rotation.set(-1.4 * arm * (1 - open) , 0, 1.0 * open);
    m.head.rotation.x = 0.4 * (1 - rise);
    m.lantM.emissiveIntensity = 0.05 + light * 0.6; m.chestM.emissiveIntensity = light * 0.7 * (t < 4.2 ? 1 : 0.4);
    m.shadow.scale.setScalar(0.5 + 0.5 * dropR);
  };

  /* ---------- 札小僧 ---------- */
  GFX.makeMob = () => {
    const root = G(null), body = G(root, 0, 0.22, 0);
    const fT = GFX._fudaT || (GFX._fudaT = GFX.tex(64, 128, (g, w, h) => { g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c0392b'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10); GFX.vtext(g, '大売出', w / 2, 32, 30, 32, GFX.FONT_SIGN, '#c0392b'); }));
    const fm = L(0xffffff, { map: fT });
    B(body, 0.36, 0.5, 0.06, [L(0xe8e0cc), L(0xe8e0cc), L(0xe8e0cc), L(0xe8e0cc), fm, fm], 0, 0.25, 0);
    const head = G(body, 0, 0.58, 0); K(head, 0.14, 0.2, 0xf1ead8, 0, 0, 0); S(head, 0.1, 0xf1ead8, 0, -0.04, 0); eyes(head, -0.03, 0.08, 0.04, 0.02);
    const armL = G(body, -0.21, 0.4, 0), armR = G(body, 0.21, 0.4, 0);
    B(armL, 0.05, 0.22, 0.03, 0xf1ead8, 0, -0.1, 0); B(armR, 0.05, 0.22, 0.03, 0xf1ead8, 0, -0.1, 0);
    const legL = G(body, -0.08, 0, 0), legR = G(body, 0.08, 0, 0); B(legL, 0.05, 0.22, 0.04, 0x3a3a3a, 0, -0.1, 0); B(legR, 0.05, 0.22, 0.04, 0x3a3a3a, 0, -0.1, 0);
    root.scale.setScalar(DATA.MOB.height / 0.85);
    const shadow = GFX.blob(0.35);
    const mats = []; root.traverse(o => { if (o.material && !Array.isArray(o.material)) { o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } });
    return { root, body, head, armL, armR, legL, legR, shadow, mats };
  };
  GFX.animMob = (m, e, T, dt) => {
    m.root.position.set(e.x, 0, e.z); m.root.rotation.y = e.yaw; m.shadow.position.set(e.x, 0.02, e.z);
    const hop = Math.abs(Math.sin(T * 8 + e.id.length));
    m.body.position.y = 0.22 + (e.para ? 0 : hop * 0.12); m.body.rotation.x = e.wind ? -0.35 : 0;
    m.armL.rotation.z = -0.4 - hop * 0.3; m.armR.rotation.z = e.wind ? 2.4 : 0.4 + hop * 0.3;
    if (e.para) m.body.rotation.z = Math.sin(T * 40) * 0.1;
    if (e.dying) { m.root.rotation.y += T * 10; const s = Math.max(0.01, m.root.scale.x * 0.92); m.root.scale.setScalar(s); }
  };
})();
