import {
  PIXIE_ID, ROOM_IDS, TEST_CATEGORIES, createDefaultRooms, createIsolationContext,
  createCycle, applyCycleAction, createEvidence, createSterilizationAdapter, runSterilization,
  createTestType, createTestTypeRegistry, executeTestType, createTestMatrix, updateMatrixStatus,
  startMatrix, createTestRun, rerunTestRun, createTestProposal, decideTestProposal,
  createBugCapsule, createGoAttention, updateGoAttention, createGoldenCase, replayGoldenCase,
  createRegressionAlert, createLabMemoryAsset, createArtifact, verifyDoorGuard,
  createCandidatePassport, createRoomReport, projectPixieBoard, detectContradictions,
  createMasterSelfTest, evaluateMasterGate, createAccessGrant, importSnapshot, isVerifiedEvidenceRecord, verifyEvidenceRecord,
  createCannonProfile, createCannonRun, createFactorySimulation, advanceFactorySimulation,
  createLearningProposal, promoteLearningProposal, createWarp, createGuideAnswer, assertNoModes,
  assertNoExternalAuthority, createMemoryPersistence,
} from './core.mjs';
import {
  DEBUG_ROOM_ID, listExampleExperiments, getExampleExperiment,
} from './lab-zones.mjs';
import {
  createLogicDraft, editLogicDraft, compareLogicDraft,
} from './logic-workbench.mjs';
import {
  createIdea, createExperiment, createVariant, evaluateVariant,
  selectExperimentCandidate, createAppPrototype, recordAppPreview, compareAppPrototypes,
} from './idea-workspace.mjs';
import { createImageActionRequest, acceptImageActionResult } from './image-tool-adapter.mjs';
import { prepareProductionHandoff } from './production-evidence-workbench.mjs';
import { prepareFactoryHandoff } from './production-lane.mjs';
import { getErgasterionCapabilities } from './capabilities.mjs';
import { projectWorkbenchFloor } from './workbench-floor.mjs';
import { openWorkbench } from './workbench-view.mjs';
import { projectCheckpointDock, projectRealityScreen } from './workbench-shared.mjs';
import { projectBigView, projectIntentReview } from './owner-view.mjs';
import {
  inspectCodingWorkbench,
  listCodingFiles,
  readCodingFile,
  searchCodingWorkspace,
  inspectCodingDiff,
  applyCodingChange,
} from './coding-workbench.mjs';
import {
  createRuntimeObservation,
  createRuntimeInteractionReceipt,
  projectRuntimeWorkbench,
  inspectRuntimeExecutor,
  executeRuntimeAction,
} from './runtime-workbench.mjs';
import {
  createDebugInspectionSession,
  appendDebugInspectionStep,
  completeDebugInspectionSession,
} from './debug-inspection-workbench.mjs';
import {
  createVisualDraft, scanVisualDraft, editVisualDraft, compareVisualDraft,
  createVisualRenderPacket, verifyVisualRender,
} from './visual-workbench.mjs';
import {
  createVisualDispatchContract, updateVisualDispatchStatus, createVisualReceipt, importVisualReceipt, buildVisualRecovery,
} from './visual-transport.mjs';

const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const required = (value, label) => { const result = text(value); if (!result) throw new Error(`${label} is required`); return result; };
const nowIso = () => new Date().toISOString();
export const ERGASTERION_STATE_SCHEMA = 'ERGASTERION_STATE_V2';

function seedRegistry() {
  const registry = createTestTypeRegistry();
  for (const category of TEST_CATEGORIES) {
    const id = category.toLowerCase();
    registry.set(id, createTestType({
      testTypeId: id, name: category, category, runner: `runner://${id}`,
      expectedContract: 'expected://result', evidencePolicy: 'trace-everything',
      runnerStatus: ['FUNCTIONAL', 'CONTRACT', 'REGRESSION', 'GOLDEN', 'RECOVERY', 'PERMISSION_BOUNDARY'].includes(category) ? 'V1_CONTRACT_READY' : 'CONTRACT_ONLY',
    }));
  }
  return registry;
}

export class PixieLab {
  constructor({ labId = 'PIXIE-LAB', now = nowIso, persistence = null, evidenceVerifier = null, codingExecutor = null, runtimeExecutor = null } = {}) {
    this.labId = labId;
    this.now = now;
    this.persistence = persistence || createMemoryPersistence();
    this.evidenceVerifier = evidenceVerifier;
    this.codingExecutor = codingExecutor;
    this.runtimeExecutor = runtimeExecutor;
    this.testTypes = seedRegistry();
    this.state = {
      schemaVersion: ERGASTERION_STATE_SCHEMA,
      labId, pixieId: PIXIE_ID, rooms: createDefaultRooms({ now }).map(clone), roomReports: [], sessions: [], cycles: [],
      matrices: [], testRuns: [], proposals: [], bugs: [], attentions: [], goldenCases: [], regressionAlerts: [],
      memory: [], grants: [], snapshots: [], artifacts: [], passports: [], factorySimulations: [], evidence: [],
      debugSessions: [], selfTests: [], crossRoomChecks: [], contradictions: [],
      ideas: [], experiments: [], variants: [], appPrototypes: [],
      logicDrafts: [], productionHandoffs: [], factoryHandoffs: [],
      visualDrafts: [], visualRenderPackets: [], visualVerifications: [],
      imageActions: [], imageReceipts: [],
      visualDispatches: [], visualReceipts: [],
      runtimeObservations: [], runtimeInteractions: [],
      archives: [], cleanRuns: [],
    };
    this.assertHealthy();
  }

  assertHealthy() {
    assertNoModes(this.state);
    if (this.state.pixieId !== PIXIE_ID) throw new Error('PIXIE_IDENTITY_INVALID');
    if (this.state.rooms.length !== ROOM_IDS.length) throw new Error('DEFAULT_ROOM_SET_INVALID');
    assertNoExternalAuthority({ externalWrite: false, productionAuthority: false });
    return true;
  }

  room(roomId) { return this.state.rooms.find((room) => room.roomId === roomId) || null; }
  session(sessionId) { return this.state.sessions.find((session) => session.sessionId === sessionId) || null; }
  cycle(cycleId) { return this.state.cycles.find((cycle) => cycle.cycleId === cycleId) || null; }

  startSession({ roomId, sessionId, purpose, activityType, sourceType = 'LAB_FIXTURE', subjectRef = null } = {}) {
    const room = this.room(required(roomId, 'roomId'));
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.status !== 'READY' || room.activeSessionId) throw new Error('ROOM_NOT_READY');
    if (this.session(sessionId)) throw new Error('DUPLICATE_SESSION_ID');
    const session = { sessionId: required(sessionId, 'sessionId'), roomId, purpose: required(purpose, 'purpose'), activityType: required(activityType, 'activityType'), sourceType: required(sourceType, 'sourceType'), subjectRef: text(subjectRef) || null, status: 'ACTIVE', createdAt: this.now() };
    this.state.sessions.push(session);
    Object.assign(room, { status: 'RESERVED', lifecycleStage: 'READY', activeSessionId: session.sessionId, updatedAt: this.now() });
    this.assertHealthy();
    return clone(session);
  }

  archiveSession(sessionId, { archiveId = null, note = null } = {}) {
    const session = this.session(required(sessionId, 'sessionId'));
    if (!session) throw new Error('SESSION_NOT_FOUND');
    const room = this.room(session.roomId);
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const id = text(archiveId) || `ARCHIVE-${session.sessionId}-${this.now()}`;
    if (this.state.archives.some((item) => item.archiveId === id)) throw new Error('DUPLICATE_ARCHIVE_ID');
    const relatedCycles = this.state.cycles.filter((cycle) => cycle.sessionId === session.sessionId);
    const archive = {
      archiveId: id,
      sessionId: session.sessionId,
      roomId: session.roomId,
      subjectRef: session.subjectRef || null,
      note: text(note) || null,
      sessionSnapshot: clone(session),
      roomSnapshot: clone(room),
      cycleSnapshots: clone(relatedCycles),
      archivedAt: this.now(),
    };
    this.state.archives.push(archive);
    this.assertHealthy();
    return clone(archive);
  }

  closeSession(sessionId) {
    const session = this.session(required(sessionId, 'sessionId'));
    if (!session) throw new Error('SESSION_NOT_FOUND');
    session.status = 'CLOSED';
    session.closedAt = this.now();
    const room = this.room(session.roomId);
    if (room && room.activeSessionId === session.sessionId) {
      Object.assign(room, {
        status: 'DIRTY',
        lifecycleStage: 'DIRTY',
        lifecycleHistory: [...(room.lifecycleHistory || []), 'DIRTY'],
        activeSessionId: null,
        currentCycleId: null,
        updatedAt: this.now(),
      });
    }
    this.assertHealthy();
    return clone(session);
  }

  cleanRoom(roomId, { reason = 'MANUAL_CLEAN', seedRef = null } = {}) {
    const room = this.room(required(roomId, 'roomId'));
    if (!room) throw new Error('ROOM_NOT_FOUND');
    const startedAt = this.now();
    const activeSessionId = room.activeSessionId || null;
    const discardedSessionIds = [];
    const discardedCycleIds = [];

    if (activeSessionId) {
      const activeSession = this.session(activeSessionId);
      if (activeSession) discardedSessionIds.push(activeSession.sessionId);
      for (const cycle of this.state.cycles.filter((item) => item.sessionId === activeSessionId)) discardedCycleIds.push(cycle.cycleId);
      this.state.sessions = this.state.sessions.filter((item) => item.sessionId !== activeSessionId);
      this.state.cycles = this.state.cycles.filter((item) => item.sessionId !== activeSessionId);
    }

    const clearedRoomReports = this.state.roomReports.filter((report) => report.roomId === room.roomId).length;
    this.state.roomReports = this.state.roomReports.filter((report) => report.roomId !== room.roomId);

    const stages = ['ZERO', 'STERILIZE', 'VERIFY_CLEAN', 'LOAD_CLEAN_SEED', 'READY'];
    const cleanSeedRef = text(seedRef) || `pixie-clean-seed://${room.roomId}/${startedAt}`;
    const before = {
      status: room.status,
      lifecycleStage: room.lifecycleStage,
      activeSessionId,
      currentCycleId: room.currentCycleId || null,
    };

    Object.assign(room, {
      status: 'READY',
      lifecycleStage: 'READY',
      lifecycleHistory: [...(room.lifecycleHistory || []), ...stages],
      activeSessionId: null,
      currentCycleId: null,
      cleanSeedRef,
      quarantineReason: null,
      updatedAt: this.now(),
    });

    const cleanRun = {
      cleanId: `CLEAN-${room.roomId}-${startedAt}`,
      roomId: room.roomId,
      status: 'PASS',
      cleanupKind: 'LAB_TRANSIENT_RESET',
      reason: text(reason) || 'MANUAL_CLEAN',
      stages,
      discardedSessionIds,
      discardedCycleIds,
      clearedRoomReports,
      archiveCreated: false,
      cleanSeedRef,
      before,
      after: { status: room.status, lifecycleStage: room.lifecycleStage, activeSessionId: null, currentCycleId: null },
      startedAt,
      completedAt: this.now(),
    };
    this.state.cleanRuns.push(cleanRun);
    this.assertHealthy();
    return clone(cleanRun);
  }

  advanceRoomLifecycle(roomId, { stage, result = 'PASS', evidence = [], seedRef = null } = {}) {
    const room = this.room(roomId); if (!room) throw new Error('ROOM_NOT_FOUND');
    const current = room.lifecycleStage || room.status; const next = text(stage).toUpperCase();
    const order = {
      ARCHIVE: 'ZERO',
      DIRTY: 'ZERO',
      ZERO: 'STERILIZE',
      STERILIZE: 'VERIFY_CLEAN',
      VERIFY_CLEAN: 'LOAD_CLEAN_SEED',
      LOAD_CLEAN_SEED: 'READY',
      QUARANTINED: 'CLEAN_AGAIN',
      CLEAN_AGAIN: 'ZERO',
    };
    if (next !== order[current]) throw new Error(`ROOM_LIFECYCLE_ORDER_REQUIRED:${order[current] || 'READY'}`);
    const proof = evidence.flatMap((item) => {
      if (isVerifiedEvidenceRecord(item)) return [item];
      const restored = verifyEvidenceRecord(item, { trustProvider: this.evidenceVerifier });
      return restored ? [restored] : [];
    });
    const normalizedResult = text(result).toUpperCase();
    const success = normalizedResult === 'PASS' && proof.length > 0 && proof.every((item) => text(item.status).toUpperCase() === 'PASS') && (next !== 'LOAD_CLEAN_SEED' || Boolean(seedRef));
    if (!success) {
      Object.assign(room, { status: 'QUARANTINED', lifecycleStage: 'QUARANTINED', quarantineReason: normalizedResult === 'PASS' ? 'UNVERIFIED_EVIDENCE_OR_SEED' : normalizedResult, lifecycleHistory: [...(room.lifecycleHistory || []), 'QUARANTINED'], updatedAt: this.now() });
      this.assertHealthy(); return clone(room);
    }
    Object.assign(room, { status: next, lifecycleStage: next, cleanSeedRef: next === 'LOAD_CLEAN_SEED' ? seedRef : room.cleanSeedRef || null, lifecycleHistory: [...(room.lifecycleHistory || []), next], updatedAt: this.now() });
    this.assertHealthy(); return clone(room);
  }

  startCycle({ cycleId, subjectRef, roomId, sessionId, logicVersion, fixtureRef, snapshotRef = null, baselineHash, initiatedBy } = {}) {
    const session = this.session(sessionId); if (!session || session.roomId !== roomId || session.status !== 'ACTIVE') throw new Error('SESSION_SCOPE_INVALID');
    const isolation = createIsolationContext({ appId: this.labId, roomId, sessionId, cycleId, fixtureRef, snapshotRef, baselineHash });
    const cycle = createCycle({ cycleId, subjectRef, roomId, sessionId, logicVersion, initiatedBy: initiatedBy || session.roomId.replace('ROOM-', 'PIXIE-'), supervisedBy: PIXIE_ID, isolation, now: this.now });
    this.state.cycles.push(cycle); Object.assign(this.room(roomId), { status: 'RUNNING', currentCycleId: cycle.cycleId, updatedAt: this.now() }); this.assertHealthy(); return clone(cycle);
  }
  cycleAction(cycleId, input) { const current = this.cycle(cycleId); if (!current) throw new Error('CYCLE_NOT_FOUND'); const next = applyCycleAction(current, { ...input, evidenceVerifier: this.evidenceVerifier, now: this.now }); this.state.cycles[this.state.cycles.findIndex((cycle) => cycle.cycleId === cycleId)] = next; const room = this.room(next.roomId); if (room) Object.assign(room, { status: next.state === 'QUARANTINED' ? 'QUARANTINED' : 'RUNNING', updatedAt: this.now() }); this.assertHealthy(); return clone(next); }

  recordEvidence(input) { const evidence = createEvidence({ ...input, capturedAt: input.capturedAt || this.now() }); this.state.evidence.push(evidence); return clone(evidence); }
  acceptVerifiedEvidence(value) { const evidence = verifyEvidenceRecord(value, { trustProvider: this.evidenceVerifier }); if (!evidence) throw new Error('EVIDENCE_VERIFICATION_FAILED'); this.state.evidence.push(evidence); return clone(evidence); }
  sterilize(input) { const result = runSterilization({ ...input, evidenceVerifier: this.evidenceVerifier, now: this.now }); this.state.evidence.push(...(result.evidence || [])); return clone(result); }

  addMatrix(input) { const matrix = createTestMatrix({ ...input, now: this.now }); this.state.matrices.push(matrix); this.assertHealthy(); return clone(matrix); }
  startMatrix(matrixId) { const index = this.state.matrices.findIndex((matrix) => matrix.matrixId === matrixId); if (index < 0) throw new Error('MATRIX_NOT_FOUND'); this.state.matrices[index] = startMatrix(this.state.matrices[index]); return clone(this.state.matrices[index]); }
  updateMatrix(matrixId, rowStatuses) { const index = this.state.matrices.findIndex((matrix) => matrix.matrixId === matrixId); if (index < 0) throw new Error('MATRIX_NOT_FOUND'); this.state.matrices[index] = updateMatrixStatus(this.state.matrices[index], rowStatuses); this.assertHealthy(); return clone(this.state.matrices[index]); }

  addTestRun(input) { const run = createTestRun({ ...input, now: this.now }); this.state.testRuns.push(run); this.refreshRoomResult(run); this.assertHealthy(); return clone(run); }
  rerun(runId, input = {}) { const previous = this.state.testRuns.find((run) => run.runId === runId); if (!previous) throw new Error('TEST_RUN_NOT_FOUND'); const next = rerunTestRun(previous, { ...input, now: this.now }); this.state.testRuns.push(next); this.refreshRoomResult(next); return clone(next); }
  refreshRoomResult(run) { if (!run.roomId) return; const report = this.state.roomReports.find((item) => item.roomId === run.roomId); if (report) report.latestResult = run.status; }
  async execute(testTypeId, context = {}) { const result = await executeTestType(this.testTypes, testTypeId, context); const run = this.addTestRun({ runId: required(context.runId, 'runId'), runClass: context.runClass || 'ROOM_TEST_RUN', initiatedBy: context.initiatedBy || PIXIE_ID, executedBy: context.executedBy || PIXIE_ID, scope: context.scope || 'ROOM', purpose: context.purpose || 'REGISTERED_TEST', roomId: context.roomId, matrixRef: context.matrixRef, testTypeId, logicVersion: context.logicVersion || 'unknown', expected: context.expected, observed: result, status: result.status, evidenceRefs: result.evidenceRefs || [], unknowns: result.status === 'UNKNOWN' ? [result.reason || 'UNKNOWN'] : [] }); return { result, run }; }

  runCannon({ profile, runId, logicVersion, sourceRoomRefs = [], status = 'CANNON_RUNNING', evidenceRefs = [], unknowns = [] } = {}) { const run = createCannonRun({ profile, runId, logicVersion, sourceRoomRefs, status, evidenceRefs, unknowns, now: this.now }); this.state.testRuns.push(run); this.assertHealthy(); return clone(run); }
  proposeTest(input) { const proposal = createTestProposal({ ...input, now: this.now }); this.state.proposals.push(proposal); this.assertHealthy(); return clone(proposal); }
  decideProposal(proposalId, decision) { const index = this.state.proposals.findIndex((proposal) => proposal.proposalId === proposalId); if (index < 0) throw new Error('PROPOSAL_NOT_FOUND'); this.state.proposals[index] = decideTestProposal(this.state.proposals[index], { decision, decidedBy: PIXIE_ID, now: this.now }); this.assertHealthy(); return clone(this.state.proposals[index]); }

  addRoomReport(input) { const report = createRoomReport({ ...input, now: this.now }); const index = this.state.roomReports.findIndex((item) => item.roomId === report.roomId); if (index >= 0) this.state.roomReports[index] = report; else this.state.roomReports.push(report); this.assertHealthy(); return clone(report); }
  addBug(input) { const bug = createBugCapsule({ ...input, now: this.now }); this.state.bugs.push(bug); return clone(bug); }
  addAttention(input) { const attention = createGoAttention({ ...input, now: this.now }); this.state.attentions.push(attention); return clone(attention); }
  updateAttention(attentionId, status, evidenceRefs = []) { const index = this.state.attentions.findIndex((attention) => attention.attentionId === attentionId); if (index < 0) throw new Error('ATTENTION_NOT_FOUND'); this.state.attentions[index] = updateGoAttention(this.state.attentions[index], { status, evidenceRefs, now: this.now }); return clone(this.state.attentions[index]); }

  addGoldenCase(input) { const golden = createGoldenCase({ ...input, now: this.now }); this.state.goldenCases.push(golden); return clone(golden); }
  replayGolden(goldenCaseId, input) { const index = this.state.goldenCases.findIndex((golden) => golden.goldenCaseId === goldenCaseId); if (index < 0) throw new Error('GOLDEN_NOT_FOUND'); const next = replayGoldenCase(this.state.goldenCases[index], { ...input, now: this.now }); this.state.goldenCases[index] = next; if (next.status === 'REGRESSION_CASE') this.state.regressionAlerts.push(createRegressionAlert({ alertId: `ALERT-${input.runId}`, goldenCaseId, ...input, expected: next.expected, observed: input.observed, now: this.now })); return clone(next); }
  addRegressionAlert(input) { const alert = createRegressionAlert({ ...input, now: this.now }); this.state.regressionAlerts.push(alert); return clone(alert); }
  debug(input = {}) {
    const debug = createDebugInspectionSession({ ...input, now: this.now });
    this.state.debugSessions.push(debug);
    return clone(debug);
  }
  debugStep(debugId, step = {}) {
    const index = this.state.debugSessions.findIndex((item) => item.debugId === debugId);
    if (index < 0) throw new Error('DEBUG_NOT_FOUND');
    this.state.debugSessions[index] = appendDebugInspectionStep(this.state.debugSessions[index], step, { now: this.now });
    return clone(this.state.debugSessions[index]);
  }
  completeDebug(debugId, { result = 'DEBUG_COMPLETE', regressionRunRefs = [], goldenCaseRefs = [] } = {}) {
    const index = this.state.debugSessions.findIndex((item) => item.debugId === debugId);
    if (index < 0) throw new Error('DEBUG_NOT_FOUND');
    this.state.debugSessions[index] = completeDebugInspectionSession(
      this.state.debugSessions[index],
      { result, regressionRunRefs, goldenCaseRefs },
      { now: this.now },
    );
    return clone(this.state.debugSessions[index]);
  }

  proposeLearning(input) { const proposal = createLearningProposal({ ...input, now: this.now }); this.state.memory.push(proposal); return clone(proposal); }
  promoteLearning(proposalId) { const index = this.state.memory.findIndex((asset) => asset.proposalId === proposalId || asset.memoryId === proposalId); if (index < 0) throw new Error('LEARNING_PROPOSAL_NOT_FOUND'); this.state.memory[index] = promoteLearningProposal(this.state.memory[index], { promotedBy: PIXIE_ID, now: this.now }); return clone(this.state.memory[index]); }
  addMemory(input) { const memory = createLabMemoryAsset({ ...input, now: this.now }); this.state.memory.push(memory); return clone(memory); }

  grant(input) { const grant = createAccessGrant({ ...input, now: this.now }); this.state.grants.push(grant); return clone(grant); }
  importSnapshot(input) { const snapshot = importSnapshot({ ...input, now: this.now }); this.state.snapshots.push(snapshot); return clone(snapshot); }
  addArtifact(input) { const artifact = createArtifact({ ...input, now: this.now }); this.state.artifacts.push(artifact); return clone(artifact); }
  doorGuard(artifactId, ownerSeal) { return verifyDoorGuard({ artifact: this.state.artifacts.find((item) => item.artifactId === artifactId), ownerSeal }); }
  candidatePassport(artifactId) {
    const artifact = this.state.artifacts.find((item) => item.artifactId === artifactId); if (!artifact) throw new Error('ARTIFACT_NOT_FOUND');
    if (!artifact.matrixRef) throw new Error('ARTIFACT_MATRIX_REF_REQUIRED');
    const matrix = this.state.matrices.find((item) => item.matrixId === artifact.matrixRef); if (!matrix) throw new Error('MATRIX_NOT_FOUND');
    const sourceRunRefs = artifact.testRunRefs.filter((runId) => this.state.testRuns.some((run) => run.runId === runId));
    const passport = createCandidatePassport({ passportId: `PASSPORT-${artifactId}`, artifact, matrixRef: matrix.matrixId, sourceRunRefs, evidenceRefs: artifact.evidenceRefs, matrixStatus: matrix.overallStatus, now: this.now });
    this.state.passports.push(passport); return clone(passport);
  }

  addFactorySimulation(input) { const simulation = createFactorySimulation({ ...input, now: this.now }); this.state.factorySimulations.push(simulation); return clone(simulation); }
  advanceFactorySimulation(simulationId, input) { const index = this.state.factorySimulations.findIndex((simulation) => simulation.simulationId === simulationId); if (index < 0) throw new Error('FACTORY_SIMULATION_NOT_FOUND'); this.state.factorySimulations[index] = advanceFactorySimulation(this.state.factorySimulations[index], { ...input, now: this.now }); return clone(this.state.factorySimulations[index]); }

  examples() { return listExampleExperiments(); }
  runExample({ exampleId, experimentId = null } = {}) {
    const example = getExampleExperiment(exampleId);
    return this.runCrossRoom({
      experimentId: experimentId || `EXAMPLE-${example.exampleId}-${this.now()}`,
      subjectRef: example.subjectRef,
      observations: example.observations,
      source: `example-zone://${example.exampleId}`,
    });
  }

  capabilities() { return getErgasterionCapabilities(); }
  workbenchFloor() { return projectWorkbenchFloor({ state: this.state, capabilities: getErgasterionCapabilities(), now: this.now }); }
  openWorkbench(workbenchId, selector = {}) { return openWorkbench({ workbenchId, state: this.state, capabilities: getErgasterionCapabilities(), selector, now: this.now }); }
  checkpointDock(selector = {}) { return projectCheckpointDock({ state: this.state, selector, now: this.now }); }
  realityScreen(selector = {}) { return projectRealityScreen({ state: this.state, selector, now: this.now }); }
  bigView(selector = {}) { return projectBigView({ state: this.state, selector, now: this.now }); }
  intentReview(selector = {}) { return projectIntentReview({ state: this.state, selector, now: this.now }); }
  async codingStatus() { return inspectCodingWorkbench({ executor: this.codingExecutor }); }
  async codingList(input = {}) { return listCodingFiles({ executor: this.codingExecutor, ...input }); }
  async codingRead(input = {}) { return readCodingFile({ executor: this.codingExecutor, ...input }); }
  async codingSearch(input = {}) { return searchCodingWorkspace({ executor: this.codingExecutor, ...input }); }
  async codingDiff(input = {}) { return inspectCodingDiff({ executor: this.codingExecutor, ...input }); }
  async codingApply(input = {}) {
    return applyCodingChange({
      executor: this.codingExecutor,
      ...input,
    });
  }
  async runtimeStatus() { return inspectRuntimeExecutor({ executor: this.runtimeExecutor }); }
  async runtimeView(selector = {}) {
    const executorStatus = this.runtimeExecutor && typeof this.runtimeExecutor.status === 'function'
      ? await this.runtimeExecutor.status()
      : null;
    return projectRuntimeWorkbench({ state: this.state, selector, executorStatus, now: this.now });
  }
  recordRuntimeObservation(input = {}) {
    if (this.state.runtimeObservations.some((item) => item.observationId === input.observationId)) throw new Error('DUPLICATE_RUNTIME_OBSERVATION_ID');
    const observation = createRuntimeObservation({ ...input, now: this.now });
    if (observation.prototypeId && !this.state.appPrototypes.some((item) => item.prototypeId === observation.prototypeId)) {
      throw new Error('APP_PROTOTYPE_NOT_FOUND');
    }
    this.state.runtimeObservations.push(observation);
    return clone(observation);
  }
  recordRuntimeInteraction(input = {}) {
    if (this.state.runtimeInteractions.some((item) => item.interactionId === input.interactionId)) throw new Error('DUPLICATE_RUNTIME_INTERACTION_ID');
    if (input.observationId && !this.state.runtimeObservations.some((item) => item.observationId === input.observationId)) {
      throw new Error('RUNTIME_OBSERVATION_NOT_FOUND');
    }
    const receipt = createRuntimeInteractionReceipt({ ...input, now: this.now });
    this.state.runtimeInteractions.push(receipt);
    return clone(receipt);
  }
  async runtimeAction(action = {}) { return executeRuntimeAction({ executor: this.runtimeExecutor, action }); }

  createIdea(input = {}) {
    if (this.state.ideas.some((item) => item.ideaId === input.ideaId)) throw new Error('DUPLICATE_IDEA_ID');
    const idea = createIdea({ ...input, now: this.now });
    this.state.ideas.push(idea);
    return clone(idea);
  }
  createExperiment(input = {}) {
    if (!this.state.ideas.some((item) => item.ideaId === input.ideaId)) throw new Error('IDEA_NOT_FOUND');
    if (this.state.experiments.some((item) => item.experimentId === input.experimentId)) throw new Error('DUPLICATE_EXPERIMENT_ID');
    const experiment = createExperiment({ ...input, now: this.now });
    this.state.experiments.push(experiment);
    const ideaIndex = this.state.ideas.findIndex((item) => item.ideaId === experiment.ideaId);
    const idea = this.state.ideas[ideaIndex];
    this.state.ideas[ideaIndex] = Object.freeze({ ...clone(idea), experimentRefs: [...(idea.experimentRefs || []), experiment.experimentId], updatedAt: this.now() });
    return clone(experiment);
  }
  createVariant(input = {}) {
    const experimentIndex = this.state.experiments.findIndex((item) => item.experimentId === input.experimentId);
    if (experimentIndex < 0) throw new Error('EXPERIMENT_NOT_FOUND');
    if (this.state.variants.some((item) => item.variantId === input.variantId)) throw new Error('DUPLICATE_VARIANT_ID');
    const experiment = this.state.experiments[experimentIndex];
    const variant = createVariant({ ...input, kind: input.kind || experiment.kind, now: this.now });
    this.state.variants.push(variant);
    this.state.experiments[experimentIndex] = Object.freeze({ ...clone(experiment), variantRefs: [...(experiment.variantRefs || []), variant.variantId], updatedAt: this.now() });
    return clone(variant);
  }
  evaluateVariant(variantId, input = {}) {
    const index = this.state.variants.findIndex((item) => item.variantId === variantId);
    if (index < 0) throw new Error('VARIANT_NOT_FOUND');
    this.state.variants[index] = evaluateVariant(this.state.variants[index], { ...input, now: this.now });
    return clone(this.state.variants[index]);
  }
  selectExperimentCandidate(experimentId, variantId, input = {}) {
    const experimentIndex = this.state.experiments.findIndex((item) => item.experimentId === experimentId);
    if (experimentIndex < 0) throw new Error('EXPERIMENT_NOT_FOUND');
    const variant = this.state.variants.find((item) => item.variantId === variantId);
    if (!variant) throw new Error('VARIANT_NOT_FOUND');
    this.state.experiments[experimentIndex] = selectExperimentCandidate(this.state.experiments[experimentIndex], variant, { ...input, now: this.now });
    const experiment = this.state.experiments[experimentIndex];
    const ideaIndex = this.state.ideas.findIndex((item) => item.ideaId === experiment.ideaId);
    if (ideaIndex >= 0) {
      const idea = this.state.ideas[ideaIndex];
      this.state.ideas[ideaIndex] = Object.freeze({ ...clone(idea), selectedExperimentId: experiment.experimentId, updatedAt: this.now() });
    }
    return clone(experiment);
  }
  createAppPrototype(input = {}) {
    const experiment = this.state.experiments.find((item) => item.experimentId === input.experimentId);
    if (!experiment) throw new Error('EXPERIMENT_NOT_FOUND');
    const variant = this.state.variants.find((item) => item.variantId === input.variantId);
    if (!variant || variant.experimentId !== experiment.experimentId) throw new Error('VARIANT_EXPERIMENT_MISMATCH');
    if (variant.kind !== 'APP') throw new Error('APP_VARIANT_REQUIRED');
    if (this.state.appPrototypes.some((item) => item.prototypeId === input.prototypeId)) throw new Error('DUPLICATE_APP_PROTOTYPE_ID');
    const prototype = createAppPrototype({ ...input, now: this.now });
    this.state.appPrototypes.push(prototype);
    return clone(prototype);
  }
  recordAppPreview(prototypeId, input = {}) {
    const index = this.state.appPrototypes.findIndex((item) => item.prototypeId === prototypeId);
    if (index < 0) throw new Error('APP_PROTOTYPE_NOT_FOUND');
    this.state.appPrototypes[index] = recordAppPreview(this.state.appPrototypes[index], { ...input, now: this.now });
    return clone(this.state.appPrototypes[index]);
  }

  compareAppPrototypes(leftPrototypeId, rightPrototypeId, input = {}) {
    const left = this.state.appPrototypes.find((item) => item.prototypeId === leftPrototypeId);
    const right = this.state.appPrototypes.find((item) => item.prototypeId === rightPrototypeId);
    if (!left || !right) throw new Error('APP_PROTOTYPE_NOT_FOUND');
    return compareAppPrototypes(left, right, { ...input, now: this.now });
  }

  createLogicDraft(input = {}) {
    if (this.state.logicDrafts.some((item) => item.draftId === input.draftId)) throw new Error('DUPLICATE_LOGIC_DRAFT_ID');
    if (input.variantId && !input.experimentId) throw new Error('EXPERIMENT_ID_REQUIRED_FOR_VARIANT');
    if (input.experimentId) {
      const experiment = this.state.experiments.find((item) => item.experimentId === input.experimentId);
      if (!experiment) throw new Error('EXPERIMENT_NOT_FOUND');
      if (input.variantId) {
        const variant = this.state.variants.find((item) => item.variantId === input.variantId && item.experimentId === experiment.experimentId);
        if (!variant) throw new Error('VARIANT_EXPERIMENT_MISMATCH');
        if (!['LOGIC', 'GENERAL'].includes(variant.kind)) throw new Error('LOGIC_VARIANT_REQUIRED');
      }
    }
    const draft = createLogicDraft({ ...input, now: this.now });
    this.state.logicDrafts.push(draft);
    return clone(draft);
  }
  editLogicDraft(draftId, edit = {}) {
    const index = this.state.logicDrafts.findIndex((item) => item.draftId === draftId);
    if (index < 0) throw new Error('LOGIC_DRAFT_NOT_FOUND');
    this.state.logicDrafts[index] = editLogicDraft(this.state.logicDrafts[index], edit, { now: this.now });
    return clone(this.state.logicDrafts[index]);
  }
  compareLogicDraft(draftId) {
    const draft = this.state.logicDrafts.find((item) => item.draftId === draftId);
    if (!draft) throw new Error('LOGIC_DRAFT_NOT_FOUND');
    return compareLogicDraft(draft);
  }

  createVisualDraft(input = {}) {
    if (this.state.visualDrafts.some((item) => item.visualDraftId === input.visualDraftId)) throw new Error('DUPLICATE_VISUAL_DRAFT_ID');
    if (input.variantId && !input.experimentId) throw new Error('EXPERIMENT_ID_REQUIRED_FOR_VARIANT');
    if (input.experimentId) {
      const experiment = this.state.experiments.find((item) => item.experimentId === input.experimentId);
      if (!experiment) throw new Error('EXPERIMENT_NOT_FOUND');
      if (input.variantId) {
        const variant = this.state.variants.find((item) => item.variantId === input.variantId && item.experimentId === experiment.experimentId);
        if (!variant) throw new Error('VARIANT_EXPERIMENT_MISMATCH');
        if (!['VISUAL', 'GENERAL'].includes(variant.kind)) throw new Error('VISUAL_VARIANT_REQUIRED');
      }
    }
    const draft = createVisualDraft({ ...input, now: this.now });
    this.state.visualDrafts.push(draft);
    return clone(draft);
  }
  scanVisualDraft(visualDraftId, scan = {}) {
    const index = this.state.visualDrafts.findIndex((item) => item.visualDraftId === visualDraftId);
    if (index < 0) throw new Error('VISUAL_DRAFT_NOT_FOUND');
    this.state.visualDrafts[index] = scanVisualDraft(this.state.visualDrafts[index], { ...scan, now: this.now });
    return clone(this.state.visualDrafts[index]);
  }
  editVisualDraft(visualDraftId, edit = {}) {
    const index = this.state.visualDrafts.findIndex((item) => item.visualDraftId === visualDraftId);
    if (index < 0) throw new Error('VISUAL_DRAFT_NOT_FOUND');
    this.state.visualDrafts[index] = editVisualDraft(this.state.visualDrafts[index], edit, { now: this.now });
    return clone(this.state.visualDrafts[index]);
  }
  compareVisualDraft(visualDraftId) {
    const draft = this.state.visualDrafts.find((item) => item.visualDraftId === visualDraftId);
    if (!draft) throw new Error('VISUAL_DRAFT_NOT_FOUND');
    return compareVisualDraft(draft);
  }
  createVisualRenderPacket(visualDraftId, packet = {}) {
    const draftIndex = this.state.visualDrafts.findIndex((item) => item.visualDraftId === visualDraftId);
    if (draftIndex < 0) throw new Error('VISUAL_DRAFT_NOT_FOUND');
    const result = createVisualRenderPacket(this.state.visualDrafts[draftIndex], { ...packet, now: this.now });
    if (this.state.visualRenderPackets.some((item) => item.packetId === result.packetId)) throw new Error('DUPLICATE_VISUAL_PACKET_ID');
    this.state.visualRenderPackets.push(result);
    const draft = this.state.visualDrafts[draftIndex];
    this.state.visualDrafts[draftIndex] = Object.freeze({ ...clone(draft), renderPacketRefs: [...(draft.renderPacketRefs || []), result.packetId], updatedAt: this.now() });
    return clone(result);
  }
  verifyVisualRender(packetId, verification = {}) {
    const packet = this.state.visualRenderPackets.find((item) => item.packetId === packetId);
    if (!packet) throw new Error('VISUAL_RENDER_PACKET_NOT_FOUND');
    const result = verifyVisualRender(packet, { ...verification, now: this.now });
    if (this.state.visualVerifications.some((item) => item.verificationId === result.verificationId)) throw new Error('DUPLICATE_VISUAL_VERIFICATION_ID');
    this.state.visualVerifications.push(result);
    return clone(result);
  }

  createImageAction(packetId, input = {}) {
    const packet = this.state.visualRenderPackets.find((item) => item.packetId === packetId);
    if (!packet) throw new Error('VISUAL_RENDER_PACKET_NOT_FOUND');
    const existing = this.state.imageActions.find((item) => item.actionId === input.actionId);
    if (existing) return clone(existing);
    const request = createImageActionRequest(packet, { ...input, now: this.now });
    this.state.imageActions.push(request);
    return clone(request);
  }
  acceptImageResult(actionId, input = {}) {
    const request = this.state.imageActions.find((item) => item.actionId === actionId);
    if (!request) throw new Error('IMAGE_ACTION_NOT_FOUND');
    const existing = this.state.imageReceipts.find((item) => item.actionId === actionId);
    if (existing) return clone(existing);
    const receipt = acceptImageActionResult(request, { ...input, now: this.now });
    this.state.imageReceipts.push(receipt);
    return clone(receipt);
  }

  createVisualDispatch(visualDraftId, input = {}) {
    const draft = this.state.visualDrafts.find((item) => item.visualDraftId === visualDraftId);
    if (!draft) throw new Error('VISUAL_DRAFT_NOT_FOUND');
    const packet = this.state.visualRenderPackets.find((item) => item.packetId === input.packetId);
    if (!packet) throw new Error('VISUAL_RENDER_PACKET_NOT_FOUND');
    if (packet.visualDraftId !== visualDraftId) throw new Error('VISUAL_DISPATCH_DRAFT_MISMATCH');
    if (String(input.actionType || '').toUpperCase() === 'EDIT') {
      const target = text(input.targetResultRef);
      if (target && !(draft.workingSpec?.spatial?.resultRefs || []).includes(target)) throw new Error('VISUAL_EDIT_TARGET_NOT_FOUND');
    }
    if (this.state.visualDispatches.some((item) => item.dispatchId === input.dispatchId)) throw new Error('DUPLICATE_VISUAL_DISPATCH_ID');
    const dispatch = createVisualDispatchContract(packet, { ...input, visualDraftId, now: this.now });
    this.state.visualDispatches.push(dispatch);
    const request = this.createImageAction(packet.packetId, {
      actionId: dispatch.dispatchId,
      workId: dispatch.workId,
      checkpointId: dispatch.checkpointId,
      requestedBy: dispatch.requestedBy,
    });
    const sent = updateVisualDispatchStatus(dispatch, 'SENT', { providerJobId: request.actionId, now: this.now });
    this.state.visualDispatches[this.state.visualDispatches.length - 1] = Object.freeze({ ...sent, imageActionId: request.actionId });
    return clone(this.state.visualDispatches.at(-1));
  }

  updateVisualDispatch(dispatchId, input = {}) {
    const index = this.state.visualDispatches.findIndex((item) => item.dispatchId === dispatchId);
    if (index < 0) throw new Error('VISUAL_DISPATCH_NOT_FOUND');
    this.state.visualDispatches[index] = updateVisualDispatchStatus(this.state.visualDispatches[index], input.status, { ...input, now: this.now });
    return clone(this.state.visualDispatches[index]);
  }

  createVisualReceipt(dispatchId, input = {}) {
    const dispatch = this.state.visualDispatches.find((item) => item.dispatchId === dispatchId);
    if (!dispatch) throw new Error('VISUAL_DISPATCH_NOT_FOUND');
    if (this.state.visualReceipts.some((item) => item.receiptId === input.receiptId)) throw new Error('DUPLICATE_VISUAL_RECEIPT_ID');
    if (this.state.visualReceipts.some((item) => item.dispatchId === dispatchId)) throw new Error('VISUAL_RECEIPT_DUPLICATE_DISPATCH');
    const received = createVisualReceipt(dispatch, { ...input, dispatchId, status: input.status || 'RECEIVED', now: this.now });
    this.state.visualReceipts.push(received);
    if (received.status === 'RECEIVED' && received.artifactRef) {
      const draftIndex = this.state.visualDrafts.findIndex((item) => item.visualDraftId === received.visualDraftId);
      if (draftIndex < 0) throw new Error('VISUAL_DRAFT_NOT_FOUND');
      const imported = importVisualReceipt(this.state.visualDrafts[draftIndex], received, { now: this.now });
      this.state.visualDrafts[draftIndex] = imported.draft;
      const linked = Object.freeze({ ...received, status: 'LINKED' });
      this.state.visualReceipts[this.state.visualReceipts.length - 1] = linked;
      const dispatchIndex = this.state.visualDispatches.findIndex((item) => item.dispatchId === dispatchId);
      this.state.visualDispatches[dispatchIndex] = updateVisualDispatchStatus(this.state.visualDispatches[dispatchIndex], 'RECEIVED', { providerJobId: received.providerJobId, evidenceRefs: received.evidenceRefs, now: this.now });
      return clone(linked);
    }
    return clone(received);
  }

  importVisualResult(receiptId, input = {}) {
    const receiptIndex = this.state.visualReceipts.findIndex((item) => item.receiptId === receiptId);
    if (receiptIndex < 0) throw new Error('VISUAL_RECEIPT_NOT_FOUND');
    const receipt = this.state.visualReceipts[receiptIndex];
    const draftIndex = this.state.visualDrafts.findIndex((item) => item.visualDraftId === receipt.visualDraftId);
    if (draftIndex < 0) throw new Error('VISUAL_DRAFT_NOT_FOUND');
    const imported = importVisualReceipt(this.state.visualDrafts[draftIndex], receipt, { placeOnTable: input.placeOnTable === true, now: this.now });
    this.state.visualDrafts[draftIndex] = imported.draft;
    return clone({ receipt: this.state.visualReceipts[receiptIndex], draft: this.state.visualDrafts[draftIndex], resultRef: imported.resultRef, placedOnTable: imported.placedOnTable });
  }

  retryVisualDispatch(dispatchId, input = {}) {
    const previous = this.state.visualDispatches.find((item) => item.dispatchId === dispatchId);
    if (!previous) throw new Error('VISUAL_DISPATCH_NOT_FOUND');
    const packet = this.state.visualRenderPackets.find((item) => item.packetId === previous.packetId);
    if (!packet) throw new Error('VISUAL_RENDER_PACKET_NOT_FOUND');
    return this.createVisualDispatch(previous.visualDraftId, {
      ...input,
      dispatchId: required(input.dispatchId, 'dispatchId'),
      packetId: previous.packetId,
      branchId: previous.branchId,
      workId: input.workId || previous.workId,
      checkpointId: input.checkpointId || previous.checkpointId,
      actionType: input.actionType || previous.actionType,
      sourceResultRefs: input.sourceResultRefs || previous.sourceResultRefs,
      targetResultRef: input.targetResultRef || previous.targetResultRef,
      requestedBy: input.requestedBy || previous.requestedBy,
      attempt: previous.attempt + 1,
      retryOfDispatchId: previous.dispatchId,
    });
  }

  recoverVisualWork(visualDraftId) {
    const draft = this.state.visualDrafts.find((item) => item.visualDraftId === visualDraftId) || null;
    return clone(buildVisualRecovery({ draft, dispatches: this.state.visualDispatches, receipts: this.state.visualReceipts }));
  }

  visualLineage(visualDraftId) {
    const draft = this.state.visualDrafts.find((item) => item.visualDraftId === visualDraftId);
    if (!draft) throw new Error('VISUAL_DRAFT_NOT_FOUND');
    const packetIds = new Set(this.state.visualRenderPackets.filter((item) => item.visualDraftId === visualDraftId).map((item) => item.packetId));
    const dispatches = this.state.visualDispatches.filter((item) => packetIds.has(item.packetId));
    const dispatchIds = new Set(dispatches.map((item) => item.dispatchId));
    const receipts = this.state.visualReceipts.filter((item) => dispatchIds.has(item.dispatchId));
    return clone({ visualDraftId, branchId: draft.workingSpec?.spatial?.branch?.branchId || null, draft: { visualDraftId, parentVisualDraftId: draft.parentVisualDraftId || null, lineage: draft.lineage || null }, packets: this.state.visualRenderPackets.filter((item) => packetIds.has(item.packetId)), dispatches, receipts, resultProvenance: draft.workingSpec?.spatial?.resultProvenance || [] });
  }

  prepareProductionHandoff(input = {}) {
    const experiment = this.state.experiments.find((item) => item.experimentId === input.experimentId);
    if (!experiment) throw new Error('EXPERIMENT_NOT_FOUND');
    const variant = this.state.variants.find((item) => item.variantId === input.variantId && item.experimentId === experiment.experimentId);
    if (!variant) throw new Error('VARIANT_EXPERIMENT_MISMATCH');
    if (this.state.productionHandoffs.some((item) => item.handoffId === input.handoffId)) throw new Error('DUPLICATE_PRODUCTION_HANDOFF_ID');
    const result = prepareProductionHandoff({ ...input, now: this.now });
    this.state.productionHandoffs.push(result);
    return clone(result);
  }

  factoryHandoff(input = {}) {
    const result = prepareFactoryHandoff({ ...input, now: this.now });
    if (result.status === 'READY_FOR_FACTORY') this.state.factoryHandoffs.push(result);
    return clone(result);
  }

  runSelfTest({ checks = [] } = {}) { const selfTest = createMasterSelfTest({ selfTestId: `SELF-${this.now()}`, checks, now: this.now }); this.state.selfTests.push(selfTest); return clone(selfTest); }
  runCrossRoom({ subjectRef, experimentId = null, observations = [], source = null } = {}) {
    const distinct = new Set(observations.map((item) => JSON.stringify(item.observed)));
    const result = {
      checkId: `CROSS-${this.now()}`,
      experimentId: text(experimentId) || null,
      subjectRef: required(subjectRef, 'subjectRef'),
      source: text(source) || null,
      status: observations.some((item) => text(item.status).toUpperCase() === 'UNKNOWN') ? 'UNKNOWN' : distinct.size > 1 ? 'FAIL' : 'PASS',
      observations: clone(observations),
      at: this.now(),
    };
    this.state.crossRoomChecks.push(result);
    return clone(result);
  }
  masterGate({ subjectRef = null, experimentId = null } = {}) {
    const allChecks = this.state.crossRoomChecks || [];
    const scopedChecks = allChecks.filter((check) => {
      if (text(experimentId)) return check.experimentId === text(experimentId);
      if (text(subjectRef)) return check.subjectRef === text(subjectRef);
      return true;
    });
    const currentCrossRoom = scopedChecks.length ? [scopedChecks.at(-1)] : [];
    const historicalCrossRoom = scopedChecks.slice(0, -1);
    const reports = text(subjectRef)
      ? this.state.roomReports.filter((report) => report.activeSubject === text(subjectRef))
      : this.state.roomReports;
    const contradictions = detectContradictions(reports);
    this.state.contradictions = contradictions;
    const criticalUnknowns = reports
      .flatMap((report) => report.unknowns || [])
      .filter((value) => text(value).toLowerCase().includes('critical'));
    const gate = evaluateMasterGate({
      selfTest: this.state.selfTests.at(-1),
      crossRoom: currentCrossRoom,
      contradictions,
      criticalUnknowns,
    });
    return {
      ...gate,
      scope: {
        experimentId: text(experimentId) || currentCrossRoom[0]?.experimentId || null,
        subjectRef: text(subjectRef) || currentCrossRoom[0]?.subjectRef || null,
        mode: 'LATEST_RELEVANT_CHECK',
      },
      evaluatedCrossRoomRefs: currentCrossRoom.map((check) => check.checkId),
      historicalCrossRoomRefs: historicalCrossRoom.map((check) => ({ checkId: check.checkId, status: check.status, at: check.at })),
      historyRetained: true,
      explanation: {
        currentCrossRoomStatus: currentCrossRoom[0]?.status || null,
        contradictionCount: contradictions.length,
        criticalUnknownCount: criticalUnknowns.length,
        staleFailuresIgnoredForCurrentGate: historicalCrossRoom.filter((check) => check.status === 'FAIL').length,
      },
    };
  }

  async persist() { await this.persistence.save(clone(this.state)); return { status: 'PERSISTED', revision: this.now() }; }
  async rebuildBoard() {
    const canonical = await this.persistence.load();
    if (canonical) {
      this.state = clone(canonical);
      this.state.schemaVersion = ERGASTERION_STATE_SCHEMA;
      const defaultRooms = createDefaultRooms({ now: this.now }).map(clone);
      this.state.rooms = Array.isArray(this.state.rooms) ? this.state.rooms : [];
      for (const room of defaultRooms) if (!this.state.rooms.some((item) => item.roomId === room.roomId)) this.state.rooms.push(room);
      this.state.roomReports = Array.isArray(this.state.roomReports) ? this.state.roomReports : [];
      this.state.sessions = Array.isArray(this.state.sessions) ? this.state.sessions : [];
      this.state.crossRoomChecks = Array.isArray(this.state.crossRoomChecks) ? this.state.crossRoomChecks : [];
      this.state.ideas = Array.isArray(this.state.ideas) ? this.state.ideas : [];
      this.state.experiments = Array.isArray(this.state.experiments) ? this.state.experiments : [];
      this.state.variants = Array.isArray(this.state.variants) ? this.state.variants : [];
      this.state.appPrototypes = Array.isArray(this.state.appPrototypes) ? this.state.appPrototypes : [];
      this.state.logicDrafts = Array.isArray(this.state.logicDrafts) ? this.state.logicDrafts : [];
      this.state.productionHandoffs = Array.isArray(this.state.productionHandoffs) ? this.state.productionHandoffs : [];
      this.state.factoryHandoffs = Array.isArray(this.state.factoryHandoffs) ? this.state.factoryHandoffs : [];
      this.state.visualDrafts = Array.isArray(this.state.visualDrafts) ? this.state.visualDrafts : [];
      this.state.visualRenderPackets = Array.isArray(this.state.visualRenderPackets) ? this.state.visualRenderPackets : [];
      this.state.visualVerifications = Array.isArray(this.state.visualVerifications) ? this.state.visualVerifications : [];
      this.state.imageActions = Array.isArray(this.state.imageActions) ? this.state.imageActions : [];
      this.state.imageReceipts = Array.isArray(this.state.imageReceipts) ? this.state.imageReceipts : [];
      this.state.visualDispatches = Array.isArray(this.state.visualDispatches) ? this.state.visualDispatches : [];
      this.state.visualReceipts = Array.isArray(this.state.visualReceipts) ? this.state.visualReceipts : [];
      this.state.runtimeObservations = Array.isArray(this.state.runtimeObservations) ? this.state.runtimeObservations : [];
      this.state.runtimeInteractions = Array.isArray(this.state.runtimeInteractions) ? this.state.runtimeInteractions : [];
      this.state.archives = Array.isArray(this.state.archives) ? this.state.archives : [];
      this.state.cleanRuns = Array.isArray(this.state.cleanRuns) ? this.state.cleanRuns : [];
      this.state.evidence = (this.state.evidence || []).flatMap((value) => {
        const restored = verifyEvidenceRecord(value, { trustProvider: this.evidenceVerifier });
        return restored ? [restored] : [];
      });
    }
    return this.board();
  }
  board() {
    const base = projectPixieBoard({ rooms: this.state.rooms, roomReports: this.state.roomReports, activeSessions: this.state.sessions.filter((session) => session.status === 'ACTIVE'), tests: [...this.testTypes.values()], matrices: this.state.matrices, runs: this.state.testRuns, bugs: this.state.bugs, goldenCases: this.state.goldenCases, attentions: this.state.attentions, unknowns: this.state.roomReports.flatMap((report) => report.unknowns), artifacts: this.state.artifacts, proposals: this.state.proposals, passports: this.state.passports, regressionAlerts: this.state.regressionAlerts, now: this.now });
    return {
      ...base,
      zones: {
        compatibilityOnly: true,
        experimentRooms: this.state.rooms.filter((room) => room.roomId !== DEBUG_ROOM_ID).map((room) => room.roomId),
        debugRoom: DEBUG_ROOM_ID,
        ideaWorkspace: 'ACTIVE',
        appPlayground: 'ACTIVE',
        logicWorkbench: 'ACTIVE',
        visualWorkbench: 'ACTIVE',
        imageBridge: 'ACTIVE',
        exampleZone: 'ACTIVE',
        archiveZone: 'ACTIVE',
        roomCleaner: 'ACTIVE',
      },
      workbenchLayout: clone(getErgasterionCapabilities().layout),
      capabilities: getErgasterionCapabilities(),
      runtime: {
        schemaVersion: this.state.schemaVersion || ERGASTERION_STATE_SCHEMA,
        legacyCompatibilityPath: 'pixie-lab-v1',
      },
      crossRoomChecks: clone(this.state.crossRoomChecks || []),
      ideas: clone(this.state.ideas || []),
      experiments: clone(this.state.experiments || []),
      variants: clone(this.state.variants || []),
      appPrototypes: clone(this.state.appPrototypes || []),
      logicWorkbench: clone(this.state.logicDrafts || []),
      visualWorkbench: clone(this.state.visualDrafts || []),
      visualRenderPackets: clone(this.state.visualRenderPackets || []),
      visualVerifications: clone(this.state.visualVerifications || []),
      imageActions: clone(this.state.imageActions || []),
      imageReceipts: clone(this.state.imageReceipts || []),
      visualDispatches: clone(this.state.visualDispatches || []),
      visualReceipts: clone(this.state.visualReceipts || []),
      runtimeObservations: clone(this.state.runtimeObservations || []),
      runtimeInteractions: clone(this.state.runtimeInteractions || []),
      archives: clone(this.state.archives || []),
      cleanRuns: clone(this.state.cleanRuns || []),
      exampleZone: listExampleExperiments(),
      productionHandoffs: clone(this.state.productionHandoffs || []),
      factoryHandoffs: clone(this.state.factoryHandoffs || []),
      counts: {
        ...base.counts,
        crossRoomChecks: (this.state.crossRoomChecks || []).length,
        ideas: (this.state.ideas || []).length,
        experiments: (this.state.experiments || []).length,
        variants: (this.state.variants || []).length,
        appPrototypes: (this.state.appPrototypes || []).length,
        logicDrafts: (this.state.logicDrafts || []).length,
        visualDrafts: (this.state.visualDrafts || []).length,
        visualRenderPackets: (this.state.visualRenderPackets || []).length,
        visualVerifications: (this.state.visualVerifications || []).length,
        imageActions: (this.state.imageActions || []).length,
        imageReceipts: (this.state.imageReceipts || []).length,
        visualDispatches: (this.state.visualDispatches || []).length,
        visualReceipts: (this.state.visualReceipts || []).length,
        runtimeObservations: (this.state.runtimeObservations || []).length,
        runtimeInteractions: (this.state.runtimeInteractions || []).length,
        archives: (this.state.archives || []).length,
        cleanRuns: (this.state.cleanRuns || []).length,
        examples: listExampleExperiments().length,
        productionHandoffs: (this.state.productionHandoffs || []).length,
        factoryHandoffs: (this.state.factoryHandoffs || []).length,
      },
    };
  }
  guide(question) {
    const board = this.board();
    const q = text(question).toLowerCase();
    if (q.includes('unknown')) return createGuideAnswer({ question, answer: `${board.unknowns.length} unknown item(s)`, traceRefs: board.roomReports.map((report) => `report://${report.roomId}`), unknowns: board.unknowns });
    if (q.includes('archive') || q.includes('เก็บ')) return createGuideAnswer({ question, answer: `${board.archives.length} archive snapshot(s); Archive never cleans or closes a room.`, traceRefs: board.archives.map((item) => `archive://${item.archiveId}`) });
    if (q.includes('clean') || q.includes('ล้าง')) return createGuideAnswer({ question, answer: `${board.cleanRuns.length} clean run(s); Clean resets room transient state and never creates an archive.`, traceRefs: board.cleanRuns.map((item) => `clean://${item.cleanId}`) });
    if (q.includes('debug') || q.includes('ดีบั๊ก') || q.includes('ตรวจสอบ')) return createGuideAnswer({ question, answer: `Debug / Inspection Workbench is the current debug surface; ROOM-D remains compatibility-only. ${board.factoryHandoffs.length} legacy Factory handoff record(s)`, traceRefs: ['workbench://DEBUG_INSPECTION_WORKBENCH', 'room://ROOM-D'] });
    if (q.includes('example') || q.includes('ตัวอย่าง')) return createGuideAnswer({ question, answer: `${board.exampleZone.length} reusable example experiment(s)`, traceRefs: board.exampleZone.map((item) => `example://${item.exampleId}`) });
    if (q.includes('ภาพ') || q.includes('visual') || q.includes('วาด') || q.includes('render')) return createGuideAnswer({ question, answer: `${board.visualWorkbench.length} Visual Workbench draft(s), ${board.visualRenderPackets.length} render packet(s), ${board.visualVerifications.length} verification(s)`, traceRefs: board.visualWorkbench.map((item) => `visual-draft://${item.visualDraftId}`) });
    if (q.includes('logic') || q.includes('ลอจิค') || q.includes('โต๊ะ')) return createGuideAnswer({ question, answer: `${board.logicWorkbench.length} Logic Workbench draft(s)`, traceRefs: board.logicWorkbench.map((item) => `logic-draft://${item.draftId}`) });
    if (q.includes('factory') || q.includes('โรงงาน') || q.includes('production')) return createGuideAnswer({ question, answer: `${board.productionHandoffs.length} current production/evidence handoff(s). Handoff carries candidate context and does not create authority. Legacy Debug-to-Factory PASS routing remains compatibility-only.`, traceRefs: board.productionHandoffs.map((item) => `production-handoff://${item.handoffId}`) });
    if (q.includes('room') || q.includes('ห้อง')) return createGuideAnswer({ question, answer: `Experimental Labs are ROOM-A / ROOM-B / ROOM-C. ROOM-D is compatibility-only; ${board.activeSessions.length} active Lab session(s)`, traceRefs: board.rooms.map((room) => `room://${room.roomId}`) });
    if (q.includes('ready')) return createGuideAnswer({ question, answer: `${board.artifacts.filter((artifact) => artifact.status === 'READY_CANDIDATE').length} READY_CANDIDATE artifact(s)`, traceRefs: board.artifacts.map((artifact) => `artifact://${artifact.artifactId}`) });
    if (q.includes('bug') || q.includes('บั๊ก')) return createGuideAnswer({ question, answer: `${board.bugs.length} bug capsule(s)`, traceRefs: board.bugs.map((bug) => `bug://${bug.bugId}`) });
    return createGuideAnswer({ question, answer: 'UNKNOWN', traceRefs: ['pixie-board://PIXIE-BOARD'], unknowns: ['QUERY_NOT_IMPLEMENTED_IN_V1'] });
  }
  warp(input) { return createWarp({ ...input, now: this.now }); }
}
