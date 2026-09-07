import { toNomeSlug } from "../../compendium/slug.js";
import { getClasse, respostaSubEscolha } from "../../rules/classe.js";
import { describeUnmet, type PartialWizardState } from "../../rules/poderes.js";
import { totaisRaciaisDoEstado } from "../../rules/subescolhas.js";
import { poderesGeraisExtras, faixaDoPersonagem } from "../../rules/idade.js";
import { habilidadesAte, getClasseProgressao } from "../../rules/progressao.js";
import { classesDoPersonagem, habilidadesDeTodas, slotsDePoderTotal, niveisPorClasse } from "../../rules/multiclasse.js";
import { resolverPoder, opcoesDaHabilidade, chaveHabilidade } from "../../compendium/resolver.js";
import type { IndexedMagia, IndexedPoder } from "../../compendium/types.js";
import type { WizardState } from "../state.js";
import { ESCOLAS } from "../../rules/magias.js";
import repetiveisRaw from "../../data/poderes_repetiveis.json";

/** "Você pode escolher este poder quantas vezes quiser" (T20-DB). */
const REPETIVEIS = new Set(repetiveisRaw as string[]);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

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
  /** Pode ser escolhido mais de uma vez (Orar, Foco em Arma…). */
  repetivel: boolean;
  /** Quantas vezes foi escolhido. */
  vezes: number;
  /** Ainda cabe mais uma cópia (repetível, selecionado, cota não cheia). */
  podeMais: boolean;
}

export interface PoderesContext {
  stepTitle: string;
  /** Auto-granted class ability slugs with display names; `opcoes` quando é "Nome: X". */
  habilidades: Array<{
    slug: string;
    nome: string;
    opcoes: Array<{ id: string; nome: string; selected: boolean }>;
    pendente: boolean;
  }>;
  /** How many free picks allowed at this level (0 = none) */
  poderesParaPick: number;
  /** Dos quais, quantos vêm de complicação/Já Vi Coisas e têm de ser gerais. */
  extrasGerais: number;
  /** Filtered power list for picking (empty when poderesParaPick === 0) */
  poderes: PoderEntry[];
  /** Classe sem tabela de progressão em nenhuma fonte disponível. */
  semTabela: boolean;
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
  // Multiclasse: habilidades de cada classe no nível dela (LB p.35).
  const todasClasses = classesDoPersonagem(state);
  const habilidadeSlugs = habilidadesDeTodas(state).map((h) => h.slug);
  const habilidades = habilidadesDeTodas(state)
    .map(({ classe, slug }) => {
      const opcoes = opcoesDaHabilidade(slug, allPoderes);
      if (opcoes.length > 0) {
        const escolhido = state.escolhasPorItem[chaveHabilidade(slug)] as string | undefined;
        return {
          slug,
          nome: opcoes[0]!.name.split(":")[0]!.trim(),
          opcoes: opcoes.map((o) => ({ id: o.id, nome: o.name.split(":").slice(1).join(":").trim(), selected: o.id === escolhido })),
          pendente: !opcoes.some((o) => o.id === escolhido),
        };
      }
      return {
        slug,
        nome:
          resolverPoder(slug, classe.classeSlug, allPoderes, "ability")?.item.name ??
          resolvePoderNome(slug) ??
          prettifySlug(slug),
        opcoes: [] as Array<{ id: string; nome: string; selected: boolean }>,
        pendente: false,
      };
    })
    .filter((h, i, arr) => arr.findIndex((o) => o.nome === h.nome) === i);
  // Samurai, Místico, Miragem: existem no compêndio mas nenhum livro dos PDFs
  // traz a tabela de progressão — sem ela não há como saber habilidades e cota.
  const semTabela = Boolean(state.classeNome) && getClasseProgressao(state.classeNome) === null;

  // Free picks a character of this level has ACCUMULATED (levels 1..N), not the
  // single pick this level grants — a nv5 guerreiro picks 4 powers, not 1.
  // Vagas de classe (podem virar geral) + poderes gerais extras de complicação /
  // Já Vi Coisas (HA p.282/289), que só podem ser gerais.
  const slotsClasse = slotsDePoderTotal(state);
  const extrasGerais = poderesGeraisExtras(state);
  const poderesParaPick = slotsClasse + extrasGerais;
  const faixa = faixaDoPersonagem(state);

  if (poderesParaPick === 0) {
    return {
      stepTitle: "Poderes",
      habilidades,
      poderesParaPick: 0,
      extrasGerais: 0,
      poderes: [],
      semTabela,
      categorias: [],
      selectedCount: state.poderes.length,
      errors,
    };
  }

  // Build pick list from poderes_classe_ids. O nome no compêndio raramente é o slug
  // ("Ambidestria (Guerreiro)"), então resolve slug → item e guarda o id resolvido.
  // Slug sem item = conteúdo não instalado (Heróis de Arton) — some da lista, sem erro.
  // Poder de classe no compêndio é `tipo:"classe"` + `subtipo:"<Classe>"` — vale
  // para Samurai e as outras classes que só existem no compêndio (o T20-DB só
  // cobre o Livro Básico). Os slugs do T20-DB entram por cima só para casar o
  // pré-requisito {tipo:"poder"} pelo slug certo.
  const idsDaClasse = new Set<string>();
  const idParaSlug = new Map<string, string>();
  const nomesClasses = todasClasses.map((c) => norm(c.classeNome)).filter(Boolean);
  for (const p of allPoderes) {
    // subtipo "Geral" = poder de classe de toda classe (Aumento de Atributo).
    const sub = norm(p.system.subtipo ?? "");
    if (p.system.tipo === "classe" && nomesClasses.length && (nomesClasses.includes(sub) || sub === "geral")) {
      idsDaClasse.add(p.id);
    }
  }
  for (const c of todasClasses) {
    for (const slug of getClasse(c.classeNome || c.classeId)?.poderes_classe_ids ?? []) {
      const achado = resolverPoder(slug, c.classeSlug, allPoderes, "classe");
      if (!achado) continue;
      idsDaClasse.add(achado.item.id);
      idParaSlug.set(achado.item.id, slug);
    }
  }

  // Pré-requisito compara slug do T20-DB, não id de compêndio nem nome de item:
  // "Ambidestria (Guerreiro)" precisa virar `ambidestria` para casar com {tipo:"poder"}.
  const slugDoItem = (p: IndexedPoder) => idParaSlug.get(p.id) ?? toNomeSlug(p.name);
  const poderesEscolhidos = state.poderes
    .map((id) => allPoderes.find((p) => p.id === id))
    .filter((p): p is IndexedPoder => Boolean(p))
    .map(slugDoItem);

  const totaisRaca = totaisRaciaisDoEstado(state);
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
    niveisPorClasse: niveisPorClasse(state),
    divindadeSlug: state.divindadeId,
    proficiencias: classeData?.proficiencias ?? [],
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
  const classeEscolhidos = state.poderes.filter((id) => idsDaClasse.has(id)).length;
  const classeNoLimite = classeEscolhidos >= slotsClasse;
  // Velho/ancião: "não pode escolher o poder Aumento de Atributo para atributos físicos" (HA p.289).
  const aumentoFisico = /^aumento de atributo \((força|destreza|constituição)\)/i;

  // "Sempre que você recebe um poder de classe, pode trocá-lo por um poder geral"
  // (LB cap. 5) — so every class-power slot may also be spent on a general power.
  // O mesmo poder geral em dois módulos aparecia duas vezes; fica o primeiro.
  const nomesVistos = new Set<string>();
  const entries: PoderEntry[] = allPoderes
    .filter((p) => idsDaClasse.has(p.id) || p.system.tipo === "geral")
    .filter((p) => !nomesVistos.has(p.name) && nomesVistos.add(p.name))
    .map((p) => {
      const unmet = describeUnmet(slugDoItem(p), stateForEligibility);
      const vezes = state.poderes.filter((id) => id === p.id).length;
      const repetivel = REPETIVEIS.has(slugDoItem(p));
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
        bloqueado:
          !state.poderes.includes(p.id) &&
          (unmet.length > 0 ||
            noLimite ||
            (p.system.tipo !== "geral" && classeNoLimite) ||
            (faixa.bloqueiaAumentoFisico && aumentoFisico.test(p.name))),
        repetivel,
        vezes,
        podeMais: repetivel && vezes > 0 && !noLimite,
      };
    });

  const categorias = [...new Set(entries.map((e) => e.tipo).filter(Boolean))].sort();

  return {
    stepTitle: "Poderes",
    habilidades,
    poderesParaPick,
    extrasGerais,
    poderes: entries,
    semTabela,
    categorias,
    selectedCount: state.poderes.length,
    errors,
  };
}

/** Habilidades "Nome: X" ainda sem opção escolhida — vai para as pendências da Revisão. */
export function pendenciasDeHabilidades(state: WizardState, allPoderes: IndexedPoder[]): string[] {
  const out: string[] = [];
  for (const slug of habilidadesDeTodas(state).map((h) => h.slug)) {
    const opcoes = opcoesDaHabilidade(slug, allPoderes);
    if (opcoes.length === 0) continue;
    const escolhido = state.escolhasPorItem[chaveHabilidade(slug)] as string | undefined;
    if (!opcoes.some((o) => o.id === escolhido)) out.push(`Escolha a opção de ${opcoes[0]!.name.split(":")[0]!.trim()}.`);
  }
  return out;
}
