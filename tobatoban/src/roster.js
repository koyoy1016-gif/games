/* =====================================================================
   roster.js — 60体の名簿・成長（Lv1〜99）・EXP・報酬・チケット・ガチャの設定（three.js 非依存）
   数値の正本は data/nightwatch-v2-game-data.json（schema 3.0）。roster_data.js は生成物。
   ・既存10体は data.js の技・モーションをそのまま使い、ランク・役割・タグ・Lv99能力だけを足す
   ・追加50体は10系統の技（赤猫団／白犬隊にある戦い方の種類）から作る。技名・係数は本作の調整案
   ===================================================================== */
const GAME = { title: 'BIGバスターズ', chapters: ['北千住編', '上野編', '秋葉原編'], boss2: 'ヨシノシン', minion: 'ヨシノシンの部下' };
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
  /** v7：設定表の値（base）をLv1の能力とし、旧式と同じ伸び率（HP：Lv99でLv1の1.667倍・ほか1.538倍）で上げる。
      HP＝B＋floor(B×(L−1)÷147)、ほか＝B＋floor(B×(L−1)÷182)（旧式「Lvの値÷Lv1の値」を連続式にしたもの。Lv1は設定表と同じ・単調に増える） */
  const HP_PLUS = 400; // v7：全60体のLv1のHPを仕様の値＋400に（伸び率・成長方式はそのまま。+400した値を基準に同じ式で伸びる）
  const grow = (B, L, isHp) => B + Math.floor(B * (L - 1) / (isHp ? 147 : 182));
  /** レベルL の HP・ちから・ようりょく・まもり（base＝Lv1 [hp,str,yo,def]。base が無いときは旧式の cap＝Lv99） */
  function stats(c, L) { L = Math.max(1, Math.min(LV_MAX, L | 0)); const b = c.base; if (b) return { hp: grow(b[0] + HP_PLUS, L, true), str: grow(b[1], L), yo: grow(b[2], L), def: grow(b[3], L) }; const k = c.cap; return { hp: statAt(k[0], L, true), str: statAt(k[1], L), yo: statAt(k[2], L), def: statAt(k[3], L) }; }
  /** AIが動かすときの能力：各値×95÷100の切り捨て（v7） */
  const aiStats = s => ({ hp: Math.floor(s.hp * 95 / 100), str: Math.floor(s.str * 95 / 100), yo: Math.floor(s.yo * 95 / 100), def: Math.floor(s.def * 95 / 100) }); // v7：AIは95%（移動速度は SIM.aiMul）
  const cum = (rank, L) => EXP_CUM[rank][Math.max(1, Math.min(LV_MAX, L))];
  /** 累積EXPからレベル（Lv99で止める） */
  function levelOf(rank, exp) { const a = EXP_CUM[rank]; let lo = 1, hi = LV_MAX; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (exp >= a[m]) lo = m; else hi = m - 1; } return lo; }
  /** 次のレベルまでの必要量（Lv99は null＝上限） */
  const toNext = (rank, L) => L >= LV_MAX ? null : EXP_CUM[rank][L + 1] - EXP_CUM[rank][L];
  /** いまのレベル区間の中での進み（0〜1、Lv99は1） */
  function progress(rank, exp) { const L = levelOf(rank, exp); if (L >= LV_MAX) return { L, in: 0, need: null, r: 1 }; const a = EXP_CUM[rank], i = exp - a[L], n = a[L + 1] - a[L]; return { L, in: i, need: n, r: i / n }; }
  /** EXPを足す（負・あふれを防ぐ。Lv99では上限の累積に止める） */
  const addExp = (rank, exp, add) => Math.max(0, Math.min(EXP_CUM[rank][LV_MAX], Math.floor((+exp || 0) + Math.max(0, Math.floor(+add || 0)))));
  /** 装備の反映：同じ能力の増加％は足し算して、基礎×(100＋合計％)÷100 を一度だけ切り捨て（HPを守りから計算し直さない） */
  function withEquip(st, eq) {
    const add = { hp: 0, str: 0, yo: 0, def: 0 };
    for (const id of eq || []) { const e = EQUIP_I[id]; if (e) add[e.stat] += e.pct; }
    return { hp: Math.floor(st.hp * (100 + add.hp) / 100), str: Math.floor(st.str * (100 + add.str) / 100), yo: Math.floor(st.yo * (100 + add.yo) / 100), def: Math.floor(st.def * (100 + add.def) / 100) };
  }
  return { LV_MAX, stats, grow, aiStats, cum, levelOf, toNext, progress, addExp, statAt, withEquip };
})();
/** 装備12種（4系統×青・紫・金）。購入・抽選なし。電車クリア前は1枠、クリア後は2枠。同じIDは2つ付けられない */
const EQUIP = [
  ['bracer', '剛力の腕輪', 'str', 'ちから', [30, 40, 50], '💪'],
  ['bell', '霊光の鈴', 'yo', 'ようりょく', [30, 40, 50], '🔔'],
  ['charm', '守護のお守り', 'def', 'まもり', [30, 40, 50], '🛡'],
  ['magatama', '命結びの勾玉', 'hp', '最大HP', [40, 50, 100], '🟢'],
].flatMap(([k, nm, stat, sl, pcts, ic]) => ['blue', 'purple', 'gold'].map((tier, i) => ({ id: `${k}_${tier}`, line: k, nm: `${nm}（${['青', '紫', '金'][i]}）`, short: nm, stat, statLabel: sl, pct: pcts[i], tier, ic, col: ['#3a7bd5', '#8e44ad', '#d4a017'][i] })));
const EQUIP_I = Object.fromEntries(EQUIP.map(e => [e.id, e]));

/* ---------------- 報酬（各キャラに配る。4等分ではない） ---------------- */
const REWARD = {
  base: { senju: { win: 10000, loss: 2500 }, joban: { win: 20000, loss: 5000 }, ueno_street: { win: 12000, loss: 3000 }, ueno: { win: 50000, loss: 7000 }, akiba_platform: { win: 20000, loss: 5000 }, akiba_plaza: { win: 70000, loss: 10000 } },
  human: 1.0, ai: 0.8, reserve: 0,
  /** 協力人数の上乗せは廃止（いつも1倍） */
  coop10: () => 10,
  /** 固定率：ソロは出動時のメイン（P1）枠100%・ほかの3枠80%。マルチは参加した人間全員100%・AI補充枠80%。途中の操作交代で変えない */
  rate: isMain => isMain ? 1.0 : 0.8,
  /** 最終EXP＝floor(基本×固定枠率) */
  exp(stage, win, H, rate) { const e = this.base[stage]; if (!e) return 0; const base = win ? e.win : e.loss; return Math.floor(base * Math.round((rate == null ? 1 : rate) * 100) / 100 + 1e-6); },
};
/** 勝利チケット（v7 P4）：ストーリー6ステージ共通で、勝利2回ごとに1枚（別ステージでも同じステージの再クリアでも数える）。敗北・撤退・演出では進まない
    1回のクリアで増える枚数＝floor((C+1)/2)−floor(C/2)（Cはそれまでの共通勝利数。奇数回の残り1回分は wins.story に残る） */
const TICKET = { stages: ['senju', 'joban', 'ueno_street', 'ueno', 'akiba_platform', 'akiba_plaza'], per: 2, key: 'story', text: 'ストーリーを2回クリアするごとにチケット1枚' };
const GACHA = {
  weight: { D: 4.0, C: 3.5, B: 3.5, A: 2.2, S: 0.8 }, // 未所持1体あたりの重み（v7：Dもガチャへ。各ランク10体＝約28.6/25/25/15.7/5.7%）
  ranks: ['D', 'C', 'B', 'A', 'S'],
  exchangeExp: 10000, // 50体すべて入手済みのとき、1枚を選んだ1体のEXP10,000と交換
  anim: { D: 1.4, C: 1.6, B: 2.0, A: 2.6, S: 3.2 },
  col: { D: 0x8a8f99, C: 0x3fae5a, B: 0x2f6fd0, A: 0xb03a7a, S: 0xe0b020 },
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
  const at = v => Math.round(v * 0.70 * 1000) / 1000; // A通常攻撃は旧値の70%（v6）
  D.MOVES.melee1n = { kind: 'melee1', nm: '近接打撃', start: at(0.15), active: at(0.10), end: at(0.50), range: 1.5, arc: 1.2 };
  D.MOVES.shotn = { kind: 'shot', nm: '射撃', fire: at(0.15), end: at(0.50), lock: at(0.25), speed: 14, life: 8 / 14, r: 0.32 };
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
      isNew: true, gacha: true, // v7：追加50体はすべてガチャで入手（初期所持は既存10体だけ） A: n.A[1].k === 'shot' ? 'shotn' : 'melee1n', Anm: n.A[0], Apw: [n.A[1].pw],
      X: skill(id + '_X', n.X), Y: skill(id + '_Y', n.Y), sp: special(id + '_SP', n.SP), spNm: n.SP[0],
      fx: { X: n.X[2], Y: n.Y[2], SP: n.SP[2] }, passive: null, psv: '固有の特性はなし（初版）', col: col[0], acc: col[1], ai: FAM_AI[n.fam] || 'melee', src: null,
    };
    D.CHARS.push(c); D.CHI[id] = c;
  }
})();
/* ---------------- v7：60体の役職・Lv1能力・A/X/Y（依頼v7の設定表 → roster_v7.js） ----------------
   ・名前と見た目は本作のオリジナルのまま。役職・能力・技の名前と動きを設定表に合わせる
   ・技の数値は既存の同種の技に合わせた本作の調整案（設定表の「基礎威力」はそのまま使う） */
(() => {
  const D = DATA, S0 = D.SKILLS;
  const tpl = {
    'チャージこうげき': () => Object.assign({}, S0.kogeShou, { desc: '長押しでため、離すと正面を攻撃（近接・威力80、最大ためで×' + D.CHARGE.mul + '）。ため中も歩ける' }),
    'チャージショット': () => Object.assign({}, S0.hoshiShot, { desc: '長押しでため、離すと前へ射撃（威力50、ためるほど強く大きい弾）。ため中も歩ける' }),
    '火炎の術': () => Object.assign({}, S0.akaneFire, { el: '火', desc: '火の妖術（ようりょく・威力50）。ためて放ち、着弾の周り（半径約1.6m）にも当たる' }),
    'いかずちの術': () => Object.assign({}, S0.akaneFire, { el: '雷', desc: '雷の妖術（ようりょく・威力50）。ためて放ち、着弾の周り（半径約1.6m）にも当たる' }),
    '氷結の術': () => ({ kind: 'charge', form: 'pshot', pw: 50, stat: 'yo', el: '氷', speed: 16, range: 9, cd: 0, attack: true, desc: '氷の妖術（ようりょく・威力50）。ためて放つと前へまっすぐ氷が飛び、並んだ敵をつらぬく' }),
    '竜巻の術': () => ({ kind: 'charge', form: 'spell', el: '風', pw: 50, stat: 'yo', range: 8, r: 1.3, attack: true, desc: '風の妖術（ようりょく・威力50）。ためて放つと、狙った敵の位置に小さな竜巻（半径1.3m）' }),
    'つむじ風の術': () => ({ kind: 'charge', form: 'spell', el: '風', pw: 40, stat: 'yo', range: 8, r: 1.7, attack: true, desc: '風の妖術（ようりょく・威力40）。ためて放つと、狙った敵の位置につむじ風（半径1.7m）' }),
    '吸収の術': () => Object.assign({}, S0.suiKemuri, { pw: 30, desc: '前方の敵から吸い取る妖術（威力30）。与えたダメージの半分を自分のHPへ' }),
    '暗黒の術': () => Object.assign({}, S0.suiKemuri, { pw: 40, desc: '前方の敵から吸い取る妖術（威力40）。与えたダメージの半分を自分のHPへ' }),
    '超・毒とりつき': () => Object.assign({}, S0.kogetsuki, { pw: Math.round(S0.kogetsuki.pw * 1.5), desc: `敵に強い継続ダメージ（${S0.kogetsuki.dur}秒・1秒ごと）を付ける` }),
    '神速アタック': () => ({ kind: 'lunge', pw: 80, stat: 'str', dist: 5.5, cd: 5, range: 1.6, arc: 1.2, attack: true, desc: '狙った敵へ一気に踏み込んで一撃（近接・威力80・最大5.5m）。敵がいなければ前へ進む' }),
    '隠密の術': () => Object.assign({}, S0.kageKakure, { desc: `${S0.kageKakure.dur}秒、敵に狙われにくくなる（見つかっていない間の攻撃は会心）` }),
    'カウンター': () => Object.assign({}, S0.ukenagashi, { desc: `構えて${S0.ukenagashi.win}秒の間に攻撃を受けると受け流し、反撃（威力${S0.ukenagashi.pw}）` }),
    '疾風ステップ': () => Object.assign({}, S0.hikiGiri, { pw: 70, desc: '攻撃しながら後ろへ跳び退く（近接・威力70）。下がる間は無敵' }),
    'こんしんの一撃': () => Object.assign({}, S0.konshin, { desc: `力をこめて重い一撃（近接・威力400）。出るまで約${S0.konshin.start}秒かかる` }),
    '気合の一発': () => Object.assign({}, S0.konshin, { pw: 100, start: 0.30, active: 0.12, rec: 0.40, cd: 5, arc: 0.8, desc: '正面へすばやく一撃（近接・威力100）。こんしんの一撃より早く出る' }),
    '麻痺の術': () => Object.assign({}, S0.shibire, { desc: `足元に麻痺のワナ。踏んだボスが少しの間しびれる（通常の敵には効かない・再使用${S0.shibire.cd}秒）` }),
    '超麻痺の術': () => Object.assign({}, S0.shibire, { para: S0.shibire.para * 1.5, cd: S0.shibire.cd + 7, desc: `足元に強い麻痺のワナ。踏んだボスが長めにしびれる（通常の敵には効かない・再使用${S0.shibire.cd + 7}秒）` }),
    '超・シールド': () => Object.assign({}, S0.daihigo, { desc: `周り（${S0.daihigo.r}m）の味方を一瞬無敵にする` }),
    '無敵': () => Object.assign({}, S0.daihigo, { self: true, inv: 3.0, cd: 20, cleanse: true, desc: '3秒間、自分が受けるダメージを0にし、悪いとりつきも消す（再使用20秒）' }),
    'ガード': () => Object.assign({}, S0.guard, { desc: '押している間、受けるダメージを半分に。始めに周りの敵を引きつける（ゲージを使う）' }),
    '鉄壁ガード': () => Object.assign({}, S0.guard, { mul: 0.3, desc: '押している間、受けるダメージを3割に。始めに周りの敵を引きつける（ゲージを使う）' }),
    '反射ガード': () => Object.assign({}, S0.hansha, { desc: '押している間、受けるダメージを減らし、一部を相手へ返す。始めに敵を引きつける' }),
    '誘い打ち': () => Object.assign({}, S0.yobikomi, { desc: '正面を攻撃し（威力80）、当たった敵の注意を自分へ向ける' }),
    '地雷': () => Object.assign({}, S0.okiKayaku, { desc: `足元に地雷（威力600）。近づいた敵や味方で爆発（1人1個・再使用${S0.okiKayaku.cd}秒）` }),
    '超地雷の術': () => Object.assign({}, S0.okiKayaku, { pw: 900, r: S0.okiKayaku.r * 1.3, cd: S0.okiKayaku.cd + 15, desc: `足元に大きな地雷（威力900・範囲広め）。再使用${S0.okiKayaku.cd + 15}秒` }),
    '回復の術': () => Object.assign({}, S0.megumi, { desc: `味方1人を回復（威力80・ためるほど最大×${S0.megumi.mul}）` }),
    '極楽の術': () => Object.assign({}, S0.megumi, { mul: S0.megumi.mul * 1.3, cd: S0.megumi.cd + 1, desc: `強い回復（威力80・最大ためで×${(S0.megumi.mul * 1.3).toFixed(1)}）。減ったHPを大きく戻す` }),
    '円陣回復の術': () => Object.assign({}, S0.kaedeWa, { desc: `周りの味方をまとめて回復（威力80・ためるほど範囲${S0.kaedeWa.r0}→${S0.kaedeWa.r1}m）` }),
    '回復とりつき': () => ({ kind: 'regen', pw: 18, n: 8, max: 1.0, cd: 10, r0: 2, r1: 4, desc: '味方に継続回復（8秒・1秒ごと）。ためるほど範囲2→4m' }),
    '超・回復とりつき': () => ({ kind: 'regen', pw: 28, n: 8, max: 1.0, cd: 11, r0: 2, r1: 4, desc: '味方に強い継続回復（8秒・1秒ごと）。ためるほど範囲2→4m' }),
    '超・こうげきアップ': () => ({ kind: 'aura', side: 'ally', stats: ['str', 'yo'], mul: 1.3, dur: 10, max: 1.0, cd: 15, r0: 2, r1: 4, desc: '味方のちから・ようりょくを10秒×1.3。ためるほど範囲2→4m' }),
    '全強化とりつき': () => ({ kind: 'aura', side: 'ally', stats: ['str', 'yo', 'def', 'spd'], mul: 1.1, dur: 10, max: 1.0, cd: 15, r0: 2, r1: 4, desc: '味方のちから・ようりょく・まもり・はやさを10秒×1.1。ためるほど範囲2→4m' }),
    '超・まもりダウン': () => ({ kind: 'aura', side: 'enemy', stats: ['def'], mul: 0.7, dur: 8, max: 1.0, cd: 12, r0: 2, r1: 4, desc: '敵のまもりを8秒×0.7。ためるほど範囲2→4m' }),
    '超・はやさダウン': () => ({ kind: 'aura', side: 'enemy', stats: ['spd'], mul: 0.6, dur: 8, max: 1.0, cd: 12, r0: 2, r1: 4, desc: '敵の移動を8秒×0.6（ボスは下げ幅が小さい）。ためるほど範囲2→4m' }),
    '全弱体とりつき': () => ({ kind: 'aura', side: 'enemy', stats: ['str', 'yo', 'def', 'spd'], mul: 0.9, dur: 8, max: 1.0, cd: 12, r0: 2, r1: 4, desc: '敵のちから・ようりょく・まもり・はやさを8秒×0.9。ためるほど範囲2→4m' }),
    '超・よろい砕き': () => ({ kind: 'breaker', pw: 80, stat: 'str', stats: ['def'], mul: 0.6, dur: 4, cd: 8, start: 0.22, end: 0.55, range: 1.5, arc: 1.2, attack: true, desc: '正面を攻撃し（威力80）、当たった敵のまもりを4秒×0.6' }),
    '超・刀狩り': () => ({ kind: 'breaker', pw: 80, stat: 'str', stats: ['str', 'yo'], mul: 0.6, dur: 4, cd: 8, start: 0.22, end: 0.55, range: 1.5, arc: 1.2, attack: true, desc: '正面を攻撃し（威力80）、当たった敵のちから・ようりょくを4秒×0.6' }),
    '武神の陣': () => ({ kind: 'zone', side: 'ally', stats: ['str', 'yo', 'def', 'spd'], mul: 1.15, r: 3.5, max: 6, cd: 12, desc: '押している間（最大6秒）、周り3.5mの味方のちから・ようりょく・まもり・はやさ×1.15。維持中はほかの技・アイテムを使えず、歩きはゆっくり' }),
    '回復の陣': () => ({ kind: 'zone', side: 'heal', pw: 12, r: 3.5, max: 6, cd: 12, desc: '押している間（最大6秒）、周り3.5mの味方を0.5秒ごとに少し回復。維持中はほかの技・アイテムを使えず、歩きはゆっくり' }),
    '呪いの陣': () => ({ kind: 'zone', side: 'enemy', stats: ['str', 'yo', 'def', 'spd'], mul: 0.85, r: 3.5, max: 6, cd: 12, desc: '押している間（最大6秒）、周り3.5mの敵のちから・ようりょく・まもり・はやさ×0.85。維持中はほかの技・アイテムを使えず、歩きはゆっくり' }),
    '回避': () => Object.assign({}, S0.dodge, { desc: '押した方向へすばやく移動して攻撃をかわす（一瞬無敵）' }),
  };
  const SHORT = { 'チャージこうげき': 'ため打', 'チャージショット': 'ため撃', '火炎の術': '火炎', 'いかずちの術': '雷', '氷結の術': '氷結', '竜巻の術': '竜巻', 'つむじ風の術': 'つむじ', '吸収の術': '吸収', '暗黒の術': '暗黒', '超・毒とりつき': '毒', '神速アタック': '神速', '隠密の術': '隠密', 'カウンター': '反撃', '疾風ステップ': '疾風', 'こんしんの一撃': '渾身', '気合の一発': '気合', '麻痺の術': '麻痺', '超麻痺の術': '超麻痺', '超・シールド': '盾', '無敵': '無敵', 'ガード': 'ガード', '鉄壁ガード': '鉄壁', '反射ガード': '反射', '誘い打ち': '誘い', '地雷': '地雷', '超地雷の術': '超地雷', '回復の術': '回復', '極楽の術': '極楽', '円陣回復の術': '円陣', '回復とりつき': '継続回', '超・回復とりつき': '超継続', '超・こうげきアップ': '攻撃↑', '全強化とりつき': '全強化', '超・まもりダウン': '守り↓', '超・はやさダウン': '速さ↓', '全弱体とりつき': '全弱体', '超・よろい砕き': '鎧砕き', '超・刀狩り': '刀狩り', '武神の陣': '武神陣', '回復の陣': '回復陣', '呪いの陣': '呪い陣', '回避': '回避' };
  const ATK = { '三段こうげき': ['combo3', [30, 30, 60], '三連：Aを続けて押すと最大3連撃（威力30→30→60）'], 'こうげき': ['melee1n', [50], '近くの敵を叩く（近接・威力50）'], 'ビームショット': ['shotn', [35], '前へ光線を撃つ（射撃・威力35・射程約8m）'], 'ロケットパンチ': ['shotn', [70], '拳を飛ばして離れた敵を攻撃（射撃・威力70・射程約8m）'] };
  const PSV = { 'ためが速い': ['fastCharge', 'ためが速い（ため時間×0.7）'], 'ガード効果が高い': ['guardPlus', 'ガード中の被ダメージがさらに減る'], 'ピンチの仲間への回復が増える': ['healLow', 'HP30%未満の仲間への回復×1.3'], 'ガード中にHPが回復': ['guardRegen', 'ガード中、毎秒最大HPの2%回復'], '氷属性が付く': ['elIce', '通常攻撃などが氷属性'], '火属性が付く': ['elFire', '通常攻撃などが火属性'], 'HPを吸収': ['lifesteal', '通常攻撃で与えたダメージの1割を回復'] };
  const AI_OF = (role, A) => role === 'healer' ? 'healer' : role === 'tank' ? 'tank' : A === 'shotn' || A === 'shot' ? 'ranged' : 'melee';
  const LABEL = { attacker: 'アタッカー', healer: 'ヒーラー', ranger: 'レンジャー', tank: 'タンク' };
  for (const id in ROSTER_V7) {
    const v = ROSTER_V7[id], c = D.CHI[id]; if (!c) continue;
    const [aKind, aPw, aDesc] = ATK[v.A[1]];
    // 既存10体の通常攻撃は、同じ種類ならいままでの時間（melee1／shot）を使う
    c.A = !c.isNew && aKind === 'melee1n' && c.A === 'melee1' ? 'melee1' : !c.isNew && aKind === 'shotn' && c.A === 'shot' ? 'shot' : aKind;
    c.Apw = aPw.slice(); c.Anm = v.A[0]; c.Adesc = aDesc;
    const shortOf = nm => { const t = nm.includes('・') ? nm.split('・').pop() : nm; return t.length > 4 ? t.slice(0, 4) : t; };
    const mk = (k, mv) => { const f = tpl[mv[1]]; if (!f) throw new Error('技の型がない: ' + mv[1]); const sid = `${id}_${k}7`; D.SKILLS[sid] = Object.assign(f(), { nm: mv[0], short: shortOf(mv[0]), type: mv[1] }); return sid; };
    c.X = mk('X', v.X); c.Y = mk('Y', v.Y);
    c.fx = Object.assign({}, c.fx || {}, { X: D.SKILLS[c.X].desc, Y: D.SKILLS[c.Y].desc });
    if (!c.fx.SP) c.fx.SP = null;
    // 名前・見た目（v7 確定仕様）。モデルは render_v7.js が見た目の文から作る
    c.nm = v.nm; c.yomi = v.yomi; c.motif = v.motif; c.blurb = v.look; c.form = v.look; c.shape = v.shape;
    c.roleId = v.role; c.base = v.base.slice(); c.hp = v.base[0]; c.str = v.base[1]; c.yo = v.base[2]; c.def = v.base[3];
    c.ai = AI_OF(v.role, c.A);
    c.role = LABEL[v.role] + '・' + [v.A[1] === '三段こうげき' ? '三連' : c.A.startsWith('shot') ? '射撃' : '近接', SHORT[v.X[1]], SHORT[v.Y[1]]].join('・');
    c.tags = [c.A.startsWith('shot') ? '遠距離' : '近接', SHORT[v.X[1]], SHORT[v.Y[1]]];
    c.passive = c.isNew ? null : c.passive; c.psv = c.isNew ? '固有の特性はなし' : c.psv;
    for (const note of [v.A[3], v.X[3], v.Y[3]]) {
      if (!note) continue;
      if (/投射体/.test(note)) { c.proj = 'stone'; continue; } // 射撃の弾は自分の部品（石片・籠手）の形
      const hit = Object.keys(PSV).find(k => note.includes(k)); if (!hit) continue;
      const [pid, txt] = PSV[hit]; if (pid === 'elIce') c.el = '氷'; else if (pid === 'elFire') c.el = '火'; else c.passive = pid; c.psv = txt;
    }
    c.v7 = true;
    // 必殺（確定仕様に記載がないため本作の独自設定）：役職と技の性質から決め、名前は技の頭の語＋型
    const pre = v.A[0].split('・')[0], tier = { D: 0, C: 1, B: 2, A: 3, S: 4 }[c.rank] || 0;
    if (!c.isNew) { c.spNm = pre + '・' + ({ multi: (D.SPECIALS[c.sp].n || 1) > 1 ? (D.SPECIALS[c.sp].n + '連') : '一閃', buff: '大号令', guardup: '不動の構え', heal: '大癒やし' }[D.SPECIALS[c.sp].type] || '奥義'); continue; }
    const yoX = ['火炎の術', 'いかずちの術', '氷結の術', '竜巻の術', 'つむじ風の術', '吸収の術', '暗黒の術'].includes(v.X[1]);
    const debuffer = [v.X[1], v.Y[1]].some(k => /ダウン|弱体|呪い|刀狩り|よろい砕き/.test(k));
    const sp = { prep: 0.65, iv: 0.16, tail: 0.40, end: 1.20 }; let nm, fx;
    if (v.role === 'healer') { Object.assign(sp, { type: 'heal', pw: 220 + 20 * tier, r: 6, revive: false, cleanse: true }); nm = '大癒やし'; fx = `半径6mの味方を回復（係数${sp.pw}）し、悪いとりつきを解く。気絶は蘇生しない`; }
    else if (v.role === 'tank') { Object.assign(sp, { type: 'guardup', mul: 1.6, dur: 8, threat: 1200 }); nm = '不動の構え'; fx = '8秒、自分のまもり×1.6。周りの敵の注意を集める'; }
    else if (v.role === 'ranger' && debuffer) { const mul = +(0.85 - 0.025 * tier).toFixed(3); Object.assign(sp, { type: 'debuff', stats: ['str', 'yo', 'def', 'spd'], mul, dur: 8, r: 5 }); nm = '大弱め'; fx = `半径5mの敵のちから・ようりょく・まもり・はやさ×${mul}（8秒）`; }
    else if (v.role === 'ranger') { const mul = +(1.1 + 0.01 * tier).toFixed(2); Object.assign(sp, { type: 'buff', stats: ['str', 'yo', 'def', 'spd'], mul, dur: 12, r: 6 }); nm = '大号令'; fx = `半径6mの味方のちから・ようりょく・まもり・はやさ×${mul}（12秒）`; }
    else if (c.A.startsWith('shot')) { Object.assign(sp, { type: 'multi', n: 8, pw: 45 + 2 * tier, shape: 'line', len: 12, w: 1.6, stat: 'str', fx: 'beam' }); nm = '八条'; fx = `前へまっすぐ8回（ちから・威力${sp.pw}）`; }
    else if (yoX) { Object.assign(sp, { type: 'multi', n: 8, pw: 40 + 2 * tier, shape: 'fan', range: 5, arc: 0.8, stat: 'yo', fx: 'wind' }); nm = '八重'; fx = `前方5mへ妖術8回（ようりょく・威力${sp.pw}）`; }
    else { Object.assign(sp, { type: 'multi', n: 10, pw: 30 + 2 * tier, shape: 'fan', range: 1.8, arc: 1.3, stat: 'str', fx: 'melee' }); nm = '十連'; fx = `目の前へ10回の連打（ちから・威力${sp.pw}）`; }
    sp.nm = pre + '・' + nm; D.SPECIALS[id + '_SP7'] = sp; c.sp = id + '_SP7'; c.spNm = sp.nm; c.fx.SP = fx;
  }
})();
const CHAR_IDS = DATA.CHARS.map(c => c.id);
const NEW_D_IDS = ROSTER_NEW.filter(n => n.rank === 'D').map(n => n.id);
const GACHA_IDS = ROSTER_NEW.map(n => n.id); // v7：追加50体すべて
/** 上野ボス（推奨Lv40）・秋葉原（推奨Lv60）だけのLv補正。P＝出動開始時の4体の平均Lv（切り捨て）。途中の操作交代では変えない */
/** ステージごとのLv補正の基準（v6：秋葉原ホーム50・駅前広場60・ヨシノシン40）。推奨Lvの表示も同じ値を使う */
const LV_BASE = { ueno: 40, akiba_platform: 50, akiba_plaza: 60, akiba: 60 };
/** kind：ステージID（ueno / akiba_platform / akiba_plaza）。係数・上下限は上野用と秋葉原用の2種類 */
function lvAdjust(kind, P) {
  const ak = String(kind).startsWith('akiba'), rec = LV_BASE[kind] || (ak ? 60 : 40);
  const R = ak ? { rec, upO: 0.015, hiO: 1.30, upI: 0.01, loI: 0.75 } : { rec, upO: 0.02, hiO: 1.25, upI: 0.015, loI: 0.80 };
  if (P < R.rec) return { out: Math.max(0.10, Math.pow(0.95, R.rec - P)), in: Math.min(4.0, Math.pow(1.04, R.rec - P)) };
  return { out: Math.min(R.hiO, 1 + R.upO * (P - R.rec)), in: Math.max(R.loI, 1 - R.upI * (P - R.rec)) };
}
Object.assign(DATA, { lvAdjust, LV_BASE, EQUIP, EQUIP_I, GAME, RANKS, RANK_INFO, ROLES, ROLE_IDS, GROWTH, REWARD, TICKET, GACHA, CHAR_IDS, NEW_D_IDS, GACHA_IDS, EXP_CUM });
