import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:8123';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base + '/td/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.QYTD && window.QYTD.ready === true, null, { timeout: 30000 });
await page.evaluate(() => { const g=document.getElementById('guide-overlay'); if(g) g.classList.add('hidden'); });
await page.evaluate(() => window.QYTD.startLevel(0));
await page.evaluate(() => window.QYTD.addSpirit(500));
await page.evaluate(() => window.QYTD.simulate(16, 0.05));
const paint = await page.evaluate(() => {
  window.QYTDGesture.simulateGesture('LOTUS');
  const c = document.getElementById('gesture-overlay');
  const d = c ? c.getContext('2d').getImageData(0,0,c.width,c.height).data : null;
  let n = 0; if (d) for (let k=3;k<d.length;k+=4) if (d[k] > 0) n++;
  return n;
});
for (let i=0;i<3;i++) { await page.evaluate(() => window.QYTDGesture.simulateGesture('LOTUS')); await page.waitForTimeout(320); }
const st = await page.evaluate(() => ({
  cd: window.QYTD.state.spellCd,
  spells: window.QYTD.state.stats.spells,
  gesture: window.QYTD.state.gesture,
  gestureText: (document.getElementById('gesture-state')||{}).textContent,
  toast: (document.getElementById('toast')||{}).textContent,
  towerHint: (document.getElementById('toast')||{}).className
}));
await page.screenshot({ path: '/tmp/td-gesture2.png' });
// 再测手势开关（fake camera 下 enable 真实链路）
await page.evaluate(() => document.getElementById('gesture-toggle').click());
await page.waitForTimeout(4000);
const gest = await page.evaluate(() => ({
  isEnabled: !!(window.QYTDGesture && window.QYTDGesture.isEnabled),
  status: window.QYTDGesture ? window.QYTDGesture.status : null,
  btn: (document.getElementById('gesture-toggle')||{}).textContent,
  state: (document.getElementById('gesture-state')||{}).textContent,
  video: (function(){ const v=document.getElementById('gesture-video'); return v ? {readyState:v.readyState, w:v.videoWidth, h:v.videoHeight} : null; })()
}));
console.log(JSON.stringify({ paint, st, gest, errors }, null, 1));
await browser.close();
