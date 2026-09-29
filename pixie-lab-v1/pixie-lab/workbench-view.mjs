const text = (value) => String(value ?? '').trim();
const list = (value) => Array.isArray(value) ? value : [];
const clone = (value) => value == null ? value : structuredClone(value);
const upper = (value) => text(value).toUpperCase();

export const ERGASTERION_WORKBENCH_VIEW_SCHEMA = 'ERGASTERION_WORKBENCH_VIEW_V1';

export const WORKBENCH_IDS = Object.freeze([
  'GENERAL_IDEA_WORKBENCH',
  'LOGIC_WORKBENCH',
  'VISUAL_WORKBENCH',
  'BUILD_TEST_WORKBENCH',
  'DEBUG_INSPECTION_WORKBENCH',
  'PRODUCTION_EVIDENCE_WORKBENCH',
  'CODING_WORKBENCH',
  'RUNTIME_WORKBENCH',
]);

function toolRailFor(capabilities = {}, workbenchId) {
  return clone(capabilities.workbenches?.[workbenchId]?.commands || []);
}


function latest(values = []) {
  return list(values).length ? list(values).at(-1) : null;
}

function matchesWork(item, { workId = null, checkpointId = null } = {}) {
  if (!item) return false;
  if (workId && item.workId && item.workId !== workId) return false;
  if (checkpointId && item.checkpointId && item.checkpointId !== checkpointId) return false;
  return true;
}

function pickByIdOrLatest(values, ids = [], selector = {}) {
  const candidates = list(values).filter((item) => matchesWork(item, selector));
  for (const [field, value] of ids) {
    if (!value) continue;
    const found = candidates.find((item) => item?.[field] === value);
    if (found) return found;
  }
  return latest(candidates);
}

function relatedExperimentState(state, experiment) {
  if (!experiment) return { variants: [], appPrototypes: [] };
  return {
    variants: list(state.variants).filter((item) => item.experimentId === experiment.experimentId),
    appPrototypes: list(state.appPrototypes).filter((item) => item.experimentId === experiment.experimentId),
  };
}

function capabilityTruth(capabilities = {}) {
  return {
    app: clone(capabilities.app || null),
    pixieLab: clone(capabilities.departments?.pixieLab || null),
    visual: clone(capabilities.lanes?.visual || null),
    production: clone(capabilities.lanes?.production || null),
  };
}

function baseView({ id, capabilities, source, status = 'ACTIVE', selector = {}, now }) {
  return {
    schema: ERGASTERION_WORKBENCH_VIEW_SCHEMA,
    workbenchId: id,
    status,
    source,
    selector: clone(selector),
    toolRail: toolRailFor(capabilities, id),
    capabilityTruth: capabilityTruth(capabilities),
    authority: {
      createsAuthority: false,
      transfersAuthority: false,
      approval: 'NOT_AN_APPROVAL',
    },
    openedAt: now(),
  };
}

function generalIdeaView({ state, capabilities, selector, now }) {
  const idea = pickByIdOrLatest(state.ideas, [['ideaId', selector.ideaId]], selector);
  const experiment = pickByIdOrLatest(
    list(state.experiments).filter((item) => !idea || item.ideaId === idea.ideaId),
    [['experimentId', selector.experimentId], ['experimentId', idea?.selectedExperimentId]],
    selector,
  );
  const related = relatedExperimentState(state, experiment);
  const selectedVariant = selector.variantId
    ? related.variants.find((item) => item.variantId === selector.variantId)
    : related.variants.find((item) => item.variantId === experiment?.selectedVariantId) || latest(related.variants);

  return {
    ...baseView({ id: 'GENERAL_IDEA_WORKBENCH', capabilities, source: 'idea-workspace.mjs', selector, now }),
    missionStrip: {
      intent: idea?.intent || null,
      requestedResult: idea?.requestedResult || null,
      constraints: clone(idea?.constraints || experiment?.constraints || []),
      workId: idea?.workId || experiment?.workId || null,
      checkpointId: idea?.checkpointId || experiment?.checkpointId || null,
    },
    idea: clone(idea),
    experiment: clone(experiment),
    variants: clone(related.variants),
    selectedVariant: clone(selectedVariant),
    appPrototypes: clone(related.appPrototypes),
    evidence: {
      artifactRefs: clone(selectedVariant?.artifactRefs || []),
      evidenceRefs: clone(selectedVariant?.evidenceRefs || []),
      unknowns: clone(selectedVariant?.unknowns || []),
    },
  };
}

function logicView({ state, capabilities, selector, now }) {
  const draft = pickByIdOrLatest(state.logicDrafts, [['draftId', selector.draftId]], selector);
  return {
    ...baseView({ id: 'LOGIC_WORKBENCH', capabilities, source: 'logic-workbench.mjs', selector, now }),
    migration: 'CANONICAL_WORKBENCH_LEGACY_ALIAS',
    draft: clone(draft),
    compare: draft ? {
      draftId: draft.draftId,
      logicId: draft.logicId,
      changed: JSON.stringify(draft.original) !== JSON.stringify(draft.workingCopy),
      original: clone(draft.original),
      workingCopy: clone(draft.workingCopy),
      editCount: list(draft.edits).length,
      approval: 'NOT_AN_APPROVAL',
    } : null,
  };
}

function visualView({ state, capabilities, selector, now }) {
  const draft = pickByIdOrLatest(state.visualDrafts, [['visualDraftId', selector.visualDraftId]], selector);
  const packets = draft
    ? list(state.visualRenderPackets).filter((item) => item.visualDraftId === draft.visualDraftId)
    : [];
  const packetIds = new Set(packets.map((item) => item.packetId));
  const verifications = list(state.visualVerifications).filter((item) => packetIds.has(item.packetId));
  const actions = list(state.imageActions).filter((item) => packetIds.has(item.packetId));
  const actionIds = new Set(actions.map((item) => item.actionId));
  const receipts = list(state.imageReceipts).filter((item) => actionIds.has(item.actionId));

  return {
    ...baseView({ id: 'VISUAL_WORKBENCH', capabilities, source: 'visual-workbench.mjs', selector, now }),
    draft: clone(draft),
    compare: draft ? {
      visualDraftId: draft.visualDraftId,
      changed: JSON.stringify(draft.originalSpec) !== JSON.stringify(draft.workingSpec),
      originalSpec: clone(draft.originalSpec),
      workingSpec: clone(draft.workingSpec),
      editCount: list(draft.edits).length,
      scanCount: list(draft.scans).length,
      table: clone(draft.table),
      approval: 'NOT_AN_APPROVAL',
    } : null,
    renderPackets: clone(packets),
    verifications: clone(verifications),
    imageActions: clone(actions),
    imageReceipts: clone(receipts),
    unknowns: clone(list(draft?.scans).flatMap((item) => list(item?.unknowns))),
  };
}

function buildTestView({ state, capabilities, selector, now }) {
  const matrices = list(state.matrices);
  const runs = list(state.testRuns);
  const selectedMatrix = selector.matrixId
    ? matrices.find((item) => item.matrixId === selector.matrixId)
    : latest(matrices);
  const selectedRun = selector.runId
    ? runs.find((item) => item.runId === selector.runId)
    : latest(runs);
  return {
    ...baseView({ id: 'BUILD_TEST_WORKBENCH', capabilities, source: 'core.mjs', selector, now }),
    currentMatrix: clone(selectedMatrix),
    latestRun: clone(selectedRun),
    goldenCases: clone(state.goldenCases || []),
    regressionAlerts: clone(state.regressionAlerts || []),
    bugs: clone(state.bugs || []),
    evidence: clone(state.evidence || []),
    lastKnownGood: clone(latest(list(state.goldenCases).filter((item) => upper(item.status) === 'PASS'))),
  };
}

function debugInspectionView({ state, capabilities, selector, now }) {
  const debug = selector.debugId
    ? list(state.debugSessions).find((item) => item.debugId === selector.debugId)
    : latest(state.debugSessions);
  const roomD = list(state.rooms).find((item) => item.roomId === 'ROOM-D') || null;
  return {
    ...baseView({ id: 'DEBUG_INSPECTION_WORKBENCH', capabilities, source: 'debug-inspection-workbench.mjs', status: 'ACTIVE', selector, now }),
    legacyRoom: roomD ? { ...clone(roomD), compatibilityOnly: true } : null,
    debugSession: clone(debug),
    bugs: clone(state.bugs || []),
    attentions: clone(state.attentions || []),
    verificationInputs: {
      testRuns: clone(state.testRuns || []),
      regressionAlerts: clone(state.regressionAlerts || []),
      evidence: clone(state.evidence || []),
    },
  };
}

function productionEvidenceView({ state, capabilities, selector, now }) {
  const handoff = pickByIdOrLatest(state.productionHandoffs, [['handoffId', selector.handoffId]], selector);
  return {
    ...baseView({ id: 'PRODUCTION_EVIDENCE_WORKBENCH', capabilities, source: 'production-evidence-workbench.mjs', selector, now }),
    handoff: clone(handoff),
    candidate: {
      experimentId: handoff?.experimentId || null,
      variantId: handoff?.variantId || null,
      requestedResult: handoff?.requestedResult || null,
      workId: handoff?.workId || null,
      checkpointId: handoff?.checkpointId || null,
      artifactRefs: clone(handoff?.artifactRefs || []),
      evidenceRefs: clone(handoff?.evidenceRefs || []),
      unknowns: clone(handoff?.unknowns || []),
    },
    legacyFactoryHandoffs: {
      count: list(state.factoryHandoffs).length,
      currentFlow: false,
    },
  };
}

function codingView({ capabilities, selector, now }) {
  return {
    ...baseView({ id: 'CODING_WORKBENCH', capabilities, source: 'coding-workbench.mjs', status: 'HOST_DEPENDENT', selector, now }),
    reality: 'CHECK_CODING_STATUS',
    runtimeCheck: 'coding_status',
    mergeAuthority: false,
    deployAuthority: false,
  };
}

function runtimeView({ state, capabilities, selector, now }) {
  const prototype = selector.prototypeId
    ? list(state.appPrototypes).find((item) => item.prototypeId === selector.prototypeId)
    : latest(state.appPrototypes);
  const observations = list(state.runtimeObservations).filter((item) => {
    if (selector.workId && item.workId !== selector.workId) return false;
    if (selector.checkpointId && item.checkpointId !== selector.checkpointId) return false;
    if (selector.prototypeId && item.prototypeId !== selector.prototypeId) return false;
    return true;
  });
  const observation = latest(observations);
  return {
    ...baseView({ id: 'RUNTIME_WORKBENCH', capabilities, source: 'runtime-workbench.mjs', status: 'HOST_DEPENDENT', selector, now }),
    prototype: clone(prototype),
    latestPreview: clone(latest(prototype?.previews || [])),
    latestObservation: clone(observation),
    interactionCount: list(state.runtimeInteractions).filter((item) => !observation || item.observationId === observation.observationId).length,
    evidenceBridge: 'ACTIVE',
    directInteraction: 'CHECK_RUNTIME_STATUS',
    runtimeCheck: 'runtime_status',
  };
}

export function openWorkbench({
  workbenchId,
  state = {},
  capabilities = {},
  selector = {},
  now = () => new Date().toISOString(),
} = {}) {
  const id = upper(workbenchId);
  if (!WORKBENCH_IDS.includes(id)) {
    return Object.freeze({
      schema: ERGASTERION_WORKBENCH_VIEW_SCHEMA,
      ok: false,
      error: 'WORKBENCH_NOT_FOUND',
      requestedWorkbenchId: id || null,
      availableWorkbenchIds: [...WORKBENCH_IDS],
      authority: { createsAuthority: false, transfersAuthority: false, approval: 'NOT_AN_APPROVAL' },
    });
  }

  const args = { state, capabilities, selector: clone(selector || {}), now };
  const projectors = {
    GENERAL_IDEA_WORKBENCH: generalIdeaView,
    LOGIC_WORKBENCH: logicView,
    VISUAL_WORKBENCH: visualView,
    BUILD_TEST_WORKBENCH: buildTestView,
    DEBUG_INSPECTION_WORKBENCH: debugInspectionView,
    PRODUCTION_EVIDENCE_WORKBENCH: productionEvidenceView,
    CODING_WORKBENCH: codingView,
    RUNTIME_WORKBENCH: runtimeView,
  };
  return Object.freeze({ ok: true, ...projectors[id](args) });
}
