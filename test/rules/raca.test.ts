import { describe, it, expect } from "vitest";
import { getRaca, getRaceSkillBonus } from "../../src/rules/raca.js";

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
