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

export const ATRIBUTOS = ["for", "des", "con", "int", "sab", "car"] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export interface EspecRolagem {
  /** Fórmula de UM total. */
  formula: string;
  /** Quantos totais rolar. */
  quantidade: number;
  converter: (total: number) => number;
  /** Nimb rola 7 e descarta o menor (HA p.281). */
  descartarMenor: boolean;
  /** "Caso seus atributos não somem pelo menos 6, role novamente o menor valor" (LB p.17). */
  somaMinima: boolean;
}

/** Como cada método oficial gera o conjunto de valores. `null` = não rola. */
export function especRolagem(metodo: string): EspecRolagem | null {
  const padrao = { quantidade: 6, converter: converterRolagem, descartarMenor: false, somaMinima: true };
  switch (metodo) {
    case "rolagem_padrao":
      return { formula: "4d6kh3", ...padrao };
    case "classica":
      return { formula: "3d6", ...padrao };
    case "epica":
      // "Descarte o menor dos 3d6 e some os dois restantes + 6"
      return { formula: "3d6kh2 + 6", ...padrao };
    case "nimb":
      // Nimb é vendido como "por sua conta e risco": sem piso de soma.
      return { formula: "1d20", quantidade: 7, converter: converterNimb, descartarMenor: true, somaMinima: false };
    default:
      return null;
  }
}

/** Valkaria (HA p.281): cada atributo começa em 8; 7d6 aplicados inteiros onde quiser. */
export const VALKARIA = { formula: "1d6", quantidade: 7, base: 8 } as const;

/** Valores fixos que o método distribui, quando houver (Khalmyr). */
export function valoresFixos(metodo: string): number[] | null {
  // HA p.281: "Distribua os seguintes valores em seus atributos, sem rolar nada"
  if (metodo === "khalmyr") return [3, 3, 2, 1, 0, -1];
  return null;
}

/** Totais rolados → pool de valores convertidos (descartando o menor quando o método manda). */
export function poolDaRolagem(espec: EspecRolagem, totais: number[]): number[] {
  let lista = [...totais];
  if (espec.descartarMenor) {
    const menor = lista.indexOf(Math.min(...lista));
    lista = lista.filter((_, i) => i !== menor);
  }
  return lista.map(espec.converter);
}

/** Soma mínima 6: abaixo disso o método manda rolar de novo (LB p.17). */
export const SOMA_MINIMA = 6;

export function precisaRerolar(valores: number[]): boolean {
  return valores.reduce((a, b) => a + b, 0) < SOMA_MINIMA;
}

export function indiceDoMenor(valores: number[]): number {
  return valores.indexOf(Math.min(...valores));
}

/** Distribuição: atributo → índice no pool. */
export type Distribuicao = Partial<Record<Atributo, number>>;

/**
 * "Distribua esses valores entre os seis atributos como quiser" (LB p.17).
 * Atributo sem valor fica 0; a validação é que exige tudo preenchido.
 */
export function atributosDistribuidos(pool: number[], dist: Distribuicao): AtributosBase {
  const out = {} as AtributosBase;
  for (const a of ATRIBUTOS) {
    const i = dist[a];
    out[a] = i !== undefined && pool[i] !== undefined ? pool[i] : 0;
  }
  return out;
}

/** Valkaria: dado i → atributo (ou undefined). Base 8 + dados, convertido pela tabela (teto 4 vem dela). */
export function atributosValkaria(dados: number[], dist: Array<Atributo | undefined>): AtributosBase {
  const soma = {} as Record<Atributo, number>;
  for (const a of ATRIBUTOS) soma[a] = VALKARIA.base;
  dados.forEach((d, i) => {
    const a = dist[i];
    if (a) soma[a] += d;
  });
  const out = {} as AtributosBase;
  for (const a of ATRIBUTOS) out[a] = converterRolagem(soma[a]);
  return out;
}

/** Erros do passo Atributos para qualquer método (compra, pool ou Valkaria). */
export function validarAtributos(
  metodo: string,
  atributosBase: AtributosBase,
  escolhas: Record<string, unknown>
): string[] {
  if (metodo === "compra_pontos") {
    const r = validatePointBuy(atributosBase);
    const erros = [...r.errors];
    if (r.remaining < 0) erros.push(`Pontos excedidos em ${-r.remaining}.`);
    return erros;
  }
  if (metodo === "valkaria") {
    const dados = escolhas["valkaria_dados"] as number[] | undefined;
    if (!dados?.length) return ["Clique em Rolar para gerar os 7 dados."];
    const dist = (escolhas["valkaria_dist"] as Array<string | undefined>) ?? [];
    const faltam = dados.filter((_, i) => !ATRIBUTOS.includes(dist[i] as Atributo)).length;
    return faltam ? [`Aplique todos os dados em atributos (faltam ${faltam}).`] : [];
  }
  const pool = valoresFixos(metodo) ?? (escolhas["atributos_pool"] as number[] | undefined);
  if (!pool?.length) return ["Clique em Rolar para gerar os valores."];
  const dist = (escolhas["atributos_dist"] as Distribuicao) ?? {};
  const usados = ATRIBUTOS.map((a) => dist[a]).filter((i): i is number => i !== undefined && pool[i] !== undefined);
  if (usados.length < ATRIBUTOS.length) return ["Distribua os seis valores entre os atributos."];
  if (new Set(usados).size < usados.length) return ["Cada valor rolado só pode ser usado uma vez."];
  return [];
}
