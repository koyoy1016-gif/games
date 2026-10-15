#!/usr/bin/env python3
"""src/ の各パーツを結合して tobatoban/index.html（GitHub Pages で配信する1ファイル）を作る。
使い方: python3 tobatoban/src/build.py
"""
import os
d = os.path.dirname(os.path.abspath(__file__))
r = lambda n: open(os.path.join(d, n), encoding='utf-8').read()
THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
parts = ['data.js', 'roster_data.js', 'roster.js', 'save.js', 'cloud.js', 'sim.js', 'joban.js', 'street.js', 'ueno.js', 'akiba.js', 'proto.js', 'net.js', 'audio.js', 'render_world.js', 'render_models.js', 'render_roster.js', 'render_train.js', 'render_ueno.js', 'render_akiba.js', 'render_lobby.js', 'render_main.js', 'ui.js', 'ui_hub.js', 'ui_gacha.js', 'ui_akiba.js', 'ui_walk.js', 'ui_lobby.js']
js = "import * as THREE from '%s';\n" % THREE_URL + '\n'.join('/* ===== %s ===== */\n' % p + r(p) for p in parts)
js += "\nwindow.__tb = { G, R, DATA, SAVE, CLOUD, ACCT, SIMLIB, PROTO, NETLIB, AUDIO, GFX, THREE, GC, WALK, LOBBY3D };\n"
out = r('head.html') + '<script type="module">\n' + js + '\n</script>\n</body>\n</html>\n'
open(os.path.join(d, '..', 'index.html'), 'w', encoding='utf-8').write(out)
print('built index.html', len(out), 'bytes')
