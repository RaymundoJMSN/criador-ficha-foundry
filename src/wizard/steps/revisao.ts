import { getOrigem } from "../../rules/origem.js";
import { pendencias, type EngineState } from "../../rules/engine.js";
import { getDivindade } from "../../rules/divindade.js";
import type { WizardState } from "../state.js";
import { getRaceAttributeTotals } from "../../rules/subescolhas.js";

export interface RevisaoContext {
  stepTitle: string;
  nome: string;
  nivel: number;
  racaNome: string;
  origemNome: string;
  classeNome: string;
  divindadeNome: string;
  /** `value` = final (base + raça); `base` só aparece quando a raça mexe. */
  atributos: Array<{ label: string; value: number; base: number; racial: number }>;
  poderesSelecionados: number;
  magiasSelecionadas: number;
  equipamentoSelecionado: number;
  dinheiroRestante: number;
  isComplete: boolean;
  /** O que ainda falta; vazio = pode criar. */
  pendencias: string[];
  errors: string[];
}

const ATTR_LABELS: Record<string, string> = {
  for: "For",
  des: "Des",
  con: "Con",
  int: "Int",
  sab: "Sab",
  car: "Car",
};

export function prepareRevisaoContext(
  state: WizardState,
  racaNome: string,
  classeNome: string,
  errors: string[] = [],
  dinheiroRestante: number = state.dinheiroRestante
): RevisaoContext {
  const origem = getOrigem(state.origemId);
  const divindade = state.divindadeId ? getDivindade(state.divindadeId) : null;

  const faltando = pendencias(state as unknown as EngineState);

  // A ficha mostra o atributo com a raça somada; a Revisão mostrava só a base
  // e um anão de Con 2 aparecia com 2 aqui e 4 na ficha.
  const daRaca = getRaceAttributeTotals(
    state.racaNome || state.racaId,
    (state.escolhasPorItem["raca_modificadores"] as string[][] | undefined) ?? []
  );
  const atributos = (["for", "des", "con", "int", "sab", "car"] as const).map((id) => {
    const base = state.atributosBase[id] ?? 0;
    const racial = daRaca[id] ?? 0;
    return { label: ATTR_LABELS[id], value: base + racial, base, racial };
  });

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
    dinheiroRestante,
    isComplete: faltando.length === 0,
    pendencias: faltando,
    errors,
  };
}
