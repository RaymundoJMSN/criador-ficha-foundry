/**
 * Perícia rules — canonical T20-DB model (ported from
 * construtor.py::_aplicar_pericias / _pericias_spec).
 *
 * The Foundry classe item carries NO perícia rules. Everything comes from the
 * class spec in classes.json:
 *   - fixas:                auto-trained, locked (no pick)
 *   - escolhas_obrigatorias: pick `quantidade` per group, from `opcoes`
 *   - escolhas:             pick `quantidade` from the class `opcoes`
 *   - extras por Int:       pick up to max(0, Int FINAL) from ANY skill
 *   - raça (Versátil etc.): pick `racaBonus` from ANY skill
 */
import type { ClasseData } from "./classe.js";
import { PERICIA_SLUGS } from "./pericia-slug.js";

export interface PericiaPlan {
  fixas: string[];
  obrigatorias: { quantidade: number; opcoes: string[] }[];
  escolhas: { quantidade: number; opcoes: string[] };
  intBonus: number;
  racaBonus: number;
  todas: string[];
}

export interface PericiaPicks {
  obrigatorias: string[][];
  escolhas: string[];
  extras_int: string[];
  raca: string[];
}

/**
 * @param intFinal  final Int attribute value (base + racial), NOT base only.
 * @param racaBonus number of "any skill" the race grants (e.g. humano +2).
 */
export function buildPericiaPlan(
  classe: ClasseData,
  intFinal: number,
  racaBonus: number
): PericiaPlan {
  const spec = classe.pericias;
  return {
    fixas: [...spec.fixas],
    obrigatorias: spec.escolhas_obrigatorias.map((g) => ({
      quantidade: g.quantidade,
      opcoes: [...g.opcoes],
    })),
    escolhas: { quantidade: spec.escolhas.quantidade, opcoes: [...spec.escolhas.opcoes] },
    intBonus: Math.max(0, intFinal),
    racaBonus,
    todas: [...PERICIA_SLUGS],
  };
}

export interface TrainedResult {
  trained: string[];
  errors: string[];
}

/**
 * Validate the player's perícia picks against the plan and return the full
 * trained set (fixas ∪ obrigatórias ∪ escolhas ∪ Int extras ∪ raça).
 */
export function computeTrained(plan: PericiaPlan, picks: PericiaPicks): TrainedResult {
  const errors: string[] = [];
  const trained = new Set<string>(plan.fixas);

  // Obligatory groups
  plan.obrigatorias.forEach((grupo, i) => {
    const pick = picks.obrigatorias[i] ?? [];
    if (pick.length < grupo.quantidade) {
      errors.push(`obrigatória ${i}: escolha ${grupo.quantidade} entre ${grupo.opcoes.join("/")}`);
      return;
    }
    for (const p of pick.slice(0, grupo.quantidade)) {
      if (!grupo.opcoes.includes(p)) {
        errors.push(`obrigatória ${i}: "${p}" fora da lista`);
        continue;
      }
      trained.add(p);
    }
  });

  // Free choices from the class list
  const esc = picks.escolhas ?? [];
  const fora = esc.filter((p) => !plan.escolhas.opcoes.includes(p));
  if (fora.length > 0) {
    errors.push(`escolhas fora da lista da classe: ${fora.join(", ")}`);
  } else if (esc.length > plan.escolhas.quantidade) {
    errors.push(`escolhas: máximo ${plan.escolhas.quantidade}, recebeu ${esc.length}`);
  } else if (esc.length < plan.escolhas.quantidade) {
    errors.push(`escolhas: requer ${plan.escolhas.quantidade} da lista da classe`);
  } else {
    esc.forEach((p) => trained.add(p));
  }

  // Int extras — any skill
  const int = picks.extras_int ?? [];
  const intInvalid = int.filter((p) => !plan.todas.includes(p));
  if (intInvalid.length > 0) {
    errors.push(`extras de Int desconhecidas: ${intInvalid.join(", ")}`);
  } else if (int.length > plan.intBonus) {
    errors.push(`extras de Int: máximo ${plan.intBonus}, recebeu ${int.length}`);
  } else {
    int.forEach((p) => trained.add(p));
  }

  // Race extras — any skill
  const raca = picks.raca ?? [];
  const racaInvalid = raca.filter((p) => !plan.todas.includes(p));
  if (racaInvalid.length > 0) {
    errors.push(`perícias de raça desconhecidas: ${racaInvalid.join(", ")}`);
  } else if (raca.length > plan.racaBonus) {
    errors.push(`perícias de raça: máximo ${plan.racaBonus}, recebeu ${raca.length}`);
  } else {
    raca.forEach((p) => trained.add(p));
  }

  return { trained: [...trained], errors };
}
