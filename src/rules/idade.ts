import type { ConfigCriacao } from "../config/config.js";
import { racaSemOrigem } from "./raca.js";

/**
 * Idades Variadas — Heróis de Arton p.288-291 (Tabela 4-2) — e Complicações
 * (HA p.282). Só regra numérica; o texto do livro fica em textos.json.
 */

export type Atributo = "for" | "des" | "con" | "int" | "sab" | "car";

/** Uma mudança de Active Effect (modo ADD) no ator. */
export interface Efeito {
  chave: string;
  valor: number;
}

export interface HabilidadeDeIdade {
  nome: string;
  resumo: string;
  efeitos: Efeito[];
}

export interface Faixa {
  id: string;
  nome: string;
  idades: string;
  atributos: Partial<Record<Atributo, number>>;
  /** "Você começa o jogo com N níveis adicionais em relação aos mais novos do grupo." */
  niveisExtras: number;
  /** Complicações de idade obrigatórias ("O Peso da Idade"). */
  complicacoes: number;
  /** Benefícios de origem: 2 normal, 1 adolescente (Origem em Construção), 0 criança (Sem Origem). */
  beneficiosOrigem: number;
  tamanhoMenor: boolean;
  /** Velho e ancião não podem escolher Aumento de Atributo em atributo físico. */
  bloqueiaAumentoFisico: boolean;
  habilidades: HabilidadeDeIdade[];
}

export const FAIXAS: Faixa[] = [
  {
    id: "crianca",
    nome: "Criança",
    idades: "9-12",
    atributos: { for: -2, con: -1, sab: -1 },
    niveisExtras: 0,
    complicacoes: 0,
    beneficiosOrigem: 0,
    tamanhoMenor: true,
    bloqueiaAumentoFisico: false,
    habilidades: [
      {
        nome: "Protegido dos Deuses",
        resumo: "+2 na Defesa e +5 em todos os testes de resistência.",
        efeitos: [
          { chave: "system.attributes.defesa.bonus", valor: 2 },
          { chave: "system.modificadores.pericias.resistencia", valor: 5 },
        ],
      },
      { nome: "Sem Origem", resumo: "Não recebe benefícios de origem.", efeitos: [] },
    ],
  },
  {
    id: "adolescente",
    nome: "Adolescente",
    idades: "13-17",
    atributos: { sab: -1 },
    niveisExtras: 0,
    complicacoes: 0,
    beneficiosOrigem: 1,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: false,
    habilidades: [
      {
        nome: "Ímpeto Juvenil",
        resumo: "+3 pontos de mana.",
        efeitos: [{ chave: "system.attributes.pm.bonus.total", valor: 3 }],
      },
      { nome: "Origem em Construção", resumo: "Só um benefício de origem, em vez de dois.", efeitos: [] },
    ],
  },
  {
    id: "jovem",
    nome: "Jovem",
    idades: "18-24",
    atributos: {},
    niveisExtras: 0,
    complicacoes: 0,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: false,
    habilidades: [],
  },
  {
    id: "adulto",
    nome: "Adulto",
    idades: "25-39",
    atributos: {},
    niveisExtras: 0,
    complicacoes: 0,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: false,
    habilidades: [
      {
        nome: "Já Vi Coisas",
        resumo: "Opcional: um poder geral a mais, em troca de uma complicação de idade.",
        efeitos: [],
      },
    ],
  },
  {
    id: "maduro",
    nome: "Maduro",
    idades: "40-59",
    atributos: {},
    niveisExtras: 1,
    complicacoes: 2,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: false,
    habilidades: [{ nome: "Veterano Calejado", resumo: "Um nível a mais que o grupo.", efeitos: [] }],
  },
  {
    id: "velho",
    nome: "Velho",
    idades: "60-79",
    atributos: { for: -1, des: -1, con: -1 },
    niveisExtras: 2,
    complicacoes: 3,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: true,
    habilidades: [{ nome: "Outono da Vida", resumo: "Dois níveis a mais que o grupo.", efeitos: [] }],
  },
  {
    id: "anciao",
    nome: "Ancião",
    idades: "80+",
    atributos: { for: -2, des: -2, con: -2 },
    niveisExtras: 3,
    complicacoes: 4,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: true,
    habilidades: [{ nome: "O Inverno da Vida", resumo: "Três níveis a mais que o grupo.", efeitos: [] }],
  },
];

export const FAIXA_PADRAO = "jovem";

/**
 * Envelhecimento do Livro Básico ("Toques Finais"): só modificador de atributo,
 * cumulativo (velho = maduro + velho). Sem nível extra nem complicação — é a
 * alternativa às Idades Variadas de Heróis de Arton, nunca as duas juntas.
 */
export const FAIXAS_CLASSICAS: Faixa[] = [
  {
    id: "jovem",
    nome: "Jovem",
    idades: "até 44",
    atributos: {},
    niveisExtras: 0,
    complicacoes: 0,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: false,
    habilidades: [],
  },
  {
    id: "maduro_classico",
    nome: "Maduro",
    idades: "45+",
    atributos: { for: -1, des: -1, con: -1, int: 1, sab: 1, car: 1 },
    niveisExtras: 0,
    complicacoes: 0,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: false,
    habilidades: [],
  },
  {
    id: "velho_classico",
    nome: "Velho",
    idades: "70+",
    // Cumulativo com Maduro (o livro soma as duas linhas).
    atributos: { for: -3, des: -3, con: -3, int: 2, sab: 2, car: 2 },
    niveisExtras: 0,
    complicacoes: 0,
    beneficiosOrigem: 2,
    tamanhoMenor: false,
    bloqueiaAumentoFisico: false,
    habilidades: [],
  },
];

/** Faixas em uso: as de Heróis de Arton ou as do Livro Básico. */
export function faixasDaMesa(config: ConfigCriacao): Faixa[] {
  if (config.idadesVariadas) return FAIXAS;
  return config.envelhecimentoClassico ? FAIXAS_CLASSICAS : [];
}

export function getFaixa(id: string | undefined): Faixa {
  return FAIXAS.find((f) => f.id === id) ?? FAIXAS.find((f) => f.id === FAIXA_PADRAO)!;
}

/** Complicações de idade (HA p.290-291). `efeitos` só onde a regra é um número na ficha. */
export interface ComplicacaoIdade {
  id: string;
  nome: string;
  resumo: string;
  efeitos: Efeito[];
}

const per = (code: string, valor: number): Efeito => ({ chave: `system.pericias.${code}.bonus`, valor });

export const COMPLICACOES_IDADE: ComplicacaoIdade[] = [
  { id: "abatido", nome: "Abatido", resumo: "–2 PV por nível.", efeitos: [{ chave: "system.attributes.pv.bonus.nivel", valor: -2 }] },
  { id: "catarata", nome: "Catarata", resumo: "–5 em Percepção e Pontaria.", efeitos: [per("perc", -5), per("pont", -5)] },
  {
    id: "dedos_tremulos",
    nome: "Dedos Trêmulos",
    resumo: "–2 em Luta e Pontaria; ao usar item empunhado, 1 em 1d4 derruba o item.",
    efeitos: [per("luta", -2), per("pont", -2)],
  },
  { id: "definhamento", nome: "Definhamento", resumo: "–5 em Fortitude e em manobras de combate.", efeitos: [per("fort", -5)] },
  { id: "desatento", nome: "Desatento", resumo: "Na 1ª rodada de cena de ação, resultado ímpar num dado = surpreendido.", efeitos: [] },
  {
    id: "devagar_jovem",
    nome: "“Devagar, Jovem!”",
    resumo: "Deslocamento –3 m; não pode correr nem fazer investidas.",
    efeitos: [{ chave: "system.attributes.movement.walk", valor: -3 }],
  },
  { id: "gota", nome: "Gota", resumo: "Perde 1d6 PV em cada teste de Destreza ou de perícia de Destreza; só recupera descansando.", efeitos: [] },
  { id: "juntas_duras", nome: "Juntas Duras", resumo: "–5 em Acrobacia e Reflexos.", efeitos: [per("acro", -5), per("refl", -5)] },
  { id: "melancolico", nome: "Melancólico", resumo: "–1 PM por nível.", efeitos: [{ chave: "system.attributes.pm.bonus.nivel", valor: -1 }] },
  { id: "memorias_tristes", nome: "Memórias Tristes", resumo: "1 natural em qualquer teste: pasmo 1 rodada e frustrado até o fim do dia.", efeitos: [] },
  { id: "no_meu_tempo", nome: "“No Meu Tempo...”", resumo: "–5 em Intuição e Vontade.", efeitos: [per("intu", -5), per("vont", -5)] },
  { id: "pulmao_ruim", nome: "Pulmão Ruim", resumo: "Testes de Fortitude contra fadiga desde a 1ª rodada ao correr; investida = fatigado até o fim da cena.", efeitos: [] },
  { id: "rabugento", nome: "Rabugento", resumo: "–5 em testes de Carisma e perícias de Carisma, exceto Intimidação.", efeitos: [] },
  { id: "recurvado", nome: "Recurvado", resumo: "Conta como uma categoria de tamanho menor para alcance, manobras e armas.", efeitos: [] },
  { id: "sono_ruim", nome: "Sono Ruim", resumo: "Recuperação de PV/PM sempre uma categoria pior.", efeitos: [] },
  { id: "teimoso", nome: "Teimoso", resumo: "Falhou num teste que pode repetir? É obrigado a tentar de novo.", efeitos: [] },
  { id: "tosse", nome: "Tosse", resumo: "1 em 1d6 por rodada = atordoado 1 rodada; em perícias de Carisma, 1 em 1d6 = –5.", efeitos: [] },
  { id: "turrao", nome: "Turrão", resumo: "Não recebe metade do nível em perícias não treinadas.", efeitos: [] },
  { id: "velha_ferida", nome: "Velha Ferida", resumo: "Crítico sofrido: multiplicador +1 e fica fraco (cumulativo).", efeitos: [] },
];

export function getComplicacaoIdade(id: string): ComplicacaoIdade | undefined {
  return COMPLICACOES_IDADE.find((c) => c.id === id);
}

/* ------------------------------------------------------------------ */
/*  O que o estado do wizard responde                                  */
/* ------------------------------------------------------------------ */

export interface EstadoIdade {
  config: ConfigCriacao;
  escolhasPorItem: Record<string, unknown>;
  /** Só para a regra do golem (sem origem); ausente = a raça não importa. */
  racaNome?: string;
  racaId?: string;
}

/** Faixa em vigor: só existe se Idades Variadas estiver ligada. */
export function faixaDoPersonagem(s: EstadoIdade): Faixa {
  const faixas = faixasDaMesa(s.config);
  if (faixas.length === 0) return getFaixa(FAIXA_PADRAO);
  const id = s.escolhasPorItem["idade_faixa"] as string | undefined;
  return faixas.find((f) => f.id === id) ?? faixas.find((f) => f.id === FAIXA_PADRAO) ?? faixas[0]!;
}

/** Nível de jogo = nível do grupo + níveis extras da faixa etária. */
export function nivelEfetivo(nivelGrupo: number, s: EstadoIdade): number {
  return Math.min(20, nivelGrupo + faixaDoPersonagem(s).niveisExtras);
}

/**
 * "Já Vi Coisas" é habilidade do **Adulto** (HdA p.289): um poder geral em
 * troca de uma complicação de idade. Sem Idades Variadas ligada não há faixa,
 * então a regra vale para qualquer um (é o que o toggle do mestre quer dizer).
 */
export function podeJaViCoisas(s: EstadoIdade): boolean {
  if (!s.config.complicacaoIdade) return false;
  return !s.config.idadesVariadas || faixaDoPersonagem(s).id === "adulto";
}

/** "Já Vi Coisas": trocou uma complicação de idade a mais por um poder geral? */
export function jaViCoisas(s: EstadoIdade): boolean {
  return podeJaViCoisas(s) && Boolean(s.escolhasPorItem["idade_ja_vi_coisas"]);
}

/** Quantas complicações de idade o personagem tem de escolher. */
export function complicacoesIdadeExigidas(s: EstadoIdade): number {
  return faixaDoPersonagem(s).complicacoes + (jaViCoisas(s) ? 1 : 0);
}

/** Complicação normal escolhida (id de item do compêndio), se a regra estiver ligada. */
export function complicacaoEscolhida(s: EstadoIdade): string {
  return s.config.complicacoes ? ((s.escolhasPorItem["complicacao"] as string | undefined) ?? "") : "";
}

/** Poderes gerais extras: um pela complicação (HA p.282) e um pelo Já Vi Coisas (HA p.289). */
export function poderesGeraisExtras(s: EstadoIdade): number {
  return fontesDePoderExtra(s).length;
}

export interface FontePoderExtra {
  fonte: string;
  rotulo: string;
  /** Passo do wizard onde o poder é escolhido. */
  passo: "idade" | "raca";
}

/**
 * Cada fonte de poder geral extra é escolhida na tela onde nasce (Ray): Versátil
 * no passo Raça, complicação e Já Vi Coisas no passo Idade & Complicações.
 * `versatil_poder` só é gravado para humano.
 */
export function fontesDePoderExtra(s: EstadoIdade): FontePoderExtra[] {
  const out: FontePoderExtra[] = [];
  if (s.escolhasPorItem["versatil_poder"]) out.push({ fonte: "versatil", rotulo: "Poder geral (Versátil)", passo: "raca" });
  // Golem: "não tem direito a escolher uma origem, mas recebe um poder geral".
  if (racaSemOrigem(s.racaNome || s.racaId || "")) {
    out.push({ fonte: "sem_origem", rotulo: "Poder geral (Propósito de Criação)", passo: "raca" });
  }
  if (complicacaoEscolhida(s)) out.push({ fonte: "complicacao", rotulo: "Poder geral pela complicação", passo: "idade" });
  if (jaViCoisas(s)) out.push({ fonte: "ja_vi_coisas", rotulo: "Poder geral por Já Vi Coisas", passo: "idade" });
  return out;
}

/** fonte → id do poder escolhido (`escolhasPorItem.poderes_extras`), só fontes ativas e preenchidas. */
export function poderesExtrasEscolhidos(s: EstadoIdade): Record<string, string> {
  const salvos = (s.escolhasPorItem["poderes_extras"] as Record<string, string> | undefined) ?? {};
  const out: Record<string, string> = {};
  for (const f of fontesDePoderExtra(s)) if (salvos[f.fonte]) out[f.fonte] = salvos[f.fonte]!;
  return out;
}

/** Ids dos poderes que vieram das fontes extras (já estão em `state.poderes`). */
export function idsDePoderesExtras(s: EstadoIdade): string[] {
  return Object.values(poderesExtrasEscolhidos(s));
}

/** Benefícios de origem que a faixa deixa (2, 1 ou 0). */
export function beneficiosDeOrigemPermitidos(s: EstadoIdade): number {
  // Golem ("Propósito de Criação") não escolhe origem.
  if (racaSemOrigem(s.racaNome || s.racaId || "")) return 0;
  return faixaDoPersonagem(s).beneficiosOrigem;
}

/** Ids das complicações de idade escolhidas, só as válidas. */
export function complicacoesIdadeEscolhidas(s: EstadoIdade): string[] {
  const ids = (s.escolhasPorItem["complicacoes_idade"] as string[] | undefined) ?? [];
  return [...new Set(ids.filter((id) => getComplicacaoIdade(id)))];
}

/** O passo Idade & Complicações só existe se alguma das três regras estiver ligada. */
export function temPassoIdade(config: ConfigCriacao): boolean {
  return config.complicacaoIdade || config.idadesVariadas || config.envelhecimentoClassico;
}

/** Pendências do passo (texto para o jogador). */
export function pendenciasDeIdade(s: EstadoIdade): string[] {
  const out: string[] = [];
  const exigidas = complicacoesIdadeExigidas(s);
  const tem = complicacoesIdadeEscolhidas(s).length;
  if (tem < exigidas) out.push(`Escolha ${exigidas} complicação(ões) de idade — ${tem} marcada(s).`);
  if (tem > exigidas) out.push(`Complicações de idade a mais: remova ${tem - exigidas}.`);
  return out;
}
