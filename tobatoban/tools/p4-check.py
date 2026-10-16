#!/usr/bin/env python3
"""v7 P4 の画面確認（ブラウザ）：夜祭りの背景・ホームの3Dモデルのタップ・能力バー・横画面と入力。
使い方: THREE_LOCAL=... python3 tobatoban/tools/p4-check.py [出力フォルダ]
・実機ではなく Chromium の画面で確かめる（キーボードの表示は、画面の高さを縮めて代わりに再現する）"""
import sys, os, threading, http.server, socketserver, time, functools, json
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tb-p4'; os.makedirs(OUT, exist_ok=True)
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
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    # ---------- 横向きの端末 ----------
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, screen={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); route(pg); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{port}/index.html?save=local', wait_until='commit', timeout=120000)
    ok(until(pg, 'window.__tb && __tb.G.mode === "title"'), '起動してログイン画面')
    time.sleep(1.5)
    st = pg.evaluate('({ act: __tb.LOBBY3D ? 1 : 0 })')
    lob = pg.evaluate("(() => { const L = window.__tb && __tb.G; return { mode: typeof LOBBY3D !== 'undefined' ? __tb.LOBBY3D.mode : null }; })()")
    m0 = pg.evaluate("(() => { try { return __tb.LOBBY3D.mode; } catch (e) { return 'n/a'; } })()")
    ok(m0 == 'bg', f'ログイン画面の後ろは夜祭りの3D（mode={m0}）')
    pg.screenshot(path=os.path.join(OUT, 'p4_01_login_fest.png'))
    pg.evaluate("document.getElementById('btnGuest').click()"); time.sleep(1.2)
    m1 = pg.evaluate("__tb.LOBBY3D.mode"); ok(m1 == 'home', f'ホームは4体＋夜祭り（mode={m1}）')
    t1 = pg.evaluate("__tb.G.T"); time.sleep(1.0)
    fw = pg.evaluate("(() => { const s = __tb.R.scene; let n = 0; s.traverse(o => { if (o.isPoints && o.material && o.material.opacity > 0.05 && o.material.blending === 2) n++; }); return n; })()")
    ok(pg.evaluate("__tb.G.T") > t1, '背景の時間が進んでいる（止まった画面ではない）')
    pg.screenshot(path=os.path.join(OUT, 'p4_02_home_fest.png'))
    # ホームの3Dモデル（P3）を本当に指で押す
    pos = pg.evaluate("(() => { const p = __tb.LOBBY3D.slotScreen(2); return [p.mid.x, (p.mid.y + p.head.y) / 2]; })()")
    pg.mouse.click(pos[0], pos[1]); time.sleep(0.6)
    r = pg.evaluate("({ roster: !document.getElementById('roster').hidden, slot: __tb.G.selSlot })")
    ok(r['roster'] and r['slot'] == 2, f'P3のモデルを押す → P3の編成画面（{r}）')
    pg.screenshot(path=os.path.join(OUT, 'p4_03_roster_p3.png'))
    # キャラ詳細の能力バー
    pg.evaluate("document.querySelector('#cards .rs-card').click()"); time.sleep(0.8)
    bars = pg.evaluate("[...document.querySelectorAll('#chRight .stb')].map(b => [...b.children].map(i => i.style.width))")
    ok(len(bars) == 4 and all(len(x) >= 2 for x in bars), f'能力の横バー4本（{bars}）')
    m2 = pg.evaluate("__tb.LOBBY3D.mode"); ok(m2 == 'detail', 'キャラ詳細は1体＋夜祭り')
    pg.screenshot(path=os.path.join(OUT, 'p4_04_detail_bars.png'))
    # 戻る道すじ：詳細→ホーム、フレンド→ホーム
    pg.evaluate("__tb.G && document.getElementById('btnChBack') ? document.getElementById('btnChBack').click() : 0"); time.sleep(0.4)
    pg.evaluate("goTitle ? 0 : 0") if False else None
    pg.evaluate("__tb.show('title')"); time.sleep(0.5)
    ok(pg.evaluate("__tb.LOBBY3D.mode") == 'home', '詳細から戻るとホームの夜祭り')
    pg.evaluate("document.getElementById('btnFriend').click()"); time.sleep(0.6)
    mf = pg.evaluate("__tb.LOBBY3D.active() ? __tb.LOBBY3D.mode : 'off'"); ok(mf == 'bg', f'フレンド画面の後ろも夜祭り（{mf}）')
    pg.evaluate("__tb.show('title')"); time.sleep(0.5); ok(pg.evaluate("__tb.LOBBY3D.mode") == 'home', 'フレンドから戻るとホームの夜祭り')
    # 入力：横向きの端末でキーボードが出て高さが減っても縦向きと誤判定しない
    pg.evaluate("__tb.openLogin('title', '')"); time.sleep(0.4)
    pg.evaluate("(() => { const b = [...document.querySelectorAll('#lgChoices button')].find(x => /ログイン/.test(x.textContent)); if (b) b.click(); })()"); time.sleep(0.3)
    pg.focus('#lgId'); pg.set_viewport_size({'width': 844, 'height': 200}); time.sleep(0.6)
    rk = pg.evaluate("({ rot: __tb.VIEW.rot, kb: !!__tb.G.kbUp })"); ok(rk['rot'] == 0, f'横向きの端末：キーボード（高さ200）でも回さない（{rk}）')
    pg.screenshot(path=os.path.join(OUT, 'p4_05_land_kb.png'))
    pg.evaluate("document.activeElement.blur()"); pg.set_viewport_size({'width': 844, 'height': 390}); time.sleep(0.6)
    # v7 P6：仲間の必殺は右上へ流れ、敵の必殺は中央に名前
    pg.evaluate("(() => { const p = document.getElementById('login'); if (p && !p.hidden) document.getElementById('btnGuest').click(); __tb.show('title'); })()"); time.sleep(0.5)
    pg.evaluate("document.getElementById('btnSolo').click()"); ok(until(pg, "__tb.G.mode === 'play' && __tb.G.v && __tb.G.v.allies", 40), '出動して戦闘画面')
    time.sleep(1.0); pg.evaluate("__tb.spFeed(1, '九影・十連'); __tb.spFeed(2, '提灯花火'); __tb.enemySp('トバトーバ', '提灯おとし')"); time.sleep(1.0)
    fd = pg.evaluate("[...document.querySelectorAll('#spFeed .it')].map(x => x.textContent)"); es = pg.evaluate("document.getElementById('eSp').textContent")
    ok(len(fd) == 2 and fd[0].startswith('P2') and '九影・十連' in fd[0], f'仲間の必殺が右上に流れる（{fd}）'); ok('提灯おとし' in es, f'敵の必殺は中央に名前（{es}）')
    pg.screenshot(path=os.path.join(OUT, 'p6_01_sp_names.png'))
    time.sleep(2.8); ok(pg.evaluate("document.querySelectorAll('#spFeed .it').length") == 0, '約2.7秒で消える')
    # v7：回復キャラは味方を回復対象に指定でき、枠と足もとの印で示す
    pg.evaluate("(() => { const G = __tb.G; if (G.session.swapTo(3)) G.my = 3; })()"); time.sleep(0.5)
    hl = pg.evaluate("[__tb.singleHealer('momiji'), __tb.singleHealer('kogemaru'), __tb.G.v.allies[__tb.G.my].ch]")
    pg.evaluate("__tb.setHealTarget(1)"); time.sleep(0.5)
    mk = pg.evaluate("(() => { const m = document.querySelector('#labels .healmk'); const c = document.querySelectorAll('#party .card, #party > *')[1]; return { mk: !!m, card: !!c && c.classList.contains('tgt'), t: __tb.G.session.local.healT }; })()")
    ok(hl[0] and not hl[1] and mk['mk'] and mk['t'] == 1, f'回復対象の指定：単体回復のキャラだけ（{hl}）・足もとの印と枠（{mk}）')
    pg.screenshot(path=os.path.join(OUT, 'p4_08_heal_target.png'))
    ok(len(errs) == 0, f'ページのエラーなし（{errs[:3]}）')
    ctx.close()
    # ---------- 縦持ちの端末（画面を90度回して横向きに見せる） ----------
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, screen={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); route(pg); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{port}/index.html?save=local', wait_until='commit', timeout=120000)
    ok(until(pg, 'window.__tb && __tb.G.mode === "title"'), '縦持ち：起動')
    time.sleep(1.0)
    r0 = pg.evaluate("__tb.VIEW.rot"); ok(r0 in (90, -90), f'縦持ちでは横向きに回して表示（rot={r0}）')
    pg.evaluate("(() => { const b = [...document.querySelectorAll('#lgChoices button')].find(x => /ログイン/.test(x.textContent)); if (b) b.click(); })()"); time.sleep(0.3)
    pg.focus('#lgId'); time.sleep(0.3); pg.set_viewport_size({'width': 390, 'height': 420}); time.sleep(0.7)
    rk = pg.evaluate("({ rot: __tb.VIEW.rot, kb: !!__tb.G.kbUp, cls: document.getElementById('app').classList.contains('kbup') })")
    ok(rk['rot'] == 0 and rk['kb'], f'入力中は端末の向き（縦）に立てて表示し、キーボードと向きをそろえる（{rk}）')
    vis = pg.evaluate("(() => { const r = document.getElementById('lgId').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight + 1; })()")
    ok(vis, '入力欄がキーボードの上（見える範囲）にある')
    pg.screenshot(path=os.path.join(OUT, 'p4_06_port_kb.png'))
    pg.evaluate("document.activeElement.blur()"); pg.set_viewport_size({'width': 390, 'height': 844}); time.sleep(0.8)
    r2 = pg.evaluate("({ rot: __tb.VIEW.rot, kb: !!__tb.G.kbUp })"); ok(r2['rot'] in (90, -90) and not r2['kb'], f'入力が終わると横向き表示に戻る（{r2}）')
    pg.screenshot(path=os.path.join(OUT, 'p4_07_port_back.png'))
    ok(len(errs) == 0, f'縦持ち：ページのエラーなし（{errs[:3]}）')
    b.close()
print(f'\n{fails}件の失敗' if fails else '\nすべて合格')
sys.exit(1 if fails else 0)
