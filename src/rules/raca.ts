import racasDataRaw from "../data/racas.json";
import { chaveDaRaca, montagemDaRaca, periciasTrocadasNaMontagem } from "./montagem.js";

export interface AtributoFixo {
  atributo: string;
  valor: number;
}

export interface AtributoEscolhaDef {
  valor: number;
  quantidade: number;
  atributos_diferentes?: boolean;
  atributos_disponiveis?: string[] | null;
  observacao?: string;
  /** "+2 em um atributo OU +1 em dois" (Kallyanach): o outro modo. */
  alternativa?: { valor: number; quantidade: number };
}

export interface TreinarPericia {
  tipo: string;
  quantidade: number;
}

export interface RacaData {
  id: string;
  nome: string;
  /** Aggelus/Sulfure → "suraggel": poderes "(Suraggel)" valem para as duas. */
  raca_base?: string | null;
  descricao: string | null;
  tamanho: string;
  deslocamento: number;
  atributos_fixos: AtributoFixo[];
  atributos_escolha: AtributoEscolhaDef[];
  bonus_pericias: string[];
  treinar_pericias: TreinarPericia[];
}

const racasData = racasDataRaw as unknown as RacaData[];

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Raças que só existem no compêndio (Moreau, Kallyanach, Vampiro…), lidas do item. */
const racasDoCompendio: RacaData[] = [];

/** Find a race by its db id or by a display name (slug-matched). */
export function getRaca(idOrName: string): RacaData | null {
  // "Golem (Ameaças de Arton)" → golem_desperto; "Kobolds" → kobold.
  const s = chaveDaRaca(idOrName);
  return (
    racasData.find((r) => r.id === s || slug(r.nome) === s) ??
    racasDoCompendio.find((r) => r.id === s || slug(r.nome) === s) ??
    null
  );
}

const NUMERO: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4 };

/**
 * "+1 em dois atributos", "+2 em um atributo a sua escolha ou +1 em dois
 * atributos a sua escolha", "+1 em Dois Atributos Diferentes" → grupo(s) de
 * escolha. Texto do campo `atributosDinamicos.description` do item de raça.
 *
 * "Diferentes" só quando o livro escreve a palavra: "+1 em dois atributos"
 * (Moreau, Minauro, Kallyanach) deixa pôr os dois no mesmo atributo; "+1 em
 * dois atributos diferentes" (Vampiro, Duende) não.
 */
export function escolhasDaDescricao(descricao: string, disponiveis: string[] | null): AtributoEscolhaDef[] {
  const t = descricao
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const modos: Array<{ valor: number; quantidade: number }> = [];
  for (const m of t.matchAll(/([+-]\d+) em (\w+) atributos?/g)) {
    const quantidade = NUMERO[m[2]!] ?? Number(m[2]);
    if (quantidade) modos.push({ valor: Number(m[1]), quantidade });
  }
  if (modos.length === 0) return [];
  // Modo principal = o de mais atributos (o jogador vê os slots todos e escolhe o outro se quiser).
  modos.sort((a, b) => b.quantidade - a.quantidade);
  const principal = modos[0]!;
  return [
    {
      valor: principal.valor,
      quantidade: principal.quantidade,
      atributos_diferentes: /diferente/.test(t),
      atributos_disponiveis: disponiveis && disponiveis.length < 6 ? disponiveis : null,
      observacao: descricao,
      ...(modos.length > 1 ? { alternativa: modos[1]! } : {}),
    },
  ];
}

/**
 * Registra as raças do compêndio que o T20-DB não tem, com atributos fixos e
 * escolhas tiradas do próprio item. Chamar depois do CompendiumIndex.build().
 */
export function registrarRacasDoCompendio(
  itens: Array<{
    name: string;
    system: {
      atributos?: Record<string, unknown>;
      tamanho?: string[];
      movement?: { walk?: number };
      atributosDinamicos?: { value?: string[]; description?: string };
    };
  }>
): number {
  racasDoCompendio.length = 0;
  for (const item of itens) {
    if (racasData.some((r) => r.id === slug(item.name) || slug(r.nome) === slug(item.name))) continue;
    const fixos: AtributoFixo[] = Object.entries(item.system.atributos ?? {})
      .filter(([, v]) => typeof v === "number" && v !== 0)
      .map(([atributo, valor]) => ({ atributo, valor: valor as number }));
    const din = item.system.atributosDinamicos;
    racasDoCompendio.push({
      id: slug(item.name),
      nome: item.name,
      descricao: null,
      tamanho: item.system.tamanho?.[0] ?? "med",
      deslocamento: item.system.movement?.walk ?? 9,
      atributos_fixos: fixos,
      atributos_escolha: din?.value?.length ? escolhasDaDescricao(din.description ?? "", din.value) : [],
      bonus_pericias: [],
      treinar_pericias: [],
    });
  }
  return racasDoCompendio.length;
}

/**
 * Number of extra trained skills a race grants by free choice
 * (sum of `treinar_pericias` quantities). Used in the perícia count:
 * treináveis = classe.numero + max(0, Int) + raça.
 */
export function getRaceSkillBonus(idOrName: string, escolhas: Record<string, unknown> = {}): number {
  const raca = getRaca(idOrName);
  if (!raca) return 0;
  const total = (raca.treinar_pericias ?? []).reduce((sum, t) => sum + (t.quantidade ?? 0), 0);
  // Mashin: uma maravilha mecânica no lugar de uma das perícias.
  return Math.max(0, total - periciasTrocadasNaMontagem(idOrName, escolhas));
}

/** Fixed (non-choosable) racial attribute modifiers, e.g. anão +2 con +1 sab -1 des. */
export function getRaceFixedModifiers(idOrName: string): Partial<Record<string, number>> {
  const raca = getRaca(idOrName);
  const out: Partial<Record<string, number>> = {};
  for (const f of raca?.atributos_fixos ?? []) {
    out[f.atributo] = (out[f.atributo] ?? 0) + f.valor;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Escolhas de habilidade racial                                      */
/* ------------------------------------------------------------------ */

export interface PedidoRacial {
  tipo: "pericia" | "poder" | "lista" | "magia" | "habilidade_outra_raca" | "misto";
  quantidade: number;
  /** Perícia: 0 = treinar, N = +N de bônus. */
  bonus?: number;
  filtro?: string | null;
  categoria?: string;
  circulo?: number;
  /** Magia: só desta escola (abreviação do compêndio: "adv"). */
  escola?: string;
  excluir?: string[];
  opcoes?: Array<{ id: string; rotulo: string }>;
  partes?: PedidoRacial[];
}

export interface EscolhaRacial {
  chave: string;
  habilidade: string;
  label: string;
  ramos: Array<{ id: string; rotulo: string; pedido: PedidoRacial }>;
  direto: PedidoRacial | null;
}

/** Escolhas que as habilidades da raça impõem (Memória Póstuma, Deformidade…). */
export function escolhasDaRaca(idOrName: string): EscolhaRacial[] {
  return [
    ...((getRaca(idOrName) as unknown as { escolhas?: EscolhaRacial[] })?.escolhas ?? []),
    // Raça que o T20-DB não tem (Vampiro): a escolha vem de montagem.json.
    ...(montagemDaRaca(idOrName)?.escolhas ?? []),
  ];
}

/** O pedido em vigor: o do ramo escolhido, ou o direto quando não há ramos. */
export function pedidoAtivo(
  escolha: EscolhaRacial,
  respostas: Record<string, unknown>
): PedidoRacial | null {
  if (escolha.ramos.length === 0) return escolha.direto;
  const ramoId = respostas[`${escolha.chave}_ramo`] as string | undefined;
  return escolha.ramos.find((r) => r.id === ramoId)?.pedido ?? null;
}

/** Achata `misto` para tratar cada parte como um pedido próprio. */
export function partesDoPedido(pedido: PedidoRacial | null): PedidoRacial[] {
  if (!pedido) return [];
  return pedido.tipo === "misto" ? (pedido.partes ?? []) : [pedido];
}

/**
 * Perícias treinadas e bônus vindos das escolhas raciais.
 * Chave da resposta: `<chave>_<indice do pedido>_<slot>`.
 */
export function periciasDeEscolhasRaciais(
  idOrName: string,
  respostas: Record<string, unknown>
): { treinadas: string[]; bonus: Array<{ pericia: string; valor: number }> } {
  const treinadas: string[] = [];
  const bonus: Array<{ pericia: string; valor: number }> = [];

  for (const escolha of escolhasDaRaca(idOrName)) {
    partesDoPedido(pedidoAtivo(escolha, respostas)).forEach((pedido, pi) => {
      if (pedido.tipo !== "pericia") return;
      for (let i = 0; i < pedido.quantidade; i++) {
        const valor = respostas[`${escolha.chave}_${pi}_${i}`] as string | undefined;
        if (!valor) continue;
        if (pedido.bonus) bonus.push({ pericia: valor, valor: pedido.bonus });
        else treinadas.push(valor);
      }
    });
  }
  return { treinadas, bonus };
}

/** Ids de item escolhidos nas habilidades raciais (poder, magia, habilidade de outra raça). */
export function itensDeEscolhasRaciais(
  idOrName: string,
  respostas: Record<string, unknown>
): string[] {
  const ids: string[] = [];
  for (const escolha of escolhasDaRaca(idOrName)) {
    partesDoPedido(pedidoAtivo(escolha, respostas)).forEach((pedido, pi) => {
      if (!["poder", "magia", "habilidade_outra_raca"].includes(pedido.tipo)) return;
      for (let i = 0; i < pedido.quantidade; i++) {
        const valor = respostas[`${escolha.chave}_${pi}_${i}`] as string | undefined;
        if (valor) ids.push(valor);
      }
    });
  }
  return ids;
}

/** O que ainda falta responder nas habilidades raciais. */
export function pendenciasDeEscolhasRaciais(
  idOrName: string,
  respostas: Record<string, unknown>
): string[] {
  const faltando: string[] = [];
  for (const escolha of escolhasDaRaca(idOrName)) {
    const pedido = pedidoAtivo(escolha, respostas);
    if (!pedido) {
      faltando.push(`${escolha.habilidade}: escolha uma opção.`);
      continue;
    }
    partesDoPedido(pedido).forEach((parte, pi) => {
      for (let i = 0; i < parte.quantidade; i++) {
        if (!respostas[`${escolha.chave}_${pi}_${i}`]) {
          faltando.push(`${escolha.habilidade}: complete a escolha.`);
          return;
        }
      }
    });
  }
  return [...new Set(faltando)];
}
