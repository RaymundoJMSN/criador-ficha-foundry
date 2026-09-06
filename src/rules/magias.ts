import type { IndexedMagia } from "../compendium/types.js";
import { toNomeSlug } from "../compendium/slug.js";
import { getClasseProgressao, circuloMaximo, magiasConhecidas, magiasMaxPorCirculo } from "./progressao.js";
import magiasPorPoderRaw from "../data/magias_por_poder.json";

const magiasPorPoder = magiasPorPoderRaw as Record<string, { quantidade: number; tradicao: string[] }>;

export type Tradicao = "arcana" | "divina";

/** Abreviação do compêndio (`system.escola`) → slug completo usado nos pré-requisitos. */
export const ESCOLAS: Record<string, { slug: string; nome: string }> = {
  abj: { slug: "abjuracao", nome: "Abjuração" },
  adv: { slug: "adivinhacao", nome: "Adivinhação" },
  con: { slug: "convocacao", nome: "Convocação" },
  enc: { slug: "encantamento", nome: "Encantamento" },
  evo: { slug: "evocacao", nome: "Evocação" },
  ilu: { slug: "ilusao", nome: "Ilusão" },
  nec: { slug: "necromancia", nome: "Necromancia" },
  tra: { slug: "transmutacao", nome: "Transmutação" },
};

/** Tradição da habilidade Magias da classe (T20-DB `lancar_magia.tradicao`); null = não conjura. */
export function tradicaoDaClasse(classeSlug: string): Tradicao | null {
  const m = getClasseProgressao(classeSlug)?.magias;
  return (m?.tradicao as Tradicao | undefined) ?? null;
}

export function isConjurador(classeSlug: string): boolean {
  return tradicaoDaClasse(classeSlug) !== null;
}

/** "Escolha três escolas de magia" — bardo e druida (LB p.44 e p.61); 0 para o resto. */
export function escolasAEscolher(classeSlug: string): number {
  return getClasseProgressao(classeSlug)?.magias?.escolas ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Poderes que ensinam magias (Orar, Conhecimento Mágico, Aspectos…)  */
/* ------------------------------------------------------------------ */

let nomeDoPoder: (id: string) => string | undefined = () => undefined;

/** O módulo registra como achar o nome de um poder pelo id do compêndio. */
export function registrarNomesDePoder(fn: (id: string) => string | undefined): void {
  nomeDoPoder = fn;
}

export function slugsDosPoderes(ids: string[]): string[] {
  return ids.map((id) => toNomeSlug(nomeDoPoder(id) ?? "")).filter((s) => s.length > 0);
}

/** Magias a mais que os poderes escolhidos dão (repetição conta: Orar 2× = 2). */
export function magiasExtrasDosPoderes(poderSlugs: string[]): number {
  return poderSlugs.reduce((n, s) => n + (magiasPorPoder[s]?.quantidade ?? 0), 0);
}

/** Tradições que os poderes abrem para quem não é conjurador (Orar → divina). */
function tradicoesDosPoderes(poderSlugs: string[]): Tradicao[] {
  const out = new Set<Tradicao>();
  for (const s of poderSlugs) for (const t of magiasPorPoder[s]?.tradicao ?? []) out.add(t as Tradicao);
  return [...out];
}

/** Quantas magias o personagem conhece ao todo: classe + poderes. */
export function cotaDeMagias(classeNome: string, nivel: number, caminho: string, poderSlugs: string[]): number {
  return magiasConhecidas(classeNome, nivel, caminho) + magiasExtrasDosPoderes(poderSlugs);
}

/**
 * Circles a caster of this level can cast. The unlock levels are per class
 * (arcanista 1/5/9/13/17, bardo 1/6/10/14, clérigo 1/5/9/13/17), so they come
 * from the class progression table. Quem só conjura por poder (paladino com
 * Orar) fica no 1º círculo.
 */
export function getCirculosDesbloqueados(classeSlug: string, nivel: number): number[] {
  const max = Math.max(1, circuloMaximo(classeSlug, nivel));
  return Array.from({ length: max }, (_, i) => i + 1);
}

export interface FiltroMagias {
  classeSlug: string;
  nivel: number;
  /** Escolas escolhidas (abreviação do compêndio), quando a classe exige. */
  escolas?: string[];
  poderSlugs?: string[];
}

/**
 * Magias que este personagem pode aprender: círculo aberto, tradição da classe
 * (ou dos poderes) mais as universais, e — para bardo/druida — só as escolas
 * escolhidas. Sem as escolas marcadas a lista fica vazia de propósito.
 */
export function filterMagias(magias: IndexedMagia[], f: FiltroMagias): IndexedMagia[] {
  const circles = new Set(getCirculosDesbloqueados(f.classeSlug, f.nivel));
  const tradicao = tradicaoDaClasse(f.classeSlug);
  const tradicoes = tradicao ? [tradicao] : tradicoesDosPoderes(f.poderSlugs ?? []);
  if (tradicoes.length === 0) return [];
  const tipos = new Set<string>(["uni", ...tradicoes.map((t) => (t === "arcana" ? "arc" : "div"))]);

  const precisaEscolas = escolasAEscolher(f.classeSlug);
  const escolas = new Set(f.escolas ?? []);
  if (precisaEscolas > 0 && escolas.size < precisaEscolas) return [];

  return magias.filter((m) => {
    // Coerce circulo to number — getIndex may return string from Foundry
    const circulo = Number(m.system.circulo);
    if (!circulo || !circles.has(circulo)) return false;
    if (m.system.tipo && !tipos.has(m.system.tipo)) return false;
    if (precisaEscolas > 0 && m.system.escola && !escolas.has(m.system.escola)) return false;
    return true;
  });
}

/**
 * Teto de magias por círculo (LB p.37/44/57/61: as iniciais são de 1º círculo
 * e cada nível aprende "uma magia de qualquer círculo que possa lançar"): magia
 * de círculo C só pode ter sido aprendida a partir do nível que abriu C.
 * Devolve, para cada círculo ≥ 2, quantas magias de círculo ≥ C cabem.
 */
export function tetoPorCirculo(classeNome: string, nivel: number, caminho: string): Record<number, number> {
  return magiasMaxPorCirculo(classeNome, nivel, caminho);
}

/** Escolhidas que estouram o teto de algum círculo (ids), na ordem em que estão. */
export function excedentesPorCirculo(
  escolhidas: Array<{ id: string; circulo: number }>,
  teto: Record<number, number>
): string[] {
  const fora: string[] = [];
  const contagem: Record<number, number> = {};
  for (const m of escolhidas) {
    let cabe = true;
    for (const [cStr, max] of Object.entries(teto)) {
      const c = Number(cStr);
      if (m.circulo >= c && (contagem[c] ?? 0) >= max) cabe = false;
    }
    if (!cabe) {
      fora.push(m.id);
      continue;
    }
    for (const cStr of Object.keys(teto)) {
      const c = Number(cStr);
      if (m.circulo >= c) contagem[c] = (contagem[c] ?? 0) + 1;
    }
  }
  return fora;
}
