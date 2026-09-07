/**
 * Poderes que pedem uma escolha ao serem adquiridos: "Aspirante a Herói: +1 em
 * um atributo", "Foco em Arma: escolha uma arma", "Treinamento em Perícia"…
 *
 * `data/subescolhas_poder.json` diz o que cada poder pede (chave = slug do nome
 * do item no compêndio). As respostas ficam em `escolhasPorItem` como
 * `sp_<slug>_<i>` (uma por cópia × quantidade: Foco em Arma ×2 = duas armas).
 */
import dadosRaw from "../data/subescolhas_poder.json";
import { toNomeSlug } from "../compendium/slug.js";
import { resolverPoder } from "../compendium/resolver.js";
import type { IndexedPoder, IndexedRace } from "../compendium/types.js";
import type { WizardState } from "../wizard/state.js";
import { habilidadesDeTodas } from "./multiclasse.js";
import { getOrigem, validarBeneficios, slugsDoPoderDaOrigem } from "./origem.js";
import { beneficiosDeOrigemPermitidos } from "./idade.js";
import { poderesDaMontagem } from "./montagem.js";

export interface SubEscolhaPoder {
  tipo:
    | "atributo"
    | "pericia"
    | "magia"
    | "magia_conhecida"
    | "arma"
    | "lista"
    | "escola"
    | "habilidade_outra_classe"
    | "poder_da_classe"
    | "poder_classe_ou_geral"
    | "texto";
  rotulo: string;
  /** Texto livre lido do próprio poder ("escolha um…"): não trava a criação. */
  opcional?: boolean;
  /** Quantas respostas por cópia do poder (Conhecimento Enciclopédico: 2). */
  quantidade?: number;
  /** atributo: quanto soma. */
  valor?: number;
  /** pericia: vira treinada. */
  treinar?: boolean;
  /** pericia: bônus em vez de treino. */
  bonus?: number;
  /** pericia: só as deste atributo-chave ("Int"). */
  atributo?: string;
  /** pericia: fora da lista. */
  excluir?: string[];
  /** magia: filtro. */
  circulo?: number;
  tradicao?: string[];
  escola?: string;
  /** lista: `magia` = slug da magia que a opção concede (Totem Espiritual). */
  opcoes?: Array<{ id: string; rotulo: string; magia?: string }>;
}

const DADOS = dadosRaw as unknown as Record<string, SubEscolhaPoder | string>;

/** "Escolha uma perícia…", "um aliado a sua escolha": o texto pede decisão. */
const PEDE_ESCOLHA = /\bescolh[ae] (um|uma|dois|duas|tr[êe]s|quatro)\b|\b[àa] sua escolha\b/i;
const GENERICA: SubEscolhaPoder = { tipo: "texto", rotulo: "Sua escolha (veja o texto do poder)", opcional: true };

/**
 * Regra estruturada do JSON; sem ela, poder cujo texto pede uma escolha ganha
 * um campo de texto opcional — a resposta vai para o nome do item na ficha.
 */
export function subEscolhaDoPoder(nomeOuSlug: string, descricao = ""): SubEscolhaPoder | null {
  const v = DADOS[toNomeSlug(nomeOuSlug)];
  if (v && typeof v === "object") return v;
  return PEDE_ESCOLHA.test(descricao) ? GENERICA : null;
}

export const chaveSubPoder = (slug: string, i: number): string => `sp_${slug}_${i}`;

/** Um poder adquirido de qualquer fonte, com quantas cópias. */
export interface PoderAdquirido {
  slug: string;
  nome: string;
  vezes: number;
  fonte: string;
  descricao: string;
}

/**
 * Tudo que o personagem recebe como poder, de todas as fontes: habilidades de
 * classe, poderes escolhidos (com repetição), origem (benefícios e poder
 * livre), divindade, montagem da raça e os que o item de raça concede.
 */
export function poderesAdquiridos(state: WizardState, allPoderes: IndexedPoder[], racas: IndexedRace[] = []): PoderAdquirido[] {
  const porId = new Map(allPoderes.map((p) => [p.id, p]));
  const out = new Map<string, PoderAdquirido>();
  const add = (nome: string, fonte: string, vezes = 1, descricao = ""): void => {
    const slug = toNomeSlug(nome);
    if (!slug) return;
    const atual = out.get(slug);
    if (atual) atual.vezes += vezes;
    else out.set(slug, { slug, nome, vezes, fonte, descricao });
  };

  for (const { classe, slug } of habilidadesDeTodas(state)) {
    const item = resolverPoder(slug, classe.classeSlug, allPoderes, "ability")?.item;
    if (item) add(item.name, "classe", 1, item.system.descricao ?? "");
  }

  const contagem = new Map<string, number>();
  for (const id of state.poderes) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  for (const [id, n] of contagem) {
    const item = porId.get(id);
    if (item) add(item.name, "poder", n, item.system.descricao ?? "");
  }

  const origem = state.origemId ? getOrigem(state.origemId) : null;
  if (origem) {
    const escolhidos = (state.escolhasPorItem["origem_beneficios"] as string[] | undefined) ?? [];
    const ben = validarBeneficios(origem.id, escolhidos, beneficiosDeOrigemPermitidos(state));
    for (const slug of ben.poderes) {
      const item = slugsDoPoderDaOrigem(origem.id, slug)
        .map((s) => resolverPoder(s, "", allPoderes)?.item)
        .find(Boolean);
      add(item?.name ?? slug, "origem", 1, item?.system.descricao ?? "");
    }
    for (const cat of ben.livres) {
      const id = state.escolhasPorItem[`origem_poder_livre_${cat}`] as string | undefined;
      const item = id ? porId.get(id) : undefined;
      if (item) add(item.name, "origem", 1, item.system.descricao ?? "");
    }
  }

  for (const slug of (state.escolhasPorItem["divindade_poderes"] as string[] | undefined) ?? []) {
    const item = resolverPoder(slug, toNomeSlug(state.classeNome ?? ""), allPoderes, "concedido")?.item;
    add(item?.name ?? slug, "divindade", 1, item?.system.descricao ?? "");
  }

  const racaRef = state.racaNome || state.racaId;
  for (const pm of poderesDaMontagem(racaRef, state.escolhasPorItem)) add(pm.poder, "raça");
  const raca = racas.find((r) => r.id === state.racaId);
  for (const g of raca?.system.grants ?? []) {
    for (const c of g.choices ?? []) {
      const item = porId.get(String(c.uuid ?? "").split(".").pop() ?? "");
      // Escolha de habilidade racial já tem passo próprio (Versátil, Memória Póstuma…): sem fallback de texto.
      if (item) add(item.name, "raça");
    }
  }

  return [...out.values()];
}

export interface RespostaSubPoder {
  slug: string;
  nome: string;
  sub: SubEscolhaPoder;
  /** Índice da resposta (cópia × quantidade). */
  i: number;
  valor: string;
}

/** Quantas respostas o poder pede ao todo (cópias × quantidade). */
export function respostasEsperadas(sub: SubEscolhaPoder, vezes: number): number {
  return Math.max(1, vezes) * (sub.quantidade ?? 1);
}

/** Respostas dadas (só as preenchidas) para os poderes adquiridos que têm sub-escolha. */
export function respostasDeSubEscolhas(
  adquiridos: PoderAdquirido[],
  escolhas: Record<string, unknown>
): RespostaSubPoder[] {
  const out: RespostaSubPoder[] = [];
  for (const p of adquiridos) {
    const sub = subEscolhaDoPoder(p.slug, p.descricao);
    if (!sub) continue;
    for (let i = 0; i < respostasEsperadas(sub, p.vezes); i++) {
      const v = escolhas[chaveSubPoder(p.slug, i)];
      if (typeof v === "string" && v) out.push({ slug: p.slug, nome: p.nome, sub, i, valor: v });
    }
  }
  return out;
}

export function pendenciasDeSubEscolhas(
  adquiridos: PoderAdquirido[],
  escolhas: Record<string, unknown>
): string[] {
  const faltando: string[] = [];
  for (const p of adquiridos) {
    const sub = subEscolhaDoPoder(p.slug, p.descricao);
    if (!sub || sub.opcional) continue;
    const esperadas = respostasEsperadas(sub, p.vezes);
    let dadas = 0;
    for (let i = 0; i < esperadas; i++) {
      const v = escolhas[chaveSubPoder(p.slug, i)];
      if (typeof v === "string" && v) dadas++;
    }
    if (dadas < esperadas) faltando.push(`${p.nome}: ${sub.rotulo.toLowerCase()} — escolha ${esperadas > 1 ? `${esperadas} (${dadas} feita(s))` : ""}`.trim() + ".");
  }
  return faltando;
}
