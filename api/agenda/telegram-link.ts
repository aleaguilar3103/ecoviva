import { requireAgenda, supabaseAdmin } from "../_lib/supabase.js";
import { randomInt } from "node:crypto";

// /api/agenda/telegram-link — vinculación de la cuenta del panel con Telegram.
//   GET    → genera (o reemplaza) el código de un solo uso para /vincular.
//   DELETE → desvincula: borra el chat_id guardado y cualquier código pendiente.
//
// El código en sí no sirve de nada sin decir a quién mandárselo, así que la
// mitad de este endpoint es de datos (guardar el código) y la otra mitad es
// instrucción en el panel (ver AgendaManager.tsx): a qué bot escribirle y con
// qué comando. El "/vincular <codigo>" lo procesa el bot en la Task 3 — acá
// solo se genera y se guarda el código, nunca se manda por Telegram.

// 10 minutos de vigencia: es un código de un solo uso que da acceso a la
// agenda completa, así que la ventana de robo tiene que ser corta.
const VIGENCIA_MS = 10 * 60_000;

// crypto.randomInt (no Math.random): el código habilita acceso a la agenda
// de dos personas, así que tiene que salir de un generador criptográfico.
function generarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  // El permiso se revalida en el servidor siempre, antes de leer nada del request.
  const caller = await requireAgenda(req);
  if (!caller || !caller.userId) return res.status(401).json({ error: "No autorizado" });

  const db = supabaseAdmin();

  try {
    if (req.method === "GET") {
      const { data, error } = await db
        .from("app_users")
        .select("telegram_chat_id")
        .eq("user_id", caller.userId)
        .maybeSingle();
      if (error) {
        console.error("agenda/telegram-link: no se pudo leer el estado", error);
        return res.status(500).json({ error: "No se pudo generar el código." });
      }

      // Un GET nuevo reemplaza el código anterior — no se acumulan códigos
      // vivos, así que uno que se filtró queda inútil apenas se pide otro.
      const codigo = generarCodigo();
      const expira = new Date(Date.now() + VIGENCIA_MS);
      const { error: errorUpdate } = await db
        .from("app_users")
        .update({ telegram_codigo: codigo, telegram_codigo_expira: expira.toISOString() })
        .eq("user_id", caller.userId);
      if (errorUpdate) {
        console.error("agenda/telegram-link: no se pudo guardar el código", errorUpdate);
        return res.status(500).json({ error: "No se pudo generar el código." });
      }

      return res.status(200).json({
        codigo,
        expira: expira.toISOString(),
        vinculado: Boolean(data?.telegram_chat_id),
      });
    }

    if (req.method === "DELETE") {
      const { error } = await db
        .from("app_users")
        .update({ telegram_chat_id: null, telegram_codigo: null, telegram_codigo_expira: null })
        .eq("user_id", caller.userId);
      if (error) {
        console.error("agenda/telegram-link: no se pudo desvincular", error);
        return res.status(500).json({ error: "No se pudo desvincular la cuenta." });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error("agenda/telegram-link error", e);
    return res.status(500).json({ error: "Error inesperado" });
  }
}
