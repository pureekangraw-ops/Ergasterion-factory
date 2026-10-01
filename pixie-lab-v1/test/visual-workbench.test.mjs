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


test('PIXIE identity is used in Lab visual experimentation without inventing a separate assistant', () => {
  const lab = new PixieLab({ now: clock() });
  const draft = lab.createVisualDraft({
    visualDraftId: 'VIS-PIXIE',
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
  assert.equal(draft.assistant.name, 'PIXIE');
  assert.equal(draft.assistant.role, 'PIXIE_LAB_ASSISTANT');
  assert.equal(draft.assistant.independentImageGenerator, false);
  assert.equal(draft.assistant.operator, 'GO_IMAGE_TOOL');
  
  const packet = lab.createVisualRenderPacket('VIS-PIXIE', {
    packetId: 'PACK-PIXIE',
    intent: 'Preserve PRISM identity while iterating',
    requestedResult: 'One candidate for GO to render',
    mustKeep: ['crystal identity'],
  });
  assert.equal(packet.workbenchAssistant.name, 'PIXIE');
  assert.equal(packet.workbenchAssistant.independentImageGenerator, false);
  assert.equal(packet.table.history, 'V1_V2_V3_PLUS');
  assert.equal(packet.targetTool, 'GO_IMAGE_TOOL');
});


test('Visual vNext packet carries focus frame, intent links, freeze and explore context', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({
    visualDraftId: 'VIS-VNEXT',
    sourceRef: 'image://portrait',
    spec: {
      spatial: {
        focusFrames: [{ id: 'FRAME-1', label: 'face', bounds: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } }],
        activeFocusFrameId: 'FRAME-1',
        intentLinks: [{ id: 'LINK-1', sourceId: 'image://portrait', role: 'FACE', note: 'use the face only' }],
        freezeSet: ['face', 'palette'],
        exploreSet: ['background'],
      },
    },
  });
  const packet = lab.createVisualRenderPacket('VIS-VNEXT', {
    packetId: 'PACK-VNEXT',
    intent: 'Keep the character and explore the setting',
    requestedResult: 'One focused visual variant',
  });
  assert.equal(packet.focusFrame.label, 'face');
  assert.equal(packet.intentLinks[0].role, 'FACE');
  assert.deepEqual(packet.freezeSet, ['face', 'palette']);
  assert.deepEqual(packet.exploreSet, ['background']);
  assert.equal(packet.imageGenerationAuthority, false);
});

test('Visual vNext validates intent links against placed references and rejects Freeze/Explore overlap', () => {
  const lab = new PixieLab({ now: clock() });
  assert.throws(() => lab.createVisualDraft({
    visualDraftId: 'VIS-INTEGRITY',
    sourceRef: 'image://source',
    spec: { spatial: { intentLinks: [{ sourceId: 'image://missing', role: 'FACE' }] } },
  }), /VISUAL_INTENT_SOURCE_NOT_FOUND/);
  assert.throws(() => lab.createVisualDraft({
    visualDraftId: 'VIS-CONFLICT',
    sourceRef: 'image://source',
    spec: { spatial: { freezeSet: ['face'], exploreSet: ['face'] } },
  }), /VISUAL_FREEZE_EXPLORE_CONFLICT/);
});

test('Visual vNext normalizes focus frame bounds and carries multiple references', () => {
  const lab = new PixieLab({ now: clock() });
  const draft = lab.createVisualDraft({
    visualDraftId: 'VIS-SPATIAL',
    sourceRef: 'image://source',
    spec: {
      spatial: {
        references: [{ id: 'REF-2', ref: 'image://palette', label: 'Palette', bounds: { x: 0.7, y: 0.7, width: 0.4, height: 0.4 }, zIndex: 4 }],
        focusFrames: [{ id: 'FRAME-2', label: 'corner', bounds: { x: -1, y: 0.8, width: 0.8, height: 0.8 } }],
        activeFocusFrameId: 'FRAME-2',
      },
    },
  });
  assert.equal(draft.workingSpec.spatial.references.length, 2);
  assert.equal(draft.workingSpec.spatial.focusFrames[0].bounds.x, 0);
  assert.equal(draft.workingSpec.spatial.focusFrames[0].bounds.width, 0.8);
  const packet = lab.createVisualRenderPacket('VIS-SPATIAL', {
    packetId: 'PACK-SPATIAL',
    intent: 'Use the placed references',
    requestedResult: 'A focused composition',
  });
  assert.equal(packet.references.length, 2);
  assert.equal(packet.focusFrame.id, 'FRAME-2');
});

test('Visual vNext persists compare notes and carries them into the packet', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({ visualDraftId: 'VIS-NOTE', sourceRef: 'image://source', spec: { spatial: { compareNotes: [] } } });
  const noted = lab.editVisualDraft('VIS-NOTE', {
    op: 'SET',
    path: 'spatial.compareNotes',
    value: [{ id: 'NOTE-1', text: 'Keep the face from V2', comparedRefs: ['image://v2'] }],
  });
  assert.equal(noted.workingSpec.spatial.compareNotes[0].text, 'Keep the face from V2');
  const packet = lab.createVisualRenderPacket('VIS-NOTE', {
    packetId: 'PACK-NOTE',
    intent: 'Continue from compare note',
    requestedResult: 'Next focused variant',
  });
  assert.equal(packet.compareNotes[0].comparedRefs[0], 'image://v2');
});

test('Visual Phase 2 persists compare selection, linked note and creative winner', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({ visualDraftId: 'VIS-P2-COMPARE', sourceRef: 'image://source', spec: { spatial: { resultRefs: ['result://v1', 'result://v2', 'result://v3'], compareSessions: [] } } });
  const compared = lab.editVisualDraft('VIS-P2-COMPARE', { op: 'SET', path: 'spatial.compareSessions', value: [{ compareSessionId: 'COMPARE-1', selectedResultRefs: ['result://v1', 'result://v2'], winnerRef: 'result://v2', compareNoteRefs: [], createdAt: '2026-09-26T07:45:00.000Z' }] });
  const noted = lab.editVisualDraft('VIS-P2-COMPARE', { op: 'SET', path: 'spatial.compareNotes', value: [{ id: 'NOTE-1', text: 'Keep the light from V2', comparedRefs: ['result://v1', 'result://v2'], compareSessionId: 'COMPARE-1', createdAt: '2026-09-26T07:45:01.000Z' }] });
  const linked = lab.editVisualDraft('VIS-P2-COMPARE', { op: 'SET', path: 'spatial.compareSessions', value: [{ ...compared.workingSpec.spatial.compareSessions[0], compareNoteRefs: ['NOTE-1'] }] });
  assert.deepEqual(linked.workingSpec.spatial.compareSessions[0].selectedResultRefs, ['result://v1', 'result://v2']);
  assert.equal(linked.workingSpec.spatial.compareSessions[0].winnerRef, 'result://v2');
  assert.equal(linked.workingSpec.spatial.compareSessions[0].compareNoteRefs[0], 'NOTE-1');
  assert.equal(linked.workingSpec.spatial.compareNotes[0].compareSessionId, 'COMPARE-1');
});

test('Visual Phase 2 promotes semantic parts with referential integrity', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({ visualDraftId: 'VIS-P2-PARTS', sourceRef: 'image://source', spec: { spatial: { resultRefs: ['result://v1', 'result://v2'], focusFrames: [{ id: 'FRAME-FACE', label: 'face', bounds: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } }], compareSessions: [{ compareSessionId: 'COMPARE-1', selectedResultRefs: ['result://v1', 'result://v2'] }] } } });
  const promoted = lab.editVisualDraft('VIS-P2-PARTS', { op: 'SET', path: 'spatial.promotedParts', value: [{ partId: 'PART-FACE', sourceResultRef: 'result://v2', role: 'FACE', note: 'preserve this face', focusFrameId: 'FRAME-FACE', regionRef: 'FRAME-FACE', createdAt: '2026-09-26T07:45:00.000Z' }] });
  assert.equal(promoted.workingSpec.spatial.promotedParts[0].role, 'FACE');
  assert.equal(promoted.workingSpec.spatial.promotedParts[0].sourceResultRef, 'result://v2');
  assert.throws(() => lab.editVisualDraft('VIS-P2-PARTS', { op: 'SET', path: 'spatial.promotedParts', value: [{ sourceResultRef: 'result://missing', role: 'FACE' }] }), /VISUAL_PROMOTED_RESULT_NOT_FOUND/);
  assert.throws(() => lab.editVisualDraft('VIS-P2-PARTS', { op: 'SET', path: 'spatial.promotedParts', value: [{ sourceResultRef: 'result://v1', role: 'NOT_A_ROLE' }] }), /VISUAL_SEMANTIC_ROLE_INVALID/);
  assert.throws(() => lab.editVisualDraft('VIS-P2-PARTS', { op: 'SET', path: 'spatial.promotedParts', value: [{ sourceResultRef: 'result://v1', role: 'POSE', focusFrameId: 'FRAME-MISSING' }] }), /VISUAL_PROMOTED_FOCUS_FRAME_NOT_FOUND/);
});

test('Visual Phase 2 creates a child branch with lineage without mutating its parent draft', () => {
  const lab = new PixieLab({ now: clock() });
  const parent = lab.createVisualDraft({ visualDraftId: 'VIS-P2-PARENT', sourceRef: 'image://source', spec: { spatial: { resultRefs: ['result://v1', 'result://v2'], compareSessions: [{ compareSessionId: 'COMPARE-1', selectedResultRefs: ['result://v1', 'result://v2'], winnerRef: 'result://v2' }], promotedParts: [{ partId: 'PART-LIGHT', sourceResultRef: 'result://v1', role: 'LIGHTING' }] } } });
  const child = lab.createVisualDraft({ visualDraftId: 'VIS-P2-BRANCH', parentVisualDraftId: parent.visualDraftId, lineage: { parentVisualDraftId: parent.visualDraftId, parentResultRefs: ['result://v1', 'result://v2'], branchId: 'BRANCH-1' }, sourceRef: 'result://v2', sourceVersion: 'branch:BRANCH-1', spec: { spatial: { resultRefs: ['result://v1', 'result://v2'], compareSessions: [{ compareSessionId: 'COMPARE-BRANCH-1', selectedResultRefs: ['result://v1', 'result://v2'], winnerRef: 'result://v2' }], promotedParts: [{ partId: 'PART-LIGHT', sourceResultRef: 'result://v1', role: 'LIGHTING' }], branch: { branchId: 'BRANCH-1', parentVisualDraftId: parent.visualDraftId, parentResultRefs: ['result://v1', 'result://v2'], promotedParts: [{ partId: 'PART-LIGHT', sourceResultRef: 'result://v1', role: 'LIGHTING' }], inheritedFreezeSet: ['face'], inheritedIntentLinks: [], compareNoteRefs: [], createdAt: '2026-09-26T07:45:00.000Z' } } } });
  assert.equal(child.parentVisualDraftId, 'VIS-P2-PARENT');
  assert.equal(child.lineage.branchId, 'BRANCH-1');
  assert.equal(child.workingSpec.spatial.branch.parentVisualDraftId, 'VIS-P2-PARENT');
  assert.equal(parent.workingSpec.spatial.branch, null);
  assert.equal(parent.workingSpec.spatial.promotedParts[0].role, 'LIGHTING');
});

test('Visual Phase 2 Render Packet v3 carries compare, promotion, next intent and lineage state', () => {
  const lab = new PixieLab({ now: clock() });
  lab.createVisualDraft({ visualDraftId: 'VIS-P2-PACKET', parentVisualDraftId: 'VIS-P2-PARENT', lineage: { parentVisualDraftId: 'VIS-P2-PARENT', parentResultRefs: ['result://v1', 'result://v2'], branchId: 'BRANCH-2' }, sourceRef: 'result://v2', sourceVersion: 'branch:BRANCH-2', spec: { spatial: { resultRefs: ['result://v1', 'result://v2'], focusFrames: [{ id: 'FRAME-1', label: 'face', bounds: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 } }], activeFocusFrameId: 'FRAME-1', compareSessions: [{ compareSessionId: 'COMPARE-2', selectedResultRefs: ['result://v1', 'result://v2'], winnerRef: 'result://v2' }], promotedParts: [{ partId: 'PART-FACE', sourceResultRef: 'result://v2', role: 'FACE', focusFrameId: 'FRAME-1' }], branch: { branchId: 'BRANCH-2', parentVisualDraftId: 'VIS-P2-PARENT', parentResultRefs: ['result://v1', 'result://v2'], promotedParts: [], inheritedFreezeSet: ['face'], inheritedIntentLinks: [], compareNoteRefs: [], createdAt: '2026-09-26T07:45:00.000Z' }, nextIntents: [{ nextIntentId: 'NEXT-2', compareSessionId: 'COMPARE-2', selectedResultRefs: ['result://v1', 'result://v2'], winnerRef: 'result://v2', promotedParts: [], compareNoteRefs: [], freezeSet: ['face'], exploreSet: ['background'], focusFrameId: 'FRAME-1', intentLinks: [], createdAt: '2026-09-26T07:45:00.000Z' }], activeNextIntentId: 'NEXT-2' } } });
  const packet = lab.createVisualRenderPacket('VIS-P2-PACKET', { packetId: 'PACKET-V3', packetVersion: 'V3', intent: 'Keep the promoted face and explore the background', requestedResult: 'A branched visual variant' });
  assert.equal(packet.packetVersion, 'V3');
  assert.deepEqual(packet.selectedResultRefs, ['result://v1', 'result://v2']);
  assert.equal(packet.winnerRef, 'result://v2');
  assert.equal(packet.promotedParts[0].role, 'FACE');
  assert.equal(packet.branchId, 'BRANCH-2');
  assert.equal(packet.parentLineage.branchId, 'BRANCH-2');
  assert.equal(packet.nextIntent.nextIntentId, 'NEXT-2');
  assert.deepEqual(packet.inheritedFreezeSet, ['face']);
  assert.equal(packet.targetTool, 'GO_IMAGE_TOOL');
  assert.equal(packet.imageGenerationAuthority, false);
});

test('Visual Phase 2 rejects invalid compare winners and branch references', () => {
  const lab = new PixieLab({ now: clock() });
  assert.throws(() => lab.createVisualDraft({ visualDraftId: 'VIS-P2-BAD-WINNER', sourceRef: 'image://source', spec: { spatial: { resultRefs: ['result://v1', 'result://v2'], compareSessions: [{ compareSessionId: 'COMPARE-BAD', selectedResultRefs: ['result://v1', 'result://v2'], winnerRef: 'result://v3' }] } } }), /VISUAL_WINNER_NOT_IN_COMPARE/);
  assert.throws(() => lab.createVisualDraft({ visualDraftId: 'VIS-P2-BAD-BRANCH', sourceRef: 'image://source', spec: { spatial: { resultRefs: ['result://v1'], branch: { branchId: 'BRANCH-BAD', parentVisualDraftId: 'VIS-P2-PARENT', parentResultRefs: ['result://missing'], inheritedIntentLinks: [] } } } }), /VISUAL_BRANCH_PARENT_RESULT_NOT_FOUND/);
});
