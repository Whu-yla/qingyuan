import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:8123';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base + '/td/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.QYTD && window.QYTD.ready === true, null, { timeout: 30000 });
const results = await page.evaluate(() => {
  const Q = window.QYTD;
  const out = [];
  const plan = ['lianhua','qingyuan','dageng','lianhua','pixie','jujian','lianhua','dageng','lianhua','pixie'];
  const slotOrder = [1,3,5,7,9,0,2,4,6,8];
  for (let li = 0; li < 4; li++) {
    Q.startLevel(li);
    Q.setAutoSpells(true);
    let built = 0;
    for (let round = 0; round < 120; round++) {
      const st = Q.state;
      if (st.phase !== 'playing') break;
      // 先建塔，建满后升级（优先升输出塔）
      while (built < plan.length) {
        const type = plan[built];
        if (Q.state.spirit < Q.config.TOWERS[type].cost) break;
        if (!Q.buildTower(slotOrder[built], type)) break;
        built++;
      }
      if (built >= plan.length) {
        // 升级：轮询所有塔，找最便宜的升级
        let best = null;
        for (const tw of Q.state.towers) {
          if (tw.level >= 3) continue;
          const cost = Math.round(tw.conf.cost * 0.85 * tw.level);
          if (Q.state.spirit >= cost && (!best || cost < best.cost)) best = { slot: tw.slotIndex, cost };
        }
        if (best) Q.upgradeTower(best.slot);
      }
      Q.simulate(4, 0.05);
      if (Q.state.phase !== 'playing') break;
    }
    const s = Q.snapshot();
    out.push({ level: li + 1, phase: s.phase, time: s.time, baseHp: s.baseHp + '/' + s.maxBaseHp, kills: s.stats.kills, leaked: s.stats.leaked, spells: s.stats.spells, towers: s.towers.map(t=>t.type+'L'+t.level).join(','), spirit: s.spirit, boss: s.boss ? s.boss.name+' '+s.boss.hp+'/'+s.boss.maxHp : 'none' });
    Q.toSelect();
  }
  return out;
});
console.log(JSON.stringify({ results, errors }, null, 1));
await browser.close();
