import { requireAgenda } from "../_lib/supabase.js";
import { listarCitas, crearCita, actualizarCita, cancelarCita } from "../_lib/agenda/db.js";
import type { Cita, DatosCita } from "../_lib/agenda/db.js";
import { enviarAhora, type ClaseCorreo } from "../_lib/agenda/email.js";

// /api/agenda/citas — CRUD de la agenda privada. Solo admin con bandera agenda.
//
// Crear y cancelar avisan al cliente siempre: son eventos que él ve sí o sí.
// Editar solo avisa si el cambio es visible (hora o lugar) — ver `cambioVisible`
// en agenda/db.ts y su uso más abajo, en el PATCH.

const DURACION_MIN = 60; // fija por ahora; la columna existe pero la UI no la expone

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

// Se avisa del solape, no se bloquea: con agenda compartida entre dos personas,
// a veces sí quieren dos cosas a la misma hora. Bloquear crearía más fricción
// que la que evita.
async function haySolape(inicioIso: string, excluirId?: string): Promise<boolean> {
  const inicio = new Date(inicioIso);
  const fin = new Date(inicio.getTime() + DURACION_MIN * 60_000);
  // Ventana holgada a ambos lados para traer cualquier cita que pueda solapar.
  const vecinas = await listarCitas({
    desde: new Date(inicio.getTime() - 4 * 60 * 60_000),
    hasta: new Date(inicio.getTime() + 4 * 60 * 60_000),
  });
  return vecinas.some((c: Cita) => {
    if (excluirId && c.id === excluirId) return false;
    const cIni = new Date(c.inicio).getTime();
    const cFin = cIni + (c.duracion_min ?? DURACION_MIN) * 60_000;
    return cIni < fin.getTime() && cFin > inicio.getTime();
  });
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

// El correo va DESPUÉS de guardar y nunca deshace lo guardado. Mismo criterio
// que api/reserve.ts, donde el lead nunca se pierde porque falle un paso
// posterior. Se reporta el resultado para que el panel lo pueda mostrar.
async function avisarAlCliente(clase: ClaseCorreo, cita: Cita): Promise<"enviado" | "fallo"> {
  try {
    await enviarAhora(clase, cita);
    return "enviado";
  } catch (e) {
    console.error(`agenda/citas: no se pudo mandar el correo "${clase}"`, e);
    return "fallo";
  }
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

    if (req.method === "POST") {
      const leido = leerDatos(body);
      if ("error" in leido) return res.status(400).json({ error: leido.error });

      const choque = await haySolape(leido.datos.inicio);
      // La fila se devuelve completa, notas incluidas: este endpoint es del
      // panel (detrás de requireAgenda) y el panel muestra las notas internas
      // — para eso existen. La restricción de que `notas` nunca llegue al
      // cliente vive en el armado de los correos, no acá.
      const cita = await crearCita(leido.datos, caller.email, "panel");
      const correo = await avisarAlCliente("confirmacion", cita);
      return res.status(200).json({ cita, choque, correo });
    }

    if (req.method === "PATCH") {
      const id = typeof body.id === "string" ? body.id : null;
      if (!id) return res.status(400).json({ error: "Falta el id de la cita" });

      const leido = leerDatos(body);
      if ("error" in leido) return res.status(400).json({ error: leido.error });

      const choque = await haySolape(leido.datos.inicio, id);
      const { cita, cambioVisible } = await actualizarCita(id, leido.datos, caller.email, "panel");
      // Solo se avisa si cambió algo que el cliente ve en su invitación (hora
      // o lugar). Corregir una nota interna, el teléfono, el lote o el nombre
      // no dispara un correo de "Cambio de hora" con la misma hora de siempre.
      const correo = cambioVisible ? await avisarAlCliente("reagendado", cita) : "no_aplica";
      return res.status(200).json({ cita, choque, correo });
    }

    if (req.method === "DELETE") {
      const id = typeof body.id === "string" ? body.id : null;
      if (!id) return res.status(400).json({ error: "Falta el id de la cita" });
      const cita = await cancelarCita(id, caller.email, "panel");
      const correo = await avisarAlCliente("cancelacion", cita);
      return res.status(200).json({ cita, correo });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    // El detalle crudo de Postgres nunca sale hacia el cliente: db.ts ya lo
    // sanitiza antes de lanzar (ver `reventar` en agenda/db.ts), así que acá
    // sólo queda loguear la traza completa por si hace falta para diagnosticar.
    console.error("agenda/citas error", e);
    const mensaje = e instanceof Error ? e.message : "Error inesperado";

    // db.ts lanza Error con texto propio en vez de códigos estructurados (está
    // cerrado y revisado, no se toca para esto), así que la única forma limpia
    // de distinguir estos dos casos del resto es comparar el mensaje exacto.
    // "La cita no existe" no es un error del servidor (404) y "ya fue
    // cancelada" es un conflicto de estado (409); todo lo demás sigue en 500.
    if (mensaje === "Esa cita no existe.") return res.status(404).json({ error: mensaje });
    if (mensaje === "Esa cita ya fue cancelada.") return res.status(409).json({ error: mensaje });

    return res.status(500).json({ error: mensaje });
  }
}
