import { describe, it, expect, vi, beforeEach } from "vitest";

// Mismo mock de bajo nivel que admin/users.test.ts: `from()` saca la próxima
// respuesta de una cola en el orden en que el código bajo prueba consulta.
const updateSpy = vi.fn();
let colaFrom: unknown[] = [];

function crearCadena(resolver: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn(self);
  cadena.eq = vi.fn(self);
  cadena.update = vi.fn((arg: unknown) => {
    updateSpy(arg);
    return cadena;
  });
  cadena.maybeSingle = vi.fn(() => Promise.resolve(resolver()));
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

const db = { from };

const requireAgenda = vi.fn();
const randomUUID = vi.fn();

vi.mock("../_lib/supabase.js", () => ({
  requireAgenda: (...a: unknown[]) => requireAgenda(...a),
  supabaseAdmin: () => db,
}));
vi.mock("node:crypto", () => ({
  randomUUID: (...a: unknown[]) => randomUUID(...a),
}));

async function cargar() {
  vi.resetModules();
  return (await import("./feed-token")).default;
}

function req(method: string) {
  return { method, headers: {}, query: {} };
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

const YO = { email: "alinaramirezgamboa@gmail.com", userId: "uid-alina", role: "admin" as const };

beforeEach(() => {
  vi.clearAllMocks();
  colaFrom = [];
  process.env.PUBLIC_SITE_URL = "https://test.ecoviva.com";
});

describe("/api/agenda/feed-token", () => {
  it("rechaza sin permiso de agenda", async () => {
    requireAgenda.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("GET crea el token la primera vez si no hay uno guardado", async () => {
    requireAgenda.mockResolvedValue(YO);
    randomUUID.mockReturnValue("11111111-1111-1111-1111-111111111111");
    colaFrom = [
      { data: { feed_token: null }, error: null }, // select
      { data: null, error: null }, // update
    ];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBe(
      "https://test.ecoviva.com/api/agenda/feed?token=11111111-1111-1111-1111-111111111111",
    );
    expect(updateSpy).toHaveBeenCalledWith({ feed_token: "11111111-1111-1111-1111-111111111111" });
  });

  it("GET devuelve la URL con el token ya existente sin generar uno nuevo", async () => {
    requireAgenda.mockResolvedValue(YO);
    colaFrom = [{ data: { feed_token: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toContain("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("POST rota el token: el valor nuevo es distinto del anterior", async () => {
    requireAgenda.mockResolvedValue(YO);

    randomUUID.mockReturnValueOnce("11111111-1111-1111-1111-111111111111");
    colaFrom = [{ data: null, error: null }];
    const handler = await cargar();
    const res1 = resRecorder();
    await handler(req("POST"), res1);

    randomUUID.mockReturnValueOnce("22222222-2222-2222-2222-222222222222");
    colaFrom = [{ data: null, error: null }];
    const res2 = resRecorder();
    await handler(req("POST"), res2);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.url).not.toBe(res2.body.url);
    expect(res2.body.url).toContain("22222222-2222-2222-2222-222222222222");
  });

  it("POST devuelve 500 si la escritura falla, sin exponer el detalle crudo", async () => {
    requireAgenda.mockResolvedValue(YO);
    randomUUID.mockReturnValue("33333333-3333-3333-3333-333333333333");
    colaFrom = [{ data: null, error: { message: "boom de postgres" } }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("POST"), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/boom de postgres/);
  });

  it("un método no soportado devuelve 405", async () => {
    requireAgenda.mockResolvedValue(YO);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE"), res);
    expect(res.statusCode).toBe(405);
  });

  it("manda Cache-Control: no-store", async () => {
    requireAgenda.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
