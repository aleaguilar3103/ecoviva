import { describe, it, expect } from "vitest";
import { datosParaCorreo, armarCorreo, type ClaseCorreo } from "./email";
import type { Cita } from "./db";

// Token deliberadamente imposible de aparecer por accidente en un correo real:
// mezcla letras, números y un prefijo que no es vocabulario de EcoViva. Si
// esta cadena aparece en un asunto o HTML, es porque el código filtró la nota
// interna, no porque haya coincidido con texto legítimo.
const NOTA_SECRETA = "NO-MOSTRAR-AL-CLIENTE-8f14e45fceea: regatea mucho, no bajar de 45000";
// Dígitos del teléfono interno, igual de improbables de aparecer por azar.
const TELEFONO_SECRETO = "88887777";

const CITA: Cita = {
  id: "cita-1",
  cliente_nombre: "María Rodríguez",
  cliente_email: "maria@example.com",
  cliente_telefono: `+506${TELEFONO_SECRETO}`,
  inicio: "2026-09-01T16:00:00.000Z",
  duracion_min: 60,
  lugar: "Visita Lomas de la Llanada",
  lote_id: null,
  notas: NOTA_SECRETA,
  estado: "agendada",
  ics_uid: "cita-abc@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "alinaramirezgamboa@gmail.com",
  created_at: "2026-08-19T12:00:00.000Z",
  updated_at: "2026-08-19T12:00:00.000Z",
};

const CLASES_CORREO: ClaseCorreo[] = [
  "confirmacion",
  "reagendado",
  "cancelacion",
  "recordatorio24h",
  "recordatorio1h",
];

describe("datosParaCorreo", () => {
  it("no deja pasar las notas internas ni el teléfono", () => {
    const d = datosParaCorreo(CITA);
    expect(JSON.stringify(d)).not.toContain(NOTA_SECRETA);
    expect(JSON.stringify(d)).not.toContain(TELEFONO_SECRETO);
    expect("notas" in d).toBe(false);
    expect("cliente_telefono" in d).toBe(false);
  });
});

describe("armarCorreo", () => {
  const d = datosParaCorreo(CITA);

  it("la confirmación lleva el .ics y el botón de Google Calendar", () => {
    const { subject, html, attachments } = armarCorreo("confirmacion", d);
    expect(subject).toContain("cita");
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe("cita.ics");
    const ics = Buffer.from(attachments[0].content, "base64").toString("utf8");
    expect(ics).toContain("METHOD:REQUEST");
    expect(html).toContain("calendar.google.com/calendar/render");
  });

  // Test que cubre las cinco clases de correo (confirmación, reagendado,
  // cancelación, recordatorio 24h, recordatorio 1h) y revisa TODO lo que sale
  // hacia el cliente: asunto, HTML y también el contenido del .ics adjunto
  // (por si algún día alguien mete la descripción de la cita ahí). La nota y
  // el teléfono nacen en `CITA`, la fila cruda con el campo interno — nunca
  // se los "limpia" a mano antes de pasarlos por `datosParaCorreo`.
  it("ninguna de las cinco clases de correo expone las notas internas ni el teléfono", () => {
    for (const clase of CLASES_CORREO) {
      const { subject, html, attachments } = armarCorreo(clase, d);
      expect(subject).not.toContain(NOTA_SECRETA);
      expect(html).not.toContain(NOTA_SECRETA);
      expect(subject).not.toContain(TELEFONO_SECRETO);
      expect(html).not.toContain(TELEFONO_SECRETO);
      for (const adjunto of attachments) {
        const contenido = Buffer.from(adjunto.content, "base64").toString("utf8");
        expect(contenido).not.toContain(NOTA_SECRETA);
        expect(contenido).not.toContain(TELEFONO_SECRETO);
      }
    }
  });

  it("la cancelación adjunta un .ics de CANCEL", () => {
    const { attachments } = armarCorreo("cancelacion", { ...d, ics_secuencia: 2 });
    const ics = Buffer.from(attachments[0].content, "base64").toString("utf8");
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("el recordatorio de 1 hora no lleva adjunto: es un ping", () => {
    const { attachments } = armarCorreo("recordatorio1h", d);
    expect(attachments).toHaveLength(0);
  });

  it("muestra la hora de Costa Rica, no UTC", () => {
    // 16:00Z son las 10:00 a.m. en Costa Rica (UTC-6, sin horario de verano).
    const { html } = armarCorreo("confirmacion", d);
    expect(html).toContain("10:00");
    expect(html).not.toContain("16:00");
  });
});
