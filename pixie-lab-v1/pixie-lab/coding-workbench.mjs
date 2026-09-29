const text = (value) => String(value ?? '').trim();
const clone = (value) => value == null ? value : structuredClone(value);

export const ERGASTERION_CODING_WORKBENCH_SCHEMA = 'ERGASTERION_CODING_WORKBENCH_V1';

function unavailable(capability, reason = 'CODING_EXECUTOR_UNAVAILABLE') {
  return Object.freeze({
    ok: false,
    status: 'UNAVAILABLE',
    capability,
    reason,
    approval: 'NOT_AN_APPROVAL',
  });
}

function requireExecutor(executor, method, capability) {
  if (!executor || typeof executor[method] !== 'function') return null;
  return executor[method].bind(executor);
}

export async function inspectCodingWorkbench({ executor = null } = {}) {
  const status = requireExecutor(executor, 'status', 'STATUS');
  if (!status) return unavailable('STATUS');
  const result = await status();
  return Object.freeze({
    schema: ERGASTERION_CODING_WORKBENCH_SCHEMA,
    ok: true,
    status: result?.available === false ? 'UNAVAILABLE' : 'ACTIVE',
    executor: clone(result),
    createsAuthority: false,
    mergeAuthority: false,
    deployAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}

export async function listCodingFiles({ executor = null, path = '.', limit = 500 } = {}) {
  const listFiles = requireExecutor(executor, 'listFiles', 'LIST_FILES');
  if (!listFiles) return unavailable('LIST_FILES');
  return Object.freeze({
    schema: ERGASTERION_CODING_WORKBENCH_SCHEMA,
    ok: true,
    capability: 'LIST_FILES',
    result: clone(await listFiles({ path, limit })),
    approval: 'NOT_AN_APPROVAL',
  });
}

export async function readCodingFile({ executor = null, path, maxBytes = 262144 } = {}) {
  const readFile = requireExecutor(executor, 'readFile', 'READ_FILE');
  if (!readFile) return unavailable('READ_FILE');
  return Object.freeze({
    schema: ERGASTERION_CODING_WORKBENCH_SCHEMA,
    ok: true,
    capability: 'READ_FILE',
    result: clone(await readFile({ path: text(path), maxBytes })),
    approval: 'NOT_AN_APPROVAL',
  });
}

export async function searchCodingWorkspace({ executor = null, query, path = '.', limit = 100 } = {}) {
  const search = requireExecutor(executor, 'search', 'SEARCH');
  if (!search) return unavailable('SEARCH');
  return Object.freeze({
    schema: ERGASTERION_CODING_WORKBENCH_SCHEMA,
    ok: true,
    capability: 'SEARCH',
    result: clone(await search({ query: text(query), path, limit })),
    approval: 'NOT_AN_APPROVAL',
  });
}

export async function inspectCodingDiff({ executor = null, baseRef = null } = {}) {
  const diff = requireExecutor(executor, 'diff', 'DIFF');
  if (!diff) return unavailable('DIFF');
  return Object.freeze({
    schema: ERGASTERION_CODING_WORKBENCH_SCHEMA,
    ok: true,
    capability: 'DIFF',
    result: clone(await diff({ baseRef: text(baseRef) || null })),
    approval: 'NOT_AN_APPROVAL',
  });
}

export async function applyCodingChange({
  executor = null,
  branch,
  baseRef = 'main',
  writes = [],
  runs = [],
  commitMessage,
  push = false,
  workId = null,
  checkpointId = null,
} = {}) {
  const apply = requireExecutor(executor, 'apply', 'APPLY');
  if (!apply) return unavailable('APPLY');

  const result = await apply({
    branch: text(branch),
    baseRef: text(baseRef) || 'main',
    writes: clone(Array.isArray(writes) ? writes : []),
    runs: clone(Array.isArray(runs) ? runs : []),
    commitMessage: text(commitMessage),
    push: push === true,
  });

  return Object.freeze({
    schema: ERGASTERION_CODING_WORKBENCH_SCHEMA,
    ok: result?.ok === true,
    status: result?.status || (result?.ok ? 'PASS' : 'FAIL'),
    workId: text(workId) || null,
    checkpointId: text(checkpointId) || null,
    branch: result?.branch || text(branch) || null,
    baseRef: result?.baseRef || text(baseRef) || null,
    headSha: result?.headSha || null,
    changedFiles: clone(result?.changedFiles || []),
    diff: result?.diff || '',
    runs: clone(result?.runs || []),
    pushed: result?.pushed === true,
    reason: result?.reason || null,
    createsAuthority: false,
    mergeAuthority: false,
    deployAuthority: false,
    approval: 'NOT_AN_APPROVAL',
  });
}
