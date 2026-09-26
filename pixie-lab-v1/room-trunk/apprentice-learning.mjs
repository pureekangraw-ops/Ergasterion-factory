const text = value => String(value ?? "").trim();

export const PIXIE_LESSON_CONTRACT = "PIXIE_APPRENTICE_LESSON_V1";

const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export function createLesson({
  lessonId,
  sessionId,
  topic,
  hypothesis = null,
  observed = [],
  evidenceRefs = [],
  worked = [],
  failed = [],
  unknowns = [],
  reusable = [],
} = {}) {
  const id = text(lessonId);
  const sid = text(sessionId);
  const subject = text(topic);
  if (!id) throw new Error("LESSON_ID_REQUIRED");
  if (!sid) throw new Error("SESSION_ID_REQUIRED");
  if (!subject) throw new Error("LESSON_TOPIC_REQUIRED");

  return Object.freeze({
    contract:PIXIE_LESSON_CONTRACT,
    lessonId:id,
    sessionId:sid,
    topic:subject,
    hypothesis:text(hypothesis) || null,
    observed:unique(observed),
    evidenceRefs:unique(evidenceRefs),
    worked:unique(worked),
    failed:unique(failed),
    unknowns:unique(unknowns),
    reusable:unique(reusable),
    adoption:Object.freeze({
      automatic:false,
      changesCore:false,
      changesProduction:false,
      requiresFreshDecision:true,
    }),
  });
}

export function learnFromSession({ sessionId, topic, attempts = [], evidenceRefs = [], unknowns = [] } = {}) {
  const normalizedAttempts = (attempts || []).map((attempt, index) => ({
    id:text(attempt?.id) || `ATTEMPT-${index + 1}`,
    hypothesis:text(attempt?.hypothesis) || null,
    outcome:text(attempt?.outcome).toUpperCase() || "UNKNOWN",
    observation:text(attempt?.observation) || null,
    reusable:text(attempt?.reusable) || null,
  }));

  const worked = normalizedAttempts
    .filter(item => item.outcome === "PASS")
    .map(item => item.observation || item.hypothesis)
    .filter(Boolean);
  const failed = normalizedAttempts
    .filter(item => item.outcome === "FAIL")
    .map(item => item.observation || item.hypothesis)
    .filter(Boolean);
  const reusable = normalizedAttempts
    .filter(item => item.outcome === "PASS" && item.reusable)
    .map(item => item.reusable);

  return createLesson({
    lessonId:`${text(sessionId)}:LESSON`,
    sessionId,
    topic,
    observed:normalizedAttempts.map(item => `${item.id}:${item.outcome}`),
    evidenceRefs,
    worked,
    failed,
    unknowns,
    reusable,
  });
}

export function buildNextExperiment({ lesson, mission, constraints = [] } = {}) {
  if (!lesson || lesson.contract !== PIXIE_LESSON_CONTRACT) throw new Error("PIXIE_LESSON_REQUIRED");
  const requested = text(mission);
  if (!requested) throw new Error("MISSION_REQUIRED");

  return Object.freeze({
    mission:requested,
    useAsReference:Object.freeze([...lesson.reusable]),
    avoidRepeating:Object.freeze([...lesson.failed]),
    preserveUnknowns:Object.freeze([...lesson.unknowns]),
    constraints:Object.freeze(unique(constraints)),
    inheritance:Object.freeze({
      workingState:false,
      assumptions:false,
      coreBehavior:false,
      evidence:true,
      explicitReusableLessons:true,
    }),
  });
}
