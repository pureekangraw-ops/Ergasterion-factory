import { projectGoSupportBoard } from "./go-support-board.mjs";

const clone = value => value == null ? value : structuredClone(value);
const text = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export const PIXIE_BOARD_DRILL = "PIXIE_BOARD_DRILL_V1";

export const BOARD_DRILL_LEVELS = Object.freeze([
  Object.freeze({
    level:1,
    name:"SINGLE_CLEAR_MISSION",
    description:"One clear mission, one requested result, no dependency.",
  }),
  Object.freeze({
    level:2,
    name:"PARALLEL_MISSIONS",
    description:"Several independent missions can be attacked in parallel.",
  }),
  Object.freeze({
    level:3,
    name:"DEPENDENCY_AND_UNKNOWN",
    description:"Some missions depend on evidence or answers from another mission.",
  }),
  Object.freeze({
    level:4,
    name:"CONTRADICTORY_EVIDENCE",
    description:"Rooms may return evidence that disagrees and must be compared.",
  }),
  Object.freeze({
    level:5,
    name:"LIVE_PRESSURE",
    description:"Mix active, blocked, stale, partial, and newly-arrived missions.",
  }),
]);

function mission(id, title, opts = {}) {
  return {
    missionId:id,
    mission:title,
    requestedResult:opts.requestedResult || "Return a useful candidate with evidence and preserved unknowns.",
    status:opts.status || "ACTIVE",
    assignedRooms:opts.assignedRooms || ["ROOM-A","ROOM-B","ROOM-C"],
    startedAt:opts.startedAt || null,
    finishedAt:null,
    roomStates:clone(opts.roomStates || []),
    dependencies:unique(opts.dependencies),
    tags:unique(opts.tags),
    priority:opts.priority || "NORMAL",
  };
}

export function createBoardDrill(level = 1) {
  const n = Number(level);
  if (!Number.isInteger(n) || n < 1 || n > BOARD_DRILL_LEVELS.length) {
    throw new Error("BOARD_DRILL_LEVEL_INVALID");
  }

  const missions = [
    mission("DRILL-001","Inspect a small parser change and return the most useful next experiment.",{
      tags:["CODE","SMALL"],
      priority:"NORMAL",
    }),
  ];

  if (n >= 2) {
    missions.push(
      mission("DRILL-002","Create two alternative interpretations of an ambiguous mission.",{tags:["REASONING","AMBIGUOUS"]}),
      mission("DRILL-003","Review a visual concept and identify one concrete improvement.",{tags:["VISUAL","REVIEW"]}),
    );
  }

  if (n >= 3) {
    missions.push(
      mission("DRILL-004","Choose the next action for a task whose target is still unknown.",{
        tags:["UNKNOWN","TRIAGE"],
        priority:"HIGH",
      }),
      mission("DRILL-005","Continue only after DRILL-001 produces evidence.",{
        tags:["DEPENDENCY"],
        dependencies:["DRILL-001"],
      }),
    );
  }

  if (n >= 4) {
    missions.push(
      mission("DRILL-006","Resolve two plausible but conflicting claims without inventing certainty.",{
        tags:["CONTRADICTION","EVIDENCE"],
        priority:"HIGH",
        roomStates:[
          {roomId:"ROOM-A",session:{status:"FINISHED",trace:[],observations:[{observation:"Candidate X looks valid."}],evidenceRefs:["evidence://claim-x"],unknowns:[],finalResult:{claim:"X"}}},
          {roomId:"ROOM-B",session:{status:"FINISHED",trace:[],observations:[{observation:"Candidate Y looks valid."}],evidenceRefs:["evidence://claim-y"],unknowns:[],finalResult:{claim:"Y"}}},
          {roomId:"ROOM-C",session:{status:"ACTIVE",trace:[],observations:[],evidenceRefs:[],unknowns:["CONTRADICTION_UNRESOLVED"],finalResult:null}},
        ],
      }),
    );
  }

  if (n >= 5) {
    missions.push(
      mission("DRILL-007","Recover a stale mission and determine whether its old evidence is still useful.",{tags:["STALE","RECOVERY"]}),
      mission("DRILL-008","Handle a newly arrived urgent mission while other work is still active.",{tags:["INTERRUPT","PRIORITY"],priority:"URGENT"}),
      mission("DRILL-009","Summarize the board for GO without dumping raw logs.",{tags:["SYNTHESIS","READBACK"]}),
    );
  }

  return Object.freeze({
    contract:PIXIE_BOARD_DRILL,
    level:n,
    profile:BOARD_DRILL_LEVELS[n-1],
    missions,
  });
}

export function projectDrillBoard(drill,{ now = () => new Date().toISOString() } = {}) {
  if (!drill?.missions) throw new Error("BOARD_DRILL_REQUIRED");
  const board=projectGoSupportBoard({missions:drill.missions,now});
  return Object.freeze({
    ...board,
    drill:{
      level:drill.level,
      name:drill.profile.name,
      description:drill.profile.description,
    },
  });
}

export function chooseSwarmTargets(drill,{ maxConcurrent = 3 } = {}) {
  if (!drill?.missions) throw new Error("BOARD_DRILL_REQUIRED");
  const rank={URGENT:3,HIGH:2,NORMAL:1};
  const completed=new Set(
    drill.missions.filter(m => m.status === "FINISHED").map(m => m.missionId),
  );

  const candidates=drill.missions
    .filter(m => m.status !== "FINISHED")
    .map(m => {
      const blockedBy=(m.dependencies || []).filter(id => !completed.has(id));
      return {
        missionId:m.missionId,
        mission:m.mission,
        priority:m.priority || "NORMAL",
        blockedBy,
        runnable:blockedBy.length === 0,
        tags:[...(m.tags || [])],
      };
    })
    .sort((a,b) => {
      if (a.runnable !== b.runnable) return a.runnable ? -1 : 1;
      return (rank[b.priority] || 0) - (rank[a.priority] || 0);
    });

  return Object.freeze({
    runnable:candidates.filter(x => x.runnable).slice(0,maxConcurrent),
    waiting:candidates.filter(x => !x.runnable),
  });
}

export function createSwarmAssignments(drill,{ rooms = ["ROOM-A","ROOM-B","ROOM-C"] } = {}) {
  const selection=chooseSwarmTargets(drill,{maxConcurrent:rooms.length});
  return Object.freeze({
    contract:"PIXIE_SWARM_ASSIGNMENT_V1",
    strategy:"FREE_ROOM_CHOICE",
    assignments:selection.runnable.map((target,index) => ({
      roomId:rooms[index % rooms.length],
      missionId:target.missionId,
      mission:target.mission,
      instruction:"Choose the most useful next action yourself; do not assume another room's method.",
      tags:target.tags,
    })),
    waiting:selection.waiting,
  });
}
