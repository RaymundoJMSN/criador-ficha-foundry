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
  selectedDivindade: { id: string; nome: string; poderesCount: number; selected: boolean } | null;
  errors: string[];
}

export function prepareDivindadeContext(
  state: WizardState,
  errors: string[] = []
): DivindadeContext {
  const divindades = listDivindadesParaPersonagem(state.racaId, state.classeId);
  const mappedDivindades = divindades.map((d: Divindade) => ({
    id: d.id,
    nome: d.nome,
    poderesCount: d.poderes_concedidos.length,
    selected: d.id === state.divindadeId,
  }));
  return {
    stepTitle: "Divindade",
    obrigatoria: isDivindadeObrigatoria(state.classeId),
    divindades: mappedDivindades,
    selectedDivindade: mappedDivindades.find((d) => d.selected) ?? null,
    errors,
  };
}
