#!/usr/bin/env python3
"""v8 第3優先の画面確認（ブラウザ）：秋葉原の広場で4人の新しい技・連携技（安全地帯）・状態表示を出して撮る。
使い方: THREE_LOCAL=... python3 tobatoban/tools/akiba8-check.py [出力フォルダ]"""
import sys, os, threading, http.server, socketserver, time, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tb-ak8'; os.makedirs(OUT, exist_ok=True)
THREE_LOCAL = os.environ.get('THREE_LOCAL')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = 0
def ok(c, m):
    global fails
    print(('✅ ' if c else '❌ ') + m)
    if not c: fails += 1
def route(pg):
    def h(r):
        u = r.request.url
        if 'three.module.js' in u and THREE_LOCAL: r.fulfill(path=THREE_LOCAL, content_type='application/javascript')
        elif 'fonts.g' in u or 'gstatic' in u: r.abort()
        else: r.continue_()
    pg.route('**/*', h)
def until(pg, js, sec=60):
    for _ in range(int(sec * 4)):
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        time.sleep(0.25)
    return False
SIM = '__tb.G.session.sim'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, screen={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); route(pg); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{port}/index.html?save=local', wait_until='commit', timeout=120000)
    ok(until(pg, 'window.__tb && __tb.G.mode === "title"'), '起動してログイン画面')
    pg.evaluate("() => { document.getElementById('btnGuest').click(); }"); time.sleep(1.0)
    r = pg.evaluate("""() => { const g = __tb.G.guest || __tb.SAVE.load(); for (const k of ['senju','joban','ueno_street','ueno','akiba_platform']) g.clear[k] = 1; g.uenoOpen = true; g.akibaOpen = true;
      __tb.G.party.forEach(c => { g.chars[c].lv = 60; g.chars[c].exp = __tb.DATA.GROWTH.cum(__tb.DATA.CHI[c].rank, 60); }); __tb.startSolo('akiba_plaza'); return [__tb.G.mode, __tb.G.session && __tb.G.session.sim.stageId]; }""")
    ok(r[1] == 'akiba_plaza', f'広場をソロで開始 {r}')
    until(pg, SIM + ".stage === 'boss' && " + SIM + ".foe('oga').st === 'ok'", 30); time.sleep(0.5)
    hold = "s.allies.forEach(a => a.inv = 1e9); s.AK.geoT = 1e9; s.mobs.forEach(m => { if (m.kind === 'akiba') { m.gap = 1e9; m.act = null; } });"
    pg.evaluate("() => { const s = " + SIM + "; " + hold + " }")
    shots = [('naka', 'n_notes', 0.9), ('naka', 'n_bite', 1.2), ('hoshi', 'h_warp', 1.4), ('kae', 'k_cups', 0.6), ('oga', 'o_parade', 1.3), ('hoshi', 'h_steal', 1.6), ('naka', 'n_stand', 2.0), ('naka', 'n_wheel', 1.6), ('kae', 'k_cafe', 1.2), ('oga', 'o_mark', 2.5)]
    for who, mv, wt in shots:
        r = pg.evaluate("() => { const s = " + SIM + "; " + hold + " const m = s.foe('" + who + "'), a = s.allies[__tb.G.my]; if (m.st !== 'ok') { m.st = 'ok'; m.hp = m.maxHp; } m.x = a.x + 1; m.z = a.z + 4; s.akibaStart(m, '" + mv + "', a); s.mobs.forEach(q => { if (q.kind === 'akiba' && q !== m) q.gap = 1e9; }); return s.hazards.length; }")
        time.sleep(wt); pg.screenshot(path=f'{OUT}/m_{mv}.png'); ok(r >= 0, f'{mv} を開始（危険範囲 {r}）')
        time.sleep(1.5)
    for v in ['quad', 'net', 'tri', 'wave']:
        r = pg.evaluate("""() => { const s = """ + SIM + """; s.hazards = []; s.mobs.forEach(m => { if (m.kind === 'akiba') { m.act = null; m.geo = false; m.st = 'ok'; m.hp = m.maxHp; } }); s.AK.geo = null;
          const F = ['hoshi', 'naka', 'oga', 'kae'].map(w => s.foe(w)), P = [[-5, -5], [5, -5], [5, 5], [-5, 5]], n = '""" + v + """' === 'tri' ? 3 : '""" + v + """' === 'wave' ? 2 : 4;
          F.forEach((m, i) => { m.x = P[i][0]; m.z = P[i][1]; }); const L = n === 3 ? [F[0], F[1], F[3]] : F.slice(0, n); if (n === 3) { F[3].x = 0; F[3].z = 6; }
          const sh = s.geoShape(L); if (!sh) return 'noshape'; sh.v = '""" + v + """'; sh.plan = null; s.startGeo(L, sh); const a = s.allies[__tb.G.my]; a.x = 0; a.z = -9; return s.AK.geo.hzs.length; }""")
        time.sleep(1.2); pg.screenshot(path=f'{OUT}/g_{v}.png'); ok(isinstance(r, int) and r > 0, f'連携技 {v}（当たり {r}）'); time.sleep(3.2)
    st = pg.evaluate("() => { const s = " + SIM + "; const a = s.allies[__tb.G.my]; a.sealX = 2; a.fmark = { t: 3, n: 3, next: 9 }; return 1; }"); time.sleep(0.6); pg.screenshot(path=f'{OUT}/s_status.png')
    ok(pg.evaluate("() => document.getElementById('bX').textContent.includes('封')"), 'Xボタンに「封」の表示')
    ok(not errs, f'画面のエラーなし {errs[:3]}')
    b.close()
print('失敗', fails)
