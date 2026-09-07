import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";
import { getClasse } from "../../rules/classe.js";
import { toNomeSlug } from "../../compendium/slug.js";
import { classesDoPersonagem, caminhoDe, errosMulticlasse } from "../../rules/multiclasse.js";
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
  /** Caminho e sub-escolhas de cada classe (principal e multiclasse). */
  caminhosPorClasse: CaminhosDeClasse[];
  multiclasse: MulticlasseView;
}

export interface CaminhosDeClasse {
  classeNome: string;
  /** Nome do radio: `classe_caminho` (principal) ou `classe_caminho_<slug>`. */
  chave: string;
  principal: boolean;
  caminhos: Array<{ slug: string; nome: string; selected: boolean }>;
  subEscolhas: SubEscolhaView[];
}

export interface MulticlasseView {
  linhas: Array<{ idx: number; classeId: string; niveis: number; opcoes: Array<{ id: string; name: string; selected: boolean }> }>;
  principalNiveis: number;
  podeAdicionar: boolean;
  erros: string[];
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

  const classeSlug = toNomeSlug(state.classeNome ?? selectedClasse?.name ?? "");

  // Caminho de CADA classe (principal + multiclasse), no nível que ela tem:
  // um cavaleiro nv1 não escolhe nada, o caminho dele chega no 5º.
  const caminhosPorClasse: CaminhosDeClasse[] = [];
  for (const c of classesDoPersonagem(state)) {
    const dados = getClasse(c.classeNome || c.classeId);
    const defs = c.niveis >= (dados?.caminho_nivel ?? 1) ? (dados?.caminhos ?? []) : [];
    if (defs.length === 0) continue;
    const escolhido = caminhoDe(state, c) || null;
    const caminhos = defs.map((d) => ({
      slug: d.slug,
      nome: resolvePoderNome(d.slug) ?? d.nome,
      selected: d.slug === escolhido,
    }));
    // Caminho escolhido pode abrir uma escolha, que pode abrir outra
    // (Feiticeiro -> linhagem -> Draconica -> tipo de dano). Só mostra o próximo
    // nível depois que o anterior foi respondido.
    const subEscolhas: SubEscolhaView[] = [];
    let sub = defs.find((d) => d.slug === escolhido)?.sub ?? null;
    while (sub) {
      const resp = (state.escolhasPorItem[sub.chave] as string | undefined) ?? null;
      subEscolhas.push({
        chave: sub.chave,
        label: sub.label,
        escolhido: resp,
        opcoes: sub.opcoes.map((o) => ({ id: o.id, nome: o.nome, selected: o.id === resp })),
      });
      sub = sub.opcoes.find((o) => o.id === resp)?.sub ?? null;
    }
    caminhosPorClasse.push({ classeNome: c.classeNome, chave: c.caminhoChave, principal: c.principal, caminhos, subEscolhas });
  }
  const principal = caminhosPorClasse.find((c) => c.principal);
  const caminhos = principal?.caminhos ?? [];
  const subEscolhas = principal?.subEscolhas ?? [];
  const classeCaminho = (state.escolhasPorItem["classe_caminho"] as string | undefined) ?? null;

  // Multiclasse (LB p.35): linhas [classe, níveis]; a principal fica com o resto.
  const permitidas = classes.filter(
    (c) => state.config.classesPermitidas.length === 0 || state.config.classesPermitidas.includes(c.name)
  );
  const extras = (state.escolhasPorItem["multiclasse"] as Array<{ classeId: string; classeNome: string; niveis: number }> | undefined) ?? [];
  const multiclasse: MulticlasseView = {
    linhas: extras.map((e, idx) => ({
      idx,
      classeId: e.classeId,
      niveis: Math.max(1, Number(e.niveis) || 1),
      opcoes: permitidas
        .filter((c) => c.id !== state.classeId)
        .map((c) => ({ id: c.id, name: c.name, selected: c.id === e.classeId })),
    })),
    principalNiveis: classesDoPersonagem(state)[0]?.niveis ?? state.nivel,
    podeAdicionar: Boolean(state.classeId) && state.nivel >= 2 && extras.length < 3,
    erros: errosMulticlasse(state),
  };

  return {
    stepTitle: "Classe",
    classes: classes
      .filter((c) => state.config.classesPermitidas.length === 0 || state.config.classesPermitidas.includes(c.name))
      .map((c) => ({
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
    requiresCaminho: caminhos.length > 0,
    subEscolhas,
    caminhosPorClasse,
    multiclasse,
  };
}
