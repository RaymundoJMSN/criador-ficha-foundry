import { describe, it, expect } from "vitest";
import { listOrigens, getOrigem, getPick2Candidates } from "../../src/rules/origem.js";

describe("listOrigens", () => {
  it("returns non-empty array", () => {
    const list = listOrigens();
    expect(list.length).toBeGreaterThan(0);
  });

  it("each origem has id and nome", () => {
    for (const o of listOrigens()) {
      expect(typeof o.id).toBe("string");
      expect(typeof o.nome).toBe("string");
    }
  });
});

describe("getOrigem", () => {
  it("returns acolito", () => {
    const o = getOrigem("acolito");
    expect(o).not.toBeNull();
    expect(o!.nome).toBe("Acólito");
    expect(o!.beneficios.pericias).toContain("Cura");
  });

  it("returns null for unknown id", () => {
    expect(getOrigem("origem_inexistente_xyzzy")).toBeNull();
  });
});

describe("getPick2Candidates", () => {
  it("acolito has pick candidates", () => {
    const cands = getPick2Candidates("acolito");
    expect(cands.length).toBeGreaterThan(0);
  });

  it("returns empty for unknown origem", () => {
    expect(getPick2Candidates("xyzzy")).toHaveLength(0);
  });
});
