import { describe, it, expect } from "vitest";
import {
  isDivindadeAcessa,
  listDivindadesParaPersonagem,
  listDivindades,
} from "../../src/rules/divindade.js";

describe("requisitos de devoto (LB cap. 2)", () => {
  it("raça OU classe listada basta — não as duas", () => {
    // Allihanna aceita elfo (raça) e druida/caçador/bárbaro (classe).
    expect(isDivindadeAcessa("allihanna", "elfo", "arcanista")).toBe(true);
    expect(isDivindadeAcessa("allihanna", "anao", "druida")).toBe(true);
    expect(isDivindadeAcessa("allihanna", "anao", "arcanista")).toBe(false);
  });

  it("humano pode ser devoto de qualquer divindade", () => {
    const todas = listDivindades();
    const paraHumano = listDivindadesParaPersonagem("humano", "arcanista");
    expect(paraHumano.length).toBe(todas.length);
  });

  it("clérigo pode ser devoto de qualquer divindade", () => {
    expect(listDivindadesParaPersonagem("goblin", "clerigo").length).toBe(listDivindades().length);
  });

  it("arcanista élfico vê mais que só os deuses 'qualquer'", () => {
    const lista = listDivindadesParaPersonagem("elfo", "arcanista");
    expect(lista.length).toBeGreaterThan(3);
    expect(lista.map((d) => d.id)).toContain("allihanna");
  });
});
