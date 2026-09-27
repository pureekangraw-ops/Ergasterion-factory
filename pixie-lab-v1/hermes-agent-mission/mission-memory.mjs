import { immutable, normalizeRefs, requireText, safeClone } from "./contracts.mjs";
import { validateHubCard } from "./hub-card.mjs";

const uniqueById = values => {
  const map = new Map();
  for (const item of values || []) {
    const id = String(item?.contextId || item?.id || "").trim();
    if (id && !map.has(id)) map.set(id, safeClone(item));
  }
  return [...map.values()];
};

export function createMissionMemory({ card, mission, requestedResult = null, agentId, createdAt } = {}) {
  const hubCard = validateHubCard(card);
  return immutable({
    cardId:hubCard.cardId,
    workId:hubCard.workId,
    mission:requireText(mission,"MISSION"),
    requestedResult:String(requestedResult || hubCard.detail || "").trim() || null,
    agentId:requireText(agentId,"AGENT_ID"),
    revision:0,
    selectedContext:[],
    contextRefs:[],
    notes:[],
    lightReplies:[],
    firstOpen:null,
    latestReality:null,
    returnHistory:[],
    createdAt:requireText(createdAt,"CREATED_AT"),
    updatedAt:createdAt,
  });
}

export function selectMemoryContext(memory, { candidates = [], selectedIds = [], at } = {}) {
  const ids = new Set(normalizeRefs(selectedIds));
  const selected = uniqueById(candidates).filter(item => ids.has(String(item.contextId || item.id)));
  if (selected.length !== ids.size) throw new Error("HERMES_CONTEXT_SELECTION_UNKNOWN_ID");
  return immutable({
    ...safeClone(memory),
    selectedContext:selected,
    contextRefs:normalizeRefs(selected.flatMap(item => [item.ref, ...(item.refs || [])])),
    updatedAt:requireText(at,"UPDATED_AT"),
  });
}

export function addMemoryNote(memory, { text, source = "GO", at } = {}) {
  const note = {
    noteId:`NOTE-${Number(memory.notes?.length || 0) + 1}`,
    source:requireText(source,"NOTE_SOURCE"),
    text:requireText(text,"NOTE_TEXT"),
    at:requireText(at,"UPDATED_AT"),
  };
  return immutable({
    ...safeClone(memory),
    notes:[...(memory.notes || []), note],
    updatedAt:at,
  });
}

export function addMemoryLightReply(memory, { requestId, summary, contextCandidates = [], at } = {}) {
  const reply = {
    requestId:requireText(requestId,"LIGHT_REQUEST_ID"),
    summary:requireText(summary,"LIGHT_SUMMARY"),
    contextCandidates:uniqueById(contextCandidates),
    at:requireText(at,"UPDATED_AT"),
  };
  return immutable({
    ...safeClone(memory),
    lightReplies:[...(memory.lightReplies || []), reply],
    updatedAt:at,
  });
}

export function attachMemoryFirstOpen(memory, firstOpen, { at } = {}) {
  return immutable({
    ...safeClone(memory),
    firstOpen:safeClone(firstOpen),
    updatedAt:requireText(at,"UPDATED_AT"),
  });
}

export function recordMemoryReturn(memory, reality, { at } = {}) {
  const nextRevision = Number(memory.revision || 0) + 1;
  const snapshot = {
    ...safeClone(reality),
    revision:nextRevision,
    returnedAt:requireText(at,"RETURNED_AT"),
  };
  return immutable({
    ...safeClone(memory),
    revision:nextRevision,
    latestReality:snapshot,
    returnHistory:[...(memory.returnHistory || []), snapshot],
    updatedAt:at,
  });
}
