import { cloudflareAdminCapabilities, verifyCloudflareAuth, listKvNamespaces, createKvNamespace } from './cloudflare-admin.mjs';
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
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/readback') {
      const existing = await this.ctx.storage.get('handoff');
      if (!existing) return reject('HANDOFF_NOT_FOUND', 404);
      return json({
        ...existing.receipt,
        readbackStatus: 'VERIFIED',
        evidenceRefs: [...new Set([...(existing.receipt.evidenceRefs || []), `factory-readback://${existing.receipt.handoffId}`])],
      });
    }
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

async function readbackHandoff(request, env) {
  if (!env?.HANDOFF_LEDGER) return reject('HANDOFF_LEDGER_NOT_CONFIGURED', 503);
  const url = new URL(request.url);
  const handoffId = text(url.searchParams.get('handoffId'));
  if (!handoffId) return reject('HANDOFF_ID_REQUIRED', 400);
  const ledger = env.HANDOFF_LEDGER.get(env.HANDOFF_LEDGER.idFromName(handoffId));
  return ledger.fetch('https://handoff-ledger.internal/readback', { method: 'GET' });
}

async function receiveCloudflareAdmin(request, env) {
  if (!text(env?.ERGASTERION_HUB_SHARED_SECRET)) return reject('FACTORY_SHARED_SECRET_NOT_CONFIGURED', 503);
  const timestamp = text(request.headers.get('x-go-hub-timestamp'));
  const signature = text(request.headers.get('x-go-hub-signature'));
  const headerProtocol = text(request.headers.get('x-go-hub-protocol'));
  if (headerProtocol !== PROTOCOL) return reject('HUB_FACTORY_PROTOCOL_HEADER_INVALID', 400);
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || Math.abs(Date.now() - numericTimestamp) > MAX_CLOCK_SKEW_MS) return reject('HUB_FACTORY_TIMESTAMP_INVALID', 401);
  const body = await request.text();
  const authenticated = await verifyHmac({ body, secret: env.ERGASTERION_HUB_SHARED_SECRET, timestamp, signature });
  if (!authenticated) return reject('HUB_FACTORY_SIGNATURE_INVALID', 401);
  let input;
  try { input = JSON.parse(body); } catch { return reject('CLOUDFLARE_ADMIN_JSON_INVALID', 400); }
  const operation = text(input?.operation);
  if (operation === 'verify_auth') return json(await verifyCloudflareAuth(env));
  if (operation === 'list_kv_namespaces') return json(await listKvNamespaces(env));
  if (operation === 'create_kv_namespace') {
    const result = await createKvNamespace(env, input?.title);
    return json(result, result.ok ? 200 : (Number(result.status) || 502));
  }
  return reject('CLOUDFLARE_ADMIN_OPERATION_UNSUPPORTED', 400, { operation });
}

async function reportCurrentToOlympus(request, env) {
  const olympusUrl = text(env?.OLYMPUS_URL);
  if (!olympusUrl) return reject('OLYMPUS_URL_NOT_CONFIGURED', 503);
  let input;
  try { input = await request.json(); } catch { return reject('CURRENT_REPORT_JSON_INVALID', 400); }
  const evidence = Array.isArray(input.evidence) ? input.evidence.filter(Boolean) : [];
  const payload = {
    appId: 'ergasterion',
    version: text(input.version),
    sourceRevision: text(input.sourceRevision),
    artifactSha: text(input.artifactSha),
    runtimeIdentity: text(input.runtimeIdentity) || 'CLOUDFLARE_WORKER',
    owner: 'ERGASTERION',
    provenanceRef: text(input.provenanceRef),
    verified: input.verified === true,
    evidence,
  };
  for (const field of ['version','sourceRevision','artifactSha','provenanceRef']) {
    if (!payload[field]) return reject(`CURRENT_REPORT_${field.toUpperCase()}_REQUIRED`, 400);
  }
  if (!payload.verified || !payload.evidence.length) return reject('CURRENT_REPORT_VERIFIED_EVIDENCE_REQUIRED', 409);
  const response = await fetch(`${olympusUrl.replace(/\/+$/, '')}/reports/current`, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) return json({ ok:false, status:'REJECTED', error:'OLYMPUS_CURRENT_REPORT_FAILED', upstreamStatus:response.status, upstream:body }, 502);
  return json({ ok:true, status:'REPORTED', authorityTransferred:false, sourceOwner:'ERGASTERION', olympus:body }, 202);
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
    durableReadback: ledgerBound,
    cloudflareAdmin: cloudflareAdminCapabilities(env),
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

    if (request.method === 'POST' && url.pathname === '/api/cloudflare/admin') {
      return receiveCloudflareAdmin(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/olympus/current-report') {
      return reportCurrentToOlympus(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/hub-factory/health') {
      return json(transportHealth(env));
    }

    if (request.method === 'POST' && (url.pathname === '/api/hub-factory/receive' || url.pathname === '/hub_factory_receive')) {
      return receiveHandoff(request, env);
    }

    if (request.method === 'GET' && (url.pathname === '/api/hub-factory/readback' || url.pathname === '/hub_factory_readback')) {
      return readbackHandoff(request, env);
    }

    return json({ ok: false, error: 'NOT_FOUND' }, 404);
  },
};
