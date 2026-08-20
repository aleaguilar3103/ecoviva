import { supabaseAdmin } from "../_lib/supabase.js";
import { listarCitas } from "../_lib/agenda/db.js";
import { aplicarRecordatorios } from "../_lib/agenda/recordatorios.js";
import { resumenDiario } from "../_lib/agenda/avisos.js";

// /api/cron/agenda — corre una vez al día (11:00 UTC = 5 a.m. de Costa Rica).
//
// Hace cuatro cosas, ninguna sensible a la hora exacta. Eso es a propósito:
// en el plan Hobby de Vercel el cron solo corre una vez al día y con ±59
// minutos de imprecisión. Los recordatorios del cliente NO pasan por acá —
// los entrega Resend al minuto — así que esa imprecisión nunca llega al
// cliente.
//
//   0. Mandar el resumen diario de la agenda por Telegram (avisos.ts), a
//      quien tenga la agenda vinculada. Protegido contra que Vercel repita
//      la corrida con la tabla agenda_jobs (ver primeraVezHoy más abajo).
//      Una vez que sale de verdad, se deja constancia en
//      agenda_jobs.resumen_enviado_at (ver marcarResumenEnviado): una fila
//      con esa columna en null significa que el día quedó reclamado pero el
//      envío nunca se confirmó (falló resumenDiario, o falló el propio
//      registro) — dato consultable en vez de silencio indistinguible de un
//      día normal.
//   1. Purgar agenda_mensajes: borrar el historial de conversación del bot
//      de más de 24 horas. Esa tabla guarda el texto crudo de lo que Alina
//      y Alejandro le escriben al bot — nombres, teléfonos y correos de
//      clientes de paso — para darle contexto de corto plazo al agente
//      (telegram/webhook.ts solo usa la última hora). Pasado un día nadie
//      la vuelve a leer: no hay motivo para retener esos datos de clientes
//      más tiempo del que hace falta.
//   2. Reconciliar: citas de las próximas 48h a las que les falte algún
//      recordatorio programado. Cubre los fallos transitorios de Resend y las
//      citas agendadas a más de 30 días, que recién ahora entran en ventana.
//   3. Marcar como completada lo que ya pasó, para que la vista no se llene.
//
// Los pasos 0 y 1 son cada uno comodidad/limpieza, no pueden frenar el paso
// 2: cada uno corre envuelto en su PROPIO try/catch (uno no debe tumbar al
// otro tampoco), mismo criterio que el resto de esta función usa para
// cualquier aviso posterior a un guardado (ver operaciones.ts). La
// reconciliación es lo que hace que a los clientes les lleguen los
// recordatorios — eso sí importa que no se salte.

const TZ = "America/Costa_Rica";

// Clave del día calendario en Costa Rica (no en UTC — a las 11:00 UTC que
// corre este cron ya es tarde en CR, pero cerca de la medianoche UTC el día
// calendario de CR y el de UTC pueden diferir). `en-CA` da directo el
// formato "YYYY-MM-DD" que pide la columna `fecha` (date) de agenda_jobs.
function claveDiaCR(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ahora);
}

// Gate de una sola vez al día. `fecha` es la primary key de agenda_jobs, así
// que un segundo intento de insertar la misma fecha choca contra esa
// restricción (código 23505 de Postgres) — es el mismo "insert con on
// conflict do nothing" que pide el spec, sin necesitar `.upsert()`: mismo
// patrón que ya usa telegram/webhook.ts para el choque de un
// telegram_chat_id repetido.
//
// El insert SOLO escribe `fecha` — nunca `resumen_enviado_at` acá: en este
// momento el resumen todavía no se mandó, escribir ya esa columna sería
// mentir. Se completa después, con marcarResumenEnviado, una vez que
// resumenDiario terminó bien de verdad (ver el handler más abajo).
//
// Si el insert prospera, esta es la primera vez que el cron corre hoy: el
// resumen sale. Si choca (23505), ya salió — se saltea sin loguear nada,
// porque no es un error, es lo esperado cuando Vercel repite la corrida. Si
// falla por otra razón, no hay forma de saber si ya salió: se falla
// cerrado (no se manda) antes que arriesgar un duplicado.
async function primeraVezHoy(fecha: string): Promise<boolean> {
  const { error } = await supabaseAdmin().from("agenda_jobs").insert({ fecha });
  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false;
  console.error("cron/agenda: no se pudo verificar si el resumen ya salió hoy", error);
  return false;
}

// Deja constancia de CUÁNDO salió el resumen, sobre la fila que
// primeraVezHoy ya sembró para hoy. Nunca tira (mismo criterio que
// primeraVezHoy y purgarMensajesViejos): si el update falla, se loguea y la
// columna se queda en null — que es un estado legítimo y consultable ("el
// cron reclamó el día pero el envío nunca se confirmó"), no un bug ni un
// motivo para tumbar nada más.
async function marcarResumenEnviado(fecha: string, cuando: Date): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("agenda_jobs")
    .update({ resumen_enviado_at: cuando.toISOString() })
    .eq("fecha", fecha);
  if (error) {
    console.error("cron/agenda: el resumen salió pero no se pudo registrar resumen_enviado_at", error);
  }
}

const RETENCION_MENSAJES_MS = 24 * 60 * 60_000;

// Borra de agenda_mensajes lo más viejo que 24 horas. No es limpieza de
// disco: esa tabla guarda texto crudo con datos de clientes (ver el
// encabezado del archivo) y no tiene ninguna razón funcional para vivir más
// que eso — telegram/webhook.ts (cargarHistorial) solo lee la última hora.
async function purgarMensajesViejos(ahora: Date): Promise<void> {
  const limite = new Date(ahora.getTime() - RETENCION_MENSAJES_MS).toISOString();
  const { error } = await supabaseAdmin().from("agenda_mensajes").delete().lt("created_at", limite);
  if (error) console.error("cron/agenda: no se pudo purgar agenda_mensajes", error);
}

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

  // ── 0. Resumen diario ──
  // Envuelto aparte, ANTES del try/catch de la reconciliación: un fallo acá
  // (el gate de agenda_jobs, o el propio resumenDiario, que en teoría ya
  // nunca tira) no puede impedir que el paso 1 de abajo corra. Ver el
  // porqué completo en el encabezado del archivo.
  try {
    const fechaHoy = claveDiaCR(ahora);
    if (await primeraVezHoy(fechaHoy)) {
      await resumenDiario(ahora);
      // Recién acá es cierto que el resumen salió — por eso el timestamp
      // se escribe después de que termina bien, nunca en el insert del
      // gate de arriba.
      await marcarResumenEnviado(fechaHoy, new Date());
    }
  } catch (e) {
    console.error("cron/agenda: fallo al mandar el resumen diario", e);
  }

  // ── 1. Purga de agenda_mensajes ──
  // Envuelta aparte, en su propio try/catch: independiente del resumen de
  // arriba (uno no debe tumbar al otro) y, sobre todo, no puede frenar la
  // reconciliación de abajo.
  try {
    await purgarMensajesViejos(ahora);
  } catch (e) {
    console.error("cron/agenda: fallo al purgar agenda_mensajes", e);
  }

  try {
    // ── 2. Reconciliar ──
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

    // ── 3. Housekeeping ──
    const { data: completadas, error } = await supabaseAdmin()
      .from("citas")
      .update({ estado: "completada" })
      .eq("estado", "agendada")
      .lt("inicio", ahora.toISOString())
      .select("id");

    if (error) {
      console.error("cron/agenda: no se pudo cerrar las citas pasadas", error);
      // M-c: antes esto seguía respondiendo 200 con completadas:0,
      // indistinguible de "no había nada que cerrar". Este es el único
      // mecanismo automático de la rama — que dé verde estando roto es
      // justo lo que deja un fallo pasar meses sin que nadie lo note. 207
      // (Multi-Status) porque la reconciliación de arriba SÍ corrió (lo que
      // le llega al cliente no depende de este housekeeping): es un fallo
      // parcial, no total.
      return res.status(207).json({
        reconciliadas: pendientes.length,
        completadas: 0,
        error: "No se pudieron cerrar las citas pasadas",
      });
    }

    return res.status(200).json({
      reconciliadas: pendientes.length,
      completadas: completadas?.length ?? 0,
    });
  } catch (e) {
    console.error("cron/agenda: error inesperado", e);
    return res.status(500).json({ error: "Error inesperado" });
  }
}
