import {
  listDivindadesParaPersonagem,
  isDivindadeObrigatoria,
  type Divindade,
} from "../../rules/divindade.js";
import { toNomeSlug } from "../../compendium/slug.js";
import type { WizardState } from "../state.js";

const DIVINE_CLASSES = ["clerigo", "paladino", "druida"];

export interface DivindadeContext {
  stepTitle: string;
  obrigatoria: boolean;
  divindades: Array<{ id: string; nome: string; selected: boolean }>;
  selectedDivindade: { id: string; nome: string; poderesConcedidos: string[] } | null;
  divindadePoder: string | null;
  todosPoderesAuto: boolean;
  errors: string[];
}

export function prepareDivindadeContext(
  state: WizardState,
  errors: string[] = []
): DivindadeContext {
  const classeSlug = toNomeSlug(state.classeNome ?? "");
  const racaSlug = toNomeSlug(state.racaNome ?? "");

  const divindades = listDivindadesParaPersonagem(racaSlug, classeSlug);
  const mappedDivindades = divindades.map((d: Divindade) => ({
    id: d.id,
    nome: d.nome,
    selected: d.id === state.divindadeId,
  }));

  const selected = divindades.find((d: Divindade) => d.id === state.divindadeId) ?? null;
  const selectedDivindade = selected
    ? { id: selected.id, nome: selected.nome, poderesConcedidos: selected.poderes_concedidos }
    : null;

  const todosPoderesAuto = DIVINE_CLASSES.includes(classeSlug);
  const divindadePoder = (state.escolhasPorItem["divindade_poder"] as string | undefined) ?? null;

  return {
    stepTitle: "Divindade",
    obrigatoria: isDivindadeObrigatoria(classeSlug),
    divindades: mappedDivindades,
    selectedDivindade,
    divindadePoder,
    todosPoderesAuto,
    errors,
  };
}
