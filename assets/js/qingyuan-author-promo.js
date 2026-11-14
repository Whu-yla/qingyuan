
(() => {
  'use strict';
  const siteUrl = 'https://aish.chatopens.vip';
  const launcher = document.getElementById('author-ai-open');
  const overlay = document.getElementById('author-ai-overlay');
  const panel = document.getElementById('author-ai-card');
  const closeButton = document.getElementById('author-ai-close');
  const copyButton = document.getElementById('author-ai-copy');
  const copyStatus = document.getElementById('author-ai-copy-status');
  let hooks = {}, returnFocus = null;

  function open() {
    if (!overlay.hidden) return;
    window.QingyuanInvitation?.close(false);
    window.QingyuanUnlocks?.close(false);
    returnFocus = document.activeElement;
    overlay.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    copyStatus.textContent = '';
    hooks.onOpen?.();
    closeButton.focus({ preventScroll: true });
  }
  function close(restoreFocus = true) {
    if (overlay.hidden) return;
    overlay.hidden = true;
    window.QingyuanUnlocks?.cancelAdCountdown?.();
    launcher.setAttribute('aria-expanded', 'false');
    hooks.onClose?.();
    if (restoreFocus) {
      const target = returnFocus?.isConnected ? returnFocus : launcher;
      target.focus?.({ preventScroll: true });
    }
  }
  function handleKey(event) {
    if (overlay.hidden) return;
    // Keep every game shortcut behind the modal; leave browser copy/link activation intact.
    event.stopImmediatePropagation();
    if (event.code === 'Escape' || event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.code === 'Tab' || event.key === 'Tab') {
      const items = [...panel.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')];
      const first = items[0], last = items.at(-1), active = document.activeElement;
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (!panel.contains(active)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault(); first.focus();
      }
    }
  }
  async function copyUrl() {
    let copied = false;
    try {
      if (typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(siteUrl);
        copied = true;
      }
    } catch (_) {}
    if (!copied) {
      const input = document.createElement('textarea');
      input.value = siteUrl;
      input.readOnly = true;
      input.tabIndex = -1;
      input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;user-select:text;-webkit-user-select:text;';
      panel.appendChild(input);
      try {
        input.focus();
        input.select();
        input.setSelectionRange(0, siteUrl.length);
        copied = typeof document.execCommand === 'function' && document.execCommand('copy') === true;
      } catch (_) {
      } finally {
        input.remove();
        if (!overlay.hidden) copyButton.focus({ preventScroll: true });
      }
    }
    copyStatus.textContent = copied ? '网址已复制，可以粘贴到浏览器打开。' : '复制未成功，请长按网址复制。';
  }
  launcher.addEventListener('click', event => { event.stopPropagation(); open(); window.QingyuanUnlocks?.recordAdClick(); });
  closeButton.addEventListener('click', event => { event.stopPropagation(); close(); });
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  copyButton.addEventListener('click', event => { event.stopPropagation(); void copyUrl(); });
  window.addEventListener('keydown', handleKey, { capture: true });

  // One sweep per page load. Removing this class also prevents a replay after hiding/restoring the HUD.
  const finishSheen = () => launcher.classList.remove('has-initial-sheen');
  requestAnimationFrame(() => {
    launcher.classList.add('has-initial-sheen');
    setTimeout(finishSheen, 2100);
  });
  launcher.addEventListener('animationend', event => {
    if (event.animationName === 'authorPromoSheen') finishSheen();
  });
  window.addEventListener('pagehide', finishSheen);

  window.QingyuanAuthorPromo = Object.freeze({
    open, close,
    get isOpen() { return !overlay.hidden; },
    setHooks(next) {
      hooks = next || {};
      if (!overlay.hidden) hooks.onOpen?.();
    }
  });
})();


    
