import type { WizardState } from "../state.js";

export interface NivelContext {
  stepTitle: string;
  state: { nivel: number; nome: string };
  errors: string[];
}

export function prepareNivelContext(state: WizardState, errors: string[] = []): NivelContext {
  return {
    stepTitle: "Nível & Nome",
    state: { nivel: state.nivel, nome: state.nome },
    errors,
  };
}
