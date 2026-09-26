import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_PROFILE } from "../room-trunk/room-profile.mjs";
import { createRoomPixie } from "../room-trunk/room-pixie.mjs";

test("ROOM-A trunk has the correct room-local Pixie profile", () => {
  assert.equal(ROOM_PROFILE.roomId, "ROOM-A");
  assert.equal(ROOM_PROFILE.roomPixieId, "PIXIE-A");
  assert.equal(ROOM_PROFILE.role, "EXPLORE");
  assert.equal(ROOM_PROFILE.trunkBranch, "room/pixie-a");
  assert.equal(ROOM_PROFILE.productionAuthority, false);
  assert.equal(ROOM_PROFILE.directMainMutation, false);
});

test("ROOM-A local Pixie returns only a room result contract", () => {
  const pixie = createRoomPixie();
  const result = pixie.run({
    requestId:"REQ-ROOM-A",
    command:"ลองรับคำสั่งยากจาก GO แล้วแตกงานในห้องนี้",
    requestedResult:"ได้แผนทดลองในห้องโดยไม่แตะ production",
    contextRefs:["fixture://room"],
  });
  assert.equal(result.contract, "PIXIE_ROOM_RESULT_V1");
  assert.equal(result.roomId, "ROOM-A");
  assert.equal(result.role, "EXPLORE");
  assert.equal(result.status, "READY");
  assert.equal(result.approval, "NOT_AN_APPROVAL");
  assert.equal(result.externalExecution, false);
  assert.equal(result.productionAuthority, false);
  assert.equal(result.plan.some(step => step.action === "OBSERVE"), true);
  assert.equal(result.plan.some(step => step.action === "PLAN_LOCAL"), true);
  assert.equal(result.plan.some(step => step.action === "COMPARE"), true);
  assert.equal(result.candidate.execution.externalExecution, false);
  assert.equal(result.candidate.execution.productionAuthority, false);
});

test("ROOM-A preserves missing requested result as UNKNOWN", () => {
  const result = createRoomPixie().run({
    requestId:"REQ-UNKNOWN-ROOM-A",
    command:"จัดการอันนี้",
  });
  assert.equal(result.status, "UNKNOWN");
  assert.deepEqual(result.unknowns, ["REQUESTED_RESULT_UNSPECIFIED", "TARGET_UNRESOLVED"]);
});
