/* =====================================================================
   audio.js — BGM（祭り囃子調のバトル曲）と効果音。すべて WebAudio で合成。
   外部の音源ファイルや既存曲は使わない。
   ===================================================================== */
const AUDIO = (() => {
  let ctx = null, master, bgmBus, sfxBus, comp, noiseBuf, rev, revGain;
  const st = { bgm: 0.5, sfx: 0.85, on: true, song: null, nextT: 0, step: 0, timer: null, listener: { x: 0, z: 0, yaw: 0 }, last: {} };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 1.15; comp.connect(master); master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.gain.value = st.bgm * 1.5; bgmBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = st.sfx * 1.5; sfxBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 簡単な残響（夜の商店街の反響）
    rev = ctx.createConvolver(); const len = ctx.sampleRate * 1.6, ib = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ib.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    rev.buffer = ib; revGain = ctx.createGain(); revGain.gain.value = 0.22; rev.connect(revGain); revGain.connect(comp);
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (st.on) ctx.resume(); });
  }
  const T = () => ctx.currentTime;
  function out(dest, pan) {
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(dest); return p; }
    return dest;
  }
  function env(g, t, a, peak, d, sus) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(o) { // {f, f1, dur, type, g, at, a, dest, q, filt, fq, rev, pan}
    const t = o.at || T(), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.glide || o.dur));
    if (o.det) osc.detune.value = o.det;
    let node = osc;
    if (o.filt) { const f = ctx.createBiquadFilter(); f.type = o.filt; f.frequency.setValueAtTime(o.fq || 1200, t); if (o.fq1) f.frequency.exponentialRampToValueAtTime(o.fq1, t + o.dur); f.Q.value = o.q || 1; node.connect(f); node = f; }
    node.connect(g); env(g, t, o.a || 0.005, o.g || 0.2, o.dur);
    const dst = out(o.dest || sfxBus, o.pan); g.connect(dst); if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(rev); }
    osc.start(t); osc.stop(t + (o.a || 0.005) + o.dur + 0.05);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibD || 6; l.connect(lg); lg.connect(osc.frequency); l.start(t + (o.vibAt || 0.08)); l.stop(t + o.dur + 0.1); }
    return osc;
  }
  function noise(o) { // {dur, type, f, f1, q, g, at, a, dest, rev, pan}
    const t = o.at || T(), src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur); f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); env(g, t, o.a || 0.003, o.g || 0.2, o.dur);
    src.connect(f); f.connect(g); g.connect(out(o.dest || sfxBus, o.pan)); if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(rev); }
    const off = Math.random() * 1.5; src.start(t, off); src.stop(t + (o.a || 0.003) + o.dur + 0.05);
  }
  /* ---------- 和楽器っぽい合成音 ---------- */
  function taiko(t, big, dest, g) { g = g || 1; tone({ f: big ? 105 : 150, f1: big ? 52 : 80, dur: big ? 0.45 : 0.22, glide: 0.18, g: (big ? 0.55 : 0.32) * g, at: t, dest, a: 0.002 }); noise({ dur: big ? 0.18 : 0.08, f: big ? 500 : 900, g: (big ? 0.35 : 0.18) * g, at: t, dest }); }
  function ka(t, dest, g) { g = g || 1; noise({ type: 'bandpass', f: 2600, q: 3, dur: 0.05, g: 0.28 * g, at: t, dest }); tone({ f: 1800, dur: 0.03, g: 0.06 * g, at: t, dest, type: 'square' }); }
  function kane(t, dest, g, pitch) { g = g || 1; const b = pitch || 1320; [1, 2.76, 5.4, 8.9].forEach((m, i) => tone({ f: b * m, dur: 0.9 / (i + 1), g: 0.07 * g / (i + 1), at: t, dest, rev: 0.5 })); }
  function shami(t, m, dest, g) { g = g || 1; const f = mtof(m); tone({ f: f * 1.02, f1: f, glide: 0.03, dur: 0.24, type: 'sawtooth', filt: 'bandpass', fq: f * 3, fq1: f * 1.5, q: 2.2, g: 0.22 * g, at: t, dest, a: 0.002 }); noise({ type: 'highpass', f: 3500, dur: 0.03, g: 0.05 * g, at: t, dest }); }
  function fue(t, m, dur, dest, g) { g = g || 1; const f = mtof(m); tone({ f: f * 0.985, f1: f, glide: 0.05, dur, type: 'triangle', g: 0.13 * g, at: t, dest, a: 0.03, vib: 5.5, vibD: f * 0.012, vibAt: 0.12, rev: 0.4 }); tone({ f: f * 2, dur: dur * 0.8, type: 'sine', g: 0.025 * g, at: t, dest, a: 0.04 }); noise({ type: 'bandpass', f: f * 2, q: 6, dur: Math.min(0.12, dur), g: 0.035 * g, at: t, dest }); }
  function bass(t, m, dur, dest, g) { g = g || 1; tone({ f: mtof(m), dur, type: 'sawtooth', filt: 'lowpass', fq: 420, q: 2, g: 0.16 * g, at: t, dest, a: 0.01 }); }
  function suzu(t, dest, g) { g = g || 1; for (let i = 0; i < 4; i++) tone({ f: 4200 + Math.random() * 900, dur: 0.06, g: 0.025 * g, at: t + i * 0.025, dest }); }

  /* ---------- BGM ---------- */
  const E = [52, 53, 57, 59, 60, 64, 65, 69, 71, 72, 76, 77, 81, 83, 84, 88]; // ミヤコ節音階（E）
  const iE = n => E[n + 5];
  const MEL_BOSS = [
    '5-65 3-23', '4-32 0--.', '5-76 5-67', '8-76 5--.',
    '9-87 6-78', '7-65 3-45', '4323 4-56', '5--- ..34',
  ].map(s => s.replace(/ /g, ''));
  const SONGS = {
    title: { bpm: 84, bars: 8, key: -2, mel: ['3-5- 4-2-', '3--- ----', '5-7- 6-5-', '4--- ----', '7-8- 7-5-', '6-5- 4-2-', '3-4- 2-0-', '1--- ----'].map(s => s.replace(/ /g, '')), drums: 'calm', shami: 'slow', bass: false },
    street: { bpm: 96, bars: 8, key: -2, mel: ['3-5- 4-2-', '3--- ..2-', '3-5- 6-7-', '5--- ----', '7-8- 9-8-', '7-5- 6-5-', '4-3- 2-3-', '1--- ----'].map(s => s.replace(/ /g, '')), drums: 'walk', shami: 'arp', bass: true },
    boss: { bpm: 152, bars: 8, key: 0, mel: MEL_BOSS, drums: 'battle', shami: 'drive', bass: true },
    boss2: { bpm: 166, bars: 8, key: 2, mel: MEL_BOSS, drums: 'battle2', shami: 'drive', bass: true },
  };
  const ROOTS = [0, 0, 3, 4, 0, 2, 3, 4]; // 小節ごとの低音（音階の度数）
  function scheduleStep(song, step, t) {
    const sp = 60 / song.bpm / 4; // 16分
    const bar = Math.floor(step / 16) % song.bars, s16 = step % 16, k = song.key;
    const dest = bgmBus;
    // 旋律（8分単位）
    if (s16 % 2 === 0) {
      const line = song.mel[bar], ch = line[s16 / 2];
      if (ch && ch !== '-' && ch !== '.') {
        let len = 1; for (let j = s16 / 2 + 1; j < line.length && line[j] === '-'; j++) len++;
        fue(t, iE(+ch) + k, len * sp * 2 * 0.95, dest, song.drums === 'calm' ? 1.3 : 1);
      }
    }
    const root = E[5 + ROOTS[bar] - 5] + k - 12; // 低い根音
    // 三味線
    if (song.shami === 'drive') { const pat = [0, 0, 7, 12, 0, 1, 7, 12, 0, 0, 7, 12, 5, 7, 8, 7]; shami(t, root + 12 + pat[s16], dest, s16 % 4 === 0 ? 1 : 0.7); }
    else if (song.shami === 'arp' && s16 % 2 === 0) { const pat = [0, 7, 12, 7, 0, 7, 12, 15]; shami(t, root + 12 + pat[s16 / 2], dest, 0.6); }
    else if (song.shami === 'slow' && s16 % 4 === 0) { const pat = [0, 7, 12, 7]; shami(t, root + 12 + pat[s16 / 4], dest, 0.9); }
    // 低音
    if (song.bass && s16 === 0) bass(t, root, sp * 15, dest, song.drums === 'walk' ? 0.6 : 1);
    if (song.bass && song.drums.startsWith('battle') && s16 === 8) bass(t, root + (bar % 2 ? 7 : 0), sp * 7, dest, 0.8);
    // 太鼓
    const D = song.drums;
    if (D === 'battle' || D === 'battle2') {
      if ([0, 6, 8, 11, 14].includes(s16)) taiko(t, s16 === 0 || s16 === 8, dest, 0.9);
      if ([4, 12].includes(s16)) ka(t, dest);
      if (D === 'battle2' && [2, 10, 13, 15].includes(s16)) taiko(t, false, dest, 0.5);
      if (bar % 4 === 3 && s16 >= 12) taiko(t, false, dest, 0.6);
      if (s16 === 0 && bar % 2 === 0) kane(t, dest, 0.8);
      if (s16 % 2 === 1 && D === 'battle2') ka(t, dest, 0.35);
    } else if (D === 'walk') {
      if (s16 === 0 || s16 === 8) taiko(t, s16 === 0, dest, 0.5);
      if (s16 === 12) ka(t, dest, 0.5);
      if (s16 % 4 === 2) suzu(t, dest, 0.6);
    } else if (D === 'calm') {
      if (s16 === 0) taiko(t, true, dest, 0.6);
      if (s16 === 8) taiko(t, false, dest, 0.35);
      if (s16 === 12 && bar % 2) suzu(t, dest, 0.8);
    }
  }
  function tick() {
    if (!ctx || !st.song) return;
    const song = SONGS[st.song]; if (!song) return;
    const sp = 60 / song.bpm / 4;
    while (st.nextT < T() + 0.15) { scheduleStep(song, st.step, st.nextT); st.step++; st.nextT += sp; }
  }
  function bgm(name) {
    if (!ctx) return;
    if (st.song === name) return;
    st.song = name; st.step = 0; st.nextT = T() + 0.08;
    if (!st.timer) st.timer = setInterval(tick, 25);
  }
  function bgmStop() { st.song = null; }
  function jingle(win) {
    if (!ctx) return; bgmStop(); const t = T() + 0.05, d = bgmBus;
    if (win) { [0, 2, 3, 5, 7].forEach((n, i) => fue(t + i * 0.16, iE(n + 2), 0.3, d, 1.1)); fue(t + 0.85, iE(8), 1.2, d, 1.2); [0, 0.24, 0.48, 0.85].forEach((o, i) => taiko(t + o, i % 3 === 0, d)); kane(t + 0.85, d, 1.2); }
    else { [5, 4, 2, 1].forEach((n, i) => fue(t + i * 0.3, iE(n) - 2, 0.45, d, 0.9)); taiko(t, true, d, 0.7); taiko(t + 1.2, true, d, 0.5); }
  }
  function setVol(bgmV, sfxV) { st.bgm = bgmV; st.sfx = sfxV; if (bgmBus) { bgmBus.gain.value = bgmV * 1.5; sfxBus.gain.value = sfxV * 1.5; } }

  /* ---------- 効果音 ---------- */
  function spatial(x, z) {
    if (x == null) return { g: 1, pan: 0 };
    const L = st.listener, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
    const rx = dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw);
    return { g: Math.max(0.25, Math.min(1, 14 / (d + 6))), pan: Math.max(-0.7, Math.min(0.7, rx / 12)) };
  }
  function sfx(name, x, z, vol) {
    if (!ctx || !st.on) return;
    const now = T(); const key = name; if (st.last[key] && now - st.last[key] < 0.035) return; st.last[key] = now;
    const sp = spatial(x, z), g = (vol || 1) * sp.g, pan = sp.pan, t = now;
    const N = (o) => noise(Object.assign({ pan, at: t }, o, { g: (o.g || 0.2) * g })), O = (o) => tone(Object.assign({ pan, at: t }, o, { g: (o.g || 0.2) * g }));
    switch (name) {
      case 'ui': O({ f: 880, f1: 1320, dur: 0.06, type: 'triangle', g: 0.12 }); break;
      case 'ok': O({ f: 660, dur: 0.08, type: 'triangle', g: 0.14 }); O({ f: 990, dur: 0.12, type: 'triangle', g: 0.12, at: t + 0.07 }); break;
      case 'back': O({ f: 660, f1: 440, dur: 0.1, type: 'triangle', g: 0.12 }); break;
      case 'ready': [0, 0.07, 0.14].forEach((o, i) => O({ f: [988, 1319, 1760][i], dur: 0.25, type: 'triangle', g: 0.12, at: t + o, rev: 0.4 })); break;
      case 'swing': N({ type: 'bandpass', f: 1200, f1: 400, q: 1.2, dur: 0.12, g: 0.12 }); break;
      case 'hit': N({ f: 1400, f1: 300, dur: 0.09, g: 0.32 }); O({ f: 180, f1: 70, dur: 0.1, g: 0.3 }); break;
      case 'hit3': N({ f: 2000, f1: 250, dur: 0.16, g: 0.4 }); O({ f: 160, f1: 50, dur: 0.18, g: 0.42 }); O({ f: 2400, dur: 0.05, type: 'square', g: 0.04 }); break;
      case 'crit': O({ f: 2600, f1: 3400, dur: 0.12, type: 'triangle', g: 0.12, rev: 0.4 }); N({ type: 'highpass', f: 5000, dur: 0.08, g: 0.1 }); break;
      case 'palm': N({ f: 1800, f1: 300, dur: 0.12, g: 0.34 }); O({ f: 200, f1: 70, dur: 0.12, g: 0.32 }); N({ type: 'highpass', f: 3000, dur: 0.2, g: 0.08, rate: 1.6 }); break;
      case 'slash': N({ type: 'highpass', f: 1800, f1: 5000, dur: 0.12, g: 0.25 }); O({ f: 3100, f1: 2800, dur: 0.25, type: 'sine', g: 0.05, rev: 0.3 }); break;
      case 'heavy': taiko(t, true, out(sfxBus, pan), 1.2 * g); N({ f: 900, f1: 120, dur: 0.35, g: 0.4 }); break;
      case 'heavyWind': O({ f: 120, f1: 260, dur: 1.0, type: 'sawtooth', filt: 'lowpass', fq: 400, g: 0.06 }); break;
      case 'smoke': N({ type: 'bandpass', f: 600, f1: 1800, q: 0.7, dur: 0.4, g: 0.2 }); break;
      case 'shot_star': O({ f: 1500, f1: 700, dur: 0.12, type: 'triangle', g: 0.14 }); O({ f: 3000, f1: 2400, dur: 0.15, g: 0.05, rev: 0.3 }); break;
      case 'shot_can': O({ f: 520, f1: 330, dur: 0.09, type: 'square', filt: 'bandpass', fq: 1200, q: 3, g: 0.2 }); O({ f: 2100, dur: 0.12, g: 0.05 }); break;
      case 'shot_focus': O({ f: 900, f1: 260, dur: 0.3, type: 'sawtooth', filt: 'lowpass', fq: 3000, fq1: 600, g: 0.16 }); N({ type: 'bandpass', f: 2000, f1: 600, dur: 0.25, g: 0.12 }); break;
      case 'shot_fire': N({ type: 'bandpass', f: 400, f1: 1600, q: 0.8, dur: 0.35, g: 0.3 }); O({ f: 120, f1: 220, dur: 0.3, type: 'sawtooth', filt: 'lowpass', fq: 500, g: 0.08 }); break;
      case 'shot_mark': O({ f: 1100, f1: 1600, dur: 0.12, type: 'triangle', g: 0.1 }); break;
      case 'phit': N({ f: 2400, f1: 500, dur: 0.07, g: 0.2 }); O({ f: 300, f1: 120, dur: 0.06, g: 0.15 }); break;
      case 'charge': O({ f: 300, f1: 900, dur: 1.0, type: 'sawtooth', filt: 'lowpass', fq: 900, g: 0.04 }); break;
      case 'chargeMax': O({ f: 1760, dur: 0.18, type: 'triangle', g: 0.1, rev: 0.4 }); break;
      case 'dodge': N({ type: 'bandpass', f: 500, f1: 1600, q: 1, dur: 0.18, g: 0.18 }); break;
      case 'block': O({ f: 820, dur: 0.18, type: 'square', filt: 'bandpass', fq: 1600, q: 4, g: 0.12 }); N({ type: 'highpass', f: 3000, dur: 0.06, g: 0.15 }); break;
      case 'guardBreak': O({ f: 600, f1: 180, dur: 0.3, type: 'square', filt: 'lowpass', fq: 1500, g: 0.12 }); break;
      case 'parryStance': O({ f: 2200, dur: 0.15, g: 0.05 }); break;
      case 'parry': O({ f: 2600, dur: 0.6, g: 0.12, rev: 0.6 }); O({ f: 3900, dur: 0.4, g: 0.05 }); N({ type: 'highpass', f: 4000, dur: 0.06, g: 0.2 }); break;
      case 'heal': [0, 0.06, 0.12].forEach((o, i) => O({ f: [1047, 1319, 1568][i], dur: 0.35, type: 'sine', g: 0.08, at: t + o, rev: 0.6 })); break;
      case 'ring': [0, 0.05, 0.1, 0.15].forEach((o, i) => O({ f: [784, 988, 1175, 1568][i], dur: 0.45, g: 0.08, at: t + o, rev: 0.6 })); break;
      case 'revive': [0, 0.08, 0.16, 0.24].forEach((o, i) => O({ f: [523, 659, 784, 1047][i], dur: 0.4, type: 'triangle', g: 0.1, at: t + o, rev: 0.5 })); break;
      case 'protect': O({ f: 220, f1: 440, dur: 0.5, type: 'triangle', g: 0.12, rev: 0.4 }); O({ f: 660, dur: 0.4, g: 0.06 }); break;
      case 'stealth': N({ type: 'bandpass', f: 1500, f1: 300, dur: 0.4, g: 0.15 }); break;
      case 'taunt': taiko(t, false, out(sfxBus, pan), 0.8 * g); O({ f: 330, f1: 260, dur: 0.25, type: 'sawtooth', filt: 'bandpass', fq: 800, q: 3, g: 0.08 }); break;
      case 'trapPlace': O({ f: 700, dur: 0.06, type: 'square', g: 0.06 }); N({ type: 'highpass', f: 3000, dur: 0.05, g: 0.1 }); break;
      case 'minePlace': O({ f: 180, dur: 0.1, type: 'square', filt: 'lowpass', fq: 600, g: 0.15 }); break;
      case 'boom': N({ f: 1800, f1: 80, dur: 0.6, g: 0.55, rev: 0.4 }); O({ f: 90, f1: 35, dur: 0.5, g: 0.5 }); break;
      case 'para': O({ f: 90, dur: 0.4, type: 'sawtooth', filt: 'bandpass', fq: 2000, q: 5, g: 0.12 }); N({ type: 'highpass', f: 4000, dur: 0.3, g: 0.1 }); break;
      case 'mark': N({ type: 'highpass', f: 2500, dur: 0.25, g: 0.12 }); break;
      case 'rail': N({ type: 'lowpass', f: 260, dur: 0.07, g: 0.32 }); N({ type: 'lowpass', f: 220, dur: 0.07, g: 0.26, at: t + 0.13 }); N({ type: 'lowpass', f: 260, dur: 0.07, g: 0.3, at: t + 0.42 }); N({ type: 'lowpass', f: 210, dur: 0.08, g: 0.26, at: t + 0.55 }); break;
      case 'doorOpen': case 'doorClose': N({ type: 'bandpass', f: 1800, f1: 600, q: 0.6, dur: 0.45, g: 0.18 }); O({ f: name === 'doorOpen' ? 880 : 660, dur: 0.12, type: 'triangle', g: 0.06, at: t + 0.4 }); break;
      case 'trainChime': [0, 0.28].forEach((o, i) => O({ f: [784, 659][i], dur: 0.6, type: 'sine', g: 0.12, at: t + o, rev: 0.5 })); break;
      // ガチャ：取っ手・落下・ランク別の開封（C短いチャイム／B2音／A光の音／S和太鼓＋鐘）
      case 'gHandle': N({ type: 'bandpass', f: 500, f1: 260, q: 3, dur: 0.35, g: 0.18 }); O({ f: 180, dur: 0.08, type: 'square', g: 0.05, at: t + 0.32 }); break;
      case 'gRoll': for (let i = 0; i < 6; i++) N({ type: 'bandpass', f: 1400 + i * 120, q: 6, dur: 0.04, g: 0.08, at: t + i * 0.07 }); break;
      case 'gDrop': O({ f: 320, f1: 140, dur: 0.18, type: 'triangle', g: 0.16 }); N({ type: 'lowpass', f: 600, dur: 0.12, g: 0.14 }); break;
      case 'gOpenC': O({ f: 1046, dur: 0.35, type: 'sine', g: 0.12, rev: 0.4 }); break;
      case 'gOpenB': [0, 0.16].forEach((o, i) => O({ f: [880, 1318][i], dur: 0.45, type: 'sine', g: 0.12, at: t + o, rev: 0.5 })); break;
      case 'gOpenA': [0, 0.1, 0.2, 0.3].forEach((o, i) => O({ f: [784, 988, 1175, 1568][i], dur: 0.5, type: 'triangle', g: 0.09, at: t + o, rev: 0.6 })); break;
      case 'gOpenS': N({ type: 'lowpass', f: 160, dur: 0.35, g: 0.5 }); N({ type: 'lowpass', f: 160, dur: 0.35, g: 0.45, at: t + 0.22 }); [0, 0.45].forEach(o => [1568, 2093, 2637].forEach((f, i) => O({ f, dur: 1.4, type: 'sine', g: 0.07 / (i + 1), at: t + 0.3 + o, rev: 0.8 }))); break;
      case 'food': O({ f: 600, f1: 900, dur: 0.08, type: 'triangle', g: 0.12 }); break;
      case 'eat': N({ type: 'bandpass', f: 900, q: 2, dur: 0.06, g: 0.15 }); N({ type: 'bandpass', f: 900, q: 2, dur: 0.06, g: 0.15, at: t + 0.1 }); O({ f: 800, f1: 1200, dur: 0.15, type: 'triangle', g: 0.08, at: t + 0.2 }); break;
      case 'pick': O({ f: 900, f1: 1400, dur: 0.1, type: 'triangle', g: 0.1 }); break;
      case 'item': O({ f: 500, f1: 1000, dur: 0.15, type: 'triangle', g: 0.1 }); break;
      case 'spCut': N({ type: 'bandpass', f: 400, f1: 3000, dur: 0.3, g: 0.22 }); taiko(t + 0.02, true, out(sfxBus, 0), 1.1); kane(t + 0.05, sfxBus, 0.8, 1760); break;
      case 'sp_kogemaru': N({ f: 2000, f1: 300, dur: 0.08, g: 0.28 }); O({ f: 230, f1: 90, dur: 0.08, g: 0.3 }); N({ type: 'highpass', f: 4000, dur: 0.1, g: 0.06 }); break;
      case 'sp_hoshisuzume': O({ f: 1200, f1: 800, dur: 0.14, type: 'sawtooth', filt: 'lowpass', fq: 4000, g: 0.12 }); O({ f: 2400, dur: 0.12, g: 0.06, rev: 0.4 }); break;
      case 'sp_akaneten': N({ type: 'bandpass', f: 300, f1: 1400, q: 0.7, dur: 0.3, g: 0.35 }); O({ f: 110, f1: 70, dur: 0.25, g: 0.3 }); break;
      case 'sp_kagetsubame': N({ type: 'highpass', f: 2500, f1: 6000, dur: 0.08, g: 0.2 }); O({ f: 3300, dur: 0.1, g: 0.04 }); break;
      case 'sp_sayanosuke': N({ type: 'highpass', f: 1200, f1: 7000, dur: 0.25, g: 0.4 }); O({ f: 2600, dur: 1.2, g: 0.12, rev: 0.8 }); taiko(t + 0.05, true, out(sfxBus, pan), 1.3); break;
      case 'sp_taiko': [0, 0.11, 0.22, 0.33, 0.45].forEach((o, i) => taiko(t + o, i % 2 === 0, out(sfxBus, pan), 1.1)); kane(t + 0.45, sfxBus, 1); break;
      case 'sp_burikidon': case 'sp_norenbou': O({ f: 160, f1: 320, dur: 0.6, type: 'square', filt: 'lowpass', fq: 900, g: 0.14 }); kane(t + 0.1, sfxBus, 0.7, 880); break;
      case 'sp_kemuridama': N({ type: 'bandpass', f: 300, f1: 2400, q: 0.6, dur: 0.6, g: 0.4 }); break;
      case 'sp_momiji': [0, 0.08, 0.16, 0.24, 0.32].forEach((o, i) => O({ f: [784, 988, 1175, 1319, 1568][i], dur: 0.6, g: 0.09, at: t + o, rev: 0.7 })); break;
      case 'hurt': N({ f: 900, f1: 150, dur: 0.12, g: 0.35 }); O({ f: 140, f1: 60, dur: 0.15, g: 0.3 }); break;
      case 'down': O({ f: 600, f1: 150, dur: 0.6, type: 'triangle', g: 0.14, rev: 0.4 }); break;
      case 'ascend': [0, 0.15, 0.3].forEach((o, i) => O({ f: [1319, 1175, 988][i], dur: 0.8, g: 0.06, at: t + o, rev: 0.9 })); break;
      case 'lantern': kane(t, sfxBus, 0.9, 1568); break;
      case 'allLit': [0, 0.1, 0.2, 0.3].forEach((o, i) => kane(t + o, sfxBus, 0.8, [1047, 1319, 1568, 2093][i])); break;
      case 'lanternFail': O({ f: 500, f1: 300, dur: 0.4, type: 'triangle', g: 0.1 }); break;
      // ボス
      case 'stomp': O({ f: 70, f1: 38, dur: 0.25, g: 0.4 }); N({ f: 300, dur: 0.15, g: 0.22 }); break;
      case 'warn': O({ f: 880, dur: 0.08, type: 'square', filt: 'lowpass', fq: 2000, g: 0.07 }); O({ f: 660, dur: 0.1, type: 'square', filt: 'lowpass', fq: 2000, g: 0.07, at: t + 0.1 }); break;
      case 'roar': O({ f: 110, f1: 70, dur: 0.9, type: 'sawtooth', filt: 'bandpass', fq: 600, fq1: 300, q: 2, g: 0.3, vib: 9, vibD: 8 }); N({ f: 800, dur: 0.8, g: 0.18 }); break;
      case 'fubuki': for (let i = 0; i < 10; i++) noise({ type: 'bandpass', f: 2200 + Math.random() * 1500, q: 2, dur: 0.05, g: 0.14 * g, at: t + i * 0.1, pan }); break;
      case 'shime': N({ type: 'bandpass', f: 250, f1: 900, q: 0.8, dur: 0.6, g: 0.35 }); O({ f: 90, f1: 140, dur: 0.6, type: 'sawtooth', filt: 'lowpass', fq: 300, g: 0.12 }); break;
      case 'launch': [0, 0.08, 0.16, 0.24].forEach(o => O({ f: 300, f1: 600, dur: 0.08, type: 'triangle', g: 0.12, at: t + o })); break;
      case 'fall': O({ f: 2200, f1: 500, dur: 0.8, type: 'sine', g: 0.05 }); break;
      case 'beamCharge': O({ f: 120, f1: 600, dur: 0.85, type: 'sawtooth', filt: 'lowpass', fq: 400, fq1: 3000, g: 0.12 }); break;
      case 'beam': O({ f: 150, dur: 1.2, type: 'sawtooth', filt: 'lowpass', fq: 1800, g: 0.16, vib: 18, vibD: 20 }); N({ type: 'bandpass', f: 1200, q: 1, dur: 1.2, g: 0.18 }); break;
      case 'slap': N({ f: 2500, f1: 150, dur: 0.3, g: 0.6, rev: 0.3 }); O({ f: 120, f1: 40, dur: 0.3, g: 0.5 }); break;
      case 'flyUp': N({ type: 'bandpass', f: 200, f1: 1200, dur: 1.0, g: 0.3 }); O({ f: 60, f1: 120, dur: 1.0, type: 'sawtooth', filt: 'lowpass', fq: 300, g: 0.15 }); break;
      case 'flyPass': N({ type: 'bandpass', f: 400, f1: 1400, q: 0.6, dur: 1.1, g: 0.4 }); O({ f: 160, f1: 90, dur: 1.1, type: 'sawtooth', filt: 'lowpass', fq: 500, g: 0.15 }); break;
      case 'land': N({ f: 1500, f1: 60, dur: 0.8, g: 0.6, rev: 0.5 }); O({ f: 60, f1: 30, dur: 0.6, g: 0.6 }); break;
      case 'summon': [0, 0.18].forEach(o => ka(t + o, out(sfxBus, pan), 1.6 * g)); break;
      case 'bossDown': O({ f: 400, f1: 90, dur: 1.0, type: 'sawtooth', filt: 'lowpass', fq: 900, g: 0.15 }); kane(t, sfxBus, 1, 990); break;
      case 'bossDie': taiko(t, true, sfxBus, 1.4); kane(t + 0.05, sfxBus, 1.4, 660); N({ f: 1600, f1: 60, dur: 1.4, g: 0.5, rev: 0.6 }); break;
      case 'fudaShot': N({ type: 'bandpass', f: 2500, f1: 1200, q: 1.5, dur: 0.08, g: 0.12 }); break;
      case 'mobDie': N({ type: 'bandpass', f: 1500, f1: 400, dur: 0.25, g: 0.2 }); O({ f: 700, f1: 300, dur: 0.2, type: 'triangle', g: 0.08 }); break;
      case 'spawnMob': O({ f: 400, f1: 800, dur: 0.12, type: 'triangle', g: 0.08 }); break;
      case 'gate': O({ f: 70, f1: 55, dur: 0.6, type: 'sawtooth', filt: 'lowpass', fq: 250, g: 0.18 }); N({ type: 'bandpass', f: 800, q: 4, dur: 0.5, g: 0.08 }); break;
    }
  }
  return { _dbg: () => ({ ctx, master, comp }), init, bgm, bgmStop, jingle, sfx, setVol, st, get ready() { return !!ctx; }, setOn(v) { st.on = v; if (ctx) { if (v) ctx.resume(); } } };
})();
