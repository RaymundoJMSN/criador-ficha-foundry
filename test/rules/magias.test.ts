import { describe, it, expect } from "vitest";
import { getCirculosDesbloqueados, isConjurador, filterMagias } from "../../src/rules/magias.js";
import type { IndexedMagia } from "../../src/compendium/types.js";

function mockMagia(overrides: Partial<IndexedMagia["system"]> = {}): IndexedMagia {
  return {
    id: "bola-de-fogo",
    name: "Bola de Fogo",
    img: "",
    packId: "tormenta20.magias",
    type: "magia",
    system: { circulo: 3, escola: "evo", tipo: "arc", ...overrides },
  } as IndexedMagia;
}

describe("isConjurador", () => {
  it("arcanista é conjurador", () => expect(isConjurador("arcanista")).toBe(true));
  it("clerigo é conjurador", () => expect(isConjurador("clerigo")).toBe(true));
  it("druida é conjurador", () => expect(isConjurador("druida")).toBe(true));
  it("guerreiro NÃO é conjurador", () => expect(isConjurador("guerreiro")).toBe(false));
  it("ladino NÃO é conjurador", () => expect(isConjurador("ladino")).toBe(false));
});

describe("getCirculosDesbloqueados", () => {
  it("nível 1 arcanista → círculo 1", () => {
    expect(getCirculosDesbloqueados("arcanista", 1)).toEqual([1]);
  });

  it("nível 5 arcanista → círculos 1 e 2", () => {
    const circs = getCirculosDesbloqueados("arcanista", 5);
    expect(circs).toContain(1);
    expect(circs).toContain(2);
  });

  it("nível 9 → círculos 1, 2 e 3", () => {
    expect(getCirculosDesbloqueados("arcanista", 9)).toHaveLength(3);
  });

  it("não conjurador → sem círculos", () => {
    expect(getCirculosDesbloqueados("guerreiro", 10)).toHaveLength(0);
  });
});

describe("filterMagias", () => {
  it("filtra por círculo desbloqueado", () => {
    const magias = [mockMagia({ circulo: 1 }), mockMagia({ circulo: 3 })];
    const result = filterMagias(magias, "arcanista", 1);
    expect(result).toHaveLength(1);
    expect(result[0].system.circulo).toBe(1);
  });

  it("arcanista só recebe tipo arc", () => {
    const magias = [mockMagia({ circulo: 1, tipo: "arc" }), mockMagia({ circulo: 1, tipo: "div" })];
    expect(filterMagias(magias, "arcanista", 1)).toHaveLength(1);
  });

  it("druida só recebe tipo div", () => {
    const magias = [mockMagia({ circulo: 1, tipo: "div" }), mockMagia({ circulo: 1, tipo: "arc" })];
    const result = filterMagias(magias, "druida", 1);
    expect(result).toHaveLength(1);
    expect(result[0].system.tipo).toBe("div");
  });

  it("não conjurador → sem magias", () => {
    const magias = [mockMagia({ circulo: 1, tipo: "arc" })];
    expect(filterMagias(magias, "guerreiro", 10)).toHaveLength(0);
  });
});
