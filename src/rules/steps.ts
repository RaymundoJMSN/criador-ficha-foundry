import { isConjurador, magiasExtrasDosPoderes } from "./magias.js";
import { temPassoIdade } from "./idade.js";
import { NIVEL_MINIMO_DISTINCAO } from "./distincoes.js";
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
  Magias = "magias",
  Distincao = "distincao",
  Complicacao = "complicacao",
  Poderes = "poderes",
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
  // Magias antes de Poderes (pedido da mesa): o poder pode exigir a magia, e a
  // magia que vem de poder é escolhida no próprio poder.
  WizardStep.Magias,
  WizardStep.Distincao,
  WizardStep.Complicacao,
  WizardStep.Poderes,
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
  [WizardStep.Distincao]: {
    conditional: true,
    required: false,
    labelKey: "T20W.Wizard.Step.Distincao",
  },
  [WizardStep.Complicacao]: {
    conditional: true,
    required: false,
    labelKey: "T20W.Wizard.Step.Complicacao",
  },
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
  classeSlug: string | string[],
  poderSlugs: string[] = [],
  config: ConfigCriacao = CONFIG_PADRAO,
  nivel = 1
): WizardStep[] {
  const slugs = Array.isArray(classeSlug) ? classeSlug : [classeSlug];
  const conjura = slugs.some(isConjurador) || magiasExtrasDosPoderes(poderSlugs) > 0;
  return STEP_ORDER.filter((s) => {
    if (s === WizardStep.Magias) return conjura;
    // Cada regra opcional ligada ganha o seu passo (pedido da mesa).
    if (s === WizardStep.Idade) return temPassoIdade(config);
    if (s === WizardStep.Distincao) return config.distincoes && nivel >= NIVEL_MINIMO_DISTINCAO;
    if (s === WizardStep.Complicacao) return config.complicacoes;
    return true;
  });
}
