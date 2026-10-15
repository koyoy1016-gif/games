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
    if os.environ.get('WARN_STACK'): page.add_init_script("const w0 = console.warn; console.warn = function(...a){ if (String(a[0]).includes('parameter')) a = a.concat([new Error().stack.split('\\n').slice(2, 7).join(' | ')]); return w0.apply(console, a); };")
    errs = []
    page.on('console', lambda m: errs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errs.append(f'[pageerror] {e}'))
    page.goto(URL + ('?save=local' if tag == 'save' else '')); page.wait_for_function('window.__tb && window.__tb.G.mode === "title"', timeout=60000)
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
START_SOLO = '''() => { document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.querySelector('#stages .stage-card').click(); return __tb.G.mode; }'''
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
            ev("() => { document.getElementById('btnGo').click(); return 1; }"), wait(0.4), shot('21b_stage_port'), ev("() => { document.querySelector('#stages .stage-card').click(); return 1; }"), wait(2.5), shot('22_street_port'), check_overlap('overlap_port'),
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
    if SCEN in ('joban', 'jobanport'):
        # ステージ2：ステージ選択（ロック→解放）→ 演出（トバトーバンが倒れる→ホーム→乗車）→ 車内戦 → 駅 → 上野
        vis = "() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',')"
        sim = "__tb.G.session.sim"
        port = SCEN == 'jobanport'
        W, H = (390, 844) if port else (844, 390)
        pre = 'p' if port else ''
        steps = [ev("() => { document.getElementById('btnGuest').click(); document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); return 1; }"), wait(0.4), ev(vis, 'screen'), shot(pre + '60_stage_locked'),
            ev("() => { document.querySelectorAll('#stages .stage-card')[1].click(); return __tb.G.mode; }", 'locked_click_mode'), wait(0.3), shot(pre + '60b_locked_toast'),
            ev("() => { __tb.G.sessClear.senju = true; document.getElementById('btnStageBack').click(); document.getElementById('btnGo').click(); return [...document.querySelectorAll('#stages .stage-card')].map(c => c.className); }", 'cards'), wait(0.3), shot(pre + '61_stage_open'),
            ev("() => { document.querySelectorAll('#stages .stage-card')[1].click(); return __tb.G.mode + ' ' + " + sim + ".stageId + ' ' + " + sim + ".stage; }", 'start'),
            wait(1.2), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_62_cut_collapse'), shot(pre + '62_cut_collapse'), wait(2.4), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_63_cut_platform'), shot(pre + '63_cut_platform'), wait(1.8), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_64_cut_board'), shot(pre + '64_cut_board'), wait(2.6), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_65_cut_inside'), shot(pre + '65_cut_inside'), wait(2.6), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_66_cut_depart'), shot(pre + '66_cut_depart'),
            wait(2.0), ev("() => " + sim + ".stage + ' mobs ' + " + sim + ".mobs.length", 'after_intro'), shot(pre + '67_train'), check_overlap('overlap_train'),
            ev("() => { const s=" + sim + "; s.allies.forEach(a => a.inv = 999); const L = __tb.G.session.local; L.push('A'); L.push('A'); return 1; }"), wait(3.0), shot(pre + '68_fight'),
            ev("() => { const i = __tb.R.renderer.info; return {calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures}; }", 'perf'),
            ev("() => document.getElementById('bossbox').innerText.replace(/\\n/g,' | ')", 'route_text'),
            # 南千住の手前まで進める → 停車・ドア・乗車
            ev("() => { const s=" + sim + "; s.tr.d = DATA_LEN0 - 12; s.tr.v = 7; return s.tr.d; }".replace('DATA_LEN0', '__tb.DATA.JOBAN.segLen[0]')), wait(5.5), ev("() => { const t=" + sim + ".tr; return [t.at, t.ph, t.doors, Math.round(t.t*10)/10]; }", 'station'), shot(pre + '69_station'), wait(2.0), shot(pre + '70_boarding'),
            # 最後まで飛ばす：部下を全滅・日暮里を出た所 → 上野に着く
            ev("() => { const s=" + sim + "; s.phase = 3; s.boardedSt = 3; s.queue = []; s.mobs.forEach(m => { if (m.st === 'ok') s.dealToEnemy(s.allies[0], m, 99999, 'str', 'A', null); }); s.kills = s.total; const t = s.tr; t.at = 3; t.ph = 'run'; t.t = 0; t.d = __tb.DATA.JOBAN.segLen[3] - 100; t.v = 20; return s.stage; }", 'skip'),
            wait(3.0), shot(pre + '71_approach_ueno'), wait(8.5), ev("() => " + sim + ".stage + ' at ' + " + sim + ".tr.at", 'arrive_stage'), shot(pre + '72_ueno'), wait(2.5), shot(pre + '72b_ueno_platform'), wait(3.0), shot(pre + '72c_ueno_platform'), wait(3.0), ev("() => [__tb.G.mode, " + sim + ".result && " + sim + ".result.why]", 'result'), shot(pre + '73_result'),
            ev("() => document.getElementById('result') ? document.getElementById('result').innerText.slice(0, 300) : ''", 'result_text'),
        ]
        results.append(run(p, W, H, 'joban', steps))
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
            click('#btnRegister'), typ('#lgPw', 'neko22'), typ('#lgPw2', 'neko22'), shot('81_register'), click('#btnRegister'), wait(0.3), txt('#lgDoneId', 'assigned_id'), shot('81b_done'), click('#btnDoneOk'), wait(0.3), ev(vis, 'after_register'), txt('#acctWho', 'acct_bar'), shot('82_title_login'),
            click('#btnSolo'), wait(0.4), shot('83_team_lv'), click('#btnGo'), wait(0.3), click('#stages .stage-card'), wait(2.0),
            ev("() => { const s=__tb.G.session.sim; s.mobs.forEach(m => s.dealToEnemy(s.allies[0], m, 9999, 'str', 'A', null)); return s.allies[0].stats.kills; }", 'kills'), wait(1.5),
            ev(TO_BOSS), wait(1.5), ev("() => JSON.parse(localStorage.getItem('tb.acct.1')).rec.mobs", 'stored_mobs_at_plaza(0=no autosave)'), wait(5.5),
            ev("() => { const s=__tb.G.session.sim; s.boss.hp = 1; s.dealToEnemy(s.allies[0], s.boss, 999, 'str', 'A', null); return s.stage; }"), wait(5), txt('#resSave', 'result_save'), ev("() => JSON.parse(localStorage.getItem('tb.acct.1')).rec", 'stored_after_battle'), shot('85_result_save'),
            click('#btnResTitle'), wait(0.3), click('#btnLogout'), click('#btnAcct'), wait(0.2), click('#btnRegister'), typ('#lgPw', 'inu333'), typ('#lgPw2', 'inu333'), click('#btnRegister'), wait(0.2), txt('#lgDoneId', 'second_id'), click('#btnDoneOk'),
            reload, ev(vis, 'after_reload'), ev("() => !!__tb.G.acct", 'logged_in_after_reload'),
            typ('#lgId', '1'), typ('#lgPw', 'inu333'), click('#btnLogin'), txt('#lgMsg', 'id1_with_id2_password'),
            typ('#lgPw', 'neko22'), click('#btnLogin'), wait(0.3), ev("() => { const a = __tb.G.acct; return a ? [a.id, a.rec.b, a.rec.w, a.rec.mobs] : null; }", 'restored'),
            ev("() => { localStorage.setItem('tb.saveVer','1'); localStorage.setItem('tb.acct.1001','{}'); return 1; }"), reload, ev("() => Object.keys(localStorage).filter(k => k.startsWith('tb.acct.'))", 'after_wipe_keys'),
        ]))
    if SCEN in ('cloud',):
        # サーバー版（Firebase）：本物のSDK（gstaticの代わりにローカルのコピー）＋Authエミュレーター＋共有の検査用Firestore。2つのブラウザ＝2台の端末
        FB_DIR = os.environ['FB_DIR']; SDKD = os.path.join(FB_DIR, 'node_modules', 'firebase')
        import urllib.request
        urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9099/emulator/v1/projects/demo-tb/accounts', method='DELETE')).read()
        store = {}
        INIT = '''window.__TB_CLOUD_TEST = { cfg: { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-tb' }, opt: { authEmulator: 'http://127.0.0.1:9099', db: {}, fs: {
          doc: (db, c, id) => ({ path: c + '/' + id }),
          async getDoc(ref) { const d = await window.__fsGet(ref.path); return { exists: () => d != null, data: () => d }; },
          async setDoc(ref, data) { await window.__fsSet(ref.path, JSON.parse(JSON.stringify(data))); },
          async runTransaction(db, fn) { const w = {}; const tx = { async get(ref) { const d = await window.__fsGet(ref.path); return { exists: () => d != null, data: () => d }; }, set(ref, data) { w[ref.path] = JSON.parse(JSON.stringify(data)); } }; const r = await fn(tx); for (const p in w) await window.__fsSet(p, w[p]); return r; } } } };'''
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def device(tag):
            ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1, is_mobile=True, has_touch=True)
            ctx.expose_function('__fsGet', lambda path: store.get(path))
            ctx.expose_function('__fsSet', lambda path, data: store.__setitem__(path, data))
            ctx.add_init_script(INIT)
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            def h(r):
                u = r.request.url
                if 'three.module.js' in u and THREE_LOCAL: r.fulfill(path=THREE_LOCAL, content_type='application/javascript')
                elif 'www.gstatic.com/firebasejs/' in u: r.fulfill(path=os.path.join(SDKD, u.rsplit('/', 1)[1]), content_type='application/javascript', headers={'access-control-allow-origin': '*'})
                elif 'fonts.g' in u: r.abort()
                else: r.continue_()
            pg.route('**/*', h)
            pg.goto(URL); pg.wait_for_function('window.__tb && window.__tb.G.mode === "title"', timeout=60000); time.sleep(1.0)
            return ctx, pg, errs
        J = lambda pg, js: pg.evaluate(js)
        def val(pg, sel, v): J(pg, "() => { document.querySelector('%s').value = '%s'; }" % (sel, v))
        def clk(pg, sel): J(pg, "() => document.querySelector('%s').click()" % sel)
        def until(pg, js, t=20):
            end = time.time() + t
            while time.time() < end:
                if J(pg, js): return True
                time.sleep(0.2)
            return False
        res = {'tag': 'cloud'}
        cA, A, eA = device('A')
        res['mode'] = J(A, '() => __tb.ACCT.mode'); res['note'] = J(A, "() => document.querySelector('#lgNote').textContent")
        clk(A, '#btnRegister'); val(A, '#lgPw', 'neko22'); val(A, '#lgPw2', 'neko22'); clk(A, '#btnRegister')
        res['A_register'] = until(A, "() => !document.querySelector('#lgDone').hidden") and J(A, "() => document.querySelector('#lgDoneId').textContent")
        A.screenshot(path=os.path.join(OUT, '90_cloud_done.png'))
        clk(A, '#btnDoneOk'); time.sleep(0.5); res['A_bar'] = J(A, "() => document.querySelector('#acctWho').textContent")
        J(A, "() => { document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.querySelector('#stages .stage-card').click(); }"); time.sleep(2.5)
        J(A, "() => { const s=__tb.G.session.sim; s.mobs.forEach(m => s.dealToEnemy(s.allies[0], m, 9999, 'str', 'A', null)); }"); time.sleep(1)
        J(A, "() => { const s=__tb.G.session.sim; s.mobs=[]; s.barrier='none'; s.allies.forEach((a,i)=>{a.x=-2+i;a.z=-1;}); s.allies[0].z=3; }"); time.sleep(7)
        J(A, "() => { const s=__tb.G.session.sim; s.boss.hp = 1; s.dealToEnemy(s.allies[0], s.boss, 999, 'str', 'A', null); }")
        until(A, "() => __tb.G.mode === 'result' && /自動セーブしました|できません/.test(document.querySelector('#resSave').textContent)", 30)
        res['A_result'] = J(A, "() => document.querySelector('#resSave').textContent")
        A.screenshot(path=os.path.join(OUT, '91_cloud_result.png'))
        cB, B, eB = device('B')  # 別の端末
        val(B, '#lgId', '1'); val(B, '#lgPw', 'inu333'); clk(B, '#btnLogin'); until(B, "() => /ちがいます|通信/.test(document.querySelector('#lgMsg').textContent) && !document.querySelector('#btnLogin').disabled")
        res['B_wrong_pw'] = J(B, "() => document.querySelector('#lgMsg').textContent")
        val(B, '#lgPw', 'neko22'); clk(B, '#btnLogin'); until(B, "() => !!__tb.G.acct")
        res['B_login_id1'] = J(B, "() => { const a = __tb.G.acct; return a && [a.id, a.rec.b, a.rec.w, a.rec.mobs]; }")
        J(B, "() => document.getElementById('btnAcct').click()"); time.sleep(0.4); B.screenshot(path=os.path.join(OUT, '92_cloud_account_B.png'))
        J(B, "() => { document.getElementById('btnLogout').click(); document.getElementById('btnAcct').click(); }"); time.sleep(0.3)
        clk(B, '#btnRegister'); val(B, '#lgPw', 'inu333'); val(B, '#lgPw2', 'inu333'); clk(B, '#btnRegister')
        res['B_register'] = until(B, "() => !document.querySelector('#lgDone').hidden") and J(B, "() => document.querySelector('#lgDoneId').textContent")
        res['server'] = {k: (v if k.startswith('meta') or k.startswith('ids') else '(save)') for k, v in store.items()}
        res['errors'] = eA + eB
        b.close(); results.append(res)
    if SCEN in ('cloud',):
        # サーバー版（Firebase）：本物のSDK（gstaticの代わりにローカルのコピー）＋Authエミュレーター＋共有の検査用Firestore。2つのブラウザ＝2台の端末
        FB_DIR = os.environ['FB_DIR']; SDKD = os.path.join(FB_DIR, 'node_modules', 'firebase')
        import urllib.request
        urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9099/emulator/v1/projects/demo-tb/accounts', method='DELETE')).read()
        store = {}
        INIT = '''window.__TB_CLOUD_TEST = { cfg: { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-tb' }, opt: { authEmulator: 'http://127.0.0.1:9099', db: {}, fs: {
          doc: (db, c, id) => ({ path: c + '/' + id }),
          async getDoc(ref) { const d = await window.__fsGet(ref.path); return { exists: () => d != null, data: () => d }; },
          async setDoc(ref, data) { await window.__fsSet(ref.path, JSON.parse(JSON.stringify(data))); },
          async runTransaction(db, fn) { const w = {}; const tx = { async get(ref) { const d = await window.__fsGet(ref.path); return { exists: () => d != null, data: () => d }; }, set(ref, data) { w[ref.path] = JSON.parse(JSON.stringify(data)); } }; const r = await fn(tx); for (const p in w) await window.__fsSet(p, w[p]); return r; } } } };'''
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def device(tag):
            ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1, is_mobile=True, has_touch=True)
            ctx.expose_function('__fsGet', lambda path: store.get(path))
            ctx.expose_function('__fsSet', lambda path, data: store.__setitem__(path, data))
            ctx.add_init_script(INIT)
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            def h(r):
                u = r.request.url
                if 'three.module.js' in u and THREE_LOCAL: r.fulfill(path=THREE_LOCAL, content_type='application/javascript')
                elif 'www.gstatic.com/firebasejs/' in u: r.fulfill(path=os.path.join(SDKD, u.rsplit('/', 1)[1]), content_type='application/javascript', headers={'access-control-allow-origin': '*'})
                elif 'fonts.g' in u: r.abort()
                else: r.continue_()
            pg.route('**/*', h)
            pg.goto(URL); pg.wait_for_function('window.__tb && window.__tb.G.mode === "title"', timeout=60000); time.sleep(1.0)
            return ctx, pg, errs
        J = lambda pg, js: pg.evaluate(js)
        def val(pg, sel, v): J(pg, "() => { document.querySelector('%s').value = '%s'; }" % (sel, v))
        def clk(pg, sel): J(pg, "() => document.querySelector('%s').click()" % sel)
        def until(pg, js, t=20):
            end = time.time() + t
            while time.time() < end:
                if J(pg, js): return True
                time.sleep(0.2)
            return False
        res = {'tag': 'cloud'}
        cA, A, eA = device('A')
        res['mode'] = J(A, '() => __tb.ACCT.mode'); res['note'] = J(A, "() => document.querySelector('#lgNote').textContent")
        clk(A, '#btnRegister'); val(A, '#lgPw', 'neko22'); val(A, '#lgPw2', 'neko22'); clk(A, '#btnRegister')
        res['A_register'] = until(A, "() => !document.querySelector('#lgDone').hidden") and J(A, "() => document.querySelector('#lgDoneId').textContent")
        if not res['A_register']: res['A_msg'] = J(A, "() => document.querySelector('#lgMsg').textContent")
        A.screenshot(path=os.path.join(OUT, '90_cloud_done.png'))
        clk(A, '#btnDoneOk'); time.sleep(0.5); res['A_bar'] = J(A, "() => document.querySelector('#acctWho').textContent")
        J(A, "() => { document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.querySelector('#stages .stage-card').click(); }"); time.sleep(2.5)
        J(A, "() => { const s=__tb.G.session.sim; s.mobs.forEach(m => s.dealToEnemy(s.allies[0], m, 9999, 'str', 'A', null)); }"); time.sleep(1)
        J(A, "() => { const s=__tb.G.session.sim; s.mobs=[]; s.barrier='none'; s.allies.forEach((a,i)=>{a.x=-2+i;a.z=-1;}); s.allies[0].z=3; }"); time.sleep(7)
        J(A, "() => { const s=__tb.G.session.sim; s.boss.hp = 1; s.dealToEnemy(s.allies[0], s.boss, 999, 'str', 'A', null); }")
        until(A, "() => __tb.G.mode === 'result' && /自動セーブしました|できません/.test(document.querySelector('#resSave').textContent)", 30)
        res['A_result'] = J(A, "() => document.querySelector('#resSave').textContent")
        A.screenshot(path=os.path.join(OUT, '91_cloud_result.png'))
        cB, B, eB = device('B')  # 別の端末
        val(B, '#lgId', '1'); val(B, '#lgPw', 'inu333'); clk(B, '#btnLogin'); until(B, "() => /ちがいます|つながり/.test(document.querySelector('#lgMsg').textContent) && !document.querySelector('#btnLogin').disabled")
        res['B_wrong_pw'] = J(B, "() => document.querySelector('#lgMsg').textContent")
        val(B, '#lgPw', 'neko22'); clk(B, '#btnLogin'); until(B, "() => !!__tb.G.acct")
        res['B_login_id1'] = J(B, "() => { const a = __tb.G.acct; return a && [a.id, a.rec.b, a.rec.w, a.rec.mobs]; }")
        J(B, "() => document.getElementById('btnAcct').click()"); time.sleep(0.4); B.screenshot(path=os.path.join(OUT, '92_cloud_account_B.png'))
        J(B, "() => { document.getElementById('btnLogout').click(); document.getElementById('btnAcct').click(); }"); time.sleep(0.3)
        clk(B, '#btnRegister'); val(B, '#lgPw', 'inu333'); val(B, '#lgPw2', 'inu333'); clk(B, '#btnRegister')
        res['B_register'] = until(B, "() => !document.querySelector('#lgDone').hidden") and J(B, "() => document.querySelector('#lgDoneId').textContent")
        res['server'] = {k: (v if k.startswith('meta') or k.startswith('ids') else '(save)') for k, v in store.items()}
        res['errors'] = eA + eB
        b.close(); results.append(res)
    if SCEN in ('revive',):
        # 救助の円（気絶した仲間のまわり）とキャンディー
        results.append(run(p, 844, 390, 'revive', [ev(START_SOLO), wait(1.0), ev(TO_BOSS), wait(6.5),
            ev("() => { const s=__tb.G.session.sim; s.allies.forEach(a=>a.inv=999); s.boss.testIdle = true; const a=s.allies[0], o=s.allies[1]; o.x=a.x+1.2; o.z=a.z+1.0; o.inv=0; o.act=null; s.dealToAlly(o, 99999, 'str', s.boss, {}); s.candyT=0.01; return o.st; }", 'down'),
            wait(0.4), ev("() => __tb.G.session.sim.pickups.filter(p=>p.kind==='candy').map(p=>[+p.x.toFixed(1),+p.z.toFixed(1)])", 'candy'),
            ev("() => { const s=__tb.G.session.sim, c=s.pickups.find(p=>p.kind==='candy'), a=s.allies[0]; c.x=a.x-1.6; c.z=a.z+1.2; return 1; }"),
            wait(1.6), shot('95_revive_candy'), ev("() => [__tb.G.v.allies[1].st, __tb.G.v.allies[1].revP]", 'progress'),
            wait(3.0), ev("() => { const o=__tb.G.session.sim.allies[1]; return [o.st, Math.round(o.hp/o.maxHp*100)]; }", 'after4s'),
            ev("() => { const s=__tb.G.session.sim, a=s.allies[0], c=s.pickups.find(p=>p.kind==='candy'); a.hp=10; a.x=c.x; a.z=c.z; return 1; }"), wait(0.3),
            ev("() => { const a=__tb.G.session.sim.allies[0]; return [a.hp, a.maxHp]; }", 'candy_heal'), shot('96_after')]))
    if SCEN in ('menus',):
        results.append(run(p, 844, 390, 'menus', [ev("() => { document.getElementById('btnGuest').click(); return 1; }"), ev("() => { document.getElementById('btnHow').click(); return 1; }"), wait(0.4), shot('40_how'), ev("() => { document.querySelector('#how [data-back]').click(); document.getElementById('btnSet').click(); return 1; }"), wait(0.3), shot('41_settings'), ev("() => { document.querySelector('#settings [data-back]').click(); document.getElementById('btnCoop').click(); return 1; }"), wait(0.3), shot('42_coop')]))
    for r in results:
        print('===', r['tag'])
        for k, v in r.items():
            if k in ('tag',): continue
            if k == 'errors':
                print('errors:', len(v)); [print('  ', e[:300] if not os.environ.get('WARN_STACK') else e[:1200]) for e in v[:25]]
            else: print(k, ':', v)
srv.shutdown()
