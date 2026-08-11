import { requireUser } from "./_lib/supabase.js";
import { GUIA_VENDEDORES_B64 } from "./_content/guia-vendedores.js";

// /api/guia-vendedores — GET. Devuelve el HTML de la guía de venta.
// Cualquier usuario activo, admin o vendedor.
//
// El HTML no vive en public/ justamente por esto: ahí Vercel lo publicaría como
// estático y cualquiera con la URL lo bajaría sin pasar por el login.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const caller = await requireUser(req);
  if (!caller) return res.status(401).json({ error: "No autorizado" });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(Buffer.from(GUIA_VENDEDORES_B64, "base64").toString("utf8"));
}
