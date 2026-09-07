import { getOrigem } from "../../rules/origem.js";
import { pendencias, type EngineState } from "../../rules/engine.js";
import { getDivindade } from "../../rules/divindade.js";
import type { WizardState } from "../state.js";
import { classesDoPersonagem, temMulticlasse } from "../../rules/multiclasse.js";
import { totaisRaciaisDoEstado } from "../../rules/subescolhas.js";
import { faixaDoPersonagem, complicacaoEscolhida, complicacoesIdadeEscolhidas, getComplicacaoIdade } from "../../rules/idade.js";

export interface ResumoNomes {
  habilidades: string[];
  poderes: string[];
  magias: string[];
  itens: string[];
  pericias: string[];
}

/** Código de 4 letras do sistema → nome. */
const PERICIA_POR_CODIGO: Record<string, string> = {
  acro: "Acrobacia", ades: "Adestramento", atle: "Atletismo", atua: "Atuação", cava: "Cavalgar",
  conh: "Conhecimento", cura: "Cura", dipl: "Diplomacia", enga: "Enganação", fort: "Fortitude",
  furt: "Furtividade", guer: "Guerra", inic: "Iniciativa", inti: "Intimidação", intu: "Intuição",
  inve: "Investigação", jogo: "Jogatina", ladi: "Ladinagem", luta: "Luta", mist: "Misticismo",
  nobr: "Nobreza", ofic: "Ofício", perc: "Percepção", pilo: "Pilotagem", pont: "Pontaria",
  refl: "Reflexos", reli: "Religião", sobr: "Sobrevivência", vont: "Vontade",
};

export interface RevisaoContext {
  /** Nomes do que vai para a ficha (habilidades, poderes, magias, itens, perícias). */
  resumo: ResumoNomes;
  stepTitle: string;
  nome: string;
  nivel: number;
  racaNome: string;
  origemNome: string;
  classeNome: string;
  /** "Guerreiro 3 / Ladino 2" na multiclasse; só o nome sem ela. */
  classesTexto: string;
  divindadeNome: string;
  /** `value` = final (base + raça); `base` só aparece quando a raça mexe. */
  atributos: Array<{ label: string; value: number; base: number; racial: number; idade: number }>;
  /** Faixa etária e complicações escolhidas (vazio quando as regras estão desligadas). */
  idadeResumo: string[];
  poderesSelecionados: number;
  magiasSelecionadas: number;
  equipamentoSelecionado: number;
  dinheiroRestante: number;
  isComplete: boolean;
  /** O que ainda falta; vazio = pode criar. */
  pendencias: string[];
  errors: string[];
}

const ATTR_LABELS: Record<string, string> = {
  for: "For",
  des: "Des",
  con: "Con",
  int: "Int",
  sab: "Sab",
  car: "Car",
};

export function prepareRevisaoContext(
  state: WizardState,
  racaNome: string,
  classeNome: string,
  errors: string[] = [],
  dinheiroRestante: number = state.dinheiroRestante,
  nomeDoPoder: (id: string) => string | undefined = () => undefined,
  nomes: ResumoNomes = { habilidades: [], poderes: [], magias: [], itens: [], pericias: [] }
): RevisaoContext {
  const origem = getOrigem(state.origemId);
  const divindade = state.divindadeId ? getDivindade(state.divindadeId) : null;

  const faltando = pendencias(state as unknown as EngineState);

  // A ficha mostra o atributo com a raça somada; a Revisão mostrava só a base
  // e um anão de Con 2 aparecia com 2 aqui e 4 na ficha.
  const daRaca = totaisRaciaisDoEstado(state);
  const faixa = faixaDoPersonagem(state);
  const idadeAtributos = faixa.atributos;
  const atributos = (["for", "des", "con", "int", "sab", "car"] as const).map((id) => {
    const base = state.atributosBase[id] ?? 0;
    const racial = daRaca[id] ?? 0;
    const idade = idadeAtributos[id] ?? 0;
    return { label: ATTR_LABELS[id], value: base + racial + idade, base, racial, idade };
  });

  const idadeResumo: string[] = [];
  if (state.config.idadesVariadas) idadeResumo.push(`Faixa etária: ${faixa.nome} (${faixa.idades})`);
  const compl = complicacaoEscolhida(state);
  if (compl) idadeResumo.push(`Complicação: ${nomeDoPoder(compl) ?? compl}`);
  const complIdade = complicacoesIdadeEscolhidas(state).map((id) => getComplicacaoIdade(id)?.nome ?? id);
  if (complIdade.length) idadeResumo.push(`Complicações de idade: ${complIdade.join(", ")}`);

  const classesTexto = classesDoPersonagem(state)
    .map((c) => (c.principal ? classeNome : c.classeNome) + (temMulticlasse(state) ? ` ${c.niveis}` : ""))
    .join(" / ");

  const pericias = nomes.pericias.map((code) => PERICIA_POR_CODIGO[code] ?? code).sort((a, b) => a.localeCompare(b));

  return {
    stepTitle: "Revisão",
    idadeResumo,
    classesTexto,
    resumo: { ...nomes, pericias },
    nome: state.nome,
    nivel: state.nivel,
    racaNome,
    origemNome: origem?.nome ?? state.origemId,
    classeNome,
    divindadeNome: divindade?.nome ?? "",
    atributos,
    poderesSelecionados: state.poderes.length,
    magiasSelecionadas: state.magias.length,
    equipamentoSelecionado: state.equipamento.length,
    dinheiroRestante,
    isComplete: faltando.length === 0,
    pendencias: faltando,
    errors,
  };
}
