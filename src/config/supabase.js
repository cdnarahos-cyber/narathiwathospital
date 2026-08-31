const SESSION_KEY = 'ndss-supabase-access-token';
const url = 'https://eyrplueyhpeiuruelvlq.supabase.co';

const savedToken = () => {
  try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
};

export const getSupabaseConfig = () => ({
  url,
  publishableKey: globalThis.NDSS_CONFIG?.supabasePublishableKey || '',
  accessToken: savedToken() || globalThis.NDSS_CONFIG?.accessToken || '',
});

export const hasSupabaseCredentials = () => Boolean(getSupabaseConfig().publishableKey);
export const hasSupabaseSession = () => Boolean(getSupabaseConfig().accessToken);

export const getSupabaseRole = () => {
  const token = getSupabaseConfig().accessToken;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(decodeURIComponent(atob(payload).split('').map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
    return claims.app_metadata?.ndss_role || '';
  } catch { return ''; }
};

export const consumeSupabaseSessionFromUrl = () => {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = hash.get('access_token');
  if (!token) return false;
  try { localStorage.setItem(SESSION_KEY, token); } catch { return false; }
  history.replaceState({}, document.title, `${location.pathname}${location.search}`);
  return true;
};

export const requestSupabaseMagicLink = async email => {
  const config = getSupabaseConfig();
  if (!config.publishableKey) throw new Error('ยังไม่ได้กำหนด publishable key');
  const response = await fetch(`${config.url}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: false, options: { emailRedirectTo: `${location.origin}${location.pathname}` } }),
  });
  if (!response.ok) throw new Error(`ส่งลิงก์เข้าสู่ระบบไม่สำเร็จ (${response.status})`);
};

export const clearSupabaseSession = () => {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
};

