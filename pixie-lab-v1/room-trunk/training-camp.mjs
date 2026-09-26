import { createBoardDrill, createSwarmAssignments } from "./go-support-board-drill.mjs";

const clone = value => value == null ? value : structuredClone(value);
const text = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export const PIXIE_TRAINING_CAMP = "PIXIE_TRAINING_CAMP_V1";
export const TRAINING_STAGES = Object.freeze(["BOARD_CONTEXT","LOGIC_REVIEW","PROGRAM_HANDS_ON"]);

export function createTrainingCamp() {
  return Object.freeze({
    contract:PIXIE_TRAINING_CAMP,
    stages:[
      Object.freeze({
        stage:"BOARD_CONTEXT",
        mission:"อ่านบอร์ดงานและเอกสารที่ปะปนกัน จัดกลุ่มสิ่งที่เกี่ยวกับงานปัจจุบัน หา dependency และรักษา UNKNOWN",
        fixture:createBoardDrill(5),
        expectedSignals:["PRIORITIZE_ACTIVE_WORK","KEEP_DEPENDENCY","PRESERVE_UNKNOWN","IGNORE_IRRELEVANT_CONTEXT"],
      }),
      Object.freeze({
        stage:"LOGIC_REVIEW",
        mission:"เข้าใจเจตนาของลอจิคก่อนแก้ หา root cause จุดผิด และแยกอาการออกจากสาเหตุ",
        fixture:{
          intent:"A request may execute only when target exists and the item is not cancelled.",
          code:[
            "export function mayExecute(item, target) {",
            "  if (!item) return false;",
            "  if (item.status === 'CANCELLED') return true;",
            "  if (!target) return true;",
            "  return item.status !== 'DONE';",
            "}",
          ].join("\n"),
          cases:[
            {name:"active-with-target",item:{status:"OPEN"},target:"ROOM-A",expected:true},
            {name:"cancelled",item:{status:"CANCELLED"},target:"ROOM-A",expected:false},
            {name:"missing-target",item:{status:"OPEN"},target:null,expected:false},
            {name:"done",item:{status:"DONE"},target:"ROOM-A",expected:false},
          ],
        },
        expectedSignals:["UNDERSTAND_INTENT_FIRST","FIND_CANCELLED_BRANCH","FIND_MISSING_TARGET_BRANCH","NO_FALSE_FIX"],
      }),
      Object.freeze({
        stage:"PROGRAM_HANDS_ON",
        mission:"เข้าไปจัดการโปรแกรมเล็กจริง: รัน ตรวจ bug แก้ และยืนยันผลด้วย test",
        fixture:{
          app:"mini-task-queue",
          files:{
            "queue.mjs":[
              "export function nextTask(tasks = []) {",
              "  const open = tasks.filter(t => t.status !== 'DONE');",
              "  return open.sort((a,b) => a.priority - b.priority)[0] || null;",
              "}",
              "",
              "export function finishTask(task) {",
              "  return { ...task, status:'OPEN' };",
              "}",
            ].join("\n"),
          },
          cases:[
            {
              name:"high-priority-first",
              input:[
                {id:"LOW",status:"OPEN",priority:1},
                {id:"HIGH",status:"OPEN",priority:10},
              ],
              expectedTaskId:"HIGH",
            },
            {
              name:"cancelled-never-selected",
              input:[
                {id:"CANCELLED",status:"CANCELLED",priority:99},
                {id:"OPEN",status:"OPEN",priority:1},
              ],
              expectedTaskId:"OPEN",
            },
            {
              name:"finish-task",
              input:{id:"T-1",status:"OPEN",priority:5},
              expectedStatus:"DONE",
            },
          ],
          bugs:[
            "priority-sort-direction",
            "cancelled-task-not-filtered",
            "finish-task-keeps-open",
          ],
        },
        expectedSignals:["RUN_BEFORE_CLAIM","FIND_ALL_3_BUGS","PATCH_MINIMALLY","RETEST_AFTER_PATCH"],
      }),
    ],
  });
}

export function trainingStage(camp, stage) {
  const wanted=text(stage).toUpperCase();
  const found=camp?.stages?.find(item => item.stage === wanted);
  if (!found) throw new Error("TRAINING_STAGE_NOT_FOUND:" + wanted);
  return clone(found);
}

export function swarmBoardStage(camp) {
  const board=trainingStage(camp,"BOARD_CONTEXT");
  return Object.freeze({
    stage:board.stage,
    mission:board.mission,
    assignments:createSwarmAssignments(board.fixture),
    fixture:clone(board.fixture),
  });
}

export function scoreTrainingSubmission(stage, submission = {}) {
  const found = createTrainingCamp().stages.find(item => item.stage === text(stage).toUpperCase());
  if (!found) throw new Error("TRAINING_STAGE_NOT_FOUND");

  const observed=unique(submission.signals);
  const expected=[...found.expectedSignals];
  const hits=expected.filter(signal => observed.includes(signal));
  const missed=expected.filter(signal => !observed.includes(signal));

  return Object.freeze({
    stage:found.stage,
    passed:missed.length === 0,
    score:hits.length,
    maxScore:expected.length,
    hits,
    missed,
    evidenceRefs:unique(submission.evidenceRefs),
    unknowns:unique(submission.unknowns),
    notes:clone(submission.notes ?? null),
  });
}

export function summarizeTraining(results = []) {
  const normalized=results.map(clone);
  return Object.freeze({
    contract:"PIXIE_TRAINING_REPORT_V1",
    stages:normalized,
    passedStages:normalized.filter(x => x.passed).length,
    totalStages:TRAINING_STAGES.length,
    readyForLiveGoSupport:
      TRAINING_STAGES.every(stage => normalized.some(x => x.stage === stage && x.passed)),
    unresolved:unique(normalized.flatMap(x => x.unknowns || [])),
  });
}
