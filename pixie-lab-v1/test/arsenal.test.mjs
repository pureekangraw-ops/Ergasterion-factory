import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeapon, createWeaponVersion, createWeaponCard, createLoadoutVersion,
  bindExperimentRun, assertRetestCompatible, createEvidenceBundle,
  createProvenUnit, createPromotionRecord, createHandoffPacket, validateProvenance,
} from './arsenal.mjs';

test('weapon card binds implementation and contract to active version', () => {
  const weapon = createWeapon({ weaponId:'WPN-001', name:'Visual Compare', purpose:'compare variants', category:'VISUAL', capabilityRef:'compare.visual' });
  const version = createWeaponVersion({ weaponVersionId:'WPN-001-v3', weaponId:weapon.weaponId, capabilityRef:weapon.capabilityRef, implementationRef:'visual-compare.mjs', contractVersion:'COMPARE_V2' });
  const card = createWeaponCard({ weapon, activeVersion:version });
  assert.equal(card.implementationRef, 'visual-compare.mjs');
  assert.equal(card.contractVersion, 'COMPARE_V2');
  assert.throws(() => createWeaponCard({ weapon, activeVersion:{ ...version, weaponId:'WPN-002' } }), /MISMATCH/);
});

test('loadout is immutable in a run and changes require a new run', () => {
  const loadout = createLoadoutVersion({ loadoutId:'LOADOUT-07', version:'v1', purpose:'web test', weaponVersionRefs:['WPN-001-v3','WPN-003-v1'], contractSnapshot:{ browser:'TEST_V3' } });
  const run = bindExperimentRun({ runId:'RUN-15', loadoutVersion:loadout, targetRef:'preview://checkout', roomRef:'ROOM-B', isolationRef:'iso://run-15' });
  assert.deepEqual(assertRetestCompatible(run, { loadoutVersionRef:'LOADOUT-07::v1', weaponVersionRefs:['WPN-001-v3','WPN-003-v1'], contractSnapshot:{ browser:'TEST_V3' } }), { compatible:true, reason:null });
  assert.equal(assertRetestCompatible(run, { loadoutVersionRef:'LOADOUT-07::v2', weaponVersionRefs:['WPN-001-v3','WPN-003-v1'] }).reason, 'LOADOUT_CHANGE_REQUIRES_NEW_RUN');
});

test('promotion is scoped and never transfers authority', () => {
  const loadout = createLoadoutVersion({ loadoutId:'LOADOUT-07', version:'v1', purpose:'web test', weaponVersionRefs:['WPN-001-v3'] });
  const run = bindExperimentRun({ runId:'RUN-15', loadoutVersion:loadout, targetRef:'preview://checkout', roomRef:'ROOM-B', isolationRef:'iso://run-15' });
  const evidence = createEvidenceBundle({ evidenceBundleId:'EVID-15', runRef:run.runId, loadoutVersionRef:run.loadoutVersionRef, weaponVersionRefs:run.weaponVersionSnapshot, trustStatus:'PASS' });
  const unit = createProvenUnit({ weaponVersionRef:'WPN-001-v3', loadoutVersionRef:run.loadoutVersionRef, runRef:run.runId, recipeRef:'RECIPE-CHECKOUT', evidenceBundleRef:evidence.evidenceBundleId, targetContext:'checkout', scope:'desktop-web' });
  const promotion = createPromotionRecord({ promotionId:'PROM-15', provenUnitRef:'PU-15', fromStage:'CANDIDATE', toStage:'VERIFIED', scope:unit.scope, evidenceBundleRef:evidence.evidenceBundleId });
  assert.equal(promotion.authorityTransferred, false);
  assert.equal(promotion.approval, 'NOT_AN_APPROVAL');
  assert.deepEqual(validateProvenance({ run, evidenceBundle:evidence, provenUnit:unit }), { valid:true, errors:[] });
});

test('handoff is a packet, not authority', () => {
  const packet = createHandoffPacket({ handoffId:'HANDOFF-15', provenUnitRef:'PU-15', artifactRefs:['artifact://a'], evidenceRefs:['EVID-15'] });
  assert.equal(packet.authorityTransferred, false);
  assert.equal(packet.routeAuthorityCreated, false);
});
