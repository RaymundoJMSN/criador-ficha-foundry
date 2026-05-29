import origensDataRaw from "../data/origens.json";
const origensData = origensDataRaw as unknown as Origem[];

export interface OrigensBeneficio {
  pericias: string[];
  poderes: string[];
  poder_unico_id: string | null;
}

export interface Origem {
  id: string;
  nome: string;
  itens_iniciais: string[];
  beneficios: OrigensBeneficio;
}

export function listOrigens(): Origem[] {
  return origensData;
}

export function getOrigem(id: string): Origem | null {
  return origensData.find((o) => o.id === id) ?? null;
}

export function getPick2Candidates(origemId: string): string[] {
  const origem = getOrigem(origemId);
  if (!origem) return [];
  const autoId = origem.beneficios.poder_unico_id;
  if (!autoId) return origem.beneficios.poderes;
  return origem.beneficios.poderes.filter((p) => p !== autoId);
}
