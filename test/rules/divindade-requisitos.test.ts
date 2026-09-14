import { describe, it, expect } from "vitest";
import {
  isDivindadeAcessa,
  listDivindadesParaPersonagem,
  registrarDeusesMenores,
  getDivindade,
  listDivindades,
  pmDaDevocaoAmpla,
} from "../../src/rules/divindade.js";

describe("requisitos de devoto (LB cap. 2)", () => {
  it("raça OU classe listada basta — não as duas", () => {
    // Allihanna aceita elfo (raça) e druida/caçador/bárbaro (classe).
    expect(isDivindadeAcessa("allihanna", "elfo", "arcanista")).toBe(true);
    expect(isDivindadeAcessa("allihanna", "anao", "druida")).toBe(true);
    expect(isDivindadeAcessa("allihanna", "anao", "arcanista")).toBe(false);
  });

  it("humano pode ser devoto de qualquer divindade (menos o Panteão, que é regra de clérigo/frade)", () => {
    const todas = listDivindades();
    const paraHumano = listDivindadesParaPersonagem("humano", "arcanista");
    // menos o Panteão e o "arton" do T20-DB
    expect(paraHumano.length).toBe(todas.length - 2);
    expect(paraHumano.map((d) => d.id)).not.toContain("panteao");
  });

  it("clérigo pode ser devoto de qualquer divindade, Panteão incluído", () => {
    const lista = listDivindadesParaPersonagem("goblin", "clerigo");
    expect(lista.length).toBe(listDivindades().length - 1);
    expect(lista.map((d) => d.id)).toContain("panteao");
  });

  it("arcanista élfico vê mais que só os deuses 'qualquer'", () => {
    const lista = listDivindadesParaPersonagem("elfo", "arcanista");
    expect(lista.length).toBeGreaterThan(3);
    expect(lista.map((d) => d.id)).toContain("allihanna");
  });
});

describe("deuses menores (Guia de Deuses Menores) — registro pelo compêndio", () => {
  it("Akok aceita elfo caçador e não aceita humano guerreiro (sem coringa); Sartan aceita todos", () => {
    const n = registrarDeusesMenores([
      { name: "Faro de Lobo", system: { subtipo: "Akok, O Deus dos Lobos" } },
      { name: "Marcha da Desolação", system: { subtipo: "Sartan, o Deus da Desolação" } },
      { name: "Bênção das Avós", system: { subtipo: "Mauziell, a Deusa das Avós" } },
      { name: "Partilhado", system: { subtipo: "Allihanna, Azgher" } },
    ]);
    expect(n).toBeGreaterThanOrEqual(60);
    const akok = getDivindade("akok")!;
    expect(akok.menor).toBe(true);
    expect(akok.nome).toBe("Akok, O Deus dos Lobos");
    expect(akok.poderes_concedidos).toEqual(["faro_de_lobo"]);
    expect(isDivindadeAcessa("akok", "elfo", "cacador")).toBe(true);
    expect(isDivindadeAcessa("akok", "kobolds", "guerreiro")).toBe(true);
    expect(isDivindadeAcessa("akok", "humano", "arcanista")).toBe(false);
    expect(isDivindadeAcessa("akok", "humano", "arcanista", true)).toBe(true);
    expect(isDivindadeAcessa("sartan", "humano", "arcanista")).toBe(true);
    // deus que só existe no compêndio entra sem restrição
    expect(getDivindade("mauziell")?.poderes_concedidos).toEqual(["bencao_das_avos"]);
    expect(listDivindadesParaPersonagem("humano", "guerreiro").some((d) => d.id === "mauziell")).toBe(true);
    // poder partilhado de deuses maiores não vira deus menor
    expect(getDivindade("allihanna")?.menor).toBeFalsy();
  });
});

describe("Druida de Arton (Deuses de Arton)", () => {
  it("só druida vê Arton, e ele não dá poder concedido", () => {
    expect(isDivindadeAcessa("arton", "humano", "druida")).toBe(true);
    expect(isDivindadeAcessa("arton", "humano", "clerigo")).toBe(false);
    // Devoções Abertas não abre: é regra de classe, como o Panteão.
    expect(isDivindadeAcessa("arton", "humano", "arcanista", true)).toBe(false);
    expect(listDivindadesParaPersonagem("anao", "druida").map((d) => d.id)).toContain("arton");
    expect(getDivindade("arton")?.poderes_concedidos).toEqual([]);
  });

  it("druida vê os seis do livro novo", () => {
    const ids = listDivindadesParaPersonagem("anao", "druida").map((d) => d.id);
    for (const deus of ["aharadak", "allihanna", "megalokk", "oceano", "tenebra", "arton"]) {
      expect(ids).toContain(deus);
    }
  });

  it("Devoção Ampla: +2 PM por patamar", () => {
    expect(pmDaDevocaoAmpla("arton", 1)).toBe(2);
    expect(pmDaDevocaoAmpla("panteao", 5)).toBe(4);
    expect(pmDaDevocaoAmpla("arton", 17)).toBe(8);
    expect(pmDaDevocaoAmpla("allihanna", 20)).toBe(0);
  });
});

describe("deuses disponíveis para druidas", () => {
  it("a lista é só a da classe — nem a raça nem o coringa humano abrem outros", () => {
    const ids = listDivindadesParaPersonagem("anao", "druida").map((d) => d.id);
    expect(ids.sort()).toEqual(["aharadak", "allihanna", "arton", "megalokk", "oceano", "tenebra"]);
    // anão entra na lista de raças de Khalmyr, mas o druida não pode segui-lo.
    expect(isDivindadeAcessa("khalmyr", "anao", "druida")).toBe(false);
    expect(isDivindadeAcessa("khalmyr", "humano", "druida")).toBe(false);
    // Devoções Abertas (regra da mesa) desliga a restrição.
    expect(isDivindadeAcessa("khalmyr", "humano", "druida", true)).toBe(true);
  });
});
