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

export type AppRole = "admin" | "vendedor";

export interface Caller {
  email: string;
  userId: string | null;
  role: AppRole;
}

// Red de seguridad: estos correos entran como admin aunque app_users esté vacía
// o mal poblada. Evita quedar encerrado fuera del panel por un error de datos.
const BASE_ADMINS = ["aguilartradesfx@gmail.com", "gerencia@duphomes.com"];

// Identifica a quien hace la petición. Acepta:
//   1) Bearer igual a ADMIN_API_TOKEN → admin de servicio (servidor a servidor).
//   2) Un JWT de Supabase Auth cuyo usuario tenga fila activa en app_users.
// Devuelve null si no hay token, si el JWT no valida, si no hay fila o si la
// cuenta está deshabilitada.
export async function requireUser(req: {
  headers: Record<string, unknown>;
}): Promise<Caller | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const serviceToken = process.env.ADMIN_API_TOKEN;
  if (serviceToken && token === serviceToken) {
    return { email: "service", userId: null, role: "admin" };
  }

  try {
    const db = supabaseAdmin();
    const { data, error } = await db.auth.getUser(token);
    const user = data?.user;
    const email = user?.email?.toLowerCase();
    if (error || !user || !email) return null;

    const { data: row } = await db
      .from("app_users")
      .select("role, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (row) {
      if (row.status !== "active") return null;
      return { email, userId: user.id, role: row.role as AppRole };
    }

    // Sin fila: solo pasa por la red de seguridad.
    if (BASE_ADMINS.includes(email)) {
      return { email, userId: user.id, role: "admin" };
    }
    return null;
  } catch {
    return null;
  }
}

// Igual que requireUser pero exige rol admin. Conserva la firma anterior
// (correo o null) para no tocar los endpoints que ya la usan.
export async function requireAdmin(req: {
  headers: Record<string, unknown>;
}): Promise<string | null> {
  const caller = await requireUser(req);
  return caller && caller.role === "admin" ? caller.email : null;
}
