import progressaoDataRaw from "../data/progressao_classes.json";
const progressaoData = progressaoDataRaw as unknown as Record<
  string,
  {
    pv_por_nivel: number;
    pm_por_nivel: number;
    pericias_inatas: string[];
    pericias_escolha: string[];
    pericias_numero: number;
  }
>;

/**
 * Normalize a pericia field that may be string, array, null, or object.
 * Handles: "misticismo vontade", "misticismo,vontade", ["misticismo"], {misticismo: true}
 */
export function normalizePericias(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(String).filter((s) => s.trim().length > 0);
  }
  if (typeof value === "string") {
    // Split on comma, semicolon, or whitespace
    return value
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (typeof value === "object") {
    // {misticismo: true, vontade: true} or {misticismo: 1}
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v === true || v === 1)
      .map(([k]) => k);
  }
  return [];
}

export interface ClasseProgressao {
  pericias_inatas: string[];
  pericias_escolha: string[];
  pericias_numero: number;
  pv_por_nivel: number;
  pm_por_nivel: number;
}

/**
 * Get class pericias from T20-DB data by matching classe name.
 * Returns null if no match found.
 */
export function getClasseProgressao(classeNome: string): ClasseProgressao | null {
  // Slug the name: lowercase, remove diacritics, spaces→underscores
  const slug = classeNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // Direct match
  if (slug in progressaoData) return progressaoData[slug];

  // Partial match (handle "Arcanista — Bruxo" → "arcanista")
  for (const [key, val] of Object.entries(progressaoData)) {
    if (slug.startsWith(key) || key.startsWith(slug)) return val;
  }

  return null;
}
