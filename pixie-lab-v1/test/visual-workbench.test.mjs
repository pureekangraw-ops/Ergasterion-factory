import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { PIXIE_COMMANDS, createPixieCommander } from '../pixie-lab/command.mjs';
import { createMemoryPersistence } from '../pixie-lab/core.mjs';

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 8, 26, 7, 45, tick++)).toISOString();
}

test('Visual Workbench keeps source spec immutable while editing Lab-owned working spec', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({
    visualDraftId: 'VIS-1',
    sourceRef: 'image://base-map',
    sourceVersion: 'v1',
    spec: { canvas: { ratio: '16:9' }, layers: ['base'], title: '  Flood map  ' },
  });
  lab.editVisualDraft('VIS-1', { op: 'APPEND', path: 'layers', value: 'flood-overlay' });
  lab.editVisualDraft('VIS-1', { op: 'TRIM_TEXT', path: 'title' });
  const compared = lab.compareVisualDraft('VIS-1');
  assert.equal(compared.sourceLocked, true);
  assert.deepEqual(compared.originalSpec.layers, ['base']);
  assert.deepEqual(compared.workingSpec.layers, ['base', 'flood-overlay']);
  assert.equal(compared.originalSpec.title, '  Flood map  ');
  assert.equal(compared.workingSpec.title, 'Flood map');
});

test('Visual SCAN preserves UNKNOWN when evidence is missing', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({ visualDraftId: 'VIS-2', sourceRef: 'image://map', spec: {} });
  const scanned = lab.scanVisualDraft('VIS-2', {
    scanId: 'SCAN-1',
    observations: [{ kind: 'LABEL', value: 'คู้บอน 27' }],
  });
  assert.equal(scanned.scans[0].status, 'UNKNOWN');
  assert.deepEqual(scanned.scans[0].unknowns, ['SCAN_EVIDENCE_MISSING']);
});

test('Visual render packet prepares work for GO image tool without granting image authority', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({
    visualDraftId: 'VIS-3',
    sourceRef: 'image://base',
    spec: { layers: [{ id: 'base', locked: true }] },
  });
  lab.scanVisualDraft('VIS-3', {
    scanId: 'SCAN-2',
    observations: [{ kind: 'ROAD', value: 'รามอินทรา' }],
    evidenceRefs: ['news://verified-1'],
  });
  const packet = lab.createVisualRenderPacket('VIS-3', {
    packetId: 'PACK-1',
    intent: 'Overlay current flood reports on the fixed base map',
    requestedResult: 'One clean map for GO to render',
    mustKeep: ['base geography'],
    mustRemove: ['traffic UI'],
    constraints: ['do not invent coordinates'],
  });
  assert.equal(packet.externalExecutionRequired, true);
  assert.equal(packet.imageGenerationAuthority, false);
  assert.equal(packet.productionAuthority, false);
  assert.equal(packet.approval, 'NOT_AN_APPROVAL');
  assert.deepEqual(packet.evidenceRefs, ['news://verified-1']);
});

test('Visual VERIFY cannot fake PASS without evidence', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({ visualDraftId: 'VIS-4', sourceRef: 'image://base', spec: {} });
  const packet = lab.createVisualRenderPacket('VIS-4', {
    packetId: 'PACK-2',
    intent: 'Create summary',
    requestedResult: 'Verified image',
  });
  const unknown = lab.verifyVisualRender('PACK-2', {
    verificationId: 'VERIFY-1',
    observedRef: 'image://result',
    checks: [{ checkId: 'BASE', status: 'PASS' }],
  });
  assert.equal(unknown.status, 'UNKNOWN');
  const pass = lab.verifyVisualRender('PACK-2', {
    verificationId: 'VERIFY-2',
    observedRef: 'image://result',
    checks: [{ checkId: 'BASE', status: 'PASS', evidenceRefs: ['review://base-match'] }],
  });
  assert.equal(pass.status, 'PASS');
});

test('Visual Workbench is exposed on board and command surface', async () => {
  for (const command of ['visual_create', 'visual_scan', 'visual_edit', 'visual_compare', 'visual_render_packet', 'visual_verify']) {
    assert.equal(PIXIE_COMMANDS.includes(command), true);
  }
  for (const command of ['generate_image', 'image_write', 'deploy_image']) {
    assert.equal(PIXIE_COMMANDS.includes(command), false);
  }
  const persistence = createMemoryPersistence();
  const commander = createPixieCommander({ persistence, now: clock() });
  await commander.execute({ command: 'visual_create', args: { visualDraftId: 'VIS-CMD', sourceRef: 'image://cmd', spec: {} } });
  const status = await commander.execute({ command: 'status' });
  assert.equal(status.result.zones.visualWorkbench, 'ACTIVE');
  assert.equal(status.result.counts.visualDrafts, 1);
});


test('Gnome is stationed at the Visual Workbench and travels with render packets', () => {
  const lab = new PixieLab({ now: clock() });
  const draft = lab.createVisualDraft({
    visualDraftId: 'VIS-GNOME',
    sourceRef: 'image://prism-crystal',
    sourceVersion: 'selected-v1',
    spec: {
      reference: { locked: true, subject: 'PRISM crystal' },
      brief: { requestedResult: 'Explore without changing the reference' },
    },
  });
  assert.equal(draft.table.referencePin, 'IDEA_REFERENCE');
  assert.equal(draft.table.briefPin, 'BRIEF_PROMPT');
  assert.equal(draft.table.main, 'VISUAL_WORKSPACE');
  assert.equal(draft.assistant.name, 'Gnome');
  assert.equal(draft.assistant.role, 'GO_VISUAL_ASSISTANT');
  assert.equal(draft.assistant.independentImageGenerator, false);
  assert.equal(draft.assistant.operator, 'GO_IMAGE_TOOL');
  assert.equal(draft.assistant.motto, 'TRY_IT_NOW');

  const packet = lab.createVisualRenderPacket('VIS-GNOME', {
    packetId: 'PACK-GNOME',
    intent: 'Preserve PRISM identity while iterating',
    requestedResult: 'One candidate for GO to render',
    mustKeep: ['crystal identity'],
  });
  assert.equal(packet.workbenchAssistant.name, 'Gnome');
  assert.equal(packet.workbenchAssistant.independentImageGenerator, false);
  assert.equal(packet.table.history, 'V1_V2_V3_PLUS');
  assert.equal(packet.targetTool, 'GO_IMAGE_TOOL');
});
