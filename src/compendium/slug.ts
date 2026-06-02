/**
 * Mirrors the slug normalization in T20-DB/scripts/sync_*_foundry.py.
 * Used to match prereq IDs in data/prereqs.json against item names from packs.
 */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanum → hyphen
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens
}

export function namesMatch(a: string, b: string): boolean {
  return toSlug(a) === toSlug(b);
}

/** Normalize Foundry display name → T20-DB slug key (lowercase, NFD strip accents, spaces→underscore). */
export function toNomeSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
