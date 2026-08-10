import { supabaseAdmin, requireAdmin } from "../_lib/supabase.js";

// /api/admin/users — alta y administración de usuarios del panel. Solo admin.
//   GET     → { users }  lista con "último ingreso" sacado de auth.users
//   POST    { email, full_name?, role? }  → invita (o reenvía el acceso)
//   PATCH   { user_id, role?, status? }   → cambia rol o habilita/deshabilita
//   DELETE  { user_id }                   → borra de auth.users (la fila cae en cascada)

type Rol = "admin" | "vendedor";

// No se deriva del header Origin: alguien con un JWT válido podría apuntar el
// enlace de invitación a un dominio suyo y quedarse con el token.
const SITIO = process.env.PUBLIC_SITE_URL || "https://ecovivadesarrollos.com";
const DESTINO = `${SITIO}/crear-contrasena`;

function normalizarCorreo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// Son un puñado de usuarios: traerlos todos y filtrar en memoria es más simple
// que paginar, y la API de admin no filtra por correo.
async function buscarEnAuthPorCorreo(email: string) {
  const { data } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

// Manda el correo de "creá tu contraseña" a alguien que ya existe en auth.users.
// No se usa generateLink() porque devuelve el enlace pero no envía nada; el
// endpoint /recover de GoTrue sí dispara el correo por el SMTP configurado.
async function enviarCorreoDeAcceso(email: string): Promise<string | null> {
  const url = `${process.env.SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(DESTINO)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    },
    body: JSON.stringify({ email }),
  });
  if (r.ok) return null;
  return `No se pudo enviar el correo (${r.status}): ${(await r.text()).slice(0, 200)}`;
}

async function listar() {
  const db = supabaseAdmin();
  const { data: filas, error } = await db
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  // "Pendiente de activar" no se guarda: se deriva de si la persona entró alguna vez.
  const { data: auth } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const ultimoIngreso = new Map((auth?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));

  return (filas ?? []).map((f) => ({
    ...f,
    last_sign_in_at: ultimoIngreso.get(f.user_id) ?? null,
  }));
}

// Impide dejarse a uno mismo sin acceso y quedarse sin ningún admin.
// `cambio` es "delete" o el objeto de updates que se va a aplicar.
async function revisarGuardas(
  targetUserId: string,
  correoDeQuienPide: string,
  cambio: "delete" | { role?: string; status?: string },
): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: objetivo } = await db
    .from("app_users")
    .select("email, role, status")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!objetivo) return "Ese usuario no existe";

  const esUnoMismo = objetivo.email === correoDeQuienPide;
  const pierdeAdmin =
    cambio === "delete" || cambio.role === "vendedor" || cambio.status === "disabled";

  if (esUnoMismo && pierdeAdmin) return "No podés quitarte tu propio acceso";

  if (pierdeAdmin && objetivo.role === "admin" && objetivo.status === "active") {
    const { count } = await db
      .from("app_users")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");
    if ((count ?? 0) <= 1) return "Tiene que quedar al menos un admin activo";
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  const admin = await requireAdmin(req);
  if (!admin) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      return res.status(200).json({ users: await listar() });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (req.method === "POST") {
      const email = normalizarCorreo(body.email);
      if (!email) return res.status(400).json({ error: "Correo inválido" });

      const rol: Rol = body.role === "admin" ? "admin" : "vendedor";
      const nombre =
        typeof body.full_name === "string" ? body.full_name.trim() || null : null;

      let userId: string;
      let reenviado = false;

      const { data: invitado, error: errorInvitacion } = await db.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: DESTINO, data: nombre ? { full_name: nombre } : undefined },
      );

      if (errorInvitacion) {
        // El caso normal de fallo es que el correo ya esté registrado. Si es así
        // se le reenvía el acceso en vez de tratarlo como error.
        const existente = await buscarEnAuthPorCorreo(email);
        if (!existente) {
          return res.status(502).json({ error: `No se pudo invitar: ${errorInvitacion.message}` });
        }

        const { data: filaPrevia } = await db
          .from("app_users")
          .select("status")
          .eq("user_id", existente.id)
          .maybeSingle();
        if (filaPrevia?.status === "disabled") {
          return res
            .status(400)
            .json({ error: "Ese usuario está deshabilitado. Habilitalo antes de reenviarle el acceso." });
        }

        const errorEnvio = await enviarCorreoDeAcceso(email);
        if (errorEnvio) return res.status(502).json({ error: errorEnvio });

        userId = existente.id;
        reenviado = true;
      } else {
        userId = invitado.user.id;
      }

      // Insert o update explícito, no upsert: un upsert le devolvería el valor por
      // defecto a status y pisaría created_at.
      const { data: filaExistente } = await db
        .from("app_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      const escritura = filaExistente
        ? db.from("app_users").update({ role: rol, full_name: nombre }).eq("user_id", userId)
        : db
            .from("app_users")
            .insert({ user_id: userId, email, full_name: nombre, role: rol, invited_by: admin });

      const { data: fila, error: errorEscritura } = await escritura.select().single();
      if (errorEscritura) return res.status(500).json({ error: errorEscritura.message });

      // Se devuelve la fila tal cual, sin last_sign_in_at: ese dato solo lo arma
      // listar(). El panel recarga la lista después de invitar.
      return res.status(200).json({ user: fila, resent: reenviado });
    }

    if (req.method === "PATCH") {
      const userId = typeof body.user_id === "string" ? body.user_id : null;
      if (!userId) return res.status(400).json({ error: "Falta user_id" });

      const cambios: { role?: Rol; status?: "active" | "disabled" } = {};
      if (body.role === "admin" || body.role === "vendedor") cambios.role = body.role;
      if (body.status === "active" || body.status === "disabled") cambios.status = body.status;
      if (!Object.keys(cambios).length) return res.status(400).json({ error: "Nada que cambiar" });

      const problema = await revisarGuardas(userId, admin, cambios);
      if (problema) return res.status(400).json({ error: problema });

      const { data: fila, error } = await db
        .from("app_users")
        .update(cambios)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ user: fila });
    }

    if (req.method === "DELETE") {
      const userId = typeof body.user_id === "string" ? body.user_id : null;
      if (!userId) return res.status(400).json({ error: "Falta user_id" });

      const problema = await revisarGuardas(userId, admin, "delete");
      if (problema) return res.status(400).json({ error: problema });

      // Borrar de auth.users arrastra la fila de app_users por ON DELETE CASCADE.
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error inesperado" });
  }
}
