import test from "node:test";
import assert from "node:assert/strict";
import { createLessonPacket } from "../room-trunk/lesson-packet.mjs";
import { reviewReusableClaim } from "../room-trunk/apprentice-review.mjs";

test("ROOM-C can verify a portable lesson claim without promoting it", () => {
  const packet = createLessonPacket({
    sourceRoom:"ROOM-A",
    sessionId:"SESSION-LOGIC-01",
    topic:"target parsing",
    reusable:["Use exact target boundaries where names overlap."],
    evidenceRefs:["test://parser-boundary"],
  });

  const review = reviewReusableClaim({
    claim:packet.reusable[0],
    evidenceRefs:packet.evidenceRefs,
    unknowns:packet.unknowns,
  });

  assert.equal(review.status,"VERIFIED_FOR_EXPERIMENT");
  assert.equal(review.promotesToCore,false);
  assert.equal(packet.transfer.carriesAuthority,false);
});
