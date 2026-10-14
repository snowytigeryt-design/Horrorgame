'use strict';
/* LEVEL 2, part E: the rules of Ward 9.
   Goal: it is a maze, and everyone in it is crazed and awake. Find the three ward keys (they are in cabinets along the walls),
   then run to the rift. Forging a blade from scrap and wire (R) is an optional side quest that lets you put the small ones down.
   Registers itself as HW.l2 for the main game. */
(function () {
  const H = window.HW, L = window.HW2;
  if (!H || !L || !L.ui || !L.boss || !L.updateEnemies) return;
  const THREE = H.THREE, rnd = H.rnd, pick = H.pick, clamp = H.clamp, lerp = H.lerp, el = H.el, player = H.player, keys = H.keys, flashlight = H.flashlight, T = L.T, N = L.N, UI = L.ui;
  const NEED = { metal: 4, wire: 3 }, CRAFT_TIME = 3.4, KEYS = 3;
  const S = { active: false, hp: 100, metal: 0, wire: 0, knife: false, crafting: false, craftT: 0, keys: 0, stabCd: 0, stabA: 0, searching: null, searchT: 0, spawnT: 10, deadT: 0, kills: 0, bossKills: 0, start: 0, hurtT: 0, noKnifeT: -9, hb: 1, killer: null, prevTime: '' };
  const say = H.say;
  let lastPrompt = '', orig = null;

  /* ---------- run start ---------- */
  function startRun(first) {
    Object.assign(S, { active: true, hp: 100, metal: 0, wire: 0, knife: false, crafting: false, craftT: 0, keys: 0, stabCd: 0, stabA: 0, searching: null, searchT: 0, spawnT: 10, deadT: 0, kills: 0, bossKills: 0, start: performance.now(), hurtT: 0, hb: 1, killer: null });
    L.t = 0; L.rootsCut = 0; lastPrompt = '';
    L.clearEnemies(); L.build(); L.boss.init();
    const sp = L.startPos;
    Object.assign(player, { x: sp.x, z: sp.z, yaw: sp.yaw, pitch: 0, vx: 0, vz: 0, stamina: 100, exhausted: false, sprint: false, moving: false, hidden: null, bobT: 0, stepPh: 0, staDelay: 0 });
    flashlight.on = true; flashlight.battery = Math.max(flashlight.battery, 0.75);
    H.scene.background.setHex(0x12040b); H.scene.fog.color.setHex(0x12040b); H.scene.fog.density = 0.052;
    H.ambient.color.setHex(0x3a1626); H.flash.color.setHex(0xdfe6ff);
    L.populate(10, 3, 2, 5);
    H.hooks = HOOKS2; if (H.dread) H.dread.reset(false);
    UI.lightsInit(); UI.knife(false); UI.show(true); UI.ambStart();
    el.compass.hidden = true; el.siren.classList.remove('on'); el.locker.classList.remove('on');
    H.shake = 0; H.fear = 0; H.fovK = 0;
    H.state = 'l2'; H.show(null); el.hud.hidden = false; H.requestLock();
    el.fade.style.transition = 'none'; el.fade.style.background = first ? '#e8e4da' : '#000'; el.fade.style.opacity = 1;
    requestAnimationFrame(() => { el.fade.style.transition = 'opacity ' + (first ? 2.6 : 1.2) + 's'; el.fade.style.opacity = 0; });
    setTimeout(() => { if (S.active) el.fade.style.background = '#000'; }, 3000);
    if (first) UI.card('Ward 9', 'The door seals behind you. The corridors twist, the air is warm, and everyone in here is awake.', 4200);
    setTimeout(() => { if (H.state === 'l2') say('Find the three ward keys and get out. They are all awake. Do not make noise.', 7000); }, first ? 4500 : 1500);
  }
  function begin(prevTime) { S.prevTime = prevTime || ''; H.sleepL1(); startRun(true); }
  function retry() { teardownWorld(); startRun(false); }
  function teardownWorld() {
    L.clearEnemies(); UI.lightsClear(); UI.knife(false); UI.ambStop(); UI.reset(); L.dispose(); L.boss.g = null;
    el.compass.hidden = true;
  }
  function teardown() {
    if (!S.active && !L.world) return;
    S.active = false; teardownWorld(); H.hooks = H.hooks1; if (H.dread) H.dread.reset(false);
    if (el.compass.lastChild) el.compass.lastChild.nodeValue = 'exit';
    if (orig) { orig.h2.textContent = orig.h; orig.p.textContent = orig.t; orig.h2.style.color = orig.c; orig = null; }
    el.fade.style.transition = 'none'; el.fade.style.background = '#000'; el.fade.style.opacity = 0;
    H.wakeL1();
  }

  /* ---------- player ---------- */
  function movePlayer(dt) {
    const p = player, lk = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0), lu = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
    if (lk) p.yaw += lk * 1.8 * dt; if (lu) p.pitch = clamp(p.pitch + lu * 1.4 * dt, -1.3, 1.3);
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    let wx = fx * f + rx * s, wz = fz * f + rz * s; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const slow = (L.boss.st === 'flay' ? 0.4 : 1) * (S.searching ? 0.6 : 1) * H.SICK.slow;
    p.sprint = !!((keys.ShiftLeft || keys.ShiftRight) && wl > 0 && !p.exhausted && p.stamina > 0);
    const sp = (p.sprint ? 5.4 : 2.9) * slow;
    p.vx = lerp(p.vx, wx * sp, Math.min(1, 12 * dt)); p.vz = lerp(p.vz, wz * sp, Math.min(1, 12 * dt));
    const nx = p.x + p.vx * dt; if (!L.blocked(nx, p.z, 0.4)) p.x = nx; else p.vx = 0;
    const nz = p.z + p.vz * dt; if (!L.blocked(p.x, nz, 0.4)) p.z = nz; else p.vz = 0;
    const spd = Math.hypot(p.vx, p.vz); p.moving = spd > 0.6;
    if (p.sprint) { p.stamina = Math.max(0, p.stamina - 10 * dt); p.staDelay = 0.6; if (p.stamina <= 0) { p.exhausted = true; say('You are out of breath.', 2500); } }
    else { p.staDelay -= dt; if (p.staDelay <= 0) p.stamina = Math.min(100, p.stamina + 26 * dt); if (p.exhausted && p.stamina >= 18) p.exhausted = false; }
    p.bobT += dt * spd * 1.9; const ph = p.stepPh; p.stepPh += spd * dt * 0.62;
    if (Math.floor(p.stepPh) !== Math.floor(ph) && spd > 0.8) H.sfxStep(p.sprint);
    L.noise(p.sprint ? 15 : (p.moving ? 5 : 0));
    const dps = L.boss.affectPlayer(dt); if (dps) L.hurt(dps * dt, L.boss, true);
    return spd;
  }

  /* ---------- interaction ---------- */
  const canCraft = () => !S.knife && S.metal >= NEED.metal && S.wire >= NEED.wire;
  function target() {
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); let best = null, bd = 99;
    for (const c of L.cabinets) {
      if (c.opened) continue;
      const dx = c.x - player.x, dz = c.z - player.z, d = Math.hypot(dx, dz);
      if (d > 2.4 || (d > 1.2 && (dx * fx + dz * fz) / d < 0.3)) continue;
      if (d < bd) { bd = d; best = { kind: 'cab', o: c }; }
    }
    return best;
  }
  function key(code) {
    if (code === 'KeyF') { if (flashlight.battery > 0) { flashlight.on = !flashlight.on; H.sfxClick(); } else say('No battery.', 1500); }
    else if (code === 'KeyR') craft();
    else if (code === 'KeyE') {
      const t = target();
      if (t && t.kind === 'cab' && !S.searching) { S.searching = t.o; S.searchT = 0; S.crafting = false; H.noiseBurst({ type: 'bandpass', f: 600, f2: 300, q: 8, dur: 0.5, gain: 0.3 }); L.noise(12); }
      else if (!t && player.x < L.startPos.x + 2.5) say('The door is sealed. There is no way back.', 2500);
    }
  }
  function craft() {
    if (S.knife) { say('You already have a blade.', 1800); return; }
    if (!canCraft()) { say('Side quest: ' + NEED.metal + ' scrap metal and ' + NEED.wire + ' wire make a blade.', 2600); return; }
    if (S.crafting) return;
    S.crafting = true; S.craftT = 0; say('Forging the blade. Stay still. It is loud.', 3000);
  }
  function lootCab(c) {
    c.opened = true; const fr = c.mesh.userData.fronts[(Math.random() * 4) | 0]; fr.position.z += 0.3; fr.rotation.x = 0.15;
    switch (c.loot) {
      case 'metal': S.metal++; H.sfxPickup(); say('Scrap metal: a bent surgical tray (' + Math.min(S.metal, NEED.metal) + ' of ' + NEED.metal + ').', 3000); break;
      case 'wire': S.wire++; H.sfxPickup(); say('Wire, still bright (' + Math.min(S.wire, NEED.wire) + ' of ' + NEED.wire + ').', 3000); break;
      case 'key': foundKey(); break;
      case 'medkit': S.hp = Math.min(100, S.hp + 40); if (H.dread) H.dread.relieve(0.3); H.sfxPickup(); say('Bandages and a half-empty bottle. +40 health. The nausea eases.', 3200); break;
      case 'battery': flashlight.battery = Math.min(1, flashlight.battery + 0.5); H.sfxPickup(); say('Batteries. The flashlight steadies.', 2500); break;
      case 'trap': {
        say('Something was folded up inside.', 2500); H.sfxSting(false); H.shake = 1; H.flashFx('#400', 0.4, 0.6);
        for (let i = 0; i < 2; i++) { const e = L.spawnEnemy('patient', c.x + c.fx * (1 + i * 0.7), c.z + c.fz * (1 + i * 0.7)); e.st = 'chase'; e.atkT = 0.6; }
        break;
      }
      default: say('Empty. Someone got here first.', 2200);
    }
    if (canCraft()) say('Enough for a blade. Press R to forge one, if you want it (side quest).', 5000);
  }

  /* ---------- combat ---------- */
  function attack() {
    if (H.state !== 'l2') return;
    if (!S.knife) { if (L.t - S.noKnifeT > 4) { say('You have nothing to fight with. Run, or forge a blade.', 2500); S.noKnifeT = L.t; } return; }
    if (S.stabCd > 0) return;
    S.stabCd = 0.5; S.stabA = 1; H.noiseBurst({ type: 'bandpass', f: 1800, f2: 600, dur: 0.08, gain: 0.15 }); L.noise(8);
    L.stab(player.x, player.z, player.yaw);
  }
  /* a spawn of crazed patients somewhere out of sight, then everyone is told where you are */
  function mob(n) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 60; k++) {
        const t = pick(L.open), x = t[0] * T, z = t[1] * T, d = Math.hypot(x - player.x, z - player.z);
        if (d < 14 || d > 30 || L.los(x, z, player.x, player.z)) continue;
        const r = Math.random(); L.spawnEnemy(r < 0.6 ? 'maniac' : r < 0.9 ? 'patient' : 'howler', x, z); break;
      }
    }
    L.alertAt(player.x, player.z, 70);
  }
  function foundKey() {
    S.keys++; L.rootsCut = S.keys; H.shake = Math.max(H.shake, 0.6); H.sfxPickup();
    H.tone({ f: 660, f2: 990, dur: 0.6, gain: 0.15, rev: 0.6 }); H.flashFx('#ffd060', 0.25, 0.5);
    H.noiseBurst({ dur: 1.0, f: 300, f2: 40, gain: 0.7, rev: 0.8 });
    if (S.keys >= KEYS) { say('The third key turns in your hand. Somewhere a gate groans open. RUN.', 6000); openRift(); mob(4); L.boss.summon(true); }
    else { say('Ward key ' + S.keys + ' of ' + KEYS + '. The lock echoes through the whole maze. They heard.', 4500); mob(2 + S.keys); if (Math.random() < 0.5) L.boss.summon(true); }
  }
  function openRift() {
    const x = L.exitObj; x.open = true; x.disc.material.opacity = 0.95; x.light.intensity = 3.4; x.ring.material.emissive.setHex(0x4fa8ff);
    H.sfxSting(true); H.shake = 1;
  }
  L.onKill = function (e) { S.kills++; if (e.kind === 'lurcher') say('It goes down. Barely.', 2000); };
  L.onBossKill = function () { S.bossKills++; S.hp = Math.min(100, S.hp + 40); };
  L.hurt = function (dmg, src, silent) {
    if (H.state !== 'l2') return;
    S.hp -= dmg; S.killer = src;
    if (!silent) {
      S.hurtT = 0.5; H.shake = Math.max(H.shake, 0.8); H.flashFx('#a00', 0.45, 0.5);
      H.noiseBurst({ dur: 0.25, f: 300, f2: 80, gain: 0.5 }); H.tone({ f: 80, f2: 40, dur: 0.25, gain: 0.5 });
      if (S.crafting) { S.crafting = false; say('The work is ruined. Start again.', 2000); } S.searching = null;
    }
    if (S.hp <= 0) { S.hp = 0; die(); }
  };

  /* ---------- death and escape ---------- */
  function die() {
    H.state = 'l2dying'; S.deadT = 0; S.crafting = false; S.searching = null; H.sfxScream(); H.shake = 1; H.flashFx('#a00', 0.8, 1.2); UI.ambStop(); UI.knife(false);
    el.prompt.textContent = ''; lastPrompt = '';
  }
  function dyingStep(dt) {
    S.deadT += dt; H.shake = 1;
    if (S.deadT > 1.0 && el.fade.style.opacity !== '1') { el.fade.style.background = '#000'; el.fade.style.transition = 'opacity .7s'; el.fade.style.opacity = 1; }
    if (S.deadT > 2.1) {
      H.state = 'l2dead'; const k = S.killer && S.killer.kind;
      const lines = { lurcher: 'It hit like a collapsing wall.', howler: 'The howling stopped. That is how you knew.', patient: 'They were patients once. They remember being held down.', maniac: 'The laughing was the last thing you heard.' };
      document.getElementById('deadline').textContent = S.killer === L.boss ? 'The Keeper took what it came for.' : (lines[k] || 'Ward 9 keeps what it finds.');
      document.getElementById('deadstat').textContent = 'Keys found: ' + S.keys + ' of ' + KEYS + '  /  Time in Ward 9: ' + H.fmt(performance.now() - S.start);
      document.getElementById('retry').hidden = false; document.getElementById('respawn').hidden = true; document.getElementById('leave2').hidden = !H.NET.inRoom;
      H.show('dead'); if (document.exitPointerLock) document.exitPointerLock();
    }
  }
  function win() {
    if (H.state !== 'l2') return;
    H.state = 'l2won'; UI.ambStop(); UI.knife(false); el.compass.hidden = true;
    el.fade.style.background = '#e8e4da'; el.fade.style.transition = 'opacity 1.6s'; el.fade.style.opacity = 1; H.sfxMusicBox(null, true);
    setTimeout(() => {
      const w = document.getElementById('s-win'), h2 = w.querySelector('h2'), p = w.querySelector('.lede');
      if (!orig) orig = { h2: h2, p: p, h: h2.textContent, t: p.textContent, c: h2.style.color };
      h2.textContent = 'You are out.'; h2.style.color = '#e6dcc6';
      p.textContent = 'The rift swallows the light. You fall through cold rain and open air, and the ward folds shut behind you like a closing wound. Somewhere deep inside, a clock begins to chime again.';
      document.getElementById('winstat').textContent = 'Ward 7: ' + S.prevTime + '  /  Ward 9: ' + H.fmt(performance.now() - S.start) + (S.kills ? '  /  Put down: ' + S.kills : '') + (S.bossKills ? '  /  Keeper felled: ' + S.bossKills : '');
      document.getElementById('again').textContent = H.NET.inRoom ? 'Back to title' : 'Play again';
      H.show('win'); if (document.exitPointerLock) document.exitPointerLock();
    }, 1800);
  }

  /* ---------- per frame ---------- */
  function step(dt) {
    dt = Math.min(dt, 0.05); L.t += dt; H.gframe++;
    if (H.gframe % 2 === 0) H.drawGrain();
    const st = H.state, alive = st === 'l2';
    let spd = 0;
    if (alive) {
      S.stabCd = Math.max(0, S.stabCd - dt); S.stabA = Math.max(0, S.stabA - dt * 3.3); S.hurtT = Math.max(0, S.hurtT - dt);
      spd = movePlayer(dt);
      /* searching a cabinet */
      if (S.searching) {
        const c = S.searching;
        if (Math.hypot(c.x - player.x, c.z - player.z) > 2.9) S.searching = null;
        else { S.searchT += dt; if (S.searchT > 1.2) { S.searching = null; lootCab(c); } else if (Math.random() < dt * 5) H.noiseBurst({ type: 'bandpass', f: rnd(500, 1200), q: 6, dur: 0.07, gain: 0.2 }); }
      }
      /* forging */
      if (S.crafting) {
        if (spd > 1.3) { S.crafting = false; say('The work comes apart. Stay still.', 2000); }
        else {
          S.craftT += dt; L.noise(9);
          if (Math.random() < dt * 4) { H.noiseBurst({ type: 'bandpass', f: rnd(2000, 4000), q: 8, dur: 0.1, gain: 0.3 }); H.tone({ f: rnd(1200, 2200), dur: 0.05, gain: 0.05 }); }
          if (S.craftT >= CRAFT_TIME) { S.crafting = false; S.knife = true; UI.knife(true); H.sfxPickup(); H.tone({ f: 523, f2: 784, dur: 0.5, gain: 0.15, rev: 0.5 }); say('A crude blade. Click to stab. Now find the three hearts.', 6000); }
        }
      }
      /* spawn pressure */
      S.spawnT -= dt;
      if (S.spawnT <= 0) {
        S.spawnT = Math.max(7, 17 - S.keys * 3) + rnd(0, 4);
        if (L.liveCount() < 16 + S.keys * 3) { const r = Math.random(), s = L.farSpot(14); if (s) L.spawnEnemy(r < 0.06 ? 'lurcher' : r < 0.2 ? 'howler' : r < 0.5 ? 'maniac' : 'patient', s[0], s[1]); }
      }
      if (L.exitObj && L.exitObj.open && Math.hypot(player.x - L.exitObj.x, player.z - L.exitObj.z) < 2.2) win();
    }
    L.updateEnemies(dt, alive); L.boss.update(dt, alive);
    if (st === 'l2dying') dyingStep(dt);
    rift(dt);
    /* fear, heartbeat */
    let threat = 99;
    for (const e of L.enemies) if (!e.dead && e.st === 'chase') threat = Math.min(threat, Math.hypot(e.x - player.x, e.z - player.z));
    if (L.boss.st === 'hunt' || L.boss.st === 'flay' || L.boss.st === 'stagger') threat = Math.min(threat, Math.hypot(L.boss.x - player.x, L.boss.z - player.z) * 0.7);
    const ft = alive ? clamp(1 - (threat - 3) / 20, 0, 1) : 0;
    H.fear = lerp(H.fear, ft, Math.min(1, 2 * dt)); H.shake = Math.max(0, H.shake - dt * 1.4);
    H.fovK = lerp(H.fovK, (H.fear > 0.5 ? 3 : 0) + (player.sprint ? 2 : 0), Math.min(1, 4 * dt));
    el.grain.style.opacity = (0.05 + H.fear * 0.07 + L.boss.flayK * 0.1) * (H.calm ? 0.5 : 1);
    if (alive) {
      S.hb -= dt;
      if (S.hb <= 0) { const f = Math.max(H.fear, S.hp < 35 ? 0.6 : 0); if (f > 0.12) H.sfxHeart((0.25 + 0.6 * f) * 0.6); S.hb = lerp(1.0, 0.38, Math.max(H.fear, S.hp < 35 ? 0.8 : 0)); }
      UI.ambTick(dt, S);
    }
    H.ambient.intensity = 0.6 * H.bright;
    H.updateFlashlight(dt); H.updateCamera(dt); H.audioFrame(dt);
    if (st === 'l2dying' || st === 'l2dead') { const k = Math.min(1, S.deadT / 0.8); H.camera.position.y = lerp(1.65, 0.35, k); H.camera.rotation.z = k * 0.9; }
    UI.lightsTick(dt); UI.knifePose(S.stabA, Math.sin(player.bobT * 2) * 0.03); UI.fx(S); UI.update(S, NEED); hudText(alive);
  }
  function rift(dt) {
    const x = L.exitObj; if (!x || !x.open) return;
    x.disc.rotation.z += dt * 0.9; x.g.rotation.y = Math.atan2(player.x - x.x, player.z - x.z);
    x.light.intensity = (3 + Math.sin(L.t * 7) * 0.6 + (Math.random() < 0.05 ? -1.5 : 0)) * H.bright;
  }
  function hudText(alive) {
    let g, p = '';
    if (S.keys < KEYS) g = 'Find the three ward keys. They are in cabinets along the walls. Follow the arrow.';
    else g = 'The way out is open. RUN.';
    UI.goal(g);
    if (alive) {
      const t = target();
      if (S.searching) p = 'searching...';
      else if (S.crafting) p = 'forging... ' + Math.round(S.craftT / CRAFT_TIME * 100) + '%';
      else if (t && t.kind === 'cab') p = '<kbd>E</kbd> search cabinet';
      else if (canCraft()) p = '<kbd>R</kbd> forge a blade (optional)';
    }
    if (p !== lastPrompt) { el.prompt.innerHTML = p; lastPrompt = p; }
    /* compass: nearest cabinet that still holds a key, then the rift */
    let tx = null, tz = null, label = '';
    if (S.keys >= KEYS && L.exitObj) { tx = L.exitObj.x; tz = L.exitObj.z; label = 'exit'; }
    else { let bd = 1e9; for (const c of L.cabinets) if (c.loot === 'key' && !c.opened) { const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < bd) { bd = d; tx = c.x; tz = c.z; label = 'key'; } } }
    if (tx != null && alive) {
      el.compass.hidden = false; if (el.compass.lastChild && el.compass.lastChild.nodeValue !== label) el.compass.lastChild.nodeValue = label;
      const dx = tx - player.x, dz = tz - player.z, fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      el.arrow.style.transform = 'rotate(' + Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) + 'rad)';
    } else el.compass.hidden = true;
  }

  /* what the dread layer (dread.js) needs to know about this level */
  const HOOKS2 = {
    lvl: 2,
    group: () => L.world,
    base: { ambient: 0x3a1626, flash: 0xdfe6ff, lamp: 0xffb870 },
    lampMats: () => [],
    solid: (x, z) => L.solidAt(x, z),
    hidden: () => false,
    spot: (a, b) => {
      for (let i = 0; i < 120; i++) {
        const t = pick(L.open), x = t[0] * T, z = t[1] * T, d = Math.hypot(x - player.x, z - player.z);
        if (d < a || d > b) continue;
        if (i < 80 && !L.los(player.x, player.z, x, z)) continue;
        return { x: x, z: z };
      }
      return null;
    },
    busy: () => H.state !== 'l2' || L.enemies.some((e) => !e.dead && e.st === 'chase') || L.boss.st !== 'idle',
    noise: (r) => L.noise(r),
    /* the "game saved" icon just faded. Now the maze springs something on you from the next corridor. */
    ambush: () => {
      if (H.state !== 'l2') return false;
      L.refreshPdm(true);
      const spots = L.open.filter((t) => { const d = L.pdm[t[1] * N + t[0]]; return d >= 2 && d <= 4; });
      if (!spots.length) return false;
      H.flashFx('#000', 0.9, 0.5); H.sfxSting(true); H.shake = 1; L.boss.flicker = Math.max(L.boss.flicker, 1.6);
      const kinds = Math.random() < 0.35 ? ['lurcher'] : ['maniac', 'maniac', 'patient'];
      for (const k of kinds) { const t = pick(spots), e = L.spawnEnemy(k, t[0] * T, t[1] * T); e.st = 'chase'; e.atkT = 0.7; e.stag = 0.3; e.lostT = 0; }
      return true;
    }
  };

  el.canvas.addEventListener('mousedown', (e) => { if (e.button === 0) attack(); });
  H.l2 = L.api = { begin: begin, step: step, key: key, retry: retry, teardown: teardown, get active() { return S.active; } };
})();
