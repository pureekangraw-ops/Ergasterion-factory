import test from "node:test";
import assert from "node:assert/strict";
import {
  createHermesAgentMission,
  rankMissionCards,
  validateHubCard,
} from "../hermes-agent-mission/index.mjs";

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026,8,27,6,0,tick++)).toISOString();
}
function ids() {
  let n = 0;
  return prefix => `${prefix}-${String(++n).padStart(3,"0")}`;
}
function card(overrides={}) {
  return {
    cardId:"CARD:2609-H7HE",
    workId:"WORK-PIXIE-EXPERIMENT-LAYER-20260926-001",
    jobCode:"2609-H7HE",
    status:"Resume",
    sourceStatus:"ON PROCESS",
    destinations:["factory"],
    scope:["factory"],
    type:"NORMAL",
    title:"PIXIE Experiment Layer",
    detail:"Develop and verify experiment-layer behavior.",
    holder:"GO",
    createdAt:"2026-09-26T06:22:55.363Z",
    lastUpdated:"2026-09-26T06:23:13.314Z",
    health:"NORMAL",
    caution:null,
    ...overrides,
  };
}

test("HERMES accepts the real GO Hub Work Card shape and rejects invented card identity",()=>{
  assert.equal(validateHubCard(card()).cardId,"CARD:2609-H7HE");
  assert.throws(()=>validateHubCard(card({cardId:"MISSION-001"})),/HERMES_HUB_CARD_ID_MISMATCH/);
  assert.throws(()=>validateHubCard(card({jobCode:"HERMES-1"})),/HERMES_HUB_JOB_CODE_INVALID/);
});

test("similar mission search ranks existing real cards before new-card issuance",()=>{
  const records=[
    {card:card(),memory:{mission:"พัฒนา PIXIE Experiment Layer",requestedResult:"ทดลองระบบใหม่"}},
    {card:card({
      cardId:"CARD:2609-QDG6",
      workId:"WORK-PIXIE-VISUAL-WORKBENCH-UI-20260926-001",
      jobCode:"2609-QDG6",
      status:"Done",
      sourceStatus:"COMPLETE",
      title:"PIXIE Visual Workbench UI",
      detail:"two clipboards and main canvas",
      holder:null,
    })},
  ];
  const ranked=rankMissionCards("พัฒนา experiment pixie",records);
  assert.equal(ranked[0].cardId,"CARD:2609-H7HE");
});

test("entrance is not a gate and existing card can be reused without Board logic",()=>{
  const now=clock();
  const hermes=createHermesAgentMission({now,id:ids(),seedRecords:[{card:card()}]});
  const entered=hermes.enter({sessionId:"S-1",agentId:"GO",mission:"พัฒนา PIXIE ต่อ"});
  assert.equal(entered.status,"ENTERED");
  const candidates=hermes.candidates("S-1",{threshold:0});
  assert.equal(candidates[0].cardId,"CARD:2609-H7HE");
  const reused=hermes.chooseExisting("S-1","CARD:2609-H7HE");
  assert.equal(reused.session.status,"CARD_READY");
  assert.equal(reused.card.cardId,"CARD:2609-H7HE");
  assert.equal(reused.memory.workId,reused.card.workId);
  assert.equal("board" in hermes,false);
});

test("new mission requests an existing Hub card from Centre instead of inventing an ID",()=>{
  const hermes=createHermesAgentMission({now:clock(),id:ids()});
  hermes.enter({sessionId:"S-NEW",agentId:"GO",mission:"สร้างห้อง Agent Mission"});
  const request=hermes.prepareNewCard("S-NEW",{
    requestedResult:"HERMES prototype",
    requestedDestinations:["factory"],
    scope:["factory"],
  });
  assert.equal(request.ownerSource,"CENTRE");
  assert.equal(request.cardFormat,"EXISTING_HUB_WORK_CARD");
  assert.equal(request.cardId,undefined);
  assert.equal(request.workId,undefined);

  const issued=hermes.acceptIssuedCard("S-NEW",card({
    cardId:"CARD:2709-AB12",
    workId:"WORK-HERMES-AGENT-MISSION-20260927-001",
    jobCode:"2709-AB12",
    status:"Work",
    sourceStatus:"OPEN",
    title:"สร้างห้อง Agent Mission",
    detail:"HERMES prototype",
    holder:null,
    createdAt:"2026-09-27T06:00:00.000Z",
    lastUpdated:"2026-09-27T06:00:00.000Z",
  }));
  assert.equal(issued.card.cardId,"CARD:2709-AB12");
  assert.equal(issued.memory.cardId,"CARD:2709-AB12");
  assert.equal(issued.memory.workId,"WORK-HERMES-AGENT-MISSION-20260927-001");
});

test("loaded context stays candidate-only until GO selects it into mission memory",()=>{
  const hermes=createHermesAgentMission({now:clock(),id:ids(),seedRecords:[{card:card()}]});
  hermes.enter({sessionId:"S-CONTEXT",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-CONTEXT","CARD:2609-H7HE");
  const candidates=[
    {contextId:"CTX-FACTORY",ref:"github://factory",summary:"Factory"},
    {contextId:"CTX-OLD",ref:"notion://old",summary:"Unrelated"},
  ];
  assert.deepEqual(hermes.inspect("S-CONTEXT").record.memory.contextRefs,[]);
  const selected=hermes.selectContext("S-CONTEXT",{candidates,selectedIds:["CTX-FACTORY"]});
  assert.deepEqual(selected.memory.contextRefs,["github://factory"]);
  assert.equal(selected.memory.selectedContext.some(x=>x.contextId==="CTX-OLD"),false);
});

test("LIGHT reply cannot silently add selected context",()=>{
  const hermes=createHermesAgentMission({now:clock(),id:ids(),seedRecords:[{card:card()}]});
  hermes.enter({sessionId:"S-LIGHT",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-LIGHT","CARD:2609-H7HE");
  const ask=hermes.askLight("S-LIGHT",{question:"มีข้อมูลอะไรเกี่ยวข้อง?",availableRefs:["notion://x"]});
  assert.equal(ask.mode,"CONTEXT_ONLY");
  assert.equal(ask.mayMutateCard,false);
  const received=hermes.receiveLight("S-LIGHT",{
    requestId:ask.requestId,
    summary:"พบข้อมูลหนึ่งชิ้น",
    contextCandidates:[{contextId:"CTX-LIGHT",ref:"notion://x"}],
  });
  assert.deepEqual(received.memory.contextRefs,[]);
  assert.equal(received.memory.lightReplies.length,1);
});

test("Heimdall packet is first-open only and explicitly asks for no Board",()=>{
  const hermes=createHermesAgentMission({now:clock(),id:ids(),seedRecords:[{card:card()}]});
  hermes.enter({sessionId:"S-H",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-H","CARD:2609-H7HE");
  const packet=hermes.prepareFirstOpen("S-H",{destination:"destination://factory",workspace:"pixie-lab"});
  assert.equal(packet.purpose,"FIRST_OPEN_ONLY");
  assert.equal(packet.boardRequested,false);
  assert.equal(packet.createAuthority,false);
  assert.equal(packet.cardId,"CARD:2609-H7HE");
  assert.equal(packet.workId,"WORK-PIXIE-EXPERIMENT-LAYER-20260926-001");
});

test("Heimdall readback may update card state but cannot change its identity",()=>{
  const now=clock();
  const hermes=createHermesAgentMission({now,id:ids(),seedRecords:[{card:card({status:"Work",sourceStatus:"OPEN",holder:null})}]});
  hermes.enter({sessionId:"S-H2",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-H2","CARD:2609-H7HE");
  const req=hermes.prepareFirstOpen("S-H2",{destination:"destination://factory"});
  const accepted=hermes.acceptFirstOpen("S-H2",{
    requestId:req.requestId,
    status:"OPENED",
    destination:"destination://factory",
    checkedAt:now(),
    card:card(),
  });
  assert.equal(accepted.ready,true);
  assert.equal(accepted.session.status,"IN_MISSION");
  assert.equal(accepted.card.sourceStatus,"ON PROCESS");

  const hermes2=createHermesAgentMission({now:clock(),id:ids(),seedRecords:[{card:card({status:"Work",sourceStatus:"OPEN",holder:null})}]});
  hermes2.enter({sessionId:"S-BAD",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes2.chooseExisting("S-BAD","CARD:2609-H7HE");
  const req2=hermes2.prepareFirstOpen("S-BAD",{destination:"destination://factory"});
  assert.throws(()=>hermes2.acceptFirstOpen("S-BAD",{
    requestId:req2.requestId,status:"OPENED",destination:"destination://factory",checkedAt:clock()(),
    card:card({cardId:"CARD:2709-ZZZZ",jobCode:"2709-ZZZZ"}),
  }),/HERMES_HUB_CARD_IDENTITY_CHANGED/);
});

test("touch exposes canonical card plus selected mission-memory sidecar without authority",()=>{
  const hermes=createHermesAgentMission({now:clock(),id:ids(),seedRecords:[{card:card()}]});
  hermes.enter({sessionId:"S-TOUCH",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-TOUCH","CARD:2609-H7HE");
  hermes.selectContext("S-TOUCH",{
    candidates:[{contextId:"CTX-1",ref:"github://repo"}],
    selectedIds:["CTX-1"],
  });
  const touched=hermes.touch("S-TOUCH",{station:"FACTORY"});
  assert.equal(touched.card.cardId,"CARD:2609-H7HE");
  assert.deepEqual(touched.missionMemory.contextRefs,["github://repo"]);
  assert.equal(touched.authority,"NONE_CREATED_BY_CARD");
});

test("HERMES refuses EXIT until return request is read back as the same real card",()=>{
  const now=clock();
  const hermes=createHermesAgentMission({now,id:ids(),seedRecords:[{card:card()}]});
  hermes.enter({sessionId:"S-RET",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-RET","CARD:2609-H7HE");
  assert.throws(()=>hermes.exit("S-RET"),/HERMES_RETURN_REQUIRED_BEFORE_EXIT/);

  const request=hermes.prepareReturn("S-RET",{
    status:"COMPLETE",
    result:"done",
    evidence:[{kind:"TEST",ref:"commit://abc"}],
    lastLocation:"factory",
  });
  assert.equal(request.mustReadBackCard,true);
  assert.throws(()=>hermes.exit("S-RET"),/HERMES_RETURN_REQUIRED_BEFORE_EXIT/);

  const returned=hermes.acceptReturn("S-RET",{
    card:card({
      status:"Done",
      sourceStatus:"COMPLETE",
      holder:null,
      lastUpdated:"2026-09-27T06:30:00.000Z",
    }),
    reality:{result:"done",evidence:[{kind:"TEST",ref:"commit://abc"}]},
  });
  assert.equal(returned.session.status,"RETURNED");
  assert.equal(returned.memory.revision,1);
  assert.equal(returned.memory.latestReality.sourceStatus,"COMPLETE");
  assert.equal(hermes.exit("S-RET").status,"EXITED");
});

test("Recovery Return preserves the same card identity and records interrupted reality",()=>{
  const hermes=createHermesAgentMission({now:clock(),id:ids(),seedRecords:[{card:card()}]});
  hermes.enter({sessionId:"S-REC",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-REC","CARD:2609-H7HE");
  const request=hermes.prepareRecoveryReturn("S-REC",{lastLocation:"factory"});
  assert.equal(request.mode,"RECOVERY_RETURN");
  assert.deepEqual(request.unknowns,["SESSION_INTERRUPTED"]);
  assert.equal(request.status,"OPEN");
  const returned=hermes.acceptReturn("S-REC",{
    card:card({status:"Work",sourceStatus:"OPEN",holder:null}),
  });
  assert.equal(returned.memory.latestReality.mode,"RECOVERY_RETURN");
  assert.equal(returned.card.cardId,"CARD:2609-H7HE");
});

test("wrong card on return is rejected, preventing a session from returning somebody else's work",()=>{
  const hermes=createHermesAgentMission({now:clock(),id:ids(),seedRecords:[{card:card()}]});
  hermes.enter({sessionId:"S-WRONG",agentId:"GO",mission:"พัฒนา PIXIE"});
  hermes.chooseExisting("S-WRONG","CARD:2609-H7HE");
  hermes.prepareReturn("S-WRONG",{status:"OPEN"});
  assert.throws(()=>hermes.acceptReturn("S-WRONG",{
    card:card({
      cardId:"CARD:2709-AB12",
      workId:"WORK-OTHER",
      jobCode:"2709-AB12",
    }),
  }),/HERMES_HUB_CARD_IDENTITY_CHANGED/);
});
