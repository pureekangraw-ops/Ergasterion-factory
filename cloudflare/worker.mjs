const PROTOCOL = 'GO_HUB_ERGASTERION_FACTORY_V1';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const text = (value) => String(value ?? '').trim();
const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store' },
});

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function fromHex(value) {
  const normalized = text(value).toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2) return null;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function verifyHmac({ body, secret, timestamp, signature }) {
  const provided = fromHex(signature);
  if (!provided || !text(secret)) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    provided,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
}

function reject(error, status = 400, details = {}) {
  return json({ ok: false, status: 'REJECTED', error, ...details }, status);
}

function validatePacket(packet) {
  if (!packet || typeof packet !== 'object') return 'HANDOFF_BODY_INVALID';
  if (text(packet.protocol) !== PROTOCOL) return 'HANDOFF_PROTOCOL_INVALID';
  if (text(packet.source) !== 'PRYTANEION' || text(packet.destination) !== 'ERGASTERION') return 'HANDOFF_ROUTE_INVALID';
  for (const field of ['handoffId', 'workId', 'checkpointId', 'requestedResult']) {
    if (!text(packet[field])) return `HANDOFF_${field.toUpperCase()}_REQUIRED`;
  }
  return null;
}

export class HandoffLedger {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    if (request.method !== 'POST') return reject('METHOD_NOT_ALLOWED', 405);
    const input = await request.json();
    const existing = await this.ctx.storage.get('handoff');
    if (existing) {
      if (existing.requestSha !== input.requestSha) {
        return reject('HANDOFF_ID_CONFLICT', 409, {
          handoffId: existing.receipt.handoffId,
          workId: existing.receipt.workId,
          checkpointId: existing.receipt.checkpointId,
        });
      }
      return json({ ...existing.receipt, duplicate: true, idempotency: 'DUPLICATE' });
    }

    const receipt = {
      ok: true,
      protocol: PROTOCOL,
      status: 'RECEIVED',
      handoffId: input.packet.handoffId,
      source: 'ERGASTERION',
      destination: 'PRYTANEION',
      workId: input.packet.workId,
      checkpointId: input.packet.checkpointId,
      duplicate: false,
      idempotency: 'CREATED',
      authorityTransferred: false,
      routeAuthorityCreated: false,
      approval: 'NOT_AN_APPROVAL',
      receivedAt: input.receivedAt,
      evidenceRefs: [`factory-receipt://${input.packet.handoffId}`],
      audit: {
        requestSha: input.requestSha,
        authenticated: true,
        protocol: PROTOCOL,
      },
    };
    await this.ctx.storage.put('handoff', { requestSha: input.requestSha, receipt });
    return json(receipt);
  }
}

async function receiveHandoff(request, env) {
  if (!text(env?.ERGASTERION_HUB_SHARED_SECRET)) {
    return reject('FACTORY_SHARED_SECRET_NOT_CONFIGURED', 503);
  }
  if (!env?.HANDOFF_LEDGER) {
    return reject('HANDOFF_LEDGER_NOT_CONFIGURED', 503);
  }

  const timestamp = text(request.headers.get('x-go-hub-timestamp'));
  const signature = text(request.headers.get('x-go-hub-signature'));
  const headerProtocol = text(request.headers.get('x-go-hub-protocol'));
  if (headerProtocol !== PROTOCOL) return reject('HUB_FACTORY_PROTOCOL_HEADER_INVALID', 400);

  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || Math.abs(Date.now() - numericTimestamp) > MAX_CLOCK_SKEW_MS) {
    return reject('HUB_FACTORY_TIMESTAMP_INVALID', 401);
  }

  const body = await request.text();
  const authenticated = await verifyHmac({
    body,
    secret: env.ERGASTERION_HUB_SHARED_SECRET,
    timestamp,
    signature,
  });
  if (!authenticated) return reject('HUB_FACTORY_SIGNATURE_INVALID', 401);

  let packet;
  try {
    packet = JSON.parse(body);
  } catch {
    return reject('HANDOFF_JSON_INVALID', 400);
  }
  const packetError = validatePacket(packet);
  if (packetError) return reject(packetError, 400);

  const requestSha = await sha256(body);
  const ledger = env.HANDOFF_LEDGER.get(env.HANDOFF_LEDGER.idFromName(text(packet.handoffId)));
  return ledger.fetch('https://handoff-ledger.internal/receive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packet, requestSha, receivedAt: new Date().toISOString() }),
  });
}

function transportHealth(env) {
  const secretConfigured = Boolean(text(env?.ERGASTERION_HUB_SHARED_SECRET));
  const ledgerBound = Boolean(env?.HANDOFF_LEDGER);
  return {
    ok: true,
    product: 'ERGASTERION',
    runtime: 'CLOUDFLARE_WORKER',
    protocol: PROTOCOL,
    authenticatedTransport: secretConfigured && ledgerBound,
    secretConfigured,
    ledgerBound,
  };
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
      return json({
        ok: true,
        product: 'ERGASTERION',
        runtime: 'CLOUDFLARE_WORKER',
        surface: 'CLOUDFLARE_FACTORY_EDGE',
        status: 'READY',
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/hub-factory/health') {
      return json(transportHealth(env));
    }

    if (request.method === 'POST' && (url.pathname === '/api/hub-factory/receive' || url.pathname === '/hub_factory_receive')) {
      return receiveHandoff(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/hub_factory_readback') {
      return json({
        ok: false,
        status: 'NOT_WIRED',
        next: 'P3_DURABLE_READBACK',
      }, 501);
    }

    return json({ ok: false, error: 'NOT_FOUND' }, 404);
  },
};
