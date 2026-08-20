import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: (...a: unknown[]) => create(...a) }; },
}));

const listarCitas = vi.fn();
const obtenerCita = vi.fn();
vi.mock("./db.js", () => ({
  listarCitas: (...a: unknown[]) => listarCitas(...a),
  obtenerCita: (...a: unknown[]) => obtenerCita(...a),
}));

async function cargar() {
  vi.resetModules();
  return await import("./agente");
}

// Una respuesta del modelo pidiendo una herramienta.
function pideHerramienta(name: string, input: unknown) {
  return {
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "tu_1", name, input }],
  };
}
function respondeTexto(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

beforeEach(() => {
  create.mockReset();
  listarCitas.mockReset();
  obtenerCita.mockReset();
  process.env.ANTHROPIC_API_KEY = "test";
});

const AHORA = new Date("2026-08-19T18:00:00.000Z"); // mediodía en Costa Rica

describe("correrAgente", () => {
  it("NUNCA ejecuta una herramienta de escritura: la devuelve para confirmar", async () => {
    create.mockResolvedValueOnce(
      pideHerramienta("crear_cita", {
        cliente_nombre: "María",
        cliente_email: "maria@example.com",
        inicio: "2026-08-21T10:00:00-06:00",
        lugar: "Visita Llanada",
      }),
    );
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "agendá a María el jueves a las 10", historial: [], ahora: AHORA });

    expect(r.tipo).toBe("confirmar");
    if (r.tipo !== "confirmar") throw new Error("no era confirmar");
    expect(r.accion.herramienta).toBe("crear_cita");
    // Y lo esencial: el modelo se llamó UNA sola vez. No hubo segunda vuelta
    // alimentando un resultado, porque la herramienta no se ejecutó.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("las cuatro herramientas de escritura cortan el turno", async () => {
    const { ESCRITURAS, correrAgente } = await cargar();
    expect([...ESCRITURAS].sort()).toEqual(
      ["cancelar_cita", "crear_cita", "editar_cita", "mover_cita"],
    );
    for (const nombre of ESCRITURAS) {
      create.mockReset();
      create.mockResolvedValueOnce(pideHerramienta(nombre, { id: "c1" }));
      const r = await correrAgente({ mensaje: "hacelo", historial: [], ahora: AHORA });
      expect(r.tipo).toBe("confirmar");
      expect(create).toHaveBeenCalledTimes(1);
    }
  });

  it("las herramientas de lectura sí se ejecutan y el bucle sigue", async () => {
    listarCitas.mockResolvedValue([]);
    create
      .mockResolvedValueOnce(pideHerramienta("buscar_citas", { desde: "2026-08-19", hasta: "2026-08-26" }))
      .mockResolvedValueOnce(respondeTexto("No tenés nada esta semana."));
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "qué tengo esta semana", historial: [], ahora: AHORA });

    expect(listarCitas).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ tipo: "texto", texto: "No tenés nada esta semana." });
  });

  it("el prompt le dice al modelo la fecha y hora de Costa Rica", async () => {
    create.mockResolvedValueOnce(respondeTexto("ok"));
    const { correrAgente } = await cargar();
    await correrAgente({ mensaje: "hola", historial: [], ahora: AHORA });

    const system = create.mock.calls[0][0].system as string;
    expect(system).toContain("miércoles");   // 19 de agosto de 2026 es miércoles
    expect(system).toContain("19 de agosto");
    expect(system).toContain("America/Costa_Rica");
  });

  it("no manda parámetros que el modelo rechaza", async () => {
    create.mockResolvedValueOnce(respondeTexto("ok"));
    const { correrAgente } = await cargar();
    await correrAgente({ mensaje: "hola", historial: [], ahora: AHORA });

    const params = create.mock.calls[0][0];
    // Estos cuatro devuelven 400 en el modelo configurado.
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
    expect(params.thinking?.budget_tokens).toBeUndefined();
  });

  it("si el modelo se niega, responde con calma y sin romperse", async () => {
    create.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "...", historial: [], ahora: AHORA });
    expect(r.tipo).toBe("texto");
  });

  it("corta si el modelo se queda dando vueltas entre lecturas", async () => {
    listarCitas.mockResolvedValue([]);
    create.mockResolvedValue(pideHerramienta("buscar_citas", {}));
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "buscá", historial: [], ahora: AHORA });
    expect(r.tipo).toBe("texto");
    expect(create.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("si pide dos escrituras a la vez, toma una sola y lo dice", async () => {
    create.mockResolvedValueOnce({
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t1", name: "cancelar_cita", input: { id: "c1" } },
        { type: "tool_use", id: "t2", name: "cancelar_cita", input: { id: "c2" } },
      ],
    });
    const { correrAgente } = await cargar();
    const r = await correrAgente({ mensaje: "cancelá las dos", historial: [], ahora: AHORA });
    expect(r.tipo).toBe("confirmar");
    if (r.tipo !== "confirmar") throw new Error("no era confirmar");
    expect(r.resumen.toLowerCase()).toMatch(/una|de a una|primero/);
  });
});
