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
  // The finder's 3D window: which machine on the plate does each way of packing, and what it is called there.
  var STATION = { vacuum: [0, 5, 'chamber vacuum machine'], tray: [1, 1, 'tray sealer'], skin: [1, 1, 'tray sealer'], thermo: [1, 1, 'tray sealer'], shrink: [2, 2, 'dip tank'], slice: [3, 3, 'slicer'] };
  var fview = null; // set once the finder's 3D window is running

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
    photo.hidden = !scale.photo && !fview;
    if (fview) {
      var st = STATION[way.id];
      if (fview.key !== st[0]) { fview.key = st[0]; fview.tick = st[1]; fview.rerun = 1.1; }
      img.hidden = !scale.photo;
      cap.textContent = 'Illustrative 3D ' + st[2] + (scale.photo ? '. Photo: Volvac ' + scale.photo[1] : '') + '.';
    }
    if (scale.photo && img.getAttribute('src') !== IMG + scale.photo[0]) { photo.classList.remove('swap'); void photo.offsetWidth; photo.classList.add('swap'); }
    if (scale.photo) { img.src = IMG + scale.photo[0]; img.alt = 'Volvac ' + scale.photo[1]; if (!fview) cap.textContent = 'Shown: ' + scale.photo[1]; }
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
  var drifts = $$('[data-drift]'), layers = $$('[data-px]'), zoom = $('.about__window img');
  var lastY = window.scrollY, lastT = 0, vel = 0;
  var vh = window.innerHeight, vw = window.innerWidth, centres = [], marks = [], docH = 1;

  (function () {
    var holder = $('.scale__ticks'), n = 80, html = '';
    for (var i = 0; i <= n; i++) html += '<i class="' + (i % 10 === 0 ? 'l' : i % 5 === 0 ? 'm' : '') + '" style="top:' + (i / n * 100) + '%"></i>';
    holder.innerHTML = html;
  })();

  if ('IntersectionObserver' in window && !still) {
    // Headings in the later sections rise word by word out of a mask. The text stays whole for screen readers.
    $$('.solid h2').forEach(function (h) {
      var n = 0;
      function wrap(node) { var w = el('span', 'w'), inner = el('span'); inner.style.setProperty('--wi', n++); w.appendChild(inner); h.insertBefore(w, node); inner.appendChild(node); }
      Array.prototype.slice.call(h.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          c.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            var t = document.createTextNode(part); h.insertBefore(t, c);
            if (!/^\s+$/.test(part)) wrap(t);
          });
          h.removeChild(c);
        } else if (c.nodeName !== 'BR') wrap(c);
      });
      h.classList.remove('rv'); h.classList.add('split');
    });
    // List rows slide in one after another.
    $$('.foods__list li, .facts li, .news__list li, .lines li').forEach(function (li) {
      li.parentNode.classList.remove('rv');
      li.classList.add('rv', 'rv--x'); li.style.setProperty('--d', Array.prototype.indexOf.call(li.parentNode.children, li));
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    $$('.rv').forEach(function (n, i) { if (!n.style.getPropertyValue('--d')) n.style.setProperty('--d', i % 3); io.observe(n); });
    $$('.machine, .split').forEach(function (n) { io.observe(n); });
    // The red seal line draws across each section as it arrives.
    var seal = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('sealed'); seal.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -30% 0px' });
    $$('.solid').forEach(function (s) { seal.observe(s); });
    // Real figures count up once, from the first number of the same length so the line never shifts.
    var counter = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        counter.unobserve(e.target);
        var node = e.target, to = +node.dataset.to, from = Math.pow(10, String(to).length - 1), t0 = performance.now();
        node.textContent = from;
        (function step(now) { var p = Math.min(1, (now - t0) / 1700); node.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: 1 });
    $$('.count').forEach(function (c) { counter.observe(c); });
  } else {
    $$('.rv, .machine').forEach(function (n) { n.classList.add('in'); });
    $$('.solid').forEach(function (n) { n.classList.add('sealed'); });
  }

  // Product photos lean toward the pointer.
  if (fine && !still) $$('.machine__photo').forEach(function (p) {
    p.addEventListener('pointermove', function (e) {
      var r = p.getBoundingClientRect();
      p.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 7).toFixed(2) + 'deg');
      p.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 6).toFixed(2) + 'deg');
    });
    p.addEventListener('pointerleave', function () { p.style.setProperty('--rx', '0deg'); p.style.setProperty('--ry', '0deg'); });
  });

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
    // Scroll speed, smoothed: the marquee rows lean into it.
    var now = performance.now(), dtc = lastT ? Math.max(1, now - lastT) : 16;
    vel += ((y - lastY) / dtc - vel) * 0.16; lastY = y; lastT = now;
    var lean = clamp(vel * 5, -9, 9).toFixed(2);
    // The factory shot starts close and pulls back as it crosses the screen.
    if (zoom) {
      var zr = zoom.parentNode.getBoundingClientRect();
      if (zr.bottom > 0 && zr.top < vh) zoom.style.setProperty('--s', (1.22 - 0.22 * clamp((vh - zr.top) / (vh + zr.height), 0, 1)).toFixed(4));
    }
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
      drifts[j].style.setProperty('--k', lean);
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

  /* The finder's 3D window: a second view of the same plate, started when the finder comes near, drawn only while seen */
  function finder3d() {
    var cv = $('#f-3d'), box = $('#f-photo'), fs = null, seen = false, t = 0, prev = 0;
    var turn = { yaw: 0, pitch: 0, drag: null }, view = { yaw: 0, pitch: 0, sx: 0, sy: 0.02, zoom: 0.62 }, pt = { x: 0.5, y: 0.5 };
    try { fs = window.QMScene.create(cv, { volvac: true }); } catch (e) { return; }
    doc.classList.add('f3d');
    fview = { key: STATION[RANGE[pickd.way].id][0], tick: STATION[RANGE[pickd.way].id][1], k: STATION[RANGE[pickd.way].id][0], rerun: 0 };
    function size() { var r = box.getBoundingClientRect(); view.sy = r.width < 560 ? 0.13 : 0.02; view.zoom = r.width < 560 ? 0.7 : 0.62; fs.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(window.devicePixelRatio || 1, 1.5)); }
    draw(); size(); window.addEventListener('resize', size);
    new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }).observe(box);
    cv.addEventListener('pointerdown', function (e) { turn.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, far: 0 }; cv.classList.add('is-grabbing'); });
    window.addEventListener('pointermove', function (e) {
      var d = turn.drag; if (!d || e.pointerId !== d.id) return;
      var r = box.getBoundingClientRect(), dx = e.clientX - d.x, dy = e.clientY - d.y; d.far = Math.max(d.far, Math.abs(dx) + Math.abs(dy));
      turn.yaw = clamp(-dx / r.width * 3, -1.3, 1.3); turn.pitch = clamp(-dy / r.height * 1.1, -0.3, 0.25);
    }, { passive: true });
    function drop(e) {
      var d = turn.drag; if (!d || e.pointerId !== d.id) return;
      turn.drag = null; turn.yaw = turn.pitch = 0; cv.classList.remove('is-grabbing');
      if (e.type === 'pointerup' && d.far < 8) { var r = box.getBoundingClientRect(), s = fs.pick(e.clientX - r.left, e.clientY - r.top); if (s >= 0) fs.press(s); }
    }
    window.addEventListener('pointerup', drop); window.addEventListener('pointercancel', drop);
    (function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
      if (!seen || document.hidden) return;
      t += dt;
      fview.k = still ? fview.key : fview.k + (fview.key - fview.k) * (1 - Math.exp(-dt * 2.6));
      if (fview.rerun > 0) { fview.rerun -= dt; if (fview.rerun <= 0) fs.press(fview.tick); } // run the machine again once the camera arrives
      var idle = turn.drag || still ? 0 : Math.sin(t * 0.35) * 0.22; // a slow turntable sway when left alone
      var ease = 1 - Math.exp(-dt * (turn.drag ? 16 : 3.5));
      view.yaw += (turn.yaw + idle - view.yaw) * ease; view.pitch += (turn.pitch - view.pitch) * ease;
      fs.frame(dt, fview.k, pt, true, view);
    })(0);
  }
  if ('IntersectionObserver' in window) {
    var near = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      near.disconnect();
      try { var tc = document.createElement('canvas'); if (window.THREE && window.QMScene && (tc.getContext('webgl2') || tc.getContext('webgl'))) finder3d(); } catch (e) {}
    }, { rootMargin: '600px 0px' });
    near.observe($('#finder'));
  }

  var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('600 40px Archivo'), document.fonts.load('700 40px Archivo')]) : Promise.resolve();
  Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
