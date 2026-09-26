import test from "node:test";
import assert from "node:assert/strict";
import { createPixieWorkshopToolkit } from "../room-trunk/workshop-tools.mjs";
import { createGoSupportTeam } from "../room-trunk/go-support-team.mjs";

function tracedHost() {
  const calls=[];
  const wrap=name=>async args=>{
    calls.push({name,args});
    return { status:"OK", evidenceRefs:["evidence://" + name + "/" + calls.length] };
  };
  return {
    calls,
    host:{
      inspectRepository:wrap("inspectRepository"),
      readFile:wrap("readFile"),
      compareRefs:wrap("compareRefs"),
      createBranch:wrap("createBranch"),
      writeFile:wrap("writeFile"),
      deleteFile:wrap("deleteFile"),
      runTests:wrap("runTests"),
      readCi:wrap("readCi"),
      readFailure:wrap("readFailure"),
      openPullRequest:wrap("openPullRequest"),
      roomMerge:wrap("roomMerge"),
      snapshot:wrap("snapshot"),
      rollback:wrap("rollback"),
      recordLesson:wrap("recordLesson"),
      emitEvidence:wrap("emitEvidence"),
    },
  };
}

test("GO can fan one mission out to all three free-play helpers", () => {
  const { host }=tracedHost();
  const team=createGoSupportTeam({ toolkit:createPixieWorkshopToolkit({host}) });

  const state=team.start({
    missionId:"GO-MISSION-1",
    mission:"หาวิธีทำให้ parser ดีขึ้น",
    requestedResult:"ได้ candidate ที่น่าลองต่อ",
  });

  assert.equal(state.requestedBy,"GO");
  assert.deepEqual(state.assignedRooms,["ROOM-A","ROOM-B","ROOM-C"]);
  assert.equal(state.roomStates.length,3);
  assert.equal(team.brief("GO-MISSION-1").operatingStyle,"INDEPENDENT_FREE_PLAY");
});

test("rooms can choose different actions without a prescribed workflow", async () => {
  const { host,calls }=tracedHost();
  const team=createGoSupportTeam({ toolkit:createPixieWorkshopToolkit({host}) });

  team.start({ missionId:"GO-MISSION-2", mission:"ช่วยโกตรวจของนี้" });

  await team.act("GO-MISSION-2","ROOM-A",{
    action:"read_file",
    why:"Inspect first.",
    args:{ targetRef:"room/pixie-a", path:"pixie-lab-v1/package.json" },
  });
  await team.act("GO-MISSION-2","ROOM-B",{
    action:"compare_refs",
    why:"Try a different angle.",
    args:{ baseRef:"room/pixie-a", headRef:"room/pixie-b" },
  });
  await team.act("GO-MISSION-2","ROOM-C",{
    action:"run_tests",
    why:"Check behavior independently.",
    args:{ targetRef:"room/pixie-c" },
  });

  assert.deepEqual(calls.map(x=>x.name),["readFile","compareRefs","runTests"]);
});

test("GO gets one combined readback with evidence and unknowns preserved", () => {
  const { host }=tracedHost();
  const team=createGoSupportTeam({ toolkit:createPixieWorkshopToolkit({host}) });

  team.start({ missionId:"GO-MISSION-3", mission:"ลองสามทาง" });
  team.note("GO-MISSION-3","ROOM-A",{ observation:"A found candidate.", evidenceRefs:["e://a"] });
  team.note("GO-MISSION-3","ROOM-B",{ observation:"B still unsure.", unknowns:["B_UNKNOWN"] });

  team.finishRoom("GO-MISSION-3","ROOM-A",{ result:{candidate:"A1"}, evidenceRefs:["e://a-pass"] });
  team.finishRoom("GO-MISSION-3","ROOM-B",{ result:{candidate:"B1"}, unknowns:["B_UNKNOWN"] });
  team.finishRoom("GO-MISSION-3","ROOM-C",{ result:{candidate:"C1"} });

  const collected=team.collect("GO-MISSION-3");
  assert.equal(collected.status,"READY_FOR_GO");
  assert.equal(collected.evidenceRefs.includes("e://a-pass"),true);
  assert.equal(collected.unknowns.includes("B_UNKNOWN"),true);

  const readback=team.finish("GO-MISSION-3",{
    summary:"สามห้องลองครบแล้ว ส่งผลกลับให้ GO",
    candidate:{preferredForNextExperiment:"A1"},
  });
  assert.equal(readback.to,"GO");
  assert.equal(readback.unknowns.includes("B_UNKNOWN"),true);
  assert.equal(readback.roomResults.length,3);
});
