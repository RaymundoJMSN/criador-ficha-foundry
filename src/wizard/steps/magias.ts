import {
  filterMagias,
  isConjurador,
  escolasAEscolher,
  ESCOLAS,
  cotaDeMagias,
  slugsDosPoderes,
  magiasExtrasDosPoderes,
  tetoPorCirculo,
  excedentesPorCirculo,
} from "../../rules/magias.js";
import { toNomeSlug } from "../../compendium/slug.js";
import { classesDoPersonagem, caminhoDe } from "../../rules/multiclasse.js";
import type { WizardState } from "../state.js";
import type { IndexedMagia } from "../../compendium/types.js";

export interface MagiaEntry {
  id: string;
  name: string;
  img: string;
  circulo: number;
  escola: string;
  tipo: string;
  selected: boolean;
  /** No limite (total ou do círculo), as não escolhidas ficam travadas. */
  bloqueado: boolean;
  /** Escolhida além do teto do círculo — precisa sair. */
  excedente: boolean;
}

export interface MagiasByCirculo {
  circulo: number;
  label: string;
  /** Teto de magias de círculo ≥ este (só a partir do 2º). */
  teto?: number;
  magias: MagiaEntry[];
}

export interface MagiasContext {
  stepTitle: string;
  classeNome: string;
  isConjurador: boolean;
  /** Bardo/druida: quantas escolas escolher; 0 = não se aplica. */
  escolasAEscolher: number;
  escolas: Array<{ abrev: string; nome: string; selected: boolean; bloqueado: boolean }>;
  escolasFaltam: number;
  magiaLimit: number;
  atMaxLimit: boolean;
  /** Escolhidas a mais (nível ou caminho mudaram depois). */
  excesso: number;
  magiaSearch: string;
  magiasByCirculo: MagiasByCirculo[];
  selectedCount: number;
  /** Ids que continuam válidos para esta classe/nível — o app poda o resto. */
  idsValidos: string[];
  errors: string[];
}

function circuloLabel(n: number): string {
  const ordinals = ["1º", "2º", "3º", "4º", "5º"];
  return `${ordinals[n - 1] ?? n + "º"} Círculo`;
}

export function prepareMagiasContext(
  state: WizardState,
  allMagias: IndexedMagia[],
  errors: string[] = []
): MagiasContext {
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const poderSlugs = slugsDosPoderes(state.poderes);
  // Multiclasse: cada classe conjuradora no seu nível (LB p.35); as cotas somam.
  const classes = classesDoPersonagem(state);
  const conjuradoras = classes.filter((c) => isConjurador(c.classeSlug));
  const conjurador = conjuradoras.length > 0;

  // Quantas magias o personagem conhece: regra da classe (LB cap. 4) mais os
  // poderes que ensinam magia (Orar, Conhecimento Mágico…). Nunca é chute.
  const magiaLimit =
    classes.reduce((n, c) => n + cotaDeMagias(c.classeNome || c.classeId, c.niveis, caminhoDe(state, c), []), 0) +
    magiasExtrasDosPoderes(poderSlugs);

  const precisaEscolas = Math.max(...classes.map((c) => escolasAEscolher(c.classeSlug)));
  const escolhidas = (state.escolhasPorItem["classe_escolas"] as string[] | undefined) ?? [];
  const escolas = Object.entries(ESCOLAS).map(([abrev, e]) => ({
    abrev,
    nome: e.nome,
    selected: escolhidas.includes(abrev),
    bloqueado: escolhidas.length >= precisaEscolas && !escolhidas.includes(abrev),
  }));
  const escolasFaltam = Math.max(0, precisaEscolas - escolhidas.length);

  const fontes = conjurador ? conjuradoras : classes.slice(0, 1);
  const vistas = new Set<string>();
  const validas = fontes.flatMap((c) =>
    filterMagias(allMagias, {
      classeSlug: c.classeSlug,
      nivel: c.niveis,
      escolas: escolhidas,
      poderSlugs,
    }).filter((m) => !vistas.has(m.id) && vistas.add(m.id))
  );
  const idsValidos = validas.map((m) => m.id);

  const magiaSearch = (state.escolhasPorItem["magia_search"] as string) ?? "";
  const q = magiaSearch.toLowerCase();
  const filtered = q ? validas.filter((m) => m.name.toLowerCase().includes(q)) : validas;

  const selecionadas = state.magias.filter((id) => idsValidos.includes(id));
  const noLimite = selecionadas.length >= magiaLimit;
  const excesso = Math.max(0, selecionadas.length - magiaLimit);

  // Teto por círculo: a magia de 2º círculo só cabe nas aprendidas depois do nível
  // que abriu o 2º círculo — sem isso um arcanista nv5 punha 7 magias de 2º.
  // Teto por círculo somado entre as classes (cada uma no seu nível).
  const teto: Record<number, number> = {};
  for (const c of classes) {
    for (const [circ, max] of Object.entries(tetoPorCirculo(c.classeNome || c.classeId, c.niveis, caminhoDe(state, c)))) {
      teto[Number(circ)] = (teto[Number(circ)] ?? 0) + max;
    }
  }
  const circuloDe = new Map(validas.map((m) => [m.id, Number(m.system.circulo) || 0]));
  const escolhidasComCirculo = selecionadas.map((id) => ({ id, circulo: circuloDe.get(id) ?? 0 }));
  const excedentes = new Set(excedentesPorCirculo(escolhidasComCirculo, teto));
  const caberia = (circulo: number) =>
    !excedentesPorCirculo([...escolhidasComCirculo, { id: "?", circulo }], teto).includes("?");

  const byCirculo = new Map<number, MagiaEntry[]>();
  for (const m of filtered) {
    const circulo = Number(m.system.circulo) || 0;
    if (!byCirculo.has(circulo)) byCirculo.set(circulo, []);
    const selected = selecionadas.includes(m.id);
    byCirculo.get(circulo)!.push({
      id: m.id,
      name: m.name,
      img: m.img,
      circulo,
      escola: ESCOLAS[m.system.escola ?? ""]?.nome ?? (m.system.escola ?? ""),
      tipo: m.system.tipo ?? "",
      selected,
      bloqueado: !selected && (noLimite || !caberia(circulo)),
      excedente: selected && excedentes.has(m.id),
    });
  }

  const magiasByCirculo: MagiasByCirculo[] = Array.from(byCirculo.entries())
    .sort(([a], [b]) => a - b)
    .map(([circulo, magias]) => ({
      circulo,
      label: circuloLabel(circulo),
      teto: teto[circulo],
      magias,
    }));

  return {
    stepTitle: "Magias",
    classeNome: classes.map((c) => c.classeNome).join(" / ") || (state.classeNome ?? ""),
    isConjurador: conjurador || magiaLimit > 0,
    escolasAEscolher: precisaEscolas,
    escolas,
    escolasFaltam,
    magiaLimit,
    atMaxLimit: noLimite,
    excesso,
    magiaSearch,
    magiasByCirculo,
    selectedCount: selecionadas.length,
    idsValidos,
    errors,
  };
}
