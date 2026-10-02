import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { createLivingScene, editLivingScene, validateLivingScene, createWebExportManifest } from '../pixie-lab/living-scene.mjs';

test('Living Scene defaults to LOCK plus subtle LIVE motion', () => {
  const scene = createLivingScene({ sceneId: 'SCENE-1', sourceAssetId: 'image://metro' });
  assert.equal(scene.motion.preset, 'SUBTLE');
  assert.equal(scene.motion.reducedMotion, 'POSTER');
  assert.ok(scene.regions.some((region) => region.mode === 'LOCK'));
  assert.ok(scene.regions.some((region) => region.mode === 'LIVE'));
});

test('Living Scene supports event motion for a train without unlocking the foreground', () => {
  const scene = createLivingScene({
    sceneId: 'SCENE-TRAIN', sourceAssetId: 'image://metro',
    regions: [
      { id: 'INTERIOR', kind: 'FOREGROUND', mode: 'LOCK' },
      { id: 'CITY', kind: 'CITY', mode: 'LIVE', motion: { preset: 'SUBTLE', loopType: 'CONTINUOUS' } },
      { id: 'TRAIN', kind: 'TRAIN', mode: 'LIVE', motion: { preset: 'ALIVE', loopType: 'EVENT', direction: 'RIGHT', blur: 4 } },
    ],
  });
  assert.equal(scene.regions.find((region) => region.id === 'TRAIN').motion.loopType, 'EVENT');
  assert.equal(scene.regions.find((region) => region.id === 'INTERIOR').motion.preset, 'STILL');
  const ready = validateLivingScene(scene);
  assert.equal(ready.quality.status, 'WARNING');
  assert.match(ready.quality.checks.find((check) => check.checkId === 'DEFAULT_MOTION').detail, /stronger/);
});

test('Living Scene validation and web export preserve reduced-motion fallback', () => {
  const scene = createLivingScene({ sceneId: 'SCENE-WEB', sourceAssetId: 'image://room' });
  const ready = validateLivingScene(scene);
  assert.equal(ready.quality.status, 'PASS');
  const manifest = createWebExportManifest(ready, { profiles: ['HERO', 'BACKGROUND', 'MOBILE'] });
  assert.equal(manifest.manifestVersion, 'PIXIE_WEB_EXPORT_V1');
  assert.equal(manifest.files.find((file) => file.kind === 'poster').format, 'webp');
  assert.equal(manifest.files.some((file) => file.profile === 'MOBILE' && file.motion === 'LOW'), true);
});

test('Living Scene is exposed through the existing PIXIE service and command surface', async () => {
  const lab = new PixieLab({ now: () => '2026-10-02T00:00:00.000Z' });
  const scene = lab.createLivingScene({ sceneId: 'SCENE-CMD', sourceAssetId: 'image://cmd' });
  assert.equal(scene.sceneId, 'SCENE-CMD');
  const edited = lab.editLivingScene('SCENE-CMD', { motion: { preset: 'SUBTLE', loopType: 'CONTINUOUS' } });
  const verified = lab.validateLivingScene('SCENE-CMD');
  const manifest = lab.createWebExportManifest('SCENE-CMD', { profiles: ['BACKGROUND'] });
  assert.equal(edited.motion.preset, 'SUBTLE');
  assert.equal(verified.quality.status, 'PASS');
  assert.equal(manifest.profiles[0], 'BACKGROUND');
});
