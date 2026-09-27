const text = value => String(value ?? "").trim().toLocaleLowerCase("th-TH");

function compact(value) {
  return text(value).replace(/[\s\p{P}\p{S}]+/gu, "");
}

function tokens(value) {
  return [...new Set(text(value).split(/[^\p{L}\p{N}]+/u).map(x => x.trim()).filter(Boolean))];
}

function grams(value, size = 2) {
  const source = compact(value);
  if (!source) return [];
  if (source.length <= size) return [source];
  const out = [];
  for (let i = 0; i <= source.length - size; i += 1) out.push(source.slice(i, i + size));
  return [...new Set(out)];
}

function jaccard(left = [], right = []) {
  const a = new Set(left), b = new Set(right);
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const item of a) if (b.has(item)) common += 1;
  return common / (a.size + b.size - common);
}

function missionText(card = {}) {
  return [card.mission, card.requestedResult, ...(card.tags || [])].filter(Boolean).join(" ");
}

function statusWeight(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ON_PROCESS") return 0.10;
  if (normalized === "WAIT" || normalized === "WAIT_VERIFY") return 0.07;
  if (normalized === "DRAFT") return 0.05;
  if (normalized === "COMPLETE") return -0.03;
  if (normalized === "CANCEL") return -0.10;
  return 0;
}

export function missionSimilarity(query, card) {
  const source = missionText(card);
  const tokenScore = jaccard(tokens(query), tokens(source));
  const bigramScore = jaccard(grams(query, 2), grams(source, 2));
  const trigramScore = jaccard(grams(query, 3), grams(source, 3));
  const lexical = (tokenScore * 0.30) + (bigramScore * 0.40) + (trigramScore * 0.30);
  return Math.max(0, Math.min(1, lexical + statusWeight(card?.status)));
}

export function rankMissionCards(query, cards = [], { threshold = 0.24, limit = 5 } = {}) {
  return cards
    .map(card => ({ card, score:missionSimilarity(query, card) }))
    .filter(item => item.score >= threshold)
    .sort((a,b) => b.score - a.score || String(b.card?.updatedAt || "").localeCompare(String(a.card?.updatedAt || "")))
    .slice(0, limit)
    .map(({ card, score }) => Object.freeze({
      cardId:String(card.cardId || ""),
      mission:String(card.mission || ""),
      status:String(card.status || ""),
      revision:Number(card.revision || 0),
      score:Number(score.toFixed(4)),
      updatedAt:card.updatedAt || null,
    }));
}
