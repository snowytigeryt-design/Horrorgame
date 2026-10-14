'use strict';
/* LEVEL 2, part C: The Keeper (the boss). Announced by clock chimes, it sometimes manifests and hunts you.
   Mind flay: if it can see you it drags you toward it and drains you. Break line of sight, or stab it to interrupt. */
(function () {
  const H = window.HW, L = window.HW2;
  if (!H || !L || !L.updateEnemies) return;
  const THREE = H.THREE, rnd = H.rnd, pick = H.pick, clamp = H.clamp, N = L.N, T = L.T;
  const B = (L.boss = { st: 'idle', x: 0, z: 0, yaw: 0, hp: 0, max: 18, kills: 0, next: 80, stag: 0, flayT: 0, flayCd: 3, atkT: 0, wind: 0, blinkT: 12, chimeT: 0, walk: 0, tick: 0, life: 0, flayK: 0, fade: 0, flicker: 0, g: null });
  const U = {};

  /* ---------- model ---------- */
  B.init = function () {
    const mk = (c, e, r) => new THREE.MeshStandardMaterial({ color: c, emissive: e || 0x000000, roughness: r == null ? 0.8 : r });
    const body = mk(0x2c1c22, 0x1a0606), coat = mk(0x16090d, 0x0a0204, 1), bone = mk(0xb9a89a, 0x2a0e08, 0.7);
    coat.side = THREE.DoubleSide;
    const fire = new THREE.MeshBasicMaterial({ color: 0xff5a24 }), vine = mk(0x2a0c18, 0x3a0a0e, 0.6);
    const g = new THREE.Group();
    const add = (geo, mat, p, par) => { const m = new THREE.Mesh(geo, mat); m.position.set(p[0], p[1], p[2]); (par || g).add(m); return m; };
    const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.17, 1.7, 0); legR.position.set(0.17, 1.7, 0); g.add(legL); g.add(legR);
    for (const l of [legL, legR]) { const m = add(new THREE.CylinderGeometry(0.07, 0.05, 1.75, 6), body, [0, -0.87, 0], l); }
    const torso = new THREE.Group(); torso.position.y = 1.7; g.add(torso);
    add(new THREE.BoxGeometry(0.55, 1.2, 0.3), body, [0, 0.62, 0], torso);
    add(new THREE.ConeGeometry(0.62, 2.1, 9, 1, true), coat, [0, -0.2, 0], torso).scale.set(1, 1, 0.8);
    for (let i = 0; i < 12; i++) { const f = add(new THREE.BoxGeometry(0.02, rnd(0.15, 0.5), 0.02), fire, [rnd(-0.2, 0.2), rnd(0.2, 1.1), 0.16], torso); f.rotation.z = rnd(-0.8, 0.8); }
    const core = add(new THREE.SphereGeometry(0.1, 10, 8), fire, [0, 0.8, 0.17], torso);
    const mkArm = (sx) => {
      const a = new THREE.Group(); a.position.set(sx * 0.36, 1.15, 0); torso.add(a);
      add(new THREE.CylinderGeometry(0.045, 0.035, 1.5, 6), body, [0, -0.75, 0], a);
      const hand = new THREE.Group(); hand.position.y = -1.5; a.add(hand);
      for (let k = -1; k <= 1; k++) { const f = add(new THREE.CylinderGeometry(0.012, 0.006, 0.55, 4), bone, [k * 0.045, -0.27, 0], hand); f.rotation.z = k * 0.12; }
      return a;
    };
    const armL = mkArm(-1), armR = mkArm(1);
    const head = new THREE.Group(); head.position.y = 1.55; torso.add(head);
    const skull = add(new THREE.SphereGeometry(1, 12, 10), bone, [0, 0.2, 0], head); skull.scale.set(0.19, 0.3, 0.2);
    add(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }), [0, 0.14, 0.17], head).scale.set(0.06, 0.04, 0.03);
    for (const sx of [-1, 1]) {
      add(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }), [sx * 0.075, 0.27, 0.15], head).scale.set(0.055, 0.075, 0.04);
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.TEX.glow, color: 0xff3a14, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95, fog: false }));
      eye.scale.set(0.3, 0.3, 1); eye.position.set(sx * 0.075, 0.27, 0.19); head.add(eye);
    }
    for (let i = 0; i < 7; i++) { /* crown of thorns */
      const a = (i / 7) * Math.PI - Math.PI / 2, t = add(new THREE.ConeGeometry(0.025, rnd(0.3, 0.55), 5), bone, [Math.sin(a) * 0.16, 0.5, -0.02], head);
      t.rotation.z = -Math.sin(a) * 0.7; t.rotation.x = rnd(-0.3, 0.1);
    }
    const vines = new THREE.Group(); vines.position.y = 1.7; g.add(vines);
    for (let i = 0; i < 12; i++) {
      const a = rnd(0, 6.28), r = rnd(0.25, 0.5), c = new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 0.2, rnd(0.3, 1.5), Math.sin(a) * 0.2), new THREE.Vector3(Math.cos(a) * r, rnd(-0.4, 0.8), Math.sin(a) * r - 0.2), new THREE.Vector3(Math.cos(a) * rnd(0.6, 1.3), rnd(-1.8, -0.8), Math.sin(a) * rnd(0.6, 1.3) - 0.3)]);
      add(new THREE.TubeGeometry(c, 10, rnd(0.015, 0.04), 5, false), vine, [0, 0, 0], vines);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.TEX.glow, color: 0xff3010, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, fog: false }));
    halo.scale.set(5, 6, 1); halo.position.y = 2.6; g.add(halo);
    const light = new THREE.PointLight(0xff4a2a, 0, 18, 2); light.position.y = 2.6; g.add(light);
    g.visible = false; L.world.add(g);
    Object.assign(U, { legL: legL, legR: legR, torso: torso, armL: armL, armR: armR, head: head, vines: vines, halo: halo, light: light, core: core });
    B.g = g; B.reset();
  };
  B.reset = function () {
    B.st = 'idle'; B.next = rnd(70, 95); B.kills = 0; B.max = 18; B.flayK = 0; B.flicker = 0; B.fade = 0;
    if (B.g) B.g.visible = false; if (U.light) U.light.intensity = 0;
  };

  /* ---------- sound ---------- */
  function bell(f, g, pos) {
    const o = pos ? { pos: pos, rev: 1 } : { rev: 1 };
    H.tone(Object.assign({ f: f, dur: 4.2, gain: g, atk: 0.004 }, o)); H.tone(Object.assign({ f: f * 2.01, dur: 2.6, gain: g * 0.5, atk: 0.004 }, o));
    H.tone(Object.assign({ f: f * 2.76, dur: 1.8, gain: g * 0.35, atk: 0.004 }, o)); H.tone(Object.assign({ f: f * 5.4, dur: 0.8, gain: g * 0.2, atk: 0.004 }, o));
  }
  L.bell = bell;

  /* ---------- summoning ---------- */
  B.summon = function (force) {
    if (B.st !== 'idle') return;
    B.st = 'chime'; B.chimeT = 0; B.chimes = 0; B.flicker = 5;
    H.say(force ? 'The clock strikes. It is not finished with you.' : 'A clock chimes somewhere. Something heard the knife.', 4200);
  };
  function manifest() {
    const s = L.farSpot(14) || L.farSpot(0);
    if (!s) { B.st = 'idle'; B.next = 20; return; }
    B.x = s[0]; B.z = s[1]; B.yaw = 0; B.hp = B.max; B.st = 'hunt'; B.life = 0; B.stag = 0; B.flayT = 0; B.flayCd = 3; B.blinkT = rnd(9, 13); B.wind = 0; B.atkT = 1;
    B.g.visible = true; B.g.scale.setScalar(1); B.fade = 0; B.g.rotation.x = 0;
    H.noiseBurst({ dur: 1.2, f: 200, f2: 40, gain: 0.7, pos: [B.x, 1, B.z], rev: 0.8 });
    H.tone({ type: 'sawtooth', f: 90, f2: 40, dur: 1.6, gain: 0.5, pos: [B.x, 1.6, B.z], rev: 0.7 });
    H.say('The Keeper has come.', 3500);
  }

  /* ---------- player hits it ---------- */
  B.hit = function (px, pz, fx, fz) {
    if (B.st !== 'hunt' && B.st !== 'flay' && B.st !== 'stagger') return false;
    const dx = B.x - px, dz = B.z - pz, d = Math.hypot(dx, dz);
    if (d > 2.7) return false;
    if (d > 0.8 && (dx * fx + dz * fz) / d < 0.45) return false;
    B.hp -= 1; B.stag = 0.8; B.st = 'stagger'; B.flayT = 0; B.flayCd = 4; B.wind = 0;
    const nx = B.x + dx / Math.max(d, 0.1) * 0.5, nz = B.z + dz / Math.max(d, 0.1) * 0.5;
    if (!L.blocked(nx, B.z, 0.5)) B.x = nx; if (!L.blocked(B.x, nz, 0.5)) B.z = nz;
    H.sfxRip([B.x, 1.6, B.z]); L.blood(B.x, 1.6, B.z);
    H.tone({ type: 'sawtooth', f: 220, f2: 70, dur: 0.7, gain: 0.35, pos: [B.x, 1.8, B.z], rev: 0.6 });
    if (B.hp <= 0) { B.st = 'dying'; B.life = 0; H.sfxBruteRoar([B.x, 1.8, B.z]); H.say('The Keeper falls to its knees.', 3500); L.onBossKill && L.onBossKill(); }
    return true;
  };

  /* ---------- per frame ---------- */
  B.update = function (dt, alive) {
    const p = H.player;
    B.flayK += ((B.st === 'flay' ? 1 : 0) - B.flayK) * Math.min(1, 5 * dt);
    if (B.flicker > 0) B.flicker -= dt;
    if (B.st === 'idle') {
      if (L.t > 0) B.next -= dt;
      if (B.next <= 0) { if (Math.random() < 0.6 && alive) B.summon(false); else B.next = rnd(35, 60); }
      return;
    }
    if (B.st === 'chime') {
      B.chimeT += dt;
      if (B.chimes < 4 && B.chimeT > B.chimes * 1.35) { bell(B.chimes === 3 ? 147 : 196, 0.32); B.chimes++; H.shake = Math.max(H.shake, 0.3); }
      if (B.chimeT > 5.6) manifest();
      return;
    }
    const dx = p.x - B.x, dz = p.z - B.z, d = Math.hypot(dx, dz);
    const los = alive && L.los(B.x, B.z, p.x, p.z);
    B.life += dt;
    if (B.st === 'dying') {
      B.g.rotation.x = -Math.min(1.5, B.life * 0.6); B.g.position.y = -Math.min(0.5, B.life * 0.2); B.fade = Math.max(0, 1 - B.life / 4);
      U.light.intensity = 2 * B.fade;
      if (B.life > 4.5) { B.g.visible = false; B.g.rotation.x = 0; B.g.position.y = 0; B.st = 'idle'; B.kills++; B.max += 4; B.next = rnd(150, 200); U.light.intensity = 0; }
      return;
    }
    if (B.st === 'withdraw') {
      B.fade = Math.max(0, B.fade - dt * 0.5); B.g.scale.setScalar(0.4 + 0.6 * B.fade); U.light.intensity = 2 * B.fade;
      if (B.fade <= 0) { B.g.visible = false; B.st = 'idle'; B.next = rnd(60, 90); }
      return;
    }
    B.fade = Math.min(1, B.fade + dt * 1.2); U.light.intensity = (1.8 + Math.sin(L.t * 9) * 0.3) * B.fade;
    B.g.scale.setScalar(1);
    let moving = false;
    if (B.st === 'stagger') { B.stag -= dt; if (B.stag <= 0) B.st = 'hunt'; }
    else if (alive) {
      B.flayCd -= dt; B.atkT -= dt;
      if (B.st === 'flay') {
        B.flayT += dt;
        if (!los || d > 17 || B.flayT > 6) { B.st = 'hunt'; B.flayCd = rnd(4, 6); B.flayT = 0; }
        else if (d < 2.1 && B.wind <= 0 && B.atkT <= 0) B.wind = 0.5;
        if (B.wind > 0) { B.wind -= dt; if (B.wind <= 0) { B.atkT = 1.8; if (d < 2.6 && L.hurt) L.hurt(36, B); } }
      } else {
        if (los && d < 15 && B.flayCd <= 0) { B.st = 'flay'; B.flayT = 0; H.sfxScreech([B.x, 2, B.z]); H.say('It is looking at you. Break its sight!', 2800); }
        else {
          const sp = 2.7 + 0.15 * Math.min(3, L.rootsCut || 0);
          if (d < 2.0 && B.atkT <= 0 && B.wind <= 0) B.wind = 0.5;
          if (B.wind > 0) { B.wind -= dt; if (B.wind <= 0) { B.atkT = 1.8; if (d < 2.6 && L.hurt) L.hurt(36, B); } }
          else if (d > 1.6) {
            const tile = [L.toTile(B.x), L.toTile(B.z)];
            let tx = p.x, tz = p.z;
            if (!(los && d < 9)) { const nx = L.flow(L.pdm, tile[0], tile[1]); if (nx) { tx = nx[0]; tz = nx[1]; } }
            const ddx = tx - B.x, ddz = tz - B.z, dd = Math.hypot(ddx, ddz) || 1, s = Math.min(sp * dt, dd);
            const mx = ddx / dd * s, mz = ddz / dd * s;
            if (!L.blocked(B.x + mx, B.z, 0.45)) B.x += mx; if (!L.blocked(B.x, B.z + mz, 0.45)) B.z += mz;
            B.yaw = H.angLerp(B.yaw, Math.atan2(ddx, ddz), Math.min(1, 6 * dt)); moving = true;
          }
          /* it blinks closer when it has lost you */
          B.blinkT -= dt;
          if (B.blinkT <= 0 && !los && d > 15) {
            B.blinkT = rnd(11, 15); let x = L.toTile(B.x), z = L.toTile(B.z);
            for (let i = 0; i < 9; i++) { const nx = L.flow(L.pdm, x, z); if (!nx) break; x = L.toTile(nx[0]); z = L.toTile(nx[1]); }
            B.x = x * T; B.z = z * T; bell(262, 0.18, [B.x, 2, B.z]); B.flicker = 1.2;
            H.noiseBurst({ type: 'highpass', f: 3000, dur: 0.5, gain: 0.3 });
          }
        }
      }
    }
    if (B.st === 'flay') B.yaw = H.angLerp(B.yaw, Math.atan2(dx, dz), Math.min(1, 8 * dt));
    if (B.life > 85 && B.st === 'hunt' && d > 20) { B.st = 'withdraw'; H.say('The presence recedes.', 3000); }
    /* ticking clock, louder the nearer it is */
    B.tick -= dt;
    if (B.tick <= 0) { B.tick = 1; if (d < 34) H.noiseBurst({ type: 'bandpass', f: 3600, q: 12, dur: 0.05, gain: 0.5 * clamp(1 - d / 34, 0.1, 1), pos: [B.x, 1.8, B.z] }); }
    B.walk += dt * (moving ? 5 : 0);
    if (moving) { B.stepT = (B.stepT || 0) + dt * 1.6; if (B.stepT >= 1) { B.stepT = 0; H.tone({ f: 42, f2: 28, dur: 0.4, gain: 0.8, pos: [B.x, 0.2, B.z], rev: 0.5 }); H.noiseBurst({ dur: 0.2, f: 240, gain: 0.5, pos: [B.x, 0.2, B.z] }); } }
    /* pose */
    const sw = Math.sin(B.walk), flay = B.st === 'flay';
    B.g.position.set(B.x, B.g.position.y, B.z); B.g.rotation.y = B.yaw;
    U.legL.rotation.x = sw * 0.5; U.legR.rotation.x = -sw * 0.5;
    const up = flay ? -2.0 : (B.wind > 0 ? -2.3 : -0.1), tw = flay ? Math.sin(L.t * 25) * 0.05 : 0;
    U.armL.rotation.x = up + tw + (flay ? 0 : -sw * 0.15); U.armR.rotation.x = up - tw + (flay ? 0 : sw * 0.15);
    U.armL.rotation.z = flay ? 0.5 : 0.08; U.armR.rotation.z = flay ? -0.5 : -0.08;
    U.torso.rotation.x = flay ? -0.15 : 0.08 + (B.wind > 0 ? 0.3 : 0); U.head.rotation.z = Math.sin(L.t * 1.2) * 0.12; U.head.rotation.x = flay ? -0.3 : 0.1;
    U.vines.rotation.y = Math.sin(L.t * 0.8) * 0.2; U.halo.material.opacity = (flay ? 0.65 : 0.3) * B.fade;
    U.core.scale.setScalar(1 + Math.sin(L.t * 6) * 0.25);
  };

  /* what the flay does to the player: slow, drag, turn, drain */
  B.affectPlayer = function (dt) {
    if (B.st !== 'flay') return 0;
    const p = H.player, dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (d > 2.0) { const mx = dx / d * 1.5 * dt, mz = dz / d * 1.5 * dt; if (!L.blocked(p.x + mx, p.z, 0.4)) p.x += mx; if (!L.blocked(p.x, p.z + mz, 0.4)) p.z += mz; }
    p.yaw = H.angLerp(p.yaw, Math.atan2(-dx, -dz), Math.min(1, 1.6 * dt));
    H.shake = Math.max(H.shake, 0.45);
    return 5; /* damage per second */
  };
})();
