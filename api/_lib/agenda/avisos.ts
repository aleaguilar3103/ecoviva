// api/_lib/agenda/avisos.ts
//
// Por qué existe este archivo: Alina y Alejandro comparten la misma agenda
// desde dos interfaces (el panel y el bot de Telegram), y cada una la
// escribe sin que la otra esté mirando. Sin un aviso activo, la única forma
// de enterarse de que la otra persona movió o canceló algo es entrar al
// panel o mandarle /hoy al bot por las dudas. Este archivo cierra ese hueco
// con dos mecanismos:
//
//   - avisarCambio: un mensaje instantáneo de Telegram cuando se crea, mueve,
//     edita o cancela una cita — a todos los que comparten la agenda MENOS a
//     quien hizo el cambio (esa persona ya tiene su propia confirmación,
//     inline en Telegram o en pantalla en el panel; reenviársela es ruido).
//   - resumenDiario: un mensaje una vez al día con la agenda de hoy, que el
//     cron (api/cron/agenda.ts) dispara apenas empieza el día.
//
// Ninguna de las dos puede tumbar la operación que las dispara: avisarCambio
// se llama DESPUÉS de guardar la cita, desde operaciones.ts (mismo criterio
// que el correo al cliente — ver el encabezado de ese archivo), y
// resumenDiario corre envuelta aparte en el cron, antes de la
// reconciliación pero sin poder frenarla. Un aviso que no sale es una
// molestia; una cita mal guardada o un recordatorio que no llega al
// cliente, no.

import { supabaseAdmin } from "../supabase.js";
import { filtrarAccesoAgenda } from "./permisos.js";
import { enviarMensaje } from "./telegram.js";
import { listarCitas } from "./db.js";
import type { Cita } from "./db.js";

export type AccionCita = "creada" | "movida" | "editada" | "cancelada";

const TZ = "America/Costa_Rica";

const VERBOS: Record<AccionCita, string> = {
  creada: "creó",
  movida: "movió",
  editada: "editó",
  cancelada: "canceló",
};

interface Destinatario {
  email: string;
  nombre: string;
  chatId: string;
}

interface FilaAppUser {
  email: string;
  full_name: string | null;
  telegram_chat_id: string | null;
}

// Quiénes comparten la agenda y tienen Telegram vinculado. Un admin con
// `agenda = true` pero sin `telegram_chat_id` (todavía no corrió /vincular)
// se descarta acá — no hay a dónde mandarle nada, y no es un error.
//
// Quién "comparte la agenda" NO se decide acá: lo decide `filtrarAccesoAgenda`
// (agenda/permisos.ts), la única definición de esa regla, que consumen también
// el panel, el bot y el feed. Esta es la única de las cuatro puertas que
// EMPUJA datos hacia afuera en vez de esperar a que alguien los pida, así que
// es la que más caro paga una divergencia: ver C-1 en permisos.ts.
//
// Nunca tira: si la consulta falla, se loguea y se devuelve una lista vacía.
// Un aviso que no sale es una molestia, no un motivo para romper la
// operación que lo disparó (ver el porqué completo en el encabezado del
// archivo).
async function destinatarios(): Promise<Destinatario[]> {
  try {
    const { data, error } = await filtrarAccesoAgenda(
      supabaseAdmin().from("app_users").select("email, full_name, telegram_chat_id"),
    );

    if (error) {
      console.error("agenda/avisos: no se pudo listar a quién avisar", error);
      return [];
    }

    const filas = (data ?? []) as FilaAppUser[];
    return filas
      .filter((f) => typeof f.telegram_chat_id === "string" && f.telegram_chat_id.length > 0)
      .map((f) => ({
        email: f.email,
        nombre: f.full_name?.trim() || f.email,
        chatId: f.telegram_chat_id as string,
      }));
  } catch (e) {
    console.error("agenda/avisos: fallo inesperado al listar a quién avisar", e);
    return [];
  }
}

// Mismo formato que fechaHoraLarga en agenda/acciones.ts: se duplica a
// propósito en vez de importarlo — es un helper de una línea, y acoplar dos
// módulos de dominio por algo así de chico sale más caro que repetirlo (ver
// el comentario de acciones.ts sobre el mismo punto).
function fechaHoraLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

function textoAviso(cita: Cita, accion: AccionCita, actorNombre: string): string {
  return [
    `${actorNombre} ${VERBOS[accion]} una cita:`,
    `${cita.cliente_nombre} — ${cita.lugar}`,
    fechaHoraLarga(cita.inicio),
  ].join("\n");
}

// ── Aviso instantáneo ──
//
// Se llama desde operaciones.ts, después de guardar — nunca desde el
// endpoint del panel ni desde el webhook del bot directamente, para que el
// aviso salga igual venga el cambio de donde venga (ver Task 1).
export async function avisarCambio(
  cita: Cita,
  accion: AccionCita,
  actorEmail: string,
): Promise<void> {
  try {
    const todos = await destinatarios();
    const actorNorm = actorEmail.trim().toLowerCase();
    const actor = todos.find((d) => d.email.toLowerCase() === actorNorm);
    const nombreActor = actor?.nombre ?? actorEmail;
    const receptores = todos.filter((d) => d.email.toLowerCase() !== actorNorm);
    if (!receptores.length) return;

    const texto = textoAviso(cita, accion, nombreActor);
    for (const r of receptores) {
      try {
        await enviarMensaje(r.chatId, texto);
      } catch (e) {
        console.error(`agenda/avisos: no se pudo avisar a ${r.email} del cambio`, e);
      }
    }
  } catch (e) {
    // Red de seguridad final: nada de lo de arriba debería tirar (ya está
    // todo envuelto arriba), pero un aviso caído jamás puede tumbar la
    // operación que ya se guardó — ver el porqué en el encabezado del
    // archivo.
    console.error("agenda/avisos: fallo inesperado al avisar del cambio", e);
  }
}

// ── Resumen diario ──
//
// Medianoche de HOY en Costa Rica (UTC-6 fijo, sin horario de verano),
// expresada como instante UTC. Mismo cálculo que usan /hoy y /semana en
// telegram/webhook.ts (duplicado acá por la misma razón que fechaHoraLarga
// arriba: ese archivo no exporta el helper, y es chico).
function inicioDeHoyCR(ahora: Date): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const obj = Object.fromEntries(partes.map((p) => [p.type, p.value])) as Record<string, string>;
  // Medianoche CR = 06:00 UTC del mismo día calendario de Costa Rica.
  return new Date(Date.UTC(Number(obj.year), Number(obj.month) - 1, Number(obj.day), 6, 0, 0, 0));
}

function horaCita(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(new Date(iso));
}

function formatearResumen(citas: Cita[]): string {
  const lineas = citas.map((c) => `${horaCita(c.inicio)} — ${c.cliente_nombre} — ${c.lugar}`);
  return ["Hoy:", ...lineas].join("\n");
}

// Decisión de producto: la agenda vacía SÍ manda mensaje, corto a propósito.
// El silencio no distingue entre "no hay nada agendado" y "el cron se murió
// hace tres semanas" — este mensaje es la señal de que el cron corrió.
const SIN_CITAS_HOY = "Hoy no hay citas.";

// Se llama desde el cron (api/cron/agenda.ts), una vez al día y protegido
// ahí contra doble ejecución con agenda_jobs — acá adentro no hay ninguna
// protección de ese tipo: correr esto dos veces manda el resumen dos veces.
//
// Devuelve cuántos avisos salieron de verdad (no cuántos se intentaron): si
// el envío a una persona falla, no cuenta, pero no frena el envío a la
// siguiente.
export async function resumenDiario(ahora: Date): Promise<number> {
  try {
    const desde = inicioDeHoyCR(ahora);
    const hasta = new Date(desde.getTime() + 24 * 60 * 60_000 - 1);
    const citas = await listarCitas({ desde, hasta });
    const texto = citas.length ? formatearResumen(citas) : SIN_CITAS_HOY;
    const receptores = await destinatarios();

    let enviados = 0;
    for (const r of receptores) {
      try {
        await enviarMensaje(r.chatId, texto);
        enviados++;
      } catch (e) {
        console.error(`agenda/avisos: no se pudo mandar el resumen diario a ${r.email}`, e);
      }
    }
    return enviados;
  } catch (e) {
    console.error("agenda/avisos: fallo inesperado al mandar el resumen diario", e);
    return 0;
  }
}
