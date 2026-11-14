/* 本地复刻：所有剑诀默认解锁。
   本文件只保留 app.js 依赖的最小接口（has / require / setHooks / isOpen），
   不再包含任何任务、账号、邀请、关注、三连或推广逻辑，也不发起任何网络请求。 */
(() => {
  'use strict';
  const FEATURES = Object.freeze(['inspect', 'dageng', 'giant', 'lotus', 'lightning', 'dragon', 'qi', 'split', 'hand', 'fx']);
  const STATUS = '全部剑诀已解锁，可直接开启任意招式。';
  const snapshot = () => Object.freeze({
    initialized: true,
    busy: false,
    status: STATUS,
    lastChecked: 0,
    refs: [],
    videos: [],
    unlocked: FEATURES.slice(),
    completedTasks: 0,
    tasks: [],
    adCountdown: { active: false, remaining: 0, complete: true },
    capabilities: {}
  });
  window.QingyuanUnlocks = Object.freeze({
    has: () => true,
    require: () => true,
    setHooks(hooks) { if (hooks && typeof hooks.onChange === 'function') hooks.onChange(); },
    initialize: () => Promise.resolve(true),
    refresh: () => Promise.resolve(snapshot()),
    snapshot,
    subscribe(listener) { listener(snapshot()); return () => {}; },
    claim: () => true,
    recordAdClick() {},
    cancelAdCountdown() {},
    resetAdSession() {},
    pauseAdClock() {},
    privateUnlock: () => true,
    privateLock: () => false,
    navigate: () => Promise.reject(new Error('本地复刻：不提供站外跳转。')),
    get isPrivateUnlocked() { return true; },
    get isOpen() { return false; },
    get definitions() { return []; }
  });
  window.QingyuanUnlockCore = Object.freeze({ definitions: Object.freeze([]) });
})();
