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
