import { createPixieCommander } from './pixie-lab-v1/pixie-lab/command.mjs';

const PROTOCOL = 'GO_HUB_ERGASTERION_FACTORY_V1';
const MAX_SKEW_MS = 5 * 60 * 1000;

const text = value => String(value ?? '').trim();

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function equalHex(left, right) {
  const a = text(left).toLowerCase();
  const b = text(right).toLowerCase();
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function sign(payload, secret, timestamp) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${JSON.stringify(payload)}`),
  ));
}

async function verifyHubRequest(request, payload, env) {
  const secret = text(env.ERGASTERION_HUB_SHARED_SECRET || env.GO_HUB_FACTORY_SECRET);
  if (!secret) throw Object.assign(new Error('HUB_FACTORY_SECRET_REQUIRED'), { status: 503 });

  const protocol = text(request.headers.get('x-go-hub-protocol'));
  if (protocol && protocol !== PROTOCOL) {
    throw Object.assign(new Error('HUB_FACTORY_PROTOCOL_UNSUPPORTED'), { status: 400 });
  }

  const timestamp = text(request.headers.get('x-go-hub-timestamp'));
  const timestampMs = Number(timestamp);
  if (!timestamp || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_SKEW_MS) {
    throw Object.assign(new Error('HUB_FACTORY_TIMESTAMP_INVALID'), { status: 401 });
  }

  const expected = await sign(payload, secret, timestamp);
  if (!equalHex(expected, request.headers.get('x-go-hub-signature'))) {
    throw Object.assign(new Error('HUB_FACTORY_SIGNATURE_INVALID'), { status: 401 });
  }
  return { authenticated: true, protocol: PROTOCOL };
}

function stateKey(payload) {
  const value = payload?.handoff || payload || {};
  return `work:${text(value.workId) || 'global'}`;
}

function statePort(env, key) {
  const id = env.FACTORY_STATE.idFromName(key);
  const stub = env.FACTORY_STATE.get(id);
  return {
    async load() {
      const response = await stub.fetch('https://factory-state.internal/load');
      if (!response.ok) throw new Error('FACTORY_STATE_LOAD_FAILED');
      return response.json();
    },
    async save(value) {
      const response = await stub.fetch('https://factory-state.internal/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!response.ok) throw new Error('FACTORY_STATE_SAVE_FAILED');
      return response.json();
    },
  };
}

function commanderFor(env, payload) {
  return createPixieCommander({ persistence: statePort(env, stateKey(payload)) });
}

async function executeFactory(env, command, payload) {
  const commander = commanderFor(env, payload);
  return commander.execute({ command, args: payload });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error('JSON_BODY_REQUIRED'), { status: 400 });
  }
}

export class ErgasterionFactoryState {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/load') {
      return json(await this.state.storage.get('state'));
    }
    if (request.method === 'POST' && url.pathname === '/save') {
      const value = await request.json();
      await this.state.storage.put('state', value);
      return json(value);
    }
    return json({ ok: false, error: 'NOT_FOUND' }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return json({ ok: true, product: 'ERGASTERION', runtime: 'CLOUDFLARE_WORKER', authority: 'NONE' });
      }

      if (request.method === 'GET' && url.pathname === '/api/hub-factory/health') {
        return json({
          ok: true,
          protocol: PROTOCOL,
          authenticatedTransport: Boolean(text(env.ERGASTERION_HUB_SHARED_SECRET || env.GO_HUB_FACTORY_SECRET)),
        });
      }

      if (request.method === 'POST' && (url.pathname === '/api/hub-factory/receive' || url.pathname === '/api/hub-factory/readback')) {
        const payload = await readJson(request);
        const auth = await verifyHubRequest(request, payload, env);
        const command = url.pathname.endsWith('/receive') ? 'hub_factory_receive' : 'hub_factory_readback';
        const result = await executeFactory(env, command, payload);
        return json({ ...result, transport: auth }, result.ok === false ? 400 : 200);
      }

      if (request.method === 'POST' && url.pathname === '/api/command') {
        const payload = await readJson(request);
        const auth = await verifyHubRequest(request, payload, env);
        const result = await executeFactory(env, payload.command, payload.args || {});
        return json({ ...result, transport: auth }, result.ok === false ? 400 : 200);
      }

      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ ok: false, error: 'NOT_FOUND' }, 404);
    } catch (error) {
      return json({ ok: false, error: error?.message || 'FACTORY_WORKER_ERROR' }, error?.status || 500);
    }
  },
};
