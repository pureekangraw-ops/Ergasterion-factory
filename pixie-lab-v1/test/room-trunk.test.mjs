import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_PROFILE } from "../room-trunk/room-profile.mjs";
import { createRoomPixie } from "../room-trunk/room-pixie.mjs";

test("ROOM-B is a free-play workshop, not a fixed specialty", () => {
  assert.equal(ROOM_PROFILE.roomId,"ROOM-B");
  assert.equal(ROOM_PROFILE.roomPixieId,"PIXIE-B");
  assert.equal(ROOM_PROFILE.role,"WORKSHOP");
  assert.equal(ROOM_PROFILE.workspace,"FREE_PLAY");
  assert.deepEqual(ROOM_PROFILE.defaultActions,[]);
  assert.equal(ROOM_PROFILE.productionAuthority,false);
});

test("ROOM-B exposes workshop and apprentice directly", () => {
  const pixie=createRoomPixie();
  const apprentice=pixie.createApprentice();
  apprentice.startMission({sessionId:"APP-B",roomId:"ROOM-B",mission:"ลองของ"});
  assert.equal(apprentice.brief("APP-B").operatingStyle,"FREE_NEXT_ACTION");
});

test("ROOM-B leaves method choice open", () => {
  const result=createRoomPixie().run({
    requestId:"REQ-B",
    command:"ลองวิธีใหม่",
    requestedResult:"ได้ผลทดลอง",
  });
  assert.equal(result.role,"WORKSHOP");
  assert.equal(result.plan[0].action,"CHOOSE_NEXT_ACTION");
  assert.equal(result.productionAuthority,false);
});

test("ROOM-B preserves missing requested result as UNKNOWN", () => {
  const result=createRoomPixie().run({requestId:"REQ-B-U",command:"จัดการอันนี้"});
  assert.equal(result.status,"UNKNOWN");
});
