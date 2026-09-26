import test from "node:test";
import assert from "node:assert/strict";
import { createRoomPixie } from "../room-trunk/room-pixie.mjs";

test("room Pixie exposes a GO support team", () => {
  const pixie=createRoomPixie();
  assert.equal(typeof pixie.createSupportTeam,"function");

  const team=pixie.createSupportTeam();
  const state=team.start({
    missionId:"GO-SUPPORT-SMOKE",
    mission:"ช่วย GO จัดการ mission หนึ่งก้อน",
    rooms:["ROOM-A","ROOM-B","ROOM-C"],
  });

  assert.equal(state.requestedBy,"GO");
  assert.equal(state.roomStates.length,3);
  assert.equal(team.brief("GO-SUPPORT-SMOKE").operatingStyle,"INDEPENDENT_FREE_PLAY");
});
