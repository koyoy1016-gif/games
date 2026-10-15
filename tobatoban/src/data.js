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
const STATUS_LABEL = { doc: '資料で確認', approx: '資料の目安', meas: '実測', proto: '新作の仮値', spec: '制作仕様v3の指定値' };
const REG = [];
/** 値を登録して生の値を返す。group=一覧の見出し, hidden=画面に数値を出さない */
function p(group, label, v, unit, status, src, notes, hidden) {
  REG.push({ group, label, v, unit, status, src: src || null, notes: notes || '', hidden: !!hidden });
  return v;
}
const PROFILE = 'prototype_playable';

/* ---------------- シミュレーション全体 ---------------- */
const SIM = {
  orb: p('G玉', '出現（有効戦闘の間隔）・寿命・半径・速さ・強化時間・倍率', { every: 30, life: 10, r: 0.28, spd: 4, dur: 10, mul: 2 }, 's/s/m/m/s/s/倍', 'spec', null, '壁で反射する無害な球。拾うと10秒だけちから・ようりょく×2（HP・まもり・移動は変えない。重ねず残り時間を10秒へ更新）'),
  hz: p('全体', '固定シミュレーション周期', 60, 'Hz', 'proto', null, '原作が60fpsだったという意味ではない。描画fpsとは分離'),
  timeLimit: p('全体', 'ミッション制限時間', 20 * 60, 'seconds', 'proto'),
  walk: p('移動', '歩行速度', 4.0, 'm/s', 'proto', null, '原作の速度ではない'),
  dash: p('移動', 'Bダッシュ速度', 6.0, 'm/s', 'proto', 6, 'Bダッシュの存在は資料[6]。速度は仮値'),
  stamMax: p('移動', 'スタミナ最大', 100, 'points', 'proto'),
  stamDrain: p('移動', 'ダッシュ中のスタミナ消費', 25, 'points/s', 'proto'),
  stamRegen: p('移動', 'スタミナ回復（歩行・停止時）', 20, 'points/s', 'proto'),
  stamRedash: p('移動', '息切れ後に再ダッシュできる量', 30, 'points', 'proto'),
  autoRunT: p('移動', '自動ダッシュまでの歩き続け時間（人の操作のみ）', 1.0, 's', 'spec'), autoRunDot: 0.8, // 向きの変化が約37度を超えたら数え直す
  chargeMoveMul: p('移動', 'ため中の移動速度倍率', 0.5, 'ratio', 'proto'),
  inputBuffer: p('入力', '技の入力バッファ', 0.10, 'seconds', 'proto'),
  reviveTime: p('救助', '気絶した仲間のまわりの円に入って復活させるまで', 4.0, 'seconds', 'proto', null, 'ボタンは不要。円に誰もいないとゲージはゆっくり減る'),
  reviveTimeMomiji: p('救助', 'モミジ翁が円に入っているときの復活まで', 2.7, 'seconds', 'proto', 24, 'パッシブ「救助が速い」'),
  reviveRange: p('救助', '救助の円の半径', 1.6, 'm', 'proto'),
  reviveDrain: 0.5,
  reviveFaster: p('救助', '円に入っている人数ごとの速さ（かかる時間を減らす割合）', [0, 0, 0.25, 0.5], 'ratio', 'proto', null, '1人は4秒、2人なら25%短く（3秒）、3人なら50%短く（2秒）'),
  ascendTime: p('救助', '気絶から昇天まで', 30, 'seconds', 'proto', 2, '気絶と昇天の区別は資料。秒数は仮値'),
  reviveHp: p('救助', '救助後のHP割合', 1 / 3, 'ratio', 'proto', null, '最大HPの3分の1'),
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
  candyPeriod: p('キャンディー', '出てくる間隔', 20, 'seconds', 'proto', null, 'いま遊んでいる場所（通り／祭り広場）のどこかにランダム'),
  candyMax: p('キャンディー', '同時に置かれる最大数', 3, 'count', 'proto'),
  candyHeal: p('キャンディー', '回復量', 1, 'ratio(最大HP)', 'proto', null, '全回復。HPが満タンの仲間は拾わない'),
  homeRange: p('追尾', 'タップした敵へ弾が追尾する距離（体の表面まで）', 12, 'm', 'proto', null, 'これより遠い敵はタップしても狙えない。人が操作するキャラの弾だけ（AIの弾は追尾しない）'),
  homeMaxT: p('追尾', '追尾する弾の最長の飛行時間', 2.5, 'seconds', 'proto'),
  hitStagger: p('被弾', '重い攻撃でのけぞる時間', 0.45, 'seconds', 'proto'),
  aiMul: p('AI', 'AIが動かすキャラの能力', 0.9, 'ratio', 'proto', null, 'ちから・ようりょく・まもり・体力・移動速度をすべて90%にする（操作を交代すると元に戻る）'),
};

/* ---------------- 難易度・ボス ---------------- */
// むずかしさは1つだけ。旧「超」の強さを「通常」とし、体力は旧「超」(32000)の約70%
const DIFF = {
  normal: { nm: '通常', str: p('ボス', 'ちから', 250, 'points', 'spec'), yo: p('ボス', 'ようりょく', 250, 'points', 'spec'), def: p('ボス', 'まもり', 120, 'points', 'spec'), hp: p('ボス', '体力', 20000, 'points', 'spec', null, 'v6の基本能力。数値は画面に出さない', true), dmgMul: p('ボス', 'トバトーバが与えるダメージの倍率', 0.7, 'ratio', 'proto', null, '出現時にちから・ようりょくへ一度だけ掛ける（実効175／175）。ダメージ関数では掛けない'), mobHp: 480 },
};
const BOSS = {
  nm: 'トバトーバ',
  height: p('体格', 'トバトーバの高さ（基準味方=1）', 5.0, 'units', 'proto', null, '新作の設計値。原作モデルの実測ではない'),
  shoulder: p('体格', 'ボスの肩幅', 2.8, 'units', 'proto'),
  footWidth: p('体格', 'ボスの接地幅', 2.2, 'units', 'proto'),
  // 当たり判定：見た目の脚2本＋胴の下（ダウン中は前に倒れた胴も）。移動の衝突も同じ形を使う
  legX: p('当たり判定', 'ボスの脚の左右位置', 0.62, 'units', 'proto'), legR: p('当たり判定', 'ボスの脚の当たり半径', 0.52, 'units', 'proto', null, '足元の地上判定に届くように見た目の脚より少し太い'),
  coreR: p('当たり判定', 'ボスの胴の下の当たり半径', 0.75, 'units', 'proto'),
  bodyR: 1.25, walk: 1.6, turn: 1.4,
  weak: '土', strong: '雷',
  gapMin: p('ボス行動', '後隙後に次の技を選ぶまで（最小）', 0.7, 'seconds', 'proto'),
  gapMax: p('ボス行動', '後隙後に次の技を選ぶまで（最大）', 1.1, 'seconds', 'proto'),
  introT: p('ボス行動', '登場演出の全体尺', 4.5, 'seconds', 'proto', null, 'オリジナル演出'),
  phase2: p('ボス行動', '終盤段階へ移るHP割合', 1 / 3, 'ratio', 'doc', 6, 'HP1/3以下で覚醒（赤いオーラ・横断6回）'),
  flyHittable: false,
};
// ボス技：wind=予兆/準備, act=攻撃期間, iv=同一対象への間隔, max=最大ヒット, rec=後隙, cd=最短再使用
const BMOVES = {
  fubuki: { nm: '大売出し札吹雪', wind: p('ボス技', '札吹雪：予兆', 0.65, 's', 'proto'), act: p('ボス技', '札吹雪：攻撃期間', 1.0, 's', 'proto'), iv: p('ボス技', '札吹雪：同一対象への間隔', 0.20, 's', 'proto'), max: p('ボス技', '札吹雪：最大ヒット', 5, 'hits', 'proto'), rec: p('ボス技', '札吹雪：後隙', 0.55, 's', 'proto'), cd: p('ボス技', '札吹雪：再使用制限', 6, 's', 'proto'), pw: p('ボス技', '札吹雪：仮威力', 12, 'power', 'proto', null, '原作の技威力ではない'), stat: 'str', r: 10, fanYaw: 0.56, fanHalf: 0.33 },
  shime: { nm: 'しめ縄ぶん回し', wind: p('ボス技', 'しめ縄：予兆', 0.55, 's', 'proto'), act: p('ボス技', 'しめ縄：攻撃期間', 0.8, 's', 'proto'), iv: 0.20, max: p('ボス技', 'しめ縄：最大ヒット', 4, 'hits', 'proto'), rec: p('ボス技', 'しめ縄：後隙', 0.65, 's', 'proto'), cd: p('ボス技', 'しめ縄：再使用制限', 7, 's', 'proto'), pw: p('ボス技', 'しめ縄：仮威力', 16, 'power', 'proto'), stat: 'str', r: 7.5, half: 1.15 },
  otoshi: { nm: '提灯おとし', wind: p('ボス技', '提灯おとし：予兆', 1.0, 's', 'proto'), act: 0.12, rec: p('ボス技', '提灯おとし：後隙', 0.65, 's', 'proto'), cd: p('ボス技', '提灯おとし：再使用制限', 9, 's', 'proto'), pw: p('ボス技', '提灯おとし：仮威力', 70, 'power', 'proto'), stat: 'yo', r: 2.3 },
  kousen: { nm: '招福看板光線', wind: p('ボス技', '看板光線：予兆', 0.85, 's', 'proto'), act: p('ボス技', '看板光線：照射期間', 1.2, 's', 'proto'), iv: p('ボス技', '看板光線：同一対象への間隔', 0.30, 's', 'proto'), max: p('ボス技', '看板光線：最大ヒット', 4, 'hits', 'proto'), rec: p('ボス技', '看板光線：後隙', 0.8, 's', 'proto'), cd: p('ボス技', '看板光線：再使用制限', 10, 's', 'proto'), pw: p('ボス技', '看板光線：仮威力', 70, 'power', 'proto'), stat: 'yo', len: 24, w: 2.8 },
  harite: { nm: '商売繁盛張り手', wind: p('ボス技', '張り手：予兆', 0.45, 's', 'proto'), act: p('ボス技', '張り手：判定', 0.15, 's', 'proto'), rec: p('ボス技', '張り手：後隙', 0.9, 's', 'proto'), cd: p('ボス技', '張り手：再使用制限', 5, 's', 'proto'), pw: p('ボス技', '張り手：仮威力', 140, 'power', 'proto'), stat: 'str', start: 1.0, len: p('ボス技', '張り手：届く長さ', 3.4, 'm', 'proto', null, '手のひらと衝撃波が届く範囲'), w: 2.6 },
  junkou: { nm: '千住大巡行', wind: p('ボス技', '大巡行：予兆', 1.1, 's', 'proto'), speed: p('ボス技', '大巡行：飛ぶ速さ', 27, 'm/s', 'proto', null, '横断1回はおよそ0.8〜1.4秒'), gap: p('ボス技', '大巡行：横断の間（最短の予兆）', 0.6, 's', 'proto', null, '外周を大きく回り込むときは長くなる'), rimSpeed: 38, n1: p('ボス技', '大巡行：通常時の横断回数', 3, 'count', 'spec'), n2: p('ボス技', '大巡行：覚醒時の横断回数', 6, 'count', 'spec', null, '横・斜め・縦など毎回ちがう向き。飛行中は落下提灯を落とす'), minTurn: p('ボス技', '大巡行：前の2回と変える向きの最小差', 0.55, 'rad', 'proto', null, '約31度'), minLen: 20, outer: 3.5, frontZ: 0.8, rec: p('ボス技', '大巡行：最終着地後の後隙', 1.5, 's', 'proto'), cd: p('ボス技', '大巡行：再使用制限', 22, 's', 'proto'), pw: p('ボス技', '大巡行：接触の仮威力', 140, 'power', 'proto'), bombPw: p('ボス技', '大巡行：落下提灯の仮威力', 70, 'power', 'proto'), bombR: 2.0, bombFall: 0.9, bombEvery: 0.24, bombSpread: 3.4, contactR: p('ボス技', '大巡行：体の当たり幅（片側）', 1.45, 'm', 'proto', null, '低く水平に飛ぶ体と同じ幅'), contactLen: 2.4, landR: 2.6, stat: 'str' },
  zouen: { nm: '呼び込み札小僧', wind: p('ボス技', '増援：予兆', 0.8, 's', 'proto'), rec: p('ボス技', '増援：後隙', 0.5, 's', 'proto'), cd: p('ボス技', '増援：再使用制限', 25, 's', 'proto'), max: p('ボス技', '増援：同時存在上限', 2, 'count', 'doc', 6) },
};
const MOB = {
  nm: '札小僧',
  height: p('体格', '札小僧の高さ', 0.85, 'units', 'proto'),
  str: p('札小僧', 'ちから', 80, 'points', 'proto', null, '原作の小型ロボニャンの能力を確定した値ではない'),
  yo: p('札小僧', 'ようりょく', 60, 'points', 'proto'),
  def: p('札小僧', 'まもり', 60, 'points', 'proto'),
  shotPw: p('札小僧', '遠隔攻撃の仮威力', 35, 'power', 'proto'),
  shotPeriod: p('札小僧', '発射周期', 1.5, 's', 'proto'),
  shotSpeed: 9, speed: 2.6, r: p('当たり判定', '札小僧の当たり半径', 0.32, 'units', 'proto'), shotR: 0.22, allyR: p('当たり判定', '味方が攻撃を受ける半径', 0.32, 'units', 'proto'),
};

/* ---------------- 攻撃（A/X/Y/必殺） ---------------- */
// kind: combo3 / melee1 / shot / charge / dodge / retreat / dot / stealth / parry / heavy / trap / protect / guard / taunt / mine / heal / healRing
// Aボタンの通常攻撃：v6で時間をすべて旧値の70%（発生・各段・硬直終了・射撃の移動ロック）。ヒット数・威力・コンボの入力は同じ
const A_TIME = p('攻撃', 'A通常攻撃の時間倍率（v6）', 0.70, 'ratio', 'spec', null, 'X/Y・回避・必殺・敵の攻撃には掛けない');
const aT = v => Math.round(v * A_TIME * 1000) / 1000;
const MOVES = {
  combo3: { kind: 'combo3', nm: '三連', hits: [p('攻撃', '三連：1発目', aT(0.15), 's', 'spec'), p('攻撃', '三連：2発目（入力時）', aT(0.45), 's', 'spec'), p('攻撃', '三連：3発目（入力時）', aT(0.85), 's', 'spec')], end: p('攻撃', '三連：最後の硬直終了', aT(1.15), 's', 'spec'), range: p('当たり判定', '近接攻撃が届く距離（体の中心から）', 1.25, 'units', 'proto', null, '相手の体（脚）に触れたときだけ当たる'), arc: 1.25 },
  melee1: { kind: 'melee1', nm: '近接打撃', start: p('攻撃', '単発近接：発生', aT(0.18), 's', 'spec'), active: p('攻撃', '単発近接：攻撃判定', aT(0.10), 's', 'spec'), end: p('攻撃', '単発近接：最短周期', aT(0.50), 's', 'spec'), range: 1.25, arc: 1.2 },
  shot: { kind: 'shot', nm: '射撃', fire: aT(0.10), end: p('攻撃', '通常射撃：最短周期', aT(0.50), 's', 'spec'), lock: aT(0.25), speed: 18, life: 0.85, r: 0.35 },
};
const CHARGE = {
  max: p('ため', '最大ため（X・Yのため攻撃）', 0.5, 's', 'spec', null, 'v6の依頼で旧1.0秒から50%短縮。最大ためで威力×2.5は同じ'),
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
  kogeShou: { kind: 'charge', nm: 'ため掌', short: 'ため掌', pw: 80, stat: 'str', form: 'melee', range: 1.4, arc: 1.1, attack: true },
  hoshiShot: { kind: 'charge', nm: '集光ショット', short: '集光', pw: 50, stat: 'str', form: 'shot', speed: 22, attack: true },
  akaneFire: { kind: 'charge', nm: '茜火', short: '茜火', pw: 50, stat: 'yo', form: 'blast', speed: 14, blastR: 1.6, attack: true },
  dodge: { kind: 'dodge', nm: '回避', short: '回避' },
  kogetsuki: { kind: 'dot', nm: '焦げつき印', short: '焦印', pw: p('継続ダメージ', '1回の仮威力', 18, 'power', 'proto'), stat: 'yo', tick: p('継続ダメージ', '間隔', 1, 's', 'proto'), dur: p('継続ダメージ', '継続', 10, 's', 'proto'), cd: p('継続ダメージ', '再使用', 12, 's', 'proto'), speed: 16, attack: true },
  kaeshiBane: { kind: 'retreat', nm: '返し羽', short: '返し羽', pw: 70, stat: 'str', attack: true },
  kageKakure: { kind: 'stealth', nm: '影隠れ', short: '影隠れ', dur: p('隠密', '持続', 8, 's', 'proto'), cd: p('隠密', '再使用', 20, 's', 'proto') },
  ukenagashi: { kind: 'parry', nm: '受け流し', short: '受流し', win: p('受け流し', '受付', 1.0, 's', 'proto'), cd: p('受け流し', '再使用', 7, 's', 'proto'), pw: p('受け流し', '反撃の仮威力', 150, 'power', 'proto'), stat: 'str', attack: true },
  hikiGiri: { kind: 'retreat', nm: '退き斬り', short: '退き斬', pw: 70, stat: 'str', attack: true },
  konshin: { kind: 'heavy', nm: '渾身太鼓打ち', short: '渾身', pw: 400, stat: 'str', start: p('渾身の一撃', '発生', 1.10, 's', 'proto'), active: p('渾身の一撃', '判定', 0.15, 's', 'proto'), rec: p('渾身の一撃', '後隙', 0.65, 's', 'proto'), cd: p('渾身の一撃', '再使用', 10, 's', 'proto'), range: 1.6, arc: 1.2, attack: true },
  shibire: { kind: 'trap', nm: 'しびれ囃子', short: 'しびれ', arm: p('麻痺のワナ', '作動可能まで', 0.8, 's', 'proto'), para: p('麻痺のワナ', '麻痺時間', 3, 's', 'proto'), cd: p('麻痺のワナ', '再使用', 15, 's', 'proto'), life: 20, r: 1.3, bossMul: p('麻痺のワナ', 'ボスへの麻痺時間倍率', 0.5, 'ratio', 'proto'), bossImmune: p('麻痺のワナ', 'ボスの麻痺耐性時間', 15, 's', 'proto') },
  daihigo: { kind: 'protect', nm: '大庇護', short: '大庇護', r: p('大庇護', '範囲', 3, 'm', 'proto'), inv: p('大庇護', '無敵時間', 0.45, 's', 'proto'), cd: p('大庇護', '再使用', 15, 's', 'proto') },
  guard: { kind: 'guard', nm: 'ガード', short: 'ガード', max: p('ガード', '最大持続', 8, 's', 'approx', 25, '当時の目安'), refill: p('ガード', '空からの再充填', 20, 's', 'approx', 25), threshold: p('ガード', '再使用できるゲージ量', 0.15, 'ratio', 'proto', null, '少しでも使うと20秒使えない仕様にはしない'), mul: SIM.guardMul },
  yobikomi: { kind: 'taunt', nm: '呼び込み打ち', short: '呼込み', pw: 80, stat: 'str', threat: p('敵視', '呼び込み打ちの敵視', 300, 'points', 'proto'), cd: p('呼び込み打ち', '再使用', 6, 's', 'proto'), start: 0.22, end: 0.55, range: 1.35, arc: 1.2, attack: true },
  hansha: { kind: 'guard', nm: '反射暖簾', short: '反射', max: p('反射ガード', '最大持続', 6, 's', 'proto'), refill: p('反射ガード', '使い切って再使用まで', 20, 's', 'proto'), threshold: 0.15, mul: SIM.guardMul, reflect: p('反射ガード', '反射率', 0.3, 'ratio', 'proto', null, '原作未確認の独立係数') },
  suiKemuri: { kind: 'charge', nm: '吸い煙', short: '吸い煙', pw: 30, stat: 'yo', form: 'drain', range: 3.0, arc: 0.9, drain: p('吸収', '吸収率', 0.5, 'ratio', 'proto'), attack: true },
  okiKayaku: { kind: 'mine', nm: '置き火薬', short: '火薬', pw: 600, stat: 'mix', arm: p('地雷', '作動可能まで', 1.0, 's', 'proto'), cd: p('地雷', '再使用', 45, 's', 'proto', null, '地雷は1人同時1個・再使用45秒（v3の初期仮値）'), trig: 1.2, r: 2.4, allyMul: p('地雷', '味方が巻き込まれたときの倍率', 0.25, 'ratio', 'proto', null, '敵味方どちらでも起爆'), life: 30, attack: true },
  megumi: { kind: 'heal', nm: '恵みの葉', short: '恵み', pw: 80, max: p('回復技', '最大ため', 1.3, 's', 'approx', 26, '同名技の攻略記事の目安'), cd: p('回復技', '再使用', 9, 's', 'approx', 26), mul: p('回復技', 'ため最大の回復倍率', 2.0, 'ratio', 'proto'), range: 14 },
  kaedeWa: { kind: 'healRing', nm: '楓の輪', short: '楓の輪', pw: 80, max: 1.3, cd: 9, r0: p('回復技', '楓の輪：最小範囲', 3, 'm', 'proto'), r1: p('回復技', '楓の輪：最大範囲', 6, 'm', 'proto') },
};
const SPECIALS = {
  hits10: { nm: '十連', type: 'multi', n: 10, pw: 40, prep: p('必殺', '40×10型：準備', 0.35, 's', 'proto'), iv: p('必殺', '40×10型：間隔', 0.12, 's', 'proto'), tail: p('必殺', '40×10型：終了まで', 0.35, 's', 'proto'), shape: 'fan', range: 1.8, arc: 1.3 },
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
  ch({ id: 'kogemaru', nm: 'コゲマル', role: '近接', blurb: '炭の小狸。三連と、ためた掌で押し込む', src: 15, h: 1.0, el: '火', str: 223, yo: 61, def: 124, A: 'combo3', Apw: [30, 30, 60], X: 'kogeShou', Y: 'dodge', sp: 'hits10', spNm: '炭火十連掌', passive: 'dodgePlus', psv: '回避の無敵が少し長い', col: 0x3b3a40, acc: 0xff7a2a, ai: 'melee' }),
  ch({ id: 'hoshisuzume', nm: 'ホシスズメ', role: '射撃', blurb: '真鍮の星灯を持つ雀。離れて撃つ', src: 16, h: 0.9, el: '風', str: 229, yo: 81, def: 132, A: 'shot', Apw: [35], X: 'hoshiShot', Y: 'dodge', sp: 'hits8', spNm: '星灯大放射', passive: 'xPower', psv: 'X技の威力が上がる', col: 0x9a6a3e, acc: 0xf2c94c, ai: 'ranged' }),
  ch({ id: 'akaneten', nm: 'アカネテン', role: '炎・継続', blurb: '夕焼け色のテン。妖術の炎と焦げつき印', src: 17, h: 1.15, el: '火', str: 143, yo: 241, def: 176, A: 'melee1', Apw: [50], X: 'akaneFire', Y: 'kogetsuki', sp: 'hits4', spNm: '紅灯四重陣', passive: 'fullHp', psv: 'HP満タンで攻撃が上がる', col: 0xe8683a, acc: 0xffe0b0, ai: 'mage' }),
  ch({ id: 'kagetsubame', nm: 'カゲツバメ', role: '隠密', blurb: '影をまとう燕。狙われていない間は会心', src: 18, h: 1.05, el: '風', str: 240, yo: 146, def: 167, A: 'combo3', Apw: [30, 30, 60], X: 'kaeshiBane', Y: 'kageKakure', sp: 'hits10', spNm: '影羽十連', passive: 'stealthCrit', psv: '見つかっていない間の攻撃が必ず会心', col: 0x2a2f55, acc: 0xc9d4ff, ai: 'melee' }),
  ch({ id: 'sayanosuke', nm: 'サヤノスケ', role: '反撃', blurb: '古い刀の鞘の付喪神。受け流して返す', src: 19, h: 1.15, el: '土', str: 246, yo: 144, def: 152, A: 'combo3', Apw: [30, 30, 60], X: 'ukenagashi', Y: 'hikiGiri', sp: 'one400', spNm: '鞘の一閃', passive: 'critPower', psv: '会心の威力が上がる', col: 0x2b1d1a, acc: 0xd8b04a, ai: 'melee' }),
  ch({ id: 'taiko', nm: 'タイコ番長', role: '強打・支援', blurb: '太鼓を背負う小熊。重い一撃と麻痺のワナ', src: 20, h: 1.25, el: '土', str: 255, yo: 81, def: 158, A: 'melee1', Apw: [50], X: 'konshin', Y: 'shibire', sp: 'buff', spNm: '囃子の大号令', passive: 'partyStr', psv: '味方全員のちからが上がる', col: 0x7b4a2a, acc: 0xd23a3a, ai: 'melee' }),
  ch({ id: 'burikidon', nm: 'ブリキドン', role: '射撃・防御', blurb: 'ブリキ缶の店番人形。ガードで敵を引きつける', src: 21, h: 1.1, el: '雷', str: 191, yo: 112, def: 213, A: 'shot', Apw: [70], X: 'daihigo', Y: 'guard', sp: 'guardup', spNm: '鉄壁店番', passive: 'food', psv: '30秒に一度、回復の食べ物を出す', col: 0xb9c2c9, acc: 0x2f6fb5, ai: 'tank' }),
  ch({ id: 'norenbou', nm: 'ノレン坊', role: '誘導・反射', blurb: '暖簾をまとう付喪神。呼び込んで跳ね返す', src: 22, h: 1.2, el: '水', str: 196, yo: 119, def: 241, A: 'melee1', Apw: [50], X: 'yobikomi', Y: 'hansha', sp: 'guardup', spNm: '暖簾大結界', passive: 'guardPlus', psv: 'ガードの効果が上がる', col: 0x23407a, acc: 0xf4efe2, ai: 'tank' }),
  ch({ id: 'kemuridama', nm: 'ケムリダマ', role: '吸収・地雷', blurb: '小さな煙のやかん。吸い取りと置き火薬', src: 23, h: 0.95, el: '風', str: 83, yo: 215, def: 131, A: 'melee1', Apw: [50], X: 'suiKemuri', Y: 'okiKayaku', sp: 'weaken', spNm: '煙払いの息', passive: 'partyCrit', psv: '味方全員の会心が出やすい', col: 0x8f9aa3, acc: 0xeae6dc, ai: 'mage' }),
  ch({ id: 'momiji', nm: 'モミジ翁', role: '回復・蘇生', blurb: '楓の葉をまとう翁。ためて回復、救助が速い', src: 24, h: 1.05, el: '土', str: 117, yo: 256, def: 157, A: 'melee1', Apw: [50], X: 'megumi', Y: 'kaedeWa', sp: 'healall', spNm: '楓舞う祝福', passive: 'reviver', psv: '救助が速く、復活時のHPも多い', col: 0xc8452a, acc: 0xf6e6c8, ai: 'healer' }),
];
const CHI = Object.fromEntries(CHARS.map(c => [c.id, c]));
for (const c of CHARS) {
  p('キャラ', c.nm + '：ちから/ようりょく/まもり', `${c.str} / ${c.yo} / ${c.def}`, 'points', 'doc', c.src, 'レベル99・装備なしの公開値（個体差あり）');
  p('キャラ', c.nm + '：身長', c.h, 'units', 'proto', null, '判別しやすさのための値');
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
  starburst_gun: { nm: '閃光銃800', desc: '1戦闘1発。最初に当たった敵1体へ固定800ダメージ（倍率なし・壁で止まる）', use: 0.8, icon: '🔫', dmg: p('アイテム', '閃光銃800の固定ダメージ', 800, 'points', 'spec', null, '能力・属性・会心・装備・Lv補正・睡眠・G玉の倍率は掛けない'), range: 16, speed: 24, r: 0.18, one: true },
};
const ITEM_IDS = Object.keys(ITEMS);

/* ---------------- 舞台・カメラ・UI ---------------- */
const STAGE = {
  streetHalfW: p('舞台', '探索用の通りの幅（両側のアーケード歩道を含む）', 18.8, 'm', 'proto', 11, '中央の歩行者路は約12.8m。車は入らない。写真をもとに架空に再構成') / 2,
  streetZ0: -66, streetZ1: 0,
  plazaHalfW: p('舞台', '祭り広場（幅）', 28, 'm', 'proto', null, '初版の40mから30%小さくした') / 2,
  plazaZ1: p('舞台', '祭り広場（奥行き）', 22.4, 'm', 'proto', null, '初版の32mから30%小さくした'),
  pillarX: 6.4, pillarStep: 5,
  lanterns: [[-10.8, 3.6], [10.8, 3.6], [-10.8, 18.8], [10.8, 18.8]],
  bossSpawn: [0, 13.3],
  waves: [[[-3, -44], [3, -46]], [[-5, -24], [0, -22], [5, -25]]],
};
/* ---------------- ステージ2：常磐線（北千住→上野）ヨシノシンの部下 ---------------- */
// 車内の座標：x＝左右（通路の幅）、z＝前後（+zが上野方面＝前）。3号車 z -21〜-1、連結部 -1〜1、2号車 1〜21（その先の1号車には入れない）
const JOBAN = {
  nm: '常磐線', boss: 'ヨシノシン', minion: 'ヨシノシンの部下',
  halfW: p('常磐線', '車内の通路の半幅', 1.5, 'm', 'proto', null, '遊びやすさのため実物より少し広い'),
  gwHalf: 1.0, gwHalfW: 0.8, zMin: -20.6, zMax: 20.6, frontZ: 20.3,
  carDoors: [-18.5, -13.5, -8.5, -3.5, 3.5, 8.5, 13.5, 18.5], // 乗り降りのドア（左右）
  stations: ['北千住', '南千住', '三河島', '日暮里', '上野'],
  stationsEn: ['Kita-Senju', 'Minami-Senju', 'Mikawashima', 'Nippori', 'Ueno'],
  segLen: p('常磐線', '駅と駅の間（ゲーム内の距離）', [800, 700, 700, 900], 'm', 'proto', null, '北千住→南千住→三河島→日暮里→上野'),
  vmax: p('常磐線', '電車の最高速度', 24, 'm/s', 'proto'), acc: 2.0,
  stopT: p('常磐線', '途中駅の停車時間', 8, 's', 'proto'),
  // 8つのイベント（合計235体）。乗車時は車内に、区間の途中は走行距離50%の通過で、駅は停車してドアが開いたら、それぞれ一度だけ。1号車側（前）と3号車側（後ろ）へ分ける
  events: [
    { id: 'board', n: 30, at: 'start', front: 15, back: 15, nm: '乗車直後（車内）' },
    { id: 'mid_0', n: 20, at: 'mid:0', front: 10, back: 10, nm: '北千住→南千住の途中' },
    { id: 'station_minami', n: 30, at: 'st:1', front: 15, back: 15, nm: '南千住' },
    { id: 'mid_1', n: 30, at: 'mid:1', front: 15, back: 15, nm: '南千住→三河島の途中' },
    { id: 'station_mikawa', n: 30, at: 'st:2', front: 15, back: 15, nm: '三河島' },
    { id: 'mid_2', n: 35, at: 'mid:2', front: 18, back: 17, nm: '三河島→日暮里の途中' },
    { id: 'station_nippori', n: 40, at: 'st:3', front: 20, back: 20, nm: '日暮里' },
    { id: 'mid_3', n: 20, at: 'mid:3', front: 10, back: 10, nm: '日暮里→上野の途中' },
  ],
  midFrac: p('常磐線', '区間中央イベントの位置（区間走行距離の割合）', 0.5, 'ratio', 'spec', null, '残り時間ではなく走行距離50%の通過で一度だけ'),
  mix: p('ヨシノシンの部下', '各イベント内の内訳（剣・パンチ・ビーム）', { sword: 1 / 3, punch: 1 / 3, beam: 1 / 3 }, 'ratio', 'spec', null, 'おおむね均等。整数は最大剰余法で指定人数に合わせる'),
  // 部下の歩く速さはv6で旧値の50%（剣・パンチ1.3／ビーム1.2m/秒）。予兆・周期・弾速・投げられて飛ぶ速さは変えない
  types: {
    sword: { nm: '剣', wpn: 'sword', hp: 200, str: 192, yo: 209, def: 45, spd: 1.3, pw: 60, stat: 'str', warn: 0.70, period: 3.2 },
    punch: { nm: 'パンチ', wpn: 'fist', hp: 200, str: 192, yo: 209, def: 45, spd: 1.3, pw: 71, stat: 'str', warn: 0.65, period: 3.5 },
    beam: { nm: 'ビーム', wpn: 'beam', hp: 200, str: 192, yo: 209, def: 45, spd: 1.2, pw: 80, stat: 'yo', warn: 1.20, period: 5.0 },
  },
  rights: p('ヨシノシンの部下', '同時に攻撃を始められる数（剣・パンチ／ビーム）', { melee: 4, beam: 2 }, '体', 'spec', null, '全員が動き、攻撃する権利だけを交代する'),
  r: 0.38,
  maxActive: p('ヨシノシンの部下', '同時に車内にいる最大数', 40, '体', 'spec', null, '多いときは前後の車両で待ち、空いた分だけその側から出てくる'), backZ: -20.3,
  wpn: {
    sword: { nm: '剣', reach: 1.6, wind: 0.65, act: 0.12, rec: 0.75, cd: [3.2, 4.2], r: 1.75, half: 0.6, knock: 2 },
    fist: { nm: '拳', reach: 1.2, wind: 0.5, act: 0.1, rec: 0.55, cd: [2.8, 3.6], len: 1.5, w: 1.0, knock: 3.5 },
    beam: { nm: '大砲（ビーム）', reach: 9, keep: 6, wind: 0.9, act: 0.25, rec: 0.6, cd: [3.8, 4.8], len: 11, w: 0.7, knock: 0 },
    shield: { nm: '決裁板（防御）', reach: 1.3, wind: 0.6, act: 0.1, rec: 0.6, cd: [3.6, 4.4], len: 1.6, w: 1.1, knock: 3 },
  },
  introT: p('常磐線', '始まりの演出（トバトーバが倒れる→乗車→発車）', 12, 's', 'proto'), arriveT: 6,
  dropRate: 0.06,
};
/* ---------------- 上野編：居酒屋通り（電車の部下の1.25倍・30体） ---------------- */
// 座標：x＝左右（±4.6）、z＝奥行き（改札側 z=0 → 奥 z=64）。3地点に10体ずつ。地点を片付けると次の暖簾の結界が開く
const STREET = {
  nm: '上野の居酒屋通り', halfX: 4.6, zMax: 64, start: [[-1.0, 3.2], [1.0, 3.2], [-0.4, 2.0], [0.4, 2.0]],
  groups: p('居酒屋通り', '部下を置く3地点（奥行きz）', [16, 33, 50], 'm', 'proto'), gates: [24, 41, 58],
  mul: p('居酒屋通り', '電車の部下に対する倍率（HP・ちから・ようりょくだけ）', 1.25, '倍', 'spec', null, '技の威力・周期・まもり・移動はそのまま'),
  n: 30, per: 10,
  introT: p('居酒屋通り', '始まりの演出（ホーム→改札→通りへ）', 5, 's', 'proto'),
};
/* ---------------- 上野編：上野駅前の広場・指揮官ヨシノシン ---------------- */
// 座標：x＝左右（±17）、z＝奥行き（入口 z=0 → 奥 z=28）。味方は z≈4、部下は z12〜18、本体は z≈23
const U_H = 1.45; // 電車の部下モデルの身長（m）。上野の部下はこれを縮めて 0.8〜0.95m にする
const UENO = {
  nm: '上野駅前', boss: 'ヨシノシン', minion: 'ヨシノシンの部下（妖怪人形）',
  halfX: p('上野', '戦闘領域の横幅', 34, 'm', 'spec', null, 'x=±17') / 2, zMax: p('上野', '戦闘領域の奥行き', 28, 'm', 'spec', null, '入口 z=0'),
  start: [[-1.5, 4.2], [1.5, 4.2], [-0.5, 3.0], [0.5, 3.0]], bossSpawn: [0, 23], center: [0, 14],
  bossScale: p('ヨシノシン', 'モデルの拡大率（基準3.2m）', 1.85, '倍', 'spec', null, '本体だけ。部下・技の判定半径は拡大しない'), bossR: p('ヨシノシン', '足元の被弾判定の半径', 1.5, 'm', 'proto', null, '足元に届けば当たる'), bossH: p('ヨシノシン', '身長', 5.92, 'm', 'spec', null, '3.2m×1.85・約5頭身'),
  hp: p('ヨシノシン', '体力', 22000, 'points', 'spec'), str: p('ヨシノシン', 'ちから', 500, 'points', 'spec'), yo: p('ヨシノシン', 'ようりょく', 500, 'points', 'spec'), def: p('ヨシノシン', 'まもり', 150, 'points', 'spec'),
  introT: p('上野', '登場の演出（指を鳴らす→部下が走り出す）', 3.2, 's', 'spec', null, '最初の予告より前に攻撃しない'),
  minGap: p('ヨシノシン', '直接攻撃どうしの開始間隔（最低）', 3.0, 's', 'spec'),
  rec: 40,
  minions: { // 電車の部下の型別データから HP・ちから・ようりょくだけ×0.85（四捨五入）。技の威力・周期はそのまま
    sword: { nm: '剣', wpn: 'sword', hp: 170, str: 163, yo: 178, def: 45, pw: 60, stat: 'str', warn: 0.70, period: 3.2, spd: 1.3, scale: 0.85 / U_H, r: 0.32 },
    punch: { nm: 'パンチ', wpn: 'fist', hp: 170, str: 163, yo: 178, def: 45, pw: 71, stat: 'str', warn: 0.65, period: 3.5, spd: 1.3, scale: 0.9 / U_H, r: 0.33 },
    beam: { nm: 'ビーム', wpn: 'beam', hp: 170, str: 163, yo: 178, def: 45, pw: 80, stat: 'yo', warn: 1.20, period: 5.0, spd: 1.2, scale: 0.85 / U_H, r: 0.32, len: 13 },
  },
  init: p('上野', '最初の部下（ビーム・剣・パンチ）', { beam: 22, sword: 7, punch: 7 }, '体', 'spec', null, '36体が同時に前進する'),
  cap: p('上野', '部下の生存上限（予約を含む）', 100, '体', 'spec'),
  rights: p('上野', '同時に攻撃を始められる部下', { melee: 4, beam: 6, all: 10 }, '体', 'spec', null, '剣・パンチ4体＋ビーム6体＝10体'),
  wave: p('上野', '包囲動員（有効戦闘30秒ごと）', { every: 30, n: 15, mix: { beam: 9, sword: 3, punch: 3 }, warn: 1 }, '体', 'spec', null, '4つの外周入口へ4/4/4/3'),
  moves: {
    reiko: { nm: '采配三連霊光', pw: 22, stat: 'yo', n: 3, spread: 0.32, speed: 9, warn: 0.65, rec: 0.7, cd: 6, r: 0.60, range: 13 },
    shosho: { nm: '指令連掌', pw: 110, stat: 'str', warn: 0.7, lockT: 0.25, act: 0.15, rec: 1.0, cd: 10, len: 4.2, w: 3.0, near: 4.4 },
    stamp: { nm: '一斉決裁スタンプ', pw: 100, stat: 'str', r: 5.0, warn: 1.6, act: 0.2, rec: 1.2, cd: 18 },
    shosha: { nm: '号令四連照射', pw: 65, stat: 'yo', warn: 1.3, act: 0.35, rec: 1.0, cd: 8, r: 1.35, gap: 3.0, iv: 0.9 },
    tengai: { nm: '天蓋乱射・三十六光', pw: 45, stat: 'yo', r: 1.15, per: 12, track: 4, waves: [1.4, 3.4, 5.4], act: 0.35, rec: 1.0, cd: 14 },
    warp: { nm: '後方指揮ワープ', warn: 0.7, act: 0.25, rec: 0.5, cd: 10 },
    barrier: { nm: '完全指揮バリア', warn: 0.8, hits: 2, max: 8, cd: 35, stagger: 1.2 },
    throw50: { nm: '部下丸投げ五十連', n: 50, mix: { beam: 30, sword: 10, punch: 10 }, iv: 0.12, land: 1.1, warn: 1.5, rec: 1.5, r: 0.65, pw: 12, stat: 'yo', maxHits: 2, at: [0.75, 0.25], calm: 1.0, alive: 50 },
    sleep: { nm: '30分睡眠チャージ', stages: [{ at: 16500, need: 2500, pre: 17600 }, { at: 11000, need: 3500, pre: 12100 }, { at: 5500, need: 4000, pre: 6600 }], dur: 10, mul: 2.25, down: 4 },
  },
  pick: p('ヨシノシン', '直接攻撃の選び方（ビーム系・霊光・スタンプ）', { beams: 0.7, reiko: 0.2, stamp: 0.1 }, 'ratio', 'spec', null, '近距離の連掌は別の反応'),
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

/* ---------------- 秋葉原編：駅ホーム（オガ・カエ）と駅前広場（星・中＋オガ・カエ） ---------------- */
const AKIBA = {
  introT: { akiba_platform: p('秋葉原', 'ホームの始まりの演出', 2.5, 's', 'proto'), akiba_plaza: p('秋葉原', '広場の始まり（星と中が2人を起こす）', 3, 's', 'spec') },
  rec: 60,
  platform: { halfX: p('秋葉原', 'ホームの安全幅', 18, 'm', 'spec') / 2, zMax: p('秋葉原', 'ホームの長さ', 26, 'm', 'spec'), start: [[-1.5, 3.4], [1.5, 3.4], [-0.5, 2.2], [0.5, 2.2]], foes: { oga: [-3.2, 17], kae: [3.2, 17] } },
  plaza: { half: p('秋葉原', '駅前広場（歩ける範囲・中心から）', 13, 'm', 'spec'), start: [[-1.5, -9.5], [1.5, -9.5], [-0.5, -10.7], [0.5, -10.7]], foes: { hoshi: [-2.4, 8], naka: [2.4, 8], oga: [-5.5, 4], kae: [5.5, 4] } },
  // v6：ちから・ようりょく600。HPは依頼により星・中10,000／オガ・カエ5,000（指示書の8,000/4,000より依頼を優先）。
  // scale：見た目の拡大率（星・中2.0倍／オガ・カエ1.5倍）。当たり判定の半径は変えない
  foes: {
    hoshi: { nm: '星', hp: 10000, str: 600, yo: 600, def: 170, h: 1.60, r: 0.42, scale: 2.0, spd: 2.3, col: 0xf2c94c },
    naka: { nm: '中', hp: 10000, str: 600, yo: 600, def: 170, h: 1.58, r: 0.42, scale: 2.0, spd: 2.3, col: 0x9ad0ff },
    oga: { nm: 'オガ', hp: 5000, str: 600, yo: 600, def: 150, h: 1.48, r: 0.42, scale: 1.5, spd: 2.5, col: 0xff7a5a },
    kae: { nm: 'カエ', hp: 5000, str: 600, yo: 600, def: 150, h: 1.50, r: 0.42, scale: 1.5, spd: 2.5, col: 0x6ad8a8 },
  },
  // オガ・カエの dmg：まもり120の相手への1発の目安（v6の依頼で150〜200）。技ごとに幅の中でランダム。威力 pw ＝ 平均×(120＋120)÷600
  moves: { // 威力・秒数は本作の初期調整値（原作の実測ではない）
    hoshizuna: { who: 'hoshi', nm: '星砂おとし', pw: 49, stat: 'yo', r: 1.4, warn: 1.1, act: 0.15, cd: 4.5, rng: 9, rec: 0.6 },
    hoshirai: { who: 'hoshi', nm: '星雷のしるし', pw: 65, stat: 'yo', r: 1.0, n: 3, delay: 0.65, warn: 1.3, act: 0.15, cd: 9, max: 2, rng: 10, rec: 0.8 },
    hoshimado: { who: 'hoshi', nm: '星まどい', eff: 'strYo', mul: 0.9, dur: 4, r: 1.0, warn: 1.2, act: 0.1, cd: 18, rng: 10, rec: 0.5 },
    shizuku: { who: 'naka', nm: '中の水しずく', pw: 49, stat: 'yo', w: 0.8, len: 12, speed: 8, warn: 0.9, cd: 4.5, rng: 11, rec: 0.5 },
    hyoutei: { who: 'naka', nm: '銀氷の小庭', pw: 65, stat: 'yo', r: 1.5, n: 3, warn: 1.4, act: 0.2, cd: 10, rng: 10, rec: 0.8 },
    mayoi: { who: 'naka', nm: '迷いの銀札', eff: 'spd', mul: 0.9, dur: 4, r: 1.0, warn: 1.2, act: 0.1, cd: 18, rng: 10, rec: 0.5 },
    ougi: { who: 'oga', nm: '紅扇たたき', pw: 65, dmg: [150, 175], stat: 'str', r: 2.5, half: Math.PI / 4, warn: 0.75, act: 0.12, cd: 3.5, rng: 2.3, rec: 0.6 },
    iki: { who: 'oga', nm: '灯りの息', pw: 64, dmg: [150, 170], stat: 'yo', r: 6, half: Math.PI / 6, warn: 1.2, act: 0.8, cd: 7, rng: 5, rec: 1.4 },
    benibana: { who: 'oga', nm: '紅花おとし', pw: 75, dmg: [175, 200], stat: 'str', r: 2.0, warn: 1.5, act: 0.15, cd: 11, rng: 9, rec: 0.8 },
    nagi: { who: 'kae', nm: '水杖なぎ', pw: 67, dmg: [155, 180], stat: 'str', r: 3.0, half: Math.PI * 55 / 180, warn: 0.85, act: 0.12, cd: 3.8, rng: 2.8, rec: 0.6 },
    meguri: { who: 'kae', nm: '水環めぐり', pw: 69, dmg: [160, 185], stat: 'yo', w: 0.8, len: 8, sweep: Math.PI * 2 / 3, dur: 2.5, warn: 1.5, cd: 12, rng: 6, rec: 0.8 },
    kagami: { who: 'kae', nm: '水鏡の足どめ', r: 1.1, n: 2, life: 4, mul: 0.9, warn: 1.2, cd: 14, rng: 9, rec: 0.6 },
  },
  rights: p('秋葉原', '同時に通常攻撃する相手（全体）', 2, '人', 'spec'),
  twin: { window: p('秋葉原', '星・中：片方が倒れてからの制限時間', 15, 's', 'spec'), revive: p('秋葉原', '失敗したとき倒れていた方が戻るHP', 4000, 'points', 'spec', null, '最大HPの50%。生き残っていた方のHPは変えない') },
  guard: { dmg: 1200, low: 300, win: 5, mul: 1.10, dur: 6, cd: 15 },
  geo: { first: 12, every: 18, w: { 2: 0.40, 3: 0.35, 4: 0.25 }, minSep: 3, minArea: 8, maxCover: 0.45, edge: 2.5, reachT: 1.8, rec: 2,
    line: { nm: '二点結び', pw: 65, w: 1.2, warn: 1.5, act: 0.3 }, tri: { nm: '三角結界', pw: 75, warn: 2.0, act: 0.3 }, quad: { nm: '四角結界', pw: 22, warn: 2.5, dur: 3, iv: 0.75, max: 4 } },
};
MOVES.A_TIME = A_TIME;
const DATA = { AKIBA, REFS, STATUS_LABEL, REG, PROFILE, SIM, DIFF, BOSS, BMOVES, MOB, JOBAN, STREET, UENO, MOVES, CHARGE, DODGE, RETREAT, SKILLS, SPECIALS, CHARS, CHI, PASSIVE, DEFAULT_PARTY, ELEM_COL, PCOL, ITEMS, ITEM_IDS, STAGE, CAM, NET };
