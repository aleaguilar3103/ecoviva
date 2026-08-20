import { requireUser, supabaseAdmin } from "./_lib/supabase.js";

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
  let agenda = false;
  if (caller.userId) {
    const { data, error } = await supabaseAdmin()
      .from("app_users")
      .select("agenda")
      .eq("user_id", caller.userId)
      .maybeSingle();
    // M-d: esta es la tercera copia de esta misma consulta (junto a
    // requireAgenda y agenda/feed.ts) y la única que se quedaba muda ante un
    // error. Sigue fallando cerrado (agenda queda en false), pero sin este
    // log el síntoma es "me desapareció la pestaña Agenda" sin nada que
    // mirar para diagnosticarlo.
    if (error) console.error("me: fallo al consultar la bandera agenda", error);
    agenda = data?.agenda === true;
  }

  return res.status(200).json({ email: caller.email, role: caller.role, agenda });
}
