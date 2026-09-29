const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

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
    workbench: 'PRODUCTION_EVIDENCE_WORKBENCH',
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

export function projectProductionCandidate(handoff = null) {
  if (!handoff) return null;
  return freeze({
    handoffId: handoff.handoffId || null,
    experimentId: handoff.experimentId || null,
    variantId: handoff.variantId || null,
    workId: handoff.workId || null,
    checkpointId: handoff.checkpointId || null,
    requestedResult: handoff.requestedResult || null,
    artifactRefs: clone(handoff.artifactRefs || []),
    evidenceRefs: clone(handoff.evidenceRefs || []),
    unknowns: clone(handoff.unknowns || []),
    status: handoff.status || 'UNKNOWN',
    authorityTransferred: false,
    routeAuthorityCreated: false,
    approval: 'NOT_AN_APPROVAL',
  });
}
