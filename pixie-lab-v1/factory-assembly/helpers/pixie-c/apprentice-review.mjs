const text = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export function reviewReusableClaim({
  claim,
  evidenceRefs = [],
  contradictions = [],
  unknowns = [],
} = {}) {
  const normalizedClaim = text(claim);
  if (!normalizedClaim) throw new Error("CLAIM_REQUIRED");

  const evidence = unique(evidenceRefs);
  const conflicts = unique(contradictions);
  const gaps = unique(unknowns);

  let status = "VERIFIED_FOR_EXPERIMENT";
  const reasons = [];

  if (!evidence.length) {
    status = "INSUFFICIENT_EVIDENCE";
    reasons.push("NO_EVIDENCE_REF");
  }
  if (conflicts.length) {
    status = "CONTRADICTED";
    reasons.push("CONTRADICTION_PRESENT");
  } else if (gaps.length && status === "VERIFIED_FOR_EXPERIMENT") {
    status = "UNKNOWN";
    reasons.push("MATERIAL_UNKNOWN_REMAINS");
  }

  return Object.freeze({
    claim:normalizedClaim,
    status,
    evidenceRefs:Object.freeze(evidence),
    contradictions:Object.freeze(conflicts),
    unknowns:Object.freeze(gaps),
    reasons:Object.freeze(reasons),
    scope:"EXPERIMENT_ONLY",
    promotesToCore:false,
    productionAuthority:false,
  });
}
