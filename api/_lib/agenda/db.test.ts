import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de bajo nivel del cliente de Supabase: en vez de reproducir toda la
// cadena real de supabase-js, `from()` va sacando la próxima respuesta de una
// cola en el orden en que el código bajo prueba hace las consultas. `select`,
// `eq`, `update`, `insert` delegan a espías compartidos.
const updateSpy = vi.fn();
const insertSpy = vi.fn();
const selectSpy = vi.fn();
const eqSpy = vi.fn();
let colaFrom: unknown[] = [];

function crearCadena(resolver: () => unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadena: any = {};
  const self = () => cadena;
  cadena.select = vi.fn((arg: unknown) => {
    selectSpy(arg);
    return cadena;
  });
  cadena.eq = vi.fn((arg: unknown) => {
    eqSpy(arg);
    return cadena;
  });
  cadena.gte = vi.fn(self);
  cadena.lte = vi.fn(self);
  cadena.neq = vi.fn(self);
  cadena.order = vi.fn(self);
  cadena.insert = vi.fn((arg: unknown) => {
    insertSpy(arg);
    return cadena;
  });
  cadena.update = vi.fn((arg: unknown) => {
    updateSpy(arg);
    return cadena;
  });
  cadena.single = vi.fn(() => Promise.resolve(resolver()));
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

vi.mock("../supabase.js", () => ({
  supabaseAdmin: () => db,
}));

// El módulo no cachea nada, se recarga por consistencia.
async function cargar() {
  vi.resetModules();
  return await import("./db");
}

const CITA_ANTES = {
  id: "cita-1",
  cliente_nombre: "Juan",
  cliente_email: "juan@test.com",
  cliente_telefono: "+34 666 777 888",
  inicio: "2026-09-01T16:00:00+00:00", // Postgres: offset +00:00
  duracion_min: 60,
  lugar: "Lote 42",
  lote_id: "lote-42",
  notas: "Cliente importante",
  estado: "agendada" as const,
  ics_uid: "cita-abc@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "admin",
  created_at: "2026-08-01T10:00:00+00:00",
  updated_at: "2026-08-01T10:00:00+00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  colaFrom = [];
});

describe("actualizarCita", () => {
  it("1: cambios vacío → cambioVisible false, sin incremento de ics_secuencia, acción 'editada'", async () => {
    const { actualizarCita } = await cargar();
    colaFrom = [
      { data: CITA_ANTES, error: null }, // obtenerCita (chequeo de existencia)
      { data: { ...CITA_ANTES, ics_secuencia: 0 }, error: null }, // update (no incrementa)
      { data: null, error: null }, // registrar (insert a citas_log)
    ];
    const resultado = await actualizarCita("cita-1", {}, "admin", "panel");
    expect(resultado.cambioVisible).toBe(false);
    // El update NO debe incluir ics_secuencia
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).toEqual({});
    // Verificar que la bitácora registra acción "editada"
    const logPayload = insertSpy.mock.calls[0]?.[0];
    expect(logPayload?.accion).toBe("editada");
  });

  it("2: cambios.inicio con el mismo string que antes → cambioVisible false", async () => {
    const { actualizarCita } = await cargar();
    const inicio = "2026-09-01T16:00:00+00:00";
    colaFrom = [
      { data: CITA_ANTES, error: null },
      { data: { ...CITA_ANTES, ics_secuencia: 0 }, error: null },
      { data: null, error: null },
    ];
    const resultado = await actualizarCita("cita-1", { inicio }, "admin", "panel");
    expect(resultado.cambioVisible).toBe(false);
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).toEqual({ inicio });
    expect(payload).not.toHaveProperty("ics_secuencia");
  });

  it("3: mismo instante pero formato distinto (Z vs +00:00) → cambioVisible false (BUG REPRO)", async () => {
    const { actualizarCita } = await cargar();
    // Postgres devuelve: 2026-09-01T16:00:00+00:00
    // Panel arma: 2026-09-01T16:00:00.000Z (same instant, different format)
    const inicioEnFormatoPanel = "2026-09-01T16:00:00.000Z";
    colaFrom = [
      { data: CITA_ANTES, error: null }, // obtenerCita
      { data: { ...CITA_ANTES, ics_secuencia: 0 }, error: null }, // update
      { data: null, error: null }, // registrar
    ];
    const resultado = await actualizarCita(
      "cita-1",
      { inicio: inicioEnFormatoPanel },
      "admin",
      "panel",
    );
    // Este test FALLA antes del arreglo (comparación de string):
    // el código vería inicioEnFormatoPanel !== "2026-09-01T16:00:00+00:00" → true
    // y marcaría cambioVisible = true erróneamente.
    expect(resultado.cambioVisible).toBe(false);
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty("ics_secuencia");
  });

  it("4: cambios.inicio con hora distinta → cambioVisible true, incremento, acción 'movida'", async () => {
    const { actualizarCita } = await cargar();
    const inicioNuevo = "2026-09-02T17:00:00+00:00"; // hora distinta
    colaFrom = [
      { data: CITA_ANTES, error: null },
      { data: { ...CITA_ANTES, inicio: inicioNuevo, ics_secuencia: 1 }, error: null },
      { data: null, error: null },
    ];
    const resultado = await actualizarCita("cita-1", { inicio: inicioNuevo }, "admin", "panel");
    expect(resultado.cambioVisible).toBe(true);
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).toHaveProperty("ics_secuencia", 1);
    // Verificar que la bitácora registra acción "movida" (no "editada")
    const logPayload = insertSpy.mock.calls[0]?.[0];
    expect(logPayload?.accion).toBe("movida");
  });

  it("5: cambios.lugar distinto (sin cambios.inicio) → cambioVisible true, incremento, acción 'editada' (NO 'movida')", async () => {
    const { actualizarCita } = await cargar();
    const lugarNuevo = "Lote 43";
    colaFrom = [
      { data: CITA_ANTES, error: null },
      { data: { ...CITA_ANTES, lugar: lugarNuevo, ics_secuencia: 1 }, error: null },
      { data: null, error: null },
    ];
    const resultado = await actualizarCita("cita-1", { lugar: lugarNuevo }, "admin", "panel");
    expect(resultado.cambioVisible).toBe(true);
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).toHaveProperty("ics_secuencia", 1);
    // Esta aserción discrimina el ternario: lugar distinto sin cambio de inicio debe ser "editada", no "movida"
    const logPayload = insertSpy.mock.calls[0]?.[0];
    expect(logPayload?.accion).toBe("editada");
  });

  it("6: cambios.notas → cambioVisible false, sin incremento", async () => {
    const { actualizarCita } = await cargar();
    colaFrom = [
      { data: CITA_ANTES, error: null },
      { data: { ...CITA_ANTES, notas: "Cliente VIP", ics_secuencia: 0 }, error: null },
      { data: null, error: null },
    ];
    const resultado = await actualizarCita("cita-1", { notas: "Cliente VIP" }, "admin", "panel");
    expect(resultado.cambioVisible).toBe(false);
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty("ics_secuencia");
  });

  it("7: objeto cambios NO es mutado (sin ics_secuencia inyectado)", async () => {
    const { actualizarCita } = await cargar();
    // Usar un escenario donde cambioVisible es TRUE, para que la línea mutante se ejecute.
    // Con lugar distinto, la asignación a updateObj.ics_secuencia ocurre dentro del if.
    const cambios = { lugar: "Oficina Central" };
    const cambioDespues = JSON.parse(JSON.stringify(cambios)); // copia profunda
    colaFrom = [
      { data: CITA_ANTES, error: null }, // antes.lugar = "Lote 42"
      { data: { ...CITA_ANTES, lugar: "Oficina Central", ics_secuencia: 1 }, error: null },
      { data: null, error: null },
    ];
    await actualizarCita("cita-1", cambios, "admin", "panel");
    // Verificar que cambios sigue siendo exactamente lo que pasamos, sin ics_secuencia inyectado.
    // Si el bug estuviera presente (const updateObj = cambios en vez de { ...cambios }),
    // esta aserción fallaría porque cambios tendría ahora ics_secuencia: 1.
    expect(cambios).toEqual(cambioDespues);
    expect(Object.keys(cambios)).not.toContain("ics_secuencia");
    expect(cambios).toEqual({ lugar: "Oficina Central" });
  });

  it("8: cambios.cliente_email distinto → correoModificado true, incrementa ics_secuencia", async () => {
    const { actualizarCita } = await cargar();
    colaFrom = [
      { data: CITA_ANTES, error: null }, // antes.cliente_email = "juan@test.com"
      { data: { ...CITA_ANTES, cliente_email: "otro@test.com", ics_secuencia: 1 }, error: null },
      { data: null, error: null },
    ];
    const resultado = await actualizarCita(
      "cita-1",
      { cliente_email: "otro@test.com" },
      "admin",
      "panel",
    );
    expect(resultado.correoModificado).toBe(true);
    // El correo no es "visible" en el sentido de hora/lugar: cambiarlo solo a
    // él no debe disparar un "Cambio de hora".
    expect(resultado.cambioVisible).toBe(false);
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).toHaveProperty("ics_secuencia", 1);
  });

  it("9: cambios.cliente_email con mayúsculas/espacios pero mismo valor normalizado → correoModificado false, sin incremento (BUG REPRO)", async () => {
    const { actualizarCita } = await cargar();
    colaFrom = [
      { data: CITA_ANTES, error: null }, // antes.cliente_email = "juan@test.com"
      { data: { ...CITA_ANTES, ics_secuencia: 0 }, error: null },
      { data: null, error: null },
    ];
    // Mismo destinatario, solo tipeado distinto — corregir esto no debería
    // contar como un cambio real de correo.
    const resultado = await actualizarCita(
      "cita-1",
      { cliente_email: " Juan@Test.com " },
      "admin",
      "panel",
    );
    // Este test FALLA sin normalizar (comparación cruda de string): " Juan@Test.com "
    // !== "juan@test.com" → true, y marcaría correoModificado erróneamente.
    expect(resultado.correoModificado).toBe(false);
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty("ics_secuencia");
  });
});

describe("cancelarCita", () => {
  it("cancela una cita agendada → seCancelo true, sube ics_secuencia, registra 'cancelada'", async () => {
    const { cancelarCita } = await cargar();
    colaFrom = [
      { data: CITA_ANTES, error: null }, // obtenerCita: estado "agendada"
      { data: { ...CITA_ANTES, estado: "cancelada", ics_secuencia: 1 }, error: null }, // update
      { data: null, error: null }, // registrar
    ];
    const resultado = await cancelarCita("cita-1", "admin", "panel");
    expect(resultado.seCancelo).toBe(true);
    expect(resultado.cita.estado).toBe("cancelada");
    const payload = updateSpy.mock.calls[0]?.[0];
    expect(payload).toHaveProperty("ics_secuencia", 1);
    const logPayload = insertSpy.mock.calls[0]?.[0];
    expect(logPayload?.accion).toBe("cancelada");
  });

  it("cancelar una cita YA cancelada es idempotente: seCancelo false, no vuelve a tocar la fila ni la bitácora", async () => {
    const { cancelarCita } = await cargar();
    colaFrom = [
      { data: { ...CITA_ANTES, estado: "cancelada" }, error: null }, // obtenerCita
    ];
    const resultado = await cancelarCita("cita-1", "admin", "panel");
    // Este test FALLA si el código siempre reporta seCancelo: true (el bug
    // que manda un segundo correo de cancelación por un doble clic).
    expect(resultado.seCancelo).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
