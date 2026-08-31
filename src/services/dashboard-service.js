import { getSupabaseConfig, hasSupabaseCredentials } from '../config/supabase.js';

export async function getDashboardData() {
  if (!hasSupabaseCredentials()) return { metrics: [], cases: [], alerts: [], source: 'unconfigured' };
  const supabaseConfig = getSupabaseConfig();

  const headers = {
    apikey: supabaseConfig.publishableKey,
    Authorization: `Bearer ${supabaseConfig.accessToken || supabaseConfig.publishableKey}`,
  };
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

