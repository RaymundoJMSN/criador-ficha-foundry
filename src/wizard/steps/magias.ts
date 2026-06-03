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

export interface MagiasByCirculo {
  circulo: number;
  label: string;
  magias: MagiaEntry[];
}

export interface MagiasContext {
  stepTitle: string;
  classeNome: string;
  isConjurador: boolean;
  /** How many magias this character may know (enforced as warning) */
  magiaLimit: number;
  /** Whether the character is at or over the magia limit */
  atMaxLimit: boolean;
  magiaSearch: string;
  magiasByCirculo: MagiasByCirculo[];
  selectedCount: number;
  errors: string[];
}

function circuloLabel(n: number): string {
  const ordinals = ["1º", "2º", "3º", "4º", "5º"];
  return `${ordinals[n - 1] ?? n + "º"} Círculo`;
}

export function prepareMagiasContext(
  state: WizardState,
  allMagias: IndexedMagia[],
  errors: string[] = []
): MagiasContext {
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const conjurador = isConjurador(classeSlug);

  // Magia limit: arcanista gets 3 base, +1 for Mago path; other casters use soft Int-based guide
  const classeCaminho = (state.escolhasPorItem["classe_caminho"] as string | undefined) ?? "";
  let magiaLimit: number;
  if (classeSlug === "arcanista") {
    magiaLimit = classeCaminho === "caminho_do_arcanista_mago" ? 4 : 3;
  } else {
    // Non-arcanista casters: Int modifier + 3 as soft guide
    const intBase = state.atributosBase?.int ?? 10;
    const intMod = Math.floor((intBase - 10) / 2);
    magiaLimit = Math.max(1, intMod + 3);
  }

  const magiaSearch = (state.escolhasPorItem["magia_search"] as string) ?? "";

  let filtered = conjurador ? filterMagias(allMagias, classeSlug, state.nivel) : [];

  // Apply name search filter
  if (magiaSearch) {
    const q = magiaSearch.toLowerCase();
    filtered = filtered.filter((m) => m.name.toLowerCase().includes(q));
  }

  // Group by círculo
  const byCirculo = new Map<number, MagiaEntry[]>();
  for (const m of filtered) {
    const circulo = Number(m.system.circulo) || 0;
    if (!byCirculo.has(circulo)) byCirculo.set(circulo, []);
    byCirculo.get(circulo)!.push({
      id: m.id,
      name: m.name,
      img: m.img,
      circulo,
      escola: m.system.escola ?? "",
      tipo: m.system.tipo ?? "",
      selected: state.magias.includes(m.id),
    });
  }

  // Sort by círculo number
  const magiasByCirculo: MagiasByCirculo[] = Array.from(byCirculo.entries())
    .sort(([a], [b]) => a - b)
    .map(([circulo, magias]) => ({
      circulo,
      label: circuloLabel(circulo),
      magias,
    }));

  return {
    stepTitle: "Magias",
    classeNome: state.classeNome ?? "",
    isConjurador: conjurador,
    magiaLimit,
    atMaxLimit: state.magias.length >= magiaLimit,
    magiaSearch,
    magiasByCirculo,
    selectedCount: state.magias.length,
    errors,
  };
}
