import test from "node:test";
import assert from "node:assert/strict";
import { createLessonPacket } from "../room-trunk/lesson-packet.mjs";
import { challengeLesson } from "../room-trunk/apprentice-challenge.mjs";

test("ROOM-B can challenge an A lesson packet without inheriting A state", () => {
  const packet = createLessonPacket({
    sourceRoom:"ROOM-A",
    sessionId:"SESSION-A-01",
    topic:"visual composition",
    reusable:["Prefer one dominant focal object for instant recognition."],
    evidenceRefs:["artifact://a-v2"],
    unknowns:["AUDIENCE_RESPONSE_UNMEASURED"],
  });

  const challenge = challengeLesson(packet);
  assert.equal(challenge.probes.some(x => x.kind === "COUNTEREXAMPLE"),true);
  assert.equal(challenge.probes.some(x => x.kind === "UNKNOWN_PRESSURE"),true);
  assert.equal(packet.transfer.carriesWorkingState,false);
  assert.equal(challenge.mutatesLesson,false);
});
