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
START_SOLO = '''() => { const g = document.getElementById('btnGuest'); if (g && !document.getElementById('login').hidden) g.click(); document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.querySelector('#stages .stage-card').click(); return __tb.G.mode; }'''
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
            shot('19_login_port'), ev("() => { document.getElementById('btnGuest').click(); return 1; }"), wait(0.3), shot('20_title_port'), ev("() => { document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); return 1; }"), wait(0.5), shot('21_team_port'),
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
        steps = [ev("() => { document.getElementById('btnGuest').click(); document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.querySelectorAll('#chTabs .tab')[1].click(); return 1; }"), wait(0.4), ev(vis, 'screen'), shot(pre + '60_stage_locked'),
            ev("() => { __tb.G.guest.clear.senju = 1; __tb.G.party.forEach(c => { __tb.G.guest.chars[c].lv = 20; __tb.G.guest.chars[c].exp = __tb.DATA.GROWTH.cum(__tb.DATA.CHI[c].rank, 20); }); document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.querySelectorAll('#chTabs .tab')[1].click(); return [...document.querySelectorAll('#stages .stage-card')].map(c => c.className); }", 'cards'), wait(0.3), shot(pre + '61_stage_open'),
            ev("() => { document.querySelectorAll('#stages .stage-card')[0].click(); return __tb.G.mode + ' ' + " + sim + ".stageId + ' ' + " + sim + ".stage; }", 'start'),
            wait(1.2), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_62_cut_collapse'), shot(pre + '62_cut_collapse'), wait(2.4), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_63_cut_platform'), shot(pre + '63_cut_platform'), wait(1.8), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_64_cut_board'), shot(pre + '64_cut_board'), wait(2.6), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_65_cut_inside'), shot(pre + '65_cut_inside'), wait(2.6), ev("() => { const s=__tb.G.session.sim; return [s.stage, Math.round(s.stageT*10)/10, Math.round(s.t*10)/10]; }", 't_66_cut_depart'), shot(pre + '66_cut_depart'),
            wait(2.0), ev("() => " + sim + ".stage + ' mobs ' + " + sim + ".mobs.length", 'after_intro'), shot(pre + '67_train'), check_overlap('overlap_train'),
            ev("() => { const s=" + sim + "; s.allies.forEach(a => a.inv = 999); const L = __tb.G.session.local; L.push('A'); L.push('A'); return 1; }"), wait(3.0), shot(pre + '68_fight'),
            ev("() => { const i = __tb.R.renderer.info; return {calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures}; }", 'perf'),
            ev("() => document.getElementById('bossbox').innerText.replace(/\\n/g,' | ')", 'route_text'),
            # 南千住の手前まで進める → 停車・ドア・乗車
            ev("() => { const s=" + sim + "; s.tr.d = DATA_LEN0 - 12; s.tr.v = 7; return s.tr.d; }".replace('DATA_LEN0', '__tb.DATA.JOBAN.segLen[0]')), wait(5.5), ev("() => { const t=" + sim + ".tr; return [t.at, t.ph, t.doors, Math.round(t.t*10)/10]; }", 'station'), shot(pre + '69_station'), wait(2.0), shot(pre + '70_boarding'),
            # 最後まで飛ばす：部下を全滅・日暮里を出た所 → 上野に着く
            ev("() => { const s=" + sim + "; __tb.DATA.JOBAN.events.forEach(e => s.fired[e.id] = 1); s.queue = []; s.mobs.forEach(m => { if (m.st === 'ok') s.dealToEnemy(s.allies[0], m, 99999, 'str', 'A', null); }); s.kills = s.total; const t = s.tr; t.at = 3; t.ph = 'run'; t.t = 0; t.d = __tb.DATA.JOBAN.segLen[3] - 100; t.v = 20; return s.stage; }", 'skip'),
            wait(3.0), shot(pre + '71_approach_ueno'), wait(8.5), ev("() => " + sim + ".stage + ' at ' + " + sim + ".tr.at", 'arrive_stage'), shot(pre + '72_ueno'), wait(2.5), shot(pre + '72b_ueno_platform'), wait(3.0), shot(pre + '72c_ueno_platform'), wait(3.0), ev("() => [__tb.G.mode, " + sim + ".result && " + sim + ".result.why]", 'result'), shot(pre + '73_result'),
            ev("() => document.getElementById('result') ? document.getElementById('result').innerText.slice(0, 300) : ''", 'result_text'),
            ev("() => { const t = document.getElementById('btnRetry').textContent; document.getElementById('btnRetry').click(); const s = " + sim + "; return [t, s.stageId, s.stage, s.allies.map(a => a.items.map(i => i.n).join('/')).join(' ')]; }", 'to_street'), wait(1.5), shot(pre + '74_street_intro'), wait(4.0), shot(pre + '75_street'),
            ev("() => { const s = " + sim + "; s.allies.forEach(a => a.inv = 1e9); return document.getElementById('bossbox').innerText.replace(/\\n/g,' | '); }", 'street_hud'), wait(4.0), shot(pre + '76_street_fight'),
            ev("() => { const s = " + sim + "; for (let g = 0; g < 3; g++) { s.mobs.filter(m => m.grpI === g && m.st === 'ok').forEach(m => s.dealToEnemy(s.allies[0], m, 1e6, 'str', 'A', null)); s.step(); } return [s.stage, s.result && s.result.why]; }", 'street_clear'), wait(4.0),
            ev("() => { const t = document.getElementById('btnRetry').textContent; document.getElementById('btnRetry').click(); return [t, document.getElementById('prep').innerText.replace(/\\n/g, ' | ').slice(0, 300)]; }", 'to_prep'), wait(0.4), shot(pre + '77_prep'),
            ev("() => { document.getElementById('btnPrepGo').click(); const s = " + sim + "; return [s.stageId, s.stage, s.allies.map(a => a.sp).join('/')]; }", 'ueno_start'), wait(2.0), shot(pre + '78_ueno_intro'),
        ]
        results.append(run(p, W, H, 'joban', steps))
    if SCEN in ('ueno', 'uenoport'):
        # 上野：章タブ→ヨシノシン→登場（指を鳴らす）→36体の前進→バリア→二十連→睡眠チェック→撃破→結果
        vis = "() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',')"
        sim = "__tb.G.session.sim"
        port = SCEN == 'uenoport'
        W, H = (390, 844) if port else (844, 390)
        pre = 'p' if port else ''
        steps = [ev("() => { document.getElementById('btnGuest').click(); const g = __tb.G.guest; g.clear.senju = 1; g.clear.joban = 1; g.clear.ueno_street = 1; g.uenoOpen = true; __tb.G.party.forEach(c => { g.chars[c].lv = 40; g.chars[c].exp = __tb.DATA.GROWTH.cum(__tb.DATA.CHI[c].rank, 40); }); document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.querySelectorAll('#chTabs .tab')[1].click(); return [...document.querySelectorAll('#stages .stage-card')].map(c => c.className); }", 'cards'), wait(0.4), shot(pre + '80_sortie_ueno'),
            ev("() => document.getElementById('stages').innerText.replace(/\\n/g, ' | ').slice(0, 400)", 'sortie_text'),
            ev("() => { document.querySelectorAll('#stages .stage-card')[2].click(); return __tb.G.mode + ' ' + " + sim + ".stageId + ' ' + " + sim + ".stage; }", 'start'),
            wait(0.6), shot(pre + '81_intro_a'), wait(0.8), shot(pre + '82_intro_snap'), wait(1.0), shot(pre + '83_intro_lean'), wait(1.6), ev("() => [" + sim + ".stage, " + sim + ".mobs.length, " + sim + ".hazards.length]", 'after_intro'), shot(pre + '84_charge'),
            ev("() => { const s=" + sim + "; s.allies.forEach(a => a.inv = 1e9); return 1; }"), wait(3.0), shot(pre + '85_fight'), check_overlap('overlap_ueno'),
            ev("() => { const i = __tb.R.renderer.info; return {calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures}; }", 'perf'),
            ev("() => document.getElementById('bossbox').innerText.replace(/\\n/g,' | ')", 'bossbox_text'),
            ev("() => { const s=" + sim + "; s.U.barrier = { t: 0, hits: 1, seen: {} }; s.ev('barrier', { on: 1 }); return 1; }"), wait(1.0), shot(pre + '86_barrier'),
            ev("() => { const s=" + sim + "; s.U.barrier = null; const al = s.mobs.filter(m => m.st === 'ok'); al.slice(0, Math.max(0, al.length - 10)).forEach(m => s.dealToEnemy(s.allies[0], m, 1e6, 'str', 'A', null)); const b = s.boss; b.st = 'idle'; b.gap = 0; s.U.thrQ = 1; return s.uenoAlive(); }", 'before_throw'), wait(2.2), shot(pre + '87_throw'), wait(1.5), shot(pre + '88_throw_land'), ev("() => [" + sim + ".uenoAlive(), " + sim + ".U.thrUsed]", 'after_throw'),
            wait(4.0), ev("() => { const s=" + sim + ", b = s.boss; b.hp = Math.round(b.maxHp * 0.52); s.U.barrier = null; if (b.st === 'hidden') { b.st = 'idle'; } s.U.sleepArmed = true; s.U.sleepWarn = false; s.dealToEnemy(s.allies[0], b, 3000, 'str', 'A', null); return [b.hp, s.U.sleepPend, b.st]; }", 'cross_half'), wait(4.0), ev("() => { const s=" + sim + "; return [s.boss.st, s.U.sleep && Math.round(s.U.sleep.dmg)]; }", 'sleeping'), shot(pre + '89_sleep'),
            ev("() => document.getElementById('sleepBox').innerText.replace(/\\n/g,' | ')", 'sleep_text'),
            ev("() => { const s=" + sim + "; s.dealToEnemy(s.allies[0], s.boss, 4000, 'str', 'A', null); return 1; }"), wait(1.2), ev("() => [" + sim + ".boss.st, " + sim + ".U.sleepDone]", 'sleep_ok'), shot(pre + '90_sleep_ok'),
            ev("() => { document.getElementById('map').click(); return 1; }"), wait(0.4), shot(pre + '91_map'), ev("() => { document.getElementById('map').click(); return 1; }"),
            ev("() => { const s=" + sim + "; s.U.done = [1, 1, 1]; s.U.sleep = null; s.U.pend = -1; s.boss.st = 'idle'; s.boss.hp = 1; s.dealToEnemy(s.allies[0], s.boss, 999, 'str', 'A', null); return s.stage; }", 'kill'), wait(1.5), shot(pre + '92_won'), wait(5.0),
            ev("() => [__tb.G.mode, document.getElementById('resExp') ? document.getElementById('resExp').innerText.replace(/\\n/g,' | ') : '']", 'result'), shot(pre + '93_result'),
        ]
        results.append(run(p, W, H, 'ueno', steps))
    if SCEN in ('akiba', 'akibaport'):
        # 秋葉原：上野勝利の結果→編成→15秒の徒歩演出→ホーム（オガ・カエ）→結果→広場の準備→広場（星・中）→図形→双子の15秒→勝利
        sim = "__tb.G.session.sim"
        port = SCEN == 'akibaport'
        W, H = (390, 844) if port else (844, 390)
        pre = 'p' if port else ''
        def walk_to(t):
            def f(page, res):
                end = time.time() + 400
                while time.time() < end:
                    m = page.evaluate('[__tb.G.mode, __tb.WALK.t]')
                    if m[0] != 'walk' or m[1] >= t: break
                    time.sleep(0.05)
            return f
        steps = [ev("() => { document.getElementById('btnGuest').click(); const g = __tb.G.guest; for (const k of ['senju','joban','ueno_street','ueno']) g.clear[k] = 1; g.uenoOpen = true; g.akibaOpen = true; __tb.G.party.forEach(c => { g.chars[c].lv = 60; g.chars[c].exp = __tb.DATA.GROWTH.cum(__tb.DATA.CHI[c].rank, 60); }); __tb.G.next = 'akiba'; document.getElementById('btnRetry').click(); return [__tb.G.teamBack, document.getElementById('btnGo').textContent]; }", 'team'), wait(0.4), shot(pre + 'a0_team'),
            ev("() => { document.getElementById('btnGo').click(); return __tb.G.mode; }", 'walk_mode'),
            walk_to(1.6), shot(pre + 'a1_walk_boss'), walk_to(4.0), shot(pre + 'a2_walk_ueno'), walk_to(6.0), shot(pre + 'a3_walk_street'), walk_to(8.4), shot(pre + 'a4_walk_okachi'),
            ev("() => document.getElementById('wkCap').innerText", 'cap_okachi'), walk_to(11.0), shot(pre + 'a5_walk_under'), walk_to(14.0), shot(pre + 'a6_walk_akiba'), ev("() => document.getElementById('wkCap').innerText + ' / ' + document.getElementById('wkTitle').className", 'cap_akiba'),
            walk_to(99), wait(0.5), ev("() => [__tb.G.mode, " + sim + ".stageId, " + sim + ".stage, __tb.G.guest.walkSeen]", 'after_walk'), shot(pre + 'a7_platform_intro'),
            wait(3.0), ev("() => { const s=" + sim + "; s.allies.forEach(a => a.inv = 1e9); return s.stage; }", 'pf_stage'), wait(3.0), shot(pre + 'a8_platform_fight'), check_overlap('overlap_platform'),
            ev("() => document.getElementById('bossbox').innerText.replace(/\\n/g,' | ')", 'pf_box'),
            ev("() => { const s=" + sim + "; for (const w of ['oga','kae']) { const m = s.foe(w); s.dealToEnemy(s.allies[0], m, 1e6, 'str', 'A', null); } return s.stage; }", 'pf_kill'), wait(5.0),
            ev("() => [__tb.G.mode, document.getElementById('btnRetry').textContent, document.getElementById('resReward').innerText]", 'pf_result'), shot(pre + 'a9_pf_result'),
            ev("() => { document.getElementById('btnRetry').click(); return [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',') + ' ' + document.getElementById('prepTitle').textContent; }", 'prep'), wait(0.3), shot(pre + 'b0_prep'),
            ev("() => { document.getElementById('btnPrepGo').click(); return " + sim + ".stageId; }", 'plaza'), wait(1.0), shot(pre + 'b1_plaza_intro_a'), wait(1.6), shot(pre + 'b2_plaza_revive'), wait(2.0),
            ev("() => { const s=" + sim + "; s.allies.forEach(a => a.inv = 1e9); return s.stage; }", 'pz_stage'), wait(2.0), shot(pre + 'b3_plaza_fight'), check_overlap('overlap_plaza'),
            ev("() => document.getElementById('bossbox').innerText.replace(/\\n/g,' | ')", 'pz_box'),
            ev("() => { const s=" + sim + "; s.AK.geoT = 0; return 1; }"), wait(0.8), shot(pre + 'b4_geo'), ev("() => { const s=" + sim + "; return s.AK.geo ? [s.AK.geo.n, s.AK.geo.whos.join(',')] : s.AK.geoWait ? 'wait' : 'none'; }", 'geo'), wait(1.2), shot(pre + 'b5_geo_b'),
            wait(4.0), ev("() => { const s=" + sim + "; s.dealToEnemy(s.allies[0], s.foe('hoshi'), 1e6, 'str', 'A', null); return [s.AK.twinDown, s.AK.twinT]; }", 'twin'), wait(1.0), shot(pre + 'b6_twin'),
            ev("() => document.getElementById('bossbox').innerText.replace(/\\n/g,' | ')", 'twin_box'),
            ev("() => { document.getElementById('map').click(); return 1; }"), wait(0.4), shot(pre + 'b7_map'), ev("() => { document.getElementById('map').click(); return 1; }"),
            ev("() => { const s=" + sim + "; s.dealToEnemy(s.allies[0], s.foe('naka'), 1e6, 'str', 'A', null); return s.stage; }", 'win'), wait(5.0),
            ev("() => [__tb.G.mode, document.getElementById('resReward').innerText, document.getElementById('resExp') ? document.getElementById('resExp').innerText.replace(/\\n/g,' | ').slice(0, 300) : '']", 'pz_result'), shot(pre + 'b8_result'),
        ]
        results.append(run(p, W, H, 'akiba', steps))
    if SCEN in ('gachabug', 'gachabugport'):
        # ガチャから戻れるか：ログイン画面→ガチャ→戻る、タイトル→ガチャ→戻る（2回）、見本の途中で戻る、ログインして引く→取消
        vis = "() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',')"
        back_rect = "() => { const r = document.getElementById('btnGcBack').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.bottom), innerWidth, innerHeight, document.getElementById('gacha').scrollHeight, document.getElementById('gacha').clientHeight]; }"
        click = lambda sel: ev("() => { document.querySelector('%s').click(); return 1; }" % sel)
        W, H = (390, 844) if SCEN == 'gachabugport' else (844, 390)
        results.append(run(p, W, H, 'gachabug', [
            ev(vis, 's0'), click('#btnLgGacha'), wait(0.6), ev(vis, 's1_gacha'), ev(back_rect, 'back_rect'), shot('g01_gacha'),
            click('#btnGcBack'), wait(0.3), ev(vis, 's2_after_back'), shot('g02_after_back'),
            click('#btnLgGacha'), wait(0.6), ev(vis, 's3_gacha_again'), shot('g03_gacha_again'), click('#btnGcDraw'), wait(0.4), ev(vis, 's4_login_from_draw'), shot('g04_login'),
            click('#btnGuest'), wait(0.4), ev(vis, 's5_after_cancel'), shot('g05_after_cancel'), click('#btnGcBack'), wait(0.3), ev(vis, 's6'),
            click('#btnGuest'), wait(0.3), ev(vis, 's7_title'), click('#btnGacha'), wait(0.6), ev(vis, 's8_gacha_from_hub'), click('#btnGcSample'), wait(1.0), click('#btnGcBack'), wait(0.3), ev(vis, 's9_back_mid_anim'),
            click('#btnGacha'), wait(0.8), ev(vis, 's10_gacha3'), ev("() => [!!__tb.GC.r, __tb.GC.run, !!__tb.GC.sc]", "gc_state"), shot('g10_gacha3'), click('#btnGcSample'), wait(4.0), shot('g11_sample'), click('#btnGcBack'), wait(0.3), ev(vis, 's12'),
        ]))
    if SCEN in ('hub',):
        # BIGバスターズ：ログイン画面のガチャ入口→演出見本→拠点→編成（絞り込み・詳細）→図鑑→出動（章タブ）→北千住で勝つ→結果のEXP
        vis = "() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',')"
        click = lambda sel: ev("() => { document.querySelector('%s').click(); return 1; }" % sel)
        results.append(run(p, 844, 390, 'hub', [
            shot('h00_login'), click('#btnLgGacha'), wait(0.6), ev(vis, 'gacha_screen'), shot('h01_gacha_guest'),
            ev("() => { __tb.G.thumbs; const ids = __tb.DATA.GACHA_IDS.filter(id => __tb.DATA.CHI[id].rank === 'S'); return ids.length; }"),
            ev("() => { document.getElementById('btnGcSample').click(); return 1; }"), wait(1.2), shot('h02_gacha_turn'), wait(1.4), shot('h03_gacha_open'), wait(2.6), shot('h04_gacha_show'),
            click('#btnGcBack'), wait(0.3), click('#btnGuest'), wait(0.3), ev(vis, 'after_guest'), shot('h05_hub'),
            click('#btnTeam'), wait(0.4), shot('h06_team'), ev("() => { const p = document.querySelector('#team .panel'); p.scrollTop = 170; return p.scrollHeight; }", 'team_scroll'), wait(0.2), shot('h06b_team_scroll'), ev("() => { document.querySelector('#team .panel').scrollTop = 0; return 1; }"), click('#rsFilterBtn'), ev("() => { [...document.querySelectorAll('#rsRank .chip')].find(b => b.textContent === 'D').click(); return document.querySelectorAll('#cards .card').length; }", 'cards_D'), wait(0.2), shot('h07_team_filter'),
            ev("() => { const c = [...document.querySelectorAll('#cards .card .det')][3]; c.click(); return document.querySelector('#detail .hd b').textContent; }", 'detail'), wait(0.2), shot('h08_detail'),
            ev("() => { document.getElementById('rsClear').click(); document.querySelectorAll('#cards .card')[2].click(); return __tb.G.party.join(','); }", 'party_after_pick'),
            click('#btnTeamBack'), wait(0.2), click('#btnZukan'), wait(0.4), ev("() => { __tb.G.prefs.owned = false; document.getElementById('rsSort').dispatchEvent(new Event('change')); return document.querySelectorAll('#cards .card.unowned').length; }", 'zukan_unowned'), wait(0.2), shot('h09_zukan'),
            click('#btnTeamBack'), wait(0.2), click('#btnSolo'), click('#btnGo'), wait(0.3), shot('h10_sortie_senju'), ev("() => { document.querySelectorAll('#chTabs .tab')[1].click(); return document.querySelectorAll('#stages .stage-card.locked').length; }", 'ueno_locked'), wait(0.2), shot('h11_sortie_ueno'),
            ev("() => { document.querySelectorAll('#chTabs .tab')[0].click(); document.querySelector('#stages .stage-card').click(); return __tb.G.mode; }", 'start'), wait(2.0),
            ev(TO_BOSS), wait(6.5), ev("() => { const s=__tb.G.session.sim; s.boss.hp = 1; s.dealToEnemy(s.allies[0], s.boss, 999, 'str', 'A', null); return s.stage; }"), wait(5),
            ev("() => document.getElementById('resExp').innerText.replace(/\\n/g,' | ')", 'res_exp'), shot('h12_result'),
            ev("() => { const a = __tb.G.guest; return [a.chars[__tb.G.party[0]].lv, a.chars[__tb.G.party[1]].exp, a.wins.tobatoban, a.clear.senju]; }", 'guest_after'),
            click('#btnResTitle'), wait(0.3), click('#btnSolo'), click('#btnGo'), wait(0.3), ev("() => { document.querySelectorAll('#chTabs .tab')[1].click(); return [...document.querySelectorAll('#stages .stage-card')].map(c => c.className); }", 'ueno_tab_after_win'), shot('h13_sortie_after'),
        ]))
    if SCEN in ('tap',):
        # 敵をタップ → 注目＋「追尾」の印 → 射撃の弾が追いかけて当たる。遠い敵は「遠すぎて狙えません」
        sim = "__tb.G.session.sim"
        def tap_mob(near):
            def f(page, res):
                js = '''(near) => { const s = __tb.G.session.sim, a = s.allies[__tb.G.my], v = __tb.G.v; let best = null;
                  for (const m of v.mobs) { if (m.dying) continue; const d = Math.hypot(m.x - a.x, m.z - a.z); const p = __tb.R.project(m.x, 0.9, m.z);
                    if (!p.front || p.x < 120 || p.x > innerWidth - 220 || p.y < 60 || p.y > innerHeight - 90) continue;
                    if (near ? d < 10 : d > 14.5) { if (!best || (near ? d < best.d : d > best.d)) best = { id: m.id, d, x: p.x, y: p.y }; } }
                  return best; }'''
                b = page.evaluate(js, near)
                res['tap_' + ('near' if near else 'far')] = b
                if b: page.mouse.click(b['x'], b['y'])
                time.sleep(0.3)
                res['lock_after_' + ('near' if near else 'far')] = page.evaluate("() => __tb.G.lock")
                res['notice_' + ('near' if near else 'far')] = page.evaluate("() => document.getElementById('notice').innerText.slice(0, 80)")
            return f
        results.append(run(p, 844, 390, 'tap', [
            ev("() => { document.getElementById('btnGuest').click(); __tb.G.party = ['hoshisuzume', 'kogemaru', 'burikidon', 'momiji']; __tb.G.sessClear.senju = true; document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.getElementById('btnGo').click(); document.querySelectorAll('#stages .stage-card')[1].click(); return 1; }"),
            wait(0.5), ev("() => { const s=" + sim + "; s.stageT = __tb.DATA.JOBAN.introT; return 1; }"), wait(2.0),
            ev("() => { const s=" + sim + "; s.allies.forEach(a => a.inv = 999); s.mobs.forEach(m => { m.hp = m.maxHp = 50000; }); s.allies.forEach((a, i) => { if (i) { a.x = -1 + i * 0.5; a.z = -12; } }); return s.mobs.length; }", 'mobs'),
            wait(1.5), tap_mob(True), wait(0.3), shot('a0_tap_lock'),
            ev("() => document.querySelector('.reticle-w') ? document.querySelector('.reticle-w').className + ' / ' + document.querySelector('.reticle-w .tag').textContent : 'none'", 'reticle'),
            ev("() => { const L = __tb.G.session.local; L.push('A'); return 1; }"), wait(0.15),
            ev("() => { const s=" + sim + "; return s.projs.filter(p => p.team === 'ally').map(p => p.tgt || null); }", 'proj_tgts'), shot('a1_shot'),
            ev("() => { const L = __tb.G.session.local; L.push('A'); return 1; }"), wait(0.6), ev("() => { const L = __tb.G.session.local; L.push('A'); return 1; }"), wait(0.8),
            ev("() => { const s=" + sim + ", m = s.mobs.find(q => q.id === __tb.G.lock); return m ? m.maxHp - m.hp : 'gone'; }", 'target_damage'),
            ev("() => { const s=" + sim + ", a = s.allies[__tb.G.my]; const m = s.mobs.find(q => q.id !== __tb.G.lock && q.st === 'ok'); m.x = 0.3; m.z = a.z + 17; m.para = 99; return [m.id, Math.round(m.z - a.z)]; }", 'far_mob'), wait(0.4),
            tap_mob(False), shot('a2_tap_far'),
        ]))
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
        J(A, "() => { document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.getElementById('btnGo').click(); document.querySelector('#stages .stage-card').click(); }"); time.sleep(2.5)
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
        J(A, "() => { document.getElementById('btnSolo').click(); document.getElementById('btnGo').click(); document.getElementById('btnGo').click(); document.querySelector('#stages .stage-card').click(); }"); time.sleep(2.5)
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
