import { toNomeSlug } from "../../compendium/slug.js";
import { getClasse } from "../../rules/classe.js";
import { describeUnmet } from "../../rules/poderes.js";
import { habilidadesAte, slotsDePoder } from "../../rules/progressao.js";
import { resolverPoder } from "../../compendium/resolver.js";
import type { IndexedPoder } from "../../compendium/types.js";
import type { WizardState } from "../state.js";

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
  /** Whether this entry is a class power or a general power taken in its place. */
  origem: "classe" | "geral";
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

  // Auto-granted class abilities up to this level (same source the writer uses)
  const habilidadeSlugs = habilidadesAte(state.classeNome || state.classeId, state.nivel);
  const habilidades = habilidadeSlugs.map((slug) => ({
    slug,
    nome:
      resolverPoder(slug, classeSlug, allPoderes)?.item.name ??
      resolvePoderNome(slug) ??
      prettifySlug(slug),
  }));

  // Free picks a character of this level has ACCUMULATED (levels 1..N), not the
  // single pick this level grants — a nv5 guerreiro picks 4 powers, not 1.
  const poderesParaPick = slotsDePoder(state.classeNome || state.classeId, state.nivel);

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

  // Build pick list from poderes_classe_ids. O nome no compêndio raramente é o slug
  // ("Ambidestria (Guerreiro)"), então resolve slug → item e guarda o id resolvido.
  // Slug sem item = conteúdo não instalado (Heróis de Arton) — some da lista, sem erro.
  const idsDaClasse = new Set<string>();
  for (const slug of classeData.poderes_classe_ids ?? []) {
    const achado = resolverPoder(slug, classeSlug, allPoderes);
    if (achado) idsDaClasse.add(achado.item.id);
  }

  const stateForEligibility = {
    nivel: state.nivel,
    atributosBase: state.atributosBase,
    classeId: state.classeId,
    racaId: state.racaId,
    periciasTreinadas: state.periciasTreinadas,
    poderes: state.poderes,
  };

  // "Sempre que você recebe um poder de classe, pode trocá-lo por um poder geral"
  // (LB cap. 5) — so every class-power slot may also be spent on a general power.
  const entries: PoderEntry[] = allPoderes
    .filter((p) => idsDaClasse.has(p.id) || p.system.tipo === "geral")
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
        origem: p.system.tipo === "geral" ? ("geral" as const) : ("classe" as const),
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
