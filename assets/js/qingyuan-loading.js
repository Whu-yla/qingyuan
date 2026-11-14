(() => {
  'use strict';
  const screen = document.getElementById('qingyuan-loading');
  const stage = document.getElementById('app-stage');
  const status = document.getElementById('qy-loading-status');
  const hint = document.getElementById('qy-loading-hint');
  const progress = document.getElementById('qy-loading-progress');
  const percent = document.getElementById('qy-loading-percent');
  const retry = document.getElementById('qy-loading-retry');
  const sources = [...document.querySelectorAll('script[data-startup][src]')];
  const guards = ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','touchend','click','dblclick','contextmenu','wheel','keydown','keyup'];
  let state = 'loading', value = 0, slowTimer = null, finishing = false;

  // Allow the loading page to paint between downloads and CPU-heavy scene stages.
  function paint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  function blockInput(event) {
    if (state === 'ready' || screen.contains(event.target)) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  for (const name of guards) window.addEventListener(name,blockInput,{capture:true,passive:false});
  retry.addEventListener('click',() => location.reload());

  function armSlowNotice() {
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      if (state !== 'loading') return;
      hint.textContent = '加载时间较长，仍在准备中。请保持页面打开，也可以重新加载。';
      retry.hidden = false;
    },20000);
  }
  function update(next,text) {
    if (state !== 'loading') return;
    value = Math.max(value,Math.min(99,next));
    progress.value = value;
    percent.textContent = Math.round(value) + '%';
    status.textContent = text;
    armSlowNotice();
  }
  function fail(error, message = '游戏未能加载完成，请检查网络后重试。') {
    if (state !== 'loading') return;
    state = 'error';
    clearTimeout(slowTimer);
    screen.classList.add('is-error');
    screen.setAttribute('aria-busy','false');
    status.textContent = '加载未完成';
    hint.textContent = message;
    retry.hidden = false;
    console.error('Qingyuan loading failed:',error);
  }
  async function ready() {
    if (state !== 'loading' || finishing) return;
    finishing = true;
    clearTimeout(slowTimer);
    progress.value = 100;
    percent.textContent = '100%';
    status.textContent = '准备就绪，即将进入…';
    await paint();
    if (state !== 'loading') return;
    state = 'ready';
    stage.removeAttribute('inert');
    stage.setAttribute('aria-busy','false');
    screen.setAttribute('aria-busy','false');
    screen.hidden = true;
    document.documentElement.classList.remove('is-booting');
    for (const name of guards) window.removeEventListener(name,blockInput,true);
    window.dispatchEvent(new Event('qingyuan-ready'));
  }
  window.QingyuanLoading = Object.freeze({
    async step(next,text) {
      if (state === 'error') throw new Error('Game startup has stopped');
      update(next,text);
      await paint();
    },
    ready,fail,
    get state() { return state; }
  });

  function loadElement(node,label) {
    return new Promise((resolve,reject) => {
      let timer;
      const finish = error => {
        clearTimeout(timer);
        node.onload = node.onerror = null;
        if (error) reject(error); else resolve();
      };
      node.onload = () => finish();
      node.onerror = () => finish(new Error('Resource failed: ' + label));
      timer = setTimeout(() => finish(new Error('Resource timed out: ' + label)),60000);
      document.head.appendChild(node);
    });
  }
  window.addEventListener('error',event => {
    if (state !== 'loading' || !event.filename) return;
    if (sources.some(source => source.src === event.filename)) {
      fail(event.error || event.message,'游戏组件初始化失败，请重新加载；若仍失败，请重新打开游戏。');
    }
  });

  async function start() {
    update(2,'正在准备游戏资源…');
    await paint();
    // Preload in parallel, then execute in the original dependency order.
    for (const source of sources) {
      const preload = document.createElement('link');
      preload.rel = 'preload';preload.as = 'script';preload.href = source.src;
      document.head.appendChild(preload);
    }
    const styleSource = document.getElementById('qingyuan-game-style');
    const style = document.createElement('link');
    style.rel = 'stylesheet';style.href = styleSource.href;
    await loadElement(style,'界面样式');
    for (const [index,source] of sources.entries()) {
      if (state !== 'loading') return;
      update(5 + index / sources.length * 53,'正在加载' + source.dataset.startup + '（' + (index+1) + ' / ' + sources.length + '）');
      await paint();
      const script = document.createElement('script');
      script.src = source.src;script.async = false;
      await loadElement(script,source.dataset.startup);
    }
    // Only the first successfully rendered game frame can dismiss the screen.
  }
  armSlowNotice();
  void start().catch(error => fail(error));
})();
