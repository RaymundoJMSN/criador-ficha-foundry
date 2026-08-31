import {
  listOrigens,
  getOrigem,
  getBeneficiosPlano,
  validarBeneficios,
  formatItensIniciais,
  type BeneficioOpcao,
} from "../../rules/origem.js";
import type { WizardState } from "../state.js";
import textosRaw from "../../data/textos.json";
import type { IndexedPoder } from "../../compendium/types.js";
import { describeUnmet, type PartialWizardState } from "../../rules/poderes.js";
import { toNomeSlug } from "../../compendium/slug.js";

export interface OrigemOption {
  id: string;
  nome: string;
  selected: boolean;
}

export interface BeneficioRef extends BeneficioOpcao {
  selected: boolean;
}

export interface PoderLivre {
  categoria: string;
  label: string;
  escolhido: string | null;
  opcoes: Array<{ id: string; nome: string; selected: boolean }>;
}

const textos = textosRaw as { origens?: Record<string, string> };

export interface OrigemDetail {
  id: string;
  nome: string;
  /** Descrição do livro. Vazia quando textos.json não foi gerado. */
  descricao: string;
  pericias: string[];
  itens_iniciais: string[];
  /** Pool de benefícios: o jogador marca dois (perícia e/ou poder). */
  beneficios: BeneficioRef[];
  beneficiosQtd: number;
  beneficiosMarcados: number;
  /** Pool pequeno: tudo entra sem escolha. */
  beneficiosAuto: boolean;
  /** "Um poder de combate à sua escolha" — lista tudo que o personagem alcança. */
  poderesLivres: PoderLivre[];
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
  resolvePoderNome: (slug: string) => string | null = () => null,
  todosPoderes: IndexedPoder[] = []
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
      descricao: textos.origens?.[selected.id] ?? "",
      pericias: selected.beneficios.pericias,
      itens_iniciais: formatItensIniciais(selected.id),
      beneficios,
      beneficiosQtd: plano.quantidade,
      beneficiosMarcados: beneficios.filter((b) => b.selected).length,
      beneficiosAuto: plano.autoAplicar,
      poderesLivres: [],
    };
    const validacao = validarBeneficios(selected.id, [...escolhidos]);
    errors = [...errors, ...validacao.errors];

    // Poder livre: qualquer poder da categoria cujo pré-requisito o personagem
    // já cumpra. A elegibilidade é a mesma do passo Poderes.
    const paraElegibilidade: PartialWizardState = {
      nivel: state.nivel,
      atributos: state.atributosBase,
      classeSlug: toNomeSlug(state.classeNome ?? ""),
      racaSlug: toNomeSlug(state.racaNome ?? ""),
      periciasTreinadas: state.periciasTreinadas,
      poderes: [],
    };
    selectedDetail.poderesLivres = validacao.livres.map((categoria) => {
      const chave = `origem_poder_livre_${categoria}`;
      const escolhido = (state.escolhasPorItem[chave] as string | undefined) ?? null;
      const opcoes = todosPoderes
        .filter((p) => p.system.subtipo === categoria)
        .filter((p) => describeUnmet(toNomeSlug(p.name), paraElegibilidade).length === 0)
        .map((p) => ({ id: p.id, nome: p.name, selected: p.id === escolhido }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      if (!escolhido) errors = [...errors, `Escolha o poder de ${categoria} da origem.`];
      return {
        categoria,
        label:
          plano.opcoes.find((o) => o.token === `livre:${categoria}`)?.nome ??
          `Poder de ${categoria}`,
        escolhido,
        opcoes,
      };
    });
  }

  return {
    stepTitle: "Origem",
    origemOptions,
    selectedDetail,
    errors,
  };
}
