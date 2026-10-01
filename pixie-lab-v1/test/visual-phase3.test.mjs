import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { PIXIE_COMMANDS, createPixieCommander } from '../pixie-lab/command.mjs';
import { createMemoryPersistence } from '../pixie-lab/core.mjs';

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 9, 1, 1, 0, tick++)).toISOString();
}

function setup({ id = 'VIS-P3', branch = null } = {}) {
  const lab = new PixieLab({ now: clock() });
  const spec = { spatial: { resultRefs: ['result://v1', 'result://v2'], compareSessions: [{ compareSessionId: 'COMPARE-1', selectedResultRefs: ['result://v1', 'result://v2'], winnerRef: 'result://v2' }] } };
  if (branch) spec.spatial.branch = branch;
  const draft = lab.createVisualDraft({ visualDraftId: id, sourceRef: 'image://source', spec, ...(branch ? { parentVisualDraftId: branch.parentVisualDraftId, lineage: { parentVisualDraftId: branch.parentVisualDraftId, parentResultRefs: branch.parentResultRefs, branchId: branch.branchId } } : {}) });
  const packet = lab.createVisualRenderPacket(id, { packetId: `${id}-PACKET`, packetVersion: 'V3', intent: 'Keep selected visual context', requestedResult: 'One next iteration' });
  return { lab, draft, packet };
}

const ctx = { workId: 'WORK-P3', checkpointId: 'CP-P3' };

test('Phase 3 command surface keeps image authority external', () => {
  for (const command of ['visual_dispatch', 'visual_dispatch_update', 'visual_receipt', 'visual_result_import', 'visual_retry', 'visual_recover', 'visual_lineage']) assert.equal(PIXIE_COMMANDS.includes(command), true);
});

test('Generate dispatch is structured, persisted, and routed to GO_IMAGE_TOOL', () => {
  const { lab, packet } = setup();
  const dispatch = lab.createVisualDispatch('VIS-P3', { dispatchId: 'DISPATCH-1', packetId: packet.packetId, ...ctx, actionType: 'GENERATE' });
  assert.equal(dispatch.status, 'SENT');
  assert.equal(dispatch.targetTool, 'GO_IMAGE_TOOL');
  assert.equal(dispatch.actionType, 'GENERATE');
  assert.equal(dispatch.packetId, packet.packetId);
  assert.equal(dispatch.externalExecutionRequired, true);
  assert.equal(dispatch.imageGenerationAuthority, false);
  assert.equal(lab.state.imageActions.some((item) => item.actionId === 'DISPATCH-1'), true);
});

test('Edit dispatch requires a real target result and carries focus context', () => {
  const { lab, packet } = setup();
  assert.throws(() => lab.createVisualDispatch('VIS-P3', { dispatchId: 'DISPATCH-EDIT-BAD', packetId: packet.packetId, ...ctx, actionType: 'EDIT' }), /VISUAL_EDIT_TARGET_REQUIRED/);
  const dispatch = lab.createVisualDispatch('VIS-P3', { dispatchId: 'DISPATCH-EDIT', packetId: packet.packetId, ...ctx, actionType: 'EDIT', targetResultRef: 'result://v2', sourceResultRefs: ['result://v2'] });
  assert.equal(dispatch.actionType, 'EDIT');
  assert.equal(dispatch.targetResultRef, 'result://v2');
});

test('Receipt validates lineage and automatically imports a usable result', () => {
  const { lab, packet } = setup();
  const dispatch = lab.createVisualDispatch('VIS-P3', { dispatchId: 'DISPATCH-2', packetId: packet.packetId, ...ctx, actionType: 'GENERATE' });
  const receipt = lab.createVisualReceipt(dispatch.dispatchId, { receiptId: 'RECEIPT-2', artifactRef: 'artifact://v3', status: 'RECEIVED', executorIdentity: 'GO_IMAGE_TOOL', evidenceRefs: ['readback://2'] });
  assert.equal(receipt.status, 'LINKED');
  assert.equal(lab.state.visualDrafts[0].workingSpec.spatial.resultRefs.includes('artifact://v3'), true);
  assert.equal(lab.state.visualDrafts[0].workingSpec.spatial.resultProvenance[0].dispatchId, dispatch.dispatchId);
  assert.equal(lab.state.visualDispatches[0].status, 'RECEIVED');
});

test('Wrong lineage and duplicate receipts are rejected', () => {
  const { lab, packet } = setup();
  const dispatch = lab.createVisualDispatch('VIS-P3', { dispatchId: 'DISPATCH-3', packetId: packet.packetId, ...ctx, actionType: 'GENERATE' });
  assert.throws(() => lab.createVisualReceipt(dispatch.dispatchId, { receiptId: 'RECEIPT-WRONG', packetId: 'OTHER-PACKET', artifactRef: 'artifact://bad', executorIdentity: 'GO_IMAGE_TOOL' }), /VISUAL_RECEIPT_PACKET_MISMATCH/);
  lab.createVisualReceipt(dispatch.dispatchId, { receiptId: 'RECEIPT-3', artifactRef: 'artifact://v3', executorIdentity: 'GO_IMAGE_TOOL' });
  assert.throws(() => lab.createVisualReceipt(dispatch.dispatchId, { receiptId: 'RECEIPT-3B', artifactRef: 'artifact://v3b', executorIdentity: 'GO_IMAGE_TOOL' }), /VISUAL_RECEIPT_DUPLICATE_DISPATCH/);
});

test('Incomplete readback stays UNKNOWN and does not fabricate a result', () => {
  const { lab, packet } = setup();
  const dispatch = lab.createVisualDispatch('VIS-P3', { dispatchId: 'DISPATCH-UNKNOWN', packetId: packet.packetId, ...ctx, actionType: 'GENERATE' });
  const receipt = lab.createVisualReceipt(dispatch.dispatchId, { receiptId: 'RECEIPT-UNKNOWN', status: 'RECEIVED', executorIdentity: 'GO_IMAGE_TOOL' });
  assert.equal(receipt.status, 'UNKNOWN');
  assert.equal(lab.state.visualDrafts[0].workingSpec.spatial.resultRefs.includes('artifact://unknown'), false);
});

test('Branch result import stays on the branch and never mutates an unrelated draft', () => {
  const branch = { branchId: 'BRANCH-P3', parentVisualDraftId: 'VIS-PARENT', parentResultRefs: ['result://v1', 'result://v2'], promotedParts: [], inheritedFreezeSet: ['face'], inheritedExploreSet: ['background'], inheritedIntentLinks: [], compareNoteRefs: [], createdAt: '2026-10-01T01:00:00.000Z' };
  const { lab, packet } = setup({ id: 'VIS-BRANCH', branch });
  const dispatch = lab.createVisualDispatch('VIS-BRANCH', { dispatchId: 'DISPATCH-BRANCH', packetId: packet.packetId, branchId: branch.branchId, ...ctx, actionType: 'GENERATE' });
  const receipt = lab.createVisualReceipt(dispatch.dispatchId, { receiptId: 'RECEIPT-BRANCH', artifactRef: 'artifact://branch-v3', executorIdentity: 'GO_IMAGE_TOOL' });
  assert.equal(receipt.status, 'LINKED');
  assert.equal(lab.state.visualDrafts[0].workingSpec.spatial.resultRefs.includes('artifact://branch-v3'), true);
  assert.equal(lab.state.visualDrafts[0].workingSpec.spatial.branch.branchId, branch.branchId);
});

test('Retry creates a new attempt identity and preserves prior dispatch/receipt lineage', () => {
  const { lab, packet } = setup();
  const first = lab.createVisualDispatch('VIS-P3', { dispatchId: 'DISPATCH-RETRY-1', packetId: packet.packetId, ...ctx, actionType: 'GENERATE' });
  const retry = lab.retryVisualDispatch(first.dispatchId, { dispatchId: 'DISPATCH-RETRY-2' });
  assert.equal(retry.attempt, 2);
  assert.equal(retry.retryOfDispatchId, first.dispatchId);
  assert.equal(lab.state.visualDispatches.length, 2);
  assert.equal(lab.state.visualDispatches[0].dispatchId, first.dispatchId);
});

test('Recovery and lineage are readable after persistence reload', async () => {
  const persistence = createMemoryPersistence();
  const lab = new PixieLab({ persistence, now: clock() });
  lab.createVisualDraft({ visualDraftId: 'VIS-RECOVER', sourceRef: 'image://source', spec: {} });
  const packet = lab.createVisualRenderPacket('VIS-RECOVER', { packetId: 'PACK-RECOVER', packetVersion: 'V3', intent: 'resume', requestedResult: 'result' });
  const dispatch = lab.createVisualDispatch('VIS-RECOVER', { dispatchId: 'DISPATCH-RECOVER', packetId: packet.packetId, ...ctx, actionType: 'GENERATE' });
  await lab.persist();
  const resumed = new PixieLab({ persistence, now: clock() });
  await resumed.rebuildBoard();
  const recovery = resumed.recoverVisualWork('VIS-RECOVER');
  assert.equal(recovery.status, 'RECOVERED');
  assert.equal(recovery.pendingDispatches[0].dispatchId, dispatch.dispatchId);
  const lineage = resumed.visualLineage('VIS-RECOVER');
  assert.equal(lineage.dispatches[0].packetId, packet.packetId);
  assert.equal(lineage.receipts.length, 0);
});

test('Commander persists dispatch and receipt through governed commands', async () => {
  const persistence = createMemoryPersistence();
  const commander = createPixieCommander({ persistence, now: clock() });
  await commander.execute({ command: 'visual_create', args: { visualDraftId: 'VIS-CMD-P3', sourceRef: 'image://source', spec: {} } });
  await commander.execute({ command: 'visual_render_packet', args: { visualDraftId: 'VIS-CMD-P3', packet: { packetId: 'PACK-CMD-P3', packetVersion: 'V3', intent: 'cmd', requestedResult: 'cmd result' } } });
  const dispatched = await commander.execute({ command: 'visual_dispatch', args: { visualDraftId: 'VIS-CMD-P3', dispatch: { dispatchId: 'DISPATCH-CMD-P3', packetId: 'PACK-CMD-P3', ...ctx, actionType: 'GENERATE' } } });
  assert.equal(dispatched.ok, true);
  const received = await commander.execute({ command: 'visual_receipt', args: { dispatchId: 'DISPATCH-CMD-P3', receipt: { receiptId: 'RECEIPT-CMD-P3', artifactRef: 'artifact://cmd-v3', executorIdentity: 'GO_IMAGE_TOOL' } } });
  assert.equal(received.result.status, 'LINKED');
  const recovered = await commander.execute({ command: 'visual_recover', args: { visualDraftId: 'VIS-CMD-P3' } });
  assert.equal(recovered.result.latestResultRefs.includes('artifact://cmd-v3'), true);
});
