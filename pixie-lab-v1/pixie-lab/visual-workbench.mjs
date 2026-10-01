const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
const INTENT_ROLES = Object.freeze(['FACE', 'LIGHTING', 'COMPOSITION', 'COLOR', 'STYLE', 'OUTFIT', 'BACKGROUND', 'NEGATIVE_CONSTRAINT']);
const SEMANTIC_PART_ROLES = Object.freeze([...INTENT_ROLES, 'OBJECT', 'POSE', 'TEXTURE']);
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

function normalizeCompareNotes(notes, resultRefs) {
  return (Array.isArray(notes) ? notes : []).map((note, index) => {
    const comparedRefs = unique(note?.comparedRefs);
    if (resultRefs.length && comparedRefs.some((ref) => !resultRefs.includes(ref))) throw new Error('VISUAL_COMPARE_NOTE_RESULT_NOT_FOUND');
    return {
      id: text(note?.id) || `NOTE-${index + 1}`,
      text: text(note?.text),
      comparedRefs,
      compareSessionId: text(note?.compareSessionId) || null,
      createdAt: text(note?.createdAt) || null,
    };
  }).filter((note) => note.text);
}

function normalizeCompareSessions(sessions, resultRefs, compareNotes) {
  const noteIds = new Set(compareNotes.map((note) => note.id));
  return (Array.isArray(sessions) ? sessions : []).map((session, index) => {
    const selectedResultRefs = unique(session?.selectedResultRefs || session?.resultRefs);
    if (selectedResultRefs.length < 2 || selectedResultRefs.length > 4) throw new Error('VISUAL_COMPARE_SELECTION_INVALID');
    if (resultRefs.length && selectedResultRefs.some((ref) => !resultRefs.includes(ref))) throw new Error('VISUAL_COMPARE_RESULT_NOT_FOUND');
    const compareNoteRefs = unique(session?.compareNoteRefs);
    if (compareNoteRefs.some((ref) => !noteIds.has(ref))) throw new Error('VISUAL_COMPARE_NOTE_NOT_FOUND');
    const winnerRef = text(session?.winnerRef) || null;
    if (winnerRef && !selectedResultRefs.includes(winnerRef)) throw new Error('VISUAL_WINNER_NOT_IN_COMPARE');
    return {
      compareSessionId: required(session?.compareSessionId || session?.id || `COMPARE-${index + 1}`, 'compareSessionId'),
      selectedResultRefs,
      winnerRef,
      compareNoteRefs,
      createdAt: text(session?.createdAt) || null,
    };
  });
}

function normalizePromotedParts(parts, resultRefs, compareSessions, focusFrames, visualDraftId) {
  const selectedRefs = new Set(compareSessions.flatMap((session) => session.selectedResultRefs));
  const frameIds = new Set(focusFrames.map((frame) => frame.id));
  return (Array.isArray(parts) ? parts : []).map((part, index) => {
    const sourceResultRef = required(part?.sourceResultRef || part?.resultRef, 'promotedPart.sourceResultRef');
    if (!resultRefs.includes(sourceResultRef)) throw new Error('VISUAL_PROMOTED_RESULT_NOT_FOUND');
    if (!selectedRefs.has(sourceResultRef)) throw new Error('VISUAL_PROMOTED_RESULT_NOT_SELECTED');
    const role = upper(part?.role);
    if (!SEMANTIC_PART_ROLES.includes(role)) throw new Error('VISUAL_SEMANTIC_ROLE_INVALID');
    const focusFrameId = text(part?.focusFrameId) || null;
    if (focusFrameId && !frameIds.has(focusFrameId)) throw new Error('VISUAL_PROMOTED_FOCUS_FRAME_NOT_FOUND');
    const regionRef = text(part?.regionRef) || null;
    if (regionRef && !frameIds.has(regionRef)) throw new Error('VISUAL_PROMOTED_REGION_NOT_FOUND');
    return {
      partId: text(part?.partId || part?.id) || `PART-${index + 1}`,
      sourceResultRef,
      role,
      note: text(part?.note) || null,
      focusFrameId,
      regionRef,
      visualDraftId: text(part?.visualDraftId) || text(visualDraftId) || null,
      createdAt: text(part?.createdAt) || null,
    };
  });
}

function normalizeBranch(branch, references, resultRefs, focusFrames, visualDraftId) {
  if (!branch) return null;
  const parentVisualDraftId = required(branch.parentVisualDraftId, 'branch.parentVisualDraftId');
  if (visualDraftId && parentVisualDraftId === visualDraftId) throw new Error('VISUAL_BRANCH_PARENT_SELF');
  const parentResultRefs = unique(branch.parentResultRefs);
  if (!parentResultRefs.length) throw new Error('VISUAL_BRANCH_PARENT_RESULTS_REQUIRED');
  if (parentResultRefs.some((ref) => !resultRefs.includes(ref))) throw new Error('VISUAL_BRANCH_PARENT_RESULT_NOT_FOUND');
  const frameIds = new Set(focusFrames.map((frame) => frame.id));
  if (branch.activeFocusFrameId && !frameIds.has(branch.activeFocusFrameId)) throw new Error('VISUAL_BRANCH_FOCUS_FRAME_NOT_FOUND');
  return {
    branchId: required(branch.branchId, 'branchId'),
    parentVisualDraftId,
    parentResultRefs,
    promotedParts: normalizePromotedParts(branch.promotedParts, resultRefs, [{ selectedResultRefs: parentResultRefs }], focusFrames, visualDraftId),
    inheritedFreezeSet: unique(branch.inheritedFreezeSet),
    inheritedExploreSet: unique(branch.inheritedExploreSet),
    inheritedIntentLinks: normalizeIntentLinks(branch.inheritedIntentLinks, references),
    compareNoteRefs: unique(branch.compareNoteRefs),
    createdAt: text(branch.createdAt) || null,
  };
}

function normalizeResultProvenance(records, resultRefs, visualDraftId) {
  return (Array.isArray(records) ? records : []).map((record) => {
    const resultRef = required(record?.resultRef || record?.artifactRef, 'resultProvenance.resultRef');
    if (!resultRefs.includes(resultRef)) throw new Error('VISUAL_RESULT_PROVENANCE_RESULT_NOT_FOUND');
    if (record?.visualDraftId && record.visualDraftId !== visualDraftId) throw new Error('VISUAL_RESULT_PROVENANCE_DRAFT_MISMATCH');
    return {
      resultRef,
      artifactRef: text(record?.artifactRef) || resultRef,
      receiptId: text(record?.receiptId) || null,
      dispatchId: text(record?.dispatchId) || null,
      packetId: text(record?.packetId) || null,
      visualDraftId: text(record?.visualDraftId) || text(visualDraftId) || null,
      branchId: text(record?.branchId) || null,
      sourceResultRefs: unique(record?.sourceResultRefs),
      status: upper(record?.status || 'UNKNOWN'),
      createdAt: text(record?.createdAt) || null,
    };
  });
}

function normalizeNextIntents(intents, resultRefs, compareSessions, focusFrames, references, visualDraftId) {
  const sessions = new Map(compareSessions.map((session) => [session.compareSessionId, session]));
  const frameIds = new Set(focusFrames.map((frame) => frame.id));
  return (Array.isArray(intents) ? intents : []).map((intent, index) => {
    const compareSessionId = text(intent?.compareSessionId) || null;
    const session = compareSessionId ? sessions.get(compareSessionId) : null;
    if (compareSessionId && !session) throw new Error('VISUAL_NEXT_INTENT_COMPARE_NOT_FOUND');
    const selected = session?.selectedResultRefs || unique(intent?.selectedResultRefs);
    if (resultRefs.length && selected.some((ref) => !resultRefs.includes(ref))) throw new Error('VISUAL_NEXT_INTENT_RESULT_NOT_FOUND');
    const winnerRef = text(intent?.winnerRef) || null;
    if (winnerRef && !selected.includes(winnerRef)) throw new Error('VISUAL_NEXT_INTENT_WINNER_INVALID');
    const focusFrameId = text(intent?.focusFrameId) || null;
    if (focusFrameId && !frameIds.has(focusFrameId)) throw new Error('VISUAL_NEXT_INTENT_FOCUS_FRAME_NOT_FOUND');
    return {
      nextIntentId: required(intent?.nextIntentId || intent?.id || `NEXT-INTENT-${index + 1}`, 'nextIntentId'),
      compareSessionId,
      selectedResultRefs: selected,
      winnerRef,
      promotedParts: normalizePromotedParts(intent?.promotedParts, resultRefs, session ? [session] : [{ selectedResultRefs: selected }], focusFrames, visualDraftId),
      compareNoteRefs: unique(intent?.compareNoteRefs),
      freezeSet: unique(intent?.freezeSet),
      exploreSet: unique(intent?.exploreSet),
      focusFrameId,
      intentLinks: normalizeIntentLinks(intent?.intentLinks, references),
      createdAt: text(intent?.createdAt) || null,
      visualDraftId: text(intent?.visualDraftId) || text(visualDraftId) || null,
    };
  });
}

function normalizeSpatial(spatial, sourceRef, visualDraftId = null) {
  const input = spatial && typeof spatial === 'object' ? spatial : {};
  const references = normalizeReferences(sourceRef, input.references);
  const focusFrames = (Array.isArray(input.focusFrames) ? input.focusFrames : []).map((frame, index) => ({
    id: required(frame?.id || `FRAME-${index + 1}`, 'focusFrame.id'),
    label: text(frame?.label) || `Focus ${index + 1}`,
    bounds: normalizeBounds(frame?.bounds),
  }));
  const activeFocusFrameId = focusFrames.some((frame) => frame.id === input.activeFocusFrameId) ? input.activeFocusFrameId : null;
  const { freezeSet, exploreSet } = normalizeFreezeExplore(input.freezeSet, input.exploreSet);
  const resultRefs = unique(input.resultRefs);
  const resultProvenance = normalizeResultProvenance(input.resultProvenance, resultRefs, visualDraftId);
  const compareNotes = normalizeCompareNotes(input.compareNotes, resultRefs);
  const compareSessions = normalizeCompareSessions(input.compareSessions, resultRefs, compareNotes);
  const activeCompareSessionId = compareSessions.some((session) => session.compareSessionId === input.activeCompareSessionId)
    ? input.activeCompareSessionId
    : null;
  const winnerRef = text(input.winnerRef) || (compareSessions.find((session) => session.compareSessionId === activeCompareSessionId)?.winnerRef || null);
  const activeSession = compareSessions.find((session) => session.compareSessionId === activeCompareSessionId);
  if (winnerRef && activeSession && !activeSession.selectedResultRefs.includes(winnerRef)) throw new Error('VISUAL_WINNER_NOT_IN_COMPARE');
  const promotedParts = normalizePromotedParts(input.promotedParts, resultRefs, compareSessions, focusFrames, visualDraftId);
  const branch = normalizeBranch(input.branch, references, resultRefs, focusFrames, visualDraftId);
  const nextIntents = normalizeNextIntents(input.nextIntents, resultRefs, compareSessions, focusFrames, references, visualDraftId);
  const activeNextIntentId = nextIntents.some((intent) => intent.nextIntentId === input.activeNextIntentId) ? input.activeNextIntentId : null;
  const requestedNextIntentId = text(input.nextIntent?.nextIntentId || input.nextIntent?.id) || null;
  if (input.nextIntent && !requestedNextIntentId) throw new Error('VISUAL_NEXT_INTENT_ID_REQUIRED');
  const nextIntent = requestedNextIntentId
    ? nextIntents.find((intent) => intent.nextIntentId === requestedNextIntentId) || null
    : null;
  if (input.nextIntent && !nextIntent) throw new Error('VISUAL_NEXT_INTENT_NOT_FOUND');
  return {
    references,
    focusFrames,
    activeFocusFrameId,
    intentLinks: normalizeIntentLinks(input.intentLinks, references),
    freezeSet,
    exploreSet,
    compareNotes,
    resultRefs,
    resultProvenance,
    compareSessions,
    activeCompareSessionId,
    winnerRef,
    promotedParts,
    branch,
    nextIntents,
    activeNextIntentId,
    nextIntent,
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
  parentVisualDraftId = null,
  lineage = null,
  workId = null,
  checkpointId = null,
  now = nowIso,
} = {}) {
  const inputSpec = clone(spec ?? {});
  const inputSpatial = inputSpec.spatial && typeof inputSpec.spatial === 'object' ? inputSpec.spatial : {};
  const normalizedSpatial = normalizeSpatial(inputSpatial, sourceRef, visualDraftId);
  const originalSpec = { ...inputSpec, spatial: normalizedSpatial };
  return freeze({
    visualDraftId: required(visualDraftId, 'visualDraftId'),
    experimentId: text(experimentId) || null,
    variantId: text(variantId) || null,
    sourceRef: required(sourceRef, 'sourceRef'),
    sourceVersion: required(sourceVersion, 'sourceVersion'),
    sourceHash: text(sourceHash) || null,
    parentVisualDraftId: text(parentVisualDraftId) || null,
    lineage: clone(lineage),
    workId: text(workId) || null,
    checkpointId: text(checkpointId) || null,
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
      const spatial = normalizeSpatial({ ...workingSpec.spatial, [pathParts(edit.path)[1]]: clone(edit.value) }, draft.sourceRef, draft.visualDraftId);
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
  packetVersion = 'V2',
  compareSessionId = undefined,
  compareSession = undefined,
  selectedResultRefs = undefined,
  winnerRef = undefined,
  promotedParts = undefined,
  branchId = undefined,
  parentLineage = undefined,
  nextIntent = undefined,
  now = nowIso,
} = {}) {
  requireDraft(draft);
  const scanEvidence = (draft.scans || []).flatMap((item) => item.evidenceRefs || []);
  const scanUnknowns = (draft.scans || []).flatMap((item) => item.unknowns || []);
  const spatial = normalizeSpatial(draft.workingSpec?.spatial, draft.sourceRef, draft.visualDraftId);
  const packetFocusFrame = focusFrame === undefined
    ? (spatial.focusFrames || []).find((item) => item.id === spatial.activeFocusFrameId) || null
    : clone(focusFrame);
  const packetIntentLinks = intentLinks === undefined ? spatial.intentLinks || [] : intentLinks;
  const packetFreezeSet = freezeSet === undefined ? spatial.freezeSet || [] : freezeSet;
  const packetExploreSet = exploreSet === undefined ? spatial.exploreSet || [] : exploreSet;
  const packetSpatial = normalizeSpatial({ ...spatial, intentLinks: packetIntentLinks, freezeSet: packetFreezeSet, exploreSet: packetExploreSet }, draft.sourceRef, draft.visualDraftId);
  if (packetFocusFrame && !packetSpatial.focusFrames.some((frame) => frame.id === packetFocusFrame.id)) throw new Error('VISUAL_FOCUS_FRAME_NOT_FOUND');
  const inferredCompareSessionId = compareSessionId || packetSpatial.activeCompareSessionId || (packetSpatial.compareSessions.length === 1 ? packetSpatial.compareSessions[0].compareSessionId : null);
  const activeCompareSession = compareSession || (compareSessionId === null ? null : packetSpatial.compareSessions.find((session) => session.compareSessionId === inferredCompareSessionId)) || null;
  const packetSelectedResultRefs = selectedResultRefs === undefined ? (activeCompareSession?.selectedResultRefs || []) : unique(selectedResultRefs);
  if (packetSelectedResultRefs.some((ref) => !packetSpatial.resultRefs.includes(ref))) throw new Error('VISUAL_PACKET_RESULT_NOT_FOUND');
  const packetWinnerRef = winnerRef === undefined ? (activeCompareSession?.winnerRef || packetSpatial.winnerRef || null) : text(winnerRef) || null;
  if (packetWinnerRef && !packetSelectedResultRefs.includes(packetWinnerRef)) throw new Error('VISUAL_WINNER_NOT_IN_COMPARE');
  const packetPromotedParts = promotedParts === undefined
    ? packetSpatial.promotedParts.filter((part) => packetSelectedResultRefs.includes(part.sourceResultRef))
    : normalizePromotedParts(promotedParts, packetSpatial.resultRefs, packetSpatial.compareSessions, packetSpatial.focusFrames, draft.visualDraftId);
  let activeNextIntent;
  if (nextIntent === undefined) {
    activeNextIntent = packetSpatial.nextIntent || packetSpatial.nextIntents.find((intent) => intent.nextIntentId === packetSpatial.activeNextIntentId) || null;
  } else {
    const requestedPacketNextIntentId = text(nextIntent?.nextIntentId || nextIntent?.id) || null;
    if (!requestedPacketNextIntentId) throw new Error('VISUAL_PACKET_NEXT_INTENT_ID_REQUIRED');
    activeNextIntent = packetSpatial.nextIntents.find((intent) => intent.nextIntentId === requestedPacketNextIntentId) || null;
    if (!activeNextIntent) throw new Error('VISUAL_PACKET_NEXT_INTENT_NOT_FOUND');
  }
  return freeze({
    packetId: required(packetId, 'packetId'),
    visualDraftId: draft.visualDraftId,
    experimentId: draft.experimentId || null,
    variantId: draft.variantId || null,
    sourceRef: draft.sourceRef,
    sourceVersion: draft.sourceVersion,
    sourceHash: draft.sourceHash,
    parentVisualDraftId: draft.parentVisualDraftId || null,
    workId: draft.workId || null,
    checkpointId: draft.checkpointId || null,
    workingSpec: clone(draft.workingSpec),
    references: clone(packetSpatial.references),
    focusFrame: packetFocusFrame ? clone(packetSpatial.focusFrames.find((frame) => frame.id === packetFocusFrame.id)) : null,
    intentLinks: clone(packetSpatial.intentLinks),
    freezeSet: unique(packetSpatial.freezeSet),
    exploreSet: unique(packetSpatial.exploreSet),
    compareNotes: clone(packetSpatial.compareNotes),
    resultProvenance: clone(packetSpatial.resultProvenance),
    packetVersion: upper(packetVersion) === 'V3' ? 'V3' : 'V2',
    compareSession: clone(activeCompareSession),
    compareSessionId: activeCompareSession?.compareSessionId || null,
    selectedResultRefs: clone(packetSelectedResultRefs),
    winnerRef: packetWinnerRef,
    promotedParts: clone(packetPromotedParts),
    branchId: text(branchId) || packetSpatial.branch?.branchId || null,
    parentLineage: clone(parentLineage === undefined ? draft.lineage : parentLineage),
    nextIntent: activeNextIntent,
    inheritedFreezeSet: unique(packetSpatial.branch?.inheritedFreezeSet || packetSpatial.freezeSet),
    inheritedExploreSet: unique(packetSpatial.branch?.inheritedExploreSet || packetSpatial.exploreSet),
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
