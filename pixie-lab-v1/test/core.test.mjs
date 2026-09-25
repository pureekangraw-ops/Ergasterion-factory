import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIXIE_ID, createDefaultRooms, createIsolationContext, createCycle, applyCycleAction,
  createTestType, createTestMatrix, updateMatrixStatus, createTestRun,
  createTestProposal, decideTestProposal, createBugCapsule, createGoAttention,
  updateGoAttention, createGoldenCase, createLabMemoryAsset, createArtifact,
  verifyDoorGuard, createRoomReport, projectPixieBoard, createEvidenceTrustProvider, createVerifiedEvidence, replayGoldenCase,
} from '../pixie-lab/core.mjs';

const fixedNow = () => '2026-09-25T00:00:00.000Z';
const trust = createEvidenceTrustProvider({
  providerId: 'CORE-TEST',
  sign: (payload) => `core-test:${JSON.stringify(payload)}`,
  verify: (payload, proofValue) => proofValue === `core-test:${JSON.stringify(payload)}`,
});
const proof = (id) => createVerifiedEvidence(
  { evidenceId: id, kind: 'fixture-proof', status: 'PASS', sourceRef: `fixture://${id}` },
  { trustProvider: trust },
);

test('Pixie Lab has one board and no mode field', () => {
  const rooms = createDefaultRooms({ now: fixedNow });
  const board = projectPixieBoard({ rooms, now: fixedNow });
  assert.equal(PIXIE_ID, 'PIXIE-01');
  assert.equal(board.boardId, 'PIXIE-BOARD');
  assert.equal(board.projectionOnly, true);
  assert.equal('mode' in board, false);
  assert.deepEqual(rooms.map((room) => room.roomPixieId), ['PIXIE-A', 'PIXIE-B', 'PIXIE-C']);
});

test('cycle records ZERO and STERILIZE before testing', () => {
  const isolation = createIsolationContext({
    appId: 'APP-1', roomId: 'ROOM-A', sessionId: 'SESSION-1', cycleId: 'CYCLE-1',
    fixtureRef: 'FIXTURE-1', baselineHash: 'sha256:base',
  });
  let cycle = createCycle({
    cycleId: 'CYCLE-1', subjectRef: 'FEATURE-1', roomId: 'ROOM-A',
    sessionId: 'SESSION-1', logicVersion: '1.0.0', isolation, now: fixedNow,
  });
  cycle = applyCycleAction(cycle, { action: 'ZERO', result: 'ZERO_CONFIRMED', evidenceStatus: 'PASS', evidenceRefs: ['ZERO-EVIDENCE'], evidence: [proof('ZERO-EVIDENCE')], now: fixedNow });
  assert.equal(cycle.nextAction, 'STERILIZE');
  cycle = applyCycleAction(cycle, { action: 'STERILIZE', result: 'STERILE', evidenceStatus: 'PASS', evidenceRefs: ['STERILE-EVIDENCE'], evidence: [proof('STERILE-EVIDENCE')], now: fixedNow });
  assert.equal(cycle.nextAction, 'TEST');
  assert.equal(cycle.state, 'STERILE');
});

test('contamination quarantines the cycle and clean again returns to ZERO', () => {
  let cycle = createCycle({
    cycleId: 'CYCLE-2', subjectRef: 'FEATURE-2', roomId: 'ROOM-B',
    sessionId: 'SESSION-2', logicVersion: '1.0.0', now: fixedNow,
  });
  cycle = applyCycleAction(cycle, { action: 'ZERO', result: 'ZERO_CONFIRMED', evidenceStatus: 'PASS', evidenceRefs: ['ZERO-EVIDENCE'], evidence: [proof('ZERO-EVIDENCE')], now: fixedNow });
  cycle = applyCycleAction(cycle, { action: 'STERILIZE', result: 'CONTAMINATED', now: fixedNow });
  assert.equal(cycle.state, 'QUARANTINED');
  cycle = applyCycleAction(cycle, { action: 'CLEAN_AGAIN', result: 'ZERO_CONFIRMED', now: fixedNow });
  assert.equal(cycle.stage, 'ZERO');
  cycle = applyCycleAction(cycle, { action: 'ZERO', result: 'ZERO_CONFIRMED', evidenceStatus: 'PASS', evidenceRefs: ['ZERO-EVIDENCE'], evidence: [proof('ZERO-EVIDENCE')], now: fixedNow });
  assert.equal(cycle.stage, 'STERILIZE');
});

test('CANNON is a TestRun class, not a second engine', () => {
  const matrix = createTestMatrix({
    matrixId: 'MATRIX-1', subjectRef: 'ART-1', logicVersion: '1.2.0',
    rows: [{ testTypeId: 'REGRESSION', caseRefs: ['GOLDEN-1'] }], now: fixedNow,
  });
  const run = createTestRun({
    runId: 'MASTER-RUN-1', runClass: 'CANNON', initiatedBy: 'PIXIE-01',
    executedBy: 'PIXIE-01', scope: 'CROSS_ROOM', purpose: 'FINAL_HEAVY_VERIFICATION',
    matrixRef: matrix.matrixId, logicVersion: '1.2.0', status: 'CANNON_PASS', now: fixedNow,
  });
  assert.equal(run.runClass, 'CANNON');
  assert.equal(run.matrixRef, 'MATRIX-1');
  assert.equal(run.executedBy, 'PIXIE-01');
});

test('Room Pixies can propose and PIXIE-01 can expand a proposal', () => {
  let proposal = createTestProposal({
    proposalId: 'PROPOSAL-1', proposedBy: 'PIXIE-A', purpose: 'REPLAY_GOLDEN',
    testTypeId: 'REGRESSION_GOLDEN', sourceRoomRefs: ['ROOM-A'],
    targetRefs: ['ROOM-C'], reason: 'Suspicious state pattern', now: fixedNow,
  });
  proposal = decideTestProposal(proposal, { decision: 'EXPANDED_TO_LAB_WIDE', now: fixedNow });
  assert.equal(proposal.status, 'EXPANDED_TO_LAB_WIDE');
  assert.equal(proposal.decidedBy, 'PIXIE-01');
});

test('Bug closes through retest and becomes a Golden Case asset', () => {
  const bug = createBugCapsule({
    bugId: 'BUG-1', runId: 'RUN-1', roomId: 'ROOM-A', logicVersion: '1.0.0',
    fixtureRef: 'FIXTURE-1', expected: { state: 'CLOSED' }, observed: { state: 'OPEN' },
    evidenceRefs: ['EVIDENCE-1'], now: fixedNow,
  });
  let attention = createGoAttention({
    attentionId: 'ATTENTION-1', bugId: bug.bugId, roomId: bug.roomId,
    reason: 'INVALID_TRANSITION', evidenceRefs: bug.evidenceRefs, now: fixedNow,
  });
  attention = updateGoAttention(attention, { status: 'RETEST', now: fixedNow });
  attention = updateGoAttention(attention, { status: 'CLOSED', evidenceRefs: ['RETEST-1'], now: fixedNow });
  const golden = createGoldenCase({
    goldenCaseId: 'GOLDEN-1', sourceBugId: bug.bugId, sourceRunId: bug.runId,
    inputRef: 'FIXTURE-1', expected: bug.expected, fixedObserved: bug.expected,
    replayRecipe: 'replay://invalid-transition', evidenceRefs: ['RETEST-1'], now: fixedNow,
  });
  assert.equal(attention.status, 'CLOSED');
  assert.equal(golden.status, 'GOLDEN_CANDIDATE');
  const verifiedGolden = replayGoldenCase(golden, { runId: 'RUN-2', logicVersion: '1.0.0', observed: bug.expected, now: fixedNow });
  assert.equal(verifiedGolden.status, 'GOLDEN_ACTIVE');
  assert.deepEqual(verifiedGolden.lifecycle, ['GOLDEN_CANDIDATE', 'VERIFY_REPLAY', 'GOLDEN_ACTIVE']);
});

test('Door Guard stops until exact Owner Seal exists', () => {
  const artifact = createArtifact({
    artifactId: 'ART-1', logicId: 'stale-detector', version: '1.0.0', target: 'GO-HUB-BOARD',
    status: 'EXPERIMENTAL', now: fixedNow,
  });
  assert.deepEqual(verifyDoorGuard({ artifact }), { status: 'STOP', reason: 'OWNER_SEAL_MISSING' });
  assert.equal(verifyDoorGuard({ artifact, ownerSeal: { status: 'OFFICIAL', artifactId: 'ART-1', logicId: 'stale-detector', version: '2.0.0', target: 'GO-HUB-BOARD' } }).status, 'STOP');
  assert.equal(verifyDoorGuard({ artifact, ownerSeal: { status: 'OFFICIAL', artifactId: 'ART-1', logicId: 'stale-detector', version: '1.0.0', target: 'GO-HUB-BOARD' } }).status, 'ALLOW_EXIT');
});

test('Room report and board projection preserve traceable summaries', () => {
  const report = createRoomReport({
    roomId: 'ROOM-A', roomPixieId: 'PIXIE-A', roomStatus: 'RUNNING',
    activeSubject: 'FEATURE-1', currentTest: 'REGRESSION', latestResult: 'TEST_PASS',
    unknowns: ['permission-boundary'], readyCandidates: ['ART-1'], nextAction: 'CANNON',
  });
  const memory = createLabMemoryAsset({
    memoryId: 'MEM-1', assetType: 'FAILURE_PATTERN', sourceCycleId: 'CYCLE-1',
    sourceRunRefs: ['RUN-1'], evidenceRefs: ['EVIDENCE-1'], content: { pattern: 'stale' }, now: fixedNow,
  });
  const board = projectPixieBoard({ roomReports: [report], unknowns: report.unknowns, artifacts: [memory], now: fixedNow });
  assert.equal(board.roomReports[0].roomPixieId, 'PIXIE-A');
  assert.deepEqual(board.unknowns, ['permission-boundary']);
  assert.equal(board.projectionOnly, true);
});

test('Test Type Registry supports all planned categories without requiring every runner in V1', async () => {
  const { TEST_CATEGORIES, createTestTypeRegistry, registerTestType, createTestType } = await import('../pixie-lab/core.mjs');
  const registry = createTestTypeRegistry();
  for (const category of TEST_CATEGORIES) {
    registerTestType(registry, createTestType({
      testTypeId: `TYPE-${category}`, name: category, category,
      runner: `runner://${category.toLowerCase()}`,
      expectedContract: 'expected://result', evidencePolicy: 'trace',
    }));
  }
  assert.equal(registry.size, TEST_CATEGORIES.length);
});

test('External grants are room/session bound and never become WRITE', async () => {
  const { createAccessGrant, validateAccessGrant, importSnapshot } = await import('../pixie-lab/core.mjs');
  const grant = createAccessGrant({
    grantId: 'GRANT-1', source: 'GO_HUB_MEETING_BOARD', scope: ['SNAPSHOT'],
    access: 'SNAPSHOT', roomId: 'ROOM-A', sessionId: 'SESSION-1',
    expiresAt: '2099-01-01T00:00:00.000Z', issuedBy: 'GO_HUB', now: fixedNow,
  });
  assert.equal(validateAccessGrant(grant, { roomId: 'ROOM-A', sessionId: 'SESSION-1', requiredScope: ['SNAPSHOT'], at: fixedNow() }).allowed, true);
  assert.equal(validateAccessGrant(grant, { roomId: 'ROOM-B', sessionId: 'SESSION-1', requiredScope: ['SNAPSHOT'], at: fixedNow() }).reason, 'GRANT_ROOM_MISMATCH');
  const snapshot = importSnapshot({
    snapshotId: 'SNAPSHOT-1', source: grant.source, sourceRevision: 'rev-1',
    contentHash: 'sha256:fixture', data: { message: 'copy' }, grant,
    roomId: 'ROOM-A', sessionId: 'SESSION-1', now: fixedNow,
  });
  assert.equal(snapshot.ownership, 'LAB_OWNED_SNAPSHOT');
});

test('CANNON is a profile over existing categories and Factory is simulation-only', async () => {
  const { createCannonProfile, createCannonRun, createFactorySimulation, advanceFactorySimulation } = await import('../pixie-lab/core.mjs');
  const profile = createCannonProfile({
    profileId: 'CANNON-1', matrixRef: 'MATRIX-1',
    requiredCategories: ['REGRESSION', 'GOLDEN', 'RECOVERY'], caseRefs: ['GOLDEN-1'],
  });
  const run = createCannonRun({ runId: 'CANNON-RUN-1', profile, logicVersion: '1.0.0', now: fixedNow });
  assert.equal(run.runClass, 'CANNON');
  const simulation = createFactorySimulation({ simulationId: 'SIM-1', artifactRef: 'ART-1', roomId: 'ROOM-A', sessionId: 'SESSION-1', now: fixedNow });
  const output = advanceFactorySimulation(simulation, { stage: 'BUILD', result: 'SIMULATED', outputRef: 'CANDIDATE-1', now: fixedNow });
  assert.equal(output.status, 'SIMULATION_ONLY');
  assert.equal(output.stage, 'BUILD');
});

test('Learning promotes only through PIXIE-01 and can feed Lab memory', async () => {
  const { createLearningProposal, promoteLearningProposal } = await import('../pixie-lab/core.mjs');
  const proposal = createLearningProposal({
    proposalId: 'LEARN-1', proposedBy: 'PIXIE-A', assetType: 'TEST_TYPE_PROPOSAL',
    sourceCycleId: 'CYCLE-1', sourceRunRefs: ['RUN-1'], evidenceRefs: ['EVIDENCE-1'],
    content: { addBoundaryCheck: true }, now: fixedNow,
  });
  const active = promoteLearningProposal(proposal, { now: fixedNow });
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.promotedBy, 'PIXIE-01');
});

test('Internal Warp stays inside Pixie Lab and Guide answers preserve trace refs', async () => {
  const { createWarp, createGuideAnswer, assertNoModes } = await import('../pixie-lab/core.mjs');
  const warp = createWarp({ from: 'PIXIE BOARD', targetType: 'ROOM_REPORT', targetId: 'ROOM-A', traceRefs: ['REPORT-A'], now: fixedNow });
  assert.equal(warp.targetId, 'ROOM-A');
  assert.throws(() => createWarp({ from: 'PIXIE BOARD', targetType: 'ROOM', targetId: 'https://example.com' }), /External warp/);
  const answer = createGuideAnswer({ question: 'What is running?', answer: 'Regression in ROOM-A', traceRefs: ['REPORT-A', 'RUN-1'], now: fixedNow });
  assert.deepEqual(answer.traceRefs, ['REPORT-A', 'RUN-1']);
  assert.equal(assertNoModes({ board: { testType: 'REGRESSION' }, activityType: 'CHECK' }), true);
  assert.throws(() => assertNoModes({ mode: 'TESTING' }), /MODE_FIELD_FORBIDDEN/);
});

test('PixieLab service completes the local core cycle without modes', async () => {
  const { PixieLab } = await import('../pixie-lab/service.mjs');
  const lab = new PixieLab({ now: fixedNow });
  lab.startSession({ roomId: 'ROOM-A', sessionId: 'SESSION-A', purpose: 'FEATURE_TEST', activityType: 'FEATURE_CHECK' });
  lab.startCycle({ cycleId: 'CYCLE-A', subjectRef: 'FEATURE-A', roomId: 'ROOM-A', sessionId: 'SESSION-A', logicVersion: '1.0.0', fixtureRef: 'FIXTURE-A', baselineHash: 'sha256:a' });
  lab.cycleAction('CYCLE-A', { action: 'ZERO', result: 'ZERO_CONFIRMED', evidenceStatus: 'PASS', evidenceRefs: ['ZERO-A'], evidence: [proof('ZERO-A')] });
  lab.cycleAction('CYCLE-A', { action: 'STERILIZE', result: 'STERILE', evidenceStatus: 'PASS', evidenceRefs: ['STERILE-A'], evidence: [proof('STERILE-A')] });
  lab.cycleAction('CYCLE-A', { action: 'TEST', result: 'TEST_PASS' });
  const matrix = lab.addMatrix({ matrixId: 'MATRIX-A', subjectRef: 'FEATURE-A', logicVersion: '1.0.0', rows: [{ testTypeId: 'regression', caseRefs: ['GOLDEN-A'] }] });
  lab.updateMatrix(matrix.matrixId, { regression: 'TEST_PASS' });
  const profile = (await import('../pixie-lab/core.mjs')).createCannonProfile({ profileId: 'CANNON-A', matrixRef: matrix.matrixId, requiredCategories: ['REGRESSION', 'GOLDEN'] });
  lab.runCannon({ profile, runId: 'CANNON-A', logicVersion: '1.0.0', sourceRoomRefs: ['ROOM-A'], status: 'CANNON_PASS' });
  lab.cycleAction('CYCLE-A', { action: 'CANNON', result: 'CANNON_PASS' });
  lab.cycleAction('CYCLE-A', { action: 'LEARN', result: 'LEARNED' });
  assert.equal(lab.cycle('CYCLE-A').state, 'COMPLETE');
  assert.equal('mode' in lab.board(), false);
  assert.equal(lab.board().testRuns.length, 1);
});

test('PixieLab supports Room Report, Master Proposal, Guide, Warp and Factory simulation', async () => {
  const { PixieLab } = await import('../pixie-lab/service.mjs');
  const lab = new PixieLab({ now: fixedNow });
  lab.addRoomReport({ roomId: 'ROOM-A', roomPixieId: 'PIXIE-A', roomStatus: 'RUNNING', activeSubject: 'FEATURE-A', currentTest: 'REGRESSION', latestResult: 'TEST_PASS', unknowns: ['permission'], nextAction: 'CANNON' });
  const proposal = lab.proposeTest({ proposalId: 'P-1', proposedBy: 'PIXIE-A', purpose: 'REPLAY_GOLDEN', testTypeId: 'golden', targetRefs: ['ROOM-C'], reason: 'Suspicious pattern' });
  lab.decideProposal(proposal.proposalId, 'EXPANDED_TO_LAB_WIDE');
  lab.addFactorySimulation({ simulationId: 'SIM-1', artifactRef: 'ART-1', roomId: 'ROOM-A', sessionId: 'SESSION-A' });
  lab.advanceFactorySimulation('SIM-1', { stage: 'BUILD', result: 'SIMULATED' });
  const answer = lab.guide('อะไรยัง UNKNOWN');
  assert.equal(answer.unknowns[0], 'permission');
  assert.equal(lab.warp({ from: 'PIXIE BOARD', targetType: 'ROOM_REPORT', targetId: 'ROOM-A' }).targetId, 'ROOM-A');
  assert.equal(lab.board().proposals[0].status, 'EXPANDED_TO_LAB_WIDE');
  assert.equal(lab.state.factorySimulations[0].status, 'SIMULATION_ONLY');
});
