import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VISUAL_CREW_WORKERS, createVisualCrewTask, advanceVisualCrewTask,
  compareVisualCrewTask, attachVisualCrewCompare, verifyVisualCrewTask,
  attachVisualCrewVerification, projectVisualCrewResult,
} from '../pixie-lab/visual-crew.mjs';

test('visual crew binds work context and never allows source mutation', () => {
  const task = createVisualCrewTask({
    taskId:'CREW-1', workId:'WORK-1', checkpointId:'CP-1',
    brief:'Prepare hero image', requestedOutput:'web hero 16:9', assetRefs:['asset://source'],
  });
  assert.equal(task.workId, 'WORK-1');
  assert.equal(task.sourceMutationAllowed, false);
  assert.deepEqual(task.steps.map((step) => step.workerId), VISUAL_CREW_WORKERS.map((item) => item.workerId));
});

test('visual crew enforces worker order and builds candidate tray', () => {
  let task = createVisualCrewTask({
    taskId:'CREW-2', workId:'WORK-1', checkpointId:'CP-1',
    brief:'Prepare hero image', requestedOutput:'web hero 16:9',
  });
  assert.throws(() => advanceVisualCrewTask(task, { stepId:task.steps[1].stepId, status:'DONE' }), /STEP_ORDER_REQUIRED/);
  for (const step of task.steps) {
    task = advanceVisualCrewTask(task, {
      stepId: task.steps.find((item) => item.workerId === step.workerId).stepId,
      status:'DONE',
      resultRefs: step.workerId === 'RENDERER' ? ['artifact://v1','artifact://v2'] : [],
    });
  }
  assert.equal(task.status, 'READY_TO_COMPARE');
  assert.deepEqual(task.candidateRefs, ['artifact://v1','artifact://v2']);
});

test('compare is creative selection and verification requires evidence', () => {
  let task = createVisualCrewTask({
    taskId:'CREW-3', workId:'WORK-1', checkpointId:'CP-1',
    brief:'Prepare hero image', requestedOutput:'web hero 16:9',
    workerIds:['RENDERER','INSPECTOR'],
  });
  task = advanceVisualCrewTask(task, { stepId:task.steps[0].stepId, status:'DONE', resultRefs:['artifact://v1','artifact://v2'] });
  task = advanceVisualCrewTask(task, { stepId:task.steps[1].stepId, status:'DONE' });
  const compare = compareVisualCrewTask(task, { compareId:'CMP-1', candidateRefs:['artifact://v1','artifact://v2'], selectedCandidateRef:'artifact://v2' });
  assert.equal(compare.approval, 'NOT_AN_APPROVAL');
  task = attachVisualCrewCompare(task, compare);
  assert.throws(() => verifyVisualCrewTask(task, { verificationId:'VER-1', status:'PASS' }), /REQUIRES_EVIDENCE/);
  const verification = verifyVisualCrewTask(task, { verificationId:'VER-1', status:'PASS', evidenceRefs:['evidence://visual-check'] });
  task = attachVisualCrewVerification(task, verification);
  const result = projectVisualCrewResult(task, { compares:[compare], verifications:[verification] });
  assert.equal(result.ready, true);
  assert.equal(result.resultRef, 'artifact://v2');
});


test('PixieLab migrates pre-visual-crew durable state before accepting Hub commands', async () => {
  const { PixieLab } = await import('../pixie-lab/service.mjs');
  const seed = new PixieLab();
  const legacy = structuredClone(seed.state);
  delete legacy.visualCrewTasks;
  delete legacy.visualCrewCompares;
  delete legacy.visualCrewVerifications;
  delete legacy.livingScenes;
  delete legacy.webExportManifests;

  let saved = null;
  const persistence = {
    async load() { return structuredClone(legacy); },
    async save(value) { saved = structuredClone(value); },
  };
  const lab = new PixieLab({ persistence });
  await lab.rebuildBoard();

  const task = lab.createVisualCrew({
    taskId:'CREW-MIGRATION',
    workId:'WORK-PRISM',
    checkpointId:'CP-PRISM',
    brief:'Prepare PRISM theme asset',
    requestedOutput:'one theme candidate',
  });
  assert.equal(task.status, 'PLANNED');
  assert.deepEqual(lab.state.visualCrewCompares, []);
  assert.deepEqual(lab.state.visualCrewVerifications, []);
  assert.deepEqual(lab.state.livingScenes, []);
  assert.deepEqual(lab.state.webExportManifests, []);

  await lab.persist();
  assert.equal(saved.visualCrewTasks.length, 1);
});
