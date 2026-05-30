import { CHARACTER_TYPE } from "../constants.js";
import type { WizardState } from "../wizard/state.js";
import { toPericiaCode } from "../rules/pericia-slug.js";
import { getOrigem } from "../rules/origem.js";
import { getDivindade } from "../rules/divindade.js";

/** Output shape consumed by Actor.create() for tormenta20 system. */
export interface ActorCreateData {
  name: string;
  type: "character";
  system: {
    atributos: Record<"for" | "des" | "con" | "int" | "sab" | "car", { base: number }>;
    attributes: {
      nivel: { value: number };
    };
    detalhes: {
      raca: string;
      origem: string;
      divindade: string;
    };
    dinheiro: {
      tc: number;
      tl: number;
      to: number;
      tp: number;
    };
    /** Trained skills keyed by Foundry 4-letter code → { treinado: true }. */
    pericias: Record<string, { treinado: true }>;
  };
  items: unknown[];
}

/**
 * Converts WizardState into the data shape expected by tormenta20 Actor.create().
 * Items array is injected separately by writer.ts after resolving from packs.
 */
export function mapStateToActorData(state: WizardState, items: unknown[] = []): ActorCreateData {
  const atributos = {} as ActorCreateData["system"]["atributos"];
  for (const attr of ["for", "des", "con", "int", "sab", "car"] as const) {
    atributos[attr] = { base: state.atributosBase[attr] ?? 0 };
  }

  // Trained perícias: translate T20-DB slugs → Foundry codes, drop unmappable.
  const pericias: Record<string, { treinado: true }> = {};
  for (const slug of state.periciasTreinadas) {
    const code = toPericiaCode(slug);
    if (code) pericias[code] = { treinado: true };
  }

  // Origem/Divindade are stored as TEXT names in tormenta20 (not ids).
  const origemNome = state.origemId
    ? (getOrigem(state.origemId)?.nome ?? state.origemId)
    : "";
  const divindadeNome = state.divindadeId
    ? (getDivindade(state.divindadeId)?.nome ?? state.divindadeId)
    : "";

  return {
    name: state.nome || "Novo Personagem",
    type: CHARACTER_TYPE,
    system: {
      atributos,
      attributes: {
        nivel: { value: state.nivel },
      },
      detalhes: {
        raca: state.racaNome || state.racaId,
        origem: origemNome,
        divindade: divindadeNome,
      },
      dinheiro: {
        tc: 0,
        tl: state.dinheiroRestante,
        to: 0,
        tp: 0,
      },
      pericias,
    },
    items,
  };
}
