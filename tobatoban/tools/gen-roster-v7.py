#!/usr/bin/env python3
"""依頼v7の確定仕様（data/spec-v7-roster.txt）から src/roster_v7.js を作る。
60体の名前・読み・題材・見た目・造形・役職・Lv1能力・A/X/Y（表示名・効果の型・説明・固有スキル）。
効果の型は説明文の言い回しから決める（同じ効果は同じ文で書かれているため）。使い方: python3 tools/gen-roster-v7.py"""
import re, json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
txt = open(os.path.join(root, 'data', 'spec-v7-roster.txt'), encoding='utf-8').read()
ROLE = {'アタッカー': 'attacker', 'ヒーラー': 'healer', 'レンジャー': 'ranger', 'タンク': 'tank'}
# 説明文 → 効果の型（上から順に当てる）
KIND = [
    ('基礎威力30→30→60', '三段こうげき'), ('ビームを撃ち', 'ビームショット'), ('投射体を飛ばして', 'ロケットパンチ'), ('近くの敵を1回叩く', 'こうげき'),
    ('ボタンを離すと正面へ攻撃', 'チャージこうげき'), ('離すと前方の直線へ射撃', 'チャージショット'),
    ('火属性の遠距離妖術', '火炎の術'), ('雷属性の遠距離妖術', 'いかずちの術'), ('氷属性の遠距離妖術', '氷結の術'),
    ('風属性の遠距離妖術。基礎威力50', '竜巻の術'), ('風属性の遠距離妖術。基礎威力40', 'つむじ風の術'),
    ('吸収妖術。基礎威力30', '吸収の術'), ('吸収妖術。基礎威力40', '暗黒の術'), ('強い継続ダメージ', '超・毒とりつき'),
    ('高速で踏み込んで', '神速アタック'), ('姿を隠して', '隠密の術'), ('反撃を待つ構え', 'カウンター'), ('跳び退く', '疾風ステップ'),
    ('基礎威力400', 'こんしんの一撃'), ('基礎威力100。正面の狭い範囲', '気合の一発'),
    ('拘束が長く', '超麻痺の術'), ('麻痺ワナ', '麻痺の術'),
    ('一瞬だけ無敵にする保護技', '超・シールド'), ('ダメージを0にし', '無敵'),
    ('ガードの強化版', '鉄壁ガード'), ('一部を攻撃者へ返す', '反射ガード'), ('長押しで自分へのダメージを減らす防御技', 'ガード'),
    ('注意を自分へ向ける', '誘い打ち'), ('基礎威力900', '超地雷の術'), ('基礎威力600', '地雷'),
    ('回復対象の味方へ使用', '回復の術'), ('強い回復妖術', '極楽の術'), ('範囲回復の妖術', '円陣回復の術'),
    ('強い継続回復', '超・回復とりつき'), ('味方へ継続回復を付ける', '回復とりつき'),
    ('回復フィールドを維持', '回復の陣'), ('弱体フィールドを維持', '呪いの陣'), ('味方を強化するフィールド', '武神の陣'),
    ('攻撃能力を大きく強化', '超・こうげきアップ'), ('少しずつまとめて上げる', '全強化とりつき'),
    ('まもりを大きく下げる弱体技', '超・まもりダウン'), ('移動と技ゲージのたまり方', '超・はやさダウン'), ('まとめて少し下げる', '全弱体とりつき'),
    ('まもりを一瞬だけ大きく下げる', '超・よろい砕き'), ('ちから・ようりょくを一瞬だけ大幅に', '超・刀狩り'),
    ('短い距離を素早く移動', '回避'),
]
def kind_of(d):
    for k, v in KIND:
        if k in d: return v
    raise SystemExit('型が決まらない: ' + d)
out = {}
for m in re.finditer(r'\n(\d\d)\. (\S+?)（(.+?)）\n(.*?)(?=\n\d\d\. |\n\d+\. この仕様|\n8\. 追加|\Z)', txt, re.S):
    body = m.group(4)
    g = lambda k: re.search(r'• ' + k + r'：(.+)', body).group(1).strip()
    cid = g('現行ID'); hp, st, yo, df = map(int, re.search(r'HP (\d+)／ちから (\d+)／ようりょく (\d+)／まもり (\d+)', body).groups())
    mv = {}
    for row in re.finditer(r'^\|([AXY]) \|(.+?)\|(.+?)\|\s*$', body, re.M):
        k, nm, d = row.group(1), row.group(2).strip(), row.group(3).strip()
        note = ''
        mm = re.search(r'\s*(固有スキル.+|投射体は.+)$', d)
        if mm: note = mm.group(1).strip(); d = d[:mm.start()].strip()
        mv[k] = [nm, kind_of(d), d, note]
    out[cid] = {'nm': m.group(2), 'yomi': m.group(3), 'get': '初期' if '初期所持' in g('入手') else 'ガチャ', 'role': ROLE[g('役職')],
                'motif': g('伝承・古典のモチーフ'), 'look': g('見た目'), 'shape': g('頭身・造形'), 'base': [hp, st, yo, df], 'A': mv['A'], 'X': mv['X'], 'Y': mv['Y']}
assert len(out) == 60, len(out)
assert sum(v['get'] == '初期' for v in out.values()) == 10
js = '/* roster_v7.js — tools/gen-roster-v7.py が data/spec-v7-roster.txt（依頼v7の確定仕様）から作る。手で直さない。\n   60体：名前・読み・題材・見た目・造形・役職・Lv1能力・A/X/Y［表示名, 効果の型, 説明, 固有スキルなど］ */\nconst ROSTER_V7 = {\n'
js += ''.join(f'  {i}: {json.dumps(out[i], ensure_ascii=False)},\n' for i in out) + '};\n'
open(os.path.join(root, 'src', 'roster_v7.js'), 'w', encoding='utf-8').write(js)
from collections import Counter
print(len(out), Counter(v['role'] for v in out.values() if v['get'] == 'ガチャ'), Counter(v['A'][1] for v in out.values()))
