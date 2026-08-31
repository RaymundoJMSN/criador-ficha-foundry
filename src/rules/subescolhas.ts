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
  choices: string[][]
): Partial<Record<AtributoId, number>> {
  const out: Partial<Record<AtributoId, number>> = {};
  const fixed = getRaceFixedModifiers(idOrName);
  for (const [k, v] of Object.entries(fixed)) {
    if (ATRS.includes(k as AtributoId)) out[k as AtributoId] = (out[k as AtributoId] ?? 0) + (v ?? 0);
  }
  const { modificadores } = validateRaceModifiers(idOrName, choices);
  for (const k of ATRS) {
    if (modificadores[k]) out[k] = (out[k] ?? 0) + (modificadores[k] ?? 0);
  }
  return out;
}
