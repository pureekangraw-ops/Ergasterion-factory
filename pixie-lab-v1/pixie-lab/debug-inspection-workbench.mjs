const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function createDebugInspectionSession({
  debugId,
  bugId,
  now = nowIso,
} = {}) {
  return freeze({
    debugId: required(debugId, 'debugId'),
    bugId: required(bugId, 'bugId'),
    workbench: 'DEBUG_INSPECTION_WORKBENCH',
    status: 'OPEN',
    confidence: 'SUSPECTED',
    steps: [],
    regressionRunRefs: [],
    goldenCaseRefs: [],
    createdAt: now(),
  });
}

export function appendDebugInspectionStep(session, step = {}, { now = nowIso } = {}) {
  if (!session?.debugId) throw new Error('DEBUG_NOT_FOUND');
  const confidence = step.confidence ? text(step.confidence).toUpperCase() : null;
  if (confidence && !['SUSPECTED', 'SUPPORTED', 'CONFIRMED'].includes(confidence)) {
    throw new Error('DEBUG_CONFIDENCE_INVALID');
  }
  const next = clone(session);
  next.workbench = next.workbench || 'DEBUG_INSPECTION_WORKBENCH';
  next.steps = [...(next.steps || []), {
    stepId: required(step.stepId, 'stepId'),
    action: required(step.action, 'action'),
    evidenceRefs: clone(step.evidenceRefs || []),
    observed: clone(step.observed ?? null),
    at: now(),
  }];
  if (confidence) next.confidence = confidence;
  if (step.regressionRunId) next.regressionRunRefs = [...new Set([...(next.regressionRunRefs || []), step.regressionRunId])];
  if (step.goldenCaseId) next.goldenCaseRefs = [...new Set([...(next.goldenCaseRefs || []), step.goldenCaseId])];
  next.status = 'IN_PROGRESS';
  return freeze(next);
}

export function completeDebugInspectionSession(
  session,
  { result = 'DEBUG_COMPLETE', regressionRunRefs = [], goldenCaseRefs = [] } = {},
  { now = nowIso } = {},
) {
  if (!session?.debugId) throw new Error('DEBUG_NOT_FOUND');
  if (result !== 'DEBUG_COMPLETE') throw new Error('DEBUG_REQUIRES_COMPLETE_RESULT');
  const next = clone(session);
  next.workbench = next.workbench || 'DEBUG_INSPECTION_WORKBENCH';
  next.status = 'COMPLETE';
  next.confidence = 'CONFIRMED';
  next.result = result;
  next.regressionRunRefs = [...new Set([...(next.regressionRunRefs || []), ...regressionRunRefs])];
  next.goldenCaseRefs = [...new Set([...(next.goldenCaseRefs || []), ...goldenCaseRefs])];
  next.completedAt = now();
  return freeze(next);
}
