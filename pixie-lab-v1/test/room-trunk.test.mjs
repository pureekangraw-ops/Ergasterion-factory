import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_PROFILE } from "../room-trunk/room-profile.mjs";
import { createRoomPixie } from "../room-trunk/room-pixie.mjs";

test("ROOM-C trunk has the correct room-local Pixie profile", () => {
  assert.equal(ROOM_PROFILE.roomId, "ROOM-C");
  assert.equal(ROOM_PROFILE.roomPixieId, "PIXIE-C");
  assert.equal(ROOM_PROFILE.role, "VERIFY");
  assert.equal(ROOM_PROFILE.trunkBranch, "room/pixie-c");
  assert.equal(ROOM_PROFILE.productionAuthority, false);
  assert.equal(ROOM_PROFILE.directMainMutation, false);
});

test("ROOM-C local Pixie returns only a room result contract", () => {
  const pixie = createRoomPixie();
  const result = pixie.run({
    requestId:"REQ-ROOM-C",
    command:"ลองรับคำสั่งยากจาก GO แล้วแตกงานในห้องนี้",
    requestedResult:"ได้แผนทดลองในห้องโดยไม่แตะ production",
    contextRefs:["fixture://room"],
  });
  assert.equal(result.contract, "PIXIE_ROOM_RESULT_V1");
  assert.equal(result.roomId, "ROOM-C");
  assert.equal(result.role, "VERIFY");
  assert.equal(result.status, "READY");
  assert.equal(result.approval, "NOT_AN_APPROVAL");
  assert.equal(result.externalExecution, false);
  assert.equal(result.productionAuthority, false);
  assert.equal(result.plan.length, 4);
});

test("ROOM-C preserves missing requested result as UNKNOWN", () => {
  const result = createRoomPixie().run({
    requestId:"REQ-UNKNOWN-ROOM-C",
    command:"จัดการอันนี้",
  });
  assert.equal(result.status, "UNKNOWN");
  assert.deepEqual(result.unknowns, ["REQUESTED_RESULT_UNSPECIFIED"]);
});
