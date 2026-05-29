import { listOrigens, getOrigem, getPick2Candidates } from "../../rules/origem.js";
import type { WizardState } from "../state.js";

export interface OrigemOption {
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
  pick2_candidates: string[];
  pick2_escolhido: string | null;
}

export interface OrigemContext {
  stepTitle: string;
  origemOptions: OrigemOption[];
  selectedDetail: OrigemDetail | null;
  errors: string[];
}

export function prepareOrigemContext(
  state: WizardState,
  errors: string[] = []
): OrigemContext {
  const origens = listOrigens();
  const origemOptions: OrigemOption[] = origens.map((o) => ({
    id: o.id,
    nome: o.nome,
    selected: o.id === state.origemId,
  }));

  const selected = state.origemId ? getOrigem(state.origemId) : null;
  let selectedDetail: OrigemDetail | null = null;

  if (selected) {
    const candidates = getPick2Candidates(selected.id);
    const pick2Escolhido =
      (state.escolhasPorItem["origem_poder"] as string | undefined) ?? null;
    selectedDetail = {
      id: selected.id,
      nome: selected.nome,
      pericias: selected.beneficios.pericias,
      itens_iniciais: selected.itens_iniciais,
      poder_auto: selected.beneficios.poder_unico_id,
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
