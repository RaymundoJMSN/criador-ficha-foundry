import { describe, it, expect } from "vitest";
import {
  listDivindades,
  isDivindadeAcessa,
  isDivindadeObrigatoria,
  listDivindadesParaPersonagem,
} from "../../src/rules/divindade.js";

describe("listDivindades", () => {
  it("returns all divindades (> 0)", () => {
    expect(listDivindades().length).toBeGreaterThan(0);
  });
});

describe("isDivindadeAcessa", () => {
  it("aharadak aceita qualquer devoto", () => {
    expect(isDivindadeAcessa("aharadak", "qualquer_raca", "qualquer_classe")).toBe(true);
  });

  it("allihanna não aceita guerreiro", () => {
    expect(isDivindadeAcessa("allihanna", "humano", "guerreiro")).toBe(false);
  });

  it("allihanna aceita elfo druida (raca e classe ambos OK)", () => {
    // allihanna: racas_aceitas=[...elfo...], classes_aceitas=[...druida...]
    // Both restrictions must be satisfied (AND logic).
    expect(isDivindadeAcessa("allihanna", "elfo", "druida")).toBe(true);
  });

  it("allihanna NÃO aceita humano druida (raca não está na lista)", () => {
    // humano não está em racas_aceitas → fails even though druida is in classes_aceitas
    expect(isDivindadeAcessa("allihanna", "humano", "druida")).toBe(false);
  });

  it("returns false for unknown divindade", () => {
    expect(isDivindadeAcessa("divindade_xyzzy", "humano", "guerreiro")).toBe(false);
  });
});

describe("isDivindadeObrigatoria", () => {
  it("clerigo precisa de divindade", () => {
    expect(isDivindadeObrigatoria("clerigo")).toBe(true);
  });

  it("paladino precisa de divindade", () => {
    expect(isDivindadeObrigatoria("paladino")).toBe(true);
  });

  it("druida precisa de divindade", () => {
    expect(isDivindadeObrigatoria("druida")).toBe(true);
  });

  it("guerreiro NÃO precisa", () => {
    expect(isDivindadeObrigatoria("guerreiro")).toBe(false);
  });
});

describe("listDivindadesParaPersonagem", () => {
  it("guerreiro vê aharadak (aceita qualquer)", () => {
    const list = listDivindadesParaPersonagem("humano", "guerreiro");
    expect(list.some((d) => d.id === "aharadak")).toBe(true);
  });

  it("elfo druida vê allihanna (ambas restrições satisfeitas)", () => {
    const list = listDivindadesParaPersonagem("elfo", "druida");
    expect(list.some((d) => d.id === "allihanna")).toBe(true);
  });

  it("humano druida NÃO vê allihanna (raca não na lista)", () => {
    const list = listDivindadesParaPersonagem("humano", "druida");
    expect(list.some((d) => d.id === "allihanna")).toBe(false);
  });

  it("guerreiro NÃO vê allihanna", () => {
    const list = listDivindadesParaPersonagem("humano", "guerreiro");
    expect(list.some((d) => d.id === "allihanna")).toBe(false);
  });
});
