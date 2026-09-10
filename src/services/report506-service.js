import { getSupabaseConfig, hasSupabaseCredentials, hasSupabaseSession } from '../config/supabase.js';

const table = 'surveillance_506_records';
const headers = extra => {
  const config = getSupabaseConfig();
  return { apikey: config.publishableKey, Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json', ...extra };
};

const hash = value => {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0).toString(36);
};

export const canSync506Records = () => hasSupabaseCredentials() && hasSupabaseSession();

export const with506SyncKeys = rows => rows.map((row, index) => {
  if (row.syncKey) return row;
  const identity = [row.hn, row.cid, row.disease, row.onset, row.tambon, row.district, row.location, row.importedAt, index].join('|');
  return { ...row, syncKey: `506-${hash(identity)}` };
});

export async function save506Records(rows) {
  if (!canSync506Records() || !rows.length) return [];
  const prepared = with506SyncKeys(rows);
  const config = getSupabaseConfig();
  const chunks = [];
  for (let index = 0; index < prepared.length; index += 100) chunks.push(prepared.slice(index, index + 100));
  for (const chunk of chunks) {
    const payload = chunk.map(row => ({
      source_key: row.syncKey,
      disease_name: row.disease || null,
      onset_date: /^\d{4}-\d{2}-\d{2}$/.test(String(row.onset || '')) ? row.onset : null,
      location_name: row.location || [row.tambon, row.district].filter(Boolean).join(' ') || null,
      raw_record: row,
    }));
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=source_key`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result?.message || 'ไม่สามารถบันทึกข้อมูล รง.506 ลงฐานข้อมูลกลางได้');
    }
  }
  return prepared;
}

export async function fetch506Records() {
  if (!canSync506Records()) return [];
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${table}?select=source_key,raw_record,updated_at&order=updated_at.desc&limit=10000`, { headers: headers() });
  const result = await response.json().catch(() => []);
  if (!response.ok) throw new Error(result?.message || 'ไม่สามารถโหลดข้อมูล รง.506 จากฐานข้อมูลกลางได้');
  return Array.isArray(result) ? result.map(row => ({ ...(row.raw_record || {}), syncKey: row.source_key, syncState: 'synced' })) : [];
}
