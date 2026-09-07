import { describe, it, expect } from "vitest";
import { getRaca, getRaceSkillBonus, getRaceFixedModifiers, registrarRacasDoCompendio } from "../../src/rules/raca.js";
import { getRaceModifierGroups, validateRaceModifiers } from "../../src/rules/subescolhas.js";

describe("getRaca", () => {
  it("finds by db id", () => {
    expect(getRaca("humano")?.nome).toBe("Humano");
  });

  it("finds by display name (slugged)", () => {
    expect(getRaca("Humano")?.id).toBe("humano");
  });

  it("returns null for unknown", () => {
    expect(getRaca("xyzzy")).toBeNull();
  });
});

describe("getRaceSkillBonus", () => {
  it("humano grants +2 free trained skills", () => {
    expect(getRaceSkillBonus("humano")).toBe(2);
  });

  it("ceratops grants +1", () => {
    expect(getRaceSkillBonus("ceratops")).toBe(1);
  });

  it("anao grants +0 (no treinar_pericias)", () => {
    expect(getRaceSkillBonus("anao")).toBe(0);
  });

  it("accepts display name and unknown race returns 0", () => {
    expect(getRaceSkillBonus("Humano")).toBe(2);
    expect(getRaceSkillBonus("xyzzy")).toBe(0);
  });
});

describe("raças 'misto' e 'alternativo' (regressão do port)", () => {
  it("Osteon tem Con -1 fixo E três escolhas, exceto Constituição", () => {
    const grupos = getRaceModifierGroups("osteon");
    expect(getRaceFixedModifiers("osteon")).toEqual({ con: -1 });
    expect(grupos[0]?.quantidade).toBe(3);
    expect(grupos[0]?.atributos_disponiveis).not.toContain("con");
  });

  it("Lefou não aceita +1 em Carisma", () => {
    const { errors } = validateRaceModifiers("lefou", [["car", "for", "des"]]);
    expect(errors.length).toBeGreaterThan(0);
    expect(validateRaceModifiers("lefou", [["for", "des", "con"]]).errors).toEqual([]);
  });

  it("Aggelus e Sulfure existem como raças próprias, iguais aos itens do compêndio", () => {
    expect(getRaceFixedModifiers("aggelus")).toEqual({ sab: 2, car: 1 });
    expect(getRaceFixedModifiers("sulfure")).toEqual({ des: 2, int: 1 });
  });
});

describe("raças só do compêndio (Moreau, Kallyanach, Vampiro)", () => {
  it("lê fixos e escolha do item; Kallyanach vira '+1 em dois' com alternativa '+2 em um'", () => {
    const n = registrarRacasDoCompendio([
      { name: "Moreau - Herança do Lobo", system: { atributos: { car: 1, for: 0 }, atributosDinamicos: { value: ["for", "des", "con", "int", "sab", "car"], description: "+1 em dois atributos" } } },
      { name: "Kallyanach", system: { atributos: {}, atributosDinamicos: { value: ["for", "des", "con", "int", "sab", "car"], description: "+2 em um atributo a sua escolha ou +1 em dois atributos a sua escolha" } } },
      { name: "Vampiro", system: { atributos: { con: -1, car: 1 }, atributosDinamicos: { value: ["for", "des", "int", "sab"], description: "+1 em Dois Atributos Diferentes" } } },
      { name: "Anão", system: { atributos: { con: 2 } } },
    ]);
    expect(n).toBe(3);
    expect(getRaceFixedModifiers("Moreau - Herança do Lobo")).toEqual({ car: 1 });
    expect(getRaceModifierGroups("Moreau - Herança do Lobo")).toEqual([
      expect.objectContaining({ valor: 1, quantidade: 2, atributos_diferentes: true, atributos_disponiveis: null }),
    ]);
    const k = getRaceModifierGroups("Kallyanach")[0]!;
    expect(k).toMatchObject({ valor: 1, quantidade: 2, alternativa: { valor: 2, quantidade: 1 } });
    expect(getRaceModifierGroups("Vampiro")[0]!.atributos_disponiveis).toEqual(["for", "des", "int", "sab"]);
    // o modo alternativo é aceito pelo validador
    expect(validateRaceModifiers("Kallyanach", [["for"]]).modificadores).toEqual({ for: 2 });
    expect(validateRaceModifiers("Kallyanach", [["for", "des"]]).modificadores).toEqual({ for: 1, des: 1 });
    expect(validateRaceModifiers("Kallyanach", [["for", "des", "con"]]).errors.length).toBeGreaterThan(0);
    // o T20-DB continua mandando para quem ele tem
    expect(getRaceFixedModifiers("Anão")).toEqual({ con: 2, sab: 1, des: -1 });
  });
});
