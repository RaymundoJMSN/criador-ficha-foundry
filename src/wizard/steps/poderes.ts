import { toNomeSlug } from "../../compendium/slug.js";
import { getClasse } from "../../rules/classe.js";
import { describeUnmet } from "../../rules/poderes.js";
import poderesporNivelRaw from "../../data/poderes-por-nivel.json";
import type { IndexedPoder } from "../../compendium/types.js";
import type { WizardState } from "../state.js";

const poderesporNivel = poderesporNivelRaw as Record<string, Record<string, number>>;

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
  /** Auto-granted class ability slugs with display names */
  habilidades: Array<{ slug: string; nome: string }>;
  /** How many free picks allowed at this level (0 = none) */
  poderesParaPick: number;
  /** Filtered power list for picking (empty when poderesParaPick === 0) */
  poderes: PoderEntry[];
  categorias: string[];
  selectedCount: number;
  errors: string[];
}

function prettifySlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function preparePoderesContext(
  state: WizardState,
  allPoderes: IndexedPoder[],
  errors: string[] = [],
  resolvePoderNome: (slug: string) => string | null = () => null
): PoderesContext {
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const classeData = getClasse(classeSlug);

  // Auto-granted class abilities (always shown) — resolve slugs to display names
  const habilidadeSlugs = classeData?.habilidades_classe_ids ?? [];
  const habilidades = habilidadeSlugs.map((slug) => ({
    slug,
    nome: resolvePoderNome(slug) ?? prettifySlug(slug),
  }));

  // How many free picks at this level (0 for level 1)
  const nivelStr = String(state.nivel);
  const poderesParaPick = poderesporNivel[classeSlug]?.[nivelStr] ?? 0;

  if (!classeData || poderesParaPick === 0) {
    return {
      stepTitle: "Poderes",
      habilidades,
      poderesParaPick: 0,
      poderes: [],
      categorias: [],
      selectedCount: state.poderes.length,
      errors,
    };
  }

  // Build pick list from poderes_classe_ids — match compendium items by slug
  const classePoderSlugs = new Set(classeData.poderes_classe_ids ?? []);

  const stateForEligibility = {
    nivel: state.nivel,
    atributosBase: state.atributosBase,
    classeId: state.classeId,
    racaId: state.racaId,
    periciasTreinadas: state.periciasTreinadas,
    poderes: state.poderes,
  };

  const entries: PoderEntry[] = allPoderes
    .filter((p) => classePoderSlugs.has(toNomeSlug(p.name)))
    .map((p) => {
      const slug = toNomeSlug(p.name);
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
    habilidades,
    poderesParaPick,
    poderes: entries,
    categorias,
    selectedCount: state.poderes.length,
    errors,
  };
}
