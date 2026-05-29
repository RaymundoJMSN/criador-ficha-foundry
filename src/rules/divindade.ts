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

export function isDivindadeAcessa(divindadeId: string, racaId: string, classeId: string): boolean {
  const div = getDivindade(divindadeId);
  if (!div) return false;

  const { devotos_aceitos } = div;

  if (devotos_aceitos.regra === "qualquer") return true;

  const racas = devotos_aceitos.racas_aceitas;
  const classes = devotos_aceitos.classes_aceitas;

  const racaOk = !racas || racas === "todas" || (Array.isArray(racas) && racas.includes(racaId));

  const classeOk =
    !classes || classes === "todas" || (Array.isArray(classes) && classes.includes(classeId));

  return racaOk || classeOk;
}

export function listDivindadesParaPersonagem(racaId: string, classeId: string): Divindade[] {
  return divindadesData.filter((d) => isDivindadeAcessa(d.id, racaId, classeId));
}

export function isDivindadeObrigatoria(classeId: string): boolean {
  return CLASSES_OBRIGATORIAS.has(classeId);
}
