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


// Compatibility exports. Canonical Logic behavior lives in logic-workbench.mjs.
export {
  createLogicDraft,
  editLogicDraft,
  compareLogicDraft,
} from './logic-workbench.mjs';

// Legacy Factory route compatibility only.
export { validateFactoryHandoffAuthority, prepareFactoryHandoff } from './production-lane.mjs';
