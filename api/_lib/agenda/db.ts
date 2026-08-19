import { supabaseAdmin } from "../supabase.js";
import { randomUUID } from "node:crypto";

export type Origen = "panel" | "telegram" | "cron";
export type EstadoCita = "agendada" | "cancelada" | "completada";

export interface Cita {
  id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  inicio: string;               // ISO con offset, tal como lo devuelve Postgres
  duracion_min: number;
  lugar: string;
  lote_id: string | null;
  notas: string | null;
  estado: EstadoCita;
  ics_uid: string;
  ics_secuencia: number;
  recordatorio_24h_email_id: string | null;
  recordatorio_1h_email_id: string | null;
  creada_por: string;
  created_at: string;
  updated_at: string;
}

export interface DatosCita {
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono?: string | null;
  inicio: string;
  lugar: string;
  lote_id?: string | null;
  notas?: string | null;
}

function db() {
  return supabaseAdmin();
}

// El detalle del error de Postgres se loguea pero nunca sale hacia el cliente.
function reventar(contexto: string, error: unknown, generico: string): never {
  console.error(`agenda/db: ${contexto}`, error);
  throw new Error(generico);
}

export async function listarCitas(opts: {
  desde: Date;
  hasta: Date;
  incluirCanceladas?: boolean;
}): Promise<Cita[]> {
  let q = db()
    .from("citas")
    .select("*")
    .gte("inicio", opts.desde.toISOString())
    .lte("inicio", opts.hasta.toISOString())
    .order("inicio", { ascending: true });

  if (!opts.incluirCanceladas) q = q.neq("estado", "cancelada");

  const { data, error } = await q;
  if (error) reventar("listarCitas", error, "No se pudo obtener la agenda.");
  return (data ?? []) as Cita[];
}

export async function obtenerCita(id: string): Promise<Cita | null> {
  const { data, error } = await db().from("citas").select("*").eq("id", id).maybeSingle();
  if (error) reventar("obtenerCita", error, "No se pudo obtener la cita.");
  return (data as Cita) ?? null;
}

async function registrar(
  citaId: string,
  accion: "creada" | "movida" | "editada" | "cancelada" | "reenviada",
  detalle: unknown,
  actor: string,
  origen: Origen,
) {
  const { error } = await db()
    .from("citas_log")
    .insert({ cita_id: citaId, accion, detalle, actor, origen });
  // La bitácora no puede tumbar la operación: la cita ya está guardada y es lo
  // que importa. Pero un fallo silencioso acá es invisible, así que se loguea.
  if (error) console.error("agenda/db: no se pudo registrar en citas_log", error);
}

export async function crearCita(
  datos: DatosCita,
  actor: string,
  origen: Origen,
): Promise<Cita> {
  // El UID se genera una sola vez y no se toca nunca más. Es lo que permite que
  // reagendar mueva el evento del cliente en vez de crearle uno nuevo al lado.
  const ics_uid = `cita-${randomUUID()}@ecovivadesarrollos.com`;

  const { data, error } = await db()
    .from("citas")
    .insert({
      cliente_nombre: datos.cliente_nombre,
      cliente_email: datos.cliente_email,
      cliente_telefono: datos.cliente_telefono ?? null,
      inicio: datos.inicio,
      lugar: datos.lugar,
      lote_id: datos.lote_id ?? null,
      notas: datos.notas ?? null,
      ics_uid,
      creada_por: actor,
    })
    .select()
    .single();

  if (error) reventar("crearCita", error, "No se pudo guardar la cita.");
  const cita = data as Cita;
  await registrar(cita.id, "creada", { inicio: cita.inicio, lugar: cita.lugar }, actor, origen);
  return cita;
}

// Minúsculas y sin espacios al borde, para que corregir "Maria@Example.com "
// a "maria@example.com" no cuente como un cambio real de destinatario.
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

// M-b: qué campos de DatosCita registrar en la bitácora cuando algo cambia,
// y con qué valores. Antes, el `detalle` de una edición SIEMPRE guardaba
// `{ inicio, lugar }` de antes y después, sin importar qué campo se editó
// de verdad. Para un cambio que no toca ni inicio ni lugar (p. ej. solo
// notas), eso guarda dos valores idénticos y nunca dice qué cambió — la
// bitácora existe para responder "yo no moví eso" y así no responde nada, y
// esa información no se puede reconstruir después porque `antes` ya se
// perdió. Acá se compara cada campo tocado (mismo criterio de "mismo valor"
// que ya usan `cambioVisible`/`correoModificado`: por instante para
// `inicio`, normalizado para `cliente_email`) y solo se registra el que
// realmente cambió.
const CAMPOS_CITA: (keyof DatosCita)[] = [
  "cliente_nombre",
  "cliente_email",
  "cliente_telefono",
  "inicio",
  "lugar",
  "lote_id",
  "notas",
];

function valoresIguales(campo: keyof DatosCita, a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (campo === "inicio" && typeof a === "string" && typeof b === "string") {
    return new Date(a).getTime() === new Date(b).getTime();
  }
  if (campo === "cliente_email" && typeof a === "string" && typeof b === "string") {
    return normalizarEmail(a) === normalizarEmail(b);
  }
  return a === b;
}

// Compara solo los campos que `cambios` tocó (los que no vinieron en el
// PATCH ni se evalúan: nunca "cambiaron" porque nadie los mandó) contra la
// fila resultante, y devuelve nada más los que de verdad quedaron distintos.
function camposModificados(
  cambios: Partial<DatosCita>,
  antes: Cita,
  despues: Cita,
): Record<string, { antes: unknown; despues: unknown }> {
  const detalle: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const campo of CAMPOS_CITA) {
    if (cambios[campo] === undefined) continue;
    const valorAntes = antes[campo];
    const valorDespues = despues[campo];
    if (!valoresIguales(campo, valorAntes, valorDespues)) {
      detalle[campo] = { antes: valorAntes, despues: valorDespues };
    }
  }
  return detalle;
}

export async function actualizarCita(
  id: string,
  cambios: Partial<DatosCita>,
  actor: string,
  origen: Origen,
): Promise<{ cita: Cita; cambioVisible: boolean; correoModificado: boolean }> {
  const antes = await obtenerCita(id);
  if (!antes) throw new Error("Esa cita no existe.");
  if (antes.estado === "cancelada") throw new Error("Esa cita ya fue cancelada.");
  // I2: el cron marca "completada" las citas pasadas. Sin este chequeo, el
  // panel (rango -7d..+90d, sin filtrar por estado) deja el formulario de
  // edición abierto sobre una visita que ya ocurrió. Mensaje distinto al de
  // arriba a propósito: son dos causas distintas y citas.ts los mapea cada
  // uno a su propio 409.
  if (antes.estado === "completada") throw new Error("Esa cita ya se realizó: no se puede editar.");

  // Un cambio es "visible" solo si afecta lo que el cliente ve en su invitación de
  // calendario: la hora o el lugar. Editar notas, teléfono o lote no debería
  // mandarle un correo de "Cambio de hora" con la misma hora.
  //
  // Comparamos por valor temporal, no por string: Postgres devuelve
  // "2026-09-01T16:00:00+00:00" pero el panel podría armar
  // "2026-09-01T16:00:00.000Z" (mismo instante, formato distinto).
  const inicioModificado =
    cambios.inicio !== undefined &&
    new Date(cambios.inicio).getTime() !== new Date(antes.inicio).getTime();
  const lugarModificado = cambios.lugar !== undefined && cambios.lugar !== antes.lugar;
  const cambioVisible = inicioModificado || lugarModificado;

  // El correo no es "visible" en el sentido de arriba (no es algo que se vea
  // EN la invitación), pero es el destinatario: si cambia, la dirección nueva
  // nunca recibió nada de esta cita — no es un "cambio de hora" para ella,
  // es su primera noticia. Quien llama (citas.ts) decide con esto si manda
  // "confirmacion" en vez de "reagendado".
  const correoModificado =
    cambios.cliente_email !== undefined &&
    normalizarEmail(cambios.cliente_email) !== normalizarEmail(antes.cliente_email);

  // La secuencia sube con cambios visibles O con cambio de correo: en ambos
  // casos hay una invitación de calendario nueva que mandar (a la hora de
  // siempre o a la dirección nueva). Si cambió solo las notas o el teléfono,
  // no sube: el cliente no recibe nada y su calendario no cambia.
  // Creamos una copia para no mutar el objeto que el llamador pasó.
  const actualizar: Record<string, unknown> = { ...cambios };
  if (cambioVisible || correoModificado) {
    actualizar.ics_secuencia = antes.ics_secuencia + 1;
  }

  const { data, error } = await db()
    .from("citas")
    .update(actualizar)
    .eq("id", id)
    .select()
    .single();

  if (error) reventar("actualizarCita", error, "No se pudo actualizar la cita.");
  const despues = data as Cita;
  await registrar(
    id,
    inicioModificado ? "movida" : "editada",
    camposModificados(cambios, antes, despues),
    actor,
    origen,
  );
  return { cita: despues, cambioVisible, correoModificado };
}

export async function cancelarCita(
  id: string,
  actor: string,
  origen: Origen,
): Promise<{ cita: Cita; seCancelo: boolean }> {
  const antes = await obtenerCita(id);
  if (!antes) throw new Error("Esa cita no existe.");
  // Idempotente: cancelar dos veces no es un error, pero `seCancelo: false`
  // le dice al llamador que esta vez no pasó nada — no vuelve a avisarle al
  // cliente por un doble clic o una carrera entre dos personas del equipo.
  if (antes.estado === "cancelada") return { cita: antes, seCancelo: false };
  // I2: a diferencia de "cancelada" (arriba), esto SÍ es un error: cancelar
  // una cita que el cron ya cerró como "completada" no es un doble clic
  // inocuo, es mandarle "Tu cita fue cancelada" al cliente por una visita
  // que ya hizo. Mensaje distinto al de "ya fue cancelada" para que
  // citas.ts pueda distinguir los dos casos.
  if (antes.estado === "completada") throw new Error("Esa cita ya se realizó: no se puede cancelar.");

  const { data, error } = await db()
    .from("citas")
    .update({ estado: "cancelada", ics_secuencia: antes.ics_secuencia + 1 })
    .eq("id", id)
    .select()
    .single();

  if (error) reventar("cancelarCita", error, "No se pudo cancelar la cita.");
  await registrar(id, "cancelada", { inicio: antes.inicio }, actor, origen);
  return { cita: data as Cita, seCancelo: true };
}

// I3: reenvío manual del correo de confirmación (sin tocar la fila ni la
// secuencia). No encaja en ninguna de las cuatro acciones que ya existían en
// citas_log, así que se agrega "reenviada" (migración 0009). Sin `antes`/
// `despues` porque no hay ningún cambio de datos que registrar — el hecho
// mismo de que alguien lo disparó es lo que importa.
export async function registrarReenvio(citaId: string, actor: string, origen: Origen): Promise<void> {
  await registrar(citaId, "reenviada", null, actor, origen);
}

export async function guardarIdsRecordatorio(
  id: string,
  ids: { r24h?: string | null; r1h?: string | null },
): Promise<void> {
  const cambios: Record<string, string | null> = {};
  if (ids.r24h !== undefined) cambios.recordatorio_24h_email_id = ids.r24h;
  if (ids.r1h !== undefined) cambios.recordatorio_1h_email_id = ids.r1h;
  if (!Object.keys(cambios).length) return;

  const { error } = await db().from("citas").update(cambios).eq("id", id);
  if (error) console.error("agenda/db: no se pudieron guardar los ids de recordatorio", error);
}
