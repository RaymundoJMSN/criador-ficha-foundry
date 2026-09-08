import { buildPericiaPlan, computeTrained, type PericiaPicks } from "../../rules/pericias.js";
import { getClasse } from "../../rules/classe.js";
import { toNomeSlug } from "../../compendium/slug.js";
import type { WizardState } from "../state.js";

export interface PericiaOpt {
  id: string;
  nome: string;
  checked: boolean;
  disabled?: boolean;
}

export interface ObrigGroup {
  groupIndex: number;
  quantidade: number;
  opcoes: PericiaOpt[];
}

export interface PericiaContext {
  /** O compêndio não trouxe a lista da classe; escolhe-se entre todas. */
  listaIncompleta: boolean;
  stepTitle: string;
  hasClasse: boolean;
  fixas: { id: string; nome: string }[];
  obrigatorias: ObrigGroup[];
  escolhasQtd: number;
  escolhasRestantes: number;
  escolhasOpcoes: PericiaOpt[];
  intBonus: number;
  intRestantes: number;
  intOpcoes: PericiaOpt[];
  racaBonus: number;
  racaRestantes: number;
  racaOpcoes: PericiaOpt[];
  /** Humano (Versátil): pode trocar uma das perícias por um poder geral. */
  versatilPossivel: boolean;
  versatilPoder: boolean;
  errors: string[];
}

export const PERICIA_NOMES: Record<string, string> = {
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

/** Atributo-chave de cada perícia (LB cap. 2, Tabela 2-1). */
export const PERICIA_ATRIBUTO: Record<string, string> = {
  acrobacia: "Des", adestramento: "Car", atletismo: "For", atuacao: "Car", cavalgar: "Des",
  conhecimento: "Int", cura: "Sab", diplomacia: "Car", enganacao: "Car", fortitude: "Con",
  furtividade: "Des", guerra: "Int", iniciativa: "Des", intimidacao: "Car", intuicao: "Sab",
  investigacao: "Int", jogatina: "Car", ladinagem: "Des", luta: "For", misticismo: "Int",
  nobreza: "Int", oficio: "Int", percepcao: "Sab", pilotagem: "Des", pontaria: "Des",
  reflexos: "Des", religiao: "Sab", sobrevivencia: "Sab", vontade: "Sab",
};

const nome = (id: string): string =>
  PERICIA_ATRIBUTO[id] ? `${PERICIA_NOMES[id] ?? id} (${PERICIA_ATRIBUTO[id]})` : (PERICIA_NOMES[id] ?? id);

function emptyContext(errors: string[]): PericiaContext {
  return {
    stepTitle: "Perícias",
    hasClasse: false,
    listaIncompleta: false,
    fixas: [],
    obrigatorias: [],
    escolhasQtd: 0,
    escolhasRestantes: 0,
    escolhasOpcoes: [],
    intBonus: 0,
    intRestantes: 0,
    racaRestantes: 0,
    versatilPossivel: false,
    versatilPoder: false,
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
/** Humano: "Versátil — pode trocar uma dessas perícias por um poder geral" (LB p.21). */
export function versatilPossivel(racaRef: string): boolean {
  return toNomeSlug(racaRef) === "humano";
}

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

  // Build the "already committed" set for each bucket so we can dedup across sublists.
  // Skills in fixas are always committed. Skills picked in one bucket should not appear
  // as available (unchecked) in other buckets.
  const porNome = <T extends { nome: string }>(lista: T[]): T[] =>
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const fixasSet = new Set(plan.fixas);
  const obrigPicksFlat = (picks.obrigatorias ?? []).flat();
  const escPicks = picks.escolhas ?? [];
  const intPicks = picks.extras_int ?? [];
  const racaPicks = picks.raca ?? [];

  // "Committed by others" — everything committed OUTSIDE a given bucket
  // For obrigatorias[i]: committed by fixas + other obrig groups + esc + int + raca
  // For esc: committed by fixas + obrigatorias + int + raca
  // For int: committed by fixas + obrigatorias + esc + raca
  // For raca: committed by fixas + obrigatorias + esc + int
  const committedByEsc = new Set([...fixasSet, ...obrigPicksFlat, ...intPicks, ...racaPicks]);
  const committedByInt = new Set([...fixasSet, ...obrigPicksFlat, ...escPicks, ...racaPicks]);
  const committedByRaca = new Set([...fixasSet, ...obrigPicksFlat, ...escPicks, ...intPicks]);

  const obrigatorias: ObrigGroup[] = plan.obrigatorias.map((g, i) => {
    // For obrig[i], committed by others = fixas + other obrig groups + esc + int + raca
    const otherObrigPicks = (picks.obrigatorias ?? [])
      .flatMap((arr, j) => (j !== i ? arr ?? [] : []));
    const committedByObrig = new Set([
      ...fixasSet,
      ...otherObrigPicks,
      ...escPicks,
      ...intPicks,
      ...racaPicks,
    ]);
    return {
      groupIndex: i,
      quantidade: g.quantidade,
      opcoes: porNome(
        g.opcoes.map((id) => ({
          id,
          nome: nome(id),
          checked: (picks.obrigatorias[i] ?? []).includes(id),
          // Disable if committed by another bucket (but not this one's own picks)
          disabled: committedByObrig.has(id) && !(picks.obrigatorias[i] ?? []).includes(id),
        }))
      ),
    };
  });

  const escolhasOpcoes: PericiaOpt[] = porNome(
    plan.escolhas.opcoes.map((id) => ({
      id,
      nome: nome(id),
      checked: escPicks.includes(id),
      disabled: committedByEsc.has(id) && !escPicks.includes(id),
    }))
  );

  const todasOpcoes = (selected: string[], committedByOthers: Set<string>): PericiaOpt[] =>
    porNome(
      plan.todas.map((id) => ({
        id,
        nome: nome(id),
        checked: selected.includes(id),
        disabled: committedByOthers.has(id) && !selected.includes(id),
      }))
    );

  return {
    stepTitle: "Perícias",
    hasClasse: true,
    listaIncompleta: Boolean(
      (classe.pericias as { listaIncompleta?: boolean }).listaIncompleta
    ),
    fixas: plan.fixas.map((id) => ({ id, nome: nome(id) })),
    obrigatorias,
    escolhasQtd: plan.escolhas.quantidade,
    escolhasRestantes: Math.max(0, plan.escolhas.quantidade - escPicks.length),
    escolhasOpcoes,
    intBonus: plan.intBonus,
    intRestantes: Math.max(0, plan.intBonus - intPicks.length),
    intOpcoes: plan.intBonus > 0 ? todasOpcoes(intPicks, committedByInt) : [],
    racaBonus: plan.racaBonus,
    racaRestantes: Math.max(0, plan.racaBonus - racaPicks.length),
    racaOpcoes: plan.racaBonus > 0 ? todasOpcoes(racaPicks, committedByRaca) : [],
    versatilPossivel: versatilPossivel(state.racaNome || state.racaId),
    versatilPoder: Boolean(state.escolhasPorItem["versatil_poder"]),
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
