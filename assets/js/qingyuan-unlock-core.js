
(() => {
  'use strict';
  const definitions = Object.freeze([
    { id:'inspect', task:'成功邀请 1 名好友', reward:'赏剑', features:['inspect'], kind:'invite', target:1 },
    { id:'dageng', task:'关注灰森森森', reward:'大庚剑阵、巨剑术、莲花剑阵', features:['dageng','giant','lotus'], kind:'follow', target:1 },
    { id:'dragon', task:'点击「UP主同款游戏点击立即制作！」并等待 5 秒', reward:'辟邪神雷、神雷化形', features:['lightning','dragon'], kind:'ad', target:5 },
    { id:'qi', task:'给 BV1d44q6YEGK 视频一键三连', reward:'流云剑气、剑影分光', features:['qi','split'], kind:'featuredTriple', bvid:'BV1d44q6YEGK', target:1 },
    { id:'hand', task:'给任意 2 条任务视频一键三连', reward:'手势控制、灵力调节', features:['hand','fx'], kind:'triples', target:2 }
  ].map(item => Object.freeze({...item,features:Object.freeze(item.features)})));
  const known = new Set(definitions.flatMap(item => item.features));
  const taskFor = id => definitions.find(item => item.id === id || item.features.includes(id));
  // The promotion task is session-only. It must never be restored from an
  // earlier test account or persisted to Toy cloud storage.
  const sessionOnly = new Set(['lightning','dragon']);
  const storageKey = id => 'qy_ul_v1_' + id;
  function normalizeRef(value) {
    if (typeof value === 'string') {
      const match = value.match(/BV[0-9A-Za-z]{10}/);
      return match ? { bvid:match[0] } : null;
    }
    if (!value || typeof value !== 'object') return null;
    if (typeof value.bvid === 'string' && /^BV[0-9A-Za-z]{10}$/.test(value.bvid)) return { bvid:value.bvid };
    if (Number.isSafeInteger(value.aid) && value.aid > 0) return { aid:value.aid };
    return null;
  }
  function normalizeRefs(values) {
    const seen = new Set(), refs = [];
    for (const value of Array.isArray(values) ? values : []) {
      const ref = normalizeRef(value);
      if (!ref) continue;
      const key = ref.bvid || 'aid:' + ref.aid;
      if (seen.has(key)) continue;
      seen.add(key); refs.push(ref);
    }
    return refs;
  }
  function metricsFrom(items, refs, coinsPerTriple) {
    const aidRefs = new Set(refs.filter(x => x.aid).map(x => x.aid));
    const bvRefs = new Set(refs.filter(x => x.bvid).map(x => x.bvid));
    const seenAid = new Set(), seenBv = new Set(), videos = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (item?.status !== 'ok') continue;
      const ref = normalizeRef(item.ref);
      const matches = aidRefs.has(item.aid) || bvRefs.has(item.bvid) ||
        (ref && (aidRefs.has(ref.aid) || bvRefs.has(ref.bvid)));
      if (!matches || seenAid.has(item.aid) || seenBv.has(item.bvid)) continue;
      if (!Number.isSafeInteger(item.aid) || item.aid <= 0 || typeof item.bvid !== 'string') continue;
      seenAid.add(item.aid); seenBv.add(item.bvid);
      videos.push({
        aid:item.aid, bvid:item.bvid, liked:item.liked === true, favorited:item.favorited === true,
        coinCount:Number.isFinite(item.coinCount) ? Math.max(0, Math.floor(item.coinCount)) : 0
      });
    }
    return {
      likes:videos.filter(x => x.liked).length,
      favorites:videos.filter(x => x.favorited).length,
      coins:videos.reduce((sum,x) => sum + x.coinCount, 0),
      coinVideo:videos.reduce((max,x) => Math.max(max,x.coinCount), 0),
      triples:videos.filter(x => x.liked && x.favorited && x.coinCount >= coinsPerTriple).length,
      videos
    };
  }
  function create(options = {}) {
    const config = options.config || {};
    const refs = normalizeRefs(config.videos);
    const coinsPerTriple = 1;
    const getSdk = options.getSdk || (() => window.toy);
    const getInvitation = options.getInvitation || (() => window.QingyuanInvitationBridge);
    const notify = new Set(), unlocked = new Set(), synced = new Set(), pending = new Map();
    const caps = Object.create(null);
    let api = null, initWork = null, initialized = false, restoreDone = false, refreshWork = null;
    let following = false, followKnown = false, inviteCount = 0, inviteKnown = false;
    let metrics = metricsFrom([], refs, coinsPerTriple), videoKnown = false;
    let lastChecked = 0, status = '完成任务后，回来点“刷新进度”，再解锁对应内容。';
    let localAd = false;
    let adElapsed = localAd ? 5000 : 0, adTimer = null, adLastTick = 0;
    const now = options.now || (() => performance.now());
    // 私测解锁只存在于当前页面会话；离开页面后由 pagehide 清除。
    // 任务完成后的原有解锁记录继续生效；私测密码只是额外的一键全开入口。
    let privateUnlocked = false;
    if (localAd) taskFor('dragon').features.forEach(id => unlocked.add(id));
    function isUnlocked(id) { return known.has(id) && (privateUnlocked || unlocked.has(id)); }
    function isTaskUnlocked(id) { const item=taskFor(id);return !!item && item.features.every(isUnlocked); }
    function emit() { for (const fn of notify) fn(snapshot()); }
    function valueFor(kind) {
      if (kind === 'follow') return following ? 1 : 0;
      if (kind === 'invite') return inviteCount;
      if (kind === 'ad') return localAd ? 5 : Math.min(4,Math.floor(adElapsed/1000));
      if (kind === 'featuredTriple') return metrics.videos.some(x => x.bvid === taskFor('qi').bvid && x.liked && x.favorited && x.coinCount >= coinsPerTriple) ? 1 : 0;
      return metrics[kind] || 0;
    }
    function available(item) {
      if (item.kind === 'ad') return true;
      if (item.kind === 'invite') {
        const adapter = getInvitation();
        return typeof window.QingyuanInvitation?.open === 'function' ||
          (typeof adapter?.getVerifiedCount === 'function' && typeof adapter?.invite === 'function');
      }
      if (item.kind === 'follow') return true;
      return refs.length > 0;
    }
    function eligible(item) {
      if (!available(item)) return false;
      if (item.kind === 'follow' && !followKnown) return false;
      if (item.kind === 'invite' && !inviteKnown) return false;
      if (!['follow','invite','ad'].includes(item.kind) && !videoKnown) return false;
      return valueFor(item.kind) >= item.target;
    }
    function snapshot() {
      return {
        initialized, busy:!!refreshWork, status, lastChecked, refs:refs.map(x => ({...x})),
        unlocked:privateUnlocked ? [...known] : [...unlocked], completedTasks:definitions.filter(item=>isTaskUnlocked(item.id)).length,
        adCountdown:{active:adTimer!==null,remaining:Math.max(0,Math.ceil((5000-adElapsed)/1000)),complete:localAd},
        videos:metrics.videos.map(x => ({...x})), coinsPerTriple,
        capabilities:{...caps},
        tasks:definitions.map(item => ({
          ...item, available:available(item), current:Math.min(item.target,valueFor(item.kind)),
          eligible:privateUnlocked || eligible(item), unlocked:isTaskUnlocked(item.id), pending:pending.has(item.id),
          known:item.kind==='ad'||(item.kind==='follow'?followKnown:item.kind==='invite'?inviteKnown:videoKnown)
        }))
      };
    }
    async function initialize() {
      const candidate = getSdk();
      if (!candidate || typeof candidate.isSupport !== 'function') return false;
      if (initialized && api === candidate && (restoreDone || !caps.getCloudStorage)) return true;
      if (initWork) return initWork;
      const work = (async () => {
        api = candidate;
        const names = ['getAuthorRelation','getVideoUserActions','getCloudStorage','setCloudStorage','navigate'];
        const supported = await Promise.all(names.map(async name => {
          if (typeof api[name] !== 'function') return false;
          try { return await api.isSupport(name) === true; } catch (_) { return false; }
        }));
        names.forEach((name,i) => { caps[name] = supported[i]; });
        initialized = true;
        if (!restoreDone && caps.getCloudStorage) {
          try {
            const persisted = [...known].filter(id => !sessionOnly.has(id));
            const stored = await api.getCloudStorage(persisted.map(storageKey));
            for (const id of persisted) if (stored?.[storageKey(id)] === '1') {unlocked.add(id);synced.add(id);}
            restoreDone = true;
          } catch (_) {}
        }
        emit();
        if (localAd) taskFor('dragon').features.forEach(id=>unlocked.add(id));
        return true;
      })();
      initWork = work;
      void work.finally(() => { if (initWork === work) initWork = null; }).catch(() => {});
      return work;
    }
    async function refresh(force = false) {
      if (refreshWork) return refreshWork;
      if (!force && lastChecked && Date.now() - lastChecked < 30000) return snapshot();
      const work = (async () => {
        const ready = await initialize();
        following = false; followKnown = false; inviteCount = 0; inviteKnown = false;
        metrics = metricsFrom([], refs, coinsPerTriple); videoKnown = false;
        if (!ready) {
          status = '请在 B站 Toy 中打开并登录，再刷新任务进度。';
          return snapshot();
        }
        const relation = caps.getAuthorRelation ? Promise.resolve().then(()=>api.getAuthorRelation()) : Promise.resolve(null);
        const actions = caps.getVideoUserActions && refs.length
          ? (async () => {
              // The SDK accepts at most 50 videos per request; retain every configured video.
              const batches = [];
              for (let start = 0; start < refs.length; start += 50) {
                const videos = refs.slice(start,start + 50).map(x => ({...x}));
                batches.push(Promise.resolve().then(() => api.getVideoUserActions({videos})));
              }
              const results = await Promise.allSettled(batches);
              const responses = results.filter(x => x.status === 'fulfilled' &&
                ['ok','partial'].includes(x.value?.status)).map(x => x.value);
              if (!responses.length) return null;
              return {
                status:responses.length === results.length && responses.every(x => x.status === 'ok') ? 'ok' : 'partial',
                items:responses.flatMap(x => Array.isArray(x.items) ? x.items : [])
              };
            })() : Promise.resolve(null);
        const adapter = getInvitation();
        const invitation = typeof adapter?.getVerifiedCount === 'function'
          ? Promise.resolve().then(() => adapter.getVerifiedCount()) : Promise.resolve(null);
        const [r,v,i] = await Promise.allSettled([relation,actions,invitation]);
        if (r.status === 'fulfilled' && r.value?.status === 'ok') {
          followKnown = true;
          following = r.value.data?.isFollowing === true || r.value.data?.isAuthor === true;
        }
        if (v.status === 'fulfilled' && ['ok','partial'].includes(v.value?.status)) {
          metrics = metricsFrom(v.value.items, refs, coinsPerTriple);
          videoKnown = v.value.status === 'ok' || metrics.videos.length > 0;
        }
        // A share call resolving, a URL parameter or a local counter is never an invitation receipt.
        if (i.status === 'fulfilled' && i.value?.status === 'ok' && i.value.verified === true &&
            Number.isSafeInteger(i.value.count) && i.value.count >= 0) {
          inviteKnown = true; inviteCount = i.value.count;
        }
        lastChecked = Date.now();
        if (r.status === 'fulfilled' && r.value?.status === 'unauthorized') {
          status = '请先登录 B站，再回来刷新进度。';
        } else if (!refs.length) {
          status = '关注与推广任务可完成；视频任务暂未开放。';
        } else if (!videoKnown) {
          status = '视频互动暂时无法核验，请稍后刷新；已有解锁会保留。';
        } else if (v.value?.status === 'partial') {
          status = '已同步可核验的视频进度；部分视频暂时无法核验，可稍后刷新。';
        } else {
          status = '进度已同步。已完成的任务可点击“解锁”，之后自行开启功能。';
        }
        return snapshot();
      })();
      refreshWork = work; emit();
      try { return await work; }
      finally { if (refreshWork === work) refreshWork = null; emit(); }
    }
    async function save(id) {
      const item=taskFor(id);
      if (!item) return false;
      id=item.id;
      if (item.kind === 'ad') {
        if (!localAd) return false;
        item.features.forEach(feature=>unlocked.add(feature));
        status = '已解锁“' + item.reward + '”（本次进入有效）。';
        emit();
        return true;
      }
      if (item.features.every(feature=>synced.has(feature))) return true;
      if (pending.has(id)) return pending.get(id);
      const work = (async () => {
        await initialize();
        if (!caps.setCloudStorage || !api) {
          status = '请在 B站 Toy 中登录后保存解锁进度。';
          emit(); return false;
        }
        try {
          // Save the whole reward group in one write; retain independent legacy feature keys.
          await api.setCloudStorage(Object.fromEntries(item.features.map(feature=>[storageKey(feature),'1'])));
          item.features.forEach(feature=>{synced.add(feature);unlocked.add(feature);});
          status = '已解锁“' + item.reward + '”，可在招式栏或界面菜单分别开启。';
          emit(); return true;
        } catch (_) {
          status = '解锁进度暂时无法保存，请稍后重试。';
          emit(); return false;
        }
      })();
      pending.set(id,work); emit();
      try { return await work; }
      finally { pending.delete(id); emit(); }
    }
    async function claim(id) {
      const item = taskFor(id);
      if (!item) return false;
      if (isTaskUnlocked(item.id)) return true;
      if (item.kind === 'ad') {
        if (!localAd) {status='请点击推广入口并等待 5 秒倒计时结束。';emit();return false;}
        return save(item.id);
      }
      if (!lastChecked || Date.now()-lastChecked > 60000) await refresh(true);
      if (!eligible(item)) { status = '尚未达到任务要求，请完成后刷新进度。'; emit(); return false; }
      return save(item.id);
    }
    function recordAdClick() {
      if (isTaskUnlocked('dragon') || localAd || adTimer!==null) return;
      adElapsed=0;adLastTick=now();
      status='推广任务倒计时：5 秒，请保持弹窗打开。';
      adTimer=setInterval(()=>{
        const tick=now();
        if (options.isAdVisible?.() !== false) adElapsed+=Math.max(0,tick-adLastTick);
        adLastTick=tick;
        if (adElapsed>=5000) {
          clearInterval(adTimer);adTimer=null;adElapsed=5000;localAd=true;
          taskFor('dragon').features.forEach(id=>unlocked.add(id));
          status='倒计时结束，已解锁辟邪神雷、神雷化形；可分别开启。';
          emit();void save('dragon');
        }else emit();
      },100);
      emit();
    }
    function cancelAdCountdown() {
      if (adTimer===null) return;
      clearInterval(adTimer);adTimer=null;adElapsed=0;
      status='倒计时已中止，下次点击推广入口后重新等待 5 秒。';emit();
    }
    function resetAdSession() {
      if (adTimer !== null) clearInterval(adTimer);
      adTimer = null; adElapsed = 0; localAd = false;
      taskFor('dragon').features.forEach(feature => { unlocked.delete(feature); synced.delete(feature); });
      status = '推广任务需重新点击入口并观看 5 秒，解锁仅本次进入有效。';
      emit();
    }
    function navigate(kind, value) {
      if (api && caps.navigate) {
        try { return Promise.resolve(api.navigate({type:kind,id:String(value)})); }
        catch (error) { return Promise.reject(error); }
      }
      return Promise.reject(new Error('请在 B站 Toy 中完成此操作。'));
    }
    return Object.freeze({
      initialize, refresh, claim, recordAdClick, cancelAdCountdown, resetAdSession, navigate, snapshot,taskFor,isTaskUnlocked,
      pauseAdClock(){adLastTick=now();},
      privateUnlock() {
        privateUnlocked = true;
        status = '私测功能已开启。';
        emit();
        return true;
      },
      privateLock() {
        if (!privateUnlocked) return false;
        privateUnlocked = false;
        status = '完成任务后，回来点“刷新进度”，再解锁对应内容。';
        emit();
        return true;
      },
      get isPrivateUnlocked() { return privateUnlocked; },
      has(id) { return isUnlocked(id); },
      subscribe(fn) { notify.add(fn); fn(snapshot()); return () => notify.delete(fn); },
      get definitions() { return definitions; }
    });
  }
  window.QingyuanUnlockCore = Object.freeze({create,normalizeRefs,metricsFrom,definitions});
})();


    
