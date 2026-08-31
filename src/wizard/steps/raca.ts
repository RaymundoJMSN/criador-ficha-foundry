import type { WizardState } from "../state.js";
import type { IndexedPoder, IndexedRace } from "../../compendium/types.js";
import { getRaceModifierGroups } from "../../rules/subescolhas.js";
import { getRaca, type RacaData } from "../../rules/raca.js";

export interface RacaOption {
  id: string;
  name: string;
  selected: boolean;
}

const ATRIBUTO_OPCOES: Array<{ code: string; label: string }> = [
  { code: "for", label: "Força" },
  { code: "des", label: "Destreza" },
  { code: "con", label: "Constituição" },
  { code: "int", label: "Inteligência" },
  { code: "sab", label: "Sabedoria" },
  { code: "car", label: "Carisma" },
];

const ATRIBUTO_LABEL: Record<string, string> = Object.fromEntries(
  ATRIBUTO_OPCOES.map((a) => [a.code, a.label])
);

const TAMANHO_LABEL: Record<string, string> = {
  min: "Minúsculo",
  minusculo: "Minúsculo",
  peq: "Pequeno",
  pequeno: "Pequeno",
  med: "Médio",
  medio: "Médio",
  media: "Médio",
  gra: "Grande",
  grande: "Grande",
  eno: "Enorme",
  enorme: "Enorme",
  col: "Colossal",
  colossal: "Colossal",
};

export interface ModSlot {
  groupIndex: number;
  slotIndex: number;
  selected: string;
  opcoes: Array<{ code: string; label: string; selected: boolean }>;
}

export interface ModGroup {
  groupIndex: number;
  valor: number;
  quantidade: number;
  diferentes: boolean;
  /** Frase pronta: "+1 em 3 atributos diferentes, sem Constituição". */
  titulo: string;
  observacao: string;
  slots: ModSlot[];
}

export interface PoderRacial {
  nome: string;
  descricao: string;
}

export interface RacaDetail {
  id: string;
  name: string;
  descricao: string;
  atributosTexto: string;
  modGroups: ModGroup[];
  poderesRaciais: PoderRacial[];
  periciasBonus: string[];
  tamanho: string;
  deslocamento: string;
}

export interface RacaContext {
  stepTitle: string;
  racaOptions: RacaOption[];
  selectedDetail: RacaDetail | null;
  errors: string[];
}

function listar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function formatAtributos(raca: RacaData): string {
  const partes = raca.atributos_fixos
    .filter((f) => f.valor !== 0)
    .map((f) => `${f.valor > 0 ? "+" : ""}${f.valor} ${ATRIBUTO_LABEL[f.atributo] ?? f.atributo}`);
  for (const e of raca.atributos_escolha) {
    partes.push(`+${e.valor} em ${e.quantidade} atributo(s) à escolha`);
  }
  return partes.join(", ") || "—";
}

/**
 * Monta os seletores de atributo escolhível.
 *
 * Duas regras que a UI antiga ignorava e a ficha aceitava errado:
 * - `atributos_diferentes`: o mesmo atributo não pode aparecer em dois slots,
 *   então some das opções dos outros;
 * - `atributos_disponiveis`: Osteon não pode Constituição, Lefou não pode
 *   Carisma. Antes os seis apareciam sempre, sem dizer nada.
 */
function buildModGroups(racaRef: string, choices: string[][]): ModGroup[] {
  return getRaceModifierGroups(racaRef).map((def, gi) => {
    const qtd = def.quantidade ?? 1;
    const escolhidos = choices[gi] ?? [];
    const diferentes = Boolean(def.atributos_diferentes);
    const disponiveis = def.atributos_disponiveis ?? null;

    const permitidos = ATRIBUTO_OPCOES.filter((o) => !disponiveis || disponiveis.includes(o.code));
    const proibidos = ATRIBUTO_OPCOES.filter((o) => disponiveis && !disponiveis.includes(o.code));

    const slots: ModSlot[] = [];
    for (let si = 0; si < qtd; si++) {
      const sel = escolhidos[si] ?? "";
      const usadosEmOutros = new Set(escolhidos.filter((_, i) => i !== si).filter(Boolean));
      slots.push({
        groupIndex: gi,
        slotIndex: si,
        selected: sel,
        opcoes: permitidos
          .filter((o) => !diferentes || o.code === sel || !usadosEmOutros.has(o.code))
          .map((o) => ({ ...o, selected: o.code === sel })),
      });
    }

    const valor = def.valor ?? 1;
    let titulo = `${valor > 0 ? "+" : ""}${valor} em ${qtd} atributo${qtd > 1 ? "s" : ""}`;
    if (diferentes) titulo += " diferentes";
    if (proibidos.length > 0) {
      titulo += ` — não pode ${listar(proibidos.map((p) => p.label))}`;
    }

    return {
      groupIndex: gi,
      valor,
      quantidade: qtd,
      diferentes,
      titulo,
      observacao: def.observacao ?? "",
      slots,
    };
  });
}

function limparHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Poderes que o item de raça concede — o sistema os anexa junto da raça. */
function poderesDaRaca(raca: IndexedRace, todosPoderes: IndexedPoder[]): PoderRacial[] {
  const porId = new Map(todosPoderes.map((p) => [p.id, p]));
  const out: PoderRacial[] = [];
  for (const grant of raca.system.grants ?? []) {
    for (const escolha of grant.choices ?? []) {
      const id = String(escolha.uuid ?? "").split(".").pop();
      const poder = id ? porId.get(id) : undefined;
      if (poder) out.push({ nome: poder.name, descricao: limparHtml(poder.system.descricao ?? "") });
    }
  }
  return out;
}

export function prepareRacaContext(
  state: WizardState,
  racas: IndexedRace[],
  errors: string[] = [],
  todosPoderes: IndexedPoder[] = []
): RacaContext {
  const racaOptions: RacaOption[] = racas.map((r) => ({
    id: r.id,
    name: r.name,
    selected: r.id === state.racaId,
  }));

  const selecionada = racas.find((r) => r.id === state.racaId);
  let selectedDetail: RacaDetail | null = null;

  if (selecionada) {
    const dbRaca = getRaca(selecionada.name);
    const choices = (state.escolhasPorItem["raca_modificadores"] as string[][] | undefined) ?? [];

    // O texto bom é o do item do compêndio; o T20-DB portado não traz descrição.
    const descricaoFoundry = limparHtml(selecionada.system.description?.value ?? "");
    const tamanhoBruto = (selecionada.system.tamanho?.[0] ?? dbRaca?.tamanho ?? "med").toString();
    const deslocamento = selecionada.system.movement?.walk ?? dbRaca?.deslocamento ?? 9;
    const unidade = selecionada.system.movement?.unit ?? "m";

    selectedDetail = {
      id: selecionada.id,
      name: selecionada.name,
      descricao: descricaoFoundry || String(dbRaca?.descricao ?? ""),
      atributosTexto: dbRaca ? formatAtributos(dbRaca) : "—",
      modGroups: dbRaca ? buildModGroups(selecionada.name, choices) : [],
      poderesRaciais: poderesDaRaca(selecionada, todosPoderes),
      periciasBonus: (dbRaca?.bonus_pericias ?? []).map((p) =>
        typeof p === "string" ? p : String((p as { pericia?: string }).pericia ?? "")
      ),
      tamanho: TAMANHO_LABEL[tamanhoBruto.toLowerCase()] ?? tamanhoBruto,
      deslocamento: `${deslocamento} ${unidade}`,
    };
  }

  return {
    stepTitle: "Raça",
    racaOptions,
    selectedDetail,
    errors,
  };
}
