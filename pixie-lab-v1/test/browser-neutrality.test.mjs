import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../browser-adapter/firefox-tab-observer/', import.meta.url);

async function read(name) {
  return readFile(new URL(name, root), 'utf8');
}

test('Factory Eye manifest observes generic HTTP and HTTPS tabs', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  const matches = manifest.content_scripts?.[0]?.matches || [];
  assert.deepEqual(matches, ['http://*/*', 'https://*/*']);
  assert.ok(manifest.permissions.includes('tabs'));
  assert.ok(manifest.host_permissions.includes('<all_urls>'));
  assert.equal(manifest.options_ui?.page, 'options.html');
  assert.deepEqual(manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required, ['websiteActivity', 'websiteContent']);
  assert.equal(manifest.version, '0.3.0');
  assert.equal(
    manifest.browser_specific_settings?.gecko?.id,
    'ergasterion-factory-eye@pureekangraw.local',
  );
});

test('Factory Eye source contains no site-specific profile or domain binding', async () => {
  const source = [
    await read('manifest.json'),
    await read('background.js'),
    await read('content-observer.js'),
  ].join('\n').toLowerCase();

  assert.equal(source.includes('gumroad'), false);
  assert.equal(source.includes('site-profile'), false);
  assert.equal(source.includes('profileforurl'), false);
});

test('Factory Eye page observer never captures input values', async () => {
  const source = await read('content-observer.js');
  assert.match(source, /capturesInputValues:\s*false/);
  assert.doesNotMatch(source, /\.value\b/);
});
