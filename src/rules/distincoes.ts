import type { ConfigCriacao } from "../config/config.js";

/**
 * Distinções (Heróis de Arton cap. 2, p.104): "um conjunto de poderes
 * exclusivos, disponíveis apenas para personagens que sejam admitidos entre
 * seus membros… Marca da Distinção: habilidade recebida automaticamente ao
 * conquistar a distinção. Poderes de distinção: podem ser escolhidos como
 * poderes gerais." A admissão é narrativa (mestre) e só a partir do 5º nível.
 *
 * No compêndio: poder com `tipo:"distincao"` e `subtipo` = nome da distinção;
 * a marca é o item cujo nome termina em "(Marca)".
 */
export interface Distincao {
  nome: string;
  marca?: { id: string; name: string };
  poderes: Array<{ id: string; name: string }>;
}

const distincoes: Distincao[] = [];

export function registrarDistincoes(
  itens: Array<{ id: string; name: string; system: { tipo?: string; subtipo?: string } }>
): number {
  distincoes.length = 0;
  const porNome = new Map<string, Distincao>();
  for (const p of itens) {
    if (p.system.tipo !== "distincao") continue;
    const nome = (p.system.subtipo ?? "").replace(/\s+/g, " ").trim();
    if (!nome) continue;
    const d = porNome.get(nome) ?? { nome, poderes: [] };
    if (/\(marca\)\s*$/i.test(p.name)) d.marca = { id: p.id, name: p.name.replace(/\s*\(marca\)\s*$/i, "") };
    else d.poderes.push({ id: p.id, name: p.name });
    porNome.set(nome, d);
  }
  distincoes.push(...[...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome)));
  for (const d of distincoes) d.poderes.sort((a, b) => a.name.localeCompare(b.name));
  return distincoes.length;
}

export function listDistincoes(): Distincao[] {
  return distincoes;
}

export function getDistincao(nome: string): Distincao | null {
  return distincoes.find((d) => d.nome === nome) ?? null;
}

export const NIVEL_MINIMO_DISTINCAO = 5;

export interface EstadoDistincao {
  nivel: number;
  config: ConfigCriacao;
  escolhasPorItem: Record<string, unknown>;
}

/** Só com a regra ligada pelo mestre e de patamar veterano (5º nível) para cima. */
export function podeTerDistincao(s: EstadoDistincao): boolean {
  return s.config.distincoes && s.nivel >= NIVEL_MINIMO_DISTINCAO;
}

export function distincaoEscolhida(s: EstadoDistincao): Distincao | null {
  if (!podeTerDistincao(s)) return null;
  const nome = s.escolhasPorItem["distincao"] as string | undefined;
  return nome ? getDistincao(nome) : null;
}

/** Ids de poder de QUALQUER distinção — para podar quando a distinção muda. */
export function idsDePoderesDeDistincao(): Set<string> {
  return new Set(distincoes.flatMap((d) => d.poderes.map((p) => p.id)));
}
