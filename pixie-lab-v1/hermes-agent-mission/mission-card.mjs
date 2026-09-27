import {
  MISSION_CARD_CONTRACT,
  assertCardStatus,
  immutable,
  normalizeRefs,
  requireText,
  safeClone,
} from "./contracts.mjs";

const uniqueById = values => {
  const map = new Map();
  for (const item of values || []) {
    const id = String(item?.contextId || item?.id || "").trim();
    if (id && !map.has(id)) map.set(id, safeClone(item));
  }
  return [...map.values()];
};

export function createMissionCard({
  cardId,
  mission,
  requestedResult = null,
  agentId,
  tags = [],
  createdAt,
} = {}) {
  return immutable({
    contract:MISSION_CARD_CONTRACT,
    cardId:requireText(cardId,"CARD_ID"),
    mission:requireText(mission,"MISSION"),
    requestedResult:String(requestedResult || "").trim() || null,
    agentId:requireText(agentId,"AGENT_ID"),
    tags:normalizeRefs(tags),
    status:"DRAFT",
    revision:0,
    selectedContext:[],
    contextRefs:[],
    notes:[],
    lightReplies:[],
    firstOpen:null,
    route:null,
    reality:null,
    returnHistory:[],
    createdAt:requireText(createdAt,"CREATED_AT"),
    updatedAt:createdAt,
  });
}

export function selectMissionContext(card, { candidates = [], selectedIds = [], at } = {}) {
  const ids = new Set(normalizeRefs(selectedIds));
  const selected = uniqueById(candidates).filter(item => ids.has(String(item.contextId || item.id)));
  if (selected.length !== ids.size) throw new Error("HERMES_CONTEXT_SELECTION_UNKNOWN_ID");
  return immutable({
    ...safeClone(card),
    selectedContext:selected,
    contextRefs:normalizeRefs(selected.flatMap(item => [item.ref, ...(item.refs || [])])),
    updatedAt:requireText(at,"UPDATED_AT"),
  });
}

export function addMissionNote(card, { text, source = "GO", at } = {}) {
  const note = {
    noteId:`NOTE-${Number(card.notes?.length || 0) + 1}`,
    source:requireText(source,"NOTE_SOURCE"),
    text:requireText(text,"NOTE_TEXT"),
    at:requireText(at,"UPDATED_AT"),
  };
  return immutable({
    ...safeClone(card),
    notes:[...(card.notes || []), note],
    updatedAt:at,
  });
}

export function addLightReply(card, { requestId, summary, contextCandidates = [], at } = {}) {
  const reply = {
    requestId:requireText(requestId,"LIGHT_REQUEST_ID"),
    summary:requireText(summary,"LIGHT_SUMMARY"),
    contextCandidates:uniqueById(contextCandidates),
    at:requireText(at,"UPDATED_AT"),
  };
  return immutable({
    ...safeClone(card),
    lightReplies:[...(card.lightReplies || []), reply],
    updatedAt:at,
  });
}

export function attachFirstOpen(card, firstOpen, { at } = {}) {
  return immutable({
    ...safeClone(card),
    firstOpen:safeClone(firstOpen),
    updatedAt:requireText(at,"UPDATED_AT"),
  });
}

export function setMissionRoute(card, route, { at } = {}) {
  const destination = requireText(route?.destination,"MISSION_DESTINATION");
  return immutable({
    ...safeClone(card),
    route:{ destination, workspace:String(route?.workspace || "").trim() || null, refs:normalizeRefs(route?.refs) },
    status:"ON_PROCESS",
    updatedAt:requireText(at,"UPDATED_AT"),
  });
}

export function returnMissionCard(card, {
  status,
  result = null,
  nextAction = null,
  evidenceRefs = [],
  unknowns = [],
  lastLocation = null,
  mode = "NORMAL_RETURN",
  at,
} = {}) {
  const nextStatus = assertCardStatus(status);
  const revision = Number(card.revision || 0) + 1;
  const returned = {
    revision,
    status:nextStatus,
    result:safeClone(result),
    nextAction:String(nextAction || "").trim() || null,
    evidenceRefs:normalizeRefs(evidenceRefs),
    unknowns:normalizeRefs(unknowns),
    lastLocation:String(lastLocation || "").trim() || null,
    mode:requireText(mode,"RETURN_MODE"),
    returnedAt:requireText(at,"RETURNED_AT"),
  };
  return immutable({
    ...safeClone(card),
    status:nextStatus,
    revision,
    reality:returned,
    returnHistory:[...(card.returnHistory || []), returned],
    updatedAt:at,
  });
}

export function touchMissionCard(card, { station } = {}) {
  return immutable({
    cardId:card.cardId,
    mission:card.mission,
    requestedResult:card.requestedResult,
    agentId:card.agentId,
    status:card.status,
    revision:card.revision,
    selectedContext:safeClone(card.selectedContext || []),
    contextRefs:normalizeRefs(card.contextRefs),
    notes:safeClone(card.notes || []),
    route:safeClone(card.route),
    reality:safeClone(card.reality),
    station:requireText(station,"STATION"),
    authority:"NONE_CREATED_BY_CARD",
  });
}
