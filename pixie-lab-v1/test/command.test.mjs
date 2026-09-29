import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonFilePersistence } from '../pixie-lab/adapters.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';

const now = () => '2026-09-26T00:00:00.000Z';

async function commander() {
  const dir = await mkdtemp(join(tmpdir(), 'pixie-command-'));
  return createPixieCommander({
    persistence: createJsonFilePersistence({ filePath: join(dir, 'state.json') }),
    now,
  });
}

test('status exposes PIXIE board from the real service', async () => {
  const pixie = await commander();
  const out = await pixie.execute({ command: 'status' });
  assert.equal(out.ok, true);
  assert.equal(out.pixieId, 'PIXIE-01');
  assert.equal(out.result.projectionOnly, true);
  assert.equal(out.result.rooms.length, 4);
});

test('commands persist state across calls', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pixie-command-persist-'));
  const persistence = createJsonFilePersistence({ filePath: join(dir, 'state.json') });
  const first = createPixieCommander({ persistence, now });
  const started = await first.execute({
    command: 'start_session',
    args: { roomId: 'ROOM-A', sessionId: 'S-CMD-1', purpose: 'command proof', activityType: 'CHECK' },
  });
  assert.equal(started.ok, true);
  assert.equal(started.mutated, true);

  const second = createPixieCommander({ persistence, now });
  const status = await second.execute({ command: 'status' });
  assert.equal(status.result.activeSessions.some((item) => item.sessionId === 'S-CMD-1'), true);
});

test('ask routes through Pixie guide using current Lab/Workbench architecture', async () => {
  const pixie = await commander();
  const out = await pixie.execute({ command: 'ask', args: { question: 'มีกี่ห้อง' } });
  assert.equal(out.ok, true);
  assert.match(out.result.answer, /ROOM-A \/ ROOM-B \/ ROOM-C/);
  assert.match(out.result.answer, /ROOM-D is compatibility-only/);
});

test('external authority commands are not exposed', async () => {
  const pixie = await commander();
  for (const command of ['deploy', 'merge', 'delete', 'share', 'external_write']) {
    const out = await pixie.execute({ command });
    assert.equal(out.ok, false);
    assert.equal(out.error, 'COMMAND_NOT_ALLOWED');
  }
});
