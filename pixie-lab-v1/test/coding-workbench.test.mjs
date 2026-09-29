import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCb } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createLocalCodingExecutor } from '../pixie-lab/coding-local-adapter.mjs';
import { createPixieCommander } from '../pixie-lab/command.mjs';
import { createMemoryPersistence } from '../pixie-lab/core.mjs';

const execFile = promisify(execFileCb);

async function git(cwd, args) {
  return execFile('git', args, { cwd });
}

async function tempRepo() {
  const root = await mkdtemp(join(tmpdir(), 'ergasterion-coding-'));
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'user.name', 'Test']);
  await git(root, ['config', 'user.email', 'test@example.invalid']);
  await writeFile(join(root, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    scripts: { test: 'node test.mjs' },
  }, null, 2));
  await writeFile(join(root, 'test.mjs'), "if (process.env.FAIL_TEST === '1') process.exit(1);\n");
  await writeFile(join(root, 'source.txt'), 'before\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);
  return root;
}

test('local Coding executor lists reads searches and reports git truth', async () => {
  const root = await tempRepo();
  const executor = createLocalCodingExecutor({ root });

  const status = await executor.status();
  assert.equal(status.available, true);
  assert.equal(status.branch, 'main');
  assert.equal(status.writeEnabled, false);
  assert.equal(status.mergeAuthority, false);
  assert.equal(status.deployAuthority, false);

  const files = await executor.listFiles({ path: '.', limit: 20 });
  assert.equal(files.files.includes('source.txt'), true);

  const source = await executor.readFile({ path: 'source.txt' });
  assert.equal(source.content, 'before\n');

  const search = await executor.search({ query: 'before', path: '.' });
  assert.equal(search.matches.some((item) => item.path === 'source.txt'), true);
});

test('Coding apply writes tests commits on a branch without merge authority', async () => {
  const root = await tempRepo();
  const executor = createLocalCodingExecutor({ root, allowWrite: true });

  const result = await executor.apply({
    branch: 'factory/coding-test',
    baseRef: 'main',
    writes: [{ path: 'source.txt', content: 'after\n' }],
    runs: [{ argv: ['npm', 'test'] }],
    commitMessage: 'test: coding workbench apply',
    push: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'PASS');
  assert.equal(result.branch, 'factory/coding-test');
  assert.equal(result.changedFiles.includes('source.txt'), true);
  assert.match(result.diff, /before/);
  assert.match(result.diff, /after/);
  assert.equal(result.pushed, false);
  assert.match(await readFile(join(root, 'source.txt'), 'utf8'), /after/);

  const branch = (await git(root, ['branch', '--show-current'])).stdout.trim();
  const message = (await git(root, ['log', '-1', '--pretty=%s'])).stdout.trim();
  assert.equal(branch, 'factory/coding-test');
  assert.equal(message, 'test: coding workbench apply');
});

test('Coding apply can push its branch to a Git remote without merging', async () => {
  const root = await tempRepo();
  const remote = await mkdtemp(join(tmpdir(), 'ergasterion-coding-remote-'));
  await git(remote, ['init', '--bare']);
  await git(root, ['remote', 'add', 'origin', remote]);
  await git(root, ['push', '-u', 'origin', 'main']);

  const executor = createLocalCodingExecutor({ root, allowWrite: true, allowGitPush: true });
  const result = await executor.apply({
    branch: 'factory/push-test',
    baseRef: 'main',
    writes: [{ path: 'source.txt', content: 'pushed\n' }],
    runs: [{ argv: ['npm', 'test'] }],
    commitMessage: 'test: push coding branch',
    push: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.pushed, true);
  const remoteHead = (await execFile('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/factory/push-test'])).stdout.trim();
  assert.equal(remoteHead, result.headSha);
});

test('Coding apply refuses direct main and refuses writes when host opt-in is off', async () => {
  const root = await tempRepo();
  const disabled = createLocalCodingExecutor({ root, allowWrite: false });
  const noWrite = await disabled.apply({
    branch: 'factory/no-write',
    writes: [{ path: 'source.txt', content: 'blocked\n' }],
    commitMessage: 'blocked',
  });
  assert.equal(noWrite.status, 'UNAVAILABLE');
  assert.equal(noWrite.reason, 'CODING_WRITE_DISABLED');

  const enabled = createLocalCodingExecutor({ root, allowWrite: true });
  await assert.rejects(
    () => enabled.apply({
      branch: 'main',
      writes: [{ path: 'source.txt', content: 'blocked\n' }],
      commitMessage: 'blocked',
    }),
    /CODING_PROTECTED_BRANCH_FORBIDDEN/,
  );
});

test('Coding apply does not commit when verification command fails', async () => {
  const root = await tempRepo();
  const before = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
  const executor = createLocalCodingExecutor({ root, allowWrite: true });

  const result = await executor.apply({
    branch: 'factory/failing-test',
    baseRef: 'main',
    writes: [{ path: 'test.mjs', content: "process.exit(1);\n" }],
    runs: [{ argv: ['npm', 'test'] }],
    commitMessage: 'should not commit',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'CODING_RUN_FAILED');
  assert.equal(result.pushed, false);
  const after = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
  assert.equal(after, before);
});

test('Coding commands expose host truth and external effects without persisting Lab state', async () => {
  let saves = 0;
  const executor = {
    async status() { return { available: true, workspaceRoot: '/tmp/repo', writeEnabled: true, pushEnabled: true }; },
    async listFiles() { return { files: ['a.mjs'] }; },
    async readFile() { return { path: 'a.mjs', content: 'x' }; },
    async search() { return { matches: [{ path: 'a.mjs', line: 1, text: 'x' }] }; },
    async diff() { return { diff: 'diff', status: ' M a.mjs', ok: true }; },
    async apply() { return { ok: true, status: 'PASS', branch: 'factory/test', headSha: 'abc', changedFiles: ['a.mjs'], diff: 'diff', runs: [], pushed: true }; },
  };
  const persistence = {
    ...createMemoryPersistence(),
    async save(value) { saves += 1; return value; },
  };
  const pixie = createPixieCommander({ persistence, codingExecutor: executor });

  const status = await pixie.execute({ command: 'coding_status' });
  const read = await pixie.execute({ command: 'coding_read', args: { path: 'a.mjs' } });
  const apply = await pixie.execute({
    command: 'coding_apply',
    args: {
      branch: 'factory/test',
      writes: [{ path: 'a.mjs', content: 'y' }],
      commitMessage: 'change',
      push: true,
      workId: 'WORK-CODE',
      checkpointId: 'CP-CODE',
    },
  });

  assert.equal(status.result.status, 'ACTIVE');
  assert.equal(read.mutated, false);
  assert.equal(apply.mutated, true);
  assert.equal(apply.externalEffect, true);
  assert.equal(apply.result.headSha, 'abc');
  assert.equal(apply.result.mergeAuthority, false);
  assert.equal(apply.result.deployAuthority, false);
  assert.equal(saves, 0);
});
