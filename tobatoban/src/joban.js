/* =====================================================================
   joban.js — ステージ2「常磐線」：北千住→上野の車内でヨシノシの部下と戦う
   sim.js の Sim に足す（ホストだけが動かす・three.js 非依存）。
   流れ：intro（トバトーバンが倒れる→ホームで乗車→発車）→ train（走りながら車内戦）
        → 上野の手前は、車内の部下をすべて倒すまで走り続ける → arrive（上野に到着）→ 勝利
   ===================================================================== */
(() => {
  const P = Sim.prototype;
  const WPNS = ['sword', 'fist', 'beam'], WPN_W = [0.38, 0.37, 0.25];

  P.initJoban = function (o) {
    this.stage = o.test ? 'train' : 'intro'; this.barrier = 'none';
    const J = DATA.JOBAN;
    this.kills = 0; this.total = J.waves.reduce((s, n) => s + n, 0) + J.boardN.reduce((s, n) => s + n, 0);
    this.phase = 0; this.phaseKills = [0, 0, 0]; this.queue = []; this.spawnT = 0; this.boardedSt = 0;
    this.tr = { at: 0, ph: 'stop', d: 0, v: 0, t: 0, doors: 0 }; // 北千住で停車中（演出の間）
    const pos = [[-0.6, -4.2], [0.6, -4.2], [-0.6, -5.8], [0.6, -5.8]]; // 3号車の前寄り・前向き
    for (const a of this.allies) { const q = pos[a.slot]; a.x = a.px = q[0]; a.z = a.pz = q[1]; a.yaw = 0; a.ai.tx = a.x; a.ai.tz = a.z; }
    if (o.test) this.startTrain();
  };

  /** 車内の壁：通路の幅・前後の端・連結部（細い） */
  P.clampTrain = function (ox, oz, nx, nz, rad) {
    const J = DATA.JOBAN, hw = J.halfW - rad, gw = J.gwHalfW - rad, gb = J.gwHalf + rad;
    nz = clamp(nz, J.zMin + rad, J.zMax - rad); nx = clamp(nx, -hw, hw);
    if (Math.abs(nz) < gb && Math.abs(nx) > gw) {
      if (Math.abs(oz) >= gb) nz = Math.sign(oz) * gb; // 連結部の壁に当たる
      else nx = clamp(nx, -gw, gw);
    }
    return [nx, nz];
  };

  P.startTrain = function () {
    this.stage = 'train'; this.stageT = 0; this.introWait = false;
    const tr = this.tr; tr.ph = 'run'; tr.at = 0; tr.d = 0; tr.v = 0; tr.t = 0; tr.doors = 0;
    // 第1波：2号車にすでに10体
    this.phase = 1;
    for (let i = 0; i < DATA.JOBAN.waves[0]; i++) this.spawnYoshi(this.rng.range(-1.1, 1.1), this.rng.range(9, 19), 'p1', 'in');
    this.ev('stage', { k: 'train' }); this.ev('wave', { n: 1, cnt: DATA.JOBAN.waves[0] });
  };

  P.updateJoban = function (dt) {
    const J = DATA.JOBAN;
    if (this.stage === 'intro') { if (this.introWait) return; if (this.stageT >= J.introT) this.startTrain(); return; }
    if (this.stage === 'train' || this.stage === 'arrive') this.updateTrainMotion(dt);
    if (this.stage === 'train') { this.updateSpawns(dt); this.checkPhases(); }
    if (this.stage === 'arrive' && this.stageT >= J.arriveT) this.finish(true, 'ueno');
  };
  /** 車内の部下を全部倒したか（上野に着ける条件） */
  P.jobanCleared = function () { return this.phase >= 3 && this.boardedSt >= 3 && !this.queue.length && !this.mobs.some(m => m.st === 'ok'); };

  /** 電車の動き：加速→走行→ブレーキで駅に止まる。日暮里→上野は、部下が残っている間は上野の手前を走り続ける */
  P.updateTrainMotion = function (dt) {
    const J = DATA.JOBAN, tr = this.tr; tr.t += dt;
    if (tr.ph === 'stop') {
      tr.v = 0; if (tr.at >= 4) return;
      if (tr.t >= 1.2 && !tr.doors) { tr.doors = 1; this.ev('doors', { open: 1, st: tr.at }); if (tr.at >= 1 && tr.at <= 3) this.boardAt(tr.at); }
      if (tr.t >= J.stopT - 1.4 && tr.doors === 1) { tr.doors = 2; this.ev('doors', { open: 0, st: tr.at }); }
      if (tr.t >= J.stopT) { tr.ph = 'run'; tr.t = 0; tr.d = 0; tr.doors = 0; this.ev('depart', { st: tr.at }); }
      return;
    }
    const L = J.segLen[tr.at], hold = tr.at === 3 && !this.jobanCleared();
    const rem = L - tr.d, brakeD = tr.v * tr.v / (2 * J.acc);
    if (hold) { tr.v = Math.min(J.vmax, tr.v + J.acc * dt); tr.d = Math.min(tr.d + tr.v * dt, L - J.vmax * J.vmax / (2 * J.acc) - 60); return; }
    if (rem <= brakeD + 0.3) { tr.v = Math.max(0.7, Math.sqrt(Math.max(0, 2 * J.acc * rem))); tr.d += tr.v * dt; }
    else { tr.v = Math.min(J.vmax, tr.v + J.acc * dt); tr.d += tr.v * dt; }
    if (L - tr.d <= 0.05) {
      tr.at++; tr.d = 0; tr.v = 0; tr.ph = 'stop'; tr.t = 0; tr.doors = 0;
      this.ev('arriveSt', { st: tr.at });
      if (tr.at >= 4) { this.stage = 'arrive'; this.stageT = 0; for (const a of this.allies) a.inv = 99; this.ev('stage', { k: 'arrive' }); }
    }
  };

  /** 途中駅：左側のドアから乗ってくる（南千住10体・三河島10体・日暮里15体） */
  P.boardAt = function (st) {
    const J = DATA.JOBAN, n = J.boardN[st - 1] || 0;
    for (let i = 0; i < n; i++) this.queue.push({ grp: 'st', from: 'door' });
    this.boardedSt = Math.max(this.boardedSt, st);
    this.ev('board', { st, n });
  };
  /** 最初の10体を倒すと1号車から15体、その15体を倒すと20体 */
  P.checkPhases = function () {
    const J = DATA.JOBAN;
    if (this.phase === 1 && this.phaseKills[0] >= J.waves[0]) { this.phase = 2; for (let i = 0; i < J.waves[1]; i++) this.queue.push({ grp: 'p2', from: 'front' }); this.ev('wave', { n: 2, cnt: J.waves[1] }); }
    else if (this.phase === 2 && this.phaseKills[1] >= J.waves[1]) { this.phase = 3; for (let i = 0; i < J.waves[2]; i++) this.queue.push({ grp: 'p3', from: 'front' }); this.ev('wave', { n: 3, cnt: J.waves[2] }); }
  };
  /** 待っている部下を、車内が混みすぎない範囲で少しずつ出す */
  P.updateSpawns = function (dt) {
    const J = DATA.JOBAN; this.spawnT -= dt;
    if (this.spawnT > 0 || !this.queue.length) return;
    if (this.mobs.filter(m => m.st === 'ok').length >= J.maxActive) return;
    // 駅で乗ってくる分はドアが開いている間に優先して出す
    let qi = this.queue.findIndex(q => q.from === 'door');
    if (qi >= 0 && this.tr.doors !== 1) qi = -1;
    if (qi < 0) qi = this.queue.findIndex(q => q.from === 'front');
    if (qi < 0) { qi = 0; this.queue[0].from = 'front'; } // ドアが閉まるまでに乗り切れなかった分は、前の車両から入ってくる
    const q = this.queue.splice(qi, 1)[0];
    if (q.from === 'door') { const z = J.carDoors[(this.rng.next() * J.carDoors.length) | 0]; this.spawnYoshi(-J.halfW + 0.3, z + this.rng.range(-0.4, 0.4), q.grp, 'door'); this.spawnT = 0.3; }
    else { this.spawnYoshi(this.rng.range(-1.0, 1.0), J.frontZ, q.grp, 'front'); this.spawnT = 0.24; }
  };

  P.spawnYoshi = function (x, z, grp, from) {
    const J = DATA.JOBAN, rng = this.rng;
    let r = rng.next(), wi = 0; while (wi < 2 && r > WPN_W[wi]) { r -= WPN_W[wi]; wi++; }
    const hp = Math.round(J.hp[0] + rng.next() * (J.hp[1] - J.hp[0]));
    const m = { id: 'm' + this.id(), kind: 'yoshi', wpn: WPNS[wi], grp, from, x, z, yaw: from === 'door' ? Math.PI / 2 : Math.PI, hp, maxHp: hp, def: J.def, str: 0, yo: 0, r: J.r, st: 'ok', t: 0, para: 0, defDown: 0, dots: [],
      spd: rng.range(J.speed[0], J.speed[1]), cd: 0.6 + rng.next() * 1.2, act: null, tgt: -1, retT: 0, enterT: from === 'in' ? 0.7 : 0.55, wind: 0, moving: 0, fireT: 99, strafe: 1 };
    this.mobs.push(m); this.ev('ySpawn', { x, z, from });
    return m;
  };

  /** ヨシノシの部下：一番近い味方を集団でねらう。近くにいれば何体でも攻撃してくる。大砲は離れてビーム */
  P.updateYoshi = function (m, dt) {
    const J = DATA.JOBAN, W = J.wpn[m.wpn];
    m.wind = m.act && m.act.t < m.act.w ? 1 : 0; m.moving = 0;
    if (this.stage !== 'train') return;
    if (m.para > 0) { m.para -= dt; m.act = null; return; }
    if (m.act) { m.act.t += dt; if (m.act.t >= m.act.end) m.act = null; else return; }
    if (m.enterT > 0) { // 乗り込む／前の車両から入ってくる
      m.enterT -= dt; const s = m.spd * 0.8 * dt;
      const nx = m.from === 'door' ? m.x + s : m.x, nz = m.from === 'front' ? m.z - s : m.z;
      const c = this.clampTrain(m.x, m.z, nx, nz, m.r); m.x = c[0]; m.z = c[1]; m.moving = 1; return;
    }
    m.cd -= dt; m.retT -= dt;
    let tg = this.allies[m.tgt];
    if (m.retT <= 0 || !tg || tg.st !== 'ok') {
      m.retT = 0.4; let best = null, bd = 1e9;
      for (const o of this.allies) { if (o.st !== 'ok') continue; let d = dist2(m.x, m.z, o.x, o.z); if (o.buffs.stealth > 0) d += 6; if (o.buffs.taunt > 0) d -= 4; if (d < bd) { bd = d; best = o; } }
      m.tgt = best ? best.slot : -1; tg = best;
    }
    if (!tg) return;
    const dx = tg.x - m.x, dz = tg.z - m.z, d = Math.hypot(dx, dz) || 1e-3, ty = yawTo(dx, dz);
    m.yaw += clamp(angDiff(m.yaw, ty), -6 * dt, 6 * dt);
    const melee = m.wpn !== 'beam';
    let gx = null, gz = null;
    if (melee) { const stop = W.reach * 0.75; if (Math.abs(d - stop) > 0.15) { gx = tg.x - dx / d * stop; gz = tg.z - dz / d * stop; } }
    else if (d > W.keep + 1.5) { gx = tg.x - dx / d * W.keep; gz = tg.z - dz / d * W.keep; }
    else if (d < 3.6) { gx = m.x - dx / d * 2; gz = m.z - dz / d * 2; }
    let vx = 0, vz = 0;
    if (gx != null) { const ex = gx - m.x, ez = gz - m.z, el = Math.hypot(ex, ez); if (el > 0.12) { vx = ex / el; vz = ez / el; } }
    for (const o of this.mobs) { // 部下どうしで重ならない
      if (o === m || o.st !== 'ok') continue;
      const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz);
      if (od < 0.78 && od > 1e-4) { const k = (0.78 - od) / 0.78 * 1.8; vx += ox / od * k; vz += oz / od * k; }
    }
    const vl = Math.hypot(vx, vz);
    if (vl > 0.05) { const sp = m.spd * Math.min(1, vl); const c = this.clampTrain(m.x, m.z, m.x + vx / vl * sp * dt, m.z + vz / vl * sp * dt, m.r); m.x = c[0]; m.z = c[1]; m.moving = 1; }
    if (m.cd <= 0 && Math.abs(angDiff(m.yaw, ty)) < 0.45) {
      if (melee && d <= W.reach) this.yoshiAttack(m, tg); // 届く所にいれば何体でも
      else if (!melee && d <= W.reach && d >= 1.6) this.yoshiAttack(m, tg);
    }
  };

  /** 攻撃：予兆を出してから当たる。ダメージはまもりに関係なく50〜80 */
  P.yoshiAttack = function (m, tg) {
    const J = DATA.JOBAN, W = J.wpn[m.wpn];
    m.yaw = yawTo(tg.x - m.x, tg.z - m.z);
    const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
    const base = { warn: W.wind, act: W.act, pw: 0, stat: 'str', fixed: J.dmg, src: 'mob', srcEnt: m, srcId: m.id, knock: W.knock, kx: fx, kz: fz, max: 1, iv: 99 };
    if (m.wpn === 'sword') this.hz(Object.assign(base, { kind: 'fan', x: m.x, z: m.z, yaw: m.yaw, r0: 0, r1: W.r, half: W.half, fx: 'ysword', dodge: true }));
    else if (m.wpn === 'fist') this.hz(Object.assign(base, { kind: 'rect', x: m.x + fx * 0.25, z: m.z + fz * 0.25, yaw: m.yaw, len: W.len, w: W.w, fx: 'yfist', single: true }));
    else this.hz(Object.assign(base, { kind: 'line', x: m.x + fx * 0.5, z: m.z + fz * 0.5, yaw: m.yaw, len: W.len, w: W.w, fx: 'ybeam', dodge: true, single: true }));
    m.act = { t: 0, w: W.wind, end: W.wind + W.act + W.rec };
    m.cd = W.cd[0] + this.rng.next() * (W.cd[1] - W.cd[0]) + m.act.end;
    this.ev('yAtk', { w: m.wpn, x: m.x, z: m.z });
  };

  P.yoshiDie = function (m) {
    this.kills++;
    const gi = { p1: 0, p2: 1, p3: 2 }[m.grp]; if (gi != null) this.phaseKills[gi]++;
    for (const h of this.hazards) if (h.srcId === m.id && h.t < h.warn) h.dead = 1; // 振りかぶり中に倒れたら攻撃は出ない
    if (this.rng.next() < DATA.JOBAN.dropRate) this.spawnPickup('bag', m.x, m.z, DATA.ITEM_IDS[(this.rng.next() * DATA.ITEM_IDS.length) | 0]);
    this.ev('ykill', { n: this.kills });
  };
})();
