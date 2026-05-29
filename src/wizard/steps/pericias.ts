import { countTreinaveis, buildPericiaSet } from "../../rules/pericias.js";
import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";

export interface PericiaEntry {
  id: string;
  nome: string;
  checked: boolean;
  locked: boolean;
  inata: boolean;
}

export interface PericiaContext {
  stepTitle: string;
  choicesRemaining: number;
  pericias: PericiaEntry[];
  errors: string[];
}

const PERICIA_NOMES: Record<string, string> = {
  acrobacia: "Acrobacia", adestramento: "Adestramento", atletismo: "Atletismo",
  atuacao: "Atuação", cavalgar: "Cavalgar", conhecimento: "Conhecimento",
  cura: "Cura", diplomacia: "Diplomacia", enganacao: "Enganação",
  fortitude: "Fortitude", furtividade: "Furtividade", guerra: "Guerra",
  iniciativa: "Iniciativa", intimidacao: "Intimidação", intuicao: "Intuição",
  investigacao: "Investigação", jogatina: "Jogatina", ladinagem: "Ladinagem",
  luta: "Luta", misticismo: "Misticismo", nobreza: "Nobreza",
  oficio: "Ofício", percepcao: "Percepção", pilotagem: "Pilotagem",
  pontaria: "Pontaria", reflexos: "Reflexos", religiao: "Religião",
  sobrevivencia: "Sobrevivência", vontade: "Vontade",
};

export function preparePericiaContext(
  state: WizardState,
  classe: IndexedClasse | undefined,
  intModifier: number,
  errors: string[] = []
): PericiaContext {
  if (!classe) {
    return { stepTitle: "Perícias", choicesRemaining: 0, pericias: [], errors };
  }

  const totalEscolhas = countTreinaveis(classe, intModifier, 0);
  const periciaSet = buildPericiaSet(classe, state.periciasTreinadas, []);
  const allPericias = Array.from(
    new Set([
      ...(classe.system.pericias?.inatas ?? []),
      ...(classe.system.pericias?.escolhas ?? []),
      ...state.periciasTreinadas,
    ])
  ).sort();

  const pericias: PericiaEntry[] = allPericias.map((id) => ({
    id,
    nome: PERICIA_NOMES[id] ?? id,
    checked: periciaSet.treinadas.includes(id),
    locked: periciaSet.inatas.includes(id),
    inata: periciaSet.inatas.includes(id),
  }));

  return {
    stepTitle: "Perícias",
    choicesRemaining: Math.max(0, totalEscolhas - state.periciasTreinadas.length),
    pericias,
    errors,
  };
}
