import type { WizardState } from "../state.js";
import type { AnyIndexed } from "../../compendium/types.js";

export interface EquipamentoEntry {
  id: string;
  name: string;
  img: string;
  preco: number;
  qty: number;
  inCart: boolean;
  affordable: boolean;
}

export interface EquipamentoContext {
  stepTitle: string;
  saldo: number;
  itens: EquipamentoEntry[];
  carrinho: Array<{ id: string; name: string; qty: number; subtotal: number }>;
  totalCarrinho: number;
  errors: string[];
}

export function prepareEquipamentoContext(
  state: WizardState,
  allEquipamento: AnyIndexed[],
  errors: string[] = []
): EquipamentoContext {
  const cartMap = new Map(state.equipamento.map((e) => [e.itemId, e.qty]));

  const itens: EquipamentoEntry[] = allEquipamento
    .filter((i) => ["equipamento", "arma", "consumivel", "tesouro"].includes(i.type))
    .map((i) => {
      const preco = (i as { system: { preco?: number } }).system?.preco ?? 0;
      const qty = cartMap.get(i.id) ?? 0;
      return {
        id: i.id,
        name: i.name,
        img: i.img,
        preco,
        qty,
        inCart: qty > 0,
        affordable: preco <= state.dinheiroRestante,
      };
    });

  const carrinho = state.equipamento.map((e) => {
    const item = allEquipamento.find((i) => i.id === e.itemId);
    const preco = (item as { system: { preco?: number } } | undefined)?.system?.preco ?? 0;
    return {
      id: e.itemId,
      name: item?.name ?? e.itemId,
      qty: e.qty,
      subtotal: preco * e.qty,
    };
  });

  const totalCarrinho = carrinho.reduce((sum, e) => sum + e.subtotal, 0);

  return {
    stepTitle: "Equipamento",
    saldo: state.dinheiroRestante,
    itens,
    carrinho,
    totalCarrinho,
    errors,
  };
}
