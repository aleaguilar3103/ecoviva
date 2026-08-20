import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  esPasadaOCompletada,
  claveDiaCR,
  isoDesdeLocalCR,
  localCRDesdeIso,
  grillaDelMes,
} from "./fechas";
import type { CitaRow } from "../../../lib/adminApi";

// Fila mínima con los campos que usa esPasadaOCompletada; el resto no le
// importa a la función.
const CITA_BASE: CitaRow = {
  id: "cita-1",
  cliente_nombre: "María",
  cliente_email: "maria@example.com",
  cliente_telefono: null,
  inicio: "2026-09-01T16:00:00.000Z", // 10:00 a.m. de Costa Rica
  duracion_min: 60,
  lugar: "Llanada",
  lote_id: null,
  notas: null,
  estado: "agendada",
  creada_por: "alina@ecoviva.com",
};

describe("esPasadaOCompletada (N3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("una cita 'agendada' que ya empezó pero no ha terminado NO está pasada", () => {
    // Cita de 10:00 a 11:00; son las 10:01 — arrancó hace un minuto.
    vi.setSystemTime(new Date("2026-09-01T16:01:00.000Z"));
    expect(esPasadaOCompletada(CITA_BASE)).toBe(false);
  });

  it("una cita 'agendada' que ya terminó SÍ está pasada", () => {
    // Cita de 10:00 a 11:00; son las 11:01 — ya terminó.
    vi.setSystemTime(new Date("2026-09-01T17:01:00.000Z"));
    expect(esPasadaOCompletada(CITA_BASE)).toBe(true);
  });

  it("una cita 'completada' está pasada sin importar la hora", () => {
    vi.setSystemTime(new Date("2026-09-01T16:00:00.000Z"));
    expect(esPasadaOCompletada({ ...CITA_BASE, estado: "completada" })).toBe(true);
  });
});

describe("claveDiaCR — en qué casilla del calendario cae una cita", () => {
  it("una cita de las 11 p.m. de Costa Rica cae en el día tico, no en el del día siguiente en UTC", () => {
    // 2026-08-30 23:00 en Costa Rica es 2026-08-31 05:00 UTC. Tomar la fecha
    // del ISO tal cual la pondría el 31: un día después del que la persona
    // agendó, en la casilla equivocada del mes.
    expect(claveDiaCR("2026-08-31T05:00:00.000Z")).toBe("2026-08-30");
  });

  it("una cita de la madrugada tica no se corre al día anterior", () => {
    // 2026-08-30 01:00 CR = 2026-08-30 07:00 UTC.
    expect(claveDiaCR("2026-08-30T07:00:00.000Z")).toBe("2026-08-30");
  });

  it("el mediodía tico cae en su propio día", () => {
    expect(claveDiaCR("2026-08-30T18:00:00.000Z")).toBe("2026-08-30");
  });
});

describe("isoDesdeLocalCR / localCRDesdeIso — ida y vuelta del formulario", () => {
  it("lo que se escribe en el formulario es lo que se guarda, interpretado en hora tica", () => {
    // El input dice "30 de agosto, 11:00". En Costa Rica eso es 17:00 UTC.
    expect(isoDesdeLocalCR("2026-08-30T11:00")).toBe("2026-08-30T17:00:00.000Z");
  });

  it("volver del ISO al formulario devuelve exactamente lo mismo", () => {
    const escrito = "2026-08-30T11:00";
    expect(localCRDesdeIso(isoDesdeLocalCR(escrito))).toBe(escrito);
  });

  it("no depende del huso del equipo: un ISO de las 23:00 ticas vuelve como 23:00", () => {
    expect(localCRDesdeIso("2026-08-31T05:00:00.000Z")).toBe("2026-08-30T23:00");
  });
});

describe("grillaDelMes", () => {
  it("siempre devuelve 42 días, para que el calendario no cambie de alto al pasar de mes", () => {
    expect(grillaDelMes(new Date(Date.UTC(2026, 7, 1, 12))).length).toBe(42);
    expect(grillaDelMes(new Date(Date.UTC(2026, 1, 1, 12))).length).toBe(42);
  });

  it("arranca en lunes", () => {
    // Agosto 2026 arranca en sábado, así que la grilla debe empezar el lunes
    // 27 de julio.
    const g = grillaDelMes(new Date(Date.UTC(2026, 7, 1, 12)));
    expect(g[0].clave).toBe("2026-07-27");
    expect(g[0].delMes).toBe(false);
  });

  it("marca como del mes solo los días que le pertenecen", () => {
    const g = grillaDelMes(new Date(Date.UTC(2026, 7, 1, 12)));
    const delMes = g.filter((d) => d.delMes);
    expect(delMes.length).toBe(31); // agosto
    expect(delMes[0].clave).toBe("2026-08-01");
    expect(delMes[30].clave).toBe("2026-08-31");
  });
});
