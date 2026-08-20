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
});
