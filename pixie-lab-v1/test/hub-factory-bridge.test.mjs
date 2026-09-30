import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { PIXIE_COMMANDS, createPixieCommander } from '../pixie-lab/command.mjs';

const work = {
  handoffId: 'HANDOFF-001',
  workId: 'WORK-HUB-001',
  checkpointId: 'CP-HUB-001',
  experimentId: 'EXP-001',
  variantId: 'VAR-001',
  requestedResult: 'Return Factory candidate and evidence',
  candidateRefs: ['candidate://one'],
  evidenceRefs: ['evidence://hub-context'],
};

function lab() {
  return new PixieLab({ now: () => '2026-09-30T00:00:00.000Z' });
}

test('Hub handoff enters ERGASTERION with Work identity and no authority transfer', () => {
  const instance = lab();
  const received = instance.receiveHubFactoryHandoff(work);
  assert.equal(received.protocol, 'GO_HUB_ERGASTERION_FACTORY_V1');
  assert.equal(received.source, 'PRYTANEION');
  assert.equal(received.destination, 'ERGASTERION');
  assert.equal(received.workId, work.workId);
  assert.equal(received.checkpointId, work.checkpointId);
  assert.equal(received.status, 'RECEIVED');
  assert.equal(received.authorityTransferred, false);
  assert.equal(received.routeAuthorityCreated, false);
  assert.equal(received.approval, 'NOT_AN_APPROVAL');

  const duplicate = instance.receiveHubFactoryHandoff(work);
  assert.deepEqual(duplicate, received);
  assert.equal(instance.state.hubFactoryHandoffs.length, 1);
});

test('ERGASTERION readback preserves the same Hub identity and evidence boundary', () => {
  const instance = lab();
  instance.receiveHubFactoryHandoff(work);
  const readback = instance.createHubFactoryReadback({
    handoffId: work.handoffId,
    status: 'READY_FOR_PRODUCTION_EVIDENCE',
    artifactRefs: ['artifact://candidate'],
    evidenceRefs: ['evidence://factory-check'],
    unknowns: ['runtime deployment not observed'],
    result: { candidate: 'artifact://candidate' },
  });

  assert.equal(readback.source, 'ERGASTERION');
  assert.equal(readback.destination, 'PRYTANEION');
  assert.equal(readback.workId, work.workId);
  assert.equal(readback.checkpointId, work.checkpointId);
  assert.deepEqual(readback.candidateRefs, ['candidate://one']);
  assert.deepEqual(readback.artifactRefs, ['artifact://candidate']);
  assert.deepEqual(readback.evidenceRefs, ['evidence://hub-context', 'evidence://factory-check']);
  assert.deepEqual(readback.unknowns, ['runtime deployment not observed']);
  assert.equal(readback.authorityTransferred, false);
  assert.equal(readback.approval, 'NOT_AN_APPROVAL');
});

test('Hub bridge commands are allowlisted and persist through the normal command surface', async () => {
  assert.equal(PIXIE_COMMANDS.includes('hub_factory_receive'), true);
  assert.equal(PIXIE_COMMANDS.includes('hub_factory_readback'), true);
  let saved = null;
  const persistence = {
    async load() { return saved; },
    async save(value) { saved = structuredClone(value); },
  };
  const commander = createPixieCommander({ persistence, now: () => '2026-09-30T00:00:00.000Z' });
  const received = await commander.execute({ command: 'hub_factory_receive', args: work });
  assert.equal(received.ok, true);
  const readback = await commander.execute({
    command: 'hub_factory_readback',
    args: { handoffId: work.handoffId, status: 'UNKNOWN' },
  });
  assert.equal(readback.ok, true);
  assert.equal(readback.result.workId, work.workId);
  assert.equal(saved.hubFactoryHandoffs.length, 1);
  assert.equal(saved.hubFactoryReadbacks.length, 1);
});
