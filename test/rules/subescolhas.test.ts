import { describe, it, expect } from "vitest";
import {
  getRaceModifierGroups,
  validateRaceModifiers,
} from "../../src/rules/subescolhas.js";

describe("getRaceModifierGroups", () => {
  it("humano has one group: +1 in 3 different attributes", () => {
    const groups = getRaceModifierGroups("humano");
    expect(groups).toHaveLength(1);
    expect(groups[0].quantidade).toBe(3);
    expect(groups[0].valor).toBe(1);
    expect(groups[0].atributos_diferentes).toBe(true);
  });

  it("anão has no choosable groups", () => {
    expect(getRaceModifierGroups("anao")).toHaveLength(0);
  });

  it("accepts display name", () => {
    expect(getRaceModifierGroups("Humano")).toHaveLength(1);
  });
});

describe("validateRaceModifiers", () => {
  it("valid humano choice → +1 in each chosen attribute", () => {
    const res = validateRaceModifiers("humano", [["for", "des", "con"]]);
    expect(res.errors).toEqual([]);
    expect(res.modificadores).toEqual({ for: 1, des: 1, con: 1 });
  });

  it("rejects wrong count", () => {
    const res = validateRaceModifiers("humano", [["for", "des"]]);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.modificadores).toEqual({});
  });

  it("rejects repeated attribute when atributos_diferentes", () => {
    const res = validateRaceModifiers("humano", [["for", "for", "des"]]);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("rejects an invalid attribute code", () => {
    const res = validateRaceModifiers("humano", [["for", "des", "xxx"]]);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("rejects fewer choice groups than required", () => {
    const res = validateRaceModifiers("humano", []);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("race without choosable groups → no modifiers, no errors", () => {
    const res = validateRaceModifiers("anao", []);
    expect(res.errors).toEqual([]);
    expect(res.modificadores).toEqual({});
  });

  it("mashin grants +1 in 2 chosen attributes", () => {
    const res = validateRaceModifiers("mashin", [["int", "sab"]]);
    expect(res.errors).toEqual([]);
    expect(res.modificadores).toEqual({ int: 1, sab: 1 });
  });
});
