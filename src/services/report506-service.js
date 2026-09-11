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
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

// Short, bounded retries absorb temporary API throttling or network jitter
// without turning a bad request (for example, an RLS rejection) into repeats.
async function upsertChunk(url, payload) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(payload),
      });
    } catch (error) {
      lastError = error;
      if (attempt < 2) await pause(300 * (attempt + 1));
      continue;
    }
    if (response.ok) return;
    const result = await response.json().catch(() => ({}));
    if (response.status !== 429 && response.status < 500) {
      throw new Error(result?.message || 'ไม่สามารถบันทึกข้อมูล รง.506 ลงฐานข้อมูลกลางได้');
    }
    lastError = new Error(result?.message || `ฐานข้อมูลกลางตอบกลับ ${response.status}`);
    if (attempt < 2) await pause(300 * (attempt + 1));
  }
  throw lastError || new Error('ไม่สามารถบันทึกข้อมูล รง.506 ลงฐานข้อมูลกลางได้');
}

export const canSync506Records = () => hasSupabaseCredentials() && hasSupabaseSession();

export const with506SyncKeys = rows => rows.map((row, index) => {
  if (row.syncKey) return row;
  // Keep the central identity independent of the browser and import time.  This
  // lets Postgres' unique source_key reject the same case when two officers
  // upload the same file at the same time.  A completely blank row is still
  // distinguished by its row position, but valid 506 rows use patient/case data.
  const hasCaseIdentity = [row.hn, row.cid, row.patient].some(value => String(value || '').trim());
  const identity = hasCaseIdentity
    ? [row.hn, row.cid, row.patient, row.disease, row.onset, row.tambon, row.district, row.location].join('|')
    : [row.disease, row.onset, row.tambon, row.district, row.location, `row-${index + 1}`].join('|');
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
    await upsertChunk(`${config.url}/rest/v1/${table}?on_conflict=source_key`, payload);
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
