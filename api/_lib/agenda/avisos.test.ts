import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Cita } from "./db";

// Mismo patrón de mock que el resto de api/_lib/agenda: `enviarMensaje` y
// `listarCitas` son espías directos; `supabaseAdmin().from("app_users")`
// resuelve con `.then()` (nunca llama `.single()`/`.maybeSingle()` — es un
// select llano), igual que la carga del historial en webhook.test.ts.
const enviarMensaje = vi.fn();
const listarCitas = vi.fn();
let respuestaAppUsers: { data: unknown[] | null; error: unknown };

vi.mock("./telegram.js", () => ({
  enviarMensaje: (...a: unknown[]) => enviarMensaje(...a),
}));
vi.mock("./db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
}));
vi.mock("../supabase.js", () => ({
  supabaseAdmin: () => ({
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cadena: any = {};
      cadena.select = vi.fn(() => cadena);
      cadena.eq = vi.fn(() => cadena);
      cadena.then = (onFulfilled: unknown, onRejected: unknown) =>
        Promise.resolve(respuestaAppUsers).then(
          onFulfilled as (v: unknown) => unknown,
          onRejected as (e: unknown) => unknown,
        );
      return cadena;
    },
  }),
}));

async function cargar() {
  vi.resetModules();
  return await import("./avisos");
}

beforeEach(() => {
  enviarMensaje.mockReset();
  listarCitas.mockReset();
  enviarMensaje.mockResolvedValue(1);
  listarCitas.mockResolvedValue([]);
  respuestaAppUsers = { data: [], error: null };
});

function cita(overrides: Partial<Cita> = {}): Cita {
  return {
    id: "cita-1",
    cliente_nombre: "María",
    cliente_email: "maria@example.com",
    cliente_telefono: null,
    inicio: "2026-09-01T16:00:00+00:00",
    duracion_min: 60,
    lugar: "Llanada",
    lote_id: null,
    notas: null,
    estado: "agendada",
    ics_uid: "cita-abc@ecovivadesarrollos.com",
    ics_secuencia: 0,
    recordatorio_24h_email_id: null,
    recordatorio_1h_email_id: null,
    creada_por: "actor@x.com",
    created_at: "2026-08-01T10:00:00+00:00",
    updated_at: "2026-08-01T10:00:00+00:00",
    ...overrides,
  };
}

const ACTOR = { email: "actor@x.com", full_name: "Alejandro", telegram_chat_id: "111" };
const COLEGA = { email: "colega@x.com", full_name: "Alina", telegram_chat_id: "222" };

describe("avisarCambio", () => {
  it("le manda a todos los que tienen agenda y Telegram vinculado, menos a quien lo hizo", async () => {
    respuestaAppUsers = { data: [ACTOR, COLEGA], error: null };
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("222", expect.any(String));
    const [, texto] = enviarMensaje.mock.calls[0];
    expect(texto).toMatch(/Alejandro creó una cita/);
    expect(texto).toMatch(/María — Llanada/);
  });

  it("compara el correo del actor sin distinguir mayúsculas de minúsculas", async () => {
    respuestaAppUsers = { data: [ACTOR, COLEGA], error: null };
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "movida", "Actor@X.com");

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("222", expect.any(String));
  });

  it("un usuario con agenda pero sin telegram_chat_id se saltea sin romper nada", async () => {
    respuestaAppUsers = {
      data: [ACTOR, { email: "sintelegram@x.com", full_name: "Sin Telegram", telegram_chat_id: null }],
      error: null,
    };
    const { avisarCambio } = await cargar();

    await expect(avisarCambio(cita(), "editada", "actor@x.com")).resolves.toBeUndefined();
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it("nunca tira si la consulta de destinatarios falla", async () => {
    respuestaAppUsers = { data: null, error: { message: "boom de postgres" } };
    const { avisarCambio } = await cargar();

    await expect(avisarCambio(cita(), "cancelada", "actor@x.com")).resolves.toBeUndefined();
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it("nunca tira si Telegram falla: se loguea y sigue, no tumba la operación", async () => {
    respuestaAppUsers = { data: [ACTOR, COLEGA], error: null };
    enviarMensaje.mockRejectedValue(new Error("Telegram caído"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { avisarCambio } = await cargar();

    await expect(avisarCambio(cita(), "creada", "actor@x.com")).resolves.toBeUndefined();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("con un solo destinatario vinculado y es quien actuó, no manda nada", async () => {
    respuestaAppUsers = { data: [ACTOR], error: null };
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");
    expect(enviarMensaje).not.toHaveBeenCalled();
  });
});

describe("resumenDiario", () => {
  it("manda las citas de hoy en hora de Costa Rica a cada persona vinculada", async () => {
    // 2026-08-19T04:00:00Z son las 22:00 del 18 de agosto en Costa Rica
    // (UTC-6 fijo): el "hoy" correcto es el 18, no el 19.
    const ahora = new Date("2026-08-19T04:00:00.000Z");
    const citaHoy = cita({ inicio: "2026-08-18T20:00:00+00:00" });
    listarCitas.mockResolvedValue([citaHoy]);
    respuestaAppUsers = { data: [ACTOR, COLEGA], error: null };
    const { resumenDiario } = await cargar();

    const n = await resumenDiario(ahora);

    expect(listarCitas).toHaveBeenCalledWith({
      desde: new Date("2026-08-18T06:00:00.000Z"),
      hasta: new Date("2026-08-19T05:59:59.999Z"),
    });
    expect(enviarMensaje).toHaveBeenCalledTimes(2);
    expect(enviarMensaje).toHaveBeenCalledWith("111", expect.stringContaining("María"));
    expect(enviarMensaje).toHaveBeenCalledWith("222", expect.stringContaining("Llanada"));
    expect(n).toBe(2);
  });

  it("con la agenda vacía manda un mensaje corto igual, para que se note que el cron corrió", async () => {
    listarCitas.mockResolvedValue([]);
    respuestaAppUsers = { data: [ACTOR], error: null };
    const { resumenDiario } = await cargar();

    const n = await resumenDiario(new Date("2026-08-19T11:00:00.000Z"));

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("111", "Hoy no hay citas.");
    expect(n).toBe(1);
  });

  it("cuenta solo los envíos que salieron: si uno falla, no se suma pero tampoco frena a los demás", async () => {
    listarCitas.mockResolvedValue([]);
    respuestaAppUsers = { data: [ACTOR, COLEGA], error: null };
    enviarMensaje.mockImplementation((chatId: string) =>
      chatId === "111" ? Promise.reject(new Error("Telegram caído")) : Promise.resolve(1),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { resumenDiario } = await cargar();

    const n = await resumenDiario(new Date("2026-08-19T11:00:00.000Z"));

    expect(enviarMensaje).toHaveBeenCalledTimes(2);
    expect(n).toBe(1);
    consoleError.mockRestore();
  });

  it("nunca tira: si listarCitas revienta, devuelve 0 en vez de propagar el error", async () => {
    listarCitas.mockRejectedValue(new Error("boom de postgres"));
    respuestaAppUsers = { data: [ACTOR], error: null };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { resumenDiario } = await cargar();

    await expect(resumenDiario(new Date())).resolves.toBe(0);
    expect(enviarMensaje).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
