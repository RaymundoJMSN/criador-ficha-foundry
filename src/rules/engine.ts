import { WizardStep } from "./steps.js";
import { validatePointBuy, listMetodos } from "./atributos.js";
import type { AtributosBase } from "./atributos.js";
import { filterMagias } from "./magias.js";
import { listOrigens } from "./origem.js";
import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  isDivindadeAcessa,
} from "./divindade.js";
import type { IndexedMagia, AnyIndexed } from "../compendium/types.js";

export interface EngineState {
  nivel: number;
  nome: string;
  metodoAtributos: string;
  atributosBase: AtributosBase;
  racaId: string;
  origemId: string;
  classeId: string;
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
      if (state.metodoAtributos === "compra_pontos") {
        const result = validatePointBuy(state.atributosBase);
        if (!result.valid) errors.push(...result.errors);
        if (result.remaining < 0) errors.push(`Pontos excedidos em ${-result.remaining}.`);
      }
      break;

    case WizardStep.Raca:
      if (!state.racaId) errors.push("Raça é obrigatória.");
      break;

    case WizardStep.Origem:
      if (!state.origemId) errors.push("Origem é obrigatória.");
      break;

    case WizardStep.Classe:
      if (!state.classeId) errors.push("Classe é obrigatória.");
      break;

    case WizardStep.Divindade:
      if (isDivindadeObrigatoria(state.classeId) && !state.divindadeId) {
        errors.push("Divindade é obrigatória para esta classe.");
      }
      if (
        state.divindadeId &&
        !isDivindadeAcessa(state.divindadeId, state.racaId, state.classeId)
      ) {
        errors.push("Esta divindade não aceita personagens com esta raça/classe.");
      }
      break;

    case WizardStep.Revisao:
      if (!state.nome.trim()) errors.push("Nome é obrigatório.");
      if (!state.classeId) errors.push("Classe é obrigatória.");
      if (!state.racaId) errors.push("Raça é obrigatória.");
      break;
  }

  return { valid: errors.length === 0, errors };
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
      return listDivindadesParaPersonagem(state.racaId, state.classeId);

    case WizardStep.Magias: {
      const magias = (compendiumItems ?? []).filter(
        (i): i is IndexedMagia => i.type === "magia"
      );
      return filterMagias(magias, state.classeId, state.nivel);
    }

    default:
      return compendiumItems ?? [];
  }
}
