import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../browser-adapter/firefox-tab-observer/', import.meta.url);

async function read(name) {
  return readFile(new URL(name, root), 'utf8');
}

test('Factory Eye package, background, and content script versions stay aligned', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  const background = await read('background.js');
  const content = await read('content-observer.js');

  const backgroundVersion = background.match(/const VERSION = '([^']+)'/)?.[1];
  const contentVersion = content.match(/CONTENT_SCRIPT_VERSION = '([^']+)'/)?.[1];

  assert.equal(backgroundVersion, manifest.version);
  assert.equal(contentVersion, manifest.version);
});

test('Factory Eye v0.4.0 targets GO Hub remote bridge rather than localhost', async () => {
  const background = await read('background.js');
  assert.match(background, /https:\/\/go-hub\.pureekangraw\.workers\.dev/);
  assert.match(background, /\/hub\/api\/factory-eye/);
  assert.doesNotMatch(background, /127\.0\.0\.1:4317/);
  assert.doesNotMatch(background, /localhost:4317/);
});

test('Factory Eye pairing uses one-time owner passcode and stores only session credentials', async () => {
  const background = await read('background.js');
  assert.match(background, /x-go-owner-passcode/);
  assert.match(background, /ergasterionFactoryEyeSessionId/);
  assert.match(background, /ergasterionFactoryEyeSessionToken/);
  assert.match(background, /ergasterionFactoryEyeSessionExpiresAt/);
  assert.doesNotMatch(background, /storage\.local\.set\([^)]*passcode/s);
});

test('Factory Eye remote capability declaration is eyes-only', async () => {
  const background = await read('background.js');
  assert.match(background, /navigate:\s*false/);
  assert.match(background, /activateTab:\s*false/);
  assert.match(background, /click:\s*false/);
  assert.match(background, /type:\s*false/);
  assert.match(background, /scroll:\s*false/);
  assert.match(background, /REMOTE_BRIDGE_EYES_ONLY/);
});

test('Factory Eye pairing screen keeps owner passcode in a password field', async () => {
  const html = await read('options.html');
  const js = await read('options.js');
  assert.match(html, /type="password"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(js, /ERGASTERION_FACTORY_EYE_PAIR/);
  assert.match(js, /passcode/);
});


test('Factory Eye visible content pulses wake the Android event page', async () => {
  const background = await read('background.js');
  const content = await read('content-observer.js');

  assert.match(content, /ERGASTERION_FACTORY_EYE_CONTENT_PULSE/);
  assert.match(content, /document\.visibilityState !== 'visible'/);
  assert.match(content, /CONTENT_PULSE_MS = 8000/);
  assert.match(content, /visibilitychange/);
  assert.match(content, /pageshow/);
  assert.match(content, /foreground-keepalive/);

  assert.match(background, /observeFromContentPulse\(message, sender\)/);
  assert.match(background, /sender\?\.tab/);
  assert.match(background, /page\.capturesInputValues !== false/);
  assert.match(background, /page\.createsAuthority !== false/);
  assert.match(background, /new URL\(senderUrl\)\.origin === new URL\(pageUrl\)\.origin/);
});

test('Factory Eye remote pulse does not expand write capabilities', async () => {
  const background = await read('background.js');
  assert.match(background, /navigate:\s*false/);
  assert.match(background, /activateTab:\s*false/);
  assert.match(background, /click:\s*false/);
  assert.match(background, /type:\s*false/);
  assert.match(background, /scroll:\s*false/);
});


test('Factory Eye v0.4.0 rejects stale content generations and verifies the active sender tab', async () => {
  const background = await read('background.js');
  const content = await read('content-observer.js');

  assert.match(content, /CONTENT_SCRIPT_VERSION = '0\.4\.0'/);
  assert.match(content, /observerVersion: CONTENT_SCRIPT_VERSION/);
  assert.match(content, /visibilityState: document\.visibilityState/);
  assert.match(content, /documentFocused: document\.hasFocus\(\)/);
  assert.match(content, /contentScriptVersion: CONTENT_SCRIPT_VERSION/);

  assert.match(background, /contentScriptVersion !== VERSION/);
  assert.match(background, /STALE_SCRIPT_VERSION/);
  assert.match(background, /browser\.tabs\.query\(\{ active: true \}\)/);
  assert.match(background, /activeTabs\.some\(\(tab\) => tab\.id === senderTab\.id\)/);
  assert.doesNotMatch(background, /active:\s*message\?\.visible === true/);
});

test('Factory Eye v0.4.0 sends freshness evidence without adding page authority', async () => {
  const background = await read('background.js');
  assert.match(background, /evidenceReason:/);
  assert.match(background, /documentVisible:/);
  assert.match(background, /documentFocused:/);
  assert.match(background, /navigate:\s*false/);
  assert.match(background, /click:\s*false/);
  assert.match(background, /type:\s*false/);
});


test('Factory Eye v0.4.0 observes dedicated GitHub and Cloudflare watch tabs while inactive', async () => {
  const background = await read('background.js');
  assert.match(background, /WATCH_POLL_MS = 15000/);
  assert.match(background, /WATCH_RULES_STORAGE_KEY/);
  assert.match(background, /DEFAULT_DEDICATED_WATCH_RULES/);
  assert.match(background, /github\.com/);
  assert.match(background, /\/pureekangraw-ops/);
  assert.match(background, /\/orgs\/pureekangraw-ops/);
  assert.match(background, /dash\.cloudflare\.com/);
  assert.match(background, /loadDedicatedWatchRules/);
  assert.match(background, /isDedicatedWatchTab/);
  assert.match(background, /observeDedicatedWatchTabs/);
  assert.doesNotMatch(background, /pureekangraw-ops\/Ergasterion-factory/);
  assert.match(background, /setInterval\(\(\) => \{ void observeDedicatedWatchTabs\(\); \}, WATCH_POLL_MS\)/);
  assert.match(background, /documentVisible: observed\.page\?\.visibilityState === 'visible'/);
});
