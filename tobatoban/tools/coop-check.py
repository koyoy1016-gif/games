#!/usr/bin/env python3
"""協力プレイの画面遷移を同じブラウザの2タブで確認する（?net=bc の開発用通信）。"""
import sys, os, threading, http.server, socketserver, time, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tb-shots'; os.makedirs(OUT, exist_ok=True)
THREE_LOCAL = os.environ.get('THREE_LOCAL')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
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
        pg.goto(URL); pg.wait_for_function('window.__tb && window.__tb.G.mode === "title"', timeout=30000)
    A.evaluate("() => { document.getElementById('btnCoop').click(); document.getElementById('nick').value='ホスト'; document.getElementById('btnHost').click(); }")
    A.wait_for_function('window.__tb.G.session && window.__tb.G.session.code', timeout=10000)
    code = A.evaluate('__tb.G.session.code'); print('code', code)
    B.evaluate(f"() => {{ document.getElementById('btnCoop').click(); document.getElementById('nick').value='さんか'; document.getElementById('code').value='{code}'; document.getElementById('btnJoin').click(); }}")
    B.wait_for_function('window.__tb.G.session && window.__tb.G.session.mySlot >= 0', timeout=15000)
    B.evaluate("() => { document.querySelectorAll('#cards .card')[1].click(); }")  # ホシスズメを選ぶ
    time.sleep(2.0)
    A.screenshot(path=os.path.join(OUT, '50_lobby_host.png')); B.screenshot(path=os.path.join(OUT, '51_lobby_guest.png'))
    print('host slots', A.evaluate("JSON.stringify(__tb.G.session.lobbyMsg().slots.map(s => s && [s.nick, s.ch]))"))
    print('clients before', A.evaluate("JSON.stringify([...__tb.G.session.clients.values()].map(c=>[c.slot, Math.round(performance.now()-c.lastSeen)]))"))
    A.evaluate("() => document.getElementById('btnGo').click()")
    print('ctrlAI at start', A.evaluate("JSON.stringify(__tb.G.session.sim.allies.map(a=>!!a.ctrlAI))"))
    B.wait_for_function('window.__tb.G.mode === "play"', timeout=15000)
    time.sleep(3)
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
