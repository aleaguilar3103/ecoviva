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
