import { describeUnmet } from "../../rules/poderes.js";
import type { WizardState } from "../state.js";
import type { IndexedPoder } from "../../compendium/types.js";

export interface PoderEntry {
  id: string;
  name: string;
  img: string;
  eligible: boolean;
  unmet: string[];
  selected: boolean;
  tipo: string;
  subtipo: string;
  descricao: string;
}

export interface PoderesContext {
  stepTitle: string;
  poderes: PoderEntry[];
  categorias: string[];
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

  const entries: PoderEntry[] = poderes.map((p) => {
    const slug = p.name.toLowerCase().replace(/\s+/g, "_");
    const unmet = describeUnmet(slug, stateForEligibility);
    return {
      id: p.id,
      name: p.name,
      img: p.img,
      eligible: unmet.length === 0,
      unmet,
      selected: state.poderes.includes(p.id),
      tipo: p.system.tipo ?? "",
      subtipo: p.system.subtipo ?? "",
      descricao: p.system.descricao ?? "",
    };
  });

  const categorias = [...new Set(entries.map((e) => e.tipo).filter(Boolean))].sort();

  return {
    stepTitle: "Poderes",
    poderes: entries,
    categorias,
    selectedCount: state.poderes.length,
    errors,
  };
}
