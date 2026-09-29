import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../browser-adapter/firefox-tab-observer/', import.meta.url);

async function read(name) {
  return readFile(new URL(name, root), 'utf8');
}

test('Factory Eye v0.2.1 targets GO Hub remote bridge rather than localhost', async () => {
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
