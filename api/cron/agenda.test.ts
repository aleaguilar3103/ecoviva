import { describe, it, expect, vi, beforeEach } from "vitest";

// listarCitas y aplicarRecordatorios se mockean: este endpoint no decide
// reglas de recordatorios (eso ya lo prueba recordatorios.test.ts), solo
// orquesta. resumenDiario se mockea por la misma razón (sus propias reglas
// — a quién le llega, que nunca tira — ya las prueba avisos.test.ts). Acá
// solo importa la orquestación del cron: que se llame, que un fallo no
// frene la reconciliación, y que el gate de agenda_jobs lo saltee la
// segunda vez que corre el mismo día.
//
// supabaseAdmin se mockea con una cadena mínima, y `from()` ahora rutea por
// tabla: "agenda_jobs" para el insert del gate del resumen (Task 6) y
// cualquier otra ("citas") para el UPDATE de housekeeping, igual que antes.
const listarCitas = vi.fn();
const aplicarRecordatorios = vi.fn();
const resumenDiario = vi.fn();
const updateSpy = vi.fn();
const eqSpy = vi.fn();
const ltSpy = vi.fn();
const insertJobsSpy = vi.fn();
const updateJobsSpy = vi.fn();
const eqJobsSpy = vi.fn();
let respuestaUpdate: { data: unknown[] | null; error: unknown };
let respuestaInsertJob: { data: unknown; error: unknown };
let respuestaUpdateJob: { error: unknown };
// Tabla en memoria para agenda_mensajes: a diferencia de las otras dos
// (cuya respuesta es fija), acá lo que hay que probar es el efecto real del
// `.lt("created_at", limite)` — qué filas sobreviven — así que el mock
// filtra de verdad, igual que agenda_acciones_pendientes en
// webhook.test.ts.
let filasMensajes: { id: number; created_at: string }[];
let errorPurga: { message: string } | null;

vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
}));
vi.mock("../_lib/agenda/recordatorios.js", () => ({
  aplicarRecordatorios: (...a: unknown[]) => aplicarRecordatorios(...a),
}));
vi.mock("../_lib/agenda/avisos.js", () => ({
  resumenDiario: (...a: unknown[]) => resumenDiario(...a),
}));
vi.mock("../_lib/supabase.js", () => ({
  supabaseAdmin: () => ({
    from: (tabla: string) => {
      if (tabla === "agenda_jobs") {
        // Dos formas muy distintas se usan sobre esta tabla en el mismo
        // handler: el insert del gate (primeraVezHoy) y, si el resumen
        // salió bien, el update de resumen_enviado_at (marcarResumenEnviado).
        // `modo` recuerda cuál de los dos se llamó para que `.then()` sepa
        // qué respuesta canned corresponde.
        let modo: "insert" | "update" | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cadenaJobs: any = {};
        cadenaJobs.insert = vi.fn((arg: unknown) => {
          modo = "insert";
          insertJobsSpy(arg);
          return cadenaJobs;
        });
        cadenaJobs.update = vi.fn((arg: unknown) => {
          modo = "update";
          updateJobsSpy(arg);
          return cadenaJobs;
        });
        cadenaJobs.eq = vi.fn((...args: unknown[]) => {
          eqJobsSpy(...args);
          return cadenaJobs;
        });
        cadenaJobs.then = (onFulfilled: unknown, onRejected: unknown) =>
          Promise.resolve(modo === "update" ? respuestaUpdateJob : respuestaInsertJob).then(
            onFulfilled as (v: unknown) => unknown,
            onRejected as (e: unknown) => unknown,
          );
        return cadenaJobs;
      }
      if (tabla === "agenda_mensajes") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cadenaMsj: any = {};
        cadenaMsj.delete = vi.fn(() => cadenaMsj);
        cadenaMsj.lt = vi.fn((_campo: string, valor: string) => {
          if (errorPurga) return Promise.resolve({ error: errorPurga });
          filasMensajes = filasMensajes.filter(
            (f) => new Date(f.created_at).getTime() >= new Date(valor).getTime(),
          );
          return Promise.resolve({ error: null });
        });
        return cadenaMsj;
      }
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
  resumenDiario.mockReset();
  resumenDiario.mockResolvedValue(0);
  updateSpy.mockReset();
  eqSpy.mockReset();
  ltSpy.mockReset();
  insertJobsSpy.mockReset();
  updateJobsSpy.mockReset();
  eqJobsSpy.mockReset();
  listarCitas.mockResolvedValue([]);
  respuestaUpdate = { data: [], error: null };
  // Insert exitoso por default: "primera vez hoy", el resumen se llama.
  // Los tests que necesitan el otro camino (ya salió hoy) lo pisan.
  respuestaInsertJob = { data: null, error: null };
  respuestaUpdateJob = { error: null };
  filasMensajes = [];
  errorPurga = null;
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

  describe("resumen diario (Task 6)", () => {
    it("con el header correcto, se llama a resumenDiario", async () => {
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(resumenDiario).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });

    it("sin header (401): no se llama a resumenDiario — el gate ni se toca antes de autorizar", async () => {
      const handler = await cargar();
      const res = resRecorder();
      await handler(req(), res);

      expect(resumenDiario).not.toHaveBeenCalled();
      expect(insertJobsSpy).not.toHaveBeenCalled();
    });

    it("si resumenDiario tira, la reconciliación se corre igual y la respuesta no es 500", async () => {
      resumenDiario.mockRejectedValue(new Error("Telegram caído"));
      const sin24h = cita({ id: "sin-24h", recordatorio_24h_email_id: null });
      listarCitas.mockResolvedValue([sin24h]);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(res.statusCode).not.toBe(500);
      expect(aplicarRecordatorios).toHaveBeenCalledTimes(1);
      expect(res.body).toEqual({ reconciliadas: 1, completadas: 0 });
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("corriendo dos veces el mismo día, el resumen sale una sola vez", async () => {
      const handler = await cargar();

      const res1 = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res1);
      expect(resumenDiario).toHaveBeenCalledTimes(1);

      // Segunda corrida "del mismo día": el insert en agenda_jobs choca con
      // la primary key ya sembrada por la corrida anterior (código 23505).
      respuestaInsertJob = {
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "agenda_jobs_pkey"' },
      };
      const res2 = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res2);

      expect(resumenDiario).toHaveBeenCalledTimes(1); // sigue en 1, no subió a 2
      expect(res2.statusCode).toBe(200); // el gate saltea el resumen, no rompe la respuesta
    });

    it("si el gate de agenda_jobs falla por una razón distinta al choque de PK, no manda el resumen (falla cerrado)", async () => {
      respuestaInsertJob = { data: null, error: { message: "boom de postgres" } };
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(resumenDiario).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200); // igual no frena la reconciliación
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("usa el día calendario de Costa Rica para la clave del gate, no el de UTC", async () => {
      // 2026-08-19T04:00:00Z son las 22:00 del 18 de agosto en Costa Rica
      // (UTC-6 fijo): el "hoy" correcto para agenda_jobs es el 18, no el 19.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-19T04:00:00.000Z"));
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(insertJobsSpy).toHaveBeenCalledWith({ fecha: "2026-08-18" });
      vi.useRealTimers();
    });
  });

  describe("agenda_jobs.resumen_enviado_at (ronda de arreglos)", () => {
    it("envío exitoso deja resumen_enviado_at con la hora real, sobre la fila de hoy", async () => {
      // I-1: este test corría con el default `mockResolvedValue(0)` — o sea,
      // con CERO envíos — y aun así exigía el timestamp. Le puso "envío
      // exitoso" a un caso de envío nulo, y por eso el defecto pasó la
      // revisión de la tarea 6. Un envío exitoso es el que sale de verdad.
      resumenDiario.mockResolvedValue(2);
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-19T11:00:00.000Z"));
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(updateJobsSpy).toHaveBeenCalledWith({ resumen_enviado_at: "2026-08-19T11:00:00.000Z" });
      expect(eqJobsSpy).toHaveBeenCalledWith("fecha", "2026-08-19");
      vi.useRealTimers();
    });

    it("si el resumen no le llegó a NADIE (0 envíos), resumen_enviado_at NO se estampa", async () => {
      // La columna existe para que `null` signifique "el cron reclamó el día
      // pero el envío nunca se confirmó". `resumenDiario` nunca tira: si
      // Telegram está caído, si falla la consulta de destinatarios o si las
      // dos personas bloquearon el bot, devuelve 0. Estampar la hora igual
      // convierte esa columna en una mentira, y como `agenda_jobs.fecha` es
      // PK, el día no se reintenta nunca más: el operador ve verde sobre un
      // mecanismo muerto (Paso 12 del runbook).
      resumenDiario.mockResolvedValue(0);
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(resumenDiario).toHaveBeenCalled();
      expect(insertJobsSpy).toHaveBeenCalled(); // el gate SÍ reclamó el día
      expect(updateJobsSpy).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200); // y no frena nada de lo que sigue
    });

    it("si el resumen salió aunque sea a UNA persona, sí se estampa", async () => {
      resumenDiario.mockResolvedValue(1);
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(updateJobsSpy).toHaveBeenCalled();
    });

    it("si resumenDiario tira, la fila del gate existe pero resumen_enviado_at nunca se toca (queda en null)", async () => {
      resumenDiario.mockRejectedValue(new Error("Telegram caído"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(insertJobsSpy).toHaveBeenCalled(); // el gate SÍ reclamó el día
      expect(updateJobsSpy).not.toHaveBeenCalled(); // pero nunca se confirmó el envío
      expect(res.statusCode).not.toBe(500);
      consoleError.mockRestore();
    });

    it("si el UPDATE de resumen_enviado_at falla, no rompe nada: la reconciliación se corre igual", async () => {
      resumenDiario.mockResolvedValue(2);
      respuestaUpdateJob = { error: { message: "boom de postgres" } };
      const sin24h = cita({ id: "sin-24h", recordatorio_24h_email_id: null });
      listarCitas.mockResolvedValue([sin24h]);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(res.statusCode).not.toBe(500);
      expect(aplicarRecordatorios).toHaveBeenCalledTimes(1);
      expect(res.body).toEqual({ reconciliadas: 1, completadas: 0 });
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("no salió por segunda vez el mismo día (23505): no se intenta marcar resumen_enviado_at", async () => {
      respuestaInsertJob = {
        data: null,
        error: { code: "23505", message: 'duplicate key value violates unique constraint "agenda_jobs_pkey"' },
      };
      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(resumenDiario).not.toHaveBeenCalled();
      expect(updateJobsSpy).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });

  describe("purga de agenda_mensajes (Task 6)", () => {
    it("borra las filas de más de 24 horas y conserva las recientes", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
      filasMensajes = [
        { id: 1, created_at: "2026-08-18T11:00:00.000Z" }, // 25h antes: vieja
        { id: 2, created_at: "2026-08-19T11:00:00.000Z" }, // 1h antes: reciente
      ];

      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(filasMensajes.map((f) => f.id)).toEqual([2]);
      vi.useRealTimers();
    });

    it("si la purga falla, no rompe nada: la reconciliación se corre igual y la respuesta no es 500", async () => {
      errorPurga = { message: "boom de postgres" };
      const sin24h = cita({ id: "sin-24h", recordatorio_24h_email_id: null });
      listarCitas.mockResolvedValue([sin24h]);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const handler = await cargar();
      const res = resRecorder();
      await handler(req({ authorization: "Bearer secreto-de-prueba" }), res);

      expect(res.statusCode).not.toBe(500);
      expect(aplicarRecordatorios).toHaveBeenCalledTimes(1);
      expect(res.body).toEqual({ reconciliadas: 1, completadas: 0 });
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
