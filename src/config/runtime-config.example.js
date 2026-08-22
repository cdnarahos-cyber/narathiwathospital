// Copy this file to runtime-config.js. This file is intentionally ignored by Git.
// Use the project's publishable (or legacy anon) key — never a service_role key.
globalThis.NDSS_CONFIG = {
  supabasePublishableKey: '',
  // A signed-in user's access token is required by the RLS policies in supabase/schema.sql.
  accessToken: '',
};
