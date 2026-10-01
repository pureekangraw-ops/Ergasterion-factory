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

test('durable readback returns the stored authenticated handoff as verified evidence', async () => {
  const env = {
    ERGASTERION_HUB_SHARED_SECRET: 'shared-secret',
    HANDOFF_LEDGER: makeLedgerNamespace(),
  };
  await worker.fetch(await handoffRequest(packet()), env);
  const response = await worker.fetch(new Request('https://factory.example/api/hub-factory/readback?handoffId=HANDOFF-001'), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.handoffId, 'HANDOFF-001');
  assert.equal(body.workId, 'WORK-001');
  assert.equal(body.checkpointId, 'CP-001');
  assert.equal(body.readbackStatus, 'VERIFIED');
  assert.equal(body.evidenceRefs.includes('factory-receipt://HANDOFF-001'), true);
  assert.equal(body.evidenceRefs.includes('factory-readback://HANDOFF-001'), true);
  assert.equal(body.authorityTransferred, false);
});

test('durable readback rejects missing identity and unknown handoff', async () => {
  const env = { HANDOFF_LEDGER: makeLedgerNamespace() };
  const missing = await worker.fetch(new Request('https://factory.example/hub_factory_readback'), env);
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, 'HANDOFF_ID_REQUIRED');

  const unknown = await worker.fetch(new Request('https://factory.example/hub_factory_readback?handoffId=UNKNOWN'), env);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error, 'HANDOFF_NOT_FOUND');
});


test('Factory reports only verified evidence to Olympus without transferring ownership', async () => {
  const originalFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url:String(url), init };
    return Response.json({ status:'CURRENT', appId:'ergasterion', owner:'ERGASTERION' });
  };
  try {
    const env = { OLYMPUS_URL:'https://olympus.example/' };
    const input = {
      version:'1.2.3',
      sourceRevision:'rev-123',
      artifactSha:'sha256:factory',
      provenanceRef:'github://Ergasterion-factory/rev-123',
      verified:true,
      evidence:['factory-readback://HANDOFF-001'],
    };
    const response = await worker.fetch(new Request('https://factory.example/api/olympus/current-report', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(input),
    }), env);
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.status, 'REPORTED');
    assert.equal(body.authorityTransferred, false);
    assert.equal(seen.url, 'https://olympus.example/reports/current');
    const payload = JSON.parse(seen.init.body);
    assert.equal(payload.appId, 'ergasterion');
    assert.equal(payload.owner, 'ERGASTERION');
    assert.equal(payload.verified, true);
    assert.deepEqual(payload.evidence, ['factory-readback://HANDOFF-001']);
  } finally { globalThis.fetch = originalFetch; }
});

test('Factory refuses to report unverified Current to Olympus', async () => {
  const response = await worker.fetch(new Request('https://factory.example/api/olympus/current-report', {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({
      version:'1', sourceRevision:'rev', artifactSha:'sha', provenanceRef:'github://factory/rev', verified:false, evidence:[],
    }),
  }), { OLYMPUS_URL:'https://olympus.example' });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'CURRENT_REPORT_VERIFIED_EVIDENCE_REQUIRED');
});


async function adminRequest(payload, secret = 'shared-secret') {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  return new Request('https://factory.example/api/cloudflare/admin', {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-go-hub-protocol':PROTOCOL,
      'x-go-hub-timestamp':timestamp,
      'x-go-hub-signature':await sign(body, secret, timestamp),
    },
    body,
  });
}

test('Cloudflare admin route is Hub-authenticated and never exposes secrets', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /api\.cloudflare\.com\/client\/v4\/accounts\/acct\/storage\/kv\/namespaces/);
    return Response.json({ success:true, result:[] });
  };
  try {
    const env = {
      ERGASTERION_HUB_SHARED_SECRET:'shared-secret',
      CLOUDFLARE_API_TOKEN:'super-secret-token',
      CLOUDFLARE_ACCOUNT_ID:'acct',
    };
    const response = await worker.fetch(await adminRequest({ operation:'verify_auth' }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'PASS');
    assert.equal(body.secretsExposed, false);
    assert.equal(JSON.stringify(body).includes('super-secret-token'), false);

    const health = await worker.fetch(new Request('https://factory.example/api/hub-factory/health'), env);
    const healthBody = await health.json();
    assert.equal(healthBody.cloudflareAdmin.configured, true);
    assert.equal(healthBody.cloudflareAdmin.mutationMode, 'FACTORY_ONLY');
    assert.equal(healthBody.cloudflareAdmin.secretsExposed, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('Factory creates OLYMPUS_STATE idempotently through authenticated Cloudflare admin route', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url:String(url), method:init.method || 'GET', body:init.body || null });
    if ((init.method || 'GET') === 'GET') return Response.json({ success:true, result:[] });
    assert.equal(init.method, 'POST');
    assert.equal(init.body, JSON.stringify({ title:'OLYMPUS_STATE' }));
    return Response.json({ success:true, result:{ id:'kv-olympus-001', title:'OLYMPUS_STATE' } });
  };
  try {
    const env = {
      ERGASTERION_HUB_SHARED_SECRET:'shared-secret',
      CLOUDFLARE_API_TOKEN:'token',
      CLOUDFLARE_ACCOUNT_ID:'acct',
    };
    const response = await worker.fetch(await adminRequest({ operation:'create_kv_namespace', title:'OLYMPUS_STATE' }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'CREATED');
    assert.deepEqual(body.namespace, { id:'kv-olympus-001', title:'OLYMPUS_STATE' });
    assert.equal(calls.length, 2);

    globalThis.fetch = async () => Response.json({ success:true, result:[{ id:'kv-olympus-001', title:'OLYMPUS_STATE' }] });
    const retry = await worker.fetch(await adminRequest({ operation:'create_kv_namespace', title:'OLYMPUS_STATE' }), env);
    const retryBody = await retry.json();
    assert.equal(retryBody.status, 'EXISTS');
    assert.equal(retryBody.created, false);
    assert.equal(retryBody.namespace.id, 'kv-olympus-001');
  } finally { globalThis.fetch = originalFetch; }
});

test('Cloudflare admin route rejects unsigned mutation', async () => {
  const env = {
    ERGASTERION_HUB_SHARED_SECRET:'shared-secret',
    CLOUDFLARE_API_TOKEN:'token',
    CLOUDFLARE_ACCOUNT_ID:'acct',
  };
  const response = await worker.fetch(new Request('https://factory.example/api/cloudflare/admin', {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({operation:'create_kv_namespace',title:'OLYMPUS_STATE'}),
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'HUB_FACTORY_PROTOCOL_HEADER_INVALID');
});
