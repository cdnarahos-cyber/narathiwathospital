import { getSupabaseConfig, getSupabaseUser, hasSupabaseCredentials, hasSupabaseSession } from '../config/supabase.js';

const QUEUE_KEY = 'ndss-pending-audit-events';

const headers = () => {
  const config = getSupabaseConfig();
  return { apikey: config.publishableKey, Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' };
};

const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };
const writeQueue = events => localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-50)));
const scrub = value => String(value || '').replace(/\b\d{5,}\b/g, '[redacted]').slice(0, 240);

async function send(event) {
  if (!hasSupabaseCredentials() || !hasSupabaseSession()) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูลกลาง');
  const actorId = getSupabaseUser()?.sub;
  if (!actorId) throw new Error('ไม่พบผู้ใช้ที่เข้าสู่ระบบ');
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/ndss_audit_events`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ actor_id: actorId, action: 'connection_failure', entity_type: 'client_sync', severity: 'error', details: { operation: scrub(event.operation), message: scrub(event.message) } }),
  });
  if (!response.ok) throw new Error('ไม่สามารถส่งบันทึกการขัดข้องได้');
}

export async function logCentralActivity(action) {
  if (!hasSupabaseCredentials() || !hasSupabaseSession()) return;
  const actorId=getSupabaseUser()?.sub;
  if (!actorId) return;
  const config=getSupabaseConfig();
  const response=await fetch(`${config.url}/rest/v1/ndss_audit_events`, {
    method:'POST', headers:headers(),
    body:JSON.stringify({ actor_id:actorId, action:'client_activity', entity_type:'client_ui', severity:'info', details:{ action:scrub(action) } }),
  });
  if (!response.ok) throw new Error('ไม่สามารถบันทึกกิจกรรมส่วนกลางได้');
}

export async function fetchCentralAuditEvents() {
  if (!hasSupabaseCredentials() || !hasSupabaseSession()) return [];
  const config=getSupabaseConfig();
  const response=await fetch(`${config.url}/rest/v1/ndss_audit_events?select=occurred_at,action,entity_type,severity,details&order=occurred_at.desc&limit=200`, { headers:headers() });
  const result=await response.json().catch(() => []);
  if (!response.ok) throw new Error(result?.message || 'ไม่สามารถโหลด Audit Log กลางได้');
  return Array.isArray(result) ? result.map(row => ({
    action: row.action === 'client_activity' ? (row.details?.action || 'กิจกรรมจากหน้าจอ') : `${row.action} · ${row.entity_type}`,
    detail: row.action === 'connection_failure' ? `การเชื่อมต่อขัดข้อง: ${row.details?.operation || '-'}` : 'บันทึกจากฐานข้อมูลกลาง',
    at: row.occurred_at,
    source: 'central',
    severity: row.severity,
  })) : [];
}

export async function reportCentralFailure(operation, error) {
  const event = { operation, message: error?.message || String(error || 'ไม่ทราบสาเหตุ'), at: new Date().toISOString() };
  globalThis.dispatchEvent?.(new CustomEvent('ndss-central-failure', { detail: { operation: scrub(operation) } }));
  try { await send(event); }
  catch { writeQueue([...readQueue(), event]); }
}

export async function flushCentralFailureQueue() {
  const queued = readQueue();
  if (!queued.length) return 0;
  const remaining = [];
  for (const event of queued) {
    try { await send(event); } catch { remaining.push(event); }
  }
  writeQueue(remaining);
  return queued.length - remaining.length;
}
