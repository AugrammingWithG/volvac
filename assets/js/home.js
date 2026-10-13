/* Volvac homepage: the machine finder, quote prefill, and the 3D chamber machine in the hero. */
(function () {
  'use strict';

  var doc = document.documentElement, body = document.body;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* The range, as Volvac's own navigation groups it. Photos are shown only where the photo is of a model in that group. */
  var SITE = 'https://volvac.com.tr/en/', IMG = 'assets/img/volvac/';
  var RANGE = [
    { id: 'vacuum', label: 'In a vacuum bag', url: 'vacuum-packaging-machines/', scales: [
      { label: 'Table top', url: 'table-top-models/', models: ['W 51 XL', 'W 51', 'W 48', 'W 42', 'W 35 ML'] },
      { label: 'Floor standing', models: ['W 104', 'W 68', 'W 48 H', 'W 52', 'W 51 H'] },
      { label: 'Double chamber', url: 'double-chamber-models/', models: ['W 100 PRO', 'W 86 PRO', 'W 72 PRO', 'W 55 PRO', 'W 100', 'W 86', 'W 72', 'W 55'], photo: ['w55-kopyasi.png', 'W 55'] },
      { label: 'Conveyor', url: 'conveyor-vacuum-machines/', models: ['W 135 C', 'W 110 C'], photo: ['110c-thumb.png', 'W 110 C'] },
      { label: 'Vertical', models: ['W 700'] }
    ] },
    { id: 'tray', label: 'In a sealed tray', url: 'tray-sealing-machines/', scales: [
      { label: 'Manual', url: 'manuel-models/', models: ['TS 450', 'TS 350'] },
      { label: 'Drawer', url: 'drawer-models/', models: ['E 52', 'E 26', 'TS 40', 'TS 52'] },
      { label: 'Semi automatic', url: 'semi-automatic-models/', models: ['W 850 VG', 'W 650 VG', 'W 450 VG'] },
      { label: 'Full automatic', url: 'full-automatic-models/', models: ['PTS 83', 'E 42 PRO', 'E 42', 'E 35 PRO', 'E 35', 'E 30 PRO', 'E 30'], photo: ['e42pro-thumb.png', 'E 42 PRO'] },
      { label: 'Inline', models: ['E540', 'E680', 'E875', 'E1070'] },
      { label: 'Rotary', models: ['E1070'] }
    ] },
    { id: 'skin', label: 'As a skin pack', url: 'skin-pack-2/', scales: [
      { label: 'Skin pack', models: ['E 42 PRO', 'E 42', 'E 35 PRO', 'E 35', 'E 30 PRO', 'E 30', 'E 52'], photo: ['e35pro.png', 'E 35 PRO'] }
    ] },
    { id: 'thermo', label: 'Thermoformed', url: 'w300/', scales: [{ label: 'Thermoform', models: ['W300'] }] },
    { id: 'shrink', label: 'Shrink wrapped', url: 'dip-tank-shrink-tunnel-machines/', scales: [
      { label: 'Dip tank and tunnels', models: ['DT 650', 'DTR75', 'ST75'], photo: ['st-75-thumb.png', 'ST75 shrink tunnel'] }
    ] },
    { id: 'slice', label: 'Sliced first', url: 's-20-2/', scales: [{ label: 'Automatic slicing', models: ['S 20'], photo: ['s20-thumb.png', 'S 20'] }] }
  ];

  var ui = $('#finder-ui'), waysBox = $('#f-ways'), scalesBox = $('#f-scales'), modelsBox = $('#f-models');
  var count = $('#f-count'), link = $('#f-link'), photo = $('#f-photo'), img = $('#f-img'), cap = $('#f-cap');
  var state = { way: 0, scale: 2 };

  function radio(box, labels, current, pick) {
    box.textContent = '';
    labels.forEach(function (label, i) {
      var b = el('button', 'opt', label); b.type = 'button'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', i === current ? 'true' : 'false'); b.tabIndex = i === current ? 0 : -1;
      b.addEventListener('click', function () { pick(i); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault(); pick((i + d + labels.length) % labels.length, true);
      });
      box.appendChild(b);
    });
  }
  function draw(focusIn) {
    var way = RANGE[state.way], scale = way.scales[state.scale];
    radio(waysBox, RANGE.map(function (w) { return w.label; }), state.way, function (i, key) { state.way = i; state.scale = 0; draw(key && waysBox); });
    radio(scalesBox, way.scales.map(function (s) { return s.label; }), state.scale, function (i, key) { state.scale = i; draw(key && scalesBox); });
    count.textContent = scale.models.length + (scale.models.length === 1 ? ' machine' : ' machines') + '. Pick one to ask for a quote.';
    modelsBox.textContent = '';
    scale.models.forEach(function (m, i) {
      var li = el('li'), b = el('button', '', m); b.type = 'button'; b.style.setProperty('--i', i);
      b.setAttribute('aria-label', 'Ask for a quote on the ' + m);
      b.addEventListener('click', function () { ask(m); });
      li.appendChild(b); modelsBox.appendChild(li);
    });
    link.href = SITE + (scale.url || way.url);
    link.textContent = 'See ' + scale.label.toLowerCase() + ' models on volvac.com.tr';
    photo.hidden = !scale.photo;
    if (scale.photo) { img.src = IMG + scale.photo[0]; img.alt = 'Volvac ' + scale.photo[1]; cap.textContent = 'Shown: ' + scale.photo[1]; }
    if (focusIn) { var on = $('[aria-checked="true"]', focusIn); if (on) on.focus(); }
  }
  ui.hidden = false; $('#range').classList.add('is-enhanced'); draw();

  $$('.ways a').forEach(function (a) {
    a.addEventListener('click', function () {
      for (var i = 0; i < RANGE.length; i++) if (RANGE[i].id === a.dataset.way) { state.way = i; state.scale = 0; draw(); }
    });
  });

  /* Quote: a chosen model goes into the form */
  function ask(model) {
    var field = $('#q-machine'); field.value = model;
    $('#contact').scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
    setTimeout(function () { $('#q-name').focus({ preventScroll: true }); }, still ? 0 : 700);
  }
  $$('.ask').forEach(function (b) { b.addEventListener('click', function () { ask(b.dataset.model); }); });

  /* The chamber machine: the packaging station of the 3D scene, on its own in the hero */
  var stage = $('.hero__stage'), canvas = $('#machine'), scene = null;
  var rv = $('#r-v'), rs = $('#r-s');
  var pointer = { x: 0.5, y: 0.5 }, view = { yaw: 0, pitch: 0, sx: 0.12, sy: 0.02 }, turn = { yaw: 0, pitch: 0, drag: null };
  var box = { left: 0, top: 0, w: 1, h: 1 }, seen = true, last = 0, sinceRead = 0, lit = false, hot = false;

  function size() {
    var r = stage.getBoundingClientRect();
    view.sx = window.innerWidth > 900 ? 0.12 : 0; // on wide screens the machine sits clear of the headline
    box = { left: r.left + window.scrollX, top: r.top + window.scrollY, w: Math.max(1, r.width), h: Math.max(1, r.height) };
    if (scene) scene.resize(box.w, box.h, Math.min(window.devicePixelRatio || 1, 1.5));
  }
  function put(node, text, settle) { if (node.textContent !== text) node.textContent = text; node.style.setProperty('--w', settle ? 760 : 380); }
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (!seen || document.hidden) return;
    var ease = 1 - Math.exp(-dt * (turn.drag ? 16 : 4.5));
    view.yaw += (turn.yaw - view.yaw) * ease; view.pitch += (turn.pitch - view.pitch) * ease;
    scene.frame(dt, 5, pointer, still, view);
    if (!lit) { lit = true; body.classList.add('is-lit'); }
    sinceRead += dt;
    if (sinceRead > 0.07) {
      sinceRead = 0; var s = scene.state;
      put(rv, (s.packV < -0.005 ? '−' : '') + Math.abs(s.packV).toFixed(2) + ' bar', s.packSettle);
      put(rs, s.packS, s.packSettle);
    }
  }
  function local(e) { return { x: e.clientX + window.scrollX - box.left, y: e.clientY + window.scrollY - box.top }; }

  function start() {
    try {
      var t = document.createElement('canvas');
      if (window.THREE && window.QMScene && (t.getContext('webgl2') || t.getContext('webgl'))) scene = window.QMScene.create(canvas, { light: true });
    } catch (e) { scene = null; }
    if (!scene) return;
    doc.classList.add('has-3d'); size();
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }).observe(stage);
    window.addEventListener('resize', size); window.addEventListener('load', size);
    $('#run').addEventListener('click', function () { scene.press(5); });

    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      turn.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, far: 0 }; body.classList.add('is-grabbing');
    });
    window.addEventListener('pointermove', function (e) {
      var p = local(e); pointer.x = clamp(p.x / box.w, 0, 1); pointer.y = clamp(p.y / box.h, 0, 1);
      var d = turn.drag;
      if (d && e.pointerId === d.id) {
        var dx = e.clientX - d.x, dy = e.clientY - d.y; d.far = Math.max(d.far, Math.abs(dx) + Math.abs(dy));
        turn.yaw = clamp(-dx / box.w * 3, -1.2, 1.2); turn.pitch = clamp(-dy / box.h * 1.1, -0.3, 0.2);
      } else if (fine && e.target === canvas) {
        var on = scene.pick(p.x, p.y) >= 0;
        if (on !== hot) { hot = on; scene.hover(on); canvas.style.cursor = on ? 'pointer' : ''; }
      }
    }, { passive: true });
    function drop(e) {
      var d = turn.drag; if (!d || e.pointerId !== d.id) return;
      turn.drag = null; turn.yaw = turn.pitch = 0; body.classList.remove('is-grabbing');
      if (e.type === 'pointerup' && d.far < 8) { var p = local(e); if (scene.pick(p.x, p.y) >= 0) scene.press(5); }
    }
    window.addEventListener('pointerup', drop); window.addEventListener('pointercancel', drop);
    requestAnimationFrame(loop);
  }

  var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('600 40px Archivo'), document.fonts.load('700 40px Archivo')]) : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
