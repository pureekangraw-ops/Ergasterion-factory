import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeutralBrowserRuntimeAdapter } from '../pixie-lab/browser-runtime-adapter.mjs';

test('neutral browser adapter declares tab-level capabilities without site profiles', async () => {
  const adapter = createNeutralBrowserRuntimeAdapter();
  const registered = adapter.register({
    adapterId: 'FIREFOX-1',
    host: 'firefox-addon',
    version: '0.2.0',
    capabilities: {
      tabs: true,
      observe: true,
      url: true,
      title: true,
      domSummary: true,
      screenshot: true,
      navigate: true,
      activateTab: true,
      receipt: true,
      reconnect: true,
    },
  });

  assert.equal(registered.adapterId, 'FIREFOX-1');
  assert.equal(registered.capabilities.tabs, true);
  assert.equal(registered.capabilities.observe, true);
  assert.equal(registered.capabilities.click, false);

  adapter.heartbeat({
    adapterId: 'FIREFOX-1',
    activeTabId: 11,
    tabs: [
      { tabId: 11, windowId: 2, url: 'https://example.com/', title: 'Example', active: true },
      { tabId: 12, windowId: 2, url: 'https://developer.mozilla.org/', title: 'MDN', active: false },
    ],
  });

  const status = await adapter.status();
  assert.equal(status.available, true);
  assert.equal(status.status, 'LIVE');
  assert.equal(status.tabCount, 2);
  assert.equal(adapter.listTabs()[0].tabId, 11);
});

test('neutral browser observation maps arbitrary web tab into Runtime Workbench socket', () => {
  const adapter = createNeutralBrowserRuntimeAdapter();
  adapter.register({
    adapterId: 'FIREFOX-2',
    host: 'firefox-addon',
    version: '0.2.0',
    capabilities: { tabs: true, observe: true, screenshot: true },
  });

  const observed = adapter.observe({
    adapterId: 'FIREFOX-2',
    observationId: 'OBS-1',
    tab: {
      tabId: 7,
      windowId: 1,
      url: 'https://example.org/docs',
      title: 'Docs',
      active: true,
    },
    page: {
      schema: 'ERGASTERION_BROWSER_PAGE_SUMMARY_V2',
      headings: [{ level: 1, text: 'Hello' }],
      capturesInputValues: false,
    },
    screenshotDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
    status: 'OBSERVED',
  });

  assert.equal(observed.runtimeRecord.status, 'PASS');
  assert.equal(observed.runtimeRecord.targetRef, 'browser-tab://FIREFOX-2/1/7');
  assert.equal(observed.runtimeRecord.observedRef, 'browser-observation://FIREFOX-2/OBS-1');
  assert.equal(observed.runtimeRecord.screenshotRefs.length, 1);
  assert.equal(observed.page.capturesInputValues, false);

  const shot = adapter.getScreenshot(observed.screenshotRef);
  assert.equal(shot.contentType, 'image/jpeg');
  assert.equal(shot.data.toString('utf8'), 'hello');
});

test('runtime actions queue only declared browser capabilities', async () => {
  const adapter = createNeutralBrowserRuntimeAdapter();
  adapter.register({
    adapterId: 'FIREFOX-3',
    host: 'firefox-addon',
    version: '0.2.0',
    capabilities: { tabs: true, observe: true, navigate: true, activateTab: true, receipt: true },
  });

  const queued = await adapter.interact({
    type: 'navigate',
    tabId: 4,
    url: 'https://example.net/',
    workId: 'WORK-1',
    checkpointId: 'CP-1',
  });
  assert.equal(queued.ok, true);
  assert.equal(queued.status, 'QUEUED');

  const commands = adapter.pullCommands('FIREFOX-3');
  assert.equal(commands.length, 1);
  assert.equal(commands[0].action.type, 'navigate');

  const unsupported = await adapter.interact({ type: 'click', tabId: 4 });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.reason, 'BROWSER_ACTION_UNSUPPORTED');
});

test('executed host receipt remains UNKNOWN until follow-up observation proves outcome', () => {
  const adapter = createNeutralBrowserRuntimeAdapter();
  adapter.register({
    adapterId: 'FIREFOX-4',
    host: 'firefox-addon',
    version: '0.2.0',
    capabilities: { observe: true, navigate: true, receipt: true },
  });

  const receipt = adapter.acceptReceipt({
    adapterId: 'FIREFOX-4',
    commandId: 'CMD-1',
    status: 'EXECUTED',
    targetRef: 'browser-tab://FIREFOX-4/1/2',
    action: { type: 'navigate', tabId: 2, url: 'https://example.com/' },
  });

  assert.equal(receipt.runtimeInteraction.result, 'UNKNOWN');
  assert.ok(receipt.runtimeInteraction.unknowns.includes('FOLLOW_UP_OBSERVATION_REQUIRED'));
  assert.ok(receipt.runtimeInteraction.evidenceRefs[0].startsWith('browser-receipt://'));
});
