import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import {
  ERGASTERION_BIG_VIEW_SCHEMA,
  ERGASTERION_INTENT_REVIEW_SCHEMA,
} from '../pixie-lab/owner-view.mjs';

const now = () => '2026-09-30T01:30:00.000Z';

function seed(lab) {
  lab.createIdea({
    ideaId: 'IDEA-BIG',
    title: 'BIG view',
    intent: 'show owner what changed',
    requestedResult: 'visual focus moves to workbench',
    workId: 'WORK-BIG',
    checkpointId: 'CP-BIG',
    constraints: ['KEEP_REFERENCE'],
  });
  lab.createExperiment({
    experimentId: 'EXP-BIG',
    ideaId: 'IDEA-BIG',
    kind: 'VISUAL',
    goal: 'compare visual intent',
    workId: 'WORK-BIG',
    checkpointId: 'CP-BIG',
  });
  lab.createVariant({
    variantId: 'VAR-BIG',
    experimentId: 'EXP-BIG',
    kind: 'VISUAL',
    spec: { focus: 'factory' },
  });
  lab.createVisualDraft({
    visualDraftId: 'VIS-BIG',
    experimentId: 'EXP-BIG',
    variantId: 'VAR-BIG',
    sourceRef: 'image://factory',
    spec: { focus: 'factory', keep: 'reference' },
  });
  lab.editVisualDraft('VIS-BIG', {
    op: 'SET',
    path: 'focus',
    value: 'workbench',
  });
}

test('BIG view shows Before/After from real draft state without creating approval', () => {
  const lab = new PixieLab({ now });
  seed(lab);
  const before = structuredClone(lab.state);

  const view = lab.bigView({
    workId: 'WORK-BIG',
    checkpointId: 'CP-BIG',
    visualDraftId: 'VIS-BIG',
  });

  assert.equal(view.schema, ERGASTERION_BIG_VIEW_SCHEMA);
  assert.equal(view.mission.requestedResult, 'visual focus moves to workbench');
  assert.equal(view.mission.workId, 'WORK-BIG');
  assert.equal(view.beforeAfter.length, 1);
  assert.equal(view.beforeAfter[0].kind, 'VISUAL');
  assert.equal(view.beforeAfter[0].before.focus, 'factory');
  assert.equal(view.beforeAfter[0].after.focus, 'workbench');
  assert.equal(view.ownerDecision.approval, 'NOT_AN_APPROVAL');
  assert.equal(view.createsTruth, false);
  assert.equal(view.createsAuthority, false);
  assert.deepEqual(lab.state, before);
});

test('Intent Review reports known missing evidence but does not invent excess scope', () => {
  const lab = new PixieLab({ now });
  seed(lab);

  const review = lab.intentReview({
    workId: 'WORK-BIG',
    checkpointId: 'CP-BIG',
    experimentId: 'EXP-BIG',
    variantId: 'VAR-BIG',
  });

  assert.equal(review.schema, ERGASTERION_INTENT_REVIEW_SCHEMA);
  assert.equal(review.requestedResult, 'visual focus moves to workbench');
  assert.equal(review.lacking.status, 'REVIEW_REQUIRED');
  assert.equal(review.lacking.items.includes('CANDIDATE_EVIDENCE_MISSING'), true);
  assert.equal(review.excess.status, 'UNKNOWN');
  assert.equal(review.excess.reason, 'CHANGE_SCOPE_DIFF_NOT_AVAILABLE_IN_CURRENT_ERGASTERION_STATE');
  assert.equal(review.blocking, false);
  assert.equal(review.createsAuthority, false);
});

test('big_view and intent_review commands are read-only', async () => {
  let saves = 0;
  const persistence = {
    async load() { return null; },
    async save() { saves += 1; },
  };
  const pixie = createPixieCommander({ persistence, now });

  const big = await pixie.execute({ command: 'big_view' });
  const review = await pixie.execute({ command: 'intent_review' });

  assert.equal(big.ok, true);
  assert.equal(big.mutated, false);
  assert.equal(big.result.schema, ERGASTERION_BIG_VIEW_SCHEMA);
  assert.equal(review.ok, true);
  assert.equal(review.mutated, false);
  assert.equal(review.result.schema, ERGASTERION_INTENT_REVIEW_SCHEMA);
  assert.equal(saves, 0);
});
