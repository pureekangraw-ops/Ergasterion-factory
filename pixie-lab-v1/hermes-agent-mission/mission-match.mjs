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
function sourceText(record = {}) {
  const card = record.card || record;
  const memory = record.memory || {};
  return [memory.mission, memory.requestedResult, card.title, card.detail].filter(Boolean).join(" ");
}
function statusWeight(record = {}) {
  const status = String((record.card || record)?.sourceStatus || "").toUpperCase();
  if (status === "ON PROCESS") return 0.10;
  if (status === "WAIT CONFIRM") return 0.07;
  if (status === "OPEN" || status === "READY" || status === "ARRIVED") return 0.05;
  if (status === "COMPLETE" || status === "RETURNED") return -0.03;
  if (status === "CANCEL") return -0.10;
  return 0;
}

export function missionSimilarity(query, record) {
  const source = sourceText(record);
  const lexical = (jaccard(tokens(query), tokens(source)) * 0.30)
    + (jaccard(grams(query,2), grams(source,2)) * 0.40)
    + (jaccard(grams(query,3), grams(source,3)) * 0.30);
  return Math.max(0, Math.min(1, lexical + statusWeight(record)));
}

export function rankMissionCards(query, records = [], { threshold = 0.24, limit = 5 } = {}) {
  return records
    .map(record => ({ record, score:missionSimilarity(query, record) }))
    .filter(item => item.score >= threshold)
    .sort((a,b) => b.score - a.score || String((b.record.card || b.record)?.lastUpdated || "").localeCompare(String((a.record.card || a.record)?.lastUpdated || "")))
    .slice(0, limit)
    .map(({ record, score }) => {
      const card = record.card || record;
      return Object.freeze({
        cardId:String(card.cardId || ""),
        workId:String(card.workId || ""),
        jobCode:String(card.jobCode || ""),
        title:String(card.title || ""),
        status:String(card.status || ""),
        sourceStatus:String(card.sourceStatus || ""),
        score:Number(score.toFixed(4)),
        lastUpdated:card.lastUpdated || null,
      });
    });
}
