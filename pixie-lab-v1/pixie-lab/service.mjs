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

const clone = (value) => value == null ? value : structuredClone(value);
const text = (value) => String(value ?? '').trim();
const required = (value, label) => { const result = text(value); if (!result) throw new Error(`${label} is required`); return result; };
const nowIso = () => new Date().toISOString();

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
  constructor({ labId = 'PIXIE-LAB', now = nowIso, persistence = null } = {}) {
    this.labId = labId;
    this.now = now;
    this.persistence = persistence || createMemoryPersistence();
    this.testTypes = seedRegistry();
    this.state = {
      labId, pixieId: PIXIE_ID, rooms: createDefaultRooms({ now }).map(clone), roomReports: [], sessions: [], cycles: [],
      matrices: [], testRuns: [], proposals: [], bugs: [], attentions: [], goldenCases: [], regressionAlerts: [],
      memory: [], grants: [], snapshots: [], artifacts: [], passports: [], factorySimulations: [], evidence: [],
      debugSessions: [], selfTests: [], crossRoomChecks: [], contradictions: [],
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
    if (this.session(sessionId)) throw new Error('DUPLICATE_SESSION_ID');
    const session = { sessionId: required(sessionId, 'sessionId'), roomId, purpose: required(purpose, 'purpose'), activityType: required(activityType, 'activityType'), sourceType: required(sourceType, 'sourceType'), subjectRef: text(subjectRef) || null, status: 'ACTIVE', createdAt: this.now() };
    this.state.sessions.push(session); Object.assign(room, { status: 'RESERVED', activeSessionId: session.sessionId, updatedAt: this.now() }); this.assertHealthy(); return clone(session);
  }
  closeSession(sessionId) {
    const session = this.session(sessionId); if (!session) throw new Error('SESSION_NOT_FOUND');
    session.status = 'CLOSED';
    const room = this.room(session.roomId);
    if (room) {
      Object.assign(room, { status: 'ARCHIVE', lifecycleStage: 'ARCHIVE', lifecycleHistory: [...(room.lifecycleHistory || []), 'ARCHIVE'], activeSessionId: null, currentCycleId: null, updatedAt: this.now() });
    }
    this.assertHealthy(); return clone(session);
  }

  advanceRoomLifecycle(roomId, { stage, result = 'PASS', evidence = [], seedRef = null } = {}) {
    const room = this.room(roomId); if (!room) throw new Error('ROOM_NOT_FOUND');
    const current = room.lifecycleStage || room.status; const next = text(stage).toUpperCase();
    const order = {
      ARCHIVE: 'ZERO',
      ZERO: 'STERILIZE',
      STERILIZE: 'VERIFY_CLEAN',
      VERIFY_CLEAN: 'LOAD_CLEAN_SEED',
      LOAD_CLEAN_SEED: 'READY',
      QUARANTINED: 'CLEAN_AGAIN',
      CLEAN_AGAIN: 'ZERO',
    };
    if (next !== order[current]) throw new Error(`ROOM_LIFECYCLE_ORDER_REQUIRED:${order[current] || 'READY'}`);
    const proof = evidence.filter((item) => isVerifiedEvidenceRecord(item));
    const normalizedResult = text(result).toUpperCase();
    const success = normalizedResult === 'PASS' && proof.length > 0 && (next !== 'LOAD_CLEAN_SEED' || Boolean(seedRef));
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
  cycleAction(cycleId, input) { const current = this.cycle(cycleId); if (!current) throw new Error('CYCLE_NOT_FOUND'); const next = applyCycleAction(current, { ...input, now: this.now }); this.state.cycles[this.state.cycles.findIndex((cycle) => cycle.cycleId === cycleId)] = next; const room = this.room(next.roomId); if (room) Object.assign(room, { status: next.state === 'QUARANTINED' ? 'QUARANTINED' : 'RUNNING', updatedAt: this.now() }); this.assertHealthy(); return clone(next); }

  recordEvidence(input) { const evidence = createEvidence({ ...input, capturedAt: input.capturedAt || this.now() }); this.state.evidence.push(evidence); return clone(evidence); }
  sterilize(input) { const result = runSterilization({ ...input, now: this.now }); this.state.evidence.push(...(result.evidence || [])); return clone(result); }

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
  debug(input = {}) { const debug = { debugId: required(input.debugId, 'debugId'), bugId: required(input.bugId, 'bugId'), status: 'OPEN', confidence: 'SUSPECTED', steps: [], regressionRunRefs: [], goldenCaseRefs: [], createdAt: this.now() }; this.state.debugSessions.push(debug); return clone(debug); }
  debugStep(debugId, step = {}) { const debug = this.state.debugSessions.find((item) => item.debugId === debugId); if (!debug) throw new Error('DEBUG_NOT_FOUND'); debug.steps.push({ stepId: required(step.stepId, 'stepId'), action: required(step.action, 'action'), evidenceRefs: step.evidenceRefs || [], observed: clone(step.observed ?? null), at: this.now() });
  if (step.confidence) { const confidence = text(step.confidence).toUpperCase(); if (!['SUSPECTED', 'SUPPORTED', 'CONFIRMED'].includes(confidence)) throw new Error('DEBUG_CONFIDENCE_INVALID'); debug.confidence = confidence; } if (step.regressionRunId) debug.regressionRunRefs.push(step.regressionRunId); if (step.goldenCaseId) debug.goldenCaseRefs.push(step.goldenCaseId); debug.status = 'IN_PROGRESS'; return clone(debug); }
  completeDebug(debugId, { result = 'DEBUG_COMPLETE', regressionRunRefs = [], goldenCaseRefs = [] } = {}) { const debug = this.state.debugSessions.find((item) => item.debugId === debugId); if (!debug) throw new Error('DEBUG_NOT_FOUND'); if (result !== 'DEBUG_COMPLETE') throw new Error('DEBUG_REQUIRES_COMPLETE_RESULT'); debug.status = 'COMPLETE'; debug.confidence = 'CONFIRMED'; debug.result = result; debug.regressionRunRefs = [...new Set([...debug.regressionRunRefs, ...regressionRunRefs])]; debug.goldenCaseRefs = [...new Set([...debug.goldenCaseRefs, ...goldenCaseRefs])]; debug.completedAt = this.now(); return clone(debug); }

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

  runSelfTest({ checks = [] } = {}) { const selfTest = createMasterSelfTest({ selfTestId: `SELF-${this.now()}`, checks, now: this.now }); this.state.selfTests.push(selfTest); return clone(selfTest); }
  runCrossRoom({ subjectRef, observations = [] } = {}) { const distinct = new Set(observations.map((item) => JSON.stringify(item.observed))); const result = { checkId: `CROSS-${this.now()}`, subjectRef, status: observations.some((item) => item.status === 'UNKNOWN') ? 'UNKNOWN' : distinct.size > 1 ? 'FAIL' : 'PASS', observations: clone(observations), at: this.now() }; this.state.crossRoomChecks.push(result); return clone(result); }
  masterGate() { const contradictions = detectContradictions(this.state.roomReports); this.state.contradictions = contradictions; return evaluateMasterGate({ selfTest: this.state.selfTests.at(-1), crossRoom: this.state.crossRoomChecks, contradictions, criticalUnknowns: this.state.roomReports.flatMap((report) => report.unknowns || []).filter((value) => text(value).toLowerCase().includes('critical')) }); }

  async persist() { await this.persistence.save(clone(this.state)); return { status: 'PERSISTED', revision: this.now() }; }
  async rebuildBoard() {
    const canonical = await this.persistence.load();
    if (canonical) {
      this.state = clone(canonical);
      this.state.evidence = (this.state.evidence || []).flatMap((value) => {
        const restored = verifyEvidenceRecord(value, { trustedBy: 'PIXIE_PERSISTENCE' });
        return restored ? [restored] : [];
      });
    }
    return this.board();
  }
  board() { return projectPixieBoard({ rooms: this.state.rooms, roomReports: this.state.roomReports, activeSessions: this.state.sessions.filter((session) => session.status === 'ACTIVE'), tests: [...this.testTypes.values()], matrices: this.state.matrices, runs: this.state.testRuns, bugs: this.state.bugs, goldenCases: this.state.goldenCases, attentions: this.state.attentions, unknowns: this.state.roomReports.flatMap((report) => report.unknowns), artifacts: this.state.artifacts, proposals: this.state.proposals, passports: this.state.passports, regressionAlerts: this.state.regressionAlerts, now: this.now }); }
  guide(question) { const board = this.board(); const q = text(question).toLowerCase(); if (q.includes('unknown')) return createGuideAnswer({ question, answer: `${board.unknowns.length} unknown item(s)`, traceRefs: board.roomReports.map((report) => `report://${report.roomId}`), unknowns: board.unknowns }); if (q.includes('room') || q.includes('ห้อง')) return createGuideAnswer({ question, answer: `${board.rooms.length} room(s), ${board.activeSessions.length} active session(s)`, traceRefs: board.rooms.map((room) => `room://${room.roomId}`) }); if (q.includes('ready')) return createGuideAnswer({ question, answer: `${board.artifacts.filter((artifact) => artifact.status === 'READY_CANDIDATE').length} READY_CANDIDATE artifact(s)`, traceRefs: board.artifacts.map((artifact) => `artifact://${artifact.artifactId}`) }); if (q.includes('bug') || q.includes('บั๊ก')) return createGuideAnswer({ question, answer: `${board.bugs.length} bug capsule(s)`, traceRefs: board.bugs.map((bug) => `bug://${bug.bugId}`) }); return createGuideAnswer({ question, answer: 'UNKNOWN', traceRefs: ['pixie-board://PIXIE-BOARD'], unknowns: ['QUERY_NOT_IMPLEMENTED_IN_V1'] }); }
  warp(input) { return createWarp({ ...input, now: this.now }); }
}
