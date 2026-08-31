import type { IndexedMagia } from "../compendium/types.js";
import { circuloMaximo } from "./progressao.js";

const CONJURADORES = new Set(["arcanista", "bardo", "clerigo", "druida", "paladino", "xama"]);

const CLASSE_TIPO_MAGIA: Record<string, ("arc" | "div")[]> = {
  arcanista: ["arc"],
  bardo: ["arc"],
  clerigo: ["div"],
  druida: ["div"],
  paladino: ["div"],
  xama: ["div"],
};

export function isConjurador(classeId: string): boolean {
  return CONJURADORES.has(classeId);
}

/**
 * Circles a caster of this level can cast. The unlock levels are per class
 * (arcanista 1/5/9/13/17, bardo 1/6/10/14, clérigo 1/5/9/13/17), so they come
 * from the class progression table — a single shared threshold list gave the
 * bardo the 2nd circle a level early. Paladino has no table: it only ever gets
 * 1st-circle spells, and through a power rather than the class.
 */
export function getCirculosDesbloqueados(classeId: string, nivel: number): number[] {
  if (!isConjurador(classeId)) return [];
  const max = Math.max(1, circuloMaximo(classeId, nivel));
  return Array.from({ length: max }, (_, i) => i + 1);
}

export function filterMagias(
  magias: IndexedMagia[],
  classeId: string,
  nivel: number
): IndexedMagia[] {
  const circles = new Set(getCirculosDesbloqueados(classeId, nivel));
  const tipos = new Set<string>(CLASSE_TIPO_MAGIA[classeId] ?? []);

  return magias.filter((m) => {
    // Coerce circulo to number — getIndex may return string from Foundry
    const circulo = Number(m.system.circulo);
    if (!circulo || !circles.has(circulo)) return false;
    // Only filter by tipo if class has restriction AND item has an explicit tipo set
    if (tipos.size > 0 && m.system.tipo && !tipos.has(m.system.tipo)) return false;
    return true;
  });
}
