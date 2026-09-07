import { describe, it, expect } from "vitest";
import { CONFIG_PADRAO, normalizarConfig, resumoConfig, type ConfigCriacao } from "../../src/config/config.js";
import {
  FAIXAS,
  COMPLICACOES_IDADE,
  faixaDoPersonagem,
  nivelEfetivo,
  complicacoesIdadeExigidas,
  poderesGeraisExtras,
  beneficiosDeOrigemPermitidos,
  pendenciasDeIdade,
  temPassoIdade,
} from "../../src/rules/idade.js";
import { passosAplicaveis, WizardStep } from "../../src/rules/steps.js";
import { isDivindadeAcessa, listDivindadesParaPersonagem } from "../../src/rules/divindade.js";
import { valoresFixosDaRaca, distribuirAbertos, getRaceAttributeTotals, totaisRaciaisDoEstado } from "../../src/rules/subescolhas.js";
import { validarAtributos, validatePointBuy } from "../../src/rules/atributos.js";
import { getBeneficiosPlano, validarBeneficios } from "../../src/rules/origem.js";
import { WizardState } from "../../src/wizard/state.js";
import { pendencias, type EngineState } from "../../src/rules/engine.js";

const cfg = (o: Partial<ConfigCriacao> = {}): ConfigCriacao => ({ ...CONFIG_PADRAO, ...o });
const est = (config: Partial<ConfigCriacao>, escolhasPorItem: Record<string, unknown> = {}) => ({
  config: cfg(config),
  escolhasPorItem,
});

describe("config — normalização e resumo", () => {
  it("setting velho/vazio vira padrão; lixo é limpo", () => {
    expect(normalizarConfig(undefined)).toEqual(CONFIG_PADRAO);
    const c = normalizarConfig({ pontosCompra: "15", dinheiroFixo: -3, racasPermitidas: ["Anão", ""], complicacoes: true });
    expect(c.pontosCompra).toBe(15);
    expect(c.dinheiroFixo).toBe(0);
    expect(c.racasPermitidas).toEqual(["Anão"]);
    expect(c.complicacoes).toBe(true);
  });
  it("resumo só lista o que difere do livro", () => {
    expect(resumoConfig(CONFIG_PADRAO, (id) => id)).toEqual([]);
    expect(resumoConfig(cfg({ metodoAtributos: "valkaria", devocoesAbertas: true }), (id) => id.toUpperCase())).toEqual([
      "atributos por VALKARIA",
      "devoções abertas",
    ]);
  });
});

describe("Idades Variadas — HA p.288 Tabela 4-2", () => {
  it("sete faixas, jovem é a padrão e não muda nada", () => {
    expect(FAIXAS.map((f) => f.id)).toEqual(["crianca", "adolescente", "jovem", "adulto", "maduro", "velho", "anciao"]);
    expect(faixaDoPersonagem(est({ idadesVariadas: true })).id).toBe("jovem");
    expect(faixaDoPersonagem(est({ idadesVariadas: false }, { idade_faixa: "anciao" })).id).toBe("jovem");
  });
  it("ancião: For/Des/Con −2, +3 níveis, 4 complicações, sem Aumento físico", () => {
    const s = est({ idadesVariadas: true }, { idade_faixa: "anciao" });
    const f = faixaDoPersonagem(s);
    expect(f.atributos).toEqual({ for: -2, des: -2, con: -2 });
    expect(nivelEfetivo(1, s)).toBe(4);
    expect(nivelEfetivo(19, s)).toBe(20);
    expect(complicacoesIdadeExigidas(s)).toBe(4);
    expect(f.bloqueiaAumentoFisico).toBe(true);
  });
  it("maduro +1 nível e 2 complicações; velho −1 físicos, +2 níveis, 3 complicações", () => {
    expect(nivelEfetivo(3, est({ idadesVariadas: true }, { idade_faixa: "maduro" }))).toBe(4);
    expect(complicacoesIdadeExigidas(est({ idadesVariadas: true }, { idade_faixa: "maduro" }))).toBe(2);
    const v = faixaDoPersonagem(est({ idadesVariadas: true }, { idade_faixa: "velho" }));
    expect(v.atributos).toEqual({ for: -1, des: -1, con: -1 });
    expect(v.niveisExtras).toBe(2);
    expect(v.complicacoes).toBe(3);
  });
  it("criança: sem origem, tamanho menor, Protegido dos Deuses; adolescente: 1 benefício e +3 PM", () => {
    const c = faixaDoPersonagem(est({ idadesVariadas: true }, { idade_faixa: "crianca" }));
    expect(c.atributos).toEqual({ for: -2, con: -1, sab: -1 });
    expect(beneficiosDeOrigemPermitidos(est({ idadesVariadas: true }, { idade_faixa: "crianca" }))).toBe(0);
    expect(c.tamanhoMenor).toBe(true);
    expect(c.habilidades.map((h) => h.nome)).toContain("Protegido dos Deuses");
    const a = faixaDoPersonagem(est({ idadesVariadas: true }, { idade_faixa: "adolescente" }));
    expect(beneficiosDeOrigemPermitidos(est({ idadesVariadas: true }, { idade_faixa: "adolescente" }))).toBe(1);
    expect(a.habilidades.find((h) => h.nome === "Ímpeto Juvenil")?.efeitos).toEqual([
      { chave: "system.attributes.pm.bonus.total", valor: 3 },
    ]);
  });
  it("19 complicações de idade (HA p.290-291)", () => {
    expect(COMPLICACOES_IDADE).toHaveLength(19);
    expect(COMPLICACOES_IDADE.find((c) => c.id === "catarata")?.efeitos).toEqual([
      { chave: "system.pericias.perc.bonus", valor: -5 },
      { chave: "system.pericias.pont.bonus", valor: -5 },
    ]);
  });
});

describe("Complicações e Já Vi Coisas → poderes gerais extras", () => {
  it("complicação só conta com a regra ligada; Já Vi Coisas idem", () => {
    expect(poderesGeraisExtras(est({}, { complicacao: "x", idade_ja_vi_coisas: true }))).toBe(0);
    expect(poderesGeraisExtras(est({ complicacoes: true }, { complicacao: "x" }))).toBe(1);
    expect(poderesGeraisExtras(est({ complicacoes: true, complicacaoIdade: true }, { complicacao: "x", idade_ja_vi_coisas: true }))).toBe(2);
  });
  it("as três regras juntas: ancião com complicação e Já Vi Coisas = 5 complicações de idade, 2 poderes gerais", () => {
    const s = est(
      { complicacoes: true, complicacaoIdade: true, idadesVariadas: true },
      { idade_faixa: "anciao", complicacao: "x", idade_ja_vi_coisas: true }
    );
    expect(complicacoesIdadeExigidas(s)).toBe(5);
    expect(poderesGeraisExtras(s)).toBe(2);
    expect(pendenciasDeIdade(s)).toEqual(["Escolha 5 complicação(ões) de idade — 0 marcada(s)."]);
    const ok = est(
      { complicacoes: true, complicacaoIdade: true, idadesVariadas: true },
      { idade_faixa: "anciao", complicacao: "x", idade_ja_vi_coisas: true, complicacoes_idade: ["abatido", "catarata", "gota", "tosse", "turrao"] }
    );
    expect(pendenciasDeIdade(ok)).toEqual([]);
  });
  it("complicação de idade repetida ou inventada não conta", () => {
    const s = est({ complicacaoIdade: true }, { idade_ja_vi_coisas: true, complicacoes_idade: ["gota", "gota", "xyz"] });
    // "gota" duplicada e "xyz" inexistente somam UMA válida — exatamente a exigida.
    expect(pendenciasDeIdade(s)).toEqual([]);
    expect(pendenciasDeIdade(est({ complicacaoIdade: true }, { idade_ja_vi_coisas: true, complicacoes_idade: ["xyz"] }))).toEqual([
      "Escolha 1 complicação(ões) de idade — 0 marcada(s).",
    ]);
  });
});

describe("passo Idade & Complicações só com alguma regra ligada", () => {
  it("padrão não tem o passo; qualquer uma das três liga", () => {
    expect(temPassoIdade(CONFIG_PADRAO)).toBe(false);
    expect(passosAplicaveis("guerreiro", [], CONFIG_PADRAO)).not.toContain(WizardStep.Idade);
    expect(passosAplicaveis("guerreiro", [], cfg({ complicacoes: true }))).toContain(WizardStep.Idade);
    expect(passosAplicaveis("guerreiro", [], cfg({ idadesVariadas: true }))).toContain(WizardStep.Idade);
    const p = passosAplicaveis("guerreiro", [], cfg({ complicacaoIdade: true }));
    expect(p.indexOf(WizardStep.Idade)).toBe(p.indexOf(WizardStep.Raca) + 1);
  });
});

describe("Devoções Abertas (HA p.281)", () => {
  it("anão arcanista não acessa Allihanna… a menos que a mesa abra", () => {
    expect(isDivindadeAcessa("allihanna", "anao", "arcanista")).toBe(false);
    expect(isDivindadeAcessa("allihanna", "anao", "arcanista", true)).toBe(true);
    expect(listDivindadesParaPersonagem("anao", "arcanista", true).length).toBeGreaterThan(
      listDivindadesParaPersonagem("anao", "arcanista").length
    );
  });
});

describe("Raças Abertas (HA p.281)", () => {
  it("anão: valores +2, +1, −1 aplicados onde o jogador quiser, sem repetir atributo", () => {
    expect(valoresFixosDaRaca("Anão")).toEqual([2, 1, -1]);
    const r = distribuirAbertos("Anão", { "0": "for", "1": "car", "2": "int" });
    expect(r.completo).toBe(true);
    expect(r.modificadores).toEqual({ for: 2, car: 1, int: -1 });
    expect(distribuirAbertos("Anão", { "0": "for", "1": "for", "2": "int" }).erros).toEqual([
      "Não pode aplicar mais de um modificador no mesmo atributo.",
    ]);
    expect(distribuirAbertos("Anão", { "0": "for" }).erros).toEqual(["Distribua os modificadores da raça (faltam 2)."]);
  });
  it("totais raciais respeitam a distribuição só com a regra ligada", () => {
    const base = { racaNome: "Anão", racaId: "", escolhasPorItem: { raca_aberta: { "0": "for", "1": "car", "2": "int" } } };
    expect(totaisRaciaisDoEstado({ ...base, config: { racasAbertas: false } })).toEqual({ con: 2, sab: 1, des: -1 });
    expect(totaisRaciaisDoEstado({ ...base, config: { racasAbertas: true } })).toEqual({ for: 2, car: 1, int: -1 });
    // humano: sem fixos, as escolhas continuam valendo
    expect(getRaceAttributeTotals("Humano", [["for", "des", "con"]], {})).toEqual({ for: 1, des: 1, con: 1 });
  });
});

describe("Pontos Variados e método travado", () => {
  it("5 pontos: For 3 + Des 1 estoura; 15 pontos aceita mais", () => {
    const attrs = { for: 3, des: 1, con: 0, int: 0, sab: 0, car: 0 };
    expect(validatePointBuy(attrs, 5).remaining).toBe(0);
    expect(validarAtributos("compra_pontos", { ...attrs, con: 1 }, {}, 5)).toEqual(["Pontos excedidos em 1."]);
    expect(validarAtributos("compra_pontos", { ...attrs, con: 4 }, {}, 15)).toEqual([]);
  });
});

describe("Origem por faixa etária (Sem Origem / Origem em Construção)", () => {
  it("criança: plano vazio e auto-válido; adolescente: 1 benefício", () => {
    expect(getBeneficiosPlano("acolito", () => null, 0)).toEqual({ opcoes: [], quantidade: 0, autoAplicar: true });
    expect(validarBeneficios("acolito", [], 0).errors).toEqual([]);
    expect(validarBeneficios("acolito", ["pericia:cura"], 1).errors).toEqual([]);
    expect(validarBeneficios("acolito", ["pericia:cura", "pericia:religiao"], 1).errors).toHaveLength(1);
  });
});

describe("pendencias() com regras da mesa", () => {
  it("guerreiro nv1 com complicação precisa de 1 poder geral a mais; ancião precisa das 4 complicações", () => {
    const s = new WizardState({
      nome: "X",
      nivel: 1,
      racaNome: "Anão",
      racaId: "r",
      origemId: "acolito",
      classeId: "c",
      classeNome: "Guerreiro",
      config: cfg({ complicacoes: true, idadesVariadas: true }),
      escolhasPorItem: {
        complicacao: "abc",
        idade_faixa: "anciao",
        origem_beneficios: ["pericia:cura", "poder:membro_da_igreja"],
        pericias: { obrigatorias: [["luta"]], escolhas: ["atletismo", "cavalgar"], extras_int: [], raca: [] },
      },
    });
    const p = pendencias(s as unknown as EngineState);
    expect(p).toContain("Escolha 1 poder(es) — 0 escolhido(s).");
    expect(p).toContain("Escolha 4 complicação(ões) de idade — 0 marcada(s).");
  });
});
