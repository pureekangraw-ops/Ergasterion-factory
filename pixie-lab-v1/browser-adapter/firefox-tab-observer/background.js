const HUB_ORIGIN = 'https://go-hub.pureekangraw.workers.dev';
const API_ROOT = '/hub/api/factory-eye';
const PROTOCOL_VERSION = '2';
const HOST = 'firefox-addon';
const VERSION = '0.3.0';
const PAGE_SCHEMA = 'ERGASTERION_BROWSER_PAGE_SUMMARY_V2';
const HEARTBEAT_MS = 5000;
const COMMAND_POLL_MS = 2500;
const WATCH_POLL_MS = 15000;
const DEDICATED_WATCH_HOSTS = Object.freeze({
  github: 'github.com',
  cloudflare: 'dash.cloudflare.com',
});

const SESSION_KEYS = Object.freeze({
  id: 'ergasterionFactoryEyeSessionId',
  token: 'ergasterionFactoryEyeSessionToken',
  expiresAt: 'ergasterionFactoryEyeSessionExpiresAt',
});

let adapterId = null;
let registered = false;
let commandPollBusy = false;
let heartbeatBusy = false;

function isWebUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function idPart() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function loadAdapterId() {
  if (adapterId) return adapterId;
  const stored = await browser.storage.local.get('ergasterionAdapterId');
  adapterId = stored.ergasterionAdapterId || `FIREFOX-${idPart()}`;
  if (!stored.ergasterionAdapterId) {
    await browser.storage.local.set({ ergasterionAdapterId: adapterId });
  }
  return adapterId;
}

async function clearSession() {
  registered = false;
  await browser.storage.local.remove([
    SESSION_KEYS.id,
    SESSION_KEYS.token,
    SESSION_KEYS.expiresAt,
  ]);
}

async function loadSession() {
  const stored = await browser.storage.local.get([
    SESSION_KEYS.id,
    SESSION_KEYS.token,
    SESSION_KEYS.expiresAt,
  ]);
  const sessionId = stored[SESSION_KEYS.id];
  const sessionToken = stored[SESSION_KEYS.token];
  const expiresAt = Number(stored[SESSION_KEYS.expiresAt] || 0);
  if (!sessionId || !sessionToken || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    if (sessionId || sessionToken || expiresAt) await clearSession();
    return null;
  }
  return { sessionId, sessionToken, expiresAt };
}

async function sessionHeaders() {
  const session = await loadSession();
  if (!session) throw new Error('FACTORY_EYE_PAIRING_REQUIRED');
  return {
    'x-factory-eye-session-id': session.sessionId,
    'x-factory-eye-session-token': session.sessionToken,
  };
}

async function fetchHub(path, options = {}, { requiresSession = true } = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(requiresSession ? await sessionHeaders() : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${HUB_ORIGIN}${API_ROOT}${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body.code || body.error || `FACTORY_EYE_HTTP_${response.status}`;
    if (response.status === 403 || response.status === 410) {
      if (code === 'FACTORY_EYE_SESSION_INACTIVE' || code === 'FACTORY_EYE_SESSION_EXPIRED') {
        await clearSession();
      }
    }
    throw new Error(code);
  }
  return body;
}

async function pair(passcode) {
  const secret = String(passcode || '');
  if (!secret) throw new Error('OWNER_PASSCODE_REQUIRED');
  const id = await loadAdapterId();
  const result = await fetchHub('/session/start', {
    method: 'POST',
    headers: {
      'x-go-owner-passcode': secret,
    },
    body: JSON.stringify({ adapterId: id }),
  }, { requiresSession: false });

  if (!result.session_id || !result.session_token || !result.expires_at) {
    throw new Error('FACTORY_EYE_PAIRING_INVALID_RESPONSE');
  }

  await browser.storage.local.set({
    [SESSION_KEYS.id]: result.session_id,
    [SESSION_KEYS.token]: result.session_token,
    [SESSION_KEYS.expiresAt]: Number(result.expires_at),
  });
  registered = false;
  return {
    ok: true,
    adapterId: id,
    hubOrigin: result.hub_origin || HUB_ORIGIN,
    expiresAt: Number(result.expires_at),
  };
}

async function disconnect() {
  const session = await loadSession();
  if (session) {
    try {
      await fetchHub('/session/stop', {
        method: 'POST',
        body: JSON.stringify({ adapterId: await loadAdapterId() }),
      });
    } catch {}
  }
  await clearSession();
  return { ok: true };
}

function isDedicatedWatchTab(tab) {
  if (!isWebUrl(tab?.url)) return false;
  try {
    const url = new URL(tab.url);
    if (url.hostname === DEDICATED_WATCH_HOSTS.github) {
      return url.pathname.startsWith('/pureekangraw-ops/Ergasterion-factory');
    }
    return url.hostname === DEDICATED_WATCH_HOSTS.cloudflare;
  } catch {
    return false;
  }
}

function tabShape(tab) {
  return {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url || null,
    title: tab.title || null,
    active: tab.active === true,
    pinned: tab.pinned === true,
    audible: tab.audible === true,
    status: tab.status || null,
  };
}

async function currentTabs() {
  const tabs = await browser.tabs.query({});
  return tabs
    .filter((tab) => Number.isInteger(tab.id))
    .map(tabShape);
}

async function register() {
  const id = await loadAdapterId();
  const response = await fetchHub('/register', {
    method: 'POST',
    body: JSON.stringify({
      adapterId: id,
      host: HOST,
      version: VERSION,
      protocolVersion: PROTOCOL_VERSION,
      sourceRef: `moz-extension://factory-eye/${VERSION}`,
      capabilities: {
        tabs: true,
        observe: true,
        url: true,
        title: true,
        domSummary: true,
        screenshot: true,
        navigate: false,
        activateTab: false,
        click: false,
        type: false,
        scroll: false,
        receipt: true,
        reconnect: true,
      },
      limits: [
        'HTTP_HTTPS_CONTENT_ONLY',
        'NO_INPUT_VALUES_CAPTURED',
        'BOUNDED_SEMANTIC_SUMMARY',
        'NO_RAW_DOM_OR_IMAGE_BYTES',
        'PRIVILEGED_FIREFOX_PAGES_UNSUPPORTED',
        'REMOTE_BRIDGE_EYES_ONLY',
      ],
    }),
  });
  registered = response.ok === true;
  return response;
}

async function ensureRegistered() {
  if (!(await loadSession())) return false;
  if (registered) return true;
  try {
    await register();
    return true;
  } catch {
    registered = false;
    return false;
  }
}

async function heartbeat() {
  if (heartbeatBusy) return;
  heartbeatBusy = true;
  try {
    if (!(await ensureRegistered())) return;
    const tabs = await currentTabs();
    const active = tabs.find((tab) => tab.active) || null;
    await fetchHub('/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: await loadAdapterId(),
        activeTabId: active?.tabId ?? null,
        tabs,
      }),
    });
  } catch {
    registered = false;
  } finally {
    heartbeatBusy = false;
  }
}

async function pageObservation(tab) {
  if (!isWebUrl(tab?.url)) {
    return {
      ok: false,
      status: 'UNSUPPORTED',
      page: null,
      unknowns: ['TAB_SCHEME_UNSUPPORTED'],
    };
  }
  try {
    const response = await browser.tabs.sendMessage(tab.id, { type: 'ERGASTERION_OBSERVE_PAGE' });
    if (!response?.ok) {
      return {
        ok: false,
        status: 'PARTIAL',
        page: null,
        unknowns: [response?.error || 'CONTENT_OBSERVER_UNAVAILABLE'],
      };
    }
    const page = response.page || null;
    const observedVersion = String(page?.observerVersion || response?.contentScriptVersion || '');
    if (observedVersion !== VERSION) {
      return {
        ok: false,
        status: 'PARTIAL',
        page: null,
        contentScriptVersion: observedVersion || null,
        unknowns: ['STALE_SCRIPT_VERSION'],
      };
    }
    return {
      ok: true,
      status: 'OBSERVED',
      page,
      contentScriptVersion: observedVersion,
      unknowns: [],
    };
  } catch (error) {
    return {
      ok: false,
      status: 'PARTIAL',
      page: null,
      unknowns: [error?.message || 'CONTENT_OBSERVER_UNAVAILABLE'],
    };
  }
}

async function captureScreenshot(tab) {
  if (!tab?.active || !Number.isInteger(tab.windowId)) return null;
  try {
    return await browser.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 35,
    });
  } catch {
    return null;
  }
}

async function observeFromContentPulse(message, sender) {
  if (!(await ensureRegistered())) return { ok: false, error: 'FACTORY_EYE_PAIRING_REQUIRED' };

  const contentScriptVersion = String(message?.contentScriptVersion || '');
  if (contentScriptVersion !== VERSION) {
    return { ok: false, error: 'STALE_SCRIPT_VERSION' };
  }
  if (message?.visible !== true) {
    return { ok: false, error: 'CONTENT_PULSE_NOT_VISIBLE' };
  }

  const senderTab = sender?.tab;
  if (!senderTab || !Number.isInteger(senderTab.id)) {
    return { ok: false, error: 'CONTENT_PULSE_TAB_UNAVAILABLE' };
  }

  const page = message?.page;
  if (!page || page.schema !== PAGE_SCHEMA || page.capturesInputValues !== false || page.createsAuthority !== false) {
    return { ok: false, error: 'CONTENT_PULSE_PAGE_INVALID' };
  }

  const senderUrl = String(senderTab.url || sender?.url || '');
  const pageUrl = String(page.url || '');
  if (!isWebUrl(senderUrl) || !isWebUrl(pageUrl)) {
    return { ok: false, error: 'CONTENT_PULSE_URL_UNSUPPORTED' };
  }

  let sameOrigin = false;
  try {
    sameOrigin = new URL(senderUrl).origin === new URL(pageUrl).origin;
  } catch {}
  if (!sameOrigin) {
    return { ok: false, error: 'CONTENT_PULSE_URL_MISMATCH' };
  }

  const activeTabs = await browser.tabs.query({ active: true });
  const activeSender = activeTabs.some((tab) => tab.id === senderTab.id);
  if (!activeSender || senderTab.active !== true) {
    return { ok: false, error: 'CONTENT_PULSE_TAB_NOT_ACTIVE' };
  }

  const tab = senderTab;
  const screenshotDataUrl = await captureScreenshot(tab);
  const observationId = `OBS-${Date.now()}-${tab.id}-${idPart().slice(0, 8)}`;

  try {
    const result = await fetchHub('/observe', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: await loadAdapterId(),
        observationId,
        observedAt: new Date().toISOString(),
        tab: tabShape(tab),
        page,
        contentScriptVersion,
        evidenceReason: String(message?.reason || 'content-pulse'),
        documentVisible: true,
        documentFocused: message?.focused === true,
        screenshotDataUrl,
        status: 'OBSERVED',
        unknowns: [],
      }),
    });
    return {
      ok: true,
      observationId: result?.observation?.observationId || observationId,
    };
  } catch (error) {
    registered = false;
    return {
      ok: false,
      error: error?.message || 'CONTENT_PULSE_OBSERVATION_FAILED',
    };
  }
}

async function observeTab(tabId) {
  if (!(await ensureRegistered())) return null;
  let tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return null;
  }
  if (!tab || !Number.isInteger(tab.id)) return null;

  const observed = await pageObservation(tab);
  const screenshotDataUrl = await captureScreenshot(tab);
  const observationId = `OBS-${Date.now()}-${tab.id}-${idPart().slice(0, 8)}`;

  try {
    const result = await fetchHub('/observe', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: await loadAdapterId(),
        observationId,
        observedAt: new Date().toISOString(),
        tab: tabShape(tab),
        page: observed.page,
        contentScriptVersion: observed.contentScriptVersion || observed.page?.observerVersion || null,
        evidenceReason: 'background-observe',
        documentVisible: observed.page?.visibilityState === 'visible',
        documentFocused: observed.page?.documentFocused === true,
        screenshotDataUrl,
        status: observed.status,
        unknowns: observed.unknowns,
      }),
    });
    return result?.observation?.observationId || observationId;
  } catch {
    registered = false;
    return null;
  }
}

async function observeActiveTabs() {
  const tabs = await browser.tabs.query({ active: true });
  for (const tab of tabs) {
    if (Number.isInteger(tab.id)) await observeTab(tab.id);
  }
}

async function observeDedicatedWatchTabs() {
  if (!(await ensureRegistered())) return;
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (isDedicatedWatchTab(tab) && Number.isInteger(tab.id)) {
      await observeTab(tab.id);
    }
  }
}

async function pollCommands() {
  if (commandPollBusy) return;
  commandPollBusy = true;
  try {
    if (!(await ensureRegistered())) return;
    const id = await loadAdapterId();
    await fetchHub(`/commands?adapterId=${encodeURIComponent(id)}`, { method: 'GET' });
  } catch {
    registered = false;
  } finally {
    commandPollBusy = false;
  }
}

async function openPairingPage() {
  try {
    await browser.runtime.openOptionsPage();
  } catch {
    await browser.tabs.create({ url: browser.runtime.getURL('options.html') });
  }
}

async function status() {
  const session = await loadSession();
  return {
    ok: true,
    paired: Boolean(session),
    adapterId: await loadAdapterId(),
    hubOrigin: HUB_ORIGIN,
    version: VERSION,
    expiresAt: session?.expiresAt || null,
    registered,
  };
}

async function boot() {
  if (!(await loadSession())) return false;
  await ensureRegistered();
  await heartbeat();
  await observeActiveTabs();
  await observeDedicatedWatchTabs();
  return true;
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'ERGASTERION_FACTORY_EYE_CONTENT_PULSE') {
    return observeFromContentPulse(message, sender);
  }
  if (message?.type === 'ERGASTERION_FACTORY_EYE_STATUS') {
    return status();
  }
  if (message?.type === 'ERGASTERION_FACTORY_EYE_PAIR') {
    return (async () => {
      try {
        const paired = await pair(message.passcode);
        await boot();
        return { ...paired, status: await status() };
      } catch (error) {
        return { ok: false, error: error?.message || 'FACTORY_EYE_PAIR_FAILED' };
      }
    })();
  }
  if (message?.type === 'ERGASTERION_FACTORY_EYE_DISCONNECT') {
    return disconnect();
  }
  if (message?.type === 'ERGASTERION_FACTORY_EYE_REFRESH') {
    return (async () => {
      const started = await boot();
      return { ok: started, status: await status() };
    })();
  }
  return undefined;
});

browser.runtime.onInstalled.addListener(() => {
  void (async () => {
    if (!(await boot())) await openPairingPage();
  })();
});

browser.runtime.onStartup.addListener(() => { void boot(); });

browser.tabs.onActivated.addListener(({ tabId }) => {
  void heartbeat();
  setTimeout(() => { void observeTab(tabId); }, 150);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.active) {
    void heartbeat();
    setTimeout(() => { void observeTab(tabId); }, 150);
  }
});

browser.tabs.onCreated.addListener(() => { void heartbeat(); });
browser.tabs.onRemoved.addListener(() => { void heartbeat(); });
browser.tabs.onMoved.addListener(() => { void heartbeat(); });
browser.tabs.onAttached.addListener(() => { void heartbeat(); });
browser.tabs.onDetached.addListener(() => { void heartbeat(); });

browser.action.onClicked.addListener(async (tab) => {
  if (!(await loadSession())) {
    await openPairingPage();
    return;
  }
  await heartbeat();
  if (Number.isInteger(tab?.id)) await observeTab(tab.id);
});

setInterval(() => { void heartbeat(); }, HEARTBEAT_MS);
setInterval(() => { void pollCommands(); }, COMMAND_POLL_MS);
setInterval(() => { void observeDedicatedWatchTabs(); }, WATCH_POLL_MS);

void boot();
