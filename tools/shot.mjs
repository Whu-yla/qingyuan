#!/usr/bin/env node
/**
 * qingyuan headless acceptance shot tool
 *
 * 用本机 Microsoft Edge (channel: msedge) 无头打开青元剑诀，等待启动完成，
 * 采集 console / pageerror / requestfailed、WebGL 状态、解锁 UI 文本、
 * 画布尺寸，判定画面是否非黑，输出整页与画布截图，并写 report.md。
 *
 * 用法:
 *   node shot.mjs [--url http://127.0.0.1:8123/index.html]
 *                 [--out ../shots/boot.png]
 *                 [--report ../shots/report.md]
 *                 [--timeout 120000] [--post-wait 3000]
 *                 [--channel msedge] [--headed]
 *
 * 说明:
 *   - 只依赖 playwright-core，使用系统安装的 Edge，不下载任何浏览器。
 *   - 画布截图路径由 --out 派生：boot.png -> boot-canvas.png。
 *   - 非黑检测两条链路：页面内 canvas.toDataURL 采样 + 截图 PNG 解码采样。
 *   - stdout 只输出一个 JSON；过程日志走 stderr。
 *   - exit code: 0 = 启动完成且画面非黑；1 = 验收失败（报告仍会写出）。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULTS = {
  url: 'http://127.0.0.1:8123/index.html',
  out: path.join(REPO_ROOT, 'shots', 'boot.png'),
  report: null,
  timeout: 120000,
  postWait: 3000,
  channel: 'msedge',
  headed: false,
  viewportWidth: 1440,
  viewportHeight: 900,
};

const LAUNCH_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--ignore-gpu-blocklist',
];

function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error('Missing value for ' + arg);
      i += 1;
      return value;
    };
    switch (arg) {
      case '--url': opts.url = next(); break;
      case '--out': opts.out = path.resolve(next()); break;
      case '--report': opts.report = path.resolve(next()); break;
      case '--timeout': opts.timeout = Number(next()); break;
      case '--post-wait': opts.postWait = Number(next()); break;
      case '--channel': opts.channel = next(); break;
      case '--headed': opts.headed = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error('Unknown argument: ' + arg);
    }
  }
  if (!opts.report) opts.report = path.join(path.dirname(opts.out), 'report.md');
  return opts;
}

const log = (...parts) => process.stderr.write('[shot] ' + parts.join(' ') + '\n');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const localTime = (date = new Date()) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replace(/\//g, '-');

/* ------------------------------------------------------------------ */
/* PNG 解码（仅用 node:zlib，用来给截图做像素统计）                    */
/* ------------------------------------------------------------------ */
function decodePNG(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8) throw new Error('unsupported PNG bit depth: ' + bitDepth);
  if (interlace !== 0) throw new Error('interlaced PNG is not supported');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error('unsupported PNG color type: ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[pos++];
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[rowStart - stride + x - channels] : 0;
      let out;
      switch (filter) {
        case 0: out = value; break;
        case 1: out = value + left; break;
        case 2: out = value + up; break;
        case 3: out = value + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
          const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          out = value + predictor;
          break;
        }
        default: throw new Error('bad PNG filter: ' + filter);
      }
      pixels[rowStart + x] = out & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

function analyzePixels(png, region) {
  const { width, height, channels, pixels } = png;
  const x0 = Math.max(0, Math.floor(width * region.x0));
  const y0 = Math.max(0, Math.floor(height * region.y0));
  const x1 = Math.min(width, Math.ceil(width * region.x1));
  const y1 = Math.min(height, Math.ceil(height * region.y1));
  let total = 0, nonBlack = 0, bright = 0, lumaSum = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * channels;
      const r = pixels[i], g = channels >= 3 ? pixels[i + 1] : r, b = channels >= 3 ? pixels[i + 2] : r;
      const a = channels === 4 ? pixels[i + 3] : 255;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      total += 1;
      lumaSum += luma;
      if (a > 8 && luma > 8) nonBlack += 1;
      if (a > 8 && luma > 40) bright += 1;
    }
  }
  return {
    region,
    width: x1 - x0,
    height: y1 - y0,
    total,
    nonBlack,
    nonBlackRatio: total ? Number((nonBlack / total).toFixed(6)) : 0,
    brightRatio: total ? Number((bright / total).toFixed(6)) : 0,
    avgLuma: total ? Number((lumaSum / total).toFixed(3)) : 0,
  };
}

function analyzeScreenshot(filePath) {
  const bytes = fs.readFileSync(filePath);
  const png = decodePNG(bytes);
  return {
    path: filePath,
    bytes: bytes.length,
    width: png.width,
    height: png.height,
    full: analyzePixels(png, { x0: 0, y0: 0, x1: 1, y1: 1 }),
    center: analyzePixels(png, { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 }),
  };
}

/* ------------------------------------------------------------------ */
/* 页面内采集                                                          */
/* ------------------------------------------------------------------ */
const READ_STATE = () => {
  const loading = document.getElementById('qingyuan-loading');
  const stage = document.getElementById('app-stage');
  const pctEl = document.getElementById('qy-loading-percent');
  const statusEl = document.getElementById('qy-loading-status');
  const hintEl = document.getElementById('qy-loading-hint');
  const retryEl = document.getElementById('qy-loading-retry');
  const computed = loading ? getComputedStyle(loading) : null;
  const loadingDisplay = computed ? computed.display : 'missing';
  const loadingHidden = !loading || loading.hidden === true || loadingDisplay === 'none';
  const pctText = pctEl ? (pctEl.textContent || '').trim() : '';
  const pct = Number.parseInt(pctText.replace(/[^0-9]/g, ''), 10);
  const stageInert = stage ? stage.hasAttribute('inert') : true;
  const lstate = window.QingyuanLoading && window.QingyuanLoading.state ? window.QingyuanLoading.state : null;
  const isError = Boolean((loading && loading.classList.contains('is-error')) || lstate === 'error');
  const ready = loadingHidden && !stageInert && Number.isFinite(pct) && pct >= 100;
  return {
    at: Math.round(performance.now()),
    pct: Number.isFinite(pct) ? pct : 0,
    pctText,
    status: statusEl ? (statusEl.textContent || '').trim() : '',
    hint: hintEl ? (hintEl.textContent || '').trim() : '',
    loadingHidden,
    loadingDisplay,
    loadingBusy: loading ? loading.getAttribute('aria-busy') : null,
    stageInert,
    startupState: lstate,
    isError,
    retryVisible: retryEl ? !retryEl.hidden : false,
    ready,
    docTitle: document.title,
  };
};

const COLLECT = () => {
  const result = {
    title: document.title,
    url: location.href,
    readyState: document.readyState,
    htmlClasses: document.documentElement.className,
    bodyClasses: document.body ? document.body.className : '',
    viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, dpr: window.devicePixelRatio },
    loadingStatusText: (document.getElementById('qy-loading-status')?.textContent || '').trim(),
    loadingHintText: (document.getElementById('qy-loading-hint')?.textContent || '').trim(),
    loadingHidden: document.getElementById('qingyuan-loading')?.hidden ?? true,
    stageInert: document.getElementById('app-stage')?.hasAttribute('inert') ?? true,
    qingyuanLoadingState: window.QingyuanLoading?.state ?? null,
    unlockHomeCount: (document.getElementById('unlock-home-count')?.textContent || '').trim(),
    unlockSummaryCount: (document.getElementById('unlock-summary-count')?.textContent || '').trim(),
    hasQingyuanUnlocks: Boolean(window.QingyuanUnlocks),
    hasQingyuanToyBridge: Boolean(window.QingyuanToyBridge),
    threeRevision: window.THREE?.REVISION ?? null,
    hasThree: Boolean(window.THREE),
    canvasCount: document.querySelectorAll('canvas').length,
    canvases: [],
    webgl: { supported: false, context: '', renderer: '', vendor: '', error: null },
    canvasContainer: null,
  };

  // 独立探针：检测 WebGL 可用性 / 渲染器信息（不与页面已有上下文冲突）
  try {
    const probe = document.createElement('canvas');
    probe.width = 8; probe.height = 8;
    const gl2 = probe.getContext('webgl2');
    const gl = gl2 || probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if (gl) {
      result.webgl.supported = true;
      result.webgl.context = gl2 ? 'webgl2' : 'webgl1';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      result.webgl.renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
      result.webgl.vendor = ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
    }
  } catch (error) {
    result.webgl.error = String(error);
  }

  const container = document.getElementById('canvas-container');
  if (container) {
    const rect = container.getBoundingClientRect();
    result.canvasContainer = {
      clientWidth: container.clientWidth,
      clientHeight: container.clientHeight,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      childCount: container.children.length,
      html: container.innerHTML.slice(0, 300),
    };
  }

  for (const canvas of document.querySelectorAll('canvas')) {
    let contextType = null;
    try {
      if (canvas.getContext('webgl2')) contextType = 'webgl2';
      else if (canvas.getContext('webgl')) contextType = 'webgl';
      else if (canvas.getContext('2d')) contextType = '2d';
    } catch (error) { contextType = 'error: ' + String(error); }
    const rect = canvas.getBoundingClientRect();
    result.canvases.push({
      id: canvas.id || '',
      className: String(canvas.className || ''),
      parentId: canvas.parentElement?.id || '',
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      contextType,
    });
  }
  return result;
};

// 页面内对每个 canvas 调 toDataURL，再用 2D canvas 解码采样中心 50% 区域
const SAMPLE_CANVAS_PIXELS = () => {
  const sampleOne = (canvas) => new Promise((resolve) => {
    const entry = { id: canvas.id || '', width: canvas.width, height: canvas.height, method: 'toDataURL', ok: false };
    if (!canvas.width || !canvas.height) {
      entry.error = 'zero-size canvas';
      resolve(entry);
      return;
    }
    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch (error) {
      entry.error = 'toDataURL failed: ' + String(error);
      resolve(entry);
      return;
    }
    if (!dataUrl || dataUrl.length < 64) {
      entry.error = 'toDataURL returned empty';
      resolve(entry);
      return;
    }
    const image = new Image();
    image.onload = () => {
      try {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        const ctx = buffer.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const x0 = Math.floor(width * 0.25), y0 = Math.floor(height * 0.25);
        const sw = Math.max(1, Math.floor(width * 0.5)), sh = Math.max(1, Math.floor(height * 0.5));
        const data = ctx.getImageData(x0, y0, sw, sh).data;
        let nonBlack = 0, bright = 0, lumaSum = 0;
        const total = sw * sh;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumaSum += luma;
          if (a > 8 && luma > 8) nonBlack += 1;
          if (a > 8 && luma > 40) bright += 1;
        }
        entry.ok = true;
        entry.dataUrlBytes = dataUrl.length;
        entry.sample = { x: x0, y: y0, width: sw, height: sh, total };
        entry.nonBlack = nonBlack;
        entry.nonBlackRatio = Number((nonBlack / total).toFixed(6));
        entry.brightRatio = Number((bright / total).toFixed(6));
        entry.avgLuma = Number((lumaSum / total).toFixed(3));
        resolve(entry);
      } catch (error) {
        entry.error = 'decode failed: ' + String(error);
        resolve(entry);
      }
    };
    image.onerror = () => {
      entry.error = 'image decode error';
      resolve(entry);
    };
    image.src = dataUrl;
  });
  return Promise.all([...document.querySelectorAll('canvas')].map(sampleOne));
};

/* ------------------------------------------------------------------ */
/* 截图                                                                */
/* ------------------------------------------------------------------ */
async function captureScreenshots(page, outPath, canvasPath) {
  const shots = { fullPage: null, canvas: null, errors: [] };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.mkdirSync(path.dirname(canvasPath), { recursive: true });

  try {
    await page.screenshot({ path: outPath, fullPage: true, animations: 'disabled' });
    shots.fullPage = { path: outPath, bytes: fs.statSync(outPath).size };
  } catch (error) {
    shots.errors.push('fullPage screenshot failed: ' + String(error));
  }

  try {
    const container = page.locator('#canvas-container').first();
    if (await container.count()) {
      await container.screenshot({ path: canvasPath, animations: 'disabled' });
      shots.canvas = { path: canvasPath, bytes: fs.statSync(canvasPath).size, mode: 'element' };
    } else {
      shots.errors.push('#canvas-container not found');
    }
  } catch (error) {
    shots.errors.push('element screenshot failed: ' + String(error));
    try {
      const box = await page.locator('#canvas-container').first().boundingBox();
      if (box) {
        await page.screenshot({ path: canvasPath, clip: box, animations: 'disabled' });
        shots.canvas = { path: canvasPath, bytes: fs.statSync(canvasPath).size, mode: 'clip' };
      }
    } catch (fallbackError) {
      shots.errors.push('clip screenshot failed: ' + String(fallbackError));
    }
  }
  return shots;
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */
async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    log('argument error:', error.message);
    process.exitCode = 2;
    return;
  }
  if (opts.help) {
    process.stderr.write('Usage: node shot.mjs [--url URL] [--out FILE] [--report FILE] [--timeout MS] [--post-wait MS] [--channel NAME] [--headed]\n');
    return;
  }

  const outPath = opts.out;
  const canvasPath = outPath.replace(/\.png$/i, '') + '-canvas.png';
  const startedAt = new Date();
  const t0 = Date.now();

  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const timeline = [];
  let lastTimelineKey = '';

  const browser = await chromium.launch({
    channel: opts.channel,
    headless: !opts.headed,
    args: LAUNCH_ARGS,
  });

  let context;
  let page;
  const result = {
    ok: false,
    tool: 'tools/shot.mjs',
    startedAt: startedAt.toISOString(),
    startedAtLocal: localTime(startedAt),
    url: opts.url,
    channel: opts.channel,
    headless: !opts.headed,
    viewport: { width: opts.viewportWidth, height: opts.viewportHeight, deviceScaleFactor: 1 },
    launchArgs: LAUNCH_ARGS,
    load: {
      ready: false, readyElapsedMs: null, timedOut: false, timeline, lastState: null, errorState: false,
      navError: null, navStatus: null, requestedUrl: opts.url, finalUrl: null, redirected: false,
      navigations: [], documents: [],
    },
    shots: { fullPage: null, canvas: null, errors: [] },
    page: null,
    pixel: { canvasToDataURL: [], screenshots: {} },
    console: { total: 0, errorCount: 0, warningCount: 0, errors: [], errorTop: [], pageErrors: [], requestFailures: [], requestFailureTop: [] },
    conclusion: '未开始',
    durationMs: 0,
    reportPath: opts.report,
    timings: { launchMs: null, navMs: null, readyMs: null, postWaitMs: null, screenshotsMs: null, pixelAnalysisMs: null, closeMs: null },
  };
  result.timings.launchMs = Date.now() - t0;

  try {
    context = await browser.newContext({
      viewport: { width: opts.viewportWidth, height: opts.viewportHeight },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    page.setDefaultTimeout(30000);

    page.on('console', (message) => {
      const loc = message.location();
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
        at: Date.now() - t0,
        location: loc?.url ? (loc.url + ':' + (loc.lineNumber ?? '') + ':' + (loc.columnNumber ?? '')) : '',
      });
    });
    page.on('pageerror', (error) => {
      pageErrors.push({
        name: error?.name || 'Error',
        message: String(error?.message || error),
        stack: String(error?.stack || '').split('\n').slice(0, 8).join('\n'),
        at: Date.now() - t0,
      });
    });
    page.on('requestfailed', (request) => {
      requestFailures.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText || 'unknown',
        at: Date.now() - t0,
      });
    });
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      result.load.navigations.push({ at: Date.now() - t0, url: frame.url() });
    });
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'document') return;
      result.load.documents.push({ at: Date.now() - t0, url: response.url(), status: response.status() });
    });
    page.on('crash', () => log('page crashed'));

    log('navigating to', opts.url);
    try {
      const response = await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      result.load.navStatus = response ? response.status() : null;
      log('navigation response status:', result.load.navStatus);
    } catch (error) {
      result.load.navError = String(error);
      log('navigation warning:', error.message);
    }

    result.timings.navMs = Date.now() - t0;
    result.load.finalUrl = page.url();
    result.load.redirected = result.load.finalUrl !== opts.url;
    if (result.load.redirected) log('WARNING redirected:', opts.url, '=>', result.load.finalUrl);

    const deadline = Date.now() + opts.timeout;
    let state = null;
    while (Date.now() < deadline) {
      try {
        state = await page.evaluate(READ_STATE);
      } catch (error) {
        result.load.lastState = { evaluateError: String(error), at: Date.now() - t0 };
        log('state evaluate failed:', error.message);
        await sleep(500);
        continue;
      }
      result.load.lastState = state;
      const key = [state.pct, state.status, state.loadingHidden, state.stageInert, state.startupState, state.isError].join('|');
      if (key !== lastTimelineKey) {
        lastTimelineKey = key;
        timeline.push({ elapsedMs: Date.now() - t0, percent: state.pct, status: state.status, loadingHidden: state.loadingHidden, stageInert: state.stageInert, startupState: state.startupState, isError: state.isError });
        if (timeline.length > 300) timeline.splice(0, timeline.length - 300);
        log('stage:', 'pct=' + state.pct, 'hidden=' + state.loadingHidden, 'inert=' + state.stageInert, 'state=' + state.startupState, '|', state.status);
      }
      if (state.isError) {
        result.load.errorState = true;
        break;
      }
      if (state.ready) break;
      await sleep(250);
    }
    result.load.ready = Boolean(state && state.ready);
    result.load.readyElapsedMs = state && state.ready ? Date.now() - t0 : null;
    result.load.timedOut = !result.load.ready && !result.load.errorState;
    result.timings.readyMs = Date.now() - t0;

    // 启动成功后再等 3s 让首帧稳定；失败也等一会儿，保证能截到错误现场
    log(result.load.ready ? 'startup ready in ' + result.load.readyElapsedMs + 'ms; waiting ' + opts.postWait + 'ms' : 'startup not ready; waiting ' + opts.postWait + 'ms before capture');
    await sleep(opts.postWait);
    result.timings.postWaitMs = Date.now() - t0;

    let pageState = null;
    try {
      pageState = await page.evaluate(COLLECT);
    } catch (error) {
      pageState = { collectError: String(error) };
      log('collect failed:', error.message);
    }
    result.page = pageState;

    try {
      result.pixel.canvasToDataURL = await page.evaluate(SAMPLE_CANVAS_PIXELS);
    } catch (error) {
      result.pixel.canvasToDataURL = [{ error: 'sampling failed: ' + String(error) }];
      log('canvas pixel sampling failed:', error.message);
    }

    log('capturing screenshots');
    const screenshotsT0 = Date.now();
    result.shots = await captureScreenshots(page, outPath, canvasPath);
    result.timings.screenshotsMs = Date.now() - screenshotsT0;
    result.shotPaths = { fullPage: outPath, canvas: canvasPath };

    // 截图 PNG 解码统计（兜底验证，防止 WebGL preserveDrawingBuffer=false 导致 toDataURL 全黑）
    const pixelT0 = Date.now();
    for (const key of ['fullPage', 'canvas']) {
      const shot = result.shots[key];
      if (!shot?.path) continue;
      try {
        result.pixel.screenshots[key] = analyzeScreenshot(shot.path);
      } catch (error) {
        result.pixel.screenshots[key] = { path: shot.path, error: String(error) };
      }
    }

    result.timings.pixelAnalysisMs = Date.now() - pixelT0;

    // 汇总 console
    const errors = consoleMessages.filter((message) => message.type === 'error');
    const warnings = consoleMessages.filter((message) => message.type === 'warning' || message.type === 'warn');
    const groupBy = (items, keyFn) => {
      const map = new Map();
      for (const item of items) {
        const key = keyFn(item);
        const current = map.get(key);
        if (current) current.count += 1;
        else map.set(key, { ...item, count: 1 });
      }
      return [...map.values()].sort((a, b) => b.count - a.count);
    };
    result.console.total = consoleMessages.length;
    result.console.errorCount = errors.length;
    result.console.warningCount = warnings.length;
    result.console.errors = groupBy(errors, (message) => message.text).slice(0, 20);
    result.console.errorTop = result.console.errors.slice(0, 5);
    result.console.pageErrors = pageErrors;
    result.console.requestFailures = requestFailures.slice(0, 30);
    result.console.requestFailureTop = groupBy(requestFailures, (item) => item.url).slice(0, 5);
  } catch (error) {
    result.error = String(error && error.stack ? error.stack : error);
    log('fatal:', result.error);
    try {
      if (page && !result.shots.fullPage) {
        result.shots = await captureScreenshots(page, outPath, canvasPath);
      }
    } catch (_) { /* ignore */ }
  } finally {
    const closeT0 = Date.now();
    try { await context?.close(); } catch (_) {}
    try { await browser.close(); } catch (_) {}
    result.timings.closeMs = Date.now() - closeT0;
  }

  result.durationMs = Date.now() - t0;

  // 判定结论
  const shotCenter = result.pixel.screenshots.fullPage?.center?.nonBlackRatio
    ?? result.pixel.screenshots.canvas?.center?.nonBlackRatio
    ?? 0;
  const canvasSampleMax = Math.max(0, ...result.pixel.canvasToDataURL.map((item) => item.nonBlackRatio || 0));
  const nonBlack = Math.max(shotCenter, canvasSampleMax) > 0.005;
  if (result.load.ready && nonBlack) {
    result.ok = true;
    result.conclusion = 'PASS：启动完成并进入主界面，画面非黑（截图中心非黑像素比例 ' + (shotCenter * 100).toFixed(2) + '%，Canvas toDataURL 采样最大 ' + (canvasSampleMax * 100).toFixed(2) + '%）。';
  } else if (result.load.ready && !nonBlack) {
    result.conclusion = 'FAIL：已进入主界面但画面疑似全黑（截图中心非黑像素比例 ' + (shotCenter * 100).toFixed(2) + '%）。';
  } else if (result.load.errorState) {
    result.conclusion = 'FAIL：启动脚本进入错误状态，卡在「' + (result.load.lastState?.status || '未知') + '」阶段（进度 ' + (result.load.lastState?.pct ?? '?') + '%）。';
  } else if (result.error) {
    result.conclusion = 'FAIL：工具执行异常：' + String(result.error).split('\n')[0];
  } else {
    result.conclusion = 'FAIL：等待 ' + opts.timeout + 'ms 后仍未启动完成，卡在「' + (result.load.lastState?.status || '未知') + '」阶段（进度 ' + (result.load.lastState?.pct ?? '?') + '%）。';
  }

  // 写 report.md
  try {
    fs.mkdirSync(path.dirname(opts.report), { recursive: true });
    fs.writeFileSync(opts.report, buildReport(result, opts), 'utf8');
  } catch (error) {
    log('report write failed:', error.message);
  }

  // stdout 只输出 JSON
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.ok ? 0 : 1;
}

/* ------------------------------------------------------------------ */
/* report.md                                                           */
/* ------------------------------------------------------------------ */
function buildReport(result, opts) {
  const lines = [];
  const push = (...parts) => lines.push(parts.join(''));
  const p = result.page || {};
  const pick = (value, fallback = '（无）') => (value === null || value === undefined || value === '' ? fallback : String(value));
  const bt = '`';
  const fence = '```';

  push('# 青元剑诀 · Headless Edge 验收报告');
  push('');
  push('> 由 ' + bt + 'tools/shot.mjs' + bt + ' 自动生成，数据来自本次真实运行。');
  push('');
  push('## 结论');
  push('');
  push('**' + result.conclusion + '**');
  push('');
  push('| 项 | 值 |');
  push('| --- | --- |');
  push('| 结果 | ' + (result.ok ? '✅ PASS' : '❌ FAIL') + ' |');
  push('| 时间 | ' + result.startedAtLocal + '（Asia/Shanghai，ISO ' + result.startedAt + '） |');
  push('| URL | ' + result.url + ' |');
  push('| 是否进入主界面 | ' + (result.load.ready ? '是' : '否') + ' |');
  push('| 启动耗时 | ' + (result.load.readyElapsedMs !== null ? result.load.readyElapsedMs + ' ms' : '未完成') + ' |');
  push('| 总耗时 | ' + result.durationMs + ' ms |');
  push('| 截图（整页） | ' + bt + pick(result.shots.fullPage?.path) + bt + '（' + pick(result.shots.fullPage?.bytes) + ' bytes） |');
  push('| 截图（画布） | ' + bt + pick(result.shots.canvas?.path) + bt + '（' + pick(result.shots.canvas?.bytes) + ' bytes） |');
  push('| 报告 | ' + bt + opts.report + bt + ' |');
  push('');
  push('## 运行环境');
  push('');
  push('| 项 | 值 |');
  push('| --- | --- |');
  push('| 浏览器 | Microsoft Edge headless，channel ' + bt + result.channel + bt + ' |');
  push('| viewport | ' + result.viewport.width + ' × ' + result.viewport.height + ' @' + result.viewport.deviceScaleFactor + 'x |');
  push('| 启动参数 | ' + bt + result.launchArgs.join(' ') + bt + ' |');
  push('| 等待上限 | ' + opts.timeout + ' ms；启动完成后额外等待 ' + opts.postWait + ' ms |');
  if (result.load.navStatus !== null) push('| 导航 HTTP 状态 | ' + result.load.navStatus + ' |');
  if (result.load.navError) push('| 导航异常 | ' + bt + result.load.navError + bt + ' |');
  push('');
  push('## 导航');
  push('');
  push('| 项 | 值 |');
  push('| --- | --- |');
  push('| 请求 URL | ' + bt + pick(result.load.requestedUrl) + bt + ' |');
  push('| 最终 URL | ' + bt + pick(result.load.finalUrl) + bt + ' |');
  push('| 是否发生跳转 | ' + (result.load.redirected ? '是 ⚠️' : '否') + ' |');
  for (const nav of result.load.navigations || []) push('| 主框架导航 @' + nav.at + 'ms | ' + bt + nav.url + bt + ' |');
  for (const doc of result.load.documents || []) push('| document 响应 @' + doc.at + 'ms | HTTP ' + doc.status + ' ' + bt + doc.url + bt + ' |');
  push('');
  push('## 启动过程时间线');
  push('');
  push('| 距开始 (ms) | 进度 | 加载状态文本 | #qingyuan-loading 隐藏 | #app-stage inert | Startup state |');
  push('| ---: | ---: | --- | --- | --- | --- |');
  for (const item of result.load.timeline) {
    push('| ' + item.elapsedMs + ' | ' + item.percent + '% | ' + pick(item.status) + ' | ' + (item.loadingHidden ? '是' : '否') + ' | ' + (item.stageInert ? '是' : '否') + ' | ' + pick(item.startupState) + ' |');
  }
  if (!result.load.timeline.length) push('| - | - | 未采集到任何进度（页面可能未加载或脚本未执行） | - | - | - |');
  push('');
  const tm = result.timings || {};
  const cum = (value, base) => (value === null || value === undefined ? '-' : value);
  const stage = (label, endMs, costMs) => push('| ' + label + ' | ' + cum(endMs) + ' | ' + (costMs === null || costMs === undefined ? '-' : costMs) + ' |');
  push('## 耗时分解');
  push('');
  push('| 阶段 | 距开始 (ms) | 本阶段耗时 (ms) |');
  push('| --- | ---: | ---: |');
  stage('浏览器启动', tm.launchMs, tm.launchMs);
  stage('首次导航完成', tm.navMs, tm.navMs !== null && tm.launchMs !== null ? tm.navMs - tm.launchMs : null);
  stage('启动完成（ready）', tm.readyMs, tm.readyMs !== null && tm.navMs !== null ? tm.readyMs - tm.navMs : null);
  stage('额外稳定等待结束', tm.postWaitMs, tm.postWaitMs !== null && tm.readyMs !== null ? tm.postWaitMs - tm.readyMs : null);
  stage('截图完成', tm.postWaitMs !== null && tm.screenshotsMs !== null ? tm.postWaitMs + tm.screenshotsMs : null, tm.screenshotsMs);
  stage('PNG 解码分析完成', tm.postWaitMs !== null && tm.screenshotsMs !== null && tm.pixelAnalysisMs !== null ? tm.postWaitMs + tm.screenshotsMs + tm.pixelAnalysisMs : null, tm.pixelAnalysisMs);
  stage('浏览器关闭', null, tm.closeMs);
  stage('总耗时', result.durationMs, null);
  push('');
  push('## 页面采集值');
  push('');
  push('| 项 | 值 |');
  push('| --- | --- |');
  push('| document.title | ' + pick(p.title) + ' |');
  push('| document.readyState | ' + pick(p.readyState) + ' |');
  push('| window.innerWidth × innerHeight | ' + pick(p.viewport ? p.viewport.innerWidth + ' × ' + p.viewport.innerHeight : null) + ' |');
  push('| canvas 数量 | ' + pick(p.canvasCount) + ' |');
  push('| WebGL 可用 | ' + (p.webgl?.supported ? '是（' + p.webgl.context + '）' : '否' + (p.webgl?.error ? '：' + p.webgl.error : '')) + ' |');
  push('| WebGL renderer | ' + pick(p.webgl?.renderer) + ' |');
  push('| WebGL vendor | ' + pick(p.webgl?.vendor) + ' |');
  push('| window.THREE REVISION | ' + pick(p.threeRevision) + ' |');
  push('| window.QingyuanUnlocks | ' + (p.hasQingyuanUnlocks ? '存在' : '不存在') + ' |');
  push('| #unlock-home-count | ' + pick(p.unlockHomeCount) + ' |');
  push('| #unlock-summary-count | ' + pick(p.unlockSummaryCount) + ' |');
  push('| #qy-loading-status | ' + pick(p.loadingStatusText) + ' |');
  push('| #qy-loading-hint | ' + pick(p.loadingHintText) + ' |');
  push('| #qingyuan-loading.hidden | ' + (p.loadingHidden === undefined ? '（无）' : p.loadingHidden) + ' |');
  push('| #app-stage[inert] | ' + (p.stageInert === undefined ? '（无）' : p.stageInert) + ' |');
  push('| QingyuanLoading.state | ' + pick(p.qingyuanLoadingState) + ' |');
  push('');
  push('### canvas 明细');
  push('');
  push('| id | 类名 | 父容器 | 绘制尺寸 | 显示尺寸 | 渲染上下文 |');
  push('| --- | --- | --- | --- | --- | --- |');
  for (const canvas of p.canvases || []) {
    push('| ' + pick(canvas.id, '(空)') + ' | ' + pick(canvas.className, '(无)') + ' | ' + pick(canvas.parentId, '(空)') + ' | ' + canvas.width + ' × ' + canvas.height + ' | ' + canvas.clientWidth + ' × ' + canvas.clientHeight + ' | ' + pick(canvas.contextType) + ' |');
  }
  if (!(p.canvases || []).length) push('| - | - | - | - | - | 页面无 canvas |');
  push('');
  push('## 画面非黑检测');
  push('');
  push('### A. 页面内 canvas.toDataURL 采样（中心 50% 区域）');
  push('');
  push('> 说明：主画布为 WebGL 且未开启 preserveDrawingBuffer，帧缓存清空后 toDataURL 读到的可能是全黑；webcam 的 2D canvas 在未开摄像头时也可能全黑。因此「画面非黑」以 B 段截图 PNG 解码为准。');
  push('');
  push('| canvas id | 尺寸 | 采样像素数 | 非黑像素 | 非黑比例 | 亮度均值 | 结果 |');
  push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const item of result.pixel.canvasToDataURL) {
    if (item.error) {
      push('| ' + pick(item.id) + ' | ' + pick(item.width) + ' × ' + pick(item.height) + ' | - | - | - | - | ' + item.method + ' 失败：' + item.error + ' |');
    } else {
      push('| ' + pick(item.id) + ' | ' + item.width + ' × ' + item.height + ' | ' + item.sample.total + ' | ' + item.nonBlack + ' | ' + (item.nonBlackRatio * 100).toFixed(2) + '% | ' + item.avgLuma + ' | ' + (item.nonBlackRatio > 0.005 ? '非黑 ✅' : '疑似全黑 ❌') + ' |');
    }
  }
  if (!result.pixel.canvasToDataURL.length) push('| - | - | - | - | - | - | 没有可采样的 canvas |');
  push('');
  push('### B. 截图 PNG 解码采样');
  push('');
  push('| 截图 | 尺寸 | 全图非黑比例 | 中心 50% 非黑比例 | 全图亮度均值 |');
  push('| --- | --- | ---: | ---: | ---: |');
  for (const label of Object.keys(result.pixel.screenshots)) {
    const analysis = result.pixel.screenshots[label];
    if (!analysis || analysis.error) {
      push('| ' + label + ' | - | - | - | ' + (analysis?.error || '无数据') + ' |');
      continue;
    }
    push('| ' + label + ' | ' + analysis.width + ' × ' + analysis.height + ' | ' + (analysis.full.nonBlackRatio * 100).toFixed(2) + '% | ' + (analysis.center.nonBlackRatio * 100).toFixed(2) + '% | ' + analysis.full.avgLuma + ' |');
  }
  if (!Object.keys(result.pixel.screenshots).length) push('| - | - | - | - | 无截图 |');
  push('');
  push('## Console / 异常');
  push('');
  push('| 类型 | 数量 |');
  push('| --- | ---: |');
  push('| console 总条数 | ' + result.console.total + ' |');
  push('| console error | ' + result.console.errorCount + ' |');
  push('| console warning | ' + result.console.warningCount + ' |');
  push('| pageerror | ' + result.console.pageErrors.length + ' |');
  push('| requestfailed | ' + result.console.requestFailures.length + ' |');
  push('');
  push('### console 错误 Top 5（按出现次数）');
  push('');
  if (result.console.errorTop.length) {
    push('| # | 次数 | 类型 | 内容 | 位置 |');
    push('| ---: | ---: | --- | --- | --- |');
    result.console.errorTop.forEach((item, index) => {
      push('| ' + (index + 1) + ' | ' + item.count + ' | ' + item.type + ' | ' + item.text.replace(/\n/g, ' ').slice(0, 500) + ' | ' + pick(item.location, '-') + ' |');
    });
  } else {
    push('本次运行没有 console error。');
  }
  push('');
  push('### pageerror');
  push('');
  if (result.console.pageErrors.length) {
    for (const item of result.console.pageErrors.slice(0, 10)) {
      push(fence);
      push(item.name + ': ' + item.message);
      if (item.stack) push(item.stack);
      push(fence);
    }
  } else {
    push('无 pageerror。');
  }
  push('');
  push('### requestfailed Top 5');
  push('');
  if (result.console.requestFailureTop.length) {
    push('| # | 次数 | URL | 失败原因 | 资源类型 |');
    push('| ---: | ---: | --- | --- | --- |');
    result.console.requestFailureTop.forEach((item, index) => {
      push('| ' + (index + 1) + ' | ' + item.count + ' | ' + item.url + ' | ' + item.failure + ' | ' + item.resourceType + ' |');
    });
  } else {
    push('无 requestfailed。');
  }
  push('');
  if (result.load.lastState) {
    push('## 最后轮询状态（超时/错误时的现场）');
    push('');
    push(fence + 'json');
    push(JSON.stringify(result.load.lastState, null, 2));
    push(fence);
    push('');
  }
  push('## 截图');
  push('');
  push('- 整页：' + bt + pick(result.shots.fullPage?.path) + bt + (result.shots.fullPage?.bytes ? '（' + result.shots.fullPage.bytes + ' bytes）' : ''));
  push('- 画布：' + bt + pick(result.shots.canvas?.path) + bt + (result.shots.canvas?.bytes ? '（' + result.shots.canvas.bytes + ' bytes）' : ''));
  push('');
  push('![boot](' + path.basename(pick(result.shots.fullPage?.path, 'boot.png')) + ')');
  push('');
  push('![boot-canvas](' + path.basename(pick(result.shots.canvas?.path, 'boot-canvas.png')) + ')');
  push('');
  push('## 原始 JSON');
  push('');
  push(fence + 'json');
  push(JSON.stringify(result, null, 2));
  push(fence);
  push('');
  return lines.join('\n');
}

main().catch((error) => {
  process.stderr.write('[shot] unhandled: ' + String(error && error.stack ? error.stack : error) + '\n');
  process.exitCode = 1;
});
