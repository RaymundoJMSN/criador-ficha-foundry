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

const vazia = (): EscolhaOficio => ({ tipo: "", nome: "" });

/**
 * Ofício pode ser treinado várias vezes, uma por ofício diferente (LB p.121):
 * a escolha é uma LISTA. Estado antigo (um objeto só) vira lista de um.
 */
export function escolhasDeOficio(escolhas: Record<string, unknown>): EscolhaOficio[] {
  const bruto = escolhas["oficio"];
  const lista = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];
  return lista.map((e) => {
    const o = (e ?? {}) as Partial<EscolhaOficio>;
    return { tipo: String(o.tipo ?? ""), nome: String(o.nome ?? "").trim() };
  });
}

/** A escolha de índice `i` (ou uma vazia). */
export function escolhaDeOficio(escolhas: Record<string, unknown>, i = 0): EscolhaOficio {
  return escolhasDeOficio(escolhas)[i] ?? vazia();
}

function completa(e: EscolhaOficio): boolean {
  if (e.tipo === OFICIO_OUTRO) return e.nome.length > 0;
  return OFICIOS_PADRAO.some((o) => o.code === e.tipo);
}

/** Nome do ofício para comparar/gravar ("Armeiro", "Escriba"). */
export function nomeDoOficio(e: EscolhaOficio): string {
  return e.tipo === OFICIO_OUTRO ? e.nome : (OFICIOS_PADRAO.find((o) => o.code === e.tipo)?.nome ?? "");
}

/** Todas as `quantos` escolhas feitas, sem repetir ofício. */
export function oficiosResolvidos(escolhas: Record<string, unknown>, quantos = 1): boolean {
  const lista = escolhasDeOficio(escolhas).slice(0, quantos);
  if (lista.length < quantos || !lista.every(completa)) return false;
  const nomes = lista.map((e) => nomeDoOficio(e).toLowerCase());
  return new Set(nomes).size === nomes.length;
}

/** Compatível com o uso antigo (um ofício só). */
export function oficioResolvido(escolhas: Record<string, unknown>): boolean {
  return oficiosResolvidos(escolhas, 1);
}

/**
 * O que gravar na ficha: `{ code }` para os fixos, `{ custom }` para o próprio
 * (formato de `_onPericiaCustomCreate` do sistema: `ofi1`, atributo Int,
 * somente treinada, treinada).
 */
export type PericiaDeOficio = { code: string } | { key: string; dados: Record<string, unknown> };

/** Uma entrada de ficha por ofício: os fixos pelo código, os próprios em ofi1, ofi2… */
export function periciasDosOficios(escolhas: Record<string, unknown>, quantos = 1): PericiaDeOficio[] {
  const out: PericiaDeOficio[] = [];
  let proprios = 0;
  for (const e of escolhasDeOficio(escolhas).slice(0, quantos)) {
    if (OFICIOS_PADRAO.some((o) => o.code === e.tipo)) {
      out.push({ code: e.tipo });
    } else if (e.tipo === OFICIO_OUTRO && e.nome) {
      proprios += 1;
      out.push({
        key: `ofi${proprios}`,
        dados: { label: `Ofício: ${e.nome}`, custom: true, atributo: "int", st: true, treinado: true },
      });
    }
  }
  return out;
}

export function periciaDoOficio(escolhas: Record<string, unknown>): PericiaDeOficio | null {
  return periciasDosOficios(escolhas, 1)[0] ?? null;
}
