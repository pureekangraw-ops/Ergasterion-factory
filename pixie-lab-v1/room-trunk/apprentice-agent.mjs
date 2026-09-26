import { createLessonPacket } from "./lesson-packet.mjs";

const text = value => String(value ?? "").trim();
const clone = value => value == null ? value : structuredClone(value);
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];
const nowIso = () => new Date().toISOString();

export const PIXIE_APPRENTICE_SESSION = "PIXIE_APPRENTICE_SESSION_V1";

function requireText(value, label) {
  const result = text(value);
  if (!result) throw new Error(`${label}_REQUIRED`);
  return result;
}

function sessionView(session) {
  return clone({
    contract:PIXIE_APPRENTICE_SESSION,
    sessionId:session.sessionId,
    roomId:session.roomId,
    mission:session.mission,
    requestedResult:session.requestedResult,
    contextRefs:session.contextRefs,
    constraints:session.constraints,
    status:session.status,
    trace:session.trace,
    observations:session.observations,
    evidenceRefs:session.evidenceRefs,
    unknowns:session.unknowns,
    startedAt:session.startedAt,
    finishedAt:session.finishedAt || null,
    finalResult:session.finalResult ?? null,
  });
}

export function createPixieApprentice({ toolkit, now = nowIso } = {}) {
  if (!toolkit?.catalog || !toolkit?.execute) throw new Error("PIXIE_WORKSHOP_TOOLKIT_REQUIRED");
  const sessions = new Map();

  function startMission({
    sessionId,
    roomId,
    mission,
    requestedResult = null,
    contextRefs = [],
    constraints = [],
  } = {}) {
    const id = requireText(sessionId,"SESSION_ID");
    if (sessions.has(id)) throw new Error("DUPLICATE_APPRENTICE_SESSION");
    const room = requireText(roomId,"ROOM_ID").toUpperCase();
    const knownRooms = toolkit.catalog().rooms || [];
    if (!knownRooms.includes(room)) throw new Error(`APPRENTICE_ROOM_INVALID:${room}`);

    const session = {
      sessionId:id,
      roomId:room,
      mission:requireText(mission,"MISSION"),
      requestedResult:text(requestedResult) || null,
      contextRefs:unique(contextRefs),
      constraints:unique(constraints),
      status:"ACTIVE",
      trace:[],
      observations:[],
      evidenceRefs:[],
      unknowns:[],
      startedAt:now(),
      finishedAt:null,
      finalResult:null,
    };
    sessions.set(id,session);
    return sessionView(session);
  }

  function brief(sessionId) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("APPRENTICE_SESSION_NOT_FOUND");
    return clone({
      session:sessionView(session),
      toolbox:toolkit.catalog(),
      operatingStyle:"FREE_NEXT_ACTION",
      instruction:"Choose the next useful action from the toolbox based on the mission and current evidence. No fixed workflow is imposed.",
    });
  }

  async function act(sessionId, { action, why = null, args = {} } = {}) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("APPRENTICE_SESSION_NOT_FOUND");
    if (session.status !== "ACTIVE") throw new Error("APPRENTICE_SESSION_NOT_ACTIVE");

    const step = session.trace.length + 1;
    const requestId = `${session.sessionId}:STEP-${String(step).padStart(3,"0")}`;
    const output = await toolkit.execute({
      ...clone(args || {}),
      requestId,
      action,
      roomId:session.roomId,
    });

    const returnedEvidence = unique([
      ...(output?.result?.evidenceRefs || []),
      ...(output?.result?.evidence || []).map(item => item?.ref || item?.id),
    ]);
    session.evidenceRefs = unique([...session.evidenceRefs,...returnedEvidence]);

    if (output?.ok === false && output?.status === "TOOL_UNAVAILABLE") {
      session.unknowns = unique([...session.unknowns,`TOOL_UNAVAILABLE:${output.missingCapability}`]);
    }

    session.trace.push({
      step,
      action:text(action),
      why:text(why) || null,
      requestId,
      output:clone(output),
      at:now(),
    });

    return clone(session.trace.at(-1));
  }

  function note(sessionId, {
    observation,
    evidenceRefs = [],
    unknowns = [],
  } = {}) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("APPRENTICE_SESSION_NOT_FOUND");
    const item = {
      observation:requireText(observation,"OBSERVATION"),
      evidenceRefs:unique(evidenceRefs),
      unknowns:unique(unknowns),
      at:now(),
    };
    session.observations.push(item);
    session.evidenceRefs = unique([...session.evidenceRefs,...item.evidenceRefs]);
    session.unknowns = unique([...session.unknowns,...item.unknowns]);
    return clone(item);
  }

  function resolveUnknown(sessionId, unknown) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("APPRENTICE_SESSION_NOT_FOUND");
    const target = requireText(unknown,"UNKNOWN");
    session.unknowns = session.unknowns.filter(item => item !== target);
    return sessionView(session);
  }

  function handoff(sessionId, {
    toRoom,
    reusable = [],
    evidenceRefs = [],
    unknowns = [],
    topic = null,
  } = {}) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("APPRENTICE_SESSION_NOT_FOUND");
    const targetRoom = requireText(toRoom,"TO_ROOM").toUpperCase();
    const knownRooms = toolkit.catalog().rooms || [];
    if (!knownRooms.includes(targetRoom)) throw new Error(`APPRENTICE_ROOM_INVALID:${targetRoom}`);

    const packet = createLessonPacket({
      sourceRoom:session.roomId,
      sessionId:session.sessionId,
      topic:text(topic) || session.mission,
      reusable,
      evidenceRefs:unique([...session.evidenceRefs,...evidenceRefs]),
      unknowns:unique([...session.unknowns,...unknowns]),
    });

    return Object.freeze({
      fromRoom:session.roomId,
      toRoom:targetRoom,
      packet,
    });
  }

  function finish(sessionId, {
    result,
    evidenceRefs = [],
    unknowns = [],
  } = {}) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("APPRENTICE_SESSION_NOT_FOUND");
    session.finalResult = clone(result ?? null);
    session.evidenceRefs = unique([...session.evidenceRefs,...evidenceRefs]);
    session.unknowns = unique([...session.unknowns,...unknowns]);
    session.status = "FINISHED";
    session.finishedAt = now();
    return sessionView(session);
  }

  function inspect(sessionId) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("APPRENTICE_SESSION_NOT_FOUND");
    return sessionView(session);
  }

  return Object.freeze({
    startMission,
    brief,
    act,
    note,
    resolveUnknown,
    handoff,
    finish,
    inspect,
  });
}
