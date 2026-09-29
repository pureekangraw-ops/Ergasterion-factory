const text = (value) => String(value ?? '').trim();
const list = (value) => Array.isArray(value) ? value : [];
const unique = (values = []) => [...new Set(values.map(text).filter(Boolean))];
const clone = (value) => value == null ? value : structuredClone(value);

function latest(items = []) {
  const values = list(items);
  return values.length ? values.at(-1) : null;
}

function latestPreview(prototypes = []) {
  const previews = list(prototypes).flatMap((prototype) =>
    list(prototype?.previews).map((preview) => ({
      ...clone(preview),
      prototypeId: prototype.prototypeId || null,
      experimentId: prototype.experimentId || null,
      variantId: prototype.variantId || null,
    })),
  );
  return latest(previews);
}

function collectUnknowns(state = {}) {
  return unique([
    ...list(state.roomReports).flatMap((item) => list(item?.unknowns)),
    ...list(state.variants).flatMap((item) => list(item?.unknowns)),
    ...list(state.appPrototypes).flatMap((item) => list(item?.previews).flatMap((preview) => list(preview?.unknowns))),
    ...list(state.visualDrafts).flatMap((item) => list(item?.scans).flatMap((scan) => list(scan?.unknowns))),
    ...list(state.visualRenderPackets).flatMap((item) => list(item?.unknowns)),
    ...list(state.visualVerifications).flatMap((item) => list(item?.unknowns)),
    ...list(state.productionHandoffs).flatMap((item) => list(item?.unknowns)),
  ]);
}

function count(state, key) {
  return list(state?.[key]).length;
}

export const ERGASTERION_WORKBENCH_FLOOR_SCHEMA = 'ERGASTERION_WORKBENCH_FLOOR_V1';

export function projectWorkbenchFloor({
  state = {},
  capabilities = {},
  now = () => new Date().toISOString(),
} = {}) {
  const rooms = list(state.rooms);
  const labIds = list(capabilities.layout?.experimentalLabs).length ? list(capabilities.layout.experimentalLabs) : ['ROOM-A', 'ROOM-B', 'ROOM-C'];
  const experimentalLabs = labIds.map((roomId) => {
    const room = rooms.find((item) => item?.roomId === roomId);
    return {
      roomId,
      status: room?.status || 'UNKNOWN',
      lifecycleStage: room?.lifecycleStage || room?.status || 'UNKNOWN',
      activeSessionId: room?.activeSessionId || null,
      currentCycleId: room?.currentCycleId || null,
    };
  });
  const legacyRoomD = rooms.find((item) => item?.roomId === 'ROOM-D') || null;

  const latestIdea = latest(state.ideas);
  const latestExperiment = latest(state.experiments);
  const latestVariant = latest(state.variants);
  const latestLogic = latest(state.logicDrafts);
  const latestVisual = latest(state.visualDrafts);
  const latestRun = latest(state.testRuns);
  const latestEvidence = latest(state.evidence);
  const latestArtifact = latest(state.artifacts);
  const preview = latestPreview(state.appPrototypes);
  const latestProductionHandoff = latest(state.productionHandoffs);
  const unknowns = collectUnknowns(state);

  return Object.freeze({
    schema: ERGASTERION_WORKBENCH_FLOOR_SCHEMA,
    sourceStateSchema: text(state.schemaVersion) || 'UNKNOWN',
    projectedAt: now(),
    architecture: Object.freeze({
      canonicalUnit: 'WORKBENCH',
      experimentalLabExceptions: Object.freeze([...labIds]),
      pixieRole: 'WORKSHOP_ASSISTANT',
      createsAuthority: false,
      approval: 'NOT_AN_APPROVAL',
    }),
    workbenches: Object.freeze({
      generalIdea: Object.freeze({
        id: 'GENERAL_IDEA_WORKBENCH',
        status: 'ACTIVE',
        source: 'idea-workspace.mjs',
        counts: Object.freeze({
          ideas: count(state, 'ideas'),
          experiments: count(state, 'experiments'),
          variants: count(state, 'variants'),
          appPrototypes: count(state, 'appPrototypes'),
        }),
        current: Object.freeze({
          ideaId: latestIdea?.ideaId || null,
          experimentId: latestExperiment?.experimentId || null,
          variantId: latestVariant?.variantId || null,
          requestedResult: latestIdea?.requestedResult || latestProductionHandoff?.requestedResult || null,
          workId: latestIdea?.workId || latestExperiment?.workId || latestProductionHandoff?.workId || null,
          checkpointId: latestIdea?.checkpointId || latestExperiment?.checkpointId || latestProductionHandoff?.checkpointId || null,
        }),
      }),
      logic: Object.freeze({
        id: 'LOGIC_WORKBENCH',
        status: 'ACTIVE',
        source: 'logic-workbench.mjs',
        migration: 'CANONICAL_WORKBENCH_LEGACY_ALIAS',
        count: count(state, 'logicDrafts'),
        currentDraftId: latestLogic?.draftId || null,
      }),
      visual: Object.freeze({
        id: 'VISUAL_WORKBENCH',
        status: 'ACTIVE',
        source: 'visual-workbench.mjs',
        count: count(state, 'visualDrafts'),
        currentDraftId: latestVisual?.visualDraftId || null,
        renderPacketCount: count(state, 'visualRenderPackets'),
        verificationCount: count(state, 'visualVerifications'),
        imageActionCount: count(state, 'imageActions'),
        imageReceiptCount: count(state, 'imageReceipts'),
      }),
      buildTest: Object.freeze({
        id: 'BUILD_TEST_WORKBENCH',
        status: 'ACTIVE',
        source: 'core.mjs',
        matrixCount: count(state, 'matrices'),
        runCount: count(state, 'testRuns'),
        goldenCount: count(state, 'goldenCases'),
        regressionCount: count(state, 'regressionAlerts'),
        latestRun: latestRun ? Object.freeze({
          runId: latestRun.runId || null,
          status: latestRun.status || 'UNKNOWN',
          testTypeId: latestRun.testTypeId || null,
        }) : null,
      }),
      debugInspection: Object.freeze({
        id: 'DEBUG_INSPECTION_WORKBENCH',
        status: 'ACTIVE',
        source: 'debug-inspection-workbench.mjs',
        debugSessionCount: count(state, 'debugSessions'),
        bugCount: count(state, 'bugs'),
        attentionCount: count(state, 'attentions'),
        legacyRoomPresent: Boolean(legacyRoomD),
      }),
      productionEvidence: Object.freeze({
        id: 'PRODUCTION_EVIDENCE_WORKBENCH',
        status: 'ACTIVE',
        source: 'production-evidence-workbench.mjs',
        handoffCount: count(state, 'productionHandoffs'),
        currentHandoffId: latestProductionHandoff?.handoffId || null,
        authorityTransferred: false,
        routeAuthorityCreated: false,
      }),
      coding: Object.freeze({
        id: 'CODING_WORKBENCH',
        status: 'GAP',
        missing: Object.freeze([
          'REPO_WORKTREE',
          'FILE_TREE',
          'CODE_SEARCH',
          'MULTI_FILE_EDIT',
          'SHELL',
          'DEV_COMMAND_LOOP',
          'GIT_DIFF_STATUS',
          'PR_PREPARATION',
        ]),
      }),
      runtime: Object.freeze({
        id: 'RUNTIME_WORKBENCH',
        status: 'PARTIAL',
        contractSource: 'idea-workspace.mjs',
        prototypeCount: count(state, 'appPrototypes'),
        latestPreview: preview ? Object.freeze({
          prototypeId: preview.prototypeId,
          previewId: preview.previewId || null,
          observedRef: preview.observedRef || null,
          status: preview.status || 'UNKNOWN',
        }) : null,
        missing: Object.freeze([
          'OPEN_RUNTIME',
          'INTERACT_RUNTIME',
          'CONSOLE',
          'NETWORK',
          'RUNTIME_LOGS',
          'DEVICE_INTERACTION_PROOF',
        ]),
      }),
    }),
    labs: Object.freeze({
      experimental: Object.freeze(experimentalLabs),
      legacyDebugRoom: legacyRoomD ? Object.freeze({
        roomId: legacyRoomD.roomId,
        status: legacyRoomD.status || 'UNKNOWN',
        lifecycleStage: legacyRoomD.lifecycleStage || legacyRoomD.status || 'UNKNOWN',
        compatibilityOnly: true,
      }) : null,
    }),
    shared: Object.freeze({
      pixie: Object.freeze({
        id: text(state.pixieId) || 'PIXIE-01',
        role: capabilities?.departments?.pixieLab?.assistant === 'PIXIE' ? 'WORKSHOP_ASSISTANT' : 'UNKNOWN',
        authority: 'NONE',
      }),
      evidence: Object.freeze({
        count: count(state, 'evidence'),
        latestEvidenceId: latestEvidence?.evidenceId || null,
        latestStatus: latestEvidence?.status || 'UNKNOWN',
      }),
      checkpoint: Object.freeze({
        currentWorkId: latestIdea?.workId || latestExperiment?.workId || latestProductionHandoff?.workId || null,
        currentCheckpointId: latestIdea?.checkpointId || latestExperiment?.checkpointId || latestProductionHandoff?.checkpointId || null,
        latestArtifactRef: latestArtifact?.artifactId || null,
        pendingUnknowns: Object.freeze([...unknowns]),
      }),
      reality: Object.freeze({
        latestTestRunId: latestRun?.runId || null,
        latestTestStatus: latestRun?.status || 'UNKNOWN',
        latestPreviewRef: preview?.observedRef || null,
        latestEvidenceId: latestEvidence?.evidenceId || null,
        latestArtifactId: latestArtifact?.artifactId || null,
        unknowns: Object.freeze([...unknowns]),
      }),
    }),
    legacy: Object.freeze({
      compatibilityPath: 'pixie-lab-v1',
      roomDRouteCurrent: false,
      factoryHandoffCurrent: false,
      factoryHandoffCount: count(state, 'factoryHandoffs'),
    }),
    authority: Object.freeze({
      createsAuthority: false,
      transfersAuthority: false,
      approval: 'NOT_AN_APPROVAL',
    }),
  });
}
