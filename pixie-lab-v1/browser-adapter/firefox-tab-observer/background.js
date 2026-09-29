const FACTORY_ORIGIN = 'http://127.0.0.1:4317';
const PROTOCOL_VERSION = '1';
const HOST = 'firefox-addon';
const VERSION = '0.2.0';
const HEARTBEAT_MS = 5000;
const COMMAND_POLL_MS = 1200;

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

async function fetchJson(path, options = {}) {
  const response = await fetch(`${FACTORY_ORIGIN}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `FACTORY_HTTP_${response.status}`);
  return body;
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
  const response = await fetchJson('/api/browser/register', {
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
        navigate: true,
        activateTab: true,
        click: false,
        type: false,
        scroll: false,
        receipt: true,
        reconnect: true,
      },
      limits: [
        'HTTP_HTTPS_CONTENT_ONLY',
        'NO_INPUT_VALUES_CAPTURED',
        'PRIVILEGED_FIREFOX_PAGES_UNSUPPORTED',
      ],
    }),
  });
  registered = response.ok === true;
  return response;
}

async function ensureRegistered() {
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
    await fetchJson('/api/browser/heartbeat', {
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
    return {
      ok: true,
      status: 'OBSERVED',
      page: response.page || null,
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
      quality: 55,
    });
  } catch {
    return null;
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
    const result = await fetchJson('/api/browser/observe', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: await loadAdapterId(),
        observationId,
        observedAt: new Date().toISOString(),
        tab: tabShape(tab),
        page: observed.page,
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

function waitForTabComplete(tabId, timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    };
    browser.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeoutMs);
  });
}

async function executeCommand(command) {
  const action = command?.action || {};
  const type = String(action.type || '').toLowerCase();
  const tabId = Number(action.tabId);

  if (type === 'activate_tab') {
    if (!Number.isInteger(tabId)) throw new Error('TAB_ID_REQUIRED');
    await browser.tabs.update(tabId, { active: true });
    return { tabId };
  }

  if (type === 'navigate') {
    if (!Number.isInteger(tabId)) throw new Error('TAB_ID_REQUIRED');
    if (!isWebUrl(action.url)) throw new Error('NAVIGATION_URL_UNSUPPORTED');
    await browser.tabs.update(tabId, { url: action.url });
    await waitForTabComplete(tabId);
    return { tabId, url: action.url };
  }

  if (type === 'observe_tab') {
    if (!Number.isInteger(tabId)) throw new Error('TAB_ID_REQUIRED');
    return { tabId };
  }

  throw new Error('BROWSER_ACTION_UNSUPPORTED');
}

async function sendReceipt(command, status, details = {}) {
  const action = command?.action || {};
  let followUpObservationId = null;
  const tabId = Number(action.tabId);
  if (status === 'EXECUTED' && Number.isInteger(tabId)) {
    followUpObservationId = await observeTab(tabId);
  }

  try {
    await fetchJson('/api/browser/receipt', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: await loadAdapterId(),
        commandId: command.commandId,
        status,
        completedAt: new Date().toISOString(),
        followUpObservationId,
        targetRef: Number.isInteger(tabId)
          ? `browser-tab://${await loadAdapterId()}/unknown/${tabId}`
          : `browser-adapter://${await loadAdapterId()}`,
        action,
        errorCode: details.errorCode || null,
        unknowns: details.unknowns || [],
        workId: action.workId || null,
        checkpointId: action.checkpointId || null,
      }),
    });
  } catch {
    registered = false;
  }
}

async function pollCommands() {
  if (commandPollBusy) return;
  commandPollBusy = true;
  try {
    if (!(await ensureRegistered())) return;
    const id = await loadAdapterId();
    const result = await fetchJson(`/api/browser/commands?adapterId=${encodeURIComponent(id)}`);
    for (const command of result.commands || []) {
      try {
        await executeCommand(command);
        await sendReceipt(command, 'EXECUTED');
      } catch (error) {
        await sendReceipt(command, 'REJECTED', {
          errorCode: error?.message || 'BROWSER_COMMAND_FAILED',
        });
      }
    }
  } catch {
    registered = false;
  } finally {
    commandPollBusy = false;
  }
}

async function boot() {
  await ensureRegistered();
  await heartbeat();
  await observeActiveTabs();
}

browser.runtime.onInstalled.addListener(() => { void boot(); });
browser.runtime.onStartup.addListener(() => { void boot(); });

browser.tabs.onActivated.addListener(({ tabId }) => {
  void heartbeat();
  setTimeout(() => { void observeTab(tabId); }, 120);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.active) {
    void heartbeat();
    setTimeout(() => { void observeTab(tabId); }, 120);
  }
});

browser.tabs.onCreated.addListener(() => { void heartbeat(); });
browser.tabs.onRemoved.addListener(() => { void heartbeat(); });
browser.tabs.onMoved.addListener(() => { void heartbeat(); });
browser.tabs.onAttached.addListener(() => { void heartbeat(); });
browser.tabs.onDetached.addListener(() => { void heartbeat(); });

browser.action.onClicked.addListener(async (tab) => {
  await heartbeat();
  if (Number.isInteger(tab?.id)) await observeTab(tab.id);
});

setInterval(() => { void heartbeat(); }, HEARTBEAT_MS);
setInterval(() => { void pollCommands(); }, COMMAND_POLL_MS);

void boot();
