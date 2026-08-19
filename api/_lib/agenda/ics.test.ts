import { describe, it, expect } from "vitest";
import { construirIcs } from "./ics";

const BASE = {
  uid: "cita-abc@ecovivadesarrollos.com",
  secuencia: 0,
  inicio: new Date("2026-09-01T16:00:00.000Z"), // 10:00 a.m. de Costa Rica
  duracionMin: 60,
  titulo: "Visita a Lomas de la Llanada",
  organizadorNombre: "EcoViva Desarrollos",
  organizadorEmail: "noreply@send.bralto.io",
  asistenteNombre: "María Rodríguez",
  asistenteEmail: "maria@example.com",
  ahora: new Date("2026-08-19T12:00:00.000Z"),
};

describe("construirIcs", () => {
  it("emite las horas en UTC con Z", () => {
    const ics = construirIcs(BASE);
    expect(ics).toContain("DTSTART:20260901T160000Z");
    expect(ics).toContain("DTEND:20260901T170000Z");
    expect(ics).not.toContain("VTIMEZONE");
  });

  it("usa CRLF y termina con salto de línea", () => {
    const ics = construirIcs(BASE);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapa comas, punto y coma, backslash y saltos de línea", () => {
    const ics = construirIcs({
      ...BASE,
      titulo: "Visita, con coma; y punto y coma",
      descripcion: "Primera línea\nSegunda línea con \\ backslash",
    });
    // Punto y coma escapado como \; (barra invertida + punto y coma), no como ; a secas.
    expect(ics).toContain("SUMMARY:Visita\\, con coma\\; y punto y coma");
    expect(ics).toContain("Primera línea\\nSegunda línea con \\\\ backslash");
  });

  it("escapa el punto y coma como \\; y no lo deja sin escapar", () => {
    // Test discriminante: con el bug del brief (regex .replace(/;/g, "\;"))
    // "\;" evalúa a ";" en JS, así que el replace es un no-op y el punto y
    // coma sale crudo. Este test falla con esa implementación y pasa con la
    // correcta ("\\;" en el fuente, que evalúa a "\;").
    const ics = construirIcs({ ...BASE, titulo: "Antes; Después" });
    expect(ics).toContain("SUMMARY:Antes\\; Después");
    expect(ics).not.toContain("SUMMARY:Antes; Después");
  });

  it("pliega las líneas largas a 75 octetos con espacio inicial", () => {
    const ics = construirIcs({ ...BASE, titulo: "A".repeat(200) });
    const lineas = ics.split("\r\n");
    for (const l of lineas) {
      expect(Buffer.from(l, "utf8").length).toBeLessThanOrEqual(75);
    }
    // Las continuaciones arrancan con un espacio.
    const idx = lineas.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(lineas[idx + 1].startsWith(" ")).toBe(true);
  });

  it("no parte un carácter multibyte al plegar", () => {
    // 80 eñes: cada una son 2 bytes en UTF-8, así que el corte cae justo en medio
    // de un carácter si el plegado cuenta caracteres en vez de octetos.
    const ics = construirIcs({ ...BASE, titulo: "ñ".repeat(80) });
    expect(ics).not.toContain("�"); // ningún carácter de reemplazo
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:" + "ñ".repeat(80));
  });

  it("al cancelar usa METHOD:CANCEL y STATUS:CANCELLED", () => {
    const ics = construirIcs({ ...BASE, secuencia: 3, cancelado: true });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:3");
  });

  it("al crear y reagendar usa METHOD:REQUEST con el mismo UID", () => {
    const creada = construirIcs(BASE);
    const movida = construirIcs({
      ...BASE,
      secuencia: 1,
      inicio: new Date("2026-09-02T16:00:00.000Z"),
    });
    expect(creada).toContain("METHOD:REQUEST");
    expect(movida).toContain("METHOD:REQUEST");
    expect(creada).toContain(`UID:${BASE.uid}`);
    expect(movida).toContain(`UID:${BASE.uid}`);
    expect(creada).toContain("SEQUENCE:0");
    expect(movida).toContain("SEQUENCE:1");
  });
});
