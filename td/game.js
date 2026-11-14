/* 青元剑诀 · 剑阵守山 —— 塔防玩法主逻辑
 * 玩法：九曲石道上拦住来犯之敌，护住青云阵眼；五波之后 Boss 现身。
 * 依赖：three-r128.min.js、td/levels.js、td/world.js；手势控制依赖 td/gesture.js（可选）。
 * 挂载 window.QYTD（含无头测试用调试 API）。
 */
(function () {
  'use strict';

  var CFG = window.QYTD_CONFIG;
  var THREE = window.THREE;
  if (!CFG || !THREE) throw new Error('QYTDGame: 依赖未加载（THREE / QYTD_CONFIG）');

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var TAU = Math.PI * 2;

  var S = null;
  var WORLD = null;
  var canvas = null;
  var GEST = null;
  var ui = {};
  var progress = { cleared: [], best: {} };
  var toastTimer = 0;
  var bannerTimer = 0;
  var guideSeenKey = 'qy-td-guide-seen-v1';

  // ---------- DOM 小工具 ----------
  function text(el, v) { if (el) el.textContent = v; }
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }
  function setHidden(el, h) { if (el) el.classList.toggle('hidden', !!h); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------- 存档 ----------
  function loadProgress() {
    try {
      var raw = localStorage.getItem(CFG.STORAGE_KEY);
      var p = raw ? JSON.parse(raw) : {};
      return { cleared: Array.isArray(p.cleared) ? p.cleared : [], best: p.best || {} };
    } catch (e) { return { cleared: [], best: {} }; }
  }
  function saveProgress() {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(progress)); } catch (e) { /* 隐私模式忽略 */ }
  }

  // ---------- 状态 ----------
  function createState() {
    return {
      phase: 'select', paused: false, speed: 1,
      levelIndex: 0, level: null,
      time: 0, spirit: 0, baseHp: 0, maxBaseHp: 0,
      wavesStarted: 0, waveActive: false, waveTime: 0, waveQueue: [], waveGap: 0,
      bossPending: false, bossSpawned: false,
      enemies: [], towers: [], boss: null, nextId: 1,
      buildType: null, selectedTower: null, selectedSpell: null,
      aimPos: new THREE.Vector3(10, 0, 2), aimValid: false, aimScreen: { x: 0, y: 0 },
      spellCd: {}, pendingStrikes: [],
      gesture: null, gestureHeld: null, gestureFired: false, gestureSince: 0, gestureAim: false,
      stats: { kills: 0, leaked: 0, spells: 0, built: 0, damage: 0 },
      hudAcc: 0, autoSpells: false
    };
  }

  // ---------- 启动 ----------
  function boot() {
    canvas = $('td-canvas');
    if (!canvas) { console.error('[QYTD] 缺少 #td-canvas'); return; }
    try {
      WORLD = window.QYTDWorld.init(canvas);
    } catch (err) {
      text($('loading-text'), '3D 初始化失败：' + (err && err.message ? err.message : err));
      console.error('[QYTD] world init failed', err);
      return;
    }
    S = createState();
    progress = loadProgress();
    cacheUI();
    bindUI();
    bindCanvas();
    bindKeyboard();
    bindGesture();
    renderLevelList();
    toSelect();
    hide($('loading'));
    requestAnimationFrame(loop);
    window.QYTD.ready = true;
    if (!localStorage.getItem(guideSeenKey)) openGuide();
    console.log('[QYTD] ready v' + CFG.VERSION);
  }

  function cacheUI() {
    ui = {
      levelName: $('level-name'), levelSub: $('level-sub'),
      baseHpText: $('base-hp-text'), baseHpFill: $('base-hp-fill'),
      waveLabel: $('wave-label'), spiritValue: $('spirit-value'),
      bossBar: $('boss-bar'), bossName: $('boss-name'), bossRealm: $('boss-realm'),
      bossHpFill: $('boss-hp-fill'), bossHpText: $('boss-hp-text'),
      speedBtn: $('speed-btn'), pauseBtn: $('pause-btn'),
      levelSelect: $('level-select'), levelList: $('level-list'),
      towerPanel: $('tower-panel'), tpName: $('tp-name'), tpLevel: $('tp-level'), tpStats: $('tp-stats'),
      tpUpgrade: $('tp-upgrade'), tpSell: $('tp-sell'), tpClose: $('tp-close'),
      result: $('result-overlay'), resultTitle: $('result-title'), resultDesc: $('result-desc'),
      resultNext: $('result-next-btn'), resultRetry: $('result-retry-btn'), resultHome: $('result-home-btn'),
      guide: $('guide-overlay'), guideClose: $('guide-close'),
      pause: $('pause-overlay'), resumeBtn: $('resume-btn'), pauseHome: $('pause-home-btn'),
      toast: $('toast'), banner: $('wave-banner'), bannerTitle: $('wave-banner-title'), bannerSub: $('wave-banner-sub'),
      hudLeft: $('hud-left'), towerRoster: $('tower-roster'), spellBar: $('spell-bar'),
      gesturePanel: $('gesture-panel'), gestureState: $('gesture-state'), gestureToggle: $('gesture-toggle'),
      gestureOverlay: $('gesture-overlay'), gestureVideo: $('gesture-video'),
      aimReticle: $('aim-reticle'), aimLabel: $('aim-label')
    };
  }

  // ---------- 选关 ----------
  function renderLevelList() {
    var list = $('level-list');
    if (!list) return;
    list.innerHTML = '';
    CFG.LEVELS.forEach(function (lv, i) {
      var best = progress.best[i];
      var card = document.createElement('button');
      card.className = 'level-card';
      card.setAttribute('data-level', i);
      card.setAttribute('type', 'button');
      var bestText = best ? ('最佳 ' + fmtTime(best.time) + ' · 第 ' + best.wave + ' 波') : '尚未挑战';
      card.innerHTML = '<span class="lc-index">第 ' + lv.index + ' 关</span>' +
        '<span class="lc-name">' + lv.name + '</span>' +
        '<span class="lc-boss">Boss · ' + lv.bossName + '（' + lv.realm + '）</span>' +
        '<span class="lc-desc">' + lv.desc + '</span>' +
        '<span class="lc-best">' + bestText + '</span>';
      card.addEventListener('click', function () { startLevel(i); });
      list.appendChild(card);
    });
  }

  function toSelect() {
    if (S && S.phase === 'playing') clearBattle();
    S = createState();
    S.phase = 'select';
    WORLD.clearDynamic();
    hide(ui.result); hide(ui.pause); hide(ui.bossBar);
    hide(ui.waveBanner || ui.banner);
    hide(ui.hudLeft); hide(ui.towerRoster); hide(ui.spellBar); hide(ui.gesturePanel);
    hide(ui.towerPanel); hide(ui.aimReticle);
    show(ui.levelSelect);
    renderLevelList();
    WORLD.hideAim(); WORLD.hideRange();
  }

  // ---------- 开始 / 结束一局 ----------
  function startLevel(index) {
    var level = CFG.LEVELS[index];
    if (!level) return;
    clearBattle();
    S = createState();
    S.levelIndex = index; S.level = level;
    S.phase = 'playing'; S.paused = false;
    S.spirit = level.startSpirit; S.baseHp = level.baseHp; S.maxBaseHp = level.baseHp;
    S.spellCd = {};
    Object.keys(CFG.SPELLS).forEach(function (k) { S.spellCd[k] = 0; });
    S.waveGap = 4.0;
    S.aimPos.set(WORLD.basePosition.x, 0, WORLD.basePosition.z + 2);
    S.aimValid = false;

    hide(ui.levelSelect); hide(ui.result); hide(ui.pause); hide(ui.bossBar); hide(ui.towerPanel);
    show(ui.hudLeft); show(ui.towerRoster); show(ui.spellBar); show(ui.gesturePanel);
    hide(ui.aimReticle);
    text(ui.levelName, level.name);
    text(ui.levelSub, '第 ' + level.index + ' 关 · ' + level.realm);
    WORLD.setBaseHp(1);
    updateSlotStates();
    updateHud(true);
    banner('第 ' + level.index + ' 关 · ' + level.name, level.desc);
    setTimeout(function () { if (S && S.phase === 'playing') toast('提示：' + level.tip); }, 1400);
    saveGuideSeen();
  }

  function clearBattle() {
    if (!S) return;
    for (var i = 0; i < S.enemies.length; i++) {
      if (S.enemies[i].node) WORLD.disposeNode(S.enemies[i].node);
    }
    S.enemies.length = 0; S.boss = null;
    for (var j = 0; j < S.towers.length; j++) {
      var tw = S.towers[j];
      WORLD.unregisterTower(tw.visual);
      WORLD.disposeTower(tw.visual);
    }
    S.towers.length = 0;
    S.pendingStrikes.length = 0;
    WORLD.clearDynamic();
    WORLD.setBaseHp(1);
    WORLD.hideAim(); WORLD.hideRange();
    hide(ui.bossBar); hide(ui.towerPanel);
    if (ui.aimReticle) hide(ui.aimReticle);
  }

  function saveGuideSeen() { try { localStorage.setItem(guideSeenKey, '1'); } catch (e) { } }

  // ---------- 主循环 ----------
  var lastFrame = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!lastFrame) lastFrame = now;
    var realDt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (S && S.phase === 'playing' && !S.paused) {
      stepGame(realDt * S.speed);
    }
    if (WORLD) {
      WORLD.update(realDt, now / 1000);
      WORLD.render();
    }
    updateAimVisual();
  }

  function stepGame(dt) {
    if (!S || S.phase !== 'playing') return;
    S.time += dt;
    S.spirit += S.level.spiritPerSec * dt;
    updateSpellCooldowns(dt);
    updateWaves(dt);
    updateEnemies(dt);
    updateTowers(dt);
    updatePendingStrikes();
    if (S.autoSpells) autoCastSpells();
    S.hudAcc += dt;
    if (S.hudAcc > 0.08) { S.hudAcc = 0; updateHud(); }
  }

  // ---------- 波次 ----------
  function updateWaves(dt) {
    if (S.bossSpawned) return;
    if (S.waveActive) {
      S.waveTime += dt;
      while (S.waveQueue.length && S.waveQueue[0].at <= S.waveTime) {
        var q = S.waveQueue.shift();
        spawnEnemy(q.type);
      }
      if (S.waveQueue.length === 0 && S.enemies.length === 0) {
        S.waveActive = false;
        if (S.wavesStarted >= S.level.waves.length) {
          S.bossPending = true; S.waveGap = 3.0;
          banner('Boss 降临', S.level.bossName + ' · ' + S.level.boss.title);
        } else {
          S.waveGap = 4.5;
        }
      }
      return;
    }
    if (S.waveGap > 0) {
      S.waveGap -= dt;
      if (S.waveGap <= 0) {
        if (S.bossPending) spawnBoss();
        else startWave();
      }
    }
  }

  function startWave() {
    if (S.wavesStarted >= S.level.waves.length) return;
    S.wavesStarted++;
    var wave = S.level.waves[S.wavesStarted - 1];
    var queue = [];
    wave.groups.forEach(function (g) {
      for (var i = 0; i < g.count; i++) {
        queue.push({ type: g.type, at: (g.delay || 0) + i * g.gap });
      }
    });
    queue.sort(function (a, b) { return a.at - b.at; });
    S.waveQueue = queue; S.waveTime = 0; S.waveActive = true;
    banner('第 ' + S.wavesStarted + ' / ' + S.level.waves.length + ' 波',
      S.wavesStarted === 1 ? S.level.tip : '');
  }

  // ---------- 敌人 ----------
  function makeEntity(conf, opts) {
    opts = opts || {};
    var t = opts.t != null ? opts.t : 0;
    var e = {
      id: S.nextId++, key: conf.key, conf: conf, isBoss: !!opts.isBoss,
      t: t, pos: WORLD.pointAt(t).clone(), tangent: WORLD.tangentAt(t).clone(),
      hp: conf.hp, maxHp: conf.hp, shieldHp: 0,
      speed: conf.speed, baseSpeed: conf.speed,
      slowUntil: 0, slowFactor: 1, stunUntil: 0,
      age: 0, dead: false, node: null,
      leak: conf.leak || 1, reward: conf.reward || 0
    };
    e.node = WORLD.createEnemy(conf, { isBoss: !!opts.isBoss });
    WORLD.updateEnemy(e.node, e);
    return e;
  }

  function spawnEnemy(typeKey, opts) {
    var conf = CFG.ENEMIES[typeKey];
    if (!conf) return null;
    var t = (opts && opts.t != null) ? opts.t : 0;
    var e = makeEntity(conf, { t: t });
    S.enemies.push(e);
    return e;
  }

  function spawnBoss() {
    var b = S.level.boss;
    var conf = {
      key: 'boss_' + S.levelIndex, name: b.name, hp: b.hp, speed: b.speed, reward: 0,
      leak: b.leak, color: b.color, scale: b.scale, shape: 'human', radius: 0.72, height: 2.4
    };
    var e = makeEntity(conf, { isBoss: true, t: 0 });
    e.bossConf = b; e.shieldHp = 0; e.enraged = false;
    e.abilityTimers = (b.abilities || []).map(function (a) {
      return { ability: a, cd: (a.interval || 8) * 0.75 };
    });
    S.boss = e; S.bossSpawned = true; S.enemies.push(e);
    WORLD.vfx.ring(e.pos, 7, b.color, 1.2, { opacity: 0.8 });
    WORLD.vfx.burst(e.pos, b.color, 30, 1.8);
    WORLD.shake(0.35);
    banner(b.name + ' 现身', b.realm + ' · ' + b.title);
    toast(b.title);
    updateHud(true);
  }

  function removeEnemy(e) {
    e.dead = true;
    var idx = S.enemies.indexOf(e);
    if (idx >= 0) S.enemies.splice(idx, 1);
    if (e.node) WORLD.disposeNode(e.node);
    if (S.boss === e) { S.boss = null; hide(ui.bossBar); }
  }

  function leakEnemy(e) {
    if (e.dead) return;
    S.baseHp -= e.leak;
    S.stats.leaked++;
    WORLD.vfx.baseHit();
    WORLD.setBaseHp(Math.max(0, S.baseHp / S.maxBaseHp));
    removeEnemy(e);
    if (e.isBoss) { toast('Boss 突破阵眼！'); defeat(); return; }
    if (S.baseHp <= 0) { S.baseHp = 0; defeat(); }
    else toast('阵眼受损 -' + e.leak);
  }

  function updateEnemies(dt) {
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      if (e.dead) continue;
      e.age += dt;
      var stunned = S.time < e.stunUntil;
      if (!stunned) {
        var sp = e.speed;
        var slowed = S.time < e.slowUntil;
        if (slowed) sp *= e.slowFactor;
        e.t += sp * dt / WORLD.pathLength;
      }
      e.pos.copy(WORLD.pointAt(e.t));
      e.tangent.copy(WORLD.tangentAt(e.t));
      if (e.t >= 1) { leakEnemy(e); if (S.phase !== 'playing') return; continue; }
      WORLD.updateEnemy(e.node, e);
      if (e.isBoss) updateBossAbilities(e, dt);
    }
    updateBossBar();
  }

  // ---------- Boss 技能 ----------
  function updateBossAbilities(b, dt) {
    if (!b || b.dead || b.abilityTimers) {
      // 处理护盾条显示
    }
    if (b.abilityTimers) {
      for (var i = 0; i < b.abilityTimers.length; i++) {
        var at = b.abilityTimers[i];
        var ab = at.ability;
        if (ab.type === 'enrage') continue;
        at.cd -= dt;
        if (at.cd <= 0) {
          at.cd = ab.interval || 8;
          triggerBossAbility(b, ab);
        }
      }
    }
    // 圣祖真怒
    var enrage = (S.level.boss.abilities || []).filter(function (a) { return a.type === 'enrage'; })[0];
    if (enrage && !b.enraged && b.hp / b.maxHp <= enrage.at) {
      b.enraged = true;
      b.speed = b.baseSpeed * (enrage.speedMult || 1.5);
      WORLD.vfx.ring(b.pos, 6, 0xff3b3b, 0.9, { opacity: 0.85 });
      WORLD.shake(0.3);
      toast(enrage.label + '：' + S.level.bossName + ' 攻势暴涨！');
    }
  }

  function triggerBossAbility(b, ab) {
    if (b.dead) return;
    if (ab.type === 'summon') {
      for (var i = 0; i < (ab.count || 2); i++) {
        spawnEnemy(ab.unit, { t: Math.max(0, b.t - 0.015 - i * 0.006) });
      }
      WORLD.vfx.burst(b.pos, b.conf.color, 16, 1.2);
      toast(ab.label || '召唤援军');
    } else if (ab.type === 'slowTowers') {
      S.towers.forEach(function (tw) { tw.slowUntil = S.time + (ab.duration || 3); tw.slowMult = ab.mult || 0.6; });
      WORLD.vfx.slowWave(b.pos, b.conf.color);
      toast(ab.label + '：剑阵迟滞 ' + (ab.duration || 3) + ' 秒');
    } else if (ab.type === 'shield') {
      b.shieldHp += ab.amount || 200;
      WORLD.vfx.ring(b.pos, 2.6, 0xffd57a, 0.7, { opacity: 0.85 });
      toast(ab.label + ' +' + (ab.amount || 200) + ' 护盾');
    } else if (ab.type === 'teleport') {
      var old = b.pos.clone();
      b.t = Math.min(0.98, b.t + (ab.advance || 0.05));
      b.pos.copy(WORLD.pointAt(b.t));
      WORLD.vfx.ring(old, 2.2, b.conf.color, 0.6, { opacity: 0.8 });
      WORLD.vfx.ring(b.pos, 2.2, b.conf.color, 0.6, { opacity: 0.8 });
      toast(ab.label || '瞬移');
    }
    updateHud(true);
  }

  function updateBossBar() {
    if (!ui.bossBar) return;
    if (!S || !S.boss || S.boss.dead || S.phase !== 'playing') { hide(ui.bossBar); return; }
    var b = S.boss;
    show(ui.bossBar);
    text(ui.bossName, b.bossConf.name);
    text(ui.bossRealm, b.bossConf.realm);
    var total = b.hp + b.shieldHp;
    var frac = clamp(total / b.maxHp, 0, 1);
    if (ui.bossHpFill) ui.bossHpFill.style.width = (frac * 100).toFixed(1) + '%';
    text(ui.bossHpText, Math.max(0, Math.ceil(b.hp)) + ' / ' + b.maxHp + (b.shieldHp > 0 ? ' · 盾 ' + Math.ceil(b.shieldHp) : ''));
  }

  // ---------- 伤害 ----------
  function damageEnemy(e, amount, opts) {
    if (!e || e.dead) return 0;
    opts = opts || {};
    var dmg = amount;
    if (!opts.trueDamage && e.shieldHp > 0) {
      var absorbed = Math.min(e.shieldHp, dmg);
      e.shieldHp -= absorbed; dmg -= absorbed;
      if (absorbed > 0) WORLD.vfx.ring(e.pos, 1.0, 0xffd57a, 0.3, { opacity: 0.6 });
    }
    if (dmg <= 0) { updateBossBar(); return 0; }
    e.hp -= dmg;
    S.stats.damage += dmg;
    if (e.node) WORLD.flashEnemy(e.node);
    if (e.hp <= 0) killEnemy(e, opts);
    else if (e.isBoss) updateBossBar();
    return dmg;
  }

  function killEnemy(e, opts) {
    if (e.dead) return;
    if (e.isBoss) {
      S.stats.kills++;
      WORLD.vfx.ring(e.pos, 8, e.conf.color, 1.4, { opacity: 0.9 });
      WORLD.vfx.burst(e.pos, 0xffe9b0, 46, 2.2);
      WORLD.shake(0.4);
      removeEnemy(e);
      victory();
      return;
    }
    S.stats.kills++;
    S.spirit += e.reward;
    WORLD.vfx.burst(e.pos, e.conf.color, 12, 1.0);
    removeEnemy(e);
    updateHud();
  }

  function applySlow(e, factor, duration) {
    if (!e || e.dead) return;
    if (S.time > e.slowUntil || factor < e.slowFactor) e.slowFactor = factor;
    e.slowUntil = Math.max(e.slowUntil, S.time + duration);
  }
  function applyStun(e, duration) {
    if (!e || e.dead) return;
    e.stunUntil = Math.max(e.stunUntil, S.time + duration);
  }

  function enemiesNear(pos, radius, maxCount) {
    var list = [];
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d <= radius) list.push({ e: e, d: d });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    if (maxCount) list = list.slice(0, maxCount);
    return list.map(function (x) { return x.e; });
  }
  function nearestEnemyTo(pos, maxDist) {
    var best = null, bestD = maxDist != null ? maxDist : Infinity;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }
  function bestAim() {
    if (S.boss && !S.boss.dead) return S.boss.pos.clone();
    var best = null;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      if (!best || e.t > best.t) best = e;
    }
    if (best) return best.pos.clone();
    return WORLD.basePosition.clone();
  }

  // ---------- 塔 ----------
  function towerAtSlot(slotIndex) {
    for (var i = 0; i < S.towers.length; i++) if (S.towers[i].slotIndex === slotIndex) return S.towers[i];
    return null;
  }
  function towerStats(tw) {
    var lv = tw.level;
    return {
      damage: tw.conf.damage * Math.pow(1.55, lv - 1),
      range: tw.conf.range * (1 + 0.08 * (lv - 1)),
      interval: tw.conf.interval * Math.pow(0.92, lv - 1)
    };
  }
  function buildTower(slotIndex, typeKey, silent) {
    if (!S || S.phase !== 'playing') return false;
    if (towerAtSlot(slotIndex)) { toast('该阵位已有剑阵'); return false; }
    var conf = CFG.TOWERS[typeKey];
    if (!conf) return false;
    if (S.spirit < conf.cost) { toast('灵力不足（需要 ' + conf.cost + '）'); return false; }
    var pos = WORLD.slotPosition(slotIndex);
    if (!pos) return false;
    var visual = WORLD.createTower(typeKey, 1);
    visual.group.position.copy(pos);
    WORLD.registerTower(visual);
    WORLD.setSlotState(slotIndex, { built: true, hover: false, selected: false });
    var tw = {
      slotIndex: slotIndex, type: typeKey, conf: conf, level: 1, visual: visual,
      pos: pos.clone(), cd: 0, slowUntil: 0, slowMult: 1, invested: conf.cost
    };
    S.towers.push(tw);
    S.spirit -= conf.cost;
    S.stats.built++;
    WORLD.vfx.ring(pos, 2.2, conf.color, 0.5, { opacity: 0.7 });
    WORLD.vfx.burst(pos, conf.color, 10, 0.7);
    if (!silent) toast(conf.name + ' 布阵完成');
    updateHud(true);
    return true;
  }
  function upgradeCost(tw) { return Math.round(tw.conf.cost * 0.85 * tw.level); }
  function sellRefund(tw) { return Math.round(tw.invested * 0.6); }

  function upgradeTower(tw) {
    if (!tw || tw.level >= 3) { toast('已是最高阶'); return; }
    var cost = upgradeCost(tw);
    if (S.spirit < cost) { toast('灵力不足（需要 ' + cost + '）'); return; }
    S.spirit -= cost; tw.invested += cost; tw.level++;
    WORLD.unregisterTower(tw.visual);
    WORLD.disposeTower(tw.visual);
    tw.visual = WORLD.createTower(tw.type, tw.level);
    tw.visual.group.position.copy(tw.pos);
    WORLD.registerTower(tw.visual);
    WORLD.vfx.ring(tw.pos, 2.0, tw.conf.color, 0.5, { opacity: 0.8 });
    toast(tw.conf.name + ' 升至 ' + tw.level + ' 阶');
    showTowerPanel(tw);
    updateHud(true);
  }
  function sellTower(tw) {
    if (!tw) return;
    var refund = sellRefund(tw);
    S.spirit += refund;
    WORLD.unregisterTower(tw.visual);
    WORLD.disposeTower(tw.visual);
    var idx = S.towers.indexOf(tw);
    if (idx >= 0) S.towers.splice(idx, 1);
    WORLD.setSlotState(tw.slotIndex, { built: false, hover: false, selected: false });
    WORLD.vfx.ring(tw.pos, 1.8, 0xffd57a, 0.45, { opacity: 0.6 });
    hideTowerPanel();
    toast('拆除 ' + tw.conf.name + '，返还 ' + refund + ' 灵力');
    updateHud(true);
  }

  function findTarget(tw) {
    var stats = towerStats(tw);
    var best = null;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var dx = e.pos.x - tw.pos.x, dz = e.pos.z - tw.pos.z;
      if (dx * dx + dz * dz > stats.range * stats.range) continue;
      if (!best || e.t > best.t) best = e;
    }
    return best;
  }

  function updateTowers(dt) {
    for (var i = 0; i < S.towers.length; i++) {
      var tw = S.towers[i];
      tw.cd -= dt;
      if (tw.cd > 0) continue;
      var target = findTarget(tw);
      if (!target) continue;
      var stats = towerStats(tw);
      var slowed = S.time < tw.slowUntil;
      tw.cd = stats.interval / (slowed ? tw.slowMult : 1);
      towerAttack(tw, target, stats);
    }
  }

  function towerAttack(tw, target, stats) {
    var from = tw.pos.clone(); from.y = 1.2;
    var kind = tw.conf.kind;
    if (kind === 'beam') {
      WORLD.vfx.beam(from, target.pos.clone().setY(1.1), tw.conf.color, 0.06, 0.18);
      damageEnemy(target, stats.damage);
    } else if (kind === 'aoe') {
      WORLD.vfx.ring(target.pos, 1.9, tw.conf.color, 0.45, { opacity: 0.75 });
      var hits = enemiesNear(target.pos, 1.9);
      for (var i = 0; i < hits.length; i++) {
        damageEnemy(hits[i], stats.damage * (hits[i] === target ? 1 : 0.6));
      }
    } else if (kind === 'slow') {
      WORLD.vfx.beam(from, target.pos.clone().setY(1.0), tw.conf.color, 0.05, 0.2);
      damageEnemy(target, stats.damage);
      applySlow(target, tw.conf.slow, 1.8);
    } else if (kind === 'chain') {
      var chain = [target];
      var prev = target;
      var count = tw.conf.chain || 3;
      for (var c = 1; c < count; c++) {
        var next = null, nd = (tw.conf.chainRange || 4.5);
        for (var k = 0; k < S.enemies.length; k++) {
          var e2 = S.enemies[k];
          if (e2.dead || chain.indexOf(e2) >= 0) continue;
          var dx = e2.pos.x - prev.pos.x, dz = e2.pos.z - prev.pos.z;
          var d = Math.sqrt(dx * dx + dz * dz);
          if (d < nd) { nd = d; next = e2; }
        }
        if (!next) break;
        chain.push(next); prev = next;
      }
      var pts = [from];
      chain.forEach(function (e) { pts.push(e.pos.clone().setY(1.1)); });
      WORLD.vfx.lightning(pts, tw.conf.color, 0.28);
      chain.forEach(function (e, idx) { damageEnemy(e, stats.damage * Math.pow(0.85, idx)); });
    } else if (kind === 'heavy') {
      var pos = target.pos.clone();
      S.pendingStrikes.push({
        at: S.time + 0.5, pos: pos, radius: tw.conf.splash || 1.8,
        damage: stats.damage, color: tw.conf.color, stun: 0
      });
      WORLD.vfx.swordDrop(pos, tw.conf.color, tw.conf.splash || 1.8);
    }
  }

  function updatePendingStrikes() {
    for (var i = S.pendingStrikes.length - 1; i >= 0; i--) {
      var st = S.pendingStrikes[i];
      if (S.time < st.at) continue;
      S.pendingStrikes.splice(i, 1);
      var hits = enemiesNear(st.pos, st.radius || 2);
      for (var k = 0; k < hits.length; k++) {
        damageEnemy(hits[k], st.damage);
        if (st.stun) applyStun(hits[k], st.stun);
      }
      if (st.big) {
        WORLD.vfx.ring(st.pos, st.radius || 2, st.color, 0.6, { opacity: 0.85 });
        WORLD.vfx.burst(st.pos, st.color, 18, 1.4);
      }
    }
  }

  // ---------- 法术 ----------
  function updateSpellCooldowns(dt) {
    var keys = Object.keys(S.spellCd);
    for (var i = 0; i < keys.length; i++) {
      if (S.spellCd[keys[i]] > 0) S.spellCd[keys[i]] = Math.max(0, S.spellCd[keys[i]] - dt);
    }
  }

  function castSpell(key, aim) {
    if (!S || S.phase !== 'playing' || S.paused) return false;
    var sp = CFG.SPELLS[key];
    if (!sp) return false;
    if ((S.spellCd[key] || 0) > 0) { toast(sp.name + ' 冷却中 ' + Math.ceil(S.spellCd[key]) + 's'); return false; }
    var pos = (aim && aim.isVector3) ? aim.clone() : bestAim();
    var ok = false;
    if (sp.type === 'chain') ok = spellPixie(sp, pos);
    else if (sp.type === 'aoe') ok = spellLotus(sp, pos);
    else if (sp.type === 'heavy') ok = spellDageng(sp, pos);
    else if (sp.type === 'meteor') ok = spellGiant(sp, pos);
    else if (sp.type === 'shield') ok = spellShield(sp, pos);
    if (!ok) { toast('附近没有可施法的目标'); return false; }
    S.spellCd[key] = sp.cd;
    S.stats.spells++;
    updateHud(true);
    return true;
  }

  function spellPixie(sp, pos) {
    var targets = enemiesNear(pos, sp.radius);
    if (!targets.length) {
      var near = nearestEnemyTo(pos, 12);
      if (!near) return false;
      targets = [near];
    }
    targets = targets.slice(0, sp.chain || 4);
    var pts = [pos.clone().setY(0.2)];
    targets.forEach(function (e) { pts.push(e.pos.clone().setY(1.1)); });
    WORLD.vfx.lightning(pts, sp.color, 0.35);
    WORLD.vfx.ring(pos, sp.radius, sp.color, 0.6, { opacity: 0.55 });
    targets.forEach(function (e, i) {
      WORLD.vfx.burst(e.pos, sp.color, 6, 0.8);
      damageEnemy(e, sp.damage * (i === 0 ? 1 : 0.9));
    });
    return true;
  }
  function spellLotus(sp, pos) {
    var targets = enemiesNear(pos, sp.radius);
    if (!targets.length) return false;
    WORLD.vfx.ring(pos, sp.radius, sp.color, 0.7, { opacity: 0.85, startScale: 0.2 });
    WORLD.vfx.ring(pos, sp.radius * 0.6, 0xffffff, 0.5, { opacity: 0.6 });
    WORLD.vfx.burst(pos, sp.color, 20, 1.4);
    targets.forEach(function (e) {
      damageEnemy(e, sp.damage);
      if (sp.slow) applySlow(e, sp.slow, sp.slowDuration || 3);
    });
    return true;
  }
  function spellDageng(sp, pos) {
    var target = enemiesNear(pos, sp.radius)[0];
    if (!target) target = nearestEnemyTo(pos, sp.radius * 2.5);
    if (!target) return false;
    var land = target.pos.clone();
    S.pendingStrikes.push({ at: S.time + 0.45, pos: land, radius: 1.7, damage: sp.damage, stun: sp.stun || 0, color: sp.color, big: true });
    WORLD.vfx.swordDrop(land, sp.color, 1.7);
    return true;
  }
  function spellGiant(sp, pos) {
    if (!nearestEnemyTo(pos, 9)) return false;
    var offsets = [[0, 0], [1.8, -1.2], [-1.6, 1.3]];
    offsets.forEach(function (o, i) {
      var p = new THREE.Vector3(pos.x + o[0] + rnd(-0.5, 0.5), 0, pos.z + o[1] + rnd(-0.5, 0.5));
      S.pendingStrikes.push({
        at: S.time + 0.5 + i * 0.16, pos: p, radius: 2.6,
        damage: sp.damage, color: sp.color, big: true
      });
      WORLD.vfx.swordDrop(p, sp.color, 2.6);
    });
    return true;
  }
  function spellShield(sp, pos) {
    S.baseHp = Math.min(S.maxBaseHp, S.baseHp + (sp.heal || 4));
    WORLD.setBaseHp(S.baseHp / S.maxBaseHp);
    WORLD.vfx.heal(WORLD.basePosition);
    for (var i = 0; i < S.enemies.length; i++) {
      applySlow(S.enemies[i], sp.slow || 0.55, sp.slowDuration || 4);
    }
    toast('青元剑盾：阵眼回灵 +' + (sp.heal || 4) + '，万敌迟滞');
    updateHud(true);
    return true;
  }

  function autoCastSpells() {
    if (!S.enemies.length) return;
    Object.keys(CFG.SPELLS).forEach(function (key) {
      if ((S.spellCd[key] || 0) <= 0) castSpell(key, null);
    });
  }

  // ---------- 界面刷新 ----------
  function updateSlotStates() {
    if (!WORLD) return;
    for (var i = 0; i < WORLD.slotCount; i++) {
      var built = !!towerAtSlot(i);
      WORLD.setSlotState(i, { built: built, hover: false, selected: false });
    }
  }

  function updateHud(force) {
    if (!S || !S.level) return;
    text(ui.spiritValue, Math.floor(S.spirit));
    text(ui.baseHpText, Math.max(0, S.baseHp) + ' / ' + S.maxBaseHp);
    if (ui.baseHpFill) ui.baseHpFill.style.width = clamp(S.baseHp / S.maxBaseHp, 0, 1) * 100 + '%';
    var label;
    if (S.bossSpawned) label = 'Boss 战 · ' + S.level.bossName;
    else if (S.waveActive) label = '第 ' + S.wavesStarted + ' / ' + S.level.waves.length + ' 波 · 交战中';
    else label = '第 ' + Math.min(S.wavesStarted + 1, S.level.waves.length) + ' / ' + S.level.waves.length + ' 波 · 准备';
    text(ui.waveLabel, label);

    // 塔卡牌可负担状态
    var cards = document.querySelectorAll('.tower-card[data-tower]');
    for (var i = 0; i < cards.length; i++) {
      var key = cards[i].getAttribute('data-tower');
      var conf = CFG.TOWERS[key];
      if (!conf) continue;
      cards[i].classList.toggle('is-unaffordable', S.spirit < conf.cost);
      cards[i].classList.toggle('selected', S.buildType === key);
    }
    // 法术冷却
    var spellBtns = document.querySelectorAll('.spell-btn[data-spell]');
    for (var j = 0; j < spellBtns.length; j++) {
      var sk = spellBtns[j].getAttribute('data-spell');
      var cd = S.spellCd[sk] || 0;
      var cdEl = spellBtns[j].querySelector('.spell-cd');
      if (cdEl) text(cdEl, cd > 0 ? Math.ceil(cd) + 's' : '');
      spellBtns[j].classList.toggle('cooling', cd > 0);
    }
    if (S.selectedTower) updateTowerPanel(S.selectedTower);
    if (S.phase === 'playing') updateAimLabel();
  }

  function updateAimLabel() {
    if (!ui.aimLabel) return;
    if (S.buildType) {
      var conf = CFG.TOWERS[S.buildType];
      text(ui.aimLabel, '布阵：' + (conf ? conf.name : '') + ' · 点击发光阵位');
    } else if (S.gesture && S.gesture !== 'NONE') {
      text(ui.aimLabel, '手势：' + gestureName(S.gesture));
    } else {
      text(ui.aimLabel, '');
    }
  }

  function gestureName(g) {
    var map = { DRAGON: '剑指 · 辟邪神雷', LOTUS: '五指 · 莲花剑阵', DAGENG: '双指 · 大庚剑阵', GIANT: '八字 · 巨剑术', SHIELD: '握拳 · 青元剑盾' };
    return map[g] || g;
  }
  function gestureSpell(g) {
    var keys = Object.keys(CFG.SPELLS);
    for (var i = 0; i < keys.length; i++) if (CFG.SPELLS[keys[i]].gesture === g) return keys[i];
    return null;
  }

  function toast(msg) {
    if (!ui.toast) return;
    text(ui.toast, msg);
    show(ui.toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { hide(ui.toast); }, 1900);
  }
  function banner(title, sub) {
    if (!ui.banner) return;
    text(ui.bannerTitle, title);
    text(ui.bannerSub, sub || '');
    show(ui.banner);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { hide(ui.banner); }, 2600);
  }

  // ---------- 塔面板 ----------
  function showTowerPanel(tw) {
    if (!tw) return;
    S.selectedTower = tw;
    var stats = towerStats(tw);
    text(ui.tpName, tw.conf.name);
    text(ui.tpLevel, '第 ' + tw.level + ' 阶 / 3 阶');
    if (ui.tpStats) {
      ui.tpStats.innerHTML =
        '<span>伤害 <b>' + Math.round(stats.damage) + '</b></span>' +
        '<span>射程 <b>' + stats.range.toFixed(1) + '</b></span>' +
        '<span>间隔 <b>' + stats.interval.toFixed(2) + 's</b></span>';
    }
    if (ui.tpUpgrade) {
      if (tw.level >= 3) {
        text(ui.tpUpgrade, '已满阶');
        ui.tpUpgrade.disabled = true;
      } else {
        var cost = upgradeCost(tw);
        text(ui.tpUpgrade, '升级 · ' + cost + ' 灵力');
        ui.tpUpgrade.disabled = S.spirit < cost;
      }
    }
    if (ui.tpSell) text(ui.tpSell, '拆除 · 返还 ' + sellRefund(tw));
    show(ui.towerPanel);
  }
  function updateTowerPanel(tw) {
    if (!tw || !ui.towerPanel || ui.towerPanel.classList.contains('hidden')) return;
    var stats = towerStats(tw);
    if (ui.tpStats) {
      ui.tpStats.innerHTML =
        '<span>伤害 <b>' + Math.round(stats.damage) + '</b></span>' +
        '<span>射程 <b>' + stats.range.toFixed(1) + '</b></span>' +
        '<span>间隔 <b>' + stats.interval.toFixed(2) + 's</b></span>';
    }
    if (ui.tpUpgrade) {
      if (tw.level >= 3) { text(ui.tpUpgrade, '已满阶'); ui.tpUpgrade.disabled = true; }
      else { var cost = upgradeCost(tw); text(ui.tpUpgrade, '升级 · ' + cost + ' 灵力'); ui.tpUpgrade.disabled = S.spirit < cost; }
    }
  }
  function hideTowerPanel() {
    S.selectedTower = null;
    hide(ui.towerPanel);
    WORLD.hideRange();
  }

  // ---------- 瞄准/悬停 ----------
  function updateAimVisual() {
    if (!S || S.phase !== 'playing') return;
    var showAim = S.aimValid && (S.buildType || S.selectedSpell || (S.gesture && S.gesture !== 'NONE'));
    if (showAim) {
      var color = S.buildType ? CFG.TOWERS[S.buildType].color : 0x7fffe0;
      WORLD.showAim(S.aimPos, S.buildType ? CFG.TOWERS[S.buildType].range : 0.8, color, 0.55);
      var sc = WORLD.screenOf(S.aimPos);
      S.aimScreen = sc;
      if (ui.aimReticle) {
        ui.aimReticle.style.left = sc.x + 'px';
        ui.aimReticle.style.top = sc.y + 'px';
        setHidden(ui.aimReticle, !sc.visible);
      }
    } else {
      WORLD.hideAim();
      if (ui.aimReticle) hide(ui.aimReticle);
    }
  }

  function updateAimFromClient(clientX, clientY) {
    var g = WORLD.raycastGround(clientX, clientY);
    if (g) { S.aimPos.copy(g); S.aimValid = true; }
  }

  // ---------- 输入 ----------
  function bindCanvas() {
    var hoverSlot = -1;
    canvas.addEventListener('pointermove', function (ev) {
      if (!S || S.phase !== 'playing' || S.paused) return;
      updateAimFromClient(ev.clientX, ev.clientY);
      var slot = WORLD.raycastSlot(ev.clientX, ev.clientY);
      if (slot !== hoverSlot) {
        if (hoverSlot >= 0) {
          var oldTw = towerAtSlot(hoverSlot);
          WORLD.setSlotState(hoverSlot, { built: !!oldTw, hover: false, selected: !!(S.selectedTower && S.selectedTower.slotIndex === hoverSlot) });
        }
        hoverSlot = slot;
      }
      if (slot >= 0) {
        var tw = towerAtSlot(slot);
        if (S.buildType && !tw) {
          var conf = CFG.TOWERS[S.buildType];
          var affordable = S.spirit >= conf.cost;
          WORLD.setSlotState(slot, { built: false, hover: true, affordable: affordable });
          var pos = WORLD.slotPosition(slot);
          if (pos && affordable) WORLD.showRange(pos, conf.range, conf.color);
          else WORLD.hideRange();
        } else if (tw) {
          WORLD.setSlotState(slot, { built: true, hover: true, selected: true });
          WORLD.showRange(tw.pos, towerStats(tw).range, tw.conf.color);
        }
      } else if (!S.selectedTower) {
        WORLD.hideRange();
      }
    });
    canvas.addEventListener('pointerleave', function () {
      WORLD.hideRange();
      if (hoverSlot >= 0) {
        var tw = towerAtSlot(hoverSlot);
        WORLD.setSlotState(hoverSlot, { built: !!tw, hover: false, selected: !!(S.selectedTower && S.selectedTower.slotIndex === hoverSlot) });
      }
    });
    canvas.addEventListener('pointerdown', function (ev) {
      if (!S || S.phase !== 'playing' || S.paused) return;
      ev.preventDefault();
      updateAimFromClient(ev.clientX, ev.clientY);
      var slot = WORLD.raycastSlot(ev.clientX, ev.clientY);
      if (slot >= 0) {
        var tw = towerAtSlot(slot);
        if (tw) { showTowerPanel(tw); return; }
        if (S.buildType) { buildTower(slot, S.buildType); return; }
        toast('先选一座剑阵，再点击阵位布阵');
        return;
      }
      if (S.selectedTower) hideTowerPanel();
      if (S.selectedSpell) { castSpell(S.selectedSpell, S.aimPos); return; }
    });
    canvas.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      if (S.buildType) { S.buildType = null; WORLD.hideRange(); updateHud(true); toast('已取消布阵'); }
      else if (S.selectedTower) hideTowerPanel();
    });
    canvas.addEventListener('pointerup', function () { });
  }

  function bindUI() {
    if (ui.guideClose) ui.guideClose.addEventListener('click', closeGuide);
    if (ui.speedBtn) ui.speedBtn.addEventListener('click', toggleSpeed);
    if (ui.pauseBtn) ui.pauseBtn.addEventListener('click', togglePause);
    if (ui.resumeBtn) ui.resumeBtn.addEventListener('click', togglePause);
    if (ui.pauseHome) ui.pauseHome.addEventListener('click', toSelect);
    if (ui.resultRetry) ui.resultRetry.addEventListener('click', function () { startLevel(S.levelIndex); });
    if (ui.resultNext) ui.resultNext.addEventListener('click', function () {
      var next = S.levelIndex + 1;
      if (next < CFG.LEVELS.length) startLevel(next); else toSelect();
    });
    if (ui.resultHome) ui.resultHome.addEventListener('click', toSelect);
    if (ui.tpUpgrade) ui.tpUpgrade.addEventListener('click', function () { if (S.selectedTower) upgradeTower(S.selectedTower); });
    if (ui.tpSell) ui.tpSell.addEventListener('click', function () { if (S.selectedTower) sellTower(S.selectedTower); });
    if (ui.tpClose) ui.tpClose.addEventListener('click', hideTowerPanel);
    if (ui.gestureToggle) ui.gestureToggle.addEventListener('click', toggleGesture);

    var guideBtn = $('guide-btn');
    if (guideBtn) guideBtn.addEventListener('click', openGuide);

    document.querySelectorAll('.tower-card[data-tower]').forEach(function (card) {
      card.addEventListener('click', function () {
        var key = card.getAttribute('data-tower');
        if (!S || S.phase !== 'playing') return;
        if (S.buildType === key) { S.buildType = null; WORLD.hideRange(); toast('已取消布阵'); }
        else {
          S.buildType = key; S.selectedSpell = null;
          hideTowerPanel();
          toast('已选 ' + CFG.TOWERS[key].name + '：点击发光阵位布阵');
        }
        updateHud(true);
      });
    });
    document.querySelectorAll('.spell-btn[data-spell]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!S || S.phase !== 'playing') return;
        var key = btn.getAttribute('data-spell');
        S.selectedSpell = key;
        castSpell(key, S.aimValid ? S.aimPos : null);
      });
    });
  }

  function bindKeyboard() {
    window.addEventListener('keydown', function (ev) {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
      if (!S) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (S.phase === 'playing') {
          if (!ui.guide.classList.contains('hidden')) { closeGuide(); }
          else if (S.buildType) { S.buildType = null; WORLD.hideRange(); }
          else if (S.selectedTower) hideTowerPanel();
          else togglePause();
        }
        if (S.phase === 'victory' || S.phase === 'defeat') toSelect();
        return;
      }
      if (S.phase !== 'playing') return;
      if (ev.key === ' ' || ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); togglePause(); return; }
      if (ev.key === 'g' || ev.key === 'G') { toggleGesture(); return; }
      if (ev.key >= '1' && ev.key <= '5') {
        var key = Object.keys(CFG.SPELLS).filter(function (k) { return CFG.SPELLS[k].keyLabel === ev.key; })[0];
        if (key) castSpell(key, S.aimValid ? S.aimPos : null);
      }
    });
  }

  // ---------- 手势 ----------
  function toggleGesture() {
    if (!GEST) { toast('手势模块未加载'); return; }
    try {
      if (GEST.isEnabled) GEST.disable(); else GEST.enable();
    } catch (e) { console.warn('[QYTD] gesture toggle failed', e); }
    updateGestureState();
  }

  function updateGestureState() {
    var on = false;
    try { on = !!(GEST && GEST.isEnabled); } catch (e) { on = false; }
    text(ui.gestureState, on ? '手势识别：开启' : '手势识别：未开启');
    if (ui.gestureToggle) ui.gestureToggle.classList.toggle('active', on);
  }

  function bindGesture() {
    GEST = window.QYTDGesture || null;
    if (!GEST) { console.warn('[QYTD] QYTDGesture 未加载，手势控制不可用'); updateGestureState(); return; }
    try {
      // gesture.js 约定：onUpdate 为可赋值回调（也可函数式注册，做双保险）
      try { GEST.onUpdate = onGestureUpdate; } catch (e2) { try { GEST.onUpdate(onGestureUpdate); } catch (e3) { console.warn('[QYTD] gesture onUpdate 绑定失败', e3); } }
    } catch (e) { console.warn('[QYTD] gesture onUpdate 绑定失败', e); }
    updateGestureState();
  }

  function onGestureUpdate(d) {
    if (!S) return;
    S.gesture = d && d.gesture ? d.gesture : null;
    if (ui.gestureState) {
      if (d && d.present) {
        var name = d.gesture && d.gesture !== 'NONE' ? gestureName(d.gesture) : '已识别到手';
        text(ui.gestureState, '手势：' + name);
      } else {
        text(ui.gestureState, '手势：等待手掌入镜');
      }
    }
    if (d && d.present && typeof d.x === 'number' && typeof d.y === 'number') {
      // gesture.js 输出的 x/y 已是 CSS 像素坐标
      var ground = WORLD.raycastGround(d.x, d.y);
      if (ground) { S.aimPos.copy(ground); S.aimValid = true; }
    }
    if (d && d.present && d.gesture && d.gesture !== 'NONE') {
      var now = performance.now();
      if (S.gestureHeld !== d.gesture) {
        S.gestureHeld = d.gesture; S.gestureSince = now; S.gestureFired = false;
      } else if (!S.gestureFired && now - S.gestureSince >= 500) {
        S.gestureFired = true;
        var key = gestureSpell(d.gesture);
        if (key && S.phase === 'playing' && !S.paused) {
          if (castSpell(key, S.aimValid ? S.aimPos : null)) {
            WORLD.vfx.ring(S.aimPos, 1.2, CFG.SPELLS[key].color, 0.4, { opacity: 0.7 });
          }
        }
      }
    } else {
      S.gestureHeld = null; S.gestureFired = false;
    }
    // 骨架绘制由 gesture.js 负责（避免与模块双重覆盖）
  }

  // ---------- 暂停 / 速度 / 指引 ----------
  function togglePause() {
    if (!S || S.phase !== 'playing') return;
    S.paused = !S.paused;
    setHidden(ui.pause, !S.paused);
    updateHud(true);
  }
  function toggleSpeed() {
    if (!S) return;
    S.speed = S.speed === 1 ? 2 : 1;
    text(ui.speedBtn, '速度 ×' + S.speed);
    toast('战斗速度 ×' + S.speed);
  }
  var guidePausedGame = false;
  function openGuide() {
    guidePausedGame = false;
    if (S && S.phase === 'playing' && !S.paused) { S.paused = true; guidePausedGame = true; }
    show(ui.guide);
    saveGuideSeen();
  }
  function closeGuide() {
    hide(ui.guide);
    saveGuideSeen();
    if (guidePausedGame && S && S.phase === 'playing') { S.paused = false; }
    guidePausedGame = false;
  }

  // ---------- 结算 ----------
  function victory() {
    if (!S || S.phase !== 'playing') return;
    S.phase = 'victory';
    var lv = S.level;
    if (progress.cleared.indexOf(lv.index) < 0) progress.cleared.push(lv.index);
    var best = progress.best[S.levelIndex];
    if (!best || S.time < best.time) progress.best[S.levelIndex] = { time: Math.round(S.time), wave: S.level.waves.length };
    saveProgress();
    text(ui.resultTitle, lv.bossName + ' 已伏诛');
    var desc = '第 ' + lv.index + ' 关「' + lv.name + '」守山成功。用时 ' + fmtTime(S.time) +
      '，击杀 ' + S.stats.kills + '，漏怪 ' + S.stats.leaked + '，阵眼剩余 ' + Math.max(0, S.baseHp) + ' / ' + S.maxBaseHp + '。';
    var next = CFG.LEVELS[S.levelIndex + 1];
    if (next) desc += ' 下一关：' + next.bossName + '（' + next.realm + '）。';
    else desc += ' 四关皆破，青云山门无恙。';
    text(ui.resultDesc, desc);
    if (ui.resultNext) setHidden(ui.resultNext, !next);
    show(ui.result);
    hide(ui.bossBar);
    updateHud(true);
  }

  function defeat() {
    if (!S || S.phase !== 'playing') return;
    S.phase = 'defeat';
    S.paused = false;
    text(ui.resultTitle, '青云阵眼失守');
    text(ui.resultDesc, '第 ' + S.level.index + ' 关「' + S.level.name + '」失守。坚持到第 ' + S.wavesStarted + ' 波，击杀 ' + S.stats.kills +
      '。不妨先在弯道内侧布置莲花剑阵与大庚剑阵，再用巨剑术点杀厚甲。');
    if (ui.resultNext) hide(ui.resultNext);
    show(ui.result);
    hide(ui.bossBar);
    updateHud(true);
  }

  // ---------- 调试 API（无头验收用） ----------
  window.QYTD = {
    ready: false,
    get state() { return S; },
    get world() { return WORLD; },
    config: CFG,
    startLevel: function (index) { startLevel(index); return this.snapshot(); },
    toSelect: toSelect,
    addSpirit: function (n) { if (S) S.spirit += n; updateHud(true); return S ? S.spirit : 0; },
    buildTower: function (slotIndex, typeKey) { return buildTower(slotIndex, typeKey, true); },
    upgradeTower: function (slotIndex) {
      var tw = S ? S.towers.filter(function (t) { return t.slotIndex === slotIndex; })[0] : null;
      if (!tw) return false;
      return upgradeTower(tw);
    },
    sellTower: function (slotIndex) {
      var tw = S ? S.towers.filter(function (t) { return t.slotIndex === slotIndex; })[0] : null;
      if (!tw) return false;
      return sellTower(tw);
    },
    castSpell: function (key, x, z) {
      var aim = null;
      if (typeof x === 'number' && typeof z === 'number') aim = new THREE.Vector3(x, 0, z);
      return castSpell(key, aim);
    },
    setAutoSpells: function (on) { if (S) S.autoSpells = !!on; },
    setSpeed: function (mult) { if (S) { S.speed = mult; updateHud(true); } },
    forceBoss: function () { if (S && S.phase === 'playing' && !S.bossSpawned) { S.wavesStarted = S.level.waves.length; S.waveActive = false; S.waveQueue = []; S.bossPending = true; S.waveGap = 0.01; } },
    damageAll: function (n) { if (!S) return; S.enemies.slice().forEach(function (e) { damageEnemy(e, n); }); },
    killAll: function () { if (!S) return; S.enemies.slice().forEach(function (e) { if (!e.dead) { if (e.isBoss) { e.hp = 0; killEnemy(e, {}); } else killEnemy(e, {}); } }); },
    setBaseHp: function (n) { if (S) { S.baseHp = n; WORLD.setBaseHp(S.baseHp / S.maxBaseHp); updateHud(true); } },
    simulate: function (seconds, step) {
      if (!S) return null;
      step = step || 0.05;
      var steps = Math.min(40000, Math.ceil(seconds / step));
      for (var i = 0; i < steps; i++) {
        if (S.phase !== 'playing') break;
        stepGame(step);
        WORLD.update(step, S.time);
      }
      updateHud(true);
      return this.snapshot();
    },
    snapshot: function () {
      if (!S) return null;
      var boss = null;
      if (S.boss && !S.boss.dead) {
        boss = {
          name: S.boss.bossConf.name, hp: Math.round(S.boss.hp), maxHp: S.boss.maxHp,
          shield: Math.round(S.boss.shieldHp), t: Number(S.boss.t.toFixed(3))
        };
      }
      return {
        phase: S.phase, paused: S.paused, speed: S.speed,
        levelIndex: S.levelIndex, levelName: S.level ? S.level.name : null,
        bossName: S.level ? S.level.bossName : null,
        time: Number(S.time.toFixed(2)),
        spirit: Math.floor(S.spirit), baseHp: Math.max(0, S.baseHp), maxBaseHp: S.maxBaseHp,
        wave: { started: S.wavesStarted, active: S.waveActive, queue: S.waveQueue.length, bossSpawned: S.bossSpawned, gap: Number(S.waveGap.toFixed(2)) },
        enemies: S.enemies.length, boss: boss,
        towers: S.towers.map(function (tw) { return { slot: tw.slotIndex, type: tw.type, level: tw.level }; }),
        spellCd: Object.assign({}, S.spellCd),
        stats: Object.assign({}, S.stats),
        gesture: S.gesture,
        towerCount: WORLD ? WORLD.slotCount : 0
      };
    }
  };

  // 启动
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
