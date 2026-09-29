const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const clone = (value) => value == null ? value : structuredClone(value);
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const ERGASTERION_RUNTIME_WORKBENCH_SCHEMA = 'ERGASTERION_RUNTIME_WORKBENCH_V1';

export function createRuntimeObservation({
  observationId,
  prototypeId = null,
  experimentId = null,
  variantId = null,
  workId = null,
  checkpointId = null,
  targetRef,
  observedRef,
  status = 'UNKNOWN',
  screenshotRefs = [],
  consoleRefs = [],
  networkRefs = [],
  logRefs = [],
  evidenceRefs = [],
  unknowns = [],
  source = 'EXTERNAL_RUNTIME_HOST',
  now = nowIso,
} = {}) {
  const evidence = unique(evidenceRefs);
  let normalized = upper(status || 'UNKNOWN');
  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(normalized)) normalized = 'UNKNOWN';
  if (['PASS', 'FAIL'].includes(normalized) && !evidence.length) normalized = 'UNKNOWN';

  const gaps = unique(unknowns);
  if (normalized === 'UNKNOWN' && !gaps.length) gaps.push('RUNTIME_STATUS_UNKNOWN');

  return freeze({
    schema: ERGASTERION_RUNTIME_WORKBENCH_SCHEMA,
    observationId: required(observationId, 'observationId'),
    prototypeId: text(prototypeId) || null,
    experimentId: text(experimentId) || null,
    variantId: text(variantId) || null,
    workId: text(workId) || null,
    checkpointId: text(checkpointId) || null,
    targetRef: required(targetRef, 'targetRef'),
    observedRef: required(observedRef, 'observedRef'),
    status: normalized,
    screenshotRefs: unique(screenshotRefs),
    consoleRefs: unique(consoleRefs),
    networkRefs: unique(networkRefs),
    logRefs: unique(logRefs),
    evidenceRefs: evidence,
    unknowns: gaps,
    source: required(source, 'source'),
    observedAt: now(),
    createsAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export function createRuntimeInteractionReceipt({
  interactionId,
  observationId = null,
  workId = null,
  checkpointId = null,
  targetRef,
  action,
  result = 'UNKNOWN',
  evidenceRefs = [],
  unknowns = [],
  source = 'EXTERNAL_RUNTIME_HOST',
  now = nowIso,
} = {}) {
  const evidence = unique(evidenceRefs);
  let normalized = upper(result || 'UNKNOWN');
  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(normalized)) normalized = 'UNKNOWN';
  if (['PASS', 'FAIL'].includes(normalized) && !evidence.length) normalized = 'UNKNOWN';

  return freeze({
    schema: ERGASTERION_RUNTIME_WORKBENCH_SCHEMA,
    interactionId: required(interactionId, 'interactionId'),
    observationId: text(observationId) || null,
    workId: text(workId) || null,
    checkpointId: text(checkpointId) || null,
    targetRef: required(targetRef, 'targetRef'),
    action: clone(action ?? null),
    result: normalized,
    evidenceRefs: evidence,
    unknowns: unique(unknowns),
    source: required(source, 'source'),
    interactedAt: now(),
    createsAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export function projectRuntimeWorkbench({
  state = {},
  selector = {},
  executorStatus = null,
  now = nowIso,
} = {}) {
  const observations = Array.isArray(state.runtimeObservations) ? state.runtimeObservations : [];
  const interactions = Array.isArray(state.runtimeInteractions) ? state.runtimeInteractions : [];
  const prototypes = Array.isArray(state.appPrototypes) ? state.appPrototypes : [];

  const filtered = observations.filter((item) => {
    if (selector.workId && item.workId !== selector.workId) return false;
    if (selector.checkpointId && item.checkpointId !== selector.checkpointId) return false;
    if (selector.prototypeId && item.prototypeId !== selector.prototypeId) return false;
    return true;
  });
  const latestObservation = filtered.at(-1) || null;
  const prototype = selector.prototypeId
    ? prototypes.find((item) => item.prototypeId === selector.prototypeId) || null
    : latestObservation?.prototypeId
      ? prototypes.find((item) => item.prototypeId === latestObservation.prototypeId) || null
      : prototypes.at(-1) || null;

  const relatedInteractions = interactions.filter((item) =>
    (!latestObservation || item.observationId === latestObservation.observationId)
    && (!selector.workId || item.workId === selector.workId)
  );

  return freeze({
    schema: ERGASTERION_RUNTIME_WORKBENCH_SCHEMA,
    projectedAt: now(),
    status: executorStatus?.available === true ? 'ACTIVE' : 'HOST_DEPENDENT',
    executor: clone(executorStatus),
    prototype: clone(prototype),
    latestObservation: clone(latestObservation),
    interactions: clone(relatedInteractions),
    evidence: latestObservation ? {
      screenshotRefs: clone(latestObservation.screenshotRefs),
      consoleRefs: clone(latestObservation.consoleRefs),
      networkRefs: clone(latestObservation.networkRefs),
      logRefs: clone(latestObservation.logRefs),
      evidenceRefs: clone(latestObservation.evidenceRefs),
      unknowns: clone(latestObservation.unknowns),
    } : null,
    directExecution: executorStatus?.available === true,
    createsTruth: false,
    createsAuthority: false,
    mergeAuthority: false,
    deployAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export async function inspectRuntimeExecutor({ executor = null } = {}) {
  if (!executor || typeof executor.status !== 'function') {
    return freeze({
      schema: ERGASTERION_RUNTIME_WORKBENCH_SCHEMA,
      ok: false,
      status: 'UNAVAILABLE',
      reason: 'RUNTIME_EXECUTOR_UNAVAILABLE',
      createsAuthority: false,
      approval: 'NOT_AN_APPROVAL',
    });
  }
  const status = await executor.status();
  return freeze({
    schema: ERGASTERION_RUNTIME_WORKBENCH_SCHEMA,
    ok: true,
    status: status?.available === true ? 'ACTIVE' : 'UNAVAILABLE',
    executor: clone(status),
    createsAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export async function executeRuntimeAction({ executor = null, action = {} } = {}) {
  if (!executor || typeof executor.interact !== 'function') {
    return freeze({
      schema: ERGASTERION_RUNTIME_WORKBENCH_SCHEMA,
      ok: false,
      status: 'UNAVAILABLE',
      reason: 'RUNTIME_INTERACTION_EXECUTOR_UNAVAILABLE',
      createsAuthority: false,
      approval: 'NOT_AN_APPROVAL',
    });
  }
  const result = await executor.interact(clone(action));
  return freeze({
    schema: ERGASTERION_RUNTIME_WORKBENCH_SCHEMA,
    ok: result?.ok === true,
    status: result?.status || (result?.ok ? 'PASS' : 'UNKNOWN'),
    result: clone(result),
    createsAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}
