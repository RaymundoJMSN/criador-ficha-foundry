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

export type ItemCategoria = "arma" | "geral" | "consumivel";

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
  nivel1RollNote: string;
  // Categories
  categoriaAtual: ItemCategoria;
  // Items in current category
  itens: EquipItem[];
  // Cart: selected non-initial items
  carrinho: EquipItem[];
  // Initial items (from origin)
  itensIniciais: EquipItem[];
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

function toCategoria(type: string): ItemCategoria {
  if (type === "arma") return "arma";
  if (type === "consumivel" || type === "pocao") return "consumivel";
  return "geral";
}

export function prepareEquipamentoContext(
  state: WizardState,
  allItems: IndexedEquipamento[],
  errors: string[] = []
): EquipamentoContext {
  // Starting money
  const nivelEntry = dinheiroData.por_nivel.find((e) => e.nivel === state.nivel);
  const dinheiroInicial =
    typeof nivelEntry?.valor === "number" ? nivelEntry.valor : 14; // avg 4d6 for level 1
  const nivel1RollNote = state.nivel === 1 ? "4d6 T$ (média: 14 T$)" : "";

  // Initial items from origin
  const itensIniciaisNomes = resolveItensIniciaisNomes(state.origemId);

  // Current category tab
  const categoriaAtual = ((state.escolhasPorItem["equip_categoria"] as string) ??
    "arma") as ItemCategoria;

  // Build cart map from state.equipamento
  const cartMap = new Map<string, number>(state.equipamento.map((e) => [e.itemId, e.qty]));

  const allEquipItems: EquipItem[] = allItems.map((item) => {
    const qty = cartMap.get(item.id) ?? 0;
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
      preco: item.system?.preco ?? 0,
      peso: item.system?.peso ?? 0,
      qty,
      selected: qty > 0,
      isInitial: itensIniciaisNomes.has(item.name),
    };
  });

  // Filter to current category
  const itens = allEquipItems.filter((i) => toCategoria(i.type) === categoriaAtual);

  // Cart: selected items that are NOT initial (initial are free, no cost)
  const carrinho = allEquipItems.filter((i) => i.selected && !i.isInitial);
  const itensIniciais = allEquipItems.filter((i) => i.isInitial);

  // Spending (sum qty * preco for cart items)
  const dinheiroGasto = carrinho.reduce((sum, i) => sum + i.preco * i.qty, 0);
  const dinheiroRestante = dinheiroInicial - dinheiroGasto;

  return {
    stepTitle: "Equipamentos",
    dinheiroInicial,
    dinheiroGasto,
    dinheiroRestante,
    dinheiroOk: dinheiroRestante >= 0,
    nivel1RollNote,
    categoriaAtual,
    itens,
    carrinho,
    itensIniciais,
    errors,
  };
}
