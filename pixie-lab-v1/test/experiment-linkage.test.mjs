import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';

function clock(){ let i=0; return()=>new Date(Date.UTC(2026,8,29,8,0,i++)).toISOString(); }

function seed(lab, kind, suffix){
  lab.createIdea({ideaId:`IDEA-${suffix}`,title:`Idea ${suffix}`,intent:'experiment',requestedResult:'candidate'});
  lab.createExperiment({experimentId:`EXP-${suffix}`,ideaId:`IDEA-${suffix}`,kind,goal:'make candidate'});
  lab.createVariant({variantId:`VAR-${suffix}`,experimentId:`EXP-${suffix}`});
}

test('logic draft belongs to one experiment variant and compare keeps identity',()=>{
  const lab=new PixieLab({now:clock()});
  seed(lab,'LOGIC','L');
  lab.createLogicDraft({
    draftId:'LOGIC-DRAFT-1',
    logicId:'RULE-1',
    experimentId:'EXP-L',
    variantId:'VAR-L',
    sourceRef:'logic://source',
    content:{enabled:true},
  });
  const compared=lab.compareLogicDraft('LOGIC-DRAFT-1');
  assert.equal(compared.experimentId,'EXP-L');
  assert.equal(compared.variantId,'VAR-L');
});

test('visual draft and render packet preserve experiment/variant identity',()=>{
  const lab=new PixieLab({now:clock()});
  seed(lab,'VISUAL','V');
  lab.createVisualDraft({
    visualDraftId:'VIS-DRAFT-1',
    experimentId:'EXP-V',
    variantId:'VAR-V',
    sourceRef:'image://source',
    spec:{subject:'test'},
  });
  const compared=lab.compareVisualDraft('VIS-DRAFT-1');
  assert.equal(compared.experimentId,'EXP-V');
  assert.equal(compared.variantId,'VAR-V');
  const packet=lab.createVisualRenderPacket('VIS-DRAFT-1',{
    packetId:'PACK-V',
    intent:'test',
    requestedResult:'candidate',
  });
  assert.equal(packet.experimentId,'EXP-V');
  assert.equal(packet.variantId,'VAR-V');
});

test('workbench type cannot silently attach to the wrong variant kind',()=>{
  const lab=new PixieLab({now:clock()});
  seed(lab,'APP','A');
  assert.throws(()=>lab.createLogicDraft({
    draftId:'BAD-L',
    logicId:'BAD',
    experimentId:'EXP-A',
    variantId:'VAR-A',
    sourceRef:'logic://bad',
    content:{},
  }),/LOGIC_VARIANT_REQUIRED/);
  assert.throws(()=>lab.createVisualDraft({
    visualDraftId:'BAD-V',
    experimentId:'EXP-A',
    variantId:'VAR-A',
    sourceRef:'image://bad',
    spec:{},
  }),/VISUAL_VARIANT_REQUIRED/);
});
