#!/usr/bin/env python3
"""ブラウザでの画面確認（Playwright + ソフトウェアWebGL）。
使い方: python3 tobatoban/tools/browser-check.py [出力フォルダ]
three.js は CDN の代わりにローカルのコピーを返す（環境変数 THREE_LOCAL）。"""
import sys, os, threading, http.server, socketserver, json, time, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tb-shots'
os.makedirs(OUT, exist_ok=True)
THREE_LOCAL = os.environ.get('THREE_LOCAL')
SCEN = os.environ.get('SCEN', 'all')

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=ROOT)
srv = socketserver.TCPServer(('127.0.0.1', 0), Handler); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/index.html'

def route(page):
    def h(route):
        u = route.request.url
        if 'three.module.js' in u and THREE_LOCAL:
            route.fulfill(path=THREE_LOCAL, content_type='application/javascript')
        elif 'fonts.googleapis' in u or 'fonts.gstatic' in u:
            route.abort()
        else:
            route.continue_()
    page.route('**/*', h)

def overlaps(page):
    return page.evaluate('''() => {
      const ids = ['bA','bX','bY','bSP','bB','bLock','bCam','bI0','bI1','bSig','bMenu','stick','party','map','mebox','bossbox','timer'];
      const R = ids.map(id => { const e = document.getElementById(id); if (!e || e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); if (!r.width) return null; return { id, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }).filter(Boolean);
      const out = [];
      for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i], b = R[j]; const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (ox > 0 && oy > 0) out.push(`${a.id}×${b.id} ${ox.toFixed(0)}x${oy.toFixed(0)}`); }
      const off = R.filter(r => r.l < -1 || r.t < -1 || r.r > innerWidth + 1 || r.b > innerHeight + 1).map(r => r.id + ' offscreen');
      const small = R.filter(r => ['bA','bX','bY','bSP','bB','bLock','bCam','bI0','bI1','bSig','bMenu'].includes(r.id) && (r.w < 47.5 || r.h < 47.5)).map(r => r.id + ' <48');
      return out.concat(off, small);
    }''')

def run(p, w, h, tag, steps):
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page = ctx.new_page(); route(page)
    errs = []
    page.on('console', lambda m: errs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errs.append(f'[pageerror] {e}'))
    page.goto(URL); page.wait_for_function('window.__tb && window.__tb.G.mode === "title"', timeout=30000)
    time.sleep(1.0)
    res = {'tag': tag, 'errors': errs}
    for s in steps: s(page, res)
    b.close()
    return res

def shot(name):
    def f(page, res): page.screenshot(path=os.path.join(OUT, name + '.png'))
    return f
def wait(sec):
    """ゲーム内時間で待つ（ソフトウェア描画で遅い環境でも同じ場面になるように）"""
    def f(page, res):
        try:
            t0 = page.evaluate('(__tb.G.session && __tb.G.session.sim) ? __tb.G.session.sim.t : -1')
        except Exception: t0 = -1
        if t0 < 0: time.sleep(sec); return
        end = time.time() + sec * 8 + 5
        while time.time() < end:
            t = page.evaluate('__tb.G.session && __tb.G.session.sim ? __tb.G.session.sim.t : 1e9')
            if t - t0 >= sec: break
            time.sleep(0.05)
    return f
def ev(js, key=None):
    def f(page, res):
        r = page.evaluate(js)
        if key: res[key] = r
    return f
def check_overlap(key):
    def f(page, res): res[key] = overlaps(page)
    return f
START_SOLO = '''() => { document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); return __tb.G.mode; }'''
TO_BOSS = '''() => { const s = __tb.G.session.sim; s.mobs = []; s.wave = 1; s.barrier = 'none'; s.allies.forEach((a,i) => { a.x = -2 + i; a.z = -1; }); s.allies[0].z = 3; return 'ok'; }'''
FORCE = '''(mv) => { const s = __tb.G.session.sim; const b = s.boss; if (!b || s.stage !== 'boss') return 'nostage'; b.st='idle'; b.gap=99; b.cds={}; const t = s.allies[0]; s.bossStart(mv, t); return b.st; }'''
NOHP = '''() => { const t = document.getElementById('hud').innerText; const m = t.match(/\\d+\\s*\\/\\s*\\d+/g); return m || []; }'''

with sync_playwright() as p:
    results = []
    if SCEN in ('all', 'land'):
        results.append(run(p, 844, 390, 'land', [
            shot('00_login_land'), ev("() => { document.getElementById('btnGuest').click(); return 1; }"), wait(0.3), shot('01_title_land'), ev(START_SOLO, 'mode'), wait(2.5), shot('02_street_land'), check_overlap('overlap_land'), ev(NOHP, 'hpnums'),
            ev("() => { const L = __tb.G.session.local; L.push('A'); L.push('A'); return 1; }"), wait(0.6), shot('03_attack_land'),
            ev(TO_BOSS), wait(1.0), shot('04_intro1'), wait(2.3), shot('05_intro2'), wait(2.6), shot('06_boss_land'),
            ev("() => { const s=__tb.G.session.sim; s.allies.forEach(a=>{a.inv=999}); return 1; }"),
            ev("() => { const s=__tb.G.session.sim; const b=s.boss; b.st='idle'; b.gap=99; b.cds={}; s.bossStart('fubuki', s.allies[0]); return b.st; }", 'fub'), wait(0.45), shot('07_fubuki_warn'), wait(0.5), shot('08_fubuki_act'), wait(2.2),
            ev("() => { const s=__tb.G.session.sim; const b=s.boss; b.st='idle'; b.gap=99; b.cds={}; s.bossStart('kousen', s.allies[0]); return b.st; }"), wait(1.2), shot('09_kousen'), wait(2.0),
            ev("() => { const s=__tb.G.session.sim; const b=s.boss; b.st='idle'; b.gap=99; b.cds={}; s.bossStart('otoshi', s.allies[0]); return b.st; }"), wait(0.6), shot('10_otoshi'), wait(2.0),
            ev("() => { const s=__tb.G.session.sim; s.boss.hp = s.boss.maxHp*0.3; const b=s.boss; b.st='idle'; b.gap=99; b.cds={}; s.bossStart('junkou', s.allies[0]); return b.st; }"), wait(1.6), shot('11_junkou'), wait(4.5),
            ev("() => { const s=__tb.G.session.sim; s.allies[0].sp = 100; __tb.G.session.local.push('SP'); return 1; }"), wait(0.8), shot('12_special'),
            ev("() => { const s=__tb.G.session.sim; const b=s.boss; b.st='idle'; b.gap=99; b.cds={}; s.bossStart('zouen', s.allies[0]); return 1; }"), wait(2.0), shot('13_zouen'),
            check_overlap('overlap_land_boss'), ev(NOHP, 'hpnums_boss'), ev("() => { const i = __tb.R.renderer.info; return {calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures}; }", 'perf'),
            ev("() => { const s=__tb.G.session.sim; s.boss.hp = 1; s.dealToEnemy(s.allies[0], s.boss, 999, 'str', 'A', null); return s.stage; }", 'end'), wait(5), shot('14_result'),
        ]))
    if SCEN in ('all', 'port'):
        results.append(run(p, 390, 844, 'port', [
            shot('19_login_port'), ev("() => { document.getElementById('btnGuest').click(); return 1; }"), wait(0.3), shot('20_title_port'), ev("() => { document.getElementById('btnSolo').click(); return 1; }"), wait(0.5), shot('21_team_port'),
            ev("() => { document.getElementById('btnGo').click(); return 1; }"), wait(2.5), shot('22_street_port'), check_overlap('overlap_port'),
            ev(TO_BOSS), wait(6.5), shot('23_boss_port'), check_overlap('overlap_port_boss'),
        ]))
    if SCEN in ('all', 'small'):
        results.append(run(p, 800, 360, 'small_land', [ev(START_SOLO), wait(2.0), shot('30_small_land'), check_overlap('overlap')]))
        results.append(run(p, 360, 800, 'small_port', [ev(START_SOLO), wait(2.0), shot('31_small_port'), check_overlap('overlap')]))
    if SCEN in ('fly',):
        # 千住大巡行（終盤3回）を途中で何枚か撮る：毎回ちがう向きから飛ぶか
        steps = [ev(START_SOLO), wait(1.0), ev(TO_BOSS), wait(6.5), ev("() => { const s=__tb.G.session.sim; s.allies.forEach(a=>{a.inv=999}); s.boss.hp = s.boss.maxHp*0.3; s.boss.phase = 2; const b=s.boss; b.st='idle'; b.gap=99; b.cds={}; s.bossStart('junkou', s.allies[0]); return b.st; }", 'fly')]
        for i in range(9):
            steps += [wait(0.55), shot(f'5{i}_fly'), ev("() => { const f=__tb.G.session.sim.boss.fl; return f ? f.ph + ' ' + Math.round(f.yaw*180/Math.PI) + '° i' + f.i : __tb.G.session.sim.boss.st; }", f'fly{i}')]
        results.append(run(p, 844, 390, 'fly', steps))
    if SCEN in ('save',):
        # ログイン（毎回）→ 登録 → 戦う → 自動セーブ → 開き直す → ログインして続きから
        def reload(page, res):
            page.reload(); page.wait_for_function('window.__tb && window.__tb.G.mode === "title"', timeout=30000); time.sleep(0.8)
        vis = "() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',')"
        typ = lambda sel, val: ev("() => { const e = document.querySelector('%s'); e.value = '%s'; return 1; }" % (sel, val))
        click = lambda sel: ev("() => { document.querySelector('%s').click(); return 1; }" % sel)
        txt = lambda sel, key: ev("() => document.querySelector('%s').textContent" % sel, key)
        results.append(run(p, 844, 390, 'save', [
            ev(vis, 'boot_screen'), shot('80_login'),
            typ('#lgId', '1001'), typ('#lgPw', 'neko'), click('#btnLogin'), txt('#lgMsg', 'login_unregistered'),
            click('#btnRegister'), typ('#lgPw', 'neko22'), typ('#lgPw2', 'neko22'), shot('81_register'), click('#btnRegister'), wait(0.3), ev(vis, 'after_register'), txt('#acctWho', 'acct_bar'), shot('82_title_login'),
            click('#btnSolo'), wait(0.4), txt('#cards', 'cards_text'), shot('83_team_lv'), click('#btnGo'), wait(2.0),
            ev("() => { const s=__tb.G.session.sim; s.mobs.forEach(m => s.dealToEnemy(s.allies[0], m, 9999, 'str', 'A', null)); return s.allies[0].stats.kills; }", 'kills'), wait(1.5),
            ev(TO_BOSS), wait(1.0), ev("() => { const a = __tb.G.acct; return a ? [a.rec.mobs, a.chars.kogemaru.k] : null; }", 'autosave_plaza'), shot('84_hud_lv'), wait(6.0),
            ev("() => { const s=__tb.G.session.sim; s.boss.hp = 1; s.dealToEnemy(s.allies[0], s.boss, 999, 'str', 'A', null); return s.stage; }"), wait(5), txt('#resSave', 'result_save'), shot('85_result_save'),
            click('#btnResTitle'), wait(0.3), click('#btnAcct'), wait(0.3), txt('#acKv', 'account_kv'), txt('#acCode', 'code'), shot('86_account'), click('#btnAcBack'),
            reload, ev(vis, 'after_reload'), ev("() => !!__tb.G.acct", 'logged_in_after_reload'),
            typ('#lgPw', 'wrong'), click('#btnLogin'), txt('#lgMsg', 'wrong_pw'),
            typ('#lgPw', 'neko22'), click('#btnLogin'), wait(0.3), ev("() => { const a = __tb.G.acct; return a ? [a.id, a.rec.b, a.rec.w, a.rec.mobs] : null; }", 'restored'),
            click('#btnSolo'), click('#btnGo'), wait(1.5), ev("() => { document.dispatchEvent(new KeyboardEvent('keydown', {code:'Escape'})); window.dispatchEvent(new KeyboardEvent('keydown', {code:'Escape'})); return __tb.G.mode; }", 'paused'), wait(0.3), click('#btnPSave'), wait(0.3), txt('#mtoast', 'pause_save_toast'), shot('87_pause_save'),
        ]))
    if SCEN in ('menus',):
        results.append(run(p, 844, 390, 'menus', [ev("() => { document.getElementById('btnGuest').click(); return 1; }"), ev("() => { document.getElementById('btnHow').click(); return 1; }"), wait(0.4), shot('40_how'), ev("() => { document.querySelector('#how [data-back]').click(); document.getElementById('btnSet').click(); return 1; }"), wait(0.3), shot('41_settings'), ev("() => { document.querySelector('#settings [data-back]').click(); document.getElementById('btnCoop').click(); return 1; }"), wait(0.3), shot('42_coop')]))
    for r in results:
        print('===', r['tag'])
        for k, v in r.items():
            if k in ('tag',): continue
            if k == 'errors':
                print('errors:', len(v)); [print('  ', e[:300]) for e in v[:25]]
            else: print(k, ':', v)
srv.shutdown()
