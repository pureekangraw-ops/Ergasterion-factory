const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : [values]).map(text).filter(Boolean))];
const required = (value, label) => { const result = text(value); if (!result) throw new Error(`${label} is required`); return result; };
const nowIso = () => new Date().toISOString();

export const REGION_MODES = Object.freeze(['LOCK', 'LIVE', 'OPTIONAL']);
export const MOTION_PRESETS = Object.freeze(['STILL', 'SUBTLE', 'ALIVE', 'CINEMATIC', 'CUSTOM']);
export const LOOP_TYPES = Object.freeze(['CONTINUOUS', 'PING_PONG', 'EVENT', 'PROCEDURAL', 'ONE_SHOT']);
export const WEB_PROFILES = Object.freeze(['HERO', 'BACKGROUND', 'MOBILE']);

const DEFAULT_MOTION = Object.freeze({
  preset: 'SUBTLE', speed: 0.22, amplitude: 0.12, direction: 'NONE', opacity: 1,
  blur: 0, depth: 0, frequency: 0.12, delay: 0, loopType: 'CONTINUOUS', reducedMotion: 'POSTER',
});

function normalizeMotion(input = {}) {
  const preset = upper(input.preset || 'SUBTLE');
  if (!MOTION_PRESETS.includes(preset)) throw new Error('LIVING_SCENE_MOTION_PRESET_INVALID');
  const loopType = upper(input.loopType || DEFAULT_MOTION.loopType);
  if (!LOOP_TYPES.includes(loopType)) throw new Error('LIVING_SCENE_LOOP_TYPE_INVALID');
  const number = (value, fallback, min = 0, max = 1) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  return {
    preset, speed: number(input.speed, DEFAULT_MOTION.speed), amplitude: number(input.amplitude, DEFAULT_MOTION.amplitude),
    direction: text(input.direction || DEFAULT_MOTION.direction), opacity: number(input.opacity, DEFAULT_MOTION.opacity),
    blur: number(input.blur, DEFAULT_MOTION.blur, 0, 64), depth: number(input.depth, DEFAULT_MOTION.depth),
    frequency: number(input.frequency, DEFAULT_MOTION.frequency), delay: number(input.delay, DEFAULT_MOTION.delay, 0, 60),
    loopType, reducedMotion: text(input.reducedMotion || DEFAULT_MOTION.reducedMotion),
  };
}

function normalizeRegion(region = {}, index = 0) {
  const mode = upper(region.mode || region.status || 'LOCK');
  if (!REGION_MODES.includes(mode)) throw new Error('LIVING_SCENE_REGION_MODE_INVALID');
  const id = required(region.id || region.regionId || `REGION-${index + 1}`, 'region.id');
  const kind = upper(region.kind || 'BACKGROUND');
  const label = text(region.label || kind) || kind;
  const motion = mode === 'LOCK' ? { ...DEFAULT_MOTION, preset: 'STILL', loopType: 'ONE_SHOT' } : normalizeMotion(region.motion);
  return { id, kind, label, mode, sourceRef: text(region.sourceRef) || null, maskRef: text(region.maskRef) || null, motion };
}

function defaultRegions() {
  return [
    normalizeRegion({ id: 'TEXT', kind: 'TEXT', mode: 'LOCK' }),
    normalizeRegion({ id: 'FOREGROUND', kind: 'FOREGROUND', mode: 'LOCK' }),
    normalizeRegion({ id: 'SKY', kind: 'SKY', mode: 'LIVE', motion: { preset: 'SUBTLE', direction: 'LEFT', depth: 0.2 } }),
  ];
}

export function createLivingScene({ sceneId, sourceAssetId, regions = null, motion = {}, themeId = null, loopType = undefined, reducedMotion = 'POSTER', now = nowIso } = {}) {
  const normalizedMotion = normalizeMotion({ ...motion, ...(loopType ? { loopType } : {}), reducedMotion });
  const normalizedRegions = (regions == null ? defaultRegions() : regions.map(normalizeRegion));
  if (!normalizedRegions.some((region) => region.mode === 'LOCK')) throw new Error('LIVING_SCENE_LOCK_REQUIRED');
  return Object.freeze({
    sceneId: required(sceneId, 'sceneId'), sourceAssetId: required(sourceAssetId, 'sourceAssetId'), themeId: text(themeId) || null,
    status: 'DRAFT', regions: normalizedRegions, motion: normalizedMotion,
    quality: { status: 'UNKNOWN', checks: [] }, webExports: [], createdAt: now(), updatedAt: now(),
  });
}

export function editLivingScene(scene, { regions, motion, themeId, status } = {}, { now = nowIso } = {}) {
  if (!scene?.sceneId) throw new Error('LIVING_SCENE_REQUIRED');
  const nextRegions = regions === undefined ? scene.regions : regions.map(normalizeRegion);
  if (!nextRegions.some((region) => region.mode === 'LOCK')) throw new Error('LIVING_SCENE_LOCK_REQUIRED');
  return Object.freeze({ ...clone(scene), regions: nextRegions, motion: motion === undefined ? scene.motion : normalizeMotion(motion), themeId: themeId === undefined ? scene.themeId : text(themeId) || null, status: text(status || scene.status).toUpperCase(), updatedAt: now() });
}

export function validateLivingScene(scene, { now = nowIso } = {}) {
  if (!scene?.sceneId) throw new Error('LIVING_SCENE_REQUIRED');
  const checks = [];
  const lockRegions = scene.regions.filter((region) => region.mode === 'LOCK');
  const liveRegions = scene.regions.filter((region) => region.mode === 'LIVE');
  checks.push({ checkId: 'LOCK_ZONE', status: lockRegions.length ? 'PASS' : 'FAIL', detail: lockRegions.length ? `${lockRegions.length} LOCK region(s)` : 'At least one LOCK region is required' });
  checks.push({ checkId: 'LIVE_ZONE', status: liveRegions.length ? 'PASS' : 'UNKNOWN', detail: liveRegions.length ? `${liveRegions.length} LIVE region(s)` : 'No LIVE region configured' });
  checks.push({ checkId: 'DEFAULT_MOTION', status: scene.motion.preset === 'SUBTLE' ? 'PASS' : 'WARNING', detail: scene.motion.preset === 'SUBTLE' ? 'Subtle is the default profile' : 'Motion is stronger than the default profile' });
  checks.push({ checkId: 'REDUCED_MOTION', status: scene.motion.reducedMotion ? 'PASS' : 'FAIL', detail: scene.motion.reducedMotion || 'Reduced-motion fallback missing' });
  const status = checks.some((check) => check.status === 'FAIL') ? 'BLOCKED' : checks.some((check) => check.status === 'WARNING' || check.status === 'UNKNOWN') ? 'WARNING' : 'PASS';
  return Object.freeze({ ...clone(scene), quality: { status, checks, checkedAt: now() }, status: status === 'PASS' ? 'READY' : 'DRAFT', updatedAt: now() });
}

export function createWebExportManifest(scene, { assetBase = 'asset://pixie', profiles = WEB_PROFILES, now = nowIso } = {}) {
  if (!scene?.sceneId) throw new Error('LIVING_SCENE_REQUIRED');
  const selected = unique(profiles).map(upper);
  if (selected.some((profile) => !WEB_PROFILES.includes(profile))) throw new Error('WEB_EXPORT_PROFILE_INVALID');
  if (scene.quality?.status === 'BLOCKED') throw new Error('WEB_EXPORT_SCENE_BLOCKED');
  const files = [{ kind: 'poster', path: `${assetBase}/${scene.sceneId}/poster.webp`, format: 'webp' }];
  if (selected.includes('HERO')) files.push({ kind: 'video', profile: 'HERO', path: `${assetBase}/${scene.sceneId}/desktop.webm`, format: 'webm', resolution: '1920x1080', audio: false });
  if (selected.includes('BACKGROUND')) files.push({ kind: 'video', profile: 'BACKGROUND', path: `${assetBase}/${scene.sceneId}/background.webm`, format: 'webm', resolution: '1280x720', audio: false });
  if (selected.includes('MOBILE')) files.push({ kind: 'video', profile: 'MOBILE', path: `${assetBase}/${scene.sceneId}/mobile.webm`, format: 'webm', resolution: '720p', audio: false, motion: 'LOW' });
  files.push({ kind: 'fallback', path: `${assetBase}/${scene.sceneId}/fallback.mp4`, format: 'mp4', audio: false });
  return Object.freeze({ manifestVersion: 'PIXIE_WEB_EXPORT_V1', sceneId: scene.sceneId, sourceAssetId: scene.sourceAssetId, profiles: selected, files, reducedMotion: scene.motion.reducedMotion, metadata: { sceneId: scene.sceneId, themeId: scene.themeId, engine: 'PIXIE_VISUAL', createdAt: now() } });
}
