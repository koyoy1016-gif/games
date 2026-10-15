/* =====================================================================
   save.js — セーブデータ（配られたID＋自分で決めたパスワード）と引き継ぎコード
   サーバーなし：データはこの端末のブラウザ（localStorage）に保存する。
   パスワードそのものは保存せず、IDとまぜたハッシュだけを持つ。
   別の端末へは「引き継ぎコード」＋ID＋パスワードで移す。three.js 非依存。
   IDは1〜10000。アカウントを作った順に自動で決まる（いまはこの端末の中での順番）。
   ===================================================================== */
const SAVE = (() => {
  const ID_MIN = 1, ID_MAX = 10000, VER = 2, KEY = 'tb.acct.', NEXT = 'tb.acctNext', STORE_VER = 'tb.saveVer', PW_MIN = 6, PW_MAX = 32; // Firebase のパスワードは6文字以上
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
  function freshChars() { const o = {}; for (const c of DATA.CHARS) o[c.id] = { lv: 1, exp: 0, b: 0, w: 0, k: 0 }; return o; }
  const STAGES = ['senju', 'joban']; // クリアした回数をステージごとに持つ
  function freshClear() { const o = {}; for (const k of STAGES) o[k] = 0; return o; }
  function fresh(id, pw) { return { v: VER, id, pw, created: Date.now(), saved: 0, chars: freshChars(), rec: { b: 0, w: 0, mobs: 0, best: 0 }, clear: freshClear(), party: null, swap: null, items: null, nick: '' }; }
  /** 古い形式や、あとで増えたキャラにも対応させる */
  function normalize(s) {
    if (!s || typeof s !== 'object') return null;
    const f = fresh(s.id, s.pw);
    const o = Object.assign(f, s); o.chars = Object.assign(freshChars(), s.chars || {}); o.rec = Object.assign(f.rec, s.rec || {});
    o.clear = Object.assign(freshClear(), s.clear || {});
    if (!s.clear && o.rec.w > 0) o.clear.senju = Math.floor(+o.rec.w || 0); // ステージが1つだった頃の勝ち＝トバトーバン戦
    for (const k in o.clear) o.clear[k] = Math.max(0, Math.floor(+o.clear[k] || 0));
    for (const c of DATA.CHARS) { const x = o.chars[c.id]; for (const k of ['lv', 'exp', 'b', 'w', 'k']) x[k] = Math.max(k === 'lv' ? 1 : 0, Math.floor(+x[k] || 0)); }
    return o;
  }
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

  /** 戦いの記録を足す。op = { kills: {キャラID: 倒した数}, fin: null | { ids: [...], win, time } } */
  function apply(s, op) {
    for (const id in op.kills || {}) { const c = s.chars[id]; if (!c) continue; const k = op.kills[id] | 0; c.k += k; s.rec.mobs += k; }
    const f = op.fin;
    if (f) {
      const st = f.stage || 'senju';
      s.rec.b++; if (f.win) { s.rec.w++; s.clear[st] = (s.clear[st] | 0) + 1; if (st === 'senju' && f.time > 0 && (!s.rec.best || f.time < s.rec.best)) s.rec.best = Math.round(f.time); }
      for (const id of f.ids) { const c = s.chars[id]; if (!c) continue; c.b++; if (f.win) c.w++; }
    }
    // レベルの上がり方はあとで決める（いまは全員Lv.1のまま）
    return s;
  }

  /* ---------- 引き継ぎコード（base32・チェック付き） ---------- */
  function encode(s) {
    const b = [];
    const vi = n => { n = Math.max(0, Math.floor(n)); while (n >= 128) { b.push((n & 127) | 128); n = Math.floor(n / 128); } b.push(n); };
    b.push(VER); vi(s.id);
    const ph = parseInt(s.pw, 16) >>> 0; b.push(ph >>> 24, (ph >>> 16) & 255, (ph >>> 8) & 255, ph & 255);
    vi(s.rec.b); vi(s.rec.w); vi(s.rec.mobs); vi(s.rec.best);
    vi(STAGES.length); for (const k of STAGES) vi(s.clear[k] || 0);
    const n = DATA.CHARS.length; vi(n);
    const used = DATA.CHARS.map(c => { const x = s.chars[c.id]; return x.lv > 1 || x.exp || x.b || x.w || x.k; });
    for (let i = 0; i < n; i += 8) { let m = 0; for (let j = 0; j < 8 && i + j < n; j++) if (used[i + j]) m |= 1 << j; b.push(m); }
    DATA.CHARS.forEach((c, i) => { if (!used[i]) return; const x = s.chars[c.id]; vi(x.lv); vi(x.exp); vi(x.b); vi(x.w); vi(x.k); });
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
        const ver = u8(); if (ver !== 1 && ver !== VER) return { ok: false, msg: 'このコードはこの版では読めません' };
        const id = vi(); const pw = ((u8() << 24 >>> 0) + (u8() << 16) + (u8() << 8) + u8()).toString(16).padStart(8, '0');
        const s = fresh(id, pw); s.rec.b = vi(); s.rec.w = vi(); s.rec.mobs = vi(); s.rec.best = vi();
        if (ver >= 2) { const m = vi(); for (let i = 0; i < m; i++) { const c = vi(); if (STAGES[i]) s.clear[STAGES[i]] = c; } } else delete s.clear; // 古いコードは勝ち数から
        const n = vi(), mask = []; for (let i = 0; i < n; i += 8) { const m = u8(); for (let j = 0; j < 8 && i + j < n; j++) mask.push(!!(m & (1 << j))); }
        for (let i = 0; i < n; i++) { if (!mask[i]) continue; const x = { lv: vi(), exp: vi(), b: vi(), w: vi(), k: vi() }; const c = DATA.CHARS[i]; if (c) s.chars[c.id] = x; }
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
  return { ID_MIN, ID_MAX, PW_MIN, PW_MAX, pwHash, validId, parseId, checkPw, storageOk, fresh, normalize, load, write, nextId, register, login, apply, encode, decode, restore };
})();
