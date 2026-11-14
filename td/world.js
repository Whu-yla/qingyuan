/* 青元剑诀 · 剑阵守山 —— 3D 场景与表现层
 * 只负责 three.js 场景、模型、路径、阵位、特效与拾取；游戏数值与流程在 game.js。
 * 依赖：window.THREE（three-r128.min.js）、window.QYTD_CONFIG（levels.js）。
 * 挂载 window.QYTDWorld = { init(canvas) -> handle }
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var CFG = window.QYTD_CONFIG;
  if (!THREE || !CFG) throw new Error('QYTDWorld: THREE 或 QYTD_CONFIG 未加载');

  // ---------- 小工具 ----------
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var TAU = Math.PI * 2;
  // 颜色统一按 sRGB 书写、转线性空间渲染（three r128 的颜色是线性值，不转会整体发白）
  function C(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  function std(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial(Object.assign({
      color: C(color),
      emissive: C(opts.emissive != null ? opts.emissive : 0x000000),
      emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 1,
      roughness: opts.roughness != null ? opts.roughness : 0.55,
      metalness: opts.metalness != null ? opts.metalness : 0.35,
      flatShading: !!opts.flatShading,
      transparent: !!opts.transparent,
      opacity: opts.opacity != null ? opts.opacity : 1,
      side: opts.side != null ? opts.side : THREE.FrontSide,
      depthWrite: opts.depthWrite != null ? opts.depthWrite : true
    }, opts.extra || {}));
  }
  function basic(color, opts) {
    opts = opts || {};
    return new THREE.MeshBasicMaterial(Object.assign({
      color: C(color),
      transparent: opts.transparent !== false,
      opacity: opts.opacity != null ? opts.opacity : 0.7,
      blending: opts.blending != null ? opts.blending : THREE.AdditiveBlending,
      depthWrite: false,
      side: opts.side != null ? opts.side : THREE.DoubleSide
    }, opts.extra || {}));
  }

  var _glowTex = null;
  function glowTexture() {
    if (_glowTex) return _glowTex;
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    _glowTex = new THREE.CanvasTexture(c);
    return _glowTex;
  }
  var _softTex = null;
  function softTexture() {
    if (_softTex) return _softTex;
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    _softTex = new THREE.CanvasTexture(c);
    return _softTex;
  }

  var _runeTex = {};
  function runeTexture(glyph, color) {
    var key = glyph + '|' + color;
    if (_runeTex[key]) return _runeTex[key];
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    var hex = '#' + ('000000' + color.toString(16)).slice(-6);
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = hex; g.globalAlpha = 0.9; g.lineWidth = 5;
    g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 0.5; g.lineWidth = 2; g.setLineDash([10, 12]);
    g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 0.55; g.lineWidth = 2;
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
      g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.font = 'bold 108px "STKaiti","KaiTi","Songti SC",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = hex; g.shadowBlur = 26;
    g.fillStyle = '#f4fffb';
    g.fillText(glyph, 128, 136);
    g.shadowBlur = 0;
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    _runeTex[key] = tex;
    return tex;
  }

  function glowSprite(color, size, opacity) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: color, transparent: true, opacity: opacity == null ? 0.8 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.scale.set(size, size, 1);
    return sp;
  }

  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function swordMesh(color, s, emissiveIntensity) {
    s = s || 1;
    var g = new THREE.Group();
    var bladeMat = std(0x9fd8d0, { metalness: 0.85, roughness: 0.22, emissive: color, emissiveIntensity: emissiveIntensity == null ? 0.42 : emissiveIntensity });
    var blade = new THREE.Mesh(new THREE.BoxGeometry(0.085 * s, 1.35 * s, 0.028 * s), bladeMat);
    blade.position.y = 0.72 * s;
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.062 * s, 0.24 * s, 4), bladeMat);
    tip.position.y = 1.51 * s; tip.rotation.y = Math.PI / 4;
    var guard = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.055 * s, 0.07 * s), std(color, { metalness: 0.7, roughness: 0.3, emissive: color, emissiveIntensity: 0.5 }));
    guard.position.y = 0.05 * s;
    var hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.042 * s, 0.26 * s, 6), std(0x2c2620, { roughness: 0.9, metalness: 0.1 }));
    hilt.position.y = -0.1 * s;
    var pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 8, 6), std(color, { metalness: 0.8, roughness: 0.25, emissive: color, emissiveIntensity: 0.4 }));
    pommel.position.y = -0.24 * s;
    g.add(blade, tip, guard, hilt, pommel);
    return g;
  }

  // ---------- 主入口 ----------
  function init(canvas) {
    var W = {};
    var scene = new THREE.Scene();
    scene.background = C(0x050b15);
    scene.fog = new THREE.FogExp2(C(0x081422), 0.0122);

    var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 240);
    var CAM_BASE = new THREE.Vector3(0, 22.5, 31);
    camera.position.copy(CAM_BASE);
    var CAM_LOOK = new THREE.Vector3(0, 0, -1);
    camera.lookAt(CAM_LOOK);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;

    // ---------- 灯光 ----------
    scene.add(new THREE.HemisphereLight(0x8fbbe8, 0x0b121c, 0.78));
    var moonLight = new THREE.DirectionalLight(0xbcd4ff, 0.92);
    moonLight.position.set(-34, 46, -20);
    scene.add(moonLight);
    var fill = new THREE.DirectionalLight(0x2b4a6b, 0.45);
    fill.position.set(24, 14, 26);
    var rim = new THREE.DirectionalLight(0x2fd0c0, 0.2);
    rim.position.set(-18, 8, 20);
    scene.add(rim);
    scene.add(fill);

    // ---------- 路径 ----------
    var pathPoints = CFG.PATH.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
    var curve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.35);
    var pathLength = curve.getLength();
    var BASE_POS = new THREE.Vector3(CFG.BASE_POSITION[0], 0, CFG.BASE_POSITION[1]);

    W.scene = scene; W.camera = camera; W.renderer = renderer;
    W.pathLength = pathLength;
    W.pointAt = function (t) { return curve.getPointAt(clamp(t, 0, 1)); };
    W.tangentAt = function (t) { return curve.getTangentAt(clamp(t, 0, 1)); };
    W.basePosition = BASE_POS.clone();
    W.cameraBase = CAM_BASE.clone();

    // ---------- 地面 + 天空 ----------
    (function buildGround() {
      var c = document.createElement('canvas'); c.width = c.height = 256;
      var g = c.getContext('2d');
      g.fillStyle = '#0a1320'; g.fillRect(0, 0, 256, 256);
      var rnd = seeded(7);
      for (var i = 0; i < 900; i++) {
        var x = rnd() * 256, y = rnd() * 256, w = 1 + rnd() * 3;
        g.strokeStyle = 'rgba(' + (20 + rnd() * 22 | 0) + ',' + (34 + rnd() * 26 | 0) + ',' + (46 + rnd() * 30 | 0) + ',' + (0.18 + rnd() * 0.3) + ')';
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 26); g.stroke();
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 14);
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 170, 1, 1), new THREE.MeshStandardMaterial({
        color: 0x0c1826, map: tex, roughness: 1, metalness: 0.05
      }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
      scene.add(ground);
    })();

    (function buildStars() {
      var rnd = seeded(42); var pos = new Float32Array(720 * 3);
      for (var i = 0; i < 720; i++) {
        var r = 95 + rnd() * 40, th = rnd() * TAU, ph = Math.acos(rnd() * 0.65);
        pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
        pos[i * 3 + 1] = Math.cos(ph) * r + 12;
        pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fc7ff, size: 0.55, transparent: true, opacity: 0.75, sizeAttenuation: true, depthWrite: false })));
    })();

    (function buildMoon() {
      var moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0xdfeeff, transparent: true, opacity: 0.95, depthWrite: false }));
      moon.scale.set(16, 16, 1); moon.position.set(-13, 21.5, -47); scene.add(moon);
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0x7fb6ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(38, 38, 1); halo.position.copy(moon.position); halo.position.z -= 1; scene.add(halo);
    })();

    // 远山轮廓
    (function buildMountains() {
      var rnd = seeded(19);
      var mt = new THREE.Group();
      var sample = [];
      for (var i = 0; i <= 120; i++) sample.push(curve.getPointAt(i / 120));
      var minPathDist = function (x, z) {
        var best = 1e9;
        for (var k = 0; k < sample.length; k += 2) {
          var dx = sample[k].x - x, dz = sample[k].z - z;
          var d = dx * dx + dz * dz; if (d < best) best = d;
        }
        return Math.sqrt(best);
      };
      for (var n = 0; n < 34; n++) {
        var angle = rnd() * TAU, radius = 26 + rnd() * 24;
        var x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
        if (z > -16) continue;
        if (minPathDist(x, z) < 16) continue;
        var h = 14 + rnd() * 24, rad = 3.4 + rnd() * 5.2;
        var geo = new THREE.ConeGeometry(rad, h, 5 + (rnd() * 3 | 0));
        var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C(rnd() > 0.55 ? 0x0a1624 : 0x07101c) }));
        m.position.set(x, h / 2 - 1.5, z);
        m.rotation.y = rnd() * TAU;
        mt.add(m);
      }
      scene.add(mt);
      // 山巅楼阁
      var pagodaAt = [[-24, -18, 12], [26, -22, 15], [-34, 8, 9], [31, 12, 10]];
      pagodaAt.forEach(function (p) {
        var pg = new THREE.Group();
        var base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 2.2), std(0x1a2636, { roughness: 0.9 }));
        pg.add(base);
        for (var t = 0; t < 3; t++) {
          var w = 2.0 - t * 0.46, hgt = 0.8;
          var tier = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w * 0.82), std(0x22303f, { roughness: 0.85 }));
          tier.position.y = 0.5 + t * 0.86; pg.add(tier);
          var roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.82, 0.5, 4), std(0x101c27, { roughness: 0.9, flatShading: true }));
          roof.position.y = 0.5 + t * 0.86 + 0.62; roof.rotation.y = Math.PI / 4; pg.add(roof);
          var glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, 0.16), basic(0xffc46b, { opacity: 0.55 }));
          glow.position.set(0, 0.5 + t * 0.86 + 0.08, w * 0.42); pg.add(glow);
        }
        pg.position.set(p[0], p[2], p[1]); pg.scale.setScalar(1.15);
        scene.add(pg);
      });
    })();

    // 石峰群（近景高石柱，补足纵深与楼阁灯）
    (function buildPeaks() {
      var rnd = seeded(73);
      var sample = [];
      for (var i = 0; i <= 120; i++) sample.push(curve.getPointAt(i / 120));
      var pathDist = function (x, z) {
        var best = 1e9;
        for (var k = 0; k < sample.length; k += 2) {
          var dx = sample[k].x - x, dz = sample[k].z - z;
          var d = dx * dx + dz * dz; if (d < best) best = d;
        }
        return Math.sqrt(best);
      };
      var baseDist = function (x, z) { return Math.hypot(x - BASE_POS.x, z - BASE_POS.z); };
      function placeSpire(x, z, h, rad, dark) {
        if (pathDist(x, z) < 10.5 || baseDist(x, z) < 8) return;
        var r = seeded((x * 131 + z * 997 + h * 37) >>> 0);
        var g = new THREE.Group();
        var segs = 3 + (r() * 3 | 0);
        var y = 0;
        for (var s = 0; s < segs; s++) {
          var hh = h / segs * (0.72 + r() * 0.6);
          var rr = rad * (1 - s / (segs + 1.1)) * (0.86 + r() * 0.3);
          var spirePalette = [0x0b1726, 0x101f31, 0x0d1a2a, 0x122437];
          var m = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.76, rr, hh, 7, 1, false), new THREE.MeshBasicMaterial({ color: C(spirePalette[(r() * spirePalette.length) | 0]) }));
          m.position.set((r() - 0.5) * rr * 0.55, y + hh / 2, (r() - 0.5) * rr * 0.55);
          m.rotation.y = r() * TAU;
          g.add(m);
          y += hh * 0.93;
        }
        if (r() > 0.35) {
          var roof = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.62, rad * 0.72, 4), new THREE.MeshBasicMaterial({ color: C(0x0b1522) }));
          roof.position.y = y + rad * 0.36; roof.rotation.y = Math.PI / 4; g.add(roof);
          var lamp = new THREE.Mesh(new THREE.PlaneGeometry(rad * 0.5, rad * 0.18), basic(0xffc46b, { opacity: 0.55 }));
          lamp.position.set(0, y + rad * 0.22, rad * 0.5); g.add(lamp);
        }
        g.position.set(x, -0.3, z);
        scene.add(g);
      }
      for (var n = 0; n < 16; n++) {
        var x = -56 + n * 7.4 + (rnd() - 0.5) * 5;
        var z = -30 - rnd() * 14;
        placeSpire(x, z, 16 + rnd() * 20, 2.6 + rnd() * 2.2, n % 2 === 0);
      }
      for (var m2 = 0; m2 < 9; m2++) {
        placeSpire(-21 - rnd() * 12, -8 - rnd() * 16, 10 + rnd() * 13, 1.8 + rnd() * 1.2, false);
        placeSpire(21 + rnd() * 13, -10 - rnd() * 16, 11 + rnd() * 13, 2.0 + rnd() * 1.2, false);
      }
      [0, 1, 2].forEach(function (ii) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0x93b8d8, transparent: true, opacity: 0.1 + ii * 0.02, depthWrite: false }));
        sp.scale.set(72 + ii * 10, 20 + ii * 4, 1);
        sp.position.set(ii === 0 ? -24 : ii === 1 ? 24 : 0, 5 + ii * 2.4, -44 - ii * 8);
        scene.add(sp);
      });
    })();

    // 雾气
    var mists = [];
    (function buildMist() {
      var rnd = seeded(88);
      for (var i = 0; i < 13; i++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0x8fb6d8, transparent: true, opacity: 0.07 + rnd() * 0.05, depthWrite: false }));
        sp.scale.set(20 + rnd() * 18, 5.5 + rnd() * 4.5, 1);
        sp.position.set(-26 + rnd() * 52, 0.8 + rnd() * 3, -30 + rnd() * 32);
        sp.userData.drift = 0.25 + rnd() * 0.5;
        sp.userData.baseX = sp.position.x;
        sp.userData.phase = rnd() * TAU;
        scene.add(sp); mists.push(sp);
      }
    })();

    // 灵光浮尘
    var motes = null;
    (function buildMotes() {
      var rnd = seeded(5); var n = 280; var pos = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        pos[i * 3] = (rnd() - 0.5) * 46;
        pos[i * 3 + 1] = 0.6 + rnd() * 9;
        pos[i * 3 + 2] = (rnd() - 0.5) * 42 - 2;
      }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7fffe0, size: 0.16, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
      scene.add(motes);
    })();

    // 九曲石道
    (function buildPath() {
      var N = 220;
      var pos = [], idx = [], uv = [];
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        var p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        var nx = tan.z, nz = -tan.x; var len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
        var half = 1.48;
        pos.push(p.x + nx * half, 0.02, p.z + nz * half, p.x - nx * half, 0.02, p.z - nz * half);
        uv.push(0, t * 26, 1, t * 26);
        if (i < N) { var a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      var stoneCanvas = document.createElement('canvas'); stoneCanvas.width = 128; stoneCanvas.height = 256;
      var sg = stoneCanvas.getContext('2d');
      sg.fillStyle = '#16283e'; sg.fillRect(0, 0, 128, 256);
      var sr = seeded(77);
      for (var sy = 0; sy < 16; sy++) {
        var offX = (sy % 2) * 16;
        for (var sx2 = -1; sx2 < 5; sx2++) {
          var px2 = sx2 * 32 + offX, py2 = sy * 16;
          sg.fillStyle = 'rgba(' + (26 + sr() * 18 | 0) + ',' + (44 + sr() * 20 | 0) + ',' + (66 + sr() * 22 | 0) + ',' + (0.55 + sr() * 0.35) + ')';
          sg.fillRect(px2 + 1.2, py2 + 1.2, 32 - 2.4, 16 - 2.4);
        }
      }
      for (var si2 = 0; si2 < 260; si2++) {
        sg.fillStyle = 'rgba(180,220,230,' + (0.03 + sr() * 0.07) + ')';
        sg.fillRect(sr() * 128, sr() * 256, 1 + sr() * 2, 1 + sr() * 2);
      }
      var stoneTex = new THREE.CanvasTexture(stoneCanvas);
      stoneTex.encoding = THREE.sRGBEncoding;
      stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
      stoneTex.repeat.set(1.6, 1);
      var mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: stoneTex, roughness: 0.92, metalness: 0.14, emissive: 0x030a12, emissiveIntensity: 1 });
      scene.add(new THREE.Mesh(geo, mat));
      // 两侧发光边线
      [1, -1].forEach(function (side) {
        var lp = [];
        for (var i2 = 0; i2 <= N; i2++) {
          var t2 = i2 / N; var p2 = curve.getPointAt(t2), tn = curve.getTangentAt(t2);
          var nx2 = tn.z, nz2 = -tn.x; var l = Math.hypot(nx2, nz2) || 1;
          lp.push(new THREE.Vector3(p2.x + nx2 / l * 1.72 * side, 0.045, p2.z + nz2 / l * 1.72 * side));
        }
        var lg = new THREE.BufferGeometry().setFromPoints(lp);
        scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x2fd0c0, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending })));
      });
      // 石道上的暗纹
      var stoneRnd = seeded(31);
      for (var s = 0; s < 26; s++) {
        var tt = 0.04 + stoneRnd() * 0.92;
        var pp = curve.getPointAt(tt), tn2 = curve.getTangentAt(tt);
        var nnx = tn2.z, nnz = -tn2.x; var ll = Math.hypot(nnx, nnz) || 1;
        var off = (stoneRnd() - 0.5) * 2.1;
        var slab = new THREE.Mesh(new THREE.PlaneGeometry(0.55 + stoneRnd() * 0.5, 0.3 + stoneRnd() * 0.3), new THREE.MeshStandardMaterial({ color: 0x22314a, roughness: 0.95, metalness: 0.1 }));
        slab.rotation.x = -Math.PI / 2; slab.rotation.z = stoneRnd() * TAU;
        slab.position.set(pp.x + nnx / ll * off, 0.035, pp.z + nnz / ll * off);
        scene.add(slab);
      }
    })();

    // 山石
    (function buildRocks() {
      var rnd = seeded(61);
      for (var i = 0; i < 46; i++) {
        var x = (rnd() - 0.5) * 78, z = (rnd() - 0.5) * 66 - 2;
        var near = false;
        for (var k = 0; k <= 60; k++) {
          var p = curve.getPointAt(k / 60);
          if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < 42) { near = true; break; }
        }
        if (near) continue;
        for (var si = 0; si < 10; si++) {
          var st = 0.075 + (si / 9) * 0.85; if (si === 9) st = 0.93;
          var spp = curve.getPointAt(st), stan = curve.getTangentAt(st);
          var snx = stan.z, snz = -stan.x; var sl = Math.hypot(snx, snz) || 1;
          var sside = si % 2 === 0 ? 1 : -1;
          var sx = spp.x + snx / sl * 3.5 * sside, sz = spp.z + snz / sl * 3.5 * sside;
          if ((sx - x) * (sx - x) + (sz - z) * (sz - z) < 30) { near = true; break; }
        }
        if (near) continue;
        if (Math.hypot(x - BASE_POS.x, z - BASE_POS.z) < 7.5) continue;
        var sc = 0.24 + rnd() * 0.86;
        var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), std(0x16212f, { roughness: 0.95, flatShading: true, metalness: 0.08 }));
        rock.position.set(x, sc * 0.32 - 0.06, z); rock.rotation.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
        scene.add(rock);
      }
    })();

    // ---------- 石灯 ----------
    (function buildLanterns() {
      [0.14, 0.34, 0.54, 0.74].forEach(function (t, i) {
        var p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        var nx = tan.z, nz = -tan.x; var l = Math.hypot(nx, nz) || 1;
        var side = i % 2 ? 1 : -1;
        var g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6), std(0x1b2836, { roughness: 0.9 })));
        var box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), std(0x243438, { roughness: 0.7, emissive: 0x3a2a10, emissiveIntensity: 0.4 }));
        box.position.y = 0.68; g.add(box);
        var flame = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), basic(0xffc46b, { opacity: 0.85 }));
        flame.position.set(0, 0.68, 0.22); g.add(flame);
        var roof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.24, 4), std(0x101c27, { flatShading: true, roughness: 0.9 }));
        roof.position.y = 1.02; roof.rotation.y = Math.PI / 4; g.add(roof);
        g.position.set(p.x + nx / l * 4.4 * side, 0, p.z + nz / l * 4.4 * side);
        scene.add(g);
      });
    })();

    // ---------- 青云阵眼 ----------
    var baseGroup = new THREE.Group(), baseRings = [], baseCrystal = null, baseShield = null, baseLight = null;
    (function buildBase() {
      baseGroup.position.copy(BASE_POS);
      var platform = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.25, 0.32, 9), std(0x1b2836, { roughness: 0.8, metalness: 0.3 }));
      platform.position.y = 0.16; baseGroup.add(platform);
      var inner = new THREE.Mesh(new THREE.CircleGeometry(2.55, 48), basic(0x2fd0c0, { opacity: 0.10 }));
      inner.rotation.x = -Math.PI / 2; inner.position.y = 0.34; baseGroup.add(inner);
      for (var i = 0; i < 3; i++) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(1.7 + i * 0.45, 0.018, 8, 72), basic(i === 1 ? 0x7fffe0 : 0x2fd0c0, { opacity: i === 1 ? 0.55 : 0.38 }));
        ring.rotation.x = Math.PI / 2 + (i - 1) * 0.22; ring.position.y = 0.55 + i * 0.28;
        ring.userData.spin = 0.25 + i * 0.22; baseGroup.add(ring); baseRings.push(ring);
      }
      baseCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0),
        new THREE.MeshStandardMaterial({ color: 0x0affc8, emissive: 0x21ffd0, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.92 }));
      baseCrystal.position.y = 1.55; baseGroup.add(baseCrystal);
      var glow = glowSprite(0x2fffd0, 6.5, 0.7); glow.position.y = 1.6; baseGroup.add(glow);
      for (var s = 0; s < 8; s++) {
        var sw = swordMesh(0x2fd0c0, 0.9, 0.5);
        var ang = s / 8 * TAU;
        sw.position.set(Math.cos(ang) * 2.25, 0.36, Math.sin(ang) * 2.25);
        sw.rotation.z = -Math.cos(ang) * 0.32; sw.rotation.x = Math.sin(ang) * 0.32;
        baseGroup.add(sw);
      }
      baseShield = new THREE.Mesh(new THREE.SphereGeometry(2.65, 24, 12, 0, TAU, 0, Math.PI / 2), basic(0x2fd0c0, { opacity: 0.05 }));
      baseShield.position.y = 0.35; baseGroup.add(baseShield);
      baseLight = new THREE.PointLight(0x51ffe0, 1.25, 16, 2); baseLight.position.y = 2.2; baseGroup.add(baseLight);
      scene.add(baseGroup);
    })();

    // ---------- 魔门 ----------
    var gateGroup = new THREE.Group(), gateRing = null;
    (function buildGate() {
      var p = curve.getPointAt(0), tan = curve.getTangentAt(0);
      gateGroup.position.copy(p);
      gateGroup.rotation.y = Math.atan2(tan.x, tan.z);
      [-1, 1].forEach(function (side) {
        var pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), std(0x2a1a2c, { roughness: 0.85, emissive: 0x3c0f24, emissiveIntensity: 0.25 }));
        pillar.position.set(side * 2.3, 2.1, 0); gateGroup.add(pillar);
        var cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.7, 4), std(0x180f1e, { flatShading: true }));
        cap.position.set(side * 2.3, 4.5, 0); cap.rotation.y = Math.PI / 4; gateGroup.add(cap);
      });
      gateRing = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.09, 8, 64), basic(0xff4d7a, { opacity: 0.65 }));
      gateRing.position.y = 2.0; gateGroup.add(gateRing);
      var veil = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), basic(0x8a1a44, { opacity: 0.16 }));
      veil.position.set(0, 2.0, 0.05); gateGroup.add(veil);
      var gl = glowSprite(0xff2f68, 7, 0.45); gl.position.y = 2.0; gateGroup.add(gl);
      scene.add(gateGroup);
    })();

    // ---------- 阵位 ----------
    var slots = [];
    var slotMeshes = [];
    (function buildSlots() {
      var count = 10;
      for (var i = 0; i < count; i++) {
        var t = 0.075 + (i / (count - 1)) * 0.85;
        if (i === count - 1) t = 0.93;
        var p = curve.getPointAt(t), tan = curve.getTangentAt(t);
        var nx = tan.z, nz = -tan.x; var l = Math.hypot(nx, nz) || 1;
        var side = i % 2 === 0 ? 1 : -1;
        var off = 3.5;
        var pos = new THREE.Vector3(p.x + nx / l * off * side, 0, p.z + nz / l * off * side);
        var disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 36), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.001, depthWrite: false }));
        disc.rotation.x = -Math.PI / 2; disc.position.copy(pos); disc.position.y = 0.06;
        disc.userData.slotIndex = i;
        scene.add(disc); slotMeshes.push(disc);
        var ring = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.32, 40), basic(0x2fd0c0, { opacity: 0.34 }));
        ring.rotation.x = -Math.PI / 2; ring.position.copy(pos); ring.position.y = 0.07;
        scene.add(ring);
        var rune = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 4), basic(0x7fffe0, { opacity: 0.35 }));
        rune.rotation.x = -Math.PI / 2; rune.rotation.z = Math.PI / 4; rune.position.copy(pos); rune.position.y = 0.075;
        scene.add(rune);
        slots.push({ index: i, position: pos, disc: disc, ring: ring, rune: rune, built: false, hover: false, selected: false });
      }
    })();

    // 供 game.js 使用的阵位查询
    W.slotCount = slots.length;
    W.slotPosition = function (i) { var s = slots[i]; return s ? s.position.clone() : null; };
    W.slotBuilt = function (i) { var s = slots[i]; return !!(s && s.built); };

    // ---------- 范围/瞄准圈 ----------
    var rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64), basic(0xffd57a, { opacity: 0.42 }));
    rangeRing.rotation.x = -Math.PI / 2; rangeRing.visible = false; scene.add(rangeRing);
    var aimGroup = new THREE.Group();
    var aimRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 64), basic(0x7fffe0, { opacity: 0.7 }));
    aimRing.rotation.x = -Math.PI / 2; aimGroup.add(aimRing);
    var aimCore = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 24), basic(0xffffff, { opacity: 0.8 }));
    aimCore.rotation.x = -Math.PI / 2; aimGroup.add(aimCore);
    aimGroup.visible = false; scene.add(aimGroup);

    // ---------- 敌我模型 ----------
    function makeHumanoid(color, scale, kind) {
      var g = new THREE.Group();
      var robeMat = std(color, { roughness: 0.72, metalness: 0.12, emissive: color, emissiveIntensity: 0.16 });
      var robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 8), robeMat);
      robe.position.y = 0.7; g.add(robe);
      var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 8), robeMat);
      torso.position.y = 1.2; g.add(torso);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), std(0xd8c7ad, { roughness: 0.85 }));
      head.position.y = 1.56; g.add(head);
      var hood = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.36, 8), robeMat);
      hood.position.y = 1.7; hood.rotation.x = Math.PI; g.add(hood);
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28), basic(color, { opacity: 0.3 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
      // 眼睛
      var eyeMat = basic(0xff7a7a, { opacity: 0.9 });
      [-0.065, 0.065].forEach(function (x) {
        var eye = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.028), eyeMat);
        eye.position.set(x, 1.57, 0.16); g.add(eye);
      });
      if (kind === 'elite') {
        [-1, 1].forEach(function (s) {
          var spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 5), std(0x2a0d12, { roughness: 0.6, emissive: 0xff3b3b, emissiveIntensity: 0.2 }));
          spike.position.set(s * 0.42, 1.35, 0); spike.rotation.z = s * 0.5; g.add(spike);
        });
      }
      g.scale.setScalar(scale || 1);
      return g;
    }
    function makeWolf(color, scale) {
      var g = new THREE.Group();
      var mat = std(color, { roughness: 0.65, metalness: 0.15, emissive: color, emissiveIntensity: 0.16 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.92), mat);
      body.position.y = 0.62; g.add(body);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), mat);
      head.position.set(0, 0.78, 0.56); g.add(head);
      var snout = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), mat);
      snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.74, 0.78); g.add(snout);
      [-1, 1].forEach(function (s) {
        [-0.3, 0.32].forEach(function (z) {
          var leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.46, 0.09), std(0x3d4d63, { roughness: 0.9 }));
          leg.position.set(s * 0.16, 0.27, z); g.add(leg);
        });
        var ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), mat);
        ear.position.set(s * 0.1, 0.95, 0.5); g.add(ear);
        var eye = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), basic(0x7fe8ff, { opacity: 0.95 }));
        eye.position.set(s * 0.08, 0.8, 0.71); g.add(eye);
      });
      var tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 5), mat);
      tail.position.set(0, 0.62, -0.52); tail.rotation.x = -Math.PI / 2.4; g.add(tail);
      g.scale.setScalar(scale || 1);
      return g;
    }
    function makeGhost(color, scale) {
      var g = new THREE.Group();
      var bodyMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false });
      var body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.35, 7), bodyMat);
      body.position.y = 0.85; body.rotation.x = Math.PI; g.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bodyMat);
      head.position.y = 1.62; g.add(head);
      var eyeMat = basic(0xffffff, { opacity: 0.95 });
      [-0.07, 0.07].forEach(function (x) {
        var eye = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), eyeMat);
        eye.position.set(x, 1.63, 0.17); g.add(eye);
      });
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 24), basic(color, { opacity: 0.25 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
      g.scale.setScalar(scale || 1);
      return g;
    }
    function makePuppet(color, scale) {
      var g = new THREE.Group();
      var mat = std(color, { roughness: 0.8, metalness: 0.5, emissive: 0x5a2c12, emissiveIntensity: 0.18 });
      var torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.8, 0.38), mat);
      torso.position.y = 1.0; g.add(torso);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat);
      head.position.y = 1.56; g.add(head);
      [-1, 1].forEach(function (s) {
        var arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), mat);
        arm.position.set(s * 0.4, 1.05, 0); arm.rotation.z = s * 0.12; g.add(arm);
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.66, 0.17), std(0x3a2a1c, { roughness: 0.9 }));
        leg.position.set(s * 0.16, 0.33, 0); g.add(leg);
        var eye = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), basic(0xffb347, { opacity: 0.95 }));
        eye.position.set(s * 0.07, 1.57, 0.16); g.add(eye);
      });
      var rune = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), basic(0xff9a3d, { opacity: 0.5 }));
      rune.position.set(0, 1.05, 0.2); g.add(rune);
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.54, 24), basic(color, { opacity: 0.2 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
      g.scale.setScalar(scale || 1);
      return g;
    }

    function createHpBar(width) {
      var group = new THREE.Group();
      var bg = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.115), new THREE.MeshBasicMaterial({ color: 0x04080c, transparent: true, opacity: 0.72, depthWrite: false }));
      group.add(bg);
      var fillGeo = new THREE.PlaneGeometry(width - 0.05, 0.07);
      fillGeo.translate((width - 0.05) / 2, 0, 0);
      var fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0x7fffe0, transparent: true, opacity: 0.95, depthWrite: false }));
      fill.position.x = -(width - 0.05) / 2; fill.position.z = 0.01;
      group.add(fill);
      group.visible = false;
      scene.add(group);
      return { group: group, fill: fill, width: width - 0.05 };
    }

    W.createEnemy = function (conf, opts) {
      opts = opts || {};
      var g;
      switch (conf.shape) {
        case 'wolf': g = makeWolf(conf.color, conf.scale); break;
        case 'ghost': g = makeGhost(conf.color, conf.scale); break;
        case 'puppet': g = makePuppet(conf.color, conf.scale); break;
        case 'elite': g = makeHumanoid(conf.color, conf.scale, 'elite'); break;
        default: g = makeHumanoid(conf.color, conf.scale, 'human');
      }
      if (!opts.isBoss) g.scale.multiplyScalar(1.42);
      var node = {
        group: g, isBoss: !!opts.isBoss, conf: conf,
        hpBar: createHpBar(opts.isBoss ? 2.6 : 0.95),
        flash: 0, bobPhase: Math.random() * TAU,
        runeRings: [], nameSprite: null, aura: null
      };
      var flashMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      node.flashSprite = new THREE.Sprite(flashMat);
      node.flashSprite.scale.setScalar(opts.isBoss ? 6 : 2.2);
      node.flashSprite.position.y = conf.height || 1.5;
      g.add(node.flashSprite);
      if (opts.isBoss) {
        var aura = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.55, 40), basic(conf.color, { opacity: 0.35 }));
        aura.rotation.x = -Math.PI / 2; aura.position.y = 0.06; g.add(aura); node.aura = aura;
        for (var i = 0; i < 3; i++) {
          var rr = new THREE.Mesh(new THREE.TorusGeometry(0.9 + i * 0.3, 0.02, 6, 48), basic(conf.color, { opacity: 0.28 - i * 0.05 }));
          rr.rotation.x = Math.PI / 2 + i * 0.5; rr.position.y = 1.0 + i * 0.4; g.add(rr); node.runeRings.push(rr);
        }
        var glow = glowSprite(conf.color, 7, 0.35); glow.position.y = 1.6; g.add(glow);
        // 名字
        var cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
        var ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 512, 128);
        ctx.font = 'bold 64px "STKaiti","KaiTi","Songti SC",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,220,140,0.9)'; ctx.shadowBlur = 18;
        ctx.fillStyle = '#ffe9b0'; ctx.fillText(conf.name, 256, 68);
        var tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sp.scale.set(4.6, 1.15, 1);
        scene.add(sp); node.nameSprite = sp;
      }
      scene.add(g);
      return node;
    };

    W.disposeNode = function (node) {
      if (!node) return;
      scene.remove(node.group);
      if (node.hpBar) scene.remove(node.hpBar.group);
      if (node.nameSprite) { scene.remove(node.nameSprite); if (node.nameSprite.material.map) node.nameSprite.material.map.dispose(); node.nameSprite.material.dispose(); }
      node.group.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
          else o.material.dispose();
        }
      });
    };

    // 每帧更新敌人视觉
    W.updateEnemy = function (node, e) {
      var g = node.group;
      g.position.copy(e.pos);
      var bob = Math.sin(e.age * 3.1 + node.bobPhase) * 0.05 * (node.isBoss ? 2 : 1);
      g.position.y += bob;
      if (e.tangent) g.rotation.y = Math.atan2(e.tangent.x, e.tangent.z);
      node.hpBar.group.position.set(e.pos.x, (node.conf.height || 1.5) * (node.isBoss ? 1.35 : 1) + 0.55, e.pos.z);
      node.hpBar.group.quaternion.copy(camera.quaternion);
      node.hpBar.group.visible = e.hp < e.maxHp || node.isBoss;
      var frac = clamp(e.hp / e.maxHp, 0, 1);
      node.hpBar.fill.scale.x = Math.max(0.0001, frac);
      var col = node.isBoss ? 0xff5d7a : (frac > 0.5 ? 0x7fffe0 : frac > 0.22 ? 0xffd166 : 0xff5d5d);
      node.hpBar.fill.material.color.setHex(col);
      if (node.flashSprite) {
        if (node.flash > 0) { node.flashSprite.material.opacity = clamp(node.flash, 0, 0.85); node.flash -= 0.12; }
        else node.flashSprite.material.opacity = 0;
      }
      node.runeRings.forEach(function (rr, i) { rr.rotation.z += 0.02 * (i % 2 ? -1 : 1); });
      if (node.aura) { node.aura.rotation.z += 0.01; node.aura.scale.setScalar(1 + Math.sin(e.age * 2) * 0.05); }
      if (node.nameSprite) node.nameSprite.position.set(e.pos.x, (node.conf.height || 2) * 1.9 + 1.15, e.pos.z);
      if (node.isBoss) g.scale.setScalar((node.conf.scale || 1.4) * (1 + Math.sin(e.age * 1.6) * 0.012));
    };

    W.flashEnemy = function (node) { if (node) node.flash = 0.85; };

    // ---------- 塔 ----------
    W.createTower = function (typeKey, level) {
      var conf = CFG.TOWERS[typeKey];
      var g = new THREE.Group();
      var color = conf.color;
      var baseMat = std(0x0f1a27, { roughness: 0.95, metalness: 0.08, emissive: color, emissiveIntensity: 0.05 });
      var base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.62, 0.26, 10), baseMat);
      base.position.y = 0.13; g.add(base);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.035, 6, 56), basic(color, { opacity: 0.22 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.28; g.add(ring);
      var glow = glowSprite(color, 2.6, 0.2); glow.position.y = 1.0; g.add(glow);
      var runePlane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({
        map: runeTexture(conf.glyph, color), transparent: true, opacity: 1, depthWrite: false
      }));
      runePlane.rotation.x = -Math.PI / 2; runePlane.position.y = 0.34; g.add(runePlane);
      var swords = [];
      var n = 3 + level * 2;
      for (var i = 0; i < n; i++) {
        var ang = i / n * TAU;
        var sw = swordMesh(color, 1.2);
        sw.position.set(Math.cos(ang) * 1.02, 0.28, Math.sin(ang) * 1.02);
        sw.rotation.y = -ang; sw.rotation.z = Math.cos(ang) * 0.36; sw.rotation.x = -Math.sin(ang) * 0.36;
        g.add(sw); swords.push(sw);
      }
      var center = new THREE.Group(); center.position.y = 1.35; g.add(center);
      var halo = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.022, 6, 48), basic(color, { opacity: 0.28 }));
      halo.rotation.x = Math.PI / 2; halo.position.y = 2.15; g.add(halo);
      var towerLight = new THREE.PointLight(color, 0.3, 5, 2); towerLight.position.y = 1.5; g.add(towerLight);
      if (typeKey === 'lianhua') {
        for (var p = 0; p < 8; p++) {
          var petal = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.78, 5), std(color, { roughness: 0.4, metalness: 0.2, emissive: color, emissiveIntensity: 0.7, transparent: true, opacity: 0.92 }));
          var pa = p / 8 * TAU;
          petal.position.set(Math.cos(pa) * 0.34, 0.1, Math.sin(pa) * 0.34);
          petal.rotation.z = Math.cos(pa) * 0.95; petal.rotation.x = -Math.sin(pa) * 0.95;
          center.add(petal);
        }
        for (var p2 = 0; p2 < 4; p2++) {
          var petal2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 5), std(0xdffff2, { roughness: 0.35, metalness: 0.15, emissive: color, emissiveIntensity: 0.8, transparent: true, opacity: 0.95 }));
          var pa2 = p2 / 4 * TAU + 0.4;
          petal2.position.set(Math.cos(pa2) * 0.16, 0.16, Math.sin(pa2) * 0.16);
          petal2.rotation.z = Math.cos(pa2) * 0.5; petal2.rotation.x = -Math.sin(pa2) * 0.5;
          center.add(petal2);
        }
        var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), basic(0xffffff, { opacity: 0.95 })); core.position.y = 0.18; center.add(core);
      } else if (typeKey === 'dageng') {
        var big = swordMesh(color, 2.3); big.position.y = 0.2; center.add(big);
        [-1, 1].forEach(function (side) {
          var sideSword = swordMesh(color, 1.15);
          sideSword.position.set(side * 0.42, 0.2, 0.1);
          sideSword.rotation.z = side * 0.32; sideSword.rotation.x = 0.18;
          center.add(sideSword);
        });
        var goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.03, 6, 40), basic(0xffe9b0, { opacity: 0.5 }));
        goldRing.rotation.x = Math.PI / 2; goldRing.position.y = 0.06; center.add(goldRing);
      } else if (typeKey === 'qingyuan') {
        for (var q = 0; q < 3; q++) {
          var plate = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.07), std(color, { roughness: 0.35, metalness: 0.6, emissive: color, emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }));
          var qa = q / 3 * TAU;
          plate.position.set(Math.cos(qa) * 0.52, 0.14, Math.sin(qa) * 0.52);
          plate.rotation.y = -qa; plate.rotation.z = 0.14;
          center.add(plate);
        }
        var shieldRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 6, 40), basic(color, { opacity: 0.5 }));
        shieldRing.rotation.x = Math.PI / 2; shieldRing.position.y = 0.56; center.add(shieldRing);
        var core2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), basic(color, { opacity: 0.95 })); center.add(core2);
      } else if (typeKey === 'pixie') {
        for (var o = 0; o < 3; o++) {
          var orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), basic(0xd9c8ff, { opacity: 0.98 }));
          center.add(orb); orb.userData.orbit = o / 3 * TAU;
        }
      } else if (typeKey === 'jujian') {
        var giant = swordMesh(color, 2.9); giant.position.y = 0.15; center.add(giant);
        var aura = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.04, 6, 44), basic(0xffc46b, { opacity: 0.45 }));
        aura.rotation.x = Math.PI / 2; aura.position.y = 0.05; center.add(aura);
      }
      var lvRunes = new THREE.Group(); lvRunes.position.y = 0.3; g.add(lvRunes);
      for (var r = 0; r < level; r++) {
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), basic(0xffe9b0, { opacity: 0.9 }));
        dot.position.set(-0.3 + r * 0.3, 0.02, 0.9); lvRunes.add(dot);
      }
      var visual = { group: g, center: center, swords: swords, color: color, type: typeKey, level: level, rune: runePlane, t: Math.random() * 10 };
      g.userData.visual = visual;
      scene.add(g);
      return visual;
    };

    W.disposeTower = function (visual) {
      if (!visual) return;
      scene.remove(visual.group);
      visual.group.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); }); else o.material.dispose(); }
      });
    };

    W.setSlotState = function (index, st) {
      var slot = slots[index]; if (!slot) return;
      slot.built = !!st.built; slot.hover = !!st.hover; slot.selected = !!st.selected;
      var affordable = st.affordable !== false;
      var color = st.selected ? 0xffd57a : st.hover ? 0xfff3b0 : affordable ? 0x2fd0c0 : 0x9a5a5a;
      slot.ring.material.color.setHex(color);
      slot.ring.material.opacity = slot.built ? 0.0 : (st.hover || st.selected ? 0.85 : 0.3);
      slot.rune.material.color.setHex(color);
      slot.rune.material.opacity = slot.built ? 0.0 : (st.hover || st.selected ? 0.7 : 0.3);
      slot.disc.userData.built = slot.built;
    };

    // ---------- 拾取 ----------
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var tmpV = new THREE.Vector3();

    W.raycastSlot = function (clientX, clientY) {
      ndc.x = (clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(slotMeshes, false);
      if (hits.length) return hits[0].object.userData.slotIndex;
      return -1;
    };
    W.raycastGround = function (clientX, clientY) {
      ndc.x = (clientX / window.innerWidth) * 2 - 1;
      ndc.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, tmpV)) return null;
      return tmpV.clone();
    };
    W.screenOf = function (v3) {
      var p = v3.clone().project(camera);
      return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, visible: p.z < 1 };
    };

    W.showRange = function (pos, radius, color) {
      rangeRing.visible = true;
      rangeRing.position.set(pos.x, 0.08, pos.z);
      rangeRing.scale.setScalar(radius);
      rangeRing.material.color.setHex(color == null ? 0xffd57a : color);
    };
    W.hideRange = function () { rangeRing.visible = false; };
    W.showAim = function (pos, radius, color, opacity) {
      aimGroup.visible = true;
      aimGroup.position.set(pos.x, 0.09, pos.z);
      aimRing.scale.setScalar(Math.max(0.2, radius || 1));
      aimRing.material.color.setHex(color == null ? 0x7fffe0 : color);
      aimRing.material.opacity = opacity == null ? 0.7 : opacity;
    };
    W.hideAim = function () { aimGroup.visible = false; };

    // ---------- 特效 ----------
    var fx = [];
    function addFx(obj, life, updater) {
      obj.userData.fxAge = 0; obj.userData.fxLife = life;
      scene.add(obj); fx.push({ obj: obj, life: life, age: 0, update: updater });
    }
    function fadeMaterial(mat, frac) { mat.opacity = Math.max(0, (mat.userData.baseOpacity != null ? mat.userData.baseOpacity : 1) * frac); }

    W.vfx = {};
    W.vfx.beam = function (from, to, color, width, life) {
      var pts = [from.clone(), to.clone()];
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      var mat = new THREE.LineBasicMaterial({ color: color || 0x7fffe0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      var line = new THREE.Line(geo, mat);
      mat.userData.baseOpacity = 0.9;
      addFx(line, life || 0.2, function (f, dt, age, lifeR) { mat.opacity = 0.9 * (1 - age / lifeR); });
    };
    W.vfx.lightning = function (points, color, life) {
      // 折线抖动
      var geo = new THREE.BufferGeometry();
      var arr = [];
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var jitter = i === 0 || i === points.length - 1 ? 0 : 0.35;
        arr.push(p.x + (Math.random() - 0.5) * jitter, p.y + 0.25 + (Math.random() - 0.5) * jitter, p.z + (Math.random() - 0.5) * jitter);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      var mat = new THREE.LineBasicMaterial({ color: color || 0xb28bff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      var line = new THREE.Line(geo, mat);
      addFx(line, life || 0.32, function (f, dt, age, lifeR) { mat.opacity = 1 - age / lifeR; });
    };
    W.vfx.ring = function (pos, radius, color, life, opts) {
      opts = opts || {};
      var geo = new THREE.RingGeometry(radius * 0.9, radius, 64);
      var mat = basic(color || 0x7fffe0, { opacity: opts.opacity != null ? opts.opacity : 0.75 });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(pos.x, (opts.y != null ? opts.y : 0.08), pos.z);
      var startScale = opts.startScale != null ? opts.startScale : 0.35;
      mesh.scale.setScalar(startScale);
      var from = startScale, to = opts.endScale != null ? opts.endScale : 1.0;
      addFx(mesh, life || 0.6, function (f, dt, age, lifeR) {
        var k = Math.min(1, age / lifeR);
        mesh.scale.setScalar(from + (to - from) * k);
        mat.opacity = (opts.opacity != null ? opts.opacity : 0.75) * (1 - k);
      });
    };
    W.vfx.burst = function (pos, color, count, power) {
      count = count || 14; power = power || 1;
      var geo = new THREE.BufferGeometry();
      var positions = new Float32Array(count * 3);
      var vel = [];
      for (var i = 0; i < count; i++) {
        positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y + 0.6; positions[i * 3 + 2] = pos.z;
        var a = Math.random() * TAU, up = 0.6 + Math.random() * 1.8;
        vel.push(new THREE.Vector3(Math.cos(a) * (0.4 + Math.random()) * power, up * power, Math.sin(a) * (0.4 + Math.random()) * power));
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var mat = new THREE.PointsMaterial({ color: color || 0x7fffe0, size: 0.16, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      var pts = new THREE.Points(geo, mat);
      addFx(pts, 0.7, function (f, dt, age, lifeR) {
        var k = age / lifeR;
        var p = geo.attributes.position.array;
        for (var j = 0; j < count; j++) {
          p[j * 3] += vel[j].x * dt; p[j * 3 + 1] += vel[j].y * dt; p[j * 3 + 2] += vel[j].z * dt;
          vel[j].y -= 5 * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = 0.95 * (1 - k);
      });
    };
    W.vfx.swordDrop = function (pos, color, damageRadius) {
      var sw = swordMesh(color || 0xff9a62, 3.2);
      sw.position.set(pos.x, 16, pos.z);
      var land = new THREE.Vector3(pos.x, 0.1, pos.z);
      var speed = 46;
      addFx(sw, 1.0, function (f, dt, age, lifeR) {
        if (sw.position.y > land.y) {
          sw.position.y = Math.max(land.y, sw.position.y - speed * dt);
          if (sw.position.y <= land.y) {
            W.vfx.ring(land, damageRadius || 2.2, color || 0xff9a62, 0.5, { opacity: 0.9 });
            W.vfx.burst(land, color || 0xff9a62, 16, 1.4);
            W.shake(0.16);
          }
        } else {
          sw.position.y = land.y;
          sw.rotation.z += dt * 0.4;
        }
      });
    };
    W.vfx.heal = function (pos) {
      W.vfx.ring(pos, 3.2, 0x6fd6ff, 0.9, { opacity: 0.85 });
      W.vfx.ring(pos, 2.2, 0xffffff, 0.7, { opacity: 0.6 });
      var light = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 8, 24, 1, true), basic(0x6fd6ff, { opacity: 0.16, side: THREE.DoubleSide }));
      light.position.set(pos.x, 4, pos.z);
      addFx(light, 0.8, function (f, dt, age, lifeR) { light.material.opacity = 0.16 * (1 - age / lifeR); });
    };
    W.vfx.baseHit = function () {
      W.vfx.ring(BASE_POS, 3.4, 0xff5d5d, 0.5, { opacity: 0.8 });
      W.shake(0.3);
    };
    W.vfx.slowWave = function (pos, color) {
      W.vfx.ring(pos, 7.5, color || 0x6fd6ff, 1.0, { opacity: 0.42, endScale: 1.6 });
    };
    W.clearFx = function () {
      fx.forEach(function (f) { scene.remove(f.obj); f.obj.traverse ? f.obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }) : null; });
      fx.length = 0;
    };

    // ---------- 阵眼表现 ----------
    var baseHpFrac = 1;
    W.setBaseHp = function (frac) {
      baseHpFrac = clamp(frac, 0, 1);
      var col = C(0x21ffd0).clone().lerp(C(0xff3b3b), 1 - baseHpFrac);
      baseCrystal.material.color.copy(col); baseCrystal.material.emissive.copy(col);
      baseLight.color.copy(col);
      baseRings.forEach(function (r) { r.material.color.copy(col); });
      baseShield.material.opacity = 0.04 + 0.05 * (1 - baseHpFrac);
    };

    // ---------- 相机晃动 ----------
    var shake = 0;
    W.shake = function (v) { shake = Math.max(shake, v); };

    // ---------- 主更新 ----------
    var clockBase = 0;
    W.update = function (dt, time) {
      clockBase = time;
      // 环境
      mists.forEach(function (m) {
        m.position.x = m.userData.baseX + Math.sin(time * 0.11 * m.userData.drift + m.userData.phase) * 3.2;
        m.material.opacity = 0.075 + Math.sin(time * 0.3 + m.userData.phase) * 0.022;
      });
      if (motes) { motes.rotation.y = time * 0.008; motes.position.y = Math.sin(time * 0.35) * 0.25; }
      baseCrystal.rotation.y = time * 0.7; baseCrystal.position.y = 1.55 + Math.sin(time * 1.3) * 0.09;
      baseRings.forEach(function (r, i) { r.rotation.z = time * r.userData.spin * (i % 2 ? -1 : 1); });
      baseShield.material.opacity = 0.04 + Math.sin(time * 1.1) * 0.012 + 0.05 * (1 - baseHpFrac);
      gateRing.rotation.z = time * 0.3;
      gateGroup.children.forEach(function (c) { if (c.isSprite) c.material.opacity = 0.35 + Math.sin(time * 1.6) * 0.1; });
      slots.forEach(function (s) {
        if (!s.built) { s.ring.rotation.z = time * 0.25 + s.index; s.rune.rotation.z = -time * 0.4; }
      });
      // 塔的待机动画
      scene.children.forEach(function (o) { });
      towers.forEach(function (tw) {
        var v = tw.visual; if (!v) return;
        v.t += dt;
        if (v.rune) v.rune.rotation.z -= dt * 0.22;
        if (v.center) {
          v.center.rotation.y += dt * 0.5;
          if (v.type === 'pixie') {
            var orbs = v.center.children;
            for (var i = 0; i < orbs.length; i++) {
              var or = orbs[i]; if (!or.userData.orbit && or.userData.orbit !== 0) continue;
              var a = v.t * 1.6 + or.userData.orbit;
              or.position.set(Math.cos(a) * 0.46, 0.15 + Math.sin(v.t * 2 + i) * 0.08, Math.sin(a) * 0.46);
            }
          }
          if (v.type === 'lianhua') v.center.rotation.y = Math.sin(v.t * 0.8) * 0.4;
        }
        for (var j = 0; j < v.swords.length; j++) {
          var sw = v.swords[j];
          sw.position.y = 0.24 + Math.sin(v.t * 1.5 + j) * 0.05;
          sw.rotation.y += dt * 0.15;
        }
      });
      // 特效
      for (var i = fx.length - 1; i >= 0; i--) {
        var f = fx[i];
        f.age += dt;
        var k = Math.min(1, f.age / f.life);
        if (f.update) f.update(f, dt, f.age, f.life);
        if (f.age >= f.life) {
          scene.remove(f.obj);
          if (f.obj.geometry) f.obj.geometry.dispose();
          if (f.obj.material) { if (Array.isArray(f.obj.material)) f.obj.material.forEach(function (m) { m.dispose(); }); else f.obj.material.dispose(); }
          fx.splice(i, 1);
        }
      }
      // 瞄准/范围脉动
      if (aimGroup.visible) { aimCore.scale.setScalar(1 + Math.sin(time * 6) * 0.15); }
      if (rangeRing.visible) { rangeRing.material.opacity = 0.34 + Math.sin(time * 2.4) * 0.1; }
      // 相机
      if (shake > 0.001) {
        camera.position.set(CAM_BASE.x + (Math.random() - 0.5) * shake, CAM_BASE.y + (Math.random() - 0.5) * shake, CAM_BASE.z + (Math.random() - 0.5) * shake * 0.6);
        shake *= Math.pow(0.02, dt);
        if (shake < 0.002) { shake = 0; camera.position.copy(CAM_BASE); }
        camera.lookAt(CAM_LOOK);
      }
    };
    var towers = [];
    W.registerTower = function (visual) { towers.push({ visual: visual }); };
    W.unregisterTower = function (visual) { towers = towers.filter(function (t) { return t.visual !== visual; }); };

    // 清理一局动态对象
    W.clearDynamic = function () {
      towers = [];
      W.clearFx();
      slots.forEach(function (s) { s.built = false; });
      rangeRing.visible = false; aimGroup.visible = false;
    };

    W.render = function () { renderer.render(scene, camera); };
    W.resize = function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    };
    window.addEventListener('resize', W.resize);

    // 初始渲染一帧
    W.update(0.016, 0);
    return W;
  }

  window.QYTDWorld = { init: init };
})();