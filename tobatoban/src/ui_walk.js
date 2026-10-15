/* =====================================================================
   ui_walk.js — 上野→御徒町→秋葉原の徒歩演出（15秒・戦闘なし）
   ・ヨシノシンが倒れるショット（勝利の見せ直し。報酬・再戦なし）→ 上野駅 → 飲み屋街 → 御徒町駅 → 高架下 → 秋葉原駅
   ・カットでつなぐ編集された移動。歩く速さに合わせて歩行周期を進める（足が滑らない）
   ・駅名は画面に平面の文字も出す。スキップ可。終わると秋葉原駅ホームの戦闘へ
   ===================================================================== */
const WALK = (() => {
  const LEN = 15, SPD = 1.8;
  // 4体の並び（二列・少しずらして先頭が後ろを隠し続けない）
  const FORM = [[-0.75, 0], [0.8, -0.35], [-0.95, -1.5], [0.6, -1.85]];
  // ショット：t0〜t1 のあいだ z0 から速さ spd で進む
  const SHOTS = [
    { t0: 0, t1: 3, boss: true },
    { t0: 3, t1: 5, z0: 1.5, spd: SPD, cam: (zc, k) => [3.6 - k * 1.2, 1.7, zc + 4.2], look: zc => [-1.5, 1.6, zc + 1.5] },
    { t0: 5, t1: 7, z0: 30, spd: SPD, cam: (zc, k) => [-3.2 + k * 1.0, 1.5, zc + 3.4], look: zc => [0.5, 1.1, zc] },
    { t0: 7, t1: 10, z0: 61.2, spd: 1.25, okachi: true, cam: (zc, k) => [-2.6, 1.4 + k * 0.25, 69.6 - k * 0.6], look: zc => [2.6, 1.9, zc + 1] },
    { t0: 10, t1: 12, z0: 80, spd: SPD, cam: (zc, k) => [2.6, 1.3, zc + 3.4 - k * 0.8], look: zc => [0, 1.6, zc] },
    { t0: 12, t1: 15, z0: 112, spd: SPD, stop: 14.3, cam: (zc, k) => [2.6 - k * 1.0, 1.35 + k * 0.3, zc - 6.4 - k * 0.8], look: (zc, k) => [0, 2.4 + k * 0.8, 124] },
  ];
  const CAPS = [[3.1, 5.0, '上野駅', 'UENO'], [7.3, 9.9, '御徒町駅', 'OKACHIMACHI'], [12.4, 15.1, '秋葉原駅', 'AKIHABARA']];
  let W = null;
  function shotAt(t) { for (const s of SHOTS) if (t < s.t1) return s; return SHOTS[SHOTS.length - 1]; }
  function start(party, done) {
    const scene = R.scene;
    if (!W || !W.world) { W = W || {}; W.world = GFX.buildWalk(scene); }
    // 戦闘用の世界はいったん隠す（終わったら元へ戻す）
    W.hidden = []; for (const o of scene.children) if (o !== W.world.root && o.visible) { o.visible = false; W.hidden.push(o); }
    W.world.root.visible = true;
    W.chars = party.slice(0, 4).map(ch => { const m = GFX.makeChar(DATA.CHI[ch]); scene.add(m.root); scene.add(m.shadow); return m; });
    W.boss = GFX.makeYoshinoshin(); scene.add(W.boss.root); scene.add(W.boss.shadow);
    W.t = 0; W.done = done; W.capI = -1; W.end = false;
    $('#walk').hidden = false; $('#wkCap').className = 'wk-cap'; $('#wkTitle').className = 'wk-title';
    R.camera.clearViewOffset();
    AUDIO.bgm('title');
  }
  function stop() {
    if (!W || !W.chars) return;
    const scene = R.scene;
    for (const m of W.chars) { scene.remove(m.root); scene.remove(m.shadow); }
    scene.remove(W.boss.root); scene.remove(W.boss.shadow);
    W.chars = null; W.boss = null; W.world.root.visible = false;
    for (const o of W.hidden) o.visible = true; W.hidden = [];
    $('#walk').hidden = true;
  }
  /** 1フレーム進める。終わったら true */
  function step(dt, T) {
    if (!W || !W.chars) return true;
    W.t += dt; const t = W.t, s = shotAt(t), cam = R.camera;
    // ヨシノシン（倒れるショットだけ）
    const bossOn = !!s.boss;
    W.boss.root.visible = W.boss.shadow.visible = bossOn;
    if (bossOn) GFX.animYoshinoshin(W.boss, { x: 0, z: -8.5, y: 0, yaw: 0, st: 'dead', t: Math.min(t, 2.6) * 0.75 }, T, dt, {});
    W.boss.root.visible = W.boss.shadow.visible = bossOn;
    let zc = 0;
    W.chars.forEach((m, i) => {
      const f = FORM[i];
      let a;
      if (s.boss) { // 手前へ並んでヨシノシンへ振り向く
        a = { x: [-1.6, -0.55, 0.55, 1.6][i], z: 0.6 + (i % 2) * 0.25, yaw: t < 1.4 ? Math.PI : Math.PI - Math.min(1, (t - 1.4) / 0.5) * Math.PI, moving: false, act: '', st: 'ok', slot: i };
      } else {
        const tt = Math.min(t, s.stop || s.t1) - s.t0, z = s.z0 + s.spd * tt + f[1];
        const moving = !(s.stop && t >= s.stop);
        let yaw = 0;
        if (s.okachi && t > 7.6 && t < 9.6) yaw = Math.atan2(6.6 - f[0], 66 - z) * 0.55; // 駅名へ顔を向ける
        a = { x: f[0], z, yaw, moving, act: '', st: 'ok', slot: i };
        if (i === 0) zc = s.z0 + s.spd * tt;
      }
      // 歩行周期を速さへ合わせる（animChar は 10rad/秒 ≒ 1.75m/秒で一周期分の歩幅）
      const k = a.moving ? (s.spd || SPD) / 1.75 / Math.max(0.6, m.h || 1) : 1;
      GFX.animChar(m, a, T, dt * k, { me: false });
    });
    // カメラ
    if (s.boss) {
      const k = Math.min(1, t / 3), e = k * k * (3 - 2 * k);
      cam.position.set(0.4, 4.6 - e * 3.4, 9.5 - e * 5.8);
      cam.lookAt(0, 3.6 - e * 2.7, -6 + e * 6);
    } else {
      const k = (t - s.t0) / (s.t1 - s.t0), p = s.cam(zc, k), l = s.look(zc, k);
      cam.position.set(p[0], p[1], p[2]); cam.lookAt(l[0], l[1], l[2]);
    }
    const wf = cam.aspect < 1 ? 78 : 55; if (Math.abs(cam.fov - wf) > 0.1) { cam.fov = wf; cam.updateProjectionMatrix(); }
    // 画面の文字
    let ci = -1; CAPS.forEach((c, i) => { if (t >= c[0] && t < c[1]) ci = i; });
    if (ci !== W.capI) { W.capI = ci; const el = $('#wkCap'); if (ci >= 0) { el.innerHTML = `${CAPS[ci][2]}<small>${CAPS[ci][3]}</small>`; el.className = 'wk-cap on'; } else el.className = 'wk-cap'; }
    $('#wkTitle').className = t > 13.2 ? 'wk-title on' : 'wk-title';
    return t >= LEN;
  }
  return { start, stop, step, LEN, get t() { return W ? W.t : 0; } };
})();

/** 秋葉原へ（上野勝利のあと）：編成の確定 → 徒歩演出 → 秋葉原駅ホーム */
function openAkibaWalkPrep(replay) {
  fixParty && fixParty();
  show(null); $('#hud').hidden = true; G.mode = 'walk'; G.walkReplay = !!replay;
  WALK.start(G.party.slice(), null);
}
function finishWalk(skipped) {
  if (G.mode !== 'walk') return;
  WALK.stop();
  const a = ACC(); if (!a.walkSeen) { a.walkSeen = true; try { persist(); } catch (e) { } }
  if (G.walkReplay) { G.walkReplay = false; G.mode = 'title'; openStageSel(); return; }
  startSolo('akiba_platform');
}
$('#btnWalkSkip').onclick = () => { AUDIO.sfx('ok'); finishWalk(true); };
$('#btnWalkReplay').onclick = () => { AUDIO.sfx('ok'); openAkibaWalkPrep(true); }; // ステージ選択から再視聴（報酬なし）
