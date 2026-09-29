#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJsonFilePersistence } from './pixie-lab/adapters.mjs';
import { createLocalCodingExecutor } from './pixie-lab/coding-local-adapter.mjs';
import { createNeutralBrowserRuntimeAdapter } from './pixie-lab/browser-runtime-adapter.mjs';
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
  runtimeExecutor = null,
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
  return createPixieCommander({ persistence, codingExecutor, runtimeExecutor });
}

export function createFactoryServer({
  commander = null,
  browserAdapter = null,
  uiRoot = UI_ROOT,
} = {}) {
  const liveBrowserAdapter = browserAdapter || createNeutralBrowserRuntimeAdapter();
  const liveCommander = commander || createFactoryCommander({ runtimeExecutor: liveBrowserAdapter });

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

      if (req.method === 'GET' && url.pathname === '/api/browser/status') {
        return json(res, 200, { ok: true, result: await liveBrowserAdapter.status() });
      }

      if (req.method === 'GET' && url.pathname === '/api/browser/tabs') {
        const adapterId = url.searchParams.get('adapterId') || null;
        return json(res, 200, { ok: true, tabs: liveBrowserAdapter.listTabs({ adapterId }) });
      }

      if (req.method === 'GET' && url.pathname === '/api/browser/latest') {
        const adapterId = url.searchParams.get('adapterId') || null;
        const tabValue = url.searchParams.get('tabId');
        const tabId = tabValue == null ? null : Number(tabValue);
        return json(res, 200, {
          ok: true,
          observation: liveBrowserAdapter.latest({
            adapterId,
            tabId: Number.isInteger(tabId) ? tabId : null,
          }),
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/browser/screenshot') {
        const ref = url.searchParams.get('ref') || '';
        const shot = liveBrowserAdapter.getScreenshot(ref);
        if (!shot) return json(res, 404, { ok: false, error: 'BROWSER_SCREENSHOT_NOT_FOUND' });
        res.writeHead(200, {
          'content-type': shot.contentType || 'image/png',
          'content-length': shot.data.length,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        return res.end(shot.data);
      }

      if (req.method === 'GET' && url.pathname === '/api/browser/commands') {
        const adapterId = url.searchParams.get('adapterId') || '';
        return json(res, 200, { ok: true, commands: liveBrowserAdapter.pullCommands(adapterId) });
      }

      if (req.method === 'POST' && url.pathname === '/api/browser/register') {
        const input = await readJson(req);
        return json(res, 200, { ok: true, adapter: liveBrowserAdapter.register(input) });
      }

      if (req.method === 'POST' && url.pathname === '/api/browser/heartbeat') {
        const input = await readJson(req);
        return json(res, 200, { ok: true, adapter: liveBrowserAdapter.heartbeat(input) });
      }

      if (req.method === 'POST' && url.pathname === '/api/browser/observe') {
        const input = await readJson(req, 8 * 1024 * 1024);
        const observation = liveBrowserAdapter.observe(input);
        const recorded = await liveCommander.execute({
          command: 'runtime_record',
          args: observation.runtimeRecord,
        });
        return json(res, recorded.ok === false ? 400 : 200, {
          ok: recorded.ok !== false,
          observation,
          runtimeRecord: recorded,
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/browser/receipt') {
        const input = await readJson(req);
        const receipt = liveBrowserAdapter.acceptReceipt(input);
        const recorded = await liveCommander.execute({
          command: 'runtime_interaction_record',
          args: receipt.runtimeInteraction,
        });
        return json(res, recorded.ok === false ? 400 : 200, {
          ok: recorded.ok !== false,
          receipt,
          runtimeInteraction: recorded,
        });
      }


      if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
        const commands = ['workbench_floor', 'reality_screen', 'checkpoint_dock', 'big_view', 'intent_review'];
        const entries = await Promise.all(commands.map(async (command) => [command, await liveCommander.execute({ command })]));
        return json(res, 200, {
          ok: true,
          shell: 'DREAM_FACTORY_SHELL_V1',
          data: Object.fromEntries(entries),
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/command') {
        const input = await readJson(req);
        const output = await liveCommander.execute(input);
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
