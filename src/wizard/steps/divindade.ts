import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  poderesConcedidosParaEscolher,
  PANTEAO,
  type Divindade,
} from "../../rules/divindade.js";
import { toNomeSlug } from "../../compendium/slug.js";
import textosRaw from "../../data/textos.json";
import type { WizardState } from "../state.js";
import { classesDoPersonagem } from "../../rules/multiclasse.js";

const textos = textosRaw as { divindades?: Record<string, Record<string, string>> };
const CAMPOS_DEUS: Array<[string, string]> = [
  ["descricao", "Descrição"],
  ["crencas", "Crenças e Objetivos"],
  ["simbolo", "Símbolo Sagrado"],
  ["canalizar", "Canalizar Energia"],
  ["arma", "Arma Preferida"],
  ["obrigacoes", "Obrigações & Restrições"],
  ["devotos", "Devotos"],
];
/** Concedidos que vêm sozinhos (lista ≤ cota): o app grava em `divindade_poderes`. */
export function concedidosAutomaticos(state: WizardState): string[] {
  const ctx = prepareDivindadeContext(state);
  const sel = ctx.selectedDivindade as { auto?: boolean; poderes?: Array<{ slug: string }> } | null;
  return sel?.auto ? (sel.poderes ?? []).map((p) => p.slug) : [];
}

function fichaDoDeus(id: string): Array<{ rotulo: string; texto: string }> | null {
  const f = textos.divindades?.[id];
  if (!f) return null;
  return CAMPOS_DEUS.filter(([k]) => f[k]).map(([k, rotulo]) => ({ rotulo, texto: f[k]! }));
}

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
    poderes: Array<{ slug: string; nome: string; descricao: string; uuid: string; selected: boolean }>;
    /** Crenças, símbolo, canalizar, arma, obrigações — do livro (textos.json). */
    ficha: Array<{ rotulo: string; texto: string }> | null;
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
  resolvePoder: (slug: string) => { nome: string; descricao: string; uuid?: string } | null = () => null
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
  // Lista menor ou igual à cota (deus menor com 1 poder): não há o que escolher.
  const auto = Boolean(selected) && selected!.id !== PANTEAO.id && selected!.poderes_concedidos.length > 0 && selected!.poderes_concedidos.length <= cotaClasse;

  const selectedDivindade = selected
    ? {
        id: selected.id,
        nome: selected.nome,
        ficha: fichaDoDeus(selected.id),
        auto,
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
              uuid: p?.uuid ?? "",
              selected: auto || escolhidos.includes(slug),
              auto,
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
