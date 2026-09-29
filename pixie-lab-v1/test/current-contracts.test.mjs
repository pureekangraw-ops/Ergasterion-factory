import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab, ERGASTERION_STATE_SCHEMA } from '../pixie-lab/service.mjs';
import { createMemoryPersistence } from '../pixie-lab/core.mjs';

function clock(){ let i=0; return()=>new Date(Date.UTC(2026,8,29,9,0,i++)).toISOString(); }

function seedApp(lab){
  lab.createIdea({ideaId:'IDEA-CURRENT',title:'Current contracts',intent:'compare app ideas',requestedResult:'candidate'});
  lab.createExperiment({experimentId:'EXP-CURRENT',ideaId:'IDEA-CURRENT',kind:'APP',goal:'compare prototypes'});
  lab.createVariant({variantId:'VAR-A',experimentId:'EXP-CURRENT',spec:{layout:'A'}});
  lab.createVariant({variantId:'VAR-B',experimentId:'EXP-CURRENT',spec:{layout:'B'}});
}

test('App Playground compares prototypes inside the same experiment',()=>{
  const lab=new PixieLab({now:clock()});
  seedApp(lab);
  lab.createAppPrototype({prototypeId:'APP-A',experimentId:'EXP-CURRENT',variantId:'VAR-A',spec:{layout:'A'}});
  lab.createAppPrototype({prototypeId:'APP-B',experimentId:'EXP-CURRENT',variantId:'VAR-B',spec:{layout:'B'}});
  const result=lab.compareAppPrototypes('APP-A','APP-B',{comparisonId:'CMP-1'});
  assert.equal(result.experimentId,'EXP-CURRENT');
  assert.equal(result.changed,true);
});

test('production evidence handoff preserves work context',()=>{
  const lab=new PixieLab({now:clock()});
  seedApp(lab);
  const result=lab.prepareProductionHandoff({
    handoffId:'PROD-1',
    experimentId:'EXP-CURRENT',
    variantId:'VAR-A',
    workId:'WORK-1',
    checkpointId:'CP-1',
    requestedResult:'verify candidate',
    artifactRefs:['artifact://candidate'],
    evidenceRefs:['evidence://candidate'],
  });
  assert.equal(result.status,'READY_FOR_PRODUCTION_EVIDENCE');
  assert.equal(result.authorityTransferred,false);
  assert.equal(result.routeAuthorityCreated,false);
  assert.equal(lab.board().counts.productionHandoffs,1);
});

test('legacy persisted state upgrades to current schema',async()=>{
  const oldLab=new PixieLab({now:clock()});
  const legacy=structuredClone(oldLab.state);
  delete legacy.schemaVersion;
  delete legacy.ideas;
  delete legacy.experiments;
  delete legacy.variants;
  delete legacy.appPrototypes;
  delete legacy.productionHandoffs;
  delete legacy.imageActions;
  delete legacy.imageReceipts;

  const persistence=createMemoryPersistence(legacy);
  const current=new PixieLab({now:clock(),persistence});
  const board=await current.rebuildBoard();

  assert.equal(board.runtime.schemaVersion,ERGASTERION_STATE_SCHEMA);
  assert.deepEqual(board.ideas,[]);
  assert.deepEqual(board.productionHandoffs,[]);
  assert.deepEqual(board.imageActions,[]);
});
