import { describe, it, expect } from "vitest";
import {
  checkPrereqs,
  isEligible,
  formatPrereq,
  describeUnmet,
  type Prereq,
  type PartialWizardState,
} from "../../src/rules/poderes.js";

/**
 * As formas de payload abaixo são as REAIS de `src/data/prereqs.json`
 * (conferidas com `motor/prerequisitos.py`): `poder` usa `id`, perícia é
 * `pericia_treinada` com `valor`, classe é `nivel_classe`, raça usa `valor`.
 */
const baseState: PartialWizardState = {
  nivel: 1,
  atributos: { for: 0, des: 2, con: 0, int: 0, sab: 0, car: 0 },
  classeSlug: "guerreiro",
  racaSlug: "humano",
  periciasTreinadas: ["luta", "atletismo"],
  poderes: [],
};

const com = (extra: Partial<PartialWizardState>): PartialWizardState => ({ ...baseState, ...extra });
const ok = (prereqs: Prereq[], state = baseState) => checkPrereqs(prereqs, state).eligible;

describe("checkPrereqs — básicos", () => {
  it("sem pré-requisito é elegível", () => {
    expect(ok([])).toBe(true);
  });

  it("atributo compara com o valor final", () => {
    expect(ok([{ tipo: "atributo", atributo: "des", valor: 2 }])).toBe(true);
    expect(ok([{ tipo: "atributo", atributo: "for", valor: 1 }])).toBe(false);
  });

  it("bônus racial conta no atributo (anão For 2 base + 1 racial passa em For 3)", () => {
    const anao = com({ racaSlug: "anao", atributos: { ...baseState.atributos, for: 3 } });
    expect(ok([{ tipo: "atributo", atributo: "for", valor: 3 }], anao)).toBe(true);
  });

  it("nivel total", () => {
    expect(ok([{ tipo: "nivel", valor: 1 }])).toBe(true);
    expect(ok([{ tipo: "nivel", valor: 5 }])).toBe(false);
  });

  it("tipo desconhecido não bloqueia", () => {
    expect(ok([{ tipo: "bab", valor: 5 }])).toBe(true);
    expect(ok([{ tipo: "outro", descricao: "a critério do mestre" }])).toBe(true);
    expect(ok([{ tipo: "narrativo", descricao: "ter sido pirata" }])).toBe(true);
  });
});

describe("checkPrereqs — tipos portados de motor/prerequisitos.py", () => {
  it("poder usa o campo id", () => {
    expect(ok([{ tipo: "poder", id: "ambidestria" }])).toBe(false);
    expect(ok([{ tipo: "poder", id: "ambidestria" }], com({ poderes: ["ambidestria"] }))).toBe(true);
  });

  it("nivel_classe exige a classe certa E o nível", () => {
    const nv5 = com({ nivel: 5 });
    expect(ok([{ tipo: "nivel_classe", classe: "guerreiro", valor: 5 }], nv5)).toBe(true);
    expect(ok([{ tipo: "nivel_classe", classe: "ladino", valor: 5 }], nv5)).toBe(false);
    expect(ok([{ tipo: "nivel_classe", classe: "guerreiro", valor: 6 }], nv5)).toBe(false);
  });

  it("pericia_treinada aceita valor ou pericia, e ignora especialização", () => {
    expect(ok([{ tipo: "pericia_treinada", valor: "luta" }])).toBe(true);
    expect(ok([{ tipo: "pericia_treinada", pericia: "misticismo" }])).toBe(false);
    const oficio = com({ periciasTreinadas: ["oficio"] });
    expect(ok([{ tipo: "pericia_treinada", valor: "Ofício (alquimista)" }], oficio)).toBe(true);
  });

  it("habilidade_classe aceita lista como OR", () => {
    const bruxo = com({ habilidadesClasse: ["bruxo"] });
    expect(ok([{ tipo: "habilidade_classe", valor: ["bruxo", "mago"] }], bruxo)).toBe(true);
    expect(ok([{ tipo: "habilidade_classe", id: "mago" }], bruxo)).toBe(false);
  });

  it("habilidade_racial é atendida pela própria raça", () => {
    const qareen = com({ racaSlug: "qareen" });
    expect(ok([{ tipo: "habilidade_racial", valor: "qareen" }], qareen)).toBe(true);
    expect(ok([{ tipo: "habilidade_racial", valor: "herança_divina" }], qareen)).toBe(false);
  });

  it("raca aceita string ou lista, e raças consideradas", () => {
    const meioOrc = com({ racaSlug: "meio_orc", racasConsideradas: ["orc"] });
    expect(ok([{ tipo: "raca", valor: "orc" }], meioOrc)).toBe(true);
    expect(ok([{ tipo: "raca", valor: ["golem_desperto", "meio_orc"] }], meioOrc)).toBe(true);
    expect(ok([{ tipo: "raca", valor: "elfo" }], meioOrc)).toBe(false);
  });

  it("devoto e divindade_druida", () => {
    const devoto = com({ divindadeSlug: "khalmyr" });
    expect(ok([{ tipo: "devoto", valor: true }], devoto)).toBe(true);
    expect(ok([{ tipo: "devoto", valor: true }])).toBe(false);
    expect(ok([{ tipo: "divindade_druida", divindade: "khalmyr" }], devoto)).toBe(true);
    expect(ok([{ tipo: "divindade_druida", divindade: "megalokk" }], devoto)).toBe(false);
  });

  it("proficiencia, magia e escola de magia", () => {
    const s = com({
      proficiencias: ["armas_marciais"],
      magias: ["bola_de_fogo"],
      escolaMagia: "necromancia",
    });
    expect(ok([{ tipo: "proficiencia", valor: "armas_marciais" }], s)).toBe(true);
    expect(ok([{ tipo: "proficiencia", valor: "armas_exoticas" }], s)).toBe(false);
    expect(ok([{ tipo: "magia", id: "bola_de_fogo" }], s)).toBe(true);
    expect(ok([{ tipo: "escola_de_magia_escolhida", valor: "necromancia" }], s)).toBe(true);
  });

  it("linhagem e linhagem_definida", () => {
    const feiticeiro = com({ linhagem: "draconica" });
    expect(ok([{ tipo: "linhagem", valor: "draconica" }], feiticeiro)).toBe(true);
    expect(ok([{ tipo: "linhagem", valor: "rubra" }], feiticeiro)).toBe(false);
    expect(ok([{ tipo: "linhagem_definida" }], feiticeiro)).toBe(true);
    expect(ok([{ tipo: "linhagem_definida" }])).toBe(false);
  });

  it("poder_caminho casa com o caminho escolhido", () => {
    expect(ok([{ tipo: "poder_caminho", id: "montaria" }], com({ caminho: "montaria" }))).toBe(true);
    expect(ok([{ tipo: "poder_caminho", id: "montaria" }])).toBe(false);
  });

  it("poder_subcategoria conta poderes do grupo (postura_combate ≡ postura_de_combate)", () => {
    const comPosturas = com({
      poderes: ["postura_torre_inabalavel", "postura_castigo_de_ferro"],
    });
    expect(
      ok([{ tipo: "poder_subcategoria", subcategoria: "postura_combate", quantidade: 2 }], comPosturas)
    ).toBe(true);
    expect(
      ok([{ tipo: "poder_subcategoria", subcategoria: "postura_combate", quantidade: 3 }], comPosturas)
    ).toBe(false);
  });

  it("poder_de_brado conta poderes de brado", () => {
    const brados = com({ poderes: ["brado_sismico"] });
    expect(ok([{ tipo: "poder_de_brado", quantidade: 1 }], brados)).toBe(true);
    expect(ok([{ tipo: "poder_de_brado", quantidade: 1 }])).toBe(false);
  });
});

describe("isEligible contra os dados reais", () => {
  it("slug sem pré-requisito é elegível", () => {
    expect(isEligible("poder_inexistente_xyzzy", baseState)).toBe(true);
  });

  it("Ambidestria exige Des 2", () => {
    expect(isEligible("ambidestria", baseState)).toBe(true);
    expect(isEligible("ambidestria", com({ atributos: { ...baseState.atributos, des: 0 } }))).toBe(
      false
    );
  });
});

describe("formatPrereq — texto em português", () => {
  it.each([
    [{ tipo: "atributo", atributo: "for", valor: 3 }, "Força 3"],
    [{ tipo: "nivel", valor: 5 }, "Nível 5"],
    [{ tipo: "nivel_classe", classe: "guerreiro", valor: 5 }, "Guerreiro nível 5"],
    [{ tipo: "poder", id: "ataque_poderoso" }, "Poder: Ataque Poderoso"],
    [{ tipo: "pericia_treinada", valor: "luta" }, "Treinado em Luta"],
    [{ tipo: "raca", valor: "anao" }, "Raça: Anao"],
    [{ tipo: "raca", valor: ["anao", "elfo"] }, "Raça: Anao ou Elfo"],
    [{ tipo: "devoto", valor: true }, "Ser devoto de uma divindade"],
    [{ tipo: "linhagem", valor: "draconica" }, "Linhagem Draconica"],
    [{ tipo: "proficiencia", valor: "armas_marciais" }, "Proficiência: Armas Marciais"],
    [{ tipo: "qualquer_coisa" }, "Pré-requisito especial"],
  ])("%o → %s", (req, esperado) => {
    expect(formatPrereq(req as Prereq)).toBe(esperado);
  });
});

describe("describeUnmet", () => {
  it("slug sem pré-req devolve lista vazia", () => {
    expect(describeUnmet("__inexistente__", baseState)).toEqual([]);
  });

  it("explica o que falta, em português", () => {
    const motivos = describeUnmet("ambidestria", com({ atributos: { des: 0 } }));
    expect(motivos).toEqual(["Destreza 2"]);
  });
});
