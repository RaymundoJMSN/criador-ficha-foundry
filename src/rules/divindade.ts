import divindadesDataRaw from "../data/divindades.json";
const divindadesData = divindadesDataRaw as unknown as Divindade[];

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
}

const CLASSES_OBRIGATORIAS = new Set(["clerigo", "paladino", "druida"]);

export function listDivindades(): Divindade[] {
  return divindadesData;
}

export function getDivindade(id: string): Divindade | null {
  return divindadesData.find((d) => d.id === id) ?? null;
}

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

export function isDivindadeAcessa(divindadeSlug: string, racaSlug: string, classeSlug: string): boolean {
  const div = getDivindade(divindadeSlug);
  if (!div) return false;

  if (RACAS_CORINGA.has(racaSlug) || CLASSES_CORINGA.has(classeSlug)) return true;

  const { devotos_aceitos } = div;
  if (devotos_aceitos.regra === "qualquer") return true;

  const racas = devotos_aceitos.racas_aceitas;
  const classes = devotos_aceitos.classes_aceitas;

  const racaListada =
    racas === "todas" || (Array.isArray(racas) && !!racaSlug && racas.includes(racaSlug));
  const classeListada =
    classes === "todas" || (Array.isArray(classes) && !!classeSlug && classes.includes(classeSlug));

  // Sem nenhuma das duas listas declaradas, o deus não restringe.
  if (racas === undefined && classes === undefined) return true;

  return racaListada || classeListada;
}

export function listDivindadesParaPersonagem(racaId: string, classeId: string): Divindade[] {
  return divindadesData.filter((d) => isDivindadeAcessa(d.id, racaId, classeId));
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
