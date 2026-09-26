import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflowUrl = new URL('../../.github/workflows/pixie-lab-v1.yml', import.meta.url);

test('workflow exposes serialized PIXIE runtime command transport', async () => {
  const text = await readFile(workflowUrl, 'utf8');
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /request_id:/);
  assert.match(text, /command_json:/);
  assert.match(text, /group: pixie-runtime-command/);
  assert.match(text, /pixie-runtime-state/);
  assert.match(text, /node pixie-lab-v1\/cli\.mjs/);
  assert.match(text, /contents: write/);
  assert.match(text, /last-result\.json/);
});
