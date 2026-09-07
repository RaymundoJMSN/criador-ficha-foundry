import dinheiroDataRaw from "../../data/dinheiro.json";
import type { IndexedEquipamento } from "../../compendium/types.js";
import type { WizardState } from "../state.js";
import { equipamentoInicial, type EquipamentoInicial } from "../../rules/itens-iniciais.js";
import { beneficiosDeOrigemPermitidos } from "../../rules/idade.js";

const dinheiroData = dinheiroDataRaw as {
  por_nivel: Array<{ nivel: number; valor: number | string; moeda: string }>;
};

export type ItemCategoria = "arma" | "armadura" | "geral" | "consumivel";

export interface EquipItem {
  id: string;
  name: string;
  img: string;
  type: string;
  preco: number;
  peso: number;
  qty: number;
  selected: boolean;
}

export interface EquipamentoContext extends EquipamentoInicial {
  stepTitle: string;
  dinheiroInicial: number;
  /** Fórmulas ainda não roladas (4d6 do 1º nível + T$ em dado da origem). */
  formulasPendentes: string[];
  dinheiroRolado: number | undefined;
  dinheiroGasto: number;
  dinheiroRestante: number;
  dinheiroOk: boolean;
  isNivel1: boolean;
  categoriaAtual: ItemCategoria;
  equipSearch: string;
  itens: EquipItem[];
  carrinho: EquipItem[];
  escolhasPendentes: number;
  canProceed: boolean;
  errors: string[];
}

/** Armadura/escudo é `equipamento` com `system.tipo` leve|pesada|escudo (não há subtipo). */
function toCategoria(item: IndexedEquipamento): ItemCategoria {
  if (item.type === "arma") return "arma";
  if (item.type === "consumivel") return "consumivel";
  if (item.type === "equipamento" && ["leve", "pesada", "escudo"].includes(String(item.system.tipo ?? ""))) {
    return "armadura";
  }
  return "geral";
}

export function prepareEquipamentoContext(
  state: WizardState,
  allItems: IndexedEquipamento[],
  errors: string[] = []
): EquipamentoContext {
  const isNivel1 = state.nivel === 1;
  // Criança ("Sem Origem", HA p.288) não recebe os itens da origem.
  const inicial = equipamentoInicial({ ...state, semOrigem: beneficiosDeOrigemPermitidos(state) === 0 }, allItems);

  // T$: 4d6 no 1º nível (mais o que a origem der em dado), Tabela 3-1 acima.
  const nivelEntry = dinheiroData.por_nivel.find((e) => e.nivel === state.nivel);
  const dinheiroRolado = state.escolhasPorItem["dinheiro_rolado"] as number | undefined;
  // Mestre pode fixar o T$ inicial; aí não há 4d6 nem tabela — só o que a origem der.
  const fixoDaMesa = state.config.dinheiro === "fixo";
  const formulas = [...(isNivel1 && !fixoDaMesa ? ["4d6"] : []), ...inicial.formulasDinheiro];
  const formulasPendentes = dinheiroRolado === undefined && formulas.length ? formulas : [];
  const daTabela = typeof nivelEntry?.valor === "number" ? nivelEntry.valor : 0;
  const base = fixoDaMesa ? state.config.dinheiroFixo : isNivel1 ? 0 : daTabela;
  const rolado = fixoDaMesa || !isNivel1 ? (inicial.formulasDinheiro.length ? (dinheiroRolado ?? 0) : 0) : (dinheiroRolado ?? 0);
  const dinheiroInicial = base + rolado + inicial.dinheiroFixo;

  const categoriaAtual = ((state.escolhasPorItem["equip_categoria"] as string) ?? "arma") as ItemCategoria;
  const equipSearch = (state.escolhasPorItem["equip_search"] as string | undefined) ?? "";
  const searchLower = equipSearch.toLowerCase();

  const cartMap = new Map<string, number>(state.equipamento.map((e) => [e.itemId, e.qty]));
  const todos = allItems.map((item) => {
    const qty = cartMap.get(item.id) ?? 0;
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      preco: item.system.preco ?? 0,
      peso: item.system.peso ?? 0,
      qty,
      selected: qty > 0,
      categoria: toCategoria(item),
    };
  });

  const itens = todos
    .filter((i) => i.categoria === categoriaAtual)
    .filter((i) => !searchLower || i.name.toLowerCase().includes(searchLower))
    .sort((a, b) => a.name.localeCompare(b.name));
  const carrinho = todos.filter((i) => i.selected);

  const dinheiroGasto = carrinho.reduce((sum, i) => sum + i.preco * i.qty, 0);
  const dinheiroRestante = dinheiroInicial - dinheiroGasto;
  const dinheiroOk = dinheiroRestante >= 0;
  const escolhasPendentes = inicial.escolhas.filter((e) => !e.feita).length;

  return {
    stepTitle: "Equipamentos",
    ...inicial,
    dinheiroInicial,
    formulasPendentes,
    dinheiroRolado,
    dinheiroGasto,
    dinheiroRestante,
    dinheiroOk,
    isNivel1,
    categoriaAtual,
    equipSearch,
    itens,
    carrinho,
    escolhasPendentes,
    canProceed: dinheiroOk && escolhasPendentes === 0 && formulasPendentes.length === 0,
    errors,
  };
}
