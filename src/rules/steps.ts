import { isConjurador, magiasExtrasDosPoderes } from "./magias.js";
import { temPassoIdade } from "./idade.js";
import { CONFIG_PADRAO, type ConfigCriacao } from "../config/config.js";
/** Wizard step identifiers — order matches STEP_ORDER array. */
export enum WizardStep {
  Nivel = "nivel",
  Atributos = "atributos",
  Raca = "raca",
  Idade = "idade",
  Origem = "origem",
  Classe = "classe",
  Pericias = "pericias",
  Divindade = "divindade",
  Poderes = "poderes",
  Magias = "magias",
  Equipamento = "equipamento",
  Revisao = "revisao",
}

/** Canonical step execution order. */
export const STEP_ORDER: WizardStep[] = [
  WizardStep.Nivel,
  WizardStep.Atributos,
  WizardStep.Raca,
  WizardStep.Idade,
  WizardStep.Origem,
  WizardStep.Classe,
  WizardStep.Pericias,
  WizardStep.Divindade,
  WizardStep.Poderes,
  WizardStep.Magias,
  WizardStep.Equipamento,
  WizardStep.Revisao,
];

export interface StepMeta {
  /** Passo pode ser pulado segundo condições. */
  conditional: boolean;
  /** Passo é obrigatório para criar o actor. */
  required: boolean;
  /** i18n key for step label. */
  labelKey: string;
}

/** Metadata for each wizard step. */
export const STEP_META: Record<WizardStep, StepMeta> = {
  [WizardStep.Nivel]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Nivel" },
  [WizardStep.Atributos]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Atributos",
  },
  [WizardStep.Raca]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Raca" },
  [WizardStep.Idade]: { conditional: true, required: false, labelKey: "T20W.Wizard.Step.Idade" },
  [WizardStep.Origem]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Origem" },
  [WizardStep.Classe]: { conditional: false, required: true, labelKey: "T20W.Wizard.Step.Classe" },
  [WizardStep.Pericias]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Pericias",
  },
  [WizardStep.Divindade]: {
    conditional: true,
    required: false,
    labelKey: "T20W.Wizard.Step.Divindade",
  },
  [WizardStep.Poderes]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Poderes",
  },
  [WizardStep.Magias]: { conditional: true, required: false, labelKey: "T20W.Wizard.Step.Magias" },
  [WizardStep.Equipamento]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Equipamento",
  },
  [WizardStep.Revisao]: {
    conditional: false,
    required: true,
    labelKey: "T20W.Wizard.Step.Revisao",
  },
};

/**
 * Passos que fazem sentido para este personagem.
 *
 * Magias só aparece para quem conjura — pela classe ou por poder que ensina
 * magia (paladino com Orar). Um lutador não deve ver, nem no topo nem ao
 * avançar. O resto vale para todos.
 */
export function passosAplicaveis(
  classeSlug: string,
  poderSlugs: string[] = [],
  config: ConfigCriacao = CONFIG_PADRAO
): WizardStep[] {
  const conjura = isConjurador(classeSlug) || magiasExtrasDosPoderes(poderSlugs) > 0;
  return STEP_ORDER.filter((s) => {
    if (s === WizardStep.Magias) return conjura;
    // Idade & Complicações só existe se o mestre ligou alguma das regras (HA cap. 4).
    if (s === WizardStep.Idade) return temPassoIdade(config);
    return true;
  });
}
