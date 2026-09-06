import { toNomeSlug } from "../../compendium/slug.js";
import { getClasse, respostaSubEscolha } from "../../rules/classe.js";
import { describeUnmet, type PartialWizardState } from "../../rules/poderes.js";
import { getRaceAttributeTotals } from "../../rules/subescolhas.js";
import { habilidadesAte, slotsDePoder } from "../../rules/progressao.js";
import { resolverPoder } from "../../compendium/resolver.js";
import type { IndexedMagia, IndexedPoder } from "../../compendium/types.js";
import type { WizardState } from "../state.js";
import { ESCOLAS } from "../../rules/magias.js";

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
  /** Não pode ser marcado agora: pré-requisito não cumprido ou cota cheia. */
  bloqueado: boolean;
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
  resolvePoderNome: (slug: string) => string | null = () => null,
  allMagias: IndexedMagia[] = []
): PoderesContext {
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const classeData = getClasse(classeSlug);

  // Auto-granted class abilities up to this level (same source the writer uses)
  const habilidadeSlugs = habilidadesAte(state.classeNome || state.classeId, state.nivel);
  const habilidades = habilidadeSlugs.map((slug) => ({
    slug,
    nome:
      resolverPoder(slug, classeSlug, allPoderes, "ability")?.item.name ??
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
  const idParaSlug = new Map<string, string>();
  for (const slug of classeData.poderes_classe_ids ?? []) {
    const achado = resolverPoder(slug, classeSlug, allPoderes, "classe");
    if (!achado) continue;
    idsDaClasse.add(achado.item.id);
    idParaSlug.set(achado.item.id, slug);
  }

  // Pré-requisito compara slug do T20-DB, não id de compêndio nem nome de item:
  // "Ambidestria (Guerreiro)" precisa virar `ambidestria` para casar com {tipo:"poder"}.
  const slugDoItem = (p: IndexedPoder) => idParaSlug.get(p.id) ?? toNomeSlug(p.name);
  const poderesEscolhidos = state.poderes
    .map((id) => allPoderes.find((p) => p.id === id))
    .filter((p): p is IndexedPoder => Boolean(p))
    .map(slugDoItem);

  const racaRef = state.racaNome || state.racaId;
  const escolhasRaca = (state.escolhasPorItem["raca_modificadores"] as string[][]) ?? [];
  const totaisRaca = getRaceAttributeTotals(racaRef, escolhasRaca);
  const atributos = Object.fromEntries(
    (["for", "des", "con", "int", "sab", "car"] as const).map((a) => [
      a,
      (state.atributosBase[a] ?? 0) + (totaisRaca[a] ?? 0),
    ])
  );

  const stateForEligibility: PartialWizardState = {
    nivel: state.nivel,
    atributos,
    classeSlug,
    racaSlug: toNomeSlug(state.racaNome || ""),
    periciasTreinadas: state.periciasTreinadas,
    poderes: poderesEscolhidos,
    habilidadesClasse: habilidadeSlugs,
    divindadeSlug: state.divindadeId,
    proficiencias: classeData.proficiencias ?? [],
    // state.magias guarda id de compêndio; o pré-req {tipo:"magia"} compara slug.
    magias: state.magias
      .map((id) => allMagias.find((m) => m.id === id)?.name)
      .filter((n): n is string => Boolean(n))
      .map(toNomeSlug),
    linhagem: respostaSubEscolha(
      classeSlug,
      (state.escolhasPorItem["classe_caminho"] as string) ?? "",
      state.escolhasPorItem,
      "linhagem"
    ),
    escolasMagia: ((state.escolhasPorItem["classe_escolas"] as string[] | undefined) ?? []).map(
      (abrev) => ESCOLAS[abrev]?.slug ?? abrev
    ),
    caminho: (state.escolhasPorItem["classe_caminho"] as string) ?? "",
  };

  const noLimite = state.poderes.length >= poderesParaPick;

  // "Sempre que você recebe um poder de classe, pode trocá-lo por um poder geral"
  // (LB cap. 5) — so every class-power slot may also be spent on a general power.
  const entries: PoderEntry[] = allPoderes
    .filter((p) => idsDaClasse.has(p.id) || p.system.tipo === "geral")
    .map((p) => {
      const unmet = describeUnmet(slugDoItem(p), stateForEligibility);
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
        // Elegibilidade é recalculada a cada render: escolher o Poder A libera
        // na hora o Poder B que exigia A.
        bloqueado: !state.poderes.includes(p.id) && (unmet.length > 0 || noLimite),
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
