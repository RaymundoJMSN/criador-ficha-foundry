import type { WizardState } from "../state.js";
import type { IndexedPoder, IndexedRace } from "../../compendium/types.js";
import { getRaceModifierGroups, valoresFixosDaRaca, distribuirAbertos } from "../../rules/subescolhas.js";
import {
  getRaca,
  escolhasDaRaca,
  pedidoAtivo,
  partesDoPedido,
  type PedidoRacial,
  type RacaData,
} from "../../rules/raca.js";
import { PERICIA_SLUGS } from "../../rules/pericia-slug.js";
import textosRaw from "../../data/textos.json";
import { describeUnmet, type PartialWizardState } from "../../rules/poderes.js";
import { toNomeSlug } from "../../compendium/slug.js";
import type { IndexedMagia } from "../../compendium/types.js";

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

export interface PickerOpcao {
  id: string;
  nome: string;
  selected: boolean;
}

export interface PickerRacial {
  name: string;
  label: string;
  opcoes: PickerOpcao[];
}

export interface EscolhaRacialView {
  chave: string;
  habilidade: string;
  ramos: Array<{ id: string; rotulo: string; selected: boolean }>;
  pickers: PickerRacial[];
}

export interface RacaAbertaView {
  slots: Array<{ idx: number; valor: string; opcoes: Array<{ code: string; label: string; selected: boolean }> }>;
  erros: string[];
}

function montarRacaAberta(racaNome: string, escolhas: Record<string, unknown>): RacaAbertaView | null {
  const valores = valoresFixosDaRaca(racaNome);
  if (valores.length === 0) return null;
  const dist = (escolhas["raca_aberta"] as Record<string, string> | undefined) ?? {};
  const slots = valores.map((v, idx) => ({
    idx,
    valor: v > 0 ? `+${v}` : String(v),
    opcoes: (["for", "des", "con", "int", "sab", "car"] as const).map((code) => ({
      code,
      label: ATTR_LABELS_ABERTA[code],
      selected: dist[String(idx)] === code,
    })),
  }));
  return { slots, erros: distribuirAbertos(racaNome, dist).erros };
}

const ATTR_LABELS_ABERTA: Record<string, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

export interface RacaDetail {
  id: string;
  name: string;
  descricao: string;
  atributosTexto: string;
  modGroups: ModGroup[];
  /** Raças Abertas (HA p.281): um select por modificador fixo da raça. */
  racaAberta: RacaAbertaView | null;
  poderesRaciais: PoderRacial[];
  periciasBonus: string[];
  tamanho: string;
  deslocamento: string;
  /** Memória Póstuma, Deformidade, Fonte Elemental… */
  escolhasRaciais: EscolhaRacialView[];
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
      if (poder) out.push({ nome: poder.name, descricao: poder.system.descricao ?? "" });
    }
  }
  return out;
}

export function prepareRacaContext(
  state: WizardState,
  racas: IndexedRace[],
  errors: string[] = [],
  todosPoderes: IndexedPoder[] = [],
  todasMagias: IndexedMagia[] = []
): RacaContext {
  const permitidas = state.config.racasPermitidas;
  const racaOptions: RacaOption[] = racas
    .filter((r) => permitidas.length === 0 || permitidas.includes(r.name))
    .map((r) => ({
      id: r.id,
      name: r.name,
      selected: r.id === state.racaId,
    }));

  const selecionada = racas.find((r) => r.id === state.racaId);
  let selectedDetail: RacaDetail | null = null;

  if (selecionada) {
    const dbRaca = getRaca(selecionada.name);
    const choices = (state.escolhasPorItem["raca_modificadores"] as string[][] | undefined) ?? [];

    // O item de raça do compêndio vem com description vazia, então o texto sai
    // do textos.json (gerado dos livros; gitignorado).
    const descricaoFoundry =
      selecionada.system.descricao || (dbRaca ? (textos.racas?.[dbRaca.id] ?? "") : "");
    const tamanhoBruto = (selecionada.system.tamanho?.[0] ?? dbRaca?.tamanho ?? "med").toString();
    const deslocamento = selecionada.system.movement?.walk ?? dbRaca?.deslocamento ?? 9;
    const unidade = selecionada.system.movement?.unit ?? "m";

    selectedDetail = {
      id: selecionada.id,
      name: selecionada.name,
      descricao: descricaoFoundry || String(dbRaca?.descricao ?? ""),
      atributosTexto: dbRaca ? formatAtributos(dbRaca) : "—",
      modGroups: dbRaca ? buildModGroups(selecionada.name, choices) : [],
      racaAberta: state.config.racasAbertas && dbRaca ? montarRacaAberta(selecionada.name, state.escolhasPorItem) : null,
      poderesRaciais: poderesDaRaca(selecionada, todosPoderes),
      periciasBonus: (dbRaca?.bonus_pericias ?? []).map((p) =>
        typeof p === "string" ? p : String((p as { pericia?: string }).pericia ?? "")
      ),
      tamanho: TAMANHO_LABEL[tamanhoBruto.toLowerCase()] ?? tamanhoBruto,
      deslocamento: `${deslocamento} ${unidade}`,
      escolhasRaciais: montarEscolhasRaciais(
        selecionada.name,
        state.escolhasPorItem,
        todosPoderes,
        todasMagias,
        {
          nivel: state.nivel,
          atributos: state.atributosBase,
          classeSlug: toNomeSlug(state.classeNome ?? ""),
          racaSlug: toNomeSlug(selecionada.name),
          periciasTreinadas: state.periciasTreinadas,
          poderes: [],
        },
        racas
      ),
    };
  }

  return {
    stepTitle: "Raça",
    racaOptions,
    selectedDetail,
    errors,
  };
}

const textos = textosRaw as { racas?: Record<string, string> };

const PERICIA_NOME: Record<string, string> = Object.fromEntries(
  PERICIA_SLUGS.map((slug) => [
    slug,
    slug
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  ])
);

/** Opções de um pedido, já filtradas pelo que o personagem alcança. */
function opcoesDoPedido(
  pedido: PedidoRacial,
  ctx: {
    escolhido: string;
    poderes: IndexedPoder[];
    magias: IndexedMagia[];
    racaAtual: string;
    elegibilidade: PartialWizardState;
  }
): PickerOpcao[] {
  const marcar = (id: string, nome: string): PickerOpcao => ({
    id,
    nome,
    selected: id === ctx.escolhido,
  });

  switch (pedido.tipo) {
    case "lista":
      return (pedido.opcoes ?? []).map((o) => marcar(o.id, o.rotulo));

    case "pericia": {
      const slugs = pedido.filtro === "oficio" ? ["oficio"] : PERICIA_SLUGS;
      return slugs.map((slug) => marcar(slug, PERICIA_NOME[slug] ?? slug));
    }

    case "poder":
      return ctx.poderes
        .filter((p) =>
          pedido.categoria === "geral"
            ? p.system.tipo === "geral"
            : p.system.subtipo === pedido.categoria
        )
        .filter((p) => describeUnmet(toNomeSlug(p.name), ctx.elegibilidade).length === 0)
        .map((p) => marcar(p.id, p.name))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    case "magia":
      return ctx.magias
        .filter((m) => Number(m.system.circulo) === (pedido.circulo ?? 1))
        .map((m) => marcar(m.id, m.name))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    case "habilidade_outra_raca":
      // Tratado fora daqui: precisa de dois seletores encadeados (raça → habilidade).
      return [];

    default:
      return [];
  }
}

function rotuloDoPedido(pedido: PedidoRacial): string {
  switch (pedido.tipo) {
    case "pericia":
      return pedido.bonus ? `Perícia (+${pedido.bonus})` : "Perícia treinada";
    case "poder":
      return `Poder de ${pedido.categoria ?? "geral"}`;
    case "magia":
      return `Magia de ${pedido.circulo ?? 1}º círculo`;
    case "habilidade_outra_raca":
      return "Habilidade de outra raça";
    default:
      return "Escolha";
  }
}

/**
 * "Ser osteon de outra raça humanoide e herdar 1 habilidade dessa raça."
 * Duas perguntas, nesta ordem: qual raça, e só então qual das habilidades DELA.
 * Uma lista só com todas as habilidades raciais do jogo é intratável.
 */
function pickersDeOutraRaca(
  chaveBase: string,
  pedido: PedidoRacial,
  respostas: Record<string, unknown>,
  racas: IndexedRace[],
  poderes: IndexedPoder[],
  racaAtual: string
): PickerRacial[] {
  const excluir = new Set([...(pedido.excluir ?? []).map(toNomeSlug), racaAtual]);
  const nomeRaca = `${chaveBase}_raca`;
  const escolhida = (respostas[nomeRaca] as string | undefined) ?? "";

  const pickers: PickerRacial[] = [
    {
      name: nomeRaca,
      label: "Raça de origem",
      opcoes: racas
        .filter((r) => !excluir.has(toNomeSlug(r.name)))
        .map((r) => ({ id: r.id, nome: r.name, selected: r.id === escolhida }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    },
  ];

  if (!escolhida) return pickers;

  // As habilidades da raça escolhida são as que o item dela concede.
  const raca = racas.find((r) => r.id === escolhida);
  const porId = new Map(poderes.map((p) => [p.id, p]));
  const daRaca: PickerOpcao[] = [];
  for (const grant of raca?.system.grants ?? []) {
    for (const escolha of grant.choices ?? []) {
      const id = String(escolha.uuid ?? "").split(".").pop();
      const poder = id ? porId.get(id) : undefined;
      // Modificador de atributo não é habilidade — não entra na lista.
      if (poder && poder.system.tipo === "racial") {
        daRaca.push({
          id: poder.id,
          nome: poder.name,
          selected: poder.id === respostas[`${chaveBase}_0_0`],
        });
      }
    }
  }

  pickers.push({
    name: `${chaveBase}_0_0`,
    label: `Habilidade de ${raca?.name ?? "outra raça"}`,
    opcoes: daRaca.sort((a, b) => a.nome.localeCompare(b.nome)),
  });
  return pickers;
}

function montarEscolhasRaciais(
  racaRef: string,
  respostas: Record<string, unknown>,
  poderes: IndexedPoder[],
  magias: IndexedMagia[],
  elegibilidade: PartialWizardState,
  racas: IndexedRace[]
): EscolhaRacialView[] {
  const racaAtual = toNomeSlug(racaRef);
  return escolhasDaRaca(racaRef).map((escolha) => {
    const ramoEscolhido = respostas[`${escolha.chave}_ramo`] as string | undefined;
    const pedido = pedidoAtivo(escolha, respostas);

    const pickers: PickerRacial[] = [];
    partesDoPedido(pedido).forEach((parte, pi) => {
      if (parte.tipo === "habilidade_outra_raca") {
        pickers.push(
          ...pickersDeOutraRaca(escolha.chave, parte, respostas, racas, poderes, racaAtual)
        );
        return;
      }
      for (let i = 0; i < parte.quantidade; i++) {
        const name = `${escolha.chave}_${pi}_${i}`;
        const escolhido = (respostas[name] as string | undefined) ?? "";
        // Em pedido de N perícias, o que já foi pego some das outras caixas.
        const usados = new Set(
          Array.from({ length: parte.quantidade }, (_, j) => respostas[`${escolha.chave}_${pi}_${j}`])
            .filter((v, j) => j !== i && typeof v === "string" && v)
            .map(String)
        );
        pickers.push({
          name,
          label:
            parte.quantidade > 1
              ? `${rotuloDoPedido(parte)} ${i + 1}`
              : rotuloDoPedido(parte),
          opcoes: opcoesDoPedido(parte, {
            escolhido,
            poderes,
            magias,
            racaAtual,
            elegibilidade,
          }).filter((o) => !usados.has(o.id)),
        });
      }
    });

    return {
      chave: escolha.chave,
      habilidade: escolha.habilidade,
      ramos: escolha.ramos.map((r) => ({
        id: r.id,
        rotulo: r.rotulo,
        selected: r.id === ramoEscolhido,
      })),
      pickers,
    };
  });
}
