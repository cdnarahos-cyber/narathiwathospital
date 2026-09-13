import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) || '',
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
globalThis.NDSS_CONFIG = { supabasePublishableKey: 'test-publishable-key' };

const token = (payload = {}) => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const expired = token({ exp: Math.floor(Date.now() / 1000) - 60, app_metadata: { ndss_role: 'officer' } });
const renewed = token({ exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { ndss_role: 'officer' } });
storage.set('ndss-supabase-access-token', expired);
storage.set('ndss-supabase-refresh-token', 'refresh-token');

let refreshCalls = 0;
globalThis.fetch = async (url, options) => {
  refreshCalls += 1;
  assert.match(String(url), /grant_type=refresh_token/);
  assert.equal(JSON.parse(options.body).refresh_token, 'refresh-token');
  return new Response(JSON.stringify({ access_token: renewed, refresh_token: 'next-refresh-token' }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const auth = await import(`../src/config/supabase.js?test=${Date.now()}`);
assert.equal(auth.isSupabaseSessionExpired(), true, 'expired access token must be detected');
assert.equal(await auth.restoreSupabaseSession(), true, 'valid refresh token must restore the session');
assert.equal(refreshCalls, 1, 'expired session must refresh once');
assert.equal(auth.getSupabaseConfig().accessToken, renewed, 'renewed access token must be stored');

storage.set('ndss-supabase-access-token', expired);
storage.delete('ndss-supabase-refresh-token');
assert.equal(await auth.restoreSupabaseSession(), false, 'expired session without refresh token must require sign-in');
assert.equal(auth.getSupabaseConfig().accessToken, '', 'invalid expired token must be cleared');

console.log('supabase session tests passed');
