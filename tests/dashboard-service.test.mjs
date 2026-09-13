import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) || '',
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
globalThis.NDSS_CONFIG = { supabasePublishableKey: 'test-publishable-key' };
const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const oldToken = token({ sub: 'admin-test', exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { ndss_role: 'viewer' } });
const renewedToken = token({ sub: 'admin-test', exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { ndss_role: 'admin' } });
storage.set('ndss-supabase-access-token', oldToken);
storage.set('ndss-supabase-refresh-token', 'refresh-token');

let deleteCalls = 0;
let refreshCalls = 0;
globalThis.fetch = async (url, request = {}) => {
  if (String(url).includes('grant_type=refresh_token')) {
    refreshCalls += 1;
    assert.equal(JSON.parse(request.body).refresh_token, 'refresh-token');
    return new Response(JSON.stringify({ access_token: renewedToken, refresh_token: 'renewed-refresh-token' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  deleteCalls += 1;
  assert.equal(request.method, 'DELETE');
  return deleteCalls === 1
    ? new Response(JSON.stringify({ message: 'RLS denied with old claim' }), { status: 403, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify([{ id: 'case-1' }]), { status: 200, headers: { 'content-type': 'application/json' } });
};

const service = await import(`../src/services/dashboard-service.js?test=${Date.now()}`);
const deleted = await service.deleteInvestigationCase('case-1');
assert.equal(deleted.id, 'case-1', 'an ADMIN delete must succeed after one fresh JWT retry');
assert.equal(deleteCalls, 2, 'a stale authorization claim must retry deletion once');
assert.equal(refreshCalls, 1, 'a stale authorization claim must refresh the session once');

storage.set('ndss-supabase-access-token', renewedToken);
storage.set('ndss-supabase-refresh-token', 'renewed-refresh-token');
let deniedCalls = 0;
globalThis.fetch = async () => {
  deniedCalls += 1;
  return new Response(JSON.stringify({ message: 'still forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
};
await assert.rejects(() => service.deleteInvestigationCase('case-2', false), /สิทธิ์ ADMIN ไม่เป็นปัจจุบัน/, 'a genuine authorization denial must be actionable');
assert.equal(deniedCalls, 1, 'a non-refresh retry must not loop');

globalThis.fetch = async () => new Response(JSON.stringify({ message: 'invalid uuid' }), { status: 400, headers: { 'content-type': 'application/json' } });
await assert.rejects(() => service.deleteInvestigationCase('not-a-uuid', false), /รหัสเคสที่เชื่อมโยง/, 'an invalid remote case identifier must explain how to recover');

console.log('dashboard service delete tests passed');
