// Construcción de archivos .ics (RFC 5545). Función pura, sin dependencias:
// son unas 60 líneas y meter una librería para esto no se paga.
//
// Las tres cosas que rompen un .ics en silencio y que acá se hacen a propósito:
//   1. Plegado de líneas a 75 OCTETOS (no caracteres), sin partir un carácter
//      multibyte por la mitad.
//   2. Escape de \ ; , y saltos de línea en los campos de texto.
//   3. Horas en UTC con Z, para no tener que embutir un bloque VTIMEZONE.
//      Costa Rica es UTC−6 fijo, sin horario de verano.

export interface EventoIcs {
  uid: string;
  secuencia: number;
  inicio: Date;
  duracionMin: number;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  organizadorNombre: string;
  organizadorEmail: string;
  asistenteNombre: string;
  asistenteEmail: string;
  cancelado?: boolean;
  ahora?: Date; // inyectable para que los tests sean deterministas
}

function utc(d: Date): string {
  // 2026-09-01T16:00:00.000Z → 20260901T160000Z
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapar(v: string): string {
  // El backslash va primero o se re-escaparían los que agregan los demás.
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// M-e: RFC 5545 §3.2 define param-value como paramtext (texto simple) O
// quoted-string (DQUOTE QSAFE-CHAR* DQUOTE) — nunca backslash-escaping, que
// es la regla de los campos de CONTENIDO (SUMMARY, DESCRIPTION...), no la de
// los parámetros como CN=. Aplicarle `escapar()` a un valor de parámetro con
// coma —"Rodríguez Mora, Ana", que la gente pega tal cual— produce
// CN=Rodríguez Mora\, Ana sin comillas: sintaxis inválida que un parser
// estricto puede rechazar (a veces descartando el evento entero).
//
// El RFC no define ninguna forma de escapar una comilla doble DENTRO de un
// quoted-string, así que la única salida segura es quitarlas del valor.
function escaparParametro(v: string): string {
  const sinComillas = v.replace(/"/g, "");
  return /[,;:]/.test(sinComillas) ? `"${sinComillas}"` : sinComillas;
}

function plegar(linea: string): string {
  const bytes = Buffer.from(linea, "utf8");
  if (bytes.length <= 75) return linea;

  const partes: string[] = [];
  let i = 0;
  let primera = true;
  while (i < bytes.length) {
    // Las continuaciones llevan un espacio inicial que también cuenta.
    const max = primera ? 75 : 74;
    let fin = Math.min(i + max, bytes.length);
    // Retroceder hasta el inicio de un carácter: 0b10xxxxxx es continuación UTF-8.
    while (fin > i + 1 && fin < bytes.length && (bytes[fin] & 0xc0) === 0x80) fin--;
    partes.push((primera ? "" : " ") + bytes.subarray(i, fin).toString("utf8"));
    i = fin;
    primera = false;
  }
  return partes.join("\r\n");
}

export function construirIcs(e: EventoIcs): string {
  const fin = new Date(e.inicio.getTime() + e.duracionMin * 60_000);
  const metodo = e.cancelado ? "CANCEL" : "REQUEST";

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EcoViva Desarrollos//Agenda//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${metodo}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utc(e.ahora ?? new Date())}`,
    `DTSTART:${utc(e.inicio)}`,
    `DTEND:${utc(fin)}`,
    `SEQUENCE:${e.secuencia}`,
    `SUMMARY:${escapar(e.titulo)}`,
    ...(e.descripcion ? [`DESCRIPTION:${escapar(e.descripcion)}`] : []),
    ...(e.lugar ? [`LOCATION:${escapar(e.lugar)}`] : []),
    `ORGANIZER;CN=${escaparParametro(e.organizadorNombre)}:mailto:${e.organizadorEmail}`,
    `ATTENDEE;CN=${escaparParametro(e.asistenteNombre)};RSVP=FALSE:mailto:${e.asistenteEmail}`,
    `STATUS:${e.cancelado ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lineas.map(plegar).join("\r\n") + "\r\n";
}
