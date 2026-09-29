const text = (value) => String(value ?? '').trim();
const list = (value) => Array.isArray(value) ? value : [];
const clone = (value) => value == null ? value : structuredClone(value);
const unique = (values = []) => [...new Set(values.map(text).filter(Boolean))];

export const ERGASTERION_BIG_VIEW_SCHEMA = 'ERGASTERION_BIG_VIEW_V1';
export const ERGASTERION_INTENT_REVIEW_SCHEMA = 'ERGASTERION_INTENT_REVIEW_V1';

function latest(values = []) {
  return list(values).length ? list(values).at(-1) : null;
}

function resolveIdea(state = {}, selector = {}) {
  if (selector.ideaId) return list(state.ideas).find((item) => item.ideaId === selector.ideaId) || null;
  if (selector.workId) return [...list(state.ideas)].reverse().find((item) => item.workId === selector.workId) || null;
  return latest(state.ideas);
}

function resolveExperiment(state = {}, idea, selector = {}) {
  const candidates = list(state.experiments).filter((item) => !idea || item.ideaId === idea.ideaId);
  if (selector.experimentId) return candidates.find((item) => item.experimentId === selector.experimentId) || null;
  if (idea?.selectedExperimentId) return candidates.find((item) => item.experimentId === idea.selectedExperimentId) || latest(candidates);
  return latest(candidates);
}

function resolveVariant(state = {}, experiment, selector = {}) {
  const candidates = list(state.variants).filter((item) => !experiment || item.experimentId === experiment.experimentId);
  if (selector.variantId) return candidates.find((item) => item.variantId === selector.variantId) || null;
  if (experiment?.selectedVariantId) return candidates.find((item) => item.variantId === experiment.selectedVariantId) || latest(candidates);
  return latest(candidates);
}

function logicDelta(state = {}, selector = {}) {
  const drafts = list(state.logicDrafts);
  const draft = selector.draftId
    ? drafts.find((item) => item.draftId === selector.draftId)
    : latest(drafts);
  if (!draft) return null;
  return {
    kind: 'LOGIC',
    ref: draft.draftId,
    sourceRef: draft.sourceRef || null,
    before: clone(draft.original),
    after: clone(draft.workingCopy),
    changed: JSON.stringify(draft.original) !== JSON.stringify(draft.workingCopy),
    editCount: list(draft.edits).length,
  };
}

function visualDelta(state = {}, selector = {}) {
  const drafts = list(state.visualDrafts);
  const draft = selector.visualDraftId
    ? drafts.find((item) => item.visualDraftId === selector.visualDraftId)
    : latest(drafts);
  if (!draft) return null;
  return {
    kind: 'VISUAL',
    ref: draft.visualDraftId,
    sourceRef: draft.sourceRef || null,
    before: clone(draft.originalSpec),
    after: clone(draft.workingSpec),
    changed: JSON.stringify(draft.originalSpec) !== JSON.stringify(draft.workingSpec),
    editCount: list(draft.edits).length,
  };
}

function evidenceRefsFor({ state, variant, experiment }) {
  const production = list(state.productionHandoffs).filter((item) =>
    (!experiment || item.experimentId === experiment.experimentId)
    && (!variant || item.variantId === variant.variantId)
  );
  return unique([
    ...list(variant?.evidenceRefs),
    ...production.flatMap((item) => list(item.evidenceRefs)),
    ...list(state.visualVerifications).flatMap((item) =>
      list(item.checks).flatMap((check) => list(check.evidenceRefs))
    ),
    ...list(state.testRuns).flatMap((item) => list(item.evidenceRefs)),
  ]);
}

function unknownsFor({ state, variant, experiment }) {
  const production = list(state.productionHandoffs).filter((item) =>
    (!experiment || item.experimentId === experiment.experimentId)
    && (!variant || item.variantId === variant.variantId)
  );
  return unique([
    ...list(variant?.unknowns),
    ...production.flatMap((item) => list(item.unknowns)),
    ...list(state.roomReports).flatMap((item) => list(item.unknowns)),
    ...list(state.appPrototypes).flatMap((item) => list(item.previews).flatMap((preview) => list(preview.unknowns))),
    ...list(state.visualDrafts).flatMap((item) => list(item.scans).flatMap((scan) => list(scan.unknowns))),
  ]);
}

function runtimeEvidenceStatus(state = {}, experiment = null) {
  const prototypes = list(state.appPrototypes).filter((item) => !experiment || item.experimentId === experiment.experimentId);
  if (!prototypes.length) return { required: false, status: 'NOT_APPLICABLE' };
  const previews = prototypes.flatMap((item) => list(item.previews));
  if (!previews.length) return { required: true, status: 'MISSING' };
  const statuses = previews.map((item) => text(item.status).toUpperCase());
  if (statuses.includes('FAIL')) return { required: true, status: 'FAILED' };
  if (statuses.includes('UNKNOWN')) return { required: true, status: 'UNKNOWN' };
  return { required: true, status: 'RECORDED' };
}

export function projectIntentReview({
  state = {},
  selector = {},
  now = () => new Date().toISOString(),
} = {}) {
  const idea = resolveIdea(state, selector);
  const experiment = resolveExperiment(state, idea, selector);
  const variant = resolveVariant(state, experiment, selector);
  const requestedResult = idea?.requestedResult || latest(state.productionHandoffs)?.requestedResult || null;
  const evidenceRefs = evidenceRefsFor({ state, variant, experiment });
  const unknowns = unknownsFor({ state, variant, experiment });
  const runtime = runtimeEvidenceStatus(state, experiment);

  const missing = [];
  if (!requestedResult) missing.push('REQUESTED_RESULT_UNKNOWN');
  if (variant && !evidenceRefs.length) missing.push('CANDIDATE_EVIDENCE_MISSING');
  if (runtime.required && runtime.status === 'MISSING') missing.push('RUNTIME_PROOF_MISSING');
  if (unknowns.length) missing.push('UNRESOLVED_UNKNOWNS');

  return Object.freeze({
    schema: ERGASTERION_INTENT_REVIEW_SCHEMA,
    projectedAt: now(),
    work: Object.freeze({
      workId: selector.workId || idea?.workId || experiment?.workId || latest(state.productionHandoffs)?.workId || null,
      checkpointId: selector.checkpointId || idea?.checkpointId || experiment?.checkpointId || latest(state.productionHandoffs)?.checkpointId || null,
    }),
    requestedResult,
    mustKeep: clone(idea?.constraints || experiment?.constraints || []),
    coverage: Object.freeze({
      selectedVariantId: variant?.variantId || null,
      evidenceRefs: Object.freeze([...evidenceRefs]),
      runtime,
      unknowns: Object.freeze([...unknowns]),
    }),
    lacking: Object.freeze({
      status: missing.length ? 'REVIEW_REQUIRED' : requestedResult ? 'NO_KNOWN_GAP' : 'UNKNOWN',
      items: Object.freeze(missing),
    }),
    excess: Object.freeze({
      status: 'UNKNOWN',
      items: Object.freeze([]),
      reason: 'CHANGE_SCOPE_DIFF_NOT_AVAILABLE_IN_CURRENT_ERGASTERION_STATE',
    }),
    blocking: false,
    createsAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export function projectBigView({
  state = {},
  selector = {},
  now = () => new Date().toISOString(),
} = {}) {
  const idea = resolveIdea(state, selector);
  const experiment = resolveExperiment(state, idea, selector);
  const variant = resolveVariant(state, experiment, selector);
  const intentReview = projectIntentReview({ state, selector, now });
  const deltas = [logicDelta(state, selector), visualDelta(state, selector)].filter(Boolean);
  const latestRun = latest(state.testRuns);
  const latestPreview = latest(list(state.appPrototypes).flatMap((item) => list(item.previews)));
  const latestEvidence = latest(state.evidence);
  const latestArtifact = latest(state.artifacts);

  return Object.freeze({
    schema: ERGASTERION_BIG_VIEW_SCHEMA,
    projectedAt: now(),
    mission: Object.freeze({
      intent: idea?.intent || null,
      requestedResult: intentReview.requestedResult,
      mustKeep: clone(intentReview.mustKeep),
      workId: intentReview.work.workId,
      checkpointId: intentReview.work.checkpointId,
    }),
    selected: Object.freeze({
      ideaId: idea?.ideaId || null,
      experimentId: experiment?.experimentId || null,
      variantId: variant?.variantId || null,
    }),
    beforeAfter: Object.freeze(deltas.map((delta) => Object.freeze(delta))),
    proof: Object.freeze({
      latestTest: clone(latestRun),
      latestPreview: clone(latestPreview),
      latestEvidence: clone(latestEvidence),
      latestArtifact: clone(latestArtifact),
      evidenceRefs: intentReview.coverage.evidenceRefs,
      unknowns: intentReview.coverage.unknowns,
    }),
    intentReview,
    ownerDecision: Object.freeze({
      status: 'NOT_REQUESTED',
      approval: 'NOT_AN_APPROVAL',
    }),
    readOnly: true,
    createsTruth: false,
    createsAuthority: false,
  });
}
