import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCycle, applyCycleAction, createTestType, createTestTypeRegistry } from '../pixie-lab/core.mjs';
import { createJsonFilePersistence, createEvidenceStore, createEvidenceBackedSterilizer, createRunnerHost, createReplayQueue } from '../pixie-lab/adapters.mjs';
import { PixieLab } from '../pixie-lab/service.mjs';
import { createEvidence, createArtifact, createTestRun, createTestMatrix, isVerifiedEvidenceRecord, verifyEvidenceRecord } from '../pixie-lab/core.mjs';

const now = () => '2026-09-25T00:00:00.000Z';

test('closeSession enters ARCHIVE and requires the full clean-room lifecycle', () => {
  const lab = new PixieLab({ now });
  lab.startSession({ roomId: 'ROOM-A', sessionId: 'S-1', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-1');
  assert.equal(lab.room('ROOM-A').status, 'ARCHIVE');
  const proof = (id) => createEvidence({ evidenceId: id, kind: 'room-proof', status: 'PASS', sourceRef: `fixture://${id}` });
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'ZERO', evidence: [proof('ZERO')] });
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'STERILIZE', evidence: [proof('STERILE')] });
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'VERIFY_CLEAN', evidence: [proof('VERIFY')] });
  lab.advanceRoomLifecycle('ROOM-A', { stage: 'LOAD_CLEAN_SEED', seedRef: 'seed://clean', evidence: [proof('SEED')] });
  assert.equal(lab.advanceRoomLifecycle('ROOM-A', { stage: 'READY', evidence: [proof('READY')] }).status, 'READY');
});

test('room lifecycle fail or unknown quarantines without a CLEAN shortcut', () => {
  const lab = new PixieLab({ now });
  lab.startSession({ roomId: 'ROOM-B', sessionId: 'S-2', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-2');
  const room = lab.advanceRoomLifecycle('ROOM-B', { stage: 'ZERO', result: 'UNKNOWN', evidence: [] });
  assert.equal(room.status, 'QUARANTINED');
  assert.equal(room.lifecycleStage, 'QUARANTINED');
});

test('quarantined room recovers through CLEAN_AGAIN before returning READY', () => {
  const lab = new PixieLab({ now });
  lab.startSession({ roomId: 'ROOM-C', sessionId: 'S-3', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-3');
  const proof = (id) => createEvidence({ evidenceId: id, kind: 'room-proof', status: 'PASS', sourceRef: `fixture://${id}` });
  assert.equal(lab.advanceRoomLifecycle('ROOM-C', { stage: 'ZERO', result: 'FAIL', evidence: [] }).status, 'QUARANTINED');
  assert.equal(lab.advanceRoomLifecycle('ROOM-C', { stage: 'CLEAN_AGAIN', evidence: [proof('CLEAN-AGAIN')] }).lifecycleStage, 'CLEAN_AGAIN');
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'ZERO', evidence: [proof('ZERO-2')] });
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'STERILIZE', evidence: [proof('STERILE-2')] });
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'VERIFY_CLEAN', evidence: [proof('VERIFY-2')] });
  lab.advanceRoomLifecycle('ROOM-C', { stage: 'LOAD_CLEAN_SEED', seedRef: 'seed://clean-2', evidence: [proof('SEED-2')] });
  const ready = lab.advanceRoomLifecycle('ROOM-C', { stage: 'READY', evidence: [proof('READY-2')] });
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


test('evidence references without evidence status remain UNKNOWN', () => {
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

test('evidence store keeps explicit statuses', async () => {
  const store = createEvidenceStore();
  await store.appendEvidence({ evidenceId: 'E-1', kind: 'probe', status: 'UNKNOWN', sourceRef: 'fixture://missing' });
  assert.equal((await store.listEvidence())[0].status, 'UNKNOWN');
});

test('trusted evidence survives structured clone and evidence-store listing', async () => {
  const store = createEvidenceStore();
  const created = await store.appendEvidence({ evidenceId: 'E-DURABLE', kind: 'probe', status: 'PASS', sourceRef: 'fixture://durable' });
  const cloned = structuredClone(created);
  const listed = (await store.listEvidence())[0];
  assert.equal(isVerifiedEvidenceRecord(created), true);
  assert.equal(isVerifiedEvidenceRecord(cloned), true);
  assert.equal(isVerifiedEvidenceRecord(listed), true);
  assert.equal(store.verifyEvidence(listed).evidenceId, 'E-DURABLE');
  assert.equal(isVerifiedEvidenceRecord({ status: 'PASS' }), false);
});

test('recordEvidence return can be reused as later lifecycle proof', () => {
  const lab = new PixieLab({ now });
  lab.startSession({ roomId: 'ROOM-A', sessionId: 'S-EVIDENCE', purpose: 'X', activityType: 'CHECK' });
  lab.closeSession('S-EVIDENCE');
  const evidence = lab.recordEvidence({ evidenceId: 'E-RECORDED', kind: 'room-proof', status: 'PASS', sourceRef: 'fixture://recorded' });
  assert.equal(isVerifiedEvidenceRecord(evidence), true);
  const room = lab.advanceRoomLifecycle('ROOM-A', { stage: 'ZERO', evidence: [evidence] });
  assert.equal(room.lifecycleStage, 'ZERO');
});

test('persisted evidence rehydrates only through the trusted verification path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pixie-evidence-'));
  const path = join(dir, 'evidence.json');
  const persistence = createJsonFilePersistence({ filePath: path });
  const trusted = createEvidence({ evidenceId: 'E-PERSISTED', kind: 'probe', status: 'PASS', sourceRef: 'fixture://persisted' });
  await persistence.save({ evidence: [structuredClone(trusted), { status: 'PASS' }] });
  const persisted = await persistence.load();
  const restored = verifyEvidenceRecord(persisted.evidence[0], { trustedBy: 'PIXIE_PERSISTENCE' });
  const forged = verifyEvidenceRecord(persisted.evidence[1], { trustedBy: 'PIXIE_PERSISTENCE' });
  assert.equal(isVerifiedEvidenceRecord(restored), true);
  assert.equal(restored.evidenceId, 'E-PERSISTED');
  assert.equal(forged, null);
});

test('evidence-backed sterilizer cannot invent PASS without probe evidence', () => {
  const adapter = createEvidenceBackedSterilizer({ adapterId: 'S-1', name: 'host', probe: () => ({ status: 'STERILE', evidence: [] }) });
  assert.equal(adapter.sterilize({}).evidenceStatus, 'UNKNOWN');
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
