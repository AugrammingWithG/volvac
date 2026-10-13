/* Volvac homepage: camera travel across the plate, readouts, parallax, the machine finder and the quote prefill. */
(function () {
  'use strict';

  var doc = document.documentElement, body = document.body;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* Finder ------------------------------------------------------------- */
  /* The range as Volvac's own navigation groups it. A photo is shown only where it is of a model in that group. */
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
  var waysBox = $('#f-ways'), scalesBox = $('#f-scales'), modelsBox = $('#f-models');
  var count = $('#f-count'), link = $('#f-link'), photo = $('#f-photo'), img = $('#f-img'), cap = $('#f-cap');
  var pickd = { way: 0, scale: 2 };

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
    var way = RANGE[pickd.way], scale = way.scales[pickd.scale];
    radio(waysBox, RANGE.map(function (w) { return w.label; }), pickd.way, function (i, key) { pickd.way = i; pickd.scale = 0; draw(key && waysBox); });
    radio(scalesBox, way.scales.map(function (s) { return s.label; }), pickd.scale, function (i, key) { pickd.scale = i; draw(key && scalesBox); });
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
  $('#finder-ui').hidden = false; $('#rangelist').classList.add('is-enhanced'); draw();
  $$('[data-way]').forEach(function (a) {
    a.addEventListener('click', function () {
      for (var i = 0; i < RANGE.length; i++) if (RANGE[i].id === a.dataset.way) { pickd.way = i; pickd.scale = 0; draw(); }
    });
  });
  function ask(model) {
    $('#q-machine').value = model;
    $('#contact').scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
    setTimeout(function () { $('#q-name').focus({ preventScroll: true }); }, still ? 0 : 800);
  }
  $$('.ask').forEach(function (b) { b.addEventListener('click', function () { ask(b.dataset.model); }); });

  /* Chrome, reveals and parallax: work with or without 3D -------------- */
  var stages = $$('.stage[data-key]'), sections = $$('[data-name]');
  var bar = $('.bar'), scale = $('.scale'), scaleLabel = $('.scale__label'), finder = $('#finder'), main = $('#main');
  var drifts = $$('[data-drift]'), layers = $$('[data-px]');
  var vh = window.innerHeight, vw = window.innerWidth, centres = [], marks = [], docH = 1;

  (function () {
    var holder = $('.scale__ticks'), n = 80, html = '';
    for (var i = 0; i <= n; i++) html += '<i class="' + (i % 10 === 0 ? 'l' : i % 5 === 0 ? 'm' : '') + '" style="top:' + (i / n * 100) + '%"></i>';
    holder.innerHTML = html;
  })();

  if ('IntersectionObserver' in window && !still) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    $$('.rv').forEach(function (n, i) { n.style.setProperty('--d', i % 3); io.observe(n); });
    $$('.machine').forEach(function (n) { io.observe(n); });
  } else $$('.rv, .machine').forEach(function (n) { n.classList.add('in'); });

  function measure() {
    vh = window.innerHeight; vw = window.innerWidth;
    var y = window.scrollY;
    centres = stages.map(function (s) { var r = s.getBoundingClientRect(); return r.top + y + r.height / 2; });
    docH = Math.max(1, doc.scrollHeight - vh);
    marks = centres.map(function (c, i) { return [c, i]; });
    marks.push([finder.getBoundingClientRect().top + y + vh * 0.35, stages.length]); // the camera lifts away as the finder arrives
  }
  function keyAt(y) {
    var c = y + vh / 2;
    if (c <= marks[0][0]) return 0;
    for (var i = 0; i < marks.length - 1; i++) {
      var a = marks[i], b = marks[i + 1];
      if (c <= b[0]) return a[1] + (b[1] - a[1]) * (c - a[0]) / (b[0] - a[0]);
    }
    return marks[marks.length - 1][1];
  }
  function sectionAt(y) {
    for (var i = sections.length - 1; i >= 0; i--) if (sections[i].getBoundingClientRect().top <= y) return sections[i];
    return sections[0];
  }
  function chrome() {
    var y = window.scrollY, mid = sectionAt(vh / 2);
    bar.dataset.tone = sectionAt(48).dataset.tone;
    scale.dataset.tone = mid.dataset.tone;
    if (scaleLabel.textContent !== mid.dataset.name) scaleLabel.textContent = mid.dataset.name;
    scale.style.setProperty('--p', clamp(y / docH, 0, 1));
    if (still) return;
    // Parallax: layers move against the scroll by a share of their distance from the middle of the screen.
    for (var i = 0; i < layers.length; i++) {
      var r = layers[i].parentNode.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      layers[i].style.setProperty('--y', ((r.top + r.height / 2 - vh / 2) * -layers[i].dataset.px).toFixed(1));
    }
    for (var j = 0; j < drifts.length; j++) {
      var d = drifts[j].getBoundingClientRect();
      if (d.bottom < -100 || d.top > vh + 100) continue;
      drifts[j].style.setProperty('--x', ((d.top - vh) * 0.35 * drifts[j].dataset.drift).toFixed(1));
    }
  }

  /* The plate ---------------------------------------------------------- */
  var scene = null, canvas = $('#plate');
  var pointer = { x: 0.5, y: 0.5 }, view = { yaw: 0, pitch: 0 }, turn = { yaw: 0, pitch: 0, drag: null }, dim = 1;
  var keySm = 0, last = 0, lit = false, sinceRead = 0, over = null, hotButton = -1, opening = false;
  var pace = { t: 0, ms: [], wait: 3, down: true };

  var R = {};
  ['v', 's', 'tn', 'ts', 'kt', 'ks', 'sn', 'sr'].forEach(function (k) { R[k] = $('#r-' + k); });
  function put(node, text, settle) { if (node.textContent !== text) node.textContent = text; node.style.setProperty('--w', settle ? 760 : 380); }
  function readouts(s) {
    put(R.v, (s.packV < -0.005 ? '−' : '') + Math.abs(s.packV).toFixed(2) + ' bar', s.packSettle);
    put(R.s, s.packS, s.packSettle);
    put(R.tn, s.trayN + ' of 4', s.traySettle); put(R.ts, s.trayS, s.traySettle);
    put(R.kt, Math.round(s.tankT) + ' °C', s.tankSettle); put(R.ks, s.tankS, s.tankSettle);
    put(R.sn, String(s.sliceN), s.sliceSettle); put(R.sr, s.sliceR + ' rpm', s.sliceSettle);
  }
  function reveal() { doc.classList.remove('intro'); }

  // Give up lens quality before frames: if the median frame is slow and the GPU is the reason, step down.
  function govern(raw) {
    if (raw > 0.25 || !pace.down) return;
    pace.ms.push(raw * 1000); pace.t += raw;
    if (pace.t < 1.5) return;
    var med = pace.ms.sort(function (a, b) { return a - b; })[pace.ms.length >> 1], gpu = scene.gpuTime();
    pace.ms = []; pace.t = 0;
    if (pace.wait > 0) { pace.wait--; return; }
    if (med > 24 && (gpu < 0 || gpu > 12)) { if (!scene.step(-1)) pace.down = false; pace.wait = 1; }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    var raw = (now - last) / 1000 || 0.016, dt = Math.min(0.05, raw); last = now;
    chrome();
    if (!scene) return;
    var k = keyAt(window.scrollY);
    keySm = still ? k : keySm + (k - keySm) * (1 - Math.exp(-dt * 5.5));
    var viewC = window.scrollY + vh / 2;
    stages.forEach(function (s, i) {
      var d = Math.abs(centres[i] - viewC) / vh;
      if (i === 0 && viewC < centres[0]) d = 0;
      s.firstElementChild.style.setProperty('--f', (1 - sstep(0.2, 0.58, d)).toFixed(3));
    });
    if (finder.getBoundingClientRect().top <= 0) return; // the plate is covered
    var ease = 1 - Math.exp(-dt * (turn.drag ? 16 : 4.5));
    view.yaw += (turn.yaw - view.yaw) * ease; view.pitch += (turn.pitch - view.pitch) * ease;
    var dimTo = turn.drag && turn.drag.far > 8 ? 0.08 : 1;
    if (Math.abs(dimTo - dim) > 0.002) { dim += (dimTo - dim) * (1 - Math.exp(-dt * 9)); main.style.setProperty('--dim', dim.toFixed(3)); }
    scene.frame(dt, keySm, pointer, still, view);
    if (!lit) { lit = true; body.classList.add('is-lit'); if (opening) { scene.open(); setTimeout(reveal, 900); } }
    govern(raw);
    if (fine) {
      var b = over && !turn.drag ? scene.pick(over.x, over.y) : -1;
      if (b !== hotButton) { hotButton = b; scene.hover(b >= 0); body.classList.toggle('is-press', b >= 0); }
    }
    sinceRead += dt;
    if (sinceRead > 0.07) { sinceRead = 0; readouts(scene.state); }
  }
  function resize() { measure(); if (scene) scene.resize(vw, vh, window.devicePixelRatio); }
  function start() {
    try {
      var t = document.createElement('canvas');
      if (window.THREE && window.QMScene && (t.getContext('webgl2') || t.getContext('webgl'))) scene = window.QMScene.create(canvas, { volvac: true, lens: fine || window.innerWidth > 900 });
    } catch (e) { scene = null; }
    if (scene) doc.classList.add('has-3d');
    resize();
    keySm = keyAt(window.scrollY);
    opening = !!scene && !still && window.scrollY < 8 && doc.classList.contains('intro');
    if (!opening) reveal();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('load', measure);
  window.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) { pointer.x = t.clientX / vw; pointer.y = t.clientY / vh; } }, { passive: true });

  /* Hands on the plate: drag open ground to turn the view, press the red buttons on the machines */
  function openPlate(e) { return !!(e.target.classList && e.target.classList.contains('stage')); }
  main.addEventListener('pointerdown', function (e) {
    if (!scene || !openPlate(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    turn.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, far: 0 }; body.classList.add('is-grabbing');
  });
  main.addEventListener('mousedown', function (e) { if (scene && openPlate(e)) e.preventDefault(); });
  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX / vw; pointer.y = e.clientY / vh;
    over = e.pointerType === 'mouse' && openPlate(e) ? { x: e.clientX, y: e.clientY } : null;
    var d = turn.drag;
    if (!d || e.pointerId !== d.id) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y; d.far = Math.max(d.far, Math.abs(dx) + Math.abs(dy));
    turn.yaw = clamp(-dx / vw * 3, -1.1, 1.1); turn.pitch = clamp(-dy / vh * 1.1, -0.3, 0.2);
  }, { passive: true });
  function drop(e) {
    var d = turn.drag; if (!d || e.pointerId !== d.id) return;
    turn.drag = null; turn.yaw = turn.pitch = 0; body.classList.remove('is-grabbing');
    if (e.type === 'pointerup' && d.far < 8) { var s = scene.pick(e.clientX, e.clientY); if (s >= 0) scene.press(s); }
  }
  window.addEventListener('pointerup', drop); window.addEventListener('pointercancel', drop);
  $$('[data-run]').forEach(function (b) { b.addEventListener('click', function () { if (scene) scene.press(+b.dataset.run); }); });

  var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('600 40px Archivo'), document.fonts.load('700 40px Archivo')]) : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
