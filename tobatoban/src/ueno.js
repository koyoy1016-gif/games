/* =====================================================================
   ueno.js — 上野編のボス戦：上野駅前の広場で指揮官ヨシノシン（5.92m）と部下（妖怪人形）と戦う
   sim.js の Sim に足す（ホストだけが動かす・three.js 非依存）。部下の動きは joban.js と共通。
   流れ：intro（指を鳴らす→36体が走り出す・約3秒）→ boss（本体＋部下）→ won / lost
   ・HP 22,500／15,000／7,500 で「30分睡眠チャージ」（10秒で 2,500／3,500／4,000）。成功するたびに4秒ダウン、失敗は全回復して3段階をやり直し
   ・未判定のしきい値より下へは一撃でもHPを進めない（HP段階ロック）。余剰は持ち越さない
   ・HP22,500と7,500を初めて下回ったら「部下丸投げ五十連」を予約（睡眠と成功後のダウンが終わってから）
   ・有効戦闘30秒ごとに15体（包囲動員）。部下の生存は予約込みで100体まで
   優先順位：撃破 ＞ 睡眠チェック ＞ 予約済みの五十連 ＞ ふつうの行動
   ===================================================================== */
(() => {
  const P = Sim.prototype;
  const U = () => DATA.UENO;

  P.initUeno = function (o) {
    const D = U();
    this.stage = o.test ? 'boss' : 'intro'; this.barrier = 'none'; this.lanterns = [];
    this.kills = 0; this.total = 0; this.queue = null;
    this.ycfg = { types: D.minions, rights: D.rights };
    // 平均Lv（出動開始時の4体・切り捨て）で決まる上野ボスだけの補正。途中の操作交代では変えない
    const Pl = Math.floor(this.allies.reduce((s, a) => s + a.lv, 0) / this.allies.length), k = DATA.lvAdjust('ueno', Pl);
    this.uenoLv = Pl; this.lvOut = k.out; this.lvIn = k.in;
    this.U = { cyc: 1, done: [0, 0, 0], pend: -1, sleep: null, pre: {}, thrFlag: {}, thrQ: 0, thrUsed: 0, thr: null, reserve: 0, barrier: null, cmdN: 0, shoshaI: 0, eff: 0, waveN: 0, waveQ: [], entI: 0, lastSleep: null, tengai: false };
    for (const a of this.allies) {
      const q = D.start[a.slot]; a.x = a.px = q[0]; a.z = a.pz = q[1]; a.yaw = 0; a.ai.tx = a.x; a.ai.tz = a.z + 1;
      a.sp = Math.max(a.sp, 50); // 妖気は最低50（高ければそのまま）
      if (o.carry && o.carry[a.slot]) a.items.forEach((it, i) => { if (o.carry[a.slot][i] != null) it.n = o.carry[a.slot][i]; });
    }
    const [bx, bz] = D.bossSpawn;
    this.boss = { id: 'boss', kind: 'yoshinoshin', x: bx, z: bz, y: 0, yaw: Math.PI, hp: D.hp, maxHp: D.hp, str: D.str, yo: D.yo, def: D.def, st: o.test ? 'idle' : 'intro', mv: null, t: 0, gap: 1.2, phase: 1, cds: {}, target: 0, defDown: 0, paraImm: 0, dots: [], dl: [], fl: null, downT: 0, stunT: 0, lastAtk: -99, wantWarp: false, hz: null, home: [bx, bz] };
    if (o.test) this.boss.testIdle = !!o.idle;
    // 最初の36体（ビーム22・剣7・パンチ7）：6列に並び、開始と同時に全員が前進する。ビームは後ろの列
    const melee = []; for (let i = 0; i < D.init.sword; i++) melee.push('sword'); for (let i = 0; i < D.init.punch; i++) melee.push('punch');
    for (let i = melee.length - 1; i > 0; i--) { const j = (this.rng.next() * (i + 1)) | 0; [melee[i], melee[j]] = [melee[j], melee[i]]; }
    const order = melee.concat(Array(D.init.beam).fill('beam'));
    order.forEach((k2, i) => { const row = Math.floor(i / 6), col = i % 6; this.spawnYoshi(-7.5 + col * 3 + (row % 2 ? 0.75 : -0.75), 12 + row * 1.2, 'init', 'in', k2); });
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
  /** 次の未判定の睡眠段階（0〜2）。すべて成功済みなら -1 */
  P.sleepNext = function () { const d = this.U.done; for (let k = 0; k < 3; k++) if (!d[k]) return k; return -1; };

  P.updateUenoStage = function (dt) {
    if (this.stage === 'intro') {
      if (this.introWait) return;
      if (this.stageT >= 1.0 && !this._snap) { this._snap = 1; this.ev('sfx', { s: 'snap' }); this.ev('snap', {}); } // 指を鳴らす
      if (this.stageT >= U().introT) { this.stage = 'boss'; this.stageT = 0; const b = this.boss; b.st = 'idle'; b.t = 0; b.gap = 1.0; this.ev('stage', { k: 'fight' }); }
    }
  };

  /* ---------- 被ダメージ・バリア・HP段階ロック ---------- */
  /** バリア中の本体には通常ダメージが通らない */
  P.uenoBlock = function (e) { if (e !== this.boss || !this.U || !this.U.barrier) return false; this.ev('bblock', { x: e.x, z: e.z }); return true; };
  /** 睡眠中の本体は被ダメージ×2.25（Lv補正・重玉とは別に一度だけ） */
  P.uenoDmgMul = function (e) { return e === this.boss && this.U && this.U.sleep ? U().moves.sleep.mul : 1; };
  /** HP段階ロック：未判定のしきい値より下へは進めない（睡眠中は次の段階のしきい値で止める）。最後の段階のあとは0まで */
  P.capEnemyDmg = function (e, dmg) {
    if (this.stageId !== 'ueno' || e !== this.boss || !this.U) return dmg;
    const S = U().moves.sleep.stages, Us = this.U;
    let k = this.sleepNext(); if (Us.sleep) k = Us.sleep.i + 1 < 3 && !Us.done[Us.sleep.i + 1] ? Us.sleep.i + 1 : -1;
    if (k < 0) return dmg;
    const floor = S[k].at; if (e.hp <= floor) return 0;
    return Math.min(dmg, e.hp - floor);
  };
  P.uenoAfterHit = function (e, dmg) {
    const b = this.boss, Us = this.U; if (e !== b || !Us) return;
    if (Us.sleep) { Us.sleep.dmg += dmg; return; } // 本体へ実際に適用したダメージだけを数える（反射・味方への爆発・回復・部下へのダメージは入らない）
    this.uenoThresholds();
  };
  /** しきい値の確認：予告（24,000／16,500／9,000）・睡眠の開始待ち・五十連の予約（22,500と7,500を初めて下回ったとき） */
  P.uenoThresholds = function () {
    const b = this.boss, Us = this.U, M = U().moves, S = M.sleep.stages; if (!b || b.hp <= 0) return;
    const k = this.sleepNext();
    if (k >= 0 && !Us.sleep) {
      if (b.hp <= S[k].pre && !Us.pre[Us.cyc + ':' + k]) { Us.pre[Us.cyc + ':' + k] = 1; this.ev('sleepWarn', { i: k, need: S[k].need }); }
      if (b.hp <= S[k].at && Us.pend < 0) { Us.pend = k; this.ev('sleepPend', { i: k }); }
    }
    for (const f of M.throw50.at) if (!Us.thrFlag[f] && b.hp < b.maxHp * f) { Us.thrFlag[f] = 1; Us.thrQ++; } // 全回復しても使用済みは戻さない
  };

  /** 射撃部下のビームが本体を通ったか（味方に当たって止まった場合は届かない） */
  P.hzHook = function (h) {
    if (h.hook !== 'yBeam' || this.stageId !== 'ueno') return;
    const Us = this.U, b = this.boss; if (!Us.barrier || !b || b.st === 'dead' || b.st === 'hidden') return;
    if (Us.barrier.seen[h.id]) return; // 1本のビームを2回に数えない
    const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), R = U().bossR;
    if (!inLine(b.x, b.z, h.x, h.z, h.yaw, h.len, h.w / 2, R)) return;
    const fb = (b.x - h.x) * fx + (b.z - h.z) * fz;
    for (const o of this.allies) if (o.st === 'ok' && inLine(o.x, o.z, h.x, h.z, h.yaw, h.len, h.w / 2, DATA.MOB.allyR) && (o.x - h.x) * fx + (o.z - h.z) * fz < fb && !(o.inv > 0)) return;
    Us.barrier.seen[h.id] = 1; Us.barrier.hits++;
    this.ev('bhit', { n: Us.barrier.hits, x: b.x, z: b.z });
    if (Us.barrier.hits >= U().moves.barrier.hits) this.endBarrier(true);
  };
  P.endBarrier = function (broken) {
    const Us = this.U, b = this.boss; if (!Us.barrier) return;
    Us.barrier = null; this.ev('barrier', { on: 0, broken: broken ? 1 : 0 });
    if (broken && (b.st === 'idle' || b.st === 'walk' || b.st === 'rec' || b.st === 'act' || b.st === 'wind') && b.mv !== 'throw50' && b.mv !== 'tengai') { this.clearBossHz(); b.st = 'stun'; b.stunT = U().moves.barrier.stagger; b.t = 0; b.mv = null; b.hz = null; }
  };
  P.clearBossHz = function () { this.hazards = this.hazards.filter(h => h.src !== 'boss' || h.t > h.warn || h.keepOnCancel); };

  /* ---------- 包囲動員：有効戦闘30秒ごとに15体（4つの外周入口から） ---------- */
  const ENTS = [[-16.3, 13], [16.3, 13], [-9, 27.4], [9, 27.4]];
  P.uenoWaves = function (dt) {
    const Us = this.U, D = U(), W = D.wave, b = this.boss;
    const running = this.stage === 'boss' && b && b.st !== 'sleep' && b.st !== 'down' && b.st !== 'dead' && b.st !== 'intro' && !Us.sleep;
    if (running) Us.eff += dt; // 登場・睡眠・成功後ダウン・ポーズでは止まる
    while (Us.eff >= (Us.waveN + 1) * W.every) { // 30/60/90…秒ごとに一度だけ予約（満員でも毎フレーム足さない）
      Us.waveN++;
      const kinds = []; for (const k in W.mix) for (let i = 0; i < W.mix[k]; i++) kinds.push(k);
      const few = Us.entI++ % 4, per = [4, 4, 4, 4]; per[few] = 3; let ei = 0, c = 0;
      for (const typ of kinds) { while (c >= per[ei]) { ei++; c = 0; } Us.waveQ.push({ typ, ent: ei, due: this.t + W.warn }); c++; }
      this.ev('waveWarn', { n: W.n, ents: ENTS.map((e, i) => i) });
    }
    if (!running || !Us.waveQ.length) return;
    for (let i = 0; i < Us.waveQ.length; i++) {
      const q = Us.waveQ[i]; if (q.due > this.t) continue;
      if (this.uenoAlive() + Us.reserve >= D.cap) break; // 予約込みで100体まで。入れない分は待機
      let [x, z] = ENTS[q.ent]; x += this.rng.range(-1.2, 1.2) * (Math.abs(x) > 15 ? 0 : 1); z += this.rng.range(-1.2, 1.2) * (Math.abs(x) > 15 ? 1 : 0);
      if (this.allies.some(o => o.st === 'ok' && dist2(o.x, o.z, x, z) < 2.2)) continue; // 味方の2m以内には出さない（次のフレームで）
      const m = this.spawnYoshi(x, z, 'wave', 'side', q.typ); m.enterT = 0.5; m.inX = x > 15 ? -1 : x < -15 ? 1 : 0;
      Us.waveQ.splice(i, 1); i--;
    }
  };

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
    this.uenoWaves(dt);
    if (Us.barrier) { Us.barrier.t += dt; if (Us.barrier.t >= M.barrier.max) this.endBarrier(false); } // 最大8秒で必ず解除
    // 睡眠チェック中
    if (b.st === 'sleep') {
      const S = Us.sleep, st = M.sleep.stages[S.i]; S.t += dt;
      if (S.dmg >= st.need) { // 成功：その段階だけ成功済みにして4秒ダウン
        Us.done[S.i] = 1; Us.lastSleep = { ok: 1, i: S.i, dmg: S.dmg }; Us.sleep = null; b.st = 'down'; b.t = 0; b.downT = M.sleep.down; b.mv = null;
        this.ev('sleepEnd', { ok: 1, i: S.i, need: st.need, dmg: Math.round(S.dmg), cyc: Us.cyc }); this.ev('bossdown', {});
      } else if (S.t >= M.sleep.dur) { // 失敗：HP30,000へ全回復し、3段階すべてを未判定へ戻す
        Us.lastSleep = { ok: 0, i: S.i, dmg: S.dmg }; Us.sleep = null; Us.done = [0, 0, 0]; Us.pend = -1; Us.cyc++; b.hp = b.maxHp; b.st = 'idle'; b.t = 0; b.gap = 1.0; b.mv = null;
        this.ev('sleepEnd', { ok: 0, i: S.i, need: st.need, dmg: Math.round(S.dmg), cyc: Us.cyc });
      }
      return;
    }
    if (b.st === 'down') { b.downT -= dt; if (b.downT <= 0) { b.st = 'idle'; b.t = 0; b.gap = 0.8; this.uenoThresholds(); } return; }
    if (b.st === 'stun') { b.stunT -= dt; if (b.stunT <= 0) { b.st = 'idle'; b.t = 0; b.gap = 0.6; } return; }
    if (Us.thr) this.updateThrow(dt); // 五十連の投げ（本体の状態とは別に進む）
    this.uenoThresholds();
    // 睡眠の開始待ち：五十連の途中なら全員の着地を待ってから（着弾判定を消して開始）
    if (Us.pend >= 0 && !Us.thr && !this.mobs.some(m => m.st === 'fly')) { this.startSleep(Us.pend); return; }
    if (Us.pend >= 0 && (b.st === 'idle' || b.st === 'walk')) return; // 待っている間は新しい大技を始めない
    switch (b.st) {
      case 'idle': case 'walk': {
        const tg = this.uenoTarget();
        if (tg) { const ty = yawTo(tg.x - b.x, tg.z - b.z); b.yaw += clamp(angDiff(b.yaw, ty), -2.0 * dt, 2.0 * dt); }
        if (b.home) { const dx = b.home[0] - b.x, dz = b.home[1] - b.z, d = Math.hypot(dx, dz); if (d > 0.3) { const s = Math.min(d, 1.6 * dt); b.x += dx / d * s; b.z += dz / d * s; b.st = 'walk'; } else b.st = 'idle'; }
        if (b.testIdle) return;
        b.gap -= dt; if (b.gap <= 0) this.uenoDecide();
        return;
      }
      case 'hidden': case 'wind': case 'act': case 'rec': this.updateUenoMove(dt); return;
    }
  };

  /** 次の行動：指揮・待機・位置調整 3 に対して 直接攻撃 2 くらい。直接攻撃の開始は3秒以上あける。ビーム系7割・霊光2割・スタンプ1割 */
  P.uenoDecide = function () {
    const b = this.boss, Us = this.U, D = U(), M = D.moves, alive = this.uenoAlive();
    const tg = this.uenoTarget(); if (!tg) { b.gap = 0.5; return; }
    const cd = k => !(b.cds[k] > 0), dT = dist2(b.x, b.z, tg.x, tg.z);
    // 予約済みの五十連：生存50体以下・予約込みで100体に収まるときに必ず50体
    if (Us.thrQ > 0 && !Us.thr && alive <= M.throw50.alive && alive + M.throw50.n <= D.cap) return this.startMove('throw50');
    if (b.wantWarp && cd('warp')) return this.startMove('warp');
    if (!Us.barrier && cd('barrier') && this.stageT > 18 && this.mobs.some(m => m.st === 'ok' && m.typ === 'beam') && this.rng.next() < 0.3) return this.startMove('barrier');
    const ready = this.t - b.lastAtk >= D.minGap;
    let near = null, nd = 1e9; for (const o of this.allies) if (o.st === 'ok') { const d = dist2(b.x, b.z, o.x, o.z); if (d < nd) { nd = d; near = o; } }
    if (ready && near && nd < M.shosho.near && cd('shosho')) return this.startMove('shosho', near); // 近づいた味方へ連掌（そのあと後方へワープ）
    if (ready && Us.cmdN <= 0) {
      const W = D.pick, c = [];
      const beams = []; if (cd('shosha')) beams.push('shosha'); if (cd('tengai') && !Us.thr) beams.push('tengai');
      if (beams.length) c.push([beams[(this.rng.next() * beams.length) | 0], W.beams]);
      if (cd('reiko') && dT < M.reiko.range) c.push(['reiko', W.reiko]);
      if (cd('stamp') && !Us.thr) c.push(['stamp', W.stamp]);
      if (c.length) { let r = this.rng.next() * c.reduce((s, q) => s + q[1], 0); for (const [k, w] of c) { r -= w; if (r <= 0) return this.startMove(k, tg); } return this.startMove(c[0][0], tg); }
    }
    Us.cmdN--;
    if (cd('warp') && dT < 3.2 && this.rng.next() < 0.5) return this.startMove('warp');
    const cx = this.allies.filter(o => o.st === 'ok').reduce((s, o, i, arr) => s + o.x / arr.length, 0);
    b.home = [clamp(cx * 0.6 + this.rng.range(-3, 3), -11, 11), clamp(this.rng.range(19, 24), 17, 25.5)];
    if (this.rng.next() < 0.5) return this.startMove('cmd');
    b.gap = 0.9 + this.rng.next() * 0.8;
  };

  P.startMove = function (mv, tg) {
    const b = this.boss, D = U(), M = D.moves[mv] || { warn: 1.0 }, Us = this.U;
    b.mv = mv; b.t = 0; b.st = 'wind'; b.hz = null; b.ms = { tg: tg ? tg.slot : b.target, n: 0 };
    if (['reiko', 'shosho', 'stamp', 'shosha', 'tengai'].includes(mv)) { b.lastAtk = this.t; Us.cmdN = 1 + (this.rng.next() < 0.5 ? 1 : 0); }
    if (M.cd) b.cds[mv] = M.cd;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    if (mv === 'reiko') { // 3方向の太い光弾（判定半径0.60m）：準備中は3本の線で予告
      const t = this.allies[b.ms.tg]; if (t) b.yaw = yawTo(t.x - b.x, t.z - b.z);
      for (let i = -1; i <= 1; i++) this.hz({ kind: 'line', x: b.x + Math.sin(b.yaw) * 1.4, z: b.z + Math.cos(b.yaw) * 1.4, yaw: b.yaw + i * M.spread, len: 10, w: M.r * 2, warn: M.warn, act: 0, src: 'boss', fx: 'reikoW' });
    } else if (mv === 'shosho') {
      b.hz = this.hz({ kind: 'rect', x: b.x + fx * 0.8, z: b.z + fz * 0.8, yaw: b.yaw, len: M.len, w: M.w, warn: M.warn, act: M.act, pw: M.pw, stat: M.stat, src: 'boss', knock: 5, fx: 'shosho' });
    } else if (mv === 'stamp') { // 広場中央の到着印へワープしてから踏み下ろす（半径5.0m）
      const [cx, cz] = D.center; b.ms.to = [cx, cz]; b.st = 'hidden';
      this.hz({ kind: 'circle', x: cx, z: cz, r: M.r, warn: M.warn, act: M.act, pw: M.pw, stat: M.stat, src: 'boss', knock: 6, fx: 'stamp' });
    } else if (mv === 'shosha') {
      const form = ['front4', 'surround4', 'track3'][Us.shoshaI++ % 3]; b.ms.form = form; b.ms.grp = { hits: {}, max: 1 };
      if (form !== 'track3') this.shoshaVolley(form);
    } else if (mv === 'tengai') { Us.tengai = true; b.ms.wave = 0; }
    else if (mv === 'warp') {
      const to = this.warpSpot(); b.ms.to = to;
      this.hz({ kind: 'circle', x: to[0], z: to[1], r: 1.6, warn: M.warn + M.act, act: 0, src: 'boss', fx: 'warp' });
    } else if (mv === 'throw50') { Us.thrQ--; Us.thrUsed++; Us.reserve = M.n; } // 50体分の枠を先に確保
    this.ev('bossmove', { mv });
  };
  /** 号令四連照射：前方へ横並び4本／周囲4本（追跡3発は updateUenoMove で） */
  P.shoshaVolley = function (form) {
    const b = this.boss, M = U().moves.shosha, t = this.allies[b.ms.tg] || this.allies.find(o => o.st === 'ok'), pts = [];
    if (form === 'front4') {
      const yaw = t ? yawTo(t.x - b.x, t.z - b.z) : b.yaw, d = t ? clamp(dist2(b.x, b.z, t.x, t.z), 4, 9) : 6, cx = b.x + Math.sin(yaw) * d, cz = b.z + Math.cos(yaw) * d, px = Math.cos(yaw), pz = -Math.sin(yaw);
      for (const k of [-1.5, -0.5, 0.5, 1.5]) pts.push([cx + px * k * M.gap, cz + pz * k * M.gap]);
    } else for (let k = 0; k < 4; k++) { const a = b.yaw + Math.PI / 4 + k * Math.PI / 2; pts.push([b.x + Math.sin(a) * 4.6, b.z + Math.cos(a) * 4.6]); }
    for (const [x, z] of pts) { const c = this.clampUeno(x, z, x, z, 0.1); this.hz({ kind: 'circle', x: c[0], z: c[1], r: M.r, warn: M.warn, act: M.act, pw: M.pw, stat: M.stat, src: 'boss', fx: 'ubeam', grp: b.ms.grp }); }
  };
  /** 天蓋乱射・三十六光：12本×3波。1波につき4本は味方の位置を記録、8本は周囲へ散らす。各波で全員に逃げ場が残る配置だけを使う */
  P.tengaiWave = function (wi) {
    const b = this.boss, D = U(), M = D.moves.tengai, grp = { hits: {}, max: 1 }, alive = this.allies.filter(o => o.st === 'ok');
    const reach = 3.6 * Math.max(0.1, M.waves[0] - 0.8); // 最も遅いAI（3.6m/s）が反応0.8秒のあとに動ける距離
    let pts = null;
    for (let tryN = 0; tryN < 12 && !pts; tryN++) {
      const cand = [];
      alive.forEach((o, i) => { if (cand.length < M.track) cand.push([o.x + this.rng.range(-0.3, 0.3), o.z + this.rng.range(-0.3, 0.3)]); }); // 発射前に位置を固定（吸い付かない）
      while (cand.length < M.per) { const a = this.rng.next() * TAU, r = this.rng.range(2.5, 12); const x = clamp(b.x * 0.3 + Math.sin(a) * r, -D.halfX + 1, D.halfX - 1), z = clamp(14 + Math.cos(a) * r * 0.9, 2, D.zMax - 1); if (cand.every(q => dist2(q[0], q[1], x, z) > M.r * 1.7)) cand.push([x, z]); else if (this.rng.next() < 0.05) cand.push([x, z]); }
      const covered = (x, z) => cand.some(q => dist2(q[0], q[1], x, z) <= M.r + DATA.MOB.allyR);
      const safe = alive.every(o => { for (let r = 0.6; r <= reach; r += 0.45) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, x = o.x + Math.sin(a) * r, z = o.z + Math.cos(a) * r, c = this.clampUeno(x, z, x, z, 0.35); if (Math.abs(c[0] - x) < 0.05 && Math.abs(c[1] - z) < 0.05 && !covered(x, z)) return true; } return false; });
      if (safe) pts = cand;
    }
    if (!pts) { pts = []; for (let i = 0; i < M.per; i++) pts.push([-13 + (i % 6) * 5.2, i < 6 ? 6 : 20]); } // 安全な固定配置
    for (const [x, z] of pts) this.hz({ kind: 'circle', x, z, r: M.r, warn: M.waves[0], act: M.act, pw: M.pw, stat: M.stat, src: 'boss', fx: 'ubeam', grp, num: wi + 1 });
    this.ev('tengaiWave', { n: wi + 1 });
  };
  /** ワープ先：奥の通行できる場所。入口や味方の真下には出ない */
  P.warpSpot = function () {
    const b = this.boss;
    for (let k = 0; k < 24; k++) {
      const x = this.rng.range(-11, 11), z = this.rng.range(19.5, 25);
      if (this.allies.some(o => o.st !== 'gone' && dist2(o.x, o.z, x, z) < 4.5)) continue;
      if (dist2(b.x, b.z, x, z) < 4) continue;
      return [x, z];
    }
    return [-b.x * 0.5, 23];
  };

  P.updateUenoMove = function (dt) {
    const b = this.boss, D = U(), mv = b.mv, M = D.moves[mv] || { warn: 1.0, rec: 0.6 }, Us = this.U, t = b.t;
    const toRec = () => { b.st = 'rec'; b.t = 0; };
    const done = () => { b.st = 'idle'; b.t = 0; b.mv = null; b.hz = null; b.gap = 0.5 + this.rng.next() * 0.6; };
    if (b.st === 'rec') { if (t >= (M.rec != null ? M.rec : 0.5)) { if (mv === 'shosho') b.wantWarp = true; if (mv === 'tengai') Us.tengai = false; done(); } return; }
    switch (mv) {
      case 'cmd': if (t >= 1.3) done(); return;
      case 'reiko':
        if (b.st === 'wind' && t >= M.warn) {
          for (let i = -1; i <= 1; i++) { const yaw = b.yaw + i * M.spread, fx = Math.sin(yaw), fz = Math.cos(yaw); this.projs.push({ id: this.id(), kind: 'reiko', team: 'enemy', x: b.x + fx * 1.4, y: 2.4, z: b.z + fz * 1.4, vx: fx * M.speed, vz: fz * M.speed, life: M.range / M.speed, r: M.r, pw: M.pw, stat: M.stat, src: b, srcEnt: b, hit: new Set(), yaw }); }
          this.ev('bossfire', { mv }); toRec();
        } else if (b.st === 'wind') { const tg = this.allies[b.ms.tg]; if (tg && tg.st === 'ok') b.yaw += clamp(angDiff(b.yaw, yawTo(tg.x - b.x, tg.z - b.z)), -1.5 * dt, 1.5 * dt); }
        return;
      case 'shosho': {
        const tg = this.allies[b.ms.tg];
        if (b.st === 'wind') {
          if (t < M.warn - M.lockT && tg && tg.st === 'ok') { b.yaw += clamp(angDiff(b.yaw, yawTo(tg.x - b.x, tg.z - b.z)), -4 * dt, 4 * dt); if (b.hz) { b.hz.yaw = b.yaw; b.hz.x = b.x + Math.sin(b.yaw) * 0.8; b.hz.z = b.z + Math.cos(b.yaw) * 0.8; } }
          if (t >= M.warn) { b.st = 'act'; b.t = 0; this.ev('bossfire', { mv }); }
        } else if (b.st === 'act' && t >= M.act) toRec();
        return;
      }
      case 'stamp':
        if (b.st === 'hidden' && t >= 0.3) { b.x = b.ms.to[0]; b.z = b.ms.to[1]; b.st = 'wind'; b.home = [b.x, b.z]; for (const a of this.allies) { const r = this.clampPos(a.x, a.z, a.x, a.z, 0.35); a.x = r[0]; a.z = r[1]; } this.ev('warpIn', { x: b.x, z: b.z }); }
        if (b.st === 'wind') { b.y = Math.min(0.9, Math.max(0, (t - 0.4) / (M.warn - 0.4)) * 0.9); if (t >= M.warn) { b.y = 0; b.st = 'act'; b.t = 0; this.ev('bossfire', { mv }); } }
        else if (b.st === 'act' && t >= M.act) { toRec(); b.home = [clamp(b.x, -10, 10), 22]; }
        return;
      case 'shosha':
        if (b.ms.form === 'track3') {
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
      case 'tengai': { // 1.40／3.40／5.40秒後に着弾。各波は1.40秒前に予告
        if (b.st === 'wind') { b.st = 'act'; b.t = 0; }
        const W = M.waves; while (b.ms.wave < 3 && b.t >= W[b.ms.wave] - W[0]) { this.tengaiWave(b.ms.wave); b.ms.wave++; }
        if (b.t >= W[2] + M.act) toRec();
        return;
      }
      case 'warp':
        if (b.st === 'wind' && t >= M.warn) { b.st = 'hidden'; b.t = 0; }
        else if (b.st === 'hidden' && t >= M.act) { b.x = b.ms.to[0]; b.z = b.ms.to[1]; b.home = [b.x, b.z]; b.wantWarp = false; b.st = 'rec'; b.t = 0; this.ev('warpIn', { x: b.x, z: b.z }); }
        return;
      case 'barrier':
        if (b.st === 'wind' && t >= M.warn) { Us.barrier = { t: 0, hits: 0, seen: {} }; this.ev('barrier', { on: 1 }); b.st = 'rec'; b.t = 0; }
        return;
      case 'throw50':
        if (b.st === 'wind' && t >= M.warn) {
          b.st = 'act'; b.t = 0;
          const kinds = []; for (const k in M.mix) for (let i = 0; i < M.mix[k]; i++) kinds.push(k);
          for (let i = kinds.length - 1; i > 0; i--) { const j = (this.rng.next() * (i + 1)) | 0; [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
          Us.thr = { i: 0, t: 0, grp: { hits: {}, max: M.maxHits }, pts: [], kinds };
        } else if (b.st === 'act' && !Us.thr && t > 0.2) { b.st = 'rec'; b.t = 0; }
        return;
    }
    if (t > 8) done(); // 念のため
  };

  /** 部下丸投げ五十連：0.12秒ごとに1体（約5.9秒）、各1.1秒後に着地。着地点は散らし、入口と左右の退避帯を残す */
  P.updateThrow = function (dt) {
    const b = this.boss, Us = this.U, M = U().moves.throw50, T = Us.thr;
    T.t += dt;
    while (T.i < M.n && T.t >= T.i * M.iv) {
      const pt = this.throwSpot(T.pts); T.pts.push(pt); if (T.pts.length > 12) T.pts.shift();
      this.hz({ kind: 'circle', x: pt[0], z: pt[1], r: M.r, warn: M.land, act: 0.1, pw: M.pw, stat: M.stat, src: 'boss', fx: 'throw', grp: T.grp, keepOnCancel: true });
      const m = this.spawnYoshi(b.x, b.z, 'throw', 'drop', T.kinds[T.i]);
      m.st = 'fly'; m.fly = { t: 0, x0: b.x + Math.sin(b.yaw + 1.2) * 1.5, z0: b.z + Math.cos(b.yaw + 1.2) * 1.5, x1: pt[0], z1: pt[1] }; m.x = m.fly.x0; m.z = m.fly.z0; m.air = 3.8;
      T.i++; Us.reserve = Math.max(0, Us.reserve - 1);
      if (T.i % 3 === 0) this.ev('sfx', { s: 'gDrop', x: b.x, z: b.z });
    }
    if (T.i >= M.n) { Us.thr = null; Us.reserve = 0; }
  };
  P.throwSpot = function (prev) {
    const D = U(), alive = this.allies.filter(o => o.st === 'ok');
    for (let k = 0; k < 40; k++) {
      let x, z;
      if (alive.length && this.rng.next() < 0.5) { const o = alive[(this.rng.next() * alive.length) | 0], a = this.rng.next() * TAU, r = this.rng.range(2.5, 7); x = o.x + Math.sin(a) * r; z = o.z + Math.cos(a) * r; }
      else { x = this.rng.range(-12.5, 12.5); z = this.rng.range(4, 22); }
      if (Math.abs(x) > D.halfX - 3 || z < 3 || z > D.zMax - 2) continue; // 左右の退避帯と入口は空ける
      if (dist2(x, z, this.boss.x, this.boss.z) < 2.6) continue;
      if (prev.some(p => dist2(p[0], p[1], x, z) < 1.4)) continue; // 1点に重ねない
      return [x, z];
    }
    return [this.rng.range(-10, 10), this.rng.range(6, 20)];
  };
  P.updateFly = function (m, dt) {
    const F = m.fly, L = U().moves.throw50.land; F.t += dt; const k = Math.min(1, F.t / L);
    m.x = F.x0 + (F.x1 - F.x0) * k; m.z = F.z0 + (F.z1 - F.z0) * k; m.air = 3.8 * (1 - k) + 3.6 * 4 * k * (1 - k) * 0.6;
    if (k >= 1) { m.st = 'ok'; m.air = 0; m.fly = null; m.enterT = 0; m.cd = Math.max(m.cd, U().moves.throw50.calm + 0.2 + this.rng.next() * 0.8); this.ev('yLand', { x: m.x, z: m.z }); }
  };

  /** 睡眠チャージ開始（段階i）：本体の予告・部下のまだ出ていない攻撃を消し、部下を止める */
  P.startSleep = function (i) {
    const b = this.boss, Us = this.U, st = U().moves.sleep.stages[i];
    Us.pend = -1; this.endBarrier(false); Us.tengai = false;
    this.hazards = this.hazards.filter(h => h.src !== 'boss' && !(h.src === 'mob' && h.t < h.warn));
    this.projs = this.projs.filter(p => p.team === 'ally');
    for (const m of this.mobs) if (m.kind === 'yoshi') m.act = null;
    b.st = 'sleep'; b.t = 0; b.mv = 'sleep'; b.y = 0; b.hz = null;
    Us.sleep = { i, t: 0, dmg: 0 }; // 開始前の余剰は持ち越さない
    this.ev('sleep', { i, need: st.need, cyc: Us.cyc });
  };

  /** 撃破：残った部下・待機の増援は命令を失って終わる */
  const bossDie0 = P.bossDie;
  P.bossDie = function () {
    if (this.stageId === 'ueno') { for (const m of this.mobs) if (m.st === 'fly') { m.st = 'dying'; m.dieT = 0.6; } if (this.U) { this.U.sleep = null; this.U.barrier = null; this.U.thr = null; this.U.waveQ = []; this.U.reserve = 0; } }
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
    if (Us.pend >= 0 && this.bossHittable()) return b;
    const k = this.sleepNext();
    if (k >= 0 && b && b.hp <= U().moves.sleep.stages[k].pre && this.bossHittable() && dist2(a.x, a.z, b.x, b.z) > 6) return b; // 次の段階が近い：本体に寄っておく
    return aiEnemy0.call(this, a);
  };
  const aiDecide0 = P.aiDecide;
  P.aiDecide = function (a, out, push) {
    if (this.stageId === 'ueno' && this.U.barrier && !this.inDanger(a.x, a.z, 0.5, 1.2)) { // 射撃部下にねらわれたら、本体を背にして立つ（ビームはかわす）
      const b = this.boss, m = this.mobs.find(q => q.st === 'ok' && q.typ === 'beam' && q.tgt === a.slot);
      if (m && b) { const dx = b.x - m.x, dz = b.z - m.z, d = Math.hypot(dx, dz) || 1, k = clamp(d - 3.5, 3.5, 7); const p = this.clampPos(a.x, a.z, m.x + dx / d * k, m.z + dz / d * k, 0.4); a.ai.tx = p[0]; a.ai.tz = p[1]; a.ai.stay = dist2(a.x, a.z, p[0], p[1]) < 0.5; a.ai.wantA = false; out.healT = null; if (a.ai.stay) { a.ai.tx = a.x; a.ai.tz = a.z; } return; }
    }
    return aiDecide0.call(this, a, out, push);
  };

  /** AIの閃光銃：睡眠阻止の残りが少なく、足りないとき（本体へ届く距離・正面に味方がいない） */
  P.aiGunNow = function (a) {
    if (this.stageId === 'ueno' && this.U && this.U.sleep) {
      const Sx = this.U.sleep, need = U().moves.sleep.stages[Sx.i].need, b = this.boss;
      if (Sx.dmg < need && Sx.t > U().moves.sleep.dur - 5 && b && this.gapTo(a.x, a.z, b).g < DATA.ITEMS.starburst_gun.range - 1) return b;
    }
    if (this.akibaGunNow) return this.akibaGunNow(a);
    return null;
  };
  /* ---------- スナップショット（上野だけの状態） ---------- */
  P.uenoSnap = function () {
    const Us = this.U, r = v => Math.round(v * 10) / 10, S = U().moves.sleep.stages, k = Us.sleep ? Us.sleep.i : this.sleepNext(), W = U().wave;
    return [this.uenoAlive(), Us.barrier ? 1 : 0, Us.barrier ? Us.barrier.hits : 0, Us.sleep ? 1 : 0, Us.sleep ? r(Us.sleep.t) : 0, Us.sleep ? Math.round(Us.sleep.dmg) : 0, k, k >= 0 ? S[k].need : 0, Us.done[0] | (Us.done[1] << 1) | (Us.done[2] << 2), Math.round(this.lvOut * 1000), Math.round(this.lvIn * 1000), k >= 0 && this.boss.hp <= S[k].pre ? 1 : 0, Us.barrier ? r(Us.barrier.t) : 0, this.uenoLv, Us.thrQ, r(Math.max(0, (Us.waveN + 1) * W.every - Us.eff)), Us.waveQ.length, Us.cyc, Us.pend];
  };
  SIMLIB.uenoDecode = a => ({ alive: a[0], barrier: !!a[1], bhits: a[2], sleep: !!a[3], sleepT: a[4], sleepDmg: a[5], stage: a[6], need: a[7], done: a[8], lvOut: a[9] / 1000, lvIn: a[10] / 1000, sleepNear: !!a[11], barrierT: a[12], lv: a[13], thrQ: a[14] || 0, waveIn: a[15], waveWait: a[16], cyc: a[17], pend: a[18] });
})();
