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

/** Build a state for an arcanista at level 2 (poderesParaPick = 1) */
function arcanistaNivel2(): WizardState {
  const s = new WizardState();
  s.classeNome = "Arcanista";
  s.nivel = 2;
  return s;
}

describe("preparePoderesContext", () => {
  it("nível 1 sem classe: sem picks, sem poderes na lista", () => {
    const state = new WizardState();
    const ctx = preparePoderesContext(state, [poder("Foco em Arma", "Você ganha +2…")]);
    expect(ctx.poderesParaPick).toBe(0);
    expect(ctx.poderes).toHaveLength(0);
  });

  it("nível 2 arcanista: expõe poderes da classe com descrição", () => {
    const state = arcanistaNivel2();
    const p = poder("Agrilhoar os Caídos", "Você ganha +2…");
    const ctx = preparePoderesContext(state, [p]);
    expect(ctx.poderesParaPick).toBeGreaterThan(0);
    expect(ctx.poderes[0].descricao).toBe("Você ganha +2…");
  });

  it("nível 2 arcanista: poder fora da classe não aparece na lista", () => {
    const state = arcanistaNivel2();
    const ctx = preparePoderesContext(state, [poder("Poder Fora Da Classe", "desc")]);
    expect(ctx.poderes).toHaveLength(0);
  });

  it("invariante: eligible === (unmet.length === 0)", () => {
    const state = arcanistaNivel2();
    const poderes = [
      poder("Agrilhoar os Caídos"),
      poder("Alquimia Arcana"),
    ];
    const ctx = preparePoderesContext(state, poderes);
    for (const p of ctx.poderes) {
      expect(p.eligible).toBe(p.unmet.length === 0);
    }
  });

  it("habilidades_classe_ids sempre presentes mesmo no nível 1", () => {
    const state = new WizardState();
    state.classeNome = "Arcanista";
    state.nivel = 1;
    const ctx = preparePoderesContext(state, []);
    expect(ctx.habilidades.length).toBeGreaterThan(0);
    expect(ctx.poderesParaPick).toBe(0);
  });
});

describe("preparePoderesContext — cota acumulada e poderes gerais", () => {
  it("guerreiro nv5 abre 4 escolhas (níveis 2..5), não 1", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 5;
    expect(preparePoderesContext(s, []).poderesParaPick).toBe(4);
  });

  it("guerreiro nv1 não abre escolha de poder", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 1;
    expect(preparePoderesContext(s, []).poderesParaPick).toBe(0);
  });

  it("mostra só habilidades de classe até o nível (sem Campeão no nv7)", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 7;
    const slugs = preparePoderesContext(s, []).habilidades.map((h) => h.slug);
    expect(slugs).toContain("ataque_extra");
    expect(slugs).not.toContain("campeao");
  });

  it("inclui poderes gerais junto dos poderes de classe", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 2;
    const geral: IndexedPoder = {
      id: "foco_em_pericia",
      name: "Foco em Perícia",
      img: "",
      packId: "test.poderes",
      type: "poder",
      system: { tipo: "geral", descricao: "" },
    };
    const ctx = preparePoderesContext(s, [poder("Ambidestria"), geral]);
    const nomes = ctx.poderes.map((p) => p.name);
    expect(nomes).toContain("Foco em Perícia");
    expect(ctx.poderes.find((p) => p.name === "Foco em Perícia")?.origem).toBe("geral");
  });
});

describe("preparePoderesContext — poder de classe com nome qualificado", () => {
  it("Ambidestria (Guerreiro) entra na lista do guerreiro", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 2;
    const itens: IndexedPoder[] = [
      {
        id: "amb_g",
        name: "Ambidestria (Guerreiro)",
        img: "",
        packId: "p",
        type: "poder",
        system: { tipo: "classe" },
      },
      {
        id: "amb_c",
        name: "Ambidestria (Caçador)",
        img: "",
        packId: "p",
        type: "poder",
        system: { tipo: "classe" },
      },
    ];
    const nomes = preparePoderesContext(s, itens).poderes.map((p) => p.name);
    expect(nomes).toContain("Ambidestria (Guerreiro)");
    expect(nomes).not.toContain("Ambidestria (Caçador)");
  });

  it("nomeia habilidade parametrizada pelo item real", () => {
    const s = new WizardState();
    s.classeNome = "Bárbaro";
    s.nivel = 1;
    const itens: IndexedPoder[] = [
      { id: "f", name: "Fúria", img: "", packId: "p", type: "poder", system: { tipo: "ability" } },
    ];
    const nomes = preparePoderesContext(s, itens).habilidades.map((h) => h.nome);
    expect(nomes).toContain("Fúria");
  });
});

describe("preparePoderesContext — bloqueio de escolha", () => {
  const item = (id: string, name: string, tipo = "geral"): IndexedPoder => ({
    id,
    name,
    img: "",
    packId: "p",
    type: "poder",
    system: { tipo },
  });

  it("poder com pré-requisito não cumprido fica bloqueado", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 2;
    s.atributosBase = { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
    const ctx = preparePoderesContext(s, [item("amb", "Ambidestria")]);
    const amb = ctx.poderes.find((p) => p.name === "Ambidestria");
    expect(amb?.eligible).toBe(false);
    expect(amb?.bloqueado).toBe(true);
  });

  it("cumprir o pré-requisito libera na hora", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 2;
    s.atributosBase = { for: 0, des: 2, con: 0, int: 0, sab: 0, car: 0 };
    const ctx = preparePoderesContext(s, [item("amb", "Ambidestria")]);
    expect(ctx.poderes.find((p) => p.name === "Ambidestria")?.bloqueado).toBe(false);
  });

  it("cota cheia bloqueia as não escolhidas, mas não as já marcadas", () => {
    const s = new WizardState();
    s.classeNome = "Guerreiro";
    s.nivel = 2; // 1 escolha
    s.poderes = ["a"];
    const ctx = preparePoderesContext(s, [item("a", "Atlético"), item("b", "Esquiva")]);
    expect(ctx.poderes.find((p) => p.id === "a")?.bloqueado).toBe(false);
    expect(ctx.poderes.find((p) => p.id === "b")?.bloqueado).toBe(true);
  });
});
