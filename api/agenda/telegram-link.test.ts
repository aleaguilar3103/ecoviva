import { describe, it, expect, vi, beforeEach } from "vitest";

// Mismo mock de bajo nivel que feed-token.test.ts: `from()` saca la próxima
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
const randomInt = vi.fn();

vi.mock("../_lib/supabase.js", () => ({
  requireAgenda: (...a: unknown[]) => requireAgenda(...a),
  supabaseAdmin: () => db,
}));
vi.mock("node:crypto", () => ({
  randomInt: (...a: unknown[]) => randomInt(...a),
}));

async function cargar() {
  vi.resetModules();
  return (await import("./telegram-link")).default;
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
  vi.useRealTimers();
});

describe("/api/agenda/telegram-link", () => {
  // ── Permisos ──

  it("GET sin permiso de agenda → 401, sin tocar la base", async () => {
    requireAgenda.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("POST sin permiso de agenda → 401, sin tocar la base", async () => {
    requireAgenda.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("POST"), res);
    expect(res.statusCode).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("DELETE sin permiso de agenda → 401, sin tocar la base", async () => {
    requireAgenda.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE"), res);
    expect(res.statusCode).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  // ── GET: de solo lectura. Este es el test que importa (ver progress.md /
  // ronda de arreglo): un GET que escribiera generaría una credencial viva de
  // 10 minutos cada vez que el panel monta el componente, sin que nadie la
  // pidiera. Si algún día alguien vuelve a meter la generación acá, este test
  // se pone rojo y nada más — es la regla, no un efecto colateral de otro
  // assert. ──

  it("GET NO escribe en la base (ni vinculado ni sin vincular)", async () => {
    requireAgenda.mockResolvedValue(YO);

    colaFrom = [{ data: { telegram_chat_id: null }, error: null }];
    const handler = await cargar();
    await handler(req("GET"), resRecorder());
    expect(updateSpy).not.toHaveBeenCalled();

    colaFrom = [{ data: { telegram_chat_id: "999888777" }, error: null }];
    await handler(req("GET"), resRecorder());
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("GET con cuenta vinculada → { vinculado: true }, sin código en la respuesta", async () => {
    requireAgenda.mockResolvedValue(YO);
    colaFrom = [{ data: { telegram_chat_id: "999888777" }, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ vinculado: true });
    expect(res.body.codigo).toBeUndefined();
  });

  it("GET con cuenta sin vincular → { vinculado: false }, sin código en la respuesta", async () => {
    requireAgenda.mockResolvedValue(YO);
    colaFrom = [{ data: { telegram_chat_id: null }, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ vinculado: false });
    expect(res.body.codigo).toBeUndefined();
  });

  it("GET devuelve 500 si falla la lectura, sin exponer el detalle crudo", async () => {
    requireAgenda.mockResolvedValue(YO);
    colaFrom = [{ data: null, error: { message: "boom de postgres" } }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/boom de postgres/);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // ── POST: acá vive la generación, gatillada solo por el botón. ──

  it("POST genera un código de 6 dígitos, rellenado con ceros, y lo guarda con expiración futura", async () => {
    requireAgenda.mockResolvedValue(YO);
    randomInt.mockReturnValue(42); // random chico a propósito: exige el padStart
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    colaFrom = [{ data: null, error: null }]; // update
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("POST"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.codigo).toBe("000042");
    expect(res.body.vinculado).toBeUndefined();
    // 10 minutos exactos desde "ahora".
    expect(res.body.expira).toBe("2026-08-19T12:10:00.000Z");
    expect(updateSpy).toHaveBeenCalledWith({
      telegram_codigo: "000042",
      telegram_codigo_expira: "2026-08-19T12:10:00.000Z",
    });
    // randomInt, no Math.random: el rango pedido es [0, 1_000_000).
    expect(randomInt).toHaveBeenCalledWith(0, 1_000_000);
  });

  it("dos POST seguidos: el segundo código reemplaza al primero, no se acumulan", async () => {
    requireAgenda.mockResolvedValue(YO);
    randomInt.mockReturnValueOnce(111111).mockReturnValueOnce(222222);
    const handler = await cargar();

    colaFrom = [{ data: null, error: null }];
    const res1 = resRecorder();
    await handler(req("POST"), res1);

    colaFrom = [{ data: null, error: null }];
    const res2 = resRecorder();
    await handler(req("POST"), res2);

    expect(res1.body.codigo).toBe("111111");
    expect(res2.body.codigo).toBe("222222");
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenNthCalledWith(2, {
      telegram_codigo: "222222",
      telegram_codigo_expira: expect.any(String),
    });
  });

  it("POST devuelve 500 si falla la escritura, sin exponer el detalle crudo", async () => {
    requireAgenda.mockResolvedValue(YO);
    randomInt.mockReturnValue(1);
    colaFrom = [{ data: null, error: { message: "boom de postgres" } }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("POST"), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/boom de postgres/);
  });

  // ── DELETE: sin cambios respecto a la ronda anterior. ──

  it("DELETE limpia telegram_chat_id, telegram_codigo y telegram_codigo_expira", async () => {
    requireAgenda.mockResolvedValue(YO);
    colaFrom = [{ data: null, error: null }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(updateSpy).toHaveBeenCalledWith({
      telegram_chat_id: null,
      telegram_codigo: null,
      telegram_codigo_expira: null,
    });
  });

  it("DELETE devuelve 500 si falla, sin exponer el detalle crudo", async () => {
    requireAgenda.mockResolvedValue(YO);
    colaFrom = [{ data: null, error: { message: "boom de postgres" } }];
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE"), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/boom de postgres/);
  });

  it("un método no soportado devuelve 405", async () => {
    requireAgenda.mockResolvedValue(YO);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("PATCH"), res);
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
