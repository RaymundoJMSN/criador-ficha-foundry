/**
 * Ofício é "várias perícias diferentes" (LB p.121): ao treinar Ofício o
 * personagem diz qual. O sistema traz seis fixas (`crafting: true` em
 * `T20.pericias`) e aceita até nove próprias (`ofi1`…`ofi9`, rótulo "Ofício: X").
 */
import { WizardStep } from "./steps.js";
import { validarBeneficios } from "./origem.js";
import { beneficiosDeOrigemPermitidos } from "./idade.js";
import type { ConfigCriacao } from "../config/config.js";

export interface EstadoOficio {
  origemId: string;
  escolhasPorItem: Record<string, unknown>;
  config: ConfigCriacao;
}

/** Ofício foi marcado na raça, na origem ou nas perícias da classe: é lá que se diz qual. */
export function passoDoOficio(state: EstadoOficio): WizardStep {
  const picks = (state.escolhasPorItem["pericias"] as { raca?: string[] } | undefined) ?? {};
  if ((picks.raca ?? []).includes("oficio")) return WizardStep.Raca;
  const daOrigem = state.origemId
    ? validarBeneficios(
        state.origemId,
        (state.escolhasPorItem["origem_beneficios"] as string[]) ?? [],
        beneficiosDeOrigemPermitidos(state)
      ).pericias.includes("oficio")
    : false;
  return daOrigem ? WizardStep.Origem : WizardStep.Pericias;
}

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
