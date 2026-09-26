import test from "node:test";
import assert from "node:assert/strict";
import { createPixieWorkshopToolkit } from "../room-trunk/workshop-tools.mjs";
import { createPixieApprentice } from "../room-trunk/apprentice-agent.mjs";

function hostWithTrace() {
  const calls = [];
  const handler = name => async args => {
    calls.push({ name, args });
    return { status:"OK", ref:`evidence://${name}/${calls.length}` };
  };
  return {
    calls,
    host:{
      inspectRepository:handler("inspectRepository"),
      readFile:handler("readFile"),
      compareRefs:handler("compareRefs"),
      createBranch:handler("createBranch"),
      writeFile:handler("writeFile"),
      deleteFile:handler("deleteFile"),
      runTests:handler("runTests"),
      readCi:handler("readCi"),
      readFailure:handler("readFailure"),
      openPullRequest:handler("openPullRequest"),
      roomMerge:handler("roomMerge"),
      snapshot:handler("snapshot"),
      rollback:handler("rollback"),
      recordLesson:handler("recordLesson"),
      emitEvidence:handler("emitEvidence"),
    },
  };
}

test("apprentice sees mission and full toolbox without a prescribed route", () => {
  const { host } = hostWithTrace();
  const toolkit = createPixieWorkshopToolkit({ host });
  const apprentice = createPixieApprentice({ toolkit, now:() => "2026-09-26T00:00:00.000Z" });

  apprentice.startMission({
    sessionId:"MISSION-1",
    roomId:"ROOM-A",
    mission:"ลองหาวิธีทำ visual parser ให้เข้าใจภาพง่ายขึ้น",
    requestedResult:"ได้ prototype ที่น่าสนใจพร้อมหลักฐาน",
  });

  const brief = apprentice.brief("MISSION-1");
  assert.equal(brief.operatingStyle,"FREE_NEXT_ACTION");
  assert.equal(brief.toolbox.actions.length >= 15,true);
  assert.match(brief.instruction,/No fixed workflow/);
});

test("apprentice may choose useful actions in any order and keeps a trace", async () => {
  const { host, calls } = hostWithTrace();
  const toolkit = createPixieWorkshopToolkit({ host });
  const apprentice = createPixieApprentice({ toolkit });

  apprentice.startMission({
    sessionId:"MISSION-2",
    roomId:"ROOM-B",
    mission:"ลอง parser แบบใหม่",
  });

  await apprentice.act("MISSION-2",{
    action:"write_file",
    why:"Try the smallest prototype first.",
    args:{
      targetRef:"feature/room-b-parser-play",
      path:"pixie-lab-v1/experiments/parser.mjs",
      content:"export const parser = true;",
    },
  });
  await apprentice.act("MISSION-2",{
    action:"read_file",
    why:"Inspect the result after writing.",
    args:{
      targetRef:"feature/room-b-parser-play",
      path:"pixie-lab-v1/experiments/parser.mjs",
    },
  });

  const state = apprentice.inspect("MISSION-2");
  assert.equal(state.trace.length,2);
  assert.deepEqual(calls.map(x => x.name),["writeFile","readFile"]);
});

test("tool gaps become explicit unknowns while the session remains usable", async () => {
  const toolkit = createPixieWorkshopToolkit({ host:{} });
  const apprentice = createPixieApprentice({ toolkit });

  apprentice.startMission({
    sessionId:"MISSION-3",
    roomId:"ROOM-C",
    mission:"ตรวจ test รอบทดลอง",
  });

  const step = await apprentice.act("MISSION-3",{ action:"run_tests" });
  assert.equal(step.output.status,"TOOL_UNAVAILABLE");
  assert.equal(apprentice.inspect("MISSION-3").unknowns.includes("TOOL_UNAVAILABLE:runTests"),true);
});

test("handoff transfers lessons and evidence without transferring working state", () => {
  const { host } = hostWithTrace();
  const toolkit = createPixieWorkshopToolkit({ host });
  const apprentice = createPixieApprentice({ toolkit });

  apprentice.startMission({
    sessionId:"MISSION-4",
    roomId:"ROOM-A",
    mission:"ทดลอง layout",
  });
  apprentice.note("MISSION-4",{
    observation:"One focal object reads faster.",
    evidenceRefs:["artifact://layout-v2"],
    unknowns:["AUDIENCE_RESPONSE_UNMEASURED"],
  });

  const handoff = apprentice.handoff("MISSION-4",{
    toRoom:"ROOM-C",
    reusable:["Prefer one dominant focal object when instant recognition matters."],
  });

  assert.equal(handoff.toRoom,"ROOM-C");
  assert.equal(handoff.packet.transfer.carriesWorkingState,false);
  assert.equal(handoff.packet.transfer.carriesAssumptions,false);
  assert.deepEqual(handoff.packet.evidenceRefs,["artifact://layout-v2"]);
});

test("finish records the result without pretending unknowns disappeared", () => {
  const { host } = hostWithTrace();
  const toolkit = createPixieWorkshopToolkit({ host });
  const apprentice = createPixieApprentice({ toolkit });

  apprentice.startMission({
    sessionId:"MISSION-5",
    roomId:"ROOM-A",
    mission:"ลองวิธีใหม่",
  });
  apprentice.note("MISSION-5",{ observation:"Prototype runs.", unknowns:["REAL_USER_RESPONSE_UNKNOWN"] });

  const result = apprentice.finish("MISSION-5",{
    result:{ candidate:"V2" },
    evidenceRefs:["test://pass"],
  });

  assert.equal(result.status,"FINISHED");
  assert.deepEqual(result.finalResult,{ candidate:"V2" });
  assert.equal(result.unknowns.includes("REAL_USER_RESPONSE_UNKNOWN"),true);
});
