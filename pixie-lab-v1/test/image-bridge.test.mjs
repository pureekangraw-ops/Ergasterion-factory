import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { PIXIE_COMMANDS } from '../pixie-lab/command.mjs';

function clock(){ let i=0; return()=>new Date(Date.UTC(2026,8,29,7,0,i++)).toISOString(); }

test('visual packet becomes a stable GO image action without provider authority',()=>{
  const lab=new PixieLab({now:clock()});
  lab.createVisualDraft({visualDraftId:'VIS-BRIDGE',sourceRef:'image://ref',spec:{subject:'crystal'}});
  lab.createVisualRenderPacket('VIS-BRIDGE',{packetId:'PACK-BRIDGE',intent:'refine',requestedResult:'candidate'});
  const first=lab.createImageAction('PACK-BRIDGE',{actionId:'IMG-ACT-1',workId:'WORK-1',checkpointId:'CP-1'});
  const retry=lab.createImageAction('PACK-BRIDGE',{actionId:'IMG-ACT-1',workId:'WORK-1',checkpointId:'CP-1'});
  assert.equal(first.actionId,retry.actionId);
  assert.equal(first.targetTool,'GO_IMAGE_TOOL');
  assert.equal(first.providerAuthorityGranted,false);
  assert.equal(first.productionAuthority,false);
  assert.equal(lab.board().counts.imageActions,1);
});

test('image result readback keeps artifact and receipt separate from verification',()=>{
  const lab=new PixieLab({now:clock()});
  lab.createVisualDraft({visualDraftId:'VIS-R',sourceRef:'image://ref',spec:{}});
  lab.createVisualRenderPacket('VIS-R',{packetId:'PACK-R',intent:'render',requestedResult:'image'});
  lab.createImageAction('PACK-R',{actionId:'IMG-R'});
  const receipt=lab.acceptImageResult('IMG-R',{status:'ARTIFACT_RETURNED',providerJobId:'JOB-1',artifactRef:'image://result',receiptRef:'receipt://1',evidenceRefs:['provider://receipt']});
  assert.equal(receipt.status,'ARTIFACT_RETURNED');
  assert.equal(receipt.artifactRef,'image://result');
  assert.equal(receipt.approval,'NOT_AN_APPROVAL');
  assert.equal(lab.board().counts.imageReceipts,1);
});

test('image bridge is exposed but direct generator/deploy commands remain closed',()=>{
  assert.equal(PIXIE_COMMANDS.includes('image_request'),true);
  assert.equal(PIXIE_COMMANDS.includes('image_result'),true);
  for(const name of ['generate_image','image_write','deploy_image']) assert.equal(PIXIE_COMMANDS.includes(name),false);
});


test('GO visual execution seam prepares one provider-ready action and completes with verified readback',()=>{
  const lab=new PixieLab({now:clock()});
  const prepared=lab.prepareVisualExecution({
    visualDraftId:'VIS-GO',
    sourceRef:'image://reference',
    sourceVersion:'v1',
    workId:'WORK-GO',
    checkpointId:'CP-GO',
    spec:{subject:'PRISM theme'},
    packet:{packetId:'PACK-GO',intent:'render PRISM theme',requestedResult:'one candidate'},
    dispatch:{dispatchId:'DISPATCH-GO',actionType:'GENERATE',requestedBy:'GO'},
  });
  assert.equal(prepared.status,'REQUEST_READY');
  assert.equal(prepared.targetTool,'GO_IMAGE_TOOL');
  assert.equal(prepared.externalExecutionRequired,true);
  assert.equal(prepared.imageAction.actionId,'DISPATCH-GO');

  const completed=lab.completeVisualExecution({
    dispatchId:'DISPATCH-GO',
    result:{
      status:'ARTIFACT_RETURNED',
      providerJobId:'JOB-GO',
      artifactRef:'image://prism-result',
      receiptRef:'provider://receipt',
      evidenceRefs:['evidence://provider'],
    },
    receipt:{
      receiptId:'RECEIPT-GO',
      readbackStatus:'VERIFIED',
      artifactUsable:true,
      evidenceRefs:['evidence://provider','evidence://readback'],
    },
    placeOnTable:true,
  });
  assert.equal(completed.status,'COMPLETE');
  assert.equal(completed.visualReceipt.status,'LINKED');
  assert.equal(completed.imported.resultRef,'image://prism-result');
  assert.equal(completed.lineage.resultProvenance[0].artifactRef,'image://prism-result');
  assert.equal(lab.board().counts.imageReceipts,1);
  assert.equal(lab.board().counts.visualReceipts,1);
});

test('GO visual execution commands are exposed without granting an in-process image generator',()=>{
  assert.equal(PIXIE_COMMANDS.includes('visual_execute_prepare'),true);
  assert.equal(PIXIE_COMMANDS.includes('visual_execute_complete'),true);
  assert.equal(PIXIE_COMMANDS.includes('generate_image'),false);
});
