import { describe, it, expect } from "vitest";
import { toPericiaCode, PERICIA_CODES } from "../../src/rules/pericia-slug.js";

describe("toPericiaCode", () => {
  it("maps full T20-DB slug to Foundry 4-letter code", () => {
    expect(toPericiaCode("fortitude")).toBe("fort");
    expect(toPericiaCode("atletismo")).toBe("atle");
    expect(toPericiaCode("percepcao")).toBe("perc");
    expect(toPericiaCode("misticismo")).toBe("mist");
  });

  it("luta and cura keep their natural 4-letter form", () => {
    expect(toPericiaCode("luta")).toBe("luta");
    expect(toPericiaCode("cura")).toBe("cura");
  });

  it("normalizes accents and case before mapping", () => {
    expect(toPericiaCode("Percepção")).toBe("perc");
    expect(toPericiaCode("Intuição")).toBe("intu");
  });

  it("passes through an already-valid 4-letter code", () => {
    expect(toPericiaCode("fort")).toBe("fort");
    expect(toPericiaCode("perc")).toBe("perc");
  });

  it("returns null for an unmappable identifier", () => {
    expect(toPericiaCode("oficio")).toBeNull();
    expect(toPericiaCode("xyzzy")).toBeNull();
  });

  it("PERICIA_CODES has all 28 core skills", () => {
    expect(PERICIA_CODES).toContain("acro");
    expect(PERICIA_CODES).toContain("vont");
    expect(PERICIA_CODES.length).toBe(28);
  });
});
