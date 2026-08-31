import { describe, it, expect } from "vitest";
import { poderesConcedidosParaEscolher } from "../../src/rules/divindade.js";

describe("poderes concedidos (LB p.96)", () => {
  it("devoto comum escolhe um", () => {
    expect(poderesConcedidosParaEscolher("guerreiro", true)).toBe(1);
  });

  it("clérigo, druida e paladino escolhem dois", () => {
    expect(poderesConcedidosParaEscolher("clerigo", true)).toBe(2);
    expect(poderesConcedidosParaEscolher("druida", true)).toBe(2);
    expect(poderesConcedidosParaEscolher("paladino", true)).toBe(2);
  });

  it("sem divindade não escolhe nada", () => {
    expect(poderesConcedidosParaEscolher("clerigo", false)).toBe(0);
  });

  it("nunca é a lista inteira", () => {
    expect(poderesConcedidosParaEscolher("clerigo", true)).toBeLessThan(3);
  });
});
