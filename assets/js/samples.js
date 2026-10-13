/* Three sample posts in Volvac's current brand, as on volvac.com.tr: their wordmark, their red and navy, and the
   grey studio light their product pages sit in. Each post is one canvas, a still from the 3D scene with type set on
   top, so a saved PNG is exactly what is on screen. samples.html shows them as a contact sheet; the proposal draws
   the same posts as thumbnails. Words and model names are taken from volvac.com.tr. */
(function () {
  'use strict';

  var RED = '#f20000', NAVY = '#19385f', TEXT2 = '#34445a', PALE = '#aebfdc';
  var SLANT = 0.27;  // the lean of the strokes in the Volvac wordmark, as a skew (about 15 degrees)
  var LEAN = 0.2;    // headlines lean a little less than the wordmark
  var STUDIO = '216,219,219'; // the pale ground of the scene, for washes behind type
  var FORMATS = [
    { id: 'portrait', w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
    { id: 'landscape', w: 1200, h: 627, label: 'Landscape 1200 × 627' }
  ];

  /* Drawing helpers ----------------------------------------------------- */

  function font(x, weight, size, stretch, spacing) {
    x.font = weight + ' ' + size + 'px Archivo, Arial, sans-serif';
    if ('fontStretch' in x) x.fontStretch = stretch || 'normal';
    if ('letterSpacing' in x) x.letterSpacing = (spacing || 0) + 'px';
  }
  function wrap(x, text, maxW) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (line && x.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }
  function leaning(x, text, px, py, k) {
    x.save(); x.translate(px, py); x.transform(1, 0, -(k == null ? LEAN : k), 1, 0, 0); x.fillText(text, 0, 0); x.restore();
  }
  // A bar leaning like the strokes of the wordmark. (x0, y0 + h) is its bottom left corner.
  function bar(x, x0, y0, w, h, color) {
    var k = h * SLANT;
    x.fillStyle = color; x.beginPath();
    x.moveTo(x0 + k, y0); x.lineTo(x0 + w + k, y0); x.lineTo(x0 + w, y0 + h); x.lineTo(x0, y0 + h); x.closePath(); x.fill();
  }
  // Their product pages sit in a grey studio: bright in the middle, falling off to the edges.
  function studio(x, w, h, cx, cy, edge) {
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.sqrt(w * w + h * h) * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(34,38,44,' + (edge || 0.4) + ')');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  // Pale light behind type, fading out from (ax, ay) to (bx, by).
  function wash(x, ax, ay, bx, by, a) {
    var g = x.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, 'rgba(' + STUDIO + ',' + a + ')'); g.addColorStop(0.55, 'rgba(' + STUDIO + ',' + a * 0.7 + ')'); g.addColorStop(1, 'rgba(' + STUDIO + ',0)');
    x.fillStyle = g; x.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax) || x.canvas.width, Math.abs(by - ay) || x.canvas.height);
  }

  var logoImg = null, tints = {};
  function logo(x, px, py, w, color) {
    if (!logoImg) return 0;
    var t = tints[color];
    if (!t) {
      t = document.createElement('canvas'); t.width = logoImg.width; t.height = logoImg.height;
      var c = t.getContext('2d'); c.drawImage(logoImg, 0, 0);
      c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, t.width, t.height);
      tints[color] = t;
    }
    var h = w * logoImg.height / logoImg.width;
    x.drawImage(t, px, py, w, h);
    return h;
  }

  // Small capitals with a red leaning tick in front. Right aligned when `right` is set.
  function label(x, text, px, py, size, color, right) {
    font(x, 650, size, 'condensed', size * 0.14);
    var w = x.measureText(text).width, tw = size * 0.42, gap = size * 0.7, left = right ? px - w - tw - gap - size * 0.2 : px;
    bar(x, left, py - size * 0.86, tw, size * 1.0, RED);
    x.fillStyle = color; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillText(text, left + tw + size * 0.27 + gap, py);
  }
  // Leaning headline. Each line is [text, colour]. The size shrinks until the widest line fits maxW.
  function headline(x, lines, px, y, size, lh, maxW) {
    for (; size > 10; size -= 2) {
      font(x, 820, size, 'expanded', -size * 0.03);
      var widest = Math.max.apply(null, lines.map(function (l) { return x.measureText(l[0]).width; }));
      if (widest + size * LEAN <= maxW) break;
    }
    lh = lh * size;
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    lines.forEach(function (l, i) { x.fillStyle = l[1]; leaning(x, l[0], px, y + size * 0.78 + i * lh); });
    return y + lines.length * lh;
  }
  function para(x, text, px, y, size, lh, maxW, color) {
    font(x, 420, size, 'normal', 0); x.fillStyle = color; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    var ls = wrap(x, text, maxW);
    ls.forEach(function (l, i) { x.fillText(l, px, y + size * 0.95 + i * lh); });
    return y + ls.length * lh;
  }
  // Model numbers in leaning outlined plates.
  function chips(x, names, px, y, size, color, maxW) {
    var h = Math.round(size * 2.05), pad = size * 0.85, gap = size * 0.45, k = h * SLANT * 0.8, cx = px, cy = y;
    font(x, 680, size, 'condensed', size * 0.05);
    names.forEach(function (n) {
      var w = x.measureText(n).width + pad * 2;
      if (cx > px && cx + w + k > px + maxW) { cx = px; cy += h + gap; }
      x.beginPath(); x.moveTo(cx + k, cy); x.lineTo(cx + w + k, cy); x.lineTo(cx + w, cy + h); x.lineTo(cx, cy + h); x.closePath();
      x.strokeStyle = color; x.lineWidth = Math.max(1.5, size / 11); x.stroke();
      x.fillStyle = color; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText(n, cx + pad + k * 0.45, cy + h / 2 + size * 0.06);
      cx += w + gap + k;
    });
    x.textBaseline = 'alphabetic';
    return cy + h;
  }
  // Red bar in from the left edge with a line of capitals on it, and the web address on the same line at the right.
  function foot(x, f, text, urlColor) {
    var P = f.id === 'portrait', M = P ? 72 : 56, h = P ? 80 : 46, y = f.h - (P ? 70 : 34) - h, size = P ? 27 : 16;
    font(x, 720, size, 'condensed', size * 0.12);
    var w = M + x.measureText(text).width + (P ? 40 : 26);
    bar(x, -h * SLANT - 4, y, w + 4, h, RED);
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText(text, M, y + h / 2 + size * 0.36);
    font(x, 640, P ? 26 : 16, 'semi-condensed', P ? 0.6 : 0.4);
    x.fillStyle = urlColor; x.textAlign = 'right'; x.fillText('volvac.com.tr', f.w - M, y + h / 2 + size * 0.36);
    x.textAlign = 'left';
  }

  /* The posts ------------------------------------------------------------ */
  // cam(scene, portrait): the still to render, in the terms of QMScene's shot(). paint(x, f, still): the post itself.
  // Positions are given relative to the camera keys of the stations used: 5 the vacuum packer, 3 the marking station.

  var POSTS = [
    {
      slug: 'vacuum-packaging', name: 'Vacuum packaging',
      alt: 'Air out. Freshness sealed in. Volvac chamber vacuum packaging machines.',
      cam: function (S, P) {
        var t = S.keys[5].t;
        return P
          ? { p: [t[0] - 14, 17.5, 40], t: [t[0] + 0.6, 2.4, 0.6], sx: 0.03, sy: -0.25, fov: 30, act: { 5: 0.65 }, ink: 'off' }
          : { p: [t[0] - 8.5, 11.5, 23], t: [t[0] + 0.4, 3.2, 0.6], sx: 0.245, sy: 0.03, fov: 30, act: { 5: 0.65 }, ink: 'off' };
      },
      paint: function (x, f, still) {
        var P = f.id === 'portrait', W = f.w, H = f.h, M = P ? 72 : 56;
        x.drawImage(still, 0, 0);
        if (P) wash(x, 0, 0, 0, 800, 0.93); else wash(x, 0, 0, 720, 0, 0.94);
        studio(x, W, H, P ? W * 0.5 : W * 0.68, P ? H * 0.66 : H * 0.55);
        logo(x, M, P ? 70 : 42, P ? 290 : 190, RED);
        label(x, 'VACUUM PACKAGING', W - M, P ? 112 : 70, P ? 22 : 14, NAVY, true);
        var y = headline(x, [['Air out.', NAVY], ['Freshness', NAVY], ['sealed in.', RED]], M, P ? 214 : 116, P ? 128 : 70, 0.94, P ? 860 : 520);
        y = para(x, 'Chamber vacuum packaging machines for meat, cheese and ready meals, from the bench to the production line.', M, y + (P ? 28 : 16), P ? 32 : 19, P ? 45 : 27, P ? 800 : 470, TEXT2);
        chips(x, ['W 55 PRO', 'W 100 PRO', 'W 110 C', 'W 135 C'], M, y + (P ? 30 : 18), P ? 22 : 13, NAVY, P ? 900 : 520);
        foot(x, f, 'THE RIGHT WAY TO PACKAGE YOUR PRODUCTS', NAVY);
      }
    },
    {
      slug: 'built-in-istanbul', name: 'Built in Istanbul',
      alt: '42+ countries, one factory. Volvac machines are designed and built in Istanbul.',
      cam: function (S, P) {
        var t = S.keys[3].t, o = P
          ? { p: [t[0] - 2.2, 17, 19.5], t: [t[0] + 0.6, 1.0, -0.2], sx: 0, sy: 0.245, fov: 30 }
          : { p: [t[0] + 1.5, 13, 19], t: [t[0] + 0.9, 1.4, -0.2], sx: 0.25, sy: 0.04, fov: 28, gantry: false };
        o.act = { 3: 0.997 }; o.plate = ['VOLVAC', 'ISTANBUL']; o.ink = 'off';
        return o;
      },
      paint: function (x, f, still) {
        var P = f.id === 'portrait', W = f.w, H = f.h, M = P ? 72 : 56;
        x.drawImage(still, 0, 0);
        if (P) { wash(x, 0, H, 0, 520, 0.95); wash(x, 0, 0, 0, 230, 0.7); } else wash(x, 0, 0, 760, 0, 0.96);
        studio(x, W, H, P ? W * 0.5 : W * 0.7, P ? H * 0.3 : H * 0.5);
        logo(x, M, P ? 70 : 42, P ? 290 : 190, RED);
        var top = P ? 690 : 118, num = P ? 330 : 178;
        font(x, 900, num, 'expanded', -num * 0.045); x.fillStyle = RED; x.textAlign = 'left';
        leaning(x, '42+', M - num * 0.05, top + num * 0.73);
        var y = headline(x, [['countries,', NAVY], ['one factory.', NAVY]], M, top + num * 0.8, P ? 70 : 40, 1.0, P ? 900 : 520);
        para(x, 'Volvac machines are designed and built in our Istanbul factory to ISO standards, CE certified, and kept in stock for fast delivery.', M, y + (P ? 22 : 14), P ? 29 : 18, P ? 41 : 25, P ? 880 : 480, TEXT2);
        foot(x, f, 'BUILT IN ISTANBUL', NAVY);
      }
    },
    {
      slug: 'the-range', name: 'The range',
      alt: 'Packaging solutions that add value to your brand. The Volvac range, with contact details.',
      cam: function (S, P) {
        var t = S.keys[5].t;
        return P
          ? { w: 1080, h: 750, p: [t[0] + 14, 15, 28], t: [t[0] - 0.4, 4.4, 0], sx: 0.1, sy: -0.11, fov: 28, act: { 5: 1 }, ink: 'off' }
          : { w: 700, h: 627, p: [t[0] + 13, 14, 25.5], t: [t[0] - 0.2, 4.4, 0], sx: 0.07, sy: -0.02, fov: 31, act: { 5: 1 }, ink: 'off' };
      },
      paint: function (x, f, still) {
        var P = f.id === 'portrait', W = f.w, H = f.h, M = P ? 72 : 56;
        x.fillStyle = NAVY; x.fillRect(0, 0, W, H);
        // The still sits in a window cut on the lean of the wordmark, with a red edge.
        var cut = P ? [750, 620] : [500, 500 + H * SLANT]; // the window's lower edge in portrait, its left edge in landscape
        x.save(); x.beginPath();
        if (P) { x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, cut[1]); x.lineTo(0, cut[0]); }
        else { x.moveTo(cut[1], 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(cut[0], H); }
        x.closePath(); x.clip();
        x.drawImage(still, P ? 0 : cut[0], 0);
        studio(x, W, P ? cut[0] : H, P ? W * 0.55 : 860, P ? 360 : H * 0.5, 0.45);
        x.restore();
        x.fillStyle = RED; x.beginPath();
        if (P) { x.moveTo(0, cut[0]); x.lineTo(W, cut[1]); x.lineTo(W, cut[1] + 14); x.lineTo(0, cut[0] + 14); }
        else { x.moveTo(cut[1], 0); x.lineTo(cut[1] - 12, 0); x.lineTo(cut[0] - 12, H); x.lineTo(cut[0], H); }
        x.closePath(); x.fill();

        if (P) { logo(x, M, 70, 290, RED); label(x, 'THE RANGE', W - M, 112, 22, NAVY, true); }
        else logo(x, M, 42, 190, '#ffffff');
        var y = headline(x, [['Packaging solutions', '#ffffff'], ['that add value', '#ffffff'], ['to your brand.', RED]], M, P ? 806 : 108, P ? 72 : 44, 1.0, P ? 900 : 430);

        var range = [
          ['Tray sealing', 'E 26 to E 52, PTS 83'], ['Vacuum packaging', 'W 55 PRO to W 135 C'],
          ['Dip tanks and shrink tunnels', 'DT 650, ST 75'], ['Slicing', 'S 20']
        ];
        var cols = P ? 2 : 1, cw = P ? (W - M * 2 - 40) / 2 : 400, rh = P ? 88 : 58, gy = y + (P ? 32 : 22);
        range.forEach(function (r, i) {
          var cx = M + (i % cols) * (cw + 40), cy = gy + Math.floor(i / cols) * rh;
          x.fillStyle = 'rgba(255,255,255,0.28)'; x.fillRect(cx, cy, cw, 1);
          font(x, 650, P ? 18 : 11, 'condensed', P ? 2.2 : 1.4); x.fillStyle = PALE; x.fillText(r[0].toUpperCase(), cx, cy + (P ? 30 : 19));
          font(x, 640, P ? 30 : 19, 'semi-condensed', 0); x.fillStyle = '#ffffff'; x.fillText(r[1], cx, cy + (P ? 68 : 43));
        });
        var by = gy + Math.ceil(range.length / cols) * rh + 4;
        x.fillStyle = 'rgba(255,255,255,0.28)'; x.fillRect(M, by, P ? W - M * 2 : 400, 1);
        // Contact: phone and email, on a line of their own below the range.
        font(x, 640, P ? 28 : 16, 'semi-condensed', 0.3); x.fillStyle = '#ffffff';
        var ly = P ? by + 62 : H - 34;
        x.textAlign = 'left'; x.fillText('+90 216 441 10 72', M, ly);
        x.textAlign = P ? 'right' : 'left'; x.fillText('info@volvac.com.tr', P ? W - M : M + 200, ly);
        x.textAlign = 'left';
      }
    }
  ];

  /* Rendering ------------------------------------------------------------ */

  function draw(scene, i, formatId) {
    var post = POSTS[i], f = FORMATS.filter(function (g) { return g.id === formatId; })[0];
    var c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    var x = c.getContext('2d'), o = post.cam(scene, f.id === 'portrait');
    o.w = o.w || f.w; o.h = o.h || f.h;
    post.paint(x, f, scene.shot(o));
    return c;
  }

  var fonts = document.fonts && document.fonts.load
    ? Promise.all(['420', '650', '820', '900'].map(function (w) { return document.fonts.load(w + ' 30px Archivo'); }))
    : Promise.resolve();
  var art = new Promise(function (ok) {
    if (!window.VOLVAC_LOGO) return ok();
    var img = new Image();
    img.onload = function () { logoImg = img; ok(); }; img.onerror = function () { ok(); };
    img.src = window.VOLVAC_LOGO.src;
  });
  var ready = Promise.race([Promise.all([fonts, art]), new Promise(function (r) { setTimeout(r, 2500); })]);

  window.VolvacSamples = { posts: POSTS, formats: FORMATS, ready: ready, draw: draw };

  /* Contact sheet (samples.html) ----------------------------------------- */

  function save(canvas, name) {
    return new Promise(function (done) {
      canvas.toBlob(function (blob) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); done(); }, 350);
      }, 'image/png');
    });
  }

  function sheet() {
    var list = document.getElementById('samples');
    if (!list) return;
    var status = document.getElementById('status'), all = document.getElementById('all'), saved = [], scene;
    try { scene = window.QMScene.create(document.createElement('canvas')); }
    catch (e) { status.textContent = 'This browser could not start WebGL, so the posts cannot be rendered. Try Chrome, Edge or Brave with graphics acceleration on.'; return; }

    var i = 0;
    (function next() {
      if (i >= POSTS.length) {
        status.textContent = 'All ' + saved.length + ' images are ready.';
        all.disabled = false; window.__ready = true;
        return;
      }
      var post = POSTS[i], li = document.createElement('li'); li.className = 'post';
      var h = document.createElement('h2'); h.textContent = post.name; li.appendChild(h);
      var pair = document.createElement('div'); pair.className = 'post__pair'; li.appendChild(pair);
      FORMATS.forEach(function (f) {
        var c = draw(scene, i, f.id), name = 'volvac-sample-' + (i + 1) + '-' + post.slug + '-' + f.id + '-' + f.w + 'x' + f.h + '.png';
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', post.alt + ' (' + f.label + ')');
        var fig = document.createElement('figure'); fig.className = 'art'; fig.appendChild(c);
        var cap = document.createElement('figcaption'), sp = document.createElement('span'); sp.textContent = f.label; cap.appendChild(sp);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'save'; b.textContent = 'Save PNG';
        b.addEventListener('click', function () { save(c, name); });
        cap.appendChild(b); fig.appendChild(cap); pair.appendChild(fig);
        saved.push({ canvas: c, name: name });
      });
      list.appendChild(li);
      i++; status.textContent = 'Rendering the posts… ' + i + ' of ' + POSTS.length;
      setTimeout(next, 30);
    })();

    all.addEventListener('click', function () {
      all.disabled = true;
      saved.reduce(function (p, s) { return p.then(function () { return save(s.canvas, s.name); }); }, Promise.resolve())
        .then(function () { all.disabled = false; });
    });
  }
  ready.then(sheet, sheet);
})();
