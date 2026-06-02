import dinheiroDataRaw from "../../data/dinheiro.json";
import origensDataRaw from "../../data/origens.json";
import type { IndexedEquipamento } from "../../compendium/types.js";
import type { WizardState } from "../state.js";

const dinheiroData = dinheiroDataRaw as {
  por_nivel: Array<{ nivel: number; valor: number | string; moeda: string }>;
};

type OrigemEntry = {
  id: string;
  nome: string;
  itens_iniciais?: Array<string | { item: string; observacao?: string }>;
};
const origensData = origensDataRaw as OrigemEntry[];

export type ItemCategoria = "arma" | "armadura" | "geral" | "consumivel";

// These are the actual subtipo values in tormenta20 system for armor-type items
const ARMADURA_SUBTIPOS = new Set([
  "Armadura Leve",
  "Armadura Pesada",
  "Escudo",
  "Armadura Natural",
  "Bônus Mágico",
  "Acessório",
  "Vestuário",
  "Ferramenta",
  "Esotérico",
]);

export interface EquipItem {
  id: string;
  name: string;
  img: string;
  type: string;
  preco: number;
  peso: number;
  qty: number;
  selected: boolean;
  isInitial: boolean; // from origin — included free
}

export interface EquipamentoContext {
  stepTitle: string;
  // Money
  dinheiroInicial: number;
  dinheiroGasto: number;
  dinheiroRestante: number;
  dinheiroOk: boolean;
  isNivel1: boolean;
  // Categories
  categoriaAtual: ItemCategoria;
  // Search
  equipSearch: string;
  // Items in current category
  itens: EquipItem[];
  // Cart: selected non-initial items
  carrinho: EquipItem[];
  // Initial items (from origin)
  itensIniciais: EquipItem[];
  // Navigation guard
  canProceed: boolean;
  errors: string[];
}

function resolveItensIniciaisNomes(origemId: string): Set<string> {
  const origem = origensData.find((o) => o.id === origemId);
  if (!origem?.itens_iniciais) return new Set();
  const nomes = origem.itens_iniciais.map((entry) =>
    typeof entry === "string" ? entry : entry.item
  );
  return new Set(nomes);
}

function toCategoria(type: string, subtipo?: string): ItemCategoria {
  if (type === "arma") return "arma";
  if (type === "consumivel" || type === "pocao") return "consumivel";
  if (subtipo && ARMADURA_SUBTIPOS.has(subtipo)) return "armadura";
  return "geral";
}

export function prepareEquipamentoContext(
  state: WizardState,
  allItems: IndexedEquipamento[],
  errors: string[] = []
): EquipamentoContext {
  const isNivel1 = state.nivel === 1;

  // Starting money — prefer rolled value for level 1
  const nivelEntry = dinheiroData.por_nivel.find((e) => e.nivel === state.nivel);
  const rolado = isNivel1
    ? (state.escolhasPorItem["dinheiro_rolado"] as number | undefined)
    : undefined;
  const dinheiroInicial =
    rolado ?? (typeof nivelEntry?.valor === "number" ? nivelEntry.valor : 14);

  // Initial items from origin
  const itensIniciaisNomes = resolveItensIniciaisNomes(state.origemId);

  // Current category tab
  const categoriaAtual = ((state.escolhasPorItem["equip_categoria"] as string) ??
    "arma") as ItemCategoria;

  // Search filter
  const equipSearch = (state.escolhasPorItem["equip_search"] as string | undefined) ?? "";
  const searchLower = equipSearch.toLowerCase();

  // Build cart map from state.equipamento
  const cartMap = new Map<string, number>(state.equipamento.map((e) => [e.itemId, e.qty]));

  const allEquipItems: EquipItem[] = allItems.map((item) => {
    const qty = cartMap.get(item.id) ?? 0;
    const subtipo = item.system?.subtipo as string | undefined;
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      preco: (item.system?.preco as number | undefined) ?? 0,
      peso: (item.system?.peso as number | undefined) ?? 0,
      qty,
      selected: qty > 0,
      isInitial: itensIniciaisNomes.has(item.name),
      // carry subtipo for display
      _subtipo: subtipo,
      _categoria: toCategoria(item.type, subtipo),
    } as EquipItem & { _subtipo?: string; _categoria: ItemCategoria };
  });

  // Filter to current category + search
  const itens = (allEquipItems as Array<EquipItem & { _categoria: ItemCategoria }>)
    .filter((i) => i._categoria === categoriaAtual)
    .filter((i) => !searchLower || i.name.toLowerCase().includes(searchLower));

  // Cart: selected items that are NOT initial (initial are free, no cost)
  const carrinho = allEquipItems.filter((i) => i.selected && !i.isInitial);
  const itensIniciais = allEquipItems.filter((i) => i.isInitial);

  // Spending (sum qty * preco for cart items)
  const dinheiroGasto = carrinho.reduce((sum, i) => sum + i.preco * i.qty, 0);
  const dinheiroRestante = dinheiroInicial - dinheiroGasto;
  const dinheiroOk = dinheiroRestante >= 0;

  return {
    stepTitle: "Equipamentos",
    dinheiroInicial,
    dinheiroGasto,
    dinheiroRestante,
    dinheiroOk,
    isNivel1,
    categoriaAtual,
    equipSearch,
    itens,
    carrinho,
    itensIniciais,
    canProceed: dinheiroOk,
    errors,
  };
}
