import { requireUser } from "./_lib/supabase.js";

// /api/me — GET → { email, role }
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

  return res.status(200).json({ email: caller.email, role: caller.role });
}
