import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Cita } from "./db";

// Mismo patrón de mock que el resto de api/_lib/agenda: `enviarMensaje` y
// `listarCitas` son espías directos.
//
// M-1 (revisión final): el mock de `app_users` ANTES descartaba los
// argumentos de `.eq()` y devolvía una respuesta fija. Con eso, borrar el
// filtro entero de `destinatarios()` —convirtiendo el aviso en un broadcast a
// toda la tabla— dejaba estos tests en verde: es exactamente lo que dejó
// pasar C-1. Ahora el mock modela app_users como una TABLA de verdad: guarda
// cada `.eq(campo, valor)` y `.then()` aplica esos filtros sobre las filas.
// Un filtro que falta se nota porque la fila que no debería salir, sale.
let filasAppUsers: Record<string, unknown>[];
let errorAppUsers: unknown;
const eqSpy = vi.fn();
const selectSpy = vi.fn();

const enviarMensaje = vi.fn();
const listarCitas = vi.fn();

vi.mock("./telegram.js", () => ({
  enviarMensaje: (...a: unknown[]) => enviarMensaje(...a),
}));
vi.mock("./db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
}));
vi.mock("../supabase.js", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const filtros: { campo: string; valor: unknown }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cadena: any = {};
      cadena.select = vi.fn((columnas: string) => {
        selectSpy(columnas);
        return cadena;
      });
      cadena.eq = vi.fn((campo: string, valor: unknown) => {
        eqSpy(campo, valor);
        filtros.push({ campo, valor });
        return cadena;
      });
      cadena.then = (onFulfilled: unknown, onRejected: unknown) => {
        const respuesta = errorAppUsers
          ? { data: null, error: errorAppUsers }
          : {
              data: filasAppUsers.filter((f) => filtros.every((flt) => f[flt.campo] === flt.valor)),
              error: null,
            };
        return Promise.resolve(respuesta).then(
          onFulfilled as (v: unknown) => unknown,
          onRejected as (e: unknown) => unknown,
        );
      };
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
  eqSpy.mockReset();
  selectSpy.mockReset();
  filasAppUsers = [];
  errorAppUsers = null;
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

// Las filas llevan las tres columnas de la regla de acceso (role, status,
// agenda) además de los datos de contacto: son las que `destinatarios()`
// tiene que exigir para no mandarle datos de clientes a quien ya no debería
// verlos (C-1).
const ACTOR = {
  email: "actor@x.com",
  full_name: "Alejandro",
  telegram_chat_id: "111",
  role: "admin",
  status: "active",
  agenda: true,
};
const COLEGA = {
  email: "colega@x.com",
  full_name: "Alina",
  telegram_chat_id: "222",
  role: "admin",
  status: "active",
  agenda: true,
};

describe("avisarCambio", () => {
  it("le manda a todos los que tienen agenda y Telegram vinculado, menos a quien lo hizo", async () => {
    filasAppUsers = [ACTOR, COLEGA];
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("222", expect.any(String));
    const [, texto] = enviarMensaje.mock.calls[0];
    expect(texto).toMatch(/Alejandro creó una cita/);
    expect(texto).toMatch(/María — Llanada/);
  });

  it("compara el correo del actor sin distinguir mayúsculas de minúsculas", async () => {
    filasAppUsers = [ACTOR, COLEGA];
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "movida", "Actor@X.com");

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("222", expect.any(String));
  });

  it("un usuario con agenda pero sin telegram_chat_id se saltea sin romper nada", async () => {
    filasAppUsers = [
      ACTOR,
      { ...COLEGA, email: "sintelegram@x.com", full_name: "Sin Telegram", telegram_chat_id: null },
    ];
    const { avisarCambio } = await cargar();

    await expect(avisarCambio(cita(), "editada", "actor@x.com")).resolves.toBeUndefined();
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it("nunca tira si la consulta de destinatarios falla", async () => {
    errorAppUsers = { message: "boom de postgres" };
    const { avisarCambio } = await cargar();

    await expect(avisarCambio(cita(), "cancelada", "actor@x.com")).resolves.toBeUndefined();
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it("nunca tira si Telegram falla: se loguea y sigue, no tumba la operación", async () => {
    filasAppUsers = [ACTOR, COLEGA];
    enviarMensaje.mockRejectedValue(new Error("Telegram caído"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { avisarCambio } = await cargar();

    await expect(avisarCambio(cita(), "creada", "actor@x.com")).resolves.toBeUndefined();
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("con un solo destinatario vinculado y es quien actuó, no manda nada", async () => {
    filasAppUsers = [ACTOR];
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  // ── C-1: la revocación desde el panel tiene que cortar TAMBIÉN el aviso ──
  //
  // Deshabilitar o degradar a alguien desde la pestaña Usuarios es el único
  // botón que el producto ofrece para revocarle el acceso. Si `destinatarios()`
  // solo mirara `agenda`, esa persona seguiría recibiendo en su Telegram
  // personal el nombre, el teléfono y el lugar de cada cliente, para siempre
  // — y no habría forma de cortarlo desde el producto.
  it("a quien tiene agenda=true pero status='disabled' NO se le manda el aviso", async () => {
    filasAppUsers = [ACTOR, { ...COLEGA, status: "disabled" }];
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it("a quien tiene agenda=true pero role='vendedor' NO se le manda el aviso", async () => {
    filasAppUsers = [ACTOR, { ...COLEGA, role: "vendedor" }];
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it("a quien tiene role y status bien pero agenda=false tampoco", async () => {
    filasAppUsers = [ACTOR, { ...COLEGA, agenda: false }];
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");
    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  // M-1: los argumentos del filtro sí se verifican. Sin esto, borrar una
  // condición de la consulta pasa desapercibido en cuanto los tests de
  // arriba usen filas que no la ejerciten.
  it("la consulta exige las tres condiciones de acceso a la agenda, no solo la bandera", async () => {
    filasAppUsers = [ACTOR, COLEGA];
    const { avisarCambio } = await cargar();

    await avisarCambio(cita(), "creada", "actor@x.com");

    expect(eqSpy).toHaveBeenCalledWith("agenda", true);
    expect(eqSpy).toHaveBeenCalledWith("role", "admin");
    expect(eqSpy).toHaveBeenCalledWith("status", "active");
  });
});

describe("resumenDiario", () => {
  it("manda las citas de hoy en hora de Costa Rica a cada persona vinculada", async () => {
    // 2026-08-19T04:00:00Z son las 22:00 del 18 de agosto en Costa Rica
    // (UTC-6 fijo): el "hoy" correcto es el 18, no el 19.
    const ahora = new Date("2026-08-19T04:00:00.000Z");
    const citaHoy = cita({ inicio: "2026-08-18T20:00:00+00:00" });
    listarCitas.mockResolvedValue([citaHoy]);
    filasAppUsers = [ACTOR, COLEGA];
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
    filasAppUsers = [ACTOR];
    const { resumenDiario } = await cargar();

    const n = await resumenDiario(new Date("2026-08-19T11:00:00.000Z"));

    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("111", "Hoy no hay citas.");
    expect(n).toBe(1);
  });

  it("cuenta solo los envíos que salieron: si uno falla, no se suma pero tampoco frena a los demás", async () => {
    listarCitas.mockResolvedValue([]);
    filasAppUsers = [ACTOR, COLEGA];
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

  it("no le manda el resumen a quien fue deshabilitado ni a quien quedó como vendedor (C-1)", async () => {
    listarCitas.mockResolvedValue([]);
    filasAppUsers = [
      ACTOR,
      { ...COLEGA, email: "deshabilitada@x.com", telegram_chat_id: "333", status: "disabled" },
      { ...COLEGA, email: "vendedor@x.com", telegram_chat_id: "444", role: "vendedor" },
    ];
    const { resumenDiario } = await cargar();

    const n = await resumenDiario(new Date("2026-08-19T11:00:00.000Z"));

    expect(n).toBe(1);
    expect(enviarMensaje).toHaveBeenCalledTimes(1);
    expect(enviarMensaje).toHaveBeenCalledWith("111", expect.any(String));
  });

  it("nunca tira: si listarCitas revienta, devuelve 0 en vez de propagar el error", async () => {
    listarCitas.mockRejectedValue(new Error("boom de postgres"));
    filasAppUsers = [ACTOR];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { resumenDiario } = await cargar();

    await expect(resumenDiario(new Date())).resolves.toBe(0);
    expect(enviarMensaje).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
