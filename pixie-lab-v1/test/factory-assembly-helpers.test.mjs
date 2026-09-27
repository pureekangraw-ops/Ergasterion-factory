import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRoomPixie as createA } from "../factory-assembly/helpers/pixie-a/room-pixie.mjs";
import { createRoomPixie as createB } from "../factory-assembly/helpers/pixie-b/room-pixie.mjs";
import { createRoomPixie as createC } from "../factory-assembly/helpers/pixie-c/room-pixie.mjs";

const copies = [
  ["ROOM-A","PYRO-A","pixie-a",createA],
  ["ROOM-B","PYRO-B","pixie-b",createB],
  ["ROOM-C","PYRO-C","pixie-c",createC],
];

test("Factory Assembly loads PYRO A/B/C as permanent non-production helpers",()=>{
  for(const [roomId,pyroId,,create] of copies){
    const helper=create();
    assert.equal(helper.profile.roomId,roomId);
    assert.equal(helper.profile.roomPixieId,pyroId);
    assert.equal(helper.profile.unitName,"PYRO");
    assert.equal(helper.profile.station,"FACTORY_FORGE");
    assert.equal(helper.profile.productionAuthority,false);
    assert.equal(helper.profile.externalExecution,false);
    assert.equal(helper.profile.directMainMutation,false);
    assert.equal(typeof helper.createSupportTeam,"function");
  }
});

test("PYRO forge toolkit delegates Board and debug/test ownership outward",()=>{
  for(const [,,,create] of copies){
    const actions=create().createWorkshop().catalog().actions.map(item=>item.action);
    for(const forbidden of ["run_tests","read_ci","read_failure"]) assert.equal(actions.includes(forbidden),false,forbidden);
  }
});

test("permanent PYRO copies do not carry Board manager or training/debug fixtures",()=>{
  const removed=[
    "go-support-board.mjs","go-support-board-drill.mjs",
    "training-camp.mjs","training-gauntlet-runner.mjs","training-gauntlet.mjs","training-trainee.mjs",
    "lighthouse-owner17-assessment.mjs","lighthouse-owner17-field.mjs",
  ];
  for(const [,,dir] of copies){
    for(const name of removed){
      assert.equal(fs.existsSync(new URL(`../factory-assembly/helpers/${dir}/${name}`,import.meta.url)),false,`${dir}/${name}`);
    }
  }
});
