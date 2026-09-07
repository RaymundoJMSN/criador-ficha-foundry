import divindadesDataRaw from "../data/divindades.json";
import deusesMenoresRaw from "../data/deuses_menores.json";
import { toNomeSlug } from "../compendium/slug.js";
const divindadesData = divindadesDataRaw as unknown as Divindade[];

interface DeusMenorPortado {
  id: string;
  nome: string;
  curto: string;
  devotos: { qualquer: boolean; racas: string[]; classes: string[] };
}
const deusesMenoresPortados = deusesMenoresRaw as DeusMenorPortado[];

/** Deuses menores (Guia de Deuses Menores + os que só existem no compêndio). */
const deusesMenores: Divindade[] = [];

export interface DevotosAceitos {
  regra: "qualquer" | "lista_restrita" | "druida" | string;
  racas_aceitas?: string[] | "todas";
  classes_aceitas?: string[] | "todas";
}

export interface Divindade {
  id: string;
  nome: string;
  devotos_aceitos: DevotosAceitos;
  poderes_concedidos: string[];
  /** Deus menor: a lista "Devotos" do Guia vale ao pé da letra (sem coringa humano/clérigo). */
  menor?: boolean;
}

const CLASSES_OBRIGATORIAS = new Set(["clerigo", "paladino", "druida"]);

/**
 * "Você pode cultuar o Panteão como um todo. Não recebe nenhum Poder Concedido,
 * mas sua única obrigação e restrição é não usar armas cortantes ou perfurantes"
 * (LB p.103, Clérigo; Deuses de Arton, Frade). Só essas duas classes.
 */
export const PANTEAO: Divindade = {
  id: "panteao",
  nome: "Panteão (como um todo)",
  devotos_aceitos: { regra: "lista_restrita", classes_aceitas: ["clerigo", "frade"] },
  poderes_concedidos: [],
};
const CLASSES_DO_PANTEAO = new Set(["clerigo", "frade"]);

export function listDivindades(): Divindade[] {
  return [...divindadesData, ...deusesMenores];
}

export function getDivindade(id: string): Divindade | null {
  if (id === PANTEAO.id) return PANTEAO;
  return divindadesData.find((d) => d.id === id) ?? deusesMenores.find((d) => d.id === id) ?? null;
}

const normNome = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const curtoDe = (nome: string) => normNome(nome.split(",")[0] ?? nome);

/**
 * Monta os deuses menores a partir dos poderes concedidos do compêndio
 * (`tipo:"concedido"`, `subtipo` = nome do deus) e da lista "Devotos" portada do
 * Guia de Deuses Menores. Deus que só existe no compêndio (Mauziell, Tibar…)
 * entra sem restrição de devotos. Chamar depois do CompendiumIndex.build().
 */
export function registrarDeusesMenores(
  concedidos: Array<{ name: string; system?: { subtipo?: string } }>
): number {
  deusesMenores.length = 0;
  const majores = new Set(divindadesData.map((d) => normNome(d.nome)));
  // subtipo → {nome de exibição, slugs dos poderes}
  const porDeus = new Map<string, { nome: string; slugs: string[] }>();
  for (const p of concedidos) {
    const sub = p.system?.subtipo?.replace(/\s+/g, " ").trim();
    // "Allihanna, Azgher" = poder partilhado por deuses maiores; "system.…" = lixo do pacote.
    if (!sub || sub.includes("system.") || sub.split(",").some((parte) => majores.has(normNome(parte)))) continue;
    const chave = curtoDe(sub);
    const entrada = porDeus.get(chave) ?? { nome: sub, slugs: [] };
    entrada.slugs.push(slugPoder(p.name));
    porDeus.set(chave, entrada);
  }
  const vistos = new Set<string>();
  for (const d of deusesMenoresPortados) {
    const chave = normNome(d.curto);
    const doCompendio = porDeus.get(chave);
    vistos.add(chave);
    deusesMenores.push({
      id: d.id,
      nome: doCompendio?.nome ?? d.nome,
      menor: true,
      devotos_aceitos: d.devotos.qualquer
        ? { regra: "qualquer", racas_aceitas: "todas", classes_aceitas: "todas" }
        : { regra: "lista_restrita", racas_aceitas: d.devotos.racas, classes_aceitas: d.devotos.classes },
      poderes_concedidos: doCompendio?.slugs ?? [],
    });
  }
  for (const [chave, e] of porDeus) {
    if (vistos.has(chave)) continue;
    // Subtipo que não é nome de deus ("Honra", "Ambição" da Tradição de Samurai) fica de fora.
    if (!/(deus|deusa|drag[aã]o|dragoa|gigante)/i.test(e.nome)) continue;
    deusesMenores.push({
      id: slugPoder(e.nome.split(",")[0] ?? e.nome),
      nome: e.nome,
      menor: true,
      devotos_aceitos: { regra: "qualquer", racas_aceitas: "todas", classes_aceitas: "todas" },
      poderes_concedidos: e.slugs,
    });
  }
  deusesMenores.sort((a, b) => a.nome.localeCompare(b.nome));
  return deusesMenores.length;
}

/** Mesmo slug do resolver ("exato"), senão o nome do poder não casa na tela. */
const slugPoder = (nome: string): string => toNomeSlug(nome);

/** "kobolds" (id do T20-DB) ↔ "kobold" (Guia): compara sem o plural. */
const mesmoSlug = (a: string, b: string) => a.replace(/s$/, "") === b.replace(/s$/, "");

/**
 * "Para ser devoto de um deus, sua raça **ou** sua classe devem estar listadas na
 * seção Devotos. Humanos e clérigos são exceção — podem ser devotos de qualquer
 * divindade." (LB cap. 2, Deuses → Requisitos)
 *
 * Era um E entre raça e classe, o que deixava um arcanista humano com três deuses
 * na lista em vez de todos.
 */
const RACAS_CORINGA = new Set(["humano"]);
const CLASSES_CORINGA = new Set(["clerigo"]);

export function isDivindadeAcessa(
  divindadeSlug: string,
  racaSlug: string,
  classeSlug: string,
  /** Devoções Abertas (HA p.281): qualquer deus, independente de raça ou classe. */
  abertas = false
): boolean {
  const div = getDivindade(divindadeSlug);
  if (!div) return false;
  // Regra de classe, não de devoção: nem Devoções Abertas nem humano abrem o Panteão.
  if (div.id === PANTEAO.id) return CLASSES_DO_PANTEAO.has(classeSlug);
  if (abertas) return true;

  // Coringa (humano/clérigo) é regra do Panteão maior; deus menor diz quem aceita.
  if (!div.menor && (RACAS_CORINGA.has(racaSlug) || CLASSES_CORINGA.has(classeSlug))) return true;

  const { devotos_aceitos } = div;
  if (devotos_aceitos.regra === "qualquer") return true;

  const racas = devotos_aceitos.racas_aceitas;
  const classes = devotos_aceitos.classes_aceitas;

  const racaListada =
    racas === "todas" || (Array.isArray(racas) && !!racaSlug && racas.some((r) => mesmoSlug(r, racaSlug)));
  const classeListada =
    classes === "todas" || (Array.isArray(classes) && !!classeSlug && classes.includes(classeSlug));

  // Sem nenhuma das duas listas declaradas, o deus não restringe.
  if (racas === undefined && classes === undefined) return true;

  return racaListada || classeListada;
}

export function listDivindadesParaPersonagem(racaId: string, classeId: string, abertas = false): Divindade[] {
  // O T20-DB também traz um "panteao"; vale o daqui (com a regra de classe).
  return [...listDivindades().filter((d) => d.id !== PANTEAO.id), PANTEAO].filter((d) =>
    isDivindadeAcessa(d.id, racaId, classeId, abertas)
  );
}

export function isDivindadeObrigatoria(classeId: string): boolean {
  return CLASSES_OBRIGATORIAS.has(classeId);
}

/**
 * Quantos poderes concedidos o devoto escolhe.
 *
 * "Ao se tornar devoto, você recebe UM poder concedido a sua escolha da lista do
 * deus" (LB p.96). Clérigo, druida e paladino: "Ao contrário de devotos normais,
 * você recebe DOIS poderes concedidos, em vez de apenas um" (Devoto Fiel /
 * Abençoado). Em nenhum caso são todos — o wizard concedia a lista inteira.
 */
export function poderesConcedidosParaEscolher(classeSlug: string, temDivindade: boolean): number {
  if (!temDivindade) return 0;
  return CLASSES_OBRIGATORIAS.has(classeSlug) ? 2 : 1;
}
