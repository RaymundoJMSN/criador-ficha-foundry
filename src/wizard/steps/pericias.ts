import { countTreinaveis } from "../../rules/pericias.js";
import { normalizePericias, getClasseProgressao } from "../../rules/progressao.js";
import type { WizardState } from "../state.js";
import type { IndexedClasse } from "../../compendium/types.js";

export interface PericiaEntry {
  id: string;
  nome: string;
  checked: boolean;
  locked: boolean;
  inata: boolean;
  escolhivel: boolean;
}

export interface PericiaContext {
  stepTitle: string;
  choicesRemaining: number;
  pericias: PericiaEntry[];
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

export function preparePericiaContext(
  state: WizardState,
  classe: IndexedClasse | undefined,
  intModifier: number,
  errors: string[] = []
): PericiaContext {
  if (!classe) {
    return { stepTitle: "Perícias", choicesRemaining: 0, pericias: [], errors };
  }

  // Parse inatas + escolhas from Foundry item — may be string or array
  let inatas = normalizePericias(classe.system.pericias?.inatas);
  let escolhas = normalizePericias(classe.system.pericias?.escolhas);
  let numero = classe.system.pericias?.numero ?? 0;

  // Fallback to T20-DB data when Foundry item has empty/corrupt pericias
  if (inatas.length === 0 || escolhas.length === 0) {
    const prog = getClasseProgressao(classe.name);
    if (prog) {
      if (inatas.length === 0) inatas = prog.pericias_inatas;
      if (escolhas.length === 0) escolhas = prog.pericias_escolha;
      if (numero === 0) numero = prog.pericias_numero;
    }
  }

  // Total choices = class base + Int bonus (min 0)
  const totalEscolhas = numero + Math.max(0, intModifier);

  // How many choices the user has already made (excluding inatas)
  const escolhasFeitas = state.periciasTreinadas.filter((p) => !inatas.includes(p)).length;

  // All pericias to display = inatas ∪ escolhas (sorted)
  const allPericias = Array.from(new Set([...inatas, ...escolhas])).sort();

  const pericias: PericiaEntry[] = allPericias.map((id) => {
    const isInata = inatas.includes(id);
    const isChosen = state.periciasTreinadas.includes(id);
    return {
      id,
      nome: PERICIA_NOMES[id] ?? id,
      checked: isInata || isChosen,
      locked: isInata,
      inata: isInata,
      escolhivel: escolhas.includes(id) && !isInata,
    };
  });

  return {
    stepTitle: "Perícias",
    choicesRemaining: Math.max(0, totalEscolhas - escolhasFeitas),
    pericias,
    errors,
  };
}
