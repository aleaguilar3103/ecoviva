import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();

// Cadena mínima de supabase-js: db.from(...).select(...).eq(...).maybeSingle()
const mockClient = {
  auth: { getUser },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    })),
  })),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockClient),
}));

const req = (token?: string) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

// El módulo cachea el cliente y lee env al importarse: se recarga en cada prueba.
async function cargar() {
  vi.resetModules();
  return await import("./supabase");
}

// Simula un JWT válido de Supabase para ese correo.
function conUsuario(email: string, id = "uid-1") {
  getUser.mockResolvedValue({ data: { user: { id, email } }, error: null });
}

describe("requireUser / requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-de-prueba";
    delete process.env.ADMIN_API_TOKEN;
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("rechaza una petición sin Authorization", async () => {
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req())).toBeNull();
    expect(await requireAdmin(req())).toBeNull();
  });

  it("acepta el token de servidor a servidor como admin", async () => {
    process.env.ADMIN_API_TOKEN = "token-de-servicio";
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req("token-de-servicio"))).toEqual({
      email: "service",
      userId: null,
      role: "admin",
    });
    expect(await requireAdmin(req("token-de-servicio"))).toBe("service");
  });

  it("da rol admin a quien tiene fila admin activa", async () => {
    conUsuario("alguien@ecoviva.com");
    maybeSingle.mockResolvedValue({ data: { role: "admin", status: "active" }, error: null });
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req("jwt"))).toEqual({
      email: "alguien@ecoviva.com",
      userId: "uid-1",
      role: "admin",
    });
    expect(await requireAdmin(req("jwt"))).toBe("alguien@ecoviva.com");
  });

  it("deja pasar al vendedor por requireUser pero no por requireAdmin", async () => {
    conUsuario("vendedora@ecoviva.com");
    maybeSingle.mockResolvedValue({ data: { role: "vendedor", status: "active" }, error: null });
    const { requireUser, requireAdmin } = await cargar();
    expect((await requireUser(req("jwt")))?.role).toBe("vendedor");
    expect(await requireAdmin(req("jwt"))).toBeNull();
  });

  it("bloquea a un usuario deshabilitado aunque su JWT sea válido", async () => {
    conUsuario("exvendedora@ecoviva.com");
    maybeSingle.mockResolvedValue({ data: { role: "admin", status: "disabled" }, error: null });
    const { requireUser, requireAdmin } = await cargar();
    expect(await requireUser(req("jwt"))).toBeNull();
    expect(await requireAdmin(req("jwt"))).toBeNull();
  });

  it("deja entrar a un BASE_ADMIN aunque no tenga fila en app_users", async () => {
    conUsuario("gerencia@duphomes.com");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { requireAdmin } = await cargar();
    expect(await requireAdmin(req("jwt"))).toBe("gerencia@duphomes.com");
  });

  it("deja entrar a un BASE_ADMIN aunque su fila esté deshabilitada", async () => {
    conUsuario("gerencia@duphomes.com");
    maybeSingle.mockResolvedValue({ data: { role: "admin", status: "disabled" }, error: null });
    const { requireAdmin } = await cargar();
    expect(await requireAdmin(req("jwt"))).toBe("gerencia@duphomes.com");
  });

  it("deja entrar a un BASE_ADMIN aunque su fila diga rol vendedor activo", async () => {
    conUsuario("gerencia@duphomes.com");
    maybeSingle.mockResolvedValue({ data: { role: "vendedor", status: "active" }, error: null });
    const { requireAdmin } = await cargar();
    expect(await requireAdmin(req("jwt"))).toBe("gerencia@duphomes.com");
  });

  it("rechaza a un usuario de auth sin fila en app_users", async () => {
    conUsuario("colado@gmail.com");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { requireUser } = await cargar();
    expect(await requireUser(req("jwt"))).toBeNull();
  });

  it("normaliza el correo a minúsculas antes de comparar", async () => {
    conUsuario("Gerencia@DupHomes.com");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { requireAdmin } = await cargar();
    expect(await requireAdmin(req("jwt"))).toBe("gerencia@duphomes.com");
  });

  it("rechaza si Supabase no valida el JWT", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    const { requireUser } = await cargar();
    expect(await requireUser(req("jwt-vencido"))).toBeNull();
  });
});
