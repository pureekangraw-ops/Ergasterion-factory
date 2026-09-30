import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../cloudflare/worker.mjs';

test('Cloudflare Factory edge exposes health without pretending transport is wired', async () => {
  const response = await worker.fetch(new Request('https://factory.example/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    product: 'ERGASTERION',
    surface: 'CLOUDFLARE_FACTORY_EDGE',
    status: 'READY',
  });
});

test('Cloudflare Factory edge keeps Hub receive explicitly unwired until P2', async () => {
  const response = await worker.fetch(new Request('https://factory.example/hub_factory_receive', {
    method: 'POST',
  }));
  assert.equal(response.status, 501);
  assert.deepEqual(await response.json(), {
    ok: false,
    status: 'NOT_WIRED',
    next: 'P2_HUB_FACTORY_TRANSPORT',
  });
});

test('Cloudflare Factory edge keeps durable readback explicitly unwired until P3', async () => {
  const response = await worker.fetch(new Request('https://factory.example/hub_factory_readback'));
  assert.equal(response.status, 501);
  assert.deepEqual(await response.json(), {
    ok: false,
    status: 'NOT_WIRED',
    next: 'P3_DURABLE_READBACK',
  });
});
