import { describe, it, expect, vi, beforeEach } from "vitest";

// Mismo patrón que api/admin/users.test.ts: `from()` va sacando la próxima
// respuesta de una cola en el orden en que el código bajo prueba consulta.
let colaFrom: unknown[] = [];

function crearCadena(resolver: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn(self);
  cadena.eq = vi.fn(self);
  cadena.maybeSingle = vi.fn(() => Promise.resolve(resolver()));
  return cadena;
}

const from = vi.fn(() => {
  const respuesta = colaFrom.shift();
  return crearCadena(() => respuesta ?? { data: null, error: null });
});

const getUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from, auth: { getUser } }),
}));

async function cargar() {
  vi.resetModules();
  return await import("../supabase");
}

function req(token: string) {
  return { headers: { authorization: `Bearer ${token}` } };
}

beforeEach(() => {
  colaFrom = [];
  from.mockClear();
  getUser.mockReset();
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  delete process.env.ADMIN_API_TOKEN;
});

describe("requireAgenda", () => {
  it("deja pasar al admin con agenda = true", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-alina", email: "alinaramirezgamboa@gmail.com" } },
      error: null,
    });
    // 1ª consulta: la de requireUser (role/status). 2ª: la bandera de agenda.
    colaFrom = [
      { data: { role: "admin", status: "active" }, error: null },
      { data: { agenda: true }, error: null },
    ];
    const { requireAgenda } = await cargar();
    const caller = await requireAgenda(req("jwt"));
    expect(caller?.email).toBe("alinaramirezgamboa@gmail.com");
  });

  it("consulta la bandera aunque el correo sea break-glass", async () => {
    // Este es el caso que casi se rompe: requireUser corta temprano para los
    // BASE_ADMINS y nunca lee app_users. Si requireAgenda confiara en eso,
    // Alejandro quedaría fuera de su propia agenda.
    getUser.mockResolvedValue({
      data: { user: { id: "uid-ale", email: "aguilartradesfx@gmail.com" } },
      error: null,
    });
    colaFrom = [{ data: { agenda: true }, error: null }];
    const { requireAgenda } = await cargar();
    const caller = await requireAgenda(req("jwt"));
    expect(caller?.email).toBe("aguilartradesfx@gmail.com");
    expect(from).toHaveBeenCalledWith("app_users");
  });

  it("rechaza al admin sin agenda", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-gerencia", email: "gerencia@duphomes.com" } },
      error: null,
    });
    colaFrom = [{ data: { agenda: false }, error: null }];
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("jwt"))).toBeNull();
  });

  it("rechaza al vendedor aunque tenga agenda en true", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-v", email: "vendedor@ecoviva.com" } },
      error: null,
    });
    colaFrom = [
      { data: { role: "vendedor", status: "active" }, error: null },
      { data: { agenda: true }, error: null },
    ];
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("jwt"))).toBeNull();
  });

  it("falla cerrado si la consulta de la bandera da error", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "uid-alina", email: "alinaramirezgamboa@gmail.com" } },
      error: null,
    });
    colaFrom = [
      { data: { role: "admin", status: "active" }, error: null },
      { data: null, error: { message: "timeout" } },
    ];
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("jwt"))).toBeNull();
  });

  it("rechaza el token de servicio: no tiene agenda personal", async () => {
    process.env.ADMIN_API_TOKEN = "token-de-servicio";
    const { requireAgenda } = await cargar();
    expect(await requireAgenda(req("token-de-servicio"))).toBeNull();
  });
});
