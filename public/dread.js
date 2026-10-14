'use strict';
/* DREAD: what the ward does to your body and your sense of safety. Runs in both levels (through HW.hooks).
   1. Sickness: grows through the run in waves. Nausea (sway, warping view, blur), coughing fits that spit blood onto the floor
      (loud, and they slow you), paranoia (footsteps behind you, whispers, a figure that is gone when you look), and past
      a point the lights turn rainbow and nothing looks real.
   2. Fake safety: a calm "Game saved" icon, then, a moment later, the level springs a real encounter on you. */
(function () {
  const H = window.HW;
  if (!H || !window.THREE) return;
  const THREE = H.THREE, rnd = H.rnd, pick = H.pick, clamp = H.clamp, lerp = H.lerp, el = H.el, player = H.player, SICK = H.SICK;
  const D = (H.dread = { t: 0, sick: 0, rb: 0, relief: 0, said: 0, err: 0 });
  const HK = () => H.hooks || H.hooks1;
  const active = () => H.state === 'play' || H.state === 'l2';

  /* ---------- overlays ---------- */
  const css = document.createElement('style');
  css.textContent =
    '#dr-blur,#dr-rb,#dr-blood{position:absolute;inset:0;pointer-events:none}' +
    '#dr-rb{opacity:0;mix-blend-mode:color;background:conic-gradient(from var(--a,0deg) at 50% 50%,#f22,#fd2,#3f4,#2df,#44f,#f3d,#f22)}' +
    '#dr-blood{opacity:0}' +
    '#dr-save{position:absolute;right:22px;bottom:20px;display:flex;align-items:center;gap:10px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#cfe8d4;text-shadow:0 0 6px #000;opacity:0;transition:opacity .35s}' +
    '#dr-save.on{opacity:.95}#dr-save i{display:block;width:18px;height:18px;border:2px solid #cfe8d4;border-radius:3px;animation:drs 1.1s linear infinite}' +
    '@keyframes drs{0%{transform:rotate(0)}50%{transform:rotate(180deg) scale(.8)}100%{transform:rotate(360deg)}}';
  document.head.appendChild(css);
  const stage = document.getElementById('stage'), hud = document.getElementById('hud');
  const blur = document.createElement('div'); blur.id = 'dr-blur'; stage.insertBefore(blur, el.canvas.nextSibling);
  const rbEl = document.createElement('div'); rbEl.id = 'dr-rb'; stage.insertBefore(rbEl, blur.nextSibling);
  const bloodEl = document.createElement('div'); bloodEl.id = 'dr-blood'; stage.insertBefore(bloodEl, document.getElementById('flashov'));
  const saveEl = document.createElement('div'); saveEl.id = 'dr-save'; saveEl.innerHTML = '<i></i><span>Game saved</span>'; hud.appendChild(saveEl);

  /* ---------- blood ---------- */
  const dropGeo = new THREE.SphereGeometry(1, 6, 5), planeGeo = new THREE.PlaneGeometry(1, 1);
  const dropMats = [new THREE.MeshBasicMaterial({ color: 0x8a0c12 }), new THREE.MeshBasicMaterial({ color: 0x52070b })];
  const splatTex = [];
  function mkSplat() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const x = 32 + (Math.random() - 0.5) * 30, y = 32 + (Math.random() - 0.5) * 30, r = 4 + Math.random() * 12, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(110,6,12,.95)'); gr.addColorStop(0.7, 'rgba(70,4,8,.85)'); gr.addColorStop(1, 'rgba(40,2,4,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(90,5,10,.9)'; g.beginPath(); g.arc(32 + (Math.random() - 0.5) * 60, 32 + (Math.random() - 0.5) * 60, 1 + Math.random() * 2.2, 0, 6.3); g.fill(); }
    const t = new THREE.CanvasTexture(c); return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  }
  const drops = [], splats = [];
  function addSplat(x, z, size) {
    const grp = HK().group(); if (!grp) return;
    if (!splatTex.length) for (let i = 0; i < 4; i++) splatTex.push(mkSplat());
    const m = new THREE.Mesh(planeGeo, pick(splatTex));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28; m.scale.set(size, size, 1); m.position.set(x, 0.012 + Math.random() * 0.006, z);
    grp.add(m); splats.push(m);
    while (splats.length > 48) { const o = splats.shift(); if (o.parent) o.parent.remove(o); }
  }
  function spray(n) {
    const grp = HK().group(); if (!grp) return;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), cam = H.camera.position;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(dropGeo, pick(dropMats)); m.scale.setScalar(rnd(0.012, 0.03));
      const sp = rnd(1.0, 3.0);
      m.position.set(cam.x + fx * 0.3, cam.y - 0.25, cam.z + fz * 0.3); grp.add(m);
      drops.push({ m: m, vx: fx * sp + rnd(-0.7, 0.7), vy: rnd(0.0, 1.3), vz: fz * sp + rnd(-0.7, 0.7) });
    }
  }
  function dropsTick(dt) {
    const hk = HK();
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], p = d.m.position;
      d.vy -= 9 * dt;
      const nx = p.x + d.vx * dt, nz = p.z + d.vz * dt;
      if (hk.solid && hk.solid(nx, nz)) { d.vx = d.vz = 0; } else { p.x = nx; p.z = nz; }
      p.y += d.vy * dt;
      if (p.y <= 0.03) {
        addSplat(p.x, p.z, rnd(0.14, 0.5)); if (Math.random() < 0.4) addSplat(p.x + rnd(-0.2, 0.2), p.z + rnd(-0.2, 0.2), rnd(0.08, 0.22));
        if (d.m.parent) d.m.parent.remove(d.m); drops.splice(i, 1);
      }
    }
  }
  function bloodScreen() {
    let g = [];
    for (let i = 0; i < 8; i++) g.push('radial-gradient(circle at ' + rnd(5, 95).toFixed(0) + '% ' + rnd(92, 112).toFixed(0) + '%,rgba(120,0,10,.92) 0 ' + rnd(4, 11).toFixed(1) + '%,transparent ' + (rnd(5, 12)).toFixed(1) + '%)');
    for (let i = 0; i < 6; i++) g.push('radial-gradient(ellipse ' + rnd(0.6, 1.4).toFixed(1) + '% ' + rnd(5, 14).toFixed(1) + '% at ' + rnd(8, 92).toFixed(0) + '% ' + rnd(80, 98).toFixed(0) + '%,rgba(110,0,8,.9) 0,transparent 100%)');
    bloodEl.style.background = g.join(',');
    D.bloodA = H.calm ? 0.55 : 1;
  }

  /* ---------- cough ---------- */
  function coughSound(delay) {
    H.noiseBurst({ type: 'bandpass', f: 950, f2: 420, q: 1.2, dur: 0.2, gain: 0.55, delay: delay, rev: 0.15 });
    H.tone({ type: 'sawtooth', f: 170, f2: 70, dur: 0.22, gain: 0.2, delay: delay });
    H.noiseBurst({ type: 'lowpass', f: 500, dur: 0.35, gain: 0.25, atk: 0.05, delay: delay + 0.12 });
  }
  function startCough() {
    D.cT = 1.9; D.hack = [0, 0.5, 1.0]; D.cj = 0;
    const lines = ['You taste iron.', 'Something wet. You wipe your mouth. It is red.', 'You cough up blood. It keeps coming.', 'You cannot stop coughing.'];
    H.say(lines[Math.min(D.coughs || 0, lines.length - 1)], 2800); D.coughs = (D.coughs || 0) + 1;
  }
  function coughTick(dt, sk) {
    if (!(D.cT > 0)) { D.cj = Math.max(0, (D.cj || 0) - dt * 5); return; }
    const el0 = 1.9 - D.cT; D.cT -= dt;
    while (D.hack.length && el0 >= D.hack[0]) {
      D.hack.shift(); D.cj = 1; coughSound(0); spray(rnd(6, 11) * (0.6 + 0.6 * sk)); bloodScreen(); D.bloodC = 1;
      if (!H.calm) H.flashFx('#6a0000', 0.22, 0.25);
      H.shake = Math.max(H.shake, 0.35);
    }
    SICK.slow = 0.3; SICK.noise = 1;
    const hk = HK(); if (hk.noise) hk.noise(10);
    if (D.cT <= 0) { SICK.slow = 1; SICK.noise = 0; H.noiseBurst({ type: 'highpass', f: 1800, dur: 0.6, gain: 0.12, atk: 0.15 }); }
  }

  /* ---------- paranoia ---------- */
  const figs = [];
  function figure() {
    const sp = HK().spot(9, 18), grp = HK().group(); if (!sp || !grp) return false;
    const g = new THREE.Group(), blk = new THREE.MeshBasicMaterial({ color: 0x010101 });
    const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, blk); m.position.set(x, y, z); g.add(m); return m; };
    add(new THREE.CylinderGeometry(0.2, 0.26, 1.6, 8), 0, 0.95, 0);
    add(new THREE.SphereGeometry(0.17, 8, 6), 0, 1.95, 0);
    for (const sx of [-1, 1]) { const a = add(new THREE.CylinderGeometry(0.035, 0.03, 1.3, 5), sx * 0.3, 0.95, 0); a.rotation.z = sx * 0.06; }
    for (const sx of [-1, 1]) {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.TEX.glow, color: 0xe8f0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }));
      e.scale.set(0.2, 0.2, 1); e.position.set(sx * 0.07, 1.97, 0.14); g.add(e);
    }
    g.position.set(sp.x, 0, sp.z); g.rotation.y = Math.atan2(player.x - sp.x, player.z - sp.z); grp.add(g);
    figs.push({ g: g, t: 0, seen: 0, grp: grp });
    return true;
  }
  function figTick(dt) {
    for (let i = figs.length - 1; i >= 0; i--) {
      const f = figs[i]; f.t += dt;
      const dx = f.g.position.x - player.x, dz = f.g.position.z - player.z, d = Math.hypot(dx, dz) || 1, fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      const looking = (dx * fx + dz * fz) / d > 0.9;
      f.g.rotation.y = Math.atan2(-dx, -dz);
      if (looking) f.seen += dt;
      if (f.seen > 0.35 || f.t > 6 || d < 4 || !active()) {
        if (f.g.parent) f.g.parent.remove(f.g);
        if (active()) H.noiseBurst({ type: 'highpass', f: 3200, dur: 0.22, gain: 0.3 });
        figs.splice(i, 1);
      }
    }
  }
  function paranoia() {
    const k = Math.random() * 100, hk = HK();
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    if (k < 30) {
      for (let i = 0; i < 6; i++) { const dist = 4.6 - i * 0.6; H.noiseBurst({ dur: 0.11, f: 260, gain: 0.5, pos: [player.x - fx * dist, 0.2, player.z - fz * dist], rev: 0.3, delay: i * 0.42 }); }
      H.sfxHeart(0.4);
    } else if (k < 55) {
      H.sfxWhisper([player.x - fx * 1.2 + rnd(-0.6, 0.6), 1.6, player.z - fz * 1.2 + rnd(-0.6, 0.6)]);
      H.say(pick(['"...behind you..."', '"...it knows your name..."', '"...don\'t turn around..."', '"...you hear it too..."']), 2600);
    } else if (k < 80) {
      if (!figure()) H.say('Something moved at the edge of your sight.', 2600);
    } else H.say(pick(['Did something just move?', 'Something is breathing in time with you.', 'You are not alone in here. You never were.', 'Count your steps. Count them again.']), 3200);
  }

  /* ---------- rainbow light ---------- */
  const tc = new THREE.Color(), tb = new THREE.Color(), baseMat = new WeakMap();
  function tint(target, baseHex, hue, sat, light) { tb.setHex(baseHex); tc.setHSL(((hue % 1) + 1) % 1, sat, light); target.copy(tb).lerp(tc, D.rb); }
  D.rbColor = function (target, i) { if (D.rb > 0.01) tint(target, target.getHex(), D.t * 0.06 + (i || 0) * 0.17, 1, 0.58); };
  function rainbow() {
    const hk = HK(), b = hk.base, hue = D.t * 0.06;
    if (D.rb > 0.01) {
      D.rbOn = true;
      tint(H.ambient.color, b.ambient, hue, 0.9, 0.3);
      tint(H.flash.color, b.flash, hue + 0.5, 0.85, 0.75);
      H.lampLights.forEach((l, i) => tint(l.color, b.lamp, hue + i * 0.33, 1, 0.6));
      const mats = hk.lampMats ? hk.lampMats() : [];
      for (const m of mats) { if (!m || !m.emissive) continue; if (!baseMat.has(m)) baseMat.set(m, m.emissive.getHex()); tint(m.emissive, baseMat.get(m), hue + 0.2, 1, 0.5); }
    } else if (D.rbOn) {
      D.rbOn = false;
      H.ambient.color.setHex(b.ambient); H.flash.color.setHex(b.flash); H.lampLights.forEach((l) => l.color.setHex(b.lamp));
      const mats = hk.lampMats ? hk.lampMats() : [];
      for (const m of mats) if (m && baseMat.has(m)) m.emissive.setHex(baseMat.get(m));
    }
    rbEl.style.opacity = (0.2 * D.rb * (H.calm ? 0.5 : 1)).toFixed(3);
    rbEl.style.setProperty('--a', ((D.t * 24) % 360).toFixed(0) + 'deg');
  }

  /* ---------- fake safety ---------- */
  const FS = { next: rnd(70, 110), phase: 0, t: 0, gap: 0, n: 0 };
  function saveTick(dt, act) {
    const hk = HK();
    if (FS.phase === 0) {
      if (act && FS.n < 5 && D.t >= FS.next) {
        if (hk.busy()) { FS.next = D.t + 4; return; }
        FS.phase = 1; FS.t = 0; saveEl.classList.add('on');
        H.tone({ f: 880, dur: 0.5, gain: 0.06, rev: 0.5 }); H.tone({ f: 1318, dur: 0.9, gain: 0.05, delay: 0.16, rev: 0.6 });
      }
      return;
    }
    if (!act || hk.busy()) { saveEl.classList.remove('on'); FS.phase = 0; FS.next = D.t + 40; return; }
    FS.t += dt;
    if (FS.phase === 1 && FS.t > 3.3) { saveEl.classList.remove('on'); FS.phase = 2; FS.t = 0; FS.gap = rnd(1.0, 2.6); }
    else if (FS.phase === 2 && FS.t > FS.gap) {
      FS.phase = 0; FS.n++; FS.next = D.t + rnd(150, 230);
      if (!hk.ambush()) FS.next = D.t + 20;
    }
  }

  /* ---------- main loop ---------- */
  const SAY = [[0.15, 'Your stomach turns.'], [0.35, 'Your head is pounding. The corridor will not hold still.'], [0.55, 'The lights are wrong. The colours are bleeding.'], [0.75, 'Nothing here is real. Keep moving.']];
  let cNext = rnd(25, 40), pNext = rnd(25, 40);
  function tick(dt) {
    const act = active(), hk = HK();
    if (act) D.t += dt;
    const calmK = H.calm ? 0.5 : 1;
    let target = 0;
    if (act) {
      const base = clamp((D.t - 40) / 420, 0, 1) * 0.9, wave = 0.62 + 0.38 * Math.sin(D.t / 17 + 1.3);
      target = clamp((base * wave + H.fear * 0.12 - D.relief) * calmK, 0, 1);
      if (hk.hidden && hk.hidden()) target *= 0.5;
      D.relief = Math.max(0, D.relief - dt * 0.004);
    }
    D.sick += (target - D.sick) * Math.min(1, dt * (act ? 0.6 : 1.8));
    const s = D.sick;
    for (let i = 0; i < SAY.length; i++) if (act && s >= SAY[i][0] && !(D.said & (1 << i))) { D.said |= 1 << i; H.say(SAY[i][1], 4200); }
    /* nausea */
    SICK.roll = Math.sin(D.t * 0.55) * 0.045 * s + Math.sin(D.t * 1.3) * 0.012 * s;
    SICK.yaw = Math.sin(D.t * 0.37) * 0.025 * s;
    SICK.fov = Math.sin(D.t * 0.8) * 4 * s;
    SICK.pit = Math.sin(D.t * 0.42 + 1) * 0.03 * s - (D.cj || 0) * 0.2;
    const bl = (0.45 + 0.55 * Math.sin(D.t * 0.9)) * 2.4 * s * (H.calm ? 0.6 : 1);
    const bs = bl > 0.2 ? 'blur(' + bl.toFixed(2) + 'px)' : '';
    if (blur.style.backdropFilter !== bs) { blur.style.backdropFilter = bs; blur.style.webkitBackdropFilter = bs; }
    /* coughing: starts once you are properly ill, never while hidden (you choke it back) */
    const hidden = hk.hidden && hk.hidden();
    if (act && s > 0.28 && !(D.cT > 0) && !hidden) {
      cNext -= dt;
      if (cNext <= 0) { startCough(); cNext = lerp(rnd(26, 40), rnd(11, 18), clamp((s - 0.28) / 0.72, 0, 1)) / calmK * (H.calm ? 0.8 : 1); }
    }
    if (D.cT > 0 && !act) D.cT = 0;
    coughTick(dt, s);
    if (!(D.cT > 0) && SICK.slow !== 1) { SICK.slow = 1; SICK.noise = 0; }
    /* paranoia */
    if (act && s > 0.18) {
      pNext -= dt;
      if (pNext <= 0) { pNext = lerp(rnd(30, 45), rnd(11, 18), clamp((s - 0.18) / 0.82, 0, 1)) * (H.calm ? 1.6 : 1); if (!(hk.busy && hk.busy() && Math.random() < 0.5)) paranoia(); }
    }
    figTick(dt); dropsTick(dt);
    /* blood on the screen fades slowly */
    if (D.bloodC > 0) { D.bloodC = Math.max(0, D.bloodC - dt * 0.3); }
    bloodEl.style.opacity = ((D.bloodC || 0) * (D.bloodA || 1)).toFixed(3);
    /* rainbow */
    D.rb += (clamp((s - 0.45) / 0.3, 0, 1) - D.rb) * Math.min(1, dt * 0.8);
    if (!act && D.rb < 0.02) D.rb = 0;
    rainbow();
    saveTick(dt, act);
  }

  D.stats = () => ({ drops: drops.length, splats: splats.length, figs: figs.length, saves: FS.n });
  D.relieve = function (a) { D.relief = clamp(D.relief + a, 0, 0.6); };
  D.reset = function (full) {
    if (full) { D.t = 0; D.sick = 0; D.rb = 0; D.relief = 0; D.said = 0; D.coughs = 0; FS.n = 0; FS.next = rnd(70, 110); cNext = rnd(25, 40); pNext = rnd(25, 40); }
    D.cT = 0; D.cj = 0; D.bloodC = 0; SICK.slow = 1; SICK.noise = 0; SICK.roll = SICK.pit = SICK.yaw = SICK.fov = 0;
    for (const d of drops) if (d.m.parent) d.m.parent.remove(d.m); drops.length = 0;
    for (const m of splats) if (m.parent) m.parent.remove(m); splats.length = 0;
    for (const f of figs) if (f.g.parent) f.g.parent.remove(f.g); figs.length = 0;
    saveEl.classList.remove('on'); FS.phase = 0; if (!full) FS.next = Math.max(FS.next, D.t + 30);
    bloodEl.style.opacity = 0;
  };

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    try { tick(dt); } catch (e) { if (!D.err) { D.err = 1; console.error('[dread]', e); } }
  }
  requestAnimationFrame(loop);
})();
