
(() => {
  'use strict';
  const capabilities = Object.create(null);
  const streams = new Map();
  const listeners = new Set();
  let sdk = null, offContainer = null, containerState = null;
  let connecting = null, connectionSerial = 0, stateRevision = 0, mediaSerial = 0;
  let suspended = false, connected = false, pendingMode = null;
  const toyRoute = /(^|\.)bilibili\.com$/i.test(location.hostname) && /^\/toy(?:\/|$)/.test(location.pathname);
  function isPlatformPage() {
    // Toy runs inside a host iframe; its child URL can be a CDN URL or srcdoc.
    // The SDK relays camera requests to that host instead of using child permissions.
    let embedded = true;
    try { embedded = window.self !== window.top; } catch (_) {}
    return toyRoute || embedded || /BiliApp|BiliHarmony/i.test(navigator.userAgent) || Boolean(window.__TOY_META__?.toy_id);
  }

  function cameraError(code, message) {
    const error = new Error(message);
    error.cameraCode = code;
    return error;
  }
  function stopTracks(stream) {
    for (const track of stream?.getTracks?.() || []) {
      try { track.stop(); } catch (_) {}
    }
  }
  function stopMedia(stream) {
    if (!stream) return Promise.resolve();
    const owner = streams.get(stream);
    streams.delete(stream);
    let result;
    try {
      // Pass the exact MediaStream returned by this SDK instance.
      if (owner && typeof owner.stopMedia === 'function') result = owner.stopMedia(stream);
    } catch (_) {
      // Tracks are also stopped locally when a bridge disconnects during exit.
    } finally {
      stopTracks(stream);
    }
    return Promise.resolve(result).catch(() => {});
  }
  function stopAllMedia() {
    ++mediaSerial;
    for (const stream of [...streams.keys()]) void stopMedia(stream);
  }
  function retainStream(request, owner) {
    const serial = mediaSerial;
    return Promise.resolve(request).then(async stream => {
      streams.set(stream, owner);
      if (suspended || document.hidden || serial !== mediaSerial) {
        await stopMedia(stream);
        throw cameraError('CAMERA_CANCELLED', 'Camera request was cancelled while the page was inactive.');
      }
      return stream;
    });
  }
  function requestCamera(nativeConstraints) {
    // Standalone previews use the browser; embedded Toy pages use the host SDK.
    const platformPage = isPlatformPage();
    const api = platformPage ? (window.toy || sdk) : null;
    if (api) {
      if (typeof api.requestCamera !== 'function' || typeof api.stopMedia !== 'function') {
        return Promise.reject(cameraError('TOY_CAMERA_UNSUPPORTED', 'Toy camera capture is unavailable in this environment.'));
      }
      // Do not await isSupport or model loading here: preserve the click's user activation.
      try {
        return retainStream(api.requestCamera({ facingMode: 'user' }), api);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (platformPage) {
      return Promise.reject(cameraError('TOY_SDK_UNAVAILABLE', 'Toy SDK has not loaded. Retry after the connection recovers.'));
    }
    if (window.isSecureContext === false) {
      return Promise.reject(cameraError('INSECURE_CONTEXT', 'Camera requires a secure context.'));
    }
    try {
      const policy = document.permissionsPolicy || document.featurePolicy;
      if (policy?.allowsFeature && !policy.allowsFeature('camera')) {
        return Promise.reject(cameraError('CAMERA_POLICY', 'Embedding Permissions Policy blocks camera.'));
      }
    } catch (_) {}
    const media = navigator.mediaDevices;
    if (typeof media?.getUserMedia !== 'function') {
      return Promise.reject(cameraError('CAMERA_API', 'getUserMedia is unavailable.'));
    }
    const request = media.getUserMedia({ audio: false, video: nativeConstraints || { facingMode: { ideal: 'user' } } })
      .catch(error => {
        if (['OverconstrainedError', 'NotFoundError'].includes(error.name)) {
          return media.getUserMedia({ audio: false, video: true });
        }
        throw error;
      });
    return retainStream(request, null);
  }
  function acceptState(state) {
    const viewport = state?.viewport;
    if (!Number.isFinite(viewport?.width) || !Number.isFinite(viewport?.height) ||
        viewport.width <= 0 || viewport.height <= 0) return;
    const safeArea = {};
    for (const side of ['top', 'right', 'bottom', 'left']) {
      safeArea[side] = Number.isFinite(state.safeArea?.[side]) ? Math.max(0, state.safeArea[side]) : 0;
    }
    containerState = {
      deviceType: ['phone', 'tablet', 'desktop', 'unknown'].includes(state.deviceType) ? state.deviceType : 'unknown',
      viewport: { width: viewport.width, height: viewport.height },
      orientation: state.orientation === 'landscape' ? 'landscape' : 'portrait',
      immersive: state.immersive === true,
      safeArea
    };
    ++stateRevision;
    if (pendingMode &&
        (pendingMode.orientation === undefined || pendingMode.orientation === 'auto' || pendingMode.orientation === containerState.orientation) &&
        (pendingMode.immersive === undefined || pendingMode.immersive === containerState.immersive)) {
      pendingMode = null;
    }
    for (const listener of listeners) {
      try { listener(containerState); } catch (error) { console.warn('Toy layout update failed:', error); }
    }
  }
  function removeContainerListener() {
    if (typeof offContainer === 'function') {
      try { offContainer(); } catch (_) {}
    }
    offContainer = null;
  }
  function connect() {
    if (!isPlatformPage() || suspended) return Promise.resolve(false);
    if (connecting) return connecting;
    const api = window.toy;
    if (!api || typeof api.isSupport !== 'function') return Promise.resolve(false);
    if (sdk === api && connected) return Promise.resolve(true);
    sdk = api;
    const serial = ++connectionSerial;
    const work = (async () => {
      const names = ['requestCamera', 'stopMedia', 'onContainerChange', 'getContainerState', 'setContainerMode'];
      const support = await Promise.all(names.map(async name => {
        if (typeof api[name] !== 'function') return false;
        try { return await api.isSupport(name) === true; } catch (_) { return false; }
      }));
      if (serial !== connectionSerial || suspended) return false;
      names.forEach((name, i) => { capabilities[name] = support[i]; });
      removeContainerListener();
      if (capabilities.onContainerChange) {
        try {
          // onContainerChange synchronously returns the unsubscribe function.
          offContainer = api.onContainerChange(state => {
            if (serial === connectionSerial && !suspended) acceptState(state);
          });
        } catch (_) {
          capabilities.onContainerChange = false;
        }
      }
      if (capabilities.getContainerState) {
        const revision = stateRevision;
        try {
          const state = await api.getContainerState();
          if (serial === connectionSerial && !suspended && revision === stateRevision) acceptState(state);
        } catch (_) {}
      }
      if (serial === connectionSerial && !suspended) connected = true;
      return true;
    })();
    connecting = work;
    void work.finally(() => { if (connecting === work) connecting = null; }).catch(() => {});
    return work;
  }
  function setContainerMode(mode) {
    if (!sdk || !capabilities.setContainerMode || typeof offContainer !== 'function') {
      return Promise.resolve(false);
    }
    const request = { ...mode };
    pendingMode = request;
    try {
      return Promise.resolve(sdk.setContainerMode(request)).then(() => true).catch(error => {
        if (pendingMode === request) pendingMode = null;
        throw error;
      });
    } catch (error) {
      if (pendingMode === request) pendingMode = null;
      return Promise.reject(error);
    }
    // A resolved Promise acknowledges the request only; acceptState confirms its effect.
  }
  function suspend() {
    suspended = true;
    connected = false;
    ++connectionSerial;
    connecting = null;
    pendingMode = null;
    removeContainerListener();
    stopAllMedia();
  }
  function resume() {
    suspended = false;
    void connect();
  }
  window.QingyuanToyBridge = Object.freeze({
    connect, requestCamera, stopMedia, setContainerMode,
    get state() { return containerState; },
    get sdkAvailable() { return isPlatformPage() && Boolean(window.toy || sdk); },
    get isPlatformPage() { return isPlatformPage(); },
    get canControlContainer() { return Boolean(isPlatformPage() && sdk && capabilities.setContainerMode && typeof offContainer === 'function'); },
    get pendingMode() { return pendingMode; },
    subscribeContainer(listener) {
      listeners.add(listener);
      if (containerState) listener(containerState);
      return () => listeners.delete(listener);
    }
  });
  const script = document.getElementById('bilibili-toy-sdk');
  script?.addEventListener('load', () => { void connect(); }, { once: true });
  document.addEventListener('DOMContentLoaded', () => { void connect(); }, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAllMedia(); });
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', resume);
  void connect();
})();


    
