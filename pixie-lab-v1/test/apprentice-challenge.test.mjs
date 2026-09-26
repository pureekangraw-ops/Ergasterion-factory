import test from "node:test";
import assert from "node:assert/strict";
import { challengeLesson } from "../room-trunk/apprentice-challenge.mjs";

test("Pixie can attack a seemingly good lesson without turning challenge into a verdict", () => {
  const result = challengeLesson({
    topic:"visual composition",
    reusable:["Prefer one dominant focal object."],
    evidenceRefs:["artifact://v2"],
    unknowns:["AUDIENCE_RESPONSE_UNMEASURED"],
  });

  assert.equal(result.probes.some(x => x.kind === "COUNTEREXAMPLE"),true);
  assert.equal(result.probes.some(x => x.kind === "TRANSFER_RISK"),true);
  assert.equal(result.probes.some(x => x.kind === "UNKNOWN_PRESSURE"),true);
  assert.equal(result.verdict,"NOT_A_VERDICT");
  assert.equal(result.mutatesLesson,false);
  assert.equal(result.productionAuthority,false);
});

test("Missing evidence becomes a probe instead of an invented failure", () => {
  const result = challengeLesson({
    topic:"parser behavior",
    reusable:["Use exact boundaries for overlapping names."],
  });
  assert.equal(result.probes.some(x => x.kind === "EVIDENCE_GAP"),true);
});
