import test from "node:test";
import assert from "node:assert/strict";
import { interpretGoCommand } from "../room-trunk/command-intelligence.mjs";
import { createRoomPixie } from "../room-trunk/room-pixie.mjs";

test("ROOM-A interprets a hard GO command with conditional stop logic", () => {
  const result = createRoomPixie().run({
    requestId:"REQ-HARD-1",
    command:"ไปตรวจ Lighthouse ว่างาน background autosync ติดตรงไหน ถ้าเป็นโค้ดแก้ได้ให้ทำ ถ้าต้องใช้มือถือบิ๊กให้หยุด แล้วเอาหลักฐานกลับมา",
    requestedResult:"หาต้นเหตุและเตรียมทางแก้ที่ปลอดภัยให้ GO",
    constraints:["ห้ามเดา UNKNOWN","ห้ามแตะ production"],
  });

  assert.equal(result.status,"READY");
  assert.equal(result.result.intent,"READ_THEN_ACT");
  assert.deepEqual(result.result.targets,["lighthouse","factory"]);
  assert.equal(result.result.conditions.some(item => item.when === "CODE_CHANGE_IS_SUFFICIENT"),true);
  assert.equal(result.result.conditions.some(item => item.when === "PHYSICAL_ACTION_REQUIRED"),true);
  assert.equal(result.result.conditions.some(item => item.when === "RESULT_READY"),true);
  assert.equal(result.result.stopConditions.includes("PHYSICAL_ACTION_REQUIRED"),true);
  assert.equal(result.candidate.execution.localOnly,true);
  assert.equal(result.candidate.execution.externalExecution,false);
  assert.equal(result.candidate.execution.productionAuthority,false);
});

test("ROOM-A leaves unresolved target as UNKNOWN rather than inventing a route", () => {
  const interpreted = interpretGoCommand({
    command:"จัดการอันนี้ให้หน่อย",
    requestedResult:"ช่วยให้ GO เห็นว่าจะทำอะไรต่อ",
  });
  assert.deepEqual(interpreted.targets,[]);
  assert.deepEqual(interpreted.unknowns,["TARGET_UNRESOLVED"]);
});

test("ROOM-A without requested result remains UNKNOWN", () => {
  const result = createRoomPixie().run({
    requestId:"REQ-HARD-2",
    command:"ตรวจ Pixie แล้วดูว่ามีอะไรน่าพัฒนาต่อ",
  });
  assert.equal(result.status,"UNKNOWN");
  assert.equal(result.unknowns.includes("REQUESTED_RESULT_UNSPECIFIED"),true);
  assert.equal(result.candidate.execution.canWidenAuthority,false);
});
