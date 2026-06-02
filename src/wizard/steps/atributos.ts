import { listMetodos, validatePointBuy, pointBuyCost, POINT_BUY_INITIAL_POINTS } from "../../rules/atributos.js";
import type { WizardState } from "../state.js";

const ATTR_LABELS: Record<string, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

export interface AtributosContext {
  stepTitle: string;
  metodos: Array<{ id: string; nome: string; categoria: string; selected: boolean }>;
  isCompra: boolean;
  atributos: Array<{ id: string; label: string; value: number; custo: number }>;
  pontosRestantes: number;
  pontosNegativo: boolean;
  pontosTotal: number;
  metodoDescricao: string;
  errors: string[];
}

export function prepareAtributosContext(
  state: WizardState,
  errors: string[] = []
): AtributosContext {
  const metodos = listMetodos().map((m) => ({
    id: m.id,
    nome: m.nome,
    categoria: m.categoria,
    selected: m.id === state.metodoAtributos,
  }));

  const isCompra = state.metodoAtributos === "compra_pontos";

  const atributos = (["for", "des", "con", "int", "sab", "car"] as const).map((id) => {
    const value = state.atributosBase[id] ?? 0;
    let custo = 0;
    try {
      custo = pointBuyCost(value);
    } catch {
      /* invalid value */
    }
    return { id, label: ATTR_LABELS[id], value, custo };
  });

  const pbResult = validatePointBuy(state.atributosBase);

  return {
    stepTitle: "Atributos",
    metodos,
    isCompra,
    atributos,
    pontosRestantes: pbResult.remaining,
    pontosNegativo: pbResult.remaining < 0,
    pontosTotal: POINT_BUY_INITIAL_POINTS,
    metodoDescricao: metodos.find((m) => m.selected)?.nome ?? "",
    errors,
  };
}
