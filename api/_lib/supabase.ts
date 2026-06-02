import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente server-side con service_role (bypassa RLS). Solo para uso en /api.
// Nunca exponer SUPABASE_SERVICE_ROLE_KEY al cliente.
let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno");
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// Verifica el token de administración para endpoints protegidos.
export function isAuthorizedAdmin(req: { headers: Record<string, unknown> }): boolean {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;
  const auth = (req.headers["authorization"] || req.headers["Authorization"]) as
    | string
    | undefined;
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === expected;
}
