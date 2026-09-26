import test from "node:test";
import assert from "node:assert/strict";
import {
  createTrainingCamp,
  trainingStage,
  swarmBoardStage,
  scoreTrainingSubmission,
  summarizeTraining,
} from "../room-trunk/training-camp.mjs";

test("training camp contains the three stages BIG asked for", () => {
  const camp=createTrainingCamp();
  assert.deepEqual(camp.stages.map(x=>x.stage),[
    "BOARD_CONTEXT",
    "LOGIC_REVIEW",
    "PROGRAM_HANDS_ON",
  ]);
});

test("board stage grows to a complex board and gives three free-play assignments", () => {
  const camp=createTrainingCamp();
  const stage=swarmBoardStage(camp);
  assert.equal(stage.fixture.level,5);
  assert.equal(stage.fixture.missions.length,9);
  assert.equal(stage.assignments.assignments.length,3);
});

test("logic stage contains real contradictory branches to discover", () => {
  const stage=trainingStage(createTrainingCamp(),"LOGIC_REVIEW");
  assert.match(stage.fixture.code,/CANCELLED.*return true/s);
  assert.match(stage.fixture.code,/!target.*return true/s);
  assert.equal(stage.fixture.cases.length,4);
});

test("program stage is a runnable-style mini app with three bugs", () => {
  const stage=trainingStage(createTrainingCamp(),"PROGRAM_HANDS_ON");
  assert.equal(stage.fixture.app,"mini-task-queue");
  assert.equal(stage.fixture.bugs.length,3);
  assert.match(stage.fixture.files["queue.mjs"],/status:'OPEN'/);
});

test("scoring never upgrades missing evidence into a pass", () => {
  const result=scoreTrainingSubmission("LOGIC_REVIEW",{
    signals:["UNDERSTAND_INTENT_FIRST","FIND_CANCELLED_BRANCH"],
    unknowns:["MISSING_TARGET_BRANCH_NOT_CHECKED"],
  });
  assert.equal(result.passed,false);
  assert.equal(result.missed.includes("FIND_MISSING_TARGET_BRANCH"),true);
  assert.equal(result.unknowns.includes("MISSING_TARGET_BRANCH_NOT_CHECKED"),true);
});

test("three passed stages make the team ready for live GO support", () => {
  const camp=createTrainingCamp();
  const results=camp.stages.map(stage => scoreTrainingSubmission(stage.stage,{
    signals:stage.expectedSignals,
    evidenceRefs:["evidence://" + stage.stage],
  }));
  const report=summarizeTraining(results);
  assert.equal(report.passedStages,3);
  assert.equal(report.readyForLiveGoSupport,true);
});
