import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de bajo nivel del cliente de Supabase, mismo patrón que
// api/admin/users.test.ts: `maybeSingle` resuelve con lo que se cargue en
// `respuesta` antes de cada test.
let respuesta: { data: unknown; error: unknown };

function crearCadena() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn(self);
  cadena.eq = vi.fn(self);
  cadena.maybeSingle = vi.fn(() => Promise.resolve(respuesta));
  return cadena;
}

const from = vi.fn(() => crearCadena());
const db = { from };
const requireUser = vi.fn();

vi.mock("./_lib/supabase.js", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
  supabaseAdmin: () => db,
}));

async function cargar() {
  vi.resetModules();
  return (await import("./me")).default;
}

function req(headers: Record<string, unknown> = {}) {
  return { method: "GET", headers };
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

const YO = { email: "alina@ecoviva.test", role: "admin" as const, userId: "uid-alina" };

beforeEach(() => {
  requireUser.mockReset();
  respuesta = { data: null, error: null };
});

describe("/api/me", () => {
  it("sin sesión: 401", async () => {
    requireUser.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.statusCode).toBe(401);
  });

  it("devuelve agenda:true cuando la fila de app_users lo tiene en true", async () => {
    requireUser.mockResolvedValue(YO);
    respuesta = { data: { agenda: true }, error: null };
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ email: YO.email, role: "admin", agenda: true });
  });

  // M-d: antes esta consulta fallaba cerrado (agenda: false) SIN loguear
  // nada — es la única de las tres copias de esta misma consulta que se
  // queda muda (requireAgenda y agenda/feed.ts sí loguean su versión). El
  // síntoma sin log es "me desapareció la pestaña Agenda" sin nada que
  // mirar para diagnosticarlo.
  it("M-d: si la consulta de la bandera agenda falla, lo deja logueado (sigue fallando cerrado)", async () => {
    requireUser.mockResolvedValue(YO);
    respuesta = { data: null, error: { message: "conexión caída" } };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ email: YO.email, role: "admin", agenda: false });
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("pone Cache-Control: no-store", async () => {
    requireUser.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
