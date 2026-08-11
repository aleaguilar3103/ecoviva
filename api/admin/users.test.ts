import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de bajo nivel del cliente de Supabase: en vez de reproducir toda la
// cadena real de supabase-js, `from()` va sacando la próxima respuesta de una
// cola en el orden en que el código bajo prueba hace las consultas. `insert` y
// `update` delegan a espías compartidos para poder revisar con qué se llamó.
const insertSpy = vi.fn();
const updateSpy = vi.fn();
let colaFrom: unknown[] = [];

function crearCadena(resolver: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn(self);
  cadena.eq = vi.fn(self);
  cadena.order = vi.fn(self);
  cadena.insert = vi.fn((arg: unknown) => {
    insertSpy(arg);
    return cadena;
  });
  cadena.update = vi.fn((arg: unknown) => {
    updateSpy(arg);
    return cadena;
  });
  cadena.single = vi.fn(() => Promise.resolve(resolver()));
  cadena.maybeSingle = vi.fn(() => Promise.resolve(resolver()));
  // Soporta el caso en que se hace `await db.from(...).select(...).order(...)` o
  // `.eq(...).eq(...)` sin llamar a single/maybeSingle (listar() y el conteo de
  // admins en revisarGuardas).
  cadena.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(resolver()).then(
      onFulfilled as (v: unknown) => unknown,
      onRejected as (e: unknown) => unknown,
    );
  return cadena;
}

const from = vi.fn(() => {
  const respuesta = colaFrom.shift();
  return crearCadena(() => respuesta ?? { data: null, error: null });
});

const inviteUserByEmail = vi.fn();
const listUsers = vi.fn();
const deleteUser = vi.fn();

const db = {
  from,
  auth: { admin: { inviteUserByEmail, listUsers, deleteUser } },
};

const requireUser = vi.fn();

vi.mock("../_lib/supabase.js", () => ({
  supabaseAdmin: () => db,
  requireUser: (...args: unknown[]) => requireUser(...args),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// El módulo no cachea nada propio, pero se recarga por consistencia con el
// resto de la suite y para poder importar el `revisarGuardas` exportado.
async function cargar() {
  vi.resetModules();
  return await import("./users");
}

function req(method: string, body?: unknown) {
  return { method, headers: {}, body };
}

function resRecorder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = { statusCode: 0, body: undefined };
  r.status = vi.fn((c: number) => {
    r.statusCode = c;
    return r;
  });
  r.json = vi.fn((b: unknown) => {
    r.body = b;
    return r;
  });
  r.setHeader = vi.fn();
  return r;
}

const ADMIN_A = { email: "admin-a@ecoviva.com", userId: "uid-admin-a", role: "admin" as const };
const OTRO_ADMIN = { email: "otro-admin@ecoviva.com", userId: "uid-otro-admin", role: "admin" as const };

beforeEach(() => {
  vi.clearAllMocks();
  colaFrom = [];
  requireUser.mockResolvedValue(ADMIN_A);
  fetchMock.mockResolvedValue({ ok: true });
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-de-prueba";
  process.env.PUBLIC_SITE_URL = "https://test.ecoviva.com";
});

describe("handler / autenticación", () => {
  it("rechaza sin caller admin", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue(null);
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(401);
  });

  it("rechaza a un vendedor aunque tenga sesión válida", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue({ email: "v@ecoviva.com", userId: "uid-v", role: "vendedor" });
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("GET", () => {
  it("cruza last_sign_in_at contra auth.users", async () => {
    const { default: handler } = await cargar();
    colaFrom = [
      {
        data: [{ user_id: "uid-1", email: "a@ecoviva.com", role: "admin", status: "active" }],
        error: null,
      },
    ];
    listUsers.mockResolvedValue({
      data: { users: [{ id: "uid-1", last_sign_in_at: "2026-01-01T00:00:00Z" }] },
      error: null,
    });
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.users[0].last_sign_in_at).toBe("2026-01-01T00:00:00Z");
  });

  it("I6: si auth.listUsers falla, devuelve 500 en vez de marcar a todos como pendientes", async () => {
    const { default: handler } = await cargar();
    colaFrom = [{ data: [{ user_id: "uid-1", email: "a@ecoviva.com" }], error: null }];
    listUsers.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(500);
  });
});

describe("POST — regresión C1 (no degradar por omisión)", () => {
  it("un POST sin role sobre un usuario existente que es admin NO le cambia el rol", async () => {
    const { default: handler } = await cargar();
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "User already registered" } });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "uid-admin-a", email: "admin-a@ecoviva.com" }] },
      error: null,
    });
    colaFrom = [
      {
        // Única consulta: trae la fila completa (sirve para el chequeo de
        // deshabilitado y para calcular `cambios`).
        data: {
          user_id: "uid-admin-a",
          email: "admin-a@ecoviva.com",
          full_name: null,
          role: "admin",
          status: "active",
          invited_by: "migracion_0007",
          created_at: "t0",
          updated_at: "t0",
        },
        error: null,
      },
    ];
    const res = resRecorder();
    await handler(req("POST", { email: "admin-a@ecoviva.com" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.resent).toBe(true);
    // Sin cambio de rol pedido, no hay guarda que evaluar ni UPDATE que hacer:
    // una sola consulta (la fila existente) y listo.
    expect(updateSpy).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("POST — guardas también aplican al reenvío con role explícito", () => {
  it("role: 'vendedor' sobre el último admin activo devuelve 400, no escribe y no manda el correo", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue(OTRO_ADMIN); // quien pide el cambio no es el objetivo
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "User already registered" } });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "uid-unico-admin", email: "unico@ecoviva.com" }] },
      error: null,
    });
    colaFrom = [
      {
        data: { user_id: "uid-unico-admin", email: "unico@ecoviva.com", role: "admin", status: "active" },
        error: null,
      }, // filaExistente (deshabilitado + cálculo de cambios)
      { data: { role: "admin", status: "active" }, error: null }, // objetivo dentro de revisarGuardas
      { count: 1 }, // solo queda un admin activo
    ];
    const res = resRecorder();
    await handler(req("POST", { email: "unico@ecoviva.com", role: "vendedor" }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/al menos un admin activo/);
    expect(updateSpy).not.toHaveBeenCalled();
    // La guarda se evalúa antes de mandar nada: un intento rechazado no debe
    // dejarle al destinatario una alarma de "creá tu contraseña" de más.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST/PATCH — valida el role explícitamente en vez de ignorarlo en silencio", () => {
  it("POST con role inválido devuelve 400 sin llegar a invitar", async () => {
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req("POST", { email: "quien-sea@ecoviva.com", role: "superadmin" }), res);
    expect(res.statusCode).toBe(400);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("PATCH con role inválido devuelve 400 sin escribir", async () => {
    const { default: handler } = await cargar();
    const res = resRecorder();
    await handler(req("PATCH", { user_id: "uid-x", role: "superadmin" }), res);
    expect(res.statusCode).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe("revisarGuardas — I4 (identidad por user_id, no por email)", () => {
  it("bloquea a alguien que se apunta a sí mismo por user_id aunque su email en la fila esté desactualizado", async () => {
    const { revisarGuardas } = await cargar();
    colaFrom = [{ data: { role: "admin", status: "active" }, error: null }];
    const problema = await revisarGuardas("uid-admin-a", "uid-admin-a", "delete");
    expect(problema).toBe("No podés quitarte tu propio acceso");
  });

  it("el token de servicio (callerUserId null) nunca dispara la autoprotección", async () => {
    const { revisarGuardas } = await cargar();
    colaFrom = [{ data: { role: "admin", status: "active" }, error: null }, { count: 2 }];
    const problema = await revisarGuardas("uid-cualquiera", null, "delete");
    expect(problema).toBeNull();
  });
});

describe("POST — alta de usuario nuevo", () => {
  it("con role explícito lo crea con ese rol", async () => {
    const { default: handler } = await cargar();
    inviteUserByEmail.mockResolvedValue({ data: { user: { id: "uid-nuevo" } }, error: null });
    colaFrom = [
      {
        data: {
          user_id: "uid-nuevo",
          email: "nuevo@ecoviva.com",
          full_name: null,
          role: "admin",
          status: "active",
          invited_by: "admin-a@ecoviva.com",
          created_at: "t0",
          updated_at: "t0",
        },
        error: null,
      }, // insert (alta nueva: no hay chequeo previo de fila existente)
    ];
    const res = resRecorder();
    await handler(req("POST", { email: "nuevo@ecoviva.com", role: "admin" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("admin");
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }));
  });

  it("sin role lo crea como vendedor (el default del contrato)", async () => {
    const { default: handler } = await cargar();
    inviteUserByEmail.mockResolvedValue({ data: { user: { id: "uid-nuevo-2" } }, error: null });
    colaFrom = [
      {
        data: {
          user_id: "uid-nuevo-2",
          email: "nuevo2@ecoviva.com",
          full_name: null,
          role: "vendedor",
          status: "active",
          invited_by: "admin-a@ecoviva.com",
          created_at: "t0",
          updated_at: "t0",
        },
        error: null,
      },
    ];
    const res = resRecorder();
    await handler(req("POST", { email: "nuevo2@ecoviva.com" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("vendedor");
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ role: "vendedor" }));
  });
});

describe("POST — C2 (no dejar cuentas huérfanas con privilegios)", () => {
  it("si falla el insert tras crear la cuenta en auth.users, la deshace con deleteUser", async () => {
    const { default: handler } = await cargar();
    inviteUserByEmail.mockResolvedValue({ data: { user: { id: "uid-huerfano" } }, error: null });
    colaFrom = [
      { data: null, error: { message: "insert falló" } }, // insert falla
    ];
    deleteUser.mockResolvedValue({ error: null });
    const res = resRecorder();
    await handler(req("POST", { email: "huerfano@ecoviva.com" }), res);
    expect(res.statusCode).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith("uid-huerfano");
  });

  it("si falla el update en el camino de reenvío (cuenta ya existía), NO llama a deleteUser", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue(OTRO_ADMIN);
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "User already registered" } });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "uid-existente", email: "existente@ecoviva.com" }] },
      error: null,
    });
    colaFrom = [
      {
        data: { user_id: "uid-existente", email: "existente@ecoviva.com", role: "vendedor", status: "active" },
        error: null,
      }, // filaExistente
      { data: null, error: { message: "update falló" } }, // update falla (con full_name nuevo)
    ];
    const res = resRecorder();
    await handler(req("POST", { email: "existente@ecoviva.com", full_name: "Nombre Nuevo" }), res);
    expect(res.statusCode).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("POST — I5 (el reenvío no borra el nombre guardado)", () => {
  it("un reenvío con role explícito y sin full_name conserva el nombre ya guardado", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue(OTRO_ADMIN);
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "User already registered" } });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "uid-con-nombre", email: "connombre@ecoviva.com" }] },
      error: null,
    });
    colaFrom = [
      {
        data: {
          user_id: "uid-con-nombre",
          email: "connombre@ecoviva.com",
          full_name: "Nombre Viejo",
          role: "vendedor",
          status: "active",
        },
        error: null,
      }, // filaExistente
      { data: { role: "vendedor", status: "active" }, error: null }, // objetivo dentro de revisarGuardas
      {
        data: {
          user_id: "uid-con-nombre",
          email: "connombre@ecoviva.com",
          full_name: "Nombre Viejo",
          role: "admin",
          status: "active",
        },
        error: null,
      }, // update
    ];
    const res = resRecorder();
    // Body sin full_name: el reenvío pide subir el rol, no toca el nombre.
    await handler(req("POST", { email: "connombre@ecoviva.com", role: "admin" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.full_name).toBe("Nombre Viejo");
    // La clave full_name no debe aparecer en lo que se escribe: si viniera
    // como `null`, pisaría el nombre ya guardado (I5).
    const payload = updateSpy.mock.calls[0][0];
    expect(payload).not.toHaveProperty("full_name");
    expect(payload).toEqual({ role: "admin" });
  });
});

describe("POST — I6 (errores de listUsers no se tragan)", () => {
  it("si inviteUserByEmail falla y buscarEnAuthPorCorreo también falla, no dice 'no se pudo invitar'", async () => {
    const { default: handler } = await cargar();
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "User already registered" } });
    listUsers.mockResolvedValue({ data: null, error: { message: "network down" } });
    const res = resRecorder();
    await handler(req("POST", { email: "quien-sea@ecoviva.com" }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).not.toMatch(/No se pudo invitar/);
  });
});

describe("POST — M9 (mensaje amigable en 429 de recover)", () => {
  it("traduce el 429 de GoTrue a un mensaje en español sin el JSON crudo", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue(OTRO_ADMIN);
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "User already registered" } });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "uid-existente-2", email: "existente2@ecoviva.com" }] },
      error: null,
    });
    colaFrom = [{ data: { status: "active" }, error: null }];
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"code":429,"message":"For security purposes..."}',
    });
    const res = resRecorder();
    await handler(req("POST", { email: "existente2@ecoviva.com" }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe("Esperá un momento antes de reenviar el acceso a esa persona.");
  });
});

describe("PATCH y DELETE", () => {
  it("PATCH cambia el rol cuando hay más de un admin activo", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue(OTRO_ADMIN);
    colaFrom = [
      { data: { role: "admin", status: "active" }, error: null }, // objetivo en revisarGuardas
      { count: 2 },
      { data: { user_id: "uid-x", role: "vendedor" }, error: null }, // update
    ];
    const res = resRecorder();
    await handler(req("PATCH", { user_id: "uid-x", role: "vendedor" }), res);
    expect(res.statusCode).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ role: "vendedor" }));
  });

  it("DELETE sobre el último admin activo lo bloquea", async () => {
    const { default: handler } = await cargar();
    requireUser.mockResolvedValue(OTRO_ADMIN);
    colaFrom = [
      { data: { role: "admin", status: "active" }, error: null },
      { count: 1 },
    ];
    const res = resRecorder();
    await handler(req("DELETE", { user_id: "uid-x" }), res);
    expect(res.statusCode).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
