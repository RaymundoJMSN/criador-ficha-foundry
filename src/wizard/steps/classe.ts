import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";
import { getClasse } from "../../rules/classe.js";
import { toNomeSlug } from "../../compendium/slug.js";

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
  // Caminho sub-choice
  caminhos: Array<{ slug: string; nome: string; selected: boolean }>;
  classeCaminho: string | null;
  requiresCaminho: boolean;
}

export function prepareClasseContext(
  state: WizardState,
  classes: IndexedClasse[],
  errors: string[] = [],
  resolvePoderNome: (slug: string) => string | null = () => null
): ClasseContext {
  const selectedClasse = classes.find((c) => c.id === state.classeId) ?? null;

  // Resolve T20-DB data for caminho sub-choice
  const classeSlug = toNomeSlug(state.classeNome ?? selectedClasse?.name ?? "");
  const classeData = classeSlug ? getClasse(classeSlug) : null;
  const caminhoSlugs = classeData?.caminhos ?? [];
  const classeCaminho = (state.escolhasPorItem["classe_caminho"] as string | undefined) ?? null;

  function prettifySlug(slug: string): string {
    return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const caminhos = caminhoSlugs.map((slug) => ({
    slug,
    nome: resolvePoderNome(slug) ?? prettifySlug(slug),
    selected: slug === classeCaminho,
  }));

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
    selectedClasse,
    errors,
    caminhos,
    classeCaminho,
    requiresCaminho: caminhoSlugs.length > 0,
  };
}
