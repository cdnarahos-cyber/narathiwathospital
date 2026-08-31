const SESSION_KEY = 'ndss-supabase-access-token';
const REFRESH_KEY = 'ndss-supabase-refresh-token';
const url = 'https://eyrplueyhpeiuruelvlq.supabase.co';

const readStorage = key => {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
};
const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
};

export const getSupabaseConfig = () => ({
  url,
  publishableKey: globalThis.NDSS_CONFIG?.supabasePublishableKey || '',
  accessToken: readStorage(SESSION_KEY) || globalThis.NDSS_CONFIG?.accessToken || '',
  refreshToken: readStorage(REFRESH_KEY),
});

export const hasSupabaseCredentials = () => Boolean(getSupabaseConfig().publishableKey);
export const hasSupabaseSession = () => Boolean(getSupabaseConfig().accessToken);

const decodeJwt = token => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(payload).split('').map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
  } catch { return {}; }
};

export const getSupabaseRole = () => String(decodeJwt(getSupabaseConfig().accessToken).app_metadata?.ndss_role || '').toLowerCase();
export const getSupabaseUser = () => decodeJwt(getSupabaseConfig().accessToken);

export const storeSupabaseSession = session => {
  if (!session?.access_token) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');
  writeStorage(SESSION_KEY, session.access_token);
  if (session.refresh_token) writeStorage(REFRESH_KEY, session.refresh_token);
};

const authRequest = async (path, { method = 'POST', body, accessToken } = {}) => {
  const config = getSupabaseConfig();
  if (!config.publishableKey) throw new Error('ยังไม่ได้กำหนด publishable key');
  const response = await fetch(`${config.url}${path}`, {
    method,
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = result?.error_code || result?.code || '';
    const message = String(result?.msg || result?.message || '');
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) throw new Error('บัญชีอยู่ระหว่างรอ ADMIN จัดการสิทธิ์ในระบบ');
    if (code === 'over_email_send_rate_limit' || response.status === 429) throw new Error('ระบบส่งอีเมลถึงขีดจำกัดชั่วคราว กรุณารอประมาณ 1 ชั่วโมงแล้วลองใหม่');
    throw new Error(message || 'ไม่สามารถดำเนินการกับบัญชีได้ในขณะนี้');
  }
  return result;
};

export const signInWithPassword = async ({ email, password }) => {
  const result = await authRequest('/auth/v1/token?grant_type=password', { body: { email, password } });
  storeSupabaseSession(result);
  return result;
};

export const signUpWithPassword = async ({ email, password, requestedRole }) => authRequest('/auth/v1/signup', {
  body: {
    email,
    password,
    data: { requested_ndss_role: requestedRole },
    options: { emailRedirectTo: `${location.origin}${location.pathname}` },
  },
});

export const refreshSupabaseSession = async () => {
  const refreshToken = getSupabaseConfig().refreshToken;
  if (!refreshToken) return null;
  const result = await authRequest('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } });
  storeSupabaseSession(result);
  return result;
};

export const invokeAdminUserManagement = async (action, payload = {}) => {
  const config = getSupabaseConfig();
  if (!config.accessToken) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  const response = await fetch(`${config.url}/functions/v1/manage-users`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'ไม่สามารถจัดการบัญชีได้ในขณะนี้');
  return result;
};

export const consumeSupabaseSessionFromUrl = () => {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = hash.get('access_token');
  if (!token) return false;
  storeSupabaseSession({ access_token: token, refresh_token: hash.get('refresh_token') || '' });
  history.replaceState({}, document.title, `${location.pathname}${location.search}`);
  return true;
};

export const clearSupabaseSession = async () => {
  const config = getSupabaseConfig();
  try {
    if (config.accessToken && config.publishableKey) await authRequest('/auth/v1/logout', { accessToken: config.accessToken });
  } catch { /* Clear local tokens even when the network is unavailable. */ }
  try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* storage unavailable */ }
};

