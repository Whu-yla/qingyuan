import { chromium } from 'playwright-core';
import path from 'node:path';
const BASE = 'http://127.0.0.1:8123/td/index.html';
const OUT = process.argv[2] || '/tmp';
const logs = [];
const errors = [];
const fails = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errors.push(String(e)));
page.on('requestfailed', r => fails.push(r.url() + ' :: ' + (r.failure()?.errorText || '')));
const t0 = Date.now();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.QYTD && window.QYTD.ready === true, null, { timeout: 45000 });
const readyMs = Date.now() - t0;
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'td-00-guide.png') });
const guideShown = await page.evaluate(() => !document.getElementById('guide-overlay').classList.contains('hidden'));
if (guideShown) { await page.click('#guide-close'); await page.waitForTimeout(400); }
await page.screenshot({ path: path.join(OUT, 'td-01-select.png') });
const selectState = await page.evaluate(() => ({
  guideWasShown: true,
  phase: window.QYTD.snapshot()?.phase,
  cards: document.querySelectorAll('.level-card').length,
  loadingHidden: document.getElementById('loading')?.classList.contains('hidden') || getComputedStyle(document.getElementById('loading')).display === 'none',
  selectVisible: !document.getElementById('level-select').classList.contains('hidden'),
  gestureApi: !!window.QYTDGesture,
  canvas: (() => { const c = document.getElementById('td-canvas'); return c.width + 'x' + c.height; })()
}));
// 点击第一关卡片
await page.click('.level-card');
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'td-02-game.png') });
const playState = await page.evaluate(() => window.QYTD.snapshot());
// 用调试 API 建塔 + 时间加速跑关
const sim = await page.evaluate(() => {
  window.QYTD.addSpirit(600);
  const types = ['lianhua','dageng','qingyuan','pixie','jujian'];
  for (let i = 0; i < 10; i++) window.QYTD.buildTower(i, types[i % 5]);
  window.QYTD.setAutoSpells(true);
  window.QYTD.setSpeed(2);
  const a = window.QYTD.simulate(6, 0.05);
  return a;
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'td-03-battle.png') });
const mid = await page.evaluate(() => window.QYTD.simulate(30, 0.05));
await page.evaluate(() => { window.QYTD.forceBoss(); window.QYTD.simulate(7, 0.05); });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'td-04-boss.png') });
const bossState = await page.evaluate(() => window.QYTD.snapshot());
const end = await page.evaluate(() => window.QYTD.simulate(200, 0.05));
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'td-05-result.png') });
const resultState = await page.evaluate(() => ({
  snap: window.QYTD.snapshot(),
  resultVisible: !document.getElementById('result-overlay').classList.contains('hidden'),
  title: document.getElementById('result-title').textContent,
  desc: document.getElementById('result-desc').textContent,
  bossBarHidden: document.getElementById('boss-bar').classList.contains('hidden')
}));
console.log(JSON.stringify({ readyMs, selectState, playState, bossState, end, resultState, errors, fails, logs: logs.slice(0, 25) }, null, 1));
await browser.close();