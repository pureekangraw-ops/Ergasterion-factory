import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCycle, applyCycleAction, createSterilizationAdapter, runSterilization,
  createEvidenceTrustProvider, createVerifiedEvidence, createArtifact, verifyDoorGuard, createTestMatrix, updateMatrixStatus,
  createTestRun, rerunTestRun, startMatrix, createTestType, createTestTypeRegistry, executeTestType,
  createGoldenCase, replayGoldenCase, createCandidatePassport, createRoomReport,
  createMasterSelfTest, evaluateMasterGate, detectContradictions, createMemoryPersistence,
  assertNoExternalAuthority,
} from '../pixie-lab/core.mjs';
import { PixieLab } from '../pixie-lab/service.mjs';

const now = () => '2026-09-25T00:00:00.000Z';
const trust = createEvidenceTrustProvider({
  providerId: 'FAILURE-TEST',
  sign: (payload) => `failure-test:${JSON.stringify(payload)}`,
  verify: (payload, proofValue) => proofValue === `failure-test:${JSON.stringify(payload)}`,
});
const verified = (input) => createVerifiedEvidence(input, { trustProvider: trust });
const baseCycle = () => createCycle({ cycleId: 'C', subjectRef: 'S', roomId: 'ROOM-A', sessionId: 'SESSION-A', logicVersion: '1.0.0', now });
const pass = (action, result) => ({ action, result, evidenceStatus: 'PASS', evidenceRefs: [`E-${action}`], evidence: [verified({ evidenceId: `E-${action}`, kind: 'cycle-proof', status: 'PASS', sourceRef: `fixture://E-${action}` })], now });

test('lifecycle cannot skip ZERO or STERILIZE and proof is mandatory', () => {
  assert.throws(() => applyCycleAction(baseCycle(), { action: 'TEST', result: 'TEST_PASS', now }), /LIFECYCLE_ORDER_REQUIRED/);
  assert.throws(() => applyCycleAction(baseCycle(), { action: 'ZERO', result: 'ZERO_CONFIRMED', now }), /ZERO_REQUIRES_PASS_EVIDENCE/);
  assert.throws(() => applyCycleAction(baseCycle(), { action: 'ZERO', result: 'ZERO_CONFIRMED', evidenceStatus: 'PASS', evidence: [{ status: 'PASS' }], now }), /ZERO_REQUIRES_PASS_EVIDENCE/);
  let cycle = applyCycleAction(baseCycle(), pass('ZERO', 'ZERO_CONFIRMED'));
  assert.throws(() => applyCycleAction(cycle, { action: 'TEST', result: 'TEST_PASS', now }), /LIFECYCLE_ORDER_REQUIRED/);
  assert.throws(() => applyCycleAction(cycle, { action: 'STERILIZE', result: 'STERILE', evidenceStatus: 'UNKNOWN', now }), /STERILIZE_REQUIRES_PASS_EVIDENCE/);
});

test('cleanup adapter produces PASS, FAIL, or UNKNOWN and never fakes sterile', () => {
  assert.deepEqual(runSterilization({ adapter: null, now }), { status: 'UNKNOWN', evidenceStatus: 'UNKNOWN', evidenceRefs: [], reason: 'STERILIZATION_ADAPTER_UNAVAILABLE', at: now() });
  const failAdapter = createSterilizationAdapter({ adapterId: 'A', name: 'fail', sterilize: () => ({ status: 'CONTAMINATED', evidenceStatus: 'FAIL' }) });
  assert.equal(runSterilization({ adapter: failAdapter, now }).evidenceStatus, 'FAIL');
  const evidence = verified({ evidenceId: 'STERILE-E', kind: 'wipe-log', status: 'PASS', sourceRef: 'fixture://wipe' });
  const passAdapter = createSterilizationAdapter({ adapterId: 'B', name: 'pass', sterilize: () => ({ status: 'STERILE', evidence: [evidence] }) });
  assert.equal(runSterilization({ adapter: passAdapter, now }).evidenceStatus, 'PASS');
});

test('Door Guard requires exact artifactId, logicId, version, and target', () => {
  const artifact = createArtifact({ artifactId: 'A-1', logicId: 'L-1', version: '1.0.0', target: 'LAB', now });
  assert.equal(verifyDoorGuard({ artifact, ownerSeal: { status: 'OFFICIAL', artifactId: 'A-2', logicId: 'L-1', version: '1.0.0', target: 'LAB' } }).status, 'STOP');
  assert.equal(verifyDoorGuard({ artifact, ownerSeal: { status: 'OFFICIAL', artifactId: 'A-1', logicId: 'L-1', version: '1.0.0', target: 'LAB' } }).status, 'ALLOW_EXIT');
});

test('required matrix rows remain non-pass when unrun, unknown, or failed', () => {
  const matrix = createTestMatrix({ matrixId: 'M', subjectRef: 'S', logicVersion: '1', rows: [{ testTypeId: 'functional', caseRefs: [] }, { testTypeId: 'golden', caseRefs: [] }] });
  assert.equal(matrix.lifecycle, 'READY_TO_RUN');
  assert.equal(startMatrix(matrix).lifecycle, 'RUNNING');
  assert.notEqual(updateMatrixStatus(matrix, { functional: 'PASS' }).overallStatus, 'PASS');
  assert.notEqual(updateMatrixStatus(matrix, { functional: 'PASS', golden: 'UNKNOWN' }).overallStatus, 'PASS');
  assert.notEqual(updateMatrixStatus(matrix, { functional: 'PASS', golden: 'FAIL' }).overallStatus, 'PASS');
  assert.equal(updateMatrixStatus(matrix, { functional: 'PASS', golden: 'PASS' }).overallStatus, 'TEST_PASS');
  assert.equal(updateMatrixStatus(matrix, { functional: 'PASS', golden: 'PASS' }).lifecycle, 'READY_CANDIDATE');
});

test('TestRun is immutable and rerun creates a new run', () => {
  const run = createTestRun({ runId: 'R-1', initiatedBy: 'PIXIE-A', executedBy: 'PIXIE-A', scope: 'ROOM', purpose: 'CHECK', logicVersion: '1', status: 'FAIL', now });
  assert.equal(Object.isFrozen(run), true);
  assert.throws(() => { run.status = 'PASS'; }, TypeError);
  const rerun = rerunTestRun(run, { runId: 'R-2', status: 'PASS', now });
  assert.equal(rerun.runId, 'R-2');
  assert.equal(rerun.rerunOf, 'R-1');
  assert.equal(run.status, 'FAIL');
});

test('unsupported runner returns UNKNOWN instead of fake PASS', async () => {
  const registry = createTestTypeRegistry({ testTypes: [createTestType({ testTypeId: 'chaos', name: 'Chaos', category: 'CHAOS', runner: 'runner://chaos', expectedContract: 'expected://chaos', evidencePolicy: 'trace' })] });
  assert.deepEqual(await executeTestType(registry, 'chaos', {}), { status: 'UNKNOWN', reason: 'UNSUPPORTED_RUNNER', testTypeId: 'chaos' });
});

test('golden replay marks regression alert on mismatch', () => {
  const golden = createGoldenCase({ goldenCaseId: 'G-1', sourceBugId: 'B-1', sourceRunId: 'R-1', inputRef: 'FIX-1', expected: { ok: true }, fixedObserved: { ok: true }, replayRecipe: 'replay://g', now });
  const replay = replayGoldenCase(golden, { runId: 'R-2', logicVersion: '2', observed: { ok: false }, now });
  assert.equal(replay.status, 'REGRESSION_CASE');
  assert.deepEqual(replay.lifecycle, ['GOLDEN_CANDIDATE', 'VERIFY_REPLAY', 'REGRESSION_CASE']);
  assert.equal(replay.replayCount, 1);
});

test('candidate passport is a projection and never an approval', () => {
  const passport = createCandidatePassport({ passportId: 'P-1', artifactId: 'A-1', matrixRef: 'M-1', sourceRunRefs: ['R-1'], evidenceRefs: ['E-1'], matrixStatus: 'TEST_PASS', now });
  assert.equal(passport.projectionOnly, true);
  assert.equal(passport.approval, 'NOT_AN_APPROVAL');
  assert.equal(passport.matrixRef, 'M-1');
  assert.deepEqual(passport.sourceRunRefs, ['R-1']);
  assert.deepEqual(passport.evidenceRefs, ['E-1']);
  assert.equal('approved' in passport, false);
});

test('persistence rebuilds Board from canonical Lab truth', async () => {
  const storage = createMemoryPersistence();
  const first = new PixieLab({ persistence: storage, now });
  first.addRoomReport({ roomId: 'ROOM-A', roomPixieId: 'PIXIE-A', roomStatus: 'RUNNING', activeSubject: 'S', unknowns: ['critical-permission'] });
  await first.persist();
  const rebuilt = new PixieLab({ persistence: storage, now });
  const board = await rebuilt.rebuildBoard();
  assert.equal(board.projectionOnly, true);
  assert.deepEqual(board.unknowns, ['critical-permission']);
});

test('PIXIE-01 blocks critical unknowns and contradictions', () => {
  const selfTest = createMasterSelfTest({ selfTestId: 'SELF-1', checks: [{ checkId: 'scope', status: 'PASS' }, { checkId: 'evidence', status: 'UNKNOWN' }], now });
  const reports = [
    createRoomReport({ roomId: 'ROOM-A', roomPixieId: 'PIXIE-A', roomStatus: 'RUNNING', activeSubject: 'S', latestResult: 'PASS', now }),
    createRoomReport({ roomId: 'ROOM-B', roomPixieId: 'PIXIE-B', roomStatus: 'RUNNING', activeSubject: 'S', latestResult: 'FAIL', now }),
  ];
  const contradictions = detectContradictions(reports);
  assert.equal(contradictions.length, 1);
  assert.equal(evaluateMasterGate({ selfTest, contradictions }).status, 'FAIL');
  assert.equal(evaluateMasterGate({ selfTest: createMasterSelfTest({ selfTestId: 'SELF-2', checks: [{ checkId: 'scope', status: 'PASS' }], now }), criticalUnknowns: ['critical'] }).status, 'UNKNOWN');
});

test('debug flow reaches regression and golden references', () => {
  const lab = new PixieLab({ now });
  assert.equal(lab.debug({ debugId: 'D-1', bugId: 'B-1' }).confidence, 'SUSPECTED');
  lab.debugStep('D-1', { stepId: 'S-1', action: 'REPRODUCE', confidence: 'SUPPORTED', regressionRunId: 'R-2' });
  lab.debugStep('D-1', { stepId: 'S-2', action: 'REPLAY_GOLDEN', goldenCaseId: 'G-1' });
  const done = lab.completeDebug('D-1', { regressionRunRefs: ['R-2'], goldenCaseRefs: ['G-1'] });
  assert.equal(done.status, 'COMPLETE');
  assert.equal(done.confidence, 'CONFIRMED');
  assert.deepEqual(done.regressionRunRefs, ['R-2']);
  assert.deepEqual(done.goldenCaseRefs, ['G-1']);
});

test('external authority is explicitly rejected while board remains projection-only', () => {
  assert.throws(() => assertNoExternalAuthority({ deploy: true }), /EXTERNAL_AUTHORITY_FORBIDDEN/);
  const lab = new PixieLab({ now });
  const board = lab.board();
  assert.equal(board.projectionOnly, true);
  assert.equal('merge' in lab, false);
  assert.equal('deploy' in lab, false);
});
