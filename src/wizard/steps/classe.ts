import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";
import { getClasse } from "../../rules/classe.js";
import { toNomeSlug } from "../../compendium/slug.js";
import textosRaw from "../../data/textos.json";

const textos = textosRaw as { classes?: Record<string, string> };

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
  /** Descrição do livro; vazia quando textos.json não foi gerado. */
  descricao: string;
  errors: string[];
  // Caminho sub-choice
  caminhos: Array<{ slug: string; nome: string; selected: boolean }>;
  classeCaminho: string | null;
  requiresCaminho: boolean;
  /** Escolhas dependentes do caminho, na ordem em que devem ser respondidas. */
  subEscolhas: SubEscolhaView[];
}

export interface SubEscolhaView {
  chave: string;
  label: string;
  escolhido: string | null;
  opcoes: Array<{ id: string; nome: string; selected: boolean }>;
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
  const caminhoDefs = classeData?.caminhos ?? [];
  const classeCaminho = (state.escolhasPorItem["classe_caminho"] as string | undefined) ?? null;

  const caminhos = caminhoDefs.map((c) => ({
    slug: c.slug,
    nome: resolvePoderNome(c.slug) ?? c.nome,
    selected: c.slug === classeCaminho,
  }));

  // Caminho escolhido pode abrir uma escolha, que pode abrir outra
  // (Feiticeiro -> linhagem -> Draconica -> tipo de dano). So mostra o proximo
  // nivel depois que o anterior foi respondido.
  const subEscolhas: SubEscolhaView[] = [];
  let sub = caminhoDefs.find((c) => c.slug === classeCaminho)?.sub ?? null;
  while (sub) {
    const escolhido = (state.escolhasPorItem[sub.chave] as string | undefined) ?? null;
    subEscolhas.push({
      chave: sub.chave,
      label: sub.label,
      escolhido,
      opcoes: sub.opcoes.map((o) => ({ id: o.id, nome: o.nome, selected: o.id === escolhido })),
    });
    sub = sub.opcoes.find((o) => o.id === escolhido)?.sub ?? null;
  }

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
    descricao:
      (selectedClasse?.system.descricao ?? "") || (classeSlug ? (textos.classes?.[classeSlug] ?? "") : ""),
    errors,
    caminhos,
    classeCaminho,
    requiresCaminho: caminhoDefs.length > 0,
    subEscolhas,
  };
}
