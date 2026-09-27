const clone = value => value == null ? value : structuredClone(value);
const text = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export const PIXIE_GAUNTLET = "PIXIE_GAUNTLET_V1";
export const GAUNTLET_TRACKS = Object.freeze(["BOARD_CONTEXT","LOGIC_REVIEW","PROGRAM_HANDS_ON"]);

function boardLevels() {
  return [
    {
      level:1,
      title:"Clear board",
      fixture:{
        currentWork:"W-1",
        cards:[
          {id:"W-1",status:"ACTIVE",updated:5,dependsOn:[],doc:"DOC-W1"},
          {id:"W-2",status:"DONE",updated:4,dependsOn:[],doc:"DOC-W2"},
          {id:"W-3",status:"OPEN",updated:3,dependsOn:["W-2"],doc:"DOC-W3"},
        ],
        documents:[
          {id:"DOC-W1",workId:"W-1",version:2,current:true,relevant:true},
          {id:"DOC-W2",workId:"W-2",version:1,current:true,relevant:false},
          {id:"DOC-X",workId:"X",version:7,current:true,relevant:false},
        ],
      },
      expected:["FIND_CURRENT_WORK","IGNORE_DISTRACTOR"],
    },
    {
      level:2,
      title:"Duplicate and stale docs",
      fixture:{
        currentWork:"W-2",
        cards:[{id:"W-2",status:"ACTIVE",updated:10,dependsOn:[],doc:"DOC-W2-V3"}],
        documents:[
          {id:"DOC-W2-V1",workId:"W-2",version:1,current:false,relevant:true},
          {id:"DOC-W2-V2",workId:"W-2",version:2,current:false,relevant:true},
          {id:"DOC-W2-V3",workId:"W-2",version:3,current:true,relevant:true},
          {id:"DOC-W2-COPY",workId:"W-2",version:2,current:false,relevant:true,duplicateOf:"DOC-W2-V2"},
        ],
      },
      expected:["CHOOSE_CANONICAL_CURRENT","DEDUPE_HISTORY"],
    },
    {
      level:3,
      title:"Dependency and unknown",
      fixture:{
        currentWork:"W-3",
        cards:[
          {id:"W-3",status:"ACTIVE",updated:12,dependsOn:["W-4"],doc:"DOC-W3"},
          {id:"W-4",status:"OPEN",updated:11,dependsOn:[],doc:null,unknowns:["TARGET_UNKNOWN"]},
        ],
        documents:[{id:"DOC-W3",workId:"W-3",version:1,current:true,relevant:true}],
      },
      expected:["KEEP_DEPENDENCY","PRESERVE_UNKNOWN"],
    },
    {
      level:4,
      title:"Conflicting current claims",
      fixture:{
        currentWork:"W-5",
        cards:[{id:"W-5",status:"ACTIVE",updated:20,dependsOn:[],doc:null}],
        documents:[
          {id:"DOC-A",workId:"W-5",version:4,current:true,relevant:true,claim:"TARGET=A",evidence:"E-A"},
          {id:"DOC-B",workId:"W-5",version:4,current:true,relevant:true,claim:"TARGET=B",evidence:"E-B"},
        ],
      },
      expected:["DETECT_CONTRADICTION","NO_FAKE_RESOLUTION"],
    },
    {
      level:5,
      title:"Interrupt pressure",
      fixture:{
        currentWork:"W-6",
        cards:[
          {id:"W-6",status:"ACTIVE",priority:"NORMAL",updated:30,dependsOn:[],doc:"DOC-W6"},
          {id:"W-7",status:"OPEN",priority:"URGENT",updated:31,dependsOn:[],doc:"DOC-W7"},
          {id:"W-8",status:"PARTIAL",priority:"HIGH",updated:29,dependsOn:["W-9"],doc:"DOC-W8"},
          {id:"W-9",status:"OPEN",priority:"NORMAL",updated:25,dependsOn:[],doc:"DOC-W9",unknowns:["OWNER_UNKNOWN"]},
        ],
        documents:[
          {id:"DOC-W6",workId:"W-6",version:3,current:true,relevant:true},
          {id:"DOC-W7",workId:"W-7",version:1,current:true,relevant:true},
          {id:"DOC-W8",workId:"W-8",version:8,current:true,relevant:true},
          {id:"DOC-W9",workId:"W-9",version:1,current:true,relevant:true},
          {id:"BLOG-OLD",workId:"W-6",version:99,current:false,relevant:false,claim:"OUTDATED_DISTRACTOR"},
        ],
      },
      expected:["PRIORITIZE_URGENT","KEEP_EXISTING_ACTIVE","KEEP_DEPENDENCY","PRESERVE_UNKNOWN","IGNORE_DISTRACTOR"],
    },
  ];
}

function logicLevels() {
  return [
    {
      level:1,
      title:"Boolean inversion",
      intent:"Cancelled items never execute.",
      code:"export const mayRun = item => item.status === 'CANCELLED';",
      expected:["UNDERSTAND_INTENT","BOOLEAN_INVERSION","MINIMAL_PATCH"],
    },
    {
      level:2,
      title:"Early-return precedence",
      intent:"Missing target or cancelled state must stop execution.",
      code:[
        "export function mayRun(item,target){",
        " if (!item) return false;",
        " if (item.status === 'CANCELLED') return true;",
        " if (!target) return true;",
        " return true;",
        "}",
      ].join("\n"),
      expected:["UNDERSTAND_INTENT","EARLY_RETURN_BUG","COUNTEREXAMPLE","MINIMAL_PATCH"],
    },
    {
      level:3,
      title:"Stale cached state",
      intent:"Decision must use the latest observed status.",
      code:[
        "export function decide({ cachedStatus, observedStatus }) {",
        " const status = cachedStatus || observedStatus;",
        " return status === 'READY';",
        "}",
      ].join("\n"),
      expected:["STALE_STATE_RISK","LATEST_REALITY_WINS","REGRESSION_CASE"],
    },
    {
      level:4,
      title:"False green",
      intent:"PASS requires both test success and explicit evidence.",
      code:[
        "export function verdict({ testPassed, evidence }) {",
        " if (testPassed) return 'PASS';",
        " if (!evidence) return 'UNKNOWN';",
        " return 'FAIL';",
        "}",
      ].join("\n"),
      expected:["FALSE_GREEN","EVIDENCE_REQUIRED","UNKNOWN_NOT_PASS","REGRESSION_CASE"],
    },
    {
      level:5,
      title:"State-machine trap",
      intent:"OPEN may become DONE only after work result and verification are both present; CANCELLED is terminal.",
      code:[
        "export function advance(item){",
        " if (item.status === 'CANCELLED') return { ...item, status:'OPEN' };",
        " if (item.result || item.verified) return { ...item, status:'DONE' };",
        " return item;",
        "}",
      ].join("\n"),
      expected:["TERMINAL_STATE_BROKEN","AND_NOT_OR","FALSE_DONE","COUNTEREXAMPLE","MINIMAL_PATCH","REGRESSION_CASE"],
    },
  ];
}

function programLevels() {
  return [
    {
      level:1,
      title:"Queue basics",
      source:[
        "export function next(tasks=[]){",
        " const open=tasks.filter(t=>t.status!=='DONE');",
        " return open.sort((a,b)=>a.priority-b.priority)[0]||null;",
        "}",
        "export const finish=t=>({...t,status:'OPEN'});",
      ].join("\n"),
      bugs:["priority-direction","cancelled-filter","finish-status"],
      expected:["RUN_FIRST","FIND_ALL_BUGS","PATCH_MINIMALLY","RETEST"],
    },
    {
      level:2,
      title:"Retry off-by-one",
      source:[
        "export function canRetry(job){",
        " return job.retries <= job.maxRetries;",
        "}",
        "export function nextRetry(job){ return {...job,retries:job.retries}; }",
      ].join("\n"),
      bugs:["retry-boundary","retry-not-incremented"],
      expected:["RUN_FIRST","BOUNDARY_CASE","PATCH_MINIMALLY","RETEST"],
    },
    {
      level:3,
      title:"Idempotency and stale version",
      source:[
        "export function apply(state,event){",
        " if (event.version < state.version) return {...state,value:event.value};",
        " return {...state,value:event.value,version:event.version};",
        "}",
      ].join("\n"),
      bugs:["stale-event-mutates","duplicate-event-not-idempotent"],
      expected:["STALE_WRITE","IDEMPOTENCY","PATCH_MINIMALLY","RETEST"],
    },
    {
      level:4,
      title:"Dependency scheduler",
      source:[
        "export function runnable(job,done){",
        " return job.dependencies.some(id=>done.has(id));",
        "}",
        "export function blockedReason(job,done){ return null; }",
      ].join("\n"),
      bugs:["some-instead-of-every","missing-blocked-reason","cycle-unreported"],
      expected:["DEPENDENCY_ALL","BLOCK_REASON","CYCLE_RISK","RETEST"],
    },
    {
      level:5,
      title:"Resume after crash",
      source:[
        "export function resume(snapshot,events){",
        " let state={...snapshot};",
        " for(const event of events){",
        "  state={...state,...event.patch};",
        " }",
        " state.status='DONE';",
        " return state;",
        "}",
      ].join("\n"),
      bugs:["duplicate-events-reapplied","stale-events-reapplied","unverified-done"],
      expected:["IDEMPOTENCY","STALE_EVENT_FILTER","VERIFY_BEFORE_DONE","RECOVERY_EVIDENCE","RETEST"],
    },
  ];
}

export function createGauntlet() {
  return Object.freeze({
    contract:PIXIE_GAUNTLET,
    tracks:{
      BOARD_CONTEXT:boardLevels(),
      LOGIC_REVIEW:logicLevels(),
      PROGRAM_HANDS_ON:programLevels(),
    },
  });
}

export function gauntletLevel(track,level) {
  const key=text(track).toUpperCase();
  if (!GAUNTLET_TRACKS.includes(key)) throw new Error("GAUNTLET_TRACK_INVALID:" + key);
  const item=createGauntlet().tracks[key].find(x=>x.level===Number(level));
  if (!item) throw new Error("GAUNTLET_LEVEL_NOT_FOUND:" + key + ":" + level);
  return clone(item);
}

export function scoreGauntlet({ track,level,signals=[],evidenceRefs=[],unknowns=[] }={}) {
  const item=gauntletLevel(track,level);
  const observed=unique(signals);
  const expected=[...item.expected];
  const hits=expected.filter(x=>observed.includes(x));
  const missed=expected.filter(x=>!observed.includes(x));
  return Object.freeze({
    track:text(track).toUpperCase(),
    level:Number(level),
    passed:missed.length===0,
    score:hits.length,
    maxScore:expected.length,
    hits,
    missed,
    evidenceRefs:unique(evidenceRefs),
    unknowns:unique(unknowns),
  });
}

export function gauntletReport(results=[]){
  const rows=results.map(clone);
  const total=GAUNTLET_TRACKS.length*5;
  return Object.freeze({
    contract:"PIXIE_GAUNTLET_REPORT_V1",
    passed:rows.filter(x=>x.passed).length,
    total,
    complete:rows.length===total && rows.every(x=>x.passed),
    byTrack:Object.fromEntries(GAUNTLET_TRACKS.map(track=>[
      track,
      rows.filter(x=>x.track===track),
    ])),
    unresolved:unique(rows.flatMap(x=>x.unknowns||[])),
  });
}
