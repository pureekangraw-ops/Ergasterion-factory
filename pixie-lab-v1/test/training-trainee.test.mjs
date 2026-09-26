import test from "node:test";
import assert from "node:assert/strict";
import { runPixieTraining } from "../room-trunk/training-trainee.mjs";

test("Pixie trainee completes all three drills", () => {
  const run=runPixieTraining({roomId:"ROOM-C"});
  assert.equal(run.attempts.length,3);
  assert.equal(run.report.passedStages,3);
  assert.equal(run.report.readyForLiveGoSupport,true);
});

test("logic drill returns root causes and a narrow patch", () => {
  const run=runPixieTraining({roomId:"ROOM-C"});
  const logic=run.attempts.find(x=>x.attempt.stage==="LOGIC_REVIEW");
  assert.equal(logic.score.passed,true);
  assert.equal(logic.attempt.notes.findings.length,2);
  assert.match(logic.attempt.notes.candidatePatch,/CANCELLED'\) return false/);
  assert.match(logic.attempt.notes.candidatePatch,/!target\) return false/);
});

test("program drill runs before and after behavior and fixes all three bugs", () => {
  const run=runPixieTraining({roomId:"ROOM-C"});
  const program=run.attempts.find(x=>x.attempt.stage==="PROGRAM_HANDS_ON");
  assert.equal(program.attempt.notes.before.passed,false);
  assert.equal(program.attempt.notes.after.passed,true);
  assert.deepEqual(program.attempt.notes.bugs.sort(),[
    "cancelled-task-not-filtered",
    "finish-task-keeps-open",
    "priority-sort-direction",
  ]);
});

test("board drill keeps waiting dependencies explicit", () => {
  const run=runPixieTraining({roomId:"ROOM-C"});
  const board=run.attempts.find(x=>x.attempt.stage==="BOARD_CONTEXT");
  assert.equal(board.score.passed,true);
  assert.equal(board.attempt.unknowns.some(x=>x.startsWith("WAITING_DEPENDENCY:")),true);
});
