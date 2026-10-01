const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
const nowIso = () => new Date().toISOString();

export const IMAGE_TOOL_TARGET = 'GO_IMAGE_TOOL';
export const DISPATCH_ACTION_TYPES = Object.freeze(['GENERATE', 'EDIT']);
export const DISPATCH_STATUSES = Object.freeze(['PREPARED', 'SENT', 'WAITING_RESULT', 'RECEIVED', 'FAILED', 'CANCELLED']);
export const RECEIPT_STATUSES = Object.freeze(['RECEIVED', 'LINKED', 'UNKNOWN', 'REJECTED']);

function authorityEnvelope() {
  return { targetTool: IMAGE_TOOL_TARGET, imageGenerationAuthority: false, productionAuthority: false, approval: 'NOT_AN_APPROVAL' };
}

function packetContext(packet) {
  return {
    sourceRefs: clone(packet.references || []),
    focusFrame: clone(packet.focusFrame || null),
    references: clone(packet.references || []),
    intentLinks: clone(packet.intentLinks || []),
    freezeSet: unique(packet.freezeSet),
    exploreSet: unique(packet.exploreSet),
    promotedParts: clone(packet.promotedParts || []),
    nextIntent: clone(packet.nextIntent || null),
    requestedResult: text(packet.requestedResult) || null,
    selectedResultRefs: unique(packet.selectedResultRefs),
    winnerRef: text(packet.winnerRef) || null,
    compareNotes: clone(packet.compareNotes || []),
  };
}

export function createVisualDispatchContract(packet, {
  dispatchId,
  visualDraftId = packet?.visualDraftId,
  branchId = packet?.branchId || null,
  workId,
  checkpointId,
  actionType = 'GENERATE',
  sourceResultRefs = [],
  targetResultRef = null,
  requestedBy = 'PIXIE',
  attempt = 1,
  retryOfDispatchId = null,
  createdAt,
  now = nowIso,
} = {}) {
  if (!packet?.packetId || packet?.targetTool !== IMAGE_TOOL_TARGET) throw new Error('VISUAL_RENDER_PACKET_REQUIRED');
  const action = upper(actionType);
  if (!DISPATCH_ACTION_TYPES.includes(action)) throw new Error('VISUAL_DISPATCH_ACTION_INVALID');
  const draftId = required(visualDraftId, 'visualDraftId');
  if (draftId !== packet.visualDraftId) throw new Error('VISUAL_DISPATCH_DRAFT_MISMATCH');
  const cleanWorkId = required(workId, 'workId');
  const cleanCheckpointId = required(checkpointId, 'checkpointId');
  const selected = unique(sourceResultRefs.length ? sourceResultRefs : packet.selectedResultRefs);
  const target = text(targetResultRef) || null;
  if (action === 'EDIT' && !target) throw new Error('VISUAL_EDIT_TARGET_REQUIRED');
  if (action === 'EDIT' && selected.length && !selected.includes(target)) throw new Error('VISUAL_EDIT_TARGET_NOT_IN_CONTEXT');
  const attemptNumber = Number(attempt);
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) throw new Error('VISUAL_DISPATCH_ATTEMPT_INVALID');
  return Object.freeze({
    dispatchId: required(dispatchId, 'dispatchId'),
    packetId: packet.packetId,
    visualDraftId: draftId,
    branchId: text(branchId) || null,
    workId: cleanWorkId,
    checkpointId: cleanCheckpointId,
    actionType: action,
    sourceResultRefs: selected,
    targetResultRef: target,
    ...packetContext(packet),
    attempt: attemptNumber,
    retryOfDispatchId: text(retryOfDispatchId) || null,
    status: 'PREPARED',
    requestedBy: required(requestedBy, 'requestedBy'),
    createdAt: text(createdAt) || now(),
    externalExecutionRequired: true,
    ...authorityEnvelope(),
  });
}

const allowedTransitions = {
  PREPARED: ['SENT', 'WAITING_RESULT', 'CANCELLED'],
  SENT: ['WAITING_RESULT', 'RECEIVED', 'FAILED', 'CANCELLED'],
  WAITING_RESULT: ['RECEIVED', 'FAILED', 'CANCELLED'],
  RECEIVED: [], FAILED: [], CANCELLED: [],
};

export function updateVisualDispatchStatus(dispatch, status, { providerJobId = null, error = null, evidenceRefs = [], now = nowIso } = {}) {
  if (!dispatch?.dispatchId) throw new Error('VISUAL_DISPATCH_REQUIRED');
  const next = upper(status);
  if (!DISPATCH_STATUSES.includes(next)) throw new Error('VISUAL_DISPATCH_STATUS_INVALID');
  if (next !== dispatch.status && !allowedTransitions[dispatch.status]?.includes(next)) throw new Error('VISUAL_DISPATCH_STATUS_TRANSITION_INVALID');
  return Object.freeze({ ...clone(dispatch), status: next, providerJobId: text(providerJobId) || dispatch.providerJobId || null, error: text(error) || null, evidenceRefs: unique([...(dispatch.evidenceRefs || []), ...evidenceRefs]), updatedAt: now() });
}

export function isUsableVisualReceipt(receipt) {
  return Boolean(receipt?.artifactRef)
    && upper(receipt?.readbackStatus) === 'VERIFIED'
    && receipt?.artifactUsable === true
    && Array.isArray(receipt?.evidenceRefs)
    && receipt.evidenceRefs.length > 0;
}

export function createVisualReceipt(dispatch, {
  receiptId,
  packetId = dispatch?.packetId,
  visualDraftId = dispatch?.visualDraftId,
  branchId = dispatch?.branchId || null,
  artifactRef = null,
  sourceResultRefs = dispatch?.sourceResultRefs || [],
  status = 'RECEIVED',
  evidenceRefs = [],
  executorIdentity = IMAGE_TOOL_TARGET,
  providerJobId = null,
  error = null,
  readbackStatus = 'UNKNOWN',
  artifactUsable = false,
  createdAt,
  receivedAt,
  now = nowIso,
} = {}) {
  if (!dispatch?.dispatchId) throw new Error('VISUAL_DISPATCH_REQUIRED');
  if (text(packetId) !== dispatch.packetId) throw new Error('VISUAL_RECEIPT_PACKET_MISMATCH');
  if (text(visualDraftId) !== dispatch.visualDraftId) throw new Error('VISUAL_RECEIPT_DRAFT_MISMATCH');
  if (text(branchId) !== text(dispatch.branchId)) throw new Error('VISUAL_RECEIPT_BRANCH_MISMATCH');
  if (text(executorIdentity) !== IMAGE_TOOL_TARGET) throw new Error('VISUAL_RECEIPT_EXECUTOR_INVALID');
  const normalized = upper(status);
  if (!RECEIPT_STATUSES.includes(normalized)) throw new Error('VISUAL_RECEIPT_STATUS_INVALID');
  const artifact = text(artifactRef) || null;
  const verifiedReadback = upper(readbackStatus) === 'VERIFIED' && artifactUsable === true && Array.isArray(evidenceRefs) && evidenceRefs.length > 0;
  let finalStatus = normalized;
  if (!artifact) finalStatus = 'UNKNOWN';
  else if (normalized === 'LINKED' && !verifiedReadback) finalStatus = 'RECEIVED';
  return Object.freeze({
    receiptId: required(receiptId, 'receiptId'),
    dispatchId: dispatch.dispatchId,
    packetId: dispatch.packetId,
    visualDraftId: dispatch.visualDraftId,
    branchId: text(dispatch.branchId) || null,
    artifactRef: artifact,
    sourceResultRefs: unique(sourceResultRefs),
    status: finalStatus,
    evidenceRefs: unique(evidenceRefs),
    executorIdentity: IMAGE_TOOL_TARGET,
    providerJobId: text(providerJobId) || null,
    error: text(error) || null,
    readbackStatus: upper(readbackStatus || 'UNKNOWN'),
    artifactUsable: artifactUsable === true,
    createdAt: text(createdAt) || now(),
    receivedAt: text(receivedAt) || now(),
    lineage: {
      visualDraftId: dispatch.visualDraftId,
      branchId: text(dispatch.branchId) || null,
      packetId: dispatch.packetId,
      dispatchId: dispatch.dispatchId,
      parentLineage: clone(dispatch.parentLineage || null),
      attempt: dispatch.attempt,
      retryOfDispatchId: dispatch.retryOfDispatchId || null,
    },
    ...authorityEnvelope(),
  });
}

export function importVisualReceipt(draft, receipt, { placeOnTable = false, now = nowIso } = {}) {
  if (!draft?.visualDraftId || !receipt?.receiptId) throw new Error('VISUAL_RESULT_IMPORT_REQUIRED');
  if (receipt.visualDraftId !== draft.visualDraftId) throw new Error('VISUAL_RESULT_DRAFT_MISMATCH');
  if (receipt.branchId !== (draft.workingSpec?.spatial?.branch?.branchId || null)) throw new Error('VISUAL_RESULT_BRANCH_MISMATCH');
  if (!isUsableVisualReceipt(receipt)) throw new Error('VISUAL_RESULT_NOT_USABLE');
  const spatial = clone(draft.workingSpec?.spatial || {});
  const resultRef = receipt.artifactRef;
  const resultRefs = unique([...(spatial.resultRefs || []), resultRef]);
  const provenance = Array.isArray(spatial.resultProvenance) ? spatial.resultProvenance : [];
  const existing = provenance.find((item) => item.resultRef === resultRef);
  if (existing && (existing.receiptId !== receipt.receiptId || existing.dispatchId !== receipt.dispatchId)) throw new Error('VISUAL_RESULT_DUPLICATE_ARTIFACT');
  const record = {
    resultRef,
    artifactRef: receipt.artifactRef,
    receiptId: receipt.receiptId,
    dispatchId: receipt.dispatchId,
    packetId: receipt.packetId,
    visualDraftId: receipt.visualDraftId,
    branchId: receipt.branchId,
    sourceResultRefs: unique(receipt.sourceResultRefs),
    status: receipt.status,
    createdAt: receipt.receivedAt || now(),
  };
  const nextSpatial = { ...spatial, resultRefs, resultProvenance: existing ? provenance : [...provenance, record] };
  if (placeOnTable && !spatial.references?.some((item) => item.ref === resultRef)) {
    const index = Array.isArray(spatial.references) ? spatial.references.length : 0;
    nextSpatial.references = [...(spatial.references || []), { id: `REF-${receipt.receiptId}`, ref: resultRef, label: `Result ${resultRef}`, kind: 'RESULT', bounds: { x: 0.04 + (index % 4) * 0.2, y: 0.04 + Math.floor(index / 4) * 0.2, width: 0.18, height: 0.18 }, zIndex: index + 1 }];
  }
  const nextDraft = { ...clone(draft), workingSpec: { ...clone(draft.workingSpec), spatial: nextSpatial }, updatedAt: now() };
  return Object.freeze({ draft: nextDraft, resultRef, provenance: record, placedOnTable: placeOnTable });
}

export function buildVisualRecovery({ draft = null, dispatches = [], receipts = [] } = {}) {
  const draftId = draft?.visualDraftId || null;
  const relatedDispatches = dispatches.filter((item) => !draftId || item.visualDraftId === draftId);
  const relatedReceipts = receipts.filter((item) => !draftId || item.visualDraftId === draftId);
  const pending = relatedDispatches.filter((item) => ['PREPARED', 'SENT', 'WAITING_RESULT'].includes(item.status));
  return {
    status: draft ? 'RECOVERED' : 'UNKNOWN',
    visualDraftId: draftId,
    activeBranchId: draft?.workingSpec?.spatial?.branch?.branchId || null,
    activeCompareSessionId: draft?.workingSpec?.spatial?.activeCompareSessionId || null,
    activeFocusFrameId: draft?.workingSpec?.spatial?.activeFocusFrameId || null,
    promotedParts: clone(draft?.workingSpec?.spatial?.promotedParts || []),
    freezeSet: clone(draft?.workingSpec?.spatial?.freezeSet || []),
    exploreSet: clone(draft?.workingSpec?.spatial?.exploreSet || []),
    nextIntent: clone(draft?.workingSpec?.spatial?.nextIntent || null),
    latestResultRefs: clone(draft?.workingSpec?.spatial?.resultRefs || []),
    pendingDispatches: clone(pending),
    receipts: clone(relatedReceipts),
    unknowns: draft ? [] : ['VISUAL_DRAFT_NOT_RECOVERED'],
  };
}
