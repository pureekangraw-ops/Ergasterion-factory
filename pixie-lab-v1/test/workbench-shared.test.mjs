import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import {
  ERGASTERION_CHECKPOINT_DOCK_SCHEMA,
  ERGASTERION_REALITY_SCREEN_SCHEMA,
} from '../pixie-lab/workbench-shared.mjs';

const now = () => '2026-09-29T17:00:00.000Z';

function seed(lab) {
  lab.createIdea({
    ideaId: 'IDEA-SHARED',
    title: 'Shared surfaces',
    intent: 'resume and inspect reality',
    requestedResult: 'read current state without inventing truth',
    workId: 'WORK-SHARED',
    checkpointId: 'CP-SHARED',
  });
  lab.createExperiment({
    experimentId: 'EXP-SHARED',
    ideaId: 'IDEA-SHARED',
    kind: 'GENERAL',
    goal: 'prove shared projections',
    workId: 'WORK-SHARED',
    checkpointId: 'CP-SHARED',
  });
  lab.createVariant({
    variantId: 'VAR-SHARED',
    experimentId: 'EXP-SHARED',
    kind: 'GENERAL',
    spec: { current: true },
  });
}

test('Checkpoint Dock resumes current Work identity without creating next action', () => {
  const lab = new PixieLab({ now });
  seed(lab);
  const before = structuredClone(lab.state);

  const dock = lab.checkpointDock({
    workId: 'WORK-SHARED',
    checkpointId: 'CP-SHARED',
  });

  assert.equal(dock.schema, ERGASTERION_CHECKPOINT_DOCK_SCHEMA);
  assert.equal(dock.work.workId, 'WORK-SHARED');
  assert.equal(dock.work.checkpointId, 'CP-SHARED');
  assert.equal(dock.resume.nextAction, null);
  assert.equal(dock.resume.nextActionStatus, 'UNKNOWN');
  assert.equal(dock.readOnly, true);
  assert.equal(dock.createsWork, false);
  assert.equal(dock.createsAuthority, false);
  assert.deepEqual(lab.state, before);
});

test('Reality Screen projects current sources and does not create truth', () => {
  const lab = new PixieLab({ now });
  seed(lab);
  const before = structuredClone(lab.state);

  const reality = lab.realityScreen({
    workId: 'WORK-SHARED',
    checkpointId: 'CP-SHARED',
  });

  assert.equal(reality.schema, ERGASTERION_REALITY_SCREEN_SCHEMA);
  assert.equal(reality.work.workId, 'WORK-SHARED');
  assert.equal(reality.current.variant.variantId, 'VAR-SHARED');
  assert.equal(reality.observed.latestTest, null);
  assert.equal(reality.observed.latestPreview, null);
  assert.equal(reality.attention.blocker, null);
  assert.equal(reality.attention.blockerStatus, 'UNKNOWN');
  assert.equal(reality.provenance.current, 'ERGASTERION_STATE_V2');
  assert.equal(reality.createsTruth, false);
  assert.equal(reality.createsAuthority, false);
  assert.deepEqual(lab.state, before);
});

test('checkpoint_dock and reality_screen commands are read-only', async () => {
  let saves = 0;
  const persistence = {
    async load() { return null; },
    async save() { saves += 1; },
  };
  const pixie = createPixieCommander({ persistence, now });

  const dock = await pixie.execute({ command: 'checkpoint_dock' });
  const reality = await pixie.execute({ command: 'reality_screen' });

  assert.equal(dock.ok, true);
  assert.equal(dock.mutated, false);
  assert.equal(dock.result.schema, ERGASTERION_CHECKPOINT_DOCK_SCHEMA);
  assert.equal(reality.ok, true);
  assert.equal(reality.mutated, false);
  assert.equal(reality.result.schema, ERGASTERION_REALITY_SCREEN_SCHEMA);
  assert.equal(saves, 0);
});
