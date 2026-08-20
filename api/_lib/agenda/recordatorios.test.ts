import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Cita } from "./db";

// aplicarRecordatorios llama a la API real de Resend y guarda en Supabase:
// para probar sus reglas sin red de por medio se mockean sus dos
// dependencias externas. `armarCorreo`/`datosParaCorreo` (de email.ts) se
// dejan reales: son puras y probarlas de punta a punta acá no cuesta nada.
const enviarCorreo = vi.fn();
const reprogramarCorreo = vi.fn();
const cancelarCorreo = vi.fn();
const guardarIdsRecordatorio = vi.fn();

vi.mock("./resend.js", () => ({
  enviarCorreo: (...a: unknown[]) => enviarCorreo(...a),
  reprogramarCorreo: (...a: unknown[]) => reprogramarCorreo(...a),
  cancelarCorreo: (...a: unknown[]) => cancelarCorreo(...a),
}));
vi.mock("./db.js", () => ({
  guardarIdsRecordatorio: (...a: unknown[]) => guardarIdsRecordatorio(...a),
}));

import { planificarRecordatorios, aplicarRecordatorios } from "./recordatorios";

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

const CITA_BASE: Cita = {
  id: "cita-1",
  cliente_nombre: "María",
  cliente_email: "maria@example.com",
  cliente_telefono: null,
  inicio: enDias(3).toISOString(),
  duracion_min: 60,
  lugar: "Llanada",
  lote_id: null,
  notas: null,
  estado: "agendada",
  ics_uid: "cita-abc@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "alinaramirezgamboa@gmail.com",
  created_at: "2026-08-18T10:00:00+00:00",
  updated_at: "2026-08-18T10:00:00+00:00",
};

describe("aplicarRecordatorios", () => {
  beforeEach(() => {
    enviarCorreo.mockReset();
    reprogramarCorreo.mockReset();
    cancelarCorreo.mockReset();
    guardarIdsRecordatorio.mockReset();
  });

  it("cita nueva a 3 días: programa los dos y guarda los ids", async () => {
    enviarCorreo.mockResolvedValueOnce("em_24").mockResolvedValueOnce("em_1");
    const cita: Cita = { ...CITA_BASE, inicio: enDias(3).toISOString() };

    await aplicarRecordatorios(cita, AHORA);

    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    const [opts24] = enviarCorreo.mock.calls[0];
    const [opts1] = enviarCorreo.mock.calls[1];
    expect(opts24.to).toBe("maria@example.com");
    expect(opts24.cuando.getTime()).toBeGreaterThan(AHORA.getTime());
    expect(opts1.to).toBe("maria@example.com");
    expect(opts1.cuando.getTime()).toBeGreaterThan(AHORA.getTime());
    expect(guardarIdsRecordatorio).toHaveBeenCalledWith("cita-1", { r24h: "em_24", r1h: "em_1" });
  });

  // Decisión de producto (no re-decidir): la copia interna en BCC es SOLO
  // para los transaccionales que salen por enviarAhora (email.ts) —
  // confirmación, reagendado, cancelación. Los recordatorios son 2 por cita
  // y no agregan nada que el resumen diario y Telegram no cubran ya; llevar
  // BCC acá llenaría el buzón de Alina y Alejandro sin sentido. Esta ruta
  // llama a enviarCorreo (resend.js) DIRECTO, sin pasar por enviarAhora, así
  // que no tiene ninguna oportunidad de agregar `bcc` — este test lo deja
  // explícito para que revertir esa separación se note en rojo.
  it("los recordatorios NO llevan BCC: la llamada a enviarCorreo no incluye la clave", async () => {
    enviarCorreo.mockResolvedValueOnce("em_24").mockResolvedValueOnce("em_1");
    const cita: Cita = { ...CITA_BASE, inicio: enDias(3).toISOString() };

    await aplicarRecordatorios(cita, AHORA);

    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    for (const [opts] of enviarCorreo.mock.calls) {
      expect("bcc" in opts).toBe(false);
    }
  });

  it("ruta del cron reconciliador (sin recrear): reprograma los existentes, no llama a enviarCorreo", async () => {
    // Esta es la ruta que usa el reconciliador del cron (api/cron/agenda.ts),
    // que llama a aplicarRecordatorios SIN `recrear` porque ahí el contenido
    // de la cita no cambió: solo se está reparando un id que había quedado
    // pendiente (p. ej. un fallo transitorio de Resend). Reprogramar (PATCH
    // que solo mueve `scheduled_at`) es correcto acá porque el asunto, el
    // cuerpo y el .ics ya reflejan la cita vigente.
    //
    // OJO: esto NO es lo que pasa cuando alguien mueve una cita desde el
    // panel — ese camino (api/agenda/citas.ts) SIEMPRE pasa `recrear: true`
    // cuando cambia algo visible, para que el contenido se regenere. Ver
    // citas.recrear-recordatorios.test.ts.
    const cita: Cita = {
      ...CITA_BASE,
      inicio: enDias(5).toISOString(),
      recordatorio_24h_email_id: "em_24",
      recordatorio_1h_email_id: "em_1",
    };

    await aplicarRecordatorios(cita, AHORA);

    expect(reprogramarCorreo).toHaveBeenCalledWith("em_24", expect.any(Date));
    expect(reprogramarCorreo).toHaveBeenCalledWith("em_1", expect.any(Date));
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("cancelar la cita: cancela ambos ids en Resend y los guarda en null", async () => {
    const cita: Cita = {
      ...CITA_BASE,
      estado: "cancelada",
      recordatorio_24h_email_id: "em_24",
      recordatorio_1h_email_id: "em_1",
    };

    await aplicarRecordatorios(cita, AHORA);

    expect(cancelarCorreo).toHaveBeenCalledWith("em_24");
    expect(cancelarCorreo).toHaveBeenCalledWith("em_1");
    expect(guardarIdsRecordatorio).toHaveBeenCalledWith("cita-1", { r24h: null, r1h: null });
  });

  it("recrear:true cancela los recordatorios viejos y crea dos nuevos con la dirección corregida", async () => {
    // Este es el caso del cambio obligatorio 2: el correo del cliente se
    // corrigió, y los dos recordatorios que apuntaban a la dirección vieja
    // tienen que dejar de existir y nacer de nuevo apuntando a la correcta.
    enviarCorreo.mockResolvedValueOnce("em_24_nuevo").mockResolvedValueOnce("em_1_nuevo");
    const cita: Cita = {
      ...CITA_BASE,
      cliente_email: "correcto@example.com",
      inicio: enDias(3).toISOString(),
      recordatorio_24h_email_id: "em_24_viejo",
      recordatorio_1h_email_id: "em_1_viejo",
    };

    await aplicarRecordatorios(cita, AHORA, { recrear: true });

    expect(cancelarCorreo).toHaveBeenCalledWith("em_24_viejo");
    expect(cancelarCorreo).toHaveBeenCalledWith("em_1_viejo");
    // Nada de reprogramar los viejos: deben ser envíos nuevos, con la
    // dirección corregida incrustada.
    expect(reprogramarCorreo).not.toHaveBeenCalled();
    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    expect(enviarCorreo.mock.calls[0][0].to).toBe("correcto@example.com");
    expect(enviarCorreo.mock.calls[1][0].to).toBe("correcto@example.com");
    expect(guardarIdsRecordatorio).toHaveBeenCalledWith("cita-1", {
      r24h: "em_24_nuevo",
      r1h: "em_1_nuevo",
    });
  });

  it("si enviarCorreo lanza, no propaga y deja los ids en null", async () => {
    enviarCorreo.mockRejectedValue(new Error("Resend 500"));
    const cita: Cita = { ...CITA_BASE, inicio: enDias(3).toISOString() };

    await expect(aplicarRecordatorios(cita, AHORA)).resolves.toBeUndefined();

    expect(guardarIdsRecordatorio).toHaveBeenCalledWith("cita-1", { r24h: null, r1h: null });
  });

  it("I5: si reprogramarCorreo falla, el id NO queda huérfano — se intenta cancelar y se deja en null", async () => {
    // Sin el arreglo, un reprogramar que falla deja el id viejo tal cual en
    // la fila. El cron reconciliador solo actúa sobre ids en null, así que
    // ese id nunca se vuelve a tocar: queda apuntando para siempre a un
    // envío programado a la hora VIEJA de la cita.
    reprogramarCorreo.mockRejectedValue(new Error("Resend 500"));
    cancelarCorreo.mockResolvedValue(undefined);
    const cita: Cita = {
      ...CITA_BASE,
      inicio: enDias(5).toISOString(),
      recordatorio_24h_email_id: "em_24",
      recordatorio_1h_email_id: "em_1",
    };

    await expect(aplicarRecordatorios(cita, AHORA)).resolves.toBeUndefined();

    // Se intenta dar de baja el envío viejo (huérfano en Resend, a la hora
    // que ya no corresponde) antes de soltarlo.
    expect(cancelarCorreo).toHaveBeenCalledWith("em_24");
    expect(cancelarCorreo).toHaveBeenCalledWith("em_1");
    // Y el id queda en null para que el reconciliador del cron lo recree.
    expect(guardarIdsRecordatorio).toHaveBeenCalledWith("cita-1", { r24h: null, r1h: null });
  });

  it("I5: si reprogramarCorreo Y el cancelarCorreo de rescate fallan, igual queda en null (no se pierde el rastro)", async () => {
    // Un segundo fallo (p. ej. la misma caída de Resend que hizo fallar el
    // reprogramar) no debe frenar el null: peor que un envío huérfano en
    // Resend es que el cliente no reciba nunca ningún recordatorio nuevo
    // porque el reconciliador ni se entera de que hace falta uno.
    reprogramarCorreo.mockRejectedValue(new Error("Resend 500"));
    cancelarCorreo.mockRejectedValue(new Error("Resend también caído acá"));
    const cita: Cita = {
      ...CITA_BASE,
      inicio: enDias(5).toISOString(),
      recordatorio_24h_email_id: "em_24",
      recordatorio_1h_email_id: "em_1",
    };

    await expect(aplicarRecordatorios(cita, AHORA)).resolves.toBeUndefined();

    expect(guardarIdsRecordatorio).toHaveBeenCalledWith("cita-1", { r24h: null, r1h: null });
  });
});
