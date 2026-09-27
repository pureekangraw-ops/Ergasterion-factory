import test from "node:test";
import assert from "node:assert/strict";
import { createRoomPixie as createA } from "../factory-assembly/helpers/pixie-a/room-pixie.mjs";
import { createRoomPixie as createB } from "../factory-assembly/helpers/pixie-b/room-pixie.mjs";
import { createRoomPixie as createC } from "../factory-assembly/helpers/pixie-c/room-pixie.mjs";
import { runGauntlet as runA } from "../factory-assembly/helpers/pixie-a/training-gauntlet-runner.mjs";
import { runGauntlet as runB } from "../factory-assembly/helpers/pixie-b/training-gauntlet-runner.mjs";
import { runGauntlet as runC } from "../factory-assembly/helpers/pixie-c/training-gauntlet-runner.mjs";

const copies = [
  ["ROOM-A",createA,runA],
  ["ROOM-B",createB,runB],
  ["ROOM-C",createC,runC],
];

test("Factory Assembly can load all three copied helpers without changing their authority",()=>{
  for(const [roomId,create] of copies){
    const pixie=create();
    assert.equal(pixie.profile.roomId,roomId);
    assert.equal(pixie.profile.role,"WORKSHOP");
    assert.equal(pixie.profile.productionAuthority,false);
    assert.equal(typeof pixie.createSupportTeam,"function");
  }
});

test("Factory Assembly copies retain their trained gauntlet behavior",()=>{
  for(const [roomId,,run] of copies){
    const result=run({roomId});
    assert.equal(result.report.complete,true);
    assert.equal(result.report.passed,15);
  }
});
