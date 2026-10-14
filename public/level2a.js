'use strict';
/* LEVEL 2, part A: "Ward 9". A maze of living flesh: map generation, textures, world building.
   Runs after the main game script, which exposes window.HW. Shares state through window.HW2. */
(function () {
  const H = window.HW;
  if (!H || !window.THREE) return;
  const THREE = window.THREE, L = (window.HW2 = window.HW2 || {});
  const rnd = H.rnd, ri = H.ri, pick = H.pick, clamp = H.clamp, mkCanvas = H.mkCanvas, mkTex = H.mkTex, speckle = H.speckle;
  const T = 4, N = 45, ROOF = 5.4;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  Object.assign(L, { T: T, N: N, ROOF: ROOF, DIRS: DIRS, g: null, open: [], solids: [], world: null, extraLights: [], cabinets: [], roots: [], pods: [], exitObj: null, tex: null });

  const toTile = (v) => Math.round(v / T);
  const solidT = (tx, ty) => tx < 0 || ty < 0 || tx >= N || ty >= N || L.g[ty][tx] === 1;
  L.toTile = toTile;
  L.solidT = solidT;
  L.solidAt = (x, z) => solidT(toTile(x), toTile(z));
  L.blocked = function (x, z, r) {
    const sa = L.solidAt;
    if (sa(x - r, z - r) || sa(x + r, z - r) || sa(x - r, z + r) || sa(x + r, z + r)) return true;
    const s = L.solids;
    for (let i = 0; i < s.length; i++) { const o = s[i]; if (o.off) continue; if (Math.abs(x - o.x) < o.hx + r && Math.abs(z - o.z) < o.hz + r) return true; }
    return false;
  };
  L.los = function (ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
    if (d < 0.01) return true;
    const nx = -dz / d, nz = dx / d, steps = Math.ceil(d / 0.5);
    for (const off of [0, 0.3, -0.3]) {
      const sx = ax + nx * off, sz = az + nz * off;
      for (let i = 1; i < steps; i++) { const t = i / steps; if (L.solidAt(sx + dx * t, sz + dz * t)) return false; }
    }
    return true;
  };
  L.distMap = function (sx, sy, out) {
    const dm = out || new Int16Array(N * N);
    dm.fill(-1);
    if (solidT(sx, sy)) return dm;
    const q = new Int32Array(N * N); let h = 0, t = 0;
    q[t++] = sy * N + sx; dm[sy * N + sx] = 0;
    while (h < t) {
      const cur = q[h++], cx = cur % N, cy = (cur / N) | 0, dv = dm[cur] + 1;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
        if (solidT(nx, ny)) continue;
        const id = ny * N + nx;
        if (dm[id] !== -1) continue;
        dm[id] = dv; q[t++] = id;
      }
    }
    return dm;
  };
  /* next tile centre to walk to, following a distance map downhill */
  L.flow = function (dm, tx, ty) {
    const bv0 = dm[ty * N + tx];
    if (bv0 < 0) return null;
    let best = null, bv = bv0;
    const o = (Math.random() * 4) | 0;
    for (let i = 0; i < 4; i++) {
      const d = DIRS[(i + o) % 4], nx = tx + d[0], ny = ty + d[1];
      if (solidT(nx, ny)) continue;
      const v = dm[ny * N + nx];
      if (v >= 0 && v < bv) { bv = v; best = [nx * T, ny * T]; }
    }
    return best;
  };

  /* ---------- map: a real maze (depth-first corridors, a few loops, a few open rooms to be cornered in) ---------- */
  function genCave() {
    const g = Array.from({ length: N }, () => new Array(N).fill(1));
    const st = [[1, 1]]; g[1][1] = 0;
    while (st.length) {
      const c = st[st.length - 1], opts = [];
      for (const d of DIRS) { const nx = c[0] + d[0] * 2, ny = c[1] + d[1] * 2; if (nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && g[ny][nx] === 1) opts.push([nx, ny, d]); }
      if (!opts.length) { st.pop(); continue; }
      const o = pick(opts); g[c[1] + o[2][1]][c[0] + o[2][0]] = 0; g[o[1]][o[0]] = 0; st.push([o[0], o[1]]);
    }
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (g[y][x] !== 1 || ((x % 2 === 0) === (y % 2 === 0))) continue;
      const a = (x % 2 === 0) ? [g[y][x - 1], g[y][x + 1]] : [g[y - 1][x], g[y + 1][x]];
      if (a[0] === 0 && a[1] === 0 && Math.random() < 0.18) g[y][x] = 0;
    }
    const cells = (N - 1) / 2;
    for (let k = 0; k < 6; k++) {
      const cx = 1 + 2 * ri(0, cells - 1), cy = 1 + 2 * ri(0, cells - 1);
      if (cx + cy < 10 || cx + cy > 2 * N - 12) continue; /* keep the entrance and the exit as corridors */
      for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) { if (xx > 0 && yy > 0 && xx < N - 1 && yy < N - 1) g[yy][xx] = 0; }
    }
    return { g: g, start: [1, 1], exit: [N - 2, N - 2], roots: [] };
  }

  /* ---------- textures: dark flesh, glowing veins ---------- */
  function makeTex() {
    if (L.tex) return L.tex;
    const veins = [];
    for (let i = 0; i < 46; i++) {
      let x = Math.random() * 512, y = Math.random() * 512, a = Math.random() * 6.28;
      const pts = [[x, y]], n = 6 + ri(0, 8);
      for (let k = 0; k < n; k++) { a += rnd(-0.7, 0.7); const l = rnd(18, 50); x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
      veins.push({ pts: pts, w: rnd(1, 3.2) });
    }
    const drawVeins = (g, col, glow) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const v of veins) {
        g.strokeStyle = col; g.lineWidth = v.w; g.shadowColor = glow || 'transparent'; g.shadowBlur = glow ? 8 : 0;
        g.beginPath(); v.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      }
      g.shadowBlur = 0;
    };
    const tex = {};
    let c = mkCanvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#2a0e1b'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 110;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, pick(['rgba(70,14,40,.35)', 'rgba(10,2,8,.45)', 'rgba(120,40,60,.18)'])); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = 'rgba(8,2,6,' + (0.25 + Math.random() * 0.3) + ')'; g.lineWidth = 2 + Math.random() * 6;
      const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + rnd(-40, 40), 340, y + rnd(-40, 40), 512, y + rnd(-20, 20)); g.stroke();
    }
    drawVeins(g, 'rgba(190,40,48,.55)', 'rgba(255,60,60,.8)');
    speckle(g, 512, 512, 3500, 0.25);
    tex.wall = mkTex(c, 1, 1);
    c = mkCanvas(512, 512); g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
    drawVeins(g, 'rgba(255,70,50,1)', 'rgba(255,90,60,1)');
    tex.emi = mkTex(c, 1, 1);
    /* floor: wet dark ground with glowing cracks */
    const cracks = [];
    for (let i = 0; i < 18; i++) {
      let x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * 6.28; const pts = [[x, y]];
      for (let k = 0; k < 7; k++) { a += rnd(-0.8, 0.8); x += Math.cos(a) * rnd(12, 34); y += Math.sin(a) * rnd(12, 34); pts.push([x, y]); }
      cracks.push(pts);
    }
    c = mkCanvas(256, 256); g = c.getContext('2d');
    g.fillStyle = '#150a10'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 14 + Math.random() * 44, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, pick(['rgba(60,14,30,.5)', 'rgba(4,1,3,.6)', 'rgba(90,30,45,.25)'])); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3;
    cracks.forEach((pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); });
    speckle(g, 256, 256, 2200, 0.3);
    tex.floor = mkTex(c, N * T / 8, N * T / 8);
    c = mkCanvas(256, 256); g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,80,40,1)'; g.lineWidth = 2; g.shadowColor = 'rgba(255,90,40,1)'; g.shadowBlur = 8;
    cracks.forEach((pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); });
    tex.floorEmi = mkTex(c, N * T / 8, N * T / 8);
    /* spiral for the exit rift */
    c = mkCanvas(256, 256); g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(170,220,255,.8)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) { g.beginPath(); for (let t = 0; t < 60; t++) { const a = arm * 2.094 + t * 0.14, r = 6 + t * 1.9; const px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r; if (t) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
    tex.swirl = new THREE.CanvasTexture(c);
    L.tex = tex;
    return tex;
  }

  /* ---------- props ---------- */
  function addSolid(p, d, along, depth) { L.solids.push({ x: p.x, z: p.z, hx: d[0] !== 0 ? depth / 2 : along / 2, hz: d[0] !== 0 ? along / 2 : depth / 2 }); }
  function placeAt(tx, ty, d, depth) { return { x: tx * T + d[0] * (T / 2 - depth / 2 - 0.06), z: ty * T + d[1] * (T / 2 - depth / 2 - 0.06), rot: Math.atan2(-d[0], -d[1]) }; }
  const sidesOf = (tx, ty) => DIRS.filter((d) => solidT(tx + d[0], ty + d[1]));
  L.sidesOf = sidesOf;

  function makeCabinet(rusty) {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: rusty ? 0x5a4a40 : 0x4d5a5c, metalness: 0.7, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15191a, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.75, 0.6), metal); body.position.y = 0.875; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const fronts = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.position.set(0, 0.28 + i * 0.4, 0.3);
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.36, 0.04), metal); f.add(pl);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.04), dark); hd.position.set(0, 0.06, 0.04); f.add(hd);
      g.add(f); fronts.push(f);
    }
    g.userData.fronts = fronts;
    return g;
  }

  function makeRoot() {
    const g = new THREE.Group();
    const flesh = new THREE.MeshStandardMaterial({ map: L.tex.wall, color: 0xb08090, emissive: 0x501018, emissiveIntensity: 0.6, roughness: 0.6 });
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10), flesh); mound.scale.set(1, 0.45, 1); mound.position.y = 0.2; g.add(mound);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, ROOF, 12, 1), flesh); trunk.position.y = ROOF / 2; trunk.castShadow = true; g.add(trunk);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), coreMat); core.position.set(0, 1.7, 0.5); g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.TEX.glow, color: 0xff2030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false }));
    halo.scale.set(4, 4, 1); halo.position.copy(core.position); g.add(halo);
    const tm = new THREE.MeshStandardMaterial({ color: 0x3a1020, emissive: 0x300810, roughness: 0.7 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283 + rnd(-0.2, 0.2), r1 = rnd(0.5, 0.8), r2 = rnd(2.0, 3.2);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * r1, rnd(1.5, 4.5), Math.sin(a) * r1),
        new THREE.Vector3(Math.cos(a) * (r1 + r2) / 2, rnd(2.5, 4.5), Math.sin(a) * (r1 + r2) / 2),
        new THREE.Vector3(Math.cos(a + 0.3) * r2, 0.15, Math.sin(a + 0.3) * r2)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, rnd(0.07, 0.16), 6, false), tm); g.add(tube);
    }
    const light = new THREE.PointLight(0xff2040, 2.2, 18, 2); light.position.set(0, 2.2, 0); g.add(light);
    g.userData = { core: core, coreMat: coreMat, halo: halo, light: light, flesh: flesh };
    return g;
  }

  /* ---------- build ---------- */
  L.dispose = function () {
    if (L.world) { H.scene.remove(L.world); L.world.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); L.world = null; }
    for (const l of L.extraLights) H.scene.remove(l);
    L.extraLights = [];
    if (L.spores) { H.scene.remove(L.spores); L.spores.geometry.dispose(); L.spores = null; }
  };

  L.build = function () {
    L.dispose();
    const gen = genCave();
    L.g = gen.g; L.startTile = gen.start; L.exitTile = gen.exit; L.rootTiles = gen.roots;
    L.open = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (L.g[y][x] === 0) L.open.push([x, y]);
    L.solids = []; L.cabinets = []; L.roots = []; L.pods = [];
    const tex = makeTex();
    const grp = new THREE.Group(); L.world = grp; H.scene.add(grp);

    /* walls: one instanced mesh, each block turned at random so the veins do not repeat in lines */
    const walls = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (L.g[y][x] !== 1) continue;
      let vis = false;
      for (let dy = -1; dy <= 1 && !vis; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && L.g[ny][nx] === 0) { vis = true; break; } }
      if (vis) walls.push([x, y]);
    }
    const wallMat = new THREE.MeshStandardMaterial({ map: tex.wall, emissiveMap: tex.emi, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.75, color: 0xb8a4ac });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(T, ROOF, T), wallMat, walls.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    walls.forEach((w, i) => {
      m4.makeRotationY(((Math.random() * 4) | 0) * Math.PI / 2); m4.setPosition(w[0] * T, ROOF / 2, w[1] * T);
      im.setMatrixAt(i, m4); im.setColorAt(i, col.setScalar(0.65 + Math.random() * 0.5));
    });
    im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    grp.add(im);
    const cx = (N - 1) / 2 * T;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(N * T, N * T), new THREE.MeshStandardMaterial({ map: tex.floor, emissiveMap: tex.floorEmi, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.1 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0, cx); fl.receiveShadow = true; grp.add(fl);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(N * T, N * T), new THREE.MeshStandardMaterial({ map: tex.wall, color: 0x5a3a48, roughness: 1 }));
    roof.rotation.x = Math.PI / 2; roof.position.set(cx, ROOF, cx); grp.add(roof);

    /* hanging growths */
    const stal = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 2, 6), new THREE.MeshStandardMaterial({ color: 0x3a1624, emissive: 0x2a0610, roughness: 0.8 }), 150);
    const dm = new THREE.Object3D();
    for (let i = 0; i < 150; i++) {
      const t = pick(L.open), h = rnd(1.2, 3.6), w = rnd(0.5, 1.3);
      dm.position.set(t[0] * T + rnd(-1.8, 1.8), ROOF - h / 2, t[1] * T + rnd(-1.8, 1.8)); dm.rotation.set(Math.PI, 0, 0); dm.scale.set(w, h / 2, w); dm.updateMatrix(); stal.setMatrixAt(i, dm.matrix);
    }
    grp.add(stal);

    /* glowing pods on the walls, the light sources of the ward */
    const podMats = [0xff2638, 0xa04cff, 0x5cff7a].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    const podCols = [0xff2638, 0xa04cff, 0x5cff7a];
    const faces = [];
    for (const t of L.open) for (const s of sidesOf(t[0], t[1])) faces.push({ cx: t[0] * T, cz: t[1] * T, s: s });
    for (let i = 0; i < 46 && faces.length; i++) {
      const f = faces.splice(Math.floor(Math.random() * faces.length), 1)[0];
      const kind = Math.random() < 0.6 ? 0 : (Math.random() < 0.75 ? 1 : 2), r = rnd(0.13, 0.26);
      const x = f.cx + f.s[0] * (T / 2 - 0.12) + rnd(-1, 1) * (f.s[0] === 0 ? 1 : 0), z = f.cz + f.s[1] * (T / 2 - 0.12) + rnd(-1, 1) * (f.s[1] === 0 ? 1 : 0), y = rnd(1.0, 4.2);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), podMats[kind]); m.position.set(x, y, z); m.scale.set(1, 1.25, 1); grp.add(m);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.TEX.glow, color: podCols[kind], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, fog: false }));
      sp.scale.set(r * 11, r * 11, 1); sp.position.set(x, y, z); grp.add(sp);
      L.pods.push({ x: x, y: y, z: z, color: podCols[kind], sprite: sp, ph: Math.random() * 6.28 });
    }

    /* cabinets along the walls. Three hold the ward keys, spread far apart. The rest hold side-quest scrap and wire,
       supplies, or a nasty surprise. */
    const startDm = L.distMap(gen.start[0], gen.start[1]);
    const cand = L.open.filter((t) => startDm[t[1] * N + t[0]] >= 6 && sidesOf(t[0], t[1]).length > 0 && !(t[0] >= N - 5 && t[1] >= N - 5));
    const placed = [], WANT = 28;
    for (let tries = 0; tries < 5000 && placed.length < WANT && cand.length; tries++) {
      const t = pick(cand), sep = tries > 2500 ? 2 : 4;
      if (placed.some((p) => Math.abs(p[0] - t[0]) + Math.abs(p[1] - t[1]) < sep)) continue;
      placed.push(t);
    }
    const keyIdx = [], anchors = [gen.start];
    for (let k = 0; k < 3 && placed.length > 3; k++) {
      let best = -1, bs = -1;
      for (let i = 0; i < placed.length; i++) {
        if (keyIdx.indexOf(i) >= 0) continue;
        let md = 1e9; for (const a of anchors) md = Math.min(md, Math.abs(a[0] - placed[i][0]) + Math.abs(a[1] - placed[i][1]));
        const sc = Math.min(md, 26) + Math.random() * 8;
        if (sc > bs) { bs = sc; best = i; }
      }
      keyIdx.push(best); anchors.push(placed[best]);
    }
    const loot = [];
    for (let i = 0; i < 5; i++) loot.push('metal');
    for (let i = 0; i < 4; i++) loot.push('wire');
    for (let i = 0; i < 4; i++) loot.push('medkit');
    for (let i = 0; i < 3; i++) loot.push('battery');
    for (let i = 0; i < 3; i++) loot.push('trap');
    while (loot.length < placed.length - 3) loot.push('empty');
    for (let i = loot.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0, t = loot[i]; loot[i] = loot[j]; loot[j] = t; }
    let li = 0;
    placed.forEach((t, i) => {
      const d = pick(sidesOf(t[0], t[1])), p = placeAt(t[0], t[1], d, 0.6);
      const cab = makeCabinet(Math.random() < 0.4); cab.position.set(p.x, 0, p.z); cab.rotation.y = p.rot; grp.add(cab);
      addSolid(p, d, 0.9, 0.6);
      L.cabinets.push({ x: p.x, z: p.z, fx: -d[0], fz: -d[1], loot: keyIdx.indexOf(i) >= 0 ? 'key' : (loot[li++] || 'empty'), opened: false, mesh: cab });
    });

    /* the way out: a rift that stays dormant until all three keys are found */
    const ex = gen.exit[0] * T, ez = gen.exit[1] * T;
    const pg = new THREE.Group(); pg.position.set(ex, 2.1, ez); grp.add(pg);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.14, 8, 40), new THREE.MeshStandardMaterial({ color: 0x2a1a22, emissive: 0x000000, roughness: 0.6 }));
    pg.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ map: tex.swirl, color: 0xbfe4ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    pg.add(disc);
    const pl = new THREE.PointLight(0xaadfff, 0, 24, 2); pl.position.set(ex, 2.2, ez); grp.add(pl);
    L.exitObj = { x: ex, z: ez, g: pg, ring: ring, disc: disc, light: pl, open: false };

    /* the steel door you came through */
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 3.9), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, metalness: 0.5, roughness: 0.6 }));
    door.position.set(T / 2 + 0.1, 1.6, gen.start[1] * T); grp.add(door);
    L.startPos = { x: T + 0.5, z: gen.start[1] * T, yaw: -Math.PI / 2 };

    /* floating spores around the camera */
    const SP = 380, pos = new Float32Array(SP * 3);
    for (let i = 0; i < SP; i++) { pos[i * 3] = rnd(-14, 14); pos[i * 3 + 1] = rnd(0, 7); pos[i * 3 + 2] = rnd(-14, 14); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    L.spores = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.11, map: H.TEX.glow, color: 0xff7a9a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    L.spores.frustumCulled = false; H.scene.add(L.spores);
    L.sporeBase = pos.slice();
    return gen;
  };
})();
