import { createHmac, timingSafeEqual } from 'node:crypto';
export const HUB_FACTORY_SIGNATURE_HEADER = 'x-go-hub-signature';
export const HUB_FACTORY_TIMESTAMP_HEADER = 'x-go-hub-timestamp';
export function signHubFactoryPayload(payload, secret, timestamp = '') { if (!secret) throw new Error('HUB_FACTORY_SECRET_REQUIRED'); const body = typeof payload === 'string' ? payload : JSON.stringify(payload); return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex'); }
export function verifyHubFactoryRequest(payload, headers, { secret = '', required = true, maxAgeMs = 300000, now = Date.now } = {}) {
  if (!secret) { if (required) throw new Error('HUB_FACTORY_AUTH_NOT_CONFIGURED'); return { authenticated: false, mode: 'local-development' }; }
  const timestamp = String(headers?.[HUB_FACTORY_TIMESTAMP_HEADER] || '').trim(), supplied = String(headers?.[HUB_FACTORY_SIGNATURE_HEADER] || '').trim().toLowerCase(), age = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || !Number.isFinite(age) || Math.abs(now() - age) > maxAgeMs) throw new Error('HUB_FACTORY_SIGNATURE_EXPIRED');
  const expected = signHubFactoryPayload(payload, secret, timestamp), a = Buffer.from(supplied, 'hex'), b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('HUB_FACTORY_SIGNATURE_INVALID');
  return { authenticated: true, mode: 'hmac-sha256', timestamp };
}
