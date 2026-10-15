/* =====================================================================
   joban.js — ステージ「常磐線」：北千住→上野の車内でヨシノシンの部下135体と戦う
   sim.js の Sim に足す（ホストだけが動かす・three.js 非依存）。
   流れ：intro（トバトーバンが倒れる→ホームで乗車→発車）→ train（走りながら車内戦）
        → 上野の手前は、車内の部下をすべて倒すまで走り続ける → arrive（上野に到着）→ 勝利（チェックポイント）
   部下の動き（spawnYoshi / updateYoshi / yoshiAttack）は上野（ueno.js）でも使う。
   ===================================================================== */
(() => {
  const P = Sim.prototype;
  const TYPES = ['melee', 'beam', 'guard'];

  /** 最大剰余法：n体を割合で分け、合計をnにぴったり合わせる（同点は 近接→ビーム→防御 の順） */
  function mixCounts(n, mix, keys) {
    keys = keys || TYPES;
    const raw = keys.map(k => n * (mix[k] || 0)), out = raw.map(Math.floor);
    let rest = n - out.reduce((s, v) => s + v, 0);
    const order = keys.map((k, i) => i).sort((a, b) => (raw[b] - out[b]) - (raw[a] - out[a]) || a - b);
    for (let i = 0; rest > 0; i = (i + 1) % order.length, rest--) out[order[i]]++;
    return Object.fromEntries(keys.map((k, i) => [k, out[i]]));
  }
  Sim.mixCounts = mixCounts;

  P.initJoban = function (o) {
    this.stage = o.test ? 'train' : 'intro'; this.barrier = 'none';
    const J = DATA.JOBAN;
    this.kills = 0; this.total = J.events.reduce((s, e) => s + e.n, 0);
    this.fired = {}; this.grpKills = {}; this.grpN = {}; this.phase = 0; this.queue = []; this.spawnT = 0;
    this.ycfg = { types: J.types, rights: J.rights };
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
    this.fireEvent('p1');
    this.ev('stage', { k: 'train' });
  };

  /** イベントを一度だけ発生させる（同じIDは二度と出ない） */
  P.fireEvent = function (id) {
    if (this.fired[id]) return false;
    const J = DATA.JOBAN, E = J.events.find(e => e.id === id); if (!E) return false;
    this.fired[id] = this.t || 1e-6; this.grpN[id] = E.n; this.grpKills[id] = 0;
    const cnt = mixCounts(E.n, J.mix), list = [];
    for (const k of TYPES) for (let i = 0; i < cnt[k]; i++) list.push(k);
    for (let i = list.length - 1; i > 0; i--) { const j = (this.rng.next() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; } // 種類を混ぜる
    if (E.from === 'in') { for (const typ of list) this.spawnYoshi(this.rng.range(-1.1, 1.1), this.rng.range(9, 19), id, 'in', typ); }
    else for (const typ of list) this.queue.push({ grp: id, from: E.from, typ });
    if (id[0] === 'p') this.phase = +id[1];
    this.ev('jev', { id, n: E.n, from: E.from, st: E.from === 'door' ? +E.at.split(':')[1] : -1 });
    return true;
  };

  P.updateJoban = function (dt) {
    const J = DATA.JOBAN;
    if (this.stage === 'intro') { if (this.introWait) return; if (this.stageT >= J.introT) this.startTrain(); return; }
    if (this.stage === 'train' || this.stage === 'arrive') this.updateTrainMotion(dt);
    if (this.stage === 'train') { this.updateSpawns(dt); this.checkPhases(); }
    if (this.stage === 'arrive' && this.stageT >= J.arriveT) this.finish(true, 'ueno');
  };
  /** 上野に着ける条件：全イベント発生済み・待機列0・生存0 */
  P.jobanCleared = function () { return DATA.JOBAN.events.every(e => this.fired[e.id]) && !this.queue.length && !this.mobs.some(m => m.st === 'ok'); };
  /** 車内にいる数・待っている数（表示用） */
  P.jobanCounts = function () { return { alive: this.mobs.filter(m => m.st === 'ok').length, wait: this.queue.length }; };

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
    const L = J.segLen[tr.at];
    // 区間中央：走行距離が50%を越えたら一度だけ（フレームが飛んでも、50%に居続けても一度）
    if (tr.at >= 1 && tr.at <= 3 && tr.d >= L * J.midFrac) this.fireEvent('mid_' + tr.at);
    const hold = tr.at === 3 && !this.jobanCleared();
    const rem = L - tr.d, brakeD = tr.v * tr.v / (2 * J.acc);
    if (hold) { tr.v = Math.min(J.vmax, tr.v + J.acc * dt); tr.d = Math.min(tr.d + tr.v * dt, L - J.vmax * J.vmax / (2 * J.acc) - 60); if (tr.d >= L * J.midFrac) this.fireEvent('mid_3'); return; }
    if (rem <= brakeD + 0.3) { tr.v = Math.max(0.7, Math.sqrt(Math.max(0, 2 * J.acc * rem))); tr.d += tr.v * dt; }
    else { tr.v = Math.min(J.vmax, tr.v + J.acc * dt); tr.d += tr.v * dt; }
    if (L - tr.d <= 0.05) {
      tr.at++; tr.d = 0; tr.v = 0; tr.ph = 'stop'; tr.t = 0; tr.doors = 0;
      this.ev('arriveSt', { st: tr.at });
      if (tr.at >= 4) { this.stage = 'arrive'; this.stageT = 0; for (const a of this.allies) a.inv = 99; this.ev('stage', { k: 'arrive' }); }
    }
  };

  /** 途中駅：ホーム側のドアから乗ってくる（南千住15体・三河島15体・日暮里25体） */
  P.boardAt = function (st) {
    const id = DATA.JOBAN.events.find(e => e.at === 'st:' + st).id;
    if (this.fireEvent(id)) this.ev('board', { st, n: this.grpN[id] });
  };
  /** 初期3波：第1波10体をすべて倒すと15体、その15体を倒すと20体（駅・区間中央の撃破は数えない） */
  P.checkPhases = function () {
    if (this.fired.p1 && !this.fired.p2 && this.grpKills.p1 >= this.grpN.p1) { this.fireEvent('p2'); this.ev('wave', { n: 2, cnt: this.grpN.p2 }); }
    else if (this.fired.p2 && !this.fired.p3 && this.grpKills.p2 >= this.grpN.p2) { this.fireEvent('p3'); this.ev('wave', { n: 3, cnt: this.grpN.p3 }); }
  };
  /** 待っている部下を、車内が混みすぎない範囲（同時20体）で少しずつ出す */
  P.updateSpawns = function (dt) {
    const J = DATA.JOBAN; this.spawnT -= dt;
    if (this.spawnT > 0 || !this.queue.length) return;
    if (this.mobs.filter(m => m.st === 'ok').length >= J.maxActive) return;
    // 駅で乗ってくる分はドアが開いている間に優先して出す
    let qi = this.queue.findIndex(q => q.from === 'door');
    if (qi >= 0 && this.tr.doors !== 1) { for (const q of this.queue) if (q.from === 'door') q.from = 'front'; qi = -1; } // 乗り切れなかった分は乗車済みとして前の車両で待つ
    if (qi < 0) qi = this.queue.findIndex(q => q.from === 'front');
    if (qi < 0) qi = 0;
    const q = this.queue.splice(qi, 1)[0];
    if (q.from === 'door') { const z = J.carDoors[(this.rng.next() * J.carDoors.length) | 0]; this.spawnYoshi(-J.halfW + 0.3, z + this.rng.range(-0.4, 0.4), q.grp, 'door', q.typ); this.spawnT = 0.3; }
    else { this.spawnYoshi(this.rng.range(-1.0, 1.0), J.frontZ, q.grp, 'front', q.typ); this.spawnT = 0.24; }
  };

  /* ---------- ヨシノシンの部下（電車・上野で共通） ---------- */
  P.spawnYoshi = function (x, z, grp, from, typ) {
    const rng = this.rng, cfg = this.ycfg, T = cfg.types[typ] || cfg.types.melee;
    const wpn = T.wpn || (typ === 'beam' ? 'beam' : typ === 'guard' ? 'shield' : (rng.next() < 0.5 ? 'sword' : 'fist'));
    const m = { id: 'm' + this.id(), kind: 'yoshi', typ, T, wpn, grp, from, x, z, yaw: from === 'door' ? Math.PI / 2 : Math.PI, hp: T.hp, maxHp: T.hp, def: T.def, str: T.str, yo: T.yo, r: T.r || DATA.JOBAN.r, st: 'ok', t: 0, para: 0, defDown: 0, dots: [], dl: [],
      spd: T.spd * rng.range(0.97, 1.03), cd: 0.6 + rng.next() * 1.2, act: null, tgt: -1, retT: 0, enterT: from === 'in' ? 0.7 : from === 'drop' ? 0 : 0.55, wind: 0, moving: 0, fireT: 99, strafe: rng.next() < 0.5 ? 1 : -1, gT: 0, gCd: 0, scale: T.scale || 1 };
    this.mobs.push(m); this.ev('ySpawn', { x, z, from });
    return m;
  };
  /** 動いてよい場面か（電車：走行中の戦い／上野：ボス戦・睡眠中は止まる） */
  P.yoshiLive = function () { return this.stageId === 'ueno' ? this.uenoMinionsLive() : this.stage === 'train'; };
  /** 攻撃権：同時に攻撃を始められるのは 近接・防御で最大4体、ビームで最大1体（上野は2体） */
  P.yoshiCanAttack = function (m) {
    const R = this.ycfg.rights, beam = m.typ === 'beam'; let n = 0, all = 0;
    for (const o of this.mobs) if (o !== m && o.kind === 'yoshi' && o.act && o.st === 'ok') { all++; if ((o.typ === 'beam') === beam) n++; }
    if (R.all != null && all >= R.all) return false;
    return n < (beam ? R.beam : R.melee);
  };

  /** 一番近い味方を集団でねらう。攻撃権を持てたものだけが攻撃する。ビームは離れて撃つ。防御役は短くガードする */
  P.updateYoshi = function (m, dt) {
    const J = DATA.JOBAN, W = J.wpn[m.wpn === 'shield' ? 'shield' : m.wpn], T = m.T;
    m.wind = m.act && m.act.t < m.act.w ? 1 : 0; m.moving = 0;
    if (!this.yoshiLive()) return;
    if (m.para > 0) { m.para -= dt; m.act = null; return; }
    m.cd -= dt; m.gCd -= dt; if (m.gT > 0) m.gT -= dt;
    if (m.act) { m.act.t += dt; if (m.act.t >= m.act.end) m.act = null; else return; }
    if (m.enterT > 0) { // 乗り込む／前の車両から入ってくる
      m.enterT -= dt; const s = m.spd * 0.8 * dt;
      const nx = m.from === 'door' ? m.x + s : m.x, nz = m.from === 'front' ? m.z - s : m.from === 'back' ? m.z - s : m.z;
      const c = this.clampPos(m.x, m.z, nx, nz, m.r); m.x = c[0]; m.z = c[1]; m.moving = 1; return;
    }
    m.retT -= dt;
    let tg = this.allies[m.tgt];
    if (m.retT <= 0 || !tg || tg.st !== 'ok') {
      m.retT = 0.4; let best = null, bd = 1e9;
      for (const o of this.allies) { if (o.st !== 'ok') continue; let d = dist2(m.x, m.z, o.x, o.z); if (o.buffs.stealth > 0) d += 6; if (o.buffs.taunt > 0) d -= 4; if (d < bd) { bd = d; best = o; } }
      m.tgt = best ? best.slot : -1; tg = best;
    }
    if (!tg) return;
    const dx = tg.x - m.x, dz = tg.z - m.z, d = Math.hypot(dx, dz) || 1e-3, ty = yawTo(dx, dz);
    m.yaw += clamp(angDiff(m.yaw, ty), -6 * dt, 6 * dt);
    // 防御役：近くの味方が攻撃してきたら最大2秒だけ構える（再使用5秒・ずっとは構えない）
    if (m.typ === 'guard' && m.gT <= 0 && m.gCd <= 0 && d < 2.6 && tg.act && /^(combo|melee|heavy|release|counter|shot|cast|sp)$/.test(tg.act.k || '')) this.yoshiGuard(m);
    const melee = m.typ !== 'beam';
    let gx = null, gz = null;
    if (melee) { const stop = W.reach * 0.75; if (Math.abs(d - stop) > 0.15) { gx = tg.x - dx / d * stop; gz = tg.z - dz / d * stop; } }
    else if (d > W.keep + 1.5) { gx = tg.x - dx / d * W.keep; gz = tg.z - dz / d * W.keep; }
    else if (d < 3.6) { gx = m.x - dx / d * 2; gz = m.z - dz / d * 2; }
    let vx = 0, vz = 0;
    if (gx != null) { const ex = gx - m.x, ez = gz - m.z, el = Math.hypot(ex, ez); if (el > 0.12) { vx = ex / el; vz = ez / el; } }
    const sep = 0.78 * m.scale;
    for (const o of this.mobs) { // 部下どうしで重ならない
      if (o === m || o.st !== 'ok' || o.kind !== 'yoshi') continue;
      const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz);
      if (od < sep && od > 1e-4) { const k = (sep - od) / sep * 1.8; vx += ox / od * k; vz += oz / od * k; }
    }
    // 連結部（細い通路）では左右に寄って、1本の通路を塞がない
    if (this.stageId === 'joban' && Math.abs(m.z) < 2.2 && gx == null) vx += (m.x >= 0 ? 1 : -1) * 0.6;
    const vl = Math.hypot(vx, vz);
    if (vl > 0.05) { const sp = m.spd * Math.min(1, vl) * (m.gT > 0 ? 0.5 : 1) * (this.yoshiSpdMul ? this.yoshiSpdMul(m) : 1); const c = this.clampPos(m.x, m.z, m.x + vx / vl * sp * dt, m.z + vz / vl * sp * dt, m.r); m.x = c[0]; m.z = c[1]; m.moving = 1; }
    if (m.cd <= 0 && m.gT <= 0 && Math.abs(angDiff(m.yaw, ty)) < 0.45) {
      const inReach = melee ? d <= W.reach : (d <= W.reach && d >= 1.6);
      if (inReach) { if (this.yoshiCanAttack(m)) this.yoshiAttack(m, tg); else m.cd = 0.25; } // 攻撃権が空くのを待つ（移動はやめない）
    }
  };
  P.yoshiGuard = function (m) { const T = m.T; m.gT = T.gMax || 2; m.gCd = T.gCd || 5; this.ev('yGuard', { id: m.id, x: m.x, z: m.z }); };
  /** 敵（部下）が受けるダメージの倍率：防御役のガード中は×0.7。上野では睡眠中のボス×2を ueno.js が足す */
  P.enemyDmgMul = function (e) { let k = 1; if (e.gT > 0) k *= (e.T && e.T.gMul) || 0.7; if (this.uenoDmgMul) k *= this.uenoDmgMul(e); return k; };
  P.afterEnemyHit = function (e, dmg, a, kind) {
    if (e.kind === 'yoshi' && e.typ === 'guard' && e.gT <= 0 && e.gCd <= 0 && e.hp > 0 && !e.act) this.yoshiGuard(e); // 殴られたら構える
    if (this.uenoAfterHit) this.uenoAfterHit(e, dmg, a, kind);
  };

  /** 攻撃：予兆を出してから当たる。ダメージは共通式（威力×ちから or ようりょく÷(120＋まもり)） */
  P.yoshiAttack = function (m, tg) {
    const J = DATA.JOBAN, W = J.wpn[m.wpn], T = m.T;
    m.yaw = yawTo(tg.x - m.x, tg.z - m.z);
    const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), warn = T.warn;
    const base = { warn, act: W.act, pw: T.pw, stat: T.stat, srcStats: { str: m.str, yo: m.yo }, src: 'mob', srcEnt: m, srcId: m.id, knock: W.knock, kx: fx, kz: fz, max: 1, iv: 99 };
    let h;
    if (m.wpn === 'sword') h = this.hz(Object.assign(base, { kind: 'fan', x: m.x, z: m.z, yaw: m.yaw, r0: 0, r1: W.r, half: W.half, fx: 'ysword', dodge: true }));
    else if (m.wpn === 'fist' || m.wpn === 'shield') h = this.hz(Object.assign(base, { kind: 'rect', x: m.x + fx * 0.25, z: m.z + fz * 0.25, yaw: m.yaw, len: W.len, w: W.w, fx: 'yfist', single: true }));
    else h = this.hz(Object.assign(base, { kind: 'line', x: m.x + fx * 0.5, z: m.z + fz * 0.5, yaw: m.yaw, len: T.len || W.len, w: W.w, fx: 'ybeam', dodge: true, single: true, hook: 'yBeam' })); // 幅0.7m：通路（3m）の左右に逃げ幅が残る
    m.act = { t: 0, w: warn, end: warn + W.act + W.rec };
    m.cd = T.period + this.rng.next() * 0.4; // 準備開始から次の準備開始までの最短周期
    this.ev('yAtk', { w: m.wpn, x: m.x, z: m.z });
    return h;
  };

  P.yoshiDie = function (m) {
    this.kills++;
    if (this.grpKills && this.grpKills[m.grp] != null) this.grpKills[m.grp]++;
    for (const h of this.hazards) if (h.srcId === m.id && h.t < h.warn) h.dead = 1; // 振りかぶり中に倒れたら攻撃は出ない
    if (this.stageId === 'joban' && this.rng.next() < DATA.JOBAN.dropRate) this.spawnPickup('bag', m.x, m.z, DATA.ITEM_IDS[(this.rng.next() * DATA.ITEM_IDS.length) | 0]);
    if (this.uenoMinionDie) this.uenoMinionDie(m);
    this.ev('ykill', { n: this.kills });
  };
})();
