function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        product: 'ERGASTERION',
        surface: 'CLOUDFLARE_FACTORY_EDGE',
        status: 'READY',
      });
    }

    if (request.method === 'POST' && url.pathname === '/hub_factory_receive') {
      return json({
        ok: false,
        status: 'NOT_WIRED',
        next: 'P2_HUB_FACTORY_TRANSPORT',
      }, 501);
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
