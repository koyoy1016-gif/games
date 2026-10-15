/* =====================================================================
   ueno.js — 上野編のボス戦：上野駅前の広場で指揮官ヨシノシンと部下（妖怪人形）と戦う
   sim.js の Sim に足す（ホストだけが動かす・three.js 非依存）。部下の動きは joban.js と共通。
   流れ：intro（指を鳴らす→36体が走り出す・約3秒）→ boss（本体＋部下）→ won / lost
   優先順位：撃破 ＞ 未成功の睡眠チェック ＞ 予約済みの二十連 ＞ ふつうの行動
   ===================================================================== */
(() => {
  const P = Sim.prototype;
  const U = () => DATA.UENO;

  P.initUeno = function (o) {
    const D = U();
    this.stage = o.test ? 'boss' : 'intro'; this.barrier = 'none'; this.lanterns = [];
    this.kills = 0; this.total = 0; this.queue = null;
    this.ycfg = { types: D.minions, rights: D.rights };
    // 平均Lv（出動開始時の4体・切り捨て）で決まる上野だけの補正。途中の操作交代では変えない
    const Pl = Math.floor(this.allies.reduce((s, a) => s + a.lv, 0) / this.allies.length);
    this.uenoLv = Pl;
    this.lvOut = clamp(1 + D.lvOut.k * (Pl - D.rec), D.lvOut.lo, D.lvOut.hi);
    this.lvIn = clamp(1 - D.lvIn.k * (Pl - D.rec), D.lvIn.lo, D.lvIn.hi);
    this.U = { thrFlag: {}, thrQ: 0, thrUsed: 0, thr: null, sleepArmed: true, sleepPend: false, sleepCarry: 0, sleep: null, sleepDone: false, sleepWarn: false, barrier: null, cmdN: 0, shoshaI: 0, reserve: 0, lastSleep: null };
    for (const a of this.allies) {
      const q = D.start[a.slot]; a.x = a.px = q[0]; a.z = a.pz = q[1]; a.yaw = 0; a.ai.tx = a.x; a.ai.tz = a.z + 1;
      a.sp = Math.max(a.sp, 50); // 妖気は最低50（高ければそのまま）
      if (o.carry && o.carry[a.slot]) a.items.forEach((it, i) => { if (o.carry[a.slot][i] != null) it.n = o.carry[a.slot][i]; }); // 電車から続けるときは所持数を引き継ぐ
    }
    const [bx, bz] = D.bossSpawn;
    this.boss = { id: 'boss', kind: 'yoshinoshin', x: bx, z: bz, y: 0, yaw: Math.PI, hp: D.hp, maxHp: D.hp, str: D.str, yo: D.yo, def: D.def, st: o.test ? 'idle' : 'intro', mv: null, t: 0, gap: 1.2, phase: 1, cds: {}, target: 0, defDown: 0, paraImm: 0, dots: [], dl: [], fl: null, downT: 0, stunT: 0, lastAtk: -99, wantWarp: false, hz: null, home: [bx, bz] };
    if (o.test) this.boss.testIdle = !!o.idle;
    // 最初の36体：6列に並び、開始と同時に全員が前進する（小分けのウェーブにしない）
    const kinds = []; for (const k of ['melee', 'guard', 'beam']) for (let i = 0; i < D.init[k]; i++) kinds.push(k);
    const front = kinds.filter(k => k !== 'beam'); for (let i = front.length - 1; i > 0; i--) { const j = (this.rng.next() * (i + 1)) | 0; [front[i], front[j]] = [front[j], front[i]]; }
    const order = front.slice(0, 30).concat(kinds.filter(k => k === 'beam'), front.slice(30)); // 射撃は後ろの列
    order.forEach((k, i) => { const row = Math.floor(i / 6), col = i % 6; this.spawnYoshi(-7.5 + col * 3 + (row % 2 ? 0.75 : -0.75), 12 + row * 1.2, 'init', 'in', k); });
    for (const m of this.mobs) { m.enterT = 0; m.yaw = Math.PI; m.cd = 0.4 + this.rng.next() * 1.6; }
  };

  /** 広場の外へは出ない。本体の体は通り抜けない */
  P.clampUeno = function (ox, oz, nx, nz, rad) {
    const D = U(); nx = clamp(nx, -D.halfX + rad, D.halfX - rad); nz = clamp(nz, 0.2 + rad, D.zMax - rad);
    const b = this.boss;
    if (b && b.st !== 'hidden' && b.st !== 'dead' && b.y < 1.2) for (const q of bossParts(b)) {
      const dx = nx - q.x, dz = nz - q.z, d = Math.hypot(dx, dz), m = q.r + rad;
      if (d < m) { if (d < 1e-4) nx = q.x + m; else { nx = q.x + dx / d * m; nz = q.z + dz / d * m; } }
    }
    return [nx, nz];
  };
  P.uenoMinionsLive = function () { return this.stage === 'boss' && !this.U.sleep && this.boss && this.boss.st !== 'dead'; };
  P.uenoAlive = function () { let n = 0; for (const m of this.mobs) if (m.st === 'ok' || m.st === 'fly') n++; return n; };

  P.updateUenoStage = function (dt) {
    if (this.stage === 'intro') {
      if (this.introWait) return;
      if (this.stageT >= 1.0 && !this._snap) { this._snap = 1; this.ev('sfx', { s: 'snap' }); this.ev('snap', {}); } // 指を鳴らす
      if (this.stageT >= U().introT) { this.stage = 'boss'; this.stageT = 0; const b = this.boss; b.st = 'idle'; b.t = 0; b.gap = 1.0; this.ev('stage', { k: 'fight' }); }
    }
  };

  /* ---------- 被ダメージ・バリア・HPのしきい値 ---------- */
  /** バリア中の本体には通常ダメージが通らない */
  P.uenoBlock = function (e) { if (e !== this.boss || !this.U || !this.U.barrier) return false; this.ev('bblock', { x: e.x, z: e.z }); return true; };
  /** 睡眠中の本体は被ダメージ×2（Lv補正とは別に一度だけ） */
  P.uenoDmgMul = function (e) { return e === this.boss && this.U && this.U.sleep ? U().moves.sleep.mul : 1; };
  P.uenoAfterHit = function (e, dmg) {
    const b = this.boss, Us = this.U; if (e !== b || !Us) return;
    const M = U().moves, max = b.maxHp, hp = Math.max(0, b.hp), prev = hp + dmg;
    if (Us.sleep) { Us.sleep.dmg += dmg; return; } // 実ダメージだけを数える（反射・味方への爆発・回復は入らない）
    if (hp <= 0) return; // 撃破が優先
    if (Us.sleepArmed && !Us.sleepDone && !Us.sleepWarn && prev > max * M.sleep.warnAt && hp <= max * M.sleep.warnAt && hp > max * M.sleep.at) { Us.sleepWarn = true; this.ev('sleepWarn', {}); }
    if (Us.sleepArmed && !Us.sleepDone && prev > max * M.sleep.at && hp <= max * M.sleep.at) { // 半分を上からまたいだ：余剰だけを一度計上
      Us.sleepArmed = false; Us.sleepPend = true; Us.sleepCarry = Math.round(max * M.sleep.at - hp); this.ev('sleepPend', {});
    }
    for (const f of M.throw20.at) if (!Us.thrFlag[f] && prev > max * f && hp <= max * f) { Us.thrFlag[f] = 1; Us.thrQ++; } // 使用済みは全回復でも戻さない
  };

  /** 射撃部下のビームが本体を通ったか（味方に当たって止まった場合は届かない） */
  P.hzHook = function (h) {
    if (h.hook !== 'yBeam' || this.stageId !== 'ueno') return;
    const Us = this.U, b = this.boss; if (!Us.barrier || !b || b.st === 'dead' || b.st === 'hidden') return;
    if (Us.barrier.seen[h.id]) return; // 1本のビームを2回に数えない
    const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), R = U().bossR;
    if (!inLine(b.x, b.z, h.x, h.z, h.yaw, h.len, h.w / 2, R)) return;
    const fb = (b.x - h.x) * fx + (b.z - h.z) * fz;
    for (const o of this.allies) if (o.st === 'ok' && inLine(o.x, o.z, h.x, h.z, h.yaw, h.len, h.w / 2, DATA.MOB.allyR) && (o.x - h.x) * fx + (o.z - h.z) * fz < fb && !(o.inv > 0)) return; // 手前の味方で止まった
    Us.barrier.seen[h.id] = 1; Us.barrier.hits++;
    this.ev('bhit', { n: Us.barrier.hits, x: b.x, z: b.z });
    if (Us.barrier.hits >= U().moves.barrier.hits) this.endBarrier(true);
  };
  P.endBarrier = function (broken) {
    const Us = this.U, b = this.boss; if (!Us.barrier) return;
    Us.barrier = null; this.ev('barrier', { on: 0, broken: broken ? 1 : 0 });
    if (broken && (b.st === 'idle' || b.st === 'walk' || b.st === 'rec' || b.st === 'act' || b.st === 'wind') && b.mv !== 'throw20') { this.clearBossHz(); b.st = 'stun'; b.stunT = U().moves.barrier.stagger; b.t = 0; b.mv = null; b.hz = null; }
  };
  P.clearBossHz = function () { this.hazards = this.hazards.filter(h => h.src !== 'boss' || h.t > h.warn || h.keepOnCancel); };

  /* ---------- ボスの行動 ---------- */
  P.uenoTarget = function () {
    const b = this.boss; let best = null, bs = -1;
    for (const o of this.allies) { if (o.st !== 'ok') continue; const d = dist2(b.x, b.z, o.x, o.z); const s = (o.buffs.stealth > 0 ? 0.25 : 1) * (1 + o.threat / 900) / (1 + d / 7) * (o.buffs.taunt > 0 ? 3 : 1); if (s > bs) { bs = s; best = o; } }
    if (best) b.target = best.slot; return best;
  };
  P.updateUenoBoss = function (dt) {
    const b = this.boss, Us = this.U, D = U(), M = D.moves;
    if (!b) return;
    b.t += dt;
    for (const k in b.cds) if (b.cds[k] > 0) b.cds[k] -= dt;
    if (b.st === 'dead' || this.stage === 'won' || this.stage === 'lost') return;
    if (this.stage === 'intro') { b.st = 'intro'; return; }
    if (Us.barrier) { Us.barrier.t += dt; if (Us.barrier.t >= M.barrier.max) this.endBarrier(false); } // 最大8秒で必ず解除
    // 睡眠チェック中
    if (b.st === 'sleep') {
      const S = Us.sleep; S.t += dt;
      if (S.dmg >= M.sleep.need) { // 成功：回復を中断して4秒ダウン。以後は眠らない
        Us.sleep = null; Us.sleepDone = true; Us.lastSleep = { ok: 1, dmg: S.dmg }; b.st = 'down'; b.t = 0; b.downT = M.sleep.down; b.mv = null; this.ev('sleepEnd', { ok: 1, dmg: Math.round(S.dmg) }); this.ev('bossdown', {});
      } else if (S.t >= M.sleep.dur) { // 失敗：最大HPまで戻り、また半分で同じ判定
        Us.sleep = null; Us.sleepArmed = true; Us.sleepWarn = false; Us.lastSleep = { ok: 0, dmg: S.dmg }; b.hp = b.maxHp; b.st = 'idle'; b.t = 0; b.gap = 1.0; b.mv = null; this.ev('sleepEnd', { ok: 0, dmg: Math.round(S.dmg) });
      }
      return;
    }
    if (b.st === 'down') { b.downT -= dt; if (b.downT <= 0) { b.st = 'idle'; b.t = 0; b.gap = 0.8; } return; }
    if (b.st === 'stun') { b.stunT -= dt; if (b.stunT <= 0) { b.st = 'idle'; b.t = 0; b.gap = 0.6; } return; }
    // 二十連の投げ（本体の状態とは別に進む）
    if (Us.thr) this.updateThrow(dt);
    // 睡眠の開始待ち：二十連の途中なら全員の着地を待ってから
    if (Us.sleepPend && !Us.thr && !this.mobs.some(m => m.st === 'fly')) { this.startSleep(); return; }
    if (Us.sleepPend && (b.st === 'idle' || b.st === 'walk')) return; // 待っている間は新しい大技・動員をしない
    switch (b.st) {
      case 'idle': case 'walk': {
        const tg = this.uenoTarget();
        if (tg) { const ty = yawTo(tg.x - b.x, tg.z - b.z); b.yaw += clamp(angDiff(b.yaw, ty), -2.2 * dt, 2.2 * dt); }
        // 位置調整：部下の後ろ（奥）を保ち、追い回さない
        if (b.home) { const dx = b.home[0] - b.x, dz = b.home[1] - b.z, d = Math.hypot(dx, dz); if (d > 0.3) { const s = Math.min(d, 1.6 * dt); b.x += dx / d * s; b.z += dz / d * s; b.st = 'walk'; } else b.st = 'idle'; }
        if (b.testIdle) return;
        b.gap -= dt; if (b.gap <= 0) this.uenoDecide();
        return;
      }
      case 'hidden': case 'wind': case 'act': case 'rec': this.updateUenoMove(dt); return;
    }
  };

  /** 次の行動を決める：指揮・待機・位置調整 3 に対して 直接攻撃 2 くらい。直接攻撃の開始は3秒以上あける */
  P.uenoDecide = function () {
    const b = this.boss, Us = this.U, D = U(), M = D.moves, alive = this.uenoAlive();
    const tg = this.uenoTarget(); if (!tg) { b.gap = 0.5; return; }
    const cd = k => !(b.cds[k] > 0), dT = dist2(b.x, b.z, tg.x, tg.z);
    // 予約済みの二十連：生存が20体以下になったら必ず20体
    if (Us.thrQ > 0 && !Us.thr && alive <= D.cap - M.throw20.n) return this.startMove('throw20');
    if (b.wantWarp && cd('warp')) return this.startMove('warp');
    if (!Us.thrQ && alive <= M.summon.at && cd('summon') && alive + M.summon.n <= D.cap) return this.startMove('summon');
    if (!Us.barrier && cd('barrier') && this.stageT > 18 && this.mobs.some(m => m.st === 'ok' && m.typ === 'beam') && this.rng.next() < 0.35) return this.startMove('barrier');
    const ready = this.t - b.lastAtk >= D.minGap;
    let near = null, nd = 1e9; for (const o of this.allies) if (o.st === 'ok') { const d = dist2(b.x, b.z, o.x, o.z); if (d < nd) { nd = d; near = o; } }
    if (ready && near && nd < M.shosho.near && cd('shosho')) return this.startMove('shosho', near); // 近づいた味方へ連掌（そのあと後方へワープ）
    if (ready && Us.cmdN <= 0) {
      const c = [];
      if (cd('reiko') && dT < M.reiko.range) c.push(['reiko', 3]);
      if (cd('shosha')) c.push(['shosha', 2]);
      if (cd('stamp') && this.allies.filter(o => o.st === 'ok' && dist2(o.x, o.z, D.center[0], D.center[1]) < M.stamp.r + 2.5).length >= 1) c.push(['stamp', 1.3]);
      if (c.length) { let r = this.rng.next() * c.reduce((s, q) => s + q[1], 0); for (const [k, w] of c) { r -= w; if (r <= 0) return this.startMove(k, tg); } return this.startMove(c[0][0], tg); }
    }
    // 指揮（部下へ号令）・待機・位置調整
    Us.cmdN--;
    if (cd('warp') && dT < 2.6 && this.rng.next() < 0.5) return this.startMove('warp');
    const cx = this.allies.filter(o => o.st === 'ok').reduce((s, o, i, arr) => s + o.x / arr.length, 0);
    b.home = [clamp(cx * 0.6 + this.rng.range(-3, 3), -11, 11), clamp(this.rng.range(19, 24), 17, 25.5)];
    if (this.rng.next() < 0.5) return this.startMove('cmd');
    b.gap = 0.9 + this.rng.next() * 0.8;
  };

  P.startMove = function (mv, tg) {
    const b = this.boss, D = U(), M = D.moves[mv] || { warn: 1.0 }, Us = this.U;
    b.mv = mv; b.t = 0; b.st = 'wind'; b.hz = null; b.ms = { tg: tg ? tg.slot : b.target, n: 0 };
    if (['reiko', 'shosho', 'stamp', 'shosha'].includes(mv)) { b.lastAtk = this.t; Us.cmdN = 1 + (this.rng.next() < 0.5 ? 1 : 0); }
    if (M.cd) b.cds[mv] = M.cd;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    if (mv === 'reiko') { // 3方向の光弾：準備中は3本の細い線で予告
      const t = this.allies[b.ms.tg]; if (t) b.yaw = yawTo(t.x - b.x, t.z - b.z);
      for (let i = -1; i <= 1; i++) this.hz({ kind: 'line', x: b.x + Math.sin(b.yaw) * 0.9, z: b.z + Math.cos(b.yaw) * 0.9, yaw: b.yaw + i * M.spread, len: 9, w: 0.45, warn: M.warn, act: 0, src: 'boss', fx: 'reikoW' });
    } else if (mv === 'shosho') { // 前半は向きを追い、最後の0.25秒は固定
      b.hz = this.hz({ kind: 'rect', x: b.x + fx * 0.5, z: b.z + fz * 0.5, yaw: b.yaw, len: M.len, w: M.w, warn: M.warn, act: M.act, pw: M.pw, stat: M.stat, src: 'boss', knock: 5, fx: 'shosho' });
    } else if (mv === 'stamp') { // 広場中央の到着印へワープしてから踏み下ろす
      const [cx, cz] = D.center; b.ms.to = [cx, cz]; b.st = 'hidden';
      this.hz({ kind: 'circle', x: cx, z: cz, r: M.r, warn: M.warn, act: M.act, pw: M.pw, stat: M.stat, src: 'boss', knock: 6, fx: 'stamp' });
    } else if (mv === 'shosha') {
      const form = ['front4', 'surround4', 'track3'][Us.shoshaI++ % 3]; b.ms.form = form; b.ms.grp = { hits: {}, max: 1 };
      if (form !== 'track3') this.shoshaVolley(form);
    } else if (mv === 'warp') {
      const to = this.warpSpot(); b.ms.to = to;
      this.hz({ kind: 'circle', x: to[0], z: to[1], r: 1.1, warn: M.warn + M.act, act: 0, src: 'boss', fx: 'warp' });
    } else if (mv === 'throw20') { Us.thrQ--; Us.thrUsed++; Us.reserve = M.n; }
    this.ev('bossmove', { mv });
  };
  /** 号令四連照射：前方へ横並び4本／周囲4本（追跡3発は updateUenoMove で） */
  P.shoshaVolley = function (form) {
    const b = this.boss, M = U().moves.shosha, t = this.allies[b.ms.tg] || this.allies.find(o => o.st === 'ok'), pts = [];
    if (form === 'front4') {
      const yaw = t ? yawTo(t.x - b.x, t.z - b.z) : b.yaw, d = t ? clamp(dist2(b.x, b.z, t.x, t.z), 4, 9) : 6, cx = b.x + Math.sin(yaw) * d, cz = b.z + Math.cos(yaw) * d, px = Math.cos(yaw), pz = -Math.sin(yaw);
      for (const k of [-1.5, -0.5, 0.5, 1.5]) pts.push([cx + px * k * M.gap, cz + pz * k * M.gap]);
    } else for (let k = 0; k < 4; k++) { const a = b.yaw + Math.PI / 4 + k * Math.PI / 2; pts.push([b.x + Math.sin(a) * 4.2, b.z + Math.cos(a) * 4.2]); }
    for (const [x, z] of pts) { const c = this.clampUeno(x, z, x, z, 0.1); this.hz({ kind: 'circle', x: c[0], z: c[1], r: M.r, warn: M.warn, act: M.act, pw: M.pw, stat: M.stat, src: 'boss', fx: 'ubeam', grp: b.ms.grp }); }
  };
  /** ワープ先：奥の通行できる場所。入口や味方の真下には出ない */
  P.warpSpot = function () {
    const b = this.boss, D = U();
    for (let k = 0; k < 24; k++) {
      const x = this.rng.range(-11, 11), z = this.rng.range(19.5, 25);
      if (this.allies.some(o => o.st !== 'gone' && dist2(o.x, o.z, x, z) < 4)) continue;
      if (dist2(b.x, b.z, x, z) < 4) continue;
      return [x, z];
    }
    return [-b.x * 0.5, 23];
  };

  P.updateUenoMove = function (dt) {
    const b = this.boss, D = U(), mv = b.mv, M = D.moves[mv] || { warn: 1.0, rec: 0.6 }, Us = this.U, t = b.t;
    const toRec = () => { b.st = 'rec'; b.t = 0; };
    const done = () => { b.st = 'idle'; b.t = 0; b.mv = null; b.hz = null; b.gap = 0.5 + this.rng.next() * 0.6; };
    if (b.st === 'rec') { if (t >= (M.rec != null ? M.rec : 0.5)) { if (mv === 'shosho') b.wantWarp = true; done(); } return; }
    switch (mv) {
      case 'cmd': if (t >= 1.3) done(); return; // 札を振って号令（攻撃はしない）
      case 'reiko':
        if (b.st === 'wind' && t >= M.warn) {
          for (let i = -1; i <= 1; i++) { const yaw = b.yaw + i * M.spread, fx = Math.sin(yaw), fz = Math.cos(yaw); this.projs.push({ id: this.id(), kind: 'reiko', team: 'enemy', x: b.x + fx * 0.9, y: 1.6, z: b.z + fz * 0.9, vx: fx * M.speed, vz: fz * M.speed, life: M.range / M.speed, r: M.r, pw: M.pw, stat: M.stat, src: b, srcEnt: b, hit: new Set(), yaw }); }
          this.ev('bossfire', { mv }); toRec();
        } else if (b.st === 'wind') { const tg = this.allies[b.ms.tg]; if (tg && tg.st === 'ok') b.yaw += clamp(angDiff(b.yaw, yawTo(tg.x - b.x, tg.z - b.z)), -1.5 * dt, 1.5 * dt); }
        return;
      case 'shosho': {
        const tg = this.allies[b.ms.tg];
        if (b.st === 'wind') {
          if (t < M.warn - M.lockT && tg && tg.st === 'ok') { b.yaw += clamp(angDiff(b.yaw, yawTo(tg.x - b.x, tg.z - b.z)), -4 * dt, 4 * dt); if (b.hz) { b.hz.yaw = b.yaw; b.hz.x = b.x + Math.sin(b.yaw) * 0.5; b.hz.z = b.z + Math.cos(b.yaw) * 0.5; } }
          if (t >= M.warn) { b.st = 'act'; b.t = 0; this.ev('bossfire', { mv }); }
        } else if (b.st === 'act' && t >= M.act) toRec();
        return;
      }
      case 'stamp':
        if (b.st === 'hidden' && t >= 0.3) { b.x = b.ms.to[0]; b.z = b.ms.to[1]; b.st = 'wind'; b.home = [b.x, b.z]; for (const a of this.allies) { const r = this.clampPos(a.x, a.z, a.x, a.z, 0.35); a.x = r[0]; a.z = r[1]; } this.ev('warpIn', { x: b.x, z: b.z }); }
        if (b.st === 'wind') { b.y = Math.min(0.7, Math.max(0, (t - 0.4) / (M.warn - 0.4)) * 0.7); if (t >= M.warn) { b.y = 0; b.st = 'act'; b.t = 0; this.ev('bossfire', { mv }); } }
        else if (b.st === 'act' && t >= M.act) { toRec(); b.home = [clamp(b.x, -10, 10), 22]; }
        return;
      case 'shosha':
        if (b.ms.form === 'track3') { // 追跡3発：0.9秒ずつずらし、それぞれ1.3秒前に位置を固定
          if (b.st === 'wind' && t >= 0.4) { b.st = 'act'; b.t = 0; }
          if (b.st === 'act') {
            while (b.ms.n < 3 && b.t >= b.ms.n * M.iv) {
              const alive = this.allies.filter(o => o.st === 'ok').sort((p, q) => dist2(b.x, b.z, p.x, p.z) - dist2(b.x, b.z, q.x, q.z)), o = alive[b.ms.n % Math.max(1, alive.length)];
              if (o) this.hz({ kind: 'circle', x: o.x, z: o.z, r: M.r, warn: M.warn, act: M.act, pw: M.pw, stat: M.stat, src: 'boss', fx: 'ubeam' });
              b.ms.n++;
            }
            if (b.t >= 2 * M.iv + M.warn + M.act) toRec();
          }
        } else {
          if (b.st === 'wind' && t >= M.warn) { b.st = 'act'; b.t = 0; this.ev('bossfire', { mv }); }
          else if (b.st === 'act' && t >= M.act) toRec();
        }
        return;
      case 'warp':
        if (b.st === 'wind' && t >= M.warn) { b.st = 'hidden'; b.t = 0; }
        else if (b.st === 'hidden' && t >= M.act) { b.x = b.ms.to[0]; b.z = b.ms.to[1]; b.home = [b.x, b.z]; b.wantWarp = false; b.st = 'rec'; b.t = 0; this.ev('warpIn', { x: b.x, z: b.z }); }
        return;
      case 'summon':
        if (b.st === 'wind' && t >= M.warn) {
          const n = Math.min(M.n, U().cap - this.uenoAlive());
          for (let i = 0; i < n; i++) { const x = -7.5 + i * 3 + this.rng.range(-0.5, 0.5); this.spawnYoshi(x, D.zMax - 0.6, 'summon', 'back', i === 2 ? 'beam' : i === 4 ? 'guard' : 'melee'); }
          this.ev('summon', { n }); b.st = 'rec'; b.t = 0;
        }
        return;
      case 'barrier':
        if (b.st === 'wind' && t >= M.warn) { Us.barrier = { t: 0, hits: 0, seen: {} }; this.ev('barrier', { on: 1 }); b.st = 'rec'; b.t = 0; }
        return;
      case 'throw20':
        if (b.st === 'wind' && t >= M.warn) { b.st = 'act'; b.t = 0; Us.thr = { i: 0, t: 0, grp: { hits: {}, max: M.maxHits }, pts: [] }; }
        else if (b.st === 'act' && !Us.thr && t > 0.2) { b.st = 'rec'; b.t = 0; }
        return;
    }
    if (t > 6) done(); // 念のため
  };

  /** 部下丸投げ二十連：0.18秒ごとに1体、約1.1秒後に着地。着地点は散らし、入口と左右の退避帯を残す */
  P.updateThrow = function (dt) {
    const b = this.boss, Us = this.U, M = U().moves.throw20, T = Us.thr;
    T.t += dt;
    while (T.i < M.n && T.t >= T.i * M.iv) {
      const pt = this.throwSpot(T.pts); T.pts.push(pt);
      this.hz({ kind: 'circle', x: pt[0], z: pt[1], r: M.r, warn: M.land, act: 0.1, pw: M.pw, stat: M.stat, src: 'boss', fx: 'throw', grp: T.grp, keepOnCancel: true });
      const m = this.spawnYoshi(b.x, b.z, 'throw', 'drop', 'thrown');
      m.st = 'fly'; m.fly = { t: 0, x0: b.x + Math.sin(b.yaw + 1.2) * 0.8, z0: b.z + Math.cos(b.yaw + 1.2) * 0.8, x1: pt[0], z1: pt[1] }; m.x = m.fly.x0; m.z = m.fly.z0; m.air = 2.2;
      T.i++; Us.reserve = Math.max(0, Us.reserve - 1);
      this.ev('sfx', { s: 'gDrop', x: b.x, z: b.z });
    }
    if (T.i >= M.n) Us.thr = null;
  };
  P.throwSpot = function (prev) {
    const D = U(), alive = this.allies.filter(o => o.st === 'ok');
    for (let k = 0; k < 40; k++) {
      let x, z;
      if (alive.length && this.rng.next() < 0.6) { const o = alive[(this.rng.next() * alive.length) | 0], a = this.rng.next() * TAU, r = this.rng.range(2.5, 6.5); x = o.x + Math.sin(a) * r; z = o.z + Math.cos(a) * r; }
      else { x = this.rng.range(-12.5, 12.5); z = this.rng.range(4, 22); }
      if (Math.abs(x) > D.halfX - 3 || z < 3 || z > D.zMax - 2) continue; // 左右の退避帯と入口は空ける
      if (dist2(x, z, this.boss.x, this.boss.z) < 2.2) continue;
      if (prev.some(p => dist2(p[0], p[1], x, z) < 1.5)) continue; // 1点に重ねない
      return [x, z];
    }
    return [this.rng.range(-10, 10), this.rng.range(6, 20)];
  };
  /** 投げられた部下の飛行（放物線）。着地後1秒は攻撃しない */
  P.updateFly = function (m, dt) {
    const F = m.fly, L = U().moves.throw20.land; F.t += dt; const k = Math.min(1, F.t / L);
    m.x = F.x0 + (F.x1 - F.x0) * k; m.z = F.z0 + (F.z1 - F.z0) * k; m.air = 2.2 * (1 - k) + 3.2 * 4 * k * (1 - k) * 0.6;
    if (k >= 1) { m.st = 'ok'; m.air = 0; m.fly = null; m.enterT = 0; m.cd = Math.max(m.cd, U().moves.throw20.calm + 0.2 + this.rng.next() * 0.8); this.ev('yLand', { x: m.x, z: m.z }); }
  };

  /** 30分睡眠チャージ：10秒以内に4体合計3,000ダメージで阻止 */
  P.startSleep = function () {
    const b = this.boss, Us = this.U;
    Us.sleepPend = false; this.endBarrier(false);
    this.hazards = this.hazards.filter(h => h.src !== 'boss' && !(h.src === 'mob' && h.t < h.warn)); // 本体の予告と、部下のまだ出ていない攻撃を消す
    this.projs = this.projs.filter(p => p.team === 'ally');
    for (const m of this.mobs) if (m.kind === 'yoshi') m.act = null;
    b.st = 'sleep'; b.t = 0; b.mv = 'sleep'; b.y = 0; b.hz = null;
    Us.sleep = { t: 0, dmg: Us.sleepCarry || 0 }; Us.sleepCarry = 0;
    this.ev('sleep', { carry: Us.sleep.dmg });
  };

  /** 撃破：残った部下は命令を失って倒れる（飛行中も） */
  const bossDie0 = P.bossDie;
  P.bossDie = function () {
    if (this.stageId === 'ueno') { for (const m of this.mobs) if (m.st === 'fly') { m.st = 'dying'; m.dieT = 0.6; } if (this.U) { this.U.sleep = null; this.U.barrier = null; this.U.thr = null; } }
    return bossDie0.call(this);
  };
  P.uenoMinionDie = function () { };

  /* ---------- 味方AI（上野） ---------- */
  const aiEnemy0 = P.aiEnemy;
  P.aiEnemy = function (a) {
    if (this.stageId !== 'ueno') return aiEnemy0.call(this, a);
    const b = this.boss, Us = this.U;
    if (Us.sleep && this.bossHittable()) return b; // 睡眠中は本体へ集中
    const mobs = this.mobs.filter(m => m.st === 'ok');
    if (Us.barrier) { // バリア中：最後の射撃部下は倒さずに誘導する
      const beams = mobs.filter(m => m.typ === 'beam'), ok = mobs.filter(m => !(m.typ === 'beam' && beams.length <= 1));
      if (ok.length) return ok.sort((p, q) => dist2(a.x, a.z, p.x, p.z) - dist2(a.x, a.z, q.x, q.z))[0];
      return null;
    }
    if ((Us.sleepWarn || Us.sleepPend) && !Us.sleepDone && this.bossHittable() && dist2(a.x, a.z, b.x, b.z) > 5) return b; // 半分が近い：本体に寄っておく
    return aiEnemy0.call(this, a);
  };
  const aiDecide0 = P.aiDecide;
  P.aiDecide = function (a, out, push) {
    if (this.stageId === 'ueno' && this.U.barrier && !this.inDanger(a.x, a.z, 0.5, 1.2)) { // 射撃部下にねらわれたら、本体を背にして立つ（ビームはかわす）
      const b = this.boss, m = this.mobs.find(q => q.st === 'ok' && q.typ === 'beam' && q.tgt === a.slot);
      if (m && b) { const dx = b.x - m.x, dz = b.z - m.z, d = Math.hypot(dx, dz) || 1, k = clamp(d - 3.0, 3.5, 7); const p = this.clampPos(a.x, a.z, m.x + dx / d * k, m.z + dz / d * k, 0.4); a.ai.tx = p[0]; a.ai.tz = p[1]; a.ai.stay = dist2(a.x, a.z, p[0], p[1]) < 0.5; a.ai.wantA = false; out.healT = null; if (a.ai.stay) { a.ai.tx = a.x; a.ai.tz = a.z; } return; }
    }
    return aiDecide0.call(this, a, out, push);
  };

  /* ---------- スナップショット（上野だけの状態） ---------- */
  P.uenoSnap = function () {
    const Us = this.U, r = v => Math.round(v * 10) / 10;
    return [this.uenoAlive(), Us.barrier ? 1 : 0, Us.barrier ? Us.barrier.hits : 0, Us.sleep ? 1 : 0, Us.sleep ? r(Us.sleep.t) : 0, Us.sleep ? Math.round(Us.sleep.dmg) : 0, Us.sleepDone ? 1 : 0, Us.thrUsed, Math.round(this.lvOut * 100), Math.round(this.lvIn * 100), (Us.sleepWarn || Us.sleepPend) && !Us.sleepDone ? 1 : 0, Us.barrier ? r(Us.barrier.t) : 0, this.uenoLv, Us.thrQ];
  };
  SIMLIB.uenoDecode = a => ({ alive: a[0], barrier: !!a[1], bhits: a[2], sleep: !!a[3], sleepT: a[4], sleepDmg: a[5], sleepDone: !!a[6], thrUsed: a[7], lvOut: a[8] / 100, lvIn: a[9] / 100, sleepNear: !!a[10], barrierT: a[11], lv: a[12], thrQ: a[13] || 0 });
})();
