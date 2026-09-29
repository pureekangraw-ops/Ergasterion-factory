#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJsonFilePersistence } from './pixie-lab/adapters.mjs';
import { createLocalCodingExecutor } from './pixie-lab/coding-local-adapter.mjs';
import { createPixieCommander } from './pixie-lab/command.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_ROOT = resolve(HERE, 'ui');
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
});
const STATIC = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/styles.css', 'styles.css'],
]);

function json(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function readJson(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createFactoryCommander({
  stateFile = resolve(HERE, process.env.PIXIE_STATE_FILE || '.pixie/state.json'),
  codingRoot = resolve(HERE, '..'),
  allowCodingWrite = process.env.ERGASTERION_CODING_WRITE === '1',
  allowGitPush = process.env.ERGASTERION_CODING_GIT_PUSH === '1',
} = {}) {
  const persistence = createJsonFilePersistence({ filePath: stateFile });
  const codingExecutor = createLocalCodingExecutor({
    root: codingRoot,
    allowWrite: allowCodingWrite,
    allowGitPush,
    allowedExecutables: (process.env.ERGASTERION_CODING_EXECUTABLES || 'npm,node')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  });
  return createPixieCommander({ persistence, codingExecutor });
}

export function createFactoryServer({
  commander = createFactoryCommander(),
  uiRoot = UI_ROOT,
} = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');

      if (req.method === 'GET' && url.pathname === '/api/health') {
        return json(res, 200, {
          ok: true,
          product: 'ERGASTERION',
          surface: 'DREAM_FACTORY_SHELL_V1',
          authority: 'NONE',
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
        const commands = ['workbench_floor', 'reality_screen', 'checkpoint_dock', 'big_view', 'intent_review'];
        const entries = await Promise.all(commands.map(async (command) => [command, await commander.execute({ command })]));
        return json(res, 200, {
          ok: true,
          shell: 'DREAM_FACTORY_SHELL_V1',
          data: Object.fromEntries(entries),
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/command') {
        const input = await readJson(req);
        const output = await commander.execute(input);
        return json(res, output.ok === false ? 400 : 200, output);
      }

      if (req.method === 'GET' && STATIC.has(url.pathname)) {
        const name = STATIC.get(url.pathname);
        const target = resolve(uiRoot, name);
        if (!target.startsWith(resolve(uiRoot))) return json(res, 403, { ok: false, error: 'STATIC_PATH_FORBIDDEN' });
        const body = await readFile(target);
        res.writeHead(200, {
          'content-type': MIME[extname(name)] || 'application/octet-stream',
          'content-length': body.length,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        return res.end(body);
      }

      return json(res, 404, { ok: false, error: 'NOT_FOUND' });
    } catch (error) {
      return json(res, error?.message === 'REQUEST_TOO_LARGE' ? 413 : 500, {
        ok: false,
        error: error?.message || 'FACTORY_SERVER_ERROR',
      });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.ERGASTERION_FACTORY_HOST || '127.0.0.1';
  const port = Number(process.env.ERGASTERION_FACTORY_PORT || 4317);
  const server = createFactoryServer();
  server.listen(port, host, () => {
    console.log(JSON.stringify({
      ok: true,
      product: 'ERGASTERION',
      shell: 'DREAM_FACTORY_SHELL_V1',
      url: `http://${host}:${port}`,
      codingWrite: process.env.ERGASTERION_CODING_WRITE === '1',
      gitPush: process.env.ERGASTERION_CODING_GIT_PUSH === '1',
    }, null, 2));
  });
}
