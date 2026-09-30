const text = (value) => String(value ?? '').trim();
const required = (value, label) => {
  const result = text(value);
  if (!result) throw new Error(`${label} is required`);
  return result;
};
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))];
const clone = (value) => value == null ? value : structuredClone(value);
const nowIso = () => new Date().toISOString();

export const HUB_FACTORY_PROTOCOL = 'GO_HUB_ERGASTERION_FACTORY_V1';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function identity(input = {}) {
  return {
    handoffId: required(input.handoffId, 'handoffId'),
    workId: required(input.workId, 'workId'),
    checkpointId: required(input.checkpointId, 'checkpointId'),
  };
}

export function receiveHubFactoryHandoff(input = {}) {
  const protocol = text(input.protocol) || HUB_FACTORY_PROTOCOL;
  if (protocol !== HUB_FACTORY_PROTOCOL) throw new Error('HUB_FACTORY_PROTOCOL_UNSUPPORTED');
  const id = identity(input);
  const source = text(input.source) || 'PRYTANEION';
  if (source !== 'PRYTANEION') throw new Error('HUB_FACTORY_SOURCE_INVALID');
  const destination = text(input.destination) || 'ERGASTERION';
  if (destination !== 'ERGASTERION') throw new Error('HUB_FACTORY_DESTINATION_INVALID');
  return freeze({
    protocol,
    ...id,
    source,
    destination,
    experimentId: text(input.experimentId) || null,
    variantId: text(input.variantId) || null,
    requestedResult: required(input.requestedResult, 'requestedResult'),
    candidateRefs: unique(input.candidateRefs),
    artifactRefs: unique(input.artifactRefs),
    evidenceRefs: unique(input.evidenceRefs),
    unknowns: unique(input.unknowns),
    status: 'RECEIVED',
    authorityTransferred: false,
    routeAuthorityCreated: false,
    approval: 'NOT_AN_APPROVAL',
    receivedAt: (input.now || nowIso)(),
  });
}

export function createHubFactoryReadback({ handoff, status = 'UNKNOWN', artifactRefs = [], evidenceRefs = [], unknowns = [], result = null, now = nowIso } = {}) {
  if (!handoff || handoff.protocol !== HUB_FACTORY_PROTOCOL) throw new Error('HUB_FACTORY_HANDOFF_REQUIRED');
  const id = identity(handoff);
  return freeze({
    protocol: HUB_FACTORY_PROTOCOL,
    ...id,
    source: 'ERGASTERION',
    destination: 'PRYTANEION',
    status: required(status, 'status'),
    artifactRefs: unique([...clone(handoff.artifactRefs || []), ...artifactRefs]),
    evidenceRefs: unique([...clone(handoff.evidenceRefs || []), ...evidenceRefs]),
    unknowns: unique([...clone(handoff.unknowns || []), ...unknowns]),
    result: clone(result),
    authorityTransferred: false,
    routeAuthorityCreated: false,
    approval: 'NOT_AN_APPROVAL',
    returnedAt: now(),
  });
}

export function projectHubFactoryReadback(readback = null) {
  if (!readback) return null;
  return {
    protocol: readback.protocol || HUB_FACTORY_PROTOCOL,
    handoffId: readback.handoffId || null,
    workId: readback.workId || null,
    checkpointId: readback.checkpointId || null,
    status: readback.status || 'UNKNOWN',
    artifactRefs: clone(readback.artifactRefs || []),
    evidenceRefs: clone(readback.evidenceRefs || []),
    unknowns: clone(readback.unknowns || []),
    result: clone(readback.result),
    authorityTransferred: false,
    routeAuthorityCreated: false,
    approval: 'NOT_AN_APPROVAL',
  };
}
