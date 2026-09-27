import {
  HERMES_CARD_ISSUE_REQUEST_CONTRACT,
  HERMES_RETURN_REQUEST_CONTRACT,
  HEIMDALL_FIRST_OPEN_CONTRACT,
  LIGHT_CONTEXT_REQUEST_CONTRACT,
  FIRST_OPEN_STATUS,
  immutable,
  normalizeRefs,
  requireText,
  safeClone,
} from "./contracts.mjs";
import { validateHubCard } from "./hub-card.mjs";

export function createCardIssueRequest({
  requestId,
  agentId,
  mission,
  requestedResult,
  requestedDestinations = [],
  scope = [],
  workType = "NORMAL",
} = {}) {
  return immutable({
    contract:HERMES_CARD_ISSUE_REQUEST_CONTRACT,
    requestId:requireText(requestId,"CARD_ISSUE_REQUEST_ID"),
    agentId:requireText(agentId,"AGENT_ID"),
    command:requireText(mission,"MISSION"),
    name:requireText(mission,"MISSION"),
    expectedResult:requireText(requestedResult,"REQUESTED_RESULT"),
    requestedDestinations:normalizeRefs(requestedDestinations),
    scope:normalizeRefs(scope),
    workType:String(workType || "NORMAL").trim().toUpperCase(),
    ownerSource:"CENTRE",
    cardFormat:"EXISTING_HUB_WORK_CARD",
  });
}

export function createLightContextRequest({ requestId, card, memory, question, availableRefs = [] } = {}) {
  const hubCard = validateHubCard(card);
  return immutable({
    contract:LIGHT_CONTEXT_REQUEST_CONTRACT,
    requestId:requireText(requestId,"LIGHT_REQUEST_ID"),
    cardId:hubCard.cardId,
    workId:hubCard.workId,
    mission:requireText(memory?.mission,"MISSION"),
    requestedResult:memory?.requestedResult || hubCard.detail || null,
    question:requireText(question,"LIGHT_QUESTION"),
    currentContextRefs:normalizeRefs(memory?.contextRefs),
    availableRefs:normalizeRefs(availableRefs),
    mode:"CONTEXT_ONLY",
    mayMutateCard:false,
    mayOpenWorkspace:false,
  });
}

export function createHeimdallFirstOpenRequest({ requestId, card, memory, destination, workspace = null } = {}) {
  const hubCard = validateHubCard(card);
  return immutable({
    contract:HEIMDALL_FIRST_OPEN_CONTRACT,
    requestId:requireText(requestId,"HEIMDALL_REQUEST_ID"),
    cardId:hubCard.cardId,
    workId:hubCard.workId,
    jobCode:hubCard.jobCode,
    mission:requireText(memory?.mission,"MISSION"),
    agentId:requireText(memory?.agentId,"AGENT_ID"),
    destination:requireText(destination,"MISSION_DESTINATION"),
    workspace:String(workspace || "").trim() || null,
    contextRefs:normalizeRefs(memory?.contextRefs),
    purpose:"FIRST_OPEN_ONLY",
    createAuthority:false,
    boardRequested:false,
  });
}

export function normalizeFirstOpenResponse(value = {}) {
  const status = String(value.status || "").trim().toUpperCase();
  if (!FIRST_OPEN_STATUS.includes(status)) throw new Error("HERMES_FIRST_OPEN_STATUS_INVALID");
  return immutable({
    requestId:requireText(value.requestId,"HEIMDALL_REQUEST_ID"),
    status,
    destination:requireText(value.destination,"MISSION_DESTINATION"),
    workspace:String(value.workspace || "").trim() || null,
    openedRef:String(value.openedRef || "").trim() || null,
    reason:String(value.reason || "").trim() || null,
    checkedAt:requireText(value.checkedAt,"HEIMDALL_CHECKED_AT"),
    scope:safeClone(value.scope || null),
    card:value.card ? validateHubCard(value.card) : null,
  });
}

export function createCardReturnRequest({
  requestId,
  card,
  memory,
  status,
  result = null,
  nextAction = null,
  evidence = [],
  unknowns = [],
  lastLocation = null,
  mode = "NORMAL_RETURN",
} = {}) {
  const hubCard = validateHubCard(card);
  return immutable({
    contract:HERMES_RETURN_REQUEST_CONTRACT,
    requestId:requireText(requestId,"RETURN_REQUEST_ID"),
    cardId:hubCard.cardId,
    workId:hubCard.workId,
    jobCode:hubCard.jobCode,
    agentId:requireText(memory?.agentId,"AGENT_ID"),
    status:requireText(status,"RETURN_STATUS").toUpperCase(),
    result:safeClone(result),
    nextAction:String(nextAction || "").trim() || null,
    evidence:safeClone(evidence || []),
    unknowns:normalizeRefs(unknowns),
    lastLocation:String(lastLocation || "").trim() || null,
    mode:requireText(mode,"RETURN_MODE"),
    ownerSource:"CENTRE",
    mustReadBackCard:true,
  });
}
