#!/usr/bin/env python3
"""縦持ちの端末で横画面に回して表示したときの確認（表示・指の位置の読み替え・ボタン）。
使い方: THREE_LOCAL=... python3 tobatoban/tools/rot-check.py [出力フォルダ]"""
import sys, os, threading, http.server, socketserver, time, functools, json
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tb-shots'; os.makedirs(OUT, exist_ok=True)
THREE_LOCAL = os.environ.get('THREE_LOCAL')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
def route(page):
    def h(r):
        u = r.request.url
        if 'three.module.js' in u and THREE_LOCAL: r.fulfill(path=THREE_LOCAL, content_type='application/javascript')
        elif 'fonts.g' in u: r.abort()
        else: r.continue_()
    page.route('**/*', h)
def center(page, sel):
    r = page.evaluate(f"(() => {{ const b = document.querySelector('{sel}').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }})()")
    return r
with sync_playwright() as p:
    for (w, h, rotdir) in [(390, 844, 'left'), (360, 800, 'right')]:
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True)
        if rotdir == 'right': ctx.add_init_script("try{localStorage.setItem('tb.set', JSON.stringify({land:true, rotDir:'right'}))}catch(e){}")
        pg = ctx.new_page(); route(pg); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_function('window.__tb && __tb.G.mode === "title"', timeout=30000)
        time.sleep(3.2)
        tag = f'{w}x{h}_{rotdir}'
        pg.screenshot(path=os.path.join(OUT, f'59_login_{tag}.png'))
        x, y = center(pg, '#btnGuest'); pg.mouse.click(x, y); time.sleep(0.5)  # 毎回出るログイン画面（回転した画面で本当に押す）
        info = pg.evaluate("({rot: __tb.R && 0, view: [document.getElementById('app').style.width, document.getElementById('app').style.height, document.getElementById('app').style.transform]})")
        pg.screenshot(path=os.path.join(OUT, f'60_title_{tag}.png'))
        # ボタンを本当に押す（画面座標で）
        x, y = center(pg, '#btnSolo'); pg.mouse.click(x, y); time.sleep(0.6)
        pg.screenshot(path=os.path.join(OUT, f'61_team_{tag}.png'))
        # 回転したメニューを指でスクロール（プレイヤーから見て上へなぞる）
        s0 = pg.evaluate("document.getElementById('team').scrollTop"); cx, cy = w / 2, h / 2
        d = 220 if rotdir == 'left' else -220
        pg.mouse.move(cx - d / 2, cy); pg.mouse.down(); pg.mouse.move(cx + d / 2, cy, steps=6); pg.mouse.up(); time.sleep(0.3)
        s1 = pg.evaluate("document.getElementById('team').scrollTop"); print('scroll', s0, '->', s1)
        x, y = center(pg, '#btnGo'); pg.mouse.click(x, y)
        pg.wait_for_function('__tb.G.mode === "play"', timeout=10000); time.sleep(2.5)
        pg.screenshot(path=os.path.join(OUT, f'62_play_{tag}.png'))
        # スティック：プレイヤーから見て「上」へ倒す
        sx, sy = center(pg, '#stick')
        up = (40, 0) if rotdir == 'left' else (-40, 0)   # 左に倒した端末では画面の右がプレイヤーの上
        pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + up[0], sy + up[1], steps=4); time.sleep(0.3)
        stickv = pg.evaluate("[__tb.G.session.local.mx.toFixed(2), __tb.G.session.local.mz.toFixed(2)]")
        z0 = pg.evaluate("__tb.G.session.sim.allies[__tb.G.my].z"); time.sleep(1.2)
        z1 = pg.evaluate("__tb.G.session.sim.allies[__tb.G.my].z"); pg.mouse.up()
        # Aボタン
        ev0 = pg.evaluate("__tb.G.session.local.evId"); ax, ay = center(pg, '#bA'); pg.mouse.click(ax, ay); time.sleep(0.2)
        ev1 = pg.evaluate("__tb.G.session.local.evId")
        overlap = pg.evaluate('''() => { const ids = ['bA','bX','bY','bSP','bB','bLock','bCam','bI0','bI1','bSig','bMenu','stick','party','map','mebox']; const R = ids.map(id => { const r = document.getElementById(id).getBoundingClientRect(); return {id, l:r.left, t:r.top, r:r.right, b:r.bottom}; }); const o=[]; for (let i=0;i<R.length;i++) for (let j=i+1;j<R.length;j++){const a=R[i],c=R[j]; const ox=Math.min(a.r,c.r)-Math.max(a.l,c.l), oy=Math.min(a.b,c.b)-Math.max(a.t,c.t); if(ox>0&&oy>0)o.push(a.id+'×'+c.id);} const off=R.filter(r=>r.l<-1||r.t<-1||r.r>innerWidth+1||r.b>innerHeight+1).map(r=>r.id+' off'); return o.concat(off); }''')
        print(tag, info, 'stick→', stickv, 'moved z', round(z1 - z0, 2), 'A event', ev1 - ev0, 'overlap', overlap, 'errors', errs[:5])
        b.close()
srv.shutdown()
