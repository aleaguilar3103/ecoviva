import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAgenda = vi.fn();
const listarCitas = vi.fn();
const crearCita = vi.fn();
const actualizarCita = vi.fn();
const cancelarCita = vi.fn();
const enviarAhora = vi.fn();
const aplicarRecordatorios = vi.fn();

vi.mock("../_lib/supabase.js", () => ({
  requireAgenda: (...a: unknown[]) => requireAgenda(...a),
}));
vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  crearCita: (...a: unknown[]) => crearCita(...a),
  actualizarCita: (...a: unknown[]) => actualizarCita(...a),
  cancelarCita: (...a: unknown[]) => cancelarCita(...a),
  obtenerCita: vi.fn(),
}));
vi.mock("../_lib/agenda/email.js", () => ({
  enviarAhora: (...a: unknown[]) => enviarAhora(...a),
}));
vi.mock("../_lib/agenda/recordatorios.js", () => ({
  aplicarRecordatorios: (...a: unknown[]) => aplicarRecordatorios(...a),
}));

async function cargar() {
  vi.resetModules();
  return (await import("./citas")).default;
}

function req(method: string, body?: unknown, query: Record<string, string> = {}) {
  return { method, headers: {}, body, query };
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

// Fila completa tal como la devuelve db.ts, para no repetir los 16 campos en
// cada test.
const CITA_BASE = {
  id: "cita-1",
  cliente_nombre: "María",
  cliente_email: "maria@example.com",
  cliente_telefono: null,
  inicio: "2026-09-01T16:00:00+00:00",
  duracion_min: 60,
  lugar: "Llanada",
  lote_id: null,
  notas: "Pidió llevar a su suegra, ojo con el horario",
  estado: "agendada" as const,
  ics_uid: "cita-abc@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "alinaramirezgamboa@gmail.com",
  created_at: "2026-08-18T10:00:00+00:00",
  updated_at: "2026-08-18T10:00:00+00:00",
};

beforeEach(() => {
  requireAgenda.mockReset();
  listarCitas.mockReset();
  crearCita.mockReset();
  actualizarCita.mockReset();
  cancelarCita.mockReset();
  enviarAhora.mockReset();
  aplicarRecordatorios.mockReset();
  // Los recordatorios son un mecanismo aparte del correo inmediato: por
  // default se resuelven solos, salvo que un test necesite lo contrario.
  aplicarRecordatorios.mockResolvedValue(undefined);
});

describe("/api/agenda/citas", () => {
  it("rechaza a quien no tiene agenda", async () => {
    requireAgenda.mockResolvedValue(null);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("GET"), res);
    expect(res.statusCode).toBe(401);
    expect(listarCitas).not.toHaveBeenCalled();
  });

  it("exige correo del cliente al crear, con un mensaje que explica por qué", async () => {
    requireAgenda.mockResolvedValue(YO);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", { cliente_nombre: "María", inicio: "2026-09-01T16:00:00.000Z", lugar: "Llanada" }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(crearCita).not.toHaveBeenCalled();
    // No alcanza un "campo requerido": tiene que explicar la consecuencia de
    // no tener correo (sin él no hay invitación de calendario ni recordatorios).
    expect(res.body.error).toMatch(/invitaci|recordatorio/i);
  });

  it("rechaza un correo con formato inválido", async () => {
    requireAgenda.mockResolvedValue(YO);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María",
        cliente_email: "maria-arroba-example",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(crearCita).not.toHaveBeenCalled();
  });

  it("avisa del choque pero igual crea la cita", async () => {
    requireAgenda.mockResolvedValue(YO);
    // Ya hay algo a esa hora.
    listarCitas.mockResolvedValue([{ id: "otra", inicio: "2026-09-01T16:00:00.000Z", duracion_min: 60 }]);
    crearCita.mockResolvedValue({ ...CITA_BASE, id: "nueva", inicio: "2026-09-01T16:30:00.000Z" });
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:30:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.choque).toBe(true);
    expect(crearCita).toHaveBeenCalled();
  });

  it("no marca choque cuando no se solapan", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([{ id: "otra", inicio: "2026-09-01T16:00:00.000Z", duracion_min: 60 }]);
    crearCita.mockResolvedValue({ ...CITA_BASE, id: "nueva", inicio: "2026-09-01T17:00:00.000Z" });
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T17:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.body.choque).toBe(false);
  });

  it("devuelve las notas internas: el panel las usa, la restricción es solo en los correos", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    crearCita.mockResolvedValue({ ...CITA_BASE });
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
        notas: "Pidió llevar a su suegra, ojo con el horario",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.cita.notas).toBe("Pidió llevar a su suegra, ojo con el horario");
  });

  it("manda la confirmación al crear", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    crearCita.mockResolvedValue({ id: "nueva", cliente_email: "maria@example.com" });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María", cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z", lugar: "Llanada",
      }),
      res,
    );
    expect(enviarAhora).toHaveBeenCalledWith("confirmacion", expect.objectContaining({ id: "nueva" }));
    expect(res.body.correo).toBe("enviado");
  });

  it("si el correo falla, la cita igual queda guardada", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    crearCita.mockResolvedValue({ id: "nueva", cliente_email: "maria@example.com" });
    enviarAhora.mockRejectedValue(new Error("Resend 500"));
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María", cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z", lugar: "Llanada",
      }),
      res,
    );
    // Mismo criterio que /api/reserve: lo que ya se guardó no se pierde porque
    // falle un paso posterior.
    expect(res.statusCode).toBe(200);
    expect(res.body.cita.id).toBe("nueva");
    expect(res.body.correo).toBe("fallo");
  });

  it("PATCH que solo cambia las notas no manda correo: no hay nada visible que avisar", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    // db.ts ya decidió que este cambio no es visible (mismo inicio y lugar).
    actualizarCita.mockResolvedValue({
      cita: { ...CITA_BASE, notas: "Ahora sí confirmó, coordinar con el guarda" },
      cambioVisible: false,
    });
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
        notas: "Ahora sí confirmó, coordinar con el guarda",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    // Nada de "Cambio de hora" cuando la hora es la misma de siempre: eso
    // confundiría al cliente y le haría dejar de leer los correos.
    expect(enviarAhora).not.toHaveBeenCalled();
    expect(res.body.correo).toBe("no_aplica");
  });

  it("PATCH que mueve la hora manda el aviso de reagendado", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    // db.ts ya decidió que este cambio SÍ es visible (cambió el inicio).
    actualizarCita.mockResolvedValue({
      cita: { ...CITA_BASE, inicio: "2026-09-02T16:00:00+00:00" },
      cambioVisible: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-02T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(enviarAhora).toHaveBeenCalledWith(
      "reagendado",
      expect.objectContaining({ inicio: "2026-09-02T16:00:00+00:00" }),
    );
    expect(res.body.correo).toBe("enviado");
  });

  it("PATCH exitoso devuelve la cita y el choque, sin exponer cambioVisible", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    actualizarCita.mockResolvedValue({ cita: { ...CITA_BASE, lugar: "Oficina" }, cambioVisible: true });
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Oficina",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.cita.lugar).toBe("Oficina");
    expect(res.body.choque).toBe(false);
    // cambioVisible es insumo de la Task 7 (decidir si avisar al cliente), no
    // algo que este endpoint deba exponer en su JSON.
    expect(res.body).not.toHaveProperty("cambioVisible");
  });

  it("PATCH sobre una cita que no existe responde 404, no 500", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    actualizarCita.mockRejectedValue(new Error("Esa cita no existe."));
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "no-existe",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(404);
  });

  it("PATCH sobre una cita ya cancelada responde 409, no 500", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    actualizarCita.mockRejectedValue(new Error("Esa cita ya fue cancelada."));
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(409);
  });

  it("un error que no es ninguna de las dos frases conocidas sigue devolviendo 500", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    actualizarCita.mockRejectedValue(new Error("No se pudo actualizar la cita."));
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("DELETE cancela la cita y avisa al cliente", async () => {
    requireAgenda.mockResolvedValue(YO);
    cancelarCita.mockResolvedValue({ cita: { ...CITA_BASE, estado: "cancelada" }, seCancelo: true });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE", { id: "cita-1" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.cita.estado).toBe("cancelada");
    expect(enviarAhora).toHaveBeenCalledWith("cancelacion", expect.objectContaining({ id: "cita-1" }));
    expect(res.body.correo).toBe("enviado");
  });

  it("DELETE sobre una cita ya cancelada no manda un segundo correo", async () => {
    requireAgenda.mockResolvedValue(YO);
    // db.ts ya decidió que esta cancelación no hizo nada (idempotente).
    cancelarCita.mockResolvedValue({ cita: { ...CITA_BASE, estado: "cancelada" }, seCancelo: false });
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE", { id: "cita-1" }), res);
    expect(res.statusCode).toBe(200);
    expect(enviarAhora).not.toHaveBeenCalled();
    expect(res.body.correo).toBe("no_aplica");
  });

  it("DELETE sobre una cita que no existe responde 404, no 500", async () => {
    requireAgenda.mockResolvedValue(YO);
    cancelarCita.mockRejectedValue(new Error("Esa cita no existe."));
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE", { id: "no-existe" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("PATCH que solo cambia el correo del cliente manda confirmación, no reagendado", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    // db.ts ya decidió: cambió el destinatario, pero no hora ni lugar.
    actualizarCita.mockResolvedValue({
      cita: { ...CITA_BASE, cliente_email: "correcto@example.com" },
      cambioVisible: false,
      correoModificado: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "correcto@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    // La dirección nueva nunca vio nada de esta cita: es su primera noticia,
    // no un "Cambio de hora".
    expect(enviarAhora).toHaveBeenCalledWith(
      "confirmacion",
      expect.objectContaining({ cliente_email: "correcto@example.com" }),
    );
    expect(enviarAhora).not.toHaveBeenCalledWith("reagendado", expect.anything());
    expect(res.body.correo).toBe("enviado");
  });

  it("PATCH que cambia el correo Y la hora igual manda confirmación (gana sobre reagendado)", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    actualizarCita.mockResolvedValue({
      cita: { ...CITA_BASE, cliente_email: "correcto@example.com", inicio: "2026-09-02T16:00:00+00:00" },
      cambioVisible: true,
      correoModificado: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "correcto@example.com",
        inicio: "2026-09-02T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(enviarAhora).toHaveBeenCalledTimes(1);
    expect(enviarAhora).toHaveBeenCalledWith("confirmacion", expect.anything());
    expect(res.body.correo).toBe("enviado");
  });

  it("POST también acomoda los recordatorios de la cita nueva", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    const nueva = { ...CITA_BASE, id: "nueva" };
    crearCita.mockResolvedValue(nueva);
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("POST", {
        cliente_nombre: "María", cliente_email: "maria@example.com",
        inicio: "2026-09-01T16:00:00.000Z", lugar: "Llanada",
      }),
      res,
    );
    expect(aplicarRecordatorios).toHaveBeenCalledWith(nueva, expect.any(Date), {});
  });

  it("PATCH que cambia el correo del cliente pide recrear los recordatorios (van con la dirección nueva)", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    const cita = { ...CITA_BASE, cliente_email: "correcto@example.com" };
    actualizarCita.mockResolvedValue({ cita, cambioVisible: false, correoModificado: true });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "correcto@example.com",
        inicio: "2026-09-01T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(aplicarRecordatorios).toHaveBeenCalledWith(cita, expect.any(Date), { recrear: true });
  });

  it("PATCH que solo mueve la hora no pide recrear: el correo del cliente no cambió", async () => {
    requireAgenda.mockResolvedValue(YO);
    listarCitas.mockResolvedValue([]);
    const cita = { ...CITA_BASE, inicio: "2026-09-02T16:00:00+00:00" };
    actualizarCita.mockResolvedValue({ cita, cambioVisible: true, correoModificado: false });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-02T16:00:00.000Z",
        lugar: "Llanada",
      }),
      res,
    );
    expect(aplicarRecordatorios).toHaveBeenCalledWith(cita, expect.any(Date), { recrear: false });
  });

  it("DELETE también cancela los recordatorios pendientes de la cita", async () => {
    requireAgenda.mockResolvedValue(YO);
    const cancelada = { ...CITA_BASE, estado: "cancelada" as const };
    cancelarCita.mockResolvedValue({ cita: cancelada, seCancelo: true });
    enviarAhora.mockResolvedValue(undefined);
    const handler = await cargar();
    const res = resRecorder();
    await handler(req("DELETE", { id: "cita-1" }), res);
    expect(aplicarRecordatorios).toHaveBeenCalledWith(cancelada, expect.any(Date), {});
  });
});
