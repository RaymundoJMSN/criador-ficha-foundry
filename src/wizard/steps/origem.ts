import {
  listOrigens,
  getOrigem,
  getBeneficiosPlano,
  validarBeneficios,
  formatItensIniciais,
  type BeneficioOpcao,
} from "../../rules/origem.js";
import type { WizardState } from "../state.js";

export interface OrigemOption {
  id: string;
  nome: string;
  selected: boolean;
}

export interface BeneficioRef extends BeneficioOpcao {
  selected: boolean;
}

export interface OrigemDetail {
  id: string;
  nome: string;
  pericias: string[];
  itens_iniciais: string[];
  /** Pool de benefícios: o jogador marca dois (perícia e/ou poder). */
  beneficios: BeneficioRef[];
  beneficiosQtd: number;
  beneficiosMarcados: number;
  /** Pool pequeno: tudo entra sem escolha. */
  beneficiosAuto: boolean;
}

export interface OrigemContext {
  stepTitle: string;
  origemOptions: OrigemOption[];
  selectedDetail: OrigemDetail | null;
  errors: string[];
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
  const origens = listOrigens();
  const origemOptions: OrigemOption[] = origens.map((o) => ({
    id: o.id,
    nome: o.nome,
    selected: o.id === state.origemId,
  }));

  const selected = state.origemId ? getOrigem(state.origemId) : null;
  let selectedDetail: OrigemDetail | null = null;

  if (selected) {
    const escolhidos = new Set(
      (state.escolhasPorItem["origem_beneficios"] as string[] | undefined) ?? []
    );
    const plano = getBeneficiosPlano(selected.id, resolvePoderNome);
    const beneficios: BeneficioRef[] = plano.opcoes.map((o) => ({
      ...o,
      selected: plano.autoAplicar || escolhidos.has(o.token),
    }));
    selectedDetail = {
      id: selected.id,
      nome: selected.nome,
      pericias: selected.beneficios.pericias,
      itens_iniciais: formatItensIniciais(selected.id),
      beneficios,
      beneficiosQtd: plano.quantidade,
      beneficiosMarcados: beneficios.filter((b) => b.selected).length,
      beneficiosAuto: plano.autoAplicar,
    };
    errors = [...errors, ...validarBeneficios(selected.id, [...escolhidos]).errors];
  }

  return {
    stepTitle: "Origem",
    origemOptions,
    selectedDetail,
    errors,
  };
}
