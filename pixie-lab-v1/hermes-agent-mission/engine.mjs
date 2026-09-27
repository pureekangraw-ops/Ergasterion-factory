import {
  HERMES_CONTRACT,
  HERMES_SESSION_CONTRACT,
  immutable,
  requireText,
  safeClone,
} from "./contracts.mjs";
import { assertSameHubIdentity, validateHubCard } from "./hub-card.mjs";
import { rankMissionCards } from "./mission-match.mjs";
import {
  addMemoryLightReply,
  addMemoryNote,
  attachMemoryFirstOpen,
  createMissionMemory,
  recordMemoryReturn,
  selectMemoryContext,
} from "./mission-memory.mjs";
import {
  createCardIssueRequest,
  createCardReturnRequest,
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
  seedRecords = [],
} = {}) {
  const records = new Map();
  for (const value of seedRecords || []) {
    const card = validateHubCard(value.card || value);
    records.set(card.cardId, {
      card,
      memory:value.memory ? safeClone(value.memory) : null,
    });
  }
  const sessions = new Map();

  function emit(session,event,detail=null) {
    session.trace.push({ event, detail:safeClone(detail), at:now() });
  }
  function getSession(sessionId) {
    const session=sessions.get(requireText(sessionId,"SESSION_ID"));
    if(!session) throw new Error("HERMES_SESSION_NOT_FOUND");
    return session;
  }
  function getRecord(cardId) {
    const record=records.get(requireText(cardId,"CARD_ID"));
    if(!record) throw new Error("HERMES_CARD_NOT_FOUND");
    return safeClone(record);
  }
  function setRecord(record) {
    const card=validateHubCard(record.card);
    records.set(card.cardId,{ card, memory:record.memory ? safeClone(record.memory) : null });
    return getRecord(card.cardId);
  }
  function ensureMemory(record, session) {
    if(record.memory) return record.memory;
    return createMissionMemory({
      card:record.card,
      mission:session.missionInput,
      requestedResult:record.card.detail,
      agentId:session.agentId,
      createdAt:now(),
    });
  }

  function enter({sessionId,agentId,mission}={}) {
    const sid=requireText(sessionId,"SESSION_ID");
    if(sessions.has(sid)) throw new Error("HERMES_DUPLICATE_SESSION");
    const session={
      sessionId:sid,
      agentId:requireText(agentId,"AGENT_ID"),
      missionInput:requireText(mission,"MISSION"),
      status:"ENTERED",
      cardId:null,
      pendingIssue:null,
      pendingReturn:null,
      enteredAt:now(),
      exitedAt:null,
      trace:[],
    };
    sessions.set(sid,session);
    emit(session,"ENTER",{mission:session.missionInput});
    return sessionView(session);
  }

  function candidates(sessionId,options={}) {
    const session=getSession(sessionId);
    return rankMissionCards(session.missionInput,[...records.values()],options);
  }

  function chooseExisting(sessionId,cardId) {
    const session=getSession(sessionId);
    if(session.status!=="ENTERED") throw new Error("HERMES_CARD_ALREADY_RESOLVED");
    const record=getRecord(cardId);
    const memory=ensureMemory(record,session);
    setRecord({card:record.card,memory});
    session.cardId=record.card.cardId;
    session.status="CARD_READY";
    emit(session,"CARD_REUSED",{cardId:record.card.cardId,workId:record.card.workId,jobCode:record.card.jobCode});
    return {session:sessionView(session),...getRecord(record.card.cardId)};
  }

  function prepareNewCard(sessionId,{
    requestId=null,
    requestedResult,
    requestedDestinations=[],
    scope=[],
    workType="NORMAL",
  }={}) {
    const session=getSession(sessionId);
    if(session.status!=="ENTERED") throw new Error("HERMES_CARD_ALREADY_RESOLVED");
    const packet=createCardIssueRequest({
      requestId:requestId||id("CARD-ISSUE"),
      agentId:session.agentId,
      mission:session.missionInput,
      requestedResult,
      requestedDestinations,
      scope,
      workType,
    });
    session.pendingIssue=packet;
    session.status="CARD_ISSUE_PENDING";
    emit(session,"CARD_ISSUE_REQUESTED",{requestId:packet.requestId});
    return packet;
  }

  function acceptIssuedCard(sessionId,card) {
    const session=getSession(sessionId);
    if(session.status!=="CARD_ISSUE_PENDING"||!session.pendingIssue) throw new Error("HERMES_CARD_ISSUE_NOT_PENDING");
    const hubCard=validateHubCard(card);
    if(records.has(hubCard.cardId)) throw new Error("HERMES_DUPLICATE_CARD");
    const memory=createMissionMemory({
      card:hubCard,
      mission:session.missionInput,
      requestedResult:session.pendingIssue.expectedResult,
      agentId:session.agentId,
      createdAt:now(),
    });
    setRecord({card:hubCard,memory});
    session.cardId=hubCard.cardId;
    session.pendingIssue=null;
    session.status="CARD_READY";
    emit(session,"CARD_ISSUED",{cardId:hubCard.cardId,workId:hubCard.workId,jobCode:hubCard.jobCode});
    return {session:sessionView(session),...getRecord(hubCard.cardId)};
  }

  function selectContext(sessionId,input={}) {
    const session=getSession(sessionId);
    if(!["CARD_READY","FIRST_OPEN_READY"].includes(session.status)) throw new Error("HERMES_CONTEXT_STAGE_INVALID");
    const record=getRecord(session.cardId);
    const memory=selectMemoryContext(ensureMemory(record,session),{...input,at:now()});
    setRecord({card:record.card,memory});
    emit(session,"CONTEXT_SELECTED",{count:memory.selectedContext.length,refs:memory.contextRefs});
    return getRecord(session.cardId);
  }

  function note(sessionId,input={}) {
    const session=getSession(sessionId);
    if(!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    const record=getRecord(session.cardId);
    const memory=addMemoryNote(ensureMemory(record,session),{...input,at:now()});
    setRecord({card:record.card,memory});
    emit(session,"CARD_NOTE_ADDED",{noteId:memory.notes.at(-1)?.noteId});
    return getRecord(session.cardId);
  }

  function askLight(sessionId,{requestId=null,question,availableRefs=[]}={}) {
    const session=getSession(sessionId);
    if(!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    const record=getRecord(session.cardId);
    const packet=createLightContextRequest({
      requestId:requestId||id("LIGHT"),
      card:record.card,
      memory:ensureMemory(record,session),
      question,
      availableRefs,
    });
    emit(session,"LIGHT_ASKED",{requestId:packet.requestId});
    return packet;
  }

  function receiveLight(sessionId,reply={}) {
    const session=getSession(sessionId);
    if(!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    const record=getRecord(session.cardId);
    const memory=addMemoryLightReply(ensureMemory(record,session),{...reply,at:now()});
    setRecord({card:record.card,memory});
    emit(session,"LIGHT_REPLY_RECEIVED",{requestId:reply.requestId,candidateCount:reply.contextCandidates?.length||0});
    return getRecord(session.cardId);
  }

  function prepareFirstOpen(sessionId,{requestId=null,destination,workspace=null}={}) {
    const session=getSession(sessionId);
    if(session.status!=="CARD_READY") throw new Error("HERMES_FIRST_OPEN_STAGE_INVALID");
    const record=getRecord(session.cardId);
    const packet=createHeimdallFirstOpenRequest({
      requestId:requestId||id("HEIMDALL"),
      card:record.card,
      memory:ensureMemory(record,session),
      destination,
      workspace,
    });
    session.status="FIRST_OPEN_READY";
    emit(session,"HEIMDALL_FIRST_OPEN_REQUESTED",{requestId:packet.requestId,destination:packet.destination});
    return packet;
  }

  function acceptFirstOpen(sessionId,response) {
    const session=getSession(sessionId);
    if(session.status!=="FIRST_OPEN_READY") throw new Error("HERMES_FIRST_OPEN_STAGE_INVALID");
    const normalized=normalizeFirstOpenResponse(response);
    const record=getRecord(session.cardId);
    let card=record.card;
    if(normalized.card) {
      assertSameHubIdentity(card,normalized.card);
      card=normalized.card;
    }
    const memory=attachMemoryFirstOpen(ensureMemory(record,session),normalized,{at:now()});
    setRecord({card,memory});
    emit(session,"HEIMDALL_FIRST_OPEN_RESULT",{status:normalized.status,destination:normalized.destination});
    if(["BLOCKED","UNKNOWN"].includes(normalized.status)) {
      session.status="CARD_READY";
      return {ready:false,session:sessionView(session),...getRecord(session.cardId),firstOpen:normalized};
    }
    session.status="IN_MISSION";
    emit(session,"MISSION_DEPARTED",{destination:normalized.destination});
    return {ready:true,session:sessionView(session),...getRecord(session.cardId),firstOpen:normalized};
  }

  function touch(sessionId,{station}={}) {
    const session=getSession(sessionId);
    if(!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    const record=getRecord(session.cardId);
    return immutable({
      card:record.card,
      missionMemory:record.memory,
      station:requireText(station,"STATION"),
      authority:"NONE_CREATED_BY_CARD",
    });
  }

  function prepareReturn(sessionId,{
    requestId=null,status,result=null,nextAction=null,evidence=[],unknowns=[],lastLocation=null,mode="NORMAL_RETURN",
  }={}) {
    const session=getSession(sessionId);
    if(!session.cardId) throw new Error("HERMES_CARD_REQUIRED");
    if(["RETURNED","EXITED"].includes(session.status)) throw new Error("HERMES_CARD_ALREADY_RETURNED");
    const record=getRecord(session.cardId);
    const packet=createCardReturnRequest({
      requestId:requestId||id("RETURN"),
      card:record.card,
      memory:record.memory,
      status,result,nextAction,evidence,unknowns,lastLocation,mode,
    });
    session.pendingReturn=packet;
    session.status="RETURN_PENDING";
    emit(session,"CARD_RETURN_REQUESTED",{requestId:packet.requestId,status:packet.status,mode:packet.mode});
    return packet;
  }

  function acceptReturn(sessionId,{card,reality=null}={}) {
    const session=getSession(sessionId);
    if(session.status!=="RETURN_PENDING"||!session.pendingReturn) throw new Error("HERMES_RETURN_NOT_PENDING");
    const previous=getRecord(session.cardId);
    const returnedCard=validateHubCard(card);
    assertSameHubIdentity(previous.card,returnedCard);
    const memory=recordMemoryReturn(previous.memory,{
      requestedStatus:session.pendingReturn.status,
      sourceStatus:returnedCard.sourceStatus,
      cardStatus:returnedCard.status,
      result:safeClone(reality?.result ?? session.pendingReturn.result),
      nextAction:reality?.nextAction ?? session.pendingReturn.nextAction,
      evidence:safeClone(reality?.evidence ?? session.pendingReturn.evidence),
      unknowns:safeClone(reality?.unknowns ?? session.pendingReturn.unknowns),
      lastLocation:reality?.lastLocation ?? session.pendingReturn.lastLocation,
      mode:session.pendingReturn.mode,
    },{at:now()});
    setRecord({card:returnedCard,memory});
    session.pendingReturn=null;
    session.status="RETURNED";
    emit(session,"CARD_RETURNED",{cardId:returnedCard.cardId,sourceStatus:returnedCard.sourceStatus,memoryRevision:memory.revision});
    return {session:sessionView(session),...getRecord(session.cardId)};
  }

  function prepareRecoveryReturn(sessionId,input={}) {
    return prepareReturn(sessionId,{
      status:"OPEN",
      result:input.result ?? null,
      nextAction:input.nextAction || "Recover from last known mission reality",
      evidence:input.evidence || [],
      unknowns:input.unknowns || ["SESSION_INTERRUPTED"],
      lastLocation:input.lastLocation || null,
      mode:"RECOVERY_RETURN",
    });
  }

  function exit(sessionId) {
    const session=getSession(sessionId);
    if(session.status!=="RETURNED") throw new Error("HERMES_RETURN_REQUIRED_BEFORE_EXIT");
    session.status="EXITED";
    session.exitedAt=now();
    emit(session,"EXIT",{cardId:session.cardId});
    return sessionView(session);
  }

  function inspect(sessionId) {
    const session=getSession(sessionId);
    return {
      contract:HERMES_CONTRACT,
      session:sessionView(session),
      record:session.cardId?getRecord(session.cardId):null,
    };
  }

  function listRecords() {
    return [...records.values()].map(safeClone);
  }

  return Object.freeze({
    enter,candidates,chooseExisting,prepareNewCard,acceptIssuedCard,
    selectContext,note,askLight,receiveLight,prepareFirstOpen,acceptFirstOpen,
    touch,prepareReturn,acceptReturn,prepareRecoveryReturn,exit,inspect,listRecords,
  });
}
