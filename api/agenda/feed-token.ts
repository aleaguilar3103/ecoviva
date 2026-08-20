import { requireAgenda, supabaseAdmin } from "../_lib/supabase.js";
import { randomUUID } from "node:crypto";

// /api/agenda/feed-token — la URL de suscripción del calendario, por persona.
//   GET  → devuelve la URL del feed, creando el token la primera vez.
//   POST → rota el token: genera uno nuevo, así que la URL vieja deja de
//          servir de inmediato (ver api/agenda/feed.ts).
//
// El token ES la credencial de ese feed: no hay sesión posible en una
// suscripción de calendario, así que quien tenga el enlace ve la agenda.

function urlDelFeed(token: string): string {
  const sitio = process.env.PUBLIC_SITE_URL || "https://www.ecovivadesarrollos.com";
  return `${sitio}/api/agenda/feed?token=${token}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  // El permiso se revalida en el servidor siempre, antes de leer nada del body.
  const caller = await requireAgenda(req);
  if (!caller || !caller.userId) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      const { data, error } = await db
        .from("app_users")
        .select("feed_token")
        .eq("user_id", caller.userId)
        .maybeSingle();
      if (error) {
        console.error("agenda/feed-token: no se pudo leer el token", error);
        return res.status(500).json({ error: "No se pudo obtener la URL del feed." });
      }

      let token = data?.feed_token as string | null;
      if (!token) {
        token = randomUUID();
        const { error: errorUpdate } = await db
          .from("app_users")
          .update({ feed_token: token })
          .eq("user_id", caller.userId);
        if (errorUpdate) {
          console.error("agenda/feed-token: no se pudo crear el token", errorUpdate);
          return res.status(500).json({ error: "No se pudo generar la URL del feed." });
        }
      }
      return res.status(200).json({ url: urlDelFeed(token) });
    }

    if (req.method === "POST") {
      // Rotar no necesita leer el token viejo: se genera uno nuevo directo y
      // se pisa. El viejo deja de matchear en feed.ts de inmediato.
      const token = randomUUID();
      const { error } = await db
        .from("app_users")
        .update({ feed_token: token })
        .eq("user_id", caller.userId);
      if (error) {
        console.error("agenda/feed-token: no se pudo rotar el token", error);
        return res.status(500).json({ error: "No se pudo generar la URL nueva." });
      }
      return res.status(200).json({ url: urlDelFeed(token) });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("agenda/feed-token error", e);
    return res.status(500).json({ error: "Error inesperado" });
  }
}
