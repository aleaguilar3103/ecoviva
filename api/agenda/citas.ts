import { requireAgenda } from "../_lib/supabase.js";
import { listarCitas } from "../_lib/agenda/db.js";
import type { DatosCita } from "../_lib/agenda/db.js";
import {
  crearCitaCompleta,
  actualizarCitaCompleta,
  cancelarCitaCompleta,
  reenviarConfirmacion,
} from "../_lib/agenda/operaciones.js";

// /api/agenda/citas — CRUD de la agenda privada. Solo admin con bandera agenda.
//
// Capa delgada a propósito: acá solo se valida el body HTTP, se llama a la
// operación de dominio correspondiente (api/_lib/agenda/operaciones.ts, que
// comparten este panel y el bot de Telegram) y se traduce el resultado a
// código de estado. Qué correo mandar y cuándo recrear los recordatorios
// vive en operaciones.ts — ver ahí `cambioVisible` y `correoModificado`.

function correoValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function fechaValida(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function textoRequerido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= 200 ? t : null;
}

function leerDatos(body: Record<string, unknown>): { datos: DatosCita } | { error: string } {
  const cliente_nombre = textoRequerido(body.cliente_nombre);
  if (!cliente_nombre) return { error: "Falta el nombre del cliente" };

  const cliente_email = correoValido(body.cliente_email);
  if (!cliente_email) {
    return { error: "Hace falta un correo válido del cliente: sin él no hay invitación ni recordatorios" };
  }

  const inicio = fechaValida(body.inicio);
  if (!inicio) return { error: "Fecha y hora inválidas" };

  const lugar = textoRequerido(body.lugar);
  if (!lugar) return { error: "Falta el lugar de la cita" };

  return {
    datos: {
      cliente_nombre,
      cliente_email,
      cliente_telefono: typeof body.cliente_telefono === "string" ? body.cliente_telefono.trim() || null : null,
      inicio,
      lugar,
      lote_id: typeof body.lote_id === "string" && body.lote_id ? body.lote_id : null,
      notas: typeof body.notas === "string" ? body.notas.trim() || null : null,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  // El permiso se revalida en el servidor siempre, antes de leer nada del body.
  const caller = await requireAgenda(req);
  if (!caller) return res.status(401).json({ error: "No autorizado" });

  try {
    if (req.method === "GET") {
      const { desde, hasta } = (req.query ?? {}) as { desde?: string; hasta?: string };
      const d = desde ? new Date(desde) : new Date(Date.now() - 7 * 24 * 60 * 60_000);
      const h = hasta ? new Date(hasta) : new Date(Date.now() + 60 * 24 * 60 * 60_000);
      if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) {
        return res.status(400).json({ error: "Rango de fechas inválido" });
      }
      return res.status(200).json({ citas: await listarCitas({ desde: d, hasta: h }) });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (req.method === "POST" && body.reenviar === true) {
      // I3: reenvío manual del correo de confirmación. El spec lo exige como
      // salida para cuando el correo falla tras guardar la cita (p. ej.
      // Resend caído dos minutos justo cuando se agendó): sin esto no había
      // forma de que el cliente recibiera la invitación. A propósito NO pasa
      // por crearCita/actualizarCita: no toca la fila ni sube ics_secuencia,
      // porque no cambió nada de la cita — solo se repite el envío.
      const id = typeof body.id === "string" ? body.id : null;
      if (!id) return res.status(400).json({ error: "Falta el id de la cita" });

      const { cita, correo } = await reenviarConfirmacion(id, caller.email, "panel");
      return res.status(200).json({ cita, correo });
    }

    if (req.method === "POST") {
      const leido = leerDatos(body);
      if ("error" in leido) return res.status(400).json({ error: leido.error });

      // La fila se devuelve completa, notas incluidas: este endpoint es del
      // panel (detrás de requireAgenda) y el panel muestra las notas internas
      // — para eso existen. La restricción de que `notas` nunca llegue al
      // cliente vive en el armado de los correos, no acá.
      const { cita, choque, correo } = await crearCitaCompleta(leido.datos, caller.email, "panel");
      return res.status(200).json({ cita, choque, correo });
    }

    if (req.method === "PATCH") {
      const id = typeof body.id === "string" ? body.id : null;
      if (!id) return res.status(400).json({ error: "Falta el id de la cita" });

      const leido = leerDatos(body);
      if ("error" in leido) return res.status(400).json({ error: leido.error });

      const { cita, choque, correo } = await actualizarCitaCompleta(id, leido.datos, caller.email, "panel");
      return res.status(200).json({ cita, choque, correo });
    }

    if (req.method === "DELETE") {
      const id = typeof body.id === "string" ? body.id : null;
      if (!id) return res.status(400).json({ error: "Falta el id de la cita" });
      const { cita, correo } = await cancelarCitaCompleta(id, caller.email, "panel");
      return res.status(200).json({ cita, correo });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    // El detalle crudo de Postgres nunca sale hacia el cliente: db.ts ya lo
    // sanitiza antes de lanzar (ver `reventar` en agenda/db.ts), así que acá
    // sólo queda loguear la traza completa por si hace falta para diagnosticar.
    console.error("agenda/citas error", e);
    const mensaje = e instanceof Error ? e.message : "Error inesperado";

    // db.ts y operaciones.ts lanzan Error con texto propio en vez de códigos
    // estructurados (está cerrado y revisado, no se toca para esto), así que
    // la única forma limpia de distinguir estos casos del resto es comparar
    // el mensaje exacto. "La cita no existe" no es un error del servidor
    // (404); "ya fue cancelada", "ya se realizó" (I2: no se puede tocar una
    // cita que el cron ya cerró) y las dos variantes del reenvío (I3/N2) son
    // conflictos de estado (409); todo lo demás sigue en 500.
    if (mensaje === "Esa cita no existe.") return res.status(404).json({ error: mensaje });
    if (mensaje === "Esa cita ya fue cancelada.") return res.status(409).json({ error: mensaje });
    if (mensaje === "Esa cita ya se realizó: no se puede editar.") return res.status(409).json({ error: mensaje });
    if (mensaje === "Esa cita ya se realizó: no se puede cancelar.") return res.status(409).json({ error: mensaje });
    if (mensaje === "Esa cita ya fue cancelada: no hay nada que confirmar.") {
      return res.status(409).json({ error: mensaje });
    }
    if (mensaje === "Esa cita ya se realizó: no hay nada que confirmar.") {
      return res.status(409).json({ error: mensaje });
    }

    return res.status(500).json({ error: mensaje });
  }
}
