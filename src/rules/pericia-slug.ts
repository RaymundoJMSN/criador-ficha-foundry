/**
 * Maps T20-DB full perícia slugs (e.g. "fortitude") to the Foundry
 * `tormenta20` system's 4-letter perícia codes (e.g. "fort").
 *
 * The system stores trained skills at `system.pericias.{code}.treinado`.
 * Our ported data (progressao_classes.json, racas.json, origens.json) uses the
 * full slug form, so every write to the actor must translate through here.
 *
 * Verified against tormenta20.mjs `T20.pericias` (v1.5.015).
 * Note: "Ofício" has no single code in the system (it explodes into
 * alfa/alqu/arme/... crafting skills), so "oficio" maps to null and is skipped.
 */

const SLUG_TO_CODE: Record<string, string> = {
  acrobacia: "acro",
  adestramento: "ades",
  atletismo: "atle",
  atuacao: "atua",
  cavalgar: "cava",
  conhecimento: "conh",
  cura: "cura",
  diplomacia: "dipl",
  enganacao: "enga",
  fortitude: "fort",
  furtividade: "furt",
  guerra: "guer",
  iniciativa: "inic",
  intimidacao: "inti",
  intuicao: "intu",
  investigacao: "inve",
  jogatina: "joga",
  ladinagem: "ladi",
  luta: "luta",
  misticismo: "mist",
  nobreza: "nobr",
  percepcao: "perc",
  pilotagem: "pilo",
  pontaria: "pont",
  reflexos: "refl",
  religiao: "reli",
  sobrevivencia: "sobr",
  vontade: "vont",
};

/** All 28 core Foundry perícia codes. */
export const PERICIA_CODES: string[] = Object.values(SLUG_TO_CODE);

/** All 28 core perícia full slugs (T20-DB ids). */
export const PERICIA_SLUGS: string[] = Object.keys(SLUG_TO_CODE);

const CODE_SET = new Set(PERICIA_CODES);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Translate a perícia identifier (full slug, accented name, or already-valid
 * 4-letter code) into the Foundry system code. Returns null when unmappable.
 */
export function toPericiaCode(identifier: string): string | null {
  const norm = normalize(identifier);
  if (CODE_SET.has(norm)) return norm;
  return SLUG_TO_CODE[norm] ?? null;
}
