import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_DRILL_LEVELS,
  createBoardDrill,
  projectDrillBoard,
  chooseSwarmTargets,
  createSwarmAssignments,
} from "../room-trunk/go-support-board-drill.mjs";

test("board drill grows in complexity by level", () => {
  const sizes=[];
  for(let level=1; level<=BOARD_DRILL_LEVELS.length; level++){
    sizes.push(createBoardDrill(level).missions.length);
  }
  assert.deepEqual(sizes,[1,3,5,6,9]);
});

test("level 3 introduces dependency and unknown work", () => {
  const drill=createBoardDrill(3);
  const dep=drill.missions.find(x=>x.missionId==="DRILL-005");
  const unk=drill.missions.find(x=>x.missionId==="DRILL-004");
  assert.deepEqual(dep.dependencies,["DRILL-001"]);
  assert.equal(unk.tags.includes("UNKNOWN"),true);
});

test("level 4 carries contradictory evidence without auto-resolving it", () => {
  const drill=createBoardDrill(4);
  const item=drill.missions.find(x=>x.missionId==="DRILL-006");
  assert.equal(item.roomStates[0].session.finalResult.claim,"X");
  assert.equal(item.roomStates[1].session.finalResult.claim,"Y");
  assert.equal(item.roomStates[2].session.unknowns.includes("CONTRADICTION_UNRESOLVED"),true);
});

test("board projection stays read-only and exposes complexity", () => {
  const board=projectDrillBoard(createBoardDrill(5),{now:()=>"2026-09-26T16:00:00.000Z"});
  assert.equal(board.projectionOnly,true);
  assert.equal(board.drill.level,5);
  assert.equal(board.cards.length,9);
});

test("swarm selects runnable missions and leaves dependencies waiting", () => {
  const drill=createBoardDrill(3);
  const selection=chooseSwarmTargets(drill,{maxConcurrent:3});
  assert.equal(selection.runnable.length,3);
  assert.equal(selection.waiting.some(x=>x.missionId==="DRILL-005"),true);
});

test("three rooms can swarm three missions without fixed specialties", () => {
  const assignments=createSwarmAssignments(createBoardDrill(5));
  assert.equal(assignments.assignments.length,3);
  assert.deepEqual(assignments.assignments.map(x=>x.roomId),["ROOM-A","ROOM-B","ROOM-C"]);
  assert.equal(assignments.assignments.every(x=>x.instruction.includes("Choose the most useful next action")),true);
});
