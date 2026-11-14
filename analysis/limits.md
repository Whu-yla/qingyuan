# 青元剑诀 · 限制点审计（limits.md）

> 审计对象：本机镜像 `/Users/victorhugo/Documents/deepseek-harness/default-workspace/qingyuan`（原版平台「青元剑诀」御剑模拟器）。
> 审计口径：只读源码，不修改除本文件外的任何文件；未触碰 127.0.0.1:8123 静态服务器。

## 0. 审计快照与行号基准（务必先读）

| 项 | 值 |
|---|---|
| 审计时间 | 2026-11-14 15:07 CST |
| 基线 commit | `86b9b3c`（baseline: original mirror） |
| 工作区状态 | 4 个文件已被并行修改（非本次审计所为）：`index.html`、`assets/js/qingyuan-unlock-core.js`、`qingyuan-unlock-ui.js`、`qingyuan-toy-bridge.js`；diffstat 合计 +24 / −33 行 |
| 行号基准 | **被修改的 4 个文件：行号 = 基线 `86b9b3c` 版本**（文内标注「基线」）；其余文件（`app.js`、`style.css`、`qingyuan-loading.js`、`qingyuan-private-unlock.js`、`qingyuan-invitation.js`、`qingyuan-author-promo.js`）未改，行号 = 现行工作区 |
| 复现基线行 | `git -C qingyuan show 86b9b3c:<path> ` + `sed -n '<起>,<止>p'` |
| 复现现行行 | `sed -n '<起>,<止>p' <path>` |

**为什么两种基准混用**：负责「取消限制」的实现 agent 正在同一工作区改这 4 个文件，行号在审计过程中发生位移（`index.html` 68040B → 67174B）。要 1:1 对照原版限制，必须以基线行号为准；本文件对每条同时标注「现状：已移除 / 已改 / 仍在」，避免把已拆掉的门禁当成待办。

**0.2 最终复核（15:12 CST，`sed`/`grep` 实测）**：`window.location.replace` 与 `platform-toy-sdk` 在现行 `index.html` 中**已无任何命中**（A1 跳转段、A2 SDK 已整段删除，非仅注释）；`#unlock-menu-open` 已整块删除；`#unlock-home-open`(#645)、`#invite-home-open`(#646)、`.author-promo-entry`(#647) 为 `style="display:none"`；`hand-model-resource`(#534) 的 href 已由实现者改成 `./assets/hand/hand_landmarker.bin`（H8 的 HTML 侧已修，`app.js` 侧 `HAND_ASSET_PATHS` 仍写 `.task`）；`#author-ai-open` 仍在 #648（随 #647 容器一起隐藏）。`app.js` 关键行号（346/574/578/4198/4224/4236/5074/5121/5247/5333/6329/6462/6549-6555）实测全部与文中一致。

### 0.1 总根因（一句话）

原版是**任务换解锁**的经济系统：`qingyuan-unlock-core.js` 用 5 个任务（邀请好友 / 关注作者 / 看 5 秒推广 / 给视频三连 / 给任意 2 条视频三连）产出 10 项功能（`inspect/dageng/giant/lotus/lightning/dragon/qi/split/hand/fx`），`qingyuan-unlock-ui.js` 的 `applyLocks()` 给 DOM 加 `.is-feature-locked` 并在 capture 阶段吞掉点击，`app.js` 在 10 处 `unlocks.has/require` 执行硬门禁，解锁进度只存 原平台云存储，且私测密码 `2464054180` 可一次全开。**只要把 `privateUnlocked` 置真（或让 `has()` 恒真）即可一次性废掉全部 10 项门禁**——现有补丁正是这么做的，但残留死代码与 3 个无效脚本，且画质、手势、音效、启动等**非解锁型限制完全没动**。

---

## 1. TL;DR 表（限制项 | 文件:行号 | 现象 | 建议改法 | 风险）

风险口径：🔴 直接阻断进入/游玩 | 🟡 削弱体验或限制能力 | 🟢 仅代码整洁/死代码。

| # | 限制项 | 文件:行号 | 现象 | 建议改法 | 风险 |
|---|---|---|---|---|---|
| 1 | 非 iframe 强制跳回 原平台 | `index.html:224`（基线） | 本地 top-level 打开立即 replace 到 原站域名，游戏进不去 | 删除整段 `window.self===window.top` 跳转 | 🔴（已移除） |
| 2 | 原版平台 SDK 硬依赖 | `index.html:538`（基线） | 加载 `toy-sdk.js`；摄像头/云存档/邀请卡/平台能力全挂它 | 删 SDK script；改用浏览器 `getUserMedia`（toy-bridge 已加 STANDALONE） | 🔴（已移除） |
| 3 | 解锁任务主入口 | `index.html:645`（基线） | 主界面常驻「🔒 解锁任务 · 更多剑诀 0/5」 | 删按钮 + `#unlock-home-count`，改由招式栏直接开关 | 🟡（已隐藏） |
| 4 | 解锁菜单入口 | `index.html:613`（基线） | 界面管理里「解锁任务 · 更多剑诀」 | 同上 | 🟡（已隐藏） |
| 5 | 邀请好友入口 | `index.html:646`（基线） | 「✦ 邀请好友来御剑 / 授权生成邀请卡」 | 删；`inspect`（赏剑）直接默认可用 | 🟡（已隐藏） |
| 6 | 作者推广入口 + 5 秒倒计时 | `index.html:647-648, 760-783, 830`（基线） | 「作者同款游戏点击立即制作！」+ 关不掉的 5 秒广告计时 | 删 DOM + 删 author-promo 脚本 + 删 render 倒计时产物 | 🟡（入口已隐藏，脚本仍在） |
| 7 | 私测密码门 | `index.html:818-823`（基线）+ `qingyuan-private-unlock.js:11` | 密码 `2464054180` 一次全开 10 项；关页面即失效（pagehide 清除） | 删表单 DOM；或改 `privateUnlocked` 默认 true 并删密码脚本 | 🟡（表单已删，脚本空转） |
| 8 | 10 项功能总闸 | `qingyuan-unlock-core.js:81,83`（基线） | `privateUnlocked=false`，`isUnlocked()` 只认 `unlocked` Set | `let privateUnlocked=true`（现状已改）或 `isUnlocked→return known.has(id)` | 🔴（已改） |
| 9 | DOM 点击锁 | `qingyuan-unlock-ui.js:77-79, 250-252`（基线） | `.is-feature-locked` 虚框 + 🔒 + capture 拦截点击并弹任务面板 | 删锁定分支与 capture 监听（或 `has()` 恒真后自然失效） | 🔴（已失效，代码仍在） |
| 10 | app.js 硬门禁 | `app.js:4198,4224,4253,4276,4291,4324,5121,6329,6549-6555` | 未解锁直接 return / 强制关闭已开功能 | 删 `has/require` 判断（现依赖 `has()` 恒真，属隐式通过） | 🔴 |
| 11 | 神雷化形前置 | `app.js:4200-4203, 4226` | 未开【辟邪神雷】不能切【神雷化形】+ toast | 保留（招式语义）或改为自动开雷 | 🟡 |
| 12 | 关雷强制退形态 | `app.js:4308-4321` | 关辟邪神雷立即踢回 DRAGON 并给招式按钮加 `disabled-skill` | 保留（不然雷龙无雷可吐） | 🟢 |
| 13 | 灵力调节面板默认收起 | `app.js:4236` + `index.html:577` | `fxPanel.open=false`，details 无 open 属性 | 改 `open=true` 或删 `open=false` | 🟡 |
| 14 | 音效每次进入静音 | `app.js:346,350-355` + `index.html:586,617` | `enabled=false`，只恢复音量，注释明说「每次打开都保持静音」 | 默认 `enabled=true`（需首次用户手势 resume AudioContext） | 🟡 |
| 15 | 手机默认藏三窗 | `app.js:6445-6447` | mobile-layout 下 camera/quality/fx 三窗强制隐藏 | 改为不自动隐藏或记住上次状态 | 🟡 |
| 16 | 视角俯仰 clamp | `app.js:4377,4403-4404,6316` | pitch 限 ±(π/2−0.06)；赏剑 ±1.53 rad | 保留（防穿地/翻转） | 🟢 |
| 17 | 缩放/相机距离 clamp | `app.js:4517-4518,5486` | 缩放 0.85–1800、赏剑半径 1.4–18 | 保留 | 🟢 |
| 18 | 飞行边界 clamp | `app.js:4626,4656` | X ±1250、Y −190..470、Z −1750..760 | 保留（防飞出场景） | 🟢 |
| 19 | 画质与像素比上限 | `app.js:574,648-653` | 像素比 ≤1.35(手机)/1.8；全屏再压到 0.95/1.10 | 允许 2.0 档 / 加自定义画质 | 🟡 |
| 20 | 移动端关阴影 | `app.js:578,673` | `shadowMap.enabled=!isMobile`，月光不投影 | 改按设备性能判定而非 isMobile | 🟡 |
| 21 | 全屏限帧 30/45fps | `app.js:5333-5337` | 全屏沉浸时 `minFrameInterval` 节流 | 删除或仅低端机启用 | 🟡 |
| 22 | 摄像头 640×480@30 | `app.js:4809-4813` | ideal 分辨率与帧率上限写死 | 提到 1280×720@60（识别输入仍可降采样） | 🟡 |
| 23 | 单手上限 | `app.js:5065` | `numHands:1`，第二只手不被识别 | 改 2（同步手势逻辑取主手） | 🟡 |
| 24 | 移动端强制 CPU 推理 | `app.js:5074` | `isMobile?['CPU']:['GPU','CPU']` | 先试 GPU，失败再降 CPU（已有 recoverHandInference） | 🟡 |
| 25 | 识别节流 12.5–30fps | `app.js:5247` | CPU 50/80ms、GPU 33/55ms 才 detect 一次 | 降到 GPU 16ms | 🟡 |
| 26 | 手势 6 帧多数投票 | `app.js:5266-5276` | 连续 6 帧里 ≥3 票才切换招式 | 保留（防误切）或降到 2 票 | 🟢 |
| 27 | 手部坐标 1.55× 放大 + clamp | `app.js:5292-5293` | 手部活动区被放大并夹到 0..1 | 保留（灵敏度映射） | 🟢 |
| 28 | 资源完整性校验 | `app.js:4979-4983,5002-5006` | 字节数/SHA-256 不符即抛错，无 `crypto.subtle` 直接失败 | 本地镜像可保留；离线时跳过校验或仅告警 | 🟡 |
| 29 | .task 模型缺失 | `index.html:534` + `app.js:4972` | 声明 `hand_landmarker.task` 但目录只有 `.bin` | 已靠候选回退到 `.bin`；建议显式改路径并同步完整性表 | 🟡 |
| 30 | 启动失败即卡死 | `qingyuan-loading.js:10,42,95-98,114-126` | 任一 `data-startup` 资源失败/60s 超时 → 错误页+输入拦截 | 改为「核心失败才阻塞，组件失败可跳过」 | 🔴（仍在） |
| 31 | 启动期吞掉全部输入 | `qingyuan-loading.js:11,18-23` | ready 前 capture 拦截 13 类事件并 preventDefault | 保留但别拦 F5/F12 | 🟢 |
| 32 | 邀请卡 SDK 依赖 | `qingyuan-invitation.js:37-49,150-189` | 无 `window.toy` 等 7s 后失败，提示「请在 原版平台 页面打开」 | 本地版删邀请组件与入口 | 🟡 |
| 33 | 解锁进度只存云 | `qingyuan-unlock-core.js:141-143,240` | `getCloudStorage/setCloudStorage`，无 SDK 不保存 | 改 localStorage（`qy_ul_v1_` 前缀现成） | 🟡 |
| 34 | 30s/60s 刷新节流 | `qingyuan-unlock-core.js:156,260` | 手动刷新 30s 内无效；claim 前 60s 才强刷 | 移除（已全解锁则无意义） | 🟢 |
| 35 | 5 秒广告任务 | `qingyuan-unlock-core.js:264-276` | 必须保持弹窗可见累计 5000ms 才 `localAd=true` | 整段删除（配合删 author-promo） | 🟡 |
| 36 | 会话级回收 | `unlock-core:15,286-292` + `unlock-ui:278` + `private-unlock:107-109` | pagehide 时 `resetAdSession`+`privateLock`，雷龙/私测每次进入作废 | 删 pagehide 清理，持久化到 localStorage | 🟡 |
| 37 | 禁止页面缩放 | `index.html:226` | `maximum-scale=1.0, user-scalable=no` | 改 `maximum-scale=5.0, user-scalable=yes` | 🟡 |
| 38 | 音效 32 声道上限 | `app.js:437` | `voices.size>=32` 直接丢弃新音 | 提到 64 或按类型分池 | 🟢 |
| 39 | 手机才弹摄像头预览 | `app.js:5105` | 桌面开手势无预览窗，找不到画面确认 | 无条件 `setUiWindowVisible('camera-window',true)` | 🟡 |
| 40 | 摄像头预览尺寸 100–400% | `index.html:581` | 预览框最大 4× | 放宽到 600% | 🟢 |

> 表中 40 条为高频/高影响项；**完整清单 124 条**见第 2 节，每条含原始代码、语义、判定、现状、补丁与 HTML/CSS 联动。

---

## 2. 完整清单（按任务 a–h 对应分类）

判定标签：**【营销/解锁型 → 应彻底移除】**、**【核心玩法参数 → 保留】**、**【平台/启动/性能约束 → 按需放宽】**。
每条格式：位置 → 原始代码 → 语义 → 判定 → 现状 → 最小补丁（是否需改 HTML/CSS）。

### A. 解锁/营销门禁（对应任务 a；全部应彻底移除）

#### A1 `index.html:224`（基线）非 iframe 强制跳回 原平台
~~~html
<script>if(window.self===window.top){window.location.replace("原站发布页");}</script>
~~~
语义：防盗链 + 引流门禁；本地双击打开（top-level）必被 replace，游戏根本进不去。
判定：**【营销型 → 彻底移除】**。现状：**已移除**（现行 L224 为「本地复刻：移除…」注释）。
补丁：无（已做）；建议连注释一起删，避免读者误以为还有跳转。HTML：否。

#### A2 `index.html:538`（基线）加载 原版平台 SDK
~~~html
<script id="platform-toy-sdk" async src="https://原站CDN/bfs/seed/toy/app/sdk/toy-sdk.js"></script>
~~~
语义：整条平台能力链（`window.toy`：摄像头、云存储、关注/三连核验、导航、二维码、分享）入口；离线/CDN 失败时大量功能降级。
判定：**【平台依赖 → 移除】**。现状：**已移除**（现行 L538 为注释「本地复刻：不加载 原版平台 SDK…」）。
补丁：无（已做）。**联动**：`qingyuan-invitation.js:37-49` 的 `waitForSdk` 现在找不到脚本元素，7 秒后必然 reject → 邀请卡实际已死；`qingyuan-loading.js` 的 sources 只收 `script[data-startup][src]`，SDK 本来就不阻塞启动。HTML/CSS：否。

#### A3 `index.html:645`（基线）解锁任务主入口常驻主界面
~~~html
<button id="unlock-home-open" class="unlock-home-button" type="button" aria-haspopup="dialog" aria-controls="unlock-panel" aria-expanded="false"><span>🔒 解锁任务 · 更多剑诀</span><span id="unlock-home-count">0/5</span></button>
~~~
语义：把「5 个任务 / 0 完成」直接摆在主界面，最主要的营销入口。
判定：**【营销型 → 彻底移除】**。现状：**已隐藏**（现行 L645 加 `style="display:none"`，`#unlock-home-count` 仍在）。
补丁：直接删按钮 DOM（现行 patch 只隐藏，`unlock-ui.js:198-205` 仍会写 `0/5` 文案）。HTML：是；CSS：删 `.unlock-home-button`（`style.css:904-910`）。

#### A4 `index.html:613`（基线）界面管理里的解锁入口
~~~html
<button id="unlock-menu-open" type="button">解锁任务 · 更多剑诀</button>
~~~
语义：第二处入口（窗口管理器帮助行）。判定：**【营销型 → 移除】**。现状：**已隐藏**。
补丁：删 DOM（现行 patch 只加 `style="display:none"`）。HTML：是。

#### A5 `index.html:646`（基线）邀请好友入口
~~~html
<button id="invite-home-open" class="unlock-home-button invite-home-button" type="button" aria-haspopup="dialog" aria-controls="invite-panel" aria-expanded="false"><span>✦ 邀请好友来御剑</span><small>授权生成邀请卡 ↗</small></button>
~~~
语义：`inspect`（赏剑）任务的前置门，也是拉新入口。判定：**【营销型 → 移除】**。现状：**已隐藏**。
补丁：删 DOM + 删 `qingyuan-invitation.js` 引用（基线 L896）。HTML：是。

#### A6 `index.html:647-648, 830`（基线）作者推广入口（5 秒广告前置）
~~~html
<div class="author-promo-entry">
  <button id="author-ai-open" class="author-promo-button" type="button" aria-haspopup="dialog" aria-controls="author-ai-card" aria-expanded="false">✦ 作者同款游戏点击立即制作！</button>
~~~
语义：点它打开作者站点浮层，同时 `qingyuan-author-promo.js:85`（该模块已随去品牌化删除）调 `QingyuanUnlocks.recordAdClick()` 启动 5 秒倒计时，是 `lightning/dragon` 的唯一正路。
判定：**【营销型 → 彻底移除】**。现状：**已删除**（入口 DOM、overlay、二维码图片与脚本全部移除）。
补丁：删按钮与 `#author-ai-overlay`（基线 L760-783）+ 删 L830 脚本行 + `unlock-ui.js:91-122` 的 `ad` 分支。HTML/CSS：是（`.author-promo-*` 样式）。

#### A7 `index.html:818-823`（基线）私测密码表单
~~~html
<button id="private-unlock-trigger" class="private-unlock-trigger" type="button" aria-label="私测解锁" aria-expanded="false">·</button>
<input id="private-unlock-input" class="private-unlock-input" type="password" inputmode="numeric" enterkeyhint="done" autocomplete="off" spellcheck="false" />
<button id="private-unlock-submit" ...>解锁</button>
<p id="private-unlock-status" class="private-unlock-status" role="status" aria-live="polite" hidden></p>
~~~
语义：隐藏后门，密码 `2464054180`（`private-unlock.js:11`）一次开全部 10 项；但 `pagehide` 会 `privateLock()` 清除，只本次进入有效。
判定：**【解锁型 → 彻底移除】**。现状：**DOM 已全删**；`private-unlock.js` 仍在（基线 L895 / 现行 L887），因 `private-unlock.js:4-10` 的空值守卫 `if(!trigger||!form||!input||!button||!status||!unlocks)return;` 而静默退出 → 死代码。
补丁：删 L887 脚本行与 `assets/js/qingyuan-private-unlock.js`。HTML：是。

#### A8 `index.html:702-723`（基线）解锁任务面板
~~~html
<div id="unlock-overlay" class="unlock-overlay" hidden>
  <section id="unlock-panel" ...>
    <div id="unlock-task-list" class="unlock-task-list"></div>
    <div id="unlock-videos" class="unlock-videos" hidden>…
~~~
语义：任务列表/视频列表容器，由 `unlock-ui.js` 渲染 5 行任务（含「去完成/解锁」按钮）。
判定：**【营销型 → 移除】**。现状：**仍在**（入口已隐藏，DOM 与脚本仍在）。
补丁：整块删除；`unlock-ui.js` 若保留则只留空壳（`window.QingyuanUnlocks` 是 app.js 依赖，见 A44 说明）。HTML/CSS：是（`style.css:918-960` 解锁面板样式）。

#### A9 `index.html:760-783`（基线）作者推广浮层（含倒计时文案）
~~~html
<div id="author-ai-overlay" class="author-ai-overlay" hidden>
  … <p id="author-ai-countdown">点击推广入口后等待 5 秒，解锁辟邪神雷与神雷化形，本次进入有效。</p>
~~~
语义：营销浮层；文案直接说明「本次进入有效」= 会话级解锁。判定：**【营销型 → 移除】**。现状：**仍在**。
补丁：删整块 + 删 `qingyuan-author-promo.js`。HTML/CSS：是。

#### A10 `index.html:725-758`（基线）邀请浮层
语义：邀请卡生成/保存/分享 UI。判定：**【营销型 → 移除】**。现状：**仍在**（入口已隐藏）。
补丁：删整块 + 删 `qingyuan-invitation.js` 引用。HTML/CSS：是。

#### A11 `index.html:815`（基线）说明面板里的「解锁任务」文案
~~~html
<section id="guide-unlocks"><h3>解锁任务与功能开关</h3><p>完成邀请好友、关注作者、给视频一键三连等任务，解锁赏剑、大庚剑阵、巨剑术…</p></section>
~~~
语义：把「要完成任务才能用」写进新手引导。判定：**【营销型 → 移除】**。现状：**已改写**（现行 L815 改为「本页为完整解锁版…不需要邀请好友、关注作者、给视频三连，也不需要等待推广倒计时」）。
补丁：无（已做）；建议保留该段作为本地版说明。HTML：是（已改）。

#### A12 `qingyuan-unlock-core.js:5-9`（基线）5 个任务 = 10 项功能
~~~js
{ id:'inspect', task:'成功邀请 1 名好友', reward:'赏剑', features:['inspect'], kind:'invite', target:1 },
{ id:'dageng',  task:'关注原作者', reward:'大庚剑阵、巨剑术、莲花剑阵', features:['dageng','giant','lotus'], kind:'follow', target:1 },
{ id:'dragon',  task:'点击「作者同款游戏点击立即制作！」并等待 5 秒', reward:'辟邪神雷、神雷化形', features:['lightning','dragon'], kind:'ad', target:5 },
{ id:'qi',      task:'给 BV1d44q6YEGK 视频一键三连', reward:'流云剑气、剑影分光', features:['qi','split'], kind:'featuredTriple', bvid:'BV1d44q6YEGK', target:1 },
{ id:'hand',    task:'给任意 2 条任务视频一键三连', reward:'手势控制、灵力调节', features:['hand','fx'], kind:'triples', target:2 }
~~~
语义：整套解锁经济系统的定义表。判定：**【营销/解锁型 → 移出主流程】**（可保留为「成就/彩蛋」但不产生功能门禁）。现状：仍在（但 `privateUnlocked=true` 使其形同虚设）。
补丁：若保留文件，把 `definitions` 清空或改纯展示；若追求干净，删 `qingyuan-unlock-core.js` 并给 app.js 提供 10 行 stub（`has:()=>true, require:()=>true, subscribe(){}, snapshot(){…}`）。HTML：需删 L885 脚本行。

#### A13 `qingyuan-unlock-core.js:15`（基线）会话级白名单
~~~js
const sessionOnly = new Set(['lightning','dragon']);
~~~
语义：辟邪神雷/神雷化形**不写云存档**，每次进入都要重看 5 秒广告。判定：**【解锁型 → 移除】**。现状：仍在（解锁已被 `privateUnlocked` 短路）。
补丁：`const sessionOnly = new Set();`。无需 HTML/CSS。

#### A14 `qingyuan-unlock-core.js:16`（基线）云存档键
~~~js
const storageKey = id => 'qy_ul_v1_' + id;
~~~
语义：云存储 key 前缀。判定：**【平台依赖】**。现状：仍在。
补丁：改造成 localStorage 键，或随 A33 一起删。无需 HTML/CSS。

#### A15 `qingyuan-unlock-core.js:75`（基线）默认状态文案
~~~js
let lastChecked = 0, status = '完成任务后，回来点“刷新进度”，再解锁对应内容。';
~~~
语义：解锁面板默认横幅文案。判定：**【营销型 → 移除】**。现状：**已改**为「全部剑诀已解锁，可直接开启任意招式。」。
补丁：无（已做）。

#### A16 `qingyuan-unlock-core.js:81,83`（基线）总闸 `privateUnlocked` 与 `isUnlocked`
~~~js
let privateUnlocked = false;
function isUnlocked(id) { return known.has(id) && (privateUnlocked || unlocked.has(id)); }
~~~
语义：10 项功能的唯一总开关；`unlock-ui` 的 `has()` 最终落到这里。判定：**【解锁型 → 移除】**。现状：**已改** `let privateUnlocked=true`。
补丁（更彻底）：`function isUnlocked(id){ return known.has(id); }` 并删 `privateUnlock/privateLock` API；这样即使有人把 `privateUnlocked` 改回 false 也不会再锁。无需 HTML/CSS。

#### A17 `qingyuan-unlock-core.js:89`（基线）广告进度上限只有 4 秒
~~~js
if (kind === 'ad') return localAd ? 5 : Math.min(4,Math.floor(adElapsed/1000));
~~~
语义：进度条最多显示 4/5，第 5 秒必须真的看满（**故意让进度看起来差一秒**）。判定：**【营销型 → 移除】**。现状：仍在（死代码）。
补丁：删 valueFor 的 ad 分支（或随 A24 一起删）。无需 HTML/CSS。

#### A18 `qingyuan-unlock-core.js:104-108`（基线）任务可用性/资格判定
~~~js
function available(item){ if(item.kind==='ad') return localAd===false&&!isTaskUnlocked(item.id); … if(item.kind==='invite') return Boolean(options.invite); return refs.length>0; }
function eligible(item){ … if (item.kind === 'follow') return Boolean(caps.followKnown) && valueFor… }
~~~
语义：决定「去完成」按钮是否可点；`invite` 需注入 invite 适配器，其它需 54 条视频配置存在。判定：**【解锁型 → 移除】**。现状：仍在（死代码）。
补丁：整段删（含 `eligible`）。无需 HTML/CSS。

#### A19 `qingyuan-unlock-core.js:124-135`（基线）初始化时枚举 SDK 能力
~~~js
const getSdk = options.getSdk || (() => window.toy);
if (!candidate || typeof candidate.isSupport !== 'function') return false;
const names = ['getAuthorRelation','getVideoUserActions','getCloudStorage','setCloudStorage','navigate'];
~~~
语义：无 `window.toy` 或任一能力不支持 → 解锁系统不初始化，面板显示「请在 原版平台 中打开并登录」。判定：**【平台依赖 → 移除】**。现状：仍在（`initialize()` 返回 false 后 `refresh` 会打「请在 原版平台 中打开…」文案，但入口已隐藏，玩家看不到）。
补丁：删 initialize/refresh 的 SDK 分支，直接 `status='全部已解锁'`。无需 HTML/CSS。

#### A20 `qingyuan-unlock-core.js:138-148`（基线）云存档恢复 + localAd 二次解锁
~~~js
const persisted = [...known].filter(id => !sessionOnly.has(id));
const stored = await api.getCloudStorage(persisted.map(storageKey));
for (const id of persisted) if (stored?.[storageKey(id)] === '1') {unlocked.add(id);synced.add(id);}
… if (localAd) taskFor('dragon').features.forEach(id=>unlocked.add(id));
~~~
语义：解锁状态只从 原平台云存储恢复；`sessionOnly` 的雷龙要靠本次广告重解。判定：**【平台依赖 + 会话级】**。现状：仍在（死代码）。
补丁：改为 `localStorage.getItem('qy_unlocked_v1')`，或全解锁后整段删。无需 HTML/CSS。

#### A21 `qingyuan-unlock-core.js:156`（基线）刷新 30 秒节流
~~~js
if (!force && lastChecked && Date.now() - lastChecked < 30000) return snapshot();
~~~
语义：手动「刷新进度」30 秒内无效（防刷 + 逼用户去做任务）。判定：**【解锁型 → 移除】**。现状：仍在。补丁：删该行。无需 HTML/CSS。

#### A22 `qingyuan-unlock-core.js:233-241`（基线）解锁必须写云存储
~~~js
if (!caps.setCloudStorage || !api) { status='请在 原版平台 中登录后保存解锁进度。'; … return false; }
… await api.setCloudStorage(Object.fromEntries(item.features.map(feature=>[storageKey(feature),'1'])));
~~~
语义：没登录/SDK 就不能保存解锁 = 任务白做。判定：**【平台依赖 → 移除】**。现状：仍在（死代码）。
补丁：写 localStorage 并返回 true。无需 HTML/CSS。

#### A23 `qingyuan-unlock-core.js:252-263`（基线）领取解锁的硬校验
~~~js
async function claim(id) {
  … if (item.kind === 'ad') { if (!localAd) {status='请点击推广入口并等待 5 秒倒计时结束。'; … return false;} return save(item.id); }
  if (!lastChecked || Date.now()-lastChecked > 60000) await refresh(true);
  if (!eligible(item)) { status = '尚未达到任务要求，请完成后刷新进度。'; … return false; }
  return save(item.id);
}
~~~
语义：广告必须满 5 秒、关注/邀请/三连必须核验通过、过期要重刷。判定：**【解锁型 → 彻底移除】**。现状：**已改**为 `item.features.forEach(f=>unlocked.add(f))` 直接解锁（无校验）。
补丁：无（已做）；建议整函数删除（全解锁后无调用方）。无需 HTML/CSS。

#### A24 `qingyuan-unlock-core.js:264-276`（基线）5 秒广告倒计时
~~~js
function recordAdClick() {
  if (isTaskUnlocked('dragon') || localAd || adTimer!==null) return;
  adTimer=setInterval(()=>{ … if (options.isAdVisible?.() !== false) adElapsed+=Math.max(0,tick-adLastTick);
    if (adElapsed>=5000) { clearInterval(adTimer); … localAd=true; taskFor('dragon').features.forEach(id=>unlocked.add(id)); …
~~~
语义：必须让推广浮层保持可见累计 5 秒；切后台/关浮层不计时。判定：**【营销型 → 彻底移除】**。现状：仍在（入口隐藏后无人调用）。
补丁：删整个函数与 `author-promo.js:85` 的调用。无需 HTML/CSS。

#### A25 `qingyuan-unlock-core.js:286-292`（基线）`resetAdSession` 回收雷龙解锁
~~~js
function resetAdSession() { … adTimer=null; adElapsed=0; localAd=false;
  taskFor('dragon').features.forEach(feature => { unlocked.delete(feature); synced.delete(feature); });
  status = '推广任务需重新点击入口并观看 5 秒，解锁仅本次进入有效。'; … }
~~~
语义：离开/刷新页面即回收辟邪神雷与神雷化形（会话级限制核心）。判定：**【解锁型 → 移除】**。现状：**已改**为不回收 feature（仅重置计时）。
补丁：删除函数体并删 `unlock-ui.js:278` 调用。无需 HTML/CSS。

#### A26 `qingyuan-unlock-core.js:303-311`（基线）`privateUnlock/privateLock`
~~~js
privateUnlock() { privateUnlocked = true; status = '私测功能已开启。'; … },
privateLock() { if (!privateUnlocked) return false; privateUnlocked = false;
  status = '完成任务后，回来点“刷新进度”，再解锁对应内容。'; … }
~~~
语义：密码全开 + 页面关闭即回收（配合 A7）。判定：**【解锁型 → 移除】**。现状：`privateLock` **已改为 `return false`**（常驻解锁）。
补丁：删两个 API；`window.QingyuanUnlocks` 保留签名（app.js 只在 activate 时用，见 A44）。无需 HTML/CSS。

#### A27 `qingyuan-unlock-core.js:294-299`（基线）`navigate` 依赖 原平台
~~~js
async function navigate(kind, bvid) { … return Promise.reject(new Error('请在 原版平台 中完成此操作。')); }
~~~
语义：「去完成」按钮跳 原平台（关注/视频页）的唯一通道；本地打开必失败。判定：**【营销型 → 移除】**。现状：仍在。补丁：删 `unlock-ui.js:91-122` 的 goTask 分支。无需 HTML/CSS。

#### A28 `qingyuan-unlock-ui.js:9`（基线）广告可见性判定
~~~js
isAdVisible(){ return !document.hidden && !document.getElementById('author-ai-overlay').hidden; }
~~~
语义：倒计时只在推广浮层可见时累计；无该 DOM 会抛错。判定：**【营销型 → 移除】**。现状：**已加空值保护**（`const overlay=…; return !document.hidden && !!overlay && !overlay.hidden;`）——属必要健壮性修补，但整段本可删。
补丁：随 A24 删除。无需 HTML/CSS。

#### A29 `qingyuan-unlock-ui.js:71-80`（基线）`applyLocks()` 给 DOM 加锁
~~~js
const locked = !manager.has(id);
node.dataset.unlockFeature = id;
node.classList.toggle('is-feature-locked',locked);
node.setAttribute('aria-disabled',String(locked));
node.title = locked ? '完成任务解锁：' + manager.taskFor(id).reward : node.dataset.unlockBaseTitle;
~~~
语义：把未解锁功能对应的 13 个 DOM 节点（`#inspect-entry`、`DAGENG/GIANT/LOTUS` 招式按钮、`#thunder-dragon-pill`、`#toggle-lightning-btn`、`#toggle-sword-qi`、`#toggle-split-btn`、`#toggle-split-retain-btn`、`#fx-window-heading`、`#toggle-control-btn`、`#camera-retry-button` 等）打上虚框+🔒+提示。判定：**【解锁型 → 彻底移除】**。现状：仍在（`has()` 恒真 → `locked=false`，只留 `data-unlock-feature` 属性，供 capture 监听用）。
补丁：删 `applyLocks` 整个函数与 `bindings` 表，删 `style.css:911-912`。CSS：是。

#### A30 `qingyuan-unlock-ui.js:82-84`（基线）灵力调节面板强制收起
~~~js
const fx = document.getElementById('fx-panel');
if (!manager.has('fx')) fx.open = false;
document.querySelectorAll('#fx-panel .fx-controls input').forEach(input => { input.disabled = !manager.has('fx'); });
~~~
语义：`fx` 未解锁时把面板收起且禁用全部滑条。判定：**【解锁型 → 移除】**。现状：仍在（has 恒真 → 无副作用）。
补丁：删三行；若要默认展开见 B7。CSS：否。

#### A31 `qingyuan-unlock-ui.js:198-205`（基线）面板里「x / 5」完成度
~~~js
const completedTasks = definitions.filter(item => isTaskUnlocked(item.id)).length;
… '已完成 ' + completedTasks + ' / 5' … applyLocks(); … hooks.onChange?.(snapshot);
~~~
语义：把任务完成度做成进度压力。判定：**【营销型 → 移除】**。现状：仍在（面板不可达）。
补丁：面板整体删除后随之消失。无需 HTML/CSS。

#### A32 `qingyuan-unlock-ui.js:250-252`（基线）capture 阶段吞点击（核心拦截）
~~~js
const target=event.target.closest?.('[data-unlock-feature]');
if(target&&!manager.has(target.dataset.unlockFeature)){
  event.preventDefault();event.stopImmediatePropagation();open(target.dataset.unlockFeature);
~~~
语义：点未解锁按钮不触发原逻辑，改成弹「解锁任务」面板——比 `title` 更硬的交互门禁。判定：**【解锁型 → 彻底移除】**。现状：仍在（has 恒真 → 不拦）。
补丁：删 `document.addEventListener('click', handler, {capture:true})`，或保留但删 `dataset.unlockFeature` 写入（A29）。无需 HTML/CSS。

#### A33 `qingyuan-unlock-ui.js:255-267`（基线）面板存在时 keydown 捕获
~~~js
event.stopImmediatePropagation();
if(event.code==='Escape'||event.key==='Escape'){event.preventDefault();close();return;}
~~~
语义：面板打开时吞掉所有键盘事件（含游戏快捷键），再做焦点陷阱。判定：**【正常弹窗行为，但全局吞键应缩窄】**。现状：仍在。
补丁：仅在 keydown 目标是面板内元素时拦截；游戏焦点时不拦。无需 HTML/CSS。

#### A34 `qingyuan-unlock-ui.js:269-277`（基线）对外 API
~~~js
window.QingyuanUnlocks = { has: manager.has, require: requireFeature, open, close, recordAdClick: manager.recordAdClick, … privateUnlock, privateLock, isPrivateUnlocked, isOpen, setHooks, refresh };
~~~
语义：全局单例，`app.js:14` 依赖它。判定：**【接口，保留】**（但必须保证 `has/require` 恒真）。现状：仍在。
补丁：保留文件，`has:()=>true, require:()=>true` 最小 stub；其余方法可空实现。无需 HTML/CSS。

#### A35 `assets/css/style.css:911-912` 锁定视觉
~~~css
.is-feature-locked {border-style:dashed!important;filter:saturate(.55);}
.is-feature-locked::before {content:"🔒 ";font-size:10px;letter-spacing:0;}
~~~
语义：锁定的视觉表达（虚框+降饱和+🔒）。判定：**【解锁型 → 移除】**。现状：仍在（无元素再带该类）。
补丁：删两行。CSS：是（就地删）。

#### A36 `app.js:4197-4198` 招式切换的 `has` 门禁
~~~js
const required=formationUnlockFeature[newMode];
if(required&&!unlocks.has(required))return false;
~~~
语义：`DAGENG/THUNDER_DRAGON/GIANT/LOTUS` 四个形态需对应解锁，否则 `setFormationMode` 静默返回 false（手势识别也会因此切不过去）。判定：**【解锁型 → 移除】**。现状：仍在（`has()` 恒真后通过）。
补丁：删这两行（保 `formationUnlockFeature` 仅供 A37/B 类使用，或一并删）。无需 HTML/CSS。

#### A37 `app.js:4223-4225` `toggleManualFormation` 的 `require` 门禁
~~~js
const required=formationUnlockFeature[mode];
if(STATE.gestureMode!==mode&&required&&!unlocks.require(required))return;
if(mode==='THUNDER_DRAGON'&&!STATE.lightningEnabled&&!unlocks.has('lightning')){unlocks.require('lightning');return;}
~~~
语义：点底部招式按钮时的解锁检查；未解锁会弹解锁面板而不是切形态。判定：**【解锁型 → 移除】**。现状：仍在（恒真通过）。补丁：删前两行与 L4225 里的 `&&!unlocks.has('lightning')` 部分。无需 HTML/CSS。

#### A38 `app.js:4253` 流云剑气门禁
~~~js
event.stopPropagation();if(!STATE.swordQiEnabled&&!unlocks.require('qi'))return;STATE.swordQiEnabled=!STATE.swordQiEnabled;
~~~
语义：开剑气必须 `qi` 解锁。判定：**【解锁型 → 移除】**。现状：仍在。补丁：删 `if(!STATE.swordQiEnabled&&!unlocks.require('qi'))return;`。无需 HTML/CSS。

#### A39 `app.js:4276` 剑影分光门禁
~~~js
if(!STATE.splitEnabled&&!unlocks.require('split'))return;
~~~
判定：**【解锁型 → 移除】**。现状：仍在。补丁：删该行。无需 HTML/CSS。

#### A40 `app.js:4291` 「分光关闭后保留主剑」也需解锁
~~~js
event.stopPropagation();if(!unlocks.require('split'))return;
~~~
语义：连偏好设置都要 `split` 解锁。判定：**【解锁型 → 移除】**。现状：仍在。补丁：删 `if(!unlocks.require('split'))return;`。无需 HTML/CSS。

#### A41 `app.js:4324` 辟邪神雷门禁
~~~js
e.stopPropagation();if(!STATE.lightningEnabled&&!unlocks.require('lightning'))return;
~~~
判定：**【解锁型 → 移除】**。现状：仍在。补丁：删 `if(...)` 判断。无需 HTML/CSS。

#### A42 `app.js:5121` 手势控制门禁
~~~js
if(!unlocks.require('hand'))return false;
~~~
语义：`startHandTracking` 首行检查；未解锁则点「开启手势控制」只会弹解锁面板，摄像头根本不会请求。判定：**【解锁型 → 移除】**。现状：仍在。补丁：删该行。无需 HTML/CSS。

#### A43 `app.js:6329` 赏剑模式门禁
~~~js
if(enabled&&!unlocks.require('inspect'))return;
~~~
语义：`#inspect-entry` 点开赏剑需 `inspect`。判定：**【解锁型 → 移除】**。现状：仍在。补丁：删该行。无需 HTML/CSS。

#### A44 `app.js:6521-6562` `setHooks`：解锁状态变化时强制关闭功能
~~~js
onChange(){
  if(!unlocks.has('lightning'))STATE.lightningEnabled=false;
  if(!unlocks.has('qi'))STATE.swordQiEnabled=false;
  if(!unlocks.has('split'))STATE.splitEnabled=false;
  if(!unlocks.has('fx'))fxPanel.open=false;
  if(!unlocks.has('hand')&&STATE.controlMode==='HAND')stopHandTracking();
  if(!unlocks.has('inspect')&&STATE.inspectMode)toggleInspection(false);
  if(formationUnlockFeature[STATE.gestureMode]&&!unlocks.has(formationUnlockFeature[STATE.gestureMode]))setFormationMode('DRAGON',true);
…}
~~~
语义：解锁面板每次渲染都会回调 `onChange`，把「当前未解锁」的功能从玩家状态里**强制关掉**（连已开的手势/赏剑也会被踢掉）。此外 `activate`（`app.js:6534-6547`）里 `fx` 分支还有 `if(!unlocks.require('fx'))return;`。判定：**【解锁型 → 移除】**。现状：仍在（has 恒真 → 不触发）。
补丁：删 `onChange` 整个回调（或保留但删 7 行 `if(!unlocks.has…)`）。无需 HTML/CSS。

#### A45 `qingyuan-private-unlock.js:11` 私测密码
~~~js
const expectedPassword = '2464054180';
~~~
语义：后门密码；`submitPassword` 校验通过后 `unlocks.privateUnlock()`。判定：**【解锁型 → 彻底移除】**。现状：脚本仍在但 DOM 已删，L10 守卫直接 return。
补丁：删 `index.html` 的脚本引用 + 删文件。HTML：是。

#### A46 `qingyuan-private-unlock.js:107-109` `pagehide` 自动回收私测解锁
~~~js
window.addEventListener('pagehide', () => { try { unlocks.privateLock?.(); } catch (_) {} });
~~~
语义：关页面/切后台即取消全部私测解锁——「本次进入有效」的最后一环。判定：**【会话级 → 移除】**。现状：仍在（`privateLock` 常量返回 false，无害）。
补丁：删该监听（随 A45）。无需 HTML/CSS。

### B. 技能级联前置 / 招式互斥 / 按钮 disabled（核心玩法，建议保留但可配置）

#### B1 `app.js:4199-4203` 神雷化形必须先在开【辟邪神雷】
~~~js
// 只有在【辟邪神雷】开启的情况下才能使用“神雷化形”
if (newMode === 'THUNDER_DRAGON' && !STATE.lightningEnabled) {
  showSkillToast('⚡ 需先开启【辟邪神雷】方可施展【神雷化形】');
  return;
}
~~~
语义：形态级联前置，不是氪金门禁，属玩法语义（没雷就没雷龙）。判定：**【核心玩法 → 保留】**（若用户要「所有限制都取消」可改为自动代开雷）。现状：仍在。
补丁（可选）：`if (newMode === 'THUNDER_DRAGON' && !STATE.lightningEnabled) { STATE.lightningEnabled = true; updateLightningUI(); }`。无需 HTML/CSS。

#### B2 `app.js:4226` 手动切招式时的同一前置
~~~js
if(mode==='THUNDER_DRAGON'&&!STATE.lightningEnabled){showSkillToast('⚡ 需先开启【辟邪神雷】方可施展【神雷化形】');return;}
~~~
语义：与 B1 同义的玩法前置（前一行 L4225 是解锁门，归 A37）。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无（删 L4225 即可，保留本行）。无需 HTML/CSS。

#### B3 `app.js:4308-4321` 关闭辟邪神雷会强制退出神雷化形
~~~js
thunderDragonPill.classList.toggle('disabled-skill', !STATE.lightningEnabled);
if (!STATE.lightningEnabled) {
  if (STATE.swordFingerMode === 'THUNDER_DRAGON') STATE.swordFingerMode = 'DRAGON';
  if (STATE.manualPinnedMode === 'THUNDER_DRAGON') STATE.manualPinnedMode = null;
  if (STATE.gestureMode === 'THUNDER_DRAGON') setFormationMode('DRAGON');
}
~~~
语义：互斥级联 + 按钮置灰状态。判定：**【核心玩法 → 保留】**（否则雷龙形态但无雷，视觉会坏）。现状：仍在。补丁：无；如要取消，改为「关雷不踢形态」。CSS：`.disabled-skill`（`style.css:414`）保留。

#### B4 `app.js:4257` 流云剑气与神雷化形互斥
~~~js
swordQiGroup.visible=STATE.swordQiEnabled&&STATE.gestureMode!=='THUNDER_DRAGON';
~~~
语义：雷龙形态下不显示剑气（渲染冲突规避）。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无。

#### B5 `app.js:4330-4332` 只有鼠标模式才用键位同步形态
~~~js
if(STATE.controlMode!=='MOUSE')return;
setFormationMode(STATE.manualPinnedMode||((STATE.swordFingerMode==='THUNDER_DRAGON'&&STATE.lightningEnabled)?'THUNDER_DRAGON':'DRAGON'));
~~~
语义：手势模式下键位不改形态（避免双输入打架）。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无。

#### B6 `app.js:4262-4264` 吐雷只在雷龙形态+雷开时生效
~~~js
if(STATE.gestureMode==='THUNDER_DRAGON'&&STATE.lightningEnabled){beginDragonBreath();breathButton.setPointerCapture?.(event.pointerId);}
~~~
语义：按得住才有龙息。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无。

#### B7 `app.js:4236` 灵力调节面板默认收起
~~~js
const fxPanel=document.getElementById('fx-panel');fxPanel.open=false;
~~~
语义：即便解锁了也要手动展开，第一次进入看不到 6 个滑条。判定：**【人为隐藏 → 放宽】**。现状：仍在。
补丁：`fxPanel.open=true;`（或 `fxPanel.open=window.innerWidth>=768;`）。HTML：`<details id="fx-panel" open>`（`index.html:577`）。CSS：否。

#### B8 `index.html:629` 提示条默认文案就是「需先开启辟邪神雷」
~~~html
<div id="skill-toast">⚡ 需先开启【辟邪神雷】方可施展【神雷化形】</div>
~~~
语义：未操作就显示门槛提示（暗示你被限制）。判定：**【营销/暗示 → 改文案】**。现状：仍在。
补丁：`<div id="skill-toast"></div>`（靠 JS 动态填入）或改为「点击底部招式栏切换剑诀」。HTML：是。

#### B9 `index.html:689,692,695` 招式栏按钮与快捷键 title
~~~html
<button id="toggle-split-btn" … title="开启或关闭剑影分光（G / 1）">
<button id="toggle-split-retain-btn" … title="剑影分光关闭时仅保留一把飞剑；点击切换为保留72口主剑（4）">
<button id="toggle-lightning-btn" … title="开启或关闭飞剑周身辟邪神雷（2）">
~~~
语义：按钮本身＋快捷键提示，是正常玩法 UI。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无。HTML：否。

### C. 会话级 / 临时解锁 / 生命周期清理

#### C1 `qingyuan-unlock-ui.js:278`（基线）pagehide 三重清理
~~~js
window.addEventListener('pagehide', () => { window.QingyuanAuthorPromo.close(false); manager.resetAdSession(); manager.privateLock(); });
~~~
语义：一关页面就把广告解锁、私测解锁全部回收（配合 A25/A26）。判定：**【会话级 → 移除】**。现状：仍在（两个被调函数已退化，实际无副作用）。
补丁：删该监听。无需 HTML/CSS。

#### C2 `qingyuan-author-promo.js:24-34` 关闭推广浮层即取消倒计时
~~~js
function close(){ … window.QingyuanUnlocks?.cancelAdCountdown?.(); … }
~~~
语义：关掉广告浮层 → 5 秒重来。判定：**【营销型 → 移除】**。现状：仍在。
补丁：随 A6/A24 删整文件。无需 HTML/CSS。

#### C3 `qingyuan-unlock-ui.js:279`（基线）visibilitychange 暂停广告计时
~~~js
document.addEventListener('visibilitychange', () => manager.pauseAdClock());
~~~
语义：切后台不计广告时长（逼用户盯着屏幕）。判定：**【营销型 → 移除】**。现状：仍在。补丁：随 A24 删。无需 HTML/CSS。

#### C4 `app.js:5129` 切后台自动停摄像头
~~~js
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(cameraStream||STATE.controlMode==='HAND'))stopHandTracking('页面切到后台，摄像头已停止。返回后可重新开启手势。');});
~~~
语义：隐私/省电的正常行为，但「返回后要重新开启」也算一次中断。判定：**【平台约束 → 保留】**。现状：仍在。补丁：保留（浏览器要求手势才能重开摄像头，自动恢复不可行）。无需 HTML/CSS。

#### C5 `app.js:5130` pagehide 停手势
~~~js
window.addEventListener('pagehide',()=>stopHandTracking());
~~~
语义：离开即断摄像头。判定：**【平台约束 → 保留】**。现状：仍在。补丁：无。

#### C6 `qingyuan-toy-bridge.js:214-220`（基线）容器 suspend/resume 与 stopAllMedia
语义：嵌入 原平台容器时切后台停所有媒体流（`visibilitychange hidden → stopAllMedia`、`pagehide → suspend`、`pageshow → resume`）。判定：**【平台约束 → 保留】**（STANDALONE 下不走）。现状：仍在。补丁：无。

### D. 原平台 SDK 依赖与无 SDK 时的降级/卡点

#### D1 `qingyuan-toy-bridge.js:10-16`（基线）平台页判定
~~~js
const toyRoute = /(^|\.)原平台\.com$/i.test(location.hostname) && /^\/toy(?:\/|$)/.test(location.pathname);
function isPlatformPage() {
  const embedded = window.self !== window.top;
  return toyRoute || embedded || /BiliApp|BiliHarmony/i.test(navigator.userAgent) || Boolean(window.__TOY_META__?.toy_id);
}
~~~
语义：决定摄像头走 SDK 还是浏览器、容器能力是否启用。**若在 原平台 App/内嵌里打开且 SDK 挂了，会走 SDK 分支然后 reject，而不是回退浏览器。**
判定：**【平台依赖 → 改强制浏览器】**。现状：**已加** `const STANDALONE=true; if(STANDALONE)return false;`（现行 L12/L14）→ 永远走 `getUserMedia`。
补丁：无（已做）；建议把 STANDALONE 做成可配置（`?platform=1` 时才走 SDK）。无需 HTML/CSS。

#### D2 `qingyuan-toy-bridge.js:59-78`（基线）`requestCamera` 降级链
~~~js
const platformPage = isPlatformPage();
const api = platformPage ? (window.toy || sdk) : null;
if (api) { if (typeof api.requestCamera !== 'function' || typeof api.stopMedia !== 'function') return Promise.reject(cameraError('TOY_CAMERA_UNSUPPORTED', …)); … }
if (platformPage) return Promise.reject(cameraError('TOY_SDK_UNAVAILABLE', 'Toy SDK has not loaded. Retry after the connection recovers.'));
if (window.isSecureContext === false) return Promise.reject(cameraError('INSECURE_CONTEXT', 'Camera requires a secure context.'));
~~~
语义：平台页无 SDK → 直接失败（不回落浏览器）；非安全上下文 → 拒绝。判定：**【平台依赖 → 已解除】**。现状：已绕过（STANDALONE）。补丁：无。
**注意**：本地版仍要求 **https 或 http://localhost / 127.0.0.1** 才给摄像头；8123 静态服务器满足（`file://` 打开在 Chrome 下会被拒绝）。

#### D3 `qingyuan-toy-bridge.js:131-139`（基线）`connect()` 只在平台页连 SDK
语义：非平台页直接 `Promise.resolve(false)`；平台页逐个 `isSupport` 5 个能力（`requestCamera/stopMedia/onContainerChange/getContainerState/setContainerMode`）。判定：**【平台依赖】**。现状：STANDALONE 下恒 false（`app.js` 里 `void toyBridge.connect()` 不阻塞）。补丁：无。

#### D4 `qingyuan-toy-bridge.js:204-206`（基线）`sdkAvailable/canControlContainer`
~~~js
get sdkAvailable() { return isPlatformPage() && Boolean(window.toy || sdk); },
get isPlatformPage() { return isPlatformPage(); },
get canControlContainer() { return Boolean(isPlatformPage() && sdk && capabilities.setContainerMode && typeof offContainer === 'function'); },
~~~
语义：UI 用它们判断是否显示容器控制；本地版恒 false。判定：**【平台依赖】**。现状：不变。补丁：无。

#### D5 `qingyuan-invitation.js:37-49` 等 SDK 最多 7 秒
~~~js
if (window.toy) return Promise.resolve(window.toy);
return new Promise((resolve, reject) => { const script = byId('platform-toy-sdk'); … timer = setTimeout(failed, 7000); });
~~~
语义：无 SDK 时邀请卡功能等 7 秒后失败。判定：**【营销型 → 移除】**。现状：仍在（脚本仍被加载，但入口已隐藏；SDK script 已删 → `script` 为 null，7 秒后 reject）。
补丁：删 `qingyuan-invitation.js` 及 HTML 引用 + 删 `#invite-home-open`。无需 HTML/CSS（删 DOM 后）。

#### D6 `qingyuan-invitation.js:150-189` 生成邀请卡（`getQrCode` 硬依赖）
~~~js
const names = ['getQrCode','saveImageToAlbum','sharePicture','share'];
… const qr = await api.getQrCode({ path, size: 384 });
… catch → 提示「请在已发布的 原版平台 页面中打开后生成」「邀请卡暂时无法生成…」
~~~
语义：本地版永远走失败提示。判定：**【营销型 → 移除】**。现状：仍在。补丁：删文件（同 D5）。

#### D7 `qingyuan-invitation.js:171-172` 二维码 URL 必须 原站域名/toy/
~~~js
if (!/^https:/.test(url) || !/(^|\.)原平台\.com$/.test(new URL(url).hostname) || !/^\/toy\/[^/]+/.test(new URL(url).pathname)) throw …
~~~
语义：只认自家域名，本地复刻无法通过。判定：**【营销型 → 移除】**。现状：仍在。补丁：删。

#### D8 `qingyuan-invitation.js:230-239` 保存邀请卡（`saveImageToAlbum` 不支持时降级下载）
语义：无 SDK 时提示「已发起图片下载…」。判定：**【平台依赖】**。现状：仍在。补丁：删。

#### D9 `qingyuan-invitation.js:249-279` 分享链
语义：`sharePicture → navigator.share → ClipboardItem → sdk.share → 复制链接` 五级降级，最终可用但只在 SDK 环境完整。判定：**【平台依赖】**。现状：仍在。补丁：删。

#### D10 `app.js:6564-6573` `toyBridge.connect()` 不阻塞启动
~~~js
void toyBridge.connect();
~~~
语义：SDK 连接 fire-and-forget；`app.js:6595-6596` 注释明说「The game remains usable with keyboard/touch even if the SDK CDN is slow or unavailable.」。判定：**【设计正确 → 保留】**。现状：仍在。补丁：无。

### E. 画质与性能降级（对应任务 e）

#### E1 `app.js:574` 像素比上限按设备写死
~~~js
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.8));
~~~
语义：手机最高 1.35×、桌面 1.8×（2K/3K 屏被强行降采样，飞剑边缘发糊）。判定：**【性能约束 → 放宽】**。现状：仍在。
补丁：`renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));`（4K 屏可 2.5，但要配合 E4 预算）。无需 HTML/CSS。

#### E2 `app.js:578,673` 移动端直接关阴影
~~~js
renderer.shadowMap.enabled = !isMobile;
moonDirLight.castShadow=!isMobile;
~~~
语义：手机完全没有投影，画面扁平；桌面才有 2048 阴影。判定：**【性能约束 → 按性能而非设备】**。现状：仍在。
补丁：`renderer.shadowMap.enabled = true;` + `moonDirLight.castShadow=true;`，同时 E12 降贴图尺寸。无需 HTML/CSS。

#### E3 `app.js:629,635-641` 画质档位：手机默认「流畅」
~~~js
let renderQuality = isMobile ? 'balanced' : 'ultra';
…
qualityBtn textContent = renderQuality==='ultra' ? '画质 · 精致' : '画质 · 流畅';
~~~
语义：两档画质，手机默认 balanced（低像素比/无阴影）；按钮动态创建在 `#quality-window`。判定：**【性能约束 → 允许常驻精致】**。现状：仍在。
补丁：`let renderQuality='ultra';`（保留手动切换）。HTML：否。

#### E4 `app.js:648-653` 全屏/沉浸时再压像素比并关阴影
~~~js
const ratioCap=fullscreenActive?(isMobile?0.95:1.10):(renderQuality==='ultra'?1.8:1.0);
const pixelBudget=fullscreenActive?(isMobile?1.55e6:2.8e6):Infinity;
const ratio=Math.max(.70,Math.min(window.devicePixelRatio||1,ratioCap,budgetRatio));
const shadows=renderQuality==='ultra'&&!fullscreenActive;
~~~
语义：全屏/沉浸模式为了帧率把渲染分辨率压到 0.95× 并关阴影（**视觉最差的恰好是全屏模式**）。判定：**【性能约束 → 放宽】**。现状：仍在。
补丁：`ratioCap=fullscreenActive?(isMobile?1.25:1.5):(renderQuality==='ultra'?2.0:1.0);` 与 `pixelBudget=Infinity;`。无需 HTML/CSS。

#### E5 `app.js:5333-5337` 全屏限帧 30/45fps
~~~js
if(performanceMode){ const minFrameInterval=handPerformanceMode?1000/30:1000/45; if(frameNow-lastPerformanceFrameTime<minFrameInterval)return; lastPerformanceFrameTime=frameNow; }
~~~
语义：沉浸模式硬限帧，手感变钝（用户感知为「全屏后变卡」）。判定：**【性能约束 → 移除或仅低端机启用】**。现状：仍在。
补丁：删整个 `if(performanceMode){…}` 块（或 `minFrameInterval=1000/60`）。无需 HTML/CSS。

#### E6 `app.js:437` 音效 32 声道池上限
~~~js
if(!audible()||voices.size>=32)return;
~~~
语义：同时最多 32 个音源，超出直接丢弃（大量飞剑时音效断）。判定：**【性能约束 → 放宽】**。现状：仍在。补丁：`voices.size>=64`。无需 HTML/CSS。

#### E7 `app.js:4820` 手势识别输入强制降采样
~~~js
const inputScale=Math.min(1,(handPerformanceMode?480:640)/Math.max(orientedWidth,orientedHeight));
~~~
语义：识别用画面最长边压到 640（沉浸 480）像素再送模型 → 远距离/小手掌识别差。判定：**【性能约束 → 放宽】**。现状：仍在。补丁：`(handPerformanceMode?640:960)/…`。无需 HTML/CSS。

#### E8 `app.js:4869` 摄像头预览 DPR 上限 3×（沉浸 1.5×）
~~~js
const box=cameraPreviewBoxSize(),ratio=Math.min(handPerformanceMode?1.5:3,Math.max(1,window.devicePixelRatio||1));
~~~
语义：预览画布 DPR 上限，避免 4K 屏把预览撑爆。判定：**【性能约束 → 保留】**。现状：仍在。补丁：可到 4。无需 HTML/CSS。

#### E9 `app.js:5074` 移动端强制 CPU 推理
~~~js
const delegates=isMobile||forceHandCPU?['CPU']:['GPU','CPU'];
~~~
语义：手机永远 CPU（识别慢 → 再被 F9 压到 12.5fps），桌面才试 GPU。判定：**【兼容性约束 → 放宽】**。现状：仍在。
补丁：`const delegates=forceHandCPU?['CPU']:['GPU','CPU'];`（保留 E10 的失败回退）。无需 HTML/CSS。

#### E10 `app.js:5131-5141` GPU 推理失败自动降 CPU（一次）
~~~js
handRecovering=true;forceHandCPU=true;try{handLandmarker?.close();}catch(_){}handLandmarker=null;
… catch(next){reportCameraFailure(next,'inference',serial);}finally{handRecovering=false;}
~~~
语义：GPU 崩了兜底 CPU，避免白屏。判定：**【健壮性 → 保留】**。现状：仍在。补丁：无。

#### E11 `app.js:585-628` 每帧合成作者版权暗水印
~~~js
const copyrightOwner = '原平台：原作者';
…
// opacity .008，每帧把 512×512 水印 canvas 合成进画面
~~~
语义：不是限制，但每帧一次 canvas 合成 + 版权署名；复刻版可去掉省 GPU。判定：**【展示型 → 可选移除】**。现状：仍在。
补丁：删 `renderCopyrightWatermark()` 调用与角标（`index.html:560-561`）。HTML：是。

#### E12 `app.js:674` 阴影贴图固定 2048
~~~js
moonDirLight.shadow.mapSize.set(2048,2048);
~~~
语义：桌面 2048、手机因 E2 直接不投影；没有中间档。判定：**【性能约束 → 分档】**。现状：仍在。补丁：`moonDirLight.shadow.mapSize.set(isMobile?1024:2048,isMobile?1024:2048);`。无需 HTML/CSS。


### F. 摄像头 / 手势门槛（对应任务 f）

#### F1 `app.js:4809-4813` 摄像头约束写死 640×480@30
~~~js
const landscape=APP_VIEW.width>=APP_VIEW.height;
let width=landscape?640:480,height=landscape?480:640;
return {facingMode:{ideal:'user'},width:{ideal:width},height:{ideal:height},aspectRatio:{ideal:width/height},frameRate:{ideal:24,max:30}};
~~~
语义：分辨率/帧率上限，高清摄像头被降级；竖屏时 480×640。判定：**【性能约束 → 放宽】**。现状：仍在。
补丁：`width=landscape?1280:720,height=landscape?720:1280, frameRate:{ideal:30,max:60}`（识别输入仍会降采样，见 E7）。无需 HTML/CSS。

#### F2 `app.js:5088` 等首帧 10 秒超时
~~~js
const timer=setTimeout(()=>{cleanup();reject(cameraError('VIDEO_TIMEOUT','No camera frame received.'));},10000);
~~~
语义：摄像头打开但不出帧 → 10 秒后报错并停。判定：**【健壮性 → 保留】**。现状：仍在。补丁：无。

#### F3 `app.js:4996` 手部资源加载超时 8s/25s
~~~js
const timer=setTimeout(()=>controller.abort(),remote?25000:8000);
~~~
语义：本地 8 秒、远程 CDN 25 秒；弱网下超时即失败。判定：**【健壮性 → 保留】**。现状：仍在。补丁：本地可到 15s。无需 HTML/CSS。

#### F4 `app.js:5002-5006` 资源大小 + SHA-256 强校验
~~~js
if(bytes.length!==expected.size)throw new Error('Resource size mismatch: '+bytes.length);
if(!window.crypto?.subtle)throw new Error('Resource integrity check requires a secure context');
if(hash!==expected.sha256)throw new Error('Resource SHA-256 mismatch');
~~~
语义：模型/wasm 必须字节级一致；非安全上下文直接拒绝（`file://` 下可能触发）。判定：**【完整性约束 → 本地镜像可保留，file:// 场景需降级】**。现状：仍在。
补丁：`try{crypto.subtle}catch{/* 跳过校验，仅告警 */}`。无需 HTML/CSS。

#### F5 `app.js:5048` 所有候选都失败才报 `LOCAL_ASSET`
~~~js
throw cameraError('LOCAL_ASSET','Hand asset request failed: '+id+'; '+failures.join('; '));
~~~
语义：本地 + 3 个 CDN 全挂才失败，本身已是多重降级。判定：**【健壮性 → 保留】**。现状：仍在。补丁：无。

#### F6 `app.js:5063-5068` 只手数上限 1 + 三个置信度阈值 0.5
~~~js
baseOptions:{modelAssetBuffer:assets.model,delegate},canvas:document.createElement('canvas'),runningMode:'VIDEO',numHands:1,
minHandDetectionConfidence:.5, minHandPresenceConfidence:.5, minTrackingConfidence:.5
~~~
语义：只识别 1 只手 → 双手手势/双剑交互不可能；暗光/远距离易丢手。判定：**【人为限制 → 放宽】**。现状：仍在。
补丁：`numHands:2` + `minHandDetectionConfidence:.35`、`minTrackingConfidence:.35`（`pollHandTracking` 取第一只手为主手的逻辑可不动）。无需 HTML/CSS。

#### F7 `app.js:5245` 推理前的 7 项前置条件
语义：须同时满足 `controlMode==='HAND'`、模型已加载、`video.readyState>=2`、非恢复中、`cameraDiagnostic.stage==='ready'`、无弹窗、非双指缩放。判定：**【健壮性 → 保留】**。现状：仍在。补丁：无。

#### F8 `app.js:5247` 识别节流 12.5–30fps
~~~js
const handInterval=handPerformanceMode?(handDelegate==='CPU'?80:55):(handDelegate==='CPU'?50:33);
~~~
语义：CPU 12.5/20fps、GPU 18/30fps 才跑一次识别；手势切换明显滞后。判定：**【性能约束 → 放宽】**。现状：仍在。
补丁：`const handInterval=handPerformanceMode?33:16;`（配合 E9 的 GPU 优先）。无需 HTML/CSS。

#### F9 `app.js:5266-5276` 6 帧窗口 + ≥3 票多数投票（手势防抖）
~~~js
gestureWindow.push(rawGesture);
if (gestureWindow.length > GESTURE_WINDOW_SIZE) gestureWindow.shift();
… if (maxVotes >= 3 && bestGesture !== STATE.gestureMode) { … setFormationMode(bestGesture); }
~~~
语义：`GESTURE_WINDOW_SIZE=6`（`app.js:4804`），连续 3 票才切形态 → 至少 3 个识别周期（慢则 ~0.24s、快则 ~0.1s）。判定：**【防误触 → 保留（可降为 2 票）】**。现状：仍在。补丁（可选）：`maxVotes >= 2`。无需 HTML/CSS。

#### F10 `app.js:5292-5293` 手部坐标 1.55× 放大再夹 0..1
~~~js
const expandedX = THREE.MathUtils.clamp((normX - 0.5) * 1.55 + 0.5, 0, 1);
const expandedY = THREE.MathUtils.clamp((normY - 0.5) * 1.55 + 0.5, 0, 1);
~~~
语义：把手掌中心映射到全屏的增益；1.55 意味「小幅度手势=大幅移动」，但边缘到 0/1 就夹住。判定：**【交互调参 → 保留】**。现状：仍在。补丁：可到 1.8。无需 HTML/CSS。

#### F11 `app.js:5301` 指针平滑 0.18–0.68
~~~js
const alpha = THREE.MathUtils.clamp(0.18 + (moveDelta / 120) * 0.45, 0.18, 0.68);
~~~
语义：手移动越快跟随越紧；慢速时 0.18 平滑（略有延迟）。判定：**【交互调参 → 保留】**。现状：仍在。补丁：无。

#### F12 `app.js:5105` 手机才自动显示摄像头窗
~~~js
if(appStage.classList.contains('mobile-layout'))setUiWindowVisible('camera-window',true);
~~~
语义：桌面开手势不弹预览（找不到画面确认手势）。判定：**【UI 默认 → 可改】**。现状：仍在。补丁：`setUiWindowVisible('camera-window', true);`（无条件）。无需 HTML/CSS。

#### F13 `app.js:5114` 手势就绪状态文案固定
语义：`setCameraStatus('ready','摄像头与手势识别已就绪',…,'手势已开启 · 点此查看状态')`。判定：**【UI 文案 → 保留】**。补丁：无。

#### F14 `index.html:581` 摄像头预览尺寸滑条 100%–400%
~~~html
<input id="webcam-size" type="range" min="100" max="400" step="10" value="100" aria-describedby="webcam-size-hint" />
~~~
语义：预览框最大 4×，再大被 400 封顶。判定：**【UI 限制 → 放宽】**。现状：仍在。补丁：`max="600"` 并同步 CSS 上限。HTML：是；CSS：是（预览框尺寸计算）。

#### F15 `app.js:5101` 手势开启时同时请求摄像头 + 3 个资源（串行等待）
~~~js
const stream=await toyBridge.requestCamera(cameraVideoConstraints());
…
loadLocalHandAssets(); loadHandLandmarker(assets);
~~~
语义：摄像头与模型资源都要成功才能用，任一失败即报错（错误码 `LOCAL_ASSET/VIDEO_TIMEOUT/GPU…`）。判定：**【健壮性 → 保留】**。现状：仍在。补丁：无。

#### F16 `app.js:4804` 手势窗口大小 6（防抖参数）
~~~js
const gestureWindow=[],GESTURE_WINDOW_SIZE=6;
~~~
语义：6 帧滑动窗口，配合 F9 的 ≥3 票。判定：**【防误触 → 保留】**。现状：仍在。补丁：无。

### G. 其它人为设限（clamp / 默认值 / 默认隐藏 / 防抖）

#### G1 `app.js:4239,4243,4248` 灵力调节三个滑条上限
~~~js
STATE.lightningAmount=THREE.MathUtils.clamp(Number(amountSlider.value)||0,0,400)/100;
STATE.lightTransparency=THREE.MathUtils.clamp(Number(transparencySlider.value)||0,0,100)/100;
STATE.spinRPM=THREE.MathUtils.clamp(Number(spinSlider.value)||0,0,120);
~~~
语义：雷量 0–4、透明度 0–1、转速 0–120 RPM；HTML 滑条上限同值（`index.html:585` 音量、`lightning-amount` max 400 等）。判定：**【玩法参数 → 保留】**（放开会穿模/晕眩）。现状：仍在。补丁：无。HTML：否。

#### G2 `app.js:4377` 视角俯仰限位（鼠标/触摸拖拽）
~~~js
STATE.look.pitch=THREE.MathUtils.clamp(STATE.look.pitch-dy*.0028,-Math.PI/2+.06,Math.PI/2-.06);
~~~
语义：不能看到正上方/正下方（防翻转/穿模）。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无。

#### G3 `app.js:4403-4404` 相对基准视角的俯仰限位
~~~js
const elevation=Math.atan2(offset.y,Math.hypot(offset.x,offset.z)),limit=Math.PI/2-.06;
const pitch=THREE.MathUtils.clamp(STATE.look.currentPitch,elevation-limit,elevation+limit);
~~~
语义：自由观察也不能越过地平面。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无。

#### G4 `app.js:4517-4518,5486` 缩放/相机距离限位
~~~js
if(STATE.inspectMode)inspectionOrbit.radius=THREE.MathUtils.clamp(inspectionOrbit.radius*factor,1.4,18);
else STATE.zoomFactor=THREE.MathUtils.clamp(STATE.zoomFactor*factor,.85/lastBaseViewDistance,1800/lastBaseViewDistance);
… const finalDistance=THREE.MathUtils.clamp(lastBaseViewDistance*STATE.zoomFactor,.85,1800);
~~~
语义：最近 0.85、最远 1800 单位；赏剑轨道 1.4–18。判定：**【核心玩法 → 保留】**。现状：仍在。补丁：无。

#### G5 `app.js:4626,4656` 飞行边界
~~~js
const flightBoundsMin=new THREE.Vector3(-1250,-190,-1750),flightBoundsMax=new THREE.Vector3(1250,470,760);
… const value=flight.offset[axis];flight.offset[axis]=THREE.MathUtils.clamp(value,flightBoundsMin[axis],flightBoundsMax[axis]);
~~~
语义：WASD/空格飞行被限制在盒子里（Z 后边界只到 760，往前可到 −1750）。判定：**【核心玩法 → 保留】**（放开会飞出场景露底）。现状：仍在。补丁：无。

#### G6 `app.js:5427-5428` 自动巡游（roam）范围
~~~js
const roamRangeX = isDageng ? 156 : 112;
const roamRangeY = isDageng ? 72 : 52;
~~~
语义：无输入时飞剑自动巡游的椭圆半径（大庚剑阵更大）。判定：**【玩法参数 → 保留】**。现状：仍在。补丁：无。

#### G7 `app.js:6263,6316` 赏剑轨道默认与俯仰
~~~js
const inspectionOrbit={yaw:.12,pitch:.08,radius:6.7,dragging:false,lastX:0,lastY:0,subject:'main'};
… inspectionOrbit.pitch=THREE.MathUtils.clamp(inspectionOrbit.pitch+(y-inspectionOrbit.lastY)*.008,-1.53,1.53);
~~~
语义：赏剑默认 6.7 距离、俯仰 ±1.53。判定：**【玩法参数 → 保留】**。现状：仍在。补丁：无。

#### G8 `app.js:346,350-355` 音效每次进入默认关闭
~~~js
let context=null,master=null,dry=null,castBus=null,layers=null,enabled=false,volume=.65;
try{ const saved=JSON.parse(localStorage.getItem('qingyuan-sound-v1')||'null'); if(saved&&typeof saved.volume==='number') volume=…; }catch(_){}
function save(){try{localStorage.setItem('qingyuan-sound-v1',JSON.stringify({volume}));}catch(_){}}
~~~
语义：只持久化音量，不持久化开关；源码注释明说「每次打开都保持静音，仅恢复音量；旧的开启偏好不自动开启声音」。判定：**【人为限制 → 移除】**。现状：仍在。
补丁：`enabled = saved?.enabled === true;`（`save()` 写 `{volume,enabled}`）；注意 AudioContext 需首次用户手势才 resume，可在首个 `pointerdown` 里 `resume()`。HTML：否。

#### G9 `index.html:586,617` 音效状态文案与 aria 默认「关」
~~~html
<p id="sound-status" role="status">音效已关闭，点击“音效：关”开启</p>
<button id="toggle-sound-btn" class="sound-muted" type="button" aria-pressed="false" aria-label="开启仙侠舞剑音效">音效：关</button>
~~~
语义：入口即提示「被关着」。判定：**【人为限制 → 随 G8 改】**。现状：仍在。补丁：默认 `音效：开` / `aria-pressed="true"`。HTML：是。

#### G10 `app.js:6445-6447` 手机默认隐藏三窗
~~~js
if(appStage.classList.contains('mobile-layout')){ for(const id of ['camera-window','quality-window','fx-panel'])setUiWindowVisible(id,false); }
~~~
语义：手机进入时摄像头窗/画质窗/灵力调节窗全隐藏（用户以为没有这些功能）。判定：**【UI 默认 → 保留（省屏）或记住上次】**。现状：仍在。补丁：可改为只隐藏 camera-window。无需 HTML/CSS。

#### G11 `app.js:6370-6376,6410-6416` 界面窗口统一管理器
语义：9 个窗口定义 + `.ui-window-hidden` 类控制显隐（`style.css:553`）。判定：**【UI 机制 → 保留】**。现状：仍在。补丁：无。

#### G12 `app.js:6462` 弹窗打开时禁止游戏输入
~~~js
function isInteractionOverlayOpen(){return !gameGuideOverlay.hidden||window.QingyuanAuthorPromo.isOpen||window.QingyuanUnlocks?.isOpen===true||window.QingyuanInvitation?.isOpen===true;}
~~~
语义：任一弹窗打开 → 键盘飞行/手势识别暂停（防误操作）。判定：**【交互正确性 → 保留】**。现状：仍在。
**坑**：这里 `window.QingyuanAuthorPromo.isOpen` 没有 `?.`；若按 A6 删掉 author-promo 脚本，会抛 TypeError → **必须同步改成** `window.QingyuanAuthorPromo?.isOpen===true`。无需 HTML/CSS。

#### G13 `app.js:4632-4634` 飞行键位的前置条件
语义：仅当 `!inspectMode && !isInteractionOverlayOpen() && ` 焦点不在输入框才接受 WASD/空格。判定：**【交互正确性 → 保留】**。现状：仍在。补丁：无。

#### G14 `app.js:4714` 滚轮缩放步长限幅
~~~js
zoomViewBy(Math.exp(THREE.MathUtils.clamp(wheelDelta*.0018,-1.5,1.5)));
~~~
语义：单次滚轮最多 ±1.5 指数步长（防一滚到天边）。判定：**【操作手感 → 保留】**。现状：仍在。补丁：无。

#### G15 `index.html:226` 禁止页面缩放
~~~html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
~~~
语义：移动端不能双指放大，看不清飞剑细节/文案。判定：**【人为限制 → 放宽】**。现状：仍在。
补丁：`content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover"`。HTML：是；CSS：若全局写了 `touch-action:none` 需同步放开（`style.css` 触摸处理）。

#### G16 `index.html:565` 赏剑准星默认隐藏
~~~html
<div id="look-reticle" class="look-reticle" hidden></div>
~~~
语义：准星仅在赏剑/自由观察时显示。判定：**【UI 状态 → 保留】**。现状：仍在。补丁：无。HTML：否。

### H. 启动门槛（qingyuan-loading.js）与资源清单

#### H1 `qingyuan-loading.js:10,102-124` 串行注入所有 `data-startup` 资源，任一失败即整体失败
~~~js
const sources = [...document.querySelectorAll('script[data-startup][src]')];
async function start(){ … for(const source of sources){ … await loadElement(script, source.dataset.startup); } }
~~~
语义：three、vision-bundle、hand-wasm、unlock-core、unlock-ui、private-unlock、invitation、author-promo、sfx-bank、app.js 全部按序注入；任何一个 60s 失败 → `fail()` 进错误页，**游戏彻底进不去**。判定：**【启动门槛 → 改分级】**。现状：仍在。
补丁：把 sources 分为 required（three/vision/app）与 optional（unlock/invitation/author-promo/sfx），optional 失败只 `console.warn` 不 `fail`。HTML：是（给可选脚本加 `data-optional`）。

#### H2 `qingyuan-loading.js:42-52,95-98` `fail()` 进错误页并锁死
~~~js
function fail(error, message = '游戏未能加载完成，请检查网络后重试。'){ … }
window.addEventListener('error',event => { if (sources.some(source => source.src === event.filename)) { fail(…); } });
~~~
语义：错误页只有「重试」（`location.reload`，按钮在 `index.html:544-551`），没有「跳过继续」。判定：**【启动门槛 → 改分级 + 跳过按钮】**。现状：仍在。补丁：error 页加「仍然进入（功能可能缺失）」。HTML：是。

#### H3 `qingyuan-loading.js:81-94` 单资源 60 秒超时
语义：`loadElement` 对每个 script/style 设 60000ms 超时 → reject → fail（`sfx-bank` 6.6MB 在慢盘/慢网下确实可能久）。判定：**【启动门槛 → 缩短可选资源超时】**。现状：仍在。补丁：可选资源 8s 后跳过。无需 HTML/CSS。

#### H4 `qingyuan-loading.js:26-33` 20 秒后显示「加载时间较长」
语义：只提示，不改变行为（不会自动跳过）。判定：**【提示 → 保留】**。现状：仍在。补丁：无。

#### H5 `qingyuan-loading.js:11,18-23,68` 启动期 capture 拦截全部输入
~~~js
const guards = ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','touchend','click','dblclick','contextmenu','wheel','keydown','keyup'];
window.addEventListener(name,blockInput,{capture:true,passive:false});
~~~
语义：ready 前所有输入被 `preventDefault+stopImmediatePropagation`；ready（`L67-68`）后移除。判定：**【防误触 → 保留】**（但应放行 F5/F12 与开发者快捷键）。现状：仍在。补丁：`blockInput` 里加 `if(event.type==='keydown'&&['F5','F12'].includes(event.key))return;`。无需 HTML/CSS。

#### H6 `index.html:2,229-231` `is-booting` 隐藏舞台
~~~html
<html lang="zh-CN" class="is-booting">
html.is-booting #app-stage{visibility:hidden;pointer-events:none}
~~~
语义：加载期间整个 canvas 不可见不可点（配合 loading 屏）。判定：**【启动机制 → 保留】**。现状：仍在。补丁：无（`loading.js:67` ready 时移除 `is-booting`）。

#### H7 `index.html:534-537` 手部资源 preload 全部 `media="not all"`
~~~html
<link rel="preload" as="fetch" id="hand-model-resource" href="./assets/hand/hand_landmarker.task" media="not all" crossorigin>
<link rel="preload" as="fetch" id="hand-model-binary-resource" href="./assets/hand/hand_landmarker.bin" media="not all" crossorigin>
<link rel="preload" as="fetch" id="hand-wasm-simd-resource" href="./assets/hand/vision_wasm_internal.wasm" media="not all" crossorigin>
<link rel="preload" as="fetch" id="hand-wasm-basic-resource" href="./assets/hand/vision_wasm_nosimd_internal.wasm" media="not all" crossorigin>
~~~
语义：不真正预加载（`media="not all"`），只作为 URL 清单供 `app.js:4974-4978` 的 `HAND_ASSET_LINKS` 读取。判定：**【设计取巧 → 保留】**。现状：仍在。补丁：无；但 `.task` 文件不存在，见 H8。

#### H8 `app.js:4969-4993` 手部资产路径 / 完整性 / 远程回退
~~~js
const HAND_ASSET_PATHS=Object.freeze({
  'hand-wasm-simd':'./assets/hand/vision_wasm_internal.wasm',
  'hand-wasm-basic':'./assets/hand/vision_wasm_nosimd_internal.wasm',
  'hand-model-data':'./assets/hand/hand_landmarker.task'
});
const HAND_ASSET_INTEGRITY=Object.freeze({
  'hand-wasm-simd':{size:9207793,sha256:'e3945f00…'},
  'hand-wasm-basic':{size:9074428,sha256:'d832736b…'},
  'hand-model-data':{size:7819105,sha256:'fbc2a300…'}
});
~~~
语义：模型声明为 `.task`，但 `assets/hand/` 里实际只有 **`hand_landmarker.bin`（7819105B，与 integrity 表一致）**；`readHandAsset` 会把 `.bin` 追加为第二候选，所以能跑，但属隐式兜底。判定：**【资源清单不一致 → 建议显式修正】**。现状：`app.js` 侧仍在（HTML 侧 `index.html:534` 已被并行实现者改成 `.bin`，两边不一致）。
补丁：`'hand-model-data':'./assets/hand/hand_landmarker.bin'` 并同步 `index.html:534` 的 href（或补放 `.task` 文件）。HTML：是；CSS：否。

#### H9 `app.js:4984-4992` 本地失败后打三个公网 CDN
~~~js
'hand-wasm-simd':['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_internal.wasm',
  'https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_internal.wasm'],
'hand-model-data':['https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task']
~~~
语义：离线环境会尝试公网 → 每个 25s 超时，最坏 ~75s 才落到 `LOCAL_ASSET` 错误；但这是**手势开启时**（运行时）才发生，不阻塞启动。判定：**【降级链 → 建议本地优先且可关】**。现状：仍在。补丁：本地镜像场景把远程列表清空（避免 25s×N 等待）。无需 HTML/CSS。

---

## 3. 补丁落地（old → new）

### 3.1 已由并行实现者应用（本次审计确认）
| 文件:行号 | old | new | 评价 |
|---|---|---|---|
| `index.html:224` | `window.location.replace(…原平台…)` | 注释掉整段 | ✅ 正确，建议连注释一起删 |
| `index.html:538` | `<script id="platform-toy-sdk" …>` | 注释「不加载 SDK」 | ✅ 正确 |
| `index.html:613,645,646,647` | 默认可见 | `style="display:none"` | ⚠️ 治标：DOM 仍占位、脚本仍加载、`unlock-ui` 仍写文案，建议直接删 |
| `index.html:815` | 任务解锁说明 | 「完整解锁版」说明 | ✅ 正确 |
| `index.html:603` | 「雷电已关闭 · 完成任务后可开启」 | 「雷电已关闭 · 可随时开启」 | ✅ 正确 |
| `qingyuan-unlock-core.js:82` | `let privateUnlocked=false` | `true` | ✅ 有效，但属隐式全开，建议 `isUnlocked→known.has` 硬编码 |
| `qingyuan-unlock-core.js:253-263` | 校验 ad/60s/eligible | 直接 add features | ✅ 正确 |
| `qingyuan-unlock-core.js:286-292` | 回收 dragon features | 不回收 | ✅ 正确 |
| `qingyuan-unlock-core.js:309-311` | 清除 privateUnlocked | `return false` | ✅ 正确 |
| `qingyuan-unlock-core.js:75` | 任务文案 | 全解锁文案 | ✅ |
| `qingyuan-unlock-ui.js:9` | 无空值保护 | 加 `overlay` 判空 | ✅ 必要（否则删 overlay 后崩） |
| `qingyuan-toy-bridge.js:12-14` | 平台判定 | `STANDALONE=true` → `isPlatformPage()=false` | ✅ 正确 |

### 3.2 仍需落地（按优先级）
| 优先级 | 文件:行号 | old → new | HTML/CSS 联动 |
|---|---|---|---|
| P0 | `app.js:6462` | 若删 author-promo，`window.QingyuanAuthorPromo.isOpen` 会 TypeError → `window.QingyuanAuthorPromo?.isOpen===true` | 否 |
| P0 | `index.html:822,887,888` | 删 author-promo / private-unlock / invitation 三个 script 标签 | 是（删对应 overlay DOM） |
| P1 | `app.js:4198,4224,4253,4276,4291,4324,5121,6329` | 删 `has/require` 判断 | 否 |
| P1 | `app.js:6549-6555` | 删 `onChange` 内 7 行强制关闭 | 否 |
| P1 | `qingyuan-unlock-ui.js:71-84,205,250-252` | 删 `applyLocks` 与 capture 监听；`window.QingyuanUnlocks` 改 stub | CSS：删 `911-912` |
| P2 | `app.js:346` | `enabled=false` → `enabled = saved?.enabled===true`，`save()` 写 `{volume,enabled}` | 否 |
| P2 | `app.js:4236` + `index.html:577` | `fxPanel.open=true` / `<details … open>` | 是 |
| P2 | `index.html:226` | `maximum-scale=5.0, user-scalable=yes` | 是 |
| P2 | `app.js:574` | 上限 1.8/1.35 → 2.0 | 否 |
| P2 | `app.js:578,673` | 阴影按性能判定，手机也开 1024 | 否 |
| P2 | `app.js:5333-5337` | 删限帧块或 `1000/60` | 否 |
| P2 | `app.js:5074` | 先 GPU 后 CPU | 否 |
| P2 | `app.js:5247` | `handInterval=16`（GPU） | 否 |
| P3 | `app.js:4809-4813` | 1280×720@30/60 | 否 |
| P3 | `app.js:5065` | `numHands:2` | 否 |
| P3 | `app.js:4969-4993` | `.task` → `.bin`，清空远程 CDN 列表 | 是（H7 href） |
| P3 | `qingyuan-loading.js:102-124` | 可选脚本失败不 fail | 是（`data-optional`） |

---

## 4. 风险与回归检查清单

1. **删 `qingyuan-author-promo.js` 前必须处理 `app.js:6462` 与 `6498-6509` 的 setHooks 无判空引用**（`window.QingyuanAuthorPromo.isOpen` 没有 `?.`），否则控制台 TypeError。
2. **删 `qingyuan-unlock-ui.js` 前必须给 app.js 提供 `window.QingyuanUnlocks` stub**（`app.js:14` 直接取全局；`activate` / `setHooks` 都调用它）。最小 stub：`{has:()=>true, require:()=>true, subscribe(){}, isOpen:false, snapshot:()=>({unlocked:[]}), setHooks(){}, activate(){}}`。
3. **`privateUnlocked=true` 是隐式全开**：以后任何人把该行改回 false 就会立刻恢复全部门禁 → 若要「取消限制」长期成立，改成 `isUnlocked(){return known.has(id);}` 并删 `privateLock`。
4. **摄像头仍需安全上下文**：`127.0.0.1:8123` 可用（localhost 视为安全）；若改用 `file://` 打开，Chrome 不允许 `getUserMedia`，且 `crypto.subtle` 校验会走 F4 失败路径 → 保留静态服务器。
5. **`.task` 缺失是定时炸弹**：若 integrity 表或候选逻辑被改，手势会直接 `LOCAL_ASSET` 失败。建议按 H8 显式改 `.bin`。
6. **手势 CPU 推理 + 12.5fps 节流是「手感差」主因**，与解锁无关；E9/F8 不修的话「取消所有限制」仍有明显体感差距。
7. **回归验证命令**：
   - `grep -n "unlocks\.\(has\|require\)" qingyuan/assets/js/app.js` → 应为 0 或仅剩玩法级联（B 类）；
   - `grep -rn "is-feature-locked\|data-unlock-feature" qingyuan/assets/css qingyuan/assets/js` → 应只剩待删项；
   - `grep -n "window.self===window.top\|platform-toy-sdk\|expectedPassword" qingyuan/index.html qingyuan/assets/js/*.js` → 应为 0；
   - 打开 `http://127.0.0.1:8123/` 无跳转、F12 无红色报错、底部六个招式直接可点、点「开启手势控制」直接弹摄像头授权。

---

## 5. 统计

- **限制项总数：124**（A 46 / B 9 / C 6 / D 10 / E 12 / F 16 / G 16 / H 9）。
- **应彻底移除的营销/解锁型：49 项**（A 类 46 项全部 + C1/C2/C3 三处会话清理）。
- **建议保留的核心玩法/性能/平台参数：B 类 9 项 + E/G/H 中多数共约 60 项**（详见各条「判定」）。
- **已由并行补丁部分或完全解除：约 15 项**（A1/A2/A3/A4/A5/A6 部分/A7 部分/A11/A15/A16/A23/A25/A26/A28/A45 部分，以及各 C 类因被调函数退化而失效）。
- **完全未处理的高影响项**：H1/H2（启动失败即卡死）、E5（全屏限帧 30/45）、E9+F8（手机 CPU + 12.5fps）、G8（每次静音）、G15（禁止缩放）、B7（灵力面板默认收起）、F6（只手数 1）、E4（全屏压像素比）。
- **行号可 grep 性**：A1–A46 中引用的现行行号（A8 之后 `app.js`、`style.css`、`private-unlock.js`）与基线行号（`index.html` / unlock 组件）均已用上表命令复核过；未改文件（`app.js`、`style.css`、`loading.js`、`private-unlock.js`、`invitation.js`、`author-promo.js`）行号即现行文件行号。

