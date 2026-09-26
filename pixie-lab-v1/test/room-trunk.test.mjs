import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_PROFILE } from "../room-trunk/room-profile.mjs";
import { createRoomPixie } from "../room-trunk/room-pixie.mjs";

test("ROOM-A is a free-play workshop, not a fixed specialty", () => {
  assert.equal(ROOM_PROFILE.roomId,"ROOM-A");
  assert.equal(ROOM_PROFILE.roomPixieId,"PIXIE-A");
  assert.equal(ROOM_PROFILE.role,"WORKSHOP");
  assert.equal(ROOM_PROFILE.workspace,"FREE_PLAY");
  assert.deepEqual(ROOM_PROFILE.defaultActions,[]);
  assert.equal(ROOM_PROFILE.productionAuthority,false);
  assert.equal(ROOM_PROFILE.directMainMutation,false);
});

test("ROOM-A exposes workshop and apprentice directly", () => {
  const pixie=createRoomPixie();
  assert.equal(typeof pixie.createWorkshop,"function");
  assert.equal(typeof pixie.createApprentice,"function");
  const apprentice=pixie.createApprentice();
  apprentice.startMission({sessionId:"APP-A",roomId:"ROOM-A",mission:"ลองของ"});
  assert.equal(apprentice.brief("APP-A").operatingStyle,"FREE_NEXT_ACTION");
});

test("ROOM-A command interpretation remains optional workshop help", () => {
  const result=createRoomPixie().run({
    requestId:"REQ-A",
    command:"ลองรับคำสั่งยากจาก GO แล้วแตกงานในห้องนี้",
    requestedResult:"ได้ผลทดลอง",
    contextRefs:["fixture://room"],
  });
  assert.equal(result.contract,"PIXIE_ROOM_RESULT_V1");
  assert.equal(result.role,"WORKSHOP");
  assert.equal(result.status,"READY");
  assert.equal(result.productionAuthority,false);
});

test("ROOM-A preserves missing requested result as UNKNOWN", () => {
  const result=createRoomPixie().run({requestId:"REQ-A-U",command:"จัดการอันนี้"});
  assert.equal(result.status,"UNKNOWN");
  assert.equal(result.unknowns.includes("REQUESTED_RESULT_UNSPECIFIED"),true);
});
