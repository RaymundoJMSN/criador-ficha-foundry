import { CHARACTER_TYPE } from "../constants.js";
import type { WizardState } from "../wizard/state.js";
import { toPericiaCode } from "../rules/pericia-slug.js";
import { getOrigem, validarBeneficios } from "../rules/origem.js";
import { getDivindade } from "../rules/divindade.js";
import { validateRaceModifiers } from "../rules/subescolhas.js";
import { getClasse } from "../rules/classe.js";
import {
  getRaceSkillBonus,
  getRaceFixedModifiers,
  periciasDeEscolhasRaciais,
} from "../rules/raca.js";
import { buildPericiaPlan, computeTrained, type PericiaPicks } from "../rules/pericias.js";

/** Output shape consumed by Actor.create() for tormenta20 system. */
export interface ActorCreateData {
  name: string;
  type: "character";
  system: {
    atributos: Record<"for" | "des" | "con" | "int" | "sab" | "car", { base: number }>;
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
 *
 * NOTE: pericias are NOT included here — they must be applied via actor.update()
 * after the actor is fully initialized so that the system schema sets correct
 * atributo values (not all "for").
 *
 * NOTE: `nivel` is NOT included here either. The system derives it from
 * sum(classe items .system.niveis) (`tormenta20.mjs:7711` — `get nivel()`) and
 * rewrites `system.attributes.nivel.value` on every classe item update. Writing it
 * straight would show the right number until the first update and compute PV/PM
 * from niveis=1 the whole time. writer.ts sets `niveis` on the classe item instead.
 */
export function mapStateToActorData(
  state: WizardState,
  items: unknown[] = [],
  dinheiroRestante: number = state.dinheiroRestante
): ActorCreateData {
  // Só a base vai aqui. Modificador racial (fixo E escolhido, ex. humano +1×3)
  // entra pelo item de raça: o writer soma a escolha em `system.atributos` do
  // item e o sistema grava tudo em `.racial` ao embutir (`_onCreateOwnedRace`).
  // Somar a escolha na base dobrava o bônus quando o diálogo do sistema abria.
  const atributos = {} as ActorCreateData["system"]["atributos"];
  for (const attr of ["for", "des", "con", "int", "sab", "car"] as const) {
    atributos[attr] = { base: state.atributosBase[attr] ?? 0 };
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
      detalhes: {
        raca: state.racaNome || state.racaId,
        origem: origemNome,
        divindade: divindadeNome,
      },
      // O saldo é derivado (inicial da tabela/rolagem − carrinho) na hora de
      // gravar. T$ (Tibar, prata) é o campo `tp` — `tl` é platina, escondida
      // na ficha por padrão; gravar lá deixava o personagem "sem dinheiro".
      dinheiro: {
        tc: 0,
        tl: 0,
        to: 0,
        tp: dinheiroRestante,
      },
    },
    items,
  };
}

/**
 * Computes the list of trained perícia codes (4-letter Foundry codes) for the
 * given state. Used by writer.ts to call actor.update() after all items are embedded,
 * so the system schema has already set correct atributo for each perícia.
 */
export function getTrainedPericaCodes(state: WizardState): Record<string, true> {
  const racaRef = state.racaNome || state.racaId;
  const choices = (state.escolhasPorItem["raca_modificadores"] as string[][] | undefined) ?? [];
  const { modificadores } = validateRaceModifiers(racaRef, choices);

  const classe = state.classeNome ? getClasse(state.classeNome) : null;
  const picks = state.escolhasPorItem["pericias"] as PericiaPicks | undefined;
  let trainedSlugs: string[];
  if (classe && picks) {
    const fixedInt = getRaceFixedModifiers(racaRef)["int"] ?? 0;
    const intFinal = (state.atributosBase.int ?? 0) + fixedInt + (modificadores["int"] ?? 0);
    const plan = buildPericiaPlan(classe, intFinal, getRaceSkillBonus(racaRef));
    trainedSlugs = computeTrained(plan, picks).trained;
  } else {
    trainedSlugs = state.periciasTreinadas;
  }
  // Perícias vindas dos benefícios de origem (nunca chegavam na ficha antes).
  const beneficiosOrigem = state.origemId
    ? validarBeneficios(
        state.origemId,
        (state.escolhasPorItem["origem_beneficios"] as string[]) ?? []
      ).pericias
    : [];

  const daRaca = periciasDeEscolhasRaciais(racaRef, state.escolhasPorItem).treinadas;

  const result: Record<string, true> = {};
  for (const slug of [...trainedSlugs, ...beneficiosOrigem, ...daRaca]) {
    const code = toPericiaCode(slug);
    if (code) result[code] = true;
  }
  return result;
}
