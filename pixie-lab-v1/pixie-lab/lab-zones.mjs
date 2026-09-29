const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const nowIso = () => new Date().toISOString();
const required = (value, label) => { const out = text(value); if (!out) throw new Error(`${label} is required`); return out; };

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const DEBUG_ROOM_ID = 'ROOM-D';

export const EXAMPLE_EXPERIMENTS = freeze([
  {
    exampleId: 'GOHUB-ENTRY-HEALTHY',
    name: 'GO Hub public entry healthy',
    subjectRef: 'fixture://go-hub-public-entry/healthy',
    observations: [
      { roomId: 'ROOM-A', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200, hasGoHubTitle: true, hasCentre: true } },
      { roomId: 'ROOM-B', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200, hasGoHubTitle: true, hasCentre: true } },
      { roomId: 'ROOM-C', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200, hasGoHubTitle: true, hasCentre: true } },
    ],
  },
  {
    exampleId: 'GOHUB-ENTRY-404',
    name: 'GO Hub public entry missing',
    subjectRef: 'fixture://go-hub-public-entry/404',
    observations: [
      { roomId: 'ROOM-A', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
      { roomId: 'ROOM-B', status: 'FAIL', observed: { backendHealth: 'FAIL', userEntry: 'FAIL', httpStatus: 404 } },
      { roomId: 'ROOM-C', status: 'FAIL', observed: { backendHealth: 'FAIL', userEntry: 'FAIL', httpStatus: 404 } },
    ],
  },
  {
    exampleId: 'GOHUB-ENTRY-FALSE-GREEN',
    name: 'Backend green while user entry is down',
    subjectRef: 'fixture://go-hub-public-entry/false-green',
    observations: [
      { roomId: 'ROOM-A', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
      { roomId: 'ROOM-B', status: 'FAIL', observed: { backendHealth: 'FAIL', userEntry: 'FAIL', httpStatus: 404 } },
      { roomId: 'ROOM-C', status: 'FAIL', observed: { backendHealth: 'PASS', userEntry: 'FAIL', httpStatus: 404 } },
    ],
  },
  {
    exampleId: 'GOHUB-ENTRY-RECOVERED',
    name: 'Recovered public entry after repair',
    subjectRef: 'fixture://go-hub-public-entry/recovered',
    observations: [
      { roomId: 'ROOM-A', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
      { roomId: 'ROOM-B', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
      { roomId: 'ROOM-C', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
    ],
  },
  {
    exampleId: 'CRITICAL-UNKNOWN',
    name: 'Critical unknown blocks the gate',
    subjectRef: 'fixture://critical-unknown',
    observations: [
      { roomId: 'ROOM-A', status: 'UNKNOWN', observed: { result: 'UNKNOWN', reason: 'EVIDENCE_UNAVAILABLE' } },
      { roomId: 'ROOM-B', status: 'UNKNOWN', observed: { result: 'UNKNOWN', reason: 'EVIDENCE_UNAVAILABLE' } },
      { roomId: 'ROOM-C', status: 'UNKNOWN', observed: { result: 'UNKNOWN', reason: 'EVIDENCE_UNAVAILABLE' } },
    ],
  },
]);

export function listExampleExperiments() {
  return clone(EXAMPLE_EXPERIMENTS);
}

export function getExampleExperiment(exampleId) {
  const id = upper(exampleId);
  const item = EXAMPLE_EXPERIMENTS.find((entry) => upper(entry.exampleId) === id);
  if (!item) throw new Error('EXAMPLE_NOT_FOUND');
  return clone(item);
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
    if (cursor == null || typeof cursor !== 'object') throw new Error('WORKBENCH_PATH_INVALID');
    if (!(key in cursor)) {
      if (!create) throw new Error('WORKBENCH_PATH_NOT_FOUND');
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  const key = parts.at(-1);
  return { parent: cursor, key, value: cursor?.[key] };
}

export function createLogicDraft({ draftId, logicId, sourceRef, sourceVersion = 'unknown', content, now = nowIso } = {}) {
  const original = clone(content ?? null);
  return freeze({
    draftId: required(draftId, 'draftId'),
    logicId: required(logicId, 'logicId'),
    sourceRef: required(sourceRef, 'sourceRef'),
    sourceVersion: required(sourceVersion, 'sourceVersion'),
    labOwned: true,
    status: 'DRAFT',
    original,
    workingCopy: clone(original),
    edits: [],
    createdAt: now(),
    updatedAt: now(),
  });
}

export function editLogicDraft(draft, edit = {}, { now = nowIso } = {}) {
  if (!draft?.labOwned || draft?.status !== 'DRAFT') throw new Error('WORKBENCH_DRAFT_REQUIRED');
  const op = upper(edit.op);
  const workingCopy = clone(draft.workingCopy);
  const location = targetAt(workingCopy, edit.path, { create: op === 'SET' });
  if (op === 'SET') {
    if (!location.parent || location.key == null) throw new Error('WORKBENCH_ROOT_SET_FORBIDDEN');
    location.parent[location.key] = clone(edit.value);
  } else if (op === 'DELETE') {
    if (!location.parent || location.key == null || !(location.key in location.parent)) throw new Error('WORKBENCH_PATH_NOT_FOUND');
    delete location.parent[location.key];
  } else if (op === 'APPEND') {
    if (!Array.isArray(location.value)) throw new Error('WORKBENCH_APPEND_REQUIRES_ARRAY');
    location.value.push(clone(edit.value));
  } else if (op === 'TRIM_TEXT') {
    if (typeof location.value !== 'string') throw new Error('WORKBENCH_TEXT_REQUIRED');
    location.parent[location.key] = location.value.trim();
  } else if (op === 'REPLACE_TEXT') {
    if (typeof location.value !== 'string') throw new Error('WORKBENCH_TEXT_REQUIRED');
    const find = required(edit.find, 'find');
    location.parent[location.key] = location.value.split(find).join(String(edit.replace ?? ''));
  } else {
    throw new Error('WORKBENCH_OPERATION_NOT_ALLOWED');
  }
  return freeze({
    ...clone(draft),
    workingCopy,
    edits: [...(draft.edits || []), { op, path: pathParts(edit.path), at: now() }],
    updatedAt: now(),
  });
}

export function compareLogicDraft(draft) {
  if (!draft?.labOwned) throw new Error('WORKBENCH_DRAFT_REQUIRED');
  const before = JSON.stringify(draft.original);
  const after = JSON.stringify(draft.workingCopy);
  return freeze({
    draftId: draft.draftId,
    logicId: draft.logicId,
    changed: before !== after,
    original: clone(draft.original),
    workingCopy: clone(draft.workingCopy),
    editCount: Array.isArray(draft.edits) ? draft.edits.length : 0,
    approval: 'NOT_AN_APPROVAL',
  });
}

// Compatibility re-export: production authority belongs to the production/evidence lane.
export { validateFactoryHandoffAuthority, prepareFactoryHandoff } from './production-lane.mjs';
