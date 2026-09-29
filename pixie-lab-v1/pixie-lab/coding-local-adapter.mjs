import { execFile as execFileCb } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, relative, resolve, sep } from 'node:path';

const execFile = promisify(execFileCb);
const text = (value) => String(value ?? '').trim();
const clone = (value) => value == null ? value : structuredClone(value);

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !rel.startsWith(sep));
}

function resolveInside(root, input = '.') {
  const value = text(input) || '.';
  if (value.includes('\0')) throw new Error('CODING_PATH_INVALID');
  const target = resolve(root, value);
  if (!inside(root, target)) throw new Error('CODING_PATH_OUTSIDE_WORKSPACE');
  return target;
}

function validateBranch(value) {
  const branch = text(value);
  if (!branch) throw new Error('CODING_BRANCH_REQUIRED');
  if (['main', 'master'].includes(branch)) throw new Error('CODING_PROTECTED_BRANCH_FORBIDDEN');
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) {
    throw new Error('CODING_BRANCH_INVALID');
  }
  return branch;
}

function validateArgv(argv, allowedExecutables) {
  if (!Array.isArray(argv) || !argv.length) throw new Error('CODING_RUN_ARGV_REQUIRED');
  const args = argv.map((value) => String(value));
  const exe = args[0];
  if (!allowedExecutables.includes(exe)) throw new Error('CODING_EXECUTABLE_NOT_ALLOWED');
  return args;
}

async function run(root, argv, { cwd = '.', timeoutMs = 120000, maxBuffer = 4 * 1024 * 1024 } = {}) {
  const safe = resolveInside(root, cwd);
  const [file, ...args] = argv;
  try {
    const result = await execFile(file, args, { cwd: safe, timeout: timeoutMs, maxBuffer, env: process.env });
    return { ok: true, status: 'PASS', argv, cwd: relative(root, safe) || '.', stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    return {
      ok: false,
      status: error.killed ? 'TIMEOUT' : 'FAIL',
      argv,
      cwd: relative(root, safe) || '.',
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      reason: error.killed ? 'CODING_RUN_TIMEOUT' : 'CODING_RUN_FAILED',
    };
  }
}

async function walk(root, start, limit) {
  const out = [];
  const stack = [start];
  while (stack.length && out.length < limit) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= limit) break;
      if (['.git', 'node_modules'].includes(entry.name)) continue;
      const full = resolve(current, entry.name);
      if (!inside(root, full)) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(relative(root, full));
    }
  }
  return out.sort();
}

export function createLocalCodingExecutor({
  root = process.cwd(),
  allowWrite = false,
  allowGitPush = false,
  allowedExecutables = ['npm', 'node'],
} = {}) {
  const workspaceRoot = resolve(root);

  async function git(args, options = {}) {
    return run(workspaceRoot, ['git', ...args], { ...options, cwd: options.cwd || '.' });
  }

  return Object.freeze({
    async status() {
      const gitRoot = await git(['rev-parse', '--show-toplevel']);
      const head = await git(['rev-parse', 'HEAD']);
      const branch = await git(['branch', '--show-current']);
      return {
        available: gitRoot.ok && head.ok,
        workspaceRoot,
        branch: branch.stdout.trim() || null,
        headSha: head.stdout.trim() || null,
        writeEnabled: allowWrite,
        pushEnabled: allowGitPush,
        allowedExecutables: [...allowedExecutables],
        mergeAuthority: false,
        deployAuthority: false,
      };
    },

    async listFiles({ path = '.', limit = 500 } = {}) {
      const start = resolveInside(workspaceRoot, path);
      const info = await stat(start);
      if (!info.isDirectory()) throw new Error('CODING_LIST_PATH_NOT_DIRECTORY');
      return { path: relative(workspaceRoot, start) || '.', files: await walk(workspaceRoot, start, Math.max(1, Math.min(Number(limit) || 500, 5000))) };
    },

    async readFile({ path, maxBytes = 262144 } = {}) {
      const target = resolveInside(workspaceRoot, path);
      const info = await stat(target);
      if (!info.isFile()) throw new Error('CODING_READ_PATH_NOT_FILE');
      if (info.size > maxBytes) throw new Error('CODING_READ_FILE_TOO_LARGE');
      return { path: relative(workspaceRoot, target), size: info.size, content: await readFile(target, 'utf8') };
    },

    async search({ query, path = '.', limit = 100 } = {}) {
      const needle = text(query);
      if (!needle) throw new Error('CODING_SEARCH_QUERY_REQUIRED');
      const start = resolveInside(workspaceRoot, path);
      const files = await walk(workspaceRoot, start, 5000);
      const matches = [];
      for (const rel of files) {
        if (matches.length >= limit) break;
        const target = resolveInside(workspaceRoot, rel);
        const info = await stat(target);
        if (info.size > 1024 * 1024) continue;
        let body;
        try { body = await readFile(target, 'utf8'); } catch { continue; }
        const lines = body.split('\n');
        for (let i = 0; i < lines.length && matches.length < limit; i += 1) {
          if (lines[i].includes(needle)) matches.push({ path: rel, line: i + 1, text: lines[i] });
        }
      }
      return { query: needle, path: relative(workspaceRoot, start) || '.', matches };
    },

    async diff({ baseRef = null } = {}) {
      const args = baseRef ? ['diff', '--no-ext-diff', baseRef, '--'] : ['diff', '--no-ext-diff'];
      const result = await git(args);
      const status = await git(['status', '--short']);
      return {
        baseRef: baseRef || null,
        diff: result.stdout || '',
        status: status.stdout || '',
        ok: result.ok && status.ok,
      };
    },

    async apply({ branch, baseRef = 'main', writes = [], runs = [], commitMessage, push = false } = {}) {
      if (!allowWrite) return { ok: false, status: 'UNAVAILABLE', reason: 'CODING_WRITE_DISABLED' };
      const targetBranch = validateBranch(branch);
      if (push && !allowGitPush) return { ok: false, status: 'UNAVAILABLE', reason: 'CODING_GIT_PUSH_DISABLED' };
      if (!Array.isArray(writes) || !writes.length) return { ok: false, status: 'FAIL', reason: 'CODING_WRITES_REQUIRED' };
      if (!text(commitMessage)) return { ok: false, status: 'FAIL', reason: 'CODING_COMMIT_MESSAGE_REQUIRED' };

      const dirty = await git(['status', '--porcelain']);
      if (!dirty.ok) return { ok: false, status: 'FAIL', reason: 'CODING_GIT_STATUS_FAILED', runs: [dirty] };
      if (dirty.stdout.trim()) return { ok: false, status: 'FAIL', reason: 'CODING_WORKSPACE_DIRTY' };

      const baseCheck = await git(['rev-parse', '--verify', baseRef]);
      if (!baseCheck.ok) return { ok: false, status: 'FAIL', reason: 'CODING_BASE_REF_NOT_FOUND', runs: [baseCheck] };

      const switchResult = await git(['switch', '-C', targetBranch, baseRef]);
      if (!switchResult.ok) return { ok: false, status: 'FAIL', reason: 'CODING_BRANCH_SWITCH_FAILED', runs: [switchResult] };

      const changedFiles = [];
      for (const item of writes) {
        const rel = text(item?.path);
        if (!rel) return { ok: false, status: 'FAIL', reason: 'CODING_WRITE_PATH_REQUIRED', branch: targetBranch };
        const target = resolveInside(workspaceRoot, rel);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, String(item?.content ?? ''), 'utf8');
        changedFiles.push(relative(workspaceRoot, target));
      }

      const runResults = [];
      for (const item of runs) {
        const argv = validateArgv(item?.argv, allowedExecutables);
        const result = await run(workspaceRoot, argv, { cwd: item?.cwd || '.', timeoutMs: item?.timeoutMs || 120000 });
        runResults.push(result);
        if (!result.ok) {
          const diffResult = await git(['diff', '--no-ext-diff']);
          return {
            ok: false,
            status: 'FAIL',
            reason: 'CODING_RUN_FAILED',
            branch: targetBranch,
            baseRef,
            changedFiles,
            diff: diffResult.stdout || '',
            runs: runResults,
            pushed: false,
          };
        }
      }

      const addResult = await git(['add', '--', ...changedFiles]);
      if (!addResult.ok) return { ok: false, status: 'FAIL', reason: 'CODING_GIT_ADD_FAILED', branch: targetBranch, runs: [...runResults, addResult] };

      const staged = await git(['diff', '--cached', '--no-ext-diff']);
      const stagedNames = await git(['diff', '--cached', '--name-only']);
      if (!staged.stdout.trim()) {
        return { ok: false, status: 'FAIL', reason: 'CODING_NO_CHANGES', branch: targetBranch, baseRef, changedFiles: [], diff: '', runs: runResults, pushed: false };
      }

      await git(['config', 'user.name', 'ERGASTERION Coding Workbench']);
      await git(['config', 'user.email', 'ergasterion-coding@users.noreply.github.com']);
      const commit = await git(['commit', '-m', commitMessage]);
      if (!commit.ok) return { ok: false, status: 'FAIL', reason: 'CODING_COMMIT_FAILED', branch: targetBranch, baseRef, changedFiles, diff: staged.stdout, runs: [...runResults, commit], pushed: false };

      const head = await git(['rev-parse', 'HEAD']);
      if (!head.ok) return { ok: false, status: 'FAIL', reason: 'CODING_HEAD_READ_FAILED', branch: targetBranch, runs: [...runResults, head] };

      if (push) {
        const pushed = await git(['push', '--force-with-lease', 'origin', `HEAD:refs/heads/${targetBranch}`]);
        if (!pushed.ok) {
          return {
            ok: false,
            status: 'FAIL',
            reason: 'CODING_PUSH_FAILED',
            branch: targetBranch,
            baseRef,
            headSha: head.stdout.trim(),
            changedFiles: stagedNames.stdout.trim().split('\n').filter(Boolean),
            diff: staged.stdout,
            runs: [...runResults, pushed],
            pushed: false,
          };
        }
      }

      return {
        ok: true,
        status: 'PASS',
        branch: targetBranch,
        baseRef,
        headSha: head.stdout.trim(),
        changedFiles: stagedNames.stdout.trim().split('\n').filter(Boolean),
        diff: staged.stdout,
        runs: runResults,
        pushed: push,
      };
    },
  });
}
