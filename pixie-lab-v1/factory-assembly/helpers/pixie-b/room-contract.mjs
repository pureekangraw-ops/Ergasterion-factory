const clone = value => value == null ? value : structuredClone(value);
const text = value => String(value ?? "").trim();
const freeze = value => Object.freeze(clone(value));

export const ROOM_COMMAND_CONTRACT = "PIXIE_ROOM_COMMAND_V1";
export const ROOM_RESULT_CONTRACT = "PIXIE_ROOM_RESULT_V1";
export const ROOM_RESULT_STATUSES = Object.freeze(["READY","UNKNOWN","BLOCKED","FAILED"]);

export function createRoomCommand({
  roomId,
  requestId,
  command,
  requestedResult = null,
  contextRefs = [],
  constraints = [],
} = {}) {
  const normalizedRoomId = text(roomId);
  const normalizedRequestId = text(requestId);
  const normalizedCommand = text(command);
  if (!normalizedRoomId) throw new Error("ROOM_ID_REQUIRED");
  if (!normalizedRequestId) throw new Error("REQUEST_ID_REQUIRED");
  if (!normalizedCommand) throw new Error("ROOM_COMMAND_REQUIRED");
  return freeze({
    contract:ROOM_COMMAND_CONTRACT,
    roomId:normalizedRoomId,
    requestId:normalizedRequestId,
    command:normalizedCommand,
    requestedResult:text(requestedResult) || null,
    contextRefs:[...new Set((contextRefs || []).map(text).filter(Boolean))],
    constraints:[...new Set((constraints || []).map(text).filter(Boolean))],
  });
}

export function createRoomResult({
  roomId,
  requestId,
  status = "UNKNOWN",
  role,
  plan = [],
  result = null,
  evidenceRefs = [],
  unknowns = [],
  blockedBy = [],
  candidate = null,
} = {}) {
  const normalizedStatus = text(status).toUpperCase();
  if (!ROOM_RESULT_STATUSES.includes(normalizedStatus)) throw new Error("ROOM_RESULT_STATUS_INVALID");
  return freeze({
    contract:ROOM_RESULT_CONTRACT,
    roomId:text(roomId),
    requestId:text(requestId),
    status:normalizedStatus,
    role:text(role),
    plan:clone(plan || []),
    result:clone(result),
    evidenceRefs:[...new Set((evidenceRefs || []).map(text).filter(Boolean))],
    unknowns:[...new Set((unknowns || []).map(text).filter(Boolean))],
    blockedBy:[...new Set((blockedBy || []).map(text).filter(Boolean))],
    candidate:clone(candidate),
    approval:"NOT_AN_APPROVAL",
    externalExecution:false,
    productionAuthority:false,
  });
}
