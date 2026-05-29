import { describe, it, expect } from "vitest";
import {
  countTreinaveis,
  buildPericiaSet,
  isInata,
} from "../../src/rules/pericias.js";
import type { IndexedClasse } from "../../src/compendium/types.js";

function mockClasse(overrides: Partial<IndexedClasse["system"]> = {}): IndexedClasse {
  return {
    id: "guerreiro",
    name: "Guerreiro",
    img: "",
    packId: "tormenta20.classes",
    type: "classe",
    system: {
      pvPorNivel: 5,
      pmPorNivel: 3,
      pericias: {
        inatas: ["luta", "fortitude"],
        escolhas: ["atletismo", "cavalgar", "iniciativa", "intimidacao", "percepcao"],
        numero: 2,
        value: [],
      },
      ...overrides,
    },
  } as IndexedClasse;
}

describe("countTreinaveis", () => {
  it("base count = classe.numero when Int = 0", () => {
    expect(countTreinaveis(mockClasse(), 0, 0)).toBe(2);
  });

  it("adds Int modifier when positive", () => {
    expect(countTreinaveis(mockClasse(), 2, 0)).toBe(4);
  });

  it("does NOT subtract when Int is negative", () => {
    expect(countTreinaveis(mockClasse(), -1, 0)).toBe(2);
  });

  it("adds racial bonus", () => {
    expect(countTreinaveis(mockClasse(), 0, 1)).toBe(3);
  });

  it("combines Int + racial", () => {
    expect(countTreinaveis(mockClasse(), 1, 2)).toBe(5);
  });
});

describe("buildPericiaSet", () => {
  it("inatas are always included", () => {
    const result = buildPericiaSet(mockClasse(), [], []);
    expect(result.inatas).toContain("luta");
    expect(result.inatas).toContain("fortitude");
    expect(result.inatas).toHaveLength(2);
  });

  it("escolhidas are combined with inatas in treinadas", () => {
    const result = buildPericiaSet(mockClasse(), ["atletismo"], []);
    expect(result.treinadas).toContain("atletismo");
    expect(result.treinadas).toContain("luta");
  });

  it("extras from Int/racial are included in treinadas", () => {
    const result = buildPericiaSet(mockClasse(), [], ["misticismo"]);
    expect(result.treinadas).toContain("misticismo");
  });

  it("choicesRemaining decreases with escolhidas", () => {
    const result = buildPericiaSet(mockClasse(), ["atletismo"], []);
    expect(result.choicesRemaining).toBe(1); // numero=2, escolhidas=1
  });
});

describe("isInata", () => {
  it("returns true for inata pericia", () => {
    expect(isInata(mockClasse(), "luta")).toBe(true);
  });

  it("returns false for non-inata", () => {
    expect(isInata(mockClasse(), "atletismo")).toBe(false);
  });
});
