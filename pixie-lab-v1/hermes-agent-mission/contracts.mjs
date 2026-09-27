const text = value => String(value ?? "").trim();
const clone = value => value == null ? value : structuredClone(value);
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export const HERMES_CONTRACT = "HERMES_AGENT_MISSION_V1";
export const HERMES_SESSION_CONTRACT = "HERMES_SESSION_V1";
export const HERMES_CARD_ISSUE_REQUEST_CONTRACT = "HERMES_CARD_ISSUE_REQUEST_V1";
export const HERMES_RETURN_REQUEST_CONTRACT = "HERMES_CARD_RETURN_REQUEST_V1";
export const HEIMDALL_FIRST_OPEN_CONTRACT = "HERMES_HEIMDALL_FIRST_OPEN_V1";
export const LIGHT_CONTEXT_REQUEST_CONTRACT = "HERMES_LIGHT_CONTEXT_REQUEST_V1";

export const SESSION_STATUS = Object.freeze([
  "ENTERED","CARD_ISSUE_PENDING","CARD_READY","FIRST_OPEN_READY","IN_MISSION","RETURN_PENDING","RETURNED","EXITED"
]);

export const FIRST_OPEN_STATUS = Object.freeze([
  "OPENED","ALREADY_OPEN","BLOCKED","UNKNOWN"
]);

export function requireText(value, label) {
  const result = text(value);
  if (!result) throw new Error(`${label}_REQUIRED`);
  return result;
}

export function normalizeRefs(values = []) {
  return unique(values);
}

export function safeClone(value) {
  return clone(value);
}

export function immutable(value) {
  return Object.freeze(clone(value));
}
