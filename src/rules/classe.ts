import classesDataRaw from "../data/classes.json";

export interface EscolhaObrigatoria {
  quantidade: number;
  opcoes: string[];
}

export interface ClassePericiaSpec {
  fixas: string[];
  escolhas_obrigatorias: EscolhaObrigatoria[];
  escolhas: { quantidade: number; opcoes: string[] };
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
  caminhos?: string[]; // slugs of multipath choices (e.g. arcanista: feiticeiro/mago/bruxo)
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
  return null;
}
