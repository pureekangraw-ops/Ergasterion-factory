const text = value => String(value ?? "").trim();
const clone = value => value == null ? value : structuredClone(value);
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export const HUB_CARD_STATUSES = Object.freeze(["Work","Resume","Done","Cancel"]);
export const HUB_WORK_TYPES = Object.freeze(["NORMAL","URGENT","MAINTENANCE","SOS"]);

export function validateHubCard(card = {}) {
  if (!card || typeof card !== "object" || Array.isArray(card)) throw new Error("HERMES_HUB_CARD_REQUIRED");
  const jobCode = text(card.jobCode).toUpperCase();
  if (!/^\d{4}-[A-Z0-9]{4}$/.test(jobCode)) throw new Error("HERMES_HUB_JOB_CODE_INVALID");
  if (text(card.cardId) !== `CARD:${jobCode}`) throw new Error("HERMES_HUB_CARD_ID_MISMATCH");
  if (!text(card.workId)) throw new Error("HERMES_HUB_WORK_ID_REQUIRED");
  if (!HUB_CARD_STATUSES.includes(text(card.status))) throw new Error("HERMES_HUB_CARD_STATUS_INVALID");
  if (!text(card.sourceStatus)) throw new Error("HERMES_HUB_SOURCE_STATUS_REQUIRED");
  if (!Array.isArray(card.destinations)) throw new Error("HERMES_HUB_DESTINATIONS_INVALID");
  if (!Array.isArray(card.scope)) throw new Error("HERMES_HUB_SCOPE_INVALID");
  if (!HUB_WORK_TYPES.includes(text(card.type).toUpperCase())) throw new Error("HERMES_HUB_WORK_TYPE_INVALID");
  if (!text(card.title)) throw new Error("HERMES_HUB_CARD_TITLE_REQUIRED");
  return Object.freeze({
    cardId:`CARD:${jobCode}`,
    workId:text(card.workId),
    jobCode,
    status:text(card.status),
    sourceStatus:text(card.sourceStatus).toUpperCase(),
    destinations:unique(card.destinations),
    scope:unique(card.scope),
    type:text(card.type).toUpperCase(),
    title:text(card.title),
    detail:text(card.detail) || null,
    holder:text(card.holder) || null,
    createdAt:text(card.createdAt) || null,
    lastUpdated:text(card.lastUpdated) || text(card.createdAt) || null,
    ...(card.health ? { health:text(card.health) } : {}),
    ...(card.caution !== undefined ? { caution:clone(card.caution) } : {}),
  });
}

export function hubCardCompleteness(card) {
  const value = validateHubCard(card);
  const missing = [];
  if (!value.destinations.length) missing.push("destination");
  if (!value.scope.length) missing.push("scope");
  return Object.freeze({ complete:missing.length === 0, missing:Object.freeze(missing) });
}

export function assertSameHubIdentity(previous, next) {
  const a = validateHubCard(previous);
  const b = validateHubCard(next);
  if (a.cardId !== b.cardId || a.workId !== b.workId || a.jobCode !== b.jobCode) {
    throw new Error("HERMES_HUB_CARD_IDENTITY_CHANGED");
  }
  return true;
}
