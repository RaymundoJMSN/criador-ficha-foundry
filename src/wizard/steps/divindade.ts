import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  poderesConcedidosParaEscolher,
  PANTEAO,
  type Divindade,
} from "../../rules/divindade.js";
import { toNomeSlug } from "../../compendium/slug.js";
import type { WizardState } from "../state.js";
import { classesDoPersonagem } from "../../rules/multiclasse.js";

function prettifySlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface DivindadeContext {
  maiores: Array<{ id: string; nome: string; selected: boolean }>;
  menores: Array<{ id: string; nome: string; selected: boolean }>;
  stepTitle: string;
  obrigatoria: boolean;
  divindades: Array<{ id: string; nome: string; selected: boolean }>;
  selectedDivindade: {
    id: string;
    nome: string;
    /** Panteão: o que a escolha implica (sem concedido, sem arma cortante/perfurante). */
    nota: string;
    /** Lista do deus, para o jogador escolher entre eles. */
    poderes: Array<{ slug: string; nome: string; descricao: string; selected: boolean }>;
  } | null;
  /** Quantos escolher: 1 para devoto comum, 2 para clérigo/druida/paladino. */
  quantosPoderes: number;
  poderesEscolhidos: string[];
  errors: string[];
}

export function prepareDivindadeContext(
  state: WizardState,
  errors: string[] = [],
  /** slug → nome e texto do item no compêndio (sem ele, o nome sai do slug). */
  resolvePoder: (slug: string) => { nome: string; descricao: string } | null = () => null
): DivindadeContext {
  const slugsClasses = classesDoPersonagem(state).map((c) => c.classeSlug);
  const racaSlug = toNomeSlug(state.racaNome ?? "");

  // Multiclasse: qualquer das classes abre a lista do deus.
  const vistos = new Set<string>();
  const divindades = slugsClasses
    .flatMap((c) => listDivindadesParaPersonagem(racaSlug, c, state.config.devocoesAbertas))
    .filter((d) => !vistos.has(d.id) && vistos.add(d.id));
  const mappedDivindades = divindades.map((d: Divindade) => ({
    id: d.id,
    nome: d.nome,
    selected: d.id === state.divindadeId,
    menor: Boolean(d.menor),
  }));
  const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");
  const maiores = mappedDivindades.filter((d) => !d.menor).sort(porNome);
  const menores = mappedDivindades.filter((d) => d.menor).sort(porNome);

  const selected = divindades.find((d: Divindade) => d.id === state.divindadeId) ?? null;
  // Deus menor costuma ter um poder só: a cota não passa do que existe.
  const cotaClasse = Math.max(...slugsClasses.map((c) => poderesConcedidosParaEscolher(c, Boolean(selected))));
  const quantosPoderes = selected ? Math.min(cotaClasse, selected.poderes_concedidos.length) : cotaClasse;
  const escolhidos = (state.escolhasPorItem["divindade_poderes"] as string[] | undefined) ?? [];

  const selectedDivindade = selected
    ? {
        id: selected.id,
        nome: selected.nome,
        nota:
          selected.id === PANTEAO.id
            ? "Cultua o Panteão como um todo: não recebe poder concedido e não pode usar armas cortantes ou perfurantes (LB p.103)."
            : "",
        poderes: selected.poderes_concedidos
          .map((slug) => {
            const p = resolvePoder(slug);
            return {
              slug,
              nome: p?.nome ?? prettifySlug(slug),
              descricao: p?.descricao ?? "",
              selected: escolhidos.includes(slug),
            };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      }
    : null;

  if (selected && escolhidos.length !== quantosPoderes) {
    errors = [
      ...errors,
      `Escolha ${quantosPoderes} poder(es) concedido(s) de ${selected.nome} — ${escolhidos.length} marcado(s).`,
    ];
  }

  return {
    stepTitle: "Divindade",
    obrigatoria: slugsClasses.some(isDivindadeObrigatoria),
    divindades: mappedDivindades,
    maiores,
    menores,
    selectedDivindade,
    quantosPoderes,
    poderesEscolhidos: escolhidos,
    errors,
  };
}
