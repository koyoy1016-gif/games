/* =====================================================================
   street.js — 上野編「居酒屋通り」：電車の部下の1.25倍（HP・ちから・ようりょくだけ）を30体
   流れ：intro（ホーム→改札→通りへ・数秒）→ street（3地点×10体。地点を片付けると次の暖簾の結界が開く）→ won（ボスへのチェックポイント）
   ===================================================================== */
(() => {
  const P = Sim.prototype;
  const S = () => DATA.STREET;
  P.initStreet = function (o) {
    const D = S(), J = DATA.JOBAN;
    this.stage = o.test ? 'street' : 'intro'; this.barrier = 'none'; this.lanterns = [];
    this.kills = 0; this.total = D.n; this.queue = null; this.grpKills = {}; this.grpN = {};
    this.ycfg = { types: {}, rights: J.rights, startGap: J.startGap };
    for (const k in J.types) { const T = J.types[k]; this.ycfg.types[k] = Object.assign({}, T, { hp: Math.round(Math.round(T.hp * D.mul) * D.hpUp), str: Math.round(T.str * D.mul), yo: Math.round(T.yo * D.mul), dmgMul: D.dmgUp, spd: D.spd && D.spd[k] || T.spd }); } // v7：HPは通りの値×1.5、1発の最終ダメージ×1.25（まもり・移動・技の威力はそのまま）
    this.gate = 0; // 開いている結界の数（0：最初の地点だけ戦える）
    for (const a of this.allies) { const q = D.start[a.slot]; a.x = a.px = q[0]; a.z = a.pz = q[1]; a.yaw = 0; a.ai.tx = a.x; a.ai.tz = a.z + 1; }
    // 剣10・パンチ10・ビーム10を、10体ずつ3地点へ（各地点の内訳も最大剰余法でおおむね均等）
    const all = []; for (const k of ['sword', 'punch', 'beam']) for (let i = 0; i < 10; i++) all.push(k);
    for (let g = 0; g < 3; g++) {
      const part = []; for (let i = 0; i < 10; i++) part.push(all[(i * 3 + g) % 30]);
      const id = 'g' + g; this.grpN[id] = 10; this.grpKills[id] = 0;
      part.forEach((typ, i) => { const row = i % 3, col = Math.floor(i / 3); const m = this.spawnYoshi(-3 + row * 3 + this.rng.range(-0.4, 0.4), D.groups[g] - 1.5 + col * 1.2 + this.rng.range(-0.3, 0.3), id, 'in', typ); m.enterT = 0; m.yaw = Math.PI; m.cd = 0.5 + this.rng.next() * 1.5; m.grpI = g; });
    }
  };
  /** 通りの壁と、まだ開いていない暖簾の結界 */
  P.clampStreet = function (ox, oz, nx, nz, rad) {
    const D = S(); nx = clamp(nx, -D.halfX + rad, D.halfX - rad); nz = clamp(nz, 0.3 + rad, D.zMax - rad);
    const g = this.gate < 3 ? D.gates[this.gate] : 1e9; if (nz > g - rad) nz = g - rad;
    return [nx, nz];
  };
  /** その地点の部下は、手前の結界が開いてから動き出す */
  P.streetLive = function (m) { return this.stage === 'street' && (m == null || m.grpI == null || m.grpI <= this.gate); };
  P.updateStreet = function (dt) {
    const D = S();
    if (this.stage === 'intro') { if (this.introWait) return; if (this.stageT >= D.introT) { this.stage = 'street'; this.stageT = 0; this.ev('stage', { k: 'streetGo' }); } return; }
    if (this.stage !== 'street') return;
    const g = this.gate;
    if (g < 3 && this.grpKills['g' + g] >= 10) {
      this.gate = g + 1; this.ev('gate', { n: this.gate });
      if (this.gate >= 3) this.finish(true, 'street');
    }
  };
  P.candySpot = function () {
    if (this.stageId === 'ueno_street') { const D = S(), z1 = this.gate < 3 ? D.gates[this.gate] - 1 : D.zMax - 1; return [this.rng.range(-D.halfX + 1, D.halfX - 1), this.rng.range(2, z1)]; }
    if (this.stageId.startsWith('akiba')) return this.akibaCandySpot();
    return [0, 0];
  };
  P.extSnap = function () {
    if (this.stageId === 'ueno_street') return ['s', this.gate];
    if (this.stageId.startsWith('akiba') && this.akibaSnap) return ['a'].concat(this.akibaSnap());
    return 0;
  };
  SIMLIB.extDecode = x => x[0] === 's' ? { kind: 'street', gate: x[1] } : x[0] === 'a' && SIMLIB.akibaDecode ? SIMLIB.akibaDecode(x.slice(1)) : null;
})();
