import {
  ATRIBUTOS,
  type Atributo,
  type Distribuicao,
  listMetodos,
  validatePointBuy,
  pointBuyCost,
  POINT_BUY_INITIAL_POINTS,
  valoresFixos,
  VALKARIA,
} from "../../rules/atributos.js";
import type { WizardState } from "../state.js";

export const ATTR_LABELS: Record<string, string> = {
  for: "Força",
  des: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  sab: "Sabedoria",
  car: "Carisma",
};

/** Resumo de cada método (regra em uma linha; LB p.17 e HA p.280-281). */
const METODO_TEXTO: Record<string, string> = {
  compra_pontos:
    "10 pontos para gastar; todos os atributos começam em 0, baixar um para −1 devolve 1 ponto, máximo 4.",
  rolagem_padrao:
    "Role 4d6 seis vezes descartando o menor dado de cada, converta pela tabela e distribua os seis valores como quiser. Somando menos de 6, o menor é rolado de novo.",
  classica: "Como a padrão, mas 3d6 sem descarte — personagens mais fracos.",
  epica: "Como a padrão, mas 3d6 descartando o menor e somando +6 — personagens mais fortes.",
  valkaria:
    "Cada atributo começa em 8. Role 7d6 e aplique cada dado inteiro no atributo que quiser; o total é convertido pela tabela (máximo 4).",
  khalmyr: "Sem rolar nada: distribua 3, 3, 2, 1, 0 e −1 entre os atributos.",
  nimb: "Role 7d20 e descarte o menor; distribua os seis. 1–3 vira −3, 18–19 vira 4 e 20 vira 5.",
};

interface Opcao {
  valor: string;
  label: string;
  selected: boolean;
}

export interface AtributosContext {
  stepTitle: string;
  metodos: Array<{ id: string; nome: string; categoria: string; selected: boolean }>;
  isCompra: boolean;
  isValkaria: boolean;
  isPool: boolean;
  /** Método de rolagem ainda sem valores gerados. */
  precisaRolar: boolean;
  podeRolar: boolean;
  atributos: Array<{
    id: string;
    label: string;
    value: number;
    custo: number;
    opcoes: Opcao[];
  }>;
  pool: number[];
  dados: Array<{ idx: number; valor: number; opcoes: Opcao[] }>;
  valkariaTotais: Array<{ label: string; total: number; value: number }>;
  pontosRestantes: number;
  pontosNegativo: boolean;
  pontosTotal: number;
  metodoDescricao: string;
  metodoTexto: string;
  errors: string[];
}

export function prepareAtributosContext(
  state: WizardState,
  errors: string[] = []
): AtributosContext {
  const metodos = listMetodos().map((m) => ({
    id: m.id,
    nome: m.nome,
    categoria: m.categoria,
    selected: m.id === state.metodoAtributos,
  }));

  const metodo = state.metodoAtributos;
  const isCompra = metodo === "compra_pontos";
  const isValkaria = metodo === "valkaria";
  const isPool = !isCompra && !isValkaria;
  const esc = state.escolhasPorItem;

  const pool = isPool
    ? (valoresFixos(metodo) ?? ((esc["atributos_pool"] as number[] | undefined) ?? []))
    : [];
  const dist = (esc["atributos_dist"] as Distribuicao | undefined) ?? {};
  const dados = isValkaria ? ((esc["valkaria_dados"] as number[] | undefined) ?? []) : [];
  const vdist = (esc["valkaria_dist"] as Array<Atributo | undefined> | undefined) ?? [];

  const atributos = ATRIBUTOS.map((id) => {
    const value = state.atributosBase[id] ?? 0;
    let custo = 0;
    try {
      custo = pointBuyCost(value);
    } catch {
      /* fora da tabela de compra */
    }
    const opcoes: Opcao[] = [
      { valor: "", label: "—", selected: dist[id] === undefined },
      ...pool.map((v, i) => ({ valor: String(i), label: String(v), selected: dist[id] === i })),
    ];
    return { id, label: ATTR_LABELS[id]!, value, custo, opcoes };
  });

  const soma = {} as Record<Atributo, number>;
  for (const a of ATRIBUTOS) soma[a] = VALKARIA.base;
  const dadosCtx = dados.map((valor, idx) => {
    const atual = vdist[idx];
    if (atual && ATRIBUTOS.includes(atual)) soma[atual] += valor;
    return {
      idx,
      valor,
      opcoes: [
        { valor: "", label: "—", selected: !atual },
        ...ATRIBUTOS.map((a) => ({ valor: a, label: ATTR_LABELS[a]!, selected: atual === a })),
      ],
    };
  });
  const valkariaTotais =
    isValkaria && dados.length
      ? ATRIBUTOS.map((a) => ({
          label: ATTR_LABELS[a]!,
          total: soma[a],
          value: state.atributosBase[a] ?? 0,
        }))
      : [];

  const pbResult = validatePointBuy(state.atributosBase);
  const gerado = isValkaria ? dados.length > 0 : pool.length > 0;

  return {
    stepTitle: "Atributos",
    metodos,
    isCompra,
    isValkaria,
    isPool,
    precisaRolar: !isCompra && !gerado,
    podeRolar: !isCompra && !valoresFixos(metodo),
    atributos,
    pool,
    dados: dadosCtx,
    valkariaTotais,
    pontosRestantes: pbResult.remaining,
    pontosNegativo: pbResult.remaining < 0,
    pontosTotal: POINT_BUY_INITIAL_POINTS,
    metodoDescricao: metodos.find((m) => m.selected)?.nome ?? "",
    metodoTexto: METODO_TEXTO[metodo] ?? "",
    errors,
  };
}
