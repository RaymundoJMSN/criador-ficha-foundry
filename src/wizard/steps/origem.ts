import {
  listOrigens,
  getOrigem,
  getPick2Candidates,
  formatItensIniciais,
} from "../../rules/origem.js";
import type { WizardState } from "../state.js";

export interface OrigemOption {
  id: string;
  nome: string;
  selected: boolean;
}

export interface PoderRef {
  id: string;
  nome: string;
  selected: boolean;
}

export interface OrigemDetail {
  id: string;
  nome: string;
  pericias: string[];
  itens_iniciais: string[];
  poder_auto: string | null;
  poder_auto_nome: string | null;
  pick2_candidates: PoderRef[];
  pick2_escolhido: string | null;
}

export interface OrigemContext {
  stepTitle: string;
  origemOptions: OrigemOption[];
  selectedDetail: OrigemDetail | null;
  errors: string[];
}

/** Fallback: turn a power slug into a human-ish label when no pack name resolves. */
function prettifySlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * @param resolvePoderNome maps a power slug → its Foundry pack display name.
 *   Falls back to a prettified slug when the resolver returns nothing.
 */
export function prepareOrigemContext(
  state: WizardState,
  errors: string[] = [],
  resolvePoderNome: (slug: string) => string | null = () => null
): OrigemContext {
  const nomeOf = (slug: string): string => resolvePoderNome(slug) ?? prettifySlug(slug);

  const origens = listOrigens();
  const origemOptions: OrigemOption[] = origens.map((o) => ({
    id: o.id,
    nome: o.nome,
    selected: o.id === state.origemId,
  }));

  const selected = state.origemId ? getOrigem(state.origemId) : null;
  let selectedDetail: OrigemDetail | null = null;

  if (selected) {
    const pick2Escolhido = (state.escolhasPorItem["origem_poder"] as string | undefined) ?? null;
    const candidates: PoderRef[] = getPick2Candidates(selected.id).map((slug) => ({
      id: slug,
      nome: nomeOf(slug),
      selected: slug === pick2Escolhido,
    }));
    selectedDetail = {
      id: selected.id,
      nome: selected.nome,
      pericias: selected.beneficios.pericias,
      itens_iniciais: formatItensIniciais(selected.id),
      poder_auto: selected.beneficios.poder_unico_id,
      poder_auto_nome: selected.beneficios.poder_unico_id
        ? nomeOf(selected.beneficios.poder_unico_id)
        : null,
      pick2_candidates: candidates,
      pick2_escolhido: pick2Escolhido,
    };
  }

  return {
    stepTitle: "Origem",
    origemOptions,
    selectedDetail,
    errors,
  };
}
