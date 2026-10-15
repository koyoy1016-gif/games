/* =====================================================================
   akiba.js — 秋葉原編：駅ホーム（オガ・カエ）と駅前広場（星・中＋オガ・カエ）
   sim.js の Sim に足す（ホストだけが動かす・three.js 非依存）。4人は mobs に kind:'akiba' として入れる（注目・弾・追尾は共通）
   ・ホーム：オガ・カエ（各HP4,000）を両方倒すと勝ち。片方が倒れても復活しない
   ・広場：星・中（各HP8,000）。片方が倒れてから15秒以内にもう片方も倒すと勝ち。間に合わなければ倒れた方だけHP4,000で復活
     オガ・カエは始まりに一度だけHP4,000で起こされ、広場で再び倒れたらもう起きない
   ・図形の必殺：生きている相手から2/3/4人を選び、線（2人）・三角の面（3人）・凸四角形の火床（4人）。予兆中は参加者が足を止める
   ・通常攻撃をする相手は全体で同時に2人まで。威力は共通のダメージ式（約150はLv60の基準）
   ===================================================================== */
(() => {
  const P = Sim.prototype, A = () => DATA.AKIBA;
  const TWINS = ['hoshi', 'naka'];
  const MOVES_OF = { hoshi: [['hoshizuna', 5], ['hoshirai', 2], ['hoshimado', 1]], naka: [['shizuku', 5], ['hyoutei', 2], ['mayoi', 1]], oga: [['ougi', 5], ['iki', 2], ['benibana', 2]], kae: [['nagi', 5], ['meguri', 2], ['kagami', 1]] };
  const KEEP = { hoshi: 6, naka: 7, oga: 1.8, kae: 2.2 };

  P.initAkiba = function (o) {
    const D = A(), plaza = this.stageId === 'akiba_plaza', C = plaza ? D.plaza : D.platform;
    this.stage = o.test ? 'boss' : 'intro'; this.barrier = 'none'; this.lanterns = []; this.kills = 0; this.total = 0; this.queue = null;
    const Pl = Math.floor(this.allies.reduce((s, a) => s + a.lv, 0) / this.allies.length), k = DATA.lvAdjust('akiba', Pl);
    this.akLv = Pl; this.lvOut = k.out; this.lvIn = k.in;
    this.AK = { plaza, twinT: -1, twinDown: null, twinFails: 0, geoT: D.geo.first, geo: null, geoN: 0, log: { hoshi: [], naka: [] }, gcd: { hoshi: 0, naka: 0 }, revived: false };
    for (const a of this.allies) { const q = C.start[a.slot]; a.x = a.px = q[0]; a.z = a.pz = q[1]; a.yaw = 0; a.ai.tx = a.x; a.ai.tz = a.z + 1; a.sp = Math.max(a.sp, 50); }
    for (const who in C.foes) { const m = this.spawnFoe(who, C.foes[who][0], C.foes[who][1]); if (plaza && (who === 'oga' || who === 'kae')) { m.hp = 0; m.st = 'down'; } }
    if (o.test) this.akibaRevive();
  };
  P.spawnFoe = function (who, x, z) {
    const T = A().foes[who], cd = {};
    for (const [k] of MOVES_OF[who]) cd[k] = 1.5 + this.rng.next() * 2.5;
    const m = { id: 'k' + this.id(), kind: 'akiba', who, T, x, z, yaw: Math.PI, hp: T.hp, maxHp: T.hp, str: T.str, yo: T.yo, def: T.def, r: T.r, st: 'ok', t: 0, para: 0, defDown: 0, dots: [], dl: [], act: null, cd, gap: 1 + this.rng.next(), wind: 0, moving: 0, tgt: -1, retT: 0, strafe: this.rng.next() < 0.5 ? 1 : -1, yoMul: 1, buffT: 0, geo: false, geoRec: 0, jump: 0 };
    this.mobs.push(m); return m;
  };
  /** 広場の始まり：倒れたオガ・カエを、星と中が光の糸で一度だけ起こす（各HP4,000） */
  P.akibaRevive = function () {
    if (!this.AK.plaza || this.AK.revived) return; this.AK.revived = true;
    for (const m of this.mobs) if (m.kind === 'akiba' && (m.who === 'oga' || m.who === 'kae') && m.st === 'down') { m.st = 'ok'; m.hp = m.maxHp; this.ev('akRevive', { who: m.who, x: m.x, z: m.z }); }
  };
  P.clampAkiba = function (ox, oz, nx, nz, rad) {
    const D = A();
    if (this.stageId === 'akiba_plaza') { const h = D.plaza.half - rad; return [clamp(nx, -h, h), clamp(nz, -h, h)]; }
    const C = D.platform; return [clamp(nx, -C.halfX + rad, C.halfX - rad), clamp(nz, 0.2 + rad, C.zMax - rad)];
  };
  P.akibaCandySpot = function () { const D = A(); if (this.stageId === 'akiba_plaza') return [this.rng.range(-11, 11), this.rng.range(-11, 6)]; return [this.rng.range(-7, 7), this.rng.range(2, 14)]; };
  P.foe = function (who) { return this.mobs.find(m => m.kind === 'akiba' && m.who === who); };
  P.akibaPaused = function () { return false; };

  /* ---------- 進行：始まり・双子の15秒・図形の必殺・相方を守る ---------- */
  P.updateAkibaStage = function (dt) {
    const D = A(), AK = this.AK;
    if (this.stage === 'intro') {
      if (this.introWait) return;
      if (AK.plaza && this.stageT >= 2.0) this.akibaRevive();
      if (this.stageT >= D.introT[this.stageId]) { this.stage = 'boss'; this.stageT = 0; this.ev('stage', { k: 'fight' }); }
      return;
    }
    if (this.stage !== 'boss') return;
    // 双子：片方が倒れてから15秒。期限ちょうどの命中は先に処理済み（味方の更新が先）。間に合わなければ倒れていた方だけHP4,000で復活
    if (AK.twinT >= 0) {
      AK.twinT -= dt;
      if (AK.twinT <= 1e-9) {
        const m = this.foe(AK.twinDown); AK.twinT = -1; AK.twinDown = null; AK.twinFails++;
        if (m && m.st === 'down') { m.st = 'ok'; m.hp = Math.min(m.maxHp, D.twin.revive); m.act = null; this.ev('twinRevive', { who: m.who, x: m.x, z: m.z }); }
      }
    }
    // 相方を守る：直近5秒で片方に1,200以上・もう片方が300未満なら、攻撃されていない方のようりょく×1.10（6秒・再使用15秒・重複なし）
    if (AK.plaza && AK.twinT < 0) {
      const G = D.guard, now = this.t, sum = w => AK.log[w].filter(q => now - q.t <= G.win).reduce((s, q) => s + q.v, 0);
      for (const w of TWINS) { AK.log[w] = AK.log[w].filter(q => now - q.t <= G.win); AK.gcd[w] -= dt; }
      for (const [hit, other] of [['hoshi', 'naka'], ['naka', 'hoshi']]) {
        const mo = this.foe(other); if (!mo || mo.st !== 'ok' || AK.gcd[other] > 0 || mo.buffT > 0) continue;
        if (sum(hit) >= G.dmg && sum(other) < G.low) { mo.yoMul = G.mul; mo.buffT = G.dur; AK.gcd[other] = G.cd; this.ev('akGuard', { who: other, x: mo.x, z: mo.z }); }
      }
    }
    for (const m of this.mobs) if (m.kind === 'akiba' && m.buffT > 0) { m.buffT -= dt; if (m.buffT <= 0) m.yoMul = 1; }
    if (AK.plaza) this.updateGeo(dt);
  };

  /** 倒れたとき（mobDie から） */
  P.akibaDown = function (m, by) {
    const AK = this.AK; if (m.st !== 'ok') return;
    m.st = 'down'; m.hp = 0; m.act = null; m.jump = 0; this.kills++;
    if (by && by.stats) by.stats.kills++;
    for (const h of this.hazards) if (h.srcEnt === m && h.t < h.warn) h.dead = 1; // 予兆中に倒れたら攻撃は出ない
    if (AK.geo && AK.geo.ids.includes(m.id) && AK.geo.hz && AK.geo.hz.t < AK.geo.hz.warn) this.cancelGeo('down'); // 予兆中の参加者が倒れたら取り消し
    this.ev('akDown', { who: m.who, x: m.x, z: m.z });
    if (!AK.plaza) { if (['oga', 'kae'].every(w => { const f = this.foe(w); return !f || f.st !== 'ok'; })) this.finish(true, 'platform'); return; }
    if (TWINS.includes(m.who)) {
      const other = TWINS.find(w => w !== m.who), mo = this.foe(other);
      if (mo && mo.st !== 'ok') { AK.twinT = -1; this.akibaWin(); return; } // 15秒以内に両方（同じ範囲技で同時も成功）
      AK.twinDown = m.who; AK.twinT = A().twin.window;
      if (AK.geo && !AK.geo.fired) this.cancelGeo('twin');
      this.ev('twinDown', { who: m.who, other });
    }
  };
  P.akibaWin = function () {
    for (const m of this.mobs) if (m.kind === 'akiba' && m.st === 'ok') { m.st = 'down'; m.leave = 1; } // 戦意を失って退場
    this.hazards = this.hazards.filter(h => h.src !== 'akiba');
    this.finish(true, 'twins');
  };
  P.akibaAfterHit = function (e, dmg) {
    if (e.kind !== 'akiba' || !this.AK || !TWINS.includes(e.who)) return;
    this.AK.log[e.who].push({ t: this.t, v: dmg });
  };

  /* ---------- 4人それぞれの動き ---------- */
  P.akibaRightsFree = function () { if (this.AK && this.AK.geoWait) return false; let n = 0; for (const m of this.mobs) if (m.kind === 'akiba' && m.st === 'ok' && m.act && !m.geo) n++; return n < A().rights; };
  P.akibaTarget = function (m) {
    let best = null, bs = 1e9;
    for (const o of this.allies) { if (o.st !== 'ok') continue; let d = dist2(m.x, m.z, o.x, o.z); if (o.buffs.stealth > 0) d += 6; if (o.buffs.taunt > 0) d -= 4; if (d < bs) { bs = d; best = o; } }
    return best;
  };
  P.updateAkibaEnemy = function (m, dt) {
    const D = A(), AK = this.AK; m.wind = m.act && m.act.t < m.act.w ? 1 : 0; m.moving = 0;
    if (this.stage !== 'boss') return;
    for (const k in m.cd) m.cd[k] -= dt; m.gap -= dt;
    if (m.geo) return; // 図形の必殺中は足を止める（同じ足元の座標）
    if (m.geoRec > 0) { m.geoRec -= dt; return; }
    if (m.act) { this.akibaAct(m, dt); return; }
    m.retT -= dt; let tg = this.allies[m.tgt];
    if (m.retT <= 0 || !tg || tg.st !== 'ok') { m.retT = 0.6; tg = this.akibaTarget(m); m.tgt = tg ? tg.slot : -1; }
    if (!tg) return;
    const dx = tg.x - m.x, dz = tg.z - m.z, d = Math.hypot(dx, dz) || 1e-3, ty = yawTo(dx, dz);
    m.yaw += clamp(angDiff(m.yaw, ty), -5 * dt, 5 * dt);
    // それぞれ別々に歩き、追い込む方向を変える（相手ごとに少し横へずれる）
    const keep = KEEP[m.who], ang = ty + Math.PI + m.strafe * 0.45, gx = tg.x + Math.sin(ang) * keep, gz = tg.z + Math.cos(ang) * keep;
    let vx = gx - m.x, vz = gz - m.z; const vl = Math.hypot(vx, vz);
    for (const o of this.mobs) { if (o === m || o.kind !== 'akiba' || o.st !== 'ok') continue; const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz); if (od < 1.6 && od > 1e-4) { vx += ox / od * 1.5; vz += oz / od * 1.5; } }
    const L = Math.hypot(vx, vz);
    if (vl > 0.25 && L > 1e-3) { const sp = m.T.spd * this.debuffMul(m, 'spd') * dt; const c = this.clampAkiba(m.x, m.z, m.x + vx / L * sp, m.z + vz / L * sp, m.r); m.x = c[0]; m.z = c[1]; m.moving = 1; }
    if (this.rng.next() < dt * 0.15) m.strafe *= -1;
    // 攻撃：全体で2人まで。図形の必殺の間は通常攻撃も床攻撃も重ねない
    if (m.gap > 0 || AK.geo || !this.akibaRightsFree()) return;
    const ready = MOVES_OF[m.who].filter(([k]) => m.cd[k] <= 0 && d <= D.moves[k].rng);
    if (!ready.length) return;
    let r = this.rng.next() * ready.reduce((s, q) => s + q[1], 0), pick = ready[0][0];
    for (const [k, w] of ready) { r -= w; if (r <= 0) { pick = k; break; } }
    this.akibaStart(m, pick, tg);
  };
  /** 技の始まり：予兆は開始時に置く（対象の位置は予兆の開始で固定） */
  P.akibaStart = function (m, k, tg) {
    const M = A().moves[k], src = { str: m.str, yo: m.yo * m.yoMul }, base = { pw: M.pw || 0, stat: M.stat || 'yo', srcStats: src, src: 'akiba', srcEnt: m, srcId: m.id, dodge: true, max: 1, iv: 99 };
    m.cd[k] = M.cd; m.yaw = yawTo(tg.x - m.x, tg.z - m.z);
    const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), H = o => this.hz(Object.assign({}, base, o));
    let end = M.warn + (M.act || 0) + (M.rec || 0.6);
    const fxOf = { hoshi: 'hoshi', naka: 'naka', oga: 'oga', kae: 'kae' }[m.who];
    switch (k) {
      case 'hoshizuna': H({ kind: 'circle', x: tg.x, z: tg.z, r: M.r, warn: M.warn, act: M.act, fx: fxOf }); break;
      case 'hoshirai': { const grp = { hits: {}, max: M.max }; for (let i = 0; i < M.n; i++) { const a = this.rng.next() * TAU, rr = i === 0 ? 0 : this.rng.range(1.2, 2.4); H({ kind: 'circle', x: tg.x + Math.sin(a) * rr, z: tg.z + Math.cos(a) * rr, r: M.r, warn: M.warn + i * M.delay, act: M.act, fx: fxOf, grp }); } end = M.warn + (M.n - 1) * M.delay + M.act + M.rec; break; }
      case 'hoshimado': case 'mayoi': H({ kind: 'circle', x: tg.x, z: tg.z, r: M.r, warn: M.warn, act: M.act, fx: 'debuffMark', eff: { k: M.eff, mul: M.mul, dur: M.dur, src: 'ak:' + k } }); break;
      case 'shizuku': H({ kind: 'line', x: m.x + fx * 0.4, z: m.z + fz * 0.4, yaw: m.yaw, len: M.len, w: M.w, warn: M.warn, act: 0, fx: fxOf }); end = M.warn + M.rec; break;
      case 'hyoutei': { const grp = { hits: {}, max: 1 }; for (let i = 0; i < M.n; i++) { const a = i * TAU / 3 + this.rng.next(), rr = i === 0 ? 0 : 2.6; H({ kind: 'circle', x: tg.x + Math.sin(a) * rr, z: tg.z + Math.cos(a) * rr, r: M.r, warn: M.warn, act: M.act, fx: fxOf, grp }); } break; }
      case 'ougi': case 'nagi': H({ kind: 'fan', x: m.x, z: m.z, yaw: m.yaw, r0: 0, r1: M.r, half: M.half, warn: M.warn, act: M.act, fx: fxOf, knock: 3, kx: fx, kz: fz }); break;
      case 'iki': H({ kind: 'fan', x: m.x, z: m.z, yaw: m.yaw, r0: 0, r1: M.r, half: M.half, warn: M.warn, act: M.act, fx: fxOf }); break;
      case 'benibana': { const c = this.clampAkiba(tg.x, tg.z, tg.x, tg.z, 0.5); H({ kind: 'circle', x: c[0], z: c[1], r: M.r, warn: M.warn, act: M.act, fx: fxOf, knock: 4 }); m.jumpTo = [c[0], c[1]]; m.jumpFrom = [m.x, m.z]; break; }
      case 'meguri': { const dir = this.rng.next() < 0.5 ? 1 : -1, y0 = m.yaw - dir * M.sweep / 2; H({ kind: 'fan', x: m.x, z: m.z, yaw: m.yaw, r0: 0.3, r1: M.len, half: M.sweep / 2, warn: M.warn, act: 0, fx: fxOf, dir }); m.spin = { dir, y0, hz: null }; end = M.warn + M.dur + M.rec; break; }
      case 'kagami': { for (let i = 0; i < M.n; i++) { const a = this.rng.next() * TAU, rr = i === 0 ? 0.6 : 2.4; const c = this.clampAkiba(tg.x + Math.sin(a) * rr, tg.z + Math.cos(a) * rr, tg.x + Math.sin(a) * rr, tg.z + Math.cos(a) * rr, 1.1); H({ kind: 'circle', x: c[0], z: c[1], r: M.r, warn: M.warn, act: 0, keep: M.life, fx: 'water' }); } break; }
    }
    m.act = { k, t: 0, w: M.warn, end, tg: tg.slot, fired: false };
    this.ev('akMove', { who: m.who, mv: k });
  };
  P.akibaAct = function (m, dt) {
    const A0 = m.act, M = A().moves[A0.k]; A0.t += dt;
    if (A0.k === 'shizuku' && !A0.fired && A0.t >= M.warn) { // 水弾：幅0.8m・距離12m・秒速8m
      A0.fired = true; const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
      this.projs.push({ id: this.id(), kind: 'mizu', team: 'enemy', x: m.x + fx * 0.5, y: 0.8, z: m.z + fz * 0.5, vx: fx * M.speed, vz: fz * M.speed, life: M.len / M.speed, r: M.w / 2, pw: M.pw, stat: 'yo', src: { str: m.str, yo: m.yo * m.yoMul }, srcEnt: m, hit: new Set(), yaw: m.yaw });
    }
    if (A0.k === 'benibana' && m.jumpTo) { const k = Math.min(1, A0.t / M.warn); m.x = m.jumpFrom[0] + (m.jumpTo[0] - m.jumpFrom[0]) * k; m.z = m.jumpFrom[1] + (m.jumpTo[1] - m.jumpFrom[1]) * k; m.jump = Math.sin(k * Math.PI) * 2.2; if (k >= 1) { m.jump = 0; m.jumpTo = null; } }
    if (A0.k === 'meguri' && m.spin && A0.t >= M.warn) { // 水の光を2.5秒で120度回す（1人1回まで）
      const S = m.spin, k = Math.min(1, (A0.t - M.warn) / M.dur), yaw = S.y0 + S.dir * M.sweep * k;
      if (!S.hz) S.hz = this.hz({ kind: 'line', x: m.x, z: m.z, yaw, len: M.len, w: M.w, warn: 0, act: M.dur, pw: M.pw, stat: 'yo', srcStats: { str: m.str, yo: m.yo * m.yoMul }, src: 'akiba', srcEnt: m, srcId: m.id, max: 1, iv: 99, fx: 'kae' });
      S.hz.yaw = yaw; m.yaw = yaw;
      if (k >= 1) m.spin = null;
    }
    if (A0.t >= A0.end) { m.act = null; m.gap = 0.4 + this.rng.next() * 0.8; }
  };
  /** 状態マーク（ダメージなし）：星まどい＝ちから・ようりょく×0.9、迷いの銀札＝移動×0.9（4秒・同じ技は重ねず更新・おはらいで解除） */
  P.hazardEffect = function (h, o) {
    const E = h.eff; if (!E) return;
    if (E.k === 'strYo') { this.addDebuff(o, 'str', E.mul, E.dur, E.src); this.addDebuff(o, 'yo', E.mul, E.dur, E.src); }
    else this.addDebuff(o, E.k, E.mul, E.dur, E.src);
    this.ev('akMark', { slot: o.slot, k: E.k, x: o.x, z: o.z });
  };
  /** 水たまり：中では移動×0.9（重ならない） */
  P.allyMoveMul = function (a) {
    if (!this.stageId.startsWith('akiba')) return 1;
    for (const h of this.hazards) if (h.fx === 'water' && h.t >= h.warn && dist2(a.x, a.z, h.x, h.z) <= h.r) return A().moves.kagami.mul;
    return 1;
  };

  /* ---------- 図形の必殺：2人＝線、3人＝三角の面、4人＝凸四角形の火床 ---------- */
  const area = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  function hull(pts) { // 凸包（Andrew）。4点すべてが頂点のときだけ採用
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-6) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 1e-6) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  P.geoShape = function (foes) {
    const G = A().geo, pts = foes.map(f => [f.x, f.z]), half = A().plaza.half;
    if (pts.some(q => Math.abs(q[0]) > half - G.edge || Math.abs(q[1]) > half - G.edge)) return null; // 外側の通路2.5m
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (dist2(pts[i][0], pts[i][1], pts[j][0], pts[j][1]) < G.minSep) return null;
    const floor = (half * 2) * (half * 2);
    if (pts.length === 2) { const len = dist2(pts[0][0], pts[0][1], pts[1][0], pts[1][1]); if (len * G.line.w > floor * G.maxCover) return null; return { n: 2, pts, yaw: yawTo(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), len }; }
    if (pts.length === 3) { const ar = area(pts); if (ar < G.minArea || ar > floor * G.maxCover) return null; return { n: 3, pts }; }
    const h = hull(pts); if (h.length !== 4) return null; // 1点が内側・3点一直線・交差は使わない
    const ar = area(h); if (ar > floor * G.maxCover) return null;
    return { n: 4, pts: h };
  };
  /** 全員が1.8秒以内に（回避なしで）図形の外へ出られるか */
  P.geoSafe = function (sh) {
    const G = A().geo, half = A().plaza.half, R = DATA.MOB.allyR;
    const inside = (x, z) => sh.n === 2 ? inLine(x, z, sh.pts[0][0], sh.pts[0][1], sh.yaw, sh.len, G.line.w / 2, R) : inPoly(x, z, sh.pts, R);
    return this.allies.every(o => {
      if (o.st !== 'ok') return true;
      const sp = DATA.SIM.walk * this.aiK(o) * (o.dl && o.dl.length ? this.debuffMul(o, 'spd') : 1) * this.allyMoveMul(o), reach = sp * G.reachT;
      if (!inside(o.x, o.z)) return true;
      for (let r = 0.5; r <= reach; r += 0.5) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, x = o.x + Math.sin(a) * r, z = o.z + Math.cos(a) * r; if (Math.abs(x) < half - 0.4 && Math.abs(z) < half - 0.4 && !inside(x, z)) return true; }
      return false;
    });
  };
  P.updateGeo = function (dt) {
    const D = A(), G = D.geo, AK = this.AK;
    if (AK.geo) {
      const g = AK.geo, h = g.hz;
      if (!g.fired && h && h.t >= h.warn) g.fired = true;
      if (!h || h.dead || h.t > h.warn + h.act + 0.05) { for (const m of this.mobs) if (g.ids.includes(m.id)) { m.geo = false; if (m.st === 'ok') m.geoRec = G.rec; } AK.geo = null; AK.geoT = G.every; }
      return;
    }
    if (AK.twinT >= 0) { AK.geoWait = false; return; } // 片方が倒れた後の15秒間は新しく予約しない
    AK.geoT -= dt; if (AK.geoT > 0) return;
    AK.geoWait = true; // 予約：新しい攻撃を始めず、水たまり・攻撃が終わるのを待つ
    if (this.hazards.some(h => h.src === 'akiba' && (h.fx === 'water' || h.t < h.warn + h.act)) || this.mobs.some(m => m.kind === 'akiba' && m.act)) { AK.geoT = 0.2; return; }
    const alive = this.mobs.filter(m => m.kind === 'akiba' && m.st === 'ok'); if (alive.length < 2) { AK.geoWait = false; AK.geoT = 2; return; }
    for (let tries = 0; tries < 24; tries++) {
      let n; const r = this.rng.next(); n = r < G.w[2] ? 2 : r < G.w[2] + G.w[3] ? 3 : 4;
      if (n > alive.length) continue; // 有効な人数で引き直す
      const pick = alive.slice().sort(() => this.rng.next() - 0.5).slice(0, n);
      const sh = this.geoShape(pick); if (!sh || !this.geoSafe(sh)) continue;
      AK.geoWait = false; this.startGeo(pick, sh); return;
    }
    AK.geoWait = false; AK.geoT = 2; // 合う配置がない：取り消して少し後でもう一度
  };
  P.startGeo = function (foes, sh) {
    const G = A().geo, AK = this.AK, src = { str: 750, yo: 813 }; // 共有のようりょく813（相方の強化は重ねない）
    for (const m of foes) { m.geo = true; m.act = null; m.moving = 0; }
    const base = { src: 'akiba', srcStats: src, stat: 'yo', dodge: true, iv: 99, max: 1, geo: 1 };
    let h;
    if (sh.n === 2) h = this.hz(Object.assign(base, { kind: 'line', x: sh.pts[0][0], z: sh.pts[0][1], yaw: sh.yaw, len: sh.len, w: G.line.w, warn: G.line.warn, act: G.line.act, pw: G.line.pw, fx: 'link2' }));
    else if (sh.n === 3) h = this.hz(Object.assign(base, { kind: 'poly', x: 0, z: 0, pts: sh.pts, warn: G.tri.warn, act: G.tri.act, pw: G.tri.pw, fx: 'tri3' }));
    else h = this.hz(Object.assign(base, { kind: 'poly', x: 0, z: 0, pts: sh.pts, warn: G.quad.warn, act: G.quad.dur, pw: G.quad.pw, max: G.quad.max, iv: G.quad.iv, fx: 'quad4' }));
    AK.geo = { n: sh.n, ids: foes.map(m => m.id), whos: foes.map(m => m.who), hz: h, fired: false, cast: ++AK.geoN };
    this.ev('geo', { n: sh.n, whos: AK.geo.whos });
  };
  P.cancelGeo = function (why) {
    const AK = this.AK, g = AK.geo; if (!g) return;
    if (g.hz) g.hz.dead = 1;
    for (const m of this.mobs) if (g.ids.includes(m.id)) { m.geo = false; m.geoRec = 0.5; }
    AK.geo = null; AK.geoT = 4; this.ev('geoCancel', { why });
  };

  /* ---------- 味方AI（秋葉原）：双子は現在HPが高い方（絶対値）を0.6秒ごとに見直す。片方が0なら生き残り側へ ---------- */
  const aiEnemy0 = P.aiEnemy;
  P.aiEnemy = function (a) {
    if (!this.stageId.startsWith('akiba')) return aiEnemy0.call(this, a);
    const alive = this.mobs.filter(m => m.kind === 'akiba' && m.st === 'ok'); if (!alive.length) return null;
    if (!this.AK.plaza) return alive.sort((p, q) => dist2(a.x, a.z, p.x, p.z) - dist2(a.x, a.z, q.x, q.z))[0];
    const twins = alive.filter(m => TWINS.includes(m.who));
    let pick = twins.length ? null : alive[0];
    if (twins.length) {
      const ai = a.ai, cur = twins.find(m => m.id === ai.akPick);
      if (cur && this.t < (ai.akPickT || 0)) pick = cur;
      else { pick = twins.slice().sort((p, q) => q.hp - p.hp || (p.who < q.who ? -1 : 1))[0]; ai.akPick = pick.id; ai.akPickT = this.t + 0.6; }
    }
    // オガ・カエは目の前の危険のときだけ（双子へ届かない・すぐそばに来たとき）
    const near = alive.filter(m => !TWINS.includes(m.who) && dist2(a.x, a.z, m.x, m.z) < 2.2).sort((p, q) => dist2(a.x, a.z, p.x, p.z) - dist2(a.x, a.z, q.x, q.z))[0];
    if (near && pick && dist2(a.x, a.z, pick.x, pick.z) > 6 && this.AK.twinT < 0) return near;
    return pick;
  };
  P.akibaOrbNow = function (a, S) {
    if (!this.AK || !this.AK.plaza || this.AK.twinT < 0) return null;
    const m = this.foe(TWINS.find(w => w !== this.AK.twinDown)); if (!m || m.st !== 'ok') return null;
    return this.gapTo(a.x, a.z, m).g < 4.5 || S.type === 'buff' || S.type === 'debuff';
  };
  P.akibaGunNow = function (a) {
    if (!this.AK || !this.AK.plaza || this.AK.twinT < 0 || this.AK.twinT > 7) return null;
    const m = this.foe(TWINS.find(w => w !== this.AK.twinDown)); if (!m || m.st !== 'ok') return null;
    return this.gapTo(a.x, a.z, m).g < DATA.ITEMS.starburst_gun.range - 2 ? m : null;
  };

  /* ---------- スナップショット ---------- */
  P.akibaSnap = function () {
    const AK = this.AK, g = AK.geo;
    return [AK.plaza ? 1 : 0, Math.round(Math.max(0, AK.twinT) * 100) / 100, AK.twinDown ? TWINS.indexOf(AK.twinDown) + 1 : 0, g ? g.n : 0, g ? g.whos.map(w => ['hoshi', 'naka', 'oga', 'kae'].indexOf(w)).join('') : '', Math.round(this.lvOut * 1000), Math.round(this.lvIn * 1000), this.akLv, AK.twinFails];
  };
  SIMLIB.akibaDecode = a => ({ kind: 'akiba', plaza: !!a[0], twinT: a[1], twinDown: a[2] ? TWINS[a[2] - 1] : null, geoN: a[3], geoWho: a[4] ? String(a[4]).split('').map(i => ['hoshi', 'naka', 'oga', 'kae'][+i]) : [], lvOut: a[5] / 1000, lvIn: a[6] / 1000, lv: a[7], fails: a[8] });
})();
