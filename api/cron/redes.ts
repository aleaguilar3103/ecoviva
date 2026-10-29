import { supabaseAdmin } from "../_lib/supabase.js";
import { correrCola } from "../_lib/redes/cola.js";
import { instagramConfigurado } from "../_lib/redes/instagram.js";

// /api/cron/redes — publica en Instagram los carruseles del calendario (panel → Redes).
//
// Lo llama pg_cron cada 15 minutos (migración 0013: el plan Hobby de Vercel solo
// permite crons diarios). vercel.json además lo agenda una vez al día como respaldo,
// por si el job de la base se cae. Correrlo de más no publica dos veces: la fila se
// bloquea con un UPDATE condicional (ver api/_lib/redes/cola.ts).
//
// Acepta dos secretos: CRON_SECRET (el que manda Vercel Cron) y REDES_CRON_SECRET
// (el que pg_cron lee de Vault). Sin ninguno configurado, falla cerrado.
function autorizado(auth: string): boolean {
  const validos = [process.env.CRON_SECRET, process.env.REDES_CRON_SECRET].filter(Boolean);
  return validos.some((s) => auth === `Bearer ${s}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (!autorizado((req.headers["authorization"] || "") as string)) {
    return res.status(401).json({ error: "No autorizado" });
  }
  if (!instagramConfigurado()) {
    return res.status(200).json({ ok: false, motivo: "Faltan META_IG_USER_ID o META_ACCESS_TOKEN" });
  }
  try {
    const r = await correrCola(supabaseAdmin(), new Date());
    console.info("[cron redes]", JSON.stringify(r));
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron redes]", e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
