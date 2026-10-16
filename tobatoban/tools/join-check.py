#!/usr/bin/env python3
"""v8 協力の入室確認（同じブラウザの4タブ・?net=bc の開発用通信）。
ホストが部屋を作る（フレンド招待と同じ startHost({quiet})）→ 3人が順に参加（フレンド参加・合言葉参加と同じ startJoin）。
・枠が確定するまでは「入室中」の表示で、空のロビーを見せない ・全員に同じ一覧 ・出動で全員が戦闘へ ・存在しない合言葉は理由を出して片付く
注意：これは同じブラウザ内の試験で、別の端末どうしの実際の通信（WebRTC）の成功ではない。
使い方: THREE_LOCAL=... python3 tobatoban/tools/join-check.py"""
import sys, os, threading, http.server, socketserver, time, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); THREE_LOCAL = os.environ.get('THREE_LOCAL')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/index.html?net=bc'
fails = 0
def ok(c, m):
    global fails
    print(('✅ ' if c else '❌ ') + m, flush=True)
    if not c: fails += 1
def route(pg):
    def h(r):
        u = r.request.url
        if 'three.module.js' in u and THREE_LOCAL: r.fulfill(path=THREE_LOCAL, content_type='application/javascript')
        elif 'fonts.g' in u or 'gstatic' in u: r.abort()
        else: r.continue_()
    pg.route('**/*', h)
def until(pg, js, sec=40):
    try: pg.bring_to_front()  # 裏のタブは描画ループが止まるので、確かめる画面を前へ（実機でも、裏に回ったブラウザは止まる）
    except Exception: pass
    for _ in range(int(sec * 5)):
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        time.sleep(0.2)
    return False
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'])
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
    pages = []; errs = []
    N = int(os.environ.get('N', 2))
    for i in range(N):
        pg = ctx.new_page(); route(pg); pg.on('pageerror', lambda e, i=i: errs.append(f'P{i + 1}: {e}'))
        pg.goto(URL, wait_until='commit', timeout=120000); pages.append(pg)
    for i, pg in enumerate(pages):
        ok(until(pg, 'window.__tb && __tb.G.mode === "title"', 90), f'P{i + 1} 起動')
        pg.evaluate("(() => { const g = document.getElementById('btnGuest'); if (g) g.click(); })()")
    H = pages[0]
    code = H.evaluate("__tb.startHost({ quiet: true })"); ok(bool(code), f'ホストが部屋を作る（招待と同じ処理）#{code}')
    ok(H.evaluate("__tb.G.mode") == 'lobby' and H.evaluate("__tb.G.session.lobby.slots.filter(Boolean).length") == 1, 'ホスト自身がロビーにいる')
    H.evaluate("__tb.show('friend')"); time.sleep(0.3)  # ホストがフレンド画面を開いていても受け付けが進むか
    for k in range(1, N):
        G = pages[k]; G.bring_to_front()
        G.evaluate(f"__tb.startJoin('{code}')")
        waited = G.evaluate("!!__tb.G.joinWaiting || (__tb.G.session && __tb.G.session.joined)")
        ok(waited, f'P{k + 1}：参加を押すと、まず「入室中」の表示（空のロビーを見せない）')
        ok(until(G, "__tb.G.session && __tb.G.session.joined && !__tb.G.joinWaiting", 15), f'P{k + 1}：ホストが枠を確定 → 参加完了（ホストはフレンド画面のまま）')
        if os.environ.get('DBG'): print(G.evaluate("JSON.stringify({ s: __tb.G.session && __tb.G.session.state, j: __tb.G.session && __tb.G.session.joined, w: __tb.G.joinWaiting, m: __tb.G.mode, log: __tb.NETLIB.LOG.slice(-12).map(l => l.tag + ':' + l.msg) })"))
        n = k + 1
        if os.environ.get('DBG') and k == 1:
            pages[3].bring_to_front(); time.sleep(6)
            print('DBG host', H.evaluate("({ hidden: document.hidden, since: Math.round(performance.now() - (__tb.G.session ? __tb.G.session.lastLobbySend : 0)), m: __tb.G.mode })"), "guest", G.evaluate("({ hidden: document.hidden, s: !!__tb.G.session, m: __tb.G.mode, gap: __tb.G.session ? Math.round(performance.now() - __tb.G.session.lastRecv) : -1, log: __tb.NETLIB.LOG.slice(-5).map(l => l.tag + l.msg) })"))
        ok(until(H, f"__tb.G.session.lobby.slots.filter(Boolean).length === {n}", 5), f'ホストの一覧が{n}人')
        allsame = all(until(pages[j], f"(__tb.G.session.lobby.slots || []).filter(Boolean).length === {n}", 5) for j in range(1, n))
        ok(allsame, f'参加者全員の一覧も{n}人（同じ一覧）')
    if os.environ.get('DBG'):
      for i, pg in enumerate(pages): print(i, pg.evaluate("JSON.stringify({ s: !!__tb.G.session, m: __tb.G.mode, lost: document.getElementById('lostTitle').textContent, log: __tb.NETLIB.LOG.slice(-8).map(l => l.tag + ':' + l.msg) })")[:900])
    slots = [pg.evaluate("__tb.G.session.mySlot") for pg in pages]
    ok(sorted(slots) == list(range(N)), f'{N}人の枠が重ならない（{slots}）')
    pages[1].evaluate(f"__tb.G.session.hello(__tb.G.session.helloMsg)"); time.sleep(1.2)
    ok(H.evaluate("__tb.G.session.lobby.slots.filter(Boolean).length") == N and H.evaluate("__tb.G.session.clients.size") == N - 1, '同じ人のあいさつの再送で二重登録しない')
    H.evaluate("__tb.show('title')"); time.sleep(0.3)
    H.evaluate("document.getElementById('btnSolo').click()")
    ok(all(until(pg, "__tb.G.mode === 'play'", 20) for pg in pages), f'ホストの出動で{N}人とも戦闘へ')
    # 失敗：存在しない合言葉 → 理由を出して片付け、もう一度試せる
    F = ctx.new_page(); route(F); F.goto(URL, wait_until='commit', timeout=120000); until(F, 'window.__tb && __tb.G.mode === "title"', 90)
    F.evaluate("(() => { const g = document.getElementById('btnGuest'); if (g) g.click(); __tb.DATA.NET.connectTimeout = 3; })()")
    F.evaluate("__tb.startJoin('999999')")
    ok(until(F, "!document.getElementById('netlost').hidden", 15), 'いない部屋：数秒で「ホストが見つかりませんでした」を表示')
    r = F.evaluate("({ s: !!__tb.G.session, coop: __tb.G.coop, t: document.getElementById('lostTitle').textContent })")
    ok(not r['s'] and not r['coop'] and 'ホスト' in r['t'], f'失敗のあとは部屋を片付けて再試行できる（{r}）')
    ok(not errs, f'ページのエラーなし（{errs[:3]}）')
    b.close()
print(f'\n{fails}件の失敗' if fails else '\nすべて合格'); sys.exit(1 if fails else 0)
