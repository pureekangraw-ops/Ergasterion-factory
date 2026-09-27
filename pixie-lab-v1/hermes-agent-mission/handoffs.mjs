import {
  HEIMDALL_FIRST_OPEN_CONTRACT,
  LIGHT_CONTEXT_REQUEST_CONTRACT,
  FIRST_OPEN_STATUS,
  immutable,
  normalizeRefs,
  requireText,
  safeClone,
} from "./contracts.mjs";

export function createLightContextRequest({
  requestId,
  card,
  question,
  availableRefs = [],
} = {}) {
  return immutable({
    contract:LIGHT_CONTEXT_REQUEST_CONTRACT,
    requestId:requireText(requestId,"LIGHT_REQUEST_ID"),
    cardId:requireText(card?.cardId,"CARD_ID"),
    mission:requireText(card?.mission,"MISSION"),
    requestedResult:card?.requestedResult || null,
    question:requireText(question,"LIGHT_QUESTION"),
    currentContextRefs:normalizeRefs(card?.contextRefs),
    availableRefs:normalizeRefs(availableRefs),
    mode:"CONTEXT_ONLY",
    mayMutateCard:false,
    mayOpenWorkspace:false,
  });
}

export function createHeimdallFirstOpenRequest({
  requestId,
  card,
  destination,
  workspace = null,
} = {}) {
  return immutable({
    contract:HEIMDALL_FIRST_OPEN_CONTRACT,
    requestId:requireText(requestId,"HEIMDALL_REQUEST_ID"),
    cardId:requireText(card?.cardId,"CARD_ID"),
    mission:requireText(card?.mission,"MISSION"),
    agentId:requireText(card?.agentId,"AGENT_ID"),
    destination:requireText(destination,"MISSION_DESTINATION"),
    workspace:String(workspace || "").trim() || null,
    contextRefs:normalizeRefs(card?.contextRefs),
    requestedResult:card?.requestedResult || null,
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
  });
}
