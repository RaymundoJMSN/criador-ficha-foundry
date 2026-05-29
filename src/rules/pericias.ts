import type { IndexedClasse } from "../compendium/types.js";

export function countTreinaveis(
  classe: IndexedClasse,
  intModifier: number,
  racialBonus: number
): number {
  const base = classe.system.pericias?.numero ?? 0;
  const fromInt = Math.max(0, intModifier);
  return base + fromInt + racialBonus;
}

export interface PericiaSet {
  inatas: string[];
  treinadas: string[];
  choicesRemaining: number;
}

export function buildPericiaSet(
  classe: IndexedClasse,
  escolhidas: string[],
  extras: string[]
): PericiaSet {
  const inatas = classe.system.pericias?.inatas ?? [];
  const treinadas = Array.from(new Set([...inatas, ...escolhidas, ...extras]));
  const needed = classe.system.pericias?.numero ?? 0;
  const choicesRemaining = Math.max(0, needed - escolhidas.length);
  return { inatas, treinadas, choicesRemaining };
}

export function isInata(classe: IndexedClasse, periciaId: string): boolean {
  return (classe.system.pericias?.inatas ?? []).includes(periciaId);
}
