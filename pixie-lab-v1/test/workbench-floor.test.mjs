import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import { ERGASTERION_WORKBENCH_FLOOR_SCHEMA } from '../pixie-lab/workbench-floor.mjs';

const now = () => '2026-09-29T16:00:00.000Z';

test('workbench floor projects A/B/C as labs and keeps ROOM-D compatibility-only', () => {
  const lab = new PixieLab({ now });
  const floor = lab.workbenchFloor();

  assert.equal(floor.schema, ERGASTERION_WORKBENCH_FLOOR_SCHEMA);
  assert.equal(floor.sourceStateSchema, 'ERGASTERION_STATE_V2');
  assert.equal(floor.architecture.canonicalUnit, 'WORKBENCH');
  assert.deepEqual(floor.architecture.experimentalLabExceptions, ['ROOM-A', 'ROOM-B', 'ROOM-C']);
  assert.deepEqual(floor.labs.experimental.map((room) => room.roomId), ['ROOM-A', 'ROOM-B', 'ROOM-C']);
  assert.equal(floor.labs.legacyDebugRoom.roomId, 'ROOM-D');
  assert.equal(floor.labs.legacyDebugRoom.compatibilityOnly, true);
  assert.equal(floor.workbenches.debugInspection.status, 'ACTIVE');
  assert.equal(floor.legacy.roomDRouteCurrent, false);
  assert.equal(floor.legacy.factoryHandoffCurrent, false);
});

test('workbench floor surfaces current capability state without inventing missing execution', () => {
  const lab = new PixieLab({ now });
  lab.createIdea({
    ideaId: 'IDEA-FLOOR',
    title: 'Floor',
    intent: 'surface current work',
    requestedResult: 'show current factory state',
    workId: 'WORK-FLOOR',
    checkpointId: 'CP-FLOOR',
  });
  lab.createExperiment({
    experimentId: 'EXP-FLOOR',
    ideaId: 'IDEA-FLOOR',
    kind: 'GENERAL',
    goal: 'prove projection',
    workId: 'WORK-FLOOR',
    checkpointId: 'CP-FLOOR',
  });
  lab.createVariant({
    variantId: 'VAR-FLOOR',
    experimentId: 'EXP-FLOOR',
    kind: 'GENERAL',
    spec: { surface: 'workbench' },
  });
  lab.createVisualDraft({
    visualDraftId: 'VIS-FLOOR',
    experimentId: 'EXP-FLOOR',
    variantId: 'VAR-FLOOR',
    sourceRef: 'image://floor',
    spec: { focus: 'current' },
  });
  lab.recordEvidence({
    evidenceId: 'EVID-FLOOR',
    kind: 'SURFACE_CHECK',
    status: 'UNKNOWN',
    sourceRef: 'test://workbench-floor',
  });

  const before = structuredClone(lab.state);
  const floor = lab.workbenchFloor();

  assert.equal(floor.workbenches.generalIdea.counts.ideas, 1);
  assert.equal(floor.workbenches.generalIdea.current.workId, 'WORK-FLOOR');
  assert.equal(floor.workbenches.generalIdea.current.checkpointId, 'CP-FLOOR');
  assert.equal(floor.workbenches.visual.count, 1);
  assert.equal(floor.shared.evidence.count, 1);
  assert.equal(floor.workbenches.coding.status, 'HOST_DEPENDENT');
  assert.equal(floor.workbenches.coding.runtimeCheck, 'coding_status');
  assert.equal(floor.workbenches.runtime.status, 'PARTIAL');
  assert.equal(floor.authority.createsAuthority, false);
  assert.equal(floor.authority.transfersAuthority, false);
  assert.equal(floor.authority.approval, 'NOT_AN_APPROVAL');
  assert.deepEqual(lab.state, before);
});

test('workbench_floor command is read-only and does not persist', async () => {
  let saves = 0;
  const persistence = {
    async load() { return null; },
    async save() { saves += 1; },
  };
  const pixie = createPixieCommander({ persistence, now });
  const out = await pixie.execute({ command: 'workbench_floor' });

  assert.equal(out.ok, true);
  assert.equal(out.command, 'workbench_floor');
  assert.equal(out.mutated, false);
  assert.equal(out.result.schema, ERGASTERION_WORKBENCH_FLOOR_SCHEMA);
  assert.equal(saves, 0);
});
