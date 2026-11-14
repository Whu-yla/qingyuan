
(() => {
  'use strict';
  let config = {};
  try { config = JSON.parse(document.getElementById('qingyuan-unlock-config').textContent); } catch (_) {}
  const manager = window.QingyuanUnlockCore.create({
    config,
    // Promotion completion is intentionally session-only; no local receipt is restored.
    isAdVisible(){ const overlay=document.getElementById('author-ai-overlay'); return !document.hidden && !!overlay && !overlay.hidden; }
  });
  const overlay = document.getElementById('unlock-overlay'), panel = document.getElementById('unlock-panel');
  const list = document.getElementById('unlock-task-list'), closeButton = document.getElementById('unlock-close');
  const refreshButton = document.getElementById('unlock-refresh'), status = document.getElementById('unlock-status');
  const videoSection = document.getElementById('unlock-videos'), videoList = document.getElementById('unlock-video-list');
  const followGuide = document.getElementById('unlock-follow-guide'), followStatus = document.getElementById('unlock-follow-status');
  const followCheck = document.getElementById('unlock-follow-check');
  let hooks = {}, returnFocus = null, lastManual = 0;
  const rowMap = new Map();
  const bindings = [
    ['#inspect-entry','inspect'],['.formation-pill[data-mode="DAGENG"]','dageng'],
    ['#thunder-dragon-pill','dragon'],['#toggle-lightning-btn','lightning'],
    ['#toggle-sword-qi','qi'],['#toggle-split-btn','split'],['#toggle-split-retain-btn','split'],
    ['.formation-pill[data-mode="GIANT"]','giant'],['.formation-pill[data-mode="LOTUS"]','lotus'],
    ['#fx-window-heading','fx'],['#toggle-control-btn','hand'],['#camera-retry-button','hand'],
    ['.ui-window-option[aria-controls="fx-panel"]','fx']
  ];
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function setStatus(text) { status.textContent = text; }
  function isOpen(){ return !overlay.hidden; }
  function setFollowGuide(visible){
    followGuide.hidden = !visible;
    panel.classList.toggle('is-follow-guide',visible);
    document.getElementById('unlock-title').textContent=visible?'关注灰森森森':'剑诀解锁任务';
  }
  function showFollowGuide(){
    setFollowGuide(true);
    followStatus.textContent='关注后，回到此任务点击核验即可解锁。';
    followGuide.scrollTop=0;
    document.getElementById('unlock-follow-title').focus({preventScroll:true});
  }
  function close(restoreFocus = true){
    if (!isOpen()) return;
    overlay.hidden = true;
    setFollowGuide(false);
    document.getElementById('unlock-home-open').setAttribute('aria-expanded','false');
    hooks.onClose?.();
    if (restoreFocus) (returnFocus?.isConnected ? returnFocus : document.getElementById('unlock-home-open')).focus?.({preventScroll:true});
  }
  function open(feature){
    setFollowGuide(false);
    window.QingyuanInvitation?.close(false);
    if (!isOpen()) {
      returnFocus = document.activeElement;
      overlay.hidden = false;
      document.getElementById('unlock-home-open').setAttribute('aria-expanded','true');
      window.QingyuanAuthorPromo.close(false);
      hooks.onOpen?.();
      closeButton.focus({preventScroll:true});
    }
    render(manager.snapshot());
    const task=manager.taskFor(feature);
    if (task && rowMap.has(task.id)) rowMap.get(task.id).row.scrollIntoView?.({block:'nearest'});
    void manager.refresh().catch(() => setStatus('进度暂时无法读取，请稍后重试。'));
  }
  function requireFeature(feature) { if (manager.has(feature)) return true; open(feature); return false; }
  function applyLocks(){
    for (const [selector,id] of bindings) {
      for (const node of document.querySelectorAll(selector)) {
        if (node.dataset.unlockBaseTitle === undefined) node.dataset.unlockBaseTitle = node.title || '';
        const locked = !manager.has(id);
        node.dataset.unlockFeature = id;
        node.classList.toggle('is-feature-locked',locked);
        node.setAttribute('aria-disabled',String(locked));
        node.title = locked ? '完成任务解锁：' + manager.taskFor(id).reward : node.dataset.unlockBaseTitle;
      }
    }
    const fx = document.getElementById('fx-panel');
    if (!manager.has('fx')) fx.open = false;
    document.querySelectorAll('#fx-panel .fx-controls input').forEach(input => { input.disabled = !manager.has('fx'); });
  }
  function showVideos(){
    videoSection.hidden = false;
    renderVideos(manager.snapshot());
    videoSection.scrollIntoView?.({block:'nearest'});
  }
  function goTask(task){
    if(task.kind==='featuredTriple'){
      if(manager.snapshot().capabilities.navigate){
        void manager.navigate('video',task.bvid).catch(()=>setStatus('暂时无法打开视频，请稍后重试。'));
      }else{
        const link=document.createElement('a');link.href='https://www.bilibili.com/video/'+task.bvid;
        link.target='_blank';link.rel='noopener noreferrer';link.click();
      }
      return;
    }
    if (task.kind === 'ad') {
      close(false);
      const launcher = document.getElementById('author-ai-open');
      launcher.focus({preventScroll:true}); launcher.click(); return;
    }
    if (task.kind === 'follow') {
      showFollowGuide();
      return;
    }
    if (task.kind === 'invite') {
      if (typeof window.QingyuanInvitation?.open === 'function') { window.QingyuanInvitation.open(); return; }
      const adapter = window.QingyuanInvitationBridge;
      if (typeof adapter?.invite !== 'function') { setStatus('邀请任务暂未开放。'); return; }
      try {
        const request = adapter.invite();
        void Promise.resolve(request).then(()=>setStatus('邀请已发出；好友完成进入后，回来刷新进度。'))
          .catch(()=>setStatus('邀请暂时无法发出，请稍后重试。'));
      } catch (_) { setStatus('邀请暂时无法发出，请稍后重试。'); }
      return;
    }
    showVideos();
  }
  function renderVideos(snapshot){
    videoList.replaceChildren();
    if (!snapshot.refs.length) {
      videoList.appendChild(element('p','unlock-muted','任务视频暂未开放，请稍后再来。')); return;
    }
    snapshot.refs.forEach((ref,index)=>{
      const progress = snapshot.videos.find(x=>ref.bvid ? x.bvid===ref.bvid : x.aid===ref.aid);
      const bvid = ref.bvid || progress?.bvid;
      const node = element('a','unlock-video-link');
      node.href = 'https://www.bilibili.com/video/' + (bvid || 'av'+ref.aid);
      node.target='_blank';node.rel='noopener noreferrer';
      const title=element('span','', bvid==='BV1d44q6YEGK'?'指定三连视频':'任务视频 '+(index+1));
      const meta=element('small','',progress
        ? (progress.liked?'已点赞':'未点赞')+' · '+(progress.favorited?'已收藏':'未收藏')+' · 投币 '+progress.coinCount+' 枚'
        : '前往完成点赞、收藏与投币');
      node.append(title,meta,element('span','unlock-video-arrow','前往 ↗'));
      node.addEventListener('click',event=>{
        if (bvid && manager.snapshot().capabilities.navigate) {
          event.preventDefault();
          void manager.navigate('video',bvid).catch(()=>setStatus('暂时无法打开视频，请稍后重试。'));
        }
      });
      videoList.appendChild(node);
    });
  }
  for (const [index,task] of manager.definitions.entries()){
    const row=element('article','unlock-task');row.id='unlock-task-'+task.id;
    const number=element('span','unlock-task-number',String(index+1));
    const body=element('div','unlock-task-body');
    const title=element('h3','unlock-task-title',task.task);
    const reward=element('p','unlock-task-reward','解锁：'+task.reward);
    if(task.id==='dragon'){
      reward.appendChild(element('span','unlock-task-reward-warning','（施展神雷化形前需开启辟邪神雷。）'));
    }
    const progress=element('p','unlock-task-progress');
    const note=element('p','unlock-task-note');
    if(task.kind==='invite')note.textContent='生成邀请卡发送给好友；赏剑解锁以实际邀请成功回执为准。';
    if(task.kind==='featuredTriple')note.textContent='点击“去三连”直达指定视频，完成后回来刷新。';
    if(task.kind==='triples')note.textContent='两条不同视频均需点赞、收藏、至少投 1 枚币；指定视频也计入。';
    if(task.kind==='ad')note.textContent='倒计时未结束就关闭需重新计时。';
    const actions=element('div','unlock-task-actions');
    const go=element('button','unlock-go','去完成');go.type='button';
    const claim=element('button','unlock-claim','解锁');claim.type='button';
    go.addEventListener('click',()=>goTask(task));
    claim.addEventListener('click',()=>{
      if(manager.isTaskUnlocked(task.id)){
        close(false);
        if(task.features.length===1)hooks.activate?.(task.id);
      }else{
        void manager.claim(task.id).catch(()=>setStatus('解锁进度暂时无法保存，请稍后重试。'));
      }
    });
    body.append(title,reward,progress,note);actions.append(go,claim);row.append(number,body,actions);list.appendChild(row);
    rowMap.set(task.id,{row,progress,note,go,claim});
  }
  function render(snapshot){
    const promoCountdown=document.getElementById('author-ai-countdown');
    if(promoCountdown){
      const promotion=snapshot.tasks.find(task=>task.id==='dragon');
      promoCountdown.classList.toggle('is-complete',promotion.unlocked);
      promoCountdown.textContent=promotion.unlocked?'本次已解锁：辟邪神雷、神雷化形。':
        snapshot.adCountdown.active?'解锁倒计时 '+snapshot.adCountdown.remaining+' 秒 · 请保持此窗口打开':
        '点击推广入口后等待 5 秒，解锁辟邪神雷与神雷化形。';
    }
    document.getElementById('unlock-summary-count').textContent=snapshot.completedTasks+' / '+manager.definitions.length;
    document.getElementById('unlock-home-count').textContent=snapshot.completedTasks+'/'+manager.definitions.length;
    refreshButton.disabled=snapshot.busy;
    refreshButton.textContent=snapshot.busy?'同步中…':'刷新进度';
    setStatus(snapshot.status);
    for(const task of snapshot.tasks){
      const ui=rowMap.get(task.id);
      ui.row.classList.toggle('is-unlocked',task.unlocked);
      ui.row.classList.toggle('is-ready',task.eligible&&!task.unlocked);
      ui.progress.textContent=task.unlocked?(task.kind==='ad'?'已解锁 · 本次进入有效':'已解锁 · 可自行开启'):!task.available?'任务暂未开放':
        !task.known?'等待核验':task.kind==='ad'?(snapshot.adCountdown.active?'还需等待 '+snapshot.adCountdown.remaining+' 秒':'等待点击 · 倒计时 5 秒'):'进度 '+task.current+'/'+task.target;
      if(task.kind==='ad')ui.note.hidden=task.unlocked;
      ui.go.hidden=task.unlocked;
      ui.go.disabled=!task.available||snapshot.busy;
      ui.go.textContent=task.kind==='follow'?'去关注':task.kind==='invite'?'去邀请':task.kind==='ad'?'去点击':task.kind==='featuredTriple'?'去三连':'选视频';
      ui.claim.disabled=task.pending||(!task.unlocked&&!task.eligible);
      ui.claim.textContent=task.pending?'保存中…':task.unlocked?(task.features.length===1?(hooks.isActive?.(task.id)?'关闭':'开启'):'去使用'):'解锁';
    }
    applyLocks();
    hooks.onChange?.(snapshot);
    if(!videoSection.hidden)renderVideos(snapshot);
  }
  closeButton.addEventListener('click',()=>close());
  document.getElementById('unlock-follow-go').addEventListener('click',()=>{
    if (/^\d+$/.test(String(config.authorSpaceId || '')) && manager.snapshot().capabilities.navigate) {
      void manager.navigate('space',config.authorSpaceId).catch(()=>{
        if(isOpen()&&!followGuide.hidden)followStatus.textContent='主页暂时无法打开，请收起提示后点击游戏顶部的“+关注”或作者头像。';
      });
    } else close();
  });
  document.getElementById('unlock-follow-back').addEventListener('click',()=>{
    setFollowGuide(false);
    const ui=rowMap.get('dageng');
    ui.row.scrollIntoView?.({block:'nearest'});
    (ui.go.hidden?ui.claim:ui.go).focus({preventScroll:true});
  });
  let followCheckPending=false;
  followCheck.addEventListener('click',async()=>{
    if(followCheckPending)return;
    followCheckPending=true;followCheck.disabled=true;followCheck.textContent='正在核验关注…';
    followStatus.textContent='正在读取 B站关注状态，请稍候。';
    try{
      const snapshot=await manager.refresh(true), task=snapshot.tasks.find(item=>item.id==='dageng');
      if(task.unlocked || (task.eligible && await manager.claim('dageng'))){
        followStatus.textContent='已解锁大庚剑阵、巨剑术、莲花剑阵！返回游戏后可分别开启。';
      }else if(!task.known){
        followStatus.textContent='暂时无法核验，请在 B站 Toy 中登录后重试。';
      }else if(!task.eligible){
        followStatus.textContent='尚未检测到关注。请先点击顶部“+关注”，完成后再次核验。';
      }else followStatus.textContent=manager.snapshot().status;
    }catch(_){followStatus.textContent='核验失败，请稍后重试。';}
    finally{followCheckPending=false;followCheck.disabled=false;followCheck.textContent='我已关注，核验并解锁';}
  });
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  document.getElementById('unlock-home-open').addEventListener('click',()=>open());
  document.getElementById('unlock-menu-open').addEventListener('click',()=>open());
  document.getElementById('unlock-show-videos').addEventListener('click',showVideos);
  refreshButton.addEventListener('click',()=>{
    if(Date.now()-lastManual<1500)return;lastManual=Date.now();
    void manager.refresh(true).catch(()=>setStatus('进度暂时无法读取，请稍后重试。'));
  });
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.window-hide-button'))return;
    const target=event.target.closest?.('[data-unlock-feature]');
    if(target&&!manager.has(target.dataset.unlockFeature)){
      event.preventDefault();event.stopImmediatePropagation();open(target.dataset.unlockFeature);
    }
  },true);
  window.addEventListener('keydown',event=>{
    if(!isOpen())return;
    event.stopImmediatePropagation();
    if(event.code==='Escape'||event.key==='Escape'){event.preventDefault();close();return;}
    if(event.code==='Tab'||event.key==='Tab'){
      const items=[...panel.querySelectorAll('button:not([disabled]),a[href]')].filter(x=>!x.hidden&&!x.closest('[hidden]')&&x.getClientRects().length);
      const first=items[0],last=items.at(-1),active=document.activeElement;
      if(!first){event.preventDefault();closeButton.focus();return;}
      if(!panel.contains(active)){event.preventDefault();(event.shiftKey?last:first).focus();}
      else if(event.shiftKey&&active===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
    }
  },{capture:true});
  manager.subscribe(render);
  window.QingyuanUnlocks=Object.freeze({
    has:manager.has, require:requireFeature, open, close, recordAdClick:manager.recordAdClick,
    cancelAdCountdown:manager.cancelAdCountdown, resetAdSession:manager.resetAdSession, snapshot:manager.snapshot,
    privateUnlock:manager.privateUnlock, privateLock:manager.privateLock,
    get isPrivateUnlocked(){return manager.isPrivateUnlocked;},
    get isOpen(){return isOpen();},
    setHooks(next){hooks=next||{};render(manager.snapshot());if(isOpen())hooks.onOpen?.();},
    refresh:manager.refresh
  });
  window.addEventListener('pagehide',()=>{window.QingyuanAuthorPromo?.close(false);manager.resetAdSession();manager.privateLock();});
  document.addEventListener('visibilitychange',()=>manager.pauseAdClock());
  function boot(){void manager.initialize().catch(()=>{});}
  document.getElementById('bilibili-toy-sdk')?.addEventListener('load',boot,{once:true});
  document.addEventListener('DOMContentLoaded',boot,{once:true});
  window.addEventListener('pageshow',boot);
  boot();
})();


    
