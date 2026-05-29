import type { IndexedMagia } from "../compendium/types.js";

const CONJURADORES = new Set(["arcanista", "bardo", "clerigo", "druida", "paladino", "xama"]);

const CLASSE_TIPO_MAGIA: Record<string, ("arc" | "div")[]> = {
  arcanista: ["arc"],
  bardo: ["arc"],
  clerigo: ["div"],
  druida: ["div"],
  paladino: ["div"],
  xama: ["div"],
};

// Level thresholds that unlock each circle (index 0 = circle 1)
const CIRCLE_UNLOCK_LEVELS = [1, 5, 9, 13, 17];

export function isConjurador(classeId: string): boolean {
  return CONJURADORES.has(classeId);
}

export function getCirculosDesbloqueados(classeId: string, nivel: number): number[] {
  if (!isConjurador(classeId)) return [];
  return CIRCLE_UNLOCK_LEVELS.map((threshold, i) => ({ circle: i + 1, threshold }))
    .filter(({ threshold }) => nivel >= threshold)
    .map(({ circle }) => circle);
}

export function filterMagias(
  magias: IndexedMagia[],
  classeId: string,
  nivel: number
): IndexedMagia[] {
  const circles = new Set(getCirculosDesbloqueados(classeId, nivel));
  const tipos = new Set<string>(CLASSE_TIPO_MAGIA[classeId] ?? []);

  return magias.filter(
    (m) =>
      m.system.circulo !== undefined &&
      circles.has(m.system.circulo) &&
      (!m.system.tipo || tipos.has(m.system.tipo))
  );
}
