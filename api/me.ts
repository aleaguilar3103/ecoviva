import { requireUser, supabaseAdmin } from "./_lib/supabase.js";
import { ACCESO_AGENDA, COLUMNAS_ACCESO_AGENDA, tieneAccesoAgenda } from "./_lib/agenda/permisos.js";

// /api/me — GET → { email, role, agenda }
// Existe porque el rol no viaja dentro del JWT y dos pantallas lo necesitan
// antes de decidir qué renderizar: AdminApp y la página de crear contraseña.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ error: "No autorizado" });

  // La bandera se consulta aparte y no desde el Caller: requireUser corta
  // temprano para los correos break-glass y nunca lee app_users.
  //
  // N-1: qué significa "tiene agenda" NO se decide acá. Sale de
  // `tieneAccesoAgenda` (api/_lib/agenda/permisos.ts), la única definición de
  // esa regla, que consumen también el panel (requireAgenda), el bot, el feed
  // .ics y los avisos. Antes esto derivaba la bandera a mano
  // (`data?.agenda === true`), que es la quinta copia de una regla que existe
  // una sola vez — y le contestaba `agenda: true` a un vendedor con la bandera
  // puesta, así que el panel le pintaba la pestaña Agenda y cada endpoint de
  // adentro le devolvía 401.
  //
  // Se evalúa en dos mitades por la MISMA razón que requireAgenda (ver el
  // comentario largo ahí): `status` y `role` ya los resolvió requireUser,
  // incluyendo el break-glass de BASE_ADMINS, que pasa por encima de la fila a
  // propósito. Lo que se evalúa contra la fila real es la bandera.
  let agenda = false;
  if (caller.userId) {
    const { data, error } = await supabaseAdmin()
      .from("app_users")
      .select(COLUMNAS_ACCESO_AGENDA)
      .eq("user_id", caller.userId)
      .maybeSingle<{ agenda?: unknown }>();
    // M-d: sin este log, un fallo de la consulta se ve como "me desapareció la
    // pestaña Agenda" y no queda nada que mirar para diagnosticarlo. Sigue
    // fallando cerrado igual (agenda queda en false).
    if (error) console.error("me: fallo al consultar la bandera agenda", error);
    agenda = tieneAccesoAgenda({
      status: ACCESO_AGENDA.status,
      role: caller.role,
      agenda: data?.agenda,
    });
  }

  return res.status(200).json({ email: caller.email, role: caller.role, agenda });
}
