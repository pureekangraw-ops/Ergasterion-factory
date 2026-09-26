import test from "node:test";
import assert from "node:assert/strict";
import { assessLighthouseField } from "../room-trunk/lighthouse-owner17-assessment.mjs";

test("ROOM-C inspects owner.17 without inventing a proven root cause",()=>{
  const r=assessLighthouseField();
  assert.equal(r.roomId,"ROOM-C");
  assert.equal(Array.isArray(r.findings),true);
  assert.equal(Array.isArray(r.unknowns),true);
  assert.equal(r.unknowns.length>0,true);
  assert.doesNotMatch(r.verdict,/CONFIRMED_ROOT_CAUSE/);
});
