# 青元剑诀 · 本地复刻（完整解锁版）

> 原版：B站 Toy「视觉手势操控！凡人修仙传《青元剑诀》御剑模拟器！」
> 原地址：https://www.bilibili.com/toy/mtTbBr9KP4X1AIbM/index.html
> 本地版：Three.js r128 + MediaPipe HandLandmarker 单页应用，全部资源离线，双击即玩。

## TL;DR

| 项目 | 状态 |
|---|---|
| 启动方式 | 双击 `启动游戏.command`，浏览器自动打开 http://127.0.0.1:8123/index.html |
| 10 项剑诀功能 | **全部默认解锁**，随时可开（赏剑 / 大庚 / 巨剑 / 莲花 / 辟邪神雷 / 神雷化形 / 流云剑气 / 剑影分光 / 手势控制 / 灵力调节） |
| 关注 / 邀请 / 三连 / 看广告 | 全部移除，无需任何操作，无倒计时、无校验、无外部跳转 |
| B站 Toy SDK | 已移除，摄像头改走浏览器原生 `getUserMedia` |
| 防盗链跳转 | 已移除（原版检测到"不在 B站 iframe 内"就 `location.replace` 回 B 站，本地版删掉了这一步） |
| 联网需求 | **零外部请求**：模型、wasm、音效、贴图全在本地（已用无头浏览器验证） |
| 体积 | 约 34 MB（assets），完整目录 67 MB（含验收工具依赖） |

## 一、怎么跑

1. 双击 `启动游戏.command`（第一次可能被 macOS Gatekeeper 拦：右键 → 打开）。
2. 浏览器打开 http://127.0.0.1:8123/index.html ，等加载条走完即进入。
3. 手动起服务（等价）：
   ```bash
   cd qingyuan && python3 -m http.server 8123 --bind 127.0.0.1
   ```
   Windows：`python -m http.server 8123`，然后访问 http://127.0.0.1:8123/ 。
4. 手势控制：点左上"开启手势控制" → 允许摄像头。**必须用 127.0.0.1 或 localhost 访问**（浏览器只在这两种地址下把 http 当安全上下文，局域网 IP 会拿不到摄像头）。

> 别用 `file://` 直接打开 index.html：wasm / 模型 / 音效会被 CORS 拦掉。

## 二、解除了哪些限制

| # | 原版限制 | 原版行为 | 现在的行为 | 改动位置 |
|---|---|---|---|---|
| 1 | 防盗链跳转 | 页面不在 B站 iframe 内时立即 `window.location.replace` 回 B站原页，本地根本进不去 | 已删除 | index.html:224 |
| 2 | 关注作者解锁 | 关注"灰森森森"才解锁 大庚剑阵/巨剑术/莲花剑阵 | 默认解锁 | assets/js/qingyuan-unlock-core.js:82 |
| 3 | 推广倒计时解锁 | 点 UP主推广弹窗等待 5 秒才解锁 辟邪神雷/神雷化形（且仅本次进入有效） | 默认解锁、常驻不回收 | qingyuan-unlock-core.js:82,286 |
| 4 | 三连解锁 | 给 BV1d44q6YEGK 一键三连才解锁 流云剑气/剑影分光；任意 2 条视频三连才解锁 手势控制/灵力调节 | 默认解锁 | qingyuan-unlock-core.js:82,253-262 |
| 5 | 邀请好友解锁 | 成功邀请 1 名好友才解锁 赏剑模式 | 默认解锁 | qingyuan-unlock-core.js:82 |
| 6 | 私测密码 | 需在操作说明里输 8 位密码才能全开 | 已删掉密码入口，启动即全开 | index.html:817-824（原块已删除） |
| 7 | 解锁按钮/入口 | 首页"解锁任务 0/5"、邀请好友、UP主推广三个入口 | 全部 `display:none` 隐藏（DOM 保留，代码引用不报错） | index.html:613,645,646,647 |
| 8 | B站 Toy 摄像头授权 | 判定为平台页时摄像头必须走 `window.toy.requestCamera`，本机没有 SDK 就直接报 TOY_SDK_UNAVAILABLE | 强制判定为非平台页，走浏览器原生 `getUserMedia` | assets/js/qingyuan-toy-bridge.js:12-14 |
| 9 | B站 Toy SDK 脚本 | 每次打开都从 `s1.hdslb.com` 拉 SDK | 已移除该 script | index.html:538 |
| 10 | 任务校验链路 | 每 30 秒调 B站接口核验关注/三连/邀请，失败就提示"无法核验" | 校验整体短路，任何入口直接解锁 | qingyuan-unlock-core.js:253-262 |
| 11 | 模型 404 | 手部模型原先固定读 `hand_landmarker.task`（服务器已 404，靠远程兜底） | 本地直接指向 `.bin`，零 404、零远程回退 | index.html:534, assets/js/app.js:4972 |
| 12 | 解锁相关文案 | 说明里写"完成任务才能解锁" | 改写为"完整解锁版"说明 | index.html:815 |

补充：`assets/js/qingyuan-unlock-ui.js:9` 的 `isAdVisible` 加了判空（原版在推广弹窗 DOM 缺失时会抛异常）。

## 三、玩法速查

| 操作 | 效果 |
|---|---|
| 移动鼠标 / 单指滑动 | 御剑（静止收束为本命青竹剑） |
| Q / R / E / T / F / G | 莲花剑阵 / 青元剑盾 / 大庚剑阵 / 巨剑术 / 神雷化形 / 剑影分光（按一次开、再按一次关） |
| 1 / 2 / 3 / 4 | 分光 / 辟邪神雷 / 流云剑气 / "关后"保留 72 主剑 |
| H | 赏剑模式（拖动旋转、滚轮缩放） |
| WASD + 空格/Ctrl + Shift | 飞行移动（空格上升、Ctrl 下降、Shift 两倍速） |
| V / C | 自由视角 / 视角复位 |
| 鼠标中键 或 Alt+左键拖动 | 360° 环视 |
| F1 | 操作说明 |
| 底部招式按钮 | 触屏 / 鼠标直接点，均可自由开关 |

手势（点"开启手势控制"后）：剑指=御剑、五指张开=莲花、握拳=剑盾、食指+小指=大庚、L/八字手=巨剑术。

## 四、改动清单（文件级）

| 文件 | 改了什么 |
|---|---|
| `index.html` | 删防盗链跳转；删 Toy SDK 外部脚本；隐藏 3 个解锁/推广入口与"解锁任务"菜单项；删除私测密码块；手部模型改指 `.bin`；改写解锁说明文案 |
| `assets/js/qingyuan-toy-bridge.js` | 新增 `const STANDALONE = true`，`isPlatformPage()` 直接返回 false |
| `assets/js/qingyuan-unlock-core.js` | `privateUnlocked` 默认 true；`claim()` 直接解锁；`privateLock()` 变空操作；`resetAdSession()` 不再回收辟邪神雷/神雷化形 |
| `assets/js/qingyuan-unlock-ui.js` | `isAdVisible` 判空 |
| `assets/js/app.js` | 手部模型路径 `.task` → `.bin`（4972 行） |
| `启动游戏.command` | 新增：自动找端口、起静态服务、打开浏览器 |
| `tools/shot.mjs` | 新增：Edge 无头验收脚本（加载状态 / 控制台错误 / 截图） |
| `README.md` | 本文件 |

原版备份：`git` 基线 commit `86b9b3c baseline: original mirror`，随时 `git diff` 对照。

## 五、与原版的差异（保留了什么）

- 视觉、场景、建筑、剑阵、音效、手势识别模型：全部 1:1 原样保留。
- 招式依赖照旧：**神雷化形仍需先开"辟邪神雷"**（这是招式链设计，不是解锁限制，故未改）；"关后"开关、画质 精致/流畅 等原版设置都保留。
- 音效默认静音（原版设计如此，每次进入从静音开始），点左下"音效：关"切换。
- 画面四角的"B站 · 灰森森森"是原作者署名水印，未删。

## 六、已知限制与风险分级

| 级别 | 说明 | 处置 |
|---|---|---|
| 🟡 | 摄像头只在 `127.0.0.1` / `localhost`（或 HTTPS）下可用；用局域网 IP 打开会提示"页面不允许申请摄像头" | 用启动器给出的地址访问 |
| 🟡 | macOS 首次双击 `.command` 可能提示"无法验证开发者" | 右键 → 打开，或 `chmod +x` 后从终端运行 |
| 🟡 | 手势识别吃 GPU/CPU，集显老机器可能掉帧 | 用"画质 · 流畅"，或改用键鼠 |
| 🟢 | 远程兜底 CDN（jsdelivr / unpkg / storage.googleapis）仍在代码里作最后手段 | 正常离线使用不会触发；本地资源已齐全 |
| 🟢 | 原版隐藏的解锁面板 DOM（`#unlock-overlay` 等）仍在页内但无入口 | 保留是为了不让 `app.js` 引用报错，不影响使用 |

## 七、验收记录

无头 Edge（SwiftShader WebGL）实测：

- 启动页正常结束，canvas 1440×900 正常渲染，`window.QingyuanUnlocks` 就绪；
- `unlocked = 10/10`，`privateUnlocked = true`，逐项 `has()` 全为 true；
- 逐个点击底部招式按钮：巨剑术、剑影分光、关后、辟邪神雷全部可开关，无 console error、无 pageerror；
- 摄像头通路：`contextState=普通浏览器 · 安全访问检查`、`streamState=摄像头已开启`、`modelState=手势识别已就绪 · 加速模式`、`errorCode=无`；
- 网络：除 127.0.0.1 外**零外部请求**；静态服务无 404（修掉 `.task` 后）。

截图见 `screenshots/`。

## 八、来源与使用声明

本目录是原游戏的离线镜像 + 去限制改动，仅作个人学习、离线体验与前端技术研究；游戏内容、模型、美术、音效版权归原作者（B站 UP主 灰森森森）所有，请勿二次分发或商用。
