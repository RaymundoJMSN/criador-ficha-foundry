import { filterMagias, isConjurador } from "../../rules/magias.js";
import { toNomeSlug } from "../../compendium/slug.js";
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
  classeNome: string;
  isConjurador: boolean;
  /** Soft guide: how many magias to know at this level (not strictly enforced in UI yet) */
  magiaLimit: number;
  magias: MagiaEntry[];
  selectedCount: number;
  errors: string[];
}

export function prepareMagiasContext(
  state: WizardState,
  allMagias: IndexedMagia[],
  errors: string[] = []
): MagiasContext {
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const conjurador = isConjurador(classeSlug);
  const filtered = conjurador ? filterMagias(allMagias, classeSlug, state.nivel) : [];

  // Soft guide: Int modifier + 3 (T20 arcanista rule; used for display only)
  const intBase = state.atributosBase?.int ?? 10;
  const intMod = Math.floor((intBase - 10) / 2);
  const magiaLimit = Math.max(1, intMod + 3);

  return {
    stepTitle: "Magias",
    classeNome: state.classeNome ?? "",
    isConjurador: conjurador,
    magiaLimit,
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
