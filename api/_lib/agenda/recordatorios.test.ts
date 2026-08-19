import { describe, it, expect } from "vitest";
import { planificarRecordatorios } from "./recordatorios";

const AHORA = new Date("2026-08-19T12:00:00.000Z");
const enDias = (d: number) => new Date(AHORA.getTime() + d * 24 * 60 * 60_000);
const enHoras = (h: number) => new Date(AHORA.getTime() + h * 60 * 60_000);

function accion(as: ReturnType<typeof planificarRecordatorios>, clase: "24h" | "1h") {
  return as.find((a) => a.clase === clase)!;
}

describe("planificarRecordatorios", () => {
  it("cita en 3 días sin nada programado: programa los dos", () => {
    const as = planificarRecordatorios({
      inicio: enDias(3), ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("programar");
    expect(accion(as, "1h").tipo).toBe("programar");
  });

  it("calcula bien los instantes de envío", () => {
    const inicio = enDias(3);
    const as = planificarRecordatorios({
      inicio, ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    const a24 = accion(as, "24h") as { enviarA: Date };
    const a1 = accion(as, "1h") as { enviarA: Date };
    expect(a24.enviarA.getTime()).toBe(inicio.getTime() - 24 * 60 * 60_000);
    expect(a1.enviarA.getTime()).toBe(inicio.getTime() - 60 * 60_000);
  });

  it("cita en 6 horas: el de 24h ya no aplica, el de 1h sí", () => {
    const as = planificarRecordatorios({
      inicio: enHoras(6), ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("programar");
  });

  it("cita en 30 minutos: ninguno aplica", () => {
    const as = planificarRecordatorios({
      inicio: new Date(AHORA.getTime() + 30 * 60_000),
      ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("nada");
  });

  it("cita a más de 30 días: quedan pendientes para el cron", () => {
    const as = planificarRecordatorios({
      inicio: enDias(45), ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("nada");
  });

  it("reagendar dentro de la ventana: reprograma los existentes", () => {
    const as = planificarRecordatorios({
      inicio: enDias(5), ahora: AHORA, idActual24h: "em_24", idActual1h: "em_1",
    });
    const a24 = accion(as, "24h");
    expect(a24.tipo).toBe("reprogramar");
    expect((a24 as { emailId: string }).emailId).toBe("em_24");
  });

  it("reagendar fuera de la ventana: cancela los existentes", () => {
    const as = planificarRecordatorios({
      inicio: enDias(60), ahora: AHORA, idActual24h: "em_24", idActual1h: "em_1",
    });
    expect(accion(as, "24h").tipo).toBe("cancelar");
    expect(accion(as, "1h").tipo).toBe("cancelar");
  });

  it("mover una cita a dentro de 6 horas cancela el de 24h y reprograma el de 1h", () => {
    const as = planificarRecordatorios({
      inicio: enHoras(6), ahora: AHORA, idActual24h: "em_24", idActual1h: "em_1",
    });
    expect(accion(as, "24h").tipo).toBe("cancelar");
    expect(accion(as, "1h").tipo).toBe("reprogramar");
  });

  it("cancelar la cita cancela todo lo programado", () => {
    const as = planificarRecordatorios({
      inicio: enDias(3), ahora: AHORA,
      idActual24h: "em_24", idActual1h: "em_1", citaCancelada: true,
    });
    expect(accion(as, "24h").tipo).toBe("cancelar");
    expect(accion(as, "1h").tipo).toBe("cancelar");
  });

  it("cancelar una cita que no tenía nada programado no hace nada", () => {
    const as = planificarRecordatorios({
      inicio: enDias(3), ahora: AHORA,
      idActual24h: null, idActual1h: null, citaCancelada: true,
    });
    expect(accion(as, "24h").tipo).toBe("nada");
    expect(accion(as, "1h").tipo).toBe("nada");
  });

  it("no programa nada a menos de 2 minutos de distancia", () => {
    // El margen evita que Resend rechace un scheduled_at que ya quedó en el
    // pasado entre que se calcula y se manda la petición.
    const as = planificarRecordatorios({
      inicio: new Date(AHORA.getTime() + 61 * 60_000), // el de 1h caería en 1 min
      ahora: AHORA, idActual24h: null, idActual1h: null,
    });
    expect(accion(as, "1h").tipo).toBe("nada");
  });
});
