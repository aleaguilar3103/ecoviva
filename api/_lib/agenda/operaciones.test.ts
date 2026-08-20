import { describe, it, expect, vi, beforeEach } from "vitest";

const crearCita = vi.fn();
const actualizarCita = vi.fn();
const cancelarCita = vi.fn();
const obtenerCita = vi.fn();
const listarCitas = vi.fn();
const registrarReenvio = vi.fn();
const enviarAhora = vi.fn();
const aplicarRecordatorios = vi.fn();

vi.mock("./db.js", () => ({
  crearCita: (...a: unknown[]) => crearCita(...a),
  actualizarCita: (...a: unknown[]) => actualizarCita(...a),
  cancelarCita: (...a: unknown[]) => cancelarCita(...a),
  obtenerCita: (...a: unknown[]) => obtenerCita(...a),
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  registrarReenvio: (...a: unknown[]) => registrarReenvio(...a),
}));
vi.mock("./email.js", () => ({ enviarAhora: (...a: unknown[]) => enviarAhora(...a) }));
vi.mock("./recordatorios.js", () => ({
  aplicarRecordatorios: (...a: unknown[]) => aplicarRecordatorios(...a),
}));

async function cargar() {
  vi.resetModules();
  return await import("./operaciones");
}

beforeEach(() => {
  [crearCita, actualizarCita, cancelarCita, obtenerCita, listarCitas,
   registrarReenvio, enviarAhora, aplicarRecordatorios].forEach((m) => m.mockReset());
  aplicarRecordatorios.mockResolvedValue(undefined);
  listarCitas.mockResolvedValue([]);
});

const DATOS = {
  cliente_nombre: "María",
  cliente_email: "maria@example.com",
  inicio: "2026-09-01T16:00:00.000Z",
  lugar: "Visita Llanada",
};

describe("crearCitaCompleta", () => {
  it("guarda, manda confirmación y acomoda recordatorios", async () => {
    crearCita.mockResolvedValue({ id: "c1", ...DATOS });
    enviarAhora.mockResolvedValue(undefined);
    const { crearCitaCompleta } = await cargar();
    const r = await crearCitaCompleta(DATOS, "yo@x.com", "telegram");
    expect(crearCita).toHaveBeenCalledWith(DATOS, "yo@x.com", "telegram");
    expect(enviarAhora).toHaveBeenCalledWith("confirmacion", expect.objectContaining({ id: "c1" }));
    expect(aplicarRecordatorios).toHaveBeenCalled();
    expect(r.correo).toBe("enviado");
  });

  it("si el correo falla, la cita igual queda", async () => {
    crearCita.mockResolvedValue({ id: "c1", ...DATOS });
    enviarAhora.mockRejectedValue(new Error("Resend caído"));
    const { crearCitaCompleta } = await cargar();
    const r = await crearCitaCompleta(DATOS, "yo@x.com", "telegram");
    expect(r.cita.id).toBe("c1");
    expect(r.correo).toBe("fallo");
  });
});

describe("actualizarCitaCompleta", () => {
  it("cambio de correo gana sobre cambio de hora", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS }, cambioVisible: true, correoModificado: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const { actualizarCitaCompleta } = await cargar();
    await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(enviarAhora).toHaveBeenCalledWith("confirmacion", expect.anything());
  });

  it("cambio invisible no manda nada", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS }, cambioVisible: false, correoModificado: false,
    });
    const { actualizarCitaCompleta } = await cargar();
    const r = await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(enviarAhora).not.toHaveBeenCalled();
    expect(r.correo).toBe("no_aplica");
  });

  it("recrea los recordatorios cuando cambió el correo", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS }, cambioVisible: false, correoModificado: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const { actualizarCitaCompleta } = await cargar();
    await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(aplicarRecordatorios).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.objectContaining({ recrear: true }),
    );
  });
});

describe("cancelarCitaCompleta", () => {
  it("no manda un segundo correo si ya estaba cancelada", async () => {
    cancelarCita.mockResolvedValue({ cita: { id: "c1", ...DATOS }, seCancelo: false });
    const { cancelarCitaCompleta } = await cargar();
    const r = await cancelarCitaCompleta("c1", "yo@x.com", "telegram");
    expect(enviarAhora).not.toHaveBeenCalled();
    expect(r.correo).toBe("no_aplica");
  });
});
