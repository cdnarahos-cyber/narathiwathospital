import { getSupabaseConfig, getSupabaseUser, hasSupabaseCredentials, hasSupabaseSession } from '../config/supabase.js';

const tables = { lab: 'lab_results', contact: 'case_contacts', task: 'response_tasks' };
const headers = extra => {
  const config = getSupabaseConfig();
  return { apikey: config.publishableKey, Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json', ...extra };
};

export const canSyncOperationalRecords = () => hasSupabaseCredentials() && hasSupabaseSession();

export async function fetchOperationalRecords(kind) {
  if (!canSyncOperationalRecords() || !tables[kind]) return [];
  const response = await fetch(`${getSupabaseConfig().url}/rest/v1/${tables[kind]}?select=*&order=created_at.desc&limit=500`, { headers: headers() });
  const data = await response.json().catch(() => []);
  if (!response.ok) throw new Error(data?.message || 'ไม่สามารถโหลดข้อมูลกลางได้');
  return Array.isArray(data) ? data : [];
}

export async function saveOperationalRecord(kind, payload) {
  if (!canSyncOperationalRecords() || !tables[kind]) return null;
  const userId = getSupabaseUser().sub;
  if (!userId) throw new Error('ไม่พบข้อมูลผู้ใช้สำหรับบันทึก');
  const response = await fetch(`${getSupabaseConfig().url}/rest/v1/${tables[kind]}`, {
    method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify({ ...payload, created_by: userId }),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok || !data[0]) throw new Error(data?.message || 'บันทึกข้อมูลกลางไม่สำเร็จ');
  return data[0];
}

export async function updateOperationalRecord(kind, id, payload) {
  if (!canSyncOperationalRecords() || !tables[kind] || !id) return null;
  const response = await fetch(`${getSupabaseConfig().url}/rest/v1/${tables[kind]}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok || !data[0]) throw new Error(data?.message || 'อัปเดตข้อมูลกลางไม่สำเร็จ');
  return data[0];
}

export async function deleteOperationalRecord(kind, id) {
  if (!canSyncOperationalRecords() || !tables[kind] || !id) return null;
  const response = await fetch(`${getSupabaseConfig().url}/rest/v1/${tables[kind]}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: headers({ Prefer: 'return=representation' }),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok || !data[0]) throw new Error(data?.message || 'ลบข้อมูลกลางไม่สำเร็จ');
  return data[0];
}
