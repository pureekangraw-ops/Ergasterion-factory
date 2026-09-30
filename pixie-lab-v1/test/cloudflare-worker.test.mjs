import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { HandoffLedger } from '../../cloudflare/worker.mjs';

const PROTOCOL = 'GO_HUB_ERGASTERION_FACTORY_V1';

function makeLedgerNamespace() {
  const instances = new Map();
  return {
    idFromName(name) {
      return name;
    },
    get(id) {
      if (!instances.has(id)) {
        const values = new Map();
        const ctx = {
          storage: {
            async get(key) {
              return values.get(key);
            },
            async put(key, value) {
              values.set(key, value);
            },
          },
        };
        instances.set(id, new HandoffLedger(ctx));
      }
      return {
        fetch(url, init) {
          return instances.get(id).fetch(new Request(url, init));
        },
      };
    },
  };
}

async function sign(body, secret, timestamp) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function handoffRequest(packet, secret = 'shared-secret') {
  const body = JSON.stringify(packet);
  const timestamp = String(Date.now());
  return new Request('https://factory.example/api/hub-factory/receive', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-go-hub-protocol': PROTOCOL,
      'x-go-hub-timestamp': timestamp,
      'x-go-hub-signature': await sign(body, secret, timestamp),
    },
    body,
  });
}

function packet(overrides = {}) {
  return {
    protocol: PROTOCOL,
    handoffId: 'HANDOFF-001',
    source: 'PRYTANEION',
    destination: 'ERGASTERION',
    workId: 'WORK-001',
    checkpointId: 'CP-001',
    requestedResult: 'Return Factory receipt',
    authorityTransferred: false,
    routeAuthorityCreated: false,
    approval: 'NOT_AN_APPROVAL',
    ...overrides,
  };
}

test('Cloudflare Factory edge exposes runtime health', async () => {
  const response = await worker.fetch(new Request('https://factory.example/api/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    product: 'ERGASTERION',
    runtime: 'CLOUDFLARE_WORKER',
    surface: 'CLOUDFLARE_FACTORY_EDGE',
    status: 'READY',
  });
});

test('transport health is true only when secret and durable ledger are configured', async () => {
  const off = await worker.fetch(new Request('https://factory.example/api/hub-factory/health'), {});
  assert.equal((await off.json()).authenticatedTransport, false);

  const env = {
    ERGASTERION_HUB_SHARED_SECRET: 'shared-secret',
    HANDOFF_LEDGER: makeLedgerNamespace(),
  };
  const on = await worker.fetch(new Request('https://factory.example/api/hub-factory/health'), env);
  const body = await on.json();
  assert.equal(body.authenticatedTransport, true);
  assert.equal(body.secretConfigured, true);
  assert.equal(body.ledgerBound, true);
});

test('Hub handoff requires configured secret and valid HMAC', async () => {
  const request = await handoffRequest(packet());
  const missingSecret = await worker.fetch(request.clone(), { HANDOFF_LEDGER: makeLedgerNamespace() });
  assert.equal(missingSecret.status, 503);
  assert.equal((await missingSecret.json()).error, 'FACTORY_SHARED_SECRET_NOT_CONFIGURED');

  const badRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      ...Object.fromEntries(request.headers),
      'x-go-hub-signature': '00',
    },
    body: await request.text(),
  });
  const rejected = await worker.fetch(badRequest, {
    ERGASTERION_HUB_SHARED_SECRET: 'shared-secret',
    HANDOFF_LEDGER: makeLedgerNamespace(),
  });
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).error, 'HUB_FACTORY_SIGNATURE_INVALID');
});

test('Factory accepts one authenticated handoff and treats exact retry as duplicate', async () => {
  const env = {
    ERGASTERION_HUB_SHARED_SECRET: 'shared-secret',
    HANDOFF_LEDGER: makeLedgerNamespace(),
  };
  const first = await worker.fetch(await handoffRequest(packet()), env);
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.status, 'RECEIVED');
  assert.equal(firstBody.duplicate, false);
  assert.equal(firstBody.idempotency, 'CREATED');
  assert.equal(firstBody.source, 'ERGASTERION');
  assert.equal(firstBody.destination, 'PRYTANEION');
  assert.equal(firstBody.authorityTransferred, false);

  const retry = await worker.fetch(await handoffRequest(packet()), env);
  const retryBody = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(retryBody.duplicate, true);
  assert.equal(retryBody.idempotency, 'DUPLICATE');
  assert.equal(retryBody.handoffId, firstBody.handoffId);
});

test('Factory rejects reuse of handoffId with a different authenticated payload', async () => {
  const env = {
    ERGASTERION_HUB_SHARED_SECRET: 'shared-secret',
    HANDOFF_LEDGER: makeLedgerNamespace(),
  };
  await worker.fetch(await handoffRequest(packet()), env);
  const conflict = await worker.fetch(await handoffRequest(packet({ requestedResult: 'Different result' })), env);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, 'HANDOFF_ID_CONFLICT');
});

test('Factory rejects wrong protocol or route after authentication', async () => {
  const env = {
    ERGASTERION_HUB_SHARED_SECRET: 'shared-secret',
    HANDOFF_LEDGER: makeLedgerNamespace(),
  };

  const wrongRoute = await worker.fetch(await handoffRequest(packet({ destination: 'OTHER' })), env);
  assert.equal(wrongRoute.status, 400);
  assert.equal((await wrongRoute.json()).error, 'HANDOFF_ROUTE_INVALID');
});

test('durable readback remains explicitly P3', async () => {
  const response = await worker.fetch(new Request('https://factory.example/hub_factory_readback'));
  assert.equal(response.status, 501);
  assert.deepEqual(await response.json(), {
    ok: false,
    status: 'NOT_WIRED',
    next: 'P3_DURABLE_READBACK',
  });
});
