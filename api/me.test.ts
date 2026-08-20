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
  from.mockClear();
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

  // ── N-1: la bandera no se deriva a mano acá ──
  //
  // `agenda` sale de la definición compartida (api/_lib/agenda/permisos.ts), la
  // misma que usan el panel, el bot, el feed y los avisos. Antes se derivaba a
  // mano —`data?.agenda === true`— y eso le contestaba `agenda: true` a un
  // vendedor con la bandera puesta: el panel le pintaba la pestaña Agenda y
  // cada endpoint de adentro le devolvía 401. Un permiso que se ve pero no
  // funciona es peor que uno que no se ve.
  it("un vendedor con agenda=true en su fila recibe agenda:false", async () => {
    requireUser.mockResolvedValue({ ...YO, role: "vendedor" });
    respuesta = { data: { agenda: true }, error: null };
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.body).toEqual({ email: YO.email, role: "vendedor", agenda: false });
  });

  it("un admin con agenda=false recibe agenda:false", async () => {
    requireUser.mockResolvedValue(YO);
    respuesta = { data: { agenda: false }, error: null };
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.body).toEqual({ email: YO.email, role: "admin", agenda: false });
  });

  it("el token de servicio (sin userId) recibe agenda:false sin consultar la base", async () => {
    requireUser.mockResolvedValue({ email: "service", role: "admin", userId: null });
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.body).toEqual({ email: "service", role: "admin", agenda: false });
    expect(from).not.toHaveBeenCalled();
  });

  it("pone Cache-Control: no-store", async () => {
    requireUser.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
