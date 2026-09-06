import { describe, it, expect } from "vitest";
import { mapStateToActorData, getTrainedPericaCodes } from "../../src/actor/mapper.js";
import { WizardState } from "../../src/wizard/state.js";

describe("getTrainedPericaCodes — perícias", () => {
  it("returns trained perícias as Foundry codes with value true", () => {
    const state = new WizardState({ nome: "Hero", periciasTreinadas: ["fortitude", "atletismo"] });
    const pericias = getTrainedPericaCodes(state);
    expect(pericias).toBeDefined();
    expect(pericias["fort"]).toBe(true);
    expect(pericias["atle"]).toBe(true);
  });

  it("skips unmappable perícia identifiers (e.g. oficio)", () => {
    const state = new WizardState({ nome: "Hero", periciasTreinadas: ["oficio", "luta"] });
    const pericias = getTrainedPericaCodes(state);
    expect(pericias["luta"]).toBe(true);
    expect(Object.keys(pericias)).not.toContain("oficio");
  });

  it("returns empty object when none trained", () => {
    const state = new WizardState({ nome: "Hero" });
    const pericias = getTrainedPericaCodes(state);
    expect(pericias).toEqual({});
  });
});

describe("getTrainedPericaCodes — perícias from canonical picks", () => {
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
    const pericias = getTrainedPericaCodes(state);
    // fortitude (fixa) + luta (obrig) + atletismo/guerra (escolha) → codes
    expect(pericias["fort"]).toBe(true);
    expect(pericias["luta"]).toBe(true);
    expect(pericias["atle"]).toBe(true);
    expect(pericias["guer"]).toBe(true);
  });

  it("does NOT auto-train skills the player did not pick", () => {
    const state = new WizardState({
      nome: "Hero",
      classeNome: "Guerreiro",
      escolhasPorItem: {
        pericias: { obrigatorias: [["luta"]], escolhas: ["atletismo", "guerra"], extras_int: [], raca: [] },
      },
    });
    const pericias = getTrainedPericaCodes(state);
    expect(pericias["mist"]).toBeUndefined();
    expect(pericias["cura"]).toBeUndefined();
  });
});

describe("mapStateToActorData — pericias NOT included in Actor.create data", () => {
  it("does not include pericias in system object (applied via update() instead)", () => {
    const state = new WizardState({ nome: "Hero", periciasTreinadas: ["fortitude"] });
    const data = mapStateToActorData(state);
    expect((data.system as Record<string, unknown>)["pericias"]).toBeUndefined();
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

describe("mapStateToActorData — nível é derivado, não gravado", () => {
  it("não grava attributes.nivel.value (o sistema soma classe.system.niveis)", () => {
    const state = new WizardState({ nome: "Teste", nivel: 7 });
    const data = mapStateToActorData(state, []);
    expect((data.system as Record<string, unknown>)["attributes"]).toBeUndefined();
  });
});

describe("getTrainedPericaCodes — perícias de origem", () => {
  it("treina a perícia escolhida como benefício de origem", () => {
    const state = new WizardState({
      nome: "Nobre",
      origemId: "aristocrata",
      escolhasPorItem: { origem_beneficios: ["pericia:nobreza", "poder:sangue_azul"] },
    });
    expect(getTrainedPericaCodes(state)["nobr"]).toBe(true);
  });

  it("não treina perícia que não foi escolhida", () => {
    const state = new WizardState({
      nome: "Nobre",
      origemId: "aristocrata",
      escolhasPorItem: { origem_beneficios: ["poder:comandar", "poder:sangue_azul"] },
    });
    expect(getTrainedPericaCodes(state)["nobr"]).toBeUndefined();
  });
});

describe("mapStateToActorData — dinheiro é derivado, não lido do estado", () => {
  it("grava em system.dinheiro.tl o saldo que o writer calcula", () => {
    const state = new WizardState({ nome: "Rico", nivel: 5 });
    // o estado nunca escreve dinheiroRestante (fica 0); quem manda é o parâmetro
    const data = mapStateToActorData(state, [], 2000);
    expect(data.system.dinheiro.tl).toBe(2000);
  });
});
