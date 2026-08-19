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
  accion: "creada" | "movida" | "editada" | "cancelada",
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

export async function actualizarCita(
  id: string,
  cambios: Partial<DatosCita>,
  actor: string,
  origen: Origen,
): Promise<{ cita: Cita; cambioVisible: boolean }> {
  const antes = await obtenerCita(id);
  if (!antes) throw new Error("Esa cita no existe.");
  if (antes.estado === "cancelada") throw new Error("Esa cita ya fue cancelada.");

  // Un cambio es "visible" solo si afecta lo que el cliente ve en su invitación de
  // calendario: la hora o el lugar. Editar notas, teléfono o lote no debería
  // mandarle un correo de "Cambio de hora" con la misma hora.
  const inicioChanged = cambios.inicio !== undefined && cambios.inicio !== antes.inicio;
  const lugarChanged = cambios.lugar !== undefined && cambios.lugar !== antes.lugar;
  const cambioVisible = inicioChanged || lugarChanged;

  // La secuencia sube SOLO con cambios visibles. Si cambió solo las notas o el
  // teléfono, el cliente no recibe notificación y su calendaio no cambia.
  const updateObj: Record<string, unknown> = cambios;
  if (cambioVisible) {
    updateObj.ics_secuencia = antes.ics_secuencia + 1;
  }

  const { data, error } = await db()
    .from("citas")
    .update(updateObj)
    .eq("id", id)
    .select()
    .single();

  if (error) reventar("actualizarCita", error, "No se pudo actualizar la cita.");
  const despues = data as Cita;
  await registrar(
    id,
    inicioChanged ? "movida" : "editada",
    { antes: { inicio: antes.inicio, lugar: antes.lugar }, despues: { inicio: despues.inicio, lugar: despues.lugar } },
    actor,
    origen,
  );
  return { cita: despues, cambioVisible };
}

export async function cancelarCita(id: string, actor: string, origen: Origen): Promise<Cita> {
  const antes = await obtenerCita(id);
  if (!antes) throw new Error("Esa cita no existe.");
  if (antes.estado === "cancelada") return antes; // idempotente

  const { data, error } = await db()
    .from("citas")
    .update({ estado: "cancelada", ics_secuencia: antes.ics_secuencia + 1 })
    .eq("id", id)
    .select()
    .single();

  if (error) reventar("cancelarCita", error, "No se pudo cancelar la cita.");
  await registrar(id, "cancelada", { inicio: antes.inicio }, actor, origen);
  return data as Cita;
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
