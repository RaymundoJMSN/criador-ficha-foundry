import { describe, it, expect } from "vitest";
import { mapStateToActorData } from "../../src/actor/mapper.js";
import { WizardState } from "../../src/wizard/state.js";

describe("mapStateToActorData — perícias", () => {
  it("writes trained perícias as Foundry codes with treinado:true", () => {
    const state = new WizardState({ nome: "Hero", periciasTreinadas: ["fortitude", "atletismo"] });
    const data = mapStateToActorData(state);
    expect(data.system.pericias).toBeDefined();
    expect(data.system.pericias!["fort"]).toEqual({ treinado: true });
    expect(data.system.pericias!["atle"]).toEqual({ treinado: true });
  });

  it("skips unmappable perícia identifiers (e.g. oficio)", () => {
    const state = new WizardState({ nome: "Hero", periciasTreinadas: ["oficio", "luta"] });
    const data = mapStateToActorData(state);
    expect(data.system.pericias!["luta"]).toEqual({ treinado: true });
    expect(Object.keys(data.system.pericias!)).not.toContain("oficio");
  });

  it("emits no pericias key when none trained", () => {
    const state = new WizardState({ nome: "Hero" });
    const data = mapStateToActorData(state);
    expect(data.system.pericias).toEqual({});
  });
});

describe("mapStateToActorData — perícias from canonical picks", () => {
  it("computes trained set from class spec + picks (not Foundry item)", () => {
    const state = new WizardState({
      nome: "Hero",
      classeNome: "Guerreiro",
      atributosBase: { for: 2, des: 1, con: 1, int: 0, sab: 0, car: 0 },
      escolhasPorItem: {
        pericias: {
          obrigatorias: [["luta"]],
          escolhas: ["atletismo", "guerra"],
          extras_int: [],
          raca: [],
        },
      },
    });
    const data = mapStateToActorData(state);
    // fortitude (fixa) + luta (obrig) + atletismo/guerra (escolha) → codes
    expect(data.system.pericias!["fort"]).toEqual({ treinado: true });
    expect(data.system.pericias!["luta"]).toEqual({ treinado: true });
    expect(data.system.pericias!["atle"]).toEqual({ treinado: true });
    expect(data.system.pericias!["guer"]).toEqual({ treinado: true });
  });

  it("does NOT auto-train skills the player did not pick", () => {
    const state = new WizardState({
      nome: "Hero",
      classeNome: "Guerreiro",
      escolhasPorItem: {
        pericias: { obrigatorias: [["luta"]], escolhas: ["atletismo", "guerra"], extras_int: [], raca: [] },
      },
    });
    const data = mapStateToActorData(state);
    expect(data.system.pericias!["mist"]).toBeUndefined();
    expect(data.system.pericias!["cura"]).toBeUndefined();
  });
});

describe("mapStateToActorData — race choosable modifiers", () => {
  it("adds humano +1 choices to atributos.base", () => {
    const state = new WizardState({
      nome: "Hero",
      racaNome: "Humano",
      atributosBase: { for: 1, des: 0, con: 0, int: 2, sab: 0, car: 0 },
      escolhasPorItem: { raca_modificadores: [["for", "des", "con"]] },
    });
    const data = mapStateToActorData(state);
    expect(data.system.atributos.for.base).toBe(2); // 1 + 1
    expect(data.system.atributos.des.base).toBe(1); // 0 + 1
    expect(data.system.atributos.con.base).toBe(1); // 0 + 1
    expect(data.system.atributos.int.base).toBe(2); // unchanged
  });

  it("does not touch base when no modifier choices stored", () => {
    const state = new WizardState({
      nome: "Hero",
      racaNome: "Humano",
      atributosBase: { for: 1, des: 0, con: 0, int: 0, sab: 0, car: 0 },
    });
    const data = mapStateToActorData(state);
    expect(data.system.atributos.for.base).toBe(1);
  });

  it("ignores invalid choices (no partial application)", () => {
    const state = new WizardState({
      nome: "Hero",
      racaNome: "Humano",
      atributosBase: { for: 1, des: 0, con: 0, int: 0, sab: 0, car: 0 },
      escolhasPorItem: { raca_modificadores: [["for", "for"]] }, // wrong: dup + count
    });
    const data = mapStateToActorData(state);
    expect(data.system.atributos.for.base).toBe(1); // unchanged
  });
});

describe("mapStateToActorData — detalhes use names not ids", () => {
  it("resolves origem id to its display name", () => {
    const state = new WizardState({ nome: "Hero", origemId: "acolito" });
    const data = mapStateToActorData(state);
    expect(data.system.detalhes.origem).toBe("Acólito");
  });

  it("resolves divindade id to its display name", () => {
    const state = new WizardState({ nome: "Hero", divindadeId: "aharadak" });
    const data = mapStateToActorData(state);
    expect(data.system.detalhes.divindade).toBe("Aharadak");
  });

  it("uses racaNome for detalhes.raca when present", () => {
    const state = new WizardState({ nome: "Hero", racaId: "abc123", racaNome: "Humano" });
    const data = mapStateToActorData(state);
    expect(data.system.detalhes.raca).toBe("Humano");
  });
});
