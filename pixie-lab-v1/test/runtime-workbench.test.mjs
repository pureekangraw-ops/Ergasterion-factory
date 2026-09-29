import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import { createMemoryPersistence } from '../pixie-lab/core.mjs';
import { ERGASTERION_RUNTIME_WORKBENCH_SCHEMA } from '../pixie-lab/runtime-workbench.mjs';

const now = () => '2026-09-30T02:00:00.000Z';

function seedApp(lab) {
  lab.createIdea({
    ideaId: 'IDEA-RUNTIME',
    title: 'Runtime',
    intent: 'observe real app behavior',
    requestedResult: 'home screen is visible',
    workId: 'WORK-RUNTIME',
    checkpointId: 'CP-RUNTIME',
  });
  lab.createExperiment({
    experimentId: 'EXP-RUNTIME',
    ideaId: 'IDEA-RUNTIME',
    kind: 'APP',
    goal: 'observe candidate',
    workId: 'WORK-RUNTIME',
    checkpointId: 'CP-RUNTIME',
  });
  lab.createVariant({
    variantId: 'VAR-RUNTIME',
    experimentId: 'EXP-RUNTIME',
    kind: 'APP',
    spec: { screen: 'home' },
  });
  lab.createAppPrototype({
    prototypeId: 'APP-RUNTIME',
    experimentId: 'EXP-RUNTIME',
    variantId: 'VAR-RUNTIME',
    spec: { entry: '/home' },
  });
}

test('Runtime observation cannot claim PASS without evidence', () => {
  const lab = new PixieLab({ now });
  seedApp(lab);

  const observed = lab.recordRuntimeObservation({
    observationId: 'OBS-NO-EVIDENCE',
    prototypeId: 'APP-RUNTIME',
    experimentId: 'EXP-RUNTIME',
    variantId: 'VAR-RUNTIME',
    workId: 'WORK-RUNTIME',
    checkpointId: 'CP-RUNTIME',
    targetRef: 'app://candidate',
    observedRef: 'observer://snapshot-1',
    status: 'PASS',
  });

  assert.equal(observed.schema, ERGASTERION_RUNTIME_WORKBENCH_SCHEMA);
  assert.equal(observed.status, 'UNKNOWN');
  assert.equal(observed.unknowns.includes('RUNTIME_STATUS_UNKNOWN'), true);
  assert.equal(observed.createsAuthority, false);
});

test('Runtime Workbench links observed evidence to Work and prototype', async () => {
  const lab = new PixieLab({ now });
  seedApp(lab);
  lab.recordRuntimeObservation({
    observationId: 'OBS-RUNTIME',
    prototypeId: 'APP-RUNTIME',
    experimentId: 'EXP-RUNTIME',
    variantId: 'VAR-RUNTIME',
    workId: 'WORK-RUNTIME',
    checkpointId: 'CP-RUNTIME',
    targetRef: 'app://candidate',
    observedRef: 'observer://snapshot-2',
    status: 'PASS',
    screenshotRefs: ['screenshot://1'],
    consoleRefs: ['console://1'],
    networkRefs: ['network://1'],
    logRefs: ['log://1'],
    evidenceRefs: ['evidence://runtime'],
    source: 'BROWSER_OBSERVER',
  });
  lab.recordRuntimeInteraction({
    interactionId: 'INT-RUNTIME',
    observationId: 'OBS-RUNTIME',
    workId: 'WORK-RUNTIME',
    checkpointId: 'CP-RUNTIME',
    targetRef: 'app://candidate',
    action: { type: 'CLICK', target: '#continue' },
    result: 'PASS',
    evidenceRefs: ['evidence://click'],
    source: 'LIGHTHOUSE_CONTROL_PORT',
  });

  const view = await lab.runtimeView({
    workId: 'WORK-RUNTIME',
    checkpointId: 'CP-RUNTIME',
    prototypeId: 'APP-RUNTIME',
  });

  assert.equal(view.status, 'HOST_DEPENDENT');
  assert.equal(view.latestObservation.observationId, 'OBS-RUNTIME');
  assert.equal(view.latestObservation.status, 'PASS');
  assert.deepEqual(view.evidence.screenshotRefs, ['screenshot://1']);
  assert.equal(view.interactions[0].interactionId, 'INT-RUNTIME');
  assert.equal(view.directExecution, false);

  const reality = lab.realityScreen({ workId: 'WORK-RUNTIME' });
  assert.equal(reality.observed.latestRuntimeObservation.observationId, 'OBS-RUNTIME');
  assert.equal(reality.observed.latestRuntimeInteraction.interactionId, 'INT-RUNTIME');

  const big = lab.bigView({ workId: 'WORK-RUNTIME', experimentId: 'EXP-RUNTIME', variantId: 'VAR-RUNTIME' });
  assert.equal(big.proof.latestRuntimeObservation.observationId, 'OBS-RUNTIME');
  assert.equal(big.intentReview.coverage.runtime.status, 'OBSERVED');
  assert.equal(big.intentReview.lacking.items.includes('RUNTIME_PROOF_MISSING'), false);
});

test('Runtime direct interaction stays unavailable when no host executor is injected', async () => {
  const lab = new PixieLab({ now });
  const status = await lab.runtimeStatus();
  const action = await lab.runtimeAction({ type: 'CLICK', target: '#x' });

  assert.equal(status.status, 'UNAVAILABLE');
  assert.equal(status.reason, 'RUNTIME_EXECUTOR_UNAVAILABLE');
  assert.equal(action.status, 'UNAVAILABLE');
  assert.equal(action.reason, 'RUNTIME_INTERACTION_EXECUTOR_UNAVAILABLE');
});

test('Runtime action with injected executor is an external effect and does not persist Lab state', async () => {
  let saves = 0;
  const persistence = {
    ...createMemoryPersistence(),
    async save(value) { saves += 1; return value; },
  };
  const runtimeExecutor = {
    async status() { return { available: true, target: 'browser://test' }; },
    async interact(action) { return { ok: true, status: 'PASS', action, evidenceRefs: ['evidence://host'] }; },
  };
  const pixie = createPixieCommander({ persistence, runtimeExecutor, now });

  const status = await pixie.execute({ command: 'runtime_status' });
  const action = await pixie.execute({
    command: 'runtime_action',
    args: { action: { type: 'CLICK', target: '#continue' } },
  });

  assert.equal(status.result.status, 'ACTIVE');
  assert.equal(action.mutated, true);
  assert.equal(action.externalEffect, true);
  assert.equal(action.result.status, 'PASS');
  assert.equal(saves, 0);
});

test('Runtime record commands persist evidence bridge state across reload', async () => {
  const persistence = createMemoryPersistence();
  const pixie = createPixieCommander({ persistence, now });

  await pixie.execute({
    command: 'runtime_record',
    args: {
      observationId: 'OBS-PERSIST',
      targetRef: 'app://persist',
      observedRef: 'observer://persist',
      status: 'UNKNOWN',
      workId: 'WORK-PERSIST',
      checkpointId: 'CP-PERSIST',
      source: 'BROWSER_OBSERVER',
    },
  });
  await pixie.execute({
    command: 'runtime_interaction_record',
    args: {
      interactionId: 'INT-PERSIST',
      observationId: 'OBS-PERSIST',
      targetRef: 'app://persist',
      action: { type: 'SCROLL' },
      result: 'UNKNOWN',
      workId: 'WORK-PERSIST',
      checkpointId: 'CP-PERSIST',
      source: 'LIGHTHOUSE_CONTROL_PORT',
    },
  });

  const view = await pixie.execute({
    command: 'runtime_view',
    args: { selector: { workId: 'WORK-PERSIST', checkpointId: 'CP-PERSIST' } },
  });

  assert.equal(view.ok, true);
  assert.equal(view.mutated, false);
  assert.equal(view.result.latestObservation.observationId, 'OBS-PERSIST');
  assert.equal(view.result.interactions[0].interactionId, 'INT-PERSIST');
});
