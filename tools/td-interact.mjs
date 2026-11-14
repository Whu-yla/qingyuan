import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:8123';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base + '/td/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.QYTD && window.QYTD.ready === true, null, { timeout: 30000 });
const R = {};
// 1. 引导弹窗真实点击关闭
R.guideVisible = await page.isVisible('#guide-overlay');
await page.click('#guide-close');
R.guideClosed = !(await page.isVisible('#guide-overlay'));
// 2. 点第一张关卡卡
await page.click('.level-card');
await page.waitForTimeout(400);
R.phase = await page.evaluate(() => window.QYTD.state.phase);
// 3. 投影阵位 1 并点击建塔（先点莲花剑阵卡）
async function slotScreen(i) {
  return await page.evaluate((idx) => { const p = window.QYTD.world.slotPosition(idx); const s = window.QYTD.world.screenOf(p); return s; }, i);
}
let sp = await slotScreen(1);
await page.click('.tower-card[data-tower="lianhua"]');
await page.mouse.click(sp.x, sp.y);
await page.waitForTimeout(250);
R.afterBuild = await page.evaluate(() => ({ n: window.QYTD.state.towers.length, spirit: Math.floor(window.QYTD.state.spirit) }));
// 4. 点塔打开面板 → 升级 → 拆除
await page.mouse.click(sp.x, sp.y);
await page.waitForTimeout(200);
R.panelVisible = await page.isVisible('#tower-panel');
R.panelName = await page.textContent('#tp-name');
await page.evaluate(() => window.QYTD.addSpirit(500));
await page.click('#tp-upgrade');
await page.waitForTimeout(200);
R.afterUpgrade = await page.evaluate(() => window.QYTD.state.towers.map(t => t.type + 'L' + t.level));
await page.click('#tp-sell');
await page.waitForTimeout(200);
R.afterSell = await page.evaluate(() => ({ n: window.QYTD.state.towers.length, spirit: Math.floor(window.QYTD.state.spirit) }));
// 5. 键盘：建塔卡选择后 Esc 取消；空格暂停；速度按钮
await page.click('.tower-card[data-tower="dageng"]');
R.selectedBeforeEsc = await page.evaluate(() => !!window.QYTD.state.buildType);
await page.keyboard.press('Escape');
R.selectedAfterEsc = await page.evaluate(() => !!window.QYTD.state.buildType);
await page.click('#speed-btn');
R.speed = await page.evaluate(() => window.QYTD.state.speed);
await page.click('#pause-btn');
R.paused = await page.evaluate(() => window.QYTD.state.paused);
R.pauseOverlay = await page.isVisible('#pause-overlay');
await page.click('#resume-btn');
R.pausedAfterResume = await page.evaluate(() => window.QYTD.state.paused);
// 6. 法术键：先加速刷出敌人，再点键 1 施法（无障碍施法成功或提示）
await page.evaluate(() => { window.QYTD.setSpeed(2); window.QYTD.simulate(25, 0.05); });
await page.mouse.move(720, 450);
await page.keyboard.press('1');
await page.waitForTimeout(200);
R.spellCd = await page.evaluate(() => window.QYTD.state.spellCd);
R.spells = await page.evaluate(() => window.QYTD.state.stats.spells);
R.toast = await page.textContent('#toast');
console.log(JSON.stringify({ R, errors }, null, 1));
await page.screenshot({ path: '/tmp/td-interact.png' });
await browser.close();
