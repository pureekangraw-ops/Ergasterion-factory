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

function pathParts(path) {
  if (Array.isArray(path)) return path.map(text).filter(Boolean);
  return text(path).split('.').map(text).filter(Boolean);
}

function targetAt(root, path, { create = false } = {}) {
  const parts = pathParts(path);
  if (!parts.length) return { parent: null, key: null, value: root };
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (cursor == null || typeof cursor !== 'object') throw new Error('VISUAL_WORKBENCH_PATH_INVALID');
    if (!(key in cursor)) {
      if (!create) throw new Error('VISUAL_WORKBENCH_PATH_NOT_FOUND');
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  const key = parts.at(-1);
  return { parent: cursor, key, value: cursor?.[key] };
}

function requireDraft(draft) {
  if (!draft?.labOwned || draft?.status !== 'DRAFT') throw new Error('VISUAL_WORKBENCH_DRAFT_REQUIRED');
}

export function createVisualDraft({
  visualDraftId,
  sourceRef,
  sourceVersion = 'unknown',
  sourceHash = null,
  spec = {},
  now = nowIso,
} = {}) {
  const originalSpec = clone(spec ?? {});
  return freeze({
    visualDraftId: required(visualDraftId, 'visualDraftId'),
    sourceRef: required(sourceRef, 'sourceRef'),
    sourceVersion: required(sourceVersion, 'sourceVersion'),
    sourceHash: text(sourceHash) || null,
    sourceLocked: true,
    labOwned: true,
    table: {
      referencePin: 'IDEA_REFERENCE',
      briefPin: 'BRIEF_PROMPT',
      main: 'VISUAL_WORKSPACE',
      history: 'V1_V2_V3_PLUS',
    },
    assistant: {
      name: 'PIXIE',
      role: 'PIXIE_LAB_ASSISTANT',
      stationedAt: 'PIXIE_LAB',
      independentImageGenerator: false,
      operator: 'GO_IMAGE_TOOL',
      responsibilities: [
        'KEEP_REFERENCE_SEPARATE_FROM_BRIEF',
        'PRESERVE_INTENT_AND_CONSTRAINTS',
        'CHECK_ITERATION_DRIFT',
        'COMPARE_MEANINGFUL_DELTAS',
        'KEEP_OWNER_SELECTION_CANONICAL',
        'CARRY_SELECTED_VISUAL_CONTEXT_FORWARD',
      ],
    },
    variants: [],
    selectedVariantId: null,
    status: 'DRAFT',
    originalSpec,
    workingSpec: clone(originalSpec),
    scans: [],
    edits: [],
    renderPacketRefs: [],
    createdAt: now(),
    updatedAt: now(),
  });
}

export function scanVisualDraft(draft, {
  scanId,
  observations = [],
  evidenceRefs = [],
  unknowns = [],
  now = nowIso,
} = {}) {
  requireDraft(draft);
  const cleanEvidence = unique(evidenceRefs);
  const cleanUnknowns = unique(unknowns);
  if (!observations.length && !cleanUnknowns.length) cleanUnknowns.push('SCAN_EMPTY');
  if (observations.length && !cleanEvidence.length) cleanUnknowns.push('SCAN_EVIDENCE_MISSING');
  const scan = freeze({
    scanId: required(scanId, 'scanId'),
    observations: clone(observations),
    evidenceRefs: cleanEvidence,
    unknowns: unique(cleanUnknowns),
    status: cleanUnknowns.length ? 'UNKNOWN' : 'SUPPORTED',
    scannedAt: now(),
  });
  return freeze({
    ...clone(draft),
    scans: [...(draft.scans || []), scan],
    updatedAt: now(),
  });
}

export function editVisualDraft(draft, edit = {}, { now = nowIso } = {}) {
  requireDraft(draft);
  const op = upper(edit.op);
  const workingSpec = clone(draft.workingSpec);
  const location = targetAt(workingSpec, edit.path, { create: op === 'SET' });
  if (op === 'SET') {
    if (!location.parent || location.key == null) throw new Error('VISUAL_WORKBENCH_ROOT_SET_FORBIDDEN');
    location.parent[location.key] = clone(edit.value);
  } else if (op === 'DELETE') {
    if (!location.parent || location.key == null || !(location.key in location.parent)) throw new Error('VISUAL_WORKBENCH_PATH_NOT_FOUND');
    delete location.parent[location.key];
  } else if (op === 'APPEND') {
    if (!Array.isArray(location.value)) throw new Error('VISUAL_WORKBENCH_APPEND_REQUIRES_ARRAY');
    location.value.push(clone(edit.value));
  } else if (op === 'TRIM_TEXT') {
    if (typeof location.value !== 'string') throw new Error('VISUAL_WORKBENCH_TEXT_REQUIRED');
    location.parent[location.key] = location.value.trim();
  } else if (op === 'REPLACE_TEXT') {
    if (typeof location.value !== 'string') throw new Error('VISUAL_WORKBENCH_TEXT_REQUIRED');
    const find = required(edit.find, 'find');
    location.parent[location.key] = location.value.split(find).join(String(edit.replace ?? ''));
  } else {
    throw new Error('VISUAL_WORKBENCH_OPERATION_NOT_ALLOWED');
  }
  return freeze({
    ...clone(draft),
    workingSpec,
    edits: [...(draft.edits || []), { op, path: pathParts(edit.path), at: now() }],
    updatedAt: now(),
  });
}

export function compareVisualDraft(draft) {
  if (!draft?.labOwned) throw new Error('VISUAL_WORKBENCH_DRAFT_REQUIRED');
  return freeze({
    visualDraftId: draft.visualDraftId,
    sourceRef: draft.sourceRef,
    sourceLocked: draft.sourceLocked === true,
    changed: JSON.stringify(draft.originalSpec) !== JSON.stringify(draft.workingSpec),
    originalSpec: clone(draft.originalSpec),
    workingSpec: clone(draft.workingSpec),
    editCount: Array.isArray(draft.edits) ? draft.edits.length : 0,
    scanCount: Array.isArray(draft.scans) ? draft.scans.length : 0,
    table: clone(draft.table),
    assistant: clone(draft.assistant),
    variants: clone(draft.variants || []),
    selectedVariantId: draft.selectedVariantId || null,
    approval: 'NOT_AN_APPROVAL',
  });
}

export function createVisualRenderPacket(draft, {
  packetId,
  intent,
  requestedResult,
  mustKeep = [],
  mustRemove = [],
  copy = [],
  constraints = [],
  evidenceRefs = [],
  unknowns = [],
  now = nowIso,
} = {}) {
  requireDraft(draft);
  const scanEvidence = (draft.scans || []).flatMap((item) => item.evidenceRefs || []);
  const scanUnknowns = (draft.scans || []).flatMap((item) => item.unknowns || []);
  return freeze({
    packetId: required(packetId, 'packetId'),
    visualDraftId: draft.visualDraftId,
    sourceRef: draft.sourceRef,
    sourceVersion: draft.sourceVersion,
    sourceHash: draft.sourceHash,
    workingSpec: clone(draft.workingSpec),
    intent: required(intent, 'intent'),
    requestedResult: required(requestedResult, 'requestedResult'),
    mustKeep: unique(mustKeep),
    mustRemove: unique(mustRemove),
    copy: clone(copy),
    constraints: unique(constraints),
    evidenceRefs: unique([...scanEvidence, ...evidenceRefs]),
    unknowns: unique([...scanUnknowns, ...unknowns]),
    workbenchAssistant: clone(draft.assistant),
    table: clone(draft.table),
    selectedVariantId: draft.selectedVariantId || null,
    targetTool: 'GO_IMAGE_TOOL',
    externalExecutionRequired: true,
    imageGenerationAuthority: false,
    productionAuthority: false,
    approval: 'NOT_AN_APPROVAL',
    createdAt: now(),
  });
}

export function verifyVisualRender(packet, {
  verificationId,
  observedRef,
  checks = [],
  now = nowIso,
} = {}) {
  if (!packet?.packetId || packet?.approval !== 'NOT_AN_APPROVAL') throw new Error('VISUAL_RENDER_PACKET_REQUIRED');
  const normalized = (Array.isArray(checks) ? checks : []).map((check, index) => {
    const evidenceRefs = unique(check.evidenceRefs);
    let status = upper(check.status || 'UNKNOWN');
    if (!['PASS', 'FAIL', 'UNKNOWN'].includes(status)) status = 'UNKNOWN';
    if (['PASS', 'FAIL'].includes(status) && !evidenceRefs.length) status = 'UNKNOWN';
    return freeze({
      checkId: text(check.checkId) || `CHECK-${index + 1}`,
      status,
      detail: text(check.detail) || null,
      evidenceRefs,
    });
  });
  const status = normalized.some((item) => item.status === 'FAIL')
    ? 'FAIL'
    : !normalized.length || normalized.some((item) => item.status === 'UNKNOWN')
      ? 'UNKNOWN'
      : 'PASS';
  return freeze({
    verificationId: required(verificationId, 'verificationId'),
    packetId: packet.packetId,
    observedRef: required(observedRef, 'observedRef'),
    status,
    checks: normalized,
    verifiedAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}
