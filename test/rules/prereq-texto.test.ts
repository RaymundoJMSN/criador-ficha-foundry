import { describe, it, expect } from "vitest";
import { prereqsDoTexto, describeUnmet, type PartialWizardState } from "../../src/rules/poderes.js";

const base: PartialWizardState = {
  nivel: 1,
  atributos: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
  classeSlug: "nobre",
  racaSlug: "humano",
  periciasTreinadas: [],
  poderes: [],
  habilidadesClasse: [],
  niveisPorClasse: { nobre: 1 },
};

describe("pré-requisito lido do texto do item (poder fora do T20-DB)", () => {
  it("atributo, perícia, nível de classe e nome de poder", () => {
    expect(prereqsDoTexto("Faz algo. Pré-requisitos: Sab 2, treinado em Vontade, 5º nível de nobre, Duas Cabeças.")).toEqual([
      { tipo: "atributo", atributo: "sab", valor: 2 },
      { tipo: "pericia", pericia: "vontade" },
      { tipo: "nivel_classe", classe: "nobre", valor: 5 },
      { tipo: "habilidade_classe", id: ["duas_cabecas"] },
    ]);
  });

  it("'Fúria ou Fúria Divina' aceita qualquer um; 'lançar magias' pede a habilidade Magias", () => {
    expect(prereqsDoTexto("Pré-requisito: Fúria ou Fúria Divina.")).toEqual([{ tipo: "habilidade_classe", id: ["furia", "furia_divina"] }]);
    expect(prereqsDoTexto("Pré-requisito: lançar magias divinas.")).toEqual([{ tipo: "habilidade_classe", id: "magias" }]);
    expect(prereqsDoTexto("Pré-requisito: druida de Tenebra.")).toEqual([{ tipo: "divindade_druida", divindade: "tenebra" }]);
  });

  it("o que não dá para conferir não vira regra (e não bloqueia)", () => {
    expect(prereqsDoTexto("Pré-requisito: arma natural fornecida por uma habilidade de raça.")).toEqual([]);
    expect(prereqsDoTexto("Pré-requisito: possuir asas.")).toEqual([]);
    expect(prereqsDoTexto("Sem pré-requisito nenhum.")).toEqual([]);
  });

  it("describeUnmet usa o texto quando o T20-DB não conhece o poder", () => {
    const texto = "Pré-requisitos: Sab 2, 5º nível de nobre.";
    expect(describeUnmet("poder_de_heroi_de_arton", base, texto)).toEqual(["Sabedoria 2", "Nobre nível 5"]);
    const ok = { ...base, atributos: { ...base.atributos, sab: 2 }, nivel: 5, niveisPorClasse: { nobre: 5 } };
    expect(describeUnmet("poder_de_heroi_de_arton", ok, texto)).toEqual([]);
    // poder do T20-DB ignora o texto
    expect(describeUnmet("ambidestria", { ...base, atributos: { ...base.atributos, des: 2 } }, "Pré-requisito: Sab 99.")).toEqual([]);
  });
});
