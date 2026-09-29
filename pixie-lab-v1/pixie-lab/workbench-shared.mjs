const text = (value) => String(value ?? '').trim();
const list = (value) => Array.isArray(value) ? value : [];
const clone = (value) => value == null ? value : structuredClone(value);
const unique = (values = []) => [...new Set(values.map(text).filter(Boolean))];

export const ERGASTERION_CHECKPOINT_DOCK_SCHEMA = 'ERGASTERION_CHECKPOINT_DOCK_V1';
export const ERGASTERION_REALITY_SCREEN_SCHEMA = 'ERGASTERION_REALITY_SCREEN_V1';

function timeOf(item = {}) {
  return [
    item.updatedAt,
    item.completedAt,
    item.verifiedAt,
    item.observedAt,
    item.preparedAt,
    item.createdAt,
    item.at,
  ].map(text).find(Boolean) || null;
}

function latest(items = []) {
  const values = list(items);
  if (!values.length) return null;
  return [...values].sort((a, b) => String(timeOf(a) || '').localeCompare(String(timeOf(b) || ''))).at(-1);
}

function workMatches(item, { workId = null, checkpointId = null } = {}) {
  if (!item) return false;
  if (workId && item.workId && item.workId !== workId) return false;
  if (checkpointId && item.checkpointId && item.checkpointId !== checkpointId) return false;
  return true;
}

function collectWorkCarriers(state = {}) {
  return [
    ...list(state.ideas).map((item) => ({ kind: 'IDEA', ref: item.ideaId, item })),
    ...list(state.experiments).map((item) => ({ kind: 'EXPERIMENT', ref: item.experimentId, item })),
    ...list(state.productionHandoffs).map((item) => ({ kind: 'PRODUCTION_HANDOFF', ref: item.handoffId, item })),
    ...list(state.runtimeObservations).map((item) => ({ kind: 'RUNTIME_OBSERVATION', ref: item.observationId, item })),
  ].filter((entry) => entry.item?.workId || entry.item?.checkpointId);
}

function resolveWorkContext(state = {}, selector = {}) {
  const carriers = collectWorkCarriers(state).filter((entry) => workMatches(entry.item, selector));
  const selected = latest(carriers.map((entry) => ({
    ...entry,
    updatedAt: timeOf(entry.item),
  })));
  const item = selected?.item || null;
  return {
    workId: selector.workId || item?.workId || null,
    checkpointId: selector.checkpointId || item?.checkpointId || null,
    carrierKind: selected?.kind || null,
    carrierRef: selected?.ref || null,
  };
}

function collectUnknowns(state = {}) {
  return unique([
    ...list(state.roomReports).flatMap((item) => list(item?.unknowns)),
    ...list(state.variants).flatMap((item) => list(item?.unknowns)),
    ...list(state.appPrototypes).flatMap((item) => list(item?.previews).flatMap((preview) => list(preview?.unknowns))),
    ...list(state.visualDrafts).flatMap((item) => list(item?.scans).flatMap((scan) => list(scan?.unknowns))),
    ...list(state.visualRenderPackets).flatMap((item) => list(item?.unknowns)),
    ...list(state.productionHandoffs).flatMap((item) => list(item?.unknowns)),
    ...list(state.runtimeObservations).flatMap((item) => list(item?.unknowns)),
    ...list(state.runtimeInteractions).flatMap((item) => list(item?.unknowns)),
  ]);
}

function actionCandidates(state = {}) {
  const specs = [
    ['IDEA', state.ideas, 'ideaId'],
    ['EXPERIMENT', state.experiments, 'experimentId'],
    ['VARIANT', state.variants, 'variantId'],
    ['APP_PROTOTYPE', state.appPrototypes, 'prototypeId'],
    ['LOGIC_DRAFT', state.logicDrafts, 'draftId'],
    ['VISUAL_DRAFT', state.visualDrafts, 'visualDraftId'],
    ['VISUAL_PACKET', state.visualRenderPackets, 'packetId'],
    ['VISUAL_VERIFICATION', state.visualVerifications, 'verificationId'],
    ['IMAGE_RECEIPT', state.imageReceipts, 'receiptId'],
    ['TEST_RUN', state.testRuns, 'runId'],
    ['DEBUG_SESSION', state.debugSessions, 'debugId'],
    ['PRODUCTION_HANDOFF', state.productionHandoffs, 'handoffId'],
    ['RUNTIME_OBSERVATION', state.runtimeObservations, 'observationId'],
    ['RUNTIME_INTERACTION', state.runtimeInteractions, 'interactionId'],
    ['ARTIFACT', state.artifacts, 'artifactId'],
    ['EVIDENCE', state.evidence, 'evidenceId'],
  ];
  return specs.flatMap(([kind, values, refKey]) =>
    list(values).flatMap((item) => {
      const at = timeOf(item);
      if (!at) return [];
      return [{
        kind,
        ref: item?.[refKey] || null,
        at,
        status: item?.status || null,
      }];
    }),
  );
}

function latestPreview(state = {}) {
  const previews = list(state.appPrototypes).flatMap((prototype) =>
    list(prototype?.previews).map((preview) => ({
      ...clone(preview),
      prototypeId: prototype.prototypeId || null,
      experimentId: prototype.experimentId || null,
      variantId: prototype.variantId || null,
    })),
  );
  return latest(previews);
}

function latestGoldenPass(state = {}) {
  return latest(list(state.goldenCases).filter((item) => text(item?.status).toUpperCase() === 'PASS'));
}

export function projectCheckpointDock({
  state = {},
  selector = {},
  now = () => new Date().toISOString(),
} = {}) {
  const work = resolveWorkContext(state, selector);
  const actions = actionCandidates(state);
  const lastAction = latest(actions);
  const artifact = latest(state.artifacts);
  const evidence = latest(state.evidence);
  const unknowns = collectUnknowns(state);

  return Object.freeze({
    schema: ERGASTERION_CHECKPOINT_DOCK_SCHEMA,
    projectedAt: now(),
    work: Object.freeze(work),
    resume: Object.freeze({
      lastPhysicalAction: clone(lastAction),
      selectedArtifact: clone(artifact),
      latestEvidence: clone(evidence),
      pendingUnknowns: Object.freeze([...unknowns]),
      nextAction: null,
      nextActionStatus: 'UNKNOWN',
    }),
    sourceStateSchema: text(state.schemaVersion) || 'UNKNOWN',
    readOnly: true,
    createsWork: false,
    createsAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export function projectRealityScreen({
  state = {},
  selector = {},
  now = () => new Date().toISOString(),
} = {}) {
  const work = resolveWorkContext(state, selector);
  const latestVariant = latest(state.variants);
  const latestLogic = latest(state.logicDrafts);
  const latestVisual = latest(state.visualDrafts);
  const latestRun = latest(state.testRuns);
  const preview = latestPreview(state);
  const runtimeObservation = latest(state.runtimeObservations);
  const runtimeInteraction = latest(state.runtimeInteractions);
  const evidence = latest(state.evidence);
  const artifact = latest(state.artifacts);
  const golden = latestGoldenPass(state);
  const unknowns = collectUnknowns(state);
  const openAttentions = list(state.attentions).filter((item) => {
    const status = text(item?.status).toUpperCase();
    return !['CLOSED', 'RESOLVED', 'COMPLETE'].includes(status);
  });
  const openBugs = list(state.bugs).filter((item) => {
    const status = text(item?.status).toUpperCase();
    return !['CLOSED', 'RESOLVED', 'COMPLETE'].includes(status);
  });

  return Object.freeze({
    schema: ERGASTERION_REALITY_SCREEN_SCHEMA,
    projectedAt: now(),
    work: Object.freeze(work),
    current: Object.freeze({
      variant: clone(latestVariant),
      logicDraft: clone(latestLogic),
      visualDraft: clone(latestVisual),
    }),
    observed: Object.freeze({
      latestTest: clone(latestRun),
      latestPreview: clone(preview),
      latestRuntimeObservation: clone(runtimeObservation),
      latestRuntimeInteraction: clone(runtimeInteraction),
      latestEvidence: clone(evidence),
      latestArtifact: clone(artifact),
      lastKnownGood: clone(golden),
    }),
    attention: Object.freeze({
      unknowns: Object.freeze([...unknowns]),
      openAttentions: clone(openAttentions),
      openBugs: clone(openBugs),
      blocker: null,
      blockerStatus: openAttentions.length || openBugs.length ? 'REVIEW_REQUIRED' : 'UNKNOWN',
    }),
    truthLabels: Object.freeze(['KNOWN', 'UNKNOWN', 'STALE', 'FAILED', 'VERIFIED']),
    provenance: Object.freeze({
      current: 'ERGASTERION_STATE_V2',
      tests: 'state.testRuns',
      previews: 'state.appPrototypes[].previews',
      runtimeObservations: 'state.runtimeObservations',
      runtimeInteractions: 'state.runtimeInteractions',
      evidence: 'state.evidence',
      artifacts: 'state.artifacts',
      unknowns: 'state projections',
    }),
    readOnly: true,
    createsTruth: false,
    createsAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}
