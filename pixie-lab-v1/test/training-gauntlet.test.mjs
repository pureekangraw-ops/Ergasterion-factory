import test from "node:test";
import assert from "node:assert/strict";
import {
  GAUNTLET_TRACKS,
  createGauntlet,
  gauntletLevel,
  scoreGauntlet,
  gauntletReport,
} from "../room-trunk/training-gauntlet.mjs";

test("gauntlet has 3 tracks x 5 levels",()=>{
  const g=createGauntlet();
  assert.deepEqual(Object.keys(g.tracks),GAUNTLET_TRACKS);
  assert.equal(Object.values(g.tracks).flat().length,15);
  assert.equal(Object.values(g.tracks).every(levels=>levels.length===5),true);
});

test("board level 5 contains interrupt, dependency, unknown and distractor pressure",()=>{
  const x=gauntletLevel("BOARD_CONTEXT",5);
  assert.equal(x.fixture.cards.some(c=>c.priority==="URGENT"),true);
  assert.equal(x.fixture.cards.some(c=>(c.dependsOn||[]).length>0),true);
  assert.equal(x.fixture.cards.some(c=>(c.unknowns||[]).length>0),true);
  assert.equal(x.fixture.documents.some(d=>d.relevant===false),true);
});

test("logic level 5 is a state-machine trap rather than a syntax puzzle",()=>{
  const x=gauntletLevel("LOGIC_REVIEW",5);
  assert.match(x.code,/CANCELLED/);
  assert.match(x.code,/result \|\| item\.verified/);
  assert.equal(x.expected.includes("TERMINAL_STATE_BROKEN"),true);
  assert.equal(x.expected.includes("AND_NOT_OR"),true);
});

test("program level 5 requires recovery semantics",()=>{
  const x=gauntletLevel("PROGRAM_HANDS_ON",5);
  assert.equal(x.bugs.length,3);
  assert.equal(x.expected.includes("VERIFY_BEFORE_DONE"),true);
  assert.equal(x.expected.includes("RECOVERY_EVIDENCE"),true);
});

test("scorer preserves misses and unknowns",()=>{
  const score=scoreGauntlet({
    track:"LOGIC_REVIEW",
    level:4,
    signals:["FALSE_GREEN","EVIDENCE_REQUIRED"],
    unknowns:["MISSING_REGRESSION_CASE"],
  });
  assert.equal(score.passed,false);
  assert.equal(score.missed.includes("REGRESSION_CASE"),true);
  assert.equal(score.unknowns.includes("MISSING_REGRESSION_CASE"),true);
});

test("full 15/15 produces complete report",()=>{
  const g=createGauntlet();
  const results=[];
  for(const track of GAUNTLET_TRACKS){
    for(const item of g.tracks[track]){
      results.push(scoreGauntlet({track,level:item.level,signals:item.expected,evidenceRefs:["e://"+track+"/"+item.level]}));
    }
  }
  const report=gauntletReport(results);
  assert.equal(report.passed,15);
  assert.equal(report.complete,true);
});
