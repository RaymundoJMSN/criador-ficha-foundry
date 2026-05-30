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
