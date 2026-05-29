import atributosData from "../data/atributos.json";

/** Point buy cost table: attribute value → point cost. */
const COST_TABLE: Record<number, number> = {};
for (const entry of atributosData.compra_pontos.tabela_custo) {
  if (entry.custo !== null) {
    COST_TABLE[entry.valor] = entry.custo;
  }
}

export const POINT_BUY_INITIAL_POINTS = atributosData.compra_pontos.pontos_iniciais;

/**
 * Returns the point cost for a single attribute value in the point buy system.
 * Throws if the value is not purchasable (e.g. -2, or > 4).
 */
export function pointBuyCost(value: number): number {
  if (!(value in COST_TABLE)) {
    throw new RangeError(`Valor de atributo ${value} não disponível no ponto de compra`);
  }
  return COST_TABLE[value];
}

export type AtributosBase = Record<"for" | "des" | "con" | "int" | "sab" | "car", number>;

export interface PointBuyResult {
  valid: boolean;
  spent: number;
  remaining: number;
  errors: string[];
}

/**
 * Validates a full set of 6 attribute values against the point buy rules.
 */
export function validatePointBuy(attrs: AtributosBase): PointBuyResult {
  const errors: string[] = [];
  let spent = 0;

  for (const [key, value] of Object.entries(attrs)) {
    try {
      spent += pointBuyCost(value);
    } catch {
      errors.push(`${key}: valor ${value} inválido para ponto de compra`);
    }
  }

  const remaining = POINT_BUY_INITIAL_POINTS - spent;
  const valid = errors.length === 0 && remaining >= 0;

  return { valid, spent, remaining, errors };
}

export type MetodoAtributos =
  | "compra_pontos"
  | "rolagem_padrao"
  | "classica"
  | "epica"
  | "valkaria"
  | "khalmyr"
  | "nimb";

export interface MetodoInfo {
  id: MetodoAtributos;
  nome: string;
  tipo: string;
  categoria: string;
}

/** Returns all available attribute generation methods. */
export function listMetodos(): MetodoInfo[] {
  return atributosData.metodos as MetodoInfo[];
}
