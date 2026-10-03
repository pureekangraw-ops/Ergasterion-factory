const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const required = (value, label) => {
  const result = text(value);
  if (!result) throw new Error(`${label} is required`);
  return result;
};

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const unique = (values = []) => [...new Set(values.map(text).filter(Boolean))];

export const ARSENAL_STAGES = Object.freeze([
  'EXPERIMENTAL', 'CANDIDATE', 'VERIFIED', 'READY_FOR_HANDOFF',
]);

export const CAPABILITY_LAWS = Object.freeze([
  'HANDOFF != AUTHORITY',
  'ARTIFACT != VERIFIED',
  'DO != DONE',
  'UNKNOWN != PASS',
  'CANDIDATE != PRODUCTION',
  'RECIPE != PROOF',
  'WEAPON != PROVEN',
  'LOADOUT_CHANGE != SAME_RUN',
  'PROOF IS SCOPED',
]);

export function createWeapon({ weaponId, name, purpose, category, capabilityRef } = {}) {
  return freeze({
    weaponId: required(weaponId, 'weaponId'),
    name: required(name, 'name'),
    purpose: required(purpose, 'purpose'),
    category: required(category, 'category'),
    capabilityRef: required(capabilityRef, 'capabilityRef'),
  });
}

export function createWeaponVersion({
  weaponVersionId, weaponId, capabilityRef, implementationRef, contractVersion,
  proofStatus = 'EXPERIMENTAL', inputContract = {}, outputContract = {}, knownLimits = [],
} = {}) {
  if (!ARSENAL_STAGES.includes(text(proofStatus))) throw new Error('WEAPON_PROOF_STATUS_INVALID');
  return freeze({
    weaponVersionId: required(weaponVersionId, 'weaponVersionId'),
    weaponId: required(weaponId, 'weaponId'),
    capabilityRef: required(capabilityRef, 'capabilityRef'),
    implementationRef: required(implementationRef, 'implementationRef'),
    contractVersion: required(contractVersion, 'contractVersion'),
    proofStatus: text(proofStatus),
    inputContract: clone(inputContract),
    outputContract: clone(outputContract),
    knownLimits: unique(knownLimits),
  });
}

export function createWeaponCard({ weapon, activeVersion, goldenRecipeRefs = [], lastProvenContext = null } = {}) {
  if (!weapon?.weaponId || !activeVersion?.weaponVersionId) throw new Error('WEAPON_CARD_BINDING_REQUIRED');
  if (activeVersion.weaponId !== weapon.weaponId) throw new Error('WEAPON_VERSION_MISMATCH');
  return freeze({
    weaponId: weapon.weaponId,
    activeWeaponVersionId: activeVersion.weaponVersionId,
    capabilityRef: activeVersion.capabilityRef,
    implementationRef: activeVersion.implementationRef,
    contractVersion: activeVersion.contractVersion,
    proofStatus: activeVersion.proofStatus,
    goldenRecipeRefs: unique(goldenRecipeRefs),
    lastProvenContext: clone(lastProvenContext),
  });
}

export function createLoadoutVersion({ loadoutId, version, purpose, weaponVersionRefs, contractSnapshot = {}, createdAt = new Date().toISOString(), supersedes = null } = {}) {
  const refs = unique(weaponVersionRefs);
  if (!refs.length) throw new Error('LOADOUT_WEAPONS_REQUIRED');
  return freeze({
    loadoutId: required(loadoutId, 'loadoutId'),
    version: required(version, 'version'),
    purpose: required(purpose, 'purpose'),
    weaponVersionRefs: refs,
    contractSnapshot: clone(contractSnapshot),
    createdAt: required(createdAt, 'createdAt'),
    supersedes: supersedes ? text(supersedes) : null,
  });
}

export function bindExperimentRun({ runId, loadoutVersion, targetRef, roomRef, isolationRef, inputArtifactRefs = [], status = 'ZERO' } = {}) {
  if (!loadoutVersion?.loadoutId || !loadoutVersion?.version) throw new Error('LOADOUT_VERSION_REQUIRED');
  return freeze({
    runId: required(runId, 'runId'),
    loadoutVersionRef: `${loadoutVersion.loadoutId}::${loadoutVersion.version}`,
    weaponVersionSnapshot: [...loadoutVersion.weaponVersionRefs],
    contractSnapshot: clone(loadoutVersion.contractSnapshot),
    targetRef: required(targetRef, 'targetRef'),
    roomRef: required(roomRef, 'roomRef'),
    isolationRef: required(isolationRef, 'isolationRef'),
    inputArtifactRefs: unique(inputArtifactRefs),
    status: required(status, 'status'),
  });
}

export function assertRetestCompatible(run, { loadoutVersionRef, weaponVersionRefs, contractSnapshot } = {}) {
  if (!run || run.loadoutVersionRef !== text(loadoutVersionRef)) return { compatible: false, reason: 'LOADOUT_CHANGE_REQUIRES_NEW_RUN' };
  if (JSON.stringify(run.weaponVersionSnapshot) !== JSON.stringify(unique(weaponVersionRefs))) return { compatible: false, reason: 'WEAPON_VERSION_CHANGE_REQUIRES_NEW_RUN' };
  if (contractSnapshot && JSON.stringify(run.contractSnapshot) !== JSON.stringify(contractSnapshot)) return { compatible: false, reason: 'CONTRACT_CHANGE_REQUIRES_NEW_RUN' };
  return { compatible: true, reason: null };
}

export function createEvidenceBundle({ evidenceBundleId, runRef, loadoutVersionRef, weaponVersionRefs, artifactRefs = [], testResults = [], regressionResults = [], unknowns = [], trustStatus = 'UNKNOWN', generatedAt = new Date().toISOString() } = {}) {
  return freeze({
    evidenceBundleId: required(evidenceBundleId, 'evidenceBundleId'),
    runRef: required(runRef, 'runRef'),
    loadoutVersionRef: required(loadoutVersionRef, 'loadoutVersionRef'),
    weaponVersionRefs: unique(weaponVersionRefs),
    artifactRefs: unique(artifactRefs),
    testResults: clone(testResults),
    regressionResults: clone(regressionResults),
    unknowns: unique(unknowns),
    trustStatus: required(trustStatus, 'trustStatus'),
    generatedAt: required(generatedAt, 'generatedAt'),
  });
}

export function createProvenUnit({ weaponVersionRef, loadoutVersionRef, runRef, recipeRef, evidenceBundleRef, targetContext, scope, limitations = [] } = {}) {
  return freeze({
    weaponVersionRef: required(weaponVersionRef, 'weaponVersionRef'),
    loadoutVersionRef: required(loadoutVersionRef, 'loadoutVersionRef'),
    runRef: required(runRef, 'runRef'),
    recipeRef: required(recipeRef, 'recipeRef'),
    evidenceBundleRef: required(evidenceBundleRef, 'evidenceBundleRef'),
    targetContext: required(targetContext, 'targetContext'),
    scope: required(scope, 'scope'),
    limitations: unique(limitations),
  });
}

export function createPromotionRecord({ promotionId, provenUnitRef, fromStage, toStage, scope, evidenceBundleRef, unknowns = [], promotedBy = 'PIXIE-01' } = {}) {
  if (!ARSENAL_STAGES.includes(text(fromStage)) || !ARSENAL_STAGES.includes(text(toStage))) throw new Error('PROMOTION_STAGE_INVALID');
  if (ARSENAL_STAGES.indexOf(toStage) <= ARSENAL_STAGES.indexOf(fromStage)) throw new Error('PROMOTION_STAGE_NOT_ADVANCED');
  return freeze({
    promotionId: required(promotionId, 'promotionId'),
    provenUnitRef: required(provenUnitRef, 'provenUnitRef'),
    fromStage: text(fromStage),
    toStage: text(toStage),
    scope: required(scope, 'scope'),
    evidenceBundleRef: required(evidenceBundleRef, 'evidenceBundleRef'),
    unknowns: unique(unknowns),
    promotedBy: required(promotedBy, 'promotedBy'),
    authorityTransferred: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export function createHandoffPacket({ handoffId, provenUnitRef, artifactRefs = [], evidenceRefs = [], unknowns = [], destination = 'factory' } = {}) {
  return freeze({
    handoffId: required(handoffId, 'handoffId'),
    provenUnitRef: required(provenUnitRef, 'provenUnitRef'),
    artifactRefs: unique(artifactRefs),
    evidenceRefs: unique(evidenceRefs),
    unknowns: unique(unknowns),
    destination: required(destination, 'destination'),
    authorityTransferred: false,
    routeAuthorityCreated: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export function validateProvenance({ run, evidenceBundle, provenUnit } = {}) {
  const errors = [];
  if (!run?.runId || evidenceBundle?.runRef !== run.runId) errors.push('EVIDENCE_RUN_MISMATCH');
  if (!run?.loadoutVersionRef || evidenceBundle?.loadoutVersionRef !== run.loadoutVersionRef) errors.push('EVIDENCE_LOADOUT_MISMATCH');
  if (!provenUnit?.evidenceBundleRef || provenUnit.evidenceBundleRef !== evidenceBundle?.evidenceBundleId) errors.push('PROVEN_UNIT_EVIDENCE_MISMATCH');
  if (!provenUnit?.runRef || provenUnit.runRef !== run?.runId) errors.push('PROVEN_UNIT_RUN_MISMATCH');
  return { valid: errors.length === 0, errors };
}
