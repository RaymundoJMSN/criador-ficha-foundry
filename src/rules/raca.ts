import racasDataRaw from "../data/racas.json";

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
}

export interface TreinarPericia {
  tipo: string;
  quantidade: number;
}

export interface RacaData {
  id: string;
  nome: string;
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

/** Find a race by its db id or by a display name (slug-matched). */
export function getRaca(idOrName: string): RacaData | null {
  const s = slug(idOrName);
  return racasData.find((r) => r.id === s || slug(r.nome) === s) ?? null;
}

/**
 * Number of extra trained skills a race grants by free choice
 * (sum of `treinar_pericias` quantities). Used in the perícia count:
 * treináveis = classe.numero + max(0, Int) + raça.
 */
export function getRaceSkillBonus(idOrName: string): number {
  const raca = getRaca(idOrName);
  if (!raca) return 0;
  return (raca.treinar_pericias ?? []).reduce((sum, t) => sum + (t.quantidade ?? 0), 0);
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
  return ((getRaca(idOrName) as unknown as { escolhas?: EscolhaRacial[] })?.escolhas ?? []);
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
