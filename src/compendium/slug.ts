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

/**
 * Normalize Foundry display name → T20-DB slug key (lowercase, no accents, `_` separators).
 *
 * Toda sequência não-alfanumérica vira UM `_`, inclusive hífen e barra colados a letra.
 * Só remover a pontuação grudava as palavras e quebrava o casamento:
 * "Obra-Prima" → `obraprima` (T20-DB usa `obra_prima`),
 * "Magia Sagrada/Profana" → `magia_sagradaprofana` (T20-DB usa `magia_sagrada_profana`).
 */
export function toNomeSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
