const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const IMAGE_TOOL_TARGET = 'GO_IMAGE_TOOL';

export function createImageActionRequest(renderPacket, {
  actionId,
  workId = null,
  checkpointId = null,
  requestedBy = 'GO',
  now = nowIso,
} = {}) {
  if (!renderPacket?.packetId || renderPacket?.targetTool !== IMAGE_TOOL_TARGET) throw new Error('GO_IMAGE_RENDER_PACKET_REQUIRED');
  return freeze({
    actionId: required(actionId, 'actionId'),
    packetId: renderPacket.packetId,
    visualDraftId: renderPacket.visualDraftId || null,
    targetTool: IMAGE_TOOL_TARGET,
    workId: text(workId) || null,
    checkpointId: text(checkpointId) || null,
    requestedBy: required(requestedBy, 'requestedBy'),
    status: 'REQUEST_READY',
    payload: {
      sourceRef: renderPacket.sourceRef || null,
      sourceVersion: renderPacket.sourceVersion || null,
      sourceHash: renderPacket.sourceHash || null,
      workingSpec: clone(renderPacket.workingSpec || {}),
      intent: renderPacket.intent,
      requestedResult: renderPacket.requestedResult,
      mustKeep: clone(renderPacket.mustKeep || []),
      mustRemove: clone(renderPacket.mustRemove || []),
      copy: clone(renderPacket.copy || []),
      constraints: clone(renderPacket.constraints || []),
      evidenceRefs: clone(renderPacket.evidenceRefs || []),
      unknowns: clone(renderPacket.unknowns || []),
    },
    externalExecutionRequired: true,
    providerAuthorityGranted: false,
    productionAuthority: false,
    createdAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}

export function acceptImageActionResult(request, {
  providerJobId = null,
  artifactRef = null,
  receiptRef = null,
  status = 'UNKNOWN',
  evidenceRefs = [],
  unknowns = [],
  error = null,
  now = nowIso,
} = {}) {
  if (!request?.actionId || request?.targetTool !== IMAGE_TOOL_TARGET) throw new Error('IMAGE_ACTION_REQUEST_REQUIRED');
  let normalized = upper(status || 'UNKNOWN');
  if (!['ARTIFACT_RETURNED', 'REQUEST_FAILED', 'UNKNOWN'].includes(normalized)) normalized = 'UNKNOWN';
  if (normalized === 'ARTIFACT_RETURNED' && !text(artifactRef)) normalized = 'UNKNOWN';
  return freeze({
    receiptId: `RECEIPT-${request.actionId}`,
    actionId: request.actionId,
    packetId: request.packetId,
    providerJobId: text(providerJobId) || null,
    artifactRef: text(artifactRef) || null,
    receiptRef: text(receiptRef) || null,
    status: normalized,
    evidenceRefs: unique(evidenceRefs),
    unknowns: unique(unknowns),
    error: text(error) || null,
    returnedAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}
