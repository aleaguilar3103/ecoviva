import { describe, it, expect, vi, beforeEach } from "vitest";

// listarCitas y aplicarRecordatorios se mockean: este endpoint no decide
// reglas de recordatorios (eso ya lo prueba recordatorios.test.ts), solo
// orquesta. supabaseAdmin se mockea con una cadena mínima para el UPDATE de
// housekeeping, igual que en db.test.ts.
const listarCitas = vi.fn();
const aplicarRecordatorios = vi.fn();
const updateSpy = vi.fn();
const eqSpy = vi.fn();
const ltSpy = vi.fn();
let respuestaUpdate: { data: unknown[] | null; error: unknown };

vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
}));
vi.mock("../_lib/agenda/recordatorios.js", () => ({
  aplicarRecordatorios: (...a: unknown[]) => aplicarRecordatorios(...a),
}));
vi.mock("../_lib/supabase.js", () => ({
  supabaseAdmin: () => ({
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cadena: any = {};
      cadena.update = vi.fn((arg: unknown) => {
        updateSpy(arg);
        return cadena;
      });
      cadena.eq = vi.fn((arg: unknown) => {
        eqSpy(arg);
        return cadena;
      });
      cadena.lt = vi.fn((...args: unknown[]) => {
        ltSpy(...args);
        return cadena;
      });
      cadena.select = vi.fn(() => Promise.resolve(respuestaUpdate));
      return cadena;
    },
  }),
}));

async function cargar() {
  vi.resetModules();
  return (await import("./agenda")).default;
}

function req(headers: Record<string, unknown> = {}) {
  return { headers };
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

// Fila completa, con los 16 campos que devuelve db.ts.
function cita(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cita-1",
    cliente_nombre: "María",
    cliente_email: "maria@example.com",
    cliente_telefono: null,
    inicio: "2026-08-20T16:00:00+00:00",
    duracion_min: 60,
    lugar: "Llanada",
    lote_id: null,
    notas: null,
    estado: "agendada",
    ics_uid: "cita-abc@ecovivadesarrollos.com",
    ics_secuencia: 0,
    recordatorio_24h_email_id: "email-24h-1",
    recordatorio_1h_email_id: "email-1h-1",
    creada_por: "alejandro",
    created_at: "2026-08-01T10:00:00+00:00",
    updated_at: "2026-08-01T10:00:00+00:00",
    ...overrides,
  };
}

beforeEach(() => {
  listarCitas.mockReset();
  aplicarRecordatorios.mockReset();
  aplicarRecordatorios.mockResolvedValue(undefined);
  updateSpy.mockReset();
  eqSpy.mockReset();
  ltSpy.mockReset();
  listarCitas.mockResolvedValue([]);
  respuestaUpdate = { data: [], error: null };
  process.env.CRON_SECRET = "secreto-de-prueba";
});

describe("/api/cron/agenda", () => {
  it("sin header de autorizacion: 401 y no llama a listarCitas", async () => {
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.statusCode).toBe(401);
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("con header incorrecto: 401", async () => {
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ authorization: "Bearer lo-que-sea" }), res);
    expect(res.statusCode).toBe(401);
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("sin CRON_SECRET en el entorno: 401 aunque el header venga vacio o cualquier cosa (falla cerrado)", async () => {
    delete process.env.CRON_SECRET;
    const handler = await cargar();

    const res1 = resRecorder();
    await handler(req({ authorization: "" }), res1);
    expect(res1.statusCode).toBe(401);

    const res2 = resRecorder();
    await handler(req({ authorization: "Bearer undefined" }), res2);
    expect(res2.statusCode).toBe(401);

    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("con header correcto: reconcilia solo las citas con algun id en null", async () => {
    const completa = cita({ id: "completa" }); // ya tiene los dos ids
    const sin24h = cita({ id: "sin-24h", recordatorio_24h_email_id: null });
    const sin1h = cita({ id: "sin-1h", recordatorio_1h_email_id: null });
    listarCitas.mockResolvedValue([completa, sin24h, sin1h]);

    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

    expect(res.statusCode).toBe(200);
    expect(aplicarRecordatorios).toHaveBeenCalledTimes(2);
    const idsLlamados = aplicarRecordatorios.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(idsLlamados).toEqual(["sin-24h", "sin-1h"]);
    expect(idsLlamados).not.toContain("completa");
    expect(res.body).toEqual({ reconciliadas: 2, completadas: 0 });
  });

  it("con header correcto: las citas ya canceladas no se reconcilian", async () => {
    const cancelada = cita({
      id: "cancelada",
      estado: "cancelada",
      recordatorio_24h_email_id: null,
      recordatorio_1h_email_id: null,
    });
    listarCitas.mockResolvedValue([cancelada]);

    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

    expect(res.statusCode).toBe(200);
    expect(aplicarRecordatorios).not.toHaveBeenCalled();
    expect(res.body).toEqual({ reconciliadas: 0, completadas: 0 });
  });

  it("reporta cuantas citas paso a completada en el housekeeping", async () => {
    respuestaUpdate = { data: [{ id: "a" }, { id: "b" }], error: null };
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ reconciliadas: 0, completadas: 2 });
    expect(updateSpy).toHaveBeenCalledWith({ estado: "completada" });
  });

  it("M-c: si el UPDATE de housekeeping falla, NO responde 200 — sería indistinguible de 'no había nada que cerrar'", async () => {
    // Este es el único mecanismo automático de la rama: si falla en
    // silencio detrás de un 200 verde, un fallo real puede pasar meses sin
    // que nadie lo note. La reconciliación de arriba sí corrió (lo que le
    // llega al cliente no depende de este housekeeping), así que el
    // problema es puntual — pero el status tiene que reflejarlo.
    respuestaUpdate = { data: null, error: { message: "boom" } };
    const handler = await cargar();
    const res = resRecorder();
    await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

    expect(res.statusCode).not.toBe(200);
    expect(res.body).toHaveProperty("error");
  });

  it("pone Cache-Control: no-store en todas las respuestas", async () => {
    const handler = await cargar();
    const res = resRecorder();
    await handler(req(), res);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
