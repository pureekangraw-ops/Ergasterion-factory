const clone = (value) => value == null ? value : structuredClone(value);

export const ERGASTERION_CAPABILITIES = Object.freeze({
  app: {
    id: 'ERGASTERION',
    role: 'IDEA_WORKSPACE_APP',
    owns: ['IDEA', 'EXPERIMENT', 'CREATE_EDIT', 'COMPARE', 'TEST', 'EVALUATE', 'CANDIDATE', 'ARTIFACT'],
    doesNotOwn: ['PRYTANEION_WORK_IDENTITY', 'BIG_FINAL_AUTHORITY', 'CURRENT_ACCEPTANCE'],
  },
  departments: {
    pixieLab: {
      id: 'PIXIE_LAB',
      role: 'IDEA_EXPERIMENT_DEPARTMENT',
      assistant: 'PIXIE',
      capabilities: ['IDEA', 'EXPERIMENT', 'LOGIC', 'APP_PROTOTYPE', 'VARIANTS', 'COMPARE', 'EVALUATE'],
    },
  },
  layout: {
    canonicalUnit: 'WORKBENCH',
    experimentalLabs: ['ROOM-A', 'ROOM-B', 'ROOM-C'],
    legacyCompatibilityRoom: 'ROOM-D',
  },
  workbenches: {
    GENERAL_IDEA_WORKBENCH: {
      status: 'ACTIVE',
      commands: [
        'idea_create', 'experiment_create', 'variant_create', 'variant_evaluate', 'experiment_select',
        'app_prototype_create', 'app_preview_record', 'app_compare',
      ],
    },
    LOGIC_WORKBENCH: {
      status: 'ACTIVE',
      commands: ['logic_create', 'logic_edit', 'logic_compare'],
    },
    VISUAL_WORKBENCH: {
      status: 'ACTIVE',
      commands: [
        'visual_create', 'visual_scan', 'visual_edit', 'visual_compare',
        'visual_render_packet', 'visual_verify', 'image_request', 'image_result',
      ],
    },
    BUILD_TEST_WORKBENCH: {
      status: 'ACTIVE',
      commands: [
        'add_matrix', 'start_matrix', 'update_matrix', 'add_test_run', 'rerun_test_run',
        'add_golden_case', 'replay_golden',
      ],
    },
    DEBUG_INSPECTION_WORKBENCH: {
      status: 'ACTIVE',
      commands: [
        'add_bug', 'add_attention', 'update_attention', 'debug_start', 'debug_step', 'debug_complete',
      ],
    },
    PRODUCTION_EVIDENCE_WORKBENCH: {
      status: 'ACTIVE',
      commands: ['production_handoff_prepare'],
    },
    CODING_WORKBENCH: {
      status: 'GAP',
      commands: [],
    },
    RUNTIME_WORKBENCH: {
      status: 'PARTIAL',
      commands: ['app_prototype_create', 'app_preview_record', 'app_compare'],
    },
  },
  lanes: {
    visual: {
      id: 'VISUAL_CAPABILITY',
      role: 'VISUAL_EXPERIMENT_LANE',
      capabilities: ['REFERENCE', 'COMPOSITION', 'EDIT', 'RENDER_PACKET', 'COMPARE', 'VERIFY'],
      imageTool: 'GO_IMAGE_TOOL',
    },
    production: {
      id: 'PRODUCTION_EVIDENCE_CAPABILITY',
      role: 'PRODUCTION_EVIDENCE_LANE',
      capabilities: ['BUILD', 'TEST', 'DEBUG', 'QA', 'EVIDENCE', 'ARTIFACT', 'REGRESSION', 'HANDOFF_PREP'],
    },
  },
  laws: [
    'PRYTANEION != ERGASTERION',
    'ERGASTERION != PIXIE_LAB',
    'HANDOFF != AUTHORITY',
    'ARTIFACT != VERIFIED',
    'DO != DONE',
  ],
  compatibility: {
    currentPath: 'pixie-lab-v1',
    renameNow: false,
    reason: 'PRESERVE_CALLERS_TESTS_RUNTIME_UNTIL_COMPATIBILITY_VERIFIED',
  },
});

export function getErgasterionCapabilities() {
  return clone(ERGASTERION_CAPABILITIES);
}
