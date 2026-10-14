'use strict';
/* LEVEL 2, part B: "The Unwell". The patients who never got out. Three kinds, all new (none are level 1 monsters).
   patient: shambling, takes 3 stabs.  howler: frail but fast, its scream calls everyone.  lurcher: huge, slow, hits like a truck. */
(function () {
  const H = window.HW, L = window.HW2;
  if (!H || !L || !L.build) return;
  const THREE = H.THREE, rnd = H.rnd, pick = H.pick, clamp = H.clamp, T = L.T, N = L.N;
  const KINDS = {
    patient: { hp: 3, wander: 1.1, chase: 3.5, dmg: 14, reach: 1.3, cd: 1.0, sight: 15, size: 1.0 },
    howler: { hp: 1, wander: 1.5, chase: 4.3, dmg: 9, reach: 1.2, cd: 0.85, sight: 20, size: 1.05 },
    lurcher: { hp: 7, wander: 0.9, chase: 3.0, dmg: 30, reach: 1.7, cd: 1.5, sight: 13, size: 1.5 }
  };
  L.KINDS = KINDS; L.enemies = []; L.noiseR = 0; L.pdm = new Int16Array(N * N); L.pdmTile = -1; L.alertInfo = null;

  /* ---------- look ---------- */
  let ET = null;
  function etex() {
    if (ET) return ET;
    const skin = H.mkCanvas(128, 128), g = skin.getContext('2d');
    g.fillStyle = '#8f9a8c'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '60,70,60' : '150,110,110') + ',' + (0.1 + Math.random() * 0.25) + ')'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 14, 0, 6.3); g.fill(); }
    g.strokeStyle = 'rgba(70,20,40,.55)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { g.beginPath(); let x = Math.random() * 128, y = Math.random() * 128; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 24; y += (Math.random() - 0.5) * 24; g.lineTo(x, y); } g.stroke(); }
    H.speckle(g, 128, 128, 500, 0.25);
    const gown = H.mkCanvas(128, 128), q = gown.getContext('2d');
    q.fillStyle = '#c9c4b2'; q.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) { const x = Math.random() * 128, y = Math.random() * 128, r = 6 + Math.random() * 26, gr = q.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < 0.6 ? 'rgba(120,20,20,.55)' : 'rgba(70,55,30,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.fillRect(x - r, y - r, 2 * r, 2 * r); }
    q.strokeStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 128; y += 8) { q.beginPath(); q.moveTo(0, y); q.lineTo(128, y); q.stroke(); }
    ET = {
      skin: new THREE.MeshStandardMaterial({ map: H.mkTex(skin, 1, 1), roughness: 0.85 }),
      gown: new THREE.MeshStandardMaterial({ map: H.mkTex(gown, 1, 1), roughness: 0.95, side: THREE.DoubleSide }),
      belt: new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.8 }),
      sack: new THREE.MeshStandardMaterial({ color: 0x6b5638, roughness: 1 }),
      apron: new THREE.MeshStandardMaterial({ color: 0x4a1612, roughness: 0.9 }),
      black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x777c80, metalness: 0.7, roughness: 0.5 }),
      band: new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 1 }),
      geo: {
        box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 12, 10),
        cyl: new THREE.CylinderGeometry(1, 1, 1, 8), tor: new THREE.TorusGeometry(1, 0.2, 6, 14)
      }
    };
    return ET;
  }
  const part = (geo, mat, sx, sy, sz, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = false; if (parent) parent.add(m); return m; };
  const limb = (len, r, mat) => { const p = new THREE.Group(); part(etex().geo.cyl, mat, r, len, r, 0, -len / 2, 0, p); return p; };

  function makeBody(kind) {
    const E = etex(), G = E.geo, g = new THREE.Group(), K = KINDS[kind], s = K.size;
    const body = new THREE.Group(); g.add(body);
    const tall = kind === 'howler' ? 1.12 : 1;
    const legL = limb(0.8 * tall, 0.075 * s, E.skin), legR = limb(0.8 * tall, 0.075 * s, E.skin);
    legL.position.set(-0.13 * s, 0.82 * tall, 0); legR.position.set(0.13 * s, 0.82 * tall, 0); body.add(legL); body.add(legR);
    const torso = new THREE.Group(); torso.position.y = 0.82 * tall; body.add(torso);
    let armL, armR;
    if (kind === 'lurcher') {
      part(G.box, E.gown, 0.78, 0.8, 0.46, 0, 0.5, 0, torso);
      part(G.box, E.apron, 0.7, 0.85, 0.08, 0, 0.45, 0.25, torso);
      armL = limb(0.85, 0.12, E.skin); armR = limb(0.85, 0.12, E.skin); armL.position.set(-0.5, 0.82, 0); armR.position.set(0.5, 0.82, 0); torso.add(armL); torso.add(armR);
      const pipe = part(G.cyl, E.steel, 0.045, 1.2, 0.045, 0, -0.75, 0.1, armR); pipe.rotation.x = 1.2;
      const head = new THREE.Group(); head.position.y = 1.0; torso.add(head);
      part(G.sph, E.sack, 0.25, 0.3, 0.26, 0, 0.1, 0, head);
      part(G.box, E.black, 0.02, 0.1, 0.02, 0, 0.0, 0.26, head); part(G.box, E.black, 0.1, 0.02, 0.02, 0, 0.0, 0.26, head);
      part(G.sph, E.black, 0.05, 0.04, 0.03, -0.09, 0.15, 0.23, head); part(G.sph, E.black, 0.05, 0.04, 0.03, 0.09, 0.15, 0.23, head);
      g.userData = { legL, legR, armL, armR, head, torso, eyeY: 2.1 };
    } else {
      const jacket = kind === 'patient' && Math.random() < 0.5;
      part(G.box, E.gown, 0.46 * s, 0.7 * tall, 0.26 * s, 0, 0.5 * tall, 0, torso);
      part(G.cyl, E.gown, 0.2 * s, 0.5, 0.26 * s, 0, 0.1, 0, torso);
      armL = limb(0.7 * tall, 0.05 * s, E.skin); armR = limb(0.7 * tall, 0.05 * s, E.skin);
      armL.position.set(-0.28 * s, 0.82 * tall, 0); armR.position.set(0.28 * s, 0.82 * tall, 0); torso.add(armL); torso.add(armR);
      if (jacket) {
        part(G.box, E.gown, 0.56 * s, 0.2, 0.2, 0, 0.55, 0.2, torso);
        for (const y of [0.5, 0.62]) part(G.box, E.belt, 0.6 * s, 0.035, 0.24, 0, y, 0.2, torso);
        armL.visible = armR.visible = false; g.userData.jacket = true;
      }
      const head = new THREE.Group(); head.position.y = 1.0 * tall; torso.add(head);
      part(G.sph, E.skin, 0.16, 0.2, 0.17, 0, 0.12, 0, head);
      if (kind === 'howler') { part(G.sph, E.black, 0.09, 0.16, 0.06, 0, 0.0, 0.14, head); head.rotation.x = -0.5; }
      else { part(G.sph, E.black, 0.05, 0.03, 0.02, 0, 0.0, 0.16, head); const b = part(G.tor, E.band, 0.17, 0.17, 0.17, 0, 0.17, 0, head); b.rotation.x = Math.PI / 2 + 0.2; }
      part(G.sph, E.black, 0.04, 0.05, 0.03, -0.065, 0.14, 0.15, head); part(G.sph, E.black, 0.04, 0.05, 0.03, 0.065, 0.14, 0.15, head);
      g.userData = Object.assign(g.userData || {}, { legL, legR, armL, armR, head, torso, eyeY: 1.75 * tall });
    }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.TEX.glow, color: kind === 'howler' ? 0xffe9a0 : 0xdfe8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, fog: false }));
    gl.scale.set(0.45 * s, 0.45 * s, 1); gl.position.set(0, g.userData.eyeY, 0.12); g.add(gl); g.userData.glow = gl;
    return g;
  }

  /* ---------- spawn / clear ---------- */
  L.spawnEnemy = function (kind, x, z) {
    const K = KINDS[kind], g = makeBody(kind);
    g.position.set(x, 0, z); L.world.add(g);
    const e = { kind: kind, K: K, g: g, x: x, z: z, hp: K.hp, st: 'wander', yaw: rnd(0, 6.28), head: rnd(0, 6.28), turnT: rnd(1, 4), atkT: 0, wind: 0, stag: 0, ph: rnd(0, 9), dead: 0, scream: 0, walk: 0, lostT: 0, stepT: 0 };
    L.enemies.push(e); return e;
  };
  L.clearEnemies = function () { for (const e of L.enemies) { if (e.g.parent) e.g.parent.remove(e.g); } L.enemies.length = 0; };
  L.liveCount = () => L.enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);
  L.noise = function (r) { if (r > L.noiseR) L.noiseR = r; };
  L.alertAt = function (x, z, range) {
    const tx = L.toTile(x), tz = L.toTile(z);
    L.alertInfo = { x: x, z: z, t: 14, dm: L.distMap(tx, tz, new Int16Array(N * N)) };
    for (const e of L.enemies) if (!e.dead && e.st === 'wander' && Math.hypot(e.x - x, e.z - z) < range) { e.st = 'alert'; e.lostT = 0; }
  };
  /* where to put a newcomer: far from the player along the corridors, not in view */
  L.farSpot = function (minD) {
    for (let i = 0; i < 60; i++) {
      const t = pick(L.open), d = L.pdm[t[1] * N + t[0]];
      if (d < minD) continue;
      const x = t[0] * T, z = t[1] * T;
      if (Math.hypot(x - H.player.x, z - H.player.z) < 16) continue;
      if (L.los(x, z, H.player.x, H.player.z) && Math.hypot(x - H.player.x, z - H.player.z) < 30) continue;
      return [x, z];
    }
    return null;
  };
  L.populate = function (nP, nH, nL) {
    L.refreshPdm(true);
    const mk = (kind, n) => { for (let i = 0; i < n; i++) { const s = L.farSpot(12); if (s) L.spawnEnemy(kind, s[0], s[1]); } };
    mk('patient', nP); mk('howler', nH); mk('lurcher', nL);
  };
  L.refreshPdm = function (force) {
    const p = H.player, tx = clamp(L.toTile(p.x), 0, N - 1), tz = clamp(L.toTile(p.z), 0, N - 1), id = tz * N + tx;
    if (!force && id === L.pdmTile) return;
    L.pdmTile = id; L.distMap(tx, tz, L.pdm);
  };

  /* ---------- combat on the enemy side ---------- */
  L.stab = function (px, pz, yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let hit = false;
    if (L.boss && L.boss.hit && L.boss.hit(px, pz, fx, fz)) return true;
    for (const e of L.enemies) {
      if (e.dead) continue;
      const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz);
      if (d > 2.25 + (e.kind === 'lurcher' ? 0.4 : 0)) continue;
      if (d > 0.7 && (dx * fx + dz * fz) / d < 0.5) continue;
      if (!L.los(px, pz, e.x, e.z)) continue;
      hit = true; e.hp -= 1; e.stag = e.kind === 'lurcher' ? 0.25 : 0.5; e.wind = 0;
      const k = e.kind === 'lurcher' ? 0.35 : 0.9; /* knockback */
      const nx = e.x + dx / Math.max(d, 0.1) * k, nz = e.z + dz / Math.max(d, 0.1) * k;
      if (!L.blocked(nx, e.z, 0.32)) e.x = nx; if (!L.blocked(e.x, nz, 0.32)) e.z = nz;
      if (e.st !== 'chase') { e.st = 'chase'; e.lostT = 0; }
      H.sfxRip([e.x, 1.2, e.z]);
      L.blood(e.x, 1.2, e.z);
      if (e.hp <= 0) { e.dead = 0.001; L.onKill && L.onKill(e); }
      break; /* one target per swing */
    }
    return hit;
  };
  /* small spray of dark droplets */
  const drops = [];
  L.blood = function (x, y, z) {
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(ET.geo.sph, new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x5a0a10 : 0x2a0408 }));
      m.scale.setScalar(rnd(0.025, 0.05)); m.position.set(x, y, z); L.world.add(m);
      drops.push({ m: m, vx: rnd(-1.8, 1.8), vy: rnd(0.5, 2.6), vz: rnd(-1.8, 1.8), t: 0 });
    }
  };
  function dropsTick(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.t += dt; d.vy -= 9 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
      if (d.m.position.y < 0.02 || d.t > 1.4) { if (d.m.parent) d.m.parent.remove(d.m); d.m.material.dispose(); drops.splice(i, 1); }
    }
  }

  /* ---------- per frame ---------- */
  function sees(e, p, d) {
    const K = e.K, range = K.sight + (H.flashlight.on ? 5 : -3) + (p.sprint ? 4 : 0);
    if (d > range) return false;
    if (d > 5) { const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw); if (((p.x - e.x) * fx + (p.z - e.z) * fz) / d < -0.25) return false; }
    return L.los(e.x, e.z, p.x, p.z);
  }
  function move(e, dx, dz, sp, dt) {
    const d = Math.hypot(dx, dz); if (d < 0.01) return false;
    const s = Math.min(sp * dt, d), mx = dx / d * s, mz = dz / d * s;
    let moved = false;
    if (!L.blocked(e.x + mx, e.z, 0.32)) { e.x += mx; moved = true; }
    if (!L.blocked(e.x, e.z + mz, 0.32)) { e.z += mz; moved = true; }
    e.yaw = H.angLerp(e.yaw, Math.atan2(dx, dz), Math.min(1, 9 * dt));
    return moved;
  }
  L.updateEnemies = function (dt, alive) {
    const p = H.player;
    dropsTick(dt);
    L.noiseR = Math.max(0, L.noiseR - dt * 14);
    if (L.alertInfo) { L.alertInfo.t -= dt; if (L.alertInfo.t <= 0) L.alertInfo = null; }
    L.refreshPdm(false);
    for (let i = L.enemies.length - 1; i >= 0; i--) {
      const e = L.enemies[i], K = e.K, g = e.g, u = g.userData;
      if (e.dead) {
        e.dead += dt;
        g.rotation.x = -Math.min(1.5, e.dead * 5); g.position.y = Math.min(0.2, e.dead * 0.6);
        u.glow.visible = false;
        if (e.dead > 9) { if (g.parent) g.parent.remove(g); L.enemies.splice(i, 1); }
        continue;
      }
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
      let moving = false, sp = 0;
      e.atkT = Math.max(0, e.atkT - dt);
      if (e.stag > 0) { e.stag -= dt; }
      else if (alive) {
        const see = sees(e, p, d), hear = d < L.noiseR;
        if (e.st === 'chase') {
          e.lostT = see ? 0 : e.lostT + dt;
          if (e.lostT > 6) { e.st = 'alert'; e.lostT = 0; if (!L.alertInfo) L.alertAt(p.x, p.z, 0); }
          sp = K.chase * (e.kind === 'patient' ? 1 + 0.04 * Math.min(8, (L.rootsCut || 0) * 2) : 1);
          if (d < K.reach * 0.95 && e.atkT <= 0 && e.wind <= 0) { e.wind = 0.3; }
          if (e.wind > 0) {
            e.wind -= dt; sp = 0;
            if (e.wind <= 0) { e.atkT = K.cd; if (d < K.reach * 1.35 && L.hurt) L.hurt(K.dmg, e); }
          } else if (d > K.reach * 0.8) {
            if ((see && d < 8) || L.pdm[L.toTile(e.z) * N + L.toTile(e.x)] < 0) moving = move(e, dx, dz, sp, dt);
            else { const nx = L.flow(L.pdm, L.toTile(e.x), L.toTile(e.z)); if (nx) moving = move(e, nx[0] - e.x, nx[1] - e.z, sp, dt); else moving = move(e, dx, dz, sp, dt); }
          }
        } else {
          if (see || (hear && d < 12)) {
            e.st = 'chase'; e.lostT = 0; e.atkT = Math.max(e.atkT, 0.4);
            if (e.kind === 'howler' && e.scream <= 0) { e.scream = 12; L.howl(e); }
            else if (e.kind !== 'howler') H.sfxScratch && H.sfxScratch([e.x, 1.4, e.z]);
          } else if (e.st === 'alert') {
            const A = L.alertInfo;
            if (!A) { e.st = 'wander'; }
            else {
              const tx = L.toTile(e.x), tz = L.toTile(e.z);
              if (Math.hypot(e.x - A.x, e.z - A.z) < 3) { e.st = 'wander'; }
              else { const nx = L.flow(A.dm, tx, tz); sp = K.wander * 2.3; if (nx) moving = move(e, nx[0] - e.x, nx[1] - e.z, sp, dt); else e.st = 'wander'; }
            }
          } else {
            e.turnT -= dt; sp = K.wander;
            if (e.turnT <= 0) { e.head = e.yaw + rnd(-1.6, 1.6); e.turnT = rnd(1.5, 5); if (Math.random() < 0.25) e.turnT = rnd(0.5, 1.2), sp = 0; }
            if (Math.random() < 0.002 && L.pdm[L.toTile(e.z) * N + L.toTile(e.x)] > 6) { const nx = L.flow(L.pdm, L.toTile(e.x), L.toTile(e.z)); if (nx) e.head = Math.atan2(nx[0] - e.x, nx[1] - e.z); } /* drift toward the player over time */
            const hx = Math.sin(e.head), hz = Math.cos(e.head);
            moving = move(e, hx, hz, sp, dt);
            if (!moving) { e.head += rnd(1.3, 2.6) * (Math.random() < 0.5 ? 1 : -1); e.turnT = rnd(0.5, 2); }
          }
        }
        e.scream = Math.max(0, e.scream - dt);
      }
      /* keep patients from stacking on one point */
      for (let j = 0; j < i; j++) {
        const o = L.enemies[j]; if (o.dead) continue;
        const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz);
        if (od < 0.7 && od > 0.001) { const push = (0.7 - od) * 0.5; if (!L.blocked(e.x + ox / od * push, e.z, 0.3)) e.x += ox / od * push; if (!L.blocked(e.x, e.z + oz / od * push, 0.3)) e.z += oz / od * push; }
      }
      /* animation */
      e.walk += dt * (moving ? (e.st === 'chase' ? 9 : 4.5) : 0);
      const sw = moving ? Math.sin(e.walk) : 0, chase = e.st === 'chase';
      g.position.x = e.x; g.position.z = e.z; g.rotation.y = e.yaw;
      u.legL.rotation.x = sw * 0.7; u.legR.rotation.x = -sw * 0.7;
      if (!u.jacket) {
        const up = e.kind === 'howler' ? -2.5 : (chase ? -1.45 : -0.2);
        const swing = e.wind > 0 ? -2.2 : up;
        u.armL.rotation.x = swing + (chase ? Math.sin(e.walk * 1.1) * 0.35 : -sw * 0.3);
        u.armR.rotation.x = swing + (chase ? -Math.sin(e.walk * 1.1) * 0.35 : sw * 0.3);
      }
      u.torso.rotation.x = chase ? 0.3 : 0.08; u.torso.rotation.z = Math.sin(e.walk * 0.5 + e.ph) * (chase ? 0.12 : 0.04);
      u.head.rotation.z = Math.sin(H.gframe * 0.03 + e.ph) * 0.15 + (Math.random() < 0.03 ? rnd(-0.5, 0.5) : 0);
      u.glow.material.opacity = (chase ? 0.9 : 0.4) + Math.sin(H.gframe * 0.2 + e.ph) * 0.08;
      if (moving && d < 24) { e.stepT += dt * (chase ? 3.3 : 1.5); if (e.stepT >= 1) { e.stepT = 0; H.noiseBurst({ dur: 0.1, f: e.kind === 'lurcher' ? 160 : 300, gain: e.kind === 'lurcher' ? 0.5 : 0.22, pos: [e.x, 0.2, e.z], rev: 0.4 }); } }
    }
  };
  /* the howler's scream: everyone nearby comes running to the player's position */
  L.howl = function (e) {
    H.noiseBurst({ type: 'bandpass', f: 1400, f2: 2600, q: 3, dur: 1.4, gain: 0.5, pos: [e.x, 1.6, e.z], rev: 0.6 });
    H.tone({ type: 'sawtooth', f: 520, f2: 1500, dur: 1.2, gain: 0.25, pos: [e.x, 1.6, e.z], rev: 0.6 });
    H.say('A howl. They are coming.', 2500);
    L.alertAt(H.player.x, H.player.z, 38);
    H.shake = Math.max(H.shake, 0.4);
  };
})();
