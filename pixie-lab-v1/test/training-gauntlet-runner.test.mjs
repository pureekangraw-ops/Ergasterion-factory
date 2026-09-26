import test from "node:test";
import assert from "node:assert/strict";
import { runGauntlet } from "../room-trunk/training-gauntlet-runner.mjs";

test("Pixie runner attempts all 15 gauntlet levels",()=>{
  const run=runGauntlet({roomId:"ROOM-B"});
  assert.equal(run.attempts.length,15);
  assert.equal(run.report.total,15);
});

test("Pixie runner passes the full gauntlet without reading expected signals directly",()=>{
  const run=runGauntlet({roomId:"ROOM-B"});
  assert.equal(run.report.passed,15);
  assert.equal(run.report.complete,true);
});

test("hard logic level finds both terminal-state and partial-proof failures",()=>{
  const run=runGauntlet({roomId:"ROOM-B"});
  const hard=run.attempts.find(x=>x.track==="LOGIC_REVIEW" && x.level===5);
  assert.equal(hard.score.passed,true);
  assert.equal(hard.attempt.notes.findings.includes("cancelled-reopens"),true);
  assert.equal(hard.attempt.notes.findings.includes("done-on-partial-proof"),true);
});

test("hard program level reports recovery-related bugs",()=>{
  const run=runGauntlet({roomId:"ROOM-B"});
  const hard=run.attempts.find(x=>x.track==="PROGRAM_HANDS_ON" && x.level===5);
  assert.equal(hard.score.passed,true);
  assert.equal(hard.attempt.notes.findings.includes("duplicate-events-reapplied"),true);
  assert.equal(hard.attempt.notes.findings.includes("stale-events-reapplied"),true);
  assert.equal(hard.attempt.notes.findings.includes("unverified-done"),true);
});
