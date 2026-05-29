import type { WizardState } from "../state.js";
import type { IndexedRace } from "../../compendium/types.js";

export interface RacaContext {
  stepTitle: string;
  racas: Array<{ id: string; name: string; img: string; selected: boolean }>;
  errors: string[];
}

export function prepareRacaContext(
  state: WizardState,
  racas: IndexedRace[],
  errors: string[] = []
): RacaContext {
  return {
    stepTitle: "Raça",
    racas: racas.map((r) => ({
      id: r.id,
      name: r.name,
      img: r.img,
      selected: r.id === state.racaId,
    })),
    errors,
  };
}
