/* =====================================================================
   save.js — セーブデータ（配られたID＋自分で決めたパスワード）と引き継ぎコード
   サーバーなし：データはこの端末のブラウザ（localStorage）に保存する。
   パスワードそのものは保存せず、IDとまぜたハッシュだけを持つ。
   別の端末へは「引き継ぎコード」＋ID＋パスワードで移す。three.js 非依存。
   IDは1〜10000。アカウントを作った順に自動で決まる（いまはこの端末の中での順番）。
   ===================================================================== */
const SAVE = (() => {
  const ID_MIN = 1, ID_MAX = 10000, VER = 5, KEY = 'tb.acct.', NEXT = 'tb.acctNext', STORE_VER = 'tb.saveVer', PW_MIN = 6, PW_MAX = 32; // Firebase のパスワードは6文字以上
  // 以前の形式（ID 1001〜）のセーブはいったん消す（1回だけ）
  (function migrate() {
    try {
      if (localStorage.getItem(STORE_VER) === '2') return;
      const del = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.indexOf(KEY) === 0 || k === 'tb.lastId')) del.push(k); }
      for (const k of del) localStorage.removeItem(k);
      localStorage.setItem(STORE_VER, '2');
    } catch (e) { }
  })();
  const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 見まちがえやすい I L O U を使わない
  function cyrb53(str, seed) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  /** パスワードのハッシュ（8桁の16進）。IDごとに結果が変わる */
  function pwHash(id, pw) { let s = 'tobatoban/' + id + '/' + pw, v = 0; for (let i = 0; i < 1200; i++) { v = cyrb53(s, i); s = v.toString(36) + '/' + pw; } return (v % 4294967296).toString(16).padStart(8, '0'); }
  const validId = id => Number.isInteger(id) && id >= ID_MIN && id <= ID_MAX;
  const parseId = s => { const t = String(s || '').replace(/[^0-9０-９]/g, '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)); return t ? parseInt(t, 10) : NaN; };
  function checkPw(pw) { if (typeof pw !== 'string' || pw.length < PW_MIN) return `パスワードは${PW_MIN}文字以上にしてください`; if (pw.length > PW_MAX) return `パスワードは${PW_MAX}文字までです`; if (/\s/.test(pw)) return 'パスワードに空白は使えません'; return null; }
  function storageOk() { try { const k = KEY + '_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }
  /* ---------- v3：所持・累積EXP・チケット・ガチャ（BIGバスターズ） ---------- */
  const STAGES = ['senju', 'joban', 'ueno_street', 'ueno', 'akiba_platform', 'akiba_plaza']; // クリアした回数をステージごとに持つ
  const INIT_IDS = () => DATA.CHARS.filter(c => !c.isNew).map(c => c.id); // 既存10体（いつも所持）
  const charRec = (got, seen) => ({ lv: 1, exp: 0, got: got || 0, seen: seen ? 1 : 0, b: 0, w: 0, k: 0, eq: [] });
  function freshChars(now) { const o = {}; for (const id of INIT_IDS()) o[id] = charRec(0, 1); return o; } // v7：新しいアカウントは既存10体だけ（追加50体はガチャ）
  function freshClear() { const o = {}; for (const k of STAGES) o[k] = 0; return o; }
  const freshPrefs = () => ({ sort: 'level_desc', rank: [], role: [], tags: [], q: '', newOnly: false });
  function fresh(id, pw) {
    const now = Date.now();
    return { v: VER, id, pw, created: now, saved: 0, chars: freshChars(now), rec: { b: 0, w: 0, mobs: 0, best: 0 }, clear: freshClear(),
      wins: { tobatoban: 0, yoshinoshin: 0, story: 0 }, tickets: 0, uenoOpen: false, akibaOpen: false, walkSeen: false, rewarded: [], gacha: { log: [] }, prefs: freshPrefs(), party: null, swap: null, items: null, nick: '', fcode: '', mig: { d: 1, exp3: 1, v5: 1, tk2: 1 } };
  }
  const int = (v, lo) => Math.max(lo || 0, Math.floor(+v || 0));
  /** 古い形式（Lvだけの記録・ステージ1つの頃）からの移行。何度通しても増えも減りもしない */
  function normalize(s) {
    if (!s || typeof s !== 'object') return null;
    const f = fresh(s.id, s.pw), mig = Object.assign({}, s.mig || {});
    const o = Object.assign(f, s); o.rec = Object.assign(f.rec, s.rec || {}); o.clear = Object.assign(freshClear(), s.clear || {});
    if (!s.clear && o.rec.w > 0) o.clear.senju = int(o.rec.w); // ステージが1つだった頃の勝ち＝トバトーバ戦
    for (const k in o.clear) o.clear[k] = int(o.clear[k]);
    o.wins = Object.assign({ tobatoban: 0, yoshinoshin: 0 }, s.wins || {}); o.tickets = int(s.tickets); o.prefs = Object.assign(freshPrefs(), s.prefs || {});
    if (!s.wins) o.wins.tobatoban = o.clear.senju; // 進捗は残す（過去の勝ちにチケットをまとめて配り直さない）
    o.wins.tobatoban = int(o.wins.tobatoban); o.wins.yoshinoshin = int(o.wins.yoshinoshin);
    // v7 P4：チケットはストーリー共通の勝利数へ。移行開始点＝この時点を0回とする（持っているチケットは残し、過去の勝ちに配り直さない。旧版の端数も持ち越さない）
    if (!mig.tk2 || !s.wins || s.wins.story == null) { o.wins.story = 0; mig.tk2 = 1; } o.wins.story = int(o.wins.story);
    o.rewarded = Array.isArray(s.rewarded) ? s.rewarded.slice(-40) : []; o.gacha = { log: Array.isArray(s.gacha && s.gacha.log) ? s.gacha.log.slice(-30) : [] };
    o.uenoOpen = !!s.uenoOpen || o.clear.ueno_street > 0 || o.clear.ueno > 0; // 旧版でボスを解放済みならそのまま（新規は通りのクリアで解放）
    o.akibaOpen = !!s.akibaOpen || o.clear.ueno > 0; o.walkSeen = !!s.walkSeen; mig.v5 = 1; o.fcode = typeof s.fcode === 'string' ? s.fcode.slice(0, 8) : '';
    // キャラ：既存10体は必ず所持。追加キャラは持っている分だけ残す（v7からDも配らない。v6までに配られた分は取り上げない）
    const ch = {}; const src = s.chars || {};
    for (const id of INIT_IDS()) ch[id] = Object.assign(charRec(0, 1), src[id] || {});
    for (const c of DATA.CHARS) if (c.isNew && src[c.id]) ch[c.id] = Object.assign(charRec(0, 1), src[c.id]);
    mig.d = 1;
    for (const id in ch) {
      const x = ch[id], c = DATA.CHI[id]; if (!c) { delete ch[id]; continue; }
      for (const k of ['b', 'w', 'k', 'got', 'used']) x[k] = int(x[k]); x.seen = x.seen ? 1 : 0;
      x.exp = Math.max(int(x.exp), DATA.GROWTH.cum(c.rank, int(x.lv, 1))); // Lvだけの旧セーブは、そのLvの累積EXPにする（下げない）
      x.exp = Math.min(x.exp, DATA.GROWTH.cum(c.rank, 99)); x.lv = DATA.GROWTH.levelOf(c.rank, x.exp);
      x.eq = (Array.isArray(x.eq) ? x.eq : []).filter((e, i, a) => DATA.EQUIP_I[e] && a.indexOf(e) === i); // 存在しない・重複の装備は外す
    }
    { // v7 P4：アカウント全体で同じ装備は1体だけ。キャラ一覧の順（初期10体→追加50体）・各キャラの枠の順で最初の1つを残す（何度読んでも同じ結果）
      const used = new Set(); for (const c of DATA.CHARS) { const x = ch[c.id]; if (!x) continue; x.eq = x.eq.filter(e => !used.has(e) && (used.add(e), true)); } mig.eqU = 1; }
    o.chars = ch; mig.exp3 = 1; o.mig = mig; o.v = VER;
    const n = eqSlots(o); for (const id in ch) if (ch[id].eq.length > n) ch[id].eq = ch[id].eq.slice(0, n);
    return o;
  }
  const owns = (s, id) => !!(s && s.chars && s.chars[id]);
  /** 装備枠：電車を一度クリア（または上野ボス解放・勝利の記録あり）で2枠、それまでは1枠 */
  const eqSlots = s => s && ((s.clear && (s.clear.joban > 0 || s.clear.ueno > 0)) || s.uenoOpen) ? 2 : 1;
  /** 装備を付ける／外す（同じIDの二重は不可・枠の数まで） */
  /** v7 P4：12個の装備はアカウントで1つずつ（キャラごとの複製ではない）。その装備を付けているキャラ（なければ null） */
  function equipOwner(s, id, except) { if (!s || !id) return null; for (const k in s.chars) if (k !== except && (s.chars[k].eq || []).includes(id)) return k; return null; }
  /** 付ける・外す。ほかのキャラが付けている装備は、move:true（明示的な付け替え）のときだけ前のキャラから外して付ける */
  function setEquip(s, ch, slot, id, opt) {
    const c = s && s.chars[ch]; if (!c) return { ok: false, msg: '持っていないキャラです' };
    const n = eqSlots(s); if (slot >= n) return { ok: false, msg: '2つ目の枠は電車をクリアすると使えます' };
    const eq = (c.eq || []).slice(0, n); while (eq.length < n) eq.push(null);
    if (id && !DATA.EQUIP_I[id]) return { ok: false, msg: 'その装備はありません' };
    if (id && eq.some((e, i) => i !== slot && e === id)) return { ok: false, msg: '同じ装備は2つ付けられません（別の段階なら同じ系統も付けられます）' };
    const own = id ? equipOwner(s, id, ch) : null;
    if (own && !(opt && opt.move)) return { ok: false, owner: own, msg: `${DATA.CHI[own] ? DATA.CHI[own].nm : own}が装備中です` };
    if (own) s.chars[own].eq = (s.chars[own].eq || []).filter(e => e !== id);
    eq[slot] = id || null; c.eq = eq.filter(Boolean); return { ok: true, moved: own || null };
  }
  /** 出動時の検査：同じアカウントの枠どうしで同じ装備が重ならないようにする（前の枠を優先） */
  function uniqEq(list) { const used = new Set(); return list.map(eq => (eq || []).filter(e => DATA.EQUIP_I[e] && !used.has(e) && (used.add(e), true))); }
  const lvOf = (s, id) => (s && s.chars[id] ? s.chars[id].lv : 1);
  function load(id) { try { const j = localStorage.getItem(KEY + id); return j ? normalize(JSON.parse(j)) : null; } catch (e) { return null; } }
  function write(s) { try { s.saved = Date.now(); localStorage.setItem(KEY + s.id, JSON.stringify(s)); return true; } catch (e) { return false; } }

  /** 次に割り当てるID（作った順に 1, 2, 3…） */
  function nextId() {
    let n = 1; try { n = Math.max(1, parseInt(localStorage.getItem(NEXT) || '1', 10) || 1); } catch (e) { }
    while (n <= ID_MAX && load(n)) n++;
    return n;
  }
  /** アカウントを作る：IDは自動、パスワードだけ本人が決める */
  function register(pw, pw2) {
    const e = checkPw(pw); if (e) return { ok: false, msg: e };
    if (pw !== pw2) return { ok: false, msg: '2回入れたパスワードが同じではありません' };
    if (!storageOk()) return { ok: false, msg: 'この画面ではセーブできません（プライベートブラウズなど）' };
    const id = nextId(); if (id > ID_MAX) return { ok: false, msg: `アカウントがいっぱいです（${ID_MAX}人まで）` };
    const s = fresh(id, pwHash(id, pw)); if (!write(s)) return { ok: false, msg: 'セーブできませんでした' };
    try { localStorage.setItem(NEXT, String(id + 1)); } catch (e) { }
    return { ok: true, save: s, id, msg: `アカウントを作りました。あなたのIDは ${id} です` };
  }
  /** ログイン：IDとパスワードで認証 */
  function login(id, pw) {
    if (!validId(id)) return { ok: false, msg: `IDは${ID_MIN}〜${ID_MAX}の番号です` };
    if (!pw) return { ok: false, msg: 'パスワードを入れてください' };
    if (!storageOk()) return { ok: false, msg: 'この画面ではセーブを読み込めません（プライベートブラウズなど）' };
    const s = load(id);
    if (!s) return { ok: false, none: true, msg: `ID ${id} のアカウントはこの端末にありません。はじめてなら「新しくアカウントを作る」、別の端末で作ったなら引き継ぎコードを使ってください` };
    if (s.pw !== pwHash(id, pw)) return { ok: false, msg: 'IDかパスワードがちがいます' };
    return { ok: true, save: s, msg: `ID ${id} でログインしました` };
  }

  /** 戦いの記録を足す。op = { kills: {キャラID: 数}, fin: null | { bid, stage, win, time, H, retreat, slots: [{ ch, rate }] } }
      ・EXPは出動した各キャラへ（4等分しない）。操作100%／AI80%（途中で替えたら割合）、控え0%、協力は1人増えるごと+10%（最大+30%）
      ・同じ戦闘ID（bid）の報酬は一度だけ。撤退は報酬なし
      ・チケット：ストーリー6ステージ共通で勝利2回ごとに1枚（敗北・撤退では進まない） */
  function apply(s, op) {
    for (const id in op.kills || {}) { const c = s.chars[id]; if (!c) continue; const k = op.kills[id] | 0; c.k += k; s.rec.mobs += k; }
    const f = op.fin; op.res = null;
    if (!f || f.retreat) return s;
    if (f.bid && s.rewarded.includes(f.bid)) { op.res = { dup: true, exp: [], ticket: 0 }; return s; }
    const st = f.stage || 'senju', res = { exp: [], ticket: 0, unlocked: '' };
    s.rec.b++;
    if (f.win) { s.rec.w++; s.clear[st] = (s.clear[st] | 0) + 1; if (st === 'senju' && f.time > 0 && (!s.rec.best || f.time < s.rec.best)) s.rec.best = Math.round(f.time); }
    for (const sl of f.slots || []) {
      const c = s.chars[sl.ch], cd = DATA.CHI[sl.ch]; if (!c || !cd) continue; // 自分が持っていないキャラには付けない
      c.b++; if (f.win) c.w++;
      const add = DATA.REWARD.exp(st, !!f.win, f.H || 1, sl.rate == null ? 1 : sl.rate), lv0 = c.lv;
      c.exp = DATA.GROWTH.addExp(cd.rank, c.exp, add); c.lv = DATA.GROWTH.levelOf(cd.rank, c.exp);
      res.exp.push({ ch: sl.ch, add, lv0, lv1: c.lv, ai: sl.rate != null && sl.rate < 1 });
    }
    const T = DATA.TICKET;
    if (f.win && T.stages.includes(st)) { const C = s.wins[T.key] | 0; s.wins[T.key] = C + 1; const add = Math.floor((C + 1) / T.per) - Math.floor(C / T.per); s.tickets += add; res.ticket = add; }
    if (f.win && st === 'senju') s.wins.tobatoban = (s.wins.tobatoban | 0) + 1; if (f.win && st === 'ueno') s.wins.yoshinoshin = (s.wins.yoshinoshin | 0) + 1; // 記録用（チケットには使わない）
    if (f.win && st === 'joban' && s.clear.joban === 1) res.unlocked = 'ueno_street'; // 電車の初クリア：居酒屋通りと装備2枠
    if (f.win && st === 'ueno_street' && !s.uenoOpen) { s.uenoOpen = true; res.unlocked = 'ueno'; }
    if (f.win && st === 'ueno' && !s.akibaOpen) { s.akibaOpen = true; res.unlocked = 'akiba_platform'; }
    if (f.win && st === 'akiba_platform' && s.clear.akiba_platform === 1) res.unlocked = 'akiba_plaza';
    if (f.bid) { s.rewarded.push(f.bid); if (s.rewarded.length > 40) s.rewarded = s.rewarded.slice(-40); }
    op.res = res;
    return s;
  }
  /* ---------- 通常ガチャ：1枚で1回。未所持のC/B/A/Sから重みつきで1体（Dは出ない） ---------- */
  function gachaPool(s) { return DATA.GACHA_IDS.filter(id => !owns(s, id)); }
  /** いまの実際のランク別割合（未所持の数×重みを正規化）。全員所持のランクは0% */
  function gachaRates(s) {
    const pool = gachaPool(s), W = DATA.GACHA.weight; let tot = 0; const r = { D: 0, C: 0, B: 0, A: 0, S: 0 };
    for (const id of pool) { const k = DATA.CHI[id].rank; r[k] += W[k]; tot += W[k]; }
    for (const k in r) r[k] = tot > 0 ? r[k] / tot : 0; return r;
  }
  /** 抽選：依頼ID（reqId）が同じなら保存済みの結果を返し、二重に消費しない。チケット1枚の減算と入手を同じ処理で行う */
  function gachaDraw(s, reqId, rnd) {
    const done = s.gacha.log.find(g => g.req === reqId); if (done) return { ok: true, again: true, res: done };
    if (s.tickets < 1) return { ok: false, msg: 'チケットがありません' };
    const pool = gachaPool(s); if (!pool.length) return { ok: false, complete: true, msg: '全50体を入手済みです' };
    const W = DATA.GACHA.weight; let tot = 0; for (const id of pool) tot += W[DATA.CHI[id].rank];
    let x = (rnd == null ? Math.random() : rnd) * tot, pick = pool[pool.length - 1];
    for (const id of pool) { x -= W[DATA.CHI[id].rank]; if (x < 0) { pick = id; break; } }
    const now = Date.now(); s.tickets -= 1; s.chars[pick] = charRec(now, 0);
    const res = { req: reqId, id: pick, rank: DATA.CHI[pick].rank, t: now }; s.gacha.log.push(res); if (s.gacha.log.length > 30) s.gacha.log = s.gacha.log.slice(-30);
    return { ok: true, res };
  }
  /** 50体すべて入手済みのとき：1枚を、選んだ所持キャラ1体のEXP10,000と交換（協力・AI倍率は付けない） */
  function gachaExchange(s, id, reqId) {
    const done = s.gacha.log.find(g => g.req === reqId); if (done) return { ok: true, again: true, res: done };
    if (gachaPool(s).length) return { ok: false, msg: 'まだ入手していないキャラがいます' };
    if (s.tickets < 1) return { ok: false, msg: 'チケットがありません' };
    const c = s.chars[id], cd = DATA.CHI[id]; if (!c || !cd) return { ok: false, msg: '持っているキャラを選んでください' };
    const lv0 = c.lv; s.tickets -= 1; c.exp = DATA.GROWTH.addExp(cd.rank, c.exp, DATA.GACHA.exchangeExp); c.lv = DATA.GROWTH.levelOf(cd.rank, c.exp);
    const res = { req: reqId, ex: id, add: DATA.GACHA.exchangeExp, lv0, lv1: c.lv, t: Date.now() }; s.gacha.log.push(res);
    return { ok: true, res };
  }
  /* ---------- 引き継ぎコード（base32・チェック付き） ---------- */
  function encode(s) {
    const b = [];
    const vi = n => { n = Math.max(0, Math.floor(n)); while (n >= 128) { b.push((n & 127) | 128); n = Math.floor(n / 128); } b.push(n); };
    b.push(VER); vi(s.id);
    const ph = parseInt(s.pw, 16) >>> 0; b.push(ph >>> 24, (ph >>> 16) & 255, (ph >>> 8) & 255, ph & 255);
    vi(s.rec.b); vi(s.rec.w); vi(s.rec.mobs); vi(s.rec.best);
    vi(STAGES.length); for (const k of STAGES) vi(s.clear[k] || 0);
    vi(s.wins.tobatoban); vi(s.wins.yoshinoshin); vi(s.tickets); vi((s.uenoOpen ? 1 : 0) | (s.akibaOpen ? 2 : 0) | (s.walkSeen ? 4 : 0)); vi(s.wins.story || 0);
    const n = DATA.CHARS.length; vi(n);
    const own = DATA.CHARS.map(c => !!s.chars[c.id]);
    for (let i = 0; i < n; i += 8) { let m = 0; for (let j = 0; j < 8 && i + j < n; j++) if (own[i + j]) m |= 1 << j; b.push(m); }
    DATA.CHARS.forEach((c, i) => { if (!own[i]) return; const x = s.chars[c.id]; vi(x.exp); vi(x.b); vi(x.w); vi(x.k); vi(Math.floor((x.got || 0) / 1000)); const eq = (x.eq || []).filter(e => DATA.EQUIP_I[e]); vi(eq.length); for (const e of eq) vi(DATA.EQUIP.indexOf(DATA.EQUIP_I[e])); });
    const sum = cyrb53(String.fromCharCode.apply(null, b), 77) & 0xffff; b.push(sum >>> 8, sum & 255);
    let bits = '', out = ''; for (const v of b) bits += v.toString(2).padStart(8, '0');
    while (bits.length % 5) bits += '0';
    for (let i = 0; i < bits.length; i += 5) out += ALPHA[parseInt(bits.slice(i, i + 5), 2)];
    return out.match(/.{1,4}/g).join('-');
  }
  function decode(code) {
    const t = String(code || '').toUpperCase().replace(/[Ａ-Ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V').replace(/[^0-9A-Z]/g, '');
    if (t.length < 16) return { ok: false, msg: '引き継ぎコードが短すぎます' };
    let bits = ''; for (const ch of t) { const i = ALPHA.indexOf(ch); if (i < 0) return { ok: false, msg: 'コードに使えない文字があります' }; bits += i.toString(2).padStart(5, '0'); }
    const b = []; for (let i = 0; i + 8 <= bits.length; i += 8) b.push(parseInt(bits.slice(i, i + 8), 2));
    // 末尾の詰め物を考えて、チェックが合う長さを探す
    for (let L = b.length; L >= Math.max(10, b.length - 1); L--) {
      const body = b.slice(0, L - 2), sum = (b[L - 2] << 8) | b[L - 1];
      if ((cyrb53(String.fromCharCode.apply(null, body), 77) & 0xffff) !== sum) continue;
      try {
        let p = 0; const u8 = () => { if (p >= body.length) throw 0; return body[p++]; };
        const vi = () => { let n = 0, m = 1, v; do { v = u8(); n += (v & 127) * m; m *= 128; } while (v & 128); return n; };
        const ver = u8(); if (ver < 1 || ver > VER) return { ok: false, msg: 'このコードはこの版では読めません' };
        const id = vi(); const pw = ((u8() << 24 >>> 0) + (u8() << 16) + (u8() << 8) + u8()).toString(16).padStart(8, '0');
        const s = fresh(id, pw); s.rec.b = vi(); s.rec.w = vi(); s.rec.mobs = vi(); s.rec.best = vi();
        if (ver >= 2) { const ST = ver >= 4 ? STAGES : ['senju', 'joban', 'ueno'], m = vi(); for (let i = 0; i < m; i++) { const c = vi(); if (ST[i]) s.clear[ST[i]] = c; } } else delete s.clear; // 古いコードは勝ち数から
        if (ver >= 3) { s.wins = { tobatoban: vi(), yoshinoshin: vi() }; s.tickets = vi(); const fl = vi(); s.uenoOpen = !!(fl & 1); s.akibaOpen = !!(fl & 2); s.walkSeen = !!(fl & 4); if (ver >= 5) { s.wins.story = vi(); s.mig = { d: 1, exp3: 1, v5: 1, tk2: 1 }; } else delete s.mig.tk2; } else { delete s.wins; s.mig = {}; } // 古いコードは移行（追加Dを一度配る）
        const n = vi(), mask = []; for (let i = 0; i < n; i += 8) { const m = u8(); for (let j = 0; j < 8 && i + j < n; j++) mask.push(!!(m & (1 << j))); }
        if (ver >= 3) { s.chars = {}; for (let i = 0; i < n; i++) { if (!mask[i]) continue; const x = { exp: vi(), b: vi(), w: vi(), k: vi(), got: vi() * 1000, seen: 1, lv: 1, eq: [] }; if (ver >= 4) { const ne = vi(); for (let q = 0; q < ne; q++) { const e = DATA.EQUIP[vi()]; if (e) x.eq.push(e.id); } } const c = DATA.CHARS[i]; if (c) s.chars[c.id] = x; } }
        else for (let i = 0; i < n; i++) { if (!mask[i]) continue; const x = { lv: vi(), exp: vi(), b: vi(), w: vi(), k: vi(), seen: 1 }; const c = DATA.CHARS[i]; if (c) s.chars[c.id] = x; }
        if (p !== body.length) continue;
        return { ok: true, save: normalize(s) };
      } catch (e) { continue; }
    }
    return { ok: false, msg: '引き継ぎコードがちがいます（打ちまちがいがないか確認してください）' };
  }
  /** 引き継ぎ：コード＋ID＋パスワードがそろったときだけ、この端末に書き込む */
  function restore(id, pw, code, overwrite) {
    if (!validId(id)) return { ok: false, msg: `IDは${ID_MIN}〜${ID_MAX}の番号です` };
    const d = decode(code); if (!d.ok) return d;
    if (d.save.id !== id) return { ok: false, msg: `このコードはID ${d.save.id} のものです` };
    if (d.save.pw !== pwHash(id, pw)) return { ok: false, msg: 'IDかパスワードがちがいます' };
    if (!storageOk()) return { ok: false, msg: 'この画面ではセーブできません（プライベートブラウズなど）' };
    const cur = load(id);
    if (cur && !overwrite) return { ok: false, confirm: true, msg: `この端末にもID ${id} のセーブがあります。もう一度押すとコードの内容で上書きします` };
    const s = d.save; if (cur) { s.party = cur.party; s.swap = cur.swap; s.items = cur.items; s.nick = cur.nick; s.created = cur.created; }
    if (!write(s)) return { ok: false, msg: 'セーブできませんでした' };
    try { if (id >= nextId()) localStorage.setItem(NEXT, String(id + 1)); } catch (e) { }
    return { ok: true, save: s, msg: `ID ${id} の続きを引き継ぎました` };
  }
  return { VER, ID_MIN, ID_MAX, PW_MIN, PW_MAX, STAGES, eqSlots, setEquip, equipOwner, uniqEq, pwHash, validId, parseId, checkPw, storageOk, fresh, normalize, load, write, nextId, register, login, apply, owns, lvOf, gachaPool, gachaRates, gachaDraw, gachaExchange, encode, decode, restore };
})();
