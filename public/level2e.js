'use strict';
/* LEVEL 2, part E: the rules of Ward 9.
   Goal: search cabinets for scrap metal and wire, forge a blade (R), cut out the three hearts that feed the ward,
   survive the patients and the Keeper, then run for the rift. Registers itself as HW.l2 for the main game. */
(function () {
  const H = window.HW, L = window.HW2;
  if (!H || !L || !L.ui || !L.boss || !L.updateEnemies) return;
  const THREE = H.THREE, rnd = H.rnd, pick = H.pick, clamp = H.clamp, lerp = H.lerp, el = H.el, player = H.player, keys = H.keys, flashlight = H.flashlight, T = L.T, N = L.N, UI = L.ui;
  const NEED = { metal: 4, wire: 3 }, CRAFT_TIME = 3.4;
  const S = { active: false, hp: 100, metal: 0, wire: 0, knife: false, crafting: false, craftT: 0, roots: 0, stabCd: 0, stabA: 0, searching: null, searchT: 0, spawnT: 10, deadT: 0, kills: 0, bossKills: 0, start: 0, hurtT: 0, noKnifeT: -9, hb: 1, killer: null, prevTime: '' };
  const say = H.say;
  let lastPrompt = '', orig = null;

  /* ---------- run start ---------- */
  function startRun(first) {
    Object.assign(S, { active: true, hp: 100, metal: 0, wire: 0, knife: false, crafting: false, craftT: 0, roots: 0, stabCd: 0, stabA: 0, searching: null, searchT: 0, spawnT: 10, deadT: 0, kills: 0, bossKills: 0, start: performance.now(), hurtT: 0, hb: 1, killer: null });
    L.t = 0; L.rootsCut = 0; lastPrompt = '';
    L.clearEnemies(); L.build(); L.boss.init();
    const sp = L.startPos;
    Object.assign(player, { x: sp.x, z: sp.z, yaw: sp.yaw, pitch: 0, vx: 0, vz: 0, stamina: 100, exhausted: false, sprint: false, moving: false, hidden: null, bobT: 0, stepPh: 0, staDelay: 0 });
    flashlight.on = true; flashlight.battery = Math.max(flashlight.battery, 0.75);
    H.scene.background.setHex(0x12040b); H.scene.fog.color.setHex(0x12040b); H.scene.fog.density = 0.052;
    H.ambient.color.setHex(0x3a1626); H.flash.color.setHex(0xdfe6ff);
    L.populate(20, 4, 3);
    UI.lightsInit(); UI.knife(false); UI.show(true); UI.ambStart();
    el.compass.hidden = true; el.siren.classList.remove('on'); el.locker.classList.remove('on');
    H.shake = 0; H.fear = 0; H.fovK = 0;
    H.state = 'l2'; H.show(null); el.hud.hidden = false; H.requestLock();
    el.fade.style.transition = 'none'; el.fade.style.background = first ? '#e8e4da' : '#000'; el.fade.style.opacity = 1;
    requestAnimationFrame(() => { el.fade.style.transition = 'opacity ' + (first ? 2.6 : 1.2) + 's'; el.fade.style.opacity = 0; });
    setTimeout(() => { if (S.active) el.fade.style.background = '#000'; }, 3000);
    if (first) UI.card('Ward 9', 'The door seals behind you. The air is warm, and it is breathing.', 4200);
    setTimeout(() => { if (H.state === 'l2') say('Search the cabinets for scrap metal and wire. Forge a blade. They are all awake.', 7000); }, first ? 4500 : 1500);
  }
  function begin(prevTime) { S.prevTime = prevTime || ''; H.sleepL1(); startRun(true); }
  function retry() { teardownWorld(); startRun(false); }
  function teardownWorld() {
    L.clearEnemies(); UI.lightsClear(); UI.knife(false); UI.ambStop(); UI.reset(); L.dispose(); L.boss.g = null;
    el.compass.hidden = true;
  }
  function teardown() {
    if (!S.active && !L.world) return;
    S.active = false; teardownWorld();
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
    const slow = (L.boss.st === 'flay' ? 0.4 : 1) * (S.searching ? 0.6 : 1);
    p.sprint = !!((keys.ShiftLeft || keys.ShiftRight) && wl > 0 && !p.exhausted && p.stamina > 0);
    const sp = (p.sprint ? 5.4 : 2.9) * slow;
    p.vx = lerp(p.vx, wx * sp, Math.min(1, 12 * dt)); p.vz = lerp(p.vz, wz * sp, Math.min(1, 12 * dt));
    const nx = p.x + p.vx * dt; if (!L.blocked(nx, p.z, 0.4)) p.x = nx; else p.vx = 0;
    const nz = p.z + p.vz * dt; if (!L.blocked(p.x, nz, 0.4)) p.z = nz; else p.vz = 0;
    const spd = Math.hypot(p.vx, p.vz); p.moving = spd > 0.6;
    if (p.sprint) { p.stamina = Math.max(0, p.stamina - 22 * dt); p.staDelay = 0.8; if (p.stamina <= 0) { p.exhausted = true; say('You are out of breath.', 2500); } }
    else { p.staDelay -= dt; if (p.staDelay <= 0) p.stamina = Math.min(100, p.stamina + 14 * dt); if (p.exhausted && p.stamina >= 25) p.exhausted = false; }
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
    if (!best && S.knife) for (const r of L.roots) {
      if (r.dead) continue; const dx = r.x - player.x, dz = r.z - player.z, d = Math.hypot(dx, dz);
      if (d < 3.2 && (d < 1.6 || (dx * fx + dz * fz) / d > 0.5)) { best = { kind: 'root', o: r }; break; }
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
    if (!canCraft()) { say('You need ' + NEED.metal + ' scrap metal and ' + NEED.wire + ' wire.', 2600); return; }
    if (S.crafting) return;
    S.crafting = true; S.craftT = 0; say('Forging the blade. Stay still. It is loud.', 3000);
  }
  function lootCab(c) {
    c.opened = true; const fr = c.mesh.userData.fronts[(Math.random() * 4) | 0]; fr.position.z += 0.3; fr.rotation.x = 0.15;
    switch (c.loot) {
      case 'metal': S.metal++; H.sfxPickup(); say('Scrap metal: a bent surgical tray (' + Math.min(S.metal, NEED.metal) + ' of ' + NEED.metal + ').', 3000); break;
      case 'wire': S.wire++; H.sfxPickup(); say('Wire, still bright (' + Math.min(S.wire, NEED.wire) + ' of ' + NEED.wire + ').', 3000); break;
      case 'medkit': S.hp = Math.min(100, S.hp + 40); H.sfxPickup(); say('Bandages and a half-empty bottle. +40 health.', 3000); break;
      case 'battery': flashlight.battery = Math.min(1, flashlight.battery + 0.5); H.sfxPickup(); say('Batteries. The flashlight steadies.', 2500); break;
      case 'trap': {
        say('Something was folded up inside.', 2500); H.sfxSting(false); H.shake = 1; H.flashFx('#400', 0.4, 0.6);
        for (let i = 0; i < 2; i++) { const e = L.spawnEnemy('patient', c.x + c.fx * (1 + i * 0.7), c.z + c.fz * (1 + i * 0.7)); e.st = 'chase'; e.atkT = 0.6; }
        break;
      }
      default: say('Empty. Someone got here first.', 2200);
    }
    if (canCraft()) say('That is enough. Press R to forge a blade.', 5000);
  }

  /* ---------- combat ---------- */
  function attack() {
    if (H.state !== 'l2') return;
    if (!S.knife) { if (L.t - S.noKnifeT > 4) { say('You have nothing to fight with. Run, or forge a blade.', 2500); S.noKnifeT = L.t; } return; }
    if (S.stabCd > 0) return;
    S.stabCd = 0.5; S.stabA = 1; H.noiseBurst({ type: 'bandpass', f: 1800, f2: 600, dur: 0.08, gain: 0.15 }); L.noise(8);
    if (!L.stab(player.x, player.z, player.yaw)) hitRoot();
  }
  function hitRoot() {
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw); let r = null;
    for (const q of L.roots) { if (q.dead) continue; const dx = q.x - player.x, dz = q.z - player.z, d = Math.hypot(dx, dz); if (d < 3.1 && (d < 1.6 || (dx * fx + dz * fz) / d > 0.5)) { r = q; break; } }
    if (!r) return;
    r.hp--; r.hitT = 0.3; L.noise(12); H.shake = Math.max(H.shake, 0.35);
    H.noiseBurst({ f: 500, f2: 120, dur: 0.3, gain: 0.55, pos: [r.x, 1.4, r.z], rev: 0.5 }); H.tone({ type: 'sawtooth', f: 650, f2: 180, dur: 0.4, gain: 0.2, pos: [r.x, 1.6, r.z], rev: 0.6 });
    L.blood(r.x + (player.x - r.x) * 0.3, 1.4, r.z + (player.z - r.z) * 0.3);
    if (r.hp === 7 || r.hp === 4 || r.hp === 1) { mob(r, 3); say('The ward answers.', 2000); }
    if (r.hp <= 0) sever(r);
  }
  function mob(r, n) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 40; k++) {
        const t = pick(L.open), x = t[0] * T, z = t[1] * T, d = Math.hypot(x - r.x, z - r.z);
        if (d < 7 || d > 15 || Math.hypot(x - player.x, z - player.z) < 8) continue;
        L.spawnEnemy(Math.random() < 0.25 ? 'howler' : 'patient', x, z); break;
      }
    }
    L.alertAt(player.x, player.z, 70);
  }
  function sever(r) {
    r.dead = true; S.roots++; L.rootsCut = S.roots; H.shake = 1; H.flashFx('#ff2030', 0.5, 0.8);
    H.noiseBurst({ dur: 1.4, f: 300, f2: 30, gain: 0.9, pos: [r.x, 1, r.z], rev: 0.8 }); H.tone({ f: 60, f2: 25, dur: 1.6, gain: 0.8 });
    say('Heart ' + S.roots + ' of 3 cut. The whole ward screams.', 4000);
    mob(r, 4);
    if (S.roots >= 3) { openRift(); L.boss.summon(true); } else if (Math.random() < 0.5) L.boss.summon(true);
  }
  function openRift() {
    const x = L.exitObj; x.open = true; x.disc.material.opacity = 0.95; x.light.intensity = 3.4; x.ring.material.emissive.setHex(0x4fa8ff);
    H.sfxSting(true); H.shake = 1; setTimeout(() => say('The way out has opened. RUN.', 6000), 1200);
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
      const lines = { lurcher: 'It hit like a collapsing wall.', howler: 'The howling stopped. That is how you knew.', patient: 'They were patients once. They remember being held down.' };
      document.getElementById('deadline').textContent = S.killer === L.boss ? 'The Keeper took what it came for.' : (lines[k] || 'Ward 9 keeps what it finds.');
      document.getElementById('deadstat').textContent = 'Hearts cut: ' + S.roots + ' of 3  /  Time in Ward 9: ' + H.fmt(performance.now() - S.start);
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
      document.getElementById('winstat').textContent = 'Ward 7: ' + S.prevTime + '  /  Ward 9: ' + H.fmt(performance.now() - S.start) + '  /  Patients put down: ' + S.kills + (S.bossKills ? '  /  Keeper felled: ' + S.bossKills : '');
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
        S.spawnT = Math.max(6, 15 - S.roots * 3) + rnd(0, 4);
        if (L.liveCount() < 26 + S.roots * 6) { const r = Math.random(), s = L.farSpot(14); if (s) L.spawnEnemy(r < 0.07 ? 'lurcher' : r < 0.27 ? 'howler' : 'patient', s[0], s[1]); }
      }
      if (L.exitObj && L.exitObj.open && Math.hypot(player.x - L.exitObj.x, player.z - L.exitObj.z) < 2.0) win();
    }
    L.updateEnemies(dt, alive); L.boss.update(dt, alive);
    if (st === 'l2dying') dyingStep(dt);
    roots(dt); rift(dt);
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
  function roots(dt) {
    for (const r of L.roots) {
      const u = r.g.userData; r.hitT = Math.max(0, r.hitT - dt);
      if (!r.dead) {
        u.core.scale.setScalar(1 + Math.sin(L.t * 3 + r.ph) * 0.12 + (r.hitT > 0 ? 0.45 : 0));
        u.light.intensity = (2.0 + Math.sin(L.t * 3 + r.ph) * 0.5 + (r.hitT > 0 ? 2 : 0)) * H.bright; u.halo.material.opacity = 0.6 + Math.sin(L.t * 3 + r.ph) * 0.2;
        r.g.rotation.z = r.hitT > 0 ? Math.sin(L.t * 60) * 0.02 : 0;
      } else {
        r.g.scale.y = Math.max(0.12, r.g.scale.y - dt * 0.8); u.light.intensity = 0; u.coreMat.color.setHex(0x1a0508); u.halo.visible = false; u.flesh.emissive.setHex(0x080204);
      }
    }
  }
  function rift(dt) {
    const x = L.exitObj; if (!x || !x.open) return;
    x.disc.rotation.z += dt * 0.9; x.g.rotation.y = Math.atan2(player.x - x.x, player.z - x.z);
    x.light.intensity = (3 + Math.sin(L.t * 7) * 0.6 + (Math.random() < 0.05 ? -1.5 : 0)) * H.bright;
  }
  function hudText(alive) {
    let g, p = '';
    if (!S.knife) g = canCraft() ? 'You have enough. Press R and hold still to forge the blade.' : 'Search the cabinets along the walls. Scrap metal ' + Math.min(S.metal, NEED.metal) + '/' + NEED.metal + ', wire ' + Math.min(S.wire, NEED.wire) + '/' + NEED.wire + '.';
    else if (S.roots < 3) g = 'Cut out the three hearts that feed the ward. Follow the arrow.';
    else g = 'The rift is open. RUN.';
    UI.goal(g);
    if (alive) {
      const t = target();
      if (S.searching) p = 'searching...';
      else if (S.crafting) p = 'forging... ' + Math.round(S.craftT / CRAFT_TIME * 100) + '%';
      else if (t && t.kind === 'cab') p = '<kbd>E</kbd> search cabinet';
      else if (t && t.kind === 'root') p = '<kbd>Click</kbd> cut the heart';
      else if (canCraft()) p = '<kbd>R</kbd> forge the blade';
    }
    if (p !== lastPrompt) { el.prompt.innerHTML = p; lastPrompt = p; }
    /* compass: nearest living heart, then the rift */
    let tx = null, tz = null, label = '';
    if (S.roots >= 3 && L.exitObj) { tx = L.exitObj.x; tz = L.exitObj.z; label = 'exit'; }
    else if (S.knife) { let bd = 1e9; for (const r of L.roots) if (!r.dead) { const d = Math.hypot(r.x - player.x, r.z - player.z); if (d < bd) { bd = d; tx = r.x; tz = r.z; label = 'heart'; } } }
    if (tx != null && alive) {
      el.compass.hidden = false; if (el.compass.lastChild && el.compass.lastChild.nodeValue !== label) el.compass.lastChild.nodeValue = label;
      const dx = tx - player.x, dz = tz - player.z, fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      el.arrow.style.transform = 'rotate(' + Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz) + 'rad)';
    } else el.compass.hidden = true;
  }

  el.canvas.addEventListener('mousedown', (e) => { if (e.button === 0) attack(); });
  H.l2 = L.api = { begin: begin, step: step, key: key, retry: retry, teardown: teardown, get active() { return S.active; } };
})();
