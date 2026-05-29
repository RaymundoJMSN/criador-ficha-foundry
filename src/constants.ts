export const MODULE_ID = "t20-ficha-wizard";
export const SYSTEM_ID = "tormenta20";
export const CHARACTER_TYPE = "character";

export const ITEM_TYPES = {
  RACE: "race",
  CLASSE: "classe",
  PODER: "poder",
  MAGIA: "magia",
  EQUIPAMENTO: "equipamento",
  ARMA: "arma",
  CONSUMIVEL: "consumivel",
  TESOURO: "tesouro",
} as const;

export type ItemType = (typeof ITEM_TYPES)[keyof typeof ITEM_TYPES];

/**
 * Additional module ids for index prioritization when same-name items exist.
 * Never used as an exclusive filter — all packs are indexed regardless.
 */
export const EXTRA_MODULE_IDS: string[] = [];
