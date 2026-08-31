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

  it("allihanna não aceita anão guerreiro (nem raça nem classe listadas)", () => {
    expect(isDivindadeAcessa("allihanna", "anao", "guerreiro")).toBe(false);
  });

  it("allihanna aceita elfo druida", () => {
    expect(isDivindadeAcessa("allihanna", "elfo", "druida")).toBe(true);
  });

  it("basta a CLASSE estar listada — anão druida serve", () => {
    // "sua raça ou sua classe devem estar listadas" (LB cap. 2)
    expect(isDivindadeAcessa("allihanna", "anao", "druida")).toBe(true);
  });

  it("humano é exceção e pode qualquer divindade", () => {
    expect(isDivindadeAcessa("allihanna", "humano", "guerreiro")).toBe(true);
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

  it("elfo druida vê allihanna", () => {
    const list = listDivindadesParaPersonagem("elfo", "druida");
    expect(list.some((d) => d.id === "allihanna")).toBe(true);
  });

  it("anão guerreiro NÃO vê allihanna", () => {
    const list = listDivindadesParaPersonagem("anao", "guerreiro");
    expect(list.some((d) => d.id === "allihanna")).toBe(false);
  });
});
