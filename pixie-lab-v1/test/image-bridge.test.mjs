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
