#!/usr/bin/env python3
"""協力プレイの画面遷移を同じブラウザの2タブで確認する（?net=bc の開発用通信）。"""
import sys, os, threading, http.server, socketserver, time, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tb-shots'; os.makedirs(OUT, exist_ok=True)
THREE_LOCAL = os.environ.get('THREE_LOCAL')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/index.html?net=bc'
def route(page):
    def h(r):
        u = r.request.url
        if 'three.module.js' in u and THREE_LOCAL: r.fulfill(path=THREE_LOCAL, content_type='application/javascript')
        elif 'fonts.g' in u: r.abort()
        else: r.continue_()
    page.route('**/*', h)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'])
    ctx = b.new_context(viewport={'width': int(os.environ.get('VW', 844)), 'height': int(os.environ.get('VH', 390))}, is_mobile=True, has_touch=True)
    A = ctx.new_page(); route(A); B = ctx.new_page(); route(B)
    errs = []
    for pg, nm in ((A, 'host'), (B, 'guest')):
        pg.on('pageerror', lambda e, nm=nm: errs.append(f'{nm}: {e}'))
        pg.on('console', lambda m, nm=nm: errs.append(f'{nm} [{m.type}] {m.text}') if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
        pg.goto(URL, wait_until='domcontentloaded', timeout=120000); pg.wait_for_function('window.__tb && window.__tb.G.mode === "title"', timeout=60000); print(nm, 'loaded', flush=True)
    if os.environ.get('STAGE') == 'joban': A.evaluate("() => { __tb.G.sessClear.senju = true; }")  # ホストはトバトーバを倒している
    rects = "() => JSON.stringify(['btnSolo','btnStageSel','btnTeam','btnFriend','btnGacha'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }).concat([...document.querySelectorAll('#hmTags .hm-tag')].map((t, i) => ['tag' + i, Math.round(parseFloat(t.style.left)), Math.round(parseFloat(t.style.top))])))"
    for pg in (A, B): pg.evaluate("() => document.getElementById('btnGuest').click()")
    time.sleep(1.0); solo_rects = A.evaluate(rects)
    A.evaluate("() => { document.getElementById('btnFriend').click(); document.getElementById('btnFrCoop2').click(); document.getElementById('nick').value='ホスト'; document.getElementById('btnHost').click(); }")
    A.wait_for_function('window.__tb.G.session && window.__tb.G.session.code', timeout=10000)
    code = A.evaluate('__tb.G.session.code'); print('code', code)
    B.evaluate(f"() => {{ document.getElementById('btnFriend').click(); document.getElementById('btnFrCoop2').click(); document.getElementById('nick').value='さんか'; document.getElementById('code').value='{code}'; document.getElementById('btnJoin').click(); }}")
    B.wait_for_function('window.__tb.G.session && window.__tb.G.session.mySlot >= 0', timeout=15000)
    time.sleep(1.0); one_rects = A.evaluate(rects)
    B.evaluate("() => { document.getElementById('btnTeam').click(); [...document.querySelectorAll('#cards .rs-card')].find(b => b.querySelector('.nm').textContent === 'ホシスズメ').click(); document.getElementById('btnChPick').click(); document.getElementById('btnRosterHome').click(); }")  # ホシスズメを選ぶ
    time.sleep(2.0); two_rects = A.evaluate(rects)
    print('rects solo', solo_rects); print('rects host 1p', one_rects); print('rects host 2p', two_rects)
    print('same layout', solo_rects == one_rects == two_rects)
    print('host tags', A.evaluate("() => [...document.querySelectorAll('#hmTags .hm-tag')].map(t => t.innerText.replace(/\\n/g, ' ')).join(' | ')"))
    print('guest tags', B.evaluate("() => [...document.querySelectorAll('#hmTags .hm-tag')].map(t => t.innerText.replace(/\\n/g, ' ')).join(' | ')"), 'guest go', B.evaluate("() => [document.getElementById('btnSolo').disabled, document.getElementById('hmGoSub').textContent, document.getElementById('hmRoomSt').textContent]"))
    A.screenshot(path=os.path.join(OUT, '50_lobby_host.png')); B.screenshot(path=os.path.join(OUT, '51_lobby_guest.png'))
    print('host slots', A.evaluate("JSON.stringify(__tb.G.session.lobbyMsg().slots.map(s => s && [s.nick, s.ch]))"))
    print('clients before', A.evaluate("JSON.stringify([...__tb.G.session.clients.values()].map(c=>[c.slot, Math.round(performance.now()-c.lastSeen)]))"))
    JOBAN = os.environ.get('STAGE') == 'joban'
    if JOBAN:  # ステージ2：ホストがトバトーバを倒した扱いにして、部屋のステージを常磐線にする
        A.evaluate("() => { document.getElementById('btnStageSel').click(); document.querySelectorAll('#stages .ss-card')[1].click(); }"); time.sleep(1.2)
        print('guest lobby stage', B.evaluate("() => __tb.G.session.lobby && __tb.G.session.lobby.stage"))
        B.screenshot(path=os.path.join(OUT, '51b_lobby_guest_joban.png'))
    A.evaluate("() => document.getElementById('btnSolo').click()")
    print('ctrlAI at start', A.evaluate("JSON.stringify(__tb.G.session.sim.allies.map(a=>!!a.ctrlAI))"))
    B.wait_for_function('window.__tb.G.mode === "play"', timeout=15000)
    time.sleep(3)
    if JOBAN:
        A.screenshot(path=os.path.join(OUT, '51c_cut_host.png')); B.screenshot(path=os.path.join(OUT, '51d_cut_guest.png'))
        for _ in range(60):
            st = A.evaluate("() => { const s = __tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, s.introWait, __tb.G.session.paused, Math.round(s.t)]; }")
            if st[0] == 'train': break
            time.sleep(2)
        print('host stage', st); time.sleep(2)
        print('guest fps', B.evaluate("() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); }; requestAnimationFrame(f); })"), 'host fps', A.evaluate("() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); }; requestAnimationFrame(f); })"))
        print('clients mid', A.evaluate("JSON.stringify([...__tb.G.session.clients.values()].map(c=>[c.slot, Math.round(performance.now()-c.lastSeen)]))"))
        print('guest train view', B.evaluate("(() => { const v = __tb.G.session.view(); return JSON.stringify({stage: v.stage, stageId: v.stageId, tr: v.tr, kills: v.kills, total: v.total, mobs: v.mobs.length, yoshi: v.mobs.filter(m => m.yoshi).map(m => m.kind).slice(0, 5)}); })()"))
    print('clients in game', A.evaluate("JSON.stringify([...__tb.G.session.clients.values()].map(c=>[c.slot, Math.round(performance.now()-c.lastSeen), c.q, c.loaded]))"), 'ctrlAI', A.evaluate("JSON.stringify(__tb.G.session.sim.allies.map(a=>!!a.ctrlAI))"))
    B.evaluate("() => { const L = __tb.G.session.local; L.push('A'); L.push('A'); }")
    time.sleep(1.5)
    A.screenshot(path=os.path.join(OUT, '52_game_host.png')); B.screenshot(path=os.path.join(OUT, '53_game_guest.png'))
    print('guest slot', B.evaluate('__tb.G.session.mySlot'), 'ping', B.evaluate('__tb.G.session.ping()'))
    print('guest sees', B.evaluate("(() => { const v = __tb.G.session.view(); return JSON.stringify({stage: v.stage, allies: v.allies.map(a => [a.ch, a.x.toFixed(1), a.z.toFixed(1), a.ai])}); })()"))
    print('host sim', A.evaluate("JSON.stringify(__tb.G.session.sim.allies.map(a => [a.ch, a.x.toFixed(1), a.z.toFixed(1), !!a.ctrlAI, a.lastEv]))"))
    # 参加者が抜けたらAIが引き継ぐ
    B.evaluate("() => __tb.G.session.leave()"); time.sleep(1.5)
    print('after leave ctrlAI', A.evaluate("__tb.G.session.sim.allies[1].ctrlAI"))
    print('errors', len(errs)); [print('  ', e[:300]) for e in errs[:20]]
    b.close()
srv.shutdown()
