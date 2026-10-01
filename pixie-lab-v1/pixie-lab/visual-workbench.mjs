const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
const INTENT_ROLES = Object.freeze(['FACE', 'LIGHTING', 'COMPOSITION', 'COLOR', 'STYLE', 'OUTFIT', 'BACKGROUND', 'NEGATIVE_CONSTRAINT']);
const clamp01 = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;

function normalizeBounds(bounds = {}, fallback = { x: 0.18, y: 0.18, width: 0.64, height: 0.64 }) {
  const x = clamp01(bounds.x, fallback.x);
  const y = clamp01(bounds.y, fallback.y);
  const width = Math.min(1 - x, Math.max(0.06, clamp01(bounds.width, fallback.width)));
  const height = Math.min(1 - y, Math.max(0.06, clamp01(bounds.height, fallback.height)));
  return { x, y, width, height };
}

function normalizeReferences(sourceRef, references = []) {
  const input = Array.isArray(references) ? references : [];
  const normalized = input.map((item, index) => ({
    id: required(item?.id || `REF-${index + 1}`, 'reference.id'),
    ref: required(item?.ref || item?.sourceRef, 'reference.ref'),
    label: text(item?.label || item?.ref || item?.sourceRef) || `Reference ${index + 1}`,
    kind: upper(item?.kind || 'IMAGE'),
    bounds: normalizeBounds(item?.bounds, { x: 0.04 + (index % 4) * 0.2, y: 0.04 + Math.floor(index / 4) * 0.2, width: 0.18, height: 0.18 }),
    zIndex: Number.isFinite(Number(item?.zIndex)) ? Number(item.zIndex) : index + 1,
  }));
  if (!normalized.some((item) => item.id === sourceRef || item.ref === sourceRef)) {
    normalized.unshift({
      id: sourceRef,
      ref: sourceRef,
      label: sourceRef,
      kind: 'SOURCE',
      bounds: normalizeBounds({}, { x: 0.04, y: 0.04, width: 0.22, height: 0.22 }),
      zIndex: 0,
    });
  }
  return normalized;
}

function normalizeIntentLinks(links, references) {
  const validIds = new Set((references || []).flatMap((item) => [item.id, item.ref]));
  return (Array.isArray(links) ? links : []).map((link, index) => {
    const sourceId = text(link?.sourceId);
    if (!sourceId || !validIds.has(sourceId)) throw new Error('VISUAL_INTENT_SOURCE_NOT_FOUND');
    const role = upper(link?.role);
    if (!INTENT_ROLES.includes(role)) throw new Error('VISUAL_INTENT_ROLE_INVALID');
    return {
      id: text(link?.id) || `LINK-${index + 1}`,
      sourceId,
      role,
      note: text(link?.note) || null,
    };
  });
}

function normalizeFreezeExplore(freezeSet, exploreSet) {
  const frozen = unique(freezeSet);
  const exploring = unique(exploreSet);
  if (frozen.some((item) => exploring.includes(item))) throw new Error('VISUAL_FREEZE_EXPLORE_CONFLICT');
  return { freezeSet: frozen, exploreSet: exploring };
}

function normalizeSpatial(spatial, sourceRef) {
  const input = spatial && typeof spatial === 'object' ? spatial : {};
  const references = normalizeReferences(sourceRef, input.references);
  const focusFrames = (Array.isArray(input.focusFrames) ? input.focusFrames : []).map((frame, index) => ({
    id: required(frame?.id || `FRAME-${index + 1}`, 'focusFrame.id'),
    label: text(frame?.label) || `Focus ${index + 1}`,
    bounds: normalizeBounds(frame?.bounds),
  }));
  const activeFocusFrameId = focusFrames.some((frame) => frame.id === input.activeFocusFrameId) ? input.activeFocusFrameId : null;
  const { freezeSet, exploreSet } = normalizeFreezeExplore(input.freezeSet, input.exploreSet);
  return {
    references,
    focusFrames,
    activeFocusFrameId,
    intentLinks: normalizeIntentLinks(input.intentLinks, references),
    freezeSet,
    exploreSet,
    compareNotes: (Array.isArray(input.compareNotes) ? input.compareNotes : []).map((note, index) => ({
      id: text(note?.id) || `NOTE-${index + 1}`,
      text: text(note?.text),
      comparedRefs: unique(note?.comparedRefs),
      createdAt: text(note?.createdAt) || null,
    })).filter((note) => note.text),
  };
}

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
  experimentId = null,
  variantId = null,
  sourceRef,
  sourceVersion = 'unknown',
  sourceHash = null,
  spec = {},
  now = nowIso,
} = {}) {
  const inputSpec = clone(spec ?? {});
  const inputSpatial = inputSpec.spatial && typeof inputSpec.spatial === 'object' ? inputSpec.spatial : {};
  const normalizedSpatial = normalizeSpatial(inputSpatial, sourceRef);
  const originalSpec = { ...inputSpec, spatial: normalizedSpatial };
  return freeze({
    visualDraftId: required(visualDraftId, 'visualDraftId'),
    experimentId: text(experimentId) || null,
    variantId: text(variantId) || null,
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
    if (pathParts(edit.path)[0] === 'spatial') {
      const spatial = normalizeSpatial({ ...workingSpec.spatial, [pathParts(edit.path)[1]]: clone(edit.value) }, draft.sourceRef);
      workingSpec.spatial = spatial;
    } else {
      location.parent[location.key] = clone(edit.value);
    }
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
    experimentId: draft.experimentId || null,
    variantId: draft.variantId || null,
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
  focusFrame = undefined,
  intentLinks = undefined,
  freezeSet = undefined,
  exploreSet = undefined,
  now = nowIso,
} = {}) {
  requireDraft(draft);
  const scanEvidence = (draft.scans || []).flatMap((item) => item.evidenceRefs || []);
  const scanUnknowns = (draft.scans || []).flatMap((item) => item.unknowns || []);
  const spatial = normalizeSpatial(draft.workingSpec?.spatial, draft.sourceRef);
  const packetFocusFrame = focusFrame === undefined
    ? (spatial.focusFrames || []).find((item) => item.id === spatial.activeFocusFrameId) || null
    : clone(focusFrame);
  const packetIntentLinks = intentLinks === undefined ? spatial.intentLinks || [] : intentLinks;
  const packetFreezeSet = freezeSet === undefined ? spatial.freezeSet || [] : freezeSet;
  const packetExploreSet = exploreSet === undefined ? spatial.exploreSet || [] : exploreSet;
  const packetSpatial = normalizeSpatial({ ...spatial, intentLinks: packetIntentLinks, freezeSet: packetFreezeSet, exploreSet: packetExploreSet }, draft.sourceRef);
  if (packetFocusFrame && !packetSpatial.focusFrames.some((frame) => frame.id === packetFocusFrame.id)) throw new Error('VISUAL_FOCUS_FRAME_NOT_FOUND');
  return freeze({
    packetId: required(packetId, 'packetId'),
    visualDraftId: draft.visualDraftId,
    experimentId: draft.experimentId || null,
    variantId: draft.variantId || null,
    sourceRef: draft.sourceRef,
    sourceVersion: draft.sourceVersion,
    sourceHash: draft.sourceHash,
    workingSpec: clone(draft.workingSpec),
    references: clone(packetSpatial.references),
    focusFrame: packetFocusFrame ? clone(packetSpatial.focusFrames.find((frame) => frame.id === packetFocusFrame.id)) : null,
    intentLinks: clone(packetSpatial.intentLinks),
    freezeSet: unique(packetSpatial.freezeSet),
    exploreSet: unique(packetSpatial.exploreSet),
    compareNotes: clone(packetSpatial.compareNotes),
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
