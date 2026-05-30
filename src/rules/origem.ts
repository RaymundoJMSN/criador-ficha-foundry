import origensDataRaw from "../data/origens.json";
const origensData = origensDataRaw as unknown as Origem[];

export interface OrigensBeneficio {
  pericias: string[];
  poderes: string[];
  poder_unico_id: string | null;
}

export interface ItemInicial {
  item: string;
  valor_max?: string;
  observacao?: string;
}

export interface Origem {
  id: string;
  nome: string;
  itens_iniciais: ItemInicial[];
  beneficios: OrigensBeneficio;
}

export function listOrigens(): Origem[] {
  return origensData;
}

export function getOrigem(id: string): Origem | null {
  return origensData.find((o) => o.id === id) ?? null;
}

/**
 * Renders an origem's starting items as readable strings.
 * Data entries are objects ({item, valor_max?, observacao?}); rendering them
 * directly in a template yields "[object Object]".
 */
export function formatItensIniciais(origemId: string): string[] {
  const origem = getOrigem(origemId);
  if (!origem) return [];
  return (origem.itens_iniciais ?? []).map((it) => {
    let line = it.item;
    if (it.valor_max) line += ` (até ${it.valor_max})`;
    if (it.observacao) line += ` — ${it.observacao}`;
    return line;
  });
}

export function getPick2Candidates(origemId: string): string[] {
  const origem = getOrigem(origemId);
  if (!origem) return [];
  const autoId = origem.beneficios.poder_unico_id;
  if (!autoId) return origem.beneficios.poderes;
  return origem.beneficios.poderes.filter((p) => p !== autoId);
}
