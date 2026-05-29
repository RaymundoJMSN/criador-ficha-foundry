import { describe, it, expect } from "vitest";
import { toSlug, namesMatch } from "../../src/compendium/slug.js";

describe("toSlug", () => {
  it("lowercases", () => {
    expect(toSlug("Magia")).toBe("magia");
  });

  it("removes diacritics", () => {
    expect(toSlug("Conjuração")).toBe("conjuracao");
    expect(toSlug("Ação")).toBe("acao");
  });

  it("replaces spaces and special chars with hyphens", () => {
    expect(toSlug("Poder de Batalha")).toBe("poder-de-batalha");
  });

  it("collapses multiple non-alphanum into one hyphen", () => {
    expect(toSlug("Força +2")).toBe("forca-2");
  });

  it("strips leading and trailing hyphens", () => {
    expect(toSlug("  Ataque  ")).toBe("ataque");
  });
});

describe("namesMatch", () => {
  it("matches display name from Foundry pack to slug from T20-DB data", () => {
    expect(namesMatch("Conjuração", "conjuracao")).toBe(true);
    expect(namesMatch("Poder de Batalha", "poder-de-batalha")).toBe(true);
  });

  it("returns false for different names", () => {
    expect(namesMatch("Ataque", "Defesa")).toBe(false);
  });
});
