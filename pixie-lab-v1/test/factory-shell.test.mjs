import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMemoryPersistence } from '../pixie-lab/core.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import { createFactoryServer } from '../factory-server.mjs';

async function withServer(fn) {
  const commander = createPixieCommander({ persistence: createMemoryPersistence() });
  const server = createFactoryServer({ commander });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try { await fn(base); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('Factory shell serves health and bootstrap from live commander', async () => {
  await withServer(async (base) => {
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.product, 'ERGASTERION');
    assert.equal(health.surface, 'DREAM_FACTORY_SHELL_V1');

    const bootstrap = await fetch(`${base}/api/bootstrap`).then((r) => r.json());
    assert.equal(bootstrap.ok, true);
    assert.equal(bootstrap.shell, 'DREAM_FACTORY_SHELL_V1');
    assert.equal(bootstrap.data.workbench_floor.ok, true);
    assert.equal(bootstrap.data.reality_screen.ok, true);
    assert.equal(bootstrap.data.checkpoint_dock.ok, true);
    assert.equal(bootstrap.data.big_view.ok, true);
    assert.equal(bootstrap.data.intent_review.ok, true);
  });
});

test('Factory shell command endpoint opens current Visual Workbench', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command: 'workbench_open',
        args: { workbenchId: 'VISUAL_WORKBENCH' },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.result.workbenchId, 'VISUAL_WORKBENCH');
    assert.equal(body.result.authority.createsAuthority, false);
  });
});

test('Factory shell serves real static UI assets', async () => {
  await withServer(async (base) => {
    const html = await fetch(`${base}/`).then((r) => r.text());
    const css = await fetch(`${base}/styles.css`).then((r) => r.text());
    const js = await fetch(`${base}/app.js`).then((r) => r.text());

    assert.match(html, /ERGASTERION/);
    assert.match(html, /REFERENCE TRAY/);
    assert.match(css, /visual-grid/);
    assert.match(js, /VISUAL_WORKBENCH/);
  });
});

test('Factory shell never exposes arbitrary filesystem paths as static files', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/package.json`);
    assert.equal(response.status, 404);
  });
});
