/* =====================================================================
   roster.js — 60体の名簿・成長（Lv1〜99）・EXP・報酬・チケット・ガチャの設定（three.js 非依存）
   数値の正本は data/nightwatch-v2-game-data.json（schema 3.0）。roster_data.js は生成物。
   ・既存10体は data.js の技・モーションをそのまま使い、ランク・役割・タグ・Lv99能力だけを足す
   ・追加50体は10系統の技（赤猫団／白犬隊にある戦い方の種類）から作る。技名・係数は本作の調整案
   ===================================================================== */
const GAME = { title: '四人でバスターズ', chapters: ['北千住編', '上野編'], boss2: 'ヨシノシン', minion: 'ヨシノシンの部下' };
const RANKS = ['S', 'A', 'B', 'C', 'D'];
const RANK_INFO = {
  S: { col: '#d4a514', ic: '👑', nm: 'S' }, A: { col: '#8e44c4', ic: '★', nm: 'A' }, B: { col: '#2f6fd0', ic: '◆', nm: 'B' },
  C: { col: '#2f9a55', ic: '🍃', nm: 'C' }, D: { col: '#8a8f99', ic: '●', nm: 'D' },
};
const ROLES = {
  attacker: { label: 'アタッカー', short: '攻撃', ic: '⚔', help: '近接・射撃・妖術でダメージを与える', ai: 'melee' },
  tank: { label: 'タンク（壁役）', short: '壁', ic: '🛡', help: 'ガードや敵視で仲間を守る', ai: 'tank' },
  ranger: { label: 'サポーター（レンジャー）', short: '補助', ic: '⚑', help: '爆弾・地雷・強化・弱体化で支援する', ai: 'melee' },
  healer: { label: 'ヒーラー', short: '回復', ic: '🌿', help: 'HP回復と悪いとりつきの解除を担う', ai: 'healer' },
};
const ROLE_IDS = ['attacker', 'tank', 'ranger', 'healer'];

/* ---------------- 成長：能力（Lv1＝Lv99の60%/65%）と EXP（必要量が1レベルごとに約4.5%増） ---------------- */
const GROWTH = (() => {
  const LV_MAX = 99;
  // 整数だけで四捨五入（切り上げ側）：cap×60/100、cap×65/100
  const startOf = (cap, isHp) => Math.floor((cap * (isHp ? 60 : 65) + 50) / 100);
  const statAt = (cap, L, isHp) => { const s = startOf(cap, isHp); return s + Math.floor((cap - s) * (L - 1) / 98); };
  /** レベルL の HP・ちから・ようりょく・まもり（cap＝Lv99の値 [hp,str,yo,def]） */
  function stats(c, L) { L = Math.max(1, Math.min(LV_MAX, L | 0)); const k = c.cap; return { hp: statAt(k[0], L, true), str: statAt(k[1], L), yo: statAt(k[2], L), def: statAt(k[3], L) }; }
  /** AIが動かすときの能力：各値×9÷10の切り捨て */
  const aiStats = s => ({ hp: Math.floor(s.hp * 9 / 10), str: Math.floor(s.str * 9 / 10), yo: Math.floor(s.yo * 9 / 10), def: Math.floor(s.def * 9 / 10) });
  const cum = (rank, L) => EXP_CUM[rank][Math.max(1, Math.min(LV_MAX, L))];
  /** 累積EXPからレベル（Lv99で止める） */
  function levelOf(rank, exp) { const a = EXP_CUM[rank]; let lo = 1, hi = LV_MAX; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (exp >= a[m]) lo = m; else hi = m - 1; } return lo; }
  /** 次のレベルまでの必要量（Lv99は null＝上限） */
  const toNext = (rank, L) => L >= LV_MAX ? null : EXP_CUM[rank][L + 1] - EXP_CUM[rank][L];
  /** いまのレベル区間の中での進み（0〜1、Lv99は1） */
  function progress(rank, exp) { const L = levelOf(rank, exp); if (L >= LV_MAX) return { L, in: 0, need: null, r: 1 }; const a = EXP_CUM[rank], i = exp - a[L], n = a[L + 1] - a[L]; return { L, in: i, need: n, r: i / n }; }
  /** EXPを足す（負・あふれを防ぐ。Lv99では上限の累積に止める） */
  const addExp = (rank, exp, add) => Math.max(0, Math.min(EXP_CUM[rank][LV_MAX], Math.floor((+exp || 0) + Math.max(0, Math.floor(+add || 0)))));
  return { LV_MAX, stats, aiStats, cum, levelOf, toNext, progress, addExp, statAt };
})();

/* ---------------- 報酬（各キャラに配る。4等分ではない） ---------------- */
const REWARD = {
  base: { senju: { win: 10000, loss: 2500 }, joban: { win: 20000, loss: 5000 }, ueno: { win: 50000, loss: 7000 } },
  human: 1.0, ai: 0.8, reserve: 0, coopPer: 0.1, coopCap: 0.3,
  /** 協力倍率（10倍した整数）：1人10、2人11、3人12、4人以上13 */
  coop10: H => 10 + Math.min(3, Math.max(0, (H | 0) - 1)),
  /** 操作率：ずっと人が操作＝1.0、ずっとAI＝0.8。途中で替えたら有効時間の割合 */
  rate: humanFrac => 0.8 + 0.2 * Math.max(0, Math.min(1, +humanFrac || 0)),
  /** 最終EXP＝floor(基本×協力倍率×操作率) */
  exp(stage, win, H, rate) { const e = this.base[stage]; if (!e) return 0; const base = win ? e.win : e.loss; return Math.floor(base * this.coop10(H) * Math.round(rate * 1000) / 10000 + 1e-6); },
};
/** 勝利チケット：トバトーバン3勝ごと・ヨシノシン2勝ごとに1枚。電車・敗北・部下撃破では進まない */
const TICKET = { senju: { key: 'tobatoban', per: 3 }, ueno: { key: 'yoshinoshin', per: 2 } };
const GACHA = {
  weight: { C: 3.5, B: 3.5, A: 2.2, S: 0.8 }, // 未所持1体あたりの重み（各ランク10体＝35/35/22/8%）
  ranks: ['C', 'B', 'A', 'S'],
  exchangeExp: 10000, // 40体すべて入手済みのとき、1枚を選んだ1体のEXP10,000と交換
  anim: { C: 1.6, B: 2.0, A: 2.6, S: 3.2 },
  col: { C: 0x3fae5a, B: 0x2f6fd0, A: 0xb03a7a, S: 0xe0b020 },
};

/* ---------------- 既存10体：ランク・役割・タグ・Lv99能力 ---------------- */
for (const m of ROSTER_EXIST) {
  const c = DATA.CHI[m.id]; if (!c) continue;
  Object.assign(c, { rank: m.rank, roleId: m.role, tags: m.tags, cap: m.cap, isNew: false, gacha: false, form: c.blurb });
  c.ai = c.ai || ROLES[m.role].ai;
}

/* ---------------- 追加50体：技・必殺・キャラを組み立てる ---------------- */
(() => {
  const D = DATA;
  // 通常攻撃（追加キャラ共通）：A50＝近接・発生0.15秒、A35＝単発射撃・射程8m・速度14m/s。どちらも0.50秒周期
  D.MOVES.melee1n = { kind: 'melee1', nm: '近接打撃', start: 0.15, active: 0.10, end: 0.50, range: 1.5, arc: 1.2 };
  D.MOVES.shotn = { kind: 'shot', nm: '射撃', fire: 0.15, end: 0.50, lock: 0.25, speed: 14, life: 8 / 14, r: 0.32 };
  const SHORT = { purify: 'おはらい', heal1: '恵み', healRing: '円陣', regen: 'やすらぎ', spell: '妖術', cshot: 'ため射ち', dodge: '回避', taunt: '誘い打ち', guard: 'ガード', bomb: '火薬玉', mine: '地雷' };
  const shortOf = (nm, k, stats) => {
    if (k === 'buff') return stats[0] === 'spd' ? '追い風' : stats[0] === 'str' ? '勇気' : '守り';
    if (k === 'debuff') return stats.length > 1 ? '力ぬき' : '足どめ';
    if (k === 'spell') return nm.includes('竜巻') ? '竜巻' : '氷つぶて';
    if (k === 'guard' && /返し/.test(nm)) return '反射';
    return SHORT[k] || nm.slice(-3);
  };
  function skill(id, [nm, f]) {
    const base = { nm, short: shortOf(nm, f.k, f.stats || []) };
    let s;
    switch (f.k) {
      case 'purify': s = { kind: 'healRing', pw: f.pw, max: 1.0, cd: f.cd, r0: f.r0, r1: f.r1, cleanse: true }; break;
      case 'heal1': s = { kind: 'heal', pw: f.pw, max: 1.0, cd: f.cd, mul: f.mul, range: f.range }; break;
      case 'healRing': s = { kind: 'healRing', pw: f.pw, max: 1.0, cd: f.cd, r0: f.r0, r1: f.r1 }; break;
      case 'regen': s = { kind: 'regen', pw: f.pw, n: f.n, max: 1.0, cd: f.cd, r0: f.r0, r1: f.r1 }; break;
      case 'buff': s = { kind: 'aura', side: 'ally', stats: f.stats, mul: f.mul, dur: f.dur, max: 1.0, cd: f.cd, r0: f.r0, r1: f.r1 }; break;
      case 'debuff': s = { kind: 'aura', side: 'enemy', stats: f.stats, mul: f.mul, dur: f.dur, max: 1.0, cd: f.cd, r0: f.r0, r1: f.r1 }; break;
      case 'spell': s = { kind: 'charge', form: 'spell', pw: f.pw, stat: 'yo', el: f.el, mul: f.mul, cd: f.cd, range: 8, r: 1.3, attack: true }; break;
      case 'cshot': s = { kind: 'charge', form: 'pshot', pw: f.pw, stat: 'str', mul: f.mul, cd: f.cd, speed: 14, range: 8, attack: true }; break;
      case 'dodge': s = { kind: 'dodge', cd: f.cd, iv0: f.iv0, iv1: f.iv1, end: f.end, dist: f.dist }; break;
      case 'taunt': s = { kind: 'taunt', pw: f.pw, stat: 'str', threat: 300, cd: f.cd, start: 0.22, end: 0.55, range: 1.5, arc: 1.2, attack: true }; break;
      case 'guard': s = { kind: 'guard', max: 8, refill: 20, threshold: 0.15, mul: f.mul, taunt: true, reflect: f.reflect || 0 }; break;
      case 'bomb': s = { kind: 'bomb', pw: f.pw, stat: 'yo', fuse: f.fuse, r: f.r, cd: f.cd, allyMul: 0.25, attack: true }; break;
      case 'mine': s = { kind: 'mine', pw: f.pw, stat: 'yo', arm: f.arm, r: f.r, life: f.life, cd: f.cd, trig: 1.2, allyMul: 0.25, attack: true }; break;
      default: throw new Error('skill ' + f.k);
    }
    D.SKILLS[id] = Object.assign(base, s);
    return id;
  }
  function special(id, [nm, f]) {
    const common = { nm, prep: 0.65, iv: 0.16, tail: 0.40, end: 1.20 };
    let s;
    switch (f.k) {
      case 'multi':
        if (f.shape === 'wind') s = { type: 'multi', n: f.n, pw: f.pw, iv: f.iv, shape: 'fan', range: 5, arc: 0.8, stat: 'yo', fx: 'wind' };
        else if (f.shape === 'beam') s = { type: 'multi', n: f.n, pw: f.pw, iv: f.iv, shape: 'line', len: 12, w: 1.6, stat: 'str', fx: 'beam' };
        else s = { type: 'multi', n: f.n, pw: f.pw, iv: f.iv, shape: 'fan', range: 1.8, arc: 1.3, stat: 'str', fx: 'melee' };
        break;
      case 'healAll': s = { type: 'heal', pw: f.pw, r: f.r, revive: false, cleanse: true }; break;
      case 'buffAll': s = { type: 'buff', stats: f.stats, mul: f.mul, dur: f.dur, r: f.r }; break;
      case 'debuffAll': s = { type: 'debuff', stats: f.stats, mul: f.mul, dur: f.dur, r: f.r }; break;
      case 'protectAll': s = { type: 'protect', r: f.r, inv: f.inv }; break;
      case 'guardup': s = { type: 'guardup', mul: f.mul, dur: f.dur, threat: 1200 }; break;
      case 'field': s = { type: 'field', pw: f.pw, n: f.n, r: f.r }; break;
      default: throw new Error('special ' + f.k);
    }
    D.SPECIALS[id] = Object.assign(common, s);
    return id;
  }
  const COL = {
    new_d_01: [0xd8b45a, 0x7a4a2a], new_d_02: [0xe8d39a, 0x8a5a2a], new_d_03: [0xc8843a, 0x2f8f6a], new_d_04: [0x9a9a92, 0x5a8a3a], new_d_05: [0x7ab040, 0xd8c060],
    new_d_06: [0xa8a49a, 0xff8a2a], new_d_07: [0xf0e6d0, 0xc84a3a], new_d_08: [0xe0b040, 0xc8302a], new_d_09: [0x4a7ab8, 0x6a6a6a], new_d_10: [0xf4f2ee, 0x9ad0f0],
    new_c_01: [0xf2ead6, 0x3a6ac8], new_c_02: [0x3aa07a, 0x8a6a4a], new_c_03: [0xe07a5a, 0xf0d8b0], new_c_04: [0xb07a4a, 0xd8b040], new_c_05: [0x6ab04a, 0xe8e0a0],
    new_c_06: [0xf4f4f4, 0xd0302a], new_c_07: [0x4a8ab0, 0xb08a5a], new_c_08: [0xc83a5a, 0xe8c040], new_c_09: [0xa85a3a, 0xc0c4c8], new_c_10: [0xf6efe4, 0x7a6ac0],
    new_b_01: [0x5a7a6a, 0xc8a04a], new_b_02: [0xd8a040, 0xc83a3a], new_b_03: [0x3a8ac8, 0xf2f0ea], new_b_04: [0x5a6070, 0x9a6a3a], new_b_05: [0x2a8ac8, 0xe07a2a],
    new_b_06: [0xb0784a, 0x6ad0ff], new_b_07: [0x8a6a4a, 0xf2d050], new_b_08: [0x7ab06a, 0xd8e8b0], new_b_09: [0x4a4a52, 0xc84a3a], new_b_10: [0x6a6a9a, 0xf0e0f0],
    new_a_01: [0xf6f8fa, 0x8ac8f0], new_a_02: [0x9a7a5a, 0x3a8ad8], new_a_03: [0x7a6a5a, 0xd8c08a], new_a_04: [0x6a8a5a, 0x8a4a2a], new_a_05: [0xb8c4d0, 0x3a4a6a],
    new_a_06: [0x3a4a8a, 0xd8a83a], new_a_07: [0x4a7ac8, 0xf2d050], new_a_08: [0xf6f2ea, 0xd04a5a], new_a_09: [0xf2f0ea, 0x3a3a42], new_a_10: [0x3a3a6a, 0xe8d090],
    new_s_01: [0xf6f6f2, 0xd04a3a], new_s_02: [0xc8d0d8, 0x5ab0c8], new_s_03: [0x5ac0b0, 0xe8f8f8], new_s_04: [0x6a6458, 0xffd040], new_s_05: [0x2a2a3a, 0xa8c8f0],
    new_s_06: [0xc8c0b0, 0x7a6ad8], new_s_07: [0xe89a6a, 0xf8e0a0], new_s_08: [0x2a8a8a, 0xe0b040], new_s_09: [0x3a3a42, 0xe0c040], new_s_10: [0xd8d0f0, 0x8a6ad8],
  };
  const FAM_AI = { purify_heal: 'healer', field_healer: 'healer', guard_tank: 'tank', reflect_tank: 'tank', charge_shooter: 'ranged', speed_support: 'ranged', wind_attacker: 'mage', bomb_ranger: 'melee', buff_support: 'melee', debuff_support: 'melee' };
  for (const n of ROSTER_NEW) {
    const id = n.id, col = COL[id] || [0x888888, 0xffffff];
    const c = {
      id, nm: n.nm, role: ROLES[n.role].short + '・' + n.tags.slice(0, 2).join('・'), blurb: n.form, form: n.form, h: n.h, hr: n.hr, el: n.el,
      str: n.cap[1], yo: n.cap[2], def: n.cap[3], hp: n.cap[0], cap: n.cap, rank: n.rank, roleId: n.role, tags: n.tags, fam: n.fam, tier: n.tier,
      isNew: true, gacha: n.gacha, A: n.A[1].k === 'shot' ? 'shotn' : 'melee1n', Anm: n.A[0], Apw: [n.A[1].pw],
      X: skill(id + '_X', n.X), Y: skill(id + '_Y', n.Y), sp: special(id + '_SP', n.SP), spNm: n.SP[0],
      fx: { X: n.X[2], Y: n.Y[2], SP: n.SP[2] }, passive: null, psv: '固有の特性はなし（初版）', col: col[0], acc: col[1], ai: FAM_AI[n.fam] || 'melee', src: null,
    };
    D.CHARS.push(c); D.CHI[id] = c;
  }
})();
const CHAR_IDS = DATA.CHARS.map(c => c.id);
const NEW_D_IDS = ROSTER_NEW.filter(n => n.rank === 'D').map(n => n.id);
const GACHA_IDS = ROSTER_NEW.filter(n => n.gacha).map(n => n.id);
Object.assign(DATA, { GAME, RANKS, RANK_INFO, ROLES, ROLE_IDS, GROWTH, REWARD, TICKET, GACHA, CHAR_IDS, NEW_D_IDS, GACHA_IDS, EXP_CUM });
