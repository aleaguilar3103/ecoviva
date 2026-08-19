import { supabaseAdmin } from "../_lib/supabase.js";
import { listarCitas } from "../_lib/agenda/db.js";
import { aplicarRecordatorios } from "../_lib/agenda/recordatorios.js";

// /api/cron/agenda — corre una vez al día (11:00 UTC = 5 a.m. de Costa Rica).
//
// Hace dos cosas, ninguna sensible a la hora exacta. Eso es a propósito: en el
// plan Hobby de Vercel el cron solo corre una vez al día y con ±59 minutos de
// imprecisión. Los recordatorios del cliente NO pasan por acá — los entrega
// Resend al minuto — así que esa imprecisión nunca llega al cliente.
//
//   1. Reconciliar: citas de las próximas 48h a las que les falte algún
//      recordatorio programado. Cubre los fallos transitorios de Resend y las
//      citas agendadas a más de 30 días, que recién ahora entran en ventana.
//   2. Marcar como completada lo que ya pasó, para que la vista no se llene.
//
// El resumen diario por Telegram (fase 5) NO está acá: se agrega en un plan
// aparte a este mismo cron, cuando exista el bot que lo reciba.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  // Vercel manda este header en los crons. Sin el secreto, la URL sería
  // pública y cualquiera podría dispararla. Falla cerrado: si CRON_SECRET no
  // está definida en el entorno, se rechaza sin importar qué traiga el
  // header — no dejar pasar todo cuando falta la variable es justamente lo
  // que evita el agujero.
  const auth = (req.headers["authorization"] || "") as string;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const ahora = new Date();

  try {
    // ── 1. Reconciliar ──
    const proximas = await listarCitas({
      desde: ahora,
      hasta: new Date(ahora.getTime() + 48 * 60 * 60_000),
    });

    // Idempotente por construcción: solo se toca lo que tiene un id en null,
    // así que correr el cron de más no duplica ni reprograma nada.
    // listarCitas() ya excluye las canceladas por default, pero se repite la
    // condición de estado acá porque es la que sostiene la garantía.
    const pendientes = proximas.filter(
      (c) =>
        c.estado === "agendada" &&
        (c.recordatorio_24h_email_id === null || c.recordatorio_1h_email_id === null),
    );

    for (const cita of pendientes) {
      await aplicarRecordatorios(cita, ahora);
    }

    // ── 2. Housekeeping ──
    const { data: completadas, error } = await supabaseAdmin()
      .from("citas")
      .update({ estado: "completada" })
      .eq("estado", "agendada")
      .lt("inicio", ahora.toISOString())
      .select("id");

    if (error) console.error("cron/agenda: no se pudo cerrar las citas pasadas", error);

    return res.status(200).json({
      reconciliadas: pendientes.length,
      completadas: completadas?.length ?? 0,
    });
  } catch (e) {
    console.error("cron/agenda: error inesperado", e);
    return res.status(500).json({ error: "Error inesperado" });
  }
}
