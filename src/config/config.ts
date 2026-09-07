import { MODULE_ID } from "../constants.js";

/**
 * Regras da mesa — o que o mestre decide antes de os jogadores criarem ficha
 * (o equivalente ao item de configuração do Call of Cthulhu). Guardado como
 * setting de mundo; todo cliente lê, só o mestre edita.
 *
 * Fontes: método de atributos e Pontos Variados (HA p.280-281), Raças Abertas
 * e Devoções Abertas (HA p.281), Complicações (HA p.282), Idades Variadas e
 * "Já Vi Coisas" (HA p.288-289).
 */
export interface ConfigCriacao {
  /** "livre" deixa o jogador escolher; qualquer outro valor trava o método. */
  metodoAtributos: string;
  /** Pontos da compra (Pontos Variados: 5 pé no chão, 10 padrão, 15 épico). */
  pontosCompra: number;
  /** Dinheiro inicial: tabela/4d6 do livro ou valor fixo em T$. */
  dinheiro: "padrao" | "fixo";
  dinheiroFixo: number;
  /** Nomes de raça/classe liberados; vazio = todas. */
  racasPermitidas: string[];
  classesPermitidas: string[];
  /** Complicações: uma complicação em troca de um poder geral (HA p.282). */
  complicacoes: boolean;
  /**
   * Complicação de idade em troca de um poder geral ("Já Vi Coisas", HA p.289).
   * No livro só o Adulto tem isso; ligado aqui vale para qualquer faixa etária
   * (regra da mesa).
   */
  complicacaoIdade: boolean;
  /** Idades Variadas: faixa etária com modificadores, níveis extras e complicações (HA p.288). */
  idadesVariadas: boolean;
  /** Raças Abertas: modificadores raciais em qualquer atributo (HA p.281). */
  racasAbertas: boolean;
  /** Devoções Abertas: qualquer deus, sem restrição de raça/classe (HA p.281). */
  devocoesAbertas: boolean;
}

export const CONFIG_PADRAO: ConfigCriacao = {
  metodoAtributos: "livre",
  pontosCompra: 10,
  dinheiro: "padrao",
  dinheiroFixo: 0,
  racasPermitidas: [],
  classesPermitidas: [],
  complicacoes: false,
  complicacaoIdade: false,
  idadesVariadas: false,
  racasAbertas: false,
  devocoesAbertas: false,
};

export const SETTING_CONFIG = "configuracao";

/** Preenche o que faltar (setting salvo por versão antiga do módulo). */
export function normalizarConfig(bruto: unknown): ConfigCriacao {
  const c = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<ConfigCriacao>;
  return {
    ...CONFIG_PADRAO,
    ...c,
    pontosCompra: Number(c.pontosCompra) > 0 ? Number(c.pontosCompra) : CONFIG_PADRAO.pontosCompra,
    dinheiroFixo: Math.max(0, Number(c.dinheiroFixo) || 0),
    racasPermitidas: Array.isArray(c.racasPermitidas) ? c.racasPermitidas.filter(Boolean) : [],
    classesPermitidas: Array.isArray(c.classesPermitidas) ? c.classesPermitidas.filter(Boolean) : [],
  };
}

export function lerConfig(): ConfigCriacao {
  try {
    // @ts-expect-error settings namespace tipado por módulo no fvtt-types
    return normalizarConfig(game.settings.get(MODULE_ID, SETTING_CONFIG));
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

export async function gravarConfig(config: ConfigCriacao): Promise<void> {
  // @ts-expect-error settings namespace tipado por módulo no fvtt-types
  await game.settings.set(MODULE_ID, SETTING_CONFIG, normalizarConfig(config));
}

/** Resumo em uma linha para o topo do wizard ("Regras da mesa: …"). */
export function resumoConfig(c: ConfigCriacao, nomeMetodo: (id: string) => string): string[] {
  const partes: string[] = [];
  if (c.metodoAtributos !== "livre") partes.push(`atributos por ${nomeMetodo(c.metodoAtributos)}`);
  if (c.pontosCompra !== 10) partes.push(`${c.pontosCompra} pontos na compra`);
  if (c.dinheiro === "fixo") partes.push(`T$ ${c.dinheiroFixo} iniciais`);
  if (c.racasPermitidas.length) partes.push(`${c.racasPermitidas.length} raça(s) liberada(s)`);
  if (c.classesPermitidas.length) partes.push(`${c.classesPermitidas.length} classe(s) liberada(s)`);
  if (c.complicacoes) partes.push("complicações");
  if (c.complicacaoIdade) partes.push("complicação de idade por poder");
  if (c.idadesVariadas) partes.push("idades variadas");
  if (c.racasAbertas) partes.push("raças abertas");
  if (c.devocoesAbertas) partes.push("devoções abertas");
  return partes;
}
