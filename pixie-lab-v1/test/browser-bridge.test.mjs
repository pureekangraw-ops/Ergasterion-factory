import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMemoryPersistence } from '../pixie-lab/core.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import { createNeutralBrowserRuntimeAdapter } from '../pixie-lab/browser-runtime-adapter.mjs';
import { createFactoryServer } from '../factory-server.mjs';

async function withBrowserServer(fn) {
  const browserAdapter = createNeutralBrowserRuntimeAdapter();
  const commander = createPixieCommander({
    persistence: createMemoryPersistence(),
    runtimeExecutor: browserAdapter,
  });
  const server = createFactoryServer({ commander, browserAdapter });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try { await fn(base); }
  finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function json(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json();
  return { response, body };
}

test('Firefox bridge registers arbitrary tabs and records observation into Runtime Workbench', async () => {
  await withBrowserServer(async (base) => {
    const register = await json(base, '/api/browser/register', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'FIREFOX-E2E',
        host: 'firefox-addon',
        version: '0.2.0',
        capabilities: {
          tabs: true,
          observe: true,
          domSummary: true,
          screenshot: true,
          navigate: true,
          activateTab: true,
          receipt: true,
        },
      }),
    });
    assert.equal(register.response.status, 200);

    const heartbeat = await json(base, '/api/browser/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'FIREFOX-E2E',
        activeTabId: 2,
        tabs: [
          { tabId: 1, windowId: 9, url: 'https://example.com/', title: 'Example', active: false },
          { tabId: 2, windowId: 9, url: 'https://developer.mozilla.org/', title: 'MDN', active: true },
        ],
      }),
    });
    assert.equal(heartbeat.response.status, 200);

    const observe = await json(base, '/api/browser/observe', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'FIREFOX-E2E',
        observationId: 'OBS-E2E-1',
        tab: {
          tabId: 2,
          windowId: 9,
          url: 'https://developer.mozilla.org/',
          title: 'MDN',
          active: true,
        },
        page: {
          schema: 'ERGASTERION_BROWSER_PAGE_SUMMARY_V2',
          headings: [{ level: 1, text: 'MDN Web Docs' }],
          buttons: [],
          links: [],
          fields: [],
          capturesInputValues: false,
        },
        screenshotDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
        status: 'OBSERVED',
      }),
    });
    assert.equal(observe.response.status, 200);
    assert.equal(observe.body.runtimeRecord.result.status, 'PASS');

    const tabs = await json(base, '/api/browser/tabs');
    assert.equal(tabs.body.tabs.length, 2);
    assert.equal(tabs.body.tabs[0].tabId, 2);
    assert.equal(tabs.body.tabs[0].active, true);

    const latest = await json(base, '/api/browser/latest');
    assert.equal(latest.body.observation.tab.url, 'https://developer.mozilla.org/');
    assert.equal(latest.body.observation.page.headings[0].text, 'MDN Web Docs');

    const runtimeView = await json(base, '/api/command', {
      method: 'POST',
      body: JSON.stringify({ command: 'runtime_view', args: { selector: {} } }),
    });
    assert.equal(runtimeView.body.result.latestObservation.observationId, 'OBS-E2E-1');
    assert.equal(runtimeView.body.result.latestObservation.status, 'PASS');

    const runtimeStatus = await json(base, '/api/command', {
      method: 'POST',
      body: JSON.stringify({ command: 'runtime_status', args: {} }),
    });
    assert.equal(runtimeStatus.body.result.status, 'ACTIVE');
    assert.equal(runtimeStatus.body.result.executor.status, 'LIVE');
  });
});

test('Runtime action reaches Firefox command queue without inventing outcome success', async () => {
  await withBrowserServer(async (base) => {
    await json(base, '/api/browser/register', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'FIREFOX-CONTROL',
        host: 'firefox-addon',
        version: '0.2.0',
        capabilities: { tabs: true, observe: true, navigate: true, receipt: true },
      }),
    });

    const action = await json(base, '/api/command', {
      method: 'POST',
      body: JSON.stringify({
        command: 'runtime_action',
        args: {
          action: {
            type: 'navigate',
            tabId: 3,
            url: 'https://example.org/',
            workId: 'WORK-E2E',
            checkpointId: 'CP-E2E',
          },
        },
      }),
    });
    assert.equal(action.body.result.status, 'QUEUED');

    const commands = await json(base, '/api/browser/commands?adapterId=FIREFOX-CONTROL');
    assert.equal(commands.body.commands.length, 1);
    const command = commands.body.commands[0];

    await json(base, '/api/browser/observe', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'FIREFOX-CONTROL',
        observationId: 'OBS-AFTER-NAV',
        workId: 'WORK-E2E',
        checkpointId: 'CP-E2E',
        tab: { tabId: 3, windowId: 1, url: 'https://example.org/', title: 'Example Domain', active: true },
        page: { schema: 'ERGASTERION_BROWSER_PAGE_SUMMARY_V2', headings: [{ level: 1, text: 'Example Domain' }], capturesInputValues: false },
        status: 'OBSERVED',
      }),
    });

    const receipt = await json(base, '/api/browser/receipt', {
      method: 'POST',
      body: JSON.stringify({
        adapterId: 'FIREFOX-CONTROL',
        commandId: command.commandId,
        status: 'EXECUTED',
        followUpObservationId: 'OBS-AFTER-NAV',
        workId: 'WORK-E2E',
        checkpointId: 'CP-E2E',
        targetRef: 'browser-tab://FIREFOX-CONTROL/1/3',
        action: command.action,
      }),
    });
    assert.equal(receipt.response.status, 200);
    assert.equal(receipt.body.runtimeInteraction.result.result, 'UNKNOWN');
    assert.ok(receipt.body.runtimeInteraction.result.unknowns.includes('FOLLOW_UP_OBSERVATION_REQUIRED'));
  });
});
