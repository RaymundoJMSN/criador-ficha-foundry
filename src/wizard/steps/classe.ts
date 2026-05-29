import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";

export interface ClasseContext {
  stepTitle: string;
  classes: Array<{
    id: string;
    name: string;
    img: string;
    pvPorNivel: number;
    pmPorNivel: number;
    selected: boolean;
  }>;
  selectedClasse: IndexedClasse | null;
  errors: string[];
}

export function prepareClasseContext(
  state: WizardState,
  classes: IndexedClasse[],
  errors: string[] = []
): ClasseContext {
  return {
    stepTitle: "Classe",
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      img: c.img,
      pvPorNivel: c.system.pvPorNivel ?? 0,
      pmPorNivel: c.system.pmPorNivel ?? 0,
      selected: c.id === state.classeId,
    })),
    selectedClasse: classes.find((c) => c.id === state.classeId) ?? null,
    errors,
  };
}
