import { describe, it, expect, vi, beforeEach } from "vitest";

const crearCita = vi.fn();
const actualizarCita = vi.fn();
const cancelarCita = vi.fn();
const obtenerCita = vi.fn();
const listarCitas = vi.fn();
const registrarReenvio = vi.fn();
const enviarAhora = vi.fn();
const aplicarRecordatorios = vi.fn();
const avisarCambio = vi.fn();

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
// Task 6: avisos.ts también se mockea acá — sus propias reglas (a quién le
// llega, que nunca tira) ya las prueba avisos.test.ts; acá solo importa que
// operaciones.ts lo invoque con los datos y el momento correctos.
vi.mock("./avisos.js", () => ({
  avisarCambio: (...a: unknown[]) => avisarCambio(...a),
}));

async function cargar() {
  vi.resetModules();
  return await import("./operaciones");
}

beforeEach(() => {
  [crearCita, actualizarCita, cancelarCita, obtenerCita, listarCitas,
   registrarReenvio, enviarAhora, aplicarRecordatorios, avisarCambio].forEach((m) => m.mockReset());
  aplicarRecordatorios.mockResolvedValue(undefined);
  listarCitas.mockResolvedValue([]);
  avisarCambio.mockResolvedValue(undefined);
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
    expect(avisarCambio).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "creada", "yo@x.com");
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

  // Arreglo 1 (ronda de revisión de Task 1): este es el caso crítico que
  // faltaba. Todos los tests de arriba con `cambioVisible: true` también
  // tienen `correoModificado: true`, así que ninguno distingue
  // `recrear = cambioVisible || correoModificado` de una degradación a
  // `recrear = correoModificado` — que es exactamente el bug que C1 arregló
  // (reagendar dejaba los recordatorios con el contenido viejo, y el
  // cliente recibía "mañana a las [hora vieja]"). Este test aísla
  // `cambioVisible: true` con `correoModificado: false`.
  it("mover solo la hora (correo sin cambios) también pide recrear los recordatorios", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS }, cambioVisible: true, correoModificado: false,
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

  it("cancelar de verdad avisa al equipo con 'cancelada'", async () => {
    cancelarCita.mockResolvedValue({ cita: { id: "c1", ...DATOS }, seCancelo: true });
    const { cancelarCitaCompleta } = await cargar();
    await cancelarCitaCompleta("c1", "yo@x.com", "telegram");
    expect(avisarCambio).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "cancelada", "yo@x.com");
  });

  it("no avisa al equipo si ya estaba cancelada (mismo idempotente que el correo)", async () => {
    cancelarCita.mockResolvedValue({ cita: { id: "c1", ...DATOS }, seCancelo: false });
    const { cancelarCitaCompleta } = await cargar();
    await cancelarCitaCompleta("c1", "yo@x.com", "telegram");
    expect(avisarCambio).not.toHaveBeenCalled();
  });
});

// Task 6: el aviso al equipo se dispara desde acá — no desde el endpoint del
// panel ni desde el webhook del bot — para que salga igual venga el cambio
// de donde venga. avisarCambio en sí (a quién le llega, que nunca tira) ya
// lo prueba avisos.test.ts; acá solo importa la orquestación.
describe("aviso al equipo (Task 6)", () => {
  it("actualizar con cambio de hora avisa 'movida'", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS },
      cambioVisible: true,
      correoModificado: false,
      inicioModificado: true,
    });
    enviarAhora.mockResolvedValue(undefined);
    const { actualizarCitaCompleta } = await cargar();
    await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(avisarCambio).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "movida", "yo@x.com");
  });

  it("actualizar sin cambio de hora (solo lugar u otro campo) avisa 'editada'", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS },
      cambioVisible: true,
      correoModificado: false,
      inicioModificado: false,
    });
    enviarAhora.mockResolvedValue(undefined);
    const { actualizarCitaCompleta } = await cargar();
    await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(avisarCambio).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "editada", "yo@x.com");
  });

  it("avisa al equipo aunque el cambio no sea visible para el cliente (p. ej. solo notas)", async () => {
    actualizarCita.mockResolvedValue({
      cita: { id: "c1", ...DATOS },
      cambioVisible: false,
      correoModificado: false,
      inicioModificado: false,
    });
    const { actualizarCitaCompleta } = await cargar();
    const r = await actualizarCitaCompleta("c1", DATOS, "yo@x.com", "telegram");
    expect(r.correo).toBe("no_aplica"); // al cliente no le llegó nada...
    expect(avisarCambio).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1" }), "editada", "yo@x.com",
    ); // ...pero al equipo sí.
  });

  it("un fallo de avisarCambio no tumba la operación (segunda red de seguridad del .catch)", async () => {
    crearCita.mockResolvedValue({ id: "c1", ...DATOS });
    enviarAhora.mockResolvedValue(undefined);
    avisarCambio.mockRejectedValue(new Error("avisos.ts se rompió"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { crearCitaCompleta } = await cargar();
    const r = await crearCitaCompleta(DATOS, "yo@x.com", "telegram");
    expect(r.cita.id).toBe("c1");
    expect(r.correo).toBe("enviado");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
