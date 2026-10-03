const text = (value) => String(value ?? '').trim();
const clone = (value) => value == null ? value : structuredClone(value);
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
const required = (value, label) => { const result = text(value); if (!result) throw new Error(`${label} is required`); return result; };
const freeze = (value) => Object.freeze(clone(value));
const iso = () => new Date().toISOString();

export const VISUAL_CREW_WORKERS = Object.freeze([
  Object.freeze({ workerId:'ASSET_SCOUT', label:'Asset Scout', responsibility:'resolve source and reference assets' }),
  Object.freeze({ workerId:'IMAGE_PREP', label:'Image Prep', responsibility:'prepare dimensions, crop, transparency and safe source copies' }),
  Object.freeze({ workerId:'VISUAL_EDITOR', label:'Visual Editor', responsibility:'apply the requested visual change without overwriting source' }),
  Object.freeze({ workerId:'RENDERER', label:'Renderer', responsibility:'emit requested output profiles and candidate artifacts' }),
  Object.freeze({ workerId:'INSPECTOR', label:'Inspector', responsibility:'check brief, dimensions, safe area, artifacts and evidence' }),
]);

export const CREW_PHASES = Object.freeze(['RECEIVE','RESOLVE','PLAN','EXECUTE','COMPARE','VERIFY','RETURN']);
export const CREW_STEP_STATUSES = Object.freeze(['QUEUED','ACTIVE','DONE','BLOCKED','UNKNOWN']);

function worker(workerId) {
  const item = VISUAL_CREW_WORKERS.find((entry) => entry.workerId === text(workerId).toUpperCase());
  if (!item) throw new Error('VISUAL_CREW_WORKER_UNKNOWN');
  return item;
}

function currentStepIndex(task) {
  return task.steps.findIndex((step) => !['DONE'].includes(step.status));
}

export function createVisualCrewTask({
  taskId, workId, checkpointId, brief, requestedOutput,
  assetRefs = [], constraints = [], workerIds = VISUAL_CREW_WORKERS.map((item) => item.workerId),
  createdAt = iso(),
} = {}) {
  const ids = unique(workerIds.map((item) => text(item).toUpperCase()));
  if (!ids.length) throw new Error('VISUAL_CREW_WORKERS_REQUIRED');
  const steps = ids.map((workerId, index) => {
    const definition = worker(workerId);
    return {
      stepId: `${required(taskId, 'taskId')}::${String(index + 1).padStart(2,'0')}::${workerId}`,
      workerId,
      workerLabel: definition.label,
      responsibility: definition.responsibility,
      status: 'QUEUED',
      resultRefs: [],
      evidenceRefs: [],
      unknowns: [],
      note: null,
      updatedAt: createdAt,
    };
  });
  return freeze({
    schema: 'PIXIE_VISUAL_CREW_TASK_V1',
    taskId: required(taskId, 'taskId'),
    workId: required(workId, 'workId'),
    checkpointId: required(checkpointId, 'checkpointId'),
    brief: required(brief, 'brief'),
    requestedOutput: required(requestedOutput, 'requestedOutput'),
    sourceAssetRefs: unique(assetRefs),
    constraints: unique(constraints),
    sourceMutationAllowed: false,
    phase: 'PLAN',
    status: 'PLANNED',
    steps,
    candidateRefs: [],
    selectedCandidateRef: null,
    compareRefs: [],
    verificationRefs: [],
    resultRef: null,
    unknowns: [],
    createdAt,
    updatedAt: createdAt,
  });
}

export function advanceVisualCrewTask(task, {
  stepId, status, resultRefs = [], evidenceRefs = [], unknowns = [], note = null, updatedAt = iso(),
} = {}) {
  const next = clone(task);
  if (!next?.taskId || !Array.isArray(next.steps)) throw new Error('VISUAL_CREW_TASK_REQUIRED');
  const index = next.steps.findIndex((step) => step.stepId === required(stepId, 'stepId'));
  if (index < 0) throw new Error('VISUAL_CREW_STEP_NOT_FOUND');
  const expectedIndex = currentStepIndex(next);
  if (expectedIndex >= 0 && index !== expectedIndex) throw new Error(`VISUAL_CREW_STEP_ORDER_REQUIRED:${next.steps[expectedIndex].stepId}`);
  const normalized = text(status).toUpperCase();
  if (!CREW_STEP_STATUSES.includes(normalized)) throw new Error('VISUAL_CREW_STEP_STATUS_INVALID');
  const step = next.steps[index];
  Object.assign(step, {
    status: normalized,
    resultRefs: unique(resultRefs),
    evidenceRefs: unique(evidenceRefs),
    unknowns: unique(unknowns),
    note: text(note) || null,
    updatedAt,
  });
  next.unknowns = unique([...next.unknowns, ...step.unknowns]);
  if (normalized === 'DONE') {
    next.candidateRefs = unique([...next.candidateRefs, ...step.resultRefs]);
    const remaining = currentStepIndex(next);
    next.phase = remaining < 0 ? 'COMPARE' : 'EXECUTE';
    next.status = remaining < 0 ? 'READY_TO_COMPARE' : 'IN_PROGRESS';
  } else if (normalized === 'ACTIVE') {
    next.phase = 'EXECUTE'; next.status = 'IN_PROGRESS';
  } else {
    next.phase = 'EXECUTE'; next.status = normalized;
  }
  next.updatedAt = updatedAt;
  return freeze(next);
}

export function compareVisualCrewTask(task, {
  compareId, candidateRefs, selectedCandidateRef = null, note = null, createdAt = iso(),
} = {}) {
  const refs = unique(candidateRefs);
  if (refs.length < 2) throw new Error('VISUAL_CREW_COMPARE_REQUIRES_TWO_CANDIDATES');
  const available = new Set(task?.candidateRefs || []);
  if (refs.some((ref) => !available.has(ref))) throw new Error('VISUAL_CREW_COMPARE_CANDIDATE_UNKNOWN');
  const selected = text(selectedCandidateRef) || null;
  if (selected && !refs.includes(selected)) throw new Error('VISUAL_CREW_SELECTED_CANDIDATE_NOT_IN_COMPARE');
  return freeze({
    schema:'PIXIE_VISUAL_CREW_COMPARE_V1',
    compareId: required(compareId, 'compareId'),
    taskId: required(task?.taskId, 'task.taskId'),
    workId: task.workId,
    checkpointId: task.checkpointId,
    candidateRefs: refs,
    selectedCandidateRef: selected,
    note: text(note) || null,
    approval: 'NOT_AN_APPROVAL',
    createdAt,
  });
}

export function attachVisualCrewCompare(task, compare) {
  if (compare?.taskId !== task?.taskId) throw new Error('VISUAL_CREW_COMPARE_TASK_MISMATCH');
  const next = clone(task);
  next.compareRefs = unique([...next.compareRefs, compare.compareId]);
  next.selectedCandidateRef = compare.selectedCandidateRef || next.selectedCandidateRef || null;
  next.phase = 'VERIFY';
  next.status = next.selectedCandidateRef ? 'READY_TO_VERIFY' : 'WAIT_SELECTION';
  next.updatedAt = compare.createdAt;
  return freeze(next);
}

export function verifyVisualCrewTask(task, {
  verificationId, status = 'UNKNOWN', evidenceRefs = [], checks = {}, unknowns = [], verifiedAt = iso(),
} = {}) {
  const normalized = text(status).toUpperCase();
  if (!['PASS','FAIL','UNKNOWN'].includes(normalized)) throw new Error('VISUAL_CREW_VERIFICATION_STATUS_INVALID');
  if (normalized === 'PASS' && !task?.selectedCandidateRef) throw new Error('VISUAL_CREW_SELECTION_REQUIRED');
  if (normalized === 'PASS' && !unique(evidenceRefs).length) throw new Error('VISUAL_CREW_PASS_REQUIRES_EVIDENCE');
  return freeze({
    schema:'PIXIE_VISUAL_CREW_VERIFICATION_V1',
    verificationId: required(verificationId, 'verificationId'),
    taskId: required(task?.taskId, 'task.taskId'),
    workId: task.workId,
    checkpointId: task.checkpointId,
    candidateRef: task.selectedCandidateRef || null,
    status: normalized,
    evidenceRefs: unique(evidenceRefs),
    checks: clone(checks),
    unknowns: unique(unknowns),
    verifiedAt,
  });
}

export function attachVisualCrewVerification(task, verification) {
  if (verification?.taskId !== task?.taskId) throw new Error('VISUAL_CREW_VERIFICATION_TASK_MISMATCH');
  const next = clone(task);
  next.verificationRefs = unique([...next.verificationRefs, verification.verificationId]);
  next.unknowns = unique([...next.unknowns, ...(verification.unknowns || [])]);
  next.phase = verification.status === 'PASS' ? 'RETURN' : 'VERIFY';
  next.status = verification.status === 'PASS' ? 'VERIFIED' : verification.status;
  next.resultRef = verification.status === 'PASS' ? next.selectedCandidateRef : null;
  next.updatedAt = verification.verifiedAt;
  return freeze(next);
}

export function projectVisualCrewResult(task, { compares = [], verifications = [] } = {}) {
  if (!task) return null;
  const compareSet = new Set(task.compareRefs || []);
  const verificationSet = new Set(task.verificationRefs || []);
  return freeze({
    task: clone(task),
    workers: VISUAL_CREW_WORKERS.map((item) => clone(item)),
    compares: compares.filter((item) => compareSet.has(item.compareId)).map(clone),
    verifications: verifications.filter((item) => verificationSet.has(item.verificationId)).map(clone),
    ready: task.status === 'VERIFIED' && Boolean(task.resultRef),
    resultRef: task.resultRef || null,
    sourceMutationAllowed: false,
  });
}
