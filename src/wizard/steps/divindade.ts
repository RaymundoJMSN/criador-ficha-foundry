import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  poderesConcedidosParaEscolher,
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
  stepTitle: string;
  obrigatoria: boolean;
  divindades: Array<{ id: string; nome: string; selected: boolean }>;
  selectedDivindade: {
    id: string;
    nome: string;
    /** Lista do deus, para o jogador escolher entre eles. */
    poderes: Array<{ slug: string; nome: string; selected: boolean }>;
  } | null;
  /** Quantos escolher: 1 para devoto comum, 2 para clérigo/druida/paladino. */
  quantosPoderes: number;
  poderesEscolhidos: string[];
  errors: string[];
}

export function prepareDivindadeContext(
  state: WizardState,
  errors: string[] = [],
  resolvePoderNome: (slug: string) => string | null = () => null
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
  }));

  const selected = divindades.find((d: Divindade) => d.id === state.divindadeId) ?? null;
  const quantosPoderes = Math.max(...slugsClasses.map((c) => poderesConcedidosParaEscolher(c, Boolean(selected))));
  const escolhidos = (state.escolhasPorItem["divindade_poderes"] as string[] | undefined) ?? [];

  const selectedDivindade = selected
    ? {
        id: selected.id,
        nome: selected.nome,
        poderes: selected.poderes_concedidos.map((slug) => ({
          slug,
          nome: resolvePoderNome(slug) ?? prettifySlug(slug),
          selected: escolhidos.includes(slug),
        })),
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
    selectedDivindade,
    quantosPoderes,
    poderesEscolhidos: escolhidos,
    errors,
  };
}
