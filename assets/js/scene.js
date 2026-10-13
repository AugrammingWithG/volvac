/* The Surface Plate: one granite inspection plate, six groups of instruments on it.
   Everything is modelled in code; there are no external model or image files. */
(function () {
  'use strict';
  var T = window.THREE;
  if (!T) return;

  var PI = Math.PI;
  var ST0 = 44, GAP = 34; // x of the first station after the hero, and spacing

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function expoOut(t) { return t >= 1 ? 1 : t <= 0 ? 0 : 1 - Math.pow(2, -10 * t); }
  function cubeOut(t) { var u = 1 - clamp(t, 0, 1); return u * u * u; } // 1 at the start, settling to 0
  function V(x, y, z) { return new T.Vector3(x, y, z); }

  // Every opaque surface also writes how far it is from the camera, over this reach in plate units, into the alpha
  // channel. The lens reads it there to focus. The canvas has no alpha channel of its own, so drawing straight to the
  // screen is unaffected.
  var REACH = 80, OUT = T.ShaderChunk.opaque_fragment !== undefined ? 'opaque_fragment' : 'output_fragment';
  if (T.ShaderChunk[OUT].indexOf('gl_FragCoord.w') < 0) {
    T.ShaderChunk[OUT] += ['', '#ifdef OPAQUE', 'gl_FragColor.a = clamp( 1.0 / ( gl_FragCoord.w * ' + REACH.toFixed(1) + ' ), 0.0, 1.0 );', '#endif', ''].join(String.fromCharCode(10));
  }
  // See-through things blend their colour as usual and leave the stored distance of whatever is behind them alone.
  function sheer(m) {
    m.blending = T.CustomBlending; m.blendSrc = T.SrcAlphaFactor; m.blendDst = T.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = T.ZeroFactor; m.blendDstAlpha = T.OneFactor;
    return m;
  }

  /* Textures ----------------------------------------------------------- */

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c) { var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  function font(x, weight, size, stretch) {
    x.font = weight + ' ' + size + 'px Archivo, Arial, sans-serif';
    if ('fontStretch' in x) x.fontStretch = stretch || 'normal';
  }

  function speckleTexture() {
    var S = 1024, c = canvas(S, S), x = c.getContext('2d');
    x.fillStyle = '#cdd0cf'; x.fillRect(0, 0, S, S);
    var tones = ['#4f5458', '#63686c', '#8b9093', '#a9adae', '#eef0ef', '#f7f8f7', '#b7ada3'];
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 30000; i++) {
      var px = rnd() * S, py = rnd() * S, r = 0.5 + rnd() * rnd() * 2.6;
      x.globalAlpha = 0.25 + rnd() * 0.6;
      x.fillStyle = tones[(rnd() * tones.length) | 0];
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var qx = px + ox * S, qy = py + oy * S;
        if (qx < -4 || qx > S + 4 || qy < -4 || qy > S + 4) continue;
        x.beginPath(); x.ellipse(qx, qy, r, r * (0.6 + rnd() * 0.6), rnd() * PI, 0, 2 * PI); x.fill();
      }
    }
    x.globalAlpha = 1;
    var t = tex(c); t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  // Where the engineer's blue has been wiped onto the plate: solid, then dry brush strokes.
  function inkMask() {
    var W = 512, H = 4096, c = canvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff'; x.fillRect(0, 0, W * 0.84, H);
    var seed = 21;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var y = 0;
    while (y < H) {
      var h = 2 + rnd() * rnd() * 26, end = W * (0.85 + rnd() * rnd() * 0.14 + Math.sin(y * 0.004) * 0.02);
      var g = x.createLinearGradient(W * 0.82, 0, end, 0);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.75, 'rgba(255,255,255,' + (0.55 + rnd() * 0.45) + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(W * 0.82, y, end - W * 0.82, h);
      y += h * (0.35 + rnd() * 0.8);
    }
    var t = new T.CanvasTexture(c);
    return t;
  }

  function faceTexture(o) {
    var S = 1024, c = canvas(S, S), x = c.getContext('2d');
    x.fillStyle = o.bg || '#f3f2ec'; x.fillRect(0, 0, S, S);
    x.translate(S / 2, S / 2);
    var fg = o.fg || '#15181c';
    if (o.band) {
      x.lineWidth = 34; x.strokeStyle = o.band.color;
      x.beginPath(); x.arc(0, 0, 418, o.band.a0 - PI / 2, o.band.a1 - PI / 2); x.stroke();
    }
    for (var i = 0; i <= o.n; i++) {
      if (o.full && i === o.n) break;
      var a = o.a0 + (o.a1 - o.a0) * i / o.n;
      var major = i % o.major === 0, mid = i % (o.major / 2) === 0;
      x.save(); x.rotate(a); x.fillStyle = fg;
      var len = major ? 78 : mid ? 56 : 36, w = major ? 9 : 4.5;
      x.fillRect(-w / 2, -476, w, len); x.restore();
      if (major) {
        font(x, 600, o.numSize || 76, 'condensed');
        x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(o.label(i), Math.sin(a) * 338, -Math.cos(a) * 338 + 4);
      }
    }
    (o.lines || []).forEach(function (l) {
      font(x, l.w || 600, l.s, l.st || 'condensed');
      x.fillStyle = l.c || fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(l.t, 0, l.y);
    });
    if (o.sub) { // small revolution counter
      x.strokeStyle = fg; x.lineWidth = 4; x.beginPath(); x.arc(0, -150, 62, 0, 2 * PI); x.stroke();
      for (var k = 0; k < 10; k++) { x.save(); x.translate(0, -150); x.rotate(k * PI / 5); x.fillStyle = fg; x.fillRect(-2, -62, 4, 14); x.restore(); }
      x.save(); x.translate(0, -150); x.rotate(0.9); x.fillRect(-3, -48, 6, 54); x.restore();
    }
    return tex(c);
  }

  /* Scene -------------------------------------------------------------- */

  function create(canvasEl, opts) {
    opts = opts || {};
    // With the lens the plate is antialiased in the lens's own target, so the canvas itself does not need to be.
    var lensWanted = !!opts.lens && (function () { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
    // The canvas is made without an alpha channel, so the distances written into alpha never show through it.
    var attrs = { alpha: false, depth: true, stencil: false, antialias: !lensWanted, powerPreference: 'high-performance' };
    var context = canvasEl.getContext('webgl2', attrs) || canvasEl.getContext('webgl', attrs);
    var renderer = new T.WebGLRenderer({ canvas: canvasEl, context: context, antialias: !lensWanted, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // frame() asks for it when the light or a caster has moved

    // GPU time for a frame now and then, where the browser will report it. The page uses it to hold the frame rate.
    var timer = (function () {
      var gl = renderer.getContext(), ext = renderer.capabilities.isWebGL2 && gl.getExtension('EXT_disjoint_timer_query_webgl2');
      return ext ? { gl: gl, ext: ext, q: gl.createQuery(), busy: false, n: 0, ms: -1 } : null;
    })();

    var scene = new T.Scene();
    var BG_INK = new T.Color(0x081648), BG_STONE = new T.Color(0xd2d5d4), BG_BLACK = new T.Color(0x0a0b0d);
    scene.background = BG_INK.clone();
    scene.fog = new T.Fog(BG_INK.clone(), 42, 112);

    var camera = new T.PerspectiveCamera(32, 1, 0.5, 400);

    /* Lens: depth of field, bloom, a faint vignette and grain, in a few small passes drawn over the plate.
       The plate is drawn into a texture exactly as it would be drawn to the screen (same tone mapping, same encoding,
       same antialiasing), so with the effects switched off the picture is identical to drawing it directly.
       Depth for the focus comes from the alpha channel, where every opaque surface has written its distance. */
    function makeLens() {
      var gl = renderer.getContext();
      var cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new T.Scene(), tri = new T.BufferGeometry();
      tri.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
      tri.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
      var mesh = new T.Mesh(tri); mesh.frustumCulled = false; quad.add(mesh);

      var VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      // Signed circle of confusion from a stored distance: negative in front of the focal plane, positive behind it.
      var COC = 'uniform float uFocus;\nfloat coc(float d) { float k = (d - uFocus) / max(d, 0.001); return sign(k) * smoothstep(0.08, 0.46, abs(k)); }';
      var focus = { value: 0.4 };
      function material(frag, uniforms, focused) {
        if (focused) uniforms.uFocus = focus;
        return new T.ShaderMaterial({
          vertexShader: VERT, fragmentShader: 'varying vec2 vUv;\n' + (focused ? COC + '\n' : '') + frag,
          uniforms: uniforms, depthTest: false, depthWrite: false, toneMapped: false
        });
      }

      // Quarter size: the plate again, each tap weighted by how far out of focus it is, so sharp things do not smear.
      // Alpha carries the signed circle of confusion, packed into 0..1.
      var mSoft = material([
        'uniform sampler2D tColor; uniform vec2 uTexel;',
        'void tap(vec2 uv, inout vec3 acc, inout float ws, inout float cs) { vec4 s = texture2D(tColor, uv); float c = coc(s.a); float w = abs(c) + 0.03; acc += s.rgb * w; ws += w; cs += c; }',
        'void main() {',
        '  vec3 acc = vec3(0.0); float ws = 0.0; float cs = 0.0; vec2 o = uTexel;',
        '  tap(vUv + vec2(-o.x, -o.y), acc, ws, cs); tap(vUv + vec2(o.x, -o.y), acc, ws, cs);',
        '  tap(vUv + vec2(-o.x, o.y), acc, ws, cs); tap(vUv + vec2(o.x, o.y), acc, ws, cs);',
        '  gl_FragColor = vec4(acc / ws, 0.5 + 0.125 * cs);',
        '}'
      ].join('\n'), { tColor: { value: null }, uTexel: { value: new T.Vector2() } }, true);

      var mBlur = material([
        'uniform sampler2D tSrc; uniform vec2 uDir;',
        'void main() {',
        '  vec3 acc = vec3(0.0); float ws = 0.0; float cs = 0.0; float gs = 0.0;',
        '  for (int i = -4; i <= 4; i++) {',
        '    float f = float(i); float g = exp(-f * f / 8.0);',
        '    vec4 s = texture2D(tSrc, vUv + uDir * f);',
        '    float c = s.a * 2.0 - 1.0; float w = g * (abs(c) + 0.03);',
        '    acc += s.rgb * w; ws += w; cs += c * g; gs += g;',
        '  }',
        '  gl_FragColor = vec4(acc / ws, 0.5 + 0.5 * cs / gs);',
        '}'
      ].join('\n'), { tSrc: { value: null }, uDir: { value: new T.Vector2() } });

      // Quarter size: only what is close to clipping white, which on this plate is light on chrome.
      var mBright = material([
        'uniform sampler2D tColor; uniform vec2 uTexel; uniform float uCut;',
        'void main() {',
        '  vec2 o = uTexel;',
        '  vec3 c = (texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, -o.y)).rgb',
        '    + texture2D(tColor, vUv + vec2(-o.x, o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, o.y)).rgb) * 0.25;',
        '  gl_FragColor = vec4(c * smoothstep(uCut, 1.0, dot(c, vec3(0.2126, 0.7152, 0.0722))), 1.0);',
        '}'
      ].join('\n'), { tColor: { value: null }, uTexel: { value: new T.Vector2() }, uCut: { value: 0.95 } });

      var mOut = material([
        'uniform sampler2D tColor; uniform sampler2D tSoft; uniform sampler2D tBloom;',
        'uniform float uBloom; uniform float uVignette; uniform float uGrain; uniform float uSeed;',
        'void main() {',
        '  vec4 base = texture2D(tColor, vUv);',
        '  vec4 soft = texture2D(tSoft, vUv);',
        '  vec3 col = mix(base.rgb, soft.rgb, clamp(max(abs(coc(base.a)), (1.0 - soft.a * 2.0) * 1.4), 0.0, 1.0));',
        '  col += texture2D(tBloom, vUv).rgb * uBloom;',
        '  vec2 q = vUv - 0.5;',
        '  col *= 1.0 - uVignette * smoothstep(0.25, 0.75, dot(q, q) * 1.6);',
        '  col += (fract(sin(dot(gl_FragCoord.xy + uSeed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uGrain;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n'), { tColor: { value: null }, tSoft: { value: null }, tBloom: { value: null }, uBloom: { value: 0.55 }, uVignette: { value: 0.14 }, uGrain: { value: 0.02 }, uSeed: { value: 0 } }, true);

      var mCopy = material('uniform sampler2D tColor; void main() { gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0); }', { tColor: { value: null } });

      var rt = null, fog = new T.Color(), api = { full: true, size: size, render: render };
      function target(w, h, o) { return new T.WebGLRenderTarget(w, h, o || { depthBuffer: false }); }
      function size(w, h) {
        var k;
        if (rt) for (k in rt) rt[k].dispose();
        var qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
        rt = { plate: target(w, h, { samples: 4 }), a: target(qw, qh), b: target(qw, qh), c: target(qw, qh), d: target(qw, qh) };
        // three.js tone maps and encodes for the screen only when it draws to the screen, or into a target flagged like
        // this one. Flagged, the plate lands in the texture already finished, sample by sample, in plain 8-bit storage.
        rt.plate.isXRRenderTarget = true;
        rt.plate.texture.colorSpace = T.SRGBColorSpace; rt.plate.texture.internalFormat = 'RGBA8';
        // Only the colour is resolved out of the multisampled buffer. Resolving its depth as well is slow on
        // integrated graphics, and nothing reads it.
        renderer.properties.get(rt.plate).__ignoreDepthValues = true;
        for (k in rt) {
          renderer.setRenderTarget(rt[k]);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { renderer.setRenderTarget(null); return false; }
        }
        renderer.setRenderTarget(null);
        mSoft.uniforms.tColor.value = mBright.uniforms.tColor.value = mOut.uniforms.tColor.value = mCopy.uniforms.tColor.value = rt.plate.texture;
        mSoft.uniforms.uTexel.value.set(1 / w, 1 / h); mBright.uniforms.uTexel.value.set(1 / w, 1 / h);
        mOut.uniforms.tSoft.value = rt.a.texture; mOut.uniforms.tBloom.value = rt.c.texture;
        return true;
      }
      function draw(m, to) { mesh.material = m; renderer.setRenderTarget(to); renderer.render(quad, cam); }
      function blur(from, to, x, y) { mBlur.uniforms.tSrc.value = from.texture; mBlur.uniforms.uDir.value.set(x, y); draw(mBlur, to); }
      function render(distance, time) {
        // Fog and the cleared ground are mixed in after encoding, and into a texture three.js hands them over unencoded.
        fog.copy(scene.fog.color); scene.fog.color.convertLinearToSRGB(); scene.background.copy(scene.fog.color);
        renderer.setRenderTarget(rt.plate); renderer.render(scene, camera);
        scene.fog.color.copy(fog); scene.background.copy(fog);
        if (!api.full) { draw(mCopy, null); return; }
        focus.value = distance / REACH;
        draw(mSoft, rt.a);
        blur(rt.a, rt.b, 1 / rt.a.width, 0); blur(rt.b, rt.a, 0, 1 / rt.a.height);
        draw(mBright, rt.c);
        blur(rt.c, rt.d, 1.6 / rt.c.width, 0); blur(rt.d, rt.c, 0, 1.6 / rt.c.height);
        mOut.uniforms.uSeed.value = Math.floor(time * 24) * 7.13; // grain moves at film rate, not frame rate
        draw(mOut, null);
      }
      return api;
    }

    // Lab lighting as an environment: a dim room with soft boxes overhead.
    (function () {
      var env = new T.Scene();
      function panel(w, h, intensity, pos, rot, color) {
        var m = new T.MeshBasicMaterial({ color: new T.Color(color || 0xffffff).multiplyScalar(intensity), side: T.DoubleSide });
        var p = new T.Mesh(new T.PlaneGeometry(w, h), m);
        p.position.copy(pos); p.rotation.set(rot[0], rot[1], rot[2]); env.add(p);
      }
      env.add(new T.Mesh(new T.BoxGeometry(60, 30, 60), new T.MeshBasicMaterial({ color: 0x4a515a, side: T.BackSide })));
      panel(60, 60, 1, V(0, -14.9, 0), [-PI / 2, 0, 0], 0x8f979c);
      panel(26, 10, 14, V(-4, 14.8, 4), [PI / 2, 0, 0]);
      panel(8, 22, 9, V(-29.8, 2, 6), [0, PI / 2, 0], 0xdfe9ff);
      panel(18, 5, 7, V(8, 6, 29.8), [0, PI, 0]);
      panel(6, 12, 5, V(29.8, 4, -8), [0, -PI / 2, 0], 0xfff1e0);
      var pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(env, 0.035).texture;
      pm.dispose();
    })();

    var sun = new T.DirectionalLight(0xffffff, 1.75);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3.5;
    scene.add(sun, sun.target);
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8f96, 0.14));

    /* Materials */
    var M = {
      steel: new T.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 1, roughness: 0.2 }),
      brushed: new T.MeshStandardMaterial({ color: 0xbfc5ca, metalness: 1, roughness: 0.42 }),
      chrome: new T.MeshStandardMaterial({ color: 0xe6e9ec, metalness: 1, roughness: 0.07 }),
      alu: new T.MeshStandardMaterial({ color: 0xd3d6d8, metalness: 0.9, roughness: 0.5 }),
      black: new T.MeshStandardMaterial({ color: 0x17191c, metalness: 0.5, roughness: 0.45 }),
      rubber: new T.MeshStandardMaterial({ color: 0x1b1c1e, metalness: 0, roughness: 0.8 }),
      enamel: new T.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.2, roughness: 0.38 }),
      inkPaint: new T.MeshStandardMaterial({ color: 0x1b3aa6, metalness: 0.25, roughness: 0.35 }),
      white: new T.MeshStandardMaterial({ color: 0xe4e7e9, metalness: 0.1, roughness: 0.4 }),
      brass: new T.MeshStandardMaterial({ color: 0xb9975a, metalness: 1, roughness: 0.3 }),
      needle: new T.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff4a10, emissiveIntensity: 0.35, roughness: 0.5 }),
      button: new T.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff4a10, emissiveIntensity: 0.35, roughness: 0.5 }),
      glass: sheer(new T.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02, transparent: true, opacity: 0.13, depthWrite: false })),
      hoseBlue: new T.MeshStandardMaterial({ color: 0x1d4fc4, roughness: 0.55 }),
      hoseRed: new T.MeshStandardMaterial({ color: 0xc4281d, roughness: 0.55 }),
      hoseYellow: new T.MeshStandardMaterial({ color: 0xe0b21a, roughness: 0.55 }),
      product: new T.MeshStandardMaterial({ color: 0xe6c463, roughness: 0.6 }),
      film: sheer(new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.08, transparent: true, opacity: 0.22, depthWrite: false })),
      dot: new T.MeshStandardMaterial({ color: 0x24272b, metalness: 0.4, roughness: 0.9 })
    };

    /* Builders */
    function mesh(g, m, noShadow) { var o = new T.Mesh(g, m); if (!noShadow) { o.castShadow = true; o.receiveShadow = true; } return o; }
    function cyl(rt, rb, h, m, seg) { return mesh(new T.CylinderGeometry(rt, rb, h, seg || 40), m); }
    function at(o, x, y, z) { o.position.set(x, y, z); return o; }
    function rbox(w, h, d, r, m) {
      var s = new T.Shape(), x = -w / 2, y = -h / 2;
      r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      var b = Math.min(r * 0.5, 0.07, d / 4);
      var g = new T.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 6 });
      g.translate(0, 0, -(d - 2 * b) / 2);
      return mesh(g, m);
    }
    function tube(points, r, m) {
      var curve = new T.CatmullRomCurve3(points.map(function (p) { return V(p[0], p[1], p[2]); }));
      return mesh(new T.TubeGeometry(curve, 80, r, 12, false), m);
    }
    function dial(o) {
      var g = new T.Group(), d = o.depth;
      var body = cyl(o.r, o.r, d, o.body || M.black, 64); body.rotation.x = PI / 2; g.add(body);
      var face = new T.Mesh(new T.CircleGeometry(o.r * 0.93, 64), new T.MeshStandardMaterial({ map: o.tex, roughness: 0.75 }));
      face.position.z = d / 2 + 0.012; face.receiveShadow = true; g.add(face);
      var bez = mesh(new T.TorusGeometry(o.r * 0.965, o.r * 0.075, 20, 96), o.bezel || M.chrome); bez.position.z = d / 2 + 0.02; g.add(bez);
      var n = new T.Group(); n.position.z = d / 2 + 0.06;
      var s = new T.Shape(), L = o.r * 0.8, t = o.r * 0.2, w = o.r * 0.034;
      s.moveTo(-w, -t); s.lineTo(w, -t); s.lineTo(w * 0.3, L); s.lineTo(-w * 0.3, L); s.closePath();
      n.add(new T.Mesh(new T.ShapeGeometry(s), M.needle));
      var cap = cyl(o.r * 0.075, o.r * 0.075, 0.06, M.black, 24); cap.rotation.x = PI / 2; cap.position.z = 0.03; n.add(cap);
      g.add(n); g.needle = n;
      var glass = new T.Mesh(new T.CircleGeometry(o.r * 0.93, 48), M.glass); glass.position.z = d / 2 + 0.14; g.add(glass);
      g.parts = [face, n, bez, glass]; // back to front
      g.parts.forEach(function (p) { p.userData.z = p.position.z; });
      return g;
    }
    function gaugeTex(max, step, unit, bg, fg, band) {
      return faceTexture({
        a0: -0.75 * PI, a1: 0.75 * PI, n: 50, major: 10, bg: bg, fg: fg, band: band, numSize: 92,
        label: function (i) { return String(Math.round(max * i / 50 * 10) / 10); },
        lines: [{ t: unit, y: 170, s: 70, w: 700 }, { t: 'VOLVAC', y: 290, s: 56, w: 700, st: 'normal' }]
      });
    }

    // Soft contact shadow painted under each object so it sits on the stone.
    var blobTex = (function () {
      var c = canvas(256, 256), x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 20, 128, 128, 128);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      return new T.CanvasTexture(c);
    })();
    function blob(parent, x, z, w, d, o) {
      var m = new T.Mesh(new T.PlaneGeometry(w, d), sheer(new T.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: o || 0.5, depthWrite: false, color: 0x05070c })));
      m.rotation.x = -PI / 2; m.position.set(x, 0.02, z); m.renderOrder = 1; parent.add(m); return m;
    }

    // Things on the models you can press. Each gets a generous unseen target, and gives a little when pressed.
    var press = [], targets = [], HIT = new T.MeshBasicMaterial({ visible: false });
    function pressable(s, o, axis, depth, r) {
      var t = new T.Mesh(new T.SphereGeometry(r, 10, 8), HIT); t.userData.s = s; o.add(t); targets.push(t);
      press.push({ s: s, o: o, axis: axis, base: axis === 'turn' ? o.rotation.z : o.position[axis], depth: depth, t: 0 });
    }

    /* The plate */
    var speck = speckleTexture();
    speck.repeat.set(44, 24);
    var plate = new T.Mesh(new T.PlaneGeometry(440, 240), new T.MeshStandardMaterial({ color: 0xbfc3c3, map: speck, roughness: 0.46, metalness: 0 }));
    plate.rotation.x = -PI / 2; plate.position.set(110, 0, 0); plate.receiveShadow = true; scene.add(plate);

    // Engineer's blue: an opaque sheet where the plate has been wiped, and a narrow see-through strip where the
    // brush ran dry. Opaque, the sheet hides the stone under it, so the hero shades one ground and not two.
    var INK = { from: -112, to: 8.2, dry: 17.8 };
    function inkStuff(map, mask) {
      var m = new T.MeshStandardMaterial({
        color: 0x0d2a9a, map: map, alphaMap: mask || null, transparent: !!mask, roughness: 0.36, metalness: 0.05,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      });
      return mask ? sheer(m) : m;
    }
    var speckInk = speck.clone(); speckInk.needsUpdate = true;
    var ink = new T.Mesh(new T.PlaneGeometry(1, 240), inkStuff(speckInk));
    ink.rotation.x = -PI / 2; ink.receiveShadow = true; ink.renderOrder = -1; scene.add(ink); // drawn before the stone it hides
    var speckDry = speck.clone(); speckDry.needsUpdate = true; speckDry.repeat.set(INK.dry / 10, 24);
    var dryMask = inkMask(); dryMask.repeat.x = 0.162; dryMask.offset.x = 0.838; // the dry end of the mask only
    var inkDry = new T.Mesh(new T.PlaneGeometry(INK.dry, 240), inkStuff(speckDry, dryMask));
    inkDry.rotation.x = -PI / 2; inkDry.receiveShadow = true; scene.add(inkDry);
    function inkTo(edge, shown) { // lay the ink out as far as this x; the dry strip runs on from there
      var w = edge - INK.from;
      ink.scale.x = w; ink.position.set(INK.from + w / 2, 0.004, 0); speckInk.repeat.set(w / 10, 24);
      inkDry.position.set(edge + INK.dry / 2 - 0.04, 0.004, 0);
      ink.visible = inkDry.visible = shown !== false;
    }
    inkTo(INK.to);

    var state = {
      hero: 0, heroSettle: 0,
      leakP: 0, leakD: 0, leakR: 'Filling', leakSettle: 0,
      refL: 0, refH: 0, refC: 0, refSettle: 0,
      markN: 0, markTotal: 0, markSettle: 0,
      balS: 0, balU: 4.8, balSettle: 0,
      packV: 0, packS: 'Open', packSettle: 0
    };
    var act = [0, 0, 0, 0, 0, 0];
    var tick = [];
    var anchors = [];

    /* 0. Dial indicator on a stand, over two gauge blocks ---------------- */
    var heroDial, heroLoose;
    (function () {
      var g = new T.Group(); scene.add(g);
      g.add(at(rbox(3.6, 1.0, 0.95, 0.03, M.steel), 0, 0.5, 0));
      g.add(at(rbox(3.6, 0.5, 0.95, 0.03, M.chrome), 0.08, 1.25, 0));
      var loose = at(rbox(3.6, 0.8, 0.95, 0.03, M.steel), 4.4, 0.4, 2.6); loose.rotation.y = 0.5; g.add(loose);
      heroLoose = new T.Group(); g.add(heroLoose);
      var loose2 = at(rbox(3.6, 0.3, 0.95, 0.03, M.chrome), 5.6, 0.15, 5.4); loose2.rotation.y = -0.3; heroLoose.add(loose, loose2);

      g.add(at(rbox(4.4, 3.0, 3.8, 0.28, M.enamel), -5.6, 1.5, -0.3));
      var sw = cyl(0.55, 0.55, 0.5, M.chrome, 32); sw.rotation.x = PI / 2; g.add(at(sw, -5.6, 1.5, 1.8));
      var lever = at(rbox(0.22, 0.9, 0.2, 0.05, M.button), -5.6, 1.5, 2.1); g.add(lever);
      pressable(0, lever, 'turn', 0.9, 0.8);
      g.add(at(cyl(0.32, 0.32, 8.4, M.chrome), -5.6, 7.1, -0.3));
      g.add(at(cyl(0.42, 0.42, 0.25, M.black), -5.6, 11.4, -0.3));
      blob(g, -5.6, -0.1, 8, 7, 0.6); blob(g, 0.1, 0.1, 6, 2.6, 0.6); blob(heroLoose, 4.4, 2.7, 5.6, 3.6, 0.5); blob(heroLoose, 5.6, 5.4, 5.4, 3, 0.45);
      g.add(at(rbox(1.5, 1.4, 1.5, 0.15, M.black), -5.6, 9.6, -0.3));
      var knob = cyl(0.42, 0.42, 0.7, M.brushed, 24); knob.rotation.z = PI / 2; g.add(at(knob, -6.7, 9.6, -0.3));
      var arm = cyl(0.26, 0.26, 7.2, M.chrome); arm.rotation.z = PI / 2; g.add(at(arm, -2.4, 9.6, -0.75));
      g.add(at(rbox(0.9, 0.9, 0.9, 0.12, M.black), 0, 9.6, -0.75));
      g.add(at(rbox(0.55, 3.3, 0.28, 0.08, M.brushed), 0, 8.0, -0.66));

      heroDial = dial({
        r: 2.55, depth: 1.0, body: M.brushed,
        tex: faceTexture({
          full: true, a0: 0, a1: 2 * PI, n: 100, major: 10, sub: true,
          label: function (i) { return String(i); },
          lines: [{ t: 'VOLVAC', y: 158, s: 84, w: 700, st: 'normal' }, { t: '0.001 mm', y: 238, s: 54 }]
        })
      });
      heroDial.position.set(0, 6.25, 0); g.add(heroDial);
      g.add(at(cyl(0.2, 0.2, 0.8, M.chrome, 24), 0, 9.05, 0));
      g.add(at(cyl(0.34, 0.34, 0.95, M.brushed, 24), 0, 3.3, 0));
      g.add(at(cyl(0.13, 0.13, 1.25, M.chrome, 20), 0, 2.3, 0));
      g.add(at(mesh(new T.SphereGeometry(0.18, 20, 14), M.chrome), 0, 1.68, 0));
      anchors[0] = V(0, 6.25, 0.6);
          })();

    /* 1. Leak test: instrument, hose, pressure part ---------------------- */
    (function () {
      var g = new T.Group(); g.position.set(ST0, 0, 0); scene.add(g);
      blob(g, -3.9, -1.0, 11, 8.5, 0.55); blob(g, 4.3, 1.3, 9.5, 6, 0.5);
      var unit = new T.Group(); unit.position.set(-3.9, 0, -1.2); unit.rotation.y = 0.28; g.add(unit);
      unit.add(at(rbox(7.2, 4.2, 5, 0.3, M.enamel), 0, 2.4, 0));
      unit.add(at(rbox(6.6, 3.6, 0.1, 0.15, M.black), 0, 2.4, 2.5));
      [-2.9, 2.9].forEach(function (x) { [-1.8, 1.8].forEach(function (z) { unit.add(at(cyl(0.3, 0.3, 0.3, M.rubber, 16), x, 0.15, z)); }); });
      var sc = canvas(512, 288), sx = sc.getContext('2d'), st = tex(sc);
      var screen = new T.Mesh(new T.PlaneGeometry(3.7, 2.08), new T.MeshBasicMaterial({ map: st, toneMapped: false }));
      unit.add(at(screen, -1.05, 2.75, 2.57));
      [0, 1, 2].forEach(function (i) { var k = cyl(0.26, 0.26, 0.3, M.brushed, 24); k.rotation.x = PI / 2; unit.add(at(k, 1.5 + i * 0.75, 3.5, 2.65)); });
      var start = cyl(0.42, 0.42, 0.3, M.button, 28); start.rotation.x = PI / 2; unit.add(at(start, 2.25, 2.3, 2.65));
      pressable(1, start, 'z', 0.1, 0.8);
      var port = cyl(0.24, 0.24, 0.6, M.brass, 20); port.rotation.x = PI / 2; unit.add(at(port, 2.25, 1.15, 2.75));

      var part = new T.Group(); part.position.set(4.3, 0, 1.2); part.rotation.y = -0.22; g.add(part);
      var shell = cyl(1.7, 1.7, 5.2, M.alu, 56); shell.rotation.z = PI / 2; part.add(at(shell, 0, 2.3, 0));
      [-1, 1].forEach(function (s) {
        var end = mesh(new T.SphereGeometry(1.7, 40, 20, 0, 2 * PI, 0, PI / 2), M.alu);
        end.rotation.z = -s * PI / 2; end.scale.y = 0.55; part.add(at(end, s * 2.6, 2.3, 0));
        var fl = cyl(2.05, 2.05, 0.3, M.brushed, 56); fl.rotation.z = PI / 2; part.add(at(fl, s * 2.5, 2.3, 0));
        for (var i = 0; i < 10; i++) {
          var a = i * PI / 5, b = cyl(0.13, 0.13, 0.5, M.steel, 6); b.rotation.z = PI / 2;
          part.add(at(b, s * 2.5, 2.3 + Math.cos(a) * 1.87, Math.sin(a) * 1.87));
        }
        part.add(at(rbox(0.7, 0.7, 3.2, 0.1, M.black), s * 1.5, 0.35, 0));
      });
      part.add(at(cyl(0.2, 0.2, 1.0, M.brass, 20), 0, 4.4, 0));
      var pg = dial({ r: 1.15, depth: 0.6, tex: gaugeTex(5, 1, 'bar', '#f3f2ec', '#15181c') });
      pg.position.set(0, 5.9, 0); part.add(pg);
      var pport = cyl(0.22, 0.22, 0.7, M.brass, 20); pport.rotation.x = PI / 2; part.add(at(pport, -1.2, 2.0, 1.85));

      g.add(tube([[-1.45, 1.15, 2.2], [-1.0, 0.6, 3.6], [0.4, 0.2, 4.6], [2.2, 0.2, 4.4], [3.0, 0.9, 3.7], [3.45, 1.95, 3.2]], 0.15, M.rubber));
      anchors[1] = V(ST0 + 4.3, 4.0, 1.2);

      function draw(a) {
        sx.fillStyle = '#0a1230'; sx.fillRect(0, 0, 512, 288);
        sx.strokeStyle = 'rgba(190,205,255,0.22)'; sx.lineWidth = 1;
        for (var i = 1; i < 6; i++) { sx.beginPath(); sx.moveTo(24, 70 + i * 32); sx.lineTo(488, 70 + i * 32); sx.stroke(); }
        font(sx, 600, 26, 'condensed'); sx.fillStyle = '#c9d4ff'; sx.textAlign = 'left'; sx.textBaseline = 'alphabetic';
        sx.fillText('LEAK TEST', 24, 44);
        sx.textAlign = 'right'; sx.fillText(state.leakR.toUpperCase(), 488, 44);
        sx.strokeStyle = '#ffffff'; sx.lineWidth = 4; sx.beginPath();
        for (var k = 0; k <= 100; k++) {
          var u = k / 100; if (u > a) break;
          var p = u < 0.3 ? smoother(u / 0.3) : 1 - (u - 0.3) * 0.02;
          var X = 24 + u * 464, Y = 262 - p * 170;
          if (k === 0) sx.moveTo(X, Y); else sx.lineTo(X, Y);
        }
        sx.stroke();
        st.needsUpdate = true;
      }
      draw(0);
      tick[1] = function (a, t) {
        var p = a < 0.3 ? 2 * smoother(a / 0.3) : 2 - (a - 0.3) * 0.004;
        state.leakP = p;
        state.leakD = a < 0.5 ? 0 : a < 0.86 ? 0.3 + Math.sin(t * 9) * 0.12 * (0.86 - a) * 3 : 0.3;
        state.leakR = a < 0.3 ? 'Filling' : a < 0.5 ? 'Stabilising' : a < 0.86 ? 'Measuring' : 'Pass';
        state.leakSettle = a >= 0.86 ? 1 : 0;
        pg.needle.rotation.z = -(-0.75 * PI + (p / 5) * 1.5 * PI);
        draw(a);
      };
    })();

    /* 2. Refrigeration: manifold gauge set, hoses, cylinder on a scale ---- */
    (function () {
      var X = ST0 + GAP, g = new T.Group(); g.position.set(X, 0, 0); scene.add(g);
      blob(g, -4.2, -1.3, 7.6, 7.6, 0.6); blob(g, 6.4, 0.3, 8, 8, 0.6);
      g.add(at(cyl(2.3, 2.5, 0.45, M.enamel, 56), -4.2, 0.225, -1.4));
      g.add(at(cyl(0.26, 0.26, 12.6, M.chrome), -4.2, 6.7, -1.4));
      var bar = cyl(0.2, 0.2, 4.6, M.chrome); bar.rotation.z = PI / 2; g.add(at(bar, -2.0, 12.6, -1.4));
      g.add(at(rbox(0.9, 0.9, 0.9, 0.12, M.black), -4.2, 12.6, -1.4));

      var m = new T.Group(); m.position.set(0, 0, -1.4); m.rotation.y = 0.12; g.add(m);
      var hook = mesh(new T.TorusGeometry(0.55, 0.11, 12, 40, PI * 1.5), M.chrome); hook.rotation.z = -PI / 4; m.add(at(hook, 0, 12.05, 0));
      m.add(at(cyl(0.11, 0.11, 1.1, M.chrome, 12), 0, 11.0, 0));
      m.add(at(rbox(6.8, 1.4, 1.2, 0.22, M.alu), 0, 7.2, 0));
      var low = dial({ r: 1.6, depth: 0.8, tex: gaugeTex(10, 2, 'bar', '#16307a', '#f4f6fb'), body: M.inkPaint });
      var high = dial({ r: 1.6, depth: 0.8, tex: gaugeTex(30, 5, 'bar', '#b3261c', '#fbf4f2'), body: new T.MeshStandardMaterial({ color: 0xb3261c, roughness: 0.4, metalness: 0.2 }) });
      m.add(at(low, -1.95, 9.2, 0.1)); m.add(at(high, 1.95, 9.2, 0.1));
      [[-1, M.hoseBlue], [1, M.hoseRed]].forEach(function (s) {
        var k = cyl(0.62, 0.62, 0.9, s[1], 10); k.rotation.z = PI / 2; m.add(at(k, s[0] * 3.85, 7.2, 0));
      });
      [-1.95, 0, 1.95].forEach(function (x) { m.add(at(cyl(0.24, 0.24, 0.8, M.brass, 20), x, 6.2, 0)); });
      var sight = cyl(0.36, 0.36, 0.2, M.chrome, 28); sight.rotation.x = PI / 2; m.add(at(sight, 0, 7.2, 0.65));

      g.add(at(rbox(5, 0.7, 5, 0.18, M.enamel), 6.4, 0.35, 0.2));
      g.add(at(rbox(4.6, 0.12, 4.6, 0.12, M.brushed), 6.4, 0.76, 0.2));
      var tare = cyl(0.27, 0.27, 0.18, M.button, 24); tare.rotation.x = PI / 2; g.add(at(tare, 4.85, 0.36, 2.72));
      pressable(2, tare, 'z', 0.07, 0.75);
      g.add(at(cyl(1.75, 1.75, 5.4, M.white, 56), 6.4, 3.52, 0.2));
      var dome = mesh(new T.SphereGeometry(1.75, 48, 20, 0, 2 * PI, 0, PI / 2), M.white); dome.scale.y = 0.6; g.add(at(dome, 6.4, 6.22, 0.2));
      g.add(at(cyl(1.77, 1.77, 1.1, M.inkPaint, 56), 6.4, 4.6, 0.2));
      var collar = mesh(new T.CylinderGeometry(1.15, 1.15, 1.3, 40, 1, true, 0.5, PI * 1.6), new T.MeshStandardMaterial({ color: 0xe4e7e9, metalness: 0.1, roughness: 0.4, side: T.DoubleSide }));
      g.add(at(collar, 6.4, 7.75, 0.2));
      g.add(at(cyl(0.28, 0.34, 0.9, M.brass, 20), 6.4, 7.55, 0.2));
      var hw = cyl(0.5, 0.5, 0.22, M.hoseBlue, 8); g.add(at(hw, 6.4, 8.15, 0.2));

      g.add(tube([[-1.9, 5.85, -1.3], [-2.3, 3.2, -0.2], [-3.2, 0.5, 2.2], [-4.6, 0.2, 4.6], [-6.4, 0.2, 6.4], [-6.0, 0.2, 8.6]], 0.19, M.hoseBlue));
      g.add(tube([[2.0, 5.85, -1.5], [2.3, 3.4, -0.2], [1.6, 0.6, 2.6], [-0.4, 0.2, 5.0], [-1.6, 0.2, 7.6], [-0.4, 0.2, 9.8]], 0.19, M.hoseRed));
      g.add(tube([[0.05, 5.85, -1.4], [0.5, 3.6, -0.2], [2.2, 1.6, 1.8], [4.2, 2.2, 2.4], [5.2, 5.4, 1.4], [5.9, 7.5, 0.5]], 0.19, M.hoseYellow));
      anchors[2] = V(X, 9.0, -1.2);

      tick[2] = function (a, t) {
        var e = 1 - Math.pow(1 - clamp(a / 0.8, 0, 1), 3);
        var wob = (1 - sstep(0.8, 1, a)) * Math.sin(t * 7) * 0.06;
        state.refL = 4.2 * e + wob; state.refH = 16.8 * e + wob * 3; state.refC = 0.65 * clamp(a / 0.95, 0, 1);
        state.refSettle = a >= 0.98 ? 1 : 0;
        low.needle.rotation.z = -(-0.75 * PI + (state.refL / 10) * 1.5 * PI);
        high.needle.rotation.z = -(-0.75 * PI + (state.refH / 30) * 1.5 * PI);
      };
    })();

    /* 3. Marking: a dot peen head striking a nameplate ------------------- */
    (function () {
      var X = ST0 + GAP * 2, g = new T.Group(); g.position.set(X, 0, 0); scene.add(g);
      var F = {
        'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
        'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
        'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
        'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
        '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
        'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
        'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
        'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
        '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
        '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
        '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
        ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
      };
      var P = 0.165, top = 1.13, pts = [];
      [['VOLVAC', -1.45], ['EST 2004', 0.3]].forEach(function (ln) {
        var w = ln[0].length * 6 - 1, x0 = -w * P / 2;
        for (var c = 0; c < ln[0].length; c++) for (var col = 0; col < 5; col++) for (var row = 0; row < 7; row++) {
          if (F[ln[0][c]][row][col] === '1') pts.push([x0 + (c * 6 + col) * P, ln[1] + row * P]);
        }
      });
      state.markTotal = pts.length;

      blob(g, 0, 0.2, 16, 10, 0.6);
      g.add(at(rbox(12, 0.6, 6.4, 0.18, M.enamel), 0, 0.3, 0));
      [-3.6, 3.6].forEach(function (x) { g.add(at(rbox(0.9, 0.3, 4.4, 0.05, M.steel), x, 0.75, 0)); });
      var np = rbox(9.6, 0.2, 4.2, 0.06, M.brushed); g.add(at(np, 0, 1.01, 0));
      var strike = cyl(0.36, 0.36, 0.16, M.button, 24); g.add(at(strike, 5.35, 0.66, 2.55));
      pressable(3, strike, 'y', 0.06, 0.8);
      [[-4.35, -1.65], [4.35, -1.65], [-4.35, 1.65], [4.35, 1.65]].forEach(function (p) {
        var h = new T.Mesh(new T.CircleGeometry(0.16, 20), M.rubber); h.rotation.x = -PI / 2; g.add(at(h, p[0], top - 0.012, p[1]));
      });
      var dots = new T.InstancedMesh(new T.CircleGeometry(0.062, 10), M.dot, pts.length);
      var mtx = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(-PI / 2, 0, 0)), one = V(1, 1, 1);
      pts.forEach(function (p, i) { mtx.compose(V(p[0], top - 0.008, p[1]), q, one); dots.setMatrixAt(i, mtx); });
      dots.count = 0; g.add(dots);

      g.add(at(rbox(1.5, 9.4, 1.5, 0.2, M.enamel), -6.6, 5.0, -1.6));
      g.add(at(rbox(13, 1.0, 1.0, 0.16, M.brushed), -0.4, 8.9, -1.6));
      var head = new T.Group(); g.add(head);
      head.add(at(rbox(1.5, 1.7, 2.2, 0.18, M.black), 0, 8.6, -0.9));
      head.add(at(rbox(1.05, 3.6, 1.05, 0.16, M.enamel), 0, 6.0, 0));
      head.add(at(rbox(1.07, 0.4, 1.07, 0.08, M.inkPaint), 0, 5.2, 0));
      var sty = new T.Group(); head.add(sty);
      sty.add(at(cyl(0.2, 0.2, 2.2, M.chrome, 24), 0, 3.1, 0));
      sty.add(at(cyl(0.2, 0.025, 0.85, M.steel, 24), 0, 1.58, 0));
      anchors[3] = V(X, 1.2, 0);

      tick[3] = function (a, t) {
        var f = clamp(a, 0, 1) * pts.length, n = Math.floor(f), i = Math.min(n, pts.length - 1);
        dots.count = n; state.markN = n; state.markSettle = a >= 1 ? 1 : 0;
        var tx = a >= 1 ? 3.2 : pts[i][0], tz = a >= 1 ? -0.4 : pts[i][1];
        head.position.x += (tx - head.position.x) * 0.35;
        head.position.z += (tz - head.position.z) * 0.35;
        sty.position.y = a >= 1 ? 0.5 : 0.02 + Math.abs(Math.sin(f * PI)) * 0.16;
      };
    })();

    /* 4. Balancing: a turbo rotor on rollers, belt driven --------------- */
    (function () {
      var X = ST0 + GAP * 3, g = new T.Group(); g.position.set(X, 0, 0); g.rotation.y = 0.32; scene.add(g);

      function wheel(R, H, n, mat) {
        var w = new T.Group();
        function rh(u) { return R * (0.22 + 0.74 * Math.pow(u, 2.1)); }
        function yh(u) { return H * (0.07 + 0.9 * (1 - u)); }
        function rs(u) { return R * (0.62 + 0.38 * Math.pow(u, 1.3)); }
        function ys(u) { return H * (0.97 - 0.66 * Math.pow(u, 0.85)); }
        var pts = [new T.Vector2(0.001, 0), new T.Vector2(R, 0), new T.Vector2(R, H * 0.07)];
        for (var i = 24; i >= 0; i--) pts.push(new T.Vector2(rh(i / 24), yh(i / 24)));
        pts.push(new T.Vector2(0.001, H * 0.97));
        var m2 = mat.clone(); m2.side = T.DoubleSide;
        w.add(mesh(new T.LatheGeometry(pts, 72), m2));
        w.add(at(cyl(R * 0.12, R * 0.12, H * 0.16, M.steel, 6), 0, H * 1.04, 0));
        for (var b = 0; b < n * 2; b++) {
          var u0 = b % 2 ? 0.42 : 0, geo = new T.PlaneGeometry(1, 1, 28, 8), pos = geo.attributes.position, uv = geo.attributes.uv;
          for (var k = 0; k < pos.count; k++) {
            var u = lerp(u0, 1, uv.getX(k)), v = uv.getY(k);
            var r = lerp(rh(u), rs(u), v), y = lerp(yh(u), Math.max(ys(u), yh(u) + 0.03), v);
            var th = b * PI / n + 0.55 * Math.pow(1 - u, 1.3) + 0.06 * v;
            pos.setXYZ(k, r * Math.cos(th), y, r * Math.sin(th));
          }
          geo.computeVertexNormals();
          w.add(mesh(geo, m2));
        }
        return w;
      }

      blob(g, 0, 0.2, 17, 9, 0.6);
      g.add(at(rbox(13, 1.0, 5, 0.22, M.enamel), 0, 0.5, 0));
      g.add(at(rbox(12.4, 0.12, 0.9, 0.04, M.brushed), 0, 1.06, 1.6));
      g.add(at(rbox(12.4, 0.12, 0.9, 0.04, M.brushed), 0, 1.06, -1.6));
      var run = cyl(0.3, 0.3, 0.18, M.button, 24); run.rotation.x = PI / 2; g.add(at(run, 5.3, 0.5, 2.52));
      pressable(4, run, 'z', 0.07, 0.8);
      [-1.7, 1.7].forEach(function (x) {
        g.add(at(rbox(1.1, 2.5, 2.7, 0.2, M.enamel), x, 2.25, 0));
        g.add(at(rbox(1.3, 0.5, 2.3, 0.1, M.brushed), x, 3.72, 0));
        g.add(at(rbox(1.5, 0.3, 3.4, 0.08, M.steel), x, 1.16, 0));
        [-0.56, 0.56].forEach(function (z) {
          var r = cyl(0.46, 0.46, 0.5, M.chrome, 32); r.rotation.z = PI / 2; g.add(at(r, x, 4.1, z));
          var ax = cyl(0.12, 0.12, 0.9, M.black, 16); ax.rotation.z = PI / 2; g.add(at(ax, x, 4.1, z));
        });
      });
      var motor = cyl(0.82, 0.82, 1.9, M.inkPaint, 44); motor.rotation.z = PI / 2; g.add(at(motor, 0, 1.92, 0));
      var pulley = cyl(0.9, 0.9, 0.3, M.chrome, 44); pulley.rotation.z = PI / 2; g.add(at(pulley, 0, 1.92, 0));
      var belt = [];
      for (var a = 0; a <= 8; a++) { var q = a / 8 * PI; belt.push([0, 4.58 + 0.34 * Math.sin(q), 0.34 * Math.cos(q)]); }
      for (var a2 = 0; a2 <= 8; a2++) { var q2 = PI + a2 / 8 * PI; belt.push([0, 1.92 + 0.93 * Math.sin(q2), 0.93 * Math.cos(q2)]); }
      var bc = new T.CatmullRomCurve3(belt.map(function (p) { return V(p[0], p[1], p[2]); }), true);
      g.add(mesh(new T.TubeGeometry(bc, 120, 0.07, 8, true), M.rubber));
      g.add(at(rbox(0.3, 2.6, 0.3, 0.06, M.steel), 3.0, 2.3, 1.7));
      g.add(at(rbox(0.6, 0.6, 0.6, 0.1, M.black), 3.0, 3.75, 1.7));
      var probe = cyl(0.13, 0.13, 1.2, M.brass, 16); probe.rotation.x = PI / 2; g.add(at(probe, 3.0, 4.2, 1.1));

      var rotor = new T.Group(); rotor.position.set(0, 4.58, 0); g.add(rotor);
      var spin = new T.Group(); rotor.add(spin);
      var shaft = cyl(0.28, 0.28, 8.6, M.chrome, 32); shaft.rotation.z = PI / 2; spin.add(shaft);
      var comp = wheel(2.6, 2.3, 7, M.alu); comp.rotation.z = PI / 2; comp.position.x = -3.2; spin.add(comp);
      var turb = wheel(2.1, 1.9, 6, new T.MeshStandardMaterial({ color: 0x8d8780, metalness: 1, roughness: 0.38 })); turb.rotation.z = -PI / 2; turb.position.x = 3.2; spin.add(turb);
      anchors[4] = V(X - 3.9, 4.6, 2.2);

      var ang = 0;
      tick[4] = function (a, t, dt) {
        var up = sstep(0, 0.22, a), amp = Math.exp(-a * 5.2);
        ang += dt * 13 * up;
        spin.rotation.x = ang; pulley.rotation.x = -ang * 0.36;
        rotor.position.y = 4.58 + Math.sin(ang) * 0.07 * amp * up;
        rotor.position.z = Math.cos(ang) * 0.07 * amp * up;
        state.balS = Math.round(2400 * up / 10) * 10;
        state.balU = Math.max(0.05, 4.8 * amp);
        state.balSettle = a >= 0.9 ? 1 : 0;
      };
    })();

    /* 5. Packaging: a chamber vacuum packer ------------------------------ */
    (function () {
      var X = ST0 + GAP * 4, g = new T.Group(); g.position.set(X, 0, 0); g.rotation.y = 0.18; scene.add(g);
      blob(g, 0, 0.3, 15, 12, 0.65);
      g.add(at(rbox(10.4, 4.2, 7.8, 0.4, M.brushed), 0, 2.5, 0));
      [-4.4, 4.4].forEach(function (x) { [-3.1, 3.1].forEach(function (z) { g.add(at(cyl(0.35, 0.4, 0.45, M.rubber, 20), x, 0.22, z)); }); });
      g.add(at(rbox(9.2, 0.1, 6.4, 0.3, M.black), 0, 4.62, -0.2));
      g.add(at(rbox(8.4, 0.34, 0.5, 0.08, M.steel), 0, 4.84, 2.45));
      g.add(at(rbox(8.4, 0.08, 0.2, 0.03, M.rubber), 0, 5.03, 2.45));
      var pouch = new T.Group(); pouch.position.set(0, 4.67, -0.3); g.add(pouch);
      pouch.add(at(rbox(4.6, 1.0, 3.0, 0.3, M.product), 0, 0.5, 0));
      var film = rbox(6.2, 1.16, 4.2, 0.45, M.film); film.castShadow = false; pouch.add(at(film, 0, 0.56, 0.3));

      var lid = new T.Group(); lid.position.set(0, 4.7, -3.5); g.add(lid);
      var domeG = new T.CylinderGeometry(3.3, 3.3, 9.4, 48, 1, true, 0, PI);
      var lidGlass = sheer(new T.MeshStandardMaterial({ color: 0xdfe8f2, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false }));
      var dome = new T.Mesh(domeG, lidGlass); dome.rotation.z = PI / 2; dome.rotation.y = 0; dome.scale.set(0.5, 1, 1);
      var domeWrap = new T.Group(); domeWrap.add(dome); domeWrap.rotation.set(0, 0, 0); lid.add(at(domeWrap, 0, 0, 3.3));
      [-4.7, 4.7].forEach(function (x) {
        var e = new T.Mesh(new T.CircleGeometry(3.3, 40, 0, PI), lidGlass); e.rotation.y = PI / 2; e.scale.y = 0.5; lid.add(at(e, x, 0, 3.3));
      });
      lid.add(at(rbox(9.8, 0.3, 0.3, 0.08, M.steel), 0, 0.1, 6.55));
      lid.add(at(rbox(9.8, 0.3, 0.3, 0.08, M.steel), 0, 0.1, 0.05));
      [-4.75, 4.75].forEach(function (x) { lid.add(at(rbox(0.3, 0.3, 6.8, 0.08, M.steel), x, 0.1, 3.3)); });
      var handle = cyl(0.2, 0.2, 5, M.black, 16); handle.rotation.z = PI / 2; lid.add(at(handle, 0, 0.55, 6.95));

      var vg = dial({ r: 0.95, depth: 0.4, tex: gaugeTex(1, 0.2, '−bar', '#f3f2ec', '#15181c') });
      g.add(at(vg, -3.3, 2.6, 3.95));
      g.add(at(rbox(3.2, 1.3, 0.1, 0.1, M.black), 1.4, 2.8, 3.92));
      var dc = canvas(384, 144), dx = dc.getContext('2d'), dt2 = tex(dc);
      g.add(at(new T.Mesh(new T.PlaneGeometry(2.9, 1.08), new T.MeshBasicMaterial({ map: dt2, toneMapped: false })), 1.4, 2.8, 3.98));
      function show() {
        dx.fillStyle = '#0a1230'; dx.fillRect(0, 0, 384, 144);
        font(dx, 600, 30, 'condensed'); dx.fillStyle = '#c9d4ff'; dx.textAlign = 'left'; dx.textBaseline = 'alphabetic';
        dx.fillText(state.packS.toUpperCase(), 20, 44);
        font(dx, 700, 64, 'condensed'); dx.fillStyle = '#ffffff';
        dx.fillText(Math.round(-state.packV / 0.98 * 99) + ' %', 20, 118);
        dt2.needsUpdate = true;
      }
      var go = cyl(0.42, 0.42, 0.25, M.button, 28); go.rotation.x = PI / 2; g.add(at(go, 3.9, 2.8, 3.95));
      pressable(5, go, 'z', 0.09, 0.8);
      anchors[5] = V(X, 5.2, 1.5);

      tick[5] = function (a) {
        var close = sstep(0, 0.16, a) - sstep(0.86, 1, a);
        var vac = sstep(0.16, 0.56, a) - sstep(0.74, 0.86, a);
        lid.rotation.x = -(1 - close) * 0.95;
        film.scale.y = 1 - 0.14 * sstep(0.2, 0.56, a);
        film.scale.x = film.scale.z = 1 - 0.07 * sstep(0.2, 0.56, a);
        state.packV = -0.98 * vac;
        state.packS = a < 0.02 ? 'Open' : a < 0.16 ? 'Closing' : a < 0.56 ? 'Evacuating' : a < 0.74 ? 'Sealing' : a < 0.86 ? 'Venting' : 'Pack released';
        state.packSettle = a >= 0.86 ? 1 : 0;
        vg.needle.rotation.z = -(-0.75 * PI + (-state.packV) * 1.5 * PI);
        show();
      };
      tick[5](0);
    })();

    /* 6. Makers: ten gauge blocks on black granite, one engraved per maker */
    var MK = { x: 170, z0: 62, dz: 4.3 }, blocks = [];
    (function () {
      var speckB = speck.clone(); speckB.needsUpdate = true; speckB.repeat.set(12, 10);
      var slab = new T.Mesh(new T.PlaneGeometry(120, 100), new T.MeshStandardMaterial({
        color: 0x23262b, map: speckB, roughness: 0.5, envMapIntensity: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }));
      slab.rotation.x = -PI / 2; slab.position.set(MK.x, 0.004, 92); slab.receiveShadow = true; slab.renderOrder = -1; scene.add(slab);
      var names = ['Furness Controls', 'Galileo TP', 'GOMAX', 'Imperial Tools', 'OAK Europa (Ramer)', 'Supco', 'Technomark', 'Volvac', 'Wigam', 'CIMAT'];
      var hs = [1.0, 1.6, 0.6, 1.3, 0.8, 2.0, 1.1, 0.5, 1.5, 0.9], xs = [0.3, -0.4, 0.5, 0, -0.3, 0.4, -0.5, 0.2, -0.2, 0.3];
      names.forEach(function (nm, i) {
        var h = hs[i], gx = MK.x + xs[i], gz = MK.z0 + i * MK.dz;
        var bg = new T.Group(); bg.position.set(gx, 0, gz); scene.add(bg);
        blocks.push({ g: bg, x: gx, z: gz, shade: blob(scene, gx + 0.2, gz + 0.2, 8.2, 3.4, 0.7), lift: 0, vel: 0 });
        bg.add(at(rbox(6.4, h, 1.9, 0.04, i % 2 ? M.chrome : M.steel), 0, h / 2, 0));
        var c = canvas(1024, 256), x = c.getContext('2d'), size = 124;
        do { font(x, 700, size, 'condensed'); size -= 6; } while (x.measureText(nm.toUpperCase()).width > 930);
        x.fillStyle = 'rgba(18,21,25,0.84)'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(nm.toUpperCase(), 512, 134);
        var lab = new T.Mesh(new T.PlaneGeometry(6.0, 1.5), sheer(new T.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false })));
        lab.rotation.x = -PI / 2; lab.position.set(0, h + 0.012, 0); lab.renderOrder = 2; bg.add(lab);
      });
    })();

    /* 7. Service: a wrung stack of gauge blocks, the reference kept true -- */
    var SV = { x: 60, z: 95 };
    (function () {
      var g = new T.Group(); g.position.set(SV.x, 0, SV.z); g.rotation.y = -0.38; g.scale.setScalar(1.5); scene.add(g);
      blob(g, 0.1, 0.1, 5.6, 2.6, 0.7);  blob(g, 1.2, 2.6, 5.2, 2.6, 0.5);
      g.add(at(rbox(3.6, 1.0, 0.95, 0.03, M.steel), 0, 0.5, 0));
      g.add(at(rbox(3.6, 0.5, 0.95, 0.03, M.chrome), 0.05, 1.25, 0));
      g.add(at(rbox(3.6, 0.25, 0.95, 0.03, M.steel), -0.04, 1.625, 0));
            var l2 = at(rbox(3.6, 0.3, 0.95, 0.03, M.chrome), 1.2, 0.15, 2.6); l2.rotation.y = -0.3; g.add(l2);
      var c = canvas(768, 192), x = c.getContext('2d');
      font(x, 600, 120, 'normal'); x.fillStyle = 'rgba(18,21,25,0.8)'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('25 mm', 384, 100);
      var lab = new T.Mesh(new T.PlaneGeometry(3.0, 0.75), sheer(new T.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false })));
      lab.position.set(0, 0.5, 0.49); lab.renderOrder = 2; g.add(lab);
    })();

    /* Camera keys: position, target, and where the object sits on screen - */
    function key(px, py, pz, tx, ty, tz, sx, sy, lift) { return { p: V(px, py, pz), t: V(tx, ty, tz), sx: sx, sy: sy || 0, lift: lift || 0 }; }
    var MKZ1 = MK.z0 + 9 * MK.dz;
    var K = [
      key(4.5, 14.5, 26, -2.4, 5.5, 0, 0.25, 0, 5),
      key(ST0 - 2, 15, 31.5, ST0, 2.6, 0, -0.235, 0, 5),
      key(ST0 + GAP + 3.5, 15, 33, ST0 + GAP + 1, 5.6, 0, 0.235, 0, 5),
      key(ST0 + GAP * 2 - 2, 17.5, 20, ST0 + GAP * 2, 1.6, 0, -0.26, 0, 5),
      key(ST0 + GAP * 3 + 1, 14, 27, ST0 + GAP * 3, 3.3, 0, 0.235, 0, 5),
      key(ST0 + GAP * 4 - 6, 13.5, 25, ST0 + GAP * 4, 3.4, 0, -0.235, 0, 12),
      key(MK.x, 27, MK.z0 + 12, MK.x, 0, MK.z0 + 0.5, 0.27, 0, 0),
      key(MK.x, 27, MKZ1 + 12, MK.x, 0, MKZ1 + 0.5, 0.27, 0, 14),
      key(SV.x + 4, 11, SV.z + 23, SV.x, 1.2, SV.z, -0.2, -0.16, 14),
      key(9.5, 7.2, 17, -0.4, 5.9, 0, 0.24, 0, 0)
    ];
    for (var s0 = 1; s0 <= 5; s0++) tick[s0](0, 0, 0);

    var W = 1, H = 1, DPR = 1, portrait = 0;
    var cp = V(0, 0, 0), ct = V(0, 0, 0), tmp = V(0, 0, 0), side = V(0, 0, 0), UP = V(0, 1, 0), par = { x: 0, y: 0 };
    var hero = { v: 0, vel: 0, zero: 0, raw: 0 };
    var clock = 0;
    var opening = -1, kicked = false;          // seconds into the opening, or -1 when it is not playing
    var hot = -1, hotLast = 0, hotMix = 0;     // the maker row under the pointer
    var glow = 0, glowTo = 0;                  // the orange buttons brighten under the pointer
    var shade = { x: 1e9, z: 1e9, hold: 0, n: 0, act: [0, 0, 0, 0, 0, 0] }; // what the shadow map was last drawn for
    var lens = lensWanted ? makeLens() : null;
    // Quality ladder for the lens: effects on or off, and device pixels drawn per CSS pixel. It starts in the middle;
    // the page steps it up where there is GPU time to spare and down where there is not.
    var LEVELS = [[0, 0.7], [0, 0.85], [1, 0.85], [1, 1], [1, 1.25], [1, 1.5], [1, 2]], level = 3;
    function ratioAt(n) { return Math.min(DPR, LEVELS[n][1]); }
    function levelBeyond(dir) { // the next level in that direction that this display can actually show, or -1
      for (var n = level + dir; n >= 0 && n < LEVELS.length; n += dir) if (LEVELS[n][0] !== LEVELS[level][0] || ratioAt(n) !== ratioAt(level)) return n;
      return -1;
    }
    var ray = new T.Raycaster(), ndc = new T.Vector2(), buf = new T.Vector2();

    function resize(w, h, dpr) {
      W = w; H = h; DPR = dpr || 1;
      renderer.setPixelRatio(lens ? ratioAt(level) : Math.min(DPR, 2));
      renderer.setSize(w, h, false);
      if (lens) {
        lens.full = !!LEVELS[level][0];
        renderer.getDrawingBufferSize(buf);
        if (!lens.size(buf.x, buf.y)) { lens = null; renderer.setPixelRatio(Math.min(DPR, 2)); renderer.setSize(w, h, false); }
      }
      camera.aspect = w / h;
      portrait = 1 - sstep(0.8, 1.35, w / h);
      heroLoose.visible = portrait < 0.5;
      camera.updateProjectionMatrix();
    }

    // The ground follows the camera target: ink at the hero, black granite at the roster, pale stone between.
    function ground() {
      var inkAmt = (1 - sstep(10, 30, ct.x)) * (1 - sstep(30, 60, ct.z));
      var blackAmt = sstep(96, 118, ct.x) * sstep(30, 52, ct.z);
      scene.fog.color.lerpColors(BG_STONE, BG_INK, inkAmt).lerp(BG_BLACK, blackAmt);
      scene.background.copy(scene.fog.color);
      sun.target.position.copy(ct); sun.position.set(ct.x - 11, 24, ct.z + 13);
      return inkAmt;
    }

    function frame(dt, k, pointer, still, view) {
      clock += dt;
      k = clamp(k, 0, K.length - 1);
      inkTo(INK.to);
      var i = Math.min(Math.floor(k), K.length - 2), f = smoother(k - i), a = K[i], b = K[i + 1];
      if (portrait > 0.5 && i + 1 === K.length - 1) b = K[0]; // on phones the contact view reuses the hero framing
      cp.lerpVectors(a.p, b.p, f); ct.lerpVectors(a.t, b.t, f);
      cp.y += Math.sin(f * PI) * a.lift;
      var sx = lerp(a.sx, b.sx, f) * (1 - portrait), sy = lerp(a.sy, b.sy, f) * (1 - portrait) + 0.27 * portrait;

      // Over the roster the camera leans toward the block whose row is under the pointer.
      hotMix += ((hot >= 0 ? 1 : 0) - hotMix) * Math.min(1, dt * 4);
      var lean = (blocks[hotLast].z - ct.z) * hotMix * sstep(5.5, 6, k) * (1 - sstep(7, 7.5, k)) * 0.85;
      cp.z += lean; ct.z += lean;

      // Opening: the camera arrives from high and wide while the indicator puts itself together, then tests its needle.
      var e = 0, live = opening >= 0; // live: something that casts a shadow is moving
      if (opening >= 0) {
        opening += dt; e = 1 - expoOut(opening / 3.2);
        heroDial.parts.forEach(function (p, n) { p.position.z = p.userData.z + cubeOut((opening - 0.5 - n * 0.22) / 0.95) * (1.3 + n * 1.25); });
        if (!kicked && opening > 2.3) { kicked = true; hero.vel += 0.55; }
        if (opening > 3.6) { opening = -1; heroDial.parts.forEach(function (p) { p.position.z = p.userData.z; }); }
      }

      // The offset from target to camera carries the phone pull-back, the opening, and any turn the visitor gives it.
      tmp.subVectors(cp, ct).multiplyScalar((1 + 1.05 * portrait) * (1 + 0.9 * e));
      var yaw = (view ? view.yaw : 0) + 0.55 * e, pitch = view ? view.pitch : 0;
      if (yaw) tmp.applyAxisAngle(UP, yaw);
      if (pitch) { side.crossVectors(UP, tmp).normalize(); tmp.applyAxisAngle(side, pitch); }
      cp.addVectors(ct, tmp); cp.y += 6 * e;
      if (!still) {
        par.x += ((pointer.x - 0.5) - par.x) * Math.min(1, dt * 3);
        par.y += ((pointer.y - 0.5) - par.y) * Math.min(1, dt * 3);
        cp.x += par.x * 1.6 + Math.sin(clock * 0.31) * 0.05;
        cp.y += Math.sin(clock * 0.23 + 1.3) * 0.035 - par.y * 1.0;
      }
      if (cp.y < 1.2) cp.y = 1.2;
      camera.fov = 32 + (still ? 0 : 3 * Math.sin(f * PI)); // the lens opens a little in flight
      camera.position.copy(cp); camera.lookAt(ct);
      camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
      var inkAmt = ground();

      // Hero indicator: the pointer loads the plunger, a spring carries the needle.
      hero.raw = (pointer.x - 0.5) * 0.07 + Math.sin(clock * 0.7) * 0.004 + Math.sin(clock * 1.9) * 0.0015;
      var target = hero.raw - hero.zero;
      hero.vel += ((target - hero.v) * 90 - hero.vel * 9) * dt;
      hero.v += hero.vel * dt;
      heroDial.needle.rotation.z = -(hero.v / 0.1) * 2 * PI;
      state.hero = hero.v;
      state.heroSettle = Math.abs(hero.v) < 0.0015 && Math.abs(hero.vel) < 0.02 ? 1 : 0;

      for (var s = 1; s <= 5; s++) {
        var d = Math.abs(k - s);
        if (d < 0.42) act[s] = Math.min(1, act[s] + dt / (s === 3 ? 9 : 7));
        else if (d > 0.85) act[s] = 0;
        if (d < 1.2 && tick[s]) tick[s](act[s], clock, dt);
        if (d < 1.2 && (act[s] !== shade.act[s] || (s === 4 && act[s] > 0))) { live = true; shade.act[s] = act[s]; }
      }

      glow += (glowTo - glow) * Math.min(1, dt * 10);
      M.button.emissiveIntensity = 0.35 + 0.75 * glow;
      for (var n = 0; n < press.length; n++) {
        var p = press[n]; if (p.t <= 0) continue;
        live = true;
        p.t = Math.max(0, p.t - dt * 4);
        var give = Math.sin(p.t * PI) * p.depth;
        if (p.axis === 'turn') p.o.rotation.z = p.base + give; else p.o.position[p.axis] = p.base - give;
      }
      if (k > 5 && k < 8.2) for (var m = 0; m < blocks.length; m++) {
        var bl = blocks[m];
        bl.vel += (((m === hot ? 1 : 0) - bl.lift) * 140 - bl.vel * 17) * dt; bl.lift += bl.vel * dt;
        if (Math.abs(bl.vel) > 0.003) live = true;
        bl.g.position.y = bl.lift * 0.75; bl.g.position.x = bl.x - bl.lift * 0.45;
        bl.shade.material.opacity = 0.7 - 0.28 * bl.lift; bl.shade.scale.setScalar(1 + 0.14 * bl.lift);
      }

      // The shadow map is redrawn while the light or a caster moves, for a few frames after, and now and then regardless.
      if (live || Math.abs(ct.x - shade.x) + Math.abs(ct.z - shade.z) > 0.002) { shade.x = ct.x; shade.z = ct.z; shade.hold = 14; }
      renderer.shadowMap.needsUpdate = shade.hold-- > 0 || ++shade.n % 60 === 0;

      var timing = false;
      if (timer && lens) {
        if (!timer.busy) {
          if (++timer.n >= 20) { timer.n = 0; timer.busy = timing = true; timer.gl.beginQuery(timer.ext.TIME_ELAPSED_EXT, timer.q); }
        } else if (timer.gl.getQueryParameter(timer.q, timer.gl.QUERY_RESULT_AVAILABLE)) {
          timer.busy = false;
          if (!timer.gl.getParameter(timer.ext.GPU_DISJOINT_EXT)) timer.ms = timer.gl.getQueryParameter(timer.q, timer.gl.QUERY_RESULT) / 1e6;
        }
      }
      if (lens) lens.render(cp.distanceTo(ct) * (1 - 0.35 * e), still ? 0 : clock);
      else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
      if (timing) timer.gl.endQuery(timer.ext.TIME_ELAPSED_EXT);
      return inkAmt;
    }

    function anchor(k) {
      var a = anchors[k]; if (!a) return null;
      tmp.copy(a).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H };
    }

    // Which station's button is under a point on the screen, or -1.
    function pick(x, y) {
      ndc.set(x / W * 2 - 1, 1 - y / H * 2);
      ray.setFromCamera(ndc, camera);
      var hit = ray.intersectObjects(targets, false)[0];
      return hit ? hit.object.userData.s : -1;
    }

    // Pressing a station's button runs its demonstration again; the hero's lever zeroes the indicator.
    function pressed(s) {
      for (var n = 0; n < press.length; n++) if (press[n].s === s) press[n].t = 1;
      if (s === 0) hero.zero = hero.raw; else if (s > 0 && s < act.length) act[s] = 0;
    }

    // One step up or down the quality ladder. False when there is nowhere to go.
    function step(dir) {
      var n = lens ? levelBeyond(dir) : -1;
      if (n < 0) return false;
      level = n; resize(W, H, DPR);
      return true;
    }

    // GPU time of the newest measured frame, in milliseconds. -1: not known yet. -2: this browser will not say.
    function gpuTime() { return timer ? timer.ms : -2; }

    // What a frame would cost the GPU one level up, in milliseconds, judged from the newest measurement.
    // -1: not known yet, or nothing above. -2: this browser will not say.
    function costAbove() {
      if (!lens) return -1;
      if (!timer) return -2;
      var n = levelBeyond(1), k = n < 0 ? 0 : ratioAt(n) / ratioAt(level);
      return n < 0 || timer.ms < 0 ? -1 : timer.ms * k * k * (LEVELS[n][0] > LEVELS[level][0] ? 1.2 : 1);
    }

    // One still frame at an exact pixel size, for artwork such as social posts.
    function shot(o) {
      renderer.setRenderTarget(null);
      renderer.setPixelRatio(1); renderer.setSize(o.w, o.h, false);
      W = o.w; H = o.h;
      camera.aspect = o.w / o.h; camera.fov = o.fov || 32;
      cp.set(o.p[0], o.p[1], o.p[2]); ct.set(o.t[0], o.t[1], o.t[2]);
      camera.position.copy(cp); camera.lookAt(ct);
      camera.setViewOffset(o.w, o.h, -(o.sx || 0) * o.w, (o.sy || 0) * o.h, o.w, o.h);
      heroLoose.visible = o.loose !== false;
      inkTo(o.ink ? 64 : INK.to, o.ink !== 'off'); // stills can push the ink's edge out of frame, or leave the plate bare
      ground();
      heroDial.needle.rotation.z = -((o.needle || 0) / 0.1) * 2 * PI;
      for (var s = 1; s <= 5; s++) {
        var av = (o.act && o.act[s]) || 0;
        for (var r = 0; r < (s === 3 ? 40 : 1); r++) tick[s](av, 1.3, 0.016);
      }
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      return renderer.domElement;
    }

    return {
      shot: shot, makers: MK, service: SV,
      keys: K.map(function (k) { return { p: k.p.toArray(), t: k.t.toArray(), sx: k.sx, sy: k.sy }; }),
      resize: resize, frame: frame, anchor: anchor, state: state,
      pick: pick, press: pressed, step: step, gpuTime: gpuTime, costAbove: costAbove,
      zero: function () { pressed(0); },
      hover: function (on) { glowTo = on ? 1 : 0; },
      maker: function (n) { hot = n; if (n >= 0) hotLast = n; },
      open: function () { opening = 0; kicked = false; }
    };
  }

  window.QMScene = { create: create };
})();
