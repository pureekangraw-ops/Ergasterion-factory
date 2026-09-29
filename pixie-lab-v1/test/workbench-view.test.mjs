import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import {
  ERGASTERION_WORKBENCH_VIEW_SCHEMA,
  WORKBENCH_IDS,
} from '../pixie-lab/workbench-view.mjs';

const now = () => '2026-09-29T16:30:00.000Z';

function seedIdea(lab) {
  lab.createIdea({
    ideaId: 'IDEA-VIEW',
    title: 'Workbench view',
    intent: 'put real work on the table',
    requestedResult: 'read current artifacts without mutation',
    workId: 'WORK-VIEW',
    checkpointId: 'CP-VIEW',
    constraints: ['KEEP_CURRENT_BEHAVIOR'],
  });
  lab.createExperiment({
    experimentId: 'EXP-VIEW',
    ideaId: 'IDEA-VIEW',
    kind: 'VISUAL',
    goal: 'surface a visual candidate',
    workId: 'WORK-VIEW',
    checkpointId: 'CP-VIEW',
  });
  lab.createVariant({
    variantId: 'VAR-VIEW',
    experimentId: 'EXP-VIEW',
    kind: 'VISUAL',
    spec: { subject: 'factory' },
  });
  lab.createVisualDraft({
    visualDraftId: 'VIS-VIEW',
    experimentId: 'EXP-VIEW',
    variantId: 'VAR-VIEW',
    sourceRef: 'image://factory',
    spec: { focus: 'workbench' },
  });
}

test('workbench_open exposes real General/Idea objects without mutating state', () => {
  const lab = new PixieLab({ now });
  seedIdea(lab);
  const before = structuredClone(lab.state);

  const view = lab.openWorkbench('GENERAL_IDEA_WORKBENCH', {
    workId: 'WORK-VIEW',
    checkpointId: 'CP-VIEW',
    experimentId: 'EXP-VIEW',
  });

  assert.equal(view.ok, true);
  assert.equal(view.schema, ERGASTERION_WORKBENCH_VIEW_SCHEMA);
  assert.equal(view.workbenchId, 'GENERAL_IDEA_WORKBENCH');
  assert.equal(view.missionStrip.workId, 'WORK-VIEW');
  assert.equal(view.missionStrip.checkpointId, 'CP-VIEW');
  assert.equal(view.idea.ideaId, 'IDEA-VIEW');
  assert.equal(view.experiment.experimentId, 'EXP-VIEW');
  assert.equal(view.variants[0].variantId, 'VAR-VIEW');
  assert.equal(view.authority.createsAuthority, false);
  assert.equal(view.authority.transfersAuthority, false);
  assert.deepEqual(lab.state, before);
});

test('Visual Workbench opens source/working/evidence path and uses existing tool inventory', () => {
  const lab = new PixieLab({ now });
  seedIdea(lab);
  const view = lab.openWorkbench('VISUAL_WORKBENCH', { visualDraftId: 'VIS-VIEW' });

  assert.equal(view.ok, true);
  assert.equal(view.draft.visualDraftId, 'VIS-VIEW');
  assert.equal(view.compare.changed, false);
  assert.equal(view.compare.originalSpec.focus, 'workbench');
  assert.equal(view.compare.workingSpec.focus, 'workbench');
  assert.equal(view.toolRail.includes('visual_edit'), true);
  assert.equal(view.toolRail.includes('image_request'), true);
  assert.equal(view.authority.approval, 'NOT_AN_APPROVAL');
});

test('Coding and Runtime views tell the truth about execution gaps', () => {
  const lab = new PixieLab({ now });
  const coding = lab.openWorkbench('CODING_WORKBENCH');
  const runtime = lab.openWorkbench('RUNTIME_WORKBENCH');

  assert.equal(coding.status, 'GAP');
  assert.equal(coding.reality, 'NOT_IMPLEMENTED');
  assert.equal(coding.missing.includes('SHELL'), true);
  assert.equal(runtime.status, 'PARTIAL');
  assert.equal(runtime.executionReality, 'UNKNOWN');
  assert.equal(runtime.missing.includes('INTERACT_RUNTIME'), true);
});

test('unknown workbench never creates a fallback surface', () => {
  const lab = new PixieLab({ now });
  const view = lab.openWorkbench('MAGIC_ROOM');

  assert.equal(view.ok, false);
  assert.equal(view.error, 'WORKBENCH_NOT_FOUND');
  assert.deepEqual(view.availableWorkbenchIds, [...WORKBENCH_IDS]);
  assert.equal(view.authority.createsAuthority, false);
});

test('workbench_open command is read-only and never persists', async () => {
  let saves = 0;
  const persistence = {
    async load() { return null; },
    async save() { saves += 1; },
  };
  const pixie = createPixieCommander({ persistence, now });

  const out = await pixie.execute({
    command: 'workbench_open',
    args: { workbenchId: 'VISUAL_WORKBENCH' },
  });

  assert.equal(out.ok, true);
  assert.equal(out.command, 'workbench_open');
  assert.equal(out.mutated, false);
  assert.equal(out.result.workbenchId, 'VISUAL_WORKBENCH');
  assert.equal(saves, 0);
});
