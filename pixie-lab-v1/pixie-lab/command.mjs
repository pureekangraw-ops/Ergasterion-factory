import { PixieLab } from './service.mjs';

const normalize = (value) => String(value ?? '').trim().toLowerCase().replaceAll('-', '_');
const requireObject = (value, label = 'args') => {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
};

export const PIXIE_COMMANDS = Object.freeze([
  'status', 'ask',
  'start_session', 'close_session',
  'start_cycle', 'cycle_action',
  'add_matrix', 'start_matrix', 'update_matrix',
  'add_test_run', 'rerun_test_run',
  'add_bug', 'add_attention', 'update_attention',
  'add_golden_case', 'replay_golden',
  'debug_start', 'debug_step', 'debug_complete',
  'self_test', 'cross_room', 'master_gate',
  'examples', 'run_example',
  'logic_create', 'logic_edit', 'logic_compare',
  'candidate_passport', 'door_guard',
  'persist',
]);

const MUTATING = new Set([
  'start_session', 'close_session',
  'start_cycle', 'cycle_action',
  'add_matrix', 'start_matrix', 'update_matrix',
  'add_test_run', 'rerun_test_run',
  'add_bug', 'add_attention', 'update_attention',
  'add_golden_case', 'replay_golden',
  'debug_start', 'debug_step', 'debug_complete',
  'self_test', 'cross_room', 'run_example',
  'logic_create', 'logic_edit',
  'candidate_passport',
  'persist',
]);

export function createPixieCommander({ persistence, evidenceVerifier = null, now } = {}) {
  if (!persistence?.load || !persistence?.save) throw new Error('PIXIE_PERSISTENCE_REQUIRED');

  async function loadLab() {
    const lab = new PixieLab({ persistence, evidenceVerifier, now });
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
      case 'start_session':
        result = lab.startSession(args);
        break;
      case 'close_session':
        result = lab.closeSession(args.sessionId);
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
      mutated: MUTATING.has(command),
      result,
    };
  }

  return Object.freeze({ execute, allowedCommands: PIXIE_COMMANDS });
}
