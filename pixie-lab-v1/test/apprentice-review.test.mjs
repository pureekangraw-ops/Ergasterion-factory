import test from "node:test";
import assert from "node:assert/strict";
import { reviewReusableClaim } from "../room-trunk/apprentice-review.mjs";

test("Pixie verifies only the experimental claim scope", () => {
  const result = reviewReusableClaim({
    claim:"Word boundaries avoid LIGHT/Lighthouse collisions.",
    evidenceRefs:["test://parser-boundary"],
  });

  assert.equal(result.status,"VERIFIED_FOR_EXPERIMENT");
  assert.equal(result.scope,"EXPERIMENT_ONLY");
  assert.equal(result.promotesToCore,false);
});

test("Pixie refuses false green when evidence is absent or contradicted", () => {
  const noEvidence = reviewReusableClaim({ claim:"This always works." });
  assert.equal(noEvidence.status,"INSUFFICIENT_EVIDENCE");

  const contradicted = reviewReusableClaim({
    claim:"This always works.",
    evidenceRefs:["test://one-pass"],
    contradictions:["test://counterexample"],
  });
  assert.equal(contradicted.status,"CONTRADICTED");
});
