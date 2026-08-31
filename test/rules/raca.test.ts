import { describe, it, expect } from "vitest";
import { getRaca, getRaceSkillBonus, getRaceFixedModifiers } from "../../src/rules/raca.js";
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
