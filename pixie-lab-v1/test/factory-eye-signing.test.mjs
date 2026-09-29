import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = new URL('../../', import.meta.url);

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8');
}

test('Factory Eye AMO signing workflow is manual, unlisted, and pinned', async () => {
  const workflow = await read('.github/workflows/factory-eye-sign.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.match(workflow, /GITHUB_REF_NAME" != "main"/);
  assert.match(workflow, /web-ext@10\.7\.0 sign/);
  assert.match(workflow, /WEB_EXT_CHANNEL:\s*unlisted/);
  assert.match(workflow, /addons\.mozilla\.org\/api\/v5\//);
  assert.match(workflow, /secrets\.FIREFOX_JWT_ISSUER/);
  assert.match(workflow, /secrets\.FIREFOX_JWT_SECRET/);
});

test('Factory Eye signing workflow emits signed XPI provenance', async () => {
  const workflow = await read('.github/workflows/factory-eye-sign.yml');

  assert.match(workflow, /ERGASTERION_FIREFOX_SIGNED_PROVENANCE_V1/);
  assert.match(workflow, /sourceSha:\s*process\.env\.GITHUB_SHA/);
  assert.match(workflow, /signedXpiSha256/);
  assert.match(workflow, /factory-eye-signed-provenance\.json/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});

test('Factory Eye manifest owns a stable Firefox extension id', async () => {
  const manifest = JSON.parse(
    await read('pixie-lab-v1/browser-adapter/firefox-tab-observer/manifest.json'),
  );

  assert.equal(manifest.version, '0.2.0');
  assert.equal(
    manifest.browser_specific_settings?.gecko?.id,
    'ergasterion-factory-eye@pureekangraw.local',
  );
});
