import racasDataRaw from "../data/racas.json";

export interface AtributoFixo {
  atributo: string;
  valor: number;
}

export interface AtributoEscolhaDef {
  valor: number;
  quantidade: number;
  atributos_diferentes?: boolean;
  atributos_disponiveis?: string[];
  observacao?: string;
}

export interface TreinarPericia {
  tipo: string;
  quantidade: number;
}

export interface RacaData {
  id: string;
  nome: string;
  descricao: string | null;
  tamanho: string;
  deslocamento: number;
  atributos_fixos: AtributoFixo[];
  atributos_escolha: AtributoEscolhaDef[];
  bonus_pericias: string[];
  treinar_pericias: TreinarPericia[];
}

const racasData = racasDataRaw as unknown as RacaData[];

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Find a race by its db id or by a display name (slug-matched). */
export function getRaca(idOrName: string): RacaData | null {
  const s = slug(idOrName);
  return racasData.find((r) => r.id === s || slug(r.nome) === s) ?? null;
}

/**
 * Number of extra trained skills a race grants by free choice
 * (sum of `treinar_pericias` quantities). Used in the perícia count:
 * treináveis = classe.numero + max(0, Int) + raça.
 */
export function getRaceSkillBonus(idOrName: string): number {
  const raca = getRaca(idOrName);
  if (!raca) return 0;
  return (raca.treinar_pericias ?? []).reduce((sum, t) => sum + (t.quantidade ?? 0), 0);
}
