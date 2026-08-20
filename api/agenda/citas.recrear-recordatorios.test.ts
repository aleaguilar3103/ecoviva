import { describe, it, expect, vi, beforeEach } from "vitest";

// C1 (crítico): al reagendar, los recordatorios ya programados en Resend
// tenían que RECREARSE (cancelar + programar de nuevo con el contenido
// actual), no REPROGRAMARSE (mover solo `scheduled_at`, dejando asunto,
// cuerpo y .ics con la fecha/lugar viejos). Este archivo prueba la costura
// real entre citas.ts → email.ts → recordatorios.ts, así que a propósito NO
// se mockean ni email.js ni recordatorios.js: mockearlas escondería
// justamente el bug que este archivo existe para atrapar. Solo se mockean
// los bordes externos: supabase (permiso), db.js (persistencia) y resend.js
// (la API HTTP real).
const requireAgenda = vi.fn();
const listarCitas = vi.fn();
const actualizarCita = vi.fn();
const obtenerCita = vi.fn();
const guardarIdsRecordatorio = vi.fn();

const enviarCorreoResend = vi.fn();
const reprogramarCorreoResend = vi.fn();
const cancelarCorreoResend = vi.fn();
const avisarCambio = vi.fn();

vi.mock("../_lib/supabase.js", () => ({
  requireAgenda: (...a: unknown[]) => requireAgenda(...a),
}));
vi.mock("../_lib/agenda/db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  crearCita: vi.fn(),
  actualizarCita: (...a: unknown[]) => actualizarCita(...a),
  cancelarCita: vi.fn(),
  obtenerCita: (...a: unknown[]) => obtenerCita(...a),
  guardarIdsRecordatorio: (...a: unknown[]) => guardarIdsRecordatorio(...a),
}));
vi.mock("../_lib/agenda/resend.js", () => ({
  enviarCorreo: (...a: unknown[]) => enviarCorreoResend(...a),
  reprogramarCorreo: (...a: unknown[]) => reprogramarCorreoResend(...a),
  cancelarCorreo: (...a: unknown[]) => cancelarCorreoResend(...a),
}));
// avisarCambio (el aviso al equipo, no al cliente) es ajeno a lo que este
// archivo prueba (C1: recrear vs. reprogramar recordatorios) — mockearlo
// no esconde nada del bug que este archivo existe para atrapar, y evita
// que operaciones.ts corra la implementación real de avisos.ts (que
// revienta contra supabaseAdmin, no exportado en el mock de arriba).
vi.mock("../_lib/agenda/avisos.js", () => ({
  avisarCambio: (...a: unknown[]) => avisarCambio(...a),
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

const CITA_ORIGINAL = {
  id: "cita-1",
  cliente_nombre: "María",
  cliente_email: "maria@example.com",
  cliente_telefono: null,
  inicio: "2026-09-01T16:00:00+00:00", // fecha/lugar VIEJOS
  duracion_min: 60,
  lugar: "Oficina",
  lote_id: null,
  notas: null,
  estado: "agendada" as const,
  ics_uid: "cita-abc@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: "resend_id_24h_viejo",
  recordatorio_1h_email_id: "resend_id_1h_viejo",
  creada_por: "alinaramirezgamboa@gmail.com",
  created_at: "2026-08-18T10:00:00+00:00",
  updated_at: "2026-08-18T10:00:00+00:00",
};

beforeEach(() => {
  requireAgenda.mockReset();
  listarCitas.mockReset();
  actualizarCita.mockReset();
  obtenerCita.mockReset();
  guardarIdsRecordatorio.mockReset();
  enviarCorreoResend.mockReset();
  reprogramarCorreoResend.mockReset();
  cancelarCorreoResend.mockReset();
  avisarCambio.mockReset();

  requireAgenda.mockResolvedValue(YO);
  avisarCambio.mockResolvedValue(undefined);
  listarCitas.mockResolvedValue([]); // sin solape
  guardarIdsRecordatorio.mockResolvedValue(undefined);
  cancelarCorreoResend.mockResolvedValue(undefined);
  reprogramarCorreoResend.mockResolvedValue(undefined);
  enviarCorreoResend.mockResolvedValue("id-nuevo-en-resend");
});

describe("PATCH /api/agenda/citas — C1: reagendar recrea los recordatorios, no los reprograma", () => {
  it("mover la hora y el lugar recrea (cancela+reenvía) los recordatorios con el contenido NUEVO, nunca reprograma los viejos", async () => {
    // 5 días adelante: dentro de la ventana de 30 días de Resend y con
    // margen de sobra para que los dos recordatorios (24h y 1h) apliquen.
    const inicioNuevo = new Date(Date.now() + 5 * 24 * 60 * 60_000).toISOString();
    const lugarNuevo = "Visita Lomas de la Llanada";

    const citaReagendada = {
      ...CITA_ORIGINAL,
      inicio: inicioNuevo,
      lugar: lugarNuevo,
      ics_secuencia: 1,
    };
    // db.ts (mockeado) ya decidió: cambió la hora, así que cambioVisible es
    // true; el correo del cliente no cambió.
    actualizarCita.mockResolvedValue({
      cita: citaReagendada,
      cambioVisible: true,
      correoModificado: false,
    });

    const handler = await cargar();
    const res = resRecorder();
    await handler(
      req("PATCH", {
        id: "cita-1",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: inicioNuevo,
        lugar: lugarNuevo,
      }),
      res,
    );

    expect(res.statusCode).toBe(200);

    // Los dos recordatorios viejos se dan de baja en Resend...
    expect(cancelarCorreoResend).toHaveBeenCalledWith("resend_id_24h_viejo");
    expect(cancelarCorreoResend).toHaveBeenCalledWith("resend_id_1h_viejo");
    // ...y NUNCA se reprograma un envío viejo: reprogramar solo mueve
    // `scheduled_at`, dejando el contenido (fecha, hora, lugar) congelado en
    // lo que era la cita antes de moverla. Esto es lo que rompía el bug.
    expect(reprogramarCorreoResend).not.toHaveBeenCalled();

    // Todos los correos que salieron (la notificación inmediata de
    // "reagendado" + los dos recordatorios recreados) llevan el lugar
    // NUEVO y ninguno lleva el viejo.
    expect(enviarCorreoResend.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const [opts] of enviarCorreoResend.mock.calls) {
      const html = (opts as { html: string }).html;
      expect(html).toContain(lugarNuevo);
      expect(html).not.toContain("Oficina");
    }
  });
});
