import { getOrigem } from "../../rules/origem.js";
import { getDivindade } from "../../rules/divindade.js";
import type { WizardState } from "../state.js";

export interface RevisaoContext {
  stepTitle: string;
  nome: string;
  nivel: number;
  racaNome: string;
  origemNome: string;
  classeNome: string;
  divindadeNome: string;
  atributos: Array<{ label: string; value: number }>;
  poderesSelecionados: number;
  magiasSelecionadas: number;
  equipamentoSelecionado: number;
  dinheiroRestante: number;
  isComplete: boolean;
  errors: string[];
}

const ATTR_LABELS: Record<string, string> = {
  for: "For", des: "Des", con: "Con", int: "Int", sab: "Sab", car: "Car",
};

export function prepareRevisaoContext(
  state: WizardState,
  racaNome: string,
  classeNome: string,
  errors: string[] = []
): RevisaoContext {
  const origem = getOrigem(state.origemId);
  const divindade = state.divindadeId ? getDivindade(state.divindadeId) : null;

  const atributos = (["for", "des", "con", "int", "sab", "car"] as const).map((id) => ({
    label: ATTR_LABELS[id],
    value: state.atributosBase[id] ?? 0,
  }));

  return {
    stepTitle: "Revisão",
    nome: state.nome,
    nivel: state.nivel,
    racaNome,
    origemNome: origem?.nome ?? state.origemId,
    classeNome,
    divindadeNome: divindade?.nome ?? "—",
    atributos,
    poderesSelecionados: state.poderes.length,
    magiasSelecionadas: state.magias.length,
    equipamentoSelecionado: state.equipamento.length,
    dinheiroRestante: state.dinheiroRestante,
    isComplete: state.isComplete(),
    errors,
  };
}
