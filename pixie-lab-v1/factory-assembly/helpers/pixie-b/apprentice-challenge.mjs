const text = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export function challengeLesson({
  topic,
  reusable = [],
  evidenceRefs = [],
  unknowns = [],
} = {}) {
  const subject = text(topic);
  if (!subject) throw new Error("LESSON_TOPIC_REQUIRED");

  const claims = unique(reusable);
  const evidence = unique(evidenceRefs);
  const gaps = unique(unknowns);
  const probes = [];

  for (const claim of claims) {
    probes.push({
      kind:"COUNTEREXAMPLE",
      claim,
      question:`When would this fail: ${claim}`,
    });
    probes.push({
      kind:"TRANSFER_RISK",
      claim,
      question:"Does this still hold when the mission, data, or surface changes?",
    });
  }

  if (!evidence.length) {
    probes.push({
      kind:"EVIDENCE_GAP",
      claim:null,
      question:"What direct evidence supports the reusable lesson?",
    });
  }

  for (const gap of gaps) {
    probes.push({
      kind:"UNKNOWN_PRESSURE",
      claim:null,
      question:`Could this UNKNOWN reverse the lesson? ${gap}`,
    });
  }

  return Object.freeze({
    topic:subject,
    challengedClaims:Object.freeze(claims),
    probes:Object.freeze(probes),
    verdict:"NOT_A_VERDICT",
    mutatesLesson:false,
    changesCore:false,
    productionAuthority:false,
  });
}
