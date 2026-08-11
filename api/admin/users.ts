import { supabaseAdmin, requireUser } from "../_lib/supabase.js";

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

// Nunca se expone al cliente el texto crudo de Postgres/GoTrue (puede filtrar
// detalles internos, y en el caso del recover, hasta el cuerpo JSON completo de
// la respuesta). Se loguea para diagnóstico en Vercel y se devuelve un mensaje
// genérico en español.
function logYGenerico(contexto: string, detalle: unknown, generico: string): string {
  console.error(`admin/users: ${contexto}`, detalle);
  return generico;
}

// Son un puñado de usuarios: traerlos todos y filtrar en memoria es más simple
// que paginar, y la API de admin no filtra por correo.
async function buscarEnAuthPorCorreo(email: string) {
  const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  return { usuario: data?.users.find((u) => u.email?.toLowerCase() === email) ?? null, error };
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
  // GoTrue limita reenvíos seguidos: es el caso más común y merece su propio
  // mensaje en vez de caer en el genérico de abajo.
  if (r.status === 429) return "Esperá un momento antes de reenviar el acceso a esa persona.";
  return logYGenerico(
    "recover",
    { status: r.status, body: (await r.text()).slice(0, 500) },
    "No se pudo enviar el correo. Probá de nuevo en un momento.",
  );
}

async function listar() {
  const db = supabaseAdmin();
  const { data: filas, error } = await db
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(logYGenerico("listar/app_users", error, "No se pudo obtener la lista de usuarios."));

  // "Pendiente de activar" no se guarda: se deriva de si la persona entró alguna vez.
  const { data: auth, error: errorAuth } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  // Si esto falla no hay forma de armar "último ingreso": mejor un 500 explícito
  // que devolver 200 con todo el equipo marcado como "Pendiente" en silencio.
  if (errorAuth) {
    throw new Error(
      logYGenerico("listar/auth.listUsers", errorAuth, "No se pudo obtener el último ingreso de los usuarios."),
    );
  }

  const ultimoIngreso = new Map((auth?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));

  return (filas ?? []).map((f) => ({
    ...f,
    last_sign_in_at: ultimoIngreso.get(f.user_id) ?? null,
  }));
}

// Impide dejarse a uno mismo sin acceso y quedarse sin ningún admin.
// `callerUserId` identifica a quien pide el cambio por id, no por email: el
// email de app_users puede quedar desactualizado si alguien lo cambia desde el
// dashboard de Supabase, y comparar por correo dejaría de detectar "soy yo".
// `cambio` es "delete" o el objeto de updates que se va a aplicar.
export async function revisarGuardas(
  targetUserId: string,
  callerUserId: string | null,
  cambio: "delete" | { role?: string; status?: string },
): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: objetivo } = await db
    .from("app_users")
    .select("role, status")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!objetivo) return "Ese usuario no existe";

  // callerUserId es null para el token de servicio (servidor a servidor): ese
  // caller nunca es "el mismo usuario" que el objetivo.
  const esUnoMismo = callerUserId !== null && targetUserId === callerUserId;
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

  const caller = await requireUser(req);
  if (!caller || caller.role !== "admin") return res.status(401).json({ error: "No autorizado" });
  const admin = caller.email; // sigue sirviendo para invited_by
  const callerUserId = caller.userId; // null para el token servidor-a-servidor

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      return res.status(200).json({ users: await listar() });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (req.method === "POST") {
      const email = normalizarCorreo(body.email);
      if (!email) return res.status(400).json({ error: "Correo inválido" });

      // Un role presente pero inválido (p. ej. "superadmin") no se trata como
      // "no pedido": eso escondería un bug de cliente detrás de un 200 falso.
      if (body.role !== undefined && body.role !== "admin" && body.role !== "vendedor") {
        return res.status(400).json({ error: "El rol debe ser 'admin' o 'vendedor'" });
      }
      // Un POST sin `role` NO debe cambiar el rol de alguien que ya existe:
      // "Reenviar acceso" manda el mismo cuerpo que "Invitar", y asumir
      // 'vendedor' degradaría al destinatario. Con un solo admin activo eso
      // deja el sistema sin ninguno.
      const rolPedido: Rol | null = body.role === "admin" || body.role === "vendedor" ? body.role : null;
      const nombre = typeof body.full_name === "string" ? body.full_name.trim() || null : null;

      const { data: invitado, error: errorInvitacion } = await db.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: DESTINO, data: nombre ? { full_name: nombre } : undefined },
      );

      if (errorInvitacion) {
        // El caso normal de fallo es que el correo ya esté registrado. Si es así
        // se le reenvía el acceso en vez de tratarlo como error.
        //
        // Orden importante de acá en adelante: primero se resuelven todas las
        // guardas (deshabilitado, cambio de rol que dejaría sin admins) y
        // recién si todo pasa se manda el correo. Mandarlo antes y recién
        // después devolver 400 le pone al destinatario una alarma de "creá tu
        // contraseña" por una operación que terminó rechazada, y deja basura
        // en el registro de envíos de GoTrue.
        const { usuario: existente, error: errorBusqueda } = await buscarEnAuthPorCorreo(email);
        if (errorBusqueda) {
          return res.status(502).json({
            error: logYGenerico(
              "buscarEnAuthPorCorreo",
              errorBusqueda,
              "No se pudo verificar si el correo ya existe. Probá de nuevo en un momento.",
            ),
          });
        }
        if (!existente) {
          return res.status(502).json({
            error: logYGenerico("inviteUserByEmail", errorInvitacion, "No se pudo invitar a esa persona."),
          });
        }

        const { data: filaExistente } = await db
          .from("app_users")
          .select("*")
          .eq("user_id", existente.id)
          .maybeSingle();
        if (filaExistente?.status === "disabled") {
          return res
            .status(400)
            .json({ error: "Ese usuario está deshabilitado. Habilitalo antes de reenviarle el acceso." });
        }

        // Solo hay guarda que evaluar si hay una fila existente cuyo rol
        // realmente cambiaría: si no hay fila (dato viejo/migración manual) no
        // hay ningún admin que degradar, se la crea de cero más abajo.
        const rolCambia = Boolean(filaExistente) && rolPedido !== null && rolPedido !== filaExistente?.role;
        if (rolCambia) {
          const problema = await revisarGuardas(existente.id, callerUserId, { role: rolPedido as Rol });
          if (problema) return res.status(400).json({ error: problema });
        }

        const errorEnvio = await enviarCorreoDeAcceso(email);
        if (errorEnvio) return res.status(502).json({ error: errorEnvio });

        // Insert o update explícito, no upsert: un upsert le devolvería el valor
        // por defecto a status y pisaría created_at.
        let fila: unknown;
        if (!filaExistente) {
          const { data, error } = await db
            .from("app_users")
            .insert({
              user_id: existente.id,
              email,
              full_name: nombre,
              role: rolPedido ?? "vendedor",
              invited_by: admin,
            })
            .select()
            .single();
          if (error) {
            return res.status(500).json({
              error: logYGenerico("app_users insert (POST reenvío)", error, "No se pudo guardar el usuario."),
            });
          }
          fila = data;
        } else {
          // Solo se tocan los campos que realmente cambian: un `role` ausente
          // o sin cambio real no debe pisar el rol actual (ver rolPedido).
          const cambios: { role?: Rol; full_name?: string | null } = {};
          if (rolCambia) cambios.role = rolPedido as Rol;
          if (nombre !== null) cambios.full_name = nombre;

          if (Object.keys(cambios).length === 0) {
            fila = filaExistente;
          } else {
            const { data, error } = await db
              .from("app_users")
              .update(cambios)
              .eq("user_id", existente.id)
              .select()
              .single();
            if (error) {
              return res
                .status(500)
                .json({ error: logYGenerico("app_users update (POST)", error, "No se pudo guardar el usuario.") });
            }
            fila = data;
          }
        }

        // Se devuelve la fila tal cual, sin last_sign_in_at: ese dato solo lo
        // arma listar(). El panel recarga la lista después de invitar.
        return res.status(200).json({ user: fila, resent: true });
      }

      // inviteUserByEmail tuvo éxito: alta de un usuario nuevo.
      const userId = invitado.user.id;
      const { data: filaNueva, error: errorInsercion } = await db
        .from("app_users")
        .insert({ user_id: userId, email, full_name: nombre, role: rolPedido ?? "vendedor", invited_by: admin })
        .select()
        .single();
      if (errorInsercion) {
        // La cuenta de auth ya se creó (y el correo de invitación ya salió) en
        // esta misma petición. Si la fila no se puede guardar, deshacemos la
        // cuenta para no dejar un usuario "fantasma" con privilegios y sin
        // fila que lo controle (no aparece en GET, DELETE lo rechaza, y si su
        // correo está en BASE_ADMINS entraría como admin por el fallback).
        await db.auth.admin.deleteUser(userId);
        return res.status(500).json({
          error: logYGenerico("app_users insert (POST)", errorInsercion, "No se pudo guardar el usuario."),
        });
      }

      return res.status(200).json({ user: filaNueva, resent: false });
    }

    if (req.method === "PATCH") {
      const userId = typeof body.user_id === "string" ? body.user_id : null;
      if (!userId) return res.status(400).json({ error: "Falta user_id" });

      // Un role/status presente pero inválido no se ignora en silencio: eso
      // escondería un bug de cliente detrás de un cambio parcial inesperado.
      if (body.role !== undefined && body.role !== "admin" && body.role !== "vendedor") {
        return res.status(400).json({ error: "El rol debe ser 'admin' o 'vendedor'" });
      }
      if (body.status !== undefined && body.status !== "active" && body.status !== "disabled") {
        return res.status(400).json({ error: "El estado debe ser 'active' o 'disabled'" });
      }

      const cambios: { role?: Rol; status?: "active" | "disabled" } = {};
      if (body.role === "admin" || body.role === "vendedor") cambios.role = body.role;
      if (body.status === "active" || body.status === "disabled") cambios.status = body.status;
      if (!Object.keys(cambios).length) return res.status(400).json({ error: "Nada que cambiar" });

      const problema = await revisarGuardas(userId, callerUserId, cambios);
      if (problema) return res.status(400).json({ error: problema });

      const { data: fila, error } = await db
        .from("app_users")
        .update(cambios)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) {
        return res
          .status(500)
          .json({ error: logYGenerico("app_users update (PATCH)", error, "No se pudo actualizar el usuario.") });
      }

      return res.status(200).json({ user: fila });
    }

    if (req.method === "DELETE") {
      const userId = typeof body.user_id === "string" ? body.user_id : null;
      if (!userId) return res.status(400).json({ error: "Falta user_id" });

      const problema = await revisarGuardas(userId, callerUserId, "delete");
      if (problema) return res.status(400).json({ error: problema });

      // Borrar de auth.users arrastra la fila de app_users por ON DELETE CASCADE.
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) {
        return res
          .status(500)
          .json({ error: logYGenerico("auth.admin.deleteUser", error, "No se pudo eliminar el usuario.") });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("admin/users error", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error inesperado" });
  }
}
