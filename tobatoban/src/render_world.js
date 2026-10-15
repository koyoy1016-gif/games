/* =====================================================================
   render_world.js — 北千住駅前アーケード通り（車なし）と祭り広場
   写真の構図（両側の緑の鉄骨アーケード・ガラス屋根、中高層ビル、正面の駅ビルと
   ペデストリアンデッキ）を参考に、道路や店舗は架空に再構成している。
   ===================================================================== */
/** 論理画面（横向き固定のとき縦の端末では幅と高さが入れ替わる） */
const VIEW = { w: typeof innerWidth !== 'undefined' ? innerWidth : 844, h: typeof innerHeight !== 'undefined' ? innerHeight : 390, rot: 0 };
const GFX = {};
(() => {
  const V3 = THREE.Vector3;
  GFX.FONT_SIGN = '"Yuji Syuku","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  GFX.FONT_UI = '"Zen Maru Gothic","Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif';
  GFX.FONT_DISP = '"Dela Gothic One","Hiragino Sans","Noto Sans JP",sans-serif';
  GFX.lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  GFX.bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  GFX.tex = (w, h, draw, rep) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  GFX.mesh = (parent, geo, mat, x, y, z, ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (ry) m.rotation.y = ry; if (parent) parent.add(m); return m; };
  /** 同じ材質の静的ジオメトリをまとめて描画回数を減らす */
  GFX.merge = (items) => {
    const pos = [], nor = [], uv = []; const m3 = new THREE.Matrix3();
    for (const { geo, m } of items) {
      const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv; m3.getNormalMatrix(m);
      const v = new V3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
        if (n) { v.fromBufferAttribute(n, i).applyMatrix3(m3).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0);
        if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
      }
    }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return out;
  };
  GFX.M = (x, y, z, ry, rx, rz, sx, sy, sz) => { const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); o.scale.set(sx || 1, sy || sx || 1, sz || sx || 1); o.updateMatrix(); return o.matrix.clone(); };
  const rnd = (() => { let s = 20261015; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  GFX.rnd = rnd;

  /* ---------- 文字入りテクスチャ ---------- */
  function vtext(g, txt, x, y, size, step, font, col) { g.fillStyle = col; g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; [...txt].forEach((ch, i) => g.fillText(ch, x, y + i * step)); }
  GFX.vtext = vtext;
  const SHOPS = [
    { n: '千住ころも屋', kind: 'cloth', bg: '#2d3f6b', fg: '#f6ecd8' }, { n: '宵町文具', kind: 'shop', bg: '#f2e6c8', fg: '#8a2b1f' }, { n: 'まる福惣菜', kind: 'deli', bg: '#b8322a', fg: '#fff3dc' },
    { n: '喫茶 ほしづき', kind: 'cafe', bg: '#3b2a22', fg: '#f3d48a' }, { n: '大黒ふとん店', kind: 'shutter', bg: '#e9e1cf', fg: '#253a6e' }, { n: '鳥えん', kind: 'yaki', bg: '#1f1a17', fg: '#ff9b3d' },
    { n: 'くすり さくら堂', kind: 'shop', bg: '#f5f5f2', fg: '#1e7a46' }, { n: '古書 宿場堂', kind: 'shutter', bg: '#5a4632', fg: '#f2e2c0' }, { n: '和菓子 月見屋', kind: 'cafe', bg: '#efe4d0', fg: '#6b2c4a' },
    { n: 'めがねの光堂', kind: 'shop', bg: '#ffffff', fg: '#244c9a' }, { n: 'たい焼き 千寿', kind: 'deli', bg: '#a8432a', fg: '#ffe9b8' }, { n: '青物 かどや', kind: 'veg', bg: '#2f6b3a', fg: '#fff6d8' },
    { n: '金物の丸善', kind: 'shutter', bg: '#d9d4c7', fg: '#333' }, { n: 'お茶の 松葉園', kind: 'shop', bg: '#2e5a3a', fg: '#f4ead2' }, { n: '洋食 キッチン宿場', kind: 'cafe', bg: '#7a2a20', fg: '#fff' },
    { n: '履物 いせや', kind: 'shop', bg: '#e8d9b5', fg: '#4b2a12' }, { n: '花の 千草', kind: 'veg', bg: '#f3d7de', fg: '#8b2244' }, { n: '時計 宵屋', kind: 'shutter', bg: '#1c2a44', fg: '#e6c26b' },
    { n: '豆腐 白梅', kind: 'deli', bg: '#f7f3e8', fg: '#2a2a2a' }, { n: 'おもちゃの ふくろう堂', kind: 'shop', bg: '#f4c430', fg: '#7a1f12' }, { n: 'そば処 千住庵', kind: 'yaki', bg: '#2a2219', fg: '#f2e2c0' },
    { n: 'クリーニング 白波', kind: 'shop', bg: '#e8f1f8', fg: '#1f5c9a' }, { n: '酒の 宿場屋', kind: 'shutter', bg: '#3a2416', fg: '#f0c674' }, { n: '鮮魚 魚千', kind: 'veg', bg: '#1d4c7a', fg: '#fff' },
  ];
  GFX.SHOPS = SHOPS;
  function shopFront(s, w) {
    return GFX.tex(512, 320, (g, W, H) => {
      // 看板
      g.fillStyle = s.bg; g.fillRect(0, 0, W, 78); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 72, W, 6);
      g.fillStyle = s.fg; g.font = `52px ${GFX.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.n, W / 2, 40, W - 30);
      const y0 = 78;
      if (s.kind === 'shutter') { // 閉じかけたシャッター
        g.fillStyle = '#ffd9a0'; g.fillRect(0, y0, W, H - y0); g.fillStyle = '#c9c4ba'; g.fillRect(0, y0, W, (H - y0) * 0.72);
        g.strokeStyle = '#9c978d'; g.lineWidth = 3; for (let y = y0 + 8; y < y0 + (H - y0) * 0.72; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        g.fillStyle = '#7d786f'; g.fillRect(0, y0 + (H - y0) * 0.72 - 6, W, 6);
        return;
      }
      // 店内の明かり
      const gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, '#fff2cf'); gr.addColorStop(1, '#f7c97c'); g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
      // 棚
      for (let r = 0; r < 3; r++) { g.fillStyle = '#8b6a48'; g.fillRect(20, y0 + 40 + r * 60, W - 40, 6); for (let i = 0; i < 14; i++) { g.fillStyle = `hsl(${(rnd() * 360) | 0},55%,${50 + rnd() * 25}%)`; g.fillRect(28 + i * ((W - 60) / 14), y0 + 16 + r * 60, (W - 60) / 14 - 6, 24); } }
      if (s.kind === 'deli' || s.kind === 'veg') { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(10, H - 90, W - 20, 70); for (let i = 0; i < 10; i++) { g.fillStyle = s.kind === 'veg' ? `hsl(${[100, 30, 0, 50][i % 4]},70%,45%)` : `hsl(${25 + rnd() * 20},70%,${40 + rnd() * 20}%)`; g.beginPath(); g.ellipse(40 + i * 45, H - 52, 18, 12, 0, 0, 7); g.fill(); } }
      if (s.kind === 'cafe' || s.kind === 'yaki' || s.kind === 'cloth') { // 暖簾
        g.fillStyle = s.bg; for (let i = 0; i < 4; i++) g.fillRect(40 + i * ((W - 80) / 4), y0, (W - 80) / 4 - 8, 110);
        g.fillStyle = s.fg; g.font = `44px ${GFX.FONT_SIGN}`; const word = s.kind === 'cafe' ? 'お茶' : s.kind === 'yaki' ? '営業中' : 'ころも'; [...word].forEach((ch, i) => g.fillText(ch, 40 + (i + 0.5) * ((W - 80) / 4), y0 + 55));
      }
      g.strokeStyle = 'rgba(60,40,30,.6)'; g.lineWidth = 6; g.strokeRect(3, y0, W - 6, H - y0 - 3);
    });
  }
  function facadeTex(base, lit) {
    return GFX.tex(128, 128, (g, W, H) => {
      g.fillStyle = base; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, W, 4);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const on = rnd() < lit; g.fillStyle = on ? (rnd() < 0.7 ? '#ffd892' : '#bfe2ff') : '#2b3150'; g.fillRect(12 + c * 60, 18 + r * 58, 44, 36);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(12 + c * 60, 18 + r * 58, 44, 4);
      }
    });
  }

  GFX.buildWorld = function (scene) {
    const W = { lanternsStreet: [], toro: [], signs: [], papers: [], glass: [], flags: [] };
    const ST = DATA.STAGE;
    /* 空 */
    const skyGeo = new THREE.SphereGeometry(320, 32, 16); const cols = [];
    const cTop = new THREE.Color('#141238'), cMid = new THREE.Color('#3b3584'), cLow = new THREE.Color('#b2668f'), cHor = new THREE.Color('#f4a36c');
    const p = skyGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 320; const c = y > 0.45 ? cTop.clone().lerp(cMid, 1 - (y - 0.45) / 0.55) : y > 0.12 ? cMid.clone().lerp(cLow, 1 - (y - 0.12) / 0.33) : cLow.clone().lerp(cHor, Math.min(1, 1 - y / 0.12)); cols.push(c.r, c.g, c.b); }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; scene.add(sky); W.sky = sky;
    const stars = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 220; i++) { const a = rnd() * Math.PI * 2, e = 0.35 + rnd() * 0.6; sp.push(Math.cos(a) * Math.cos(e) * 300, Math.sin(e) * 300, Math.sin(a) * Math.cos(e) * 300); }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xfff6e0, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
    const moonT = GFX.tex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.35, 'rgba(255,240,200,.9)'); gr.addColorStop(0.4, 'rgba(255,230,190,.25)'); gr.addColorStop(1, 'rgba(255,220,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonT, fog: false, depthWrite: false, transparent: true })); moon.position.set(-90, 120, 220); moon.scale.set(40, 40, 1); scene.add(moon);
    scene.fog = new THREE.Fog(0x3d3973, 50, 170);
    /* 明かり */
    scene.add(new THREE.HemisphereLight(0x9a96e6, 0x3d2c34, 1.25));
    const dusk = new THREE.DirectionalLight(0xffb48c, 0.7); dusk.position.set(-40, 30, -80); scene.add(dusk);
    W.fill = new THREE.DirectionalLight(0xfff4e8, 0.55); scene.add(W.fill); scene.add(W.fill.target);
    for (const [x, z, c, d] of [[0, -50, 0xffc078, 16], [0, -28, 0xffc078, 16], [0, -8, 0xffb070, 16], [-8.4, 8.4, 0xffa860, 17], [8.4, 8.4, 0xffa860, 17], [0, 18.2, 0xffd090, 18]]) { const l = new THREE.PointLight(c, 18, d, 1.6); l.position.set(x, 4.2, z); scene.add(l); }

    /* 地面 */
    const pave = GFX.tex(256, 256, (g, w, h) => { g.fillStyle = '#5b5d68'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) { const v = 82 + rnd() * 26 | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 12})`; g.fillRect(x + 2, y + 2, 60, 28); } }, [3.2, 16]);
    const prom = GFX.mesh(scene, new THREE.PlaneGeometry(12.8, 66), GFX.lam(0xffffff, { map: pave }), 0, 0, -33); prom.rotation.x = -Math.PI / 2;
    const guide = GFX.mesh(scene, new THREE.PlaneGeometry(0.5, 66), GFX.lam(0xb9b4a6), 0, 0.01, -33); guide.rotation.x = -Math.PI / 2;
    for (let z = -60; z < 0; z += 5) { const l = GFX.mesh(scene, new THREE.PlaneGeometry(12.6, 0.12), GFX.lam(0x7d7f8a), 0, 0.012, z); l.rotation.x = -Math.PI / 2; }
    const sideT = GFX.tex(128, 128, (g, w, h) => { g.fillStyle = '#c8bca4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a99d86'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } }, [3, 55]);
    for (const s of [-1, 1]) {
      const sw = GFX.mesh(scene, new THREE.PlaneGeometry(3.6, 66), GFX.lam(0xffffff, { map: sideT }), s * 8.2, 0.02, -33); sw.rotation.x = -Math.PI / 2;
      const tact = GFX.mesh(scene, new THREE.PlaneGeometry(0.3, 66), GFX.lam(0xe8c432), s * 7.1, 0.03, -33); tact.rotation.x = -Math.PI / 2; // 点字ブロック
      const curb = GFX.mesh(scene, new THREE.BoxGeometry(0.2, 0.1, 66), GFX.lam(0xb8b2a6), s * 6.4, 0.05, -33);
    }
    const plazaT = GFX.tex(1024, 820, (g, w, h) => {
      g.fillStyle = '#7b6f66'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 25.6) for (let x = 0; x < w; x += 25.6) { const v = 112 + rnd() * 22 | 0; g.fillStyle = `rgb(${v + 8},${v},${v - 8})`; g.fillRect(x + 1, y + 1, 23.6, 23.6); }
      g.strokeStyle = '#d8c7a4'; g.lineWidth = 6; for (const r of [70, 150, 230]) { g.beginPath(); g.arc(w / 2, h * 0.6, r, 0, 7); g.stroke(); }
      g.strokeStyle = 'rgba(216,199,164,.55)'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = 'rgba(30,24,40,.35)'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, h * 0.6); g.arc(w / 2, h * 0.6, 230, a, a + 0.08); g.fill(); }
    });
    const PW = ST.plazaHalfW, PZ = ST.plazaZ1, FB = DATA.BMOVES.junkou.outer; // 広場の半幅・奥行き・飛行の外周
    const plaza = GFX.mesh(scene, new THREE.PlaneGeometry(PW * 2, PZ), GFX.lam(0xffffff, { map: plazaT }), 0, 0, PZ / 2); plaza.rotation.x = -Math.PI / 2;
    const outer = GFX.mesh(scene, new THREE.PlaneGeometry(200, 200), GFX.lam(0x2c2b36), 0, -0.02, 0); outer.rotation.x = -Math.PI / 2;

    /* 店とビル（両側） */
    const shopMats = [];
    let si = 0;
    for (const s of [-1, 1]) {
      let z = ST.streetZ0 + 0.5;
      while (z < -0.5) {
        const w = Math.min(-0.5 - z, 4.2 + rnd() * 2.6); if (w < 2.2) break;
        const H = 7 + rnd() * 16, depth = 12, shop = SHOPS[si++ % SHOPS.length];
        const base = ['#d9d1c4', '#bfc3c9', '#e7e0d2', '#a9b0ba', '#cdbba6', '#9aa0a8', '#e2d8c8'][(rnd() * 7) | 0];
        const ft = facadeTex(base, 0.55); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round((H - 4.5) / 3)));
        const fm = GFX.lam(0xffffff, { map: ft, emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: 0.35 });
        const plain = GFX.lam(new THREE.Color(base).multiplyScalar(0.8));
        const mats = s > 0 ? [plain, fm, plain, plain, plain, plain] : [fm, plain, plain, plain, plain, plain];
        const up = GFX.mesh(scene, new THREE.BoxGeometry(depth, H - 4.4, w), mats, s * (10 + depth / 2), 4.4 + (H - 4.4) / 2, z + w / 2);
        const front = shopFront(shop, w); const frm = GFX.lam(0xffffff, { map: front, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: 0.55 });
        const pf = GFX.mesh(scene, new THREE.PlaneGeometry(w - 0.1, 4.4), frm, s * 10.0, 2.2, z + w / 2, -s * Math.PI / 2); shopMats.push(frm);
        // 縦の突き出し看板
        if (rnd() < 0.75 && H > 9) {
          const word = ['カラオケ', '居酒屋', '学習塾', '歯科', '整骨院', 'やきとり', '中華そば', '英会話', '喫茶', 'ゲーム', '書店', '銭湯'][(rnd() * 12) | 0];
          const cols = [['#d8262e', '#fff'], ['#ffd23a', '#c71f1f'], ['#ffffff', '#1f4fa8'], ['#1d8a4e', '#fff'], ['#f57c1f', '#fff'], ['#2b2b33', '#ffd23a']][(rnd() * 6) | 0];
          const st = GFX.tex(64, 256, (g, Wt, Ht) => { g.fillStyle = cols[0]; g.fillRect(0, 0, Wt, Ht); g.strokeStyle = cols[1]; g.lineWidth = 4; g.strokeRect(4, 4, Wt - 8, Ht - 8); vtext(g, word, Wt / 2, 36, 40, Math.min(48, (Ht - 50) / word.length), GFX.FONT_UI, cols[1]); });
          const sm = GFX.lam(0xffffff, { map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.6 }), side = GFX.lam(0x444450);
          GFX.mesh(scene, new THREE.BoxGeometry(0.9, 3.4, 0.22), [side, side, side, side, sm, sm], s * 10.55, 6.2 + rnd() * Math.max(0, H - 11), z + w / 2);
        }
        // 屋上看板
        if (rnd() < 0.25 && H > 14) { const bt = GFX.tex(256, 64, (g, Wt, Ht) => { g.fillStyle = '#20263d'; g.fillRect(0, 0, Wt, Ht); g.fillStyle = '#ffe28a'; g.font = `40px ${GFX.FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['宵町ビル', 'SENJU', '千寿会館', 'ホテル宿場'][(rnd() * 4) | 0], Wt / 2, Ht / 2); }); GFX.mesh(scene, new THREE.PlaneGeometry(w * 0.9, w * 0.22), GFX.bas(0xffffff, { map: bt }), s * 10.2, H + 0.6, z + w / 2, -s * Math.PI / 2); }
        z += w;
      }
    }
    W.shopMats = shopMats;
    /* アーケード（緑の鉄骨とガラス屋根） */
    const green = GFX.lam(0x2f8a58), glass = new THREE.MeshLambertMaterial({ color: 0xcfe9e6, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false, emissive: 0x2a4a50, emissiveIntensity: 0.4 });
    W.glass.push(glass);
    const pil = [], rib = [], beam = [], lamp = [];
    const pilG = new THREE.CylinderGeometry(0.12, 0.14, 4.1, 8), ribG = new THREE.TorusGeometry(1.9, 0.06, 4, 12, Math.PI), beamG = new THREE.BoxGeometry(0.22, 0.5, 66), lampG = new THREE.BoxGeometry(0.15, 0.06, 0.6);
    for (const s of [-1, 1]) {
      const vault = new THREE.CylinderGeometry(1.9, 1.9, 66, 16, 1, true, -Math.PI / 2, Math.PI); vault.rotateX(-Math.PI / 2);
      const v = GFX.mesh(scene, vault, glass, s * 8.2, 4.05, -33); v.renderOrder = 2;
      for (let z = 0; z >= -65; z -= ST.pillarStep) pil.push({ geo: pilG, m: GFX.M(s * ST.pillarX, 2.05, z) });
      for (let z = -1; z >= -65; z -= 2.5) rib.push({ geo: ribG, m: GFX.M(s * 8.2, 4.05, z, Math.PI / 2 * 0, 0, 0) });
      beam.push({ geo: beamG, m: GFX.M(s * 6.32, 4.1, -33) }); beam.push({ geo: beamG, m: GFX.M(s * 10.05, 4.1, -33) });
      for (let z = -2; z >= -64; z -= 3) lamp.push({ geo: lampG, m: GFX.M(s * 6.32, 3.84, z) });
    }
    const greenF = green.clone(); greenF.transparent = true; W.fadeArcade = [greenF, glass];
    scene.add(new THREE.Mesh(GFX.merge(pil), greenF)); scene.add(new THREE.Mesh(GFX.merge(beam), greenF));
    const ribs = new THREE.Mesh(GFX.merge(rib), greenF); scene.add(ribs);
    scene.add(new THREE.Mesh(GFX.merge(lamp), GFX.bas(0xfff1c8)));
    /* 電柱と電線 */
    const pole = [], wires = [];
    const poleG = new THREE.CylinderGeometry(0.14, 0.18, 9, 8), armG = new THREE.BoxGeometry(1.6, 0.1, 0.1);
    const poles = [[-6.0, -58], [6.0, -44], [-6.0, -30], [6.0, -16]];
    for (const [x, z] of poles) { pole.push({ geo: poleG, m: GFX.M(x, 4.5, z) }); pole.push({ geo: armG, m: GFX.M(x, 8.2, z) }); pole.push({ geo: armG, m: GFX.M(x, 7.6, z) }); }
    scene.add(new THREE.Mesh(GFX.merge(pole), GFX.lam(0x9a9a98)));
    const wp = []; for (let i = 0; i < poles.length - 1; i++) for (const dy of [8.2, 7.6]) { const [x0, z0] = poles[i], [x1, z1] = poles[i + 1]; for (let k = 0; k < 8; k++) { const a = k / 8, b = (k + 1) / 8, sag = t => -Math.sin(t * Math.PI) * 0.5; wp.push(x0 + (x1 - x0) * a, dy + sag(a), z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, dy + sag(b), z0 + (z1 - z0) * b); } }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x15151c })));
    /* 通りを横切る提灯 */
    const chochinG = new THREE.SphereGeometry(0.17, 10, 8); chochinG.scale(1, 1.3, 1);
    const unlitM = GFX.lam(0xc8402f, { emissive: 0x401008, emissiveIntensity: 0.6 }), litM = new THREE.MeshBasicMaterial({ color: 0xffb060 });
    const chUn = new THREE.InstancedMesh(chochinG, unlitM, 80), chLit = new THREE.InstancedMesh(chochinG, litM, 80);
    const ropeP = []; let ci = 0;
    for (let z = -58; z <= -4; z += 6) {
      for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6, x = -6.3 + 12.6 * a, y = 5.1 - Math.sin(a * Math.PI) * 0.6; W.lanternsStreet.push({ i: ci, x, y, z, lit: false }); ci++; }
      for (let k = 0; k < 12; k++) { const a = k / 12, b = (k + 1) / 12; ropeP.push(-6.3 + 12.6 * a, 5.45 - Math.sin(a * Math.PI) * 0.6, z, -6.3 + 12.6 * b, 5.45 - Math.sin(b * Math.PI) * 0.6, z); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ropeP, 3)); scene.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x3a2a20 })));
    const tmpO = new THREE.Object3D();
    W.setStreetLantern = (L, lit) => { L.lit = lit; tmpO.position.set(L.x, L.y, L.z); tmpO.scale.setScalar(1); tmpO.updateMatrix(); const hide = tmpO.matrix.clone().scale(new V3(0, 0, 0)); chLit.setMatrixAt(L.i, lit ? tmpO.matrix : hide); chUn.setMatrixAt(L.i, lit ? hide : tmpO.matrix); chLit.instanceMatrix.needsUpdate = chUn.instanceMatrix.needsUpdate = true; };
    chUn.count = chLit.count = ci; for (const L of W.lanternsStreet) W.setStreetLantern(L, false); scene.add(chUn); scene.add(chLit);
    /* 入口のゲート（緑・架空の名前） */
    const gate = new THREE.Group(); scene.add(gate); gate.position.set(0, 0, -0.6); W.gate = gate;
    const gateG = green.clone(); gateG.transparent = true;
    for (const s of [-1, 1]) GFX.mesh(gate, new THREE.BoxGeometry(0.45, 7, 0.45), gateG, s * 6.4, 3.5, 0.6);
    const gt = GFX.tex(512, 96, (g, w, h) => { g.fillStyle = '#1f5f3c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8d38a'; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#fff6dc'; g.font = `56px ${GFX.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('千住よいまち通り', w / 2, h / 2 + 2); });
    const gs = GFX.lam(0xffffff, { map: gt, emissive: 0xffffff, emissiveMap: gt, emissiveIntensity: 0.6, transparent: true });
    GFX.mesh(gate, new THREE.BoxGeometry(14.2, 1.4, 0.4), [gateG, gateG, gateG, gateG, gs, gs], 0, 6.6, 0);
    W.fadeGate = [gateG, gs];
    /* 小物：自転車・植木鉢・ベンチ・A看板・自販機 */
    const bike = [], pot = [], plant = [], bench = [];
    const wheelG = new THREE.TorusGeometry(0.3, 0.035, 5, 14), frameG = new THREE.BoxGeometry(0.04, 0.04, 0.8), potG = new THREE.CylinderGeometry(0.25, 0.2, 0.4, 8), plantG = new THREE.SphereGeometry(0.42, 8, 6), benchG = new THREE.BoxGeometry(0.5, 0.42, 1.6);
    for (const s of [-1, 1]) for (let z = -60; z < -4; z += 4.3) {
      const r = rnd();
      if (r < 0.35) { const x = s * 9.1, zz = z + rnd(); bike.push({ geo: wheelG, m: GFX.M(x, 0.32, zz - 0.42, Math.PI / 2) }, { geo: wheelG, m: GFX.M(x, 0.32, zz + 0.42, Math.PI / 2) }, { geo: frameG, m: GFX.M(x, 0.55, zz, 0, -0.2) }, { geo: frameG, m: GFX.M(x, 0.75, zz + 0.2, 0, 0.6, 0, 1, 1, 0.5) }); }
      else if (r < 0.6) { pot.push({ geo: potG, m: GFX.M(s * 9.4, 0.2, z + 1) }); plant.push({ geo: plantG, m: GFX.M(s * 9.4, 0.7, z + 1) }); }
      else if (r < 0.7) bench.push({ geo: benchG, m: GFX.M(s * 9.3, 0.21, z + 1) });
    }
    scene.add(new THREE.Mesh(GFX.merge(bike), GFX.lam(0x2a3442))); scene.add(new THREE.Mesh(GFX.merge(pot), GFX.lam(0x8a5a3a))); scene.add(new THREE.Mesh(GFX.merge(plant), GFX.lam(0x3f7a3a))); scene.add(new THREE.Mesh(GFX.merge(bench), GFX.lam(0x7a5a3a)));
    const vend = GFX.tex(64, 128, (g, w, h) => { g.fillStyle = '#d23b3b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff3d6'; g.fillRect(6, 10, w - 12, 60); for (let i = 0; i < 12; i++) { g.fillStyle = `hsl(${i * 30},70%,55%)`; g.fillRect(9 + (i % 4) * 12, 14 + ((i / 4) | 0) * 19, 9, 15); } g.fillStyle = '#222'; g.fillRect(10, 96, w - 20, 16); });
    for (const [x, z] of [[-9.3, -36], [9.3, -12]]) GFX.mesh(scene, new THREE.BoxGeometry(0.7, 1.8, 1.0), [GFX.lam(0xb02a2a), GFX.lam(0xb02a2a), GFX.lam(0xb02a2a), GFX.lam(0xb02a2a), GFX.lam(0xffffff, { map: vend, emissive: 0xffffff, emissiveMap: vend, emissiveIntensity: 0.7 }), GFX.lam(0xb02a2a)], x, 0.9, z, x > 0 ? -Math.PI / 2 : Math.PI / 2);
    const aT = GFX.tex(64, 96, (g, w, h) => { g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `22px ${GFX.FONT_UI}`; g.textAlign = 'center'; ['本日', 'お買得', '→'].forEach((t, i) => g.fillText(t, w / 2, 26 + i * 28)); });
    for (const [x, z] of [[-7.4, -50], [7.6, -41], [-7.6, -22], [7.5, -9], [-7.5, -6]]) { const sg = new THREE.Group(); sg.position.set(x, 0, z); const m = GFX.mesh(sg, new THREE.BoxGeometry(0.55, 0.85, 0.06), [GFX.lam(0x333333), GFX.lam(0x333333), GFX.lam(0x333333), GFX.lam(0x333333), GFX.lam(0xffffff, { map: aT }), GFX.lam(0xffffff, { map: aT })], 0, 0.45, 0); m.rotation.x = -0.15; sg.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(sg); W.signs.push({ g: sg, y0: sg.rotation.y }); }
    // 惣菜のショーケース
    GFX.mesh(scene, new THREE.BoxGeometry(0.8, 0.9, 2.4), new THREE.MeshLambertMaterial({ color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }), -9.3, 0.45, -46);

    /* 広場の境界：提灯の柱と縄、屋台 */
    const post = [], plRope = [];
    const postG = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6);
    const ring = [];
    const nZ = Math.round(PZ / 3.2), nX = Math.round(PW * 2 / 3.5);
    for (let i = 0; i <= nZ; i++) for (const s of [-1, 1]) ring.push([s * (PW + 0.4), PZ * i / nZ]);
    for (let i = 0; i <= nX; i++) ring.push([-PW + PW * 2 * i / nX, PZ + 0.4]);
    for (const [x, z] of ring) post.push({ geo: postG, m: GFX.M(x, 1.6, z) });
    scene.add(new THREE.Mesh(GFX.merge(post), GFX.lam(0x5a3a28)));
    const plz = new THREE.InstancedMesh(chochinG, litM, ring.length); const plzU = new THREE.InstancedMesh(chochinG, unlitM, ring.length);
    ring.forEach(([x, z], i) => { tmpO.position.set(x, 2.95, z); tmpO.scale.setScalar(1.15); tmpO.updateMatrix(); plz.setMatrixAt(i, tmpO.matrix); plzU.setMatrixAt(i, tmpO.matrix); });
    plz.visible = false; scene.add(plz); scene.add(plzU); W.plazaLit = plz; W.plazaUnlit = plzU;
    const rp = []; const seg = (x0, z0, x1, z1) => { for (let k = 0; k < 6; k++) { const a = k / 6, b = (k + 1) / 6; rp.push(x0 + (x1 - x0) * a, 3.1 - Math.sin(a * Math.PI) * 0.3, z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, 3.1 - Math.sin(b * Math.PI) * 0.3, z0 + (z1 - z0) * b); } };
    for (let i = 0; i < nZ; i++) for (const s of [-1, 1]) seg(s * (PW + 0.4), PZ * i / nZ, s * (PW + 0.4), PZ * (i + 1) / nZ);
    for (let i = 0; i < nX; i++) seg(-PW + PW * 2 * i / nX, PZ + 0.4, -PW + PW * 2 * (i + 1) / nX, PZ + 0.4);
    const prg = new THREE.BufferGeometry(); prg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); scene.add(new THREE.LineSegments(prg, new THREE.LineBasicMaterial({ color: 0xd9c08a })));
    const yataiT = GFX.tex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#d1323a'; g.fillRect(i * 32, 0, 32, h); } });
    const ysign = ['わたあめ', 'やきそば', 'かき氷', 'りんご飴', '金魚すくい', 'お面', 'たこ焼き', 'ヨーヨー'];
    let yi = 0;
    const YX = PW + FB + 2.6, YZ = PZ + FB + 2.6; // 屋台は飛行の外周より外に置く
    for (const [x, z, ry] of [[-YX, PZ * 0.2, Math.PI / 2], [-YX, PZ * 0.5, Math.PI / 2], [-YX, PZ * 0.8, Math.PI / 2], [YX, PZ * 0.2, -Math.PI / 2], [YX, PZ * 0.5, -Math.PI / 2], [YX, PZ * 0.8, -Math.PI / 2], [-8, YZ, Math.PI], [8, YZ, Math.PI]]) {
      const yg = new THREE.Group(); yg.position.set(x, 0, z); yg.rotation.y = ry; scene.add(yg);
      GFX.mesh(yg, new THREE.BoxGeometry(3.6, 1.0, 1.6), GFX.lam(0x8a5a3a), 0, 0.5, 0);
      GFX.mesh(yg, new THREE.BoxGeometry(3.8, 0.5, 1.9), GFX.lam(0xffffff, { map: yataiT, emissive: 0x552222, emissiveIntensity: 0.3 }), 0, 2.5, 0);
      const st = GFX.tex(256, 64, (g, w, h) => { g.fillStyle = '#fff8e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8202a'; g.font = `40px ${GFX.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ysign[yi++ % ysign.length], w / 2, h / 2 + 2); });
      GFX.mesh(yg, new THREE.PlaneGeometry(2.6, 0.6), GFX.lam(0xffffff, { map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.6 }), 0, 1.6, 0.81);
      GFX.mesh(yg, new THREE.PlaneGeometry(3.4, 0.9), GFX.bas(0xffcf7a), 0, 1.0, 0.55).material.transparent = false;
    }
    /* 4基の祭り灯籠（スイッチ） */
    const stone = GFX.lam(0x9b968d), stoneD = GFX.lam(0x7d786f);
    for (const [x, z] of ST.lanterns) {
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      GFX.mesh(g, new THREE.CylinderGeometry(0.55, 0.65, 0.3, 6), stoneD, 0, 0.15, 0);
      GFX.mesh(g, new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), stone, 0, 0.75, 0);
      GFX.mesh(g, new THREE.CylinderGeometry(0.45, 0.35, 0.18, 6), stoneD, 0, 1.25, 0);
      const fire = GFX.mesh(g, new THREE.BoxGeometry(0.5, 0.42, 0.5), GFX.lam(0x5b5650, { emissive: 0x000000 }), 0, 1.55, 0);
      GFX.mesh(g, new THREE.ConeGeometry(0.62, 0.42, 6), stone, 0, 1.97, 0);
      GFX.mesh(g, new THREE.SphereGeometry(0.1, 8, 6), stone, 0, 2.25, 0);
      const glowT = GFX.tex(64, 64, (gg) => { const gr = gg.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,140,1)'); gr.addColorStop(1, 'rgba(255,160,60,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64); });
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.position.set(0, 1.6, 0); glow.scale.set(2.6, 2.6, 1); glow.visible = false; g.add(glow);
      const ringM = GFX.mesh(g, new THREE.RingGeometry(1.5, 1.7, 32), GFX.bas(0xffe08a, { transparent: true, opacity: 0.5, depthWrite: false }), 0, 0.03, 0); ringM.rotation.x = -Math.PI / 2;
      W.toro.push({ g, fire, glow, ring: ringM, lit: false });
    }
    /* 駅前のペデストリアンデッキと駅ビル */
    const deckM = GFX.lam(0xb9b4aa);
    const DZ = YZ + 4.5; // デッキの中心（屋台の奥）
    GFX.mesh(scene, new THREE.BoxGeometry(70, 0.6, 5), deckM, 0, 5.9, DZ);
    for (let x = -30; x <= 30; x += 7.5) GFX.mesh(scene, new THREE.CylinderGeometry(0.35, 0.35, 5.6, 10), deckM, x, 2.8, DZ);
    GFX.mesh(scene, new THREE.BoxGeometry(70, 1.0, 0.12), new THREE.MeshLambertMaterial({ color: 0xa8d0d8, transparent: true, opacity: 0.4 }), 0, 6.7, DZ - 2.45);
    GFX.mesh(scene, new THREE.BoxGeometry(70, 0.12, 0.2), green, 0, 7.2, DZ - 2.45);
    const stT = GFX.tex(512, 512, (g, w, h) => { g.fillStyle = '#e9dccb'; g.fillRect(0, 0, w, h); for (let r = 0; r < 9; r++) { g.fillStyle = r % 3 === 0 ? '#c9b9a4' : '#3a3f58'; g.fillRect(0, 40 + r * 52, w, r % 3 === 0 ? 10 : 26); if (r % 3) for (let c = 0; c < 16; c++) if (rnd() < 0.55) { g.fillStyle = rnd() < 0.7 ? '#ffe2a8' : '#cfe8ff'; g.fillRect(c * 32 + 3, 42 + r * 52, 26, 22); } } });
    GFX.mesh(scene, new THREE.BoxGeometry(70, 34, 18), [GFX.lam(0xd8ccbb), GFX.lam(0xd8ccbb), GFX.lam(0xd8ccbb), GFX.lam(0xd8ccbb), GFX.lam(0xd8ccbb), GFX.lam(0xffffff, { map: stT, emissive: 0xffffff, emissiveMap: stT, emissiveIntensity: 0.45 })], 0, 17, DZ + 11.5);
    const signT = GFX.tex(1024, 160, (g, w, h) => { g.fillStyle = '#1d2033'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6e2'; g.font = `96px ${GFX.FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('北千住駅', w / 2, 66); g.font = `30px ${GFX.FONT_UI}`; g.fillStyle = '#c8cde6'; g.fillText('KITA-SENJU STATION', w / 2, 132); });
    GFX.mesh(scene, new THREE.PlaneGeometry(16, 2.5), GFX.bas(0xffffff, { map: signT }), 0, 10.5, DZ + 2.4, Math.PI);
    // 広場の左右のビル
    for (const s of [-1, 1]) for (let z = -2; z < DZ - 2; z += 9) { const H = 10 + rnd() * 14, base = ['#cfc6b8', '#a9aeb6', '#b9a894'][(rnd() * 3) | 0]; const ft = facadeTex(base, 0.6); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(3, Math.round(H / 3)); const fm = GFX.lam(0xffffff, { map: ft, emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: 0.35 }), pl = GFX.lam(new THREE.Color(base).multiplyScalar(0.8)); GFX.mesh(scene, new THREE.BoxGeometry(12, H, 8.6), s > 0 ? [pl, fm, pl, pl, pl, pl] : [fm, pl, pl, pl, pl, pl], s * (YX + 8), H / 2, z + 4.3); }
    /* 結界（通り→広場の入口） */
    const fudaT = GFX.tex(64, 128, (g, w, h) => { g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c0392b'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); vtext(g, '通行止', w / 2, 30, 26, 30, GFX.FONT_SIGN, '#c0392b'); });
    const bS = new THREE.Group(); scene.add(bS); bS.position.set(0, 0, -0.2);
    for (let x = -9; x <= 9; x += 1.2) GFX.mesh(bS, new THREE.PlaneGeometry(0.5, 1.0), GFX.lam(0xffffff, { map: fudaT, emissive: 0xff6a3a, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true }), x, 1.6 + Math.sin(x) * 0.2, 0);
    const bw = GFX.mesh(bS, new THREE.PlaneGeometry(19, 3.2), new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), 0, 1.6, 0);
    W.barrierStreet = bS;
    const bP = new THREE.Group(); scene.add(bP); bP.position.set(0, 0, 0.3);
    const rope = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-9.6, 2.6, 0), new V3(-4, 2.0, 0), new V3(0, 1.8, 0), new V3(4, 2.0, 0), new V3(9.6, 2.6, 0)]), 30, 0.12, 6, false);
    GFX.mesh(bP, rope, GFX.lam(0xd9c08a));
    for (let x = -8; x <= 8; x += 2) { const zz = GFX.mesh(bP, new THREE.PlaneGeometry(0.25, 0.7), GFX.lam(0xffffff, { side: THREE.DoubleSide }), x, 1.6 + Math.abs(x) * 0.06, 0); }
    bP.visible = false; W.barrierPlaza = bP;
    GFX.mesh(scene, new THREE.BoxGeometry(0.4, 3.0, 0.4), GFX.lam(0xb8322a), -9.7, 1.5, 0.3); GFX.mesh(scene, new THREE.BoxGeometry(0.4, 3.0, 0.4), GFX.lam(0xb8322a), 9.7, 1.5, 0.3);
    /* 紙片（登場演出で転がる） */
    const paperT = GFX.tex(32, 32, (g) => { g.fillStyle = '#f4eedf'; g.fillRect(4, 4, 24, 20); g.fillStyle = '#c0392b'; g.fillRect(10, 8, 12, 2); g.fillRect(10, 13, 8, 2); });
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.22), GFX.lam(0xffffff, { map: paperT, side: THREE.DoubleSide, transparent: true })); m.visible = false; scene.add(m); W.papers.push({ m, x: 0, z: 0, s: 0 }); }
    return W;
  };
})();
