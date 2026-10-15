/* =====================================================================
   proto.js — スナップショットの符号化/復元（three.js・DOM 非依存）
   ホストは sim から作り、ソロ/ホスト/参加者の描画は必ず復元結果だけを使う。
   HPは割合（0〜1000）だけを送り、実数は送らない。
   ===================================================================== */
const PROTO = (() => {
  const { ACT_I, ACTS, BST_I, BST, BMV_I, BMV, HZ_I, HZ, PJ_I, PJ } = SIMLIB;
  const CH_IDS = DATA.CHARS.map(c => c.id), CH_I = Object.fromEntries(CH_IDS.map((k, i) => [k, i]));
  const SK_IDS = Object.keys(DATA.SKILLS), SK_I = Object.fromEntries(SK_IDS.map((k, i) => [k, i]));
  const IT_I = Object.fromEntries(DATA.ITEM_IDS.map((k, i) => [k, i]));
  const ST = ['ok', 'down', 'gone'], ST_I = { ok: 0, down: 1, gone: 2 };
  const STAGES = ['street', 'intro', 'boss', 'won', 'lost', 'train', 'arrive'], STAGE_IDS = ['senju', 'joban', 'ueno'], TRPH = ['stop', 'run'], MK = ['fuda', 'sword', 'fist', 'beam', 'shield'], STAGE_I = Object.fromEntries(STAGES.map((k, i) => [k, i]));
  const BARR = ['street', 'none', 'plaza'], BARR_I = { street: 0, none: 1, plaza: 2 };
  const PK = ['food', 'bag', 'candy'], PK_I = { food: 0, bag: 1, candy: 2 };
  const CTX = ['dash', 'revive', 'lantern'], CTX_I = { dash: 0, revive: 1, lantern: 2, '': 0 };
  const FX = ['', 'fubuki', 'shime', 'otoshi', 'kousen', 'harite', 'junkou', 'bomb', 'land', 'ysword', 'yfist', 'ybeam'], FX_I = Object.fromEntries(FX.map((k, i) => [k, i]));
  const FLPH = ['rise', 'cross', 'gap', 'land'], FLPH_I = { rise: 0, cross: 1, gap: 2, land: 3 };
  const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10;
  const EV_SKIP = new Set(['swing']); // 量が多い演出は数を絞る

  function allyFlags(sim, a) {
    let f = 0;
    if (a.act && a.act.k === 'guard') f |= 1; if (a.buffs.stealth > 0) f |= 2; if (a.inv > 0) f |= 4; if (a.buffs.str > 0) f |= 8;
    if (a.buffs.def > 0) f |= 16; if (a.buffs.taunt > 0) f |= 32; if (a.hurtT > 0) f |= 64; if (a.dashing) f |= 128; if (a.tired) f |= 256;
    if (a.gLock.X) f |= 512; if (a.gLock.Y) f |= 1024; if (a.buffs.ramune > 0) f |= 2048; if (a.moving) f |= 4096; if (a.lan) f |= 8192; if (a.ctrlAI) f |= 16384;
    if (a.act && a.act.k === 'guard' && DATA.SKILLS[a.slots[a.act.slot]].reflect) f |= 32768;
    return f;
  }
  function encodeSnap(sim, o) {
    o = o || {};
    const A = sim.allies.map(a => [
      a.slot, CH_I[a.ch], r2(a.x), r2(a.z), r2(a.yaw), ST_I[a.st], a.act ? ACT_I[a.act.k] : 0, a.act ? r2(a.act.t) : 0,
      Math.round(a.hp / a.maxHp * 1000), Math.floor(a.sp), Math.round(a.stam), allyFlags(sim, a), r1(a.downT), r1(a.cd.X), r1(a.cd.Y), Math.round(a.g.X * 100), Math.round(a.g.Y * 100),
      IT_I[a.items[0].id], a.items[0].n, IT_I[a.items[1].id], a.items[1].n, CTX_I[a.ctx], a.st === 'down' ? Math.round(Math.min(1, a.rv) * 100) : 0, a.st === 'down' ? a.rvBy : -1,
      a.act && a.act.ratio != null ? Math.round(a.act.ratio * 100) : 0, a.act && a.act.slot ? (a.act.slot === 'X' ? 1 : 2) : 0, a.lastEv, r1(a.cdMax.X), r1(a.cdMax.Y),
      SK_I[a.slots.X], SK_I[a.slots.Y], a.lan ? Math.round(a.lan.t / DATA.SIM.lanternHold * 100) : 0, a.aq || 0,
      a.act && a.act.k === 'item' ? IT_I[a.act.it] : -1, a.buffs.stealth > 0 ? r1(a.buffs.stealth) : 0, a.lv || 1, a.stats.kills,
    ]);
    const b = sim.boss;
    const B = b ? [r2(b.x), r2(b.z), r2(b.y), r2(b.yaw), Math.round(b.hp / b.maxHp * 1000), BST_I[b.st], b.mv ? BMV_I[b.mv] : 0, r2(b.t), b.phase, (b.defDown > 0 ? 1 : 0) | (b.st === 'stun' ? 2 : 0) | (b.dots && b.dots.length ? 4 : 0),
      b.fl ? [FLPH_I[b.fl.ph], r2(b.fl.yaw || 0), b.fl.i, b.fl.n, r2(b.fl.len || 0), r2(b.fl.t)] : 0, b.target, b.downT || 0] : 0;
    const M = sim.mobs.map(m => [m.id, r2(m.x), r2(m.z), r2(m.yaw), Math.round(Math.max(0, m.hp) / m.maxHp * 1000), m.st === 'ok' ? 0 : 1, m.wind > 0 ? 1 : 0, m.para > 0 ? 1 : 0].concat(m.kind === 'yoshi' ? [MK.indexOf(m.wpn), m.act ? (m.act.t < m.act.w ? 1 : 2) : 0, m.enterT > 0 ? 1 : 0, m.moving ? 1 : 0, m.gT > 0 ? 1 : 0, Math.round((m.scale || 1) * 100), m.air ? r2(m.air) : 0] : []));
    let P = sim.projs.map(p => [p.id, PJ_I[p.kind], r2(p.x), r2(p.z), r2(p.yaw || 0), p.team === 'ally' ? 0 : 1, p.owner == null ? -1 : p.owner, r2(p.r)]);
    const H = sim.hazards.map(h => [h.id, HZ_I[h.kind], r2(h.x), r2(h.z), r2(h.yaw || 0),
      r2(h.kind === 'fan' ? h.r0 : h.kind === 'circle' ? h.r : h.len), r2(h.kind === 'fan' ? h.r1 : h.w || 0), r2(h.kind === 'fan' ? h.half : 0),
      r2(h.t), r2(h.warn), r2(h.act + (h.keep || 0)), FX_I[h.fx] || 0, h.brief || 0]);
    const T = sim.traps.map(t => [t.id, t.kind === 'mine' ? 1 : 0, r2(t.x), r2(t.z), t.t >= t.arm ? 1 : 0]);
    const K = sim.pickups.map(p => [p.id, PK_I[p.kind] || 0, r2(p.x), r2(p.z), p.item ? IT_I[p.item] : -1]);
    const L = [sim.lanterns.reduce((s, l, i) => s | (l.lit ? 1 << i : 0), 0), r1(sim.lanternT), r1(sim.lanternCool), sim.lanternOrder > sim.t ? 1 : 0];
    const evMin = sim.t - (o.evAge || 0.6);
    let E = []; let swings = 0;
    for (const e of sim.events) {
      if (e.t < evMin) continue;
      if (EV_SKIP.has(e.type) && ++swings > 6) continue;
      const c = {}; for (const k in e) { if (k === 't') continue; const v = e[k]; c[k] = typeof v === 'number' ? r2(v) : v; } E.push(c);
    }
    const S = [STAGE_I[sim.stage], r1(sim.stageT), r1(sim.timeLeft), BARR_I[sim.barrier], sim.introWait ? 1 : 0, sim.tick, sim.result ? [sim.result.win ? 1 : 0, sim.result.why, r1(sim.result.time)] : 0, sim.diffKey,
      STAGE_IDS.indexOf(sim.stageId) > 0 ? STAGE_IDS.indexOf(sim.stageId) : 0, sim.tr ? [sim.tr.at, sim.tr.ph === 'run' ? 1 : 0, r1(sim.tr.v), r1(DATA.JOBAN.segLen[Math.min(3, sim.tr.at)] - sim.tr.d), r1(sim.tr.t), sim.tr.doors] : 0, sim.kills || 0, sim.total || 0, sim.phase || 0, sim.bid || '', sim.H0 || 1, sim.queue ? sim.queue.length : 0, sim.U ? sim.uenoSnap() : 0];
    const snap = { t: 'sn', g: o.gid || 0, tm: r2(sim.t), s: S, a: A, b: B, m: M, p: P, h: H, k: T, u: K, l: L, e: E, pe: o.pe || 0 };
    if (o.maxBytes) { // room の presence は 4KiB まで
      let j = JSON.stringify(snap).length;
      while (j > o.maxBytes && (snap.e.length || snap.p.length)) { if (snap.e.length > 4) snap.e.splice(0, Math.ceil(snap.e.length / 3)); else if (snap.p.length) snap.p.splice(0, Math.ceil(snap.p.length / 3)); else snap.e = []; j = JSON.stringify(snap).length; }
    }
    return snap;
  }
  function decodeSnap(s) {
    const v = { tm: s.tm, g: s.g, stage: STAGES[s.s[0]], stageT: s.s[1], timeLeft: s.s[2], barrier: BARR[s.s[3]], introWait: !!s.s[4], tick: s.s[5], result: s.s[6] ? { win: !!s.s[6][0], why: s.s[6][1], time: s.s[6][2] } : null, diff: s.s[7], pe: s.pe || 0, stageId: STAGE_IDS[s.s[8] || 0], tr: s.s[9] ? { at: s.s[9][0], ph: TRPH[s.s[9][1]], v: s.s[9][2], rem: s.s[9][3], t: s.s[9][4], doors: s.s[9][5] } : null, kills: s.s[10] || 0, total: s.s[11] || 0, phase: s.s[12] || 0, bid: s.s[13] || '', H: s.s[14] || 1, wait: s.s[15] || 0, U: s.s[16] ? SIMLIB.uenoDecode(s.s[16]) : null };
    v.allies = s.a.map(r => ({
      slot: r[0], ch: CH_IDS[r[1]], x: r[2], z: r[3], yaw: r[4], st: ST[r[5]], act: ACTS[r[6]], actT: r[7], hpR: r[8] / 1000, sp: r[9], stam: r[10], f: r[11],
      guard: !!(r[11] & 1), stealth: !!(r[11] & 2), inv: !!(r[11] & 4), strBuff: !!(r[11] & 8), defBuff: !!(r[11] & 16), taunt: !!(r[11] & 32), hurt: !!(r[11] & 64), dash: !!(r[11] & 128), tired: !!(r[11] & 256),
      gLockX: !!(r[11] & 512), gLockY: !!(r[11] & 1024), ramune: !!(r[11] & 2048), moving: !!(r[11] & 4096), lanHold: !!(r[11] & 8192), ai: !!(r[11] & 16384), reflect: !!(r[11] & 32768),
      downT: r[12], cdX: r[13], cdY: r[14], gX: r[15] / 100, gY: r[16] / 100, items: [{ id: DATA.ITEM_IDS[r[17]], n: r[18] }, { id: DATA.ITEM_IDS[r[19]], n: r[20] }],
      ctx: CTX[r[21]], revP: r[22] / 100, revT: r[23], chg: r[24] / 100, actSlot: r[25] === 1 ? 'X' : r[25] === 2 ? 'Y' : '', lastEv: r[26], cdMaxX: r[27], cdMaxY: r[28],
      sk: { X: SK_IDS[r[29]], Y: SK_IDS[r[30]] }, lanP: r[31] / 100, aq: r[32], item: r[33] >= 0 ? DATA.ITEM_IDS[r[33]] : null, stealthT: r[34], lv: r[35] || 1, kills: r[36] || 0,
    }));
    const b = s.b;
    v.boss = b ? { x: b[0], z: b[1], y: b[2], yaw: b[3], hpR: b[4] / 1000, st: BST[b[5]], mv: BMV[b[6]], t: b[7], phase: b[8], defDown: !!(b[9] & 1), stun: !!(b[9] & 2), dot: !!(b[9] & 4), fl: b[10] ? { ph: FLPH[b[10][0]], yaw: b[10][1], i: b[10][2], n: b[10][3], len: b[10][4], t: b[10][5] } : null, target: b[11], downT: b[12] } : null;
    v.mobs = s.m.map(r => ({ id: r[0], x: r[1], z: r[2], yaw: r[3], hpR: r[4] / 1000, dying: !!r[5], wind: !!r[6], para: !!r[7], kind: MK[r[8] || 0], yoshi: r.length > 8, ph: r[9] || 0, enter: !!r[10], moving: !!r[11], guard: !!r[12], scale: (r[13] || 100) / 100, air: r[14] || 0 }));
    v.projs = s.p.map(r => ({ id: r[0], kind: PJ[r[1]], x: r[2], z: r[3], yaw: r[4], team: r[5] ? 'enemy' : 'ally', owner: r[6], r: r[7] }));
    v.hz = s.h.map(r => ({ id: r[0], kind: HZ[r[1]], x: r[2], z: r[3], yaw: r[4], a: r[5], b: r[6], c: r[7], t: r[8], warn: r[9], act: r[10], fx: FX[r[11]], brief: r[12] }));
    v.traps = s.k.map(r => ({ id: r[0], kind: r[1] ? 'mine' : 'para', x: r[2], z: r[3], armed: !!r[4] }));
    v.pickups = s.u.map(r => ({ id: r[0], kind: PK[r[1]] || 'food', x: r[2], z: r[3], item: r[4] >= 0 ? DATA.ITEM_IDS[r[4]] : null }));
    v.lan = { lit: [0, 1, 2, 3].map(i => !!(s.l[0] & (1 << i))), T: s.l[1], cool: s.l[2], order: !!s.l[3] };
    v.ev = s.e;
    return v;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpAng = (a, b, k) => a + SIMLIB.angDiff(a, b) * k;
  /** 2つの復元結果のあいだを補間（位置と向きだけ） */
  function interp(v0, v1, k) {
    if (!v0 || k >= 1) return v1; if (k <= 0) return v0;
    const out = Object.assign({}, v1);
    out.allies = v1.allies.map((a, i) => { const p = v0.allies[i]; if (!p) return a; return Object.assign({}, a, { x: lerp(p.x, a.x, k), z: lerp(p.z, a.z, k), yaw: lerpAng(p.yaw, a.yaw, k) }); });
    if (v1.boss && v0.boss) { const p = v0.boss, c = v1.boss; if (Math.abs(p.x - c.x) < 12) out.boss = Object.assign({}, c, { x: lerp(p.x, c.x, k), z: lerp(p.z, c.z, k), y: lerp(p.y, c.y, k), yaw: lerpAng(p.yaw, c.yaw, k) }); }
    const byId = (arr0, arr1, f) => { const m = new Map(arr0.map(e => [e.id, e])); return arr1.map(e => { const p = m.get(e.id); return p ? f(p, e) : e; }); };
    out.mobs = byId(v0.mobs, v1.mobs, (p, e) => Object.assign({}, e, { x: lerp(p.x, e.x, k), z: lerp(p.z, e.z, k), yaw: lerpAng(p.yaw, e.yaw, k) }));
    out.projs = byId(v0.projs, v1.projs, (p, e) => Object.assign({}, e, { x: lerp(p.x, e.x, k), z: lerp(p.z, e.z, k) }));
    out.hz = byId(v0.hz, v1.hz, (p, e) => Object.assign({}, e, { t: lerp(p.t, e.t, k) }));
    if (v1.boss && v0.boss) out.boss.t = v1.boss.st === v0.boss.st ? lerp(v0.boss.t, v1.boss.t, k) : v1.boss.t;
    out.allies.forEach((a, i) => { const p = v0.allies[i]; if (p && p.act === a.act) a.actT = lerp(p.actT, a.actT, k); });
    out.stageT = lerp(v0.stageT, v1.stageT, k);
    return out;
  }
  return { encodeSnap, decodeSnap, interp, CH_IDS, SK_IDS, FX };
})();
