import { isEligible } from "../../rules/poderes.js";
import type { WizardState } from "../state.js";
import type { IndexedPoder } from "../../compendium/types.js";

export interface PoderEntry {
  id: string;
  name: string;
  img: string;
  eligible: boolean;
  selected: boolean;
}

export interface PoderesContext {
  stepTitle: string;
  poderes: PoderEntry[];
  selectedCount: number;
  errors: string[];
}

export function preparePoderesContext(
  state: WizardState,
  poderes: IndexedPoder[],
  errors: string[] = []
): PoderesContext {
  const stateForEligibility = {
    nivel: state.nivel,
    atributosBase: state.atributosBase,
    classeId: state.classeId,
    racaId: state.racaId,
    periciasTreinadas: state.periciasTreinadas,
    poderes: state.poderes,
  };

  const entries: PoderEntry[] = poderes.map((p) => ({
    id: p.id,
    name: p.name,
    img: p.img,
    eligible: isEligible(p.name.toLowerCase().replace(/\s+/g, "_"), stateForEligibility),
    selected: state.poderes.includes(p.id),
  }));

  return {
    stepTitle: "Poderes",
    poderes: entries,
    selectedCount: state.poderes.length,
    errors,
  };
}
