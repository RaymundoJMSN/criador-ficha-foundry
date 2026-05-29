import { listOrigens } from "../../rules/origem.js";
import type { WizardState } from "../state.js";

export interface OrigemContext {
  stepTitle: string;
  origens: Array<{
    id: string;
    nome: string;
    periciasList: string;
    selected: boolean;
  }>;
  errors: string[];
}

export function prepareOrigemContext(
  state: WizardState,
  errors: string[] = []
): OrigemContext {
  return {
    stepTitle: "Origem",
    origens: listOrigens().map((o) => ({
      id: o.id,
      nome: o.nome,
      periciasList: o.beneficios.pericias.join(", "),
      selected: o.id === state.origemId,
    })),
    errors,
  };
}
