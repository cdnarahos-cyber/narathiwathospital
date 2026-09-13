import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) || '',
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
globalThis.NDSS_CONFIG = { supabasePublishableKey: 'test-publishable-key' };
const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
storage.set('ndss-supabase-access-token', token({ sub: 'admin-test', exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { ndss_role: 'admin' } }));

const service = await import(`../src/services/operational-service.js?test=${Date.now()}`);
for (const [kind, table] of [['contact', 'case_contacts'], ['lab', 'lab_results'], ['task', 'response_tasks']]) {
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([{ id: `${kind}-1` }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const deleted = await service.deleteOperationalRecord(kind, `${kind}-1`);
  assert.equal(deleted.id, `${kind}-1`, `${kind} delete must return the central row`);
  assert.match(request.url, new RegExp(`/rest/v1/${table}\\?id=eq\\.${kind}-1$`), `${kind} must target its central table`);
  assert.equal(request.options.method, 'DELETE', `${kind} must use DELETE`);
  assert.match(request.options.headers.Prefer, /return=representation/, `${kind} delete must verify a returned row`);
}

globalThis.fetch = async () => new Response(JSON.stringify({ message: 'RLS denied' }), { status: 403, headers: { 'content-type': 'application/json' } });
await assert.rejects(() => service.deleteOperationalRecord('contact', 'denied'), /RLS denied/, 'a failed central delete must not look successful');

console.log('operational service delete tests passed');
