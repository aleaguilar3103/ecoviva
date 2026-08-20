import { describe, it, expect } from "vitest";
import { ErrorAgenda, esErrorAgenda } from "./errores.js";

// Fija la guarda: identifica por `name` + `codigo`, no por `instanceof`
// (ver el porqué en el comentario de esErrorAgenda). El código se valida
// COMO PARTE de la guarda, no después: un objeto con el nombre correcto
// pero un código inventado no debe colarse como si fuera un ErrorAgenda
// real — eso sería mapear a 409 por descarte en vez de caer, con honestidad,
// en 500.
describe("esErrorAgenda", () => {
  it("es false para un Error común", () => {
    expect(esErrorAgenda(new Error("algo se rompió"))).toBe(false);
  });

  it("es false para un objeto con el nombre correcto pero un código inventado", () => {
    const impostor = new Error("se ve igual, pero no lo es");
    impostor.name = "ErrorAgenda";
    // @ts-expect-error — codigo no es uno de los dos válidos, a propósito.
    impostor.codigo = "inventado";
    expect(esErrorAgenda(impostor)).toBe(false);
  });

  it("es true para un ErrorAgenda real", () => {
    expect(esErrorAgenda(new ErrorAgenda("no_encontrada", "Esa cita no existe."))).toBe(true);
  });

  // El caso que importa: un objeto que SÍ extiende Error y trae un `codigo`
  // válido, pero con el `name` genérico de cualquier Error (no
  // "ErrorAgenda"). Sin el chequeo de `name` dentro de la guarda, esto se
  // colaría como si fuera un ErrorAgenda real — cualquier Error con un
  // `codigo` que por casualidad (o por otro código de la base) valiera
  // "no_encontrada"/"conflicto" mapearía a 404/409 sin serlo.
  it("es false para un Error real con codigo válido pero name distinto (no lo alcanza el chequeo de código solo)", () => {
    const casiPeroNo = new Error("parece, pero el name no es ErrorAgenda");
    // @ts-expect-error — codigo no existe en Error; se agrega a propósito
    // para simular un objeto que pasaría la validación de código sola.
    casiPeroNo.codigo = "conflicto";
    expect(esErrorAgenda(casiPeroNo)).toBe(false);
  });

  it("es false para null", () => {
    expect(esErrorAgenda(null)).toBe(false);
  });

  it("es false para undefined", () => {
    expect(esErrorAgenda(undefined)).toBe(false);
  });

  it("es false para un string suelto", () => {
    expect(esErrorAgenda("Esa cita no existe.")).toBe(false);
  });
});
