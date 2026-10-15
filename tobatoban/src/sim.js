/* =====================================================================
   sim.js — 60Hz固定ステップの戦闘シミュレーション（three.js 非依存）
   ホスト（ソロでは自分）だけが実行する。描画はスナップショット経由。
   ===================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angN = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const angDiff = (a, b) => angN(b - a);
const yawTo = (dx, dz) => Math.atan2(dx, dz);
const dist2 = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az; return Math.sqrt(dx * dx + dz * dz); };
class RNG { constructor(s) { this.s = (s >>> 0) || 1; } next() { let t = this.s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } range(a, b) { return a + (b - a) * this.next(); } }

// 行動コード（スナップショットと描画で共有）
const ACTS = ['', 'combo', 'melee', 'shot', 'charge', 'release', 'dodge', 'retreat', 'cast', 'stealth', 'parry', 'heavy', 'guard', 'taunt', 'sp', 'item', 'stagger', 'counter'];
const ACT_I = Object.fromEntries(ACTS.map((k, i) => [k, i]));
const BST = ['intro', 'idle', 'walk', 'wind', 'act', 'rec', 'fly', 'down', 'stun', 'dead', 'hidden'];
const BST_I = Object.fromEntries(BST.map((k, i) => [k, i]));
const BMV = ['', 'fubuki', 'shime', 'otoshi', 'kousen', 'harite', 'junkou', 'zouen'];
const BMV_I = Object.fromEntries(BMV.map((k, i) => [k, i]));
const HZ = ['fan2', 'fan', 'line', 'circle', 'rect', 'path'];
const HZ_I = Object.fromEntries(HZ.map((k, i) => [k, i]));
const PJ = ['star', 'can', 'focus', 'fire', 'mark', 'leaf', 'fuda', 'lantern'];
const PJ_I = Object.fromEntries(PJ.map((k, i) => [k, i]));

function inFan(px, pz, ox, oz, yaw, r0, r1, half, tr) {
  const d = dist2(ox, oz, px, pz);
  if (d > r1 + tr || d < r0 - tr) return false;
  if (d < 0.001) return true;
  const a = Math.abs(angDiff(yaw, yawTo(px - ox, pz - oz)));
  return a <= half + Math.asin(Math.min(1, tr / Math.max(d, tr)));
}
function inLine(px, pz, ox, oz, yaw, len, halfW, tr) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), dx = px - ox, dz = pz - oz;
  const f = dx * fx + dz * fz, s = dx * fz - dz * fx;
  return f >= -tr && f <= len + tr && Math.abs(s) <= halfW + tr;
}

/** ボスの当たり判定と衝突の形（脚2本＋胴の下）。クライアント予測からも使う */
function bossParts(b) {
  const B = DATA.BOSS, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  const p = [{ x: b.x + c * B.legX, z: b.z - s * B.legX, r: B.legR }, { x: b.x - c * B.legX, z: b.z + s * B.legX, r: B.legR }, { x: b.x, z: b.z, r: B.coreR }];
  if (b.st === 'down') p.push({ x: b.x + Math.sin(b.yaw) * 0.7, z: b.z + Math.cos(b.yaw) * 0.7, r: 1.2 });
  return p;
}
function contactPt(q, ox, oz) { const d = dist2(ox, oz, q.x, q.z); if (d < 1e-4) return { x: q.x, z: q.z }; return { x: q.x + (ox - q.x) / d * q.r, z: q.z + (oz - q.z) / d * q.r }; }
class Sim {
  constructor(o) {
    const D = DATA;
    this.D = D; this.dt = 1 / D.SIM.hz; this.tick = 0; this.t = 0;
    this.rng = new RNG(o.seed || 12345);
    this.diffKey = D.DIFF[o.diff] ? o.diff : 'normal'; this.diff = D.DIFF[this.diffKey]; // むずかしさは「通常」の1つだけ
    this.nextId = 1; this.evId = 0; this.events = []; this.mlog = [];
    this.stage = o.test ? 'boss' : 'street'; this.stageT = 0; this.timeLeft = D.SIM.timeLimit;
    this.allies = o.party.map((pp, i) => this.makeAlly(pp, i));
    this.inputs = this.allies.map(() => Sim.emptyInput());
    this.boss = null; this.mobs = []; this.projs = []; this.hazards = []; this.traps = []; this.pickups = [];
    this.lanterns = D.STAGE.lanterns.map(([x, z], i) => ({ i, x, z, lit: false }));
    this.lanternT = 0; this.lanternCool = 0; this.lanternOrder = 0;
    this.wave = 0; this.waveSpawned = false; this.barrier = 'street'; this.introWait = false; this.result = null;
    this.test = !!o.test;
    if (o.test) this.spawnBoss(true);
    else this.spawnWave(0);
  }
  static emptyInput() { return { mx: 0, mz: 0, hold: { A: 0, X: 0, Y: 0, B: 0 }, ev: [], lock: null, healT: null }; }
  id() { return this.nextId++; }
  ev(type, o) { const e = Object.assign({ id: ++this.evId, type, t: this.t }, o || {}); this.events.push(e); return e; }

  makeAlly(pp, slot) {
    const c = DATA.CHI[pp.ch], sw = !!pp.swap;
    const sx = [-1.6, 1.6, -0.5, 0.5][slot], sz = [-60, -60, -61.6, -61.6][slot];
    const items = (pp.items || ['onigiri', 'ramune']).slice(0, 2).map(id => ({ id, n: DATA.SIM.itemStart }));
    const a = {
      id: 'a' + slot, slot, ch: c.id, c, x: sx, z: sz, px: sx, pz: sz, yaw: 0, hp: c.hp, maxHp: c.hp, st: 'ok', downT: 0,
      act: null, slots: { X: sw ? c.Y : c.X, Y: sw ? c.X : c.Y }, cd: { X: 0, Y: 0 }, cdMax: { X: 1, Y: 1 }, g: { X: 1, Y: 1 }, gLock: { X: false, Y: false },
      sp: 0, stam: DATA.SIM.stamMax, tired: false, dashing: false,
      buf: null, lastEv: 0, aq: 0, buffs: { str: 0, strMul: 1, def: 0, defMul: 1, taunt: 0, stealth: 0, ramune: 0 }, inv: 0,
      kx: 0, kz: 0, threat: 0, rev: null, lan: null, items, ctx: '', hurtT: 0, foodT: DATA.SIM.foodPeriod,
      stats: { dmg: 0, revives: 0, specials: 0, downs: 0 }, ai: { next: 0, tx: sx, tz: sz + 2, react: 0.3, hold: null, comboT: 0 },
      nick: pp.nick || '', moving: false, _act: null,
    };
    const sim = this;
    Object.defineProperty(a, 'act', { get() { return this._act; }, set(v) { if (v && v.s === undefined) v.s = sim.tick; this._act = v; }, enumerable: false });
    if (pp.pos) { a.x = a.px = pp.pos[0]; a.z = a.pz = pp.pos[1]; }
    return a;
  }

  /* ---------- 公開API ---------- */
  setInput(slot, inp) { this.inputs[slot] = inp; }
  /** 1ティック進める */
  step() {
    const dt = this.dt;
    this.tick++; this.t += dt; this.stageT += dt;
    if (this.stage === 'won' || this.stage === 'lost') { this.cleanupEvents(); return; }
    const active = this.stage === 'street' || this.stage === 'boss';
    if (active && !this.test) { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(false, 'time'); } }
    for (const a of this.allies) { a.px = a.x; a.pz = a.z; }
    if (this.stage !== 'intro') for (const a of this.allies) this.updateAlly(a, this.inputs[a.slot], dt);
    if (this.boss) this.updateBoss(dt);
    for (const m of this.mobs) this.updateMob(m, dt);
    this.mobs = this.mobs.filter(m => m.st !== 'gone');
    this.updateProjs(dt); this.updateHazards(dt); this.updateTraps(dt); this.updatePickups(dt); this.updateLanterns(dt);
    this.updateStage(dt);
    this.cleanupEvents();
  }
  cleanupEvents() { const lim = this.t - 1.2; if (this.events.length && this.events[0].t < lim) this.events = this.events.filter(e => e.t >= lim); }

  /* ---------- 味方 ---------- */
  /** AIが動かしているキャラは能力をすべて90%にする（プレイヤーが操作を交代すると元に戻る） */
  aiK(a) { return a.ctrlAI ? DATA.SIM.aiMul : 1; }
  stat(a, k) { return a.c[k] * this.aiK(a); }
  free(a) { return a.st === 'ok' && !a.act; }
  canMove(a) {
    if (a.st !== 'ok' || a.rev || a.lan) return 0;
    const k = a.act && a.act.k;
    if (!k) return 1;
    if (k === 'charge') return DATA.SIM.chargeMoveMul;
    if (k === 'shot' && a.act.t >= DATA.MOVES.shot.lock) return 1;
    return 0;
  }
  enemiesAlive() { const r = []; if (this.boss && this.bossHittable()) r.push(this.boss); for (const m of this.mobs) if (m.st === 'ok') r.push(m); return r; }
  bossHittable() { const b = this.boss; return b && b.st !== 'intro' && b.st !== 'dead' && b.st !== 'fly' && b.st !== 'hidden' && !(b.st === 'rec' && b.mv === 'junkou' && b.y > 0.3); }
  hurtParts(e) { return e === this.boss ? bossParts(e) : [{ x: e.x, z: e.z, r: DATA.MOB.r }]; }
  /** 体の表面までの距離（いちばん近い部位） */
  gapTo(x, z, e) { let g = 1e9, q0 = null; for (const q of this.hurtParts(e)) { const d = dist2(x, z, q.x, q.z) - q.r; if (d < g) { g = d; q0 = q; } } return { g, q: q0 }; }
  /** 攻撃の形が体のどこかに触れたら、その接触点を返す（触れなければ null） */
  hitFan(e, ox, oz, yaw, r0, r1, half) { for (const q of this.hurtParts(e)) if (inFan(q.x, q.z, ox, oz, yaw, r0, r1, half, q.r)) return contactPt(q, ox, oz); return null; }
  hitLine(e, ox, oz, yaw, len, halfW) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const q of this.hurtParts(e)) if (inLine(q.x, q.z, ox, oz, yaw, len, halfW, q.r)) { const f = clamp((q.x - ox) * fx + (q.z - oz) * fz, 0, len); return contactPt(q, ox + fx * f, oz + fz * f); }
    return null;
  }
  hitCircle(e, x, z, r) { for (const q of this.hurtParts(e)) if (dist2(x, z, q.x, q.z) <= r + q.r) return contactPt(q, x, z); return null; }
  findTarget(id) { if (id === 'boss') return this.bossHittable() ? this.boss : null; return this.mobs.find(m => m.id === id && m.st === 'ok') || null; }
  faceForAttack(a, inp) {
    const lock = inp.lock && this.findTarget(inp.lock);
    if (lock) { const { q } = this.gapTo(a.x, a.z, lock); a.yaw = yawTo(q.x - a.x, q.z - a.z); return; }
    if (Math.abs(inp.mx) + Math.abs(inp.mz) > 0.2) { a.yaw = yawTo(inp.mx, inp.mz); return; }
    let bq = null, bd = 5.5; // 近くの敵の体へ自動で向く（新作の操作補助）
    for (const e of this.enemiesAlive()) { const { g, q } = this.gapTo(a.x, a.z, e); if (g < bd) { bd = g; bq = q; } }
    if (bq) a.yaw = yawTo(bq.x - a.x, bq.z - a.z);
  }
  updateAlly(a, inp, dt) {
    const S = DATA.SIM;
    // 時間経過
    for (const k of ['X', 'Y']) {
      const sk = DATA.SKILLS[a.slots[k]];
      if (sk.kind === 'guard') {
        const guarding = a.act && a.act.k === 'guard' && a.act.slot === k;
        if (!guarding) { a.g[k] = Math.min(1, a.g[k] + dt / sk.refill); if (a.gLock[k] && a.g[k] >= 1) a.gLock[k] = false; }
      } else if (a.cd[k] > 0) a.cd[k] = Math.max(0, a.cd[k] - dt);
    }
    if (a.inv > 0) a.inv -= dt;
    if (a.hurtT > 0) a.hurtT -= dt;
    for (const k of ['str', 'def', 'taunt', 'stealth', 'ramune']) if (a.buffs[k] > 0) a.buffs[k] = Math.max(0, a.buffs[k] - dt);
    a.threat *= (1 - S.threatDecay * dt);
    if (a.c.passive === 'food' && a.st === 'ok' && (this.stage === 'boss' || this.stage === 'street')) {
      a.foodT -= dt; if (a.foodT <= 0) { a.foodT = S.foodPeriod; this.spawnPickup('food', a.x + Math.sin(a.yaw) * 1.2, a.z + Math.cos(a.yaw) * 1.2); this.ev('sfx', { s: 'food', x: a.x, z: a.z }); }
    }
    if (a.st === 'down') {
      a.downT += dt;
      if (a.downT >= S.ascendTime) { a.st = 'gone'; a.act = null; this.ev('ascend', { slot: a.slot }); }
      this.processEvents(a, inp, true); return;
    }
    if (a.st === 'gone') { this.processEvents(a, inp, true); return; }
    // 入力イベント
    this.processEvents(a, inp, false);
    // 行動の進行
    if (a.act) this.runAct(a, inp, dt);
    if (a.buf && this.t - a.buf.t > S.inputBuffer) a.buf = null;
    if (!a.act && a.buf) { const b = a.buf; a.buf = null; this.press(a, inp, b.code); }
    // 救助・灯籠
    this.updateContext(a, inp, dt);
    // 移動
    const mv = this.canMove(a);
    let mx = inp.mx || 0, mz = inp.mz || 0; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    a.moving = false; a.dashing = false;
    if (mv > 0 && ml > 0.1) {
      let spd = S.walk;
      const wantDash = inp.hold.B && !a.rev && !a.lan && (!a.act);
      if (wantDash && !a.tired && (a.stam > 0 || a.buffs.ramune > 0)) { spd = S.dash; a.dashing = true; }
      spd *= mv * this.aiK(a);
      this.moveAlly(a, mx * spd * dt, mz * spd * dt);
      const ty = yawTo(mx, mz); a.yaw += clamp(angDiff(a.yaw, ty), -12 * dt, 12 * dt);
      a.moving = true;
    }
    if (a.dashing) { if (a.buffs.ramune <= 0) { a.stam -= S.stamDrain * dt; if (a.stam <= 0) { a.stam = 0; a.tired = true; } } }
    else { a.stam = Math.min(S.stamMax, a.stam + S.stamRegen * dt); if (a.tired && a.stam >= S.stamRedash) a.tired = false; }
    if (Math.abs(a.kx) + Math.abs(a.kz) > 0.01) { this.moveAlly(a, a.kx * dt, a.kz * dt); a.kx *= Math.pow(0.02, dt); a.kz *= Math.pow(0.02, dt); }
    // 拾う
  }
  moveAlly(a, dx, dz) { const r = this.clampPos(a.x, a.z, a.x + dx, a.z + dz, 0.35); a.x = r[0]; a.z = r[1]; }
  clampPos(ox, oz, nx, nz, rad) {
    const ST = DATA.STAGE, hw = ST.streetHalfW - rad, pw = ST.plazaHalfW - rad;
    if (nz < 0) {
      if (Math.abs(nx) > hw) { if (oz >= 0 && Math.abs(ox) > hw) nz = 0; else nx = clamp(nx, -hw, hw); }
      nz = Math.max(nz, ST.streetZ0 + rad);
    } else { nx = clamp(nx, -pw, pw); nz = Math.min(nz, ST.plazaZ1 - rad); }
    if (this.barrier === 'street' && nz > -0.3) nz = -0.3;
    if (this.barrier === 'plaza' && nz < 0.6) nz = 0.6;
    // アーケードの柱
    if (nz < 0) for (const sx of [-ST.pillarX, ST.pillarX]) {
      const k = Math.round(nz / ST.pillarStep) * ST.pillarStep, dx = nx - sx, dz = nz - k, d = Math.hypot(dx, dz), m = 0.22 + rad;
      if (d < m && d > 1e-4) { nx = sx + dx / d * m; nz = k + dz / d * m; }
    }
    // ボスの体
    const b = this.boss;
    if (b && b.st !== 'fly' && b.st !== 'hidden' && b.st !== 'dead' && b.y < 1.2) {
      for (let it = 0; it < 2; it++) for (const q of bossParts(b)) {
        const dx = nx - q.x, dz = nz - q.z, d = Math.hypot(dx, dz), m = q.r + rad;
        if (d < m) { if (d < 1e-4) { nx = q.x + m; } else { nx = q.x + dx / d * m; nz = q.z + dz / d * m; } }
      }
    }
    return [nx, nz];
  }
  processEvents(a, inp, deadOnly) {
    const evs = inp.ev || [];
    for (const e of evs) {
      const id = e[0]; if (id <= a.lastEv) continue; a.lastEv = id;
      const code = e[1];
      if (code === 'sig') { this.ev('sig', { slot: a.slot, code: e[2] }); if (e[2] === 'lantern') this.lanternOrder = this.t + 40; continue; }
      if (deadOnly) continue;
      if (code === 'X-' || code === 'Y-') { this.release(a, inp, code[0]); continue; }
      if (code === 'B+' || code === 'B-') { if (code === 'B+') this.bPress(a); else { a.rev = null; a.lan = null; } continue; }
      if (a.st !== 'ok') continue;
      if (code === 'A' && a.act && a.act.k === 'combo') { this.pressA(a, inp); continue; }
      if (code === 'SP') { this.pressSP(a, inp); continue; } // 必殺は通常の行動を中断して出せる（新作の仮仕様）
      if (a.act) { a.buf = { code, t: this.t }; continue; }
      this.press(a, inp, code);
    }
  }
  bPress(a) {
    if (!this.free(a)) return;
    const tg = this.reviveTarget(a);
    if (tg) { a.rev = { target: tg.slot, t: 0 }; return; }
    const l = this.nearLantern(a); if (l) a.lan = { i: l.i, t: 0 };
  }
  reviveTarget(a) { let best = null, bd = DATA.SIM.reviveRange; for (const o of this.allies) if (o !== a && o.st === 'down') { const d = dist2(a.x, a.z, o.x, o.z); if (d < bd) { bd = d; best = o; } } return best; }
  nearLantern(a) { if (this.stage !== 'boss' || this.lanternCool > 0) return null; for (const l of this.lanterns) if (!l.lit && dist2(a.x, a.z, l.x, l.z) < 1.9) return l; return null; }
  updateContext(a, inp, dt) {
    a.ctx = this.reviveTarget(a) ? 'revive' : this.nearLantern(a) ? 'lantern' : 'dash';
    // Bを押し続けたまま近づいたときも救助・点灯を始める（移動入力がないとき）
    if (inp.hold.B && !a.rev && !a.lan && a.ctx !== 'dash' && this.free(a) && Math.abs(inp.mx || 0) + Math.abs(inp.mz || 0) < 0.1) this.bPress(a);
    if (a.rev) {
      const tg = this.allies[a.rev.target];
      if (!inp.hold.B || !tg || tg.st !== 'down' || dist2(a.x, a.z, tg.x, tg.z) > DATA.SIM.reviveRange + 0.3 || a.act) { a.rev = null; }
      else {
        a.rev.t += dt;
        const need = a.c.passive === 'reviver' ? DATA.SIM.reviveTimeMomiji : DATA.SIM.reviveTime;
        if (a.rev.t >= need) { this.revive(tg, a.c.passive === 'reviver' ? DATA.SIM.reviveHpMomiji : DATA.SIM.reviveHp, a); a.rev = null; a.stats.revives++; }
      }
    }
    if (a.lan) {
      const l = this.lanterns[a.lan.i];
      if (!inp.hold.B || l.lit || dist2(a.x, a.z, l.x, l.z) > 2.2 || a.act) a.lan = null;
      else { a.lan.t += dt; if (a.lan.t >= DATA.SIM.lanternHold) { this.lightLantern(l, a); a.lan = null; } }
    }
  }
  revive(o, ratio, by) { o.st = 'ok'; o.downT = 0; o.hp = Math.max(1, Math.round(o.maxHp * ratio)); o.inv = 1.5; o.act = null; this.ev('revive', { slot: o.slot, by: by ? by.slot : -1, x: o.x, z: o.z }); }

  /** ボタン押下の処理 */
  press(a, inp, code) {
    if (a.st !== 'ok') return;
    if (code === 'A') return this.pressA(a, inp);
    if (code === 'X+' || code === 'Y+') return this.pressSkill(a, inp, code[0]);
    if (code === 'SP') return this.pressSP(a, inp);
    if (code === 'I0' || code === 'I1') return this.useItem(a, +code[1]);
  }
  logStart(a, nm) { const L = { id: this.evId + 1 + '-' + a.slot, slot: a.slot, nm, tIn: this.t, tStart: this.t, hits: [], tEnd: null, cdReady: null, dmg: [], buff: '', def: null }; this.mlog.push(L); if (this.mlog.length > 40) this.mlog.shift(); return L; }
  pressA(a, inp) {
    const M = DATA.MOVES, kind = a.c.A;
    if (a.act && a.act.k === 'combo') {
      const t = a.act.t, H = M.combo3.hits;
      if (!a.act.q2 && t < H[1]) a.act.q2 = 1; else if (a.act.q2 && !a.act.q3 && t < H[2]) a.act.q3 = 1;
      return;
    }
    if (!this.free(a)) { a.buf = { code: 'A', t: this.t }; return; }
    this.faceForAttack(a, inp);
    if (kind === 'combo3') a.act = { k: 'combo', t: 0, h: [0, 0, 0], q2: 0, q3: 0, log: this.logStart(a, '三連') };
    else if (kind === 'melee1') a.act = { k: 'melee', t: 0, done: 0, log: this.logStart(a, '近接打撃') };
    else a.act = { k: 'shot', t: 0, done: 0, log: this.logStart(a, '射撃') };
  }
  pressSkill(a, inp, k) {
    const sk = DATA.SKILLS[a.slots[k]];
    if (!this.free(a)) { if (sk.kind !== 'guard') a.buf = { code: k + '+', t: this.t }; return; }
    if (sk.kind === 'guard') {
      if (a.gLock[k] || a.g[k] < sk.threshold) return;
      a.act = { k: 'guard', slot: k, t: 0, sk }; a.threat += 40; return;
    }
    if (a.cd[k] > 0) return;
    this.faceForAttack(a, inp);
    const lg = this.logStart(a, sk.nm);
    switch (sk.kind) {
      case 'charge': case 'heal': case 'healRing': a.act = { k: 'charge', slot: k, t: 0, sk, log: lg }; break;
      case 'dodge': {
        let dx = inp.mx || 0, dz = inp.mz || 0; const l = Math.hypot(dx, dz);
        if (l < 0.2) { dx = Math.sin(a.yaw); dz = Math.cos(a.yaw); } else { dx /= l; dz /= l; a.yaw = yawTo(dx, dz); }
        a.act = { k: 'dodge', slot: k, t: 0, dx, dz, log: lg }; this.setCd(a, k, DATA.DODGE.cd); this.ev('sfx', { s: 'dodge', x: a.x, z: a.z }); break;
      }
      case 'retreat': a.act = { k: 'retreat', slot: k, t: 0, sk, done: 0, log: lg }; this.setCd(a, k, DATA.RETREAT.cd); break;
      case 'dot': a.act = { k: 'cast', slot: k, t: 0, sk, done: 0, end: 0.32, log: lg }; this.setCd(a, k, sk.cd); break;
      case 'stealth': a.act = { k: 'stealth', slot: k, t: 0, sk, done: 0, end: 0.3, log: lg }; this.setCd(a, k, sk.cd); break;
      case 'parry': a.act = { k: 'parry', slot: k, t: 0, sk, log: lg }; this.setCd(a, k, sk.cd); this.ev('sfx', { s: 'parryStance', x: a.x, z: a.z }); break;
      case 'heavy': a.act = { k: 'heavy', slot: k, t: 0, sk, done: 0, log: lg }; this.setCd(a, k, sk.cd); this.ev('sfx', { s: 'heavyWind', x: a.x, z: a.z }); break;
      case 'trap': case 'mine': a.act = { k: 'cast', slot: k, t: 0, sk, done: 0, end: 0.35, log: lg }; this.setCd(a, k, sk.cd); break;
      case 'protect': a.act = { k: 'cast', slot: k, t: 0, sk, done: 0, end: 0.35, log: lg }; this.setCd(a, k, sk.cd); break;
      case 'taunt': a.act = { k: 'taunt', slot: k, t: 0, sk, done: 0, log: lg }; this.setCd(a, k, sk.cd); break;
    }
  }
  setCd(a, k, v) { a.cd[k] = v; a.cdMax[k] = v; }
  release(a, inp, k) {
    if (a.act && a.act.k === 'guard' && a.act.slot === k) { a.act = null; return; }
    if (!(a.act && a.act.k === 'charge' && a.act.slot === k)) return;
    const sk = a.act.sk, max = sk.kind === 'charge' ? DATA.CHARGE.max : sk.max;
    const ratio = clamp(a.act.t / max, 0, 1);
    if (sk.kind === 'charge') this.faceForAttack(a, inp);
    a.act = { k: 'release', slot: k, t: 0, sk, ratio, done: 0, healT: inp.healT, log: a.act.log };
    this.setCd(a, k, sk.kind === 'charge' ? DATA.CHARGE.cd : sk.cd);
  }
  pressSP(a, inp) {
    if (a.sp < 100 || a.st !== 'ok') return;
    if (a.act && (a.act.k === 'sp' || a.act.k === 'stagger')) return;
    a.sp = 0; a.rev = null; a.lan = null;
    this.faceForAttack(a, inp);
    const S = DATA.SPECIALS[a.c.sp];
    a.act = { k: 'sp', t: 0, S, n: 0, done: 0, ox: a.x, oz: a.z, oyaw: a.yaw, log: this.logStart(a, a.c.spNm) };
    a.stats.specials++;
    this.ev('sp', { slot: a.slot, nm: a.c.spNm, ch: a.c.id });
  }
  useItem(a, i) {
    const it = a.items[i]; if (!it || it.n <= 0 || !this.free(a)) return;
    const I = DATA.ITEMS[it.id];
    a.act = { k: 'item', t: 0, it: it.id, slotI: i, done: 0, end: I.use };
  }
  runAct(a, inp, dt) {
    const A = a.act; A.t = (this.tick - A.s) * dt + 1e-9; const t = A.t, M = DATA.MOVES;
    switch (A.k) {
      case 'combo': {
        const H = M.combo3.hits;
        for (let i = 0; i < 3; i++) {
          const ok = i === 0 || (i === 1 && A.q2) || (i === 2 && A.q3);
          if (ok && !A.h[i] && t >= H[i]) { A.h[i] = 1; this.faceForAttack(a, inp); this.meleeHit(a, a.c.Apw[i], 'str', M.combo3.range, M.combo3.arc, 'A', A.log, i === 2 ? 'hit3' : 'hit'); }
        }
        if ((!A.q2 && t >= H[1]) || (A.q2 && !A.q3 && t >= H[2]) || t >= M.combo3.end) this.endAct(a);
        break;
      }
      case 'melee':
        if (!A.done && t >= M.melee1.start) { A.done = 1; this.meleeHit(a, a.c.Apw[0], 'str', M.melee1.range, M.melee1.arc, 'A', A.log, 'hit'); }
        if (t >= M.melee1.end) this.endAct(a); break;
      case 'shot':
        if (!A.done && t >= M.shot.fire) { A.done = 1; this.fireProj(a, a.c.id === 'burikidon' ? 'can' : 'star', a.c.Apw[0], 'str', M.shot.speed, M.shot.life, M.shot.r, 'A', A.log); }
        if (t >= M.shot.end) this.endAct(a); break;
      case 'charge': {
        const max = A.sk.kind === 'charge' ? DATA.CHARGE.max : A.sk.max;
        A.ratio = clamp(t / max, 0, 1);
        if (A.sk.kind === 'charge' && inp.mx * inp.mx + inp.mz * inp.mz < 0.01) this.faceForAttack(a, inp);
        if (!inp.hold[A.slot] && t > 0) this.release(a, inp, A.slot); // 離した入力が先に届いた場合の安全策
        break;
      }
      case 'release': {
        const C = DATA.CHARGE, sk = A.sk;
        if (!A.done && t >= C.start) { A.done = 1; this.releaseEffect(a, A); }
        if (t >= C.start + C.rec) this.endAct(a); break;
      }
      case 'dodge': {
        const D = DATA.DODGE, ivEnd = D.iv1 + (a.c.passive === 'dodgePlus' ? D.kogePlus : 0);
        if (t >= D.iv0 && t <= ivEnd) a.inv = Math.max(a.inv, dt * 1.01);
        if (t <= D.moveT) { const s = D.dist / D.moveT; this.moveAlly(a, A.dx * s * dt, A.dz * s * dt); }
        if (t >= D.end) this.endAct(a); break;
      }
      case 'retreat': {
        const R = DATA.RETREAT;
        if (t >= R.iv0 && t <= R.iv1) a.inv = Math.max(a.inv, dt * 1.01);
        if (!A.done && t >= R.hit) { A.done = 1; this.meleeHit(a, A.sk.pw, A.sk.stat, 1.7, 1.2, 'skill', A.log, 'slash'); A.bx = -Math.sin(a.yaw); A.bz = -Math.cos(a.yaw); }
        if (A.done && t <= 0.40) { const s = R.dist / 0.28; this.moveAlly(a, A.bx * s * dt, A.bz * s * dt); }
        if (t >= R.end) this.endAct(a); break;
      }
      case 'cast': {
        const sk = A.sk;
        if (!A.done && t >= 0.12) {
          A.done = 1;
          if (sk.kind === 'dot') this.fireProj(a, 'mark', 0, 'yo', sk.speed, 1.0, 0.4, 'skill', A.log, sk);
          else if (sk.kind === 'trap') { this.placeTrap(a, 'para', sk); }
          else if (sk.kind === 'mine') { this.placeTrap(a, 'mine', sk); }
          else if (sk.kind === 'protect') { for (const o of this.allies) if (o.st === 'ok' && dist2(a.x, a.z, o.x, o.z) <= sk.r) o.inv = Math.max(o.inv, sk.inv); this.ev('protect', { slot: a.slot, x: a.x, z: a.z, r: sk.r }); }
        }
        if (t >= (A.end || 0.35)) this.endAct(a); break;
      }
      case 'stealth':
        if (!A.done && t >= 0.1) { A.done = 1; a.buffs.stealth = A.sk.dur; a.threat *= 0.2; this.ev('sfx', { s: 'stealth', x: a.x, z: a.z }); }
        if (t >= A.end) this.endAct(a); break;
      case 'parry':
        if (t >= A.sk.win + 0.2) this.endAct(a); break;
      case 'counter':
        if (t >= 0.45) this.endAct(a); break;
      case 'heavy': {
        const sk = A.sk;
        if (t < 0.6) this.faceForAttack(a, inp);
        if (!A.done && t >= sk.start) { A.done = 1; this.meleeHit(a, sk.pw, sk.stat, sk.range, sk.arc, 'skill', A.log, 'heavy'); }
        if (t >= sk.start + sk.active + sk.rec) this.endAct(a); break;
      }
      case 'taunt': {
        const sk = A.sk;
        if (!A.done && t >= sk.start) { A.done = 1; this.meleeHit(a, sk.pw, sk.stat, sk.range, sk.arc, 'skill', A.log, 'hit'); a.threat += sk.threat; this.ev('taunt', { slot: a.slot, x: a.x, z: a.z }); }
        if (t >= sk.end) this.endAct(a); break;
      }
      case 'guard': {
        const sk = A.sk, k = A.slot;
        a.g[k] -= dt / sk.max; a.threat += 30 * dt;
        if (a.g[k] <= 0) { a.g[k] = 0; a.gLock[k] = true; this.endAct(a); this.ev('sfx', { s: 'guardBreak', x: a.x, z: a.z }); }
        else if (!inp.hold[k]) this.endAct(a);
        break;
      }
      case 'sp': this.runSpecial(a, A, inp, dt); break;
      case 'item':
        if (!A.done && t >= A.end * 0.5) { A.done = 1; this.itemEffect(a, A); }
        if (t >= A.end) this.endAct(a); break;
      case 'stagger':
        if (t >= A.end) this.endAct(a); break;
    }
  }
  endAct(a) {
    const A = a.act;
    if (A && A.log) { A.log.tEnd = this.t; const k = A.slot; A.log.cdReady = k ? (DATA.SKILLS[a.slots[k]].kind === 'guard' ? null : this.t + a.cd[k]) : null; }
    a.act = null;
  }
  releaseEffect(a, A) {
    const sk = A.sk, C = DATA.CHARGE;
    if (sk.kind === 'charge') {
      const mul = 1 + (C.mul - 1) * A.ratio, pw = sk.pw * mul;
      if (sk.form === 'melee') this.meleeHit(a, pw, sk.stat, sk.range, sk.arc, 'skillX', A.log, A.ratio > 0.95 ? 'heavy' : 'palm', { chargeRatio: A.ratio });
      else if (sk.form === 'shot') this.fireProj(a, 'focus', pw, sk.stat, sk.speed, 0.8, 0.45 + 0.35 * A.ratio, A.slot === 'X' ? 'skillX' : 'skill', A.log, { ratio: A.ratio });
      else if (sk.form === 'blast') this.fireProj(a, 'fire', pw, sk.stat, sk.speed, 0.9, 0.5, 'skill', A.log, { blast: sk.blastR * (1 + 0.3 * A.ratio), ratio: A.ratio });
      else if (sk.form === 'drain') { const got = this.meleeHit(a, pw, sk.stat, sk.range, sk.arc, 'skill', A.log, 'smoke'); if (got > 0) this.healAlly(a, Math.round(got * sk.drain), a, true); }
    } else if (sk.kind === 'heal') {
      const mul = 1 + (sk.mul - 1) * A.ratio;
      let tg = A.healT != null ? this.allies[A.healT] : null;
      if (!tg || tg.st !== 'ok' || dist2(a.x, a.z, tg.x, tg.z) > sk.range) { tg = null; let lo = 2; for (const o of this.allies) if (o.st === 'ok' && dist2(a.x, a.z, o.x, o.z) <= sk.range) { const r = o.hp / o.maxHp; if (r < lo) { lo = r; tg = o; } } }
      if (tg) { const v = Math.round(sk.pw * mul * this.stat(a, 'yo') / 100); this.ev('leaf', { from: a.slot, to: tg.slot }); if (this.healAlly(tg, v, a) > 0) this.gainSp(a, DATA.SIM.spHeal); }
    } else if (sk.kind === 'healRing') {
      const r = sk.r0 + (sk.r1 - sk.r0) * A.ratio, v = Math.round(sk.pw * this.stat(a, 'yo') / 100); let any = 0;
      for (const o of this.allies) if (o.st === 'ok' && dist2(a.x, a.z, o.x, o.z) <= r) any += this.healAlly(o, v, a);
      this.ev('ring', { slot: a.slot, x: a.x, z: a.z, r });
      if (any > 0) this.gainSp(a, DATA.SIM.spHeal);
    }
  }
  healAlly(o, v, by, silent) {
    if (o.st !== 'ok') return 0;
    const before = o.hp; o.hp = Math.min(o.maxHp, o.hp + v); const got = o.hp - before;
    if (by) by.threat += got * 0.5;
    if (!silent || got > 0) this.ev('heal', { slot: o.slot, v: got, x: o.x, z: o.z });
    return got;
  }
  gainSp(a, v) { if (a.st === 'ok') a.sp = Math.min(100, a.sp + v); }
  /** 近接判定。命中した総ダメージを返す */
  meleeHit(a, pw, stat, range, arc, kind, log, fx, extra) {
    let total = 0, n = 0;
    for (const e of this.enemiesAlive()) {
      const h = this.hitFan(e, a.x, a.z, a.yaw, 0, range, arc);
      if (h) { const d = this.dealToEnemy(a, e, pw, stat, kind, log, h); total += d; n++; }
    }
    this.ev('swing', { slot: a.slot, fx, x: a.x, z: a.z, yaw: a.yaw, hit: n > 0 ? 1 : 0 });
    if (n > 0) this.spForHit(a, kind, log);
    return total;
  }
  spForHit(a, kind, log) {
    const S = DATA.SIM;
    if (kind === 'A') this.gainSp(a, S.spA);
    else if (kind === 'skill' || kind === 'skillX') { const L = log || a.act || {}; const used = (L.spGot || 0); const add = Math.min(S.spSkill, S.spSkillCap - used); if (add > 0) { this.gainSp(a, add); L.spGot = used + add; } }
  }
  undetected(a) { return a.buffs.stealth > 0 || (!(this.boss && this.boss.st !== 'dead' && this.boss.target === a.slot) && !this.mobs.some(m => m.st === 'ok' && m.tgt === a.slot)); }
  partyHas(pass) { return this.allies.some(o => o.c.passive === pass && o.st !== 'gone'); }
  dealToEnemy(a, e, pw, stat, kind, log, hit) {
    if (e === this.boss && !this.bossHittable()) return 0;
    if (e.st && e.st !== 'ok' && e !== this.boss) return 0;
    const S = DATA.SIM, P = DATA.PASSIVE;
    let atk = stat === 'yo' ? this.stat(a, 'yo') : stat === 'mix' ? (this.stat(a, 'str') + this.stat(a, 'yo')) / 2 : this.stat(a, 'str');
    let state = 1;
    if (stat !== 'yo') { if (a.buffs.str > 0) state *= a.buffs.strMul; if (this.partyHas('partyStr')) state *= P.partyStr; }
    if (a.c.passive === 'fullHp' && a.hp >= a.maxHp) state *= P.fullHp;
    if (a.c.passive === 'xPower' && kind === 'skillX') state *= P.xPower;
    let def = e.def * (e.defDown > 0 ? DATA.SPECIALS.weaken.defDown : 1);
    let elem = 1; if (e === this.boss) { if (a.c.el === DATA.BOSS.weak) elem = S.elemGood; else if (a.c.el === DATA.BOSS.strong) elem = S.elemBad; }
    let rate = S.critRate + (this.partyHas('partyCrit') ? DATA.PASSIVE.partyCrit : 0);
    let crit = this.rng.next() < rate;
    if (a.c.passive === 'stealthCrit' && this.undetected(a)) crit = true;
    const cm = crit ? (a.c.passive === 'critPower' ? P.critPower : S.critMul) : 1;
    const dmg = Math.max(1, Math.round(pw * atk / (S.defBase + def) * elem * state * cm));
    e.hp -= dmg; a.threat += dmg; a.stats.dmg += dmg;
    if (log) { log.hits.push(+this.t.toFixed(3)); log.dmg.push(dmg); log.def = Math.round(def); log.buff = (state !== 1 ? '×' + state.toFixed(2) : '') + (crit ? ' 会心' : '') + (elem !== 1 ? ' 属性×' + elem : ''); }
    this.ev('dmg', { v: dmg, crit: crit ? 1 : 0, x: hit ? hit.x : e.x, z: hit ? hit.z : e.z, y: e === this.boss ? (e.st === 'down' ? 1.6 : 1.0) : 0.6, src: a.slot, kind, el: elem > 1 ? 1 : elem < 1 ? -1 : 0 });
    if (e.hp <= 0) { e.hp = 0; if (e === this.boss) this.bossDie(); else this.mobDie(e, a); }
    return dmg;
  }
  /** 敵から味方へのダメージ */
  dealToAlly(o, pw, stat, srcStats, opt) {
    opt = opt || {};
    if (o.st !== 'ok') return 0;
    if (o.inv > 0 || (o.act && o.act.k === 'sp')) { this.ev('miss', { x: o.x, z: o.z, slot: o.slot }); return 0; }
    if (o.act && o.act.k === 'parry' && o.act.t <= o.act.sk.win) {
      const sk = o.act.sk; o.act = { k: 'counter', t: 0 }; o.inv = 0.45;
      this.ev('parry', { slot: o.slot, x: o.x, z: o.z });
      const src = opt.src === 'none' ? null : (opt.src || this.boss);
      if (src && src.hp > 0 && (src !== this.boss || this.bossHittable())) { const { q } = this.gapTo(o.x, o.z, src); o.yaw = yawTo(q.x - o.x, q.z - o.z); this.dealToEnemy(o, src, sk.pw, sk.stat, 'skill', null, contactPt(q, o.x, o.z)); }
      return 0;
    }
    const atk = stat === 'yo' ? srcStats.yo : srcStats.str;
    const def = this.stat(o, 'def') * (o.buffs.def > 0 ? o.buffs.defMul : 1);
    let dmg = pw * atk / (DATA.SIM.defBase + def) / this.aiK(o); // AIが動かすキャラは体力も90%相当
    const guarding = o.act && o.act.k === 'guard';
    if (guarding) {
      dmg *= o.c.passive === 'guardPlus' ? DATA.PASSIVE.guardPlus : o.act.sk.mul;
      this.ev('block', { slot: o.slot, x: o.x, z: o.z });
      if (o.act.sk.reflect && opt.src && opt.src.hp > 0) { const rv = Math.max(1, Math.round(pw * atk / (DATA.SIM.defBase + def) * o.act.sk.reflect * this.aiK(o))); this.reflectTo(o, opt.src, rv); }
    }
    dmg = Math.max(1, Math.round(dmg));
    o.hp -= dmg; o.hurtT = 0.25; o.rev = null; o.lan = null;
    this.gainSp(o, DATA.SIM.spHurt);
    this.ev('hurt', { slot: o.slot, v: dmg, x: o.x, z: o.z, g: guarding ? 1 : 0 });
    if (o.hp <= 0) { o.hp = 0; o.st = 'down'; o.downT = 0; o.act = null; o.stats.downs++; this.ev('down', { slot: o.slot, x: o.x, z: o.z }); this.checkWipe(); return dmg; }
    if (opt.knock && !guarding && !(o.act && o.act.k === 'sp')) {
      o.act = { k: 'stagger', t: 0, end: DATA.SIM.hitStagger }; o.rev = null;
      const kx = opt.kx || 0, kz = opt.kz || 0, kl = Math.hypot(kx, kz) || 1; o.kx = kx / kl * opt.knock; o.kz = kz / kl * opt.knock;
    }
    return dmg;
  }
  reflectTo(o, src, v) {
    if (src === this.boss && !this.bossHittable()) return;
    src.hp -= v; o.stats.dmg += v; this.ev('dmg', { v, crit: 0, x: src.x, z: src.z, y: src === this.boss ? 2.4 : 0.8, src: o.slot, kind: 'reflect', el: 0 });
    if (src.hp <= 0) { src.hp = 0; if (src === this.boss) this.bossDie(); else this.mobDie(src, o); }
  }
  checkWipe() { if (this.allies.every(o => o.st !== 'ok')) this.finish(false, 'wipe'); }
  runSpecial(a, A, inp, dt) {
    const S = A.S, t = A.t;
    a.inv = Math.max(a.inv, dt * 1.01); // 発動承認〜動作終了まで本人のみ無敵（仮設定）
    if (S.type === 'multi') {
      while (A.n < S.n && t >= S.prep + A.n * S.iv) {
        A.n++;
        let hits = 0;
        for (const e of this.enemiesAlive()) {
          const inside = S.shape === 'fan' ? this.hitFan(e, a.x, a.z, a.yaw, 0, S.range, S.arc) : this.hitLine(e, a.x, a.z, a.yaw, S.len, S.w / 2);
          if (inside) { this.dealToEnemy(a, e, S.pw, a.c.id === 'akaneten' || a.c.id === 'kemuridama' ? 'yo' : 'str', 'sp', A.log, inside); hits++; if (S.defDown) { e.defDown = S.defDownT; this.ev('defdown', { x: e.x, z: e.z }); } }
        }
        this.ev('sphit', { slot: a.slot, n: A.n, ch: a.c.id, x: a.x, z: a.z, yaw: a.yaw, hit: hits });
      }
      if (t >= S.prep + (S.n - 1) * S.iv + S.tail) this.endAct(a);
    } else if (S.type === 'buff') {
      if (!A.done && t >= S.prep) { A.done = 1; for (const o of this.allies) if (o.st === 'ok' && dist2(a.x, a.z, o.x, o.z) <= S.r) { o.buffs.str = S.dur; o.buffs.strMul = S.mul; } this.ev('spfx', { slot: a.slot, k: 'buff', x: a.x, z: a.z }); }
      if (t >= S.end) this.endAct(a);
    } else if (S.type === 'guardup') {
      if (!A.done && t >= S.prep) { A.done = 1; a.buffs.def = S.dur; a.buffs.defMul = S.mul; a.buffs.taunt = S.dur; a.threat += S.threat; this.ev('spfx', { slot: a.slot, k: 'guardup', x: a.x, z: a.z }); }
      if (t >= S.end) this.endAct(a);
    } else if (S.type === 'heal') {
      if (!A.done && t >= S.prep) {
        A.done = 1; const v = Math.round(S.pw * this.stat(a, 'yo') / 100);
        for (const o of this.allies) { if (o.st === 'down') this.revive(o, S.revHp, a); }
        for (const o of this.allies) if (o.st === 'ok') this.healAlly(o, v, a);
        this.ev('spfx', { slot: a.slot, k: 'heal', x: a.x, z: a.z });
      }
      if (t >= S.end) this.endAct(a);
    }
  }
  itemEffect(a, A) {
    const it = a.items[A.slotI]; if (!it || it.n <= 0) return; it.n--;
    const I = DATA.ITEMS[A.it];
    if (A.it === 'onigiri') this.healAlly(a, Math.round(a.maxHp * I.heal), null);
    else if (A.it === 'ramune') { a.stam = DATA.SIM.stamMax; a.tired = false; a.buffs.ramune = I.dur; }
    else if (A.it === 'shibireFuda') this.placeTrap(a, 'para', DATA.SKILLS.shibire);
    else if (A.it === 'kemuriDama') { a.buffs.stealth = I.dur; a.threat *= 0.2; }
    this.ev('item', { slot: a.slot, it: A.it, x: a.x, z: a.z });
  }

  /* ---------- 弾・ワナ・拾い物 ---------- */
  fireProj(a, kind, pw, stat, speed, life, r, hk, log, extra) {
    const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
    const p = { id: this.id(), kind, team: 'ally', owner: a.slot, x: a.x + fx * 0.6, y: 0.6, z: a.z + fz * 0.6, vx: fx * speed, vz: fz * speed, life, r, pw, stat, hk, log, hit: new Set(), ex: extra || null, yaw: a.yaw };
    this.projs.push(p); this.ev('sfx', { s: 'shot_' + kind, x: a.x, z: a.z });
  }
  updateProjs(dt) {
    for (const p of this.projs) {
      p.life -= dt; p.x += p.vx * dt; p.z += p.vz * dt;
      if (p.team === 'ally') {
        const a = this.allies[p.owner];
        for (const e of this.enemiesAlive()) {
          if (p.hit.has(e.id)) continue;
          const h = this.hitCircle(e, p.x, p.z, p.r);
          if (h) {
            p.hit.add(e.id);
            if (p.kind === 'mark') { (e.dots || (e.dots = [])).push({ src: p.owner, left: p.ex.dur, next: p.ex.tick, pw: p.ex.pw, stat: p.ex.stat }); this.ev('mark', { x: e.x, z: e.z }); this.spForHit(a, 'skill', p.log); p.life = 0; break; }
            if (p.ex && p.ex.blast) { this.blast(a, p.x, p.z, p.ex.blast, p.pw, p.stat, p.hk, p.log); p.life = 0; break; }
            this.dealToEnemy(a, e, p.pw, p.stat, p.hk, p.log, h); this.spForHit(a, p.hk, p.log);
            this.ev('phit', { x: h.x, z: h.z, k: p.kind });
            if (p.kind !== 'focus') { p.life = 0; break; }
          }
        }
        if (p.life <= 0 && p.ex && p.ex.blast && !p.hit.size) this.blast(a, p.x, p.z, p.ex.blast, p.pw, p.stat, p.hk, p.log);
      } else {
        for (const o of this.allies) {
          if (o.st !== 'ok' || p.hit.has(o.id)) continue;
          if (dist2(p.x, p.z, o.x, o.z) <= DATA.MOB.allyR + p.r) { p.hit.add(o.id); this.dealToAlly(o, p.pw, p.stat, p.src, { src: p.srcEnt }); p.life = 0; break; }
        }
      }
      if (Math.abs(p.x) > 40 || p.z < -80 || p.z > 50) p.life = 0;
    }
    this.projs = this.projs.filter(p => p.life > 0);
    // 継続ダメージ
    for (const e of this.enemiesAlive()) {
      if (e.defDown > 0) e.defDown -= dt;
      if (!e.dots || !e.dots.length) continue;
      for (const d of e.dots) { d.left -= dt; d.next -= dt; if (d.next <= 0 && d.left > -0.01) { d.next += 1; const a = this.allies[d.src]; this.dealToEnemy(a, e, d.pw, d.stat, 'dot', null); } }
      e.dots = e.dots.filter(d => d.left > 0);
    }
  }
  blast(a, x, z, r, pw, stat, hk, log) {
    let n = 0;
    for (const e of this.enemiesAlive()) { const h = this.hitCircle(e, x, z, r); if (h) { this.dealToEnemy(a, e, pw, stat, hk, log, h); n++; } }
    if (n) this.spForHit(a, hk, log);
    this.ev('boom', { x, z, r, k: 'fire' });
  }
  placeTrap(a, kind, sk) {
    const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
    this.traps.push({ id: this.id(), kind, owner: a.slot, x: a.x + fx * 0.6, z: a.z + fz * 0.6, t: 0, arm: sk.arm, life: sk.life, sk });
    this.ev('sfx', { s: kind === 'mine' ? 'minePlace' : 'trapPlace', x: a.x, z: a.z });
  }
  updateTraps(dt) {
    for (const tr of this.traps) {
      tr.t += dt; if (tr.t > tr.life) { tr.dead = 1; continue; }
      if (tr.t < tr.arm) continue;
      const sk = tr.sk, a = this.allies[tr.owner];
      if (tr.kind === 'para') {
        for (const e of this.enemiesAlive()) {
          if (this.hitCircle(e, tr.x, tr.z, sk.r)) {
            if (e === this.boss) { if (e.paraImm > 0 || e.st === 'fly' || e.st === 'down') continue; this.bossStun(sk.para * sk.bossMul); e.paraImm = sk.bossImmune; }
            else { e.para = sk.para; }
            this.ev('para', { x: e.x, z: e.z }); tr.dead = 1; break;
          }
        }
      } else if (tr.kind === 'mine') {
        let trig = false;
        for (const e of this.enemiesAlive()) if (this.hitCircle(e, tr.x, tr.z, sk.trig)) trig = true;
        for (const o of this.allies) if (o.st === 'ok' && o.slot !== tr.owner && dist2(tr.x, tr.z, o.x, o.z) <= 0.7) trig = true;
        if (trig) {
          tr.dead = 1; const hitSet = new Set();
          for (const e of this.enemiesAlive()) { const h = !hitSet.has(e.id) && this.hitCircle(e, tr.x, tr.z, sk.r); if (h) { hitSet.add(e.id); this.dealToEnemy(a, e, sk.pw, 'mix', 'skill', null, h); } }
          for (const o of this.allies) if (o.st === 'ok' && dist2(tr.x, tr.z, o.x, o.z) <= sk.r) { // 味方も巻き込む（1爆発につき1回）
            const dx = o.x - tr.x, dz = o.z - tr.z; this.dealToAlly(o, sk.pw * sk.allyMul, 'str', { str: (this.stat(a, 'str') + this.stat(a, 'yo')) / 2, yo: this.stat(a, 'yo') }, { knock: 4, kx: dx, kz: dz, src: 'none' });
          }
          this.ev('boom', { x: tr.x, z: tr.z, r: sk.r, k: 'mine' });
        }
      }
    }
    this.traps = this.traps.filter(t => !t.dead);
  }
  spawnPickup(kind, x, z, item) { const r = this.clampPos(x, z, x, z, 0.3); this.pickups.push({ id: this.id(), kind, x: r[0], z: r[1], item, life: 40 }); }
  updatePickups(dt) {
    for (const pk of this.pickups) {
      pk.life -= dt; if (pk.life <= 0) { pk.dead = 1; continue; }
      for (const o of this.allies) {
        if (o.st !== 'ok' || dist2(o.x, o.z, pk.x, pk.z) > 0.8) continue;
        if (pk.kind === 'food') { if (o.hp >= o.maxHp) continue; this.healAlly(o, Math.round(o.maxHp * DATA.SIM.foodHeal), null); pk.dead = 1; this.ev('sfx', { s: 'eat', x: o.x, z: o.z }); break; }
        if (pk.kind === 'bag') {
          let s = o.items.find(i => i.id === pk.item && i.n < DATA.SIM.itemMax) || o.items.find(i => i.n <= 0);
          if (!s) continue; if (s.id !== pk.item) { s.id = pk.item; s.n = 0; } s.n++; pk.dead = 1; this.ev('pick', { slot: o.slot, it: pk.item, x: o.x, z: o.z }); break;
        }
      }
    }
    this.pickups = this.pickups.filter(p => !p.dead);
  }

  /* ---------- 灯籠 ---------- */
  lightLantern(l, a) {
    l.lit = true; this.ev('lantern', { i: l.i, slot: a.slot, x: l.x, z: l.z });
    if (this.lanternT <= 0) this.lanternT = DATA.SIM.lanternWindow;
    if (this.lanterns.every(q => q.lit)) {
      this.lanternT = 0; this.pendingDown = true; this.ev('allLit', {});
    }
  }
  updateLanterns(dt) {
    if (this.lanternCool > 0) this.lanternCool = Math.max(0, this.lanternCool - dt);
    if (this.lanternT > 0) { this.lanternT -= dt; if (this.lanternT <= 0) { this.lanternT = 0; for (const l of this.lanterns) l.lit = false; this.ev('lanternFail', {}); } }
    const b = this.boss;
    if (this.pendingDown && b && (b.st === 'idle' || b.st === 'walk' || b.st === 'wind' || b.st === 'act' || b.st === 'rec' || b.st === 'stun') && b.y < 0.1) {
      this.pendingDown = false; b.st = 'down'; b.t = 0; b.mv = null; b.downT = DATA.SIM.lanternDown;
      this.hazards = this.hazards.filter(h => h.src !== 'boss' || h.t > h.warn);
      this.ev('bossdown', {});
    }
  }

  /* ---------- 進行 ---------- */
  spawnWave(i) {
    const W = DATA.STAGE.waves[i]; if (!W) return;
    for (const [x, z] of W) this.spawnMob(x, z, true);
    this.wave = i; this.waveSpawned = true;
  }
  updateStage(dt) {
    if (this.stage === 'street') {
      const alive = this.mobs.filter(m => m.st === 'ok').length;
      if (alive === 0) {
        if (this.wave === 0) { this.spawnWave(1); this.ev('stage', { k: 'wave2' }); }
        else if (this.barrier === 'street') { this.barrier = 'none'; this.ev('stage', { k: 'open' }); }
      }
      if (this.barrier === 'none' && this.allies.some(a => a.st === 'ok' && !a.ctrlAI && a.z > 2.5)) this.beginIntro();
    } else if (this.stage === 'intro') {
      if (this.introWait) return;
      if (this.stageT >= DATA.BOSS.introT) { this.stage = 'boss'; this.stageT = 0; this.boss.st = 'idle'; this.boss.gap = 0.8; this.ev('stage', { k: 'fight' }); }
    }
  }
  beginIntro() {
    this.stage = 'intro'; this.stageT = 0; this.barrier = 'plaza';
    const spots = [[-2.4, 3.5], [2.4, 3.5], [-0.8, 2.2], [0.8, 2.2]];
    for (const a of this.allies) { a.x = a.px = spots[a.slot][0]; a.z = a.pz = spots[a.slot][1]; a.yaw = 0; a.act = null; a.rev = null; a.lan = null; if (a.st === 'down') { /* 気絶中の仲間も広場へ */ } }
    this.projs = []; this.traps = []; this.mobs = [];
    this.spawnBoss(false);
    this.ev('stage', { k: 'intro' });
  }
  startIntroNow() { this.introWait = false; this.stageT = 0; }
  finish(win, why) {
    if (this.stage === 'won' || this.stage === 'lost') return;
    this.stage = win ? 'won' : 'lost'; this.stageT = 0; this.result = { win, why, time: DATA.SIM.timeLimit - this.timeLeft };
    this.ev('stage', { k: win ? 'won' : 'lost', why });
  }

  /* ---------- 札小僧 ---------- */
  spawnMob(x, z, street) {
    const m = { id: 'm' + this.id(), x, z, yaw: Math.PI, hp: this.diff.mobHp, maxHp: this.diff.mobHp, str: DATA.MOB.str, yo: DATA.MOB.yo, def: DATA.MOB.def, st: 'ok', fireT: 1 + this.rng.next(), t: 0, para: 0, defDown: 0, dots: [], street, strafe: this.rng.next() < 0.5 ? 1 : -1, wind: 0 };
    this.mobs.push(m); this.ev('spawnMob', { x, z }); return m;
  }
  mobTarget(m) { let best = null, bs = -1; for (const o of this.allies) { if (o.st !== 'ok') continue; const d = dist2(m.x, m.z, o.x, o.z); const s = (o.buffs.stealth > 0 ? 0.2 : 1) * (1 + o.threat / 600) / (1 + d / 6) * (o.buffs.taunt > 0 ? 4 : 1); if (s > bs) { bs = s; best = o; } } return best; }
  updateMob(m, dt) {
    m.t += dt;
    if (m.st === 'dying') { m.dieT -= dt; if (m.dieT <= 0) m.st = 'gone'; return; }
    if (m.st !== 'ok') return;
    if (m.para > 0) { m.para -= dt; return; }
    if (this.stage === 'intro') return;
    const tg = this.mobTarget(m); if (!tg) { m.tgt = -1; return; }
    m.tgt = tg.slot;
    const d = dist2(m.x, m.z, tg.x, tg.z), ty = yawTo(tg.x - m.x, tg.z - m.z);
    m.yaw += clamp(angDiff(m.yaw, ty), -4 * dt, 4 * dt);
    let vx = 0, vz = 0; const fx = Math.sin(ty), fz = Math.cos(ty);
    if (m.wind <= 0) {
      if (d > 8) { vx += fx; vz += fz; } else if (d < 4.5) { vx -= fx; vz -= fz; }
      vx += fz * m.strafe * 0.5; vz += -fx * m.strafe * 0.5;
      if (this.rng.next() < dt * 0.3) m.strafe *= -1;
      const l = Math.hypot(vx, vz); if (l > 0) { const s = DATA.MOB.speed / Math.max(1, l); const r = this.clampPos(m.x, m.z, m.x + vx * s * dt, m.z + vz * s * dt, 0.4); m.x = r[0]; m.z = r[1]; }
    }
    m.fireT -= dt;
    if (m.fireT <= 0.35 && m.wind <= 0 && d < 13) m.wind = 0.35;
    if (m.wind > 0) { m.wind -= dt; if (m.wind <= 0) { m.fireT = DATA.MOB.shotPeriod; this.mobFire(m, tg); } }
  }
  mobFire(m, tg) {
    const yaw = yawTo(tg.x - m.x, tg.z - m.z), fx = Math.sin(yaw), fz = Math.cos(yaw), s = DATA.MOB.shotSpeed;
    this.projs.push({ id: this.id(), kind: 'fuda', team: 'enemy', x: m.x + fx * 0.5, y: 0.55, z: m.z + fz * 0.5, vx: fx * s, vz: fz * s, life: 1.7, r: DATA.MOB.shotR, pw: DATA.MOB.shotPw, stat: 'str', src: { str: m.str, yo: m.yo }, srcEnt: m, hit: new Set(), yaw });
    this.ev('sfx', { s: 'fudaShot', x: m.x, z: m.z });
  }
  mobDie(m, by) {
    m.st = 'dying'; m.dieT = 0.6; this.ev('mobdie', { x: m.x, z: m.z });
    if (this.rng.next() < 0.4) this.spawnPickup('bag', m.x, m.z, DATA.ITEM_IDS[(this.rng.next() * DATA.ITEM_IDS.length) | 0]);
  }

  /* ---------- ボス ---------- */
  spawnBoss(test) {
    const [x, z] = DATA.STAGE.bossSpawn, d = this.diff;
    this.boss = { id: 'boss', x, z, y: 0, yaw: Math.PI, hp: d.hp, maxHp: d.hp, str: d.str, yo: d.yo, def: d.def, st: test ? 'idle' : 'intro', mv: null, t: 0, gap: 1, phase: 1, cds: {}, last: null, target: 0, defDown: 0, paraImm: 0, dots: [], walkT: 0, noCand: 0, fl: null, downT: 0, stunT: 0 };
    if (test) this.boss.testIdle = true;
  }
  bossStun(t) { const b = this.boss; if (b.st === 'fly' || b.st === 'dead' || b.st === 'down') return; b.st = 'stun'; b.stunT = t; b.t = 0; b.mv = null; this.hazards = this.hazards.filter(h => h.src !== 'boss' || h.t > h.warn); }
  bossDie() {
    const b = this.boss; if (b.st === 'dead') return;
    b.st = 'dead'; b.t = 0; b.mv = null; b.y = 0; this.hazards = []; this.projs = this.projs.filter(p => p.team === 'ally');
    for (const m of this.mobs) if (m.st === 'ok') { m.st = 'dying'; m.dieT = 0.6; }
    this.ev('bossdie', { x: b.x, z: b.z });
    this.finish(true, 'boss');
  }
  pickTarget() {
    const b = this.boss; let best = null, bs = -1;
    for (const o of this.allies) {
      if (o.st !== 'ok') continue;
      const d = dist2(b.x, b.z, o.x, o.z);
      let s = (40 + o.threat) / (1 + d / 10);
      if (o.buffs.stealth > 0) s *= 0.1; if (o.buffs.taunt > 0) s *= 6; if (o.act && o.act.k === 'guard') s *= 1.4;
      s *= 0.85 + this.rng.next() * 0.3;
      if (s > bs) { bs = s; best = o; }
    }
    return best;
  }
  hz(o) { const h = Object.assign({ id: this.id(), t: 0, hits: {}, src: 'boss', max: 1, iv: 99, act: 0.12 }, o); this.hazards.push(h); return h; }
  updateBoss(dt) {
    const b = this.boss, M = DATA.BMOVES;
    b.t += dt;
    for (const k in b.cds) if (b.cds[k] > 0) b.cds[k] -= dt;
    if (b.paraImm > 0) b.paraImm -= dt;
    if (b.st === 'dead' || b.st === 'intro' || b.testIdle) return;
    if (b.phase === 1 && b.hp <= b.maxHp * DATA.BOSS.phase2) { b.phase = 2; b.cds.junkou = 0; b.forceJunkou = true; this.ev('phase2', {}); }
    const tg = this.allies[b.target];
    switch (b.st) {
      case 'down': if (b.t >= b.downT) { b.st = 'idle'; b.gap = 0.6; b.t = 0; for (const l of this.lanterns) l.lit = false; this.lanternCool = DATA.SIM.lanternRearm; this.ev('bossup', {}); } return;
      case 'stun': if (b.t >= b.stunT) { b.st = 'idle'; b.gap = 0.4; b.t = 0; } return;
      case 'idle': case 'walk': {
        const t = this.pickTarget(); if (!t) return;
        b.target = t.slot;
        const ty = yawTo(t.x - b.x, t.z - b.z), d = dist2(b.x, b.z, t.x, t.z);
        b.yaw += clamp(angDiff(b.yaw, ty), -DATA.BOSS.turn * dt, DATA.BOSS.turn * dt);
        b.st = 'idle';
        if (d > 5) { const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); this.bossMove(fx * DATA.BOSS.walk * dt, fz * DATA.BOSS.walk * dt); b.st = 'walk'; }
        b.gap -= dt;
        if (b.gap <= 0) { if (!this.bossChoose(t)) { b.gap = 0.25; b.noCand += 0.25; } }
        return;
      }
      case 'wind': case 'act': case 'rec': this.bossMoveTick(b, dt); return;
      case 'fly': this.bossFlyTick(b, dt); return;
    }
  }
  bossMove(dx, dz) {
    const b = this.boss, ST = DATA.STAGE;
    b.x = clamp(b.x + dx, -ST.plazaHalfW + 3, ST.plazaHalfW - 3); b.z = clamp(b.z + dz, 4, ST.plazaZ1 - 3);
    for (const a of this.allies) { if (a.st === 'gone') continue; const r = this.clampPos(a.x, a.z, a.x, a.z, 0.35); a.x = r[0]; a.z = r[1]; }
  }
  bossChoose(t) {
    const b = this.boss, M = DATA.BMOVES;
    const rel = a => { const d = dist2(b.x, b.z, a.x, a.z), ang = Math.abs(angDiff(b.yaw, yawTo(a.x - b.x, a.z - b.z))); return { d, ang }; };
    const r = rel(t), ok = k => !(b.cds[k] > 0);
    const behind = this.allies.some(o => { if (o.st !== 'ok') return false; const q = rel(o); return q.ang > 2.0 && q.d < M.shime.r; });
    const c = [];
    if (b.forceJunkou) { this.bossStart('junkou', t); b.forceJunkou = false; return true; }
    if (ok('harite') && r.ang < 0.6 && r.d < 5.4) c.push(['harite', 3]);
    if (ok('fubuki') && r.ang < 1.0 && r.d < 10) c.push(['fubuki', 2.5]);
    if (ok('kousen') && r.ang < 0.4 && r.d > 3 && r.d < 22) c.push(['kousen', 2.2]);
    if (ok('shime') && behind) c.push(['shime', 3.5]);
    if (ok('otoshi')) c.push(['otoshi', 1.2 + (r.d > 8 ? 1 : 0) + (b.noCand > 1.5 ? 4 : 0)]);
    if (ok('junkou') && this.stageT > 15) c.push(['junkou', b.phase === 2 ? 3 : 1.0]);
    if (ok('zouen') && this.mobs.filter(m => m.st === 'ok').length < M.zouen.max) c.push(['zouen', 1.0]);
    if (!c.length) return false;
    for (const e of c) if (e[0] === b.last) e[1] *= 0.3;
    let sum = 0; for (const e of c) sum += e[1];
    let x = this.rng.next() * sum, pick = c[0][0];
    for (const e of c) { x -= e[1]; if (x <= 0) { pick = e[0]; break; } }
    this.bossStart(pick, t); b.noCand = 0; return true;
  }
  bossStart(k, t) {
    const b = this.boss, M = DATA.BMOVES[k];
    b.mv = k; b.t = 0; b.st = 'wind'; b.last = k; b.cds[k] = M.cd; b.hit = {};
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    this.ev('bossmove', { mv: k });
    switch (k) {
      case 'fubuki':
        for (const s of [-1, 1]) this.hz({ kind: 'fan', x: b.x, z: b.z, yaw: b.yaw + s * M.fanYaw, r0: 1.0, r1: M.r, half: M.fanHalf, warn: M.wind, act: M.act, iv: M.iv, max: M.max, pw: M.pw, stat: M.stat, fx: 'fubuki' });
        break;
      case 'shime': this.hz({ kind: 'fan', x: b.x, z: b.z, yaw: b.yaw + Math.PI, r0: 0, r1: M.r, half: M.half, warn: M.wind, act: M.act, iv: M.iv, max: M.max, pw: M.pw, stat: M.stat, fx: 'shime' }); break;
      case 'otoshi':
        for (const o of this.allies) if (o.st === 'ok') this.hz({ kind: 'circle', x: o.x, z: o.z, yaw: 0, r: M.r, warn: M.wind, act: M.act, pw: M.pw, stat: M.stat, fx: 'otoshi', knock: 3 });
        break;
      case 'kousen': this.hz({ kind: 'line', x: b.x + fx * 1.2, z: b.z + fz * 1.2, yaw: b.yaw, len: M.len, w: M.w, warn: M.wind, act: M.act, iv: M.iv, max: M.max, pw: M.pw, stat: M.stat, fx: 'kousen' }); break;
      case 'harite': this.hz({ kind: 'rect', x: b.x + fx * M.start, z: b.z + fz * M.start, yaw: b.yaw, len: M.len, w: M.w, warn: M.wind, act: M.act, pw: M.pw, stat: M.stat, fx: 'harite', brief: 0.22, knock: 5 }); break;
      case 'junkou': {
        const n = b.phase === 2 ? M.n2 : M.n1;
        b.st = 'fly'; b.fl = { ph: 'rise', t: 0, n, i: 0, bombT: 0, sx: b.x, sz: b.z, sy: b.yaw, used: [] };
        this.junkouNext(b.fl, b.x, b.z, M.wind);
        this.ev('unlock', {});
        break;
      }
      case 'zouen': break;
    }
  }
  /** 大巡行の飛ぶ範囲（広場の外周。入口のゲート側だけは広場の中の手前まで） */
  junkouBox() { const ST = DATA.STAGE, M = DATA.BMOVES.junkou; return { X: ST.plazaHalfW + M.outer, Z0: M.frontZ, Z1: ST.plazaZ1 + M.outer }; }
  /** 点(px,pz)を向きyawで通る直線が飛ぶ範囲を横切る区間 */
  junkouChord(px, pz, yaw) {
    const B = this.junkouBox(), fx = Math.sin(yaw), fz = Math.cos(yaw);
    let t0 = -1e9, t1 = 1e9;
    if (Math.abs(fx) > 1e-6) { const a = (-B.X - px) / fx, c = (B.X - px) / fx; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
    if (Math.abs(fz) > 1e-6) { const a = (B.Z0 - pz) / fz, c = (B.Z1 - pz) / fz; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
    return { x0: px + fx * t0, z0: pz + fz * t0, x1: px + fx * t1, z1: pz + fz * t1, len: t1 - t0 };
  }
  /** 外周を一周する長さの上での位置（横断の合間に外周に沿って回り込むため） */
  junkouPerim(x, z) {
    const B = this.junkouBox(), w = 2 * B.X, h = B.Z1 - B.Z0;
    const d = [Math.abs(z - B.Z0), Math.abs(x - B.X), Math.abs(z - B.Z1), Math.abs(x + B.X)], e = d.indexOf(Math.min(...d));
    return e === 0 ? clamp(x + B.X, 0, w) : e === 1 ? w + clamp(z - B.Z0, 0, h) : e === 2 ? w + h + clamp(B.X - x, 0, w) : 2 * w + h + clamp(B.Z1 - z, 0, h);
  }
  junkouAt(s) {
    const B = this.junkouBox(), w = 2 * B.X, h = B.Z1 - B.Z0, P = 2 * (w + h); s = ((s % P) + P) % P;
    if (s < w) return [s - B.X, B.Z0]; s -= w; if (s < h) return [B.X, B.Z0 + s]; s -= h; if (s < w) return [B.X - s, B.Z1]; s -= w; return [-B.X, B.Z1 - s];
  }
  /** 次の横断を決める：狙った味方を通る線を、前回と違う向き（横・斜め・縦…）から選ぶ */
  junkouNext(f, fromX, fromZ, minWarn) {
    const M = DATA.BMOVES.junkou, ST = DATA.STAGE, hw = ST.plazaHalfW;
    const t = this.pickTarget() || this.allies[0];
    const px = clamp(t.x, -hw + 2.5, hw - 2.5), pz = clamp(t.z, 2.5, ST.plazaZ1 - 2.5);
    const onRim = f.ph !== 'rise';
    const B = this.junkouBox(), P = 2 * (2 * B.X + B.Z1 - B.Z0), s0 = onRim ? this.junkouPerim(fromX, fromZ) : 0;
    const cands = []; let sum = 0;
    for (let k = 0; k < 12; k++) {
      const ori = k / 12 * Math.PI + (this.rng.next() - 0.5) * 0.18; // 線の向き（0〜180度）
      if (f.used.some(u => Math.abs(angN(2 * (ori - u))) / 2 < M.minTurn)) continue;
      const c = this.junkouChord(px, pz, ori); if (c.len < M.minLen) continue;
      for (const dir of [0, 1]) {
        const sx = dir ? c.x1 : c.x0, sz = dir ? c.z1 : c.z0, ex = dir ? c.x0 : c.x1, ez = dir ? c.z0 : c.z1;
        let travel, ds = 0;
        if (onRim) { ds = this.junkouPerim(sx, sz) - s0; ds = ((ds % P) + P) % P; if (ds > P / 2) ds -= P; travel = Math.abs(ds); } else travel = dist2(fromX, fromZ, sx, sz);
        const w = 1 / (1 + Math.pow(travel / 9, 2));
        cands.push({ sx, sz, ex, ez, ori, yaw: yawTo(ex - sx, ez - sz), len: c.len, ds, travel, w }); sum += w;
      }
    }
    let pick = cands[0];
    if (!pick) { const c = this.junkouChord(px, pz, Math.PI / 2), r = fromX > 0; pick = { sx: r ? c.x1 : c.x0, sz: r ? c.z1 : c.z0, ex: r ? c.x0 : c.x1, ez: r ? c.z0 : c.z1, ori: Math.PI / 2, len: c.len, ds: 0, travel: 0 }; pick.yaw = yawTo(pick.ex - pick.sx, pick.ez - pick.sz); }
    else { let r = this.rng.next() * sum; for (const c of cands) { r -= c.w; if (r <= 0) { pick = c; break; } } }
    f.used.push(pick.ori); if (f.used.length > 2) f.used.shift();
    Object.assign(f, { sx0: pick.sx, sz0: pick.sz, ex: pick.ex, ez: pick.ez, yaw: pick.yaw, len: pick.len, crossT: pick.len / M.speed, gx: fromX, gz: fromZ, gs: s0, gds: pick.ds, onRim });
    f.gapT = Math.max(minWarn, pick.travel / M.rimSpeed);
    f.pathH = this.hz({ kind: 'path', x: pick.sx, z: pick.sz, yaw: pick.yaw, len: pick.len, w: M.contactR * 2, warn: f.gapT, keep: f.crossT, act: 0, pw: 0, stat: 'str', fx: 'junkou', display: 1 });
  }
  bossMoveTick(b, dt) {
    const M = DATA.BMOVES[b.mv], t = b.t;
    const actT = M.act || (b.mv === 'zouen' ? 0.05 : 0.12);
    if (b.st === 'wind' && t >= M.wind) {
      b.st = 'act'; b.t = 0;
      if (b.mv === 'zouen') { for (const s of [-1, 1]) { const m = this.spawnMob(b.x + Math.cos(b.yaw) * 3 * s, b.z - Math.sin(b.yaw) * 3 * s, false); m.fireT = 1.2; } }
      this.ev('bossfire', { mv: b.mv });
    } else if (b.st === 'act' && t >= actT) { b.st = 'rec'; b.t = 0; }
    else if (b.st === 'rec' && t >= M.rec) { b.st = 'idle'; b.mv = null; b.t = 0; b.gap = DATA.BOSS.gapMin + this.rng.next() * (DATA.BOSS.gapMax - DATA.BOSS.gapMin); }
  }
  bossFlyTick(b, dt) {
    const M = DATA.BMOVES.junkou, f = b.fl, ST = DATA.STAGE, hw = ST.plazaHalfW; f.t += dt;
    const turnTo = (yaw, k) => { b.yaw += angDiff(b.yaw, yaw) * Math.min(1, k); };
    if (f.ph === 'rise') {
      const k = Math.min(1, f.t / f.gapT), e = k * k * (3 - 2 * k);
      b.y = Math.min(2.6, f.t / M.wind * 2.6);
      b.x = f.sx + (f.sx0 - f.sx) * e; b.z = f.sz + (f.sz0 - f.sz) * e; turnTo(f.yaw, dt * 5);
      if (f.t >= f.gapT) { f.ph = 'cross'; f.t = 0; f.hit = {}; b.x = f.sx0; b.z = f.sz0; b.y = 2.6; b.yaw = f.yaw; this.ev('cross', { i: f.i }); }
    } else if (f.ph === 'cross') {
      const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw), d = Math.min(f.len, f.t * M.speed);
      b.x = f.sx0 + fx * d; b.z = f.sz0 + fz * d; b.y = 2.6; b.yaw = f.yaw;
      for (const o of this.allies) {
        if (o.st !== 'ok' || f.hit[o.slot]) continue;
        const dx = o.x - b.x, dz = o.z - b.z, along = dx * fx + dz * fz, side = dx * fz - dz * fx;
        if (Math.abs(side) <= M.contactR + DATA.MOB.allyR && Math.abs(along) <= M.contactLen + DATA.MOB.allyR) { f.hit[o.slot] = 1; const sg = side >= 0 ? 1 : -1; this.dealToAlly(o, M.pw, 'str', b, { knock: 6, kx: fz * sg, kz: -fx * sg, src: b }); }
      }
      f.bombT -= dt;
      if (f.bombT <= 0 && Math.abs(b.x) < hw - 0.5 && b.z > 0.5 && b.z < ST.plazaZ1 - 0.5) {
        f.bombT = M.bombEvery; const off = (this.rng.next() * 2 - 1) * M.bombSpread;
        this.hz({ kind: 'circle', x: clamp(b.x + fz * off, -hw + 1.5, hw - 1.5), z: clamp(b.z - fx * off, 1.5, ST.plazaZ1 - 1.5), yaw: 0, r: M.bombR, warn: M.bombFall, act: 0.12, pw: M.bombPw, stat: 'yo', fx: 'bomb', knock: 3 });
      }
      if (d >= f.len) {
        f.i++;
        if (f.i >= f.n) {
          f.ph = 'land'; f.t = 0; f.ox = b.x; f.oz = b.z;
          const cz = ST.plazaZ1 / 2; f.lx = clamp(b.x * 0.45, -hw + 3.5, hw - 3.5); f.lz = clamp(cz + (b.z - cz) * 0.45, 5, ST.plazaZ1 - 4);
          this.hz({ kind: 'circle', x: f.lx, z: f.lz, yaw: 0, r: M.landR, warn: 0.6, act: 0.12, pw: 70, stat: 'str', fx: 'land', knock: 5 });
        } else { f.ph = 'gap'; f.t = 0; this.junkouNext(f, b.x, b.z, M.gap); }
      }
    } else if (f.ph === 'gap') {
      // 外周に沿って次の入り口へ回り込む
      const k = Math.min(1, f.t / f.gapT), e = k * k * (3 - 2 * k);
      const [x, z] = this.junkouAt(f.gs + f.gds * e); b.x = x; b.z = z; b.y = 2.6;
      if (k < 0.75) { const [x2, z2] = this.junkouAt(f.gs + f.gds * Math.min(1, e + 0.05)); if (Math.hypot(x2 - x, z2 - z) > 0.01) turnTo(yawTo(x2 - x, z2 - z), dt * 8); } else turnTo(f.yaw, dt * 8);
      if (f.t >= f.gapT) { f.ph = 'cross'; f.t = 0; f.hit = {}; b.x = f.sx0; b.z = f.sz0; b.yaw = f.yaw; this.ev('cross', { i: f.i }); }
    } else if (f.ph === 'land') {
      const k = Math.min(1, f.t / 0.6);
      b.x = f.ox + (f.lx - f.ox) * k; b.z = f.oz + (f.lz - f.oz) * k; b.y = 2.6 * (1 - k * k);
      const t = this.allies[b.target], want = t && t.st === 'ok' ? yawTo(t.x - b.x, t.z - b.z) : Math.PI;
      b.yaw += clamp(angDiff(b.yaw, want), -4 * dt, 4 * dt);
      if (f.t >= 0.6) { b.y = 0; b.st = 'rec'; b.t = 0; b.fl = null; this.ev('land', { x: b.x, z: b.z }); for (const a of this.allies) { const r = this.clampPos(a.x, a.z, a.x, a.z, 0.35); a.x = r[0]; a.z = r[1]; } }
    }
  }
  updateHazards(dt) {
    for (const h of this.hazards) {
      h.t += dt;
      if (h.act <= 0) { if (h.t >= h.warn + (h.keep || 0)) h.dead = 1; continue; }
      if (h.t < h.warn || h.t > h.warn + h.act) { if (h.t > h.warn + h.act + 0.05) h.dead = 1; continue; }
      if (h.t - dt < h.warn) this.ev('hzfire', { fx: h.fx, x: h.x, z: h.z, yaw: h.yaw, r: h.r || 0 });
      const b = this.boss, srcStats = h.src === 'boss' ? b : h.srcStats;
      for (const o of this.allies) {
        if (o.st !== 'ok') continue;
        const rec = h.hits[o.slot];
        if (rec && (rec.n >= h.max || h.t - rec.last < h.iv - 1e-6)) continue;
        let inside = false;
        if (h.kind === 'fan') inside = inFan(o.x, o.z, h.x, h.z, h.yaw, h.r0, h.r1, h.half, DATA.MOB.allyR);
        else if (h.kind === 'circle') inside = dist2(o.x, o.z, h.x, h.z) <= h.r + DATA.MOB.allyR;
        else if (h.kind === 'line' || h.kind === 'rect') inside = inLine(o.x, o.z, h.x, h.z, h.yaw, h.len, h.w / 2, DATA.MOB.allyR);
        if (!inside) continue;
        h.hits[o.slot] = { n: (rec ? rec.n : 0) + 1, last: h.t };
        this.dealToAlly(o, h.pw, h.stat, srcStats, { knock: h.knock || 0, kx: o.x - h.x, kz: o.z - h.z, src: h.src === 'boss' ? b : null });
      }
    }
    this.hazards = this.hazards.filter(h => !h.dead);
  }

  /* ---------- 味方AI（ホストだけが動かす） ---------- */
  aiInput(a, inp) {
    const ai = a.ai, t = this.t, out = inp || Sim.emptyInput();
    out.ev = out.ev || []; if (out.ev.length > 20) out.ev = out.ev.slice(-10);
    const push = code => { ai.evId = Math.max(ai.evId || 0, a.lastEv) + 1; out.ev.push([ai.evId, code]); };
    out.hold = out.hold || { A: 0, X: 0, Y: 0, B: 0 };
    if (a.st !== 'ok' || this.stage === 'intro' || this.stage === 'won' || this.stage === 'lost') { out.mx = out.mz = 0; out.hold.B = 0; out.hold.X = out.hold.Y = 0; return out; }
    // ため・ガードの継続
    if (ai.hold) {
      ai.hold.t -= this.dt;
      if (ai.hold.t <= 0) { out.hold[ai.hold.k] = 0; push(ai.hold.k + '-'); ai.hold = null; }
    }
    if (t >= ai.next) { ai.next = t + 0.2 + this.rng.next() * 0.12; this.aiDecide(a, out, push); }
    const dx = ai.tx - a.x, dz = ai.tz - a.z, d = Math.hypot(dx, dz);
    if (d > 0.35 && !ai.stay) { out.mx = dx / d; out.mz = dz / d; } else { out.mx = 0; out.mz = 0; }
    out.hold.B = ai.holdB ? 1 : 0;
    if (ai.wantA && t >= ai.comboT) { ai.comboT = t + 0.26; push('A'); }
    return out;
  }
  inDanger(x, z, margin, horizon) {
    for (const h of this.hazards) {
      if (h.src !== 'boss' || h.act <= 0 && h.kind !== 'path') continue;
      const until = h.warn - h.t; if (until > horizon && h.kind !== 'path') continue;
      if (h.t > h.warn + h.act) continue;
      let inside = false;
      if (h.kind === 'fan') inside = inFan(x, z, h.x, h.z, h.yaw, h.r0, h.r1, h.half, margin);
      else if (h.kind === 'circle') inside = dist2(x, z, h.x, h.z) <= h.r + margin;
      else inside = inLine(x, z, h.x, h.z, h.yaw, h.len, h.w / 2, margin);
      if (inside) return h;
    }
    const b = this.boss;
    if (b && b.st === 'fly' && b.fl && b.fl.ph !== 'land' && b.fl.len) { const f = b.fl; if (inLine(x, z, f.sx0, f.sz0, f.yaw, f.len, DATA.BMOVES.junkou.contactR, margin)) return { kind: 'path', warn: 0, t: 0, x: f.sx0, z: f.sz0, yaw: f.yaw, len: f.len, w: DATA.BMOVES.junkou.contactR * 2 }; }
    return null;
  }
  aiDecide(a, out, push) {
    const ai = a.ai, b = this.boss, role = a.c.ai;
    ai.stay = false; ai.wantA = false; ai.holdB = false;
    out.healT = null;
    // 1) 危険範囲から逃げる（反応に少し遅れを持たせる）
    const danger = this.inDanger(a.x, a.z, 0.5, 1.2);
    if (danger && (danger.t >= ai.react || danger.kind === 'path')) {
      ai.react = 0.18 + this.rng.next() * 0.3;
      if (role === 'tank' && danger.kind !== 'circle' && danger.kind !== 'path' && !ai.hold) {
        for (const k of ['Y', 'X']) { const sk = DATA.SKILLS[a.slots[k]]; if (sk.kind === 'guard' && !a.gLock[k] && a.g[k] > 0.3) { push(k + '+'); out.hold[k] = 1; ai.hold = { k, t: Math.min(1.6, (danger.warn - danger.t) + (danger.act || 0.6) + 0.1) }; ai.stay = true; ai.tx = a.x; ai.tz = a.z; return; } }
      }
      const esc = this.aiEscape(a);
      if (esc) {
        ai.tx = esc[0]; ai.tz = esc[1];
        const until = danger.warn - danger.t;
        if (until < 0.3 && this.rng.next() < 0.6) for (const k of ['Y', 'X']) { const sk = DATA.SKILLS[a.slots[k]]; if (sk.kind === 'dodge' && a.cd[k] <= 0) { out.mx = esc[0] - a.x; out.mz = esc[1] - a.z; const l = Math.hypot(out.mx, out.mz) || 1; out.mx /= l; out.mz /= l; push(k + '+'); break; } }
      }
      return;
    }
    if (ai.hold) { ai.stay = ai.hold.stay !== false; return; }
    // 2) 気絶した仲間の救助
    const down = this.allies.filter(o => o.st === 'down');
    if (down.length) {
      const tgt = down.sort((p, q) => dist2(a.x, a.z, p.x, p.z) - dist2(a.x, a.z, q.x, q.z))[0];
      const helpers = this.allies.filter(o => o.st === 'ok' && o.ctrlAI && o !== tgt);
      const closest = helpers.sort((p, q) => dist2(p.x, p.z, tgt.x, tgt.z) - dist2(q.x, q.z, tgt.x, tgt.z))[0];
      if (role === 'healer' || closest === a) {
        if (!this.inDanger(tgt.x, tgt.z, 0.5, 1.5)) {
          const d = dist2(a.x, a.z, tgt.x, tgt.z);
          if (d < DATA.SIM.reviveRange - 0.3) { ai.stay = true; ai.holdB = true; if (!a.rev) push('B+'); ai.tx = a.x; ai.tz = a.z; return; }
          ai.tx = tgt.x; ai.tz = tgt.z; return;
        }
      }
    }
    // 3) 回復
    if (role === 'healer') {
      const low = this.allies.filter(o => o.st === 'ok' && o.hp / o.maxHp < 0.6).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp);
      if (low.length) {
        for (const k of ['X', 'Y']) {
          const sk = DATA.SKILLS[a.slots[k]];
          if (a.cd[k] > 0 || !this.free(a)) continue;
          if (sk.kind === 'heal' || (sk.kind === 'healRing' && low.filter(o => dist2(a.x, a.z, o.x, o.z) < sk.r1).length >= 2)) {
            push(k + '+'); out.hold[k] = 1; ai.hold = { k, t: 0.5 + this.rng.next() * 0.8, stay: false }; out.healT = low[0].slot; ai.tx = (a.x + low[0].x) / 2; ai.tz = (a.z + low[0].z) / 2; return;
          }
        }
      }
    }
    // 4) 必殺
    if (a.sp >= 100 && this.free(a)) {
      const tgtE = this.aiEnemy(a);
      const bossOpen = b && (b.st === 'down' || b.st === 'stun' || b.st === 'rec');
      const S = DATA.SPECIALS[a.c.sp];
      let use = false;
      if (S.type === 'heal') use = this.allies.some(o => o.st === 'down') || this.allies.filter(o => o.st === 'ok' && o.hp / o.maxHp < 0.5).length >= 2;
      else if (S.type === 'buff') use = bossOpen || this.allies.filter(o => o.st === 'ok' && dist2(a.x, a.z, o.x, o.z) < S.r).length >= 3;
      else if (S.type === 'guardup') use = b && b.st !== 'fly' && b.target !== a.slot;
      else if (tgtE) { const reach = S.shape === 'line' ? S.len : S.range; use = this.gapTo(a.x, a.z, tgtE).g < reach * 0.8 && (bossOpen || this.rng.next() < 0.35 || tgtE !== b); }
      if (use) { if (tgtE) out.lock = tgtE.id; push('SP'); return; }
    }
    // 5) 灯籠
    if (this.lanternOrder > this.t && this.stage === 'boss' && this.lanternCool <= 0 && b && b.st !== 'down') {
      const unlit = this.lanterns.filter(l => !l.lit);
      const ais = this.allies.filter(o => o.st === 'ok' && o.ai && o.ctrlAI);
      const idx = ais.indexOf(a);
      if (unlit.length && idx >= 0) {
        const l = unlit.sort((p, q) => dist2(a.x, a.z, p.x, p.z) - dist2(a.x, a.z, q.x, q.z))[Math.min(idx, unlit.length - 1) % unlit.length];
        if (dist2(a.x, a.z, l.x, l.z) < 1.5) { ai.stay = true; ai.holdB = true; if (!a.lan) push('B+'); return; }
        ai.tx = l.x; ai.tz = l.z; return;
      }
    }
    // 6) 戦う
    const e = this.aiEnemy(a);
    if (!e) { // 敵がいないときは人の操作するキャラについて行く
      const lead = this.allies.find(o => o.st === 'ok' && !o.ctrlAI) || this.allies.find(o => o.st === 'ok');
      if (!lead || lead === a) { ai.tx = a.x; ai.tz = a.z; return; }
      const fx = Math.sin(lead.yaw), fz = Math.cos(lead.yaw), side = [-1.6, 1.6, -0.9, 0.9][a.slot];
      ai.tx = lead.x - fx * 1.8 + fz * side; ai.tz = lead.z - fz * 1.8 - fx * side;
      if (dist2(a.x, a.z, ai.tx, ai.tz) < 1.2) ai.stay = true;
      return;
    }
    out.lock = e.id;
    const isBoss = e === b, d = dist2(a.x, a.z, e.x, e.z), gap = this.gapTo(a.x, a.z, e).g;
    const bf = isBoss ? Math.abs(angDiff(b.yaw, yawTo(a.x - b.x, a.z - b.z))) : 0;
    if (role === 'ranged' || (role === 'mage' && a.c.id === 'akaneten') || (role === 'tank' && a.c.A === 'shot')) {
      const want = role === 'tank' ? 5.5 : 8;
      let ang = isBoss ? b.yaw + (a.slot % 2 ? 0.9 : -0.9) : yawTo(a.x - e.x, a.z - e.z);
      if (role === 'tank' && isBoss) ang = b.yaw + (a.slot % 2 ? 0.25 : -0.25);
      const px = e.x + Math.sin(ang) * want, pz = e.z + Math.cos(ang) * want;
      const p = this.clampPos(a.x, a.z, px, pz, 0.4); ai.tx = p[0]; ai.tz = p[1];
      if (d < want + 4) { if (Math.abs(d - want) < 2.5) ai.stay = true; this.aiSkills(a, out, push, e, gap); if (this.free(a) || (a.act && a.act.k === 'shot')) ai.wantA = true; }
      return;
    }
    // 近接・タンク・回復の近接
    let ang;
    if (isBoss) {
      if (role === 'tank') ang = b.yaw + (a.slot % 2 ? 0.3 : -0.3);
      else if (role === 'healer') ang = b.yaw + (a.slot % 2 ? 2.2 : -2.2);
      else ang = b.yaw + (a.slot % 2 ? 1.75 : -1.75) + (this.rng.next() - 0.5) * 0.3;
    } else ang = yawTo(a.x - e.x, a.z - e.z);
    const reach = isBoss ? (role === 'healer' ? 5 : 1.5) : 0.8; // 体に触れる距離まで寄る
    const p = this.clampPos(a.x, a.z, e.x + Math.sin(ang) * reach, e.z + Math.cos(ang) * reach, 0.4);
    ai.tx = p[0]; ai.tz = p[1];
    const inReach = gap < DATA.MOVES.melee1.range - 0.3; // 当たる距離（体に触れている）になってから振る
    if (inReach) { ai.stay = role !== 'healer'; ai.wantA = role !== 'healer' || this.rng.next() < 0.5; this.aiSkills(a, out, push, e, gap); }
    else if (role === 'healer' && gap < 6) this.aiSkills(a, out, push, e, gap);
  }
  aiEnemy(a) {
    const mobs = this.mobs.filter(m => m.st === 'ok');
    if (mobs.length) { const m = mobs.sort((p, q) => dist2(a.x, a.z, p.x, p.z) - dist2(a.x, a.z, q.x, q.z))[0]; if (!this.bossHittable() || a.c.ai === 'melee' || a.c.ai === 'ranged' || dist2(a.x, a.z, m.x, m.z) < 8) return m; }
    return this.bossHittable() ? this.boss : null;
  }
  aiSkills(a, out, push, e, gap) {
    if (!this.free(a)) return;
    const b = this.boss;
    for (const k of ['X', 'Y']) {
      const sk = DATA.SKILLS[a.slots[k]];
      if (sk.kind === 'guard' || sk.kind === 'dodge' || sk.kind === 'heal' || sk.kind === 'healRing') continue;
      if (a.cd[k] > 0 || this.rng.next() < 0.45) continue;
      switch (sk.kind) {
        case 'charge': if (sk.form === 'melee' ? gap < 1.05 : sk.form === 'drain' ? gap < 2.4 : gap < 12) { push(k + '+'); out.hold[k] = 1; a.ai.hold = { k, t: 0.5 + this.rng.next() * 0.5, stay: true }; return; } break;
        case 'dot': if (gap < 12) { push(k + '+'); return; } break;
        case 'retreat': case 'heavy': case 'taunt': if (gap < 1.0) { if (sk.kind === 'heavy' && b && e === b && b.st !== 'down' && b.st !== 'stun' && b.st !== 'rec' && this.rng.next() < 0.6) break; push(k + '+'); return; } break;
        case 'stealth': if (b && b.target === a.slot) { push(k + '+'); return; } break;
        case 'parry': if (b && e === b && b.st === 'wind' && b.target === a.slot && gap < 3) { push(k + '+'); return; } break;
        case 'trap': case 'mine': if (gap < 1.4) { push(k + '+'); return; } break;
        case 'protect': if (this.allies.filter(o => o.st === 'ok' && dist2(a.x, a.z, o.x, o.z) < 3).length >= 2 && this.inDanger(a.x, a.z, 1, 0.6)) { push(k + '+'); return; } break;
      }
    }
  }
  aiEscape(a) {
    let best = null, bs = 1e9;
    const b = this.boss;
    for (const r of [2.6, 4.2, 6.5]) for (let i = 0; i < 12; i++) {
      const ang = i / 12 * TAU, x = a.x + Math.sin(ang) * r, z = a.z + Math.cos(ang) * r;
      const c = this.clampPos(a.x, a.z, x, z, 0.4);
      if (Math.abs(c[0] - x) > 0.05 || Math.abs(c[1] - z) > 0.05) continue;
      if (this.inDanger(x, z, 0.7, 2.0)) continue;
      let s = r;
      if (b && b.st !== 'fly') { const front = Math.abs(angDiff(b.yaw, yawTo(x - b.x, z - b.z))); if (front < 0.8) s += 3; }
      if (s < bs) { bs = s; best = [x, z]; }
    }
    return best;
  }
}
const SIMLIB = { Sim, bossParts, contactPt, ACTS, ACT_I, BST, BST_I, BMV, BMV_I, HZ, HZ_I, PJ, PJ_I, angDiff, yawTo, clamp, dist2, inFan, inLine, RNG };
