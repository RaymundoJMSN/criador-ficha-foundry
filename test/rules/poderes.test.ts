import { describe, it, expect } from "vitest";
import { checkPrereqs, isEligible } from "../../src/rules/poderes.js";

type Prereq = Record<string, unknown>;

const baseState = {
  nivel: 1,
  atributosBase: { for: 0, des: 2, con: 0, int: 0, sab: 0, car: 0 },
  classeId: "guerreiro",
  racaId: "humano",
  periciasTreinadas: ["luta", "atletismo"],
  poderes: [] as string[],
};

describe("checkPrereqs", () => {
  it("no prereqs → eligible", () => {
    const result = checkPrereqs([], baseState);
    expect(result.eligible).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it("atributo prereq met", () => {
    const prereqs: Prereq[] = [{ tipo: "atributo", atributo: "des", valor: 2 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });

  it("atributo prereq NOT met", () => {
    const prereqs: Prereq[] = [{ tipo: "atributo", atributo: "for", valor: 1 }];
    const result = checkPrereqs(prereqs, {
      ...baseState,
      atributosBase: { ...baseState.atributosBase, for: 0 },
    });
    expect(result.eligible).toBe(false);
    expect(result.unmet[0].tipo).toBe("atributo");
  });

  it("nivel prereq met", () => {
    const prereqs: Prereq[] = [{ tipo: "nivel", valor: 1 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });

  it("nivel prereq NOT met", () => {
    const prereqs: Prereq[] = [{ tipo: "nivel", valor: 5 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(false);
  });

  it("poder prereq met (slug in state.poderes)", () => {
    const prereqs: Prereq[] = [{ tipo: "poder", poder: "ambidestria" }];
    const state = { ...baseState, poderes: ["ambidestria"] };
    expect(checkPrereqs(prereqs, state).eligible).toBe(true);
  });

  it("poder prereq NOT met", () => {
    const prereqs: Prereq[] = [{ tipo: "poder", poder: "ambidestria" }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(false);
  });

  it("pericias prereq met", () => {
    const prereqs: Prereq[] = [{ tipo: "pericias", pericia: "luta" }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });

  it("pericias prereq NOT met", () => {
    const prereqs: Prereq[] = [{ tipo: "pericias", pericia: "misticismo" }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(false);
  });

  it("bab prereq is always eligible (not tracked in wizard)", () => {
    const prereqs: Prereq[] = [{ tipo: "bab", valor: 5 }];
    expect(checkPrereqs(prereqs, baseState).eligible).toBe(true);
  });
});

describe("isEligible", () => {
  it("returns true for unknown poder slug (fallback)", () => {
    expect(isEligible("poder_inexistente_xyzzy", baseState)).toBe(true);
  });

  it("ambidestria requires Des 2 — eligible when Des = 2", () => {
    expect(isEligible("ambidestria", baseState)).toBe(true);
  });

  it("ambidestria requires Des 2 — NOT eligible when Des = 0", () => {
    const state = { ...baseState, atributosBase: { ...baseState.atributosBase, des: 0 } };
    expect(isEligible("ambidestria", state)).toBe(false);
  });
});
