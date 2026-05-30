import { describe, it, expect } from "vitest";
import { preparePoderesContext } from "../../src/wizard/steps/poderes.js";
import { WizardState } from "../../src/wizard/state.js";
import type { IndexedPoder } from "../../src/compendium/types.js";

function poder(name: string, descricao = ""): IndexedPoder {
  return {
    id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    img: "",
    packId: "test.poderes",
    type: "poder",
    system: { tipo: "combate", descricao },
  };
}

describe("preparePoderesContext", () => {
  it("expõe descrição de cada poder", () => {
    const state = new WizardState();
    const ctx = preparePoderesContext(state, [poder("Foco em Arma", "Você ganha +2…")]);
    expect(ctx.poderes[0].descricao).toBe("Você ganha +2…");
  });

  it("invariante: eligible === (unmet.length === 0)", () => {
    const state = new WizardState();
    const ctx = preparePoderesContext(state, [poder("Ataque Poderoso"), poder("Foco em Arma")]);
    for (const p of ctx.poderes) {
      expect(p.eligible).toBe(p.unmet.length === 0);
    }
  });
});
