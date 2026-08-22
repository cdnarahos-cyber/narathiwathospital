export const supabaseConfig = {
  url: 'https://eyrplueyhpeiuruelvlq.supabase.co',
  publishableKey: globalThis.NDSS_CONFIG?.supabasePublishableKey || '',
  accessToken: globalThis.NDSS_CONFIG?.accessToken || '',
};

export const hasSupabaseCredentials = Boolean(supabaseConfig.publishableKey);
