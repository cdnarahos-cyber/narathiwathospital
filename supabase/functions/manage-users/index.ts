import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cdnarahos-cyber.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const validRoles = new Set(["admin", "officer", "viewer"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

const requireAdmin = async (request: Request) => {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}")).find(Boolean);
  if (!url || !publishableKey || !token) return null;
  const client = createClient(url, String(publishableKey), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user || user.app_metadata?.ndss_role !== "admin") return null;
  return user;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const requester = await requireAdmin(request);
  if (!requester) return json({ error: "forbidden" }, 403);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !serviceRoleKey) return json({ error: "server_configuration_error" }, 500);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "list") {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return json({ error: "list_failed" }, 500);
    return json({ users: data.users.map(user => ({
      id: user.id,
      email: user.email || "",
      role: user.app_metadata?.ndss_role || "",
      requestedRole: user.user_metadata?.requested_ndss_role || "",
      bannedUntil: user.banned_until || "",
      lastSignInAt: user.last_sign_in_at || "",
      createdAt: user.created_at,
    })) });
  }

  const userId = String(body.userId || "");
  if (!userId) return json({ error: "invalid_user" }, 400);
  if (userId === requester.id && (action === "suspend" || action === "delete")) return json({ error: "cannot_change_own_access" }, 400);

  if (action === "approve") {
    const role = String(body.role || "").toLowerCase();
    if (!validRoles.has(role)) return json({ error: "invalid_role" }, 400);
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    if (targetError || !target.user) return json({ error: "user_not_found" }, 404);
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...target.user.app_metadata, ndss_role: role },
      user_metadata: { ...target.user.user_metadata, requested_ndss_role: null },
    });
    if (error) return json({ error: "update_failed" }, 500);
    return json({ ok: true });
  }
  if (action === "suspend" || action === "resume") {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: action === "suspend" ? "876000h" : "none" });
    if (error) return json({ error: "status_update_failed" }, 500);
    return json({ ok: true });
  }
  if (action === "delete") {
    const { error } = await admin.auth.admin.deleteUser(userId, false);
    if (error) return json({ error: "delete_failed" }, 500);
    return json({ ok: true });
  }
  return json({ error: "invalid_action" }, 400);
});
