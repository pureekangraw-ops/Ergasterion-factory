import test from 'node:test';
import assert from 'node:assert/strict';
import { PixieLab } from '../pixie-lab/service.mjs';
import { PIXIE_COMMANDS } from '../pixie-lab/command.mjs';

function clock(){ let i=0; return()=>new Date(Date.UTC(2026,8,29,6,30,i++)).toISOString(); }

test('ERGASTERION exposes one Idea Workspace envelope across idea, experiment and variants',()=>{
  const lab=new PixieLab({now:clock()});
  const idea=lab.createIdea({ideaId:'IDEA-1',title:'ลองสร้างแอป',intent:'ทดลองทางเลือก',requestedResult:'candidate ที่ประเมินได้',workId:'WORK-1',checkpointId:'CP-1'});
  const exp=lab.createExperiment({experimentId:'EXP-1',ideaId:idea.ideaId,kind:'APP',goal:'ทำ prototype'});
  const variant=lab.createVariant({variantId:'VAR-1',experimentId:exp.experimentId,spec:{screen:'home'}});
  const evaluated=lab.evaluateVariant(variant.variantId,{evaluationId:'EV-1',status:'PASS',evidenceRefs:['preview://1']});
  const selected=lab.selectExperimentCandidate(exp.experimentId,variant.variantId,{selectedBy:'BIG'});
  assert.equal(evaluated.status,'CANDIDATE');
  assert.equal(selected.selectedVariantId,'VAR-1');
  assert.equal(lab.board().counts.ideas,1);
  assert.equal(lab.board().counts.variants,1);
});

test('App playground records preview evidence without gaining execution authority',()=>{
  const lab=new PixieLab({now:clock()});
  lab.createIdea({ideaId:'IDEA-A',title:'App',intent:'prototype',requestedResult:'preview'});
  lab.createExperiment({experimentId:'EXP-A',ideaId:'IDEA-A',kind:'APP',goal:'preview'});
  lab.createVariant({variantId:'VAR-A',experimentId:'EXP-A'});
  const app=lab.createAppPrototype({prototypeId:'APP-1',experimentId:'EXP-A',variantId:'VAR-A',spec:{framework:'web'}});
  assert.equal(app.externalExecutionAuthority,false);
  const preview=lab.recordAppPreview('APP-1',{previewId:'PV-1',observedRef:'preview://app',status:'PASS',evidenceRefs:['evidence://preview']});
  assert.equal(preview.status,'PREVIEWED');
  assert.equal(lab.board().zones.appPlayground,'ACTIVE');
});

test('new Idea Workspace commands are capability commands, not production authority',()=>{
  for(const name of ['capabilities','idea_create','experiment_create','variant_create','variant_evaluate','experiment_select','app_prototype_create','app_preview_record']){
    assert.equal(PIXIE_COMMANDS.includes(name),true,name);
  }
  for(const name of ['deploy','merge','release','approve_current']) assert.equal(PIXIE_COMMANDS.includes(name),false,name);
});
