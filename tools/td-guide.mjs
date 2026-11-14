import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:8123';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(base + '/td/index.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.setItem('qy-td-guide-seen-v1', '1'));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.QYTD && window.QYTD.ready === true, null, { timeout: 30000 });
await page.click('.level-card');
await page.waitForTimeout(400);
const before = await page.evaluate(() => ({ paused: QYTD.state.paused, phase: QYTD.state.phase }));
await page.click('#guide-btn');
const opened = await page.evaluate(() => ({ paused: QYTD.state.paused, guideHidden: document.getElementById('guide-overlay').classList.contains('hidden') }));
await page.click('#guide-close');
await page.waitForTimeout(200);
const closed = await page.evaluate(() => ({ paused: QYTD.state.paused, guideHidden: document.getElementById('guide-overlay').classList.contains('hidden') }));
// Esc path
await page.click('#guide-btn');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const escClosed = await page.evaluate(() => ({ paused: QYTD.state.paused, guideHidden: document.getElementById('guide-overlay').classList.contains('hidden') }));
// pause still works
await page.click('#pause-btn');
const paused = await page.evaluate(() => QYTD.state.paused);
await page.click('#resume-btn');
const resumed = await page.evaluate(() => QYTD.state.paused);
console.log(JSON.stringify({ before, opened, closed, escClosed, paused, resumed, errors }, null, 1));
await browser.close();
