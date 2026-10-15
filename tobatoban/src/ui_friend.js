/* =====================================================================
   ui_friend.js — フレンド（サーバー版でログイン中だけ）
   ・フレンドコード（ランダム8文字）か招待リンク（?friend=コード）で申請 → 相手が承認
   ・フレンドのオンライン／募集中のルームが見え、「参加」でそのまま協力プレイへ。ホスト中は「招待」を送れる
   ・通信は読み込みだけ（常時接続はしない）：フレンド画面は20秒ごと（相手の状態も読む）、ほかの画面は90秒ごと（申請・招待だけ）、戦闘中は読まない
   ・自分の状態は変わったときと2分ごとに知らせる（Firestore の無料枠の読み書き回数を使いすぎないように）
   ===================================================================== */
const FRND = { data: null, busy: false, lastList: 0, lastPub: 0, pubKey: '', dismissed: new Set(), invShown: null, rmArm: null, err: '' };
const frFmt = c => CLOUD.FR.fmt(c);
function frAgo(t, now) {
  if (!t) return 'オフライン';
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return '最終 たった今'; if (m < 60) return `最終 ${m}分前`; if (m < 1440) return `最終 ${Math.floor(m / 60)}時間前`; return `最終 ${Math.floor(m / 1440)}日前`;
}
/** いまの自分の状態：ホストで仲間を待っている＝募集中、戦闘中＝プレイ中 */
function frMine() {
  const S = G.session, ch = G.party[0];
  const room = G.coop && S && S.kind === 'host' && G.mode === 'lobby' && S.code ? S.code : '';
  const act = room ? 'room' : ['play', 'pause', 'result', 'walk'].includes(G.mode) && S ? 'play' : '';
  return { nm: (G.nick || 'もののけ').slice(0, 10), ch, lv: lvOf(ch), act, room };
}
/** 状態が変わったら（または60秒ごとに）知らせる */
async function frPublish(force) {
  const F = ACCT.FR; if (!F || !F.code) return; // 裏にいても知らせる（ホストがLINEで合言葉を送っている間も「募集中」のまま）
  const m = frMine(), k = JSON.stringify(m), now = Date.now();
  if (!force && k === FRND.pubKey && now - FRND.lastPub < 120000) return;
  if (!force && now - FRND.lastPub < 2500) return; // 続けて変わるときはまとめる
  FRND.pubKey = k; FRND.lastPub = now; await F.publish(m);
}
/** 一覧を読みなおす。light：相手の状態は読まず、前回の状態に申請・招待だけ重ねる */
async function frRefresh(force, light) {
  const F = ACCT.FR; if (!F) return;
  if (FRND.busy) { if (!light) FRND.again = true; return; } // 読み込み中なら、終わってからもう一度（状態つきで）
  FRND.busy = true;
  try {
    const d = await F.list({ light: !!light });
    if (light && FRND.data) { const prev = new Map(FRND.data.friends.filter(f => !f.light).map(f => [f.pid, f])); d.friends = d.friends.map(f => prev.has(f.pid) ? Object.assign({}, prev.get(f.pid), { inv: f.inv }) : f); }
    FRND.data = d; FRND.err = '';
  }
  catch (e) { console.warn('friends', e); FRND.err = CLOUD.errMsg(e); }
  FRND.busy = false; FRND.lastList = Date.now();
  frBadge(); frInviteCheck();
  if (!$('#friend').hidden) renderFriend();
  if (FRND.again) { FRND.again = false; return frRefresh(true, false); }
}
function frBadge() {
  const d = FRND.data, n = d ? d.incoming.length + d.friends.filter(f => f.inv && !FRND.dismissed.has(f.pid + f.inv.t)).length : 0;
  const b = $('#fBadge'); b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
}
/** フレンドからの招待（5分以内）を、ホームにいるときだけ知らせる */
function frInviteCheck() {
  const d = FRND.data, box = $('#frInv');
  const f = d && !G.coop && (G.mode === 'title') && d.friends.find(x => x.inv && !FRND.dismissed.has(x.pid + x.inv.t));
  if (!f) { box.hidden = true; FRND.invShown = null; return; }
  FRND.invShown = f; box.hidden = false;
  $('#frInvTxt').textContent = `${f.nm} さんから協力プレイの招待（ルーム ${f.inv.room}）`;
}
function frTick() {
  if (!ACCT.FR) { if (!$('#frInv').hidden) $('#frInv').hidden = true; return; }
  frPublish(false);
  if (document.hidden) return;
  const inBattle = ['play', 'pause', 'walk'].includes(G.mode);
  const open = !$('#friend').hidden, every = open ? 20000 : 90000;
  if (!inBattle && Date.now() - FRND.lastList > every) frRefresh(false, !open);
  if (inBattle && !$('#frInv').hidden) $('#frInv').hidden = true;
}
/* ---------- 画面 ---------- */
function openFriend(prefill) {
  if (G.mode === 'lobby' && G.session && G.session.kind === 'client') { mtoast('参加中のルームから退出すると使えます', 2200); return; }
  FRND.rmArm = null;
  if (prefill) $('#frIn').value = frFmt(CLOUD.FR.norm(prefill));
  $('#frNick').value = G.nick || '';
  show('friend'); renderFriend();
  if (ACCT.FR) { frPublish(true); frRefresh(true); }
}
function frMsg(s, ok) { const m = $('#frMsg'); m.textContent = s || ''; m.className = 'fr-msg' + (s ? ok ? ' ok' : ' ng' : ''); }
function renderFriend() {
  const F = ACCT.FR, off = $('#frOff'), body = $('#frBody');
  if (!F || !F.code) {
    body.hidden = true; off.hidden = false;
    const t = $('#frOffTxt'), b = $('#btnFrLogin');
    if (ACCT.mode !== 'cloud') { t.textContent = 'フレンドは、公開ページ（GitHub Pages）でアカウントにログインすると使えます。この画面ではセーブが端末の中だけなので使えません。'; b.hidden = true; }
    else if (!G.acct) { t.textContent = 'フレンドを使うにはログインしてください。フレンドコードはアカウントごとに1つ作られます。'; b.hidden = false; }
    else { t.textContent = 'フレンド機能の準備ができませんでした。サーバーの設定（Firestoreのルール）が新しくなっているか確認して、ログインしなおしてください。'; b.hidden = true; }
    return;
  }
  off.hidden = true; body.hidden = false;
  $('#frCode').textContent = frFmt(F.code);
  const d = FRND.data, now = Date.now();
  // 届いた申請・送った申請
  const rq = $('#frReq'); rq.textContent = '';
  if (d && (d.incoming.length || d.outgoing.length)) {
    if (d.incoming.length) rq.appendChild(el('div', 'fr-h', `届いた申請（${d.incoming.length}）`));
    for (const r of d.incoming) {
      const row = frRow(r.ch, r.nm, `Lv${r.lv} ・ ${frAgo(r.t, now).replace('最終 ', '')} 申請`, '');
      const a = el('button', 'bl-btn yellow sm', '承認'); a.type = 'button'; a.onclick = () => frDo(() => CLOUD.FR.accept(r.pid), `${r.nm} さんとフレンドになりました`);
      const n = el('button', 'hm-chip', '拒否'); n.type = 'button'; n.onclick = () => frDo(() => CLOUD.FR.remove(r.pid), '申請を断りました');
      row.querySelector('.fr-act').append(a, n); rq.appendChild(row);
    }
    if (d.outgoing.length) rq.appendChild(el('div', 'fr-h', `送った申請（承認待ち ${d.outgoing.length}）`));
    for (const r of d.outgoing) {
      const row = frRow('', r.nm, '承認を待っています', '');
      const c = el('button', 'hm-chip', '取り消し'); c.type = 'button'; c.onclick = () => frDo(() => CLOUD.FR.remove(r.pid), '申請を取り消しました');
      row.querySelector('.fr-act').append(c); rq.appendChild(row);
    }
  }
  // フレンド
  const ls = $('#frList'); ls.textContent = '';
  const fs = d ? d.friends : [];
  ls.appendChild(el('div', 'fr-h', d ? `フレンド（${fs.length}／${CLOUD.FR.MAX}）` : 'フレンド（読み込み中…）'));
  if (FRND.err) ls.appendChild(el('div', 'fr-empty', FRND.err));
  else if (d && !fs.length) ls.appendChild(el('div', 'fr-empty', 'まだフレンドがいません。上のコードを友だちに送るか、友だちのコードを入れて申請しましょう。'));
  const mine = frMine();
  for (const f of fs) {
    const st = f.light ? '確認中…' : f.act === 'room' ? `募集中（ルーム${f.room}）` : f.act === 'play' ? 'プレイ中' : f.on ? 'オンライン' : frAgo(f.seen, now);
    const row = frRow(f.ch, f.nm, (f.lv && f.act !== 'room' ? `Lv${f.lv} ・ ` : '') + st, f.act === 'room' ? 'room' : f.act === 'play' ? 'play' : f.on ? 'on' : 'off');
    const act = row.querySelector('.fr-act');
    if (f.act === 'room' && !G.coop) { const j = el('button', 'bl-btn yellow sm', '参加'); j.type = 'button'; j.onclick = () => frJoin(f, f.room); act.appendChild(j); }
    if (mine.act === 'room' && f.on && f.act !== 'play' && f.act !== 'room') {
      const sent = f.invSent && now - f.invSent < 60000;
      const v = el('button', 'bl-btn sm', sent ? '招待ずみ' : '招待'); v.type = 'button'; v.disabled = sent;
      v.onclick = async () => { v.disabled = true; const r = await CLOUD.FR.invite(f.pid, mine.room); if (r.ok) { f.invSent = Date.now(); AUDIO.sfx('ok'); frMsg(`${f.nm} さんに招待を送りました（ルーム ${mine.room}）`, true); v.textContent = '招待ずみ'; } else { frMsg(r.msg, false); v.disabled = false; } };
      act.appendChild(v);
    }
    const armed = FRND.rmArm === f.pid;
    const rm = el('button', 'hm-chip fr-rm' + (armed ? ' armed' : ''), armed ? '本当に解除？' : '解除'); rm.type = 'button';
    rm.onclick = () => { if (FRND.rmArm !== f.pid) { FRND.rmArm = f.pid; AUDIO.sfx('ui'); renderFriend(); return; } FRND.rmArm = null; frDo(() => CLOUD.FR.remove(f.pid), `${f.nm} さんとのフレンドを解除しました`); };
    act.appendChild(rm);
    ls.appendChild(row);
  }
}
function frRow(ch, nm, sub, dot) {
  const row = el('div', 'fr-row'), av = el('div', 'fr-av');
  if (ch && G.thumbs[ch]) { const im = el('img'); im.src = G.thumbs[ch]; im.alt = ''; av.appendChild(im); } else av.textContent = '👤';
  const tx = el('div', 'fr-tx'); tx.append(el('b', '', nm || '？'));
  const s = el('span', 'fr-sub'); if (dot) s.appendChild(el('i', 'fr-dot ' + dot)); s.append(sub); tx.appendChild(s);
  row.append(av, tx, el('div', 'fr-act')); return row;
}
async function frDo(fn, okMsg) {
  if (FRND.busy) return; AUDIO.sfx('ui');
  const r = await fn(); if (r && r.ok) { AUDIO.sfx('ok'); frMsg(okMsg, true); } else frMsg((r && r.msg) || 'うまくいきませんでした', false);
  await frRefresh(true);
}
async function frAdd() {
  const F = ACCT.FR; if (!F) return;
  const v = $('#frIn').value; const b = $('#btnFrAdd'); b.disabled = true; frMsg('申請しています…', true);
  const r = await F.request(v, frMine()); b.disabled = false;
  frMsg(r.msg, r.ok); if (r.ok) { AUDIO.sfx('ok'); $('#frIn').value = ''; } else AUDIO.sfx('back');
  await frRefresh(true);
}
/** フレンドのルームへ（協力プレイの「パスワードで参加」と同じ） */
async function frJoin(f, room) {
  if (G.coop) { mtoast('いまのルームから退出してから参加してください', 2400); return; }
  if ($('#btnJoin').disabled) { mtoast('このブラウザでは協力プレイを使えません', 2600); return; }
  $('#frInv').hidden = true; if (f.inv) FRND.dismissed.add(f.pid + f.inv.t);
  $('#code').value = room; $('#nick').value = G.nick || '';
  await startJoin();
  if (!G.coop) mtoast('ルームにつなげませんでした。もう一度ためしてください', 2800);
}
function frShareUrl(code) { return location.origin + location.pathname + '?friend=' + code; }
async function frShare() {
  const F = ACCT.FR; if (!F || !F.code) return;
  const url = frShareUrl(F.code), text = `BIGバスターズでフレンドになろう！ フレンドコード ${frFmt(F.code)}`;
  try { if (navigator.share) { await navigator.share({ title: 'BIGバスターズ', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  frCopy(text + '\n' + url, '招待リンクをコピーしました。LINEなどに貼りつけて送ってください');
}
async function frCopy(s, msg) {
  let ok = false;
  try { await navigator.clipboard.writeText(s); ok = true; } catch (e) {
    try { const t = document.createElement('textarea'); t.value = s; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (e2) { }
  }
  frMsg(ok ? msg : `コピーできませんでした。${s.split('\n')[0]}`, ok); if (ok) AUDIO.sfx('ok');
}
/** 招待リンク（?friend=コード）で開いたとき：ログイン後にフレンド画面へ（コードを入れておく） */
function frTakeLink() {
  const m = /[?&]friend=([A-Za-z0-9-]{8,9})/.exec(location.search); if (!m) return;
  const c = CLOUD.FR.norm(m[1]); if (CLOUD.FR.valid(c)) G.frPending = c;
  try { const u = new URL(location.href); u.searchParams.delete('friend'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { }
}
/** ログインできたとき（ui.js の loginOk から） */
function frOnLogin() {
  FRND.data = null; FRND.pubKey = ''; FRND.lastPub = 0; FRND.lastList = 0; FRND.err = ''; frBadge();
  if (!$('#friend').hidden) renderFriend();
  if (!ACCT.FR) return;
  frPublish(true); frRefresh(true, $('#friend').hidden);
  if (G.frPending) { const c = G.frPending; G.frPending = null; if (c !== ACCT.FR.code) { openFriend(c); frMsg('招待リンクのフレンドコードを入れました。「申請」を押すと申請します', true); } }
}
function frOnLogout() { FRND.data = null; FRND.err = ''; frBadge(); $('#frInv').hidden = true; }
function bindFriend() {
  $('#btnFriend').onclick = () => { AUDIO.sfx('ok'); openFriend(); };
  $('#btnFrBack').onclick = () => { AUDIO.sfx('back'); show('title'); };
  $('#btnFrReload').onclick = () => { AUDIO.sfx('ui'); frRefresh(true); };
  $('#btnFrAdd').onclick = () => frAdd();
  $('#frIn').onkeydown = e => { if (e.key === 'Enter') frAdd(); };
  $('#frIn').oninput = () => { const i = $('#frIn'), c = CLOUD.FR.norm(i.value).slice(0, 8); const v = c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c; if (v !== i.value) i.value = v; };
  $('#btnFrCopy').onclick = () => { const F = ACCT.FR; if (F && F.code) frCopy(frFmt(F.code), 'フレンドコードをコピーしました'); };
  $('#btnFrShare').onclick = () => frShare();
  $('#btnFrLogin').onclick = () => { AUDIO.sfx('ui'); openLogin('friend', 'ログインするとフレンドを使えます'); };
  $('#frNick').onchange = () => { G.nick = ($('#frNick').value.trim() || '').slice(0, 10); $('#frNick').value = G.nick; $('#nick').value = G.nick; STORE.set('nick', G.nick); frPublish(true); if (G.acct) persist(); frMsg('なまえを変えました', true); };
  $('#btnFrInvGo').onclick = () => { const f = FRND.invShown; if (f && f.inv) { AUDIO.sfx('ok'); frJoin(f, f.inv.room); } };
  $('#btnFrInvX').onclick = () => { const f = FRND.invShown; if (f && f.inv) FRND.dismissed.add(f.pid + f.inv.t); $('#frInv').hidden = true; frBadge(); };
  setInterval(() => { try { frTick(); } catch (e) { console.warn(e); } }, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ACCT.FR) { frPublish(true); frRefresh(false, $('#friend').hidden); } });
}
