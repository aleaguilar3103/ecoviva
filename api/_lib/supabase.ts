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

// Break-glass: estos dos correos son siempre admin, exista o no su fila en
// app_users y sin importar su status o role ahí. Es a propósito imposible
// dejarlos afuera desde el panel — es la garantía de que nadie queda
// encerrado fuera del panel por un error de datos o un clic accidental.
const BASE_ADMINS = ["aguilartradesfx@gmail.com", "gerencia@duphomes.com"];

// Identifica a quien hace la petición. Acepta:
//   1) Bearer igual a ADMIN_API_TOKEN → admin de servicio (servidor a servidor).
//   2) Un JWT de Supabase Auth cuyo correo esté en BASE_ADMINS → admin siempre.
//   3) Un JWT de Supabase Auth cuyo usuario tenga fila activa en app_users.
// Devuelve null si no hay token, si el JWT no valida, si no hay fila (y el
// correo no es BASE_ADMIN) o si la cuenta está deshabilitada.
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

    // Break-glass primero: si el correo está en la lista, es admin sin
    // importar qué diga (o deje de decir) app_users. Antes esto solo se
    // consultaba cuando no había fila, lo cual no protegía a un BASE_ADMIN
    // con fila deshabilitada o con rol corrupto, y de paso abría un camino
    // para que cualquier usuario de auth.users sin fila entrara como admin.
    if (BASE_ADMINS.includes(email)) {
      return { email, userId: user.id, role: "admin" };
    }

    const { data: row, error: rowError } = await db
      .from("app_users")
      .select("role, status")
      .eq("user_id", user.id)
      .maybeSingle();

    // Sin esto, un fallo transitorio de la consulta se ve idéntico a "no
    // tiene fila" y el vendedor recibe un 401 sin que quede rastro en los
    // logs para diagnosticarlo. Se sigue fallando cerrado a propósito.
    if (rowError) {
      console.error("requireUser: fallo al consultar app_users", rowError);
    }

    if (!row || row.status !== "active") return null;
    return { email, userId: user.id, role: row.role as AppRole };
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

// Igual que requireAdmin pero exige además la bandera `agenda` de app_users.
//
// La bandera se consulta SIEMPRE por user_id, aunque requireUser ya haya
// resuelto el rol. No es redundante: para los correos de BASE_ADMINS,
// requireUser devuelve temprano sin leer app_users, y uno de esos correos es
// justamente el de Alejandro. Confiar en el Caller lo dejaría fuera de su
// propia agenda.
//
// Falla cerrado: si la consulta da error, no hay acceso.
export async function requireAgenda(req: {
  headers: Record<string, unknown>;
}): Promise<Caller | null> {
  const caller = await requireUser(req);
  if (!caller || caller.role !== "admin") return null;

  // El token de servicio (servidor a servidor) no tiene fila ni persona detrás,
  // así que no tiene agenda. Fail closed a propósito.
  if (!caller.userId) return null;

  const { data, error } = await supabaseAdmin()
    .from("app_users")
    .select("agenda")
    .eq("user_id", caller.userId)
    .maybeSingle();

  if (error) {
    console.error("requireAgenda: fallo al consultar la bandera", error);
    return null;
  }
  return data?.agenda === true ? caller : null;
}
