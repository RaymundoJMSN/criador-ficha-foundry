import progressaoDataRaw from "../data/progressao_classes.json";
import progressaoLivrosRaw from "../data/progressao_livros.json";

type ProgressaoRaw = {
  pv_por_nivel: number;
  pm_por_nivel: number;
  pericias_inatas: string[];
  pericias_escolha: string[];
  pericias_numero: number;
  /** Level → automatic class abilities gained + how many power picks it grants. */
  tabela?: Record<string, { automaticos: string[]; escolhas: number }>;
  /** Level → highest spell circle unlocked at that level. */
  circulos?: Record<string, number>;
  /** Quantas magias a classe conhece: inicial + ganho por nível. */
  magias?: MagiasProgressao | null;
};

// T20-DB (conferido) cobre o Livro Básico; as tabelas lidas dos PDFs
// (scripts/port-pdf-classes.mjs) entram só para o que falta: Frade, Treinador
// e as classes de Heróis de Arton. PV/PM/perícias dessas vêm do item de classe
// do compêndio (classe-do-compendio.ts), não daqui.
const progressaoData: Record<string, ProgressaoRaw> = {
  ...Object.fromEntries(
    Object.entries(progressaoLivrosRaw as Record<string, Partial<ProgressaoRaw>>).map(([k, v]) => [
      k,
      { pv_por_nivel: 0, pm_por_nivel: 0, pericias_inatas: [], pericias_escolha: [], pericias_numero: 0, ...v },
    ])
  ),
  ...(progressaoDataRaw as unknown as Record<string, ProgressaoRaw>),
};

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

export interface MagiasProgressao {
  inicio: number;
  por_nivel: number;
  por_nivel_par: number;
  por_nivel_impar: number;
  /** "arcana" | "divina" (T20-DB `lancar_magia`). */
  tradicao?: string | null;
  /** Quantas escolas a classe escolhe de forma permanente (bardo/druida: 3). */
  escolas?: number;
}

export interface ClasseProgressao {
  pericias_inatas: string[];
  pericias_escolha: string[];
  pericias_numero: number;
  pv_por_nivel: number;
  pm_por_nivel: number;
  tabela?: Record<string, { automaticos: string[]; escolhas: number }>;
  circulos?: Record<string, number>;
  magias?: MagiasProgressao | null;
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

  // Sem classe ainda: "" casaria com qualquer chave no startsWith abaixo e
  // devolvia a primeira (arcanista) — o wizard mostrava Magias antes da classe.
  if (!slug) return null;

  // Direct match
  if (slug in progressaoData) return progressaoData[slug];

  // Partial match (handle "Arcanista — Bruxo" → "arcanista")
  for (const [key, val] of Object.entries(progressaoData)) {
    if (slug.startsWith(key) || key.startsWith(slug)) return val;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Eixo de nível — única fonte de "o que este personagem tem no nv N" */
/* ------------------------------------------------------------------ */

/**
 * Escalonamentos vêm como slug com número (`ataque_especial_8`, `duelo_3`,
 * `casca_grossa_con_mais_2`, `magias_2_circulo`, `ataque_furtivo_10d6`,
 * `fabricar_item_superior_2_melhorias`). São upgrades da mesma habilidade, não
 * itens novos — agrupar pela família evita conceder Ataque Especial quatro vezes.
 *
 * O número pode vir no MEIO: `magias_2_circulo` é a mesma habilidade "Magias"
 * de `magias_1_circulo`. Só tirar o sufixo numérico deixava as duas como famílias
 * diferentes, e o arcanista recebia o item "Magias (Arcanista)" em dobro.
 * `furia_+2`/`furia_+3` (bárbaro), `inspiracao_+1…+5` (bardo) e
 * `marca_da_presa_+1d4` (caçador) têm o sinal antes do número — sem o `\+?`
 * o bardo nv17 recebia Inspiração cinco vezes (achado do conferidor de PDFs).
 */
const ESCALONAMENTO = /(?:_con_mais)?_\+?\d+[a-z0-9+]*(?:_(?:circulo|melhorias?))?$/;

/** Strips the numeric upgrade suffix so `ataque_especial_8` groups with `ataque_especial`. */
export function baseSlug(slug: string): string {
  return slug.replace(ESCALONAMENTO, "");
}

/**
 * Automatic class abilities a character of this level has, one per family:
 * an upgrade entry (`ataque_especial_8`) replaces its base rather than adding to it.
 */
export function habilidadesAte(classeNome: string, nivel: number): string[] {
  const tabela = getClasseProgressao(classeNome)?.tabela;
  if (!tabela) return [];

  const melhorPorFamilia = new Map<string, { nivel: number; slug: string }>();
  for (const [nvStr, row] of Object.entries(tabela)) {
    const nv = Number(nvStr);
    if (nv > nivel) continue;
    for (const slug of row.automaticos ?? []) {
      const familia = baseSlug(slug);
      const atual = melhorPorFamilia.get(familia);
      if (!atual || nv >= atual.nivel) melhorPorFamilia.set(familia, { nivel: nv, slug });
    }
  }

  return [...melhorPorFamilia.values()].sort((a, b) => a.nivel - b.nivel).map((e) => e.slug);
}

/** Total power picks accumulated from level 1 up to `nivel`. */
export function slotsDePoder(classeNome: string, nivel: number): number {
  const tabela = getClasseProgressao(classeNome)?.tabela;
  if (!tabela) return 0;

  let total = 0;
  for (const [nvStr, row] of Object.entries(tabela)) {
    if (Number(nvStr) <= nivel) total += row.escolhas ?? 0;
  }
  return total;
}

/** Highest spell circle unlocked at `nivel`; 0 when the class does not cast. */
export function circuloMaximo(classeNome: string, nivel: number): number {
  const circulos = getClasseProgressao(classeNome)?.circulos;
  if (!circulos) return 0;

  let max = 0;
  for (const [nvStr, circulo] of Object.entries(circulos)) {
    if (Number(nvStr) <= nivel && circulo > max) max = circulo;
  }
  return max;
}

/**
 * Magias aprendidas em cada nível (índice = nível; [0] não existe).
 *
 * Fonte: poder "Magias (<classe>)" do T20-DB. O caminho do arcanista muda os
 * termos (LB cap. 4, Arcanista → "Aprendendo Magias" / "Magias Iniciais"):
 * mago começa com 4 em vez de 3 e "sempre que ganha acesso a um novo círculo
 * de magias, aprende uma magia adicional daquele círculo"; feiticeiro aprende
 * a cada nível ÍMPAR (3º, 5º…).
 */
export function ganhosDeMagiaPorNivel(classeNome: string, nivel: number, caminho = ""): number[] {
  const prog = getClasseProgressao(classeNome);
  const m = prog?.magias;
  if (!m) return [];

  const ehMago = caminho.endsWith("_mago");
  const ehFeiticeiro = caminho.endsWith("_feiticeiro");

  const ganhos: number[] = [0, m.inicio + (ehMago ? 1 : 0)];
  for (let nv = 2; nv <= nivel; nv++) {
    let g = 0;
    if (ehFeiticeiro) {
      if (nv % 2 === 1) g += 1;
    } else {
      g += m.por_nivel;
      if (nv % 2 === 0) g += m.por_nivel_par;
      if (nv % 2 === 1) g += m.por_nivel_impar;
    }
    if (ehMago && prog?.circulos?.[String(nv)]) g += 1;
    ganhos.push(g);
  }
  return ganhos;
}

/** Quantas magias o personagem conhece no nível dado (só pela classe). */
export function magiasConhecidas(classeNome: string, nivel: number, caminho = ""): number {
  return ganhosDeMagiaPorNivel(classeNome, nivel, caminho).reduce((a, b) => a + b, 0);
}

/**
 * Para cada círculo C ≥ 2, quantas magias de círculo ≥ C o personagem pode
 * ter: só as aprendidas em níveis em que C já estava aberto (as iniciais são
 * sempre de 1º círculo).
 */
export function magiasMaxPorCirculo(classeNome: string, nivel: number, caminho = ""): Record<number, number> {
  const ganhos = ganhosDeMagiaPorNivel(classeNome, nivel, caminho);
  const out: Record<number, number> = {};
  for (let c = 2; c <= circuloMaximo(classeNome, nivel); c++) {
    let total = 0;
    for (let nv = 2; nv < ganhos.length; nv++) {
      if (circuloMaximo(classeNome, nv) >= c) total += ganhos[nv] ?? 0;
    }
    out[c] = total;
  }
  return out;
}
