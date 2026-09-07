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
  type AtributoEscolhaDef,
} from "../../rules/raca.js";
import { PERICIA_SLUGS } from "../../rules/pericia-slug.js";
import { montagemDaRaca, opcoesMarcadas, subMarcada, pendenciasDaMontagem, type OpcaoMontagem } from "../../rules/montagem.js";
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
  variavel: "Variável (escolhido na montagem)",
};

export interface ModSlot {
  groupIndex: number;
  slotIndex: number;
  selected: string;
  opcoes: Array<{ code: string; label: string; selected: boolean }>;
}

export interface ModGroup {
  /** Modos alternativos ("+2 em um" / "+1 em dois"); vazio quando não há. */
  modos: Array<{ id: string; label: string; selected: boolean }>;
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
  /** Duende, Kallyanach, Golem Desperto…: passos com N opções cada. */
  montagem: PassoView[];
}

export interface OpcaoView {
  id: string;
  nome: string;
  descricao: string;
  resumo: string;
  nota: string;
  selected: boolean;
  bloqueada: boolean;
  sub: { name: string; rotulo: string; opcoes: PickerOpcao[] } | null;
}

export interface PassoView {
  id: string;
  nome: string;
  titulo: string;
  nota: string;
  /** radio (uma) ou checkbox (várias / opcional). */
  radio: boolean;
  inputName: string;
  opcoes: OpcaoView[];
  erros: string[];
}

function resumoDaOpcao(o: OpcaoMontagem): string {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(o.atributos ?? {})) partes.push(`${ATRIBUTO_LABEL[k] ?? k} ${v > 0 ? "+" : ""}${v}`);
  if (o.atributos_escolha) partes.push(`+${o.atributos_escolha.valor} em ${o.atributos_escolha.quantidade} atributo${o.atributos_escolha.quantidade > 1 ? "s" : ""} à escolha`);
  if (o.tamanho) partes.push(TAMANHO_LABEL[o.tamanho] ?? o.tamanho);
  if (o.deslocamento) partes.push(`deslocamento ${o.deslocamento} m`);
  return partes.join(" · ");
}

/** Descrição do poder no compêndio: prefere o item do subtipo da raça ("Voo" é magia e presente do duende). */
function descricaoDoPoder(nomePoder: string, racaRef: string, poderes: IndexedPoder[]): string {
  const alvo = toNomeSlug(nomePoder);
  const raca = toNomeSlug(racaRef.split(" (")[0]!);
  const candidatos = poderes.filter((p) => toNomeSlug(p.name).startsWith(alvo) || toNomeSlug(p.name) === alvo);
  const item =
    candidatos.find((p) => toNomeSlug(p.system.subtipo ?? "").startsWith(raca)) ??
    candidatos.find((p) => p.system.tipo === "racial") ??
    candidatos[0];
  return item?.system.descricao ?? "";
}

function montarMontagem(
  racaRef: string,
  escolhas: Record<string, unknown>,
  poderes: IndexedPoder[],
  magias: IndexedMagia[]
): PassoView[] {
  const m = montagemDaRaca(racaRef);
  if (!m?.passos) return [];
  const erros = pendenciasDaMontagem(racaRef, escolhas);
  return m.passos.map((passo) => {
    const marc = opcoesMarcadas(passo, escolhas);
    const ids = new Set(marc.map((o) => o.id));
    const cheio = marc.length >= passo.escolher;
    return {
      id: passo.id,
      nome: passo.nome,
      titulo: `${passo.nome} — ${passo.opcional ? "opcional, até" : "escolha"} ${passo.escolher}`,
      nota: passo.nota ?? "",
      radio: passo.escolher === 1 && !passo.opcional,
      inputName: `mont-${passo.id}`,
      erros: erros.filter((e) => e.startsWith(`${passo.nome}:`) || passo.opcoes.some((o) => e.startsWith(`${o.nome}`))),
      opcoes: passo.opcoes.map((o) => {
        const selected = ids.has(o.id);
        const sub = o.sub && selected ? montarSub(passo.id, o, escolhas, magias) : null;
        return {
          id: o.id,
          nome: o.nome,
          descricao: o.poder ? descricaoDoPoder(o.poder, racaRef, poderes) : "",
          resumo: resumoDaOpcao(o),
          nota: o.nota ?? "",
          selected,
          bloqueada: !selected && cheio && passo.escolher > 1,
          sub,
        };
      }),
    };
  });
}

function montarSub(passoId: string, o: OpcaoMontagem, escolhas: Record<string, unknown>, magias: IndexedMagia[]) {
  const atual = subMarcada(passoId, o.id, escolhas);
  const opcoes: PickerOpcao[] = o.sub?.opcoes
    ? o.sub.opcoes.map((x) => ({ id: x.id, nome: x.rotulo, selected: x.id === atual }))
    : magias
        .filter((mg) => Number(mg.system.circulo) === (o.sub?.magia?.circulo ?? 1))
        .filter((mg) => !o.sub?.magia?.tradicao || mg.system.tipo === o.sub.magia.tradicao)
        .map((mg) => ({ id: mg.id, nome: mg.name, selected: mg.id === atual }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { name: `mont-${passoId}-${o.id}-sub`, rotulo: o.sub?.rotulo ?? "Escolha", opcoes };
}

export interface RacaContext {
  stepTitle: string;
  racaOptions: RacaOption[];
  selectedDetail: RacaDetail | null;
  errors: string[];
}

const PACK_ROTULO: Record<string, string> = {
  racas: "Livro Básico",
  "ameacas-de-arton": "Ameaças de Arton",
  "herois-de-arton": "Heróis de Arton",
  "deuses-de-arton": "Deuses de Arton",
  "guia-de-npcs-and-dbs": "Guia de NPCs",
};
function nomeDoPack(packId: string): string {
  const k = packId.split(".").pop() ?? packId;
  return PACK_ROTULO[k] ?? k;
}

/**
 * Nome exibido (e guardado em `racaNome`). Dois "Golem" no compêndio — Livro
 * Básico e Golens Despertos de Ameaças — ganham o pack no nome; é por esse
 * nome que `getRaca` acha o golem_desperto (alias em rules/montagem.ts).
 */
export function nomeDaRaca(r: IndexedRace, todas: IndexedRace[]): string {
  const repetido = todas.some((o) => o.id !== r.id && o.name === r.name);
  return repetido ? `${r.name} (${nomeDoPack(r.packId)})` : r.name;
}

function listar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function formatAtributos(raca: RacaData, extras: AtributoEscolhaDef[] = []): string {
  const partes = raca.atributos_fixos
    .filter((f) => f.valor !== 0)
    .map((f) => `${f.valor > 0 ? "+" : ""}${f.valor} ${ATRIBUTO_LABEL[f.atributo] ?? f.atributo}`);
  for (const e of [...raca.atributos_escolha, ...extras]) {
    const modo = e.alternativa ? ` ou +${e.alternativa.valor} em ${e.alternativa.quantidade}` : "";
    partes.push(`+${e.valor} em ${e.quantidade} atributo${e.quantidade > 1 ? "s" : ""}${e.atributos_diferentes && e.quantidade > 1 ? " diferentes" : ""}${modo} à escolha`);
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
function buildModGroups(racaRef: string, choices: string[][], escolhas: Record<string, unknown> = {}): ModGroup[] {
  return getRaceModifierGroups(racaRef, escolhas).map((def, gi) => {
    // Kallyanach: "+2 em um atributo ou +1 em dois" — radio escolhe o modo.
    const modoAlt = Boolean(def.alternativa) && escolhas[`raca_mod_modo-${gi}`] === "alt";
    const qtd = modoAlt ? def.alternativa!.quantidade : (def.quantidade ?? 1);
    const escolhidos = (choices[gi] ?? []).slice(0, qtd);
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

    const valor = modoAlt ? def.alternativa!.valor : (def.valor ?? 1);
    let titulo = `${valor > 0 ? "+" : ""}${valor} em ${qtd} atributo${qtd > 1 ? "s" : ""}`;
    if (diferentes && qtd > 1) titulo += " diferentes";
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
      modos: def.alternativa
        ? [
            { id: "principal", label: `${def.valor > 0 ? "+" : ""}${def.valor} em ${def.quantidade} atributo${def.quantidade > 1 ? "s" : ""}`, selected: !modoAlt },
            { id: "alt", label: `${def.alternativa.valor > 0 ? "+" : ""}${def.alternativa.valor} em ${def.alternativa.quantidade} atributo${def.alternativa.quantidade > 1 ? "s" : ""}`, selected: modoAlt },
          ]
        : [],
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
      name: nomeDaRaca(r, racas),
      selected: r.id === state.racaId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const selecionada = racas.find((r) => r.id === state.racaId);
  let selectedDetail: RacaDetail | null = null;

  if (selecionada) {
    const nome = nomeDaRaca(selecionada, racas);
    const dbRaca = getRaca(nome);
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
      name: nome,
      descricao: descricaoFoundry || String(dbRaca?.descricao ?? ""),
      // Duende: os Dons vêm da montagem, não do T20-DB.
      atributosTexto: dbRaca ? formatAtributos(dbRaca, montagemDaRaca(nome)?.atributos_escolha ?? []) : "—",
      modGroups: dbRaca ? buildModGroups(nome, choices, state.escolhasPorItem) : [],
      racaAberta: state.config.racasAbertas && dbRaca ? montarRacaAberta(nome, state.escolhasPorItem) : null,
      montagem: montarMontagem(nome, state.escolhasPorItem, todosPoderes, todasMagias),
      poderesRaciais: poderesDaRaca(selecionada, todosPoderes),
      periciasBonus: (dbRaca?.bonus_pericias ?? []).map((p) =>
        typeof p === "string" ? p : String((p as { pericia?: string }).pericia ?? "")
      ),
      tamanho: TAMANHO_LABEL[tamanhoBruto.toLowerCase()] ?? tamanhoBruto,
      deslocamento: `${deslocamento} ${unidade}`,
      escolhasRaciais: montarEscolhasRaciais(
        nome,
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
      return (pedido.opcoes ?? []).map((o) => marcar(o.id, o.rotulo)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

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
        .filter((p) => describeUnmet(toNomeSlug(p.name), ctx.elegibilidade, p.system.descricao ?? "").length === 0)
        .map((p) => marcar(p.id, p.name))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    case "magia":
      return ctx.magias
        .filter((m) => Number(m.system.circulo) === (pedido.circulo ?? 1))
        .filter((m) => !pedido.escola || m.system.escola === pedido.escola)
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
