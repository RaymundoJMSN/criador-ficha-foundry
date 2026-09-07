/**
 * Sub-choice resolver (F2 — sub-escolhas core).
 *
 * Currently implements: **race choosable attribute modifiers** (humano +1 in
 * three different attributes, mashin/sereia +1 in N, etc.). Ported from
 * T20-DB motor/construtor.py::_validar_modificadores (L1394), adapted to the
 * ported racas.json shape (`atributos_escolha[]`).
 *
 * Still stubbed (see ROADMAP F2/F3): class multipath, origin pick-2 writer,
 * sorcerer lineage, specialist school, familiar, duende/golem constructor.
 */
import { getRaca, getRaceFixedModifiers, type AtributoEscolhaDef } from "./raca.js";

export type AtributoId = "for" | "des" | "con" | "int" | "sab" | "car";
const ATRS: readonly AtributoId[] = ["for", "des", "con", "int", "sab", "car"];

/** Choosable attribute-modifier groups a race offers (empty when none). */
export function getRaceModifierGroups(idOrName: string): AtributoEscolhaDef[] {
  return getRaca(idOrName)?.atributos_escolha ?? [];
}

export interface ModifierValidation {
  modificadores: Partial<Record<AtributoId, number>>;
  errors: string[];
}

/**
 * Validate the player's choices for a race's choosable attribute modifiers.
 * `choices[i]` is the list of attribute codes picked for group `i`.
 * Returns the resulting per-attribute bonuses (only the *choosable* part —
 * fixed racial bonuses come from the Foundry race item) and any errors.
 */
export function validateRaceModifiers(
  idOrName: string,
  choices: string[][]
): ModifierValidation {
  const groups = getRaceModifierGroups(idOrName);
  const errors: string[] = [];
  const modificadores: Partial<Record<AtributoId, number>> = {};

  if (groups.length === 0) {
    return { modificadores, errors };
  }

  if (choices.length < groups.length) {
    errors.push(
      `requer ${groups.length} grupo(s) de escolhas (recebido ${choices.length})`
    );
    return { modificadores, errors };
  }

  groups.forEach((def, i) => {
    const qtd = def.quantidade ?? 1;
    const valor = def.valor ?? 1;
    const disponiveis = (def.atributos_disponiveis ?? [...ATRS]) as string[];
    const diferentes = Boolean(def.atributos_diferentes);
    const escolhidos = choices[i] ?? [];

    if (escolhidos.length !== qtd) {
      errors.push(`grupo ${i}: esperado ${qtd} atributo(s), recebido ${escolhidos.length}`);
      return;
    }
    if (diferentes && new Set(escolhidos).size !== escolhidos.length) {
      errors.push(`grupo ${i}: atributos devem ser diferentes`);
      return;
    }
    for (const atr of escolhidos) {
      if (!disponiveis.includes(atr) || !ATRS.includes(atr as AtributoId)) {
        errors.push(`grupo ${i}: atributo inválido "${atr}"`);
        continue;
      }
      const key = atr as AtributoId;
      modificadores[key] = (modificadores[key] ?? 0) + valor;
    }
  });

  if (errors.length > 0) {
    return { modificadores: {}, errors };
  }
  return { modificadores, errors };
}

/**
 * Total racial attribute modifiers = fixed + validated choosable.
 * Used to compute FINAL attributes (base + this) for downstream rules like
 * the Int-based perícia bonus.
 */
export function getRaceAttributeTotals(
  idOrName: string,
  choices: string[][],
  /** Raças Abertas: distribuição dos modificadores fixos (índice do valor → atributo). */
  aberta?: Record<string, string>
): Partial<Record<AtributoId, number>> {
  const out: Partial<Record<AtributoId, number>> = {};
  const fixed = aberta ? distribuirAbertos(idOrName, aberta).modificadores : getRaceFixedModifiers(idOrName);
  for (const [k, v] of Object.entries(fixed)) {
    if (ATRS.includes(k as AtributoId)) out[k as AtributoId] = (out[k as AtributoId] ?? 0) + (v ?? 0);
  }
  const { modificadores } = validateRaceModifiers(idOrName, choices);
  for (const k of ATRS) {
    if (modificadores[k]) out[k] = (out[k] ?? 0) + (modificadores[k] ?? 0);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Raças Abertas (HA p.281)                                           */
/* ------------------------------------------------------------------ */

/** Os modificadores fixos da raça como lista de valores ("+2, +1 e –1" do anão), do maior ao menor. */
export function valoresFixosDaRaca(idOrName: string): number[] {
  return Object.values(getRaceFixedModifiers(idOrName))
    .filter((v): v is number => typeof v === "number" && v !== 0)
    .sort((a, b) => b - a);
}

/**
 * "Você pode usar cada modificador de atributo de sua raça em qualquer
 * atributo. Você não pode aplicar mais de um modificador no mesmo atributo."
 * `dist[i]` = atributo que recebe o i-ésimo valor.
 */
export function distribuirAbertos(
  idOrName: string,
  dist: Record<string, string>
): { modificadores: Partial<Record<AtributoId, number>>; completo: boolean; erros: string[] } {
  const valores = valoresFixosDaRaca(idOrName);
  const modificadores: Partial<Record<AtributoId, number>> = {};
  const erros: string[] = [];
  const usados = new Set<string>();
  let faltam = 0;
  valores.forEach((v, i) => {
    const a = dist[String(i)];
    if (!a || !ATRS.includes(a as AtributoId)) {
      faltam++;
      return;
    }
    if (usados.has(a)) {
      erros.push("Não pode aplicar mais de um modificador no mesmo atributo.");
      return;
    }
    usados.add(a);
    modificadores[a as AtributoId] = v;
  });
  if (faltam) erros.push(`Distribua os modificadores da raça (faltam ${faltam}).`);
  return { modificadores, completo: erros.length === 0, erros };
}

/** Total racial a partir do estado do wizard — respeita Raças Abertas quando ligada. */
export function totaisRaciaisDoEstado(s: {
  racaNome?: string;
  racaId?: string;
  escolhasPorItem: Record<string, unknown>;
  config: { racasAbertas: boolean };
}): Partial<Record<AtributoId, number>> {
  const ref = s.racaNome || s.racaId || "";
  const choices = (s.escolhasPorItem["raca_modificadores"] as string[][] | undefined) ?? [];
  const aberta = s.config.racasAbertas ? ((s.escolhasPorItem["raca_aberta"] as Record<string, string> | undefined) ?? {}) : undefined;
  return getRaceAttributeTotals(ref, choices, aberta);
}
