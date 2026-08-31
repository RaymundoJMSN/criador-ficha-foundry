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

/** Slug → nome de tela; a mensagem de erro é lida por jogador, não por dev. */
function nomeDePericia(slug: string): string {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function listaLegivel(slugs: string[]): string {
  const nomes = slugs.map(nomeDePericia);
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} ou ${nomes[nomes.length - 1]}`;
}

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
      errors.push(
        `Escolha ${grupo.quantidade} entre ${listaLegivel(grupo.opcoes)}.`
      );
      return;
    }
    for (const p of pick.slice(0, grupo.quantidade)) {
      if (!grupo.opcoes.includes(p)) {
        errors.push(`"${nomeDePericia(p)}" não está na lista da classe.`);
        continue;
      }
      trained.add(p);
    }
  });

  // Free choices from the class list
  const esc = picks.escolhas ?? [];
  const fora = esc.filter((p) => !plan.escolhas.opcoes.includes(p));
  if (fora.length > 0) {
    errors.push(`Fora da lista da classe: ${fora.map(nomeDePericia).join(", ")}.`);
  } else if (esc.length > plan.escolhas.quantidade) {
    errors.push(
      `Perícias da classe: escolha ${plan.escolhas.quantidade} (marcou ${esc.length}).`
    );
  } else if (esc.length < plan.escolhas.quantidade) {
    errors.push(
      `Perícias da classe: faltam ${plan.escolhas.quantidade - esc.length} de ${plan.escolhas.quantidade}.`
    );
  } else {
    esc.forEach((p) => trained.add(p));
  }

  // Int extras — any skill
  const int = picks.extras_int ?? [];
  const intInvalid = int.filter((p) => !plan.todas.includes(p));
  if (intInvalid.length > 0) {
    errors.push(`Perícia desconhecida em Inteligência: ${intInvalid.join(", ")}.`);
  } else if (int.length > plan.intBonus) {
    errors.push(`Perícias por Inteligência: no máximo ${plan.intBonus} (marcou ${int.length}).`);
  } else {
    int.forEach((p) => trained.add(p));
  }

  // Race extras — any skill
  const raca = picks.raca ?? [];
  const racaInvalid = raca.filter((p) => !plan.todas.includes(p));
  if (racaInvalid.length > 0) {
    errors.push(`Perícia de raça desconhecida: ${racaInvalid.join(", ")}.`);
  } else if (raca.length > plan.racaBonus) {
    errors.push(`Perícias de raça: no máximo ${plan.racaBonus} (marcou ${raca.length}).`);
  } else {
    raca.forEach((p) => trained.add(p));
  }

  return { trained: [...trained], errors };
}
