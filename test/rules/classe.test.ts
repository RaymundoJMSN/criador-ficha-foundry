import { describe, it, expect } from "vitest";
import { getClasse } from "../../src/rules/classe.js";

describe("getClasse", () => {
  it("finds guerreiro by id", () => {
    const c = getClasse("guerreiro");
    expect(c?.nome).toBe("Guerreiro");
  });

  it("finds by display name (slugged)", () => {
    expect(getClasse("Guerreiro")?.nome).toBe("Guerreiro");
  });

  it("guerreiro perícia spec: fixa fortitude, obrigatória luta|pontaria, 2 escolhas", () => {
    const c = getClasse("guerreiro")!;
    expect(c.pericias.fixas).toContain("fortitude");
    expect(c.pericias.escolhas_obrigatorias[0].opcoes).toEqual(["luta", "pontaria"]);
    expect(c.pericias.escolhas.quantidade).toBe(2);
    expect(c.pericias.escolhas.opcoes).toContain("atletismo");
  });

  it("returns null for unknown", () => {
    expect(getClasse("xyzzy")).toBeNull();
  });
});
