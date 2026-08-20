import { construirIcs } from "./ics.js";
import { enviarCorreo, type Adjunto } from "./resend.js";
import type { Cita } from "./db.js";

// Redacción de los correos al cliente.
//
// REGLA QUE NO SE ROMPE: el cuerpo se arma desde `DatosCorreo`, un subconjunto
// EXPLÍCITO de la cita, nunca desde la fila entera. Así, agregar mañana una
// columna interna a `citas` no puede filtrarla al cliente por descuido.
// `notas` y `cliente_telefono` no están en este tipo a propósito: son texto
// que Alina y Alejandro escriben para ellos mismos (p. ej. "regatea mucho, no
// bajar de X") y que el cliente jamás debe ver. Si en algún momento este
// archivo necesita más datos de la cita, se agregan campo por campo acá
// abajo — nunca pasando la `Cita` completa a `armarCorreo`.

export type ClaseCorreo =
  | "confirmacion"
  | "reagendado"
  | "cancelacion"
  | "recordatorio24h"
  | "recordatorio1h";

export interface DatosCorreo {
  cliente_nombre: string;
  cliente_email: string;
  inicio: string;
  duracion_min: number;
  lugar: string;
  ics_uid: string;
  ics_secuencia: number;
}

export function datosParaCorreo(cita: Cita): DatosCorreo {
  return {
    cliente_nombre: cita.cliente_nombre,
    cliente_email: cita.cliente_email,
    inicio: cita.inicio,
    duracion_min: cita.duracion_min,
    lugar: cita.lugar,
    ics_uid: cita.ics_uid,
    ics_secuencia: cita.ics_secuencia,
  };
}

const TZ = "America/Costa_Rica";

// M-8: `cliente_nombre` y `lugar` son texto libre — sale de lo que la persona
// tipea en el panel o de lo que el modelo produce desde un mensaje de
// Telegram— y entraban crudos al HTML del correo. No es una fuga de datos
// internos (eso lo sostiene DatosCorreo, arriba), pero un `<` o unas comillas
// en un nombre de lugar —"Lomas <Etapa 2>"— rompen el correo del cliente en
// silencio: el cliente de correo se come el resto como si fuera una etiqueta.
// El .ics ya escapaba lo suyo (ics.ts, con las reglas de RFC 5545); esto es su
// equivalente para HTML. Todo lo demás que entra a estas plantillas
// (fechas y horas de Intl, la URL de Google armada con URLSearchParams) ya
// viene de generadores que no producen estos caracteres.
function escaparHtml(txt: string): string {
  return txt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// M-a: Intl.DateTimeFormat en es-CR devuelve el día de la semana en
// minúscula ("martes, 1 de septiembre de 2026"), como corresponde en
// español. `capitalizar` sube la primera letra para los usos como TÍTULO
// (el bloque de datos de la cita, o después de un guión largo en el
// asunto). Cuando la fecha va A MITAD DE ORACIÓN ("tu cita ahora es el
// martes…", "cancelamos la cita del martes…") hay que dejarla en minúscula:
// en español los días no van en mayúscula ahí, y es texto que lee el
// cliente.
function fechaLarga(iso: string, capitalizar = true): string {
  const t = new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
  return capitalizar ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(new Date(iso));
}

// Enlace de "Agregar a Google Calendar". El adjunto .ics cubre Apple y Outlook;
// esto cubre Gmail, que es donde va a estar la mayoría de los clientes.
function enlaceGoogle(d: DatosCorreo): string {
  const ini = new Date(d.inicio);
  const fin = new Date(ini.getTime() + d.duracion_min * 60_000);
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Cita con EcoViva — ${d.lugar}`,
    dates: `${fmt(ini)}/${fmt(fin)}`,
    details: "Cita coordinada con EcoViva Desarrollos.",
    location: d.lugar,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function envoltura(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#059669;margin:0 0 8px">EcoViva Desarrollos</p>
  <h1 style="font-size:22px;color:#0f172a;margin:0 0 20px">${titulo}</h1>
  ${cuerpo}
  <p style="font-size:12px;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px">
    Si necesitás cambiar la cita, respondé este correo.
  </p>
</div></body></html>`;
}

function bloqueDatos(d: DatosCorreo): string {
  return `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
  <tr><td style="padding:16px 20px">
    <p style="margin:0 0 4px;font-size:16px;color:#0f172a"><strong>${fechaLarga(d.inicio)}</strong></p>
    <p style="margin:0 0 12px;font-size:16px;color:#0f172a">${hora(d.inicio)}</p>
    <p style="margin:0;font-size:14px;color:#475569">${escaparHtml(d.lugar)}</p>
  </td></tr></table>`;
}

function botonGoogle(d: DatosCorreo): string {
  return `<p style="margin:20px 0">
    <a href="${enlaceGoogle(d)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">
      Agregar a Google Calendar
    </a>
  </p>
  <p style="font-size:12px;color:#94a3b8;margin:0">
    ¿Usás iPhone o Outlook? Abrí el archivo <strong>cita.ics</strong> adjunto.
  </p>`;
}

function adjuntoIcs(d: DatosCorreo, cancelado: boolean): Adjunto[] {
  const ics = construirIcs({
    uid: d.ics_uid,
    secuencia: d.ics_secuencia,
    inicio: new Date(d.inicio),
    duracionMin: d.duracion_min,
    titulo: `Cita con EcoViva — ${d.lugar}`,
    descripcion: "Cita coordinada con EcoViva Desarrollos.",
    lugar: d.lugar,
    organizadorNombre: "EcoViva Desarrollos",
    organizadorEmail: "noreply@send.bralto.io",
    asistenteNombre: d.cliente_nombre,
    asistenteEmail: d.cliente_email,
    cancelado,
  });
  return [
    {
      filename: "cita.ics",
      content: Buffer.from(ics, "utf8").toString("base64"),
      contentType: "text/calendar",
    },
  ];
}

export function armarCorreo(
  clase: ClaseCorreo,
  d: DatosCorreo,
): { subject: string; html: string; attachments: Adjunto[] } {
  const nombre = escaparHtml(d.cliente_nombre.split(" ")[0]);

  switch (clase) {
    case "confirmacion":
      return {
        subject: `Tu cita con EcoViva — ${fechaLarga(d.inicio)}, ${hora(d.inicio)}`,
        html: envoltura(
          "Tu cita quedó agendada",
          `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, te esperamos:</p>
          ${bloqueDatos(d)}${botonGoogle(d)}`,
        ),
        attachments: adjuntoIcs(d, false),
      };

    case "reagendado":
      return {
        subject: `Cambio de hora: tu cita ahora es el ${fechaLarga(d.inicio, false)}`,
        html: envoltura(
          "Cambiamos la hora de tu cita",
          `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, tu cita quedó reprogramada:</p>
          ${bloqueDatos(d)}
          <p style="font-size:13px;color:#475569">Si ya la tenías en tu calendario, se actualiza sola al abrir el archivo adjunto.</p>
          ${botonGoogle(d)}`,
        ),
        attachments: adjuntoIcs(d, false),
      };

    case "cancelacion":
      return {
        subject: `Cita cancelada — ${fechaLarga(d.inicio)}`,
        html: envoltura(
          "Tu cita fue cancelada",
          `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, cancelamos la cita del ${fechaLarga(d.inicio, false)} a las ${hora(d.inicio)}.</p>
          <p style="font-size:15px;color:#334155">Si querés reprogramarla, respondé este correo y la coordinamos.</p>`,
        ),
        attachments: adjuntoIcs(d, true),
      };

    case "recordatorio24h":
      return {
        subject: `Mañana: tu cita con EcoViva a las ${hora(d.inicio)}`,
        html: envoltura(
          "Tu cita es mañana",
          `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, te recordamos:</p>
          ${bloqueDatos(d)}${botonGoogle(d)}`,
        ),
        attachments: adjuntoIcs(d, false),
      };

    case "recordatorio1h":
      // Un ping. Sin adjunto: a esta altura ya lo tiene en el calendario o ya no le sirve.
      return {
        subject: `En una hora: tu cita con EcoViva`,
        html: envoltura(
          "Tu cita es en una hora",
          `
          <p style="font-size:15px;color:#334155">Hola ${nombre}, nos vemos a las ${hora(d.inicio)} en ${escaparHtml(d.lugar)}.</p>`,
        ),
        attachments: [],
      };
  }
}

// Envío inmediato (confirmación, reagendado, cancelación). Los recordatorios
// programados no pasan por acá: se agendan con `enviarCorreo({ cuando })`
// desde donde se decida la hora exacta de disparo.
export async function enviarAhora(clase: ClaseCorreo, cita: Cita): Promise<void> {
  const d = datosParaCorreo(cita);
  const { subject, html, attachments } = armarCorreo(clase, d);
  await enviarCorreo({ to: d.cliente_email, subject, html, attachments });
}
