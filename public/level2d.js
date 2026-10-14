'use strict';
/* LEVEL 2, part D: everything you see and hear around the gameplay: HUD panel, title card, screen effects,
   ambient sound, the knife you hold, and the coloured lights that follow you through the ward. */
(function () {
  const H = window.HW, L = window.HW2;
  if (!H || !L || !L.boss) return;
  const THREE = H.THREE, rnd = H.rnd, pick = H.pick, clamp = H.clamp, el = H.el;
  const UI = (L.ui = {});

  /* ---------- HUD ---------- */
  const css = document.createElement('style');
  css.textContent = '#l2hud{position:absolute;left:18px;top:16px;letter-spacing:.16em;text-transform:uppercase;font-size:12px;color:var(--dim);text-shadow:0 0 6px #000;min-width:13rem}' +
    '#l2hud .t{font-family:"IM Fell English SC",Georgia,serif;font-size:20px;color:#d85a6a;letter-spacing:.14em;margin-bottom:6px}' +
    '#l2hud .r{display:flex;justify-content:space-between;gap:14px;margin-top:3px}#l2hud .r b{font-weight:400;color:var(--amber);letter-spacing:.08em}#l2hud .r b.ok{color:#6fd08a}' +
    '#l2hud .hb{height:6px;background:rgba(255,255,255,.1);margin:4px 0 6px}#l2hud .hb i{display:block;height:100%;width:100%;background:#b8283a;transition:width .15s}#l2hud .hb i.low{background:#ff3a4a;animation:l2p .6s infinite}' +
    '@keyframes l2p{50%{opacity:.45}}#l2goal{margin-top:8px;text-transform:none;letter-spacing:.05em;font-size:13px;max-width:22rem;color:#b9aeb0;line-height:1.4}' +
    '#l2bossbar{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:min(26rem,70%);text-align:center;font-size:11px;letter-spacing:.3em;color:#d86a50;text-transform:uppercase;text-shadow:0 0 6px #000}' +
    '#l2bossbar div{height:5px;background:rgba(255,255,255,.1);margin-top:4px}#l2bossbar i{display:block;height:100%;background:#d8452a;width:100%}' +
    '#l2title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;opacity:0;pointer-events:none;transition:opacity 1.6s;text-align:center;padding:16px}' +
    '#l2title.on{opacity:1;transition:none}#l2title h1{color:#d85a6a;animation:none;margin:.1em 0}#l2title p{color:#b9aeb0;max-width:30rem;line-height:1.6;margin:.4em 0}' +
    '#l2flay{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(255,40,20,0) 25%,rgba(180,10,30,.75) 100%);mix-blend-mode:screen}';
  document.head.appendChild(css);
  const stage = document.getElementById('stage'), hud = document.getElementById('hud');
  const panel = document.createElement('div'); panel.id = 'l2hud'; panel.hidden = true;
  panel.innerHTML = '<div class="t">Ward 9</div><div class="hb"><i id="l2hp"></i></div>' +
    '<div class="r"><span>Scrap metal</span><b id="l2m">0 / 4</b></div><div class="r"><span>Wire</span><b id="l2w">0 / 3</b></div>' +
    '<div class="r"><span>Blade</span><b id="l2k">not forged</b></div><div class="r"><span>Hearts cut</span><b id="l2r">0 / 3</b></div><div id="l2goal"></div>';
  hud.appendChild(panel);
  const boss = document.createElement('div'); boss.id = 'l2bossbar'; boss.hidden = true; boss.innerHTML = 'The Keeper<div><i id="l2bhp"></i></div>'; hud.appendChild(boss);
  const title = document.createElement('div'); title.id = 'l2title'; stage.appendChild(title);
  const flay = document.createElement('div'); flay.id = 'l2flay'; stage.insertBefore(flay, document.getElementById('flashov'));
  const $q = (id) => document.getElementById(id);
  const refs = { hp: $q('l2hp'), m: $q('l2m'), w: $q('l2w'), k: $q('l2k'), r: $q('l2r'), goal: $q('l2goal'), bhp: $q('l2bhp') };
  const obj = document.getElementById('obj');

  UI.show = function (on) { panel.hidden = !on; if (obj) obj.style.display = on ? 'none' : ''; if (!on) boss.hidden = true; };
  UI.update = function (S, NEED) {
    refs.hp.style.width = clamp(S.hp, 0, 100) + '%'; refs.hp.className = S.hp < 35 ? 'low' : '';
    refs.m.textContent = Math.min(S.metal, 99) + ' / ' + NEED.metal; refs.m.className = S.metal >= NEED.metal ? 'ok' : '';
    refs.w.textContent = Math.min(S.wire, 99) + ' / ' + NEED.wire; refs.w.className = S.wire >= NEED.wire ? 'ok' : '';
    refs.k.textContent = S.knife ? 'forged' : (S.crafting ? 'forging...' : 'not forged'); refs.k.className = S.knife ? 'ok' : '';
    refs.r.textContent = S.roots + ' / 3'; refs.r.className = S.roots >= 3 ? 'ok' : '';
    const B = L.boss, bv = B.st === 'hunt' || B.st === 'flay' || B.st === 'stagger';
    boss.hidden = !bv; if (bv) refs.bhp.style.width = clamp(B.hp / B.max * 100, 0, 100) + '%';
  };
  UI.goal = function (t) { if (refs.goal.textContent !== t) refs.goal.textContent = t; };
  UI.card = function (h, p, ms) {
    title.innerHTML = '<div class="kick">St. Verity Hospital &middot; below Ward 7</div><h1>' + h + '</h1><p>' + p + '</p>';
    title.classList.add('on'); void title.offsetWidth;
    setTimeout(() => title.classList.remove('on'), ms || 3800);
  };
  /* the mind flay warps the whole picture */
  UI.fx = function (S) {
    const k = L.boss.flayK, hurt = 1 - clamp(S.hp / 100, 0, 1);
    flay.style.opacity = clamp(k * 0.9 + (S.hp < 30 ? 0.25 + Math.sin(L.t * 6) * 0.12 : 0), 0, 1);
    const f = k > 0.03 ? 'saturate(' + (1 + k * 1.2).toFixed(2) + ') contrast(' + (1 + k * 0.25).toFixed(2) + ') hue-rotate(' + (-k * 25).toFixed(0) + 'deg) blur(' + (k * 1.4).toFixed(2) + 'px)' : '';
    if (el.canvas.style.filter !== f) el.canvas.style.filter = f;
    el.vig.style.setProperty('--v', (62 - H.fear * 20 - hurt * 22) + '%');
  };
  UI.reset = function () { el.canvas.style.filter = ''; flay.style.opacity = 0; title.classList.remove('on'); panel.hidden = true; boss.hidden = true; if (obj) obj.style.display = ''; };

  /* ---------- the knife in your hand ---------- */
  let kn = null;
  UI.knife = function (on) {
    if (!kn) {
      kn = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: 0xaab2b6, metalness: 0.85, roughness: 0.35, emissive: 0x15191c });
      const dark = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.9, emissive: 0x0a0605 });
      const wire = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.6, roughness: 0.5, emissive: 0x1a0c04 });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.05, 0.3), steel); blade.position.z = -0.2; kn.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), steel); tip.rotation.x = -Math.PI / 2; tip.rotation.z = Math.PI / 4; tip.position.z = -0.375; kn.add(tip);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.04, 0.14), dark); grip.position.z = 0.02; kn.add(grip);
      for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 4, 8), wire); r.position.z = -0.03 + i * 0.035; kn.add(r); }
      kn.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
    }
    if (on && !kn.parent) H.camera.add(kn); else if (!on && kn.parent) kn.parent.remove(kn);
  };
  UI.knifePose = function (stabA, bob) {
    if (!kn || !kn.parent) return;
    const s = Math.sin(Math.PI * (1 - stabA)) * (stabA > 0 ? 1 : 0);
    kn.position.set(0.24 - s * 0.12, -0.27 + bob * 0.5 + s * 0.05, -0.42 - s * 0.4);
    kn.rotation.set(-0.35 + s * 0.35, 0.28 - s * 0.3, 0.12);
  };

  /* ---------- ambient sound: a slow wet breathing, a heartbeat-like pulse, and voices ---------- */
  const A = { nodes: [], t: 0, next: 6 };
  UI.ambStart = function () {
    UI.ambStop(); const AU = H.AU; if (!AU.ctx || !AU.master) return;
    const c = AU.ctx, g = c.createGain(); g.gain.value = 0; g.connect(AU.master);
    g.gain.setTargetAtTime(0.5, c.currentTime, 2);
    const o1 = c.createOscillator(), o2 = c.createOscillator(), og = c.createGain(); o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = 41; o2.frequency.value = 43.3; og.gain.value = 0.09;
    o1.connect(og); o2.connect(og); og.connect(g);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.06; lfo.connect(lg); lg.connect(og.gain);
    const ns = c.createBufferSource(); ns.buffer = AU.noise; ns.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; const ng = c.createGain(); ng.gain.value = 0.05;
    const lfo2 = c.createOscillator(), lg2 = c.createGain(); lfo2.frequency.value = 0.19; lg2.gain.value = 0.045; lfo2.connect(lg2); lg2.connect(ng.gain);
    ns.connect(f); f.connect(ng); ng.connect(g);
    for (const n of [o1, o2, lfo, lfo2, ns]) n.start();
    A.nodes = [o1, o2, lfo, lfo2, ns]; A.g = g; A.next = 6; A.lp = f;
  };
  UI.ambStop = function () {
    const AU = H.AU; if (A.g && AU.ctx) { try { A.g.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.2); } catch (e) { /* ignore */ } }
    const nodes = A.nodes; A.nodes = []; A.g = null;
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) { /* ignore */ } } }, 900);
  };
  UI.ambTick = function (dt, S) {
    A.next -= dt; if (A.next > 0) return;
    A.next = rnd(7, 15);
    const p = H.player, a = rnd(0, 6.28), r = rnd(14, 26), pos = [p.x + Math.cos(a) * r, 1.5, p.z + Math.sin(a) * r];
    const k = Math.random();
    if (k < 0.3) H.sfxWhisper(pos);
    else if (k < 0.6) { H.tone({ type: 'sawtooth', f: rnd(90, 150), f2: rnd(60, 90), dur: rnd(1.4, 2.4), gain: 0.18, atk: 0.4, pos: pos, rev: 0.8 }); H.noiseBurst({ type: 'bandpass', f: 500, q: 2, dur: 1.6, gain: 0.15, atk: 0.4, pos: pos, rev: 0.8 }); }
    else if (k < 0.8) { H.tone({ type: 'sawtooth', f: rnd(700, 1100), f2: rnd(1800, 2600), dur: 0.9, gain: 0.1, atk: 0.05, pos: pos, rev: 0.9 }); }
    else { for (let i = 0; i < 5; i++) H.noiseBurst({ type: 'bandpass', f: rnd(1500, 3000), q: 5, dur: 0.06, gain: 0.2, delay: i * rnd(0.08, 0.2), pos: pos }); }
  };

  /* ---------- coloured light that follows you: the three nearest glowing pods ---------- */
  let lights = [], lt = 0;
  UI.lightsInit = function () {
    UI.lightsClear();
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xff2638, 0, 13, 2); L.world.add(l); lights.push({ l: l, pod: null, cur: 0 }); }
    lt = 0;
  };
  UI.lightsClear = function () { for (const o of lights) if (o.l.parent) o.l.parent.remove(o.l); lights = []; };
  UI.lightsTick = function (dt) {
    const p = H.player; lt -= dt;
    if (lt <= 0) {
      lt = 0.3;
      const best = L.pods.map((q) => ({ q: q, d: Math.hypot(q.x - p.x, q.z - p.z) })).filter((o) => o.d < 15).sort((a, b) => a.d - b.d).slice(0, 3);
      lights.forEach((o, i) => { const b = best[i]; if (b) { o.pod = b.q; o.l.position.set(b.q.x, b.q.y, b.q.z); o.l.color.setHex(b.q.color); } else o.pod = null; });
    }
    const fl = L.boss.flicker > 0 ? (Math.random() < 0.5 ? 0.1 : 1) : 1;
    for (const o of lights) {
      o.cur += ((o.pod ? 1 : 0) - o.cur) * Math.min(1, 4 * dt);
      o.l.intensity = o.cur * (1.5 + (o.pod ? Math.sin(L.t * 2 + o.pod.ph) * 0.35 : 0)) * H.bright * fl;
    }
    for (const q of L.pods) q.sprite.material.opacity = 0.45 + Math.sin(L.t * 2 + q.ph) * 0.18;
    if (L.spores && L.sporeBase) {
      const pos = L.spores.geometry.attributes.position, b = L.sporeBase;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3] + Math.sin(L.t * 0.3 + i) * 0.6, y = (b[i * 3 + 1] + L.t * 0.12 * (1 + (i % 3) * 0.4)) % 7, z = b[i * 3 + 2] + Math.cos(L.t * 0.25 + i * 1.3) * 0.6;
        pos.setXYZ(i, p.x + ((x + 14 + 28) % 28) - 14, y, p.z + ((z + 14 + 28) % 28) - 14);
      }
      pos.needsUpdate = true;
      L.spores.material.color.setHex(L.boss.st === 'hunt' || L.boss.st === 'flay' ? 0xff4a2a : 0xff7a9a);
    }
  };
})();
