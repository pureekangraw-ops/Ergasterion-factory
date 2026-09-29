import { PixieLab } from './service.mjs';

const normalize = (value) => String(value ?? '').trim().toLowerCase().replaceAll('-', '_');
const requireObject = (value, label = 'args') => {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
};

export const PIXIE_COMMANDS = Object.freeze([
  'status', 'ask', 'capabilities', 'workbench_floor', 'workbench_open', 'checkpoint_dock', 'reality_screen', 'big_view', 'intent_review',
  'coding_status', 'coding_list', 'coding_read', 'coding_search', 'coding_diff', 'coding_apply',
  'runtime_status', 'runtime_view', 'runtime_record', 'runtime_interaction_record', 'runtime_action',
  'idea_create', 'experiment_create', 'variant_create', 'variant_evaluate', 'experiment_select',
  'app_prototype_create', 'app_preview_record', 'app_compare',
  'start_session', 'archive_session', 'close_session', 'clean_room',
  'start_cycle', 'cycle_action',
  'add_matrix', 'start_matrix', 'update_matrix',
  'add_test_run', 'rerun_test_run',
  'add_bug', 'add_attention', 'update_attention',
  'add_golden_case', 'replay_golden',
  'debug_start', 'debug_step', 'debug_complete',
  'self_test', 'cross_room', 'master_gate',
  'examples', 'run_example',
  'logic_create', 'logic_edit', 'logic_compare',
  'visual_create', 'visual_scan', 'visual_edit', 'visual_compare', 'visual_render_packet', 'visual_verify',
  'image_request', 'image_result',
  'production_handoff_prepare',
  'candidate_passport', 'door_guard',
  'persist',
]);

const MUTATING = new Set([
  'idea_create', 'experiment_create', 'variant_create', 'variant_evaluate', 'experiment_select',
  'app_prototype_create', 'app_preview_record',
  'start_session', 'archive_session', 'close_session', 'clean_room',
  'start_cycle', 'cycle_action',
  'add_matrix', 'start_matrix', 'update_matrix',
  'add_test_run', 'rerun_test_run',
  'add_bug', 'add_attention', 'update_attention',
  'add_golden_case', 'replay_golden',
  'debug_start', 'debug_step', 'debug_complete',
  'self_test', 'cross_room', 'run_example',
  'logic_create', 'logic_edit',
  'visual_create', 'visual_scan', 'visual_edit', 'visual_render_packet', 'visual_verify',
  'image_request', 'image_result',
  'production_handoff_prepare',
  'runtime_record', 'runtime_interaction_record',
  'candidate_passport',
  'persist',
]);

const EXTERNAL_EFFECT = new Set(['coding_apply', 'runtime_action']);

export function createPixieCommander({ persistence, evidenceVerifier = null, codingExecutor = null, runtimeExecutor = null, now } = {}) {
  if (!persistence?.load || !persistence?.save) throw new Error('PIXIE_PERSISTENCE_REQUIRED');

  async function loadLab() {
    const lab = new PixieLab({ persistence, evidenceVerifier, codingExecutor, runtimeExecutor, now });
    await lab.rebuildBoard();
    return lab;
  }

  async function execute(input = {}) {
    const command = normalize(input.command);
    const args = requireObject(input.args);
    if (!PIXIE_COMMANDS.includes(command)) {
      return {
        ok: false,
        command: command || null,
        error: 'COMMAND_NOT_ALLOWED',
        allowedCommands: PIXIE_COMMANDS,
      };
    }

    const lab = await loadLab();
    let result;

    switch (command) {
      case 'status':
        result = lab.board();
        break;
      case 'ask':
        result = lab.guide(String(args.question ?? ''));
        break;
      case 'capabilities':
        result = lab.capabilities();
        break;
      case 'workbench_floor':
        result = lab.workbenchFloor();
        break;
      case 'workbench_open':
        result = lab.openWorkbench(args.workbenchId, requireObject(args.selector, 'args.selector'));
        break;
      case 'checkpoint_dock':
        result = lab.checkpointDock(requireObject(args.selector, 'args.selector'));
        break;
      case 'reality_screen':
        result = lab.realityScreen(requireObject(args.selector, 'args.selector'));
        break;
      case 'big_view':
        result = lab.bigView(requireObject(args.selector, 'args.selector'));
        break;
      case 'intent_review':
        result = lab.intentReview(requireObject(args.selector, 'args.selector'));
        break;
      case 'coding_status':
        result = await lab.codingStatus();
        break;
      case 'coding_list':
        result = await lab.codingList(args);
        break;
      case 'coding_read':
        result = await lab.codingRead(args);
        break;
      case 'coding_search':
        result = await lab.codingSearch(args);
        break;
      case 'coding_diff':
        result = await lab.codingDiff(args);
        break;
      case 'coding_apply':
        result = await lab.codingApply(args);
        break;
      case 'runtime_status':
        result = await lab.runtimeStatus();
        break;
      case 'runtime_view':
        result = await lab.runtimeView(requireObject(args.selector, 'args.selector'));
        break;
      case 'runtime_record':
        result = lab.recordRuntimeObservation(args);
        break;
      case 'runtime_interaction_record':
        result = lab.recordRuntimeInteraction(args);
        break;
      case 'runtime_action':
        result = await lab.runtimeAction(requireObject(args.action, 'args.action'));
        break;
      case 'idea_create':
        result = lab.createIdea(args);
        break;
      case 'experiment_create':
        result = lab.createExperiment(args);
        break;
      case 'variant_create':
        result = lab.createVariant(args);
        break;
      case 'variant_evaluate':
        result = lab.evaluateVariant(args.variantId, requireObject(args.evaluation, 'args.evaluation'));
        break;
      case 'experiment_select':
        result = lab.selectExperimentCandidate(args.experimentId, args.variantId, requireObject(args.selection, 'args.selection'));
        break;
      case 'app_prototype_create':
        result = lab.createAppPrototype(args);
        break;
      case 'app_preview_record':
        result = lab.recordAppPreview(args.prototypeId, requireObject(args.preview, 'args.preview'));
        break;
      case 'app_compare':
        result = lab.compareAppPrototypes(args.leftPrototypeId, args.rightPrototypeId, requireObject(args.comparison, 'args.comparison'));
        break;
      case 'start_session':
        result = lab.startSession(args);
        break;
      case 'archive_session':
        result = lab.archiveSession(args.sessionId, { archiveId: args.archiveId, note: args.note });
        break;
      case 'close_session':
        result = lab.closeSession(args.sessionId);
        break;
      case 'clean_room':
        result = lab.cleanRoom(args.roomId, { reason: args.reason, seedRef: args.seedRef });
        break;
      case 'start_cycle':
        result = lab.startCycle(args);
        break;
      case 'cycle_action':
        result = lab.cycleAction(args.cycleId, requireObject(args.input, 'args.input'));
        break;
      case 'add_matrix':
        result = lab.addMatrix(args);
        break;
      case 'start_matrix':
        result = lab.startMatrix(args.matrixId);
        break;
      case 'update_matrix':
        result = lab.updateMatrix(args.matrixId, requireObject(args.rowStatuses, 'args.rowStatuses'));
        break;
      case 'add_test_run':
        result = lab.addTestRun(args);
        break;
      case 'rerun_test_run':
        result = lab.rerun(args.runId, requireObject(args.input, 'args.input'));
        break;
      case 'add_bug':
        result = lab.addBug(args);
        break;
      case 'add_attention':
        result = lab.addAttention(args);
        break;
      case 'update_attention':
        result = lab.updateAttention(args.attentionId, args.status, args.evidenceRefs || []);
        break;
      case 'add_golden_case':
        result = lab.addGoldenCase(args);
        break;
      case 'replay_golden':
        result = lab.replayGolden(args.goldenCaseId, requireObject(args.input, 'args.input'));
        break;
      case 'debug_start':
        result = lab.debug(args);
        break;
      case 'debug_step':
        result = lab.debugStep(args.debugId, requireObject(args.step, 'args.step'));
        break;
      case 'debug_complete':
        result = lab.completeDebug(args.debugId, requireObject(args.input, 'args.input'));
        break;
      case 'self_test':
        result = lab.runSelfTest(args);
        break;
      case 'cross_room':
        result = lab.runCrossRoom(args);
        break;
      case 'master_gate':
        result = lab.masterGate(args);
        break;
      case 'examples':
        result = lab.examples();
        break;
      case 'run_example':
        result = lab.runExample(args);
        break;
      case 'logic_create':
        result = lab.createLogicDraft(args);
        break;
      case 'logic_edit':
        result = lab.editLogicDraft(args.draftId, requireObject(args.edit, 'args.edit'));
        break;
      case 'logic_compare':
        result = lab.compareLogicDraft(args.draftId);
        break;
      case 'visual_create':
        result = lab.createVisualDraft(args);
        break;
      case 'visual_scan':
        result = lab.scanVisualDraft(args.visualDraftId, requireObject(args.scan, 'args.scan'));
        break;
      case 'visual_edit':
        result = lab.editVisualDraft(args.visualDraftId, requireObject(args.edit, 'args.edit'));
        break;
      case 'visual_compare':
        result = lab.compareVisualDraft(args.visualDraftId);
        break;
      case 'visual_render_packet':
        result = lab.createVisualRenderPacket(args.visualDraftId, requireObject(args.packet, 'args.packet'));
        break;
      case 'visual_verify':
        result = lab.verifyVisualRender(args.packetId, requireObject(args.verification, 'args.verification'));
        break;
      case 'image_request':
        result = lab.createImageAction(args.packetId, requireObject(args.request, 'args.request'));
        break;
      case 'image_result':
        result = lab.acceptImageResult(args.actionId, requireObject(args.result, 'args.result'));
        break;
      case 'production_handoff_prepare':
        result = lab.prepareProductionHandoff(args);
        break;
      case 'candidate_passport':
        result = lab.candidatePassport(args.artifactId);
        break;
      case 'door_guard':
        result = lab.doorGuard(args.artifactId, args.ownerSeal);
        break;
      case 'persist':
        result = await lab.persist();
        break;
      default:
        throw new Error('COMMAND_DISPATCH_MISSING');
    }

    if (MUTATING.has(command) && command !== 'persist') await lab.persist();

    return {
      ok: true,
      pixieId: lab.state.pixieId,
      labId: lab.labId,
      command,
      mutated: MUTATING.has(command) || EXTERNAL_EFFECT.has(command),
      externalEffect: EXTERNAL_EFFECT.has(command),
      result,
    };
  }

  return Object.freeze({ execute, allowedCommands: PIXIE_COMMANDS });
}
