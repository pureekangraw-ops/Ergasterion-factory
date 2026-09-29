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

export const EXPERIMENT_KINDS = Object.freeze(['GENERAL', 'LOGIC', 'VISUAL', 'APP']);

export function createIdea({
  ideaId,
  title,
  intent,
  requestedResult,
  workId = null,
  checkpointId = null,
  sourceRefs = [],
  constraints = [],
  now = nowIso,
} = {}) {
  return freeze({
    ideaId: required(ideaId, 'ideaId'),
    title: required(title, 'title'),
    intent: required(intent, 'intent'),
    requestedResult: required(requestedResult, 'requestedResult'),
    workId: text(workId) || null,
    checkpointId: text(checkpointId) || null,
    sourceRefs: unique(sourceRefs),
    constraints: unique(constraints),
    status: 'OPEN',
    experimentRefs: [],
    selectedExperimentId: null,
    createdAt: now(),
    updatedAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}

export function createExperiment({
  experimentId,
  ideaId,
  kind = 'GENERAL',
  goal,
  hypothesis = null,
  sourceRefs = [],
  constraints = [],
  workId = null,
  checkpointId = null,
  now = nowIso,
} = {}) {
  const normalizedKind = upper(kind || 'GENERAL');
  if (!EXPERIMENT_KINDS.includes(normalizedKind)) throw new Error('EXPERIMENT_KIND_INVALID');
  return freeze({
    experimentId: required(experimentId, 'experimentId'),
    ideaId: required(ideaId, 'ideaId'),
    kind: normalizedKind,
    goal: required(goal, 'goal'),
    hypothesis: text(hypothesis) || null,
    sourceRefs: unique(sourceRefs),
    constraints: unique(constraints),
    workId: text(workId) || null,
    checkpointId: text(checkpointId) || null,
    status: 'OPEN',
    variantRefs: [],
    selectedVariantId: null,
    createdAt: now(),
    updatedAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}

export function createVariant({
  variantId,
  experimentId,
  kind = 'GENERAL',
  label = null,
  parentVariantId = null,
  spec = {},
  sourceRefs = [],
  now = nowIso,
} = {}) {
  const normalizedKind = upper(kind || 'GENERAL');
  if (!EXPERIMENT_KINDS.includes(normalizedKind)) throw new Error('VARIANT_KIND_INVALID');
  return freeze({
    variantId: required(variantId, 'variantId'),
    experimentId: required(experimentId, 'experimentId'),
    kind: normalizedKind,
    label: text(label) || null,
    parentVariantId: text(parentVariantId) || null,
    spec: clone(spec ?? {}),
    sourceRefs: unique(sourceRefs),
    artifactRefs: [],
    evidenceRefs: [],
    unknowns: [],
    evaluations: [],
    status: 'DRAFT',
    createdAt: now(),
    updatedAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}

export function evaluateVariant(variant, {
  evaluationId,
  status = 'UNKNOWN',
  detail = null,
  artifactRefs = [],
  evidenceRefs = [],
  unknowns = [],
  now = nowIso,
} = {}) {
  if (!variant?.variantId) throw new Error('VARIANT_REQUIRED');
  const evidence = unique(evidenceRefs);
  let normalized = upper(status || 'UNKNOWN');
  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(normalized)) normalized = 'UNKNOWN';
  if (['PASS', 'FAIL'].includes(normalized) && !evidence.length) normalized = 'UNKNOWN';
  const evaluation = freeze({
    evaluationId: required(evaluationId, 'evaluationId'),
    status: normalized,
    detail: text(detail) || null,
    artifactRefs: unique(artifactRefs),
    evidenceRefs: evidence,
    unknowns: unique(unknowns),
    evaluatedAt: now(),
  });
  return freeze({
    ...clone(variant),
    artifactRefs: unique([...(variant.artifactRefs || []), ...evaluation.artifactRefs]),
    evidenceRefs: unique([...(variant.evidenceRefs || []), ...evaluation.evidenceRefs]),
    unknowns: unique([...(variant.unknowns || []), ...evaluation.unknowns]),
    evaluations: [...(variant.evaluations || []), evaluation],
    status: normalized === 'PASS' ? 'CANDIDATE' : normalized === 'FAIL' ? 'NEEDS_WORK' : 'DRAFT',
    updatedAt: now(),
  });
}

export function selectExperimentCandidate(experiment, variant, { selectedBy = 'BIG', now = nowIso } = {}) {
  if (!experiment?.experimentId) throw new Error('EXPERIMENT_REQUIRED');
  if (!variant?.variantId || variant.experimentId !== experiment.experimentId) throw new Error('VARIANT_EXPERIMENT_MISMATCH');
  if (!(experiment.variantRefs || []).includes(variant.variantId)) throw new Error('VARIANT_NOT_IN_EXPERIMENT');
  return freeze({
    ...clone(experiment),
    selectedVariantId: variant.variantId,
    status: 'CANDIDATE_SELECTED',
    selectedBy: required(selectedBy, 'selectedBy'),
    selectedAt: now(),
    updatedAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}

export function createAppPrototype({
  prototypeId,
  experimentId,
  variantId,
  entryRef = null,
  previewMode = 'HOST_PREVIEW',
  spec = {},
  now = nowIso,
} = {}) {
  return freeze({
    prototypeId: required(prototypeId, 'prototypeId'),
    experimentId: required(experimentId, 'experimentId'),
    variantId: required(variantId, 'variantId'),
    entryRef: text(entryRef) || null,
    previewMode: upper(previewMode || 'HOST_PREVIEW'),
    spec: clone(spec ?? {}),
    previews: [],
    status: 'DRAFT',
    externalExecutionAuthority: false,
    createdAt: now(),
    updatedAt: now(),
    approval: 'NOT_AN_APPROVAL',
  });
}

export function recordAppPreview(prototype, {
  previewId,
  observedRef,
  status = 'UNKNOWN',
  evidenceRefs = [],
  unknowns = [],
  now = nowIso,
} = {}) {
  if (!prototype?.prototypeId) throw new Error('APP_PROTOTYPE_REQUIRED');
  const evidence = unique(evidenceRefs);
  let normalized = upper(status || 'UNKNOWN');
  if (!['PASS', 'FAIL', 'UNKNOWN'].includes(normalized)) normalized = 'UNKNOWN';
  if (['PASS', 'FAIL'].includes(normalized) && !evidence.length) normalized = 'UNKNOWN';
  const preview = freeze({
    previewId: required(previewId, 'previewId'),
    observedRef: required(observedRef, 'observedRef'),
    status: normalized,
    evidenceRefs: evidence,
    unknowns: unique(unknowns),
    observedAt: now(),
  });
  return freeze({
    ...clone(prototype),
    previews: [...(prototype.previews || []), preview],
    status: normalized === 'PASS' ? 'PREVIEWED' : normalized === 'FAIL' ? 'NEEDS_WORK' : 'DRAFT',
    updatedAt: now(),
  });
}
