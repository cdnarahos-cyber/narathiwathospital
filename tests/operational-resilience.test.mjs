import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) || '',
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
globalThis.NDSS_CONFIG = { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test-publishable-key' };
const token = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
storage.set('ndss-supabase-access-token', token({ sub: 'test-actor', exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { ndss_role: 'officer' } }));

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}
if (!globalThis.addEventListener) {
  const eventBus = new EventTarget();
  globalThis.addEventListener = eventBus.addEventListener.bind(eventBus);
  globalThis.dispatchEvent = eventBus.dispatchEvent.bind(eventBus);
}

let visibleFailures = 0;
globalThis.addEventListener('ndss-central-failure', () => { visibleFailures += 1; });

// A connection failure must be visible to the user, avoid retaining an
// identifiable long number in the queued message, and be retried later.
globalThis.fetch = async () => { throw new Error('network unavailable for case 1234567890123'); };
const audit = await import(`../src/services/audit-service.js?resilience=${Date.now()}`);
await audit.reportCentralFailure('ซิงก์เคส 1234567890123', new Error('network unavailable for case 1234567890123'));
assert.equal(visibleFailures, 1, 'a central failure must notify the application');
const queued = JSON.parse(storage.get('ndss-pending-audit-events'));
assert.equal(queued.length, 1, 'a failed central audit event must be queued');
assert.ok(!queued[0].message.includes('1234567890123'), 'queued diagnostic data must redact long identifiers');

let auditWrites = 0;
globalThis.fetch = async () => { auditWrites += 1; return new Response('', { status: 201 }); };
assert.equal(await audit.flushCentralFailureQueue(), 1, 'the queued central audit event must flush after recovery');
assert.equal(JSON.parse(storage.get('ndss-pending-audit-events')).length, 0, 'a delivered audit event must leave the retry queue');
assert.equal(auditWrites, 1, 'recovery must send exactly the queued event once');

// Simulate several officers submitting a file at once. This is deliberately
// fully mocked: it verifies client-side chunking/deduplication without sending
// artificial load or patient data to the production Supabase project.
let activeRequests = 0;
let peakRequests = 0;
const payloads = [];
globalThis.fetch = async (_url, request) => {
  activeRequests += 1;
  peakRequests = Math.max(peakRequests, activeRequests);
  payloads.push(JSON.parse(request.body));
  await new Promise(resolve => setTimeout(resolve, 4));
  activeRequests -= 1;
  return new Response('', { status: 201 });
};
const reports = await import(`../src/services/report506-service.js?resilience=${Date.now()}`);
const rows = Array.from({ length: 205 }, (_, index) => ({
  hn: `HN-${index + 1}`,
  patient: `Test ${index + 1}`,
  disease: 'Dengue',
  onset: '2026-09-13',
  tambon: 'Test area',
}));
const firstKeys = reports.with506SyncKeys(rows).map(row => row.syncKey);
const secondKeys = reports.with506SyncKeys(rows).map(row => row.syncKey);
assert.deepEqual(firstKeys, secondKeys, 'the same imported records must retain stable central keys');
await Promise.all(Array.from({ length: 4 }, () => reports.save506Records(rows)));
assert.ok(peakRequests > 1, 'simulated concurrent imports must not serialize or throw');
assert.equal(payloads.length, 12, 'each of four 205-row imports must be chunked into 100/100/5 records');
assert.ok(payloads.every(payload => payload.length > 0 && payload.length <= 100), 'central import chunks must stay within the safe 100-record bound');
const uniqueKeys = new Set(payloads.flat().map(row => row.source_key));
assert.equal(uniqueKeys.size, rows.length, 'concurrent duplicate uploads must use the same source keys for database upsert');

console.log(`operational resilience tests passed (4 concurrent 205-row imports; peak ${peakRequests} simulated requests)`);
