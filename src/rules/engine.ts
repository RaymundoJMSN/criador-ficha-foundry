import { WizardStep } from "./steps.js";
import { validarAtributos, listMetodos } from "./atributos.js";
import { pendenciasDeIdade, poderesGeraisExtras, beneficiosDeOrigemPermitidos } from "./idade.js";
import type { ConfigCriacao } from "../config/config.js";
import type { AtributosBase } from "./atributos.js";
import { filterMagias, cotaDeMagias, slugsDePoderesComMagia, escolasAEscolher, magiasExtrasDosPoderes } from "./magias.js";
import { classesDoPersonagem, caminhoDe, slotsDePoderTotal, errosMulticlasse } from "./multiclasse.js";
import { listOrigens, validarBeneficios } from "./origem.js";
import {
  listDivindadesParaPersonagem,
  getDivindade,
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
import { pendenciasDaMontagem } from "./montagem.js";
import { buildPericiaPlan, computeTrained, type PericiaPicks } from "./pericias.js";
import { oficiosResolvidos, passoDoOficio } from "./oficio.js";
import { quantosOficios } from "./pericias-fontes.js";
import { getTrainedPericaSlugs } from "../actor/mapper.js";
import type { WizardState } from "../wizard/state.js";
import { fontesDePoderExtra, poderesExtrasEscolhidos } from "./idade.js";
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
      if (getRaceModifierGroups(racaRef, state.escolhasPorItem).length > 0) {
        const choices = (state.escolhasPorItem["raca_modificadores"] as string[][]) ?? [];
        const { errors: modErrors } = validateRaceModifiers(racaRef, choices, state.escolhasPorItem);
        if (modErrors.length > 0)
          errors.push("Complete as escolhas de atributo da raça.");
      }
      errors.push(...pendenciasDaMontagem(racaRef, state.escolhasPorItem));
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
        const plan = buildPericiaPlan(classe, intFinal, getRaceSkillBonus(racaRef, state.escolhasPorItem));
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
      const deus = state.divindadeId ? getDivindade(state.divindadeId) : null;
      const quantos = Math.min(
        Math.max(...slugsClasses.map((c) => poderesConcedidosParaEscolher(c, Boolean(state.divindadeId)))),
        deus ? deus.poderes_concedidos.length : 99
      );
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
export interface Pendencia {
  /** Passo onde ela se resolve — é lá que o wizard mostra e trava o "Próximo". */
  passo: WizardStep;
  texto: string;
}

export function pendencias(state: EngineState): string[] {
  return pendenciasComPasso(state).map((p) => p.texto);
}

export function pendenciasComPasso(state: EngineState): Pendencia[] {
  const lista: Pendencia[] = [];
  let atual: WizardStep = WizardStep.Revisao;
  const em = (p: WizardStep): void => {
    atual = p;
  };
  const faltando = {
    push: (...textos: string[]): void => {
      for (const t of textos) lista.push({ passo: atual, texto: t });
    },
  };

  em(WizardStep.Nivel);
  if (!state.nome.trim()) faltando.push("Dê um nome ao personagem.");
  em(WizardStep.Raca);
  if (!state.racaId) faltando.push("Escolha uma raça.");
  em(WizardStep.Origem);
  if (!state.origemId && beneficiosDeOrigemPermitidos(state) > 0) faltando.push("Escolha uma origem.");
  em(WizardStep.Classe);
  if (!state.classeId) faltando.push("Escolha uma classe.");

  const classeRef = state.classeNome || state.classeId;
  const racaRef = state.racaNome || state.racaId;

  em(WizardStep.Raca);
  if (state.racaId && getRaceModifierGroups(racaRef, state.escolhasPorItem).length > 0) {
    const choices = (state.escolhasPorItem["raca_modificadores"] as string[][]) ?? [];
    if (validateRaceModifiers(racaRef, choices, state.escolhasPorItem).errors.length > 0) {
      faltando.push("Complete as escolhas de atributo da raça.");
    }
  }

  if (state.racaId) {
    faltando.push(...pendenciasDeEscolhasRaciais(racaRef, state.escolhasPorItem));
    faltando.push(...pendenciasDaMontagem(racaRef, state.escolhasPorItem));
  }

  em(WizardStep.Origem);
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

  em(WizardStep.Classe);
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

  em(WizardStep.Pericias);
  const classe = getClasse(classeRef);
  if (classe) {

    const intFinal = (state.atributosBase.int ?? 0) + (totaisRaciaisDoEstado(state).int ?? 0);
    const plan = buildPericiaPlan(classe, intFinal, getRaceSkillBonus(racaRef, state.escolhasPorItem));
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
  em(WizardStep.Poderes);
  const slots = slotsDePoderTotal(state) + poderesGeraisExtras(state);
  if (state.poderes.length < slots) {
    faltando.push(`Escolha ${slots} poder(es) — ${state.poderes.length} escolhido(s).`);
  }
  em(WizardStep.Idade);
  faltando.push(...pendenciasDeIdade(state));
  // ponytail: EngineState tem os campos que o mapper lê (raça, classe, picks, origem, config).
  em(passoDoOficio(state));
  const oficios = quantosOficios(state as unknown as WizardState);
  if (oficios > 0 && !oficiosResolvidos(state.escolhasPorItem, oficios)) {
    faltando.push(
      oficios === 1
        ? "Ofício: diga qual (Alfaiate, Armeiro… ou um nome próprio)."
        : `Ofício: diga quais são os ${oficios} (sem repetir).`
    );
  }
  for (const f of fontesDePoderExtra(state)) {
    em(f.passo === "raca" ? WizardStep.Raca : WizardStep.Idade);
    if (!poderesExtrasEscolhidos(state)[f.fonte]) faltando.push(`${f.rotulo}: escolha o poder.`);
  }
  em(WizardStep.Raca);
  if (state.config.racasAbertas && racaRef) {
    faltando.push(...distribuirAbertos(racaRef, (state.escolhasPorItem["raca_aberta"] as Record<string, string>) ?? {}).erros);
  }

  const classeSlugPend = toNomeSlug(classeRef);
  const classesTodas = classesDoPersonagem(state);
  const cotaMagias =
    classesTodas.reduce((n, c) => n + cotaDeMagias(c.classeNome || c.classeId, c.niveis, caminhoDe(state, c), []), 0) +
    magiasExtrasDosPoderes(slugsDePoderesComMagia(state));
  em(WizardStep.Magias);
  if (state.magias.length < cotaMagias) {
    faltando.push(`Escolha ${cotaMagias} magia(s) — ${state.magias.length} escolhida(s).`);
  }
  // "Sua classe diz com quantas magias você começa" é um número exato: baixar o
  // nível ou trocar mago→bruxo deixava a ficha com magias a mais.
  if (state.magias.length > cotaMagias) {
    faltando.push(`Magias a mais: remova ${state.magias.length - cotaMagias}.`);
  }
  em(WizardStep.Classe);
  const escolasPrecisa = Math.max(...classesTodas.map((c) => escolasAEscolher(c.classeSlug)));
  const escolasTem = ((state.escolhasPorItem["classe_escolas"] as string[] | undefined) ?? []).length;
  if (escolasPrecisa > 0 && escolasTem < escolasPrecisa) {
    faltando.push(`Escolha ${escolasPrecisa} escolas de magia — ${escolasTem} marcada(s).`);
  }

  em(WizardStep.Divindade);
  if (classesTodas.some((c) => isDivindadeObrigatoria(c.classeSlug)) && !state.divindadeId) {
    faltando.push("Esta classe exige uma divindade.");
  }
  void classeSlugPend;
  const cotaConcedidos = Math.max(
    ...classesTodas.map((c) => poderesConcedidosParaEscolher(c.classeSlug, Boolean(state.divindadeId)))
  );
  const deusEscolhido = state.divindadeId ? getDivindade(state.divindadeId) : null;
  const quantosConcedidos = deusEscolhido ? Math.min(cotaConcedidos, deusEscolhido.poderes_concedidos.length) : cotaConcedidos;
  const concedidosEscolhidos = (state.escolhasPorItem["divindade_poderes"] as string[]) ?? [];
  if (concedidosEscolhidos.length !== quantosConcedidos) {
    faltando.push(
      `Escolha ${quantosConcedidos} poder(es) concedido(s) da divindade — ${concedidosEscolhidos.length} marcado(s).`
    );
  }

  return lista;
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
        poderSlugs: slugsDePoderesComMagia(state),
      });
    }

    default:
      return compendiumItems ?? [];
  }
}
