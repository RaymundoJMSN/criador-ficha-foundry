import { describe, it, expect } from "vitest";
import { getClasse } from "../../src/rules/classe.js";
import { buildPericiaPlan, computeTrained } from "../../src/rules/pericias.js";

const guerreiro = () => getClasse("guerreiro")!;

describe("buildPericiaPlan", () => {
  it("exposes fixas, obrigatórias, escolhas from class spec", () => {
    const plan = buildPericiaPlan(guerreiro(), 0, 0);
    expect(plan.fixas).toEqual(["fortitude"]);
    expect(plan.obrigatorias).toHaveLength(1);
    expect(plan.escolhas.quantidade).toBe(2);
  });

  it("intBonus = max(0, Int final); racaBonus passed through", () => {
    expect(buildPericiaPlan(guerreiro(), 3, 2).intBonus).toBe(3);
    expect(buildPericiaPlan(guerreiro(), -1, 2).intBonus).toBe(0);
    expect(buildPericiaPlan(guerreiro(), 2, 2).racaBonus).toBe(2);
  });

  it("todas = all 28 skills (for Int/raça any-skill pickers)", () => {
    expect(buildPericiaPlan(guerreiro(), 0, 0).todas.length).toBe(28);
  });
});

describe("computeTrained", () => {
  const plan = () => buildPericiaPlan(guerreiro(), 1, 2);

  it("fixas auto-trained without any pick", () => {
    const r = computeTrained(plan(), {
      obrigatorias: [["luta"]],
      escolhas: ["atletismo", "guerra"],
      extras_int: ["misticismo"],
      raca: ["cura", "diplomacia"],
    });
    expect(r.errors).toEqual([]);
    expect(r.trained).toContain("fortitude"); // fixa
    expect(r.trained).toContain("luta"); // obrigatória
    expect(r.trained).toContain("atletismo"); // escolha
    expect(r.trained).toContain("misticismo"); // int extra (any skill)
    expect(r.trained).toContain("cura"); // raça (any skill)
  });

  it("errors when an obligatory group is unfilled", () => {
    const r = computeTrained(plan(), {
      obrigatorias: [[]],
      escolhas: ["atletismo", "guerra"],
      extras_int: [],
      raca: [],
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("errors when an escolha is outside the class list", () => {
    const r = computeTrained(plan(), {
      obrigatorias: [["luta"]],
      escolhas: ["misticismo", "guerra"], // misticismo not in guerreiro list
      extras_int: [],
      raca: [],
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("errors when too many escolhas picked", () => {
    const r = computeTrained(plan(), {
      obrigatorias: [["luta"]],
      escolhas: ["atletismo", "guerra", "cavalgar"], // 3 > 2
      extras_int: [],
      raca: [],
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("errors when extras_int exceeds Int bonus", () => {
    const r = computeTrained(buildPericiaPlan(guerreiro(), 1, 0), {
      obrigatorias: [["luta"]],
      escolhas: ["atletismo", "guerra"],
      extras_int: ["misticismo", "nobreza"], // 2 > Int 1
      raca: [],
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("no double-count: fixa also picked as escolha stays single", () => {
    const r = computeTrained(buildPericiaPlan(guerreiro(), 0, 0), {
      obrigatorias: [["luta"]],
      escolhas: ["atletismo", "guerra"],
      extras_int: [],
      raca: [],
    });
    const count = r.trained.filter((p) => p === "fortitude").length;
    expect(count).toBe(1);
  });
});
