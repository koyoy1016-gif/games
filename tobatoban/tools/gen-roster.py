#!/usr/bin/env python3
"""設定データ（data/nightwatch-v2-game-data.json）から、ゲームに入れる名簿 src/roster_data.js を作る。
使い方: python3 tobatoban/tools/gen-roster.py
・能力は Lv99 の値だけを持つ（Lv1〜99 は成長式で計算し、検査で JSON の 5,940 行と一致を確かめる）
・技の数値は各キャラの効果文から読み取る（読めなければ止まる）"""
import json, re, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
D = json.load(open(os.path.join(ROOT, 'data', 'nightwatch-v2-game-data.json'), encoding='utf-8'))

def num(pat, s, cast=float):
    m = re.search(pat, s)
    if not m: sys.exit(f'読めない: {pat} / {s}')
    v = cast(m.group(1)); return int(v) if cast is float and v == int(v) else v
def nums(s): return [float(x) for x in re.findall(r'\d+(?:\.\d+)?', s)]

def parse(mech, txt):
    if mech == 'single_melee_physical': return {'k': 'melee', 'pw': 50}
    if mech == 'single_ranged_physical': return {'k': 'shot', 'pw': 35}
    if mech == 'purify': return {'k': 'purify', 'pw': num(r'回復係数(\d+)', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'single_heal': return {'k': 'heal1', 'pw': num(r'回復係数(\d+)', txt), 'mul': num(r'最大ため×([\d.]+)', txt), 'range': num(r'射程(\d+)m', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'heal_and_cleanse': return {'k': 'healAll', 'pw': num(r'回復係数(\d+)', txt), 'r': num(r'半径(\d+)m', txt)}
    if mech == 'speed_up':
        if 'ためで' not in txt: return {'k': 'buffAll', 'stats': ['spd'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'([\d.]+)秒', txt), 'r': 6}
        return {'k': 'buff', 'stats': ['spd'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'speed_down': return {'k': 'debuff', 'stats': ['spd'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'charged_wind': return {'k': 'spell', 'el': '風', 'pw': num(r'風妖術(\d+)', txt), 'mul': num(r'最大ため×([\d.]+)', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'charged_shot': return {'k': 'cshot', 'pw': num(r'物理(\d+)', txt), 'mul': num(r'最大ため×([\d.]+)', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'charged_ice': return {'k': 'spell', 'el': '氷', 'pw': num(r'氷妖術(\d+)', txt), 'mul': num(r'最大ため×([\d.]+)', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'dodge': return {'k': 'dodge', 'dist': num(r'([\d.]+)m回避', txt), 'end': num(r'動作([\d.]+)秒', txt), 'iv0': num(r'無敵([\d.]+)〜', txt), 'iv1': num(r'〜([\d.]+)秒', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'wind_multi': n = num(r'×(\d+)', txt); return {'k': 'multi', 'shape': 'wind', 'stat': 'yo', 'pw': num(r'風妖術(\d+)×', txt), 'n': n, 'iv': num(r'([\d.]+)秒間隔', txt)}
    if mech == 'beam_multi': return {'k': 'multi', 'shape': 'beam', 'stat': 'str', 'pw': num(r'物理(\d+)×', txt), 'n': num(r'×(\d+)', txt), 'iv': num(r'([\d.]+)秒間隔', txt)}
    if mech == 'melee_multi': return {'k': 'multi', 'shape': 'melee', 'stat': 'str', 'pw': num(r'物理(\d+)×', txt), 'n': num(r'×(\d+)', txt), 'iv': num(r'([\d.]+)秒間隔', txt)}
    if mech == 'taunt_strike': return {'k': 'taunt', 'pw': num(r'物理(\d+)', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'guard': return {'k': 'guard', 'mul': num(r'被ダメージ×([\d.]+)', txt), 'taunt': 1}
    if mech == 'reflect_guard': return {'k': 'guard', 'mul': num(r'被ダメージ×([\d.]+)', txt), 'reflect': num(r'(\d+)%', txt) / 100, 'taunt': 1}
    if mech == 'party_brief_invulnerability': return {'k': 'protectAll', 'r': num(r'半径(\d+)m', txt), 'inv': num(r'([\d.]+)秒無敵', txt)}
    if mech == 'self_defense_taunt': return {'k': 'guardup', 'mul': num(r'まもり×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt)}
    if mech == 'timed_bomb': return {'k': 'bomb', 'pw': num(r'参照(\d+)', txt), 'fuse': num(r'(\d+)秒で爆発', txt), 'r': num(r'半径(\d+)m', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'proximity_mine': return {'k': 'mine', 'pw': num(r'参照(\d+)', txt), 'arm': num(r'設置([\d.]+)秒後', txt), 'r': num(r'半径(\d+)m', txt), 'life': num(r'(\d+)秒で消滅', txt), 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'attack_up': return {'k': 'buff', 'stats': ['str'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'defense_up': return {'k': 'buff', 'stats': ['def'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'all_stats_up': return {'k': 'buffAll', 'stats': ['str', 'yo', 'def', 'spd'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt), 'r': num(r'半径(\d+)m', txt)}
    if mech == 'all_stats_down':
        if 'ためで' not in txt: return {'k': 'debuffAll', 'stats': ['str', 'yo', 'def', 'spd'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt), 'r': num(r'半径(\d+)m', txt)}
        return {'k': 'debuff', 'stats': ['str', 'yo', 'def', 'spd'], 'mul': num(r'×([\d.]+)', txt), 'dur': num(r'・(\d+)秒', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'area_heal': return {'k': 'healRing', 'pw': num(r'回復係数(\d+)', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'regen': return {'k': 'regen', 'pw': num(r'回復係数(\d+)', txt), 'n': num(r'を(\d+)回', txt), 'r0': 2, 'r1': 4, 'cd': num(r'再使用(\d+)秒', txt)}
    if mech == 'healing_field': return {'k': 'field', 'pw': num(r'回復係数(\d+)', txt), 'n': num(r'を(\d+)回', txt), 'r': num(r'半径(\d+)m', txt)}
    sys.exit('知らない技: ' + mech)

ROLE = {'attacker': 'attacker', 'tank': 'tank', 'ranger': 'ranger', 'healer': 'healer'}
out_exist, out_new = [], []
for c in D['characters']:
    meta = {'id': c['id'], 'rank': c['rank'], 'role': c['role_id'], 'tags': c.get('style_tags', []), 'cap': [c['level99'][k] for k in ('hp', 'strength', 'spirit', 'defense')]}
    if not c.get('new_character'):
        out_exist.append(meta); continue
    L = c['loadout']
    meta.update({'nm': c['name'], 'fam': c['family'], 'el': c['element'], 'form': c['form'], 'h': c['model']['height_m'], 'hr': c['model']['head_to_body_ratio'],
                 'gacha': bool(c.get('gacha_eligible')), 'tier': c['skill_parameters']['rank_tier'],
                 'A': [L['A'], parse(L['A_mechanic'], '')], 'X': [L['X'], parse(L['X_mechanic'], L['X_effect']), L['X_effect']],
                 'Y': [L['Y'], parse(L['Y_mechanic'], L['Y_effect']), L['Y_effect']], 'SP': [L['ultimate'], parse(L['ultimate_mechanic'], L['ultimate_effect']), L['ultimate_effect']]})
    out_new.append(meta)
assert len(out_exist) == 10 and len(out_new) == 50
js = ['/* roster_data.js — tools/gen-roster.py が設定データ（data/nightwatch-v2-game-data.json）から作る。手で直さない */']
js.append('const ROSTER_EXIST = ' + json.dumps(out_exist, ensure_ascii=False, separators=(',', ':')) + ';')
js.append('const ROSTER_NEW = [\n' + ',\n'.join(json.dumps(x, ensure_ascii=False, separators=(',', ':')) for x in out_new) + '\n];')
exp = {r: [0] + [row['cumulative_exp'] for row in D['rank_exp_curves'][r]] for r in ('D', 'C', 'B', 'A', 'S')}
js.append('// ランク別の累積EXP（添字＝レベル、[0]は使わない）。成長の正本の整数表')
js.append('const EXP_CUM = ' + json.dumps(exp, separators=(',', ':')) + ';')
open(os.path.join(ROOT, 'src', 'roster_data.js'), 'w', encoding='utf-8').write('\n'.join(js) + '\n')
print('wrote roster_data.js', len(out_new), 'new +', len(out_exist), 'existing')
