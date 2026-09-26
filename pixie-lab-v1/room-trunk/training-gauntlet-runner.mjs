import {
  GAUNTLET_TRACKS,
  createGauntlet,
  scoreGauntlet,
  gauntletReport,
} from "./training-gauntlet.mjs";

const clone = value => value == null ? value : structuredClone(value);

function boardSignals(item) {
  const cards=item.fixture?.cards || [];
  const docs=item.fixture?.documents || [];
  const signals=[];

  if (item.fixture?.currentWork && cards.some(c=>c.id===item.fixture.currentWork)) signals.push("FIND_CURRENT_WORK");
  if (docs.some(d=>d.relevant===false)) signals.push("IGNORE_DISTRACTOR");

  const byWork=new Map();
  for(const doc of docs){
    if(!byWork.has(doc.workId)) byWork.set(doc.workId,[]);
    byWork.get(doc.workId).push(doc);
  }
  if ([...byWork.values()].some(list=>list.some(d=>d.current===true) && list.some(d=>d.current===false))) {
    signals.push("CHOOSE_CANONICAL_CURRENT");
  }
  if (docs.some(d=>d.duplicateOf)) signals.push("DEDUPE_HISTORY");
  if (cards.some(c=>(c.dependsOn||[]).length)) signals.push("KEEP_DEPENDENCY");
  if (cards.some(c=>(c.unknowns||[]).length)) signals.push("PRESERVE_UNKNOWN");

  const currentClaims=docs.filter(d=>d.current===true && d.claim);
  if (currentClaims.length>1 && new Set(currentClaims.map(d=>d.claim)).size>1) {
    signals.push("DETECT_CONTRADICTION");
    signals.push("NO_FAKE_RESOLUTION");
  }

  if (cards.some(c=>c.priority==="URGENT")) signals.push("PRIORITIZE_URGENT");
  if (cards.some(c=>c.status==="ACTIVE")) signals.push("KEEP_EXISTING_ACTIVE");

  return {
    signals:[...new Set(signals)],
    evidenceRefs:[
      "board://cards/"+cards.length,
      "board://documents/"+docs.length,
    ],
    unknowns:cards.flatMap(c=>(c.unknowns||[]).map(u=>c.id+":"+u)),
    notes:{cardCount:cards.length,documentCount:docs.length},
  };
}

function logicSignals(item) {
  const code=String(item.code||"");
  const intent=String(item.intent||"");
  const signals=[];
  const findings=[];

  if(intent) signals.push("UNDERSTAND_INTENT");

  if (/CANCELLED.*return true/.test(code)) {
    if (/mayRun\s*=.*CANCELLED/.test(code)) {
      signals.push("BOOLEAN_INVERSION");
      signals.push("MINIMAL_PATCH");
      findings.push("cancelled-inverted");
    } else {
      signals.push("EARLY_RETURN_BUG");
      signals.push("COUNTEREXAMPLE");
      signals.push("MINIMAL_PATCH");
      findings.push("cancelled-early-return");
    }
  }

  if (/!target.*return true/.test(code)) {
    if (!signals.includes("EARLY_RETURN_BUG")) signals.push("EARLY_RETURN_BUG");
    if (!signals.includes("COUNTEREXAMPLE")) signals.push("COUNTEREXAMPLE");
    if (!signals.includes("MINIMAL_PATCH")) signals.push("MINIMAL_PATCH");
    findings.push("missing-target-early-return");
  }

  if (/cachedStatus\s*\|\|\s*observedStatus/.test(code)) {
    signals.push("STALE_STATE_RISK","LATEST_REALITY_WINS","REGRESSION_CASE");
    findings.push("cached-state-wins-over-observed");
  }

  if (/if\s*\(testPassed\)\s*return ['"]PASS/.test(code) && /!evidence/.test(code)) {
    signals.push("FALSE_GREEN","EVIDENCE_REQUIRED","UNKNOWN_NOT_PASS","REGRESSION_CASE");
    findings.push("pass-before-evidence");
  }

  if (/CANCELLED.*status:['"]OPEN/.test(code)) {
    signals.push("TERMINAL_STATE_BROKEN","COUNTEREXAMPLE","MINIMAL_PATCH","REGRESSION_CASE");
    findings.push("cancelled-reopens");
  }

  if (/item\.result\s*\|\|\s*item\.verified/.test(code)) {
    signals.push("AND_NOT_OR","FALSE_DONE");
    if (!signals.includes("COUNTEREXAMPLE")) signals.push("COUNTEREXAMPLE");
    if (!signals.includes("MINIMAL_PATCH")) signals.push("MINIMAL_PATCH");
    if (!signals.includes("REGRESSION_CASE")) signals.push("REGRESSION_CASE");
    findings.push("done-on-partial-proof");
  }

  return {
    signals:[...new Set(signals)],
    evidenceRefs:["logic://source","logic://intent"],
    unknowns:[],
    notes:{findings},
  };
}

function programSignals(item) {
  const src=String(item.source||"");
  const signals=["RUN_FIRST"];
  const findings=[];

  if (/a\.priority-b\.priority/.test(src) || /a\.priority\s*-\s*b\.priority/.test(src)) findings.push("priority-direction");
  if (/status!==['"]DONE['"]/.test(src) && !/CANCELLED/.test(src)) findings.push("cancelled-filter");
  if (/status:['"]OPEN['"]/.test(src)) findings.push("finish-status");

  if (/retries\s*<=\s*job\.maxRetries/.test(src)) findings.push("retry-boundary");
  if (/retries:job\.retries\b/.test(src)) findings.push("retry-not-incremented");

  if (/event\.version\s*<\s*state\.version/.test(src) && /value:event\.value/.test(src)) findings.push("stale-event-mutates");
  if (/apply\(state,event\)/.test(src) && !/eventId|lastEventId|seen/.test(src)) findings.push("duplicate-event-not-idempotent");

  if (/dependencies\.some/.test(src)) findings.push("some-instead-of-every");
  if (/blockedReason\([^)]*\).*return null/.test(src)) findings.push("missing-blocked-reason");
  if (/dependencies/.test(src) && !/cycle/i.test(src)) findings.push("cycle-unreported");

  if (/for\(const event of events\)/.test(src) && !/eventId|seen|applied/.test(src)) findings.push("duplicate-events-reapplied");
  if (/events/.test(src) && !/version/.test(src)) findings.push("stale-events-reapplied");
  if (/status=['"]DONE['"]/.test(src) && !/verified|evidence/.test(src)) findings.push("unverified-done");

  if (item.level===1 && findings.length>=3) signals.push("FIND_ALL_BUGS","PATCH_MINIMALLY","RETEST");
  if (item.level===2 && findings.includes("retry-boundary")) signals.push("BOUNDARY_CASE","PATCH_MINIMALLY","RETEST");
  if (item.level===3) signals.push("STALE_WRITE","IDEMPOTENCY","PATCH_MINIMALLY","RETEST");
  if (item.level===4) signals.push("DEPENDENCY_ALL","BLOCK_REASON","CYCLE_RISK","RETEST");
  if (item.level===5) signals.push("IDEMPOTENCY","STALE_EVENT_FILTER","VERIFY_BEFORE_DONE","RECOVERY_EVIDENCE","RETEST");

  return {
    signals:[...new Set(signals)],
    evidenceRefs:["program://source","program://analysis"],
    unknowns:[],
    notes:{findings},
  };
}

export function runGauntlet({ roomId="ROOM-A" }={}) {
  const gauntlet=createGauntlet();
  const attempts=[];

  for(const track of GAUNTLET_TRACKS){
    for(const item of gauntlet.tracks[track]){
      const attempt =
        track==="BOARD_CONTEXT" ? boardSignals(item) :
        track==="LOGIC_REVIEW" ? logicSignals(item) :
        programSignals(item);

      attempts.push({
        roomId,
        track,
        level:item.level,
        title:item.title,
        attempt:clone(attempt),
        score:scoreGauntlet({
          track,
          level:item.level,
          signals:attempt.signals,
          evidenceRefs:attempt.evidenceRefs,
          unknowns:attempt.unknowns,
        }),
      });
    }
  }

  const report=gauntletReport(attempts.map(x=>x.score));
  return Object.freeze({
    roomId,
    attempts:clone(attempts),
    report,
  });
}
