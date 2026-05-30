import { buildPericiaPlan, computeTrained, type PericiaPicks } from "../../rules/pericias.js";
import { getClasse } from "../../rules/classe.js";
import type { WizardState } from "../state.js";

export interface PericiaOpt {
  id: string;
  nome: string;
  checked: boolean;
}

export interface ObrigGroup {
  groupIndex: number;
  quantidade: number;
  opcoes: PericiaOpt[];
}

export interface PericiaContext {
  stepTitle: string;
  hasClasse: boolean;
  fixas: { id: string; nome: string }[];
  obrigatorias: ObrigGroup[];
  escolhasQtd: number;
  escolhasRestantes: number;
  escolhasOpcoes: PericiaOpt[];
  intBonus: number;
  intOpcoes: PericiaOpt[];
  racaBonus: number;
  racaOpcoes: PericiaOpt[];
  errors: string[];
}

const PERICIA_NOMES: Record<string, string> = {
  acrobacia: "Acrobacia",
  adestramento: "Adestramento",
  atletismo: "Atletismo",
  atuacao: "Atuação",
  cavalgar: "Cavalgar",
  conhecimento: "Conhecimento",
  cura: "Cura",
  diplomacia: "Diplomacia",
  enganacao: "Enganação",
  fortitude: "Fortitude",
  furtividade: "Furtividade",
  guerra: "Guerra",
  iniciativa: "Iniciativa",
  intimidacao: "Intimidação",
  intuicao: "Intuição",
  investigacao: "Investigação",
  jogatina: "Jogatina",
  ladinagem: "Ladinagem",
  luta: "Luta",
  misticismo: "Misticismo",
  nobreza: "Nobreza",
  oficio: "Ofício",
  percepcao: "Percepção",
  pilotagem: "Pilotagem",
  pontaria: "Pontaria",
  reflexos: "Reflexos",
  religiao: "Religião",
  sobrevivencia: "Sobrevivência",
  vontade: "Vontade",
};

const nome = (id: string): string => PERICIA_NOMES[id] ?? id;

function emptyContext(errors: string[]): PericiaContext {
  return {
    stepTitle: "Perícias",
    hasClasse: false,
    fixas: [],
    obrigatorias: [],
    escolhasQtd: 0,
    escolhasRestantes: 0,
    escolhasOpcoes: [],
    intBonus: 0,
    intOpcoes: [],
    racaBonus: 0,
    racaOpcoes: [],
    errors,
  };
}

/**
 * Builds the perícia step from the canonical class spec (T20-DB), never from
 * the Foundry classe item.
 * @param intFinal  final Int (base + racial), drives extra-skill picks.
 * @param racaBonus "any skill" the race grants (humano Versátil +2).
 */
export function preparePericiaContext(
  state: WizardState,
  intFinal: number,
  racaBonus: number,
  errors: string[] = []
): PericiaContext {
  const classe = state.classeNome ? getClasse(state.classeNome) : null;
  if (!classe) return emptyContext(errors);

  const plan = buildPericiaPlan(classe, intFinal, racaBonus);
  const picks = (state.escolhasPorItem["pericias"] as PericiaPicks | undefined) ?? {
    obrigatorias: [],
    escolhas: [],
    extras_int: [],
    raca: [],
  };

  const obrigatorias: ObrigGroup[] = plan.obrigatorias.map((g, i) => ({
    groupIndex: i,
    quantidade: g.quantidade,
    opcoes: g.opcoes.map((id) => ({
      id,
      nome: nome(id),
      checked: (picks.obrigatorias[i] ?? []).includes(id),
    })),
  }));

  const escolhasOpcoes: PericiaOpt[] = plan.escolhas.opcoes.map((id) => ({
    id,
    nome: nome(id),
    checked: (picks.escolhas ?? []).includes(id),
  }));

  const todasOpcoes = (selected: string[]): PericiaOpt[] =>
    plan.todas.map((id) => ({ id, nome: nome(id), checked: selected.includes(id) }));

  return {
    stepTitle: "Perícias",
    hasClasse: true,
    fixas: plan.fixas.map((id) => ({ id, nome: nome(id) })),
    obrigatorias,
    escolhasQtd: plan.escolhas.quantidade,
    escolhasRestantes: Math.max(0, plan.escolhas.quantidade - (picks.escolhas ?? []).length),
    escolhasOpcoes,
    intBonus: plan.intBonus,
    intOpcoes: plan.intBonus > 0 ? todasOpcoes(picks.extras_int ?? []) : [],
    racaBonus: plan.racaBonus,
    racaOpcoes: plan.racaBonus > 0 ? todasOpcoes(picks.raca ?? []) : [],
    errors,
  };
}

/** Validates the current picks (used by the engine to block Next). */
export function validatePericiaPicks(
  state: WizardState,
  intFinal: number,
  racaBonus: number
): string[] {
  const classe = state.classeNome ? getClasse(state.classeNome) : null;
  if (!classe) return [];
  const plan = buildPericiaPlan(classe, intFinal, racaBonus);
  const picks = (state.escolhasPorItem["pericias"] as PericiaPicks | undefined) ?? {
    obrigatorias: [],
    escolhas: [],
    extras_int: [],
    raca: [],
  };
  return computeTrained(plan, picks).errors;
}
