import type { WizardState } from "../state.js";
import type { IndexedPoder } from "../../compendium/types.js";
import { toNomeSlug } from "../../compendium/slug.js";
import {
  FAIXAS,
  COMPLICACOES_IDADE,
  faixaDoPersonagem,
  complicacoesIdadeExigidas,
  complicacoesIdadeEscolhidas,
  jaViCoisas,
  pendenciasDeIdade,
} from "../../rules/idade.js";

const ATTR_LABEL: Record<string, string> = { for: "For", des: "Des", con: "Con", int: "Int", sab: "Sab", car: "Car" };

export interface IdadeContext {
  stepTitle: string;
  mostraFaixas: boolean;
  faixas: Array<{ id: string; nome: string; idades: string; resumo: string; selected: boolean }>;
  faixaResumo: string;
  mostraJaViCoisas: boolean;
  jaViCoisas: boolean;
  complicacoesIdadeExigidas: number;
  complicacoesIdade: Array<{ id: string; nome: string; resumo: string; selected: boolean; bloqueado: boolean }>;
  mostraComplicacao: boolean;
  complicacoes: Array<{ id: string; name: string; descricao: string; classe: string; selected: boolean }>;
  complicacaoEscolhida: string;
  poderesGeraisExtras: number;
  errors: string[];
}

function resumoFaixa(f: (typeof FAIXAS)[number]): string {
  const partes: string[] = [];
  const mods = Object.entries(f.atributos).map(([a, v]) => `${ATTR_LABEL[a]} ${v > 0 ? "+" : ""}${v}`);
  if (mods.length) partes.push(mods.join(", "));
  if (f.tamanhoMenor) partes.push("tamanho menor");
  if (f.niveisExtras) partes.push(`+${f.niveisExtras} nível(is)`);
  if (f.complicacoes) partes.push(`${f.complicacoes} complicação(ões) de idade`);
  if (f.beneficiosOrigem < 2) partes.push(f.beneficiosOrigem === 0 ? "sem origem" : "1 benefício de origem");
  for (const h of f.habilidades) if (h.efeitos.length) partes.push(h.nome);
  if (f.bloqueiaAumentoFisico) partes.push("sem Aumento de Atributo físico");
  return partes.length ? partes.join("; ") : "nenhum efeito";
}

export function prepareIdadeContext(
  state: WizardState,
  allPoderes: IndexedPoder[],
  errors: string[] = []
): IdadeContext {
  const config = state.config;
  const faixa = faixaDoPersonagem(state);
  const exigidas = complicacoesIdadeExigidas(state);
  const escolhidasIdade = complicacoesIdadeEscolhidas(state);
  const classeSlug = toNomeSlug(state.classeNome ?? "");

  // Complicações do compêndio: gerais (subtipo vazio) + as da classe do 1º nível (HA p.282).
  const complicacoes = config.complicacoes
    ? allPoderes
        .filter((p) => p.system.tipo === "complicacao")
        .filter((p) => !p.system.subtipo || toNomeSlug(p.system.subtipo) === classeSlug)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          id: p.id,
          name: p.name,
          descricao: p.system.descricao ?? "",
          classe: p.system.subtipo ?? "",
          selected: state.escolhasPorItem["complicacao"] === p.id,
        }))
    : [];

  return {
    stepTitle: "Idade & Complicações",
    mostraFaixas: config.idadesVariadas,
    faixas: FAIXAS.map((f) => ({ id: f.id, nome: f.nome, idades: f.idades, resumo: resumoFaixa(f), selected: f.id === faixa.id })),
    faixaResumo: resumoFaixa(faixa),
    mostraJaViCoisas: config.complicacaoIdade,
    jaViCoisas: jaViCoisas(state),
    complicacoesIdadeExigidas: exigidas,
    complicacoesIdade:
      exigidas > 0
        ? COMPLICACOES_IDADE.map((c) => ({
            id: c.id,
            nome: c.nome,
            resumo: c.resumo,
            selected: escolhidasIdade.includes(c.id),
            bloqueado: !escolhidasIdade.includes(c.id) && escolhidasIdade.length >= exigidas,
          }))
        : [],
    mostraComplicacao: config.complicacoes,
    complicacoes,
    complicacaoEscolhida: (state.escolhasPorItem["complicacao"] as string) ?? "",
    poderesGeraisExtras: (state.escolhasPorItem["complicacao"] && config.complicacoes ? 1 : 0) + (jaViCoisas(state) ? 1 : 0),
    errors: [...errors, ...pendenciasDeIdade(state)],
  };
}
