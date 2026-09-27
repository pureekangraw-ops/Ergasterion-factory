import {
  HERMES_CONTRACT,
  HERMES_SESSION_CONTRACT,
  immutable,
  requireText,
  safeClone,
} from "./contracts.mjs";
import { rankMissionCards } from "./mission-match.mjs";
import {
  addLightReply,
  addMissionNote,
  attachFirstOpen,
  createMissionCard,
  returnMissionCard,
  selectMissionContext,
  setMissionRoute,
  touchMissionCard,
} from "./mission-card.mjs";
import {
  createHeimdallFirstOpenRequest,
  createLightContextRequest,
  normalizeFirstOpenResponse,
} from "./handoffs.mjs";

const nowIso = () => new Date().toISOString();

function sessionView(session) {
  return immutable({
    contract:HERMES_SESSION_CONTRACT,
    sessionId:session.sessionId,
    agentId:session.agentId,
    missionInput:session.missionInput,
    status:session.status,
    cardId:session.cardId,
    enteredAt:session.enteredAt,
    exitedAt:session.exitedAt || null,
    returnRequired:session.status !== "EXITED",
    trace:safeClone(session.trace),
  });
}

export function createHermesAgentMission({
  now = nowIso,
  id = prefix => `${prefix}-${Date.now()}`,
  seedCards = [],
} = {}) {
  const cards = new Map(seedCards.map(card => [card.cardId, safeClone(card)]));
  const sessions = new Map();

  function emit(session, event, detail = null) {
    session.trace.push({ event, detail:safeClone(detail), at:now() });
  }

  function getSession(sessionId) {
    const session = sessions.get(requireText(sessionId,"SESSION_ID"));
    if (!session) throw new Error("HERMES_SESSION_NOT_FOUND");
    return session;
  }

  function getCard(cardId) {
    const card = cards.get(requireText(cardId,"CARD_ID"));
    if (!card) throw new Error("HERMES_CARD_NOT_FOUND");
    return safeClone(card);
  }

  function storeCard(card) {
    cards.set(card.cardId, safeClone(card));
    return safeClone(card);
  }

  function enter({ sessionId, agentId, mission } = {}) {
    const sid = requireText(sessionId,"SESSION_ID");
    if (sessions.has(sid)) throw new Error("HERMES_DUPLICATE_SESSION");
    const session = {
      sessionId:sid,
      agentId:requireText(agentId,"AGENT_ID"),
      missionInput:requireText(mission,"MISSION"),
      status:"ENTERED",
      cardId:null,
      enteredAt:now(),
      exitedAt:null,
      trace:[],
    };
    sessions.set(sid, session);
    emit(session,"ENTER",{ mission:session.missionInput });
    return sessionView(session);
  }

  function candidates(sessionId, options = {}) {
    const session = getSession(sessionId);
    return rankMissionCards(session.missionInput, [...cards.values()], options);
  }

  function chooseExisting(sessionId, cardId) {
    const session = getSession(sessionId);
    if (session.status !== "ENTERED") throw new Error("HERMES_CARD_ALREADY_RESOLVED");
    const card = getCard(cardId);
    session.cardId = card.cardId;
    session.status = "CARD_READY";
    emit(session,"CARD_REUSED",{ cardId:card.cardId, revision:card.revision });
    return { session:sessionView(session), card };
  }

  function createNew(sessionId, { cardId = null, requestedResult = null, tags = [] } = {}) {
    const session = getSession(sessionId);
    if (session.status !== "ENTERED") throw new Error("HERMES_CARD_ALREADY_RESOLVED");
    const createdAt = now();
    const card = createMissionCard({
      cardId:cardId || id("MISSION"),
      mission:session.missionInput,
      requestedResult,
      agentId:session.agentId,
      tags,
      createdAt,
    });
    if (cards.has(card.cardId)) throw new Error("HERMES_DUPLICATE_CARD");
    storeCard(card);
    session.cardId = card.cardId;
    session.status = "CARD_READY";
    emit(session,"CARD_CREATED",{ cardId:card.cardId });
    return { session:sessionView(session), card };
  }

  function selectContext(sessionId, input = {}) {
    const session = getSession(sessionId);
    if (!["CARD_READY","FIRST_OPEN_READY"].includes(session.status)) throw new Error("HERMES_CONTEXT_STAGE_INVALID");
    const card = storeCard(selectMissionContext(getCard(session.cardId), { ...input, at:now() }));
    emit(session,"CONTEXT_SELECTED",{ count:card.selectedContext.length, refs:card.contextRefs });
    return card;
  }

  function note(sessionId, input = {}) {
    const session = getSession(sessionId);
    if (!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    const card = storeCard(addMissionNote(getCard(session.cardId), { ...input, at:now() }));
    emit(session,"CARD_NOTE_ADDED",{ noteId:card.notes.at(-1)?.noteId });
    return card;
  }

  function askLight(sessionId, { requestId = null, question, availableRefs = [] } = {}) {
    const session = getSession(sessionId);
    if (!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    const packet = createLightContextRequest({
      requestId:requestId || id("LIGHT"),
      card:getCard(session.cardId),
      question,
      availableRefs,
    });
    emit(session,"LIGHT_ASKED",{ requestId:packet.requestId });
    return packet;
  }

  function receiveLight(sessionId, reply = {}) {
    const session = getSession(sessionId);
    if (!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    const card = storeCard(addLightReply(getCard(session.cardId), { ...reply, at:now() }));
    emit(session,"LIGHT_REPLY_RECEIVED",{ requestId:reply.requestId, candidateCount:reply.contextCandidates?.length || 0 });
    return card;
  }

  function prepareFirstOpen(sessionId, { requestId = null, destination, workspace = null } = {}) {
    const session = getSession(sessionId);
    if (session.status !== "CARD_READY") throw new Error("HERMES_FIRST_OPEN_STAGE_INVALID");
    const request = createHeimdallFirstOpenRequest({
      requestId:requestId || id("HEIMDALL"),
      card:getCard(session.cardId),
      destination,
      workspace,
    });
    session.status = "FIRST_OPEN_READY";
    emit(session,"HEIMDALL_FIRST_OPEN_REQUESTED",{ requestId:request.requestId, destination:request.destination });
    return request;
  }

  function acceptFirstOpen(sessionId, response) {
    const session = getSession(sessionId);
    if (session.status !== "FIRST_OPEN_READY") throw new Error("HERMES_FIRST_OPEN_STAGE_INVALID");
    const normalized = normalizeFirstOpenResponse(response);
    let card = attachFirstOpen(getCard(session.cardId), normalized, { at:now() });
    storeCard(card);
    emit(session,"HEIMDALL_FIRST_OPEN_RESULT",{ status:normalized.status, destination:normalized.destination });
    if (normalized.status === "BLOCKED" || normalized.status === "UNKNOWN") {
      session.status = "CARD_READY";
      return { ready:false, session:sessionView(session), card:getCard(session.cardId), firstOpen:normalized };
    }
    card = storeCard(setMissionRoute(card, {
      destination:normalized.destination,
      workspace:normalized.workspace,
      refs:normalized.openedRef ? [normalized.openedRef] : [],
    }, { at:now() }));
    session.status = "IN_MISSION";
    emit(session,"MISSION_DEPARTED",{ destination:card.route.destination });
    return { ready:true, session:sessionView(session), card, firstOpen:normalized };
  }

  function touch(sessionId, { station } = {}) {
    const session = getSession(sessionId);
    if (!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    return touchMissionCard(getCard(session.cardId), { station });
  }

  function returnCard(sessionId, update = {}) {
    const session = getSession(sessionId);
    if (!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    if (session.status === "EXITED") throw new Error("HERMES_SESSION_ALREADY_EXITED");
    if (session.status === "RETURNED") throw new Error("HERMES_CARD_ALREADY_RETURNED");
    const card = storeCard(returnMissionCard(getCard(session.cardId), { ...update, at:now() }));
    session.status = "RETURNED";
    emit(session,"CARD_RETURNED",{ revision:card.revision, status:card.status, mode:card.reality.mode });
    return { session:sessionView(session), card };
  }

  function recoveryReturn(sessionId, {
    result = null,
    nextAction = "Recover from last known mission reality",
    evidenceRefs = [],
    unknowns = ["SESSION_INTERRUPTED"],
    lastLocation = null,
  } = {}) {
    const session = getSession(sessionId);
    return returnCard(sessionId, {
      status:"WAIT",
      result,
      nextAction,
      evidenceRefs,
      unknowns,
      lastLocation,
      mode:"RECOVERY_RETURN",
    });
  }

  function exit(sessionId) {
    const session = getSession(sessionId);
    if (session.status !== "RETURNED") throw new Error("HERMES_RETURN_REQUIRED_BEFORE_EXIT");
    session.status = "EXITED";
    session.exitedAt = now();
    emit(session,"EXIT",{ cardId:session.cardId });
    return sessionView(session);
  }

  function inspect(sessionId) {
    const session = getSession(sessionId);
    return {
      contract:HERMES_CONTRACT,
      session:sessionView(session),
      card:session.cardId ? getCard(session.cardId) : null,
    };
  }

  function listCards() {
    return [...cards.values()].map(safeClone);
  }

  return Object.freeze({
    enter,
    candidates,
    chooseExisting,
    createNew,
    selectContext,
    note,
    askLight,
    receiveLight,
    prepareFirstOpen,
    acceptFirstOpen,
    touch,
    returnCard,
    recoveryReturn,
    exit,
    inspect,
    getCard,
    listCards,
  });
}
