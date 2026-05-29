import { createRequire } from "module";
const require = createRequire(import.meta.url);
const prereqsData = require("../data/prereqs.json") as Record<string, Record<string, unknown>[]>;

type Prereq = Record<string, unknown>;

export interface PrereqCheckResult {
  eligible: boolean;
  unmet: Prereq[];
}

export interface PartialWizardState {
  nivel: number;
  atributosBase: Record<string, number>;
  classeId: string;
  racaId: string;
  periciasTreinadas: string[];
  poderes: string[];
}

export function checkPrereqs(prereqs: Prereq[], state: PartialWizardState): PrereqCheckResult {
  const unmet: Prereq[] = [];

  for (const req of prereqs) {
    let met = true;

    switch (req["tipo"]) {
      case "atributo": {
        const attr = req["atributo"] as string;
        const needed = req["valor"] as number;
        const have = state.atributosBase[attr] ?? 0;
        met = have >= needed;
        break;
      }
      case "nivel": {
        met = state.nivel >= (req["valor"] as number);
        break;
      }
      case "poder": {
        const poderSlug = req["poder"] as string;
        met = state.poderes.includes(poderSlug);
        break;
      }
      case "classe": {
        met = state.classeId === (req["classe"] as string);
        break;
      }
      case "raca": {
        met = state.racaId === (req["raca"] as string);
        break;
      }
      case "pericias": {
        const pericia = req["pericia"] as string;
        met = state.periciasTreinadas.includes(pericia);
        break;
      }
      case "bab":
      default:
        met = true;
        break;
    }

    if (!met) unmet.push(req);
  }

  return { eligible: unmet.length === 0, unmet };
}

export function isEligible(poderSlug: string, state: PartialWizardState): boolean {
  const prereqs = prereqsData[poderSlug];
  if (!prereqs) return true;
  return checkPrereqs(prereqs, state).eligible;
}
