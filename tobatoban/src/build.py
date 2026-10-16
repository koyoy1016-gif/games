#!/usr/bin/env python3
"""src/ の各パーツを結合して tobatoban/index.html（GitHub Pages で配信する1ファイル）を作る。
使い方: python3 tobatoban/src/build.py
"""
import os
d = os.path.dirname(os.path.abspath(__file__))
r = lambda n: open(os.path.join(d, n), encoding='utf-8').read()
THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
parts = ['data.js', 'roster_data.js', 'roster_v7.js', 'roster.js', 'save.js', 'cloud.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js', 'proto.js', 'net.js', 'audio.js', 'render_world.js', 'render_models.js', 'render_roster.js', 'render_v7.js', 'render_train.js', 'render_ueno.js', 'render_akiba.js', 'render_lobby.js', 'render_main.js', 'ui.js', 'ui_hub.js', 'ui_gacha.js', 'ui_akiba.js', 'ui_walk.js', 'ui_lobby.js', 'ui_friend.js']
js = "import * as THREE from '%s';\n" % THREE_URL + '\n'.join('/* ===== %s ===== */\n' % p + r(p) for p in parts)
js += "\nwindow.__tb = { G, R, DATA, SAVE, CLOUD, ACCT, SIMLIB, PROTO, NETLIB, AUDIO, GFX, THREE, GC, WALK, LOBBY3D, FRND, VIEW, show, openLogin, tagTap, spFeed, enemySp, setHealTarget, singleHealer, startHost, startJoin, startSolo };\n"
out = r('head.html') + '<script type="module">\n' + js + '\n</script>\n</body>\n</html>\n'
open(os.path.join(d, '..', 'index.html'), 'w', encoding='utf-8').write(out)
print('built index.html', len(out), 'bytes')
# 構文の確認（node があれば）：壊れたまま公開しない（v8：// コメントで行の続きが消える事故の再発防止）
import shutil, subprocess, tempfile
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False, encoding='utf-8') as f: f.write(js); tmp = f.name
    res = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if res.returncode != 0:
        print('構文エラー：', res.stderr[:600]); raise SystemExit(1)
    print('構文の確認 OK')
