/**
 * Resolve um slug do T20-DB para o item correspondente no compêndio do sistema.
 *
 * Os dois lados nomeiam a mesma coisa de formas diferentes, e é daí que vinha a
 * maior parte dos "poder não encontrado":
 *
 * | T20-DB                            | Compêndio                          | regra    |
 * |-----------------------------------|------------------------------------|----------|
 * | `ambidestria`                     | Ambidestria (Guerreiro)            | classe   |
 * | `furia_+2`, `ataque_furtivo_1d6`  | Fúria, Ataque Furtivo              | prefixo  |
 * | `magias_2_circulo`                | Magias (Clérigo)                   | pfx+cls  |
 * | `virtude_temperanca`              | Virtude Paladinesca: Temperança    | grupo    |
 * | `linhagem_basica_draconica`       | Linhagem Dracônica Básica          | tokens   |
 * | `sorte_de_nimb`                   | Sorte do Louco                     | override |
 *
 * Passe `tipo` quando souber o que procura. Sem isso, um item de outro módulo
 * pode roubar o casamento: o bestiário tem um poder RACIAL chamado "Magias", e
 * `magias` é prefixo de `magias_1_circulo` — o arcanista recebia esse em vez de
 * "Magias (Arcanista)". Com `tipo: "ability"` a escada roda primeiro só entre
 * habilidades de classe e só depois, se não achar, entre todos os itens.
 *
 * Rodar `node scripts/auditar-slugs.mjs` mede quanto ainda não resolve.
 */
import { toNomeSlug } from "./slug.js";
import slugMapRaw from "../data/slug-map.json";

const SLUG_MAP = slugMapRaw as Record<string, string>;

export interface Nomeavel {
  name: string;
  system?: { descricao?: string; tipo?: string };
}

/** Como o slug foi resolvido — útil no log e na auditoria. */
export type ViaResolucao =
  | "override"
  | "exato"
  | "classe"
  | "prefixo"
  | "prefixo+classe"
  | "grupo"
  | "tokens"
  | "tokens+classe";

export interface Resolucao<T> {
  item: T;
  via: ViaResolucao;
}

/** Itens duplicados existem (dois "Abençoado", um vazio) — o com texto vence. */
function melhor<T extends Nomeavel>(candidatos: T[]): T | null {
  if (candidatos.length === 0) return null;
  return candidatos.find((c) => (c.system?.descricao ?? "").trim().length > 0) ?? candidatos[0]!;
}

function chaveTokens(slug: string): string {
  return slug.split("_").filter(Boolean).sort().join("|");
}

/**
 * Acha o item do compêndio para um slug do T20-DB.
 * `classeSlug` desempata os poderes compartilhados entre classes; passe "" quando não houver.
 * Devolve `null` quando o conteúdo simplesmente não está instalado (a maior parte dos
 * poderes de classe de Heróis de Arton, por exemplo) — isso não é erro.
 */
export function resolverPoder<T extends Nomeavel>(
  slug: string,
  classeSlug: string,
  itens: T[],
  tipoEsperado?: string
): Resolucao<T> | null {
  if (!slug) return null;
  // O slug do T20-DB às vezes vem com acento ou cedilha ("adereço_musical",
  // "postura_aríete_implacavel"); passar pela mesma normalização dos nomes.
  slug = toNomeSlug(slug);

  if (tipoEsperado) {
    const doTipo = itens.filter((i) => i.system?.tipo === tipoEsperado);
    const achado = doTipo.length > 0 ? escada(slug, classeSlug, doTipo) : null;
    if (achado) return achado;
  }
  return escada(slug, classeSlug, itens);
}

function escada<T extends Nomeavel>(
  slug: string,
  classeSlug: string,
  itens: T[]
): Resolucao<T> | null {
  const comSlug = itens.map((item) => ({ item, slug: toNomeSlug(item.name) }));
  const porSlug = (alvo: string): T[] => comSlug.filter((c) => c.slug === alvo).map((c) => c.item);

  const override = SLUG_MAP[slug];
  if (override) {
    const achado = melhor(porSlug(override));
    if (achado) return { item: achado, via: "override" };
  }

  const exato = melhor(porSlug(slug));
  if (exato) return { item: exato, via: "exato" };

  if (classeSlug) {
    const comClasse = melhor(porSlug(`${slug}_${classeSlug}`));
    if (comClasse) return { item: comClasse, via: "classe" };
  }

  // Habilidade parametrizada: o slug carrega o valor do nível (`furia_+2`), o item não.
  let maiorPrefixo: { item: T; slug: string } | null = null;
  for (const c of comSlug) {
    if (!c.slug || !slug.startsWith(c.slug + "_")) continue;
    if (!maiorPrefixo || c.slug.length > maiorPrefixo.slug.length) maiorPrefixo = c;
  }
  if (maiorPrefixo) return { item: maiorPrefixo.item, via: "prefixo" };

  const partes = slug.split("_").filter(Boolean);

  if (classeSlug) {
    for (let n = partes.length - 1; n >= 1; n--) {
      const achado = melhor(porSlug(`${partes.slice(0, n).join("_")}_${classeSlug}`));
      if (achado) return { item: achado, via: "prefixo+classe" };
    }
  }

  // Grupo com dois-pontos: "virtude_temperanca" ↔ "Virtude Paladinesca: Temperança".
  const cabeca = partes[0];
  const cauda = partes.slice(1).join("_");
  if (cabeca && cauda) {
    const grupo = comSlug
      .filter((c) => c.slug.startsWith(cabeca + "_") && c.slug.endsWith("_" + cauda))
      .map((c) => c.item);
    if (grupo.length === 1) return { item: grupo[0]!, via: "grupo" };
  }

  // Mesmas palavras, ordem diferente: "linhagem_basica_draconica" ↔ "Linhagem Dracônica Básica".
  const chave = chaveTokens(slug);
  const mesmosTokens = comSlug.filter((c) => chaveTokens(c.slug) === chave).map((c) => c.item);
  if (mesmosTokens.length === 1) return { item: mesmosTokens[0]!, via: "tokens" };

  if (classeSlug) {
    const chaveC = chaveTokens(`${slug}_${classeSlug}`);
    const comClasse = comSlug.filter((c) => chaveTokens(c.slug) === chaveC).map((c) => c.item);
    if (comClasse.length === 1) return { item: comClasse[0]!, via: "tokens+classe" };
  }

  return null;
}
