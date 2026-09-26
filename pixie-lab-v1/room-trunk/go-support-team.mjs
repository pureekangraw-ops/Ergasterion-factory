import { createPixieApprentice } from "./apprentice-agent.mjs";

const clone = value => value == null ? value : structuredClone(value);
const text = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];
const nowIso = () => new Date().toISOString();

export const PIXIE_GO_SUPPORT_TEAM = "PIXIE_GO_SUPPORT_TEAM_V1";
export const GO_SUPPORT_ROOMS = Object.freeze(["ROOM-A","ROOM-B","ROOM-C"]);

function requireText(value,label) {
  const result = text(value);
  if (!result) throw new Error(label + "_REQUIRED");
  return result;
}

function assertRoom(roomId) {
  const room = requireText(roomId,"ROOM_ID").toUpperCase();
  if (!GO_SUPPORT_ROOMS.includes(room)) throw new Error("GO_SUPPORT_ROOM_INVALID:" + room);
  return room;
}

export function createGoSupportTeam({ toolkit, now = nowIso } = {}) {
  if (!toolkit?.catalog || !toolkit?.execute) throw new Error("PIXIE_WORKSHOP_TOOLKIT_REQUIRED");

  const apprentices = new Map(
    GO_SUPPORT_ROOMS.map(roomId => [roomId,createPixieApprentice({ toolkit, now })]),
  );
  const missions = new Map();

  function start({
    missionId,
    mission,
    requestedResult = null,
    contextRefs = [],
    constraints = [],
    rooms = GO_SUPPORT_ROOMS,
  } = {}) {
    const id = requireText(missionId,"MISSION_ID");
    if (missions.has(id)) throw new Error("DUPLICATE_GO_SUPPORT_MISSION");

    const assignedRooms = unique(rooms).map(assertRoom);
    if (!assignedRooms.length) throw new Error("GO_SUPPORT_ROOMS_REQUIRED");

    const item = {
      contract:PIXIE_GO_SUPPORT_TEAM,
      missionId:id,
      requestedBy:"GO",
      mission:requireText(mission,"MISSION"),
      requestedResult:text(requestedResult) || null,
      contextRefs:unique(contextRefs),
      constraints:unique(constraints),
      assignedRooms,
      status:"ACTIVE",
      startedAt:now(),
      finishedAt:null,
      finalReadback:null,
    };
    missions.set(id,item);

    for (const roomId of assignedRooms) {
      apprentices.get(roomId).startMission({
        sessionId:id + ":" + roomId,
        roomId,
        mission:item.mission,
        requestedResult:item.requestedResult,
        contextRefs:item.contextRefs,
        constraints:item.constraints,
      });
    }

    return inspect(id);
  }

  function roomSessionId(missionId,roomId) {
    return requireText(missionId,"MISSION_ID") + ":" + assertRoom(roomId);
  }

  function brief(missionId) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");
    return Object.freeze({
      mission:clone(mission),
      rooms:mission.assignedRooms.map(roomId => ({
        roomId,
        brief:apprentices.get(roomId).brief(roomSessionId(mission.missionId,roomId)),
      })),
      operatingStyle:"INDEPENDENT_FREE_PLAY",
      instruction:"Each assigned room may choose its own useful path. GO does not need to prescribe the workflow.",
    });
  }

  async function act(missionId,roomId,{ action, why = null, args = {} } = {}) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");
    const room = assertRoom(roomId);
    if (!mission.assignedRooms.includes(room)) throw new Error("GO_SUPPORT_ROOM_NOT_ASSIGNED:" + room);
    return apprentices.get(room).act(roomSessionId(mission.missionId,room),{ action, why, args });
  }

  function note(missionId,roomId,input = {}) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");
    const room = assertRoom(roomId);
    if (!mission.assignedRooms.includes(room)) throw new Error("GO_SUPPORT_ROOM_NOT_ASSIGNED:" + room);
    return apprentices.get(room).note(roomSessionId(mission.missionId,room),input);
  }

  function handoff(missionId,fromRoom,toRoom,input = {}) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");
    const source = assertRoom(fromRoom);
    const target = assertRoom(toRoom);
    if (!mission.assignedRooms.includes(source) || !mission.assignedRooms.includes(target)) {
      throw new Error("GO_SUPPORT_HANDOFF_ROOM_NOT_ASSIGNED");
    }
    return apprentices.get(source).handoff(
      roomSessionId(mission.missionId,source),
      { ...clone(input), toRoom:target },
    );
  }

  function finishRoom(missionId,roomId,input = {}) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");
    const room = assertRoom(roomId);
    if (!mission.assignedRooms.includes(room)) throw new Error("GO_SUPPORT_ROOM_NOT_ASSIGNED:" + room);
    return apprentices.get(room).finish(roomSessionId(mission.missionId,room),input);
  }

  function collect(missionId) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");

    const rooms = mission.assignedRooms.map(roomId => ({
      roomId,
      session:apprentices.get(roomId).inspect(roomSessionId(mission.missionId,roomId)),
    }));

    const evidenceRefs = unique(rooms.flatMap(item => item.session.evidenceRefs || []));
    const unknowns = unique(rooms.flatMap(item => item.session.unknowns || []));
    const finishedRooms = rooms.filter(item => item.session.status === "FINISHED").length;

    return Object.freeze({
      contract:PIXIE_GO_SUPPORT_TEAM,
      missionId:mission.missionId,
      requestedBy:"GO",
      mission:mission.mission,
      requestedResult:mission.requestedResult,
      status:finishedRooms === rooms.length ? "READY_FOR_GO" : finishedRooms ? "PARTIAL" : "ACTIVE",
      finishedRooms,
      totalRooms:rooms.length,
      rooms:clone(rooms),
      evidenceRefs,
      unknowns,
      collectedAt:now(),
    });
  }

  function finish(missionId,{ summary, candidate = null, evidenceRefs = [], unknowns = [] } = {}) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");

    const collected = collect(mission.missionId);
    mission.status = "FINISHED";
    mission.finishedAt = now();
    mission.finalReadback = {
      to:"GO",
      summary:requireText(summary,"SUMMARY"),
      candidate:clone(candidate),
      evidenceRefs:unique([...collected.evidenceRefs,...evidenceRefs]),
      unknowns:unique([...collected.unknowns,...unknowns]),
      roomResults:collected.rooms.map(item => ({
        roomId:item.roomId,
        status:item.session.status,
        finalResult:clone(item.session.finalResult),
      })),
    };
    return clone(mission.finalReadback);
  }

  function inspect(missionId) {
    const mission = missions.get(requireText(missionId,"MISSION_ID"));
    if (!mission) throw new Error("GO_SUPPORT_MISSION_NOT_FOUND");
    return clone({
      ...mission,
      roomStates:mission.assignedRooms.map(roomId => ({
        roomId,
        session:apprentices.get(roomId).inspect(roomSessionId(mission.missionId,roomId)),
      })),
    });
  }

  return Object.freeze({
    start,
    brief,
    act,
    note,
    handoff,
    finishRoom,
    collect,
    finish,
    inspect,
  });
}
