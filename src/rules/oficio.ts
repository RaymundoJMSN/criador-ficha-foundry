/**
 * Ofício é "várias perícias diferentes" (LB p.121): ao treinar Ofício o
 * personagem diz qual. O sistema traz seis fixas (`crafting: true` em
 * `T20.pericias`) e aceita até nove próprias (`ofi1`…`ofi9`, rótulo "Ofício: X").
 */
export const OFICIOS_PADRAO: ReadonlyArray<{ code: string; nome: string }> = [
  { code: "alfa", nome: "Alfaiate" },
  { code: "alqu", nome: "Alquimista" },
  { code: "arme", nome: "Armeiro" },
  { code: "arte", nome: "Artesão" },
  { code: "cozi", nome: "Cozinheiro" },
  { code: "enge", nome: "Engenheiro" },
];
export const OFICIO_OUTRO = "outro";

export interface EscolhaOficio {
  /** code de OFICIOS_PADRAO ou OFICIO_OUTRO. */
  tipo: string;
  nome: string;
}

export function escolhaDeOficio(escolhas: Record<string, unknown>): EscolhaOficio {
  const e = (escolhas["oficio"] as Partial<EscolhaOficio> | undefined) ?? {};
  return { tipo: String(e.tipo ?? ""), nome: String(e.nome ?? "").trim() };
}

/** Só vale se o tipo é conhecido e, sendo próprio, tem nome. */
export function oficioResolvido(escolhas: Record<string, unknown>): boolean {
  const e = escolhaDeOficio(escolhas);
  if (e.tipo === OFICIO_OUTRO) return e.nome.length > 0;
  return OFICIOS_PADRAO.some((o) => o.code === e.tipo);
}

/**
 * O que gravar na ficha: `{ code }` para os fixos, `{ custom }` para o próprio
 * (formato de `_onPericiaCustomCreate` do sistema: `ofi1`, atributo Int,
 * somente treinada, treinada).
 */
export function periciaDoOficio(escolhas: Record<string, unknown>): { code: string } | { key: string; dados: Record<string, unknown> } | null {
  const e = escolhaDeOficio(escolhas);
  if (OFICIOS_PADRAO.some((o) => o.code === e.tipo)) return { code: e.tipo };
  if (e.tipo === OFICIO_OUTRO && e.nome) {
    return { key: "ofi1", dados: { label: `Ofício: ${e.nome}`, custom: true, atributo: "int", st: true, treinado: true } };
  }
  return null;
}
