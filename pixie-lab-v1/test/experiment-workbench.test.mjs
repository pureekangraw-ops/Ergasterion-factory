import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { PIXIE_COMMANDS } from '../pixie-lab/command.mjs';

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 8, 26, 6, 30, tick++)).toISOString();
}

const healthy = () => [
  { roomId: 'ROOM-A', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
  { roomId: 'ROOM-B', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
  { roomId: 'ROOM-C', status: 'PASS', observed: { backendHealth: 'PASS', userEntry: 'PASS', httpStatus: 200 } },
];

test('ROOM-D is dedicated debug room and board exposes lab zones', () => {
  const lab = new PixieLab({ now: clock() });
  const board = lab.board();
  assert.equal(board.rooms.some((room) => room.roomId === 'ROOM-D'), true);
  assert.equal(board.rooms.find((room) => room.roomId === 'ROOM-D').assignedPurpose, 'INSPECT_DEBUG');
  assert.equal(board.zones.debugRoom, 'ROOM-D');
  assert.equal(board.zones.logicWorkbench, 'ACTIVE');
  assert.equal(board.zones.exampleZone, 'ACTIVE');
});

test('Master Gate evaluates latest relevant cross-room check while retaining stale failure history', () => {
  const lab = new PixieLab({ now: clock() });
  lab.runCrossRoom({
    experimentId: 'EXP-ENTRY',
    subjectRef: 'fixture://entry',
    observations: [
      { roomId: 'ROOM-A', status: 'PASS', observed: { state: 'UP' } },
      { roomId: 'ROOM-B', status: 'FAIL', observed: { state: 'DOWN' } },
      { roomId: 'ROOM-C', status: 'FAIL', observed: { state: 'DOWN' } },
    ],
  });
  lab.runCrossRoom({
    experimentId: 'EXP-ENTRY',
    subjectRef: 'fixture://entry',
    observations: healthy(),
  });
  const gate = lab.masterGate({ experimentId: 'EXP-ENTRY' });
  assert.equal(gate.status, 'PASS');
  assert.equal(gate.scope.mode, 'LATEST_RELEVANT_CHECK');
  assert.equal(gate.explanation.currentCrossRoomStatus, 'PASS');
  assert.equal(gate.explanation.staleFailuresIgnoredForCurrentGate, 1);
  assert.equal(gate.historyRetained, true);
  assert.equal(gate.historicalCrossRoomRefs.length, 1);
  assert.equal(gate.historicalCrossRoomRefs[0].status, 'FAIL');
});

test('Master Gate scopes one subject instead of leaking failure from another subject', () => {
  const lab = new PixieLab({ now: clock() });
  lab.runCrossRoom({
    subjectRef: 'fixture://old-broken',
    observations: [
      { roomId: 'ROOM-A', status: 'PASS', observed: { state: 'UP' } },
      { roomId: 'ROOM-B', status: 'FAIL', observed: { state: 'DOWN' } },
    ],
  });
  lab.runCrossRoom({ subjectRef: 'fixture://recovered', observations: healthy() });
  assert.equal(lab.masterGate({ subjectRef: 'fixture://recovered' }).status, 'PASS');
});

test('Logic Workbench preserves original logic while editing a Lab-owned working copy', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createLogicDraft({
    draftId: 'DRAFT-1',
    logicId: 'ENTRY-WATCH',
    sourceRef: 'github://example/source',
    sourceVersion: 'v1',
    content: { rule: { retries: 1 }, checks: ['backend'], note: '  inspect me  ' },
  });
  lab.editLogicDraft('DRAFT-1', { op: 'SET', path: 'rule.retries', value: 4 });
  lab.editLogicDraft('DRAFT-1', { op: 'APPEND', path: 'checks', value: 'public-entry' });
  lab.editLogicDraft('DRAFT-1', { op: 'TRIM_TEXT', path: 'note' });
  const compared = lab.compareLogicDraft('DRAFT-1');
  assert.equal(compared.changed, true);
  assert.equal(compared.original.rule.retries, 1);
  assert.deepEqual(compared.original.checks, ['backend']);
  assert.equal(compared.workingCopy.rule.retries, 4);
  assert.deepEqual(compared.workingCopy.checks, ['backend', 'public-entry']);
  assert.equal(compared.workingCopy.note, 'inspect me');
  assert.equal(compared.approval, 'NOT_AN_APPROVAL');
});

test('Example Zone provides reusable false-green and recovery experiments', () => {
  const lab = new PixieLab({ now: clock() });
  const examples = lab.examples();
  assert.equal(examples.some((item) => item.exampleId === 'GOHUB-ENTRY-FALSE-GREEN'), true);
  assert.equal(examples.some((item) => item.exampleId === 'GOHUB-ENTRY-RECOVERED'), true);
  assert.equal(lab.runExample({ exampleId: 'GOHUB-ENTRY-FALSE-GREEN' }).status, 'FAIL');
  assert.equal(lab.runExample({ exampleId: 'GOHUB-ENTRY-RECOVERED' }).status, 'PASS');
});

test('Debug Room direct Factory handoff rejects normal Work pass', () => {
  const lab = new PixieLab({ now: clock() });
  const result = lab.factoryHandoff({
    roomId: 'ROOM-D',
    workId: 'WORK-X',
    checkpointId: 'CP-X',
    purpose: 'debug finding',
    pass: { kind: 'WORK', state: 'ACTIVE', allowedDestinations: ['factory'] },
  });
  assert.deepEqual(result, {
    status: 'BLOCKED',
    reason: 'FACTORY_HANDOFF_MAINTENANCE_OR_EMERGENCY_REQUIRED',
  });
});

test('Debug Room direct Factory handoff accepts active Maintenance or Emergency Factory authority only', () => {
  const lab = new PixieLab({ now: clock() });
  const maintenance = lab.factoryHandoff({
    roomId: 'ROOM-D',
    workId: 'WORK-X',
    checkpointId: 'CP-X',
    purpose: 'send verified debug finding',
    payload: { finding: 'FALSE_GREEN' },
    pass: { kind: 'MAINTENANCE', state: 'ACTIVE', holder: 'GO', allowedDestinations: ['destination://factory'] },
  });
  assert.equal(maintenance.status, 'READY_FOR_FACTORY');
  assert.equal(maintenance.authority.kind, 'MAINTENANCE');
  assert.equal(maintenance.hostExecutionRequired, true);
  assert.equal(maintenance.pixieProductionAuthority, false);
  assert.equal(maintenance.approval, 'NOT_AN_APPROVAL');

  const emergency = lab.factoryHandoff({
    roomId: 'ROOM-D',
    workId: 'WORK-Y',
    checkpointId: 'CP-Y',
    purpose: 'emergency diagnostic',
    pass: { kind: 'EMERGENCY', state: 'ACTIVE', holder: 'GO', allowedDestinations: ['factory'], expiresAt: '2026-09-26T07:30:00.000Z' },
  });
  assert.equal(emergency.status, 'READY_FOR_FACTORY');
  assert.equal(emergency.authority.kind, 'EMERGENCY');

  const emergencyWithoutExpiry = lab.factoryHandoff({
    roomId: 'ROOM-D',
    workId: 'WORK-Y2',
    checkpointId: 'CP-Y2',
    purpose: 'invalid emergency diagnostic',
    pass: { kind: 'EMERGENCY', state: 'ACTIVE', holder: 'GO', allowedDestinations: ['factory'] },
  });
  assert.equal(emergencyWithoutExpiry.status, 'BLOCKED');
  assert.equal(emergencyWithoutExpiry.reason, 'FACTORY_HANDOFF_EMERGENCY_EXPIRY_REQUIRED');

  const wrongRoom = lab.factoryHandoff({
    roomId: 'ROOM-A',
    workId: 'WORK-Z',
    checkpointId: 'CP-Z',
    purpose: 'not debug room',
    pass: { kind: 'MAINTENANCE', state: 'ACTIVE', allowedDestinations: ['factory'] },
  });
  assert.equal(wrongRoom.status, 'BLOCKED');
  assert.equal(wrongRoom.reason, 'FACTORY_HANDOFF_DEBUG_ROOM_REQUIRED');
});

test('PIXIE command surface exposes Lab zones but still does not expose production authority commands', () => {
  for (const command of ['examples', 'run_example', 'logic_create', 'logic_edit', 'logic_compare']) {
    assert.equal(PIXIE_COMMANDS.includes(command), true);
  }
  for (const command of ['factory_handoff', 'deploy', 'merge', 'delete', 'share', 'external_write']) {
    assert.equal(PIXIE_COMMANDS.includes(command), false);
  }
});
