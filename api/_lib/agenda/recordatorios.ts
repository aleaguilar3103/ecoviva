import { enviarCorreo, reprogramarCorreo, cancelarCorreo } from "./resend.js";
import { armarCorreo, datosParaCorreo } from "./email.js";
import { guardarIdsRecordatorio } from "./db.js";
import type { Cita } from "./db.js";

// Decidir qué recordatorios corresponden. Función PURA a propósito: separar
// "decidir" de "hacer" es lo que permite probar todas las reglas de borde sin
// red de por medio. La parte que llama a Resend está más abajo y no tiene
// lógica propia.

export type Clase = "24h" | "1h";

export type Accion =
  | { tipo: "programar"; clase: Clase; enviarA: Date }
  | { tipo: "reprogramar"; clase: Clase; emailId: string; enviarA: Date }
  | { tipo: "cancelar"; clase: Clase; emailId: string }
  | { tipo: "nada"; clase: Clase };

const OFFSETS: Record<Clase, number> = {
  "24h": 24 * 60 * 60_000,
  "1h": 60 * 60_000,
};

// Resend acepta hasta 30 días. Se usa 29 para no rozar el borde entre que se
// calcula el instante y se manda la petición.
const VENTANA_MS = 29 * 24 * 60 * 60_000;

// Un scheduled_at a segundos de distancia puede quedar en el pasado para cuando
// la petición llega. Dos minutos de colchón.
const MARGEN_MS = 2 * 60_000;

export function planificarRecordatorios(opts: {
  inicio: Date;
  ahora: Date;
  idActual24h: string | null;
  idActual1h: string | null;
  citaCancelada?: boolean;
}): Accion[] {
  const actuales: Record<Clase, string | null> = {
    "24h": opts.idActual24h,
    "1h": opts.idActual1h,
  };

  return (Object.keys(OFFSETS) as Clase[]).map((clase): Accion => {
    const emailId = actuales[clase];

    if (opts.citaCancelada) {
      return emailId ? { tipo: "cancelar", clase, emailId } : { tipo: "nada", clase };
    }

    const enviarA = new Date(opts.inicio.getTime() - OFFSETS[clase]);
    const dentro =
      enviarA.getTime() > opts.ahora.getTime() + MARGEN_MS &&
      enviarA.getTime() <= opts.ahora.getTime() + VENTANA_MS;

    if (!dentro) {
      // Fuera de ventana: si había algo programado hay que quitarlo, porque ya
      // no corresponde (o el envío quedó en el pasado, o falta demasiado).
      return emailId ? { tipo: "cancelar", clase, emailId } : { tipo: "nada", clase };
    }

    return emailId
      ? { tipo: "reprogramar", clase, emailId, enviarA }
      : { tipo: "programar", clase, enviarA };
  });
}

// ---- Ejecutar el plan contra Resend ---------------------------------------
// A partir de acá ya no es una función pura: hace llamadas HTTP reales
// (Resend) y guarda en la base. La parte "decidir" está arriba a propósito.

const CLASE_A_CORREO = {
  "24h": "recordatorio24h",
  "1h": "recordatorio1h",
} as const;

// Ejecuta el plan y guarda los ids resultantes. Nunca tira: un fallo acá deja
// el id en null, y el reconciliador del cron lo retoma al día siguiente.
//
// `opts.recrear`: los recordatorios se programan en Resend con la dirección
// del destinatario incrustada en el envío, y el PATCH de Resend solo puede
// mover el scheduled_at — nunca cambia a quién le llega. Si el correo del
// cliente cambió (p. ej. se corrigió un tipeo), los recordatorios ya
// programados le seguirían llegando a la dirección vieja. Con recrear:true se
// cancelan los ids existentes ANTES de planificar y se tratan como
// inexistentes, para que planificarRecordatorios decida "programar" y cree
// envíos nuevos con la dirección correcta.
export async function aplicarRecordatorios(
  cita: Cita,
  ahora = new Date(),
  opts: { recrear?: boolean } = {},
): Promise<void> {
  try {
    let idActual24h = cita.recordatorio_24h_email_id;
    let idActual1h = cita.recordatorio_1h_email_id;
    const nuevos: { r24h?: string | null; r1h?: string | null } = {};

    if (opts.recrear) {
      if (idActual24h) {
        try {
          await cancelarCorreo(idActual24h);
        } catch (e) {
          console.error("agenda/recordatorios: fallo cancelar el 24h viejo al recrear", e);
        }
        idActual24h = null;
        // Se deja en null aunque el envío de más abajo no encuentre nada que
        // programar (p. ej. la cita ya quedó fuera de ventana): el id viejo
        // de todas formas ya no sirve.
        nuevos.r24h = null;
      }
      if (idActual1h) {
        try {
          await cancelarCorreo(idActual1h);
        } catch (e) {
          console.error("agenda/recordatorios: fallo cancelar el 1h viejo al recrear", e);
        }
        idActual1h = null;
        nuevos.r1h = null;
      }
    }

    const acciones = planificarRecordatorios({
      inicio: new Date(cita.inicio),
      ahora,
      idActual24h,
      idActual1h,
      citaCancelada: cita.estado === "cancelada",
    });

    const d = datosParaCorreo(cita);
    const guardar = (clase: Clase, valor: string | null) => {
      if (clase === "24h") nuevos.r24h = valor;
      else nuevos.r1h = valor;
    };

    for (const a of acciones) {
      try {
        if (a.tipo === "nada") continue;

        if (a.tipo === "cancelar") {
          await cancelarCorreo(a.emailId);
          // Un correo cancelado en Resend NO se puede reprogramar: el id deja
          // de servir para siempre, así que se borra de la fila.
          guardar(a.clase, null);
          continue;
        }

        if (a.tipo === "reprogramar") {
          await reprogramarCorreo(a.emailId, a.enviarA);
          continue; // el id no cambia
        }

        // A propósito SIN `bcc`: la copia interna para Alina y Alejandro es
        // solo para los transaccionales que salen por enviarAhora (email.ts)
        // — confirmación, reagendado, cancelación. Los recordatorios son 2
        // por cita y no agregan nada que el resumen diario y Telegram no
        // cubran ya; copiarlos también llenaría el buzón sin sentido. Ver el
        // porqué completo en el encabezado de agenda/copiaEquipo.ts.
        const { subject, html, attachments } = armarCorreo(CLASE_A_CORREO[a.clase], d);
        const id = await enviarCorreo({
          to: d.cliente_email,
          subject,
          html,
          attachments,
          cuando: a.enviarA,
        });
        guardar(a.clase, id);
      } catch (e) {
        console.error(`agenda/recordatorios: fallo la accion ${a.tipo} de ${a.clase}`, e);
        // Se deja en null para que el reconciliador lo vuelva a intentar.
        if (a.tipo === "programar") {
          guardar(a.clase, null);
        } else if (a.tipo === "reprogramar") {
          // I5: si el PATCH de reprogramar falla, el id sigue apuntando a un
          // envío programado a la hora VIEJA (el reconciliador del cron
          // solo actúa sobre ids en null, así que dejarlo como estaba lo
          // vuelve invisible para siempre — un huérfano que nadie repara).
          // Antes de soltarlo se intenta cancelar ese envío viejo en Resend,
          // en su propio try porque puede fallar también (p. ej. la misma
          // caída de Resend que hizo fallar el reprogramar): un segundo
          // fallo acá no debe frenar el guardar(null) de abajo. El costo de
          // este intercambio es, en el peor caso, un envío huérfano en
          // Resend con una hora vieja; la alternativa (dejar el id como
          // estaba) es que el cliente nunca reciba ningún recordatorio
          // nuevo, que es peor.
          try {
            await cancelarCorreo(a.emailId);
          } catch (e2) {
            console.error(
              `agenda/recordatorios: fallo cancelar el ${a.clase} huérfano tras el reprogramar fallido`,
              e2,
            );
          }
          guardar(a.clase, null);
        }
      }
    }

    await guardarIdsRecordatorio(cita.id, nuevos);
  } catch (e) {
    // Última red de seguridad: nada de esta función puede tirar hacia quien
    // llama (ver contrato en el comentario de arriba). Un fallo total acá
    // deja los ids como estaban; el reconciliador del cron los revisa igual.
    console.error("agenda/recordatorios: aplicarRecordatorios falló por completo", e);
  }
}
