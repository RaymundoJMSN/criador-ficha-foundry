import racasDataRaw from "../../data/racas.json";
const racasData = racasDataRaw as unknown as Array<Record<string, unknown>>;

import type { WizardState } from "../state.js";
import type { IndexedRace } from "../../compendium/types.js";

export interface RacaOption {
  id: string;
  name: string;
  selected: boolean;
}

export interface AtributoEscolha {
  quantidade: number;
  opcoes: string[];
}

export interface RacaDetail {
  id: string;
  name: string;
  descricao: string;
  atributosTexto: string;
  atributosEscolha: AtributoEscolha | null;
  pericias_bonus: string[];
  tamanho: string;
  deslocamento: number | string;
}

export interface RacaContext {
  stepTitle: string;
  racaOptions: RacaOption[];
  selectedDetail: RacaDetail | null;
  errors: string[];
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatAtributos(data: Record<string, unknown>): string {
  const fixos = data["atributos_fixos"] as Array<{ atributo: string; valor: number }> | undefined;
  const escolhas = data["atributos_escolha"] as
    | Array<{ valor: number; quantidade: number }>
    | undefined;

  const parts: string[] = [];
  if (fixos) {
    parts.push(
      ...fixos
        .filter((f) => f.valor !== 0)
        .map((f) => `${f.valor > 0 ? "+" : ""}${f.valor} ${f.atributo}`)
    );
  }
  if (escolhas) {
    parts.push(...escolhas.map((e) => `+${e.valor} em ${e.quantidade} atributo(s) à escolha`));
  }
  return parts.join(", ") || "—";
}

function getAtributosEscolha(data: Record<string, unknown>): AtributoEscolha | null {
  const escolhas = data["atributos_escolha"] as
    | Array<{ valor: number; quantidade: number }>
    | undefined;
  if (!escolhas || escolhas.length === 0) return null;
  const first = escolhas[0];
  return {
    quantidade: first.quantidade,
    opcoes: ["For", "Des", "Con", "Int", "Sab", "Car"],
  };
}

export function prepareRacaContext(
  state: WizardState,
  racas: IndexedRace[],
  errors: string[] = []
): RacaContext {
  const racaOptions: RacaOption[] = racas.map((r) => ({
    id: r.id,
    name: r.name,
    selected: r.id === state.racaId,
  }));

  const selectedFoundry = racas.find((r) => r.id === state.racaId);
  let selectedDetail: RacaDetail | null = null;

  if (selectedFoundry) {
    const nameSlug = toSlug(selectedFoundry.name);
    const dbRaca =
      racasData.find(
        (r) => String(r["id"]) === nameSlug || toSlug(String(r["nome"] ?? "")) === nameSlug
      ) ?? null;

    selectedDetail = {
      id: selectedFoundry.id,
      name: selectedFoundry.name,
      descricao: String(dbRaca?.["descricao"] ?? ""),
      atributosTexto: dbRaca ? formatAtributos(dbRaca) : "",
      atributosEscolha: dbRaca ? getAtributosEscolha(dbRaca) : null,
      pericias_bonus: (dbRaca?.["bonus_pericias"] as string[] | undefined) ?? [],
      tamanho: String(dbRaca?.["tamanho"] ?? "médio"),
      deslocamento: (dbRaca?.["deslocamento"] as number | string | undefined) ?? 9,
    };
  }

  return {
    stepTitle: "Raça",
    racaOptions,
    selectedDetail,
    errors,
  };
}
