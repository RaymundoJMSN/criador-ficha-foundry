import { WizardStep } from "./steps.js";
import { validarAtributos, listMetodos } from "./atributos.js";
import { pendenciasDeIdade, poderesGeraisExtras, beneficiosDeOrigemPermitidos } from "./idade.js";
import type { ConfigCriacao } from "../config/config.js";
import type { AtributosBase } from "./atributos.js";
import { filterMagias, cotaDeMagias, slugsDosPoderes, escolasAEscolher, magiasExtrasDosPoderes } from "./magias.js";
import { classesDoPersonagem, caminhoDe, slotsDePoderTotal, errosMulticlasse } from "./multiclasse.js";
import { listOrigens, validarBeneficios } from "./origem.js";
import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  isDivindadeAcessa,
  poderesConcedidosParaEscolher,
} from "./divindade.js";
import { toNomeSlug } from "../compendium/slug.js";
import {
  getRaceModifierGroups,
  validateRaceModifiers,
  distribuirAbertos,
  totaisRaciaisDoEstado,
} from "./subescolhas.js";
import { getClasse, cadeiaSubEscolhas } from "./classe.js";

import { getRaceSkillBonus, pendenciasDeEscolhasRaciais } from "./raca.js";
import { buildPericiaPlan, computeTrained, type PericiaPicks } from "./pericias.js";
import type { IndexedMagia, AnyIndexed } from "../compendium/types.js";

export interface EngineState {
  nivel: number;
  nome: string;
  metodoAtributos: string;
  atributosBase: AtributosBase;
  config: ConfigCriacao;
  racaId: string;
  racaNome?: string;
  origemId: string;
  classeId: string;
  classeNome?: string;
  subclasseId?: string;
  divindadeId?: string;
  periciasTreinadas: string[];
  poderes: string[];
  poderesAutoGrant: string[];
  magias: string[];
  equipamento: { itemId: string; qty: number }[];
  dinheiroRestante: number;
  escolhasPorItem: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validate(step: WizardStep, state: EngineState): ValidationResult {
  const errors: string[] = [];

  switch (step) {
    case WizardStep.Nivel:
      if (state.nivel < 1 || state.nivel > 20) errors.push("Nível deve ser entre 1 e 20.");
      if (!state.nome.trim()) errors.push("Nome é obrigatório.");
      break;

    case WizardStep.Atributos:
      errors.push(
        ...validarAtributos(state.metodoAtributos, state.atributosBase, state.escolhasPorItem, state.config.pontosCompra)
      );
      break;

    case WizardStep.Raca: {
      if (!state.racaId) {
        errors.push("Raça é obrigatória.");
        break;
      }
      const racaRef = state.racaNome || state.racaId;
      if (getRaceModifierGroups(racaRef).length > 0) {
        const choices = (state.escolhasPorItem["raca_modificadores"] as string[][]) ?? [];
        const { errors: modErrors } = validateRaceModifiers(racaRef, choices);
        if (modErrors.length > 0)
          errors.push("Complete as escolhas de atributo da raça.");
      }
      if (state.config.racasAbertas) {
        const dist = (state.escolhasPorItem["raca_aberta"] as Record<string, string> | undefined) ?? {};
        errors.push(...distribuirAbertos(racaRef, dist).erros);
      }
      break;
    }

    case WizardStep.Idade:
      errors.push(...pendenciasDeIdade(state));
      break;

    case WizardStep.Origem: {
      if (!state.origemId) {
        // Criança (HA p.288, "Sem Origem") não tem benefício de origem: escolher é só cor.
        if (beneficiosDeOrigemPermitidos(state) > 0) errors.push("Origem é obrigatória.");
        break;
      }
      const escolhidos = (state.escolhasPorItem["origem_beneficios"] as string[]) ?? [];
      errors.push(...validarBeneficios(state.origemId, escolhidos, beneficiosDeOrigemPermitidos(state)).errors);
      break;
    }

    case WizardStep.Classe:
      if (!state.classeId) errors.push("Classe é obrigatória.");
      errors.push(...errosMulticlasse(state));
      break;

    case WizardStep.Pericias: {
      const classe = getClasse(state.classeNome || state.classeId);
      if (classe) {
        const racaRef = state.racaNome || state.racaId;
        const intFinal = (state.atributosBase.int ?? 0) + (totaisRaciaisDoEstado(state).int ?? 0);
        const plan = buildPericiaPlan(classe, intFinal, getRaceSkillBonus(racaRef));
        const picks = (state.escolhasPorItem["pericias"] as PericiaPicks) ?? {
          obrigatorias: [],
          escolhas: [],
          extras_int: [],
          raca: [],
        };
        const { errors: pErrors } = computeTrained(plan, picks);
        errors.push(...pErrors);
      }
      break;
    }

    case WizardStep.Divindade: {
      // classeId/racaId são ids de compêndio; a regra compara slug.
      const slugsClasses = classesDoPersonagem(state).map((c) => c.classeSlug);
      const racaSlug = toNomeSlug(state.racaNome || "");
      if (slugsClasses.some(isDivindadeObrigatoria) && !state.divindadeId) {
        errors.push("Divindade é obrigatória para esta classe.");
      }
      if (
        state.divindadeId &&
        !slugsClasses.some((c) => isDivindadeAcessa(state.divindadeId!, racaSlug, c, state.config.devocoesAbertas))
      ) {
        errors.push("Esta divindade não aceita personagens com esta raça/classe.");
      }
      const quantos = Math.max(...slugsClasses.map((c) => poderesConcedidosParaEscolher(c, Boolean(state.divindadeId))));
      const marcados = (state.escolhasPorItem["divindade_poderes"] as string[]) ?? [];
      if (marcados.length !== quantos) {
        errors.push(`Escolha ${quantos} poder(es) concedido(s) da divindade.`);
      }
      break;
    }

    case WizardStep.Revisao:
      errors.push(...pendencias(state));
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Tudo que ainda falta para a ficha estar completa. Cada linha é uma pendência
 * legível — é o que a Revisão mostra e o que bloqueia o botão Criar.
 */
export function pendencias(state: EngineState): string[] {
  const faltando: string[] = [];

  if (!state.nome.trim()) faltando.push("Dê um nome ao personagem.");
  if (!state.racaId) faltando.push("Escolha uma raça.");
  if (!state.origemId && beneficiosDeOrigemPermitidos(state) > 0) faltando.push("Escolha uma origem.");
  if (!state.classeId) faltando.push("Escolha uma classe.");

  const classeRef = state.classeNome || state.classeId;
  const racaRef = state.racaNome || state.racaId;

  if (state.racaId && getRaceModifierGroups(racaRef).length > 0) {
    const choices = (state.escolhasPorItem["raca_modificadores"] as string[][]) ?? [];
    if (validateRaceModifiers(racaRef, choices).errors.length > 0) {
      faltando.push("Complete as escolhas de atributo da raça.");
    }
  }

  if (state.racaId) {
    faltando.push(...pendenciasDeEscolhasRaciais(racaRef, state.escolhasPorItem));
  }

  if (state.origemId) {
    const escolhidos = (state.escolhasPorItem["origem_beneficios"] as string[]) ?? [];
    const beneficios = validarBeneficios(state.origemId, escolhidos, beneficiosDeOrigemPermitidos(state));
    faltando.push(...beneficios.errors);
    for (const categoria of beneficios.livres) {
      if (!state.escolhasPorItem[`origem_poder_livre_${categoria}`]) {
        faltando.push(`Escolha o poder de ${categoria} da origem.`);
      }
    }
  }

  faltando.push(...errosMulticlasse(state));
  // Caminho de cada classe no nível que ela tem (cavaleiro só no 5º).
  for (const c of classesDoPersonagem(state)) {
    const dados = getClasse(c.classeNome || c.classeId);
    if (!dados) continue;
    const caminhos = c.niveis >= (dados.caminho_nivel ?? 1) ? (dados.caminhos ?? []) : [];
    const caminhoEscolhido = caminhoDe(state, c);
    if (caminhos.length > 0 && !caminhoEscolhido) {
      faltando.push(`Escolha o caminho de ${c.classeNome}.`);
    } else if (caminhoEscolhido) {
      const { pendente } = cadeiaSubEscolhas(c.classeNome || c.classeId, caminhoEscolhido, state.escolhasPorItem);
      if (pendente) faltando.push(`${pendente.label}.`);
    }
  }

  const classe = getClasse(classeRef);
  if (classe) {

    const intFinal = (state.atributosBase.int ?? 0) + (totaisRaciaisDoEstado(state).int ?? 0);
    const plan = buildPericiaPlan(classe, intFinal, getRaceSkillBonus(racaRef));
    const picks = (state.escolhasPorItem["pericias"] as PericiaPicks) ?? {
      obrigatorias: [],
      escolhas: [],
      extras_int: [],
      raca: [],
    };
    faltando.push(...computeTrained(plan, picks).errors);
  }

  // Complicação e "Já Vi Coisas" dão poderes gerais a mais (HA p.282/289).
  // Multiclasse: vagas de cada classe no seu nível, somadas.
  const slots = slotsDePoderTotal(state) + poderesGeraisExtras(state);
  if (state.poderes.length < slots) {
    faltando.push(`Escolha ${slots} poder(es) — ${state.poderes.length} escolhido(s).`);
  }
  faltando.push(...pendenciasDeIdade(state));
  if (state.config.racasAbertas && racaRef) {
    faltando.push(...distribuirAbertos(racaRef, (state.escolhasPorItem["raca_aberta"] as Record<string, string>) ?? {}).erros);
  }

  const classeSlugPend = toNomeSlug(classeRef);
  const classesTodas = classesDoPersonagem(state);
  const cotaMagias =
    classesTodas.reduce((n, c) => n + cotaDeMagias(c.classeNome || c.classeId, c.niveis, caminhoDe(state, c), []), 0) +
    magiasExtrasDosPoderes(slugsDosPoderes(state.poderes));
  if (state.magias.length < cotaMagias) {
    faltando.push(`Escolha ${cotaMagias} magia(s) — ${state.magias.length} escolhida(s).`);
  }
  // "Sua classe diz com quantas magias você começa" é um número exato: baixar o
  // nível ou trocar mago→bruxo deixava a ficha com magias a mais.
  if (state.magias.length > cotaMagias) {
    faltando.push(`Magias a mais: remova ${state.magias.length - cotaMagias}.`);
  }
  const escolasPrecisa = Math.max(...classesTodas.map((c) => escolasAEscolher(c.classeSlug)));
  const escolasTem = ((state.escolhasPorItem["classe_escolas"] as string[] | undefined) ?? []).length;
  if (escolasPrecisa > 0 && escolasTem < escolasPrecisa) {
    faltando.push(`Escolha ${escolasPrecisa} escolas de magia — ${escolasTem} marcada(s).`);
  }

  if (classesTodas.some((c) => isDivindadeObrigatoria(c.classeSlug)) && !state.divindadeId) {
    faltando.push("Esta classe exige uma divindade.");
  }
  void classeSlugPend;
  const quantosConcedidos = Math.max(
    ...classesTodas.map((c) => poderesConcedidosParaEscolher(c.classeSlug, Boolean(state.divindadeId)))
  );
  const concedidosEscolhidos = (state.escolhasPorItem["divindade_poderes"] as string[]) ?? [];
  if (concedidosEscolhidos.length !== quantosConcedidos) {
    faltando.push(
      `Escolha ${quantosConcedidos} poder(es) concedido(s) da divindade — ${concedidosEscolhidos.length} marcado(s).`
    );
  }

  return faltando;
}

export function getOptions(
  step: WizardStep,
  state: EngineState,
  compendiumItems?: AnyIndexed[]
): unknown {
  switch (step) {
    case WizardStep.Atributos:
      return listMetodos();

    case WizardStep.Origem:
      return listOrigens();

    case WizardStep.Divindade:
      return listDivindadesParaPersonagem(
        toNomeSlug(state.racaNome || ""),
        toNomeSlug(state.classeNome || ""),
        state.config.devocoesAbertas
      );

    case WizardStep.Magias: {
      const magias = (compendiumItems ?? []).filter((i): i is IndexedMagia => i.type === "magia");
      return filterMagias(magias, {
        classeSlug: toNomeSlug(state.classeNome || ""),
        nivel: state.nivel,
        escolas: (state.escolhasPorItem["classe_escolas"] as string[] | undefined) ?? [],
        poderSlugs: slugsDosPoderes(state.poderes),
      });
    }

    default:
      return compendiumItems ?? [];
  }
}
