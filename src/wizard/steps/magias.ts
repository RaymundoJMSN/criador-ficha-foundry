import { filterMagias, isConjurador } from "../../rules/magias.js";
import type { WizardState } from "../state.js";
import type { IndexedMagia } from "../../compendium/types.js";

export interface MagiaEntry {
  id: string;
  name: string;
  img: string;
  circulo: number;
  escola: string;
  tipo: string;
  selected: boolean;
}

export interface MagiasContext {
  stepTitle: string;
  isConjurador: boolean;
  magias: MagiaEntry[];
  selectedCount: number;
  errors: string[];
}

export function prepareMagiasContext(
  state: WizardState,
  allMagias: IndexedMagia[],
  errors: string[] = []
): MagiasContext {
  const conjurador = isConjurador(state.classeId);
  const filtered = conjurador ? filterMagias(allMagias, state.classeId, state.nivel) : [];

  return {
    stepTitle: "Magias",
    isConjurador: conjurador,
    magias: filtered.map((m) => ({
      id: m.id,
      name: m.name,
      img: m.img,
      circulo: m.system.circulo ?? 0,
      escola: m.system.escola ?? "",
      tipo: m.system.tipo ?? "",
      selected: state.magias.includes(m.id),
    })),
    selectedCount: state.magias.length,
    errors,
  };
}
