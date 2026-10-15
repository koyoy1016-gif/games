/* =====================================================================
   data.js — 戦闘データ（three.js 非依存）
   すべての調整値は p() で登録し、値・単位・状態・出典を一覧画面に出す。
   状態: doc=reference_documented / approx=reference_approximate /
         meas=measured / proto=prototype（新作の仮値）
   ===================================================================== */
const REFS = {
  1: 'https://www.youkai-watch.jp/busters/about/',
  2: 'https://www.youkai-watch.jp/busters/game/game07.html',
  3: 'https://spwiki.net/ywbusters/wikis/104.html',
  6: 'https://busters.g-takumi.com/movie9.html',
  9: 'https://developer.apple.com/jp/videos/play/meet-with-apple/243/',
  10: 'https://developer.android.com/develop/ui/compose/accessibility/api-defaults',
  13: 'https://togenyanweb.appspot.com/Yokai/ywb/yokaiList_alt.html',
  14: 'https://busters.g-takumi.com/bigboss439.html',
  15: 'https://youkai.gamepedia.jp/busters/monsters/710',
  16: 'https://youkai.gamepedia.jp/busters/monsters/900',
  17: 'https://youkai.gamepedia.jp/busters/monsters/769',
  18: 'https://youkai.gamepedia.jp/busters/monsters/495',
  19: 'https://youkai.gamepedia.jp/busters/monsters/787',
  20: 'https://youkai.gamepedia.jp/busters/monsters/781',
  21: 'https://youkai.gamepedia.jp/busters/monsters/699',
  22: 'https://youkai.gamepedia.jp/busters/monsters/636',
  23: 'https://youkai.gamepedia.jp/busters/monsters/429',
  24: 'https://youkai.gamepedia.jp/busters/monsters/501',
  25: 'https://youkaiwatch2.blog.jp/archives/37582229.html',
  26: 'https://gameobera.blog.jp/archives/40874500.html',
  27: 'https://busters.g-takumi.com/attack2.html',
  28: 'https://youkai.gamepedia.jp/busters/archives/1107',
};
const STATUS_LABEL = { doc: '資料で確認', approx: '資料の目安', meas: '実測', proto: '新作の仮値' };
const REG = [];
/** 値を登録して生の値を返す。group=一覧の見出し, hidden=画面に数値を出さない */
function p(group, label, v, unit, status, src, notes, hidden) {
  REG.push({ group, label, v, unit, status, src: src || null, notes: notes || '', hidden: !!hidden });
  return v;
}
const PROFILE = 'prototype_playable';

/* ---------------- シミュレーション全体 ---------------- */
const SIM = {
  hz: p('全体', '固定シミュレーション周期', 60, 'Hz', 'proto', null, '原作が60fpsだったという意味ではない。描画fpsとは分離'),
  timeLimit: p('全体', 'ミッション制限時間', 20 * 60, 'seconds', 'proto'),
  walk: p('移動', '歩行速度', 4.0, 'm/s', 'proto', null, '原作の速度ではない'),
  dash: p('移動', 'Bダッシュ速度', 6.0, 'm/s', 'proto', 6, 'Bダッシュの存在は資料[6]。速度は仮値'),
  stamMax: p('移動', 'スタミナ最大', 100, 'points', 'proto'),
  stamDrain: p('移動', 'ダッシュ中のスタミナ消費', 25, 'points/s', 'proto'),
  stamRegen: p('移動', 'スタミナ回復（歩行・停止時）', 20, 'points/s', 'proto'),
  stamRedash: p('移動', '息切れ後に再ダッシュできる量', 30, 'points', 'proto'),
  chargeMoveMul: p('移動', 'ため中の移動速度倍率', 0.5, 'ratio', 'proto'),
  inputBuffer: p('入力', '技の入力バッファ', 0.10, 'seconds', 'proto'),
  reviveTime: p('救助', '通常の救助所要時間', 3.0, 'seconds', 'proto', null, '原作の秒数とはしない'),
  reviveTimeMomiji: p('救助', 'モミジ翁の救助所要時間', 2.0, 'seconds', 'proto', 24, 'パッシブの存在は資料、秒数は仮値'),
  reviveRange: p('救助', '救助できる距離', 1.6, 'm', 'proto'),
  ascendTime: p('救助', '気絶から昇天まで', 30, 'seconds', 'proto', 2, '気絶と昇天の区別は資料。秒数は仮値'),
  reviveHp: p('救助', '救助後のHP割合', 0.25, 'ratio', 'proto'),
  reviveHpMomiji: p('救助', 'モミジ翁が救助したときのHP割合', 0.5, 'ratio', 'proto', 24),
  critRate: p('ダメージ', '通常の会心率', 0.05, 'ratio', 'proto'),
  critMul: p('ダメージ', '通常の会心倍率', 1.5, 'ratio', 'proto'),
  elemGood: p('ダメージ', '属性有利倍率（ボスの弱点：土）', 1.25, 'ratio', 'proto', null, '弱点の属性は資料準拠、倍率は原作未測定'),
  elemBad: p('ダメージ', '属性不利倍率（ボスが強い：雷）', 0.8, 'ratio', 'proto'),
  defBase: p('ダメージ', '仮ダメージ式の防御定数', 120, 'points', 'proto', null, 'max(1, round(power×攻撃能力/(120+まもり)×属性×状態×会心))'),
  guardMul: p('防御', 'ガード中の被ダメージ倍率', 0.5, 'ratio', 'proto'),
  spA: p('必殺ゲージ', '通常攻撃の命中', 4, 'points', 'proto', 2, '攻撃・被弾でたまることは資料。量は仮値'),
  spSkill: p('必殺ゲージ', 'X/Y攻撃の命中（1発）', 3, 'points', 'proto'),
  spSkillCap: p('必殺ゲージ', 'X/Y攻撃1回あたりの上限', 12, 'points', 'proto'),
  spHurt: p('必殺ゲージ', '実ダメージのある被弾', 2, 'points', 'proto'),
  spHeal: p('必殺ゲージ', '回復が成立した回復技', 8, 'points', 'proto'),
  threatDecay: p('敵視', '敵視の減衰', 0.05, 'ratio/s', 'proto'),
  lanternWindow: p('灯籠', '4基を灯す制限時間', 30, 'seconds', 'approx', 6, '攻略資料の「30秒以内」に合わせた'),
  lanternDown: p('灯籠', 'ボスの停止時間', 6, 'seconds', 'proto'),
  lanternRearm: p('灯籠', '再び灯せるまで', 30, 'seconds', 'proto'),
  lanternHold: p('灯籠', '灯すためにBを押す時間', 0.4, 'seconds', 'proto'),
  itemMax: p('アイテム', '1枠に持てる数', 3, 'count', 'proto'),
  itemStart: p('アイテム', '持ち込み数（各枠）', 2, 'count', 'proto', 2, '2枠は資料、数は仮値'),
  foodHeal: p('パッシブ', 'ブリキドンの食べ物の回復量', 0.10, 'ratio(最大HP)', 'proto', 21, '30秒ごとの生成は資料'),
  foodPeriod: p('パッシブ', 'ブリキドンの食べ物生成周期', 30, 'seconds', 'doc', 21),
  hitStagger: p('被弾', '重い攻撃でのけぞる時間', 0.45, 'seconds', 'proto'),
};

/* ---------------- 難易度・ボス ---------------- */
const DIFF = {
  normal: { nm: '通常', str: p('ボス', '通常：ちから', 240, 'points', 'doc', 13), yo: p('ボス', '通常：ようりょく', 270, 'points', 'doc', 13), def: p('ボス', '通常：まもり', 108, 'points', 'doc', 13, '通常/超/極の対応はドロップ素材資料[14]との照合（公式公表値ではない）'), hp: p('ボス', '通常：体力', 20000, 'points', 'proto', null, '数値は画面に出さない', true), mobHp: 300 },
  hard: { nm: '超', str: p('ボス', '超：ちから', 440, 'points', 'doc', 13), yo: p('ボス', '超：ようりょく', 500, 'points', 'doc', 13), def: p('ボス', '超：まもり', 141, 'points', 'doc', 13), hp: p('ボス', '超：体力', 32000, 'points', 'proto', null, '', true), mobHp: 480 },
  extreme: { nm: '極', str: p('ボス', '極：ちから', 1100, 'points', 'doc', 13), yo: p('ボス', '極：ようりょく', 1280, 'points', 'doc', 13), def: p('ボス', '極：まもり', 169, 'points', 'doc', 13), hp: p('ボス', '極：体力', 48000, 'points', 'proto', null, '', true), mobHp: 720 },
};
const BOSS = {
  nm: 'トバトーバン',
  height: p('体格', 'トバトーバンの高さ（基準味方=1）', 5.0, 'units', 'proto', null, '新作の設計値。原作モデルの実測ではない'),
  shoulder: p('体格', 'ボスの肩幅', 2.8, 'units', 'proto'),
  footWidth: p('体格', 'ボスの接地幅', 2.2, 'units', 'proto'),
  bodyR: 1.25, hurtR: 1.9, walk: 1.6, turn: 1.4,
  weak: '土', strong: '雷',
  gapMin: p('ボス行動', '後隙後に次の技を選ぶまで（最小）', 0.7, 'seconds', 'proto'),
  gapMax: p('ボス行動', '後隙後に次の技を選ぶまで（最大）', 1.1, 'seconds', 'proto'),
  introT: p('ボス行動', '登場演出の全体尺', 4.5, 'seconds', 'proto', null, 'オリジナル演出'),
  phase2: p('ボス行動', '終盤段階へ移るHP割合', 1 / 3, 'ratio', 'doc', 6, 'HP約1/3以下で横切る飛行が3回'),
  flyHittable: false,
};
// ボス技：wind=予兆/準備, act=攻撃期間, iv=同一対象への間隔, max=最大ヒット, rec=後隙, cd=最短再使用
const BMOVES = {
  fubuki: { nm: '大売出し札吹雪', ref: 'ツインガトリング砲', wind: p('ボス技', '札吹雪：予兆', 0.65, 's', 'proto'), act: p('ボス技', '札吹雪：攻撃期間', 1.0, 's', 'proto'), iv: p('ボス技', '札吹雪：同一対象への間隔', 0.20, 's', 'proto'), max: p('ボス技', '札吹雪：最大ヒット', 5, 'hits', 'proto'), rec: p('ボス技', '札吹雪：後隙', 0.55, 's', 'proto'), cd: p('ボス技', '札吹雪：再使用制限', 6, 's', 'proto'), pw: p('ボス技', '札吹雪：仮威力', 12, 'power', 'proto', null, '原作の技威力ではない'), stat: 'str', r: 10, fanYaw: 0.56, fanHalf: 0.33 },
  shime: { nm: 'しめ縄ぶん回し', ref: '猫又ドリル', wind: p('ボス技', 'しめ縄：予兆', 0.55, 's', 'proto'), act: p('ボス技', 'しめ縄：攻撃期間', 0.8, 's', 'proto'), iv: 0.20, max: p('ボス技', 'しめ縄：最大ヒット', 4, 'hits', 'proto'), rec: p('ボス技', 'しめ縄：後隙', 0.65, 's', 'proto'), cd: p('ボス技', 'しめ縄：再使用制限', 7, 's', 'proto'), pw: p('ボス技', 'しめ縄：仮威力', 16, 'power', 'proto'), stat: 'str', r: 7.5, half: 1.15 },
  otoshi: { nm: '提灯おとし', ref: '腹巻ミサイル', wind: p('ボス技', '提灯おとし：予兆', 1.0, 's', 'proto'), act: 0.12, rec: p('ボス技', '提灯おとし：後隙', 0.65, 's', 'proto'), cd: p('ボス技', '提灯おとし：再使用制限', 9, 's', 'proto'), pw: p('ボス技', '提灯おとし：仮威力', 70, 'power', 'proto'), stat: 'yo', r: 2.3 },
  kousen: { nm: '招福看板光線', ref: 'デストロイビーム', wind: p('ボス技', '看板光線：予兆', 0.85, 's', 'proto'), act: p('ボス技', '看板光線：照射期間', 1.2, 's', 'proto'), iv: p('ボス技', '看板光線：同一対象への間隔', 0.30, 's', 'proto'), max: p('ボス技', '看板光線：最大ヒット', 4, 'hits', 'proto'), rec: p('ボス技', '看板光線：後隙', 0.8, 's', 'proto'), cd: p('ボス技', '看板光線：再使用制限', 10, 's', 'proto'), pw: p('ボス技', '看板光線：仮威力', 70, 'power', 'proto'), stat: 'yo', len: 24, w: 2.8 },
  harite: { nm: '商売繁盛張り手', ref: '電動ネコパンチ', wind: p('ボス技', '張り手：予兆', 0.45, 's', 'proto'), act: p('ボス技', '張り手：判定', 0.15, 's', 'proto'), rec: p('ボス技', '張り手：後隙', 0.9, 's', 'proto'), cd: p('ボス技', '張り手：再使用制限', 5, 's', 'proto'), pw: p('ボス技', '張り手：仮威力', 140, 'power', 'proto'), stat: 'str', len: 4.8, w: 3.4 },
  junkou: { nm: '千住大巡行', ref: '超電動Zデンジャー', wind: p('ボス技', '大巡行：予兆', 1.1, 's', 'proto'), cross: p('ボス技', '大巡行：1回の横断', 1.2, 's', 'proto'), gap: p('ボス技', '大巡行：横断の間', 0.6, 's', 'proto'), n1: p('ボス技', '大巡行：前半の横断回数', 1, 'count', 'proto'), n2: p('ボス技', '大巡行：終盤の横断回数', 3, 'count', 'doc', 6, '1往復半＝計3横断'), rec: p('ボス技', '大巡行：最終着地後の後隙', 1.5, 's', 'proto'), cd: p('ボス技', '大巡行：再使用制限', 22, 's', 'proto'), pw: p('ボス技', '大巡行：接触の仮威力', 140, 'power', 'proto'), bombPw: p('ボス技', '大巡行：落下提灯の仮威力', 70, 'power', 'proto'), bombR: 2.0, bombFall: 0.9, bombEvery: 0.24, contactR: 2.0, stat: 'str' },
  zouen: { nm: '呼び込み札小僧', ref: 'ロボニャンの増援', wind: p('ボス技', '増援：予兆', 0.8, 's', 'proto'), rec: p('ボス技', '増援：後隙', 0.5, 's', 'proto'), cd: p('ボス技', '増援：再使用制限', 25, 's', 'proto'), max: p('ボス技', '増援：同時存在上限', 2, 'count', 'doc', 6) },
};
const MOB = {
  nm: '札小僧',
  height: p('体格', '札小僧の高さ', 0.85, 'units', 'proto'),
  str: p('札小僧', 'ちから', 80, 'points', 'proto', null, '原作の小型ロボニャンの能力を確定した値ではない'),
  yo: p('札小僧', 'ようりょく', 60, 'points', 'proto'),
  def: p('札小僧', 'まもり', 60, 'points', 'proto'),
  shotPw: p('札小僧', '遠隔攻撃の仮威力', 35, 'power', 'proto'),
  shotPeriod: p('札小僧', '発射周期', 1.5, 's', 'proto'),
  shotSpeed: 9, speed: 2.6, r: 0.45,
};

/* ---------------- 攻撃（A/X/Y/必殺） ---------------- */
// kind: combo3 / melee1 / shot / charge / dodge / retreat / dot / stealth / parry / heavy / trap / protect / guard / taunt / mine / heal / healRing
const MOVES = {
  combo3: { kind: 'combo3', nm: '三連', hits: [p('攻撃', '三連：1発目', 0.15, 's', 'proto'), p('攻撃', '三連：2発目（入力時）', 0.45, 's', 'proto'), p('攻撃', '三連：3発目（入力時）', 0.85, 's', 'proto')], end: p('攻撃', '三連：最後の硬直終了', 1.15, 's', 'proto'), range: 1.5, arc: 1.25 },
  melee1: { kind: 'melee1', nm: '近接打撃', start: p('攻撃', '単発近接：発生', 0.18, 's', 'proto'), active: p('攻撃', '単発近接：攻撃判定', 0.10, 's', 'proto'), end: p('攻撃', '単発近接：最短周期', 0.50, 's', 'proto'), range: 1.5, arc: 1.2 },
  shot: { kind: 'shot', nm: '射撃', fire: 0.10, end: p('攻撃', '通常射撃：最短周期', 0.50, 's', 'proto'), lock: 0.25, speed: 18, life: 0.85, r: 0.35 },
};
const CHARGE = {
  max: p('ため', '最大ため', 1.0, 's', 'proto'),
  start: p('ため', '離してから発生', 0.15, 's', 'proto'),
  rec: p('ため', '後隙', 0.35, 's', 'proto'),
  cd: p('ため', '再使用', 7, 's', 'proto'),
  mul: p('ため', '最大威力倍率', 2.5, 'ratio', 'proto'),
};
const DODGE = {
  iv0: p('回避', '無敵開始', 0.10, 's', 'proto'), iv1: p('回避', '無敵終了', 0.32, 's', 'proto'),
  end: p('回避', '動作終了', 0.45, 's', 'proto'), cd: p('回避', '再使用', 3, 's', 'proto'), dist: p('回避', '移動距離', 2.4, 'm', 'proto'), moveT: 0.30,
  kogePlus: p('パッシブ', 'コゲマル：回避無敵の延長', 0.08, 's', 'proto', 15, '「回避を成功させやすい」効果の仮値'),
};
const RETREAT = { hit: p('後退攻撃', '発生', 0.12, 's', 'proto'), dist: p('後退攻撃', '後退距離', 2.0, 'm', 'proto'), end: p('後退攻撃', '動作終了', 0.55, 's', 'proto'), iv0: 0.10, iv1: p('後退攻撃', '無敵終了', 0.35, 's', 'proto'), cd: p('後退攻撃', '再使用', 5, 's', 'proto') };
const SKILLS = {
  kogeShou: { kind: 'charge', nm: 'ため掌', short: 'ため掌', pw: 80, stat: 'str', form: 'melee', range: 1.8, arc: 1.1, attack: true },
  hoshiShot: { kind: 'charge', nm: '集光ショット', short: '集光', pw: 50, stat: 'str', form: 'shot', speed: 22, attack: true },
  akaneFire: { kind: 'charge', nm: '茜火', short: '茜火', pw: 50, stat: 'yo', form: 'blast', speed: 14, blastR: 1.6, attack: true },
  dodge: { kind: 'dodge', nm: '回避', short: '回避' },
  kogetsuki: { kind: 'dot', nm: '焦げつき印', short: '焦印', pw: p('継続ダメージ', '1回の仮威力', 18, 'power', 'proto'), stat: 'yo', tick: p('継続ダメージ', '間隔', 1, 's', 'proto'), dur: p('継続ダメージ', '継続', 10, 's', 'proto'), cd: p('継続ダメージ', '再使用', 12, 's', 'proto'), speed: 16, attack: true },
  kaeshiBane: { kind: 'retreat', nm: '返し羽', short: '返し羽', pw: 70, stat: 'str', attack: true },
  kageKakure: { kind: 'stealth', nm: '影隠れ', short: '影隠れ', dur: p('隠密', '持続', 8, 's', 'proto'), cd: p('隠密', '再使用', 20, 's', 'proto') },
  ukenagashi: { kind: 'parry', nm: '受け流し', short: '受流し', win: p('受け流し', '受付', 1.0, 's', 'proto'), cd: p('受け流し', '再使用', 7, 's', 'proto'), pw: p('受け流し', '反撃の仮威力', 150, 'power', 'proto'), stat: 'str', attack: true },
  hikiGiri: { kind: 'retreat', nm: '退き斬り', short: '退き斬', pw: 70, stat: 'str', attack: true },
  konshin: { kind: 'heavy', nm: '渾身太鼓打ち', short: '渾身', pw: 400, stat: 'str', start: p('渾身の一撃', '発生', 1.10, 's', 'proto'), active: p('渾身の一撃', '判定', 0.15, 's', 'proto'), rec: p('渾身の一撃', '後隙', 0.65, 's', 'proto'), cd: p('渾身の一撃', '再使用', 10, 's', 'proto'), range: 2.1, arc: 1.2, attack: true },
  shibire: { kind: 'trap', nm: 'しびれ囃子', short: 'しびれ', arm: p('麻痺のワナ', '作動可能まで', 0.8, 's', 'proto'), para: p('麻痺のワナ', '麻痺時間', 3, 's', 'proto'), cd: p('麻痺のワナ', '再使用', 15, 's', 'proto'), life: 20, r: 1.3, bossMul: p('麻痺のワナ', 'ボスへの麻痺時間倍率', 0.5, 'ratio', 'proto'), bossImmune: p('麻痺のワナ', 'ボスの麻痺耐性時間', 15, 's', 'proto') },
  daihigo: { kind: 'protect', nm: '大庇護', short: '大庇護', r: p('大庇護', '範囲', 3, 'm', 'proto'), inv: p('大庇護', '無敵時間', 0.45, 's', 'proto'), cd: p('大庇護', '再使用', 15, 's', 'proto') },
  guard: { kind: 'guard', nm: 'ガード', short: 'ガード', max: p('ガード', '最大持続', 8, 's', 'approx', 25, '当時の目安'), refill: p('ガード', '空からの再充填', 20, 's', 'approx', 25), threshold: p('ガード', '再使用できるゲージ量', 0.15, 'ratio', 'proto', null, '少しでも使うと20秒使えない仕様にはしない'), mul: SIM.guardMul },
  yobikomi: { kind: 'taunt', nm: '呼び込み打ち', short: '呼込み', pw: 80, stat: 'str', threat: p('敵視', '呼び込み打ちの敵視', 300, 'points', 'proto'), cd: p('呼び込み打ち', '再使用', 6, 's', 'proto'), start: 0.22, end: 0.55, range: 1.7, arc: 1.2, attack: true },
  hansha: { kind: 'guard', nm: '反射暖簾', short: '反射', max: p('反射ガード', '最大持続', 6, 's', 'proto'), refill: p('反射ガード', '使い切って再使用まで', 20, 's', 'proto'), threshold: 0.15, mul: SIM.guardMul, reflect: p('反射ガード', '反射率', 0.3, 'ratio', 'proto', null, '原作未確認の独立係数') },
  suiKemuri: { kind: 'charge', nm: '吸い煙', short: '吸い煙', pw: 30, stat: 'yo', form: 'drain', range: 3.2, arc: 0.9, drain: p('吸収', '吸収率', 0.5, 'ratio', 'proto'), attack: true },
  okiKayaku: { kind: 'mine', nm: '置き火薬', short: '火薬', pw: 600, stat: 'mix', arm: p('地雷', '作動可能まで', 1.0, 's', 'proto'), cd: p('地雷', '再使用', 12, 's', 'proto'), trig: 1.2, r: 2.4, allyMul: p('地雷', '味方が巻き込まれたときの倍率', 0.3, 'ratio', 'proto', null, '敵味方どちらでも起爆'), life: 30, attack: true },
  megumi: { kind: 'heal', nm: '恵みの葉', short: '恵み', pw: 80, max: p('回復技', '最大ため', 1.3, 's', 'approx', 26, '同名技の攻略記事の目安'), cd: p('回復技', '再使用', 9, 's', 'approx', 26), mul: p('回復技', 'ため最大の回復倍率', 2.0, 'ratio', 'proto'), range: 14 },
  kaedeWa: { kind: 'healRing', nm: '楓の輪', short: '楓の輪', pw: 80, max: 1.3, cd: 9, r0: p('回復技', '楓の輪：最小範囲', 3, 'm', 'proto'), r1: p('回復技', '楓の輪：最大範囲', 6, 'm', 'proto') },
};
const SPECIALS = {
  hits10: { nm: '十連', type: 'multi', n: 10, pw: 40, prep: p('必殺', '40×10型：準備', 0.35, 's', 'proto'), iv: p('必殺', '40×10型：間隔', 0.12, 's', 'proto'), tail: p('必殺', '40×10型：終了まで', 0.35, 's', 'proto'), shape: 'fan', range: 2.4, arc: 1.3 },
  hits8: { nm: '八連光', type: 'multi', n: 8, pw: 60, prep: p('必殺', '60×8型：準備', 0.45, 's', 'proto'), iv: p('必殺', '60×8型：間隔', 0.16, 's', 'proto'), tail: 0.35, shape: 'line', len: 15, w: 1.8 },
  hits4: { nm: '四重陣', type: 'multi', n: 4, pw: 100, prep: p('必殺', '100×4型：準備', 0.50, 's', 'proto'), iv: p('必殺', '100×4型：間隔', 0.25, 's', 'proto'), tail: p('必殺', '100×4型：終了まで', 0.40, 's', 'proto'), shape: 'fan', range: 7.5, arc: 0.95 },
  one400: { nm: '一閃', type: 'multi', n: 1, pw: 400, prep: p('必殺', '400単発型：準備', 0.80, 's', 'proto'), iv: 0, tail: p('必殺', '400単発型：後隙', 0.65, 's', 'proto'), shape: 'line', len: 6, w: 2.8 },
  weaken: { nm: '弱体', type: 'multi', n: 1, pw: 250, prep: p('必殺', '250＋弱体型：準備', 0.50, 's', 'proto'), iv: 0, tail: 0.45, shape: 'fan', range: 6.5, arc: 0.8, defDown: p('必殺', '守り低下の倍率', 0.7, 'ratio', 'proto'), defDownT: p('必殺', '守り低下の時間', 15, 's', 'proto') },
  buff: { nm: '強化', type: 'buff', prep: p('必殺', '強化型：準備', 0.45, 's', 'proto'), end: p('必殺', '強化型：動作', 0.90, 's', 'proto'), dur: p('必殺', '味方強化の時間', 15, 's', 'proto'), mul: p('必殺', 'ちから強化の倍率', 1.25, 'ratio', 'proto'), r: 10 },
  guardup: { nm: '自己防御', type: 'guardup', prep: 0.45, end: 0.90, dur: p('必殺', '自己防御の時間', 8, 's', 'proto'), mul: p('必殺', '守り強化の倍率', 1.6, 'ratio', 'proto'), threat: 1200 },
  healall: { nm: '回復蘇生', type: 'heal', prep: p('必殺', '回復・蘇生型：準備', 0.65, 's', 'proto'), end: p('必殺', '回復・蘇生型：動作', 1.20, 's', 'proto'), pw: 400, revHp: p('必殺', '蘇生直後のHP', 0.30, 'ratio', 'proto') },
};
const SP_INVULN = p('必殺', '本人の無敵区間', '発動〜動作終了', '-', 'proto', 8, '必殺中の無敵の存在は非公式記録[8]。区間は全技共通の仮設定');

/* ---------------- 10体 ---------------- */
// col=体の主色, acc=差し色, h=身長(基準味方=1), el=属性（新作の仮割当）
function ch(o) { return o; }
const CHARS = [
  ch({ id: 'kogemaru', nm: 'コゲマル', role: '近接', blurb: '炭の小狸。三連と、ためた掌で押し込む', ref: 'ジバニャン', src: 15, h: 1.0, el: '火', str: 223, yo: 61, def: 124, A: 'combo3', Apw: [30, 30, 60], X: 'kogeShou', Y: 'dodge', sp: 'hits10', spNm: '炭火十連掌', passive: 'dodgePlus', psv: '回避の無敵が少し長い', col: 0x3b3a40, acc: 0xff7a2a, ai: 'melee' }),
  ch({ id: 'hoshisuzume', nm: 'ホシスズメ', role: '射撃', blurb: '真鍮の星灯を持つ雀。離れて撃つ', ref: 'USAピョン', src: 16, h: 0.9, el: '風', str: 229, yo: 81, def: 132, A: 'shot', Apw: [35], X: 'hoshiShot', Y: 'dodge', sp: 'hits8', spNm: '星灯大放射', passive: 'xPower', psv: 'X技の威力が上がる', col: 0x9a6a3e, acc: 0xf2c94c, ai: 'ranged' }),
  ch({ id: 'akaneten', nm: 'アカネテン', role: '炎・継続', blurb: '夕焼け色のテン。妖術の炎と焦げつき印', ref: 'キュウビ', src: 17, h: 1.15, el: '火', str: 143, yo: 241, def: 176, A: 'melee1', Apw: [50], X: 'akaneFire', Y: 'kogetsuki', sp: 'hits4', spNm: '紅灯四重陣', passive: 'fullHp', psv: 'HP満タンで攻撃が上がる', col: 0xe8683a, acc: 0xffe0b0, ai: 'mage' }),
  ch({ id: 'kagetsubame', nm: 'カゲツバメ', role: '隠密', blurb: '影をまとう燕。狙われていない間は会心', ref: 'オロチ', src: 18, h: 1.05, el: '風', str: 240, yo: 146, def: 167, A: 'combo3', Apw: [30, 30, 60], X: 'kaeshiBane', Y: 'kageKakure', sp: 'hits10', spNm: '影羽十連', passive: 'stealthCrit', psv: '見つかっていない間の攻撃が必ず会心', col: 0x2a2f55, acc: 0xc9d4ff, ai: 'melee' }),
  ch({ id: 'sayanosuke', nm: 'サヤノスケ', role: '反撃', blurb: '古い刀の鞘の付喪神。受け流して返す', ref: 'くさなぎ', src: 19, h: 1.15, el: '土', str: 246, yo: 144, def: 152, A: 'combo3', Apw: [30, 30, 60], X: 'ukenagashi', Y: 'hikiGiri', sp: 'one400', spNm: '鞘の一閃', passive: 'critPower', psv: '会心の威力が上がる', col: 0x2b1d1a, acc: 0xd8b04a, ai: 'melee' }),
  ch({ id: 'taiko', nm: 'タイコ番長', role: '強打・支援', blurb: '太鼓を背負う小熊。重い一撃と麻痺のワナ', ref: 'ブリー隊長', src: 20, h: 1.25, el: '土', str: 255, yo: 81, def: 158, A: 'melee1', Apw: [50], X: 'konshin', Y: 'shibire', sp: 'buff', spNm: '囃子の大号令', passive: 'partyStr', psv: '味方全員のちからが上がる', col: 0x7b4a2a, acc: 0xd23a3a, ai: 'melee' }),
  ch({ id: 'burikidon', nm: 'ブリキドン', role: '射撃・防御', blurb: 'ブリキ缶の店番人形。ガードで敵を引きつける', ref: 'ロボニャン', src: 21, h: 1.1, el: '雷', str: 191, yo: 112, def: 213, A: 'shot', Apw: [70], X: 'daihigo', Y: 'guard', sp: 'guardup', spNm: '鉄壁店番', passive: 'food', psv: '30秒に一度、回復の食べ物を出す', col: 0xb9c2c9, acc: 0x2f6fb5, ai: 'tank' }),
  ch({ id: 'norenbou', nm: 'ノレン坊', role: '誘導・反射', blurb: '暖簾をまとう付喪神。呼び込んで跳ね返す', ref: 'から傘魔人', src: 22, h: 1.2, el: '水', str: 196, yo: 119, def: 241, A: 'melee1', Apw: [50], X: 'yobikomi', Y: 'hansha', sp: 'guardup', spNm: '暖簾大結界', passive: 'guardPlus', psv: 'ガードの効果が上がる', col: 0x23407a, acc: 0xf4efe2, ai: 'tank' }),
  ch({ id: 'kemuridama', nm: 'ケムリダマ', role: '吸収・地雷', blurb: '小さな煙のやかん。吸い取りと置き火薬', ref: 'ウィスパー', src: 23, h: 0.95, el: '風', str: 83, yo: 215, def: 131, A: 'melee1', Apw: [50], X: 'suiKemuri', Y: 'okiKayaku', sp: 'weaken', spNm: '煙払いの息', passive: 'partyCrit', psv: '味方全員の会心が出やすい', col: 0x8f9aa3, acc: 0xeae6dc, ai: 'mage' }),
  ch({ id: 'momiji', nm: 'モミジ翁', role: '回復・蘇生', blurb: '楓の葉をまとう翁。ためて回復、救助が速い', ref: '花さか爺', src: 24, h: 1.05, el: '土', str: 117, yo: 256, def: 157, A: 'melee1', Apw: [50], X: 'megumi', Y: 'kaedeWa', sp: 'healall', spNm: '楓舞う祝福', passive: 'reviver', psv: '救助が速く、復活時のHPも多い', col: 0xc8452a, acc: 0xf6e6c8, ai: 'healer' }),
];
const CHI = Object.fromEntries(CHARS.map(c => [c.id, c]));
for (const c of CHARS) {
  p('キャラ', c.nm + '：ちから/ようりょく/まもり', `${c.str} / ${c.yo} / ${c.def}`, 'points', 'doc', c.src, 'レベル99・装備なしの公開参考値（個体差あり）。参考:' + c.ref);
  p('キャラ', c.nm + '：身長', c.h, 'units', 'proto', null, '判別しやすさのための値。参考妖怪の身長表ではない');
  c.hp = p('キャラ', c.nm + '：体力', Math.round((700 + c.def * 1.5) / 10) * 10, 'points', 'proto', null, '画面に数値は出さない', true);
}
p('技', '三連通常攻撃の威力', '30 / 30 / 60', 'power', 'doc', 27);
p('技', '必殺 40×10 / 60×8 / 100×4 / 400×1 / 250', '技表のとおり', 'power×hits', 'doc', 15);
const PASSIVE = {
  xPower: p('パッシブ', 'ホシスズメ：X威力', 1.2, 'ratio', 'proto', 16),
  fullHp: p('パッシブ', 'アカネテン：満タン時攻撃', 1.2, 'ratio', 'proto', 17),
  critPower: p('パッシブ', 'サヤノスケ：会心倍率', 2.25, 'ratio', 'proto', 19),
  partyStr: p('パッシブ', 'タイコ番長：味方ちから', 1.1, 'ratio', 'proto', 20),
  guardPlus: p('パッシブ', 'ノレン坊：ガード中の被ダメージ倍率', 0.4, 'ratio', 'proto', 22),
  partyCrit: p('パッシブ', 'ケムリダマ：味方の会心率加算', 0.10, 'ratio', 'proto', 23),
};
const DEFAULT_PARTY = ['kogemaru', 'hoshisuzume', 'burikidon', 'momiji'];
const ELEM_COL = { 火: '#E4572E', 風: '#3FA37C', 土: '#B07A3A', 雷: '#D9B526', 水: '#3A86C8' };
const PCOL = ['#E4572E', '#3F78D6', '#2FA36B', '#C98A12'];

/* ---------------- アイテム ---------------- */
const ITEMS = {
  onigiri: { nm: 'おにぎり', desc: 'HPを回復', heal: p('アイテム', 'おにぎりの回復量', 0.35, 'ratio(最大HP)', 'proto'), use: 0.6, icon: '🍙' },
  ramune: { nm: '元気ラムネ', desc: 'スタミナ満タン＋10秒減らない', dur: 10, use: 0.4, icon: '🥤' },
  shibireFuda: { nm: 'しびれ札', desc: '足元に麻痺のワナ', use: 0.4, icon: '📜' },
  kemuriDama: { nm: '煙玉', desc: '6秒間狙われにくい', dur: 6, use: 0.3, icon: '💨' },
};
const ITEM_IDS = Object.keys(ITEMS);

/* ---------------- 舞台・カメラ・UI ---------------- */
const STAGE = {
  streetHalfW: p('舞台', '探索用の通りの幅（両側のアーケード歩道を含む）', 18.8, 'm', 'proto', 11, '中央の歩行者路は約12.8m。車は入らない。写真をもとに架空に再構成') / 2,
  streetZ0: -66, streetZ1: 0,
  plazaHalfW: p('舞台', '祭り広場（幅）', 40, 'm', 'proto') / 2,
  plazaZ1: p('舞台', '祭り広場（奥行き）', 32, 'm', 'proto'),
  pillarX: 6.4, pillarStep: 5,
  lanterns: [[-15.5, 5], [15.5, 5], [-15.5, 27], [15.5, 27]],
  bossSpawn: [0, 19],
  waves: [[[-3, -44], [3, -46]], [[-5, -24], [0, -22], [5, -25]]],
};
const CAM = {
  camera_pitch_deg: p('カメラ', 'camera_pitch_deg（俯角）', 44, 'deg', 'proto', null, '35〜55度で調整。ボスが遠いときは最大8度浅くする'),
  vertical_fov_deg: p('カメラ', 'vertical_fov_deg（横画面）', 50, 'deg', 'proto'),
  follow_delay_sec: p('カメラ', 'follow_delay_sec', 0.2, 's', 'proto'),
  lookahead_units: p('カメラ', 'lookahead_units', 1.5, 'units', 'proto'),
  boss_frame_weight: p('カメラ', 'boss_frame_weight（注目時）', 0.3, 'ratio', 'proto'),
  landscape_framing: { dist: p('カメラ', 'landscape_framing：距離', 9.0, 'm', 'proto'), feetY: p('カメラ', 'landscape_framing：足元の縦位置', 0.70, 'ratio', 'proto', null, 'ゲーム表示領域の上から（60〜72%の範囲）') },
  portrait_framing: { dist: p('カメラ', 'portrait_framing：距離', 12.5, 'm', 'proto'), fov: p('カメラ', 'portrait_framing：垂直FOV', 68, 'deg', 'proto', null, '縦長で左右が狭くなるぶん広げる'), pitch: 50, feetY: 0.64 },
  pitchMin: 35, pitchMax: 55,
};
const NET = {
  snapHz: p('通信', '状態スナップショット', 15, 'Hz', 'proto', null, '原作のネットワーク周期ではない'),
  inputHz: p('通信', '入力送信', 30, 'Hz', 'proto'),
  interp: p('通信', '補間バッファ', 0.10, 's', 'proto'),
  timeout: p('通信', '無応答で切断とみなす', 6, 's', 'proto'),
};
p('UI', '主要タッチ領域の最小', 48, 'CSS px（≒pt/dp）', 'approx', 10, 'Apple 44pt / Android 48dp の目安より大きく');

const DATA = { REFS, STATUS_LABEL, REG, PROFILE, SIM, DIFF, BOSS, BMOVES, MOB, MOVES, CHARGE, DODGE, RETREAT, SKILLS, SPECIALS, CHARS, CHI, PASSIVE, DEFAULT_PARTY, ELEM_COL, PCOL, ITEMS, ITEM_IDS, STAGE, CAM, NET };
