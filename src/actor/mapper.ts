import { CHARACTER_TYPE } from "../constants.js";
import type { WizardState } from "../wizard/state.js";

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

  return {
    name: state.nome || "Novo Personagem",
    type: CHARACTER_TYPE,
    system: {
      atributos,
      attributes: {
        nivel: { value: state.nivel },
      },
      detalhes: {
        raca: state.racaId,
        origem: state.origemId,
        divindade: state.divindadeId ?? "",
      },
      dinheiro: {
        tc: 0,
        tl: state.dinheiroRestante,
        to: 0,
        tp: 0,
      },
    },
    items,
  };
}
