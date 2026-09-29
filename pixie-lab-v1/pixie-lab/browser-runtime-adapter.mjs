const text = (value) => String(value ?? '').trim();
const clone = (value) => value == null ? value : structuredClone(value);
const nowIso = () => new Date().toISOString();

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function required(value, label) {
  const out = text(value);
  if (!out) throw new Error(`${label} is required`);
  return out;
}

function normalizeCapabilities(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return freeze({
    tabs: source.tabs === true,
    observe: source.observe === true,
    url: source.url === true,
    title: source.title === true,
    domSummary: source.domSummary === true,
    screenshot: source.screenshot === true,
    navigate: source.navigate === true,
    activateTab: source.activateTab === true,
    click: source.click === true,
    type: source.type === true,
    scroll: source.scroll === true,
    receipt: source.receipt === true,
    reconnect: source.reconnect === true,
  });
}

function runtimeStatusFromObservation(input = {}) {
  const raw = text(input.status).toUpperCase();
  if (raw === 'FAILED') return 'FAIL';
  if (raw === 'OBSERVED' && (input.observedRef || input.page || input.screenshotDataUrl)) return 'PASS';
  return 'UNKNOWN';
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
}

export const BROWSER_RUNTIME_ADAPTER_SCHEMA = 'ERGASTERION_BROWSER_RUNTIME_ADAPTER_V1';

export function createNeutralBrowserRuntimeAdapter({
  now = nowIso,
  staleAfterMs = 20_000,
  commandTtlMs = 30_000,
} = {}) {
  const adapters = new Map();
  const tabsByAdapter = new Map();
  const observations = new Map();
  const screenshots = new Map();
  const receipts = new Map();
  const commandQueues = new Map();
  let sequence = 0;

  const timestampMs = (value) => {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function adapterState(adapterId) {
    return adapters.get(required(adapterId, 'adapterId')) || null;
  }

  function isLive(adapter) {
    return Boolean(adapter) && Date.now() - timestampMs(adapter.lastSeenAt) <= staleAfterMs;
  }

  function register(input = {}) {
    const adapterId = required(input.adapterId, 'adapterId');
    const declaration = freeze({
      schema: BROWSER_RUNTIME_ADAPTER_SCHEMA,
      adapterId,
      host: required(input.host || 'firefox-addon', 'host'),
      version: text(input.version) || 'UNKNOWN',
      protocolVersion: text(input.protocolVersion) || '1',
      capabilities: normalizeCapabilities(input.capabilities),
      limits: unique(input.limits),
      sourceRef: text(input.sourceRef) || `browser-adapter://${adapterId}`,
      registeredAt: now(),
      lastSeenAt: now(),
    });
    adapters.set(adapterId, declaration);
    if (!tabsByAdapter.has(adapterId)) tabsByAdapter.set(adapterId, new Map());
    if (!commandQueues.has(adapterId)) commandQueues.set(adapterId, []);
    return clone(declaration);
  }

  function heartbeat(input = {}) {
    const current = adapterState(input.adapterId);
    if (!current) throw new Error('BROWSER_ADAPTER_NOT_REGISTERED');
    const next = freeze({
      ...clone(current),
      lastSeenAt: now(),
      activeTabId: Number.isInteger(input.activeTabId) ? input.activeTabId : current.activeTabId ?? null,
    });
    adapters.set(next.adapterId, next);
    if (Array.isArray(input.tabs)) updateTabs(next.adapterId, input.tabs);
    return clone(next);
  }

  function updateTabs(adapterId, tabs = []) {
    const current = adapterState(adapterId);
    if (!current) throw new Error('BROWSER_ADAPTER_NOT_REGISTERED');
    const map = new Map();
    for (const item of tabs) {
      if (!Number.isInteger(item?.tabId)) continue;
      map.set(item.tabId, freeze({
        tabId: item.tabId,
        windowId: Number.isInteger(item.windowId) ? item.windowId : null,
        url: text(item.url) || null,
        title: text(item.title) || null,
        active: item.active === true,
        pinned: item.pinned === true,
        audible: item.audible === true,
        status: text(item.status) || null,
        lastSeenAt: now(),
      }));
    }
    tabsByAdapter.set(adapterId, map);
    return [...map.values()].map(clone);
  }

  function normalizeObservation(input = {}) {
    const adapter = adapterState(input.adapterId);
    if (!adapter) throw new Error('BROWSER_ADAPTER_NOT_REGISTERED');
    const observationId = required(input.observationId, 'observationId');
    const tab = input.tab && typeof input.tab === 'object' ? input.tab : {};
    if (!Number.isInteger(tab.tabId)) throw new Error('tab.tabId is required');
    const targetRef = `browser-tab://${adapter.adapterId}/${tab.windowId ?? 'unknown'}/${tab.tabId}`;
    const observedRef = `browser-observation://${adapter.adapterId}/${observationId}`;
    const screenshotRef = input.screenshotDataUrl
      ? `browser-screenshot://${adapter.adapterId}/${observationId}`
      : null;
    const runtimeStatus = runtimeStatusFromObservation({ ...input, observedRef });
    const evidenceRefs = unique([
      observedRef,
      ...(screenshotRef ? [screenshotRef] : []),
      ...(Array.isArray(input.evidenceRefs) ? input.evidenceRefs : []),
    ]);
    const unknowns = unique(input.unknowns);
    if (runtimeStatus === 'UNKNOWN' && !unknowns.length) unknowns.push('BROWSER_OBSERVATION_PARTIAL');

    return freeze({
      schema: BROWSER_RUNTIME_ADAPTER_SCHEMA,
      adapterId: adapter.adapterId,
      observationId,
      observedAt: text(input.observedAt) || now(),
      tab: freeze({
        tabId: tab.tabId,
        windowId: Number.isInteger(tab.windowId) ? tab.windowId : null,
        url: text(tab.url) || null,
        title: text(tab.title) || null,
        active: tab.active === true,
        pinned: tab.pinned === true,
        status: text(tab.status) || null,
      }),
      page: input.page && typeof input.page === 'object' ? freeze(clone(input.page)) : null,
      status: text(input.status).toUpperCase() || 'UNKNOWN',
      screenshotRef,
      targetRef,
      observedRef,
      evidenceRefs,
      unknowns,
      runtimeRecord: freeze({
        observationId,
        workId: text(input.workId) || null,
        checkpointId: text(input.checkpointId) || null,
        targetRef,
        observedRef,
        status: runtimeStatus,
        screenshotRefs: screenshotRef ? [screenshotRef] : [],
        evidenceRefs,
        unknowns,
        source: `BROWSER_ADAPTER:${adapter.adapterId}`,
      }),
    });
  }

  function observe(input = {}) {
    const observation = normalizeObservation(input);
    observations.set(observation.observedRef, observation);
    if (input.screenshotDataUrl && observation.screenshotRef) {
      const match = /^data:([^;,]+);base64,(.+)$/s.exec(String(input.screenshotDataUrl));
      if (match) {
        screenshots.set(observation.screenshotRef, {
          contentType: match[1],
          data: Buffer.from(match[2], 'base64'),
          capturedAt: observation.observedAt,
        });
      }
    }
    const tabMap = tabsByAdapter.get(observation.adapterId) || new Map();
    tabMap.set(observation.tab.tabId, freeze({ ...clone(observation.tab), lastSeenAt: now() }));
    tabsByAdapter.set(observation.adapterId, tabMap);
    return clone(observation);
  }

  function latest({ adapterId = null, tabId = null } = {}) {
    const values = [...observations.values()]
      .filter((item) => !adapterId || item.adapterId === adapterId)
      .filter((item) => !Number.isInteger(tabId) || item.tab.tabId === tabId)
      .sort((a, b) => timestampMs(a.observedAt) - timestampMs(b.observedAt));
    return clone(values.at(-1) || null);
  }

  function listTabs({ adapterId = null } = {}) {
    const out = [];
    for (const [id, map] of tabsByAdapter.entries()) {
      if (adapterId && id !== adapterId) continue;
      for (const tab of map.values()) out.push({ adapterId: id, ...clone(tab) });
    }
    return out.sort((a, b) => Number(b.active) - Number(a.active) || a.windowId - b.windowId || a.tabId - b.tabId);
  }

  function getScreenshot(ref) {
    const item = screenshots.get(text(ref));
    return item ? { ...item, data: Buffer.from(item.data) } : null;
  }

  function chooseLiveAdapter(action = {}) {
    const requested = text(action.adapterId);
    if (requested) {
      const adapter = adapterState(requested);
      return isLive(adapter) ? adapter : null;
    }
    return [...adapters.values()]
      .filter(isLive)
      .sort((a, b) => timestampMs(b.lastSeenAt) - timestampMs(a.lastSeenAt))[0] || null;
  }

  async function status() {
    const all = [...adapters.values()].map((adapter) => ({
      ...clone(adapter),
      live: isLive(adapter),
      state: isLive(adapter) ? 'LIVE' : 'STALE',
    }));
    const live = all.filter((item) => item.live);
    return freeze({
      available: live.length > 0,
      status: live.length ? 'LIVE' : all.length ? 'STALE' : 'UNAVAILABLE',
      schema: BROWSER_RUNTIME_ADAPTER_SCHEMA,
      adapters: all,
      tabCount: listTabs().length,
      latestObservation: latest(),
      createsAuthority: false,
    });
  }

  async function interact(action = {}) {
    const adapter = chooseLiveAdapter(action);
    if (!adapter) {
      return freeze({ ok: false, status: 'UNAVAILABLE', reason: 'BROWSER_ADAPTER_UNAVAILABLE' });
    }
    const type = text(action.type).toLowerCase();
    const capabilityKey = type === 'activate_tab' ? 'activateTab' : type;
    if (adapter.capabilities?.[capabilityKey] !== true) {
      return freeze({
        ok: false,
        status: 'REJECTED',
        reason: 'BROWSER_ACTION_UNSUPPORTED',
        adapterId: adapter.adapterId,
        actionType: type || null,
      });
    }

    sequence += 1;
    const commandId = text(action.commandId) || `BROWSER-CMD-${Date.now()}-${sequence}`;
    const command = freeze({
      schema: BROWSER_RUNTIME_ADAPTER_SCHEMA,
      commandId,
      adapterId: adapter.adapterId,
      action: clone(action),
      queuedAt: now(),
      expiresAt: new Date(Date.now() + commandTtlMs).toISOString(),
      status: 'QUEUED',
    });
    commandQueues.get(adapter.adapterId).push(command);
    return freeze({
      ok: true,
      status: 'QUEUED',
      commandId,
      adapterId: adapter.adapterId,
      createsAuthority: false,
    });
  }

  function pullCommands(adapterId) {
    const current = adapterState(adapterId);
    if (!current) throw new Error('BROWSER_ADAPTER_NOT_REGISTERED');
    const queue = commandQueues.get(adapterId) || [];
    const nowMs = Date.now();
    const alive = queue.filter((item) => timestampMs(item.expiresAt) > nowMs);
    commandQueues.set(adapterId, []);
    return alive.map(clone);
  }

  function acceptReceipt(input = {}) {
    const adapter = adapterState(input.adapterId);
    if (!adapter) throw new Error('BROWSER_ADAPTER_NOT_REGISTERED');
    const commandId = required(input.commandId, 'commandId');
    const receiptRef = `browser-receipt://${adapter.adapterId}/${commandId}`;
    const receiptStatus = text(input.status).toUpperCase() || 'UNKNOWN';
    const result = receiptStatus === 'REJECTED' || receiptStatus === 'FAILED' ? 'FAIL' : 'UNKNOWN';
    const unknowns = result === 'UNKNOWN'
      ? unique([...(input.unknowns || []), 'FOLLOW_UP_OBSERVATION_REQUIRED'])
      : unique(input.unknowns);
    const receipt = freeze({
      schema: BROWSER_RUNTIME_ADAPTER_SCHEMA,
      adapterId: adapter.adapterId,
      commandId,
      receiptRef,
      status: receiptStatus,
      completedAt: text(input.completedAt) || now(),
      followUpObservationId: text(input.followUpObservationId) || null,
      errorCode: text(input.errorCode) || null,
      runtimeInteraction: freeze({
        interactionId: commandId,
        observationId: text(input.followUpObservationId) || null,
        workId: text(input.workId) || null,
        checkpointId: text(input.checkpointId) || null,
        targetRef: text(input.targetRef) || `browser-adapter://${adapter.adapterId}`,
        action: clone(input.action ?? null),
        result,
        evidenceRefs: unique([receiptRef]),
        unknowns,
        source: `BROWSER_ADAPTER:${adapter.adapterId}`,
      }),
    });
    receipts.set(receiptRef, receipt);
    return clone(receipt);
  }

  return Object.freeze({
    schema: BROWSER_RUNTIME_ADAPTER_SCHEMA,
    register,
    heartbeat,
    updateTabs,
    observe,
    latest,
    listTabs,
    getScreenshot,
    pullCommands,
    acceptReceipt,
    status,
    interact,
  });
}
