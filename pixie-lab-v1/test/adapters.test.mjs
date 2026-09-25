import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createCycle, applyCycleAction, createTestType, createTestTypeRegistry,
  createVerifiedEvidence, createEvidenceVerifier, isVerifiedEvidenceRecord, verifyEvidenceRecord,
} from '../pixie-lab/core.mjs';
import {
  createJsonFilePersistence, createEvidenceStore, createEvidenceBackedSterilizer,
  createRunnerHost, createReplayQueue, createHmacEvidenceTrustProvider,
} from '../pixie-lab/adapters.mjs';
import { PixieLab } from '../pixie-lab/service.mjs';

const now = () => '2026-09-25T00:00:00.000Z';
const TRUST_KEY = 'pixie-test-evidence-key-v1';
const trust = () => createHmacEvidenceTrustProvider({ key: TRUST_KEY, providerId: 'PIXIE-TEST' });
const proof = (id, provider = trust()) => createVerifiedEvidence(
  { evidenceId: id, kind: 'room-proof', status: 'PASS', sourceRef: `fixture://${id}` },
  { trustProvider: provider },
);

test('closeSession enters ARCHIVE and requires the full clean-room lifecycle', () => {
  const provider = trust();
  const lab = new PixieLab({ now, evidenceVerifier: createEvidenceVerifier(provider) });
  lab.startSession({ roomId: 'ROOM-A', sessionId: 'S-1', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-1');
  assert.equal(lab.room('ROOM-A').status, 'ARCHIVE');
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'ZERO', evidence: [proof('ZERO', provider)] });
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'STERILIZE', evidence: [proof('STERILE', provider)] });
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'VERIFY_CLEAN', evidence: [proof('VERIFY', provider)] });
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'LOAD_CLEAN_SEED', seedRef: 'seed://clean', evidence: [proof('SEED', provider)] });
  assert.equal(lab.advanceRoomLifecycle('ROOM-A', { stage: 'READY', evidence: [proof('READY', provider)] }).status, 'READY');
});

test('room lifecycle fail or unknown quarantines without a CLEAN shortcut', () => {
  const lab = new PixieLab({ now, evidenceVerifier: trust() });
  lab.startSession({ roomId: 'ROOM-B', sessionId: 'S-2', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-2');
  const room = lab.advanceRoomLifecycle('ROOM-B', { stage: 'ZERO', result: 'UNKNOWN', evidence: [] });
  assert.equal(room.status, 'QUARANTINED');
  assert.equal(room.lifecycleStage, 'QUARANTINED');
});

test('quarantined room recovers through CLEAN_AGAIN before returning READY', () => {
  const provider = trust();
  const lab = new PixieLab({ now, evidenceVerifier: createEvidenceVerifier(provider) });
  lab.startSession({ roomId: 'ROOM-C', sessionId: 'S-3', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-3');
  assert.equal(lab.advanceRoomLifecycle('ROOM-C', { stage: 'ZERO', result: 'FAIL', evidence: [] }).status, 'QUARANTINED');
  assert.equal(lab.advanceRoomLifecycle('ROOM-C', { stage: 'CLEAN_AGAIN', evidence: [proof('CLEAN-AGAIN', provider)] }).lifecycleStage, 'CLEAN_AGAIN');
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'ZERO', evidence: [proof('ZERO-2', provider)] });
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'STERILIZE', evidence: [proof('STERILE-2', provider)] });
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'VERIFY_CLEAN', evidence: [proof('VERIFY-2', provider)] });
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'LOAD_CLEAN_SEED', seedRef: 'seed://clean-2', evidence: [proof('SEED-2', provider)] });
  const ready = lab.advanceRoomLifecycle('ROOM-C', { stage: 'READY', evidence: [proof('READY-2', provider)] });
  assert.equal(ready.status, 'READY');
  assert.deepEqual(ready.lifecycleHistory.slice(-7), ['QUARANTINED', 'CLEAN_AGAIN', 'ZERO', 'STERILIZE', 'VERIFY_CLEAN', 'LOAD_CLEAN_SEED', 'READY']);
});

test('service Candidate Passport carries actual run lineage, matrix status, and evidence refs', () => {
  const lab = new PixieLab({ now });
  const matrix = lab.addMatrix({ matrixId: 'M-1', subjectRef: 'S', logicVersion: '1', rows: [{ testTypeId: 'functional', caseRefs: [] }] });
  lab.startMatrix(matrix.matrixId);
  lab.updateMatrix(matrix.matrixId, { functional: 'PASS' });
  const run = lab.addTestRun({ runId: 'R-1', initiatedBy: 'PIXIE-01', executedBy: 'PIXIE-01', scope: 'LAB', purpose: 'CHECK', matrixRef: 'M-1', logicVersion: '1', status: 'PASS' });
  lab.addArtifact({ artifactId: 'A-1', logicId: 'L', version: '1', target: 'LAB', matrixRef: 'M-1', testRunRefs: [run.runId], evidenceRefs: ['E-1'], now });
  const passport = lab.candidatePassport('A-1');
  assert.deepEqual(passport.sourceRunRefs, ['R-1']);
  assert.equal(passport.matrixRef, 'M-1');
  assert.equal(passport.matrixStatus, 'TEST_PASS');
  assert.deepEqual(passport.evidenceRefs, ['E-1']);
});

test('evidence references without verified evidence remain UNKNOWN', () => {
  const cycle = createCycle({ cycleId: 'C', subjectRef: 'S', roomId: 'ROOM-A', sessionId: 'SESSION-A', logicVersion: '1', now });
  assert.throws(() => applyCycleAction(cycle, { action: 'ZERO', result: 'ZERO_CONFIRMED', evidenceRefs: ['unverified-ref'], now }), /ZERO_REQUIRES_PASS_EVIDENCE/);
});

test('JSON persistence adapter writes and reloads canonical Lab state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pixie-'));
  const path = join(dir, 'lab.json');
  const persistence = createJsonFilePersistence({ filePath: path });
  await persistence.save({ labId: 'PIXIE-LAB', runs: [{ runId: 'R-1' }] });
  assert.deepEqual(await persistence.load(), { labId: 'PIXIE-LAB', runs: [{ runId: 'R-1' }] });
  assert.match(await readFile(path, 'utf8'), /PIXIE-LAB/);
});

test('untrusted recordEvidence PASS cannot certify itself', () => {
  const provider = trust();
  const lab = new PixieLab({ now, evidenceVerifier: createEvidenceVerifier(provider) });
  lab.startSession({ roomId: 'ROOM-A', sessionId: 'S-UNTRUSTED', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-UNTRUSTED');
  const observation = lab.recordEvidence({ evidenceId: 'E-OBS', kind: 'caller-observation', status: 'PASS', sourceRef: 'caller://self' });
  assert.equal(isVerifiedEvidenceRecord(observation, { trustProvider: provider }), false);
  const room = lab.advanceRoomLifecycle('ROOM-A', { stage: 'ZERO', evidence: [observation] });
  assert.equal(room.status, 'QUARANTINED');
});

test('verified FAIL evidence cannot advance a room lifecycle', () => {
  const provider = trust();
  const failProof = createVerifiedEvidence(
    { evidenceId: 'E-FAIL', kind: 'probe', status: 'FAIL', sourceRef: 'probe://failed' },
    { trustProvider: provider },
  );
  const lab = new PixieLab({ now, evidenceVerifier: createEvidenceVerifier(provider) });
  lab.startSession({ roomId: 'ROOM-A', sessionId: 'S-FAIL-PROOF', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-FAIL-PROOF');
  assert.equal(lab.advanceRoomLifecycle('ROOM-A', { stage: 'ZERO', evidence: [failProof] }).status, 'QUARANTINED');
});

test('evidenceRefs must match the verified evidence IDs', () => {
  const provider = trust();
  const cycle = createCycle({ cycleId: 'REF-C', subjectRef: 'S', roomId: 'ROOM-A', sessionId: 'S', logicVersion: '1', now });
  const real = proof('E-REAL', provider);
  assert.throws(
    () => applyCycleAction(cycle, {
      action: 'ZERO',
      result: 'ZERO_CONFIRMED',
      evidenceStatus: 'PASS',
      evidenceRefs: ['E-FAKE'],
      evidence: [real],
      evidenceVerifier: createEvidenceVerifier(provider),
      now,
    }),
    /ZERO_REQUIRES_PASS_EVIDENCE/,
  );
});

test('trusted evidence store can issue PASS that satisfies lifecycle proof', async () => {
  const provider = trust();
  const store = createEvidenceStore({ trustProvider: provider });
  const signed = await store.appendEvidence({ evidenceId: 'E-STORE', kind: 'probe', status: 'PASS', sourceRef: 'probe://zero' });
  const lab = new PixieLab({ now, evidenceVerifier: createEvidenceVerifier(provider) });
  lab.startSession({ roomId: 'ROOM-B', sessionId: 'S-STORE', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-STORE');
  assert.equal(lab.advanceRoomLifecycle('ROOM-B', { stage: 'ZERO', evidence: [signed] }).lifecycleStage, 'ZERO');
  assert.equal(store.verifyEvidence(signed).evidenceId, 'E-STORE');
});

test('evidence trust survives a simulated process restart with the same provider key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pixie-evidence-restart-'));
  const path = join(dir, 'lab.json');
  const persistence = createJsonFilePersistence({ filePath: path });
  const providerBeforeRestart = trust();
  const store = createEvidenceStore({ trustProvider: providerBeforeRestart });
  const signed = await store.appendEvidence({ evidenceId: 'E-PERSISTED', kind: 'probe', status: 'PASS', sourceRef: 'probe://persisted' });

  const first = new PixieLab({ now, persistence, evidenceVerifier: createEvidenceVerifier(providerBeforeRestart) });
  first.acceptVerifiedEvidence(signed);
  await first.persist();

  const providerAfterRestart = trust();
  const verifierAfterRestart = createEvidenceVerifier(providerAfterRestart);
  assert.equal(verifierAfterRestart.sign, null);
  const rebuilt = new PixieLab({ now, persistence, evidenceVerifier: verifierAfterRestart });
  await rebuilt.rebuildBoard();
  assert.equal(rebuilt.state.evidence.length, 1);
  assert.equal(rebuilt.state.evidence[0].evidenceId, 'E-PERSISTED');
  assert.equal(isVerifiedEvidenceRecord(rebuilt.state.evidence[0], { trustProvider: providerAfterRestart }), true);
});

test('wrong provider and tampered payload both fail verification', async () => {
  const provider = trust();
  const store = createEvidenceStore({ trustProvider: provider });
  const signed = await store.appendEvidence({ evidenceId: 'E-TAMPER', kind: 'probe', status: 'PASS', sourceRef: 'probe://trusted' });
  const wrong = createHmacEvidenceTrustProvider({ key: 'different-key', providerId: 'PIXIE-TEST' });
  assert.equal(verifyEvidenceRecord(signed, { trustProvider: wrong }), null);

  const tampered = structuredClone(signed);
  tampered.status = 'FAIL';
  assert.equal(verifyEvidenceRecord(tampered, { trustProvider: provider }), null);
  const timeTampered = structuredClone(signed);
  timeTampered.verifiedAt = '2099-01-01T00:00:00.000Z';
  assert.equal(verifyEvidenceRecord(timeTampered, { trustProvider: provider }), null);
  assert.equal(isVerifiedEvidenceRecord({ status: 'PASS' }, { trustProvider: provider }), false);
});

test('evidence-backed sterilizer issues verified proof only through an injected trust provider', () => {
  const provider = trust();
  const adapter = createEvidenceBackedSterilizer({
    adapterId: 'S-1',
    name: 'host',
    trustProvider: provider,
    probe: () => ({ status: 'STERILE', evidence: [{ evidenceId: 'E-STERILE', kind: 'wipe-log', status: 'PASS', sourceRef: 'probe://sterile' }] }),
  });
  const result = adapter.sterilize({});
  assert.equal(result.evidenceStatus, 'PASS');
  assert.equal(isVerifiedEvidenceRecord(result.evidence[0], { trustProvider: provider }), true);

  const noSigner = createEvidenceBackedSterilizer({
    adapterId: 'S-2',
    name: 'untrusted-host',
    probe: () => ({ status: 'STERILE', evidence: [{ evidenceId: 'E-UNTRUSTED', kind: 'wipe-log', status: 'PASS', sourceRef: 'caller://plain' }] }),
  });
  assert.equal(noSigner.sterilize({}).evidenceStatus, 'UNKNOWN');
});

test('runner host delegates registered runners and preserves unsupported UNKNOWN', async () => {
  const registry = createTestTypeRegistry({ testTypes: [createTestType({ testTypeId: 'functional', name: 'Functional', category: 'FUNCTIONAL', expectedContract: 'expected://x', evidencePolicy: 'trace', runnerInterface: { name: 'ok', run: () => ({ status: 'PASS' }) }, runnerStatus: 'FUNCTIONAL' })] });
  const host = createRunnerHost({ registry });
  assert.equal((await host.run('functional')).status, 'PASS');
  assert.equal((await host.run('chaos')).status, 'UNKNOWN');
});

test('replay queue is bounded to Lab work and does not deploy', async () => {
  const seen = [];
  const queue = createReplayQueue({ execute: async (item) => { seen.push(item); return { status: 'PASS', runId: item.runId }; } });
  assert.deepEqual(queue.enqueue({ runId: 'R-1' }), { status: 'QUEUED', size: 1 });
  assert.deepEqual(await queue.drain(), [{ status: 'PASS', runId: 'R-1' }]);
  assert.deepEqual(seen, [{ runId: 'R-1' }]);
  assert.equal('deploy' in queue, false);
});
