import { describe, it, expect } from "vitest";
import {
  acharPorNome,
  dinheiroDoTexto,
  equipamentoInicial,
  CATEGORIAS,
} from "../../src/rules/itens-iniciais.js";
import type { IndexedEquipamento } from "../../src/compendium/types.js";

const item = (
  name: string,
  type: IndexedEquipamento["type"],
  system: Record<string, unknown> = {}
): IndexedEquipamento => ({ id: `id_${name}`, name, img: "", packId: "p", type, system }) as IndexedEquipamento;

const ITENS: IndexedEquipamento[] = [
  item("Mochila", "tesouro"),
  item("Saco de dormir", "tesouro"),
  item("Traje de viajante", "equipamento", { tipo: "traje" }),
  item("Armadura de couro", "equipamento", { tipo: "leve" }),
  item("Couro batido", "equipamento", { tipo: "leve" }),
  item("Gibão de peles", "equipamento", { tipo: "leve" }),
  item("Brunea", "equipamento", { tipo: "pesada" }),
  item("Escudo leve", "equipamento", { tipo: "escudo" }),
  item("Escudo pesado", "equipamento", { tipo: "escudo" }),
  item("Símbolo Sagrado", "equipamento", { tipo: "traje" }),
  item("Adaga", "arma", { proficiencia: "simples", alcance: "short" }),
  item("Lança", "arma", { proficiencia: "simples", alcance: "short" }),
  item("Arco curto", "arma", { proficiencia: "simples", alcance: "medium" }),
  item("Espada longa", "arma", { proficiencia: "marcial", alcance: "-" }),
  item("Arco longo", "arma", { proficiencia: "marcial", alcance: "medium" }),
  item("Katana", "arma", { proficiencia: "exotica", alcance: "" }),
  item("Ração de viagem", "consumivel", {}),
  item("Flechas", "consumivel", {}),
  item("Estojo de disfarces", "equipamento", { tipo: "ferramenta" }),
  item("Gazua", "equipamento", { tipo: "ferramenta" }),
];

const st = (o: Partial<Parameters<typeof equipamentoInicial>[0]> = {}) => ({
  nivel: 1,
  origemId: "",
  classeNome: "Guerreiro",
  escolhasPorItem: {},
  ...o,
});

describe("acharPorNome", () => {
  it("ignora caixa, acento, artigo e plural", () => {
    expect(acharPorNome("símbolo sagrado", ITENS)?.name).toBe("Símbolo Sagrado");
    expect(acharPorNome("uma adaga", ITENS)?.name).toBe("Adaga");
    expect(acharPorNome("rações de viagem", ITENS)?.name).toBe("Ração de viagem");
    expect(acharPorNome("ferramenta pesada (maça ou lança)", ITENS)).toBeUndefined();
  });
});

describe("dinheiroDoTexto", () => {
  it("T$ fixo ou em dado; texto com 'em' não é dinheiro", () => {
    expect(dinheiroDoTexto("T$ 100")).toEqual({ fixo: 100 });
    expect(dinheiroDoTexto("T$ 2d6")).toEqual({ formula: "2d6" });
    expect(dinheiroDoTexto("T$ 100 em itens alquímicos")).toBeNull();
  });
});

describe("CATEGORIAS", () => {
  it("arma simples à distância = simples com alcance", () => {
    const f = CATEGORIAS["arma simples de ataque a distancia"]!.filtro;
    expect(ITENS.filter(f).map((i) => i.name)).toEqual(["Adaga", "Lança", "Arco curto"]);
  });
});

describe("equipamentoInicial — kit do 1º nível (LB p.146)", () => {
  it("guerreiro: mochila, saco, traje, arma simples + marcial, armadura até brunea, escudo leve", () => {
    const r = equipamentoInicial(st(), ITENS);
    expect(r.gratis.map((g) => g.label)).toEqual(["Mochila", "Saco de dormir", "Traje de viajante", "Escudo leve"]);
    expect(r.escolhas.map((e) => e.chave)).toEqual(["kit_arma_simples", "kit_arma_marcial", "kit_armadura"]);
    const armadura = r.escolhas.find((e) => e.chave === "kit_armadura")!;
    expect(armadura.sub!.map((o) => o.label)).toEqual(["— escolha —", "Armadura de couro", "Couro batido", "Gibão de peles", "Brunea"]);
    expect(r.escolhas.every((e) => !e.feita)).toBe(true);
  });
  it("arcanista: só arma simples, sem armadura nem escudo", () => {
    const r = equipamentoInicial(st({ classeNome: "Arcanista" }), ITENS);
    expect(r.escolhas.map((e) => e.chave)).toEqual(["kit_arma_simples"]);
    expect(r.gratis.map((g) => g.label)).toEqual(["Mochila", "Saco de dormir", "Traje de viajante"]);
  });
  it("escolha feita entra nos grátis", () => {
    const r = equipamentoInicial(
      st({ escolhasPorItem: { itens_iniciais: { kit_arma_simples_item: "id_Adaga", kit_armadura_item: "id_Armadura de couro" } } }),
      ITENS
    );
    expect(r.gratis.map((g) => g.label)).toContain("Adaga");
    expect(r.gratis.map((g) => g.label)).toContain("Armadura de couro");
    expect(r.escolhas.filter((e) => !e.feita).map((e) => e.chave)).toEqual(["kit_arma_marcial"]);
  });
  it("acima do 1º nível não há kit nem T$ da origem", () => {
    const r = equipamentoInicial(st({ nivel: 5, origemId: "marujo" }), ITENS);
    expect(r.escolhas).toEqual([]);
    expect(r.formulasDinheiro).toEqual([]);
    expect(r.gratis.map((g) => g.label)).toContain("corda");
  });
});

describe("equipamentoInicial — itens da origem", () => {
  it("acólito: símbolo sagrado resolvido; marujo: T$ 2d6 vira fórmula", () => {
    expect(equipamentoInicial(st({ origemId: "acolito", classeNome: "Arcanista" }), ITENS).gratis[0]).toEqual({
      label: "Símbolo Sagrado",
      itemId: "id_Símbolo Sagrado",
      qtd: 1,
      nota: undefined,
    });
    const m = equipamentoInicial(st({ origemId: "marujo", classeNome: "Arcanista" }), ITENS);
    expect(m.formulasDinheiro).toEqual(["2d6"]);
    expect(m.dinheiroFixo).toBe(0);
  });
  it("criminoso: 'estojo de disfarces ou gazua' vira escolha; escolhida entra nos grátis", () => {
    const sem = equipamentoInicial(st({ origemId: "criminoso", classeNome: "Arcanista" }), ITENS);
    const esc = sem.escolhas.find((e) => e.chave.startsWith("origem_"))!;
    expect(esc.opcoes.map((o) => o.label)).toEqual(["— escolha —", "estojo de disfarces", "gazua"]);
    expect(esc.feita).toBe(false);
    const com = equipamentoInicial(
      st({ origemId: "criminoso", classeNome: "Arcanista", escolhasPorItem: { itens_iniciais: { [esc.chave]: "gazua" } } }),
      ITENS
    );
    expect(com.gratis.map((g) => g.label)).toContain("Gazua");
    expect(com.escolhas.find((e) => e.chave === esc.chave)!.feita).toBe(true);
  });
  it("amazona: 'arma simples ou arma marcial' abre sub-lista da categoria", () => {
    const sem = equipamentoInicial(st({ origemId: "amazona_de_hippion", classeNome: "Arcanista" }), ITENS);
    const chave = sem.escolhas.find((e) => e.chave.startsWith("origem_"))!.chave;
    const r = equipamentoInicial(
      st({ origemId: "amazona_de_hippion", classeNome: "Arcanista", escolhasPorItem: { itens_iniciais: { [chave]: "arma marcial" } } }),
      ITENS
    );
    const e = r.escolhas.find((x) => x.chave === chave)!;
    expect(e.sub!.map((o) => o.label)).toEqual(["— escolha —", "Arco longo", "Espada longa"]);
    expect(e.feita).toBe(false);
  });
  it("quantidade e valor_max: ração ×10 e joia sem item vira texto com nota", () => {
    const c = equipamentoInicial(st({ origemId: "cativo_das_fadas", classeNome: "Arcanista" }), ITENS);
    expect(c.gratis.find((g) => g.label === "Ração de viagem")?.qtd).toBe(10);
    const a = equipamentoInicial(st({ origemId: "aristocrata", classeNome: "Arcanista" }), ITENS);
    const joia = a.gratis.find((g) => g.label === "joia de família")!;
    expect(joia.itemId).toBeUndefined();
    expect(joia.nota).toBe("até T$ 300");
  });
  it("agricultor sambur: T$ 100 fixo soma ao dinheiro", () => {
    expect(equipamentoInicial(st({ origemId: "agricultor_sambur", classeNome: "Arcanista" }), ITENS).dinheiroFixo).toBe(100);
  });
});
