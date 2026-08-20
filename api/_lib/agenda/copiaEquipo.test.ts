import { describe, it, expect, vi, beforeEach } from "vitest";

// Mismo patrón de mock que avisos.test.ts (M-1 de la revisión final): `app_users`
// se modela como una TABLA de verdad, guardando cada `.eq(campo, valor)` y
// aplicando esos filtros recién en `.then()`. Un `.eq` que falte en la
// consulta se nota porque una fila que no debería salir, sale — no alcanza
// con una respuesta fija que ignore los filtros.
let filasAppUsers: Record<string, unknown>[];
let errorAppUsers: unknown;
const eqSpy = vi.fn();
const selectSpy = vi.fn();

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
  return await import("./copiaEquipo");
}

beforeEach(() => {
  eqSpy.mockReset();
  selectSpy.mockReset();
  filasAppUsers = [];
  errorAppUsers = null;
});

const ALINA = {
  email: "alina@x.com",
  full_name: "Alina",
  telegram_chat_id: "222",
  role: "admin",
  status: "active",
  agenda: true,
};
const ALEJANDRO = {
  email: "alejandro@x.com",
  full_name: "Alejandro",
  telegram_chat_id: "111",
  role: "admin",
  status: "active",
  agenda: true,
};

describe("emailsCopiaEquipo", () => {
  // Test 1 del plan: el correo transaccional (vía enviarAhora, en
  // email.test.ts) tiene que llevar en BCC a quienes esta función devuelve.
  // Acá se prueba la función en sí: que devuelve los correos de quienes
  // tienen acceso a la agenda.
  it("devuelve los correos de todos los que tienen acceso a la agenda", async () => {
    filasAppUsers = [ALINA, ALEJANDRO];
    const { emailsCopiaEquipo } = await cargar();

    const emails = await emailsCopiaEquipo();

    expect(emails.sort()).toEqual(["alejandro@x.com", "alina@x.com"]);
  });

  // Test 2 del plan: deshabilitado o vendedor, aunque tengan agenda=true, no
  // entran en la copia. Es la misma regla que protege el aviso de Telegram
  // (C-1/C-2 en permisos.ts) — si esto no se filtrara, alguien deshabilitado
  // desde el panel seguiría viendo cada correo que le sale a un cliente.
  it("a quien está deshabilitado no lo incluye, aunque tenga agenda=true", async () => {
    filasAppUsers = [ALINA, { ...ALEJANDRO, status: "disabled" }];
    const { emailsCopiaEquipo } = await cargar();

    const emails = await emailsCopiaEquipo();

    expect(emails).toEqual(["alina@x.com"]);
  });

  it("a quien es vendedor no lo incluye, aunque tenga agenda=true", async () => {
    filasAppUsers = [ALINA, { ...ALEJANDRO, role: "vendedor" }];
    const { emailsCopiaEquipo } = await cargar();

    const emails = await emailsCopiaEquipo();

    expect(emails).toEqual(["alina@x.com"]);
  });

  it("a quien tiene agenda=false no lo incluye, aunque role y status estén bien", async () => {
    filasAppUsers = [ALINA, { ...ALEJANDRO, agenda: false }];
    const { emailsCopiaEquipo } = await cargar();

    const emails = await emailsCopiaEquipo();

    expect(emails).toEqual(["alina@x.com"]);
  });

  // Test 3 del plan: la diferencia deliberada con destinatarios() (avisos.ts)
  // es que ACÁ no se exige telegram_chat_id. No hay "canal" que perderse: el
  // correo lo manda Resend, no un bot al que haya que vincularse antes.
  it("a quien tiene acceso pero sin telegram_chat_id SÍ lo incluye (a diferencia de destinatarios())", async () => {
    filasAppUsers = [ALINA, { ...ALEJANDRO, telegram_chat_id: null }];
    const { emailsCopiaEquipo } = await cargar();

    const emails = await emailsCopiaEquipo();

    expect(emails.sort()).toEqual(["alejandro@x.com", "alina@x.com"]);
  });

  it("consulta exactamente las tres condiciones de ACCESO_AGENDA, no una lista aparte", async () => {
    filasAppUsers = [ALINA, ALEJANDRO];
    const { emailsCopiaEquipo } = await cargar();

    await emailsCopiaEquipo();

    expect(eqSpy).toHaveBeenCalledWith("status", "active");
    expect(eqSpy).toHaveBeenCalledWith("role", "admin");
    expect(eqSpy).toHaveBeenCalledWith("agenda", true);
  });

  // Test 4 del plan (mitad "consulta"): si la consulta a app_users falla,
  // esta función nunca tira — devuelve lista vacía y loguea. El "el correo al
  // cliente sale igual" se prueba en email.test.ts, que es donde vive esa
  // garantía end-to-end; acá se prueba la pieza que la hace posible.
  it("si la consulta falla, devuelve una lista vacía y loguea, sin tirar", async () => {
    errorAppUsers = { message: "boom de postgres" };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { emailsCopiaEquipo } = await cargar();

    await expect(emailsCopiaEquipo()).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("con la tabla vacía, devuelve una lista vacía sin loguear nada", async () => {
    filasAppUsers = [];
    const { emailsCopiaEquipo } = await cargar();

    await expect(emailsCopiaEquipo()).resolves.toEqual([]);
  });
});
