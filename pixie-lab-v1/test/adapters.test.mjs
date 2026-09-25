import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCycle, applyCycleAction, createTestType, createTestTypeRegistry } from '../pixie-lab/core.mjs';
import { createJsonFilePersistence, createEvidenceStore, createEvidenceBackedSterilizer, createRunnerHost, createReplayQueue } from '../pixie-lab/adapters.mjs';

const now = () => '2026-09-25T00:00:00.000Z';

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
