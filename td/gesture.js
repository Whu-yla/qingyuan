/* ============================================================================
 * 青元剑诀 · 塔防模式手势输入模块（QYTDGesture）
 * ----------------------------------------------------------------------------
 * 职责：
 *   1. 本地加载 MediaPipe Tasks Vision 手势识别组件（wasm + hand_landmarker.bin），
 *      完全不依赖远程 CDN，断网可用；
 *   2. 打开摄像头并把识别结果通过 onUpdate 回调交给 game.js；
 *   3. 复用主编 assets/js/app.js 的手势分类算法与骨架连线，保证与主游戏一致；
 *   4. 提供 simulate() / simulateGesture()，让无摄像头的无头测试也能跑通整条链路。
 *
 * 依赖（由 td/index.html 按主编顺序预先加载，脚本执行时已存在）：
 *   window.QingyuanVision          → assets/js/vision-bundle.js
 *   window.QingyuanHandWasmSIMD    → assets/js/hand-wasm-simd-runtime.js
 *   window.QingyuanHandWasmBasic   → assets/js/hand-wasm-basic-runtime.js
 *
 * 公开 API（window.QYTDGesture）：
 *   enable(): Promise<boolean>            开启摄像头 + 本地识别；已开启时幂等返回 true
 *   disable(): void                       关闭 RAF / 摄像头 / 识别组件；可重复调用
 *   toggle(): Promise<boolean>            根据状态切换
 *   get isEnabled: boolean
 *   get status: string                    当前中文状态文案（同时写入 #gesture-state）
 *   classify(metricLandmarks): string|null
 *                                         与 app.js classifyHandGesture 同算法同阈值
 *   simulate(landmarks): boolean          喂 21 点归一化 landmark，走真实检测同一条处理路径
 *   simulateGesture(name): boolean        直接派发一个稳定手势（无摄像头测试用）
 *   onUpdate: Function|null               game.js 赋值（也兼容 onUpdate(fn) 注册写法）；每帧回调
 *   onUpdate({ present, gesture, x, y, raw, landmarks })
 *     present   是否检测到手
 *     gesture   5-6 帧多数投票后的稳定手势：DAGENG|GIANT|DRAGON|SHIELD|LOTUS|null
 *     x, y      屏幕 CSS 像素坐标（食指尖 lm[8]，x 做自拍镜像）
 *     raw       本帧分类结果（可能是 null / 未稳定）
 *     landmarks 本帧 21 点归一化 landmark（无手时为 null）
 * ============================================================================ */
(function () {
  'use strict';

  // 已加载过就不再重复定义，避免游戏页误重复引入时覆盖已挂载的 onUpdate。
  if (window.QYTDGesture && window.QYTDGesture.__qytdGestureModule) return;

  /* ------------------------------------------------------------------------ */
  /* 常量：本地识别资产（与 assets/js/app.js 4928-4932 行一致，只读本地）      */
  /* ------------------------------------------------------------------------ */
  var HAND_ASSET_PATHS = {
    wasmSimd: '../assets/hand/vision_wasm_internal.wasm',
    wasmBasic: '../assets/hand/vision_wasm_nosimd_internal.wasm',
    model: '../assets/hand/hand_landmarker.bin'
  };

  // 与 app.js 5173-5179 行完全一致的手部骨架连线。
  var HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
  ];

  var GESTURE_WINDOW_SIZE = 6;   // 与 app.js GESTURE_WINDOW_SIZE 一致
  var GESTURE_MIN_VOTES = 3;     // 与 app.js 中 maxVotes >= 3 一致
  var HAND_LOST_MS = 400;        // 连续 0.4 秒无手 → present=false
  var GPU_INTERVAL_MS = 33;      // ~30fps
  var CPU_INTERVAL_MS = 50;
  var DEFAULT_ASPECT = 4 / 3;    // 无视频时的默认画面宽高比
  var SKELETON_COLOR = '#00ffa2';
  var OVERLAY_WIDTH = 240;
  var OVERLAY_HEIGHT = 180;
  var GESTURE_NAMES = { DAGENG: 1, GIANT: 1, DRAGON: 1, SHIELD: 1, LOTUS: 1 };

  /* ------------------------------------------------------------------------ */
  /* 小工具                                                                    */
  /* ------------------------------------------------------------------------ */
  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function nowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function gestureError(message, code) {
    var error = new Error(message);
    error.gestureCode = code || 'GESTURE';
    error.userMessage = message;
    return error;
  }

  function warn() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[QYTDGesture]');
      console.warn.apply(console, args);
    } catch (_) { /* 控制台不可用时忽略 */ }
  }

  /* ------------------------------------------------------------------------ */
  /* 状态                                                                      */
  /* ------------------------------------------------------------------------ */
  var enabled = false;              // 摄像头 + 识别组件是否处于可用状态
  var starting = null;              // 正在进行的 enable Promise
  var sessionSerial = 0;            // 每次 enable/disable 自增，用于丢弃过期的异步结果
  var cameraStream = null;
  var handLandmarker = null;
  var handDelegate = '';            // 'GPU' | 'CPU'
  var assetsPromise = null;         // 本地 wasm / 模型缓存（disable 后保留，重开更快）
  var rafId = 0;
  var lastInferenceAt = 0;
  var lastVideoTime = -1;
  var lastSeenAt = 0;
  var present = false;
  var stableGesture = null;
  var gestureWindow = [];
  var consecutiveInferenceErrors = 0;
  var statusText = '手势：未开启';
  var api = null;
  var onUpdateHandler = null;       // game.js 赋值的回调（同时兼容以函数调用形式注册）

  /* ------------------------------------------------------------------------ */
  /* DOM 辅助（元素可能晚于脚本创建，每次都按需查找）                          */
  /* ------------------------------------------------------------------------ */
  function setStatus(text, kind) {
    statusText = text;
    var el = byId('gesture-state');
    if (!el) return;
    el.textContent = text;
    if (kind) {
      if (el.dataset) el.dataset.gestureState = kind;
      el.setAttribute('data-gesture-state', kind);
    }
  }

  function setToggleLabel(text) {
    var el = byId('gesture-toggle');
    if (el) el.textContent = text;
  }

  function getVideoElement(createIfMissing) {
    var video = byId('gesture-video');
    if (!video && createIfMissing) {
      video = document.createElement('video');
      video.id = 'gesture-video';
      video.setAttribute('aria-hidden', 'true');
      video.style.position = 'fixed';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      var host = document.body || document.documentElement;
      if (host) host.appendChild(video);
    }
    return video;
  }

  function getOverlayCanvas() {
    var canvas = byId('gesture-overlay');
    if (!canvas) return null;
    if (!canvas.width) canvas.width = OVERLAY_WIDTH;
    if (!canvas.height) canvas.height = OVERLAY_HEIGHT;
    return canvas;
  }

  /* ------------------------------------------------------------------------ */
  /* 分类算法：逐行复制自 assets/js/app.js 5104-5171 行的 classifyHandGesture，
     只把 THREE.MathUtils.clamp 换成本文件内的 clamp，不依赖 THREE。           */
  /* ------------------------------------------------------------------------ */
  function classifyHandGesture(lm) {
    // 公开 API 入参保护：不足 21 点无法计算，直接返回 null（不改变有效输入的算法结果）。
    if (!Array.isArray(lm) || lm.length < 21) return null;

    const dist2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const dist3DWeighted = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.4);
    const getAngle = (p1, p2, p3) => {
      const v1x = p1.x - p2.x, v1y = p1.y - p2.y, v1z = (p1.z - p2.z) * 0.45;
      const v2x = p3.x - p2.x, v2y = p3.y - p2.y, v2z = (p3.z - p2.z) * 0.45;
      const dot = v1x * v2x + v1y * v2y + v1z * v2z;
      const m1 = Math.hypot(v1x, v1y, v1z);
      const m2 = Math.hypot(v2x, v2y, v2z);
      return (Math.acos(clamp(dot / (m1 * m2 + 1e-6), -1, 1)) * 180) / Math.PI;
    };

    const wrist = lm[0];
    const palmSize = Math.max(0.05, dist2D(wrist, lm[9]));

    const isExtended = [false, false, false, false, false];
    const isCurled = [false, false, false, false, false];

    const thumbAngle = getAngle(lm[1], lm[2], lm[4]);
    const thumbToPinkyMcp = dist2D(lm[4], lm[17]) / palmSize;
    const thumbToIndexMcp = dist2D(lm[4], lm[5]) / palmSize;
    const thumbToIndexPip = dist2D(lm[4], lm[6]) / palmSize;
    isExtended[0] = thumbAngle > 136 && thumbToPinkyMcp > 0.98 && (thumbToIndexMcp > 0.50 || thumbToIndexPip > 0.68);
    isCurled[0] = (thumbToIndexMcp < 0.42 && thumbToIndexPip < 0.55) || thumbAngle < 124;

    for (let idx = 1; idx <= 4; idx++) {
      const mcp = lm[idx * 4 + 1], pip = lm[idx * 4 + 2], dip = lm[idx * 4 + 3], tip = lm[idx * 4 + 4];
      const pipAngle = getAngle(mcp, pip, dip);
      const fullAngle = getAngle(mcp, pip, tip);
      const dTip = dist3DWeighted(tip, wrist), dPip = dist3DWeighted(pip, wrist), dMcp = dist3DWeighted(mcp, wrist);
      isExtended[idx] = fullAngle > 138 && pipAngle > 135 && dTip > dPip * 1.08 && dTip > dMcp * 1.22;
      isCurled[idx] = fullAngle < 122 || dTip < dPip * 1.02;
    }

    const [thumb, index, middle, ring, pinky] = isExtended;
    const mainExtendedCount = (index ? 1 : 0) + (middle ? 1 : 0) + (ring ? 1 : 0) + (pinky ? 1 : 0);
    const curledMainCount = (isCurled[1] ? 1 : 0) + (isCurled[2] ? 1 : 0) + (isCurled[3] ? 1 : 0) + (isCurled[4] ? 1 : 0);
    const pinchDist = dist2D(lm[4], lm[8]) / palmSize;
    const isOkSeal = pinchDist < 0.36 && middle && ring && pinky;

    // 1. 大庚剑阵：食指+小指结印 或 OK手势
    if ((index && pinky && !middle && !ring) || isOkSeal) {
      return 'DAGENG';
    }

    // 2. 巨剑术：参照图片手势（大拇指与食指伸直张开呈 L 型/八字诀，其余三指收拢）
    const isThumbIndexL = thumb && index && !middle && !ring && !pinky && (isCurled[2] || isCurled[3]) && thumbToIndexPip > 0.65;
    if (isThumbIndexL) {
      return 'GIANT';
    }

    // 3. 剑影分光：食指+中指并拢剑指，或收起大拇指单食指
    if ((index && middle && !ring && !pinky) || (!thumb && index && !middle && !ring && !pinky && (isCurled[3] || isCurled[4]))) {
      return 'DRAGON';
    }

    // 4. 青元剑盾：握拳（四指收拢）
    if (mainExtendedCount === 0 && curledMainCount >= 3) {
      return 'SHIELD';
    }

    // 5. 莲花剑阵：五指张开
    if (mainExtendedCount === 4) {
      return 'LOTUS';
    }

    return null;
  }

  /* ------------------------------------------------------------------------ */
  /* 骨架绘制：#gesture-overlay（240x180 的 2D canvas，逐点缩放）              */
  /* ------------------------------------------------------------------------ */
  function clearOverlay() {
    var canvas = getOverlayCanvas();
    if (!canvas) return;
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (_) { ctx = null; }
    if (!ctx) return;
    try { ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (_) { /* 忽略 */ }
  }

  function drawHandSkeleton(landmarks) {
    var canvas = getOverlayCanvas();
    if (!canvas) return;
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (_) { ctx = null; }
    if (!ctx) return;
    var width = canvas.width || OVERLAY_WIDTH;
    var height = canvas.height || OVERLAY_HEIGHT;
    try {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.strokeStyle = SKELETON_COLOR;
      ctx.fillStyle = SKELETON_COLOR;
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (var i = 0; i < HAND_CONNECTIONS.length; i++) {
        var a = landmarks[HAND_CONNECTIONS[i][0]];
        var b = landmarks[HAND_CONNECTIONS[i][1]];
        if (!a || !b) continue;
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
      }
      ctx.stroke();
      for (var j = 0; j < landmarks.length; j++) {
        var point = landmarks[j];
        if (!point) continue;
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, j % 4 === 0 ? 2.6 : 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } catch (error) {
      warn('骨架绘制失败：', error);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 回调派发                                                                  */
  /* ------------------------------------------------------------------------ */
  // game.js 既可能用 `GEST.onUpdate = fn` 赋值，也可能写成 `GEST.onUpdate(fn)` 注册；
  // 两种写法都由同一个 onUpdate 访问器接住，内部只保存真实回调。
  function registerOnUpdate(fn) {
    if (typeof fn !== 'function') return false;
    onUpdateHandler = fn;
    return true;
  }

  function emit(payload) {
    if (!onUpdateHandler) return; // 回调可能还没被 game.js 赋值
    try {
      onUpdateHandler(payload);
    } catch (error) {
      warn('onUpdate 回调异常（已忽略）：', error);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 检测结果处理（真实摄像头与 simulate 共用同一条路径）                      */
  /* ------------------------------------------------------------------------ */
  function resetTrackingState() {
    gestureWindow.length = 0;
    stableGesture = null;
    present = false;
    lastSeenAt = 0;
  }

  function processLandmarks(landmarks, aspect, timestamp) {
    if (!Array.isArray(landmarks) || landmarks.length < 21) {
      handleNoHand(timestamp);
      return null;
    }
    // 与 app.js 5218-5219 行一致：归一化坐标 → 各向同性 metric 坐标。
    var metricLandmarks = landmarks.map(function (point) {
      var z = typeof point.z === 'number' && isFinite(point.z) ? point.z : 0;
      return { x: point.x * aspect, y: point.y, z: z * aspect };
    });

    var raw = null;
    try {
      raw = classifyHandGesture(metricLandmarks);
    } catch (error) {
      raw = null;
    }

    // 与 app.js 5225-5236 行一致：6 帧窗口 + 至少 3 票才切换稳定手势。
    if (raw) {
      gestureWindow.push(raw);
      while (gestureWindow.length > GESTURE_WINDOW_SIZE) gestureWindow.shift();
      var counts = {};
      var best = stableGesture;
      var maxVotes = 0;
      for (var i = 0; i < gestureWindow.length; i++) {
        var gesture = gestureWindow[i];
        counts[gesture] = (counts[gesture] || 0) + 1;
        if (counts[gesture] > maxVotes) {
          maxVotes = counts[gesture];
          best = gesture;
        }
      }
      if (maxVotes >= GESTURE_MIN_VOTES) stableGesture = best;
    }

    present = true;
    lastSeenAt = timestamp;

    // 食指尖 lm[8]；x 做自拍镜像，y 直接映射到屏幕 CSS 像素。
    var tip = landmarks[8] || landmarks[0] || { x: 0.5, y: 0.5 };
    var screenWidth = typeof window.innerWidth === 'number' ? window.innerWidth : 0;
    var screenHeight = typeof window.innerHeight === 'number' ? window.innerHeight : 0;
    var screenX = (1 - tip.x) * screenWidth;
    var screenY = tip.y * screenHeight;

    drawHandSkeleton(landmarks);
    emit({
      present: true,
      gesture: stableGesture,
      x: screenX,
      y: screenY,
      raw: raw,
      landmarks: landmarks
    });
    return raw;
  }

  function handleNoHand(timestamp) {
    // 0.4 秒防抖：短暂丢帧时保持上一帧的 present=true，避免 HUD 闪烁。
    if (present && timestamp - lastSeenAt < HAND_LOST_MS) return;
    if (present) {
      present = false;
      stableGesture = null;
      gestureWindow.length = 0;
      clearOverlay();
    }
    emit({ present: false, gesture: null, x: 0, y: 0, raw: null, landmarks: null });
  }

  /* ------------------------------------------------------------------------ */
  /* 摄像头                                                                     */
  /* ------------------------------------------------------------------------ */
  function describeCameraError(error) {
    var name = (error && (error.name || error.code)) || 'UNKNOWN';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return '未获得摄像头授权：请在浏览器地址栏的网站权限中允许摄像头，然后重试。';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '没有找到可用摄像头，请确认设备已连接摄像头。';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
      return '摄像头被占用或暂时无法启动，请关闭其他使用摄像头的应用后重试。';
    }
    if (name === 'OverconstrainedError') {
      return '摄像头不支持所需参数，请更换摄像头后重试。';
    }
    if (name === 'NotSupportedError') {
      return '当前环境不支持摄像头采集，请更换浏览器。';
    }
    return '无法开启摄像头（' + name + '），请检查摄像头权限后重试。';
  }

  function stopMediaStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;
    try {
      var tracks = stream.getTracks();
      for (var i = 0; i < tracks.length; i++) {
        try { tracks[i].stop(); } catch (_) { /* 忽略单条轨道停止失败 */ }
      }
    } catch (_) { /* 忽略 */ }
  }

  function detachVideo(video) {
    var el = video || byId('gesture-video');
    if (!el) return;
    try { el.pause(); } catch (_) { /* 忽略 */ }
    try { el.srcObject = null; } catch (_) { /* 忽略 */ }
  }

  function attachCameraStream(stream, video) {
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.autoplay = true;
    video.srcObject = stream;
  }

  /* ------------------------------------------------------------------------ */
  /* 本地识别资产与 HandLandmarker（对应 app.js 4927-5041 行的本地链路）       */
  /* ------------------------------------------------------------------------ */
  function assetUrl(relativePath) {
    return new URL(relativePath, document.baseURI).href;
  }

  function fetchAssetBytes(relativePath, label) {
    var url = assetUrl(relativePath);
    return fetch(url, { credentials: 'same-origin' }).then(function (response) {
      if (!response || !response.ok) {
        throw gestureError('手势识别组件加载失败：' + label + '（HTTP ' + (response ? response.status : '?') + '）', 'ASSET_HTTP');
      }
      return response.arrayBuffer();
    }).then(function (buffer) {
      if (!buffer || !buffer.byteLength) {
        throw gestureError('手势识别组件内容为空：' + label, 'ASSET_EMPTY');
      }
      // 与 app.js 的 wasm.bytes / model.bytes 类型一致，统一用 Uint8Array。
      return new Uint8Array(buffer);
    }).catch(function (error) {
      if (error && error.userMessage) throw error;
      throw gestureError('手势识别组件加载失败：' + label + '（' + ((error && error.message) || error) + '）', 'ASSET_FETCH');
    });
  }

  function loadLocalHandAssets() {
    if (assetsPromise) return assetsPromise;
    var work = (function () {
      var vision = window.QingyuanVision;
      if (!vision || !vision.FilesetResolver || !vision.HandLandmarker) {
        return Promise.reject(gestureError('手势识别组件未加载：缺少 window.QingyuanVision，请确认 td/index.html 已按主游戏顺序加载 vision-bundle.js。', 'VISION_RUNTIME'));
      }
      var simd = false;
      return Promise.resolve()
        .then(function () {
          return vision.FilesetResolver.isSimdSupported ? vision.FilesetResolver.isSimdSupported() : false;
        })
        .catch(function () { return false; })
        .then(function (supported) {
          simd = !!supported;
          var factory = simd ? window.QingyuanHandWasmSIMD : window.QingyuanHandWasmBasic;
          if (typeof factory !== 'function') {
            throw gestureError('手势识别组件不完整：缺少本地 ' + (simd ? 'SIMD' : 'BASIC') + ' WASM 运行时，请确认 td/index.html 已加载 hand-wasm-*-runtime.js。', 'WASM_RUNTIME');
          }
          var wasmPath = simd ? HAND_ASSET_PATHS.wasmSimd : HAND_ASSET_PATHS.wasmBasic;
          return Promise.all([
            fetchAssetBytes(wasmPath, simd ? 'vision_wasm_internal.wasm' : 'vision_wasm_nosimd_internal.wasm'),
            fetchAssetBytes(HAND_ASSET_PATHS.model, 'hand_landmarker.bin')
          ]).then(function (buffers) {
            return { wasm: buffers[0], model: buffers[1], simd: simd, wasmUrl: assetUrl(wasmPath) };
          });
        });
    })();
    assetsPromise = work;
    work.catch(function () {
      // 失败不缓存，下次 enable 可以重试。
      if (assetsPromise === work) assetsPromise = null;
    });
    return work;
  }

  function createHandLandmarker(delegate, assets) {
    // 与 app.js 5018-5027 行一致：先挂全局 ModuleFactory / Module，再 createFromOptions。
    window.ModuleFactory = assets.simd ? window.QingyuanHandWasmSIMD : window.QingyuanHandWasmBasic;
    window.Module = { wasmBinary: assets.wasm };
    return window.QingyuanVision.HandLandmarker.createFromOptions(
      { wasmLoaderPath: '', wasmBinaryPath: assets.wasmUrl },
      {
        baseOptions: { modelAssetBuffer: assets.model, delegate: delegate },
        canvas: document.createElement('canvas'),
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      }
    );
  }

  function buildLocalHandLandmarker(assets) {
    var delegates = ['GPU', 'CPU'];
    var lastError = null;
    var index = 0;
    function attempt() {
      if (index >= delegates.length) {
        var detail = (lastError && (lastError.message || String(lastError))) || '未知错误';
        return Promise.reject(gestureError('手势识别组件初始化失败：' + detail, 'MODEL_INIT'));
      }
      var delegate = delegates[index++];
      return Promise.resolve()
        .then(function () { return createHandLandmarker(delegate, assets); })
        .then(function (model) {
          handDelegate = delegate;
          return model;
        })
        .catch(function (error) {
          lastError = error || new Error('unknown');
          if (index < delegates.length) {
            warn('GPU 手势识别不可用，改用 CPU 兼容模式：', error);
          }
          return attempt();
        });
    }
    return attempt();
  }

  /* ------------------------------------------------------------------------ */
  /* 检测循环                                                                  */
  /* ------------------------------------------------------------------------ */
  function startDetectLoop() {
    if (rafId) return;
    var tick = function (frameTime) {
      if (!enabled) { rafId = 0; return; }
      rafId = window.requestAnimationFrame(tick);
      detectFrame(typeof frameTime === 'number' ? frameTime : nowMs());
    };
    rafId = window.requestAnimationFrame(tick);
  }

  function stopDetectLoop() {
    if (!rafId) return;
    try { window.cancelAnimationFrame(rafId); } catch (_) { /* 忽略 */ }
    rafId = 0;
  }

  function detectFrame(timestamp) {
    if (!enabled || !handLandmarker) return;
    var video = getVideoElement(false);
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      handleNoHand(timestamp);
      return;
    }
    var interval = handDelegate === 'CPU' ? CPU_INTERVAL_MS : GPU_INTERVAL_MS;
    if (timestamp - lastInferenceAt < interval) return;
    // 同一帧不重复推理；没有新画面时按“无手”计时，避免摄像头冻结后 HUD 卡在 present。
    if (video.currentTime === lastVideoTime) {
      handleNoHand(timestamp);
      return;
    }
    lastInferenceAt = timestamp;
    lastVideoTime = video.currentTime;

    var result = null;
    try {
      result = handLandmarker.detectForVideo(video, timestamp);
    } catch (error) {
      consecutiveInferenceErrors += 1;
      if (consecutiveInferenceErrors === 1) warn('手势识别推理异常（will retry）：', error);
      if (consecutiveInferenceErrors >= 10) {
        warn('手势识别连续失败，停止手势控制：', error);
        disable({ silent: true });
        setStatus('手势识别运行异常，已停止手势控制，可重新开启。', 'error');
        setToggleLabel('开启手势控制');
      }
      return;
    }
    consecutiveInferenceErrors = 0;

    var landmarks = result && result.landmarks && result.landmarks.length ? result.landmarks[0] : null;
    if (landmarks) {
      processLandmarks(landmarks, video.videoWidth / video.videoHeight, timestamp);
    } else {
      handleNoHand(timestamp);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* enable / disable / toggle                                                 */
  /* ------------------------------------------------------------------------ */
  function cleanupCamera() {
    var stream = cameraStream;
    cameraStream = null;
    if (stream) stopMediaStream(stream);
    detachVideo();
  }

  function teardown() {
    sessionSerial += 1;
    enabled = false;
    stopDetectLoop();
    resetTrackingState();
    lastInferenceAt = 0;
    lastVideoTime = -1;
    consecutiveInferenceErrors = 0;
    handDelegate = '';
    var model = handLandmarker;
    handLandmarker = null;
    if (model) {
      try { model.close(); } catch (_) { /* 忽略关闭异常 */ }
    }
    cleanupCamera();
    clearOverlay();
  }

  function disable(options) {
    var silent = !!(options && options.silent);
    teardown();
    if (!silent) {
      setStatus('手势：未开启', 'off');
      setToggleLabel('开启手势控制');
    }
  }

  function enable() {
    if (enabled) return Promise.resolve(true);
    if (starting) return starting;

    var serial = ++sessionSerial;
    setToggleLabel('正在开启手势控制…');
    var work = (async function () {
      var video = null;
      try {
        // 1. 安全上下文与摄像头接口检查（127.0.0.1 / localhost 属于安全上下文）。
        if (window.isSecureContext === false) {
          throw gestureError('手势不可用：当前页面不是安全页面，请通过 HTTPS 或 localhost 打开。', 'INSECURE_CONTEXT');
        }
        video = getVideoElement(true);
        if (!video) {
          throw gestureError('手势不可用：页面缺少 #gesture-video 视频元素。', 'NO_VIDEO_ELEMENT');
        }
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          throw gestureError('手势不可用：当前浏览器没有提供摄像头接口。', 'CAMERA_API');
        }

        // 2. 摄像头：与主游戏一致的方向与分辨率约束。
        setStatus('正在申请摄像头权限…', 'starting');
        var stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
          });
        } catch (error) {
          throw gestureError(describeCameraError(error), 'CAMERA_PERMISSION');
        }
        if (serial !== sessionSerial) {
          stopMediaStream(stream);
          return false;
        }
        cameraStream = stream;
        for (var t = 0; t < stream.getVideoTracks().length; t++) {
          (function (track) {
            track.addEventListener('ended', function () {
              if (serial !== sessionSerial || !enabled) return;
              disable({ silent: true });
              setStatus('摄像头已被断开，手势控制已停止，可重新开启。', 'error');
              setToggleLabel('开启手势控制');
            });
          })(stream.getVideoTracks()[t]);
        }
        attachCameraStream(stream, video);
        try {
          await video.play();
        } catch (playError) {
          throw gestureError('摄像头画面播放失败，请检查浏览器是否允许播放摄像头画面。', 'VIDEO_PLAY');
        }
        if (serial !== sessionSerial) return false;

        // 3. 本地资产：wasm + 模型全部来自 ../assets/hand，不做任何远程兜底。
        setStatus('摄像头已开启，正在加载识别组件…', 'starting');
        var assets = await loadLocalHandAssets();
        if (serial !== sessionSerial) return false;

        // 4. 识别组件：先 GPU，失败再 CPU。
        var model = await buildLocalHandLandmarker(assets);
        if (serial !== sessionSerial) {
          try { model.close(); } catch (_) { /* 忽略 */ }
          return false;
        }
        handLandmarker = model;
        resetTrackingState();
        lastInferenceAt = 0;
        lastVideoTime = -1;
        consecutiveInferenceErrors = 0;
        enabled = true;
        setStatus('手势识别已就绪，请将手掌放入画面', 'ready');
        setToggleLabel('关闭手势控制');
        startDetectLoop();
        return true;
      } catch (error) {
        if (serial !== sessionSerial) {
          // 已被 disable() 取消，静默退出。
          return false;
        }
        enabled = false;
        stopDetectLoop();
        resetTrackingState();
        cleanupCamera();
        var message = (error && (error.userMessage || error.message)) || '手势不可用：未知错误';
        setStatus(message, 'error');
        setToggleLabel('开启手势控制');
        warn('开启手势控制失败：', error);
        return false;
      }
    })();

    starting = work;
    var clearStarting = function () {
      if (starting === work) starting = null;
    };
    work.then(clearStarting, clearStarting);
    return work;
  }

  function toggle() {
    if (enabled) {
      disable();
      return Promise.resolve(false);
    }
    return enable();
  }

  /* ------------------------------------------------------------------------ */
  /* 无摄像头测试入口                                                          */
  /* ------------------------------------------------------------------------ */
  function simulate(landmarks) {
    try {
      var video = getVideoElement(false);
      var aspect = DEFAULT_ASPECT;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        aspect = video.videoWidth / video.videoHeight;
      }
      processLandmarks(Array.isArray(landmarks) ? landmarks : [], aspect, nowMs());
      return true;
    } catch (error) {
      warn('simulate 失败：', error);
      return false;
    }
  }

  function simulateGesture(name) {
    try {
      var gesture = typeof name === 'string' && name ? name.toUpperCase() : null;
      if (!gesture || !GESTURE_NAMES[gesture]) {
        warn('simulateGesture 收到未知手势名：', name);
        return false;
      }
      var centerX = (typeof window.innerWidth === 'number' ? window.innerWidth : 0) / 2;
      var centerY = (typeof window.innerHeight === 'number' ? window.innerHeight : 0) / 2;
      emit({
        present: true,
        gesture: gesture,
        x: centerX,
        y: centerY,
        raw: gesture,
        landmarks: null
      });
      return true;
    } catch (error) {
      warn('simulateGesture 失败：', error);
      return false;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 导出                                                                      */
  /* ------------------------------------------------------------------------ */
  api = {
    __qytdGestureModule: true,
    enable: enable,
    disable: disable,
    toggle: toggle,
    classify: classifyHandGesture,
    simulate: simulate,
    simulateGesture: simulateGesture
  };
  Object.defineProperty(api, 'isEnabled', {
    enumerable: true,
    get: function () { return enabled; }
  });
  Object.defineProperty(api, 'status', {
    enumerable: true,
    get: function () { return statusText; }
  });
  Object.defineProperty(api, 'delegate', {
    enumerable: true,
    get: function () { return handDelegate; }
  });
  // onUpdate 访问器：
  //  - 赋值形式 `GEST.onUpdate = fn` 走 setter，保存回调；
  //  - 注册形式 `GEST.onUpdate(fn)` 时 getter 在尚未赋值的情况下返回注册函数；
  //  - 已赋值后 getter 直接返回回调，与“onUpdate 是回调”的约定一致。
  Object.defineProperty(api, 'onUpdate', {
    enumerable: true,
    configurable: true,
    get: function () { return onUpdateHandler || registerOnUpdate; },
    set: function (fn) { onUpdateHandler = typeof fn === 'function' ? fn : null; }
  });

  window.QYTDGesture = api;
  setStatus('手势：未开启', 'off');
})();
