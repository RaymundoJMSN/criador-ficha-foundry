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

/* ------------------------------------------------------------------ */
/*  Rolagem → valor de atributo                                        */
/* ------------------------------------------------------------------ */

/**
 * Em T20 o atributo JÁ é o modificador: rola-se o dado e converte pela tabela
 * (LB p.17). Guardar o total cru — 10, 12, 14 — deixava a ficha com Força 14.
 */
export function converterRolagem(total: number): number {
  if (total <= 7) return -2;
  if (total <= 9) return -1;
  if (total <= 11) return 0;
  if (total <= 13) return 1;
  if (total <= 15) return 2;
  if (total <= 17) return 3;
  return 4;
}

/** Nimb usa d20 e estende a tabela nas pontas (LB p.281). */
export function converterNimb(d20: number): number {
  if (d20 <= 3) return -3;
  if (d20 >= 20) return 5;
  if (d20 >= 18) return 4;
  return converterRolagem(d20);
}

export interface EspecRolagem {
  /** Fórmula por atributo. */
  formula: string;
  converter: (total: number) => number;
  /** Teto do valor convertido, quando o método impõe um. */
  maximo?: number;
}

/** Como cada método oficial gera um atributo. `null` = método sem rolagem. */
export function especRolagem(metodo: string): EspecRolagem | null {
  switch (metodo) {
    case "rolagem_padrao":
      return { formula: "4d6kh3", converter: converterRolagem };
    case "classica":
      return { formula: "3d6", converter: converterRolagem };
    case "epica":
      // "Descarte o menor dos 3d6 e some os dois restantes + 6"
      return { formula: "3d6kh2 + 6", converter: converterRolagem };
    case "nimb":
      return { formula: "1d20", converter: converterNimb };
    case "valkaria":
      // 7d6 distribuídos sobre base 8; aqui um dado por atributo, teto +4.
      return { formula: "1d6 + 8", converter: converterRolagem, maximo: 4 };
    default:
      return null;
  }
}

/** Valores fixos que o método distribui, quando houver (Khalmyr). */
export function valoresFixos(metodo: string): number[] | null {
  // LB p.281: "Distribua os 6 valores entre os 6 atributos como quiser."
  if (metodo === "khalmyr") return [3, 3, 2, 1, 0, -1];
  return null;
}

/** Soma mínima 6: abaixo disso o método manda rolar de novo (LB p.17). */
export const SOMA_MINIMA = 6;

export function precisaRerolar(valores: number[]): boolean {
  return valores.reduce((a, b) => a + b, 0) < SOMA_MINIMA;
}
