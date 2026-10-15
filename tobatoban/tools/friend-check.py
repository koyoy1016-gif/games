#!/usr/bin/env python3
"""フレンド機能の画面確認（2つのページ＝2人。本物のFirebase SDK＋Authエミュレーター＋共有の検査用Firestore）。
決まり（firestore.rules）の確認は tools/cloud-test.mjs。ここは画面の流れ：
  登録 → コードを申請 → 承認 → ホストがルームを作る → 一覧に「募集中・参加」 → 招待 → ホームの通知から参加
使い方: FB_DIR=<firebaseをnpm iしたフォルダ> THREE_LOCAL=<three.module.js> python3 tools/friend-check.py [出力フォルダ]
（先に Auth エミュレーターを 9099 で起動しておく）"""
import sys, os, threading, http.server, socketserver, json, time, functools, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tb-friend'
os.makedirs(OUT, exist_ok=True)
THREE_LOCAL = os.environ.get('THREE_LOCAL'); FB_DIR = os.environ['FB_DIR']; SDKD = os.path.join(FB_DIR, 'node_modules', 'firebase')
W, H = int(os.environ.get('VW', 844)), int(os.environ.get('VH', 390))

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/index.html?net=bc'
urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9099/emulator/v1/projects/demo-tb/accounts', method='DELETE')).read()

store = {}
def fs_list(uid): return [{'id': k.split('/')[1], 'd': v} for k, v in store.items() if k.startswith('friends/') and uid in v.get('m', [])]
INIT = '''window.__TB_CLOUD_TEST = { cfg: { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-tb' }, opt: { authEmulator: 'http://127.0.0.1:9099', db: {}, fs: {
  doc: (db, c, id) => ({ path: c + '/' + id }),
  async getDoc(ref) { const d = await window.__fsGet(ref.path); return { exists: () => d != null, data: () => d }; },
  async setDoc(ref, data) { await window.__fsSet(ref.path, JSON.parse(JSON.stringify(data))); },
  async deleteDoc(ref) { await window.__fsDel(ref.path); },
  collection: (db, c) => ({ c }), where: (f, op, v) => ({ f, op, v }), query: (c, w) => ({ c: c.c, w }),
  async getDocs(q) { const r = await window.__fsList(q.w.v); return { docs: r.map(x => ({ id: x.id, data: () => x.d })) }; },
  async runTransaction(db, fn) { const w = {}; const tx = { async get(ref) { const d = await window.__fsGet(ref.path); return { exists: () => d != null, data: () => d }; }, set(ref, data) { w[ref.path] = JSON.parse(JSON.stringify(data)); } }; const r = await fn(tx); for (const p in w) await window.__fsSet(p, w[p]); return r; },
} } };'''

res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, is_mobile=True, has_touch=True)
    ctx.expose_function('__fsGet', lambda path: store.get(path))
    ctx.expose_function('__fsSet', lambda path, data: store.__setitem__(path, data))
    ctx.expose_function('__fsDel', lambda path: store.pop(path, None))
    ctx.expose_function('__fsList', fs_list)
    ctx.add_init_script(INIT)
    errs = []
    def page(url=URL):
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        def h(r):
            u = r.request.url
            if 'three.module.js' in u and THREE_LOCAL: r.fulfill(path=THREE_LOCAL, content_type='application/javascript')
            elif 'www.gstatic.com/firebasejs/' in u: r.fulfill(path=os.path.join(SDKD, u.rsplit('/', 1)[1]), content_type='application/javascript', headers={'access-control-allow-origin': '*'})
            elif 'fonts.g' in u: r.abort()
            else: r.continue_()
        pg.route('**/*', h)
        pg.on('console', lambda m: m.type in ('error', 'warning') and errs.append('console: ' + m.text[:200]))
        pg.goto(url, wait_until='commit', timeout=120000)
        end = time.time() + 120
        while time.time() < end:
            try:
                if pg.evaluate('() => !!(window.__tb && window.__tb.G.mode === "title")'): break
            except Exception: pass
            time.sleep(0.5)
        else: print(json.dumps({'boot_fail': url, 'state': pg.evaluate("() => [!!window.__tb, window.__tb && __tb.G.mode, document.readyState, location.href, document.visibilityState]"), 'errors': errs, 'res': res}, ensure_ascii=False, indent=1)); raise SystemExit(1)
        time.sleep(1.0)
        return pg
    J = lambda pg, js: pg.evaluate(js)
    def val(pg, sel, v): J(pg, "() => { const e = document.querySelector('%s'); e.value = '%s'; e.dispatchEvent(new Event('input')); }" % (sel, v))
    def clk(pg, sel): J(pg, "() => document.querySelector('%s').click()" % sel)
    def until(pg, js, t=20):
        end = time.time() + t
        while time.time() < end:
            if J(pg, js): return True
            time.sleep(0.2)
        return False
    def register(pg, pw):
        clk(pg, '#btnRegister'); val(pg, '#lgPw', pw); val(pg, '#lgPw2', pw); clk(pg, '#btnRegister')
        until(pg, "() => !document.querySelector('#lgDone').hidden"); clk(pg, '#btnDoneOk'); time.sleep(0.6)
    def rows(pg, sel): return J(pg, "() => [...document.querySelectorAll('%s .fr-row')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())" % sel)
    vis = "() => [...document.querySelectorAll('.screen')].filter(s => !s.hidden).map(s => s.id).join(',')"

    A = page()
    # ゲスト（未ログイン）でフレンドを押す
    clk(A, '#btnGuest'); time.sleep(0.3); clk(A, '#btnFriend'); time.sleep(0.4)
    res['guest'] = J(A, "() => [document.querySelector('#frOff').hidden, document.querySelector('#frOffTxt').textContent]"); A.screenshot(path=os.path.join(OUT, 'f0_guest.png'))
    clk(A, '#btnFrLogin'); time.sleep(0.3); res['guest_login_screen'] = J(A, vis)
    register(A, 'neko22'); res['A_after_register_screen'] = J(A, vis)
    until(A, "() => !document.querySelector('#frBody').hidden && /[A-Z0-9]{4}-[A-Z0-9]{4}/.test(document.querySelector('#frCode').textContent)")
    codeA = J(A, "() => document.querySelector('#frCode').textContent"); res['A_code'] = codeA
    val(A, '#frNick', 'ネコ'); J(A, "() => document.querySelector('#frNick').dispatchEvent(new Event('change'))"); time.sleep(0.5)
    A.screenshot(path=os.path.join(OUT, 'f1_A_friend_empty.png'))
    # B：招待リンクで開く → ログイン後にフレンド画面（コード入り）
    B = page(URL + '&friend=' + codeA.replace('-', '').lower())
    res['B_login_msg'] = J(B, "() => document.querySelector('#lgMsg').textContent"); res['B_url_cleaned'] = J(B, "() => location.search")
    register(B, 'inu333'); time.sleep(0.5)
    res['B_screen'] = J(B, vis); res['B_prefill'] = J(B, "() => [document.querySelector('#frIn').value, document.querySelector('#frMsg').textContent]")
    val(B, '#frNick', 'イヌ'); J(B, "() => document.querySelector('#frNick').dispatchEvent(new Event('change'))"); time.sleep(0.3)
    clk(B, '#btnFrAdd'); until(B, "() => /送りました|ません|です/.test(document.querySelector('#frMsg').textContent)")
    res['B_request'] = J(B, "() => document.querySelector('#frMsg').textContent"); time.sleep(0.5)
    res['B_outgoing'] = rows(B, '#frReq'); B.screenshot(path=os.path.join(OUT, 'f2_B_sent.png'))
    # A：申請が届く（バッジ）→ 承認
    clk(A, '#btnFrBack'); time.sleep(0.3); clk(A, '#btnFriend'); until(A, "() => document.querySelectorAll('#frReq .fr-row').length > 0")
    res['A_incoming'] = rows(A, '#frReq'); res['A_badge'] = J(A, "() => [document.querySelector('#fBadge').hidden, document.querySelector('#fBadge').textContent]")
    A.screenshot(path=os.path.join(OUT, 'f3_A_incoming.png'))
    J(A, "() => [...document.querySelectorAll('#frReq button')].find(b => b.textContent === '承認').click()")
    until(A, "() => document.querySelectorAll('#frList .fr-row').length > 0")
    res['A_msg_accept'] = J(A, "() => document.querySelector('#frMsg').textContent"); res['A_friends'] = rows(A, '#frList')
    # A：ルームを作る → 状態が「募集中」になる
    clk(A, '#btnFrBack'); time.sleep(0.2); clk(A, '#btnCoop'); time.sleep(0.3); clk(A, '#btnHost')
    until(A, "() => __tb.G.mode === 'lobby' && __tb.G.coop"); res['A_room'] = J(A, "() => __tb.G.session.code")
    res['A_hidden'] = J(A, '() => document.visibilityState')
    time.sleep(4)  # 状態を知らせる（2秒ごとの見回り）
    uidA = [k.split('/')[1] for k, v in store.items() if k.startswith('profiles/') and v.get('nm') == 'ネコ']
    res['A_profile'] = store.get('profiles/' + uidA[0]) if uidA else None
    # B：一覧に「ルーム○○で募集中」＋参加ボタン
    clk(B, '#btnFrReload'); until(B, "() => document.querySelectorAll('#frList .fr-row').length > 0 && /募集中/.test(document.querySelector('#frList').innerText)")
    res['B_friends'] = rows(B, '#frList'); B.screenshot(path=os.path.join(OUT, 'f4_B_list_room.png'))
    # A：フレンド画面から招待（ホスト中）
    clk(A, '#btnFriend'); until(A, "() => [...document.querySelectorAll('#frList button')].some(b => b.textContent === '招待')")
    A.screenshot(path=os.path.join(OUT, 'f5_A_invite_btn.png'))
    J(A, "() => [...document.querySelectorAll('#frList button')].find(b => b.textContent === '招待').click()")
    until(A, "() => /招待を送りました/.test(document.querySelector('#frMsg').textContent)"); res['A_invite'] = J(A, "() => document.querySelector('#frMsg').textContent")
    clk(A, '#btnFrBack')
    # B：ホームに戻ると招待の通知 → 参加
    clk(B, '#btnFrReload'); time.sleep(1.0); clk(B, '#btnFrBack'); time.sleep(1.2)
    res['B_banner'] = J(B, "() => [document.querySelector('#frInv').hidden, document.querySelector('#frInvTxt').textContent]")
    res['B_badge'] = J(B, "() => document.querySelector('#fBadge').textContent")
    B.screenshot(path=os.path.join(OUT, 'f6_B_invite_banner.png'))
    clk(B, '#btnFrInvGo'); until(B, "() => __tb.G.coop && __tb.G.session && __tb.G.session.lobby", 20)
    time.sleep(1.5)
    res['B_joined'] = J(B, "() => [__tb.G.coop, __tb.G.session && __tb.G.session.kind, __tb.G.session && __tb.G.session.code]")
    res['A_lobby_players'] = J(A, "() => __tb.G.session.lobby.slots.filter(Boolean).map(s => s.nick)")
    A.screenshot(path=os.path.join(OUT, 'f7_A_lobby_with_B.png'))
    # 解除
    J(B, "() => document.getElementById('btnRoomLeave').click()"); time.sleep(0.5)
    clk(B, '#btnFriend'); until(B, "() => document.querySelectorAll('#frList .fr-rm').length > 0")
    J(B, "() => document.querySelector('#frList .fr-rm').click()"); time.sleep(0.2); res['B_rm_armed'] = J(B, "() => document.querySelector('#frList .fr-rm').textContent")
    J(B, "() => document.querySelector('#frList .fr-rm').click()"); until(B, "() => /解除しました/.test(document.querySelector('#frMsg').textContent)")
    res['B_after_remove'] = rows(B, '#frList'); res['friends_docs'] = [k for k in store if k.startswith('friends/')]
    # ログアウトで「オフライン」
    J(B, "() => { document.getElementById('btnFrBack').click(); document.getElementById('btnAcct').click(); document.getElementById('btnLogout').click(); }"); time.sleep(1.5)
    res['B_profile_after_logout'] = [v for k, v in store.items() if k.startswith('profiles/') and v.get('nm') == 'イヌ']
    res['errors'] = errs
    b.close()
print(json.dumps(res, ensure_ascii=False, indent=1))
