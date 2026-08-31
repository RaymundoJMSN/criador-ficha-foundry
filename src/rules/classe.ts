import classesDataRaw from "../data/classes.json";
import type { IndexedClasse } from "../compendium/types.js";
import { classeDoCompendio } from "./classe-do-compendio.js";

export interface EscolhaObrigatoria {
  quantidade: number;
  opcoes: string[];
}

export interface ClassePericiaSpec {
  fixas: string[];
  escolhas_obrigatorias: EscolhaObrigatoria[];
  escolhas: { quantidade: number; opcoes: string[] };
}

/** Uma escolha dependente: linhagem do feiticeiro, tipo de dano da linhagem dracônica. */
export interface SubEscolhaDef {
  /** Chave em `escolhasPorItem` onde a resposta é guardada. */
  chave: string;
  label: string;
  opcoes: Array<{ id: string; nome: string; sub: SubEscolhaDef | null }>;
}

/** Caminho/trilha de classe (Arcanista → Bruxo/Mago/Feiticeiro). */
export interface CaminhoDef {
  /** Slug do item no compêndio ("Caminho do Arcanista: Mago"). */
  slug: string;
  id: string;
  nome: string;
  /** Atributo-chave de magia que o caminho define, quando define. */
  atributoChave: string | null;
  sub: SubEscolhaDef | null;
}

export interface ClasseData {
  nome: string;
  pericias: ClassePericiaSpec;
  pv: {
    inicial: number | null;
    por_nivel: number | null;
    soma_atributo_inicial: string | null;
    soma_atributo_por_nivel: string | null;
  };
  pm: { por_nivel: number };
  proficiencias: string[];
  habilidades_classe_ids: string[];
  poderes_classe_ids: string[];
  caminhos?: CaminhoDef[];
}

const classesData = classesDataRaw as unknown as Record<string, ClasseData>;

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Authoritative class rules from the ported T20-DB data.
 * The Foundry classe item carries NO rules — only the item to attach.
 * Lookup by db id or by Foundry display name (slug-matched).
 */
export function getClasse(idOrName: string): ClasseData | null {
  const s = slug(idOrName);
  if (classesData[s]) return classesData[s];
  for (const [id, data] of Object.entries(classesData)) {
    if (slug(data.nome) === s || s.startsWith(id) || id.startsWith(s)) return data;
  }
  // Classe que só existe no compêndio (ver registrarClassesDoCompendio).
  return doCompendio.get(s) ?? null;
}

/**
 * Percorre a cadeia de sub-escolhas do caminho escolhido, na ordem, parando na
 * primeira ainda sem resposta. Devolve as perguntas em aberto e as respondidas.
 */
export function cadeiaSubEscolhas(
  classeNome: string,
  caminhoSlug: string,
  escolhas: Record<string, unknown>
): { respondidas: Record<string, string>; pendente: SubEscolhaDef | null } {
  const respondidas: Record<string, string> = {};
  let sub = getClasse(classeNome)?.caminhos?.find((c) => c.slug === caminhoSlug)?.sub ?? null;

  while (sub) {
    const resposta = escolhas[sub.chave] as string | undefined;
    if (!resposta) return { respondidas, pendente: sub };
    respondidas[sub.chave] = resposta;
    sub = sub.opcoes.find((o) => o.id === resposta)?.sub ?? null;
  }
  return { respondidas, pendente: null };
}

/**
 * Resposta da sub-escolha cuja chave começa com `classe_<prefixo>`.
 * Usado para ler a linhagem do feiticeiro sem depender do nome exato da chave.
 */
export function respostaSubEscolha(
  classeNome: string,
  caminhoSlug: string,
  escolhas: Record<string, unknown>,
  prefixo: string
): string {
  const { respondidas } = cadeiaSubEscolhas(classeNome, caminhoSlug, escolhas);
  const alvo = `classe_${prefixo}`;
  for (const [chave, valor] of Object.entries(respondidas)) {
    if (chave === alvo || chave.startsWith(`${alvo}_`)) {
      // a mais rasa vence: `classe_linhagem_feiticeiro` antes de `..._draconica`
      if (chave.split("_").length <= alvo.split("_").length + 1) return valor;
    }
  }
  return "";
}

/* ------------------------------------------------------------------ */
/*  Classes que só existem no compêndio                                */
/* ------------------------------------------------------------------ */

/**
 * O T20-DB tem só as 14 classes do Livro Básico. Samurai, Místico e as de
 * Heróis de Arton chegavam ao passo Perícias sem nada para escolher.
 *
 * O módulo registra aqui as classes do compêndio no boot; `getClasse` cai
 * nelas quando o T20-DB não conhece o nome. `rules/` continua sem importar
 * nada do Foundry — quem chama é o `module.ts`.
 */
const doCompendio = new Map<string, ClasseData>();

export function registrarClassesDoCompendio(itens: IndexedClasse[]): void {
  doCompendio.clear();
  for (const item of itens) {
    doCompendio.set(slug(item.name), classeDoCompendio(item));
  }
}

export function classesRegistradas(): number {
  return doCompendio.size;
}
