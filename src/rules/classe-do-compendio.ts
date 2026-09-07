/**
 * Regras de classe lidas do próprio item do compêndio.
 *
 * O T20-DB só tem as 14 classes do Livro Básico. O compêndio tem essas mais as
 * de Heróis de Arton e de qualquer módulo instalado (Samurai, Místico…), e para
 * essas o wizard não mostrava perícia nenhuma.
 *
 * Mas o item de classe carrega o que falta:
 *   system.pericias.inatas = "Luta (For) ou Pontaria (Des), Fortitude (Con),
 *                             mais 2 a sua escolha entre Adestramento (Car), …"
 *   system.pericias.numero = 2
 *   system.pvPorNivel, system.pmPorNivel
 *
 * Este módulo transforma essa frase na mesma forma que `classes.json` usa, para
 * o resto do wizard não precisar saber de onde a regra veio.
 */
import type { ClasseData } from "./classe.js";
import type { IndexedClasse } from "../compendium/types.js";
import { PERICIA_SLUGS } from "./pericia-slug.js";
import classesRaw from "../data/classes.json";
import livrosRaw from "../data/progressao_livros.json";

const classesT20DB = classesRaw as unknown as Record<string, ClasseData>;
const livros = livrosRaw as unknown as Record<string, { proficiencias_texto?: string | null; pericias_texto?: string | null }>;

const slugClasse = (nome: string) =>
  nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** "Como o guerreiro básico" → a classe base do Livro Básico (T20-DB). */
function classeBase(texto: string | null | undefined): ClasseData | null {
  const m = /como [oa] (\w+(?: \w+)?) b[áa]sic[oa]/i.exec(texto ?? "");
  return m ? (classesT20DB[slugClasse(m[1]!)] ?? null) : null;
}

/**
 * "Proficiências. Armas marciais e escudos." (texto da classe no PDF, lido por
 * scripts/port-pdf-classes.mjs). Todo personagem sabe armas simples e armaduras
 * leves (LB p.38), então "Nenhuma" ainda dá essas duas.
 */
export function lerProficiencias(texto: string | null | undefined): string[] {
  const base = classeBase(texto);
  if (base) return [...base.proficiencias];
  const t = (texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const out = ["armas_simples", "armaduras_leves"];
  if (/armas marciais/.test(t)) out.push("armas_marciais");
  if (/armaduras pesadas/.test(t)) out.push("armaduras_pesadas");
  if (/escudos?/.test(t)) out.push("escudos");
  return out;
}

function slugPericia(nome: string): string {
  return nome
    .replace(/\([^)]*\)/g, "") // tira o "(For)" do lado
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Só o que é perícia de verdade — a frase tem lixo de pontuação no fim. */
function apenasPericias(nomes: string[]): string[] {
  return nomes.map(slugPericia).filter((s) => PERICIA_SLUGS.includes(s));
}

/** Divide por vírgula e pelo " e " final da enumeração. */
function itens(texto: string): string[] {
  return texto
    .split(/,|\se\s/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export interface PericiasDaFrase {
  fixas: string[];
  escolhas_obrigatorias: Array<{ quantidade: number; opcoes: string[] }>;
  escolhas: { quantidade: number; opcoes: string[] };
  /** O item não trouxe a lista; as opções são todas as perícias. */
  listaIncompleta?: boolean;
}

/**
 * Lê a frase de perícias do item de classe.
 *
 * - antes de "mais N a sua escolha entre": as treinadas de cabeça;
 *   um trecho com " ou " vira escolha obrigatória ("Luta ou Pontaria");
 * - depois: a lista de onde saem as N escolhas livres.
 */
export function lerPericiasDaFrase(frase: string, numero = 0): PericiasDaFrase {
  // Vinte classes de módulo (Samurai, Místico, as de Heróis de Arton) vêm com
  // `pericias.inatas` vazio: o compêndio não traz a lista. O item ainda diz
  // QUANTAS escolher, então libera-se a escolha entre todas, avisando na tela —
  // melhor que travar a classe, e não inventa lista que o livro não deu.
  if (!frase || typeof frase !== "string" || !frase.trim()) {
    return {
      fixas: [],
      escolhas_obrigatorias: [],
      escolhas: { quantidade: numero, opcoes: [...PERICIA_SLUGS] },
      listaIncompleta: numero > 0,
    };
  }

  const corte = /mais\s+(\d+|uma|duas|três|tres|quatro)\s+a\s+sua\s+escolha\s+entre/i.exec(frase);
  const NUMERO_POR_EXTENSO: Record<string, number> = {
    uma: 1,
    duas: 2,
    três: 3,
    tres: 3,
    quatro: 4,
  };

  const parteFixa = corte ? frase.slice(0, corte.index) : frase;
  const parteEscolha = corte ? frase.slice(corte.index + corte[0].length) : "";

  const quantidade = corte
    ? (Number(corte[1]) || NUMERO_POR_EXTENSO[corte[1].toLowerCase()] || numero)
    : numero;

  const fixas: string[] = [];
  const obrigatorias: Array<{ quantidade: number; opcoes: string[] }> = [];
  for (const bloco of itens(parteFixa)) {
    if (/\sou\s/i.test(bloco)) {
      const opcoes = apenasPericias(bloco.split(/\sou\s/i));
      if (opcoes.length > 1) obrigatorias.push({ quantidade: 1, opcoes });
      continue;
    }
    fixas.push(...apenasPericias([bloco]));
  }

  return {
    fixas,
    escolhas_obrigatorias: obrigatorias,
    escolhas: { quantidade, opcoes: apenasPericias(itens(parteEscolha)) },
  };
}

/**
 * Monta um `ClasseData` a partir do item do compêndio, para classes que o
 * T20-DB não conhece. Sem tabela de progressão: o wizard trata como classe sem
 * poder automático, o que é melhor que não deixar escolher perícia nenhuma.
 */
export function classeDoCompendio(item: IndexedClasse): ClasseData {
  const spec = item.system.pericias ?? {};
  const doLivro = livros[slugClasse(item.name)];
  // Frase do item do compêndio; se vazia, a do PDF ("Como o cavaleiro básico" copia a base).
  const fraseItem = typeof spec.inatas === "string" ? spec.inatas : "";
  const basePericias = fraseItem ? null : classeBase(doLivro?.pericias_texto);
  const frase = fraseItem || (basePericias ? "" : (doLivro?.pericias_texto ?? ""));
  const numeroDaFrase = Number(/mais (\d+) a sua escolha/.exec(frase)?.[1] ?? 0);
  const pericias = basePericias
    ? { ...basePericias.pericias }
    : lerPericiasDaFrase(frase, Number(spec.numero) || numeroDaFrase);

  return {
    nome: item.name,
    pericias,
    pv: {
      inicial: null,
      por_nivel: item.system.pvPorNivel ?? null,
      soma_atributo_inicial: "con",
      soma_atributo_por_nivel: "con",
    },
    pm: { por_nivel: item.system.pmPorNivel ?? 0 },
    proficiencias: doLivro ? lerProficiencias(doLivro.proficiencias_texto) : [],
    habilidades_classe_ids: [],
    poderes_classe_ids: [],
    caminhos: [],
  };
}
