import { describe, it, expect } from "vitest";
import {
  chaveDaRaca,
  montagemDaRaca,
  gruposDeAtributoDaMontagem,
  atributosFixosDaMontagem,
  tamanhoDaMontagem,
  deslocamentoDaMontagem,
  poderesDaMontagem,
  anotacoesDaMontagem,
  pendenciasDaMontagem,
  periciasTrocadasNaMontagem,
} from "../../src/rules/montagem.js";
import { getRaca, getRaceSkillBonus, escolhasDaRaca } from "../../src/rules/raca.js";
import { getRaceModifierGroups, validateRaceModifiers, getRaceAttributeTotals } from "../../src/rules/subescolhas.js";

describe("chave da raça (alias dos nomes repetidos do compêndio)", () => {
  it("Golem (Ameaças de Arton) é o golem desperto; Kobolds é kobold", () => {
    expect(chaveDaRaca("Golem (Ameaças de Arton)")).toBe("golem_desperto");
    expect(chaveDaRaca("Golem")).toBe("golem");
    expect(chaveDaRaca("Kobolds")).toBe("kobold");
    expect(getRaca("Golem (Ameaças de Arton)")?.id).toBe("golem_desperto");
    expect(getRaca("Golem")?.id).toBe("golem");
  });
});

describe("Duende (HA): natureza, tamanho, dons, presentes, tabu", () => {
  const m = montagemDaRaca("Duende")!;

  it("tem os quatro passos com as cotas do livro", () => {
    expect(m.passos!.map((p) => [p.id, p.escolher])).toEqual([
      ["natureza", 1],
      ["tamanho", 1],
      ["presentes", 3],
      ["tabu", 1],
    ]);
    expect(m.passos![2]!.opcoes).toHaveLength(14);
  });

  it("sem nada marcado, cobra cada passo", () => {
    const p = pendenciasDaMontagem("Duende", {});
    expect(p).toHaveLength(4);
    expect(p[0]).toMatch(/Natureza: escolha 1/);
  });

  it("Dons (+1 em dois diferentes) sempre; Natureza Animal soma +1 em um que pode repetir", () => {
    expect(getRaceModifierGroups("Duende", {})).toEqual([
      expect.objectContaining({ valor: 1, quantidade: 2, atributos_diferentes: true }),
    ]);
    const esc = { mont_natureza: ["animal"] };
    expect(gruposDeAtributoDaMontagem("Duende", esc)).toHaveLength(2);
    // dons For+Des, natureza For de novo → For 2, Des 1
    expect(validateRaceModifiers("Duende", [["for", "des"], ["for"]], esc).modificadores).toEqual({ for: 2, des: 1 });
    // dons não repetem
    expect(validateRaceModifiers("Duende", [["for", "for"], ["des"]], esc).errors.length).toBeGreaterThan(0);
  });

  it("tamanho define atributo fixo, categoria e deslocamento", () => {
    const esc = { mont_tamanho: ["minusculo"] };
    expect(atributosFixosDaMontagem("Duende", esc)).toEqual({ for: -1 });
    expect(tamanhoDaMontagem("Duende", esc)).toBe("min");
    expect(deslocamentoDaMontagem("Duende", esc)).toBe(6);
    expect(getRaceAttributeTotals("Duende", [["int", "sab"]], undefined, esc)).toEqual({ for: -1, int: 1, sab: 1 });
    expect(tamanhoDaMontagem("Duende", { mont_tamanho: ["grande"] })).toBe("gra");
  });

  it("três presentes, só uma Afinidade Elemental", () => {
    const ok = { mont_natureza: ["vegetal"], mont_tamanho: ["medio"], mont_presentes: ["afinidade_fogo", "voo", "maldicao"], mont_tabu: ["luta"] };
    expect(pendenciasDaMontagem("Duende", ok)).toEqual([]);
    const duas = { ...ok, mont_presentes: ["afinidade_fogo", "afinidade_agua", "voo"] };
    expect(pendenciasDaMontagem("Duende", duas).join(" ")).toMatch(/só uma opção do mesmo grupo/);
    const quatro = { ...ok, mont_presentes: ["afinidade_fogo", "voo", "maldicao", "enfeiticar"] };
    expect(pendenciasDaMontagem("Duende", quatro).join(" ")).toMatch(/no máximo 3/);
    const dois = { ...ok, mont_presentes: ["voo", "maldicao"] };
    expect(pendenciasDaMontagem("Duende", dois).join(" ")).toMatch(/escolha 3 \(2 marcada/);
  });

  it("poderes a embutir: natureza, tamanho e presentes (Médio não tem item); tabu anota o item concedido", () => {
    const esc = { mont_natureza: ["vegetal"], mont_tamanho: ["medio"], mont_presentes: ["afinidade_fogo", "voo", "lingua_da_natureza"], mont_tabu: ["percepcao"] };
    const poderes = poderesDaMontagem("Duende", esc);
    // ordem = ordem do passo no JSON, não a de marcação
    expect(poderes.map((p) => p.poder)).toEqual(["Natureza Vegetal", "Duende Médio", "Afinidade Elemental (Fogo)", "Língua da Natureza", "Voo"]);
    expect(poderes.find((p) => p.poder === "Língua da Natureza")?.efeitos).toEqual([
      { chave: "system.pericias.ades.bonus", valor: 2 },
      { chave: "system.pericias.sobr.bonus", valor: 2 },
    ]);
    expect(anotacoesDaMontagem("Duende", esc)).toEqual([
      { item: "Tabu", sufixo: "Percepção", efeitos: [{ chave: "system.pericias.perc.bonus", valor: -5 }] },
    ]);
  });
});

describe("Kallyanach (Ameaças p.151): duas bênçãos, com sub-escolhas", () => {
  it("Armamento pede a arma natural; Prática Arcana pede a magia", () => {
    const esc = { mont_bencaos: ["armamento", "pratica_arcana"] };
    const p = pendenciasDaMontagem("Kallyanach", esc);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatch(/Armamento Kallyanach: arma natural/);
    const cheio = { ...esc, mont_bencaos_armamento_sub: "cauda", mont_bencaos_pratica_arcana_sub: "MAGIA123" };
    expect(pendenciasDaMontagem("Kallyanach", cheio)).toEqual([]);
    const poderes = poderesDaMontagem("Kallyanach", cheio);
    expect(poderes[0]).toEqual({ poder: "Armamento Kallyanach", sufixo: "Cauda (impacto)", efeitos: [] });
    expect(poderes[1]).toEqual({ poder: "Prática Arcana", efeitos: [], magiaId: "MAGIA123" });
  });

  it("Escamas Elementais dão +2 na Defesa; a raça segue com +1 em dois OU +2 em um e a Herança Dracônica", () => {
    expect(poderesDaMontagem("Kallyanach", { mont_bencaos: ["escamas"] })[0]?.efeitos).toEqual([{ chave: "system.attributes.defesa.bonus", valor: 2 }]);
    expect(getRaceModifierGroups("Kallyanach")[0]).toMatchObject({ valor: 1, quantidade: 2, atributos_diferentes: false, alternativa: { valor: 2, quantidade: 1 } });
    expect(validateRaceModifiers("Kallyanach", [["for", "for"]]).modificadores).toEqual({ for: 2 });
    expect(escolhasDaRaca("Kallyanach").map((e) => e.chave)).toEqual(["raca_heranca_draconica"]);
  });
});

describe("Golens Despertos (DB): chassi, fonte, tamanho", () => {
  const ref = "Golem (Ameaças de Arton)";
  it("base For +1 Car –1; chassi e tamanho somam; Bronze abre +1 em dois (pode repetir)", () => {
    const esc = { mont_chassi: ["barro"], mont_fonte: ["vapor"], mont_tamanho: ["pequeno"] };
    expect(pendenciasDaMontagem(ref, esc)).toEqual([]);
    expect(getRaceAttributeTotals(ref, [], undefined, esc)).toEqual({ for: 1, car: -1, con: 2, des: 1 });
    const bronze = { mont_chassi: ["bronze"], mont_fonte: ["alquimica"], mont_tamanho: ["medio"] };
    expect(getRaceModifierGroups(ref, bronze)).toEqual([expect.objectContaining({ valor: 1, quantidade: 2, atributos_diferentes: false })]);
    expect(validateRaceModifiers(ref, [["sab", "sab"]], bronze).modificadores).toEqual({ sab: 2 });
    expect(deslocamentoDaMontagem(ref, { mont_chassi: ["pedra"] })).toBe(6);
    expect(deslocamentoDaMontagem(ref, { mont_chassi: ["barro"] })).toBeNull();
  });
  it("Elemental pede o elemento; Sagrada pede a magia divina", () => {
    const esc = { mont_chassi: ["barro"], mont_fonte: ["elemental"], mont_tamanho: ["medio"] };
    expect(pendenciasDaMontagem(ref, esc).join(" ")).toMatch(/Elemental: elemento/);
    expect(poderesDaMontagem(ref, { ...esc, mont_fonte_elemental_sub: "fogo" }).map((p) => [p.poder, p.sufixo])).toEqual([
      ["Barro", undefined],
      ["Elemental", "Fogo (fogo)"],
    ]);
  });
  it("o Golem do Livro Básico não tem montagem", () => {
    expect(montagemDaRaca("Golem")).toBeNull();
  });
});

describe("Mashin e Kobolds", () => {
  it("maravilha mecânica é opcional e toma o lugar de uma perícia treinada", () => {
    expect(pendenciasDaMontagem("Mashin", {})).toEqual([]);
    expect(getRaceSkillBonus("Mashin")).toBe(2);
    expect(periciasTrocadasNaMontagem("Mashin", { mont_maravilha: ["arma_acoplada"] })).toBe(1);
    expect(getRaceSkillBonus("Mashin", { mont_maravilha: ["arma_acoplada"] })).toBe(1);
    expect(pendenciasDaMontagem("Mashin", { mont_maravilha: ["canhao_energetico"] }).join(" ")).toMatch(/exige Arma Acoplada/);
  });
  it("kobolds escolhem dois talentos; Os do Fundo exige Organizadinhos", () => {
    expect(pendenciasDaMontagem("Kobolds", { mont_talentos: ["os_do_fundo", "somos_explosivos"] }).join(" ")).toMatch(/Os do Fundo exige Organizadinhos/);
    expect(pendenciasDaMontagem("Kobolds", { mont_talentos: ["os_do_fundo", "organizadinhos"] })).toEqual([]);
    expect(pendenciasDaMontagem("Kobolds", { mont_talentos: ["armadilha_terrivel", "o_ousado"] }).join(" ")).toMatch(/Armadilha Terrível/);
  });
});

describe("Vampiro (Guia de NPCs): Resquícios da Outra Vida", () => {
  it("é uma escolha racial com três caminhos, como a Memória Póstuma do osteon", () => {
    const [r] = escolhasDaRaca("Vampiro");
    expect(r?.habilidade).toBe("Resquícios da Outra Vida");
    expect(r?.ramos.map((x) => x.pedido.tipo)).toEqual(["pericia", "poder", "habilidade_outra_raca"]);
  });
});
