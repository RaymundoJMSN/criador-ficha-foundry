import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  type Divindade,
} from "../../rules/divindade.js";
import type { WizardState } from "../state.js";

export interface DivindadeContext {
  stepTitle: string;
  obrigatoria: boolean;
  divindades: Array<{
    id: string;
    nome: string;
    poderesCount: number;
    selected: boolean;
  }>;
  errors: string[];
}

export function prepareDivindadeContext(
  state: WizardState,
  errors: string[] = []
): DivindadeContext {
  const divindades = listDivindadesParaPersonagem(state.racaId, state.classeId);
  return {
    stepTitle: "Divindade",
    obrigatoria: isDivindadeObrigatoria(state.classeId),
    divindades: divindades.map((d: Divindade) => ({
      id: d.id,
      nome: d.nome,
      poderesCount: d.poderes_concedidos.length,
      selected: d.id === state.divindadeId,
    })),
    errors,
  };
}
