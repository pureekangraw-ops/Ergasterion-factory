import test from "node:test";
import assert from "node:assert/strict";
import { learnFromSession, buildNextExperiment } from "../room-trunk/apprentice-learning.mjs";

test("Pixie learns explicit lessons without auto-adopting experiment behavior", () => {
  const lesson = learnFromSession({
    sessionId:"SESSION-IMAGE-01",
    topic:"visual composition",
    attempts:[
      { id:"V1", outcome:"FAIL", observation:"Too much text competes with the product." },
      { id:"V2", outcome:"PASS", observation:"One focal object reads faster.", reusable:"Prefer one dominant focal object when the mission needs instant recognition." },
    ],
    evidenceRefs:["artifact://v1","artifact://v2"],
    unknowns:["AUDIENCE_RESPONSE_UNMEASURED"],
  });

  assert.deepEqual(lesson.failed,["Too much text competes with the product."]);
  assert.deepEqual(lesson.reusable,["Prefer one dominant focal object when the mission needs instant recognition."]);
  assert.equal(lesson.adoption.automatic,false);
  assert.equal(lesson.adoption.changesCore,false);
  assert.equal(lesson.adoption.requiresFreshDecision,true);
});

test("Next unrelated session receives lessons as references, not inherited working state", () => {
  const lesson = learnFromSession({
    sessionId:"SESSION-LOGIC-01",
    topic:"operator parsing",
    attempts:[
      { outcome:"PASS", observation:"Word-boundary match avoids LIGHT/Lighthouse collision.", reusable:"Use exact target boundaries where names overlap." },
      { outcome:"FAIL", observation:"Substring matching created a false target." },
    ],
  });

  const next = buildNextExperiment({
    lesson,
    mission:"ทดลอง parser รอบใหม่",
    constraints:["ห้ามแตะ production"],
  });

  assert.deepEqual(next.useAsReference,["Use exact target boundaries where names overlap."]);
  assert.deepEqual(next.avoidRepeating,["Substring matching created a false target."]);
  assert.equal(next.inheritance.workingState,false);
  assert.equal(next.inheritance.assumptions,false);
  assert.equal(next.inheritance.coreBehavior,false);
  assert.equal(next.inheritance.evidence,true);
});
