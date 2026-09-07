import type { ConfigCriacao } from "../config/config.js";

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
    habilidades: [],
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
}

/** Faixa em vigor: só existe se Idades Variadas estiver ligada. */
export function faixaDoPersonagem(s: EstadoIdade): Faixa {
  return s.config.idadesVariadas ? getFaixa(s.escolhasPorItem["idade_faixa"] as string | undefined) : getFaixa(FAIXA_PADRAO);
}

/** Nível de jogo = nível do grupo + níveis extras da faixa etária. */
export function nivelEfetivo(nivelGrupo: number, s: EstadoIdade): number {
  return Math.min(20, nivelGrupo + faixaDoPersonagem(s).niveisExtras);
}

/** "Já Vi Coisas": trocou uma complicação de idade a mais por um poder geral? */
export function jaViCoisas(s: EstadoIdade): boolean {
  return s.config.complicacaoIdade && Boolean(s.escolhasPorItem["idade_ja_vi_coisas"]);
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
  return (complicacaoEscolhida(s) ? 1 : 0) + (jaViCoisas(s) ? 1 : 0);
}

/** Benefícios de origem que a faixa deixa (2, 1 ou 0). */
export function beneficiosDeOrigemPermitidos(s: EstadoIdade): number {
  return faixaDoPersonagem(s).beneficiosOrigem;
}

/** Ids das complicações de idade escolhidas, só as válidas. */
export function complicacoesIdadeEscolhidas(s: EstadoIdade): string[] {
  const ids = (s.escolhasPorItem["complicacoes_idade"] as string[] | undefined) ?? [];
  return [...new Set(ids.filter((id) => getComplicacaoIdade(id)))];
}

/** O passo Idade & Complicações só existe se alguma das três regras estiver ligada. */
export function temPassoIdade(config: ConfigCriacao): boolean {
  return config.complicacoes || config.complicacaoIdade || config.idadesVariadas;
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
