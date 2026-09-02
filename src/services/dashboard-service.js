import { getSupabaseConfig, getSupabaseUser, hasSupabaseCredentials, hasSupabaseSession } from '../config/supabase.js';

const apiHeaders = (extra = {}) => {
  const config = getSupabaseConfig();
  return {
    apikey: config.publishableKey,
    Authorization: `Bearer ${config.accessToken || config.publishableKey}`,
    ...extra,
  };
};

const caseNumberFor = record => record.remoteCaseNumber || `NDSS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export async function syncInvestigationCase(record) {
  if (!hasSupabaseCredentials() || !hasSupabaseSession()) return { ...record, syncState: 'local' };
  const userId = getSupabaseUser().sub;
  if (!userId) throw new Error('ไม่พบข้อมูลผู้ใช้สำหรับบันทึกเคส');

  const caseNumber = caseNumberFor(record);
  const payload = {
    case_number: caseNumber,
    disease_name: record.disease || 'ไม่ระบุโรค',
    patient_summary: record.patient || record.hn || 'ไม่ระบุผู้ป่วย',
    location_name: record.location || 'ไม่ระบุพื้นที่',
    status: record.remoteStatus || 'pending',
    reported_at: record.onset || record.createdAt || new Date().toISOString(),
    assigned_to: userId,
  };
  const isUpdate = Boolean(record.remoteCaseId);
  const response = await fetch(
    `${getSupabaseConfig().url}/rest/v1/disease_cases${isUpdate ? `?id=eq.${encodeURIComponent(record.remoteCaseId)}` : ''}`,
    {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(payload),
    },
  );
  const result = await response.json().catch(() => []);
  if (!response.ok || !result[0]) throw new Error(`บันทึกฐานข้อมูลกลางไม่สำเร็จ${result?.message ? `: ${result.message}` : ''}`);
  return { ...record, remoteCaseId: result[0].id, remoteCaseNumber: result[0].case_number, remoteStatus: result[0].status, syncState: 'synced' };
}

// Fetches only rows allowed by the caller's RLS policies.  This lets a signed-in
// user see their assigned/created investigation cases after changing browser or
// refreshing, while the detailed form data can remain available locally.
export async function fetchInvestigationCases() {
  if (!hasSupabaseCredentials() || !hasSupabaseSession()) return [];
  const config=getSupabaseConfig();
  const response=await fetch(`${config.url}/rest/v1/disease_cases?select=id,case_number,disease_name,patient_summary,location_name,status,reported_at,updated_at&order=reported_at.desc&limit=200`, {
    headers: apiHeaders(),
  });
  const result=await response.json().catch(() => []);
  if (!response.ok) throw new Error(`ไม่สามารถโหลดเคสจากฐานข้อมูลกลางได้${result?.message ? `: ${result.message}` : ''}`);
  return Array.isArray(result) ? result.map(row => ({
    remoteCaseId: row.id,
    remoteCaseNumber: row.case_number,
    remoteStatus: row.status,
    disease: row.disease_name || 'ไม่ระบุโรค',
    patient: row.patient_summary || 'ไม่ระบุผู้ป่วย',
    location: row.location_name || 'ไม่ระบุพื้นที่',
    onset: row.reported_at ? String(row.reported_at).slice(0, 10) : '',
    createdAt: row.reported_at || '',
    updatedAt: row.updated_at || row.reported_at || '',
    syncState: 'synced',
  })) : [];
}

export async function getDashboardData() {
  if (!hasSupabaseCredentials()) return { metrics: [], cases: [], alerts: [], source: 'unconfigured' };
  if (!hasSupabaseSession()) return { metrics: [], cases: [], alerts: [], source: 'signed-out' };
  const supabaseConfig = getSupabaseConfig();

  const headers = apiHeaders();
  const request = (table, query) => fetch(`${supabaseConfig.url}/rest/v1/${table}?${query}`, { headers })
    .then(async response => {
      if (!response.ok) throw new Error(`${table}: ${response.status}`);
      return response.json();
    });

  try {
    const [liveCases, liveAlerts] = await Promise.all([
      request('disease_cases', 'select=case_number,disease_name,patient_summary,location_name,reported_at,status&order=reported_at.desc&limit=20'),
      request('smart_alerts', 'select=title,detail,severity,created_at&order=created_at.desc&limit=10'),
    ]);
    const labels = { pending: ['รอพื้นที่รับรายงาน', 'gold'], acknowledged: ['รับทราบแล้ว', 'blue'], in_progress: ['อยู่ระหว่างดำเนินการ', 'blue'], controlled: ['ควบคุมโรคแล้ว', 'green'], overdue: ['เกินกำหนด', 'red'] };
    const metrics = [
      ['เคสเฝ้าระวัง', String(liveCases.length), 'ราย', '', 'blue'],
      ['รอดำเนินการ', String(liveCases.filter(row => ['pending', 'overdue'].includes(row.status)).length), 'ราย', '', 'orange'],
      ['กำลังติดตาม', String(liveCases.filter(row => ['acknowledged', 'in_progress'].includes(row.status)).length), 'ราย', '', 'purple'],
      ['แจ้งเตือนสำคัญ', String(liveAlerts.filter(row => row.severity === 'critical').length), 'รายการ', '', 'red'],
    ];
    return {
      metrics,
      cases: liveCases.map(row => [row.case_number, row.disease_name, row.patient_summary, row.location_name, new Date(row.reported_at).toLocaleString('th-TH'), labels[row.status]?.[0] || row.status, labels[row.status]?.[1] || 'blue']),
      alerts: liveAlerts.map(row => ['●', row.title, row.detail || '', new Date(row.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), row.severity === 'critical' ? 'red' : row.severity === 'warning' ? 'orange' : 'blue']),
      source: 'live',
    };
  } catch (error) {
    console.warn('Supabase dashboard query unavailable.', error);
    return { metrics: [], cases: [], alerts: [], source: 'unavailable' };
  }
}

