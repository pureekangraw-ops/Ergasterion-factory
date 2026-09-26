const text = value => String(value ?? "").trim();
const upper = value => text(value).toUpperCase();

const READ_PATTERNS = [/ตรวจ/i,/เช็ก/i,/เช็ค/i,/ดู/i,/อ่าน/i,/ค้น/i,/inspect/i,/check/i,/read/i,/verify/i];
const ACT_PATTERNS = [/แก้/i,/ซ่อม/i,/ทำ/i,/สร้าง/i,/อัปเดต/i,/fix/i,/repair/i,/create/i,/update/i,/continue/i];
const PHYSICAL_PATTERNS = [/มือถือ/i,/โทรศัพท์/i,/เครื่องจริง/i,/physical/i,/device/i,/ใช้มือ/i,/กดเอง/i];
const EVIDENCE_PATTERNS = [/หลักฐาน/i,/evidence/i,/receipt/i,/readback/i];

const TARGETS = Object.freeze([
  { id:"lighthouse", patterns:[/lighthouse/i,/ไลท์เฮาส์/i,/ไลท์เฮ้าส์/i] },
  { id:"factory", patterns:[/factory/i,/โรงงาน/i,/โค้ด/i,/code/i,/branch/i,/\bpr\b/i,/\bci\b/i] },
  { id:"pixie", patterns:[/pixie/i,/พิกซี/i] },
  { id:"drive", patterns:[/drive/i,/ไดรฟ์/i,/ไฟล์/i] },
  { id:"gmail", patterns:[/gmail/i,/เมล/i,/อีเมล/i] },
  { id:"counter", patterns:[/counter/i,/เคาน์เตอร์/i,/\blight\b/i,/ถามไลท์/i] },
]);

const any = (value, patterns) => patterns.some(pattern => pattern.test(value));

function inferIntent(command) {
  const read = any(command, READ_PATTERNS);
  const act = any(command, ACT_PATTERNS);
  if (read && act) return "READ_THEN_ACT";
  if (act) return "ACT";
  return "READ";
}

function inferTargets(command) {
  return TARGETS
    .filter(target => target.patterns.some(pattern => pattern.test(command)))
    .map(target => target.id);
}

function inferConditions(command) {
  const conditions = [];
  if (/ถ้า.*โค้ด.*(?:แก้|ทำ)/i.test(command) || /if.*code.*(?:fix|repair)/i.test(command)) {
    conditions.push({
      when:"CODE_CHANGE_IS_SUFFICIENT",
      then:"PREPARE_LOCAL_FIX_CANDIDATE",
    });
  }
  if (any(command, PHYSICAL_PATTERNS)) {
    conditions.push({
      when:"PHYSICAL_ACTION_REQUIRED",
      then:"STOP_AND_RETURN_TO_GO",
    });
  }
  if (any(command, EVIDENCE_PATTERNS)) {
    conditions.push({
      when:"RESULT_READY",
      then:"RETURN_EVIDENCE_REFS",
    });
  }
  return conditions;
}

function buildPlan({ command, targets, intent, conditions }) {
  const steps = [
    { action:"OBSERVE", objective:"Collect local facts from supplied context without external execution." },
    { action:"HYPOTHESIZE", objective:"Identify the first plausible break and competing explanations." },
  ];
  if (targets.length) {
    steps.push({ action:"MAP_TARGETS", objective:`Relate the command to: ${targets.join(", ")}.` });
  }
  steps.push({ action:"PLAN_LOCAL", objective:`Prepare a ${intent} candidate for GO review.` });
  if (conditions.length) {
    steps.push({ action:"BOUND_CONDITIONS", objective:"Encode IF/STOP conditions exactly instead of silently widening scope." });
  }
  steps.push({ action:"COMPARE", objective:"Check the candidate against requested result, constraints, and UNKNOWNs." });
  return steps.map((step, index) => Object.freeze({
    stepId:`A-${String(index + 1).padStart(2, "0")}`,
    ...step,
    sourceCommand:command,
  }));
}

export function interpretGoCommand({ command, requestedResult = null, constraints = [], contextRefs = [] } = {}) {
  const normalized = text(command);
  if (!normalized) throw new Error("GO_COMMAND_REQUIRED");

  const namedTargets = inferTargets(normalized);\n  const localContextAvailable = Array.isArray(contextRefs) && contextRefs.some(value => text(value));\n  const targets = namedTargets.length ? namedTargets : (localContextAvailable ? ["room-context"] : []);
  const intent = inferIntent(normalized);
  const conditions = inferConditions(normalized);
  const unknowns = [];
  if (!text(requestedResult)) unknowns.push("REQUESTED_RESULT_UNSPECIFIED");
  if (!targets.length) unknowns.push("TARGET_UNRESOLVED");

  const stopConditions = [
    "UNKNOWN_MATERIAL_TO_RESULT",
    "AUTHORITY_REQUIRED",
    "REQUESTED_RESULT_CHANGE",
    "EXTERNAL_EXECUTION_REQUIRED",
  ];
  if (conditions.some(item => item.when === "PHYSICAL_ACTION_REQUIRED")) {
    stopConditions.push("PHYSICAL_ACTION_REQUIRED");
  }

  return Object.freeze({
    contract:"PIXIE_ROOM_A_COMMAND_INTELLIGENCE_V1",
    intent,
    targets:Object.freeze(targets),
    conditions:Object.freeze(conditions),
    constraints:Object.freeze((constraints || []).map(text).filter(Boolean)),
    plan:Object.freeze(buildPlan({ command:normalized, targets, intent, conditions })),
    unknowns:Object.freeze(unknowns),
    stopConditions:Object.freeze(stopConditions),
    execution:Object.freeze({
      localOnly:true,
      externalExecution:false,
      productionAuthority:false,
      canWidenAuthority:false,
    }),
  });
}
