# 《青元剑诀》本地版 · 改进提案报告

> 快照基准：2026-11-14 15:39–15:40，工作区当时状态为 **app.js 6535 行 / md5 ac36bfd7…**、**index.html 508 行 / md5 7319b743…**、README 138 行。行号均在该快照上用 \`grep -n\` / \`sed -n\` 逐条核过；工作区正被另一代理做本地化收尾（未提交改动），提交后行号可能漂移，引用前请复核。
> 分析方式：只读走查 + 既有 \`analysis/limits.md\`（124 条限制点审计）对照；未运行会写文件的 \`tools/shot.mjs\`（\`shots/\` 下的记录由既有验收产生），除本文件外未改任何文件，未动 8123 端口服务。
> 风险分级：🟢 低（局部、可回滚）｜🟡 中（跨函数/需回归）｜🔴 高（结构性、缺测试网）。

## 一、总览

| # | 提案 | 分组 | 收益 | 工作量 | 优先级 |
|---|---|---|---|---|---|
| A1 | 滚轮/捏合缩放加阻尼并统一标定 | 手感 | 高 | 低 | P0 |
| A2 | 视角灵敏度、Y 反转、锁定设置化 | 手感 | 中 | 低 | P2 |
| A3 | 手势识别个人校准 + 更快确认 | 手感 | 高 | 中 | P0 |
| A4 | 键位去重与可重绑 | 手感 | 中 | 低中 | P2 |
| B1 | 剑意值/连击：给自由飞行一个目标 | 玩法 | 高 | 中 | P2 |
| B2 | 首启 3 步引导 | 玩法 | 中 | 低 | P1 |
| B3 | 设置持久化（现在只存音量） | 玩法 | 中 | 低 | P0 |
| C1 | 画质档做实：三档联动粒子/轨迹 | 视觉 | 高 | 中 | P2 |
| C2 | 曝光/亮度可调 | 视觉 | 中 | 低 | P2 |
| C3 | 赏剑场景氛围与拖拽惯性 | 视觉 | 中 | 低中 | P2 |
| C4 | 减少动效/护眼开关 | 视觉 | 中 | 低 | P3 |
| D1 | FPS 采样 + 自适应分辨率 | 性能 | 高 | 中 | P1 |
| D2 | 启动拆包：音效库/手势运行时懒加载 | 性能 | 高 | 中 | P0 |
| D3 | WebGL 上下文丢失自动恢复 | 性能 | 中 | 低 | P2 |
| D4 | 移动端手势改 GPU 优先、可回退 | 性能 | 中 | 中 | P3 |
| E1 | 6600 行单文件拆 ESM 模块 | 工程 | 高 | 高 | P3 |
| E2 | 清理死代码与恒真解锁门禁 | 工程 | 中 | 低 | P1 |
| E3 | 把验收脚本接成一条命令 | 工程 | 中 | 低中 | P1 |
| E4 | 运行时错误兜底与调试钩子 | 工程 | 中 | 低 | P2 |

## 二、A 手感与操控

**A1 · 滚轮与捏合缩放加阻尼、统一两套标定**
- 现状：滚轮主视图用 \`exp(clamp(deltaY*.0018,-1.5,1.5))\`（assets/js/app.js:4665-4676），赏剑用 \`exp(deltaY*.0013)\`（同段 4669）；事件直接乘到 \`STATE.zoomFactor\`（app.js:4474-4477），每帧在 app.js:5445 直接取 \`lastBaseViewDistance*zoomFactor\`，无目标值、无过渡；双指捏合在 app.js:4493 同样直接生效。
- 改法：新增 \`STATE.zoomTarget\`（初值同 zoomFactor），wheel/pinch 只改 zoomTarget（沿用 4477 的 clamp）；\`animate\` 里按 \`zoomFactor += (zoomTarget-zoomFactor)*(1-exp(-12*delta))\` 追赶；两套系数归一到统一灵敏度，\`resetCameraView\`（app.js:4377-4381）同步重置 zoomTarget。
- 收益：滚轮不再"一格一跳"，远景到近景的中间态可停住，微调成功率明显上升；过渡约 100–150ms 的"镜头呼吸感"。
- 风险/工作量：🟢 低，约 20–30 行。风险是阻尼带来轻微滞后，clamp 下限/上限必须保留，否则会撞穿近裁剪面。

**A2 · 视角灵敏度、Y 反转与锁定做成设置**
- 现状：\`rotateLookBy\` 固定 \`yaw-=dx*.0032\`、\`pitch-=dy*.0028\`，俯仰 clamp ±(π/2-.06)（app.js:4332-4338）；\`updateLookControl\` 固定 20/s 阻尼（app.js:4354-4358）；指针锁已支持（app.js:4383-4391），但没有灵敏度滑条、没有 Y 轴反转、设置不落盘。
- 改法：新增 \`STATE.look.sensitivity\`（0.4–2.5）与 \`invertY\`，在 4332-4338 乘算、按开关取反；在灵力调节面板照现有滑条模式（app.js:4196-4218）加两个控件；与 B3 的设置 schema 一起持久化。
- 收益：不同 DPI/触控板/手机握持下都能调到"顺手"，减少一甩视角就过头的挫败感。
- 风险/工作量：🟢 低。注意触摸拖拽也走同一函数，乘算要同时覆盖鼠标与触摸两条路径。

**A3 · 手势做"个人校准 + 更快确认"**
- 现状：\`classifyHandGesture\` 全是硬阈值：拇指 \`thumbAngle>136\`（app.js:5126）、四指 \`fullAngle>138\`（app.js:5134）、OK 印 \`pinchDist<0.36\`（app.js:5142）；palmSize 只用于归一（app.js:5117）；坐标固定 \`(norm-.5)*1.55+.5\` 扩张（app.js:5251-5252）；识别窗口 6 帧（app.js:4763）、需 3 票（app.js:5233），GPU 下每 33ms 推理一次（app.js:5206）；全文无 calibrat/校准逻辑。
- 改法：加一个 3 步校准（平掌、剑指、握拳各保持 1 秒），记录 palmSize 与各阈值均值±σ，把 5126/5134/5142 改成"用户值优先、缺省回退硬编码"；1.55 扩张改为按校准得到的手部活动范围做 min/max 映射；投票窗口 6→4、票数 3→2，并让最近一帧权重翻倍；摄像头面板（index.html:425 \`webcam-status\`）显示当前识别结果与票数，方便自查。
- 收益：切招"切不出/误切"的比例下降，确认延迟约从 3×33ms+推理降到 2×33ms+推理（约 -50ms）。
- 风险/工作量：🟡 中。校准 UI 与状态机新增，阈值回归需用人手实测；建议保留"跳过校准"入口，默认仍可用。

**A4 · 键位去重、收敛语义并可重绑**
- 现状：KeyG 与 Digit1 都触发分光（app.js:4642、4644-4645）；KeyF 同时出现在 \`keyboardFormations\`（app.js:4580）和神雷化形分支（app.js:4652-4653）；Escape 在 4629-4631 / 4636 / 4655 三处含义不同；键位只写在代码与剑谱里（index.html:466 起），不可改。
- 改法：抽一张 \`KEY_BINDINGS\`（动作 → e.code 数组），keydown（app.js:4626）只查表分发；去掉 G/1、F 的重复绑定；新增"按键设置"面板（点击条目后录 e.code），冲突高亮并拒绝保存；同一份表同步刷新剑谱文案（index.html:466-500）。
- 收益：误触减少，左手/触控板用户可自定义；也为将来加键位说明提供单一数据源。
- 风险/工作量：🟢 低-中。改动集中，但需覆盖飞行键组（app.js:4590-4625）与提示文案，漏一处会出现"按了没反应"。

## 三、B 玩法与内容

**B1 · 剑意值/连击：给自由飞行一个轻目标**
- 现状：全文无 score/combo/achievement/计分（grep 仅误中 \`lotusCoreLight\`）；HUD 铭牌只显示模式与剑数（\`updateHUD\` app.js:4113-4153；DOM 见 index.html:402-416）；已有 \`showSkillToast\`（app.js:4102）可复用提示。
- 改法：每帧按 \`STATE.flight.velocity.length()\` 与招式切换累计"剑意"，连续高速飞行/连续结阵形成 combo；在铭牌标题行加"剑意 1234 · 连击 x3"；每 5000 分用 showSkillToast 报里程碑；不设血量、失败与敌人。
- 收益：给"再飞一圈"的动机，不改变观赏定位；也让现有招式切换有反馈闭环。
- 风险/工作量：🟡 中。数值需试；移动端 HUD 空间紧（style.css:588-591 已有移动端铭牌布局），要控制行高。

**B2 · 首启 3 步引导（coach mark）**
- 现状：完整剑谱 8 节藏在 \`#game-guide-overlay\`（index.html:466 起，默认 hidden），入口只有 F1（app.js:6434）与按钮（app.js:6445）；无"首次已读"标记（localStorage 仅两处：app.js:351/355）。
- 改法：监听 loading.js 的 \`qingyuan-ready\`（assets/js/qingyuan-loading.js:69）后，首次弹 3 张卡：①拖拽引剑 ②滚轮/双指缩放 ③G 分光、Q/R/E/T 结阵、F1 剑谱；"不再提示"写 \`qingyuan-onboard-v1\`；引导期间复用 openGameGuide 的暂停输入逻辑（app.js:6422-6431）。
- 收益：新玩家前 30 秒知道能做什么，显著减少"点了没反应"的误判。
- 风险/工作量：🟢 低。样式复用现有 overlay，注意与"仅本机安全上下文才能开摄像头"的提示顺序。

**B3 · 设置持久化（现在只存音量）**
- 现状：localStorage 只有 \`qingyuan-sound-v1\`，且只存 volume（app.js:351-355，注释明确每次启动保持静音）；画质档（app.js:585）、灵力滑条（app.js:4196-4218）、UI 窗口显隐（app.js:6405）、视角参数、招式偏好全不落盘。
- 改法：引入 \`qingyuan-settings-v1\`（带 version 的默认值合并），统一 get/set；持久化画质、音量、曝光（C2）、灵敏度（A2）、UI 窗口、减少动效（C4）；保留"每次启动从静音开始"的刻意设计，只恢复音量，不改 352-353 的注释语义。
- 收益：刷新/重进不重调，尤其手机横竖屏切换、误刷新后体感连续。
- 风险/工作量：🟢 低。边界值要 clamp；localStorage 损坏时照 351-355 的 try/catch 回退默认。

## 四、C 视觉与表现

**C1 · 画质档做实：三档并联动粒子/轨迹**
- 现状：\`renderQuality\` 只有 ultra/balanced 两档（app.js:585），\`syncRenderPerformance\` 只改 pixelRatio 上限 1.8/1.0 与阴影开关（app.js:598-621）；spirit 粒子恒 240（app.js:1354）、轨迹恒 680 段（\`pathHistoryLength\` app.js:235）、主剑 72/剑影 288（app.js:230-236）都不随画质变化。
- 改法：三档——精致（现状）、均衡（pixelRatio 1.35、阴影开）、流畅（1.0、阴影关、spirit 120、轨迹生效长度 420、关闭剑影 glow 的一层）；把档位影响集中成 \`applyQualityProfile()\`，由 syncRenderPerformance 调用；移动端默认均衡（现为 balanced，可沿用）。
- 收益：老集显/手机可用帧率提升；1.8→1.0 的像素量差 3.24×，是当前最便宜的 GPU 杠杆。
- 风险/工作量：🟡 中。需要回归各阵型的观感，288 道剑影是核心卖点，流畅档也要保住"剑流"的体量感。

**C2 · 曝光/亮度可调 + 默认值微调**
- 现状：\`toneMappingExposure\` 固定 1.04（app.js:577），全文件没有第二个曝光入口（grep exposure 仅 577）；雾密度动态（app.js:5384）但整体亮度不可调，暗环境下夜景层次容易糊。
- 改法：在灵力调节面板加"画面亮度"滑条（0.85–1.25），映射 toneMappingExposure，默认 1.04；随 B3 持久化；可选按画质档自动 -0.02。
- 收益：不同屏幕亮度/环境光下可读性提升；也方便截图/录屏时压高光。
- 风险/工作量：🟢 低。限制范围即可，ACES 色调映射下过曝会发灰。

**C3 · 赏剑场景氛围与拖拽惯性**
- 现状：赏剑是独立场景，背景纯色 \`#0a1019\`（app.js:6220），仅三盏平行光+半球光（app.js:6224-6227）与底座光环；拖动直接改 yaw/pitch、系数 .008（app.js:6271-6275），松手立刻停；不拖时按 spinRPM 自转（app.js:6299）。
- 改法：加低亮渐变天幕/星尘（可借鉴主场景 starField 做法，app.js:713-719）与轻微 rim 呼吸；拖动改为"角速度 + 阻尼"，松手后按速度衰减 1–2 秒；增加"自动旋转"开关，默认关闭以便截图。
- 收益：赏剑是分享/截图的入口，氛围与惯性直接提升"把玩感"，也更能展示剑身材质。
- 风险/工作量：🟢 低-中。只动 inspectionScene 与输入，不影响主场景与阵型。

**C4 · 减少动效/护眼开关（含 prefers-reduced-motion）**
- 现状：大庚施法有全屏 flash（app.js:2636，峰值 opacity .32）与镜头震动（app.js:5420-5422）；app.js 全文无 matchMedia/prefers-reduced-motion，CSS 里只有加载动画的适配（assets/css/style.css:898、index.html:44）。
- 改法：读取 \`matchMedia('(prefers-reduced-motion: reduce)')\` 并合入设置项"减少动效"；开启时 flash 上限降到 .08、camShake 置 0、阵型入场镜头位移减半、赏剑自动旋转默认关。
- 收益：晕动敏感用户可玩；低端机也少一层全屏合成。
- 风险/工作量：🟢 低。纯分支开关，注意别把镜头位移减半做成"瞬移"。

## 五、D 性能与兼容

**D1 · FPS 采样 + 自适应分辨率**
- 现状：无 FPS 统计；\`performanceMode\`/\`handPerformanceMode\` 是死代码（app.js:615-620 恒置 false，4685 声明，5292-5296 分支永不进入），\`pixelBudget=Infinity\`（app.js:607），分辨率只由手动画质档决定。
- 改法：在 \`animate\`（app.js:5290-5296）维护 60 帧滑动平均 frameMs；低于 50fps 持续 2s 就在 ratio 上乘 0.85（下限 0.75），恢复 60fps 持续 5s 再回涨（滞回避免抖动）；\`?debug=1\` 时在角落显示 FPS/像素比，不参与 UI。
- 收益：老机器/高分屏自动稳住帧率，用户不用懂"点画质"；也为 C1 的档位提供数据依据。
- 风险/工作量：🟡 中。分辨率变化要避免每帧 setPixelRatio，需最小间隔 1s；与全屏切换（app.js:599 的 fullscreenActive）一起重算。

**D2 · 启动拆包：6.6MB 音效库与手势运行时懒加载**
- 现状：\`#qingyuan-sfx-bank\`（6.6MB）与 vision/wasm(128KB+406KB) 都标了 data-startup（index.html:299-301、505）；loading.js 第 10 行收集、115-122 行按顺序串行加载执行，即使默认静音（app.js:346-347）且不开手势也要先跑完；README 记录启动 11.8–13s。
- 改法：把 sfx-bank 与 vision/wasm 从 data-startup 列表移除（保留静态标签）；首次点"音效开关"或"开启手势控制"时动态插入 script 并 await，加载期按钮转圈（复用 loading.js:81-93 的 loadElement 超时逻辑）；音频解压本来已延迟到 \`unlock()\`（app.js:387、420），无需改。
- 收益：首屏少 ~7.2MB 脚本的解析/执行，估算启动 11.8s → 8–9s（需实测）；内存峰值下降，移动端首屏更稳。
- 风险/工作量：🟡 中。首次开启音效/手势会多 0.3–1s 等待，要有进度提示；不能引入任何外网请求，保持零外部依赖。

**D3 · WebGL 上下文丢失可恢复**
- 现状：\`webglcontextlost\` 只 preventDefault + 改 #mode-desc 文案（app.js:622-625）；无 \`webglcontextrestored\` 监听与重建/重载逻辑，驱动重置或切 GPU 后只能手动刷新。
- 改法：监听 restored：首次触发时 \`location.reload()\`（用 sessionStorage 计数防循环）；同时把 622-625 的文案改成"正在恢复…"；后续再评估原地重建 renderer/scene（成本高，不建议先做）。
- 收益：偶发黑屏可自愈，减少"只能关页面"的支持成本。
- 风险/工作量：🟢 低（重载方案）。若直接原地重建，需清理旧 renderer 的 canvas/事件/纹理，🟡 中高。

**D4 · 移动端手势推理：GPU 优先 + 可回退**
- 现状：\`delegates=isMobile||forceHandCPU?['CPU']:['GPU','CPU']\`（app.js:5033），移动端直接排除 GPU；\`recoverHandInference\` 一旦失败就把 forceHandCPU 永久置 true（app.js:5090-5096），不再回试 GPU。
- 改法：改为与桌面一致的 GPU 优先、失败自动降 CPU；把"重试 GPU"接到已有 camera-retry-button（app.js:6452-6454）；对明确不兼容的机型保留 UA/内存白名单强制 CPU。
- 收益：支持 GPU delegate 的手机推理延迟可降（经验值 2–4×，需实测），发烫与掉帧改善。
- 风险/工作量：🟡 中。部分机型 GPU delegate 会崩或输出异常，必须保留 CPU 兜底与日志，先在验收脚本里跑一轮。

## 六、E 工程与可维护性

**E1 · 6600 行单文件拆 ESM 模块**
- 现状：\`assets/js/app.js\` 6535 行，主逻辑全在一个 \`initQingyuanToy\`（app.js:2-6523）里，195 个 8 空格缩进的嵌套 function（全文约 232 处 function），无 import/export、无类型、无单测入口。
- 改法：按职责拆 scene/renderer、formations、gesture、audio、ui、inspection、controls 七个模块，用单一 state 对象注入；esbuild 打包回单文件，保持"双击即玩"；先机械搬迁不改逻辑，再逐块补 JSDoc 与 E3 的断言。
- 收益：定位 bug 的成本大幅下降，D2 的懒加载与 A3 的校准模块才有干净的落点。
- 风险/工作量：🔴 高。6535 行没有测试网，建议排在 D1/D2/E3 之后，分批（每批 <800 行）用 tools/shot.mjs 回归。

**E2 · 清理死代码与恒真解锁门禁**
- 现状：performanceMode 死分支（615-618、4685、5292-5296）、handPerformanceMode 恒 false（601、620）、pixelBudget 恒 Infinity（607）；unlock-core.js 已缩成 42 行恒真 stub（has/require 返回 true），app.js 仍有 11 处 has/require 门禁（4157、4183-4184、4212、4235、4250、4283、5080、6288、6480、6486-6492）与 QingyuanAuthorPromo/Invitation 可选链（6421）。
- 改法：把这些门禁与 setHooks 分支直接删掉（保留 unlock-core 空实现兼容），删除 performanceMode 分支与变量，保留可选链避免未定义报错；全屏相关判断同步收敛。
- 收益：少 ~100 行干扰路径，读代码时不再猜"这段会不会执行"，也是 E1 拆分的前置清障。
- 风险/工作量：🟢 低。删门禁时要保留 else 分支里的状态收敛（如 6489 的 fxPanel.open=false），逐个 diff 核对。

**E3 · 把验收脚本接成一条命令**
- 现状：\`tools/shot.mjs\` 890 行已能启动、统计非黑像素、收集 console/pageerror/requestfailed 并产出 JSON（README:99、123 引用；shots/ 下有运行记录），但没有根 package.json、没有 npm script，只能手敲长命令；且只验启动，不验交互（切阵/分光/音效/画质）。
- 改法：加根 package.json：\`"serve": "python3 -m http.server 8123 --bind 127.0.0.1"\`、\`"verify": "node tools/shot.mjs --url http://127.0.0.1:8123/index.html --report shots/report.md"\`；shot.mjs 增加 3 条交互断言（按 G 后 #mode-desc 含"分光已关闭"、按 Digit2 后 #toggle-lightning-btn 的 aria-pressed 变化、点音效后 #sound-status 变化），沿用现有 exit 0/1 约定（shot.mjs:673）。
- 收益：回归从"手动点"变"一条命令"，每次改动都有基线数字可对比。
- 风险/工作量：🟢 低-中。需处理端口占用与 Edge 路径（脚本已支持 --channel），首次跑通约半天。

**E4 · 运行时错误兜底与调试钩子**
- 现状：启动失败只有 initQingyuanToy 的 catch（app.js:6524-6529）；运行时异常无 window.onerror/unhandledrejection（仅 loading.js:95-100 覆盖启动脚本加载错误）；无 window.__QY、无 renderer.info/FPS，线上问题只能靠用户口述。
- 改法：加全局 error/unhandledrejection → console.error + showSkillToast("出现异常，可刷新重试")；\`?debug=1\` 时暴露 \`window.__QY={STATE,CONFIG,renderer,scene,swordAudio}\`；同条件显示 FPS/像素比小 HUD；错误计数写 localStorage 便于导出。
- 收益：问题可定位，用户能自助恢复；也为 E1/E3 提供观测面。
- 风险/工作量：🟢 低。调试钩子只在 query 参数下挂载，别出现在正式引导里。

## 七、如果只做 5 条（按收益/成本排序）

| 顺位 | 提案 | 理由 | 预估投入 |
|---|---|---|---|
| 1 | D2 启动拆包 | 首屏从 11.8s 级降到 8–9s 级，是最大单点体验杠杆 | 0.5–1 天 |
| 2 | A1 缩放阻尼 | 20–30 行换来立刻可感的镜头手感 | 0.5 天 |
| 3 | A3 手势校准 + 快投票 | 手势是核心交互，误切/延迟是最大差评来源 | 2–3 天 |
| 4 | D1 FPS 自适应 | 老集显/手机不再"一卡就只能降画质" | 1–1.5 天 |
| 5 | B3 设置持久化 | 低成本，把用户调好的东西记住 | 0.5 天 |

## 八、三个「不做」的坑

1. **不要把 renderWorldLayers 的三层渲染合并成单 pass。** 现状每帧最多 3 次 scene render（app.js:2915-2931）：layer0 主场景 → 清深度渲染 layer1 剑光 → 金龙可见时再清深度、换 \`dragonNeutralEnvironment\` 且关雾渲染。合并会破坏山峰遮挡、剑光叠加与金龙材质，省下的不到 1ms 远小于视觉回归；要降负载请走 D1/C1。
2. **不要加血量/敌人/战斗伤害系统把它改成动作游戏。** 代码里没有碰撞、受击、敌我框架与关卡，等于重写玩法；且与"御剑观景"的定位冲突。先做 B1 的轻量剑意值就够给目标感。
3. **不要继续扩充手势类别（更多结印）。** 现有 5 类阵型 + 剑指已靠 6 帧 3 票才稳定（app.js:4763、5233）；类别越多，窗口越长、误判越多。先把 A3 的 6 类做稳，再谈新类别。

## 附：核验与边界

- 行号核验：所有 \`文件:行号\` 均在上述快照上用 \`grep -n\`/\`sed -n\` 确认；例如 \`assets/js/app.js:4665\` 为 wheel 监听、\`app.js:6222\` 为 inspectionOrbit、\`index.html:505\` 为 sfx-bank 的 data-startup 标签。若工作区继续被修改，请以提交后的 \`grep -n\` 结果为准。
- 与 \`analysis/limits.md\` 的分工：limits.md 记录"原版有哪些限制点"（124 条，含行号），本报告给"本地化之后还能怎么改好"，两者互补，不重复。
- 未验证项已标注"需实测"（D2 启动收益、D4 GPU 收益）；其余收益为代码路径推断或几何量级计算（如 1.8→1.0 像素数 3.24×）。
