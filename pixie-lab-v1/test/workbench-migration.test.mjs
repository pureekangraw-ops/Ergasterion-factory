import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLogicDraft as createCanonicalLogicDraft,
  editLogicDraft as editCanonicalLogicDraft,
  compareLogicDraft as compareCanonicalLogicDraft,
} from '../pixie-lab/logic-workbench.mjs';
import {
  createLogicDraft as createLegacyLogicDraft,
  editLogicDraft as editLegacyLogicDraft,
  compareLogicDraft as compareLegacyLogicDraft,
} from '../pixie-lab/lab-zones.mjs';
import {
  prepareProductionHandoff as prepareCanonicalProductionHandoff,
} from '../pixie-lab/production-evidence-workbench.mjs';
import {
  prepareProductionHandoff as prepareLegacyProductionHandoff,
  prepareFactoryHandoff,
} from '../pixie-lab/production-lane.mjs';
import { PixieLab } from '../pixie-lab/service.mjs';

const now = () => '2026-09-30T01:00:00.000Z';

test('legacy Logic exports point to canonical Logic Workbench behavior', () => {
  const input = {
    draftId: 'LOGIC-MIGRATE',
    logicId: 'LOGIC-1',
    sourceRef: 'source://logic',
    content: { value: 'before' },
    now,
  };
  const canonical = createCanonicalLogicDraft(input);
  const legacy = createLegacyLogicDraft(input);

  assert.deepEqual(legacy, canonical);
  assert.equal(canonical.workbench, 'LOGIC_WORKBENCH');

  const edit = { op: 'SET', path: 'value', value: 'after' };
  const canonicalEdited = editCanonicalLogicDraft(canonical, edit, { now });
  const legacyEdited = editLegacyLogicDraft(legacy, edit, { now });
  assert.deepEqual(legacyEdited, canonicalEdited);
  assert.deepEqual(compareLegacyLogicDraft(legacyEdited), compareCanonicalLogicDraft(canonicalEdited));
});

test('legacy Production Lane export preserves canonical Production Evidence handoff', () => {
  const input = {
    handoffId: 'PROD-MIGRATE',
    experimentId: 'EXP-MIGRATE',
    variantId: 'VAR-MIGRATE',
    workId: 'WORK-MIGRATE',
    checkpointId: 'CP-MIGRATE',
    requestedResult: 'verified candidate',
    artifactRefs: ['artifact://one'],
    evidenceRefs: ['evidence://one'],
    now,
  };
  const canonical = prepareCanonicalProductionHandoff(input);
  const legacy = prepareLegacyProductionHandoff(input);

  assert.deepEqual(legacy, canonical);
  assert.equal(canonical.workbench, 'PRODUCTION_EVIDENCE_WORKBENCH');
  assert.equal(canonical.authorityTransferred, false);
  assert.equal(canonical.routeAuthorityCreated, false);
});

test('legacy Debug to Factory route remains compatibility-only and unchanged', () => {
  const blocked = prepareFactoryHandoff({
    roomId: 'ROOM-A',
    workId: 'WORK-MIGRATE',
    checkpointId: 'CP-MIGRATE',
    purpose: 'legacy proof',
    pass: {},
    now,
  });
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.reason, 'FACTORY_HANDOFF_DEBUG_ROOM_REQUIRED');
});

test('PixieLab debug lifecycle now uses canonical Debug Inspection Workbench without Room-D dependency', () => {
  const lab = new PixieLab({ now });
  const opened = lab.debug({ debugId: 'DBG-MIGRATE', bugId: 'BUG-MIGRATE' });
  assert.equal(opened.workbench, 'DEBUG_INSPECTION_WORKBENCH');
  assert.equal(opened.status, 'OPEN');

  const stepped = lab.debugStep('DBG-MIGRATE', {
    stepId: 'STEP-1',
    action: 'inspect evidence',
    evidenceRefs: ['evidence://debug'],
    confidence: 'SUPPORTED',
  });
  assert.equal(stepped.status, 'IN_PROGRESS');
  assert.equal(stepped.confidence, 'SUPPORTED');

  const completed = lab.completeDebug('DBG-MIGRATE', {
    result: 'DEBUG_COMPLETE',
    regressionRunRefs: ['run://regression'],
  });
  assert.equal(completed.status, 'COMPLETE');
  assert.equal(completed.confidence, 'CONFIRMED');
  assert.equal(completed.regressionRunRefs.includes('run://regression'), true);
});
