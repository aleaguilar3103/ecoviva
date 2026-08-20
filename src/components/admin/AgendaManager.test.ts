import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { esPasadaOCompletada } from "./AgendaManager";
import type { CitaRow } from "../../lib/adminApi";

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
