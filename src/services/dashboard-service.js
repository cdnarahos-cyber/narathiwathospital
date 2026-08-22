import { hasSupabaseCredentials, supabaseConfig } from '../config/supabase.js';
import { metrics, cases, alerts } from '../data/dashboard-data.js';

export async function getDashboardData() {
  if (!hasSupabaseCredentials) return { metrics, cases, alerts, source: 'demo' };
  // Add @supabase/supabase-js to your build and query disease_cases here.
  console.info(`Supabase configured for ${supabaseConfig.url}`);
  return { metrics, cases, alerts, source: 'demo' };
}
