import test from "node:test";
import assert from "node:assert/strict";
import { learnFromSession } from "../room-trunk/apprentice-learning.mjs";
import { createLessonPacket } from "../room-trunk/lesson-packet.mjs";

test("ROOM-A exports only explicit reusable lesson data", () => {
  const lesson = learnFromSession({
    sessionId:"SESSION-A-01",
    topic:"visual composition",
    attempts:[
      { outcome:"PASS", observation:"One focal object read faster.", reusable:"Prefer one dominant focal object for instant recognition." },
      { outcome:"FAIL", observation:"Too many competing captions." },
    ],
    evidenceRefs:["artifact://a-v2"],
    unknowns:["AUDIENCE_RESPONSE_UNMEASURED"],
  });

  const packet = createLessonPacket({
    sourceRoom:"ROOM-A",
    sessionId:lesson.sessionId,
    topic:lesson.topic,
    reusable:lesson.reusable,
    evidenceRefs:lesson.evidenceRefs,
    unknowns:lesson.unknowns,
  });

  assert.deepEqual(packet.reusable,["Prefer one dominant focal object for instant recognition."]);
  assert.equal(packet.transfer.carriesWorkingState,false);
  assert.equal(packet.transfer.carriesAssumptions,false);
  assert.equal(packet.transfer.autoAdopts,false);
});
