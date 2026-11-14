# 青元剑诀 · Headless Edge 验收报告

> 由 `tools/shot.mjs` 自动生成，数据来自本次真实运行。

## 结论

**PASS：启动完成并进入主界面，画面非黑（截图中心非黑像素比例 99.94%，Canvas toDataURL 采样最大 0.00%）。**

| 项 | 值 |
| --- | --- |
| 结果 | ✅ PASS |
| 时间 | 2026-11-14 16:16:26（Asia/Shanghai，ISO 2026-11-14T08:16:26.250Z） |
| URL | http://127.0.0.1:8123/index.html |
| 是否进入主界面 | 是 |
| 启动耗时 | 11114 ms |
| 总耗时 | 51958 ms |
| 截图（整页） | `/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot.png`（1370140 bytes） |
| 截图（画布） | `/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot-canvas.png`（1367651 bytes） |
| 报告 | `/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/report.md` |

## 运行环境

| 项 | 值 |
| --- | --- |
| 浏览器 | Microsoft Edge headless，channel `msedge` |
| viewport | 1440 × 900 @1x |
| 启动参数 | `--use-angle=swiftshader --enable-unsafe-swiftshader --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --use-fake-device-for-media-stream --ignore-gpu-blocklist` |
| 等待上限 | 120000 ms；启动完成后额外等待 3000 ms |
| 导航 HTTP 状态 | 200 |

## 导航

| 项 | 值 |
| --- | --- |
| 请求 URL | `http://127.0.0.1:8123/index.html` |
| 最终 URL | `http://127.0.0.1:8123/index.html` |
| 是否发生跳转 | 否 |
| 主框架导航 @415ms | `http://127.0.0.1:8123/index.html` |
| document 响应 @413ms | HTTP 200 `http://127.0.0.1:8123/index.html` |

## 启动过程时间线

| 距开始 (ms) | 进度 | 加载状态文本 | #qingyuan-loading 隐藏 | #app-stage inert | Startup state |
| ---: | ---: | --- | --- | --- | --- |
| 460 | 2% | 正在准备游戏资源… | 否 | 是 | loading |
| 1314 | 5% | 正在加载画面引擎（1 / 9） | 否 | 是 | loading |
| 2772 | 11% | 正在加载音效组件（2 / 9） | 否 | 是 | loading |
| 3026 | 62% | 正在唤醒御剑灵力… | 否 | 是 | loading |
| 4569 | 78% | 正在凝聚剑光… | 否 | 是 | loading |
| 4820 | 90% | 正在准备招式与操控… | 否 | 是 | loading |
| 10859 | 100% | 准备就绪，即将进入… | 否 | 是 | loading |
| 11114 | 100% | 准备就绪，即将进入… | 是 | 否 | ready |

## 耗时分解

| 阶段 | 距开始 (ms) | 本阶段耗时 (ms) |
| --- | ---: | ---: |
| 浏览器启动 | 278 | 278 |
| 首次导航完成 | 430 | 152 |
| 启动完成（ready） | 11114 | 10684 |
| 额外稳定等待结束 | 14114 | 3000 |
| 截图完成 | 37717 | 23603 |
| PNG 解码分析完成 | 37811 | 94 |
| 浏览器关闭 | - | 1716 |
| 总耗时 | 51958 | - |

## 页面采集值

| 项 | 值 |
| --- | --- |
| document.title | 青元剑诀 · 月照青元 |
| document.readyState | complete |
| window.innerWidth × innerHeight | 1440 × 900 |
| canvas 数量 | 3 |
| WebGL 可用 | 是（webgl2） |
| WebGL renderer | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver) |
| WebGL vendor | Google Inc. (Google) |
| window.THREE REVISION | 128 |
| window.QingyuanUnlocks | 存在 |
| #unlock-home-count | （无） |
| #unlock-summary-count | （无） |
| #qy-loading-status | 准备就绪，即将进入… |
| #qy-loading-hint | 首次进入需要加载资源，请稍候。准备完成后将自动进入。 |
| #qingyuan-loading.hidden | true |
| #app-stage[inert] | false |
| QingyuanLoading.state | ready |

### canvas 明细

| id | 类名 | 父容器 | 绘制尺寸 | 显示尺寸 | 渲染上下文 |
| --- | --- | --- | --- | --- | --- |
| (空) | (无) | canvas-container | 1440 × 900 | 1440 × 900 | webgl2 |
| webcam-frame | (无) | webcam-box | 640 × 480 | 162 × 122 | 2d |
| webcam-canvas | (无) | webcam-box | 164 × 124 | 162 × 122 | 2d |

## 画面非黑检测

### A. 页面内 canvas.toDataURL 采样（中心 50% 区域）

> 说明：主画布为 WebGL 且未开启 preserveDrawingBuffer，帧缓存清空后 toDataURL 读到的可能是全黑；webcam 的 2D canvas 在未开摄像头时也可能全黑。因此「画面非黑」以 B 段截图 PNG 解码为准。

| canvas id | 尺寸 | 采样像素数 | 非黑像素 | 非黑比例 | 亮度均值 | 结果 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| （无） | 1440 × 900 | 324000 | 0 | 0.00% | 0 | 疑似全黑 ❌ |
| webcam-frame | 640 × 480 | 76800 | 0 | 0.00% | 0 | 疑似全黑 ❌ |
| webcam-canvas | 164 × 124 | 5084 | 0 | 0.00% | 0 | 疑似全黑 ❌ |

### B. 截图 PNG 解码采样

| 截图 | 尺寸 | 全图非黑比例 | 中心 50% 非黑比例 | 全图亮度均值 |
| --- | --- | ---: | ---: | ---: |
| fullPage | 1440 × 900 | 99.88% | 99.94% | 78.728 |
| canvas | 1440 × 900 | 99.88% | 99.95% | 78.969 |

## Console / 异常

| 类型 | 数量 |
| --- | ---: |
| console 总条数 | 4 |
| console error | 0 |
| console warning | 4 |
| pageerror | 0 |
| requestfailed | 0 |

### console 错误 Top 5（按出现次数）

本次运行没有 console error。

### pageerror

无 pageerror。

### requestfailed Top 5

无 requestfailed。

## 最后轮询状态（超时/错误时的现场）

```json
{
  "at": 10703,
  "pct": 100,
  "pctText": "100%",
  "status": "准备就绪，即将进入…",
  "hint": "首次进入需要加载资源，请稍候。准备完成后将自动进入。",
  "loadingHidden": true,
  "loadingDisplay": "none",
  "loadingBusy": "false",
  "stageInert": false,
  "startupState": "ready",
  "isError": false,
  "retryVisible": false,
  "ready": true,
  "docTitle": "青元剑诀 · 月照青元"
}
```

## 截图

- 整页：`/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot.png`（1370140 bytes）
- 画布：`/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot-canvas.png`（1367651 bytes）

![boot](boot.png)

![boot-canvas](boot-canvas.png)

## 原始 JSON

```json
{
  "ok": true,
  "tool": "tools/shot.mjs",
  "startedAt": "2026-11-14T08:16:26.250Z",
  "startedAtLocal": "2026-11-14 16:16:26",
  "url": "http://127.0.0.1:8123/index.html",
  "channel": "msedge",
  "headless": true,
  "viewport": {
    "width": 1440,
    "height": 900,
    "deviceScaleFactor": 1
  },
  "launchArgs": [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--ignore-gpu-blocklist"
  ],
  "load": {
    "ready": true,
    "readyElapsedMs": 11114,
    "timedOut": false,
    "timeline": [
      {
        "elapsedMs": 460,
        "percent": 2,
        "status": "正在准备游戏资源…",
        "loadingHidden": false,
        "stageInert": true,
        "startupState": "loading",
        "isError": false
      },
      {
        "elapsedMs": 1314,
        "percent": 5,
        "status": "正在加载画面引擎（1 / 9）",
        "loadingHidden": false,
        "stageInert": true,
        "startupState": "loading",
        "isError": false
      },
      {
        "elapsedMs": 2772,
        "percent": 11,
        "status": "正在加载音效组件（2 / 9）",
        "loadingHidden": false,
        "stageInert": true,
        "startupState": "loading",
        "isError": false
      },
      {
        "elapsedMs": 3026,
        "percent": 62,
        "status": "正在唤醒御剑灵力…",
        "loadingHidden": false,
        "stageInert": true,
        "startupState": "loading",
        "isError": false
      },
      {
        "elapsedMs": 4569,
        "percent": 78,
        "status": "正在凝聚剑光…",
        "loadingHidden": false,
        "stageInert": true,
        "startupState": "loading",
        "isError": false
      },
      {
        "elapsedMs": 4820,
        "percent": 90,
        "status": "正在准备招式与操控…",
        "loadingHidden": false,
        "stageInert": true,
        "startupState": "loading",
        "isError": false
      },
      {
        "elapsedMs": 10859,
        "percent": 100,
        "status": "准备就绪，即将进入…",
        "loadingHidden": false,
        "stageInert": true,
        "startupState": "loading",
        "isError": false
      },
      {
        "elapsedMs": 11114,
        "percent": 100,
        "status": "准备就绪，即将进入…",
        "loadingHidden": true,
        "stageInert": false,
        "startupState": "ready",
        "isError": false
      }
    ],
    "lastState": {
      "at": 10703,
      "pct": 100,
      "pctText": "100%",
      "status": "准备就绪，即将进入…",
      "hint": "首次进入需要加载资源，请稍候。准备完成后将自动进入。",
      "loadingHidden": true,
      "loadingDisplay": "none",
      "loadingBusy": "false",
      "stageInert": false,
      "startupState": "ready",
      "isError": false,
      "retryVisible": false,
      "ready": true,
      "docTitle": "青元剑诀 · 月照青元"
    },
    "errorState": false,
    "navError": null,
    "navStatus": 200,
    "requestedUrl": "http://127.0.0.1:8123/index.html",
    "finalUrl": "http://127.0.0.1:8123/index.html",
    "redirected": false,
    "navigations": [
      {
        "at": 415,
        "url": "http://127.0.0.1:8123/index.html"
      }
    ],
    "documents": [
      {
        "at": 413,
        "url": "http://127.0.0.1:8123/index.html",
        "status": 200
      }
    ]
  },
  "shots": {
    "fullPage": {
      "path": "/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot.png",
      "bytes": 1370140
    },
    "canvas": {
      "path": "/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot-canvas.png",
      "bytes": 1367651,
      "mode": "element"
    },
    "errors": []
  },
  "page": {
    "title": "青元剑诀 · 月照青元",
    "url": "http://127.0.0.1:8123/index.html",
    "readyState": "complete",
    "htmlClasses": "",
    "bodyClasses": "",
    "viewport": {
      "innerWidth": 1440,
      "innerHeight": 900,
      "dpr": 1
    },
    "loadingStatusText": "准备就绪，即将进入…",
    "loadingHintText": "首次进入需要加载资源，请稍候。准备完成后将自动进入。",
    "loadingHidden": true,
    "stageInert": false,
    "qingyuanLoadingState": "ready",
    "unlockHomeCount": "",
    "unlockSummaryCount": "",
    "hasQingyuanUnlocks": true,
    "hasQingyuanToyBridge": true,
    "threeRevision": "128",
    "hasThree": true,
    "canvasCount": 3,
    "canvases": [
      {
        "id": "",
        "className": "",
        "parentId": "canvas-container",
        "width": 1440,
        "height": 900,
        "clientWidth": 1440,
        "clientHeight": 900,
        "rect": {
          "x": 0,
          "y": 0,
          "width": 1440,
          "height": 900
        },
        "contextType": "webgl2"
      },
      {
        "id": "webcam-frame",
        "className": "",
        "parentId": "webcam-box",
        "width": 640,
        "height": 480,
        "clientWidth": 162,
        "clientHeight": 122,
        "rect": {
          "x": 1255,
          "y": 23,
          "width": 162,
          "height": 122
        },
        "contextType": "2d"
      },
      {
        "id": "webcam-canvas",
        "className": "",
        "parentId": "webcam-box",
        "width": 164,
        "height": 124,
        "clientWidth": 162,
        "clientHeight": 122,
        "rect": {
          "x": 1255,
          "y": 23,
          "width": 162,
          "height": 122
        },
        "contextType": "2d"
      }
    ],
    "webgl": {
      "supported": true,
      "context": "webgl2",
      "renderer": "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)",
      "vendor": "Google Inc. (Google)",
      "error": null
    },
    "canvasContainer": {
      "clientWidth": 1440,
      "clientHeight": 900,
      "rect": {
        "x": 0,
        "y": 0,
        "width": 1440,
        "height": 900
      },
      "childCount": 1,
      "html": "<canvas width=\"1440\" height=\"900\" style=\"display: block; width: 1440px; height: 900px;\"></canvas>"
    }
  },
  "pixel": {
    "canvasToDataURL": [
      {
        "id": "",
        "width": 1440,
        "height": 900,
        "method": "toDataURL",
        "ok": true,
        "dataUrlBytes": 38334,
        "sample": {
          "x": 360,
          "y": 225,
          "width": 720,
          "height": 450,
          "total": 324000
        },
        "nonBlack": 0,
        "nonBlackRatio": 0,
        "brightRatio": 0,
        "avgLuma": 0
      },
      {
        "id": "webcam-frame",
        "width": 640,
        "height": 480,
        "method": "toDataURL",
        "ok": true,
        "dataUrlBytes": 10642,
        "sample": {
          "x": 160,
          "y": 120,
          "width": 320,
          "height": 240,
          "total": 76800
        },
        "nonBlack": 0,
        "nonBlackRatio": 0,
        "brightRatio": 0,
        "avgLuma": 0
      },
      {
        "id": "webcam-canvas",
        "width": 164,
        "height": 124,
        "method": "toDataURL",
        "ok": true,
        "dataUrlBytes": 1282,
        "sample": {
          "x": 41,
          "y": 31,
          "width": 82,
          "height": 62,
          "total": 5084
        },
        "nonBlack": 0,
        "nonBlackRatio": 0,
        "brightRatio": 0,
        "avgLuma": 0
      }
    ],
    "screenshots": {
      "fullPage": {
        "path": "/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot.png",
        "bytes": 1370140,
        "width": 1440,
        "height": 900,
        "full": {
          "region": {
            "x0": 0,
            "y0": 0,
            "x1": 1,
            "y1": 1
          },
          "width": 1440,
          "height": 900,
          "total": 1296000,
          "nonBlack": 1294407,
          "nonBlackRatio": 0.998771,
          "brightRatio": 0.798981,
          "avgLuma": 78.728
        },
        "center": {
          "region": {
            "x0": 0.25,
            "y0": 0.25,
            "x1": 0.75,
            "y1": 0.75
          },
          "width": 720,
          "height": 450,
          "total": 324000,
          "nonBlack": 323798,
          "nonBlackRatio": 0.999377,
          "brightRatio": 0.967096,
          "avgLuma": 91.965
        }
      },
      "canvas": {
        "path": "/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot-canvas.png",
        "bytes": 1367651,
        "width": 1440,
        "height": 900,
        "full": {
          "region": {
            "x0": 0,
            "y0": 0,
            "x1": 1,
            "y1": 1
          },
          "width": 1440,
          "height": 900,
          "total": 1296000,
          "nonBlack": 1294477,
          "nonBlackRatio": 0.998825,
          "brightRatio": 0.808267,
          "avgLuma": 78.969
        },
        "center": {
          "region": {
            "x0": 0.25,
            "y0": 0.25,
            "x1": 0.75,
            "y1": 0.75
          },
          "width": 720,
          "height": 450,
          "total": 324000,
          "nonBlack": 323827,
          "nonBlackRatio": 0.999466,
          "brightRatio": 0.97109,
          "avgLuma": 91.876
        }
      }
    }
  },
  "console": {
    "total": 4,
    "errorCount": 0,
    "warningCount": 4,
    "errors": [],
    "errorTop": [],
    "pageErrors": [],
    "requestFailures": [],
    "requestFailureTop": []
  },
  "conclusion": "PASS：启动完成并进入主界面，画面非黑（截图中心非黑像素比例 99.94%，Canvas toDataURL 采样最大 0.00%）。",
  "durationMs": 51958,
  "reportPath": "/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/report.md",
  "timings": {
    "launchMs": 278,
    "navMs": 430,
    "readyMs": 11114,
    "postWaitMs": 14114,
    "screenshotsMs": 23603,
    "pixelAnalysisMs": 94,
    "closeMs": 1716
  },
  "shotPaths": {
    "fullPage": "/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot.png",
    "canvas": "/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan/shots/boot-canvas.png"
  }
}
```
