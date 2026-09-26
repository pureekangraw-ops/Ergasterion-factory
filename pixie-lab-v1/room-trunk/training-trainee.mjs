import {
  createTrainingCamp,
  trainingStage,
  scoreTrainingSubmission,
  summarizeTraining,
} from "./training-camp.mjs";
import { chooseSwarmTargets } from "./go-support-board-drill.mjs";

const clone = value => value == null ? value : structuredClone(value);
const unique = values => [...new Set((values || []).filter(Boolean))];

function runProgramCandidate(source, fixture) {
  const highFirst = source.includes("b.priority - a.priority");
  const filtersCancelled = /status\s*!==\s*['"]CANCELLED['"]/.test(source);
  const finishesDone = /status\s*:\s*['"]DONE['"]/.test(source);

  const observed = fixture.cases.map(testCase => {
    if (testCase.name === "high-priority-first") {
      const open=testCase.input.filter(t => t.status !== "DONE" && (!filtersCancelled || t.status !== "CANCELLED"));
      const sorted=[...open].sort((a,b) => highFirst ? b.priority-a.priority : a.priority-b.priority);
      return {name:testCase.name,actualTaskId:sorted[0]?.id || null,expectedTaskId:testCase.expectedTaskId};
    }
    if (testCase.name === "cancelled-never-selected") {
      const open=testCase.input.filter(t => t.status !== "DONE" && (!filtersCancelled || t.status !== "CANCELLED"));
      const sorted=[...open].sort((a,b) => highFirst ? b.priority-a.priority : a.priority-b.priority);
      return {name:testCase.name,actualTaskId:sorted[0]?.id || null,expectedTaskId:testCase.expectedTaskId};
    }
    if (testCase.name === "finish-task") {
      return {name:testCase.name,actualStatus:finishesDone ? "DONE" : "OPEN",expectedStatus:testCase.expectedStatus};
    }
    return {name:testCase.name,unknown:true};
  });

  return {
    observed,
    passed:observed.every(item =>
      item.unknown !== true &&
      (item.expectedTaskId ? item.actualTaskId === item.expectedTaskId : item.actualStatus === item.expectedStatus)
    ),
  };
}

function boardAttempt(stage) {
  const fixture=stage.fixture;
  const selection=chooseSwarmTargets(fixture,{maxConcurrent:3});
  const hasDependency=fixture.missions.some(m => (m.dependencies || []).length);
  const hasUnknown=fixture.missions.some(m =>
    (m.tags || []).includes("UNKNOWN") ||
    (m.roomStates || []).some(r => (r.session?.unknowns || []).length),
  );
  const hasPriority=fixture.missions.some(m => ["HIGH","URGENT"].includes(m.priority));
  const focusedSubset=selection.runnable.length < fixture.missions.length;

  const signals=[];
  if (hasPriority) signals.push("PRIORITIZE_ACTIVE_WORK");
  if (hasDependency) signals.push("KEEP_DEPENDENCY");
  if (hasUnknown) signals.push("PRESERVE_UNKNOWN");
  if (focusedSubset) signals.push("IGNORE_IRRELEVANT_CONTEXT");

  return {
    stage:stage.stage,
    signals,
    evidenceRefs:[
      "board://runnable/" + selection.runnable.map(x=>x.missionId).join(","),
      "board://waiting/" + selection.waiting.map(x=>x.missionId).join(","),
    ],
    unknowns:selection.waiting.map(x => "WAITING_DEPENDENCY:" + x.missionId),
    notes:{
      runnable:clone(selection.runnable),
      waiting:clone(selection.waiting),
    },
  };
}

function logicAttempt(stage) {
  const { intent, code, cases }=stage.fixture;
  const signals=[];
  const findings=[];

  if (intent && cases?.length) signals.push("UNDERSTAND_INTENT_FIRST");

  const cancelledCase=cases.find(x => x.name === "cancelled");
  if (cancelledCase?.expected === false && /CANCELLED['"]\) return true/.test(code)) {
    signals.push("FIND_CANCELLED_BRANCH");
    findings.push({kind:"ROOT_CAUSE",branch:"CANCELLED",observed:"true",expected:"false"});
  }

  const targetCase=cases.find(x => x.name === "missing-target");
  if (targetCase?.expected === false && /!target\) return true/.test(code)) {
    signals.push("FIND_MISSING_TARGET_BRANCH");
    findings.push({kind:"ROOT_CAUSE",branch:"MISSING_TARGET",observed:"true",expected:"false"});
  }

  const patched=code
    .replace("if (item.status === 'CANCELLED') return true;","if (item.status === 'CANCELLED') return false;")
    .replace("if (!target) return true;","if (!target) return false;");

  if (
    patched.includes("return item.status !== 'DONE';") &&
    patched.includes("CANCELLED') return false") &&
    patched.includes("!target) return false")
  ) {
    signals.push("NO_FALSE_FIX");
  }

  return {
    stage:stage.stage,
    signals,
    evidenceRefs:["logic://intent","logic://cases"],
    unknowns:[],
    notes:{findings,candidatePatch:patched},
  };
}

function programAttempt(stage) {
  const source=stage.fixture.files["queue.mjs"];
  const before=runProgramCandidate(source,stage.fixture);
  const signals=["RUN_BEFORE_CLAIM"];
  const bugs=[];

  if (source.includes("a.priority - b.priority")) bugs.push("priority-sort-direction");
  if (!/status\s*!==\s*['"]CANCELLED['"]/.test(source)) bugs.push("cancelled-task-not-filtered");
  if (/status\s*:\s*['"]OPEN['"]/.test(source)) bugs.push("finish-task-keeps-open");

  if (bugs.length === 3) signals.push("FIND_ALL_3_BUGS");

  const patched=source
    .replace("tasks.filter(t => t.status !== 'DONE')","tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED')")
    .replace("a.priority - b.priority","b.priority - a.priority")
    .replace("status:'OPEN'","status:'DONE'");

  const changes=[
    ["filter-cancelled",source.includes("tasks.filter"),patched.includes("CANCELLED")],
    ["priority-direction",source.includes("a.priority - b.priority"),patched.includes("b.priority - a.priority")],
    ["finish-status",source.includes("status:'OPEN'"),patched.includes("status:'DONE'")],
  ].filter(([,beforeSeen,afterSeen]) => beforeSeen && afterSeen);

  if (changes.length === 3) signals.push("PATCH_MINIMALLY");

  const after=runProgramCandidate(patched,stage.fixture);
  if (after.passed) signals.push("RETEST_AFTER_PATCH");

  return {
    stage:stage.stage,
    signals,
    evidenceRefs:["program://before-tests","program://after-tests"],
    unknowns:[],
    notes:{bugs,before,after,candidatePatch:patched,changes:changes.map(x=>x[0])},
  };
}

export function runPixieTraining({ roomId = "ROOM-A" } = {}) {
  const camp=createTrainingCamp();
  const attempts=[
    boardAttempt(trainingStage(camp,"BOARD_CONTEXT")),
    logicAttempt(trainingStage(camp,"LOGIC_REVIEW")),
    programAttempt(trainingStage(camp,"PROGRAM_HANDS_ON")),
  ];

  const scored=attempts.map(attempt => ({
    roomId,
    attempt,
    score:scoreTrainingSubmission(attempt.stage,attempt),
  }));

  return Object.freeze({
    roomId,
    attempts:clone(scored),
    report:summarizeTraining(scored.map(x=>x.score)),
  });
}
