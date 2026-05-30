import prereqsDataRaw from "../data/prereqs.json";
const prereqsData = prereqsDataRaw as unknown as Record<string, Record<string, unknown>[]>;

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

const ATTR_LABEL: Record<string, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-readable PT label for one structured prerequisite. */
export function formatPrereq(req: Prereq): string {
  switch (req["tipo"]) {
    case "atributo":
      return `${ATTR_LABEL[req["atributo"] as string] ?? req["atributo"]} ${req["valor"]}`;
    case "nivel":
      return `Nível ${req["valor"]}`;
    case "poder":
      return `Poder: ${titleCase(String(req["poder"]))}`;
    case "pericias":
      return `Treinado em ${titleCase(String(req["pericia"]))}`;
    case "classe":
      return `Classe: ${titleCase(String(req["classe"]))}`;
    case "raca":
      return `Raça: ${titleCase(String(req["raca"]))}`;
    default:
      return "Pré-requisito especial";
  }
}

/** List of unmet prerequisites for a power, as readable PT strings (empty if eligible). */
export function describeUnmet(poderSlug: string, state: PartialWizardState): string[] {
  const prereqs = prereqsData[poderSlug];
  if (!prereqs) return [];
  return checkPrereqs(prereqs, state).unmet.map(formatPrereq);
}
