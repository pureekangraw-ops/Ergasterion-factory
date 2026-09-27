const text = value => String(value ?? "").trim();
const clone = value => value == null ? value : structuredClone(value);
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export const PIXIE_WORKSHOP_CONTRACT = "PIXIE_WORKSHOP_TOOLKIT_V1";
export const PIXIE_WORKSHOP_REPOSITORY = "pureekangraw-ops/Go-Calalog-";
export const PIXIE_WORKSHOP_ROOMS = Object.freeze(["ROOM-A","ROOM-B","ROOM-C"]);
export const PIXIE_WORKSHOP_TRUNKS = Object.freeze({
  "ROOM-A":"room/pixie-a",
  "ROOM-B":"room/pixie-b",
  "ROOM-C":"room/pixie-c",
});

export const PIXIE_WORKSHOP_ACTIONS = Object.freeze([
  "inspect_repository",
  "read_file",
  "compare_refs",
  "create_branch",
  "write_file",
  "delete_file",

  "open_pr",
  "room_merge",
  "snapshot",
  "rollback",
  "record_lesson",
  "emit_evidence",
]);

const DEFAULT_CAPABILITY_MAP = Object.freeze({
  inspect_repository:"inspectRepository",
  read_file:"readFile",
  compare_refs:"compareRefs",
  create_branch:"createBranch",
  write_file:"writeFile",
  delete_file:"deleteFile",

  open_pr:"openPullRequest",
  room_merge:"roomMerge",
  snapshot:"snapshot",
  rollback:"rollback",
  record_lesson:"recordLesson",
  emit_evidence:"emitEvidence",
});

export function isWorkshopRef(value) {
  const ref = text(value);
  return /^room\/pixie-[abc]$/i.test(ref) || /^feature\/room-[abc](?:-|\/).+/i.test(ref);
}

export function roomIdFromRef(value) {
  const ref = text(value).toLowerCase();
  const match = ref.match(/(?:room\/pixie-|feature\/room-)([abc])/);
  return match ? `ROOM-${match[1].toUpperCase()}` : null;
}

function assertWorkshopRef(value, label) {
  const ref = text(value);
  if (!ref) throw new Error(`${label}_REQUIRED`);
  if (!isWorkshopRef(ref)) throw new Error(`OUTSIDE_PIXIE_WORKSHOP:${label}:${ref}`);
  return ref;
}

function assertRoomId(value) {
  const roomId = text(value).toUpperCase();
  if (!PIXIE_WORKSHOP_ROOMS.includes(roomId)) throw new Error(`PIXIE_WORKSHOP_ROOM_INVALID:${roomId || "EMPTY"}`);
  return roomId;
}

function requireText(value, label) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${label}_REQUIRED`);
  return normalized;
}

export function createWorkshopHostAdapter(capabilities = {}) {
  const adapter = {};
  for (const hostMethod of Object.values(DEFAULT_CAPABILITY_MAP)) {
    if (typeof capabilities[hostMethod] === "function") adapter[hostMethod] = capabilities[hostMethod];
  }
  return Object.freeze(adapter);
}

function normalizeRequest(input = {}) {
  const action = text(input.action).toLowerCase();
  if (!action) throw new Error("WORKSHOP_ACTION_REQUIRED");
  if (!PIXIE_WORKSHOP_ACTIONS.includes(action)) throw new Error(`WORKSHOP_ACTION_UNKNOWN:${action}`);

  const roomId = assertRoomId(input.roomId);
  const request = {
    contract:PIXIE_WORKSHOP_CONTRACT,
    requestId:requireText(input.requestId,"REQUEST_ID"),
    action,
    roomId,
    repository:text(input.repository) || PIXIE_WORKSHOP_REPOSITORY,
    targetRef:text(input.targetRef) || null,
    baseRef:text(input.baseRef) || null,
    headRef:text(input.headRef) || null,
    branchName:text(input.branchName) || null,
    fromSha:text(input.fromSha) || null,
    path:text(input.path) || null,
    content:input.content == null ? null : String(input.content),
    expectedSha:text(input.expectedSha) || null,
    runId:input.runId ?? null,
    prNumber:input.prNumber ?? null,
    title:text(input.title) || null,
    body:text(input.body) || null,
    snapshotId:text(input.snapshotId) || null,
    snapshotSha:text(input.snapshotSha) || null,
    lesson:clone(input.lesson ?? null),
    evidence:clone(input.evidence ?? null),
    evidenceRefs:unique(input.evidenceRefs),
    metadata:clone(input.metadata ?? {}),
  };

  if (request.repository !== PIXIE_WORKSHOP_REPOSITORY) {
    throw new Error(`OUTSIDE_PIXIE_WORKSHOP:repository:${request.repository}`);
  }

  if (request.targetRef) assertWorkshopRef(request.targetRef,"TARGET_REF");
  if (request.baseRef) assertWorkshopRef(request.baseRef,"BASE_REF");
  if (request.headRef) assertWorkshopRef(request.headRef,"HEAD_REF");
  if (request.branchName) assertWorkshopRef(request.branchName,"BRANCH_NAME");

  return Object.freeze(request);
}

function argsForHost(request) {
  switch (request.action) {
    case "inspect_repository":
      return { repository:request.repository, ref:request.targetRef || PIXIE_WORKSHOP_TRUNKS[request.roomId] };
    case "read_file":
      return { repository:request.repository, ref:request.targetRef || PIXIE_WORKSHOP_TRUNKS[request.roomId], path:requireText(request.path,"PATH") };
    case "compare_refs":
      return { repository:request.repository, base:assertWorkshopRef(request.baseRef,"BASE_REF"), head:assertWorkshopRef(request.headRef,"HEAD_REF") };
    case "create_branch":
      return { repository:request.repository, name:assertWorkshopRef(request.branchName,"BRANCH_NAME"), fromSha:requireText(request.fromSha,"FROM_SHA") };
    case "write_file":
      return { repository:request.repository, branch:assertWorkshopRef(request.targetRef,"TARGET_REF"), path:requireText(request.path,"PATH"), content:request.content ?? "", expectedSha:request.expectedSha || null };
    case "delete_file":
      return { repository:request.repository, branch:assertWorkshopRef(request.targetRef,"TARGET_REF"), path:requireText(request.path,"PATH"), expectedSha:requireText(request.expectedSha,"EXPECTED_SHA") };

    case "open_pr":
      return {
        repository:request.repository,
        branch:assertWorkshopRef(request.headRef,"HEAD_REF"),
        base:assertWorkshopRef(request.baseRef,"BASE_REF"),
        title:requireText(request.title,"TITLE"),
        body:request.body || "",
      };
    case "room_merge":
      return {
        repository:request.repository,
        head:assertWorkshopRef(request.headRef,"HEAD_REF"),
        base:assertWorkshopRef(request.baseRef,"BASE_REF"),
        prNumber:request.prNumber,
        expectedSha:request.expectedSha || null,
      };
    case "snapshot":
      return {
        repository:request.repository,
        ref:request.targetRef || PIXIE_WORKSHOP_TRUNKS[request.roomId],
        snapshotId:requireText(request.snapshotId,"SNAPSHOT_ID"),
      };
    case "rollback":
      return {
        repository:request.repository,
        ref:request.targetRef || PIXIE_WORKSHOP_TRUNKS[request.roomId],
        snapshotId:request.snapshotId || null,
        snapshotSha:request.snapshotSha || null,
      };
    case "record_lesson":
      return { roomId:request.roomId, lesson:clone(request.lesson), evidenceRefs:request.evidenceRefs };
    case "emit_evidence":
      return { roomId:request.roomId, evidence:clone(request.evidence), evidenceRefs:request.evidenceRefs };
    default:
      throw new Error(`WORKSHOP_ACTION_UNHANDLED:${request.action}`);
  }
}

export function createPixieWorkshopToolkit({ host = {}, extensions = [] } = {}) {
  const adapter = createWorkshopHostAdapter(host);
  const extensionMap = new Map();
  for (const extension of extensions || []) {
    const action = text(extension?.action).toLowerCase();
    if (!action || typeof extension?.run !== "function") continue;
    if (PIXIE_WORKSHOP_ACTIONS.includes(action)) throw new Error(`WORKSHOP_EXTENSION_COLLISION:${action}`);
    extensionMap.set(action, extension.run);
  }

  function catalog() {
    return Object.freeze({
      contract:PIXIE_WORKSHOP_CONTRACT,
      repository:PIXIE_WORKSHOP_REPOSITORY,
      rooms:[...PIXIE_WORKSHOP_ROOMS],
      roomTrunks:clone(PIXIE_WORKSHOP_TRUNKS),
      actions:PIXIE_WORKSHOP_ACTIONS.map(action => ({
        action,
        hostCapability:DEFAULT_CAPABILITY_MAP[action],
        available:typeof adapter[DEFAULT_CAPABILITY_MAP[action]] === "function",
      })),
      extensions:[...extensionMap.keys()],
      boundary:"A_B_C_ONLY",
      note:"PYRO forge tools are candidate-building capabilities. Board management belongs to Heimdall; debug/test/CI diagnosis belongs to the System Scanner. No production/main behavior is implied.",
    });
  }

  async function execute(input = {}) {
    const action = text(input.action).toLowerCase();
    if (extensionMap.has(action)) {
      const roomId = assertRoomId(input.roomId);
      return extensionMap.get(action)(clone({ ...input, roomId }));
    }

    const request = normalizeRequest(input);
    const hostMethod = DEFAULT_CAPABILITY_MAP[request.action];
    const fn = adapter[hostMethod];
    if (typeof fn !== "function") {
      return Object.freeze({
        ok:false,
        contract:PIXIE_WORKSHOP_CONTRACT,
        requestId:request.requestId,
        action:request.action,
        roomId:request.roomId,
        status:"TOOL_UNAVAILABLE",
        missingCapability:hostMethod,
      });
    }

    const result = await fn(clone(argsForHost(request)));
    return Object.freeze({
      ok:true,
      contract:PIXIE_WORKSHOP_CONTRACT,
      requestId:request.requestId,
      action:request.action,
      roomId:request.roomId,
      result:clone(result),
    });
  }

  return Object.freeze({ catalog, execute });
}
