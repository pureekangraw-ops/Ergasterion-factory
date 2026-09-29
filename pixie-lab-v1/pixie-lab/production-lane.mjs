const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const DEBUG_ROOM_ID = 'ROOM-D';

export function prepareProductionHandoff({
  handoffId,
  experimentId,
  variantId,
  workId,
  checkpointId,
  requestedResult,
  artifactRefs = [],
  evidenceRefs = [],
  unknowns = [],
  now = nowIso,
} = {}) {
  return freeze({
    handoffId: required(handoffId, 'handoffId'),
    experimentId: required(experimentId, 'experimentId'),
    variantId: required(variantId, 'variantId'),
    workId: required(workId, 'workId'),
    checkpointId: required(checkpointId, 'checkpointId'),
    requestedResult: required(requestedResult, 'requestedResult'),
    artifactRefs: [...new Set((artifactRefs || []).map(text).filter(Boolean))],
    evidenceRefs: [...new Set((evidenceRefs || []).map(text).filter(Boolean))],
    unknowns: [...new Set((unknowns || []).map(text).filter(Boolean))],
    status: 'READY_FOR_PRODUCTION_EVIDENCE',
    authorityTransferred: false,
    routeAuthorityCreated: false,
    approval: 'NOT_AN_APPROVAL',
    preparedAt: now(),
  });
}


/** Legacy PASS/Gate compatibility only. Not part of the CURRENT ERGASTERION flow. */
export function validateFactoryHandoffAuthority(pass = {}, { now = nowIso } = {}) {
  const kind = upper(pass.kind);
  if (upper(pass.state) !== 'ACTIVE') return { allowed: false, reason: 'FACTORY_HANDOFF_ACTIVE_PASS_REQUIRED' };
  if (!['MAINTENANCE', 'EMERGENCY'].includes(kind)) return { allowed: false, reason: 'FACTORY_HANDOFF_MAINTENANCE_OR_EMERGENCY_REQUIRED' };
  const destinations = Array.isArray(pass.allowedDestinations) ? pass.allowedDestinations.map(text) : [];
  if (!destinations.some((value) => ['factory', 'destination://factory', 'ALL_GO_HUB_OWNED_AREAS'].includes(value))) {
    return { allowed: false, reason: 'FACTORY_HANDOFF_FACTORY_SCOPE_REQUIRED' };
  }
  if (kind === 'EMERGENCY') {
    const expiry = Date.parse(text(pass.expiresAt));
    if (!Number.isFinite(expiry)) return { allowed: false, reason: 'FACTORY_HANDOFF_EMERGENCY_EXPIRY_REQUIRED' };
    if (expiry <= Date.parse(now())) return { allowed: false, reason: 'FACTORY_HANDOFF_EMERGENCY_PASS_EXPIRED' };
  }
  return { allowed: true, reason: null, kind };
}

/** Legacy Debug -> Factory route compatibility only. Prefer prepareProductionHandoff. */
export function prepareFactoryHandoff({
  roomId,
  pass,
  workId,
  checkpointId,
  purpose,
  payload = null,
  now = nowIso,
} = {}) {
  if (text(roomId) !== DEBUG_ROOM_ID) return freeze({ status: 'BLOCKED', reason: 'FACTORY_HANDOFF_DEBUG_ROOM_REQUIRED' });
  const auth = validateFactoryHandoffAuthority(pass, { now });
  if (!auth.allowed) return freeze({ status: 'BLOCKED', reason: auth.reason });
  return freeze({
    status: 'READY_FOR_FACTORY',
    route: 'destination://factory',
    source: `PIXIE-LAB/${DEBUG_ROOM_ID}`,
    workId: required(workId, 'workId'),
    checkpointId: required(checkpointId, 'checkpointId'),
    purpose: required(purpose, 'purpose'),
    payload: clone(payload),
    authority: { kind: auth.kind, holder: text(pass.holder) || null, state: 'ACTIVE' },
    hostExecutionRequired: true,
    pixieProductionAuthority: false,
    approval: 'NOT_AN_APPROVAL',
    preparedAt: now(),
  });
}
