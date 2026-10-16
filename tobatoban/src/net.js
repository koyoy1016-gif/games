/* =====================================================================
   net.js — 通信（ホスト権威）。DOM 非依存。
   ・GitHub Pages など: Trystero(Nostr信号) の WebRTC P2P。ログイン不要。
   ・claude.ai のアーティファクト内: room の presence（4KiB・約30回/秒）。
   ホストが sim を進め、参加者は入力だけを送る。参加者は状態スナップショットを補間し、
   自分の移動だけ予測して表示する。
   ===================================================================== */
const NETLIB = (() => {
  const VERSION = 'tb7'; // 通信の形が変わったら上げる（古い版とは同じ部屋に入れない）
  const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  let clock = null; // 検査用に時計を差しかえられる
  const now = () => clock ? clock() : (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- 開発者向けの通信ログ（?debug=net で画面にも出す） ---------- */
  const LOG = []; let logT0 = 0; const logL = new Set();
  function log(tag, msg) {
    const T = now(); if (!logT0) logT0 = T;
    const e = { t: +((T - logT0) / 1000).toFixed(2), tag, msg: msg == null ? '' : String(msg).slice(0, 200) };
    LOG.push(e); if (LOG.length > 300) LOG.shift();
    try { if (typeof location !== 'undefined' && /debug=net/.test(location.search)) console.debug('[net]', e.t, tag, e.msg); } catch (er) { }
    for (const f of logL) try { f(e); } catch (er) { }
  }
  /* ---------- トランスポート ---------- */
  // 追加のICEサーバー（TURNなど）。公開HTMLへ長期の秘密は書かない。短期の認証情報を返すURLを使うときは ICE_URL へ
  const ICE = { turn: [], url: '' };
  class P2PTransport {
    static async open(code, base) {
      const t0 = now(); log('lib', '読み込み開始');
      const mod = await import(base || './trystero-nostr.js');
      log('lib', `読み込み完了 ${Math.round(now() - t0)}ms`);
      let turn = ICE.turn.slice();
      if (ICE.url) { try { const r = await fetch(ICE.url); const j = await r.json(); if (Array.isArray(j.iceServers)) turn = turn.concat(j.iceServers); log('ice', `TURN設定を取得 ${turn.length}件`); } catch (e) { log('ice', 'TURN設定を取得できない: ' + (e && e.message)); } }
      const holder = { tr: null, err: [] };
      const cfg = { appId: 'kitasenju-tobatoban-v1', password: code };
      if (turn.length) cfg.turnConfig = turn;
      const room = mod.joinRoom(cfg, 'tb-' + hashStr(code), {
        onJoinError: e => { const m = (e && e.error) || 'join error'; log('join-error', m); holder.err.push(m); if (holder.tr && holder.tr.h.err) holder.tr.h.err(m, e && e.peerId); },
      });
      log('room', `参加要求（ルーム tb-${hashStr(code)}・自分 ${String(mod.selfId).slice(0, 6)}）`);
      const tr = new P2PTransport(room, mod.selfId); holder.tr = tr; tr.errs = holder.err; return tr;
    }
    constructor(room, self) {
      this.kind = 'p2p'; this.self = self; this.room = room; this.h = {}; this.failN = 0;
      this.act = room.makeAction('m');
      this.act.onMessage = (d, ctx) => { if (d && typeof d === 'object' && ctx && ctx.peerId && this.h.msg) this.h.msg(d, ctx.peerId); };
      room.onPeerJoin = id => { log('peer-join', String(id).slice(0, 6)); this.h.join && this.h.join(id); };
      room.onPeerLeave = id => { log('peer-leave', String(id).slice(0, 6)); this.h.leave && this.h.leave(id); };
    }
    on(k, f) { this.h[k] = f; }
    sendFail(e, t) { this.failN++; if (this.failN <= 5 || this.failN % 50 === 0) log('send-fail', `${t || ''} ${(e && e.message) || e}（${this.failN}回目）`); }
    send(msg, target) {
      try { const p = this.act.send(msg, target ? { target } : undefined); if (p && p.catch) p.catch(e => this.sendFail(e, msg && msg.t)); } catch (e) { this.sendFail(e, msg && msg.t); }
    }
    peerIds() { try { return Object.keys(this.room.getPeers() || {}); } catch (e) { return []; } }
    leave() { log('room', '退出'); try { this.room.leave(); } catch (e) { } }
  }
  /** claude.ai room: 送信は presence の各欄（型ごと）に置き、受信は presence の変化で知る */
  class RoomTransport {
    static async open(roomCap, code) { const r = await roomCap.join('tb-' + hashStr(code).slice(0, 20)); return new RoomTransport(r); }
    constructor(r) {
      this.kind = 'room'; this.r = r; this.h = {}; this.seen = new Map(); this.self = null; this.peers = new Set(); this.pending = null; this.flushAt = 0;
      r.onPeers(ch => {
        for (const p of ch.peers) if (p.sameTab) this.self = p.peer;
        for (const p of ch.left) if (!p.sameTab && this.peers.delete(p.peer)) { this.seen.delete(p.peer); this.h.leave && this.h.leave(p.peer); }
        for (const p of ch.peers) {
          if (p.sameTab || p.kind !== 'viewer') continue;
          if (!this.peers.has(p.peer)) { this.peers.add(p.peer); this.h.join && this.h.join(p.peer); }
          const last = this.seen.get(p.peer) || {}; const pr = p.presence || {}; const nx = {};
          for (const k in pr) { nx[k] = pr[k]; const m = pr[k]; if (m && m !== last[k] && typeof m === 'object' && (!m.to || m.to === this.self) && this.h.msg) this.h.msg(m, p.peer); }
          this.seen.set(p.peer, nx);
        }
      });
    }
    on(k, f) { this.h[k] = f; }
    send(msg, target) { if (target) msg = Object.assign({}, msg, { to: target }); this.pending = Object.assign(this.pending || {}, { [msg.t]: msg }); const T = now(); if (T >= this.flushAt) this.flush(); }
    flush() { if (!this.pending) return; const p = this.pending; this.pending = null; this.flushAt = now() + 33; this.r.presence(p).catch(() => { }); }
    tick() { if (this.pending && now() >= this.flushAt) this.flush(); }
    clear(t) { this.r.presence({ [t]: null }).catch(() => { }); }
    leave() { try { this.r.leave(); } catch (e) { } }
  }
  /** 開発・自動テスト用：同じブラウザ内のタブ同士を BroadcastChannel でつなぐ（?net=bc） */
  class BCTransport {
    static async open(code) { return new BCTransport(code); }
    constructor(code) {
      this.kind = 'bc'; this.self = Math.random().toString(36).slice(2, 10); this.ch = new BroadcastChannel('tb-' + code); this.h = {}; this.peers = new Map();
      this.ch.onmessage = e => { const d = e.data; if (!d || d.from === this.self || (d.to && d.to !== this.self) || this.mute) return;
        if (d.k === 'bye') { if (this.peers.delete(d.from)) this.h.leave && this.h.leave(d.from); return; }
        if (!this.peers.has(d.from)) { this.peers.set(d.from, 1); this.h.join && this.h.join(d.from); }
        if (d.k === 'm' && this.h.msg) this.h.msg(d.m, d.from); };
      this.hb = setInterval(() => { if (!this.mute) this.ch.postMessage({ from: this.self, k: 'hb' }); }, 1000); this.ch.postMessage({ from: this.self, k: 'hb' }); // mute：検査用に通信の途切れを作る
    }
    on(k, f) { this.h[k] = f; }
    send(m, target) { if (this.closed) return; if (this.mute) return; try { this.ch.postMessage({ from: this.self, to: target || null, k: 'm', m }); } catch (e) { } }
    peerIds() { return [...this.peers.keys()]; }
    leave() { if (this.closed) return; try { this.ch.postMessage({ from: this.self, k: 'bye' }); } catch (e) { } this.closed = true; clearInterval(this.hb); this.ch.close(); }
  }
  /** テスト用：メモリ内で遅延・重複・欠落を再現する */
  class LoopHub { constructor(o) { this.o = Object.assign({ lat: 0.05, dup: 0, drop: 0 }, o); this.nodes = new Map(); this.q = []; this.t = 0; this.rng = new SIMLIB.RNG(9); }
    add(id) { const tr = new LoopTransport(this, id); for (const [oid, o] of this.nodes) { this.q.push({ at: this.t, f: () => { o.h.join && o.h.join(id); tr.h.join && tr.h.join(oid); } }); } this.nodes.set(id, tr); return tr; }
    deliver(from, msg, target) { if (this.muted && this.muted.has(from)) return; const copies = this.rng.next() < this.o.dup ? 2 : 1; for (const [id, n] of this.nodes) { if (id === from || (target && target !== id) || (this.muted && this.muted.has(id))) continue; for (let c = 0; c < copies; c++) { if (this.rng.next() < this.o.drop) continue; const m = JSON.parse(JSON.stringify(msg)); this.q.push({ at: this.t + this.o.lat * (0.8 + 0.4 * this.rng.next()) + c * 0.01, f: () => n.h.msg && n.h.msg(m, from) }); } } }
    advance(dt) { this.t += dt; this.q.sort((a, b) => a.at - b.at); while (this.q.length && this.q[0].at <= this.t) this.q.shift().f(); }
    mute(id, on) { this.muted = this.muted || new Set(); if (on) this.muted.add(id); else this.muted.delete(id); } // 検査用：一時的な途切れ
    remove(id) { this.nodes.delete(id); for (const [, n] of this.nodes) n.h.leave && n.h.leave(id); } }
  class LoopTransport { constructor(hub, id) { this.kind = 'loop'; this.hub = hub; this.self = id; this.h = {}; } on(k, f) { this.h[k] = f; } send(m, target) { this.hub.deliver(this.self, m, target); } leave() { this.hub.remove(this.self); } }

  /* ---------- 自分の入力 ---------- */
  class LocalInput {
    constructor() { this.mx = 0; this.mz = 0; this.hold = { A: 0, X: 0, Y: 0, B: 0 }; this.ev = []; this.evId = 0; this.lock = null; this.healT = null; }
    push(code, arg) { this.evId++; const e = arg !== undefined ? [this.evId, code, arg] : [this.evId, code]; this.ev.push(e); if (this.ev.length > 24) this.ev.shift(); return this.evId; }
    syncFrom(lastEv) { if (this.evId < lastEv) this.evId = lastEv; }
    toSim() { return { mx: this.mx, mz: this.mz, hold: this.hold, ev: this.ev, lock: this.lock, healT: this.healT }; }
  }

  /* ---------- ホスト（ソロも同じクラス。transport なし） ---------- */
  class HostSession {
    constructor(o) {
      this.tr = o.transport || null; this.kind = this.tr ? 'host' : 'solo'; this.code = o.code || '';
      this.local = new LocalInput(); this.mySlot = 0; this.sim = null; this.gid = 0; this.acc = 0; this.snapAcc = 0;
      this.views = []; this.clients = new Map(); this.notices = []; this.timeScale = 1; this.paused = false;
      this.lobby = { diff: 'normal', slots: [{ who: 'host', peer: this.tr ? this.tr.self : 'me', nick: o.nick || 'P1', ch: o.ch || 'kogemaru', swap: !!o.swap, items: o.items || ['onigiri', 'ramune'], lv: o.lv || 1 }, null, null, null], aiParty: o.aiParty || DATA.DEFAULT_PARTY.slice(), lvs: o.lvs || {}, stage: 'senju', phase: 'lobby' };
      this.lastLobbySend = 0;
      if (this.tr) {
        this.tr.on('msg', (m, from) => this.onMsg(m, from));
        this.tr.on('leave', id => this.onLeave(id));
        this.tr.on('join', id => { this.dirtyLobby = true; try { this.tr.send(this.lobbyMsg(), id); } catch (e) { } log('host', `相手を発見 → ロビー情報を送信 ${String(id).slice(0, 6)}`); }); // 見つけたらすぐ知らせる（1秒待たない）
        this.tr.on('err', m => this.notice('通信の準備に失敗した相手がいます（' + String(m).slice(0, 60) + '）'));
      }
    }
    onMsg(m, from) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hi') {
        if (m.v !== VERSION) { this.tr.send({ t: 'no', why: 'version' }, from); return; }
        let c = this.clients.get(from);
        if (!c) {
          if (this.lobby.phase !== 'lobby') { this.tr.send({ t: 'no', why: 'started' }, from); return; }
          const free = this.lobby.slots.findIndex((s, i) => i > 0 && !s);
          if (free < 0) { this.tr.send({ t: 'no', why: 'full' }, from); return; }
          c = { peer: from, slot: free, lastSeen: now(), inp: null, q: 0, pt: 0, st: '' };
          this.clients.set(from, c); this.notice(`${String(m.nick || '').slice(0, 10) || '参加者'}さんが入りました`); log('host', `参加 P${free + 1} ${String(from).slice(0, 6)}`);
        }
        c.lastSeen = now();
        const ch = DATA.CHI[m.ch] ? m.ch : 'kogemaru';
        const items = Array.isArray(m.items) ? m.items.filter(i => DATA.ITEMS[i]).slice(0, 2) : ['onigiri', 'ramune']; while (items.length < 2) items.push('onigiri');
        this.lobby.slots[c.slot] = { who: 'peer', peer: from, nick: String(m.nick || '').slice(0, 10) || ('P' + (c.slot + 1)), ch, swap: !!m.swap, items, ready: !!m.ready, lv: Math.min(99, Math.max(1, m.lv | 0 || 1)), eq: Array.isArray(m.eq) ? m.eq.filter((e, i, a) => DATA.EQUIP_I[e] && a.indexOf(e) === i).slice(0, 2) : [] };
        this.dirtyLobby = true;
      } else if (m.t === 'in') {
        const c = this.clients.get(from); if (!c) return;
        c.lastSeen = now();
        if (c.stale) { c.stale = false; if (this.sim) { const a = this.sim.allies[c.slot]; if (a) a.ctrlAI = false; } this.notice(`P${c.slot + 1}の通信が戻りました`); log('host', `P${c.slot + 1} 復帰`); }
        if (m.g !== this.gid || !this.sim) return;
        c.loaded = true; c.st = m.st || '';
        if (m.q <= c.q) return; // 古い・重複した入力は捨てる
        c.q = m.q; c.pt = m.pt || 0;
        const hold = { A: m.h & 1 ? 1 : 0, X: m.h & 2 ? 1 : 0, Y: m.h & 4 ? 1 : 0, B: m.h & 8 ? 1 : 0 };
        const mx = +m.mx || 0, mz = +m.mz || 0, l = Math.hypot(mx, mz);
        c.inp = { mx: l > 1 ? mx / l : mx, mz: l > 1 ? mz / l : mz, hold, ev: Array.isArray(m.ev) ? m.ev.filter(e => Array.isArray(e) && typeof e[0] === 'number').slice(-24) : [], lock: typeof m.lk === 'string' ? m.lk : null, healT: typeof m.ht === 'number' ? m.ht : null };
      } else if (m.t === 'bye') this.onLeave(from);
    }
    onLeave(id) {
      const c = this.clients.get(id); if (!c) return;
      this.clients.delete(id); log('host', `P${c.slot + 1} を外す`);
      if (this.lobby.phase === 'lobby') this.lobby.slots[c.slot] = null;
      else if (this.sim) { const a = this.sim.allies[c.slot]; a.ctrlAI = true; this.notice(`P${c.slot + 1}の通信が切れたため、AIが引き継ぎます`); this.sim.ev('sig', { slot: c.slot, code: 'left' }); }
      this.dirtyLobby = true;
    }
    notice(s) { this.notices.push({ s, t: now() }); }
    lobbyMsg() { return { t: 'lb', v: VERSION, code: this.code, diff: this.lobby.diff, stage: this.lobby.stage || 'senju', phase: this.lobby.phase, gid: this.gid, slots: this.lobby.slots.map(s => s ? { who: s.who, peer: s.peer, nick: s.nick, ch: s.ch, swap: s.swap, items: s.items, lv: s.lv || 1, eq: s.eq || [] } : null), ai: this.aiFill(), aiLv: this.aiFill().map(c => c ? (this.lobby.lvs[c] || 1) : 0) }; }
    aiFill() { const taken = new Set(this.lobby.slots.filter(Boolean).map(s => s.ch)); const pool = this.lobby.aiParty.concat(DATA.CHARS.map(c => c.id)).filter((c, i, a) => a.indexOf(c) === i && !taken.has(c)); return this.lobby.slots.map(s => s ? null : pool.shift()); }
    setMine(o) { Object.assign(this.lobby.slots[0], o); this.dirtyLobby = true; }
    startGame(o) {
      o = o || {};
      const fill = this.aiFill();
      const party = this.lobby.slots.map((s, i) => s ? { ch: s.ch, swap: s.swap, items: s.items, nick: s.nick, lv: s.lv || 1, eq: s.eq || [] } : { ch: fill[i], swap: false, items: ['onigiri', 'ramune'], nick: 'AI', lv: this.lobby.lvs[fill[i]] || 1 });
      if (o.party) o.party.forEach((p, i) => { if (!this.lobby.slots[i] || i === 0) Object.assign(party[i], p); });
      this.gid++; this.lobby.phase = 'game';
      this.sim = new Sim({ party, diff: this.lobby.diff, stageId: o.stageId || this.lobby.stage, seed: (Math.random() * 1e9) | 0, bid: o.bid || ('b' + Date.now().toString(36) + this.gid), carry: o.carry || null });
      this.sim.allies.forEach((a, i) => { a.ctrlAI = !this.lobby.slots[i] || (this.lobby.slots[i].who === 'peer' && !this.clients.has(this.lobby.slots[i].peer)); });
      for (const c of this.clients.values()) { c.q = 0; c.inp = null; c.loaded = false; }
      this.local = new LocalInput(); this.mySlot = 0; this.acc = 0; this.views = []; this.waitT = this.kind === 'host' ? 0 : -1;
      this.dirtyLobby = true; this.sendLobby();
      return this.sim;
    }
    backToLobby() { this.lobby.phase = 'lobby'; this.sim = null; this.dirtyLobby = true; this.sendLobby(); }
    sendLobby() { if (this.tr) { this.tr.send(this.lobbyMsg()); this.lastLobbySend = now(); this.dirtyLobby = false; } }
    /** ソロの操作キャラ切替 */
    swapTo(slot) {
      if (this.kind !== 'solo' || !this.sim) return false; const a = this.sim.allies[slot]; if (!a || a.st !== 'ok') return false;
      this.sim.allies[this.mySlot].ctrlAI = true; a.ctrlAI = false; this.mySlot = slot; this.local.syncFrom(a.lastEv); this.local.ev = []; return true;
    }
    update(dt) {
      if (this.closed) return;
      if (this.tr) {
        if (this.tr.tick) this.tr.tick();
        const T = now();
        if (this.dirtyLobby || T - this.lastLobbySend > 1000) this.sendLobby();
        for (const c of [...this.clients.values()]) {
          const gap = T - c.lastSeen;
          if (gap > DATA.NET.hostDropT * 1000) this.onLeave(c.peer);
          else if (gap > DATA.NET.timeout * 1000 && this.sim && this.lobby.phase === 'game' && !c.stale) { // 一時的な途切れ：AIが代わりに動き、戻れば操作に戻る
            c.stale = true; const a = this.sim.allies[c.slot]; if (a) a.ctrlAI = true;
            this.notice(`P${c.slot + 1}の通信がとだえています（戻るまでAIが動かします）`); log('host', `P${c.slot + 1} 無応答 ${Math.round(gap / 1000)}秒`);
          }
        }
      }
      const sim = this.sim; if (!sim || this.paused) return;
      // 参加者の読み込み待ち（最大8秒）
      if (this.waitT >= 0) { this.waitT += dt; const all = [...this.clients.values()].every(c => c.loaded); if (all || this.waitT > 8) this.waitT = -1; else { this.pushView(); return; } }
      // 登場演出は全員がその画面を受け取ってから始める
      if (sim.stage === 'intro' && sim.stageT < 0.05 && !sim._introChecked && this.kind === 'host') { sim.introWait = true; sim._introChecked = true; this.introWaitT = 0; }
      if (sim.introWait) { this.introWaitT += dt; if ([...this.clients.values()].every(c => c.st === 'intro' || c.st === 'boss') || this.introWaitT > 3) sim.startIntroNow(); }
      this.acc += Math.min(dt, 0.25) * this.timeScale;
      let stepped = false;
      while (this.acc >= sim.dt) {
        this.acc -= sim.dt;
        for (const a of sim.allies) {
          if (a.slot === this.mySlot && this.kind !== 'client' && !a.ctrlAI) { sim.setInput(a.slot, this.local.toSim()); continue; }
          const c = [...this.clients.values()].find(c => c.slot === a.slot);
          if (c && !a.ctrlAI) { if (c.inp) { sim.setInput(a.slot, c.inp); a.aq = c.q; } continue; }
          sim.setInput(a.slot, sim.aiInput(a, sim.inputs[a.slot]));
        }
        sim.step(); stepped = true; this.pushView();
      }
      if (this.tr) {
        this.snapAcc += dt;
        if (this.snapAcc >= 1 / DATA.NET.snapHz) {
          this.snapAcc = 0;
          const pe = [0, 0, 0, 0]; for (const c of this.clients.values()) pe[c.slot] = c.pt;
          this.tr.send(PROTO.encodeSnap(sim, { gid: this.gid, pe, maxBytes: this.tr.kind === 'room' ? 3000 : 0, evAge: 0.7 })); // room の presence は lb と合わせて4KiBまで
        }
      }
    }
    pushView() { const v = PROTO.decodeSnap(PROTO.encodeSnap(this.sim, { gid: this.gid, evAge: 0.3 })); this.views.push(v); if (this.views.length > 3) this.views.shift(); }
    view() {
      if (!this.views.length && this.sim) this.pushView();
      const n = this.views.length; if (!n) return null;
      const k = this.sim ? this.acc / this.sim.dt : 1;
      return n > 1 ? PROTO.interp(this.views[n - 2], this.views[n - 1], k) : this.views[n - 1];
    }
    ping() { return 0; }
    /** 画面を裏にしていた分は無応答に数えない */
    resume(ms) { for (const c of this.clients.values()) c.lastSeen += ms || 0; }
    get state() { return !this.tr ? 'solo' : this.lobby.phase === 'game' ? 'game' : 'lobby'; }
    leave() { if (this.closed) return; this.closed = true; if (this.tr) { this.tr.send({ t: 'end' }); this.tr.leave(); } }
  }

  /* ---------- 参加者 ----------
     状態：connecting（相手を探している）→ handshake（相手は見つかった・ロビー情報待ち）→ lobby → game、
     接続後に無応答が続くと reconnecting、さらに続くと lost。接続前と接続後で待つ時間を分ける */
  class ClientSession {
    constructor(o) {
      this.tr = o.transport; this.kind = 'client'; this.code = o.code || ''; this.me = o.me; this.local = new LocalInput();
      this.lobby = null; this.mySlot = -1; this.buf = []; this.gid = 0; this.q = 0; this.sendAcc = 0; this.hiAcc = 99; this.t0 = now(); this.lastRecv = 0; this.rejected = null;
      this.offset = null; this.pred = null; this.hist = []; this.rtt = 0; this.lastStage = ''; this.lastV = null; this.hostPeer = null;
      this.peerSeen = false; this.joinErr = null; this.st = 'connecting'; this.gotSnap = false;
      this.tr.on('msg', (m, from) => this.onMsg(m, from));
      this.tr.on('join', id => { this.peerSeen = true; if (this.st === 'connecting') this.setSt('handshake'); if (this.helloMsg) { this.tr.send(this.helloMsg, id); this.hiAcc = 0; log('client', `相手を発見 → あいさつ送信 ${String(id).slice(0, 6)}`); } });
      this.tr.on('leave', id => { if (id === this.hostPeer) log('client', 'ホストとの接続が切れた（戻るのを待つ）'); });
      this.tr.on('err', m => { this.joinErr = m; });
      if (this.tr.errs && this.tr.errs.length) this.joinErr = this.tr.errs[0];
      log('client', `参加開始 合言葉 ${this.code}`);
    }
    setSt(s) { if (this.st !== s) { log('state', `${this.st} → ${s}`); this.st = s; } }
    get state() { return this.st; }
    onMsg(m, from) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'lb') {
        if (m.v !== VERSION) { this.rejected = 'version'; log('client', `版が違う ${m.v}`); return; }
        if (!this.lobby) log('client', `ロビー情報を受信（${((now() - this.t0) / 1000).toFixed(1)}秒）`);
        this.lastRecv = now(); this.hostPeer = from; this.lobby = m; this.peerSeen = true;
        const i = (m.slots || []).findIndex(s => s && s.peer === this.tr.self); this.mySlot = i;
        if (m.phase === 'game' && m.gid !== this.gid) { this.gid = m.gid; this.buf = []; this.q = 0; this.local = new LocalInput(); this.pred = null; this.hist = []; this.offset = null; this.started = true; this.gotSnap = false; log('client', '戦闘開始'); }
        if (m.phase === 'lobby') { this.started = false; }
      } else if (m.t === 'sn') {
        if (m.g !== this.gid) return;
        this.lastRecv = now(); this.hostPeer = from;
        if (!this.gotSnap) { this.gotSnap = true; log('client', '最初の戦闘状態を受信'); }
        const T = now() / 1000, off = T - m.tm;
        this.offset = this.offset == null ? off : Math.min(off, this.offset + 0.002); // 遅延の少ない方へ寄せる
        if (this.buf.length && m.tm <= this.buf[this.buf.length - 1].tm) return; // 重複・逆順は捨てる
        const v = PROTO.decodeSnap(m); this.buf.push(v); if (this.buf.length > 30) this.buf.shift();
        if (m.pe && this.mySlot >= 0 && m.pe[this.mySlot]) this.rtt = this.rtt ? this.rtt * 0.8 + (now() - m.pe[this.mySlot]) * 0.2 : now() - m.pe[this.mySlot];
        this.reconcile(v);
      } else if (m.t === 'no') { this.rejected = m.why; log('client', `入室を断られた ${m.why}`); }
      else if (m.t === 'end') { this.lost = 'host_left'; log('client', 'ホストが部屋を閉じた'); }
    }
    hello(o) { this.helloMsg = Object.assign({ t: 'hi', v: VERSION }, o); this.hiAcc = 99; }
    /** 画面を裏にしていた分は無応答に数えない */
    resume(ms) { ms = ms || 0; this.t0 += ms; if (this.lastRecv) this.lastRecv += ms; }
    update(dt) {
      if (this.closed) return;
      if (this.tr.tick) this.tr.tick();
      const T = now();
      if (!this.lobby) { // 接続前：相手探し・接続・最初のロビー情報まで
        if (T - this.t0 > DATA.NET.connectTimeout * 1000 && !this.lost) { this.lost = this.joinErr ? 'p2p_failed' : this.peerSeen ? 'no_lobby' : 'no_peer'; log('client', `接続できない（${this.lost}${this.joinErr ? '：' + this.joinErr : ''}）`); this.setSt('lost'); }
      } else { // 接続後：とだえたら「再接続中」、長く続けば切断
        const gap = T - this.lastRecv;
        if (gap > DATA.NET.dropT * 1000) { if (!this.lost) { this.lost = 'timeout'; log('client', `無応答 ${Math.round(gap / 1000)}秒で切断`); } this.setSt('lost'); }
        else if (gap > DATA.NET.timeout * 1000) this.setSt('reconnecting');
        else this.setSt(this.started ? 'game' : 'lobby');
      }
      this.hiAcc += dt;
      if (this.helloMsg && this.hiAcc > 1 && (!this.started || this.st === 'reconnecting')) { this.hiAcc = 0; this.tr.send(this.helloMsg, this.st === 'reconnecting' ? undefined : (this.hostPeer || undefined)); }
      if (!this.started || this.mySlot < 0) return;
      // 自分の移動を予測
      const v = this.latest();
      if (v) this.predictStep(v, dt);
      this.sendAcc += dt;
      if (this.sendAcc >= 1 / DATA.NET.inputHz) {
        this.sendAcc = 0; this.q++;
        const L = this.local, h = (L.hold.A ? 1 : 0) | (L.hold.X ? 2 : 0) | (L.hold.Y ? 4 : 0) | (L.hold.B ? 8 : 0);
        this.tr.send({ t: 'in', g: this.gid, q: this.q, mx: Math.round(L.mx * 100) / 100, mz: Math.round(L.mz * 100) / 100, h, ev: L.ev.slice(-16), lk: L.lock, ht: L.healT, pt: Math.round(now()), st: v ? v.stage : '' }, this.hostPeer || undefined);
        this.hist.push({ q: this.q, dx: this.pendDx || 0, dz: this.pendDz || 0 }); this.pendDx = 0; this.pendDz = 0;
        if (this.hist.length > 90) this.hist.shift();
      }
    }
    latest() { return this.buf.length ? this.buf[this.buf.length - 1] : null; }
    predictStep(v, dt) {
      const me = v.allies[this.mySlot]; if (!me) return;
      if (!this.pred) this.pred = { x: me.x, z: me.z, yaw: me.yaw };
      const L = this.local; let mx = L.mx, mz = L.mz; const l = Math.hypot(mx, mz);
      let mul = 0;
      if (me.st === 'ok' && !me.lanHold && me.revT < 0) mul = !me.act ? 1 : me.act === 'charge' ? DATA.SIM.chargeMoveMul : me.act === 'shot' && me.actT >= DATA.MOVES.shot.lock ? 1 : 0;
      if (l > 0.1 && mul > 0) {
        if (l > 1) { mx /= l; mz /= l; }
        const dash = L.hold.B && !me.act && !me.tired && (me.stam > 0 || me.ramune);
        const s = (dash ? DATA.SIM.dash : DATA.SIM.walk) * mul * dt;
        const nx = this.pred.x + mx * s, nz = this.pred.z + mz * s;
        const c = Sim.prototype.clampPos.call({ barrier: v.barrier, boss: v.boss, stageId: v.stageId, clampTrain: Sim.prototype.clampTrain }, this.pred.x, this.pred.z, nx, nz, 0.35);
        this.pendDx = (this.pendDx || 0) + c[0] - this.pred.x; this.pendDz = (this.pendDz || 0) + c[1] - this.pred.z;
        this.pred.x = c[0]; this.pred.z = c[1]; this.pred.yaw = SIMLIB.yawTo(mx, mz);
      }
    }
    reconcile(v) {
      const me = v.allies[this.mySlot]; if (!me || !this.pred) return;
      // サーバー位置 + まだ反映されていない自分の入力ぶんの移動
      let x = me.x, z = me.z; for (const h of this.hist) if (h.q > me.aq) { x += h.dx; z += h.dz; }
      x += this.pendDx || 0; z += this.pendDz || 0;
      const ex = x - this.pred.x, ez = z - this.pred.z, e = Math.hypot(ex, ez);
      if (e > 2.5 || me.st !== 'ok' || (me.act && me.act !== 'charge' && me.act !== 'shot')) { this.pred.x = x; this.pred.z = z; this.pred.yaw = me.yaw; }
      else { this.pred.x += ex * 0.35; this.pred.z += ez * 0.35; }
    }
    view() {
      if (!this.buf.length) return null;
      const T = now() / 1000 - (this.offset || 0) - DATA.NET.interp;
      let i = this.buf.length - 1; while (i > 0 && this.buf[i - 1].tm > T) i--;
      const b1 = this.buf[i], b0 = i > 0 ? this.buf[i - 1] : null;
      let v = b1;
      if (b0 && b1.tm > b0.tm) { const k = Math.max(0, Math.min(1, (T - b0.tm) / (b1.tm - b0.tm))); v = PROTO.interp(b0, b1, k); }
      // 演出イベントは最新のものも使う（取りこぼし防止。idで重複排除するのは描画側）
      const last = this.latest(); if (last !== v) { v = Object.assign({}, v, { ev: (v.ev || []).concat(last.ev || []) }); }
      if (this.pred && this.mySlot >= 0 && v.allies[this.mySlot]) { v = Object.assign({}, v); v.allies = v.allies.slice(); v.allies[this.mySlot] = Object.assign({}, last.allies[this.mySlot], { x: this.pred.x, z: this.pred.z, yaw: last.allies[this.mySlot].act ? last.allies[this.mySlot].yaw : this.pred.yaw }); }
      return v;
    }
    ping() { return Math.round(this.rtt); }
    leave() { if (this.closed) return; this.closed = true; log('client', '退出'); try { this.tr.send({ t: 'bye' }, this.hostPeer || undefined); } catch (e) { } this.tr.leave(); }
  }
  return { VERSION, LOG, log, onLog: f => logL.add(f), ICE, setClock: f => { clock = f; }, hashStr, P2PTransport, RoomTransport, BCTransport, LoopHub, LocalInput, HostSession, ClientSession };
})();
