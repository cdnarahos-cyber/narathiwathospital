import assert from 'node:assert/strict';

const store = new Map([['ndss-supabase-access-token', 'test-token']]);
globalThis.localStorage = {
  getItem: key => store.get(key) || '',
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
};
globalThis.NDSS_CONFIG = { supabasePublishableKey: 'test-publishable-key' };

const service = await import(`../src/services/report506-service.js?test=${Date.now()}`);
const baseCase = {
  hn: 'TEST-001', cid: '1234567890123', patient: 'Test Patient',
  disease: 'ไข้เลือดออก', onset: '2026-09-01', tambon: 'บางนาค', district: 'เมืองนราธิวาส', location: 'พื้นที่ทดสอบ',
};

const [first] = service.with506SyncKeys([{ ...baseCase, importedAt: '2026-09-11T01:00:00.000Z' }]);
const [sameCaseLater] = service.with506SyncKeys([{ ...baseCase, importedAt: '2026-09-11T02:00:00.000Z' }]);
const [otherCase] = service.with506SyncKeys([{ ...baseCase, hn: 'TEST-002' }]);
assert.equal(first.syncKey, sameCaseLater.syncKey, 'same case must keep one central source key');
assert.notEqual(first.syncKey, otherCase.syncKey, 'different cases must not share a source key');

let retryCalls = 0;
globalThis.fetch = async () => {
  retryCalls += 1;
  return retryCalls < 3
    ? new Response(JSON.stringify({ message: 'temporary outage' }), { status: 503, headers: { 'content-type': 'application/json' } })
    : new Response('', { status: 201 });
};
await service.save506Records([baseCase]);
assert.equal(retryCalls, 3, 'temporary server errors must retry twice before success');

let forbiddenCalls = 0;
globalThis.fetch = async () => {
  forbiddenCalls += 1;
  return new Response(JSON.stringify({ message: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
};
await assert.rejects(() => service.save506Records([baseCase]));
assert.equal(forbiddenCalls, 1, 'permission failures must not retry');

console.log('report506-service tests passed');
