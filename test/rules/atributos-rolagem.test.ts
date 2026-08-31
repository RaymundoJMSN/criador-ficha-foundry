import { describe, it, expect } from "vitest";
import {
  converterRolagem,
  converterNimb,
  especRolagem,
  valoresFixos,
  precisaRerolar,
} from "../../src/rules/atributos.js";

describe("converterRolagem — tabela do LB p.17", () => {
  it.each([
    [5, -2], [7, -2], [8, -1], [9, -1], [10, 0], [11, 0],
    [12, 1], [13, 1], [14, 2], [15, 2], [16, 3], [17, 3], [18, 4],
  ])("total %i vira atributo %i", (total, esperado) => {
    expect(converterRolagem(total)).toBe(esperado);
  });
});

describe("converterNimb — pontas estendidas (LB p.281)", () => {
  it.each([[1, -3], [3, -3], [4, -2], [17, 3], [18, 4], [19, 4], [20, 5]])(
    "d20 %i vira %i",
    (d20, esperado) => {
      expect(converterNimb(d20)).toBe(esperado);
    }
  );
});

describe("especRolagem", () => {
  it("padrão descarta o menor de 4d6", () => {
    expect(especRolagem("rolagem_padrao")?.formula).toBe("4d6kh3");
  });
  it("clássica soma 3d6 sem descarte", () => {
    expect(especRolagem("classica")?.formula).toBe("3d6");
  });
  it("épica descarta o menor e soma +6", () => {
    expect(especRolagem("epica")?.formula).toBe("3d6kh2 + 6");
  });
  it("valkaria tem teto +4", () => {
    expect(especRolagem("valkaria")?.maximo).toBe(4);
  });
  it("compra de pontos não rola", () => {
    expect(especRolagem("compra_pontos")).toBeNull();
    expect(especRolagem("khalmyr")).toBeNull();
  });
});

describe("valoresFixos", () => {
  it("khalmyr distribui 3,3,2,1,0,-1", () => {
    expect(valoresFixos("khalmyr")).toEqual([3, 3, 2, 1, 0, -1]);
  });
  it("os outros métodos não têm valores fixos", () => {
    expect(valoresFixos("rolagem_padrao")).toBeNull();
  });
});

describe("precisaRerolar", () => {
  it("soma abaixo de 6 manda rolar de novo", () => {
    expect(precisaRerolar([0, 0, 1, 1, 1, 1])).toBe(true);
    expect(precisaRerolar([2, 1, 1, 1, 1, 0])).toBe(false);
  });
});
