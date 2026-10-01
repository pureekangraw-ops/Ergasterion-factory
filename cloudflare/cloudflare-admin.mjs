const text = (v) => String(v ?? '').trim();

function config(env) {
  return {
    token: text(env?.CLOUDFLARE_API_TOKEN),
    accountId: text(env?.CLOUDFLARE_ACCOUNT_ID),
  };
}

export function cloudflareAdminCapabilities(env = {}) {
  const { token, accountId } = config(env);
  return {
    configured: Boolean(token && accountId),
    tokenConfigured: Boolean(token),
    accountConfigured: Boolean(accountId),
    secretsExposed: false,
    mutationMode: 'FACTORY_ONLY',
    operations: ['verify_auth', 'list_kv_namespaces', 'create_kv_namespace'],
  };
}

async function api(env, path, init = {}) {
  const { token, accountId } = config(env);
  if (!token || !accountId) {
    return { ok:false, status:503, error:'CLOUDFLARE_FACTORY_CREDENTIALS_NOT_CONFIGURED' };
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type':'application/json',
      ...(init.headers || {}),
    },
  });
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok || body?.success === false) {
    return {
      ok:false,
      status:response.status,
      error:'CLOUDFLARE_API_ERROR',
      errors:Array.isArray(body?.errors) ? body.errors.map(({code,message}) => ({code,message})) : [],
    };
  }
  return { ok:true, status:response.status, result:body?.result ?? body };
}

export async function verifyCloudflareAuth(env) {
  const result = await api(env, '/storage/kv/namespaces?per_page=1');
  return result.ok
    ? { ok:true, status:'PASS', configured:true, secretsExposed:false }
    : { ...result, configured:cloudflareAdminCapabilities(env).configured, secretsExposed:false };
}

export async function listKvNamespaces(env) {
  return api(env, '/storage/kv/namespaces?per_page=100');
}

export async function createKvNamespace(env, title) {
  const normalized = text(title);
  if (!normalized) return { ok:false, status:400, error:'KV_NAMESPACE_TITLE_REQUIRED' };
  const listed = await listKvNamespaces(env);
  if (!listed.ok) return listed;
  const existing = Array.isArray(listed.result) ? listed.result.find((item) => text(item?.title) === normalized) : null;
  if (existing?.id) {
    return { ok:true, status:'EXISTS', created:false, namespace:{ id:existing.id, title:normalized } };
  }
  const created = await api(env, '/storage/kv/namespaces', {
    method:'POST',
    body:JSON.stringify({ title:normalized }),
  });
  if (!created.ok) return created;
  return {
    ok:true,
    status:'CREATED',
    created:true,
    namespace:{ id:text(created.result?.id), title:normalized },
  };
}
