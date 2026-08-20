// api/_lib/agenda/operaciones.ts
//
// Por qué existe este archivo: el panel (api/agenda/citas.ts) y el bot de
// Telegram necesitan hacer exactamente lo mismo al crear, editar, cancelar o
// reenviar una cita — guardarla, decidir qué correo le sale al cliente y
// acomodar sus recordatorios. Si cada camino tuviera su propia copia de esta
// orquestación, la primera corrección que se le hiciera a una se le
// olvidaría hacer a la otra, y el síntoma sería "por el panel sí le llega el
// correo al cliente, por el bot no". Esta es la única implementación de esa
// lógica de dominio; el panel y el bot solo la llaman y traducen su
// resultado a su propio transporte (HTTP uno, mensajes de Telegram el otro).
//
// Lo que NO vive acá: la validación de los campos crudos del body HTTP y el
// mapeo de errores a códigos de estado. Eso es transporte, no dominio, y se
// queda en cada consumidor (api/agenda/citas.ts para el panel).

import { crearCita, actualizarCita, cancelarCita, obtenerCita, listarCitas, registrarReenvio } from "./db.js";
import type { Cita, DatosCita, Origen } from "./db.js";
import { enviarAhora, type ClaseCorreo } from "./email.js";
import { aplicarRecordatorios } from "./recordatorios.js";
import { avisarCambio, type AccionCita } from "./avisos.js";
import { ErrorAgenda } from "./errores.js";

export type ResultadoCorreo = "enviado" | "fallo" | "no_aplica";

const DURACION_MIN = 60; // fija por ahora; la columna existe pero la UI no la expone

// Se avisa del solape, no se bloquea: con agenda compartida entre dos personas,
// a veces sí quieren dos cosas a la misma hora. Bloquear crearía más fricción
// que la que evita.
export async function haySolape(inicioIso: string, excluirId?: string): Promise<boolean> {
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

// El correo va DESPUÉS de guardar y nunca deshace lo guardado. Mismo criterio
// que api/reserve.ts, donde el lead nunca se pierde porque falle un paso
// posterior. Se reporta el resultado para que quien llama lo pueda mostrar.
//
// `opts.recrear` se le pasa tal cual a aplicarRecordatorios: cuando el correo
// del cliente cambió, los recordatorios ya programados hay que recrearlos
// (cancelar los viejos y crear nuevos), porque Resend no permite cambiar el
// destinatario de un envío ya programado.
async function avisarAlCliente(
  clase: ClaseCorreo,
  cita: Cita,
  opts: { recrear?: boolean } = {},
): Promise<"enviado" | "fallo"> {
  // Los recordatorios se acomodan siempre, salga o no el correo inmediato: son
  // mecanismos independientes y el fallo de uno no debe arrastrar al otro.
  // aplicarRecordatorios ya nunca tira, pero el .catch es una segunda red de
  // seguridad para no dejar una promesa rechazada suelta.
  const recordatorios = aplicarRecordatorios(cita, new Date(), opts).catch((e) => {
    console.error("agenda/operaciones: no se pudieron acomodar los recordatorios", e);
  });

  let resultado: "enviado" | "fallo" = "enviado";
  try {
    await enviarAhora(clase, cita);
  } catch (e) {
    console.error(`agenda/operaciones: no se pudo mandar el correo "${clase}"`, e);
    resultado = "fallo";
  }

  await recordatorios;
  return resultado;
}

// El aviso a la otra persona del equipo va DESPUÉS de guardar, igual que el
// correo al cliente: avisarCambio ya nunca tira (ver avisos.ts), pero el
// .catch() de acá es una segunda red de seguridad para no dejar una promesa
// rechazada suelta — mismo criterio que aplicarRecordatorios más arriba.
function avisarAlEquipo(cita: Cita, accion: AccionCita, actor: string): Promise<void> {
  return avisarCambio(cita, accion, actor).catch((e) => {
    console.error("agenda/operaciones: no se pudo avisar al equipo del cambio", e);
  });
}

// Crear avisa siempre con "confirmacion".
export async function crearCitaCompleta(
  datos: DatosCita,
  actor: string,
  origen: Origen,
): Promise<{ cita: Cita; choque: boolean; correo: ResultadoCorreo }> {
  const choque = await haySolape(datos.inicio);
  const cita = await crearCita(datos, actor, origen);
  const correo = await avisarAlCliente("confirmacion", cita);
  await avisarAlEquipo(cita, "creada", actor);
  return { cita, choque, correo };
}

// Editar decide entre tres correos según qué cambió.
export async function actualizarCitaCompleta(
  id: string,
  datos: DatosCita,
  actor: string,
  origen: Origen,
): Promise<{ cita: Cita; choque: boolean; correo: ResultadoCorreo }> {
  const choque = await haySolape(datos.inicio, id);
  const { cita, cambioVisible, correoModificado, inicioModificado } = await actualizarCita(
    id,
    datos,
    actor,
    origen,
  );

  // Prioridad: si cambió el correo del cliente, la dirección nueva nunca
  // vio nada de esta cita — es su primera noticia, así que es una
  // "confirmacion", no un "reagendado" (aunque también haya cambiado la
  // hora). Si no cambió el correo pero sí hora o lugar, es un
  // "reagendado". Si no cambió nada de lo anterior (solo notas, teléfono,
  // lote o nombre), no hay nada visible que avisar.
  //
  // C1: `recrear` va en `cambioVisible || correoModificado`, NUNCA solo
  // en `correoModificado`. Los recordatorios ya programados en Resend
  // llevan el asunto, el cuerpo y el .ics armados con el contenido de la
  // cita al momento de programarlos. Un PATCH que solo mueve `scheduled_at`
  // (lo que hace "reprogramar") no puede tocar ese contenido: si la hora o
  // el lugar cambiaron, hay que cancelar los recordatorios viejos y
  // programar unos nuevos con el contenido vigente — eso es "recrear". Si
  // no se hace así, el cliente recibe el recordatorio a la hora nueva
  // (correcta) pero con el texto de la cita vieja (incorrecto): se
  // presenta al lugar y la hora equivocados.
  const recrear = cambioVisible || correoModificado;
  let correo: ResultadoCorreo;
  if (correoModificado) {
    correo = await avisarAlCliente("confirmacion", cita, { recrear });
  } else if (cambioVisible) {
    correo = await avisarAlCliente("reagendado", cita, { recrear });
  } else {
    correo = "no_aplica";
  }
  // Al equipo se le avisa SIEMPRE que se llama a esta función, aunque el
  // cambio no sea "visible" para el cliente (p. ej. solo se tocaron notas o
  // teléfono): esa info sí le importa a la otra persona, que comparte la
  // misma agenda. Mismo criterio que ya usa citas_log más abajo en db.ts,
  // que también registra la edición sin condicionarla a cambioVisible.
  await avisarAlEquipo(cita, inicioModificado ? "movida" : "editada", actor);
  return { cita, choque, correo };
}

// Cancelar avisa siempre, salvo que la cita ya estuviera cancelada
// (idempotente: no se manda un segundo correo por un doble clic, o por una
// carrera entre dos personas del equipo cancelando la misma cita).
export async function cancelarCitaCompleta(
  id: string,
  actor: string,
  origen: Origen,
): Promise<{ cita: Cita; correo: ResultadoCorreo }> {
  const { cita, seCancelo } = await cancelarCita(id, actor, origen);
  const correo = seCancelo ? await avisarAlCliente("cancelacion", cita) : "no_aplica";
  // Mismo idempotente que el correo: si ya estaba cancelada, no se avisa de
  // nuevo por un doble clic o una carrera entre las dos personas del equipo.
  if (seCancelo) await avisarAlEquipo(cita, "cancelada", actor);
  return { cita, correo };
}

// I3: reenvío manual del correo de confirmación. El spec lo exige como salida
// para cuando el correo falla tras guardar la cita (p. ej. Resend caído dos
// minutos justo cuando se agendó): sin esto no había forma de que el
// cliente recibiera la invitación. A propósito NO pasa por crearCita/
// actualizarCita: no toca la fila ni sube ics_secuencia, porque no cambió
// nada de la cita — solo se repite el envío.
export async function reenviarConfirmacion(
  id: string,
  actor: string,
  origen: Origen,
): Promise<{ cita: Cita; correo: ResultadoCorreo }> {
  const cita = await obtenerCita(id);
  if (!cita) throw new ErrorAgenda("no_encontrada", "Esa cita no existe.");
  // N2: el reenvío solo tiene sentido mientras la cita sigue "agendada".
  // Sobre una "cancelada" no hay nada que confirmar; sobre una
  // "completada" mandaría "Tu cita quedó agendada" con un .ics de fecha
  // pasada por una visita que el cliente ya hizo — el mismo correo falso
  // que I2 bloqueó en cancelar/editar, entrando por esta puerta.
  if (cita.estado !== "agendada") {
    const motivo =
      cita.estado === "cancelada"
        ? "Esa cita ya fue cancelada: no hay nada que confirmar."
        : "Esa cita ya se realizó: no hay nada que confirmar.";
    throw new ErrorAgenda("conflicto", motivo);
  }

  let correo: "enviado" | "fallo" = "enviado";
  try {
    await enviarAhora("confirmacion", cita);
  } catch (e) {
    console.error("agenda/operaciones: no se pudo reenviar el correo de confirmación", e);
    correo = "fallo";
  }
  // La bitácora no puede tumbar la respuesta: la cita y el intento de
  // reenvío ya pasaron, es lo mismo que rige para citas_log en el resto
  // de estas operaciones (ver `registrar` en db.ts).
  await registrarReenvio(cita.id, actor, origen).catch((e) =>
    console.error("agenda/operaciones: no se pudo registrar el reenvío en la bitácora", e),
  );
  return { cita, correo };
}
