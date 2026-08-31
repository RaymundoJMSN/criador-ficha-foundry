import { describe, it, expect } from "vitest";
import {
  listOrigens,
  getOrigem,
  formatItensIniciais,
} from "../../src/rules/origem.js";

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

describe("formatItensIniciais", () => {
  it("renders item objects as readable strings (not [object Object])", () => {
    const lines = formatItensIniciais("amnesico");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("um ou mais itens aprovados pelo mestre");
    expect(lines.join(" ")).not.toContain("[object Object]");
  });

  it("appends valor_max when present", () => {
    const lines = formatItensIniciais("amnesico");
    expect(lines[0]).toContain("T$ 500");
  });

  it("returns empty array for unknown origem", () => {
    expect(formatItensIniciais("xyzzy")).toEqual([]);
  });
});
