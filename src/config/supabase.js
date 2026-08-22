export const supabaseConfig = {
  url: 'https://eyrplueyhpeiuruelvlq.supabase.co',
  // Set this from a build-time environment variable in production.
  publishableKey: globalThis.NDSS_SUPABASE_PUBLISHABLE_KEY || '',
};

export const hasSupabaseCredentials = Boolean(supabaseConfig.publishableKey);
