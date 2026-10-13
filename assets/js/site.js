/* Page behaviour: drives the camera from scroll, binds readouts, draws the leader line, and passes hands on to the plate. */
(function () {
  'use strict';

  var doc = document.documentElement, body = document.body;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  var stages = $$('.stage[data-key]');
  var sections = $$('[data-name]');
  var main = $('#main'), bar = $('.bar'), scale = $('.scale'), scaleLabel = $('.scale__label');
  var leader = $('#leader'), leaderLine = $('line', leader), leaderDot = $('circle', leader);
  var makers = $('#makers'), contact = $('#contact'), service = $('#service');

  /* Scale ticks */
  (function () {
    var holder = $('.scale__ticks'), n = 80, html = '';
    for (var i = 0; i <= n; i++) html += '<i class="' + (i % 10 === 0 ? 'l' : i % 5 === 0 ? 'm' : '') + '" style="top:' + (i / n * 100) + '%"></i>';
    holder.innerHTML = html;
  })();

  /* Service list reveals once, as one wipe down the list */
  (function () {
    var list = $('.service__list');
    if (!('IntersectionObserver' in window) || still) return;
    $$('li', list).forEach(function (li, i) { li.style.setProperty('--i', i); });
    body.classList.add('io');
    new IntersectionObserver(function (e, o) {
      if (e[0].isIntersecting) { list.classList.add('in'); o.disconnect(); }
    }, { threshold: 0.15 }).observe(list);
  })();

  /* Layout measurements */
  var vh = window.innerHeight, vw = window.innerWidth, centres = [], marks = [], docH = 1;
  var stops = [], free = []; // scroll positions the page rests at, and the ranges inside the long sections that scroll freely
  // Where the middle of the viewport sits when a station is at rest: the place CSS scroll snap brings it to,
  // read from the same alignment and margins the stylesheet gives its snap area.
  function rest(s) {
    var r = s.getBoundingClientRect(), y = window.scrollY, cs = getComputedStyle(s), snap = cs.scrollSnapAlign || '';
    var top = r.top + y - (parseFloat(cs.scrollMarginTop) || 0), bottom = r.bottom + y + (parseFloat(cs.scrollMarginBottom) || 0);
    if (snap.indexOf('start') === 0) return top + vh / 2;
    if (snap.indexOf('end') === 0) return bottom - vh / 2;
    return (top + bottom) / 2;
  }
  function measure() {
    vh = window.innerHeight; vw = window.innerWidth;
    centres = stages.map(rest);
    docH = Math.max(1, doc.scrollHeight - vh);
    // Scroll positions (viewport centre) paired with camera keys; makers spans two keys.
    var mr = makers.getBoundingClientRect(), sr = service.getBoundingClientRect(), y = window.scrollY;
    marks = stages.slice(0, 6).map(function (s, i) { return [centres[i], i]; });
    marks.push([mr.top + y + vh / 2, 6], [mr.bottom + y - vh / 2, 7], [sr.top + y + vh / 2, 8], [sr.bottom + y - vh / 2, 8], [centres[6], 9]);
    free = [mr, sr].map(function (r) { var top = Math.round(r.top + y); return [top, Math.max(top, Math.round(r.bottom + y - vh))]; });
    stops = centres.map(function (c) { return Math.round(c - vh / 2); }).concat(free[0], free[1])
      .map(function (v) { return clamp(v, 0, docH); }).sort(function (a, b) { return a - b; })
      .filter(function (v, i, all) { return !i || v - all[i - 1] > 4; });
  }

  function keyAt(y) {
    var c = y + vh / 2;
    if (c <= marks[0][0]) return 0;
    for (var i = 0; i < marks.length - 1; i++) {
      var a = marks[i], b = marks[i + 1];
      if (c <= b[0]) return b[0] <= a[0] ? b[1] : a[1] + (b[1] - a[1]) * (c - a[0]) / (b[0] - a[0]);
    }
    return marks[marks.length - 1][1];
  }

  function sectionAt(y) {
    for (var i = sections.length - 1; i >= 0; i--) {
      if (sections[i].getBoundingClientRect().top <= y) return sections[i];
    }
    return sections[0];
  }

  /* Readouts */
  var R = {};
  ['hero', 'leak-p', 'leak-d', 'leak-r', 'ref-l', 'ref-h', 'ref-c', 'mark-n', 'bal-s', 'bal-u', 'pack-v', 'pack-s'].forEach(function (k) { R[k] = $('#r-' + k); });
  function put(el, text, settle) {
    if (el.textContent !== text) el.textContent = text;
    el.style.setProperty('--w', settle ? 760 : 380);
  }
  function sign(v, d) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d); }
  function readouts(s) {
    put(R.hero, sign(s.hero, 3) + ' mm', s.heroSettle);
    put(R['leak-p'], s.leakP.toFixed(2) + ' bar', s.leakSettle);
    put(R['leak-d'], s.leakD.toFixed(1) + ' Pa/s', s.leakSettle);
    put(R['leak-r'], s.leakR, s.leakSettle);
    put(R['ref-l'], s.refL.toFixed(1) + ' bar', s.refSettle);
    put(R['ref-h'], s.refH.toFixed(1) + ' bar', s.refSettle);
    put(R['ref-c'], s.refC.toFixed(3) + ' kg', s.refSettle);
    put(R['mark-n'], s.markN + ' of ' + s.markTotal, s.markSettle);
    put(R['bal-s'], s.balS.toLocaleString('en-AU') + ' rpm', s.balSettle);
    put(R['bal-u'], s.balU.toFixed(2) + ' g·mm', s.balSettle);
    put(R['pack-v'], (s.packV < -0.005 ? '−' : '') + Math.abs(s.packV).toFixed(2) + ' bar', s.packSettle);
    put(R['pack-s'], s.packS, s.packSettle);
  }

  /* Chrome that works with or without 3D */
  function chrome() {
    var y = window.scrollY;
    bar.dataset.tone = sectionAt(48).dataset.tone;
    var mid = sectionAt(vh / 2);
    scale.dataset.tone = mid.dataset.tone;
    if (scaleLabel.textContent !== mid.dataset.name) scaleLabel.textContent = mid.dataset.name;
    scale.style.setProperty('--p', clamp(y / docH, 0, 1));
  }

  var scene = null, canvas = $('#plate');
  var pointer = { x: 0.5, y: 0.5 };
  var keySm = 0, last = 0, lit = false, sinceRead = 0;
  var view = { yaw: 0, pitch: 0 };                          // the turn the camera is carrying this frame
  var turn = { yaw: 0, pitch: 0, drag: null }, dim = 1;     // where the visitor is holding the plate; text stands back meanwhile
  var over = null, hotButton = -1;                          // mouse position over open plate, and the model button under it
  var opening = false;

  /* Frame pacing. Every second and a half the median frame time decides whether the plate can afford more or needs
     less: sharper when the GPU has time to spare, softer and then plainer when frames are being missed. A step up is
     taken back if it costs frames. Where the GPU reports that it is idle, slow frames are someone else's limit
     (a battery saver, a slow display) and nothing is given up for them. */
  var pace = { t: 0, ms: [], was: 0, trial: 0, up: true, down: true, wait: 3, room: 0 };
  function govern(raw) {
    if (raw > 0.25) return; // the tab was away
    pace.ms.push(raw * 1000); pace.t += raw;
    if (pace.t < 1.5) return;
    var med = pace.ms.sort(function (a, b) { return a - b; })[pace.ms.length >> 1], gpu = scene.gpuTime(), above = scene.costAbove();
    pace.ms = []; pace.t = 0;
    if (pace.wait > 0) { pace.wait--; pace.was = med; return; } // let the opening, or the last change, settle
    if (pace.trial > 0) { // judging a step up
      if (med > pace.was * 1.2 + 0.5) { scene.step(-1); pace.up = false; }
      pace.trial = 0; pace.wait = 1; return;
    }
    if (pace.trial < 0) { // judging a step down taken blind: if it bought nothing, it is given back
      if (med > pace.was * 0.92) { scene.step(1); pace.down = false; }
      pace.trial = 0; pace.wait = 1; return;
    }
    pace.room = above === -2 || (above >= 0 && above < 10) ? pace.room + 1 : 0;
    if (med > 24 && pace.down && (gpu < 0 || gpu > 12)) {
      if (!scene.step(-1)) pace.down = false; else if (gpu === -2) { pace.trial = -1; pace.was = med; } else pace.wait = 1;
    } else if (med < 17.6 && pace.up && pace.room >= 2) {
      if (scene.step(1)) { pace.trial = 1; pace.was = med; pace.room = 0; } else pace.up = false;
    }
  }

  function reveal() { doc.classList.remove('intro'); }

  function loop(now) {
    requestAnimationFrame(loop);
    var raw = (now - last) / 1000 || 0.016, dt = Math.min(0.05, raw); last = now;
    chrome();
    if (!scene) return;

    var k = keyAt(window.scrollY);
    keySm = still ? k : keySm + (k - keySm) * (1 - Math.exp(-dt * 5.5));

    var viewC = window.scrollY + vh / 2, best = null, bestF = 0;
    stages.forEach(function (s, i) {
      var d = Math.abs(centres[i] - viewC) / vh;
      if (i === 0 && viewC < centres[0]) d = 0;
      if (i === stages.length - 1 && viewC > centres[i]) d = 0;
      var f = 1 - sstep(0.2, 0.6, d);
      s.firstElementChild.style.setProperty('--f', f.toFixed(3));
      if (f > bestF) { bestF = f; best = s; }
    });

    var hidden = vw <= 860 && makers.getBoundingClientRect().top <= 0 && contact.getBoundingClientRect().top >= vh;
    if (hidden) { leader.style.setProperty('--o', 0); return; }

    // The plate turns while it is held and settles back when let go. The text stands back so the model has the screen.
    var ease = 1 - Math.exp(-dt * (turn.drag ? 16 : 4.5));
    view.yaw += (turn.yaw - view.yaw) * ease; view.pitch += (turn.pitch - view.pitch) * ease;
    var dimTo = turn.drag && turn.drag.far > 8 ? 0.08 : 1;
    if (Math.abs(dimTo - dim) > 0.002) { dim += (dimTo - dim) * (1 - Math.exp(-dt * 9)); main.style.setProperty('--dim', dim.toFixed(3)); }

    scene.frame(dt, keySm, pointer, still, view);
    if (!lit) {
      lit = true; body.classList.add('is-lit');
      if (opening) { scene.open(); setTimeout(reveal, 900); }
    }

    govern(raw);

    if (fine) {
      var b = over && !turn.drag ? scene.pick(over.x, over.y) : -1;
      if (b !== hotButton) { hotButton = b; scene.hover(b >= 0); body.classList.toggle('is-press', b >= 0); }
    }

    sinceRead += dt;
    if (sinceRead > 0.07) { sinceRead = 0; readouts(scene.state); }

    // Leader line from the maker tags to the object they describe.
    var from = best && best.querySelector('.tags');
    var a = best ? scene.anchor(+best.dataset.key) : null;
    if (from && a && bestF > 0.05 && vw > 860 && from.classList.contains('tags')) {
      var right = best.dataset.side === 'right', y0 = null;
      $$('li', from).forEach(function (li) { var r = li.getBoundingClientRect(); if (!y0 || (right ? r.left < y0.left - 1 : r.right > y0.right + 1)) y0 = r; });
      leaderLine.setAttribute('x1', right ? y0.left : y0.right); leaderLine.setAttribute('y1', y0.top + y0.height / 2);
      leaderLine.setAttribute('x2', a.x); leaderLine.setAttribute('y2', a.y);
      leaderDot.setAttribute('cx', a.x); leaderDot.setAttribute('cy', a.y);
      leader.dataset.tone = best.dataset.tone;
      leader.style.setProperty('--o', (bestF * bestF * 0.75 * dim).toFixed(3));
    } else {
      leader.style.setProperty('--o', 0);
    }
  }

  function resize() {
    measure();
    if (scene) scene.resize(vw, vh, window.devicePixelRatio);
  }

  function start() {
    var ok = false;
    try { var t = document.createElement('canvas'); ok = !!(window.THREE && window.QMScene && (t.getContext('webgl2') || t.getContext('webgl'))); } catch (e) { ok = false; }
    if (ok) {
      try {
        scene = window.QMScene.create(canvas, { lens: fine || window.innerWidth > 860 });
        body.classList.add('has-3d');
      } catch (e) { scene = null; body.classList.remove('has-3d'); }
    }
    resize();
    keySm = keyAt(window.scrollY);
    // The opening plays once, from the top of the page, when the plate can be drawn and motion is welcome.
    opening = !!scene && !still && window.scrollY < 8 && doc.classList.contains('intro');
    if (!opening) reveal();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('load', measure);
  window.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) { pointer.x = t.clientX / vw; pointer.y = t.clientY / vh; } }, { passive: true });

  /* Wheel and keys travel one stop at a time, so a notch of the wheel is a whole flight to the next station.
     Inside the two long sections they scroll as usual. Touch and the scrollbar are left to CSS scroll snap. */
  var wheel = { at: 0, size: 0, lock: 0 };
  function roomInside(y, dir) {
    for (var i = 0; i < free.length; i++) {
      if (y >= free[i][0] - 2 && y <= free[i][1] + 2 && (dir > 0 ? y < free[i][1] - 1 : y > free[i][0] + 1)) return true;
    }
    return false;
  }
  function step(dir) {
    var y = window.scrollY, to = null, i;
    if (dir > 0) { for (i = 0; i < stops.length; i++) if (stops[i] > y + 4) { to = stops[i]; break; } }
    else { for (i = stops.length - 1; i >= 0; i--) if (stops[i] < y - 4) { to = stops[i]; break; } }
    if (to !== null) window.scrollTo({ top: to, behavior: still ? 'auto' : 'smooth' });
  }
  window.addEventListener('wheel', function (e) {
    var dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
    if (!dir || e.ctrlKey || roomInside(window.scrollY, dir)) return;
    e.preventDefault();
    // One gesture, one stop: a new gesture starts after a pause, or when the wheel is pushed harder than it was coasting.
    var now = performance.now(), size = Math.abs(e.deltaY);
    var fresh = now - wheel.at > 140 || size > wheel.size * 1.6 + 6;
    wheel.at = now; wheel.size = size;
    if (!fresh || now < wheel.lock) return;
    wheel.lock = now + 480;
    step(dir);
  }, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = e.target && e.target.tagName, space = e.key === ' ';
    if (space && (tag === 'BUTTON' || tag === 'A')) return; // space presses the thing in focus
    var dir = e.key === 'ArrowDown' || e.key === 'PageDown' || (space && !e.shiftKey) ? 1
      : e.key === 'ArrowUp' || e.key === 'PageUp' || (space && e.shiftKey) ? -1 : 0;
    if (!dir || roomInside(window.scrollY, dir)) return;
    e.preventDefault();
    step(dir);
  });

  /* Hands on the plate: drag open stone to turn the view, press the orange buttons on the models. */
  function openPlate(e) { return !!(e.target.classList && e.target.classList.contains('stage')); }
  main.addEventListener('pointerdown', function (e) {
    if (!scene || !openPlate(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    turn.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, far: 0 };
    body.classList.add('is-grabbing');
  });
  main.addEventListener('mousedown', function (e) { if (scene && openPlate(e)) e.preventDefault(); }); // no text selection while turning
  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX / vw; pointer.y = e.clientY / vh;
    over = e.pointerType === 'mouse' && openPlate(e) ? { x: e.clientX, y: e.clientY } : null;
    var d = turn.drag;
    if (!d || e.pointerId !== d.id) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.far = Math.max(d.far, Math.abs(dx) + Math.abs(dy));
    turn.yaw = clamp(-dx / vw * 3, -1.1, 1.1);
    turn.pitch = clamp(-dy / vh * 1.1, -0.3, 0.2);
  }, { passive: true });
  function drop(e) {
    var d = turn.drag;
    if (!d || e.pointerId !== d.id) return;
    turn.drag = null; turn.yaw = turn.pitch = 0; body.classList.remove('is-grabbing');
    if (e.type === 'pointerup' && d.far < 8) { var s = scene.pick(e.clientX, e.clientY); if (s >= 0) scene.press(s); }
  }
  window.addEventListener('pointerup', drop);
  window.addEventListener('pointercancel', drop);

  $('#zero').addEventListener('click', function () { if (scene) scene.zero(); });
  $$('[data-run]').forEach(function (b) {
    b.addEventListener('click', function () { if (scene) scene.press(+b.dataset.run); });
  });

  // A maker's row lifts its gauge block and draws the camera to it.
  $$('.rows a').forEach(function (row, n) {
    function on() { if (scene) scene.maker(n); }
    function off() { if (scene) scene.maker(-1); }
    row.addEventListener('pointerenter', on); row.addEventListener('pointerleave', off);
    row.addEventListener('focus', on); row.addEventListener('blur', off);
  });

  // The dial faces are drawn with the page's typeface, so wait for it (briefly).
  var fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('600 40px Archivo'), document.fonts.load('800 40px Archivo')])
    : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
