#!/usr/bin/env python3
"""src/ の各パーツを結合して mado/index.html（GitHub Pages で配信される1ファイル）を作る。
使い方: python3 mado/src/build.py
"""
import os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda n:open(os.path.join(d,n),encoding='utf-8').read()
out=r('head.html')+r('three.min.js')+'</script>\n<script id="mado-core">\n'+r('core.js')+'</script>\n<script>\n'+r('game.js')+'</script>\n\n</body></html>\n'
open(os.path.join(d,'..','index.html'),'w',encoding='utf-8').write(out)
print('built index.html',len(out),'bytes')
