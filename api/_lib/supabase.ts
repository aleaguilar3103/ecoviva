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

function bearerToken(req: { headers: Record<string, unknown> }): string | null {
  const auth = (req.headers["authorization"] || req.headers["Authorization"]) as
    | string
    | undefined;
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

// Correos siempre permitidos en el panel, además de los que traiga ADMIN_EMAILS.
const BASE_ADMINS = ["aguilartradesfx@gmail.com", "gerencia@duphomes.com"];

// Lista blanca de correos con acceso al panel: base + env ADMIN_EMAILS (coma-separada).
function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BASE_ADMINS, ...fromEnv]));
}

// Verifica acceso de administrador. Acepta:
//   1) Un Bearer token que sea igual a ADMIN_API_TOKEN (uso servidor-a-servidor), o
//   2) Un JWT de Supabase Auth de un usuario cuyo correo esté en la lista blanca.
// Devuelve el correo del admin (o "service" para el token), o null si no autorizado.
export async function requireAdmin(req: {
  headers: Record<string, unknown>;
}): Promise<string | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const serviceToken = process.env.ADMIN_API_TOKEN;
  if (serviceToken && token === serviceToken) return "service";

  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    const email = data?.user?.email?.toLowerCase();
    if (error || !email) return null;
    return adminEmails().includes(email) ? email : null;
  } catch {
    return null;
  }
}
