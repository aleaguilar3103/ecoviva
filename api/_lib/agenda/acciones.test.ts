import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorAgenda } from "./errores.js";

// ── Mock de operaciones.ts ──
// acciones.ts solo tiene que DESPACHAR a la función correcta con
// origen: "telegram" — el comportamiento real de cada operación (guardar +
// correo + recordatorios) ya tiene su propia batería en operaciones.test.ts.
const crearCitaCompleta = vi.fn();
const actualizarCitaCompleta = vi.fn();
const cancelarCitaCompleta = vi.fn();
vi.mock("./operaciones.js", () => ({
  crearCitaCompleta: (...a: unknown[]) => crearCitaCompleta(...a),
  actualizarCitaCompleta: (...a: unknown[]) => actualizarCitaCompleta(...a),
  cancelarCitaCompleta: (...a: unknown[]) => cancelarCitaCompleta(...a),
}));

// mover_cita y editar_cita solo traen lo que cambia: para armar el
// DatosCita completo que exige actualizarCitaCompleta hace falta leer la
// cita actual primero.
const obtenerCita = vi.fn();
vi.mock("./db.js", () => ({
  obtenerCita: (...a: unknown[]) => obtenerCita(...a),
}));

// ── Mock de supabase: tabla en memoria que modela agenda_acciones_pendientes ──
//
// Arreglo 5 (ronda de revisión): este comentario antes afirmaba que el mock
// reproducía una carrera concurrente real (dos SELECT que alcanzan a leer la
// fila viva antes de que cualquiera de los DELETE la borre). Eso es FALSO:
// el `resolver()` de acá abajo no tiene ninguna rama para `modo === "select"`
// — un `.select()` suelto (sin `.delete()` antes) siempre cae al `return
// { data: null, error: null }` del final, exista o no la fila. No modela una
// lectura real, así que no hay ningún SELECT "que alcanza a leer la fila
// viva" que simular: ese select ya vuelve `null` de entrada, sin importar
// concurrencia ni timing.
//
// Lo que este mock SÍ demuestra —y es lo único que hace falta para el test
// de abajo— es más simple: que `consumirAccion` hace del `delete()` (con las
// tres condiciones) su ÚNICA operación contra la tabla, sin un `select()`
// previo. Una implementación select-y-después-delete falla este test ya en
// su PRIMERA llamada (ese select suelto siempre da `null`, así que ni
// siquiera llega a hacer el delete), sin que haga falta ninguna concurrencia
// para que se note — un revisor lo confirmó revirtiendo el código y
// corriendo la versión SECUENCIAL (sin Promise.all) contra la implementación
// insegura: también da rojo, por esta misma razón. `Promise.all` sigue
// siendo la forma correcta de expresar "dos toques al mismo botón" en el
// test (es lo que pasaría de verdad), pero la garantía que este mock en
// particular puede probar es más chica de lo que decía el comentario
// original: "delete es la primera y única operación", no "sobrevive a una
// carrera real". La atomicidad de verdad —que Postgres serialice dos
// DELETE...WHERE concurrentes— no se puede demostrar contra una base en
// memoria de un solo hilo; eso solo lo garantiza Postgres en producción.
interface FilaAccion {
  id: string;
  chat_id: string;
  accion: unknown;
  expira_at: string;
}
let filas: FilaAccion[] = [];
let proximoId = 1;

function cadena() {
  let modo: "insert" | "delete" | "select" | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any = null;
  const filtros: { campo: keyof FilaAccion; op: "eq" | "gt"; valor: unknown }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  c.insert = (arg: unknown) => {
    modo = "insert";
    payload = arg;
    return c;
  };
  c.delete = () => {
    modo = "delete";
    return c;
  };
  c.select = () => {
    if (!modo) modo = "select";
    return c;
  };
  c.eq = (campo: keyof FilaAccion, valor: unknown) => {
    filtros.push({ campo, op: "eq", valor });
    return c;
  };
  c.gt = (campo: keyof FilaAccion, valor: unknown) => {
    filtros.push({ campo, op: "gt", valor });
    return c;
  };
  const coincide = (f: FilaAccion) =>
    filtros.every((flt) => {
      if (flt.op === "eq") return f[flt.campo] === flt.valor;
      return new Date(f[flt.campo] as string).getTime() > new Date(flt.valor as string).getTime();
    });
  const resolver = () => {
    if (modo === "insert") {
      const fila: FilaAccion = {
        id: `accion-${proximoId++}`,
        chat_id: payload.chat_id,
        accion: payload.accion,
        expira_at: payload.expira_at,
      };
      filas.push(fila);
      return { data: { id: fila.id }, error: null };
    }
    if (modo === "delete") {
      const idx = filas.findIndex(coincide);
      if (idx === -1) return { data: null, error: null };
      const [fila] = filas.splice(idx, 1);
      return { data: fila, error: null };
    }
    return { data: null, error: null };
  };
  c.single = () => Promise.resolve(resolver());
  c.maybeSingle = () => Promise.resolve(resolver());
  c.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(resolver()).then(
      onFulfilled as (v: unknown) => unknown,
      onRejected as (e: unknown) => unknown,
    );
  return c;
}

const from = vi.fn(() => cadena());
vi.mock("../supabase.js", () => ({ supabaseAdmin: () => ({ from }) }));

async function cargar() {
  vi.resetModules();
  return await import("./acciones");
}

beforeEach(() => {
  vi.clearAllMocks();
  filas = [];
  proximoId = 1;
});

const CITA_ACTUAL = {
  id: "c1",
  cliente_nombre: "María",
  cliente_email: "maria@example.com",
  cliente_telefono: "8888-0000",
  inicio: "2026-09-01T16:00:00+00:00",
  duracion_min: 60,
  lugar: "Llanada",
  lote_id: null,
  notas: "nota vieja",
  estado: "agendada" as const,
  ics_uid: "cita-c1@ecovivadesarrollos.com",
  ics_secuencia: 0,
  recordatorio_24h_email_id: null,
  recordatorio_1h_email_id: null,
  creada_por: "alina@ecoviva.test",
  created_at: "2026-08-01T00:00:00+00:00",
  updated_at: "2026-08-01T00:00:00+00:00",
};

function insertarFila(overrides: Partial<FilaAccion> = {}) {
  filas.push({
    id: "a1",
    chat_id: "999",
    accion: { herramienta: "cancelar_cita", entrada: { id: "c1" } },
    expira_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    ...overrides,
  });
}

describe("consumirAccion", () => {
  it("un solo uso: la primera llamada con el mismo id devuelve la acción, la segunda null", async () => {
    insertarFila();
    const { consumirAccion } = await cargar();
    const [r1, r2] = await Promise.all([consumirAccion("a1", "999"), consumirAccion("a1", "999")]);
    expect(r1).toEqual({ herramienta: "cancelar_cita", entrada: { id: "c1" } });
    expect(r2).toBeNull();
  });

  it("dueño: un chatId distinto al que guardó la acción devuelve null", async () => {
    insertarFila({ chat_id: "999" });
    const { consumirAccion } = await cargar();
    expect(await consumirAccion("a1", "otro-chat")).toBeNull();
    // La fila sigue viva: no era su dueño, no se consumió.
    expect(filas).toHaveLength(1);
  });

  it("expiración: una acción con expira_at en el pasado devuelve null", async () => {
    insertarFila({ expira_at: new Date(Date.now() - 1000).toISOString() });
    const { consumirAccion } = await cargar();
    expect(await consumirAccion("a1", "999")).toBeNull();
  });

  it("un id que no existe devuelve null sin reventar", async () => {
    const { consumirAccion } = await cargar();
    expect(await consumirAccion("no-existe", "999")).toBeNull();
  });
});

describe("guardarAccion", () => {
  it("guarda la acción con expiración de 10 minutos y devuelve el id", async () => {
    const { guardarAccion } = await cargar();
    const antes = Date.now();
    const id = await guardarAccion("999", { herramienta: "crear_cita", entrada: { cliente_nombre: "X" } });
    expect(typeof id).toBe("string");
    expect(filas).toHaveLength(1);
    expect(filas[0].chat_id).toBe("999");
    expect(filas[0].accion).toEqual({ herramienta: "crear_cita", entrada: { cliente_nombre: "X" } });
    const expiraMs = new Date(filas[0].expira_at).getTime();
    expect(expiraMs - antes).toBeGreaterThan(9 * 60_000);
    expect(expiraMs - antes).toBeLessThanOrEqual(10 * 60_000 + 1000);
  });
});

describe("ejecutarAccion — despacho", () => {
  it("crear_cita → llama a crearCitaCompleta con origen telegram", async () => {
    crearCitaCompleta.mockResolvedValue({ cita: CITA_ACTUAL, choque: false, correo: "enviado" });
    const { ejecutarAccion } = await cargar();
    await ejecutarAccion(
      {
        herramienta: "crear_cita",
        entrada: {
          cliente_nombre: "María",
          cliente_email: "maria@example.com",
          inicio: "2026-09-01T10:00:00-06:00",
          lugar: "Llanada",
        },
      },
      "alina@ecoviva.test",
    );
    expect(crearCitaCompleta).toHaveBeenCalledWith(
      expect.objectContaining({
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-09-01T10:00:00-06:00",
        lugar: "Llanada",
      }),
      "alina@ecoviva.test",
      "telegram",
    );
  });

  it("mover_cita → busca la cita actual (para completar los datos) y llama a actualizarCitaCompleta con origen telegram", async () => {
    obtenerCita.mockResolvedValue(CITA_ACTUAL);
    actualizarCitaCompleta.mockResolvedValue({ cita: CITA_ACTUAL, choque: false, correo: "enviado" });
    const { ejecutarAccion } = await cargar();
    await ejecutarAccion(
      { herramienta: "mover_cita", entrada: { id: "c1", inicio: "2026-09-02T10:00:00-06:00" } },
      "alina@ecoviva.test",
    );
    expect(obtenerCita).toHaveBeenCalledWith("c1");
    expect(actualizarCitaCompleta).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        inicio: "2026-09-02T10:00:00-06:00",
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        lugar: "Llanada",
      }),
      "alina@ecoviva.test",
      "telegram",
    );
  });

  it("editar_cita → busca la cita actual y llama a actualizarCitaCompleta con origen telegram", async () => {
    obtenerCita.mockResolvedValue(CITA_ACTUAL);
    actualizarCitaCompleta.mockResolvedValue({ cita: CITA_ACTUAL, choque: false, correo: "no_aplica" });
    const { ejecutarAccion } = await cargar();
    await ejecutarAccion(
      { herramienta: "editar_cita", entrada: { id: "c1", lugar: "Oficina EcoViva" } },
      "alejandro@ecoviva.test",
    );
    expect(actualizarCitaCompleta).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        lugar: "Oficina EcoViva",
        inicio: CITA_ACTUAL.inicio, // no lo trae editar_cita: se preserva
        cliente_nombre: CITA_ACTUAL.cliente_nombre,
      }),
      "alejandro@ecoviva.test",
      "telegram",
    );
  });

  it("cancelar_cita → llama a cancelarCitaCompleta con origen telegram", async () => {
    cancelarCitaCompleta.mockResolvedValue({ cita: CITA_ACTUAL, correo: "enviado" });
    const { ejecutarAccion } = await cargar();
    await ejecutarAccion({ herramienta: "cancelar_cita", entrada: { id: "c1" } }, "alina@ecoviva.test");
    expect(cancelarCitaCompleta).toHaveBeenCalledWith("c1", "alina@ecoviva.test", "telegram");
  });
});

describe("ejecutarAccion — el texto para la persona", () => {
  it("usa la fecha en formato largo en español", async () => {
    crearCitaCompleta.mockResolvedValue({
      cita: { ...CITA_ACTUAL, inicio: "2026-09-01T16:00:00+00:00" },
      choque: false,
      correo: "enviado",
    });
    const { ejecutarAccion } = await cargar();
    const texto = await ejecutarAccion(
      {
        herramienta: "crear_cita",
        entrada: {
          cliente_nombre: "María",
          cliente_email: "maria@example.com",
          inicio: "2026-09-01T10:00:00-06:00",
          lugar: "Llanada",
        },
      },
      "alina@ecoviva.test",
    );
    expect(texto).toMatch(/de septiembre de 2026/);
  });

  it("si el correo al cliente falló, lo dice claro sin sugerir que la cita no se guardó", async () => {
    crearCitaCompleta.mockResolvedValue({ cita: CITA_ACTUAL, choque: false, correo: "fallo" });
    const { ejecutarAccion } = await cargar();
    const texto = await ejecutarAccion(
      {
        herramienta: "crear_cita",
        entrada: {
          cliente_nombre: "María",
          cliente_email: "maria@example.com",
          inicio: "2026-09-01T10:00:00-06:00",
          lugar: "Llanada",
        },
      },
      "alina@ecoviva.test",
    );
    expect(texto).toMatch(/no se pudo mandar el correo/i);
    expect(texto).toMatch(/quedó guardada/i);
  });

  it("un ErrorAgenda de operaciones.ts se traduce a su propio mensaje, no al genérico", async () => {
    cancelarCitaCompleta.mockRejectedValue(
      new ErrorAgenda("conflicto", "Esa cita ya se realizó: no se puede cancelar."),
    );
    const { ejecutarAccion } = await cargar();
    const texto = await ejecutarAccion({ herramienta: "cancelar_cita", entrada: { id: "c1" } }, "alina@ecoviva.test");
    expect(texto).toBe("Esa cita ya se realizó: no se puede cancelar.");
  });

  it("mover_cita sobre una cita que ya no existe (se canceló/borró entre la propuesta y el toque) → avisa, no revienta", async () => {
    obtenerCita.mockResolvedValue(null);
    const { ejecutarAccion } = await cargar();
    const texto = await ejecutarAccion(
      { herramienta: "mover_cita", entrada: { id: "c1", inicio: "2026-09-02T10:00:00-06:00" } },
      "alina@ecoviva.test",
    );
    expect(texto).toMatch(/ya no existe/i);
    expect(actualizarCitaCompleta).not.toHaveBeenCalled();
  });

  it("un error inesperado no revienta: se loguea y se devuelve un texto genérico sin el detalle crudo", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    cancelarCitaCompleta.mockRejectedValue(new Error("boom de postgres"));
    const { ejecutarAccion } = await cargar();
    const texto = await ejecutarAccion({ herramienta: "cancelar_cita", entrada: { id: "c1" } }, "alina@ecoviva.test");
    expect(spy).toHaveBeenCalled();
    expect(texto).not.toMatch(/boom de postgres/);
    spy.mockRestore();
  });
});

// Arreglo 4 (ronda de revisión): `citas.cliente_email` es `text not null`
// SIN restricción de formato en la base, y `campoTexto` solo exige que el
// valor no esté vacío. Sin esta validación, una cita con el correo mal
// escrito se guarda igual, y el fallo de envío que viene después (Resend
// rechaza la dirección) es indistinguible — para quien lee el mensaje de
// Telegram — de un hipo transitorio: Alina o Alejandro podrían reintentar
// el reenvío desde el panel para siempre sin ninguna señal de que la causa
// es permanente. El panel (api/agenda/citas.ts, `correoValido`) ya rechaza
// esto de entrada; acá hace falta el mismo criterio.
describe("ejecutarAccion — validación del correo (Arreglo 4)", () => {
  it("crear_cita con un correo malformado no llama a crearCitaCompleta y avisa que hay que corregirlo", async () => {
    const { ejecutarAccion } = await cargar();
    const texto = await ejecutarAccion(
      {
        herramienta: "crear_cita",
        entrada: {
          cliente_nombre: "María",
          cliente_email: "maria-arroba-mal-escrito",
          inicio: "2026-09-01T10:00:00-06:00",
          lugar: "Llanada",
        },
      },
      "alina@ecoviva.test",
    );
    expect(crearCitaCompleta).not.toHaveBeenCalled();
    expect(texto).toMatch(/correo/i);
    expect(texto).toMatch(/no parece válido|inválido/i);
  });

  it("crear_cita con un correo válido pero con mayúsculas y espacios lo normaliza antes de guardar", async () => {
    crearCitaCompleta.mockResolvedValue({ cita: CITA_ACTUAL, choque: false, correo: "enviado" });
    const { ejecutarAccion } = await cargar();
    await ejecutarAccion(
      {
        herramienta: "crear_cita",
        entrada: {
          cliente_nombre: "María",
          cliente_email: "  Maria@Example.COM  ",
          inicio: "2026-09-01T10:00:00-06:00",
          lugar: "Llanada",
        },
      },
      "alina@ecoviva.test",
    );
    expect(crearCitaCompleta).toHaveBeenCalledWith(
      expect.objectContaining({ cliente_email: "maria@example.com" }),
      "alina@ecoviva.test",
      "telegram",
    );
  });

  it("editar_cita con un correo nuevo malformado no llama a actualizarCitaCompleta y avisa", async () => {
    obtenerCita.mockResolvedValue(CITA_ACTUAL);
    const { ejecutarAccion } = await cargar();
    const texto = await ejecutarAccion(
      { herramienta: "editar_cita", entrada: { id: "c1", cliente_email: "no-es-un-correo" } },
      "alina@ecoviva.test",
    );
    expect(actualizarCitaCompleta).not.toHaveBeenCalled();
    expect(texto).toMatch(/correo/i);
  });

  it("editar_cita sin tocar el correo no lo valida de nuevo (usa el que ya tenía la cita)", async () => {
    obtenerCita.mockResolvedValue(CITA_ACTUAL);
    actualizarCitaCompleta.mockResolvedValue({ cita: CITA_ACTUAL, choque: false, correo: "no_aplica" });
    const { ejecutarAccion } = await cargar();
    await ejecutarAccion(
      { herramienta: "editar_cita", entrada: { id: "c1", lugar: "Oficina EcoViva" } },
      "alina@ecoviva.test",
    );
    expect(actualizarCitaCompleta).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ cliente_email: CITA_ACTUAL.cliente_email, lugar: "Oficina EcoViva" }),
      "alina@ecoviva.test",
      "telegram",
    );
  });
});
